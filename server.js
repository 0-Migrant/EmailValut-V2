const express = require('express');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  database: process.env.DB_NAME || 'emailsvault',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: 10,
});

async function initDB() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS vault (
      id INT PRIMARY KEY,
      data JSON NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/vault', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT data FROM vault WHERE id = 1');
    if (rows.length === 0) return res.json({ data: null });
    // Parse if mysql2 returns the JSON column as a string
    let data = rows[0].data;
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { /* return as-is */ }
    }
    res.json({ data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/vault', async (req, res) => {
  try {
    const { data } = req.body;
    // CAST AS JSON ensures MySQL stores an object, not a string literal
    const json = JSON.stringify(data);
    await pool.execute(
      'INSERT INTO vault (id, data) VALUES (1, CAST(? AS JSON)) ON DUPLICATE KEY UPDATE data = CAST(? AS JSON), updated_at = CURRENT_TIMESTAMP',
      [json, json],
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/vault', async (req, res) => {
  try {
    await pool.execute('DELETE FROM vault WHERE id = 1');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Worker presence — track connected worker sockets
const workerSockets = new Map(); // workerId -> Set<ws>

wss.on('connection', (ws) => {
  let currentWorkerId = null;

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'join' && msg.workerId) {
        currentWorkerId = msg.workerId;
        if (!workerSockets.has(currentWorkerId)) workerSockets.set(currentWorkerId, new Set());
        workerSockets.get(currentWorkerId).add(ws);
        broadcast({ type: 'join', workerId: currentWorkerId });
      }
    } catch { /* ignore malformed messages */ }
  });

  ws.on('close', () => {
    if (!currentWorkerId) return;
    const sockets = workerSockets.get(currentWorkerId);
    if (sockets) {
      sockets.delete(ws);
      if (sockets.size === 0) {
        workerSockets.delete(currentWorkerId);
        broadcast({ type: 'leave', workerId: currentWorkerId });
      }
    }
  });
});

function broadcast(msg) {
  const json = JSON.stringify(msg);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(json);
  });
}

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;

// Start server first, then init DB so the process stays alive even if DB fails
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  initDB()
    .then(() => console.log('Database ready'))
    .catch((err) => console.error('Database init failed (check DB env vars):', err.message));
});
