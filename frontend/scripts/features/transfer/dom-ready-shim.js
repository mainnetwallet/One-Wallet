
// Transfer Hub DOMContentLoaded Shim
// Patches addEventListener so TH's DOMContentLoaded handlers fire correctly
// when integrated into One Wallet (where DOMContentLoaded already fired)
(function() {
  var _thInitialized = false;
  var _thPendingListeners = [];
  var _origAddEventListener = document.addEventListener.bind(document);

  // Override document.addEventListener to capture TH's DOMContentLoaded handlers
  document.addEventListener = function(type, fn, opts) {
    if (type === 'DOMContentLoaded') {
      // DOM is already ready - store for deferred execution by thBootstrap()
      _thPendingListeners.push(fn);
    } else {
      _origAddEventListener(type, fn, opts);
    }
  };

  // Called once when Transfer Hub page is first opened
  window.thBootstrap = function() {
    if (_thInitialized) return;
    _thInitialized = true;
    // Restore original addEventListener
    document.addEventListener = _origAddEventListener;
    // Run all captured DOMContentLoaded handlers
    _thPendingListeners.forEach(function(fn) {
      try { fn(); } catch(e) { console.warn('TH init error:', e); }
    });
    _thPendingListeners = [];
  };
})();

  