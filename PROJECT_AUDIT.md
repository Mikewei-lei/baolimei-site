# PROJECT_AUDIT — 葆历莓 BAOLIMEI 接管审计报告

- 审计对象：`D:\baolimei-site`（当前唯一代码库）
- 审计时间：2026-10-19
- 审计方式：静态代码阅读 + 本机生产构建 + 浏览器端自动化实测（Playwright/Chromium）+ 公共 DNS（阿里 DoH）查询 + 截图 OCR
- **本轮未修改任何应用代码**，只新增本报告与另外三份规划文档
- 审计人身份：Principal Full-Stack Engineer / Frontend Architect / DevOps

---

## 0. 结论先行（TL;DR）

| 维度 | 结论 |
| --- | --- |
| 域名打不开的**根因** | `baolimei.cn` 与 `www.baolimei.cn` **完全没有 A / AAAA / CNAME 记录**（阿里 DoH 权威结果），浏览器根本解析不到服务器。不是页面问题，也不是 Nginx 问题 |
| 第二重阻塞 | ICP 备案仍在管局审核；内地阿里云服务器在备案未通过前不能对公网提供 80/443 服务，且备案核验要求域名指向备案服务器 |
| 第三重阻塞 | 应用目前只跑在**你本机 Windows** 的 `0.0.0.0:3000`，公网只能通过临时 Cloudflare 隧道访问；ECS 上是否部署、是否有 Nginx/证书，**无法验证**（没有公网 IP 与 SSH） |
| 代码质量 | 前端完成度高、依赖极简、构建通过、全站 0 运行时错误；但**没有真实后端**：无数据库、无账号、无认证、无对象存储 |
| 产品真实度 | 生成 = 演示占位；画布 = 真实可用的本地节点编辑器；作品库 = 浏览器 localStorage |
| 上线合规 | 缺少内容审核、AI 生成内容标识、账号体系、举报通道、数据删除流程 —— 作为公开 AIGC 服务属于 P0 |
| 设计 | 现有视觉统一（黑 + 荧光绿 + 灰阶），但与新给的 3 张视觉参考仍有明显差距（信息密度、版式、动效、真实素材） |

**一句话：网站"做得出来"，但"打不开"是 DNS + 部署 + 备案三件事同时没闭环；而"能上线运营"还差后端与合规。**

---

## 1. 技术栈识别（已验证）

| 项目 | 实际情况 |
| --- | --- |
| 框架 | **Next.js 15.5.28**（App Router，`output: 'standalone'`，`compress: true`） |
| UI 运行时 | **React 19.1.1 / react-dom 19.1.1** |
| 语言 | **纯 JavaScript（.js / .jsx）**，无 TypeScript，无 `tsconfig.json` |
| 样式 | 单一 `src/app/globals.css`（约 2,300 行，自定义设计令牌），**无 Tailwind / CSS-in-JS / UI 组件库** |
| 图标 | 自绘内联 SVG（`src/components/Icons.jsx`，18 个） |
| 构建 | `npm run build`（Next 原生），产物 `.next` 约 126 MB；首屏 JS 103–113 kB |
| 运行时 | 本机 Node **v22.23.2**，npm 10.9.8；生产 `npm start`（`next start -p 3000`） |
| 依赖数量 | 仅 3 个直接依赖（next/react/react-dom），`node_modules` 顶层 19 个包 |
| 代码规模 | `src/app` 3,331 行 / `src/components` 1,879 行 / `src/lib` 861 行（含 CSS） |
| 包管理 | npm，`package-lock.json` 已提交 |

**判断：技术栈是干净、现代、轻量的，不存在需要"推倒重来"的历史包袱。建议保留 Next.js 增量升级，不做框架迁移。**

### 1.1 目录结构（实际）

```
src/app/
  (site)/            带 Header/Footer 的营销与内容页
    page.jsx         首页
    pricing/ library/ about/
    legal/[slug]/    4 篇法务（terms/privacy/content-policy/ai）
  (app)/             全屏工作区（无 Footer）
    studio/ canvas/
  api/generate/      生成任务（POST 创建 / GET 轮询）
  api/health/        健康检查
  layout.jsx globals.css robots.js sitemap.js not-found.jsx
src/components/      Header Footer StudioClient CanvasClient LibraryClient
                     PromptComposer PricingTable Icons
src/lib/             site models content legal mock providers store image
public/              brand/（logo 全套） shots/（9 张 SVG 占位镜头） 图标
deploy/              nginx.conf deploy.sh server-init.sh
scripts/             check-domain.mjs set-logo.py
Dockerfile docker-compose.yml README.md DEPLOY.md
```

---

## 2. 后端 / 数据 / 认证现状（已验证：**均不存在真实实现**）

| 能力 | 现状 | 真实性 |
| --- | --- | --- |
| HTTP API | `POST/GET /api/generate`、`GET /api/health` | ✅ 真实可调用 |
| 生成执行 | 默认**演示模式**：由提示词 + 种子确定性生成 SVG 占位画面并 base64 内联返回 | ⚠️ 演示 |
| 真实模型通道 | `src/lib/providers.js` 已写 fal.ai（Kling/Veo/Wan/FLUX）与火山方舟（Seedance/Seedream）适配器 | ⚠️ **未验证**（无 Key、无联调、无计费） |
| 数据库 | **无**。没有任何 ORM / SQL / KV 依赖 | ❌ 缺失 |
| 用户体系 | **无**。没有注册、登录、会话、权限 | ❌ 缺失 |
| 认证/鉴权 | **无**。`/api/generate` 对公网完全开放 | ❌ 缺失 |
| 对象存储 | **无**。参考图不发后端；生成结果以 data URI 返回 | ❌ 缺失 |
| 任务队列 | **无**。真实通道任务存在 Node 进程内存 `Map`，重启/多实例即丢 | ❌ 缺失 |
| 计费/积分 | 仅界面展示"预计消耗 x 积分"，**无账本、无扣费** | ⚠️ 演示 |
| 内容审核 | **无**。无关键词、无图像审核、无人工复核 | ❌ 缺失（合规 P0） |
| 日志/监控 | 仅容器 stdout；无 Sentry / SLS / 埋点 / 告警 | ❌ 缺失 |

### 2.1 数据存储（实测键名）

所有用户数据都在浏览器 `localStorage`：

| Key | 内容 | 上限 |
| --- | --- | --- |
| `blm_history_v1` | 生成记录（含 base64 图，约 4–6 KB/张） | 最近 24 个会话 |
| `blm_canvas_v1` | 画布节点 / 连线 / 视口 | 无显式上限，受 5 MB 配额约束 |
| `blm_canvas_inbox_v1` | "加入画布"暂存区 | 60 条 |

**风险**：清缓存、换设备、隐私模式 = 作品全部丢失；写入失败（配额超限）被静默吞掉，用户无感知（P1）。

---

## 3. 功能矩阵：真实可用 vs 前端演示

| 模块 | 功能 | 状态 | 说明 |
| --- | --- | --- | --- |
| 首页 | Hero、模型墙、能力卡、作品墙、画布预览、定价、FAQ、CTA | ✅ 真实 | SSR 输出，无 JS 也可读 |
| 创作台 | 模型选择、画幅/时长/分辨率/风格/数量/种子 | ✅ 真实（表单逻辑） | 参数会进入 API 并影响占位图 |
| 创作台 | 生成、进度轮询、结果卡片、下载 SVG、复制提示词 | ✅ 真实 | 演示占位；下载为 SVG |
| 创作台 | 参考图上传 | ⚠️ 仅预览 | 不上传、不存储、不参与生成（P1） |
| 创作台 | 历史记录 / 加入画布 | ✅ 本地真实 | localStorage |
| 创作台 | 真实视频播放、音轨、镜头时长控制 | ❌ 无 | 结果只有静态图 |
| 画布 | 节点增删、拖拽、改宽、复制、删除 | ✅ 真实 | 指针事件实现，实测通过 |
| 画布 | 端口连线、贝塞尔曲线、点击选中删除 | ✅ 真实 | 实测通过 |
| 画布 | 缩放（滚轮/按钮）、平移、适应视图、整理 | ✅ 真实 | 移动端无捏合缩放（P1） |
| 画布 | 自动保存 / 刷新恢复 / JSON 导入导出 | ✅ 真实 | 实测刷新后保留 |
| 画布 | 从作品库导入 | ✅ 真实 | 读取 inbox |
| 画布 | 撤销/重做、多选、对齐吸附、小地图、协作 | ❌ 无 | 与 Higgsfield 的差距（P2） |
| 作品库 | 列表、筛选、大图预览、下载、加入画布、删除 | ✅ 本地真实 | 仅本机数据 |
| 作品库 | 账号级云同步、分享链接 | ❌ 无 | P0/P1 |
| 定价 | 三档套餐、积分表 | ⚠️ 展示 | 无支付、无订阅 |
| 法务 | 用户协议 / 隐私政策 / 内容规范 / AI 说明 | ✅ 文本完整 | 主体名待替换为营业执照全称（P1） |
| 账号 | 注册/登录/找回/注销 | ❌ 无 | P0 |
| 举报 | 侵权/违规举报入口与工单 | ❌ 无 | 合规 P0 |

**结论：这是一个"高完成度的前端原型 + 可演示的生成链路"，不是可对外运营的产品。**

---

## 4. 质量审计（实测数据）

### 4.1 构建与运行时

| 检查项 | 结果 |
| --- | --- |
| `npm run build` | ✅ 通过，15 个路由全部预渲染 |
| 首屏 JS | 首页 2.14 kB / 108 kB；studio 7.22 kB / 113 kB；canvas 6.63 kB / 109 kB |
| 页面实测 | 9 条路由全部 200，未知路由正确 404 |
| 运行时错误 | 全站 **0** 个 pageerror / console error（仅测试脚本自身请求产生 1 条 404） |
| TTFB（本机） | 4–34 ms |
| 首页传输 | 24 个请求 / 354 KB / JS 128 KB（首访未压缩口径） |
| 外部依赖 | **0** 个第三方 CDN、0 个 webfont 请求（内地访问友好，无需科学上网） |

### 4.2 SEO

| 检查项 | 结果 |
| --- | --- |
| 每页 title / description | ✅ 全部独立 |
| title 模板 | ✅ `%s · 葆历莓 BAOLIMEI` |
| OG / Twitter Card | ✅ 有，`/brand/og.jpg` 1200×630 |
| `sitemap.xml` | ✅ 11 条 URL |
| `robots.txt` | ⚠️ 声明 `Disallow: /canvas`，但 sitemap 又包含 `/canvas`（P2 冲突） |
| **canonical** | ❌ **除法务页外，所有页面 canonical 都指向首页** `https://baolimei.cn`（`src/app/layout.jsx` 的 `alternates.canonical: '/'` 被全部继承）→ P1，会稀释收录 |
| H1 | ❌ `/studio`、`/canvas` 无 H1（P1） |
| 标题层级 | ⚠️ 页脚 `<h4>` 紧跟 `<h2>`，跳级（P2） |
| 结构化数据 | ⚠️ 仅首页 1 段 `Organization`，缺 `WebSite` / `SoftwareApplication` / `BreadcrumbList`（P2） |
| 404 页 | ✅ 有，但复用默认 title（P2） |

### 4.3 无障碍（a11y）

| 检查项 | 结果 |
| --- | --- |
| `<html lang>` | ✅ `zh-CN` |
| 图片 alt | ✅ 所有内容图片有 alt，装饰图为 `alt=""` |
| 按钮可访问名称 | ✅ 0 个无名按钮 |
| 输入框标签 | ⚠️ 画布节点内 2 个输入依赖 placeholder，无 `<label>`/`aria-label`（P2） |
| 表单占位符 | ✅ 创作台主要表单有 label 文本 |
| 键盘可达性 | ❌ **画布节点无法用键盘选择/移动/连线**；拖拽是唯一交互（P1） |
| 焦点样式 | ✅ 全局 `:focus-visible` 2px 荧光绿 |
| 弹窗 | ⚠️ 作品库弹窗无 `Escape` 关闭、无焦点锁定（P2） |
| 动态通知 | ⚠️ toast 无 `aria-live`，读屏不播报（P2） |
| 对比度 | ✅ 正文 18.3:1、次要文字 7.7:1、荧光绿 17.5:1；⚠️ `#6b7280` 小字 4.14:1 **低于 AA 4.5**（P2） |
| 动效偏好 | ✅ 支持 `prefers-reduced-motion` |

### 4.4 响应式（实测 390×844）

| 检查项 | 结果 |
| --- | --- |
| 横向溢出 | ✅ 0 px（首页 / 创作台 / 画布） |
| 移动导航 | ✅ 汉堡菜单，链接完整 |
| 创作台单列 | ✅ 面板 → 结果流式排列，按钮宽 350 px |
| 画布工具栏 | ⚠️ 移动端换行后高 **130 px（占屏 15%）**，挤压画布（P2） |
| 画布触控 | ⚠️ 单指拖拽/平移可用，**双指缩放未实现**（P1） |
| 断点 | 1080 / 900 / 620 三档，逻辑清晰 |

### 4.5 错误处理与韧性

| 检查项 | 结果 |
| --- | --- |
| `error.jsx` / `global-error.jsx` | ❌ **不存在**，任意渲染异常会掉到 Next 默认错误页（P1） |
| API 参数校验 | ⚠️ 空提示词 400 ✅；**非法 model 静默回退到第一个模型**；2000 字提示词静默截断到 900（P2） |
| 非法 JSON 请求体 | ⚠️ 返回 400，但错误文案是"请先描述你的镜头"（误导，P2） |
| 限流 | ⚠️ 进程内 Map，30 次 / 10 分钟 / IP；多实例失效、重启清零（P1） |
| localStorage 写失败 | ❌ 静默返回 false，UI 仍显示"已保存"（P1，数据丢失风险） |
| 生成超时 | ✅ 有 240 次轮询上限 |
| 刷新中断任务 | ✅ 会标记为"任务中断" |
| 网络断开 | ⚠️ 仅 toast，无重试队列 |

### 4.6 安全

| 检查项 | 结果 |
| --- | --- |
| 安全响应头 | ✅ `X-Content-Type-Options` / `X-Frame-Options: SAMEORIGIN` / `Referrer-Policy` / `Permissions-Policy` |
| HSTS | ⚠️ 仅 Nginx 模板里有，应用层无；本机/隧道场景不生效 |
| CSP | ❌ 缺失（P1） |
| 认证 | ❌ 无（P0） |
| CSRF | 无会话，暂不适用；接入账号后必须补 |
| 速率/配额/风控 | ⚠️ 仅进程内限流（P1） |
| 上传校验 | ⚠️ 前端 MIME + 6–12 MB 限制，无服务端校验（P1） |
| XSS | ✅ 用户内容作为文本渲染；`dangerouslySetInnerHTML` 仅用于静态 JSON-LD |
| 依赖漏洞 | ✅ 依赖极少；Next 已用 15.5.28（修复 CVE-2025-66478） |
| 密钥管理 | ✅ 无硬编码密钥；`.env` 未入库，`.env.example` 仅占位 |

### 4.7 工程化

| 检查项 | 结果 |
| --- | --- |
| 类型检查 | ❌ 纯 JS，无 TypeScript / JSDoc 约束（P1/P2） |
| Lint | ❌ 无 ESLint / Prettier 配置（P1） |
| 测试 | ❌ 0 个单元/E2E 测试（本次审计脚本在库外，未入库）（P1） |
| CI/CD | ❌ 无 GitHub Actions（P1） |
| Git | ✅ 4 次提交，工作区干净 |
| 依赖锁定 | ✅ lockfile 已提交；但 `next: ^15.5.28` 用 caret，构建不完全可复现（P2） |
| 文档 | ✅ README / DEPLOY / 部署脚本齐全；⚠️ README 中"已完成"表述需要与"演示/真实"区分（本轮已在审计中区分） |

---

## 5. 部署与基础设施审计

### 5.1 代码库内的部署资产

| 文件 | 作用 | 状态 |
| --- | --- | --- |
| `Dockerfile` | 三阶段构建，standalone 运行，非 root 用户 | ✅ 合理；**本机 Docker daemon 未运行，未实测构建** |
| `docker-compose.yml` | 单服务，127.0.0.1:3000，healthcheck，日志轮转 | ✅ 合理 |
| `deploy/nginx.conf` | 80→443、www→主域、反代、静态长缓存、HSTS、gzip | ⚠️ 模板，**未在服务器验证**；证书路径需替换 |
| `deploy/deploy.sh` | 构建 + 启动 + 健康检查 | ⚠️ 未实测 |
| `deploy/server-init.sh` | Ubuntu 22.04：swap / Docker（阿里镜像）/ Nginx / certbot / UFW | ⚠️ **目标机是 CentOS 7.9，脚本不适用**（P1） |
| `scripts/check-domain.mjs` | 绕过本地 DNS 劫持，查 DoH + HTTPS + 备案号 | ✅ 可用 |
| `scripts/set-logo.py` | logo 一键生成全尺寸资源 | ✅ 已实测 |

### 5.2 目标服务器（来自你提供的控制台截图，OCR）

| 项 | 值 |
| --- | --- |
| 实例 | `i-wz90w8ghm088swvfd2z7`（名称 `LHK-001`） |
| 规格 | 2 vCPU / 2 GiB（经济型 e） |
| 系统 | **CentOS 7.9 x64**，系统盘 20 GB（CentOS 7 已于 2024-06 EOL） |
| 私网 IP | `172.29.86.214` |
| 公网带宽 | 3 Mbps |
| VPC / vSwitch | `vpc-wz9k8yqrf5clli0r78mci` / `vsw-wz9j94plrmaft9qf6ssb9` |
| 到期 | 2027-04-08 |

**未知（无权限，未验证）**：公网 IP、SSH 端口/账号、安全组规则、是否已装 Nginx/Docker、80/443 是否有服务、是否存在证书、磁盘余量、是否有其他站点占用。

### 5.3 已验证事实 vs 未验证项

| 项目 | 结论 | 证据 |
| --- | --- | --- |
| `baolimei.cn` A 记录 | **不存在** | 阿里 DoH `dns.alidns.com` 权威应答：无 Answer，仅 SOA |
| `www.baolimei.cn` | **不存在**（NXDOMAIN） | 同上 |
| NS | `dns3/dns4.hichina.com` | DoH |
| 本机应用 | **运行中**，`0.0.0.0:3000`，健康检查 ok | `netstat` + `/api/health` |
| 本机 80/443 | **无监听**，未安装 Nginx | `netstat` + `which nginx` |
| 公网可达性 | 仅 Cloudflare 临时隧道可访问 | 实测 200 |
| ECS 公网连通 | **未验证** | 缺公网 IP / SSH |
| ECS 上的 Nginx/证书/应用 | **未验证** | 无访问权限 |
| ICP 备案状态 | 你口述"管局审核中" | **无官方查询结果，未验证** |
| 阿里云账号/DNS 操作权限 | 无 | 无 AccessKey |

> 本地 `nslookup` 会把域名解析到 `198.18.x.x`，这是 Clash TUN 的 fake-ip 劫持，**不能作为 DNS 证据**；本报告一律采用阿里 DoH 结果。

### 5.4 域名打不开的因果链

```
浏览器输入 baolimei.cn
   └─ DNS：无 A/AAAA 记录 ──► 解析失败（当前真正原因，100% 复现）
        └─ 即使加上 A 记录
             ├─ ICP 未下号 ──► 内地阿里云对 80/443 拦截 / 备案核验不通过
             └─ ECS 未部署或 Nginx/证书未配置 ──► 连接被拒 / 502 / 证书错误
```

---

## 6. 环境变量清单（仅名称与用途，无值）

| 变量 | 作用域 | 用途 | 当前 |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | 构建期 | canonical / sitemap / OG 域名 | 未设置，默认 `https://baolimei.cn` |
| `NEXT_PUBLIC_ICP_BEIAN` | 构建期 | 页脚备案号与外链 | 未设置，显示"备案中" |
| `NEXT_PUBLIC_PSB_BEIAN` | 构建期 | 公安网备号 | 未设置 |
| `NEXT_PUBLIC_COMPANY` | 构建期 | 页脚/法务运营主体 | 未设置，默认"流花"（占位） |
| `GENERATION_MOCK` | 运行时 | `0` 才尝试真实通道 | 未设置 = 演示模式 |
| `FAL_KEY` | 运行时 | fal.ai 模型通道 | 未设置 |
| `ARK_API_KEY` | 运行时 | 火山方舟（Seedance/Seedream） | 未设置 |
| `ARK_BASE_URL` | 运行时 | 方舟 API 基地址 | 有默认值 |
| `REPLICATE_API_TOKEN` | 运行时 | Replicate 通道 | 未设置 |

> 规则：`NEXT_PUBLIC_*` 在**构建时**注入，修改后必须重新构建；其余为运行时。仓库内无任何真实密钥。

---

## 7. 品牌与视觉资产审计

| 项 | 状态 |
| --- | --- |
| Logo 原图 | `public/brand/logo.png` 512×512（由 8000×8000 原图生成），另有 `logo-square.png` |
| 页头/页脚尺寸 | 32×32，`object-fit: contain`，荧光绿底块，白/深色图形 |
| Favicon | `favicon.ico` 16/32/48 + `icon.png` 64 + `apple-icon.png` 180 |
| OG 图 | `og.jpg` 1200×630，深色底 + logo + 品牌名 + slogan |
| 配色 | `--bg #07080a`、`--accent #d8ff3b`、文本 `#f3f5f1`、灰阶 `#9aa1a9 / #6b7280`，与品牌一致 |
| 字体 | 纯系统字体栈（Inter → PingFang SC → 微软雅黑），**无品牌字体文件**（P2） |
| 占位素材 | 9 张程序化 SVG 镜头（40 KB），**无真实视频/剧照**（P2，影响营销说服力） |
| 遗留文件 | `public/brand/logo.jpg`（旧版 18 KB，未被引用，P2 清理） |
| 你新给的 3 张图 | OCR 判定为**深色 + 荧光绿的 UI 视觉参考稿**（含"葆历莓 BAOLIMEI / AI 影视 / 每一位导演…"等文案），**不是报错截图**；目前尚未按此改版（本轮不动） |

---

## 8. 问题清单（按优先级）

### P0 — 阻断上线 / 合规红线

| ID | 问题 | 影响 | 证据 |
| --- | --- | --- | --- |
| P0-01 | 域名无任何 A/AAAA/CNAME 记录 | 域名 100% 打不开 | 阿里 DoH |
| P0-02 | 生产环境未部署/未验证（仅本机 + 临时隧道） | 关掉电脑即下线 | netstat / 隧道 |
| P0-03 | 无 TLS 证书、无 80/443 服务 | 无法提供 https，浏览器不安全提示 | 本机 80/443 无监听 |
| P0-04 | 生成 API 无认证、无配额、无限流持久化 | 一旦接真实模型 = 任意刷爆账单 | 代码审计 |
| P0-05 | 无内容审核、无 AI 生成标识策略、无举报通道 | 公开 AIGC 服务合规风险 | 代码审计 |
| P0-06 | ICP 未下号、页脚无真实备案号 | 内地服务器无法合法提供服务 | 页脚显示"备案中" |
| P0-07 | 无数据库/账号，作品仅存浏览器 | 数据丢失、无法运营 | 代码审计 |
| P0-08 | 无备份/回滚流程 | 违反"不得未备份覆盖"要求 | 文档缺失 |

### P1 — 上线前必须解决

| ID | 问题 |
| --- | --- |
| P1-01 | 所有子页 canonical 指向首页 |
| P1-02 | `/studio`、`/canvas` 缺 H1 |
| P1-03 | 无 `error.jsx` / `global-error.jsx` 错误边界 |
| P1-04 | 无 ESLint / TypeScript / 自动化测试 / CI |
| P1-05 | 参考图上传仅前端预览，无对象存储 |
| P1-06 | localStorage 写入失败静默，存在数据丢失 |
| P1-07 | 真实 Provider 适配器未联调；任务状态存内存 |
| P1-08 | 限流仅在进程内，无网关/WAF |
| P1-09 | 无 CSP、应用层无 HSTS |
| P1-10 | 画布键盘不可操作、移动端无捏合缩放 |
| P1-11 | 运营主体仍是"流花"占位，非法定全称 |
| P1-12 | 无账号注销、数据导出、隐私授权流程 |
| P1-13 | 无监控/日志聚合/告警 |
| P1-14 | 部署脚本面向 Ubuntu，与 CentOS 7.9 目标机不匹配 |

### P2 — 体验与工程优化

| ID | 问题 |
| --- | --- |
| P2-01 | 页脚标题层级跳级（h2→h4） |
| P2-02 | 导航缺 `aria-current` |
| P2-03 | 画布 2 个输入无显式标签 |
| P2-04 | robots 禁止 `/canvas` 但 sitemap 收录 |
| P2-05 | 非法 model 静默回退；坏 JSON 错误文案误导；提示词静默截断 |
| P2-06 | 结构化数据单一；404 页 title 复用默认 |
| P2-07 | 遗留 `logo.jpg`；OG 图未人工验收 |
| P2-08 | 无品牌字体/字号规范文档 |
| P2-09 | 画布无撤销、多选、吸附、小地图、协作 |
| P2-10 | 无 i18n（国际化定位 vs 纯中文现状） |
| P2-11 | 无 PWA / 离线 |
| P2-12 | 画布无虚拟化，超大节点图会掉帧 |
| P2-13 | `robots.txt` 的 `Host:` 非标准指令 |
| P2-14 | 展示素材均为 SVG 静帧，无真实视频演示 |

---

## 9. 产品差距（对标 Higgsfield）

| Higgsfield 能力 | 葆历莓现状 | 差距等级 |
| --- | --- | --- |
| 文生视频 / 图生视频 | 界面完整，执行是占位 | 后端 P0 |
| 运镜预设、首尾帧、运动笔刷 | 无 | P1 |
| 角色/风格一致性 | 文案有，功能无 | P1 |
| 多镜头叙事与自动分镜 | 无 | P2 |
| 无限画布 + 节点编排 | **已有且真实可用（本地）** | 接近 |
| 作品云库 / 项目 / 团队 | 无 | P0/P1 |
| 积分计费与订阅 | 仅展示 | P0（商业化） |
| 社区/灵感流 | 无 | P2 |
| 移动端体验 | 可看可用，画布体验弱 | P1 |

---

## 10. 审计结论与建议

1. **不要重写。** 现有代码结构清晰、依赖极少、性能好，适合作为长期基座。
2. **先解决"能打开"**：DNS → 服务器部署 → 备案 → 证书，四步闭环；其中 DNS 与备案是硬前置。
3. **再解决"能运营"**：认证 + 数据库 + 对象存储 + 任务队列 + 审核 + 计费。
4. **设计与功能并行升级**：按你给的 3 张视觉参考做增量改造（保留现有页面与品牌色值）。
5. **每一项改动都必须有可复现的验证命令**，不以"编译通过"作为完成标准。

## 11. 继续推进需要的授权/信息

| 需要 | 用途 | 优先级 |
| --- | --- | --- |
| ECS 公网 IP + SSH（端口/账号/密码或密钥） | 部署、Nginx、证书、验证 80/443 | P0 |
| 阿里云 AccessKey（限 DNS 权限）或你手动加解析 | 添加 A 记录、验证解析 | P0 |
| 备案号 + 营业执照全称 | 页脚/法务/结构化数据、合规 | P0 |
| 模型厂商 Key（Seedance / 可灵 / fal 等） | 真实生成联调与计费 | P1 |
| 是否允许更换系统盘为 Ubuntu 22.04 | 目标机 CentOS 7 已 EOL | P1 |
| 视觉稿的源文件（Figma/PSD/AI） | 像素级还原设计稿 | P2 |

---

## 附录 A：审计复现命令

```bash
# 1) 技术栈与依赖
node -v && npm -v && npm ls --depth=0

# 2) 构建
npm run build

# 3) 运行与健康
npm start &                 # :3000
curl -s localhost:3000/api/health

# 4) DNS（绕过本地 Clash fake-ip）
curl -s "https://dns.alidns.com/resolve?name=baolimei.cn&type=A"
curl -s "https://dns.alidns.com/resolve?name=www.baolimei.cn&type=A"

# 5) 端到端自检
node scripts/check-domain.mjs baolimei.cn

# 6) 浏览器审计（库外脚本）
node D:/blm-test/audit.js
```
