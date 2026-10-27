/* ==========================================================================
   Bulk SMS Portal — core runtime (v3.7.0)
   Requests (with a fresh security token), account data, the page router and
   the bridge the pages in assets/portal-app.js use (window.BSMS_CORE).
   Every page is drawn by portal-app.js; the older page renderers, table
   "enhancers" and page watchers that lived here were removed in 3.7.0.
   ========================================================================== */
(function () {
  'use strict';
  const { __, _n, sprintf } = (window.wp && window.wp.i18n) || { __: s => s, _n: (one, many, n) => (n === 1 ? one : many), sprintf: (f, ...a) => { let i = 0; return String(f).replace(/%%|%(\d+)\$[sd]|%[sd]/g, (m, p) => m === '%%' ? '%' : String(p ? a[p - 1] : a[i++])); } };
  const CFG = window.BSMS_PORTAL = window.BSMS_PORTAL || {};
  CFG.root = CFG.root || (window.location.origin + '/wp-json/bsms/v1');
  CFG.nonce = CFG.nonce || ((document.querySelector('meta[name="wp-rest-nonce"]') || {}).content || '');
  CFG.customMenus = Array.isArray(CFG.customMenus) ? CFG.customMenus : [];
  CFG.announcements = Array.isArray(CFG.announcements) ? CFG.announcements : [];

  const $ = (q, el = document) => el.querySelector(q);
  const $$ = (q, el = document) => Array.from(el.querySelectorAll(q));
  const escHtml = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
  const restUrl = (path = '') => String(CFG.root || '').replace(/\/+$/, '') + (path ? '/' + String(path).replace(/^\/+/, '') : '');
  const isPlatformAdmin = () => !!CFG.isAdmin;

  /* ---- Requests ---------------------------------------------------------- */
  let nonceRefresh = null;
  const looksLikeCookieFailure = (data) => {
    const msg = String((data && (data.error || data.message || data.code)) || '').toLowerCase();
    return msg.includes('cookie check failed') || msg.includes('rest_cookie_invalid_nonce') || msg.includes('invalid nonce') || msg.includes('nonce');
  };
  /* Cached pages can carry an old security token, so get a live one first. */
  const refreshNonce = () => {
    if (nonceRefresh) return nonceRefresh;
    const ajaxUrl = CFG.ajaxUrl || (window.location.origin + '/wp-admin/admin-ajax.php');
    nonceRefresh = fetch(ajaxUrl, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: 'action=bsms_refresh_nonce&_=' + encodeURIComponent(Date.now())
    }).then(async r => {
      let data = {}; try { data = await r.json(); } catch (e) {}
      const p = data && (data.data || data);
      if (r.ok && p && p.nonce) { CFG.nonce = p.nonce; if (p.root) CFG.root = p.root; return true; }
      return false;
    }).catch(() => false).finally(() => { nonceRefresh = null; });
    return nonceRefresh;
  };
  const api = (path, opts = {}) => {
    if (!opts._freshNonce) return refreshNonce().then(() => api(path, { ...opts, _freshNonce: true }));
    const run = () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Number(opts.timeout || 12000));
      return fetch(restUrl(path), { credentials: 'same-origin', ...opts, signal: controller.signal, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'X-WP-Nonce': CFG.nonce, ...(opts.headers || {}) } })
        .then(async r => {
          clearTimeout(timer);
          let data = {};
          try { data = await r.json(); } catch (e) { data = { ok: false, error: __('Invalid server response from ', 'bulk-sms-portal') + path }; }
          if (!r.ok && data && !data.error) data.error = data.message || (__('Request failed: ', 'bulk-sms-portal') + r.status);
          if (!r.ok && data && !data.status) data.status = r.status;
          return data;
        })
        .catch(e => { clearTimeout(timer); return { ok: false, error: (e && e.name === 'AbortError') ? __('Request timed out while loading ', 'bulk-sms-portal') + path : (e.message || __('Network error', 'bulk-sms-portal')) }; });
    };
    return run().then(async data => {
      if (data && data.ok === false && looksLikeCookieFailure(data) && !opts._nonceRetried) {
        if (await refreshNonce()) return api(path, { ...opts, _nonceRetried: true });
        return { ok: false, error: __('Your session has ended. Refresh the page and sign in again.', 'bulk-sms-portal') };
      }
      return data;
    });
  };
  const apiPaged = (path, page = 1, perPage = 20) => api(path + (path.includes('?') ? '&' : '?') + 'page=' + encodeURIComponent(page) + '&per_page=' + encodeURIComponent(perPage));

  /* ---- Account data -------------------------------------------------------- */
  const defaultState = () => ({
    ok: true, user: __('User', 'bulk-sms-portal'),
    wallet: { sms_balance_kobo: 0, balance_kobo: 0, bonus_balance_kobo: 0, universal_balance_kobo: 0 },
    units: 0, sent: 0, delivery_rate: 0, recent: [], transactions: [], approved_senders: [], default_sender: 'SMS',
    funding: { currency: 'NGN', minimum_amount: '0', bank_accounts: [], gateways: [] },
    timezone: { name: 'UTC', offset: '+00:00', label: 'UTC (+00:00)' }
  });
  let state = defaultState(), stateLoaded = false, stateLoading = null, stateError = '';
  function load(opts = {}) {
    if (stateLoaded && !opts.force) return Promise.resolve(state);
    if (stateLoading && !opts.force) return stateLoading;
    stateLoading = api('/portal-data', { timeout: 10000 }).then(data => {
      if (data && data.ok !== false) { state = { ...defaultState(), ...data }; stateLoaded = true; stateError = ''; }
      else { state = { ...defaultState(), ...(data || {}), ok: false }; stateError = (data && data.error) || __('Portal data could not load.', 'bulk-sms-portal'); }
      stateLoading = null;
      try { document.dispatchEvent(new CustomEvent('bsms:state', { detail: { state } })); } catch (e) {}
      return state;
    }).catch(e => { state = { ...defaultState(), ok: false }; stateError = (e && e.message) || __('Portal data could not load.', 'bulk-sms-portal'); stateLoading = null; return state; });
    return stateLoading;
  }

  /* SMS length rules. Must match BSMS_Util::sms_metrics(): accented letters bill as Unicode, emoji as 2. */
  function bsmsMessageMetrics(message) {
    const msg = String(message || '');
    if (!msg.length) return { length: 0, units: 0, pages: 0, encoding: 'GSM-7', perPage: 160 };
    const basic = '@£$¥\n\rΔ_ΦΓΛΩΠΨΣΘΞ Ææß!"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZ§¿abcdefghijklmnopqrstuvwxyz';
    const ext = '^{}\\[~]|€';
    let gsm = true, units = 0;
    for (const ch of msg) { if (basic.includes(ch)) units += 1; else if (ext.includes(ch)) units += 2; else { gsm = false; break; } }
    if (gsm) { const pages = units <= 160 ? 1 : Math.ceil(units / 153); return { length: [...msg].length, units, pages, encoding: 'GSM-7', perPage: pages <= 1 ? 160 : 153 }; }
    const len = [...msg].length, u16 = msg.length, pages = u16 <= 70 ? 1 : Math.ceil(u16 / 67);
    return { length: len, units: u16, pages, encoding: __('Unicode', 'bulk-sms-portal'), perPage: pages <= 1 ? 70 : 67 };
  }

  /* ---- Addresses ----------------------------------------------------------- */
  const routeMap = () => CFG.routeMap || {};
  const pageToRoute = page => routeMap()[page] || String(page || 'dashboard').replace(/^custom-/, '').replace(/_/g, '-');
  const ALIASES = {
    'fund-wallet': 'fund', 'phone-groups': 'groups', 'message-history': 'history', 'delivery-reports': 'reports', 'sender-id': 'sender', 'notification-settings': 'settings',
    'api-documentation': 'api', 'api-details': 'api', 'admin-api': 'admin-apis', 'api-manager': 'admin-apis', 'sms-service-setup': 'admin-apis', 'pricing-manager': 'admin-pricing',
    'sender-id-manager': 'admin-senders', 'broadcast-notices': 'admin-broadcast', 'customer-notices': 'admin-broadcast', 'communications-centre': 'admin-broadcast',
    'communication-centre': 'admin-broadcast', 'admin-communications': 'admin-broadcast', 'manage-users': 'admin-users', 'credit-users': 'admin-users', 'admin-credit': 'admin-users',
    'users-wallets': 'admin-users', 'wallet-history': 'transactions'
  };
  const routeToPage = route => {
    route = String(route || '').replace(/^#/, '').replace(/^\//, '').trim();
    const map = routeMap();
    for (const k in map) if (map[k] === route) return k;
    return ALIASES[route] || route || 'dashboard';
  };
  const portalBase = () => String(CFG.portalBase || '').replace(/\/$/, '');
  const pageFromLocation = () => {
    if (CFG.initialPage) return CFG.initialPage;
    const hash = (location.hash || '').replace('#', '').trim();
    if (hash && !hash.includes('=')) return routeToPage(hash);
    const base = portalBase();
    if (base) {
      try {
        const basePath = new URL(base, location.origin).pathname.replace(/\/$/, '');
        const cur = location.pathname.replace(/\/$/, '');
        if (cur.indexOf(basePath + '/') === 0) return routeToPage(decodeURIComponent(cur.slice(basePath.length + 1)));
      } catch (e) {}
    }
    return 'dashboard';
  };
  const urlForPage = page => { const base = portalBase(); return base ? base + '/' + encodeURIComponent(pageToRoute(page)) : '#' + page; };

  /* ---- Pages --------------------------------------------------------------- */
  const failed = () => `<div class="bx bx-page"><div class="bx-note is-bad" role="alert"><div><strong>${__('We could not open this page', 'bulk-sms-portal')}</strong><p>${__('Refresh the page and try again. If this continues, contact support.', 'bulk-sms-portal')}</p></div></div></div>`;
  function show(page, updateHash = true) {
    // An unknown or unavailable page opens the Dashboard.
    if (!$('#bsms-page-' + page)) page = $('#bsms-page-dashboard') ? 'dashboard' : (($$('.bsms-page')[0] || {}).id || '').replace('bsms-page-', '');
    const target = $('#bsms-page-' + page);
    if (!target) return;
    if (updateHash && !CFG.embedded) { const u = urlForPage(page); if (u && location.href !== new URL(u, location.href).href) history.pushState(null, '', u); }
    document.body.setAttribute('data-bsms-page', page);
    $$('.bsms-page').forEach(p => p.classList.toggle('hidden', p !== target));
    const render = window.BSMS_PAGES && window.BSMS_PAGES[page];
    try { document.dispatchEvent(new CustomEvent('bsms:page', { detail: { page, redesigned: typeof render === 'function' } })); } catch (e) {}
    if (typeof render !== 'function') { target.innerHTML = failed(); return; }
    // After moving to another page, screen readers start at its heading.
    const focusHeading = () => { if (!updateHash) return; const h = target.querySelector('h1'); if (h && h.offsetParent) { h.setAttribute('tabindex', '-1'); try { h.focus({ preventScroll: true }); } catch (e) {} } };
    try {
      const result = render(target, page);
      if (result && typeof result.then === 'function') result.then(focusHeading, e => { console.error('Bulk SMS Portal: page error', e); target.innerHTML = failed(); });
      else focusHeading();
    } catch (e) { console.error('Bulk SMS Portal: page error', e); target.innerHTML = failed(); }
    if (!stateLoaded && !stateError && !stateLoading) load().then(() => show(page, false));
  }

  /* Hide other content the theme or page builder placed next to the portal
     (the page title, empty blocks), so the portal fills the page. */
  function isolateHost(app) {
    if (CFG.embedded) return;
    // The widest page container around the portal (the theme's main area).
    let host = null, el = app.parentElement;
    while (el && el !== document.body) { if (el.matches('main, .site-main, article, .entry-content, .wp-block-post-content, .elementor-widget-container, .elementor-shortcode')) host = el; el = el.parentElement; }
    if (!host) return;
    const hide = (container) => {
      Array.from(container.childNodes).forEach(node => {
        if (node === app) return;
        if (node.nodeType === 1 && node.contains(app)) { hide(node); return; }
        if (node.nodeType === 3) { if (String(node.textContent || '').trim()) node.textContent = ''; return; }
        if (node.nodeType === 1 && !/^(script|style|link|noscript|template)$/i.test(node.tagName)) node.hidden = true;
      });
    };
    hide(host);
  }

  function init() {
    const app = $('#bsms-app');
    if (!app) return;
    isolateHost(app);
    if (isPlatformAdmin()) app.classList.add('bsms-is-admin');
    const booting = load({ force: true });
    show(pageFromLocation(), false);
    booting.then(() => {
      show(pageFromLocation(), false);
      if (window.BSMS_APP && typeof window.BSMS_APP.paymentReturn === 'function') window.BSMS_APP.paymentReturn();
    }).catch(e => console.error('Bulk SMS Portal: start error', e));
    window.addEventListener('hashchange', () => { const h = (location.hash || '').replace('#', ''); if (h && !h.includes('=')) show(routeToPage(h), true); });
    window.addEventListener('popstate', () => { if (!CFG.embedded) { CFG.initialPage = ''; show(pageFromLocation(), false); } });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  /* Show or hide a password (sign-in, register and reset pages). */
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-password-toggle]'); if (!b) return;
    e.preventDefault();
    const input = document.getElementById(b.getAttribute('data-password-toggle')); if (!input) return;
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    b.textContent = showing ? (b.dataset.show || __('Show', 'bulk-sms-portal')) : (b.dataset.hide || __('Hide', 'bulk-sms-portal'));
    b.setAttribute('aria-label', showing ? (b.dataset.showLabel || __('Show password', 'bulk-sms-portal')) : (b.dataset.hideLabel || __('Hide password', 'bulk-sms-portal')));
    b.setAttribute('aria-pressed', showing ? 'false' : 'true');
  });

  /* Tell people when the internet connection drops, so they know a save may not go through. */
  const connection = online => {
    const el = document.getElementById('bsms-connection-status'); if (!el) return;
    el.hidden = false;
    el.className = 'bsms-connection-status ' + (online ? 'is-online' : 'is-offline');
    el.textContent = online ? __('You are back online.', 'bulk-sms-portal') : __('You are offline. Changes will not be saved until your connection is back.', 'bulk-sms-portal');
    clearTimeout(connection.t);
    if (online) connection.t = setTimeout(() => { el.hidden = true; }, 2600);
  };
  window.addEventListener('offline', () => connection(false));
  window.addEventListener('online', () => connection(true));

  /* Copy buttons on public pages: <button data-bsms-copy="text">. */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-bsms-copy]'); if (!b) return;
    e.preventDefault();
    const text = b.getAttribute('data-bsms-copy') || '';
    const done = () => { const old = b.textContent; b.textContent = __('Copied', 'bulk-sms-portal'); setTimeout(() => { b.textContent = old || __('Copy', 'bulk-sms-portal'); }, 1200); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done).catch(() => {}); else done();
  });

  /* Bridge for the pages in assets/portal-app.js. */
  window.BSMS_CORE = {
    api, apiPaged, show, load, refreshNonce, restUrl, escHtml, urlForPage, routeToPage, pageFromLocation,
    looksLikeCookieFailure, isAdmin: isPlatformAdmin, metrics: bsmsMessageMetrics,
    state: () => state, loaded: () => stateLoaded, error: () => stateError
  };
})();
