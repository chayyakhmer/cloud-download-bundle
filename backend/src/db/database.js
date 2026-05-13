const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
require('dotenv').config();

const dbPath = process.env.DB_PATH || './backend/data/app.db';
const fullPath = path.resolve(dbPath);
fs.mkdirSync(path.dirname(fullPath), { recursive: true });

const db = new Database(fullPath);
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS cloud_download_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_url TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'unknown',
  folder TEXT NOT NULL DEFAULT 'Default Folder',
  status TEXT NOT NULL DEFAULT 'queued',
  progress INTEGER NOT NULL DEFAULT 0,
  total_size TEXT,
  downloaded_size TEXT,
  speed TEXT,
  eta TEXT,
  aria2_gid TEXT,
  temp_path TEXT,
  final_path TEXT,
  public_url TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn('cloud_download_tasks', 'aria2_gid', 'TEXT');
ensureColumn('cloud_download_tasks', 'display_name', 'TEXT');
ensureColumn('cloud_download_tasks', 'download_folder', 'TEXT');

module.exports = db;
