/* ==========================================================================
   Buy SMS
   ========================================================================== */
const fundState = { amount: 0, method: '', banner: '' };

function fundingSetup() {
  const f = S().funding || {};
  const online = (Array.isArray(f.gateways) ? f.gateways : []).filter(g => g && g.enabled && g.configured && g.supports_checkout);
  const banks = (Array.isArray(f.bank_accounts) ? f.bank_accounts : []).filter(b => b && b.active !== false && b.account_number);
  const min = Number(f.minimum_amount || 0), max = Number(f.maximum_amount || 0);
  const quick = (Array.isArray(f.quick_amounts) && f.quick_amounts.length ? f.quick_amounts : [1000, 2500, 5000, 10000, 25000])
    .map(Number).filter(v => v > 0 && (!min || v >= min) && (!max || v <= max));
  return { online, banks, min, max, quick, currency: f.currency || 'NGN' };
}
function amountProblem(v, fs) {
  const n = Number(v || 0);
  if (!n || n <= 0) return __('Enter how much you want to add.', 'bulk-sms-portal');
  if (fs.min > 0 && n < fs.min) return `${sprintf(/* translators: %s: a value filled in when shown */ __('The smallest amount you can add is %s.', 'bulk-sms-portal'), nairaWhole(fs.min))}`;
  if (fs.max > 0 && n > fs.max) return `${sprintf(/* translators: %s: a value filled in when shown */ __('The most you can add at once is %s.', 'bulk-sms-portal'), nairaWhole(fs.max))}`;
  return '';
}
const FUND_STATUS = {
  pending: ['wait', __('Waiting for us to check', 'bulk-sms-portal')], approved: ['good', __('Added to your wallet', 'bulk-sms-portal')], completed: ['good', __('Added to your wallet', 'bulk-sms-portal')],
  success: ['good', __('Added to your wallet', 'bulk-sms-portal')], rejected: ['bad', __('Not approved', 'bulk-sms-portal')], failed: ['bad', __('Not completed', 'bulk-sms-portal')], cancelled: ['bad', __('Cancelled', 'bulk-sms-portal')]
};

/* Coming back from the online payment page. */
APP.paymentReturn = async function () {
  const params = new URLSearchParams(location.search);
  const ref = params.get('reference') || params.get('trxref') || params.get('tx_ref') || params.get('paystack_reference') || '';
  if (!ref) return;
  // Which payment service sent the customer back (Paystack unless an add-on says otherwise).
  const provider = (params.get('bsms_payment') || 'paystack').replace(/[^a-z0-9_-]/g, '');
  const extra = { transaction_id: params.get('transaction_id') || '' };
  ['reference', 'trxref', 'tx_ref', 'transaction_id', 'status', 'paystack_reference', 'bsms_payment', 'payment_status'].forEach(k => params.delete(k));
  try { history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : '') + location.hash); } catch (e) {}
  fundState.banner = note('wait', __('Checking your payment…', 'bulk-sms-portal'), __('Please keep this page open.', 'bulk-sms-portal'));
  C.show('fund', false);
  const r = await C.api('/' + provider + '/verify', { method: 'POST', body: JSON.stringify(Object.assign({ reference: ref }, extra)) });
  try { sessionStorage.removeItem('bsms_paystack_reference'); } catch (e) {}
  if (r && r.ok) {
    await C.load({ force: true });
    fundState.banner = note('good', __('Payment received', 'bulk-sms-portal'), esc(r.message || __('The money has been added to your wallet.', 'bulk-sms-portal')) + ` <span class="bx-small bx-muted">${sprintf(/* translators: %s: a value filled in when shown */ __('Reference %s', 'bulk-sms-portal'), esc(ref))}</span>`, btn(__('Send SMS', 'bulk-sms-portal'), 'data-bx-go="compose"', 'is-primary is-small') + btn(__('See wallet history', 'bulk-sms-portal'), 'data-bx-go="transactions"', 'is-small'));
  } else {
    fundState.banner = note('bad', __('We could not confirm this payment yet', 'bulk-sms-portal'), esc(friendly(r, __('If money left your account, it will be added once the payment is confirmed.', 'bulk-sms-portal'))) + ` <span class="bx-small bx-muted">${sprintf(/* translators: %s: a value filled in when shown */ __('Reference %s', 'bulk-sms-portal'), esc(ref))}</span>`, btn(__('Check again', 'bulk-sms-portal'), `data-bx-recheck="${esc(ref)}"`, 'is-small'));
  }
  C.show('fund', false);
};

page('fund', 'Buy SMS', async (host, ctx) => {
  const fs = fundingSetup();
  const params = new URLSearchParams(location.search);
  const asked = Number(params.get('purchase_amount') || 0);
  if (!fundState.amount) fundState.amount = (asked && !amountProblem(asked, fs)) ? asked : (fs.quick.find(v => v >= 5000) || fs.quick[0] || fs.min || 1000);
  if (!fundState.method || (fundState.method === 'online' && !fs.online.length) || (fundState.method === 'bank' && !fs.banks.length)) fundState.method = fs.online.length ? 'online' : (fs.banks.length ? 'bank' : '');
  const banner = fundState.banner; fundState.banner = '';

  const root = mount(host, `
    ${pageHead(__('Buy SMS', 'bulk-sms-portal'), __('Add money to your wallet. Each SMS you send takes its charge from it.', 'bulk-sms-portal'), btn(icon('tag', 18) + __('See prices', 'bulk-sms-portal'), 'data-bx-go="pricing"'))}
    ${banner ? `<div class="bx-stack is-tight" data-bx-banner>${banner}</div>` : ''}
    ${!fs.online.length && !fs.banks.length ? note('wait', __('Buying is not available right now', 'bulk-sms-portal'), __('No payment options have been set up yet. Please contact support.', 'bulk-sms-portal')) : `
    <div class="bx-split${banner ? ' bx-section' : ''}">
      <div class="bx-panel">
        <section class="bx-step" aria-labelledby="bx-f1">
          <span class="bx-step-num">1</span>
          <div class="bx-step-title"><h2 id="bx-f1">${__('How much do you want to add?', 'bulk-sms-portal')}</h2><p>${fs.min || fs.max ? esc([fs.min ? __('From ', 'bulk-sms-portal') + nairaWhole(fs.min) : '', fs.max ? __('up to ', 'bulk-sms-portal') + nairaWhole(fs.max) : ''].filter(Boolean).join(' ')) + '.' : __('Choose an amount or type your own.', 'bulk-sms-portal')}</p></div>
          <div class="bx-step-body">
            <div class="bx-chips" role="group" aria-label="${esc(__('Quick amounts', 'bulk-sms-portal'))}">${fs.quick.map(v => `<button type="button" class="bx-chip" data-bx-amount="${v}">${esc(nairaWhole(v))}</button>`).join('')}</div>
            <div class="bx-field">
              <label class="bx-label" for="bx-amount">${__('Amount', 'bulk-sms-portal')}</label>
              <div class="bx-money-input"><span aria-hidden="true">₦</span><input id="bx-amount" type="number" inputmode="decimal" min="${fs.min || 1}" ${fs.max ? `max="${fs.max}"` : ''} step="1" value="${esc(fundState.amount)}"></div>
              <span class="bx-hint" data-bx-amount-hint></span>
            </div>
          </div>
        </section>
        <section class="bx-step" aria-labelledby="bx-f2">
          <span class="bx-step-num">2</span>
          <div class="bx-step-title"><h2 id="bx-f2">${__('How do you want to pay?', 'bulk-sms-portal')}</h2></div>
          <div class="bx-step-body">
            <div class="bx-choices" role="group" aria-label="${esc(__('Payment choice', 'bulk-sms-portal'))}">
              ${fs.online.length ? `<button type="button" class="bx-choice" data-bx-method="online"><strong>${sprintf(/* translators: %s: a value filled in when shown */ __('%s Pay online', 'bulk-sms-portal'), icon('card', 18))}</strong><span>${__('Card, bank app or USSD. Added straight away.', 'bulk-sms-portal')}</span></button>` : ''}
              ${fs.banks.length ? `<button type="button" class="bx-choice" data-bx-method="bank"><strong>${sprintf(/* translators: %s: a value filled in when shown */ __('%s Bank transfer', 'bulk-sms-portal'), icon('bank', 18))}</strong><span>${__('Transfer, then upload your receipt. Added after we check it.', 'bulk-sms-portal')}</span></button>` : ''}
            </div>
            <div data-bx-method-panel="online" hidden>
              ${fs.online.length > 1 ? `<div class="bx-field"><label class="bx-label" for="bx-gw">${__('Pay with', 'bulk-sms-portal')}</label><select id="bx-gw" class="bx-select">${fs.online.map(g => `<option value="${esc(g.id)}">${esc(g.label)}</option>`).join('')}</select></div>` : ''}
              <p class="bx-muted">${sprintf(/* translators: %s: a value filled in when shown */ __('You will go to %s\'s secure page to pay, then come back here.', 'bulk-sms-portal'), esc((fs.online[0] && fs.online[0].label) || __('our payment partner', 'bulk-sms-portal')))}</p>
            </div>
            <div class="bx-stack is-tight" data-bx-method-panel="bank" hidden>
              <p class="bx-muted">${sprintf(/* translators: %s: a value filled in when shown */ __('Transfer the amount to %s, then tell us about it below.', 'bulk-sms-portal'), fs.banks.length > 1 ? __('one of these accounts', 'bulk-sms-portal') : __('this account', 'bulk-sms-portal'))}</p>
              <div class="bx-grid" style="--min:260px">${fs.banks.map((b, i) => `
                <label class="bx-choice" data-bx-bank="${i}">
                  <input type="radio" name="bx-bank" value="${i}" ${i === 0 ? 'checked' : ''}>
                  <strong>${esc(b.bank || __('Bank', 'bulk-sms-portal'))}</strong>
                  <span>${esc(b.account_name || '')}</span>
                  <span class="bx-copy"><span>${esc(b.account_number)}</span><button type="button" class="bx-btn is-small" data-bx-copy="${esc(b.account_number)}">${sprintf(/* translators: %s: a value filled in when shown */ __('%sCopy', 'bulk-sms-portal'), icon('copy', 16))}</button></span>
                  ${b.instructions ? `<span class="bx-small">${esc(b.instructions)}</span>` : ''}
                </label>`).join('')}</div>
              <div class="bx-fields">
                <div class="bx-field"><label class="bx-label" for="bx-depositor">${__('Name on the transfer', 'bulk-sms-portal')}</label><input id="bx-depositor" class="bx-input" autocomplete="name" value="${esc(String(S().user || ''))}"></div>
                <div class="bx-field"><label class="bx-label" for="bx-bankref">${__('Bank reference', 'bulk-sms-portal')} <span class="bx-optional">${__('(optional)', 'bulk-sms-portal')}</span></label><input id="bx-bankref" class="bx-input" placeholder="${esc(__('From your bank receipt', 'bulk-sms-portal'))}"></div>
              </div>
              <div class="bx-field">
                <span class="bx-label">${__('Receipt', 'bulk-sms-portal')}</span>
                <label class="bx-file" for="bx-proof">${icon('upload', 22)}<strong data-bx-proof-name>${__('Choose your receipt', 'bulk-sms-portal')}</strong><span class="bx-hint">${__('A photo or PDF of the transfer receipt. JPG, PNG, WebP or PDF, up to 5 MB.', 'bulk-sms-portal')}</span><input id="bx-proof" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"></label>
              </div>
              <div class="bx-field"><label class="bx-label" for="bx-fnote">${__('Note', 'bulk-sms-portal')} <span class="bx-optional">${__('(optional)', 'bulk-sms-portal')}</span></label><textarea id="bx-fnote" class="bx-textarea" rows="2" placeholder="${esc(__('Anything that helps us find your payment', 'bulk-sms-portal'))}"></textarea></div>
            </div>
          </div>
        </section>
      </div>
      <aside class="bx-aside"><div class="bx-slip" data-bx-fund-slip aria-live="polite"></div></aside>
    </div>`}
    <section class="bx-section" aria-labelledby="bx-transfers">
      <div class="bx-section-head"><div><h2 id="bx-transfers">${__('Your payments', 'bulk-sms-portal')}</h2><p>${__('Bank transfers you told us about, and online payments still being checked.', 'bulk-sms-portal')}</p></div>${btn(icon('refresh', 16) + __('Refresh', 'bulk-sms-portal'), 'data-bx-refresh', 'is-small')}</div>
      <div data-bx-requests>${loading(__('Loading your payments…', 'bulk-sms-portal'))}</div>
    </section>`);
  bindGo(root); bindCopy(root);
  const rc = $('[data-bx-recheck]', root);
  if (rc) rc.onclick = () => { history.replaceState(null, '', location.pathname + '?reference=' + encodeURIComponent(rc.dataset.bxRecheck) + location.hash); APP.paymentReturn(); };

  const amountEl = $('#bx-amount', root), slip = $('[data-bx-fund-slip]', root);
  let model = null;
  const paint = () => {
    if (!slip) return;
    const v = Number(amountEl.value || 0);
    const problem = amountProblem(v, fs);
    const hint = $('[data-bx-amount-hint]', root);
    hint.textContent = problem; hint.classList.toggle('is-bad', !!problem);
    amountEl.closest('.bx-money-input').toggleAttribute('data-invalid', !!problem);
    $$('[data-bx-amount]', root).forEach(b => b.setAttribute('aria-pressed', Number(b.dataset.bxAmount) === v ? 'true' : 'false'));
    $$('[data-bx-method]', root).forEach(b => b.setAttribute('aria-pressed', b.dataset.bxMethod === fundState.method ? 'true' : 'false'));
    $$('[data-bx-method-panel]', root).forEach(p => { p.hidden = p.dataset.bxMethodPanel !== fundState.method; });
    const kobo = Math.round(v * 100);
    const est = model && !problem ? aboutFor(model, kobo) : null;
    const bank = fundState.method === 'bank';
    slip.innerHTML = `
      <div class="bx-slip-title"><span>${__('Your top-up', 'bulk-sms-portal')}</span>${icon('wallet', 18)}</div>
      <div class="bx-slip-rows">
        <div class="bx-slip-row"><span>${__('Wallet now', 'bulk-sms-portal')}</span><b>${esc(naira(balanceKobo()))}</b></div>
        <div class="bx-slip-row is-good"><span>${__('Added', 'bulk-sms-portal')}</span><b>${problem ? '—' : '+' + esc(naira(kobo))}</b></div>
        <div class="bx-slip-row"><span>${__('Wallet after', 'bulk-sms-portal')}</span><b>${problem ? '—' : esc(naira(balanceKobo() + kobo))}</b></div>
        ${est ? `<div class="bx-slip-row"><span>${__('That is about', 'bulk-sms-portal')}</span><b>${sprintf(/* translators: %s: a number */ _n('%s SMS', '%s SMS', Number(est.count), 'bulk-sms-portal'), num(est.count))}</b></div>` : ''}
      </div>
      <span class="bx-slip-tear" aria-hidden="true"></span>
      <div class="bx-slip-total"><span>${__('You pay', 'bulk-sms-portal')}</span><strong>${problem ? '—' : esc(naira(kobo))}</strong></div>
      <div class="bx-slip-foot">
        <button type="button" class="bx-btn is-primary is-large is-block" data-bx-pay ${problem ? 'disabled' : ''}>${bank ? __('Send transfer for checking', 'bulk-sms-portal') : (problem ? __('Pay online', 'bulk-sms-portal') : __('Pay ', 'bulk-sms-portal') + esc(naira(kobo)) + ' online')}</button>
        <span class="bx-hint">${bank ? __('We add the money once we have checked your receipt.', 'bulk-sms-portal') : __('No extra fees are added here.', 'bulk-sms-portal')}${est ? ` ₦1 paid is ₦1 in your wallet. The SMS count is a guide at ${esc(naira(est.charge))} for a one-page message; each SMS is charged the price of the network it goes to.` : ''}</span>
        <div data-bx-pay-msg aria-live="polite"></div>
      </div>`;
    const pay = $('[data-bx-pay]', slip);
    if (pay) pay.onclick = () => bank ? submitTransfer(pay) : payOnline(pay);
  };
  if (amountEl) {
    amountEl.addEventListener('input', () => { fundState.amount = Number(amountEl.value || 0); paint(); });
    $$('[data-bx-amount]', root).forEach(b => b.onclick = () => { amountEl.value = b.dataset.bxAmount; fundState.amount = Number(b.dataset.bxAmount); paint(); });
    $$('[data-bx-method]', root).forEach(b => b.onclick = () => { fundState.method = b.dataset.bxMethod; paint(); });
    const proof = $('#bx-proof', root);
    if (proof) proof.onchange = () => { const f = proof.files && proof.files[0]; $('[data-bx-proof-name]', root).textContent = f ? f.name : __('Choose your receipt', 'bulk-sms-portal'); };
    paint();
    prices().then(pr => { model = priceModel(pr); if (ctx.live()) paint(); });
  }
  const payMsg = (tone, title, text) => { const m = $('[data-bx-pay-msg]', root); if (m) m.innerHTML = note(tone, title, text); };

  async function payOnline(button) {
    const v = Number(amountEl.value || 0);
    const problem = amountProblem(v, fs); if (problem) { payMsg('bad', problem); return; }
    const pick = $('#bx-gw', root);
    const gw = (pick && fs.online.find(g => g.id === pick.value)) || fs.online[0];
    if (!gw || !gw.init) { payMsg('bad', __('Online payment is not available right now', 'bulk-sms-portal'), __('Please use bank transfer or try again later.', 'bulk-sms-portal')); return; }
    const done = busy(button, __('Opening payment page…', 'bulk-sms-portal'));
    const r = await C.api(gw.init, { method: 'POST', body: JSON.stringify({ amount_naira: v, gateway: gw.id }) });
    if (r && r.ok && r.authorization_url) {
      try { sessionStorage.setItem('bsms_paystack_reference', r.reference || ''); if (r.return_url) sessionStorage.setItem('bsms_payment_return_url', r.return_url); } catch (e) {}
      location.href = r.authorization_url;
      return;
    }
    done();
    payMsg('bad', __('The payment page did not open', 'bulk-sms-portal'), esc(friendly(r, __('Please try again in a moment.', 'bulk-sms-portal'))));
  }

  async function uploadProof(file, retried = false) {
    await C.refreshNonce();
    const fd = new FormData(); fd.append('proof', file);
    try {
      const res = await fetch(C.restUrl('funding/proof-upload'), { method: 'POST', credentials: 'same-origin', headers: { 'X-WP-Nonce': (window.BSMS_PORTAL || {}).nonce }, body: fd });
      let data = {}; try { data = await res.json(); } catch (e) {}
      if (!res.ok && C.looksLikeCookieFailure(data) && !retried) return uploadProof(file, true);
      if (!res.ok && !data.error) data.error = __('Your receipt could not be uploaded.', 'bulk-sms-portal');
      return data;
    } catch (e) { return { ok: false, error: __('Your receipt could not be uploaded. Check your connection and try again.', 'bulk-sms-portal') }; }
  }
  async function submitTransfer(button) {
    const v = Number(amountEl.value || 0);
    const problem = amountProblem(v, fs); if (problem) { payMsg('bad', problem); return; }
    const depositor = $('#bx-depositor', root), proof = $('#bx-proof', root);
    if (!depositor.value.trim()) { payMsg('bad', __('Add the name on the transfer', 'bulk-sms-portal'), __('This helps us find your payment.', 'bulk-sms-portal')); depositor.focus(); return; }
    const file = proof.files && proof.files[0];
    if (!file) { payMsg('bad', __('Add your receipt', 'bulk-sms-portal'), __('Upload a photo or PDF of the transfer receipt.', 'bulk-sms-portal')); return; }
    if (file.size > 5 * 1024 * 1024) { payMsg('bad', __('That receipt is too big', 'bulk-sms-portal'), __('Choose a file under 5 MB.', 'bulk-sms-portal')); return; }
    const chosen = $('input[name="bx-bank"]:checked', root);
    const bank = fs.banks[Number(chosen ? chosen.value : 0)] || {};
    let done = busy(button, __('Uploading receipt…', 'bulk-sms-portal'));
    const up = await uploadProof(file);
    done();
    if (!up || !up.ok) { payMsg('bad', __('Receipt not uploaded', 'bulk-sms-portal'), esc(friendly(up, __('Please try again.', 'bulk-sms-portal')))); return; }
    done = busy(button, __('Sending…', 'bulk-sms-portal'));
    const r = await C.api('/funding/manual', { method: 'POST', body: JSON.stringify({
      amount_naira: v, depositor_name: depositor.value.trim(), bank_name: bank.bank || '', proof_attachment_id: up.attachment_id,
      note: [$('#bx-bankref', root).value.trim(), $('#bx-fnote', root).value.trim()].filter(Boolean).join(' — ')
    }) });
    done();
    if (r && r.ok) {
      payMsg('good', __('Thanks, we have your transfer', 'bulk-sms-portal'), `${sprintf(/* translators: %1$s, %2$s: values filled in when shown */ __('We will add %1$s once we have checked it. Reference %2$s.', 'bulk-sms-portal'), esc(naira(Math.round(v * 100))), esc(r.reference || ''))}`);
      proof.value = ''; $('[data-bx-proof-name]', root).textContent = __('Choose your receipt', 'bulk-sms-portal'); $('#bx-bankref', root).value = ''; $('#bx-fnote', root).value = '';
      loadRequests(1);
    } else payMsg('bad', __('Not sent', 'bulk-sms-portal'), esc(friendly(r, __('Please try again.', 'bulk-sms-portal'))));
  }

  async function loadRequests(p = 1) {
    const box = $('[data-bx-requests]', root);
    box.innerHTML = loading(__('Loading your payments…', 'bulk-sms-portal'));
    const r = await C.api('/funding/requests?page=' + p + '&per_page=5');
    if (!ctx.live()) return;
    if (!r || !r.ok) { box.innerHTML = `<div class="bx-panel">${note('bad', __('We could not load your payments', 'bulk-sms-portal'), esc(friendly(r)))}</div>`; return; }
    if (pageBack(r, p, loadRequests)) return;
    const items = r.items || [];
    if (!items.length) { box.innerHTML = `<div class="bx-list">${empty('receipt', __('No payments to show', 'bulk-sms-portal'), __('When you pay by bank transfer, you can follow it here until the money is added.', 'bulk-sms-portal'))}</div>`; return; }
    box.innerHTML = `<div class="bx-list">
      <div class="bx-tr is-head" style="--cols:1.2fr 1fr 1.4fr 150px"><span>${__('Amount', 'bulk-sms-portal')}</span><span>${__('Date', 'bulk-sms-portal')}</span><span>${__('Where it is', 'bulk-sms-portal')}</span><span></span></div>
      ${items.map(x => {
        const st = FUND_STATUS[String(x.status || 'pending').toLowerCase()] || ['info', String(x.status || '')];
        const online = String(x.method || '').indexOf('manual') === -1;
        return `<div class="bx-tr" style="--cols:1.2fr 1fr 1.4fr 150px">
          <span class="bx-td-main bx-td-lead" data-label="${esc(__('Amount', 'bulk-sms-portal'))}"><strong class="bx-num">${esc(naira(x.amount_kobo))}</strong><small>${online ? __('Online payment', 'bulk-sms-portal') : __('Bank transfer', 'bulk-sms-portal') + (x.bank_name ? ' to ' + esc(x.bank_name) : '')}</small></span>
          <span data-label="${esc(__('Date', 'bulk-sms-portal'))}">${esc(fmtDate(x.created_at))}</span>
          <span class="bx-td-main" data-label="${esc(__('Where it is', 'bulk-sms-portal'))}">${pill(st[0], st[1])}${x.status === 'rejected' && x.admin_note ? `<small>${esc(x.admin_note)}</small>` : ''}<small class="bx-mono">${esc(x.reference || '')}</small></span>
          <span class="bx-td-actions">${online && x.status === 'pending' ? btn(__('Check payment', 'bulk-sms-portal'), `data-bx-verify="${esc(x.reference)}" data-bx-provider="${esc(String(x.method || 'paystack').replace(/[^a-z0-9_-]/g, ''))}"`, 'is-small') : ''}</span>
        </div>`;
      }).join('')}
      ${pager({ page: r.page, total_pages: r.total_pages, total: r.total, per_page: r.per_page })}
    </div>`;
    bindPager(box, loadRequests);
    $$('[data-bx-verify]', box).forEach(b => b.onclick = async () => {
      const done = busy(b, __('Checking…', 'bulk-sms-portal'));
      const v = await C.api('/' + (b.dataset.bxProvider || 'paystack') + '/verify', { method: 'POST', body: JSON.stringify({ reference: b.dataset.bxVerify }) });
      done();
      if (v && v.ok) { toast(__('Payment confirmed. Your wallet has been updated.', 'bulk-sms-portal')); await C.load({ force: true }); loadRequests(p); paint(); }
      else toast(friendly(v, __('This payment is not confirmed yet.', 'bulk-sms-portal')), 'bad');
    });
  }
  $('[data-bx-refresh]', root).onclick = () => loadRequests(1);
  loadRequests(1);
});
