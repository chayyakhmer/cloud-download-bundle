#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
PORT=${PORT:-6745}
echo "Starting public tunnel to http://localhost:${PORT}"
echo "Copy the trycloudflare URL shown below. Keep this cell running."
cloudflared tunnel --url "http://localhost:${PORT}"
