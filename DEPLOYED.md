# DEPLOYED — 生产部署状态（2026-10-20）

> 本文记录**真实发生**的部署结果、验证证据、阻塞项与回滚方式。
> 与 `DEPLOYMENT_CHECKLIST.md`（目标清单）区分：这里是"已经做到哪一步"。

---

## 0. 2026-10-20 前端升级发布

| 项目 | 结果 |
| --- | --- |
| 发布版本 | `/opt/baolimei/releases/20261020-1032` |
| 上一版本备份 | `/root/backup/baolimei/release-20261020-1031.tgz` |
| 回滚副本 | `/opt/baolimei/releases/rollback-20261020-1031` |
| 构建 | 服务端 `npm ci && npm run build`，17 个路由通过 |
| 应用健康 | `127.0.0.1:3001/api/health` → `ok:true` |
| Nginx Host 验证 | `Host: baolimei.cn` → 200 |
| 新页面 | `/models`、`/works` → 200 |
| 新静态资源 | `/work/hero.webp`、`/work/baolimei-original.mp4` → 200 |
| 生成接口 | POST + GET 冒烟测试 → `succeeded`（demo） |
| 公网域名 | 仍被阿里云 ICP 拦截，`baolimei.cn` / `www` 返回 403 |
| IP 预览 | 仍为 401 Basic Auth，应用已指向新版本 |

> 说明：本次只更新应用发布，未改 Nginx、DNS、证书与备案状态。

---

## 0.1 2026-10-20 Canvas 2.0 发布

| 项目 | 结果 |
| --- | --- |
| 发布版本 | `/opt/baolimei/releases/20261020-1143` |
| 上一版本备份 | `/root/backup/baolimei/release-20261020-1141.tgz` |
| 回滚副本 | `/opt/baolimei/releases/rollback-20261020-1141` |
| 服务端构建 | `npm ci && npm run build`，17 个路由通过 |
| 应用健康 | `127.0.0.1:3001/api/health` → `ok:true` |
| 画布页面 | `Host: baolimei.cn /canvas` → 200 |
| 画布 CSS | `/_next/static/css/80e4d745a8cc657d.css` → 200，包含 `canvas-group` |
| 本地 E2E | 多选、分组、拖动、右键菜单、项目快照、异步生成、上传 IndexedDB、失败重试、移动端全部通过 |
| 公网域名 | 仍被阿里云 ICP 拦截，`baolimei.cn` / `www` 返回 403 |

> 本次新增：画布分组、右键菜单、项目快照、模型/音频节点、节点状态与重试、IndexedDB 素材库、节点大纲、快捷键弹窗、移动端提示。

---

## 0.2 2026-10-20 正式后端（Task 3）部署

| 项目 | 结果 |
| --- | --- |
| 发布版本 | `/opt/baolimei/releases/20261020-1724` |
| 上一版本备份 | `/root/backup/baolimei/release-20261020-1321.tgz` |
| 回滚副本 | `/opt/baolimei/releases/rollback-20261020-1321` |
| PostgreSQL | 15.19，`postgresql-15.service`，监听 127.0.0.1:5432 |
| Redis | 3.2，`redis.service`，监听 127.0.0.1:6379 |
| 开发库 | `baolimei_dev` / `blm_dev` |
| 预发布库 | `baolimei_staging` / `blm_staging` |
| 生产库 | `baolimei_prod` / `blm_prod`，已执行迁移，Provider 仅 seed，Mock 关闭 |
| 运行环境 | staging：`APP_ENV=staging`，Mock Provider / console SMS 仅用于 ICP 预览 |
| 系统环境文件 | `/root/baolimei-secrets/app.env`（600） |
| 生产环境模板 | `/root/baolimei-secrets/app.prod.env.example`（需配置真实短信 / S3 / AI Key） |
| 应用健康 | `127.0.0.1:3001/api/health` → `database: ok`、`worker: true` |
| 后端 E2E | 在 staging 真实执行：注册、会话、项目、画布、版本、素材、任务、取消、权限隔离、注销全部通过 |
| 前端全栈 E2E | 浏览器连接 staging：注册、默认画布迁移、自动保存、刷新恢复、生成任务、项目保存全部通过，0 控制台错误 / 0 HTTP 4xx |
| 备份 | 每日 03:15，数据库 dump + release + conf + 本地素材卷，保留 14 天 |
| 公网域名 | 仍被阿里云 ICP 拦截，`baolimei.cn` / `www` 返回 403 |

> 当前 3001 运行的是 **staging 预览配置**：`APP_ENV=staging`，允许 Mock 生成；短信已切换为阿里云真实通道。
>
> 2026-10-20 短信配置：
> - Provider：`aliyun`
> - 签名：当前按用户要求设为 `流花`；模板 `SMS_512576668`。`流花` 仍被运营商拒绝（PORT_NOT_REGISTERED / SP_UNKNOWN_ERROR），可靠回退签名：`广州流花科技`
> - 模板：`SMS_512576668`
> - AccessKeyId：已配置
> - AccessKeySecret：仅存于 `/root/baolimei-secrets/app.env`（600），不写入仓库
> - `ALLOW_DEV_SMS=0`、`ALLOW_DEV_SMS_RESPONSE=0`，接口不再返回验证码
> - 用非法手机号调用阿里云返回 `isv.MOBILE_NUMBER_ILLEGAL`，证明 AK / 签名 / 模板已通过阿里云校验；真实手机号发送待验收
>
> 正式开放注册登录前，必须把 `app.env` 切换为生产配置：`MOCK_GENERATION_ENABLED=0`、S3/OSS、`COOKIE_SECURE=true`。

---

## 1. 结论

| 项目 | 状态 |
| --- | --- |
| 代码部署到 ECS | ✅ 完成 |
| 应用进程 / 开机自启 | ✅ systemd `baolimei.service`，`127.0.0.1:3001` |
| 服务器内部访问 | ✅ 200，生成 / 画布 / 作品库全部可用（浏览器实测） |
| Nginx 反代 | ✅ `baolimei.cn` / `www` → `127.0.0.1:3001` |
| DNS 解析 | ✅ `A @` 与 `A www` → `8.135.56.14`（已生效） |
| **公网访问 baolimei.cn** | ⛔ **被阿里云 ICP 备案拦截**（不是代码/服务器问题） |
| 公网预览（IP + Basic Auth） | ✅ `http://8.135.56.14/`，口令见服务器 `/root/baolimei-preview.txt` |
| HTTPS | ⛔ 无证书；HTTP-01 验证同样被 ICP 拦截 |
| 备份 | ✅ 每日 03:15，`/root/backup/baolimei/`，保留 7 天 |
| 健康检查 | ✅ 每 5 分钟，失败自动重启 |

**一句话：站已经部署好并在运行，域名在备案通过前被阿里云在网络层拦截；临时用「IP + Basic Auth」提供了可公网访问的预览。**

> 临时预览仅在备案期间使用：`X-Robots-Tag: noindex`、需要口令、随时可删除（`/www/server/panel/vhost/nginx/baolimei-preview.conf`）。

---

## 2. 部署拓扑

```
用户 ──► baolimei.cn (A 8.135.56.14)
             │
             ▼
      阿里云 ICP 拦截层  ← 未备案域名在 80/443 返回 403 "Non-compliance ICP Filing"
             │ (备案通过后放行)
             ▼
      宝塔 Nginx 1.28.1 (80/443)
        ├─ floweriver.cn  (既有站点，未改动)
        ├─ floweriver.com (既有站点，未改动)
        └─ baolimei.cn    → 127.0.0.1:3001
                              │
                        baolimei.service (www)
                        Node v22.23.3 glibc-217
                        /opt/baolimei/current (symlink → releases/20261019-2130)
```

---

## 3. 服务器上的路径与组件

| 项 | 值 |
| --- | --- |
| 公网 IP | `8.135.56.14`（私网 `172.29.86.214`） |
| 系统 | CentOS 7.9.2009（kernel 3.10，已 EOL） |
| 规格 | 2 vCPU / 2 GiB / 40 GB 系统盘 / 3 Mbps |
| Node | `/opt/baolimei/node/bin/node` v22.23.3（glibc-217 兼容构建） |
| 应用 | `/opt/baolimei/releases/20261019-2130`，`current` 软链指向它 |
| 源码构建目录 | `/opt/baolimei/build`（服务端 `npm ci` + `npm run build`） |
| systemd | `/etc/systemd/system/baolimei.service` |
| Nginx vhost | `/www/server/panel/vhost/nginx/baolimei.cn.conf` |
| Nginx 配置备份 | `/root/backup/nginx-conf-*.tgz`（部署前） |
| 应用备份 | `/root/backup/baolimei/release-*.tgz`、`conf-*.tgz` |
| 健康检查 | `/usr/local/bin/baolimei-health.sh`（cron `*/5`） |
| 备份脚本 | `/usr/local/bin/baolimei-backup.sh`（cron 每日 03:15） |
| 端口 | 应用仅监听 `127.0.0.1:3001`，公网只开 22/80/443/8888（宝塔） |

> 未使用 Docker：目标机为 CentOS 7 + 2G 内存，直接部署 standalone 产物更轻、更可控。

---

## 4. 验证证据

### 4.1 服务器内部（真实执行）

```bash
systemctl is-active baolimei              # active
curl -s 127.0.0.1:3001/api/health
# {"ok":true,"service":"baolimei-site","mode":"demo",...}

curl -s -H "Host: baolimei.cn" http://127.0.0.1/
# <title>葆历莓 BAOLIMEI · AI 影视创作平台</title>

curl -s -H "Host: baolimei.cn" http://127.0.0.1/studio | grep canonical
# <link rel="canonical" href="https://baolimei.cn/studio"/>

# 静态资源
/_next/static/chunks/webpack-*.js → 200
/brand/logo.png → 200, /shots/shot-1.svg → 200, /icon.png → 200, /brand/og.jpg → 200

# 限流（Nginx 20r/m，burst 10）
200 ×6 → 429 ×8   ✅
```

### 4.2 浏览器端到端（对生产构建，经 SSH 端口转发）

```
title: 葆历莓 BAOLIMEI · AI 影视创作平台
canonical: https://baolimei.cn
imagesBroken: 0
生成结果: 2 条，toast「生成完成（演示占位画面）」
画布: 4 节点，拖拽成功，刷新后保留
作品库: 2 条
移动端横向溢出: 0
console/page errors: []
404 资源: []
```

### 4.3 公网预览（IP + Basic Auth）

```bash
curl -I http://8.135.56.14/                     # 401（需要口令）
curl -I -u baolimei:<口令> http://8.135.56.14/  # 200，X-Robots-Tag: noindex
```

浏览器实测：标题正确、logo 加载、生成 2 条结果、0 报错。
口令位置：`/root/baolimei-preview.txt`（600）；htpasswd：`/www/wwwroot/baolimei.cn/.htpasswd`。

### 4.4 外部访问 baolimei.cn（真实请求）

```bash
curl -H "Host: baolimei.cn" http://8.135.56.14/
# HTTP/1.1 403 Forbidden
# Server: Beaver
# <title>Non-compliance ICP Filing</title>
# iframe -> http://www.aliyun.com/beian/beian-block?id=00000000005974291681
```

```bash
openssl s_client -connect 8.135.56.14:443 -servername baolimei.cn
# 返回宝塔默认自签证书（非 baolimei.cn 证书），curl 连接失败
```

**判定**：403 由阿里云备案合规系统返回（`Server: Beaver`），不是 Nginx、不是 Next.js、不是安全组。
同一 IP 上 `floweriver.cn` 正常 200/301，说明服务器与 Nginx 本身健康。

---

## 5. 为什么现在不能绕过

1. **ICP 备案未下号**：阿里云对未备案域名在 80/443 做 Host 拦截，这是机房侧策略，改代码/改 Nginx 都无效。
2. **证书申请同样被拦**：Let's Encrypt HTTP-01 需要访问 `/.well-known/acme-challenge/`，实测返回同一 403，因此无法签证书。
3. **不能把域名指到境外**：管局审核期要求域名解析指向备案服务器，改走隧道/Vercel 会导致核验失败、备案退回。

### 可选的三条正规路径

| 方案 | 需要 | 结果 |
| --- | --- | --- |
| **A. 等备案下号（推荐）** | 管局通过 + 备案号 | 立即 HTTP-01 签证书 → HTTPS 上线 |
| **B. 已备案域名的子域预览** | 在 floweriver.cn 加一条 `baolimei` A 记录 | `https://baolimei.floweriver.cn` 立刻可公网访问（需签新证书，HTTP-01 可过） |
| **C. DNS-01 先签证书** | 阿里云 DNS AccessKey 或手动加 TXT | 证书就绪，但 baolimei.cn 仍需等备案放行 |

> B 是"现在就能让人看到"的最快合规方式，只需你加一条 DNS 记录。

---

## 6. 回滚

### 回滚应用（保留上一版本目录）

```bash
ls -1 /opt/baolimei/releases/            # 选择上一个版本
ln -sfn /opt/baolimei/releases/<旧版本> /opt/baolimei/current
systemctl restart baolimei
curl -s http://127.0.0.1:3001/api/health
```

### 回滚 Nginx

```bash
ls -1 /root/backup/nginx-conf-*.tgz | tail -1
tar xzf /root/backup/nginx-conf-<时间>.tgz -C /
nginx -t && systemctl reload nginx
```

### 从备份恢复整个应用

```bash
tar xzf /root/backup/baolimei/release-<时间>.tgz -C /opt/baolimei/releases-restore
```

> 既有站点 `floweriver.cn` / `floweriver.com` 全程未改动；部署前后均验证 200/301。

---

## 7. 本次随部署上线的代码修复

| 修复 | 文件 |
| --- | --- |
| 每页独立 canonical（原先全部指向首页） | 各 `page.jsx` |
| `/studio`、`/canvas` 增加 H1（视觉隐藏） | 两个 page.jsx + `.sr-only` |
| 新增 `error.jsx` / `global-error.jsx` | `src/app/` |
| API：非法 model → 400，坏 JSON 文案修正、超长提示词 400 | `api/generate/route.js` |
| localStorage 写失败提示（创作台 toast / 画布状态栏） | `StudioClient` / `CanvasClient` |
| 页脚标题层级 h4 → h2 | `Footer.jsx` + CSS |
| 导航 `aria-current="page"` | `Header.jsx` |
| 作品库弹窗 ESC 关闭 + 焦点管理 + 滚动锁 | `LibraryClient.jsx` |
| 画布输入 aria-label、toast aria-live | `CanvasClient` / `StudioClient` |
| robots 与 sitemap 对 `/canvas` 保持一致 | `robots.js` |
| 小字对比度 `#6b7280` → `#7f8794`（AA） | `globals.css` |
| 清理未引用资源 `logo.jpg`、空 `avatars/` | `public/` |

---

## 8. 待办（按优先级）

- [ ] **P0** 等 ICP 下号 → 填入 `NEXT_PUBLIC_ICP_BEIAN` → 服务端重建 → 签证书 → 开 443
- [ ] **P0** 营业执照全称替换「流花」（页脚、关于页、4 篇法务、结构化数据）
- [ ] **P1** 把 `deploy/baolimei.service`、`deploy/nginx-baolimei.conf` 纳入版本管理（已提交）
- [ ] **P1** 备案通过后按 `deploy/nginx-baolimei.conf` 里的注释启用 HTTPS + HSTS
- [ ] **P1** 接入真实模型前完成认证 / 配额 / 审核（见 `IMPLEMENTATION_PLAN.md` P0-5、P1-7）
- [ ] **P2** 迁移系统到 Ubuntu 22.04（CentOS 7 已 EOL）
- [ ] **P2** 视频与图片迁 OSS + CDN（3 Mbps 带宽不适合直接分发视频）

---

## 9. 关键命令速查

```bash
# 服务
systemctl status baolimei
journalctl -u baolimei -f

# 内部验证
curl -s 127.0.0.1:3001/api/health
curl -s -H "Host: baolimei.cn" http://127.0.0.1/ | head

# 域名自检（本地执行）
node scripts/check-domain.mjs baolimei.cn

# 重新构建并发布（服务端）
cd /opt/baolimei/build && export PATH=/opt/baolimei/node/bin:$PATH
NEXT_PUBLIC_SITE_URL=https://baolimei.cn NEXT_PUBLIC_ICP_BEIAN=<备案号> npm run build
cp -a .next/static .next/standalone/.next/static
cp -a public/. .next/standalone/public/
R=/opt/baolimei/releases/$(date +%Y%m%d-%H%M); mkdir -p $R
cp -a .next/standalone/. $R/; chown -R www:www $R
ln -sfn $R /opt/baolimei/current && systemctl restart baolimei
```


---

## 10. FAQ：baolimei.cn 到底能不能用？

**能，但要等备案下号。** 域名、解析、服务器、Nginx、应用全部就绪，唯一卡点是阿里云备案合规拦截。

已验证事实：

| 检查 | 结果 |
| --- | --- |
| DNS A 记录 | `baolimei.cn` / `www` → `8.135.56.14` ✅ |
| 服务器应用 | `127.0.0.1:3001` 健康 ✅ |
| Nginx 按 Host 访问 | 200 ✅（服务器内部） |
| 公网 `http://baolimei.cn/` | **403 `Non-compliance ICP Filing`**（Server: Beaver） |
| 同 IP 已备案域名 `floweriver.cn` | 301/200 ✅ |

结论：403 来自阿里云备案系统，请求未到达 Nginx。**任何代码/Nginx/DNS 改动都无法解除**，只能等备案通过。

### 备案下号后的动作（预计 5 分钟内完成）

1. 阿里云自动放行，HTTP 立即恢复；
2. 我执行 `acme.sh` 签发证书（HTTP-01 此时可通过）；
3. 启用 `deploy/nginx-baolimei.conf` 里的 443 配置 + HSTS + www 跳转；
4. 用备案号重建（页脚显示备案号，约 2 分钟）；
5. 删除 IP 预览入口。

### 现在可以自查的三件事

- 阿里云备案控制台 → 我的备案：状态是否「管局审核中」，域名列表是否包含 `baolimei.cn` 与 `www.baolimei.cn`；
- 是否收到并完成**管局短信核验**（未完成会被退回）；
- 备案主体全称是否与营业执照、域名实名认证一致。

### 不建议做的事

443 端口的 TLS 握手目前未被拦截，理论上装证书后 HTTPS 可能可访问；但这是**规避备案监管**，可能导致服务器被封停、备案被退回。不做。
