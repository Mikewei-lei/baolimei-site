# DEPLOYMENT CHECKLIST — 葆历莓 baolimei.cn

> 用法：按顺序勾选，每一步都有**期望输出**。任何一步不符合预期就停下，不要继续下一步。
> 原则：**先备份、再变更；先预发、再生产；先验证、再宣布完成。**

---

## 0. 当前阻塞项（没有这些无法继续）

| # | 阻塞 | 需要谁 | 状态 |
| --- | --- | --- | --- |
| B-1 | `baolimei.cn` / `www` 无 A 记录 | 阿里云 DNS 权限（AccessKey）或你手动添加 | ⛔ 未解决 |
| B-2 | ICP 备案未下号 | 管局审核 | ⛔ 未解决 |
| B-3 | ECS 公网 IP 未知 | 你在控制台复制 | ⛔ 未提供 |
| B-4 | ECS SSH 登录方式未知 | 端口/账号/密码或密钥 | ⛔ 未提供 |
| B-5 | 运营主体法定全称 | 营业执照 | ⛔ 当前为占位「流花」 |
| B-6 | 是否可更换系统盘为 Ubuntu 22.04 | 你确认（会清空系统盘） | ⛔ 待确认 |

> 已知但无需阻塞的信息：实例 `i-wz90w8ghm088swvfd2z7`，2C2G，CentOS 7.9，20G 盘，3 Mbps，私网 `172.29.86.214`，到期 2027-04-08。

---

## 1. 预检（Pre-flight）

- [ ] 确认代码版本：`git log --oneline -1`，并打 tag
  ```bash
  cd /d/baolimei-site
  git tag release-$(date +%Y%m%d) && git push --tags
  ```
- [ ] 本地构建通过
  ```bash
  npm run build        # 期望：✓ Compiled successfully / 15 个路由
  ```
- [ ] 本地健康检查
  ```bash
  npm start &
  curl -s localhost:3000/api/health
  # 期望：{"ok":true,...,"mode":"demo"}
  ```
- [ ] 记录当前线上状态（若有）
  ```bash
  curl -sI https://baolimei.cn | head -5   # 当前：DNS 失败
  ```

---

## 2. 备份（Backup，必须先做）

- [ ] 代码备份
  ```bash
  git bundle create /backup/baolimei-$(date +%F).bundle --all
  ```
- [ ] 配置备份（服务器上）
  ```bash
  tar czf /backup/etc-nginx-$(date +%F).tgz /etc/nginx
  cp /srv/baolimei/.env /backup/env-$(date +%F).bak && chmod 600 /backup/env-*.bak
  ```
- [ ] 镜像打标（服务器上）
  ```bash
  docker tag baolimei/web:latest baolimei/web:rollback-$(date +%F)
  docker images | grep baolimei/web
  ```
- [ ] 数据库备份（P1 接入 DB 后每日执行）
  ```bash
  pg_dump "$DATABASE_URL" | gzip > /backup/db-$(date +%F).sql.gz
  ```
- [ ] **恢复演练**：用备份起一个临时容器，健康检查通过

---

## 3. 域名与备案（DNS & ICP）

### 3.1 核对备案状态
- [ ] 在阿里云备案控制台确认状态为「已备案」，记录备案号
- [ ] 若仍在管局审核：**跳过 3.2，先做第 4 节以外的准备**（避免核验失败）

### 3.2 添加解析（阿里云 → 云解析 DNS → baolimei.cn）

| 记录类型 | 主机记录 | 记录值 | TTL | 状态 |
| --- | --- | --- | --- | --- |
| A | `@` | `<ECS 公网 IP>` | 600 | [ ] |
| A | `www` | `<ECS 公网 IP>` | 600 | [ ] |

- [ ] 删除冲突的旧记录（CNAME/URL转发）
- [ ] 等待 10 分钟并验证：
  ```bash
  node scripts/check-domain.mjs baolimei.cn
  ```
  **期望**：`A @` 显示公网 IP；`https://baolimei.cn/` 返回 `HTTP 200`；页面备案号与工信部一致

> ⚠️ 本地 Clash 是 fake-ip 模式，`ping`/`nslookup` 结果不可信，一律用上面的 DoH 脚本。

### 3.3 备案号写回站点
- [ ] `.env`：
  ```bash
  NEXT_PUBLIC_ICP_BEIAN=京ICP备2026XXXXXX号-1
  NEXT_PUBLIC_PSB_BEIAN=（有则填）
  NEXT_PUBLIC_COMPANY=<营业执照全称>
  NEXT_PUBLIC_SITE_URL=https://baolimei.cn
  ```
- [ ] 重新构建部署（构建期变量）
- [ ] 首页底部可见备案号，链接到 `https://beian.miit.gov.cn/`

---

## 4. 服务器初始化

### 4.1 系统与安全组
- [ ] （建议）更换操作系统为 Ubuntu 22.04 LTS，20G 系统盘够用
- [ ] 安全组入方向：

| 端口 | 来源 | 用途 |
| --- | --- | --- |
| 22 | 你的公网 IP/32 | SSH |
| 80 | 0.0.0.0/0 | HTTP / 证书验证 |
| 443 | 0.0.0.0/0 | HTTPS |
| 3000 | 你的公网 IP/32（临时） | 首次验收，完成后关闭 |

- [ ] 出方向默认放行

### 4.2 初始化
- [ ] `ssh root@<IP>` 能登录
- [ ] 执行：
  ```bash
  bash deploy/server-init.sh
  ```
  **期望**：swap 2G 生效、`docker --version` 有输出、nginx 已安装
- [ ] 确认：
  ```bash
  free -h && docker --version && nginx -v && systemctl is-active docker nginx
  ```

### 4.3 代码与配置
- [ ] `git clone <repo> /srv/baolimei && cd /srv/baolimei`
- [ ] `cp .env.example .env && vim .env`（填 3 个必填项）
- [ ] **构建**（2C2G 已加 swap）：
  ```bash
  bash deploy/deploy.sh
  ```
  **期望**：`✓ 服务已启动：http://127.0.0.1:3000`
- [ ] 本机验证：
  ```bash
  curl -s http://127.0.0.1:3000/api/health
  curl -sI http://127.0.0.1:3000 | grep -i "cache-control\|x-frame"
  ```

### 4.4 首次公网验收（临时）
- [ ] 浏览器打开 `http://<公网IP>:3000`
- [ ] 首页、`/studio`、`/canvas` 可交互
- [ ] 验收后**关闭安全组 3000**

---

## 5. Nginx + TLS

- [ ] 上传配置：
  ```bash
  cp deploy/nginx.conf /etc/nginx/conf.d/baolimei.conf
  ```
- [ ] 申请证书（二选一）
  - Let's Encrypt：`certbot --nginx -d baolimei.cn -d www.baolimei.cn`
  - 阿里云免费证书：下载 Nginx 版，上传到 `/etc/nginx/ssl/`，改配置路径
- [ ] `nginx -t && systemctl reload nginx`
- [ ] 验证：
  ```bash
  curl -sI https://baolimei.cn | grep -Ei "HTTP/2|strict-transport|content-encoding"
  curl -sI http://baolimei.cn | grep -i location
  curl -sI https://www.baolimei.cn | grep -i location
  ```
  **期望**：200 + HSTS；http/www 均 301 到 `https://baolimei.cn`
- [ ] 证书自动续期：
  ```bash
  systemctl list-timers | grep certbot
  certbot renew --dry-run
  ```

---

## 6. 上线验证矩阵（逐项打勾）

### 6.1 路由与内容
- [ ] `/` 200，标题「葆历莓 BAOLIMEI · AI 影视创作平台」
- [ ] `/studio`、`/canvas`、`/library`、`/pricing`、`/about` 200
- [ ] `/legal/terms|privacy|content-policy|ai` 200
- [ ] 不存在的路径返回 **404**，不是 500/白屏
- [ ] 页脚：备案号、公安备案（如有）、主体全称正确

### 6.2 功能
- [ ] 首页输入提示词 → 跳转创作台并带入
- [ ] 生成 → 出现进度 → 2 条结果 → 可下载
- [ ] 「加入画布」→ 画布导入 → 刷新后仍在
- [ ] 画布：拖拽、连线、删除、缩放、导出 JSON
- [ ] 移动端（真机）：无横向滚动、按钮可点

### 6.3 接口
- [ ] `GET /api/health` → `{"ok":true}`
- [ ] `POST /api/generate` 空提示词 → 400
- [ ] 连续 35 次请求 → 出现 429（限流生效）
- [ ] 响应头无 `X-Powered-By`

### 6.4 性能与资源
- [ ] 首屏 LCP < 2.5 s（4G 网络、Chrome DevTools 手机模拟）
- [ ] `_next/static` 返回 `Cache-Control: public, max-age=31536000, immutable`
- [ ] 图片/字体全部 200，无 404
- [ ] gzip 生效（HTML/JS/CSS）

### 6.5 SEO
- [ ] 每页 `<title>`、`description`、`canonical` 正确（canonical 必须指向自身）
- [ ] `/robots.txt`、`/sitemap.xml` 200 且内容一致
- [ ] OG 图可在微信调试工具预览

### 6.6 安全
- [ ] 80 → 443 强制跳转
- [ ] HSTS 头存在
- [ ] 安全组只开 22/80/443（3000 已关）
- [ ] 目录不可列、`.env` 不可通过 Web 访问（`curl https://baolimei.cn/.env` → 404）
- [ ] 生成接口在真实通道关闭时不会产生费用

### 6.7 合规
- [ ] 首页底部备案号可见且链接正确
- [ ] 用户协议、隐私政策、内容规范、AI 说明可访问
- [ ] 举报邮箱/入口可用
- [ ] AI 生成结果带标识（当前 DEMO 标识；正式阶段替换为合规标识）

---

## 7. 监控与告警（上线当天完成）

- [ ] 拨测：`https://baolimei.cn/` 与 `/api/health`，1 分钟一次，连续 2 次失败告警
- [ ] 错误上报（Sentry 或 SLS），验证一条测试错误能收到
- [ ] 磁盘/内存/容器重启告警（`docker events` 或云监控）
- [ ] 证书到期提醒（提前 30 天）
- [ ] 日志轮转：`docker-compose.yml` 已配 10MB × 3
- [ ] 备份任务：每日 03:00，保留 7 天（DB + .env + 镜像 tag）

---

## 8. 回滚手册（Rollback）

**触发条件**：5xx 持续 > 2 分钟、核心页面白屏、生成接口不可用、证书错误。

```bash
# 1) 回滚应用镜像
cd /srv/baolimei
docker tag baolimei/web:rollback-<日期> baolimei/web:latest
docker compose up -d
curl -s http://127.0.0.1:3000/api/health

# 2) 回滚 Nginx
cp /backup/etc-nginx-<日期>.tgz /tmp/ && tar xzf /tmp/etc-nginx-<日期>.tgz -C /
nginx -t && systemctl reload nginx

# 3) 回滚代码
git checkout <上一个 tag>
docker compose build && docker compose up -d

# 4) 回滚 DNS（仅在解析错误时）
# 阿里云控制台恢复旧记录，或删除新记录的 A 解析
```

**回滚后必须**：记录事故时间线、原因、影响范围、修复项。

---

## 9. 上线后 72 小时

- [ ] 每小时看一次：5xx、生成成功率、队列积压、CPU/内存
- [ ] 每天备份校验一次（`gzip -t` + 恢复演练）
- [ ] 收集真实用户反馈（生成质量、等待时长、失败率）
- [ ] 提交 sitemap 到百度搜索资源平台 / Bing / Google
- [ ] 检查 ICP 备案号在工信部系统可查且与页脚一致

---

## 10. 常见故障速查

| 现象 | 可能原因 | 处理 |
| --- | --- | --- |
| `DNS_PROBE_FINISHED_NXDOMAIN` | 无 A 记录 / 未生效 | 查 DoH；等 TTL；检查主机记录 |
| 502 Bad Gateway | 容器未起 / 端口不对 | `docker compose logs -f web`；确认 `127.0.0.1:3000` |
| 521/522/530（Cloudflare） | 隧道断开 | 重启 cloudflared；生产环境不依赖隧道 |
| 样式全丢 | Nginx 未代理 `/_next/static/` | 检查配置并 reload |
| 证书错误 | 域名未解析到本机 / 证书过期 | `certbot renew`；确认 A 记录 |
| 备案号不显示 | 构建期变量未注入 | 重新 build，不要只 restart |
| 内存 OOM | 2G 机器构建 | 加 swap 或本机构建后传镜像 |
| 生成一直转圈 | 轮询失败 / 任务丢失 | 查 `/api/generate` 日志；重启后任务会标记中断 |

---

## 11. 上线门禁（Go / No-Go）

只有以下全部为「是」才允许对外宣布上线：

- [ ] 域名可解析，HTTPS 200，证书有效期 > 30 天
- [ ] 备案号在页脚且与工信部一致
- [ ] 生成接口有认证/配额（P0-05 完成）
- [ ] 内容审核链路可用（P1-7 完成）
- [ ] 数据库与对象存储已接入，作品不再只存浏览器
- [ ] 备份与回滚演练通过
- [ ] 监控告警可用
- [ ] 主体全称为营业执照全称
- [ ] 法务四页 + 举报入口 + 注销流程可用
