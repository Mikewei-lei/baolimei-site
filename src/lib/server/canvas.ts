import { and, desc, eq, inArray, isNull, lt } from 'drizzle-orm';
import { getDb } from './db';
import {
  assetReferences,
  assets,
  canvasVersions,
  canvases,
  edges as edgesTable,
  nodes as nodesTable,
  projects,
} from './schema';
import { ApiError } from './http';
import { audit } from './audit';

export type GraphNode = {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  ratio?: number;
  title?: string;
  text?: string;
  src?: string;
  assetId?: string | null;
  mediaType?: string;
  modelId?: string;
  status?: string;
  progress?: number;
  error?: string;
  isDemo?: boolean;
  [key: string]: unknown;
};

export type GraphEdge = { id: string; from: string; to: string; [key: string]: unknown };
export type GraphGroup = { id: string; title?: string; nodeIds: string[]; [key: string]: unknown };
export type CanvasGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  groups: GraphGroup[];
  view?: { x: number; y: number; k: number };
  name?: string;
  version?: number;
};

export async function getCanvas(userId: string, canvasId: string) {
  const db = getDb();
  const rows = await db
    .select({ canvas: canvases, project: projects })
    .from(canvases)
    .innerJoin(projects, eq(canvases.projectId, projects.id))
    .where(
      and(
        eq(canvases.id, canvasId),
        eq(projects.ownerId, userId),
        eq(projects.status, 'active'),
        isNull(projects.deletedAt)
      )
    )
    .limit(1);
  const row = rows[0];
  if (!row) throw new ApiError(404, 'CANVAS_NOT_FOUND', '画布不存在或无权访问');
  const data = (row.canvas.data || {}) as CanvasGraph;
  return {
    canvas: {
      id: row.canvas.id,
      name: row.canvas.name,
      version: row.canvas.version,
      nodeCount: row.canvas.nodeCount,
      edgeCount: row.canvas.edgeCount,
      updatedAt: row.canvas.updatedAt,
      createdAt: row.canvas.createdAt,
    },
    project: { id: row.project.id, name: row.project.name },
    graph: {
      nodes: Array.isArray(data.nodes) ? data.nodes : [],
      edges: Array.isArray(data.edges) ? data.edges : [],
      groups: Array.isArray(data.groups) ? data.groups : [],
      view: data.view || { x: 40, y: 20, k: 1 },
      name: data.name || row.project.name,
    },
  };
}

function sanitizeGraph(graph: CanvasGraph) {
  const nodes = graph.nodes.map((node) => {
    const { src, ...rest } = node;
    const safeSrc =
      node.assetId
        ? ''
        : typeof src === 'string' && src.startsWith('/') && !src.startsWith('//')
          ? src
          : '';
    return { ...rest, src: safeSrc };
  });
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = graph.edges.filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to));
  const groups = graph.groups
    .map((group) => ({ ...group, nodeIds: group.nodeIds.filter((id) => nodeIds.has(id)) }))
    .filter((group) => group.nodeIds.length > 1);
  return {
    nodes,
    edges,
    groups,
    view: graph.view || { x: 40, y: 20, k: 1 },
    name: graph.name || '主画布',
  };
}

export async function saveCanvas(input: {
  userId: string;
  canvasId: string;
  graph: CanvasGraph;
  baseVersion: number;
  snapshot?: boolean;
  label?: string;
}) {
  const db = getDb();
  const clean = sanitizeGraph(input.graph);
  const assetIds = [
    ...new Set(clean.nodes.map((n) => n.assetId).filter((id): id is string => Boolean(id))),
  ];

  if (assetIds.length) {
    const owned = await db
      .select({ id: assets.id })
      .from(assets)
      .where(
        and(
          eq(assets.ownerId, input.userId),
          inArray(assets.id, assetIds),
          isNull(assets.deletedAt)
        )
      );
    const ownedIds = new Set(owned.map((a) => a.id));
    const missing = assetIds.filter((id) => !ownedIds.has(id));
    if (missing.length) {
      throw new ApiError(400, 'ASSET_REFERENCE_INVALID', '画布引用了不存在或无权访问的素材', {
        missing,
      });
    }
  }

  const result = await db.transaction(async (tx) => {
    const rows = await tx
      .select({ canvas: canvases, project: projects })
      .from(canvases)
      .innerJoin(projects, eq(canvases.projectId, projects.id))
      .where(
        and(
          eq(canvases.id, input.canvasId),
          eq(projects.ownerId, input.userId),
          eq(projects.status, 'active'),
          isNull(projects.deletedAt)
        )
      )
      .limit(1)
      .for('update');

    const row = rows[0];
    if (!row) throw new ApiError(404, 'CANVAS_NOT_FOUND', '画布不存在或无权访问');
    if (row.canvas.version !== input.baseVersion) {
      throw new ApiError(409, 'CANVAS_VERSION_CONFLICT', '画布已在其他设备更新，请重新加载', {
        currentVersion: row.canvas.version,
        serverUpdatedAt: row.canvas.updatedAt,
      });
    }

    const nextVersion = row.canvas.version + 1;
    const now = new Date();

    await tx
      .update(canvases)
      .set({
        data: clean as unknown as Record<string, unknown>,
        version: nextVersion,
        nodeCount: clean.nodes.length,
        edgeCount: clean.edges.length,
        updatedAt: now,
      })
      .where(eq(canvases.id, input.canvasId));

    await tx.update(projects).set({ updatedAt: now }).where(eq(projects.id, row.project.id));

    await tx.delete(edgesTable).where(eq(edgesTable.canvasId, input.canvasId));
    await tx.delete(nodesTable).where(eq(nodesTable.canvasId, input.canvasId));
    await tx.delete(assetReferences).where(eq(assetReferences.canvasId, input.canvasId));

    if (clean.nodes.length) {
      await tx.insert(nodesTable).values(
        clean.nodes.map((node) => ({
          id: node.id,
          canvasId: input.canvasId,
          type: String(node.type || 'text').slice(0, 24),
          title: node.title ? String(node.title).slice(0, 120) : null,
          x: Number(node.x || 0),
          y: Number(node.y || 0),
          width: Number(node.w || 260),
          ratio: typeof node.ratio === 'number' ? node.ratio : null,
          status: String(node.status || 'idle').slice(0, 20),
          assetId: node.assetId || null,
          data: node as unknown as Record<string, unknown>,
        }))
      );
    }

    if (clean.edges.length) {
      await tx.insert(edgesTable).values(
        clean.edges.map((edge) => ({
          id: edge.id,
          canvasId: input.canvasId,
          sourceId: edge.from,
          targetId: edge.to,
          data: edge as unknown as Record<string, unknown>,
        }))
      );
    }

    const refs = clean.nodes
      .filter((n) => n.assetId)
      .map((n) => ({
        assetId: n.assetId as string,
        canvasId: input.canvasId,
        nodeId: n.id,
      }));
    if (refs.length) await tx.insert(assetReferences).values(refs);

    const lastVersion = await tx
      .select({ version: canvasVersions.version, createdAt: canvasVersions.createdAt })
      .from(canvasVersions)
      .where(eq(canvasVersions.canvasId, input.canvasId))
      .orderBy(desc(canvasVersions.version))
      .limit(1);

    const shouldSnapshot =
      Boolean(input.snapshot) ||
      !lastVersion[0] ||
      Date.now() - new Date(lastVersion[0].createdAt).getTime() > 60_000;

    if (shouldSnapshot) {
      await tx.insert(canvasVersions).values({
        canvasId: input.canvasId,
        version: nextVersion,
        data: clean as unknown as Record<string, unknown>,
        label: input.label?.slice(0, 80) || (input.snapshot ? '手动快照' : '自动快照'),
        createdBy: input.userId,
      });
      const keepFrom = nextVersion - 50;
      if (keepFrom > 0) {
        await tx
          .delete(canvasVersions)
          .where(and(eq(canvasVersions.canvasId, input.canvasId), lt(canvasVersions.version, keepFrom)));
      }
    }

    return {
      id: input.canvasId,
      projectId: row.project.id,
      version: nextVersion,
      updatedAt: now,
      nodeCount: clean.nodes.length,
      edgeCount: clean.edges.length,
      snapshotVersion: shouldSnapshot ? nextVersion : null,
    };
  });

  await audit({
    actorId: input.userId,
    action: 'canvas.save',
    targetType: 'canvas',
    targetId: input.canvasId,
    metadata: {
      version: result.version,
      nodeCount: result.nodeCount,
      edgeCount: result.edgeCount,
      snapshot: Boolean(result.snapshotVersion),
    },
  });
  return result;
}

export async function listCanvasVersions(userId: string, canvasId: string) {
  await getCanvas(userId, canvasId);
  return getDb()
    .select({
      version: canvasVersions.version,
      label: canvasVersions.label,
      createdAt: canvasVersions.createdAt,
      createdBy: canvasVersions.createdBy,
    })
    .from(canvasVersions)
    .where(eq(canvasVersions.canvasId, canvasId))
    .orderBy(desc(canvasVersions.version))
    .limit(50);
}

export async function getCanvasVersion(userId: string, canvasId: string, version: number) {
  await getCanvas(userId, canvasId);
  const rows = await getDb()
    .select()
    .from(canvasVersions)
    .where(and(eq(canvasVersions.canvasId, canvasId), eq(canvasVersions.version, version)))
    .limit(1);
  if (!rows[0]) throw new ApiError(404, 'VERSION_NOT_FOUND', '版本不存在');
  return {
    version: rows[0].version,
    label: rows[0].label,
    createdAt: rows[0].createdAt,
    graph: rows[0].data,
  };
}

export async function restoreCanvasVersion(input: {
  userId: string;
  canvasId: string;
  version: number;
  baseVersion: number;
}) {
  const snapshot = await getCanvasVersion(input.userId, input.canvasId, input.version);
  return saveCanvas({
    userId: input.userId,
    canvasId: input.canvasId,
    graph: snapshot.graph as unknown as CanvasGraph,
    baseVersion: input.baseVersion,
    snapshot: true,
    label: `恢复 v${input.version}`,
  });
}
