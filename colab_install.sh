#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

echo "[1/5] Installing Linux packages..."
apt-get update -y
apt-get install -y aria2 curl wget unzip build-essential python3 make g++ ffmpeg ca-certificates

echo "[2/5] Installing nvm + Node 20 if needed..."
export NVM_DIR="$HOME/.nvm"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi
. "$NVM_DIR/nvm.sh"
nvm install 20
nvm use 20
node -v
npm -v

echo "[3/5] Preparing env and folders..."
mkdir -p backend/data storage/temp storage/completed logs
if [ ! -f .env ]; then
  cp .env.colab.example .env
fi

echo "[4/5] Installing Node dependencies..."
npm install

echo "[5/5] Installing cloudflared tunnel helper..."
if ! command -v cloudflared >/dev/null 2>&1; then
  wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O /usr/local/bin/cloudflared
  chmod +x /usr/local/bin/cloudflared
fi

echo "Done. Next run: bash colab_start.sh then bash colab_tunnel.sh"
