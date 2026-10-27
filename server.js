/*
 * ICICSE 2027 Conference Website
 * Node.js + Supabase
 *
 * Local development: node server.js
 * Vercel deployment: serverless request handler
 */

require('./lib.env');
const seedSiteData = require('./seed.js');

const sb = require('./lib.supabase');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PUB = path.join(ROOT, 'public');
const PORT = parseInt(process.env.PORT, 10) || 3000;

/* ---------- Configuration ---------- */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function loadSeed() {
  return seedSiteData();
}


/* ---------- Site data ---------- */

let siteCache = null;

async function readSite() {
  if (siteCache) return siteCache;

  const rows = await sb.rest(
    'GET',
    'site_content?id=eq.1&select=data'
  );

  if (!rows || !rows.length) return null;

  siteCache = JSON.stringify(rows[0].data);
  return siteCache;
}

async function backupSite() {
  const rows = await sb.rest(
    'GET',
    'site_content?id=eq.1&select=data'
  );

  if (!rows || !rows.length) return;

  await sb.rest(
    'POST',
    'site_backups',
    { data: rows[0].data },
    'return=minimal'
  );

  const old = await sb.rest(
    'GET',
    'site_backups?select=id&order=id.desc&offset=20'
  );

  if (old && old.length) {
    await sb.rest(
      'DELETE',
      'site_backups?id=in.(' +
        old.map(row => row.id).join(',') +
        ')'
    );
  }
}

async function writeSite(obj) {
  await sb.rest(
    'POST',
    'site_content?on_conflict=id',
    {
      id: 1,
      data: obj,
      updated_at: new Date().toISOString()
    },
    'resolution=merge-duplicates,return=minimal'
  );

  siteCache = JSON.stringify(obj);
}

async function initSite() {
  const current = await readSite();

  if (!current) {
    await writeSite(loadSeed());
    console.log('Site content created in Supabase.');
    return;
  }

  try {
    const seed = loadSeed();
    const content = JSON.parse(current);

    if (!content.version || content.version < seed.version) {
      await backupSite();
      await writeSite(seed);

      console.log(
        'Site content upgraded to version ' + seed.version
      );
    }
  } catch (error) {
    console.error('Site content upgrade failed:', error.message);
    throw error;
  }
}

/* ---------- Admin authentication ---------- */

function hashPw(password, salt) {
  return crypto
    .scryptSync(password, salt, 32)
    .toString('hex');
}

async function setPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');

  await sb.rest(
    'POST',
    'admin_credentials?on_conflict=id',
    {
      id: 1,
      salt,
      hash: hashPw(password, salt)
    },
    'resolution=merge-duplicates,return=minimal'
  );
}

async function initAdmin() {
  const rows = await sb.rest(
    'GET',
    'admin_credentials?id=eq.1&select=id'
  );

  if (!rows || !rows.length) {
    await setPassword(
      process.env.ADMIN_PASSWORD || 'admin123'
    );
  }
}

async function checkPassword(password) {
  const rows = await sb.rest(
    'GET',
    'admin_credentials?id=eq.1&select=salt,hash'
  );

  if (!rows || !rows.length) return false;

  const record = rows[0];

  const actual = Buffer.from(
    hashPw(String(password || ''), record.salt),
    'hex'
  );

  const expected = Buffer.from(record.hash, 'hex');

  return (
    actual.length === expected.length &&
    crypto.timingSafeEqual(actual, expected)
  );
}

/*
 * These maps work within one running process only.
 * For reliable admin sessions and rate limiting on Vercel,
 * use a persistent session store.
 */
const sessions = new Map();
const SESSION_MS = 12 * 60 * 60 * 1000;
const fails = new Map();

function newSession() {
  const token = crypto.randomBytes(24).toString('hex');

  sessions.set(token, Date.now() + SESSION_MS);

  return token;
}

function authed(req) {
  const match = /^Bearer (.+)$/.exec(
    req.headers.authorization || ''
  );

  if (!match) return false;

  const expiry = sessions.get(match[1]);

  if (!expiry || expiry < Date.now()) {
    sessions.delete(match[1]);
    return false;
  }

  return true;
}

function tooManyFails(ip) {
  const failure = fails.get(ip);

  return Boolean(
    failure &&
    failure.n >= 6 &&
    Date.now() - failure.t < 60000
  );
}

/* ---------- HTTP helpers ---------- */

function send(res, status, body, type) {
  if (res.writableEnded) return;

  const buffer = Buffer.isBuffer(body)
    ? body
    : Buffer.from(
        typeof body === 'string'
          ? body
          : JSON.stringify(body)
      );

  res.writeHead(status, {
    'Content-Type':
      type ||
      (
        typeof body === 'string' || Buffer.isBuffer(body)
          ? 'text/plain; charset=utf-8'
          : 'application/json; charset=utf-8'
      ),
    'Content-Length': buffer.length,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store'
  });

  res.end(buffer);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];

    req.on('data', chunk => {
      size += chunk.length;

      if (size > limit) {
        reject(new Error('too large'));
        req.destroy();
        return;
      }

      chunks.push(chunk);
    });

    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'));
    });

    req.on('error', reject);
  });
}

function serveFile(res, file, headOnly = false) {
  fs.readFile(file, (error, buffer) => {
    if (error) return send(res, 404, 'Not found');

    const extension = path.extname(file).toLowerCase();

    res.writeHead(200, {
      'Content-Type':
        MIME[extension] || 'application/octet-stream',
      'Content-Length': buffer.length,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache'
    });

    res.end(headOnly ? undefined : buffer);
  });
}

function safeJoin(base, relative) {
  const resolved = path.resolve(base, '.' + path.sep + relative);

  return (
    resolved.startsWith(base + path.sep) ||
    resolved === base
  )
    ? resolved
    : null;
}

function validSite(site) {
  return Boolean(
    site &&
    typeof site === 'object' &&
    site.settings &&
    typeof site.settings === 'object' &&
    Array.isArray(site.menu) &&
    site.pages &&
    typeof site.pages === 'object' &&
    site.pages['']
  );
}

/* ---------- API routes ---------- */

async function api(req, res, url) {
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  try {
    if (req.method === 'GET' && url === '/api/site') {
      const data = await readSite();

      if (!data) {
        return send(res, 503, {
          error: 'Site content has not been initialized.'
        });
      }

      return send(
        res,
        200,
        data,
        'application/json; charset=utf-8'
      );
    }

    if (req.method === 'GET' && url === '/api/me') {
      return send(res, authed(req) ? 200 : 401, {
        ok: authed(req)
      });
    }

    if (req.method === 'POST' && url === '/api/login') {
      if (tooManyFails(ip)) {
        return send(res, 429, {
          error: 'Too many attempts. Wait a minute and try again.'
        });
      }

      const body = JSON.parse(
        (await readBody(req, 10000)) || '{}'
      );

      if (await checkPassword(body.password)) {
        fails.delete(ip);

        return send(res, 200, {
          token: newSession()
        });
      }

      const failure = fails.get(ip) || {
        n: 0,
        t: 0
      };

      failure.n++;
      failure.t = Date.now();

      fails.set(ip, failure);

      return send(res, 401, {
        error: 'Wrong password'
      });
    }

    // All remaining API routes require authentication.
    if (!authed(req)) {
      return send(res, 401, {
        error: 'Please log in'
      });
    }

    if (req.method === 'PUT' && url === '/api/site') {
      const site = JSON.parse(
        await readBody(req, 8 * 1024 * 1024)
      );

      if (!validSite(site)) {
        return send(res, 400, {
          error: 'Invalid site data'
        });
      }

      await backupSite();
      await writeSite(site);

      return send(res, 200, { ok: true });
    }

    if (req.method === 'POST' && url === '/api/password') {
      const body = JSON.parse(
        (await readBody(req, 10000)) || '{}'
      );

      if (!(await checkPassword(body.current))) {
        return send(res, 403, {
          error: 'Current password is wrong'
        });
      }

      if (!body.next || String(body.next).length < 6) {
        return send(res, 400, {
          error: 'New password must be at least 6 characters'
        });
      }

      await setPassword(String(body.next));

      return send(res, 200, { ok: true });
    }

    if (req.method === 'POST' && url === '/api/upload') {
      const body = JSON.parse(
        await readBody(req, 14 * 1024 * 1024)
      );

      const extension = path
        .extname(String(body.name || ''))
        .toLowerCase();

      if (
        ![
          '.png',
          '.jpg',
          '.jpeg',
          '.gif',
          '.webp',
          '.svg',
          '.ico'
        ].includes(extension)
      ) {
        return send(res, 400, {
          error: 'Unsupported image type'
        });
      }

      const base64 = String(body.data || '')
        .replace(/^data:[^,]*,/, '');

      const buffer = Buffer.from(base64, 'base64');

      if (!buffer.length || buffer.length > 10 * 1024 * 1024) {
        return send(res, 400, {
          error: 'Image empty or over 10 MB'
        });
      }

      const filename =
        Date.now().toString(36) +
        crypto.randomBytes(4).toString('hex') +
        extension;

      await sb.uploadObject(
        filename,
        buffer,
        MIME[extension]
      );

      return send(res, 200, {
        url: '/uploads/' + filename
      });
    }

    if (req.method === 'POST' && url === '/api/reset') {
      await backupSite();

      const seed = loadSeed();

      await writeSite(seed);

      return send(res, 200, seed);
    }

    return send(res, 404, {
      error: 'Unknown API route'
    });
  } catch (error) {
    console.error('API error:', error);

    if (error.message === 'too large') {
      return send(res, 413, {
        error: 'Request too large'
      });
    }

    if (/^Supabase/i.test(error.message)) {
      return send(res, 502, {
        error: 'Database error. Check the server logs.'
      });
    }

    return send(res, 400, {
      error: 'Bad request'
    });
  }
}

/* ---------- HTTP request dispatcher ---------- */

const server = http.createServer(async (req, res) => {
  let url;

  try {
    url = decodeURIComponent(
      (req.url || '/').split('?')[0]
    );
  } catch {
    return send(res, 400, 'Bad URL');
  }

  if (url.startsWith('/api/')) {
    return api(req, res, url);
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'Method not allowed');
  }

  const headOnly = req.method === 'HEAD';

  if (url.startsWith('/uploads/')) {
    const name = url.slice('/uploads/'.length);

    if (!/^[A-Za-z0-9._-]+$/.test(name)) {
      return send(res, 404, 'Not found');
    }

    try {
      const object = await sb.downloadObject(name);

      if (!object) {
        return send(res, 404, 'Not found');
      }

      const type =
        MIME[path.extname(name).toLowerCase()] ||
        object.type ||
        'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': type,
        'Content-Length': object.buf.length,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public, max-age=86400'
      });

      return res.end(headOnly ? undefined : object.buf);
    } catch (error) {
      console.error('Storage error:', error.message);
      return send(res, 502, 'Storage error');
    }
  }

  // Logo images kept in the project root folder (next to server.js).
  const ROOT_IMAGES = [
    'ieee_logos.jpeg',
    'ieee_hyderabad_section.jpeg',
    'ieee_computer_society.jpeg'
  ];
  const rootName = url.replace(/^\/+/, '');
  if (ROOT_IMAGES.includes(rootName)) {
    return serveFile(res, path.join(ROOT, rootName), headOnly);
  }

  const file =
    url === '/' ? null : safeJoin(PUB, url);

  if (
    file &&
    fs.existsSync(file) &&
    fs.statSync(file).isFile()
  ) {
    return serveFile(res, file, headOnly);
  }

  // Render the app shell for other frontend routes.
  return serveFile(
    res,
    path.join(PUB, 'index.html'),
    headOnly
  );
});

/* ---------- Server initialization ---------- */

let initialization;

function ensureInitialized() {
  if (!initialization) {
    initialization = (async () => {
      if (!sb.configured()) {
        throw new Error(
          'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.'
        );
      }

      await initSite();
      await initAdmin();
    })().catch(error => {
      // Allow a later invocation to retry initialization.
      initialization = null;
      throw error;
    });
  }

  return initialization;
}

/* ---------- Vercel serverless handler ---------- */

module.exports = async function handler(req, res) {
  try {
    await ensureInitialized();

    // Dispatch through the existing HTTP request handler.
    server.emit('request', req, res);
  } catch (error) {
    console.error('Server initialization failed:', error);

    if (!res.headersSent && !res.writableEnded) {
      send(res, 500, {
  error: 'Server initialization failed. Check Vercel runtime logs.',
  reason: String(error && error.message || error).slice(0, 400)
});
    }
  }
};

/* ---------- Local development ---------- */

if (require.main === module) {
  ensureInitialized()
    .then(() => {
      server.listen(PORT, () => {
        console.log('\nICICSE 2027 website running');
        console.log('Site: http://localhost:' + PORT);
        console.log('Admin: use the Admin login link in the footer');
        console.log('Data: Supabase (' + process.env.SUPABASE_URL + ')');
        console.log('');
      });
    })
    .catch(error => {
      console.error(
        'Could not initialize the website:',
        error.message
      );
      process.exitCode = 1;
    });
}
