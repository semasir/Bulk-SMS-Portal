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
