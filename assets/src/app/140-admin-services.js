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
