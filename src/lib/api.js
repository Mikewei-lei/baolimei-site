export class ApiError extends Error {
  constructor(message, { status = 0, code = 'NETWORK_ERROR', details = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getCookie(name) {
  if (typeof document === 'undefined') return '';
  const match = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : '';
}

export function getCsrfToken() {
  return getCookie('blm_csrf');
}

export async function apiFetch(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = { ...(options.headers || {}) };
  const csrf = getCsrfToken();
  if (csrf && method !== 'GET' && method !== 'HEAD') headers['X-CSRF-Token'] = csrf;
  let body = options.body;
  if (body !== undefined && body !== null && !(body instanceof FormData) && typeof body !== 'string') {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }
  let response;
  try {
    response = await fetch(path, {
      ...options,
      method,
      headers,
      body,
      credentials: 'include',
      cache: 'no-store',
    });
  } catch {
    throw new ApiError('网络连接失败，请检查网络后重试', { status: 0, code: 'NETWORK_ERROR' });
  }
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { ok: false, error: { code: 'INVALID_RESPONSE', message: text.slice(0, 200) } };
  }
  if (!response.ok || payload?.ok === false) {
    if (response.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('blm:unauthorized'));
    }
    throw new ApiError(payload?.error?.message || `请求失败（${response.status}）`, {
      status: response.status,
      code: payload?.error?.code || 'REQUEST_FAILED',
      details: payload?.error?.details || null,
    });
  }
  return payload?.data ?? payload;
}

export async function uploadAssetFile(file, { projectId } = {}) {
  const presign = await apiFetch('/api/assets/presign', {
    method: 'POST',
    body: {
      filename: file.name || 'asset',
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      projectId: projectId || null,
    },
  });
  const { assetId, upload } = presign;
  const uploadResponse = await fetch(upload.url, {
    method: upload.method || 'PUT',
    headers: upload.headers || { 'Content-Type': file.type },
    body: file,
    credentials: upload.driver === 'local' ? 'same-origin' : 'omit',
  });
  if (!uploadResponse.ok) {
    throw new ApiError(`文件上传失败（${uploadResponse.status}）`, {
      status: uploadResponse.status,
      code: 'UPLOAD_FAILED',
    });
  }
  const completed = await apiFetch('/api/assets/complete', {
    method: 'POST',
    body: { assetId },
  });
  return completed.asset;
}

export async function getAssetUrl(assetId) {
  const data = await apiFetch(`/api/assets/${assetId}/url`);
  return data.url || '';
}

export async function resolveAssetUrls(assetIds) {
  const unique = [...new Set(assetIds.filter(Boolean))];
  const result = {};
  await Promise.all(
    unique.map(async (id) => {
      try {
        result[id] = await getAssetUrl(id);
      } catch {
        result[id] = '';
      }
    })
  );
  return result;
}
