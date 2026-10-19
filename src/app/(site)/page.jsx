import Link from 'next/link';
import PromptComposer from '@/components/PromptComposer';
import PricingTable from '@/components/PricingTable';
import { features, steps, showcase, faqs, trust } from '@/lib/content';
import { site } from '@/lib/site';
import {
  Arrow,
  Video,
  ImageIcon,
  Canvas,
  Layers,
  Film,
  Mic,
  Play,
  Spark,
  Arrow as ArrowIcon,
} from '@/components/Icons';

const iconMap = {
  video: Video,
  image: ImageIcon,
  canvas: Canvas,
  layers: Layers,
  film: Film,
  mic: Mic,
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: `${site.name} ${site.nameEn}`,
  url: site.url,
  description: site.description,
  email: site.email,
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ============ HERO ============ */}
      <section className="hero">
        <div className="container">
          <div className="hero__layout">
            <div>
              <span className="hero__tag">
                <b>NEW</b> 无限画布与多镜头叙事已上线
              </span>
              <h1>
                一句话，<br />
                一支<span className="outline">片</span>。
              </h1>
              <p className="lede">
                {site.name} 是面向创作者的 AI 影视创作平台。写下镜头、锁定角色、连成故事——
                从分镜到成片，全部在一块画布上完成。
              </p>
              <PromptComposer />
            </div>

            <aside className="hero__aside" aria-label="平台概况">
              <div className="hero__stat">
                <b>8+</b>
                <span>接入模型</span>
              </div>
              <div className="hero__stat">
                <b>12s</b>
                <span>单镜最长</span>
              </div>
              <div className="hero__stat">
                <b>4K</b>
                <span>超分导出</span>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* ============ MODEL STRIP ============ */}
      <div className="strip" aria-hidden="true">
        <div className="strip__track">
          {[...trust, ...trust].map((t, i) => (
            <span key={`${t}-${i}`}>{t}</span>
          ))}
        </div>
      </div>

      {/* ============ FEATURES ============ */}
      <section className="section" id="features">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">Capabilities</span>
              <h2 className="h2">不是“生成一段视频”，<br />而是把整部片拍出来</h2>
            </div>
            <Link href="/studio" className="btn btn--ghost">
              进入创作台 <Arrow width="15" height="15" />
            </Link>
          </div>

          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {features.map((f, i) => {
              const Icon = iconMap[f.icon] || Spark;
              return (
                <article className="card" key={f.id}>
                  <div className="card__glow" />
                  <div className="card__icon">
                    <Icon />
                  </div>
                  <div className="card__num">{String(i + 1).padStart(2, '0')}</div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                  <Link href={f.href} className="card__link">
                    {f.linkText} <ArrowIcon width="13" height="13" />
                  </Link>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============ SHOWCASE ============ */}
      <section className="section section--tight" id="showcase">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">Selected Works</span>
              <h2 className="h2">由葆历莓生成的镜头</h2>
              <p className="lede">演示模式下展示的是风格占位画面，正式模型通道开通后将替换为真实生成作品。</p>
            </div>
            <Link href="/library" className="btn btn--ghost">
              全部作品 <Arrow width="15" height="15" />
            </Link>
          </div>

          <div className="showcase">
            {showcase.map((s) => (
              <figure className={`shot${s.wide ? ' shot--wide' : ''}`} key={s.src}>
                <img src={s.src} alt={s.title} loading="lazy" />
                <span className="shot__play" aria-hidden="true">
                  <Play width="16" height="16" />
                </span>
                <figcaption className="shot__meta">
                  <b>{s.title}</b>
                  <span>{s.meta}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ============ CANVAS PROMO ============ */}
      <section className="section">
        <div className="container">
          <div className="about-grid" style={{ alignItems: 'center' }}>
            <div>
              <span className="eyebrow">Infinite Canvas</span>
              <h2 className="h2">把 AI 剧组，<br />放进一块无限画布</h2>
              <p className="lede">
                提示词、关键帧、镜头、配乐都是节点。拖拽、连线、排序，你的创作过程不再是一条直线，
                而是一张可以随时回头的网。
              </p>
              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 30, gap: 12 }}>
                {[
                  ['节点式编排', '镜头之间建立真实依赖'],
                  ['非破坏式修改', '改一个节点，下游自动更新'],
                  ['一键成片', '按连线顺序拼接导出'],
                  ['本地优先存储', '项目自动保存在浏览器'],
                ].map(([t, d]) => (
                  <div key={t} style={{ borderLeft: '1px solid var(--line)', paddingLeft: 14 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{t}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{d}</div>
                  </div>
                ))}
              </div>
              <Link href="/canvas" className="btn btn--primary" style={{ marginTop: 30 }}>
                打开画布 <Arrow width="15" height="15" />
              </Link>
            </div>

            <CanvasPreview />
          </div>
        </div>
      </section>

      {/* ============ STEPS ============ */}
      <section className="section section--tight">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">Workflow</span>
              <h2 className="h2">三步，从想法到成片</h2>
            </div>
          </div>
          <div className="steps">
            {steps.map((s) => (
              <div className="step" key={s.n}>
                <span className="step__n">STEP {s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ PRICING ============ */}
      <section className="section" id="pricing">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">Pricing</span>
              <h2 className="h2">按作品付费，而不是按焦虑付费</h2>
              <p className="lede">内测期间所有功能免费体验。正式计费前会提前公告，已生成作品不受影响。</p>
            </div>
            <Link href="/pricing" className="btn btn--ghost">
              查看完整价格 <Arrow width="15" height="15" />
            </Link>
          </div>
          <PricingTable />
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section className="section section--tight">
        <div className="container">
          <div className="about-grid">
            <div>
              <span className="eyebrow">FAQ</span>
              <h2 className="h2">常见问题</h2>
              <p className="lede">
                没找到答案？写信到 <a href={`mailto:${site.email}`} style={{ color: 'var(--accent)' }}>{site.email}</a>
                ，我们通常在 1 个工作日内回复。
              </p>
            </div>
            <div className="faq">
              {faqs.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="section section--tight">
        <div className="container">
          <div className="cta">
            <span className="eyebrow" style={{ justifyContent: 'center' }}>Ready</span>
            <h2>下一个镜头，从这里开始</h2>
            <p>不需要显卡，不需要素材库，也不需要等排期。写下第一句话就够了。</p>
            <Link href="/studio" className="btn btn--primary btn--lg">
              免费开始创作 <Arrow width="16" height="16" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function CanvasPreview() {
  return (
    <div
      style={{
        position: 'relative',
        border: '1px solid var(--line)',
        borderRadius: 16,
        background:
          'radial-gradient(rgba(255,255,255,.10) 1px, transparent 1px) 0 0/22px 22px, #0a0b0e',
        aspectRatio: '4 / 3.1',
        overflow: 'hidden',
      }}
      aria-hidden="true"
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(60% 60% at 30% 20%, rgba(216,255,59,.10), transparent 70%)',
        }}
      />
      {[
        { x: '8%', y: '12%', w: 132, label: 'PROMPT', text: '雨夜 · 霓虹 · 35mm', color: 'var(--accent)' },
        { x: '46%', y: '8%', w: 150, label: 'KEYFRAME', text: '', img: '/shots/shot-1.svg' },
        { x: '22%', y: '52%', w: 158, label: 'SHOT 01', text: '', img: '/shots/shot-3.svg' },
        { x: '62%', y: '48%', w: 150, label: 'SHOT 02', text: '', img: '/shots/shot-5.svg' },
      ].map((n) => (
        <div
          key={n.label}
          style={{
            position: 'absolute',
            left: n.x,
            top: n.y,
            width: n.w,
            border: '1px solid rgba(255,255,255,.16)',
            borderRadius: 9,
            background: '#111418',
            boxShadow: '0 18px 40px -22px #000',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 8.5,
              letterSpacing: '.14em',
              color: '#9aa1a9',
              padding: '6px 8px',
              borderBottom: '1px solid rgba(255,255,255,.08)',
            }}
          >
            {n.label}
          </div>
          {n.img ? (
            <img src={n.img} alt="" style={{ width: '100%', display: 'block' }} />
          ) : (
            <div style={{ padding: '14px 8px 16px', fontSize: 11, color: n.color }}>{n.text}</div>
          )}
        </div>
      ))}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        viewBox="0 0 400 310"
        preserveAspectRatio="none"
      >
        <defs>
          <marker id="ar" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
            <path d="M0 0l6 3-6 3z" fill="rgba(216,255,59,.7)" />
          </marker>
        </defs>
        <path d="M140 40C175 40 175 45 184 45" stroke="rgba(216,255,59,.55)" fill="none" strokeWidth="1.2" markerEnd="url(#ar)" />
        <path d="M196 62C196 92 150 96 130 108" stroke="rgba(216,255,59,.4)" fill="none" strokeWidth="1.2" strokeDasharray="4 4" />
        <path d="M238 62C238 100 300 112 306 140" stroke="rgba(255,255,255,.28)" fill="none" strokeWidth="1.2" />
        <path d="M130 168C130 200 240 206 300 200" stroke="rgba(216,255,59,.5)" fill="none" strokeWidth="1.2" markerEnd="url(#ar)" />
      </svg>
      <span
        style={{
          position: 'absolute',
          left: 12,
          bottom: 10,
          fontFamily: 'var(--mono)',
          fontSize: 9.5,
          letterSpacing: '.12em',
          color: '#6d757e',
        }}
      >
        CANVAS / 4 NODES · 3 EDGES
      </span>
    </div>
  );
}
