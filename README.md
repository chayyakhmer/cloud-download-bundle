# Cloud Download MVP Bundle - aria2 RPC Version

This is a PikPak-style cloud download MVP using one long-running aria2 RPC daemon.

```text
Frontend + API on same port :6745
  /                  frontend app
  /api/*             backend API
  /media/*           completed files

Node Worker
  ↓
aria2 RPC daemon :6800
  ↓
storage/temp
  ↓
storage/completed
```

## Why this version is better

The old worker spawned a new `aria2c` process for every task. Magnet links were slow because DHT/peer discovery started cold each time.

This version uses:

```text
Node Worker → long-running aria2 RPC daemon
```

Benefits:

```text
- warmer DHT
- faster magnet metadata discovery
- better progress tracking
- easier pause/resume later
- direct URL and magnet handled by same engine
```

Use only files you own, public-domain torrents, Linux ISOs, or content you have permission to download/share.

## Requirements

### Node

Use Node 20 LTS:

```powershell
nvm use 20.20.2
node -v
```

Expected:

```text
v20.20.2
```

### Install aria2 and yt-dlp

Windows:

```powershell
winget install aria2.aria2
winget install yt-dlp.yt-dlp
```

Check:

```powershell
aria2c --version
yt-dlp --version
```

## Install app

```powershell
cd C:\Users\Kim\Desktop\Current_Project\cloud-download-bundle-rpc
nvm use 20.20.2
npm install
copy .env.example .env
```

## Run

Open 3 terminals.

### Terminal 1: app server

```powershell
npm start
```

Open:

```text
http://localhost:6745
```

### Terminal 2: aria2 RPC daemon

```powershell
npm run aria2
```

This keeps aria2 running on:

```text
http://127.0.0.1:6800/jsonrpc
```

### Terminal 3: download worker

```powershell
npm run worker
```

## Quick test

Use this direct URL first:

```text
https://proof.ovh.net/files/10Mb.dat
```

Expected:

```text
queued → downloading → completed
```

## Magnet behavior

For a magnet task, aria2 first downloads metadata:

```text
[METADATA] task completes
followedBy = real download GID
```

Then the worker follows the real GID automatically and updates progress.

If magnet stays at 0B, common causes are:

```text
- no peers / seeders
- firewall blocks aria2c
- ISP/router blocks BitTorrent
- unhealthy magnet
```

Windows Firewall should allow:

```text
aria2c.exe
node.exe
TCP/UDP 6881
```

## Scripts

```text
npm start       run frontend + API on port 6745
npm run aria2   run long-running aria2 RPC daemon
npm run worker  run background worker that talks to aria2 RPC
npm run dev     run all three together
```

## API

Create tasks:

```http
POST /api/tasks
Content-Type: application/json

{
  "links": ["https://proof.ovh.net/files/10Mb.dat"],
  "folder": "Default Folder"
}
```

List tasks:

```http
GET /api/tasks
```

## Notes

- Completed files are served from `/media/*`.
- Database is SQLite at `backend/data/app.db` by default.
- This bundle removed `@vscode/sqlite3`; it uses `better-sqlite3` only.
- The worker uses aria2 RPC for direct URL, torrent, and magnet links.
- `yt-dlp` is still used for supported video-platform links.

## Task controls

Each task row in the modal supports:

```text
Queued      → Start / Stop
Downloading → Pause / Stop
Paused      → Start / Stop / Delete
Failed      → Retry / Delete
Completed   → Open / Delete
```

The backend routes are:

```text
POST   /api/tasks/:id/start
POST   /api/tasks/:id/pause
POST   /api/tasks/:id/resume
POST   /api/tasks/:id/stop
POST   /api/tasks/:id/retry
DELETE /api/tasks/:id
```

Torrent behavior:

```text
--seed-time=0          stops seeding after completion
--max-upload-limit=1K  limits upload while downloading
```


## UI update: file name and folder

The task modal now shows the real file name after aria2 receives metadata. It also shows the download folder path from `download_folder`; before metadata is available it shows the selected save folder.

DB columns added: `display_name`, `download_folder`.

---

# Colab quick start

This bundle includes Colab helper scripts:

```bash
bash colab_install.sh
bash colab_start.sh
bash colab_tunnel.sh
```

Run order in Colab:

```bash
!git clone https://github.com/YOUR_NAME/YOUR_REPO.git cloud-download-app
%cd cloud-download-app
!bash colab_install.sh
!bash colab_start.sh
!bash colab_tunnel.sh
```

Open the printed Cloudflare tunnel URL.
