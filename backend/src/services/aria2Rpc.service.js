require('dotenv').config();

const ARIA2_RPC_URL = process.env.ARIA2_RPC_URL || 'http://127.0.0.1:6800/jsonrpc';
const ARIA2_RPC_SECRET = process.env.ARIA2_RPC_SECRET || 'test123';

let rpcId = 1;

async function aria2Rpc(method, params = []) {
  const body = {
    jsonrpc: '2.0',
    id: String(rpcId++),
    method,
    params: [`token:${ARIA2_RPC_SECRET}`, ...params]
  };

  let res;
  try {
    res = await fetch(ARIA2_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (err) {
    throw new Error(`Cannot connect to aria2 RPC at ${ARIA2_RPC_URL}. Start it with: npm run aria2. ${err.message}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(`aria2 RPC error ${data.error.code}: ${data.error.message}`);
  }
  return data.result;
}

async function addUri(uri, options = {}) {
  return aria2Rpc('aria2.addUri', [[uri], options]);
}

async function tellStatus(gid) {
  return aria2Rpc('aria2.tellStatus', [gid]);
}

async function pause(gid) {
  return aria2Rpc('aria2.pause', [gid]);
}

async function unpause(gid) {
  return aria2Rpc('aria2.unpause', [gid]);
}

async function remove(gid) {
  return aria2Rpc('aria2.remove', [gid]);
}

async function forceRemove(gid) {
  return aria2Rpc('aria2.forceRemove', [gid]);
}

async function getVersion() {
  return aria2Rpc('aria2.getVersion', []);
}

module.exports = {
  ARIA2_RPC_URL,
  ARIA2_RPC_SECRET,
  aria2Rpc,
  addUri,
  tellStatus,
  pause,
  unpause,
  remove,
  forceRemove,
  getVersion
};
