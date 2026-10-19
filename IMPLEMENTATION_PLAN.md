# IMPLEMENTATION PLAN — 葆历莓 BAOLIMEI

> 前置原则
> 1. 先审计后动手（本轮只产出文档，不改应用代码）。
> 2. 不删除现有页面/功能/资源；不改 logo 形状与色值。
> 3. 未备份不覆盖；每个变更必须有回滚路径。
> 4. **完成 = 有可复现的验证证据**，不是"编译通过"。

---

## 阶段总览

| 阶段 | 目标 | 优先级 | 预计工时 | 依赖 |
| --- | --- | --- | --- | --- |
| **P0 上线闭环** | 域名能打开、HTTPS、备份、最小安全 | P0 | 0.5–1 天（拿到权限后） | 公网 IP + SSH、DNS 权限、备案号 |
| **P1 生产化后端** | 账号、数据库、OSS、队列、真实模型、计费、审核 | P0/P1 | 7–10 个工作日 | P0 完成、模型 Key、主体信息 |
| **P2 产品能力** | 云端项目/画布同步、多人协作、分镜、移动端 | P1 | 10–15 个工作日 | P1 完成 |
| **P3 设计与体验** | 按 3 张参考稿做视觉升级、动效、真实素材 | P1/P2 | 5–8 个工作日 | 视觉源文件 |
| **P4 增长与规模化** | i18n、CDN、监控告警、WAF、容量 | P2 | 持续 | 流量数据 |

---

## 阶段 P0：上线闭环（最优先）

### P0-1 域名解析与备案核对　`P0`　0.5 h

**任务**
- 在阿里云云解析添加 `A @ → ECS 公网 IP`、`A www → 同 IP`（TTL 600）
- 核对 ICP 备案状态：未下号前**不要**把域名指向内地服务器
- 下号后把备案号写入 `.env` 的 `NEXT_PUBLIC_ICP_BEIAN`，重新构建

**验证**
```bash
node scripts/check-domain.mjs baolimei.cn
# 期望：A @ = 公网 IP；https://baolimei.cn/ = 200；页面备案号 = 真实号
```
**回滚**：删除刚加的 A 记录即可（DNS 无破坏性变更）。
**风险**：备案审核期改动解析可能被管局退回 → 先确认状态再操作。

---

### P0-2 服务器初始化与部署　`P0`　2–3 h

**任务**
- 处理 CentOS 7.9 EOL：优先"更换操作系统"为 Ubuntu 22.04（需你确认，会清空系统盘）
- 执行 `deploy/server-init.sh`（swap 2G、Docker、Nginx、certbot、UFW）
- 安全组放行 22（限本机 IP）/80/443
- `.env` 配置：`SITE_URL`、`ICP`、`COMPANY`
- `bash deploy/deploy.sh` 起服务
- 先用 `http://<公网IP>:3000` 验收，再上 Nginx

**验证**
```bash
ssh root@<IP> 'docker compose -f /srv/baolimei/docker-compose.yml ps'
curl -s http://<IP>:3000/api/health
curl -sI http://<IP>:3000 | head -20
```
**回滚**：`docker compose down` + 保留上一镜像 tag（`docker images | grep baolimei`）。

---

### P0-3 TLS + Nginx　`P0`　1 h

**任务**
- 安装 `deploy/nginx.conf`，替换证书路径
- certbot 或阿里云免费证书；启用 HSTS、gzip、静态长缓存
- 强制 www → 主域、http → https

**验证**
```bash
curl -sI https://baolimei.cn | grep -Ei "HTTP/|strict-transport|cache-control"
curl -sI http://baolimei.cn | grep -i location      # 期望 301 到 https
openssl s_client -connect baolimei.cn:443 -servername baolimei.cn </dev/null 2>/dev/null | openssl x509 -noout -dates
```
**回滚**：`cp /etc/nginx/conf.d/baolimei.conf.bak` + reload。

---

### P0-4 备份与回滚基线　`P0`　0.5 h

**任务**
- 服务器：代码 `git bundle`、`.env` 加密备份、镜像 tag、数据库每日 dump（P1 起）
- 本地：`git tag release-YYYYMMDD`
- 写 `RUNBOOK.md`（故障处理与回滚步骤）

**验证**：在测试目录用备份恢复一次并能启动成功。

---

### P0-5 生成接口最小防护　`P0`　2 h

**任务**（在接真实模型前必须完成）
- 增加 `GENERATION_ENABLED` 开关，默认关闭真实通道
- 服务端按 IP + 全局日配额限流（先在 Nginx `limit_req` 实现）
- 请求体上限、提示词长度与字符白名单
- 管理端/内部 Key 才能触发真实通道（`x-internal-key`）

**验证**
```bash
for i in $(seq 1 40); do curl -s -o /dev/null -w "%{http_code} " -X POST localhost:3000/api/generate \
  -H 'content-type: application/json' -d '{"prompt":"test"}'; done; echo
# 期望：后段出现 429
```

---

### P0-6 合规最小集　`P0`　1–2 天

**任务**
- 页脚：真实备案号 + 公安备案 + 举报邮箱（已预留位置）
- 内容规范页补充"举报与处置"（已有，需补工单入口）
- AI 生成内容标识：结果卡片与导出文件加水印/元数据（演示阶段标注 DEMO，正式阶段接标识）
- 隐私政策补：上传素材处理、删除流程、跨境说明
- 记录处理台账（谁、何时、何种违规、处置结果）

**验证**：按检查表逐项人工核对；用演示账号走一遍举报→处置流程。

---

## 阶段 P1：生产化后端

### P1-1 数据库与 ORM　`P0`
- Prisma + PostgreSQL，落地 ARCHITECTURE 第 3 节模型
- 迁移脚本、种子数据、本地 docker-compose 增加 postgres/redis
- **验证**：`npx prisma migrate dev` 成功；`/api/health` 增加 DB 探活；集成测试覆盖 CRUD

### P1-2 账号与认证　`P0`
- Auth.js + 手机号验证码（或微信），会话 HttpOnly
- 路由保护：`/studio`、`/canvas` 登录可用；营销页保持公开
- 注销与数据导出
- **验证**：E2E——注册→登录→生成→登出→注销；未登录访问 API 返回 401

### P1-3 对象存储与上传　`P0`
- OSS 直传签名；上传后审核；Asset 入库
- 前端参考图真正参与图生视频
- **验证**：上传 10 MB 图 → OSS 可见 → 生成请求带 URL → 结果引用 CDN 地址

### P1-4 任务队列与 Worker　`P0`
- Redis + BullMQ；web 只入队，worker 执行
- 状态机、重试、超时、退款、幂等键
- SSE 或 1s 轮询推送进度
- **验证**：并发 20 任务不丢；重启 worker 后任务继续；失败自动退积分

### P1-5 真实模型接入　`P0`
- 先接 1 家（建议火山方舟 Seedance）跑通端到端
- 固化参数映射、错误码、成本核算
- 二期接可灵/fal
- **验证**：真实 mp4 产出并可在页面播放；账单与积分账本一致

### P1-6 计费与账本　`P1`
- 套餐、积分包、兑换码；CreditLedger 双重记账
- 生成前预扣、失败回滚、对账报表
- **验证**：并发扣费不超扣；对账脚本零差异

### P1-7 内容审核　`P0`
- 文本预审 → 图像/视频后审 → BLOCKED 状态
- 人工复核台（简单后台）
- **验证**：违规提示词被拦截且不扣费；正常内容通过率抽样 ≥ 98%

### P1-8 可观测性　`P1`
- Sentry、SLS 日志、拨测（1 分钟）、告警到微信/短信
- 关键指标：生成成功率、P95 时延、队列积压、5xx 率
- **验证**：人为制造 500，5 分钟内收到告警

### P1-9 工程基线　`P1`
- ESLint + Prettier + TypeScript（渐进）；Vitest + Playwright
- GitHub Actions：lint/typecheck/test/build
- **验证**：CI 红灯阻止合并；覆盖率门槛（core ≥ 60%）

---

## 阶段 P2：产品能力

| ID | 任务 | 优先级 | 验收标准 |
| --- | --- | --- | --- |
| P2-1 | 云端项目与画布同步（乐观锁） | P1 | 两台设备编辑同一项目可合并/冲突提示 |
| P2-2 | 本机 localStorage 一键导入云端 | P1 | 旧作品无丢失 |
| P2-3 | 画布撤销/重做、多选、吸附、快捷键 | P1 | 50 步撤销；操作可键盘完成 |
| P2-4 | 移动端画布手势（双指缩放/长按菜单） | P1 | 真机 iOS/Android 手测通过 |
| P2-5 | 分镜与多镜头串联导出 | P2 | 3 镜头按顺序合成一条视频 |
| P2-6 | 角色/风格一致性（参考图 ID） | P1 | 同角色跨 3 镜头人脸相似度抽检通过 |
| P2-7 | 分享页与社区灵感流 | P2 | 公开链接可访问、可举报 |
| P2-8 | 团队空间与权限 | P2 | 角色矩阵测试通过 |

---

## 阶段 P3：设计与体验（按你给的 3 张参考稿）

| ID | 任务 | 优先级 | 验收 |
| --- | --- | --- | --- |
| P3-1 | 设计令牌文档（色彩/字号/间距/圆角/阴影/动效） | P1 | 与现有 CSS 变量对齐，不改变品牌色值 |
| P3-2 | 首页重构：更强的首屏叙事与真实作品 | P1 | 与参考稿逐屏比对；LCP < 2.5s |
| P3-3 | 作品墙接真实视频（OSS + CDN + poster） | P1 | 首帧不跳动、可静音自动播放 |
| P3-4 | 工作台信息层级与空/加载/错误态统一 | P1 | 所有异步状态有骨架屏与失败重试 |
| P3-5 | 动效规范（150/240/320ms 曲线，减少动效开关） | P2 | `prefers-reduced-motion` 下全部降级 |
| P3-6 | 无障碍修复（P1-02/03/10、P2-01/02/03） | P1 | axe 扫描 0 critical；键盘全流程可用 |

---

## 阶段 P4：规模化

- i18n（zh/en），路由与文案抽离
- CDN 全站加速、图片自动格式（AVIF/WebP）
- WAF、DDoS 基础防护、Bot 管理
- 容量与成本看板（模型成本/用户成本）
- 多可用区、数据库只读副本（按需）

---

## 立即执行的 10 个技术修复（不依赖外部权限，可先做）

| # | 修复 | 优先级 | 文件 | 验证 |
| --- | --- | --- | --- | --- |
| 1 | 每个页面独立 canonical | P1 | `src/app/**/page.jsx` | 抓 HTML 检查 `<link rel=canonical>` |
| 2 | 给 `/studio`、`/canvas` 加 H1（视觉隐藏） | P1 | 两个 page.jsx | axe / DOM 检查 |
| 3 | 新增 `error.jsx` + `global-error.jsx` | P1 | `src/app/` | 人为抛错显示友好页 |
| 4 | localStorage 失败提示 | P1 | `src/lib/store.js` | 模拟配额满，出现 toast |
| 5 | API 非法 model/坏 JSON 返回准确 400 | P2 | `api/generate/route.js` | curl 断言 |
| 6 | 页脚 h4 → h2/h3 | P2 | `Footer.jsx` | 标题层级检查 |
| 7 | 导航 `aria-current="page"` | P2 | `Header.jsx` | DOM 检查 |
| 8 | 弹窗 ESC 关闭 + 焦点锁定 | P2 | `LibraryClient.jsx` | 键盘测试 |
| 9 | robots 与 sitemap 对 `/canvas` 保持一致 | P2 | `robots.js` / `sitemap.js` | 对比输出 |
| 10 | 清理 `public/brand/logo.jpg`、`public/avatars` 空目录 | P2 | public | 构建无引用告警 |

> 建议：这 10 项作为 P0 部署完成后的第一个 PR，独立可回滚，不含视觉改动。

---

## Definition of Done（每个任务都必须满足）

1. 代码通过 `npm run build`；
2. 有对应的自动化或脚本化验证（curl / Playwright / 单测）；
3. 在**预发环境**验证通过，再上生产；
4. 有回滚命令并演练过；
5. 更新 `DEPLOYMENT_CHECKLIST.md` 勾选状态；
6. 不引入新的未使用依赖；
7. 不修改品牌 logo 几何与色值。

## 明确不做（本轮）

- 不重写现有页面、不换框架、不改品牌资产
- 不在没有备份的情况下覆盖线上
- 不接真实模型收费通道，直到 P0-5/P1-7 完成
- 不在审计确认前大规模改 UI
