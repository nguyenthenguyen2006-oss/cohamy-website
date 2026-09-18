#!/usr/bin/env python3
"""Run only the currently deployed Cohamy backup tool; keep owner credentials private."""
import datetime
import json
import os
import pathlib
import re
import subprocess
shared = pathlib.Path('/root/cohamy-shared')
status = shared / 'backup-status.json'
try:
    release = pathlib.Path((shared / 'current-release').read_text().strip()).resolve()
    if not re.fullmatch(r'/root/cohamy-releases/[a-f0-9]{40}', str(release)):
        raise RuntimeError('VERIFIED_RELEASE_PATH_REQUIRED')
    private = dict(line.split('=', 1) for line in (shared / 'postgres.env').read_text().splitlines() if '=' in line)
    environment = dict(os.environ)
    environment.update(PATH=str(shared / 'node22/bin') + ':' + environment.get('PATH', ''),
                       CRM_DATABASE_URL='postgresql://cohamy_owner:' + private['POSTGRES_PASSWORD'] + '@127.0.0.1:55432/cohamy_crm',
                       CRM_BACKUP_ROOT='/root/cohamy-backups/scheduled',
                       CRM_BACKUP_PUBLIC_UPLOAD_DIR='/root/cohamy-shared/uploads/blog',
                       CRM_BACKUP_RETENTION_DAYS=environment.get('CRM_BACKUP_RETENTION_DAYS', '30'),
                       CRM_BACKUP_MIN_COPIES=environment.get('CRM_BACKUP_MIN_COPIES', '7'))
    result = subprocess.run([str(shared / 'node22/bin/node'), '--require', './scripts/register-server-only.cjs', '--import', 'tsx', 'scripts/crm/backup-restore.ts'], cwd=release, env=environment)
    report = {'status': 'PASS' if result.returncode == 0 else 'FAIL', 'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'release': str(release)}
    status.write_text(json.dumps(report))
    status.chmod(0o600)
    raise SystemExit(result.returncode)
except Exception:
    status.write_text(json.dumps({'status': 'FAIL', 'at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'reason': 'BACKUP_OPERATOR_CHECK_REQUIRED'}))
    status.chmod(0o600)
    raise SystemExit(1)
