/* ==========================================================================
   v3.6.1 — More admin tools: Setup Guide and Activity Log. Each runs in the
   portal and in WordPress admin (same page, same data). Add-ons register more
   tools through window.BSMS_KIT (see the end of the built portal-app.js).
   ========================================================================== */
const toolBack = () => btn(icon('arrowLeft', 16) + __('Admin Dashboard', 'bulk-sms-portal'), 'data-bx-go="admin-dashboard"', 'is-quiet is-small');

/* ---- Setup Guide -------------------------------------------------------- */
adminPage('admin-setup', 'Setup Guide', async (host, ctx) => {
  const root = mount(host, `${toolBack()}${pageHead(__('Setup Guide', 'bulk-sms-portal'), __('The things to set up before customers can sign in, pay and send. Each step opens the page where you do it.', 'bulk-sms-portal'))}<div data-bx-su>${skeleton(6)}</div>`);
  bindGo(root);
  const r = await C.api('/admin/setup');
  if (!ctx.live()) return;
  const box = $('[data-bx-su]', root);
  if (!r || !r.ok) { box.innerHTML = note('bad', __('We could not check your setup', 'bulk-sms-portal'), esc(friendly(r))); return; }
  const left = r.total - r.done;
  box.innerHTML = `
    ${left ? note('wait', `${sprintf(/* translators: %s: a number */ _n('%s step', '%s steps', Number(left), 'bulk-sms-portal'), num(left))} left`, `${sprintf(/* translators: %1$s, %2$s: values filled in when shown */ __('%1$s of %2$s done.', 'bulk-sms-portal'), num(r.done), num(r.total))}`) : note('good', __('Everything is set up', 'bulk-sms-portal'), __('Customers can sign in, pay and send.', 'bulk-sms-portal'))}
    <section class="bx-section bx-panel"><ol class="bx-checklist">${r.steps.map((s, i) => `<li class="${s.done ? 'is-ok' : ''}"><span class="bx-tick${s.done ? '' : ' bx-tick-num'}">${s.done ? icon('check', 16, 2.4) : i + 1}</span><div><span class="bx-check-title">${esc(s.title)}</span><p class="bx-small bx-muted">${esc(s.text)}</p></div>${s.url ? `<a class="bx-btn is-small${s.done ? '' : ' is-primary'}" href="${esc(s.url)}"${s.done ? ' target="_blank" rel="noopener"' : ''}>${s.done ? __('Open', 'bulk-sms-portal') : __('Set up', 'bulk-sms-portal')}</a>` : btn(s.done ? __('Change', 'bulk-sms-portal') : __('Set up', 'bulk-sms-portal'), `data-bx-su-go="${esc(s.page)}" data-tab="${esc(s.tab || '')}"`, 'is-small' + (s.done ? '' : ' is-primary'))}</li>`).join('')}</ol></section>`;
  $$('[data-bx-su-go]', box).forEach(b => b.onclick = () => goTab(b.dataset.bxSuGo, b.dataset.tab));
});

/* ---- Activity Log ------------------------------------------------------- */
const adAct = { tab: 'admin', q: '', status: '', channel: '' };
adminPage('admin-activity', 'Activity Log', async (host, ctx) => {
  const fromHash = tabFromHash(['admin', 'notifications']); if (fromHash) adAct.tab = fromHash;
  const root = mount(host, `${toolBack()}${pageHead(__('Activity Log', 'bulk-sms-portal'), __('A record of changes made on the platform, and of every alert sent to customers by email or SMS.', 'bulk-sms-portal'))}
    ${tabs([['admin', __('Changes and sign-ins', 'bulk-sms-portal')], ['notifications', __('Alerts sent to customers', 'bulk-sms-portal')]], adAct.tab)}
    <form class="bx-filters bx-mt-m" role="search" data-bx-act-form>
      <div class="bx-field"><label class="bx-label" for="bx-act-q">${__('Search', 'bulk-sms-portal')}</label><input id="bx-act-q" class="bx-input" type="search" value="${esc(adAct.q)}" placeholder="${adAct.tab === 'admin' ? __('What happened, who, or an internet address', 'bulk-sms-portal') : __('Subject, message or customer', 'bulk-sms-portal')}"></div>
      ${adAct.tab === 'notifications' ? fieldHtml('bx-act-st', __('Result', 'bulk-sms-portal'), adAct.status, { options: [['', __('Any result', 'bulk-sms-portal')], ['sent', __('Sent', 'bulk-sms-portal')], ['failed', __('Not sent', 'bulk-sms-portal')], ['queued', __('Waiting', 'bulk-sms-portal')], ['skipped', __('Skipped', 'bulk-sms-portal')]] }) + fieldHtml('bx-act-ch', __('Sent by', 'bulk-sms-portal'), adAct.channel, { options: [['', __('Email or SMS', 'bulk-sms-portal')], ['email', __('Email', 'bulk-sms-portal')], ['sms', 'SMS']] }) : ''}
      <div class="bx-filter-actions"><button type="submit" class="bx-btn is-primary">${sprintf(/* translators: %s: a value filled in when shown */ __('%sSearch', 'bulk-sms-portal'), icon('search', 18))}</button></div>
    </form>
    <div data-bx-act>${loading()}</div>`);
  bindGo(root);
  $$('[data-bx-tab]', root).forEach(b => b.onclick = () => { adAct.tab = b.dataset.bxTab; adAct.q = ''; C.show('admin-activity', false); });
  const form = $('[data-bx-act-form]', root);
  form.onsubmit = (e) => { e.preventDefault(); adAct.q = val(root, 'bx-act-q').trim(); adAct.status = val(root, 'bx-act-st') || ''; adAct.channel = val(root, 'bx-act-ch') || ''; load(1); };
  $$('select', form).forEach(s => s.onchange = () => form.requestSubmit());
  async function load(pg) {
    const box = $('[data-bx-act]', root);
    box.innerHTML = loading();
    const q = new URLSearchParams({ page: pg, per_page: 30 });
    if (adAct.q) q.set('search', adAct.q);
    if (adAct.tab === 'notifications') { if (adAct.status) q.set('status', adAct.status); if (adAct.channel) q.set('channel', adAct.channel); }
    const r = await C.api((adAct.tab === 'admin' ? '/admin/activity-log?' : '/admin/notification-log?') + q);
    if (!ctx.live()) return;
    if (!r || !r.ok) { box.innerHTML = note('bad', __('We could not load the log', 'bulk-sms-portal'), esc(friendly(r))); return; }
    if (pageBack(r, pg, load)) return;
    const items = r.items || [];
    if (!items.length) { box.innerHTML = `<div class="bx-list">${empty('list', __('Nothing found', 'bulk-sms-portal'), adAct.q ? __('Try a different search.', 'bulk-sms-portal') : __('Entries will appear here as things happen.', 'bulk-sms-portal'))}</div>`; return; }
    if (adAct.tab === 'admin') {
      const cols = '1fr 1.1fr 2.6fr 0.9fr';
      box.innerHTML = `<div class="bx-list"><div class="bx-tr is-head" style="--cols:${cols}"><span>${__('When', 'bulk-sms-portal')}</span><span>${__('Who', 'bulk-sms-portal')}</span><span>${__('What happened', 'bulk-sms-portal')}</span><span>${__('From', 'bulk-sms-portal')}</span></div>
        ${items.map(x => `<div class="bx-tr" style="--cols:${cols}"><span data-label="${esc(__('When', 'bulk-sms-portal'))}">${esc(fmtDate(x.date))}</span><span class="bx-td-main" data-label="${esc(__('Who', 'bulk-sms-portal'))}"><strong>${esc(x.by)}</strong>${x.about && x.about !== x.by ? `<small>${sprintf(/* translators: %s: a value filled in when shown */ __('About %s', 'bulk-sms-portal'), esc(x.about))}</small>` : ''}</span><span class="bx-td-main bx-td-lead" data-label="${esc(__('What happened', 'bulk-sms-portal'))}"><span class="bx-break">${esc(x.message)}</span></span><span class="bx-mono bx-small" data-label="${esc(__('From', 'bulk-sms-portal'))}">${esc(x.ip || '—')}</span></div>`).join('')}
        ${pager(r)}</div>`;
    } else {
      const cols = '1fr 1.2fr 2.4fr 0.7fr 0.8fr';
      const tone = { sent: ['good', __('Sent', 'bulk-sms-portal')], failed: ['bad', __('Not sent', 'bulk-sms-portal')], queued: ['wait', __('Waiting', 'bulk-sms-portal')], skipped: ['info', __('Skipped', 'bulk-sms-portal')] };
      box.innerHTML = `<div class="bx-list"><div class="bx-tr is-head" style="--cols:${cols}"><span>${__('When', 'bulk-sms-portal')}</span><span>${__('Customer', 'bulk-sms-portal')}</span><span>${__('Alert', 'bulk-sms-portal')}</span><span>By</span><span>${__('Result', 'bulk-sms-portal')}</span></div>
        ${items.map(x => { const t = tone[x.status] || ['info', x.status]; return `<div class="bx-tr" style="--cols:${cols}"><span data-label="${esc(__('When', 'bulk-sms-portal'))}">${esc(fmtDate(x.date))}</span><span class="bx-td-main" data-label="${esc(__('Customer', 'bulk-sms-portal'))}"><strong>${esc(x.customer.name)}</strong><small class="bx-break">${esc(x.customer.email)}</small></span><span class="bx-td-main bx-td-lead" data-label="${esc(__('Alert', 'bulk-sms-portal'))}"><strong>${esc(x.subject || __('Alert', 'bulk-sms-portal'))}</strong><small class="bx-clip">${esc(x.message)}</small></span><span data-label="By">${x.channel === 'sms' ? 'SMS' : __('Email', 'bulk-sms-portal')}${x.cost_kobo ? `<small class="bx-muted"> ${esc(naira(x.cost_kobo))}</small>` : ''}</span><span data-label="${esc(__('Result', 'bulk-sms-portal'))}">${pill(t[0], t[1])}</span></div>`; }).join('')}
        ${pager(r)}</div>`;
    }
    bindPager(box, load);
  }
  load(1);
});
