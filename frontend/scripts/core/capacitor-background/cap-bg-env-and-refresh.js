
'use strict';

// ══════════════════════════════════════════════════════
// DETECTION — Capacitor APK এ আছি কিনা
// ══════════════════════════════════════════════════════
const IS_CAPACITOR = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const IS_ANDROID   = IS_CAPACITOR && window.Capacitor.getPlatform() === 'android';
const IS_IOS       = IS_CAPACITOR && window.Capacitor.getPlatform() === 'ios';


// ══════════════════════════════════════════════════════
// CENTRAL REFRESH — সব section একসাথে
// ══════════════════════════════════════════════════════
function oneRefreshAll(source) {

  // 1. Token prices
  try { if (typeof silentPriceRefresh === 'function') silentPriceRefresh().catch(function(){}); } catch(e) {}

  // 2. Wallet balance + token list
  try {
    if (typeof _balanceCache !== 'undefined') {
      const chain = (typeof hwChainId !== 'undefined') ? String(hwChainId) : null;
      if (chain && _balanceCache[chain]) delete _balanceCache[chain];
    }
    if (typeof loadTokens === 'function' && typeof homeActiveKey !== 'undefined' && homeActiveKey) {
      loadTokens();
    }
  } catch(e) {}

  // 3. Swap DEX scanner
  try {
    if (typeof SW !== 'undefined' && SW._swapActive && SW.scanDexInterval === null) {
      if (typeof swStartDexScan === 'function') swStartDexScan();
    }
  } catch(e) {}

  // 4. Chart
  try {
    if (typeof _lwChartVisible !== 'undefined' && _lwChartVisible) {
      if      (typeof _lwStartPoll === 'function') _lwStartPoll();
      else if (typeof lwStartPoll  === 'function') lwStartPoll();
    }
  } catch(e) {}

  // 5. Activity feed
  try { if (typeof loadActivity === 'function') loadActivity(); } catch(e) {}

  // 6. Portfolio stats
  try { if (typeof refreshPortfolioStats === 'function') refreshPortfolioStats(); } catch(e) {}

  // 7. Gas price
  try { if (typeof refreshGasPrice === 'function') refreshGasPrice(); } catch(e) {}

  // 8. Bridge quote
  try { if (typeof refreshBridgeQuote === 'function') refreshBridgeQuote(); } catch(e) {}

  // 9. Pending transaction status
  try { if (typeof checkPendingTxStatus === 'function') checkPendingTxStatus(); } catch(e) {}
}

