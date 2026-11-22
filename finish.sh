#!/bin/bash
# Publish BLACKLINE 2 to GitHub, point the game at your Render server, and confirm player data is saved in Postgres.
# Run on your Mac from this folder:   bash finish.sh
set -euo pipefail
cd "$(dirname "$0")"
echo "Open dashboard.render.com, click your BLACKLINE 2 service, and copy the address under its name (ends in .onrender.com)."
open "https://dashboard.render.com/" 2>/dev/null || true
read -rp "Paste your Render address: " SURL </dev/tty
SURL=$(printf '%s' "$SURL" | tr -d '[:space:]'); SURL=${SURL%/}; case "$SURL" in http*) ;; *) SURL="https://$SURL";; esac
WS="wss://${SURL#https://}/ws"; WS=${WS#wss://http://}
perl -pi -e "s#const MP_DEFAULT_SERVER = '[^']*'#const MP_DEFAULT_SERVER = '$WS'#" src/net.js docs/index.html
echo "Game will connect to $WS"
bash publish.sh
echo "Waiting for Render to deploy the new server (usually 2-5 minutes)…"
for i in $(seq 1 60); do
  S=$(curl -s --max-time 30 "$SURL/api/status" || true)
  case "$S" in *postgres*) echo; echo "✓ Live. Player data is saved in Postgres: $S"; echo "  Play online: $SURL"; exit 0;;
               *file*) echo; echo "✗ The server is running but has no DATABASE_URL. In Render: Environment, add DATABASE_URL, Save, then run this again."; exit 1;; esac
  printf '.'; sleep 10
done
echo; echo "Render is still deploying. Open $SURL/api/status in a few minutes; it should say postgres."
