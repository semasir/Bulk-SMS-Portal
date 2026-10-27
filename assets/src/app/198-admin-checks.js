/* ==========================================================================
   System Checks
   ========================================================================== */
/* Plain names and where to fix each check. */
const CHECK_HELP = {
  'Database': [__('Database', 'bulk-sms-portal'), ''],
  'Cron': [__('Automatic background work', 'bulk-sms-portal'), __('If this is off, scheduled sends and result checks do not run. Ask your host to enable WordPress cron.', 'bulk-sms-portal')],
  'Frontend Admin': [__('Admin pages in the portal', 'bulk-sms-portal'), 'admin-settings'],
  'Payments': [__('Online payments', 'bulk-sms-portal'), 'admin-settings'],
  'Sender ID': [__('Shared sender name', 'bulk-sms-portal'), 'admin-senders'],
  'Provider APIs': [__('SMS services', 'bulk-sms-portal'), 'admin-apis'],
  'Delivery results': [__('Delivery results from SMS services', 'bulk-sms-portal'), 'admin-apis'],
  'Payment receipt privacy': [__('Payment receipts kept private', 'bulk-sms-portal'), ''],
  'Wallet balances match the ledger': [__('Wallet balances add up', 'bulk-sms-portal'), 'admin-users'],
  'Paystack keys are live': [__('Paystack keys', 'bulk-sms-portal'), 'admin-settings'],
  'Messages closed without confirmation (30 days)': [__('Messages charged without a result', 'bulk-sms-portal'), 'history'],
  'Online payments credited once': [__('Online payments added only once', 'bulk-sms-portal'), 'admin-credit']
};
const ACTIVITY_WORDS = { dlr_poll_ran: __('Checked delivery results', 'bulk-sms-portal'), platform_settings_saved: __('Changed platform settings', 'bulk-sms-portal') };
adminPage('admin-monitoring', 'System Checks', async (host, ctx) => {
  const root = mount(host, `${pageHead(__('System Checks', 'bulk-sms-portal'), __('Anything that could stop messages going out or payments coming in.', 'bulk-sms-portal'), btn(icon('refresh', 18) + __('Run checks again', 'bulk-sms-portal'), 'data-bx-rerun'))}<div data-bx-sc>${skeleton(8)}</div>`);
  $('[data-bx-rerun]', root).onclick = () => C.show('admin-monitoring', false);
  const [h, b, a, d] = await Promise.all([C.api('/admin/platform-health'), C.api('/admin/api-balances'), C.api('/admin/activity'), C.api('/admin/dlr/diagnostics')]);
  if (!ctx.live()) return;
  const box = $('[data-bx-sc]', root);
  const checks = (h && h.ok && h.checks) || [];
  const bad = checks.filter(c => c.status !== 'healthy');
  const svcs = (b && b.ok && b.items) || [];
  const acts = ((a && a.ok && a.items) || []).slice(0, 12);
  box.innerHTML = `
    ${h && h.ok ? (bad.length ? note('wait', `${sprintf(/* translators: %s: a value filled in when shown */ __('%s to look at', 'bulk-sms-portal'), sprintf(/* translators: %s: a number */ _n('%s thing', '%s things', Number(bad.length), 'bulk-sms-portal'), num(bad.length)))}`, `${sprintf(/* translators: %1$s, %2$s: values filled in when shown */ __('%1$s of %2$s checks are fine.', 'bulk-sms-portal'), checks.length - bad.length, checks.length)}`) : note('good', __('Everything checked is fine', 'bulk-sms-portal'), `${sprintf(/* translators: %s: a value filled in when shown */ __('All %s checks passed.', 'bulk-sms-portal'), checks.length)}`)) : note('bad', __('We could not run the checks', 'bulk-sms-portal'), esc(friendly(h)))}
    <section class="bx-section" aria-labelledby="bx-sc-list"><div class="bx-section-head"><h2 id="bx-sc-list">${__('Checks', 'bulk-sms-portal')}</h2></div>
      <div class="bx-list">${checks.map(c => { const help = CHECK_HELP[c.label] || [c.label, '']; const ok = c.status === 'healthy'; const fix = help[1] && /^[a-z-]+$/.test(help[1]) ? help[1] : ''; return `<div class="bx-tr" style="--cols:28px minmax(0,1fr) 150px"><span class="bx-tick-sm ${ok ? 'is-ok' : 'is-warn'}" aria-hidden="true">${icon(ok ? 'check' : 'alert', 16, 2.2)}</span><span class="bx-td-main bx-td-lead"><strong>${esc(help[0])}</strong><small>${esc(c.detail || '')}${!ok && help[1] && !fix ? ' ' + esc(help[1]) : ''}</small></span><span class="bx-td-actions">${!ok && fix ? btn(__('Fix this', 'bulk-sms-portal'), `data-bx-go="${fix}"`, 'is-small') : pill(ok ? 'good' : 'wait', ok ? __('Fine', 'bulk-sms-portal') : __('Look at this', 'bulk-sms-portal'))}</span></div>`; }).join('') || `<div class="bx-line-item bx-muted">${__('No checks returned.', 'bulk-sms-portal')}</div>`}</div></section>
    <div class="bx-section bx-split is-even">
      <section class="bx-panel is-flush" aria-labelledby="bx-sc-svc"><div class="bx-panel-head"><div><h2 id="bx-sc-svc">${__('SMS services', 'bulk-sms-portal')}</h2></div>${btn(__('Open SMS Services', 'bulk-sms-portal'), 'data-bx-go="admin-apis"', 'is-quiet is-small')}</div>
        <div class="bx-rows">${svcs.length ? svcs.map(s => { const bv = String(s.balance || '').trim(); const has = bv && !/not available/i.test(bv); return `<div class="bx-line-item"><div class="bx-td-main"><strong>${esc(s.name)}</strong><small>${Number(s.active) ? 'On' : __('Off', 'bulk-sms-portal')}${s.last_checked ? __(', checked ', 'bulk-sms-portal') + esc(fmtDate(s.last_checked)) : ''}</small></div><span>${has ? `<b class="bx-num">${esc(bv)}</b>` : `<span class="bx-muted">${__('Balance not shared', 'bulk-sms-portal')}</span>`}</span></div>`; }).join('') : `<div class="bx-line-item bx-muted">${__('No SMS service set up.', 'bulk-sms-portal')}</div>`}</div></section>
      <section class="bx-panel is-flush" aria-labelledby="bx-sc-dlr"><div class="bx-panel-head"><div><h2 id="bx-sc-dlr">${__('Delivery results', 'bulk-sms-portal')}</h2></div>${btn(icon('refresh', 16) + __('Check results now', 'bulk-sms-portal'), 'data-bx-sc-sync', 'is-small')}</div>
        ${d && d.ok ? `<dl class="bx-kv bx-pad">${[[__('Messages waiting for a result', 'bulk-sms-portal'), num(d.pending_dlr)], [__('Automatic checking', 'bulk-sms-portal'), d.cron_scheduled ? 'On' : __('Off', 'bulk-sms-portal')], [__('Last checked', 'bulk-sms-portal'), d.last_sync ? fmtDate(d.last_sync) : __('Not yet', 'bulk-sms-portal')], [__('Next check', 'bulk-sms-portal'), d.next_cron ? fmtDate(d.next_cron) : '—']].map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : `<p class="bx-line-item bx-muted">${__('Not available.', 'bulk-sms-portal')}</p>`}</section>
    </div>
    <div class="bx-section bx-split is-even">
      <section class="bx-panel is-flush" aria-labelledby="bx-sc-act"><div class="bx-panel-head"><div><h2 id="bx-sc-act">${__('Recent activity', 'bulk-sms-portal')}</h2><p>${__('Changes and background work, newest first.', 'bulk-sms-portal')}</p></div></div>
        <div class="bx-rows">${acts.length ? acts.map(x => `<div class="bx-line-item"><div class="bx-td-main"><strong>${esc(ACTIVITY_WORDS[x.action] || String(x.action || '').replace(/_/g, ' ').replace(/^\w/, m => m.toUpperCase()))}</strong><small>${esc(x.message || '')}</small></div><small class="bx-muted">${esc(fmtDate(x.created_at))}</small></div>`).join('') : `<div class="bx-line-item bx-muted">${__('No activity recorded.', 'bulk-sms-portal')}</div>`}</div></section>
      <section class="bx-panel" aria-labelledby="bx-sc-ver"><div class="bx-panel-head"><div><h2 id="bx-sc-ver">${__('Versions', 'bulk-sms-portal')}</h2><p>${__('Useful when you contact support.', 'bulk-sms-portal')}</p></div></div>
        <dl class="bx-kv">${[[__('This plugin', 'bulk-sms-portal'), h && h.version], ['WordPress', h && h.wordpress], ['PHP', h && h.php]].map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v || '—')}</dd></div>`).join('')}</dl></section>
    </div>`;
  bindGo(box);
  const sy = $('[data-bx-sc-sync]', box);
  if (sy) sy.onclick = async () => { const done = busy(sy, __('Checking…', 'bulk-sms-portal')); const r = await C.api('/admin/dlr/sync', { method: 'POST', body: '{}', timeout: 60000 }); done(); toast(r && r.ok ? __('Results checked.', 'bulk-sms-portal') : friendly(r, __('Results could not be checked.', 'bulk-sms-portal')), r && r.ok ? '' : 'bad'); C.show('admin-monitoring', false); };
});
