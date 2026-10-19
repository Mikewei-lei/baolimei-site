'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { models, modelById, styles } from '@/lib/models';
import { KEYS, readJSON, writeJSON, pushInbox, uid, timeAgo } from '@/lib/store';
import {
  Spark,
  Download,
  Copy,
  Trash,
  Canvas,
  Play,
  ImageIcon,
  Video,
  Upload,
  Refresh,
} from '@/components/Icons';

const MAX_SESSIONS = 24;
const RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4', '2.39:1', '21:9'];

export default function StudioClient() {
  const params = useSearchParams();
  const search = params.toString();
  const applied = useRef(false);
  const [prompt, setPrompt] = useState('');
  const [modelId, setModelId] = useState('blm-cinema-1');
  const [ratio, setRatio] = useState('16:9');
  const [duration, setDuration] = useState(5);
  const [resolution, setResolution] = useState('1080p');
  const [style, setStyle] = useState('cinematic');
  const [seed, setSeed] = useState('');
  const [count, setCount] = useState(2);
  const [image, setImage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const timers = useRef(new Set());
  const mounted = useRef(true);

  const model = modelById(modelId);

  useEffect(() => {
    mounted.current = true;
    const saved = readJSON(KEYS.history, []);
    if (Array.isArray(saved)) {
      // 刷新后未完成的任务不会再被轮询，标记为中断
      setSessions(
        saved.map((s) =>
          s.status === 'running' || s.status === 'queued'
            ? { ...s, status: 'error', error: '页面已刷新，任务中断，请重新生成' }
            : s
        )
      );
    }
    setHydrated(true);
    return () => {
      mounted.current = false;
      timers.current.forEach((t) => clearTimeout(t));
      timers.current.clear();
    };
  }, []);

  // 从首页带过来的提示词
  useEffect(() => {
    if (applied.current) return;
    const p = params.get('prompt');
    const r = params.get('ratio');
    if (p) setPrompt(p.slice(0, 800));
    if (r && RATIOS.includes(r)) setRatio(r);
    if (params.get('mode') === 'image') {
      setModelId('flux-1-1-pro');
    }
    applied.current = true;
    // 只在首次加载时同步 URL 参数，之后不再覆盖用户输入
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    const m = modelById(modelId);
    setDuration((d) => Math.min(d, m.maxDuration || 10));
    if (!m.resolutions.includes(resolution)) setResolution(m.resolutions[m.resolutions.length - 1]);
    if (!m.ratios.includes(ratio)) setRatio(m.ratios[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelId]);

  const toast = useCallback((text) => {
    const id = uid('t');
    setToasts((t) => [...t, { id, text }]);
    const timer = setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
      timers.current.delete(timer);
    }, 2600);
    timers.current.add(timer);
  }, []);

  const persist = useCallback((list) => {
    writeJSON(KEYS.history, list.slice(0, MAX_SESSIONS));
  }, []);

  const updateSession = useCallback(
    (key, patch) => {
      setSessions((prev) => {
        const next = prev.map((s) => (s.key === key ? { ...s, ...patch } : s));
        persist(next.filter((s) => s.status === 'succeeded' || s.status === 'running' || s.status === 'error'));
        return next;
      });
    },
    [persist]
  );

  const poll = useCallback(
    (key, jobId, attempt = 0) => {
      const timer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/generate?job=${encodeURIComponent(jobId)}`, { cache: 'no-store' });
          const data = await res.json();
          if (!mounted.current) return;
          if (!res.ok) throw new Error(data?.error || '生成失败');
          if (data.status === 'succeeded') {
            updateSession(key, { status: 'succeeded', progress: 100, result: data.result, mock: data.mock });
            setBusy(false);
            toast(data.mock ? '生成完成（演示占位画面）' : '生成完成');
            return;
          }
          updateSession(key, { status: 'running', progress: data.progress || 10 });
          if (attempt > 240) throw new Error('生成超时，请重试');
          poll(key, jobId, attempt + 1);
        } catch (err) {
          if (!mounted.current) return;
          updateSession(key, { status: 'error', error: err.message });
          setBusy(false);
          toast(err.message);
        }
      }, attempt === 0 ? 500 : 800);
      timers.current.add(timer);
    },
    [toast, updateSession]
  );

  const generate = useCallback(async () => {
    if (busy) return;
    if (!prompt.trim()) {
      toast('请先描述你的镜头');
      return;
    }
    setBusy(true);
    const key = uid('s');
    const session = {
      key,
      id: null,
      prompt: prompt.trim(),
      modelId,
      modelName: model.name,
      ratio,
      duration,
      resolution,
      style,
      count,
      createdAt: Date.now(),
      status: 'queued',
      progress: 0,
      result: null,
    };
    setSessions((prev) => {
      const next = [session, ...prev];
      persist(next);
      return next;
    });

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: session.prompt,
          model: modelId,
          ratio,
          duration,
          resolution,
          style,
          count,
          seed: seed ? Number(seed) : undefined,
          image: image ? 'reference-uploaded' : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || '生成通道暂时不可用');
      updateSession(key, { id: data.id, status: 'running', progress: 5, mock: data.mock, etaMs: data.etaMs });
      poll(key, data.id);
    } catch (err) {
      updateSession(key, { status: 'error', error: err.message });
      setBusy(false);
      toast(err.message);
    }
  }, [busy, prompt, modelId, ratio, duration, resolution, style, count, seed, image, model.name, persist, poll, toast, updateSession]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        generate();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [generate]);

  const download = async (item, p) => {
    const name = `baolimei-${item.seed || Date.now()}.svg`;
    try {
      if (item.url.startsWith('data:')) {
        const a = document.createElement('a');
        a.href = item.url;
        a.download = name;
        a.click();
      } else {
        const res = await fetch(item.url);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 3000);
      }
      toast('已开始下载');
    } catch {
      toast('下载失败，可右键另存为');
    }
  };

  const sendToCanvas = (item, session) => {
    pushInbox({
      type: 'image',
      src: item.url,
      prompt: session.prompt,
      model: session.modelName,
      ratio: session.ratio,
      seed: item.seed,
    });
    toast('已发送到画布，可在画布中打开');
  };

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast('提示词已复制');
    } catch {
      toast('复制失败，请手动选择');
    }
  };

  const removeSession = (key) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.key !== key);
      persist(next);
      return next;
    });
  };

  const onUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) {
      toast('图片请小于 6MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const durationOptions = [3, 5, 8, 10, 12].filter((d) => d <= (model.maxDuration || 12));
  const estimate = (model.credits || 10) * count;

  return (
    <div className="workspace">
      {/* ---------------- 控制面板 ---------------- */}
      <aside className="panel">
        <div className="panel__title">
          <span>Create</span>
          <span style={{ color: 'var(--accent)' }}>{model.kind === 'image' ? 'IMAGE' : 'VIDEO'}</span>
        </div>

        <div className="field">
          <div className="field__label">
            <span>模型</span>
            <em>{models.length} available</em>
          </div>
          <div className="model-list">
            {models.map((m) => (
              <button
                key={m.id}
                className={`model-item${m.id === modelId ? ' is-on' : ''}`}
                onClick={() => setModelId(m.id)}
                type="button"
              >
                <span className="model-item__ico">{m.kind === 'image' ? 'IMG' : 'VID'}</span>
                <span>
                  <span className="model-item__name">{m.name}</span>
                  <span className="model-item__sub">{m.vendor} · {m.credits} 点/次</span>
                </span>
                {m.badge ? <span className="model-item__badge">{m.badge}</span> : null}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <div className="field__label">
            <span>镜头描述</span>
            <em>{prompt.length}/800</em>
          </div>
          <textarea
            className="textarea"
            value={prompt}
            maxLength={800}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="例如：雨夜的东京街头，霓虹倒映在积水里，女孩撑伞回头看向镜头，35mm 胶片颗粒，浅景深，缓慢推近。"
          />
        </div>

        <div className="field">
          <div className="field__label">
            <span>参考图 / 关键帧</span>
            <em>可选</em>
          </div>
          {image ? (
            <div className="upload">
              <img src={image} alt="参考图预览" />
              <button className="upload__clear" onClick={() => setImage('')} aria-label="移除参考图">
                ×
              </button>
            </div>
          ) : (
            <label className="upload" style={{ display: 'block' }}>
              <Upload width="16" height="16" style={{ margin: '0 auto 6px' }} />
              点击上传参考图（≤6MB）
              <input type="file" accept="image/*" hidden onChange={onUpload} />
            </label>
          )}
        </div>

        <div className="field">
          <div className="field__label">
            <span>画幅</span>
            <em>{ratio}</em>
          </div>
          <div className="seg" style={{ gridAutoFlow: 'initial', gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {model.ratios.map((r) => (
              <button key={r} type="button" className={ratio === r ? 'is-on' : ''} onClick={() => setRatio(r)}>
                {r}
              </button>
            ))}
          </div>
        </div>

        {model.kind === 'video' ? (
          <div className="field">
            <div className="field__label">
              <span>时长</span>
              <em>{duration}s</em>
            </div>
            <div className="seg" style={{ gridAutoFlow: 'initial', gridTemplateColumns: `repeat(${durationOptions.length}, 1fr)` }}>
              {durationOptions.map((d) => (
                <button key={d} type="button" className={duration === d ? 'is-on' : ''} onClick={() => setDuration(d)}>
                  {d}s
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="field">
          <div className="field__label">
            <span>分辨率</span>
            <em>{resolution}</em>
          </div>
          <div className="seg" style={{ gridAutoFlow: 'initial', gridTemplateColumns: `repeat(${model.resolutions.length}, 1fr)` }}>
            {model.resolutions.map((r) => (
              <button key={r} type="button" className={resolution === r ? 'is-on' : ''} onClick={() => setResolution(r)}>
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <div className="field__label">
            <span>风格</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {styles.map((s) => (
              <button key={s.id} type="button" className={`chip${style === s.id ? ' is-on' : ''}`} onClick={() => setStyle(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <div className="field__label">
            <span>生成数量</span>
            <em>{count} 条</em>
          </div>
          <div className="seg" style={{ gridAutoFlow: 'initial', gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {[1, 2, 3, 4].map((c) => (
              <button key={c} type="button" className={count === c ? 'is-on' : ''} onClick={() => setCount(c)}>
                ×{c}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <div className="field__label">
            <span>随机种子</span>
            <em>留空自动</em>
          </div>
          <input
            className="input"
            inputMode="numeric"
            value={seed}
            onChange={(e) => setSeed(e.target.value.replace(/[^\d]/g, '').slice(0, 8))}
            placeholder="例如 20261019"
          />
        </div>

        <button className="gen-btn" onClick={generate} disabled={busy} type="button">
          {busy ? (
            <>
              <Refresh width="16" height="16" className="spin" /> 生成中…
            </>
          ) : (
            <>
              <Spark width="16" height="16" /> 生成{model.kind === 'image' ? '图片' : '视频'}
            </>
          )}
        </button>
        <div className="cost">
          <span>预计消耗 {estimate} 积分</span>
          <span style={{ color: 'var(--accent)' }}>演示模式 · 0 费用</span>
        </div>
        <p style={{ fontSize: 11, color: 'var(--muted-2)', marginTop: 12, lineHeight: 1.7 }}>
          当前为内测演示环境，返回占位画面用于体验完整流程；正式模型通道开通后自动切换。
        </p>
      </aside>

      {/* ---------------- 结果区 ---------------- */}
      <section className="stage">
        <div className="stage__head">
          <div>
            <h2>生成结果</h2>
            <span className="mono">
              SESSION {sessions.length} · {busy ? 'RUNNING' : 'IDLE'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href="/canvas" className="btn btn--ghost btn--sm">
              <Canvas width="14" height="14" /> 打开画布
            </Link>
            {sessions.some((s) => s.status === 'succeeded' || s.status === 'error') ? (
              <button className="btn btn--ghost btn--sm" onClick={() => { setSessions([]); persist([]); }}>
                <Trash width="14" height="14" /> 清空记录
              </button>
            ) : null}
          </div>
        </div>

        {!hydrated ? null : sessions.length === 0 ? (
          <div className="empty">
            <b>还没有生成记录</b>
            在左侧写下镜头描述，点击「生成」开始。也可以从下面的示例出发。
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 18 }}>
              {[
                '赛博朋克城市，雨夜，霓虹反射在湿滑地面，低机位仰拍',
                '一位穿汉服的女子站在竹林中，晨雾，微风吹动衣角',
                '宇航员漂浮在空间站外，地球在背景缓缓转动，IMAX 质感',
              ].map((s) => (
                <button key={s} className="chip" onClick={() => setPrompt(s)} type="button">
                  {s.slice(0, 18)}…
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 26 }}>
            {sessions.map((s) => (
              <div key={s.key}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 10,
                    flexWrap: 'wrap',
                    fontSize: 12,
                    color: 'var(--muted)',
                  }}
                >
                  <span className="mono" style={{ color: s.status === 'error' ? 'var(--danger)' : 'var(--accent)', fontSize: 10 }}>
                    {s.status === 'succeeded' ? 'DONE' : s.status === 'error' ? 'FAILED' : 'RUNNING'}
                  </span>
                  <span style={{ color: '#d4d9df', maxWidth: '52ch', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.prompt || '（图生视频）'}
                  </span>
                  <span className="mono" style={{ fontSize: 10, color: 'var(--muted-2)' }}>
                    {s.modelName} · {s.ratio} · {timeAgo(s.createdAt)}
                  </span>
                  <button className="icon-btn" onClick={() => copy(s.prompt)} aria-label="复制提示词" style={{ marginLeft: 'auto' }}>
                    <Copy />
                  </button>
                  <button className="icon-btn" onClick={() => removeSession(s.key)} aria-label="删除本次记录">
                    <Trash />
                  </button>
                </div>

                {s.status === 'error' ? (
                  <div className="empty" style={{ padding: 24, borderColor: 'rgba(255,107,92,.4)' }}>
                    {s.error || '生成失败'}
                  </div>
                ) : s.status === 'succeeded' ? (
                  <div className="results">
                    {s.result.items.map((item) => (
                      <div className="result" key={item.seed}>
                        <div className="result__frame">
                          {item.preview ? <span className="demo-badge">DEMO</span> : null}
                          <img
                            src={item.url}
                            alt={s.prompt}
                            style={{ aspectRatio: `${item.width} / ${item.height}` }}
                          />
                          <span className="shot__play" aria-hidden="true">
                            <Play width="15" height="15" />
                          </span>
                        </div>
                        <div className="result__bar">
                          <span className="result__prompt mono">SEED {item.seed}</span>
                          <button className="icon-btn" onClick={() => download(item, s.prompt)} aria-label="下载" title="下载">
                            <Download />
                          </button>
                          <button className="icon-btn" onClick={() => sendToCanvas(item, s)} aria-label="加入画布" title="加入画布">
                            <Canvas />
                          </button>
                          <button className="icon-btn" onClick={() => copy(s.prompt)} aria-label="复制提示词" title="复制提示词">
                            <Copy />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="results">
                    {Array.from({ length: s.count || 2 }).map((_, i) => (
                      <div className="result__loading" key={i}>
                        <span>RENDERING {s.progress || 0}%</span>
                        <div className="result__pct">
                          <i style={{ width: `${s.progress || 8}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="toast-wrap">
        {toasts.map((t) => (
          <div className="toast" key={t.id}>
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
