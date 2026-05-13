# Colab Version - Cloud Download App

This version is prepared for Google Colab. It runs:

```text
Node app/API/frontend :6745
aria2 RPC daemon :6800
Node worker polling aria2 RPC
cloudflared tunnel for public browser access
```

Use only files you own, public-domain torrents, Linux ISOs, or content you have permission to download/share.

## Push to GitHub

```bash
git init
git add .
git commit -m "colab cloud download app"
git branch -M main
git remote add origin https://github.com/YOUR_NAME/YOUR_REPO.git
git push -u origin main
```

## Colab install from GitHub

In Colab cell 1:

```bash
!git clone https://github.com/YOUR_NAME/YOUR_REPO.git cloud-download-app
%cd cloud-download-app
!bash colab_install.sh
```

Cell 2:

```bash
%cd /content/cloud-download-app
!bash colab_start.sh
```

Cell 3:

```bash
%cd /content/cloud-download-app
!bash colab_tunnel.sh
```

Open the `trycloudflare.com` URL printed by Cell 3.

## Logs

```bash
!tail -f logs/app.log logs/aria2.log logs/worker.log
```

## Stop

```bash
!bash colab_stop.sh
```

## ENV changes

Use `.env.colab.example` as template. Main values:

```env
PORT=6745
ARIA2_RPC_URL=http://127.0.0.1:6800/jsonrpc
ARIA2_RPC_PORT=6800
ARIA2_RPC_SECRET=test123
ARIA2_MAX_UPLOAD_LIMIT=1K
```

`--seed-time=0` is set in the aria2 starter, so aria2 stops seeding after completion. `ARIA2_MAX_UPLOAD_LIMIT=1K` limits upload during download.

## DB note

SQLite DB is local inside Colab runtime:

```text
backend/data/app.db
```

Colab runtime storage is temporary. If Colab disconnects or resets, the DB/downloads may be lost unless you mount Google Drive and point `DB_PATH`, `TEMP_DIR`, and `COMPLETED_DIR` there.
