
function _swSelectWalletFromPanel(pk, addr) {
  if (SW.walletAddress === addr) {
    // Deselect — same wallet clicked again
    SW.walletConnected = false;
    SW.walletAddress   = '';
    SW.walletPK        = null;
    // Clear stale balances so UI shows '—' instead of previous wallet's balance
    if (SW.fromToken) SW.fromToken.balance = undefined;
    if (SW.toToken)   SW.toToken.balance   = undefined;
    try { localStorage.removeItem('one_sw_signer'); } catch(_) {}
  } else {
    SW.walletConnected = true;
    SW.walletAddress   = addr;
    SW.walletPK        = pk;
    // Clear stale balances from previous wallet before fetching new ones
    if (SW.fromToken) SW.fromToken.balance = undefined;
    if (SW.toToken)   SW.toToken.balance   = undefined;
    OneCrypto.encrypt(pk).then(function(_encPk) {
      try { localStorage.setItem('one_sw_signer', JSON.stringify({ addr, encPk: _encPk })); } catch(_) {}
    });
  }
  _swUpdateConnectBtn();
  swUpdateButton();
  if (typeof _nxsw_swUpdateBalances === 'function') _nxsw_swUpdateBalances();
  _swRenderWalletPanel();
  // ── Re-render token list so balances reflect the newly selected wallet ──
  if (typeof swRenderTokenList === 'function' && typeof _swAllTokens !== 'undefined') {
    setTimeout(function() { swRenderTokenList(_swAllTokens); }, 50);
  }
  if (SW.walletConnected) {
    window.swCloseWalletPanel();
    if (typeof haptic === 'function') haptic();
    // Auto-fetch quotes if amount already entered
    const _swAmt = parseFloat((document.getElementById('sw-from-amount') || {}).value);
    if (_swAmt > 0 && SW.fromToken && SW.toToken) {
      clearTimeout(SW.quoteTimer);
      SW.quoteTimer = setTimeout(swFetchQuotes, 400);
    }
  }
}

function _swUpdateConnectBtn() {
  // Also sync SW state from localStorage if somehow disconnected (belt-and-suspenders)
  if (!SW.walletConnected) {
    try {
      const saved = JSON.parse(localStorage.getItem('one_sw_signer') || 'null');
      if (saved && saved.addr && (saved.encPk || saved.pk)) {
        const _rawPk5 = saved.encPk || saved.pk;
        Promise.resolve(OneCrypto.decrypt(_rawPk5)).then(function(plainPk5) {
          if (!plainPk5) return;
          SW.walletConnected = true;
          SW.walletAddress   = saved.addr;
          SW.walletPK        = plainPk5;
          // Migrate legacy plaintext
          if (!saved.encPk) {
            OneCrypto.encrypt(plainPk5).then(function(enc5) {
              try { localStorage.setItem('one_sw_signer', JSON.stringify({ addr: saved.addr, encPk: enc5 })); } catch(_) {}
            });
          }
        }).catch(function() {});
      }
    } catch(_) {}
  }
  const icon  = document.getElementById('sw-connect-icon');
  const label = document.getElementById('sw-connect-label');
  const addr  = document.getElementById('sw-connect-addr');
  const btn   = document.getElementById('sw-connect-btn');
  if (SW.walletConnected && SW.walletAddress) {
    if (icon)  { icon.style.color = 'var(--accent-green)'; icon.textContent = 'check_circle'; }
    if (label) label.textContent  = 'Connected';
    if (addr)  { addr.textContent = SW.walletAddress.slice(0,6) + '\u2026' + SW.walletAddress.slice(-4); addr.style.display = 'block'; }
    if (btn)   { btn.style.borderColor = 'rgba(16,185,129,0.4)'; btn.style.background = 'rgba(16,185,129,0.08)'; }
  } else {
    if (icon)  { icon.style.color = 'var(--accent-primary)'; icon.textContent = 'account_balance_wallet'; }
    if (label) label.textContent  = 'Connect';
    if (addr)  addr.style.display = 'none';
    if (btn)   { btn.style.borderColor = ''; btn.style.background = 'var(--bg-glass)'; }
  }
  // Always sync action button label after connect state changes
  swUpdateButton();
}

// Auto-sync connect button on every swap page visit + on load
(function _autoSyncConnectBtn() {
  function _sync() {
    if (typeof _swUpdateConnectBtn === 'function') _swUpdateConnectBtn();
  }
  // On DOMContentLoaded (catches first load)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(_sync, 300); setTimeout(_sync, 800); });
  } else {
    setTimeout(_sync, 300);
  }
  // Patch switchPage to re-sync whenever swap tab is opened
  const _origSP = window.switchPage;
  if (typeof _origSP === 'function') {
    window.switchPage = function(page) {
      _origSP.apply(this, arguments);
      if (page === 'swap') setTimeout(_sync, 50);
    };
  } else {
    // switchPage not yet defined — retry after DOM ready
    document.addEventListener('DOMContentLoaded', function() {
      const _sp2 = window.switchPage;
      if (typeof _sp2 === 'function') {
        window.switchPage = function(page) {
          _sp2.apply(this, arguments);
          if (page === 'swap') setTimeout(_sync, 50);
        };
      }
    });
  }
})();

