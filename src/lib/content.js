export const features = [
  {
    id: 't2v',
    icon: 'video',
    title: '文生视频',
    desc: '用一段中文描述镜头语言、光线与情绪，数秒内得到 5–12 秒的电影级片段，支持 16:9 / 9:16 / 2.39:1。',
    href: '/studio',
    linkText: '去创作台',
  },
  {
    id: 'i2v',
    icon: 'image',
    title: '图生视频',
    desc: '上传关键帧或参考图，让画面动起来。首尾帧、运动笔刷与运镜方向都可精确控制。',
    href: '/studio?mode=image',
    linkText: '上传关键帧',
  },
  {
    id: 'canvas',
    icon: 'canvas',
    title: '无限画布',
    desc: '节点式创作空间：提示词、关键帧、镜头、配乐自由连接，像剪辑一样编排你的 AI 剧组。',
    href: '/canvas',
    linkText: '打开画布',
  },
  {
    id: 'consistency',
    icon: 'layers',
    title: '角色一致性',
    desc: '为一支片锁定同一张脸、同一套服装与同一种光，跨镜头保持角色稳定，不再换脸。',
    href: '/studio',
    linkText: '了解角色锁定',
  },
  {
    id: 'story',
    icon: 'film',
    title: '多镜头叙事',
    desc: '从一句故事梗概自动拆分分镜，生成镜头表与转场，支持一键串联成完整短片。',
    href: '/studio',
    linkText: '试试分镜',
  },
  {
    id: 'sound',
    icon: 'mic',
    title: '声音与配乐',
    desc: '对白、环境音与配乐同步生成，口型对齐，直接得到能交付的成片音轨。',
    href: '/pricing',
    linkText: '查看能力',
  },
];

export const steps = [
  {
    n: '01',
    title: '写下镜头',
    desc: '一句中文提示词，或者直接上传一张关键帧。系统自动补全光影、焦段与运动描述。',
  },
  {
    n: '02',
    title: '选模型，生成',
    desc: '在葆历莓自研 Cinema 与 Seedance、Kling、Veo 之间自由切换，按积分计费、随时重来。',
  },
  {
    n: '03',
    title: '上画布，成片',
    desc: '把镜头拖进无限画布，连线、排序、补配乐，导出可直接进入后期的成片与素材包。',
  },
];

export const showcase = [
  { src: '/shots/shot-1.svg', title: '霓虹之后', meta: 'Cinema 1 · 16:9 · 8s', wide: true },
  { src: '/shots/shot-2.svg', title: '荒原信号', meta: 'Seedance · 21:9 · 10s' },
  { src: '/shots/shot-3.svg', title: '第七夜', meta: 'Kling 2.1 · 2.39:1' },
  { src: '/shots/shot-4.svg', title: '青瓷', meta: 'Seedream · 1:1' },
  { src: '/shots/shot-5.svg', title: '折光', meta: 'Veo 3 Fast · 9:16' },
  { src: '/shots/shot-6.svg', title: '深潜', meta: 'Cinema 1 · 16:9 · 6s' },
  { src: '/shots/shot-7.svg', title: '春潮', meta: 'Wan 2.2 · 16:9' },
  { src: '/shots/shot-8.svg', title: '长夜将尽', meta: 'Cinema 1 · 2.39:1' },
  { src: '/shots/shot-9.svg', title: '雾中列车', meta: 'Seedance · 16:9' },
];

export const plans = [
  {
    name: 'Starter',
    cn: '体验版',
    price: '0',
    unit: '元 / 月',
    note: '含 60 点体验积分，够生成约 3 支短片',
    cta: '免费开始',
    href: '/studio',
    features: ['720p 生成', '标准队列', '作品库 30 天', '画布 3 个项目', '社区支持'],
  },
  {
    name: 'Creator',
    cn: '创作者',
    price: '99',
    unit: '元 / 月',
    note: '每月 1,200 积分，可加购积分包',
    cta: '开始订阅',
    href: '/studio',
    hot: true,
    features: [
      '1080p 生成',
      '优先队列（约 3× 速度）',
      '全部模型：Cinema / Seedance / Kling / Veo',
      '无限画布与分镜',
      '商用授权',
      '作品库永久保存',
    ],
  },
  {
    name: 'Studio',
    cn: '工作室',
    price: '699',
    unit: '元 / 月',
    note: '每月 9,000 积分，含 5 个协作席位',
    cta: '联系我们',
    href: '/about#contact',
    features: [
      '4K 放大与超分',
      '专属算力通道',
      '团队协作与素材共享',
      'API / 批量任务',
      '私有角色库',
      '专属客户成功',
    ],
  },
];

export const faqs = [
  {
    q: '葆历莓是什么？和普通的 AI 视频工具有什么不同？',
    a: '葆历莓是一套面向“作品”而非“片段”的 AI 影视创作系统：生成只是起点，真正的差异在无限画布——你可以把提示词、关键帧、镜头与配乐当作节点连接起来，像搭积木一样完成从分镜到成片的全部流程。',
  },
  {
    q: '现在可以使用吗？',
    a: '站点已上线内测。当前版本处于演示模式：生成流程、画布与作品库都可以完整体验，生成结果为占位画面，不会产生费用。正式模型通道开通后会第一时间在站内公告。',
  },
  {
    q: '支持哪些模型？',
    a: '自研 Baolimei Cinema 1，并接入 Seedance、Kling、Veo、Wan、FLUX、Seedream 等主流模型。你可以在创作台随时切换，按积分计费。',
  },
  {
    q: '生成的内容可以商用吗？',
    a: '在遵守《用户协议》与《内容规范》的前提下，付费套餐生成的内容可用于商业用途。请勿用于生成侵犯他人肖像权、著作权或违反法律法规的内容。',
  },
  {
    q: '我的作品和素材会被公开吗？',
    a: '默认不公开。作品仅你本人可见，除非你主动分享。我们不会将你的提示词与素材用于模型训练，详情见《隐私政策》。',
  },
  {
    q: '如何计费？积分怎么算？',
    a: '视频按模型与分辨率消耗积分：Cinema 1 约 20 点/条，Seedance 约 18 点/条，图片约 3–4 点/张。积分按月刷新，可单独加购，未用完的加购积分不清零。',
  },
];

export const trust = [
  'Baolimei Cinema 1',
  'Seedance 1.0 Pro',
  'Kling 2.1',
  'Veo 3',
  'Wan 2.2',
  'FLUX 1.1 Pro',
  'Seedream 4.0',
  'Runway Gen-4',
  'Luma Ray 2',
];
