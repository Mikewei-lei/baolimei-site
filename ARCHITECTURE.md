# ARCHITECTURE — 葆历莓 BAOLIMEI

> 状态说明：**As-Is = 当前代码库真实实现**；**To-Be = 建议目标架构（尚未实施）**。
> 设计原则：增量升级、保留 Next.js、不删除现有页面与品牌资产、先闭环上线再做深水区。

---

## 1. As-Is 架构（已验证）

```
┌──────────────────────────── Browser ────────────────────────────┐
│  React 19 Client Components                                      │
│  ├─ StudioClient   （表单 + 轮询 + localStorage 历史）             │
│  ├─ CanvasClient   （节点/连线/缩放，localStorage 持久化）          │
│  └─ LibraryClient  （读取 localStorage 渲染作品库）                │
│                                                                  │
│  localStorage: blm_history_v1 / blm_canvas_v1 / blm_canvas_inbox_v1│
└───────────────┬──────────────────────────────────────────────────┘
                │ fetch (同源)
┌───────────────▼──────────────────────────────────────────────────┐
│  Next.js 15.5.28（Node 22，standalone，单进程）                    │
│  ├─ RSC / 静态页面：/ /pricing /about /library /legal/[slug]      │
│  ├─ 客户端工作区：/studio /canvas                                 │
│  └─ Route Handlers                                                │
│       POST /api/generate   → 生成任务（演示占位 / provider 适配）   │
│       GET  /api/generate   → 轮询任务状态                          │
│       GET  /api/health     → 健康检查                             │
│                                                                  │
│  进程内：rate-limit Map、liveJobs Map（真实通道任务，重启即丢）     │
└───────────────┬──────────────────────────────────────────────────┘
                │ 仅当 GENERATION_MOCK=0 且存在 Key
┌───────────────▼──────────────────────────────────────────────────┐
│  外部模型：fal.ai（Kling / Veo / Wan / FLUX）                     │
│           火山方舟（Seedance / Seedream）                          │
└──────────────────────────────────────────────────────────────────┘

部署现状：Windows 本机 :3000 ──► Cloudflare Quick Tunnel（临时公网）
         阿里云 ECS i-wz90…（CentOS 7.9，2C2G）状态未知，域名无解析
```

### 1.1 关键设计取舍（现有，建议保留）

| 决策 | 评价 |
| --- | --- |
| App Router + RSC | ✅ 营销页零 JS 可读、SEO 友好 |
| 无 UI 库，自定义 CSS tokens | ✅ 体积小、可控；需补组件规范 |
| 演示通道无状态（base64 SVG） | ✅ 适合 Serverless，便于演示 |
| 画布本地优先（localStorage） | ✅ 零后端也能演示；后续可平滑加云同步 |
| 单仓库单应用 | ✅ 现阶段合理，避免过早微服务 |

### 1.2 已识别的架构性缺陷

| ID | 缺陷 | 后果 |
| --- | --- | --- |
| P0-04 | 生成 API 无认证/配额 | 接入真实模型即被刷 |
| P0-07 | 无数据库/账号 | 无法运营、无法留存 |
| P1-07 | 任务状态存进程内存 | 重启/扩容丢任务 |
| P1-05 | 无对象存储 | 参考图、成片无法承载 |
| P1-08 | 无网关限流 | 单点被击穿 |
| P0-05 | 无审核链路 | 合规风险 |

---

## 2. To-Be 目标架构（分阶段落地）

```
                        ┌──────────────┐
        baolimei.cn ───►│ 阿里云 DNS    │
                        └──────┬───────┘
                               │ A / CNAME
                     ┌─────────▼──────────┐
                     │ WAF + CDN（可选）    │  静态资源、图片、视频
                     └─────────┬──────────┘
                               │
                     ┌─────────▼──────────┐
                     │ Nginx（443/TLS）    │  反代 / gzip / 长缓存 / HSTS
                     └─────────┬──────────┘
                               │ 127.0.0.1:3000
              ┌────────────────▼─────────────────┐
              │ Next.js（ECS，Docker，1..N 实例）  │
              │ RSC + Route Handlers             │
              └───┬───────────┬──────────────┬───┘
                  │           │              │
        ┌─────────▼──┐  ┌─────▼─────┐  ┌─────▼─────────┐
        │ PostgreSQL │  │  Redis    │  │ 阿里云 OSS     │
        │ (RDS)      │  │ 缓存/限流  │  │ 素材/成片/CDN  │
        └─────────┬──┘  └─────┬─────┘  └─────▲─────────┘
                  │           │              │
              ┌───▼───────────▼───┐   ┌──────┴────────┐
              │ Worker（独立进程）  │──►│ 模型 Provider  │
              │ 消费任务队列        │   │ fal / 方舟 ... │
              └───────────────────┘   └───────────────┘
                  │
        ┌─────────▼──────────┐   ┌──────────────────────┐
        │ 内容安全（阿里云）    │   │ Sentry + SLS + 告警   │
        └────────────────────┘   └──────────────────────┘
```

### 2.1 技术选型（建议，不做框架替换）

| 层 | 选型 | 理由 |
| --- | --- | --- |
| 前端 | 保持 Next.js 15 + React 19 | 现有代码可直接演进 |
| 语言 | 逐步引入 TypeScript（新文件优先 .ts/.tsx） | 降低线上事故；不强制一次性迁移 |
| 样式 | 保留 CSS tokens，抽 `components/ui/*` | 满足设计系统化，不引入重依赖 |
| 数据库 | PostgreSQL（阿里云 RDS 或 ECS 自建） | 事务、JSONB 存画布 |
| ORM | Prisma | 迁移/类型友好 |
| 缓存/限流 | Redis | 分布式限流、任务状态 |
| 队列 | BullMQ（Redis）或阿里云 MNS | 长任务异步化，支持重试 |
| 存储 | 阿里云 OSS + CDN | 图片/视频/上传 |
| 认证 | Auth.js（手机号验证码 / 微信登录） | 国内可用，避免密码体系 |
| 审核 | 阿里云内容安全（文本+图片）+ 人工复核台 | 合规必需 |
| 观测 | Sentry（错误）+ 阿里云 SLS（日志）+ 拨测 | 可定位、可告警 |
| 部署 | Docker on ECS；后续可迁 ACK | 与现有 Dockerfile 兼容 |
| CI/CD | GitHub Actions：lint → typecheck → test → build → deploy | 有验证才允许上线 |

### 2.2 服务边界（单仓多进程）

```
apps/web        Next.js（页面 + API）
packages/db     Prisma schema / migrations
packages/core   模型编排、计费、审核领域逻辑
apps/worker     队列消费者（独立容器）
```
> 现阶段仍可单仓；**不要**拆微服务，先用"一个镜像两种启动命令"（web / worker）。

---

## 3. 核心数据模型（目标）

```prisma
model User {
  id            String   @id @default(cuid())
  phone         String?  @unique
  email         String?  @unique
  name          String?
  avatarUrl     String?
  credits       Int      @default(60)
  role          Role     @default(USER)
  createdAt     DateTime @default(now())
  deletedAt     DateTime?
  projects      Project[]
  generations   Generation[]
  ledger        CreditLedger[]
}

model Project {
  id        String   @id @default(cuid())
  userId    String
  title     String
  coverUrl  String?
  canvas    Json?          // 节点/连线（版本化 JSON）
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id])
  assets    Asset[]
}

model Generation {
  id          String   @id @default(cuid())
  userId      String
  projectId   String?
  provider    String   // mock | fal | ark
  model       String
  prompt      Text
  params      Json     // ratio/duration/resolution/seed/style
  status      JobStatus @default(QUEUED)  // QUEUED RUNNING SUCCEEDED FAILED BLOCKED
  progress    Int      @default(0)
  error       String?
  costCredits Int      @default(0)
  providerJob String?  // 外部任务 ID
  startedAt   DateTime?
  finishedAt  DateTime?
  assets      Asset[]
  logs        Json?
  createdAt   DateTime @default(now())
  @@index([userId, createdAt])
  @@index([status])
}

model Asset {
  id           String   @id @default(cuid())
  userId       String
  generationId String?
  projectId    String?
  kind         AssetKind // IMAGE VIDEO AUDIO UPLOAD
  url          String    // OSS 地址
  posterUrl    String?
  width        Int?
  height       Int?
  durationMs   Int?
  bytes        BigInt?
  sha256       String?
  moderation   ModerationStatus @default(PENDING)
  createdAt    DateTime @default(now())
  @@index([userId, createdAt])
}

model CreditLedger {
  id        String   @id @default(cuid())
  userId    String
  delta     Int       // 正=充值，负=消耗
  reason    String    // subscribe | generate | refund | grant
  refId     String?
  balance   Int
  createdAt DateTime  @default(now())
  @@index([userId, createdAt])
}

model ModerationEvent {
  id        String   @id @default(cuid())
  userId    String?
  target    String   // generation | asset | upload
  targetId  String
  provider  String
  labels    Json
  decision  ModerationStatus
  createdAt DateTime @default(now())
}
```

### 3.1 画布数据格式（保持兼容现有 localStorage）

```json
{
  "v": 1,
  "nodes": [{ "id": "node_x", "type": "prompt|text|image|video|audio", "x": 0, "y": 0,
              "w": 260, "ratio": 1.777, "title": "PROMPT", "text": "...", "src": "https://..." }],
  "edges": [{ "id": "edge_x", "from": "node_a", "to": "node_b" }],
  "view": { "x": 0, "y": 0, "k": 1 },
  "updatedAt": 0
}
```
云端 `Project.canvas` 存同一结构，前端零迁移成本；本地草稿可"上传覆盖/下载合并"。

---

## 4. API 契约（目标 v1）

| 方法 | 路径 | 认证 | 说明 |
| --- | --- | --- | --- |
| POST | `/api/auth/sms/send` | 否 | 发送验证码（图形校验 + 频控） |
| POST | `/api/auth/sms/verify` | 否 | 登录/注册，返回 HttpOnly 会话 |
| GET | `/api/me` | 是 | 用户资料 + 积分余额 |
| POST | `/api/uploads/sign` | 是 | 获取 OSS 直传签名（限制大小/MIME） |
| POST | `/api/generations` | 是 | 创建任务：校验配额 → 审核 → 扣费 → 入队 |
| GET | `/api/generations/:id` | 是 | 查询状态（轮询或 SSE） |
| GET | `/api/generations/stream` | 是 | SSE 推送进度（长连接） |
| DELETE | `/api/generations/:id` | 是 | 取消/删除 |
| GET | `/api/projects` | 是 | 项目列表 |
| POST | `/api/projects` | 是 | 新建项目（含画布 JSON） |
| PATCH | `/api/projects/:id` | 是 | 保存画布（乐观锁 `updatedAt`） |
| POST | `/api/reports` | 可选 | 违规/侵权举报 |
| GET | `/api/health` | 否 | 存活/就绪（DB、Redis、OSS 探活） |

**统一错误结构**
```json
{ "error": { "code": "RATE_LIMITED", "message": "请求过于频繁", "requestId": "..." } }
```

**限额建议**
- 游客：不可生成（或 1 次/日，强 CAPTCHA）
- 登录用户：按套餐每分钟 N 次、每日积分上限
- 上传：≤ 20 MB，仅 image/jpeg|png|webp，服务端二次校验魔数 + 图像审核

---

## 5. 生成任务时序（目标）

```
Client            web                Redis/Queue        worker            Provider
  │  POST /gen     │                    │                 │                  │
  ├───────────────►│ 校验/审核/扣费       │                 │                  │
  │                ├─── INSERT(Generation QUEUED) ─────────►│                  │
  │                ├─── enqueue(job) ───►│                 │                  │
  │  202 {id}      │                    │                 │                  │
  │◄───────────────┤                    │                 │                  │
  │  SSE /poll     │                    │  dequeue        │                  │
  ├───────────────►│                    ├────────────────►│  submit          │
  │                │                    │                 ├─────────────────►│
  │                │                    │                 │  poll/webhook     │
  │                │                    │                 │◄─────────────────┤
  │                │  UPDATE SUCCEEDED  │                 │  上传 OSS/CDN     │
  │                │◄───────────────────┴─────────────────┤                  │
  │  progress/done │                    │                 │                  │
  │◄───────────────┤                    │                 │                  │
```

关键约束：
- 幂等：`Idempotency-Key` 防重复扣费
- 失败重试：最多 2 次，指数退避；失败自动退积分
- 超时：单任务 10 分钟，超时置 FAILED 并退款
- 审核不通过：置 `BLOCKED`，不扣费，记录 `ModerationEvent`

---

## 6. 安全架构（目标）

| 层 | 措施 |
| --- | --- |
| 网络 | 安全组仅开 22（限 IP）/80/443；应用仅监听 127.0.0.1 |
| TLS | 阿里云免费证书或 Let's Encrypt，TLS1.2+，HSTS preload 准备 |
| 应用 | CSP、`X-Frame-Options`、`Referrer-Policy`、`Permissions-Policy` |
| 认证 | HttpOnly + Secure + SameSite=Lax 会话；短信限频；登录风控 |
| 授权 | 资源级校验（generation/project 属于当前用户） |
| API | 网关限流 + Redis 分布式配额；请求体大小限制；统一错误码 |
| 上传 | 直传签名 + 大小/类型/魔数校验 + 内容审核 |
| 内容 | 文本审核 → 生成 → 图像/视频审核 → 可选人工复核 |
| 密钥 | 仅服务端环境变量/密钥管理，不进入前端 bundle |
| 审计 | 管理端操作留痕；用户举报与处置记录 |
| 数据 | 备份（RDS 自动备份 + OSS 版本）、删除请求 15 个工作日内处理 |

---

## 7. 部署拓扑（目标）

```
阿里云 VPC（杭州）
├─ ECS 2C2G（应用：web + worker + nginx + docker）
│   ├─ nginx :80/:443
│   ├─ web 127.0.0.1:3000
│   └─ worker（无端口）
├─ RDS PostgreSQL（1C2G 起步，自动备份 7 天）
├─ Redis（1G 起步，仅内网）
├─ OSS bucket（私有读 + CDN 回源签名）
└─ 安全组：22(限办公 IP) / 80 / 443
```

容量判断：2C2G 足以支撑"官网 + 内测用户"；生成任务受模型厂商限速，瓶颈不在本机。
当 QPS > 50 或任务积压 > 100 时再拆分/升配。

---

## 8. 迁移与兼容策略

1. **保留现有路由与组件**，新后端以 `/api/v2/*` 并行上线，灰度切换。
2. `localStorage` 继续可用：登录后提供"一键导入本机作品到云端"。
3. 画布 JSON 结构不变，云端只增 `projectId` 与版本号。
4. 旧演示模式保留为 `GENERATION_MOCK=1`，用于本地开发与演示，不计费。
5. 品牌 logo/色值/文案不改；视觉升级只动布局与组件，不动资产。

---

## 9. 待确认的架构决策（需要你拍板）

| # | 决策 | 选项 | 建议 |
| --- | --- | --- | --- |
| 1 | 账号方式 | 手机号 / 微信 / 邮箱 | 手机号 + 微信（国内转化最好） |
| 2 | 首批模型 | Seedance / 可灵 / Veo | Seedance（国内合规、价格可控）+ 可灵 |
| 3 | 是否自建 RDS | RDS vs ECS 自建 | 内测期 ECS 自建 + 每日备份，省成本；正式期迁 RDS |
| 4 | 支付 | 微信支付 / 支付宝 | 先做兑换码 + 对公，后接支付 |
| 5 | 对象存储 | 阿里云 OSS vs 七牛 | 阿里云 OSS（同 VPC 内网免流量） |
| 6 | 是否做多租户团队 | 个人 vs 团队 | 先个人，团队版跟随 Studio 套餐 |
