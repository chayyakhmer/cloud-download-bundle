#!/usr/bin/env bash
cd "$(dirname "$0")"
pkill -f "backend/src/server.js" >/dev/null 2>&1 || true
pkill -f "backend/src/tools/start-aria2-rpc.js" >/dev/null 2>&1 || true
pkill -f "backend/src/workers/download.worker.js" >/dev/null 2>&1 || true
pkill -f "aria2c.*jsonrpc" >/dev/null 2>&1 || true
echo "Stopped app/aria2/worker."
