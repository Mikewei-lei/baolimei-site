import { and, desc, eq, isNull } from 'drizzle-orm';
import { getDb } from './db';
import { assetReferences, assets, projects, users } from './schema';
import { ApiError } from './http';
import {
  buildStorageKey,
  createS3DownloadUrl,
  createUploadTarget,
  deleteObject,
  objectExists,
  storageDriver,
} from './storage';
import { createDownloadUrl } from './storage';
import { serverEnv } from './env';
import { audit } from './audit';

const MIME_RULES: Record<string, { kind: 'image' | 'video' | 'audio'; max: number }> = {
  'image/png': { kind: 'image', max: 25 * 1024 * 1024 },
  'image/jpeg': { kind: 'image', max: 25 * 1024 * 1024 },
  'image/webp': { kind: 'image', max: 25 * 1024 * 1024 },
  'image/gif': { kind: 'image', max: 25 * 1024 * 1024 },
  'video/mp4': { kind: 'video', max: 60 * 1024 * 1024 },
  'video/webm': { kind: 'video', max: 60 * 1024 * 1024 },
  'video/quicktime': { kind: 'video', max: 60 * 1024 * 1024 },
  'audio/mpeg': { kind: 'audio', max: 50 * 1024 * 1024 },
  'audio/wav': { kind: 'audio', max: 50 * 1024 * 1024 },
  'audio/ogg': { kind: 'audio', max: 50 * 1024 * 1024 },
  'audio/mp4': { kind: 'audio', max: 50 * 1024 * 1024 },
};

export function validateAssetMeta(mimeType: string, size: number) {
  const rule = MIME_RULES[mimeType.toLowerCase()];
  if (!rule) throw new ApiError(400, 'ASSET_TYPE_INVALID', '不支持的文件类型');
  if (!Number.isFinite(size) || size <= 0) throw new ApiError(400, 'ASSET_SIZE_INVALID', '文件大小不合法');
  if (size > rule.max) {
    throw new ApiError(400, 'ASSET_TOO_LARGE', `文件不能超过 ${Math.round(rule.max / 1024 / 1024)}MB`);
  }
  return rule;
}

export async function createAssetUpload(input: {
  userId: string;
  projectId?: string | null;
  filename: string;
  mimeType: string;
  size: number;
}) {
  const rule = validateAssetMeta(input.mimeType, input.size);
  const db = getDb();

  if (input.projectId) {
    const project = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.id, input.projectId),
          eq(projects.ownerId, input.userId),
          eq(projects.status, 'active'),
          isNull(projects.deletedAt)
        )
      )
      .limit(1);
    if (!project.length) throw new ApiError(403, 'PROJECT_FORBIDDEN', '无权访问该项目');
  }

  const id = crypto.randomUUID();
  const storageKey = buildStorageKey(input.userId, id, input.filename);
  const driver = storageDriver();
  const [asset] = await db
    .insert(assets)
    .values({
      id,
      ownerId: input.userId,
      projectId: input.projectId || null,
      kind: rule.kind,
      mimeType: input.mimeType,
      size: input.size,
      storageDriver: driver,
      storageKey,
      originalName: input.filename.slice(0, 255),
      status: 'pending',
    })
    .returning();

  const target = await createUploadTarget({
    assetId: id,
    ownerId: input.userId,
    storageKey,
    mimeType: input.mimeType,
    size: input.size,
  });

  await audit({
    actorId: input.userId,
    action: 'asset.upload.create',
    targetType: 'asset',
    targetId: id,
    metadata: { mimeType: input.mimeType, size: input.size, projectId: input.projectId || null },
  });

  return { asset, upload: target };
}

export async function completeAssetUpload(userId: string, assetId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(assets)
    .where(and(eq(assets.id, assetId), eq(assets.ownerId, userId), isNull(assets.deletedAt)))
    .limit(1);
  const asset = rows[0];
  if (!asset) throw new ApiError(404, 'ASSET_NOT_FOUND', '素材不存在');
  if (asset.status === 'ready') return asset;
  if (!['pending', 'uploaded'].includes(asset.status)) {
    throw new ApiError(409, 'ASSET_STATE_INVALID', '素材状态不允许完成上传');
  }

  const object = await objectExists(asset.storageKey);
  if (!object.exists) throw new ApiError(409, 'ASSET_OBJECT_MISSING', '文件尚未上传完成');
  if (asset.size > 0 && object.size > 0 && Math.abs(object.size - asset.size) > 1024) {
    throw new ApiError(409, 'ASSET_SIZE_MISMATCH', '上传文件大小不一致');
  }

  const [updated] = await db
    .update(assets)
    .set({ status: 'ready', updatedAt: new Date() })
    .where(eq(assets.id, asset.id))
    .returning();

  await audit({
    actorId: userId,
    action: 'asset.upload.complete',
    targetType: 'asset',
    targetId: asset.id,
    metadata: { size: object.size, mimeType: asset.mimeType },
  });
  return updated;
}

export async function assetUrl(asset: typeof assets.$inferSelect) {
  if (asset.storageDriver === 's3') {
    return createS3DownloadUrl(asset.storageKey, 900);
  }
  return createDownloadUrl(asset.id, 900);
}

export function assetDto(asset: typeof assets.$inferSelect, url?: string) {
  return {
    id: asset.id,
    kind: asset.kind,
    mimeType: asset.mimeType,
    size: asset.size,
    originalName: asset.originalName,
    status: asset.status,
    projectId: asset.projectId,
    createdAt: asset.createdAt,
    url: url || null,
  };
}

export async function listAssets(input: {
  userId: string;
  projectId?: string | null;
  kind?: string | null;
  limit?: number;
}) {
  const db = getDb();
  const filters = [eq(assets.ownerId, input.userId), isNull(assets.deletedAt)];
  if (input.projectId) filters.push(eq(assets.projectId, input.projectId));
  if (input.kind) filters.push(eq(assets.kind, input.kind));
  const rows = await db
    .select()
    .from(assets)
    .where(and(...filters))
    .orderBy(desc(assets.createdAt))
    .limit(Math.min(100, Math.max(1, input.limit || 30)));
  return Promise.all(rows.map(async (asset) => assetDto(asset, asset.status === 'ready' ? await assetUrl(asset) : undefined)));
}

export async function getAssetForUser(userId: string, assetId: string) {
  const rows = await getDb()
    .select()
    .from(assets)
    .where(and(eq(assets.id, assetId), eq(assets.ownerId, userId), isNull(assets.deletedAt)))
    .limit(1);
  if (!rows[0]) throw new ApiError(404, 'ASSET_NOT_FOUND', '素材不存在');
  return rows[0];
}

export async function deleteAsset(userId: string, assetId: string, force = false) {
  const db = getDb();
  const asset = await getAssetForUser(userId, assetId);
  const refs = await db
    .select({ id: assetReferences.id })
    .from(assetReferences)
    .where(eq(assetReferences.assetId, assetId));
  if (refs.length && !force) {
    throw new ApiError(409, 'ASSET_IN_USE', '素材仍被画布引用，请先解除引用或使用强制删除', {
      references: refs.length,
    });
  }
  if (force && refs.length) {
    await db.delete(assetReferences).where(eq(assetReferences.assetId, assetId));
  }
  await db
    .update(assets)
    .set({ status: 'deleted', deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(assets.id, assetId));
  await deleteObject(asset.storageKey);
  await audit({
    actorId: userId,
    action: 'asset.delete',
    targetType: 'asset',
    targetId: assetId,
    metadata: { forced: force },
  });
  return { id: assetId, deleted: true };
}

export async function setAvatar(userId: string, assetId: string) {
  const asset = await getAssetForUser(userId, assetId);
  if (asset.kind !== 'image') throw new ApiError(400, 'AVATAR_TYPE_INVALID', '头像必须是图片');
  if (asset.status !== 'ready') throw new ApiError(409, 'ASSET_NOT_READY', '头像尚未上传完成');
  await getDb().update(users).set({ avatarAssetId: assetId, updatedAt: new Date() }).where(eq(users.id, userId));
  return asset;
}

export const MAX_ASSET_SIZE = Math.max(...Object.values(MIME_RULES).map((x) => x.max));
export const ASSET_MIME_RULES = MIME_RULES;
export const STORAGE_DATA_DIR = serverEnv.dataDir;
