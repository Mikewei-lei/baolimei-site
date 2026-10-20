# BAOLIMEI API 文档

Base URL：`https://baolimei.cn`（开发：`http://localhost:3000`）

所有响应为 JSON：

```json
{ "ok": true, "data": { ... } }
```

错误：

```json
{ "ok": false, "error": { "code": "CODE", "message": "可读信息", "details": { ... } } }
```

## 认证方式

- 登录成功后服务端设置：
  - `blm_session`：HttpOnly Session Cookie。
  - `blm_csrf`：前端可读 CSRF Cookie。
- 所有非 GET/HEAD 的已登录请求必须带：
  - `Cookie: blm_session=...; blm_csrf=...`
  - `X-CSRF-Token: <blm_csrf 的值>`
- 浏览器还会校验 `Origin` 必须在 `ALLOWED_ORIGINS` 内。
- Session 有效期 30 天，`POST /api/auth/refresh` 轮换。

---

## Auth

### POST `/api/auth/request-code`

请求验证码。

```json
{ "phone": "13800000000", "purpose": "register" }
```

`purpose`: `register | login | reset`。

开发环境响应可能包含 `devCode`；生产环境不返回。生产短信由 `SMS_PROVIDER=aliyun` 或 `http` 发送。

### POST `/api/auth/register`

```json
{
  "phone": "13800000000",
  "code": "123456",
  "name": "林导演",
  "password": "Baolimei2026"
}
```

`password` 可选，但推荐设置。成功返回 `user`、`csrfToken`、`expiresAt`。

### POST `/api/auth/login/code`

```json
{ "phone": "13800000000", "code": "123456" }
```

### POST `/api/auth/login/password`

```json
{ "phone": "13800000000", "password": "Baolimei2026" }
```

### POST `/api/auth/refresh`

需要 CSRF。轮换 Session / CSRF Token。

### POST `/api/auth/logout`

需要 CSRF。撤销当前会话。

### GET `/api/auth/me`

返回当前用户；未登录返回 `{ user: null }`。

```json
{
  "user": {
    "id": "uuid",
    "phone": "13800000000",
    "name": "林导演",
    "avatarAssetId": null,
    "avatarUrl": "https://...",
    "role": "user",
    "status": "active"
  },
  "session": { "id": "uuid", "expiresAt": "..." }
}
```

### PATCH `/api/auth/profile`

需要 CSRF。

```json
{ "name": "新名字", "avatarAssetId": "uuid 或 null" }
```

### POST `/api/auth/password`

需要 CSRF。

```json
{ "currentPassword": "old", "newPassword": "new" }
```

### GET `/api/auth/sessions`

列出当前账户有效设备会话。

### DELETE `/api/auth/sessions/[id]`

撤销指定会话；撤销当前会话会清 Cookie。

### DELETE `/api/auth/account`

需要 CSRF。注销账户。

```json
{ "password": "Baolimei2026", "confirm": "DELETE" }
```

---

## Projects

### GET `/api/projects`

返回当前用户的项目列表（含画布元数据）。

### POST `/api/projects`

```json
{ "name": "新项目", "description": "可选" }
```

事务内创建 `projects` + `canvases`。

### GET `/api/projects/[id]`

### PATCH `/api/projects/[id]`

```json
{ "name": "新名称", "description": "新描述" }
```

### DELETE `/api/projects/[id]`

软删除项目。

---

## Canvas

### GET `/api/canvases/[id]`

```json
{
  "canvas": {
    "id": "uuid",
    "version": 3,
    "nodeCount": 2,
    "edgeCount": 1,
    "updatedAt": "..."
  },
  "project": { "id": "uuid", "name": "项目" },
  "graph": {
    "nodes": [],
    "edges": [],
    "groups": [],
    "view": { "x": 0, "y": 0, "k": 1 }
  }
}
```

### PUT `/api/canvases/[id]`

需要 CSRF。

```json
{
  "baseVersion": 3,
  "graph": {
    "nodes": [
      {
        "id": "node_x",
        "type": "prompt",
        "x": 100,
        "y": 100,
        "w": 260,
        "text": "镜头描述",
        "assetId": null,
        "status": "idle"
      }
    ],
    "edges": [{ "id": "edge_x", "from": "node_x", "to": "node_y" }],
    "groups": [],
    "view": { "x": 0, "y": 0, "k": 1 }
  },
  "snapshot": true,
  "label": "手动快照"
}
```

- `baseVersion` 不匹配返回 `409 CANVAS_VERSION_CONFLICT`，不会覆盖服务器版本。
- `snapshot=true` 强制写入版本历史。
- 服务端会过滤非法节点引用、无效素材引用和临时 URL。

### GET `/api/canvases/[id]/versions`

返回最近 50 个快照版本。

### GET `/api/canvases/[id]/versions/[version]`

返回指定版本快照。

### POST `/api/canvases/[id]/restore?version=2`

需要 CSRF。

```json
{ "baseVersion": 4 }
```

将旧版本恢复为新版本（不删除历史）。

---

## Assets

### POST `/api/assets/presign`

需要 CSRF。

```json
{
  "filename": "keyframe.png",
  "mimeType": "image/png",
  "size": 123456,
  "projectId": "uuid（可选）"
}
```

返回：

```json
{
  "assetId": "uuid",
  "upload": {
    "driver": "local | s3",
    "url": "https://...",
    "method": "PUT",
    "headers": { "Content-Type": "image/png" },
    "expiresAt": "..."
  }
}
```

### PUT `/api/assets/upload/[id]?token=...&exp=...`

本地存储驱动使用。请求体为原始文件二进制，`Content-Type` 必须匹配申请值。

### POST `/api/assets/complete`

需要 CSRF。

```json
{ "assetId": "uuid" }
```

校验对象存在并标记 `ready`。

### GET `/api/assets?projectId=&kind=&limit=`

列出当前用户素材。

### GET `/api/assets/[id]`

返回素材元数据和短期签名 URL。

### GET `/api/assets/[id]/url`

只返回 `{ "url": "..." }`。

### DELETE `/api/assets/[id]?force=1`

被画布引用时返回 `409 ASSET_IN_USE`；`force=1` 会先删除引用再删除对象。

### GET `/api/assets/download/[id]?token=...&exp=...`

签名下载 / 预览地址。

---

## Jobs

### POST `/api/jobs`

需要 CSRF。

```json
{
  "projectId": "uuid（可选）",
  "canvasId": "uuid（可选）",
  "nodeId": "node_x（可选）",
  "model": "blm-cinema-1",
  "kind": "text_to_video",
  "prompt": "雨夜霓虹，镜头缓慢推近",
  "params": {
    "ratio": "16:9",
    "duration": 5,
    "resolution": "1080p",
    "imageAssetId": null
  },
  "idempotencyKey": "node:node_x:172..."
}
```

`kind`: `text_to_video | image_to_video | text_to_image`。

返回任务对象，状态 `queued`。

### GET `/api/jobs?projectId=&limit=`

### GET `/api/jobs/[id]`

```json
{
  "job": {
    "id": "uuid",
    "status": "queued | running | succeeded | failed | cancelled",
    "progress": 42,
    "attempts": 1,
    "maxAttempts": 3,
    "error": null,
    "result": {
      "assetId": "uuid",
      "kind": "image | video",
      "mimeType": "image/svg+xml",
      "url": "https://..."
    }
  }
}
```

### POST `/api/jobs/[id]/cancel`

需要 CSRF。排队中立即取消；运行中设置取消标记，Worker 在安全点停止。

### POST `/api/jobs/[id]/retry`

需要 CSRF。仅失败 / 取消的任务可重试。

---

## 健康检查

### GET `/api/health`

```json
{
  "ok": true,
  "service": "baolimei-site",
  "appEnv": "production",
  "mode": "live-only",
  "storage": "s3",
  "worker": true,
  "database": "ok"
}
```

数据库不可用时返回 503。

---

## 主要错误码

| Code | 含义 |
| --- | --- |
| `UNAUTHENTICATED` | 未登录 |
| `SESSION_INVALID` | 会话已失效 |
| `CSRF_INVALID` | CSRF 校验失败 |
| `ORIGIN_FORBIDDEN` | 请求 Origin 不允许 |
| `RATE_LIMITED` | 触发限流 |
| `VALIDATION_ERROR` | 参数校验失败 |
| `PHONE_EXISTS` | 手机号已注册 |
| `CODE_EXPIRED` / `CODE_INVALID` | 验证码过期 / 错误 |
| `PROJECT_FORBIDDEN` | 无权访问项目 |
| `CANVAS_VERSION_CONFLICT` | 画布版本冲突 |
| `ASSET_IN_USE` | 素材仍被引用 |
| `ASSET_TOO_LARGE` | 文件超出限制 |
| `PROVIDER_UNAVAILABLE` | 模型通道未配置 / 未启用 |
| `JOB_NOT_RETRYABLE` | 任务状态不允许重试 |
