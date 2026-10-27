/* Bulk SMS Portal: small behaviours for the public help and API sections. */
(function () {
  const { __ } = (window.wp && window.wp.i18n) || { __: s => s };
  function helpCentre(r) {
    var i = r.querySelector('input'), b = r.querySelector('.bsms-public-help-search>div>button'), e = r.querySelector('.bsms-public-help-empty');
    function f() {
      var q = ((i && i.value) || '').trim().toLowerCase(), n = 0;
      r.querySelectorAll('[data-help-text]').forEach(function (x) { var show = !q || (x.getAttribute('data-help-text') || '').toLowerCase().indexOf(q) > -1; x.hidden = !show; if (show) n++; });
      r.querySelectorAll('.bsms-public-help-section').forEach(function (s) { var items = s.querySelectorAll('[data-help-text]'), shown = Array.prototype.some.call(items, function (x) { return !x.hidden; }); s.hidden = items.length && !shown; });
      if (e) e.hidden = !!n;
    }
    if (b) b.addEventListener('click', f);
    if (i) i.addEventListener('input', f);
    r.querySelectorAll('[data-help-query]').forEach(function (x) { x.addEventListener('click', function () { if (!i) return; i.value = x.getAttribute('data-help-query') || ''; f(); i.focus(); }); });
  }
  function faqSearch() {
    var q = document.getElementById('bsmsHelpSearch'), g = document.getElementById('bsmsFaqGrid'), c = document.getElementById('bsmsHelpCount'), e = document.getElementById('bsmsHelpEmpty');
    if (!q || !g) return;
    q.addEventListener('input', function () {
      var s = q.value.trim().toLowerCase(), n = 0;
      g.querySelectorAll('details').forEach(function (d) { var ok = !s || (d.dataset.help || '').indexOf(s) > -1; d.hidden = !ok; if (ok) n++; });
      if (c) c.textContent = n + ' topic' + (n === 1 ? '' : 's');
      if (e) e.hidden = n !== 0;
    });
  }
  function apiCopy(root) {
    if (root.dataset.copyReady) return; root.dataset.copyReady = '1';
    root.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-copy]'); if (!b) return;
      var x = root.querySelector(b.getAttribute('data-copy')); if (!x) return;
      var done = function () { var old = b.textContent; b.textContent = __('Copied', 'bulk-sms-portal'); setTimeout(function () { b.textContent = old; }, 1200); };
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(x.textContent).then(done); return; }
      var rg = document.createRange(); rg.selectNodeContents(x); var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(rg);
      try { document.execCommand('copy'); done(); } catch (err) {} sel.removeAllRanges();
    });
  }
  function start() {
    document.querySelectorAll('[data-bsms-public-help]').forEach(helpCentre);
    faqSearch();
    document.querySelectorAll('.bsms-api-component').forEach(apiCopy);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
