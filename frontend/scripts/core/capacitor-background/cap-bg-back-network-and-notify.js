'use strict';
// ══════════════════════════════════════════════════════
// MODULE 6 — ANDROID BACK BUTTON HANDLER
// Back চাপলে minimize হবে, exit নয়
// ══════════════════════════════════════════════════════
function initBackButtonHandler() {
  if (!IS_ANDROID) return;
  try {
    const { App } = window.Capacitor.Plugins;
    if (!App) return;

    App.addListener('backButton', function(data) {
      if (data.canGoBack) {
        window.history.back();
      } else {
        // Exit এর বদলে minimize করো — background চলতে থাকবে
        App.minimizeApp();
      }
    });

  } catch(e) {}
}

// ══════════════════════════════════════════════════════
// MODULE 7 — NETWORK CHANGE LISTENER (Capacitor)
// Network ফিরলে সাথে সাথে সব refresh
// ══════════════════════════════════════════════════════
function initNetworkListener() {
  if (!IS_CAPACITOR) return;
  try {
    const { Network } = window.Capacitor.Plugins;
    if (!Network) return;

    Network.addListener('networkStatusChange', function(status) {
      if (status.connected) {
        setTimeout(function() { oneRefreshAll('network-restored'); }, 800);
      }
    });

  } catch(e) {}
}

// ══════════════════════════════════════════════════════
// MODULE 8 — TX NOTIFICATION (Swap/Send complete)
// Background এ থাকলে notification দিয়ে জানাবে
// ══════════════════════════════════════════════════════
window.oneNotifyTxComplete = function(opts) {
  // opts: { title, body, type }
  if (!IS_CAPACITOR) return;
  try {
    const { LocalNotifications } = window.Capacitor.Plugins;
    if (!LocalNotifications) return;

    LocalNotifications.schedule({
      notifications: [{
        id:         Math.floor(Math.random() * 9000) + 1000,
        title:      opts.title || '✅ Transaction Complete',
        body:       opts.body  || 'Your transaction was successful',
        sound:      'default',
        smallIcon:  'ic_stat_one',
        iconColor:  '#10b981',
        autoCancel: true
      }]
    }).catch(function() {});
  } catch(e) {}
};

// Swap/send complete হলে auto-notify (hook existing functions)
window.addEventListener('load', function() {
  setTimeout(function() {
    // Swap success hook
    ['_swRunSwap', 'swExecute', '_execSwap'].forEach(function(fn) {
      if (typeof window[fn] === 'function') {
        const orig = window[fn];
        window[fn] = async function() {
          try {
            const result = await orig.apply(this, arguments);
            // Success notification
            setTimeout(function() {
              oneNotifyTxComplete({
                title: '✅ Swap Complete',
                body:  'Your swap was executed successfully'
              });
            }, 2000);
            return result;
          } catch(err) {
            oneNotifyTxComplete({
              title: '❌ Swap Failed',
              body:  'Transaction failed — check activity'
            });
            throw err;
          }
        };
      }
    });
  }, 3000);
});

