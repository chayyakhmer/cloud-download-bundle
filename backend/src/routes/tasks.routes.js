const express = require('express');
const fs = require('fs');
const db = require('../db/database');
const aria2 = require('../services/aria2Rpc.service');
const { detectSourceType, isPrivateHostBlocked } = require('../services/linkDetector.service');

const router = express.Router();

function getTask(id) {
  return db.prepare('SELECT * FROM cloud_download_tasks WHERE id=?').get(Number(id));
}

function updateTask(id, patch) {
  const keys = Object.keys(patch);
  if (!keys.length) return;
  const sql = `UPDATE cloud_download_tasks SET ${keys.map(k => `${k}=@${k}`).join(', ')}, updated_at=CURRENT_TIMESTAMP WHERE id=@id`;
  db.prepare(sql).run({ ...patch, id: Number(id) });
}

async function safeRemoveAria2(gid) {
  if (!gid) return;
  try { await aria2.remove(gid); }
  catch (err) {
    // If the GID is already stopped/removed, keep the app action successful.
    try { await aria2.forceRemove(gid); } catch (_) {}
  }
}

router.get('/', (req, res) => {
  const tasks = db.prepare('SELECT * FROM cloud_download_tasks ORDER BY id DESC').all();
  res.json({ success: true, tasks });
});

router.post('/', (req, res) => {
  const { links, folder } = req.body || {};
  if (!Array.isArray(links) || links.length === 0) {
    return res.status(400).json({ success: false, error: 'links must be a non-empty array' });
  }

  const insert = db.prepare(`
    INSERT INTO cloud_download_tasks (source_url, source_type, folder, status)
    VALUES (@source_url, @source_type, @folder, 'queued')
  `);

  const created = [];
  for (const raw of links) {
    const source_url = String(raw || '').trim();
    if (!source_url) continue;
    if (isPrivateHostBlocked(source_url)) {
      created.push({ source_url, success: false, error: 'Blocked unsafe/private URL' });
      continue;
    }
    const info = insert.run({
      source_url,
      source_type: detectSourceType(source_url),
      folder: folder || 'Default Folder'
    });
    created.push({ id: info.lastInsertRowid, source_url, success: true, status: 'queued' });
  }

  res.json({ success: true, tasks: created });
});

router.post('/:id/start', async (req, res) => {
  try {
    const task = getTask(req.params.id);
    if (!task) return res.status(404).json({ success: false, error: 'Task not found' });

    if (task.status === 'paused' && task.aria2_gid) {
      await aria2.unpause(task.aria2_gid);
      updateTask(task.id, { status: 'downloading', error_message: null });
      return res.json({ success: true, action: 'resumed' });
    }

    if (['failed', 'cancelled', 'stopped'].includes(task.status)) {
      updateTask(task.id, {
        status: 'queued',
        progress: 0,
        speed: null,
        eta: null,
        downloaded_size: null,
        total_size: null,
        aria2_gid: null,
        temp_path: null,
        final_path: null,
        public_url: null,
        display_name: null,
        download_folder: null,
        error_message: null,
        started_at: null,
        completed_at: null
      });
      return res.json({ success: true, action: 'queued' });
    }

    if (task.status === 'queued' || task.status === 'downloading') {
      return res.json({ success: true, action: task.status });
    }

    res.json({ success: false, error: `Cannot start task with status: ${task.status}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/pause', async (req, res) => {
  try {
    const task = getTask(req.params.id);
    if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
    if (!task.aria2_gid) return res.status(400).json({ success: false, error: 'Task has no aria2 GID yet' });
    await aria2.pause(task.aria2_gid);
    updateTask(task.id, { status: 'paused', speed: '0 B/s', error_message: 'Paused by user' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/resume', async (req, res) => {
  try {
    const task = getTask(req.params.id);
    if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
    if (!task.aria2_gid) return res.status(400).json({ success: false, error: 'Task has no aria2 GID yet' });
    await aria2.unpause(task.aria2_gid);
    updateTask(task.id, { status: 'downloading', error_message: null });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/stop', async (req, res) => {
  try {
    const task = getTask(req.params.id);
    if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
    await safeRemoveAria2(task.aria2_gid);
    updateTask(task.id, { status: 'cancelled', speed: '0 B/s', error_message: 'Stopped by user' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/retry', async (req, res) => {
  try {
    const task = getTask(req.params.id);
    if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
    await safeRemoveAria2(task.aria2_gid);
    updateTask(task.id, {
      status: 'queued',
      progress: 0,
      speed: null,
      eta: null,
      downloaded_size: null,
      total_size: null,
      aria2_gid: null,
      temp_path: null,
      final_path: null,
      public_url: null,
      display_name: null,
      download_folder: null,
      error_message: null,
      started_at: null,
      completed_at: null
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/cancel', async (req, res) => {
  try {
    const task = getTask(req.params.id);
    if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
    await safeRemoveAria2(task.aria2_gid);
    updateTask(task.id, { status: 'cancelled', speed: '0 B/s', error_message: 'Cancelled by user' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const task = getTask(id);
    if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
    await safeRemoveAria2(task.aria2_gid);
    if (task.temp_path && fs.existsSync(task.temp_path)) fs.rmSync(task.temp_path, { recursive: true, force: true });
    db.prepare('DELETE FROM cloud_download_tasks WHERE id=?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
