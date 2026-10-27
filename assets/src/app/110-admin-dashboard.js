/* ==========================================================================
   Admin Dashboard
   ========================================================================== */
const ADMIN_AREAS = [
  ['admin-users', 'people', __('Users & Wallets', 'bulk-sms-portal'), __('Customer accounts, wallets and what each customer can use', 'bulk-sms-portal')],
  ['admin-credit', 'receipt', __('Payments', 'bulk-sms-portal'), __('Check bank transfers and online payments', 'bulk-sms-portal')],
  ['admin-senders', 'badge', __('Sender ID Manager', 'bulk-sms-portal'), __('Approve or decline sender names', 'bulk-sms-portal')],
  ['admin-broadcast', 'bell', __('Customer Notices', 'bulk-sms-portal'), __('Tell customers about news, changes and offers', 'bulk-sms-portal')],
  ['admin-pricing', 'tag', __('Pricing Manager', 'bulk-sms-portal'), __('Price per SMS page and network exceptions', 'bulk-sms-portal')],
  ['admin-apis', 'plug', __('SMS Services', 'bulk-sms-portal'), __('The services that deliver your messages', 'bulk-sms-portal')],
  ['admin-analytics', 'chart', __('Reports & Insights', 'bulk-sms-portal'), __('How sending and money are going over time', 'bulk-sms-portal')],
  ['admin-help', 'help', __('Help Content', 'bulk-sms-portal'), __('Questions and guides customers see in the Help Centre', 'bulk-sms-portal')],
  ['admin-settings', 'gear', __('Platform Settings', 'bulk-sms-portal'), __('Brand, payments, bank accounts, sign-in and features', 'bulk-sms-portal')],
  ['admin-monitoring', 'pulse', __('System Checks', 'bulk-sms-portal'), __('Find anything that could stop sending or payments', 'bulk-sms-portal')]
];
adminPage('admin-dashboard', 'Admin Dashboard', async (host, ctx) => {
  const root = mount(host, `${pageHead(__('Admin Dashboard', 'bulk-sms-portal'), __('What needs your attention, and how sending and money are going today.', 'bulk-sms-portal'), btn(icon('people', 18) + __('Add or remove money', 'bulk-sms-portal'), 'data-bx-wallet'))}<div data-bx-ad>${skeleton(6)}</div>`);
  $('[data-bx-wallet]', root).onclick = () => walletDialog(null, () => C.show('admin-dashboard', false));
  const [r, h, b, su] = await Promise.all([adSummary(true), C.api('/admin/platform-health'), C.api('/admin/api-balances'), C.api('/admin/setup')]);
  if (!ctx.live()) return;
  const box = $('[data-bx-ad]', root);
  if (!r || !r.ok) { box.innerHTML = note('bad', __('We could not load the dashboard', 'bulk-sms-portal'), esc(friendly(r))); return; }
  const checks = (h && h.ok && h.checks) || [];
  const warnings = checks.filter(c => c.status !== 'healthy');
  const attention = [
    ['admin-credit', 'receipt', __('Payments to check', 'bulk-sms-portal'), Number(r.pending_funding || 0), __('Bank transfers waiting for you', 'bulk-sms-portal')],
    ['admin-senders', 'badge', __('Sender names to review', 'bulk-sms-portal'), Number(r.pending_senders || 0), __('Customers waiting for a decision', 'bulk-sms-portal')],
    ['failed', 'alert', __('Failed today', 'bulk-sms-portal'), Number(r.failed_today || 0), __('Their charges were returned automatically', 'bulk-sms-portal')],
    ['admin-monitoring', 'pulse', __('System checks to look at', 'bulk-sms-portal'), warnings.length, warnings.length ? warnings[0].label : __('Everything checked is fine', 'bulk-sms-portal')]
  ];
  const services = (b && b.ok && b.items) || [];
  const setupLeft = su && su.ok ? su.total - su.done : 0;
  box.innerHTML = `
    ${setupLeft ? `<div class="bx-section bx-mt-0">${note('wait', `${sprintf(/* translators: %s: a value filled in when shown */ __('Finish setting up: %s left', 'bulk-sms-portal'), sprintf(/* translators: %s: a number */ _n('%s step', '%s steps', Number(setupLeft), 'bulk-sms-portal'), num(setupLeft)))}`, __('Customers may not be able to send or pay until these are done.', 'bulk-sms-portal'), btn(__('Open the Setup Guide', 'bulk-sms-portal'), 'data-bx-go="admin-setup"', 'is-small is-primary'))}</div>` : ''}
    <section aria-labelledby="bx-ad-att"${setupLeft ? ' class="bx-section"' : ''}>
      <div class="bx-section-head"><h2 id="bx-ad-att">${__('Needs your attention', 'bulk-sms-portal')}</h2></div>
      <div class="bx-grid" style="--min:220px">${attention.map(([p, ic, label, n, sub]) => `<button type="button" class="bx-tile${n ? ' is-alert' : ''}" data-bx-att="${p}">${icon(ic, 22)}<span class="bx-stat-value">${num(n)}</span><strong>${esc(label)}</strong><span>${esc(sub)}</span></button>`).join('')}</div>
    </section>
    <section class="bx-section" aria-labelledby="bx-ad-today">
      <div class="bx-section-head"><div><h2 id="bx-ad-today">${__('Today', 'bulk-sms-portal')}</h2><p>${__('All customers, since midnight.', 'bulk-sms-portal')}</p></div>${btn(__('See Delivery Reports', 'bulk-sms-portal'), 'data-bx-go="reports"', 'is-quiet is-small')}</div>
      <div class="bx-stats">
        ${stat(__('Messages sent', 'bulk-sms-portal'), num(r.submitted_today), { note: sprintf(/* translators: %s: a number */ _n('%s send', '%s sends', Number(r.campaigns_today), 'bulk-sms-portal'), num(r.campaigns_today)) })}
        ${stat(__('Successful', 'bulk-sms-portal'), num(r.successful_today), { tone: 'good', note: (Number(r.successful_submission_rate || 0)) + __('% of results', 'bulk-sms-portal') })}
        ${stat(__('Failed', 'bulk-sms-portal'), num(r.failed_today), { tone: Number(r.failed_today) ? 'bad' : '' })}
        ${stat(__('Money used', 'bulk-sms-portal'), naira(r.charged_today_kobo))}
        ${stat(__('Money returned', 'bulk-sms-portal'), naira(r.refunds_today_kobo), { note: sprintf(/* translators: %s: a number */ _n('%s failed message', '%s failed messages', Number(r.refunds_today), 'bulk-sms-portal'), num(r.refunds_today)) })}
        ${stat(__('SMS income', 'bulk-sms-portal'), naira(r.net_sms_revenue_today_kobo), { note: __('Used minus returned', 'bulk-sms-portal') })}
      </div>
    </section>
    <div class="bx-section bx-split">
      <section class="bx-panel is-flush" aria-labelledby="bx-ad-cust">
        <div class="bx-panel-head"><div><h2 id="bx-ad-cust">${__('Customers and wallets', 'bulk-sms-portal')}</h2></div>${btn(__('Open Users & Wallets', 'bulk-sms-portal'), 'data-bx-go="admin-users"', 'is-quiet is-small')}</div>
        <div class="bx-stats is-inset">
          ${stat(__('Customers', 'bulk-sms-portal'), num(r.users), { note: `${num(r.active_users)} active` })}
          ${stat(__('Suspended', 'bulk-sms-portal'), num(r.suspended_users), { tone: Number(r.suspended_users) ? 'wait' : '' })}
          ${stat(__('Money in customer wallets', 'bulk-sms-portal'), naira(r.total_sms_wallet_kobo))}
        </div>
      </section>
      <section class="bx-panel is-flush" aria-labelledby="bx-ad-svc">
        <div class="bx-panel-head"><div><h2 id="bx-ad-svc">${__('SMS services', 'bulk-sms-portal')}</h2><p>${__('Balance left with each service you send through.', 'bulk-sms-portal')}</p></div>${btn(icon('refresh', 16) + __('Check again', 'bulk-sms-portal'), 'data-bx-refresh', 'is-quiet is-small')}</div>
        <div class="bx-rows">${services.length ? services.map(s => { const bal = String(s.balance || '').trim(); const has = bal && !/not available/i.test(bal); return `<div class="bx-line-item"><div class="bx-td-main"><strong>${esc(s.name || __('SMS service', 'bulk-sms-portal'))}</strong><small>${Number(s.active) ? 'On' : __('Off', 'bulk-sms-portal')}, ${esc(routeWords(s.route))}</small></div><strong class="bx-num">${has ? esc(bal) : `<span class="bx-muted">${__('Balance not shared', 'bulk-sms-portal')}</span>`}</strong></div>`; }).join('') : `<div class="bx-line-item">${empty('plug', __('No SMS service yet', 'bulk-sms-portal'), __('Add the service you send through so messages can go out.', 'bulk-sms-portal'), btn(__('Add an SMS service', 'bulk-sms-portal'), 'data-bx-go="admin-apis"', 'is-primary is-small'))}</div>`}</div>
      </section>
    </div>
    <section class="bx-section" aria-labelledby="bx-ad-areas">
      <div class="bx-section-head"><h2 id="bx-ad-areas">${__('Run the platform', 'bulk-sms-portal')}</h2></div>
      <div class="bx-grid" style="--min:250px">${ADMIN_AREAS.map(([p, ic, t, d]) => `<button type="button" class="bx-tile" data-bx-go="${p}">${icon(ic, 22)}<strong>${esc(t)}</strong><span>${esc(d)}</span></button>`).join('')}</div>
    </section>
    <section class="bx-section" aria-labelledby="bx-ad-more">
      <div class="bx-section-head"><h2 id="bx-ad-more">${__('More tools', 'bulk-sms-portal')}</h2></div>
      <div class="bx-rows">${ADMIN_MORE.map(([p, ic, t, d]) => `<button type="button" class="bx-line-item" data-bx-go="${p}"><div class="bx-row-flex is-nowrap">${icon(ic, 20)}<div class="bx-td-main"><strong>${esc(t)}</strong><small>${esc(d)}</small></div></div>${icon('chev', 18)}</button>`).join('')}</div>
    </section>`;
  bindGo(box);
  $$('[data-bx-att]', box).forEach(bt => bt.onclick = () => bt.dataset.bxAtt === 'failed' ? APP.openMessages('', 'failed') : go(bt.dataset.bxAtt));
  const rf = $('[data-bx-refresh]', box); if (rf) rf.onclick = () => C.show('admin-dashboard', false);
});
function routeWords(r) {
  const k = String(r || '').toLowerCase();
  if (k === 'dnd' || k === 'premium') return __('Do Not Disturb numbers', 'bulk-sms-portal');
  if (k === 'international' || k === 'intl') return __('numbers outside Nigeria', 'bulk-sms-portal');
  return 'standard messages';
}
