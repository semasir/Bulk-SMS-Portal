/* ==========================================================================
   Message History, Delivery Reports, Wallet History
   One shared layout. Admins see every customer (with a Customer column);
   customers see only their own records. Filters run on the server.
   ========================================================================== */
const REC = { messages: { f: {}, page: 1 }, reports: { f: {}, page: 1 }, wallet: { f: {}, page: 1 } };
/* Opened from WordPress admin with #campaign=…&status=… in the address. */
function filtersFromHash(key) {
  try {
    const h = new URLSearchParams(String(location.hash || '').replace(/^#/, ''));
    if (!h.has('campaign') && !h.has('status')) return;
    const f = {};
    if (h.get('campaign')) f.campaign = h.get('campaign');
    if (h.get('status')) f.status = h.get('status');
    REC[key].f = f; REC[key].page = 1;
    history.replaceState(null, '', location.pathname + location.search);
  } catch (e) {}
}
const PERIODS = [['', __('Any time', 'bulk-sms-portal')], ['today', __('Today', 'bulk-sms-portal')], ['7', __('Last 7 days', 'bulk-sms-portal')], ['30', __('Last 30 days', 'bulk-sms-portal')], ['month', __('This month', 'bulk-sms-portal')], ['custom', __('Choose dates', 'bulk-sms-portal')]];

APP.openReport = function (campaignId) {
  if (!document.getElementById('bsms-page-reports') && pageUrl('reports')) { location.href = pageUrl('reports') + (campaignId ? '#campaign=' + encodeURIComponent(campaignId) : ''); return; }
  REC.reports.f = campaignId ? { campaign: String(campaignId) } : {}; REC.reports.page = 1; go('reports');
};
APP.openMessages = function (campaignId, status) {
  if (!document.getElementById('bsms-page-history') && pageUrl('history')) { location.href = pageUrl('history') + '#' + new URLSearchParams({ campaign: campaignId || '', status: status || '' }); return; }
  REC.messages.f = {}; if (campaignId) REC.messages.f.campaign = String(campaignId); if (status) REC.messages.f.status = status; REC.messages.page = 1; go('history');
};

function ymd(d) { const p = x => String(x).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
function periodRange(p) {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const back = n => { const d = new Date(t); d.setDate(d.getDate() - n); return d; };
  if (p === 'today') return { from: ymd(t), to: ymd(t) };
  if (p === '7') return { from: ymd(back(6)), to: ymd(t) };
  if (p === '30') return { from: ymd(back(29)), to: ymd(t) };
  if (p === 'month') return { from: ymd(new Date(t.getFullYear(), t.getMonth(), 1)), to: ymd(t) };
  return { from: '', to: '' };
}
function recQuery(f, pg, per) {
  const q = new URLSearchParams();
  const range = f.period && f.period !== 'custom' ? periodRange(f.period) : { from: f.from || '', to: f.to || '' };
  const all = { ...f, ...range }; delete all.period;
  Object.entries(all).forEach(([k, v]) => { if (v !== undefined && v !== null && String(v) !== '') q.set(k, v); });
  if (pg) q.set('page', pg);
  if (per) q.set('per_page', per);
  return q.toString();
}
function filterBar(key, o) {
  const f = REC[key].f, period = f.period || '';
  return `<form class="bx-filters" data-bx-filter="${key}" role="search" aria-label="${sprintf(/* translators: %s: a value filled in when shown */ esc(__('Find %s', 'bulk-sms-portal')), esc(o.what))}">
    <div class="bx-field"><label class="bx-label" for="bx-${key}-q">${__('Search', 'bulk-sms-portal')}</label><input id="bx-${key}-q" class="bx-input" type="search" name="search" value="${esc(f.search || '')}" placeholder="${esc(isAdmin() ? o.adminPlaceholder : o.placeholder)}" autocomplete="off"></div>
    <div class="bx-field"><label class="bx-label" for="bx-${key}-s">${esc(o.statusLabel)}</label><select id="bx-${key}-s" class="bx-select" name="${o.statusName}">${o.statuses.map(s => `<option value="${esc(s[0])}"${String(f[o.statusName] || '') === s[0] ? ' selected' : ''}>${esc(s[1])}</option>`).join('')}</select></div>
    <div class="bx-field"><label class="bx-label" for="bx-${key}-p">${__('When', 'bulk-sms-portal')}</label><select id="bx-${key}-p" class="bx-select" name="period">${PERIODS.map(p => `<option value="${p[0]}"${period === p[0] ? ' selected' : ''}>${p[1]}</option>`).join('')}</select></div>
    <div class="bx-field" data-bx-dates ${period === 'custom' ? '' : 'hidden'}><label class="bx-label" for="bx-${key}-from">${__('From', 'bulk-sms-portal')}</label><input id="bx-${key}-from" class="bx-input" type="date" name="from" value="${esc(f.from || '')}"></div>
    <div class="bx-field" data-bx-dates ${period === 'custom' ? '' : 'hidden'}><label class="bx-label" for="bx-${key}-to">To</label><input id="bx-${key}-to" class="bx-input" type="date" name="to" value="${esc(f.to || '')}"></div>
    ${isAdmin() ? `<div class="bx-field"><label class="bx-label" for="bx-${key}-c">${__('Customer', 'bulk-sms-portal')}</label><input id="bx-${key}-c" class="bx-input" type="search" name="customer" value="${esc(f.customer || '')}" placeholder="${esc(__('Name, email or number', 'bulk-sms-portal'))}" autocomplete="off"></div>` : ''}
    <div class="bx-filter-actions"><button type="submit" class="bx-btn is-primary">${sprintf(/* translators: %s: a value filled in when shown */ __('%sSearch', 'bulk-sms-portal'), icon('search', 18))}</button><button type="button" class="bx-btn" data-bx-clear>${__('Clear', 'bulk-sms-portal')}</button></div>
  </form><div data-bx-chips></div>`;
}
function bindFilters(root, key, reload) {
  const form = $(`[data-bx-filter="${key}"]`, root); if (!form) return;
  const sync = () => { const c = form.elements.period.value === 'custom'; $$('[data-bx-dates]', form).forEach(el => el.hidden = !c); };
  form.elements.period.onchange = () => { sync(); if (form.elements.period.value !== 'custom') form.requestSubmit(); };
  const st = form.querySelector('select:not([name="period"])'); if (st) st.onchange = () => form.requestSubmit();
  form.onsubmit = e => {
    e.preventDefault();
    const data = new FormData(form), f = { ...REC[key].f };
    ['search', 'status', 'type', 'period', 'from', 'to', 'customer'].forEach(k => { if (data.has(k)) f[k] = String(data.get(k) || '').trim(); });
    if (f.period !== 'custom') { f.from = ''; f.to = ''; }
    REC[key].f = f; reload(1, true);
  };
  $('[data-bx-clear]', form).onclick = () => { REC[key].f = {}; reload(1, true); };
}
function chipsHtml(key, labels) {
  const f = REC[key].f, out = [];
  if (f.campaign) out.push(['campaign', __('One send only', 'bulk-sms-portal')]);
  if (f.search) out.push(['search', '“' + f.search + '”']);
  if (f.customer) out.push(['customer', __('Customer: ', 'bulk-sms-portal') + f.customer]);
  const st = f.status || f.type; if (st && labels[st]) out.push([f.status ? 'status' : 'type', labels[st]]);
  if (f.period && f.period !== 'custom') out.push(['period', (PERIODS.find(p => p[0] === f.period) || [, ''])[1]]);
  if (f.period === 'custom' && (f.from || f.to)) out.push(['period', (f.from || '…') + ' to ' + (f.to || '…')]);
  if (!out.length) return '';
  return `<div class="bx-active-filters"><span>${__('Showing:', 'bulk-sms-portal')}</span>${out.map(c => `<button type="button" class="bx-chip is-filter" data-bx-chip="${c[0]}" aria-label="${sprintf(/* translators: %s: a value filled in when shown */ esc(__('Remove filter %s', 'bulk-sms-portal')), esc(c[1]))}">${esc(c[1])} ${icon('x', 14, 2)}</button>`).join('')}</div>`;
}
function bindChips(root, key, reload) {
  $$('[data-bx-chip]', root).forEach(b => b.onclick = () => {
    const f = { ...REC[key].f }, k = b.dataset.bxChip;
    if (k === 'period') { delete f.period; delete f.from; delete f.to; } else delete f[k];
    REC[key].f = f; reload(1, true);
  });
}
const hasFilters = key => Object.values(REC[key].f).some(Boolean);
async function exportCsv(button, path, key) {
  const done = busy(button, __('Preparing…', 'bulk-sms-portal'));
  const r = await C.api(path + '?' + recQuery(REC[key].f), { timeout: 60000 });
  done();
  if (r && r.ok) downloadFile(r.filename, r.csv); else toast(friendly(r, __('The download could not be prepared. Please try again.', 'bulk-sms-portal')), 'bad');
}
function customerCell(x) { return isAdmin() && x.customer ? `<span class="bx-td-main" data-label="${esc(__('Customer', 'bulk-sms-portal'))}"><strong>${esc(x.customer.name)}</strong><small class="bx-break">${esc(x.customer.email)}</small></span>` : ''; }
const RESULT_TONE = { confirmed: 'good', no_report: 'good', successful: 'good', failed: 'bad', sending: 'wait', not_sent: 'info' };

/* ---- Message History ---------------------------------------------------- */
const MSG_LABELS = { successful: __('Successful', 'bulk-sms-portal'), confirmed: __('Successful, confirmed by the network', 'bulk-sms-portal'), no_report: __('Successful, no failure reported', 'bulk-sms-portal'), failed: __('Failed', 'bulk-sms-portal'), sending: __('Sending', 'bulk-sms-portal'), not_sent: __('Not sent', 'bulk-sms-portal') };
page('history', 'Message History', (host, ctx) => { filtersFromHash('messages'); return drawMessages(host, ctx, REC.messages.page, true); });
async function drawMessages(host, ctx, pg = 1, rebuild = false) {
  const key = 'messages', admin = isAdmin();
  REC[key].page = pg;
  let root = $(':scope > .bx-page', host);
  if (rebuild || !root) {
    root = mount(host, `
      ${pageHead(__('Message History', 'bulk-sms-portal'), admin ? __('Every text message sent on the platform, one line per phone number. Use the search to find a customer, a number or a message.', 'bulk-sms-portal') : __('Every text message you have sent, one line per phone number. Tap a line to see the full message and what it cost.', 'bulk-sms-portal'),
        btn(icon('download', 18) + __('Download', 'bulk-sms-portal'), 'data-bx-export') + (admin || !canUse('compose_sms') ? '' : btn(icon('send', 18) + __('Send SMS', 'bulk-sms-portal'), 'data-bx-go="compose"', 'is-primary')))}
      <div class="bx-stats" data-bx-tiles>${stat(__('All messages', 'bulk-sms-portal'), '…')}</div>
      <div class="bx-section">${filterBar(key, { what: 'messages', placeholder: __('Phone number, message, sender name or message ID', 'bulk-sms-portal'), adminPlaceholder: __('Number, message, sender name, message ID or customer', 'bulk-sms-portal'), statusLabel: __('Result', 'bulk-sms-portal'), statusName: 'status', statuses: [['', __('All results', 'bulk-sms-portal')], ['successful', __('Successful', 'bulk-sms-portal')], ['failed', __('Failed', 'bulk-sms-portal')], ['sending', __('Sending', 'bulk-sms-portal')], ['not_sent', __('Not sent', 'bulk-sms-portal')]].concat(admin ? [['confirmed', __('Successful, confirmed by the network', 'bulk-sms-portal')], ['no_report', __('Successful, no failure reported', 'bulk-sms-portal')]] : []) })}
      <div data-bx-list aria-live="polite">${loading(__('Loading messages…', 'bulk-sms-portal'))}</div></div>`);
    bindGo(root);
    bindFilters(root, key, (p, r) => drawMessages(host, ctx, p, r));
    $('[data-bx-export]', root).onclick = e => exportCsv(e.currentTarget, '/records/messages/export', key);
  }
  const list = $('[data-bx-list]', root);
  list.innerHTML = loading(__('Loading messages…', 'bulk-sms-portal'));
  const r = await C.api('/records/messages?' + recQuery(REC[key].f, pg, 20));
  if (!ctx.live()) return;
  if (!r || !r.ok) { list.innerHTML = `<div class="bx-panel">${note('bad', __('We could not load this list', 'bulk-sms-portal'), esc(friendly(r)))}</div>`; return; }
  if (pageBack(r, pg, p => drawMessages(host, ctx, p))) return;
  const c = r.counts || {}, st = REC[key].f.status || '';
  $('[data-bx-tiles]', root).innerHTML = [
    stat(__('All messages', 'bulk-sms-portal'), num(c.all), { filter: '', active: !st }),
    stat(__('Successful', 'bulk-sms-portal'), num(c.successful), { filter: 'successful', active: st === 'successful' || st === 'confirmed' || st === 'no_report', tone: 'good', note: __('No failure reported', 'bulk-sms-portal') }),
    stat(__('Failed', 'bulk-sms-portal'), num(c.failed), { filter: 'failed', active: st === 'failed', tone: Number(c.failed) ? 'bad' : '' }),
    stat(__('Sending', 'bulk-sms-portal'), num(c.sending), { filter: 'sending', active: st === 'sending', tone: Number(c.sending) ? 'wait' : '' }),
    Number(c.not_sent || 0) ? stat(__('Not sent', 'bulk-sms-portal'), num(c.not_sent), { filter: 'not_sent', active: st === 'not_sent', note: __('Repeated or wrong numbers', 'bulk-sms-portal') }) : ''
  ].join('');
  $$('[data-bx-filter-value]', root).forEach(b => b.onclick = () => { REC[key].f = { ...REC[key].f, status: b.dataset.bxFilterValue }; drawMessages(host, ctx, 1, true); });
  $('[data-bx-chips]', root).innerHTML = chipsHtml(key, MSG_LABELS);
  bindChips(root, key, (p, rb) => drawMessages(host, ctx, p, rb));
  const items = r.items || [];
  if (!items.length) { list.innerHTML = `<div class="bx-list">${empty('list', __('No messages found', 'bulk-sms-portal'), hasFilters(key) ? __('Try a different search or clear the filters.', 'bulk-sms-portal') : __('Messages you send will show here.', 'bulk-sms-portal'))}</div>`; return; }
  const cols = admin ? '1fr 1.2fr 1fr 2fr 1fr 0.8fr' : '1fr 1fr 2.4fr 1fr 0.8fr';
  list.innerHTML = `<div class="bx-list">
    <div class="bx-tr is-head" style="--cols:${cols}"><span>${__('Date', 'bulk-sms-portal')}</span>${admin ? `<span>${__('Customer', 'bulk-sms-portal')}</span>` : ''}<span>${__('Sent to', 'bulk-sms-portal')}</span><span>${__('Message', 'bulk-sms-portal')}</span><span>${__('Result', 'bulk-sms-portal')}</span><span class="is-num">${__('Cost', 'bulk-sms-portal')}</span></div>
    ${items.map(m => {
      const cost = m.refunded_kobo > 0 ? `<span class="bx-td-main"><s>${esc(naira(m.charged_kobo))}</s><small>${__('Returned', 'bulk-sms-portal')}</small></span>` : (m.charged_kobo > 0 ? esc(naira(m.charged_kobo)) : `<span class="bx-muted">${__('No charge', 'bulk-sms-portal')}</span>`);
      const tech = admin && (m.technical || m.technical_note) ? `<div class="bx-admin-box"><strong>${__('For admins', 'bulk-sms-portal')}</strong><span class="bx-break">${esc(m.technical || '')}</span>${m.technical_note ? `<small class="bx-muted bx-break">${esc(m.technical_note)}</small>` : ''}</div>` : '';
      const acts = admin && m.result !== 'not_sent' ? `<div class="bx-row-flex">${btn(__('Check result again', 'bulk-sms-portal'), `data-bx-job-sync="${m.id}" data-cid="${m.campaign_id}"`, 'is-small')}${m.result !== 'successful' ? btn(__('Mark successful', 'bulk-sms-portal'), `data-bx-job-mark="success" data-job="${m.id}" data-cid="${m.campaign_id}"`, 'is-small') : ''}${btn(__('Mark failed', 'bulk-sms-portal'), `data-bx-job-mark="failed" data-job="${m.id}" data-cid="${m.campaign_id}"`, 'is-small is-danger')}</div>` : '';
      return `<details class="bx-item"><summary class="bx-tr" style="--cols:${cols}">
        <span data-label="${esc(__('Date', 'bulk-sms-portal'))}">${esc(m.date)}</span>
        ${customerCell(m)}
        <span class="bx-mono bx-td-lead" data-label="${esc(__('Sent to', 'bulk-sms-portal'))}">${esc(m.recipient)}</span>
        <span class="bx-clip" data-label="${esc(__('Message', 'bulk-sms-portal'))}">${esc(m.message)}</span>
        <span class="bx-td-main" data-label="${esc(__('Result', 'bulk-sms-portal'))}">${pill(RESULT_TONE[m.result] || 'info', m.result_label || '')}${m.detail ? `<small>${esc(m.detail)}</small>` : ''}</span>
        <span class="is-num" data-label="${esc(__('Cost', 'bulk-sms-portal'))}">${cost}</span>
      </summary><div class="bx-item-body">
        <div class="bx-quote">${esc(m.message)}</div>
        <dl class="bx-facts">
          <div><dt>${__('Sender name', 'bulk-sms-portal')}</dt><dd>${esc(m.sender || '—')}</dd></div>
          ${m.message_id ? `<div><dt>${__('Message ID', 'bulk-sms-portal')}</dt><dd><span class="bx-mono bx-break">${esc(m.message_id)}</span> <button type="button" class="bx-link" data-bx-copy-id="${esc(m.message_id)}">${__('Copy', 'bulk-sms-portal')}</button></dd></div>` : ''}
          <div><dt>${__('SMS pages', 'bulk-sms-portal')}</dt><dd>${esc(m.pages)}</dd></div>
          <div><dt>${__('Charged', 'bulk-sms-portal')}</dt><dd>${m.charged_kobo > 0 ? esc(naira(m.charged_kobo)) : __('Nothing', 'bulk-sms-portal')}</dd></div>
          <div><dt>${__('Money returned', 'bulk-sms-portal')}</dt><dd>${m.refunded_kobo > 0 ? esc(naira(m.refunded_kobo)) : '—'}</dd></div>
          <div><dt>${__('Part of', 'bulk-sms-portal')}</dt><dd><button type="button" class="bx-link" data-bx-open-send="${m.campaign_id}">${esc(m.campaign_name || __('This send', 'bulk-sms-portal'))}</button></dd></div>
        </dl>${tech}${acts}
      </div></details>`;
    }).join('')}
    ${pager(r)}</div>`;
  bindPager(list, p => drawMessages(host, ctx, p));
  $$('[data-bx-open-send]', list).forEach(b => b.onclick = () => APP.openReport(b.dataset.bxOpenSend));
  $$('[data-bx-copy-id]', list).forEach(b => b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.bxCopyId); toast(__('Message ID copied.', 'bulk-sms-portal')); } catch (e) { toast(__('Select the ID and copy it.', 'bulk-sms-portal'), 'bad'); } });
  $$('[data-bx-job-sync]', list).forEach(b => b.onclick = async () => {
    const done = busy(b, __('Checking…', 'bulk-sms-portal'));
    const res = await C.api(`/reports/${b.dataset.cid}/jobs/${b.dataset.bxJobSync}/sync`, { method: 'POST', body: '{}' });
    done(); if (!res || !res.ok) toast(friendly(res, __('The result could not be checked.', 'bulk-sms-portal')), 'bad'); else toast(__('Result checked.', 'bulk-sms-portal'));
    drawMessages(host, ctx, REC[key].page);
  });
  $$('[data-bx-job-mark]', list).forEach(b => b.onclick = async () => {
    const s = b.dataset.bxJobMark;
    if (!await confirmBox({ title: s === 'success' ? __('Mark this message as successful?', 'bulk-sms-portal') : __('Mark this message as failed?', 'bulk-sms-portal'), body: s === 'success' ? `<p>${__('Use this when you know the message reached the phone.', 'bulk-sms-portal')}</p>` : `<p>${__('The charge for this message will be returned to the customer’s wallet.', 'bulk-sms-portal')}</p>`, confirm: s === 'success' ? __('Mark delivered', 'bulk-sms-portal') : __('Mark failed', 'bulk-sms-portal'), danger: s !== 'success' })) return;
    const res = await C.api(`/reports/${b.dataset.cid}/jobs/${b.dataset.job}/status`, { method: 'POST', body: JSON.stringify({ status: s }) });
    if (!res || !res.ok) toast(friendly(res, __('The result could not be updated.', 'bulk-sms-portal')), 'bad'); else toast(__('Result updated.', 'bulk-sms-portal'));
    drawMessages(host, ctx, REC[key].page);
  });
}

/* ---- Delivery Reports --------------------------------------------------- */
const REP_LABELS = { successful: __('No failed messages', 'bulk-sms-portal'), failed: __('Has failed messages', 'bulk-sms-portal'), sending: __('Still sending', 'bulk-sms-portal') };
const REP_TONE = { done: 'good', some_failed: 'wait', all_failed: 'bad', sending: 'wait', scheduled: 'info', not_sent: 'info' };
page('reports', 'Delivery Reports', (host, ctx) => { filtersFromHash('reports'); return drawReports(host, ctx, REC.reports.page, true); });
async function drawReports(host, ctx, pg = 1, rebuild = false) {
  const key = 'reports', admin = isAdmin();
  REC[key].page = pg;
  let root = $(':scope > .bx-page', host);
  if (rebuild || !root) {
    root = mount(host, `
      ${pageHead(__('Delivery Reports', 'bulk-sms-portal'), admin ? __('Each time a customer sends SMS: how many messages went out, how many were successful or failed, and what was charged and returned.', 'bulk-sms-portal') : __('Each time you send SMS: how many messages went out, how many were successful or failed, and what you paid after money returned for failed messages.', 'bulk-sms-portal'), btn(icon('download', 18) + __('Download', 'bulk-sms-portal'), 'data-bx-export'))}
      <div data-bx-tiles>${skeleton(2)}</div>
      <div class="bx-section">${filterBar(key, { what: 'sends', placeholder: __('Send name, message or sender name', 'bulk-sms-portal'), adminPlaceholder: __('Send name, message, sender name or customer', 'bulk-sms-portal'), statusLabel: __('Outcome', 'bulk-sms-portal'), statusName: 'status', statuses: [['', __('All sends', 'bulk-sms-portal')], ['successful', __('No failed messages', 'bulk-sms-portal')], ['failed', __('Has failed messages', 'bulk-sms-portal')], ['sending', __('Still sending', 'bulk-sms-portal')]] })}
      <div data-bx-list aria-live="polite">${loading(__('Loading reports…', 'bulk-sms-portal'))}</div>
      <p class="bx-small bx-muted bx-mt-s">${__('Money for failed messages goes back to the wallet automatically. Final cost is what was charged minus what was returned.', 'bulk-sms-portal')}</p></div>`);
    bindFilters(root, key, (p, r) => drawReports(host, ctx, p, r));
    $('[data-bx-export]', root).onclick = e => exportCsv(e.currentTarget, '/records/reports/export', key);
  }
  const list = $('[data-bx-list]', root);
  list.innerHTML = loading(__('Loading reports…', 'bulk-sms-portal'));
  const r = await C.api('/records/reports?' + recQuery(REC[key].f, pg, 20));
  if (!ctx.live()) return;
  if (!r || !r.ok) { list.innerHTML = `<div class="bx-panel">${note('bad', __('We could not load this list', 'bulk-sms-portal'), esc(friendly(r)))}</div>`; return; }
  if (pageBack(r, pg, p => drawReports(host, ctx, p))) return;
  const s = r.summary || {};
  $('[data-bx-tiles]', root).innerHTML = `<div class="bx-stats">
      ${stat(__('Messages sent', 'bulk-sms-portal'), num(s.messages), { note: sprintf(/* translators: %s: a number */ _n('%s send', '%s sends', Number(s.sends), 'bulk-sms-portal'), num(s.sends)) })}
      ${stat(__('Successful', 'bulk-sms-portal'), num(s.successful), { tone: 'good', note: __('No failure reported', 'bulk-sms-portal') })}
      ${stat(__('Failed', 'bulk-sms-portal'), num(s.failed), { tone: Number(s.failed) ? 'bad' : '' })}
      ${stat(__('Still sending', 'bulk-sms-portal'), num(s.sending), { tone: Number(s.sending) ? 'wait' : '' })}
    </div>
    <div class="bx-stats bx-mt-s" aria-label="${esc(__('Money', 'bulk-sms-portal'))}">
      ${stat(__('Charged', 'bulk-sms-portal'), naira(s.charged_kobo))}
      ${stat(__('Returned for failed messages', 'bulk-sms-portal'), naira(s.refunded_kobo))}
      ${stat(__('Final cost', 'bulk-sms-portal'), naira(s.cost_kobo))}
    </div>`;
  $('[data-bx-chips]', root).innerHTML = chipsHtml(key, REP_LABELS);
  bindChips(root, key, (p, rb) => drawReports(host, ctx, p, rb));
  const items = r.items || [];
  if (!items.length) { list.innerHTML = `<div class="bx-list">${empty('chart', __('No sends found', 'bulk-sms-portal'), hasFilters(key) ? __('Try a different search or clear the filters.', 'bulk-sms-portal') : __('Each time you send SMS, it shows here with its results.', 'bulk-sms-portal'))}</div>`; return; }
  const cols = admin ? '2fr 1.2fr 0.7fr 0.8fr 0.7fr 1.1fr 220px' : '2.4fr 0.7fr 0.8fr 0.7fr 1.1fr 220px';
  list.innerHTML = `<div class="bx-list">
    <div class="bx-tr is-head" style="--cols:${cols}"><span>${__('Send', 'bulk-sms-portal')}</span>${admin ? `<span>${__('Customer', 'bulk-sms-portal')}</span>` : ''}<span class="is-num">${__('Messages', 'bulk-sms-portal')}</span><span class="is-num">${__('Successful', 'bulk-sms-portal')}</span><span class="is-num">${__('Failed', 'bulk-sms-portal')}</span><span class="is-num">${__('Final cost', 'bulk-sms-portal')}</span><span></span></div>
    ${items.map(x => `<div class="bx-tr" style="--cols:${cols}">
      <span class="bx-td-main bx-td-lead" data-label="${esc(__('Send', 'bulk-sms-portal'))}"><strong>${esc(x.name || __('Send', 'bulk-sms-portal'))}</strong><small>${esc(x.date || '')}${x.sender ? __(', from ', 'bulk-sms-portal') + esc(x.sender) : ''}</small><span class="bx-row-flex">${pill(REP_TONE[x.state] || 'info', x.state_label || '')}${x.scheduled_for ? `<small>${sprintf(/* translators: %s: a value filled in when shown */ __('Goes out %s', 'bulk-sms-portal'), esc(x.scheduled_for))}</small>` : ''}</span>${bar([{ label: 'delivered', value: x.delivered, tone: 'good' }, { label: __('sent, waiting for confirmation', 'bulk-sms-portal'), value: x.sent, tone: 'info' }, { label: 'failed', value: x.failed, tone: 'bad' }, { label: 'sending', value: x.sending, tone: 'wait' }])}</span>
      ${customerCell(x)}
      <span class="is-num" data-label="${esc(__('Messages', 'bulk-sms-portal'))}"><b>${num(x.messages)}</b>${x.not_sent ? `<small class="bx-muted"> ${sprintf(/* translators: %s: a value filled in when shown */ __('(%s not sent)', 'bulk-sms-portal'), num(x.not_sent))}</small>` : ''}</span>
      <span class="is-num bx-td-main" data-label="${esc(__('Successful', 'bulk-sms-portal'))}">${num(x.successful)}${x.sending ? `<small>${sprintf(/* translators: %s: a value filled in when shown */ __('%s still sending', 'bulk-sms-portal'), num(x.sending))}</small>` : ''}</span>
      <span class="is-num" data-label="${esc(__('Failed', 'bulk-sms-portal'))}">${num(x.failed)}</span>
      <span class="is-num bx-td-main" data-label="${esc(__('Final cost', 'bulk-sms-portal'))}"><b>${esc(naira(x.cost_kobo))}</b>${x.refunded_kobo ? `<small>${sprintf(/* translators: %1$s, %2$s: values filled in when shown */ __('%1$s charged, %2$s returned', 'bulk-sms-portal'), esc(naira(x.charged_kobo)), esc(naira(x.refunded_kobo)))}</small>` : ''}</span>
      <span class="bx-row-flex bx-td-actions">${btn(__('See messages', 'bulk-sms-portal'), `data-bx-see="${x.id}"`, 'is-small')}${x.failed ? btn(__('Only failed', 'bulk-sms-portal'), `data-bx-see-failed="${x.id}"`, 'is-small is-quiet') : ''}${admin && x.sending ? btn(__('Check results again', 'bulk-sms-portal'), `data-bx-sync="${x.id}"`, 'is-small is-quiet') : ''}</span>
    </div>`).join('')}
    ${pager(r)}</div>`;
  bindPager(list, p => drawReports(host, ctx, p));
  $$('[data-bx-see]', list).forEach(b => b.onclick = () => APP.openMessages(b.dataset.bxSee));
  $$('[data-bx-see-failed]', list).forEach(b => b.onclick = () => APP.openMessages(b.dataset.bxSeeFailed, 'failed'));
  $$('[data-bx-sync]', list).forEach(b => b.onclick = async () => {
    const done = busy(b, __('Checking…', 'bulk-sms-portal'));
    const res = await C.api('/reports/' + b.dataset.bxSync + '/sync-pending', { method: 'POST', body: JSON.stringify({ limit: 500 }), timeout: 60000 });
    done(); if (!res || !res.ok) toast(friendly(res, __('Results could not be checked.', 'bulk-sms-portal')), 'bad'); else toast(__('Results checked.', 'bulk-sms-portal'));
    drawReports(host, ctx, REC[key].page);
  });
}

/* ---- Wallet History ----------------------------------------------------- */
const WAL_LABELS = { added: __('Money added', 'bulk-sms-portal'), used: __('Money used', 'bulk-sms-portal'), returned: __('Money returned', 'bulk-sms-portal') };
page('transactions', 'Wallet History', (host, ctx) => drawWallet(host, ctx, REC.wallet.page, true));
async function drawWallet(host, ctx, pg = 1, rebuild = false) {
  const key = 'wallet', admin = isAdmin();
  REC[key].page = pg;
  let root = $(':scope > .bx-page', host);
  if (rebuild || !root) {
    root = mount(host, `
      ${pageHead(__('Wallet History', 'bulk-sms-portal'), admin ? __('Every payment, SMS charge and refund across all customer wallets. SMS charges are grouped per send.', 'bulk-sms-portal') : __('Money you added, money used to send SMS, and money returned for failed messages. SMS charges are grouped per send.', 'bulk-sms-portal'), btn(icon('download', 18) + __('Download', 'bulk-sms-portal'), 'data-bx-export') + (!admin && canUse('buy_sms') ? btn(__('Buy SMS', 'bulk-sms-portal'), 'data-bx-go="fund"', 'is-primary') : ''))}
      <div class="bx-stats" data-bx-tiles>${stat(__('Balance', 'bulk-sms-portal'), '…')}</div>
      <div class="bx-section">${filterBar(key, { what: 'wallet activity', placeholder: __('Reference or send name', 'bulk-sms-portal'), adminPlaceholder: __('Reference, send name or customer', 'bulk-sms-portal'), statusLabel: __('Activity', 'bulk-sms-portal'), statusName: 'type', statuses: [['', __('All activity', 'bulk-sms-portal')], ['added', __('Money added', 'bulk-sms-portal')], ['used', __('Money used', 'bulk-sms-portal')], ['returned', __('Money returned', 'bulk-sms-portal')]] })}
      <div data-bx-list aria-live="polite">${loading(__('Loading wallet activity…', 'bulk-sms-portal'))}</div></div>`);
    bindGo(root);
    bindFilters(root, key, (p, r) => drawWallet(host, ctx, p, r));
    $('[data-bx-export]', root).onclick = e => exportCsv(e.currentTarget, '/records/wallet/export', key);
  }
  const list = $('[data-bx-list]', root);
  list.innerHTML = loading(__('Loading wallet activity…', 'bulk-sms-portal'));
  const r = await C.api('/records/wallet?' + recQuery(REC[key].f, pg, 20));
  if (!ctx.live()) return;
  if (!r || !r.ok) { list.innerHTML = `<div class="bx-panel">${note('bad', __('We could not load this list', 'bulk-sms-portal'), esc(friendly(r)))}</div>`; return; }
  if (pageBack(r, pg, p => drawWallet(host, ctx, p))) return;
  const s = r.summary || {}, t = REC[key].f.type || '';
  $('[data-bx-tiles]', root).innerHTML = (admin ? [
    stat(__('Money added', 'bulk-sms-portal'), naira(s.added_kobo), { filter: 'added', active: t === 'added', tone: 'good' }),
    stat(__('Money used', 'bulk-sms-portal'), naira(s.used_kobo), { filter: 'used', active: t === 'used' }),
    stat(__('Money returned', 'bulk-sms-portal'), naira(s.returned_kobo), { filter: 'returned', active: t === 'returned' }),
    stat(__('SMS income', 'bulk-sms-portal'), naira(s.net_sms_income_kobo), { note: __('Used minus returned', 'bulk-sms-portal') })
  ] : [
    stat(__('Balance now', 'bulk-sms-portal'), naira(s.balance_kobo), { note: __('Available to spend', 'bulk-sms-portal') }),
    stat(__('Money added', 'bulk-sms-portal'), naira(s.added_kobo), { filter: 'added', active: t === 'added', tone: 'good' }),
    stat(__('Money used', 'bulk-sms-portal'), naira(s.used_kobo), { filter: 'used', active: t === 'used' }),
    stat(__('Money returned', 'bulk-sms-portal'), naira(s.returned_kobo), { filter: 'returned', active: t === 'returned', note: __('For failed messages', 'bulk-sms-portal') })
  ]).join('');
  $$('[data-bx-filter-value]', root).forEach(b => b.onclick = () => { REC[key].f = { ...REC[key].f, type: t === b.dataset.bxFilterValue ? '' : b.dataset.bxFilterValue }; drawWallet(host, ctx, 1, true); });
  $('[data-bx-chips]', root).innerHTML = chipsHtml(key, WAL_LABELS);
  bindChips(root, key, (p, rb) => drawWallet(host, ctx, p, rb));
  const items = r.items || [];
  if (!items.length) { list.innerHTML = `<div class="bx-list">${empty('wallet', __('No wallet activity found', 'bulk-sms-portal'), hasFilters(key) ? __('Try a different search or clear the filters.', 'bulk-sms-portal') : __('Payments and SMS charges will show here.', 'bulk-sms-portal'))}</div>`; return; }
  const cols = admin ? '1fr 1.2fr 2fr 1.2fr 1fr' : '1fr 2.2fr 1.4fr 1fr';
  const tone = { added: 'good', used: '', returned: 'wait' };
  list.innerHTML = `<div class="bx-list">
    <div class="bx-tr is-head" style="--cols:${cols}"><span>${__('Date', 'bulk-sms-portal')}</span>${admin ? `<span>${__('Customer', 'bulk-sms-portal')}</span>` : ''}<span>${__('What happened', 'bulk-sms-portal')}</span><span>${__('Reference', 'bulk-sms-portal')}</span><span class="is-num">${__('Amount', 'bulk-sms-portal')}</span></div>
    ${items.map(x => `<div class="bx-tr" style="--cols:${cols}">
      <span data-label="${esc(__('Date', 'bulk-sms-portal'))}">${esc(x.date)}</span>
      ${customerCell(x)}
      <span class="bx-td-main bx-td-lead" data-label="${esc(__('What happened', 'bulk-sms-portal'))}"><strong>${esc(x.title)}</strong>${x.detail ? `<small>${esc(x.detail)}</small>` : ''}</span>
      <span data-label="${esc(__('Reference', 'bulk-sms-portal'))}">${x.campaign_id ? `<button type="button" class="bx-link" data-bx-wallet-send="${esc(x.campaign_id)}">${esc(x.reference)}</button>` : `<span class="bx-mono">${esc(x.reference)}</span>`}</span>
      <strong class="is-num bx-amount${tone[x.kind] ? ' is-' + tone[x.kind] : ''}" data-label="${esc(__('Amount', 'bulk-sms-portal'))}">${esc(naira(x.amount_kobo, { plus: true }))}</strong>
    </div>`).join('')}
    ${pager(r)}</div>`;
  bindPager(list, p => drawWallet(host, ctx, p));
  $$('[data-bx-wallet-send]', list).forEach(b => b.onclick = () => APP.openReport(b.dataset.bxWalletSend));
}
