// One-time import of an existing local install (data/site.json, data/admin.json, data/uploads/*) into Supabase.
// Usage: put your old "data" folder next to this file, set up .env, then run:  node migrate.js
require('./lib.env');
const fs = require('fs'), path = require('path');
const sb = require('./lib.supabase');
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const DATA = path.join(__dirname, 'data');

(async () => {
  if (!sb.configured()) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env first.'); process.exit(1); }
  if (!fs.existsSync(DATA)) { console.log('No ./data folder found, nothing to migrate. Just run: node server.js'); return; }

  const siteF = path.join(DATA, 'site.json');
  if (fs.existsSync(siteF)) {
    const site = JSON.parse(fs.readFileSync(siteF, 'utf8'));
    await sb.rest('POST', 'site_content?on_conflict=id', { id: 1, data: site, updated_at: new Date().toISOString() }, 'resolution=merge-duplicates,return=minimal');
    console.log('✔ site content imported');
  }
  const admF = path.join(DATA, 'admin.json');
  if (fs.existsSync(admF)) {
    const a = JSON.parse(fs.readFileSync(admF, 'utf8'));
    await sb.rest('POST', 'admin_credentials?on_conflict=id', { id: 1, salt: a.salt, hash: a.hash }, 'resolution=merge-duplicates,return=minimal');
    console.log('✔ admin password imported (same password as before)');
  }
  const upDir = path.join(DATA, 'uploads');
  if (fs.existsSync(upDir)) {
    let n = 0;
    for (const f of fs.readdirSync(upDir)) {
      const ext = path.extname(f).toLowerCase();
      if (!MIME[ext]) continue;
      await sb.uploadObject(f, fs.readFileSync(path.join(upDir, f)), MIME[ext]);
      n++;
    }
    console.log('✔ ' + n + ' uploaded image(s) copied to Supabase Storage');
  }
  console.log('Done. Start the site with: node server.js');
})().catch(e => { console.error('Migration failed:', e.message); process.exit(1); });
