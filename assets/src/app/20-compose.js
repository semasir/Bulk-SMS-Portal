/* ==========================================================================
   Send SMS
   ========================================================================== */
const DRAFT_KEY = 'bsms_compose_draft';
const compose = {
  mode: 'type', numbers: '', group: '', fileText: '', fileName: '',
  message: '', sender: '', route: 'normal', when: 'now', at: '', name: '',
  estimate: null, estimating: false, groups: null, timer: null, seq: 0, polling: null
};
/* Lets other pages open Send SMS with something already chosen. */
APP.composeWith = function (opts = {}) {
  if (opts.group) { compose.mode = 'group'; compose.group = String(opts.group); }
  if (opts.message) compose.message = String(opts.message);
  if (opts.numbers) { compose.mode = 'type'; compose.numbers = String(opts.numbers); }
  go('compose');
};

function routeChoices() {
  const ra = S().route_availability || {};
  return [
    { id: 'normal', title: __('Standard', 'bulk-sms-portal'), text: __('For most messages. Numbers on the Do Not Disturb list may not get it.', 'bulk-sms-portal'), ok: ra.normal !== false },
    { id: 'dnd', title: __('Reach Do Not Disturb numbers', 'bulk-sms-portal'), text: __('For important messages such as codes and alerts. Costs more.', 'bulk-sms-portal'), ok: !!ra.dnd }
  ];
}
function senderOptions() {
  const st = S();
  const approved = Array.isArray(st.approved_senders) ? st.approved_senders : [];
  if (approved.length) return { list: approved, own: true };
  return { list: st.default_sender ? [st.default_sender] : [], own: false };
}
page('compose', 'Send SMS', async (host, ctx) => {
  // Restore a saved draft once per visit, unless something was preset.
  const draft = store.get(DRAFT_KEY, null);
  if (draft && !compose.message && !compose.numbers) {
    compose.message = draft.message || ''; compose.numbers = draft.numbers || ''; compose.name = draft.name || '';
    if (draft.sender) compose.sender = draft.sender;
  }
  const senders = senderOptions();
  if (!senders.list.includes(compose.sender)) compose.sender = (S().default_sender && senders.list.includes(S().default_sender)) ? S().default_sender : (senders.list[0] || '');
  const routes = routeChoices();
  if (!routes.find(r => r.id === compose.route && r.ok)) compose.route = 'normal';
  const canSchedule = canUse('scheduled_sms');
  const canTemplates = canUse('templates');
  const tz = (S().timezone && S().timezone.offset) || '';

  const root = mount(host, `
    ${pageHead(__('Send SMS', 'bulk-sms-portal'), __('Choose who gets it, write your message, and check the cost before it goes.', 'bulk-sms-portal'), canTemplates ? btn(icon('list', 18) + __('Use a saved message', 'bulk-sms-portal'), 'data-bx-templates') : '')}
    <div class="bx-split">
      <div class="bx-panel">
        <section class="bx-step" aria-labelledby="bx-s1">
          <span class="bx-step-num">1</span>
          <div class="bx-step-title"><h2 id="bx-s1">${__('Who should get it?', 'bulk-sms-portal')}</h2><p>${__('Type numbers, pick a Phonebook group, or upload a file.', 'bulk-sms-portal')}</p></div>
          <div class="bx-step-body">
            <div class="bx-seg" role="group" aria-label="${esc(__('How to add numbers', 'bulk-sms-portal'))}">
              <button type="button" data-bx-mode="type">${__('Type numbers', 'bulk-sms-portal')}</button>
              <button type="button" data-bx-mode="group">${__('Phonebook group', 'bulk-sms-portal')}</button>
              <button type="button" data-bx-mode="file">${__('Upload a file', 'bulk-sms-portal')}</button>
            </div>
            <div class="bx-field" data-bx-panel="type">
              <label class="bx-label" for="bx-numbers">${__('Phone numbers', 'bulk-sms-portal')}</label>
              <textarea id="bx-numbers" class="bx-textarea" rows="5" placeholder="08031234567&#10;08051234567" autocomplete="off" spellcheck="false">${esc(compose.numbers)}</textarea>
              <span class="bx-hint">${__('One number per line, or separate them with commas. Nigerian numbers can start with 0 or 234.', 'bulk-sms-portal')}</span>
            </div>
            <div class="bx-field" data-bx-panel="group" hidden>
              <label class="bx-label" for="bx-group">${__('Phonebook group', 'bulk-sms-portal')}</label>
              <select id="bx-group" class="bx-select"><option value="">${__('Loading groups…', 'bulk-sms-portal')}</option></select>
              <span class="bx-hint" data-bx-group-hint>${__('Everyone in the group gets the message.', 'bulk-sms-portal')}</span>
            </div>
            <div class="bx-field" data-bx-panel="file" hidden>
              <label class="bx-file" for="bx-file">${icon('upload', 22)}<strong data-bx-file-name>${compose.fileName ? esc(compose.fileName) : __('Choose a file with phone numbers', 'bulk-sms-portal')}</strong><span class="bx-hint">${__('A spreadsheet saved as CSV, or a text file. Up to 2 MB.', 'bulk-sms-portal')}</span><input id="bx-file" type="file" accept=".csv,.txt,text/csv,text/plain"></label>
            </div>
            <div data-bx-recipients aria-live="polite"></div>
          </div>
        </section>
        <section class="bx-step" aria-labelledby="bx-s2">
          <span class="bx-step-num">2</span>
          <div class="bx-step-title"><h2 id="bx-s2">${__('Write your message', 'bulk-sms-portal')}</h2><p>${__('Keep it short and say who it is from.', 'bulk-sms-portal')}</p></div>
          <div class="bx-step-body">
            <div class="bx-field">
              <label class="bx-label" for="bx-sender">${__('Sender name', 'bulk-sms-portal')}</label>
              ${senders.list.length ? `<select id="bx-sender" class="bx-select">${senders.list.map(s => `<option value="${esc(s)}"${s === compose.sender ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select>` : `<input id="bx-sender" class="bx-input" value="" disabled placeholder="${esc(__('No sender name yet', 'bulk-sms-portal'))}">`}
              <span class="bx-hint">${senders.own ? __('The name people see as the sender.', 'bulk-sms-portal') : `${sprintf(/* translators: %s: a value filled in when shown */ __('You don\'t have your own sender name yet%s.', 'bulk-sms-portal'), senders.list.length ? `${sprintf(/* translators: %s: a value filled in when shown */ __(', so messages will show as %s', 'bulk-sms-portal'), esc(senders.list[0]))}` : '')} <button type="button" class="bx-link" data-bx-go="sender">${__('Ask for your own name', 'bulk-sms-portal')}</button>`}</span>
            </div>
            <div class="bx-field">
              <div class="bx-row-flex is-between"><label class="bx-label" for="bx-message">${__('Message', 'bulk-sms-portal')}</label>${canTemplates ? `<button type="button" class="bx-link bx-small" data-bx-save-template>${__('Save for later', 'bulk-sms-portal')}</button>` : ''}</div>
              <textarea id="bx-message" class="bx-textarea" rows="6" placeholder="${esc(__('Hello! Our weekend sale starts Friday…', 'bulk-sms-portal'))}">${esc(compose.message)}</textarea>
              <div class="bx-meter" data-bx-meter aria-live="polite"></div>
            </div>
            <div data-bx-special></div>
          </div>
        </section>
        <section class="bx-step" aria-labelledby="bx-s3">
          <span class="bx-step-num">3</span>
          <div class="bx-step-title"><h2 id="bx-s3">${__('When and how', 'bulk-sms-portal')}</h2><p>${__('Send now or choose a time.', 'bulk-sms-portal')}</p></div>
          <div class="bx-step-body">
            <div class="bx-seg" role="group" aria-label="${esc(__('When to send', 'bulk-sms-portal'))}">
              <button type="button" data-bx-when="now">${__('Send now', 'bulk-sms-portal')}</button>
              <button type="button" data-bx-when="later" ${canSchedule ? '' : 'disabled'}>${__('Send later', 'bulk-sms-portal')}</button>
            </div>
            ${canSchedule ? '' : `<span class="bx-hint">${__('Sending later is not available on your account.', 'bulk-sms-portal')}</span>`}
            <div class="bx-field" data-bx-later hidden>
              <label class="bx-label" for="bx-at">${__('Date and time', 'bulk-sms-portal')}</label>
              <input id="bx-at" type="datetime-local" class="bx-input" value="${esc(compose.at)}">
              <span class="bx-hint">${sprintf(/* translators: %s: a value filled in when shown */ __('%s You can see it in Delivery Reports until it goes.', 'bulk-sms-portal'), tz ? `${sprintf(/* translators: %s: a value filled in when shown */ __('In your account\'s time zone (UTC%s).', 'bulk-sms-portal'), esc(tz))}` : __('In your account\'s time zone.', 'bulk-sms-portal'))}</span>
            </div>
            <div class="bx-field">
              <span class="bx-label" id="bx-route-label">${__('Delivery', 'bulk-sms-portal')}</span>
              <div class="bx-choices" role="group" aria-labelledby="bx-route-label">
                ${routes.map(r => `<button type="button" class="bx-choice" data-bx-route="${r.id}" aria-pressed="${compose.route === r.id ? 'true' : 'false'}" ${r.ok ? '' : 'disabled aria-disabled="true"'}><strong>${esc(r.title)}</strong><span>${esc(r.ok ? r.text : __('Not available right now.', 'bulk-sms-portal'))}</span></button>`).join('')}
              </div>
            </div>
            <div class="bx-field">
              <label class="bx-label" for="bx-name">${__('Name this send', 'bulk-sms-portal')} <span class="bx-optional">${__('(optional, only you see it)', 'bulk-sms-portal')}</span></label>
              <input id="bx-name" class="bx-input" maxlength="80" value="${esc(compose.name)}" placeholder="${esc(__('For example: Weekend sale reminder', 'bulk-sms-portal'))}">
            </div>
          </div>
        </section>
      </div>
      <aside class="bx-aside" aria-label="${esc(__('Preview and cost', 'bulk-sms-portal'))}">
        <div class="bx-phone" aria-label="${esc(__('How your message will look', 'bulk-sms-portal'))}">
          <div class="bx-phone-screen">
            <div class="bx-phone-top"><span class="bx-phone-avatar" data-bx-avatar>A</span><span class="bx-phone-sender" data-bx-psender></span><span class="bx-phone-sub">${__('Text message', 'bulk-sms-portal')}</span></div>
            <div class="bx-phone-body"><div class="bx-phone-bubble" data-bx-bubble></div><span class="bx-phone-time">${__('Now', 'bulk-sms-portal')}</span></div>
          </div>
        </div>
        <div class="bx-slip" data-bx-slip aria-live="polite"></div>
      </aside>
    </div>`);
  bindGo(root);

  const el = {
    numbers: $('#bx-numbers', root), group: $('#bx-group', root), file: $('#bx-file', root), message: $('#bx-message', root),
    sender: $('#bx-sender', root), at: $('#bx-at', root), name: $('#bx-name', root), slip: $('[data-bx-slip]', root)
  };
  const saveDraft = () => store.set(DRAFT_KEY, { message: compose.message, numbers: compose.numbers, name: compose.name, sender: compose.sender });

  /* --- Recipients ------------------------------------------------------- */
  const setMode = (m) => {
    compose.mode = m;
    $$('[data-bx-mode]', root).forEach(b => b.setAttribute('aria-pressed', b.dataset.bxMode === m ? 'true' : 'false'));
    $$('[data-bx-panel]', root).forEach(p => { p.hidden = p.dataset.bxPanel !== m; });
    if (m === 'group') loadGroups();
    estimateSoon(0);
  };
  $$('[data-bx-mode]', root).forEach(b => b.onclick = () => setMode(b.dataset.bxMode));
  el.numbers.addEventListener('input', () => { compose.numbers = el.numbers.value; saveDraft(); estimateSoon(); });
  el.group.addEventListener('change', () => { compose.group = el.group.value; estimateSoon(0); });
  el.file.addEventListener('change', () => {
    const f = el.file.files && el.file.files[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { toast(__('That file is too big. Choose a file under 2 MB.', 'bulk-sms-portal'), 'bad'); el.file.value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => { compose.fileText = String(reader.result || ''); compose.fileName = f.name; $('[data-bx-file-name]', root).textContent = f.name; estimateSoon(0); };
    reader.onerror = () => toast(__('We could not read that file. Try saving it as CSV and upload again.', 'bulk-sms-portal'), 'bad');
    reader.readAsText(f);
  });
  async function loadGroups() {
    if (!compose.groups) {
      const r = await C.api('/groups');
      compose.groups = (r && r.ok && Array.isArray(r.items)) ? r.items : [];
    }
    if (!ctx.live()) return;
    const gs = compose.groups;
    el.group.innerHTML = gs.length ? `<option value="">${__('Choose a group', 'bulk-sms-portal')}</option>` + gs.map(g => `<option value="${esc(g.id)}"${String(g.id) === String(compose.group) ? ' selected' : ''}>${esc(g.group_name)} (${sprintf(/* translators: %s: a number */ _n('%s number', '%s numbers', Number(g.total || 0), 'bulk-sms-portal'), num(g.total || 0))})</option>`).join('') : `<option value="">${__('You have no groups yet', 'bulk-sms-portal')}</option>`;
    el.group.disabled = !gs.length;
    const hint = $('[data-bx-group-hint]', root);
    if (hint) hint.innerHTML = gs.length ? __('Everyone in the group gets the message.', 'bulk-sms-portal') : `${__('Save numbers in the Phonebook to text them as a group.', 'bulk-sms-portal')} <button type="button" class="bx-link" data-bx-go="groups">${__('Open Phonebook', 'bulk-sms-portal')}</button>`;
    bindGo(hint);
  }

  /* --- Message ---------------------------------------------------------- */
  const paintMessage = () => {
    const text = compose.message;
    const info = C.metrics(text);
    const pages = Math.max(info.pages, 0);
    const per = info.encoding === 'GSM-7' ? (pages <= 1 ? 160 : 153) : (pages <= 1 ? 70 : 67);
    const capacity = Math.max(1, pages) * per;
    const left = Math.max(0, capacity - info.units);
    $('[data-bx-meter]', root).innerHTML = text
      ? `<span><b>${num(info.length)}</b> ${__('characters,', 'bulk-sms-portal')} <b>${sprintf(/* translators: %s: a number */ _n('%s SMS page', '%s SMS pages', Number(pages), 'bulk-sms-portal'), num(pages))}</b></span><span class="${left < 15 ? 'is-warn' : ''}">${sprintf(/* translators: %s: a value filled in when shown */ __('%s characters left on this page', 'bulk-sms-portal'), num(left))}</span>`
      : `<span>${__('Up to 160 characters fit in one SMS page.', 'bulk-sms-portal')}</span>`;
    $('[data-bx-special]', root).innerHTML = info.encoding !== 'GSM-7' && text
      ? note('wait', __('Your message has special characters', 'bulk-sms-portal'), __('Letters like é or ñ, emoji and some symbols mean each SMS page holds 70 characters instead of 160, so this message may cost more. Replace them with plain letters to fit more in each page.', 'bulk-sms-portal'))
      : '';
    const bubble = $('[data-bx-bubble]', root);
    bubble.textContent = text || __('Your message will show here.', 'bulk-sms-portal');
    bubble.classList.toggle('is-empty', !text);
    const sender = compose.sender || __('Sender', 'bulk-sms-portal');
    $('[data-bx-psender]', root).textContent = sender;
    $('[data-bx-avatar]', root).textContent = (sender.trim()[0] || 'A').toUpperCase();
  };
  el.message.addEventListener('input', () => { compose.message = el.message.value; saveDraft(); paintMessage(); estimateSoon(); });
  if (el.sender && el.sender.tagName === 'SELECT') el.sender.addEventListener('change', () => { compose.sender = el.sender.value; saveDraft(); paintMessage(); });

  /* --- When / route / name ---------------------------------------------- */
  const setWhen = (w) => {
    compose.when = (w === 'later' && canSchedule) ? 'later' : 'now';
    $$('[data-bx-when]', root).forEach(b => b.setAttribute('aria-pressed', b.dataset.bxWhen === compose.when ? 'true' : 'false'));
    $('[data-bx-later]', root).hidden = compose.when !== 'later';
    if (compose.when === 'later' && !el.at.value) {
      const d = new Date(Date.now() + 60 * 60 * 1000); d.setMinutes(0, 0, 0);
      const p = n => String(n).padStart(2, '0');
      el.at.value = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
      compose.at = el.at.value;
    }
    paintSlip();
  };
  $$('[data-bx-when]', root).forEach(b => b.onclick = () => setWhen(b.dataset.bxWhen));
  el.at.addEventListener('change', () => { compose.at = el.at.value; paintSlip(); });
  $$('[data-bx-route]', root).forEach(b => b.onclick = () => {
    if (b.disabled) return;
    compose.route = b.dataset.bxRoute;
    $$('[data-bx-route]', root).forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    estimateSoon(0);
  });
  el.name.addEventListener('input', () => { compose.name = el.name.value; saveDraft(); });

  /* --- Saved messages --------------------------------------------------- */
  const tplBtn = $('[data-bx-templates]', root);
  if (tplBtn) tplBtn.onclick = async () => {
    const r = await C.api('/templates');
    const items = (r && r.ok && r.items) || [];
    openDialog(`<div class="bx-dialog-body"><h2>${__('Saved messages', 'bulk-sms-portal')}</h2>${items.length ? `<div class="bx-rows">${items.map(t => `<div class="bx-line-item"><div class="bx-td-main"><strong>${esc(t.title || __('Saved message', 'bulk-sms-portal'))}</strong><small class="bx-clip">${esc(t.body || '')}</small></div><span class="bx-row-flex">${btn(__('Use', 'bulk-sms-portal'), `data-bx-use="${esc(t.id)}"`, 'is-small is-primary')}${btn(__('Delete', 'bulk-sms-portal'), `data-bx-del="${esc(t.id)}"`, 'is-small is-quiet')}</span></div>`).join('')}</div>` : `<p>${__('You have no saved messages yet. Write a message, then choose “Save for later”.', 'bulk-sms-portal')}</p>`}</div><div class="bx-dialog-actions"><button type="button" class="bx-btn" data-bx-close>${__('Close', 'bulk-sms-portal')}</button></div>`, d => {
      $('[data-bx-close]', d).onclick = () => d.close();
      $$('[data-bx-use]', d).forEach(b => b.onclick = () => {
        const t = items.find(x => String(x.id) === b.dataset.bxUse);
        if (t) { compose.message = t.body || ''; el.message.value = compose.message; saveDraft(); paintMessage(); estimateSoon(0); }
        d.close();
      });
      $$('[data-bx-del]', d).forEach(b => b.onclick = async () => {
        const done = busy(b, __('Deleting', 'bulk-sms-portal'));
        const res = await C.api('/templates/' + encodeURIComponent(b.dataset.bxDel), { method: 'DELETE' });
        done();
        if (res && res.ok) { const row = b.closest('.bx-line-item'); if (row) row.remove(); toast(__('Saved message deleted.', 'bulk-sms-portal')); } else toast(friendly(res, __('We could not delete it.', 'bulk-sms-portal')), 'bad');
      });
    });
  };
  const saveTpl = $('[data-bx-save-template]', root);
  if (saveTpl) saveTpl.onclick = () => {
    if (!compose.message.trim()) { toast(__('Write a message first, then save it.', 'bulk-sms-portal'), 'bad'); el.message.focus(); return; }
    openDialog(`<form method="dialog"><div class="bx-dialog-body"><h2>${__('Save this message', 'bulk-sms-portal')}</h2><div class="bx-field"><label class="bx-label" for="bx-tpl-title">${__('Give it a name', 'bulk-sms-portal')}</label><input id="bx-tpl-title" class="bx-input" maxlength="80" required placeholder="${esc(__('For example: Order ready', 'bulk-sms-portal'))}"></div><p class="bx-small bx-muted">${__('You can use it again from “Use a saved message”.', 'bulk-sms-portal')}</p></div><div class="bx-dialog-actions"><button class="bx-btn" value="cancel">${__('Cancel', 'bulk-sms-portal')}</button><button class="bx-btn is-primary" value="ok" data-bx-tpl-save>${__('Save message', 'bulk-sms-portal')}</button></div></form>`, d => {
      const input = $('#bx-tpl-title', d); input.focus();
      $('[data-bx-tpl-save]', d).onclick = async (e) => {
        e.preventDefault();
        const title = input.value.trim();
        if (!title) { input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
        const done = busy(e.currentTarget, __('Saving', 'bulk-sms-portal'));
        const r = await C.api('/templates', { method: 'POST', body: JSON.stringify({ title, body: compose.message, category: 'custom' }) });
        done();
        if (r && r.ok) { d.close(); toast(__('Message saved.', 'bulk-sms-portal')); } else toast(friendly(r, __('We could not save it.', 'bulk-sms-portal')), 'bad');
      };
    });
  };

  /* --- Cost check ------------------------------------------------------- */
  function payload() {
    return {
      message: compose.message,
      numbers: compose.mode === 'type' ? compose.numbers : (compose.mode === 'file' ? compose.fileText : ''),
      csv_numbers: '',
      group_id: compose.mode === 'group' ? compose.group : '',
      route: compose.route
    };
  }
  function hasRecipients() {
    if (compose.mode === 'type') return compose.numbers.trim() !== '';
    if (compose.mode === 'group') return !!compose.group;
    return compose.fileText.trim() !== '';
  }
  function estimateSoon(delay = 450) {
    clearTimeout(compose.timer);
    if (!hasRecipients() || !compose.message.trim()) { compose.estimate = null; compose.estimating = false; paintRecipients(); paintSlip(); return; }
    compose.estimating = true; paintSlip();
    compose.timer = setTimeout(runEstimate, delay);
  }
  async function runEstimate() {
    const mine = ++compose.seq;
    const r = await C.api('/campaign/estimate', { method: 'POST', body: JSON.stringify(payload()) });
    if (mine !== compose.seq || !ctx.live()) return;
    compose.estimating = false;
    compose.estimate = r && r.ok !== false ? r : { ok: false, error: friendly(r, __('We could not work out the cost. Please try again.', 'bulk-sms-portal')) };
    paintRecipients(); paintSlip();
  }
  function paintRecipients() {
    const box = $('[data-bx-recipients]', root);
    const e = compose.estimate;
    if (!e || e.ok === false || !hasRecipients()) { box.innerHTML = ''; return; }
    const bits = [];
    if (Number(e.duplicates)) bits.push(`${sprintf(/* translators: %s: a number */ _n('%s repeated number', '%s repeated numbers', Number(e.duplicates), 'bulk-sms-portal'), num(e.duplicates))} removed`);
    if (Number(e.invalid)) bits.push(`${sprintf(/* translators: %s: a value filled in when shown */ __('%s that can\'t get SMS left out', 'bulk-sms-portal'), sprintf(/* translators: %s: a number */ _n('%s number', '%s numbers', Number(e.invalid), 'bulk-sms-portal'), num(e.invalid)))}`);
    const noSvc = Number(e.no_service || 0), noPrice = Number(e.no_rate || 0) - noSvc;
    if (noSvc) bits.push(`${sprintf(/* translators: %s: a value filled in when shown */ __('%s outside Nigeria left out: sending abroad is not available yet', 'bulk-sms-portal'), sprintf(/* translators: %s: a number */ _n('%s number', '%s numbers', Number(noSvc), 'bulk-sms-portal'), num(noSvc)))}`);
    if (noPrice > 0) bits.push(`${sprintf(/* translators: %1$s, %2$s: values filled in when shown */ __('%1$s left out: we don\'t send to %2$s yet', 'bulk-sms-portal'), sprintf(/* translators: %s: a number */ _n('%s number', '%s numbers', Number(noPrice), 'bulk-sms-portal'), num(noPrice)), noPrice === 1 ? 'that country' : 'those countries')}`);
    box.innerHTML = Number(e.valid)
      ? note((Number(e.invalid) || Number(e.no_rate)) ? 'wait' : (bits.length ? 'info' : 'good'), `${sprintf(/* translators: %s: a value filled in when shown */ __('%s will get this message', 'bulk-sms-portal'), sprintf(/* translators: %s: a number */ _n('%s person', '%s people', Number(e.valid), 'bulk-sms-portal'), num(e.valid)))}`, bits.length ? esc(bits.join('. ') + '.') : '')
      : note('bad', __('No phone numbers we can send to', 'bulk-sms-portal'), __('Check the numbers. Nigerian numbers have 11 digits starting with 0, or 13 digits starting with 234.', 'bulk-sms-portal'));
  }
  function paintSlip() {
    const e = compose.estimate;
    const bal = balanceKobo();
    const later = compose.when === 'later';
    const actionLabel = later ? __('Schedule SMS', 'bulk-sms-portal') : __('Send SMS', 'bulk-sms-portal');
    let rows = '', total = '₦0.00', foot = '', ready = false;
    if (compose.estimating) {
      rows = `<div class="bx-slip-row"><span>${__('Working out the cost…', 'bulk-sms-portal')}</span></div>`;
      total = '…';
    } else if (e && e.ok === false) {
      rows = `<div class="bx-slip-row is-bad"><span>${esc(e.error)}</span></div>`;
    } else if (e) {
      const short = Number(e.shortfall_kobo || 0);
      rows = `
        <div class="bx-slip-row"><span>${__('SMS pages each', 'bulk-sms-portal')}</span><b>${num(e.pages)}</b></div>
        ${(e.lines || []).map(l => `<div class="bx-slip-row"><span>${esc(String(l.label).replace(/^Nigeria · /, ''))}<small>${sprintf(/* translators: %s: a number */ _n('%s person', '%s people', Number(l.people), 'bulk-sms-portal'), num(l.people))} × ${esc(naira(l.unit_kobo))}${Number(e.pages) > 1 ? ' × ' + num(e.pages) : ''}</small></span><b>${esc(naira(l.total_kobo))}</b></div>`).join('') || `<div class="bx-slip-row"><span>${__('People', 'bulk-sms-portal')}</span><b>${num(e.valid)}</b></div>`}
        <div class="bx-slip-row"><span>${__('Wallet now', 'bulk-sms-portal')}</span><b>${esc(naira(e.balance_kobo ?? bal))}</b></div>
        ${Number(e.reserved_kobo) ? `<div class="bx-slip-row"><span>${__('Held for sends waiting to go', 'bulk-sms-portal')}</span><b>${esc(naira(-Math.abs(e.reserved_kobo)))}</b></div>` : ''}
        <div class="bx-slip-row ${short ? 'is-bad' : ''}"><span>${short ? __('You need', 'bulk-sms-portal') : __('Wallet after', 'bulk-sms-portal')}</span><b>${esc(short ? naira(short) + ' more' : naira(e.balance_after_kobo))}</b></div>`;
      total = naira(e.total_kobo);
      ready = !!e.can_send && Number(e.valid) > 0;
      if (short) foot = `${note('bad', __('Not enough money in your wallet', 'bulk-sms-portal'), `${sprintf(/* translators: %s: a value filled in when shown */ __('Add at least %s to send this.', 'bulk-sms-portal'), esc(naira(short)))}`)}${btn(__('Buy SMS', 'bulk-sms-portal'), 'data-bx-go="fund"', 'is-block')}`;
      if (e.sending_ready === false) { ready = false; foot = note('bad', __('Sending is not available right now', 'bulk-sms-portal'), __('Nothing will be sent or charged. Please contact support.', 'bulk-sms-portal')); }
    } else {
      rows = `<div class="bx-slip-row"><span>${hasRecipients() ? __('Write your message to see the cost.', 'bulk-sms-portal') : __('Add phone numbers to see the cost.', 'bulk-sms-portal')}</span></div>`;
    }
    if (later && !compose.at) ready = false;
    el.slip.innerHTML = `
      <div class="bx-slip-title"><span>${__('Cost before you send', 'bulk-sms-portal')}</span>${icon('receipt', 18)}</div>
      <div class="bx-slip-rows">${rows}</div>
      <span class="bx-slip-tear" aria-hidden="true"></span>
      <div class="bx-slip-total"><span>${__('Total', 'bulk-sms-portal')}</span><strong>${esc(total)}</strong></div>
      <div class="bx-slip-foot">
        ${foot}
        <button type="button" class="bx-btn is-primary is-large is-block" data-bx-send ${ready && senders.list.length ? '' : 'disabled'}>${icon('send', 18)}${actionLabel}</button>
        <span class="bx-hint">${__('If a message fails, its charge goes back to your wallet.', 'bulk-sms-portal')}</span>
      </div>`;
    bindGo(el.slip);
    const sendBtn = $('[data-bx-send]', el.slip);
    if (sendBtn) sendBtn.onclick = () => doSend(sendBtn);
  }

  /* --- Send ------------------------------------------------------------- */
  async function doSend(button) {
    const e = compose.estimate;
    if (!e || !e.can_send) return;
    const later = compose.when === 'later';
    if (later) {
      const t = new Date(compose.at);
      if (!compose.at || isNaN(t) || t.getTime() < Date.now() + 60 * 1000) { toast(__('Choose a time in the future.', 'bulk-sms-portal'), 'bad'); el.at.focus(); return; }
    }
    const whenText = later ? `on ${new Date(compose.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}` : 'now';
    const ok = await confirmBox({
      title: later ? `${sprintf(/* translators: %s: a value filled in when shown */ __('Schedule %s?', 'bulk-sms-portal'), sprintf(/* translators: %s: a number */ _n('%s message', '%s messages', Number(e.valid), 'bulk-sms-portal'), num(e.valid)))}` : `${sprintf(/* translators: %s: a value filled in when shown */ __('Send %s now?', 'bulk-sms-portal'), sprintf(/* translators: %s: a number */ _n('%s message', '%s messages', Number(e.valid), 'bulk-sms-portal'), num(e.valid)))}`,
      body: `<dl class="bx-kv"><div><dt>${__('From', 'bulk-sms-portal')}</dt><dd>${esc(compose.sender)}</dd></div><div><dt>To</dt><dd>${sprintf(/* translators: %s: a number */ _n('%s person', '%s people', Number(e.valid), 'bulk-sms-portal'), num(e.valid))}</dd></div><div><dt>${__('When', 'bulk-sms-portal')}</dt><dd>${esc(whenText)}</dd></div><div><dt>${__('Cost', 'bulk-sms-portal')}</dt><dd>${esc(naira(e.total_kobo))}</dd></div></dl><p class="bx-small">${__('The cost is taken from your wallet. Charges for messages that fail come back to you.', 'bulk-sms-portal')}</p>`,
      confirm: later ? __('Schedule SMS', 'bulk-sms-portal') : __('Send SMS', 'bulk-sms-portal')
    });
    if (!ok) return;
    const done = busy(button, later ? __('Scheduling…', 'bulk-sms-portal') : __('Sending…', 'bulk-sms-portal'));
    const body = { ...payload(), sender_id: compose.sender, schedule_at: later ? compose.at : '', name: compose.name.trim() || (later ? __('Scheduled send', 'bulk-sms-portal') : __('Send on ', 'bulk-sms-portal') + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) };
    const r = await C.api('/campaign/send', { method: 'POST', timeout: 30000, body: JSON.stringify(body) });
    done();
    if (!r || r.ok !== true) {
      const msg = friendly(r, __('Your message was not sent and nothing was charged. Please try again.', 'bulk-sms-portal'));
      el.slip.insertAdjacentHTML('afterbegin', note('bad', __('Not sent', 'bulk-sms-portal'), esc(msg)));
      return;
    }
    store.del(DRAFT_KEY);
    const id = Number(r.campaign_id || 0);
    compose.message = ''; compose.numbers = ''; compose.fileText = ''; compose.fileName = ''; compose.name = ''; compose.estimate = null;
    C.load({ force: true });
    showResult(id, later, r, e);
  }

  function showResult(id, later, r, e) {
    const sent = Number(r.recipients || e.valid || 0);
    el.slip.innerHTML = `
      <div class="bx-slip-title"><span data-bx-live-title>${later ? __('Scheduled', 'bulk-sms-portal') : __('Sending', 'bulk-sms-portal')}</span>${icon(later ? 'calendar' : 'send', 18)}</div>
      <div data-bx-live>${later
        ? note('good', __('Your message is scheduled', 'bulk-sms-portal'), `${sprintf(/* translators: %1$s, %2$s: values filled in when shown */ __('%1$s will go %2$s. You can see it in Delivery Reports.', 'bulk-sms-portal'), sprintf(/* translators: %s: a number */ _n('%s message', '%s messages', Number(sent), 'bulk-sms-portal'), num(sent)), esc(new Date(compose.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })))}`)
        : `<div class="bx-slip-rows"><div class="bx-slip-row"><span>${__('Messages', 'bulk-sms-portal')}</span><b>${num(sent)}</b></div></div><p class="bx-small bx-muted">${__('Waiting for the networks to reply. This usually takes under a minute.', 'bulk-sms-portal')}</p>`}</div>
      <span class="bx-slip-tear" aria-hidden="true"></span>
      <div class="bx-slip-foot">
        ${id ? btn(__('See delivery report', 'bulk-sms-portal'), `data-bx-open-report="${id}"`, 'is-block') : ''}
        ${btn(__('Send another message', 'bulk-sms-portal'), 'data-bx-again', 'is-quiet is-block')}
      </div>`;
    const rep = $('[data-bx-open-report]', el.slip); if (rep) rep.onclick = () => APP.openReport(id);
    $('[data-bx-again]', el.slip).onclick = () => { clearInterval(compose.polling); C.show('compose', false); };
    if (later || !id) return;
    let tries = 0;
    clearInterval(compose.polling);
    const tick = async () => {
      tries++;
      const s = await C.api('/campaign/status/' + id, { timeout: 12000 });
      if (!ctx.live()) { clearInterval(compose.polling); return; }
      const live = $('[data-bx-live]', el.slip);
      if (!live || !s || !s.ok) return;
      const sm = s.summary || {};
      const good = Number(sm.success || 0) + Number(sm.sent || 0), bad = Number(sm.failed || 0);
      const waiting = Number(sm.queued || 0) + Number(sm.pending || 0);
      const total = Number(sm.total || (good + bad + waiting));
      const finished = waiting === 0 && ['sent', 'failed', 'partial'].includes(String((s.campaign && s.campaign.status) || '').toLowerCase());
      const title = !finished ? __('Sending…', 'bulk-sms-portal') : (bad === 0 ? __('All messages sent', 'bulk-sms-portal') : (good === 0 ? __('Your messages failed', 'bulk-sms-portal') : __('Some messages failed', 'bulk-sms-portal')));
      live.innerHTML = `
        ${finished ? note(bad === 0 ? 'good' : (good === 0 ? 'bad' : 'wait'), title, bad ? `${sprintf(/* translators: %s: a value filled in when shown */ __('Charges for the %s went back to your wallet.', 'bulk-sms-portal'), sprintf(/* translators: %s: a number */ _n('%s failed message', '%s failed messages', Number(bad), 'bulk-sms-portal'), num(bad)))}` : '') : ''}
        <div class="bx-slip-rows">
          ${bar([{ label: 'successful', value: good, tone: 'good' }, { label: 'failed', value: bad, tone: 'bad' }, { label: 'sending', value: waiting, tone: 'wait' }])}
          <div class="bx-slip-row is-good"><span>${__('Successful', 'bulk-sms-portal')}</span><b>${num(good)}</b></div>
          <div class="bx-slip-row ${bad ? 'is-bad' : ''}"><span>${__('Failed', 'bulk-sms-portal')}</span><b>${num(bad)}</b></div>
          ${waiting ? `<div class="bx-slip-row"><span>${__('Still sending', 'bulk-sms-portal')}</span><b>${num(waiting)}</b></div>` : ''}
          <div class="bx-slip-row"><span>${finished ? __('Final cost', 'bulk-sms-portal') : __('Cost so far', 'bulk-sms-portal')}</span><b>${esc(naira(sm.cost_kobo || 0))}</b></div>
        </div>
        ${!finished ? `<p class="bx-small bx-muted">${sprintf(/* translators: %1$s, %2$s: values filled in when shown */ __('Messages sent so far: %1$s of %2$s.', 'bulk-sms-portal'), num(good + bad), num(total))}</p>` : ''}`;
      if (finished) { const lt = $('[data-bx-live-title]', el.slip); if (lt) lt.textContent = __('Result', 'bulk-sms-portal'); }
      if (finished || tries >= 24) { clearInterval(compose.polling); if (finished) C.load({ force: true }); }
    };
    tick();
    compose.polling = setInterval(tick, 3000);
  }

  // First paint.
  setMode(compose.mode);
  setWhen(compose.when);
  paintMessage();
  paintRecipients();
  paintSlip();
});
