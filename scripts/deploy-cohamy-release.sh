#!/usr/bin/env bash
# Run on the verified Cohamy VPS. Deploys one committed revision; preserves the old app.
set -euo pipefail
umask 077
export PATH="/root/.nvm/versions/node/v20.19.6/bin:$PATH"
SHA="${1:?Pass the exact 40-character commit SHA}"
[[ "$SHA" =~ ^[a-f0-9]{40}$ ]] || exit 2
CUTOVER=0
SHARED=/root/cohamy-shared
PREVIOUS=/root/cohamy
if [[ -f "$SHARED/current-release" ]]; then
  PREVIOUS="$(<"$SHARED/current-release")"
  [[ "$PREVIOUS" =~ ^/root/cohamy-releases/[a-f0-9]{40}$ ]] || exit 2
fi
RELEASE="/root/cohamy-releases/$SHA"
BACKUP="/root/cohamy-backups/$(date -u +%Y%m%dT%H%M%SZ)-${SHA:0:12}"
test -d "$PREVIOUS/.git"
test ! -e "$RELEASE"
finish() {
  result=$?
  if [[ -n "${CANDIDATE_PID:-}" ]]; then kill "$CANDIDATE_PID" 2>/dev/null || true; fi
  if [[ "$result" != 0 && "$CUTOVER" = 1 ]]; then
    # Source rollback preserves the additive database and all business history.
    pm2 delete cohamy >/dev/null 2>&1 || true
    pm2 delete cohamy-crm-worker >/dev/null 2>&1 || true
    COHAMY_NODE_BINARY="$SHARED/node22/bin/node" pm2 start "$PREVIOUS/ecosystem.config.js" --only cohamy --env production --update-env
    if [[ -f "$PREVIOUS/scripts/crm/backup-restore.ts" ]]; then
      COHAMY_NODE_BINARY="$SHARED/node22/bin/node" pm2 start "$PREVIOUS/ecosystem.config.js" --only cohamy-crm-worker --env production --update-env
    else systemctl stop cohamy-backup.timer 2>/dev/null || true; fi
    pm2 save
    git -C "$PREVIOUS" rev-parse HEAD > "$SHARED/current-sha"
    printf '%s\n' "$PREVIOUS" > "$SHARED/current-release"
    printf 'SOURCE_ROLLBACK=%s\n' "$PREVIOUS"
  fi
  exit "$result"
}
trap finish EXIT
mkdir -p "$SHARED" /root/cohamy-releases "$BACKUP"
chmod 700 "$SHARED" /root/cohamy-releases /root/cohamy-backups "$BACKUP"
# Install a checksum-verified Node 22 runtime without changing other applications.
if [[ ! -x "$SHARED/node22/bin/node" ]]; then
  curl -fsSL https://nodejs.org/dist/index.json -o "$BACKUP/node-index.json"
  NODE_VERSION="$(node -e 'const v=require(process.argv[1]).find(v=>/^v22\./.test(v.version)&&v.lts);if(!v)process.exit(1);process.stdout.write(v.version)' "$BACKUP/node-index.json")"
  NODE_ARCH="$(uname -m)"
  case "$NODE_ARCH" in x86_64) NODE_ARCH=x64;; aarch64) NODE_ARCH=arm64;; *) exit 2;; esac
  NODE_ARCHIVE="node-$NODE_VERSION-linux-$NODE_ARCH.tar.xz"
  curl -fsSL "https://nodejs.org/dist/$NODE_VERSION/$NODE_ARCHIVE" -o "$BACKUP/$NODE_ARCHIVE"
  curl -fsSL "https://nodejs.org/dist/$NODE_VERSION/SHASUMS256.txt" -o "$BACKUP/node-SHASUMS256.txt"
  (cd "$BACKUP" && grep " $NODE_ARCHIVE\$" node-SHASUMS256.txt | sha256sum -c -)
  mkdir -p "$SHARED/node22"
  tar -xJf "$BACKUP/$NODE_ARCHIVE" --strip-components=1 -C "$SHARED/node22"
fi
export PATH="$SHARED/node22/bin:$PATH" COHAMY_NODE_BINARY="$SHARED/node22/bin/node"
node --version
cp "$PREVIOUS/.env.production" "$BACKUP/previous.env.production"
git -C "$PREVIOUS" diff --binary > "$BACKUP/previous-working-tree.patch"
git -C "$PREVIOUS" rev-parse HEAD > "$BACKUP/previous-sha.txt"
pm2 jlist | node -e 'let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>require("fs").writeFileSync(process.argv[1],JSON.stringify(JSON.parse(s).filter(a=>a.name==="cohamy")),{mode:0o600}));' "$BACKUP/pm2-private.json"
tar --exclude=node_modules --exclude=.next --exclude=.git -czf "$BACKUP/previous-source.tar.gz" -C "$PREVIOUS" .
sha256sum "$BACKUP/previous-source.tar.gz" > "$BACKUP/SHA256SUMS"
git clone --quiet https://github.com/nguyenthenguyen2006-oss/cohamy-website.git "$RELEASE"
git -C "$RELEASE" checkout --quiet --detach "$SHA"
test "$(git -C "$RELEASE" rev-parse HEAD)" = "$SHA"
cd "$RELEASE"
npm ci --no-audit --no-fund

# A dedicated database instance; never reuse the HumanBank database/container.
if [[ ! -f "$SHARED/postgres.env" ]]; then
  test -z "$(docker ps -aq --filter name='^cohamy-crm-postgres$')"
  test -z "$(ss -lntH 'sport = :55432')"
  DB_PASSWORD="$(openssl rand -hex 32)"
  printf 'POSTGRES_USER=cohamy_owner\nPOSTGRES_DB=cohamy_crm\nPOSTGRES_PASSWORD=%s\n' "$DB_PASSWORD" > "$SHARED/postgres.env"
fi
if ! docker inspect cohamy-crm-postgres >/dev/null 2>&1; then
  docker run -d --name cohamy-crm-postgres --restart unless-stopped \
    --env-file "$SHARED/postgres.env" -p 127.0.0.1:55432:5432 \
    -v cohamy-crm-postgres-data:/var/lib/postgresql/data \
    --health-cmd='pg_isready -U cohamy_owner -d cohamy_crm' --health-interval=5s \
    --health-timeout=3s --health-retries=20 postgres:17-alpine
fi
for attempt in {1..30}; do
  if docker exec cohamy-crm-postgres pg_isready -U cohamy_owner -d cohamy_crm >/dev/null; then break; fi
  sleep 2
done
docker exec cohamy-crm-postgres pg_isready -U cohamy_owner -d cohamy_crm
set -a
source "$SHARED/postgres.env"
set +a
export CRM_DATABASE_MODE=postgres CRM_DATABASE_URL="postgresql://cohamy_owner:$POSTGRES_PASSWORD@127.0.0.1:55432/cohamy_crm"
export CRM_ENVIRONMENT=PRODUCTION CRM_PUBLIC_ORIGIN=https://cohamy.vn NODE_ENV=production
# Preserve a verified pre-migration database including every row and bytea.
# pg_dump and the row manifests share the same exported PostgreSQL snapshot.
CRM_BACKUP_ROOT="$BACKUP/pre-migration" CRM_BACKUP_PUBLIC_UPLOAD_DIR="$SHARED/uploads/blog" node --require ./scripts/register-server-only.cjs --import tsx scripts/crm/backup-restore.ts > "$BACKUP/pre-migration-restore.json"
npm run crm:init -- --catalog
if [[ "$(docker exec cohamy-crm-postgres psql -U cohamy_owner -d cohamy_crm -Atc 'SELECT count(*) FROM cohamy_crm.users')" = 0 ]]; then
  export CRM_BOOTSTRAP_EMAIL=cohamyvietnam@gmail.com CRM_BOOTSTRAP_NAME='Quản trị Cohamy'
  export CRM_BOOTSTRAP_PASSWORD="$(openssl rand -base64 24)"
  npm run crm:init -- --bootstrap
  node -e 'require("fs").writeFileSync(process.argv[1],JSON.stringify({email:process.env.CRM_BOOTSTRAP_EMAIL,password:process.env.CRM_BOOTSTRAP_PASSWORD,url:"https://cohamy.vn/crm/login"},null,2)+"\n",{mode:0o600})' "$SHARED/initial-admin.json"
  unset CRM_BOOTSTRAP_EMAIL CRM_BOOTSTRAP_NAME CRM_BOOTSTRAP_PASSWORD
fi
# Runtime has DML only. Migration owner credentials remain in the protected shared directory.
if [[ ! -f "$SHARED/runtime-password" ]]; then openssl rand -hex 32 > "$SHARED/runtime-password"; fi
RUNTIME_PASSWORD="$(<"$SHARED/runtime-password")"
docker exec -i cohamy-crm-postgres psql -v ON_ERROR_STOP=1 -U cohamy_owner -d cohamy_crm <<SQL
DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='cohamy_runtime') THEN CREATE ROLE cohamy_runtime LOGIN PASSWORD '$RUNTIME_PASSWORD'; END IF; END \$\$;
GRANT CONNECT ON DATABASE cohamy_crm TO cohamy_runtime;
GRANT USAGE ON SCHEMA cohamy_crm TO cohamy_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA cohamy_crm TO cohamy_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA cohamy_crm TO cohamy_runtime;
REVOKE ALL ON cohamy_crm.migrations FROM cohamy_runtime;
REVOKE UPDATE, DELETE ON cohamy_crm.audit_events,cohamy_crm.activities,cohamy_crm.document_versions,cohamy_crm.application_history,cohamy_crm.support_messages,cohamy_crm.opportunity_history,cohamy_crm.partner_visits,cohamy_crm.custom_field_versions,cohamy_crm.custom_value_history FROM cohamy_runtime;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
SQL
export CRM_DATABASE_URL="postgresql://cohamy_runtime:$RUNTIME_PASSWORD@127.0.0.1:55432/cohamy_crm"
export COHAMY_PREVIOUS_ENV="$BACKUP/previous.env.production"
BLOG_SOURCE="$(node -e 'const fs=require("fs"),c=require("node:util").parseEnv(fs.readFileSync(process.env.COHAMY_PREVIOUS_ENV,"utf8"));const s=c.BLOG_SOURCE||"legacy";if(!["legacy","wordpress","sheets"].includes(s))process.exit(2);process.stdout.write(s);')"
export BLOG_SOURCE CRM_WEBSITE_ORDER_INTAKE=true
export CRM_REGISTRATION_MODE=OPEN
export UPLOAD_DIR="$SHARED/uploads/blog" NEXT_PUBLIC_UPLOAD_BASE_URL=https://cohamy.vn/uploads/blog
mkdir -p "$UPLOAD_DIR"
node -e 'const fs=require("fs");const keys=["CRM_DATABASE_MODE","CRM_DATABASE_URL","CRM_ENVIRONMENT","CRM_PUBLIC_ORIGIN","CRM_WEBSITE_ORDER_INTAKE","CRM_REGISTRATION_MODE","BLOG_SOURCE","UPLOAD_DIR","NEXT_PUBLIC_UPLOAD_BASE_URL"];const old=fs.readFileSync(process.env.COHAMY_PREVIOUS_ENV,"utf8").split(/\r?\n/).filter(l=>!keys.some(k=>l.startsWith(k+"="))&&!l.startsWith("CRM_BOOTSTRAP_")&&!l.startsWith("CRM_LOCAL_DATA_DIR=")).join("\n");fs.writeFileSync(".env.production",old+"\n"+keys.map(k=>k+"="+process.env[k]).join("\n")+"\n",{mode:0o600});'
npm run build
npm run test:crm:build

# Verify the migrated database dynamically, without assumptions about real counts.
CRM_DATABASE_URL="postgresql://cohamy_owner:$POSTGRES_PASSWORD@127.0.0.1:55432/cohamy_crm" CRM_BACKUP_ROOT="$BACKUP/before-cutover" CRM_BACKUP_PUBLIC_UPLOAD_DIR="$UPLOAD_DIR" node --require ./scripts/register-server-only.cjs --import tsx scripts/crm/backup-restore.ts > "$BACKUP/before-cutover-restore.json"
(cd "$BACKUP" && sha256sum -c SHA256SUMS)

# Next normalizes rewrite hosts to localhost; use the same loopback hostname
# to avoid self-proxying localized rewrites on the production server.
node node_modules/next/dist/bin/next start --hostname localhost --port 4312 > "$BACKUP/candidate.log" 2>&1 &
CANDIDATE_PID=$!
for attempt in {1..30}; do if curl -fsS http://localhost:4312/api/health > "$BACKUP/candidate-health.json"; then break; fi; sleep 2; done
curl -fsS http://localhost:4312/api/health > "$BACKUP/candidate-health.json"
curl -fsS http://localhost:4312/crm/login > /dev/null
test "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:4312/api/crm/work/orders)" = 401
node scripts/crm/verify-production-smoke.mjs http://localhost:4312 "$SHARED/initial-admin.json" "$BACKUP/candidate-smoke.json"
kill "$CANDIDATE_PID" 2>/dev/null || true
CANDIDATE_PID=
unset CRM_DATABASE_URL CRM_DATABASE_MODE CRM_ENVIRONMENT CRM_PUBLIC_ORIGIN CRM_WEBSITE_ORDER_INTAKE BLOG_SOURCE UPLOAD_DIR NEXT_PUBLIC_UPLOAD_BASE_URL POSTGRES_PASSWORD POSTGRES_USER POSTGRES_DB
# Reload retains the old npm script/cwd when switching between release directories.
# Replace only Cohamy's process registration; source/data and other apps are untouched.
CUTOVER=1
if pm2 describe cohamy >/dev/null 2>&1; then pm2 delete cohamy; fi
if pm2 describe cohamy-crm-worker >/dev/null 2>&1; then pm2 delete cohamy-crm-worker; fi
pm2 start "$RELEASE/ecosystem.config.js" --only cohamy --env production --update-env
pm2 start "$RELEASE/ecosystem.config.js" --only cohamy-crm-worker --env production --update-env
# A registration response alone is not proof that the worker loaded its runtime.
sleep 10
pm2 jlist | node -e 'let s="";process.stdin.on("data",c=>s+=c);process.stdin.on("end",()=>{const apps=JSON.parse(s).filter(a=>["cohamy","cohamy-crm-worker"].includes(a.name));if(apps.length!==2||apps.some(a=>a.pm2_env.status!=="online"||a.pm2_env.pm_cwd!==process.argv[1]||a.pm2_env.restart_time!==0))process.exit(2);require("fs").writeFileSync(process.argv[2],JSON.stringify(apps.map(a=>({name:a.name,pid:a.pid,status:a.pm2_env.status,cwd:a.pm2_env.pm_cwd,restarts:a.pm2_env.restart_time}))),{mode:0o600});});' "$RELEASE" "$BACKUP/runtime-health.json"
pm2 save
curl --retry 10 --retry-delay 2 --retry-connrefused -fsS https://cohamy.vn/api/health > "$BACKUP/public-health.json"
printf '%s\n' "$SHA" > "$SHARED/current-sha"
printf '%s\n' "$RELEASE" > "$SHARED/current-release"
bash scripts/crm/install-backup-timer.sh
CUTOVER=0
printf 'DEPLOYED_SHA=%s\nRELEASE=%s\nBACKUP=%s\n' "$SHA" "$RELEASE" "$BACKUP"
