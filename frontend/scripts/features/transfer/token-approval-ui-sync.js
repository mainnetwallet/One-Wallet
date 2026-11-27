// ══════════════════════════════════════════════════════
// TOKEN APPROVAL — UI-ONLY HELPERS
// Presentation glue for the compact Token Approval layout
// (html-src/partials/page-transfer-hub/token-approval-manager.html).
// It never touches wallet, signing or approval logic: it only
//   * opens/closes the logs box (and folds the key box while logs are open),
//   * drives the Unlimited / Custom / Revoke chips by writing to the same
//     #approvalAmount input the approval already reads (empty = unlimited, 0 = revoke),
//   * mirrors the chosen mode and wallet count into the summary and the
//     Approve / Revoke button label.
// ══════════════════════════════════════════════════════
(function () {
  'use strict';

  var customPicked = false;

  function $(id) { return document.getElementById(id); }

  function setText(el, txt) {
    if (el && el.textContent !== txt) el.textContent = txt;
  }

  // Logs header: collapse / expand the log box (collapsed by default)
  window.approvalToggleLogs = function (open) {
    var box = $('approvalLogs'), ui = $('tokenApprovalManagerUI');
    if (!box) return;
    var willOpen = typeof open === 'boolean' ? open : box.classList.contains('collapsed');
    box.classList.toggle('collapsed', !willOpen);
    if (ui) ui.classList.toggle('ap-logs-open', willOpen);
  };

  // Amount chips: Unlimited = empty, Revoke = 0, Custom = type your own amount
  window.approvalPickMode = function (mode) {
    var el = $('approvalAmount');
    if (!el) return;
    customPicked = mode === 'custom';
    if (mode === 'unlimited' && typeof window.setApprovalAmount === 'function') window.setApprovalAmount('');
    else if (mode === 'revoke' && typeof window.setApprovalAmount === 'function') window.setApprovalAmount('0');
    else if (mode === 'custom') {
      var v = el.value.trim();
      if (v === '' || v === '0') el.value = '';
      el.focus();
    }
    sync();
  };

  function currentMode() {
    var el = $('approvalAmount');
    var v = el ? el.value.trim() : '';
    if (v === '0') return 'revoke';
    if (v !== '') return 'custom';
    return customPicked ? 'custom' : 'unlimited';
  }

  function sync() {
    var ui = $('tokenApprovalManagerUI');
    if (!ui || ui.getClientRects().length === 0) return; // not on screen
    var el = $('approvalAmount');
    var v = el ? el.value.trim() : '';
    if (v === '0') customPicked = false;
    var mode = currentMode();
    if (ui.getAttribute('data-amount-mode') !== mode) ui.setAttribute('data-amount-mode', mode);

    var ids = { unlimited: 'approvalChipUnlimited', custom: 'approvalChipCustom', revoke: 'approvalChipRevoke' };
    Object.keys(ids).forEach(function (m) {
      var b = $(ids[m]);
      if (b) b.classList.toggle('active', m === mode);
    });

    // Summary shows what will actually be sent: empty field = unlimited
    var label = v === '0' ? 'Revoke' : (v === '' ? 'Unlimited' : v);
    if (label.length > 14) label = label.slice(0, 13) + '…';
    setText($('approvalModeLabel'), label);

    var n = parseInt(($('walletsLoadedApproval') || {}).textContent, 10) || 0;
    var verb = v === '0' ? 'Revoke' : 'Approve';
    var btn = $('executeApprovalBtn');
    if (btn && !btn.querySelector('.loading-spinner')) {
      setText(btn, n > 0 ? verb + ' ' + n + ' wallet' + (n > 1 ? 's' : '') : verb);
    }
  }

  setInterval(sync, 600);
  document.addEventListener('input', function () { setTimeout(sync, 0); }, true);
  document.addEventListener('click', function (e) {
    // Starting an approval opens the logs so progress is visible without scrolling
    var t = e.target && e.target.closest ? e.target.closest('#executeApprovalBtn') : null;
    if (t && !t.disabled && typeof window.approvalToggleLogs === 'function') window.approvalToggleLogs(true);
    setTimeout(sync, 60);
  }, true);
})();
