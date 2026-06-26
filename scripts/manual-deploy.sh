#!/usr/bin/env bash
# Chạy trên VPS sau khi git push từ máy local
set -euo pipefail

APP_DIR="/root/cohamy"
cd "$APP_DIR"

echo ">>> git pull"
git pull origin main

echo ">>> npm install"
npm install

echo ">>> clear Next image cache"
rm -rf .next/cache

echo ">>> npm run build"
npm run build

echo ">>> pm2 restart"
if pm2 describe cohamy > /dev/null 2>&1; then
  pm2 reload ecosystem.config.js --env production
else
  pm2 start ecosystem.config.js --env production
fi
pm2 save

echo ">>> Done: https://cohamy.vn/vi"