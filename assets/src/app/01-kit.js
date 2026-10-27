/* ==========================================================================
   Kit: shared helpers and building blocks for every redesigned page.
   ========================================================================== */
const C = window.BSMS_CORE;
const CFG = window.BSMS_PORTAL || {};
const PAGES = window.BSMS_PAGES = window.BSMS_PAGES || {};
const APP = window.BSMS_APP = window.BSMS_APP || {};
const esc = C.escHtml;
const $ = (q, el = document) => el.querySelector(q);
const $$ = (q, el = document) => Array.from(el.querySelectorAll(q));
const S = () => C.state() || {};
const isAdmin = () => !!C.isAdmin();
const appRoot = () => document.getElementById('bsms-app') || document.body;

/* ---- Numbers and money -------------------------------------------------- */
function naira(kobo, opts = {}) {
  const n = Number(kobo || 0);
  const abs = Math.abs(n) / 100;
  const txt = abs.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n < 0) return '−₦' + txt;
  return (opts.plus && n > 0 ? '+' : '') + '₦' + txt;
}
function nairaWhole(amount) { return '₦' + Number(amount || 0).toLocaleString('en-NG', { maximumFractionDigits: 2 }); }
function num(n) { return Number(n || 0).toLocaleString('en-NG'); }
function plural(n, one, many) { return num(n) + ' ' + (Number(n) === 1 ? one : (many || one + 's')); }
function balanceKobo() { const w = S().wallet || {}; return Number(w.sms_balance_kobo || 0); }
function canUse(feature) {
  if (isAdmin()) return true;
  const f = CFG.entitlements && CFG.entitlements.features && CFG.entitlements.features[feature];
  return f ? !!f.enabled : true;
}
function firstName() {
  const n = String(S().user || '').trim();
  return n ? n.split(/\s+/)[0] : '';
}

/* ---- Dates (server stores GMT) ----------------------------------------- */
function parseGmt(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(s)) return new Date(s.replace(' ', 'T') + 'Z');
  const d = new Date(s);
  return isNaN(d) ? null : d;
}
function fmtDate(v, withTime = true) {
  const d = parseGmt(v);
  if (!d) return v ? String(v) : '';
  const o = { day: 'numeric', month: 'short', year: 'numeric' };
  if (withTime) { o.hour = 'numeric'; o.minute = '2-digit'; o.hour12 = true; }
  return d.toLocaleString('en-GB', o);
}
function greeting() {
  const h = new Date().getHours();
  return h < 12 ? __('Good morning', 'bulk-sms-portal') : (h < 17 ? __('Good afternoon', 'bulk-sms-portal') : __('Good evening', 'bulk-sms-portal'));
}

/* ---- Icons -------------------------------------------------------------- */
const ICONS = {
  home: '<path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9v11h13V9"/><path d="M10 20v-5.5h4V20"/>',
  send: '<path d="M20.5 3.5 10 14"/><path d="M20.5 3.5 14 20.5l-4-6.5-6.5-4z"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" stroke-width="2.6"/>',
  chart: '<path d="M3.5 20.5h17"/><path d="M6.5 17v-6M11.5 17V6.5M16.5 17v-9"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.8 20c.8-3.6 3.3-5.6 6.2-5.6s5.4 2 6.2 5.6"/><path d="M15.5 4.6a3.5 3.5 0 0 1 0 6.8M17.6 14.7c1.9.8 3.1 2.6 3.6 5.3"/>',
  badge: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M7 10h6M7 14h10"/>',
  wallet: '<path d="M4 7.5V6a2 2 0 0 1 2-2h11v3.5"/><rect x="3.5" y="7.5" width="17" height="12" rx="2"/><path d="M16 13.5h1.5"/>',
  receipt: '<path d="M6 3.5h12v17l-3-1.8-3 1.8-3-1.8-3 1.8z"/><path d="M9 8.5h6M9 12.5h6"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.4 2.5 3.5 5.3 3.5 8.5s-1.1 6-3.5 8.5c-2.4-2.5-3.5-5.3-3.5-8.5s1.1-6 3.5-8.5z"/>',
  tag: '<path d="M3.5 12V4.5H11l9.5 9.5-7.5 7.5z"/><circle cx="7.7" cy="8.7" r="1.4"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.8 1.8H4.2z"/><path d="M10 20.5a2.1 2.1 0 0 0 4 0"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 20.5c1-4.4 4.1-6.8 8-6.8s7 2.4 8 6.8"/>',
  plug: '<path d="M9 3v4.5M15 3v4.5"/><path d="M6 7.5h12v3.5a6 6 0 0 1-12 0z"/><path d="M12 17v4"/>',
  help: '<circle cx="12" cy="12" r="8.8"/><path d="M9.6 9.4a2.5 2.5 0 0 1 4.9.8c0 1.7-2.5 2.1-2.5 3.6"/><path d="M12 17.2h.01" stroke-width="2.4"/>',
  shield: '<path d="M12 3.2 19.5 6v5.7c0 4.4-3.1 7.8-7.5 9.1-4.4-1.3-7.5-4.7-7.5-9.1V6z"/><path d="m9 12 2.1 2.1L15.2 10"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  checkCircle: '<circle cx="12" cy="12" r="8.8"/><path d="m8.2 12.3 2.6 2.6 5-5.2"/>',
  alert: '<path d="M12 3.5 21.5 20h-19z"/><path d="M12 10v4.5"/><path d="M12 17.3h.01" stroke-width="2.4"/>',
  info: '<circle cx="12" cy="12" r="8.8"/><path d="M12 11v5.5"/><path d="M12 7.7h.01" stroke-width="2.4"/>',
  clock: '<circle cx="12" cy="12" r="8.8"/><path d="M12 7.5V12l3 2"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  upload: '<path d="M12 15.5V4M7.5 8.5 12 4l4.5 4.5"/><path d="M4.5 15v4.5h15V15"/>',
  download: '<path d="M12 4v11.5M7.5 11 12 15.5l4.5-4.5"/><path d="M4.5 15v4.5h15V15"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12.5h9.4L17.5 7"/>',
  edit: '<path d="M4 20h4L19.5 8.5l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  phone: '<rect x="7" y="2.8" width="10" height="18.4" rx="2.4"/><path d="M11 18h2"/>',
  bank: '<path d="M3.5 9.5 12 4l8.5 5.5"/><path d="M5.5 10v7.5M10 10v7.5M14 10v7.5M18.5 10v7.5M3.5 20h17"/>',
  card: '<rect x="3" y="5.5" width="18" height="13" rx="2.2"/><path d="M3 10h18M7 15h4"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/>',
  mail: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="m3.5 7 8.5 6.5L20.5 7"/>',
  chat: '<path d="M4 18.5 5.3 15A7.6 7.6 0 1 1 9 18.3z"/>',
  key: '<circle cx="8" cy="15" r="4.5"/><path d="m11.2 11.8 8.3-8.3M16.5 6.5l2.5 2.5M14 9l2 2"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.9 1.9M16.6 16.6l1.9 1.9M5.5 18.5l1.9-1.9M16.6 7.4l1.9-1.9"/>',
  pulse: '<path d="M3 12h4l2.2-6 4.3 12 2.2-6H21"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'
};
function icon(name, size = 20, sw = 1.7) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name] || ICONS.info}</svg>`;
}

/* ---- Building blocks (return HTML strings) ------------------------------ */
function pageHead(title, lede, actions = '') {
  return `<header class="bx-head"><div class="bx-head-text"><h1>${esc(title)}</h1>${lede ? `<p class="bx-lede">${lede}</p>` : ''}</div>${actions ? `<div class="bx-head-actions">${actions}</div>` : ''}</header>`;
}
function btn(label, attrs = '', cls = '') { return `<button type="button" class="bx-btn ${cls}" ${attrs}>${label}</button>`; }
function pill(tone, label) { return `<span class="bx-pill is-${esc(tone)}">${esc(label)}</span>`; }
function note(tone, title, text = '', actions = '') {
  const ic = { good: 'checkCircle', bad: 'alert', wait: 'clock', info: 'info' }[tone] || 'info';
  return `<div class="bx-note is-${esc(tone)}" role="${tone === 'bad' ? 'alert' : 'status'}">${icon(ic)}<div>${title ? `<strong>${esc(title)}</strong>` : ''}${text ? `<p>${text}</p>` : ''}</div>${actions ? `<div class="bx-row-flex">${actions}</div>` : ''}</div>`;
}
function empty(ic, title, text, action = '') {
  return `<div class="bx-empty">${icon(ic, 28)}<strong>${esc(title)}</strong>${text ? `<p>${esc(text)}</p>` : ''}${action}</div>`;
}
function loading(text = __('Loading…', 'bulk-sms-portal')) { return `<div class="bx-loading" role="status">${esc(text)}</div>`; }
function skeleton(lines = 4) {
  let out = '';
  for (let i = 0; i < lines; i++) out += `<span class="bx-skel" style="--w:${[92, 74, 86, 60, 80][i % 5]}%"></span>`;
  return `<div class="bx-skel-group" aria-hidden="true">${out}</div>`;
}
function pageSkeleton(title) {
  return `<div class="bx bx-page" aria-busy="true">${pageHead(title || __('Loading', 'bulk-sms-portal'), '')}<div class="bx-panel">${skeleton(5)}</div></div>`;
}
function stat(label, value, opts = {}) {
  const tag = opts.filter !== undefined ? 'button' : 'div';
  const attrs = opts.filter !== undefined ? ` type="button" data-bx-filter-value="${esc(opts.filter)}" aria-pressed="${opts.active ? 'true' : 'false'}"` : '';
  return `<${tag} class="bx-stat${opts.tone ? ' is-' + esc(opts.tone) : ''}"${attrs}><span class="bx-stat-label">${esc(label)}</span><span class="bx-stat-value">${esc(value)}</span>${opts.note ? `<span class="bx-stat-note">${esc(opts.note)}</span>` : ''}</${tag}>`;
}
function bar(parts) {
  const total = Math.max(1, parts.reduce((n, p) => n + Math.max(0, Number(p.value) || 0), 0));
  return `<span class="bx-bar" role="img" aria-label="${esc(parts.map(p => p.value + ' ' + p.label).join(', '))}">${parts.map(p => `<i class="is-${p.tone}" style="--w:${(100 * Math.max(0, Number(p.value) || 0) / total).toFixed(2)}%"></i>`).join('')}</span>`;
}
/* v3.7.1 pagination: numbered pages (1 … 4 5 6 … 30) with Previous/Next.
   On a phone the numbers give way to "Page 4 of 30". */
function pageNumbers(page, pages) {
  const want = new Set([1, pages, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach(n => want.add(n));
  if (page >= pages - 2) [pages - 1, pages - 2, pages - 3].forEach(n => want.add(n));
  const nums = [...want].filter(n => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out = [];
  nums.forEach((n, i) => { if (i && n - nums[i - 1] > 1) out.push(n - nums[i - 1] === 2 ? n - 1 : 0); out.push(n); });
  return out; // 0 = gap
}
function pager(meta) {
  const pages = Math.max(1, Number(meta.total_pages) || 1);
  const page = Math.min(pages, Math.max(1, Number(meta.page) || 1));
  const total = Number(meta.total || 0), per = Math.max(1, Number(meta.per_page) || 20);
  if (pages <= 1) return '';
  const from = total ? Math.min(total, (page - 1) * per + 1) : 0, to = Math.min(total, page * per);
  const nums = pageNumbers(page, pages).map(n => n
    ? `<button type="button" class="bx-pager-num" data-bx-goto="${n}" ${n === page ? 'aria-current="page"' : ''} aria-label="${sprintf(/* translators: %s: a value filled in when shown */ esc(__('Page %s', 'bulk-sms-portal')), n)}">${num(n)}</button>`
    : '<span class="bx-pager-gap" aria-hidden="true">…</span>').join('');
  return `<nav class="bx-pager" aria-label="${esc(__('Pages', 'bulk-sms-portal'))}"><span class="bx-pager-count">${sprintf(/* translators: %1$s, %2$s, %3$s: values filled in when shown */ __('Showing %1$s to %2$s of %3$s', 'bulk-sms-portal'), num(from), num(to), num(total))}</span>
    <span class="bx-pager-buttons">${btn(__('Previous', 'bulk-sms-portal'), `data-bx-goto="${page - 1}" aria-label="${esc(__('Previous page', 'bulk-sms-portal'))}" ${page <= 1 ? 'disabled' : ''}`, 'is-small')}<span class="bx-pager-nums">${nums}</span><span class="bx-pager-of">${sprintf(/* translators: %1$s, %2$s: values filled in when shown */ __('Page %1$s of %2$s', 'bulk-sms-portal'), num(page), num(pages))}</span>${btn(__('Next', 'bulk-sms-portal'), `data-bx-goto="${page + 1}" aria-label="${esc(__('Next page', 'bulk-sms-portal'))}" ${page >= pages ? 'disabled' : ''}`, 'is-small')}</span></nav>`;
}
/* Going to another page brings the top of the list back into view. */
function bindPager(root, cb) {
  $$('[data-bx-goto]', root).forEach(b => b.onclick = () => {
    if (b.disabled || b.getAttribute('aria-current') === 'page') return;
    const anchor = b.closest('.bx-list') || root;
    const box = anchor.parentElement || anchor;
    const bring = () => {
      const el = box.isConnected ? box : root;
      if (!el.isConnected) return;
      const top = el.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * 0.6) window.scrollTo({ top: Math.max(0, window.scrollY + top - 96), behavior: 'auto' });
    };
    // Wait for the new page to be drawn, then bring its top into view.
    Promise.resolve(cb(Number(b.dataset.bxGoto))).then(() => requestAnimationFrame(bring), () => {});
  });
}
/* Paging for a list already loaded in full: returns this page's items and
   the numbers pager() needs. */
function pageSlice(all, pg, per = 20) {
  const total = all.length, pages = Math.max(1, Math.ceil(total / per)), page = Math.min(pages, Math.max(1, Number(pg) || 1));
  return { items: all.slice((page - 1) * per, page * per), meta: { page, per_page: per, total, total_pages: pages } };
}
function pageBack(r, pg, fn) {
  if (r && r.ok !== false && Array.isArray(r.items) && !r.items.length && pg > 1 && Number(r.total) > 0) {
    fn(Math.max(1, Math.min(pg - 1, Number(r.total_pages) || 1)));
    return true;
  }
  return false;
}

/* Friendly wording for request problems. Never show a raw technical reply. */
function friendly(r, fallback = 'Something went wrong. Please try again.') {
  const raw = String((r && (r.error || r.message)) || '').trim();
  if (!raw) return fallback;
  const low = raw.toLowerCase();
  if (low.includes('timed out')) return __('This is taking longer than usual. Check your internet connection and try again.', 'bulk-sms-portal');
  if (low.includes('invalid server response') || low.includes('request failed') || low.includes('network error') || low.includes('failed to fetch')) return __('We could not reach the server. Check your internet connection and try again.', 'bulk-sms-portal');
  if (low.includes('nonce') || low.includes('cookie') || low.includes('security token')) return __('Your session has ended. Refresh the page and sign in again.', 'bulk-sms-portal');
  if (/rest_|wp_error|sql|exception|stack|undefined index|critical error|<[a-z][^>]*>/i.test(raw)) return fallback === 'Something went wrong. Please try again.' ? __('Something went wrong on our side. Please try again, and contact support if it keeps happening.', 'bulk-sms-portal') : fallback;
  return raw;
}

/* ---- Feedback ----------------------------------------------------------- */
let toastTimer = null;
function toast(message, tone = '') {
  let t = $('.bx-toast');
  if (t) t.remove();
  t = document.createElement('div');
  t.className = 'bx bx-toast' + (tone ? ' is-' + tone : '');
  t.setAttribute('role', 'status');
  t.textContent = message;
  appRoot().appendChild(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { if (t) t.remove(); }, 4200);
}
/* Confirmation box. Resolves true when the main button is pressed. */
function confirmBox({ title, body = '', confirm = __('Continue', 'bulk-sms-portal'), cancel = __('Cancel', 'bulk-sms-portal'), danger = false }) {
  return new Promise(resolve => {
    const d = document.createElement('dialog');
    d.className = 'bx bx-dialog';
    d.setAttribute('aria-labelledby', 'bx-dialog-title');
    d.innerHTML = `<form method="dialog"><div class="bx-dialog-body"><h2 id="bx-dialog-title">${esc(title)}</h2>${body}</div><div class="bx-dialog-actions"><button class="bx-btn" value="cancel">${esc(cancel)}</button><button class="bx-btn ${danger ? 'is-danger' : 'is-primary'}" value="ok">${esc(confirm)}</button></div></form>`;
    appRoot().appendChild(d);
    d.addEventListener('close', () => { const ok = d.returnValue === 'ok'; d.remove(); resolve(ok); });
    if (typeof d.showModal === 'function') d.showModal(); else { d.setAttribute('open', ''); }
    const okBtn = $('button[value="ok"]', d); if (okBtn) okBtn.focus();
  });
}
/* A dialog with custom content. onOpen(d) wires it up; call d.close() to finish. */
function openDialog(html, onOpen) {
  const d = document.createElement('dialog');
  d.className = 'bx bx-dialog';
  d.innerHTML = html;
  appRoot().appendChild(d);
  d.addEventListener('close', () => d.remove());
  if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
  if (onOpen) onOpen(d);
  return d;
}
function busy(button, label) {
  if (!button) return () => {};
  const html = button.innerHTML, was = button.disabled;
  button.disabled = true;
  button.innerHTML = `<span class="bx-spin" aria-hidden="true"></span>${esc(label || __('Please wait…', 'bulk-sms-portal'))}`;
  return () => { button.disabled = was; button.innerHTML = html; };
}
async function copyText(text, button) {
  let ok = false;
  try { await navigator.clipboard.writeText(String(text || '')); ok = true; } catch (e) {
    try { const ta = document.createElement('textarea'); ta.value = String(text || ''); document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove(); } catch (e2) {}
  }
  if (button) { const old = button.innerHTML; button.innerHTML = ok ? icon('check', 18) + __('Copied', 'bulk-sms-portal') : __('Select and copy', 'bulk-sms-portal'); setTimeout(() => { button.innerHTML = old; }, 1600); }
  return ok;
}
function bindCopy(root) { $$('[data-bx-copy]', root).forEach(b => b.onclick = () => copyText(b.dataset.bxCopy, b)); }
/* In WordPress admin (embedded mode) each page is its own admin screen, so
   moving to another page loads that screen's address instead. */
const EMBEDDED = !!CFG.embedded;
const pageUrl = p => (CFG.pageUrls && CFG.pageUrls[p]) || '';
function go(page) {
  if (document.getElementById('bsms-page-' + page)) { C.show(page, true); return; }
  if (pageUrl(page)) { location.href = pageUrl(page); return; }
  C.show(page, true);
}
/* True when this account can open the page. */
function hasPage(p) { return !!document.getElementById('bsms-page-' + p) || !!pageUrl(p); }
/* An admin shortcut button, shown only when the admin page is available. */
function adminBtn(label, p, ic = 'shield') { return isAdmin() && hasPage(p) ? btn(icon(ic, 18) + esc(label), `data-bx-go="${p}"`) : ''; }
function bindGo(root) {
  $$('[data-bx-go]', root).forEach(b => {
    // A shortcut to a page this account cannot open is removed, so it can
    // never land somewhere unexpected.
    if (!hasPage(b.dataset.bxGo)) { b.remove(); return; }
    b.onclick = (e) => { e.preventDefault(); go(b.dataset.bxGo); };
  });
}

/* Safe storage for small conveniences (drafts). */
const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} }
};

/* Download text as a file. */
function downloadFile(filename, text, type = 'text/csv;charset=utf-8;') {
  const blob = new Blob(['﻿' + String(text || '')], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename || 'download.csv';
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
}

/* ---- Prices -------------------------------------------------------------
   v3.6.2 rule (same as the server, BSMS_Pricing::quote_number): a number is
   charged the price of the longest matching prefix in the price list (a
   special prefix price, then its network's price), otherwise its country's
   price. No quantity bands. A country without a price is not sent.
   ------------------------------------------------------------------------- */
let pricesPromise = null;
function prices(force = false) {
  if (!pricesPromise || force) pricesPromise = C.api('/pricing').then(r => (r && r.ok) ? r : { list: [] }).catch(() => ({ list: [] }));
  return pricesPromise;
}
const MAIN_NETWORKS = ['MTN', __('Airtel', 'bulk-sms-portal'), __('Glo', 'bulk-sms-portal'), '9mobile'];
/* Digits of a typed phone number in full international form (Nigeria default). */
function phoneDigits(raw) {
  let d = String(raw || '').replace(/\D+/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (/^0[789][01]\d{8}$/.test(d)) return '234' + d.slice(1);
  if (/^[789][01]\d{8}$/.test(d)) return '234' + d;
  return d;
}
/* How a prefix is shown: 0803 for Nigeria, +233 24 elsewhere. */
function prefixLabel(cc, full) {
  cc = String(cc); full = String(full);
  const local = full.startsWith(cc) ? full.slice(cc.length) : full;
  return cc === '234' ? '0' + local : `+${cc} ${local}`;
}
function quoteFrom(list, raw, dnd = false) {
  const d = phoneDigits(raw);
  if (d.length < 7) return null;
  const codes = list.map(c => String(c.code)).sort((a, b) => b.length - a.length);
  const cc = d.startsWith('234') ? '234' : codes.find(c => d.startsWith(c));
  const c = cc && list.find(x => String(x.code) === cc);
  if (!c) return { price: null, country: null, reason: 'no_country_price' };
  const key = (dnd && cc === '234') ? 'dnd_kobo' : 'standard_kobo';
  let best = null;
  [...(c.networks || []).map(e => ({ ...e, kind: 'network' })), ...(c.prefixes || []).map(e => ({ ...e, kind: 'prefix' }))].forEach(e => {
    if (!Number(e[key])) return;
    (e.prefixes || []).forEach(p => {
      if (!d.startsWith(String(p))) return;
      const rank = [String(p).length, -(e.prefixes || []).length];
      if (!best || rank[0] > best.rank[0] || (rank[0] === best.rank[0] && rank[1] > best.rank[1])) best = { rank, e, p };
    });
  });
  if (best) return { price: Number(best.e[key]), country: c, network: best.e.kind === 'network' ? best.e.name : '', prefix: best.p, special: best.e.kind === 'prefix' };
  if (Number(c[key])) return { price: Number(c[key]), country: c, network: '' };
  return { price: null, country: c, reason: key === 'dnd_kobo' ? 'no_dnd_price' : 'no_country_price' };
}
/* What Nigerian numbers cost. top = the highest price any Nigerian number
   can be charged, so "about N SMS" is never more than a customer can send. */
function priceModel(p, dnd = false) {
  const list = (p && Array.isArray(p.list)) ? p.list : [];
  const key = dnd ? 'dnd_kobo' : 'standard_kobo';
  const ng = list.find(c => String(c.code) === '234') || { networks: [], prefixes: [] };
  const base = Number(ng[key] || 0);
  const nets = (ng.networks || []).filter(n => Number(n[key])).map(n => ({ name: n.name, kobo: Number(n[key]) }));
  const specials = (ng.prefixes || []).filter(n => Number(n[key])).map(n => ({ prefix: n.prefixes[0], kobo: Number(n[key]) }));
  const top = Math.max(0, base, ...nets.map(n => n.kobo), ...specials.map(n => n.kobo));
  return { list, ng, base, nets, specials, top, intlReady: !!(p && p.international_ready), charge: () => top, quote: (raw) => quoteFrom(list, raw, dnd) };
}
function aboutFor(m, kobo) {
  if (!m || !m.top) return null;
  return { count: Math.floor(Math.max(0, kobo) / m.top), charge: m.top };
}
async function aboutMessages(kobo) { return aboutFor(priceModel(await prices()), kobo); }

/* ---- Page registration -------------------------------------------------- */
const RUN = new WeakMap();
/* Registers a redesigned page. The render function gets (host, ctx) where
   ctx.live() is false once a newer render of the same page has started. */
function page(name, title, render) {
  PAGES[name] = function (host) {
    if (!host) return;
    const token = (RUN.get(host) || 0) + 1;
    RUN.set(host, token);
    const ctx = { live: () => RUN.get(host) === token, title };
    if (!C.loaded() && !C.error()) { host.innerHTML = pageSkeleton(title); return; }
    return render(host, ctx);
  };
}
function mount(host, inner) { host.innerHTML = `<div class="bx bx-page">${inner}</div>`; return host.firstElementChild; }
