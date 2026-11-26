
  // ── Export remaining IIFE-scoped functions called from HTML handlers ──
  window.openSwapChainPicker  = openSwapChainPicker;
  window.closeSwapChainPicker = closeSwapChainPicker;
  window.renderSwapChainList  = renderSwapChainList;
  window.swFetchQuotes        = swFetchQuotes;
  window.swOnAmountChange     = swOnAmountChange;
  window.swSelectDex          = swSelectDex;
  window.swSetMax             = swSetMax;
  window._swFetchFromBalanceLive = _swFetchFromBalanceLive;
  window._swFetchToBalanceLive   = _swFetchToBalanceLive;
  window.swRefreshGasFee         = swRefreshGasFee;
  window.swUpdateUI              = swUpdateUI;
  window.swInit                  = swInit;
  window.swRenderTokenBox        = swRenderTokenBox;

  // ── Percent Selector ──
  function swSetPercent(pct) {
    pct = Math.max(1, Math.min(100, parseInt(pct) || 1));
    const input = document.getElementById('sw-from-amount');
    const fill  = document.getElementById('sw-pct-fill');
    const thumb = document.getElementById('sw-pct-thumb');
    const label = document.getElementById('sw-pct-display');
    if (!input) return;

    const fillPct = (pct - 1) / 99 * 100;
    if (fill)  fill.style.width = fillPct + '%';
    if (thumb) {
      thumb.style.display = 'block';
      thumb.style.left = fillPct + '%';
      thumb.style.transform = 'translate(-50%,-50%) scale(1.2)';
      setTimeout(function(){ if(thumb) thumb.style.transform = 'translate(-50%,-50%) scale(1)'; }, 120);
    }
    if (label) {
      label.textContent = pct + '%';
      label.style.color = pct === 100 ? 'var(--accent-green)' : 'var(--accent-primary)';
    }

    if (!SW.walletConnected || !SW.fromToken || !SW.fromToken.balance) return;
    var bal = parseFloat(SW.fromToken.balance);
    if (isNaN(bal) || bal <= 0) return;
    var amt = bal * pct / 100;
    var decimals = amt < 0.001 ? 8 : amt < 1 ? 6 : amt < 100 ? 4 : 2;
    // blur + readOnly prevents mobile keyboard from opening on programmatic value set
    input.blur();
    input.readOnly = true;
    input.value = amt.toFixed(decimals).replace(/\.?0+$/, '') || '0';
    input.readOnly = false;
    swOnAmountChange();
  }
  window.swSetPercent = swSetPercent;
  window.setSwapChain         = setSwapChain;
  window.SW                   = SW; // expose state so home chain guard can read SW.chainId
  window._swUpdateConnectBtn  = _swUpdateConnectBtn; // expose for tas-swap-btn auto-connect
  window.swFetchBalances      = _nxsw_swUpdateBalances;    // expose for external callers (swUpdateBalances)

  // ── Global hook: called whenever _balanceCache is updated ──
  // Re-renders the token picker list with fresh balances (no RPC needed)
  window._swSyncTokenList = function() {
    try {
      const modal = document.getElementById('sw-token-modal');
      const isOpen = modal && modal.classList.contains('sw-open');
      if (isOpen && typeof swRenderTokenList === 'function' && typeof _swAllTokens !== 'undefined') {
        swRenderTokenList(_swAllTokens);
      }
    } catch(_e) {}
  };
  window.swUpdateButton       = swUpdateButton;      // expose for external callers

  // ── Restore saved swap chain UI on every page load ──
  // Runs after DOM is ready so sw-chain-bar elements exist
  (function _swRestoreChainOnLoad() {
    function _doRestore() {
      var chains = (typeof getAllChains === 'function' ? getAllChains() : []).filter(function(c){ return c.chainId !== null; });
      var savedId = _swSavedChainId;
      if (!savedId) {
        // No saved chain → Base is default. Still render token logos after DOM is ready.
        if (typeof swUpdateUI === 'function') setTimeout(function() { swUpdateUI(); }, 100);
        return;
      }
      var found = chains.find(function(c){ return String(c.chainId) === String(savedId); });
      if (found) {
        // Update SW state silently (save=false, already saved)
        SW.network = { id: found.id || String(found.chainId), name: found.name, emoji: found.emoji || '🔗', chainId: found.chainId, logoURI: found.logoURI || '' };
        SW.chainId = found.chainId;
        SW._chainInitialized = true; // prevent swInit from overwriting
        // Update tokens for this chain
        if (typeof _nxsw_getTokens === 'function') {
          var tokens = _nxsw_getTokens();
          if (tokens && tokens.length > 0) {
            // Base chain: always default to ETH → USDC
            if (found.chainId === 8453) {
              var ethTok  = tokens.find(function(t){ return t.sym === 'ETH'; })  || tokens[0];
              var usdcTok = tokens.find(function(t){ return t.sym === 'USDC'; }) || tokens[1] || tokens[0];
              SW.fromToken = ethTok;
              SW.toToken   = usdcTok;
            } else {
              SW.fromToken = tokens[0];
              SW.toToken   = tokens[1] || tokens[0];
            }
          }
        }
        // Update chain bar UI
        _swSyncChainBar(found.chainId, found);
        // ── FIX: Render token logos in FROM/TO boxes after restore ──
        if (typeof swUpdateUI === 'function') {
          setTimeout(function() { swUpdateUI(); }, 50);
        }
      }
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _doRestore);
    } else {
      setTimeout(_doRestore, 0);
    }
  })();

