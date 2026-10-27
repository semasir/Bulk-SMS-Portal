/* ==========================================================================
   Sender ID
   ========================================================================== */
const SENDER_STATUS = { approved: ['good', __('Ready to use', 'bulk-sms-portal')], pending: ['wait', __('Waiting for approval', 'bulk-sms-portal')], rejected: ['bad', __('Not approved', 'bulk-sms-portal')] };
const SENDER_OK = /^[A-Za-z0-9 \-._]+$/;

page('sender', 'Sender ID', async (host, ctx) => {
  const root = mount(host, `
    ${pageHead(__('Sender ID', 'bulk-sms-portal'), __('Your sender name is what people see as the sender of your messages, such as your shop, school or church name. Each name is checked before you can use it.', 'bulk-sms-portal'), adminBtn(__('Review customer requests', 'bulk-sms-portal'), 'admin-senders'))}
    <div class="bx-split">
      <section class="bx-panel is-flush" aria-labelledby="bx-sn-list">
        <div class="bx-panel-head"><div><h2 id="bx-sn-list">${__('Your sender names', 'bulk-sms-portal')}</h2><p>${__('Names marked “Ready to use” show on the Send SMS page.', 'bulk-sms-portal')}</p></div></div>
        <div data-bx-senders>${skeleton(4)}</div>
      </section>
      <aside class="bx-aside">
        <section class="bx-panel" aria-labelledby="bx-sn-new">
          <div class="bx-panel-head"><div><h2 id="bx-sn-new">${__('Ask for a new name', 'bulk-sms-portal')}</h2><p>${__('We usually reply within one working day.', 'bulk-sms-portal')}</p></div></div>
          <form class="bx-stack is-tight" data-bx-sender-form novalidate>
            <div class="bx-field">
              <label class="bx-label" for="bx-sn-name">${__('Sender name', 'bulk-sms-portal')}</label>
              <input id="bx-sn-name" class="bx-input" maxlength="11" autocomplete="off" spellcheck="false" placeholder="${esc(__('For example: ADASHOP', 'bulk-sms-portal'))}">
              <span class="bx-hint" data-bx-sn-count>${__('Up to 11 letters or numbers.', 'bulk-sms-portal')}</span>
            </div>
            <div class="bx-field">
              <label class="bx-label" for="bx-sn-sample">${__('A message you plan to send', 'bulk-sms-portal')}</label>
              <textarea id="bx-sn-sample" class="bx-textarea" rows="4" placeholder="${esc(__('Your order is ready for pickup. Thank you for shopping with us.', 'bulk-sms-portal'))}"></textarea>
              <span class="bx-hint">${__('This helps us approve the right name for the right use.', 'bulk-sms-portal')}</span>
            </div>
            <ul class="bx-bullets bx-small bx-muted">
              <li>${__('Use your real business or organisation name.', 'bulk-sms-portal')}</li>
              <li>${__('Letters, numbers, spaces, dots and dashes are fine.', 'bulk-sms-portal')}</li>
              <li>${__('Names that look like a bank, a phone network or a government office are usually not approved.', 'bulk-sms-portal')}</li>
            </ul>
            <button type="submit" class="bx-btn is-primary is-block">${__('Send for approval', 'bulk-sms-portal')}</button>
            <div data-bx-sn-msg aria-live="polite"></div>
          </form>
        </section>
      </aside>
    </div>`);
  bindGo(root);

  const nameEl = $('#bx-sn-name', root), sampleEl = $('#bx-sn-sample', root), count = $('[data-bx-sn-count]', root), msg = $('[data-bx-sn-msg]', root);
  const check = () => {
    const v = nameEl.value.trim();
    let problem = '';
    if (v && !SENDER_OK.test(v)) problem = __('Use only letters, numbers, spaces, dots and dashes.', 'bulk-sms-portal');
    count.textContent = problem || (v ? `${sprintf(/* translators: %s: a value filled in when shown */ __('%s of 11 characters', 'bulk-sms-portal'), v.length)}` : __('Up to 11 letters or numbers.', 'bulk-sms-portal'));
    count.classList.toggle('is-bad', !!problem);
    nameEl.setAttribute('aria-invalid', problem ? 'true' : 'false');
    return problem;
  };
  nameEl.addEventListener('input', check);
  $('[data-bx-sender-form]', root).onsubmit = async (e) => {
    e.preventDefault();
    msg.innerHTML = '';
    const name = nameEl.value.trim().replace(/\s+/g, ' ');
    const problem = check();
    if (!name) { msg.innerHTML = note('bad', __('Type the name you want', 'bulk-sms-portal')); nameEl.focus(); return; }
    if (problem) { nameEl.focus(); return; }
    if (!sampleEl.value.trim()) { msg.innerHTML = note('bad', __('Add a sample message', 'bulk-sms-portal'), __('Show us the kind of message you will send with this name.', 'bulk-sms-portal')); sampleEl.focus(); return; }
    const done = busy($('button[type="submit"]', root), __('Sending…', 'bulk-sms-portal'));
    const r = await C.api('/sender-ids/apply', { method: 'POST', body: JSON.stringify({ sender_id: name, sample_message: sampleEl.value.trim() }) });
    done();
    if (r && r.ok) {
      msg.innerHTML = note('good', __('Request sent', 'bulk-sms-portal'), `${sprintf(/* translators: %s: a value filled in when shown */ __('We will let you know when %s has been checked.', 'bulk-sms-portal'), esc(name))}`);
      nameEl.value = ''; sampleEl.value = ''; check();
      list();
    } else msg.innerHTML = note('bad', __('Not sent', 'bulk-sms-portal'), esc(friendly(r, __('Please try again.', 'bulk-sms-portal'))));
  };

  async function list() {
    const box = $('[data-bx-senders]', root);
    const r = await C.api('/sender-ids');
    if (!ctx.live()) return;
    if (!r || !r.ok) { box.innerHTML = `<div class="bx-empty"><p>${esc(friendly(r, __('We could not load your sender names.', 'bulk-sms-portal')))}</p></div>`; return; }
    const items = r.items || [];
    if (!items.length) {
      box.innerHTML = empty('badge', __('No sender names yet', 'bulk-sms-portal'), r.default_sender ? `${sprintf(/* translators: %s: a value filled in when shown */ __('Until you have your own, your messages show as %s. Ask for your own name using the form.', 'bulk-sms-portal'), r.default_sender)}` : __('Ask for your first name using the form.', 'bulk-sms-portal'));
      return;
    }
    box.innerHTML = `<div class="bx-rows">${items.map(x => {
      const st = SENDER_STATUS[x.status] || ['info', x.status];
      const isDefault = x.status === 'approved' && x.sender_id === r.default_sender;
      return `<div class="bx-line-item">
        <div class="bx-td-main">
          <span class="bx-row-flex"><strong class="bx-figure bx-sender-name">${esc(x.sender_id)}</strong>${pill(st[0], st[1])}${isDefault ? `<span class="bx-small bx-muted">${__('Used first on Send SMS', 'bulk-sms-portal')}</span>` : ''}</span>
          ${x.sample_message ? `<small>${sprintf(/* translators: %s: a value filled in when shown */ __('Sample: “%s”', 'bulk-sms-portal'), esc(x.sample_message))}</small>` : ''}
          <small>${sprintf(/* translators: %1$s, %2$s: values filled in when shown */ __('Asked on %1$s%2$s', 'bulk-sms-portal'), esc(fmtDate(x.created_at, false)), x.status !== 'pending' && x.updated_at && x.updated_at !== x.created_at ? `${sprintf(/* translators: %s: a value filled in when shown */ __(', checked on %s', 'bulk-sms-portal'), esc(fmtDate(x.updated_at, false)))}` : '')}</small>
          ${x.status === 'rejected' && x.reason ? `<small class="bx-hint is-bad">${sprintf(/* translators: %s: a value filled in when shown */ __('Reason: %s', 'bulk-sms-portal'), esc(x.reason))}</small>` : ''}
        </div>
        ${x.status === 'approved' && canUse('compose_sms') ? btn(__('Send with this name', 'bulk-sms-portal'), `data-bx-use-sender="${esc(x.sender_id)}"`, 'is-small') : ''}
      </div>`;
    }).join('')}</div>`;
    $$('[data-bx-use-sender]', box).forEach(b => b.onclick = () => { compose.sender = b.dataset.bxUseSender; go('compose'); });
  }
  list();
});
