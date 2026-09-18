#!/usr/bin/env bash
set -euo pipefail
test "$(id -u)" = 0
test -f /root/cohamy-shared/current-release
test -f scripts/crm/backup-restore.ts
install -m 700 scripts/crm/run-backup.py /root/cohamy-shared/run-backup.py
install -m 644 scripts/crm/cohamy-backup.service /etc/systemd/system/cohamy-backup.service
install -m 644 scripts/crm/cohamy-backup.timer /etc/systemd/system/cohamy-backup.timer
systemd-analyze calendar '*-*-* 02:30:00 Asia/Ho_Chi_Minh' >/dev/null
systemctl daemon-reload
systemctl enable --now cohamy-backup.timer
systemctl start cohamy-backup.service
systemctl is-active cohamy-backup.timer
systemctl list-timers cohamy-backup.timer --no-pager
