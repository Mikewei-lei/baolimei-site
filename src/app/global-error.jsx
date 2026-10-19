'use client';

export default function GlobalError({ error, reset }) {
  return (
    <html lang="zh-CN">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: '#07080a',
          color: '#f3f5f1',
          fontFamily: "'PingFang SC','Microsoft YaHei',system-ui,sans-serif",
          textAlign: 'center',
          padding: 24,
        }}
      >
        <div>
          <div style={{ color: '#d8ff3b', fontSize: 11, letterSpacing: '.22em', fontFamily: 'monospace' }}>
            FATAL ERROR
          </div>
          <h1 style={{ fontSize: 'clamp(1.6rem, 5vw, 2.4rem)', margin: '16px 0 10px' }}>站点暂时无法启动</h1>
          <p style={{ color: '#9aa1a9', fontSize: 14, marginBottom: 24 }}>
            请稍后刷新。如果持续出现，请联系 hello@baolimei.cn。
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              height: 42,
              padding: '0 22px',
              borderRadius: 999,
              border: 0,
              background: '#d8ff3b',
              color: '#0a0c05',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            重新加载
          </button>
          {process.env.NODE_ENV !== 'production' && error?.message ? (
            <pre style={{ marginTop: 20, color: '#7f8794', fontSize: 11, whiteSpace: 'pre-wrap' }}>
              {error.message}
            </pre>
          ) : null}
        </div>
      </body>
    </html>
  );
}
