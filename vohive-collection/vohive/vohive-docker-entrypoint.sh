#!/bin/sh
set -eu

/usr/local/sbin/multi-modem-bind.sh >/dev/null 2>&1 || true

exec /app/vo-hive "$@"
