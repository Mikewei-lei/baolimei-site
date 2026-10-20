'use client';

import { useEffect, useState } from 'react';
import Dialog from '@/components/ui/Dialog';
import { Folder, Trash, Arrow } from '@/components/Icons';

export default function ProjectDialog({
  open,
  onClose,
  projects,
  currentName,
  nodeCount,
  onSave,
  onOpen,
  onDelete,
  onNew,
}) {
  const [name, setName] = useState('');

  useEffect(() => {
    if (open) setName(currentName || '未命名画布');
  }, [open, currentName]);

  const save = (e) => {
    e.preventDefault();
    onSave(name.trim() || '未命名画布');
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      eyebrow="Projects"
      title="画布项目"
      description="历史项目保存在当前浏览器。保存快照后，可以随时恢复继续编辑。"
      width={640}
      footer={
        <form className="project-save" onSubmit={save}>
          <label>
            <span>保存当前画布为</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 40))}
              placeholder="项目名称"
            />
          </label>
          <button className="btn btn--primary btn--sm" type="submit">
            保存快照 <Arrow width="13" height="13" />
          </button>
        </form>
      }
    >
      <div className="project-current">
        <span className="mono">CURRENT CANVAS</span>
        <b>{currentName || '未命名画布'}</b>
        <span>{nodeCount} 个节点 · 自动保存已开启</span>
      </div>

      <div className="project-list">
        {projects.length === 0 ? (
          <div className="canvas-empty">
            <Folder width="18" height="18" />
            <b>还没有历史项目</b>
            <span>点击下方「保存快照」，把当前画布存为一个可恢复的版本。</span>
          </div>
        ) : (
          projects.map((p) => (
            <div className="project-item" key={p.id}>
              <div className="project-item__main">
                <b>{p.name}</b>
                <span>
                  {p.nodeCount ?? p.nodes?.length ?? 0} 节点 ·{' '}
                  {p.updatedAt ? new Date(p.updatedAt).toLocaleString('zh-CN') : '未知时间'}
                </span>
              </div>
              <div className="project-item__actions">
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => onOpen(p)}>
                  打开
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`删除项目 ${p.name}`}
                  title="删除项目"
                  onClick={() => {
                    if (window.confirm(`删除项目「${p.name}」？此操作不可撤销。`)) onDelete(p.id);
                  }}
                >
                  <Trash width="14" height="14" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="project-new">
        <button type="button" className="btn btn--ghost btn--sm" onClick={onNew}>
          新建空白画布
        </button>
        <span className="mono">LOCAL STORAGE · THIS DEVICE</span>
      </div>
    </Dialog>
  );
}
