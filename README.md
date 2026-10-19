# 葆历莓 BAOLIMEI · baolimei.cn

AI 影视创作平台官网与创作工作台（对标 Higgsfield 的产品形态：文生视频 / 图生视频 / 节点式无限画布 / 作品库）。

- 技术栈：Next.js 15（App Router）+ React 19，零 UI 依赖，纯 CSS 设计系统
- 当前状态：**内测 · 演示模式**（生成流程完整可用，返回占位画面，不产生模型费用）
- 已完成：首页 / 创作台 / 无限画布 / 作品库 / 价格 / 关于 / 4 篇法务文本 / SEO / 健康检查 / 占位生成 API
- 视觉：黑底 + 荧光绿 `#d8ff3b`，logo 取自 `图二是否侵权判断 (3).jpg`

## 本地运行

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start   # 生产模式
```

## 目录结构

```
src/app/
  (site)/            带页头页脚的站点页面
    page.jsx         首页
    pricing/         价格
    library/         作品库
    about/           关于我们
    legal/[slug]/    用户协议 / 隐私政策 / 内容规范 / AI 生成内容说明
  (app)/             全屏应用页（无页脚）
    studio/          创作台
    canvas/          无限画布
  api/generate/      生成任务接口（POST 创建、GET 轮询）
  api/health/        健康检查（部署探针用）
  sitemap.js robots.js not-found.jsx
src/components/      Header / Footer / StudioClient / CanvasClient / LibraryClient ...
src/lib/             site 配置、模型目录、内容文案、法务文本、演示占位图、Provider 适配
public/              logo、favicon、og 图、9 张占位镜头
deploy/              nginx.conf、deploy.sh
Dockerfile           多阶段构建（standalone 输出）
docker-compose.yml
```

## 环境变量

复制 `.env.example` 为 `.env`（或 Vercel 项目设置里配置）：

| 变量 | 说明 |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | 正式域名，用于 canonical / sitemap / OG |
| `NEXT_PUBLIC_ICP_BEIAN` | 备案号，填了之后页脚自动带 `beian.miit.gov.cn` 外链 |
| `NEXT_PUBLIC_PSB_BEIAN` | 公安网备号（可选） |
| `NEXT_PUBLIC_COMPANY` | 运营主体名称 |
| `GENERATION_MOCK` | `1` = 演示模式（默认）；`0` = 尝试真实模型通道 |
| `FAL_KEY` / `ARK_API_KEY` / `REPLICATE_API_TOKEN` | 对应厂商密钥，配合 `GENERATION_MOCK=0` 生效 |

> `NEXT_PUBLIC_*` 变量在**构建时**注入，修改后必须重新构建。

## 生成通道

- 默认走 `src/lib/mock.js`：按「提示词 + 种子 + 风格」确定性地画出占位画面，接口无状态、可部署在 Serverless。
- 配好 Key 且 `GENERATION_MOCK=0` 后，`src/lib/providers.js` 会调用 fal.ai（Kling / Veo / Wan / FLUX）或火山方舟（Seedance / Seedream 同步接口）。
  真实任务状态存在进程内存，建议部署在常驻进程（ECS / Docker）；Serverless 冷启动会丢任务。
- 上传参考图目前只在前端预览；接真实模型时需要对象存储（OSS）换取公网 URL，属于下一阶段工作。

## 数据存储

内测版本**没有数据库**：作品库与画布项目保存在浏览器 `localStorage`，换设备/清缓存会丢失。
正式上线前需要接入账号体系与对象存储（建议：阿里云 OSS + RDS/Redis，或 Supabase）。

## 更换 LOGO

```bash
python scripts/set-logo.py "D:\path\to\logo.png"
npm run build && npm start
```

脚本会自动裁掉白底/透明留白，生成 `logo.png`、`logo-square.png`、`icon.png`、`apple-icon.png`、
`favicon.ico` 与 1200×630 的 `og.jpg`（深色底 + 品牌名）。原图建议用透明底 PNG 或 SVG 导出的 PNG。

## 部署

见 [DEPLOY.md](./DEPLOY.md)，包含 DNS、备案、HTTPS、Nginx、Docker、Vercel 的全部步骤与注意事项。
