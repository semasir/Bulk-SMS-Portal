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
