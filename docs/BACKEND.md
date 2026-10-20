# BAOLIMEI 后端架构（Task 3）

## 1. 技术栈审计与选择

现有项目是 Next.js 15 App Router + React 19，前端、API Route、构建与部署已经统一在一套 Node 进程里。没有独立后端，也没有数据库。

因此没有引入 NestJS 另起一套服务，而是沿用 Next.js 的 Node Runtime Route Handlers，原因：

- 不破坏现有前端、部署目录和 Nginx 反代。
- 同一个 Node 进程即可提供页面与 API，适合 2C2G 单机。
- 后续需要拆服务时，`src/lib/server/*` 可以平移到 NestJS/独立 Node 服务。

最终选择：

| 层 | 选择 | 原因 |
| --- | --- | --- |
| API | Next.js 15 Route Handlers | 沿用现有技术栈，零额外服务 |
| 语言 | TypeScript | 后端模块强类型、Zod 校验 |
| 数据库 | PostgreSQL 15 | JSONB 快照、事务、行锁、`SKIP LOCKED` 队列 |
| ORM / 查询 | Drizzle ORM | 类型安全 SQL、迁移可审计、无 Prisma 原生引擎，适配老服务器 |
| 缓存 / 限流 | Redis | 认证、上传、任务接口限流；Redis 不可用时自动降级到内存 |
| 文件 | 本地对象卷 / S3 兼容适配器 | 开发用本地卷；生产可切 S3 / OSS，文件不进 PostgreSQL |
| 异步任务 | PostgreSQL 任务表 + 独立 Worker 循环 | 事务领取、`FOR UPDATE SKIP LOCKED`、失败重试、取消、崩溃恢复 |
| 短信 | Provider 抽象 | 开发 console；生产阿里云短信（签名：广州流花科技）或 HTTP 网关 |

## 2. 目录结构

```
src/app/api/
  auth/                 request-code, register, login, logout, me, refresh,
                        profile, password, sessions, account
  projects/             项目 CRUD
  canvases/             画布读取/保存、版本历史、恢复
  assets/               预签名上传、完成、列表、签名下载、删除
  jobs/                 AI 任务创建、查询、取消、重试
src/lib/server/
  env.ts                环境变量
  db.ts                 pg Pool + Drizzle
  schema.ts             数据库表
  auth.ts               会话、验证码、Cookie、CSRF、注销
  crypto.ts             scrypt、HMAC、Token、手机号脱敏
  http.ts               API 包装、错误、Origin、Zod
  rate-limit.ts         Redis / 内存限流
  sms.ts                短信 Provider
  projects.ts           项目业务
  canvas.ts             画布事务保存、版本、冲突检测
  assets.ts             素材业务、引用关系
  jobs.ts               任务状态机、队列领取、重试
  jobs/worker.ts        Worker（Mock / fal / ark）
  storage.ts            本地卷 + S3 适配器
  seed.ts               model_providers 初始化
drizzle/                SQL 迁移文件
scripts/backend-e2e.mjs API + DB 端到端测试
scripts/frontend-backend-e2e.py 浏览器全栈测试
```

## 3. 数据库

核心表：

`users`、`user_sessions`、`verification_challenges`、`projects`、`canvases`、`canvas_versions`、`nodes`、`edges`、`assets`、`asset_references`、`generation_jobs`、`model_providers`、`usage_records`、`audit_logs`。

关键设计：

- 手机号唯一索引 `users_phone_uq`。
- Session 只存 SHA-256 Token 摘要，不存明文 Token。
- 验证码只存 HMAC 摘要，5 分钟过期，最多 5 次尝试。
- 画布当前图存 `canvases.data(JSONB)`，同时写入 `nodes` / `edges` 便于引用关系和查询。
- `nodes` 使用 `(canvas_id, id)` 复合主键，允许不同项目复用节点 ID。
- `edges` 通过 `(canvas_id, source_id/target_id)` 复合外键指向节点。
- `canvas_versions` 保存快照，最多保留 50 个版本。
- `assets` 存对象存储 key，不存文件二进制。
- `asset_references` 维护素材与画布节点的引用关系。
- `generation_jobs` 是数据库任务队列。
- `audit_logs` 记录注册、登录失败、项目/画布/素材/任务等关键操作。

迁移：

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

生产环境只允许向前迁移，不在部署脚本里 `DROP TABLE`。

## 4. 用户与认证

### 注册 / 登录

- 手机号 + 短信验证码注册。
- 手机号 + 短信验证码登录。
- 手机号 + 密码登录。
- 注册时可选密码，密码使用 Node `scrypt`（随机盐）存储。
- `verification_challenges` 限制频率、过期时间、尝试次数。

### 会话

- 服务端 `user_sessions` 保存会话，Cookie 名 `blm_session`（HttpOnly、SameSite=Lax）。
- CSRF Cookie 名 `blm_csrf`，前端在非 GET 请求带 `X-CSRF-Token`。
- `POST /api/auth/refresh` 轮换 Session Token 和 CSRF Token，并延长 30 天。
- `GET /api/auth/sessions` 查看设备会话；`DELETE /api/auth/sessions/[id]` 撤销。
- `POST /api/auth/logout` 撤销当前会话并清 Cookie。
- `DELETE /api/auth/account` 注销：软删除账户、清空密码/头像、撤销全部会话、停用项目与素材，备份按 30 天保留策略轮换。

### 权限

所有项目、画布、素材、任务查询都在 SQL 中带 `owner_id/user_id` 条件，服务端校验，不依赖前端。

## 5. 画布后端

保存流程：

1. 前端 `PUT /api/canvases/:id`，携带 `baseVersion` 和完整图。
2. 服务端事务内 `SELECT ... FOR UPDATE` 锁定画布。
3. `baseVersion !== current.version` → `409 CANVAS_VERSION_CONFLICT`。
4. 更新 `canvases.data/version/updatedAt`。
5. 重建 `nodes` / `edges` / `asset_references`。
6. 按需写入 `canvas_versions`（手动快照或距上次快照超过 60 秒）。
7. 清理超过 50 个的旧版本。

前端策略：

- 登录后从服务器加载画布。
- 800ms 防抖自动保存。
- 网络失败：保留本地草稿并显示「离线草稿」，可重试。
- 版本冲突：停止覆盖，显示「重新加载服务器版本」。
- 未登录：保留本地演示模式，但明确标记为本地保存。

## 6. 素材

流程：

1. `POST /api/assets/presign` 校验 MIME、大小、项目权限。
2. 创建 `assets` 记录（`pending`），签发上传凭证：
   - 本地卷：HMAC 签名 URL，`PUT /api/assets/upload/[id]`。
   - S3：Presigned PUT URL。
3. `POST /api/assets/complete` 校验对象存在、大小，标记 `ready`。
4. `GET /api/assets/[id]/url` 返回短期签名 URL。
5. `DELETE /api/assets/[id]` 检查引用；被画布引用时返回 `409`，支持 `?force=1`。

限制：

- 图片 25MB，视频 60MB，音频 50MB。
- 禁止 SVG 上传（避免脚本注入）。
- 文件内容不写入 PostgreSQL。
- 本地卷路径做目录穿越校验。

## 7. AI 任务

- `POST /api/jobs` 创建任务，校验模型、Provider、项目/画布权限。
- `GET /api/jobs` 列表，`GET /api/jobs/[id]` 状态。
- `POST /api/jobs/[id]/cancel` 取消。
- `POST /api/jobs/[id]/retry` 重试失败/取消任务。
- Worker 每 2 秒从 PostgreSQL 领取任务（`FOR UPDATE SKIP LOCKED`），支持 2 并发。
- 崩溃恢复：运行超过 5 分钟的任务自动回到队列或标记失败。
- 结果下载后写入素材库，再回写任务 `result_asset_id` 和画布节点状态。
- `usage_records` 记录积分消耗。

Provider：

- `mock`：仅开发环境可用，返回明确标记的占位图；生产环境禁用。
- `fal` / `ark`：有 Key 且 Provider 启用时调用真实接口。
- 没有真实 Key 时，生产任务会明确失败 `PROVIDER_UNAVAILABLE`，不会伪造结果。

## 8. 安全

- 所有密钥只在服务端环境变量。
- 认证接口频率限制（Redis，失败降级内存）。
- Zod 校验所有请求体。
- Drizzle 参数化 SQL，防 SQL 注入。
- React 转义 + 禁止 SVG 上传 + 上传文件 `nosniff`。
- 同源 Origin 校验 + 双提交 CSRF Token。
- Session / CSRF Token 只存摘要。
- 日志不记录密码、验证码、完整 Token；手机号脱敏。
- 关键操作写 `audit_logs`。
- 数据库备份与恢复脚本：`scripts/backup.sh`、`scripts/restore.sh`。

## 9. 本地开发

开发库与生产库分离。开发使用 `baolimei_dev`，生产使用 `baolimei_prod`。

```bash
# 1. 安装依赖
npm install

# 2. 配置 .env.local（从 .env.example 复制）
#    DATABASE_URL 指向开发库
#    APP_ENV=development
#    MOCK_GENERATION_ENABLED=1
#    SMS_PROVIDER=console

# 3. 迁移 + seed
npm run db:migrate
npm run db:seed

# 4. 启动（同时启动 Worker）
npm run dev

# 5. 测试
npm run test:api
```

开发环境验证码会打印到服务端日志，并在 `ALLOW_DEV_SMS_RESPONSE=1` 时出现在 API 响应中。

## 10. 生产环境

```bash
# 依赖
yum install -y postgresql15-server postgresql15-contrib redis

# 数据库
# 创建 blm_prod / baolimei_prod，绝不使用开发库
cd /opt/baolimei/build
export PATH=/opt/baolimei/node/bin:$PATH
export $(grep -v '^#' /root/baolimei-secrets/app.env | xargs)
npm ci
npm run db:migrate
NEXT_PUBLIC_SITE_URL=https://baolimei.cn npm run build

# 发布 standalone
cp -a .next/static .next/standalone/.next/static
cp -a public/. .next/standalone/public/
```

生产必须设置：

```
APP_ENV=production
MOCK_GENERATION_ENABLED=0
SMS_PROVIDER=http
SMS_HTTP_URL=...
SMS_HTTP_TOKEN=...
COOKIE_SECURE=true        # 启用 HTTPS 后
STORAGE_DRIVER=s3         # 或 local（当前预览环境）
S3_*                      # S3 / OSS 配置
ALLOWED_ORIGINS=https://baolimei.cn,https://www.baolimei.cn
```

`WORKER_ENABLED=1` 时，Next.js `instrumentation.ts` 会在服务启动时拉起数据库 Worker。生产也可以把 Worker 拆成独立 systemd 服务，当前单机预览使用同进程 Worker。

## 11. 备份与恢复

```bash
# 备份（数据库 + 素材卷）
bash scripts/backup.sh

# 恢复数据库
pg_restore --clean --if-exists -d "$DATABASE_URL_PROD" /root/backup/baolimei/db-YYYYmmdd-HHMM.dump

# 恢复素材
tar xzf /root/backup/baolimei/assets-YYYYmmdd-HHMM.tgz -C /opt/baolimei/data
```

建议 cron 每日执行，保留 7–30 天。生产迁移前额外手工备份。

## 12. 当前边界

- 短信真实发送需要 `SMS_PROVIDER=http` 网关；未配置时生产请求会返回 503，不会静默伪造。
- 真实 AI Provider 需要 `FAL_KEY` / `ARK_API_KEY`；未配置时生产任务明确失败。
- 当前单机 Worker 与 Web 同进程；规模化后拆为独立 Worker + Redis 队列。
- 对象存储默认本地卷；配置 S3 后自动切换，代码路径已实现。
