/* ==========================================================================
   Pricing (customer). v3.6.2 rule: your wallet holds money; each SMS page is
   charged the price of the network (or country) it goes to. Same price for
   any size of send. Countries not listed are not sent to.
   ========================================================================== */
page('pricing', 'Pricing', async (host, ctx) => {
  const root = mount(host, `
    ${pageHead(__('Pricing', 'bulk-sms-portal'), __('Your wallet holds money: every ₦1 you pay is ₦1 to spend. Each SMS page is charged the price of the network it goes to, whatever the size of your send.', 'bulk-sms-portal'), (canUse('buy_sms') ? btn(__('Buy SMS', 'bulk-sms-portal'), 'data-bx-go="fund"', 'is-primary') : '') + adminBtn(__('Change prices', 'bulk-sms-portal'), 'admin-pricing'))}
    <div data-bx-prices>${skeleton(6)}</div>`);
  bindGo(root);
  const pr = await prices(true);
  if (!ctx.live()) return;
  const box = $('[data-bx-prices]', root);
  const std = priceModel(pr, false), dnd = priceModel(pr, true);
  if (!std.top) { box.innerHTML = `<div class="bx-list">${empty('tag', __('Prices are not published yet', 'bulk-sms-portal'), __('The cost is always shown on the Send SMS page before you send.', 'bulk-sms-portal'))}</div>`; return; }

  const ng = std.ng;
  const hasDnd = !!dnd.top;
  const cols = hasDnd ? '1.5fr 1fr 1fr' : '1.5fr 1fr';
  const money = k => Number(k) ? `<b>${esc(naira(k))}</b>` : `<span class="bx-muted">${__('Same as other networks', 'bulk-sms-portal')}</span>`;
  const dndCell = (k, fallback) => hasDnd ? `<span class="is-num" data-label="${esc(__('Do Not Disturb numbers', 'bulk-sms-portal'))}">${Number(k) ? esc(naira(k)) : (fallback ? esc(naira(fallback)) : __('Not offered', 'bulk-sms-portal'))}</span>` : '';
  const head = (first) => `<div class="bx-tr is-head" style="--cols:${cols}"><span>${first}</span><span class="is-num">${__('Price per SMS page', 'bulk-sms-portal')}</span>${hasDnd ? `<span class="is-num">${__('Do Not Disturb numbers', 'bulk-sms-portal')}</span>` : ''}</div>`;
  const nets = [...(ng.networks || [])].sort((a, b) => (MAIN_NETWORKS.indexOf(a.name) + 1 || 99) - (MAIN_NETWORKS.indexOf(b.name) + 1 || 99));
  const others = std.list.filter(c => String(c.code) !== '234' && Number(c.standard_kobo));

  box.innerHTML = `
    <section class="bx-section bx-mt-0" aria-labelledby="bx-pr-ng">
      <div class="bx-section-head"><div><h2 id="bx-pr-ng">${__('Nigerian numbers', 'bulk-sms-portal')}</h2><p>${__('The price is set by the network of each number you send to.', 'bulk-sms-portal')}</p></div></div>
      <div class="bx-list">
        ${head(__('Network', 'bulk-sms-portal'))}
        ${nets.map(n => `<div class="bx-tr" style="--cols:${cols}"><span class="bx-td-main bx-td-lead" data-label="${esc(__('Network', 'bulk-sms-portal'))}"><strong>${esc(n.name)}</strong><small>${esc((n.prefixes || []).slice(0, 6).map(p => prefixLabel('234', p)).join(', '))}${(n.prefixes || []).length > 6 ? '…' : ''}</small></span><span class="is-num" data-label="${esc(__('Price per SMS page', 'bulk-sms-portal'))}">${money(n.standard_kobo || ng.standard_kobo)}</span>${dndCell(n.dnd_kobo, ng.dnd_kobo)}</div>`).join('')}
        ${Number(ng.standard_kobo) ? `<div class="bx-tr" style="--cols:${cols}"><span class="bx-td-main bx-td-lead" data-label="${esc(__('Network', 'bulk-sms-portal'))}"><strong>${nets.length ? __('Any other Nigerian network', 'bulk-sms-portal') : __('Every Nigerian network', 'bulk-sms-portal')}</strong></span><span class="is-num" data-label="${esc(__('Price per SMS page', 'bulk-sms-portal'))}"><b>${esc(naira(ng.standard_kobo))}</b></span>${dndCell(ng.dnd_kobo)}</div>` : ''}
        ${(ng.prefixes || []).map(x => `<div class="bx-tr" style="--cols:${cols}"><span class="bx-td-main bx-td-lead" data-label="${esc(__('Network', 'bulk-sms-portal'))}"><strong>${sprintf(/* translators: %s: a value filled in when shown */ __('Numbers starting %s', 'bulk-sms-portal'), esc(prefixLabel('234', x.prefixes[0])))}</strong><small>${__('Special price', 'bulk-sms-portal')}</small></span><span class="is-num" data-label="${esc(__('Price per SMS page', 'bulk-sms-portal'))}">${money(x.standard_kobo)}</span>${dndCell(x.dnd_kobo, hasDnd ? (dnd.quote(x.prefixes[0] + '0000000') || {}).price : 0)}</div>`).join('')}
      </div>
    </section>

    ${others.length ? `<section class="bx-section" aria-labelledby="bx-pr-intl">
      <div class="bx-section-head"><div><h2 id="bx-pr-intl">${__('Other countries', 'bulk-sms-portal')}</h2><p>${std.intlReady ? __('Type the number with its country code, for example +233 24 123 4567. Countries not listed here cannot be sent to.', 'bulk-sms-portal') : __('Sending outside Nigeria is not available yet. These prices apply once it is.', 'bulk-sms-portal')}</p></div></div>
      <div class="bx-list">
        <div class="bx-tr is-head" style="--cols:1.5fr 1fr"><span>${__('Country', 'bulk-sms-portal')}</span><span class="is-num">${__('Price per SMS page', 'bulk-sms-portal')}</span></div>
        ${others.map(c => `<div class="bx-tr${std.intlReady ? '' : ' is-off'}" style="--cols:1.5fr 1fr"><span class="bx-td-main bx-td-lead" data-label="${esc(__('Country', 'bulk-sms-portal'))}"><strong>${esc(c.name)}</strong><small>+${esc(c.code)}</small></span><span class="is-num" data-label="${esc(__('Price per SMS page', 'bulk-sms-portal'))}"><b>${esc(naira(c.standard_kobo))}</b></span></div>`).join('')}
      </div>
    </section>` : ''}

    <div class="bx-section bx-split is-even">
      <section class="bx-panel" aria-labelledby="bx-pr-check">
        <div class="bx-panel-head"><div><h2 id="bx-pr-check">${__('Check a number', 'bulk-sms-portal')}</h2><p>${__('See what one SMS page to a number costs.', 'bulk-sms-portal')}</p></div></div>
        <div class="bx-field"><label class="bx-label" for="bx-pr-num">${__('Phone number', 'bulk-sms-portal')}</label><input id="bx-pr-num" class="bx-input" type="tel" inputmode="tel" placeholder="0803 123 4567" autocomplete="off"></div>
        <div class="bx-mt-s" data-bx-pr-out aria-live="polite"></div>
      </section>
      <section class="bx-panel" aria-labelledby="bx-pr-calc">
        <div class="bx-panel-head"><div><h2 id="bx-pr-calc">${__('Work out a cost', 'bulk-sms-portal')}</h2><p>${__('For Nigerian numbers on one network.', 'bulk-sms-portal')}</p></div></div>
        <div class="bx-fields">
          <div class="bx-field"><label class="bx-label" for="bx-calc-people">${__('How many people', 'bulk-sms-portal')}</label><input id="bx-calc-people" class="bx-input" type="number" min="1" value="100" inputmode="numeric"></div>
          <div class="bx-field"><label class="bx-label" for="bx-calc-pages">${__('SMS pages each', 'bulk-sms-portal')}</label><select id="bx-calc-pages" class="bx-select"><option value="1">${__('1 page', 'bulk-sms-portal')}</option><option value="2">${__('2 pages', 'bulk-sms-portal')}</option><option value="3">${__('3 pages', 'bulk-sms-portal')}</option><option value="4">${__('4 pages', 'bulk-sms-portal')}</option></select></div>
        </div>
        <div class="bx-field bx-mt-s"><label class="bx-label" for="bx-calc-net">${__('Network', 'bulk-sms-portal')}</label><select id="bx-calc-net" class="bx-select">${nets.filter(n => Number(n.standard_kobo)).map(n => `<option value="${Number(n.standard_kobo)}">${esc(n.name)}</option>`).join('')}${Number(ng.standard_kobo) ? `<option value="${Number(ng.standard_kobo)}">${nets.length ? __('Any other network', 'bulk-sms-portal') : __('Any network', 'bulk-sms-portal')}</option>` : ''}</select></div>
        <div class="bx-slip-total bx-mt-m"><span>${__('Cost', 'bulk-sms-portal')}</span><strong data-bx-calc>—</strong></div>
        <p class="bx-small bx-muted bx-mt-s" data-bx-calc-note></p>
      </section>
    </div>

    <section class="bx-section bx-panel" aria-labelledby="bx-pr-len">
      <div class="bx-panel-head"><div><h2 id="bx-pr-len">${__('How long messages are counted', 'bulk-sms-portal')}</h2><p>${__('Longer messages are sent as more than one SMS page, and each page is charged.', 'bulk-sms-portal')}</p></div></div>
      <dl class="bx-kv">
        <div><dt>${__('Up to 160 characters', 'bulk-sms-portal')}</dt><dd>${__('1 page', 'bulk-sms-portal')}</dd></div>
        <div><dt>${__('161 to 306 characters', 'bulk-sms-portal')}</dt><dd>${__('2 pages', 'bulk-sms-portal')}</dd></div>
        <div><dt>${__('307 to 459 characters', 'bulk-sms-portal')}</dt><dd>${__('3 pages', 'bulk-sms-portal')}</dd></div>
      </dl>
      <p class="bx-small bx-muted bx-mt-s">${__('Messages with letters like é or ñ, or with emoji, fit 70 characters in one page (67 in each page after that). If a message fails, its charge goes back to your wallet.', 'bulk-sms-portal')}</p>
    </section>`;

  const num1 = $('#bx-pr-num', box), out = $('[data-bx-pr-out]', box);
  num1.addEventListener('input', () => {
    const v = num1.value.trim();
    if (phoneDigits(v).length < 10) { out.innerHTML = ''; return; }
    const q = std.quote(v), qd = hasDnd ? dnd.quote(v) : null;
    if (!q || q.price === null) { out.innerHTML = note('wait', __('We can’t send to this number yet', 'bulk-sms-portal'), __('No price is set for its country, so it would be left out and not charged.', 'bulk-sms-portal')); return; }
    const abroad = String(q.country.code) !== '234';
    const where = abroad ? q.country.name : (q.special ? `${sprintf(/* translators: %s: a value filled in when shown */ __('numbers starting %s', 'bulk-sms-portal'), prefixLabel('234', q.prefix))}` : (q.network || __('this network', 'bulk-sms-portal')));
    out.innerHTML = abroad && !std.intlReady
      ? note('wait', `${sprintf(/* translators: %1$s, %2$s: values filled in when shown */ __('%1$s: %2$s per SMS page', 'bulk-sms-portal'), esc(q.country.name), esc(naira(q.price)))}`, __('Sending outside Nigeria is not available yet, so it would be left out and not charged.', 'bulk-sms-portal'))
      : note('good', `${sprintf(/* translators: %s: a value filled in when shown */ __('%s per SMS page', 'bulk-sms-portal'), esc(naira(q.price)))}`, `${sprintf(/* translators: %1$s, %2$s: values filled in when shown */ __('Price for %1$s.%2$s', 'bulk-sms-portal'), esc(where), qd && qd.price && !abroad ? ` ${sprintf(/* translators: %s: a value filled in when shown */ __('Reaching it as a Do Not Disturb number: %s.', 'bulk-sms-portal'), esc(naira(qd.price)))}` : '')}`);
  });
  const people = $('#bx-calc-people', box), pages = $('#bx-calc-pages', box), net = $('#bx-calc-net', box), cout = $('[data-bx-calc]', box), cnote = $('[data-bx-calc-note]', box);
  const calc = () => {
    const p = Math.max(0, Number(people.value || 0)), g = Number(pages.value || 1), each = Number(net.value || 0), qty = p * g;
    cout.textContent = each ? naira(each * qty) : '—';
    cnote.textContent = each ? `${sprintf(/* translators: %1$s, %2$s, %3$s: values filled in when shown */ __('%1$s SMS %2$s at %3$s each. Send SMS shows the exact total for your numbers before you send.', 'bulk-sms-portal'), num(qty), qty === 1 ? 'page' : 'pages', naira(each))}` : '';
  };
  [people, pages, net].forEach(x => x.addEventListener(x.tagName === 'SELECT' ? 'change' : 'input', calc)); calc();
});
