#!/usr/bin/env bash
# One-time: allow GitHub Actions to SSH deploy (run on VPS as root)
set -euo pipefail

DEPLOY_PUBKEY="${1:-}"

if [ -z "$DEPLOY_PUBKEY" ]; then
  echo "Usage: bash scripts/setup-github-deploy.sh 'ssh-ed25519 AAAA... github-deploy'"
  exit 1
fi

mkdir -p ~/.ssh
chmod 700 ~/.ssh
touch ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

if grep -qF "$DEPLOY_PUBKEY" ~/.ssh/authorized_keys 2>/dev/null; then
  echo "Deploy key already in authorized_keys"
else
  echo "$DEPLOY_PUBKEY" >> ~/.ssh/authorized_keys
  echo "Added github-deploy public key"
fi

echo "Done. Add GitHub Secrets: VPS_HOST, VPS_USER, VPS_SSH_KEY"
