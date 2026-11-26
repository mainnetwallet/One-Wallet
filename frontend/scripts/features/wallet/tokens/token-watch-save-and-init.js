(function (__NX) {
'use strict';
__NX._init = _init;
  /* Watch for token list DOM changes and save snapshot */
  function _watchAndSave() {
    var tokenListEl = document.getElementById('token-list');
    if (!tokenListEl) return;
    var saveDebounce;
    var saveDebounce2;
    var _lastSavedSnap = null;

    function _doSave() {
      var cards = document.querySelectorAll('#token-list .token-card');
      if (!cards.length) return;

      var hasRealData  = false;
      var hasBalance   = false;
      var hasPrice     = false;
      var hasChange    = false;

      cards.forEach(function(card) {
        var priceEl  = card.querySelector('.tlp-price');
        var amtEl    = card.querySelector('.token-amount');
        var usdEl    = card.querySelector('.token-usd');
        var changeEl = card.querySelector('.tlp-change');

        var priceText  = priceEl  ? priceEl.textContent.trim()  : '';
        var amtText    = amtEl   ? amtEl.textContent.trim()     : '';
        var usdText    = usdEl   ? usdEl.textContent.trim()     : '';
        var changeText = changeEl ? changeEl.textContent.trim() : '';

        if (priceText && priceText !== '$0.000000' && priceText !== '—' && priceText !== '...') hasPrice = true;
        if (amtText   && amtText  !== '—' && amtText !== '' && amtText !== '...')               hasBalance = true;
        if (usdText   && usdText  !== '—' && usdText !== '' && usdText !== '...')               hasBalance = true;
        if (changeText && changeText !== '')                                                     hasChange = true;
        if (hasPrice || hasBalance) hasRealData = true;
      });

      // Must have at least price OR balance — but don't require change%
      if (!hasRealData) return;

      var snap = __NX._snapshotTokenList();
      if (!snap || !snap.length) return;

      // Avoid saving identical snapshots unnecessarily
      var snapStr = JSON.stringify(snap.map(function(s) { return s.amount + '|' + s.usd + '|' + s.price + '|' + s.change; }));
      if (snapStr === _lastSavedSnap) return;
      _lastSavedSnap = snapStr;

      __NX._saveTokenList(snap);
      __NX._sessionFetched = true;
    }

    var obs = new MutationObserver(function() {
      // Fast save (2s) — captures balance+price as soon as they arrive
      clearTimeout(saveDebounce);
      saveDebounce = setTimeout(function() {
        _doSave();
        // Delayed save (6s) — captures change% if it arrives later, overwrites the fast save
        clearTimeout(saveDebounce2);
        saveDebounce2 = setTimeout(_doSave, 4000);
      }, 2000);
    });
    obs.observe(tokenListEl, { childList: true, subtree: true, characterData: true });
  }
  /* ─── INIT ─── */
  function _init() {
    // 1. Immediately restore saved list (instant display on every open)
    // Restore saved cache — strictly for the currently selected wallet only
    var savedData = __NX._loadTokenList();
    var savedTokens = savedData && savedData.tokens ? savedData.tokens : null;

    if (savedTokens && savedTokens.length > 0) {
      var tryRestore = function() {
        var tokenListEl = document.getElementById('token-list');
        var hasRealCards = tokenListEl && tokenListEl.querySelectorAll('.token-card').length > 0;
        if (!hasRealCards && tokenListEl) {
          __NX._restoreTokenList(savedTokens);
          return true;
        }
        return false;
      };
      // Try synchronously first, then rapid poll until DOM ready
      if (!tryRestore()) {
        var _ptrTimer = setInterval(function() {
          if (tryRestore()) clearInterval(_ptrTimer);
        }, 16);
        setTimeout(function() { clearInterval(_ptrTimer); }, 1500);
      }
    }

    // 2. Watch DOM mutations and auto-save token snapshots
    var watchAttempts = 0;
    var tryWatch = function() {
      var el = document.getElementById('token-list');
      if (el) {
        _watchAndSave();
      } else if (watchAttempts++ < 20) {
        setTimeout(tryWatch, 300);
      }
    };
    tryWatch();

    // 3. Hook switchPage — pre-fill token-list with cache BEFORE loadTokens clears it
    //    This prevents the blank/wrong flash when returning to home from other sections
    var _hookedSwitchPage = false;
    function _hookSwitchPage() {
      if (_hookedSwitchPage) return;
      var origSwitchPage = window.switchPage;
      if (typeof origSwitchPage !== 'function') return;
      _hookedSwitchPage = true;
      window.switchPage = function(page) {
        if (page === 'home') {
          var latestData = __NX._loadTokenList();
          var latestTokens = latestData && latestData.tokens ? latestData.tokens : null;
          // Always restore cached snapshot — loadTokens() updates in-place as fresh data arrives
          if (latestTokens && latestTokens.length > 0) {
            var tokenListEl = document.getElementById('token-list');
            if (tokenListEl) __NX._restoreTokenList(latestTokens);
          }
        }
        origSwitchPage.apply(this, arguments);
      };
    }

    _hookSwitchPage();
    setTimeout(_hookSwitchPage, 500);
    setTimeout(_hookSwitchPage, 1500);

    // 4. Init Pull-to-Refresh after page renders
    setTimeout(__NX._initPTR, 600);
    setTimeout(__NX._initPTR, 2000);
  }
})((window.__nxp = window.__nxp || {}).mod_token_cache_pull_refresh = window.__nxp.mod_token_cache_pull_refresh || {});
