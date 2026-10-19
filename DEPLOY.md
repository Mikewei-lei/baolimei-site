# 部署与上线手册（baolimei.cn）

> 目标：让 `https://baolimei.cn` 真正打得开。下面按「现在就能做」到「备案下号后」排序。

---

## 0. 当前已核实的现状

| 项目 | 状态 |
| --- | --- |
| 域名 NS | `dns3.hichina.com` / `dns4.hichina.com`（阿里云云解析） |
| `baolimei.cn` A 记录 | **不存在**（域名尚未指向任何服务器） |
| `www.baolimei.cn` 记录 | 不存在 |
| 网站代码 | 已完成并本地构建通过，`http://localhost:3000` 全站可访问 |
| ICP 备案 | 阿里云初审通过，管局审核中 |

---

## ⚠️ 1. 备案期间不要改 baolimei.cn 的解析

阿里云在提交管局后会做**域名核验**：备案域名需要解析到阿里云**中国内地**服务器（备案时使用的 ECS / 轻量实例）。
如果在管局审核期间把 `baolimei.cn` 指到香港/海外机器或 Vercel，很可能被管局退回，前面排队的时间白费。

因此推荐节奏：

1. **现在**：用临时地址（Vercel / Cloudflare Tunnel / 香港测试机）把网站跑起来给同事和客户看，`baolimei.cn` 解析保持不动。
2. **备案下号后**：按第 4 节把 A 记录指向国内 ECS，Nginx + HTTPS，页脚自动显示备案号。
3. 全程代码不用改，只改 `.env` 里的两个变量然后重新构建。

如果你确认备案已经下号、或愿意承担被退回的风险，可以直接跳到第 4 节改解析。

---

## 2. 三条上线路线对比

| 路线 | 需要什么 | 国内访问 | 备案要求 | 耗时 |
| --- | --- | --- | --- | --- |
| **A. Vercel（临时展示）** | 一个 GitHub/Vercel 账号（免费） | 一般，时好时坏 | 不需要，但 `.cn` 域名长期指境外不合规 | 5 分钟 |
| **B. 阿里云香港轻量（推荐过渡）** | 一台香港轻量实例（约 ¥24/月起） | 良好 | 香港节点不需要 ICP | 30 分钟 |
| **C. 阿里云内地 ECS（最终形态）** | 备案号 + 2核2G 实例 | 最好 | **必须** | 备案下号后 1 小时 |

> 香港/海外方案只能算过渡：面向内地用户提供服务的 `.cn` 网站，合规做法仍是完成 ICP 备案后落在内地节点。

---

## 3. 路线 A：Vercel 临时上线（最快，不改 baolimei.cn）

在项目目录执行：

```bash
npx vercel login          # 浏览器里授权
npx vercel --prod         # 首次会问项目名，一路回车
```

部署完成后会得到一个 `https://<project>.vercel.app` 地址，直接可访问。
在 Vercel 项目 → Settings → Environment Variables 里加上：

```
NEXT_PUBLIC_SITE_URL=https://<project>.vercel.app
NEXT_PUBLIC_ICP_BEIAN=备案中
NEXT_PUBLIC_COMPANY=流花
```

然后 Redeploy。

**如果要绑定 baolimei.cn**（不建议在备案审核期做）：

1. Vercel → Domains → 添加 `baolimei.cn`，它会给出记录值。
2. 阿里云控制台 → 云解析 DNS → `baolimei.cn` → 解析设置 → 添加记录：

| 记录类型 | 主机记录 | 记录值 | TTL |
| --- | --- | --- | --- |
| A | `@` | `76.76.21.21` | 600 |
| CNAME | `www` | `cname.vercel-dns.com` | 600 |

3. 等待 10 分钟，用 `node scripts/check-domain.mjs baolimei.cn` 自检。

---

## 4. 路线 B/C：Docker 部署到服务器（推荐）

### 4.1 买机器

- 过渡：阿里云**香港**轻量应用服务器，镜像选 Ubuntu 22.04，开放 80/443。
- 最终：阿里云**内地** ECS 或轻量（2核2G 起），**必须已完成备案**，安全组放行 80/443/22。

### 4.2 小内存机器先加 swap（2核2G 必看）

`next build` 在 2G 内存上可能被 OOM 杀掉，先加 2G swap：

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
free -h
```

或者在本机构建好镜像再传上去：

```bash
docker build -t baolimei/web:latest .
docker save baolimei/web:latest | gzip | ssh root@<服务器IP> 'gunzip | docker load'
ssh root@<服务器IP> 'cd /srv/baolimei && docker compose up -d'
```

### 4.3 上传并启动

```bash
# 服务器上
apt update && apt install -y git nginx
curl -fsSL https://get.docker.com | sh

git clone <你的仓库地址> /srv/baolimei && cd /srv/baolimei
cp .env.example .env
vim .env      # 至少改 NEXT_PUBLIC_SITE_URL
bash deploy/deploy.sh
```

看到 `✓ 服务已启动：http://127.0.0.1:3000` 后，本机 `curl http://127.0.0.1:3000/api/health` 应返回 `"ok": true`。

### 4.4 Nginx 反代 + HTTPS

```bash
cp deploy/nginx.conf /etc/nginx/conf.d/baolimei.conf
nginx -t && systemctl reload nginx

# 方式一：Let's Encrypt（海外/香港机器好用）
apt install -y certbot python3-certbot-nginx
certbot --nginx -d baolimei.cn -d www.baolimei.cn

# 方式二：阿里云免费 SSL 证书（内地机器更稳）
# 数字证书管理服务 → 免费证书 → 下载 Nginx 版 → 上传到 /etc/nginx/ssl/
# 然后把 nginx.conf 里的 ssl_certificate 路径改成实际文件
```

### 4.5 加解析（备案下号后再做）

阿里云控制台 → 云解析 DNS → `baolimei.cn` → 解析设置：

| 记录类型 | 主机记录 | 记录值 | TTL | 说明 |
| --- | --- | --- | --- | --- |
| A | `@` | `<服务器公网 IP>` | 600 | 主站 |
| A | `www` | `<服务器公网 IP>` | 600 | 或改成 CNAME 到 `baolimei.cn` |

删掉旧的冲突记录（如有）。10 分钟后执行：

```bash
node scripts/check-domain.mjs baolimei.cn
```

期望输出：`A @` 显示你的 IP、`https://baolimei.cn/` 返回 `HTTP 200`。

---

## 5. 备案号接入（下号后必做）

1. 编辑 `.env`：

```bash
NEXT_PUBLIC_ICP_BEIAN=京ICP备2026XXXXXX号-1
NEXT_PUBLIC_PSB_BEIAN=京公网安备1101XXXXXXXX号   # 有就填
```

2. 重新构建并重启：

```bash
docker compose build && docker compose up -d
```

3. 打开首页，页脚左下角会出现备案号并链接到 `https://beian.miit.gov.cn/`。
   按工信部要求，备案号需在网站**首页底部**可见；公安备案下来后同样加到页脚。

> Vercel 部署时改环境变量后需要 Redeploy 才会生效（构建时注入）。

---

## 6. 我需要你提供的信息（给我就能远程做完）

三选一即可：

1. **Vercel Token**：Vercel → Account Settings → Tokens → Create，把 token 发我，我直接 `vercel --prod` 部署并给你访问地址。
2. **阿里云 AccessKey**（仅 `AliyunDNSFullAccess` + 目标机器权限）：我可以用 API 直接添加解析记录；若能 SSH，还能把服务装好。
3. **服务器 SSH**（IP + 用户名 + 密码/密钥）：我远程完成 Docker 部署 + Nginx + 证书 + 解析核对。

> 建议用子账号 AccessKey 并限制权限，用完随时禁用。

---

## 7. 上线后检查清单

- [ ] `https://baolimei.cn` 返回 200，`http://` 自动跳转 https
- [ ] `www` 能访问（跳转到主域或同样返回 200）
- [ ] 首页页脚显示真实备案号
- [ ] `/studio` 能生成占位结果，`/canvas` 能拖拽连线、刷新后保留
- [ ] `/robots.txt`、`/sitemap.xml` 正常
- [ ] `/api/health` 返回 `"mode":"demo"`
- [ ] 手机浏览器打开无横向滚动
- [ ] 提交 sitemap 到百度搜索资源平台 / 必应 / Google

## 8. 常见问题

**站点能打开但样式全丢** → 反向代理漏了 `/_next/static/`，确认 `deploy/nginx.conf` 整段被加载、Nginx 已 reload。

**502 Bad Gateway** → 容器没起来：`docker compose logs -f web`；确认端口是 `127.0.0.1:3000`。

**证书申请失败** → 80 端口没放行，或域名还没解析到本机。先用 `curl -I http://<IP>` 验证。

**改了 `.env` 但页脚没变** → `NEXT_PUBLIC_*` 是构建期变量，必须 `docker compose build --no-cache && docker compose up -d`。

**手机打开是空白/一直加载** → 检查浏览器版本；本项目未使用任何境外 CDN 资源，内地访问不需要科学上网。
