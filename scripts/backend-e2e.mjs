import { config } from 'dotenv';
import { Client } from 'pg';

config({ path: '.env.local' });
config();

const BASE = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';
const cookies = new Map();
let csrfToken = '';

function cookieHeader() {
  return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

function storeCookies(response) {
  const list = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);
  for (const raw of list) {
    const [pair] = raw.split(';');
    const index = pair.indexOf('=');
    if (index === -1) continue;
    const name = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (!value) cookies.delete(name);
    else cookies.set(name, value);
    if (name === 'blm_csrf') csrfToken = decodeURIComponent(value);
  }
}

async function api(path, options = {}) {
  const method = options.method || 'GET';
  const headers = { ...(options.headers || {}) };
  if (options.auth !== false && cookies.size) headers.Cookie = cookieHeader();
  if (options.csrf && csrfToken && method !== 'GET') headers['X-CSRF-Token'] = csrfToken;
  let body = options.body;
  if (body !== undefined && !(body instanceof Uint8Array)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    body = JSON.stringify(body);
  }
  const response = await fetch(`${BASE}${path}`, { method, headers, body });
  storeCookies(response);
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }
  if (options.expectStatus) {
    if (response.status !== options.expectStatus) {
      throw new Error(`${method} ${path} expected ${options.expectStatus}, got ${response.status}: ${text.slice(0, 300)}`);
    }
    return { response, payload };
  }
  if (!response.ok) {
    throw new Error(`${method} ${path} failed ${response.status}: ${text.slice(0, 300)}`);
  }
  return payload?.data ?? payload;
}

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERT FAILED: ${message}`);
}

async function waitForJob(jobId, timeoutMs = 30_000) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeoutMs) {
    const data = await api(`/api/jobs/${jobId}`);
    last = data.job;
    if (['succeeded', 'failed', 'cancelled'].includes(last.status)) return last;
    await new Promise((r) => setTimeout(r, 800));
  }
  throw new Error(`job ${jobId} timed out: ${JSON.stringify(last)}`);
}

function phone() {
  return `139${String(Date.now() + Math.floor(Math.random() * 1000)).slice(-8)}`;
}

async function main() {
  const p1 = phone();
  const p2 = `138${String(Date.now() + 333).slice(-8)}`;
  console.log('[1] request code', p1.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'));
  const codeRes = await api('/api/auth/request-code', {
    method: 'POST',
    csrf: false,
    body: { phone: p1, purpose: 'register' },
  });
  assert(codeRes.devCode, 'devCode should be present in development');
  const code = codeRes.devCode;
  console.log('[2] register');
  const registered = await api('/api/auth/register', {
    method: 'POST',
    csrf: false,
    body: { phone: p1, code, name: 'E2E 创作者', password: 'Baolimei2026' },
  });
  assert(registered.user?.id, 'register returns user');
  assert(registered.csrfToken, 'register returns csrf token');

  console.log('[3] me + refresh');
  const me = await api('/api/auth/me');
  assert(me.user.phone === p1, 'me returns current user');
  const refreshed = await api('/api/auth/refresh', { method: 'POST', csrf: true });
  assert(refreshed.csrfToken, 'refresh rotates csrf token');
  csrfToken = refreshed.csrfToken;

  console.log('[4] create project');
  const createdProject = await api('/api/projects', {
    method: 'POST',
    csrf: true,
    body: { name: 'E2E 云端项目' },
  });
  const project = createdProject.project;
  assert(project.canvas?.id, 'project includes canvas');

  console.log('[5] save canvas');
  const graph = {
    nodes: [
      { id: 'node_e2e_prompt', type: 'prompt', x: 80, y: 100, w: 260, ratio: 16 / 9, title: 'E2E PROMPT', text: '雨夜霓虹，镜头缓慢推近', status: 'idle' },
      { id: 'node_e2e_video', type: 'video', x: 430, y: 100, w: 260, ratio: 16 / 9, title: 'E2E SHOT', text: '生成结果', status: 'idle' },
    ],
    edges: [{ id: 'edge_e2e', from: 'node_e2e_prompt', to: 'node_e2e_video' }],
    groups: [],
    view: { x: 20, y: 30, k: 1 },
    name: 'E2E 云端项目',
  };
  const saved = await api(`/api/canvases/${project.canvas.id}`, {
    method: 'PUT',
    csrf: true,
    body: { baseVersion: 1, graph, snapshot: true, label: 'E2E saved' },
  });
  assert(saved.canvas.version === 2, 'canvas version increments');
  assert(saved.canvas.snapshotVersion === 2, 'snapshot created');

  console.log('[6] optimistic concurrency + csrf + origin');
  const conflict = await api(`/api/canvases/${project.canvas.id}`, {
    method: 'PUT',
    csrf: true,
    body: { baseVersion: 1, graph },
    expectStatus: 409,
  });
  assert(conflict.payload.error.code === 'CANVAS_VERSION_CONFLICT', 'version conflict detected');
  await api(`/api/canvases/${project.canvas.id}`, {
    method: 'PUT',
    body: { baseVersion: 2, graph },
    expectStatus: 403,
  });
  await api(`/api/canvases/${project.canvas.id}`, {
    method: 'PUT',
    csrf: true,
    headers: { Origin: 'https://evil.example.com' },
    body: { baseVersion: 2, graph },
    expectStatus: 403,
  });

  console.log('[7] versions + restore');
  const versions = await api(`/api/canvases/${project.canvas.id}/versions`);
  assert(versions.versions.some((v) => v.version === 2), 'version 2 listed');
  const restored = await api(`/api/canvases/${project.canvas.id}/restore?version=2`, {
    method: 'POST',
    csrf: true,
    body: { baseVersion: 2 },
  });
  assert(restored.canvas.version === 3, 'restore creates new version');
  const current = await api(`/api/canvases/${project.canvas.id}`);
  assert(current.graph.nodes.length === 2, 'canvas graph restored');
  assert(current.graph.edges.length === 1, 'canvas edges restored');

  console.log('[8] asset upload + reference');
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
    'base64'
  );
  const presign = await api('/api/assets/presign', {
    method: 'POST',
    csrf: true,
    body: { filename: 'e2e.png', mimeType: 'image/png', size: png.length, projectId: project.id },
  });
  const uploadUrl = presign.upload.url.startsWith('/') ? `${BASE}${presign.upload.url}` : presign.upload.url;
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: presign.upload.headers,
    body: png,
  });
  assert(uploadResponse.ok, `asset PUT upload ${uploadResponse.status}`);
  const completed = await api('/api/assets/complete', {
    method: 'POST',
    csrf: true,
    body: { assetId: presign.assetId },
  });
  assert(completed.asset.status === 'ready', 'asset ready');
  assert(completed.asset.url, 'asset has signed URL');
  const assetFetch = await fetch(completed.asset.url.startsWith('/') ? `${BASE}${completed.asset.url}` : completed.asset.url);
  assert(assetFetch.ok, 'signed asset URL readable');
  assert((await assetFetch.arrayBuffer()).byteLength === png.length, 'asset bytes match');
  const assetId = completed.asset.id;
  const graphWithAsset = {
    ...graph,
    nodes: [
      graph.nodes[0],
      { ...graph.nodes[1], assetId, src: '', mediaType: 'image', status: 'succeeded' },
    ],
  };
  const assetSaved = await api(`/api/canvases/${project.canvas.id}`, {
    method: 'PUT',
    csrf: true,
    body: { baseVersion: 3, graph: graphWithAsset, snapshot: true, label: 'with asset' },
  });
  assert(assetSaved.canvas.version === 4, 'asset canvas saved');
  const assetList = await api('/api/assets');
  assert(assetList.assets.some((a) => a.id === assetId), 'asset listed');
  await api(`/api/assets/${assetId}`, { method: 'DELETE', csrf: true, expectStatus: 409 });

  console.log('[9] generation job (dev mock)');
  const jobCreated = await api('/api/jobs', {
    method: 'POST',
    csrf: true,
    body: {
      projectId: project.id,
      canvasId: project.canvas.id,
      model: 'blm-cinema-1',
      kind: 'text_to_video',
      prompt: 'E2E 雨夜镜头',
      params: { ratio: '16:9', duration: 5, resolution: '1080p' },
      idempotencyKey: `e2e-${Date.now()}`,
    },
  });
  const job = await waitForJob(jobCreated.job.id);
  assert(job.status === 'succeeded', `job succeeded, got ${job.status} ${job.error || ''}`);
  assert(job.result?.assetId && job.result?.url, 'job result has asset');
  const jobAsset = await fetch(job.result.url.startsWith('/') ? `${BASE}${job.result.url}` : job.result.url);
  assert(jobAsset.ok, 'job result asset URL readable');

  console.log('[10] cancel job');
  const cancelCandidate = await api('/api/jobs', {
    method: 'POST',
    csrf: true,
    body: {
      model: 'blm-cinema-1',
      kind: 'text_to_video',
      prompt: 'E2E cancel',
      params: { ratio: '16:9' },
    },
  });
  await api(`/api/jobs/${cancelCandidate.job.id}/cancel`, { method: 'POST', csrf: true });
  const cancelled = await waitForJob(cancelCandidate.job.id, 10_000);
  assert(['cancelled', 'succeeded'].includes(cancelled.status), 'cancel request handled');

  console.log('[11] second user isolation');
  const code2Res = await api('/api/auth/request-code', {
    method: 'POST',
    csrf: false,
    body: { phone: p2, purpose: 'register' },
  });
  const reg2 = await api('/api/auth/register', {
    method: 'POST',
    csrf: false,
    body: { phone: p2, code: code2Res.devCode, name: 'Other User', password: 'Baolimei2026' },
  });
  assert(reg2.user?.id, 'second user registered');
  await api(`/api/projects/${project.id}`, { expectStatus: 404 });
  await api(`/api/canvases/${project.canvas.id}`, { expectStatus: 404 });
  await api(`/api/projects/${project.id}`, { method: 'PATCH', csrf: true, body: { name: 'hijack' }, expectStatus: 404 });

  console.log('[12] logout + password login + session management');
  await api('/api/auth/logout', { method: 'POST', csrf: true });
  csrfToken = '';
  const login = await api('/api/auth/login/password', {
    method: 'POST',
    csrf: false,
    body: { phone: p1, password: 'Baolimei2026' },
  });
  assert(login.user.id === registered.user.id, 'password login restores same user');
  csrfToken = login.csrfToken;
  const sessions = await api('/api/auth/sessions');
  assert(sessions.sessions.length >= 1, 'sessions listed');
  const meAfter = await api('/api/auth/me');
  assert(meAfter.user.phone === p1, 'session restored');
  const canvasAfter = await api(`/api/canvases/${project.canvas.id}`);
  assert(canvasAfter.graph.nodes.length === 2, 'canvas restored after re-login');

  console.log('[13] account deletion flow');
  await api('/api/auth/account', {
    method: 'DELETE',
    csrf: true,
    body: { password: 'Baolimei2026', confirm: 'DELETE' },
  });
  csrfToken = '';
  await api('/api/auth/login/password', {
    method: 'POST',
    csrf: false,
    body: { phone: p1, password: 'Baolimei2026' },
    expectStatus: 401,
  });

  console.log('[14] database invariants');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const tables = ['users', 'user_sessions', 'verification_challenges', 'projects', 'canvases', 'canvas_versions', 'nodes', 'edges', 'assets', 'asset_references', 'generation_jobs', 'usage_records', 'audit_logs'];
  for (const table of tables) {
    const result = await client.query(`SELECT count(*)::int AS n FROM ${table}`);
    console.log(`  ${table}: ${result.rows[0].n}`);
  }
  const hash = await client.query(`SELECT password_hash FROM users WHERE phone LIKE 'del_%' LIMIT 1`);
  assert(hash.rows[0]?.password_hash === null, 'deleted user password hash cleared');
  const token = await client.query(`SELECT length(token_hash) AS n FROM user_sessions LIMIT 1`);
  assert(token.rows[0]?.n === 64, 'session token stored hashed');
  await client.end();

  console.log('\nBACKEND_E2E_OK');
}

main().catch((err) => {
  console.error('\nBACKEND_E2E_FAILED:', err.message);
  process.exit(1);
});
