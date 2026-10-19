'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Spark, Arrow } from './Icons';

const ideas = [
  '雨夜的霓虹街头，女孩撑伞回头，35mm 胶片质感',
  '敦煌沙漠日落，一队骆驼缓缓走过沙脊，长镜头',
  '清晨的海边，浪花拍打黑色礁石，慢镜头，冷调',
  '未来城市天台，主角俯视车流，赛博朋克霓虹',
];

export default function PromptComposer({ compact = false }) {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [ratio, setRatio] = useState('16:9');
  const [busy, setBusy] = useState(false);

  const submit = (e) => {
    if (e) e.preventDefault();
    const prompt = value.trim();
    setBusy(true);
    const q = new URLSearchParams();
    if (prompt) q.set('prompt', prompt);
    q.set('ratio', ratio);
    router.push(`/studio?${q.toString()}`);
  };

  return (
    <form className="composer" onSubmit={submit}>
      <div className="composer__field">
        <span className="composer__spark" aria-hidden="true">
          <Spark width="16" height="16" />
        </span>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e);
          }}
          placeholder="描述你的镜头：场景、主体、光线、运镜、风格……"
          rows={compact ? 2 : 2}
          maxLength={800}
          aria-label="描述你的镜头"
        />
      </div>

      <div className="composer__bar">
        {['16:9', '9:16', '1:1', '2.39:1'].map((r) => (
          <button
            type="button"
            key={r}
            className={`chip${ratio === r ? ' is-on' : ''}`}
            onClick={() => setRatio(r)}
          >
            {r}
          </button>
        ))}
        <button
          type="button"
          className="chip"
          onClick={() => setValue(ideas[Math.floor(Math.random() * ideas.length)])}
        >
          <Spark width="12" height="12" /> 给我灵感
        </button>
        <button type="submit" className="composer__go" disabled={busy}>
          {busy ? '准备中' : '开始生成'}
          <Arrow width="15" height="15" />
        </button>
      </div>
      <p className="composer__hint">
        提示：按 Ctrl / ⌘ + Enter 直接进入创作台 · 当前为演示模式，不消耗积分
      </p>
    </form>
  );
}
