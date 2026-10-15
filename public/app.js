/* ICICSE 2027 — single-page site with a built-in editor. */
(() => {
'use strict';

/* ================= state ================= */
let site = null;            // working copy (edited in memory)
let editMode = false;
let dirty = false;
let token = null;
try { token = localStorage.getItem('icicse_token'); } catch (e) {}
let isAdmin = false;
let timers = [];

const app = document.getElementById('app');
const PRESETS = {
  'IEEE Blue (original look)': { primary: '#005A9C', primaryDark: '#003A6B', accent: '#0099D8', navActive: '#005A9C', cta: '#005A9C', bg: '#F8F8F8', text: '#333333', card: '#FFFFFF', headerBg: '#F7FAFE', headerBg2: '#DBF0FC', nav: '#0099D8', footer: '#005A9C', muted: '#6B7280' },
  'Navy & Gold':   { primary: '#12305A', primaryDark: '#0B1F3A', accent: '#B58A2E', bg: '#F4F5F7', text: '#1E2A38', card: '#FFFFFF', headerBg: '#FFFFFF', nav: '#12305A', footer: '#0B1F3A', muted: '#5B6775' },
  'Slate & Teal':  { primary: '#1F3B4D', primaryDark: '#12242F', accent: '#0F8B8D', bg: '#F2F5F6', text: '#1D2B33', card: '#FFFFFF', headerBg: '#FFFFFF', nav: '#1F3B4D', footer: '#12242F', muted: '#586873' },
  'Burgundy & Cream': { primary: '#5B1A2B', primaryDark: '#3A0F1B', accent: '#B8863B', bg: '#FAF7F2', text: '#2B2024', card: '#FFFFFF', headerBg: '#FFFDF9', nav: '#5B1A2B', footer: '#3A0F1B', muted: '#6C5E62' },
  'Forest & Sand': { primary: '#1F4D3A', primaryDark: '#12301F', accent: '#C08A3E', bg: '#F5F5F0', text: '#1F2A24', card: '#FFFFFF', headerBg: '#FFFFFF', nav: '#1F4D3A', footer: '#12301F', muted: '#5A6A60' },
  'Charcoal & Blue': { primary: '#2B2F36', primaryDark: '#16181C', accent: '#2F6FED', bg: '#F3F4F6', text: '#1F2328', card: '#FFFFFF', headerBg: '#FFFFFF', nav: '#2B2F36', footer: '#16181C', muted: '#5F6670' }
};
const COLOR_LABELS = { primary: 'Primary (headings, buttons)', primaryDark: 'Primary dark', accent: 'Accent (highlights, card borders)', nav: 'Menu bar background', navActive: 'Menu active underline', cta: 'Menu button (Submit Paper)', headerBg: 'Header background (top)', headerBg2: 'Header background (bottom)', footer: 'Footer background', bg: 'Page background', card: 'Card background', text: 'Body text', muted: 'Secondary text' };
const FONTS = {
  'sans': ["'Inter', system-ui, sans-serif", "'Inter', system-ui, sans-serif", 'All sans-serif, bold headings (original look)', 800],
  'serif-sans': ["'Inter', system-ui, sans-serif", "'Playfair Display', Georgia, serif", 'Elegant serif headings + clean sans body', 700],
  'serif': ["'Source Serif 4', Georgia, serif", "'Source Serif 4', Georgia, serif", 'All serif (academic)', 700]
};
const colorOf = (c, k) => c[k] || ({ headerBg2: c.headerBg, navActive: c.accent, cta: c.accent }[k]) || '#000000';

/* ================= tiny DOM helpers ================= */
const h = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => 's' + Math.random().toString(36).slice(2, 9);
const clone = o => JSON.parse(JSON.stringify(o));
const stripHtml = s => String(s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

function toast(msg, err) {
  const t = h('div', 'toast' + (err ? ' err' : ''), esc(msg));
  document.body.append(t); setTimeout(() => t.remove(), err ? 4500 : 2200);
}
function markDirty() { if (!dirty) { dirty = true; updateBar(); } }
function normHref(u) {
  u = String(u || '').trim();
  if (!u || u === '#') return '#';
  if (/^(https?:|mailto:|tel:|#|\/uploads\/)/i.test(u)) return u;
  if (u === './' || u === '.') return '/';
  u = '/' + u.replace(/^\.?\//, '').replace(/\.html$/, '');
  return u;
}
const isExternal = u => /^(https?:|mailto:|tel:)/i.test(u);
function link(cls, href, html) {
  const a = h('a', cls, html); a.href = normHref(href);
  if (/^https?:/i.test(href)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
  return a;
}

/* ---- editable plain text bound to obj[key] ---- */
function T(tag, obj, key, cls, opt) {
  opt = opt || {};
  const n = document.createElement(tag); if (cls) n.className = cls;
  n.textContent = obj[key] == null ? '' : obj[key];
  if (editMode) {
    n.contentEditable = 'true'; n.classList.add('ed'); n.spellcheck = true;
    n.dataset.ph = opt.ph || 'Click to edit';
    n.addEventListener('input', () => { obj[key] = n.textContent; markDirty(); });
    n.addEventListener('paste', e => {
      e.preventDefault();
      let t = (e.clipboardData || window.clipboardData).getData('text/plain');
      if (!opt.multiline) t = t.replace(/\s*\n\s*/g, ' ');
      document.execCommand('insertText', false, t);
    });
    if (!opt.multiline) n.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); n.blur(); } });
    n.addEventListener('click', e => { if (n.closest('a')) e.preventDefault(); });
  }
  return n;
}

/* ---- rich-text block ---- */
let rtb;
function ensureToolbar() {
  if (rtb) return;
  rtb = h('div'); rtb.id = 'rtb';
  const cmds = [['B', 'bold'], ['I', 'italic'], ['U', 'underline'], ['H2', 'h3'], ['¶', 'p'], ['• List', 'ul'], ['1. List', 'ol'], ['Link', 'link'], ['Unlink', 'unlink'], ['Clear', 'clear']];
  cmds.forEach(([label, c]) => {
    const b = h('button', '', label); b.type = 'button'; b.title = c;
    b.addEventListener('mousedown', e => {
      e.preventDefault();
      if (c === 'bold' || c === 'italic' || c === 'underline') document.execCommand(c);
      else if (c === 'h3') document.execCommand('formatBlock', false, 'h3');
      else if (c === 'p') document.execCommand('formatBlock', false, 'p');
      else if (c === 'ul') document.execCommand('insertUnorderedList');
      else if (c === 'ol') document.execCommand('insertOrderedList');
      else if (c === 'unlink') document.execCommand('unlink');
      else if (c === 'clear') document.execCommand('removeFormat');
      else if (c === 'link') { const u = prompt('Link address (https://… or /page or mailto:…):'); if (u) document.execCommand('createLink', false, u); }
      const ed = document.activeElement; if (ed && ed.isContentEditable) ed.dispatchEvent(new Event('input', { bubbles: true }));
    });
    rtb.append(b);
  });
  document.body.append(rtb);
}
function R(obj, key, cls) {
  const n = h('div', cls || 'prose'); n.innerHTML = obj[key] || '';
  if (editMode) {
    ensureToolbar();
    n.contentEditable = 'true'; n.classList.add('ed'); n.dataset.ph = 'Click to write text';
    n.addEventListener('input', () => { obj[key] = n.innerHTML; markDirty(); });
    n.addEventListener('focus', () => {
      const r = n.getBoundingClientRect();
      rtb.style.display = 'flex';
      rtb.style.top = (r.top + scrollY - 46) + 'px';
      rtb.style.left = Math.max(8, Math.min(r.left + scrollX, innerWidth - 400)) + 'px';
    });
    n.addEventListener('blur', () => setTimeout(() => { if (!document.activeElement || !document.activeElement.classList.contains('rich')) rtb.style.display = 'none'; }, 120));
    n.classList.add('rich');
    n.addEventListener('paste', e => { e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain')); });
    n.addEventListener('click', e => { if (e.target.closest('a')) e.preventDefault(); });
  }
  return n;
}

function miniBtn(label, fn, danger, inline) {
  const b = h('button', 'mini' + (danger ? ' danger' : '') + (inline ? ' inline' : ''), esc(label)); b.type = 'button';
  b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); fn(); }); return b;
}
function addBtn(label, fn) { const b = h('button', 'add-btn', esc(label)); b.type = 'button'; b.onclick = fn; return b; }
function rerender() { const y = scrollY; renderMain(); window.scrollTo(0, y); }
function move(arr, i, d) { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; markDirty(); rerender(); }

/* ================= image upload ================= */
function pickImage(cb) {
  const choice = prompt('Type an image address (URL) — or leave empty and press OK to upload a file from your computer:', '');
  if (choice === null) return;
  if (choice.trim()) return cb(choice.trim());
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = () => {
    const f = inp.files[0]; if (!f) return;
    if (f.size > 9 * 1024 * 1024) return toast('Image must be under 9 MB', true);
    const fr = new FileReader();
    fr.onload = async () => {
      try { const r = await apiCall('POST', '/api/upload', { name: f.name, data: fr.result }); cb(r.url); toast('Image uploaded'); }
      catch (e) { toast(e.message, true); }
    };
    fr.readAsDataURL(f);
  };
  inp.click();
}

/* ================= API ================= */
async function apiCall(method, url, body) {
  const r = await fetch(url, { method, headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}), body: body ? JSON.stringify(body) : undefined });
  let data = {}; try { data = await r.json(); } catch (e) {}
  if (r.status === 401 && token && url !== '/api/login') { isAdmin = false; token = null; try { localStorage.removeItem('icicse_token'); } catch (e) {} updateBar(); throw new Error('Session expired — please log in again.'); }
  if (!r.ok) throw new Error(data.error || ('Request failed (' + r.status + ')'));
  return data;
}

/* ================= theme ================= */
function applyTheme() {
  const c = site.settings.colors || PRESETS['IEEE Blue (original look)'];
  const root = document.documentElement.style;
  root.setProperty('--primary', c.primary); root.setProperty('--primary-dark', c.primaryDark); root.setProperty('--accent', c.accent);
  root.setProperty('--bg', c.bg); root.setProperty('--text', c.text); root.setProperty('--card', c.card);
  root.setProperty('--header-bg', c.headerBg); root.setProperty('--header-bg2', colorOf(c, 'headerBg2')); root.setProperty('--nav-active', colorOf(c, 'navActive')); root.setProperty('--cta', colorOf(c, 'cta')); root.setProperty('--nav', c.nav); root.setProperty('--footer', c.footer); root.setProperty('--muted', c.muted);
  const f = FONTS[site.settings.font] || FONTS['sans'];
  root.setProperty('--font-body', f[0]); root.setProperty('--font-head', f[1]); root.setProperty('--head-weight', f[3]);
}

/* ================= routing ================= */
function currentSlug() {
  return decodeURIComponent(location.pathname).replace(/\.html$/, '').replace(/^\/+|\/+$/g, '').replace(/^index$/, '');
}
function go(url) {
  history.pushState({}, '', url);
  renderMain(); renderNavs(); window.scrollTo(0, 0); closeDrawer();
  const hash = location.hash; if (hash) setTimeout(() => { const t = document.getElementById(hash.slice(1)); if (t) t.scrollIntoView(); }, 50);
}
document.addEventListener('click', e => {
  const a = e.target.closest('a'); if (!a || !a.getAttribute('href')) return;
  const href = a.getAttribute('href');
  if (a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
  if (href === '#') { e.preventDefault(); return; }
  if (href.startsWith('/') && !href.startsWith('/uploads/') && !href.startsWith('/api/')) { e.preventDefault(); go(href); }
});
window.addEventListener('popstate', () => { renderMain(); renderNavs(); });
window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

/* ================= shell ================= */
let elMain, elHeader, elNav, elFooter, elDrawer, elBackdrop, elTop;
function buildShell() {
  app.innerHTML = '';
  elTop = h('div', 'topbar'); elHeader = h('header', 'site-header'); elNav = h('nav', 'nav');
  elDrawer = h('div', 'drawer'); elBackdrop = h('div', 'backdrop'); elMain = h('main'); elMain.id = 'main';
  elFooter = h('footer', 'site-footer');
  const tt = h('button', 'to-top', '<i class="fa-solid fa-chevron-up"></i>'); tt.onclick = () => scrollTo({ top: 0, behavior: 'smooth' });
  window.addEventListener('scroll', () => { tt.style.display = scrollY > 300 ? 'block' : 'none'; });
  elBackdrop.onclick = closeDrawer;
  app.append(elTop, elHeader, elNav, elDrawer, elBackdrop, elMain, elFooter, tt);
}
function closeDrawer() { elDrawer.classList.remove('open'); elBackdrop.classList.remove('open'); }

function renderAll() {
  applyTheme(); buildShell();
  document.body.classList.toggle('editing', editMode);
  document.body.classList.toggle('has-admin', isAdmin);
  renderChrome(); renderNavs(); renderMain(); updateBar();
}

/* header / topbar / footer */
function renderChrome() {
  const s = site.settings;
  // top bar
  elTop.innerHTML = '<div class="container"></div>';
  (s.topLinks || []).forEach(l => elTop.firstChild.append(link('', l.url, esc(l.label))));
  // header
  elHeader.innerHTML = '';
  const c = h('div', 'container');
  const brand = h('a', 'brand'); brand.href = '/';
  if (s.logoImage) { const im = h('img', 'logo-img'); im.src = s.logoImage; im.alt = s.shortName + ' logo'; brand.append(im); }
  else { brand.append(T('div', s, 'logoText', 'logo-badge', { ph: 'LOGO' })); }
  const txt = h('div', 'brand-text');
  txt.append(T('h1', s, 'shortName', 'short'));
  const meta = h('p', 'meta');
  meta.append(T('span', s, 'dates', ''), document.createTextNode('  |  '), T('b', s, 'mode', ''));
  txt.append(meta);
  const v = h('p', 'meta'); v.append(T('span', s, 'venue', ''), document.createTextNode(', '), T('span', s, 'city', '')); txt.append(v);
  txt.append(T('p', s, 'title', 'full'));
  brand.append(txt); c.append(brand);
  const right = h('div', 'header-right');
  const form = h('form', 'search', '<input type="search" placeholder="Search conference…" aria-label="Search"><button aria-label="Search"><i class="fa-solid fa-magnifying-glass"></i></button>');
  form.onsubmit = e => { e.preventDefault(); const q = form.querySelector('input').value.trim(); if (q) go('/search?q=' + encodeURIComponent(q)); };
  right.append(form);
  const pr = h('div', 'partners');
  (s.partners || []).forEach(p => {
    const a = p.url ? link('partner', p.url, '') : h('span', 'partner');
    if (p.image) { const im = h('img'); im.src = p.image; im.alt = p.name; a.append(im); } else a.textContent = p.name;
    pr.append(a);
  });
  right.append(pr);
  const bg = h('button', 'burger', '<i class="fa-solid fa-bars"></i> MENU'); bg.onclick = () => { elDrawer.classList.add('open'); elBackdrop.classList.add('open'); };
  right.append(bg); c.append(right); elHeader.append(c);
  // footer
  elFooter.innerHTML = '';
  const fc = h('div', 'container');
  const ul = h('ul'); (s.footerLinks || []).forEach(l => { const li = h('li'); li.append(link('', l.url, esc(l.label))); ul.append(li); });
  fc.append(ul);
  const row = h('div', 'foot-row'); const left = h('div');
  left.append(T('p', s, 'footerText', '', { multiline: true }), T('p', s, 'footerNote', '', { multiline: true }));
  const cp = h('p'); cp.innerHTML = 'Contact: '; cp.append(link('', 'mailto:' + (s.contactEmail || ''), esc(s.contactEmail || ''))); left.append(cp);
  row.append(left);
  const so = h('div', 'socials'); (s.socials || []).forEach(x => so.append(link('', x.url, '<i class="' + esc(x.icon) + '"></i>'))); row.append(so);
  fc.append(row);
  if (!isAdmin) { const al = h('button', 'admin-link', 'Admin login'); al.onclick = loginModal; fc.append(al); }
  elFooter.append(fc);
}

/* navigation (desktop + drawer) */
function isActive(item, path) {
  const hr = normHref(item.href);
  if (hr !== '#' && !isExternal(hr) && hr.split('#')[0] === path) return true;
  return (item.children || []).some(ch => isActive(ch, path));
}
function renderNavs() {
  const path = '/' + currentSlug();
  const menu = site.menu;
  // desktop
  elNav.innerHTML = '';
  const c = h('div', 'container'); const ul = h('ul');
  const build = (items, top) => {
    const u = top ? ul : h('ul', 'sub');
    items.forEach(it => {
      const li = h('li'); if (it.cta && top) li.classList.add('cta');
      if (isActive(it, path) && top && !it.cta) li.classList.add('active');
      const hasKids = it.children && it.children.length;
      const hr = normHref(it.href);
      let a;
      if (hr === '#') a = h('div', 'nolink', esc(it.label)); else a = link(isActive(it, path) && !hasKids ? 'active' : '', it.href, esc(it.label));
      if (hasKids) a.insertAdjacentHTML('beforeend', top ? '<i class="fa-solid fa-caret-down" style="font-size:11px"></i>' : '<i class="fa-solid fa-caret-right" style="font-size:11px"></i>');
      li.append(a);
      if (hasKids) li.append(build(it.children, false));
      u.append(li);
    });
    return u;
  };
  build(menu, true); c.append(ul); elNav.append(c);
  // drawer
  elDrawer.innerHTML = '';
  const dh = h('div', 'dh', '<span>MENU</span>'); const x = h('button', '', '&times;'); x.onclick = closeDrawer; dh.append(x); elDrawer.append(dh);
  const f = h('form', '', '<input type="search" placeholder="Search conference…">');
  f.onsubmit = e => { e.preventDefault(); const q = f.querySelector('input').value.trim(); if (q) go('/search?q=' + encodeURIComponent(q)); };
  elDrawer.append(f);
  const dl = (items) => {
    const u = h('ul');
    items.forEach(it => {
      const li = h('li'); if (it.cta) li.classList.add('cta');
      if (it.children && it.children.length) {
        const d = h('details'); const sm = h('summary', '', esc(it.label) + ' <i class="fa-solid fa-caret-down" style="float:right;margin-top:4px"></i>');
        d.append(sm, dl(it.children)); li.append(d);
      } else { const hr = normHref(it.href); li.append(hr === '#' ? h('a', '', esc(it.label)) : link(isActive(it, path) ? 'active' : '', it.href, esc(it.label))); }
      u.append(li);
    });
    return u;
  };
  elDrawer.append(dl(menu));
}

/* ================= main content ================= */
function renderMain() {
  timers.forEach(clearInterval); timers = [];
  const slug = currentSlug();
  elMain.innerHTML = '';
  let page;
  if (slug === 'search') page = searchPage();
  else if (slug === 'admin') { if (!isAdmin) setTimeout(loginModal, 50); page = site.pages['']; if (slug === 'admin') history.replaceState({}, '', '/'); }
  else page = site.pages[slug];
  if (!page) {
    elMain.append(h('div', 'content-card', '<h2 class="section-title">Page not found</h2><p>The page you are looking for does not exist. <a href="/">Return to the home page</a>.</p>'));
    document.title = 'Page not found | ' + site.settings.shortName; return;
  }
  document.title = (page.title && slug ? page.title + ' | ' : '') + site.settings.shortName;
  if (page.virtual) { elMain.append(page.node); return; }
  page.sections.forEach((s, i) => elMain.append(renderSection(page, s, i)));
  if (editMode) elMain.append(addSectionBox(page));

}

/* ---- section wrapper with editing toolbar ---- */
const TYPE_NAMES = { hero: 'Slider', countdown: 'Countdown', richtext: 'Text', cards: 'Cards', table: 'Table', committee: 'Committee', program: 'Programme' };
function renderSection(page, s, i) {
  const w = h('section', 'sec'); if (s.anchor) w.id = s.anchor;
  const body = ({ hero: renderHero, countdown: renderCountdown, richtext: renderText, cards: renderCards, table: renderTable, committee: renderCommittee, program: renderProgram }[s.type] || (() => h('div')))(s);
  w.append(body);
  if (editMode) {
    const bar = h('div', 'sec-bar'); bar.append(h('span', 'tag', TYPE_NAMES[s.type] || s.type));
    const b = (label, fn, cls) => { const x = h('button', cls || '', label); x.type = 'button'; x.onclick = fn; bar.append(x); };
    if (s.type === 'cards') b('Columns: ' + (s.cols || 3), () => { s.cols = s.cols === 4 ? 2 : (s.cols || 3) + 1; markDirty(); rerender(); });
    if (s.type === 'cards' || s.type === 'table') b(s.center ? 'Left-align title' : 'Center title', () => { s.center = !s.center; markDirty(); rerender(); });
    if (s.type === 'richtext') b('Anchor id', () => { const v = prompt('Anchor id for links like #theme (letters only, empty to remove):', s.anchor || ''); if (v !== null) { s.anchor = v.replace(/[^a-z0-9-]/gi, ''); markDirty(); rerender(); } });
    b('▲', () => move(page.sections, i, -1)); b('▼', () => move(page.sections, i, 1));
    b('Duplicate', () => { const c = clone(s); c.id = uid(); page.sections.splice(i + 1, 0, c); markDirty(); rerender(); });
    b('Delete', () => { if (confirm('Delete this section?')) { page.sections.splice(i, 1); markDirty(); rerender(); } }, 'danger');
    w.append(bar);
  }
  return w;
}
function addSectionBox(page) {
  const box = h('div', 'add-sec');
  const sel = h('select', '', Object.entries({ richtext: 'Text block', cards: 'Cards grid', table: 'Table', committee: 'Committee list', program: 'Programme / schedule', hero: 'Image slider', countdown: 'Countdown banner' }).map(([k, v]) => `<option value="${k}">${v}</option>`).join(''));
  const b = h('button', 'fbtn primary', '+ Add section to this page'); b.type = 'button'; b.style.marginLeft = '10px';
  b.onclick = () => {
    const t = sel.value, id = uid();
    const d = {
      richtext: { id, type: 'richtext', title: 'New Section', html: '<p>Write your content here.</p>', anchor: '' },
      cards: { id, type: 'cards', title: 'New Cards', intro: '', cols: 3, center: false, items: [{ icon: 'fa-solid fa-star', title: 'Card title', text: 'Card description' }] },
      table: { id, type: 'table', title: 'New Table', intro: '', columns: ['Column 1', 'Column 2'], rows: [['', ''], ['', '']], note: '' },
      committee: { id, type: 'committee', title: 'Committee', groups: [{ role: 'Role', members: [{ name: 'Name', details: '', phone: '', email: '' }] }] },
      program: { id, type: 'program', title: 'Programme', intro: '', days: [{ title: 'Day 1', date: 'Date', items: [{ time: '9:00 AM', title: 'Session', speaker: '' }] }] },
      hero: { id, type: 'hero', slides: [{ title: 'Slide title', text: 'Short description', btnLabel: '', btnHref: '', image: '' }] },
      countdown: { id, type: 'countdown' }
    }[t];
    page.sections.push(d); markDirty(); rerender();
  };
  box.append(sel, b); return box;
}

/* ---- text ---- */
function renderText(s) {
  const c = h('div', 'content-card');
  if (s.title || editMode) c.append(T('h2', s, 'title', 'section-title', { ph: 'Section title' }));
  c.append(R(s, 'html')); return c;
}

/* ---- hero ---- */
function renderHero(s) {
  const w = h('div', 'hero'); let cur = 0, timer;
  const slides = s.slides.map((sl, i) => {
    const d = h('div', 'slide g' + (i % 4) + (i === 0 ? ' active' : ''));
    if (sl.image) { d.classList.add('photo'); d.style.setProperty('--img', 'url("' + String(sl.image).replace(/"/g, '%22') + '")'); }
    const inner = h('div', 'slide-inner');
    inner.append(T('h2', sl, 'title', '', { ph: 'Slide title' }));
    if (sl.text || editMode) inner.append(T('p', sl, 'text', '', { multiline: true, ph: 'Description' }));
    if (sl.btnLabel || editMode) {
      const a = link('btn', sl.btnHref || '#', ''); a.append(T('span', sl, 'btnLabel', '', { ph: 'Button text' })); inner.append(a);
      if (editMode) {
        inner.append(miniBtn('Button link', () => { const v = prompt('Button link (e.g. /registration or https://…):', sl.btnHref || ''); if (v !== null) { sl.btnHref = v.trim(); markDirty(); rerender(); } }, false, true));
      }
    }
    if (editMode) {
      inner.append(miniBtn('Background image', () => pickImage(u => { sl.image = u; markDirty(); rerender(); }), false, true));
      if (sl.image) inner.append(miniBtn('Remove image', () => { sl.image = ''; markDirty(); rerender(); }, true, true));
      inner.append(miniBtn('Delete slide', () => { if (s.slides.length > 1 && confirm('Delete this slide?')) { s.slides.splice(i, 1); markDirty(); rerender(); } }, true, true));
    }
    d.append(inner); w.append(d); return d;
  });
  const dots = h('div', 'dots'); const ds = s.slides.map((_, i) => { const b = h('button', 'dot' + (i === 0 ? ' active' : '')); b.type = 'button'; b.setAttribute('aria-label', 'Slide ' + (i + 1)); b.onclick = () => { show(i); restart(); }; dots.append(b); return b; });
  const show = n => { cur = (n + slides.length) % slides.length; slides.forEach((x, i) => x.classList.toggle('active', i === cur)); ds.forEach((x, i) => x.classList.toggle('active', i === cur)); };
  const restart = () => { clearInterval(timer); if (!editMode) { timer = setInterval(() => show(cur + 1), 6000); timers.push(timer); } };
  if (slides.length > 1) {
    const p = h('button', 'hero-nav prev', '‹'); p.type = 'button'; p.onclick = () => { show(cur - 1); restart(); };
    const n = h('button', 'hero-nav next', '›'); n.type = 'button'; n.onclick = () => { show(cur + 1); restart(); };
    w.append(p, n, dots);
  }
  if (editMode) {
    const add = addBtn('+ Add slide', () => { s.slides.push({ title: 'New slide', text: 'Description', btnLabel: '', btnHref: '', image: '' }); markDirty(); rerender(); });
    add.style.cssText = 'position:absolute;top:14px;left:14px;z-index:8;background:#0f1724;margin:0;color:#fff;border-color:#fff';
    w.append(add);
  }
  restart(); return w;
}

/* ---- countdown ---- */
function renderCountdown() {
  const s = site.settings; const w = h('div', 'countdown');
  const top = h('div', 'cd-top'); const l = h('div');
  l.append(T('p', s, 'sponsorLabel', 'eyebrow'));
  const hh = h('h2'); hh.append(T('span', s, 'sponsoredBy', '')); l.append(hh); top.append(l);
  const bd = h('div', 'badge-pill', '<i class="fa-solid fa-certificate"></i>'); bd.append(T('span', s, 'badge', '')); top.append(bd);
  w.append(top);
  const main = h('div', 'cd-main'); const info = h('div');
  info.append(T('h3', s, 'shortName', ''));
  const r1 = h('div', 'cd-info', '<div class="cd-ico"><i class="fa-regular fa-calendar"></i></div>'); const d1 = h('div');
  d1.append(h('p', 'eyebrow', 'Event Dates'), T('p', s, 'dates', 'v')); r1.append(d1);
  const r2 = h('div', 'cd-info', '<div class="cd-ico"><i class="fa-solid fa-location-dot"></i></div>'); const d2 = h('div');
  d2.append(h('p', 'eyebrow', 'Location'), T('p', s, 'venue', 'v'), T('p', s, 'city', 's')); r2.append(d2);
  info.append(r1, r2);
  const boxes = h('div', 'cd-boxes');
  const mk = (id, lab) => { const b = h('div', 'cd-box', '<b id="' + id + '">00</b><span>' + lab + '</span>'); boxes.append(b); };
  mk('cd-d', 'Days'); mk('cd-h', 'Hours'); mk('cd-m', 'Mins'); mk('cd-s', 'Secs');
  main.append(info, boxes); w.append(main);
  const tick = () => {
    const t = new Date(s.countdownTarget).getTime(); if (isNaN(t)) return;
    const dist = t - Date.now(); const g = id => w.querySelector('#' + id);
    if (!g('cd-d')) return;
    if (dist <= 0) { boxes.innerHTML = '<div style="grid-column:1/-1;text-align:center;font-family:var(--font-head);font-size:28px">The conference has begun!</div>'; return; }
    const p = n => String(n).padStart(2, '0');
    g('cd-d').textContent = p(Math.floor(dist / 864e5)); g('cd-h').textContent = p(Math.floor(dist % 864e5 / 36e5));
    g('cd-m').textContent = p(Math.floor(dist % 36e5 / 6e4)); g('cd-s').textContent = p(Math.floor(dist % 6e4 / 1e3));
  };
  tick(); timers.push(setInterval(tick, 1000));
  if (editMode) { const n = h('p', 'note', ''); n.style.color = '#cfd8e6'; n.innerHTML = 'Countdown target date/time: change it in <b>Settings</b>.'; w.append(n); }
  return w;
}

/* ---- cards ---- */
function renderCards(s) {
  const c = h('div', 'content-card');
  c.append(T('h2', s, 'title', 'section-title' + (s.center ? ' center' : ''), { ph: 'Section title' }));
  if (s.intro || editMode) c.append(T('p', s, 'intro', 'lead', { multiline: true, ph: 'Optional intro text' }));
  const g = h('div', 'grid cols-' + (s.cols || 3));
  s.items.forEach((it, i) => {
    const d = h('div', 'card-item');
    const ic = h('div', 'card-icon', '<i class="' + esc(it.icon || 'fa-solid fa-star') + '"></i>');
    if (editMode) { ic.style.cursor = 'pointer'; ic.title = 'Click to change the icon'; ic.onclick = () => { const v = prompt('Font Awesome icon classes, e.g. "fa-solid fa-lock" (browse icons at fontawesome.com/icons):', it.icon || ''); if (v !== null) { it.icon = v.trim(); markDirty(); rerender(); } }; }
    d.append(ic, T('h3', it, 'title', '', { ph: 'Title' }), T('p', it, 'text', '', { multiline: true, ph: 'Description' }));
    if (editMode) { d.append(miniBtn('✕ remove', () => { s.items.splice(i, 1); markDirty(); rerender(); }, true)); }
    g.append(d);
  });
  c.append(g);
  if (editMode) c.append(addBtn('+ Add card', () => { s.items.push({ icon: 'fa-solid fa-star', title: 'New card', text: 'Description' }); markDirty(); rerender(); }));
  return c;
}

/* ---- table ---- */
function renderTable(s) {
  const c = h('div', 'content-card');
  c.append(T('h2', s, 'title', 'section-title' + (s.center ? ' center' : ''), { ph: 'Table title' }));
  if (s.intro || editMode) c.append(T('p', s, 'intro', 'lead', { multiline: true, ph: 'Optional intro text' }));
  const wrap = h('div', 'tbl-wrap'); const t = h('table', 't');
  const thead = h('thead'); const hr = h('tr');
  s.columns.forEach((_, ci) => { const th = h('th'); th.append(T('span', s.columns, ci, '', { ph: 'Column' }));
    if (editMode && s.columns.length > 1) th.append(miniBtn('✕', () => { s.columns.splice(ci, 1); s.rows.forEach(r => r.splice(ci, 1)); markDirty(); rerender(); }, true, true));
    hr.append(th); });
  if (editMode) hr.append(h('th', '', ''));
  thead.append(hr); t.append(thead);
  const tb = h('tbody');
  s.rows.forEach((r, ri) => {
    const tr = h('tr');
    s.columns.forEach((_, ci) => { if (r[ci] == null) r[ci] = ''; const td = h('td'); td.append(T('span', r, ci, '', { ph: '—' })); tr.append(td); });
    if (editMode) { const td = h('td'); td.style.whiteSpace = 'nowrap';
      td.append(miniBtn('▲', () => move(s.rows, ri, -1), false, true), miniBtn('▼', () => move(s.rows, ri, 1), false, true), miniBtn('✕', () => { s.rows.splice(ri, 1); markDirty(); rerender(); }, true, true)); tr.append(td); }
    tb.append(tr);
  });
  t.append(tb); wrap.append(t); c.append(wrap);
  if (s.note || editMode) c.append(T('p', s, 'note', 'note', { multiline: true, ph: 'Optional note under the table' }));
  if (editMode) {
    c.append(addBtn('+ Add row', () => { s.rows.push(s.columns.map(() => '')); markDirty(); rerender(); }));
    const ac = addBtn('+ Add column', () => { s.columns.push('New column'); s.rows.forEach(r => r.push('')); markDirty(); rerender(); }); ac.style.marginLeft = '10px'; c.append(ac);
  }
  return c;
}

/* ---- committee ---- */
function renderCommittee(s) {
  const c = h('div', 'content-card');
  c.append(T('h2', s, 'title', 'cm-title', { ph: 'Committee title' }));
  s.groups.forEach((g, gi) => {
    const grp = h('div', 'cm-group');
    const bn = h('div', 'cm-banner'); bn.append(T('span', g, 'role', '', { ph: 'Group heading' })); grp.append(bn);
    if (editMode) {
      const ctr = h('div'); ctr.style.cssText = 'text-align:center;margin-top:8px';
      ctr.append(miniBtn('▲ group', () => move(s.groups, gi, -1), false, true), miniBtn('▼ group', () => move(s.groups, gi, 1), false, true),
        miniBtn('Delete group', () => { if (confirm('Delete group "' + g.role + '"?')) { s.groups.splice(gi, 1); markDirty(); rerender(); } }, true, true));
      grp.append(ctr);
    }
    const grid = h('div', 'cm-grid' + (g.members.length === 1 ? ' n1' : ''));
    g.members.forEach((m, mi) => {
      const d = h('div', 'cm-card');
      d.append(T('div', m, 'name', 'nm', { ph: 'Name' }));
      if (m.label || editMode) d.append(T('div', m, 'label', 'rl', { ph: 'Role (e.g. Patron)' }));
      d.append(T('div', m, 'details', 'dt', { multiline: true, ph: 'Designation / affiliation' }));
      if (editMode || m.phone || m.email) {
        const ct = h('div', 'ct');
        if (editMode) {
          const a = h('span', '', '<i class="fa-solid fa-phone"></i>'); a.append(T('span', m, 'phone', '', { ph: 'Phone' }));
          const b = h('span', '', '<i class="fa-solid fa-envelope"></i>'); b.append(T('span', m, 'email', '', { ph: 'Email' })); ct.append(a, b);
        } else {
          if (m.phone) ct.append(h('span', '', '<i class="fa-solid fa-phone"></i>' + esc(m.phone)));
          if (m.email) ct.append(link('', 'mailto:' + m.email, '<i class="fa-solid fa-envelope"></i>' + esc(m.email)));
        }
        d.append(ct);
      }
      if (editMode) {
        d.append(miniBtn('✕ remove', () => { g.members.splice(mi, 1); markDirty(); rerender(); }, true));
        const mv = h('div'); mv.style.marginTop = '8px';
        mv.append(miniBtn('◀', () => move(g.members, mi, -1), false, true), miniBtn('▶', () => move(g.members, mi, 1), false, true)); d.append(mv);
      }
      grid.append(d);
    });
    grp.append(grid);
    if (editMode) { const w = h('div'); w.style.textAlign = 'center'; w.append(addBtn('+ Add person', () => { g.members.push({ label: 'Role', name: 'Name', details: '', phone: '', email: '' }); markDirty(); rerender(); })); grp.append(w); }
    c.append(grp);
  });
  if (editMode) c.append(addBtn('+ Add group', () => { s.groups.push({ role: 'New Group', members: [{ label: 'Role', name: 'Name', details: '', phone: '', email: '' }] }); markDirty(); rerender(); }));
  return c;
}

/* ---- programme ---- */
function renderProgram(s) {
  const w = h('div');
  const head = h('div', 'content-card');
  head.append(T('h2', s, 'title', 'section-title center', { ph: 'Programme title' }));
  if (s.intro || editMode) { const p = T('p', s, 'intro', 'lead', { multiline: true, ph: 'Intro text' }); p.style.textAlign = 'center'; head.append(p); }
  w.append(head);
  s.days.forEach((d, di) => {
    const day = h('div', 'pday'); day.style.marginTop = '22px';
    const hd = h('div', 'pday-h'); hd.append(T('h3', d, 'title', '', { ph: 'Day title' }), T('div', d, 'date', 'd', { ph: 'Date' })); day.append(hd);
    d.items.forEach((it, ii) => {
      const r = h('div', 'pitem'); r.append(T('span', it, 'time', 'tm', { ph: 'Time' }));
      const dv = h('div'); dv.append(T('div', it, 'title', 'ti', { ph: 'Session title' }));
      if (it.speaker || editMode) dv.append(T('div', it, 'speaker', 'sp', { ph: 'Speaker (optional)' }));
      r.append(dv);
      if (editMode) { r.append(miniBtn('✕', () => { d.items.splice(ii, 1); markDirty(); rerender(); }, true)); r.lastChild.style.top = '10px'; }
      day.append(r);
    });
    if (editMode) {
      const bar = h('div'); bar.style.padding = '10px 24px';
      bar.append(addBtn('+ Add session', () => { d.items.push({ time: '', title: 'New session', speaker: '' }); markDirty(); rerender(); }),
        miniBtn('▲ day', () => move(s.days, di, -1), false, true), miniBtn('▼ day', () => move(s.days, di, 1), false, true),
        miniBtn('Delete day', () => { if (confirm('Delete this day?')) { s.days.splice(di, 1); markDirty(); rerender(); } }, true, true));
      bar.firstChild.style.margin = '0'; day.append(bar);
    }
    w.append(day);
  });
  if (editMode) w.append(addBtn('+ Add day', () => { s.days.push({ title: 'New Day', date: 'Date', items: [{ time: '9:00 AM', title: 'Session', speaker: '' }] }); markDirty(); rerender(); }));
  return w;
}

/* ---- search ---- */
function collectText(o, out) {
  if (typeof o === 'string') out.push(stripHtml(o));
  else if (Array.isArray(o)) o.forEach(x => collectText(x, out));
  else if (o && typeof o === 'object') Object.entries(o).forEach(([k, v]) => { if (!['icon', 'image', 'btnHref', 'id', 'type', 'anchor'].includes(k)) collectText(v, out); });
}
function searchPage() {
  const q = (new URLSearchParams(location.search).get('q') || '').trim();
  const node = h('div', 'content-card'); node.append(h('h2', 'section-title', 'Search results'));
  if (!q) { node.append(h('p', '', 'Type something in the search box.')); return { virtual: true, node }; }
  const ql = q.toLowerCase(); let found = 0;
  node.append(h('p', 'lead', 'Results for “' + esc(q) + '”'));
  Object.entries(site.pages).forEach(([slug, p]) => {
    const parts = []; collectText(p, parts); const text = parts.join(' ');
    const idx = text.toLowerCase().indexOf(ql); if (idx < 0 && !String(p.title).toLowerCase().includes(ql)) return;
    found++;
    const a = Math.max(0, idx - 60), snippet = idx < 0 ? text.slice(0, 160) : text.slice(a, idx + q.length + 120);
    const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
    const r = h('div', 'result'); r.append(link('', '/' + slug, esc(p.title)));
    r.append(h('p', '', (a > 0 ? '… ' : '') + esc(snippet).replace(re, '<mark>$1</mark>') + ' …')); node.append(r);
  });
  if (!found) node.append(h('p', '', 'No results found.'));
  return { virtual: true, node, title: 'Search' };
}




/* ================= admin: modal helper ================= */
function modal(title, bodyNode, buttons, wide) {
  const ov = h('div', 'overlay'); const m = h('div', 'modal'); if (wide) m.style.maxWidth = wide;
  m.append(h('h2', '', esc(title)));
  const mb = h('div', 'mb'); mb.append(bodyNode); m.append(mb);
  const mf = h('div', 'mf');
  const close = () => ov.remove();
  buttons.forEach(([label, fn, cls]) => { const b = h('button', cls || '', esc(label)); b.type = 'button'; b.onclick = () => { if (fn) { const r = fn(close); if (r === false) return; } if (!fn || fn.length === 0) close(); }; mf.append(b); });
  m.append(mf); ov.append(m); document.body.append(ov); return { close, ov };
}
function field(label, obj, key, type, hint) {
  const l = h('label', 'fl'); l.append(document.createTextNode(label));
  let i;
  if (type === 'textarea') { i = h('textarea'); i.value = obj[key] || ''; }
  else if (type === 'check') { i = h('input'); i.type = 'checkbox'; i.checked = !!obj[key]; l.style.display = 'flex'; l.style.gap = '8px'; l.style.alignItems = 'center'; l.insertBefore(i, l.firstChild); i.addEventListener('change', () => obj[key] = i.checked); return l; }
  else { i = h('input'); i.type = type || 'text'; i.value = obj[key] || ''; }
  i.addEventListener('input', () => obj[key] = i.value); l.append(i);
  if (hint) l.append(h('small', '', esc(hint))); return l;
}

/* ---- login ---- */
function loginModal() {
  const b = h('div'); const f = h('label', 'fl', 'Admin password'); const i = h('input'); i.type = 'password'; i.autofocus = true; f.append(i);
  const e = h('div', 'err-msg'); b.append(f, e);
  const m = modal('Admin login', b, [['Cancel', null], ['Log in', c => { doLogin(c); return false; }, 'primary']]);
  const doLogin = async (close) => {
    try {
      const r = await apiCall('POST', '/api/login', { password: i.value });
      token = r.token; try { localStorage.setItem('icicse_token', token); } catch (x) {}
      isAdmin = true; editMode = true; close(); toast('Logged in — edit mode is on'); renderAll();
    } catch (x) { e.textContent = x.message; }
  };
  i.addEventListener('keydown', k => { if (k.key === 'Enter') doLogin(m.close); });
  setTimeout(() => i.focus(), 50);
}

/* ---- admin bar ---- */
let bar;
function updateBar() {
  if (!isAdmin) { if (bar) { bar.remove(); bar = null; } return; }
  if (!bar) { bar = h('div'); bar.id = 'adminbar'; document.body.append(bar); }
  bar.innerHTML = '';
  const b = (label, fn, cls, dis) => { const x = h('button', 'ab ' + (cls || ''), label); x.type = 'button'; if (dis) x.disabled = true; x.onclick = fn; bar.append(x); return x; };
  b(editMode ? '✏️ Editing: ON' : '✏️ Editing: OFF', () => { editMode = !editMode; renderAll(); }, editMode ? 'on' : '');
  b('💾 Save changes', saveSite, 'save', !dirty);
  b('↩ Discard', discard, '', !dirty);
  b('☰ Menu', menuEditor); b('🎨 Colours & fonts', themeEditor); b('⚙ Site settings', settingsEditor); b('📄 Pages', pagesEditor); b('⇅ Backup', backupModal);
  bar.append(h('span', 'sp'));
  bar.append(h('span', 'st' + (dirty ? '' : ' ok'), dirty ? 'Unsaved changes' : 'All changes saved'));
  b('Log out', () => { if (dirty && !confirm('You have unsaved changes. Log out anyway?')) return; token = null; isAdmin = false; editMode = false; dirty = false; try { localStorage.removeItem('icicse_token'); } catch (e) {} load(); });
}
async function saveSite() {
  try { await apiCall('PUT', '/api/site', site); dirty = false; updateBar(); toast('Saved — changes are live'); }
  catch (e) { toast(e.message, true); }
}
async function discard() {
  if (!confirm('Discard all unsaved changes?')) return;
  const r = await fetch('/api/site'); site = await r.json(); dirty = false; renderAll(); toast('Changes discarded');
}

/* ---- menu editor ---- */
function menuEditor() {
  const work = clone(site.menu); const body = h('div');
  const slugs = h('datalist'); slugs.id = 'slugs'; Object.keys(site.pages).forEach(s => slugs.append(h('option', '', '/' + s)));
  const draw = () => {
    body.innerHTML = ''; body.append(slugs);
    body.append(h('p', 'note', 'Edit the menu labels and where each item links. An address of <b>#</b> makes the item a dropdown heading only. Use ↳ to add sub-items.'));
    const list = (items, depth) => {
      const box = h('div', depth ? 'me-sub' : '');
      items.forEach((it, i) => {
        const row = h('div', 'me-row');
        const l = h('input'); l.type = 'text'; l.value = it.label; l.placeholder = 'Label'; l.oninput = () => it.label = l.value;
        const a = h('input'); a.type = 'text'; a.value = it.href; a.placeholder = 'Link (/page, https://… or #)'; a.setAttribute('list', 'slugs'); a.oninput = () => it.href = a.value;
        row.append(l, a);
        if (depth === 0) { const lb = h('label'); const cb = h('input'); cb.type = 'checkbox'; cb.checked = !!it.cta; cb.onchange = () => it.cta = cb.checked; lb.append(cb, 'Button'); row.append(lb); }
        const btn = (t, fn, cls) => { const x = h('button', 'b ' + (cls || ''), t); x.type = 'button'; x.onclick = fn; row.append(x); };
        btn('▲', () => { if (i > 0) { [items[i - 1], items[i]] = [items[i], items[i - 1]]; draw(); } });
        btn('▼', () => { if (i < items.length - 1) { [items[i + 1], items[i]] = [items[i], items[i + 1]]; draw(); } });
        btn('↳ sub', () => { it.children = it.children || []; it.children.push({ label: 'New item', href: '/', children: [] }); draw(); });
        btn('✕', () => { if (confirm('Remove "' + it.label + '"' + (it.children && it.children.length ? ' and its sub-items' : '') + '?')) { items.splice(i, 1); draw(); } }, 'd');
        box.append(row);
        if (it.children && it.children.length) box.append(list(it.children, depth + 1));
      });
      return box;
    };
    body.append(list(work, 0));
    const add = h('button', 'fbtn', '+ Add menu item'); add.type = 'button'; add.onclick = () => { work.push({ label: 'NEW ITEM', href: '/', children: [], cta: false }); draw(); }; body.append(add);
  };
  draw();
  modal('Edit menu', body, [['Cancel', null], ['Apply', c => { site.menu = work; markDirty(); renderNavs(); c(); toast('Menu updated — remember to Save'); return false; }, 'primary']], '980px');
}

/* ---- theme editor ---- */
function themeEditor() {
  const s = site.settings; const backup = clone({ colors: s.colors, font: s.font });
  const body = h('div');
  body.append(h('h4', '', 'Ready-made colour schemes'));
  const pr = h('div', 'presets');
  const swatchesBox = h('div', 'swatches');
  const drawSw = () => {
    swatchesBox.innerHTML = '';
    Object.entries(COLOR_LABELS).forEach(([k, lab]) => {
      const sw = h('label', 'swatch'); const i = h('input'); i.type = 'color'; i.value = colorOf(s.colors, k);
      i.oninput = () => { s.colors[k] = i.value; applyTheme(); }; sw.append(i, document.createTextNode(lab)); swatchesBox.append(sw);
    });
  };
  Object.entries(PRESETS).forEach(([name, c]) => {
    const b = h('button', 'preset', '<i style="background:' + c.primary + '"></i><i style="background:' + c.accent + '"></i>' + esc(name)); b.type = 'button';
    b.onclick = () => { s.colors = clone(c); applyTheme(); drawSw(); }; pr.append(b);
  });
  body.append(pr, h('h4', '', 'Fine-tune each colour'), swatchesBox, h('h4', '', 'Fonts'));
  const sel = h('select'); sel.style.cssText = 'padding:9px;border:1px solid #c9d1dc;border-radius:6px;font:inherit;width:100%';
  Object.entries(FONTS).forEach(([k, v]) => { const o = h('option', '', esc(v[2])); o.value = k; if (s.font === k) o.selected = true; sel.append(o); });
  sel.onchange = () => { s.font = sel.value; applyTheme(); }; body.append(sel);
  drawSw();
  modal('Colours & fonts', body, [
    ['Cancel (undo)', () => { s.colors = backup.colors; s.font = backup.font; applyTheme(); }],
    ['Apply', c => { markDirty(); c(); toast('Theme updated — remember to Save'); return false; }, 'primary']
  ]);
}

/* ---- site settings ---- */
const linesOf = (arr, keys) => (arr || []).map(o => keys.map(k => o[k] || '').join(' | ')).join('\n');
const parseLines = (txt, keys) => txt.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const p = l.split('|').map(x => x.trim()); const o = {}; keys.forEach((k, i) => o[k] = p[i] || ''); return o; });
function settingsEditor() {
  const s = site.settings; const w = clone(s); const body = h('div');
  const two = (...f) => { const d = h('div', 'two'); f.forEach(x => d.append(x)); return d; };
  body.append(h('h4', '', 'Conference details'));
  body.append(two(field('Short name (header)', w, 'shortName'), field('Mode', w, 'mode')));
  body.append(field('Full conference title', w, 'title', 'textarea'));
  body.append(two(field('Dates (displayed)', w, 'dates'), field('Countdown target', w, 'countdownTarget', 'datetime-local', 'Countdown runs to this date/time')));
  body.append(two(field('Venue', w, 'venue'), field('City / country', w, 'city')));
  body.append(two(field('Sponsor label', w, 'sponsorLabel'), field('Sponsored by', w, 'sponsoredBy')));
  body.append(two(field('Badge text', w, 'badge'), field('Contact email', w, 'contactEmail')));
  body.append(h('h4', '', 'Logo'));
  body.append(field('Logo text (used when no image)', w, 'logoText'));
  const lg = h('div'); lg.style.marginBottom = '10px';
  const up = h('button', 'fbtn', 'Upload logo image'); up.type = 'button'; up.onclick = () => pickImage(u => { w.logoImage = u; toast('Logo set — click Apply'); });
  const rm = h('button', 'fbtn', 'Remove logo image'); rm.type = 'button'; rm.style.marginLeft = '8px'; rm.onclick = () => { w.logoImage = ''; toast('Logo image removed — click Apply'); };
  lg.append(up, rm); body.append(lg);
  body.append(h('h4', '', 'Lists (one per line)'));
  const tl = { v: linesOf(w.topLinks, ['label', 'url']) }, pl = { v: linesOf(w.partners, ['name', 'url', 'image']) }, fl = { v: linesOf(w.footerLinks, ['label', 'url']) }, sl = { v: linesOf(w.socials, ['icon', 'url']) };
  body.append(field('Top bar links — Label | URL', tl, 'v', 'textarea'), field('Header partner logos — Name | URL | Image URL (optional)', pl, 'v', 'textarea'),
    field('Footer links — Label | URL', fl, 'v', 'textarea'), field('Social icons — Font Awesome class | URL', sl, 'v', 'textarea', 'e.g. fa-brands fa-linkedin-in | https://linkedin.com/…'));
  body.append(h('h4', '', 'Footer text'));
  body.append(field('Copyright line', w, 'footerText', 'textarea'), field('Footer note', w, 'footerNote', 'textarea'));
  body.append(h('h4', '', 'Welcome pop-up (home page)'));
  w.popup = w.popup || {};
  body.append(field('Show pop-up to visitors', w.popup, 'enabled', 'check'), two(field('Badge', w.popup, 'badge'), field('Title', w.popup, 'title')), field('Text', w.popup, 'text', 'textarea'),
    two(field('Deadline label', w.popup, 'deadlineLabel'), field('Deadline', w.popup, 'deadline')), two(field('Deadline note', w.popup, 'deadlineNote'), field('Button text', w.popup, 'button')));
  body.append(h('h4', '', 'Change admin password'));
  const pw = { cur: '', nw: '' };
  body.append(two(field('Current password', pw, 'cur', 'password'), field('New password (min 6)', pw, 'nw', 'password')));
  const pb = h('button', 'fbtn', 'Change password'); pb.type = 'button';
  pb.onclick = async () => { try { await apiCall('POST', '/api/password', { current: pw.cur, next: pw.nw }); toast('Password changed'); } catch (e) { toast(e.message, true); } };
  body.append(pb);
  modal('Site settings', body, [['Cancel', null], ['Apply', c => {
    w.topLinks = parseLines(tl.v, ['label', 'url']); w.partners = parseLines(pl.v, ['name', 'url', 'image']);
    w.footerLinks = parseLines(fl.v, ['label', 'url']); w.socials = parseLines(sl.v, ['icon', 'url']);
    site.settings = w; markDirty(); renderAll(); c(); toast('Settings updated — remember to Save'); return false; }, 'primary']], '860px');
}

/* ---- pages manager ---- */
function pagesEditor() {
  const body = h('div');
  const draw = () => {
    body.innerHTML = '';
    body.append(h('p', 'note', 'Each page is reachable at /<address>. The Home page cannot be removed.'));
    Object.entries(site.pages).forEach(([slug, p]) => {
      const row = h('div', 'me-row');
      const t = h('input'); t.type = 'text'; t.value = p.title; t.oninput = () => { p.title = t.value; markDirty(); };
      const a = h('input'); a.type = 'text'; a.value = slug || '(home)'; a.disabled = !slug;
      a.onchange = () => {
        const ns = a.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
        if (!ns || (site.pages[ns] && ns !== slug) || ns === 'search' || ns === 'admin') { toast('Invalid or duplicate address', true); a.value = slug; return; }
        const pages = {}; Object.entries(site.pages).forEach(([k, v]) => pages[k === slug ? ns : k] = v); site.pages = pages;
        const fix = items => items.forEach(m => { if (normHref(m.href) === '/' + slug) m.href = '/' + ns; fix(m.children || []); }); fix(site.menu);
        markDirty(); draw(); toast('Address changed (menu links updated)');
      };
      row.append(t, a);
      const v = h('button', 'b', 'Open'); v.type = 'button'; v.onclick = () => { document.querySelector('.overlay').remove(); go('/' + slug); }; row.append(v);
      if (slug) { const d = h('button', 'b d', '✕'); d.type = 'button'; d.onclick = () => { if (confirm('Delete page "' + p.title + '"? Menu links to it will stop working.')) { delete site.pages[slug]; markDirty(); draw(); } }; row.append(d); }
      body.append(row);
    });
    body.append(h('h4', '', 'Add a new page'));
    const nt = { title: '', inMenu: true }; const r = h('div', 'two');
    r.append(field('Page title', nt, 'title'), field('Add to the top menu', nt, 'inMenu', 'check'));
    const ab = h('button', 'fbtn primary', '+ Create page'); ab.type = 'button';
    ab.onclick = () => {
      if (!nt.title.trim()) return toast('Enter a page title', true);
      let slug = nt.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'page'; let k = slug, n = 2; while (site.pages[k] || k === 'search' || k === 'admin') k = slug + '-' + n++;
      site.pages[k] = { title: nt.title.trim(), sections: [{ id: uid(), type: 'richtext', title: nt.title.trim(), html: '<p>Write your content here.</p>', anchor: '' }] };
      if (nt.inMenu) site.menu.splice(Math.max(0, site.menu.length - 1), 0, { label: nt.title.trim().toUpperCase(), href: '/' + k, children: [], cta: false });
      markDirty(); renderNavs(); draw(); toast('Page created');
    };
    body.append(r, ab);
  };
  draw();
  modal('Pages', body, [['Close', () => { renderNavs(); }]], '860px');
}

/* ---- backup ---- */
function backupModal() {
  const body = h('div');
  body.append(h('p', '', 'Download a copy of all site content, or restore from a file you saved earlier. The server also keeps automatic backups in <code>data/backups</code> each time you save.'));
  const ex = h('button', 'fbtn primary', '⬇ Download backup (.json)'); ex.type = 'button';
  ex.onclick = () => { const a = h('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(site, null, 2)], { type: 'application/json' })); a.download = 'icicse-site-backup.json'; a.click(); };
  const im = h('button', 'fbtn', '⬆ Restore from file'); im.type = 'button'; im.style.marginLeft = '10px';
  im.onclick = () => { const i = h('input'); i.type = 'file'; i.accept = '.json'; i.onchange = () => { const r = new FileReader(); r.onload = () => { try { const d = JSON.parse(r.result); if (!d.settings || !d.menu || !d.pages || !d.pages['']) throw 0; site = d; markDirty(); renderAll(); toast('Backup loaded — click Save to publish'); document.querySelector('.overlay').remove(); } catch (e) { toast('That file is not a valid site backup', true); } }; r.readAsText(i.files[0]); }; i.click(); };
  const rs = h('button', 'fbtn danger', 'Reset everything to the original content'); rs.type = 'button'; rs.style.marginTop = '18px';
  rs.onclick = async () => { if (!confirm('This replaces ALL pages, menu and settings with the original content (a backup is kept on the server). Continue?')) return; try { site = await apiCall('POST', '/api/reset'); dirty = false; document.querySelector('.overlay').remove(); renderAll(); toast('Site reset to defaults'); } catch (e) { toast(e.message, true); } };
  body.append(ex, im, h('br'), rs);
  modal('Backup & restore', body, [['Close', null]]);
}

/* ================= boot ================= */
async function load() {
  try {
    const r = await fetch('/api/site'); site = await r.json();
    if (token) { try { await apiCall('GET', '/api/me'); isAdmin = true; } catch (e) { isAdmin = false; } }
    renderAll();
    if (location.hash) setTimeout(() => { const t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }, 100);
  } catch (e) { app.innerHTML = '<p style="padding:2rem;font-family:sans-serif">Could not load the site data. Is the server running?</p>'; }
}
load();
})();
