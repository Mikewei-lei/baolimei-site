import { and, desc, eq, isNull } from 'drizzle-orm';
import { getDb } from './db';
import { canvases, projects } from './schema';
import { ApiError } from './http';
import { audit } from './audit';

const EMPTY_GRAPH = {
  version: 2,
  nodes: [],
  edges: [],
  groups: [],
  view: { x: 40, y: 20, k: 1 },
  name: '主画布',
};

function projectDto(project: typeof projects.$inferSelect, canvas: typeof canvases.$inferSelect | null) {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    coverAssetId: project.coverAssetId,
    status: project.status,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    canvas: canvas
      ? {
          id: canvas.id,
          name: canvas.name,
          version: canvas.version,
          nodeCount: canvas.nodeCount,
          edgeCount: canvas.edgeCount,
          updatedAt: canvas.updatedAt,
        }
      : null,
  };
}

export async function listProjects(userId: string) {
  const db = getDb();
  const rows = await db
    .select({ project: projects, canvas: canvases })
    .from(projects)
    .leftJoin(canvases, eq(canvases.projectId, projects.id))
    .where(and(eq(projects.ownerId, userId), eq(projects.status, 'active'), isNull(projects.deletedAt)))
    .orderBy(desc(projects.updatedAt));
  return rows.map((row) => projectDto(row.project, row.canvas));
}

export async function createProject(userId: string, input: { name: string; description?: string }) {
  const db = getDb();
  const result = await db.transaction(async (tx) => {
    const [project] = await tx
      .insert(projects)
      .values({
        ownerId: userId,
        name: input.name.trim().slice(0, 120) || '未命名项目',
        description: input.description?.slice(0, 1000) || null,
      })
      .returning();
    const [canvas] = await tx
      .insert(canvases)
      .values({
        projectId: project.id,
        name: '主画布',
        data: { ...EMPTY_GRAPH, name: input.name.trim().slice(0, 120) || '未命名项目' },
      })
      .returning();
    return { project, canvas };
  });

  await audit({
    actorId: userId,
    action: 'project.create',
    targetType: 'project',
    targetId: result.project.id,
  });
  return projectDto(result.project, result.canvas);
}

export async function getProject(userId: string, projectId: string) {
  const db = getDb();
  const rows = await db
    .select({ project: projects, canvas: canvases })
    .from(projects)
    .leftJoin(canvases, eq(canvases.projectId, projects.id))
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.ownerId, userId),
        eq(projects.status, 'active'),
        isNull(projects.deletedAt)
      )
    )
    .limit(1);
  const row = rows[0];
  if (!row) throw new ApiError(404, 'PROJECT_NOT_FOUND', '项目不存在或无权访问');
  return projectDto(row.project, row.canvas);
}

export async function updateProject(userId: string, projectId: string, input: { name?: string; description?: string | null }) {
  const db = getDb();
  const [updated] = await db
    .update(projects)
    .set({
      ...(input.name ? { name: input.name.trim().slice(0, 120) } : {}),
      ...(input.description !== undefined ? { description: input.description?.slice(0, 1000) || null } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId), eq(projects.status, 'active')))
    .returning();
  if (!updated) throw new ApiError(404, 'PROJECT_NOT_FOUND', '项目不存在或无权访问');
  await audit({
    actorId: userId,
    action: 'project.update',
    targetType: 'project',
    targetId: projectId,
    metadata: { name: input.name ?? null },
  });
  return projectDto(updated, null);
}

export async function deleteProject(userId: string, projectId: string) {
  const db = getDb();
  const [deleted] = await db
    .update(projects)
    .set({ status: 'deleted', deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, userId), eq(projects.status, 'active')))
    .returning({ id: projects.id });
  if (!deleted) throw new ApiError(404, 'PROJECT_NOT_FOUND', '项目不存在或无权访问');
  await audit({
    actorId: userId,
    action: 'project.delete',
    targetType: 'project',
    targetId: projectId,
  });
  return { id: projectId, deleted: true };
}

export async function getOrCreateDefaultProject(userId: string) {
  const existing = await listProjects(userId);
  if (existing.length) return existing[0];
  return createProject(userId, { name: '我的第一个项目' });
}
