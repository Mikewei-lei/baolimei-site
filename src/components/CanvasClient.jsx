'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KEYS, readJSON, writeJSON, uid } from '@/lib/store';
import { downscaleImage } from '@/lib/image';
import {
  Plus,
  ImageIcon,
  Video,
  Trash,
  Download,
  Upload,
  Layers,
  Spark,
  Film,
  Mic,
  Copy,
  Refresh,
} from '@/components/Icons';

const NODE_W = 260;
const HEAD_H = 38;
const FOOT_H = 30;
const BODY_PAD = 20;
const TEXT_H = 96;
// 端口固定在标题栏中线，避免内容高度变化导致连线错位
const PORT_Y = HEAD_H / 2;

const TYPE_META = {
  prompt: { label: 'PROMPT', icon: Spark, color: '#d8ff3b' },
  text: { label: 'TEXT', icon: Film, color: '#8ab4ff' },
  image: { label: 'KEYFRAME', icon: ImageIcon, color: '#ff8ad8' },
  video: { label: 'SHOT', icon: Video, color: '#7cf5ff' },
  audio: { label: 'AUDIO', icon: Mic, color: '#ffb347' },
};

function mediaHeight(n) {
  const r = n.ratio || 16 / 9;
  return Math.round(n.w / r);
}

function nodeHeight(n) {
  if (n.type === 'image' || n.type === 'video') return HEAD_H + BODY_PAD + mediaHeight(n) + 88 + FOOT_H;
  if (n.type === 'audio') return HEAD_H + BODY_PAD + 54 + 24 + FOOT_H;
  return HEAD_H + BODY_PAD + TEXT_H + 24 + FOOT_H;
}

function makeNode(type, x, y, extra = {}) {
  return {
    id: uid('node'),
    type,
    x,
    y,
    w: NODE_W,
    ratio: 16 / 9,
    title: TYPE_META[type]?.label || 'NODE',
    text: '',
    src: '',
    ...extra,
  };
}

function defaultGraph() {
  const p = makeNode('prompt', 60, 120, {
    title: 'PROMPT · 场景',
    text: '雨夜的东京街头，霓虹倒映在积水里，女孩撑伞回头看向镜头，35mm 胶片颗粒。',
  });
  const k = makeNode('image', 380, 60, { src: '/shots/shot-1.svg', ratio: 16 / 9 });
  const s1 = makeNode('video', 380, 300, { src: '/shots/shot-3.svg', ratio: 16 / 9 });
  const s2 = makeNode('video', 700, 180, { src: '/shots/shot-5.svg', ratio: 9 / 16 });
  return {
    nodes: [p, k, s1, s2],
    edges: [
      { id: uid('e'), from: p.id, to: k.id },
      { id: uid('e'), from: p.id, to: s1.id },
      { id: uid('e'), from: k.id, to: s2.id },
    ],
  };
}

function bezier(a, b) {
  const ax = a.x + a.w;
  const ay = a.y + PORT_Y;
  const bx = b.x;
  const by = b.y + PORT_Y;
  const d = Math.max(50, Math.abs(bx - ax) / 2.2);
  return `M ${ax} ${ay} C ${ax + d} ${ay}, ${bx - d} ${by}, ${bx} ${by}`;
}

export default function CanvasClient() {
  const shellRef = useRef(null);
  const fileRef = useRef(null);
  const importRef = useRef(null);

  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [view, setView] = useState({ x: 40, y: 20, k: 1 });
  const [selected, setSelected] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [drag, setDrag] = useState(null);
  const [inbox, setInbox] = useState([]);
  const [savedAt, setSavedAt] = useState(null);
  const [uploadTarget, setUploadTarget] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const saveTimer = useRef(null);

  const nodeMap = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);

  /* ---------- 首次加载 ---------- */
  useEffect(() => {
    const saved = readJSON(KEYS.canvas, null);
    if (saved && Array.isArray(saved.nodes) && saved.nodes.length) {
      setNodes(saved.nodes);
      setEdges(Array.isArray(saved.edges) ? saved.edges : []);
      if (saved.view) setView(saved.view);
    } else {
      const g = defaultGraph();
      setNodes(g.nodes);
      setEdges(g.edges);
    }
    setInbox(readJSON(KEYS.inbox, []));
    setHydrated(true);
  }, []);

  /* ---------- 自动保存 ---------- */
  useEffect(() => {
    if (!hydrated) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const ok = writeJSON(KEYS.canvas, { nodes, edges, view, updatedAt: Date.now() });
      if (ok) setSavedAt(Date.now());
    }, 400);
    return () => clearTimeout(saveTimer.current);
  }, [nodes, edges, view, hydrated]);

  /* ---------- 缩放 ---------- */
  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      setView((v) => {
        const factor = Math.exp(-e.deltaY * 0.0014);
        const k = Math.min(2.4, Math.max(0.22, v.k * factor));
        const wx = (sx - v.x) / v.k;
        const wy = (sy - v.y) / v.k;
        return { k, x: sx - wx * k, y: sy - wy * k };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  /* ---------- 拖拽 / 连线 ---------- */
  const toWorld = useCallback(
    (clientX, clientY) => {
      const rect = shellRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return { x: (clientX - rect.left - view.x) / view.k, y: (clientY - rect.top - view.y) / view.k };
    },
    [view]
  );

  useEffect(() => {
    if (!drag) return;
    const move = (e) => {
      if (drag.mode === 'pan') {
        setView((v) => ({ ...v, x: drag.vx + (e.clientX - drag.sx), y: drag.vy + (e.clientY - drag.sy) }));
      } else if (drag.mode === 'node') {
        const w = toWorld(e.clientX, e.clientY);
        setNodes((ns) => ns.map((n) => (n.id === drag.id ? { ...n, x: w.x + drag.dx, y: w.y + drag.dy } : n)));
      } else if (drag.mode === 'resize') {
        const w = toWorld(e.clientX, e.clientY);
        const width = Math.min(560, Math.max(180, w.x - drag.ox));
        setNodes((ns) => ns.map((n) => (n.id === drag.id ? { ...n, w: width } : n)));
      } else if (drag.mode === 'link') {
        const w = toWorld(e.clientX, e.clientY);
        setDrag((d) => (d ? { ...d, x: w.x, y: w.y } : d));
      }
    };
    const up = (e) => {
      if (drag.mode === 'link') {
        const w = toWorld(e.clientX, e.clientY);
        const target = nodes.find(
          (n) => n.id !== drag.from && w.x >= n.x && w.x <= n.x + n.w && w.y >= n.y && w.y <= n.y + nodeHeight(n)
        );
        if (target) {
          setEdges((es) =>
            es.some((ed) => ed.from === drag.from && ed.to === target.id)
              ? es
              : [...es, { id: uid('e'), from: drag.from, to: target.id }]
          );
        }
      }
      setDrag(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [drag, nodes, toWorld]);

  /* ---------- 键盘 ---------- */
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedEdge) {
          setEdges((es) => es.filter((ed) => ed.id !== selectedEdge));
          setSelectedEdge(null);
        } else if (selected) {
          setNodes((ns) => ns.filter((n) => n.id !== selected));
          setEdges((es) => es.filter((ed) => ed.from !== selected && ed.to !== selected));
          setSelected(null);
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd' && selected) {
        e.preventDefault();
        const n = nodeMap[selected];
        if (n) {
          const copy = { ...n, id: uid('node'), x: n.x + 40, y: n.y + 40, title: n.title };
          setNodes((ns) => [...ns, copy]);
          setSelected(copy.id);
        }
      }
      if (e.key === 'Escape') {
        setSelected(null);
        setSelectedEdge(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, selectedEdge, nodeMap]);

  /* ---------- 操作 ---------- */
  const addNode = (type) => {
    const rect = shellRef.current?.getBoundingClientRect();
    const cx = rect ? (rect.width / 2 - view.x) / view.k : 200;
    const cy = rect ? (rect.height / 2 - view.y) / view.k : 200;
    const n = makeNode(type, cx - NODE_W / 2 + Math.random() * 40, cy - 80 + Math.random() * 40);
    setNodes((ns) => [...ns, n]);
    setSelected(n.id);
  };

  const removeNode = (id) => {
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setEdges((es) => es.filter((ed) => ed.from !== id && ed.to !== id));
    if (selected === id) setSelected(null);
  };

  const duplicateNode = (id) => {
    const n = nodeMap[id];
    if (!n) return;
    const copy = { ...n, id: uid('node'), x: n.x + 36, y: n.y + 36 };
    setNodes((ns) => [...ns, copy]);
    setSelected(copy.id);
  };

  const update = (id, patch) => setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, ...patch } : n)));

  const fitView = () => {
    const rect = shellRef.current?.getBoundingClientRect();
    if (!rect || !nodes.length) return;
    const minX = Math.min(...nodes.map((n) => n.x));
    const minY = Math.min(...nodes.map((n) => n.y));
    const maxX = Math.max(...nodes.map((n) => n.x + n.w));
    const maxY = Math.max(...nodes.map((n) => n.y + nodeHeight(n)));
    const bw = maxX - minX || 1;
    const bh = maxY - minY || 1;
    const k = Math.min(1.1, Math.max(0.25, Math.min((rect.width - 120) / bw, (rect.height - 160) / bh)));
    setView({
      k,
      x: rect.width / 2 - ((minX + maxX) / 2) * k,
      y: rect.height / 2 - ((minY + maxY) / 2) * k,
    });
  };

  const tidy = () => {
    const order = { prompt: 0, text: 1, image: 2, audio: 3, video: 4 };
    const sorted = [...nodes].sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9) || a.y - b.y);
    const next = sorted.map((n, i) => ({
      ...n,
      x: 80 + (i % 3) * 340,
      y: 80 + Math.floor(i / 3) * 340,
    }));
    setNodes(next);
    setTimeout(fitView, 60);
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify({ v: 1, nodes, edges, view }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `baolimei-canvas-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const importJSON = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!Array.isArray(data.nodes)) throw new Error('格式不正确');
        setNodes(data.nodes);
        setEdges(Array.isArray(data.edges) ? data.edges : []);
        if (data.view) setView(data.view);
        setTimeout(fitView, 100);
      } catch (err) {
        alert(`导入失败：${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const clearAll = () => {
    if (!window.confirm('清空画布？此操作不可撤销（已导出的文件不受影响）。')) return;
    const n = makeNode('prompt', 220, 180, { title: 'PROMPT', text: '' });
    setNodes([n]);
    setEdges([]);
    setSelected(n.id);
  };

  const importFromLibrary = () => {
    const items = readJSON(KEYS.inbox, []);
    if (!items.length) {
      alert('作品库里还没有待导入的内容。去创作台生成后点击「加入画布」。');
      return;
    }
    const baseX = 120;
    const baseY = 100;
    const created = items.slice(0, 12).map((it, i) =>
      makeNode('image', baseX + (i % 3) * 300, baseY + Math.floor(i / 3) * 240, {
        src: it.src,
        title: 'LIBRARY',
        text: it.prompt || '',
        ratio: it.ratio === '9:16' ? 9 / 16 : it.ratio === '1:1' ? 1 : 16 / 9,
      })
    );
    setNodes((ns) => [...ns, ...created]);
    writeJSON(KEYS.inbox, []);
    setInbox([]);
    setTimeout(fitView, 80);
  };

  const pickImage = (nodeId) => {
    setUploadTarget(nodeId);
    setTimeout(() => fileRef.current?.click(), 0);
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !uploadTarget) return;
    if (file.size > 12 * 1024 * 1024) {
      alert('图片请小于 12MB');
      return;
    }
    try {
      // 压缩到 1280px 以内再存，避免 localStorage 超限
      const dataUrl = await downscaleImage(file, 1280, 0.86);
      update(uploadTarget, { src: dataUrl, type: 'image' });
    } catch (err) {
      alert(err.message || '图片处理失败');
    }
    e.target.value = '';
    setUploadTarget(null);
  };

  const startPan = (e) => {
    if (e.button !== 0 && e.button !== 1) return;
    setSelected(null);
    setSelectedEdge(null);
    setDrag({ mode: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y });
  };

  const linkPreview = useMemo(() => {
    if (!drag || drag.mode !== 'link') return null;
    const from = nodeMap[drag.from];
    if (!from) return null;
    const ax = from.x + from.w;
    const ay = from.y + PORT_Y;
    const d = Math.max(40, Math.abs(drag.x - ax) / 2);
    return `M ${ax} ${ay} C ${ax + d} ${ay}, ${drag.x - d} ${drag.y}, ${drag.x} ${drag.y}`;
  }, [drag, nodeMap]);

  return (
    <div className="canvas-shell" ref={shellRef}>
      <div
        className="canvas-bg"
        style={{
          backgroundSize: `${26 * view.k}px ${26 * view.k}px`,
          backgroundPosition: `${view.x}px ${view.y}px`,
        }}
      />

      <div className={`canvas-surface${drag?.mode === 'pan' ? ' is-panning' : ''}`} onPointerDown={startPan}>
        <div
          className="canvas-world"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}
        >
          <svg className="edge-layer" aria-hidden="true">
            <defs>
              <marker id="edge-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
                <path d="M0 0l7 3.5L0 7z" fill="rgba(216,255,59,.75)" />
              </marker>
            </defs>
            {edges.map((e) => {
              const a = nodeMap[e.from];
              const b = nodeMap[e.to];
              if (!a || !b) return null;
              return (
                <path
                  key={e.id}
                  d={bezier(a, b)}
                  className="edge-path"
                  markerEnd="url(#edge-arrow)"
                  style={selectedEdge === e.id ? { stroke: 'var(--danger)', strokeWidth: 2.6 } : undefined}
                  onPointerDown={(ev) => {
                    ev.stopPropagation();
                    setSelectedEdge(e.id);
                    setSelected(null);
                  }}
                />
              );
            })}
            {linkPreview ? (
              <path d={linkPreview} className="edge-path" style={{ strokeDasharray: '5 5', opacity: 0.9 }} />
            ) : null}
          </svg>

          {nodes.map((n) => {
            const meta = TYPE_META[n.type] || TYPE_META.text;
            const Icon = meta.icon;
            const h = nodeHeight(n);
            return (
              <div
                key={n.id}
                data-node
                className={`node${selected === n.id ? ' is-selected' : ''}`}
                style={{ left: n.x, top: n.y, width: n.w }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setSelected(n.id);
                  setSelectedEdge(null);
                }}
              >
                <div
                  className="node__head"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const w = toWorld(e.clientX, e.clientY);
                    setSelected(n.id);
                    setDrag({ mode: 'node', id: n.id, dx: n.x - w.x, dy: n.y - w.y });
                  }}
                >
                  <span className="node__dot" style={{ background: meta.color }} />
                  <Icon width="12" height="12" style={{ color: meta.color, opacity: 0.85 }} />
                  <span className="node__title">{n.title}</span>
                  <button
                    className="node__close"
                    aria-label="删除节点"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => removeNode(n.id)}
                  >
                    ×
                  </button>
                </div>

                <div className="node__body">
                  {n.type === 'prompt' || n.type === 'text' ? (
                    <textarea
                      value={n.text}
                      placeholder={n.type === 'prompt' ? '写下镜头描述…' : '写点什么…'}
                      onChange={(e) => update(n.id, { text: e.target.value })}
                      style={{ height: TEXT_H }}
                    />
                  ) : null}

                  {n.type === 'image' || n.type === 'video' ? (
                    n.src ? (
                      <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => pickImage(n.id)}>
                        <img
                          className="node__media"
                          src={n.src}
                          alt={n.text || n.title}
                          style={{ height: mediaHeight(n), objectFit: 'cover' }}
                        />
                        {n.type === 'video' ? (
                          <span
                            style={{
                              position: 'absolute',
                              inset: 0,
                              display: 'grid',
                              placeItems: 'center',
                              color: '#fff',
                              background: 'rgba(0,0,0,.18)',
                            }}
                          >
                            <span
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: '50%',
                                border: '1px solid rgba(255,255,255,.5)',
                                display: 'grid',
                                placeItems: 'center',
                              }}
                            >
                              ▶
                            </span>
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => pickImage(n.id)}
                        style={{
                          width: '100%',
                          height: mediaHeight(n),
                          border: '1px dashed rgba(255,255,255,.2)',
                          borderRadius: 8,
                          color: '#8b929a',
                          fontSize: 11,
                          display: 'grid',
                          placeItems: 'center',
                          background: 'rgba(255,255,255,.02)',
                        }}
                      >
                        点击上传{n.type === 'video' ? '视频封面' : '关键帧'}
                      </button>
                    )
                  ) : null}

                  {n.type === 'audio' ? (
                    <div
                      style={{
                        height: 54,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                        padding: '0 4px',
                        border: '1px solid rgba(255,255,255,.09)',
                        borderRadius: 8,
                        background: 'rgba(255,255,255,.02)',
                      }}
                    >
                      {Array.from({ length: 26 }).map((_, i) => (
                        <i
                          key={i}
                          style={{
                            flex: 1,
                            height: `${18 + Math.abs(Math.sin(i * 1.7)) * 30}%`,
                            background: 'rgba(255,179,71,.55)',
                            borderRadius: 2,
                          }}
                        />
                      ))}
                    </div>
                  ) : null}

                  {n.type === 'image' || n.type === 'video' ? (
                    <input
                      value={n.text}
                      placeholder="镜头说明（可选）"
                      onChange={(e) => update(n.id, { text: e.target.value })}
                      style={{ marginTop: 8 }}
                    />
                  ) : null}

                  <div className="node__hint">
                    {n.type === 'audio' ? 'AUDIO TRACK' : n.type === 'prompt' ? `${(n.text || '').length} CHARS` : 'NO MODEL RUN YET'}
                  </div>
                </div>

                <div className="node__foot">
                  <span>{meta.label}</span>
                  <span>
                    {Math.round(n.w)}×{Math.round(h)}
                  </span>
                </div>

                <span
                  className="port port--in"
                  title="输入"
                  style={{ top: PORT_Y }}
                  onPointerDown={(e) => e.stopPropagation()}
                />
                <span
                  className="port port--out"
                  title="拖出连线"
                  style={{ top: PORT_Y }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const w = toWorld(e.clientX, e.clientY);
                    setDrag({ mode: 'link', from: n.id, x: w.x, y: w.y });
                  }}
                />

                <span
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const w = toWorld(e.clientX, e.clientY);
                    setDrag({ mode: 'resize', id: n.id, ox: w.x - n.w });
                  }}
                  style={{
                    position: 'absolute',
                    right: -5,
                    bottom: -5,
                    width: 12,
                    height: 12,
                    borderRadius: 3,
                    background: '#0a0c10',
                    border: '1.5px solid rgba(216,255,59,.65)',
                    cursor: 'nwse-resize',
                    zIndex: 3,
                  }}
                  title="调整宽度"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* 工具栏 */}
      <div className="canvas-toolbar">
        <button className="tool-btn" onClick={() => addNode('prompt')}>
          <Spark /> 提示词
        </button>
        <button className="tool-btn" onClick={() => addNode('image')}>
          <ImageIcon /> 关键帧
        </button>
        <button className="tool-btn" onClick={() => addNode('video')}>
          <Video /> 镜头
        </button>
        <button className="tool-btn" onClick={() => addNode('text')}>
          <Film /> 文本
        </button>
        <button className="tool-btn" onClick={() => addNode('audio')}>
          <Mic /> 音频
        </button>
        <span className="canvas-toolbar__sep" />
        <button className="tool-btn" onClick={importFromLibrary}>
          <Layers /> 从作品库{inbox.length ? ` (${inbox.length})` : ''}
        </button>
        <button className="tool-btn" onClick={tidy}>
          <Refresh /> 整理
        </button>
        <button className="tool-btn" onClick={exportJSON}>
          <Download /> 导出
        </button>
        <button className="tool-btn" onClick={() => importRef.current?.click()}>
          <Upload /> 导入
        </button>
        {selected ? (
          <button className="tool-btn" onClick={() => duplicateNode(selected)}>
            <Copy /> 复制
          </button>
        ) : null}
        <button className="tool-btn" onClick={clearAll} style={{ color: '#ff8f84' }}>
          <Trash /> 清空
        </button>
        <span
          className="mono"
          style={{ fontSize: 10, color: 'var(--muted-2)', padding: '0 6px', whiteSpace: 'nowrap' }}
        >
          {savedAt ? `已保存 · ${new Date(savedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}` : '自动保存'}
        </span>
      </div>

      <div className="canvas-zoom">
        <button onClick={() => setView((v) => ({ ...v, k: Math.max(0.22, v.k / 1.2) }))} aria-label="缩小">
          −
        </button>
        <span>{Math.round(view.k * 100)}%</span>
        <button onClick={() => setView((v) => ({ ...v, k: Math.min(2.4, v.k * 1.2) }))} aria-label="放大">
          +
        </button>
        <button onClick={fitView} aria-label="适应画布" title="适应画布" style={{ fontSize: 11 }}>
          适应
        </button>
      </div>

      <div className="canvas-tip">
        拖拽空白平移 · 滚轮缩放 · 从节点右侧圆点拖出连线 · Delete 删除 · ⌘/Ctrl+D 复制
      </div>

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
      <input ref={importRef} type="file" accept="application/json" hidden onChange={importJSON} />
    </div>
  );
}
