/* ==========================================================================
   Notifications, Profile & Security, API
   ========================================================================== */
const ALERTS = [
  ['credit', __('Money added to your wallet', 'bulk-sms-portal'), __('When a payment or top-up reaches your wallet.', 'bulk-sms-portal')],
  ['funding', __('Bank transfer updates', 'bulk-sms-portal'), __('When we approve or decline a transfer you told us about.', 'bulk-sms-portal')],
  ['campaign', __('A send has finished', 'bulk-sms-portal'), __('A short summary when your messages have gone out.', 'bulk-sms-portal')],
  ['low_balance', __('Your balance is running low', 'bulk-sms-portal'), __('A warning before you run out of money for SMS.', 'bulk-sms-portal')],
  ['sender_decision', __('Sender name decisions', 'bulk-sms-portal'), __('When a sender name you asked for is approved or declined.', 'bulk-sms-portal')]
];

page('settings', 'Notifications', async (host, ctx) => {
  const root = mount(host, `
    ${pageHead(__('Notifications', 'bulk-sms-portal'), __('Choose what we tell you about, and whether it comes by email or SMS.', 'bulk-sms-portal'))}
    <div class="bx-split">
      <section class="bx-panel is-flush" aria-labelledby="bx-nt-h"><div class="bx-panel-head"><div><h2 id="bx-nt-h">${__('What to tell you about', 'bulk-sms-portal')}</h2><p>${__('SMS alerts are charged like any other SMS.', 'bulk-sms-portal')}</p></div></div><div data-bx-prefs>${skeleton(5)}</div></section>
      <aside class="bx-aside"><section class="bx-panel" aria-labelledby="bx-nt-more"><div class="bx-panel-head"><div><h2 id="bx-nt-more">${__('Alert details', 'bulk-sms-portal')}</h2></div></div><div data-bx-prefs-side>${skeleton(3)}</div></section></aside>
    </div>
    <section class="bx-section" aria-labelledby="bx-nt-log">
      <div class="bx-section-head"><div><h2 id="bx-nt-log">${__('Recent notifications', 'bulk-sms-portal')}</h2><p>${__('What we sent you lately.', 'bulk-sms-portal')}</p></div></div>
      <div data-bx-log>${loading()}</div>
    </section>`);
  const r = await C.api('/notifications/preferences');
  if (!ctx.live()) return;
  if (!r || !r.ok) { $('[data-bx-prefs]', root).innerHTML = `<div class="bx-empty"><p>${esc(friendly(r, __('We could not load your choices.', 'bulk-sms-portal')))}</p></div>`; $('[data-bx-prefs-side]', root).innerHTML = ''; }
  else {
    const p = r.preferences || {};
    const has = k => Object.prototype.hasOwnProperty.call(p, k);
    $('[data-bx-prefs]', root).innerHTML = `<div class="bx-list is-inset">
      <div class="bx-tr is-head" style="--cols:minmax(0,1fr) 64px 64px"><span>${__('Alert', 'bulk-sms-portal')}</span><span class="is-num">${__('Email', 'bulk-sms-portal')}</span><span class="is-num">SMS</span></div>
      ${ALERTS.map(([k, t, d]) => `<div class="bx-tr" style="--cols:minmax(0,1fr) 64px 64px">
        <span class="bx-td-main bx-td-lead"><strong>${esc(t)}</strong><small>${esc(d)}</small></span>
        <span class="is-num" data-label="${esc(__('Email', 'bulk-sms-portal'))}">${has('email_' + k) ? `<input type="checkbox" class="bx-switch" data-bx-pref="email_${k}" aria-label="${sprintf(/* translators: %s: a value filled in when shown */ esc(__('%s by email', 'bulk-sms-portal')), esc(t))}" ${Number(p['email_' + k]) ? 'checked' : ''}>` : '—'}</span>
        <span class="is-num" data-label="SMS">${has('sms_' + k) ? `<input type="checkbox" class="bx-switch" data-bx-pref="sms_${k}" aria-label="${sprintf(/* translators: %s: a value filled in when shown */ esc(__('%s by SMS', 'bulk-sms-portal')), esc(t))}" ${Number(p['sms_' + k]) ? 'checked' : ''}>` : '—'}</span>
      </div>`).join('')}
      ${has('email_newsletter') ? `<div class="bx-tr" style="--cols:minmax(0,1fr) 64px 64px"><span class="bx-td-main bx-td-lead"><strong>${__('News and offers', 'bulk-sms-portal')}</strong><small>${__('Occasional emails about new features and prices.', 'bulk-sms-portal')}</small></span><span class="is-num" data-label="${esc(__('Email', 'bulk-sms-portal'))}"><input type="checkbox" class="bx-switch" data-bx-pref="email_newsletter" aria-label="${esc(__('News and offers by email', 'bulk-sms-portal'))}" ${Number(p.email_newsletter) ? 'checked' : ''}></span><span class="is-num" data-label="SMS">—</span></div>` : ''}
    </div>`;
    $('[data-bx-prefs-side]', root).innerHTML = `<form class="bx-stack is-tight" data-bx-pref-form novalidate>
      <div class="bx-field"><label class="bx-label" for="bx-nt-phone">${__('Phone number for SMS alerts', 'bulk-sms-portal')}</label><input id="bx-nt-phone" class="bx-input" inputmode="tel" autocomplete="tel" value="${esc(p.phone || '')}" placeholder="08031234567"></div>
      <div class="bx-field"><label class="bx-label" for="bx-nt-low">${__('Warn me when I can send fewer than', 'bulk-sms-portal')}</label><div class="bx-row-flex"><input id="bx-nt-low" class="bx-input is-short" type="number" min="0" inputmode="numeric" value="${esc(p.low_balance_units ?? 10)}"><span>messages</span></div></div>
      <button type="submit" class="bx-btn is-primary is-block">${__('Save choices', 'bulk-sms-portal')}</button>
      <div data-bx-pref-msg aria-live="polite"></div>
    </form>`;
    $('[data-bx-pref-form]', root).onsubmit = async (e) => {
      e.preventDefault();
      const body = {};
      $$('[data-bx-pref]', root).forEach(i => { body[i.dataset.bxPref] = i.checked ? 1 : 0; });
      const phone = $('#bx-nt-phone', root).value.trim();
      const anySms = Object.keys(body).some(k => k.indexOf('sms_') === 0 && body[k]);
      const msg = $('[data-bx-pref-msg]', root);
      if (anySms && !phone) { msg.innerHTML = note('bad', __('Add a phone number', 'bulk-sms-portal'), __('We need a number to send your SMS alerts to.', 'bulk-sms-portal')); $('#bx-nt-phone', root).focus(); return; }
      body.phone = phone;
      body.low_balance_units = Math.max(0, Number($('#bx-nt-low', root).value || 0));
      const done = busy($('button[type="submit"]', root), __('Saving…', 'bulk-sms-portal'));
      const res = await C.api('/notifications/preferences', { method: 'POST', body: JSON.stringify(body) });
      done();
      msg.innerHTML = res && res.ok ? note('good', __('Your choices are saved', 'bulk-sms-portal')) : note('bad', __('Not saved', 'bulk-sms-portal'), esc(friendly(res)));
    };
    // Switches save with the form; remind people to press Save.
    $$('[data-bx-pref]', root).forEach(i => i.addEventListener('change', () => { const m = $('[data-bx-pref-msg]', root); if (m) m.innerHTML = `<p class="bx-hint">${__('Press “Save choices” to keep this change.', 'bulk-sms-portal')}</p>`; }));
  }
  const loadLog = async (pg = 1) => {
    const box = $('[data-bx-log]', root);
    const lr = await C.api('/notifications/logs?page=' + pg + '&per_page=10');
    if (!ctx.live()) return;
    if (!lr || !lr.ok) { box.innerHTML = `<div class="bx-panel">${note('bad', __('We could not load your notifications', 'bulk-sms-portal'), esc(friendly(lr)))}</div>`; return; }
    if (pageBack(lr, pg, loadLog)) return;
    const items = lr.items || [];
    if (!items.length) { box.innerHTML = `<div class="bx-list">${empty('bell', __('Nothing yet', 'bulk-sms-portal'), __('Alerts we send you will be listed here.', 'bulk-sms-portal'))}</div>`; return; }
    box.innerHTML = `<div class="bx-list"><div class="bx-tr is-head" style="--cols:2fr 0.7fr 0.9fr 1fr"><span>${__('Notification', 'bulk-sms-portal')}</span><span>By</span><span>${__('Result', 'bulk-sms-portal')}</span><span>${__('Date', 'bulk-sms-portal')}</span></div>
      ${items.map(x => `<div class="bx-tr" style="--cols:2fr 0.7fr 0.9fr 1fr"><span class="bx-td-main bx-td-lead" data-label="${esc(__('Notification', 'bulk-sms-portal'))}"><strong>${esc(x.subject || __('Notification', 'bulk-sms-portal'))}</strong><small class="bx-clip">${esc(x.message || '')}</small></span><span data-label="By">${String(x.channel).toLowerCase() === 'sms' ? 'SMS' : __('Email', 'bulk-sms-portal')}</span><span data-label="${esc(__('Result', 'bulk-sms-portal'))}">${pill(x.status === 'sent' ? 'good' : (x.status === 'failed' ? 'bad' : 'wait'), x.status === 'sent' ? __('Sent', 'bulk-sms-portal') : (x.status === 'failed' ? __('Not sent', 'bulk-sms-portal') : __('Waiting', 'bulk-sms-portal')))}</span><span data-label="${esc(__('Date', 'bulk-sms-portal'))}">${esc(fmtDate(x.sent_at || x.created_at))}</span></div>`).join('')}
      ${pager({ page: lr.page, total_pages: lr.total_pages, total: lr.total, per_page: lr.per_page })}</div>`;
    bindPager(box, loadLog);
  };
  loadLog(1);
});

/* ---- Profile & Security ------------------------------------------------- */
page('profile', 'Profile & Security', async (host, ctx) => {
  const root = mount(host, `${pageHead(__('Profile & Security', 'bulk-sms-portal'), __('Your contact details and password.', 'bulk-sms-portal'))}<div data-bx-profile>${skeleton(6)}</div>`);
  const r = await C.api('/profile');
  if (!ctx.live()) return;
  const box = $('[data-bx-profile]', root);
  if (!r || !r.ok) { box.innerHTML = note('bad', __('We could not load your profile', 'bulk-sms-portal'), esc(friendly(r))); return; }
  const original = r.email || '';
  const pw = (id, label, auto) => `<div class="bx-field"><label class="bx-label" for="${id}">${esc(label)}</label><div class="bx-row-flex is-nowrap"><input id="${id}" class="bx-input bx-grow" type="password" autocomplete="${auto}"><button type="button" class="bx-btn is-small" data-password-toggle="${id}" aria-label="${esc(__('Show password', 'bulk-sms-portal'))}" aria-pressed="false">${__('Show', 'bulk-sms-portal')}</button></div></div>`;
  box.innerHTML = `<div class="bx-split">
    <div class="bx-stack">
      <section class="bx-panel" aria-labelledby="bx-pf-h">
        <div class="bx-panel-head"><div><h2 id="bx-pf-h">${__('Your details', 'bulk-sms-portal')}</h2><p>${__('We use these to contact you about your account.', 'bulk-sms-portal')}</p></div></div>
        <form class="bx-stack is-tight" data-bx-pf novalidate>
          <div class="bx-fields">
            <div class="bx-field"><label class="bx-label" for="bx-pf-first">${__('First name', 'bulk-sms-portal')}</label><input id="bx-pf-first" class="bx-input" autocomplete="given-name" value="${esc(r.first_name || '')}"></div>
            <div class="bx-field"><label class="bx-label" for="bx-pf-last">${__('Last name', 'bulk-sms-portal')}</label><input id="bx-pf-last" class="bx-input" autocomplete="family-name" value="${esc(r.last_name || '')}"></div>
          </div>
          <div class="bx-field"><label class="bx-label" for="bx-pf-display">${__('Name shown in the portal', 'bulk-sms-portal')}</label><input id="bx-pf-display" class="bx-input" value="${esc(r.display_name || '')}"></div>
          <div class="bx-fields">
            <div class="bx-field"><label class="bx-label" for="bx-pf-email">${__('Email address', 'bulk-sms-portal')}</label><input id="bx-pf-email" class="bx-input" type="email" autocomplete="email" value="${esc(original)}"></div>
            <div class="bx-field"><label class="bx-label" for="bx-pf-phone">${__('Phone number', 'bulk-sms-portal')}</label><input id="bx-pf-phone" class="bx-input" inputmode="tel" autocomplete="tel" value="${esc(r.phone || '')}"></div>
          </div>
          <div data-bx-pf-confirm hidden>${note('info', __('Confirm it is you', 'bulk-sms-portal'), __('To change your email address, enter your current password.', 'bulk-sms-portal'))}${pw('bx-pf-pass', __('Current password', 'bulk-sms-portal'), 'current-password')}</div>
          <div class="bx-row-flex"><button type="submit" class="bx-btn is-primary">${__('Save details', 'bulk-sms-portal')}</button></div>
          <div data-bx-pf-msg aria-live="polite"></div>
        </form>
      </section>
      <section class="bx-panel" aria-labelledby="bx-pw-h">
        <div class="bx-panel-head"><div><h2 id="bx-pw-h">${__('Change password', 'bulk-sms-portal')}</h2><p>${__('Use at least 8 characters. A short sentence is easy to remember and hard to guess.', 'bulk-sms-portal')}</p></div></div>
        <form class="bx-stack is-tight" data-bx-pw novalidate>
          ${pw('bx-pw-current', __('Current password', 'bulk-sms-portal'), 'current-password')}
          ${pw('bx-pw-new', __('New password', 'bulk-sms-portal'), 'new-password')}
          ${pw('bx-pw-confirm', __('Type the new password again', 'bulk-sms-portal'), 'new-password')}
          <div class="bx-row-flex"><button type="submit" class="bx-btn is-primary">${__('Change password', 'bulk-sms-portal')}</button></div>
          <div data-bx-pw-msg aria-live="polite"></div>
        </form>
      </section>
    </div>
    <aside class="bx-aside"><section class="bx-panel" aria-labelledby="bx-ac-h"><div class="bx-panel-head"><div><h2 id="bx-ac-h">${__('Your account', 'bulk-sms-portal')}</h2></div></div>
      <dl class="bx-kv"><div><dt>${__('Username', 'bulk-sms-portal')}</dt><dd>${esc(r.username || '')}</dd></div><div><dt>${__('Member since', 'bulk-sms-portal')}</dt><dd>${esc(fmtDate(r.registered, false))}</dd></div><div><dt>${__('Account type', 'bulk-sms-portal')}</dt><dd>${isAdmin() ? __('Platform admin', 'bulk-sms-portal') : __('Customer', 'bulk-sms-portal')}</dd></div></dl>
    </section></aside>
  </div>`;
  const email = $('#bx-pf-email', box), confirmWrap = $('[data-bx-pf-confirm]', box);
  email.addEventListener('input', () => { confirmWrap.hidden = email.value.trim().toLowerCase() === original.toLowerCase(); });
  $('[data-bx-pf]', box).onsubmit = async (e) => {
    e.preventDefault();
    const msg = $('[data-bx-pf-msg]', box);
    const changing = email.value.trim().toLowerCase() !== original.toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email.value.trim())) { msg.innerHTML = note('bad', __('Check your email address', 'bulk-sms-portal')); email.focus(); return; }
    const body = { first_name: $('#bx-pf-first', box).value.trim(), last_name: $('#bx-pf-last', box).value.trim(), display_name: $('#bx-pf-display', box).value.trim(), email: email.value.trim(), phone: $('#bx-pf-phone', box).value.trim() };
    if (changing) { const p = $('#bx-pf-pass', box).value; if (!p) { msg.innerHTML = note('bad', __('Enter your current password to change your email', 'bulk-sms-portal')); $('#bx-pf-pass', box).focus(); return; } body.current_password = p; }
    const done = busy($('button[type="submit"]', e.target), __('Saving…', 'bulk-sms-portal'));
    const res = await C.api('/profile', { method: 'POST', body: JSON.stringify(body) });
    done();
    if (res && res.ok) { msg.innerHTML = note('good', __('Your details are saved', 'bulk-sms-portal')); confirmWrap.hidden = true; $('#bx-pf-pass', box).value = ''; C.load({ force: true }); }
    else msg.innerHTML = note('bad', __('Not saved', 'bulk-sms-portal'), esc(friendly(res)));
  };
  $('[data-bx-pw]', box).onsubmit = async (e) => {
    e.preventDefault();
    const msg = $('[data-bx-pw-msg]', box);
    const cur = $('#bx-pw-current', box).value, nw = $('#bx-pw-new', box).value, cf = $('#bx-pw-confirm', box).value;
    if (!cur) { msg.innerHTML = note('bad', __('Enter your current password', 'bulk-sms-portal')); return; }
    if (nw.length < 8) { msg.innerHTML = note('bad', __('Your new password needs at least 8 characters', 'bulk-sms-portal')); return; }
    if (nw !== cf) { msg.innerHTML = note('bad', __('The two new passwords are different', 'bulk-sms-portal'), __('Type the same new password in both boxes.', 'bulk-sms-portal')); return; }
    const done = busy($('button[type="submit"]', e.target), __('Changing…', 'bulk-sms-portal'));
    const res = await C.api('/profile/password', { method: 'POST', body: JSON.stringify({ current_password: cur, new_password: nw, confirm_password: cf }) });
    done();
    if (res && res.ok) { msg.innerHTML = note('good', __('Password changed', 'bulk-sms-portal'), __('Use your new password next time you sign in.', 'bulk-sms-portal')); e.target.reset(); }
    else msg.innerHTML = note('bad', __('Password not changed', 'bulk-sms-portal'), esc(friendly(res)));
  };
});

/* ---- API ---------------------------------------------------------------- */
page('api', 'API', async (host, ctx) => {
  const root = mount(host, `${pageHead('API', __('Send SMS from your own website, online shop or software. Share this page with your developer.', 'bulk-sms-portal'))}<div data-bx-api>${skeleton(5)}</div>`);
  const r = await C.api('/api-details');
  if (!ctx.live()) return;
  const box = $('[data-bx-api]', root);
  const support = CFG.supportEmail || '';
  if (!r || !r.ok) {
    box.innerHTML = `<div class="bx-split">
      <section class="bx-panel"><div class="bx-panel-head"><div><h2>${__('Connect your website or app', 'bulk-sms-portal')}</h2><p>${__('With the API, your website or software can send SMS for you, such as order updates, login codes or reminders, using your wallet and sender names.', 'bulk-sms-portal')}</p></div></div>
        ${note('info', __('API access is switched off for your account', 'bulk-sms-portal'), __('Ask us to switch it on. Tell us what you want to connect and roughly how many messages you send.', 'bulk-sms-portal'), support ? `<a class="bx-btn is-primary is-small" href="mailto:${esc(support)}?subject=${encodeURIComponent('Please turn on API access')}">${sprintf(/* translators: %1$s, %2$s: values filled in when shown */ __('%1$sEmail %2$s', 'bulk-sms-portal'), icon('mail', 16), esc(support))}</a>` : btn(__('Contact support', 'bulk-sms-portal'), 'data-bx-go="help"', 'is-small'))}
      </section>
      <aside class="bx-aside"><section class="bx-panel"><h2>${__('What you will need', 'bulk-sms-portal')}</h2><ul class="bx-stack is-tight bx-mt-s">
        <li class="bx-row-flex is-nowrap">${icon('badge', 18)}<span>${__('An approved sender name', 'bulk-sms-portal')}</span></li>
        <li class="bx-row-flex is-nowrap">${icon('wallet', 18)}<span>${__('Money in your wallet', 'bulk-sms-portal')}</span></li>
        <li class="bx-row-flex is-nowrap">${icon('key', 18)}<span>${__('An API key, which you create here once API access is on', 'bulk-sms-portal')}</span></li>
      </ul></section></aside>
    </div>`;
    bindGo(box);
    return;
  }
  const codes = r.response_codes || {};
  const examples = {
    send: `curl -H 'Authorization: Bearer YOUR_API_KEY' -X POST '${r.send_url}' \\
  --data-urlencode 'sender=YOUR_SENDER_NAME' \\
  --data-urlencode 'recipients=234XXXXXXXXXX' \\
  --data-urlencode 'message=YOUR_MESSAGE'`,
    balance: `curl -H 'Authorization: Bearer YOUR_API_KEY' '${r.balance_url}'`,
    status: `curl -H 'Authorization: Bearer YOUR_API_KEY' '${r.status_url}?messageid=MSG123'`
  };
  const exLabels = { send: __('Send SMS', 'bulk-sms-portal'), balance: __('Check balance', 'bulk-sms-portal'), status: __('Check a message', 'bulk-sms-portal') };
  box.innerHTML = `<div class="bx-stack">
    <section class="bx-panel" aria-labelledby="bx-api-how">
      <div class="bx-panel-head"><div><h2 id="bx-api-how">${__('How it works', 'bulk-sms-portal')}</h2><p>${__('Your website or app sends SMS through your account, using your wallet and your approved sender names.', 'bulk-sms-portal')}</p></div></div>
      <ol class="bx-checklist">
        <li><span class="bx-tick bx-tick-num">1</span><div><span class="bx-check-title">${__('Create an API key below', 'bulk-sms-portal')}</span><p class="bx-small bx-muted">${__('Make one for each website or app, so you can switch one off without affecting the others.', 'bulk-sms-portal')}</p></div></li>
        <li><span class="bx-tick bx-tick-num">2</span><div><span class="bx-check-title">${__('Give the key to your developer', 'bulk-sms-portal')}</span><p class="bx-small bx-muted">${__('Keep it private like a password. It must never appear in the code of a public web page.', 'bulk-sms-portal')}</p></div></li>
        <li><span class="bx-tick bx-tick-num">3</span><div><span class="bx-check-title">${__('Their software sends it with each request', 'bulk-sms-portal')}</span><p class="bx-small bx-muted">${__('In the Authorization header, over https. The examples below are ready to copy.', 'bulk-sms-portal')}</p></div></li>
      </ol>
    </section>
    <section class="bx-panel is-flush" aria-labelledby="bx-keys-h">
      <div class="bx-panel-head"><div><h2 id="bx-keys-h">${__('Your API keys', 'bulk-sms-portal')}</h2><p>${__('Switching a key off stops that website or app at once. Your portal password is not affected.', 'bulk-sms-portal')}</p></div></div>
      <div class="bx-filters bx-mt-0">
        <div class="bx-field"><label class="bx-label" for="bx-key-name">${__('Name for the new key', 'bulk-sms-portal')}</label><input id="bx-key-name" class="bx-input" maxlength="60" placeholder="${esc(__('For example: Online shop', 'bulk-sms-portal'))}"></div>
        <div class="bx-filter-actions"><button type="button" class="bx-btn is-primary" data-bx-key-new>${sprintf(/* translators: %s: a value filled in when shown */ __('%sCreate key', 'bulk-sms-portal'), icon('key', 18))}</button></div>
      </div>
      <div data-bx-key-secret></div>
      <div data-bx-keys>${loading()}</div>
    </section>
    <section class="bx-panel" aria-labelledby="bx-ex-h">
      <div class="bx-panel-head"><div><h2 id="bx-ex-h">${__('Examples for your developer', 'bulk-sms-portal')}</h2><p>${__('Replace the words in capitals. A successful send returns a message ID; use it to check the result.', 'bulk-sms-portal')}</p></div></div>
      ${tabs(Object.keys(examples).map(k => [k, exLabels[k]]), 'send', 'data-bx-ex')}
      ${Object.keys(examples).map(k => `<div class="bx-stack is-tight bx-mt-m" data-bx-ex-pane="${k}" ${k === 'send' ? '' : 'hidden'}><pre class="bx-code">${esc(examples[k])}</pre><div>${btn(icon('copy', 16) + __('Copy example', 'bulk-sms-portal'), `data-bx-copy="${esc(examples[k])}"`, 'is-small')}</div></div>`).join('')}
      <dl class="bx-kv bx-mt-m">
        ${[[__('Send SMS', 'bulk-sms-portal'), r.send_url], [__('Check balance', 'bulk-sms-portal'), r.balance_url], [__('Check a message', 'bulk-sms-portal'), r.status_url]].filter(x => x[1]).map(([t, u]) => `<div><dt>${esc(t)}</dt><dd class="bx-mono">${esc(u)}</dd></div>`).join('')}
      </dl>
    </section>
    ${Object.keys(codes).length ? `<section class="bx-panel is-flush" aria-labelledby="bx-codes-h"><div class="bx-panel-head"><div><h2 id="bx-codes-h">${__('Reply codes', 'bulk-sms-portal')}</h2><p>${__('Every reply includes one of these codes, so your developer knows what happened.', 'bulk-sms-portal')}</p></div></div>
      <div class="bx-list is-inset">${Object.entries(codes).map(([c, t]) => `<div class="bx-tr" style="--cols:120px minmax(0,1fr)"><code class="bx-td-lead">${esc(c)}</code><span>${esc(t)}</span></div>`).join('')}</div></section>` : ''}
    <details class="bx-panel bx-qa-panel"><summary><strong>${__('Older connections that use your portal password', 'bulk-sms-portal')}</strong></summary>
      <div class="bx-stack is-tight bx-mt-m">
        <p>${__('Websites set up before API keys can still sign in with your username', 'bulk-sms-portal')} <b>${esc(r.username || '')}</b> ${__('and your portal password, sent in the Authorization header (Basic) over https. This keeps working, but we recommend moving to an API key:', 'bulk-sms-portal')}</p>
        <ul class="bx-bullets bx-small"><li>${__('anyone with your password can also sign in to your portal and spend your wallet;', 'bulk-sms-portal')}</li><li>${__('changing your portal password stops those websites until they are updated;', 'bulk-sms-portal')}</li><li>${__('a password written into a web address can end up in server logs.', 'bulk-sms-portal')}</li></ul>
      </div>
    </details>
  </div>`;
  $$('[data-bx-ex]', box).forEach(b => b.onclick = () => { $$('[data-bx-ex]', box).forEach(x => x.setAttribute('aria-selected', x === b ? 'true' : 'false')); $$('[data-bx-ex-pane]', box).forEach(p => p.hidden = p.dataset.bxExPane !== b.dataset.bxEx); });
  bindCopy(box);
  const loadKeys = async () => {
    const kb = $('[data-bx-keys]', box);
    const kr = await C.api('/api-keys');
    if (!ctx.live()) return;
    if (!kr || !kr.ok) { kb.innerHTML = `<div class="bx-empty"><p>${esc(friendly(kr, __('We could not load your keys.', 'bulk-sms-portal')))}</p></div>`; return; }
    const items = kr.items || [];
    kb.innerHTML = items.length ? `<div class="bx-list is-inset is-top">
      <div class="bx-tr is-head" style="--cols:1.4fr 1fr 1fr 1fr 120px"><span>${__('Key', 'bulk-sms-portal')}</span><span>${__('Starts with', 'bulk-sms-portal')}</span><span>${__('Created', 'bulk-sms-portal')}</span><span>${__('Last used', 'bulk-sms-portal')}</span><span></span></div>
      ${items.map(k => { const on = String(k.status || 'active') === 'active'; return `<div class="bx-tr" style="--cols:1.4fr 1fr 1fr 1fr 120px"><span class="bx-td-main bx-td-lead"><strong>${esc(k.key_name || __('API key', 'bulk-sms-portal'))}</strong>${pill(on ? 'good' : 'bad', on ? __('Working', 'bulk-sms-portal') : __('Switched off', 'bulk-sms-portal'))}</span><span class="bx-mono" data-label="${esc(__('Starts with', 'bulk-sms-portal'))}">${esc(k.key_prefix || '')}…</span><span data-label="${esc(__('Created', 'bulk-sms-portal'))}">${esc(fmtDate(k.created_at, false))}</span><span data-label="${esc(__('Last used', 'bulk-sms-portal'))}">${k.last_used_at ? esc(fmtDate(k.last_used_at)) : __('Not used yet', 'bulk-sms-portal')}</span><span class="bx-td-actions">${on ? btn(__('Switch off', 'bulk-sms-portal'), `data-bx-revoke="${esc(k.id)}" data-name="${esc(k.key_name || __('this key', 'bulk-sms-portal'))}"`, 'is-small is-danger') : ''}</span></div>`; }).join('')}</div>`
      : empty('key', __('No keys yet', 'bulk-sms-portal'), __('Create a key and give it to your developer.', 'bulk-sms-portal'));
    $$('[data-bx-revoke]', kb).forEach(b => b.onclick = async () => {
      if (!await confirmBox({ title: `${sprintf(/* translators: %s: a value filled in when shown */ __('Switch off %s?', 'bulk-sms-portal'), b.dataset.name)}`, body: `<p>${__('Any website or app using this key will stop sending straight away. This cannot be undone; you can create a new key instead.', 'bulk-sms-portal')}</p>`, confirm: __('Switch off key', 'bulk-sms-portal'), danger: true })) return;
      const res = await C.api('/api-keys/' + encodeURIComponent(b.dataset.bxRevoke) + '/revoke', { method: 'POST', body: '{}' });
      if (res && res.ok) { const sec = $('[data-bx-key-secret]', box); if (sec) sec.innerHTML = ''; toast(__('Key switched off.', 'bulk-sms-portal')); loadKeys(); } else toast(friendly(res, __('We could not switch off that key.', 'bulk-sms-portal')), 'bad');
    });
  };
  $('[data-bx-key-new]', box).onclick = async (e) => {
    const name = $('#bx-key-name', box).value.trim() || __('API key', 'bulk-sms-portal');
    const done = busy(e.currentTarget, __('Creating…', 'bulk-sms-portal'));
    const res = await C.api('/api-keys', { method: 'POST', body: JSON.stringify({ key_name: name }) });
    done();
    const sec = $('[data-bx-key-secret]', box);
    if (res && res.ok && res.api_key) {
      sec.innerHTML = `<div class="bx-item-body bx-mt-0">${note('wait', __('Copy this key now', 'bulk-sms-portal'), __('For your safety we only show it once. Keep it private, like a password.', 'bulk-sms-portal'))}<div class="bx-copy"><span class="bx-mono">${esc(res.api_key)}</span><button type="button" class="bx-btn is-small is-primary" data-bx-copy="${esc(res.api_key)}">${sprintf(/* translators: %s: a value filled in when shown */ __('%sCopy key', 'bulk-sms-portal'), icon('copy', 16))}</button></div></div>`;
      bindCopy(sec); $('#bx-key-name', box).value = ''; loadKeys();
    } else sec.innerHTML = `<div class="bx-item-body">${note('bad', __('Key not created', 'bulk-sms-portal'), esc(friendly(res)))}</div>`;
  };
  loadKeys();
});
