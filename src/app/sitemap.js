import { site } from '@/lib/site';
import { legalDocs } from '@/lib/legal';

export const dynamic = 'force-static';

export default function sitemap() {
  const base = site.url.replace(/\/$/, '');
  const now = new Date();

  const routes = [
    { url: '/', priority: 1, changeFrequency: 'weekly' },
    { url: '/studio', priority: 0.9, changeFrequency: 'weekly' },
    { url: '/canvas', priority: 0.9, changeFrequency: 'monthly' },
    { url: '/library', priority: 0.6, changeFrequency: 'monthly' },
    { url: '/pricing', priority: 0.8, changeFrequency: 'monthly' },
    { url: '/about', priority: 0.6, changeFrequency: 'yearly' },
    ...Object.keys(legalDocs).map((slug) => ({
      url: `/legal/${slug}`,
      priority: 0.3,
      changeFrequency: 'yearly',
    })),
  ];

  return routes.map((r) => ({
    url: `${base}${r.url === '/' ? '' : r.url}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
