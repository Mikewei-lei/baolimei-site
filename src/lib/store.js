export const KEYS = {
  history: 'blm_history_v1',
  canvas: 'blm_canvas_v1',
  inbox: 'blm_canvas_inbox_v1',
  projects: 'blm_canvas_projects_v1',
};

export function readJSON(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJSON(key, value) {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function pushInbox(item) {
  const list = readJSON(KEYS.inbox, []);
  list.unshift({ ...item, addedAt: Date.now() });
  return writeJSON(KEYS.inbox, list.slice(0, 60));
}

export function uid(prefix = 'n') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  return `${d} 天前`;
}

export const CANVAS_PROJECTS_KEY = 'blm_canvas_projects_v1';
