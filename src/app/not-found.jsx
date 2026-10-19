import Link from 'next/link';

export default function NotFound() {
  return (
    <div
      className="container"
      style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', textAlign: 'center' }}
    >
      <div>
        <div className="mono" style={{ color: 'var(--accent)', fontSize: 12, letterSpacing: '.2em' }}>
          ERROR 404
        </div>
        <h1 style={{ fontSize: 'clamp(2rem, 6vw, 3.4rem)', letterSpacing: '-.04em', margin: '16px 0 10px' }}>
          这个镜头被剪掉了
        </h1>
        <p className="muted" style={{ marginBottom: 28 }}>
          页面不存在或已移动。
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/" className="btn btn--primary">
            返回首页
          </Link>
          <Link href="/studio" className="btn btn--ghost">
            去创作台
          </Link>
        </div>
      </div>
    </div>
  );
}
