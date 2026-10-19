import Link from 'next/link';
import PricingTable from '@/components/PricingTable';
import { site } from '@/lib/site';
import { faqs } from '@/lib/content';

export const metadata = {
  title: '价格',
  description: '葆历莓价格方案：体验版免费，创作者版 ¥99/月含 1200 积分，工作室版支持团队协作与 API。',
  alternates: { canonical: '/pricing' },
};

const credits = [
  ['Baolimei Cinema 1', '20 点 / 条', '5–10 秒 · 720p / 1080p'],
  ['Seedance 1.0 Pro', '18 点 / 条', '最长 12 秒 · 480p–1080p'],
  ['Kling 2.1', '22 点 / 条', '最长 10 秒 · 支持首尾帧'],
  ['Veo 3 Fast', '40 点 / 条', '8 秒 · 原生音效'],
  ['Wan 2.2', '8 点 / 条', '5 秒 · 风格化'],
  ['FLUX 1.1 Pro', '4 点 / 张', '1K / 2K 静帧'],
  ['Seedream 4.0', '3 点 / 张', '最高 4K'],
];

export default function PricingPage() {
  return (
    <>
      <section className="page-head">
        <div className="container">
          <span className="eyebrow">Pricing</span>
          <h1>简单、透明、<br />按作品计费</h1>
          <p className="lede">
            积分制计费，用多少扣多少。内测期间所有套餐功能免费体验，正式计费前 7 天站内公告。
          </p>
        </div>
      </section>

      <section className="container" style={{ padding: '48px 24px 20px' }}>
        <PricingTable />
        <p className="mono" style={{ fontSize: 10.5, color: 'var(--muted-2)', marginTop: 18 }}>
          * 价格含增值税普通发票。企业采购与对公转账请联系 {site.email}
        </p>
      </section>

      <section className="container" style={{ padding: '56px 24px 20px' }}>
        <span className="eyebrow">Credits</span>
        <h2 className="h2" style={{ fontSize: 26 }}>积分消耗表</h2>
        <div className="kv" style={{ marginTop: 24 }}>
          {credits.map(([name, cost, note]) => (
            <div key={name}>
              <span style={{ paddingTop: 3 }}>{name}</span>
              <span style={{ color: 'var(--text)' }}>{cost}</span>
              <span style={{ color: 'var(--muted-2)', minWidth: 180, textAlign: 'right' }}>{note}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="container" style={{ padding: '48px 24px 100px' }}>
        <div className="about-grid">
          <div>
            <span className="eyebrow">FAQ</span>
            <h2 className="h2" style={{ fontSize: 26 }}>计费相关问题</h2>
          </div>
          <div className="faq">
            {faqs.slice(5).map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
            <details>
              <summary>生成失败会扣积分吗？</summary>
              <p>不会。只有成功产出结果的任务才计费；失败任务自动返还积分。</p>
            </details>
            <details>
              <summary>支持退款吗？</summary>
              <p>未使用的订阅套餐可在购买后 7 天内申请全额退款。已消耗的积分不予退还。</p>
            </details>
          </div>
        </div>
        <div style={{ marginTop: 40 }}>
          <Link href="/studio" className="btn btn--primary">
            开始创作
          </Link>
        </div>
      </section>
    </>
  );
}
