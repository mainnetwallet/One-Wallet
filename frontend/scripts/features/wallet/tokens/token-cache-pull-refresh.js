
(function _onePTR() {
  'use strict';
  var __NX = window.__nxp.mod_token_cache_pull_refresh; delete window.__nxp.mod_token_cache_pull_refresh;

  // Run after DOM loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', __NX._init);
  } else {
    __NX._init();
  }

  // Expose restore function for instant app-open use (called before PTR module fully inits)
  window._onePTRRestore = function(tokens) {
    // Don't restore cached tokens when no wallet is selected
    try { if (!_oneGetSelectedKey()) return; } catch(e) {}
    if (tokens && tokens.length) __NX._restoreTokenList(tokens);
  };

  // Expose for external use
  window._onePTRSaveNow = function() {
    var snap = __NX._snapshotTokenList();
    if (snap) __NX._saveTokenList(snap);
  };

  // Pick up any pending restore queued before this module loaded
  if (window._onePendingRestore) {
    var _pending = window._onePendingRestore;
    window._onePendingRestore = null;
    window._oneEarlyTokens = null; // clear so we don't double-restore
    setTimeout(function() {
      try { if (!_oneGetSelectedKey()) return; } catch(e) {}
      var tokenListEl = document.getElementById('token-list');
      if (tokenListEl && !tokenListEl.querySelectorAll('.token-card').length) {
        __NX._restoreTokenList(_pending);
      }
    }, 0);
  }

  // Also pick up early-inject tokens stored before this module loaded
  if (window._oneEarlyTokens && window._oneEarlyTokens.length) {
    var _early = window._oneEarlyTokens;
    window._oneEarlyTokens = null; // consume immediately to prevent re-entry
    setTimeout(function() {
      var tokenListEl = document.getElementById('token-list');
      if (tokenListEl && !tokenListEl.querySelectorAll('.token-card').length) {
        __NX._restoreTokenList(_early);
      }
    }, 50);
  }

})();
