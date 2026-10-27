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
