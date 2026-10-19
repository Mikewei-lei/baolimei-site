import { site } from '@/lib/site';

export const dynamic = 'force-static';

export default function robots() {
  const base = site.url.replace(/\/$/, '');
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/canvas'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
