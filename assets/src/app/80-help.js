/* ==========================================================================
   Help Centre
   ========================================================================== */
const PAGE_LINKS = { compose: __('Send SMS', 'bulk-sms-portal'), reports: __('Delivery Reports', 'bulk-sms-portal'), history: __('Message History', 'bulk-sms-portal'), fund: __('Buy SMS', 'bulk-sms-portal'), sender: __('Sender ID', 'bulk-sms-portal'), api: 'API', profile: __('Profile & Security', 'bulk-sms-portal'), pricing: __('Pricing', 'bulk-sms-portal'), groups: __('Phonebook', 'bulk-sms-portal'), transactions: __('Wallet History', 'bulk-sms-portal'), settings: __('Notifications', 'bulk-sms-portal') };
const helpState = { q: '' };

page('help', 'Help Centre', async (host, ctx) => {
  const root = mount(host, `
    ${pageHead(__('Help Centre', 'bulk-sms-portal'), __('Answers to common questions, a quick check of your account, and how to reach us.', 'bulk-sms-portal'))}
    <form class="bx-search" role="search" data-bx-help-form><label class="bx-sr" for="bx-help-q">${__('Search help', 'bulk-sms-portal')}</label><input id="bx-help-q" class="bx-input" type="search" value="${esc(helpState.q)}" placeholder="${esc(__('Search, for example: failed, payment, sender name', 'bulk-sms-portal'))}" autocomplete="off"><button type="submit" class="bx-btn is-primary is-large">${sprintf(/* translators: %s: a value filled in when shown */ __('%sSearch', 'bulk-sms-portal'), icon('search', 18))}</button></form>
    <div class="bx-chips bx-mt-s" data-bx-help-chips></div>
    <div class="bx-section bx-split">
      <div class="bx-stack" data-bx-help-main>${skeleton(6)}</div>
      <aside class="bx-aside">
        <section class="bx-panel" aria-labelledby="bx-hc-check"><div class="bx-panel-head"><div><h2 id="bx-hc-check">${__('Your account right now', 'bulk-sms-portal')}</h2><p>${__('The usual things that stop messages going out.', 'bulk-sms-portal')}</p></div></div><div data-bx-check>${skeleton(3)}</div></section>
        <section class="bx-panel" aria-labelledby="bx-hc-contact"><div class="bx-panel-head"><div><h2 id="bx-hc-contact">${__('Talk to us', 'bulk-sms-portal')}</h2></div></div><div data-bx-contact>${skeleton(2)}</div></section>
      </aside>
    </div>`);

  let draw = () => {};
  $('[data-bx-help-form]', root).onsubmit = (e) => { e.preventDefault(); helpState.q = $('#bx-help-q', root).value; draw(); };
  const [hr, sr] = await Promise.all([C.api('/help-content'), canUse('sender_ids') ? C.api('/sender-ids') : Promise.resolve(null)]);
  if (!ctx.live()) return;
  const content = (hr && hr.ok && hr.content) || {};
  const visible = x => x && Number(x.enabled ?? 1) && (x.status || 'published') === 'published' && (x.visibility !== 'admin' || isAdmin());
  const byOrder = (a, b) => Number(a.order || 0) - Number(b.order || 0);
  const questions = (content.troubleshooting || []).filter(visible).sort(byOrder);
  const guides = (content.knowledge || []).filter(visible).sort(byOrder);
  const channels = (content.channels || []).filter(visible).sort(byOrder);
  const chips = (content.suggestions || []).filter(visible).sort(byOrder);

  /* Quick account check */
  const bal = balanceKobo();
  const approved = (S().approved_senders || []).length;
  const pendingNames = sr && sr.ok ? (sr.items || []).filter(x => x.status === 'pending').length : 0;
  const failed = Number((S().delivery_metrics || {}).failed || 0);
  const checks = [
    bal > 0 ? ['good', __('Your wallet has money', 'bulk-sms-portal'), naira(bal) + ' available.', ''] : ['bad', __('Your wallet is empty', 'bulk-sms-portal'), __('Add money before you send.', 'bulk-sms-portal'), btn(__('Buy SMS', 'bulk-sms-portal'), 'data-bx-go="fund"', 'is-small')],
    approved ? ['good', `${sprintf(/* translators: %s: a number */ _n('%s sender name', '%s sender names', Number(approved), 'bulk-sms-portal'), num(approved))} ready`, (S().approved_senders || []).slice(0, 3).join(', '), ''] : (pendingNames ? ['wait', __('Your sender name is waiting for approval', 'bulk-sms-portal'), __('We will let you know when it has been checked.', 'bulk-sms-portal'), btn(__('See Sender ID', 'bulk-sms-portal'), 'data-bx-go="sender"', 'is-small')] : ['wait', __('No sender name of your own yet', 'bulk-sms-portal'), __('Messages show a shared name until you have yours.', 'bulk-sms-portal'), btn(__('Ask for a name', 'bulk-sms-portal'), 'data-bx-go="sender"', 'is-small')]),
    failed ? ['wait', `${sprintf(/* translators: %s: a value filled in when shown */ __('%s failed so far', 'bulk-sms-portal'), sprintf(/* translators: %s: a number */ _n('%s message', '%s messages', Number(failed), 'bulk-sms-portal'), num(failed)))}`, __('Open Message History and choose “Failed” to see why.', 'bulk-sms-portal'), btn(__('See failed messages', 'bulk-sms-portal'), 'data-bx-failed', 'is-small')] : ['good', __('No failed messages', 'bulk-sms-portal'), '', '']
  ];
  const ck = $('[data-bx-check]', root);
  ck.innerHTML = `<ul class="bx-checklist">${checks.map(([t, title, text, act]) => `<li class="${t === 'good' ? 'is-ok' : ''}"><span class="bx-tick">${icon(t === 'good' ? 'check' : 'alert', 16, 2.2)}</span><div><span class="bx-check-title">${esc(title)}</span>${text ? `<p class="bx-small bx-muted">${esc(text)}</p>` : ''}</div>${act}</li>`).join('')}</ul>`;
  bindGo(ck);
  const fb = $('[data-bx-failed]', ck); if (fb) fb.onclick = () => APP.openMessages('', 'failed');

  /* Contact */
  const support = CFG.supportEmail || '';
  const chIcon = { email: 'mail', whatsapp: 'chat', phone: 'phone', technical: 'plug' };
  const chHref = (c) => {
    const v = String(c.value || '').trim(); if (!v) return '';
    if (c.type === 'email' || /@/.test(v)) return 'mailto:' + v;
    if (c.type === 'whatsapp') return 'https://wa.me/' + v.replace(/\D/g, '');
    if (c.type === 'phone') return 'tel:' + v.replace(/[^\d+]/g, '');
    return /^https?:\/\//.test(v) ? v : '';
  };
  let contact = channels.filter(c => String(c.value || '').trim() || (c.type === 'email' && support)).map(c => ({ ...c, value: String(c.value || '').trim() || support }));
  if (!contact.length && support) contact = [{ title: __('Email support', 'bulk-sms-portal'), type: 'email', value: support, summary: __('For account and payment questions.', 'bulk-sms-portal') }];
  $('[data-bx-contact]', root).innerHTML = contact.length ? `<div class="bx-stack is-tight">${contact.map(c => { const href = chHref(c); return `<div class="bx-row-flex is-nowrap bx-contact">${icon(chIcon[c.type] || 'chat', 20)}<div class="bx-td-main"><strong>${esc(c.title || __('Contact', 'bulk-sms-portal'))}</strong>${c.summary ? `<small>${esc(c.summary)}</small>` : ''}${href ? `<a href="${esc(href)}"${href.indexOf('http') === 0 ? ' target="_blank" rel="noopener"' : ''}>${esc(c.value)}</a>` : `<small>${esc(c.value)}</small>`}${c.availability ? `<small>${esc(c.availability)}</small>` : ''}</div></div>`; }).join('')}</div>` : `<p class="bx-muted">${__('Contact details have not been added yet.', 'bulk-sms-portal')}</p>`;

  /* Questions and guides, filtered by the search */
  const main = $('[data-bx-help-main]', root);
  const words = q => String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (x, q) => { const hay = [x.title, x.summary, x.body, x.category, x.keywords].join(' ').toLowerCase(); return words(q).every(w => hay.includes(w)); };
  const qa = (x) => `<details class="bx-qa"><summary>${esc(x.title || __('Help', 'bulk-sms-portal'))}</summary><div class="bx-qa-body">${x.category ? `<span class="bx-qa-tag">${esc(x.category)}</span>` : ''}${x.summary && x.body ? `<p><strong>${esc(x.summary)}</strong></p>` : ''}<p>${esc(x.body || x.summary || '')}</p>${x.related_page && PAGE_LINKS[x.related_page] ? `<div>${btn(__('Open ', 'bulk-sms-portal') + esc(PAGE_LINKS[x.related_page]), `data-bx-go="${esc(x.related_page)}"`, 'is-small')}</div>` : ''}</div></details>`;
  draw = () => {
    const q = helpState.q.trim();
    const qs = q ? questions.filter(x => matches(x, q)) : questions;
    const gs = q ? guides.filter(x => matches(x, q)) : guides;
    main.innerHTML = (!qs.length && !gs.length) ? `<div class="bx-list">${empty('search', q ? __('No answers match your search', 'bulk-sms-portal') : __('No help articles yet', 'bulk-sms-portal'), q ? __('Try a shorter word, or contact us using the details on this page.', 'bulk-sms-portal') : __('Contact us using the details on this page.', 'bulk-sms-portal'), q ? btn(__('Clear search', 'bulk-sms-portal'), 'data-bx-clear', 'is-small') : '')}</div>`
      : `${qs.length ? `<section aria-labelledby="bx-hc-q"><div class="bx-section-head"><h2 id="bx-hc-q">${q ? __('Matching questions', 'bulk-sms-portal') : __('Common questions', 'bulk-sms-portal')}</h2></div><div class="bx-list">${qs.map(qa).join('')}</div></section>` : ''}
         ${gs.length ? `<section aria-labelledby="bx-hc-g"><div class="bx-section-head"><h2 id="bx-hc-g">${q ? __('Matching guides', 'bulk-sms-portal') : __('Guides', 'bulk-sms-portal')}</h2></div><div class="bx-list">${gs.map(qa).join('')}</div></section>` : ''}`;
    bindGo(main);
    const cl = $('[data-bx-clear]', main); if (cl) cl.onclick = () => { helpState.q = ''; $('#bx-help-q', root).value = ''; draw(); };
    if (q) { const first = $('details.bx-qa', main); if (first && qs.length + gs.length <= 3) first.open = true; }
  };
  $('[data-bx-help-chips]', root).innerHTML = chips.map(c => `<button type="button" class="bx-chip" data-bx-q="${esc(c.query || c.title)}">${esc(c.title || c.query)}</button>`).join('');
  $$('[data-bx-q]', root).forEach(b => b.onclick = () => { helpState.q = b.dataset.bxQ; $('#bx-help-q', root).value = helpState.q; draw(); });
  $('#bx-help-q', root).addEventListener('input', (e) => { if (!e.target.value) { helpState.q = ''; draw(); } });
  draw();
});
