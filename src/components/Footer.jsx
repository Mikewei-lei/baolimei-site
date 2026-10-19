import Link from 'next/link';
import { site } from '@/lib/site';

const groups = [
  {
    title: '产品',
    links: [
      { href: '/studio', label: '创作台' },
      { href: '/canvas', label: '无限画布' },
      { href: '/library', label: '作品库' },
      { href: '/pricing', label: '价格与积分' },
    ],
  },
  {
    title: '公司',
    links: [
      { href: '/about', label: '关于我们' },
      { href: '/about#contact', label: '联系我们' },
      { href: '/legal/content-policy', label: '内容规范' },
    ],
  },
  {
    title: '法律',
    links: [
      { href: '/legal/terms', label: '用户协议' },
      { href: '/legal/privacy', label: '隐私政策' },
      { href: '/legal/ai', label: 'AI 生成内容说明' },
    ],
  },
];

const beianHref = 'https://beian.miit.gov.cn/';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          <div>
            <Link href="/" className="brand">
              <img className="brand__mark" src="/brand/logo.png" alt={`${site.name} logo`} width="32" height="32" />
              <span className="brand__text">
                <span className="brand__cn">{site.name}</span>
                <span className="brand__en">{site.nameEn}</span>
              </span>
            </Link>
            <p className="footer__desc">
              AI 影视创作平台。把一句话变成镜头，把镜头连成一支片。面向导演、广告人与独立创作者。
            </p>
            <p className="footer__desc" style={{ marginTop: 12 }}>
              <a href={`mailto:${site.email}`}>{site.email}</a>
            </p>
          </div>

          {groups.map((g) => (
            <div key={g.title}>
              <h4>{g.title}</h4>
              <ul>
                {g.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="footer__bottom">
          <span>
            {site.copyright} · {site.company}
          </span>
          <div className="footer__legal">
            <a href={beianHref} target="_blank" rel="noopener noreferrer nofollow">
              {/^[0-9]/.test(site.icp) ? site.icp : `ICP 备案：${site.icp}`}
            </a>
            {site.psb ? (
              <a
                href="https://beian.mps.gov.cn/"
                target="_blank"
                rel="noopener noreferrer nofollow"
              >
                {site.psb}
              </a>
            ) : null}
            <Link href="/legal/terms">服务条款</Link>
            <Link href="/legal/privacy">隐私政策</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
