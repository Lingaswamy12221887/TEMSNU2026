// ICICSE 2027 conference website — zero-dependency Node.js server, data stored in Supabase.
// Setup: see README.md. Run:  node server.js     (then open http://localhost:3000)
require('./lib.env');
const sb = require('./lib.supabase');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PUB = path.join(ROOT, 'public');
const PORT = parseInt(process.env.PORT, 10) || 3000;

if (!sb.configured()) {
  console.error('\n  Supabase is not configured.\n  Copy .env.example to .env and set SUPABASE_URL and SUPABASE_SERVICE_KEY (see README.md).\n');
  process.exit(1);
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8'
};

/* ---------- site data (Supabase table: site_content / site_backups) ---------- */
function loadSeed() { delete require.cache[require.resolve('./seed')]; return require('./seed')(); }
let siteCache = null; // serialized JSON string, refreshed on every write
async function readSite() {
  if (siteCache) return siteCache;
  const rows = await sb.rest('GET', 'site_content?id=eq.1&select=data');
  if (!rows || !rows.length) return null;
  siteCache = JSON.stringify(rows[0].data);
  return siteCache;
}
async function backupSite() {
  const rows = await sb.rest('GET', 'site_content?id=eq.1&select=data');
  if (!rows || !rows.length) return;
  await sb.rest('POST', 'site_backups', { data: rows[0].data }, 'return=minimal');
  const old = await sb.rest('GET', 'site_backups?select=id&order=id.desc&offset=20');
  if (old && old.length) await sb.rest('DELETE', 'site_backups?id=in.(' + old.map(r => r.id).join(',') + ')');
}
async function writeSite(obj) {
  await sb.rest('POST', 'site_content?on_conflict=id', { id: 1, data: obj, updated_at: new Date().toISOString() }, 'resolution=merge-duplicates,return=minimal');
  siteCache = JSON.stringify(obj);
}
async function initSite() {
  const cur = await readSite();
  if (!cur) { await writeSite(loadSeed()); console.log('Site content created in Supabase from defaults'); return; }
  // content from an older release of this app is replaced by the new defaults (a backup is kept in site_backups)
  try {
    const seed = loadSeed(), c = JSON.parse(cur);
    if (!c.version || c.version < seed.version) { await backupSite(); await writeSite(seed); console.log('Site content upgraded to version ' + seed.version + ' (old copy saved in site_backups)'); }
  } catch (e) { await backupSite(); await writeSite(loadSeed()); }
}

/* ---------- admin auth (Supabase table: admin_credentials) ---------- */
function hashPw(pw, salt) { return crypto.scryptSync(pw, salt, 32).toString('hex'); }
async function setPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  await sb.rest('POST', 'admin_credentials?on_conflict=id', { id: 1, salt, hash: hashPw(pw, salt) }, 'resolution=merge-duplicates,return=minimal');
}
async function initAdmin() {
  const rows = await sb.rest('GET', 'admin_credentials?id=eq.1&select=id');
  if (!rows || !rows.length) await setPassword(process.env.ADMIN_PASSWORD || 'admin123');
}
async function checkPassword(pw) {
  const rows = await sb.rest('GET', 'admin_credentials?id=eq.1&select=salt,hash');
  if (!rows || !rows.length) return false;
  const a = rows[0];
  const x = Buffer.from(hashPw(String(pw || ''), a.salt), 'hex');
  const y = Buffer.from(a.hash, 'hex');
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
const sessions = new Map(); // token -> expiry
const SESSION_MS = 12 * 3600 * 1000;
function newSession() {
  const t = crypto.randomBytes(24).toString('hex');
  sessions.set(t, Date.now() + SESSION_MS);
  return t;
}
function authed(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!m) return false;
  const exp = sessions.get(m[1]);
  if (!exp || exp < Date.now()) { sessions.delete(m[1]); return false; }
  return true;
}
const fails = new Map(); // ip -> {n, t}
function tooManyFails(ip) {
  const f = fails.get(ip);
  return f && f.n >= 6 && Date.now() - f.t < 60000;
}

/* ---------- helpers ---------- */
function send(res, code, body, type) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  res.writeHead(code, {
    'Content-Type': type || (typeof body === 'string' || Buffer.isBuffer(body) ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8'),
    'Content-Length': buf.length, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store'
  });
  res.end(buf);
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
function serveFile(res, file) {
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'Not found');
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': buf.length,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache'
    });
    res.end(buf);
  });
}
function safeJoin(base, rel) {
  const p = path.normalize(path.join(base, rel));
  return p.startsWith(base + path.sep) || p === base ? p : null;
}
function validSite(s) {
  return s && typeof s === 'object' && s.settings && typeof s.settings === 'object' &&
    Array.isArray(s.menu) && s.pages && typeof s.pages === 'object' && s.pages[''] ;
}

/* ---------- API ---------- */
async function api(req, res, url) {
  const ip = req.socket.remoteAddress;
  try {
    if (req.method === 'GET' && url === '/api/site') return send(res, 200, await readSite(), 'application/json; charset=utf-8');
    if (req.method === 'GET' && url === '/api/me') return send(res, authed(req) ? 200 : 401, { ok: authed(req) });

    if (req.method === 'POST' && url === '/api/login') {
      if (tooManyFails(ip)) return send(res, 429, { error: 'Too many attempts. Wait a minute and try again.' });
      const { password } = JSON.parse(await readBody(req, 10000) || '{}');
      if (await checkPassword(password)) { fails.delete(ip); return send(res, 200, { token: newSession() }); }
      const f = fails.get(ip) || { n: 0, t: 0 }; f.n++; f.t = Date.now(); fails.set(ip, f);
      return send(res, 401, { error: 'Wrong password' });
    }

    // everything below requires auth
    if (!authed(req)) return send(res, 401, { error: 'Please log in' });

    if (req.method === 'PUT' && url === '/api/site') {
      const site = JSON.parse(await readBody(req, 8 * 1024 * 1024));
      if (!validSite(site)) return send(res, 400, { error: 'Invalid site data' });
      await backupSite();
      await writeSite(site);
      return send(res, 200, { ok: true });
    }
    if (req.method === 'POST' && url === '/api/password') {
      const { current, next } = JSON.parse(await readBody(req, 10000) || '{}');
      if (!(await checkPassword(current))) return send(res, 403, { error: 'Current password is wrong' });
      if (!next || String(next).length < 6) return send(res, 400, { error: 'New password must be at least 6 characters' });
      await setPassword(String(next));
      return send(res, 200, { ok: true });
    }
    if (req.method === 'POST' && url === '/api/upload') {
      const { name, data } = JSON.parse(await readBody(req, 14 * 1024 * 1024));
      const ext = path.extname(String(name || '')).toLowerCase();
      if (!['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico'].includes(ext)) return send(res, 400, { error: 'Unsupported image type' });
      const b64 = String(data || '').replace(/^data:[^,]*,/, '');
      const buf = Buffer.from(b64, 'base64');
      if (!buf.length || buf.length > 10 * 1024 * 1024) return send(res, 400, { error: 'Image empty or over 10 MB' });
      const fname = Date.now().toString(36) + crypto.randomBytes(4).toString('hex') + ext;
      await sb.uploadObject(fname, buf, MIME[ext]);
      return send(res, 200, { url: '/uploads/' + fname });
    }
    if (req.method === 'POST' && url === '/api/reset') {
      await backupSite();
      const seed = loadSeed();
      await writeSite(seed);
      return send(res, 200, seed);
    }
    return send(res, 404, { error: 'Unknown API route' });
  } catch (e) {
    if (e.message === 'too large') return send(res, 413, { error: 'Request too large' });
    if (/^Supabase/.test(e.message)) { console.error(e.message); return send(res, 502, { error: 'Database error — check the server log' }); }
    return send(res, 400, { error: 'Bad request' });
  }
}

/* ---------- server ---------- */
const server = http.createServer(async (req, res) => {
  let url;
  try { url = decodeURIComponent(req.url.split('?')[0]); } catch { return send(res, 400, 'Bad URL'); }
  if (url.startsWith('/api/')) return api(req, res, url);
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');

  if (url.startsWith('/uploads/')) {
    const name = url.slice('/uploads/'.length);
    if (!/^[A-Za-z0-9._-]+$/.test(name)) return send(res, 404, 'Not found');
    try {
      const o = await sb.downloadObject(name);
      if (!o) return send(res, 404, 'Not found');
      const type = MIME[path.extname(name).toLowerCase()] || o.type || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': o.buf.length, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=86400' });
      return res.end(o.buf);
    } catch (e) { return send(res, 502, 'Storage error'); }
  }
  const f = url === '/' ? null : safeJoin(PUB, url);
  if (f && fs.existsSync(f) && fs.statSync(f).isFile()) return serveFile(res, f);
  // single-page app: every other path renders the app shell
  return serveFile(res, path.join(PUB, 'index.html'));
});

(async () => {
  try { await initSite(); await initAdmin(); }
  catch (e) { console.error('\n  Could not reach Supabase: ' + e.message + '\n  Did you run supabase/schema.sql and set the right URL/key in .env?\n'); process.exit(1); }
  server.listen(PORT, () => {
  console.log('\n  ICICSE 2027 website running');
  console.log('  Site:   http://localhost:' + PORT);
  console.log('  Admin:  open the site and click "Admin login" in the footer');
  console.log('  Data:   Supabase (' + process.env.SUPABASE_URL + ')');
  console.log('  Default admin password: admin123  (change it in Settings after logging in)\n');
  });
})();
