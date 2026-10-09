// Minimal zero-dependency Supabase client (REST + Storage) using Node's built-in fetch.
const URL_ = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SECRET_KEY || '';
const BUCKET = process.env.SUPABASE_BUCKET || 'uploads';

function headers(extra) {
  const h = { apikey: KEY };
  if (KEY.startsWith('eyJ')) h.Authorization = 'Bearer ' + KEY; // legacy JWT keys; new sb_secret_ keys use apikey only
  return Object.assign(h, extra || {});
}
function configured() { return !!(URL_ && KEY); }

async function rest(method, pathAndQuery, body, prefer) {
  const r = await fetch(URL_ + '/rest/v1/' + pathAndQuery, {
    method,
    headers: headers(Object.assign({ 'Content-Type': 'application/json' }, prefer ? { Prefer: prefer } : {})),
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await r.text();
  if (!r.ok) throw new Error('Supabase ' + method + ' ' + pathAndQuery.split('?')[0] + ' failed (' + r.status + '): ' + text);
  return text ? JSON.parse(text) : null;
}

async function uploadObject(name, buf, contentType) {
  const r = await fetch(URL_ + '/storage/v1/object/' + BUCKET + '/' + encodeURIComponent(name), {
    method: 'POST',
    headers: headers({ 'Content-Type': contentType, 'x-upsert': 'true' }),
    body: buf
  });
  if (!r.ok) throw new Error('Supabase upload failed (' + r.status + '): ' + await r.text());
}

async function downloadObject(name) {
  const r = await fetch(URL_ + '/storage/v1/object/' + BUCKET + '/' + encodeURIComponent(name), { headers: headers() });
  if (!r.ok) return null;
  return { buf: Buffer.from(await r.arrayBuffer()), type: r.headers.get('content-type') };
}

module.exports = { configured, rest, uploadObject, downloadObject, BUCKET };
