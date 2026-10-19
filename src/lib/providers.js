// 真实模型通道适配器。
// 默认不启用：只有同时设置 GENERATION_MOCK=0 且对应厂商 Key 时才会走这里。
// 注意：真实任务状态保存在进程内存中，需部署在常驻进程（ECS / Docker），
// Serverless（Vercel 函数）冷启动会丢失任务，建议仅用其演示模式。

const FAL_BASE = 'https://queue.fal.run';
const ARK_BASE = process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';

export function providerFor(model) {
  if (model.provider === 'fal' && process.env.FAL_KEY) return 'fal';
  if (model.provider === 'ark' && process.env.ARK_API_KEY) return 'ark';
  if (model.provider === 'replicate' && process.env.REPLICATE_API_TOKEN) return 'replicate';
  return null;
}

export function liveMode() {
  return process.env.GENERATION_MOCK === '0';
}

/* ---------------- fal.ai ---------------- */
async function falFetch(path, init = {}) {
  const res = await fetch(`${FAL_BASE}/${path}`, {
    ...init,
    headers: {
      Authorization: `Key ${process.env.FAL_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(data?.detail || data?.error || `fal 请求失败（${res.status}）`);
  }
  return data;
}

export async function falSubmit(model, input) {
  const data = await falFetch(model.model, { method: 'POST', body: JSON.stringify(input) });
  return { provider: 'fal', requestId: data.request_id, model: model.model, url: data.response_url };
}

export async function falPoll(job) {
  const status = await falFetch(`${job.model}/requests/${job.requestId}/status`);
  if (status.status === 'COMPLETED') {
    const result = await falFetch(`${job.model}/requests/${job.requestId}`);
    return { status: 'succeeded', output: result };
  }
  if (status.status === 'FAILED' || status.status === 'ERROR') {
    throw new Error(status.error || '模型返回失败');
  }
  return { status: status.status === 'IN_QUEUE' ? 'queued' : 'running', progress: status.queue_position ?? 50 };
}

/* ---------------- 火山方舟（Seedance / Seedream） ---------------- */
async function arkFetch(path, init = {}) {
  const res = await fetch(`${ARK_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.ARK_API_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `方舟请求失败（${res.status}）`);
  return data;
}

export async function arkSubmit(model, input) {
  const content = [{ type: 'text', text: input.prompt }];
  if (input.image_url) content.push({ type: 'image_url', image_url: { url: input.image_url } });
  const data = await arkFetch('/contents/generations/tasks', {
    method: 'POST',
    body: JSON.stringify({
      model: model.model,
      content,
      ratio: input.ratio,
      duration: input.duration,
      resolution: input.resolution,
      watermark: false,
    }),
  });
  return { provider: 'ark', requestId: data.id, model: model.model };
}

export async function arkPoll(job) {
  const data = await arkFetch(`/contents/generations/tasks/${job.requestId}`);
  if (data.status === 'succeeded') return { status: 'succeeded', output: data };
  if (data.status === 'failed' || data.status === 'cancelled') {
    throw new Error(data?.error?.message || '任务失败');
  }
  return { status: data.status === 'queued' ? 'queued' : 'running', progress: 50 };
}

/* ---------------- 统一分发 ---------------- */
export async function submitLive(model, input) {
  const provider = providerFor(model);
  if (!provider) throw Object.assign(new Error('该模型的生成通道尚未开通'), { code: 'NO_CHANNEL' });
  if (provider === 'fal') return falSubmit(model, input);
  if (provider === 'ark') return arkSubmit(model, input);
  throw Object.assign(new Error(`暂不支持的通道：${provider}`), { code: 'NO_CHANNEL' });
}

export async function pollLive(job) {
  if (job.provider === 'fal') return falPoll(job);
  if (job.provider === 'ark') return arkPoll(job);
  throw new Error('未知通道');
}
