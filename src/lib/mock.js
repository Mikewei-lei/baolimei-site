// 演示模式的占位画面与任务编码：不依赖数据库，可部署在 Serverless 上
import { modelById, ratios } from './models';

const PALETTES = {
  cinematic: ['#d8ff3b', '#4dd4ff', '#ffd166'],
  anime: ['#ff8ad8', '#8ab4ff', '#ffe36b'],
  noir: ['#e8e8e8', '#8b95a3', '#c9a227'],
  documentary: ['#e3c08d', '#8fb3a1', '#c9d6df'],
  cyberpunk: ['#00ffe1', '#ff3ea5', '#8a5cff'],
  ink: ['#f2f4f1', '#9aa1a9', '#d8ff3b'],
};

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export function dimensions(ratio = '16:9') {
  const [rw, rh] = ratios[ratio] || ratios['16:9'];
  const maxW = 1280;
  const w = maxW;
  const h = Math.round((maxW * rh) / rw);
  return { w, h };
}

// 生成确定性占位画面（同一 seed 永远得到同一张图）
export function buildPoster({ prompt = '', style = 'cinematic', seed = 1, ratio = '16:9', model = 'blm-cinema-1' }) {
  const { w, h } = dimensions(ratio);
  const m = modelById(model);
  const palette = PALETTES[style] || PALETTES.cinematic;
  const rand = mulberry32(hashString(`${prompt}|${style}|${seed}|${ratio}`));

  const blobs = Array.from({ length: 4 }, (_, i) => {
    const cx = Math.round(rand() * w);
    const cy = Math.round(rand() * h);
    const r = Math.round((0.22 + rand() * 0.4) * Math.max(w, h));
    const color = palette[i % palette.length];
    const op = (0.25 + rand() * 0.4).toFixed(2);
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="${op}"/>`;
  }).join('');

  const streaks = Array.from({ length: 10 }, () => {
    const x = Math.round(rand() * w);
    const dx = Math.round((rand() - 0.5) * 400);
    return `<line x1="${x}" y1="0" x2="${x + dx}" y2="${h}" stroke="${palette[0]}" stroke-opacity="0.08" stroke-width="1"/>`;
  }).join('');

  const rings = Array.from({ length: 4 }, (_, i) => {
    const cx = Math.round(w * (0.3 + rand() * 0.4));
    const cy = Math.round(h * (0.3 + rand() * 0.4));
    return `<circle cx="${cx}" cy="${cy}" r="${Math.round(90 + i * 78)}" fill="none" stroke="${palette[(i + 1) % palette.length]}" stroke-opacity="${(0.18 - i * 0.035).toFixed(3)}" stroke-width="1"/>`;
  }).join('');

  const title = (prompt || '未命名镜头').slice(0, 34);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs>
  <filter id="blur"><feGaussianBlur stdDeviation="${Math.round(Math.min(w, h) / 9)}"/></filter>
  <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
  <linearGradient id="vig" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#06070a" stop-opacity="0.1"/>
    <stop offset="70%" stop-color="#06070a" stop-opacity="0.55"/>
    <stop offset="100%" stop-color="#06070a" stop-opacity="0.95"/>
  </linearGradient>
</defs>
<rect width="100%" height="100%" fill="#080a0d"/>
<g filter="url(#blur)">${blobs}</g>
<g>${streaks}${rings}</g>
<rect width="100%" height="100%" fill="url(#vig)"/>
<rect width="100%" height="100%" filter="url(#grain)" opacity="0.09"/>
<g font-family="PingFang SC,Microsoft YaHei,Noto Sans SC,sans-serif">
  <text x="48" y="${h - 92}" fill="#f3f5f1" font-size="${Math.round(Math.min(w, h) / 15)}" font-weight="600">${esc(title)}</text>
  <text x="50" y="${h - 56}" fill="${palette[0]}" font-size="15" letter-spacing="3" font-family="Inter,Helvetica,Arial,sans-serif">${esc(
    (m?.name || 'BAOLIMEI').toUpperCase()
  )} · ${esc(ratio)} · SEED ${seed}</text>
  <text x="${w - 48}" y="${h - 56}" fill="#ffffff" fill-opacity="0.4" font-size="13" text-anchor="end" letter-spacing="2" font-family="Inter,Helvetica,Arial,sans-serif">DEMO PREVIEW</text>
</g>
</svg>`;
}

export function encodeJob(payload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeJob(id) {
  try {
    const raw = Buffer.from(String(id), 'base64url').toString('utf8');
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || !data.t) return null;
    return data;
  } catch {
    return null;
  }
}
