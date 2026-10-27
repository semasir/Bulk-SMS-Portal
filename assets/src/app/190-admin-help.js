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
