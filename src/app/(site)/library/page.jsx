import Link from 'next/link';
import LibraryClient from '@/components/LibraryClient';
import { works } from '@/lib/works';

export const metadata = {
  title: '作品库',
  description: '查看你在葆历莓生成的全部镜头与短片，支持下载、加入画布与二次编辑。',
  alternates: { canonical: '/library' },
};

export default function LibraryPage() {
  return (
    <>
      <section className="page-head">
        <div className="container">
          <span className="eyebrow">Library</span>
          <h1>作品库</h1>
          <p className="lede">登录后，生成结果与上传素材会保存到云端数据库和对象存储；未登录时仍可使用浏览器本地演示模式。</p>
        </div>
      </section>

      <section className="container" style={{ padding: '36px 24px 90px' }}>
        <div className="library-brand">
          <div className="library-brand__head">
            <div>
              <span className="eyebrow">Curated</span>
              <h2>品牌样片</h2>
            </div>
            <Link href="/works" className="btn btn--ghost btn--sm">
              查看全部样片
            </Link>
          </div>
          <div className="library-brand__grid">
            {works.slice(0, 4).map((w) => (
              <Link href="/works" className="library-brand__item" key={w.id}>
                <img src={w.poster} alt={`${w.title} 画面`} loading="lazy" />
                <span>{w.title}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="library-mine">
          <div className="library-mine__head">
            <div>
              <span className="eyebrow">My Library</span>
              <h2>我的作品</h2>
            </div>
            <span className="mono">LOCAL STORAGE · THIS DEVICE</span>
          </div>
          <LibraryClient />
        </div>
        <div style={{ marginTop: 40, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/studio" className="btn btn--primary">
            继续创作
          </Link>
          <Link href="/canvas" className="btn btn--ghost">
            打开画布
          </Link>
        </div>
      </section>
    </>
  );
}
