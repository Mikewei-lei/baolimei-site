import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { assets, generationJobs, modelProviders } from '../schema';
import {
  claimJob,
  completeJob,
  failJob,
  markJobCancelled,
  recoverStaleJobs,
  updateJobProgress,
} from '../jobs';
import { serverEnv } from '../env';
import { buildPoster } from '@/lib/mock';
import { models } from '@/lib/models';
import { submitLive, pollLive } from '@/lib/providers';
import { buildStorageKey, putObjectBuffer, storageDriver } from '../storage';
import { assetUrl, getAssetForUser } from '../assets';

const globalForWorker = globalThis as unknown as {
  __blmWorkerStarted?: boolean;
  __blmWorkerBusy?: Set<string>;
};
const workerId = `worker_${process.pid}_${crypto.randomBytes(4).toString('hex')}`;
const busy = (globalForWorker.__blmWorkerBusy ||= new Set<string>());
const MAX_CONCURRENCY = 2;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function jobCancelled(jobId: string) {
  const rows = await getDb()
    .select({ cancelRequestedAt: generationJobs.cancelRequestedAt })
    .from(generationJobs)
    .where(eq(generationJobs.id, jobId))
    .limit(1);
  return Boolean(rows[0]?.cancelRequestedAt);
}

async function createResultAsset(input: {
  userId: string;
  projectId?: string | null;
  buffer: Buffer;
  mimeType: string;
  kind: 'image' | 'video';
  name: string;
}) {
  const id = crypto.randomUUID();
  const key = buildStorageKey(input.userId, id, input.name);
  await putObjectBuffer(key, input.buffer, input.mimeType);
  const [asset] = await getDb()
    .insert(assets)
    .values({
      id,
      ownerId: input.userId,
      projectId: input.projectId || null,
      kind: input.kind,
      mimeType: input.mimeType,
      size: input.buffer.length,
      storageDriver: storageDriver(),
      storageKey: key,
      originalName: input.name,
      status: 'ready',
    })
    .returning();
  return asset;
}

function extractRemoteUrl(output: any): string | null {
  return (
    output?.video?.url ||
    output?.video_url ||
    output?.images?.[0]?.url ||
    output?.image?.url ||
    (Array.isArray(output) ? output[0]?.url : null) ||
    output?.url ||
    null
  );
}

async function processMock(job: any, model: any) {
  if (!serverEnv.mockGenerationEnabled) {
    throw Object.assign(new Error('生产环境已关闭 Mock 生成通道'), { retryable: false });
  }
  await updateJobProgress(job.id, 18);
  await sleep(700);
  if (await jobCancelled(job.id)) return markJobCancelled(job.id);
  await updateJobProgress(job.id, 48);
  await sleep(700);
  await updateJobProgress(job.id, 78);
  if (await jobCancelled(job.id)) return markJobCancelled(job.id);

  const params = job.params || {};
  const svg = buildPoster({
    prompt: job.prompt,
    style: String(params.style || 'cinematic'),
    seed: Number(params.seed) || Math.floor(Math.random() * 9999999),
    ratio: String(params.ratio || '16:9'),
    model: job.model,
  });
  const asset = await createResultAsset({
    userId: job.user_id,
    projectId: job.project_id,
    buffer: Buffer.from(svg, 'utf8'),
    mimeType: 'image/svg+xml',
    kind: 'image',
    name: 'mock-result.svg',
  });
  await completeJob({
    jobId: job.id,
    resultAssetId: asset.id,
    credits: Number(model.credits || 0),
    userId: job.user_id,
    projectId: job.project_id,
  });
}

async function processLive(job: any, model: any) {
  const params = job.params || {};
  let providerJob: any = params._providerJob;
  if (!providerJob) {
    let imageUrl: string | undefined;
    if (job.kind === 'image_to_video' && params.imageAssetId) {
      const asset = await getAssetForUser(job.user_id, String(params.imageAssetId));
      imageUrl = await assetUrl(asset);
    }
    providerJob = await submitLive(model, {
      prompt: job.prompt,
      ratio: params.ratio || '16:9',
      duration: params.duration || 5,
      resolution: params.resolution,
      image_url: imageUrl,
    });
    await getDb()
      .update(generationJobs)
      .set({ params: { ...params, _providerJob: providerJob }, updatedAt: new Date() })
      .where(eq(generationJobs.id, job.id));
  }

  let lastStatus = 'running';
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (await jobCancelled(job.id)) return markJobCancelled(job.id);
    await sleep(3000);
    if (await jobCancelled(job.id)) return markJobCancelled(job.id);
    const state = await pollLive(providerJob);
    lastStatus = state.status;
    if (state.status === 'succeeded') {
      const remoteUrl = extractRemoteUrl(state.output);
      if (!remoteUrl) throw new Error('模型未返回可下载的结果');
      const response = await fetch(remoteUrl);
      if (!response.ok) throw new Error(`下载模型结果失败（${response.status}）`);
      const mime = (response.headers.get('content-type') || '').split(';')[0].trim() || 'image/png';
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length > 220 * 1024 * 1024) throw new Error('模型结果超过 220MB 限制');
      const kind = mime.startsWith('video') ? 'video' : 'image';
      const ext = kind === 'video' ? '.mp4' : '.png';
      const asset = await createResultAsset({
        userId: job.user_id,
        projectId: job.project_id,
        buffer,
        mimeType: mime,
        kind,
        name: `generated${ext}`,
      });
      await completeJob({
        jobId: job.id,
        resultAssetId: asset.id,
        credits: Number(model.credits || 0),
        userId: job.user_id,
        projectId: job.project_id,
      });
      return;
    }
    if (state.status === 'failed') throw new Error('模型返回失败');
    await updateJobProgress(job.id, Math.min(90, 10 + attempt * 2));
  }
  throw new Error(`生成任务超时（最后状态：${lastStatus}）`);
}

async function processJob(job: any) {
  busy.add(job.id);
  try {
    const providerRows = await getDb()
      .select()
      .from(modelProviders)
      .where(eq(modelProviders.id, job.provider_id))
      .limit(1);
    const provider = providerRows[0];
    if (!provider || !provider.enabled) {
      await failJob(job.id, '生成通道未启用', false);
      return;
    }
    const model = models.find((m) => m.id === job.model);
    if (!model) {
      await failJob(job.id, '模型不存在或已下线', false);
      return;
    }
    if (provider.kind === 'mock') {
      await processMock(job, model);
    } else {
      await processLive(job, model);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '任务执行失败';
    const retryable = (err as { retryable?: boolean })?.retryable !== false;
    console.error(`[worker] job ${job.id} failed:`, message);
    await failJob(job.id, message, retryable);
  } finally {
    busy.delete(job.id);
  }
}

async function tick() {
  if (busy.size >= MAX_CONCURRENCY) return;
  for (let i = busy.size; i < MAX_CONCURRENCY; i += 1) {
    const job = await claimJob(workerId);
    if (!job) return;
    void processJob(job);
  }
}

export function startWorker() {
  if (globalForWorker.__blmWorkerStarted) return;
  if (!serverEnv.workerEnabled) return;
  globalForWorker.__blmWorkerStarted = true;
  console.info(`[worker] started ${workerId}`);
  let ticks = 0;
  const timer = setInterval(() => {
    ticks += 1;
    void tick().catch((err) =>
      console.error('[worker] tick failed:', err instanceof Error ? err.message : err)
    );
    if (ticks % 30 === 0) {
      void recoverStaleJobs().catch(() => undefined);
    }
  }, 2000);
  timer.unref?.();
}
