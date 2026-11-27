// ══════════════════════════════════════════════════════
// MULTI KEY RECIPIENTS — UI-ONLY HELPERS
// Presentation glue for the compact Multi Key Recipients layout
// (html-src/partials/page-transfer-hub/multikey-native.html).
// It never writes to wallet, signing or transfer state: it only
//   * opens/closes the saved-contracts panel and the logs box,
//   * slides the Native/Token thumb and highlights the Direct/Contract choice,
//   * mirrors units, sender counts and the active contract into labels,
//   * highlights the quick-amount chip that matches the amount input.
// ══════════════════════════════════════════════════════
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  function setText(el, txt) {
    if (el && el.textContent !== txt) el.textContent = txt;
  }

  function shortAddr(a) {
    return a && a.length > 14 ? a.slice(0, 6) + '…' + a.slice(-4) : (a || '');
  }

  // Chevron on the contract row: show / hide the saved contracts list
  window.mkToggleContracts = function () {
    var card = $('mkContractCardNative');
    if (card) card.classList.toggle('open');
  };

  // Logs header: collapse / expand the log box (collapsed by default)
  window.mkToggleLogs = function (mode) {
    var box = $(mode === 'token' ? 'mkLogsToken' : 'mkLogsNative');
    if (box) box.classList.toggle('collapsed');
  };

  function nativeSymbol() {
    try {
      if (typeof currentMultiKeyNativeChainConfig !== 'undefined' && currentMultiKeyNativeChainConfig && currentMultiKeyNativeChainConfig.symbol) {
        return currentMultiKeyNativeChainConfig.symbol;
      }
      if (typeof currentMultiKeyTokenChainConfig !== 'undefined' && currentMultiKeyTokenChainConfig && currentMultiKeyTokenChainConfig.symbol) {
        return currentMultiKeyTokenChainConfig.symbol;
      }
    } catch (e) { /* fall through */ }
    return 'ETH';
  }

  function tokenSymbol() {
    var el = $('tokenSymbolMultiKeyToken');
    return (el && el.value && el.value.trim()) || 'TOKEN';
  }

  function mirror(srcId, dstId) {
    var src = $(srcId), dst = $(dstId);
    if (src && dst) setText(dst, (src.textContent || '').trim() || '0');
  }

  // Native / Token switch: slide the thumb to the active mode
  function syncSeg(ui) {
    var seg = ui.querySelector('.bt-seg');
    var tok = $('multiKeyTokenModeBtn');
    if (!seg || !tok) return;
    var mode = tok.classList.contains('active') ? 'token' : 'native';
    if (seg.getAttribute('data-mode') !== mode) seg.setAttribute('data-mode', mode);
    if (ui.getAttribute('data-mode') !== mode) ui.setAttribute('data-mode', mode);
  }

  // Direct / Contract: follow whichever section selectTransferMode() left visible
  function syncSend() {
    var seg = $('mkSendSeg'), dir = $('directTransferSection');
    var dBtn = $('directTransferModeCard'), cBtn = $('contractTransferModeCard');
    if (!seg || !dir || !dBtn || !cBtn) return;
    var direct = dir.style.display !== 'none';
    seg.setAttribute('data-send', direct ? 'direct' : 'contract');
    dBtn.classList.toggle('active', direct);
    cBtn.classList.toggle('active', !direct);
  }

  // Summary of the active saved contract, derived from what renderSavedContractsMultiKeyNative() drew
  function syncContract() {
    var list = $('savedContractsListMultiKeyNative');
    var prefix = $('mkContractPrefix'), val = $('mkContractVal'), ver = $('mkContractVer');
    if (!list || !prefix || !val) return;

    var link = list.querySelector('.saved-contract-item.active .saved-contract-address a');
    var countEl = $('savedContractsCountMultiKeyNative');
    var n = countEl ? (parseInt(countEl.textContent, 10) || 0) : 0;

    if (link) {
      setText(prefix, 'Contract');
      setText(val, shortAddr(link.title || link.textContent));
      if (ver) ver.hidden = false;
    } else if (list.classList.contains('active') && n > 0) {
      setText(prefix, 'Contract');
      setText(val, n + ' saved · none selected');
      if (ver) ver.hidden = true;
    } else {
      setText(prefix, 'No contract');
      setText(val, '');
      if (ver) ver.hidden = true;
    }
  }

  function markChips(inputId) {
    var input = $(inputId);
    if (!input) return;
    var card = input.closest ? input.closest('.bt-card') : null;
    if (!card) return;
    var v = parseFloat(input.value);
    var chips = card.querySelectorAll('.bt-chips .btn');
    for (var i = 0; i < chips.length; i++) {
      var cv = parseFloat(chips[i].textContent);
      chips[i].classList.toggle('active', !isNaN(v) && v > 0 && cv === v);
    }
  }

  function sync() {
    var ui = $('multiKeyNativeUI');
    if (!ui || ui.getClientRects().length === 0) return; // not on screen

    syncSeg(ui);
    syncSend();

    var ns = nativeSymbol(), ts = tokenSymbol(), i;
    var nUnits = ui.querySelectorAll('.bt-unit-native');
    for (i = 0; i < nUnits.length; i++) setText(nUnits[i], ns);
    var tUnits = ui.querySelectorAll('.bt-unit-token');
    for (i = 0; i < tUnits.length; i++) setText(tUnits[i], ts);

    mirror('totalSendersMultiKeyNative', 'mkSendersCountNative');
    mirror('totalSendersMultiKeyNative', 'mkValidNative');
    mirror('totalSendersMultiKeyToken', 'mkSendersCountToken');
    mirror('totalSendersMultiKeyToken', 'mkValidToken');

    syncContract();

    markChips('amountPerAddressMultiKeyNative');
    markChips('amountPerAddressMultiKeyToken');
  }

  setInterval(sync, 600);
  document.addEventListener('input', function () { setTimeout(sync, 0); }, true);
  document.addEventListener('click', function () { setTimeout(sync, 60); }, true);
})();
