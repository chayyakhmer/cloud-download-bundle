function detectSourceType(url) {
  const lower = String(url || '').toLowerCase().trim();
  if (lower.startsWith('magnet:?')) return 'magnet';
  if (lower.endsWith('.torrent')) return 'torrent';
  if (/youtube\.com|youtu\.be|tiktok\.com|facebook\.com|fb\.watch|twitter\.com|x\.com/.test(lower)) return 'video_platform';
  if (lower.startsWith('http://') || lower.startsWith('https://')) return 'direct_url';
  return 'unknown';
}

function isPrivateHostBlocked(url) {
  const raw = String(url || '').trim().toLowerCase();
  if (raw.startsWith('magnet:?')) return false;
  let parsed;
  try { parsed = new URL(raw); } catch { return true; }
  const host = parsed.hostname;
  if (!['http:', 'https:'].includes(parsed.protocol)) return true;
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') return true;
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)) return true;
  if (/^169\.254\./.test(host)) return true;
  return false;
}

module.exports = { detectSourceType, isPrivateHostBlocked };
