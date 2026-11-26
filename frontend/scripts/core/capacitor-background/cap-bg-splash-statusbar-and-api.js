'use strict';
// ══════════════════════════════════════════════════════
// MODULE 9 — SPLASH SCREEN HIDE (Capacitor)
// ══════════════════════════════════════════════════════
function hideSplash() {
  if (!IS_CAPACITOR) return;
  try {
    const { SplashScreen } = window.Capacitor.Plugins;
    if (SplashScreen) {
      SplashScreen.hide({ fadeOutDuration: 300 });
    }
  } catch(e) {}
}

// ══════════════════════════════════════════════════════
// MODULE 10 — STATUS BAR (Android)
// ══════════════════════════════════════════════════════
function initStatusBar() {
  if (!IS_CAPACITOR) return;
  try {
    const { StatusBar } = window.Capacitor.Plugins;
    if (!StatusBar) return;
    StatusBar.setStyle({ style: 'DARK' });           // dark icons
    StatusBar.setBackgroundColor({ color: '#050508' }); // app bg color
  } catch(e) {}

  // Light mode toggle এ status bar update
  const origToggle = window.toggleLightMode;
  if (typeof origToggle === 'function') {
    window.toggleLightMode = function() {
      origToggle.apply(this, arguments);
      setTimeout(function() {
        try {
          const { StatusBar } = window.Capacitor.Plugins;
          if (!StatusBar) return;
          const isLight = document.body.classList.contains('light-mode');
          StatusBar.setStyle({ style: isLight ? 'LIGHT' : 'DARK' });
          StatusBar.setBackgroundColor({ color: isLight ? '#eef0f7' : '#050508' });
        } catch(e) {}
      }, 100);
    };
  }
}

// ══════════════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════════════
window.OneCapBG = {
  refreshAll:       oneRefreshAll,
  startBgTask:      startBackgroundTask,
  notifyTx:         window.oneNotifyTxComplete,
  isCapacitor:      IS_CAPACITOR,
  isAndroid:        IS_ANDROID,
  isIOS:            IS_IOS,
  jobStatus: function() {
    const now = Date.now();
    return Object.keys(BG_JOBS).map(function(k) {
      return k + ': next in ' + Math.max(0, Math.round((BG_JOBS[k].interval - (now - BG_JOBS[k].last)) / 1000)) + 's';
    });
  }
};

// ══════════════════════════════════════════════════════
// BOOT
// ══════════════════════════════════════════════════════
window.addEventListener('load', function() {
  initAppStateListener();
  initBackButtonHandler();
  initNetworkListener();
  initStatusBar();
  initKeepAliveTimer();
  startForegroundService();
  hideSplash();
  // Initial job run
  setTimeout(runBgJobs, 2000);
});

