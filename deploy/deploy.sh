#!/usr/bin/env bash
# 服务器一键部署（Docker 方式，适用于阿里云 ECS / 香港轻量 / 任意 Linux）
# 用法：
#   bash deploy/deploy.sh             # 构建并启动
#   bash deploy/deploy.sh --no-cache  # 强制重新构建
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "→ 未找到 .env，从 .env.example 复制"
  cp .env.example .env
  echo "  请先编辑 .env 填写 NEXT_PUBLIC_ICP_BEIAN / NEXT_PUBLIC_SITE_URL 后再执行本脚本"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "✗ 未安装 Docker。可执行：curl -fsSL https://get.docker.com | sh"
  exit 1
fi

echo "→ 拉取代码最新版本（如为 git 仓库）"
if [ -d .git ]; then git pull --ff-only || true; fi

echo "→ 构建镜像"
if [ "${1:-}" = "--no-cache" ]; then
  docker compose build --no-cache
else
  docker compose build
fi

echo "→ 启动服务"
docker compose up -d

echo "→ 等待健康检查"
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    echo "✓ 服务已启动：http://127.0.0.1:3000"
    break
  fi
  sleep 2
  if [ "$i" = "30" ]; then
    echo "✗ 启动超时，请查看日志：docker compose logs -f web"
    exit 1
  fi
done

echo ""
echo "后续步骤："
echo "  1) 配置 Nginx：cp deploy/nginx.conf /etc/nginx/conf.d/baolimei.conf && nginx -t && systemctl reload nginx"
echo "  2) 申请证书：certbot --nginx -d baolimei.cn -d www.baolimei.cn"
echo "  3) 域名自检：node scripts/check-domain.mjs baolimei.cn"
