'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  useReactFlow,
} from '@xyflow/react';
import { useAuth } from '@/components/auth/AuthProvider';
import { apiFetch, uploadAssetFile, resolveAssetUrls } from '@/lib/api';
import { getAssetUrl, putAsset } from '@/lib/assets';
import { models, modelById, ratios } from '@/lib/models';
import { KEYS, readJSON, writeJSON, uid } from '@/lib/store';
import MediaDialog from '@/components/MediaDialog';
import ProjectDialog from '@/components/canvas/ProjectDialog';
import {
  ImageIcon,
  Video,
  Trash,
  Upload,
  Layers,
  Spark,
  Film,
  Mic,
  Copy,
  Refresh,
  Folder,
  Alert,
} from '@/components/Icons';

const TYPE_META = {
  prompt: { label: 'PROMPT', icon: Spark, color: '#d8ff3b' },
  text: { label: 'TEXT', icon: Film, color: '#aeb6bf' },
  image: { label: 'KEYFRAME', icon: ImageIcon, color: '#d8ff3b' },
  video: { label: 'SHOT', icon: Video, color: '#d8ff3b' },
  audio: { label: 'AUDIO', icon: Mic, color: '#d8ff3b' },
  model: { label: 'MODEL', icon: Layers, color: '#d8ff3b' },
};
const STATUS = { queued: 'QUEUE', running: 'RUN', succeeded: 'DONE', error: 'ERR' };
const ratioValue = (r) =>
  typeof r === 'number' ? r : ratios[r] ? ratios[r][0] / ratios[r][1] : 16 / 9;
const ratioLabel = (r) =>
  Object.entries(ratios).find(([, v]) => Math.abs(v[0] / v[1] - ratioValue(r)) < 0.01)?.[0] || '16:9';

function makeNode(type, x, y, extra = {}) {
  return {
    id: uid('node'),
    type,
    x,
    y,
    w: 280,
    ratio: 16 / 9,
    title: TYPE_META[type]?.label || 'NODE',
    text: '',
    src: '',
    assetId: '',
    mediaType: type === 'video' ? 'video' : type === 'audio' ? 'audio' : 'image',
    modelId: type === 'model' ? 'blm-cinema-1' : '',
    status: 'idle',
    progress: 0,
    error: '',
    taskId: null,
    ...extra,
  };
}

function defaultGraph() {
  const p = makeNode('prompt', 60, 140, {
    title: 'PROMPT · 场景',
    text: '雨夜的东京街头，霓虹倒映在积水里，女孩撑伞回头看向镜头，35mm 胶片颗粒。',
  });
  const k = makeNode('image', 420, 80, { src: '/shots/shot-1.svg', title: 'KEYFRAME' });
  const s = makeNode('video', 420, 360, { src: '/shots/shot-3.svg', title: 'SHOT 01' });
  return {
    nodes: [p, k, s],
    edges: [
      { id: uid('e'), from: p.id, to: k.id },
      { id: uid('e'), from: p.id, to: s.id },
    ],
    groups: [],
    view: { x: 0, y: 0, k: 1 },
    name: '未命名画布',
  };
}

const normalize = (n) => ({
  ...n,
  w: Math.max(200, Number(n.w) || 280),
  ratio: ratioValue(n.ratio),
  text: n.text || '',
  src: n.src || '',
  status: n.status || 'idle',
  progress: n.progress || 0,
  error: n.error || '',
  taskId: n.taskId || null,
});

const toServerNode = (n) => {
  const c = { ...n };
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (c.assetId && !uuid.test(String(c.assetId))) c.assetId = null;
  if (c.assetId) c.src = '';
  else if (c.src && !c.src.startsWith('/')) c.src = '';
  return c;
};
const toServerGraph = (nodes, edges, groups, view, name) => ({
  nodes: nodes.map(toServerNode),
  edges,
  groups,
  view: view || { x: 0, y: 0, k: 1 },
  name,
  version: 2,
});

function FlowNode({ data, selected }) {
  const { node, update, run, cancel, pick, preview, remove } = data;
  const meta = TYPE_META[node.type] || TYPE_META.text;
  const Icon = meta.icon;
  const running = node.status === 'running' || node.status === 'queued';
  const mediaRatio = ratioValue(node.ratio);
  return (
    <div
      className={`flow-node${selected ? ' is-selected' : ''}${running ? ' is-running' : ''}${
        node.status === 'error' ? ' is-error' : ''
      }`}
    >
      <Handle type="target" position={Position.Left} className="flow-handle" />
      <div className="node__head">
        <span className="node__dot" style={{ background: meta.color }} />
        <Icon width="12" height="12" style={{ color: meta.color }} />
        <span className="node__title">{node.title}</span>
        {node.status && node.status !== 'idle' ? (
          <span className={`node__state node__state--${node.status}`}>
            {STATUS[node.status] || node.status}
          </span>
        ) : null}
        <button className="node__close nodrag" onClick={() => remove(node.id)} aria-label="删除节点">
          ×
        </button>
      </div>
      <div className="node__body">
        {node.type === 'prompt' || node.type === 'text' ? (
          <textarea
            className="nodrag"
            value={node.text}
            onChange={(e) => update(node.id, { text: e.target.value })}
            placeholder="写下镜头描述…"
            style={{ height: 104 }}
          />
        ) : null}
        {node.type === 'image' || node.type === 'video' ? (
          <>
            {node.src ? (
              <div
                className="node__media-wrap nodrag"
                style={{ height: Math.round(node.w / mediaRatio) }}
                onClick={() => preview(node)}
              >
                {node.mediaType === 'video' ? (
                  <video className="node__media" src={node.src} muted playsInline preload="metadata" />
                ) : (
                  <img className="node__media" src={node.src} alt="" />
                )}
                <span className="node__preview-badge">
                  {node.mediaType === 'video' ? 'VIDEO' : 'PREVIEW'}
                </span>
              </div>
            ) : (
              <button
                type="button"
                className="node__drop nodrag"
                style={{ height: Math.round(node.w / mediaRatio) }}
                onClick={() => pick(node.id)}
              >
                <ImageIcon width="18" height="18" />
                <span>上传{node.type === 'video' ? '视频 / 封面' : '关键帧'}</span>
              </button>
            )}
            <input
              className="nodrag"
              value={node.text}
              onChange={(e) => update(node.id, { text: e.target.value })}
              placeholder="镜头说明（可选）"
              style={{ marginTop: 8 }}
            />
          </>
        ) : null}
        {node.type === 'audio' ? (
          node.src ? (
            <div className="node__audio-wrap nodrag">
              <audio src={node.src} controls preload="metadata" style={{ width: '100%' }} />
            </div>
          ) : (
            <button
              type="button"
              className="node__drop node__drop--audio nodrag"
              onClick={() => pick(node.id)}
            >
              <Mic width="18" height="18" /> 上传音频
            </button>
          )
        ) : null}
        {node.type === 'model' ? (
          <>
            <select
              className="node__select nodrag"
              value={node.modelId || 'blm-cinema-1'}
              onChange={(e) => update(node.id, { modelId: e.target.value })}
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {m.credits} 积分
                </option>
              ))}
            </select>
            <textarea
              className="nodrag"
              value={node.text}
              onChange={(e) => update(node.id, { text: e.target.value })}
              placeholder="描述要生成的镜头…"
              style={{ height: 78, marginTop: 8 }}
            />
            {node.src ? (
              <div className="node__model-result nodrag" onClick={() => preview(node)}>
                {node.mediaType === 'video' ? (
                  <video src={node.src} muted playsInline preload="metadata" />
                ) : (
                  <img src={node.src} alt="" />
                )}
                <span>查看结果</span>
              </div>
            ) : (
              <div className="node__model-hint">{modelById(node.modelId || 'blm-cinema-1').name}</div>
            )}
          </>
        ) : null}
        {running ? (
          <div className="node__progress">
            <i style={{ width: `${Math.max(5, node.progress || 5)}%` }} />
          </div>
        ) : null}
        {node.status === 'error' ? (
          <div className="node__error">
            <Alert width="13" height="13" />
            <span>{node.error || '生成失败'}</span>
            <button className="nodrag" onClick={() => run(node.id)}>
              重试
            </button>
          </div>
        ) : null}
        <div className="node__actions nodrag">
          {node.type === 'prompt' ? (
            <button
              className="node__action node__action--primary"
              onClick={() => run(node.id)}
              disabled={running}
            >
              <Spark width="13" height="13" /> {running ? '生成中…' : '生成镜头'}
            </button>
          ) : null}
          {node.type === 'image' || node.type === 'video' ? (
            <>
              <button className="node__action" onClick={() => pick(node.id)}>
                <Upload width="13" height="13" /> {node.src ? '替换' : '上传'}
              </button>
              <button
                className="node__action node__action--primary"
                onClick={() => run(node.id)}
                disabled={running}
              >
                <Refresh width="13" height="13" /> 生成
              </button>
            </>
          ) : null}
          {node.type === 'audio' ? (
            <button className="node__action" onClick={() => pick(node.id)}>
              <Upload width="13" height="13" /> {node.src ? '替换音频' : '上传音频'}
            </button>
          ) : null}
          {node.type === 'model' ? (
            <>
              <button
                className="node__action node__action--primary"
                onClick={() => run(node.id)}
                disabled={running}
              >
                <Spark width="13" height="13" /> {running ? '生成中…' : '运行模型'}
              </button>
              <button className="node__action" onClick={() => pick(node.id)}>
                <Upload width="13" height="13" /> 引用素材
              </button>
            </>
          ) : null}
          {running && node.taskId ? (
            <button className="node__action" onClick={() => cancel(node.id)}>
              取消
            </button>
          ) : null}
        </div>
      </div>
      <div className="node__foot">
        <span>{meta.label}</span>
        <span>{node.w}×auto</span>
      </div>
      <Handle type="source" position={Position.Right} className="flow-handle" />
    </div>
  );
}
const nodeTypes = { blm: FlowNode };

function Inner() {
  const { user, ready: authReady, openAuth } = useAuth();
  const rf = useReactFlow();
  const fileRef = useRef(null);
  const saveTimer = useRef(null);
  const taskTimers = useRef(new Set());
  const toastTimers = useRef(new Set());
  const resolved = useRef(new Set());
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [projectName, setProjectName] = useState('未命名画布');
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState(null);
  const [canvasId, setCanvasId] = useState(null);
  const [baseVersion, setBaseVersion] = useState(1);
  const [sync, setSync] = useState('guest');
  const [syncError, setSyncError] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [serverReady, setServerReady] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [preview, setPreview] = useState(null);
  const [uploadTarget, setUploadTarget] = useState(null);
  const [menu, setMenu] = useState(null);
  const suppressSave = useRef(true);
  const baseVersionRef = useRef(1);
  const syncRef = useRef('guest');
  const graphRef = useRef({ nodes, edges, groups, projectName });
  useEffect(() => {
    graphRef.current = { nodes, edges, groups, projectName };
  }, [nodes, edges, groups, projectName]);
  useEffect(() => {
    baseVersionRef.current = baseVersion;
  }, [baseVersion]);
  useEffect(() => {
    syncRef.current = sync;
  }, [sync]);

  const toast = useCallback((text) => {
    const id = uid('t');
    setToasts((l) => [...l, { id, text }]);
    const timer = setTimeout(() => {
      setToasts((l) => l.filter((t) => t.id !== id));
      toastTimers.current.delete(timer);
    }, 3200);
    toastTimers.current.add(timer);
  }, []);
  const update = useCallback(
    (id, patch) => setNodes((l) => l.map((n) => (n.id === id ? { ...n, ...patch } : n))),
    []
  );

  const applyGraph = useCallback((g) => {
    resolved.current = new Set();
    setNodes((g.nodes || []).map(normalize));
    setEdges(Array.isArray(g.edges) ? g.edges : []);
    setGroups(Array.isArray(g.groups) ? g.groups : []);
    setSelectedIds([]);
  }, []);
  const mapProjects = (list) => (list || []).map((p) => ({ ...p, nodeCount: p.canvas?.nodeCount || 0 }));
  const refreshProjects = useCallback(async () => {
    const data = await apiFetch('/api/projects');
    const list = mapProjects(data.projects);
    setProjects(list);
    return list;
  }, []);

  useEffect(() => {
    const saved = readJSON(KEYS.canvas, null);
    const local = saved?.nodes?.length ? saved : defaultGraph();
    applyGraph(local);
    setProjectName(local.name || '未命名画布');
    setHydrated(true);
  }, [applyGraph]);

  useEffect(() => {
    if (!hydrated || !authReady) return;
    if (!user) {
      setSync('guest');
      setServerReady(true);
      suppressSave.current = false;
      return;
    }
    let cancelled = false;
    (async () => {
      setSync('loading');
      suppressSave.current = true;
      try {
        let list = await refreshProjects();
        if (!list.length) {
          const created = await apiFetch('/api/projects', {
            method: 'POST',
            body: { name: '我的第一个项目' },
          });
          list = mapProjects([created.project]);
          setProjects(list);
        }
        const p = list[0];
        const data = await apiFetch(`/api/canvases/${p.canvas.id}`);
        if (cancelled) return;
        applyGraph(data.graph.nodes?.length ? data.graph : defaultGraph());
        setCanvasId(p.canvas.id);
        setProjectId(p.id);
        setProjectName(p.name);
        setBaseVersion(data.canvas.version);
        setSync('synced');
        setTimeout(() => {
          suppressSave.current = false;
          rf.fitView({ padding: 0.2, duration: 500 });
        }, 300);
      } catch (err) {
        if (!cancelled) {
          setSync('offline');
          setSyncError(err.message || '云端加载失败');
          suppressSave.current = false;
        }
      } finally {
        if (!cancelled) setServerReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, authReady, user?.id]);

  const saveServer = useCallback(
    async ({ snapshot = false, label } = {}) => {
      if (!user || !canvasId) return false;
      setSync('saving');
      setSyncError('');
      try {
        const g = graphRef.current;
        const data = await apiFetch(`/api/canvases/${canvasId}`, {
          method: 'PUT',
          body: {
            baseVersion: baseVersionRef.current,
            graph: toServerGraph(g.nodes, g.edges, g.groups, null, g.projectName),
            snapshot,
            label,
          },
        });
        baseVersionRef.current = data.canvas.version;
        setBaseVersion(data.canvas.version);
        setSync('synced');
        return true;
      } catch (err) {
        if (err.status === 409) {
          setSync('conflict');
          setSyncError('画布已在其他设备更新，请重新加载');
        } else {
          setSync('offline');
          setSyncError(err.message || '云端保存失败');
        }
        return false;
      }
    },
    [canvasId, user]
  );

  useEffect(() => {
    if (!hydrated) return;
    if (user) {
      if (!serverReady || !canvasId || suppressSave.current || syncRef.current === 'conflict') return;
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void saveServer();
      }, 900);
      return () => clearTimeout(saveTimer.current);
    }
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      writeJSON(KEYS.canvas, {
        nodes,
        edges,
        groups,
        view: { x: 0, y: 0, k: 1 },
        name: projectName,
        updatedAt: Date.now(),
      });
    }, 500);
    return () => clearTimeout(saveTimer.current);
  }, [nodes, edges, groups, projectName, hydrated, user, serverReady, canvasId, saveServer]);

  useEffect(() => {
    if (!hydrated) return;
    const pending = nodes.filter((n) => n.assetId && !n.src && !resolved.current.has(n.assetId));
    if (!pending.length) return;
    if (user) {
      (async () => {
        const map = await resolveAssetUrls(pending.map((n) => n.assetId));
        pending.forEach((n) => resolved.current.add(n.assetId));
        setNodes((l) =>
          l.map((n) => (n.assetId && map[n.assetId] && !n.src ? { ...n, src: map[n.assetId] } : n))
        );
      })();
      return;
    }
    (async () => {
      const pairs = [];
      for (const n of pending) {
        try {
          const url = await getAssetUrl(n.assetId);
          if (url) {
            resolved.current.add(n.assetId);
            pairs.push([n.id, url]);
          }
        } catch {
          // ignore
        }
      }
      const map = Object.fromEntries(pairs);
      if (Object.keys(map).length) setNodes((l) => l.map((n) => (map[n.id] ? { ...n, src: map[n.id] } : n)));
    })();
  }, [hydrated, nodes, user]);

  const pollJob = useCallback(
    (nodeId, jobId, attempt = 0, net = 0) => {
      const timer = setTimeout(async () => {
        taskTimers.current.delete(timer);
        try {
          const { job } = await apiFetch(`/api/jobs/${jobId}`);
          if (job.status === 'succeeded' && job.result) {
            update(nodeId, {
              status: 'succeeded',
              progress: 100,
              src: job.result.url,
              assetId: job.result.assetId,
              mediaType: job.result.kind,
              taskId: null,
              error: '',
            });
            toast('生成完成，结果已写入素材库');
            return;
          }
          if (job.status === 'failed' || job.status === 'cancelled') {
            update(nodeId, {
              status: job.status === 'cancelled' ? 'idle' : 'error',
              progress: 0,
              error: job.error || (job.status === 'cancelled' ? '任务已取消' : '生成失败'),
              taskId: null,
            });
            toast(job.error || '任务已取消');
            return;
          }
          update(nodeId, {
            status: job.status === 'queued' ? 'queued' : 'running',
            progress: job.progress || 10,
            taskId: jobId,
          });
          if (attempt > 300) throw new Error('生成超时，请重试');
          pollJob(nodeId, jobId, attempt + 1, 0);
        } catch (err) {
          if (!err.status && net < 3) {
            pollJob(nodeId, jobId, attempt + 1, net + 1);
            return;
          }
          update(nodeId, { status: 'error', progress: 0, error: err.message, taskId: null });
          toast(err.message);
        }
      }, attempt === 0 ? 700 : 1000);
      taskTimers.current.add(timer);
    },
    [toast, update]
  );

  const run = useCallback(
    async (nodeId) => {
      if (!user) {
        openAuth('login');
        toast('登录后使用云端生成');
        return;
      }
      if (!projectId || !canvasId) {
        toast('请先打开云端项目');
        return;
      }
      const node = graphRef.current.nodes.find((n) => n.id === nodeId);
      if (!node || node.status === 'running' || node.status === 'queued') return;
      const model = modelById(node.modelId || (node.type === 'image' ? 'flux-1-1-pro' : 'blm-cinema-1'));
      const incoming = graphRef.current.edges
        .filter((e) => e.to === node.id)
        .map((e) => graphRef.current.nodes.find((n) => n.id === e.from))
        .filter((n) => n && (n.type === 'prompt' || n.type === 'text'))
        .map((n) => n.text)
        .join('\n');
      const prompt = (node.text || incoming || '').trim();
      if (!prompt && !node.src) {
        toast('请先输入提示词或上传素材');
        return;
      }
      let target = node.id;
      if (node.type === 'prompt') {
        if (!prompt) {
          toast('请先输入提示词');
          return;
        }
        const out = makeNode('video', node.x + node.w + 120, node.y, {
          title: 'SHOT · 生成',
          text: prompt,
          modelId: model.id,
          status: 'queued',
          ratio: node.ratio,
        });
        setNodes((l) => [...l, out]);
        setEdges((l) => [...l, { id: uid('e'), from: node.id, to: out.id }]);
        target = out.id;
      }
      update(target, { status: 'queued', progress: 0, error: '', taskId: null });
      update(node.id, { status: 'running', progress: 0 });
      const kind =
        model.kind === 'image'
          ? 'text_to_image'
          : node.mediaType === 'image' && node.assetId
            ? 'image_to_video'
            : 'text_to_video';
      try {
        const { job } = await apiFetch('/api/jobs', {
          method: 'POST',
          body: {
            projectId,
            canvasId,
            nodeId: target,
            model: model.id,
            kind,
            prompt: prompt || '素材参考镜头',
            params: {
              ratio: ratioLabel(node.ratio),
              duration: Math.min(5, model.maxDuration || 5),
              resolution: model.resolutions.at(-1),
              style: 'cinematic',
              imageAssetId: kind === 'image_to_video' ? node.assetId : null,
            },
            idempotencyKey: `node:${target}:${Date.now()}`,
          },
        });
        update(target, { status: 'queued', taskId: job.id });
        if (node.type === 'prompt') update(node.id, { status: 'succeeded', progress: 100 });
        pollJob(target, job.id);
      } catch (err) {
        update(target, { status: 'error', error: err.message });
        toast(err.message);
      }
    },
    [user, openAuth, projectId, canvasId, pollJob, toast, update]
  );

  const cancel = useCallback(
    async (nodeId) => {
      const node = graphRef.current.nodes.find((n) => n.id === nodeId);
      if (!node?.taskId) return;
      try {
        await apiFetch(`/api/jobs/${node.taskId}/cancel`, { method: 'POST' });
        update(nodeId, { status: 'idle', progress: 0, error: '任务已取消', taskId: null });
        toast('已取消任务');
      } catch (err) {
        toast(err.message);
      }
    },
    [toast, update]
  );

  const pick = useCallback((id) => {
    setUploadTarget(id);
    setTimeout(() => fileRef.current?.click(), 0);
  }, []);
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    const target = uploadTarget;
    e.target.value = '';
    if (!file || !target) return;
    try {
      const current = graphRef.current.nodes.find((n) => n.id === target);
      if (user) {
        const asset = await uploadAssetFile(file, { projectId });
        update(target, {
          assetId: asset.id,
          src: asset.url,
          mediaType: file.type.startsWith('video')
            ? 'video'
            : file.type.startsWith('audio')
              ? 'audio'
              : 'image',
          text: current?.text || file.name,
        });
        toast('素材已上传到云端');
      } else {
        const assetId = await putAsset(file, { name: file.name, type: file.type });
        update(target, {
          assetId,
          src: URL.createObjectURL(file),
          mediaType: file.type.startsWith('video')
            ? 'video'
            : file.type.startsWith('audio')
              ? 'audio'
              : 'image',
          text: current?.text || file.name,
        });
        toast('素材已上传到本地画布');
      }
    } catch (err) {
      toast(err.message || '上传失败');
    }
    setUploadTarget(null);
  };

  const previewNode = useCallback((n) => {
    if (!n?.src) return;
    setPreview({
      kind: n.mediaType || 'image',
      poster: n.src,
      video: n.mediaType === 'video' ? n.src : undefined,
      audio: n.mediaType === 'audio' ? n.src : undefined,
      title: n.title,
      en: 'CANVAS NODE',
      meta: TYPE_META[n.type]?.label || n.type,
      headline: n.text,
    });
  }, []);

  const remove = useCallback((id) => {
    setNodes((l) => l.filter((n) => n.id !== id));
    setEdges((l) => l.filter((e) => e.from !== id && e.to !== id));
    setSelectedIds((l) => l.filter((x) => x !== id));
  }, []);
  const addNode = useCallback(
    (type) => {
      const n = makeNode(type, 120 + Math.random() * 160, 120 + Math.random() * 160);
      setNodes((l) => [...l, n]);
      setSelectedIds([n.id]);
      toast(`已添加${TYPE_META[type]?.label || '节点'}`);
    },
    [toast]
  );

  const rfNodes = useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        type: 'blm',
        position: { x: n.x, y: n.y },
        data: { node: n, update, run, cancel, pick, preview: previewNode, remove },
        selected: selectedIds.includes(n.id),
        measured: n.measured,
        style: { width: n.w },
      })),
    [nodes, selectedIds, update, run, cancel, pick, previewNode, remove]
  );
  const rfEdges = useMemo(
    () =>
      edges.map((e) => ({
        id: e.id,
        source: e.from,
        target: e.to,
      })),
    [edges]
  );

  const onNodesChange = useCallback((changes) => {
    const removed = new Set(changes.filter((c) => c.type === 'remove').map((c) => c.id));
    const pos = new Map(
      changes.filter((c) => c.type === 'position' && c.position).map((c) => [c.id, c.position])
    );
    const dims = new Map(
      changes.filter((c) => c.type === 'dimensions' && c.dimensions).map((c) => [c.id, c.dimensions])
    );
    const sel = changes.filter((c) => c.type === 'select');
    setNodes((list) =>
      list
        .filter((n) => !removed.has(n.id))
        .map((n) => {
          let next = n;
          if (pos.has(n.id)) next = { ...next, x: pos.get(n.id).x, y: pos.get(n.id).y };
          if (dims.has(n.id) && !n.measured) next = { ...next, measured: dims.get(n.id) };
          return next;
        })
    );
    if (removed.size) setEdges((l) => l.filter((e) => !removed.has(e.from) && !removed.has(e.to)));
    if (sel.length)
      setSelectedIds((ids) => {
        const s = new Set(ids);
        sel.forEach((c) => (c.selected ? s.add(c.id) : s.delete(c.id)));
        return [...s];
      });
  }, []);
  const onConnect = useCallback((c) => {
    if (!c.source || !c.target || c.source === c.target) return;
    setEdges((l) =>
      l.some((e) => e.from === c.source && e.to === c.target)
        ? l
        : [...l, { id: uid('e'), from: c.source, to: c.target }]
    );
  }, []);
  const duplicate = useCallback(() => {
    const chosen = graphRef.current.nodes.filter((n) => selectedIds.includes(n.id));
    if (!chosen.length) return;
    const map = new Map();
    const copies = chosen.map((n) => {
      const c = { ...n, id: uid('node'), x: n.x + 40, y: n.y + 40, status: 'idle', error: '', taskId: null };
      map.set(n.id, c.id);
      return c;
    });
    const ce = graphRef.current.edges
      .filter((e) => map.has(e.from) && map.has(e.to))
      .map((e) => ({ ...e, id: uid('e'), from: map.get(e.from), to: map.get(e.to) }));
    setNodes((l) => [...l, ...copies]);
    setEdges((l) => [...l, ...ce]);
    setSelectedIds(copies.map((c) => c.id));
    toast('已复制节点');
  }, [selectedIds, toast]);
  const deleteSelected = useCallback(() => selectedIds.forEach((id) => remove(id)), [selectedIds, remove]);

  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelected();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicate();
      }
      if (e.key === 'Escape') {
        setSelectedIds([]);
        setMenu(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deleteSelected, duplicate]);

  useEffect(() => {
    if (!menu) return;
    const close = (e) => {
      if (!e.target.closest('.canvas-menu')) setMenu(null);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [menu]);

  const openMenu = (e, kind, targetId) => {
    e.preventDefault();
    if (kind === 'node' && targetId && !selectedIds.includes(targetId)) setSelectedIds([targetId]);
    setMenu({
      x: Math.min(e.clientX, window.innerWidth - 280),
      y: Math.min(e.clientY, window.innerHeight - 360),
      kind,
      targetId,
    });
  };

  const loadProject = async (p) => {
    setSync('loading');
    suppressSave.current = true;
    resolved.current = new Set();
    try {
      const data = await apiFetch(`/api/canvases/${p.canvas.id}`);
      applyGraph(data.graph.nodes?.length ? data.graph : defaultGraph());
      setCanvasId(p.canvas.id);
      setProjectId(p.id);
      setProjectName(p.name);
      setBaseVersion(data.canvas.version);
      setSync('synced');
      setProjectsOpen(false);
      setTimeout(() => {
        suppressSave.current = false;
        rf.fitView({ padding: 0.2 });
      }, 300);
      toast(`已打开「${p.name}」`);
    } catch (err) {
      setSync('offline');
      setSyncError(err.message);
      suppressSave.current = false;
    }
  };
  const saveProject = async (name) => {
    const clean = name.trim().slice(0, 120) || '未命名画布';
    if (!user) {
      const next = [
        { id: uid('p'), name: clean, nodes, edges, groups, updatedAt: Date.now() },
        ...projects,
      ];
      writeJSON(KEYS.projects, next);
      setProjects(next);
      setProjectName(clean);
      return;
    }
    if (projectId && clean !== projectName)
      await apiFetch(`/api/projects/${projectId}`, { method: 'PATCH', body: { name: clean } });
    if (await saveServer({ snapshot: true, label: '手动保存' })) {
      setProjectName(clean);
      await refreshProjects();
      toast('项目已保存到云端');
    }
  };
  const deleteProject = async (id) => {
    if (!user) return;
    await apiFetch(`/api/projects/${id}`, { method: 'DELETE' });
    const list = await refreshProjects();
    if (id === projectId && list[0]) await loadProject(list[0]);
    toast('项目已删除');
  };
  const newCanvas = async () => {
    if (!window.confirm('新建空白画布？当前画布会自动保存。')) return;
    if (!user) {
      applyGraph(defaultGraph());
      setProjectName('未命名画布');
      setProjectsOpen(false);
      return;
    }
    const { project } = await apiFetch('/api/projects', {
      method: 'POST',
      body: { name: '未命名项目' },
    });
    await refreshProjects();
    await loadProject(project);
    toast('已新建云端项目');
  };

  return (
    <div className="flow-shell">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onConnect={onConnect}
        onNodeContextMenu={(e, n) => openMenu(e, 'node', n.id)}
        onPaneContextMenu={(e) => openMenu(e, 'canvas')}
        onPaneClick={() => {
          setMenu(null);
          setSelectedIds([]);
        }}
        onInit={(inst) => setTimeout(() => inst.fitView({ padding: 0.2 }), 200)}
        minZoom={0.2}
        maxZoom={2.2}
        snapToGrid
        snapGrid={[20, 20]}
        selectionOnDrag={false}
        multiSelectionKeyCode="Shift"
        deleteKeyCode={null}
        fitView
      >
        <Background variant="dots" gap={24} size={1} color="rgba(255,255,255,.16)" />
        <Controls position="bottom-right" showInteractive={false} />
        <MiniMap position="bottom-left" nodeColor="rgba(216,255,59,.5)" maskColor="rgba(5,6,8,.75)" />
      </ReactFlow>

      <div className="flow-toolbar">
        <button className="tool-btn" onClick={() => addNode('prompt')}>
          <Spark /> 提示词
        </button>
        <button className="tool-btn" onClick={() => addNode('image')}>
          <ImageIcon /> 关键帧
        </button>
        <button className="tool-btn" onClick={() => addNode('video')}>
          <Video /> 镜头
        </button>
        <button className="tool-btn" onClick={() => addNode('audio')}>
          <Mic /> 音频
        </button>
        <button className="tool-btn" onClick={() => addNode('model')}>
          <Layers /> 模型
        </button>
        <button className="tool-btn" onClick={() => addNode('text')}>
          <Film /> 文本
        </button>
        <span className="canvas-toolbar__sep" />
        <button
          className={`tool-btn${outlineOpen ? ' is-on' : ''}`}
          onClick={() => setOutlineOpen((v) => !v)}
        >
          <Layers /> 大纲
        </button>
        <button className="tool-btn" onClick={() => setProjectsOpen(true)}>
          <Folder /> {projectName.slice(0, 12)}
        </button>
        <button className="tool-btn" onClick={() => rf.fitView({ padding: 0.2, duration: 500 })}>
          适应
        </button>
        <button className="tool-btn" onClick={duplicate}>
          <Copy /> 复制
        </button>
        <button className="tool-btn" onClick={deleteSelected}>
          <Trash /> 删除
        </button>
        <span className={`flow-sync is-${sync}`}>
          {['synced', 'saved'].includes(sync)
            ? '云端已保存'
            : sync === 'saving'
              ? '保存中…'
              : sync === 'guest'
                ? '本地模式'
                : sync === 'conflict'
                  ? '版本冲突'
                  : sync === 'offline'
                    ? '离线草稿'
                    : '加载中…'}
        </span>
      </div>

      <div className="flow-stats mono">
        {nodes.length} 节点 · {edges.length} 连线 · 拖拽节点 / 滚轮缩放 / 空白拖拽平移 / Shift 多选 / 拖右侧圆点连线
      </div>

      {outlineOpen ? (
        <aside className="canvas-outline">
          <div className="canvas-outline__head">
            <span className="mono">OUTLINE / {nodes.length}</span>
            <button className="icon-btn" onClick={() => setOutlineOpen(false)}>
              ×
            </button>
          </div>
          <div className="canvas-outline__list">
            {nodes.map((n) => (
              <button
                key={n.id}
                className="canvas-outline__item"
                onClick={() => rf.setCenter(n.x + n.w / 2, n.y + 100, { zoom: 1, duration: 500 })}
              >
                <span className={`canvas-outline__dot is-${n.status}`} />
                <span className="canvas-outline__label">{n.title}</span>
                <span className="mono">{TYPE_META[n.type]?.label}</span>
              </button>
            ))}
          </div>
        </aside>
      ) : null}

      {user && ['conflict', 'offline'].includes(sync) ? (
        <div className={`canvas-sync-banner is-${sync}`}>
          <span>{syncError}</span>
          {sync === 'conflict' ? (
            <button
              className="btn btn--primary btn--sm"
              onClick={() => {
                const p = projects.find((x) => x.id === projectId);
                if (p) loadProject(p);
              }}
            >
              重新加载
            </button>
          ) : (
            <button className="btn btn--ghost btn--sm" onClick={() => saveServer()}>
              重试保存
            </button>
          )}
        </div>
      ) : null}

      {menu ? (
        <div
          className="canvas-menu"
          style={{ left: menu.x, top: menu.y }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="canvas-menu__label mono">{menu.kind === 'node' ? 'NODE' : 'CANVAS'}</div>
          {menu.kind === 'node' ? (
            <>
              <button
                className="canvas-menu__item"
                onClick={() => {
                  const n = nodes.find((x) => x.id === menu.targetId);
                  if (n) run(n.id);
                  setMenu(null);
                }}
              >
                <Spark width="13" height="13" /> 生成 / 重试
              </button>
              <button
                className="canvas-menu__item"
                onClick={() => {
                  const n = nodes.find((x) => x.id === menu.targetId);
                  if (n) previewNode(n);
                  setMenu(null);
                }}
              >
                预览素材
              </button>
              <button
                className="canvas-menu__item"
                onClick={() => {
                  duplicate();
                  setMenu(null);
                }}
              >
                <Copy width="13" height="13" /> 复制节点
              </button>
              {nodes.find((x) => x.id === menu.targetId)?.taskId ? (
                <button
                  className="canvas-menu__item"
                  onClick={() => {
                    cancel(menu.targetId);
                    setMenu(null);
                  }}
                >
                  取消任务
                </button>
              ) : null}
              <div className="canvas-menu__separator" />
              <button
                className="canvas-menu__item is-danger"
                onClick={() => {
                  remove(menu.targetId);
                  setMenu(null);
                }}
              >
                <Trash width="13" height="13" /> 删除节点
              </button>
            </>
          ) : (
            <>
              <button className="canvas-menu__item" onClick={() => { addNode('prompt'); setMenu(null); }}>
                添加提示词
              </button>
              <button className="canvas-menu__item" onClick={() => { addNode('image'); setMenu(null); }}>
                添加关键帧
              </button>
              <button className="canvas-menu__item" onClick={() => { addNode('video'); setMenu(null); }}>
                添加镜头
              </button>
              <button className="canvas-menu__item" onClick={() => { addNode('model'); setMenu(null); }}>
                添加模型
              </button>
              <button className="canvas-menu__item" onClick={() => { rf.fitView({ padding: 0.2 }); setMenu(null); }}>
                适应视图
              </button>
              <div className="canvas-menu__separator" />
              <button
                className="canvas-menu__item is-danger"
                onClick={() => {
                  if (window.confirm('清空画布？')) {
                    applyGraph(defaultGraph());
                    setMenu(null);
                  }
                }}
              >
                清空画布
              </button>
            </>
          )}
        </div>
      ) : null}

      <div className="toast-wrap" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div className="toast" key={t.id}>
            {t.text}
          </div>
        ))}
      </div>
      <ProjectDialog
        open={projectsOpen}
        onClose={() => setProjectsOpen(false)}
        projects={projects}
        currentName={projectName}
        nodeCount={nodes.length}
        onSave={saveProject}
        onOpen={loadProject}
        onDelete={deleteProject}
        onNew={newCanvas}
      />
      <MediaDialog item={preview} onClose={() => setPreview(null)} />
      <input ref={fileRef} type="file" accept="image/*,video/*,audio/*" hidden onChange={onFile} />
    </div>
  );
}

export default function CanvasFlow() {
  return (
    <ReactFlowProvider>
      <Inner />
    </ReactFlowProvider>
  );
}
