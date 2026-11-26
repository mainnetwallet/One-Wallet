'use strict';
// ══════════════════════════════════════════════════════
// MODULE 1 — CAPACITOR APP STATE LISTENER
// App minimize/restore detect করো
// ══════════════════════════════════════════════════════

// App active/inactive state — job scheduler এ ব্যবহার হবে
let _appIsActive = true;

function initAppStateListener() {
  if (!IS_CAPACITOR) return;
  try {
    const { App } = window.Capacitor.Plugins;
    if (!App) return;

    let _bgEnterTime = 0;

    App.addListener('appStateChange', function(state) {
      if (state.isActive) {
        // App foreground এ ফিরেছে
        _appIsActive = true;

        // BUG FIX 2: _mcAlive restore করো যাতে KeepAlive ping আবার শুরু হয়
        _mcAlive = true;

        // যেকোনো সময় background থাকলেও ফিরলে সব refresh
        setTimeout(function() {
          oneRefreshAll('app-foregrounded');
        }, 300);

      } else {
        // App minimize/background হয়েছে
        _appIsActive = false;
        _bgEnterTime = Date.now();

        // BUG FIX 2: Background এ গেলে MessageChannel ping বন্ধ করো (battery save)
        _mcAlive = false;

        // Background task শুরু করো
        startBackgroundTask();
      }
    });

  } catch(e) {
  }
}

// ══════════════════════════════════════════════════════
// MODULE 2 — CAPACITOR BACKGROUND TASK
// Android: minimize হলে OS কে বলো "কাজ আছে, kill করো না"
// iOS: extra 30s background time নাও
// BUG FIX 1: taskId সঠিকভাবে নিয়ে finish() call করো
// ══════════════════════════════════════════════════════
let _bgTaskId = null;

function startBackgroundTask() {
  if (!IS_CAPACITOR) return;
  try {
    const { BackgroundTask } = window.Capacitor.Plugins;
    if (!BackgroundTask) return;

    // আগের task আগে শেষ করো (leak prevent)
    if (_bgTaskId !== null) {
      try { BackgroundTask.finish({ taskId: _bgTaskId }); } catch(e) {}
      _bgTaskId = null;
    }

    // BUG FIX 1: beforeExit এ taskId parameter সঠিকভাবে নাও
    BackgroundTask.beforeExit(async function({ taskId }) {
      _bgTaskId = taskId;

      try {
        // Background এ price refresh
        if (typeof silentPriceRefresh === 'function') {
          await silentPriceRefresh().catch(function(){});
        }
      } catch(e) {}

      try {
        // Balance cache clear
        if (typeof _balanceCache !== 'undefined') {
          const chain = (typeof hwChainId !== 'undefined') ? String(hwChainId) : null;
          if (chain && _balanceCache[chain]) delete _balanceCache[chain];
        }
      } catch(e) {}

      try {
        // Swap monitor (active থাকলে)
        if (typeof SW !== 'undefined' && SW._swapActive && SW.scanDexInterval === null) {
          if (typeof swStartDexScan === 'function') swStartDexScan();
        }
      } catch(e) {}

      // BUG FIX 1: কাজ শেষে OS কে জানাও — না করলে Android app kill করে
      try {
        await BackgroundTask.finish({ taskId: taskId });
      } catch(e) {}
      _bgTaskId = null;
    });

  } catch(e) {
  }
}

// ══════════════════════════════════════════════════════
// MODULE 3 — FOREGROUND SERVICE NOTIFICATION (Android)
// Notification bar এ ONE চলছে দেখাবে
// OS কে জানাবে এই app টা kill করা যাবে না
// BUG FIX 4: ongoing:true + visibility:PUBLIC + channelId সঠিকভাবে দাও
//            Android 8+ এ foreground service notification এভাবে কাজ করে
// ══════════════════════════════════════════════════════
function startForegroundService() {
  if (!IS_ANDROID) return;
  try {
    const { LocalNotifications } = window.Capacitor.Plugins;
    if (!LocalNotifications) return;

    // Permission নাও
    LocalNotifications.requestPermissions().then(function(result) {
      if (result.display !== 'granted') return;

      // BUG FIX 4: Android 8+ এ notification channel আগে create করতে হয়
      // Capacitor LocalNotifications plugin automatically creates default channel
      // কিন্তু foreground service এর জন্য channelId explicitly দিতে হয়
      LocalNotifications.schedule({
        notifications: [{
          id:           9999,
          title:        '⚡ One Wallet Running',
          body:         'DeFi terminal active — prices & swaps monitored',
          ongoing:      true,          // BUG FIX 4: dismiss করা যাবে না (foreground service behavior)
          autoCancel:   false,
          sound:        null,
          smallIcon:    'ic_stat_one',
          iconColor:    '#6366f1',
          channelId:    'one_foreground', // BUG FIX 4: Android 8+ এ channel দরকার
          visibility:   1,             // BUG FIX 4: VISIBILITY_PUBLIC = 1 (lock screen এও দেখাবে)
          importance:   3,             // IMPORTANCE_DEFAULT — silent but persistent
          extra: { type: 'foreground_service' }
        }]
      }).catch(function() {});
    }).catch(function() {});

  } catch(e) {
  }
}

