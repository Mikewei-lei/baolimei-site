import Link from 'next/link';
import { site } from '@/lib/site';

export const metadata = {
  title: '关于我们',
  description: '葆历莓 BAOLIMEI 是一支由影视创作者与 AI 工程师组成的团队，致力于把生成式 AI 变成真正可用的影视生产工具。',
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <>
      <section className="page-head">
        <div className="container">
          <span className="eyebrow">About</span>
          <h1>我们相信，<br />镜头应该服从想象力</h1>
          <p className="lede">
            葆历莓（BAOLIMEI）是一个 AI 影视创作平台。我们不满足于“生成一段看起来不错的视频”——
            我们要的是能进片场、能交付、能被观众记住的作品。
          </p>
        </div>
      </section>

      <section className="container" style={{ padding: '60px 24px 20px' }}>
        <div className="about-grid">
          <div>
            <h2 className="h2" style={{ fontSize: 24 }}>从“片段”到“作品”</h2>
            <p className="lede" style={{ marginTop: 14 }}>
              大多数 AI 视频工具止步于一次生成：你得到一个 5 秒的镜头，然后呢？葆历莓把重心放在生成之后——
              无限画布让你把提示词、关键帧、镜头和声音组织成结构，像真正的剪辑台一样反复打磨。
            </p>
            <p className="lede" style={{ marginTop: 14 }}>
              我们与全球主流模型并行：自研 Cinema 系列负责电影感与角色一致性，
              同时接入 Seedance、Kling、Veo、Wan 等通道，让创作者按镜头需求自由选择，而不是被单一模型绑死。
            </p>

            <h2 className="h2" style={{ fontSize: 24, marginTop: 42 }}>在做什么、不做什么</h2>
            <ul className="lede" style={{ paddingLeft: 18, marginTop: 14 }}>
              <li>做工具，不做内容农场：不批量生产同质化短视频。</li>
              <li>尊重版权与肖像权：内置内容规范与投诉通道，违规内容一律下架。</li>
              <li>默认保护隐私：作品不公开、提示词不用于训练。</li>
            </ul>
          </div>

          <div>
            <div className="kv">
              <div>
                <span>品牌</span>
                <span>{site.name} {site.nameEn}</span>
              </div>
              <div>
                <span>主体</span>
                <span>{site.company}</span>
              </div>
              <div>
                <span>邮箱</span>
                <span>
                  <a href={`mailto:${site.email}`} style={{ color: 'var(--accent)' }}>
                    {site.email}
                  </a>
                </span>
              </div>
              <div>
                <span>备案</span>
                <span>{/^[0-9]/.test(site.icp) ? site.icp : 'ICP 备案办理中'}</span>
              </div>
              <div>
                <span>状态</span>
                <span>内测 · 演示模式</span>
              </div>
              <div>
                <span>域名</span>
                <span>baolimei.cn</span>
              </div>
            </div>

            <div id="contact" style={{ marginTop: 28, padding: 22, border: '1px solid var(--line)', borderRadius: 14 }}>
              <div className="eyebrow" style={{ marginBottom: 10 }}>Contact</div>
              <p style={{ margin: 0, fontSize: 13.5, color: 'var(--muted)' }}>
                商务合作、媒体采访、内容投诉，都可以直接写信：
                <br />
                <a href={`mailto:${site.email}`} style={{ color: 'var(--accent)' }}>
                  {site.email}
                </a>
                <br />
                我们通常在 1 个工作日内回复。
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="container" style={{ padding: '52px 24px 90px' }}>
        <div className="cta">
          <h2>来拍第一个镜头</h2>
          <p>内测期间免费体验完整创作流程，不需要信用卡。</p>
          <Link href="/studio" className="btn btn--primary btn--lg">
            进入创作台
          </Link>
        </div>
      </section>
    </>
  );
}
