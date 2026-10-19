'use client';

import Link from 'next/link';

export default function ErrorPage({ error, reset }) {
  return (
    <div
      className="container"
      style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', textAlign: 'center' }}
    >
      <div>
        <div className="mono" style={{ color: 'var(--accent)', fontSize: 11, letterSpacing: '.22em' }}>
          SOMETHING BROKE
        </div>
        <h1 style={{ fontSize: 'clamp(1.8rem, 5vw, 2.8rem)', margin: '16px 0 10px', letterSpacing: '-.03em' }}>
          这一帧渲染失败了
        </h1>
        <p className="muted" style={{ marginBottom: 26, maxWidth: '46ch', marginInline: 'auto' }}>
          页面遇到了意外错误。你可以重试，或者回到首页继续浏览。如果反复出现，请把错误信息发给{' '}
          <a href="mailto:hello@baolimei.cn" style={{ color: 'var(--accent)' }}>
            hello@baolimei.cn
          </a>
          。
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn--primary" onClick={() => reset()}>
            重新加载
          </button>
          <Link href="/" className="btn btn--ghost">
            返回首页
          </Link>
        </div>
        {process.env.NODE_ENV !== 'production' && error?.message ? (
          <pre
            className="mono"
            style={{
              marginTop: 26,
              textAlign: 'left',
              fontSize: 11,
              color: 'var(--muted-2)',
              maxWidth: 640,
              overflow: 'auto',
              padding: 14,
              border: '1px solid var(--line)',
              borderRadius: 10,
            }}
          >
            {error.message}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
