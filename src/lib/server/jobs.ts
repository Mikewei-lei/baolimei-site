import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { getDb, getPool } from './db';
import { assets, canvases, generationJobs, modelProviders, nodes, projects, usageRecords } from './schema';
import { ApiError } from './http';
import { audit } from './audit';
import { models } from '@/lib/models';
import { assetUrl, getAssetForUser } from './assets';

const MODEL_MAP = new Map(models.map((m) => [m.id, m]));

export type JobInput = {
  projectId?: string | null;
  canvasId?: string | null;
  nodeId?: string | null;
  model: string;
  kind: 'text_to_video' | 'image_to_video' | 'text_to_image';
  prompt: string;
  params?: Record<string, unknown>;
  idempotencyKey?: string;
};

export async function createJob(userId: string, input: JobInput) {
  const model = MODEL_MAP.get(input.model);
  if (!model) throw new ApiError(400, 'MODEL_UNKNOWN', '模型不存在或已下线');
  const expectedKind = model.kind === 'image' ? 'text_to_image' : 'text_to_video';
  if (input.kind === 'text_to_image' && model.kind !== 'image') {
    throw new ApiError(400, 'MODEL_KIND_MISMATCH', '该模型不支持文生图');
  }
  if (input.kind !== 'text_to_image' && model.kind !== 'video') {
    throw new ApiError(400, 'MODEL_KIND_MISMATCH', '该模型不支持视频生成');
  }

  const db = getDb();
  if (input.projectId) {
    const rows = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.id, input.projectId),
          eq(projects.ownerId, userId),
          eq(projects.status, 'active'),
          isNull(projects.deletedAt)
        )
      )
      .limit(1);
    if (!rows[0]) throw new ApiError(403, 'PROJECT_FORBIDDEN', '无权访问该项目');
  }
  if (input.canvasId) {
    const rows = await db
      .select({ id: canvases.id })
      .from(canvases)
      .innerJoin(projects, eq(canvases.projectId, projects.id))
      .where(
        and(
          eq(canvases.id, input.canvasId),
          eq(projects.ownerId, userId),
          eq(projects.status, 'active'),
          isNull(projects.deletedAt)
        )
      )
      .limit(1);
    if (!rows[0]) throw new ApiError(403, 'CANVAS_FORBIDDEN', '无权访问该画布');
  }

  if (input.idempotencyKey) {
    const existing = await db
      .select()
      .from(generationJobs)
      .where(
        and(
          eq(generationJobs.userId, userId),
          eq(generationJobs.idempotencyKey, input.idempotencyKey)
        )
      )
      .limit(1);
    if (existing[0]) return getJob(userId, existing[0].id);
  }

  const providerRows = await db
    .select()
    .from(modelProviders)
    .where(eq(modelProviders.name, model.provider))
    .limit(1);
  const provider = providerRows[0];
  if (!provider || !provider.enabled) {
    throw new ApiError(503, 'PROVIDER_UNAVAILABLE', '该模型的生成通道尚未配置或未启用');
  }

  const params = { ...(input.params || {}) };
  if (input.kind === 'image_to_video') {
    const imageAssetId = String(params.imageAssetId || '');
    if (!imageAssetId) throw new ApiError(400, 'IMAGE_REQUIRED', '图生视频需要提供 imageAssetId');
    await getAssetForUser(userId, imageAssetId);
  }

  const [job] = await db
    .insert(generationJobs)
    .values({
      userId,
      projectId: input.projectId || null,
      canvasId: input.canvasId || null,
      nodeId: input.nodeId || null,
      providerId: provider.id,
      model: input.model,
      kind: input.kind,
      prompt: input.prompt.trim().slice(0, 5000),
      params,
      idempotencyKey: input.idempotencyKey || null,
      status: 'queued',
      progress: 0,
      maxAttempts: 3,
    })
    .returning();

  await audit({
    actorId: userId,
    action: 'job.create',
    targetType: 'generation_job',
    targetId: job.id,
    metadata: { model: job.model, kind: job.kind, provider: provider.name },
  });
  return getJob(userId, job.id);
}

export async function getJob(userId: string, jobId: string) {
  const rows = await getDb()
    .select()
    .from(generationJobs)
    .where(and(eq(generationJobs.id, jobId), eq(generationJobs.userId, userId)))
    .limit(1);
  const job = rows[0];
  if (!job) throw new ApiError(404, 'JOB_NOT_FOUND', '任务不存在');
  let result = null;
  if (job.resultAssetId) {
    const assetRows = await getDb()
      .select()
      .from(assets)
      .where(and(eq(assets.id, job.resultAssetId), isNull(assets.deletedAt)))
      .limit(1);
    if (assetRows[0] && assetRows[0].status === 'ready') {
      const asset = assetRows[0];
      result = {
        assetId: asset.id,
        kind: asset.kind,
        mimeType: asset.mimeType,
        url: await assetUrl(asset),
      };
    }
  }
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    model: job.model,
    kind: job.kind,
    prompt: job.prompt,
    params: job.params,
    nodeId: job.nodeId,
    projectId: job.projectId,
    canvasId: job.canvasId,
    error: job.error,
    cancelRequested: Boolean(job.cancelRequestedAt),
    result,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
  };
}

export async function listJobs(userId: string, projectId?: string | null, limit = 30) {
  const filters = [eq(generationJobs.userId, userId)];
  if (projectId) filters.push(eq(generationJobs.projectId, projectId));
  const rows = await getDb()
    .select({
      id: generationJobs.id,
      status: generationJobs.status,
      progress: generationJobs.progress,
      model: generationJobs.model,
      kind: generationJobs.kind,
      prompt: generationJobs.prompt,
      error: generationJobs.error,
      resultAssetId: generationJobs.resultAssetId,
      createdAt: generationJobs.createdAt,
      finishedAt: generationJobs.finishedAt,
    })
    .from(generationJobs)
    .where(and(...filters))
    .orderBy(desc(generationJobs.createdAt))
    .limit(Math.min(100, Math.max(1, limit)));
  return rows;
}

export async function cancelJob(userId: string, jobId: string) {
  const db = getDb();
  const [job] = await db
    .select()
    .from(generationJobs)
    .where(and(eq(generationJobs.id, jobId), eq(generationJobs.userId, userId)))
    .limit(1);
  if (!job) throw new ApiError(404, 'JOB_NOT_FOUND', '任务不存在');
  if (['succeeded', 'failed', 'cancelled'].includes(job.status)) {
    throw new ApiError(409, 'JOB_FINALIZED', '任务已结束，无法取消');
  }
  if (job.status === 'queued') {
    await db
      .update(generationJobs)
      .set({ status: 'cancelled', cancelRequestedAt: new Date(), finishedAt: new Date(), updatedAt: new Date() })
      .where(eq(generationJobs.id, jobId));
  } else {
    await db
      .update(generationJobs)
      .set({ cancelRequestedAt: new Date(), updatedAt: new Date() })
      .where(eq(generationJobs.id, jobId));
  }
  await audit({ actorId: userId, action: 'job.cancel', targetType: 'generation_job', targetId: jobId });
  return getJob(userId, jobId);
}

export async function retryJob(userId: string, jobId: string) {
  const db = getDb();
  const [job] = await db
    .select()
    .from(generationJobs)
    .where(and(eq(generationJobs.id, jobId), eq(generationJobs.userId, userId)))
    .limit(1);
  if (!job) throw new ApiError(404, 'JOB_NOT_FOUND', '任务不存在');
  if (!['failed', 'cancelled'].includes(job.status)) {
    throw new ApiError(409, 'JOB_NOT_RETRYABLE', '只有失败或已取消的任务可以重试');
  }
  await db
    .update(generationJobs)
    .set({
      status: 'queued',
      progress: 0,
      error: null,
      attempts: 0,
      cancelRequestedAt: null,
      lockedAt: null,
      lockedBy: null,
      startedAt: null,
      finishedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(generationJobs.id, jobId));
  await audit({ actorId: userId, action: 'job.retry', targetType: 'generation_job', targetId: jobId });
  return getJob(userId, jobId);
}

/* ---------------- worker operations ---------------- */

export async function claimJob(workerId: string) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const picked = await client.query(
      `SELECT * FROM generation_jobs
       WHERE status = 'queued' AND cancel_requested_at IS NULL
       ORDER BY created_at ASC
       FOR UPDATE SKIP LOCKED
       LIMIT 1`
    );
    const job = picked.rows[0];
    if (!job) {
      await client.query('COMMIT');
      return null;
    }
    const updated = await client.query(
      `UPDATE generation_jobs
       SET status='running', progress=5, attempts=attempts+1,
           locked_at=now(), locked_by=$1, started_at=COALESCE(started_at, now()), updated_at=now()
       WHERE id=$2
       RETURNING *`,
      [workerId, job.id]
    );
    await client.query('COMMIT');
    return updated.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function updateJobProgress(jobId: string, progress: number) {
  await getDb()
    .update(generationJobs)
    .set({ progress: Math.max(0, Math.min(99, Math.round(progress))), updatedAt: new Date() })
    .where(eq(generationJobs.id, jobId));
}

export async function completeJob(input: {
  jobId: string;
  resultAssetId: string;
  credits: number;
  userId: string;
  projectId?: string | null;
}) {
  const db = getDb();
  await db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(generationJobs)
      .where(eq(generationJobs.id, input.jobId))
      .limit(1);
    if (!job) return;
    await tx
      .update(generationJobs)
      .set({
        status: 'succeeded',
        progress: 100,
        error: null,
        resultAssetId: input.resultAssetId,
        finishedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
        updatedAt: new Date(),
      })
      .where(eq(generationJobs.id, input.jobId));
    await tx.insert(usageRecords).values({
      userId: job.userId,
      projectId: job.projectId,
      jobId: job.id,
      kind: 'generation',
      credits: input.credits,
      detail: { model: job.model, kind: job.kind },
    });
    if (job.canvasId && job.nodeId) {
      await tx
        .update(nodes)
        .set({
          status: 'succeeded',
          assetId: input.resultAssetId,
          data: sql`${nodes.data} || ${JSON.stringify({ status: 'succeeded', progress: 100, assetId: input.resultAssetId })}::jsonb`,
          updatedAt: new Date(),
        })
        .where(and(eq(nodes.canvasId, job.canvasId), eq(nodes.id, job.nodeId)));
    }
  });
}

export async function failJob(jobId: string, error: string, retryable = false) {
  const db = getDb();
  const [job] = await db.select().from(generationJobs).where(eq(generationJobs.id, jobId)).limit(1);
  if (!job) return;
  if (job.status === 'cancelled') return;
  const shouldRetry = retryable && job.attempts < job.maxAttempts;
  await db
    .update(generationJobs)
    .set({
      status: shouldRetry ? 'queued' : 'failed',
      error: error.slice(0, 2000),
      progress: 0,
      lockedAt: null,
      lockedBy: null,
      finishedAt: shouldRetry ? null : new Date(),
      updatedAt: new Date(),
    })
    .where(eq(generationJobs.id, jobId));
  if (!shouldRetry && job.canvasId && job.nodeId) {
    await db
      .update(nodes)
      .set({
        status: 'error',
        data: sql`${nodes.data} || ${JSON.stringify({ status: 'error', error: error.slice(0, 500) })}::jsonb`,
        updatedAt: new Date(),
      })
      .where(and(eq(nodes.canvasId, job.canvasId), eq(nodes.id, job.nodeId)));
  }
}

export async function recoverStaleJobs() {
  await getDb().execute(
    sql`UPDATE generation_jobs
        SET status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'queued' END,
            locked_at = NULL, locked_by = NULL,
            error = CASE WHEN attempts >= max_attempts THEN '任务执行超时，已停止重试' ELSE error END,
            finished_at = CASE WHEN attempts >= max_attempts THEN now() ELSE finished_at END,
            updated_at = now()
        WHERE status = 'running' AND locked_at < now() - interval '5 minutes'`
  );
}

export async function markJobCancelled(jobId: string) {
  await getDb()
    .update(generationJobs)
    .set({
      status: 'cancelled',
      progress: 0,
      finishedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
      updatedAt: new Date(),
    })
    .where(eq(generationJobs.id, jobId));
}
