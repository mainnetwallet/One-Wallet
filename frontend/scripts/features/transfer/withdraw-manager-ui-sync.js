// ══════════════════════════════════════════════════════
// WITHDRAW MANAGER — UI-ONLY HELPERS
// Presentation glue for the compact Withdraw Manager layout
// (html-src/partials/page-transfer-hub/withdraw-manager.html).
// It never touches wallet, signing or withdraw logic: it only
//   * opens/closes the logs box,
//   * shows the Native / Token switch for token contracts and mirrors it into data-mode
//     (CSS then shows the matching Withdraw button; both buttons keep their own
//     enabled/disabled state from checkWithdrawExecuteReady),
//   * clears the token address when switching to Native, because the existing logic
//     only enables Withdraw Native while that field is empty,
//   * mirrors mode / readiness into the summary strip and tidies the button labels,
//   * marks the selected contract row.
// ══════════════════════════════════════════════════════
(function () {
  'use strict';

  var lastKey = '';       // contract address + type: reset the mode when the contract changes
  var lastTokenAddr = ''; // remembered so Native -> Token can restore what was typed

  function $(id) { return document.getElementById(id); }

  function setText(el, txt) {
    if (el && el.textContent !== txt) el.textContent = txt;
  }

  function isToken() {
    var t = $('selectedContractType');
    return !!t && /token/i.test(t.textContent || '');
  }

  function isOpen(el) {
    return !!el && el.style.display !== 'none' && el.getClientRects().length > 0;
  }

  // Logs header: collapse / expand the log box (collapsed by default)
  window.wdToggleLogs = function (open) {
    var box = $('wdLogs');
    if (!box) return;
    var willOpen = typeof open === 'boolean' ? open : box.classList.contains('collapsed');
    box.classList.toggle('collapsed', !willOpen);
  };

  function fire(el) {
    if (!el) return;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // Native / Token switch (token contracts only)
  window.wdPickMode = function (mode) {
    var ui = $('withdrawManagerUI');
    var tok = $('withdrawTokenAddress');
    if (!ui) return;
    if (mode === 'native') {
      if (tok && tok.value.trim() !== '') { lastTokenAddr = tok.value; tok.value = ''; fire(tok); }
    } else if (tok) {
      if (tok.value.trim() === '' && lastTokenAddr) { tok.value = lastTokenAddr; fire(tok); }
      setTimeout(function () { if (!tok.value) tok.focus(); }, 0);
    }
    ui.setAttribute('data-mode', mode);
    sync();
  };

  function sync() {
    var ui = $('withdrawManagerUI');
    if (!ui || ui.getClientRects().length === 0) return; // not on screen

    var sel = window.selectedWithdrawContract || null;
    var token = isToken();
    var key = sel ? (sel.address + '|' + (sel.type || '')) : '';

    // New contract selected: token contracts start in Token mode (token address is what they need), native contracts in Native mode
    if (key !== lastKey) {
      lastKey = key;
      lastTokenAddr = '';
      ui.setAttribute('data-mode', token ? 'token' : 'native');
    }
    if (!token && ui.getAttribute('data-mode') !== 'native') ui.setAttribute('data-mode', 'native');
    var mode = ui.getAttribute('data-mode') === 'token' ? 'token' : 'native';

    // Switch only for token contracts that are selected
    var wrap = $('wdModeWrap');
    var showSwitch = !!sel && token;
    if (wrap && (wrap.style.display === 'none') === showSwitch) wrap.style.display = showSwitch ? '' : 'none';
    var seg = wrap && wrap.querySelector('.bt-seg');
    if (seg && seg.getAttribute('data-mode') !== mode) seg.setAttribute('data-mode', mode);
    var nb = $('wdNativeModeBtn'), tb = $('wdTokenModeBtn');
    if (nb) nb.classList.toggle('active', mode === 'native');
    if (tb) tb.classList.toggle('active', mode === 'token');

    // Token address field belongs to Token mode only (the existing logic shows it for token contracts)
    var grp = $('tokenAddressGroup');
    if (grp) {
      var hide = mode === 'native';
      if (grp.hasAttribute('data-wd-hidden') !== hide) {
        if (hide) grp.setAttribute('data-wd-hidden', '1'); else grp.removeAttribute('data-wd-hidden');
      }
    }

    // Summary strip: what will be withdrawn and whether the active button is ready
    setText($('wdSumMode'), mode === 'token' ? 'Token' : 'Native');
    var btn = $(mode === 'token' ? 'withdrawTokenBtn' : 'withdrawNativeBtn');
    var busy = !!(btn && btn.querySelector('span span'));
    var state;
    if (busy) state = 'Processing…';
    else if (btn && !btn.disabled) state = 'Ready';
    else {
      var os = $('ownershipStatus');
      var verified = !!(os && isOpen(os) && /verified/i.test(($('ownershipTitle') || {}).textContent || ''));
      var rcpt = (($('withdrawRecipient') || {}).value || '').trim() !== '';
      var tokAddr = (($('withdrawTokenAddress') || {}).value || '').trim() !== '';
      if (!verified) state = 'Verify owner';
      else if (!rcpt) state = 'Add recipient';
      else if (mode === 'token' && !tokAddr) state = 'Add token contract';
      else state = 'Not ready';
    }
    setText($('wdSumState'), state);

    // Button labels: the old logic writes emoji labels, show plain text (unless a spinner is shown)
    var nBtn = $('withdrawNativeBtn'), tBtn = $('withdrawTokenBtn');
    if (nBtn && !nBtn.querySelector('span') && nBtn.textContent.trim() !== 'Withdraw native') nBtn.textContent = 'Withdraw native';
    if (tBtn && !tBtn.querySelector('span') && tBtn.textContent.trim() !== 'Withdraw token') tBtn.textContent = 'Withdraw token';

    // Mark the selected contract row
    var addr = sel ? sel.address : null;
    var rows = document.querySelectorAll('#contractsList [data-contract-addr]');
    for (var i = 0; i < rows.length; i++) {
      rows[i].classList.toggle('wd-sel', !!addr && rows[i].getAttribute('data-contract-addr') === addr);
    }
  }

  // Token address field stays out of sight in Native mode, whatever the old logic does with its display
  var st = document.createElement('style');
  st.textContent = '#withdrawManagerUI #tokenAddressGroup[data-wd-hidden]{display:none !important;}';
  document.head.appendChild(st);

  setInterval(sync, 500);
  document.addEventListener('input', function () { setTimeout(sync, 0); }, true);
  document.addEventListener('click', function (e) {
    // Starting a withdrawal opens the logs so progress is visible without scrolling
    var t = e.target && e.target.closest ? e.target.closest('#withdrawNativeBtn, #withdrawTokenBtn') : null;
    if (t && !t.disabled && typeof window.wdToggleLogs === 'function') window.wdToggleLogs(true);
    setTimeout(sync, 60);
  }, true);
})();
