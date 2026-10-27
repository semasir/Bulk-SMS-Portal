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
