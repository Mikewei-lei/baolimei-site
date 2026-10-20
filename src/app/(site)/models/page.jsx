import Link from 'next/link';
import ModelExplorer from '@/components/ModelExplorer';
import Reveal from '@/components/Reveal';
import { tools } from '@/lib/works';
import { Arrow, Spark } from '@/components/Icons';

export const metadata = {
  title: '模型与工具',
  description:
    '葆历莓接入 Baolimei Cinema 1、Seedance、Kling、Veo、Wan、FLUX、Seedream 等模型，覆盖文生视频、图生视频、首尾帧、角色一致性与 4K 超分。',
  alternates: { canonical: '/models' },
};

export default function ModelsPage() {
  return (
    <>
      <section className="page-head page-head--models">
        <div className="container">
          <span className="eyebrow">Models & Tools</span>
          <h1>
            一个入口，
            <br />
            调用最好的镜头模型
          </h1>
          <p className="lede">
            按镜头需求选择模型，而不是被单一模型绑死。所有模型共用同一套画布、作品库与积分体系。
          </p>
          <div className="page-head__actions">
            <Link href="/studio" className="btn btn--primary">
              <Spark width="15" height="15" /> 开始创作
            </Link>
            <Link href="/pricing" className="btn btn--ghost">
              查看积分表 <Arrow width="14" height="14" />
            </Link>
          </div>
        </div>
      </section>

      <section className="container" style={{ padding: '44px 24px 20px' }}>
        <ModelExplorer />
      </section>

      <section className="section section--tight">
        <div className="container">
          <Reveal className="section-head">
            <div>
              <span className="eyebrow">Toolchain</span>
              <h2 className="h2">围绕镜头，而不是围绕参数</h2>
              <p className="lede">每个工具都直接进入可用的创作流程，不是功能清单上的装饰。</p>
            </div>
          </Reveal>
          <div className="tool-grid">
            {tools.map((t, i) => (
              <Reveal as="article" key={t.id} delay={i * 45} className="tool-card">
                <span className="mono">{t.en}</span>
                <h3>{t.name}</h3>
                <p>{t.desc}</p>
                <Link href={t.href} className="card__link">
                  使用这个工具 <Arrow width="13" height="13" />
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section section--tight">
        <div className="container">
          <div className="cta">
            <span className="eyebrow" style={{ justifyContent: 'center' }}>
              Start
            </span>
            <h2>选一个模型，拍第一个镜头</h2>
            <p>内测期间免费体验完整流程。所有模型都可以在创作台随时切换。</p>
            <Link href="/studio" className="btn btn--primary btn--lg">
              进入创作台 <Arrow width="16" height="16" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
