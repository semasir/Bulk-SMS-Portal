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
