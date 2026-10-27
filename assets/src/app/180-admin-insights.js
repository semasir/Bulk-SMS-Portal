/* ==========================================================================
   Reports & Insights
   Message and money totals come from the same records the Delivery Reports
   and Wallet History pages use, for the same dates, so the numbers agree.
   ========================================================================== */
const adIn = { days: 30 };
adminPage('admin-analytics', 'Reports & Insights', async (host, ctx) => {
  const root = mount(host, `
    ${pageHead(__('Reports & Insights', 'bulk-sms-portal'), __('How sending and money are going across the platform, and who your busiest customers are.', 'bulk-sms-portal'))}
    <div class="bx-seg" role="group" aria-label="${esc(__('Period', 'bulk-sms-portal'))}">${[[7, __('Last 7 days', 'bulk-sms-portal')], [30, __('Last 30 days', 'bulk-sms-portal')], [90, __('Last 90 days', 'bulk-sms-portal')], [365, __('Last 12 months', 'bulk-sms-portal')]].map(([d, l]) => `<button type="button" data-bx-days="${d}" aria-pressed="${adIn.days === d ? 'true' : 'false'}">${l}</button>`).join('')}</div>
    <div data-bx-in class="bx-section">${skeleton(8)}</div>`);
  $$('[data-bx-days]', root).forEach(b => b.onclick = () => { adIn.days = Number(b.dataset.bxDays); C.show('admin-analytics', false); });
  const ins = await C.api('/records/insights?days=' + adIn.days);
  if (!ctx.live()) return;
  const box = $('[data-bx-in]', root);
  if (!ins || !ins.ok) { box.innerHTML = note('bad', __('We could not load reports', 'bulk-sms-portal'), esc(friendly(ins))); return; }
  const range = new URLSearchParams({ from: ins.from, to: ins.to, per_page: 1 });
  const [rep, wal] = await Promise.all([C.api('/records/reports?' + range), C.api('/records/wallet?' + range)]);
  if (!ctx.live()) return;
  const s = (rep && rep.ok && rep.summary) || {}, w = (wal && wal.ok && wal.summary) || {};
  const done = Number(s.successful || 0) + Number(s.failed || 0);
  const rate = done ? Math.round(100 * Number(s.successful || 0) / done) : 0;

  /* Group days into weeks or months for long periods, so the chart stays readable. */
  let series = ins.series || [];
  if (ins.days > 90) {
    const byMonth = {};
    series.forEach(x => { const k = x.date.slice(0, 7); byMonth[k] = byMonth[k] || { date: k + '-01', label: new Date(x.date + 'T00:00:00').toLocaleDateString('en-GB', { month: 'short' }), successful: 0, failed: 0, sending: 0 }; ['successful', 'failed', 'sending'].forEach(f => byMonth[k][f] += x[f]); });
    series = Object.values(byMonth);
  } else if (ins.days > 30) {
    const weeks = [];
    series.forEach((x, i) => { if (i % 7 === 0) weeks.push({ date: x.date, label: new Date(x.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), successful: 0, failed: 0, sending: 0 }); const wk = weeks[weeks.length - 1]; ['successful', 'failed', 'sending'].forEach(f => wk[f] += x[f]); });
    series = weeks;
  } else series = series.map(x => ({ ...x, label: new Date(x.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) }));
  const peak = Math.max(1, ...series.map(x => x.successful + x.failed + x.sending));
  const unit = ins.days > 90 ? 'month' : (ins.days > 30 ? 'week' : 'day');

  const list = (items, cols, headers, row, emptyText) => items.length
    ? `<div class="bx-list is-inset is-top"><div class="bx-tr is-head" style="--cols:${cols}">${headers.map((h, i) => `<span class="${i ? 'is-num' : ''}">${esc(h)}</span>`).join('')}</div>${items.map(x => `<div class="bx-tr" style="--cols:${cols}">${row(x)}</div>`).join('')}</div>`
    : `<div class="bx-line-item bx-muted">${esc(emptyText)}</div>`;

  box.innerHTML = `
    <section aria-labelledby="bx-in-msg"><div class="bx-section-head"><div><h2 id="bx-in-msg">${__('Messages', 'bulk-sms-portal')}</h2><p>${esc(fmtDate(ins.from, false))} to ${esc(fmtDate(ins.to, false))}</p></div>${btn(__('Open Delivery Reports', 'bulk-sms-portal'), 'data-bx-go="reports"', 'is-quiet is-small')}</div>
      <div class="bx-stats">${stat(__('Messages sent', 'bulk-sms-portal'), num(s.messages), { note: sprintf(/* translators: %s: a number */ _n('%s send', '%s sends', Number(s.sends), 'bulk-sms-portal'), num(s.sends)) })}${stat(__('Successful', 'bulk-sms-portal'), num(s.successful), { tone: 'good', note: rate + __('% of results', 'bulk-sms-portal') })}${stat(__('Failed', 'bulk-sms-portal'), num(s.failed), { tone: Number(s.failed) ? 'bad' : '' })}${stat(__('Customers who sent', 'bulk-sms-portal'), num(ins.active_customers), { note: `${sprintf(/* translators: %s: a value filled in when shown */ __('%s new sign-ups', 'bulk-sms-portal'), num(ins.new_customers))}` })}</div></section>
    <section class="bx-section" aria-labelledby="bx-in-money"><div class="bx-section-head"><h2 id="bx-in-money">${__('Money', 'bulk-sms-portal')}</h2>${btn(__('Open Wallet History', 'bulk-sms-portal'), 'data-bx-go="transactions"', 'is-quiet is-small')}</div>
      <div class="bx-stats">${stat(__('Money added by customers', 'bulk-sms-portal'), naira(w.added_kobo), { tone: 'good' })}${stat(__('Used for SMS', 'bulk-sms-portal'), naira(w.used_kobo))}${stat(__('Returned for failed messages', 'bulk-sms-portal'), naira(w.returned_kobo))}${stat(__('SMS income', 'bulk-sms-portal'), naira(w.net_sms_income_kobo), { note: __('Used minus returned', 'bulk-sms-portal') })}</div></section>
    <section class="bx-section bx-panel" aria-labelledby="bx-in-chart"><div class="bx-panel-head"><div><h2 id="bx-in-chart">${sprintf(/* translators: %s: a value filled in when shown */ __('Messages each %s', 'bulk-sms-portal'), unit)}</h2></div><span class="bx-legend"><span style="--c:var(--bx-good)">${__('Successful', 'bulk-sms-portal')}</span><span style="--c:var(--bx-bad)">${__('Failed', 'bulk-sms-portal')}</span><span style="--c:#d99a2b">${__('Sending', 'bulk-sms-portal')}</span></span></div>
      <div class="bx-chart" role="img" aria-label="${sprintf(/* translators: %s: a value filled in when shown */ esc(__('Messages each %s', 'bulk-sms-portal')), unit)}">${series.map(x => { const t = x.successful + x.failed + x.sending; return `<div class="bx-chart-col" title="${sprintf(/* translators: %1$s, %2$s, %3$s, %4$s: values filled in when shown */ esc(__('%1$s: %2$s messages, %3$s successful, %4$s failed', 'bulk-sms-portal')), esc(x.label), t, x.successful, x.failed)}"><div class="bx-chart-bar" style="--h:${(100 * t / peak).toFixed(1)}%"><i class="is-wait" style="--w:${t ? (100 * x.sending / t).toFixed(1) : 0}%"></i><i class="is-bad" style="--w:${t ? (100 * x.failed / t).toFixed(1) : 0}%"></i><i class="is-good" style="--w:${t ? (100 * x.successful / t).toFixed(1) : 0}%"></i></div><span>${esc(x.label)}</span></div>`; }).join('')}</div></section>
    <div class="bx-section bx-split is-even">
      <section class="bx-panel is-flush" aria-labelledby="bx-in-cust"><div class="bx-panel-head"><div><h2 id="bx-in-cust">${__('Busiest customers', 'bulk-sms-portal')}</h2><p>${__('By what they spent on SMS.', 'bulk-sms-portal')}</p></div></div>
        ${list(ins.top_customers || [], __('minmax(0,1.6fr) 0.8fr 0.8fr 1fr', 'bulk-sms-portal'), [__('Customer', 'bulk-sms-portal'), __('Messages', 'bulk-sms-portal'), __('Failed', 'bulk-sms-portal'), __('Spent', 'bulk-sms-portal')], x => `<span class="bx-td-main bx-td-lead"><strong>${esc(x.name || __('Customer #', 'bulk-sms-portal') + x.user_id)}</strong><small class="bx-break">${esc(x.email || '')}</small></span><span class="is-num" data-label="${esc(__('Messages', 'bulk-sms-portal'))}">${num(x.messages)}</span><span class="is-num" data-label="${esc(__('Failed', 'bulk-sms-portal'))}">${num(x.failed)}</span><span class="is-num" data-label="${esc(__('Spent', 'bulk-sms-portal'))}"><b>${esc(naira(x.spend_kobo))}</b></span>`, __('No sends in this period.', 'bulk-sms-portal'))}</section>
      <section class="bx-panel is-flush" aria-labelledby="bx-in-snd"><div class="bx-panel-head"><div><h2 id="bx-in-snd">${__('Most used sender names', 'bulk-sms-portal')}</h2></div></div>
        ${list(ins.top_senders || [], __('minmax(0,1.6fr) 0.8fr 0.8fr 0.8fr', 'bulk-sms-portal'), [__('Sender name', 'bulk-sms-portal'), __('Messages', 'bulk-sms-portal'), __('Successful', 'bulk-sms-portal'), __('Failed', 'bulk-sms-portal')], x => `<strong class="bx-td-lead">${esc(x.sender)}</strong><span class="is-num" data-label="${esc(__('Messages', 'bulk-sms-portal'))}">${num(x.messages)}</span><span class="is-num" data-label="${esc(__('Successful', 'bulk-sms-portal'))}">${num(x.successful)}</span><span class="is-num" data-label="${esc(__('Failed', 'bulk-sms-portal'))}">${num(x.failed)}</span>`, __('No sends in this period.', 'bulk-sms-portal'))}</section>
    </div>
    <section class="bx-section bx-panel is-flush" aria-labelledby="bx-in-svc"><div class="bx-panel-head"><div><h2 id="bx-in-svc">${__('SMS services', 'bulk-sms-portal')}</h2><p>${__('How each service you send through performed.', 'bulk-sms-portal')}</p></div>${btn(__('Open SMS Services', 'bulk-sms-portal'), 'data-bx-go="admin-apis"', 'is-quiet is-small')}</div>
      ${list(ins.services || [], __('minmax(0,1.6fr) 0.8fr 0.8fr 0.8fr 1.2fr', 'bulk-sms-portal'), [__('Service', 'bulk-sms-portal'), __('Messages', 'bulk-sms-portal'), __('Successful', 'bulk-sms-portal'), __('Failed', 'bulk-sms-portal'), __('Results', 'bulk-sms-portal')], x => { const d2 = x.successful + x.failed; const noDlr = x.successful > 0 && !x.delivered; return `<span class="bx-td-main bx-td-lead"><strong>${esc(x.name)}</strong>${noDlr && x.api_id ? `<small>${__('Sends no delivery results back, so its messages count as successful unless a failure is reported', 'bulk-sms-portal')}</small>` : ''}</span><span class="is-num" data-label="${esc(__('Messages', 'bulk-sms-portal'))}">${num(x.messages)}</span><span class="is-num" data-label="${esc(__('Successful', 'bulk-sms-portal'))}">${num(x.successful)}</span><span class="is-num" data-label="${esc(__('Failed', 'bulk-sms-portal'))}">${num(x.failed)}</span><span data-label="${esc(__('Results', 'bulk-sms-portal'))}">${bar([{ label: __('confirmed by the network', 'bulk-sms-portal'), value: x.delivered, tone: 'good' }, { label: __('no failure reported', 'bulk-sms-portal'), value: x.successful - x.delivered, tone: 'info' }, { label: 'failed', value: x.failed, tone: 'bad' }, { label: 'sending', value: x.sending, tone: 'wait' }])}<small class="bx-muted">${d2 ? Math.round(100 * x.successful / d2) + __('% successful', 'bulk-sms-portal') : '—'}</small></span>`; }, __('No sends in this period.', 'bulk-sms-portal'))}</section>`;
  bindGo(box);
});
