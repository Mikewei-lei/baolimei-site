import { notFound } from 'next/navigation';
import Link from 'next/link';
import { legalDocs } from '@/lib/legal';
import { site } from '@/lib/site';

export function generateStaticParams() {
  return Object.keys(legalDocs).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const doc = legalDocs[slug];
  if (!doc) return { title: '页面不存在' };
  return {
    title: doc.title,
    description: `${site.name} ${doc.title}（更新于 ${doc.updated}）`,
    alternates: { canonical: `/legal/${slug}` },
  };
}

export default async function LegalPage({ params }) {
  const { slug } = await params;
  const doc = legalDocs[slug];
  if (!doc) notFound();

  return (
    <>
      <section className="page-head">
        <div className="container">
          <span className="eyebrow">Legal</span>
          <h1>{doc.title}</h1>
          <p className="mono" style={{ fontSize: 11, color: 'var(--muted-2)', marginTop: 14 }}>
            最近更新：{doc.updated} · 适用主体：{site.company}
          </p>
        </div>
      </section>

      <div className="container">
        <article className="prose">
          <p>{doc.intro}</p>

          {doc.sections.map((s) => (
            <section key={s.h2}>
              <h2>{s.h2}</h2>
              {(s.paras || []).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              {s.list ? (
                <ul>
                  {s.list.map((li) => (
                    <li key={li}>{li}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}

          <div className="note">
            本页面为平台规则公示文本，不构成法律意见。如你是企业客户或需要纸质盖章版本，请邮件联系{' '}
            <a href={`mailto:${site.email}`}>{site.email}</a> 获取。
          </div>

          <p style={{ marginTop: 30 }}>
            <Link href="/">← 返回首页</Link>
          </p>
        </article>
      </div>
    </>
  );
}
