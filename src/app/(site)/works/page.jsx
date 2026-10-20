import Link from 'next/link';
import WorkGallery from '@/components/WorkGallery';
import Reveal from '@/components/Reveal';
import { Arrow } from '@/components/Icons';

export const metadata = {
  title: '品牌样片',
  description: '葆历莓原创 AI 影视样片与角色设定：多镜头叙事、角色一致性、电影级调色与低照度运动镜头测试。',
  alternates: { canonical: '/works' },
};

export default function WorksPage() {
  return (
    <>
      <section className="page-head">
        <div className="container">
          <span className="eyebrow">Selected Works</span>
          <h1>
            正在拍的片子，
            <br />
            不是占位画面
          </h1>
          <p className="lede">
            这些画面来自葆历莓内部测试片与角色设定，用于验证镜头语言、角色一致性与交付质量。
          </p>
          <div className="page-head__actions">
            <Link href="/studio" className="btn btn--primary">
              开始创作 <Arrow width="15" height="15" />
            </Link>
            <Link href="/library" className="btn btn--ghost">
              我的作品库
            </Link>
          </div>
        </div>
      </section>

      <section className="container" style={{ padding: '44px 24px 80px' }}>
        <Reveal>
          <WorkGallery all />
        </Reveal>
      </section>

      <section className="section section--tight">
        <div className="container">
          <div className="cta">
            <h2>你的第一支片，也可以从这里开始</h2>
            <p>写下镜头、上传关键帧，或者直接打开一块空画布。</p>
            <Link href="/studio" className="btn btn--primary btn--lg">
              进入创作台 <Arrow width="16" height="16" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
