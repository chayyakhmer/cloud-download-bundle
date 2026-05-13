#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use 20 >/dev/null
mkdir -p logs backend/data storage/temp storage/completed

# Stop old local processes from previous cell runs.
pkill -f "backend/src/server.js" >/dev/null 2>&1 || true
pkill -f "backend/src/tools/start-aria2-rpc.js" >/dev/null 2>&1 || true
pkill -f "backend/src/workers/download.worker.js" >/dev/null 2>&1 || true
pkill -f "aria2c.*jsonrpc" >/dev/null 2>&1 || true

nohup npm start > logs/app.log 2>&1 &
echo $! > logs/app.pid
nohup npm run aria2 > logs/aria2.log 2>&1 &
echo $! > logs/aria2.pid
sleep 2
nohup npm run worker > logs/worker.log 2>&1 &
echo $! > logs/worker.pid

echo "Started app/aria2/worker. Local URL: http://127.0.0.1:6745"
echo "Check logs: tail -f logs/app.log logs/aria2.log logs/worker.log"
