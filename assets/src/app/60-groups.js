/* ==========================================================================
   Phonebook
   ========================================================================== */
const book = { open: null, search: '', page: 1 };

function savedSummary(r, verb = __('Saved', 'bulk-sms-portal')) {
  const parts = [`${verb} ${sprintf(/* translators: %s: a number */ _n('%s number', '%s numbers', Number(r.valid || 0), 'bulk-sms-portal'), num(r.valid || 0))}.`];
  if (Number(r.duplicates)) parts.push(`${sprintf(/* translators: %s: a value filled in when shown */ __('%s already in the group or repeated.', 'bulk-sms-portal'), sprintf(/* translators: %s: a number */ _n('%s number', '%s numbers', Number(r.duplicates), 'bulk-sms-portal'), num(r.duplicates)))}`);
  if (Number(r.invalid)) parts.push(`${sprintf(/* translators: %s: a value filled in when shown */ __('%s could not be used.', 'bulk-sms-portal'), sprintf(/* translators: %s: a number */ _n('%s number', '%s numbers', Number(r.invalid), 'bulk-sms-portal'), num(r.invalid)))}`);
  return parts.join(' ');
}
function readFile(input) {
  return new Promise((resolve, reject) => {
    const f = input && input.files && input.files[0];
    if (!f) return resolve('');
    if (f.size > 2 * 1024 * 1024) return reject(new Error(__('That file is too big. Choose a file under 2 MB.', 'bulk-sms-portal')));
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || ''));
    fr.onerror = () => reject(new Error(__('We could not read that file.', 'bulk-sms-portal')));
    fr.readAsText(f);
  });
}
/* Dialog to add numbers by typing or uploading. mode: 'new' | 'add' | 'replace' */
function numbersDialog({ title, mode, groupName = '', onSave }) {
  openDialog(`<form method="dialog" novalidate><div class="bx-dialog-body"><h2>${esc(title)}</h2>
    ${mode === 'new' ? `<div class="bx-field"><label class="bx-label" for="bx-g-name">${__('Group name', 'bulk-sms-portal')}</label><input id="bx-g-name" class="bx-input" maxlength="80" value="${esc(groupName)}" placeholder="${esc(__('For example: Customers in Lagos', 'bulk-sms-portal'))}"></div>` : ''}
    ${mode === 'replace' ? note('wait', __('This replaces every number in the group', 'bulk-sms-portal'), __('The numbers you add here become the whole group.', 'bulk-sms-portal')) : ''}
    <div class="bx-seg" role="group" aria-label="${esc(__('How to add numbers', 'bulk-sms-portal'))}"><button type="button" data-bx-dm="type" aria-pressed="true">${__('Type numbers', 'bulk-sms-portal')}</button><button type="button" data-bx-dm="file" aria-pressed="false">${__('Upload a file', 'bulk-sms-portal')}</button></div>
    <div class="bx-field" data-bx-dp="type"><label class="bx-label" for="bx-g-numbers">${sprintf(/* translators: %s: a value filled in when shown */ __('Phone numbers%s', 'bulk-sms-portal'), mode === 'new' ? ` <span class="bx-optional">${__('(you can add them later)', 'bulk-sms-portal')}</span>` : '')}</label><textarea id="bx-g-numbers" class="bx-textarea" rows="6" placeholder="08031234567&#10;08051234567"></textarea><span class="bx-hint">${__('One number per line, or separate them with commas.', 'bulk-sms-portal')}</span></div>
    <div class="bx-field" data-bx-dp="file" hidden><label class="bx-file" for="bx-g-file">${icon('upload', 22)}<strong data-bx-g-fname>${__('Choose a CSV or text file', 'bulk-sms-portal')}</strong><span class="bx-hint">${__('Up to 2 MB. We find the phone numbers in it for you.', 'bulk-sms-portal')}</span><input id="bx-g-file" type="file" accept=".csv,.txt,text/csv,text/plain"></label></div>
    <div data-bx-g-msg aria-live="polite"></div>
  </div><div class="bx-dialog-actions"><button class="bx-btn" value="cancel">${__('Cancel', 'bulk-sms-portal')}</button><button class="bx-btn is-primary" data-bx-g-save>${mode === 'new' ? __('Create group', 'bulk-sms-portal') : (mode === 'replace' ? __('Replace numbers', 'bulk-sms-portal') : __('Add numbers', 'bulk-sms-portal'))}</button></div></form>`, d => {
    let m = 'type';
    $$('[data-bx-dm]', d).forEach(b => b.onclick = () => { m = b.dataset.bxDm; $$('[data-bx-dm]', d).forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); $$('[data-bx-dp]', d).forEach(p => p.hidden = p.dataset.bxDp !== m); });
    const file = $('#bx-g-file', d);
    file.onchange = () => { const f = file.files && file.files[0]; $('[data-bx-g-fname]', d).textContent = f ? f.name : __('Choose a CSV or text file', 'bulk-sms-portal'); };
    const first = $('#bx-g-name', d) || $('#bx-g-numbers', d); if (first) first.focus();
    $('[data-bx-g-save]', d).onclick = async (e) => {
      e.preventDefault();
      const msg = $('[data-bx-g-msg]', d); msg.innerHTML = '';
      const name = $('#bx-g-name', d) ? $('#bx-g-name', d).value.trim() : '';
      if (mode === 'new' && !name) { msg.innerHTML = note('bad', __('Give the group a name', 'bulk-sms-portal')); $('#bx-g-name', d).focus(); return; }
      let text = '';
      try { text = m === 'file' ? await readFile(file) : $('#bx-g-numbers', d).value; } catch (err) { msg.innerHTML = note('bad', err.message); return; }
      if (mode !== 'new' && !text.trim()) { msg.innerHTML = note('bad', m === 'file' ? __('Choose a file first', 'bulk-sms-portal') : __('Type at least one number', 'bulk-sms-portal')); return; }
      const done = busy(e.currentTarget, __('Saving…', 'bulk-sms-portal'));
      const r = await onSave({ name, text, viaFile: m === 'file' });
      done();
      if (r && r.ok) { d.close(); } else msg.innerHTML = note('bad', __('Not saved', 'bulk-sms-portal'), esc(friendly(r, __('Please check the numbers and try again.', 'bulk-sms-portal'))));
    };
  });
}

page('groups', 'Phonebook', async (host, ctx) => {
  if (book.open) return openGroup(host, ctx, book.open);
  const root = mount(host, `
    ${pageHead(__('Phonebook', 'bulk-sms-portal'), __('Save groups of phone numbers, like customers, staff or parents, so you can text everyone in a group at once.', 'bulk-sms-portal'), btn(icon('plus', 18) + __('New group', 'bulk-sms-portal'), 'data-bx-new', 'is-primary'))}
    <div data-bx-groups>${skeleton(4)}</div>`);
  $('[data-bx-new]', root).onclick = () => numbersDialog({ title: __('New group', 'bulk-sms-portal'), mode: 'new', onSave: async ({ name, text, viaFile }) => {
    const r = viaFile ? await C.api('/groups/import-csv', { method: 'POST', body: JSON.stringify({ group_name: name, csv: text }) })
                      : await C.api('/groups', { method: 'POST', body: JSON.stringify({ group_name: name, numbers: text }) });
    if (r && r.ok) { toast(text.trim() ? savedSummary(r, __('Group created with', 'bulk-sms-portal')) : __('Group created.', 'bulk-sms-portal')); compose.groups = null; C.show('groups', false); }
    return r;
  } });
  const r = await C.api('/groups');
  if (!ctx.live()) return;
  const box = $('[data-bx-groups]', root);
  if (!r || !r.ok) { box.innerHTML = `<div class="bx-panel">${note('bad', __('We could not load your Phonebook', 'bulk-sms-portal'), esc(friendly(r)))}</div>`; return; }
  const items = r.items || [];
  if (!items.length) { box.innerHTML = `<div class="bx-list">${empty('people', __('No groups yet', 'bulk-sms-portal'), __('Create a group and add phone numbers by typing them or uploading a file.', 'bulk-sms-portal'), btn(icon('plus', 18) + __('New group', 'bulk-sms-portal'), 'data-bx-new2', 'is-primary'))}</div>`; const n2 = $('[data-bx-new2]', box); if (n2) n2.onclick = () => $('[data-bx-new]', root).click(); return; }
  box.innerHTML = `<div class="bx-list">
    <div class="bx-tr is-head" style="--cols:2fr 0.8fr 1fr 230px"><span>${__('Group', 'bulk-sms-portal')}</span><span class="is-num">${__('Numbers', 'bulk-sms-portal')}</span><span>${__('Created', 'bulk-sms-portal')}</span><span></span></div>
    ${items.map(g => `<div class="bx-tr" style="--cols:2fr 0.8fr 1fr 230px">
      <button type="button" class="bx-link bx-td-lead" data-label="${esc(__('Group', 'bulk-sms-portal'))}" data-bx-open="${esc(g.id)}">${esc(g.group_name)}</button>
      <span class="is-num" data-label="${esc(__('Numbers', 'bulk-sms-portal'))}">${num(g.total || 0)}</span>
      <span data-label="${esc(__('Created', 'bulk-sms-portal'))}">${esc(fmtDate(g.created_at, false))}</span>
      <span class="bx-row-flex bx-td-actions">${canUse('compose_sms') && Number(g.total) ? btn(icon('send', 16) + __('Send SMS', 'bulk-sms-portal'), `data-bx-send-group="${esc(g.id)}"`, 'is-small') : ''}${btn(__('Open', 'bulk-sms-portal'), `data-bx-open="${esc(g.id)}"`, 'is-small is-quiet')}</span>
    </div>`).join('')}
  </div>`;
  $$('[data-bx-open]', box).forEach(b => b.onclick = () => { book.open = b.dataset.bxOpen; book.search = ''; book.page = 1; C.show('groups', false); });
  $$('[data-bx-send-group]', box).forEach(b => b.onclick = () => APP.composeWith({ group: b.dataset.bxSendGroup }));
});

async function openGroup(host, ctx, id) {
  const root = mount(host, `<div data-bx-group>${pageSkeleton(__('Phonebook', 'bulk-sms-portal'))}</div>`);
  const r = await C.api('/groups/' + encodeURIComponent(id));
  if (!ctx.live()) return;
  if (!r || !r.ok) { book.open = null; mount(host, `${pageHead(__('Phonebook', 'bulk-sms-portal'), '')}${note('bad', __('We could not open this group', 'bulk-sms-portal'), esc(friendly(r)), btn(__('Back to Phonebook', 'bulk-sms-portal'), 'data-bx-back'))}`); $('[data-bx-back]', host).onclick = () => C.show('groups', false); return; }
  const g = r.group || {}, numbers = r.numbers || [];
  const back = () => { book.open = null; C.show('groups', false); };
  const reopen = () => { compose.groups = null; C.show('groups', false); };
  const draw = () => {
    const q = book.search.replace(/\s+/g, '').toLowerCase();
    const list = q ? numbers.filter(n => String(n.raw_phone || '').includes(q) || String(n.phone_e164 || '').includes(q)) : numbers;
    const per = 50, pages = Math.max(1, Math.ceil(list.length / per));
    book.page = Math.min(book.page, pages);
    const slice = list.slice((book.page - 1) * per, book.page * per);
    root.innerHTML = `
      <button type="button" class="bx-btn is-quiet is-small" data-bx-back>${sprintf(/* translators: %s: a value filled in when shown */ __('%sAll groups', 'bulk-sms-portal'), icon('arrowLeft', 16))}</button>
      ${pageHead(g.group_name || __('Group', 'bulk-sms-portal'), `${sprintf(/* translators: %s: a value filled in when shown */ __('%s in this group.', 'bulk-sms-portal'), sprintf(/* translators: %s: a number */ _n('%s phone number', '%s phone numbers', Number(numbers.length), 'bulk-sms-portal'), num(numbers.length)))}`, (canUse('compose_sms') && numbers.length ? btn(icon('send', 18) + __('Send SMS to this group', 'bulk-sms-portal'), 'data-bx-send', 'is-primary') : '') + btn(icon('plus', 18) + __('Add numbers', 'bulk-sms-portal'), 'data-bx-add'))}
      <div class="bx-list">
        <div class="bx-filters bx-mt-0" role="search">
          <div class="bx-field"><label class="bx-label" for="bx-g-search">${__('Find a number', 'bulk-sms-portal')}</label><input id="bx-g-search" class="bx-input" type="search" inputmode="numeric" value="${esc(book.search)}" placeholder="${esc(__('Type part of a number', 'bulk-sms-portal'))}"></div>
          <div class="bx-filter-actions">${btn(icon('edit', 16) + __('Rename', 'bulk-sms-portal'), 'data-bx-rename', 'is-small')}${btn(icon('upload', 16) + __('Replace all', 'bulk-sms-portal'), 'data-bx-replace', 'is-small')}${btn(icon('trash', 16) + __('Delete group', 'bulk-sms-portal'), 'data-bx-delete', 'is-small is-danger')}</div>
        </div>
        ${slice.length ? `<div class="bx-tr is-head" style="--cols:1.4fr 1fr 64px"><span>${__('Phone number', 'bulk-sms-portal')}</span><span>${__('Added', 'bulk-sms-portal')}</span><span></span></div>
        ${slice.map(n => `<div class="bx-tr" style="--cols:1.4fr 1fr 64px"><span class="bx-mono bx-td-lead" data-label="${esc(__('Phone number', 'bulk-sms-portal'))}">${esc(n.raw_phone || n.phone_e164)}</span><span data-label="${esc(__('Added', 'bulk-sms-portal'))}">${esc(fmtDate(n.created_at, false))}</span><span class="bx-td-actions">${btn(icon('trash', 16) + `<span class="bx-sr">${__('Remove', 'bulk-sms-portal')} ` + esc(n.raw_phone || '') + '</span>', `data-bx-remove="${esc(n.id)}" aria-label="${sprintf(/* translators: %s: a value filled in when shown */ esc(__('Remove %s', 'bulk-sms-portal')), esc(n.raw_phone || n.phone_e164))}"`, 'is-small is-quiet')}</span></div>`).join('')}
        ${pager({ page: book.page, total_pages: pages, total: list.length, per_page: per })}`
        : empty('phone', q ? __('No matching numbers', 'bulk-sms-portal') : __('This group is empty', 'bulk-sms-portal'), q ? __('Try fewer digits.', 'bulk-sms-portal') : __('Add numbers by typing them or uploading a file.', 'bulk-sms-portal'))}
      </div>`;
    $('[data-bx-back]', root).onclick = back;
    const s = $('#bx-g-search', root);
    s.oninput = () => { book.search = s.value; book.page = 1; const pos = s.selectionStart; draw(); const s2 = $('#bx-g-search', root); s2.focus(); try { s2.setSelectionRange(pos, pos); } catch (e) {} };
    bindPager(root, p => { book.page = p; draw(); });
    const send = $('[data-bx-send]', root); if (send) send.onclick = () => APP.composeWith({ group: id });
    $('[data-bx-add]', root).onclick = () => numbersDialog({ title: __('Add numbers to ', 'bulk-sms-portal') + (g.group_name || 'group'), mode: 'add', onSave: async ({ text, viaFile }) => {
      const res = viaFile ? await C.api(`/groups/${id}/append-csv`, { method: 'POST', body: JSON.stringify({ csv: text }) }) : await C.api(`/groups/${id}/numbers`, { method: 'POST', body: JSON.stringify({ numbers: text }) });
      if (res && res.ok) { toast(savedSummary(res, __('Added', 'bulk-sms-portal'))); reopen(); }
      return res;
    } });
    $('[data-bx-replace]', root).onclick = () => numbersDialog({ title: __('Replace all numbers', 'bulk-sms-portal'), mode: 'replace', onSave: async ({ text }) => {
      const res = await C.api(`/groups/${id}/replace`, { method: 'POST', body: JSON.stringify({ numbers: text }) });
      if (res && res.ok) { toast(savedSummary(res, __('The group now has', 'bulk-sms-portal'))); reopen(); }
      return res;
    } });
    $('[data-bx-rename]', root).onclick = () => openDialog(`<form method="dialog"><div class="bx-dialog-body"><h2>${__('Rename group', 'bulk-sms-portal')}</h2><div class="bx-field"><label class="bx-label" for="bx-g-rename">${__('Group name', 'bulk-sms-portal')}</label><input id="bx-g-rename" class="bx-input" maxlength="80" value="${esc(g.group_name || '')}"></div></div><div class="bx-dialog-actions"><button class="bx-btn" value="cancel">${__('Cancel', 'bulk-sms-portal')}</button><button class="bx-btn is-primary" data-bx-ok>${__('Save name', 'bulk-sms-portal')}</button></div></form>`, d => {
      const inp = $('#bx-g-rename', d); inp.focus(); inp.select();
      $('[data-bx-ok]', d).onclick = async (e) => {
        e.preventDefault();
        if (!inp.value.trim()) { inp.setAttribute('aria-invalid', 'true'); return; }
        const done = busy(e.currentTarget, __('Saving…', 'bulk-sms-portal'));
        const res = await C.api(`/groups/${id}/rename`, { method: 'POST', body: JSON.stringify({ group_name: inp.value.trim() }) });
        done();
        if (res && res.ok) { d.close(); toast(__('Group renamed.', 'bulk-sms-portal')); reopen(); } else toast(friendly(res, __('We could not rename the group.', 'bulk-sms-portal')), 'bad');
      };
    });
    $('[data-bx-delete]', root).onclick = async () => {
      if (!await confirmBox({ title: `${sprintf(/* translators: %s: a value filled in when shown */ __('Delete %s?', 'bulk-sms-portal'), g.group_name || __('this group', 'bulk-sms-portal'))}`, body: `<p>${sprintf(/* translators: %s: a value filled in when shown */ __('This removes the group and its %s from your Phonebook. Messages you already sent are not affected.', 'bulk-sms-portal'), sprintf(/* translators: %s: a number */ _n('%s number', '%s numbers', Number(numbers.length), 'bulk-sms-portal'), num(numbers.length)))}</p>`, confirm: __('Delete group', 'bulk-sms-portal'), danger: true })) return;
      const res = await C.api('/groups/' + encodeURIComponent(id), { method: 'DELETE' });
      if (res && res.ok) { toast(__('Group deleted.', 'bulk-sms-portal')); compose.groups = null; back(); } else toast(friendly(res, __('We could not delete the group.', 'bulk-sms-portal')), 'bad');
    };
    $$('[data-bx-remove]', root).forEach(b => b.onclick = async () => {
      const res = await C.api(`/groups/${id}/numbers/${encodeURIComponent(b.dataset.bxRemove)}`, { method: 'DELETE' });
      if (res && res.ok) { const i = numbers.findIndex(n => String(n.id) === b.dataset.bxRemove); if (i >= 0) numbers.splice(i, 1); compose.groups = null; toast(__('Number removed.', 'bulk-sms-portal')); draw(); }
      else toast(friendly(res, __('We could not remove that number.', 'bulk-sms-portal')), 'bad');
    });
  };
  draw();
}
