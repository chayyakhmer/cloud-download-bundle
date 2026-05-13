const path = require('path');
const fs = require('fs');
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
require('dotenv').config();
require('./db/database');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const PORT = Number(process.env.PORT || 6745);

const completedDir = path.resolve(process.env.COMPLETED_DIR || './storage/completed');
const frontendDir = path.resolve('./frontend/public');
fs.mkdirSync(completedDir, { recursive: true });

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, port: PORT }));
app.use('/api/tasks', require('./routes/tasks.routes'));
app.use('/media', express.static(completedDir, { fallthrough: false }));
app.use('/', express.static(frontendDir));

io.on('connection', (socket) => {
  socket.emit('hello', { message: 'connected' });
});

app.set('io', io);
global.downloadIo = io;

server.listen(PORT, () => {
  console.log(`Cloud Download app running at http://localhost:${PORT}`);
  console.log(`Frontend: /`);
  console.log(`API: /api/tasks`);
  console.log(`Media: /media/*`);
});
