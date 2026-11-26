
// ── HOME WALLET GUARD: disable 🌐ALL & MANAGE when no wallet exists ──
// Strategy: CSS class .wg-no-wallet uses !important to override all inline styles.
// Guard wrappers on onclick/ontouch provide a second layer of blocking.
(function _homeWalletGuard() {

  function _hasWallet() {
    // ── Wallet SELECTED check (not just exists) ──
    // chain-switch-btn & home-manage-btn are enabled ONLY when
    // a wallet is actively selected (hwSelectedKey is set).
    if (typeof hwSelectedKey !== 'undefined' && hwSelectedKey) return true;
    // Fallback: check persisted selected key (for page-load before hwSelectedKey initialises)
    try {
      var sel = _oneGetSelectedKey();
      return !!sel;
    } catch(_){ return false; }
  }

  function _setDisabled(el, disabled) {
    if (!el) return;
    if (disabled) {
      el.classList.add('wg-no-wallet');
      el.dataset.wgDisabled = '1';
      // Force inline style override — wins over setActiveChain() inline styles
      el.style.setProperty('opacity',        '0.35',        'important');
      el.style.setProperty('filter',         'grayscale(0.6)', 'important');
      el.style.setProperty('pointer-events', 'none',        'important');
      el.style.setProperty('cursor',         'not-allowed', 'important');
    } else {
      el.classList.remove('wg-no-wallet');
      delete el.dataset.wgDisabled;
      el.style.removeProperty('opacity');
      el.style.removeProperty('filter');
      el.style.removeProperty('pointer-events');
      el.style.removeProperty('cursor');
      // Force re-enable with !important to override any stuck inline styles
      el.style.setProperty('pointer-events', 'auto', 'important');
      el.style.setProperty('opacity', '1', 'important');
      el.style.setProperty('filter', 'none', 'important');
      el.style.setProperty('cursor', 'pointer', 'important');
    }
  }

  function _applyGuard() {
    var hasWallet = _hasWallet();
    _setDisabled(document.getElementById('home-chain-btn'),  !hasWallet);
    _setDisabled(document.getElementById('home-manage-btn'), !hasWallet);
    _setDisabled(document.getElementById('home-scan-btn'),   !hasWallet);
  }

  // ── Inline onclick wrappers — PRIMARY block layer ──
  // These check wallet DIRECTLY — no timing/style dependency
  window.homeChainBtnClick = function() {
    if (!_hasWallet()) {
      showToast('Please add a wallet first!', 'account_balance_wallet');
      haptic(); return;
    }
    openHomeChainPicker();
  };
  window.homeManageBtnClick = function() {
    if (!_hasWallet()) {
      showToast('Please add a wallet first!', 'account_balance_wallet');
      haptic(); return;
    }
    openTokenManager();
  };
  window.homeScanBtnClick = function() {
    if (!_hasWallet()) {
      showToast('Please add a wallet first!', 'account_balance_wallet');
      haptic(); return;
    }
    homeOpenQrScan();
  };
  window.homeManageBtnPress = function(el, pressed) {
    if (!_hasWallet()) return;
    el.style.transform = pressed ? 'scale(0.93)' : '';
  };

  // ── Visual disable — runs repeatedly until DOM stable ──
  var _guardInterval = null;
  function _scheduleGuard() {
    // Immediate attempts
    setTimeout(_applyGuard, 0);
    setTimeout(_applyGuard, 100);
    setTimeout(_applyGuard, 500);
    setTimeout(_applyGuard, 1500);
    // Interval for 5 seconds to catch any late renderer
    clearInterval(_guardInterval);
    var _count = 0;
    _guardInterval = setInterval(function() {
      _applyGuard();
      if (++_count >= 20) clearInterval(_guardInterval);
    }, 250);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _scheduleGuard);
  } else {
    _scheduleGuard();
  }

  window.addEventListener('storage', function(e){
    if (e.key === 'one_wallet_groups') _applyGuard();
  });

  window.homeWalletGuardRefresh = _applyGuard;
})();
