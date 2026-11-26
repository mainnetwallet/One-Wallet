'use strict';
// ══════════════════════════════════════════════════════
// MODULE 4 — KEEP ALIVE TIMER (Capacitor WebView)
// WebView background throttling bypass
// setInterval + MessageChannel trick
// BUG FIX 2: _mcAlive = false করো background এ, true করো foreground এ
// ══════════════════════════════════════════════════════
// Note: _mcAlive is set by initAppStateListener on state changes
var _mcAlive = true;

function initKeepAliveTimer() {
  // MessageChannel trick — browser/WebView throttle করতে পারে না
  const mc = new MessageChannel();

  function _ping() {
    if (!_mcAlive) return; // BUG FIX 2: background এ ping বন্ধ
    mc.port2.postMessage(Date.now());
  }

  mc.port1.onmessage = function() {
    // Pong received — alive ✅
  };

  // 5 second এ একবার ping — WebView কে active রাখে
  const _pingInterval = setInterval(_ping, 5000);

  // Capacitor App hide/show এ MessageChannel restart করো
  if (IS_CAPACITOR) {
    try {
      const { App } = window.Capacitor.Plugins;
      if (App) {
        App.addListener('appStateChange', function(state) {
          if (state.isActive) {
            _mcAlive = true;
            mc.port2.postMessage(Date.now()); // immediate ping on return
          } else {
            _mcAlive = false; // BUG FIX 2: background এ ping বন্ধ
          }
        });
      }
    } catch(e) {}
  }

  return _pingInterval;
}

// ══════════════════════════════════════════════════════
// MODULE 5 — BACKGROUND REFRESH SCHEDULER
// App minimize থাকলেও নির্দিষ্ট সময়ে refresh চলবে
// Android WorkManager এর HTML-side equivalent
// BUG FIX 3: App background এ থাকলে job scheduler pause করো
// ══════════════════════════════════════════════════════
const BG_JOBS = {
  price:    { interval: 30  * 1000, last: 0 },   // 30s
  balance:  { interval: 60  * 1000, last: 0 },   // 1min
  activity: { interval: 120 * 1000, last: 0 },   // 2min
  gas:      { interval: 45  * 1000, last: 0 },   // 45s
  swap:     { interval: 15  * 1000, last: 0 },   // 15s (swap চললে)
};

function runBgJobs() {
  // BUG FIX 3: App background/inactive থাকলে job run করো না
  // Capacitor BackgroundTask এর মাধ্যমে background job চলবে
  if (!_appIsActive) return;

  const now = Date.now();

  // Price
  if (now - BG_JOBS.price.last >= BG_JOBS.price.interval) {
    BG_JOBS.price.last = now;
    try { if (typeof silentPriceRefresh === 'function') silentPriceRefresh().catch(function(){}); } catch(e) {}
  }

  // Balance
  if (now - BG_JOBS.balance.last >= BG_JOBS.balance.interval) {
    BG_JOBS.balance.last = now;
    try {
      if (typeof _balanceCache !== 'undefined') {
        const chain = (typeof hwChainId !== 'undefined') ? String(hwChainId) : null;
        if (chain && _balanceCache[chain]) delete _balanceCache[chain];
      }
      if (typeof loadTokens === 'function' && typeof homeActiveKey !== 'undefined' && homeActiveKey) {
        loadTokens();
      }
    } catch(e) {}
  }

  // Activity
  if (now - BG_JOBS.activity.last >= BG_JOBS.activity.interval) {
    BG_JOBS.activity.last = now;
    try { if (typeof loadActivity === 'function') loadActivity(); } catch(e) {}
    try { if (typeof refreshPortfolioStats === 'function') refreshPortfolioStats(); } catch(e) {}
  }

  // Gas
  if (now - BG_JOBS.gas.last >= BG_JOBS.gas.interval) {
    BG_JOBS.gas.last = now;
    try { if (typeof refreshGasPrice === 'function') refreshGasPrice(); } catch(e) {}
  }

  // Swap (active হলে)
  if (now - BG_JOBS.swap.last >= BG_JOBS.swap.interval) {
    BG_JOBS.swap.last = now;
    try {
      if (typeof SW !== 'undefined' && SW._swapActive && SW.scanDexInterval === null) {
        if (typeof swStartDexScan === 'function') swStartDexScan();
      }
    } catch(e) {}
    try { if (typeof checkPendingTxStatus === 'function') checkPendingTxStatus(); } catch(e) {}
  }
}

// Job scheduler — 5s এ একবার check (actual run interval এ নিজেই throttle করে)
const _jobScheduler = setInterval(runBgJobs, 5000);

