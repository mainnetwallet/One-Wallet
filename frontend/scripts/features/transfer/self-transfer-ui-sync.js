// ══════════════════════════════════════════════════════
// SELF TRANSFER — UI-ONLY HELPERS
// Presentation glue for the compact Self Transfer layout
// (html-src/partials/page-transfer-hub/self-transfer.html).
// It never writes to wallet, signing or transfer state: it only
//   * opens/closes the logs box (it only expands downwards: nothing above it changes and nothing scrolls by itself),
//   * slides the Native/Token thumb and swaps the native / token amount field,
//   * mirrors the native coin symbol into the unit label,
//   * drives the TXs-per-wallet stepper and the quick amount chips by
//     writing to the same inputs the transfer already reads.
// ══════════════════════════════════════════════════════
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  function setText(el, txt) {
    if (el && el.textContent !== txt) el.textContent = txt;
  }

  function fire(el) {
    if (!el) return;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // Logs header: collapse / expand the log box (collapsed by default)
  window.selfToggleLogs = function (open) {
    var box = $('selfLogs'), ui = $('selfTransferUI');
    if (!box) return;
    var willOpen = typeof open === 'boolean' ? open : box.classList.contains('collapsed');
    box.classList.toggle('collapsed', !willOpen);
    if (ui) ui.classList.toggle('st-logs-open', willOpen);
  };

  // TXs per wallet stepper (1 - 100, same limits as the input)
  window.selfStepTxCount = function (delta) {
    var el = $('txCountPerWallet');
    if (!el) return;
    var n = parseInt(el.value, 10);
    if (!(n > 0)) n = 1;
    n = Math.max(1, Math.min(100, n + delta));
    el.value = String(n);
    fire(el);
  };

  // Quick amount chip (native mode)
  window.selfSetAmount = function (v) {
    var el = $('amountPerTx');
    if (!el) return;
    el.value = v;
    fire(el);
  };

  function nativeSymbol() {
    try {
      var rpc = $('rpcUrlSelfTransfer');
      var id = rpc && parseInt(rpc.getAttribute('data-chainid'), 10);
      if (id && typeof getAllTHChains === 'function') {
        var c = getAllTHChains().find(function (x) { return x.chainId === id; });
        if (c && c.symbol) return c.symbol;
      }
    } catch (e) { /* fall through */ }
    return 'ETH';
  }

  // Native / Token switch: slide the thumb and show the matching amount field
  function syncSeg(ui) {
    var seg = ui.querySelector('.bt-seg');
    var tok = $('selfTokenModeBtn');
    if (!seg || !tok) return;
    var mode = tok.classList.contains('active') ? 'token' : 'native';
    if (seg.getAttribute('data-mode') !== mode) seg.setAttribute('data-mode', mode);
    if (ui.getAttribute('data-mode') !== mode) ui.setAttribute('data-mode', mode);
    var tg = $('tokenAmountGroup');
    var want = mode === 'token' ? '' : 'none';
    if (tg && tg.style.display !== want) tg.style.display = want;
  }

  function sync() {
    var ui = $('selfTransferUI');
    if (!ui || ui.getClientRects().length === 0) return; // not on screen
    syncSeg(ui);
    var ns = nativeSymbol(), i;
    var units = ui.querySelectorAll('.bt-unit-native');
    for (i = 0; i < units.length; i++) setText(units[i], ns);
  }

  setInterval(sync, 600);
  document.addEventListener('input', function () { setTimeout(sync, 0); }, true);
  document.addEventListener('click', function (e) {
    // Starting a transfer opens the logs so progress is visible without scrolling
    var t = e.target && e.target.closest ? e.target.closest('#executeSelfTransferBtn') : null;
    if (t && !t.disabled && typeof window.selfToggleLogs === 'function') window.selfToggleLogs(true);
    setTimeout(sync, 60);
  }, true);
})();
