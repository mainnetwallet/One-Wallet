// ══════════════════════════════════════════════════════
// WALLET TO WALLET — UI-ONLY HELPERS
// Presentation glue for the compact Wallet to Wallet layout
// (html-src/partials/page-transfer-hub/wallet-to-wallet.html).
// It never writes to wallet, signing or transfer state: it only
//   * opens/closes the logs box (it only expands downwards: nothing above it changes and nothing scrolls by itself),
//   * slides the Native/Token thumb,
//   * mirrors the native coin symbol into the unit labels,
//   * shows sender / receiver counts, the pair count and the summary line.
// Transfers still read the same textareas and inputs they always did.
// ══════════════════════════════════════════════════════
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  function setText(el, txt) {
    if (el && el.textContent !== txt) el.textContent = txt;
  }

  function countLines(id) {
    var el = $(id);
    if (!el || !el.value) return 0;
    var seen = {}, n = 0, lines = el.value.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i].trim();
      if (l && !seen[l]) { seen[l] = 1; n++; }
    }
    return n;
  }

  function fmt(n) {
    return String(Number(n.toFixed(8)));
  }

  // Logs header: collapse / expand the log box (collapsed by default)
  window.w2wToggleLogs = function (open) {
    var box = $('w2wLogs'), ui = $('walletToWalletUI');
    if (!box) return;
    var willOpen = typeof open === 'boolean' ? open : box.classList.contains('collapsed');
    box.classList.toggle('collapsed', !willOpen);
    if (ui) ui.classList.toggle('w2w-logs-open', willOpen);
  };

  function nativeSymbol() {
    try {
      var rpc = $('rpcUrlW2W');
      var id = rpc && parseInt(rpc.getAttribute('data-chainid'), 10);
      if (id && typeof getAllTHChains === 'function') {
        var c = getAllTHChains().find(function (x) { return x.chainId === id; });
        if (c && c.symbol) return c.symbol;
      }
    } catch (e) { /* fall through */ }
    return 'ETH';
  }

  // Native / Token switch: slide the thumb to the active mode
  function syncSeg(ui) {
    var seg = ui.querySelector('.bt-seg');
    var tok = $('w2wTokenModeBtn');
    if (!seg || !tok) return null;
    var mode = tok.classList.contains('active') ? 'token' : 'native';
    if (seg.getAttribute('data-mode') !== mode) seg.setAttribute('data-mode', mode);
    if (ui.getAttribute('data-mode') !== mode) ui.setAttribute('data-mode', mode);
    return mode;
  }

  function syncSide(sfx, keysId, recvId, amountId, warnId) {
    var s = countLines(keysId), r = countLines(recvId);
    var pairs = Math.min(s, r);
    var tag = sfx === 'Native' ? '' : 'Token';

    setText($(sfx === 'Native' ? 'w2wSenderCount' : 'w2wSenderCountToken'), String(s));
    setText($(sfx === 'Native' ? 'w2wReceiverCount' : 'w2wReceiverCountToken'), String(r));
    setText($(sfx === 'Native' ? 'w2wTotalSenders' : 'w2wTotalSendersToken'), String(s));
    setText($(sfx === 'Native' ? 'w2wTotalReceivers' : 'w2wTotalReceiversToken'), String(r));

    // Transfers pair sender 1 with receiver 1, and so on, so the shorter list decides how many run
    setText($(warnId), (s > 0 && r > 0 && s !== r) ? 'Only ' + pairs + ' pairs will run' : '');

    setText($('w2wPairs' + sfx), String(pairs));

    var raw = ($(amountId) && $(amountId).value || '').trim();
    var n = parseFloat(raw);
    var per, total;
    if (raw.toUpperCase() === 'MAX') { per = 'MAX'; total = 'all'; }
    else if (isFinite(n) && n > 0) { per = fmt(n); total = fmt(n * pairs); }
    else { per = '0'; total = '0'; }
    setText($('w2wPer' + sfx), per);
    setText($('w2wTotal' + sfx), total);
  }

  function sync() {
    var ui = $('walletToWalletUI');
    if (!ui || ui.getClientRects().length === 0) return; // not on screen

    var mode = syncSeg(ui);

    var ns = nativeSymbol(), i;
    var nUnits = ui.querySelectorAll('.bt-unit-native');
    for (i = 0; i < nUnits.length; i++) setText(nUnits[i], ns);

    if (mode === 'token') syncSide('Token', 'w2wSenderKeysToken', 'w2wReceiverKeysToken', 'w2wCustomAmountToken', 'w2wPairWarnToken');
    else syncSide('Native', 'w2wSenderKeys', 'w2wReceiverKeys', 'w2wCustomAmount', 'w2wPairWarnNative');
  }

  setInterval(sync, 600);
  document.addEventListener('input', function () { setTimeout(sync, 0); }, true);
  document.addEventListener('click', function (e) {
    // Starting a transfer opens the logs so progress is visible without scrolling
    var t = e.target && e.target.closest ? e.target.closest('#executeW2WBtn, #executeW2WTokenBtn') : null;
    if (t && !t.disabled && typeof window.w2wToggleLogs === 'function') window.w2wToggleLogs(true);
    setTimeout(sync, 60);
  }, true);
})();
