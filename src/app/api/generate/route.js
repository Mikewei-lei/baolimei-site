import { NextResponse } from 'next/server';
import { modelById, models } from '@/lib/models';
import { buildPoster, encodeJob, decodeJob } from '@/lib/mock';
import { liveMode, providerFor, submitLive, pollLive } from '@/lib/providers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 进程内任务表（仅真实通道使用；演示模式为无状态）
const liveJobs = new Map();
const hits = new Map();

function rateLimit(ip, limit = 30, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const rec = hits.get(ip) || { count: 0, ts: now };
  if (now - rec.ts > windowMs) {
    rec.count = 0;
    rec.ts = now;
  }
  rec.count += 1;
  hits.set(ip, rec);
  return rec.count <= limit;
}

const clamp = (n, min, max, fallback) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
};

const ratiosWhitelist = ['16:9', '9:16', '1:1', '4:3', '3:4', '2.39:1', '21:9'];

function sanitizePrompt(input) {
  if (typeof input !== 'string') return '';
  return input.replace(/\s+/g, ' ').trim().slice(0, 900);
}

export async function POST(request) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'local';

  if (!rateLimit(ip)) {
    return NextResponse.json({ error: '请求过于频繁，请稍后再试' }, { status: 429 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求体不是合法的 JSON' }, { status: 400 });
  }

  if (typeof body?.prompt === 'string' && body.prompt.length > 1200) {
    return NextResponse.json({ error: '提示词过长，最多 900 字' }, { status: 400 });
  }

  const prompt = sanitizePrompt(body?.prompt);
  const requested = models.find((m) => m.id === body?.model);
  if (body?.model && !requested) {
    return NextResponse.json(
      { error: '模型不存在或已下线，请刷新页面后重试', code: 'UNKNOWN_MODEL' },
      { status: 400 }
    );
  }
  const model = requested || models[0];

  if (!prompt && !body?.image) {
    return NextResponse.json({ error: '请先描述你的镜头' }, { status: 400 });
  }

  const ratio = ratiosWhitelist.includes(body?.ratio) ? body.ratio : '16:9';
  const duration = clamp(body?.duration, 1, model.maxDuration || 12, 5);
  const resolution = (model.resolutions || ['720p']).includes(body?.resolution)
    ? body.resolution
    : (model.resolutions || ['720p'])[0];
  const seed = clamp(body?.seed, 1, 99999999, Math.floor(Math.random() * 9999999) + 1);
  const style = typeof body?.style === 'string' ? body.style : 'cinematic';
  const count = clamp(body?.count, 1, 4, model.kind === 'image' ? 4 : 2);
  const totalMs = model.kind === 'image' ? 2800 : 6200;

  const channel = providerFor(model);
  const useLive = liveMode() && channel;

  if (useLive) {
    try {
      const job = await submitLive(model, {
        prompt,
        ratio,
        duration,
        resolution,
        seed,
        image_url: body?.image,
      });
      const id = `live_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      liveJobs.set(id, { ...job, modelId: model.id, createdAt: Date.now(), prompt });
      return NextResponse.json({ id, status: 'queued', mock: false, etaMs: 60000 });
    } catch (err) {
      return NextResponse.json(
        { error: err?.message || '生成通道不可用', code: err?.code || 'PROVIDER_ERROR' },
        { status: 503 }
      );
    }
  }

  const id = encodeJob({
    t: Date.now(),
    p: prompt,
    m: model.id,
    r: ratio,
    d: duration,
    res: resolution,
    s: seed,
    st: style,
    c: count,
    total: totalMs,
  });

  return NextResponse.json({
    id,
    status: 'queued',
    mock: true,
    etaMs: totalMs,
    credits: (model.credits || 10) * count,
  });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('job');
  if (!id) return NextResponse.json({ error: '缺少任务 ID' }, { status: 400 });

  if (id.startsWith('live_')) {
    const job = liveJobs.get(id);
    if (!job) return NextResponse.json({ error: '任务不存在或已过期' }, { status: 404 });
    try {
      const state = await pollLive(job);
      if (state.status !== 'succeeded') {
        return NextResponse.json({ id, status: state.status, progress: state.progress ?? 30 });
      }
      liveJobs.delete(id);
      const outputs = state.output?.output || state.output?.data || state.output;
      const url =
        outputs?.video?.url ||
        outputs?.video_url ||
        (Array.isArray(outputs) ? outputs[0]?.url : outputs?.url) ||
        outputs?.images?.[0]?.url ||
        null;
      if (!url) return NextResponse.json({ error: '模型未返回结果' }, { status: 502 });
      return NextResponse.json({
        id,
        status: 'succeeded',
        mock: false,
        result: { url, type: url.includes('.mp4') ? 'video' : 'image', prompt: job.prompt },
      });
    } catch (err) {
      liveJobs.delete(id);
      return NextResponse.json({ error: err?.message || '生成失败' }, { status: 502 });
    }
  }

  const job = decodeJob(id);
  if (!job) return NextResponse.json({ error: '任务不存在或已过期' }, { status: 404 });

  const elapsed = Date.now() - job.t;
  if (elapsed < job.total) {
    const progress = Math.min(96, Math.round((elapsed / job.total) * 100));
    return NextResponse.json({ id, status: 'running', progress, mock: true });
  }

  const model = modelById(job.m);
  const results = Array.from({ length: job.c }, (_, i) => {
    const seed = job.s + i * 17;
    const svg = buildPoster({
      prompt: job.p,
      style: job.st,
      seed,
      ratio: job.r,
      model: job.m,
    });
    return {
      id: `${seed}`,
      seed,
      type: 'image',
      preview: true,
      note: '演示占位画面 · 正式模型输出为视频',
      // 直接内联，避免对象存储依赖；体积约 3–5KB/张
      url: `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`,
      width: Number(svg.match(/width="(\d+)"/)?.[1] || 1280),
      height: Number(svg.match(/height="(\d+)"/)?.[1] || 720),
    };
  });

  return NextResponse.json({
    id,
    status: 'succeeded',
    mock: true,
    credits: (model?.credits || 10) * job.c,
    result: {
      prompt: job.p,
      model: job.m,
      modelName: model?.name || job.m,
      kind: model?.kind || 'video',
      ratio: job.r,
      duration: job.d,
      resolution: job.res,
      items: results,
    },
  });
}
