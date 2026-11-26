
// ══ Exchange Deposit Modal ══
(function() {
  var __NX = window.__nxp.mod_deposit_modal; delete window.__nxp.mod_deposit_modal;


  // ── Token modal open/close ──
  window.excDepTokenModalOpen = function() {
    var ov = document.getElementById('exc-dep-tok-overlay');
    var sh = document.getElementById('exc-dep-tok-sheet');
    if (!ov || !sh) return;
    __NX._renderDepTokenList('');
    ov.style.display = 'block';
    requestAnimationFrame(function() {
      requestAnimationFrame(function() { sh.style.transform = 'translateY(0)'; });
    });
    // no auto-focus — prevents keyboard popup on Android
  };

  window.excDepTokenModalClose = function(e, force) {
    if (!force && e && e.target !== document.getElementById('exc-dep-tok-overlay')) return;
    var ov = document.getElementById('exc-dep-tok-overlay');
    var sh = document.getElementById('exc-dep-tok-sheet');
    if (!sh) return;
    sh.style.transform = 'translateY(100%)';
    setTimeout(function() { if (ov) ov.style.display = 'none'; }, 300);
  };

  window.excDepTokenSelect = function(sym) {
    var info = __NX._getDepTokenInfo(sym);
    __NX._depState.sym       = sym;
    __NX._depState.name      = info.name;
    __NX._depState.icon      = info.icon;
    __NX._depState.iconColor = info.iconColor;
    // Update all header references
    var hSymEl  = document.getElementById('exc-dep-coin-sym');
    var warnSym = document.getElementById('exc-dep-warn-sym');
    var iconEl  = document.getElementById('exc-dep-coin-icon');
    var nameEl  = document.getElementById('exc-dep-coin-name');
    if (hSymEl)  hSymEl.textContent  = sym;
    if (warnSym) warnSym.textContent = sym;
    if (iconEl)  { iconEl.textContent = info.icon; iconEl.style.background = info.iconColor; }
    if (nameEl)  nameEl.textContent  = info.name;
    // Update selector button
    __NX._updateDepTokenBtn(sym);
    // Immediately clear all stale data
    __NX._depState.selectedNet = null;
    __NX._depState.addr = '';
    __NX._depState.memo = '';
    __NX._setAddrLoading();
    // Clear network label
    var netLabel = document.getElementById('exc-dep-net-label');
    var netSub   = document.getElementById('exc-dep-net-sub');
    if (netLabel) netLabel.textContent = 'Loading…';
    if (netSub)   netSub.textContent   = '';
    // Clear net list
    var netList = document.getElementById('exc-dep-net-list');
    if (netList) netList.innerHTML = '';
    // Close modal, fetch live chains
    excDepTokenModalClose(null, true);
    __NX._loadExcChains(sym);
  };

  // ── Public open function ──
  window.excDepositOpen = function(opts) {
    opts = opts || {};
    __NX._depState.sym       = opts.sym       || 'USDT';
    __NX._depState.name      = opts.name      || 'Tether USD';
    __NX._depState.icon      = opts.icon      || '₮';
    __NX._depState.iconColor = opts.iconColor || '#26a17b';

    var iconEl = document.getElementById('exc-dep-coin-icon');
    if (iconEl) { iconEl.textContent = __NX._depState.icon; iconEl.style.background = __NX._depState.iconColor; }
    var symEl = document.getElementById('exc-dep-coin-sym');
    if (symEl) symEl.textContent = __NX._depState.sym;
    var nameEl = document.getElementById('exc-dep-coin-name');
    if (nameEl) nameEl.textContent = __NX._depState.name;
    var warnSym = document.getElementById('exc-dep-warn-sym');
    if (warnSym) warnSym.textContent = __NX._depState.sym;

    __NX._depState.selectedNet = null;
    __NX._renderTokenChips(__NX._depState.sym);
    // Show loading state — chains will render once API responds
    __NX._renderNets(__NX._depState.sym, null);
    __NX._updateAddrAndQR();

    var ov = document.getElementById('exc-deposit-overlay');
    var sh = document.getElementById('exc-deposit-sheet');
    if (ov && sh) {
      ov.style.display = 'block';
      requestAnimationFrame(function() {
        requestAnimationFrame(function() { sh.style.transform = 'translateY(0)'; });
      });
    }

    // Async: try to fetch live chain list from exchange API
    __NX._loadExcChains(__NX._depState.sym);
  };

  window.excDepositClose = function(e) {
    if (e && e.target !== document.getElementById('exc-deposit-overlay')) return;
    __NX._doClose();
  };
  window.excDepositCloseBtn = function() { __NX._doClose(); };

  // ── Network select modal open/close ──
  window.excDepositNetModalOpen = function() {
    var ov = document.getElementById('exc-dep-net-overlay');
    var sh = document.getElementById('exc-dep-net-sheet');
    if (!ov || !sh) return;
    ov.style.display = 'block';
    requestAnimationFrame(function() {
      requestAnimationFrame(function() { sh.style.transform = 'translateY(0)'; });
    });
  };
  window.excDepositNetModalClose = function(e, force) {
    if (!force && e && e.target !== document.getElementById('exc-dep-net-overlay')) return;
    var ov = document.getElementById('exc-dep-net-overlay');
    var sh = document.getElementById('exc-dep-net-sheet');
    if (!sh) return;
    sh.style.transform = 'translateY(100%)';
    setTimeout(function() { if (ov) ov.style.display = 'none'; }, 280);
  };

  window.excDepositCopyAddr = function() {
    var addr = __NX._depState.addr;
    if (!addr) { if (typeof showToast==='function') showToast('No address available'); return; }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(addr).then(function(){
        if (typeof showToast==='function') showToast('Address copied!');
      }).catch(function(){__NX._fallbackCopy(addr);});
    } else { __NX._fallbackCopy(addr); }
  };

  window.excDepositCopyMemo = function() {
    var memo = __NX._depState.memo;
    if (!memo) { if (typeof showToast==='function') showToast('No memo/tag available'); return; }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(memo).then(function(){
        if (typeof showToast==='function') showToast('Memo copied!');
      }).catch(function(){__NX._fallbackCopy(memo);});
    } else { __NX._fallbackCopy(memo); }
  };

  // ── Export chain fetcher for withdraw modal (cache stays separate) ──
  window._fetchExcChains = __NX._fetchExcChains;

  window._fetchExcChainsForWithdraw = __NX._fetchExcChainsForWithdraw;

})();
