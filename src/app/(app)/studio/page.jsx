import { Suspense } from 'react';
import StudioClient from '@/components/StudioClient';

export const metadata = {
  title: '创作台',
  description: '输入一句镜头描述，选择模型与画幅，几秒生成电影级片段。葆历莓 AI 影视创作台。',
  alternates: { canonical: '/studio' },
};

export default function StudioPage() {
  return (
    <>
      <h1 className="sr-only">葆历莓创作台 · AI 视频生成</h1>
      <Suspense
        fallback={
          <div className="container" style={{ padding: '80px 24px', color: 'var(--muted)' }}>
            正在加载创作台…
          </div>
        }
      >
        <StudioClient />
      </Suspense>
    </>
  );
}
