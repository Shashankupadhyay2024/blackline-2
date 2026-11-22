#!/bin/bash
# Gives the Render server a free Postgres database (Neon) so player accounts and saves survive
# restarts. Run on your Mac from this folder:   bash setup-db.sh
# 1. Neon: signs you in (browser), creates a free "blackline-2" database (or reuses it)
# 2. Render: finds your blackline-2 service with an API key you paste, sets DATABASE_URL, redeploys
# 3. Points the game at your real Render address and publishes the update (publish.sh)
set -euo pipefail
cd "$(dirname "$0")"
LOG="$HOME/Desktop/blackline-setup.log"; exec > >(tee -a "$LOG") 2>&1    # everything is also saved to this log
trap 'echo; echo "✗ Stopped at line $LINENO: $BASH_COMMAND"; echo "  Full log: $LOG"' ERR
say() { printf '\n\033[1;33m▸ %s\033[0m\n' "$*"; }
command -v node >/dev/null || { say "Installing Node.js (needed for the Neon tool)…"; brew install node; }
command -v neon >/dev/null || { say "Installing the Neon CLI…"; npm i -g neon || sudo npm i -g neon; }
NEON="neon"
J() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{let j;try{j=JSON.parse(s)}catch(e){j=null};const f=$1;process.stdout.write(String(f(j)??''))})"; }

say "1/4  Neon: free Postgres (a browser window opens to sign in; GitHub or Google works)"
if ! $NEON me -o json >/dev/null 2>&1; then
  $NEON login </dev/tty >/dev/tty 2>&1      # interactive browser sign-in, straight to your Terminal
  $NEON me -o json >/dev/null 2>&1 || { echo "Neon sign-in did not finish. Run: neon login   then run this script again."; exit 1; }
fi
echo "Signed in to Neon."
PID=$($NEON projects list -o json 2>/dev/tty | J 'j=>{const a=Array.isArray(j)?j:(j&&j.projects)||[];const p=a.find(p=>p.name==="blackline-2");return p?p.id:""}')
if [ -z "$PID" ]; then
  PID=$($NEON projects create --name blackline-2 -o json | J 'j=>(j&&j.project&&j.project.id)||""')
  echo "Created Neon project $PID"
else echo "Using existing Neon project $PID"; fi
DBURL=$($NEON connection-string --project-id "$PID" | tail -1 | tr -d '[:space:]')
case "$DBURL" in postgres*) echo "Database ready.";; *) echo "Could not read the connection string from Neon."; exit 1;; esac

say "2/4  Render: paste an API key (the page opens now: Create API Key, name it blackline, copy it)"
open "https://dashboard.render.com/u/settings#api-keys" 2>/dev/null || true
read -rsp "Render API key: " RKEY </dev/tty; echo
RH=(-H "Authorization: Bearer $RKEY" -H "Accept: application/json")
find_service() { curl -fsS "${RH[@]}" "https://api.render.com/v1/services?limit=100" | J 'j=>{const a=(j||[]).map(x=>x.service||x);const s=a.find(s=>/blackline-2/.test((s.repo||"")+" "+s.name));return s?s.id+" "+((s.serviceDetails&&s.serviceDetails.url)||""):""}'; }
SVC=$(find_service) || { echo "Render did not accept that API key."; exit 1; }
if [ -z "$SVC" ]; then
  say "No blackline-2 service on Render yet. Creating it from the repo…"
  printf '%s' "$DBURL" | pbcopy
  echo "The database address is on your clipboard. On the page that opens, paste it into DATABASE_URL, then click Apply."
  open "https://render.com/deploy?repo=https://github.com/$(gh api user -q .login)/blackline-2" 2>/dev/null || true
  until [ -n "$SVC" ]; do read -rp "Press Enter after you clicked Apply… " _ </dev/tty; SVC=$(find_service); done
fi
SID=${SVC%% *}; SURL=${SVC#* }; SURL=${SURL:-https://blackline-2.onrender.com}
echo "Service $SID at $SURL"

say "3/4  Pointing the game at $SURL and publishing"
WS="wss://${SURL#https://}/ws"
perl -pi -e "s#const MP_DEFAULT_SERVER = '[^']*'#const MP_DEFAULT_SERVER = '$WS'#" src/net.js docs/index.html
bash publish.sh

say "4/4  Saving DATABASE_URL on Render and redeploying"
curl -fsS -X PUT "${RH[@]}" -H "Content-Type: application/json" "https://api.render.com/v1/services/$SID/env-vars/DATABASE_URL" \
  -d "$(node -e 'process.stdout.write(JSON.stringify({value:process.argv[1]}))' "$DBURL")" >/dev/null
curl -fsS -X POST "${RH[@]}" -H "Content-Type: application/json" "https://api.render.com/v1/services/$SID/deploys" -d '{}' >/dev/null
echo "Waiting for Render to deploy (usually 2-4 minutes)…"
for i in $(seq 1 60); do
  S=$(curl -s --max-time 20 "$SURL/api/status" || true)
  case "$S" in *postgres*) echo; echo "✓ Player data is now stored in Postgres and survives restarts: $S"; echo "  Game: $SURL"; exit 0;; esac
  printf '.'; sleep 10
done
echo; echo "Render is still deploying. Check $SURL/api/status in a few minutes; it should say \"postgres\"."
