export const site = {
  name: '葆历莓',
  nameEn: 'BAOLIMEI',
  slogan: '一句话，一支片',
  description:
    '葆历莓 BAOLIMEI 是面向创作者的 AI 影视创作平台：文生视频、图生视频、多镜头叙事与节点式无限画布，把灵感直接变成可交付的镜头。',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://baolimei.cn',
  icp: process.env.NEXT_PUBLIC_ICP_BEIAN || '备案中',
  psb: process.env.NEXT_PUBLIC_PSB_BEIAN || '',
  company: process.env.NEXT_PUBLIC_COMPANY || '葆历莓（北京）科技有限公司',
  email: 'hello@baolimei.cn',
  copyright: `© ${new Date().getFullYear()} 葆历莓 BAOLIMEI`,
};

export const nav = [
  { href: '/studio', label: '创作台' },
  { href: '/canvas', label: '画布' },
  { href: '/library', label: '作品库' },
  { href: '/pricing', label: '价格' },
  { href: '/about', label: '关于' },
];
