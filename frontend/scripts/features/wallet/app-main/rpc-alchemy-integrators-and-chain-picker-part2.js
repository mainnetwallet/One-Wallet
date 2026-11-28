
// ── FIX: Race condition guard — loadTokens waits for wallet decrypt to complete ──
let _hwSelectionReady = false; // set to true after _hwRestoreSelection completes
let _hwSelectionReadyCbs = []; // callbacks queued while decrypt is pending
function _onHwReady(fn) {
  if (_hwSelectionReady) { fn(); return; }
  _hwSelectionReadyCbs.push(fn);
}
function _fireHwReady() {
  _hwSelectionReady = true;
  _hwSelectionReadyCbs.forEach(function(fn) { try { fn(); } catch(e) {} });
  _hwSelectionReadyCbs = [];
}

let hwSelectedKey = (function() {
  // Resolved async after unlock via _hwRestoreSelection → loadWalletGroupsAsync
  return null;
})();

function homePopulateGroups() {
  const groups = loadWalletGroups();
  const hwEmpty = document.getElementById('hw-empty');
  const hwList  = document.getElementById('hw-list');
  if (groups.length === 0) {
    if (hwEmpty) hwEmpty.style.display = 'flex';
    if (hwList) hwList.style.display = 'none';
    return;
  }
  // Show NO WALLET state if no wallet has been selected yet
  const _hasSelection = (typeof hwSelectedKey !== 'undefined' && hwSelectedKey);
  if (!_hasSelection) {
    if (hwEmpty) hwEmpty.style.display = 'flex';
    if (hwList) hwList.style.display = 'none';
    return;
  }
  if (hwEmpty) hwEmpty.style.display = 'none';
  if (hwList) hwList.style.display = 'flex';

  const groupSel = document.getElementById('home-group-select');
  const prevGroup = groupSel ? groupSel.value : '';
  if (groupSel) groupSel.innerHTML = '';
  groups.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g.id;
    opt.textContent = g.name + ' (' + g.keys.length + ')';
    groupSel.appendChild(opt);
  });

  // ── FIX: Prefer the group that contains hwSelectedKey over prevGroup.
  // On boot, prevGroup may point to Group 1 while the persisted hwSelectedKey
  // belongs to a different group — causing the wrong group's wallet to be
  // selected first and its chain to flash before being corrected.
  let _targetGroup = null;
  if (typeof hwSelectedKey !== 'undefined' && hwSelectedKey) {
    const _hwGroup = groups.find(g => g.keys && g.keys.includes(hwSelectedKey));
    if (_hwGroup) _targetGroup = _hwGroup.id;
  }
  if (!_targetGroup) {
    // Fallback: try persisted group from localStorage
    try {
      const _pg = localStorage.getItem('one_hw_group_id_v2') || localStorage.getItem('one_hw_selected_group_v1');
      if (_pg && groups.find(g => g.id === _pg)) _targetGroup = _pg;
    } catch {}
  }
  if (!_targetGroup && prevGroup && groups.find(g => g.id === prevGroup)) _targetGroup = prevGroup;
  if (_targetGroup) groupSel.value = _targetGroup;

  // Update custom pill label
  hwUpdateGroupLabel();

  homePopulateWallets(groupSel.value);
}

function homePopulateWallets(groupId) {
  const groups = loadWalletGroups();
  const g = groups.find(x => x.id === groupId);
  const walletSel = document.getElementById('home-wallet-select');
  const prevKey = walletSel ? walletSel.value : '';
  if (walletSel) walletSel.innerHTML = '';
  if (!g) return;
  g.keys.forEach((k, i) => {
    try {
      const addr = new ethers.Wallet(k).address;
      const opt = document.createElement('option');
      opt.value = k;
      opt.textContent = (i+1) + '  ' + addr.slice(0,6) + '...' + addr.slice(-4);
      opt.dataset.index = i + 1;
      walletSel.appendChild(opt);
    } catch {}
  });
  // Prefer hwSelectedKey (from group picker) over prevKey for restore
  const restoreKey = (typeof hwSelectedKey !== 'undefined' && hwSelectedKey && g.keys.includes(hwSelectedKey))
    ? hwSelectedKey
    : (prevKey && g.keys.includes(prevKey) ? prevKey : null);
  if (restoreKey) walletSel.value = restoreKey;

  // Update custom wallet pill label
  hwUpdateGroupLabel();
  homeApplyWallet();
}

function homeApplyWallet() {
  const walletSel = document.getElementById('home-wallet-select');
  const selPk = walletSel ? walletSel.value : null;
  // ── FIX: hwSelectedKey is the ground-truth selection (set before any dispatchEvent).
  // walletSel.value can briefly hold the wrong key during group-switch repopulation.
  // Always prefer hwSelectedKey when it matches a key in the current group's option list,
  // so that per-wallet chain restore in _loadChainForWallet() uses the correct wallet.
  let pk = selPk;
  if (typeof hwSelectedKey !== 'undefined' && hwSelectedKey && hwSelectedKey !== selPk) {
    // Verify hwSelectedKey is actually in the wallet selector options (i.e. group is correct)
    const opts = walletSel ? Array.from(walletSel.options) : [];
    if (opts.some(o => o.value === hwSelectedKey)) {
      pk = hwSelectedKey;
      walletSel.value = hwSelectedKey; // keep DOM in sync
    }
  }
  let addr = '';
  try { addr = pk ? new ethers.Wallet(pk).address : ''; } catch {}
  homeActiveKey = pk || null;

  const addrText = document.getElementById('hw-addr-text');
  if (addrText) addrText.textContent = addr ? (addr.slice(0,2) + '...' + addr.slice(-4)) : '—';

  // Show wallet index label (W1, W2, etc.)
  const idxEl = document.getElementById('hw-wallet-index');
  if (idxEl && walletSel) {
    const selectedOpt = walletSel.options[walletSel.selectedIndex];
    const idxNum = selectedOpt ? selectedOpt.dataset.index : null;
    if (idxEl) idxEl.textContent = idxNum ? 'W' + idxNum : '—';
  }

  // Update validatedKeys to ONLY the single selected wallet for token balance display
  validatedKeys = homeActiveKey ? [homeActiveKey] : [];

  // ── Restore balance cache for the newly selected wallet ──
  window._balanceCache = {};
  window._balanceCacheTime = {};
  if (homeActiveKey && typeof _restoreBalanceCache === 'function') _restoreBalanceCache();

  // Restore per-wallet chain preference when switching wallets
  // If the new wallet has a saved chain, apply it; otherwise read from localStorage (persisted global chain)
  if (typeof setActiveChain === 'function') {
    const _walletChain = homeActiveKey ? _loadChainForWallet(homeActiveKey) : undefined;
    let _chainToApply;
    if (_walletChain !== undefined) {
      // This wallet has its own saved chain preference — use it
      _chainToApply = _walletChain;
    } else {
      // No per-wallet chain — read the persisted global chain directly from localStorage
      try {
        const _savedGlobal = localStorage.getItem('one_active_chain');
        _chainToApply = (_savedGlobal === 'null' || _savedGlobal === null) ? null : (_savedGlobal ? Number(_savedGlobal) : null);
      } catch(_e) {
        _chainToApply = activeHomeChainId;
      }
    }
    setActiveChain(_chainToApply);
  }

  // ── WALLET SWITCH: instantly restore this wallet's cached token list before loadTokens() ──
  // Reset portfolio display cache so new wallet's total always renders fresh
  if (typeof _portfolioLastDisplayed !== 'undefined') _portfolioLastDisplayed = null;
  // This prevents blank flash when switching wallets
  if (homeActiveKey) {
    try {
      var _wk = homeActiveKey;
      var _wCacheKey = 'one_token_cache_' + _wk.slice(-8);
      var _wRaw = localStorage.getItem(_wCacheKey);
      if (_wRaw) {
        var _wData = JSON.parse(_wRaw);
        // ── FIX: Restore cache for the correct wallet regardless of chain mismatch.
        // Chain mismatch simply means the cache has tokens from a different chain view —
        // we still show them instantly so there's no blank flash, then silentPriceRefresh
        // will fetch fresh data for the current chain in the background.
        if ((_wData.walletKey === _wk || _wData.walletKey === _wk.slice(-8)) && _wData.tokens && _wData.tokens.length) {
          var _tlEl = document.getElementById('token-list');
          if (_tlEl && typeof window._onePTRRestore === 'function') {
            window._onePTRRestore(_wData.tokens);
          }
          // ── Instantly show cached portfolio total in the pill ──
          try {
            var _cachedTotal = 0;
            _wData.tokens.forEach(function(t) { _cachedTotal += parseFloat(t.usdValue || 0) || 0; });
            if (_cachedTotal > 0) {
              if (typeof window._portfolioTotalUsd !== 'undefined') window._portfolioTotalUsd = _cachedTotal;
              var _gpPill = document.getElementById('hw-group-total-value');
              if (_gpPill) {
                _gpPill.textContent = _formatCurrencyDisplay(_cachedTotal);
                _gpPill.style.opacity = '1';
              }
              if (typeof updatePortfolioTotal === 'function') updatePortfolioTotal();
            }
          } catch(_te) {}
        }
      } else {
        // No cache for this wallet — clear the token list so stale data from previous wallet doesn't show
        var _tlEl = document.getElementById('token-list');
        if (_tlEl) { _tlEl.innerHTML = ''; }
        // Reset portfolio total
        if (typeof window._portfolioTotalUsd !== 'undefined') { window._portfolioTotalUsd = 0; }
        if (typeof window._portfolioAllChainsTotal !== 'undefined') { window._portfolioAllChainsTotal = 0; }
        if (typeof updatePortfolioTotal === 'function') updatePortfolioTotal();
        var _gpPill2 = document.getElementById('hw-group-total-value');
        if (_gpPill2) { _gpPill2.textContent = '$0.00'; _gpPill2.style.opacity = '0.5'; }
      }
    } catch(e) {}
  } else if (typeof hwSelectedKey !== 'undefined' && hwSelectedKey) {
    // A wallet IS selected — the dropdown is just mid-repopulate. Don't flash "No Wallet Selected".
  } else {
    // No wallet selected — clear token list, balance, and show empty state
    var _tlEl = document.getElementById('token-list');
    if (_tlEl) {
      _tlEl.innerHTML =
        '<div style="text-align:center;padding:48px 20px;font-family:var(--font-mono);">' +
          '<div style="font-size:40px;margin-bottom:14px;">👛</div>' +
          '<div style="font-size:13px;font-weight:700;color:var(--text-secondary);margin-bottom:6px;">No Wallet Selected</div>' +
          '<div style="font-size:10px;color:var(--text-muted);line-height:1.7;">Select a wallet from the top<br>to view your balances &amp; tokens</div>' +
        '</div>';
    }
    if (typeof window._portfolioTotalUsd !== 'undefined') { window._portfolioTotalUsd = 0; }
    if (typeof window._portfolioAllChainsTotal !== 'undefined') { window._portfolioAllChainsTotal = 0; }
    if (typeof updatePortfolioTotal === 'function') updatePortfolioTotal();
  }

  // Reload token balances for the selected wallet
  if (typeof loadTokens === 'function') loadTokens();

  // ── WALLET SWITCH: silent background refresh after instant cache restore ──
  // Cached data দেখানোর পর, background-এ fresh price+balance fetch করবে (কোনো spinner নেই)
  if (homeActiveKey) {
    setTimeout(function() {
      if (typeof window.silentPriceRefresh === 'function') {
        if (typeof window._globalPriceCacheTime !== 'undefined') window._globalPriceCacheTime = 0;
        window.silentPriceRefresh().catch(function() {});
      }
    }, 350);
  }
}

// ── Exchange / Wallet mode toggle ──
function homeSetMode(mode) {
  var isExchange = (mode === 'exchange');
  // Toggle pill styles
  var wBtn = document.getElementById('home-mode-wallet');
  var eBtn = document.getElementById('home-mode-exchange');
  if (wBtn && eBtn) {
    if (isExchange) {
      wBtn.style.background = 'transparent';
      wBtn.style.color = 'rgba(255,255,255,0.45)';
      eBtn.style.background = 'var(--accent-primary)';
      eBtn.style.color = '#fff';
    } else {
      wBtn.style.background = 'var(--accent-primary)';
      wBtn.style.color = '#fff';
      eBtn.style.background = 'transparent';
      eBtn.style.color = 'rgba(255,255,255,0.45)';
    }
  }
  // Show/hide bottom nav
  var nav = document.querySelector('.bottom-nav:not(#exc-bottom-nav)');
  if (nav) nav.style.display = isExchange ? 'none' : '';
  var excNav = document.getElementById('exc-bottom-nav');
  if (excNav) excNav.style.display = isExchange ? 'flex' : 'none';
  // Switch page
  if (isExchange) {
    switchPage('exchange');
    // First Wallet -> Exchange entry this app session: show the SELECT
    // EXCHANGE picker. Nothing fires here besides that — no header/status
    // calls, no market/balance/portfolio loads. Picking an exchange in the
    // modal is what triggers EXC.selectExchange(), which does all of that.
    // Closing and reopening the app resets _initialized, so the picker
    // shows again next launch. Later switches this session: nothing runs.
    if (window.EXC && !EXC._initialized) {
      EXC._initialized = true;
      EXC.openSelector();
    }
  } else {
    switchPage('home');
  }
  // Persist
  try { localStorage.setItem('one_home_mode', mode); } catch(e) {}
}

// App always opens in Wallet mode by default (Exchange mode is not auto-restored)

function homeOnGroupChange() {
  const groupId = document.getElementById('home-group-select')?.value;
  homePopulateWallets(groupId);
  haptic();
}

function homeOnWalletChange() {
  homeApplyWallet();
  hwUpdateGroupLabel();
  haptic();
}

// ── CUSTOM GROUP / WALLET PICKERS ──
function hwUpdateWalletLabel() {
  const walletSel = document.getElementById('home-wallet-select');
  const wlabel = document.getElementById('hw-wallet-addr-label');
  if (!walletSel || !wlabel) return;
  const opt = walletSel.options[walletSel.selectedIndex];
  wlabel.textContent = opt ? opt.textContent : '—';
}

// ── HW: selected wallet tracker ──
// ══════════════════════════════════════════
// HW SELECTED KEY — PERSISTENT STATE
// Saves selected wallet key to localStorage
// so page refresh restores the selection.
// ══════════════════════════════════════════

function _hwSaveSelection(key, groupId) {
  try {
    if (key) {
      // AES-encrypt then persist
      OneCrypto.encrypt(key).then(function(encoded){
        try { localStorage.setItem(HW_KEY_PERSIST, encoded); } catch(_){}
      });
    } else {
      localStorage.removeItem(HW_KEY_PERSIST);
    }
    if (groupId) {
      localStorage.setItem(HW_GROUP_PERSIST, groupId);
      localStorage.setItem('one_hw_group_id_v2', groupId);
    } else {
      localStorage.removeItem(HW_GROUP_PERSIST);
      localStorage.removeItem('one_hw_group_id_v2');
    }
  } catch {}
}

// Restore saved key selection after wallet groups are loaded
async function _hwRestoreSelection() {
  try {
    const rawSaved = localStorage.getItem(HW_KEY_PERSIST);
    if (!rawSaved) { if (typeof _fireHwReady === 'function') _fireHwReady(); return; }
    // AES-decrypt stored key
    const savedKey = await OneCrypto.decrypt(rawSaved);
    if (!savedKey) { if (typeof _fireHwReady === 'function') _fireHwReady(); return; }
    // Verify key still exists in wallet groups
    const groups = loadWalletGroups();
    let foundGroup = null;
    let resolvedKey = savedKey;
    groups.forEach(g => {
      const match = g.keys.find(k =>
        (typeof normalizeKey === 'function')
          ? normalizeKey(k) === normalizeKey(savedKey)
          : k.toLowerCase() === savedKey.toLowerCase()
      );
      if (match) { foundGroup = g; resolvedKey = match; }
    });
    if (!foundGroup) { localStorage.removeItem(HW_KEY_PERSIST); return; }
    // Re-save AES-encrypted version if key casing changed
    if (resolvedKey !== savedKey) {
      OneCrypto.encrypt(resolvedKey).then(function(enc){ try { localStorage.setItem(HW_KEY_PERSIST, enc); } catch(_){} });
    }
    hwSelectedKey = resolvedKey;
    try { if (typeof homeActiveKey !== 'undefined') homeActiveKey = resolvedKey; } catch(_e) {}
    try { if (typeof validatedKeys !== 'undefined') validatedKeys = [resolvedKey]; } catch(_e) {}
    const gSel = document.getElementById('home-group-select');
    const wSel = document.getElementById('home-wallet-select');
    if (gSel) gSel.value = foundGroup.id;
    if (typeof homeOnGroupChange === 'function') homeOnGroupChange();
    if (wSel && wSel.value !== resolvedKey) {
      wSel.value = resolvedKey;
      if (typeof homeOnWalletChange === 'function') homeOnWalletChange();
    }
    hwUpdateGroupLabel();
    if (typeof _updateWgManageBtn === 'function') _updateWgManageBtn();
  } catch {}
  // ── Signal that wallet decrypt is done — queued loadTokens calls can now run ──
  if (typeof _fireHwReady === 'function') _fireHwReady();
}
// Auto-restore on DOM ready
(function() {
  function tryRestore() {
    const groups = loadWalletGroups();
    if (groups.length > 0) { _hwRestoreSelection(); return true; }
    return false;
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      tryRestore();
      // retry removed — instant
      // retry removed — instant
    });
  } else {
    tryRestore();
    // retry removed — instant
    // retry removed — instant
  }
})();

function hwUpdateGroupLabel() {
  const glabel = document.getElementById('hw-group-label');
  const wlabel = document.getElementById('hw-wallet-addr-label');
  const groupSel = document.getElementById('home-group-select');
  const hwEmpty = document.getElementById('hw-empty');
  const hwList  = document.getElementById('hw-list');
  const groups = loadWalletGroups();

  // Show NO WALLET pill when no wallet is selected
  if (!hwSelectedKey || groups.length === 0) {
    if (hwEmpty) hwEmpty.style.display = 'flex';
    if (hwList)  hwList.style.display  = 'none';
    return;
  }
  if (hwEmpty) hwEmpty.style.display = 'none';
  if (hwList)  hwList.style.display  = 'flex';

  // Find the group that contains the selected key
  const g = groups.find(x => x.id === groupSel?.value) || groups.find(x => x.keys.includes(hwSelectedKey));
  // Group name
  if (glabel) glabel.textContent = g ? g.name : '—';
  // Wallet address
  if (wlabel) {
    try {
      const addr = new ethers.Wallet(hwSelectedKey).address;
      let wIdx = 1;
      if (g) { const i = g.keys.indexOf(hwSelectedKey); if (i !== -1) wIdx = i + 1; }
      wlabel.textContent = wIdx + ' · 0x…' + addr.slice(-4);
      wlabel.style.color = 'var(--text-secondary)';
    } catch { wlabel.textContent = '—'; }
  }

  // ── INSTANT: wallet switch করলে সাথে সাথে cached total value দেখাবে pill-এ ──
  const gpEl = document.getElementById('hw-group-total-value');
  if (gpEl && hwSelectedKey) {
    try {
      var _ck = 'one_token_cache_' + hwSelectedKey.slice(-8);
      var _cr = localStorage.getItem(_ck);
      if (_cr) {
        var _cd = JSON.parse(_cr);
        if (_cd && (_cd.walletKey === hwSelectedKey || _cd.walletKey === (hwSelectedKey||'').slice(-8)) && _cd.tokens && _cd.tokens.length) {
          var _ct = 0;
          _cd.tokens.forEach(function(t) { _ct += parseFloat(t.usdValue || 0) || 0; });
          if (_ct > 0) {
            gpEl.textContent = _formatCurrencyDisplay(_ct);
            gpEl.style.opacity = '1';
          }
        }
      }
    } catch(_ge) {}
  }
}
