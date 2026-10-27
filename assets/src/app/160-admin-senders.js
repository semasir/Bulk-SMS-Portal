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
