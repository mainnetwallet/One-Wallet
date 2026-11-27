// ══════════════════════════════════════════════════════
// BATCH TRANSFER — UI-ONLY HELPERS
// Presentation glue for the compact Batch Transfer layout
// (html-src/partials/page-transfer-hub/batch-transfer.html).
// It never writes to wallet, signing or transfer state: it only
//   * steps the batch size inputs (btStep),
//   * opens/closes the saved-contracts panel (btToggleContracts),
//   * mirrors units, recipient counts and the active contract into labels,
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

  // − / + buttons next to the batch size inputs
  window.btStep = function (id, delta) {
    var el = $(id);
    if (!el) return;
    var min = parseInt(el.min, 10); if (isNaN(min)) min = 1;
    var max = parseInt(el.max, 10); if (isNaN(max)) max = 100;
    var v = parseInt(el.value, 10); if (isNaN(v)) v = min;
    v = Math.min(max, Math.max(min, v + delta));
    el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  // Chevron on the contract row: show / hide the saved contracts list
  window.btToggleContracts = function (mode) {
    var card = $(mode === 'token' ? 'btContractCardToken' : 'btContractCardNative');
    if (card) card.classList.toggle('open');
  };

  // Logs header: collapse / expand the log box (expanded by default)
  window.btToggleLogs = function (mode) {
    var box = $(mode === 'token' ? 'btLogsToken' : 'btLogsNative');
    if (box) box.classList.toggle('collapsed');
  };

  // Native / Token switch: slide the thumb to the active mode
  function syncSeg() {
    var seg = document.querySelector('#batchTransferUI .bt-seg');
    var tok = $('tokenModeBtn');
    if (!seg || !tok) return;
    var mode = tok.classList.contains('active') ? 'token' : 'native';
    if (seg.getAttribute('data-mode') !== mode) seg.setAttribute('data-mode', mode);
    var root = $('batchTransferUI');   // lets the stylesheet scope tweaks to one mode
    if (root && root.getAttribute('data-mode') !== mode) root.setAttribute('data-mode', mode);
  }

  function nativeSymbol() {
    try {
      if (typeof currentChainConfig !== 'undefined' && currentChainConfig && currentChainConfig.symbol) {
        return currentChainConfig.symbol;
      }
    } catch (e) { /* fall through */ }
    return 'ETH';
  }

  function tokenSymbol() {
    var el = $('tokenSymbol');
    return (el && el.value && el.value.trim()) || 'TOKEN';
  }

  function mirror(srcId, dstId) {
    var src = $(srcId), dst = $(dstId);
    if (src && dst) setText(dst, (src.textContent || '').trim() || '0');
  }

  // Summary of the active saved contract, derived from what renderSavedContracts*() drew
  function syncContract(listId, countId, prefixId, valId, verId) {
    var list = $(listId);
    var prefix = $(prefixId), val = $(valId);
    var ver = verId ? $(verId) : null;
    if (!list || !prefix || !val) return;

    var link = list.querySelector('.saved-contract-item.active .saved-contract-address a');
    var countEl = $(countId);
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
    var ui = $('batchTransferUI');
    if (!ui || ui.getClientRects().length === 0) return; // not on screen

    syncSeg();
    var ns = nativeSymbol(), ts = tokenSymbol(), i;
    var nUnits = ui.querySelectorAll('.bt-unit-native');
    for (i = 0; i < nUnits.length; i++) setText(nUnits[i], ns);
    var tUnits = ui.querySelectorAll('.bt-unit-token');
    for (i = 0; i < tUnits.length; i++) setText(tUnits[i], ts);

    mirror('totalAddresses', 'btRecipCount');
    mirror('totalAddressesToken', 'btRecipCountToken');

    syncContract('savedContractsList', 'savedContractsCount', 'btContractPrefix', 'btContractVal', 'btContractVer');
    syncContract('savedContractsListToken', 'savedContractsCountToken', 'btContractPrefixToken', 'btContractValToken', null);

    markChips('amountPerAddress');
    markChips('amountPerAddressToken');
  }

  setInterval(sync, 600);
  document.addEventListener('input', function () { setTimeout(sync, 0); }, true);
  document.addEventListener('click', function () { setTimeout(sync, 60); }, true);
})();
