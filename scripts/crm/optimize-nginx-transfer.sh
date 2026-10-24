#!/usr/bin/env bash
# Bounded Cohamy-only transfer tuning; no caching or proxy routing changes.
set -euo pipefail
umask 077
test "$(id -u)" = 0
CONFIG=/etc/nginx/fastpanel2-sites/cohamy_vn_usr/cohamy.vn.conf
test -f "$CONFIG"
nginx -t
BACKUP="/root/cohamy-backups/$(date -u +%Y%m%dT%H%M%SZ)-crm-transfer"
mkdir -p "$BACKUP"
chmod 700 "$BACKUP"
cp -L "$CONFIG" "$BACKUP/nginx.before.conf"
sha256sum "$BACKUP/nginx.before.conf" > "$BACKUP/SHA256SUMS"
rollback() {
  code=$?
  if [[ "$code" != 0 ]]; then
    cp "$BACKUP/nginx.before.conf" "$(readlink -f "$CONFIG")"
    nginx -t && nginx -s reload
  fi
  exit "$code"
}
trap rollback EXIT
python3 - "$CONFIG" <<'PY'
from pathlib import Path
import os,re,stat,sys
target=Path(sys.argv[1]).resolve()
assert str(target).startswith('/etc/nginx/fastpanel2-'), 'EXPLICIT_COHAMY_NGINX_CONFIG_REQUIRED'
source=target.read_text()
assert 'server_name cohamy.vn www.cohamy.vn' in source
assert 'server 127.0.0.1:3001;' in source
assert len(re.findall(r'^\s*gzip_types\s+[^;]+;',source,re.M))==1
def types(match):
    current=match.group(1).split()
    for mime in ['application/json','text/x-component','application/manifest+json','image/svg+xml','text/plain','application/wasm']:
        if mime not in current:current.append(mime)
    return '    gzip_types '+' '.join(current)+';'
updated=re.sub(r'^\s*gzip_types\s+([^;]+);',types,source,flags=re.M)
updated,count=re.subn(r'(^\s*gzip_comp_level\s+)\d+;',r'\g<1>5;',updated,flags=re.M)
assert count==1
if not re.search(r'^\s*gzip_vary\s+',updated,re.M):
    updated=updated.replace('gzip_comp_level 5;','gzip_comp_level 5;\n    gzip_vary on;')
assert 'private' in updated and 'no-store' in updated
candidate=target.with_name(target.name+'.performance-candidate')
candidate.write_text(updated)
os.chmod(candidate,stat.S_IMODE(target.stat().st_mode))
os.replace(candidate,target)
PY
nginx -t
nginx -s reload
cp -L "$CONFIG" "$BACKUP/nginx.after.conf"
trap - EXIT
printf 'COHAMY_TRANSFER_TUNING_BACKUP=%s\n' "$BACKUP"
