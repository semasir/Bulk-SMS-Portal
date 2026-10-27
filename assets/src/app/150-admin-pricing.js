/* ==========================================================================
   Pricing Manager (v3.6.2)
   One price list. A number is charged the price of the longest matching
   prefix (a special price, then its network), otherwise its country's price.
   No quantity bands. Countries not in the list are not sent and not charged.
   The page edits a draft of the whole list and saves it in one go.
   ========================================================================== */
const NETWORK_CHOICES = ['MTN', __('Airtel', 'bulk-sms-portal'), __('Glo', 'bulk-sms-portal'), '9mobile'];
const pmNaira = k => (Number(k) ? (Number(k) / 100).toString() : '');
const pmKobo = v => { const n = Number(String(v || '').replace(/[,₦\s]/g, '')); return n > 0 ? Math.round(n * 100) : 0; };

adminPage('admin-pricing', 'Pricing Manager', async (host, ctx) => {
  const root = mount(host, `
    ${pageHead(__('Pricing Manager', 'bulk-sms-portal'), __('Customers pay into a wallet, and every SMS page they send is charged the price of the network it goes to. The price is the same for any size of send. A country that is not in this list is not sent to and not charged.', 'bulk-sms-portal'), btn(__('See what customers see', 'bulk-sms-portal'), 'data-bx-go="pricing"', 'is-quiet'))}
    <div data-bx-pm>${skeleton(8)}</div>`);
  bindGo(root);
  const r = await C.api('/admin/price-list');
  if (!ctx.live()) return;
  const box = $('[data-bx-pm]', root);
  if (!r || !r.ok) { box.innerHTML = note('bad', __('We could not load prices', 'bulk-sms-portal'), esc(friendly(r))); return; }

  const names = r.country_names || {};
  const nameOf = cc => names[String(cc)] || ('+' + cc);
  const known = r.nigeria_networks || {};
  let notes = r.notes || [];
  let saved = JSON.stringify(r.list);
  let draft = JSON.parse(saved);
  const ng = () => draft.find(c => String(c.code) === '234');
  const dirty = () => JSON.stringify(draft) !== saved;

  function money(k, empty = '—') { return Number(k) ? esc(naira(k)) : `<span class="bx-muted">${empty}</span>`; }
  function prefixList(cc, list, max = 8) {
    const l = (list || []).map(p => prefixLabel(cc, p));
    return esc(l.slice(0, max).join(', ') + (l.length > max ? ` ${sprintf(/* translators: %s: a value filled in when shown */ __('and %s more', 'bulk-sms-portal'), l.length - max)}` : ''));
  }

  function draw() {
    const n = ng();
    const others = draft.filter(c => String(c.code) !== '234');
    const nets = [...(n.networks || [])].sort((a, b) => (NETWORK_CHOICES.indexOf(a.name) + 1 || 99) - (NETWORK_CHOICES.indexOf(b.name) + 1 || 99));
    const cols = '1.6fr 0.9fr 0.9fr 150px';
    box.innerHTML = `
      ${notes.length ? note('info', __('Your prices were moved to the new rule', 'bulk-sms-portal'), notes.map(x => esc(x)).join('<br>') + `<br><span class="bx-small bx-muted">${__('This note goes away the next time you save prices.', 'bulk-sms-portal')}</span>`) : ''}
      <div class="bx-savebar" data-bx-pm-bar ${dirty() ? '' : 'hidden'}><span>${sprintf(/* translators: %s: a value filled in when shown */ __('%sYou have changes that are not saved yet.', 'bulk-sms-portal'), icon('alert', 18))}</span><span class="bx-row-flex">${btn(__('Undo changes', 'bulk-sms-portal'), 'data-bx-pm-undo', 'is-small is-quiet')}${btn(__('Save prices', 'bulk-sms-portal'), 'data-bx-pm-save', 'is-small is-primary')}</span></div>

      <section class="bx-section" aria-labelledby="bx-pm-ng">
        <div class="bx-section-head"><div><h2 id="bx-pm-ng">${__('Nigeria', 'bulk-sms-portal')}</h2><p>${__('Each network can have its own price. A number on a network with no price of its own is charged the Nigeria price.', 'bulk-sms-portal')}</p></div>${btn(icon('plus', 16) + __('Add a network', 'bulk-sms-portal'), 'data-bx-pm-net-add', 'is-small is-primary')}</div>
        <div class="bx-list">
          <div class="bx-tr is-head" style="--cols:${cols}"><span>${__('Who it applies to', 'bulk-sms-portal')}</span><span class="is-num">${__('Standard', 'bulk-sms-portal')}</span><span class="is-num">${__('Do Not Disturb', 'bulk-sms-portal')}</span><span></span></div>
          <div class="bx-tr is-key" style="--cols:${cols}"><span class="bx-td-main bx-td-lead" data-label="${esc(__('Who it applies to', 'bulk-sms-portal'))}"><strong>${__('Nigeria price', 'bulk-sms-portal')}</strong><small>${__('Any Nigerian number whose network has no price of its own', 'bulk-sms-portal')}</small></span><span class="is-num" data-label="${esc(__('Standard', 'bulk-sms-portal'))}"><b>${money(n.standard_kobo, __('Not set', 'bulk-sms-portal'))}</b></span><span class="is-num" data-label="${esc(__('Do Not Disturb', 'bulk-sms-portal'))}">${money(n.dnd_kobo, __('Not offered', 'bulk-sms-portal'))}</span><span class="bx-td-actions">${btn(__('Change', 'bulk-sms-portal'), 'data-bx-pm-ng', 'is-small')}</span></div>
          ${nets.map(x => `<div class="bx-tr" style="--cols:${cols}"><span class="bx-td-main bx-td-lead" data-label="${esc(__('Who it applies to', 'bulk-sms-portal'))}"><strong>${esc(x.name)}</strong><small>${prefixList('234', x.prefixes)}</small></span><span class="is-num" data-label="${esc(__('Standard', 'bulk-sms-portal'))}">${money(x.standard_kobo, __('Nigeria price', 'bulk-sms-portal'))}</span><span class="is-num" data-label="${esc(__('Do Not Disturb', 'bulk-sms-portal'))}">${money(x.dnd_kobo, n.dnd_kobo ? __('Nigeria price', 'bulk-sms-portal') : __('Not offered', 'bulk-sms-portal'))}</span><span class="bx-row-flex bx-td-actions">${btn(__('Edit', 'bulk-sms-portal'), `data-bx-pm-net="${esc(x.name)}"`, 'is-small')}${btn(icon('trash', 16) + `<span class="bx-sr">${__('Remove', 'bulk-sms-portal')}</span>`, `data-bx-pm-net-del="${esc(x.name)}" aria-label="${sprintf(/* translators: %s: a value filled in when shown */ esc(__('Remove %s', 'bulk-sms-portal')), esc(x.name))}"`, 'is-small is-quiet')}</span></div>`).join('')}
          ${(n.prefixes || []).map((x, i) => `<div class="bx-tr" style="--cols:${cols}"><span class="bx-td-main bx-td-lead" data-label="${esc(__('Who it applies to', 'bulk-sms-portal'))}"><strong>${sprintf(/* translators: %s: a value filled in when shown */ __('Numbers starting %s', 'bulk-sms-portal'), esc(prefixLabel('234', x.prefixes[0])))}</strong><small>${__('Special price: beats the network price', 'bulk-sms-portal')}</small></span><span class="is-num" data-label="${esc(__('Standard', 'bulk-sms-portal'))}">${money(x.standard_kobo, __('Network price', 'bulk-sms-portal'))}</span><span class="is-num" data-label="${esc(__('Do Not Disturb', 'bulk-sms-portal'))}">${money(x.dnd_kobo, __('Network price', 'bulk-sms-portal'))}</span><span class="bx-row-flex bx-td-actions">${btn(__('Edit', 'bulk-sms-portal'), `data-bx-pm-sp="${i}"`, 'is-small')}${btn(icon('trash', 16) + `<span class="bx-sr">${__('Remove', 'bulk-sms-portal')}</span>`, `data-bx-pm-sp-del="${i}" aria-label="${esc(__('Remove special price', 'bulk-sms-portal'))}"`, 'is-small is-quiet')}</span></div>`).join('')}
        </div>
        <p class="bx-mt-s">${btn(icon('plus', 16) + __('Add a special price for one prefix', 'bulk-sms-portal'), 'data-bx-pm-sp-add', 'is-small is-quiet')}</p>
      </section>

      <section class="bx-section" aria-labelledby="bx-pm-intl">
        <div class="bx-section-head"><div><h2 id="bx-pm-intl">${__('Other countries', 'bulk-sms-portal')}</h2><p>${__('Only countries in this list can be sent to. Customers type these numbers with the country code.', 'bulk-sms-portal')}</p></div>${btn(icon('plus', 16) + __('Add a country', 'bulk-sms-portal'), 'data-bx-pm-cc-add', 'is-small is-primary')}</div>
        ${r.international_ready ? '' : note('wait', __('Sending outside Nigeria is off', 'bulk-sms-portal'), __('No SMS service is chosen for numbers outside Nigeria, so they are left out of every send and not charged, even when they have a price here.', 'bulk-sms-portal'), btn(__('Choose a service', 'bulk-sms-portal'), 'data-bx-go="admin-apis"', 'is-small'))}
        ${others.length ? `<div class="bx-list bx-mt-s"><div class="bx-tr is-head" style="--cols:1.6fr 0.9fr 150px"><span>${__('Country', 'bulk-sms-portal')}</span><span class="is-num">${__('Price per SMS page', 'bulk-sms-portal')}</span><span></span></div>
          ${others.map(c => `<div class="bx-tr" style="--cols:1.6fr 0.9fr 150px"><span class="bx-td-main bx-td-lead" data-label="${esc(__('Country', 'bulk-sms-portal'))}"><strong>${esc(nameOf(c.code))}</strong><small>+${esc(c.code)}${(c.networks || []).length || (c.prefixes || []).length ? ` · ${sprintf(/* translators: %s: a number */ _n('%s own price', '%s own prices', Number((c.networks || []).length + (c.prefixes || []).length), 'bulk-sms-portal'), num((c.networks || []).length + (c.prefixes || []).length))}` : ''}</small></span><span class="is-num" data-label="${esc(__('Price per SMS page', 'bulk-sms-portal'))}"><b>${money(c.standard_kobo)}</b></span><span class="bx-row-flex bx-td-actions">${btn(__('Edit', 'bulk-sms-portal'), `data-bx-pm-cc="${esc(c.code)}"`, 'is-small')}${btn(icon('trash', 16) + `<span class="bx-sr">${__('Remove', 'bulk-sms-portal')}</span>`, `data-bx-pm-cc-del="${esc(c.code)}" aria-label="${sprintf(/* translators: %s: a value filled in when shown */ esc(__('Remove %s', 'bulk-sms-portal')), esc(nameOf(c.code)))}"`, 'is-small is-quiet')}</span></div>`).join('')}</div>`
          : `<div class="bx-list bx-mt-s">${empty('globe', __('No other countries', 'bulk-sms-portal'), __('Add a country, for example 229 for Benin or 233 for Ghana.', 'bulk-sms-portal'))}</div>`}
      </section>

      <section class="bx-section bx-panel" aria-labelledby="bx-pm-try">
        <div class="bx-panel-head"><div><h2 id="bx-pm-try">${__('Check a number', 'bulk-sms-portal')}</h2><p>${sprintf(/* translators: %s: a value filled in when shown */ __('What one SMS page to this number costs with the prices on this page%s.', 'bulk-sms-portal'), dirty() ? __(', including changes not saved yet', 'bulk-sms-portal') : '')}</p></div></div>
        <div class="bx-fields">${fieldHtml('pm-t-num', __('Phone number', 'bulk-sms-portal'), '', { type: 'tel', placeholder: '0803 123 4567 or +233 24 123 4567' })}${fieldHtml('pm-t-route', __('Delivery', 'bulk-sms-portal'), 'std', { options: [['std', __('Standard', 'bulk-sms-portal')], ['dnd', __('Reach Do Not Disturb numbers', 'bulk-sms-portal')]] })}</div>
        <div class="bx-mt-s" data-bx-pm-out aria-live="polite"></div>
      </section>`;
    bindGo(box);
    bind();
    tryIt();
  }

  function tryIt() {
    const out = $('[data-bx-pm-out]', box); if (!out) return;
    const v = val(box, 'pm-t-num');
    if (phoneDigits(v).length < 10) { out.innerHTML = ''; return; }
    const q = quoteFrom(draft, v, val(box, 'pm-t-route') === 'dnd');
    if (!q || q.price === null) { out.innerHTML = note('wait', __('Not sent and not charged', 'bulk-sms-portal'), q && q.reason === 'no_dnd_price' ? __('No Do Not Disturb price is set.', 'bulk-sms-portal') : __('This country is not in the price list.', 'bulk-sms-portal')); return; }
    const abroad = String(q.country.code) !== '234';
    const why = q.special ? `${sprintf(/* translators: %s: a value filled in when shown */ __('special price for %s', 'bulk-sms-portal'), prefixLabel('234', q.prefix))}` : (q.network ? `${q.network} price` : (abroad ? `${nameOf(q.country.code)} price` : __('Nigeria price', 'bulk-sms-portal')));
    out.innerHTML = abroad && !r.international_ready
      ? note('wait', `${sprintf(/* translators: %s: a value filled in when shown */ __('%s, but not sent for now', 'bulk-sms-portal'), esc(naira(q.price)))}`, __('Sending outside Nigeria is off until you choose a service for it.', 'bulk-sms-portal'))
      : note('good', `${sprintf(/* translators: %s: a value filled in when shown */ __('%s per SMS page', 'bulk-sms-portal'), esc(naira(q.price)))}`, `${sprintf(/* translators: %s: a value filled in when shown */ __('Uses the %s.', 'bulk-sms-portal'), esc(why))}`);
  }

  function changed() { draw(); }

  function bind() {
    const on = (sel, fn) => $$(sel, box).forEach(b => b.onclick = () => fn(b));
    ['pm-t-num', 'pm-t-route'].forEach(id => { const el = $('#' + id, box); if (el) { el.addEventListener('input', tryIt); el.addEventListener('change', tryIt); } });
    on('[data-bx-pm-ng]', () => countryEditor(ng(), true));
    on('[data-bx-pm-net-add]', () => entryEditor('234', 'network'));
    on('[data-bx-pm-net]', b => entryEditor('234', 'network', ng().networks.find(x => x.name === b.dataset.bxPmNet)));
    on('[data-bx-pm-net-del]', async b => {
      if (!await confirmBox({ title: `${sprintf(/* translators: %s: a value filled in when shown */ __('Remove %s?', 'bulk-sms-portal'), b.dataset.bxPmNetDel)}`, body: `<p>${__('Its numbers will be charged the Nigeria price. Nothing changes until you save prices.', 'bulk-sms-portal')}</p>`, confirm: __('Remove', 'bulk-sms-portal') })) return;
      ng().networks = ng().networks.filter(x => x.name !== b.dataset.bxPmNetDel); changed();
    });
    on('[data-bx-pm-sp-add]', () => entryEditor('234', 'prefix'));
    on('[data-bx-pm-sp]', b => entryEditor('234', 'prefix', ng().prefixes[Number(b.dataset.bxPmSp)]));
    on('[data-bx-pm-sp-del]', b => { ng().prefixes.splice(Number(b.dataset.bxPmSpDel), 1); changed(); });
    on('[data-bx-pm-cc-add]', () => countryEditor(null));
    on('[data-bx-pm-cc]', b => countryEditor(draft.find(c => String(c.code) === b.dataset.bxPmCc)));
    on('[data-bx-pm-cc-del]', async b => {
      if (!await confirmBox({ title: `${sprintf(/* translators: %s: a value filled in when shown */ __('Remove %s?', 'bulk-sms-portal'), nameOf(b.dataset.bxPmCcDel))}`, body: `<p>${__('Numbers in this country will not be sent or charged. Nothing changes until you save prices.', 'bulk-sms-portal')}</p>`, confirm: __('Remove', 'bulk-sms-portal') })) return;
      draft = draft.filter(c => String(c.code) !== b.dataset.bxPmCcDel); changed();
    });
    on('[data-bx-pm-undo]', () => { draft = JSON.parse(saved); changed(); });
    on('[data-bx-pm-save]', b => save(b));
  }

  async function save(b) {
    const body = draft.map(c => ({
      code: String(c.code), standard_naira: pmNaira(c.standard_kobo), dnd_naira: pmNaira(c.dnd_kobo),
      networks: (c.networks || []).map(x => ({ name: x.name, prefixes: x.prefixes, standard_naira: pmNaira(x.standard_kobo), dnd_naira: pmNaira(x.dnd_kobo) })),
      prefixes: (c.prefixes || []).map(x => ({ prefix: x.prefixes[0], standard_naira: pmNaira(x.standard_kobo), dnd_naira: pmNaira(x.dnd_kobo) }))
    }));
    const done = busy(b, __('Saving…', 'bulk-sms-portal'));
    const res = await C.api('/admin/price-list', { method: 'POST', body: JSON.stringify({ countries: body }) });
    done();
    if (!ctx.live()) return;
    if (res && res.ok) { saved = JSON.stringify(res.list); draft = JSON.parse(saved); notes = []; prices(true); toast(__('Prices saved. Customers are charged these prices from now on.', 'bulk-sms-portal')); draw(); }
    else toast(friendly(res, __('Prices were not saved.', 'bulk-sms-portal')), 'bad');
  }

  /* Country price (Nigeria: standard + Do Not Disturb; others: one price). */
  function countryEditor(c, isNg = false) {
    const fresh = !c;
    openDialog(`<form method="dialog" novalidate><div class="bx-dialog-body"><h2>${isNg ? __('Nigeria price', 'bulk-sms-portal') : (fresh ? __('Add a country', 'bulk-sms-portal') : esc(nameOf(c.code)))}</h2>
      ${isNg ? `<p class="bx-muted">${__('For any Nigerian number whose network has no price of its own.', 'bulk-sms-portal')}</p>` : ''}
      ${fresh ? fieldHtml('pm-cc', __('Country code', 'bulk-sms-portal'), '', { attrs: 'inputmode="numeric" maxlength="4"', placeholder: '229', hint: `<span data-bx-pm-ccname>${__('For example 229 for Benin, 233 for Ghana.', 'bulk-sms-portal')}</span>` }) : ''}
      <div class="bx-fields">
        <div class="bx-field"><label class="bx-label" for="pm-std">${__('Price per SMS page', 'bulk-sms-portal')}</label><div class="bx-money-input"><span aria-hidden="true">₦</span><input id="pm-std" type="number" min="0" step="0.01" value="${c ? pmNaira(c.standard_kobo) : ''}"></div></div>
        ${isNg ? `<div class="bx-field"><label class="bx-label" for="pm-dnd">${__('Do Not Disturb numbers', 'bulk-sms-portal')} <span class="bx-optional">${__('(optional)', 'bulk-sms-portal')}</span></label><div class="bx-money-input"><span aria-hidden="true">₦</span><input id="pm-dnd" type="number" min="0" step="0.01" value="${pmNaira(c.dnd_kobo)}"></div><span class="bx-hint">${__('Leave empty if you don’t offer it.', 'bulk-sms-portal')}</span></div>` : ''}
      </div>
      <div data-bx-pm-msg></div></div><div class="bx-dialog-actions"><button class="bx-btn" value="cancel">${__('Cancel', 'bulk-sms-portal')}</button><button class="bx-btn is-primary" data-bx-pm-ok>${fresh ? __('Add country', 'bulk-sms-portal') : __('Done', 'bulk-sms-portal')}</button></div></form>`, d => {
      const cc = $('#pm-cc', d);
      if (cc) cc.addEventListener('input', () => { const v = cc.value.replace(/\D+/g, ''); $('[data-bx-pm-ccname]', d).textContent = v ? (names[v] ? names[v] : __('Check the code: we don’t recognise it, but you can still use it.', 'bulk-sms-portal')) : __('For example 229 for Benin, 233 for Ghana.', 'bulk-sms-portal'); });
      $('[data-bx-pm-ok]', d).onclick = (e) => {
        e.preventDefault();
        const msg = $('[data-bx-pm-msg]', d), std = pmKobo(val(d, 'pm-std'));
        if (!std) { msg.innerHTML = note('bad', __('Enter a price above ₦0', 'bulk-sms-portal')); return; }
        if (fresh) {
          const code = (val(d, 'pm-cc') || '').replace(/\D+/g, '');
          if (!code || code.length > 4) { msg.innerHTML = note('bad', __('Enter a country code of 1 to 4 numbers', 'bulk-sms-portal')); return; }
          if (code === '234') { msg.innerHTML = note('bad', __('Nigeria is already in the list', 'bulk-sms-portal')); return; }
          if (draft.some(x => String(x.code) === code)) { msg.innerHTML = note('bad', `${sprintf(/* translators: %s: a value filled in when shown */ __('%s is already in the list', 'bulk-sms-portal'), esc(nameOf(code)))}`); return; }
          draft.push({ code, name: nameOf(code), standard_kobo: std, dnd_kobo: null, networks: [], prefixes: [] });
        } else {
          c.standard_kobo = std;
          if (isNg) c.dnd_kobo = pmKobo(val(d, 'pm-dnd')) || null;
        }
        d.close(); changed();
      };
    });
  }

  /* A network (name + prefixes) or a special price for one prefix. */
  function entryEditor(cc, kind, x) {
    const isNet = kind === 'network', fresh = !x;
    const c = draft.find(y => String(y.code) === cc);
    const usedNames = (c.networks || []).map(n => n.name);
    const suggest = NETWORK_CHOICES.filter(n => !usedNames.includes(n));
    const prefixesText = x ? x.prefixes.map(p => prefixLabel(cc, p)).join(', ') : '';
    openDialog(`<form method="dialog" novalidate><div class="bx-dialog-body"><h2>${isNet ? (fresh ? __('Add a network', 'bulk-sms-portal') : __('Edit ', 'bulk-sms-portal') + esc(x.name)) : (fresh ? __('Add a special price', 'bulk-sms-portal') : __('Edit special price', 'bulk-sms-portal'))}</h2>
      ${isNet ? `${fieldHtml('pm-name', __('Network', 'bulk-sms-portal'), x ? x.name : (suggest[0] || ''), { placeholder: __('For example MTN', 'bulk-sms-portal'), attrs: 'list="pm-net-names" maxlength="30"' })}<datalist id="pm-net-names">${NETWORK_CHOICES.map(n => `<option value="${n}"></option>`).join('')}</datalist>
        ${fieldHtml('pm-pfx', __('Number prefixes', 'bulk-sms-portal'), prefixesText, { textarea: true, rows: 3, mono: true, hint: __('The first four digits of its numbers, separated by commas, for example 0803, 0806, 0703.', 'bulk-sms-portal') })}`
      : fieldHtml('pm-pfx', __('Numbers starting with', 'bulk-sms-portal'), prefixesText, { mono: true, placeholder: '0807', hint: __('One prefix. This price beats the network price for these numbers.', 'bulk-sms-portal') })}
      <div class="bx-fields">
        <div class="bx-field"><label class="bx-label" for="pm-std">${__('Price per SMS page', 'bulk-sms-portal')}</label><div class="bx-money-input"><span aria-hidden="true">₦</span><input id="pm-std" type="number" min="0" step="0.01" value="${x ? pmNaira(x.standard_kobo) : ''}"></div></div>
        ${cc === '234' ? `<div class="bx-field"><label class="bx-label" for="pm-dnd">${__('Do Not Disturb numbers', 'bulk-sms-portal')} <span class="bx-optional">${__('(optional)', 'bulk-sms-portal')}</span></label><div class="bx-money-input"><span aria-hidden="true">₦</span><input id="pm-dnd" type="number" min="0" step="0.01" value="${x ? pmNaira(x.dnd_kobo) : ''}"></div><span class="bx-hint">${__('Empty uses the Nigeria Do Not Disturb price.', 'bulk-sms-portal')}</span></div>` : ''}
      </div>
      <div data-bx-pm-msg></div></div><div class="bx-dialog-actions"><button class="bx-btn" value="cancel">${__('Cancel', 'bulk-sms-portal')}</button><button class="bx-btn is-primary" data-bx-pm-ok>${fresh ? __('Add', 'bulk-sms-portal') : __('Done', 'bulk-sms-portal')}</button></div></form>`, d => {
      const nameEl = $('#pm-name', d), pfx = $('#pm-pfx', d);
      const fill = () => { if (fresh && isNet && !pfx.value.trim() && known[nameEl.value]) pfx.value = known[nameEl.value].map(p => prefixLabel('234', p)).join(', '); };
      if (nameEl) { nameEl.addEventListener('change', fill); fill(); }
      $('[data-bx-pm-ok]', d).onclick = (e) => {
        e.preventDefault();
        const msg = $('[data-bx-pm-msg]', d);
        const list = pfx.value.split(/[\s,;]+/).map(t => t.replace(/\D+/g, '')).filter(Boolean).map(t => {
          if (t.startsWith('00')) t = t.slice(2);
          if (cc === '234') { if (t.startsWith('234')) t = t.slice(3); else if (t.startsWith('0')) t = t.slice(1); t = t.slice(0, 3); }
          else if (t.startsWith(cc) && t.length > cc.length) t = t.slice(cc.length);
          return cc + t;
        }).filter(p => p.length > cc.length);
        const uniq = [...new Set(list)];
        const std = pmKobo(val(d, 'pm-std')), dnd = cc === '234' ? pmKobo(val(d, 'pm-dnd')) : 0;
        const name = isNet ? (val(d, 'pm-name') || '').trim() : '';
        if (isNet && !name) { msg.innerHTML = note('bad', __('Enter the network name', 'bulk-sms-portal')); return; }
        if (isNet && usedNames.some(n => n.toLowerCase() === name.toLowerCase() && (!x || n !== x.name))) { msg.innerHTML = note('bad', `${sprintf(/* translators: %s: a value filled in when shown */ __('%s is already in the list', 'bulk-sms-portal'), esc(name))}`); return; }
        if (!uniq.length) { msg.innerHTML = note('bad', isNet ? __('Add at least one number prefix', 'bulk-sms-portal') : __('Enter a prefix such as 0807', 'bulk-sms-portal')); return; }
        if (!isNet && uniq.length > 1) { msg.innerHTML = note('bad', __('Add one prefix at a time', 'bulk-sms-portal')); return; }
        if (!std && !dnd) { msg.innerHTML = note('bad', __('Enter a price above ₦0', 'bulk-sms-portal')); return; }
        const clash = isNet ? (c.networks || []).filter(n => n !== x).flatMap(n => n.prefixes.filter(p => uniq.includes(p)).map(p => [p, n.name])) : (c.prefixes || []).filter(n => n !== x && uniq.includes(n.prefixes[0])).map(n => [n.prefixes[0], 'another special price']);
        if (clash.length) { msg.innerHTML = note('bad', `${sprintf(/* translators: %1$s, %2$s: values filled in when shown */ __('%1$s is already in %2$s', 'bulk-sms-portal'), esc(prefixLabel(cc, clash[0][0])), esc(clash[0][1]))}`, __('A prefix can belong to one network only.', 'bulk-sms-portal')); return; }
        const item = { name: isNet ? name : uniq[0], prefixes: uniq, standard_kobo: std || null, dnd_kobo: dnd || null };
        const key = isNet ? 'networks' : 'prefixes';
        c[key] = c[key] || [];
        if (x) c[key][c[key].indexOf(x)] = item; else c[key].push(item);
        d.close(); changed();
      };
    });
  }

  draw();
});
