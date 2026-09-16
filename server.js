/**
 * Creatsale - Login + Dashboard
 * Pure Node.js (no external deps)
 * Database: SQLite-like JSON store + hashed passwords (crypto.scrypt)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const querystring = require('querystring');

const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Ensure data dir
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ===== Simple "SQL-like" Database =====
function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) {
    // Default admin user (password: admin123)
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync('admin123', salt, 64).toString('hex');
    const users = [
      {
        id: 1,
        username: 'admin',
        name: 'Administrator',
        email: 'admin@creatsale.com',
        password_hash: hash,
        salt: salt,
        created_at: new Date().toISOString()
      }
    ];
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    return users;
  }
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function findUserByUsername(username) {
  const users = loadUsers();
  return users.find(u => u.username.toLowerCase() === username.toLowerCase());
}

function verifyPassword(password, salt, hash) {
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(check, 'hex'), Buffer.from(hash, 'hex'));
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

// ===== Session Store (in-memory for simplicity) =====
const sessions = new Map();

function createSession(user) {
  const sid = crypto.randomBytes(24).toString('hex');
  sessions.set(sid, {
    userId: user.id,
    username: user.username,
    name: user.name,
    created: Date.now()
  });
  return sid;
}

function getSession(sid) {
  if (!sid) return null;
  const s = sessions.get(sid);
  if (!s) return null;
  // Expire after 24h
  if (Date.now() - s.created > 24 * 60 * 60 * 1000) {
    sessions.delete(sid);
    return null;
  }
  return s;
}

function destroySession(sid) {
  sessions.delete(sid);
}

function parseCookies(req) {
  const cookie = req.headers.cookie || '';
  const out = {};
  cookie.split(';').forEach(c => {
    const [k, ...v] = c.trim().split('=');
    if (k) out[k] = decodeURIComponent(v.join('='));
  });
  return out;
}

function setCookie(res, name, value, maxAge = 86400) {
  res.setHeader('Set-Cookie', `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`);
}

function clearCookie(res, name) {
  res.setHeader('Set-Cookie', `${name}=; Path=/; HttpOnly; Max-Age=0`);
}

// ===== Helpers =====
function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function sendFile(res, filePath, contentType) {
  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  } catch (e) {
    res.writeHead(404);
    res.end('Not Found');
  }
}

function getBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        if (req.headers['content-type']?.includes('application/json')) {
          resolve(JSON.parse(body || '{}'));
        } else {
          resolve(querystring.parse(body));
        }
      } catch {
        resolve({});
      }
    });
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// ===== Server =====
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  const method = req.method;
  const cookies = parseCookies(req);
  const session = getSession(cookies.sid);

  // --- API: Login ---
  if (pathname === '/api/login' && method === 'POST') {
    const body = await getBody(req);
    const { username, password } = body;

    if (!username || !password) {
      return sendJSON(res, 400, { ok: false, message: 'Username dan password wajib diisi' });
    }

    const user = findUserByUsername(username);
    if (!user || !verifyPassword(password, user.salt, user.password_hash)) {
      return sendJSON(res, 401, { ok: false, message: 'Username atau password salah' });
    }

    const sid = createSession(user);
    setCookie(res, 'sid', sid);
    return sendJSON(res, 200, {
      ok: true,
      message: 'Login berhasil',
      user: { id: user.id, username: user.username, name: user.name }
    });
  }

  // --- API: Register ---
  if (pathname === '/api/register' && method === 'POST') {
    const body = await getBody(req);
    const { username, password, name, email } = body;

    if (!username || !password || !name) {
      return sendJSON(res, 400, { ok: false, message: 'Nama, username, dan password wajib' });
    }
    if (password.length < 6) {
      return sendJSON(res, 400, { ok: false, message: 'Password minimal 6 karakter' });
    }
    if (findUserByUsername(username)) {
      return sendJSON(res, 409, { ok: false, message: 'Username sudah dipakai' });
    }

    const users = loadUsers();
    const { salt, hash } = hashPassword(password);
    const newUser = {
      id: users.length ? Math.max(...users.map(u => u.id)) + 1 : 1,
      username: username.trim(),
      name: name.trim(),
      email: (email || '').trim(),
      password_hash: hash,
      salt,
      created_at: new Date().toISOString()
    };
    users.push(newUser);
    saveUsers(users);

    const sid = createSession(newUser);
    setCookie(res, 'sid', sid);
    return sendJSON(res, 201, {
      ok: true,
      message: 'Registrasi berhasil',
      user: { id: newUser.id, username: newUser.username, name: newUser.name }
    });
  }

  // --- API: Logout ---
  if (pathname === '/api/logout' && method === 'POST') {
    if (cookies.sid) destroySession(cookies.sid);
    clearCookie(res, 'sid');
    return sendJSON(res, 200, { ok: true });
  }

  // --- API: Me (current user) ---
  if (pathname === '/api/me' && method === 'GET') {
    if (!session) return sendJSON(res, 401, { ok: false, message: 'Belum login' });
    return sendJSON(res, 200, {
      ok: true,
      user: { id: session.userId, username: session.username, name: session.name }
    });
  }

  // --- Protect Dashboard ---
  if (pathname === '/dashboard.html' || pathname === '/dashboard') {
    if (!session) {
      res.writeHead(302, { Location: '/' });
      return res.end();
    }
    return sendFile(res, path.join(PUBLIC_DIR, 'dashboard.html'), 'text/html; charset=utf-8');
  }

  // --- Static files ---
  let filePath = pathname === '/' ? path.join(PUBLIC_DIR, 'index.html') : path.join(PUBLIC_DIR, pathname);
  // Security: prevent path traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'application/octet-stream';

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return sendFile(res, filePath, contentType);
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 Not Found');
});

server.listen(PORT, () => {
  console.log(`\n  Creatsale server running at http://localhost:${PORT}`);
  console.log(`  Default login → username: admin  |  password: admin123\n`);
});
