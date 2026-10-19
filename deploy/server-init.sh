#!/usr/bin/env bash
# 阿里云 ECS 初始化脚本（Ubuntu 22.04 / 24.04）
# 完成：swap、Docker、Nginx、certbot、防火墙
# 用法：bash deploy/server-init.sh
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "请用 root 执行：sudo bash deploy/server-init.sh"
  exit 1
fi

echo "==> 系统信息"
. /etc/os-release
echo "    $PRETTY_NAME  $(uname -r)"
if [ "${ID:-}" != "ubuntu" ]; then
  echo "⚠ 当前不是 Ubuntu。CentOS 7 已于 2024-06 EOL，建议在阿里云控制台『更换操作系统』为 Ubuntu 22.04 再执行本脚本。"
fi

echo "==> 1/4 配置 2G swap（2C2G 机器构建 Next.js 必需）"
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "    swap 已启用"
else
  echo "    swap 已存在，跳过"
fi
free -h | sed 's/^/    /'

echo "==> 2/4 安装 Docker（阿里云镜像）"
if ! command -v docker >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg git nginx
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://mirrors.aliyun.com/docker-ce/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://mirrors.aliyun.com/docker-ce/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  # 国内加速（可选）
  mkdir -p /etc/docker
  cat > /etc/docker/daemon.json <<'JSON'
{
  "registry-mirrors": ["https://docker.mirrors.ustc.edu.cn", "https://hub-mirror.c.163.com"],
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
JSON
  systemctl restart docker
  echo "    Docker $(docker --version) 安装完成"
else
  echo "    Docker 已安装：$(docker --version)"
fi

echo "==> 3/4 安装 certbot + 防火墙"
apt-get install -y certbot python3-certbot-nginx || true
if command -v ufw >/dev/null 2>&1; then
  ufw allow 22/tcp || true
  ufw allow 80/tcp || true
  ufw allow 443/tcp || true
fi
echo "    记得在阿里云安全组放行 22 / 80 / 443"

echo "==> 4/4 完成"
echo "下一步："
echo "  1) git clone <仓库> /srv/baolimei && cd /srv/baolimei"
echo "  2) cp .env.example .env && vim .env    # 填 NEXT_PUBLIC_SITE_URL / NEXT_PUBLIC_ICP_BEIAN / NEXT_PUBLIC_COMPANY"
echo "  3) bash deploy/deploy.sh"
echo "  4) cp deploy/nginx.conf /etc/nginx/conf.d/baolimei.conf && nginx -t && systemctl reload nginx"
echo "  5) certbot --nginx -d baolimei.cn -d www.baolimei.cn"
