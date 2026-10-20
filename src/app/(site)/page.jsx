import Link from 'next/link';
import PromptComposer from '@/components/PromptComposer';
import PricingTable from '@/components/PricingTable';
import HeroStage from '@/components/HeroStage';
import WorkGallery from '@/components/WorkGallery';
import Reveal from '@/components/Reveal';
import { steps, faqs, trust } from '@/lib/content';
import { models } from '@/lib/models';
import { tools } from '@/lib/works';
import { site } from '@/lib/site';
import {
  Arrow,
  Video,
  ImageIcon,
  Canvas,
  Layers,
  Film,
  Mic,
  Spark,
} from '@/components/Icons';

const iconMap = { video: Video, image: ImageIcon, canvas: Canvas, layers: Layers, film: Film, mic: Mic };

const capabilities = [
  {
    icon: 'video',
    title: '电影级生成',
    desc: '一句中文镜头描述，自动补全光影、焦段、运动与情绪。5–12 秒片段，直接拥有电影感。',
    href: '/studio',
    link: '生成第一支镜头',
    image: '/work/work-3.webp',
    meta: 'CINEMA 1 · 4K READY',
  },
  {
    icon: 'canvas',
    title: '无限画布',
    desc: '提示词、关键帧、镜头与声音都是节点。拖拽、连线、组合，把生成过程变成真正的编排。',
    href: '/canvas',
    link: '打开画布',
  },
  {
    icon: 'layers',
    title: '角色一致性',
    desc: '跨镜头锁定同一张脸、同一套服装与同一种光，不再每个镜头换一个主角。',
    href: '/studio?model=blm-cinema-1',
    link: '锁定角色',
  },
  {
    icon: 'film',
    title: '多镜头叙事',
    desc: '从故事梗概拆分分镜，生成镜头表与转场，按叙事顺序一键串联。',
    href: '/studio',
    link: '试试分镜',
  },
  {
    icon: 'mic',
    title: '声音与配乐',
    desc: '对白、环境音与配乐同步生成，口型对齐，交付时不再只有画面。',
    href: '/studio?model=veo-3-fast',
    link: '查看声音能力',
  },
  {
    icon: 'image',
    title: '图生视频',
    desc: '上传关键帧、概念图或角色设定，让画面按指定运镜动起来。',
    href: '/studio?mode=image',
    link: '上传关键帧',
  },
];

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
      <section className="hero hero--cinema">
        <div className="hero__noise" aria-hidden="true" />
        <div className="hero__ambient" aria-hidden="true" />
        <div className="container hero__grid">
          <div className="hero__copy">
            <div className="hero__eyebrow">
              <span className="hero__tag">
                <b>NEW</b> 无限画布 2.0 已上线
              </span>
              <span className="mono">BAOLIMEI · AI FILM STUDIO</span>
            </div>

            <h1 className="hero__title">
              <span>一句话，</span>
              <span className="hero__title-accent">
                一部电影<span className="hero__dot">.</span>
              </span>
            </h1>

            <p className="hero__lede">
              葆历莓是一个 AI 影视创作平台。写下镜头、锁定角色、连成故事——
              从分镜到成片，全部在一套属于导演的工作流里完成。
            </p>

            <div className="hero__actions">
              <Link href="/studio" className="btn btn--primary btn--lg">
                开始创作 <Arrow width="15" height="15" />
              </Link>
              <Link href="/models" className="btn btn--ghost btn--lg">
                探索模型与工具
              </Link>
            </div>

            <PromptComposer />

            <div className="hero__stats">
              {[
                ['8+', '接入模型'],
                ['4K', '超分输出'],
                ['12s', '单镜最长'],
                ['∞', '无限画布'],
              ].map(([v, k]) => (
                <div key={k} className="hero__stat">
                  <b>{v}</b>
                  <span>{k}</span>
                </div>
              ))}
            </div>
          </div>

          <HeroStage />
        </div>

        <div className="container hero__foot">
          <span className="mono">SCROLL TO EXPLORE</span>
          <span className="hero__foot-line" aria-hidden="true" />
          <span className="mono">DIRECTED BY YOU / POWERED BY BAOLIMEI</span>
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

      {/* ============ CAPABILITIES ============ */}
      <section className="section" id="capabilities">
        <div className="container">
          <Reveal className="section-head">
            <div>
              <span className="eyebrow">One System</span>
              <h2 className="h2">
                不是生成一段视频，
                <br />
                而是把整部片拍出来
              </h2>
            </div>
            <Link href="/studio" className="btn btn--ghost">
              进入创作台 <Arrow width="15" height="15" />
            </Link>
          </Reveal>

          <div className="bento">
            {capabilities.map((c, i) => {
              const Icon = iconMap[c.icon] || Spark;
              return (
                <Reveal
                  as="article"
                  key={c.title}
                  delay={i * 55}
                  className={`bento__item${i === 0 ? ' bento__item--visual' : ''}`}
                >
                  {c.image ? (
                    <>
                      <img src={c.image} alt="" loading="lazy" />
                      <span className="bento__scrim" aria-hidden="true" />
                    </>
                  ) : null}
                  <div className="bento__top">
                    <span className="bento__icon">
                      <Icon width="17" height="17" />
                    </span>
                    <span className="mono">{String(i + 1).padStart(2, '0')}</span>
                  </div>
                  <div className="bento__body">
                    <span className="mono bento__meta">{c.meta || 'BAOLIMEI CORE'}</span>
                    <h3>{c.title}</h3>
                    <p>{c.desc}</p>
                    <Link href={c.href} className="card__link">
                      {c.link} <Arrow width="13" height="13" />
                    </Link>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============ SHOWCASE ============ */}
      <section className="section section--tight" id="showcase">
        <div className="container">
          <Reveal className="section-head">
            <div>
              <span className="eyebrow">Selected Works</span>
              <h2 className="h2">
                不是占位画面，
                <br />
                是我们正在拍的片子
              </h2>
              <p className="lede">
                下列画面来自葆历莓内部测试片与角色设定。正式模型通道开通后，作品库会持续更新完整成片。
              </p>
            </div>
            <Link href="/works" className="btn btn--ghost">
              全部样片 <Arrow width="15" height="15" />
            </Link>
          </Reveal>

          <Reveal delay={80}>
            <WorkGallery />
          </Reveal>
        </div>
      </section>

      {/* ============ CANVAS ============ */}
      <section className="section">
        <div className="container">
          <div className="canvas-promo">
            <Reveal className="canvas-promo__copy">
              <span className="eyebrow">Infinite Canvas</span>
              <h2 className="h2">
                把 AI 剧组，
                <br />
                放进一块无限画布
              </h2>
              <p className="lede">
                提示词、关键帧、镜头、配乐都是节点。拖拽、连线、排序，创作过程不再是一条直线，
                而是一张可以随时回头的网。
              </p>
              <div className="canvas-promo__list">
                {[
                  ['节点式编排', '镜头之间建立真实依赖'],
                  ['非破坏式修改', '改一个节点，下游自动更新'],
                  ['项目自动保存', '刷新、恢复、继续编辑'],
                  ['数据驱动', '不是演示，是真正可操作的产品'],
                ].map(([t, d]) => (
                  <div key={t}>
                    <b>{t}</b>
                    <span>{d}</span>
                  </div>
                ))}
              </div>
              <Link href="/canvas" className="btn btn--primary">
                打开 AI 画布 <Arrow width="15" height="15" />
              </Link>
            </Reveal>

            <Reveal delay={90} className="canvas-promo__visual">
              <CanvasPreview />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============ MODELS ============ */}
      <section className="section section--tight" id="models">
        <div className="container">
          <Reveal className="section-head">
            <div>
              <span className="eyebrow">Models & Tools</span>
              <h2 className="h2">一个入口，调用最好的镜头模型</h2>
              <p className="lede">
                自研 Cinema 1 负责电影感与角色一致性，同时接入 Seedance、Kling、Veo、Wan、FLUX、Seedream。
                按镜头选择模型，而不是被单一模型绑死。
              </p>
            </div>
            <Link href="/models" className="btn btn--ghost">
              查看全部模型 <Arrow width="15" height="15" />
            </Link>
          </Reveal>

          <div className="model-mini-grid">
            {models.slice(0, 4).map((m, i) => (
              <Reveal key={m.id} delay={i * 60} className="model-mini">
                <div className="model-mini__top">
                  <span className="model-mini__glyph">{m.kind === 'video' ? 'VID' : 'IMG'}</span>
                  <span className="mono">{m.vendor}</span>
                  {m.badge ? <span className="model-card__badge">{m.badge}</span> : null}
                </div>
                <h3>{m.name}</h3>
                <p>{m.desc}</p>
                <div className="model-mini__foot">
                  <span className="mono">
                    {m.kind === 'video' ? `MAX ${m.maxDuration}s` : m.resolutions.join(' / ')} · {m.credits} 积分
                  </span>
                  <Link href={`/studio?model=${m.id}`} aria-label={`使用 ${m.name}`}>
                    <Arrow width="14" height="14" />
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={120} className="tool-row">
            {tools.slice(0, 6).map((t) => (
              <Link key={t.id} href={t.href} className="tool-link">
                <span className="mono">{t.en}</span>
                <b>{t.name}</b>
                <Arrow width="13" height="13" />
              </Link>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ============ WORKFLOW ============ */}
      <section className="section section--tight">
        <div className="container">
          <Reveal className="section-head">
            <div>
              <span className="eyebrow">Workflow</span>
              <h2 className="h2">三步，从想法到成片</h2>
            </div>
            <span className="mono muted" style={{ fontSize: 11 }}>
              NO RENDER QUEUE · NO HARDWARE
            </span>
          </Reveal>
          <div className="steps">
            {steps.map((s, i) => (
              <Reveal key={s.n} as="div" delay={i * 70} className="step">
                <span className="step__n">STEP {s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ MANIFESTO ============ */}
      <section className="section section--tight">
        <div className="container">
          <div className="manifesto">
            <Reveal className="manifesto__visual">
              <img src="/work/brand-neon.webp" alt="葆历莓品牌标志" loading="lazy" />
              <span className="manifesto__visual-meta mono">BAOLIMEI / BRAND SYSTEM</span>
            </Reveal>
            <Reveal delay={80} className="manifesto__copy">
              <span className="eyebrow">Our Belief</span>
              <h2 className="h2">
                生成只是开始。
                <br />
                真正的作品诞生于编排。
              </h2>
              <p className="lede">
                我们不满足于“生成一段看起来不错的视频”。葆历莓把重心放在生成之后——
                把镜头组织成叙事，把素材打磨成作品，把一次灵感变成可以交付的成片。
              </p>
              <div className="manifesto__facts">
                {[
                  ['01', '为导演设计', '不是参数面板，是片场工作流。'],
                  ['02', '为作品设计', '从第一帧到最终交付，路径完整。'],
                  ['03', '为长期设计', '项目可保存、可恢复、可复用。'],
                ].map(([n, t, d]) => (
                  <div key={n}>
                    <span className="mono">{n}</span>
                    <b>{t}</b>
                    <p>{d}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============ PRICING ============ */}
      <section className="section" id="pricing">
        <div className="container">
          <Reveal className="section-head">
            <div>
              <span className="eyebrow">Pricing</span>
              <h2 className="h2">按作品付费，而不是按焦虑付费</h2>
              <p className="lede">内测期间所有功能免费体验。正式计费前会提前公告，已生成作品不受影响。</p>
            </div>
            <Link href="/pricing" className="btn btn--ghost">
              查看完整定价 <Arrow width="15" height="15" />
            </Link>
          </Reveal>
          <PricingTable />
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section className="section section--tight">
        <div className="container">
          <div className="about-grid">
            <Reveal>
              <span className="eyebrow">FAQ</span>
              <h2 className="h2">常见问题</h2>
              <p className="lede">
                没找到答案？写信到{' '}
                <a href={`mailto:${site.email}`} style={{ color: 'var(--accent)' }}>
                  {site.email}
                </a>
                ，我们通常在 1 个工作日内回复。
              </p>
            </Reveal>
            <Reveal delay={80} className="faq">
              {faqs.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="section section--tight">
        <div className="container">
          <Reveal className="cta">
            <span className="eyebrow" style={{ justifyContent: 'center' }}>
              Ready
            </span>
            <h2>下一个镜头，从这里开始</h2>
            <p>不需要显卡，不需要素材库，也不需要等排期。写下第一句话就够了。</p>
            <Link href="/studio" className="btn btn--primary btn--lg">
              免费开始创作 <Arrow width="16" height="16" />
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  );
}

function CanvasPreview() {
  const nodes = [
    { label: 'PROMPT', x: '5%', y: '10%', w: 138, text: '雨夜 · 霓虹 · 35mm', accent: true },
    { label: 'KEYFRAME', x: '43%', y: '6%', w: 158, img: '/work/work-3.webp' },
    { label: 'SHOT 01', x: '17%', y: '53%', w: 170, img: '/work/work-1.webp' },
    { label: 'SHOT 02', x: '55%', y: '49%', w: 160, img: '/work/work-4.webp' },
  ];

  return (
    <div className="canvas-preview" aria-hidden="true">
      <div className="canvas-preview__glow" />
      <div className="canvas-preview__grid" />
      {nodes.map((n) => (
        <div
          className="canvas-preview__node"
          key={n.label}
          style={{ left: n.x, top: n.y, width: n.w }}
        >
          <div className="canvas-preview__head">
            <span />
            {n.label}
          </div>
          {n.img ? (
            <img src={n.img} alt="" loading="lazy" />
          ) : (
            <div className={`canvas-preview__text${n.accent ? ' is-accent' : ''}`}>{n.text}</div>
          )}
        </div>
      ))}
      <svg className="canvas-preview__edges" viewBox="0 0 520 390" preserveAspectRatio="none">
        <defs>
          <marker id="cp-ar" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
            <path d="M0 0l6 3-6 3z" fill="rgba(216,255,59,.72)" />
          </marker>
        </defs>
        <path d="M180 56C215 56 222 60 230 62" stroke="rgba(216,255,59,.58)" fill="none" strokeWidth="1.2" markerEnd="url(#cp-ar)" />
        <path d="M246 92C246 132 190 140 160 160" stroke="rgba(216,255,59,.34)" fill="none" strokeWidth="1.2" strokeDasharray="4 4" />
        <path d="M300 92C300 140 360 150 370 178" stroke="rgba(255,255,255,.24)" fill="none" strokeWidth="1.2" />
        <path d="M160 244C160 290 300 300 372 280" stroke="rgba(216,255,59,.5)" fill="none" strokeWidth="1.2" markerEnd="url(#cp-ar)" />
      </svg>
      <span className="canvas-preview__caption mono">CANVAS / 4 NODES · 3 EDGES · AUTOSAVED</span>
    </div>
  );
}
