
// BUG FIX 9: RANGO_KEY ৬ জায়গায় duplicate ছিল — একটি global constant এ রাখা হলো
// সব function scope এর RANGO_KEY এখন এটি fallback হিসেবে ব্যবহার করে
window._ONE_RANGO_KEY = 'c6381a79-2817-4602-83bf-6a641a409e32';

/* ── Universal chain logo helpers (declared early for hoisting) ── */
function _chainLogoHtml(logoURI, emoji, size) {
  size = size || 28;
  var r = size <= 20 ? '50%' : (size <= 24 ? '6px' : '8px');
  if (!logoURI) return '<span style="font-size:'+(size*0.75)+'px;line-height:1;">' + emoji + '</span>';
  return '<span class="clogo-wrap" data-logo="' + logoURI + '" data-fb="' + (emoji||'🔗').replace(/"/g,'&quot;') + '" style="display:flex;align-items:center;justify-content:center;width:'+size+'px;height:'+size+'px;">'
       + '<span class="clogo-fb" style="font-size:'+(size*0.75)+'px;line-height:1;">' + (emoji||'🔗') + '</span>'
       + '</span>';
}
function _fixChainLogos(containerEl) {
  if (!containerEl) return;
  containerEl.querySelectorAll('.clogo-wrap[data-logo]').forEach(function(wrap) {
    var logo = wrap.dataset.logo, fb = wrap.dataset.fb || '🔗';
    var size = wrap.offsetWidth || parseInt(wrap.style.width) || 28;
    var r = size <= 20 ? '50%' : (size <= 24 ? '6px' : '8px');
    var img = new Image();
    img.onload = function() {
      if (!wrap.isConnected) return;
      wrap.innerHTML = '';
      var el = document.createElement('img');
      el.src = logo;
      el.style.cssText = 'width:'+size+'px;height:'+size+'px;border-radius:'+r+';object-fit:cover;display:block;';
      wrap.appendChild(el);
    };
    img.onerror = function() {};
    img.src = logo;
  });
}

// ── CLOCK ──

// ── OVERLAY RESET — runs on every page load/reopen ──
// Fixes stuck overlays (from previous session) that block home screen touches
(function _oneResetAllOverlays() {
  function _doReset() {
    // 1. Force-close all inline-style overlays (pointer-events based)
    const _inlineOverlays = [
      'sw-wallet-panel-overlay', 'br-wallet-panel-overlay',
      'hw-group-overlay',
      'tm-chain-overlay', 'send-to-wg-overlay',
    ];
    _inlineOverlays.forEach(function(id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
    });

    // 2. Reset panels that slide in
    const _panels = [
      { id:'sw-wallet-panel',  transform:'translateX(100%)' },
      { id:'br-wallet-panel',  transform:'translateX(100%)' },
      { id:'hw-group-modal',   transform:'translateX(100%)' },
    ];
    _panels.forEach(function(p) {
      const el = document.getElementById(p.id);
      if (el) el.style.transform = p.transform;
    });

    // 3. Remove .open class from class-based overlays
    const _classOverlays = [
      'pcp-overlay','sw-chain-overlay','hcp-overlay','th-chain-overlay',
      'tm-overlay','pm-overlay','txh-overlay','wg-edit-overlay',
      'wgm-overlay','receive-overlay','addr-list-overlay',
      'wg-import-overlay','wg-picker-overlay',
      'send-overlay','del-group-drawer-overlay','cw-drawer-overlay',
      'swap-wallet-drawer-overlay','rpc-manager-overlay',
    ];
    _classOverlays.forEach(function(id) {
      const el = document.getElementById(id);
      if (el) el.classList.remove('open');
    });

    // 4. Ensure body overflow is not stuck hidden
    document.body.style.overflow = '';
    document.body.style.overflowY = '';

  }

  // Run immediately (DOM ready) and again after load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _doReset);
  } else {
    _doReset();
  }
  window.addEventListener('load', function() { setTimeout(_doReset, 50); });
})();

// ── APP OPEN — instant restore then silent background refresh ──
window.addEventListener('load', () => {
  const appEl = document.getElementById('app');
  if (appEl) appEl.classList.add('visible');

  // ── STEP 0-PRE: Instant NO WALLET state — zero delay, synchronous ──
  // If no wallet key exists, inject the empty state immediately so there's no
  // blank flash or wait for loadTokens() to run.
  (function _instantNoWallet() {
    try {
      var _wk = _oneGetSelectedKey();
      if (_wk) return; // wallet exists → skip
      // Selection is stored but still being decrypted → wallet exists, don't flash the empty state
      try { if (localStorage.getItem('one_hw_selected_key_v1')) return; } catch(e) {}
      var _tl = document.getElementById('token-list');
      if (!_tl) return;
      // Remove skeletons
      ['skel1','skel2','skel3'].forEach(function(id) {
        var s = document.getElementById(id); if (s) s.remove();
      });
      _tl.innerHTML =
        '<div style="text-align:center;padding:48px 20px;font-family:var(--font-mono);">' +
          '<div style="font-size:40px;margin-bottom:14px;">👛</div>' +
          '<div style="font-size:13px;font-weight:700;color:var(--text-secondary);margin-bottom:6px;">No Wallet Selected</div>' +
          '<div style="font-size:10px;color:var(--text-muted);line-height:1.7;">Select a wallet from the top<br>to view your balances &amp; tokens</div>' +
        '</div>';
    } catch(e) {}
  })();

  // ── STEP 0: Restore balance cache from localStorage ──
  window._balanceCache = window._balanceCache || {};
  window._balanceCacheTime = window._balanceCacheTime || {};
  if (typeof _restoreBalanceCache === 'function') _restoreBalanceCache();

  // ── STEP 0a: Restore price cache from localStorage — instant USD prices on reopen ──
  if (typeof _restorePriceCache === 'function') _restorePriceCache();

  // ── STEP 0b: Pre-set portfolio total from token cache — show $X.XX instantly ──
  (function _preloadPortfolioTotal() {
    try {
      // ── Guard: only restore if a wallet is actually selected ──
      var _activeWk = null;
      try { _activeWk = _oneGetSelectedKey(); } catch(e) {}
      if (!_activeWk) return; // No wallet selected — don't show stale data
      var raw = null;
      try {
        raw = localStorage.getItem('one_token_cache_' + _activeWk.slice(-8));
      } catch(e) {}
      if (!raw) { try { raw = localStorage.getItem('one_token_cache'); } catch(e) {} }
      if (!raw) return;
      var data = JSON.parse(raw);
      var tokens = data && data.tokens ? data.tokens : (Array.isArray(data) ? data : null);
      if (!tokens || !tokens.length) return;
      var total = 0;
      tokens.forEach(function(t) { total += parseFloat(t.usdValue || 0) || 0; });
      if (total <= 0) return;
      // Set instantly before DOM fully ready — will be picked up when updatePortfolioTotal runs
      window._portfolioTotalUsd = total;
      // Also write directly to DOM if elements already exist
      var _el = document.getElementById('hw-total-value-text');
      var _formatted = _formatCurrencyDisplay(total);
      if (_el) { _el.textContent = _formatted; _el.style.opacity = '1'; }
      var _gp = document.getElementById('hw-group-total-value');
      if (_gp) { _gp.textContent = _formatted; _gp.style.opacity = '1'; }
    } catch(e) {}
  })();

  // ── STEP 1: Instant cache restore (0ms — before loadTokens runs) ──
  // Show last-seen token list + balance + price immediately from localStorage
  (function _instantRestore() {
    try {
      // ── Guard FIRST: don't restore cached tokens when no wallet is selected ──
      var _activeKey = null;
      try { _activeKey = _oneGetSelectedKey(); } catch(e) {}
      if (!_activeKey) return; // No wallet selected — show empty state only

      // Load cache ONLY for the active wallet key
      var raw = null;
      try {
        raw = localStorage.getItem('one_token_cache_' + _activeKey.slice(-8));
      } catch(e) {}
      if (!raw) { try { raw = localStorage.getItem('one_token_cache'); } catch(e) {} }
      if (!raw) return;
      var data = JSON.parse(raw);
      var tokens = data && data.tokens ? data.tokens : (Array.isArray(data) ? data : null);
      if (!tokens || !tokens.length) return;

      // Verify the cached data belongs to the active wallet (support both full key and slice(-8) identifier)
      if (data.walletKey && data.walletKey !== _activeKey && data.walletKey !== _activeKey.slice(-8)) return;

      var tokenListEl = document.getElementById('token-list');
      if (!tokenListEl) return;
      if (tokenListEl.querySelectorAll('.token-card').length > 0) return;

      if (typeof window._onePTRRestore === 'function') {
        window._onePTRRestore(tokens);
      } else {
        window._onePendingRestore = tokens;
      }
    } catch(e) {}
  })();

  restoreResumeUI();
  restorePaymasterUrl();
  onPaymasterToggle();
  updateStep2NextBtn(); // init: gate Review & Start on pair selection

  const _lockEnabled = (function() {
    try {
      // ── FIX: Check all lock types (PIN, Pattern, Biometric) not just bio flag ──
      const bioOn = localStorage.getItem('one_bio_lock') === 'on';
      const hasPin = !!localStorage.getItem('one_lock_pin');
      const hasPat = !!localStorage.getItem('one_lock_pat');
      const hasBio = !!localStorage.getItem('one_bio_cred_id');
      return bioOn && (hasPin || hasPat || hasBio);
    } catch { return false; }
  })();

  if (_lockEnabled) {
    // ── FIX: Show lock overlay immediately (no delay) to prevent content flash ──
    const ov = document.getElementById('one-lock-overlay');
    if (ov) { ov.style.display = 'flex'; }
    setTimeout(() => {
      oneLock._checkOnOpen();
      if (ov) { ov.classList.add('nlk-enter'); }
    }, 0);
  } else {
    // ── No lock — hide overlay explicitly (it starts as flex in HTML) ──
    const _ovNoLock = document.getElementById('one-lock-overlay');
    if (_ovNoLock) _ovNoLock.style.display = 'none';
    // ── FIX: No lock — immediately load wallet groups async so cache is populated ──
    if (typeof loadWalletGroupsAsync === 'function') {
      loadWalletGroupsAsync().then(function() {
        if (typeof _hwRestoreSelection === 'function') _hwRestoreSelection();
      });
    }
  }

  // ── STEP 2: Pre-set wallet keys only — do NOT call loadTokens on app open ──
  // Balance will only be fetched on Pull-to-Refresh. Cache is shown until then.
  _onHwReady(function() {
    try {
      var _preKey = _oneGetSelectedKey();
      if (_preKey) {
        try { if (typeof homeActiveKey !== 'undefined') homeActiveKey = _preKey; } catch(_tdzE) {}
        if (typeof validatedKeys !== 'undefined' && (!validatedKeys || validatedKeys.length === 0)) validatedKeys = [_preKey];
      }
    } catch(_e2) {}
  });

  // ── STEP 3: Silent background refresh — price + balance, NO flicker ──
  // Price always refreshed silently. Balance only updated if value actually changed.
  _onHwReady(function() {
    setTimeout(function _silentOpenRefresh() {
      if (window.currentPage !== 'home') return;
      var _wKey = (function() {
        try { return _oneGetSelectedKey(); } catch { return null; }
      })();
      if (!_wKey) return;

      // Do NOT force price cache stale — restored cache gives instant prices
      // silentPriceRefresh will auto-refresh when TTL expires (15s)
      if (typeof silentPriceRefresh === 'function') {
        silentPriceRefresh().catch(function() {});
      }
    }, 200);
  });
});

// ── PAGE NAVIGATION ──
let currentPage = 'home';
window.currentPage = 'home'; // expose to IIFE-scoped modules (e.g. swOpenTokenPicker)
function switchPage(page) {
  // ── Close Send Token modal if open ──
  try { const _so = document.getElementById('send-overlay'); if (_so && _so.classList.contains('open') && typeof closeSendModal === 'function') closeSendModal(); } catch(_) {}
  // ── Close other overlays if open ──
  try { const _ro = document.getElementById('receive-overlay'); if (_ro && _ro.classList.contains('open') && typeof closeReceiveModal === 'function') closeReceiveModal(); } catch(_) {}
  try { const _po = document.getElementById('pm-overlay'); if (_po && _po.classList.contains('open')) { _po.classList.remove('open'); } } catch(_) {}
  try { const _alo = document.getElementById('addr-list-overlay'); if (_alo && _alo.classList.contains('open') && typeof closeAddrListModal === 'function') closeAddrListModal(); } catch(_) {}
  // ── Close any open Bridge pickers / modals before switching page ──
  try { if (typeof brCloseChainPicker  === 'function') brCloseChainPicker();  } catch(_) {}
  try { if (typeof brCloseTokenPicker  === 'function') brCloseTokenPicker();  } catch(_) {}
  try { if (typeof brCloseWalletPanel  === 'function') brCloseWalletPanel();  } catch(_) {}
  try { if (typeof brCloseHistory      === 'function') brCloseHistory();      } catch(_) {}
  try { if (typeof swCloseHistory      === 'function') swCloseHistory();      } catch(_) {}
  // ── Close token chart overlay if open ──
  try { if (typeof closeTokenChart === 'function' && document.getElementById('token-chart-full-overlay')) closeTokenChart(); } catch(_) {}
  // ── Close token action sheet if open ──
  try { const _tas = document.getElementById('token-action-sheet'); if (_tas) { _tas.style.opacity = '0'; const _tai = _tas.querySelector('#token-action-inner'); if (_tai) _tai.style.transform = 'translateY(100%)'; setTimeout(() => _tas.remove(), 260); } } catch(_) {}
  // ── Close Import Wallet Group overlays if open ──
  try { const _wgio = document.getElementById('wg-import-overlay'); if (_wgio && _wgio.classList.contains('open')) { _wgio.classList.remove('open'); } } catch(_) {}
  try { const _wgko = document.getElementById('wg-keyinput-overlay'); if (_wgko && _wgko.classList.contains('open')) { _wgko.classList.remove('open'); _wgDerivedKeys = []; } } catch(_) {}
  try { const _wgco = document.getElementById('wg-create-overlay'); if (_wgco && _wgco.classList.contains('open')) { _wgco.classList.remove('open'); _wgCreatedWallets = []; } } catch(_) {}
  try { if (typeof closeWgDetailUI   === 'function') { const _wgdo = document.getElementById('wgd-overlay');   if (_wgdo && _wgdo.classList.contains('open'))  closeWgDetailUI();   } } catch(_) {}
  try { if (typeof closeWgManager    === 'function') { const _wgmo = document.getElementById('wgm-overlay');   if (_wgmo && _wgmo.classList.contains('open'))  closeWgManager();    } } catch(_) {}
  try { if (typeof closeWgEditModal  === 'function') { const _wgeo = document.getElementById('wg-edit-overlay'); if (_wgeo && _wgeo.classList.contains('open')) closeWgEditModal();  } } catch(_) {}
  try { if (typeof closeWgakModal    === 'function') { const _wgak = document.getElementById('wgak-overlay');  if (_wgak && _wgak.classList.contains('open'))  closeWgakModal();    } } catch(_) {}
  try { if (typeof closeWgekModal    === 'function') { const _wgek = document.getElementById('wgek-overlay');  if (_wgek && _wgek.classList.contains('open'))  closeWgekModal();    } } catch(_) {}
  try { const _wgds = document.getElementById('wgm-delete-sheet'); if (_wgds && _wgds.classList.contains('open')) { _wgds.classList.remove('open'); if (_wgds.parentNode) _wgds.parentNode.removeChild(_wgds); } } catch(_) {}
  document.getElementById('page-' + currentPage)?.classList.remove('active');
  document.getElementById('nav-' + currentPage)?.classList.remove('active');
  currentPage = page;
  window.currentPage = page; // keep window.currentPage in sync (used by swOpenTokenPicker guard)
  // ── Track page history for back navigation ──
  if (!window._oneBackNavInProgress) {
    if (!window._onePageHistory) window._onePageHistory = ['home'];
    var _ph2 = window._onePageHistory;
    if (_ph2[_ph2.length - 1] !== page) {
      _ph2.push(page);
      if (_ph2.length > 20) _ph2.splice(0, _ph2.length - 20);
    }
    window._oneBackPressTime = 0;
  }
  const newPageEl = document.getElementById('page-' + page);
  if (!newPageEl) { console.warn('[ONE] switchPage: unknown page "' + page + '"'); return; }
  newPageEl.classList.add('active');
  // Block pointer-events briefly so the triggering click doesn't bleed
  // pointer-events block removed — visibility:hidden on inactive pages handles isolation
  document.getElementById('nav-' + page)?.classList.add('active');
  // ── Exchange/Transfer page: hide bottom nav; restore on any other page ──
  var _nav = document.querySelector('.bottom-nav:not(#exc-bottom-nav)');
  if (_nav) _nav.style.display = (page === 'exchange') ? 'none' : '';
  var _excNav = document.getElementById('exc-bottom-nav');
  if (_excNav) _excNav.style.display = (page === 'exchange') ? 'flex' : 'none';
  // ── Sync Exchange/Wallet toggle when navigating back to home externally ──
  if (page === 'home') {
    var _wBtn = document.getElementById('home-mode-wallet');
    var _eBtn = document.getElementById('home-mode-exchange');
    if (_wBtn && _eBtn) {
      _wBtn.style.background = 'var(--accent-primary)'; _wBtn.style.color = '#fff';
      _eBtn.style.background = 'transparent'; _eBtn.style.color = 'rgba(255,255,255,0.45)';
    }
    try { localStorage.setItem('one_home_mode', 'wallet'); } catch(e) {}
  }
  const fabIcons = {home:'add', swap:'swap_horiz', nansen:'currency_exchange', delegation:'security', bridge:'alt_route', profile:'edit', settings:'info'};
  const fabIcon = document.querySelector('#fab .material-icons-round');
  if (fabIcon) fabIcon.textContent = fabIcons[page] || 'add';
  if (page === 'home') {
    if (!homeActiveKey) { applySettingsGroupSelection && applySettingsGroupSelection(); }
    // Only run loadTokens if no cards showing (wallet change, first load, etc.)
    const _hlEl = document.getElementById('token-list');
    const _hlHasCards = _hlEl && _hlEl.querySelectorAll('.token-card').length > 0;
    if (!_hlHasCards) {
      loadTokens();
    } else {
      // Cards exist — silently refresh price + balance only
      _globalPriceCacheTime = 0;
      // ── FIX: Immediately restore portfolio total from DOM card data before async refresh ──
      (function _restorePortfolioInstant() {
        try {
          var _cards = document.querySelectorAll('.token-card[data-usd-value]');
          var _sum = 0;
          _cards.forEach(function(c) { _sum += parseFloat(c.dataset.usdValue || '0') || 0; });
          if (_sum > 0 && typeof _portfolioTotalUsd !== 'undefined') {
            _portfolioTotalUsd = _sum;
          }
          // Reset last-displayed cache so updatePortfolioTotal always re-renders
          if (typeof _portfolioLastDisplayed !== 'undefined') _portfolioLastDisplayed = null;
          if (typeof updatePortfolioTotal === 'function') updatePortfolioTotal();
        } catch(e) {}
      })();
      if (typeof silentPriceRefresh === 'function') silentPriceRefresh();
    }
  }
  if (page === 'profile') { applySettingsGroupSelection && applySettingsGroupSelection(); _updateAllToolBadges && _updateAllToolBadges(); if (typeof updateProfileStats === 'function') updateProfileStats(); try { var _pp = document.getElementById('page-profile'); if (_pp) _pp.scrollTop = 0; var _pf = _pp && _pp.querySelector(':focus'); if (_pf) _pf.blur(); } catch(e) {} }
  if (page === 'settings') { renderWalletGroupsList && renderWalletGroupsList(); typeof _rpcUpdateSettingsBadge === 'function' && _rpcUpdateSettingsBadge(); typeof refreshSettingsStatus === 'function' && refreshSettingsStatus(); }
  if (page === 'swap') { renderSwapGroupList && renderSwapGroupList(); typeof swInit === 'function' && swInit(); }
  if (page === 'nansen') { /* Nansen multi-wallet swap page — reinit if needed */ }
  if (page === 'delegation') { if (typeof delSyncActiveChain === 'function') delSyncActiveChain(); if (typeof delPopulateGroupSelect === 'function') delPopulateGroupSelect(); if (typeof delGoToStep === 'function') delGoToStep(_delCurrentStep || 1); }

  if (page === 'transfer-hub') {
    // Step 1: Bootstrap TH immediately (runs DOMContentLoaded handlers, populates chains, inits provider)
    if (typeof window.thBootstrap === 'function') window.thBootstrap();
    if (typeof window.thSyncHomeChain === 'function') window.thSyncHomeChain();
    // Step 1.5: Immediately hide all sub-sections so no old section flashes before dashboard loads
    if (typeof hideAllUISections === 'function') hideAllUISections();
    if (typeof localStorage !== 'undefined') localStorage.setItem('transferHub_currentSection', 'dashboard');
    // Step 2: After a short delay to let async init (initializeProvider etc.) settle,
    //         always open the main dashboard — never restore a previous section on navigation.
    setTimeout(function() {
      // Always open dashboard when navigating to Transfer Hub
      var _lastSection = 'dashboard';
      var _sectionFnMap = {
        'dashboard':             typeof openDashboard            === 'function' ? openDashboard            : null,
        'batchTransfer':         typeof openBatchTransfer        === 'function' ? openBatchTransfer        : null,
        'withdraw':              typeof openWithdraw             === 'function' ? openWithdraw             : null,
        'multiKeyNative':        typeof openMultiKeyNative       === 'function' ? openMultiKeyNative       : null,
        'nftTransfer':           typeof openNftTransfer          === 'function' ? openNftTransfer          : null,
        'phraseToKey':           typeof openPhraseToKey          === 'function' ? openPhraseToKey          : null,
        'selfTransfer':          typeof openSelfTransfer         === 'function' ? openSelfTransfer         : null,
        'balanceCheck':          typeof openBalanceCheck         === 'function' ? openBalanceCheck         : null,
        'tokenApprovalManager':  typeof openTokenApprovalManager === 'function' ? openTokenApprovalManager : null,
        'walletToWallet':        typeof openWalletToWallet       === 'function' ? openWalletToWallet       : null,
      };
      var _fn = _sectionFnMap[_lastSection];
      if (typeof _fn === 'function') { _fn(); }
      else if (typeof openDashboard === 'function') { openDashboard(); }
    }, 120);
  }
  if (page === 'bridge') {
    loadBridgeIframe();
    typeof brRefreshRecentTx === 'function' && brRefreshRecentTx();
    setTimeout(function(){ if (typeof window._brSyncBalances === 'function') window._brSyncBalances(); }, 0);
    // ── Auto-connect bridge sender wallet ──
    // Priority: manually-selected wallet (one_br_sender) → homeActiveKey fallback
    setTimeout(async function() {
      try {
        var _br = window.br;
        if (!_br) return;

        // ── 1. Check for manually-selected bridge wallet in localStorage ──
        var _savedSender = null;
        try { _savedSender = JSON.parse(localStorage.getItem('one_br_sender') || 'null'); } catch(_) {}
        // AES decrypt encPk if present
        if (_savedSender && _savedSender.addr && _savedSender.encPk) {
          try {
            var _decPk = await OneCrypto.decrypt(_savedSender.encPk);
            if (_decPk) _savedSender.pk = _decPk; else _savedSender = null;
          } catch(_) { _savedSender = null; } // don't delete — crypto may be temporarily unavailable
        } else if (_savedSender && _savedSender.pk && !_savedSender.encPk) {
          // Legacy plaintext pk — re-encrypt and resave
          try {
            var _reEnc = await OneCrypto.encrypt(_savedSender.pk);
            localStorage.setItem('one_br_sender', JSON.stringify({ addr: _savedSender.addr, encPk: _reEnc }));
          } catch(_) {}
        }
        if (_savedSender && _savedSender.addr && _savedSender.pk) {
          // Validate key is still valid
          try {
            var _sv = _savedSender.pk.startsWith('0x') ? _savedSender.pk : '0x' + _savedSender.pk;
            new ethers.Wallet(_sv);
          } catch(_) {
            localStorage.removeItem('one_br_sender');
            _savedSender = null;
          }
        }
        if (_savedSender && _savedSender.addr && _savedSender.pk) {
          // Restore manually-selected wallet — never overwrite with homeActiveKey
          _br.senderAddr = _savedSender.addr;
          _br.senderKey  = _savedSender.pk;
          if (typeof brUpdateSenderRow === 'function') brUpdateSenderRow();
          if (typeof _brShowCachedBalance === 'function') _brShowCachedBalance('from');
          setTimeout(function() {
            if (typeof brFetchFromBalance === 'function') brFetchFromBalance();
          }, 200);
          return;
        }

        // ── 2. Fallback: auto-connect homeActiveKey (no manual selection saved) ──
        // Skip if user has explicitly disconnected
        var _explicitly_disconnected = false;
        try { _explicitly_disconnected = !!localStorage.getItem('one_br_disconnected'); } catch(_) {}
        if (_explicitly_disconnected) return;

        var _hk = (typeof homeActiveKey !== 'undefined' && homeActiveKey) ? homeActiveKey : null;
        if (!_hk) {
          try {
            var _stored = _oneGetSelectedKey();
            if (_stored) _hk = _stored;
          } catch(_) {}
        }
        if (!_hk) return;
        var _norm = _hk.startsWith('0x') ? _hk : '0x' + _hk;
        var _hAddr = '';
        try { _hAddr = new ethers.Wallet(_norm).address; } catch(_e) { return; }
        if (!_hAddr) return;
        // Auto-connect home wallet — do NOT write to one_br_sender
        // so manual selection always takes precedence on next navigate
        _br.senderAddr = _hAddr;
        _br.senderKey  = _hk;
        if (typeof brUpdateSenderRow === 'function') brUpdateSenderRow();
        if (typeof _brShowCachedBalance === 'function') _brShowCachedBalance('from');
        setTimeout(function() {
          if (typeof brFetchFromBalance === 'function') brFetchFromBalance();
        }, 200);
      } catch(_e) {}
    }, 100);
  }
  // Force close swap token picker on page switch
  var _stm = document.getElementById('sw-token-modal');
  if (_stm) { _stm.classList.remove('sw-open'); document.body.style.overflow = ''; }
  // Force close Token Manager (and its chain picker) on page switch
  var _tmOv = document.getElementById('tm-overlay');
  if (_tmOv && _tmOv.classList.contains('open')) { _tmOv.classList.remove('open'); }
  var _tmCh = document.getElementById('tm-chain-overlay');
  if (_tmCh) { _tmCh.style.opacity = '0'; _tmCh.style.pointerEvents = 'none'; }
  var _tmChM = document.getElementById('tm-chain-modal');
  if (_tmChM) _tmChM.style.transform = 'translateY(100%)';
  haptic();
}

// ══════════════════════════════════════════════
// LIVE PRICE & BALANCE SYSTEM
// Sources: CoinGecko → Coinbase fallback → Basescan balance
// ══════════════════════════════════════════════

// Token config — Base chain contract addresses
const TOKEN_CONFIG = [
  {
    id: 'weth',
    name: 'Wrapped ETH',
    sub: 'WETH',
    icon: 'Ξ',
    color: '#6366f1',
    badge: '#6366f1',
    contract: '0x4200000000000000000000000000000000000006',
    decimals: 18,
    cgId: 'weth',
    cbPair: 'ETH-USD',
    logoURI: 'https://assets.coingecko.com/coins/images/2518/small/weth.png',
  },
  {
    id: 'eurc',
    name: 'aBase EURC',
    sub: 'aBasEURC',
    icon: '€',
    color: '#22d3ee',
    badge: '#22d3ee',
    contract: '0xcf3d8be2f...', // aEURC on Base (placeholder shown, real fetch below)
    decimals: 6,
    cgId: 'euro-coin',
    cbPair: 'EURC-USD',
    logoURI: 'https://assets.coingecko.com/coins/images/26045/small/euro-coin.png',
  },
  {
    id: 'usdc',
    name: 'USD Coin',
    sub: 'USDC',
    icon: '$',
    color: '#10b981',
    badge: '#10b981',
    contract: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    decimals: 6,
    cgId: 'usd-coin',
    cbPair: 'USDC-USD',
    logoURI: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
  },
];

// ── cgId → Binance symbol map (covers all tokens used in the app) ──
const CG_TO_BINANCE = {
  // ── Major Layer 1s ──
  'ethereum':                    'ETHUSDT',
  'bitcoin':                     'BTCUSDT',
  'binancecoin':                 'BNBUSDT',
  'solana':                      'SOLUSDT',
  'avalanche-2':                 'AVAXUSDT',
  'matic-network':               'MATICUSDT',
  'polkadot':                    'DOTUSDT',
  'cardano':                     'ADAUSDT',
  'ripple':                      'XRPUSDT',
  'near':                        'NEARUSDT',
  'cosmos':                      'ATOMUSDT',
  'aptos':                       'APTUSDT',
  'sui':                         'SUIUSDT',
  'injective-protocol':          'INJUSDT',
  'celestia':                    'TIAUSDT',
  'litecoin':                    'LTCUSDT',

  // ── Layer 2s / Rollups ──
  'arbitrum':                    'ARBUSDT',
  'optimism':                    'OPUSDT',

  // ── Wrapped / Bridged ETH variants ──
  'weth':                        'ETHUSDT',
  'coinbase-wrapped-staked-eth': 'ETHUSDT',

  // ── Wrapped / Bridged BTC variants ──
  'wrapped-bitcoin':             'WBTCUSDT',
  'coinbase-wrapped-btc':        'BTCUSDT',

  // ── Stablecoins ──
  'tether':                      'USDTUSDT',   // stable → handled separately
  'usd-coin':                    'USDCUSDT',
  'bridged-usd-coin-base':       'USDCUSDT',
  'dai':                         'DAIUSDT',
  'frax':                        'FRAXUSDT',
  'true-usd':                    'TUSDUSDT',
  'euro-coin':                   'EURUSDT',

  // ── DeFi Tokens ──
  'chainlink':                   'LINKUSDT',
  'uniswap':                     'UNIUSDT',
  'aave':                        'AAVEUSDT',
  'pancakeswap-token':           'CAKEUSDT',
  'curve-dao-token':             'CRVUSDT',
  'maker':                       'MKRUSDT',
  'compound-governance-token':   'COMPUSDT',
  'synthetix-network-token':     'SNXUSDT',
  'yearn-finance':                'YFIUSDT',
  'lido-dao':                    'LDOUSDT',
  'rocket-pool':                 'RPLUSDT',
  'the-graph':                   'GRTUSDT',
  'dydx':                        'DYDXUSDT',
  'gmx':                         'GMXUSDT',
  'pendle':                      'PENDLEUSDT',

  // ── Meme Coins ──
  'dogecoin':                    'DOGEUSDT',
  'shiba-inu':                   'SHIBUSDT',

  // ── Other majors ──
  'render-token':                'RENDERUSDT',
  'fetch-ai':                    'FETUSDT',
  'worldcoin-wld':               'WLDUSDT',
};
