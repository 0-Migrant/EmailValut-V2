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
  charset: 'utf8mb4',
});

async function initDB() {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS items (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      price DECIMAL(10,2) NOT NULL DEFAULT 0,
      category VARCHAR(255) DEFAULT ''
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS categories (
      name VARCHAR(255) PRIMARY KEY
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS delivery_men (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      username VARCHAR(255),
      password VARCHAR(255),
      status VARCHAR(20) DEFAULT 'offline',
      frozen TINYINT(1) DEFAULT 0
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS orders (
      id VARCHAR(36) PRIMARY KEY,
      delivery_man_id VARCHAR(36) DEFAULT '',
      customer_id VARCHAR(255) DEFAULT '',
      game_id VARCHAR(255),
      items JSON NOT NULL,
      status VARCHAR(30) NOT NULL,
      custom_price DECIMAL(10,2),
      discount_pct DECIMAL(5,2),
      payment_method VARCHAR(255) DEFAULT '',
      payment_detail VARCHAR(255) DEFAULT '',
      source VARCHAR(255) DEFAULT '',
      created_at DATETIME NOT NULL
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS bundles (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      items JSON NOT NULL
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS credentials (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) DEFAULT '',
      pass VARCHAR(255) DEFAULT '',
      stocks JSON NOT NULL,
      added DATETIME NOT NULL
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS history (
      id VARCHAR(36) PRIMARY KEY,
      type VARCHAR(10) NOT NULL,
      msg TEXT,
      time DATETIME NOT NULL,
      snapshot LONGTEXT
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      id INT PRIMARY KEY DEFAULT 1,
      data JSON NOT NULL
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS payouts (
      id VARCHAR(36) PRIMARY KEY,
      worker_id VARCHAR(36) DEFAULT '',
      wallet_id VARCHAR(36),
      amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      type VARCHAR(10) NOT NULL,
      status VARCHAR(10) DEFAULT 'pending',
      note TEXT,
      created_at DATETIME NOT NULL
    )
  `);
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS clients (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      note TEXT,
      is_special TINYINT(1) DEFAULT 0,
      is_blacklisted TINYINT(1) DEFAULT 0,
      created_at DATETIME NOT NULL
    )
  `);
  // Remove old single-blob table if it exists
  await pool.execute(`DROP TABLE IF EXISTS vault`);
}

function parseJson(val) {
  if (val === null || val === undefined) return val;
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return val; } }
  return val;
}

const NOW_DT = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

function toDatetime(iso) {
  if (!iso) return NOW_DT();
  try {
    return new Date(iso).toISOString().slice(0, 19).replace('T', ' ');
  } catch {
    return NOW_DT();
  }
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ── GET /api/vault ─────────────────────────────────────────────────────────────
app.get('/api/vault', async (req, res) => {
  try {
    const [
      [items], [categories], [deliveryMen], [orders], [bundles],
      [credentials], [history], [settingsRows], [payouts], [clients],
    ] = await Promise.all([
      pool.execute('SELECT * FROM items'),
      pool.execute('SELECT name FROM categories'),
      pool.execute('SELECT * FROM delivery_men'),
      pool.execute('SELECT * FROM orders ORDER BY created_at DESC'),
      pool.execute('SELECT * FROM bundles'),
      pool.execute('SELECT * FROM credentials'),
      pool.execute('SELECT * FROM history ORDER BY time DESC'),
      pool.execute('SELECT data FROM settings WHERE id = 1'),
      pool.execute('SELECT * FROM payouts'),
      pool.execute('SELECT * FROM clients'),
    ]);

    res.json({
      data: {
        items: items.map((r) => ({
          id: r.id, name: r.name,
          price: parseFloat(r.price),
          category: r.category || '',
        })),
        categories: categories.map((r) => r.name),
        deliveryMen: deliveryMen.map((r) => ({
          id: r.id, name: r.name,
          username: r.username || undefined,
          password: r.password || undefined,
          status: r.status || 'offline',
          frozen: Boolean(r.frozen),
        })),
        orders: orders.map((r) => ({
          id: r.id,
          deliveryManId: r.delivery_man_id || '',
          customerId: r.customer_id || '',
          gameId: r.game_id || undefined,
          items: parseJson(r.items) || [],
          status: r.status,
          customPrice: r.custom_price !== null ? parseFloat(r.custom_price) : null,
          discountPct: r.discount_pct !== null ? parseFloat(r.discount_pct) : null,
          paymentMethod: r.payment_method || '',
          paymentDetail: r.payment_detail || '',
          source: r.source || '',
          createdAt: r.created_at instanceof Date
            ? r.created_at.toISOString()
            : String(r.created_at),
        })),
        bundles: bundles.map((r) => ({
          id: r.id, name: r.name,
          items: parseJson(r.items) || [],
        })),
        credentials: credentials.map((r) => ({
          id: r.id, name: r.name,
          email: r.email || '',
          pass: r.pass || '',
          stocks: parseJson(r.stocks) || [],
          added: r.added instanceof Date ? r.added.toISOString() : String(r.added),
        })),
        history: history.map((r) => ({
          id: r.id, type: r.type, msg: r.msg,
          time: r.time instanceof Date ? r.time.toISOString() : String(r.time),
          snapshot: r.snapshot || undefined,
        })),
        settings: settingsRows.length > 0 ? parseJson(settingsRows[0].data) : null,
        payouts: payouts.map((r) => ({
          id: r.id,
          workerId: r.worker_id || '',
          walletId: r.wallet_id || undefined,
          amount: parseFloat(r.amount),
          type: r.type,
          status: r.status || 'pending',
          note: r.note || '',
          createdAt: r.created_at instanceof Date
            ? r.created_at.toISOString()
            : String(r.created_at),
        })),
        clients: clients.map((r) => ({
          id: r.id, name: r.name,
          note: r.note || undefined,
          isSpecial: Boolean(r.is_special),
          isBlacklisted: Boolean(r.is_blacklisted),
          createdAt: r.created_at instanceof Date
            ? r.created_at.toISOString()
            : String(r.created_at),
        })),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/vault ────────────────────────────────────────────────────────────
app.post('/api/vault', async (req, res) => {
  const { data } = req.body;
  if (!data) return res.status(400).json({ error: 'Missing data' });

  const conn = await pool.getConnection();
  let _table = 'unknown';
  try {
    await conn.beginTransaction();

    // items
    _table = 'items';
    await conn.execute('DELETE FROM items');
    for (const r of data.items || []) {
      await conn.execute(
        'INSERT INTO items (id, name, price, category) VALUES (?, ?, ?, ?)',
        [r.id, r.name, r.price ?? 0, r.category || ''],
      );
    }

    // categories
    _table = 'categories';
    await conn.execute('DELETE FROM categories');
    for (const name of data.categories || []) {
      await conn.execute('INSERT INTO categories (name) VALUES (?)', [name]);
    }

    // delivery_men
    _table = 'delivery_men';
    await conn.execute('DELETE FROM delivery_men');
    for (const r of data.deliveryMen || []) {
      await conn.execute(
        'INSERT INTO delivery_men (id, name, username, password, status, frozen) VALUES (?, ?, ?, ?, ?, ?)',
        [r.id, r.name, r.username || null, r.password || null, r.status || 'offline', r.frozen ? 1 : 0],
      );
    }

    // orders
    _table = 'orders';
    await conn.execute('DELETE FROM orders');
    for (const r of data.orders || []) {
      await conn.execute(
        `INSERT INTO orders
          (id, delivery_man_id, customer_id, game_id, items, status,
           custom_price, discount_pct, payment_method, payment_detail, source, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          r.id, r.deliveryManId || '', r.customerId || '', r.gameId || null,
          JSON.stringify(r.items || []), r.status || 'pending',
          r.customPrice ?? null, r.discountPct ?? null,
          r.paymentMethod || '', r.paymentDetail || '', r.source || '',
          toDatetime(r.createdAt),
        ],
      );
    }

    // bundles
    _table = 'bundles';
    await conn.execute('DELETE FROM bundles');
    for (const r of data.bundles || []) {
      await conn.execute(
        'INSERT INTO bundles (id, name, items) VALUES (?, ?, ?)',
        [r.id, r.name, JSON.stringify(r.items || [])],
      );
    }

    // credentials
    _table = 'credentials';
    await conn.execute('DELETE FROM credentials');
    for (const r of data.credentials || []) {
      await conn.execute(
        'INSERT INTO credentials (id, name, email, pass, stocks, added) VALUES (?, ?, ?, ?, ?, ?)',
        [r.id, r.name, r.email || '', r.pass || '', JSON.stringify(r.stocks || []), toDatetime(r.added)],
      );
    }

    // history — cap snapshot at 256 KB to avoid large packet issues
    _table = 'history';
    await conn.execute('DELETE FROM history');
    for (const r of data.history || []) {
      const snap = r.snapshot && r.snapshot.length <= 262144 ? r.snapshot : null;
      await conn.execute(
        'INSERT INTO history (id, type, msg, time, snapshot) VALUES (?, ?, ?, ?, ?)',
        [r.id, r.type || 'edit', r.msg || '', toDatetime(r.time), snap],
      );
    }

    // settings (single row)
    _table = 'settings';
    if (data.settings) {
      const settingsJson = JSON.stringify(data.settings);
      await conn.execute(
        'INSERT INTO settings (id, data) VALUES (1, ?) ON DUPLICATE KEY UPDATE data = ?',
        [settingsJson, settingsJson],
      );
    }

    // payouts
    _table = 'payouts';
    await conn.execute('DELETE FROM payouts');
    for (const r of data.payouts || []) {
      await conn.execute(
        'INSERT INTO payouts (id, worker_id, wallet_id, amount, type, status, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [r.id, r.workerId || '', r.walletId || null, r.amount ?? 0, r.type || 'debit', r.status || 'pending', r.note || '', toDatetime(r.createdAt)],
      );
    }

    // clients
    _table = 'clients';
    await conn.execute('DELETE FROM clients');
    for (const r of data.clients || []) {
      await conn.execute(
        'INSERT INTO clients (id, name, note, is_special, is_blacklisted, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [r.id, r.name, r.note || null, r.isSpecial ? 1 : 0, r.isBlacklisted ? 1 : 0, toDatetime(r.createdAt)],
      );
    }

    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    const msg = `[${_table}] ${err.message}`;
    console.error('POST /api/vault failed:', msg);
    res.status(500).json({ error: msg });
  } finally {
    conn.release();
  }
});

// ── DELETE /api/vault ──────────────────────────────────────────────────────────
app.delete('/api/vault', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const t of ['items','categories','delivery_men','orders','bundles','credentials','history','settings','payouts','clients']) {
      await conn.execute(`DELETE FROM ${t}`);
    }
    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// ── Diagnostic: test DB write ─────────────────────────────────────────────────
app.get('/api/test', async (req, res) => {
  const steps = [];
  try {
    await pool.execute('SELECT 1');
    steps.push('SELECT 1: ok');

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute('DELETE FROM items WHERE id = ?', ['__test__']);
      steps.push('DELETE test row: ok');
      await conn.execute(
        'INSERT INTO items (id, name, price, category) VALUES (?, ?, ?, ?)',
        ['__test__', 'Test Item', 1.0, 'test'],
      );
      steps.push('INSERT test row: ok');
      await conn.execute('DELETE FROM items WHERE id = ?', ['__test__']);
      steps.push('Cleanup: ok');
      await conn.commit();
      res.json({ ok: true, steps });
    } catch (err) {
      await conn.rollback();
      steps.push(`FAILED: ${err.message}`);
      res.json({ ok: false, steps, error: err.message });
    } finally {
      conn.release();
    }
  } catch (err) {
    steps.push(`DB connect FAILED: ${err.message}`);
    res.json({ ok: false, steps, error: err.message });
  }
});

// ── Worker presence via WebSocket ──────────────────────────────────────────────
const workerSockets = new Map();

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

// ── Serve React build in production ───────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  initDB()
    .then(() => console.log('Database ready'))
    .catch((err) => console.error('Database init failed:', err.message));
});
