'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { KEYS, readJSON, writeJSON, timeAgo, pushInbox } from '@/lib/store';
import { Download, Canvas, Trash, Play } from '@/components/Icons';
import { useAuth } from '@/components/auth/AuthProvider';
import { apiFetch } from '@/lib/api';

export default function LibraryClient() {
  const { user, ready } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [assets, setAssets] = useState([]);
  const [filter, setFilter] = useState('all');
  const [active, setActive] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const closeRef = useRef(null);

  const loadAssets = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch('/api/assets?limit=60');
      setAssets(Array.isArray(data.assets) ? data.assets : []);
    } catch (err) {
      setError(err.message || '素材加载失败');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!ready) return;
    if (user) {
      loadAssets();
      setHydrated(true);
      return;
    }
    const saved = readJSON(KEYS.history, []);
    setSessions(Array.isArray(saved) ? saved.filter((s) => s.status === 'succeeded') : []);
    setHydrated(true);
  }, [ready, user, loadAssets]);

  useEffect(() => {
    if (!active) return;
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') setActive(null);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [active]);

  const localItems = useMemo(() => {
    const flat = [];
    sessions.forEach((s) => {
      (s.result?.items || []).forEach((item) => flat.push({ ...item, session: s }));
    });
    return flat;
  }, [sessions]);

  const items = useMemo(() => {
    if (user) {
      return assets.map((asset) => ({
        id: asset.id,
        assetId: asset.id,
        url: asset.url,
        type: asset.kind,
        seed: '',
        asset,
        session: {
          key: asset.id,
          prompt: asset.originalName || '云端素材',
          modelName: '云端素材库',
          createdAt: new Date(asset.createdAt).getTime(),
          ratio: '',
          resolution: asset.mimeType,
        },
      }));
    }
    return localItems;
  }, [assets, localItems, user]);

  const filtered = items.filter((it) =>
    filter === 'all' ? true : filter === 'image' ? it.type === 'image' : it.type === 'video'
  );

  const remove = async (item) => {
    if (!window.confirm('删除这个素材？引用它的画布节点可能会失效。')) return;
    if (user) {
      try {
        await apiFetch(`/api/assets/${item.assetId}?force=1`, { method: 'DELETE' });
        setAssets((list) => list.filter((a) => a.id !== item.assetId));
        setActive(null);
      } catch (err) {
        setError(err.message || '删除失败');
      }
      return;
    }
    const next = sessions.filter((s) => s.key !== item.session.key);
    setSessions(next);
    writeJSON(KEYS.history, next);
    setActive(null);
  };

  const download = (item) => {
    const ext =
      item.type === 'video' ? 'mp4' : item.type === 'audio' ? 'mp3' : item.asset?.mimeType === 'image/svg+xml' ? 'svg' : 'png';
    const a = document.createElement('a');
    a.href = item.url;
    a.download = `baolimei-${item.assetId || item.seed || Date.now()}.${ext}`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  };

  const toCanvas = (item) => {
    pushInbox({
      type: item.type === 'video' ? 'video' : item.type === 'audio' ? 'audio' : 'image',
      src: item.url,
      assetId: item.assetId || null,
      prompt: item.session.prompt,
      model: item.session.modelName,
      ratio: item.session.ratio,
      seed: item.seed,
    });
    alert('已加入画布，打开画布即可使用');
  };

  if (!hydrated) return null;

  if (user && loading && !items.length) {
    return <div className="empty"><b>正在加载云端素材…</b>素材会从对象存储签发短期访问链接。</div>;
  }

  if (user && error && !items.length) {
    return (
      <div className="empty">
        <b>素材加载失败</b>
        {error}
        <div style={{ marginTop: 16 }}>
          <button className="btn btn--ghost btn--sm" onClick={loadAssets}>重试</button>
        </div>
      </div>
    );
  }

  return (
    <>
      {items.length === 0 ? (
        <div className="empty">
          <b>{user ? '云端素材库还是空的' : '作品库还是空的'}</b>
          {user
            ? '在创作台生成镜头或上传素材后，文件会保存到对象存储并显示在这里。'
            : '在创作台生成第一支镜头后，作品会自动保存在这里（仅存储在你的浏览器本地）。'}
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
              {user ? '云端数据库 + 对象存储 · 已登录' : '本地存储 · 清空浏览器数据会丢失'}
            </span>
          </div>

          <div className="lib-grid">
            {filtered.map((item) => (
              <article className="lib-card" key={`${item.session.key}-${item.seed}-${item.assetId || ''}`} onClick={() => setActive(item)}>
                <div className="lib-card__img">
                  {item.type === 'video' ? (
                    <video src={item.url} muted playsInline preload="metadata" />
                  ) : item.type === 'audio' ? (
                    <div className="lib-card__audio">AUDIO</div>
                  ) : (
                    <img src={item.url} alt={item.session.prompt} loading="lazy" />
                  )}
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
              <h3>{active.session.modelName} {active.seed ? `· SEED ${active.seed}` : ''}</h3>
              <button ref={closeRef} className="icon-btn" onClick={() => setActive(null)} aria-label="关闭预览">
                ×
              </button>
            </div>
            {active.type === 'video' ? (
              <video src={active.url} controls autoPlay playsInline style={{ width: '100%', display: 'block' }} />
            ) : active.type === 'audio' ? (
              <div style={{ padding: 30 }}><audio src={active.url} controls style={{ width: '100%' }} /></div>
            ) : (
              <img src={active.url} alt={active.session.prompt} style={{ width: '100%', display: 'block' }} />
            )}
            <div style={{ padding: 18 }}>
              <p style={{ margin: '0 0 6px', fontSize: 14 }}>{active.session.prompt}</p>
              <p className="mono" style={{ fontSize: 10.5, color: 'var(--muted-2)', margin: 0 }}>
                {active.session.ratio || active.asset?.mimeType || ''} · {active.session.resolution || '1080p'} ·{' '}
                {new Date(active.session.createdAt).toLocaleString('zh-CN')}
              </p>
              {error ? <p className="auth-error" style={{ marginTop: 12 }}>{error}</p> : null}
              <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
                <button className="btn btn--primary btn--sm" onClick={() => download(active)}>
                  <Download width="14" height="14" /> 下载
                </button>
                <button className="btn btn--ghost btn--sm" onClick={() => toCanvas(active)}>
                  <Canvas width="14" height="14" /> 加入画布
                </button>
                <button className="btn btn--ghost btn--sm" onClick={() => remove(active)}>
                  <Trash width="14" height="14" /> 删除
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
