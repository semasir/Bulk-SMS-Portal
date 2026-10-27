/* Bulk SMS Portal redesigned pages (v3.5.0). Generated from assets/src/app/*.js by tools/build-ui.php. Do not edit by hand. */
(function(){
'use strict';
if(!window.BSMS_CORE||!document.getElementById('bsms-app'))return;
const { __, _n, sprintf } = (window.wp && window.wp.i18n) || { __: s => s, _n: (one, many, n) => (n === 1 ? one : many), sprintf: (f, ...a) => { let i = 0; return String(f).replace(/%%|%(\d+)\$[sd]|%[sd]/g, (m, p) => m === '%%' ? '%' : String(p ? a[p - 1] : a[i++])); } };

/* ---- 01-kit.js ---- */
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


/* ---- 02-shell.js ---- */
/* ==========================================================================
   Portal frame: menu, top bar, phone menu bar, balance, notices.
   ========================================================================== */
const PAGE_NAMES = {
  dashboard: __('Dashboard', 'bulk-sms-portal'), compose: __('Send SMS', 'bulk-sms-portal'), history: __('Message History', 'bulk-sms-portal'), reports: __('Delivery Reports', 'bulk-sms-portal'), groups: __('Phonebook', 'bulk-sms-portal'),
  sender: __('Sender ID', 'bulk-sms-portal'), fund: __('Buy SMS', 'bulk-sms-portal'), transactions: __('Wallet History', 'bulk-sms-portal'), pricing: __('Pricing', 'bulk-sms-portal'), settings: __('Notifications', 'bulk-sms-portal'),
  profile: __('Profile & Security', 'bulk-sms-portal'), api: 'API', help: __('Help Centre', 'bulk-sms-portal'),
  'admin-setup': __('Setup Guide', 'bulk-sms-portal'), 'admin-activity': __('Activity Log', 'bulk-sms-portal')
};
const SECTIONS = {
  dashboard: __('Home', 'bulk-sms-portal'), compose: __('Messages', 'bulk-sms-portal'), history: __('Messages', 'bulk-sms-portal'), reports: __('Messages', 'bulk-sms-portal'), groups: __('Messages', 'bulk-sms-portal'), sender: __('Messages', 'bulk-sms-portal'),
  fund: __('Money', 'bulk-sms-portal'), transactions: __('Money', 'bulk-sms-portal'), pricing: __('Money', 'bulk-sms-portal'), settings: __('Account', 'bulk-sms-portal'), profile: __('Account', 'bulk-sms-portal'), api: __('Account', 'bulk-sms-portal'), help: __('Account', 'bulk-sms-portal')
};
function pageName(p) {
  const btnEl = $(`.bx-rail .bx-nav-item[data-page="${CSS.escape(p)}"] span`);
  return (btnEl && btnEl.textContent.trim()) || PAGE_NAMES[p] || String(p || '').replace(/^custom-|^admin-/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, m => m.toUpperCase());
}

function shellInit() {
  const app = document.getElementById('bsms-app');
  if (!app || !app.classList.contains('bx-app')) return;
  const openers = $$('[data-bx-open-nav]', app);
  const setNav = (open) => {
    app.classList.toggle('is-nav-open', open);
    openers.forEach(b => b.setAttribute('aria-expanded', open ? 'true' : 'false'));
    if (open) { const first = $('.bx-rail .bx-nav-item', app); if (first) first.focus({ preventScroll: true }); }
  };
  openers.forEach(b => b.addEventListener('click', () => setNav(!app.classList.contains('is-nav-open'))));
  $$('[data-bx-close-nav]', app).forEach(b => b.addEventListener('click', () => setNav(false)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && app.classList.contains('is-nav-open')) setNav(false); });

  // Every frame button with data-page opens that page.
  app.addEventListener('click', e => {
    const b = e.target.closest('.bx-rail [data-page], .bx-top [data-page], .bx-dock [data-page]');
    if (!b) return;
    e.preventDefault();
    setNav(false);
    if (b.dataset.page === 'groups' && typeof book !== 'undefined') book.open = null;
    C.show(b.dataset.page, true);
  });
  $$('[data-bx-home]', app).forEach(a => a.addEventListener('click', e => { e.preventDefault(); setNav(false); C.show('dashboard', true); }));

  document.addEventListener('bsms:page', e => markPage(e.detail && e.detail.page));
  document.addEventListener('bsms:state', () => paintBalance());
  renderNotices();
}

function markPage(p) {
  if (!p) return;
  $$('.bx-rail .bx-nav-item[data-page], .bx-dock [data-page]').forEach(b => {
    if (b.dataset.page === p) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  // No need for a shortcut to the page you are already on.
  $$('.bx-top-actions [data-page]').forEach(b => { b.hidden = b.dataset.page === p && !b.classList.contains('bx-top-balance'); });
  const cur = $(`.bx-rail .bx-nav-item[aria-current="page"]`);
  if (cur && cur.scrollIntoView) { try { cur.scrollIntoView({ block: 'nearest' }); } catch (e) {} }
  const name = pageName(p);
  const sec = SECTIONS[p] || (String(p).indexOf('admin-') === 0 ? __('Platform admin', 'bulk-sms-portal') : __('More', 'bulk-sms-portal'));
  const sEl = $('[data-bx-crumb-section]'), pEl = $('[data-bx-crumb-page]');
  if (sEl) sEl.textContent = sec;
  if (pEl) pEl.textContent = name;
  if (EMBEDDED) return;
  const brand = CFG.brand || '';
  try { document.title = name + (brand ? ' – ' + brand : ''); } catch (e) {}
  window.scrollTo({ top: 0, behavior: 'auto' });
}

async function paintBalance() {
  const k = balanceKobo();
  $$('[data-bx-balance]').forEach(el => { el.textContent = naira(k); });
  const noteEl = $('[data-bx-balance-note]');
  if (!noteEl) return;
  const about = await aboutMessages(k);
  noteEl.textContent = about ? (about.count > 0 ? `${sprintf(/* translators: %s: a value filled in when shown */ __('About %s to Nigerian numbers', 'bulk-sms-portal'), sprintf(/* translators: %s: a number */ _n('%s SMS', '%s SMS', Number(about.count), 'bulk-sms-portal'), num(about.count)))}` : __('Add money to start sending', 'bulk-sms-portal')) : __('Money you can spend on SMS', 'bulk-sms-portal');
}

function renderNotices() {
  const wrap = document.getElementById('bx-notices');
  if (!wrap) return;
  const list = Array.isArray(CFG.announcements) ? CFG.announcements : [];
  wrap.innerHTML = list.map((n, i) => {
    const type = String(n.type || '').toLowerCase(), pr = String(n.priority || '').toLowerCase();
    const tone = (pr === 'critical' || type === 'warning') ? 'wait' : (type === 'promotion' ? 'good' : 'info');
    return `<article class="bx-notice is-${tone}" data-bx-notice="${i}">${icon(tone === 'wait' ? 'alert' : (tone === 'good' ? 'checkCircle' : 'bell'))}<div><strong>${esc(n.title || __('Notice', 'bulk-sms-portal'))}</strong>${n.message ? `<p>${esc(n.message)}</p>` : ''}</div><button type="button" class="bx-notice-close" aria-label="${esc(__('Dismiss notice', 'bulk-sms-portal'))}">${icon('x', 18)}</button></article>`;
  }).join('');
  $$('.bx-notice-close', wrap).forEach(b => b.onclick = () => {
    const a = b.closest('.bx-notice'); if (!a) return;
    const n = list[Number(a.dataset.bxNotice)];
    a.remove();
    if (n && n.id) C.api('/notices/dismiss', { method: 'POST', body: JSON.stringify({ id: n.id }) });
  });
}


/* ---- 10-dashboard.js ---- */
/* ==========================================================================
   Dashboard
   ========================================================================== */
page('dashboard', 'Dashboard', async (host, ctx) => {
  const st = S();
  const bal = balanceKobo();
  const senders = Array.isArray(st.approved_senders) ? st.approved_senders : [];
  const dm = st.delivery_metrics || {};
  const sentTotal = Number(dm.total || st.sent || 0);
  const name = firstName();
  const canSend = canUse('compose_sms');
  const canBuy = canUse('buy_sms');

  const steps = [
    { done: bal > 0, title: __('Add money to your wallet', 'bulk-sms-portal'), text: __('Pay online or by bank transfer.', 'bulk-sms-portal'), go: 'fund', action: __('Buy SMS', 'bulk-sms-portal'), show: canBuy },
    { done: senders.length > 0, title: __('Get your sender name approved', 'bulk-sms-portal'), text: __('The name people see when you text them.', 'bulk-sms-portal'), go: 'sender', action: __('Ask for a name', 'bulk-sms-portal'), show: canUse('sender_ids') },
    { done: sentTotal > 0, title: __('Send your first message', 'bulk-sms-portal'), text: __('Try one number first to see how it looks.', 'bulk-sms-portal'), go: 'compose', action: __('Send SMS', 'bulk-sms-portal'), show: canSend }
  ].filter(s => s.show);
  const setupLeft = steps.filter(s => !s.done).length;

  const root = mount(host, `
    ${pageHead(name ? `${greeting()}, ${name}` : greeting(), isAdmin() ? __('Your own account is below. Message History, Delivery Reports and Wallet History show every customer.', 'bulk-sms-portal') : __('Here is your account at a glance.', 'bulk-sms-portal'), adminBtn(__('Admin dashboard', 'bulk-sms-portal'), 'admin-dashboard'))}
    <section class="bx-balance" aria-label="${esc(__('Wallet', 'bulk-sms-portal'))}">
      <div>
        <span class="bx-balance-label">${__('Wallet balance', 'bulk-sms-portal')}</span>
        <span class="bx-balance-amount">${esc(naira(bal))}</span>
        <span class="bx-balance-note" data-bx-about>&nbsp;</span>
      </div>
      <div class="bx-row-flex">
        ${canSend ? btn(icon('send', 18) + __('Send SMS', 'bulk-sms-portal'), 'data-bx-go="compose"', 'is-primary is-large') : ''}
        ${canBuy ? btn(__('Buy SMS', 'bulk-sms-portal'), 'data-bx-go="fund"', 'is-large') : ''}
      </div>
    </section>
    ${setupLeft ? `<section class="bx-section"><div class="bx-panel">
      <div class="bx-panel-head"><div><h2>${__('Get ready to send', 'bulk-sms-portal')}</h2><p>${setupLeft === 1 ? __('One thing left to do.', 'bulk-sms-portal') : `${sprintf(/* translators: %s: a value filled in when shown */ __('%s things left to do.', 'bulk-sms-portal'), setupLeft)}`}</p></div></div>
      <ol class="bx-checklist">${steps.map(s => `<li class="${s.done ? 'is-done' : ''}"><span class="bx-tick">${icon('check', 16, 2.4)}</span><div><span class="bx-check-title">${esc(s.title)}</span><p class="bx-small bx-muted">${esc(s.text)}</p></div>${s.done ? `<span class="bx-small bx-muted">${__('Done', 'bulk-sms-portal')}</span>` : btn(esc(s.action), `data-bx-go="${s.go}"`, 'is-small')}</li>`).join('')}</ol>
    </div></section>` : ''}
    <section class="bx-section">
      <div class="bx-section-head"><h2>${__('Your messages so far', 'bulk-sms-portal')}</h2></div>
      <div class="bx-stats" data-bx-dash-stats>
        ${stat(__('Messages sent', 'bulk-sms-portal'), num(sentTotal))}
        ${stat(__('Successful', 'bulk-sms-portal'), num(dm.successful ?? dm.delivered ?? 0), { tone: 'good' })}
        ${stat(__('Failed', 'bulk-sms-portal'), num(dm.failed || 0), { tone: Number(dm.failed) ? 'bad' : '', note: Number(dm.failed) ? __('Their charges were returned', 'bulk-sms-portal') : '' })}
        ${stat(__('Sender names ready', 'bulk-sms-portal'), num(senders.length), { note: senders.length ? senders.slice(0, 2).join(', ') + (senders.length > 2 ? '…' : '') : __('None yet', 'bulk-sms-portal') })}
      </div>
    </section>
    <div class="bx-section bx-split">
      <section class="bx-panel is-flush" aria-labelledby="bx-dash-sends">
        <div class="bx-panel-head"><div><h2 id="bx-dash-sends">${__('Recent sends', 'bulk-sms-portal')}</h2><p>${__('Each time you send, with how many were successful.', 'bulk-sms-portal')}</p></div>${btn(__('See all', 'bulk-sms-portal'), 'data-bx-go="reports"', 'is-quiet is-small')}</div>
        <div data-bx-sends>${skeleton(4)}</div>
      </section>
      <section class="bx-panel is-flush" aria-labelledby="bx-dash-money">
        <div class="bx-panel-head"><div><h2 id="bx-dash-money">${__('Recent money', 'bulk-sms-portal')}</h2><p>${__('Money in and out of your wallet.', 'bulk-sms-portal')}</p></div>${btn(__('See all', 'bulk-sms-portal'), 'data-bx-go="transactions"', 'is-quiet is-small')}</div>
        <div data-bx-money>${skeleton(3)}</div>
      </section>
    </div>`);
  bindGo(root);

  aboutMessages(bal).then(a => {
    const el = $('[data-bx-about]', root); if (!el) return;
    el.textContent = a ? (a.count > 0 ? `${sprintf(/* translators: %1$s, %2$s: values filled in when shown */ __('Enough for about %1$s to Nigerian numbers, at %2$s each.', 'bulk-sms-portal'), sprintf(/* translators: %s: a number */ _n('%s one-page SMS', '%s one-page SMS', Number(a.count), 'bulk-sms-portal'), num(a.count)), naira(a.charge))}` : __('Add money to start sending.', 'bulk-sms-portal')) : '';
  });

  const own = isAdmin() && CFG.userId ? '&customer=' + encodeURIComponent(CFG.userId) : '';
  const [rep, wal] = await Promise.all([
    C.api('/records/reports?page=1&per_page=5' + own),
    C.api('/records/wallet?page=1&per_page=5' + own)
  ]);
  if (!ctx.live()) return;
  const sendsEl = $('[data-bx-sends]', root), moneyEl = $('[data-bx-money]', root);
  // Use the same totals as Delivery Reports so both pages always agree.
  if (rep && rep.ok && rep.summary) {
    const sm = rep.summary;
    $('[data-bx-dash-stats]', root).innerHTML = stat(__('Messages sent', 'bulk-sms-portal'), num(sm.messages), { note: Number(sm.sending) ? `${sprintf(/* translators: %s: a value filled in when shown */ __('%s still sending', 'bulk-sms-portal'), num(sm.sending))}` : '' })
      + stat(__('Successful', 'bulk-sms-portal'), num(sm.successful || 0), { tone: 'good' })
      + stat(__('Failed', 'bulk-sms-portal'), num(sm.failed), { tone: Number(sm.failed) ? 'bad' : '', note: Number(sm.failed) ? __('Their charges were returned', 'bulk-sms-portal') : '' })
      + stat(__('Sender names ready', 'bulk-sms-portal'), num(senders.length), { note: senders.length ? senders.slice(0, 2).join(', ') + (senders.length > 2 ? '…' : '') : __('None yet', 'bulk-sms-portal') });
  }
  const items = (rep && rep.ok && rep.items) || [];
  sendsEl.innerHTML = !rep || !rep.ok ? `<div class="bx-empty"><p>${esc(friendly(rep, __('We could not load your recent sends.', 'bulk-sms-portal')))}</p></div>`
    : !items.length ? empty('send', __('No messages yet', 'bulk-sms-portal'), __('When you send SMS, each send shows here with its results.', 'bulk-sms-portal'), canSend ? btn(__('Send SMS', 'bulk-sms-portal'), 'data-bx-go="compose"', 'is-primary') : '')
    : `<div class="bx-rows">${items.map(x => `<button type="button" class="bx-line-item is-send" data-bx-report="${esc(x.id)}">
        <div class="bx-td-main"><strong>${esc(x.name || __('Send', 'bulk-sms-portal'))}</strong><small>${esc(x.date || '')}${x.sender ? __(', from ', 'bulk-sms-portal') + esc(x.sender) : ''}</small></div>
        <div class="bx-td-main bx-td-bar">${bar([{ label: 'successful', value: x.successful, tone: 'good' }, { label: 'failed', value: x.failed, tone: 'bad' }, { label: 'sending', value: x.sending, tone: 'wait' }])}<small>${sprintf(/* translators: %1$s, %2$s, %3$s: values filled in when shown */ __('%1$s of %2$s successful%3$s', 'bulk-sms-portal'), num(x.successful), sprintf(/* translators: %s: a number */ _n('%s message', '%s messages', Number(x.messages), 'bulk-sms-portal'), num(x.messages)), x.failed ? `${sprintf(/* translators: %s: a value filled in when shown */ __(', %s failed', 'bulk-sms-portal'), num(x.failed))}` : '')}</small></div>
        <strong class="bx-num">${esc(naira(x.cost_kobo))}</strong></button>`).join('')}</div>`;
  $$('[data-bx-report]', sendsEl).forEach(b => b.onclick = () => APP.openReport(b.dataset.bxReport));
  bindGo(sendsEl);
  const wItems = (wal && wal.ok && wal.items) || [];
  moneyEl.innerHTML = !wal || !wal.ok ? `<div class="bx-empty"><p>${esc(friendly(wal, __('We could not load your wallet activity.', 'bulk-sms-portal')))}</p></div>`
    : !wItems.length ? empty('wallet', __('No money activity yet', 'bulk-sms-portal'), __('Payments and SMS charges will show here.', 'bulk-sms-portal'))
    : `<div class="bx-rows">${wItems.map(x => `<div class="bx-line-item"><div class="bx-td-main"><strong>${esc(x.title)}</strong><small>${esc(x.date || '')}</small></div><strong class="bx-num ${x.amount_kobo > 0 ? 'is-good' : ''}">${esc(naira(x.amount_kobo, { plus: true }))}</strong></div>`).join('')}</div>`;
});


/* ---- 100-admin-kit.js ---- */
/* ==========================================================================
   Admin pages: shared pieces
   ========================================================================== */
/* Registers an admin page. Non-admins get a plain message, never the page. */
function adminPage(name, title, render) {
  page(name, title, (host, ctx) => {
    if (!isAdmin()) { mount(host, pageHead(title, '') + note('bad', __('This page is for platform admins', 'bulk-sms-portal'), __('Sign in with an admin account to open it.', 'bulk-sms-portal'))); return; }
    return render(host, ctx);
  });
}
function adSummary(force = false) {
  if (!APP._summary || force) APP._summary = C.api('/admin/summary');
  return APP._summary;
}
const AD_STATUS = { active: ['good', __('Active', 'bulk-sms-portal')], suspended: ['bad', __('Suspended', 'bulk-sms-portal')] };
const FEATURE_WORDS = {
  compose_sms: __('Send SMS', 'bulk-sms-portal'), scheduled_sms: __('Send later', 'bulk-sms-portal'), templates: __('Saved messages', 'bulk-sms-portal'), phone_groups: __('Phonebook', 'bulk-sms-portal'), message_history: __('Message History', 'bulk-sms-portal'),
  delivery_reports: __('Delivery Reports', 'bulk-sms-portal'), buy_sms: __('Buy SMS', 'bulk-sms-portal'), manual_funding: __('Pay by bank transfer', 'bulk-sms-portal'), transactions: __('Wallet History', 'bulk-sms-portal'),
  sender_ids: __('Sender names', 'bulk-sms-portal'), notifications: __('Notifications', 'bulk-sms-portal'), api_access: __('API (connect a website or app)', 'bulk-sms-portal'), broadcast: __('Customer notices', 'bulk-sms-portal'),
  pricing: __('Pricing page', 'bulk-sms-portal'), frontend_admin: __('Admin pages in the portal', 'bulk-sms-portal'), developer_tools: __('Developer tools', 'bulk-sms-portal')
};
const LIMIT_WORDS = {
  phone_groups: __('Phonebook groups', 'bulk-sms-portal'), contacts_per_group: __('Numbers in each group', 'bulk-sms-portal'), templates: __('Saved messages', 'bulk-sms-portal'), sender_ids: __('Sender name requests', 'bulk-sms-portal'),
  campaigns_per_day: __('Sends per day', 'bulk-sms-portal'), recipients_per_campaign: __('People in one send', 'bulk-sms-portal'), api_keys: __('API keys', 'bulk-sms-portal')
};

/* Customer search box: resolves to a chosen user. */
async function adUsers(search = '') {
  const q = new URLSearchParams({ per_page: 20, sort: 'name' }); if (search) q.set('search', search);
  const r = await C.api('/admin/users?' + q);
  const items = (r && r.ok && r.items) || [];
  items.total = Number((r && r.total) || items.length);
  return items;
}
function customerPicker(container, onPick) {
  container.innerHTML = `<div class="bx-field"><label class="bx-label" for="bx-cp-q">${__('Customer', 'bulk-sms-portal')}</label><input id="bx-cp-q" class="bx-input" type="search" autocomplete="off" placeholder="${esc(__('Type a name, email or phone', 'bulk-sms-portal'))}"><div class="bx-rows bx-mt-s" data-bx-cp-list hidden></div></div>`;
  const q = $('#bx-cp-q', container), list = $('[data-bx-cp-list]', container);
  let t = null;
  const run = async () => {
    const items = await adUsers(q.value.trim());
    list.hidden = false;
    list.innerHTML = items.length ? items.slice(0, 8).map(u => `<button type="button" class="bx-line-item" data-bx-cp="${u.id}"><div class="bx-td-main"><strong>${esc(u.name)}</strong><small>${esc(u.email)}</small></div><span class="bx-num">${esc(naira(u.sms_balance_kobo))}</span></button>`).join('') + (items.total > 8 ? `<p class="bx-line-item bx-muted bx-small">${sprintf(/* translators: %s: a value filled in when shown */ __('Showing 8 of %s. Type more of the name, email or phone to narrow it down.', 'bulk-sms-portal'), num(items.total))}</p>` : '') : `<p class="bx-line-item bx-muted">${__('No customer matches.', 'bulk-sms-portal')}</p>`;
    $$('[data-bx-cp]', list).forEach(b => b.onclick = () => { const u = items.find(x => String(x.id) === b.dataset.bxCp); list.hidden = true; q.value = u.name; onPick(u); });
  };
  q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(run, 250); });
  q.addEventListener('focus', () => { if (list.hidden) run(); });
}
/* Add or remove money from a customer's wallet (shared by Users and Payments). */
function walletDialog(user, onDone) {
  openDialog(`<form method="dialog" novalidate><div class="bx-dialog-body"><h2>${__('Add or remove money', 'bulk-sms-portal')}</h2>
    <div data-bx-wd-who></div>
    <div class="bx-seg is-block" role="group" aria-label="${esc(__('Add or remove', 'bulk-sms-portal'))}"><button type="button" data-bx-wd-dir="add" aria-pressed="true">${__('Add money', 'bulk-sms-portal')}</button><button type="button" data-bx-wd-dir="remove" aria-pressed="false">${__('Remove money', 'bulk-sms-portal')}</button></div>
    <div class="bx-field"><label class="bx-label" for="bx-wd-amt">${__('Amount', 'bulk-sms-portal')}</label><div class="bx-money-input"><span aria-hidden="true">₦</span><input id="bx-wd-amt" type="number" min="1" step="0.01" inputmode="decimal"></div></div>
    <div class="bx-field"><label class="bx-label" for="bx-wd-reason">${__('Reason', 'bulk-sms-portal')}</label><input id="bx-wd-reason" class="bx-input" maxlength="160" placeholder="${esc(__('For example: payment received by cash', 'bulk-sms-portal'))}"><span class="bx-hint">${__('The customer sees this in Wallet History.', 'bulk-sms-portal')}</span></div>
    <div data-bx-wd-msg aria-live="polite"></div>
  </div><div class="bx-dialog-actions"><button class="bx-btn" value="cancel">${__('Cancel', 'bulk-sms-portal')}</button><button class="bx-btn is-primary" data-bx-wd-save>${__('Save', 'bulk-sms-portal')}</button></div></form>`, d => {
    let who = user || null, dir = 'add';
    const whoBox = $('[data-bx-wd-who]', d);
    const paintWho = () => { whoBox.innerHTML = who ? `<dl class="bx-kv"><div><dt>${__('Customer', 'bulk-sms-portal')}</dt><dd>${esc(who.name)}</dd></div><div><dt>${__('Wallet now', 'bulk-sms-portal')}</dt><dd>${esc(naira(who.sms_balance_kobo))}</dd></div></dl>` : ''; };
    if (who) paintWho(); else customerPicker(whoBox, u => { who = u; const extra = document.createElement('dl'); extra.className = 'bx-kv bx-mt-s'; extra.innerHTML = `<div><dt>${__('Wallet now', 'bulk-sms-portal')}</dt><dd>${esc(naira(u.sms_balance_kobo))}</dd></div>`; const old = $('dl', whoBox); if (old) old.remove(); whoBox.appendChild(extra); });
    $$('[data-bx-wd-dir]', d).forEach(b => b.onclick = () => { dir = b.dataset.bxWdDir; $$('[data-bx-wd-dir]', d).forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); $('[data-bx-wd-save]', d).textContent = dir === 'add' ? __('Add money', 'bulk-sms-portal') : __('Remove money', 'bulk-sms-portal'); });
    $('[data-bx-wd-save]', d).textContent = __('Add money', 'bulk-sms-portal');
    $('[data-bx-wd-save]', d).onclick = async (e) => {
      e.preventDefault();
      const msg = $('[data-bx-wd-msg]', d), amt = Number($('#bx-wd-amt', d).value || 0), reason = $('#bx-wd-reason', d).value.trim();
      if (!who) { msg.innerHTML = note('bad', __('Choose a customer first', 'bulk-sms-portal')); return; }
      if (!(amt > 0)) { msg.innerHTML = note('bad', __('Enter an amount', 'bulk-sms-portal')); return; }
      if (!reason) { msg.innerHTML = note('bad', __('Add a reason', 'bulk-sms-portal'), __('It helps you and the customer understand the change later.', 'bulk-sms-portal')); return; }
      const done = busy(e.currentTarget, __('Saving…', 'bulk-sms-portal'));
      const r = await C.api('/admin/credit-user', { method: 'POST', body: JSON.stringify({ user_id: Number(who.id), amount_naira: dir === 'add' ? amt : -amt, reason }) });
      done();
      if (r && r.ok) { d.close(); toast(`${sprintf(/* translators: %1$s, %2$s, %3$s, %4$s: values filled in when shown */ __('%1$s %2$s %3$s %4$s\'s wallet.', 'bulk-sms-portal'), dir === 'add' ? __('Added', 'bulk-sms-portal') : __('Removed', 'bulk-sms-portal'), naira(Math.round(amt * 100)), dir === 'add' ? 'to' : 'from', who.name)}`); if (onDone) onDone(); }
      else msg.innerHTML = note('bad', __('Not saved', 'bulk-sms-portal'), esc(friendly(r)));
    };
  });
}
/* A tab bar (role=tablist) used on wide admin pages. */
function tabs(list, active, attr = 'data-bx-tab') {
  return `<div class="bx-seg bx-tabs" role="tablist">${list.map(([k, l]) => `<button type="button" role="tab" ${attr}="${k}" aria-selected="${k === active ? 'true' : 'false'}">${esc(l)}</button>`).join('')}</div>`;
}
/* A simple yes/no row with a switch. */
function switchRow(key, label, hint, on, attr = 'data-bx-set') {
  return `<label class="bx-line-item bx-switch-row"><span class="bx-td-main"><strong>${esc(label)}</strong>${hint ? `<small>${esc(hint)}</small>` : ''}</span><input type="checkbox" class="bx-switch" ${attr}="${esc(key)}" ${on ? 'checked' : ''}></label>`;
}
function fieldHtml(id, label, value = '', opts = {}) {
  const type = opts.type || 'text';
  const inner = opts.textarea
    ? `<textarea id="${id}" class="bx-textarea${opts.mono ? ' bx-mono' : ''}" rows="${opts.rows || 3}" ${opts.attrs || ''} placeholder="${esc(opts.placeholder || '')}">${esc(value)}</textarea>`
    : opts.options
      ? `<select id="${id}" class="bx-select" ${opts.attrs || ''}>${opts.options.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(value) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`
      : `<input id="${id}" class="bx-input${opts.mono ? ' bx-mono' : ''}" type="${type}" value="${esc(value)}" ${opts.attrs || ''} placeholder="${esc(opts.placeholder || '')}">`;
  return `<div class="bx-field${opts.wide ? ' is-wide' : ''}"><label class="bx-label" for="${id}">${esc(label)}${opts.optional ? ` <span class="bx-optional">${__('(optional)', 'bulk-sms-portal')}</span>` : ''}</label>${inner}${opts.hint ? `<span class="bx-hint">${opts.hint}</span>` : ''}</div>`;
}
const val = (root, id) => { const el = $('#' + id, root); return el ? (el.type === 'checkbox' ? el.checked : el.value) : ''; };

/* v3.6.1: open an admin page on a given tab, in the portal or in WordPress admin. */
function goTab(page, tab) {
  if (page === 'admin-settings' && tab && typeof adPs !== 'undefined') adPs.tab = tab;
  if (page === 'admin-activity' && tab && typeof adAct !== 'undefined') adAct.tab = tab;
  if (document.getElementById('bsms-page-' + page)) { C.show(page, true); return; }
  if (pageUrl(page)) { location.href = pageUrl(page) + (tab ? '#tab=' + encodeURIComponent(tab) : ''); return; }
  C.show(page, true);
}
/* Reads #tab=… from the address once (used when WordPress admin opens a page on a tab). */
function tabFromHash(valid) {
  try {
    const h = new URLSearchParams(String(location.hash || '').replace(/^#/, ''));
    const t = h.get('tab');
    if (t && valid.includes(t)) { history.replaceState(null, '', location.pathname + location.search); return t; }
  } catch (e) {}
  return '';
}
const ADMIN_MORE = [
  ['admin-setup', 'checkCircle', __('Setup Guide', 'bulk-sms-portal'), __('What is left to set up before customers can send', 'bulk-sms-portal')],
  ['admin-activity', 'list', __('Activity Log', 'bulk-sms-portal'), __('Who changed what, and every alert sent to customers', 'bulk-sms-portal')]
];


/* ---- 110-admin-dashboard.js ---- */
/* ==========================================================================
   Admin Dashboard
   ========================================================================== */
const ADMIN_AREAS = [
  ['admin-users', 'people', __('Users & Wallets', 'bulk-sms-portal'), __('Customer accounts, wallets and what each customer can use', 'bulk-sms-portal')],
  ['admin-credit', 'receipt', __('Payments', 'bulk-sms-portal'), __('Check bank transfers and online payments', 'bulk-sms-portal')],
  ['admin-senders', 'badge', __('Sender ID Manager', 'bulk-sms-portal'), __('Approve or decline sender names', 'bulk-sms-portal')],
  ['admin-broadcast', 'bell', __('Customer Notices', 'bulk-sms-portal'), __('Tell customers about news, changes and offers', 'bulk-sms-portal')],
  ['admin-pricing', 'tag', __('Pricing Manager', 'bulk-sms-portal'), __('Price per SMS page and network exceptions', 'bulk-sms-portal')],
  ['admin-apis', 'plug', __('SMS Services', 'bulk-sms-portal'), __('The services that deliver your messages', 'bulk-sms-portal')],
  ['admin-analytics', 'chart', __('Reports & Insights', 'bulk-sms-portal'), __('How sending and money are going over time', 'bulk-sms-portal')],
  ['admin-help', 'help', __('Help Content', 'bulk-sms-portal'), __('Questions and guides customers see in the Help Centre', 'bulk-sms-portal')],
  ['admin-settings', 'gear', __('Platform Settings', 'bulk-sms-portal'), __('Brand, payments, bank accounts, sign-in and features', 'bulk-sms-portal')],
  ['admin-monitoring', 'pulse', __('System Checks', 'bulk-sms-portal'), __('Find anything that could stop sending or payments', 'bulk-sms-portal')]
];
adminPage('admin-dashboard', 'Admin Dashboard', async (host, ctx) => {
  const root = mount(host, `${pageHead(__('Admin Dashboard', 'bulk-sms-portal'), __('What needs your attention, and how sending and money are going today.', 'bulk-sms-portal'), btn(icon('people', 18) + __('Add or remove money', 'bulk-sms-portal'), 'data-bx-wallet'))}<div data-bx-ad>${skeleton(6)}</div>`);
  $('[data-bx-wallet]', root).onclick = () => walletDialog(null, () => C.show('admin-dashboard', false));
  const [r, h, b, su] = await Promise.all([adSummary(true), C.api('/admin/platform-health'), C.api('/admin/api-balances'), C.api('/admin/setup')]);
  if (!ctx.live()) return;
  const box = $('[data-bx-ad]', root);
  if (!r || !r.ok) { box.innerHTML = note('bad', __('We could not load the dashboard', 'bulk-sms-portal'), esc(friendly(r))); return; }
  const checks = (h && h.ok && h.checks) || [];
  const warnings = checks.filter(c => c.status !== 'healthy');
  const attention = [
    ['admin-credit', 'receipt', __('Payments to check', 'bulk-sms-portal'), Number(r.pending_funding || 0), __('Bank transfers waiting for you', 'bulk-sms-portal')],
    ['admin-senders', 'badge', __('Sender names to review', 'bulk-sms-portal'), Number(r.pending_senders || 0), __('Customers waiting for a decision', 'bulk-sms-portal')],
    ['failed', 'alert', __('Failed today', 'bulk-sms-portal'), Number(r.failed_today || 0), __('Their charges were returned automatically', 'bulk-sms-portal')],
    ['admin-monitoring', 'pulse', __('System checks to look at', 'bulk-sms-portal'), warnings.length, warnings.length ? warnings[0].label : __('Everything checked is fine', 'bulk-sms-portal')]
  ];
  const services = (b && b.ok && b.items) || [];
  const setupLeft = su && su.ok ? su.total - su.done : 0;
  box.innerHTML = `
    ${setupLeft ? `<div class="bx-section bx-mt-0">${note('wait', `${sprintf(/* translators: %s: a value filled in when shown */ __('Finish setting up: %s left', 'bulk-sms-portal'), sprintf(/* translators: %s: a number */ _n('%s step', '%s steps', Number(setupLeft), 'bulk-sms-portal'), num(setupLeft)))}`, __('Customers may not be able to send or pay until these are done.', 'bulk-sms-portal'), btn(__('Open the Setup Guide', 'bulk-sms-portal'), 'data-bx-go="admin-setup"', 'is-small is-primary'))}</div>` : ''}
    <section aria-labelledby="bx-ad-att"${setupLeft ? ' class="bx-section"' : ''}>
      <div class="bx-section-head"><h2 id="bx-ad-att">${__('Needs your attention', 'bulk-sms-portal')}</h2></div>
      <div class="bx-grid" style="--min:220px">${attention.map(([p, ic, label, n, sub]) => `<button type="button" class="bx-tile${n ? ' is-alert' : ''}" data-bx-att="${p}">${icon(ic, 22)}<span class="bx-stat-value">${num(n)}</span><strong>${esc(label)}</strong><span>${esc(sub)}</span></button>`).join('')}</div>
    </section>
    <section class="bx-section" aria-labelledby="bx-ad-today">
      <div class="bx-section-head"><div><h2 id="bx-ad-today">${__('Today', 'bulk-sms-portal')}</h2><p>${__('All customers, since midnight.', 'bulk-sms-portal')}</p></div>${btn(__('See Delivery Reports', 'bulk-sms-portal'), 'data-bx-go="reports"', 'is-quiet is-small')}</div>
      <div class="bx-stats">
        ${stat(__('Messages sent', 'bulk-sms-portal'), num(r.submitted_today), { note: sprintf(/* translators: %s: a number */ _n('%s send', '%s sends', Number(r.campaigns_today), 'bulk-sms-portal'), num(r.campaigns_today)) })}
        ${stat(__('Successful', 'bulk-sms-portal'), num(r.successful_today), { tone: 'good', note: (Number(r.successful_submission_rate || 0)) + __('% of results', 'bulk-sms-portal') })}
        ${stat(__('Failed', 'bulk-sms-portal'), num(r.failed_today), { tone: Number(r.failed_today) ? 'bad' : '' })}
        ${stat(__('Money used', 'bulk-sms-portal'), naira(r.charged_today_kobo))}
        ${stat(__('Money returned', 'bulk-sms-portal'), naira(r.refunds_today_kobo), { note: sprintf(/* translators: %s: a number */ _n('%s failed message', '%s failed messages', Number(r.refunds_today), 'bulk-sms-portal'), num(r.refunds_today)) })}
        ${stat(__('SMS income', 'bulk-sms-portal'), naira(r.net_sms_revenue_today_kobo), { note: __('Used minus returned', 'bulk-sms-portal') })}
      </div>
    </section>
    <div class="bx-section bx-split">
      <section class="bx-panel is-flush" aria-labelledby="bx-ad-cust">
        <div class="bx-panel-head"><div><h2 id="bx-ad-cust">${__('Customers and wallets', 'bulk-sms-portal')}</h2></div>${btn(__('Open Users & Wallets', 'bulk-sms-portal'), 'data-bx-go="admin-users"', 'is-quiet is-small')}</div>
        <div class="bx-stats is-inset">
          ${stat(__('Customers', 'bulk-sms-portal'), num(r.users), { note: `${num(r.active_users)} active` })}
          ${stat(__('Suspended', 'bulk-sms-portal'), num(r.suspended_users), { tone: Number(r.suspended_users) ? 'wait' : '' })}
          ${stat(__('Money in customer wallets', 'bulk-sms-portal'), naira(r.total_sms_wallet_kobo))}
        </div>
      </section>
      <section class="bx-panel is-flush" aria-labelledby="bx-ad-svc">
        <div class="bx-panel-head"><div><h2 id="bx-ad-svc">${__('SMS services', 'bulk-sms-portal')}</h2><p>${__('Balance left with each service you send through.', 'bulk-sms-portal')}</p></div>${btn(icon('refresh', 16) + __('Check again', 'bulk-sms-portal'), 'data-bx-refresh', 'is-quiet is-small')}</div>
        <div class="bx-rows">${services.length ? services.map(s => { const bal = String(s.balance || '').trim(); const has = bal && !/not available/i.test(bal); return `<div class="bx-line-item"><div class="bx-td-main"><strong>${esc(s.name || __('SMS service', 'bulk-sms-portal'))}</strong><small>${Number(s.active) ? 'On' : __('Off', 'bulk-sms-portal')}, ${esc(routeWords(s.route))}</small></div><strong class="bx-num">${has ? esc(bal) : `<span class="bx-muted">${__('Balance not shared', 'bulk-sms-portal')}</span>`}</strong></div>`; }).join('') : `<div class="bx-line-item">${empty('plug', __('No SMS service yet', 'bulk-sms-portal'), __('Add the service you send through so messages can go out.', 'bulk-sms-portal'), btn(__('Add an SMS service', 'bulk-sms-portal'), 'data-bx-go="admin-apis"', 'is-primary is-small'))}</div>`}</div>
      </section>
    </div>
    <section class="bx-section" aria-labelledby="bx-ad-areas">
      <div class="bx-section-head"><h2 id="bx-ad-areas">${__('Run the platform', 'bulk-sms-portal')}</h2></div>
      <div class="bx-grid" style="--min:250px">${ADMIN_AREAS.map(([p, ic, t, d]) => `<button type="button" class="bx-tile" data-bx-go="${p}">${icon(ic, 22)}<strong>${esc(t)}</strong><span>${esc(d)}</span></button>`).join('')}</div>
    </section>
    <section class="bx-section" aria-labelledby="bx-ad-more">
      <div class="bx-section-head"><h2 id="bx-ad-more">${__('More tools', 'bulk-sms-portal')}</h2></div>
      <div class="bx-rows">${ADMIN_MORE.map(([p, ic, t, d]) => `<button type="button" class="bx-line-item" data-bx-go="${p}"><div class="bx-row-flex is-nowrap">${icon(ic, 20)}<div class="bx-td-main"><strong>${esc(t)}</strong><small>${esc(d)}</small></div></div>${icon('chev', 18)}</button>`).join('')}</div>
    </section>`;
  bindGo(box);
  $$('[data-bx-att]', box).forEach(bt => bt.onclick = () => bt.dataset.bxAtt === 'failed' ? APP.openMessages('', 'failed') : go(bt.dataset.bxAtt));
  const rf = $('[data-bx-refresh]', box); if (rf) rf.onclick = () => C.show('admin-dashboard', false);
});
function routeWords(r) {
  const k = String(r || '').toLowerCase();
  if (k === 'dnd' || k === 'premium') return __('Do Not Disturb numbers', 'bulk-sms-portal');
  if (k === 'international' || k === 'intl') return __('numbers outside Nigeria', 'bulk-sms-portal');
  return 'standard messages';
}


/* ---- 120-admin-users.js ---- */
/* ==========================================================================
   Users & Wallets
   ========================================================================== */
const adUsersState = { search: '', status: '', sort: 'newest', page: 1 };
adminPage('admin-users', 'Users & Wallets', async (host, ctx) => {
  const st = adUsersState;
  const root = mount(host, `
    ${pageHead(__('Users & Wallets', 'bulk-sms-portal'), __('Every customer account: contact details, wallet balance, status and what they can use.', 'bulk-sms-portal'), btn(icon('wallet', 18) + __('Add or remove money', 'bulk-sms-portal'), 'data-bx-wallet', 'is-primary'))}
    <div class="bx-stats" data-bx-us-stats>${stat(__('Customers', 'bulk-sms-portal'), '…')}</div>
    <div class="bx-section">
      <form class="bx-filters" role="search" data-bx-us-form>
        ${fieldHtml('bx-us-q', __('Search', 'bulk-sms-portal'), st.search, { type: 'search', placeholder: __('Name, email, username or phone', 'bulk-sms-portal') })}
        ${fieldHtml('bx-us-status', __('Status', 'bulk-sms-portal'), st.status, { options: [['', __('Everyone', 'bulk-sms-portal')], ['active', __('Active', 'bulk-sms-portal')], ['suspended', __('Suspended', 'bulk-sms-portal')]] })}
        ${fieldHtml('bx-us-sort', __('Order', 'bulk-sms-portal'), st.sort, { options: [['newest', __('Newest first', 'bulk-sms-portal')], ['oldest', __('Oldest first', 'bulk-sms-portal')], ['name', __('Name A to Z', 'bulk-sms-portal')]] })}
        <div class="bx-filter-actions"><button type="submit" class="bx-btn is-primary">${sprintf(/* translators: %s: a value filled in when shown */ __('%sSearch', 'bulk-sms-portal'), icon('search', 18))}</button><button type="button" class="bx-btn" data-bx-clear>${__('Clear', 'bulk-sms-portal')}</button></div>
      </form>
      <div data-bx-us-list>${loading(__('Loading customers…', 'bulk-sms-portal'))}</div>
    </div>`);
  $('[data-bx-wallet]', root).onclick = () => walletDialog(null, () => draw(st.page));
  const form = $('[data-bx-us-form]', root);
  form.onsubmit = e => { e.preventDefault(); st.search = val(form, 'bx-us-q').trim(); st.status = val(form, 'bx-us-status'); st.sort = val(form, 'bx-us-sort'); draw(1); };
  ['bx-us-status', 'bx-us-sort'].forEach(id => $('#' + id, form).onchange = () => form.requestSubmit());
  $('[data-bx-clear]', form).onclick = () => { st.search = ''; st.status = ''; st.sort = 'newest'; C.show('admin-users', false); };

  adSummary(true).then(s => {
    if (!ctx.live() || !s || !s.ok) return;
    $('[data-bx-us-stats]', root).innerHTML = stat(__('Customers', 'bulk-sms-portal'), num(s.users)) + stat(__('Active', 'bulk-sms-portal'), num(s.active_users), { tone: 'good' }) + stat(__('Suspended', 'bulk-sms-portal'), num(s.suspended_users), { tone: Number(s.suspended_users) ? 'wait' : '' }) + stat(__('Money in wallets', 'bulk-sms-portal'), naira(s.total_sms_wallet_kobo));
  });

  async function draw(pg = 1) {
    st.page = pg;
    const list = $('[data-bx-us-list]', root);
    list.innerHTML = loading(__('Loading customers…', 'bulk-sms-portal'));
    const q = new URLSearchParams({ page: pg, per_page: 20, sort: st.sort });
    if (st.search) q.set('search', st.search); if (st.status) q.set('status', st.status);
    const r = await C.api('/admin/users?' + q);
    if (!ctx.live()) return;
    if (!r || !r.ok) { list.innerHTML = `<div class="bx-panel">${note('bad', __('We could not load customers', 'bulk-sms-portal'), esc(friendly(r)))}</div>`; return; }
    if (pageBack(r, pg, draw)) return;
    const items = r.items || [];
    if (!items.length) { list.innerHTML = `<div class="bx-list">${empty('people', __('No customers found', 'bulk-sms-portal'), st.search || st.status ? __('Try a different search or clear the filters.', 'bulk-sms-portal') : __('Customers appear here when they create an account.', 'bulk-sms-portal'))}</div>`; return; }
    const cols = '2fr 1.3fr 0.8fr 1fr 1fr 220px';
    list.innerHTML = `<div class="bx-list">
      <div class="bx-tr is-head" style="--cols:${cols}"><span>${__('Customer', 'bulk-sms-portal')}</span><span>${__('Phone', 'bulk-sms-portal')}</span><span>${__('Status', 'bulk-sms-portal')}</span><span class="is-num">${__('Wallet', 'bulk-sms-portal')}</span><span>${__('Joined', 'bulk-sms-portal')}</span><span></span></div>
      ${items.map(u => { const s = AD_STATUS[u.status] || ['info', u.status]; return `<div class="bx-tr" style="--cols:${cols}">
        <span class="bx-td-main bx-td-lead" data-label="${esc(__('Customer', 'bulk-sms-portal'))}"><strong>${esc(u.name)}</strong><small class="bx-break">${esc(u.email)}${u.role && u.role !== 'subscriber' ? ', ' + esc(u.role) : ''}</small></span>
        <span data-label="${esc(__('Phone', 'bulk-sms-portal'))}">${esc(u.phone || '—')}</span>
        <span data-label="${esc(__('Status', 'bulk-sms-portal'))}">${pill(s[0], s[1])}</span>
        <span class="is-num" data-label="${esc(__('Wallet', 'bulk-sms-portal'))}"><b>${esc(naira(u.sms_balance_kobo))}</b></span>
        <span data-label="${esc(__('Joined', 'bulk-sms-portal'))}">${esc(fmtDate(u.registered, false))}</span>
        <span class="bx-row-flex bx-td-actions">${btn(__('Manage', 'bulk-sms-portal'), `data-bx-manage="${u.id}"`, 'is-small')}${btn(__('Money', 'bulk-sms-portal'), `data-bx-money="${u.id}"`, 'is-small is-quiet')}</span>
      </div>`; }).join('')}
      ${pager(r)}</div>`;
    bindPager(list, draw);
    $$('[data-bx-money]', list).forEach(b => b.onclick = () => walletDialog(items.find(u => String(u.id) === b.dataset.bxMoney), () => draw(st.page)));
    $$('[data-bx-manage]', list).forEach(b => b.onclick = () => manageUser(items.find(u => String(u.id) === b.dataset.bxManage), () => draw(st.page)));
  }
  draw(st.page);
});

/* Everything about one customer, in tabs. Each tab saves on its own. */
function manageUser(u, onChange) {
  let tab = 'details';
  // Add-ons add tabs here: { key, label, paint(body, { u, say, msgBox, onChange }) }.
  const extraTabs = window.wp && wp.hooks ? wp.hooks.applyFilters('bsms.userTabs', [], u) : [];
  const d = openDialog(`<div class="bx-dialog-body">
      <h2>${esc(u.name)}</h2>
      <p class="bx-small bx-muted">${sprintf(/* translators: %1$s, %2$s: values filled in when shown */ __('%1$s, joined %2$s', 'bulk-sms-portal'), esc(u.email), esc(fmtDate(u.registered, false)))}</p>
      ${tabs([['details', __('Details', 'bulk-sms-portal')]].concat(extraTabs.map(x => [x.key, x.label]), [['api', 'API']]), tab)}
      <div data-bx-mu-body></div>
    </div><div class="bx-dialog-actions"><button type="button" class="bx-btn" data-bx-close>${__('Close', 'bulk-sms-portal')}</button></div>`, dlg => {
    dlg.classList.add('is-wide');
    $('[data-bx-close]', dlg).onclick = () => dlg.close();
    $$('[data-bx-tab]', dlg).forEach(b => b.onclick = () => { tab = b.dataset.bxTab; $$('[data-bx-tab]', dlg).forEach(x => x.setAttribute('aria-selected', x === b ? 'true' : 'false')); paint(); });
    paint();
    async function paint() {
      const body = $('[data-bx-mu-body]', dlg);
      const msgBox = '<div data-bx-mu-msg aria-live="polite"></div>';
      const say = (tone, t, x = '') => { const m = $('[data-bx-mu-msg]', body); if (m) m.innerHTML = note(tone, t, x); };
      if (tab === 'details') {
        const s = AD_STATUS[u.status] || ['info', u.status];
        body.innerHTML = `<div class="bx-fields bx-mt-m">
          ${fieldHtml('mu-first', __('First name', 'bulk-sms-portal'), u.first_name)}${fieldHtml('mu-last', __('Last name', 'bulk-sms-portal'), u.last_name)}
          ${fieldHtml('mu-display', __('Name shown', 'bulk-sms-portal'), u.name)}${fieldHtml('mu-email', __('Email', 'bulk-sms-portal'), u.email, { type: 'email' })}
          ${fieldHtml('mu-phone', __('Phone', 'bulk-sms-portal'), u.phone)}${fieldHtml('mu-status', __('Status', 'bulk-sms-portal'), u.status, { options: [['active', __('Active, can sign in and send', 'bulk-sms-portal')], ['suspended', __('Suspended, cannot send or pay', 'bulk-sms-portal')]] })}
        </div><div class="bx-row-flex bx-mt-m"><button type="button" class="bx-btn is-primary" data-bx-mu-save>${__('Save details', 'bulk-sms-portal')}</button><span class="bx-small bx-muted">${sprintf(/* translators: %s: a value filled in when shown */ __('Wallet: %s', 'bulk-sms-portal'), esc(naira(u.sms_balance_kobo)))}</span>${pill(s[0], s[1])}</div>${msgBox}`;
        $('[data-bx-mu-save]', body).onclick = async (e) => {
          const next = { display_name: val(body, 'mu-display'), first_name: val(body, 'mu-first'), last_name: val(body, 'mu-last'), email: val(body, 'mu-email'), phone: val(body, 'mu-phone'), status: val(body, 'mu-status'), role: (u.roles && u.roles[0]) || u.role || '' };
          if (next.status === 'suspended' && u.status !== 'suspended' && !await confirmBox({ title: `${sprintf(/* translators: %s: a value filled in when shown */ __('Suspend %s?', 'bulk-sms-portal'), u.name)}`, body: `<p>${__('They will not be able to send SMS, pay or use the API until you make the account active again. Their wallet money is kept.', 'bulk-sms-portal')}</p>`, confirm: __('Suspend', 'bulk-sms-portal'), danger: true })) return;
          const done = busy(e.currentTarget, __('Saving…', 'bulk-sms-portal'));
          const r = await C.api('/admin/users/' + u.id, { method: 'POST', body: JSON.stringify(next) });
          let r2 = { ok: true };
          if (r && r.ok && next.status !== u.status) r2 = await C.api('/admin/users/' + u.id + '/status', { method: 'POST', body: JSON.stringify({ status: next.status }) });
          done();
          if (r && r.ok && r2 && r2.ok) { Object.assign(u, { name: next.display_name, first_name: next.first_name, last_name: next.last_name, email: next.email, phone: next.phone, status: next.status }); say('good', __('Details saved', 'bulk-sms-portal')); if (onChange) onChange(); }
          else say('bad', __('Not saved', 'bulk-sms-portal'), esc(friendly(r && r.ok ? r2 : r)));
        };
      } else if (extraTabs.some(x => x.key === tab)) {
        extraTabs.find(x => x.key === tab).paint(body, { u, say, msgBox, onChange });
      } else {
        body.innerHTML = `<div class="bx-stack is-tight bx-mt-m"><p>${__('Make a new API key for this customer and switch off their old ones. Use this if a key may have been seen by someone else.', 'bulk-sms-portal')}</p>
          <div class="bx-row-flex"><button type="button" class="bx-btn is-danger" data-bx-mu-reset>${sprintf(/* translators: %s: a value filled in when shown */ __('%sReplace API keys', 'bulk-sms-portal'), icon('key', 18))}</button></div><div data-bx-mu-key></div>${msgBox}</div>`;
        $('[data-bx-mu-reset]', body).onclick = async (e) => {
          if (!await confirmBox({ title: `${sprintf(/* translators: %s: a value filled in when shown */ __('Replace %s\'s API keys?', 'bulk-sms-portal'), u.name)}`, body: `<p>${__('Their current keys stop working straight away. You will see the new key once, to pass on to them securely.', 'bulk-sms-portal')}</p>`, confirm: __('Replace keys', 'bulk-sms-portal'), danger: true })) return;
          const done = busy(e.currentTarget, __('Replacing…', 'bulk-sms-portal'));
          const r = await C.api('/admin/users/' + u.id + '/reset-api', { method: 'POST', body: '{}' });
          done();
          if (r && r.ok && r.api_key) { $('[data-bx-mu-key]', body).innerHTML = `${note('wait', __('Copy this key now', 'bulk-sms-portal'), __('It is shown only once.', 'bulk-sms-portal'))}<div class="bx-copy bx-mt-s"><span class="bx-mono">${esc(r.api_key)}</span><button type="button" class="bx-btn is-small is-primary" data-bx-copy="${esc(r.api_key)}">${sprintf(/* translators: %s: a value filled in when shown */ __('%sCopy', 'bulk-sms-portal'), icon('copy', 16))}</button></div>`; bindCopy(body); }
          else say('bad', __('Keys not replaced', 'bulk-sms-portal'), esc(friendly(r)));
        };
      }
    }
  });
  return d;
}


/* ---- 130-admin-payments.js ---- */
/* ==========================================================================
   Payments (bank transfers and online payments)
   ========================================================================== */
const adPay = { status: 'pending', search: '', page: 1 };
const PAY_TONE = { pending: 'wait', approved: 'good', completed: 'good', success: 'good', rejected: 'bad', failed: 'bad', cancelled: 'bad' };
adminPage('admin-credit', 'Payments', async (host, ctx) => {
  const st = adPay;
  const root = mount(host, `
    ${pageHead(__('Payments', 'bulk-sms-portal'), __('Check bank transfers customers tell you about, and online payments that are still being confirmed. Approving adds the money to the customer\'s wallet.', 'bulk-sms-portal'), btn(icon('wallet', 18) + __('Add or remove money', 'bulk-sms-portal'), 'data-bx-wallet') + btn(__('See Wallet History', 'bulk-sms-portal'), 'data-bx-go="transactions"', 'is-quiet'))}
    <div class="bx-stats" data-bx-pay-tiles>${stat(__('Waiting for you', 'bulk-sms-portal'), '…')}</div>
    <div class="bx-section">
      <form class="bx-filters" role="search" data-bx-pay-form>
        ${fieldHtml('bx-pay-q', __('Search', 'bulk-sms-portal'), st.search, { type: 'search', placeholder: __('Reference, customer, name on transfer or bank', 'bulk-sms-portal') })}
        <div class="bx-filter-actions"><button type="submit" class="bx-btn is-primary">${sprintf(/* translators: %s: a value filled in when shown */ __('%sSearch', 'bulk-sms-portal'), icon('search', 18))}</button><button type="button" class="bx-btn" data-bx-clear>${__('Clear', 'bulk-sms-portal')}</button></div>
      </form>
      <div data-bx-pay-list>${loading(__('Loading payments…', 'bulk-sms-portal'))}</div>
    </div>`);
  bindGo(root);
  $('[data-bx-wallet]', root).onclick = () => walletDialog(null, () => draw(st.page));
  const form = $('[data-bx-pay-form]', root);
  form.onsubmit = e => { e.preventDefault(); st.search = val(form, 'bx-pay-q').trim(); draw(1); };
  $('[data-bx-clear]', form).onclick = () => { st.search = ''; st.status = 'pending'; $('#bx-pay-q', form).value = ''; draw(1); };

  async function draw(pg = 1) {
    st.page = pg;
    const list = $('[data-bx-pay-list]', root);
    list.innerHTML = loading(__('Loading payments…', 'bulk-sms-portal'));
    const q = new URLSearchParams({ page: pg, per_page: 20 }); if (st.status) q.set('status', st.status); if (st.search) q.set('search', st.search);
    const r = await C.api('/admin/funding-requests?' + q);
    if (!ctx.live()) return;
    if (!r || !r.ok) { list.innerHTML = `<div class="bx-panel">${note('bad', __('We could not load payments', 'bulk-sms-portal'), esc(friendly(r)))}</div>`; return; }
    if (pageBack(r, pg, draw)) return;
    const c = r.counts || {};
    $('[data-bx-pay-tiles]', root).innerHTML = [
      stat(__('Waiting for you', 'bulk-sms-portal'), num(c.pending), { filter: 'pending', active: st.status === 'pending', tone: Number(c.pending) ? 'wait' : '' }),
      stat(__('Approved', 'bulk-sms-portal'), num(c.approved), { filter: 'approved', active: st.status === 'approved', tone: 'good' }),
      stat(__('Declined', 'bulk-sms-portal'), num(c.rejected), { filter: 'rejected', active: st.status === 'rejected' }),
      stat(__('All payments', 'bulk-sms-portal'), num(c.all), { filter: '', active: !st.status })
    ].join('');
    $$('[data-bx-filter-value]', root).forEach(b => b.onclick = () => { st.status = b.dataset.bxFilterValue; draw(1); });
    const items = r.items || [];
    if (!items.length) { list.innerHTML = `<div class="bx-list">${empty('receipt', st.status === 'pending' && !st.search ? __('Nothing waiting', 'bulk-sms-portal') : __('No payments found', 'bulk-sms-portal'), st.status === 'pending' && !st.search ? __('New bank transfers will show here for you to check.', 'bulk-sms-portal') : __('Try a different search or choose another status.', 'bulk-sms-portal'))}</div>`; return; }
    const cols = '1.6fr 1fr 1.6fr 1fr 250px';
    list.innerHTML = `<div class="bx-list">
      <div class="bx-tr is-head" style="--cols:${cols}"><span>${__('Customer', 'bulk-sms-portal')}</span><span class="is-num">${__('Amount', 'bulk-sms-portal')}</span><span>${__('Payment', 'bulk-sms-portal')}</span><span>${__('Status', 'bulk-sms-portal')}</span><span></span></div>
      ${items.map(x => { const s = String(x.status || 'pending').toLowerCase(); const online = x.kind ? x.kind !== 'bank_transfer' : String(x.method || '').indexOf('manual') === -1; return `<div class="bx-tr" style="--cols:${cols}">
        <span class="bx-td-main bx-td-lead" data-label="${esc(__('Customer', 'bulk-sms-portal'))}"><strong>${esc(x.user_name || (__('Customer #', 'bulk-sms-portal') + x.user_id))}</strong><small class="bx-break">${esc(x.user_email || '')}</small><small>${esc(fmtDate(x.created_at))}</small></span>
        <span class="is-num" data-label="${esc(__('Amount', 'bulk-sms-portal'))}"><b>${esc(naira(x.amount_kobo))}</b></span>
        <span class="bx-td-main" data-label="${esc(__('Payment', 'bulk-sms-portal'))}"><strong>${online ? __('Online payment', 'bulk-sms-portal') : (x.bank_name ? sprintf(/* translators: %s: bank name */ __('Bank transfer to %s', 'bulk-sms-portal'), esc(x.bank_name)) : __('Bank transfer', 'bulk-sms-portal'))}</strong>${x.depositor_name ? `<small>${sprintf(/* translators: %s: a value filled in when shown */ __('Name on transfer: %s', 'bulk-sms-portal'), esc(x.depositor_name))}</small>` : ''}${x.note ? `<small>${sprintf(/* translators: %s: a value filled in when shown */ __('Note: %s', 'bulk-sms-portal'), esc(x.note))}</small>` : ''}<small class="bx-mono">${esc(x.reference || '')}</small></span>
        <span class="bx-td-main" data-label="${esc(__('Status', 'bulk-sms-portal'))}">${pill(PAY_TONE[s] || 'info', x.status_label || s)}${x.admin_note ? `<small>${esc(x.admin_note)}</small>` : ''}</span>
        <span class="bx-row-flex bx-td-actions">
          ${x.has_proof ? btn(__('Receipt', 'bulk-sms-portal'), `data-bx-proof="${esc(x.id)}"`, 'is-small is-quiet') : ''}
          ${x.can_verify ? btn(__('Check payment', 'bulk-sms-portal'), `data-bx-verify="${esc(x.id)}"`, 'is-small') : ''}
          ${x.can_review ? btn(__('Approve', 'bulk-sms-portal'), `data-bx-approve="${esc(x.id)}"`, 'is-small is-primary') + btn(__('Decline', 'bulk-sms-portal'), `data-bx-decline="${esc(x.id)}"`, 'is-small is-danger') : ''}
        </span></div>`; }).join('')}
      ${pager(r)}</div>`;
    bindPager(list, draw);
    const find = id => items.find(x => String(x.id) === String(id));
    $$('[data-bx-proof]', list).forEach(b => b.onclick = () => window.open(C.restUrl('funding/requests/' + b.dataset.bxProof + '/proof') + '?_wpnonce=' + encodeURIComponent((window.BSMS_PORTAL || {}).nonce || ''), '_blank', 'noopener'));
    $$('[data-bx-approve]', list).forEach(b => b.onclick = () => decide(find(b.dataset.bxApprove), 'approve'));
    $$('[data-bx-decline]', list).forEach(b => b.onclick = () => decide(find(b.dataset.bxDecline), 'reject'));
    $$('[data-bx-verify]', list).forEach(b => b.onclick = async () => {
      const done = busy(b, __('Checking…', 'bulk-sms-portal'));
      const res = await C.api(`/admin/funding-requests/${b.dataset.bxVerify}/verify`, { method: 'POST', body: '{}' });
      done(); toast(res && res.ok ? (res.message || __('Payment checked.', 'bulk-sms-portal')) : friendly(res, __('The payment could not be checked.', 'bulk-sms-portal')), res && res.ok ? '' : 'bad'); draw(st.page);
    });
  }
  function decide(x, action) {
    if (!x) return;
    const approve = action === 'approve';
    openDialog(`<form method="dialog" novalidate><div class="bx-dialog-body"><h2>${approve ? __('Approve this payment?', 'bulk-sms-portal') : __('Decline this payment?', 'bulk-sms-portal')}</h2>
      <dl class="bx-kv"><div><dt>${__('Customer', 'bulk-sms-portal')}</dt><dd>${esc(x.user_name || '')}</dd></div><div><dt>${__('Amount', 'bulk-sms-portal')}</dt><dd>${esc(naira(x.amount_kobo))}</dd></div><div><dt>${__('Name on transfer', 'bulk-sms-portal')}</dt><dd>${esc(x.depositor_name || '—')}</dd></div><div><dt>${__('Reference', 'bulk-sms-portal')}</dt><dd class="bx-mono">${esc(x.reference || '')}</dd></div></dl>
      ${approve ? `<p>${__('Only approve once you can see the money in your bank account. The amount is added to the customer\'s wallet straight away.', 'bulk-sms-portal')}</p>` : `<p>${__('The customer sees your reason on their Buy SMS page.', 'bulk-sms-portal')}</p>`}
      ${fieldHtml('bx-pay-note', approve ? __('Note for your records', 'bulk-sms-portal') : __('Reason', 'bulk-sms-portal'), '', { textarea: true, rows: 2, optional: approve, placeholder: approve ? '' : __('For example: we could not find this payment in our account', 'bulk-sms-portal') })}
      <div data-bx-pay-msg aria-live="polite"></div></div>
      <div class="bx-dialog-actions"><button class="bx-btn" value="cancel">${__('Cancel', 'bulk-sms-portal')}</button><button class="bx-btn ${approve ? 'is-primary' : 'is-danger'}" data-bx-pay-go>${approve ? __('Approve and add ', 'bulk-sms-portal') + esc(naira(x.amount_kobo)) : __('Decline payment', 'bulk-sms-portal')}</button></div></form>`, d => {
      $('[data-bx-pay-go]', d).onclick = async (e) => {
        e.preventDefault();
        const noteText = val(d, 'bx-pay-note').trim();
        if (!approve && !noteText) { $('[data-bx-pay-msg]', d).innerHTML = note('bad', __('Add a reason for the customer', 'bulk-sms-portal')); return; }
        const done = busy(e.currentTarget, approve ? __('Approving…', 'bulk-sms-portal') : __('Declining…', 'bulk-sms-portal'));
        const r = await C.api(`/admin/funding-requests/${x.id}/${action}`, { method: 'POST', body: JSON.stringify({ admin_note: noteText }) });
        done();
        if (r && r.ok) { d.close(); toast(approve ? `${sprintf(/* translators: %1$s, %2$s: values filled in when shown */ __('Approved. %1$s added to %2$s\'s wallet.', 'bulk-sms-portal'), naira(x.amount_kobo), x.user_name || __('the customer', 'bulk-sms-portal'))}` : __('Payment declined.', 'bulk-sms-portal')); adSummary(true); draw(st.page); }
        else $('[data-bx-pay-msg]', d).innerHTML = note('bad', __('Not done', 'bulk-sms-portal'), esc(friendly(r)));
      };
    });
  }
  draw(st.page);
});


/* ---- 140-admin-services.js ---- */
/* ==========================================================================
   SMS Services (the companies that deliver messages)
   ========================================================================== */
const SVC_TYPES = [['generic_get', __('Web address (GET)', 'bulk-sms-portal')], ['generic_post_form', __('Form (POST)', 'bulk-sms-portal')], ['generic_json', 'JSON (POST)']];
/* NewBulkSMS, ready-made: only the API key is needed. */
const NEWBULKSMS_PRESET = {
  name: 'NewBulkSMS', provider_preset: 'generic_get', route: 'normal', active: 1, api_username: 'apikey',
  send_url: 'https://newbulksms.com/api/send?sender=@@sender@@&recipients=@@recipient@@&message=@@message@@',
  auth_headers_text: 'Authorization: Bearer @@password@@',
  success_pattern: 'NS1000', failure_pattern: 'FAILED|NS2001|NS2002|NS2003|NS2004|NS2005|NS2008|NS2010|NS3001|NS9000',
  code_pattern: '/"code":"(NS\\d{4})"/', message_id_pattern: '',
  error_code_map: 'NS2001=Wrong API key\nNS2002=Sender name not approved on NewBulkSMS\nNS2003=Invalid phone number\nNS2004=Empty message\nNS2005=Not enough balance on NewBulkSMS\nNS2008=Too many requests\nNS2010=API access not enabled\nNS3001=Message failed\nNS9000=NewBulkSMS service error',
  balance_url: 'https://newbulksms.com/api/balance', balance_pattern: 'balance',
  dlr_lookup_url: 'https://newbulksms.com/api/status?messageid=@@message_id@@', dlr_status_pattern: 'code', dlr_success_codes: 'NS1001', dlr_failure_codes: 'NS3001'
};
adminPage('admin-apis', 'SMS Services', async (host, ctx) => {
  const root = mount(host, `
    ${pageHead(__('SMS Service', 'bulk-sms-portal'), __('The service that delivers your customers\' messages: standard, Do Not Disturb and international. Check its balance and send a test here.', 'bulk-sms-portal'))}
    <div data-bx-svc>${skeleton(6)}</div>`);
  async function reload() {
    const [ar, br, dr] = await Promise.all([C.api('/admin/apis?per_page=100'), C.api('/admin/api-balances'), C.api('/admin/dlr/diagnostics')]);
    if (!ctx.live()) return;
    const box = $('[data-bx-svc]', root);
    if (!ar || !ar.ok) { box.innerHTML = note('bad', __('We could not load your SMS service', 'bulk-sms-portal'), esc(friendly(ar))); return; }
    const all = ar.items || [], bal = {};
    const main = all.find(a => Number(a.is_main)) || all[0] || null;
    ((br && br.ok && br.items) || []).forEach(x => { bal[x.id] = x; });
    const hooks = {}; ((dr && dr.ok && dr.provider_webhook_urls) || []).forEach(x => { hooks[x.api_id] = x.url; });
    APP._svcHooks = hooks;
    const others = main ? all.length - 1 : 0;
    let list;
    if (main) {
      const b = bal[main.id] || {}; const bv = String(b.balance || '').trim(); const has = bv && !/not available/i.test(bv);
      list = `<div class="bx-list"><div class="bx-tr" style="--cols:minmax(0,2fr) 90px 140px 330px">
          <span class="bx-td-main bx-td-lead"><strong>${esc(main.name)}</strong><small>${__('Sends every message', 'bulk-sms-portal')}</small></span>
          <span data-label="${esc(__('Status', 'bulk-sms-portal'))}">${pill(Number(main.active) ? 'good' : 'info', Number(main.active) ? __('On', 'bulk-sms-portal') : __('Off', 'bulk-sms-portal'))}</span>
          <span data-label="${esc(__('Balance', 'bulk-sms-portal'))}">${has ? `<b class="bx-num">${esc(bv)}</b>` : `<span class="bx-muted">${__('Not shared', 'bulk-sms-portal')}</span>`}</span>
          <span class="bx-row-flex bx-td-actions">${btn(__('Edit', 'bulk-sms-portal'), `data-bx-svc-edit="${main.id}"`, 'is-small')}${btn(__('Send a test', 'bulk-sms-portal'), `data-bx-svc-test="${main.id}"`, 'is-small is-quiet')}${btn(__('Balance', 'bulk-sms-portal'), `data-bx-svc-bal="${main.id}"`, 'is-small is-quiet')}</span>
        </div></div>${others ? `<p class="bx-small bx-muted bx-mt-s">${sprintf(/* translators: %s: a number */ _n('%s other saved service is kept but not used.', '%s other saved services are kept but not used.', others, 'bulk-sms-portal'), num(others))}</p>` : ''}`;
    } else {
      list = `<div class="bx-choices">
          <button type="button" class="bx-choice" data-bx-svc-nbs><strong>${__('Use NewBulkSMS', 'bulk-sms-portal')}</strong><span>${__('Ready-made. Paste the API key from your NewBulkSMS account and you are set.', 'bulk-sms-portal')}</span></button>
          <button type="button" class="bx-choice" data-bx-svc-new><strong>${__('Use another SMS service', 'bulk-sms-portal')}</strong><span>${__('Enter the web address and sign-in details your SMS company gave you.', 'bulk-sms-portal')}</span></button>
        </div>`;
    }
    box.innerHTML = `
      <section class="bx-section" aria-labelledby="bx-svc-list">
        <div class="bx-section-head"><h2 id="bx-svc-list">${main ? __('Your SMS service', 'bulk-sms-portal') : __('Connect an SMS service', 'bulk-sms-portal')}</h2></div>
        ${list}
      </section>
      ${dr && dr.ok && main ? `<section class="bx-section bx-panel" aria-labelledby="bx-svc-dlr"><div class="bx-panel-head"><div><h2 id="bx-svc-dlr">${__('Delivery results', 'bulk-sms-portal')}</h2><p>${__('How we find out whether each message reached the phone.', 'bulk-sms-portal')}</p></div>${btn(icon('refresh', 16) + __('Check results now', 'bulk-sms-portal'), 'data-bx-dlr-sync', 'is-small')}</div>
        <dl class="bx-kv"><div><dt>${__('Messages still waiting for a result', 'bulk-sms-portal')}</dt><dd>${num(dr.pending_dlr)}</dd></div><div><dt>${__('Automatic checking', 'bulk-sms-portal')}</dt><dd>${dr.cron_scheduled ? __('On', 'bulk-sms-portal') : __('Off', 'bulk-sms-portal')}</dd></div></dl>
      </section>` : ''}`;
    const nw = $('[data-bx-svc-new]', box); if (nw) nw.onclick = () => serviceEditor(null, reload);
    const nb = $('[data-bx-svc-nbs]', box); if (nb) nb.onclick = () => serviceEditor(Object.assign({}, NEWBULKSMS_PRESET), reload, true);
    $$('[data-bx-svc-edit]', box).forEach(b => b.onclick = () => serviceEditor(all.find(a => String(a.id) === b.dataset.bxSvcEdit), reload));
    $$('[data-bx-svc-bal]', box).forEach(b => b.onclick = async () => {
      const done = busy(b, __('Checking…', 'bulk-sms-portal'));
      const r = await C.api('/admin/apis/' + b.dataset.bxSvcBal + '/test-balance', { method: 'POST', body: '{}' });
      done(); showReply(__('Balance check', 'bulk-sms-portal'), r);
    });
    $$('[data-bx-svc-test]', box).forEach(b => b.onclick = () => testSend(all.find(a => String(a.id) === b.dataset.bxSvcTest)));
    const sy = $('[data-bx-dlr-sync]', box); if (sy) sy.onclick = async () => { const done = busy(sy, __('Checking…', 'bulk-sms-portal')); const r = await C.api('/admin/dlr/sync', { method: 'POST', body: '{}', timeout: 60000 }); done(); toast(r && r.ok ? __('Results checked.', 'bulk-sms-portal') : friendly(r, __('Could not check results.', 'bulk-sms-portal')), r && r.ok ? '' : 'bad'); if (r && r.ok) reload(); };
  }
  reload();
});

/* Shows a service's reply. Admins need the exact reply to fix set-up problems. */
function showReply(title, r) {
  const ok = r && r.ok;
  const raw = r ? (r.raw_response || r.raw || r.response || r.body || '') : '';
  const facts = r ? [[__('Reference from the service', 'bulk-sms-portal'), r.provider_message_id], [__('Service reply code', 'bulk-sms-portal'), r.provider_code], [__('Web reply code', 'bulk-sms-portal'), r.http_code], [__('What to check', 'bulk-sms-portal'), r.transport_help]].filter(x => x[1]) : [];
  openDialog(`<div class="bx-dialog-body"><h2>${esc(title)}</h2>${note(ok ? 'good' : 'bad', ok ? __('The service replied', 'bulk-sms-portal') : __('Something is not right', 'bulk-sms-portal'), esc(ok ? (r.message || (r.balance ? __('Balance: ', 'bulk-sms-portal') + r.balance : __('Done.', 'bulk-sms-portal'))) : friendly(r, __('The service did not accept the request.', 'bulk-sms-portal'))))}
    ${facts.length ? `<dl class="bx-kv">${facts.map(f => `<div><dt>${esc(f[0])}</dt><dd>${esc(f[1])}</dd></div>`).join('')}</dl>` : ''}
    ${raw ? `<div class="bx-admin-box"><strong>${__('Reply from the service', 'bulk-sms-portal')}</strong><pre class="bx-mono bx-break">${esc(typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2))}</pre></div>` : ''}</div><div class="bx-dialog-actions"><button type="button" class="bx-btn is-primary" data-bx-close>${__('Close', 'bulk-sms-portal')}</button></div>`, d => { $('[data-bx-close]', d).onclick = () => d.close(); });
}
function testSend(a) {
  if (!a) return;
  openDialog(`<form method="dialog" novalidate><div class="bx-dialog-body"><h2>${sprintf(/* translators: %s: a value filled in when shown */ __('Send a test with %s', 'bulk-sms-portal'), esc(a.name))}</h2><p>${__('A real SMS is sent to the number you enter. Your wallet is not charged.', 'bulk-sms-portal')}</p>
    ${fieldHtml('bx-ts-to', __('Phone number', 'bulk-sms-portal'), '', { attrs: 'inputmode="tel"', placeholder: '08031234567' })}
    ${fieldHtml('bx-ts-msg', __('Message', 'bulk-sms-portal'), __('Test message from ', 'bulk-sms-portal') + (CFG.brand || __('our SMS platform', 'bulk-sms-portal')), { textarea: true, rows: 2 })}
    ${fieldHtml('bx-ts-from', __('Sender name', 'bulk-sms-portal'), S().default_sender || 'SMS', { attrs: 'maxlength="11"' })}
    <div data-bx-ts-msg></div></div><div class="bx-dialog-actions"><button class="bx-btn" value="cancel">${__('Cancel', 'bulk-sms-portal')}</button><button class="bx-btn is-primary" data-bx-ts-go>${sprintf(/* translators: %s: a value filled in when shown */ __('%sSend test', 'bulk-sms-portal'), icon('send', 18))}</button></div></form>`, d => {
    $('#bx-ts-to', d).focus();
    $('[data-bx-ts-go]', d).onclick = async (e) => {
      e.preventDefault();
      const to = val(d, 'bx-ts-to').trim();
      if (!to) { $('[data-bx-ts-msg]', d).innerHTML = note('bad', __('Enter a phone number', 'bulk-sms-portal')); return; }
      const done = busy(e.currentTarget, __('Sending…', 'bulk-sms-portal'));
      const r = await C.api('/admin/apis/' + a.id + '/test-send', { method: 'POST', body: JSON.stringify({ recipient: to, message: val(d, 'bx-ts-msg'), sender: val(d, 'bx-ts-from') }), timeout: 30000 });
      done(); d.close(); showReply(__('Test result', 'bulk-sms-portal'), r);
    };
  });
}
function serviceEditor(a, onSaved, preset = false) {
  const isNew = !a || preset; a = a || { provider_preset: 'generic_get', route: 'normal', active: 1 };
  const hook = a.id && APP._svcHooks ? APP._svcHooks[a.id] : '';
  openDialog(`<form method="dialog" novalidate><div class="bx-dialog-body">
    <h2>${isNew ? __('Add an SMS service', 'bulk-sms-portal') : __('Edit ', 'bulk-sms-portal') + esc(a.name)}</h2>
    ${preset ? note('info', __('Almost done', 'bulk-sms-portal'), __('Sign in at newbulksms.com, open API, create an API key and paste it in “Password or key” below. Everything else is filled in.', 'bulk-sms-portal')) : ''}
    <p class="bx-small bx-muted">${__('Copy these details from your SMS service\'s own guide. In web addresses you can use @@username@@, @@password@@, @@sender@@, @@recipient@@ and @@message@@; we fill them in for each message.', 'bulk-sms-portal')}</p>
    ${tabs([['basic', __('Basics', 'bulk-sms-portal')], ['send', __('Sending', 'bulk-sms-portal')], ['reply', __('Reading replies', 'bulk-sms-portal')], ['balance', __('Balance', 'bulk-sms-portal')], ['results', __('Delivery results', 'bulk-sms-portal')]], 'basic')}
    <div data-bx-se-pane="basic" class="bx-fields bx-mt-m">
      ${fieldHtml('se-name', __('Name', 'bulk-sms-portal'), a.name || '', { placeholder: __('For example: Main SMS service', 'bulk-sms-portal') })}
      ${fieldHtml('se-preset', __('How it connects', 'bulk-sms-portal'), a.provider_preset || 'generic_get', { options: SVC_TYPES, hint: __('From the service\'s guide. Most use a web address (GET).', 'bulk-sms-portal') })}
      ${window.wp && wp.hooks ? wp.hooks.applyFilters('bsms.serviceRouteField', '', a) : ''}
      <label class="bx-check is-wide"><input type="checkbox" id="se-active" ${Number(a.active ?? 1) ? 'checked' : ''}><span><strong>${__('Switched on', 'bulk-sms-portal')}</strong><br><span class="bx-small bx-muted">${__('When off, nothing is sent through this service.', 'bulk-sms-portal')}</span></span></label>
      ${fieldHtml('se-user', __('Username', 'bulk-sms-portal'), a.api_username || '', { attrs: 'autocomplete="off"' })}
      ${fieldHtml('se-pass', __('Password or key', 'bulk-sms-portal'), '', { type: 'password', attrs: 'autocomplete="new-password"', hint: a.has_api_password ? __('Saved. Leave blank to keep it.', 'bulk-sms-portal') : (preset ? __('Your NewBulkSMS API key.', 'bulk-sms-portal') : __('Leave blank if not needed.', 'bulk-sms-portal')) })}
    </div>
    <div data-bx-se-pane="send" class="bx-stack is-tight bx-mt-m" hidden>
      ${fieldHtml('se-send', __('Sending web address', 'bulk-sms-portal'), a.send_url || '', { mono: true, textarea: true, rows: 3, placeholder: 'https://…?username=@@username@@&password=@@password@@&sender=@@sender@@&to=@@recipient@@&message=@@message@@' })}
      ${fieldHtml('se-payload', __('Message body', 'bulk-sms-portal'), a.payload_template || '', { mono: true, textarea: true, rows: 4, optional: true, hint: __('Only for Form or JSON services. Leave blank for a web address service.', 'bulk-sms-portal') })}
      ${fieldHtml('se-extra', __('Extra settings to send', 'bulk-sms-portal'), a.extra_query || '', { mono: true, textarea: true, rows: 2, optional: true, hint: __('One per line, as name=value.', 'bulk-sms-portal') })}
      ${fieldHtml('se-headers', __('Extra sign-in headers', 'bulk-sms-portal'), a.auth_headers_text || '', { mono: true, textarea: true, rows: 2, optional: true, hint: a.has_auth_headers ? __('Saved headers are kept unless you type new ones.', 'bulk-sms-portal') : __('One per line, as Name: value.', 'bulk-sms-portal') })}
    </div>
    <div data-bx-se-pane="reply" class="bx-fields bx-mt-m" hidden>
      ${fieldHtml('se-ok', __('Words or codes that mean “accepted”', 'bulk-sms-portal'), a.success_pattern || '', { mono: true, hint: __('Separate with |, for example: 1701|OK', 'bulk-sms-portal') })}
      ${fieldHtml('se-bad', __('Words or codes that mean “refused”', 'bulk-sms-portal'), a.failure_pattern || '', { mono: true, hint: __('For example: 1704|error', 'bulk-sms-portal') })}
      ${fieldHtml('se-code', __('Where the reply code is', 'bulk-sms-portal'), a.code_pattern || '', { mono: true, optional: true, hint: __('A pattern; leave as it is unless the guide says otherwise.', 'bulk-sms-portal') })}
      ${fieldHtml('se-msgid', __('Where the message number is', 'bulk-sms-portal'), a.message_id_pattern || '', { mono: true, optional: true })}
      ${fieldHtml('se-map', __('What each code means', 'bulk-sms-portal'), a.error_code_map || '', { mono: true, textarea: true, rows: 4, optional: true, wide: true, hint: __('One per line, as code=meaning. Shown to admins in Message History.', 'bulk-sms-portal') })}
    </div>
    <div data-bx-se-pane="balance" class="bx-stack is-tight bx-mt-m" hidden>
      ${fieldHtml('se-balurl', __('Balance web address', 'bulk-sms-portal'), a.balance_url || '', { mono: true, textarea: true, rows: 2, optional: true })}
      ${fieldHtml('se-balpat', __('Where the balance is in the reply', 'bulk-sms-portal'), a.balance_pattern || '', { mono: true, optional: true })}
    </div>
    <div data-bx-se-pane="results" class="bx-stack is-tight bx-mt-m" hidden>
      ${hook ? `<div class="bx-field"><span class="bx-label">${__('Give this address to the service for delivery results', 'bulk-sms-portal')}</span><div class="bx-copy"><span class="bx-mono">${esc(hook)}</span><button type="button" class="bx-btn is-small" data-bx-copy="${esc(hook)}">${sprintf(/* translators: %s: a value filled in when shown */ __('%sCopy', 'bulk-sms-portal'), icon('copy', 16))}</button></div><span class="bx-hint">${__('The service calls it when a message is delivered or fails. Keep it private.', 'bulk-sms-portal')}</span></div>` : `<p class="bx-small bx-muted">${__('Save the service first to get the address it should send delivery results to.', 'bulk-sms-portal')}</p>`}
      ${fieldHtml('se-dlrurl', __('Or: web address to look up a result', 'bulk-sms-portal'), a.dlr_lookup_url || '', { mono: true, textarea: true, rows: 2, optional: true, hint: __('Use @@message_id@@ for the message number.', 'bulk-sms-portal') })}
      <div class="bx-fields">
        ${fieldHtml('se-dlrpat', __('Where the result is in the reply', 'bulk-sms-portal'), a.dlr_status_pattern || '', { mono: true, optional: true })}
        ${fieldHtml('se-dlrok', __('Codes that mean delivered', 'bulk-sms-portal'), a.dlr_success_codes || '', { mono: true, optional: true })}
        ${fieldHtml('se-dlrbad', __('Codes that mean failed', 'bulk-sms-portal'), a.dlr_failure_codes || '', { mono: true, optional: true })}
      </div>
    </div>
    <div data-bx-se-msg aria-live="polite"></div>
  </div><div class="bx-dialog-actions">${isNew ? '' : `<button type="button" class="bx-btn is-danger" data-bx-se-del>${__('Delete', 'bulk-sms-portal')}</button>`}<button class="bx-btn" value="cancel">${__('Cancel', 'bulk-sms-portal')}</button><button class="bx-btn is-primary" data-bx-se-save>${isNew ? __('Add service', 'bulk-sms-portal') : __('Save changes', 'bulk-sms-portal')}</button></div></form>`, d => {
    d.classList.add('is-wide');
    bindCopy(d);
    $$('[data-bx-tab]', d).forEach(b => b.onclick = () => { $$('[data-bx-tab]', d).forEach(x => x.setAttribute('aria-selected', x === b ? 'true' : 'false')); $$('[data-bx-se-pane]', d).forEach(p => p.hidden = p.dataset.bxSePane !== b.dataset.bxTab); });
    const msg = $('[data-bx-se-msg]', d);
    $('[data-bx-se-save]', d).onclick = async (e) => {
      e.preventDefault();
      if (!val(d, 'se-name').trim() || !val(d, 'se-send').trim()) { msg.innerHTML = note('bad', __('Add a name and the sending web address', 'bulk-sms-portal')); return; }
      const body = {
        id: a.id || '', name: val(d, 'se-name').trim(), provider_preset: val(d, 'se-preset'), assigned_route: $('#se-route', d) ? val(d, 'se-route') : 'normal', is_active: val(d, 'se-active') ? 1 : 0,
        api_username: val(d, 'se-user'), api_password: val(d, 'se-pass'), send_url: val(d, 'se-send').trim(), payload_template: val(d, 'se-payload'), extra_query: val(d, 'se-extra'), auth_headers: val(d, 'se-headers'),
        success_pattern: val(d, 'se-ok'), failure_pattern: val(d, 'se-bad'), code_pattern: val(d, 'se-code'), message_id_pattern: val(d, 'se-msgid'), error_code_map: val(d, 'se-map'),
        balance_url: val(d, 'se-balurl').trim(), balance_pattern: val(d, 'se-balpat'), dlr_lookup_url: val(d, 'se-dlrurl').trim(), dlr_status_pattern: val(d, 'se-dlrpat'), dlr_success_codes: val(d, 'se-dlrok'), dlr_failure_codes: val(d, 'se-dlrbad')
      };
      const p = body.provider_preset; body.method = p === 'generic_get' ? 'GET' : 'POST'; body.request_format = p === 'generic_json' ? 'json' : 'form';
      const done = busy(e.currentTarget, __('Saving…', 'bulk-sms-portal'));
      const r = await C.api('/admin/apis', { method: 'POST', body: JSON.stringify(body) });
      done();
      if (r && r.ok) { d.close(); toast(isNew ? __('SMS service added.', 'bulk-sms-portal') : __('Changes saved.', 'bulk-sms-portal')); onSaved(); } else msg.innerHTML = note('bad', __('Not saved', 'bulk-sms-portal'), esc(friendly(r)));
    };
    const del = $('[data-bx-se-del]', d);
    if (del) del.onclick = async () => {
      if (!await confirmBox({ title: `${sprintf(/* translators: %s: a value filled in when shown */ __('Delete %s?', 'bulk-sms-portal'), a.name)}`, body: `<p>${__('Messages will no longer go through this service. Messages already sent are not affected.', 'bulk-sms-portal')}</p>`, confirm: __('Delete service', 'bulk-sms-portal'), danger: true })) return;
      const r = await C.api('/admin/apis/' + a.id, { method: 'DELETE' });
      if (r && r.ok) { d.close(); toast(__('SMS service deleted.', 'bulk-sms-portal')); onSaved(); } else msg.innerHTML = note('bad', __('Not deleted', 'bulk-sms-portal'), esc(friendly(r)));
    };
  });
}


/* ---- 150-admin-pricing.js ---- */
/* ==========================================================================
   Pricing Manager (v3.6.2)
   One price list. A number is charged the price of the longest matching
   prefix (a special price, then its network), otherwise its country's price.
   No quantity bands. Countries not in the list are not sent and not charged.
   The page edits a draft of the whole list and saves it in one go.
   ========================================================================== */
const NETWORK_CHOICES = ['MTN', __('Airtel', 'bulk-sms-portal'), __('Glo', 'bulk-sms-portal'), '9mobile'];
const pmNaira = k => (Number(k) ? (Number(k) / 100).toString() : '');
const pmKobo = v => { const n = Number(String(v || '').replace(/[,₦\s]/g, '')); return n > 0 ? Math.round(n * 100) : 0; };

adminPage('admin-pricing', 'Pricing Manager', async (host, ctx) => {
  const root = mount(host, `
    ${pageHead(__('Pricing Manager', 'bulk-sms-portal'), __('Customers pay into a wallet, and every SMS page they send is charged the price of the network it goes to. The price is the same for any size of send. A country that is not in this list is not sent to and not charged.', 'bulk-sms-portal'), btn(__('See what customers see', 'bulk-sms-portal'), 'data-bx-go="pricing"', 'is-quiet'))}
    <div data-bx-pm>${skeleton(8)}</div>`);
  bindGo(root);
  const r = await C.api('/admin/price-list');
  if (!ctx.live()) return;
  const box = $('[data-bx-pm]', root);
  if (!r || !r.ok) { box.innerHTML = note('bad', __('We could not load prices', 'bulk-sms-portal'), esc(friendly(r))); return; }

  const names = r.country_names || {};
  const nameOf = cc => names[String(cc)] || ('+' + cc);
  const known = r.nigeria_networks || {};
  let notes = r.notes || [];
  let saved = JSON.stringify(r.list);
  let draft = JSON.parse(saved);
  const ng = () => draft.find(c => String(c.code) === '234');
  const dirty = () => JSON.stringify(draft) !== saved;

  function money(k, empty = '—') { return Number(k) ? esc(naira(k)) : `<span class="bx-muted">${empty}</span>`; }
  function prefixList(cc, list, max = 8) {
    const l = (list || []).map(p => prefixLabel(cc, p));
    return esc(l.slice(0, max).join(', ') + (l.length > max ? ` ${sprintf(/* translators: %s: a value filled in when shown */ __('and %s more', 'bulk-sms-portal'), l.length - max)}` : ''));
  }

  function draw() {
    const n = ng();
    const others = draft.filter(c => String(c.code) !== '234');
    const nets = [...(n.networks || [])].sort((a, b) => (NETWORK_CHOICES.indexOf(a.name) + 1 || 99) - (NETWORK_CHOICES.indexOf(b.name) + 1 || 99));
    const cols = '1.6fr 0.9fr 0.9fr 150px';
    box.innerHTML = `
      ${notes.length ? note('info', __('Your prices were moved to the new rule', 'bulk-sms-portal'), notes.map(x => esc(x)).join('<br>') + `<br><span class="bx-small bx-muted">${__('This note goes away the next time you save prices.', 'bulk-sms-portal')}</span>`) : ''}
      <div class="bx-savebar" data-bx-pm-bar ${dirty() ? '' : 'hidden'}><span>${sprintf(/* translators: %s: a value filled in when shown */ __('%sYou have changes that are not saved yet.', 'bulk-sms-portal'), icon('alert', 18))}</span><span class="bx-row-flex">${btn(__('Undo changes', 'bulk-sms-portal'), 'data-bx-pm-undo', 'is-small is-quiet')}${btn(__('Save prices', 'bulk-sms-portal'), 'data-bx-pm-save', 'is-small is-primary')}</span></div>

      <section class="bx-section" aria-labelledby="bx-pm-ng">
        <div class="bx-section-head"><div><h2 id="bx-pm-ng">${__('Nigeria', 'bulk-sms-portal')}</h2><p>${__('Each network can have its own price. A number on a network with no price of its own is charged the Nigeria price.', 'bulk-sms-portal')}</p></div>${btn(icon('plus', 16) + __('Add a network', 'bulk-sms-portal'), 'data-bx-pm-net-add', 'is-small is-primary')}</div>
        <div class="bx-list">
          <div class="bx-tr is-head" style="--cols:${cols}"><span>${__('Who it applies to', 'bulk-sms-portal')}</span><span class="is-num">${__('Standard', 'bulk-sms-portal')}</span><span class="is-num">${__('Do Not Disturb', 'bulk-sms-portal')}</span><span></span></div>
          <div class="bx-tr is-key" style="--cols:${cols}"><span class="bx-td-main bx-td-lead" data-label="${esc(__('Who it applies to', 'bulk-sms-portal'))}"><strong>${__('Nigeria price', 'bulk-sms-portal')}</strong><small>${__('Any Nigerian number whose network has no price of its own', 'bulk-sms-portal')}</small></span><span class="is-num" data-label="${esc(__('Standard', 'bulk-sms-portal'))}"><b>${money(n.standard_kobo, __('Not set', 'bulk-sms-portal'))}</b></span><span class="is-num" data-label="${esc(__('Do Not Disturb', 'bulk-sms-portal'))}">${money(n.dnd_kobo, __('Not offered', 'bulk-sms-portal'))}</span><span class="bx-td-actions">${btn(__('Change', 'bulk-sms-portal'), 'data-bx-pm-ng', 'is-small')}</span></div>
          ${nets.map(x => `<div class="bx-tr" style="--cols:${cols}"><span class="bx-td-main bx-td-lead" data-label="${esc(__('Who it applies to', 'bulk-sms-portal'))}"><strong>${esc(x.name)}</strong><small>${prefixList('234', x.prefixes)}</small></span><span class="is-num" data-label="${esc(__('Standard', 'bulk-sms-portal'))}">${money(x.standard_kobo, __('Nigeria price', 'bulk-sms-portal'))}</span><span class="is-num" data-label="${esc(__('Do Not Disturb', 'bulk-sms-portal'))}">${money(x.dnd_kobo, n.dnd_kobo ? __('Nigeria price', 'bulk-sms-portal') : __('Not offered', 'bulk-sms-portal'))}</span><span class="bx-row-flex bx-td-actions">${btn(__('Edit', 'bulk-sms-portal'), `data-bx-pm-net="${esc(x.name)}"`, 'is-small')}${btn(icon('trash', 16) + `<span class="bx-sr">${__('Remove', 'bulk-sms-portal')}</span>`, `data-bx-pm-net-del="${esc(x.name)}" aria-label="${sprintf(/* translators: %s: a value filled in when shown */ esc(__('Remove %s', 'bulk-sms-portal')), esc(x.name))}"`, 'is-small is-quiet')}</span></div>`).join('')}
          ${(n.prefixes || []).map((x, i) => `<div class="bx-tr" style="--cols:${cols}"><span class="bx-td-main bx-td-lead" data-label="${esc(__('Who it applies to', 'bulk-sms-portal'))}"><strong>${sprintf(/* translators: %s: a value filled in when shown */ __('Numbers starting %s', 'bulk-sms-portal'), esc(prefixLabel('234', x.prefixes[0])))}</strong><small>${__('Special price: beats the network price', 'bulk-sms-portal')}</small></span><span class="is-num" data-label="${esc(__('Standard', 'bulk-sms-portal'))}">${money(x.standard_kobo, __('Network price', 'bulk-sms-portal'))}</span><span class="is-num" data-label="${esc(__('Do Not Disturb', 'bulk-sms-portal'))}">${money(x.dnd_kobo, __('Network price', 'bulk-sms-portal'))}</span><span class="bx-row-flex bx-td-actions">${btn(__('Edit', 'bulk-sms-portal'), `data-bx-pm-sp="${i}"`, 'is-small')}${btn(icon('trash', 16) + `<span class="bx-sr">${__('Remove', 'bulk-sms-portal')}</span>`, `data-bx-pm-sp-del="${i}" aria-label="${esc(__('Remove special price', 'bulk-sms-portal'))}"`, 'is-small is-quiet')}</span></div>`).join('')}
        </div>
        <p class="bx-mt-s">${btn(icon('plus', 16) + __('Add a special price for one prefix', 'bulk-sms-portal'), 'data-bx-pm-sp-add', 'is-small is-quiet')}</p>
      </section>

      <section class="bx-section" aria-labelledby="bx-pm-intl">
        <div class="bx-section-head"><div><h2 id="bx-pm-intl">${__('Other countries', 'bulk-sms-portal')}</h2><p>${__('Only countries in this list can be sent to. Customers type these numbers with the country code.', 'bulk-sms-portal')}</p></div>${btn(icon('plus', 16) + __('Add a country', 'bulk-sms-portal'), 'data-bx-pm-cc-add', 'is-small is-primary')}</div>
        ${r.international_ready ? '' : note('wait', __('Sending outside Nigeria is off', 'bulk-sms-portal'), __('No SMS service is chosen for numbers outside Nigeria, so they are left out of every send and not charged, even when they have a price here.', 'bulk-sms-portal'), btn(__('Choose a service', 'bulk-sms-portal'), 'data-bx-go="admin-apis"', 'is-small'))}
        ${others.length ? `<div class="bx-list bx-mt-s"><div class="bx-tr is-head" style="--cols:1.6fr 0.9fr 150px"><span>${__('Country', 'bulk-sms-portal')}</span><span class="is-num">${__('Price per SMS page', 'bulk-sms-portal')}</span><span></span></div>
          ${others.map(c => `<div class="bx-tr" style="--cols:1.6fr 0.9fr 150px"><span class="bx-td-main bx-td-lead" data-label="${esc(__('Country', 'bulk-sms-portal'))}"><strong>${esc(nameOf(c.code))}</strong><small>+${esc(c.code)}${(c.networks || []).length || (c.prefixes || []).length ? ` · ${sprintf(/* translators: %s: a number */ _n('%s own price', '%s own prices', Number((c.networks || []).length + (c.prefixes || []).length), 'bulk-sms-portal'), num((c.networks || []).length + (c.prefixes || []).length))}` : ''}</small></span><span class="is-num" data-label="${esc(__('Price per SMS page', 'bulk-sms-portal'))}"><b>${money(c.standard_kobo)}</b></span><span class="bx-row-flex bx-td-actions">${btn(__('Edit', 'bulk-sms-portal'), `data-bx-pm-cc="${esc(c.code)}"`, 'is-small')}${btn(icon('trash', 16) + `<span class="bx-sr">${__('Remove', 'bulk-sms-portal')}</span>`, `data-bx-pm-cc-del="${esc(c.code)}" aria-label="${sprintf(/* translators: %s: a value filled in when shown */ esc(__('Remove %s', 'bulk-sms-portal')), esc(nameOf(c.code)))}"`, 'is-small is-quiet')}</span></div>`).join('')}</div>`
          : `<div class="bx-list bx-mt-s">${empty('globe', __('No other countries', 'bulk-sms-portal'), __('Add a country, for example 229 for Benin or 233 for Ghana.', 'bulk-sms-portal'))}</div>`}
      </section>

      <section class="bx-section bx-panel" aria-labelledby="bx-pm-try">
        <div class="bx-panel-head"><div><h2 id="bx-pm-try">${__('Check a number', 'bulk-sms-portal')}</h2><p>${sprintf(/* translators: %s: a value filled in when shown */ __('What one SMS page to this number costs with the prices on this page%s.', 'bulk-sms-portal'), dirty() ? __(', including changes not saved yet', 'bulk-sms-portal') : '')}</p></div></div>
        <div class="bx-fields">${fieldHtml('pm-t-num', __('Phone number', 'bulk-sms-portal'), '', { type: 'tel', placeholder: '0803 123 4567 or +233 24 123 4567' })}${fieldHtml('pm-t-route', __('Delivery', 'bulk-sms-portal'), 'std', { options: [['std', __('Standard', 'bulk-sms-portal')], ['dnd', __('Reach Do Not Disturb numbers', 'bulk-sms-portal')]] })}</div>
        <div class="bx-mt-s" data-bx-pm-out aria-live="polite"></div>
      </section>`;
    bindGo(box);
    bind();
    tryIt();
  }

  function tryIt() {
    const out = $('[data-bx-pm-out]', box); if (!out) return;
    const v = val(box, 'pm-t-num');
    if (phoneDigits(v).length < 10) { out.innerHTML = ''; return; }
    const q = quoteFrom(draft, v, val(box, 'pm-t-route') === 'dnd');
    if (!q || q.price === null) { out.innerHTML = note('wait', __('Not sent and not charged', 'bulk-sms-portal'), q && q.reason === 'no_dnd_price' ? __('No Do Not Disturb price is set.', 'bulk-sms-portal') : __('This country is not in the price list.', 'bulk-sms-portal')); return; }
    const abroad = String(q.country.code) !== '234';
    const why = q.special ? `${sprintf(/* translators: %s: a value filled in when shown */ __('special price for %s', 'bulk-sms-portal'), prefixLabel('234', q.prefix))}` : (q.network ? `${q.network} price` : (abroad ? `${nameOf(q.country.code)} price` : __('Nigeria price', 'bulk-sms-portal')));
    out.innerHTML = abroad && !r.international_ready
      ? note('wait', `${sprintf(/* translators: %s: a value filled in when shown */ __('%s, but not sent for now', 'bulk-sms-portal'), esc(naira(q.price)))}`, __('Sending outside Nigeria is off until you choose a service for it.', 'bulk-sms-portal'))
      : note('good', `${sprintf(/* translators: %s: a value filled in when shown */ __('%s per SMS page', 'bulk-sms-portal'), esc(naira(q.price)))}`, `${sprintf(/* translators: %s: a value filled in when shown */ __('Uses the %s.', 'bulk-sms-portal'), esc(why))}`);
  }

  function changed() { draw(); }

  function bind() {
    const on = (sel, fn) => $$(sel, box).forEach(b => b.onclick = () => fn(b));
    ['pm-t-num', 'pm-t-route'].forEach(id => { const el = $('#' + id, box); if (el) { el.addEventListener('input', tryIt); el.addEventListener('change', tryIt); } });
    on('[data-bx-pm-ng]', () => countryEditor(ng(), true));
    on('[data-bx-pm-net-add]', () => entryEditor('234', 'network'));
    on('[data-bx-pm-net]', b => entryEditor('234', 'network', ng().networks.find(x => x.name === b.dataset.bxPmNet)));
    on('[data-bx-pm-net-del]', async b => {
      if (!await confirmBox({ title: `${sprintf(/* translators: %s: a value filled in when shown */ __('Remove %s?', 'bulk-sms-portal'), b.dataset.bxPmNetDel)}`, body: `<p>${__('Its numbers will be charged the Nigeria price. Nothing changes until you save prices.', 'bulk-sms-portal')}</p>`, confirm: __('Remove', 'bulk-sms-portal') })) return;
      ng().networks = ng().networks.filter(x => x.name !== b.dataset.bxPmNetDel); changed();
    });
    on('[data-bx-pm-sp-add]', () => entryEditor('234', 'prefix'));
    on('[data-bx-pm-sp]', b => entryEditor('234', 'prefix', ng().prefixes[Number(b.dataset.bxPmSp)]));
    on('[data-bx-pm-sp-del]', b => { ng().prefixes.splice(Number(b.dataset.bxPmSpDel), 1); changed(); });
    on('[data-bx-pm-cc-add]', () => countryEditor(null));
    on('[data-bx-pm-cc]', b => countryEditor(draft.find(c => String(c.code) === b.dataset.bxPmCc)));
    on('[data-bx-pm-cc-del]', async b => {
      if (!await confirmBox({ title: `${sprintf(/* translators: %s: a value filled in when shown */ __('Remove %s?', 'bulk-sms-portal'), nameOf(b.dataset.bxPmCcDel))}`, body: `<p>${__('Numbers in this country will not be sent or charged. Nothing changes until you save prices.', 'bulk-sms-portal')}</p>`, confirm: __('Remove', 'bulk-sms-portal') })) return;
      draft = draft.filter(c => String(c.code) !== b.dataset.bxPmCcDel); changed();
    });
    on('[data-bx-pm-undo]', () => { draft = JSON.parse(saved); changed(); });
    on('[data-bx-pm-save]', b => save(b));
  }

  async function save(b) {
    const body = draft.map(c => ({
      code: String(c.code), standard_naira: pmNaira(c.standard_kobo), dnd_naira: pmNaira(c.dnd_kobo),
      networks: (c.networks || []).map(x => ({ name: x.name, prefixes: x.prefixes, standard_naira: pmNaira(x.standard_kobo), dnd_naira: pmNaira(x.dnd_kobo) })),
      prefixes: (c.prefixes || []).map(x => ({ prefix: x.prefixes[0], standard_naira: pmNaira(x.standard_kobo), dnd_naira: pmNaira(x.dnd_kobo) }))
    }));
    const done = busy(b, __('Saving…', 'bulk-sms-portal'));
    const res = await C.api('/admin/price-list', { method: 'POST', body: JSON.stringify({ countries: body }) });
    done();
    if (!ctx.live()) return;
    if (res && res.ok) { saved = JSON.stringify(res.list); draft = JSON.parse(saved); notes = []; prices(true); toast(__('Prices saved. Customers are charged these prices from now on.', 'bulk-sms-portal')); draw(); }
    else toast(friendly(res, __('Prices were not saved.', 'bulk-sms-portal')), 'bad');
  }

  /* Country price (Nigeria: standard + Do Not Disturb; others: one price). */
  function countryEditor(c, isNg = false) {
    const fresh = !c;
    openDialog(`<form method="dialog" novalidate><div class="bx-dialog-body"><h2>${isNg ? __('Nigeria price', 'bulk-sms-portal') : (fresh ? __('Add a country', 'bulk-sms-portal') : esc(nameOf(c.code)))}</h2>
      ${isNg ? `<p class="bx-muted">${__('For any Nigerian number whose network has no price of its own.', 'bulk-sms-portal')}</p>` : ''}
      ${fresh ? fieldHtml('pm-cc', __('Country code', 'bulk-sms-portal'), '', { attrs: 'inputmode="numeric" maxlength="4"', placeholder: '229', hint: `<span data-bx-pm-ccname>${__('For example 229 for Benin, 233 for Ghana.', 'bulk-sms-portal')}</span>` }) : ''}
      <div class="bx-fields">
        <div class="bx-field"><label class="bx-label" for="pm-std">${__('Price per SMS page', 'bulk-sms-portal')}</label><div class="bx-money-input"><span aria-hidden="true">₦</span><input id="pm-std" type="number" min="0" step="0.01" value="${c ? pmNaira(c.standard_kobo) : ''}"></div></div>
        ${isNg ? `<div class="bx-field"><label class="bx-label" for="pm-dnd">${__('Do Not Disturb numbers', 'bulk-sms-portal')} <span class="bx-optional">${__('(optional)', 'bulk-sms-portal')}</span></label><div class="bx-money-input"><span aria-hidden="true">₦</span><input id="pm-dnd" type="number" min="0" step="0.01" value="${pmNaira(c.dnd_kobo)}"></div><span class="bx-hint">${__('Leave empty if you don’t offer it.', 'bulk-sms-portal')}</span></div>` : ''}
      </div>
      <div data-bx-pm-msg></div></div><div class="bx-dialog-actions"><button class="bx-btn" value="cancel">${__('Cancel', 'bulk-sms-portal')}</button><button class="bx-btn is-primary" data-bx-pm-ok>${fresh ? __('Add country', 'bulk-sms-portal') : __('Done', 'bulk-sms-portal')}</button></div></form>`, d => {
      const cc = $('#pm-cc', d);
      if (cc) cc.addEventListener('input', () => { const v = cc.value.replace(/\D+/g, ''); $('[data-bx-pm-ccname]', d).textContent = v ? (names[v] ? names[v] : __('Check the code: we don’t recognise it, but you can still use it.', 'bulk-sms-portal')) : __('For example 229 for Benin, 233 for Ghana.', 'bulk-sms-portal'); });
      $('[data-bx-pm-ok]', d).onclick = (e) => {
        e.preventDefault();
        const msg = $('[data-bx-pm-msg]', d), std = pmKobo(val(d, 'pm-std'));
        if (!std) { msg.innerHTML = note('bad', __('Enter a price above ₦0', 'bulk-sms-portal')); return; }
        if (fresh) {
          const code = (val(d, 'pm-cc') || '').replace(/\D+/g, '');
          if (!code || code.length > 4) { msg.innerHTML = note('bad', __('Enter a country code of 1 to 4 numbers', 'bulk-sms-portal')); return; }
          if (code === '234') { msg.innerHTML = note('bad', __('Nigeria is already in the list', 'bulk-sms-portal')); return; }
          if (draft.some(x => String(x.code) === code)) { msg.innerHTML = note('bad', `${sprintf(/* translators: %s: a value filled in when shown */ __('%s is already in the list', 'bulk-sms-portal'), esc(nameOf(code)))}`); return; }
          draft.push({ code, name: nameOf(code), standard_kobo: std, dnd_kobo: null, networks: [], prefixes: [] });
        } else {
          c.standard_kobo = std;
          if (isNg) c.dnd_kobo = pmKobo(val(d, 'pm-dnd')) || null;
        }
        d.close(); changed();
      };
    });
  }

  /* A network (name + prefixes) or a special price for one prefix. */
  function entryEditor(cc, kind, x) {
    const isNet = kind === 'network', fresh = !x;
    const c = draft.find(y => String(y.code) === cc);
    const usedNames = (c.networks || []).map(n => n.name);
    const suggest = NETWORK_CHOICES.filter(n => !usedNames.includes(n));
    const prefixesText = x ? x.prefixes.map(p => prefixLabel(cc, p)).join(', ') : '';
    openDialog(`<form method="dialog" novalidate><div class="bx-dialog-body"><h2>${isNet ? (fresh ? __('Add a network', 'bulk-sms-portal') : __('Edit ', 'bulk-sms-portal') + esc(x.name)) : (fresh ? __('Add a special price', 'bulk-sms-portal') : __('Edit special price', 'bulk-sms-portal'))}</h2>
      ${isNet ? `${fieldHtml('pm-name', __('Network', 'bulk-sms-portal'), x ? x.name : (suggest[0] || ''), { placeholder: __('For example MTN', 'bulk-sms-portal'), attrs: 'list="pm-net-names" maxlength="30"' })}<datalist id="pm-net-names">${NETWORK_CHOICES.map(n => `<option value="${n}"></option>`).join('')}</datalist>
        ${fieldHtml('pm-pfx', __('Number prefixes', 'bulk-sms-portal'), prefixesText, { textarea: true, rows: 3, mono: true, hint: __('The first four digits of its numbers, separated by commas, for example 0803, 0806, 0703.', 'bulk-sms-portal') })}`
      : fieldHtml('pm-pfx', __('Numbers starting with', 'bulk-sms-portal'), prefixesText, { mono: true, placeholder: '0807', hint: __('One prefix. This price beats the network price for these numbers.', 'bulk-sms-portal') })}
      <div class="bx-fields">
        <div class="bx-field"><label class="bx-label" for="pm-std">${__('Price per SMS page', 'bulk-sms-portal')}</label><div class="bx-money-input"><span aria-hidden="true">₦</span><input id="pm-std" type="number" min="0" step="0.01" value="${x ? pmNaira(x.standard_kobo) : ''}"></div></div>
        ${cc === '234' ? `<div class="bx-field"><label class="bx-label" for="pm-dnd">${__('Do Not Disturb numbers', 'bulk-sms-portal')} <span class="bx-optional">${__('(optional)', 'bulk-sms-portal')}</span></label><div class="bx-money-input"><span aria-hidden="true">₦</span><input id="pm-dnd" type="number" min="0" step="0.01" value="${x ? pmNaira(x.dnd_kobo) : ''}"></div><span class="bx-hint">${__('Empty uses the Nigeria Do Not Disturb price.', 'bulk-sms-portal')}</span></div>` : ''}
      </div>
      <div data-bx-pm-msg></div></div><div class="bx-dialog-actions"><button class="bx-btn" value="cancel">${__('Cancel', 'bulk-sms-portal')}</button><button class="bx-btn is-primary" data-bx-pm-ok>${fresh ? __('Add', 'bulk-sms-portal') : __('Done', 'bulk-sms-portal')}</button></div></form>`, d => {
      const nameEl = $('#pm-name', d), pfx = $('#pm-pfx', d);
      const fill = () => { if (fresh && isNet && !pfx.value.trim() && known[nameEl.value]) pfx.value = known[nameEl.value].map(p => prefixLabel('234', p)).join(', '); };
      if (nameEl) { nameEl.addEventListener('change', fill); fill(); }
      $('[data-bx-pm-ok]', d).onclick = (e) => {
        e.preventDefault();
        const msg = $('[data-bx-pm-msg]', d);
        const list = pfx.value.split(/[\s,;]+/).map(t => t.replace(/\D+/g, '')).filter(Boolean).map(t => {
          if (t.startsWith('00')) t = t.slice(2);
          if (cc === '234') { if (t.startsWith('234')) t = t.slice(3); else if (t.startsWith('0')) t = t.slice(1); t = t.slice(0, 3); }
          else if (t.startsWith(cc) && t.length > cc.length) t = t.slice(cc.length);
          return cc + t;
        }).filter(p => p.length > cc.length);
        const uniq = [...new Set(list)];
        const std = pmKobo(val(d, 'pm-std')), dnd = cc === '234' ? pmKobo(val(d, 'pm-dnd')) : 0;
        const name = isNet ? (val(d, 'pm-name') || '').trim() : '';
        if (isNet && !name) { msg.innerHTML = note('bad', __('Enter the network name', 'bulk-sms-portal')); return; }
        if (isNet && usedNames.some(n => n.toLowerCase() === name.toLowerCase() && (!x || n !== x.name))) { msg.innerHTML = note('bad', `${sprintf(/* translators: %s: a value filled in when shown */ __('%s is already in the list', 'bulk-sms-portal'), esc(name))}`); return; }
        if (!uniq.length) { msg.innerHTML = note('bad', isNet ? __('Add at least one number prefix', 'bulk-sms-portal') : __('Enter a prefix such as 0807', 'bulk-sms-portal')); return; }
        if (!isNet && uniq.length > 1) { msg.innerHTML = note('bad', __('Add one prefix at a time', 'bulk-sms-portal')); return; }
        if (!std && !dnd) { msg.innerHTML = note('bad', __('Enter a price above ₦0', 'bulk-sms-portal')); return; }
        const clash = isNet ? (c.networks || []).filter(n => n !== x).flatMap(n => n.prefixes.filter(p => uniq.includes(p)).map(p => [p, n.name])) : (c.prefixes || []).filter(n => n !== x && uniq.includes(n.prefixes[0])).map(n => [n.prefixes[0], 'another special price']);
        if (clash.length) { msg.innerHTML = note('bad', `${sprintf(/* translators: %1$s, %2$s: values filled in when shown */ __('%1$s is already in %2$s', 'bulk-sms-portal'), esc(prefixLabel(cc, clash[0][0])), esc(clash[0][1]))}`, __('A prefix can belong to one network only.', 'bulk-sms-portal')); return; }
        const item = { name: isNet ? name : uniq[0], prefixes: uniq, standard_kobo: std || null, dnd_kobo: dnd || null };
        const key = isNet ? 'networks' : 'prefixes';
        c[key] = c[key] || [];
        if (x) c[key][c[key].indexOf(x)] = item; else c[key].push(item);
        d.close(); changed();
      };
    });
  }

  draw();
});


/* ---- 160-admin-senders.js ---- */
/* ==========================================================================
   Sender ID Manager
   ========================================================================== */
const adSn = { status: 'pending', search: '', page: 1 };
adminPage('admin-senders', 'Sender ID Manager', async (host, ctx) => {
  const st = adSn;
  const root = mount(host, `
    ${pageHead(__('Sender ID Manager', 'bulk-sms-portal'), __('Approve or decline the sender names customers ask for, and choose the name used when a customer has none of their own.', 'bulk-sms-portal'))}
    <div data-bx-sn-default></div>
    <div class="bx-section"><div class="bx-stats" data-bx-sn-tiles>${stat(__('Waiting for you', 'bulk-sms-portal'), '…')}</div></div>
    <div class="bx-section">
      <form class="bx-filters" role="search" data-bx-sn-form>
        ${fieldHtml('bx-sn-q', __('Search', 'bulk-sms-portal'), st.search, { type: 'search', placeholder: __('Sender name, sample message or customer', 'bulk-sms-portal') })}
        <div class="bx-filter-actions"><button type="submit" class="bx-btn is-primary">${sprintf(/* translators: %s: a value filled in when shown */ __('%sSearch', 'bulk-sms-portal'), icon('search', 18))}</button><button type="button" class="bx-btn" data-bx-clear>${__('Clear', 'bulk-sms-portal')}</button></div>
      </form>
      <div data-bx-sn-list>${loading()}</div>
    </div>`);
  const form = $('[data-bx-sn-form]', root);
  form.onsubmit = e => { e.preventDefault(); st.search = val(form, 'bx-sn-q').trim(); draw(1); };
  $('[data-bx-clear]', form).onclick = () => { st.search = ''; st.status = 'pending'; $('#bx-sn-q', form).value = ''; draw(1); };
  async function draw(pg = 1) {
    st.page = pg;
    const list = $('[data-bx-sn-list]', root);
    list.innerHTML = loading();
    const q = new URLSearchParams({ page: pg, per_page: 20 }); if (st.status) q.set('status', st.status); if (st.search) q.set('search', st.search);
    const r = await C.api('/admin/sender-requests?' + q);
    if (!ctx.live()) return;
    if (!r || !r.ok) { list.innerHTML = `<div class="bx-panel">${note('bad', __('We could not load sender names', 'bulk-sms-portal'), esc(friendly(r)))}</div>`; return; }
    if (pageBack(r, pg, draw)) return;
    const c = r.counts || {};
    $('[data-bx-sn-default]', root).innerHTML = `<section class="bx-panel" aria-labelledby="bx-sn-def"><div class="bx-panel-head"><div><h2 id="bx-sn-def">${__('Shared sender name', 'bulk-sms-portal')}</h2><p>${__('Used for customers who have no approved name of their own. Up to 11 letters or numbers.', 'bulk-sms-portal')}</p></div></div>
      <div class="bx-row-flex is-nowrap"><label class="bx-sr" for="bx-sn-defname">${__('Shared sender name', 'bulk-sms-portal')}</label><input id="bx-sn-defname" class="bx-input bx-grow" maxlength="11" value="${esc(r.default_sender || '')}"><button type="button" class="bx-btn is-primary" data-bx-sn-defsave>${__('Save', 'bulk-sms-portal')}</button></div></section>`;
    $('[data-bx-sn-defsave]', root).onclick = async (e) => {
      const name = val(root, 'bx-sn-defname').trim();
      if (!/^[A-Za-z0-9 \-._]{1,11}$/.test(name)) { toast(__('Use up to 11 letters, numbers, spaces, dots or dashes.', 'bulk-sms-portal'), 'bad'); return; }
      const done = busy(e.currentTarget, __('Saving…', 'bulk-sms-portal'));
      const res = await C.api('/admin/default-sender', { method: 'POST', body: JSON.stringify({ sender_id: name }) });
      done(); toast(res && res.ok ? __('Shared sender name saved.', 'bulk-sms-portal') : friendly(res, __('Not saved.', 'bulk-sms-portal')), res && res.ok ? '' : 'bad');
    };
    $('[data-bx-sn-tiles]', root).innerHTML = [
      stat(__('Waiting for you', 'bulk-sms-portal'), num(c.pending), { filter: 'pending', active: st.status === 'pending', tone: Number(c.pending) ? 'wait' : '' }),
      stat(__('Approved', 'bulk-sms-portal'), num(c.approved), { filter: 'approved', active: st.status === 'approved', tone: 'good' }),
      stat(__('Declined', 'bulk-sms-portal'), num(c.rejected), { filter: 'rejected', active: st.status === 'rejected' }),
      stat(__('All', 'bulk-sms-portal'), num(c.all), { filter: '', active: !st.status })
    ].join('');
    $$('[data-bx-filter-value]', root).forEach(b => b.onclick = () => { st.status = b.dataset.bxFilterValue; draw(1); });
    const items = r.items || [];
    if (!items.length) { list.innerHTML = `<div class="bx-list">${empty('badge', st.status === 'pending' && !st.search ? __('Nothing waiting', 'bulk-sms-portal') : __('No sender names found', 'bulk-sms-portal'), st.status === 'pending' && !st.search ? __('New requests from customers will show here.', 'bulk-sms-portal') : __('Try a different search or status.', 'bulk-sms-portal'))}</div>`; return; }
    const cols = '1.2fr 1.4fr 2fr 1fr 250px';
    list.innerHTML = `<div class="bx-list"><div class="bx-tr is-head" style="--cols:${cols}"><span>${__('Sender name', 'bulk-sms-portal')}</span><span>${__('Customer', 'bulk-sms-portal')}</span><span>${__('Sample message', 'bulk-sms-portal')}</span><span>${__('Status', 'bulk-sms-portal')}</span><span></span></div>
      ${items.map(x => { const s = SENDER_STATUS[x.status] || ['info', x.status]; return `<div class="bx-tr" style="--cols:${cols}">
        <span class="bx-td-main bx-td-lead"><strong class="bx-figure bx-sender-name">${esc(x.sender_id)}</strong><small>${esc(fmtDate(x.created_at))}</small></span>
        <span class="bx-td-main" data-label="${esc(__('Customer', 'bulk-sms-portal'))}"><strong>${esc(x.user_name || (__('Customer #', 'bulk-sms-portal') + x.user_id))}</strong><small class="bx-break">${esc(x.user_email || '')}</small></span>
        <span class="bx-clip" data-label="${esc(__('Sample message', 'bulk-sms-portal'))}">${esc(x.sample_message || '—')}</span>
        <span class="bx-td-main" data-label="${esc(__('Status', 'bulk-sms-portal'))}">${pill(s[0], s[1])}${x.status === 'rejected' && x.admin_note ? `<small>${esc(String(x.admin_note).replace(/^.*Reason:\s*/s, ''))}</small>` : ''}</span>
        <span class="bx-row-flex bx-td-actions">${x.status !== 'approved' ? btn(__('Approve', 'bulk-sms-portal'), `data-bx-sn-ok="${x.id}"`, 'is-small is-primary') : ''}${x.status !== 'rejected' ? btn(__('Decline', 'bulk-sms-portal'), `data-bx-sn-no="${x.id}"`, 'is-small is-danger') : ''}${btn(__('Edit', 'bulk-sms-portal'), `data-bx-sn-edit="${x.id}"`, 'is-small is-quiet')}</span>
      </div>`; }).join('')}${pager(r)}</div>`;
    bindPager(list, draw);
    const find = id => items.find(x => String(x.id) === String(id));
    $$('[data-bx-sn-ok]', list).forEach(b => b.onclick = async () => {
      const x = find(b.dataset.bxSnOk);
      if (!await confirmBox({ title: `${sprintf(/* translators: %s: a value filled in when shown */ __('Approve %s?', 'bulk-sms-portal'), x.sender_id)}`, body: `<p>${sprintf(/* translators: %s: a value filled in when shown */ __('%s can use it straight away. We let them know.', 'bulk-sms-portal'), esc(x.user_name || __('The customer', 'bulk-sms-portal')))}</p>`, confirm: __('Approve', 'bulk-sms-portal') })) return;
      const res = await C.api(`/admin/sender-requests/${x.id}/approve`, { method: 'POST', body: '{}' });
      toast(res && res.ok ? `${x.sender_id} approved.` : friendly(res, __('Not approved.', 'bulk-sms-portal')), res && res.ok ? '' : 'bad'); adSummary(true); draw(st.page);
    });
    $$('[data-bx-sn-no]', list).forEach(b => b.onclick = () => {
      const x = find(b.dataset.bxSnNo);
      openDialog(`<form method="dialog" novalidate><div class="bx-dialog-body"><h2>${sprintf(/* translators: %s: a value filled in when shown */ __('Decline %s?', 'bulk-sms-portal'), esc(x.sender_id))}</h2><p>${__('The customer sees your reason and can ask for a different name.', 'bulk-sms-portal')}</p>
        ${fieldHtml('sn-reason', __('Reason', 'bulk-sms-portal'), '', { textarea: true, rows: 2, placeholder: __('For example: the name looks like a bank. Please use your business name.', 'bulk-sms-portal') })}<div data-bx-snr-msg></div></div>
        <div class="bx-dialog-actions"><button class="bx-btn" value="cancel">${__('Cancel', 'bulk-sms-portal')}</button><button class="bx-btn is-danger" data-bx-snr-go>${__('Decline', 'bulk-sms-portal')}</button></div></form>`, d => {
        $('#sn-reason', d).focus();
        $('[data-bx-snr-go]', d).onclick = async (e) => {
          e.preventDefault();
          const reason = val(d, 'sn-reason').trim();
          if (!reason) { $('[data-bx-snr-msg]', d).innerHTML = note('bad', __('Add a reason for the customer', 'bulk-sms-portal')); return; }
          const done = busy(e.currentTarget, __('Declining…', 'bulk-sms-portal'));
          const res = await C.api(`/admin/sender-requests/${x.id}/reject`, { method: 'POST', body: JSON.stringify({ admin_note: reason }) });
          done();
          if (res && res.ok) { d.close(); toast(`${x.sender_id} declined.`); adSummary(true); draw(st.page); } else $('[data-bx-snr-msg]', d).innerHTML = note('bad', __('Not done', 'bulk-sms-portal'), esc(friendly(res)));
        };
      });
    });
    $$('[data-bx-sn-edit]', list).forEach(b => b.onclick = () => {
      const x = find(b.dataset.bxSnEdit);
      openDialog(`<form method="dialog" novalidate><div class="bx-dialog-body"><h2>${sprintf(/* translators: %s: a value filled in when shown */ __('Edit %s', 'bulk-sms-portal'), esc(x.sender_id))}</h2>
        <div class="bx-fields">${fieldHtml('sne-name', __('Sender name', 'bulk-sms-portal'), x.sender_id, { attrs: 'maxlength="11"' })}${fieldHtml('sne-status', __('Status', 'bulk-sms-portal'), x.status, { options: [['pending', __('Waiting for approval', 'bulk-sms-portal')], ['approved', __('Approved', 'bulk-sms-portal')], ['rejected', __('Declined', 'bulk-sms-portal')]] })}</div>
        ${fieldHtml('sne-sample', __('Sample message', 'bulk-sms-portal'), x.sample_message || '', { textarea: true, rows: 2 })}
        ${fieldHtml('sne-note', __('Note (customers see this if declined)', 'bulk-sms-portal'), String(x.admin_note || '').replace(/^.*Reason:\s*/s, ''), { textarea: true, rows: 2, optional: true })}
        <div data-bx-sne-msg></div></div><div class="bx-dialog-actions"><button type="button" class="bx-btn is-danger" data-bx-sne-del>${__('Delete', 'bulk-sms-portal')}</button><button class="bx-btn" value="cancel">${__('Cancel', 'bulk-sms-portal')}</button><button class="bx-btn is-primary" data-bx-sne-save>${__('Save', 'bulk-sms-portal')}</button></div></form>`, d => {
        $('[data-bx-sne-save]', d).onclick = async (e) => {
          e.preventDefault();
          const done = busy(e.currentTarget, __('Saving…', 'bulk-sms-portal'));
          const res = await C.api('/admin/sender-requests/' + x.id, { method: 'POST', body: JSON.stringify({ sender_id: val(d, 'sne-name').trim(), status: val(d, 'sne-status'), sample_message: val(d, 'sne-sample'), admin_note: val(d, 'sne-note') }) });
          done();
          if (res && res.ok) { d.close(); toast(__('Saved.', 'bulk-sms-portal')); draw(st.page); } else $('[data-bx-sne-msg]', d).innerHTML = note('bad', __('Not saved', 'bulk-sms-portal'), esc(friendly(res)));
        };
        $('[data-bx-sne-del]', d).onclick = async () => {
          if (!await confirmBox({ title: `${sprintf(/* translators: %s: a value filled in when shown */ __('Delete %s?', 'bulk-sms-portal'), x.sender_id)}`, body: `<p>${__('The customer can no longer use this name. Messages already sent are not affected.', 'bulk-sms-portal')}</p>`, confirm: __('Delete', 'bulk-sms-portal'), danger: true })) return;
          const res = await C.api('/admin/sender-requests/' + x.id, { method: 'DELETE' });
          if (res && res.ok) { d.close(); toast(__('Deleted.', 'bulk-sms-portal')); draw(st.page); } else $('[data-bx-sne-msg]', d).innerHTML = note('bad', __('Not deleted', 'bulk-sms-portal'), esc(friendly(res)));
        };
      });
    });
  }
  draw(st.page);
});


/* ---- 170-admin-notices.js ---- */
/* ==========================================================================
   Customer Notices
   ========================================================================== */
const NOTICE_AUDIENCE = [['all', __('Everyone', 'bulk-sms-portal')], ['active', __('Active customers', 'bulk-sms-portal')], ['funded', __('Customers with money in their wallet', 'bulk-sms-portal')], ['zero_balance', __('Customers with an empty wallet', 'bulk-sms-portal')], ['low_balance', __('Customers running low', 'bulk-sms-portal')], ['has_sent', __('Customers who have sent SMS', 'bulk-sms-portal')], ['never_sent', __('Customers who have never sent SMS', 'bulk-sms-portal')], ['selected', __('Customers I choose', 'bulk-sms-portal')]];
const NOTICE_KIND = [['information', __('Information', 'bulk-sms-portal')], ['warning', __('Warning', 'bulk-sms-portal')], ['maintenance', __('Planned work', 'bulk-sms-portal')], ['promotion', __('Offer or promotion', 'bulk-sms-portal')]];
const NOTICE_PRIORITY = [['normal', __('Normal', 'bulk-sms-portal')], ['high', __('High', 'bulk-sms-portal')], ['critical', __('Urgent', 'bulk-sms-portal')], ['low', __('Low', 'bulk-sms-portal')]];
const nameOf = (list, v) => (list.find(x => x[0] === v) || [, v])[1];
adminPage('admin-broadcast', 'Customer Notices', async (host, ctx) => {
  const chosen = new Map();
  const root = mount(host, `
    ${pageHead(__('Customer Notices', 'bulk-sms-portal'), __('Tell customers about news, changes and offers. Notices show at the top of their portal until they close them (for up to 30 days), and can be emailed too.', 'bulk-sms-portal'))}
    <div class="bx-split">
      <section class="bx-panel" aria-labelledby="bx-nt-new">
        <div class="bx-panel-head"><div><h2 id="bx-nt-new">${__('New notice', 'bulk-sms-portal')}</h2></div></div>
        <form class="bx-stack is-tight" data-bx-nt-form novalidate>
          ${fieldHtml('nt-title', __('Title', 'bulk-sms-portal'), '', { attrs: 'maxlength="120"', placeholder: __('For example: Prices are changing on 1 November', 'bulk-sms-portal') })}
          ${fieldHtml('nt-msg', __('Message', 'bulk-sms-portal'), '', { textarea: true, rows: 5 })}
          <div class="bx-fields">${fieldHtml('nt-kind', __('Kind', 'bulk-sms-portal'), 'information', { options: NOTICE_KIND })}${fieldHtml('nt-pri', __('Importance', 'bulk-sms-portal'), 'normal', { options: NOTICE_PRIORITY })}</div>
          ${fieldHtml('nt-who', __('Who gets it', 'bulk-sms-portal'), 'all', { options: NOTICE_AUDIENCE })}
          <div data-bx-nt-pick hidden></div>
          <label class="bx-check"><input type="checkbox" id="nt-email"><span><strong>${__('Also send by email', 'bulk-sms-portal')}</strong><br><span class="bx-small bx-muted">${__('Offers are only emailed to customers who chose to get news and offers.', 'bulk-sms-portal')}</span></span></label>
          <div class="bx-row-flex"><button type="submit" class="bx-btn is-primary" data-bx-nt-send>${sprintf(/* translators: %s: a value filled in when shown */ __('%sSend notice', 'bulk-sms-portal'), icon('send', 18))}</button><button type="button" class="bx-btn" data-bx-nt-draft>${__('Save as draft', 'bulk-sms-portal')}</button></div>
          <div data-bx-nt-msg aria-live="polite"></div>
        </form>
      </section>
      <aside class="bx-aside"><section class="bx-panel" aria-labelledby="bx-nt-prev"><div class="bx-panel-head"><div><h2 id="bx-nt-prev">${__('How customers see it', 'bulk-sms-portal')}</h2></div></div><div data-bx-nt-preview></div></section></aside>
    </div>
    <section class="bx-section" aria-labelledby="bx-nt-hist"><div class="bx-section-head"><div><h2 id="bx-nt-hist">${__('Notices sent', 'bulk-sms-portal')}</h2></div></div><div data-bx-nt-hist>${loading()}</div></section>`);
  const form = $('[data-bx-nt-form]', root);
  const preview = () => {
    const kind = val(form, 'nt-kind');
    const tone = kind === 'warning' || val(form, 'nt-pri') === 'critical' ? 'wait' : (kind === 'promotion' ? 'good' : 'info');
    $('[data-bx-nt-preview]', root).innerHTML = `<article class="bx-notice is-${tone}">${icon(tone === 'wait' ? 'alert' : (tone === 'good' ? 'checkCircle' : 'bell'))}<div><strong>${esc(val(form, 'nt-title') || __('Your title', 'bulk-sms-portal'))}</strong><p>${esc(val(form, 'nt-msg') || __('Your message shows here.', 'bulk-sms-portal'))}</p></div><span></span></article>
      <p class="bx-small bx-muted bx-mt-s">${sprintf(/* translators: %1$s, %2$s: values filled in when shown */ __('Goes to: %1$s%2$s.', 'bulk-sms-portal'), esc(val(form, 'nt-who') === 'selected' ? sprintf(/* translators: %s: a number */ _n('%s chosen customer', '%s chosen customers', Number(chosen.size), 'bulk-sms-portal'), num(chosen.size)) : nameOf(NOTICE_AUDIENCE, val(form, 'nt-who'))), val(form, 'nt-email') ? __(', in the portal and by email', 'bulk-sms-portal') : __(', in the portal', 'bulk-sms-portal'))}</p>`;
  };
  ['nt-title', 'nt-msg', 'nt-kind', 'nt-pri', 'nt-who', 'nt-email'].forEach(id => { const el = $('#' + id, form); el.addEventListener('input', preview); el.addEventListener('change', preview); });
  const pick = $('[data-bx-nt-pick]', form);
  const paintChosen = () => { const box = $('[data-bx-nt-chosen]', pick); if (box) box.innerHTML = [...chosen.values()].map(u => `<button type="button" class="bx-chip is-filter" data-bx-nt-rm="${u.id}">${esc(u.name)} ${icon('x', 14, 2)}</button>`).join('') || `<span class="bx-small bx-muted">${__('Nobody chosen yet.', 'bulk-sms-portal')}</span>`; $$('[data-bx-nt-rm]', pick).forEach(b => b.onclick = () => { chosen.delete(Number(b.dataset.bxNtRm)); paintChosen(); preview(); }); };
  $('#nt-who', form).addEventListener('change', () => {
    pick.hidden = val(form, 'nt-who') !== 'selected';
    if (!pick.hidden && !pick.dataset.ready) { pick.dataset.ready = '1'; pick.innerHTML = '<div data-bx-nt-search></div><div class="bx-chips bx-mt-s" data-bx-nt-chosen></div>'; customerPicker($('[data-bx-nt-search]', pick), u => { chosen.set(Number(u.id), u); $('#bx-cp-q', pick).value = ''; paintChosen(); preview(); }); paintChosen(); }
  });
  preview();
  const submit = async (status, button) => {
    const msg = $('[data-bx-nt-msg]', root);
    const body = { title: val(form, 'nt-title').trim(), message: val(form, 'nt-msg').trim(), type: val(form, 'nt-kind'), priority: val(form, 'nt-pri'), audience: val(form, 'nt-who'), user_ids: [...chosen.keys()], send_email: status === 'published' && !!val(form, 'nt-email'), status, channel: 'portal' };
    if (!body.title || !body.message) { msg.innerHTML = note('bad', __('Add a title and a message', 'bulk-sms-portal')); return; }
    if (body.audience === 'selected' && !body.user_ids.length) { msg.innerHTML = note('bad', __('Choose at least one customer', 'bulk-sms-portal')); return; }
    if (status === 'published' && !await confirmBox({ title: __('Send this notice?', 'bulk-sms-portal'), body: `<p>${sprintf(/* translators: %1$s, %2$s: values filled in when shown */ __('To %1$s%2$s. It cannot be taken back once sent.', 'bulk-sms-portal'), esc(body.audience === 'selected' ? sprintf(/* translators: %s: a number */ _n('%s chosen customer', '%s chosen customers', Number(body.user_ids.length), 'bulk-sms-portal'), num(body.user_ids.length)) : nameOf(NOTICE_AUDIENCE, body.audience).toLowerCase()), body.send_email ? __(', in the portal and by email', 'bulk-sms-portal') : __(', in the portal', 'bulk-sms-portal'))}</p>`, confirm: __('Send notice', 'bulk-sms-portal') })) return;
    const done = busy(button, status === 'draft' ? __('Saving…', 'bulk-sms-portal') : __('Sending…', 'bulk-sms-portal'));
    const r = await C.api('/admin/broadcast', { method: 'POST', body: JSON.stringify(body), timeout: 60000 });
    done();
    if (r && r.ok) {
      msg.innerHTML = r.draft ? note('good', __('Draft saved', 'bulk-sms-portal'), __('It has not been sent to anyone.', 'bulk-sms-portal')) : note('good', `${sprintf(/* translators: %s: a value filled in when shown */ __('Sent to %s', 'bulk-sms-portal'), sprintf(/* translators: %s: a number */ _n('%s customer', '%s customers', Number(r.sent), 'bulk-sms-portal'), num(r.sent)))}`, body.send_email ? `${sprintf(/* translators: %1$s, %2$s, %3$s: values filled in when shown */ __('%1$s sent%2$s%3$s.', 'bulk-sms-portal'), sprintf(/* translators: %s: a number */ _n('%s email', '%s emails', Number(r.emails_sent), 'bulk-sms-portal'), num(r.emails_sent)), r.emails_skipped ? `${sprintf(/* translators: %s: a value filled in when shown */ __(', %s skipped because the customer did not want offers', 'bulk-sms-portal'), num(r.emails_skipped))}` : '', r.emails_failed ? `${sprintf(/* translators: %s: a value filled in when shown */ __(', %s could not be sent', 'bulk-sms-portal'), num(r.emails_failed))}` : '')}` : '');
      if (!r.draft) { form.reset(); chosen.clear(); pick.hidden = true; preview(); }
      loadHistory(1);
    } else msg.innerHTML = note('bad', __('Not sent', 'bulk-sms-portal'), esc(friendly(r)));
  };
  form.onsubmit = e => { e.preventDefault(); submit('published', $('[data-bx-nt-send]', form)); };
  $('[data-bx-nt-draft]', form).onclick = e => submit('draft', e.currentTarget);

  async function loadHistory(pg = 1) {
    const box = $('[data-bx-nt-hist]', root);
    const r = await C.api('/admin/notices?page=' + pg + '&per_page=10');
    if (!ctx.live()) return;
    if (!r || !r.ok) { box.innerHTML = `<div class="bx-panel">${note('bad', __('We could not load past notices', 'bulk-sms-portal'), esc(friendly(r)))}</div>`; return; }
    if (pageBack(r, pg, loadHistory)) return;
    const items = r.items || [];
    if (!items.length) { box.innerHTML = `<div class="bx-list">${empty('bell', __('No notices yet', 'bulk-sms-portal'), __('Notices you send will be listed here.', 'bulk-sms-portal'))}</div>`; return; }
    const cols = '2.2fr 1.2fr 1fr 1fr 110px';
    box.innerHTML = `<div class="bx-list"><div class="bx-tr is-head" style="--cols:${cols}"><span>${__('Notice', 'bulk-sms-portal')}</span><span>${__('Sent to', 'bulk-sms-portal')}</span><span>${__('Status', 'bulk-sms-portal')}</span><span>${__('Date', 'bulk-sms-portal')}</span><span></span></div>
      ${items.map(x => `<div class="bx-tr" style="--cols:${cols}"><span class="bx-td-main bx-td-lead"><strong>${esc(x.title)}</strong><small class="bx-clip">${esc(x.message)}</small></span>
        <span class="bx-td-main" data-label="${esc(__('Sent to', 'bulk-sms-portal'))}"><span>${esc(nameOf(NOTICE_AUDIENCE, x.audience))}</span><small>${x.reach !== null ? sprintf(/* translators: %s: a number */ _n('%s customer', '%s customers', Number(x.reach), 'bulk-sms-portal'), num(x.reach)) : ''}${x.send_email ? (x.emails_sent !== null ? `, ${sprintf(/* translators: %s: a number */ _n('%s email', '%s emails', Number(x.emails_sent), 'bulk-sms-portal'), num(x.emails_sent))}` : __(', with email', 'bulk-sms-portal')) : ''}</small></span>
        <span data-label="${esc(__('Status', 'bulk-sms-portal'))}">${pill(x.status === 'draft' ? 'info' : 'good', x.status === 'draft' ? __('Draft', 'bulk-sms-portal') : __('Sent', 'bulk-sms-portal'))}</span>
        <span data-label="${esc(__('Date', 'bulk-sms-portal'))}">${esc(fmtDate(x.created_at))}</span>
        <span class="bx-td-actions">${btn(__('Reuse', 'bulk-sms-portal'), `data-bx-nt-reuse="${x.id}"`, 'is-small is-quiet')}</span></div>`).join('')}${pager(r)}</div>`;
    bindPager(box, loadHistory);
    $$('[data-bx-nt-reuse]', box).forEach(b => b.onclick = () => {
      const x = items.find(i => String(i.id) === b.dataset.bxNtReuse); if (!x) return;
      $('#nt-title', form).value = x.title; $('#nt-msg', form).value = x.message;
      if (NOTICE_KIND.some(k => k[0] === x.type)) $('#nt-kind', form).value = x.type;
      if (NOTICE_PRIORITY.some(k => k[0] === x.priority)) $('#nt-pri', form).value = x.priority;
      if (NOTICE_AUDIENCE.some(k => k[0] === x.audience) && x.audience !== 'selected') $('#nt-who', form).value = x.audience;
      preview(); form.scrollIntoView({ behavior: 'smooth', block: 'start' }); $('#nt-title', form).focus();
    });
  }
  loadHistory(1);

  // Add-ons add their own sections to this page.
  if (window.wp && wp.hooks) wp.hooks.doAction('bsms.noticesPage', root, ctx);
});


/* ---- 180-admin-insights.js ---- */
/* ==========================================================================
   Reports & Insights
   Message and money totals come from the same records the Delivery Reports
   and Wallet History pages use, for the same dates, so the numbers agree.
   ========================================================================== */
const adIn = { days: 30 };
adminPage('admin-analytics', 'Reports & Insights', async (host, ctx) => {
  const root = mount(host, `
    ${pageHead(__('Reports & Insights', 'bulk-sms-portal'), __('How sending and money are going across the platform, and who your busiest customers are.', 'bulk-sms-portal'))}
    <div class="bx-seg" role="group" aria-label="${esc(__('Period', 'bulk-sms-portal'))}">${[[7, __('Last 7 days', 'bulk-sms-portal')], [30, __('Last 30 days', 'bulk-sms-portal')], [90, __('Last 90 days', 'bulk-sms-portal')], [365, __('Last 12 months', 'bulk-sms-portal')]].map(([d, l]) => `<button type="button" data-bx-days="${d}" aria-pressed="${adIn.days === d ? 'true' : 'false'}">${l}</button>`).join('')}</div>
    <div data-bx-in class="bx-section">${skeleton(8)}</div>`);
  $$('[data-bx-days]', root).forEach(b => b.onclick = () => { adIn.days = Number(b.dataset.bxDays); C.show('admin-analytics', false); });
  const ins = await C.api('/records/insights?days=' + adIn.days);
  if (!ctx.live()) return;
  const box = $('[data-bx-in]', root);
  if (!ins || !ins.ok) { box.innerHTML = note('bad', __('We could not load reports', 'bulk-sms-portal'), esc(friendly(ins))); return; }
  const range = new URLSearchParams({ from: ins.from, to: ins.to, per_page: 1 });
  const [rep, wal] = await Promise.all([C.api('/records/reports?' + range), C.api('/records/wallet?' + range)]);
  if (!ctx.live()) return;
  const s = (rep && rep.ok && rep.summary) || {}, w = (wal && wal.ok && wal.summary) || {};
  const done = Number(s.successful || 0) + Number(s.failed || 0);
  const rate = done ? Math.round(100 * Number(s.successful || 0) / done) : 0;

  /* Group days into weeks or months for long periods, so the chart stays readable. */
  let series = ins.series || [];
  if (ins.days > 90) {
    const byMonth = {};
    series.forEach(x => { const k = x.date.slice(0, 7); byMonth[k] = byMonth[k] || { date: k + '-01', label: new Date(x.date + 'T00:00:00').toLocaleDateString('en-GB', { month: 'short' }), successful: 0, failed: 0, sending: 0 }; ['successful', 'failed', 'sending'].forEach(f => byMonth[k][f] += x[f]); });
    series = Object.values(byMonth);
  } else if (ins.days > 30) {
    const weeks = [];
    series.forEach((x, i) => { if (i % 7 === 0) weeks.push({ date: x.date, label: new Date(x.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), successful: 0, failed: 0, sending: 0 }); const wk = weeks[weeks.length - 1]; ['successful', 'failed', 'sending'].forEach(f => wk[f] += x[f]); });
    series = weeks;
  } else series = series.map(x => ({ ...x, label: new Date(x.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) }));
  const peak = Math.max(1, ...series.map(x => x.successful + x.failed + x.sending));
  const unit = ins.days > 90 ? 'month' : (ins.days > 30 ? 'week' : 'day');

  const list = (items, cols, headers, row, emptyText) => items.length
    ? `<div class="bx-list is-inset is-top"><div class="bx-tr is-head" style="--cols:${cols}">${headers.map((h, i) => `<span class="${i ? 'is-num' : ''}">${esc(h)}</span>`).join('')}</div>${items.map(x => `<div class="bx-tr" style="--cols:${cols}">${row(x)}</div>`).join('')}</div>`
    : `<div class="bx-line-item bx-muted">${esc(emptyText)}</div>`;

  box.innerHTML = `
    <section aria-labelledby="bx-in-msg"><div class="bx-section-head"><div><h2 id="bx-in-msg">${__('Messages', 'bulk-sms-portal')}</h2><p>${esc(fmtDate(ins.from, false))} to ${esc(fmtDate(ins.to, false))}</p></div>${btn(__('Open Delivery Reports', 'bulk-sms-portal'), 'data-bx-go="reports"', 'is-quiet is-small')}</div>
      <div class="bx-stats">${stat(__('Messages sent', 'bulk-sms-portal'), num(s.messages), { note: sprintf(/* translators: %s: a number */ _n('%s send', '%s sends', Number(s.sends), 'bulk-sms-portal'), num(s.sends)) })}${stat(__('Successful', 'bulk-sms-portal'), num(s.successful), { tone: 'good', note: rate + __('% of results', 'bulk-sms-portal') })}${stat(__('Failed', 'bulk-sms-portal'), num(s.failed), { tone: Number(s.failed) ? 'bad' : '' })}${stat(__('Customers who sent', 'bulk-sms-portal'), num(ins.active_customers), { note: `${sprintf(/* translators: %s: a value filled in when shown */ __('%s new sign-ups', 'bulk-sms-portal'), num(ins.new_customers))}` })}</div></section>
    <section class="bx-section" aria-labelledby="bx-in-money"><div class="bx-section-head"><h2 id="bx-in-money">${__('Money', 'bulk-sms-portal')}</h2>${btn(__('Open Wallet History', 'bulk-sms-portal'), 'data-bx-go="transactions"', 'is-quiet is-small')}</div>
      <div class="bx-stats">${stat(__('Money added by customers', 'bulk-sms-portal'), naira(w.added_kobo), { tone: 'good' })}${stat(__('Used for SMS', 'bulk-sms-portal'), naira(w.used_kobo))}${stat(__('Returned for failed messages', 'bulk-sms-portal'), naira(w.returned_kobo))}${stat(__('SMS income', 'bulk-sms-portal'), naira(w.net_sms_income_kobo), { note: __('Used minus returned', 'bulk-sms-portal') })}</div></section>
    <section class="bx-section bx-panel" aria-labelledby="bx-in-chart"><div class="bx-panel-head"><div><h2 id="bx-in-chart">${sprintf(/* translators: %s: a value filled in when shown */ __('Messages each %s', 'bulk-sms-portal'), unit)}</h2></div><span class="bx-legend"><span style="--c:var(--bx-good)">${__('Successful', 'bulk-sms-portal')}</span><span style="--c:var(--bx-bad)">${__('Failed', 'bulk-sms-portal')}</span><span style="--c:#d99a2b">${__('Sending', 'bulk-sms-portal')}</span></span></div>
      <div class="bx-chart" role="img" aria-label="${sprintf(/* translators: %s: a value filled in when shown */ esc(__('Messages each %s', 'bulk-sms-portal')), unit)}">${series.map(x => { const t = x.successful + x.failed + x.sending; return `<div class="bx-chart-col" title="${sprintf(/* translators: %1$s, %2$s, %3$s, %4$s: values filled in when shown */ esc(__('%1$s: %2$s messages, %3$s successful, %4$s failed', 'bulk-sms-portal')), esc(x.label), t, x.successful, x.failed)}"><div class="bx-chart-bar" style="--h:${(100 * t / peak).toFixed(1)}%"><i class="is-wait" style="--w:${t ? (100 * x.sending / t).toFixed(1) : 0}%"></i><i class="is-bad" style="--w:${t ? (100 * x.failed / t).toFixed(1) : 0}%"></i><i class="is-good" style="--w:${t ? (100 * x.successful / t).toFixed(1) : 0}%"></i></div><span>${esc(x.label)}</span></div>`; }).join('')}</div></section>
    <div class="bx-section bx-split is-even">
      <section class="bx-panel is-flush" aria-labelledby="bx-in-cust"><div class="bx-panel-head"><div><h2 id="bx-in-cust">${__('Busiest customers', 'bulk-sms-portal')}</h2><p>${__('By what they spent on SMS.', 'bulk-sms-portal')}</p></div></div>
        ${list(ins.top_customers || [], __('minmax(0,1.6fr) 0.8fr 0.8fr 1fr', 'bulk-sms-portal'), [__('Customer', 'bulk-sms-portal'), __('Messages', 'bulk-sms-portal'), __('Failed', 'bulk-sms-portal'), __('Spent', 'bulk-sms-portal')], x => `<span class="bx-td-main bx-td-lead"><strong>${esc(x.name || __('Customer #', 'bulk-sms-portal') + x.user_id)}</strong><small class="bx-break">${esc(x.email || '')}</small></span><span class="is-num" data-label="${esc(__('Messages', 'bulk-sms-portal'))}">${num(x.messages)}</span><span class="is-num" data-label="${esc(__('Failed', 'bulk-sms-portal'))}">${num(x.failed)}</span><span class="is-num" data-label="${esc(__('Spent', 'bulk-sms-portal'))}"><b>${esc(naira(x.spend_kobo))}</b></span>`, __('No sends in this period.', 'bulk-sms-portal'))}</section>
      <section class="bx-panel is-flush" aria-labelledby="bx-in-snd"><div class="bx-panel-head"><div><h2 id="bx-in-snd">${__('Most used sender names', 'bulk-sms-portal')}</h2></div></div>
        ${list(ins.top_senders || [], __('minmax(0,1.6fr) 0.8fr 0.8fr 0.8fr', 'bulk-sms-portal'), [__('Sender name', 'bulk-sms-portal'), __('Messages', 'bulk-sms-portal'), __('Successful', 'bulk-sms-portal'), __('Failed', 'bulk-sms-portal')], x => `<strong class="bx-td-lead">${esc(x.sender)}</strong><span class="is-num" data-label="${esc(__('Messages', 'bulk-sms-portal'))}">${num(x.messages)}</span><span class="is-num" data-label="${esc(__('Successful', 'bulk-sms-portal'))}">${num(x.successful)}</span><span class="is-num" data-label="${esc(__('Failed', 'bulk-sms-portal'))}">${num(x.failed)}</span>`, __('No sends in this period.', 'bulk-sms-portal'))}</section>
    </div>
    <section class="bx-section bx-panel is-flush" aria-labelledby="bx-in-svc"><div class="bx-panel-head"><div><h2 id="bx-in-svc">${__('SMS services', 'bulk-sms-portal')}</h2><p>${__('How each service you send through performed.', 'bulk-sms-portal')}</p></div>${btn(__('Open SMS Services', 'bulk-sms-portal'), 'data-bx-go="admin-apis"', 'is-quiet is-small')}</div>
      ${list(ins.services || [], __('minmax(0,1.6fr) 0.8fr 0.8fr 0.8fr 1.2fr', 'bulk-sms-portal'), [__('Service', 'bulk-sms-portal'), __('Messages', 'bulk-sms-portal'), __('Successful', 'bulk-sms-portal'), __('Failed', 'bulk-sms-portal'), __('Results', 'bulk-sms-portal')], x => { const d2 = x.successful + x.failed; const noDlr = x.successful > 0 && !x.delivered; return `<span class="bx-td-main bx-td-lead"><strong>${esc(x.name)}</strong>${noDlr && x.api_id ? `<small>${__('Sends no delivery results back, so its messages count as successful unless a failure is reported', 'bulk-sms-portal')}</small>` : ''}</span><span class="is-num" data-label="${esc(__('Messages', 'bulk-sms-portal'))}">${num(x.messages)}</span><span class="is-num" data-label="${esc(__('Successful', 'bulk-sms-portal'))}">${num(x.successful)}</span><span class="is-num" data-label="${esc(__('Failed', 'bulk-sms-portal'))}">${num(x.failed)}</span><span data-label="${esc(__('Results', 'bulk-sms-portal'))}">${bar([{ label: __('confirmed by the network', 'bulk-sms-portal'), value: x.delivered, tone: 'good' }, { label: __('no failure reported', 'bulk-sms-portal'), value: x.successful - x.delivered, tone: 'info' }, { label: 'failed', value: x.failed, tone: 'bad' }, { label: 'sending', value: x.sending, tone: 'wait' }])}<small class="bx-muted">${d2 ? Math.round(100 * x.successful / d2) + __('% successful', 'bulk-sms-portal') : '—'}</small></span>`; }, __('No sends in this period.', 'bulk-sms-portal'))}</section>`;
  bindGo(box);
});


/* ---- 190-admin-help.js ---- */
/* ==========================================================================
   Help Content (what customers see in the Help Centre)
   ========================================================================== */
const HC_TYPES = [['troubleshooting', __('Questions', 'bulk-sms-portal')], ['knowledge', __('Guides', 'bulk-sms-portal')], ['channels', __('Ways to contact you', 'bulk-sms-portal')], ['suggestions', __('Search suggestions', 'bulk-sms-portal')]];
const HC_VIS = [['everyone', __('Everyone', 'bulk-sms-portal')], ['users', __('Signed-in customers', 'bulk-sms-portal')], ['admin', __('Admins only', 'bulk-sms-portal')]];
const HC_PAGES = [['', __('None', 'bulk-sms-portal')], ['compose', __('Send SMS', 'bulk-sms-portal')], ['reports', __('Delivery Reports', 'bulk-sms-portal')], ['history', __('Message History', 'bulk-sms-portal')], ['fund', __('Buy SMS', 'bulk-sms-portal')], ['sender', __('Sender ID', 'bulk-sms-portal')], ['pricing', __('Pricing', 'bulk-sms-portal')], ['groups', __('Phonebook', 'bulk-sms-portal')], ['api', 'API'], ['profile', __('Profile & Security', 'bulk-sms-portal')]];
const adHc = { type: 'troubleshooting' };
adminPage('admin-help', 'Help Content', async (host, ctx) => {
  const root = mount(host, `${pageHead(__('Help Content', 'bulk-sms-portal'), __('The questions, guides and contact options customers see in the Help Centre.', 'bulk-sms-portal'), btn(__('See the Help Centre', 'bulk-sms-portal'), 'data-bx-go="help"', 'is-quiet'))}<div data-bx-hc>${skeleton(6)}</div>`);
  bindGo(root);
  let data = null;
  const r = await C.api('/admin/help-content');
  if (!ctx.live()) return;
  if (!r || !r.ok) { $('[data-bx-hc]', root).innerHTML = note('bad', __('We could not load help content', 'bulk-sms-portal'), esc(friendly(r))); return; }
  data = r.content || {};
  const draw = () => {
    const box = $('[data-bx-hc]', root);
    const items = (data[adHc.type] || []).slice().sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
    const live = x => x.status !== 'draft' && Number(x.enabled ?? 1);
    box.innerHTML = `<div class="bx-row-flex is-between">${tabs(HC_TYPES.map(([k, l]) => [k, `${l} (${(data[k] || []).length})`]), adHc.type)}${btn(icon('plus', 18) + __('Add', 'bulk-sms-portal'), 'data-bx-hc-add', 'is-primary')}</div>
      <div class="bx-section">${items.length ? `<div class="bx-list"><div class="bx-tr is-head" style="--cols:60px minmax(0,2fr) 1fr 1fr 170px"><span>${__('Order', 'bulk-sms-portal')}</span><span>${__('Title', 'bulk-sms-portal')}</span><span>${__('Who sees it', 'bulk-sms-portal')}</span><span>${__('Status', 'bulk-sms-portal')}</span><span></span></div>
        ${items.map(x => `<div class="bx-tr" style="--cols:60px minmax(0,2fr) 1fr 1fr 170px"><span class="bx-num" data-label="${esc(__('Order', 'bulk-sms-portal'))}">${num(x.order || 0)}</span><span class="bx-td-main bx-td-lead"><strong>${esc(x.title || x.query || __('Untitled', 'bulk-sms-portal'))}</strong><small class="bx-clip">${esc(x.summary || x.body || x.value || x.query || '')}</small></span><span data-label="${esc(__('Who sees it', 'bulk-sms-portal'))}">${esc(nameOf(HC_VIS, x.visibility || 'everyone'))}</span><span data-label="${esc(__('Status', 'bulk-sms-portal'))}">${pill(live(x) ? 'good' : 'info', live(x) ? __('Showing', 'bulk-sms-portal') : __('Hidden', 'bulk-sms-portal'))}</span><span class="bx-row-flex bx-td-actions">${btn(__('Edit', 'bulk-sms-portal'), `data-bx-hc-edit="${esc(x.id)}"`, 'is-small')}${btn(icon('trash', 16) + `<span class="bx-sr">${__('Delete', 'bulk-sms-portal')}</span>`, `data-bx-hc-del="${esc(x.id)}" aria-label="${esc(__('Delete', 'bulk-sms-portal'))}"`, 'is-small is-quiet')}</span></div>`).join('')}</div>`
        : `<div class="bx-list">${empty('help', __('Nothing here yet', 'bulk-sms-portal'), __('Add the first one.', 'bulk-sms-portal'))}</div>`}</div>`;
    $$('[data-bx-tab]', box).forEach(b => b.onclick = () => { adHc.type = b.dataset.bxTab; draw(); });
    $('[data-bx-hc-add]', box).onclick = () => editor({});
    $$('[data-bx-hc-edit]', box).forEach(b => b.onclick = () => editor(items.find(x => String(x.id) === b.dataset.bxHcEdit) || {}));
    $$('[data-bx-hc-del]', box).forEach(b => b.onclick = async () => {
      const x = items.find(i => String(i.id) === b.dataset.bxHcDel);
      if (!await confirmBox({ title: __('Delete this item?', 'bulk-sms-portal'), body: `<p>${sprintf(/* translators: %s: a value filled in when shown */ __('“%s” is removed from the Help Centre.', 'bulk-sms-portal'), esc(x.title || x.query || ''))}</p>`, confirm: __('Delete', 'bulk-sms-portal'), danger: true })) return;
      const res = await C.api('/admin/help-content/' + encodeURIComponent(x.id) + '?type=' + encodeURIComponent(adHc.type), { method: 'DELETE' });
      if (res && res.ok) { data = res.content || data; toast(__('Deleted.', 'bulk-sms-portal')); draw(); } else toast(friendly(res, __('Not deleted.', 'bulk-sms-portal')), 'bad');
    });
  };
  const editor = (x) => {
    const t = adHc.type, sug = t === 'suggestions', ch = t === 'channels';
    openDialog(`<form method="dialog" novalidate><div class="bx-dialog-body"><h2>${x.id ? __('Edit', 'bulk-sms-portal') : __('Add', 'bulk-sms-portal')} ${esc(nameOf(HC_TYPES, t).toLowerCase().replace(/s$/, ''))}</h2>
      ${fieldHtml('hc-title', sug ? __('Button text', 'bulk-sms-portal') : (ch ? __('Name', 'bulk-sms-portal') : __('Title', 'bulk-sms-portal')), x.title || '')}
      ${sug ? fieldHtml('hc-query', __('Searches for', 'bulk-sms-portal'), x.query || '') : ''}
      ${!sug && !ch ? fieldHtml('hc-summary', __('Short summary', 'bulk-sms-portal'), x.summary || '', { optional: true }) : ''}
      ${!sug ? fieldHtml('hc-body', ch ? __('Short description', 'bulk-sms-portal') : __('Answer', 'bulk-sms-portal'), x.body || x.summary || '', { textarea: true, rows: ch ? 2 : 5 }) : ''}
      ${ch ? `<div class="bx-fields">${fieldHtml('hc-type', __('Type', 'bulk-sms-portal'), x.type || 'email', { options: [['email', __('Email', 'bulk-sms-portal')], ['whatsapp', 'WhatsApp'], ['phone', __('Phone', 'bulk-sms-portal')], ['technical', __('Technical help', 'bulk-sms-portal')], ['custom', __('Other', 'bulk-sms-portal')]] })}${fieldHtml('hc-value', __('Email, number or link', 'bulk-sms-portal'), x.value || '')}${fieldHtml('hc-avail', __('When you are available', 'bulk-sms-portal'), x.availability || '', { optional: true })}</div>` : ''}
      ${!sug && !ch ? `<div class="bx-fields">${fieldHtml('hc-cat', __('Topic', 'bulk-sms-portal'), x.category || '', { optional: true })}${fieldHtml('hc-page', __('Button to a page', 'bulk-sms-portal'), x.related_page || '', { options: HC_PAGES })}</div>${fieldHtml('hc-keys', __('Extra search words', 'bulk-sms-portal'), x.keywords || '', { optional: true, hint: __('Words customers might type to find this.', 'bulk-sms-portal') })}` : ''}
      <div class="bx-fields">${fieldHtml('hc-order', __('Order', 'bulk-sms-portal'), x.order || 10, { type: 'number', hint: __('Smaller numbers show first.', 'bulk-sms-portal') })}${fieldHtml('hc-vis', __('Who sees it', 'bulk-sms-portal'), x.visibility || 'everyone', { options: HC_VIS })}${fieldHtml('hc-status', __('Status', 'bulk-sms-portal'), x.status === 'draft' || Number(x.enabled ?? 1) === 0 ? 'draft' : 'published', { options: [['published', __('Showing', 'bulk-sms-portal')], ['draft', __('Hidden', 'bulk-sms-portal')]] })}</div>
      <div data-bx-hc-msg></div></div><div class="bx-dialog-actions"><button class="bx-btn" value="cancel">${__('Cancel', 'bulk-sms-portal')}</button><button class="bx-btn is-primary" data-bx-hc-save>${__('Save', 'bulk-sms-portal')}</button></div></form>`, d => {
      d.classList.add('is-wide');
      $('[data-bx-hc-save]', d).onclick = async (e) => {
        e.preventDefault();
        const status = val(d, 'hc-status');
        const item = { id: x.id || '', title: val(d, 'hc-title').trim(), query: val(d, 'hc-query'), summary: val(d, 'hc-summary'), body: val(d, 'hc-body'), category: val(d, 'hc-cat'), keywords: val(d, 'hc-keys'), related_page: val(d, 'hc-page'), order: Number(val(d, 'hc-order') || 10), status, enabled: status === 'published' ? 1 : 0, visibility: val(d, 'hc-vis'), type: val(d, 'hc-type'), value: val(d, 'hc-value'), availability: val(d, 'hc-avail') };
        if (!item.title && !item.query) { $('[data-bx-hc-msg]', d).innerHTML = note('bad', __('Add a title', 'bulk-sms-portal')); return; }
        const done = busy(e.currentTarget, __('Saving…', 'bulk-sms-portal'));
        const res = await C.api('/admin/help-content', { method: 'POST', body: JSON.stringify({ type: t, item }) });
        done();
        if (res && res.ok) { data = res.content || data; d.close(); toast(__('Saved.', 'bulk-sms-portal')); draw(); } else $('[data-bx-hc-msg]', d).innerHTML = note('bad', __('Not saved', 'bulk-sms-portal'), esc(friendly(res)));
      };
    });
  };
  draw();
});


/* ---- 195-admin-settings.js ---- */
/* ==========================================================================
   Platform Settings
   ========================================================================== */
const PS_TABS = [['branding', __('Brand', 'bulk-sms-portal')], ['payments', __('Online payments', 'bulk-sms-portal')], ['funding', __('Bank accounts', 'bulk-sms-portal')], ['security', __('Sign-in protection', 'bulk-sms-portal')], ['features', __('Features', 'bulk-sms-portal')], ['system', __('Advanced', 'bulk-sms-portal')]];
const PS_FEATURES = [
  ['compose_sms', __('Send SMS', 'bulk-sms-portal')], ['scheduled_sms', __('Send later', 'bulk-sms-portal')], ['templates', __('Saved messages', 'bulk-sms-portal')], ['phone_groups', __('Phonebook', 'bulk-sms-portal')], ['message_history', __('Message History', 'bulk-sms-portal')],
  ['delivery_reports', __('Delivery Reports', 'bulk-sms-portal')], ['buy_sms', __('Buy SMS', 'bulk-sms-portal')], ['manual_funding', __('Pay by bank transfer', 'bulk-sms-portal')], ['transactions', __('Wallet History', 'bulk-sms-portal')],
  ['sender_ids', __('Sender names', 'bulk-sms-portal')], ['notifications', __('Notifications', 'bulk-sms-portal')], ['api_access', __('API for customers', 'bulk-sms-portal')], ['broadcast', __('Customer notices', 'bulk-sms-portal')], ['pricing', __('Pricing page', 'bulk-sms-portal')],
  ['frontend_admin', __('Admin pages in the portal', 'bulk-sms-portal')], ['developer_tools', __('Developer tools', 'bulk-sms-portal')]
];
const adPs = { tab: 'branding' };
adminPage('admin-settings', 'Platform Settings', async (host, ctx) => {
  const fromHash = tabFromHash(PS_TABS.map(t => t[0])); if (fromHash) adPs.tab = fromHash;
  const root = mount(host, `${pageHead(__('Platform Settings', 'bulk-sms-portal'), __('Your brand, how customers pay, sign-in protection and which features customers can use.', 'bulk-sms-portal'))}<div data-bx-ps>${skeleton(8)}</div>`);
  const r = await C.api('/admin/platform-settings');
  if (!ctx.live()) return;
  const box = $('[data-bx-ps]', root);
  if (!r || !r.ok) { box.innerHTML = note('bad', __('We could not load settings', 'bulk-sms-portal'), esc(friendly(r))); return; }
  const S0 = r.settings || {};
  const draw = () => {
    const t = adPs.tab, d = S0[t] || {};
    let body = '';
    if (t === 'branding') body = `
      <div class="bx-fields">${fieldHtml('ps-brand', __('Brand name', 'bulk-sms-portal'), d.brand_name)}${fieldHtml('ps-slug', __('Portal address', 'bulk-sms-portal'), d.portal_slug, { hint: __('The part after your website address, for example /portal.', 'bulk-sms-portal') })}</div>
      <div class="bx-field"><span class="bx-label">${__('Logo', 'bulk-sms-portal')}</span><div class="bx-row-flex"><span class="bx-logo-preview" data-bx-logo-prev>${d.logo_url ? `<img src="${esc(d.logo_url)}" alt="${esc(__('Current logo', 'bulk-sms-portal'))}">` : `<span class="bx-muted bx-small">${__('No logo', 'bulk-sms-portal')}</span>`}</span>${window.wp && wp.media ? btn(__('Choose logo', 'bulk-sms-portal'), 'data-bx-logo-pick', 'is-small') : ''}${btn(__('Remove', 'bulk-sms-portal'), 'data-bx-logo-clear', 'is-small is-quiet')}</div><input type="hidden" id="ps-logo-id" value="${esc(d.logo_attachment_id || 0)}">${fieldHtml('ps-logo', __('Or logo web address', 'bulk-sms-portal'), d.logo_url, { optional: true })}</div>
      ${fieldHtml('ps-display', __('Show in the portal menu', 'bulk-sms-portal'), d.sidebar_brand_display, { options: [['logo_only', __('Logo only', 'bulk-sms-portal')], ['name_only', __('Name only', 'bulk-sms-portal')], ['logo_name', __('Logo and name', 'bulk-sms-portal')]] })}
      <div class="bx-fields">${fieldHtml('ps-support', __('Support email', 'bulk-sms-portal'), d.support_email, { type: 'email' })}${fieldHtml('ps-from', __('Emails are sent from', 'bulk-sms-portal'), d.transactional_from_email, { type: 'email' })}${fieldHtml('ps-adminmail', __('Send admin alerts to', 'bulk-sms-portal'), d.admin_notification_email, { type: 'email' })}${fieldHtml('ps-sender', __('Shared sender name', 'bulk-sms-portal'), d.default_sender, { attrs: 'maxlength="11"', hint: __('Used by customers without their own.', 'bulk-sms-portal') })}</div>
      <div class="bx-fields">${['primary_color', 'secondary_color', 'background_color', 'surface_color'].map((k, i) => fieldHtml('ps-' + k, [__('Main colour', 'bulk-sms-portal'), __('Second colour', 'bulk-sms-portal'), __('Page background', 'bulk-sms-portal'), __('Panel background', 'bulk-sms-portal')][i], d[k], { type: 'color' })).join('')}</div>`;
    else if (t === 'payments') body = `
      <div class="bx-fields">${fieldHtml('ps-cur', __('Currency', 'bulk-sms-portal'), d.currency)}${fieldHtml('ps-min', __('Smallest top-up', 'bulk-sms-portal'), d.minimum, { type: 'number', hint: __('0 for no minimum.', 'bulk-sms-portal') })}${fieldHtml('ps-max', __('Largest top-up', 'bulk-sms-portal'), d.maximum, { type: 'number', hint: __('0 for no maximum.', 'bulk-sms-portal') })}${fieldHtml('ps-quick', __('Quick amounts', 'bulk-sms-portal'), d.quick_amounts, { hint: __('Separated by commas.', 'bulk-sms-portal') })}</div>
      <div class="bx-rows bx-mt-m">${switchRow('test_mode', __('Test mode', 'bulk-sms-portal'), __('Payments are not real. Never leave on for a live site.', 'bulk-sms-portal'), Number(d.test_mode))}</div>
      <h3 class="bx-mt-m">${__('Paystack', 'bulk-sms-portal')}</h3><div class="bx-rows">${switchRow('paystack', __('Take payments with Paystack', 'bulk-sms-portal'), '', Number(d.paystack))}</div>
      <div class="bx-fields bx-mt-s">${fieldHtml('ps-pk', __('Public key', 'bulk-sms-portal'), d.paystack_public_key, { mono: true })}${fieldHtml('ps-sk', __('Secret key', 'bulk-sms-portal'), '', { type: 'password', mono: true, hint: d.paystack_secret_set ? __('Saved. Leave blank to keep it.', 'bulk-sms-portal') : __('Not saved yet.', 'bulk-sms-portal') })}</div>
      ${window.wp && wp.hooks ? wp.hooks.applyFilters('bsms.paymentSettingsHtml', '', d) : ''}`;
    else if (t === 'funding') body = `
      <p class="bx-muted">${__('Customers who pay by bank transfer see these accounts on Buy SMS.', 'bulk-sms-portal')}</p>
      <div class="bx-stack is-tight bx-mt-m" data-bx-banks>${(d.accounts || []).map((a, i) => bankRow(a, i)).join('')}</div>
      <div class="bx-row-flex bx-mt-s">${btn(icon('plus', 16) + __('Add an account', 'bulk-sms-portal'), 'data-bx-bank-add', 'is-small')}</div>
      ${fieldHtml('ps-finstr', __('Instructions shown to customers', 'bulk-sms-portal'), d.instructions, { textarea: true, rows: 3, optional: true })}`;
    else if (t === 'security') body = `
      <div class="bx-rows">${switchRow('honeypot', __('Hidden trap for robots', 'bulk-sms-portal'), __('Stops most automatic sign-ups without bothering people.', 'bulk-sms-portal'), Number(d.honeypot))}</div>
      ${fieldHtml('ps-minsec', __('Fastest a form can be sent (seconds)', 'bulk-sms-portal'), d.min_form_seconds, { type: 'number', hint: __('Robots fill forms instantly; people take a few seconds.', 'bulk-sms-portal') })}
      <h3 class="bx-mt-m">reCAPTCHA</h3><div class="bx-rows">${switchRow('recaptcha_enabled', __('Use Google reCAPTCHA', 'bulk-sms-portal'), '', Number(d.recaptcha_enabled))}${switchRow('recaptcha_login', __('On sign-in', 'bulk-sms-portal'), '', Number(d.recaptcha_login))}${switchRow('recaptcha_register', __('On create account', 'bulk-sms-portal'), '', Number(d.recaptcha_register))}${switchRow('recaptcha_forgot', __('On forgot password', 'bulk-sms-portal'), '', Number(d.recaptcha_forgot))}</div>
      <div class="bx-fields bx-mt-s">${fieldHtml('ps-rsite', __('Site key', 'bulk-sms-portal'), d.recaptcha_site_key, { mono: true })}${fieldHtml('ps-rsecret', __('Secret key', 'bulk-sms-portal'), '', { type: 'password', mono: true, hint: d.recaptcha_secret_set ? __('Saved. Leave blank to keep it.', 'bulk-sms-portal') : __('Not saved yet.', 'bulk-sms-portal') })}</div>`;
    else if (t === 'features') body = `
      <p class="bx-muted">${__('What customers can use. You can make exceptions for one customer in Users & Wallets. Admins can always use every admin page.', 'bulk-sms-portal')}</p>
      <div class="bx-rows bx-mt-m">${PS_FEATURES.map(([k, l]) => switchRow(k, l, '', Number(d[k]))).join('')}</div>
      <h3 class="bx-mt-m">${__('Limits for each customer', 'bulk-sms-portal')}</h3><p class="bx-small bx-muted">${__('0 means no limit.', 'bulk-sms-portal')}</p>
      <div class="bx-fields">${Object.keys(LIMIT_WORDS).map(k => fieldHtml('ps-lim-' + k, LIMIT_WORDS[k], d['limit_' + k] ?? 0, { type: 'number', attrs: `min="0" data-bx-plim="${k}"` })).join('')}</div>`;
    else body = `
      <div class="bx-fields">${fieldHtml('ps-rate', __('API requests allowed per minute', 'bulk-sms-portal'), d.api_rate_limit, { type: 'number', hint: __('For each customer connecting a website or app.', 'bulk-sms-portal') })}
      ${fieldHtml('ps-success', __('Count a sent message as successful after', 'bulk-sms-portal'), String(d.success_after_minutes ?? 60), { options: [['0', __('Straight away', 'bulk-sms-portal')], ['30', '30 minutes'], ['60', '1 hour'], ['240', '4 hours'], ['1440', '24 hours']], hint: __('If the SMS service has not reported a failure by then. A failure reported later still marks it failed and returns the charge.', 'bulk-sms-portal') })}
      ${fieldHtml('ps-logs', __('Keep logs for', 'bulk-sms-portal'), String(d.log_retention_days ?? 180), { options: [['30', '30 days'], ['90', '90 days'], ['180', '6 months'], ['365', '1 year'], ['0', __('Always', 'bulk-sms-portal')]], hint: __('Activity Log, alerts sent and connection logs. Messages, payments and wallet history are always kept.', 'bulk-sms-portal') })}</div>
      <div class="bx-rows bx-mt-m">${switchRow('delete_data_on_uninstall', __('Delete all data if the plugin is removed', 'bulk-sms-portal'), __('Wallets, messages and settings are deleted for good. Leave off unless you are sure.', 'bulk-sms-portal'), Number(d.delete_data_on_uninstall))}</div>`;
    box.innerHTML = `${tabs(PS_TABS, t)}<section class="bx-panel bx-section"><form class="bx-stack" data-bx-ps-form novalidate>${body}<div class="bx-row-flex"><button type="submit" class="bx-btn is-primary">${sprintf(/* translators: %s: a value filled in when shown */ __('Save %s settings', 'bulk-sms-portal'), esc(nameOf(PS_TABS, t).toLowerCase()))}</button></div><div data-bx-ps-msg aria-live="polite"></div></form></section>`;
    $$('[data-bx-tab]', box).forEach(b => b.onclick = () => { adPs.tab = b.dataset.bxTab; draw(); });
    const form = $('[data-bx-ps-form]', box);
    if (t === 'branding') {
      const pick = $('[data-bx-logo-pick]', form);
      if (pick) pick.onclick = () => { const f = wp.media({ title: __('Choose your logo', 'bulk-sms-portal'), button: { text: __('Use this logo', 'bulk-sms-portal') }, library: { type: 'image' }, multiple: false }); f.on('select', () => { const a = f.state().get('selection').first().toJSON(); $('#ps-logo-id', form).value = a.id; $('#ps-logo', form).value = a.url; $('[data-bx-logo-prev]', form).innerHTML = `<img src="${esc(a.url)}" alt="${esc(__('Chosen logo', 'bulk-sms-portal'))}">`; }); f.open(); };
      $('[data-bx-logo-clear]', form).onclick = () => { $('#ps-logo-id', form).value = 0; $('#ps-logo', form).value = ''; $('[data-bx-logo-prev]', form).innerHTML = `<span class="bx-muted bx-small">${__('No logo', 'bulk-sms-portal')}</span>`; };
    }
    if (t === 'funding') {
      $('[data-bx-bank-add]', form).onclick = () => { const wrap = $('[data-bx-banks]', form); wrap.insertAdjacentHTML('beforeend', bankRow({ currency: S0.payments && S0.payments.currency || 'NGN', active: 1 }, wrap.children.length)); bindBankRemove(form); };
      bindBankRemove(form);
    }
    form.onsubmit = async e => {
      e.preventDefault();
      const sw = k => { const el = $(`[data-bx-set="${k}"]`, form); return el && el.checked ? 1 : 0; };
      let data = {};
      if (t === 'branding') data = { brand_name: val(form, 'ps-brand'), portal_slug: val(form, 'ps-slug'), logo_url: val(form, 'ps-logo'), logo_attachment_id: Number(val(form, 'ps-logo-id') || 0), sidebar_brand_display: val(form, 'ps-display'), support_email: val(form, 'ps-support'), transactional_from_email: val(form, 'ps-from'), admin_notification_email: val(form, 'ps-adminmail'), default_sender: val(form, 'ps-sender'), primary_color: val(form, 'ps-primary_color'), secondary_color: val(form, 'ps-secondary_color'), background_color: val(form, 'ps-background_color'), surface_color: val(form, 'ps-surface_color') };
      else if (t === 'payments') data = { currency: val(form, 'ps-cur'), minimum: val(form, 'ps-min'), maximum: val(form, 'ps-max'), quick_amounts: val(form, 'ps-quick'), test_mode: sw('test_mode'), paystack: sw('paystack'), paystack_public_key: val(form, 'ps-pk'), paystack_secret: val(form, 'ps-sk') };
      if (window.wp && wp.hooks) data = wp.hooks.applyFilters('bsms.settingsData', data, t, form, sw);
      else if (t === 'funding') data = { accounts: $$('[data-bx-bank]', form).map(row => ({ bank: $('[data-k="bank"]', row).value, account_name: $('[data-k="account_name"]', row).value, account_number: $('[data-k="account_number"]', row).value, currency: $('[data-k="currency"]', row).value, instructions: $('[data-k="instructions"]', row).value, active: $('[data-k="active"]', row).checked ? 1 : 0 })), instructions: val(form, 'ps-finstr') };
      else if (t === 'security') data = { honeypot: sw('honeypot'), min_form_seconds: val(form, 'ps-minsec'), recaptcha_enabled: sw('recaptcha_enabled'), recaptcha_login: sw('recaptcha_login'), recaptcha_register: sw('recaptcha_register'), recaptcha_forgot: sw('recaptcha_forgot'), recaptcha_site_key: val(form, 'ps-rsite'), recaptcha_secret: val(form, 'ps-rsecret') };
      else if (t === 'features') { PS_FEATURES.forEach(([k]) => { data[k] = sw(k); }); $$('[data-bx-plim]', form).forEach(i => { data['limit_' + i.dataset.bxPlim] = Math.max(0, Number(i.value || 0)); }); }
      else data = { api_rate_limit: val(form, 'ps-rate'), log_retention_days: Number(val(form, 'ps-logs')), success_after_minutes: Number(val(form, 'ps-success')), delete_data_on_uninstall: sw('delete_data_on_uninstall') };
      if (t === 'payments' && data.test_mode && !await confirmBox({ title: __('Turn on test mode?', 'bulk-sms-portal'), body: `<p>${__('Payments made in test mode are not real money. Customers could add credit without paying. Only use it on a test site.', 'bulk-sms-portal')}</p>`, confirm: __('Turn on test mode', 'bulk-sms-portal'), danger: true })) return;
      if (t === 'system' && data.delete_data_on_uninstall && !(S0.system || {}).delete_data_on_uninstall && !await confirmBox({ title: __('Delete everything if the plugin is removed?', 'bulk-sms-portal'), body: `<p>${__('All wallets, messages, payments and settings will be deleted for good when the plugin is deleted.', 'bulk-sms-portal')}</p>`, confirm: __('Yes, turn this on', 'bulk-sms-portal'), danger: true })) return;
      const done = busy($('button[type="submit"]', form), __('Saving…', 'bulk-sms-portal'));
      const res = await C.api('/admin/platform-settings', { method: 'POST', body: JSON.stringify({ section: t, data }) });
      done();
      if (res && res.ok) { Object.assign(S0[t] = S0[t] || {}, data); $('[data-bx-ps-msg]', form).innerHTML = note('good', __('Settings saved', 'bulk-sms-portal'), t === 'branding' ? __('Refresh the page to see brand changes in the menu.', 'bulk-sms-portal') : ''); }
      else $('[data-bx-ps-msg]', form).innerHTML = note('bad', __('Not saved', 'bulk-sms-portal'), esc(friendly(res)));
    };
  };
  draw();
});
function bankRow(a, i) {
  return `<div class="bx-panel is-sunken" data-bx-bank><div class="bx-fields">
    <label class="bx-field"><span class="bx-label">${__('Bank', 'bulk-sms-portal')}</span><input class="bx-input" data-k="bank" value="${esc(a.bank || '')}"></label>
    <label class="bx-field"><span class="bx-label">${__('Account name', 'bulk-sms-portal')}</span><input class="bx-input" data-k="account_name" value="${esc(a.account_name || '')}"></label>
    <label class="bx-field"><span class="bx-label">${__('Account number', 'bulk-sms-portal')}</span><input class="bx-input" data-k="account_number" inputmode="numeric" value="${esc(a.account_number || '')}"></label>
    <label class="bx-field"><span class="bx-label">${__('Currency', 'bulk-sms-portal')}</span><input class="bx-input" data-k="currency" value="${esc(a.currency || 'NGN')}"></label></div>
    <label class="bx-field bx-mt-s"><span class="bx-label">${__('Note for customers', 'bulk-sms-portal')} <span class="bx-optional">${__('(optional)', 'bulk-sms-portal')}</span></span><input class="bx-input" data-k="instructions" value="${esc(a.instructions || '')}"></label>
    <div class="bx-row-flex is-between bx-mt-s"><label class="bx-check"><input type="checkbox" data-k="active" ${Number(a.active ?? 1) ? 'checked' : ''}><span>${__('Show to customers', 'bulk-sms-portal')}</span></label>${btn(icon('trash', 16) + __('Remove', 'bulk-sms-portal'), 'data-bx-bank-rm', 'is-small is-quiet')}</div></div>`;
}
function bindBankRemove(form) { $$('[data-bx-bank-rm]', form).forEach(b => b.onclick = () => b.closest('[data-bx-bank]').remove()); }


/* ---- 198-admin-checks.js ---- */
/* ==========================================================================
   System Checks
   ========================================================================== */
/* Plain names and where to fix each check. */
const CHECK_HELP = {
  'Database': [__('Database', 'bulk-sms-portal'), ''],
  'Cron': [__('Automatic background work', 'bulk-sms-portal'), __('If this is off, scheduled sends and result checks do not run. Ask your host to enable WordPress cron.', 'bulk-sms-portal')],
  'Frontend Admin': [__('Admin pages in the portal', 'bulk-sms-portal'), 'admin-settings'],
  'Payments': [__('Online payments', 'bulk-sms-portal'), 'admin-settings'],
  'Sender ID': [__('Shared sender name', 'bulk-sms-portal'), 'admin-senders'],
  'Provider APIs': [__('SMS services', 'bulk-sms-portal'), 'admin-apis'],
  'Delivery results': [__('Delivery results from SMS services', 'bulk-sms-portal'), 'admin-apis'],
  'Payment receipt privacy': [__('Payment receipts kept private', 'bulk-sms-portal'), ''],
  'Wallet balances match the ledger': [__('Wallet balances add up', 'bulk-sms-portal'), 'admin-users'],
  'Paystack keys are live': [__('Paystack keys', 'bulk-sms-portal'), 'admin-settings'],
  'Messages closed without confirmation (30 days)': [__('Messages charged without a result', 'bulk-sms-portal'), 'history'],
  'Online payments credited once': [__('Online payments added only once', 'bulk-sms-portal'), 'admin-credit']
};
const ACTIVITY_WORDS = { dlr_poll_ran: __('Checked delivery results', 'bulk-sms-portal'), platform_settings_saved: __('Changed platform settings', 'bulk-sms-portal') };
adminPage('admin-monitoring', 'System Checks', async (host, ctx) => {
  const root = mount(host, `${pageHead(__('System Checks', 'bulk-sms-portal'), __('Anything that could stop messages going out or payments coming in.', 'bulk-sms-portal'), btn(icon('refresh', 18) + __('Run checks again', 'bulk-sms-portal'), 'data-bx-rerun'))}<div data-bx-sc>${skeleton(8)}</div>`);
  $('[data-bx-rerun]', root).onclick = () => C.show('admin-monitoring', false);
  const [h, b, a, d] = await Promise.all([C.api('/admin/platform-health'), C.api('/admin/api-balances'), C.api('/admin/activity'), C.api('/admin/dlr/diagnostics')]);
  if (!ctx.live()) return;
  const box = $('[data-bx-sc]', root);
  const checks = (h && h.ok && h.checks) || [];
  const bad = checks.filter(c => c.status !== 'healthy');
  const svcs = (b && b.ok && b.items) || [];
  const acts = ((a && a.ok && a.items) || []).slice(0, 12);
  box.innerHTML = `
    ${h && h.ok ? (bad.length ? note('wait', `${sprintf(/* translators: %s: a value filled in when shown */ __('%s to look at', 'bulk-sms-portal'), sprintf(/* translators: %s: a number */ _n('%s thing', '%s things', Number(bad.length), 'bulk-sms-portal'), num(bad.length)))}`, `${sprintf(/* translators: %1$s, %2$s: values filled in when shown */ __('%1$s of %2$s checks are fine.', 'bulk-sms-portal'), checks.length - bad.length, checks.length)}`) : note('good', __('Everything checked is fine', 'bulk-sms-portal'), `${sprintf(/* translators: %s: a value filled in when shown */ __('All %s checks passed.', 'bulk-sms-portal'), checks.length)}`)) : note('bad', __('We could not run the checks', 'bulk-sms-portal'), esc(friendly(h)))}
    <section class="bx-section" aria-labelledby="bx-sc-list"><div class="bx-section-head"><h2 id="bx-sc-list">${__('Checks', 'bulk-sms-portal')}</h2></div>
      <div class="bx-list">${checks.map(c => { const help = CHECK_HELP[c.label] || [c.label, '']; const ok = c.status === 'healthy'; const fix = help[1] && /^[a-z-]+$/.test(help[1]) ? help[1] : ''; return `<div class="bx-tr" style="--cols:28px minmax(0,1fr) 150px"><span class="bx-tick-sm ${ok ? 'is-ok' : 'is-warn'}" aria-hidden="true">${icon(ok ? 'check' : 'alert', 16, 2.2)}</span><span class="bx-td-main bx-td-lead"><strong>${esc(help[0])}</strong><small>${esc(c.detail || '')}${!ok && help[1] && !fix ? ' ' + esc(help[1]) : ''}</small></span><span class="bx-td-actions">${!ok && fix ? btn(__('Fix this', 'bulk-sms-portal'), `data-bx-go="${fix}"`, 'is-small') : pill(ok ? 'good' : 'wait', ok ? __('Fine', 'bulk-sms-portal') : __('Look at this', 'bulk-sms-portal'))}</span></div>`; }).join('') || `<div class="bx-line-item bx-muted">${__('No checks returned.', 'bulk-sms-portal')}</div>`}</div></section>
    <div class="bx-section bx-split is-even">
      <section class="bx-panel is-flush" aria-labelledby="bx-sc-svc"><div class="bx-panel-head"><div><h2 id="bx-sc-svc">${__('SMS services', 'bulk-sms-portal')}</h2></div>${btn(__('Open SMS Services', 'bulk-sms-portal'), 'data-bx-go="admin-apis"', 'is-quiet is-small')}</div>
        <div class="bx-rows">${svcs.length ? svcs.map(s => { const bv = String(s.balance || '').trim(); const has = bv && !/not available/i.test(bv); return `<div class="bx-line-item"><div class="bx-td-main"><strong>${esc(s.name)}</strong><small>${Number(s.active) ? 'On' : __('Off', 'bulk-sms-portal')}${s.last_checked ? __(', checked ', 'bulk-sms-portal') + esc(fmtDate(s.last_checked)) : ''}</small></div><span>${has ? `<b class="bx-num">${esc(bv)}</b>` : `<span class="bx-muted">${__('Balance not shared', 'bulk-sms-portal')}</span>`}</span></div>`; }).join('') : `<div class="bx-line-item bx-muted">${__('No SMS service set up.', 'bulk-sms-portal')}</div>`}</div></section>
      <section class="bx-panel is-flush" aria-labelledby="bx-sc-dlr"><div class="bx-panel-head"><div><h2 id="bx-sc-dlr">${__('Delivery results', 'bulk-sms-portal')}</h2></div>${btn(icon('refresh', 16) + __('Check results now', 'bulk-sms-portal'), 'data-bx-sc-sync', 'is-small')}</div>
        ${d && d.ok ? `<dl class="bx-kv bx-pad">${[[__('Messages waiting for a result', 'bulk-sms-portal'), num(d.pending_dlr)], [__('Automatic checking', 'bulk-sms-portal'), d.cron_scheduled ? 'On' : __('Off', 'bulk-sms-portal')], [__('Last checked', 'bulk-sms-portal'), d.last_sync ? fmtDate(d.last_sync) : __('Not yet', 'bulk-sms-portal')], [__('Next check', 'bulk-sms-portal'), d.next_cron ? fmtDate(d.next_cron) : '—']].map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : `<p class="bx-line-item bx-muted">${__('Not available.', 'bulk-sms-portal')}</p>`}</section>
    </div>
    <div class="bx-section bx-split is-even">
      <section class="bx-panel is-flush" aria-labelledby="bx-sc-act"><div class="bx-panel-head"><div><h2 id="bx-sc-act">${__('Recent activity', 'bulk-sms-portal')}</h2><p>${__('Changes and background work, newest first.', 'bulk-sms-portal')}</p></div></div>
        <div class="bx-rows">${acts.length ? acts.map(x => `<div class="bx-line-item"><div class="bx-td-main"><strong>${esc(ACTIVITY_WORDS[x.action] || String(x.action || '').replace(/_/g, ' ').replace(/^\w/, m => m.toUpperCase()))}</strong><small>${esc(x.message || '')}</small></div><small class="bx-muted">${esc(fmtDate(x.created_at))}</small></div>`).join('') : `<div class="bx-line-item bx-muted">${__('No activity recorded.', 'bulk-sms-portal')}</div>`}</div></section>
      <section class="bx-panel" aria-labelledby="bx-sc-ver"><div class="bx-panel-head"><div><h2 id="bx-sc-ver">${__('Versions', 'bulk-sms-portal')}</h2><p>${__('Useful when you contact support.', 'bulk-sms-portal')}</p></div></div>
        <dl class="bx-kv">${[[__('This plugin', 'bulk-sms-portal'), h && h.version], ['WordPress', h && h.wordpress], ['PHP', h && h.php]].map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v || '—')}</dd></div>`).join('')}</dl></section>
    </div>`;
  bindGo(box);
  const sy = $('[data-bx-sc-sync]', box);
  if (sy) sy.onclick = async () => { const done = busy(sy, __('Checking…', 'bulk-sms-portal')); const r = await C.api('/admin/dlr/sync', { method: 'POST', body: '{}', timeout: 60000 }); done(); toast(r && r.ok ? __('Results checked.', 'bulk-sms-portal') : friendly(r, __('Results could not be checked.', 'bulk-sms-portal')), r && r.ok ? '' : 'bad'); C.show('admin-monitoring', false); };
});


/* ---- 199-admin-tools.js ---- */
/* ==========================================================================
   v3.6.1 — More admin tools: Setup Guide and Activity Log. Each runs in the
   portal and in WordPress admin (same page, same data). Add-ons register more
   tools through window.BSMS_KIT (see the end of the built portal-app.js).
   ========================================================================== */
const toolBack = () => btn(icon('arrowLeft', 16) + __('Admin Dashboard', 'bulk-sms-portal'), 'data-bx-go="admin-dashboard"', 'is-quiet is-small');

/* ---- Setup Guide -------------------------------------------------------- */
adminPage('admin-setup', 'Setup Guide', async (host, ctx) => {
  const root = mount(host, `${toolBack()}${pageHead(__('Setup Guide', 'bulk-sms-portal'), __('The things to set up before customers can sign in, pay and send. Each step opens the page where you do it.', 'bulk-sms-portal'))}<div data-bx-su>${skeleton(6)}</div>`);
  bindGo(root);
  const r = await C.api('/admin/setup');
  if (!ctx.live()) return;
  const box = $('[data-bx-su]', root);
  if (!r || !r.ok) { box.innerHTML = note('bad', __('We could not check your setup', 'bulk-sms-portal'), esc(friendly(r))); return; }
  const left = r.total - r.done;
  box.innerHTML = `
    ${left ? note('wait', `${sprintf(/* translators: %s: a number */ _n('%s step', '%s steps', Number(left), 'bulk-sms-portal'), num(left))} left`, `${sprintf(/* translators: %1$s, %2$s: values filled in when shown */ __('%1$s of %2$s done.', 'bulk-sms-portal'), num(r.done), num(r.total))}`) : note('good', __('Everything is set up', 'bulk-sms-portal'), __('Customers can sign in, pay and send.', 'bulk-sms-portal'))}
    <section class="bx-section bx-panel"><ol class="bx-checklist">${r.steps.map((s, i) => `<li class="${s.done ? 'is-ok' : ''}"><span class="bx-tick${s.done ? '' : ' bx-tick-num'}">${s.done ? icon('check', 16, 2.4) : i + 1}</span><div><span class="bx-check-title">${esc(s.title)}</span><p class="bx-small bx-muted">${esc(s.text)}</p></div>${s.url ? `<a class="bx-btn is-small${s.done ? '' : ' is-primary'}" href="${esc(s.url)}"${s.done ? ' target="_blank" rel="noopener"' : ''}>${s.done ? __('Open', 'bulk-sms-portal') : __('Set up', 'bulk-sms-portal')}</a>` : btn(s.done ? __('Change', 'bulk-sms-portal') : __('Set up', 'bulk-sms-portal'), `data-bx-su-go="${esc(s.page)}" data-tab="${esc(s.tab || '')}"`, 'is-small' + (s.done ? '' : ' is-primary'))}</li>`).join('')}</ol></section>`;
  $$('[data-bx-su-go]', box).forEach(b => b.onclick = () => goTab(b.dataset.bxSuGo, b.dataset.tab));
});

/* ---- Activity Log ------------------------------------------------------- */
const adAct = { tab: 'admin', q: '', status: '', channel: '' };
adminPage('admin-activity', 'Activity Log', async (host, ctx) => {
  const fromHash = tabFromHash(['admin', 'notifications']); if (fromHash) adAct.tab = fromHash;
  const root = mount(host, `${toolBack()}${pageHead(__('Activity Log', 'bulk-sms-portal'), __('A record of changes made on the platform, and of every alert sent to customers by email or SMS.', 'bulk-sms-portal'))}
    ${tabs([['admin', __('Changes and sign-ins', 'bulk-sms-portal')], ['notifications', __('Alerts sent to customers', 'bulk-sms-portal')]], adAct.tab)}
    <form class="bx-filters bx-mt-m" role="search" data-bx-act-form>
      <div class="bx-field"><label class="bx-label" for="bx-act-q">${__('Search', 'bulk-sms-portal')}</label><input id="bx-act-q" class="bx-input" type="search" value="${esc(adAct.q)}" placeholder="${adAct.tab === 'admin' ? __('What happened, who, or an internet address', 'bulk-sms-portal') : __('Subject, message or customer', 'bulk-sms-portal')}"></div>
      ${adAct.tab === 'notifications' ? fieldHtml('bx-act-st', __('Result', 'bulk-sms-portal'), adAct.status, { options: [['', __('Any result', 'bulk-sms-portal')], ['sent', __('Sent', 'bulk-sms-portal')], ['failed', __('Not sent', 'bulk-sms-portal')], ['queued', __('Waiting', 'bulk-sms-portal')], ['skipped', __('Skipped', 'bulk-sms-portal')]] }) + fieldHtml('bx-act-ch', __('Sent by', 'bulk-sms-portal'), adAct.channel, { options: [['', __('Email or SMS', 'bulk-sms-portal')], ['email', __('Email', 'bulk-sms-portal')], ['sms', 'SMS']] }) : ''}
      <div class="bx-filter-actions"><button type="submit" class="bx-btn is-primary">${sprintf(/* translators: %s: a value filled in when shown */ __('%sSearch', 'bulk-sms-portal'), icon('search', 18))}</button></div>
    </form>
    <div data-bx-act>${loading()}</div>`);
  bindGo(root);
  $$('[data-bx-tab]', root).forEach(b => b.onclick = () => { adAct.tab = b.dataset.bxTab; adAct.q = ''; C.show('admin-activity', false); });
  const form = $('[data-bx-act-form]', root);
  form.onsubmit = (e) => { e.preventDefault(); adAct.q = val(root, 'bx-act-q').trim(); adAct.status = val(root, 'bx-act-st') || ''; adAct.channel = val(root, 'bx-act-ch') || ''; load(1); };
  $$('select', form).forEach(s => s.onchange = () => form.requestSubmit());
  async function load(pg) {
    const box = $('[data-bx-act]', root);
    box.innerHTML = loading();
    const q = new URLSearchParams({ page: pg, per_page: 30 });
    if (adAct.q) q.set('search', adAct.q);
    if (adAct.tab === 'notifications') { if (adAct.status) q.set('status', adAct.status); if (adAct.channel) q.set('channel', adAct.channel); }
    const r = await C.api((adAct.tab === 'admin' ? '/admin/activity-log?' : '/admin/notification-log?') + q);
    if (!ctx.live()) return;
    if (!r || !r.ok) { box.innerHTML = note('bad', __('We could not load the log', 'bulk-sms-portal'), esc(friendly(r))); return; }
    if (pageBack(r, pg, load)) return;
    const items = r.items || [];
    if (!items.length) { box.innerHTML = `<div class="bx-list">${empty('list', __('Nothing found', 'bulk-sms-portal'), adAct.q ? __('Try a different search.', 'bulk-sms-portal') : __('Entries will appear here as things happen.', 'bulk-sms-portal'))}</div>`; return; }
    if (adAct.tab === 'admin') {
      const cols = '1fr 1.1fr 2.6fr 0.9fr';
      box.innerHTML = `<div class="bx-list"><div class="bx-tr is-head" style="--cols:${cols}"><span>${__('When', 'bulk-sms-portal')}</span><span>${__('Who', 'bulk-sms-portal')}</span><span>${__('What happened', 'bulk-sms-portal')}</span><span>${__('From', 'bulk-sms-portal')}</span></div>
        ${items.map(x => `<div class="bx-tr" style="--cols:${cols}"><span data-label="${esc(__('When', 'bulk-sms-portal'))}">${esc(fmtDate(x.date))}</span><span class="bx-td-main" data-label="${esc(__('Who', 'bulk-sms-portal'))}"><strong>${esc(x.by)}</strong>${x.about && x.about !== x.by ? `<small>${sprintf(/* translators: %s: a value filled in when shown */ __('About %s', 'bulk-sms-portal'), esc(x.about))}</small>` : ''}</span><span class="bx-td-main bx-td-lead" data-label="${esc(__('What happened', 'bulk-sms-portal'))}"><span class="bx-break">${esc(x.message)}</span></span><span class="bx-mono bx-small" data-label="${esc(__('From', 'bulk-sms-portal'))}">${esc(x.ip || '—')}</span></div>`).join('')}
        ${pager(r)}</div>`;
    } else {
      const cols = '1fr 1.2fr 2.4fr 0.7fr 0.8fr';
      const tone = { sent: ['good', __('Sent', 'bulk-sms-portal')], failed: ['bad', __('Not sent', 'bulk-sms-portal')], queued: ['wait', __('Waiting', 'bulk-sms-portal')], skipped: ['info', __('Skipped', 'bulk-sms-portal')] };
      box.innerHTML = `<div class="bx-list"><div class="bx-tr is-head" style="--cols:${cols}"><span>${__('When', 'bulk-sms-portal')}</span><span>${__('Customer', 'bulk-sms-portal')}</span><span>${__('Alert', 'bulk-sms-portal')}</span><span>By</span><span>${__('Result', 'bulk-sms-portal')}</span></div>
        ${items.map(x => { const t = tone[x.status] || ['info', x.status]; return `<div class="bx-tr" style="--cols:${cols}"><span data-label="${esc(__('When', 'bulk-sms-portal'))}">${esc(fmtDate(x.date))}</span><span class="bx-td-main" data-label="${esc(__('Customer', 'bulk-sms-portal'))}"><strong>${esc(x.customer.name)}</strong><small class="bx-break">${esc(x.customer.email)}</small></span><span class="bx-td-main bx-td-lead" data-label="${esc(__('Alert', 'bulk-sms-portal'))}"><strong>${esc(x.subject || __('Alert', 'bulk-sms-portal'))}</strong><small class="bx-clip">${esc(x.message)}</small></span><span data-label="By">${x.channel === 'sms' ? 'SMS' : __('Email', 'bulk-sms-portal')}${x.cost_kobo ? `<small class="bx-muted"> ${esc(naira(x.cost_kobo))}</small>` : ''}</span><span data-label="${esc(__('Result', 'bulk-sms-portal'))}">${pill(t[0], t[1])}</span></div>`; }).join('')}
        ${pager(r)}</div>`;
    }
    bindPager(box, load);
  }
  load(1);
});


/* ---- 20-compose.js ---- */
/* ==========================================================================
   Send SMS
   ========================================================================== */
const DRAFT_KEY = 'bsms_compose_draft';
const compose = {
  mode: 'type', numbers: '', group: '', fileText: '', fileName: '',
  message: '', sender: '', route: 'normal', when: 'now', at: '', name: '',
  estimate: null, estimating: false, groups: null, timer: null, seq: 0, polling: null
};
/* Lets other pages open Send SMS with something already chosen. */
APP.composeWith = function (opts = {}) {
  if (opts.group) { compose.mode = 'group'; compose.group = String(opts.group); }
  if (opts.message) compose.message = String(opts.message);
  if (opts.numbers) { compose.mode = 'type'; compose.numbers = String(opts.numbers); }
  go('compose');
};

function routeChoices() {
  const ra = S().route_availability || {};
  return [
    { id: 'normal', title: __('Standard', 'bulk-sms-portal'), text: __('For most messages. Numbers on the Do Not Disturb list may not get it.', 'bulk-sms-portal'), ok: ra.normal !== false },
    { id: 'dnd', title: __('Reach Do Not Disturb numbers', 'bulk-sms-portal'), text: __('For important messages such as codes and alerts. Costs more.', 'bulk-sms-portal'), ok: !!ra.dnd }
  ];
}
function senderOptions() {
  const st = S();
  const approved = Array.isArray(st.approved_senders) ? st.approved_senders : [];
  if (approved.length) return { list: approved, own: true };
  return { list: st.default_sender ? [st.default_sender] : [], own: false };
}
page('compose', 'Send SMS', async (host, ctx) => {
  // Restore a saved draft once per visit, unless something was preset.
  const draft = store.get(DRAFT_KEY, null);
  if (draft && !compose.message && !compose.numbers) {
    compose.message = draft.message || ''; compose.numbers = draft.numbers || ''; compose.name = draft.name || '';
    if (draft.sender) compose.sender = draft.sender;
  }
  const senders = senderOptions();
  if (!senders.list.includes(compose.sender)) compose.sender = (S().default_sender && senders.list.includes(S().default_sender)) ? S().default_sender : (senders.list[0] || '');
  const routes = routeChoices();
  if (!routes.find(r => r.id === compose.route && r.ok)) compose.route = 'normal';
  const canSchedule = canUse('scheduled_sms');
  const canTemplates = canUse('templates');
  const tz = (S().timezone && S().timezone.offset) || '';

  const root = mount(host, `
    ${pageHead(__('Send SMS', 'bulk-sms-portal'), __('Choose who gets it, write your message, and check the cost before it goes.', 'bulk-sms-portal'), canTemplates ? btn(icon('list', 18) + __('Use a saved message', 'bulk-sms-portal'), 'data-bx-templates') : '')}
    <div class="bx-split">
      <div class="bx-panel">
        <section class="bx-step" aria-labelledby="bx-s1">
          <span class="bx-step-num">1</span>
          <div class="bx-step-title"><h2 id="bx-s1">${__('Who should get it?', 'bulk-sms-portal')}</h2><p>${__('Type numbers, pick a Phonebook group, or upload a file.', 'bulk-sms-portal')}</p></div>
          <div class="bx-step-body">
            <div class="bx-seg" role="group" aria-label="${esc(__('How to add numbers', 'bulk-sms-portal'))}">
              <button type="button" data-bx-mode="type">${__('Type numbers', 'bulk-sms-portal')}</button>
              <button type="button" data-bx-mode="group">${__('Phonebook group', 'bulk-sms-portal')}</button>
              <button type="button" data-bx-mode="file">${__('Upload a file', 'bulk-sms-portal')}</button>
            </div>
            <div class="bx-field" data-bx-panel="type">
              <label class="bx-label" for="bx-numbers">${__('Phone numbers', 'bulk-sms-portal')}</label>
              <textarea id="bx-numbers" class="bx-textarea" rows="5" placeholder="08031234567&#10;08051234567" autocomplete="off" spellcheck="false">${esc(compose.numbers)}</textarea>
              <span class="bx-hint">${__('One number per line, or separate them with commas. Nigerian numbers can start with 0 or 234.', 'bulk-sms-portal')}</span>
            </div>
            <div class="bx-field" data-bx-panel="group" hidden>
              <label class="bx-label" for="bx-group">${__('Phonebook group', 'bulk-sms-portal')}</label>
              <select id="bx-group" class="bx-select"><option value="">${__('Loading groups…', 'bulk-sms-portal')}</option></select>
              <span class="bx-hint" data-bx-group-hint>${__('Everyone in the group gets the message.', 'bulk-sms-portal')}</span>
            </div>
            <div class="bx-field" data-bx-panel="file" hidden>
              <label class="bx-file" for="bx-file">${icon('upload', 22)}<strong data-bx-file-name>${compose.fileName ? esc(compose.fileName) : __('Choose a file with phone numbers', 'bulk-sms-portal')}</strong><span class="bx-hint">${__('A spreadsheet saved as CSV, or a text file. Up to 2 MB.', 'bulk-sms-portal')}</span><input id="bx-file" type="file" accept=".csv,.txt,text/csv,text/plain"></label>
            </div>
            <div data-bx-recipients aria-live="polite"></div>
          </div>
        </section>
        <section class="bx-step" aria-labelledby="bx-s2">
          <span class="bx-step-num">2</span>
          <div class="bx-step-title"><h2 id="bx-s2">${__('Write your message', 'bulk-sms-portal')}</h2><p>${__('Keep it short and say who it is from.', 'bulk-sms-portal')}</p></div>
          <div class="bx-step-body">
            <div class="bx-field">
              <label class="bx-label" for="bx-sender">${__('Sender name', 'bulk-sms-portal')}</label>
              ${senders.list.length ? `<select id="bx-sender" class="bx-select">${senders.list.map(s => `<option value="${esc(s)}"${s === compose.sender ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select>` : `<input id="bx-sender" class="bx-input" value="" disabled placeholder="${esc(__('No sender name yet', 'bulk-sms-portal'))}">`}
              <span class="bx-hint">${senders.own ? __('The name people see as the sender.', 'bulk-sms-portal') : `${sprintf(/* translators: %s: a value filled in when shown */ __('You don\'t have your own sender name yet%s.', 'bulk-sms-portal'), senders.list.length ? `${sprintf(/* translators: %s: a value filled in when shown */ __(', so messages will show as %s', 'bulk-sms-portal'), esc(senders.list[0]))}` : '')} <button type="button" class="bx-link" data-bx-go="sender">${__('Ask for your own name', 'bulk-sms-portal')}</button>`}</span>
            </div>
            <div class="bx-field">
              <div class="bx-row-flex is-between"><label class="bx-label" for="bx-message">${__('Message', 'bulk-sms-portal')}</label>${canTemplates ? `<button type="button" class="bx-link bx-small" data-bx-save-template>${__('Save for later', 'bulk-sms-portal')}</button>` : ''}</div>
              <textarea id="bx-message" class="bx-textarea" rows="6" placeholder="${esc(__('Hello! Our weekend sale starts Friday…', 'bulk-sms-portal'))}">${esc(compose.message)}</textarea>
              <div class="bx-meter" data-bx-meter aria-live="polite"></div>
            </div>
            <div data-bx-special></div>
          </div>
        </section>
        <section class="bx-step" aria-labelledby="bx-s3">
          <span class="bx-step-num">3</span>
          <div class="bx-step-title"><h2 id="bx-s3">${__('When and how', 'bulk-sms-portal')}</h2><p>${__('Send now or choose a time.', 'bulk-sms-portal')}</p></div>
          <div class="bx-step-body">
            <div class="bx-seg" role="group" aria-label="${esc(__('When to send', 'bulk-sms-portal'))}">
              <button type="button" data-bx-when="now">${__('Send now', 'bulk-sms-portal')}</button>
              <button type="button" data-bx-when="later" ${canSchedule ? '' : 'disabled'}>${__('Send later', 'bulk-sms-portal')}</button>
            </div>
            ${canSchedule ? '' : `<span class="bx-hint">${__('Sending later is not available on your account.', 'bulk-sms-portal')}</span>`}
            <div class="bx-field" data-bx-later hidden>
              <label class="bx-label" for="bx-at">${__('Date and time', 'bulk-sms-portal')}</label>
              <input id="bx-at" type="datetime-local" class="bx-input" value="${esc(compose.at)}">
              <span class="bx-hint">${sprintf(/* translators: %s: a value filled in when shown */ __('%s You can see it in Delivery Reports until it goes.', 'bulk-sms-portal'), tz ? `${sprintf(/* translators: %s: a value filled in when shown */ __('In your account\'s time zone (UTC%s).', 'bulk-sms-portal'), esc(tz))}` : __('In your account\'s time zone.', 'bulk-sms-portal'))}</span>
            </div>
            <div class="bx-field">
              <span class="bx-label" id="bx-route-label">${__('Delivery', 'bulk-sms-portal')}</span>
              <div class="bx-choices" role="group" aria-labelledby="bx-route-label">
                ${routes.map(r => `<button type="button" class="bx-choice" data-bx-route="${r.id}" aria-pressed="${compose.route === r.id ? 'true' : 'false'}" ${r.ok ? '' : 'disabled aria-disabled="true"'}><strong>${esc(r.title)}</strong><span>${esc(r.ok ? r.text : __('Not available right now.', 'bulk-sms-portal'))}</span></button>`).join('')}
              </div>
            </div>
            <div class="bx-field">
              <label class="bx-label" for="bx-name">${__('Name this send', 'bulk-sms-portal')} <span class="bx-optional">${__('(optional, only you see it)', 'bulk-sms-portal')}</span></label>
              <input id="bx-name" class="bx-input" maxlength="80" value="${esc(compose.name)}" placeholder="${esc(__('For example: Weekend sale reminder', 'bulk-sms-portal'))}">
            </div>
          </div>
        </section>
      </div>
      <aside class="bx-aside" aria-label="${esc(__('Preview and cost', 'bulk-sms-portal'))}">
        <div class="bx-phone" aria-label="${esc(__('How your message will look', 'bulk-sms-portal'))}">
          <div class="bx-phone-screen">
            <div class="bx-phone-top"><span class="bx-phone-avatar" data-bx-avatar>A</span><span class="bx-phone-sender" data-bx-psender></span><span class="bx-phone-sub">${__('Text message', 'bulk-sms-portal')}</span></div>
            <div class="bx-phone-body"><div class="bx-phone-bubble" data-bx-bubble></div><span class="bx-phone-time">${__('Now', 'bulk-sms-portal')}</span></div>
          </div>
        </div>
        <div class="bx-slip" data-bx-slip aria-live="polite"></div>
      </aside>
    </div>`);
  bindGo(root);

  const el = {
    numbers: $('#bx-numbers', root), group: $('#bx-group', root), file: $('#bx-file', root), message: $('#bx-message', root),
    sender: $('#bx-sender', root), at: $('#bx-at', root), name: $('#bx-name', root), slip: $('[data-bx-slip]', root)
  };
  const saveDraft = () => store.set(DRAFT_KEY, { message: compose.message, numbers: compose.numbers, name: compose.name, sender: compose.sender });

  /* --- Recipients ------------------------------------------------------- */
  const setMode = (m) => {
    compose.mode = m;
    $$('[data-bx-mode]', root).forEach(b => b.setAttribute('aria-pressed', b.dataset.bxMode === m ? 'true' : 'false'));
    $$('[data-bx-panel]', root).forEach(p => { p.hidden = p.dataset.bxPanel !== m; });
    if (m === 'group') loadGroups();
    estimateSoon(0);
  };
  $$('[data-bx-mode]', root).forEach(b => b.onclick = () => setMode(b.dataset.bxMode));
  el.numbers.addEventListener('input', () => { compose.numbers = el.numbers.value; saveDraft(); estimateSoon(); });
  el.group.addEventListener('change', () => { compose.group = el.group.value; estimateSoon(0); });
  el.file.addEventListener('change', () => {
    const f = el.file.files && el.file.files[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { toast(__('That file is too big. Choose a file under 2 MB.', 'bulk-sms-portal'), 'bad'); el.file.value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => { compose.fileText = String(reader.result || ''); compose.fileName = f.name; $('[data-bx-file-name]', root).textContent = f.name; estimateSoon(0); };
    reader.onerror = () => toast(__('We could not read that file. Try saving it as CSV and upload again.', 'bulk-sms-portal'), 'bad');
    reader.readAsText(f);
  });
  async function loadGroups() {
    if (!compose.groups) {
      const r = await C.api('/groups');
      compose.groups = (r && r.ok && Array.isArray(r.items)) ? r.items : [];
    }
    if (!ctx.live()) return;
    const gs = compose.groups;
    el.group.innerHTML = gs.length ? `<option value="">${__('Choose a group', 'bulk-sms-portal')}</option>` + gs.map(g => `<option value="${esc(g.id)}"${String(g.id) === String(compose.group) ? ' selected' : ''}>${esc(g.group_name)} (${sprintf(/* translators: %s: a number */ _n('%s number', '%s numbers', Number(g.total || 0), 'bulk-sms-portal'), num(g.total || 0))})</option>`).join('') : `<option value="">${__('You have no groups yet', 'bulk-sms-portal')}</option>`;
    el.group.disabled = !gs.length;
    const hint = $('[data-bx-group-hint]', root);
    if (hint) hint.innerHTML = gs.length ? __('Everyone in the group gets the message.', 'bulk-sms-portal') : `${__('Save numbers in the Phonebook to text them as a group.', 'bulk-sms-portal')} <button type="button" class="bx-link" data-bx-go="groups">${__('Open Phonebook', 'bulk-sms-portal')}</button>`;
    bindGo(hint);
  }

  /* --- Message ---------------------------------------------------------- */
  const paintMessage = () => {
    const text = compose.message;
    const info = C.metrics(text);
    const pages = Math.max(info.pages, 0);
    const per = info.encoding === 'GSM-7' ? (pages <= 1 ? 160 : 153) : (pages <= 1 ? 70 : 67);
    const capacity = Math.max(1, pages) * per;
    const left = Math.max(0, capacity - info.units);
    $('[data-bx-meter]', root).innerHTML = text
      ? `<span><b>${num(info.length)}</b> ${__('characters,', 'bulk-sms-portal')} <b>${sprintf(/* translators: %s: a number */ _n('%s SMS page', '%s SMS pages', Number(pages), 'bulk-sms-portal'), num(pages))}</b></span><span class="${left < 15 ? 'is-warn' : ''}">${sprintf(/* translators: %s: a value filled in when shown */ __('%s characters left on this page', 'bulk-sms-portal'), num(left))}</span>`
      : `<span>${__('Up to 160 characters fit in one SMS page.', 'bulk-sms-portal')}</span>`;
    $('[data-bx-special]', root).innerHTML = info.encoding !== 'GSM-7' && text
      ? note('wait', __('Your message has special characters', 'bulk-sms-portal'), __('Letters like é or ñ, emoji and some symbols mean each SMS page holds 70 characters instead of 160, so this message may cost more. Replace them with plain letters to fit more in each page.', 'bulk-sms-portal'))
      : '';
    const bubble = $('[data-bx-bubble]', root);
    bubble.textContent = text || __('Your message will show here.', 'bulk-sms-portal');
    bubble.classList.toggle('is-empty', !text);
    const sender = compose.sender || __('Sender', 'bulk-sms-portal');
    $('[data-bx-psender]', root).textContent = sender;
    $('[data-bx-avatar]', root).textContent = (sender.trim()[0] || 'A').toUpperCase();
  };
  el.message.addEventListener('input', () => { compose.message = el.message.value; saveDraft(); paintMessage(); estimateSoon(); });
  if (el.sender && el.sender.tagName === 'SELECT') el.sender.addEventListener('change', () => { compose.sender = el.sender.value; saveDraft(); paintMessage(); });

  /* --- When / route / name ---------------------------------------------- */
  const setWhen = (w) => {
    compose.when = (w === 'later' && canSchedule) ? 'later' : 'now';
    $$('[data-bx-when]', root).forEach(b => b.setAttribute('aria-pressed', b.dataset.bxWhen === compose.when ? 'true' : 'false'));
    $('[data-bx-later]', root).hidden = compose.when !== 'later';
    if (compose.when === 'later' && !el.at.value) {
      const d = new Date(Date.now() + 60 * 60 * 1000); d.setMinutes(0, 0, 0);
      const p = n => String(n).padStart(2, '0');
      el.at.value = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
      compose.at = el.at.value;
    }
    paintSlip();
  };
  $$('[data-bx-when]', root).forEach(b => b.onclick = () => setWhen(b.dataset.bxWhen));
  el.at.addEventListener('change', () => { compose.at = el.at.value; paintSlip(); });
  $$('[data-bx-route]', root).forEach(b => b.onclick = () => {
    if (b.disabled) return;
    compose.route = b.dataset.bxRoute;
    $$('[data-bx-route]', root).forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    estimateSoon(0);
  });
  el.name.addEventListener('input', () => { compose.name = el.name.value; saveDraft(); });

  /* --- Saved messages --------------------------------------------------- */
  const tplBtn = $('[data-bx-templates]', root);
  if (tplBtn) tplBtn.onclick = async () => {
    const r = await C.api('/templates');
    const items = (r && r.ok && r.items) || [];
    openDialog(`<div class="bx-dialog-body"><h2>${__('Saved messages', 'bulk-sms-portal')}</h2>${items.length ? `<div class="bx-rows">${items.map(t => `<div class="bx-line-item"><div class="bx-td-main"><strong>${esc(t.title || __('Saved message', 'bulk-sms-portal'))}</strong><small class="bx-clip">${esc(t.body || '')}</small></div><span class="bx-row-flex">${btn(__('Use', 'bulk-sms-portal'), `data-bx-use="${esc(t.id)}"`, 'is-small is-primary')}${btn(__('Delete', 'bulk-sms-portal'), `data-bx-del="${esc(t.id)}"`, 'is-small is-quiet')}</span></div>`).join('')}</div>` : `<p>${__('You have no saved messages yet. Write a message, then choose “Save for later”.', 'bulk-sms-portal')}</p>`}</div><div class="bx-dialog-actions"><button type="button" class="bx-btn" data-bx-close>${__('Close', 'bulk-sms-portal')}</button></div>`, d => {
      $('[data-bx-close]', d).onclick = () => d.close();
      $$('[data-bx-use]', d).forEach(b => b.onclick = () => {
        const t = items.find(x => String(x.id) === b.dataset.bxUse);
        if (t) { compose.message = t.body || ''; el.message.value = compose.message; saveDraft(); paintMessage(); estimateSoon(0); }
        d.close();
      });
      $$('[data-bx-del]', d).forEach(b => b.onclick = async () => {
        const done = busy(b, __('Deleting', 'bulk-sms-portal'));
        const res = await C.api('/templates/' + encodeURIComponent(b.dataset.bxDel), { method: 'DELETE' });
        done();
        if (res && res.ok) { const row = b.closest('.bx-line-item'); if (row) row.remove(); toast(__('Saved message deleted.', 'bulk-sms-portal')); } else toast(friendly(res, __('We could not delete it.', 'bulk-sms-portal')), 'bad');
      });
    });
  };
  const saveTpl = $('[data-bx-save-template]', root);
  if (saveTpl) saveTpl.onclick = () => {
    if (!compose.message.trim()) { toast(__('Write a message first, then save it.', 'bulk-sms-portal'), 'bad'); el.message.focus(); return; }
    openDialog(`<form method="dialog"><div class="bx-dialog-body"><h2>${__('Save this message', 'bulk-sms-portal')}</h2><div class="bx-field"><label class="bx-label" for="bx-tpl-title">${__('Give it a name', 'bulk-sms-portal')}</label><input id="bx-tpl-title" class="bx-input" maxlength="80" required placeholder="${esc(__('For example: Order ready', 'bulk-sms-portal'))}"></div><p class="bx-small bx-muted">${__('You can use it again from “Use a saved message”.', 'bulk-sms-portal')}</p></div><div class="bx-dialog-actions"><button class="bx-btn" value="cancel">${__('Cancel', 'bulk-sms-portal')}</button><button class="bx-btn is-primary" value="ok" data-bx-tpl-save>${__('Save message', 'bulk-sms-portal')}</button></div></form>`, d => {
      const input = $('#bx-tpl-title', d); input.focus();
      $('[data-bx-tpl-save]', d).onclick = async (e) => {
        e.preventDefault();
        const title = input.value.trim();
        if (!title) { input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
        const done = busy(e.currentTarget, __('Saving', 'bulk-sms-portal'));
        const r = await C.api('/templates', { method: 'POST', body: JSON.stringify({ title, body: compose.message, category: 'custom' }) });
        done();
        if (r && r.ok) { d.close(); toast(__('Message saved.', 'bulk-sms-portal')); } else toast(friendly(r, __('We could not save it.', 'bulk-sms-portal')), 'bad');
      };
    });
  };

  /* --- Cost check ------------------------------------------------------- */
  function payload() {
    return {
      message: compose.message,
      numbers: compose.mode === 'type' ? compose.numbers : (compose.mode === 'file' ? compose.fileText : ''),
      csv_numbers: '',
      group_id: compose.mode === 'group' ? compose.group : '',
      route: compose.route
    };
  }
  function hasRecipients() {
    if (compose.mode === 'type') return compose.numbers.trim() !== '';
    if (compose.mode === 'group') return !!compose.group;
    return compose.fileText.trim() !== '';
  }
  function estimateSoon(delay = 450) {
    clearTimeout(compose.timer);
    if (!hasRecipients() || !compose.message.trim()) { compose.estimate = null; compose.estimating = false; paintRecipients(); paintSlip(); return; }
    compose.estimating = true; paintSlip();
    compose.timer = setTimeout(runEstimate, delay);
  }
  async function runEstimate() {
    const mine = ++compose.seq;
    const r = await C.api('/campaign/estimate', { method: 'POST', body: JSON.stringify(payload()) });
    if (mine !== compose.seq || !ctx.live()) return;
    compose.estimating = false;
    compose.estimate = r && r.ok !== false ? r : { ok: false, error: friendly(r, __('We could not work out the cost. Please try again.', 'bulk-sms-portal')) };
    paintRecipients(); paintSlip();
  }
  function paintRecipients() {
    const box = $('[data-bx-recipients]', root);
    const e = compose.estimate;
    if (!e || e.ok === false || !hasRecipients()) { box.innerHTML = ''; return; }
    const bits = [];
    if (Number(e.duplicates)) bits.push(`${sprintf(/* translators: %s: a number */ _n('%s repeated number', '%s repeated numbers', Number(e.duplicates), 'bulk-sms-portal'), num(e.duplicates))} removed`);
    if (Number(e.invalid)) bits.push(`${sprintf(/* translators: %s: a value filled in when shown */ __('%s that can\'t get SMS left out', 'bulk-sms-portal'), sprintf(/* translators: %s: a number */ _n('%s number', '%s numbers', Number(e.invalid), 'bulk-sms-portal'), num(e.invalid)))}`);
    const noSvc = Number(e.no_service || 0), noPrice = Number(e.no_rate || 0) - noSvc;
    if (noSvc) bits.push(`${sprintf(/* translators: %s: a value filled in when shown */ __('%s outside Nigeria left out: sending abroad is not available yet', 'bulk-sms-portal'), sprintf(/* translators: %s: a number */ _n('%s number', '%s numbers', Number(noSvc), 'bulk-sms-portal'), num(noSvc)))}`);
    if (noPrice > 0) bits.push(`${sprintf(/* translators: %1$s, %2$s: values filled in when shown */ __('%1$s left out: we don\'t send to %2$s yet', 'bulk-sms-portal'), sprintf(/* translators: %s: a number */ _n('%s number', '%s numbers', Number(noPrice), 'bulk-sms-portal'), num(noPrice)), noPrice === 1 ? 'that country' : 'those countries')}`);
    box.innerHTML = Number(e.valid)
      ? note((Number(e.invalid) || Number(e.no_rate)) ? 'wait' : (bits.length ? 'info' : 'good'), `${sprintf(/* translators: %s: a value filled in when shown */ __('%s will get this message', 'bulk-sms-portal'), sprintf(/* translators: %s: a number */ _n('%s person', '%s people', Number(e.valid), 'bulk-sms-portal'), num(e.valid)))}`, bits.length ? esc(bits.join('. ') + '.') : '')
      : note('bad', __('No phone numbers we can send to', 'bulk-sms-portal'), __('Check the numbers. Nigerian numbers have 11 digits starting with 0, or 13 digits starting with 234.', 'bulk-sms-portal'));
  }
  function paintSlip() {
    const e = compose.estimate;
    const bal = balanceKobo();
    const later = compose.when === 'later';
    const actionLabel = later ? __('Schedule SMS', 'bulk-sms-portal') : __('Send SMS', 'bulk-sms-portal');
    let rows = '', total = '₦0.00', foot = '', ready = false;
    if (compose.estimating) {
      rows = `<div class="bx-slip-row"><span>${__('Working out the cost…', 'bulk-sms-portal')}</span></div>`;
      total = '…';
    } else if (e && e.ok === false) {
      rows = `<div class="bx-slip-row is-bad"><span>${esc(e.error)}</span></div>`;
    } else if (e) {
      const short = Number(e.shortfall_kobo || 0);
      rows = `
        <div class="bx-slip-row"><span>${__('SMS pages each', 'bulk-sms-portal')}</span><b>${num(e.pages)}</b></div>
        ${(e.lines || []).map(l => `<div class="bx-slip-row"><span>${esc(String(l.label).replace(/^Nigeria · /, ''))}<small>${sprintf(/* translators: %s: a number */ _n('%s person', '%s people', Number(l.people), 'bulk-sms-portal'), num(l.people))} × ${esc(naira(l.unit_kobo))}${Number(e.pages) > 1 ? ' × ' + num(e.pages) : ''}</small></span><b>${esc(naira(l.total_kobo))}</b></div>`).join('') || `<div class="bx-slip-row"><span>${__('People', 'bulk-sms-portal')}</span><b>${num(e.valid)}</b></div>`}
        <div class="bx-slip-row"><span>${__('Wallet now', 'bulk-sms-portal')}</span><b>${esc(naira(e.balance_kobo ?? bal))}</b></div>
        ${Number(e.reserved_kobo) ? `<div class="bx-slip-row"><span>${__('Held for sends waiting to go', 'bulk-sms-portal')}</span><b>${esc(naira(-Math.abs(e.reserved_kobo)))}</b></div>` : ''}
        <div class="bx-slip-row ${short ? 'is-bad' : ''}"><span>${short ? __('You need', 'bulk-sms-portal') : __('Wallet after', 'bulk-sms-portal')}</span><b>${esc(short ? naira(short) + ' more' : naira(e.balance_after_kobo))}</b></div>`;
      total = naira(e.total_kobo);
      ready = !!e.can_send && Number(e.valid) > 0;
      if (short) foot = `${note('bad', __('Not enough money in your wallet', 'bulk-sms-portal'), `${sprintf(/* translators: %s: a value filled in when shown */ __('Add at least %s to send this.', 'bulk-sms-portal'), esc(naira(short)))}`)}${btn(__('Buy SMS', 'bulk-sms-portal'), 'data-bx-go="fund"', 'is-block')}`;
      if (e.sending_ready === false) { ready = false; foot = note('bad', __('Sending is not available right now', 'bulk-sms-portal'), __('Nothing will be sent or charged. Please contact support.', 'bulk-sms-portal')); }
    } else {
      rows = `<div class="bx-slip-row"><span>${hasRecipients() ? __('Write your message to see the cost.', 'bulk-sms-portal') : __('Add phone numbers to see the cost.', 'bulk-sms-portal')}</span></div>`;
    }
    if (later && !compose.at) ready = false;
    el.slip.innerHTML = `
      <div class="bx-slip-title"><span>${__('Cost before you send', 'bulk-sms-portal')}</span>${icon('receipt', 18)}</div>
      <div class="bx-slip-rows">${rows}</div>
      <span class="bx-slip-tear" aria-hidden="true"></span>
      <div class="bx-slip-total"><span>${__('Total', 'bulk-sms-portal')}</span><strong>${esc(total)}</strong></div>
      <div class="bx-slip-foot">
        ${foot}
        <button type="button" class="bx-btn is-primary is-large is-block" data-bx-send ${ready && senders.list.length ? '' : 'disabled'}>${icon('send', 18)}${actionLabel}</button>
        <span class="bx-hint">${__('If a message fails, its charge goes back to your wallet.', 'bulk-sms-portal')}</span>
      </div>`;
    bindGo(el.slip);
    const sendBtn = $('[data-bx-send]', el.slip);
    if (sendBtn) sendBtn.onclick = () => doSend(sendBtn);
  }

  /* --- Send ------------------------------------------------------------- */
  async function doSend(button) {
    const e = compose.estimate;
    if (!e || !e.can_send) return;
    const later = compose.when === 'later';
    if (later) {
      const t = new Date(compose.at);
      if (!compose.at || isNaN(t) || t.getTime() < Date.now() + 60 * 1000) { toast(__('Choose a time in the future.', 'bulk-sms-portal'), 'bad'); el.at.focus(); return; }
    }
    const whenText = later ? `on ${new Date(compose.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` : 'now';
    const ok = await confirmBox({
      title: later ? `${sprintf(/* translators: %s: a value filled in when shown */ __('Schedule %s?', 'bulk-sms-portal'), sprintf(/* translators: %s: a number */ _n('%s message', '%s messages', Number(e.valid), 'bulk-sms-portal'), num(e.valid)))}` : `${sprintf(/* translators: %s: a value filled in when shown */ __('Send %s now?', 'bulk-sms-portal'), sprintf(/* translators: %s: a number */ _n('%s message', '%s messages', Number(e.valid), 'bulk-sms-portal'), num(e.valid)))}`,
      body: `<dl class="bx-kv"><div><dt>${__('From', 'bulk-sms-portal')}</dt><dd>${esc(compose.sender)}</dd></div><div><dt>To</dt><dd>${sprintf(/* translators: %s: a number */ _n('%s person', '%s people', Number(e.valid), 'bulk-sms-portal'), num(e.valid))}</dd></div><div><dt>${__('When', 'bulk-sms-portal')}</dt><dd>${esc(whenText)}</dd></div><div><dt>${__('Cost', 'bulk-sms-portal')}</dt><dd>${esc(naira(e.total_kobo))}</dd></div></dl><p class="bx-small">${__('The cost is taken from your wallet. Charges for messages that fail come back to you.', 'bulk-sms-portal')}</p>`,
      confirm: later ? __('Schedule SMS', 'bulk-sms-portal') : __('Send SMS', 'bulk-sms-portal')
    });
    if (!ok) return;
    const done = busy(button, later ? __('Scheduling…', 'bulk-sms-portal') : __('Sending…', 'bulk-sms-portal'));
    const body = { ...payload(), sender_id: compose.sender, schedule_at: later ? compose.at : '', name: compose.name.trim() || (later ? __('Scheduled send', 'bulk-sms-portal') : __('Send on ', 'bulk-sms-portal') + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) };
    const r = await C.api('/campaign/send', { method: 'POST', timeout: 30000, body: JSON.stringify(body) });
    done();
    if (!r || r.ok !== true) {
      const msg = friendly(r, __('Your message was not sent and nothing was charged. Please try again.', 'bulk-sms-portal'));
      el.slip.insertAdjacentHTML('afterbegin', note('bad', __('Not sent', 'bulk-sms-portal'), esc(msg)));
      return;
    }
    store.del(DRAFT_KEY);
    const id = Number(r.campaign_id || 0);
    compose.message = ''; compose.numbers = ''; compose.fileText = ''; compose.fileName = ''; compose.name = ''; compose.estimate = null;
    C.load({ force: true });
    showResult(id, later, r, e);
  }

  function showResult(id, later, r, e) {
    const sent = Number(r.recipients || e.valid || 0);
    el.slip.innerHTML = `
      <div class="bx-slip-title"><span data-bx-live-title>${later ? __('Scheduled', 'bulk-sms-portal') : __('Sending', 'bulk-sms-portal')}</span>${icon(later ? 'calendar' : 'send', 18)}</div>
      <div data-bx-live>${later
        ? note('good', __('Your message is scheduled', 'bulk-sms-portal'), `${sprintf(/* translators: %1$s, %2$s: values filled in when shown */ __('%1$s will go %2$s. You can see it in Delivery Reports.', 'bulk-sms-portal'), sprintf(/* translators: %s: a number */ _n('%s message', '%s messages', Number(sent), 'bulk-sms-portal'), num(sent)), esc(new Date(compose.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })))}`)
        : `<div class="bx-slip-rows"><div class="bx-slip-row"><span>${__('Messages', 'bulk-sms-portal')}</span><b>${num(sent)}</b></div></div><p class="bx-small bx-muted">${__('Waiting for the networks to reply. This usually takes under a minute.', 'bulk-sms-portal')}</p>`}</div>
      <span class="bx-slip-tear" aria-hidden="true"></span>
      <div class="bx-slip-foot">
        ${id ? btn(__('See delivery report', 'bulk-sms-portal'), `data-bx-open-report="${id}"`, 'is-block') : ''}
        ${btn(__('Send another message', 'bulk-sms-portal'), 'data-bx-again', 'is-quiet is-block')}
      </div>`;
    const rep = $('[data-bx-open-report]', el.slip); if (rep) rep.onclick = () => APP.openReport(id);
    $('[data-bx-again]', el.slip).onclick = () => { clearInterval(compose.polling); C.show('compose', false); };
    if (later || !id) return;
    let tries = 0;
    clearInterval(compose.polling);
    const tick = async () => {
      tries++;
      const s = await C.api('/campaign/status/' + id, { timeout: 12000 });
      if (!ctx.live()) { clearInterval(compose.polling); return; }
      const live = $('[data-bx-live]', el.slip);
      if (!live || !s || !s.ok) return;
      const sm = s.summary || {};
      const good = Number(sm.success || 0) + Number(sm.sent || 0), bad = Number(sm.failed || 0);
      const waiting = Number(sm.queued || 0) + Number(sm.pending || 0);
      const total = Number(sm.total || (good + bad + waiting));
      const finished = waiting === 0 && ['sent', 'failed', 'partial'].includes(String((s.campaign && s.campaign.status) || '').toLowerCase());
      const title = !finished ? __('Sending…', 'bulk-sms-portal') : (bad === 0 ? __('All messages sent', 'bulk-sms-portal') : (good === 0 ? __('Your messages failed', 'bulk-sms-portal') : __('Some messages failed', 'bulk-sms-portal')));
      live.innerHTML = `
        ${finished ? note(bad === 0 ? 'good' : (good === 0 ? 'bad' : 'wait'), title, bad ? `${sprintf(/* translators: %s: a value filled in when shown */ __('Charges for the %s went back to your wallet.', 'bulk-sms-portal'), sprintf(/* translators: %s: a number */ _n('%s failed message', '%s failed messages', Number(bad), 'bulk-sms-portal'), num(bad)))}` : '') : ''}
        <div class="bx-slip-rows">
          ${bar([{ label: 'successful', value: good, tone: 'good' }, { label: 'failed', value: bad, tone: 'bad' }, { label: 'sending', value: waiting, tone: 'wait' }])}
          <div class="bx-slip-row is-good"><span>${__('Successful', 'bulk-sms-portal')}</span><b>${num(good)}</b></div>
          <div class="bx-slip-row ${bad ? 'is-bad' : ''}"><span>${__('Failed', 'bulk-sms-portal')}</span><b>${num(bad)}</b></div>
          ${waiting ? `<div class="bx-slip-row"><span>${__('Still sending', 'bulk-sms-portal')}</span><b>${num(waiting)}</b></div>` : ''}
          <div class="bx-slip-row"><span>${finished ? __('Final cost', 'bulk-sms-portal') : __('Cost so far', 'bulk-sms-portal')}</span><b>${esc(naira(sm.cost_kobo || 0))}</b></div>
        </div>
        ${!finished ? `<p class="bx-small bx-muted">${sprintf(/* translators: %1$s, %2$s: values filled in when shown */ __('Messages sent so far: %1$s of %2$s.', 'bulk-sms-portal'), num(good + bad), num(total))}</p>` : ''}`;
      if (finished) { const lt = $('[data-bx-live-title]', el.slip); if (lt) lt.textContent = __('Result', 'bulk-sms-portal'); }
      if (finished || tries >= 24) { clearInterval(compose.polling); if (finished) C.load({ force: true }); }
    };
    tick();
    compose.polling = setInterval(tick, 3000);
  }

  // First paint.
  setMode(compose.mode);
  setWhen(compose.when);
  paintMessage();
  paintRecipients();
  paintSlip();
});


/* ---- 30-fund.js ---- */
/* ==========================================================================
   Buy SMS
   ========================================================================== */
const fundState = { amount: 0, method: '', banner: '' };

function fundingSetup() {
  const f = S().funding || {};
  const online = (Array.isArray(f.gateways) ? f.gateways : []).filter(g => g && g.enabled && g.configured && g.supports_checkout);
  const banks = (Array.isArray(f.bank_accounts) ? f.bank_accounts : []).filter(b => b && b.active !== false && b.account_number);
  const min = Number(f.minimum_amount || 0), max = Number(f.maximum_amount || 0);
  const quick = (Array.isArray(f.quick_amounts) && f.quick_amounts.length ? f.quick_amounts : [1000, 2500, 5000, 10000, 25000])
    .map(Number).filter(v => v > 0 && (!min || v >= min) && (!max || v <= max));
  return { online, banks, min, max, quick, currency: f.currency || 'NGN' };
}
function amountProblem(v, fs) {
  const n = Number(v || 0);
  if (!n || n <= 0) return __('Enter how much you want to add.', 'bulk-sms-portal');
  if (fs.min > 0 && n < fs.min) return `${sprintf(/* translators: %s: a value filled in when shown */ __('The smallest amount you can add is %s.', 'bulk-sms-portal'), nairaWhole(fs.min))}`;
  if (fs.max > 0 && n > fs.max) return `${sprintf(/* translators: %s: a value filled in when shown */ __('The most you can add at once is %s.', 'bulk-sms-portal'), nairaWhole(fs.max))}`;
  return '';
}
const FUND_STATUS = {
  pending: ['wait', __('Waiting for us to check', 'bulk-sms-portal')], approved: ['good', __('Added to your wallet', 'bulk-sms-portal')], completed: ['good', __('Added to your wallet', 'bulk-sms-portal')],
  success: ['good', __('Added to your wallet', 'bulk-sms-portal')], rejected: ['bad', __('Not approved', 'bulk-sms-portal')], failed: ['bad', __('Not completed', 'bulk-sms-portal')], cancelled: ['bad', __('Cancelled', 'bulk-sms-portal')]
};

/* Coming back from the online payment page. */
APP.paymentReturn = async function () {
  const params = new URLSearchParams(location.search);
  const ref = params.get('reference') || params.get('trxref') || params.get('tx_ref') || params.get('paystack_reference') || '';
  if (!ref) return;
  // Which payment service sent the customer back (Paystack unless an add-on says otherwise).
  const provider = (params.get('bsms_payment') || 'paystack').replace(/[^a-z0-9_-]/g, '');
  const extra = { transaction_id: params.get('transaction_id') || '' };
  ['reference', 'trxref', 'tx_ref', 'transaction_id', 'status', 'paystack_reference', 'bsms_payment', 'payment_status'].forEach(k => params.delete(k));
  try { history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : '') + location.hash); } catch (e) {}
  fundState.banner = note('wait', __('Checking your payment…', 'bulk-sms-portal'), __('Please keep this page open.', 'bulk-sms-portal'));
  C.show('fund', false);
  const r = await C.api('/' + provider + '/verify', { method: 'POST', body: JSON.stringify(Object.assign({ reference: ref }, extra)) });
  try { sessionStorage.removeItem('bsms_paystack_reference'); } catch (e) {}
  if (r && r.ok) {
    await C.load({ force: true });
    fundState.banner = note('good', __('Payment received', 'bulk-sms-portal'), esc(r.message || __('The money has been added to your wallet.', 'bulk-sms-portal')) + ` <span class="bx-small bx-muted">${sprintf(/* translators: %s: a value filled in when shown */ __('Reference %s', 'bulk-sms-portal'), esc(ref))}</span>`, btn(__('Send SMS', 'bulk-sms-portal'), 'data-bx-go="compose"', 'is-primary is-small') + btn(__('See wallet history', 'bulk-sms-portal'), 'data-bx-go="transactions"', 'is-small'));
  } else {
    fundState.banner = note('bad', __('We could not confirm this payment yet', 'bulk-sms-portal'), esc(friendly(r, __('If money left your account, it will be added once the payment is confirmed.', 'bulk-sms-portal'))) + ` <span class="bx-small bx-muted">${sprintf(/* translators: %s: a value filled in when shown */ __('Reference %s', 'bulk-sms-portal'), esc(ref))}</span>`, btn(__('Check again', 'bulk-sms-portal'), `data-bx-recheck="${esc(ref)}"`, 'is-small'));
  }
  C.show('fund', false);
};

page('fund', 'Buy SMS', async (host, ctx) => {
  const fs = fundingSetup();
  const params = new URLSearchParams(location.search);
  const asked = Number(params.get('purchase_amount') || 0);
  if (!fundState.amount) fundState.amount = (asked && !amountProblem(asked, fs)) ? asked : (fs.quick.find(v => v >= 5000) || fs.quick[0] || fs.min || 1000);
  if (!fundState.method || (fundState.method === 'online' && !fs.online.length) || (fundState.method === 'bank' && !fs.banks.length)) fundState.method = fs.online.length ? 'online' : (fs.banks.length ? 'bank' : '');
  const banner = fundState.banner; fundState.banner = '';

  const root = mount(host, `
    ${pageHead(__('Buy SMS', 'bulk-sms-portal'), __('Add money to your wallet. Each SMS you send takes its charge from it.', 'bulk-sms-portal'), btn(icon('tag', 18) + __('See prices', 'bulk-sms-portal'), 'data-bx-go="pricing"'))}
    ${banner ? `<div class="bx-stack is-tight" data-bx-banner>${banner}</div>` : ''}
    ${!fs.online.length && !fs.banks.length ? note('wait', __('Buying is not available right now', 'bulk-sms-portal'), __('No payment options have been set up yet. Please contact support.', 'bulk-sms-portal')) : `
    <div class="bx-split${banner ? ' bx-section' : ''}">
      <div class="bx-panel">
        <section class="bx-step" aria-labelledby="bx-f1">
          <span class="bx-step-num">1</span>
          <div class="bx-step-title"><h2 id="bx-f1">${__('How much do you want to add?', 'bulk-sms-portal')}</h2><p>${fs.min || fs.max ? esc([fs.min ? __('From ', 'bulk-sms-portal') + nairaWhole(fs.min) : '', fs.max ? __('up to ', 'bulk-sms-portal') + nairaWhole(fs.max) : ''].filter(Boolean).join(' ')) + '.' : __('Choose an amount or type your own.', 'bulk-sms-portal')}</p></div>
          <div class="bx-step-body">
            <div class="bx-chips" role="group" aria-label="${esc(__('Quick amounts', 'bulk-sms-portal'))}">${fs.quick.map(v => `<button type="button" class="bx-chip" data-bx-amount="${v}">${esc(nairaWhole(v))}</button>`).join('')}</div>
            <div class="bx-field">
              <label class="bx-label" for="bx-amount">${__('Amount', 'bulk-sms-portal')}</label>
              <div class="bx-money-input"><span aria-hidden="true">₦</span><input id="bx-amount" type="number" inputmode="decimal" min="${fs.min || 1}" ${fs.max ? `max="${fs.max}"` : ''} step="1" value="${esc(fundState.amount)}"></div>
              <span class="bx-hint" data-bx-amount-hint></span>
            </div>
          </div>
        </section>
        <section class="bx-step" aria-labelledby="bx-f2">
          <span class="bx-step-num">2</span>
          <div class="bx-step-title"><h2 id="bx-f2">${__('How do you want to pay?', 'bulk-sms-portal')}</h2></div>
          <div class="bx-step-body">
            <div class="bx-choices" role="group" aria-label="${esc(__('Payment choice', 'bulk-sms-portal'))}">
              ${fs.online.length ? `<button type="button" class="bx-choice" data-bx-method="online"><strong>${sprintf(/* translators: %s: a value filled in when shown */ __('%s Pay online', 'bulk-sms-portal'), icon('card', 18))}</strong><span>${__('Card, bank app or USSD. Added straight away.', 'bulk-sms-portal')}</span></button>` : ''}
              ${fs.banks.length ? `<button type="button" class="bx-choice" data-bx-method="bank"><strong>${sprintf(/* translators: %s: a value filled in when shown */ __('%s Bank transfer', 'bulk-sms-portal'), icon('bank', 18))}</strong><span>${__('Transfer, then upload your receipt. Added after we check it.', 'bulk-sms-portal')}</span></button>` : ''}
            </div>
            <div data-bx-method-panel="online" hidden>
              ${fs.online.length > 1 ? `<div class="bx-field"><label class="bx-label" for="bx-gw">${__('Pay with', 'bulk-sms-portal')}</label><select id="bx-gw" class="bx-select">${fs.online.map(g => `<option value="${esc(g.id)}">${esc(g.label)}</option>`).join('')}</select></div>` : ''}
              <p class="bx-muted">${sprintf(/* translators: %s: a value filled in when shown */ __('You will go to %s\'s secure page to pay, then come back here.', 'bulk-sms-portal'), esc((fs.online[0] && fs.online[0].label) || __('our payment partner', 'bulk-sms-portal')))}</p>
            </div>
            <div class="bx-stack is-tight" data-bx-method-panel="bank" hidden>
              <p class="bx-muted">${sprintf(/* translators: %s: a value filled in when shown */ __('Transfer the amount to %s, then tell us about it below.', 'bulk-sms-portal'), fs.banks.length > 1 ? __('one of these accounts', 'bulk-sms-portal') : __('this account', 'bulk-sms-portal'))}</p>
              <div class="bx-grid" style="--min:260px">${fs.banks.map((b, i) => `
                <label class="bx-choice" data-bx-bank="${i}">
                  <input type="radio" name="bx-bank" value="${i}" ${i === 0 ? 'checked' : ''}>
                  <strong>${esc(b.bank || __('Bank', 'bulk-sms-portal'))}</strong>
                  <span>${esc(b.account_name || '')}</span>
                  <span class="bx-copy"><span>${esc(b.account_number)}</span><button type="button" class="bx-btn is-small" data-bx-copy="${esc(b.account_number)}">${sprintf(/* translators: %s: a value filled in when shown */ __('%sCopy', 'bulk-sms-portal'), icon('copy', 16))}</button></span>
                  ${b.instructions ? `<span class="bx-small">${esc(b.instructions)}</span>` : ''}
                </label>`).join('')}</div>
              <div class="bx-fields">
                <div class="bx-field"><label class="bx-label" for="bx-depositor">${__('Name on the transfer', 'bulk-sms-portal')}</label><input id="bx-depositor" class="bx-input" autocomplete="name" value="${esc(String(S().user || ''))}"></div>
                <div class="bx-field"><label class="bx-label" for="bx-bankref">${__('Bank reference', 'bulk-sms-portal')} <span class="bx-optional">${__('(optional)', 'bulk-sms-portal')}</span></label><input id="bx-bankref" class="bx-input" placeholder="${esc(__('From your bank receipt', 'bulk-sms-portal'))}"></div>
              </div>
              <div class="bx-field">
                <span class="bx-label">${__('Receipt', 'bulk-sms-portal')}</span>
                <label class="bx-file" for="bx-proof">${icon('upload', 22)}<strong data-bx-proof-name>${__('Choose your receipt', 'bulk-sms-portal')}</strong><span class="bx-hint">${__('A photo or PDF of the transfer receipt. JPG, PNG, WebP or PDF, up to 5 MB.', 'bulk-sms-portal')}</span><input id="bx-proof" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"></label>
              </div>
              <div class="bx-field"><label class="bx-label" for="bx-fnote">${__('Note', 'bulk-sms-portal')} <span class="bx-optional">${__('(optional)', 'bulk-sms-portal')}</span></label><textarea id="bx-fnote" class="bx-textarea" rows="2" placeholder="${esc(__('Anything that helps us find your payment', 'bulk-sms-portal'))}"></textarea></div>
            </div>
          </div>
        </section>
      </div>
      <aside class="bx-aside"><div class="bx-slip" data-bx-fund-slip aria-live="polite"></div></aside>
    </div>`}
    <section class="bx-section" aria-labelledby="bx-transfers">
      <div class="bx-section-head"><div><h2 id="bx-transfers">${__('Your payments', 'bulk-sms-portal')}</h2><p>${__('Bank transfers you told us about, and online payments still being checked.', 'bulk-sms-portal')}</p></div>${btn(icon('refresh', 16) + __('Refresh', 'bulk-sms-portal'), 'data-bx-refresh', 'is-small')}</div>
      <div data-bx-requests>${loading(__('Loading your payments…', 'bulk-sms-portal'))}</div>
    </section>`);
  bindGo(root); bindCopy(root);
  const rc = $('[data-bx-recheck]', root);
  if (rc) rc.onclick = () => { history.replaceState(null, '', location.pathname + '?reference=' + encodeURIComponent(rc.dataset.bxRecheck) + location.hash); APP.paymentReturn(); };

  const amountEl = $('#bx-amount', root), slip = $('[data-bx-fund-slip]', root);
  let model = null;
  const paint = () => {
    if (!slip) return;
    const v = Number(amountEl.value || 0);
    const problem = amountProblem(v, fs);
    const hint = $('[data-bx-amount-hint]', root);
    hint.textContent = problem; hint.classList.toggle('is-bad', !!problem);
    amountEl.closest('.bx-money-input').toggleAttribute('data-invalid', !!problem);
    $$('[data-bx-amount]', root).forEach(b => b.setAttribute('aria-pressed', Number(b.dataset.bxAmount) === v ? 'true' : 'false'));
    $$('[data-bx-method]', root).forEach(b => b.setAttribute('aria-pressed', b.dataset.bxMethod === fundState.method ? 'true' : 'false'));
    $$('[data-bx-method-panel]', root).forEach(p => { p.hidden = p.dataset.bxMethodPanel !== fundState.method; });
    const kobo = Math.round(v * 100);
    const est = model && !problem ? aboutFor(model, kobo) : null;
    const bank = fundState.method === 'bank';
    slip.innerHTML = `
      <div class="bx-slip-title"><span>${__('Your top-up', 'bulk-sms-portal')}</span>${icon('wallet', 18)}</div>
      <div class="bx-slip-rows">
        <div class="bx-slip-row"><span>${__('Wallet now', 'bulk-sms-portal')}</span><b>${esc(naira(balanceKobo()))}</b></div>
        <div class="bx-slip-row is-good"><span>${__('Added', 'bulk-sms-portal')}</span><b>${problem ? '—' : '+' + esc(naira(kobo))}</b></div>
        <div class="bx-slip-row"><span>${__('Wallet after', 'bulk-sms-portal')}</span><b>${problem ? '—' : esc(naira(balanceKobo() + kobo))}</b></div>
        ${est ? `<div class="bx-slip-row"><span>${__('That is about', 'bulk-sms-portal')}</span><b>${sprintf(/* translators: %s: a number */ _n('%s SMS', '%s SMS', Number(est.count), 'bulk-sms-portal'), num(est.count))}</b></div>` : ''}
      </div>
      <span class="bx-slip-tear" aria-hidden="true"></span>
      <div class="bx-slip-total"><span>${__('You pay', 'bulk-sms-portal')}</span><strong>${problem ? '—' : esc(naira(kobo))}</strong></div>
      <div class="bx-slip-foot">
        <button type="button" class="bx-btn is-primary is-large is-block" data-bx-pay ${problem ? 'disabled' : ''}>${bank ? __('Send transfer for checking', 'bulk-sms-portal') : (problem ? __('Pay online', 'bulk-sms-portal') : __('Pay ', 'bulk-sms-portal') + esc(naira(kobo)) + ' online')}</button>
        <span class="bx-hint">${bank ? __('We add the money once we have checked your receipt.', 'bulk-sms-portal') : __('No extra fees are added here.', 'bulk-sms-portal')}${est ? ` ₦1 paid is ₦1 in your wallet. The SMS count is a guide at ${esc(naira(est.charge))} for a one-page message; each SMS is charged the price of the network it goes to.` : ''}</span>
        <div data-bx-pay-msg aria-live="polite"></div>
      </div>`;
    const pay = $('[data-bx-pay]', slip);
    if (pay) pay.onclick = () => bank ? submitTransfer(pay) : payOnline(pay);
  };
  if (amountEl) {
    amountEl.addEventListener('input', () => { fundState.amount = Number(amountEl.value || 0); paint(); });
    $$('[data-bx-amount]', root).forEach(b => b.onclick = () => { amountEl.value = b.dataset.bxAmount; fundState.amount = Number(b.dataset.bxAmount); paint(); });
    $$('[data-bx-method]', root).forEach(b => b.onclick = () => { fundState.method = b.dataset.bxMethod; paint(); });
    const proof = $('#bx-proof', root);
    if (proof) proof.onchange = () => { const f = proof.files && proof.files[0]; $('[data-bx-proof-name]', root).textContent = f ? f.name : __('Choose your receipt', 'bulk-sms-portal'); };
    paint();
    prices().then(pr => { model = priceModel(pr); if (ctx.live()) paint(); });
  }
  const payMsg = (tone, title, text) => { const m = $('[data-bx-pay-msg]', root); if (m) m.innerHTML = note(tone, title, text); };

  async function payOnline(button) {
    const v = Number(amountEl.value || 0);
    const problem = amountProblem(v, fs); if (problem) { payMsg('bad', problem); return; }
    const pick = $('#bx-gw', root);
    const gw = (pick && fs.online.find(g => g.id === pick.value)) || fs.online[0];
    if (!gw || !gw.init) { payMsg('bad', __('Online payment is not available right now', 'bulk-sms-portal'), __('Please use bank transfer or try again later.', 'bulk-sms-portal')); return; }
    const done = busy(button, __('Opening payment page…', 'bulk-sms-portal'));
    const r = await C.api(gw.init, { method: 'POST', body: JSON.stringify({ amount_naira: v, gateway: gw.id }) });
    if (r && r.ok && r.authorization_url) {
      try { sessionStorage.setItem('bsms_paystack_reference', r.reference || ''); if (r.return_url) sessionStorage.setItem('bsms_payment_return_url', r.return_url); } catch (e) {}
      location.href = r.authorization_url;
      return;
    }
    done();
    payMsg('bad', __('The payment page did not open', 'bulk-sms-portal'), esc(friendly(r, __('Please try again in a moment.', 'bulk-sms-portal'))));
  }

  async function uploadProof(file, retried = false) {
    await C.refreshNonce();
    const fd = new FormData(); fd.append('proof', file);
    try {
      const res = await fetch(C.restUrl('funding/proof-upload'), { method: 'POST', credentials: 'same-origin', headers: { 'X-WP-Nonce': (window.BSMS_PORTAL || {}).nonce }, body: fd });
      let data = {}; try { data = await res.json(); } catch (e) {}
      if (!res.ok && C.looksLikeCookieFailure(data) && !retried) return uploadProof(file, true);
      if (!res.ok && !data.error) data.error = __('Your receipt could not be uploaded.', 'bulk-sms-portal');
      return data;
    } catch (e) { return { ok: false, error: __('Your receipt could not be uploaded. Check your connection and try again.', 'bulk-sms-portal') }; }
  }
  async function submitTransfer(button) {
    const v = Number(amountEl.value || 0);
    const problem = amountProblem(v, fs); if (problem) { payMsg('bad', problem); return; }
    const depositor = $('#bx-depositor', root), proof = $('#bx-proof', root);
    if (!depositor.value.trim()) { payMsg('bad', __('Add the name on the transfer', 'bulk-sms-portal'), __('This helps us find your payment.', 'bulk-sms-portal')); depositor.focus(); return; }
    const file = proof.files && proof.files[0];
    if (!file) { payMsg('bad', __('Add your receipt', 'bulk-sms-portal'), __('Upload a photo or PDF of the transfer receipt.', 'bulk-sms-portal')); return; }
    if (file.size > 5 * 1024 * 1024) { payMsg('bad', __('That receipt is too big', 'bulk-sms-portal'), __('Choose a file under 5 MB.', 'bulk-sms-portal')); return; }
    const chosen = $('input[name="bx-bank"]:checked', root);
    const bank = fs.banks[Number(chosen ? chosen.value : 0)] || {};
    let done = busy(button, __('Uploading receipt…', 'bulk-sms-portal'));
    const up = await uploadProof(file);
    done();
    if (!up || !up.ok) { payMsg('bad', __('Receipt not uploaded', 'bulk-sms-portal'), esc(friendly(up, __('Please try again.', 'bulk-sms-portal')))); return; }
    done = busy(button, __('Sending…', 'bulk-sms-portal'));
    const r = await C.api('/funding/manual', { method: 'POST', body: JSON.stringify({
      amount_naira: v, depositor_name: depositor.value.trim(), bank_name: bank.bank || '', proof_attachment_id: up.attachment_id,
      note: [$('#bx-bankref', root).value.trim(), $('#bx-fnote', root).value.trim()].filter(Boolean).join(' — ')
    }) });
    done();
    if (r && r.ok) {
      payMsg('good', __('Thanks, we have your transfer', 'bulk-sms-portal'), `${sprintf(/* translators: %1$s, %2$s: values filled in when shown */ __('We will add %1$s once we have checked it. Reference %2$s.', 'bulk-sms-portal'), esc(naira(Math.round(v * 100))), esc(r.reference || ''))}`);
      proof.value = ''; $('[data-bx-proof-name]', root).textContent = __('Choose your receipt', 'bulk-sms-portal'); $('#bx-bankref', root).value = ''; $('#bx-fnote', root).value = '';
      loadRequests(1);
    } else payMsg('bad', __('Not sent', 'bulk-sms-portal'), esc(friendly(r, __('Please try again.', 'bulk-sms-portal'))));
  }

  async function loadRequests(p = 1) {
    const box = $('[data-bx-requests]', root);
    box.innerHTML = loading(__('Loading your payments…', 'bulk-sms-portal'));
    const r = await C.api('/funding/requests?page=' + p + '&per_page=5');
    if (!ctx.live()) return;
    if (!r || !r.ok) { box.innerHTML = `<div class="bx-panel">${note('bad', __('We could not load your payments', 'bulk-sms-portal'), esc(friendly(r)))}</div>`; return; }
    if (pageBack(r, p, loadRequests)) return;
    const items = r.items || [];
    if (!items.length) { box.innerHTML = `<div class="bx-list">${empty('receipt', __('No payments to show', 'bulk-sms-portal'), __('When you pay by bank transfer, you can follow it here until the money is added.', 'bulk-sms-portal'))}</div>`; return; }
    box.innerHTML = `<div class="bx-list">
      <div class="bx-tr is-head" style="--cols:1.2fr 1fr 1.4fr 150px"><span>${__('Amount', 'bulk-sms-portal')}</span><span>${__('Date', 'bulk-sms-portal')}</span><span>${__('Where it is', 'bulk-sms-portal')}</span><span></span></div>
      ${items.map(x => {
        const st = FUND_STATUS[String(x.status || 'pending').toLowerCase()] || ['info', String(x.status || '')];
        const online = String(x.method || '').indexOf('manual') === -1;
        return `<div class="bx-tr" style="--cols:1.2fr 1fr 1.4fr 150px">
          <span class="bx-td-main bx-td-lead" data-label="${esc(__('Amount', 'bulk-sms-portal'))}"><strong class="bx-num">${esc(naira(x.amount_kobo))}</strong><small>${online ? __('Online payment', 'bulk-sms-portal') : __('Bank transfer', 'bulk-sms-portal') + (x.bank_name ? ' to ' + esc(x.bank_name) : '')}</small></span>
          <span data-label="${esc(__('Date', 'bulk-sms-portal'))}">${esc(fmtDate(x.created_at))}</span>
          <span class="bx-td-main" data-label="${esc(__('Where it is', 'bulk-sms-portal'))}">${pill(st[0], st[1])}${x.status === 'rejected' && x.admin_note ? `<small>${esc(x.admin_note)}</small>` : ''}<small class="bx-mono">${esc(x.reference || '')}</small></span>
          <span class="bx-td-actions">${online && x.status === 'pending' ? btn(__('Check payment', 'bulk-sms-portal'), `data-bx-verify="${esc(x.reference)}" data-bx-provider="${esc(String(x.method || 'paystack').replace(/[^a-z0-9_-]/g, ''))}"`, 'is-small') : ''}</span>
        </div>`;
      }).join('')}
      ${pager({ page: r.page, total_pages: r.total_pages, total: r.total, per_page: r.per_page })}
    </div>`;
    bindPager(box, loadRequests);
    $$('[data-bx-verify]', box).forEach(b => b.onclick = async () => {
      const done = busy(b, __('Checking…', 'bulk-sms-portal'));
      const v = await C.api('/' + (b.dataset.bxProvider || 'paystack') + '/verify', { method: 'POST', body: JSON.stringify({ reference: b.dataset.bxVerify }) });
      done();
      if (v && v.ok) { toast(__('Payment confirmed. Your wallet has been updated.', 'bulk-sms-portal')); await C.load({ force: true }); loadRequests(p); paint(); }
      else toast(friendly(v, __('This payment is not confirmed yet.', 'bulk-sms-portal')), 'bad');
    });
  }
  $('[data-bx-refresh]', root).onclick = () => loadRequests(1);
  loadRequests(1);
});


/* ---- 40-sender.js ---- */
/* ==========================================================================
   Sender ID
   ========================================================================== */
const SENDER_STATUS = { approved: ['good', __('Ready to use', 'bulk-sms-portal')], pending: ['wait', __('Waiting for approval', 'bulk-sms-portal')], rejected: ['bad', __('Not approved', 'bulk-sms-portal')] };
const SENDER_OK = /^[A-Za-z0-9 \-._]+$/;

page('sender', 'Sender ID', async (host, ctx) => {
  const root = mount(host, `
    ${pageHead(__('Sender ID', 'bulk-sms-portal'), __('Your sender name is what people see as the sender of your messages, such as your shop, school or church name. Each name is checked before you can use it.', 'bulk-sms-portal'), adminBtn(__('Review customer requests', 'bulk-sms-portal'), 'admin-senders'))}
    <div class="bx-split">
      <section class="bx-panel is-flush" aria-labelledby="bx-sn-list">
        <div class="bx-panel-head"><div><h2 id="bx-sn-list">${__('Your sender names', 'bulk-sms-portal')}</h2><p>${__('Names marked “Ready to use” show on the Send SMS page.', 'bulk-sms-portal')}</p></div></div>
        <div data-bx-senders>${skeleton(4)}</div>
      </section>
      <aside class="bx-aside">
        <section class="bx-panel" aria-labelledby="bx-sn-new">
          <div class="bx-panel-head"><div><h2 id="bx-sn-new">${__('Ask for a new name', 'bulk-sms-portal')}</h2><p>${__('We usually reply within one working day.', 'bulk-sms-portal')}</p></div></div>
          <form class="bx-stack is-tight" data-bx-sender-form novalidate>
            <div class="bx-field">
              <label class="bx-label" for="bx-sn-name">${__('Sender name', 'bulk-sms-portal')}</label>
              <input id="bx-sn-name" class="bx-input" maxlength="11" autocomplete="off" spellcheck="false" placeholder="${esc(__('For example: ADASHOP', 'bulk-sms-portal'))}">
              <span class="bx-hint" data-bx-sn-count>${__('Up to 11 letters or numbers.', 'bulk-sms-portal')}</span>
            </div>
            <div class="bx-field">
              <label class="bx-label" for="bx-sn-sample">${__('A message you plan to send', 'bulk-sms-portal')}</label>
              <textarea id="bx-sn-sample" class="bx-textarea" rows="4" placeholder="${esc(__('Your order is ready for pickup. Thank you for shopping with us.', 'bulk-sms-portal'))}"></textarea>
              <span class="bx-hint">${__('This helps us approve the right name for the right use.', 'bulk-sms-portal')}</span>
            </div>
            <ul class="bx-bullets bx-small bx-muted">
              <li>${__('Use your real business or organisation name.', 'bulk-sms-portal')}</li>
              <li>${__('Letters, numbers, spaces, dots and dashes are fine.', 'bulk-sms-portal')}</li>
              <li>${__('Names that look like a bank, a phone network or a government office are usually not approved.', 'bulk-sms-portal')}</li>
            </ul>
            <button type="submit" class="bx-btn is-primary is-block">${__('Send for approval', 'bulk-sms-portal')}</button>
            <div data-bx-sn-msg aria-live="polite"></div>
          </form>
        </section>
      </aside>
    </div>`);
  bindGo(root);

  const nameEl = $('#bx-sn-name', root), sampleEl = $('#bx-sn-sample', root), count = $('[data-bx-sn-count]', root), msg = $('[data-bx-sn-msg]', root);
  const check = () => {
    const v = nameEl.value.trim();
    let problem = '';
    if (v && !SENDER_OK.test(v)) problem = __('Use only letters, numbers, spaces, dots and dashes.', 'bulk-sms-portal');
    count.textContent = problem || (v ? `${sprintf(/* translators: %s: a value filled in when shown */ __('%s of 11 characters', 'bulk-sms-portal'), v.length)}` : __('Up to 11 letters or numbers.', 'bulk-sms-portal'));
    count.classList.toggle('is-bad', !!problem);
    nameEl.setAttribute('aria-invalid', problem ? 'true' : 'false');
    return problem;
  };
  nameEl.addEventListener('input', check);
  $('[data-bx-sender-form]', root).onsubmit = async (e) => {
    e.preventDefault();
    msg.innerHTML = '';
    const name = nameEl.value.trim().replace(/\s+/g, ' ');
    const problem = check();
    if (!name) { msg.innerHTML = note('bad', __('Type the name you want', 'bulk-sms-portal')); nameEl.focus(); return; }
    if (problem) { nameEl.focus(); return; }
    if (!sampleEl.value.trim()) { msg.innerHTML = note('bad', __('Add a sample message', 'bulk-sms-portal'), __('Show us the kind of message you will send with this name.', 'bulk-sms-portal')); sampleEl.focus(); return; }
    const done = busy($('button[type="submit"]', root), __('Sending…', 'bulk-sms-portal'));
    const r = await C.api('/sender-ids/apply', { method: 'POST', body: JSON.stringify({ sender_id: name, sample_message: sampleEl.value.trim() }) });
    done();
    if (r && r.ok) {
      msg.innerHTML = note('good', __('Request sent', 'bulk-sms-portal'), `${sprintf(/* translators: %s: a value filled in when shown */ __('We will let you know when %s has been checked.', 'bulk-sms-portal'), esc(name))}`);
      nameEl.value = ''; sampleEl.value = ''; check();
      list();
    } else msg.innerHTML = note('bad', __('Not sent', 'bulk-sms-portal'), esc(friendly(r, __('Please try again.', 'bulk-sms-portal'))));
  };

  async function list() {
    const box = $('[data-bx-senders]', root);
    const r = await C.api('/sender-ids');
    if (!ctx.live()) return;
    if (!r || !r.ok) { box.innerHTML = `<div class="bx-empty"><p>${esc(friendly(r, __('We could not load your sender names.', 'bulk-sms-portal')))}</p></div>`; return; }
    const items = r.items || [];
    if (!items.length) {
      box.innerHTML = empty('badge', __('No sender names yet', 'bulk-sms-portal'), r.default_sender ? `${sprintf(/* translators: %s: a value filled in when shown */ __('Until you have your own, your messages show as %s. Ask for your own name using the form.', 'bulk-sms-portal'), r.default_sender)}` : __('Ask for your first name using the form.', 'bulk-sms-portal'));
      return;
    }
    box.innerHTML = `<div class="bx-rows">${items.map(x => {
      const st = SENDER_STATUS[x.status] || ['info', x.status];
      const isDefault = x.status === 'approved' && x.sender_id === r.default_sender;
      return `<div class="bx-line-item">
        <div class="bx-td-main">
          <span class="bx-row-flex"><strong class="bx-figure bx-sender-name">${esc(x.sender_id)}</strong>${pill(st[0], st[1])}${isDefault ? `<span class="bx-small bx-muted">${__('Used first on Send SMS', 'bulk-sms-portal')}</span>` : ''}</span>
          ${x.sample_message ? `<small>${sprintf(/* translators: %s: a value filled in when shown */ __('Sample: “%s”', 'bulk-sms-portal'), esc(x.sample_message))}</small>` : ''}
          <small>${sprintf(/* translators: %1$s, %2$s: values filled in when shown */ __('Asked on %1$s%2$s', 'bulk-sms-portal'), esc(fmtDate(x.created_at, false)), x.status !== 'pending' && x.updated_at && x.updated_at !== x.created_at ? `${sprintf(/* translators: %s: a value filled in when shown */ __(', checked on %s', 'bulk-sms-portal'), esc(fmtDate(x.updated_at, false)))}` : '')}</small>
          ${x.status === 'rejected' && x.reason ? `<small class="bx-hint is-bad">${sprintf(/* translators: %s: a value filled in when shown */ __('Reason: %s', 'bulk-sms-portal'), esc(x.reason))}</small>` : ''}
        </div>
        ${x.status === 'approved' && canUse('compose_sms') ? btn(__('Send with this name', 'bulk-sms-portal'), `data-bx-use-sender="${esc(x.sender_id)}"`, 'is-small') : ''}
      </div>`;
    }).join('')}</div>`;
    $$('[data-bx-use-sender]', box).forEach(b => b.onclick = () => { compose.sender = b.dataset.bxUseSender; go('compose'); });
  }
  list();
});


/* ---- 50-pricing.js ---- */
/* ==========================================================================
   Pricing (customer). v3.6.2 rule: your wallet holds money; each SMS page is
   charged the price of the network (or country) it goes to. Same price for
   any size of send. Countries not listed are not sent to.
   ========================================================================== */
page('pricing', 'Pricing', async (host, ctx) => {
  const root = mount(host, `
    ${pageHead(__('Pricing', 'bulk-sms-portal'), __('Your wallet holds money: every ₦1 you pay is ₦1 to spend. Each SMS page is charged the price of the network it goes to, whatever the size of your send.', 'bulk-sms-portal'), (canUse('buy_sms') ? btn(__('Buy SMS', 'bulk-sms-portal'), 'data-bx-go="fund"', 'is-primary') : '') + adminBtn(__('Change prices', 'bulk-sms-portal'), 'admin-pricing'))}
    <div data-bx-prices>${skeleton(6)}</div>`);
  bindGo(root);
  const pr = await prices(true);
  if (!ctx.live()) return;
  const box = $('[data-bx-prices]', root);
  const std = priceModel(pr, false), dnd = priceModel(pr, true);
  if (!std.top) { box.innerHTML = `<div class="bx-list">${empty('tag', __('Prices are not published yet', 'bulk-sms-portal'), __('The cost is always shown on the Send SMS page before you send.', 'bulk-sms-portal'))}</div>`; return; }

  const ng = std.ng;
  const hasDnd = !!dnd.top;
  const cols = hasDnd ? '1.5fr 1fr 1fr' : '1.5fr 1fr';
  const money = k => Number(k) ? `<b>${esc(naira(k))}</b>` : `<span class="bx-muted">${__('Same as other networks', 'bulk-sms-portal')}</span>`;
  const dndCell = (k, fallback) => hasDnd ? `<span class="is-num" data-label="${esc(__('Do Not Disturb numbers', 'bulk-sms-portal'))}">${Number(k) ? esc(naira(k)) : (fallback ? esc(naira(fallback)) : __('Not offered', 'bulk-sms-portal'))}</span>` : '';
  const head = (first) => `<div class="bx-tr is-head" style="--cols:${cols}"><span>${first}</span><span class="is-num">${__('Price per SMS page', 'bulk-sms-portal')}</span>${hasDnd ? `<span class="is-num">${__('Do Not Disturb numbers', 'bulk-sms-portal')}</span>` : ''}</div>`;
  const nets = [...(ng.networks || [])].sort((a, b) => (MAIN_NETWORKS.indexOf(a.name) + 1 || 99) - (MAIN_NETWORKS.indexOf(b.name) + 1 || 99));
  const others = std.list.filter(c => String(c.code) !== '234' && Number(c.standard_kobo));

  box.innerHTML = `
    <section class="bx-section bx-mt-0" aria-labelledby="bx-pr-ng">
      <div class="bx-section-head"><div><h2 id="bx-pr-ng">${__('Nigerian numbers', 'bulk-sms-portal')}</h2><p>${__('The price is set by the network of each number you send to.', 'bulk-sms-portal')}</p></div></div>
      <div class="bx-list">
        ${head(__('Network', 'bulk-sms-portal'))}
        ${nets.map(n => `<div class="bx-tr" style="--cols:${cols}"><span class="bx-td-main bx-td-lead" data-label="${esc(__('Network', 'bulk-sms-portal'))}"><strong>${esc(n.name)}</strong><small>${esc((n.prefixes || []).slice(0, 6).map(p => prefixLabel('234', p)).join(', '))}${(n.prefixes || []).length > 6 ? '…' : ''}</small></span><span class="is-num" data-label="${esc(__('Price per SMS page', 'bulk-sms-portal'))}">${money(n.standard_kobo || ng.standard_kobo)}</span>${dndCell(n.dnd_kobo, ng.dnd_kobo)}</div>`).join('')}
        ${Number(ng.standard_kobo) ? `<div class="bx-tr" style="--cols:${cols}"><span class="bx-td-main bx-td-lead" data-label="${esc(__('Network', 'bulk-sms-portal'))}"><strong>${nets.length ? __('Any other Nigerian network', 'bulk-sms-portal') : __('Every Nigerian network', 'bulk-sms-portal')}</strong></span><span class="is-num" data-label="${esc(__('Price per SMS page', 'bulk-sms-portal'))}"><b>${esc(naira(ng.standard_kobo))}</b></span>${dndCell(ng.dnd_kobo)}</div>` : ''}
        ${(ng.prefixes || []).map(x => `<div class="bx-tr" style="--cols:${cols}"><span class="bx-td-main bx-td-lead" data-label="${esc(__('Network', 'bulk-sms-portal'))}"><strong>${sprintf(/* translators: %s: a value filled in when shown */ __('Numbers starting %s', 'bulk-sms-portal'), esc(prefixLabel('234', x.prefixes[0])))}</strong><small>${__('Special price', 'bulk-sms-portal')}</small></span><span class="is-num" data-label="${esc(__('Price per SMS page', 'bulk-sms-portal'))}">${money(x.standard_kobo)}</span>${dndCell(x.dnd_kobo, hasDnd ? (dnd.quote(x.prefixes[0] + '0000000') || {}).price : 0)}</div>`).join('')}
      </div>
    </section>

    ${others.length ? `<section class="bx-section" aria-labelledby="bx-pr-intl">
      <div class="bx-section-head"><div><h2 id="bx-pr-intl">${__('Other countries', 'bulk-sms-portal')}</h2><p>${std.intlReady ? __('Type the number with its country code, for example +233 24 123 4567. Countries not listed here cannot be sent to.', 'bulk-sms-portal') : __('Sending outside Nigeria is not available yet. These prices apply once it is.', 'bulk-sms-portal')}</p></div></div>
      <div class="bx-list">
        <div class="bx-tr is-head" style="--cols:1.5fr 1fr"><span>${__('Country', 'bulk-sms-portal')}</span><span class="is-num">${__('Price per SMS page', 'bulk-sms-portal')}</span></div>
        ${others.map(c => `<div class="bx-tr${std.intlReady ? '' : ' is-off'}" style="--cols:1.5fr 1fr"><span class="bx-td-main bx-td-lead" data-label="${esc(__('Country', 'bulk-sms-portal'))}"><strong>${esc(c.name)}</strong><small>+${esc(c.code)}</small></span><span class="is-num" data-label="${esc(__('Price per SMS page', 'bulk-sms-portal'))}"><b>${esc(naira(c.standard_kobo))}</b></span></div>`).join('')}
      </div>
    </section>` : ''}

    <div class="bx-section bx-split is-even">
      <section class="bx-panel" aria-labelledby="bx-pr-check">
        <div class="bx-panel-head"><div><h2 id="bx-pr-check">${__('Check a number', 'bulk-sms-portal')}</h2><p>${__('See what one SMS page to a number costs.', 'bulk-sms-portal')}</p></div></div>
        <div class="bx-field"><label class="bx-label" for="bx-pr-num">${__('Phone number', 'bulk-sms-portal')}</label><input id="bx-pr-num" class="bx-input" type="tel" inputmode="tel" placeholder="0803 123 4567" autocomplete="off"></div>
        <div class="bx-mt-s" data-bx-pr-out aria-live="polite"></div>
      </section>
      <section class="bx-panel" aria-labelledby="bx-pr-calc">
        <div class="bx-panel-head"><div><h2 id="bx-pr-calc">${__('Work out a cost', 'bulk-sms-portal')}</h2><p>${__('For Nigerian numbers on one network.', 'bulk-sms-portal')}</p></div></div>
        <div class="bx-fields">
          <div class="bx-field"><label class="bx-label" for="bx-calc-people">${__('How many people', 'bulk-sms-portal')}</label><input id="bx-calc-people" class="bx-input" type="number" min="1" value="100" inputmode="numeric"></div>
          <div class="bx-field"><label class="bx-label" for="bx-calc-pages">${__('SMS pages each', 'bulk-sms-portal')}</label><select id="bx-calc-pages" class="bx-select"><option value="1">${__('1 page', 'bulk-sms-portal')}</option><option value="2">${__('2 pages', 'bulk-sms-portal')}</option><option value="3">${__('3 pages', 'bulk-sms-portal')}</option><option value="4">${__('4 pages', 'bulk-sms-portal')}</option></select></div>
        </div>
        <div class="bx-field bx-mt-s"><label class="bx-label" for="bx-calc-net">${__('Network', 'bulk-sms-portal')}</label><select id="bx-calc-net" class="bx-select">${nets.filter(n => Number(n.standard_kobo)).map(n => `<option value="${Number(n.standard_kobo)}">${esc(n.name)}</option>`).join('')}${Number(ng.standard_kobo) ? `<option value="${Number(ng.standard_kobo)}">${nets.length ? __('Any other network', 'bulk-sms-portal') : __('Any network', 'bulk-sms-portal')}</option>` : ''}</select></div>
        <div class="bx-slip-total bx-mt-m"><span>${__('Cost', 'bulk-sms-portal')}</span><strong data-bx-calc>—</strong></div>
        <p class="bx-small bx-muted bx-mt-s" data-bx-calc-note></p>
      </section>
    </div>

    <section class="bx-section bx-panel" aria-labelledby="bx-pr-len">
      <div class="bx-panel-head"><div><h2 id="bx-pr-len">${__('How long messages are counted', 'bulk-sms-portal')}</h2><p>${__('Longer messages are sent as more than one SMS page, and each page is charged.', 'bulk-sms-portal')}</p></div></div>
      <dl class="bx-kv">
        <div><dt>${__('Up to 160 characters', 'bulk-sms-portal')}</dt><dd>${__('1 page', 'bulk-sms-portal')}</dd></div>
        <div><dt>${__('161 to 306 characters', 'bulk-sms-portal')}</dt><dd>${__('2 pages', 'bulk-sms-portal')}</dd></div>
        <div><dt>${__('307 to 459 characters', 'bulk-sms-portal')}</dt><dd>${__('3 pages', 'bulk-sms-portal')}</dd></div>
      </dl>
      <p class="bx-small bx-muted bx-mt-s">${__('Messages with letters like é or ñ, or with emoji, fit 70 characters in one page (67 in each page after that). If a message fails, its charge goes back to your wallet.', 'bulk-sms-portal')}</p>
    </section>`;

  const num1 = $('#bx-pr-num', box), out = $('[data-bx-pr-out]', box);
  num1.addEventListener('input', () => {
    const v = num1.value.trim();
    if (phoneDigits(v).length < 10) { out.innerHTML = ''; return; }
    const q = std.quote(v), qd = hasDnd ? dnd.quote(v) : null;
    if (!q || q.price === null) { out.innerHTML = note('wait', __('We can’t send to this number yet', 'bulk-sms-portal'), __('No price is set for its country, so it would be left out and not charged.', 'bulk-sms-portal')); return; }
    const abroad = String(q.country.code) !== '234';
    const where = abroad ? q.country.name : (q.special ? `${sprintf(/* translators: %s: a value filled in when shown */ __('numbers starting %s', 'bulk-sms-portal'), prefixLabel('234', q.prefix))}` : (q.network || __('this network', 'bulk-sms-portal')));
    out.innerHTML = abroad && !std.intlReady
      ? note('wait', `${sprintf(/* translators: %1$s, %2$s: values filled in when shown */ __('%1$s: %2$s per SMS page', 'bulk-sms-portal'), esc(q.country.name), esc(naira(q.price)))}`, __('Sending outside Nigeria is not available yet, so it would be left out and not charged.', 'bulk-sms-portal'))
      : note('good', `${sprintf(/* translators: %s: a value filled in when shown */ __('%s per SMS page', 'bulk-sms-portal'), esc(naira(q.price)))}`, `${sprintf(/* translators: %1$s, %2$s: values filled in when shown */ __('Price for %1$s.%2$s', 'bulk-sms-portal'), esc(where), qd && qd.price && !abroad ? ` ${sprintf(/* translators: %s: a value filled in when shown */ __('Reaching it as a Do Not Disturb number: %s.', 'bulk-sms-portal'), esc(naira(qd.price)))}` : '')}`);
  });
  const people = $('#bx-calc-people', box), pages = $('#bx-calc-pages', box), net = $('#bx-calc-net', box), cout = $('[data-bx-calc]', box), cnote = $('[data-bx-calc-note]', box);
  const calc = () => {
    const p = Math.max(0, Number(people.value || 0)), g = Number(pages.value || 1), each = Number(net.value || 0), qty = p * g;
    cout.textContent = each ? naira(each * qty) : '—';
    cnote.textContent = each ? `${sprintf(/* translators: %1$s, %2$s, %3$s: values filled in when shown */ __('%1$s SMS %2$s at %3$s each. Send SMS shows the exact total for your numbers before you send.', 'bulk-sms-portal'), num(qty), qty === 1 ? 'page' : 'pages', naira(each))}` : '';
  };
  [people, pages, net].forEach(x => x.addEventListener(x.tagName === 'SELECT' ? 'change' : 'input', calc)); calc();
});


/* ---- 60-groups.js ---- */
/* ==========================================================================
   Phonebook
   ========================================================================== */
const book = { open: null, search: '', page: 1 };

function savedSummary(r, verb = __('Saved', 'bulk-sms-portal')) {
  const parts = [`${verb} ${sprintf(/* translators: %s: a number */ _n('%s number', '%s numbers', Number(r.valid || 0), 'bulk-sms-portal'), num(r.valid || 0))}.`];
  if (Number(r.duplicates)) parts.push(`${sprintf(/* translators: %s: a value filled in when shown */ __('%s already in the group or repeated.', 'bulk-sms-portal'), sprintf(/* translators: %s: a number */ _n('%s number', '%s numbers', Number(r.duplicates), 'bulk-sms-portal'), num(r.duplicates)))}`);
  if (Number(r.invalid)) parts.push(`${sprintf(/* translators: %s: a value filled in when shown */ __('%s could not be used.', 'bulk-sms-portal'), sprintf(/* translators: %s: a number */ _n('%s number', '%s numbers', Number(r.invalid), 'bulk-sms-portal'), num(r.invalid)))}`);
  return parts.join(' ');
}
function readFile(input) {
  return new Promise((resolve, reject) => {
    const f = input && input.files && input.files[0];
    if (!f) return resolve('');
    if (f.size > 2 * 1024 * 1024) return reject(new Error(__('That file is too big. Choose a file under 2 MB.', 'bulk-sms-portal')));
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || ''));
    fr.onerror = () => reject(new Error(__('We could not read that file.', 'bulk-sms-portal')));
    fr.readAsText(f);
  });
}
/* Dialog to add numbers by typing or uploading. mode: 'new' | 'add' | 'replace' */
function numbersDialog({ title, mode, groupName = '', onSave }) {
  openDialog(`<form method="dialog" novalidate><div class="bx-dialog-body"><h2>${esc(title)}</h2>
    ${mode === 'new' ? `<div class="bx-field"><label class="bx-label" for="bx-g-name">${__('Group name', 'bulk-sms-portal')}</label><input id="bx-g-name" class="bx-input" maxlength="80" value="${esc(groupName)}" placeholder="${esc(__('For example: Customers in Lagos', 'bulk-sms-portal'))}"></div>` : ''}
    ${mode === 'replace' ? note('wait', __('This replaces every number in the group', 'bulk-sms-portal'), __('The numbers you add here become the whole group.', 'bulk-sms-portal')) : ''}
    <div class="bx-seg" role="group" aria-label="${esc(__('How to add numbers', 'bulk-sms-portal'))}"><button type="button" data-bx-dm="type" aria-pressed="true">${__('Type numbers', 'bulk-sms-portal')}</button><button type="button" data-bx-dm="file" aria-pressed="false">${__('Upload a file', 'bulk-sms-portal')}</button></div>
    <div class="bx-field" data-bx-dp="type"><label class="bx-label" for="bx-g-numbers">${sprintf(/* translators: %s: a value filled in when shown */ __('Phone numbers%s', 'bulk-sms-portal'), mode === 'new' ? ` <span class="bx-optional">${__('(you can add them later)', 'bulk-sms-portal')}</span>` : '')}</label><textarea id="bx-g-numbers" class="bx-textarea" rows="6" placeholder="08031234567&#10;08051234567"></textarea><span class="bx-hint">${__('One number per line, or separate them with commas.', 'bulk-sms-portal')}</span></div>
    <div class="bx-field" data-bx-dp="file" hidden><label class="bx-file" for="bx-g-file">${icon('upload', 22)}<strong data-bx-g-fname>${__('Choose a CSV or text file', 'bulk-sms-portal')}</strong><span class="bx-hint">${__('Up to 2 MB. We find the phone numbers in it for you.', 'bulk-sms-portal')}</span><input id="bx-g-file" type="file" accept=".csv,.txt,text/csv,text/plain"></label></div>
    <div data-bx-g-msg aria-live="polite"></div>
  </div><div class="bx-dialog-actions"><button class="bx-btn" value="cancel">${__('Cancel', 'bulk-sms-portal')}</button><button class="bx-btn is-primary" data-bx-g-save>${mode === 'new' ? __('Create group', 'bulk-sms-portal') : (mode === 'replace' ? __('Replace numbers', 'bulk-sms-portal') : __('Add numbers', 'bulk-sms-portal'))}</button></div></form>`, d => {
    let m = 'type';
    $$('[data-bx-dm]', d).forEach(b => b.onclick = () => { m = b.dataset.bxDm; $$('[data-bx-dm]', d).forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); $$('[data-bx-dp]', d).forEach(p => p.hidden = p.dataset.bxDp !== m); });
    const file = $('#bx-g-file', d);
    file.onchange = () => { const f = file.files && file.files[0]; $('[data-bx-g-fname]', d).textContent = f ? f.name : __('Choose a CSV or text file', 'bulk-sms-portal'); };
    const first = $('#bx-g-name', d) || $('#bx-g-numbers', d); if (first) first.focus();
    $('[data-bx-g-save]', d).onclick = async (e) => {
      e.preventDefault();
      const msg = $('[data-bx-g-msg]', d); msg.innerHTML = '';
      const name = $('#bx-g-name', d) ? $('#bx-g-name', d).value.trim() : '';
      if (mode === 'new' && !name) { msg.innerHTML = note('bad', __('Give the group a name', 'bulk-sms-portal')); $('#bx-g-name', d).focus(); return; }
      let text = '';
      try { text = m === 'file' ? await readFile(file) : $('#bx-g-numbers', d).value; } catch (err) { msg.innerHTML = note('bad', err.message); return; }
      if (mode !== 'new' && !text.trim()) { msg.innerHTML = note('bad', m === 'file' ? __('Choose a file first', 'bulk-sms-portal') : __('Type at least one number', 'bulk-sms-portal')); return; }
      const done = busy(e.currentTarget, __('Saving…', 'bulk-sms-portal'));
      const r = await onSave({ name, text, viaFile: m === 'file' });
      done();
      if (r && r.ok) { d.close(); } else msg.innerHTML = note('bad', __('Not saved', 'bulk-sms-portal'), esc(friendly(r, __('Please check the numbers and try again.', 'bulk-sms-portal'))));
    };
  });
}

page('groups', 'Phonebook', async (host, ctx) => {
  if (book.open) return openGroup(host, ctx, book.open);
  const root = mount(host, `
    ${pageHead(__('Phonebook', 'bulk-sms-portal'), __('Save groups of phone numbers, like customers, staff or parents, so you can text everyone in a group at once.', 'bulk-sms-portal'), btn(icon('plus', 18) + __('New group', 'bulk-sms-portal'), 'data-bx-new', 'is-primary'))}
    <div data-bx-groups>${skeleton(4)}</div>`);
  $('[data-bx-new]', root).onclick = () => numbersDialog({ title: __('New group', 'bulk-sms-portal'), mode: 'new', onSave: async ({ name, text, viaFile }) => {
    const r = viaFile ? await C.api('/groups/import-csv', { method: 'POST', body: JSON.stringify({ group_name: name, csv: text }) })
                      : await C.api('/groups', { method: 'POST', body: JSON.stringify({ group_name: name, numbers: text }) });
    if (r && r.ok) { toast(text.trim() ? savedSummary(r, __('Group created with', 'bulk-sms-portal')) : __('Group created.', 'bulk-sms-portal')); compose.groups = null; C.show('groups', false); }
    return r;
  } });
  const r = await C.api('/groups');
  if (!ctx.live()) return;
  const box = $('[data-bx-groups]', root);
  if (!r || !r.ok) { box.innerHTML = `<div class="bx-panel">${note('bad', __('We could not load your Phonebook', 'bulk-sms-portal'), esc(friendly(r)))}</div>`; return; }
  const items = r.items || [];
  if (!items.length) { box.innerHTML = `<div class="bx-list">${empty('people', __('No groups yet', 'bulk-sms-portal'), __('Create a group and add phone numbers by typing them or uploading a file.', 'bulk-sms-portal'), btn(icon('plus', 18) + __('New group', 'bulk-sms-portal'), 'data-bx-new2', 'is-primary'))}</div>`; const n2 = $('[data-bx-new2]', box); if (n2) n2.onclick = () => $('[data-bx-new]', root).click(); return; }
  box.innerHTML = `<div class="bx-list">
    <div class="bx-tr is-head" style="--cols:2fr 0.8fr 1fr 230px"><span>${__('Group', 'bulk-sms-portal')}</span><span class="is-num">${__('Numbers', 'bulk-sms-portal')}</span><span>${__('Created', 'bulk-sms-portal')}</span><span></span></div>
    ${items.map(g => `<div class="bx-tr" style="--cols:2fr 0.8fr 1fr 230px">
      <button type="button" class="bx-link bx-td-lead" data-label="${esc(__('Group', 'bulk-sms-portal'))}" data-bx-open="${esc(g.id)}">${esc(g.group_name)}</button>
      <span class="is-num" data-label="${esc(__('Numbers', 'bulk-sms-portal'))}">${num(g.total || 0)}</span>
      <span data-label="${esc(__('Created', 'bulk-sms-portal'))}">${esc(fmtDate(g.created_at, false))}</span>
      <span class="bx-row-flex bx-td-actions">${canUse('compose_sms') && Number(g.total) ? btn(icon('send', 16) + __('Send SMS', 'bulk-sms-portal'), `data-bx-send-group="${esc(g.id)}"`, 'is-small') : ''}${btn(__('Open', 'bulk-sms-portal'), `data-bx-open="${esc(g.id)}"`, 'is-small is-quiet')}</span>
    </div>`).join('')}
  </div>`;
  $$('[data-bx-open]', box).forEach(b => b.onclick = () => { book.open = b.dataset.bxOpen; book.search = ''; book.page = 1; C.show('groups', false); });
  $$('[data-bx-send-group]', box).forEach(b => b.onclick = () => APP.composeWith({ group: b.dataset.bxSendGroup }));
});

async function openGroup(host, ctx, id) {
  const root = mount(host, `<div data-bx-group>${pageSkeleton(__('Phonebook', 'bulk-sms-portal'))}</div>`);
  const r = await C.api('/groups/' + encodeURIComponent(id));
  if (!ctx.live()) return;
  if (!r || !r.ok) { book.open = null; mount(host, `${pageHead(__('Phonebook', 'bulk-sms-portal'), '')}${note('bad', __('We could not open this group', 'bulk-sms-portal'), esc(friendly(r)), btn(__('Back to Phonebook', 'bulk-sms-portal'), 'data-bx-back'))}`); $('[data-bx-back]', host).onclick = () => C.show('groups', false); return; }
  const g = r.group || {}, numbers = r.numbers || [];
  const back = () => { book.open = null; C.show('groups', false); };
  const reopen = () => { compose.groups = null; C.show('groups', false); };
  const draw = () => {
    const q = book.search.replace(/\s+/g, '').toLowerCase();
    const list = q ? numbers.filter(n => String(n.raw_phone || '').includes(q) || String(n.phone_e164 || '').includes(q)) : numbers;
    const per = 50, pages = Math.max(1, Math.ceil(list.length / per));
    book.page = Math.min(book.page, pages);
    const slice = list.slice((book.page - 1) * per, book.page * per);
    root.innerHTML = `
      <button type="button" class="bx-btn is-quiet is-small" data-bx-back>${sprintf(/* translators: %s: a value filled in when shown */ __('%sAll groups', 'bulk-sms-portal'), icon('arrowLeft', 16))}</button>
      ${pageHead(g.group_name || __('Group', 'bulk-sms-portal'), `${sprintf(/* translators: %s: a value filled in when shown */ __('%s in this group.', 'bulk-sms-portal'), sprintf(/* translators: %s: a number */ _n('%s phone number', '%s phone numbers', Number(numbers.length), 'bulk-sms-portal'), num(numbers.length)))}`, (canUse('compose_sms') && numbers.length ? btn(icon('send', 18) + __('Send SMS to this group', 'bulk-sms-portal'), 'data-bx-send', 'is-primary') : '') + btn(icon('plus', 18) + __('Add numbers', 'bulk-sms-portal'), 'data-bx-add'))}
      <div class="bx-list">
        <div class="bx-filters bx-mt-0" role="search">
          <div class="bx-field"><label class="bx-label" for="bx-g-search">${__('Find a number', 'bulk-sms-portal')}</label><input id="bx-g-search" class="bx-input" type="search" inputmode="numeric" value="${esc(book.search)}" placeholder="${esc(__('Type part of a number', 'bulk-sms-portal'))}"></div>
          <div class="bx-filter-actions">${btn(icon('edit', 16) + __('Rename', 'bulk-sms-portal'), 'data-bx-rename', 'is-small')}${btn(icon('upload', 16) + __('Replace all', 'bulk-sms-portal'), 'data-bx-replace', 'is-small')}${btn(icon('trash', 16) + __('Delete group', 'bulk-sms-portal'), 'data-bx-delete', 'is-small is-danger')}</div>
        </div>
        ${slice.length ? `<div class="bx-tr is-head" style="--cols:1.4fr 1fr 64px"><span>${__('Phone number', 'bulk-sms-portal')}</span><span>${__('Added', 'bulk-sms-portal')}</span><span></span></div>
        ${slice.map(n => `<div class="bx-tr" style="--cols:1.4fr 1fr 64px"><span class="bx-mono bx-td-lead" data-label="${esc(__('Phone number', 'bulk-sms-portal'))}">${esc(n.raw_phone || n.phone_e164)}</span><span data-label="${esc(__('Added', 'bulk-sms-portal'))}">${esc(fmtDate(n.created_at, false))}</span><span class="bx-td-actions">${btn(icon('trash', 16) + `<span class="bx-sr">${__('Remove', 'bulk-sms-portal')} ` + esc(n.raw_phone || '') + '</span>', `data-bx-remove="${esc(n.id)}" aria-label="${sprintf(/* translators: %s: a value filled in when shown */ esc(__('Remove %s', 'bulk-sms-portal')), esc(n.raw_phone || n.phone_e164))}"`, 'is-small is-quiet')}</span></div>`).join('')}
        ${pager({ page: book.page, total_pages: pages, total: list.length, per_page: per })}`
        : empty('phone', q ? __('No matching numbers', 'bulk-sms-portal') : __('This group is empty', 'bulk-sms-portal'), q ? __('Try fewer digits.', 'bulk-sms-portal') : __('Add numbers by typing them or uploading a file.', 'bulk-sms-portal'))}
      </div>`;
    $('[data-bx-back]', root).onclick = back;
    const s = $('#bx-g-search', root);
    s.oninput = () => { book.search = s.value; book.page = 1; const pos = s.selectionStart; draw(); const s2 = $('#bx-g-search', root); s2.focus(); try { s2.setSelectionRange(pos, pos); } catch (e) {} };
    bindPager(root, p => { book.page = p; draw(); });
    const send = $('[data-bx-send]', root); if (send) send.onclick = () => APP.composeWith({ group: id });
    $('[data-bx-add]', root).onclick = () => numbersDialog({ title: __('Add numbers to ', 'bulk-sms-portal') + (g.group_name || 'group'), mode: 'add', onSave: async ({ text, viaFile }) => {
      const res = viaFile ? await C.api(`/groups/${id}/append-csv`, { method: 'POST', body: JSON.stringify({ csv: text }) }) : await C.api(`/groups/${id}/numbers`, { method: 'POST', body: JSON.stringify({ numbers: text }) });
      if (res && res.ok) { toast(savedSummary(res, __('Added', 'bulk-sms-portal'))); reopen(); }
      return res;
    } });
    $('[data-bx-replace]', root).onclick = () => numbersDialog({ title: __('Replace all numbers', 'bulk-sms-portal'), mode: 'replace', onSave: async ({ text }) => {
      const res = await C.api(`/groups/${id}/replace`, { method: 'POST', body: JSON.stringify({ numbers: text }) });
      if (res && res.ok) { toast(savedSummary(res, __('The group now has', 'bulk-sms-portal'))); reopen(); }
      return res;
    } });
    $('[data-bx-rename]', root).onclick = () => openDialog(`<form method="dialog"><div class="bx-dialog-body"><h2>${__('Rename group', 'bulk-sms-portal')}</h2><div class="bx-field"><label class="bx-label" for="bx-g-rename">${__('Group name', 'bulk-sms-portal')}</label><input id="bx-g-rename" class="bx-input" maxlength="80" value="${esc(g.group_name || '')}"></div></div><div class="bx-dialog-actions"><button class="bx-btn" value="cancel">${__('Cancel', 'bulk-sms-portal')}</button><button class="bx-btn is-primary" data-bx-ok>${__('Save name', 'bulk-sms-portal')}</button></div></form>`, d => {
      const inp = $('#bx-g-rename', d); inp.focus(); inp.select();
      $('[data-bx-ok]', d).onclick = async (e) => {
        e.preventDefault();
        if (!inp.value.trim()) { inp.setAttribute('aria-invalid', 'true'); return; }
        const done = busy(e.currentTarget, __('Saving…', 'bulk-sms-portal'));
        const res = await C.api(`/groups/${id}/rename`, { method: 'POST', body: JSON.stringify({ group_name: inp.value.trim() }) });
        done();
        if (res && res.ok) { d.close(); toast(__('Group renamed.', 'bulk-sms-portal')); reopen(); } else toast(friendly(res, __('We could not rename the group.', 'bulk-sms-portal')), 'bad');
      };
    });
    $('[data-bx-delete]', root).onclick = async () => {
      if (!await confirmBox({ title: `${sprintf(/* translators: %s: a value filled in when shown */ __('Delete %s?', 'bulk-sms-portal'), g.group_name || __('this group', 'bulk-sms-portal'))}`, body: `<p>${sprintf(/* translators: %s: a value filled in when shown */ __('This removes the group and its %s from your Phonebook. Messages you already sent are not affected.', 'bulk-sms-portal'), sprintf(/* translators: %s: a number */ _n('%s number', '%s numbers', Number(numbers.length), 'bulk-sms-portal'), num(numbers.length)))}</p>`, confirm: __('Delete group', 'bulk-sms-portal'), danger: true })) return;
      const res = await C.api('/groups/' + encodeURIComponent(id), { method: 'DELETE' });
      if (res && res.ok) { toast(__('Group deleted.', 'bulk-sms-portal')); compose.groups = null; back(); } else toast(friendly(res, __('We could not delete the group.', 'bulk-sms-portal')), 'bad');
    };
    $$('[data-bx-remove]', root).forEach(b => b.onclick = async () => {
      const res = await C.api(`/groups/${id}/numbers/${encodeURIComponent(b.dataset.bxRemove)}`, { method: 'DELETE' });
      if (res && res.ok) { const i = numbers.findIndex(n => String(n.id) === b.dataset.bxRemove); if (i >= 0) numbers.splice(i, 1); compose.groups = null; toast(__('Number removed.', 'bulk-sms-portal')); draw(); }
      else toast(friendly(res, __('We could not remove that number.', 'bulk-sms-portal')), 'bad');
    });
  };
  draw();
}


/* ---- 70-account.js ---- */
/* ==========================================================================
   Notifications, Profile & Security, API
   ========================================================================== */
const ALERTS = [
  ['credit', __('Money added to your wallet', 'bulk-sms-portal'), __('When a payment or top-up reaches your wallet.', 'bulk-sms-portal')],
  ['funding', __('Bank transfer updates', 'bulk-sms-portal'), __('When we approve or decline a transfer you told us about.', 'bulk-sms-portal')],
  ['campaign', __('A send has finished', 'bulk-sms-portal'), __('A short summary when your messages have gone out.', 'bulk-sms-portal')],
  ['low_balance', __('Your balance is running low', 'bulk-sms-portal'), __('A warning before you run out of money for SMS.', 'bulk-sms-portal')],
  ['sender_decision', __('Sender name decisions', 'bulk-sms-portal'), __('When a sender name you asked for is approved or declined.', 'bulk-sms-portal')]
];

page('settings', 'Notifications', async (host, ctx) => {
  const root = mount(host, `
    ${pageHead(__('Notifications', 'bulk-sms-portal'), __('Choose what we tell you about, and whether it comes by email or SMS.', 'bulk-sms-portal'))}
    <div class="bx-split">
      <section class="bx-panel is-flush" aria-labelledby="bx-nt-h"><div class="bx-panel-head"><div><h2 id="bx-nt-h">${__('What to tell you about', 'bulk-sms-portal')}</h2><p>${__('SMS alerts are charged like any other SMS.', 'bulk-sms-portal')}</p></div></div><div data-bx-prefs>${skeleton(5)}</div></section>
      <aside class="bx-aside"><section class="bx-panel" aria-labelledby="bx-nt-more"><div class="bx-panel-head"><div><h2 id="bx-nt-more">${__('Alert details', 'bulk-sms-portal')}</h2></div></div><div data-bx-prefs-side>${skeleton(3)}</div></section></aside>
    </div>
    <section class="bx-section" aria-labelledby="bx-nt-log">
      <div class="bx-section-head"><div><h2 id="bx-nt-log">${__('Recent notifications', 'bulk-sms-portal')}</h2><p>${__('What we sent you lately.', 'bulk-sms-portal')}</p></div></div>
      <div data-bx-log>${loading()}</div>
    </section>`);
  const r = await C.api('/notifications/preferences');
  if (!ctx.live()) return;
  if (!r || !r.ok) { $('[data-bx-prefs]', root).innerHTML = `<div class="bx-empty"><p>${esc(friendly(r, __('We could not load your choices.', 'bulk-sms-portal')))}</p></div>`; $('[data-bx-prefs-side]', root).innerHTML = ''; }
  else {
    const p = r.preferences || {};
    const has = k => Object.prototype.hasOwnProperty.call(p, k);
    $('[data-bx-prefs]', root).innerHTML = `<div class="bx-list is-inset">
      <div class="bx-tr is-head" style="--cols:minmax(0,1fr) 64px 64px"><span>${__('Alert', 'bulk-sms-portal')}</span><span class="is-num">${__('Email', 'bulk-sms-portal')}</span><span class="is-num">SMS</span></div>
      ${ALERTS.map(([k, t, d]) => `<div class="bx-tr" style="--cols:minmax(0,1fr) 64px 64px">
        <span class="bx-td-main bx-td-lead"><strong>${esc(t)}</strong><small>${esc(d)}</small></span>
        <span class="is-num" data-label="${esc(__('Email', 'bulk-sms-portal'))}">${has('email_' + k) ? `<input type="checkbox" class="bx-switch" data-bx-pref="email_${k}" aria-label="${sprintf(/* translators: %s: a value filled in when shown */ esc(__('%s by email', 'bulk-sms-portal')), esc(t))}" ${Number(p['email_' + k]) ? 'checked' : ''}>` : '—'}</span>
        <span class="is-num" data-label="SMS">${has('sms_' + k) ? `<input type="checkbox" class="bx-switch" data-bx-pref="sms_${k}" aria-label="${sprintf(/* translators: %s: a value filled in when shown */ esc(__('%s by SMS', 'bulk-sms-portal')), esc(t))}" ${Number(p['sms_' + k]) ? 'checked' : ''}>` : '—'}</span>
      </div>`).join('')}
      ${has('email_newsletter') ? `<div class="bx-tr" style="--cols:minmax(0,1fr) 64px 64px"><span class="bx-td-main bx-td-lead"><strong>${__('News and offers', 'bulk-sms-portal')}</strong><small>${__('Occasional emails about new features and prices.', 'bulk-sms-portal')}</small></span><span class="is-num" data-label="${esc(__('Email', 'bulk-sms-portal'))}"><input type="checkbox" class="bx-switch" data-bx-pref="email_newsletter" aria-label="${esc(__('News and offers by email', 'bulk-sms-portal'))}" ${Number(p.email_newsletter) ? 'checked' : ''}></span><span class="is-num" data-label="SMS">—</span></div>` : ''}
    </div>`;
    $('[data-bx-prefs-side]', root).innerHTML = `<form class="bx-stack is-tight" data-bx-pref-form novalidate>
      <div class="bx-field"><label class="bx-label" for="bx-nt-phone">${__('Phone number for SMS alerts', 'bulk-sms-portal')}</label><input id="bx-nt-phone" class="bx-input" inputmode="tel" autocomplete="tel" value="${esc(p.phone || '')}" placeholder="08031234567"></div>
      <div class="bx-field"><label class="bx-label" for="bx-nt-low">${__('Warn me when I can send fewer than', 'bulk-sms-portal')}</label><div class="bx-row-flex"><input id="bx-nt-low" class="bx-input is-short" type="number" min="0" inputmode="numeric" value="${esc(p.low_balance_units ?? 10)}"><span>messages</span></div></div>
      <button type="submit" class="bx-btn is-primary is-block">${__('Save choices', 'bulk-sms-portal')}</button>
      <div data-bx-pref-msg aria-live="polite"></div>
    </form>`;
    $('[data-bx-pref-form]', root).onsubmit = async (e) => {
      e.preventDefault();
      const body = {};
      $$('[data-bx-pref]', root).forEach(i => { body[i.dataset.bxPref] = i.checked ? 1 : 0; });
      const phone = $('#bx-nt-phone', root).value.trim();
      const anySms = Object.keys(body).some(k => k.indexOf('sms_') === 0 && body[k]);
      const msg = $('[data-bx-pref-msg]', root);
      if (anySms && !phone) { msg.innerHTML = note('bad', __('Add a phone number', 'bulk-sms-portal'), __('We need a number to send your SMS alerts to.', 'bulk-sms-portal')); $('#bx-nt-phone', root).focus(); return; }
      body.phone = phone;
      body.low_balance_units = Math.max(0, Number($('#bx-nt-low', root).value || 0));
      const done = busy($('button[type="submit"]', root), __('Saving…', 'bulk-sms-portal'));
      const res = await C.api('/notifications/preferences', { method: 'POST', body: JSON.stringify(body) });
      done();
      msg.innerHTML = res && res.ok ? note('good', __('Your choices are saved', 'bulk-sms-portal')) : note('bad', __('Not saved', 'bulk-sms-portal'), esc(friendly(res)));
    };
    // Switches save with the form; remind people to press Save.
    $$('[data-bx-pref]', root).forEach(i => i.addEventListener('change', () => { const m = $('[data-bx-pref-msg]', root); if (m) m.innerHTML = `<p class="bx-hint">${__('Press “Save choices” to keep this change.', 'bulk-sms-portal')}</p>`; }));
  }
  const loadLog = async (pg = 1) => {
    const box = $('[data-bx-log]', root);
    const lr = await C.api('/notifications/logs?page=' + pg + '&per_page=10');
    if (!ctx.live()) return;
    if (!lr || !lr.ok) { box.innerHTML = `<div class="bx-panel">${note('bad', __('We could not load your notifications', 'bulk-sms-portal'), esc(friendly(lr)))}</div>`; return; }
    if (pageBack(lr, pg, loadLog)) return;
    const items = lr.items || [];
    if (!items.length) { box.innerHTML = `<div class="bx-list">${empty('bell', __('Nothing yet', 'bulk-sms-portal'), __('Alerts we send you will be listed here.', 'bulk-sms-portal'))}</div>`; return; }
    box.innerHTML = `<div class="bx-list"><div class="bx-tr is-head" style="--cols:2fr 0.7fr 0.9fr 1fr"><span>${__('Notification', 'bulk-sms-portal')}</span><span>By</span><span>${__('Result', 'bulk-sms-portal')}</span><span>${__('Date', 'bulk-sms-portal')}</span></div>
      ${items.map(x => `<div class="bx-tr" style="--cols:2fr 0.7fr 0.9fr 1fr"><span class="bx-td-main bx-td-lead" data-label="${esc(__('Notification', 'bulk-sms-portal'))}"><strong>${esc(x.subject || __('Notification', 'bulk-sms-portal'))}</strong><small class="bx-clip">${esc(x.message || '')}</small></span><span data-label="By">${String(x.channel).toLowerCase() === 'sms' ? 'SMS' : __('Email', 'bulk-sms-portal')}</span><span data-label="${esc(__('Result', 'bulk-sms-portal'))}">${pill(x.status === 'sent' ? 'good' : (x.status === 'failed' ? 'bad' : 'wait'), x.status === 'sent' ? __('Sent', 'bulk-sms-portal') : (x.status === 'failed' ? __('Not sent', 'bulk-sms-portal') : __('Waiting', 'bulk-sms-portal')))}</span><span data-label="${esc(__('Date', 'bulk-sms-portal'))}">${esc(fmtDate(x.sent_at || x.created_at))}</span></div>`).join('')}
      ${pager({ page: lr.page, total_pages: lr.total_pages, total: lr.total, per_page: lr.per_page })}</div>`;
    bindPager(box, loadLog);
  };
  loadLog(1);
});

/* ---- Profile & Security ------------------------------------------------- */
page('profile', 'Profile & Security', async (host, ctx) => {
  const root = mount(host, `${pageHead(__('Profile & Security', 'bulk-sms-portal'), __('Your contact details and password.', 'bulk-sms-portal'))}<div data-bx-profile>${skeleton(6)}</div>`);
  const r = await C.api('/profile');
  if (!ctx.live()) return;
  const box = $('[data-bx-profile]', root);
  if (!r || !r.ok) { box.innerHTML = note('bad', __('We could not load your profile', 'bulk-sms-portal'), esc(friendly(r))); return; }
  const original = r.email || '';
  const pw = (id, label, auto) => `<div class="bx-field"><label class="bx-label" for="${id}">${esc(label)}</label><div class="bx-row-flex is-nowrap"><input id="${id}" class="bx-input bx-grow" type="password" autocomplete="${auto}"><button type="button" class="bx-btn is-small" data-password-toggle="${id}" aria-label="${esc(__('Show password', 'bulk-sms-portal'))}" aria-pressed="false">${__('Show', 'bulk-sms-portal')}</button></div></div>`;
  box.innerHTML = `<div class="bx-split">
    <div class="bx-stack">
      <section class="bx-panel" aria-labelledby="bx-pf-h">
        <div class="bx-panel-head"><div><h2 id="bx-pf-h">${__('Your details', 'bulk-sms-portal')}</h2><p>${__('We use these to contact you about your account.', 'bulk-sms-portal')}</p></div></div>
        <form class="bx-stack is-tight" data-bx-pf novalidate>
          <div class="bx-fields">
            <div class="bx-field"><label class="bx-label" for="bx-pf-first">${__('First name', 'bulk-sms-portal')}</label><input id="bx-pf-first" class="bx-input" autocomplete="given-name" value="${esc(r.first_name || '')}"></div>
            <div class="bx-field"><label class="bx-label" for="bx-pf-last">${__('Last name', 'bulk-sms-portal')}</label><input id="bx-pf-last" class="bx-input" autocomplete="family-name" value="${esc(r.last_name || '')}"></div>
          </div>
          <div class="bx-field"><label class="bx-label" for="bx-pf-display">${__('Name shown in the portal', 'bulk-sms-portal')}</label><input id="bx-pf-display" class="bx-input" value="${esc(r.display_name || '')}"></div>
          <div class="bx-fields">
            <div class="bx-field"><label class="bx-label" for="bx-pf-email">${__('Email address', 'bulk-sms-portal')}</label><input id="bx-pf-email" class="bx-input" type="email" autocomplete="email" value="${esc(original)}"></div>
            <div class="bx-field"><label class="bx-label" for="bx-pf-phone">${__('Phone number', 'bulk-sms-portal')}</label><input id="bx-pf-phone" class="bx-input" inputmode="tel" autocomplete="tel" value="${esc(r.phone || '')}"></div>
          </div>
          <div data-bx-pf-confirm hidden>${note('info', __('Confirm it is you', 'bulk-sms-portal'), __('To change your email address, enter your current password.', 'bulk-sms-portal'))}${pw('bx-pf-pass', __('Current password', 'bulk-sms-portal'), 'current-password')}</div>
          <div class="bx-row-flex"><button type="submit" class="bx-btn is-primary">${__('Save details', 'bulk-sms-portal')}</button></div>
          <div data-bx-pf-msg aria-live="polite"></div>
        </form>
      </section>
      <section class="bx-panel" aria-labelledby="bx-pw-h">
        <div class="bx-panel-head"><div><h2 id="bx-pw-h">${__('Change password', 'bulk-sms-portal')}</h2><p>${__('Use at least 8 characters. A short sentence is easy to remember and hard to guess.', 'bulk-sms-portal')}</p></div></div>
        <form class="bx-stack is-tight" data-bx-pw novalidate>
          ${pw('bx-pw-current', __('Current password', 'bulk-sms-portal'), 'current-password')}
          ${pw('bx-pw-new', __('New password', 'bulk-sms-portal'), 'new-password')}
          ${pw('bx-pw-confirm', __('Type the new password again', 'bulk-sms-portal'), 'new-password')}
          <div class="bx-row-flex"><button type="submit" class="bx-btn is-primary">${__('Change password', 'bulk-sms-portal')}</button></div>
          <div data-bx-pw-msg aria-live="polite"></div>
        </form>
      </section>
    </div>
    <aside class="bx-aside"><section class="bx-panel" aria-labelledby="bx-ac-h"><div class="bx-panel-head"><div><h2 id="bx-ac-h">${__('Your account', 'bulk-sms-portal')}</h2></div></div>
      <dl class="bx-kv"><div><dt>${__('Username', 'bulk-sms-portal')}</dt><dd>${esc(r.username || '')}</dd></div><div><dt>${__('Member since', 'bulk-sms-portal')}</dt><dd>${esc(fmtDate(r.registered, false))}</dd></div><div><dt>${__('Account type', 'bulk-sms-portal')}</dt><dd>${isAdmin() ? __('Platform admin', 'bulk-sms-portal') : __('Customer', 'bulk-sms-portal')}</dd></div></dl>
    </section></aside>
  </div>`;
  const email = $('#bx-pf-email', box), confirmWrap = $('[data-bx-pf-confirm]', box);
  email.addEventListener('input', () => { confirmWrap.hidden = email.value.trim().toLowerCase() === original.toLowerCase(); });
  $('[data-bx-pf]', box).onsubmit = async (e) => {
    e.preventDefault();
    const msg = $('[data-bx-pf-msg]', box);
    const changing = email.value.trim().toLowerCase() !== original.toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email.value.trim())) { msg.innerHTML = note('bad', __('Check your email address', 'bulk-sms-portal')); email.focus(); return; }
    const body = { first_name: $('#bx-pf-first', box).value.trim(), last_name: $('#bx-pf-last', box).value.trim(), display_name: $('#bx-pf-display', box).value.trim(), email: email.value.trim(), phone: $('#bx-pf-phone', box).value.trim() };
    if (changing) { const p = $('#bx-pf-pass', box).value; if (!p) { msg.innerHTML = note('bad', __('Enter your current password to change your email', 'bulk-sms-portal')); $('#bx-pf-pass', box).focus(); return; } body.current_password = p; }
    const done = busy($('button[type="submit"]', e.target), __('Saving…', 'bulk-sms-portal'));
    const res = await C.api('/profile', { method: 'POST', body: JSON.stringify(body) });
    done();
    if (res && res.ok) { msg.innerHTML = note('good', __('Your details are saved', 'bulk-sms-portal')); confirmWrap.hidden = true; $('#bx-pf-pass', box).value = ''; C.load({ force: true }); }
    else msg.innerHTML = note('bad', __('Not saved', 'bulk-sms-portal'), esc(friendly(res)));
  };
  $('[data-bx-pw]', box).onsubmit = async (e) => {
    e.preventDefault();
    const msg = $('[data-bx-pw-msg]', box);
    const cur = $('#bx-pw-current', box).value, nw = $('#bx-pw-new', box).value, cf = $('#bx-pw-confirm', box).value;
    if (!cur) { msg.innerHTML = note('bad', __('Enter your current password', 'bulk-sms-portal')); return; }
    if (nw.length < 8) { msg.innerHTML = note('bad', __('Your new password needs at least 8 characters', 'bulk-sms-portal')); return; }
    if (nw !== cf) { msg.innerHTML = note('bad', __('The two new passwords are different', 'bulk-sms-portal'), __('Type the same new password in both boxes.', 'bulk-sms-portal')); return; }
    const done = busy($('button[type="submit"]', e.target), __('Changing…', 'bulk-sms-portal'));
    const res = await C.api('/profile/password', { method: 'POST', body: JSON.stringify({ current_password: cur, new_password: nw, confirm_password: cf }) });
    done();
    if (res && res.ok) { msg.innerHTML = note('good', __('Password changed', 'bulk-sms-portal'), __('Use your new password next time you sign in.', 'bulk-sms-portal')); e.target.reset(); }
    else msg.innerHTML = note('bad', __('Password not changed', 'bulk-sms-portal'), esc(friendly(res)));
  };
});

/* ---- API ---------------------------------------------------------------- */
page('api', 'API', async (host, ctx) => {
  const root = mount(host, `${pageHead('API', __('Send SMS from your own website, online shop or software. Share this page with your developer.', 'bulk-sms-portal'))}<div data-bx-api>${skeleton(5)}</div>`);
  const r = await C.api('/api-details');
  if (!ctx.live()) return;
  const box = $('[data-bx-api]', root);
  const support = CFG.supportEmail || '';
  if (!r || !r.ok) {
    box.innerHTML = `<div class="bx-split">
      <section class="bx-panel"><div class="bx-panel-head"><div><h2>${__('Connect your website or app', 'bulk-sms-portal')}</h2><p>${__('With the API, your website or software can send SMS for you, such as order updates, login codes or reminders, using your wallet and sender names.', 'bulk-sms-portal')}</p></div></div>
        ${note('info', __('API access is switched off for your account', 'bulk-sms-portal'), __('Ask us to switch it on. Tell us what you want to connect and roughly how many messages you send.', 'bulk-sms-portal'), support ? `<a class="bx-btn is-primary is-small" href="mailto:${esc(support)}?subject=${encodeURIComponent('Please turn on API access')}">${sprintf(/* translators: %1$s, %2$s: values filled in when shown */ __('%1$sEmail %2$s', 'bulk-sms-portal'), icon('mail', 16), esc(support))}</a>` : btn(__('Contact support', 'bulk-sms-portal'), 'data-bx-go="help"', 'is-small'))}
      </section>
      <aside class="bx-aside"><section class="bx-panel"><h2>${__('What you will need', 'bulk-sms-portal')}</h2><ul class="bx-stack is-tight bx-mt-s">
        <li class="bx-row-flex is-nowrap">${icon('badge', 18)}<span>${__('An approved sender name', 'bulk-sms-portal')}</span></li>
        <li class="bx-row-flex is-nowrap">${icon('wallet', 18)}<span>${__('Money in your wallet', 'bulk-sms-portal')}</span></li>
        <li class="bx-row-flex is-nowrap">${icon('key', 18)}<span>${__('An API key, which you create here once API access is on', 'bulk-sms-portal')}</span></li>
      </ul></section></aside>
    </div>`;
    bindGo(box);
    return;
  }
  const codes = r.response_codes || {};
  const examples = {
    send: `curl -H 'Authorization: Bearer YOUR_API_KEY' -X POST '${r.send_url}' \\
  --data-urlencode 'sender=YOUR_SENDER_NAME' \\
  --data-urlencode 'recipients=234XXXXXXXXXX' \\
  --data-urlencode 'message=YOUR_MESSAGE'`,
    balance: `curl -H 'Authorization: Bearer YOUR_API_KEY' '${r.balance_url}'`,
    status: `curl -H 'Authorization: Bearer YOUR_API_KEY' '${r.status_url}?messageid=MSG123'`
  };
  const exLabels = { send: __('Send SMS', 'bulk-sms-portal'), balance: __('Check balance', 'bulk-sms-portal'), status: __('Check a message', 'bulk-sms-portal') };
  box.innerHTML = `<div class="bx-stack">
    <section class="bx-panel" aria-labelledby="bx-api-how">
      <div class="bx-panel-head"><div><h2 id="bx-api-how">${__('How it works', 'bulk-sms-portal')}</h2><p>${__('Your website or app sends SMS through your account, using your wallet and your approved sender names.', 'bulk-sms-portal')}</p></div></div>
      <ol class="bx-checklist">
        <li><span class="bx-tick bx-tick-num">1</span><div><span class="bx-check-title">${__('Create an API key below', 'bulk-sms-portal')}</span><p class="bx-small bx-muted">${__('Make one for each website or app, so you can switch one off without affecting the others.', 'bulk-sms-portal')}</p></div></li>
        <li><span class="bx-tick bx-tick-num">2</span><div><span class="bx-check-title">${__('Give the key to your developer', 'bulk-sms-portal')}</span><p class="bx-small bx-muted">${__('Keep it private like a password. It must never appear in the code of a public web page.', 'bulk-sms-portal')}</p></div></li>
        <li><span class="bx-tick bx-tick-num">3</span><div><span class="bx-check-title">${__('Their software sends it with each request', 'bulk-sms-portal')}</span><p class="bx-small bx-muted">${__('In the Authorization header, over https. The examples below are ready to copy.', 'bulk-sms-portal')}</p></div></li>
      </ol>
    </section>
    <section class="bx-panel is-flush" aria-labelledby="bx-keys-h">
      <div class="bx-panel-head"><div><h2 id="bx-keys-h">${__('Your API keys', 'bulk-sms-portal')}</h2><p>${__('Switching a key off stops that website or app at once. Your portal password is not affected.', 'bulk-sms-portal')}</p></div></div>
      <div class="bx-filters bx-mt-0">
        <div class="bx-field"><label class="bx-label" for="bx-key-name">${__('Name for the new key', 'bulk-sms-portal')}</label><input id="bx-key-name" class="bx-input" maxlength="60" placeholder="${esc(__('For example: Online shop', 'bulk-sms-portal'))}"></div>
        <div class="bx-filter-actions"><button type="button" class="bx-btn is-primary" data-bx-key-new>${sprintf(/* translators: %s: a value filled in when shown */ __('%sCreate key', 'bulk-sms-portal'), icon('key', 18))}</button></div>
      </div>
      <div data-bx-key-secret></div>
      <div data-bx-keys>${loading()}</div>
    </section>
    <section class="bx-panel" aria-labelledby="bx-ex-h">
      <div class="bx-panel-head"><div><h2 id="bx-ex-h">${__('Examples for your developer', 'bulk-sms-portal')}</h2><p>${__('Replace the words in capitals. A successful send returns a message ID; use it to check the result.', 'bulk-sms-portal')}</p></div></div>
      ${tabs(Object.keys(examples).map(k => [k, exLabels[k]]), 'send', 'data-bx-ex')}
      ${Object.keys(examples).map(k => `<div class="bx-stack is-tight bx-mt-m" data-bx-ex-pane="${k}" ${k === 'send' ? '' : 'hidden'}><pre class="bx-code">${esc(examples[k])}</pre><div>${btn(icon('copy', 16) + __('Copy example', 'bulk-sms-portal'), `data-bx-copy="${esc(examples[k])}"`, 'is-small')}</div></div>`).join('')}
      <dl class="bx-kv bx-mt-m">
        ${[[__('Send SMS', 'bulk-sms-portal'), r.send_url], [__('Check balance', 'bulk-sms-portal'), r.balance_url], [__('Check a message', 'bulk-sms-portal'), r.status_url]].filter(x => x[1]).map(([t, u]) => `<div><dt>${esc(t)}</dt><dd class="bx-mono">${esc(u)}</dd></div>`).join('')}
      </dl>
    </section>
    ${Object.keys(codes).length ? `<section class="bx-panel is-flush" aria-labelledby="bx-codes-h"><div class="bx-panel-head"><div><h2 id="bx-codes-h">${__('Reply codes', 'bulk-sms-portal')}</h2><p>${__('Every reply includes one of these codes, so your developer knows what happened.', 'bulk-sms-portal')}</p></div></div>
      <div class="bx-list is-inset">${Object.entries(codes).map(([c, t]) => `<div class="bx-tr" style="--cols:120px minmax(0,1fr)"><code class="bx-td-lead">${esc(c)}</code><span>${esc(t)}</span></div>`).join('')}</div></section>` : ''}
    <details class="bx-panel bx-qa-panel"><summary><strong>${__('Older connections that use your portal password', 'bulk-sms-portal')}</strong></summary>
      <div class="bx-stack is-tight bx-mt-m">
        <p>${__('Websites set up before API keys can still sign in with your username', 'bulk-sms-portal')} <b>${esc(r.username || '')}</b> ${__('and your portal password, sent in the Authorization header (Basic) over https. This keeps working, but we recommend moving to an API key:', 'bulk-sms-portal')}</p>
        <ul class="bx-bullets bx-small"><li>${__('anyone with your password can also sign in to your portal and spend your wallet;', 'bulk-sms-portal')}</li><li>${__('changing your portal password stops those websites until they are updated;', 'bulk-sms-portal')}</li><li>${__('a password written into a web address can end up in server logs.', 'bulk-sms-portal')}</li></ul>
      </div>
    </details>
  </div>`;
  $$('[data-bx-ex]', box).forEach(b => b.onclick = () => { $$('[data-bx-ex]', box).forEach(x => x.setAttribute('aria-selected', x === b ? 'true' : 'false')); $$('[data-bx-ex-pane]', box).forEach(p => p.hidden = p.dataset.bxExPane !== b.dataset.bxEx); });
  bindCopy(box);
  const loadKeys = async () => {
    const kb = $('[data-bx-keys]', box);
    const kr = await C.api('/api-keys');
    if (!ctx.live()) return;
    if (!kr || !kr.ok) { kb.innerHTML = `<div class="bx-empty"><p>${esc(friendly(kr, __('We could not load your keys.', 'bulk-sms-portal')))}</p></div>`; return; }
    const items = kr.items || [];
    kb.innerHTML = items.length ? `<div class="bx-list is-inset is-top">
      <div class="bx-tr is-head" style="--cols:1.4fr 1fr 1fr 1fr 120px"><span>${__('Key', 'bulk-sms-portal')}</span><span>${__('Starts with', 'bulk-sms-portal')}</span><span>${__('Created', 'bulk-sms-portal')}</span><span>${__('Last used', 'bulk-sms-portal')}</span><span></span></div>
      ${items.map(k => { const on = String(k.status || 'active') === 'active'; return `<div class="bx-tr" style="--cols:1.4fr 1fr 1fr 1fr 120px"><span class="bx-td-main bx-td-lead"><strong>${esc(k.key_name || __('API key', 'bulk-sms-portal'))}</strong>${pill(on ? 'good' : 'bad', on ? __('Working', 'bulk-sms-portal') : __('Switched off', 'bulk-sms-portal'))}</span><span class="bx-mono" data-label="${esc(__('Starts with', 'bulk-sms-portal'))}">${esc(k.key_prefix || '')}…</span><span data-label="${esc(__('Created', 'bulk-sms-portal'))}">${esc(fmtDate(k.created_at, false))}</span><span data-label="${esc(__('Last used', 'bulk-sms-portal'))}">${k.last_used_at ? esc(fmtDate(k.last_used_at)) : __('Not used yet', 'bulk-sms-portal')}</span><span class="bx-td-actions">${on ? btn(__('Switch off', 'bulk-sms-portal'), `data-bx-revoke="${esc(k.id)}" data-name="${esc(k.key_name || __('this key', 'bulk-sms-portal'))}"`, 'is-small is-danger') : ''}</span></div>`; }).join('')}</div>`
      : empty('key', __('No keys yet', 'bulk-sms-portal'), __('Create a key and give it to your developer.', 'bulk-sms-portal'));
    $$('[data-bx-revoke]', kb).forEach(b => b.onclick = async () => {
      if (!await confirmBox({ title: `${sprintf(/* translators: %s: a value filled in when shown */ __('Switch off %s?', 'bulk-sms-portal'), b.dataset.name)}`, body: `<p>${__('Any website or app using this key will stop sending straight away. This cannot be undone; you can create a new key instead.', 'bulk-sms-portal')}</p>`, confirm: __('Switch off key', 'bulk-sms-portal'), danger: true })) return;
      const res = await C.api('/api-keys/' + encodeURIComponent(b.dataset.bxRevoke) + '/revoke', { method: 'POST', body: '{}' });
      if (res && res.ok) { const sec = $('[data-bx-key-secret]', box); if (sec) sec.innerHTML = ''; toast(__('Key switched off.', 'bulk-sms-portal')); loadKeys(); } else toast(friendly(res, __('We could not switch off that key.', 'bulk-sms-portal')), 'bad');
    });
  };
  $('[data-bx-key-new]', box).onclick = async (e) => {
    const name = $('#bx-key-name', box).value.trim() || __('API key', 'bulk-sms-portal');
    const done = busy(e.currentTarget, __('Creating…', 'bulk-sms-portal'));
    const res = await C.api('/api-keys', { method: 'POST', body: JSON.stringify({ key_name: name }) });
    done();
    const sec = $('[data-bx-key-secret]', box);
    if (res && res.ok && res.api_key) {
      sec.innerHTML = `<div class="bx-item-body bx-mt-0">${note('wait', __('Copy this key now', 'bulk-sms-portal'), __('For your safety we only show it once. Keep it private, like a password.', 'bulk-sms-portal'))}<div class="bx-copy"><span class="bx-mono">${esc(res.api_key)}</span><button type="button" class="bx-btn is-small is-primary" data-bx-copy="${esc(res.api_key)}">${sprintf(/* translators: %s: a value filled in when shown */ __('%sCopy key', 'bulk-sms-portal'), icon('copy', 16))}</button></div></div>`;
      bindCopy(sec); $('#bx-key-name', box).value = ''; loadKeys();
    } else sec.innerHTML = `<div class="bx-item-body">${note('bad', __('Key not created', 'bulk-sms-portal'), esc(friendly(res)))}</div>`;
  };
  loadKeys();
});


/* ---- 80-help.js ---- */
/* ==========================================================================
   Help Centre
   ========================================================================== */
const PAGE_LINKS = { compose: __('Send SMS', 'bulk-sms-portal'), reports: __('Delivery Reports', 'bulk-sms-portal'), history: __('Message History', 'bulk-sms-portal'), fund: __('Buy SMS', 'bulk-sms-portal'), sender: __('Sender ID', 'bulk-sms-portal'), api: 'API', profile: __('Profile & Security', 'bulk-sms-portal'), pricing: __('Pricing', 'bulk-sms-portal'), groups: __('Phonebook', 'bulk-sms-portal'), transactions: __('Wallet History', 'bulk-sms-portal'), settings: __('Notifications', 'bulk-sms-portal') };
const helpState = { q: '' };

page('help', 'Help Centre', async (host, ctx) => {
  const root = mount(host, `
    ${pageHead(__('Help Centre', 'bulk-sms-portal'), __('Answers to common questions, a quick check of your account, and how to reach us.', 'bulk-sms-portal'))}
    <form class="bx-search" role="search" data-bx-help-form><label class="bx-sr" for="bx-help-q">${__('Search help', 'bulk-sms-portal')}</label><input id="bx-help-q" class="bx-input" type="search" value="${esc(helpState.q)}" placeholder="${esc(__('Search, for example: failed, payment, sender name', 'bulk-sms-portal'))}" autocomplete="off"><button type="submit" class="bx-btn is-primary is-large">${sprintf(/* translators: %s: a value filled in when shown */ __('%sSearch', 'bulk-sms-portal'), icon('search', 18))}</button></form>
    <div class="bx-chips bx-mt-s" data-bx-help-chips></div>
    <div class="bx-section bx-split">
      <div class="bx-stack" data-bx-help-main>${skeleton(6)}</div>
      <aside class="bx-aside">
        <section class="bx-panel" aria-labelledby="bx-hc-check"><div class="bx-panel-head"><div><h2 id="bx-hc-check">${__('Your account right now', 'bulk-sms-portal')}</h2><p>${__('The usual things that stop messages going out.', 'bulk-sms-portal')}</p></div></div><div data-bx-check>${skeleton(3)}</div></section>
        <section class="bx-panel" aria-labelledby="bx-hc-contact"><div class="bx-panel-head"><div><h2 id="bx-hc-contact">${__('Talk to us', 'bulk-sms-portal')}</h2></div></div><div data-bx-contact>${skeleton(2)}</div></section>
      </aside>
    </div>`);

  let draw = () => {};
  $('[data-bx-help-form]', root).onsubmit = (e) => { e.preventDefault(); helpState.q = $('#bx-help-q', root).value; draw(); };
  const [hr, sr] = await Promise.all([C.api('/help-content'), canUse('sender_ids') ? C.api('/sender-ids') : Promise.resolve(null)]);
  if (!ctx.live()) return;
  const content = (hr && hr.ok && hr.content) || {};
  const visible = x => x && Number(x.enabled ?? 1) && (x.status || 'published') === 'published' && (x.visibility !== 'admin' || isAdmin());
  const byOrder = (a, b) => Number(a.order || 0) - Number(b.order || 0);
  const questions = (content.troubleshooting || []).filter(visible).sort(byOrder);
  const guides = (content.knowledge || []).filter(visible).sort(byOrder);
  const channels = (content.channels || []).filter(visible).sort(byOrder);
  const chips = (content.suggestions || []).filter(visible).sort(byOrder);

  /* Quick account check */
  const bal = balanceKobo();
  const approved = (S().approved_senders || []).length;
  const pendingNames = sr && sr.ok ? (sr.items || []).filter(x => x.status === 'pending').length : 0;
  const failed = Number((S().delivery_metrics || {}).failed || 0);
  const checks = [
    bal > 0 ? ['good', __('Your wallet has money', 'bulk-sms-portal'), naira(bal) + ' available.', ''] : ['bad', __('Your wallet is empty', 'bulk-sms-portal'), __('Add money before you send.', 'bulk-sms-portal'), btn(__('Buy SMS', 'bulk-sms-portal'), 'data-bx-go="fund"', 'is-small')],
    approved ? ['good', `${sprintf(/* translators: %s: a number */ _n('%s sender name', '%s sender names', Number(approved), 'bulk-sms-portal'), num(approved))} ready`, (S().approved_senders || []).slice(0, 3).join(', '), ''] : (pendingNames ? ['wait', __('Your sender name is waiting for approval', 'bulk-sms-portal'), __('We will let you know when it has been checked.', 'bulk-sms-portal'), btn(__('See Sender ID', 'bulk-sms-portal'), 'data-bx-go="sender"', 'is-small')] : ['wait', __('No sender name of your own yet', 'bulk-sms-portal'), __('Messages show a shared name until you have yours.', 'bulk-sms-portal'), btn(__('Ask for a name', 'bulk-sms-portal'), 'data-bx-go="sender"', 'is-small')]),
    failed ? ['wait', `${sprintf(/* translators: %s: a value filled in when shown */ __('%s failed so far', 'bulk-sms-portal'), sprintf(/* translators: %s: a number */ _n('%s message', '%s messages', Number(failed), 'bulk-sms-portal'), num(failed)))}`, __('Open Message History and choose “Failed” to see why.', 'bulk-sms-portal'), btn(__('See failed messages', 'bulk-sms-portal'), 'data-bx-failed', 'is-small')] : ['good', __('No failed messages', 'bulk-sms-portal'), '', '']
  ];
  const ck = $('[data-bx-check]', root);
  ck.innerHTML = `<ul class="bx-checklist">${checks.map(([t, title, text, act]) => `<li class="${t === 'good' ? 'is-ok' : ''}"><span class="bx-tick">${icon(t === 'good' ? 'check' : 'alert', 16, 2.2)}</span><div><span class="bx-check-title">${esc(title)}</span>${text ? `<p class="bx-small bx-muted">${esc(text)}</p>` : ''}</div>${act}</li>`).join('')}</ul>`;
  bindGo(ck);
  const fb = $('[data-bx-failed]', ck); if (fb) fb.onclick = () => APP.openMessages('', 'failed');

  /* Contact */
  const support = CFG.supportEmail || '';
  const chIcon = { email: 'mail', whatsapp: 'chat', phone: 'phone', technical: 'plug' };
  const chHref = (c) => {
    const v = String(c.value || '').trim(); if (!v) return '';
    if (c.type === 'email' || /@/.test(v)) return 'mailto:' + v;
    if (c.type === 'whatsapp') return 'https://wa.me/' + v.replace(/\D/g, '');
    if (c.type === 'phone') return 'tel:' + v.replace(/[^\d+]/g, '');
    return /^https?:\/\//.test(v) ? v : '';
  };
  let contact = channels.filter(c => String(c.value || '').trim() || (c.type === 'email' && support)).map(c => ({ ...c, value: String(c.value || '').trim() || support }));
  if (!contact.length && support) contact = [{ title: __('Email support', 'bulk-sms-portal'), type: 'email', value: support, summary: __('For account and payment questions.', 'bulk-sms-portal') }];
  $('[data-bx-contact]', root).innerHTML = contact.length ? `<div class="bx-stack is-tight">${contact.map(c => { const href = chHref(c); return `<div class="bx-row-flex is-nowrap bx-contact">${icon(chIcon[c.type] || 'chat', 20)}<div class="bx-td-main"><strong>${esc(c.title || __('Contact', 'bulk-sms-portal'))}</strong>${c.summary ? `<small>${esc(c.summary)}</small>` : ''}${href ? `<a href="${esc(href)}"${href.indexOf('http') === 0 ? ' target="_blank" rel="noopener"' : ''}>${esc(c.value)}</a>` : `<small>${esc(c.value)}</small>`}${c.availability ? `<small>${esc(c.availability)}</small>` : ''}</div></div>`; }).join('')}</div>` : `<p class="bx-muted">${__('Contact details have not been added yet.', 'bulk-sms-portal')}</p>`;

  /* Questions and guides, filtered by the search */
  const main = $('[data-bx-help-main]', root);
  const words = q => String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (x, q) => { const hay = [x.title, x.summary, x.body, x.category, x.keywords].join(' ').toLowerCase(); return words(q).every(w => hay.includes(w)); };
  const qa = (x) => `<details class="bx-qa"><summary>${esc(x.title || __('Help', 'bulk-sms-portal'))}</summary><div class="bx-qa-body">${x.category ? `<span class="bx-qa-tag">${esc(x.category)}</span>` : ''}${x.summary && x.body ? `<p><strong>${esc(x.summary)}</strong></p>` : ''}<p>${esc(x.body || x.summary || '')}</p>${x.related_page && PAGE_LINKS[x.related_page] ? `<div>${btn(__('Open ', 'bulk-sms-portal') + esc(PAGE_LINKS[x.related_page]), `data-bx-go="${esc(x.related_page)}"`, 'is-small')}</div>` : ''}</div></details>`;
  draw = () => {
    const q = helpState.q.trim();
    const qs = q ? questions.filter(x => matches(x, q)) : questions;
    const gs = q ? guides.filter(x => matches(x, q)) : guides;
    main.innerHTML = (!qs.length && !gs.length) ? `<div class="bx-list">${empty('search', q ? __('No answers match your search', 'bulk-sms-portal') : __('No help articles yet', 'bulk-sms-portal'), q ? __('Try a shorter word, or contact us using the details on this page.', 'bulk-sms-portal') : __('Contact us using the details on this page.', 'bulk-sms-portal'), q ? btn(__('Clear search', 'bulk-sms-portal'), 'data-bx-clear', 'is-small') : '')}</div>`
      : `${qs.length ? `<section aria-labelledby="bx-hc-q"><div class="bx-section-head"><h2 id="bx-hc-q">${q ? __('Matching questions', 'bulk-sms-portal') : __('Common questions', 'bulk-sms-portal')}</h2></div><div class="bx-list">${qs.map(qa).join('')}</div></section>` : ''}
         ${gs.length ? `<section aria-labelledby="bx-hc-g"><div class="bx-section-head"><h2 id="bx-hc-g">${q ? __('Matching guides', 'bulk-sms-portal') : __('Guides', 'bulk-sms-portal')}</h2></div><div class="bx-list">${gs.map(qa).join('')}</div></section>` : ''}`;
    bindGo(main);
    const cl = $('[data-bx-clear]', main); if (cl) cl.onclick = () => { helpState.q = ''; $('#bx-help-q', root).value = ''; draw(); };
    if (q) { const first = $('details.bx-qa', main); if (first && qs.length + gs.length <= 3) first.open = true; }
  };
  $('[data-bx-help-chips]', root).innerHTML = chips.map(c => `<button type="button" class="bx-chip" data-bx-q="${esc(c.query || c.title)}">${esc(c.title || c.query)}</button>`).join('');
  $$('[data-bx-q]', root).forEach(b => b.onclick = () => { helpState.q = b.dataset.bxQ; $('#bx-help-q', root).value = helpState.q; draw(); });
  $('#bx-help-q', root).addEventListener('input', (e) => { if (!e.target.value) { helpState.q = ''; draw(); } });
  draw();
});


/* ---- 90-records.js ---- */
/* ==========================================================================
   Message History, Delivery Reports, Wallet History
   One shared layout. Admins see every customer (with a Customer column);
   customers see only their own records. Filters run on the server.
   ========================================================================== */
const REC = { messages: { f: {}, page: 1 }, reports: { f: {}, page: 1 }, wallet: { f: {}, page: 1 } };
/* Opened from WordPress admin with #campaign=…&status=… in the address. */
function filtersFromHash(key) {
  try {
    const h = new URLSearchParams(String(location.hash || '').replace(/^#/, ''));
    if (!h.has('campaign') && !h.has('status')) return;
    const f = {};
    if (h.get('campaign')) f.campaign = h.get('campaign');
    if (h.get('status')) f.status = h.get('status');
    REC[key].f = f; REC[key].page = 1;
    history.replaceState(null, '', location.pathname + location.search);
  } catch (e) {}
}
const PERIODS = [['', __('Any time', 'bulk-sms-portal')], ['today', __('Today', 'bulk-sms-portal')], ['7', __('Last 7 days', 'bulk-sms-portal')], ['30', __('Last 30 days', 'bulk-sms-portal')], ['month', __('This month', 'bulk-sms-portal')], ['custom', __('Choose dates', 'bulk-sms-portal')]];

APP.openReport = function (campaignId) {
  if (!document.getElementById('bsms-page-reports') && pageUrl('reports')) { location.href = pageUrl('reports') + (campaignId ? '#campaign=' + encodeURIComponent(campaignId) : ''); return; }
  REC.reports.f = campaignId ? { campaign: String(campaignId) } : {}; REC.reports.page = 1; go('reports');
};
APP.openMessages = function (campaignId, status) {
  if (!document.getElementById('bsms-page-history') && pageUrl('history')) { location.href = pageUrl('history') + '#' + new URLSearchParams({ campaign: campaignId || '', status: status || '' }); return; }
  REC.messages.f = {}; if (campaignId) REC.messages.f.campaign = String(campaignId); if (status) REC.messages.f.status = status; REC.messages.page = 1; go('history');
};

function ymd(d) { const p = x => String(x).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
function periodRange(p) {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const back = n => { const d = new Date(t); d.setDate(d.getDate() - n); return d; };
  if (p === 'today') return { from: ymd(t), to: ymd(t) };
  if (p === '7') return { from: ymd(back(6)), to: ymd(t) };
  if (p === '30') return { from: ymd(back(29)), to: ymd(t) };
  if (p === 'month') return { from: ymd(new Date(t.getFullYear(), t.getMonth(), 1)), to: ymd(t) };
  return { from: '', to: '' };
}
function recQuery(f, pg, per) {
  const q = new URLSearchParams();
  const range = f.period && f.period !== 'custom' ? periodRange(f.period) : { from: f.from || '', to: f.to || '' };
  const all = { ...f, ...range }; delete all.period;
  Object.entries(all).forEach(([k, v]) => { if (v !== undefined && v !== null && String(v) !== '') q.set(k, v); });
  if (pg) q.set('page', pg);
  if (per) q.set('per_page', per);
  return q.toString();
}
function filterBar(key, o) {
  const f = REC[key].f, period = f.period || '';
  return `<form class="bx-filters" data-bx-filter="${key}" role="search" aria-label="${sprintf(/* translators: %s: a value filled in when shown */ esc(__('Find %s', 'bulk-sms-portal')), esc(o.what))}">
    <div class="bx-field"><label class="bx-label" for="bx-${key}-q">${__('Search', 'bulk-sms-portal')}</label><input id="bx-${key}-q" class="bx-input" type="search" name="search" value="${esc(f.search || '')}" placeholder="${esc(isAdmin() ? o.adminPlaceholder : o.placeholder)}" autocomplete="off"></div>
    <div class="bx-field"><label class="bx-label" for="bx-${key}-s">${esc(o.statusLabel)}</label><select id="bx-${key}-s" class="bx-select" name="${o.statusName}">${o.statuses.map(s => `<option value="${esc(s[0])}"${String(f[o.statusName] || '') === s[0] ? ' selected' : ''}>${esc(s[1])}</option>`).join('')}</select></div>
    <div class="bx-field"><label class="bx-label" for="bx-${key}-p">${__('When', 'bulk-sms-portal')}</label><select id="bx-${key}-p" class="bx-select" name="period">${PERIODS.map(p => `<option value="${p[0]}"${period === p[0] ? ' selected' : ''}>${p[1]}</option>`).join('')}</select></div>
    <div class="bx-field" data-bx-dates ${period === 'custom' ? '' : 'hidden'}><label class="bx-label" for="bx-${key}-from">${__('From', 'bulk-sms-portal')}</label><input id="bx-${key}-from" class="bx-input" type="date" name="from" value="${esc(f.from || '')}"></div>
    <div class="bx-field" data-bx-dates ${period === 'custom' ? '' : 'hidden'}><label class="bx-label" for="bx-${key}-to">To</label><input id="bx-${key}-to" class="bx-input" type="date" name="to" value="${esc(f.to || '')}"></div>
    ${isAdmin() ? `<div class="bx-field"><label class="bx-label" for="bx-${key}-c">${__('Customer', 'bulk-sms-portal')}</label><input id="bx-${key}-c" class="bx-input" type="search" name="customer" value="${esc(f.customer || '')}" placeholder="${esc(__('Name, email or number', 'bulk-sms-portal'))}" autocomplete="off"></div>` : ''}
    <div class="bx-filter-actions"><button type="submit" class="bx-btn is-primary">${sprintf(/* translators: %s: a value filled in when shown */ __('%sSearch', 'bulk-sms-portal'), icon('search', 18))}</button><button type="button" class="bx-btn" data-bx-clear>${__('Clear', 'bulk-sms-portal')}</button></div>
  </form><div data-bx-chips></div>`;
}
function bindFilters(root, key, reload) {
  const form = $(`[data-bx-filter="${key}"]`, root); if (!form) return;
  const sync = () => { const c = form.elements.period.value === 'custom'; $$('[data-bx-dates]', form).forEach(el => el.hidden = !c); };
  form.elements.period.onchange = () => { sync(); if (form.elements.period.value !== 'custom') form.requestSubmit(); };
  const st = form.querySelector('select:not([name="period"])'); if (st) st.onchange = () => form.requestSubmit();
  form.onsubmit = e => {
    e.preventDefault();
    const data = new FormData(form), f = { ...REC[key].f };
    ['search', 'status', 'type', 'period', 'from', 'to', 'customer'].forEach(k => { if (data.has(k)) f[k] = String(data.get(k) || '').trim(); });
    if (f.period !== 'custom') { f.from = ''; f.to = ''; }
    REC[key].f = f; reload(1, true);
  };
  $('[data-bx-clear]', form).onclick = () => { REC[key].f = {}; reload(1, true); };
}
function chipsHtml(key, labels) {
  const f = REC[key].f, out = [];
  if (f.campaign) out.push(['campaign', __('One send only', 'bulk-sms-portal')]);
  if (f.search) out.push(['search', '“' + f.search + '”']);
  if (f.customer) out.push(['customer', __('Customer: ', 'bulk-sms-portal') + f.customer]);
  const st = f.status || f.type; if (st && labels[st]) out.push([f.status ? 'status' : 'type', labels[st]]);
  if (f.period && f.period !== 'custom') out.push(['period', (PERIODS.find(p => p[0] === f.period) || [, ''])[1]]);
  if (f.period === 'custom' && (f.from || f.to)) out.push(['period', (f.from || '…') + ' to ' + (f.to || '…')]);
  if (!out.length) return '';
  return `<div class="bx-active-filters"><span>${__('Showing:', 'bulk-sms-portal')}</span>${out.map(c => `<button type="button" class="bx-chip is-filter" data-bx-chip="${c[0]}" aria-label="${sprintf(/* translators: %s: a value filled in when shown */ esc(__('Remove filter %s', 'bulk-sms-portal')), esc(c[1]))}">${esc(c[1])} ${icon('x', 14, 2)}</button>`).join('')}</div>`;
}
function bindChips(root, key, reload) {
  $$('[data-bx-chip]', root).forEach(b => b.onclick = () => {
    const f = { ...REC[key].f }, k = b.dataset.bxChip;
    if (k === 'period') { delete f.period; delete f.from; delete f.to; } else delete f[k];
    REC[key].f = f; reload(1, true);
  });
}
const hasFilters = key => Object.values(REC[key].f).some(Boolean);
async function exportCsv(button, path, key) {
  const done = busy(button, __('Preparing…', 'bulk-sms-portal'));
  const r = await C.api(path + '?' + recQuery(REC[key].f), { timeout: 60000 });
  done();
  if (r && r.ok) downloadFile(r.filename, r.csv); else toast(friendly(r, __('The download could not be prepared. Please try again.', 'bulk-sms-portal')), 'bad');
}
function customerCell(x) { return isAdmin() && x.customer ? `<span class="bx-td-main" data-label="${esc(__('Customer', 'bulk-sms-portal'))}"><strong>${esc(x.customer.name)}</strong><small class="bx-break">${esc(x.customer.email)}</small></span>` : ''; }
const RESULT_TONE = { confirmed: 'good', no_report: 'good', successful: 'good', failed: 'bad', sending: 'wait', not_sent: 'info' };

/* ---- Message History ---------------------------------------------------- */
const MSG_LABELS = { successful: __('Successful', 'bulk-sms-portal'), confirmed: __('Successful, confirmed by the network', 'bulk-sms-portal'), no_report: __('Successful, no failure reported', 'bulk-sms-portal'), failed: __('Failed', 'bulk-sms-portal'), sending: __('Sending', 'bulk-sms-portal'), not_sent: __('Not sent', 'bulk-sms-portal') };
page('history', 'Message History', (host, ctx) => { filtersFromHash('messages'); return drawMessages(host, ctx, REC.messages.page, true); });
async function drawMessages(host, ctx, pg = 1, rebuild = false) {
  const key = 'messages', admin = isAdmin();
  REC[key].page = pg;
  let root = $(':scope > .bx-page', host);
  if (rebuild || !root) {
    root = mount(host, `
      ${pageHead(__('Message History', 'bulk-sms-portal'), admin ? __('Every text message sent on the platform, one line per phone number. Use the search to find a customer, a number or a message.', 'bulk-sms-portal') : __('Every text message you have sent, one line per phone number. Tap a line to see the full message and what it cost.', 'bulk-sms-portal'),
        btn(icon('download', 18) + __('Download', 'bulk-sms-portal'), 'data-bx-export') + (admin || !canUse('compose_sms') ? '' : btn(icon('send', 18) + __('Send SMS', 'bulk-sms-portal'), 'data-bx-go="compose"', 'is-primary')))}
      <div class="bx-stats" data-bx-tiles>${stat(__('All messages', 'bulk-sms-portal'), '…')}</div>
      <div class="bx-section">${filterBar(key, { what: 'messages', placeholder: __('Phone number, message, sender name or message ID', 'bulk-sms-portal'), adminPlaceholder: __('Number, message, sender name, message ID or customer', 'bulk-sms-portal'), statusLabel: __('Result', 'bulk-sms-portal'), statusName: 'status', statuses: [['', __('All results', 'bulk-sms-portal')], ['successful', __('Successful', 'bulk-sms-portal')], ['failed', __('Failed', 'bulk-sms-portal')], ['sending', __('Sending', 'bulk-sms-portal')], ['not_sent', __('Not sent', 'bulk-sms-portal')]].concat(admin ? [['confirmed', __('Successful, confirmed by the network', 'bulk-sms-portal')], ['no_report', __('Successful, no failure reported', 'bulk-sms-portal')]] : []) })}
      <div data-bx-list aria-live="polite">${loading(__('Loading messages…', 'bulk-sms-portal'))}</div></div>`);
    bindGo(root);
    bindFilters(root, key, (p, r) => drawMessages(host, ctx, p, r));
    $('[data-bx-export]', root).onclick = e => exportCsv(e.currentTarget, '/records/messages/export', key);
  }
  const list = $('[data-bx-list]', root);
  list.innerHTML = loading(__('Loading messages…', 'bulk-sms-portal'));
  const r = await C.api('/records/messages?' + recQuery(REC[key].f, pg, 20));
  if (!ctx.live()) return;
  if (!r || !r.ok) { list.innerHTML = `<div class="bx-panel">${note('bad', __('We could not load this list', 'bulk-sms-portal'), esc(friendly(r)))}</div>`; return; }
  if (pageBack(r, pg, p => drawMessages(host, ctx, p))) return;
  const c = r.counts || {}, st = REC[key].f.status || '';
  $('[data-bx-tiles]', root).innerHTML = [
    stat(__('All messages', 'bulk-sms-portal'), num(c.all), { filter: '', active: !st }),
    stat(__('Successful', 'bulk-sms-portal'), num(c.successful), { filter: 'successful', active: st === 'successful' || st === 'confirmed' || st === 'no_report', tone: 'good', note: __('No failure reported', 'bulk-sms-portal') }),
    stat(__('Failed', 'bulk-sms-portal'), num(c.failed), { filter: 'failed', active: st === 'failed', tone: Number(c.failed) ? 'bad' : '' }),
    stat(__('Sending', 'bulk-sms-portal'), num(c.sending), { filter: 'sending', active: st === 'sending', tone: Number(c.sending) ? 'wait' : '' }),
    Number(c.not_sent || 0) ? stat(__('Not sent', 'bulk-sms-portal'), num(c.not_sent), { filter: 'not_sent', active: st === 'not_sent', note: __('Repeated or wrong numbers', 'bulk-sms-portal') }) : ''
  ].join('');
  $$('[data-bx-filter-value]', root).forEach(b => b.onclick = () => { REC[key].f = { ...REC[key].f, status: b.dataset.bxFilterValue }; drawMessages(host, ctx, 1, true); });
  $('[data-bx-chips]', root).innerHTML = chipsHtml(key, MSG_LABELS);
  bindChips(root, key, (p, rb) => drawMessages(host, ctx, p, rb));
  const items = r.items || [];
  if (!items.length) { list.innerHTML = `<div class="bx-list">${empty('list', __('No messages found', 'bulk-sms-portal'), hasFilters(key) ? __('Try a different search or clear the filters.', 'bulk-sms-portal') : __('Messages you send will show here.', 'bulk-sms-portal'))}</div>`; return; }
  const cols = admin ? '1fr 1.2fr 1fr 2fr 1fr 0.8fr' : '1fr 1fr 2.4fr 1fr 0.8fr';
  list.innerHTML = `<div class="bx-list">
    <div class="bx-tr is-head" style="--cols:${cols}"><span>${__('Date', 'bulk-sms-portal')}</span>${admin ? `<span>${__('Customer', 'bulk-sms-portal')}</span>` : ''}<span>${__('Sent to', 'bulk-sms-portal')}</span><span>${__('Message', 'bulk-sms-portal')}</span><span>${__('Result', 'bulk-sms-portal')}</span><span class="is-num">${__('Cost', 'bulk-sms-portal')}</span></div>
    ${items.map(m => {
      const cost = m.refunded_kobo > 0 ? `<span class="bx-td-main"><s>${esc(naira(m.charged_kobo))}</s><small>${__('Returned', 'bulk-sms-portal')}</small></span>` : (m.charged_kobo > 0 ? esc(naira(m.charged_kobo)) : `<span class="bx-muted">${__('No charge', 'bulk-sms-portal')}</span>`);
      const tech = admin && (m.technical || m.technical_note) ? `<div class="bx-admin-box"><strong>${__('For admins', 'bulk-sms-portal')}</strong><span class="bx-break">${esc(m.technical || '')}</span>${m.technical_note ? `<small class="bx-muted bx-break">${esc(m.technical_note)}</small>` : ''}</div>` : '';
      const acts = admin && m.result !== 'not_sent' ? `<div class="bx-row-flex">${btn(__('Check result again', 'bulk-sms-portal'), `data-bx-job-sync="${m.id}" data-cid="${m.campaign_id}"`, 'is-small')}${m.result !== 'successful' ? btn(__('Mark successful', 'bulk-sms-portal'), `data-bx-job-mark="success" data-job="${m.id}" data-cid="${m.campaign_id}"`, 'is-small') : ''}${btn(__('Mark failed', 'bulk-sms-portal'), `data-bx-job-mark="failed" data-job="${m.id}" data-cid="${m.campaign_id}"`, 'is-small is-danger')}</div>` : '';
      return `<details class="bx-item"><summary class="bx-tr" style="--cols:${cols}">
        <span data-label="${esc(__('Date', 'bulk-sms-portal'))}">${esc(m.date)}</span>
        ${customerCell(m)}
        <span class="bx-mono bx-td-lead" data-label="${esc(__('Sent to', 'bulk-sms-portal'))}">${esc(m.recipient)}</span>
        <span class="bx-clip" data-label="${esc(__('Message', 'bulk-sms-portal'))}">${esc(m.message)}</span>
        <span class="bx-td-main" data-label="${esc(__('Result', 'bulk-sms-portal'))}">${pill(RESULT_TONE[m.result] || 'info', m.result_label || '')}${m.detail ? `<small>${esc(m.detail)}</small>` : ''}</span>
        <span class="is-num" data-label="${esc(__('Cost', 'bulk-sms-portal'))}">${cost}</span>
      </summary><div class="bx-item-body">
        <div class="bx-quote">${esc(m.message)}</div>
        <dl class="bx-facts">
          <div><dt>${__('Sender name', 'bulk-sms-portal')}</dt><dd>${esc(m.sender || '—')}</dd></div>
          ${m.message_id ? `<div><dt>${__('Message ID', 'bulk-sms-portal')}</dt><dd><span class="bx-mono bx-break">${esc(m.message_id)}</span> <button type="button" class="bx-link" data-bx-copy-id="${esc(m.message_id)}">${__('Copy', 'bulk-sms-portal')}</button></dd></div>` : ''}
          <div><dt>${__('SMS pages', 'bulk-sms-portal')}</dt><dd>${esc(m.pages)}</dd></div>
          <div><dt>${__('Charged', 'bulk-sms-portal')}</dt><dd>${m.charged_kobo > 0 ? esc(naira(m.charged_kobo)) : __('Nothing', 'bulk-sms-portal')}</dd></div>
          <div><dt>${__('Money returned', 'bulk-sms-portal')}</dt><dd>${m.refunded_kobo > 0 ? esc(naira(m.refunded_kobo)) : '—'}</dd></div>
          <div><dt>${__('Part of', 'bulk-sms-portal')}</dt><dd><button type="button" class="bx-link" data-bx-open-send="${m.campaign_id}">${esc(m.campaign_name || __('This send', 'bulk-sms-portal'))}</button></dd></div>
        </dl>${tech}${acts}
      </div></details>`;
    }).join('')}
    ${pager(r)}</div>`;
  bindPager(list, p => drawMessages(host, ctx, p));
  $$('[data-bx-open-send]', list).forEach(b => b.onclick = () => APP.openReport(b.dataset.bxOpenSend));
  $$('[data-bx-copy-id]', list).forEach(b => b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.bxCopyId); toast(__('Message ID copied.', 'bulk-sms-portal')); } catch (e) { toast(__('Select the ID and copy it.', 'bulk-sms-portal'), 'bad'); } });
  $$('[data-bx-job-sync]', list).forEach(b => b.onclick = async () => {
    const done = busy(b, __('Checking…', 'bulk-sms-portal'));
    const res = await C.api(`/reports/${b.dataset.cid}/jobs/${b.dataset.bxJobSync}/sync`, { method: 'POST', body: '{}' });
    done(); if (!res || !res.ok) toast(friendly(res, __('The result could not be checked.', 'bulk-sms-portal')), 'bad'); else toast(__('Result checked.', 'bulk-sms-portal'));
    drawMessages(host, ctx, REC[key].page);
  });
  $$('[data-bx-job-mark]', list).forEach(b => b.onclick = async () => {
    const s = b.dataset.bxJobMark;
    if (!await confirmBox({ title: s === 'success' ? __('Mark this message as successful?', 'bulk-sms-portal') : __('Mark this message as failed?', 'bulk-sms-portal'), body: s === 'success' ? `<p>${__('Use this when you know the message reached the phone.', 'bulk-sms-portal')}</p>` : `<p>${__('The charge for this message will be returned to the customer’s wallet.', 'bulk-sms-portal')}</p>`, confirm: s === 'success' ? __('Mark delivered', 'bulk-sms-portal') : __('Mark failed', 'bulk-sms-portal'), danger: s !== 'success' })) return;
    const res = await C.api(`/reports/${b.dataset.cid}/jobs/${b.dataset.job}/status`, { method: 'POST', body: JSON.stringify({ status: s }) });
    if (!res || !res.ok) toast(friendly(res, __('The result could not be updated.', 'bulk-sms-portal')), 'bad'); else toast(__('Result updated.', 'bulk-sms-portal'));
    drawMessages(host, ctx, REC[key].page);
  });
}

/* ---- Delivery Reports --------------------------------------------------- */
const REP_LABELS = { successful: __('No failed messages', 'bulk-sms-portal'), failed: __('Has failed messages', 'bulk-sms-portal'), sending: __('Still sending', 'bulk-sms-portal') };
const REP_TONE = { done: 'good', some_failed: 'wait', all_failed: 'bad', sending: 'wait', scheduled: 'info', not_sent: 'info' };
page('reports', 'Delivery Reports', (host, ctx) => { filtersFromHash('reports'); return drawReports(host, ctx, REC.reports.page, true); });
async function drawReports(host, ctx, pg = 1, rebuild = false) {
  const key = 'reports', admin = isAdmin();
  REC[key].page = pg;
  let root = $(':scope > .bx-page', host);
  if (rebuild || !root) {
    root = mount(host, `
      ${pageHead(__('Delivery Reports', 'bulk-sms-portal'), admin ? __('Each time a customer sends SMS: how many messages went out, how many were successful or failed, and what was charged and returned.', 'bulk-sms-portal') : __('Each time you send SMS: how many messages went out, how many were successful or failed, and what you paid after money returned for failed messages.', 'bulk-sms-portal'), btn(icon('download', 18) + __('Download', 'bulk-sms-portal'), 'data-bx-export'))}
      <div data-bx-tiles>${skeleton(2)}</div>
      <div class="bx-section">${filterBar(key, { what: 'sends', placeholder: __('Send name, message or sender name', 'bulk-sms-portal'), adminPlaceholder: __('Send name, message, sender name or customer', 'bulk-sms-portal'), statusLabel: __('Outcome', 'bulk-sms-portal'), statusName: 'status', statuses: [['', __('All sends', 'bulk-sms-portal')], ['successful', __('No failed messages', 'bulk-sms-portal')], ['failed', __('Has failed messages', 'bulk-sms-portal')], ['sending', __('Still sending', 'bulk-sms-portal')]] })}
      <div data-bx-list aria-live="polite">${loading(__('Loading reports…', 'bulk-sms-portal'))}</div>
      <p class="bx-small bx-muted bx-mt-s">${__('Money for failed messages goes back to the wallet automatically. Final cost is what was charged minus what was returned.', 'bulk-sms-portal')}</p></div>`);
    bindFilters(root, key, (p, r) => drawReports(host, ctx, p, r));
    $('[data-bx-export]', root).onclick = e => exportCsv(e.currentTarget, '/records/reports/export', key);
  }
  const list = $('[data-bx-list]', root);
  list.innerHTML = loading(__('Loading reports…', 'bulk-sms-portal'));
  const r = await C.api('/records/reports?' + recQuery(REC[key].f, pg, 20));
  if (!ctx.live()) return;
  if (!r || !r.ok) { list.innerHTML = `<div class="bx-panel">${note('bad', __('We could not load this list', 'bulk-sms-portal'), esc(friendly(r)))}</div>`; return; }
  if (pageBack(r, pg, p => drawReports(host, ctx, p))) return;
  const s = r.summary || {};
  $('[data-bx-tiles]', root).innerHTML = `<div class="bx-stats">
      ${stat(__('Messages sent', 'bulk-sms-portal'), num(s.messages), { note: sprintf(/* translators: %s: a number */ _n('%s send', '%s sends', Number(s.sends), 'bulk-sms-portal'), num(s.sends)) })}
      ${stat(__('Successful', 'bulk-sms-portal'), num(s.successful), { tone: 'good', note: __('No failure reported', 'bulk-sms-portal') })}
      ${stat(__('Failed', 'bulk-sms-portal'), num(s.failed), { tone: Number(s.failed) ? 'bad' : '' })}
      ${stat(__('Still sending', 'bulk-sms-portal'), num(s.sending), { tone: Number(s.sending) ? 'wait' : '' })}
    </div>
    <div class="bx-stats bx-mt-s" aria-label="${esc(__('Money', 'bulk-sms-portal'))}">
      ${stat(__('Charged', 'bulk-sms-portal'), naira(s.charged_kobo))}
      ${stat(__('Returned for failed messages', 'bulk-sms-portal'), naira(s.refunded_kobo))}
      ${stat(__('Final cost', 'bulk-sms-portal'), naira(s.cost_kobo))}
    </div>`;
  $('[data-bx-chips]', root).innerHTML = chipsHtml(key, REP_LABELS);
  bindChips(root, key, (p, rb) => drawReports(host, ctx, p, rb));
  const items = r.items || [];
  if (!items.length) { list.innerHTML = `<div class="bx-list">${empty('chart', __('No sends found', 'bulk-sms-portal'), hasFilters(key) ? __('Try a different search or clear the filters.', 'bulk-sms-portal') : __('Each time you send SMS, it shows here with its results.', 'bulk-sms-portal'))}</div>`; return; }
  const cols = admin ? '2fr 1.2fr 0.7fr 0.8fr 0.7fr 1.1fr 220px' : '2.4fr 0.7fr 0.8fr 0.7fr 1.1fr 220px';
  list.innerHTML = `<div class="bx-list">
    <div class="bx-tr is-head" style="--cols:${cols}"><span>${__('Send', 'bulk-sms-portal')}</span>${admin ? `<span>${__('Customer', 'bulk-sms-portal')}</span>` : ''}<span class="is-num">${__('Messages', 'bulk-sms-portal')}</span><span class="is-num">${__('Successful', 'bulk-sms-portal')}</span><span class="is-num">${__('Failed', 'bulk-sms-portal')}</span><span class="is-num">${__('Final cost', 'bulk-sms-portal')}</span><span></span></div>
    ${items.map(x => `<div class="bx-tr" style="--cols:${cols}">
      <span class="bx-td-main bx-td-lead" data-label="${esc(__('Send', 'bulk-sms-portal'))}"><strong>${esc(x.name || __('Send', 'bulk-sms-portal'))}</strong><small>${esc(x.date || '')}${x.sender ? __(', from ', 'bulk-sms-portal') + esc(x.sender) : ''}</small><span class="bx-row-flex">${pill(REP_TONE[x.state] || 'info', x.state_label || '')}${x.scheduled_for ? `<small>${sprintf(/* translators: %s: a value filled in when shown */ __('Goes out %s', 'bulk-sms-portal'), esc(x.scheduled_for))}</small>` : ''}</span>${bar([{ label: 'delivered', value: x.delivered, tone: 'good' }, { label: __('sent, waiting for confirmation', 'bulk-sms-portal'), value: x.sent, tone: 'info' }, { label: 'failed', value: x.failed, tone: 'bad' }, { label: 'sending', value: x.sending, tone: 'wait' }])}</span>
      ${customerCell(x)}
      <span class="is-num" data-label="${esc(__('Messages', 'bulk-sms-portal'))}"><b>${num(x.messages)}</b>${x.not_sent ? `<small class="bx-muted"> ${sprintf(/* translators: %s: a value filled in when shown */ __('(%s not sent)', 'bulk-sms-portal'), num(x.not_sent))}</small>` : ''}</span>
      <span class="is-num bx-td-main" data-label="${esc(__('Successful', 'bulk-sms-portal'))}">${num(x.successful)}${x.sending ? `<small>${sprintf(/* translators: %s: a value filled in when shown */ __('%s still sending', 'bulk-sms-portal'), num(x.sending))}</small>` : ''}</span>
      <span class="is-num" data-label="${esc(__('Failed', 'bulk-sms-portal'))}">${num(x.failed)}</span>
      <span class="is-num bx-td-main" data-label="${esc(__('Final cost', 'bulk-sms-portal'))}"><b>${esc(naira(x.cost_kobo))}</b>${x.refunded_kobo ? `<small>${sprintf(/* translators: %1$s, %2$s: values filled in when shown */ __('%1$s charged, %2$s returned', 'bulk-sms-portal'), esc(naira(x.charged_kobo)), esc(naira(x.refunded_kobo)))}</small>` : ''}</span>
      <span class="bx-row-flex bx-td-actions">${btn(__('See messages', 'bulk-sms-portal'), `data-bx-see="${x.id}"`, 'is-small')}${x.failed ? btn(__('Only failed', 'bulk-sms-portal'), `data-bx-see-failed="${x.id}"`, 'is-small is-quiet') : ''}${admin && x.sending ? btn(__('Check results again', 'bulk-sms-portal'), `data-bx-sync="${x.id}"`, 'is-small is-quiet') : ''}</span>
    </div>`).join('')}
    ${pager(r)}</div>`;
  bindPager(list, p => drawReports(host, ctx, p));
  $$('[data-bx-see]', list).forEach(b => b.onclick = () => APP.openMessages(b.dataset.bxSee));
  $$('[data-bx-see-failed]', list).forEach(b => b.onclick = () => APP.openMessages(b.dataset.bxSeeFailed, 'failed'));
  $$('[data-bx-sync]', list).forEach(b => b.onclick = async () => {
    const done = busy(b, __('Checking…', 'bulk-sms-portal'));
    const res = await C.api('/reports/' + b.dataset.bxSync + '/sync-pending', { method: 'POST', body: JSON.stringify({ limit: 500 }), timeout: 60000 });
    done(); if (!res || !res.ok) toast(friendly(res, __('Results could not be checked.', 'bulk-sms-portal')), 'bad'); else toast(__('Results checked.', 'bulk-sms-portal'));
    drawReports(host, ctx, REC[key].page);
  });
}

/* ---- Wallet History ----------------------------------------------------- */
const WAL_LABELS = { added: __('Money added', 'bulk-sms-portal'), used: __('Money used', 'bulk-sms-portal'), returned: __('Money returned', 'bulk-sms-portal') };
page('transactions', 'Wallet History', (host, ctx) => drawWallet(host, ctx, REC.wallet.page, true));
async function drawWallet(host, ctx, pg = 1, rebuild = false) {
  const key = 'wallet', admin = isAdmin();
  REC[key].page = pg;
  let root = $(':scope > .bx-page', host);
  if (rebuild || !root) {
    root = mount(host, `
      ${pageHead(__('Wallet History', 'bulk-sms-portal'), admin ? __('Every payment, SMS charge and refund across all customer wallets. SMS charges are grouped per send.', 'bulk-sms-portal') : __('Money you added, money used to send SMS, and money returned for failed messages. SMS charges are grouped per send.', 'bulk-sms-portal'), btn(icon('download', 18) + __('Download', 'bulk-sms-portal'), 'data-bx-export') + (!admin && canUse('buy_sms') ? btn(__('Buy SMS', 'bulk-sms-portal'), 'data-bx-go="fund"', 'is-primary') : ''))}
      <div class="bx-stats" data-bx-tiles>${stat(__('Balance', 'bulk-sms-portal'), '…')}</div>
      <div class="bx-section">${filterBar(key, { what: 'wallet activity', placeholder: __('Reference or send name', 'bulk-sms-portal'), adminPlaceholder: __('Reference, send name or customer', 'bulk-sms-portal'), statusLabel: __('Activity', 'bulk-sms-portal'), statusName: 'type', statuses: [['', __('All activity', 'bulk-sms-portal')], ['added', __('Money added', 'bulk-sms-portal')], ['used', __('Money used', 'bulk-sms-portal')], ['returned', __('Money returned', 'bulk-sms-portal')]] })}
      <div data-bx-list aria-live="polite">${loading(__('Loading wallet activity…', 'bulk-sms-portal'))}</div></div>`);
    bindGo(root);
    bindFilters(root, key, (p, r) => drawWallet(host, ctx, p, r));
    $('[data-bx-export]', root).onclick = e => exportCsv(e.currentTarget, '/records/wallet/export', key);
  }
  const list = $('[data-bx-list]', root);
  list.innerHTML = loading(__('Loading wallet activity…', 'bulk-sms-portal'));
  const r = await C.api('/records/wallet?' + recQuery(REC[key].f, pg, 20));
  if (!ctx.live()) return;
  if (!r || !r.ok) { list.innerHTML = `<div class="bx-panel">${note('bad', __('We could not load this list', 'bulk-sms-portal'), esc(friendly(r)))}</div>`; return; }
  if (pageBack(r, pg, p => drawWallet(host, ctx, p))) return;
  const s = r.summary || {}, t = REC[key].f.type || '';
  $('[data-bx-tiles]', root).innerHTML = (admin ? [
    stat(__('Money added', 'bulk-sms-portal'), naira(s.added_kobo), { filter: 'added', active: t === 'added', tone: 'good' }),
    stat(__('Money used', 'bulk-sms-portal'), naira(s.used_kobo), { filter: 'used', active: t === 'used' }),
    stat(__('Money returned', 'bulk-sms-portal'), naira(s.returned_kobo), { filter: 'returned', active: t === 'returned' }),
    stat(__('SMS income', 'bulk-sms-portal'), naira(s.net_sms_income_kobo), { note: __('Used minus returned', 'bulk-sms-portal') })
  ] : [
    stat(__('Balance now', 'bulk-sms-portal'), naira(s.balance_kobo), { note: __('Available to spend', 'bulk-sms-portal') }),
    stat(__('Money added', 'bulk-sms-portal'), naira(s.added_kobo), { filter: 'added', active: t === 'added', tone: 'good' }),
    stat(__('Money used', 'bulk-sms-portal'), naira(s.used_kobo), { filter: 'used', active: t === 'used' }),
    stat(__('Money returned', 'bulk-sms-portal'), naira(s.returned_kobo), { filter: 'returned', active: t === 'returned', note: __('For failed messages', 'bulk-sms-portal') })
  ]).join('');
  $$('[data-bx-filter-value]', root).forEach(b => b.onclick = () => { REC[key].f = { ...REC[key].f, type: t === b.dataset.bxFilterValue ? '' : b.dataset.bxFilterValue }; drawWallet(host, ctx, 1, true); });
  $('[data-bx-chips]', root).innerHTML = chipsHtml(key, WAL_LABELS);
  bindChips(root, key, (p, rb) => drawWallet(host, ctx, p, rb));
  const items = r.items || [];
  if (!items.length) { list.innerHTML = `<div class="bx-list">${empty('wallet', __('No wallet activity found', 'bulk-sms-portal'), hasFilters(key) ? __('Try a different search or clear the filters.', 'bulk-sms-portal') : __('Payments and SMS charges will show here.', 'bulk-sms-portal'))}</div>`; return; }
  const cols = admin ? '1fr 1.2fr 2fr 1.2fr 1fr' : '1fr 2.2fr 1.4fr 1fr';
  const tone = { added: 'good', used: '', returned: 'wait' };
  list.innerHTML = `<div class="bx-list">
    <div class="bx-tr is-head" style="--cols:${cols}"><span>${__('Date', 'bulk-sms-portal')}</span>${admin ? `<span>${__('Customer', 'bulk-sms-portal')}</span>` : ''}<span>${__('What happened', 'bulk-sms-portal')}</span><span>${__('Reference', 'bulk-sms-portal')}</span><span class="is-num">${__('Amount', 'bulk-sms-portal')}</span></div>
    ${items.map(x => `<div class="bx-tr" style="--cols:${cols}">
      <span data-label="${esc(__('Date', 'bulk-sms-portal'))}">${esc(x.date)}</span>
      ${customerCell(x)}
      <span class="bx-td-main bx-td-lead" data-label="${esc(__('What happened', 'bulk-sms-portal'))}"><strong>${esc(x.title)}</strong>${x.detail ? `<small>${esc(x.detail)}</small>` : ''}</span>
      <span data-label="${esc(__('Reference', 'bulk-sms-portal'))}">${x.campaign_id ? `<button type="button" class="bx-link" data-bx-wallet-send="${esc(x.campaign_id)}">${esc(x.reference)}</button>` : `<span class="bx-mono">${esc(x.reference)}</span>`}</span>
      <strong class="is-num bx-amount${tone[x.kind] ? ' is-' + tone[x.kind] : ''}" data-label="${esc(__('Amount', 'bulk-sms-portal'))}">${esc(naira(x.amount_kobo, { plus: true }))}</strong>
    </div>`).join('')}
    ${pager(r)}</div>`;
  bindPager(list, p => drawWallet(host, ctx, p));
  $$('[data-bx-wallet-send]', list).forEach(b => b.onclick = () => APP.openReport(b.dataset.bxWalletSend));
}


/* ---- 99-start.js ---- */
/* ==========================================================================
   Start
   ========================================================================== */
APP.version = '3.5.0';
APP.ui = { naira, icon, note, pill, empty, toast, confirmBox, friendly };
function start() { shellInit(); paintBalance(); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();


/* ---- Shared with add-ons ---- */
window.BSMS_KIT = Object.assign(window.BSMS_KIT || {}, { __, _n, sprintf, C, CFG, PAGES, APP, esc, $, $$, S, isAdmin, appRoot, naira, nairaWhole, num, plural, balanceKobo, canUse, firstName, parseGmt, fmtDate, greeting, ICONS, icon, pageHead, btn, pill, note, empty, loading, skeleton, pageSkeleton, stat, bar, pageNumbers, pager, bindPager, pageSlice, pageBack, friendly, toast, confirmBox, openDialog, busy, copyText, bindCopy, EMBEDDED, pageUrl, go, hasPage, adminBtn, bindGo, store, downloadFile, prices, MAIN_NETWORKS, phoneDigits, prefixLabel, quoteFrom, priceModel, aboutFor, aboutMessages, RUN, page, mount, PAGE_NAMES, SECTIONS, pageName, shellInit, markPage, paintBalance, renderNotices, adminPage, adSummary, AD_STATUS, FEATURE_WORDS, LIMIT_WORDS, adUsers, customerPicker, walletDialog, tabs, switchRow, fieldHtml, val, goTab, tabFromHash, ADMIN_MORE, ADMIN_AREAS, routeWords, adUsersState, manageUser, adPay, PAY_TONE, SVC_TYPES, NEWBULKSMS_PRESET, showReply, testSend, serviceEditor, NETWORK_CHOICES, pmNaira, pmKobo, adSn, NOTICE_AUDIENCE, NOTICE_KIND, NOTICE_PRIORITY, nameOf, adIn, HC_TYPES, HC_VIS, HC_PAGES, adHc, PS_TABS, PS_FEATURES, adPs, bankRow, bindBankRemove, CHECK_HELP, ACTIVITY_WORDS, toolBack, adAct, DRAFT_KEY, compose, routeChoices, senderOptions, fundState, fundingSetup, amountProblem, FUND_STATUS, SENDER_STATUS, SENDER_OK, book, savedSummary, readFile, numbersDialog, openGroup, ALERTS, PAGE_LINKS, helpState, REC, filtersFromHash, PERIODS, ymd, periodRange, recQuery, filterBar, bindFilters, chipsHtml, bindChips, hasFilters, exportCsv, customerCell, RESULT_TONE, MSG_LABELS, drawMessages, REP_LABELS, REP_TONE, drawReports, WAL_LABELS, drawWallet, start });
})();
