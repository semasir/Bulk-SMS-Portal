/* ==========================================================================
   Dashboard
   ========================================================================== */
page('dashboard', 'Dashboard', async (host, ctx) => {
  const st = S();
  const bal = balanceKobo();
  const senders = Array.isArray(st.approved_senders) ? st.approved_senders : [];
  const dm = st.delivery_metrics || {};
  const sentTotal = Number(dm.total || st.sent || 0);
  const name = firstName();
  const canSend = canUse('compose_sms');
  const canBuy = canUse('buy_sms');

  const steps = [
    { done: bal > 0, title: __('Add money to your wallet', 'bulk-sms-portal'), text: __('Pay online or by bank transfer.', 'bulk-sms-portal'), go: 'fund', action: __('Buy SMS', 'bulk-sms-portal'), show: canBuy },
    { done: senders.length > 0, title: __('Get your sender name approved', 'bulk-sms-portal'), text: __('The name people see when you text them.', 'bulk-sms-portal'), go: 'sender', action: __('Ask for a name', 'bulk-sms-portal'), show: canUse('sender_ids') },
    { done: sentTotal > 0, title: __('Send your first message', 'bulk-sms-portal'), text: __('Try one number first to see how it looks.', 'bulk-sms-portal'), go: 'compose', action: __('Send SMS', 'bulk-sms-portal'), show: canSend }
  ].filter(s => s.show);
  const setupLeft = steps.filter(s => !s.done).length;

  const root = mount(host, `
    ${pageHead(name ? `${greeting()}, ${name}` : greeting(), isAdmin() ? __('Your own account is below. Message History, Delivery Reports and Wallet History show every customer.', 'bulk-sms-portal') : __('Here is your account at a glance.', 'bulk-sms-portal'), adminBtn(__('Admin dashboard', 'bulk-sms-portal'), 'admin-dashboard'))}
    <section class="bx-balance" aria-label="${esc(__('Wallet', 'bulk-sms-portal'))}">
      <div>
        <span class="bx-balance-label">${__('Wallet balance', 'bulk-sms-portal')}</span>
        <span class="bx-balance-amount">${esc(naira(bal))}</span>
        <span class="bx-balance-note" data-bx-about>&nbsp;</span>
      </div>
      <div class="bx-row-flex">
        ${canSend ? btn(icon('send', 18) + __('Send SMS', 'bulk-sms-portal'), 'data-bx-go="compose"', 'is-primary is-large') : ''}
        ${canBuy ? btn(__('Buy SMS', 'bulk-sms-portal'), 'data-bx-go="fund"', 'is-large') : ''}
      </div>
    </section>
    ${setupLeft ? `<section class="bx-section"><div class="bx-panel">
      <div class="bx-panel-head"><div><h2>${__('Get ready to send', 'bulk-sms-portal')}</h2><p>${setupLeft === 1 ? __('One thing left to do.', 'bulk-sms-portal') : `${sprintf(/* translators: %s: a value filled in when shown */ __('%s things left to do.', 'bulk-sms-portal'), setupLeft)}`}</p></div></div>
      <ol class="bx-checklist">${steps.map(s => `<li class="${s.done ? 'is-done' : ''}"><span class="bx-tick">${icon('check', 16, 2.4)}</span><div><span class="bx-check-title">${esc(s.title)}</span><p class="bx-small bx-muted">${esc(s.text)}</p></div>${s.done ? `<span class="bx-small bx-muted">${__('Done', 'bulk-sms-portal')}</span>` : btn(esc(s.action), `data-bx-go="${s.go}"`, 'is-small')}</li>`).join('')}</ol>
    </div></section>` : ''}
    <section class="bx-section">
      <div class="bx-section-head"><h2>${__('Your messages so far', 'bulk-sms-portal')}</h2></div>
      <div class="bx-stats" data-bx-dash-stats>
        ${stat(__('Messages sent', 'bulk-sms-portal'), num(sentTotal))}
        ${stat(__('Successful', 'bulk-sms-portal'), num(dm.successful ?? dm.delivered ?? 0), { tone: 'good' })}
        ${stat(__('Failed', 'bulk-sms-portal'), num(dm.failed || 0), { tone: Number(dm.failed) ? 'bad' : '', note: Number(dm.failed) ? __('Their charges were returned', 'bulk-sms-portal') : '' })}
        ${stat(__('Sender names ready', 'bulk-sms-portal'), num(senders.length), { note: senders.length ? senders.slice(0, 2).join(', ') + (senders.length > 2 ? '…' : '') : __('None yet', 'bulk-sms-portal') })}
      </div>
    </section>
    <div class="bx-section bx-split">
      <section class="bx-panel is-flush" aria-labelledby="bx-dash-sends">
        <div class="bx-panel-head"><div><h2 id="bx-dash-sends">${__('Recent sends', 'bulk-sms-portal')}</h2><p>${__('Each time you send, with how many were successful.', 'bulk-sms-portal')}</p></div>${btn(__('See all', 'bulk-sms-portal'), 'data-bx-go="reports"', 'is-quiet is-small')}</div>
        <div data-bx-sends>${skeleton(4)}</div>
      </section>
      <section class="bx-panel is-flush" aria-labelledby="bx-dash-money">
        <div class="bx-panel-head"><div><h2 id="bx-dash-money">${__('Recent money', 'bulk-sms-portal')}</h2><p>${__('Money in and out of your wallet.', 'bulk-sms-portal')}</p></div>${btn(__('See all', 'bulk-sms-portal'), 'data-bx-go="transactions"', 'is-quiet is-small')}</div>
        <div data-bx-money>${skeleton(3)}</div>
      </section>
    </div>`);
  bindGo(root);

  aboutMessages(bal).then(a => {
    const el = $('[data-bx-about]', root); if (!el) return;
    el.textContent = a ? (a.count > 0 ? `${sprintf(/* translators: %1$s, %2$s: values filled in when shown */ __('Enough for about %1$s to Nigerian numbers, at %2$s each.', 'bulk-sms-portal'), sprintf(/* translators: %s: a number */ _n('%s one-page SMS', '%s one-page SMS', Number(a.count), 'bulk-sms-portal'), num(a.count)), naira(a.charge))}` : __('Add money to start sending.', 'bulk-sms-portal')) : '';
  });

  const own = isAdmin() && CFG.userId ? '&customer=' + encodeURIComponent(CFG.userId) : '';
  const [rep, wal] = await Promise.all([
    C.api('/records/reports?page=1&per_page=5' + own),
    C.api('/records/wallet?page=1&per_page=5' + own)
  ]);
  if (!ctx.live()) return;
  const sendsEl = $('[data-bx-sends]', root), moneyEl = $('[data-bx-money]', root);
  // Use the same totals as Delivery Reports so both pages always agree.
  if (rep && rep.ok && rep.summary) {
    const sm = rep.summary;
    $('[data-bx-dash-stats]', root).innerHTML = stat(__('Messages sent', 'bulk-sms-portal'), num(sm.messages), { note: Number(sm.sending) ? `${sprintf(/* translators: %s: a value filled in when shown */ __('%s still sending', 'bulk-sms-portal'), num(sm.sending))}` : '' })
      + stat(__('Successful', 'bulk-sms-portal'), num(sm.successful || 0), { tone: 'good' })
      + stat(__('Failed', 'bulk-sms-portal'), num(sm.failed), { tone: Number(sm.failed) ? 'bad' : '', note: Number(sm.failed) ? __('Their charges were returned', 'bulk-sms-portal') : '' })
      + stat(__('Sender names ready', 'bulk-sms-portal'), num(senders.length), { note: senders.length ? senders.slice(0, 2).join(', ') + (senders.length > 2 ? '…' : '') : __('None yet', 'bulk-sms-portal') });
  }
  const items = (rep && rep.ok && rep.items) || [];
  sendsEl.innerHTML = !rep || !rep.ok ? `<div class="bx-empty"><p>${esc(friendly(rep, __('We could not load your recent sends.', 'bulk-sms-portal')))}</p></div>`
    : !items.length ? empty('send', __('No messages yet', 'bulk-sms-portal'), __('When you send SMS, each send shows here with its results.', 'bulk-sms-portal'), canSend ? btn(__('Send SMS', 'bulk-sms-portal'), 'data-bx-go="compose"', 'is-primary') : '')
    : `<div class="bx-rows">${items.map(x => `<button type="button" class="bx-line-item is-send" data-bx-report="${esc(x.id)}">
        <div class="bx-td-main"><strong>${esc(x.name || __('Send', 'bulk-sms-portal'))}</strong><small>${esc(x.date || '')}${x.sender ? __(', from ', 'bulk-sms-portal') + esc(x.sender) : ''}</small></div>
        <div class="bx-td-main bx-td-bar">${bar([{ label: 'successful', value: x.successful, tone: 'good' }, { label: 'failed', value: x.failed, tone: 'bad' }, { label: 'sending', value: x.sending, tone: 'wait' }])}<small>${sprintf(/* translators: %1$s, %2$s, %3$s: values filled in when shown */ __('%1$s of %2$s successful%3$s', 'bulk-sms-portal'), num(x.successful), sprintf(/* translators: %s: a number */ _n('%s message', '%s messages', Number(x.messages), 'bulk-sms-portal'), num(x.messages)), x.failed ? `${sprintf(/* translators: %s: a value filled in when shown */ __(', %s failed', 'bulk-sms-portal'), num(x.failed))}` : '')}</small></div>
        <strong class="bx-num">${esc(naira(x.cost_kobo))}</strong></button>`).join('')}</div>`;
  $$('[data-bx-report]', sendsEl).forEach(b => b.onclick = () => APP.openReport(b.dataset.bxReport));
  bindGo(sendsEl);
  const wItems = (wal && wal.ok && wal.items) || [];
  moneyEl.innerHTML = !wal || !wal.ok ? `<div class="bx-empty"><p>${esc(friendly(wal, __('We could not load your wallet activity.', 'bulk-sms-portal')))}</p></div>`
    : !wItems.length ? empty('wallet', __('No money activity yet', 'bulk-sms-portal'), __('Payments and SMS charges will show here.', 'bulk-sms-portal'))
    : `<div class="bx-rows">${wItems.map(x => `<div class="bx-line-item"><div class="bx-td-main"><strong>${esc(x.title)}</strong><small>${esc(x.date || '')}</small></div><strong class="bx-num ${x.amount_kobo > 0 ? 'is-good' : ''}">${esc(naira(x.amount_kobo, { plus: true }))}</strong></div>`).join('')}</div>`;
});
