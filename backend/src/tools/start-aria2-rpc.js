const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
require('dotenv').config();

const TEMP_DIR = path.resolve(process.env.TEMP_DIR || './storage/temp');
const RPC_DIR = path.join(TEMP_DIR, 'aria2-rpc-default');
const RPC_PORT = String(process.env.ARIA2_RPC_PORT || 6800);
const RPC_SECRET = process.env.ARIA2_RPC_SECRET || 'test123';
const LISTEN_PORT = String(process.env.ARIA2_BT_LISTEN_PORT || 6881);
const MAX_UPLOAD_LIMIT = String(process.env.ARIA2_MAX_UPLOAD_LIMIT || '1K');

fs.mkdirSync(RPC_DIR, { recursive: true });

const args = [
  '--enable-rpc=true',
  '--rpc-listen-all=false',
  `--rpc-listen-port=${RPC_PORT}`,
  `--rpc-secret=${RPC_SECRET}`,
  '--disable-ipv6=true',
  '--enable-dht=true',
  '--enable-peer-exchange=true',
  '--bt-enable-lpd=true',
  '--bt-max-peers=100',
  `--listen-port=${LISTEN_PORT}`,
  '--seed-time=0',
  `--max-upload-limit=${MAX_UPLOAD_LIMIT}`,
  '--file-allocation=none',
  '--continue=true',
  `--dir=${RPC_DIR}`,
  `--log=${path.join(TEMP_DIR, 'aria2-rpc.log')}`,
  '--log-level=notice'
];

console.log('Starting aria2 RPC daemon...');
console.log(`RPC: http://127.0.0.1:${RPC_PORT}/jsonrpc`);
console.log(`Secret: ${RPC_SECRET}`);
console.log(`BT listen port: ${LISTEN_PORT}`);
console.log(`Max upload limit: ${MAX_UPLOAD_LIMIT}`);
console.log(`Default dir: ${RPC_DIR}`);
console.log(`aria2c ${args.join(' ')}`);

const child = spawn('aria2c', args, {
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

child.on('exit', (code) => {
  console.log(`aria2 RPC daemon exited with code ${code}`);
  process.exit(code || 0);
});
