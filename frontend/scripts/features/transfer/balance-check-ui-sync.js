// ══════════════════════════════════════════════════════
// BALANCE CHECK — UI-ONLY HELPERS
// Presentation glue for the compact Balance Check layout
// (html-src/partials/page-transfer-hub/balance-check.html).
// It never touches balance, RPC or export logic: it only
//   * opens/closes the logs box (and opens it when a check starts),
//   * drives the Native / Token switch: Native = token address empty (the rule
//     checkBalances already uses), Token = show the token contract field,
//   * shows how many addresses / keys were found in the wallets box,
//   * copies an address from a result row.
// ══════════════════════════════════════════════════════
(function () {
  'use strict';

  var lastTokenAddr = ''; // remembered so Native -> Token restores what was typed

  function $(id) { return document.getElementById(id); }

  function setText(el, txt) {
    if (el && el.textContent !== txt) el.textContent = txt;
  }

  window.bcToggleLogs = function (open) {
    var box = $('bcLogs');
    if (!box) return;
    var willOpen = typeof open === 'boolean' ? open : box.classList.contains('collapsed');
    box.classList.toggle('collapsed', !willOpen);
  };

  window.bcPickMode = function (mode) {
    var ui = $('balanceCheckUI');
    var tok = $('tokenAddressBalanceCheck');
    if (!ui) return;
    if (mode === 'native') {
      if (tok && tok.value.trim() !== '') { lastTokenAddr = tok.value; tok.value = ''; }
    } else if (tok) {
      if (tok.value.trim() === '' && lastTokenAddr) tok.value = lastTokenAddr;
      setTimeout(function () { if (!tok.value) tok.focus(); }, 0);
    }
    ui.setAttribute('data-mode', mode === 'token' ? 'token' : 'native');
    sync();
  };

  window.bcCopy = function (text, btn) {
    function done() {
      var ic = btn && btn.querySelector('.material-icons-round');
      if (!ic) return;
      ic.textContent = 'check';
      setTimeout(function () { ic.textContent = 'content_copy'; }, 1000);
    }
    function legacy() {
      try {
        var ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy');
        document.body.removeChild(ta); done();
      } catch (_) {}
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, legacy);
    else legacy();
  };

  function sync() {
    var ui = $('balanceCheckUI');
    if (!ui || ui.getClientRects().length === 0) return; // not on screen

    // Token field filled from elsewhere (e.g. a restore): show it
    var tok = $('tokenAddressBalanceCheck');
    var mode = ui.getAttribute('data-mode') === 'token' ? 'token' : 'native';
    if (mode === 'native' && tok && tok.value.trim() !== '') { mode = 'token'; ui.setAttribute('data-mode', 'token'); }

    var seg = ui.querySelector('.bt-seg');
    if (seg && seg.getAttribute('data-mode') !== mode) seg.setAttribute('data-mode', mode);
    var nb = $('bcNativeModeBtn'), tb = $('bcTokenModeBtn');
    if (nb) nb.classList.toggle('active', mode === 'native');
    if (tb) tb.classList.toggle('active', mode === 'token');

    // Wallets found: reuse the parser checkBalances uses (66 chars = key, 42 chars = address)
    var input = $('inputBalanceCheck');
    var text = input ? input.value : '';
    var n = 0, keys = 0, addrs = 0;
    if (text.trim() !== '' && typeof parseKeysFromAnyFormat === 'function') {
      try {
        var items = parseKeysFromAnyFormat(text) || [];
        for (var i = 0; i < items.length; i++) {
          if (items[i].length === 66) keys++; else if (items[i].length === 42) addrs++;
        }
        n = keys + addrs;
      } catch (_) {}
    }
    setText($('bcFoundCount'), n + ' found');
    var d = $('bcFoundDetail');
    if (d) {
      setText(d, n > 0
        ? addrs + ' address' + (addrs === 1 ? '' : 'es') + ' · ' + keys + ' key' + (keys === 1 ? '' : 's') + ' · labels and invalid lines are ignored'
        : 'Addresses and private keys · labels and invalid lines are ignored');
    }
  }

  setInterval(sync, 600);
  document.addEventListener('input', function () { setTimeout(sync, 0); }, true);
  document.addEventListener('click', function (e) {
    // Starting a check opens the logs so progress is visible without scrolling
    var t = e.target && e.target.closest ? e.target.closest('#checkBalancesBtn') : null;
    if (t && !t.disabled && typeof window.bcToggleLogs === 'function') window.bcToggleLogs(true);
    setTimeout(sync, 60);
  }, true);
})();
