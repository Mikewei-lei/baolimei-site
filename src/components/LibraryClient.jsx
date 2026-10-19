'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { KEYS, readJSON, writeJSON, timeAgo, pushInbox } from '@/lib/store';
import { Download, Canvas, Trash, Play } from '@/components/Icons';

export default function LibraryClient() {
  const [sessions, setSessions] = useState([]);
  const [filter, setFilter] = useState('all');
  const [active, setActive] = useState(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = readJSON(KEYS.history, []);
    setSessions(Array.isArray(saved) ? saved.filter((s) => s.status === 'succeeded') : []);
    setHydrated(true);
  }, []);

  const items = useMemo(() => {
    const flat = [];
    sessions.forEach((s) => {
      (s.result?.items || []).forEach((item) => flat.push({ ...item, session: s }));
    });
    return flat;
  }, [sessions]);

  const filtered = items.filter((it) => (filter === 'all' ? true : filter === 'image' ? it.type === 'image' : it.type === 'video'));

  const remove = (key) => {
    const next = sessions.filter((s) => s.key !== key);
    setSessions(next);
    writeJSON(KEYS.history, next);
    setActive(null);
  };

  const download = (item) => {
    const a = document.createElement('a');
    a.href = item.url;
    a.download = `baolimei-${item.seed || Date.now()}.svg`;
    a.click();
  };

  const toCanvas = (item) => {
    pushInbox({
      type: 'image',
      src: item.url,
      prompt: item.session.prompt,
      model: item.session.modelName,
      ratio: item.session.ratio,
      seed: item.seed,
    });
    alert('已加入画布');
  };

  if (!hydrated) return null;

  return (
    <>
      {items.length === 0 ? (
        <div className="empty">
          <b>作品库还是空的</b>
          在创作台生成第一支镜头后，作品会自动保存在这里（仅存储在你的浏览器本地）。
          <div style={{ marginTop: 18 }}>
            <Link href="/studio" className="btn btn--primary">
              去创作台生成
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="filters">
            {[
              ['all', `全部 ${items.length}`],
              ['image', `图片 ${items.filter((i) => i.type === 'image').length}`],
              ['video', `视频 ${items.filter((i) => i.type === 'video').length}`],
            ].map(([k, label]) => (
              <button key={k} className={`chip${filter === k ? ' is-on' : ''}`} onClick={() => setFilter(k)}>
                {label}
              </button>
            ))}
            <span className="mono" style={{ fontSize: 10, color: 'var(--muted-2)', marginLeft: 'auto', alignSelf: 'center' }}>
              本地存储 · 清空浏览器数据会丢失
            </span>
          </div>

          <div className="lib-grid">
            {filtered.map((item) => (
              <article className="lib-card" key={`${item.session.key}-${item.seed}`} onClick={() => setActive(item)}>
                <div className="lib-card__img">
                  <img src={item.url} alt={item.session.prompt} loading="lazy" />
                  {item.preview ? <span className="demo-badge">DEMO</span> : null}
                  <span className="shot__play" aria-hidden="true">
                    <Play width="15" height="15" />
                  </span>
                </div>
                <div className="lib-card__body">
                  <p>{item.session.prompt || '（无提示词）'}</p>
                  <div className="lib-card__meta">
                    <span>{item.session.modelName}</span>
                    <span>{timeAgo(item.session.createdAt)}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {active ? (
        <div className="modal-mask" onClick={() => setActive(null)} role="dialog" aria-modal="true">
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <h3>{active.session.modelName} · SEED {active.seed}</h3>
              <button className="icon-btn" onClick={() => setActive(null)} aria-label="关闭">
                ×
              </button>
            </div>
            <img src={active.url} alt={active.session.prompt} style={{ width: '100%', display: 'block' }} />
            <div style={{ padding: 18 }}>
              <p style={{ margin: '0 0 6px', fontSize: 14 }}>{active.session.prompt}</p>
              <p className="mono" style={{ fontSize: 10.5, color: 'var(--muted-2)', margin: 0 }}>
                {active.session.ratio} · {active.session.resolution || '1080p'} · {active.width}×{active.height} ·{' '}
                {new Date(active.session.createdAt).toLocaleString('zh-CN')}
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
                <button className="btn btn--primary btn--sm" onClick={() => download(active)}>
                  <Download width="14" height="14" /> 下载
                </button>
                <button className="btn btn--ghost btn--sm" onClick={() => toCanvas(active)}>
                  <Canvas width="14" height="14" /> 加入画布
                </button>
                <button className="btn btn--ghost btn--sm" onClick={() => remove(active.session.key)}>
                  <Trash width="14" height="14" /> 删除本次
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
