import './globals.css';
import { site } from '@/lib/site';

export const metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} ${site.nameEn} · AI 影视创作平台`,
    template: `%s · ${site.name} ${site.nameEn}`,
  },
  description: site.description,
  applicationName: site.name,
  keywords: [
    '葆历莓',
    'BAOLIMEI',
    'AI 视频生成',
    '文生视频',
    '图生视频',
    'AI 影视',
    'AI 短片',
    '无限画布',
    'AI 分镜',
    '视频创作平台',
  ],
  authors: [{ name: site.company }],
  creator: site.company,
  publisher: site.company,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: site.url,
    siteName: `${site.name} ${site.nameEn}`,
    title: `${site.name} · 一句话，一支片`,
    description: site.description,
    images: [{ url: '/brand/og.jpg', width: 1200, height: 630, alt: `${site.name} ${site.nameEn}` }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${site.name} · 一句话，一支片`,
    description: site.description,
    images: ['/brand/og.jpg'],
  },
  icons: {
    icon: [{ url: '/icon.png', sizes: '64x64', type: 'image/png' }],
    apple: [{ url: '/apple-icon.png', sizes: '180x180' }],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#07080a',
  colorScheme: 'dark',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
