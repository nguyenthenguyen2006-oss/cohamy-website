#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${1:-}"
if [ -z "$APP_DIR" ] || [ ! -f "$APP_DIR/package.json" ]; then
  echo "Usage: bash scripts/manual-deploy.sh /duong/dan/source-thuc-te"
  exit 1
fi

cd "$APP_DIR"

echo ">>> git pull"
git pull --ff-only origin main

echo ">>> npm ci"
npm ci

echo ">>> validate"
npm run test:cms
npm run lint
npx tsc --noEmit
npm audit --omit=dev
echo ">>> npm run build"
npm run build

echo ">>> pm2 restart"
if pm2 describe cohamy > /dev/null 2>&1; then
  pm2 reload ecosystem.config.js --env production
else
  pm2 start ecosystem.config.js --env production
fi
pm2 save

echo ">>> Build và reload hoàn tất. Tiếp tục chạy smoke test theo docs/CMS-DEPLOY.md"
