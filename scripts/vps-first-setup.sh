#!/usr/bin/env bash
# One-time setup on Hostinger VPS (run as root or with sudo)
set -euo pipefail

APP_DIR="/var/www/cohamy"
REPO_URL="${1:-}"

if [ -z "$REPO_URL" ]; then
  echo "Usage: bash vps-first-setup.sh https://github.com/USER/cohamy-website.git"
  exit 1
fi

apt-get update
apt-get install -y curl git nginx

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

npm install -g pm2

mkdir -p "$(dirname "$APP_DIR")"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"
npm ci
cp -n .env.example .env.production 2>/dev/null || true
npm run build
pm2 start ecosystem.config.js --env production || pm2 reload ecosystem.config.js --env production
pm2 save
pm2 startup systemd -u "${SUDO_USER:-root}" --hp "$(eval echo ~${SUDO_USER:-root})"

echo "Done. Edit $APP_DIR/.env.production then: pm2 reload cohamy"