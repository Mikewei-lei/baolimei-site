'use client';

import Dialog from '@/components/ui/Dialog';

const groups = [
  {
    title: '画布',
    items: [
      ['拖拽空白处', '平移画布'],
      ['滚轮 / 触控板', '缩放画布'],
      ['双击节点标题', '重命名节点'],
      ['右键', '打开上下文菜单'],
    ],
  },
  {
    title: '节点',
    items: [
      ['Shift + 点击', '多选节点'],
      ['⌘ / Ctrl + D', '复制选中节点'],
      ['⌘ / Ctrl + G', '组合选中节点'],
      ['⌘ / Ctrl + ⇧ + G', '取消组合'],
      ['Delete / Backspace', '删除选中节点或连线'],
      ['Esc', '取消选择 / 关闭菜单'],
    ],
  },
  {
    title: '生成',
    items: [
      ['节点内「生成」', '提交异步生成任务'],
      ['失败后「重试」', '重新提交同一任务'],
      ['自动保存', '编辑后 400ms 写入本地'],
    ],
  },
];

export default function ShortcutsDialog({ open, onClose }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      eyebrow="Shortcuts"
      title="画布快捷键"
      description="保持双手在键盘上。所有操作都会立即写入本地项目。"
      width={640}
    >
      <div className="shortcut-grid">
        {groups.map((g) => (
          <div key={g.title} className="shortcut-group">
            <h3>{g.title}</h3>
            {g.items.map(([key, desc]) => (
              <div className="shortcut-row" key={key}>
                <kbd>{key}</kbd>
                <span>{desc}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Dialog>
  );
}
