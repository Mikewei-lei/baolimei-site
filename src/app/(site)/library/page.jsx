import Link from 'next/link';
import LibraryClient from '@/components/LibraryClient';

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
          <p className="lede">所有生成结果自动归档。内测阶段数据保存在你的浏览器本地，换设备不会同步。</p>
        </div>
      </section>

      <section className="container" style={{ padding: '36px 24px 90px' }}>
        <LibraryClient />
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
