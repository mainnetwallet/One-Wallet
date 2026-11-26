
(function() {
'use strict';

// ══════════════════════════════════════════
// 1. WALLET GROUP BOX — PERSISTENT STATE
// Keys: one_hw_group_id, one_hw_wallet_idx
// ══════════════════════════════════════════
const HW_PERSIST_GROUP = 'one_hw_group_id_v2';
const HW_PERSIST_WALLET = 'one_hw_wallet_idx_v2';

// Save current home wallet selection
window._oneSaveHomeWallet = function(groupId, walletIdx) {
  try {
    if (groupId !== undefined && groupId !== null) {
      localStorage.setItem(HW_PERSIST_GROUP, groupId);
      // Keep one_hw_selected_group_v1 in sync — _hwSaveSelection reads this
      localStorage.setItem('one_hw_selected_group_v1', groupId);
    }
    if (walletIdx !== undefined && walletIdx !== null) localStorage.setItem(HW_PERSIST_WALLET, String(walletIdx));
    // Reload token config for the newly selected wallet group
    if (typeof syncTokenConfig === 'function') syncTokenConfig();
    // NOTE: loadTokens() intentionally NOT called here — homeApplyWallet() already calls it
    // when the wallet selection changes. Calling it here too causes duplicate network requests.
    // Reset TM chain selector if token manager was open
    if (typeof _tmUpdateChainSelector === 'function') _tmUpdateChainSelector();
  } catch(e) {}
};

// Restore previously selected home wallet after groups are rendered
window._oneRestoreHomeWallet = function() {
  try {
    const savedGroupId = localStorage.getItem(HW_PERSIST_GROUP);
    const savedWalletIdx = localStorage.getItem(HW_PERSIST_WALLET);
    if (!savedGroupId) return false;

    // Check if group still exists
    const groups = (typeof loadWalletGroups === 'function') ? loadWalletGroups() : [];
    const group = groups.find(g => g.id === savedGroupId);
    if (!group) return false;

    // Restore group select
    const groupSel = document.getElementById('home-group-select');
    if (groupSel) {
      groupSel.value = savedGroupId;
      // Trigger group change to populate wallet list
      if (typeof homeOnGroupChange === 'function') homeOnGroupChange();
    }

    // After group is set, restore wallet index
    if (savedWalletIdx !== null) {
      const walletSel = document.getElementById('home-wallet-select');
      if (walletSel) {
        const idx = parseInt(savedWalletIdx, 10);
        if (!isNaN(idx) && idx < walletSel.options.length) {
          walletSel.selectedIndex = idx;
          if (typeof homeOnWalletChange === 'function') homeOnWalletChange();
        }
      }
    }
    return true;
  } catch(e) { return false; }
};

// Hook into homeOnGroupChange and homeOnWalletChange to auto-save
function _patchHomeSelects() {
  const groupSel = document.getElementById('home-group-select');
  const walletSel = document.getElementById('home-wallet-select');

  if (groupSel && !groupSel._oneSavePatch) {
    groupSel._oneSavePatch = true;
    groupSel.addEventListener('change', function() {
      window._oneSaveHomeWallet(this.value, 0);
    });
  }
  if (walletSel && !walletSel._oneSavePatch) {
    walletSel._oneSavePatch = true;
    walletSel.addEventListener('change', function() {
      const groupSel2 = document.getElementById('home-group-select');
      window._oneSaveHomeWallet(groupSel2 ? groupSel2.value : null, this.selectedIndex);
    });
  }
}

// ══════════════════════════════════════════
// 2. LIVE PRICE REFRESH — 30s interval
//    Immediately refreshes when Home tab is opened
// ══════════════════════════════════════════
let _onePriceInterval = null;

function _startLivePriceRefresh() {
  // Disabled: priceRefreshTimer (60s) already handles silent refresh to avoid duplicate API calls
  if (_onePriceInterval) { clearInterval(_onePriceInterval); _onePriceInterval = null; }
}

// ══════════════════════════════════════════
// 3. COINMARKETCAP SEARCH FALLBACK
//    Patches doTmSearch to try CMC if CoinGecko returns 0 results
// ══════════════════════════════════════════
// ══════════════════════════════════════════
// 3. TOKEN SEARCH — ALREADY ENHANCED
//    doTmSearch now fires CoinGecko + CoinMarketCap
//    in PARALLEL. No patch needed.
// ══════════════════════════════════════════
async function _searchCoinMarketCap(query) {
  // Kept for legacy compatibility — doTmSearch handles parallel search natively
  try {
    const cmcUrl = `https://api.coinmarketcap.com/data-api/v3/cryptocurrency/search/quick?query=${encodeURIComponent(query)}&limit=10`;
    const res = await window.nxFetch(cmcUrl, { ms: 8000 });
    if (!res.ok) return [];
    const d = await res.json();
    const items = d?.data?.cryptoCurrencyList || d?.data || [];
    if (!Array.isArray(items)) return [];
    return items.slice(0, 10).map(c => ({
      id: (c.slug || c.symbol || c.name || '').toLowerCase().replace(/\s+/g, '-'),
      name: c.name || '',
      symbol: (c.symbol || '').toUpperCase(),
      thumb: c.logo || null,
      market_cap_rank: c.rank || c.cmcRank || null,
      _source: 'CoinMarketCap',
    }));
  } catch(e) { return []; }
}

// _patchTmSearch is a no-op now — doTmSearch already has parallel CG+CMC built in
function _patchTmSearch() {
  // No patch needed: doTmSearch v2 runs CoinGecko + CoinMarketCap in parallel natively.
}

// ══════════════════════════════════════════
// 4. POST-TRANSACTION AUTO-REFRESH
//    After send/swap/bridge tx completes → reload home tokens
// ══════════════════════════════════════════
window._onePostTxRefresh = function(label) {
  label = label || 'transaction';
  // Update home token list (balance + price)
  setTimeout(function() {
    if (typeof loadTokens === 'function') {
      loadTokens();
    }
    if (typeof silentPriceRefresh === 'function') {
      silentPriceRefresh();
    }

  }, 3000); // 3s delay to let chain confirm
};

// ══════════════════════════════════════════
// 5. HOME PRICE VISIBILITY IMPROVEMENT
//    Make the tlp-price element more visible with green/red coloring
// ══════════════════════════════════════════
function _enhancePriceLabel() {
  const cards = document.querySelectorAll('.token-card');
  cards.forEach(card => {
    const lpEl = card.querySelector('[id^="tlp-"]');
    if (lpEl && lpEl.style.opacity === '0' || !lpEl) return;
    const priceEl = lpEl ? lpEl.querySelector('.tlp-price') : null;
    if (priceEl && priceEl.textContent && priceEl.textContent !== '—') {
      lpEl.style.opacity = '1';
      lpEl.style.display = 'flex';
    }
  });
}

// ══════════════════════════════════════════
// INIT: Run after DOM is ready
// ══════════════════════════════════════════
function _oneInit() {
  // Patch home selects for save-on-change
  _patchHomeSelects();

  // Restore saved home wallet — try immediately and on MutationObserver
  const _tryRestore = function() {
    const groupSel = document.getElementById('home-group-select');
    // Only restore if options are populated
    if (groupSel && groupSel.options.length > 0) {
      window._oneRestoreHomeWallet();
      // Also restore hwSelectedKey for pill display
      if (typeof _hwRestoreSelection === 'function') _hwRestoreSelection();
      // Force chain button display after wallet restore (guarded — homeActiveKey must be live)
      try {
        if (typeof setActiveChain === 'function' && typeof homeActiveKey !== 'undefined') {
          setActiveChain(activeHomeChainId);
        }
      } catch(_e) {}
      return true;
    }
    return false;
  };

  // Try immediately
  if (!_tryRestore()) {
    // Watch for when group select gets populated
    const observer = new MutationObserver(function(mutations) {
      const groupSel = document.getElementById('home-group-select');
      if (groupSel && groupSel.options.length > 0) {
        observer.disconnect();
        setTimeout(_tryRestore, 150);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    // Also try after 1s and 3s as fallback
    setTimeout(_tryRestore, 1000);
    setTimeout(_tryRestore, 3000);
  }

  // Start live price refresh
  _startLivePriceRefresh();

  // Re-patch home selects when wallet groups load (they may render later)
  setTimeout(_patchHomeSelects, 500);
  setTimeout(_patchHomeSelects, 2000);

  // Patch doTmSearch (may not be defined yet at init time)
  setTimeout(_patchTmSearch, 500);
  setTimeout(_patchTmSearch, 2000);

  // Also patch when Token Manager is opened
  const origOpenTm = window.openTokenManager;
  if (typeof origOpenTm === 'function') {
    window.openTokenManager = function() {
      origOpenTm.apply(this, arguments);
      setTimeout(_patchTmSearch, 100);
    };
  }

  // Enhance price labels when home loads
  setTimeout(_enhancePriceLabel, 2000);
  setInterval(_enhancePriceLabel, 120000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _oneInit);
} else {
  _oneInit();
}

// ══════════════════════════════════════════
// 6. PATCH SEND TRANSACTION → AUTO-REFRESH
//    Hook into the send confirmation to trigger refresh
// ══════════════════════════════════════════
(function _patchSendTx() {
  // We hook into the global showToast — if it fires with a tx hash / "sent" keyword, refresh
  const _origShowToast = window.showToast;
  if (typeof _origShowToast !== 'function') return;

  window.showToast = function(msg, icon) {
    _origShowToast.apply(this, arguments);
    const msgLower = (msg || '').toLowerCase();
    // Detect successful transactions
    if (
      (msgLower.includes('sent') && msgLower.includes('0x')) ||
      msgLower.includes('tx confirmed') ||
      msgLower.includes('transaction confirmed') ||
      msgLower.includes('bridge success') ||
      msgLower.includes('swap success') ||
      msgLower.includes('executed') ||
      (icon === 'check_circle' && (msgLower.includes('sent') || msgLower.includes('success') || msgLower.includes('complet')))
    ) {
      window._onePostTxRefresh(
        msgLower.includes('bridge') ? 'bridge' :
        msgLower.includes('swap') ? 'swap' : 'send'
      );
    }
  };
})();

// ══════════════════════════════════════════
// 7. HOME WALLET PILL SAVE — Hook hwCloseGroupPicker + hwCloseWalletPicker
// ══════════════════════════════════════════
(function _patchHwPickers() {
  function _saveCurrentHwSelection() {
    try {
      const groupSel = document.getElementById('home-group-select');
      const walletSel = document.getElementById('home-wallet-select');
      if (groupSel && groupSel.value) {
        window._oneSaveHomeWallet(groupSel.value, walletSel ? walletSel.selectedIndex : 0);
      }
    } catch(e) {}
  }

  // Patch hwCloseGroupPicker
  const _origClose = window.hwCloseGroupPicker;
  if (typeof _origClose === 'function') {
    window.hwCloseGroupPicker = function() {
      _origClose.apply(this, arguments);
      setTimeout(_saveCurrentHwSelection, 100);
    };
  } else {
    // try later
    setTimeout(function() {
      if (typeof window.hwCloseGroupPicker === 'function' && !window.hwCloseGroupPicker._saved) {
        const _oc = window.hwCloseGroupPicker;
        window.hwCloseGroupPicker = function() { _oc.apply(this, arguments); setTimeout(_saveCurrentHwSelection, 100); };
        window.hwCloseGroupPicker._saved = true;
      }
    }, 1000);
  }

  // Patch hwCloseWalletPicker
  const _origCloseW = window.hwCloseWalletPicker;
  if (typeof _origCloseW === 'function') {
    window.hwCloseWalletPicker = function() {
      _origCloseW.apply(this, arguments);
      setTimeout(_saveCurrentHwSelection, 100);
    };
  } else {
    setTimeout(function() {
      if (typeof window.hwCloseWalletPicker === 'function' && !window.hwCloseWalletPicker._saved) {
        const _ocw = window.hwCloseWalletPicker;
        window.hwCloseWalletPicker = function() { _ocw.apply(this, arguments); setTimeout(_saveCurrentHwSelection, 100); };
        window.hwCloseWalletPicker._saved = true;
      }
    }, 1000);
  }

  // Also patch homeOnGroupChange and homeOnWalletChange
  setTimeout(function() {
    const _origHGC = window.homeOnGroupChange;
    if (typeof _origHGC === 'function' && !_origHGC._oneSaved) {
      window.homeOnGroupChange = function() {
        _origHGC.apply(this, arguments);
        setTimeout(_saveCurrentHwSelection, 200);
      };
      window.homeOnGroupChange._oneSaved = true;
    }
    const _origHWC = window.homeOnWalletChange;
    if (typeof _origHWC === 'function' && !_origHWC._oneSaved) {
      window.homeOnWalletChange = function() {
        _origHWC.apply(this, arguments);
        setTimeout(_saveCurrentHwSelection, 200);
      };
      window.homeOnWalletChange._oneSaved = true;
    }
  }, 500);
})();

// ══════════════════════════════════════════
// 8. LIVE PRICE TICKER — visible "LIVE" dot on home
//    Shows a blinking dot next to price refresh time
// ══════════════════════════════════════════
(function _injectLiveDot() {
  function _addLiveDot() {
    // Show only when a wallet is connected — do NOT replace innerHTML
    const _wk = (function() {
      try { return _oneGetSelectedKey(); } catch { return null; }
    })();
    const el = document.getElementById('home-price-source-label');
    if (el && !el._dotAdded && (_wk || (typeof homeActiveKey !== 'undefined' && homeActiveKey))) {
      el._dotAdded = true;
      el.style.display = 'flex';
    }
  }
  setTimeout(_addLiveDot, 500);
  setTimeout(_addLiveDot, 2000);
})();

})();
