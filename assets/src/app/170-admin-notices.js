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
