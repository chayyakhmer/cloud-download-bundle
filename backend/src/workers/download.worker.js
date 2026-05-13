const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const db = require('../db/database');
const aria2 = require('../services/aria2Rpc.service');
require('dotenv').config();

const TEMP_DIR = path.resolve(process.env.TEMP_DIR || './storage/temp');
const COMPLETED_DIR = path.resolve(process.env.COMPLETED_DIR || './storage/completed');
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 3000);
const ARIA2_STATUS_INTERVAL_MS = Number(process.env.ARIA2_STATUS_INTERVAL_MS || 2000);
const MAGNET_METADATA_TIMEOUT_MS = Number(process.env.MAGNET_METADATA_TIMEOUT_MS || 10 * 60 * 1000);

fs.mkdirSync(TEMP_DIR, { recursive: true });
fs.mkdirSync(COMPLETED_DIR, { recursive: true });

function updateTask(id, patch) {
  const keys = Object.keys(patch);
  if (!keys.length) return;
  const sql = `UPDATE cloud_download_tasks SET ${keys.map(k => `${k}=@${k}`).join(', ')}, updated_at=CURRENT_TIMESTAMP WHERE id=@id`;
  db.prepare(sql).run({ ...patch, id });
}

function findQueuedTask() {
  return db.prepare(`SELECT * FROM cloud_download_tasks WHERE status='queued' ORDER BY id ASC LIMIT 1`).get();
}

function largestFileRecursive(dir) {
  const files = [];
  function walk(d) {
    if (!fs.existsSync(d)) return;
    for (const item of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, item.name);
      if (item.isDirectory()) walk(p);
      else files.push(p);
    }
  }
  walk(dir);
  const keep = files.filter(f => {
    const base = path.basename(f).toLowerCase();
    return !base.endsWith('.aria2') && !base.endsWith('.torrent') && !base.includes('[metadata]');
  });
  keep.sort((a, b) => fs.statSync(b).size - fs.statSync(a).size);
  return keep[0];
}

function safeName(name) {
  return String(name || 'download.bin').replace(/[\\/:*?"<>|]/g, '_').trim() || 'download.bin';
}

function formatBytes(n) {
  const num = Number(n || 0);
  if (!Number.isFinite(num) || num <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = num;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function pickDisplayFromStatus(s) {
  try {
    const files = Array.isArray(s.files) ? s.files : [];
    const normalFiles = files
      .map(f => ({ ...f, lengthNum: Number(f.length || 0), pathStr: String(f.path || '') }))
      .filter(f => f.pathStr && !f.pathStr.includes('[METADATA]'))
      .sort((a, b) => b.lengthNum - a.lengthNum);

    if (normalFiles.length) {
      const mainPath = normalFiles[0].pathStr;
      return {
        display_name: path.basename(mainPath),
        download_folder: path.dirname(mainPath)
      };
    }

    const infoName = s.bittorrent && s.bittorrent.info && s.bittorrent.info.name;
    if (infoName) return { display_name: infoName, download_folder: s.dir || null };
  } catch (_) {}

  return { display_name: null, download_folder: s.dir || null };
}

function statusPatchFromAria2(s) {
  const total = Number(s.totalLength || 0);
  const done = Number(s.completedLength || 0);
  const speedNum = Number(s.downloadSpeed || 0);
  const progress = total > 0 ? Math.min(100, Math.floor((done / total) * 100)) : 0;
  const etaSeconds = speedNum > 0 && total > done ? Math.round((total - done) / speedNum) : null;
  const display = pickDisplayFromStatus(s);
  return {
    progress,
    total_size: formatBytes(total),
    downloaded_size: formatBytes(done),
    speed: `${formatBytes(speedNum)}/s${s.connections ? ` | ${s.connections} conn` : ''}${s.numSeeders ? ` | ${s.numSeeders} seed` : ''}`,
    eta: etaSeconds == null ? null : `${etaSeconds}s`,
    display_name: display.display_name,
    download_folder: display.download_folder
  };
}

function runYtDlp(task, tempPath) {
  return new Promise((resolve, reject) => {
    const args = ['-P', tempPath, '--newline', task.source_url];
    console.log(`[task ${task.id}] yt-dlp ${args.join(' ')}`);
    const child = spawn('yt-dlp', args, { shell: process.platform === 'win32' });
    let lastText = '';

    const handle = (data) => {
      const text = data.toString();
      lastText += text;
      const m = text.match(/\[download\]\s+(\d+(?:\.\d+)?)%/);
      if (m) updateTask(task.id, { progress: Math.round(Number(m[1])) });
    };

    child.stdout.on('data', handle);
    child.stderr.on('data', handle);

    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`yt-dlp failed with code ${code}. ${lastText.slice(-500)}`));
    });
  });
}

async function waitForAria2Task(task, gid, tempPath) {
  let currentGid = gid;
  let lastNonZeroTotalAt = Date.now();

  while (true) {
    const s = await aria2.tellStatus(currentGid);

    if (s.followedBy && s.followedBy.length) {
      currentGid = s.followedBy[0];
      updateTask(task.id, { aria2_gid: currentGid, error_message: 'Magnet metadata found. Starting real download.' });
      continue;
    }

    const patch = statusPatchFromAria2(s);
    patch.aria2_gid = currentGid;
    patch.error_message = null;
    updateTask(task.id, patch);

    const total = Number(s.totalLength || 0);
    const done = Number(s.completedLength || 0);
    if (total > 0 && done > 0) lastNonZeroTotalAt = Date.now();

    if ((task.source_type === 'magnet' || task.source_type === 'torrent') && total === 0) {
      const waited = Date.now() - lastNonZeroTotalAt;
      if (waited > MAGNET_METADATA_TIMEOUT_MS) {
        throw new Error('Magnet metadata timeout: no peers or metadata found. Try a healthier legal torrent or check firewall/ISP.');
      }
    }

    if (s.status === 'complete') return currentGid;
    if (s.status === 'paused') {
      updateTask(task.id, { status: 'paused', speed: '0 B/s', error_message: 'Paused' });
      await new Promise(resolve => setTimeout(resolve, ARIA2_STATUS_INTERVAL_MS));
      continue;
    }
    if (s.status === 'active' || s.status === 'waiting') {
      updateTask(task.id, { status: 'downloading' });
    }
    if (s.status === 'error') throw new Error(`aria2 failed: ${s.errorMessage || s.errorCode || 'unknown error'}`);
    if (s.status === 'removed') throw new Error('aria2 task was removed');

    await new Promise(resolve => setTimeout(resolve, ARIA2_STATUS_INTERVAL_MS));
  }
}

async function processAria2RpcTask(task, tempPath) {
  const options = {
    dir: tempPath,
    continue: 'true',
    'allow-overwrite': 'true',
    'file-allocation': 'none',
    'seed-time': '0'
  };

  if (task.source_type === 'magnet' || task.source_type === 'torrent') {
    Object.assign(options, {
      'bt-save-metadata': 'true',
      'bt-metadata-only': 'false',
      'bt-max-peers': '100',
      'enable-dht': 'true',
      'enable-peer-exchange': 'true',
      'bt-enable-lpd': 'true'
    });
  }

  console.log(`[task ${task.id}] aria2 RPC addUri ${task.source_url}`);
  const gid = await aria2.addUri(task.source_url, options);
  updateTask(task.id, { aria2_gid: gid });
  await waitForAria2Task(task, gid, tempPath);
}

async function processTask(task) {
  const tempPath = path.join(TEMP_DIR, String(task.id));
  fs.mkdirSync(tempPath, { recursive: true });
  updateTask(task.id, {
    status: 'downloading',
    progress: 0,
    temp_path: tempPath,
    started_at: new Date().toISOString(),
    error_message: null
  });

  if (task.source_type === 'video_platform') {
    await runYtDlp(task, tempPath);
  } else {
    await processAria2RpcTask(task, tempPath);
  }

  const downloaded = largestFileRecursive(tempPath);
  if (!downloaded) throw new Error('No downloaded file found');

  const finalFolder = path.join(COMPLETED_DIR, safeName(task.folder || 'Default Folder'));
  fs.mkdirSync(finalFolder, { recursive: true });
  const finalPath = path.join(finalFolder, safeName(path.basename(downloaded)));

  if (fs.existsSync(finalPath)) fs.rmSync(finalPath, { force: true });
  fs.renameSync(downloaded, finalPath);

  const publicUrl = `/media/${encodeURIComponent(safeName(task.folder || 'Default Folder'))}/${encodeURIComponent(path.basename(finalPath))}`;
  updateTask(task.id, {
    status: 'completed',
    progress: 100,
    final_path: finalPath,
    public_url: publicUrl,
    display_name: path.basename(finalPath),
    download_folder: finalFolder,
    completed_at: new Date().toISOString(),
    error_message: null
  });
}

let isWorking = false;
async function loop() {
  if (isWorking) return;
  const task = findQueuedTask();
  if (!task) return;

  isWorking = true;
  try {
    await processTask(task);
    console.log(`[task ${task.id}] completed`);
  } catch (err) {
    console.error(`[task ${task.id}] failed`, err.message);
    const latest = db.prepare('SELECT status FROM cloud_download_tasks WHERE id=?').get(task.id);
    if (latest && latest.status === 'cancelled') {
      updateTask(task.id, { error_message: 'Stopped by user' });
    } else {
      updateTask(task.id, { status: 'failed', error_message: err.message });
    }
  } finally {
    isWorking = false;
  }
}

console.log('Download worker started in aria2 RPC mode');
console.log(`aria2 RPC URL: ${aria2.ARIA2_RPC_URL}`);
console.log('Start aria2 daemon first with: npm run aria2');
setInterval(loop, POLL_INTERVAL_MS);
loop();
