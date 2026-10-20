# 葆历莓 BAOLIMEI · baolimei.cn

AI 影视创作平台官网与创作工作台（对标 Higgsfield 的产品形态：文生视频 / 图生视频 / 节点式无限画布 / 作品库）。

- 技术栈：Next.js 15（App Router）+ React 19，零 UI 依赖，纯 CSS 设计系统
- 当前状态：**内测 · 云端账户 + 持久化画布 + 异步任务队列**（开发环境提供 Mock Provider；生产环境关闭虚假生成）
- 已完成：首页 / 创作台 / 无限画布 / 模型与工具 / 作品库 / 品牌样片 / 定价 / 关于 / 法务文本 / SEO / 健康检查
- 后端：手机号注册登录 / 短信验证码 / 服务端 Session / CSRF / PostgreSQL / 画布版本 / 素材对象存储 / 异步任务队列 / 审计日志
- 视觉：黑底 + 荧光绿 `#d8ff3b`，logo 资源未改动
- 账户：手机号 + 验证码 / 密码登录，Session 保存在服务端 PostgreSQL；未登录仍可进入本地演示模式
- 品牌样片：`public/work/`，来源为项目内部测试片与角色设定，上线前请确认素材授权
- 画布 3.0：基于 React Flow（MIT）的成熟节点画布：拖拽 / 缩放 / 平移 / 连线 / 多选 / 右键菜单 / 项目快照 / 节点异步生成 / 失败重试 / 模型节点 / 音频节点 / 云端素材库 / 节点大纲 / 移动端适配
- 后端文档：[docs/BACKEND.md](./docs/BACKEND.md)；API 文档：[docs/API.md](./docs/API.md)

## 本地运行

```bash
npm install
cp .env.example .env.local   # 配置 DATABASE_URL / AUTH_SECRET / STORAGE_SECRET
npm run db:migrate
npm run db:seed
npm run dev                  # http://localhost:3000，同时启动任务 Worker
npm run build && npm start   # 生产模式
npm run test:api             # 后端 API + 数据库 E2E
```

## 目录结构

```
src/app/
  (site)/            带页头页脚的站点页面
    page.jsx         首页
    pricing/         定价
    library/         作品库（品牌样片 + 本地作品）
    models/          模型与工具
    works/           品牌样片
    about/           关于我们
    legal/[slug]/    用户协议 / 隐私政策 / 内容规范 / AI 生成内容说明
  (app)/             全屏应用页（无页脚）
    studio/          创作台
    canvas/          无限画布
  api/auth/          注册、验证码、登录、会话、资料、注销
  api/projects/      项目 CRUD
  api/canvases/      画布保存、版本历史、恢复
  api/assets/        预签名上传、素材列表、签名下载、删除
  api/jobs/          AI 任务创建、查询、取消、重试
  api/health/        健康检查（数据库 / 存储 / Worker）
  canvas.css         画布 3.0（React Flow + 自定义节点）样式
  sitemap.js robots.js not-found.jsx
src/components/      Header / Footer / StudioClient / CanvasFlow / AccountClient / LibraryClient ...
                      CanvasFlow 使用 React Flow（@xyflow/react，MIT）
  canvas/           画布项目快照、快捷键弹窗
  ui/               通用 Dialog
src/lib/assets.js   IndexedDB 媒体素材存储（未登录本地模式）
src/lib/server/      后端：DB / Auth / 画布 / 素材 / 任务 / 存储 / 安全
src/lib/             site 配置、模型目录、内容文案、法务文本、Provider 适配
drizzle/             PostgreSQL 迁移文件
docs/                BACKEND.md / API.md
public/              logo、favicon、og 图、品牌样片（public/work）
deploy/              nginx.conf、deploy.sh
Dockerfile           多阶段构建（standalone 输出）
docker-compose.yml
scripts/e2e.py       本地端到端冒烟测试（登录、生成、画布持久化、移动端）
scripts/perf.py      LCP / CLS / 传输体积检查
scripts/screenshots.py 生成桌面与移动端截图（输出到 .shots/）
scripts/check_drag.py React Flow 节点拖拽 / 缩放 / 连线冒烟测试
scripts/backend-e2e.mjs 后端 API + 数据库端到端测试
scripts/account_e2e.py 账户中心浏览器测试
scripts/backup.sh    数据库 + 素材卷备份
scripts/restore.sh   数据库 + 素材卷恢复
scripts/purge-accounts.ts 过期注销账户清理
```

## 环境变量

复制 `.env.example` 为 `.env`（或 Vercel 项目设置里配置）：

| 变量 | 说明 |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | 正式域名，用于 canonical / sitemap / OG |
| `NEXT_PUBLIC_ICP_BEIAN` | 备案号，填了之后页脚自动带 `beian.miit.gov.cn` 外链 |
| `NEXT_PUBLIC_PSB_BEIAN` | 公安网备号（可选） |
| `NEXT_PUBLIC_COMPANY` | 运营主体名称 |
| `APP_ENV` | `development` / `staging` / `production` |
| `DATABASE_URL` | PostgreSQL 连接串（开发库与生产库必须分离） |
| `REDIS_URL` | Redis 连接串，用于限流；不可用时降级内存 |
| `AUTH_SECRET` / `STORAGE_SECRET` | 至少 32 字符的密钥 |
| `COOKIE_SECURE` | HTTPS 环境设为 `true` |
| `ALLOWED_ORIGINS` | 允许的站点 Origin，逗号分隔 |
| `STORAGE_DRIVER` / `DATA_DIR` | `local` 本地对象卷，或 `s3` |
| `S3_*` | S3 / OSS 兼容对象存储配置 |
| `SMS_PROVIDER` / `SMS_HTTP_*` | 短信 Provider；生产使用 `http` 网关 |
| `WORKER_ENABLED` | 是否在应用进程内启动数据库任务 Worker |
| `MOCK_GENERATION_ENABLED` | 仅开发环境允许 `1`；生产必须 `0` |
| `FAL_KEY` / `ARK_API_KEY` / `REPLICATE_API_TOKEN` | 真实模型通道密钥 |

> `NEXT_PUBLIC_*` 变量在**构建时**注入，修改后必须重新构建。

## 生成通道与队列

- `POST /api/jobs` 创建任务，Worker 从 PostgreSQL `generation_jobs` 表领取任务。
- 开发环境可使用 `mock` Provider，结果会明确标记为演示素材。
- 生产环境 `MOCK_GENERATION_ENABLED=0`，没有配置真实 Provider 时任务会明确失败，不会伪造结果。
- 真实 Provider 支持 fal.ai / 火山方舟；结果下载后写入对象存储，并回写任务和画布节点。
- 详细状态机与重试/取消机制见 [docs/BACKEND.md](./docs/BACKEND.md)。

## 数据存储

- 正式数据：PostgreSQL（用户、项目、画布、节点、版本、素材元数据、任务、审计）。
- 文件：本地对象卷（`DATA_DIR/assets`）或 S3 兼容对象存储；不写入 PostgreSQL。
- `localStorage` 仅作为未登录本地演示模式和断线草稿缓存，不作为正式数据库。
- 上传、项目、画布、任务均经过服务端权限校验。

## 更换 LOGO

```bash
python scripts/set-logo.py "D:\path\to\logo.png"
npm run build && npm start
```

脚本会自动裁掉白底/透明留白，生成 `logo.png`、`logo-square.png`、`icon.png`、`apple-icon.png`、
`favicon.ico` 与 1200×630 的 `og.jpg`（深色底 + 品牌名）。原图建议用透明底 PNG 或 SVG 导出的 PNG。

## 部署

- 当前生产部署状态与验证证据：[DEPLOYED.md](./DEPLOYED.md)
- 通用部署手册（DNS、备案、HTTPS、Nginx、Docker、Vercel）：[DEPLOY.md](./DEPLOY.md)
- 目标部署检查清单：[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)
