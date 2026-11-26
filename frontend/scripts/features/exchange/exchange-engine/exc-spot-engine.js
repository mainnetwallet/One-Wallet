

// ════════════════════════════════════════════════
//  ONE EXCHANGE ENGINE
//  Supports: Binance, KuCoin, MEXC, Bybit
// ════════════════════════════════════════════════

window.EXC = (function() {
  var __NX = window.__nxp.mod_exc_spot_engine; delete window.__nxp.mod_exc_spot_engine;


  // ── State ──
  var state = {
    activeExchange: 'binance',
    activeTab: 'markets',
    activeQuote: 'USDT',
    activePair: (function(){
      try {
        var _ex = localStorage.getItem('one_exc_active') || 'binance';
        var _saved = localStorage.getItem('one_exc_pair_' + _ex);
        if (_saved) return _saved;
        var _entry = __NX.EXCHANGES.find(function(e){ return e.id === _ex; });
        return (_entry && _entry.defaultPair) || 'BTCUSDT';
      } catch(e) { return 'BTCUSDT'; }
    })(),
    orderType: 'market',
    orderSide: null,
    markets: [],
    marketsFiltered: [],
    sortCol: 'volume',
    sortDir: -1,
    portfolioCache: null,
    ordersMode: 'open',
    ordersCategory: 'open',
    logoMap: {},
    currentStepSize: 0,       // exchange lot-size step for active pair (0 = unknown)
    currentStepDecimals: 8,   // decimal places derived from stepSize
  }; __NX.state = state;  // exchange_id → { asset, balance }
  window._futBalCache = window._futBalCache || {};  // exchange_id → number (USDT balance)
  window._futPosCache = window._futPosCache || {};  // exchange_id → [{sym,side,size,...}]
  window._futOrdCache = window._futOrdCache || {};  // exchange_id → [{id,sym,side,...}]
  var _futBalCache = window._futBalCache; __NX._futBalCache = _futBalCache;
  var _futPosCache = window._futPosCache; __NX._futPosCache = _futPosCache;
  var _futOrdCache = window._futOrdCache; __NX._futOrdCache = _futOrdCache;

  // ── Native HTTP bridge — global window.nxFetch / window.nxBridgeGet
  // defined in early <script> block so all blocks can use them.
  // Local aliases for use inside this IIFE.
  var nxFetch = window.nxFetch;
  var nxBridgeGet = window.nxBridgeGet; __NX.nxBridgeGet = nxBridgeGet;

  // ── _nxSignedFetch: native bridge POST → direct fetch fallback ─────────
  // All signed API calls (orders, cancel, withdraw) route here.
  // Native bridge uses device IP → bypasses geo-block on some exchanges.
  window._nxSignedFetch = async function _nxSignedFetch(url, opts) {
    var method = (opts.method || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'DELETE' &&
        window.nxPost && window.OneBridge && typeof window.OneBridge.httpPost === 'function') {
      try {
        return await window.nxPost(url, { headers: opts.headers, body: opts.body, ms: opts.ms || 20000 });
      } catch(_e) {
        console.warn('[nxSignedFetch] native POST failed, direct fallback:', _e && _e.message);
      }
    }
    // No relay/proxy chain — direct fetch is the fallback.
    return fetch(url, {
      method: opts.method || 'GET',
      headers: opts.headers,
      body: opts.body,
      signal: AbortSignal.timeout(opts.ms || 20000),
    });
  };
  var _nxSignedFetch = window._nxSignedFetch; __NX._nxSignedFetch = _nxSignedFetch;
  // Expose globally — FUT (futures) module runs in its own IIFE and needs
  // native-bridge fetch too. Geo-blocked exchanges fail native bridge calls;
  // this lets FUT use the same native+direct path.
  window.fetchJsonWithFallback = __NX.fetchJsonWithFallback;
  // FUT (futures panel) lives in its own separate closure below and has no
  // access to this function otherwise — every futures order book WS call
  // (all exchanges) was throwing "_obWsConnect is not defined" and dying
  // silently, which is why the futures order book stayed empty.
  window._obWsConnect = __NX._obWsConnect;

  // ── Also update convRefreshUI when exchange changes ──
  var _origSelectExchange = null;

  // ──────────────────────────────────────────────

  return {
    _portfolioCache: __NX._portfolioCache,
    init: __NX.init,
    switchTab: __NX.switchTab,
    switchTradeTab: __NX.switchTradeTab,
    openSelector: __NX.openSelector,
    closeSelector: __NX.closeSelector,
    selectExchange: __NX.selectExchange,
    openApiSetup: __NX.openApiSetup,
    closeApiSetup: __NX.closeApiSetup,
    toggleSecretVis: __NX.toggleSecretVis,
    testApiKey: __NX.testApiKey,
    saveApiKey: __NX.saveApiKey,
    deleteKey: __NX.deleteKey,
    setOrderType: __NX.setOrderType,
    setSide: __NX.setSide,
    setPct: __NX.setPct,
    sliderChange: __NX.sliderChange,
    stepPrice: __NX.stepPrice,
    stepAmount: __NX.stepAmount,
    snapAmount: __NX.snapAmount,
    calcTotal: __NX.calcTotal,
    placeOrder: __NX.placeOrder,
    closeOrderConfirm: __NX.closeOrderConfirm,
    openPairPicker: __NX.openPairPicker,
    closePairPicker: __NX.closePairPicker,
    filterPairPicker: __NX.filterPairPicker,
    selectPair: __NX.selectPair,
    selectPairFromMarket: __NX.selectPairFromMarket,
    filterMarkets: __NX.filterMarkets,
    setQuote: __NX.setQuote,
    sortMarkets: __NX.sortMarkets,
    loadOrders: __NX.loadOrders,
    cancelOrder: __NX.cancelOrder,
    loadPortfolio: __NX.loadPortfolio,
    preloadAllPortfolios: __NX.preloadAllPortfolios,
    loadMarkets: __NX.loadMarkets,
    preloadAllMarkets: __NX.preloadAllMarkets,
    startOrderBook: __NX.startOrderBook,
    stopOrderBook: __NX.stopOrderBook,
    // Convert
    convSetMode: __NX.convSetMode,
    convRefreshUI: __NX.convRefreshUI,
    convOnInput: __NX.convOnInput,
    convSwap: __NX.convSwap,
    convSetMax: __NX.convSetMax,
    convOpenPicker: __NX.convOpenPicker,
    convClosePicker: __NX.convClosePicker,
    convFilterPicker: __NX.convFilterPicker,
    convSelectToken: __NX.convSelectToken,
    convPreview: __NX.convPreview,
    convClosePreview: __NX.convClosePreview,
    convConfirm: __NX.convConfirm,
    portToggleVis: portToggleVis,
    portAction:    portAction,
    renderPortTabs: __NX.renderPortTabs,
    switchPortTab:  __NX.switchPortTab,
    getState:      function() { return Object.assign({}, state, { marketsCache: __NX._marketsCache }); },
    _getKeys:      __NX.getExchangeKey,
  };

  // ── Portfolio: toggle balance visibility ──
  var _portHidden = false;
  function portToggleVis() {
    _portHidden = !_portHidden;
    var totalEl = document.getElementById('exc-port-total');
    var usdEl   = document.getElementById('exc-port-usd');
    var pnlEl   = document.getElementById('exc-port-pnl');
    var icon    = document.getElementById('exc-port-vis-toggle');
    if (totalEl) totalEl.style.filter = _portHidden ? 'blur(8px)' : '';
    if (usdEl)   usdEl.style.filter   = _portHidden ? 'blur(6px)' : '';
    if (pnlEl)   pnlEl.style.filter   = _portHidden ? 'blur(6px)' : '';
    if (icon) icon.innerHTML = '<span class="material-icons-round" style="font-size:15px;color:var(--text-muted);">' + (_portHidden ? 'visibility_off' : 'visibility') + '</span>';
  }

  // ── Portfolio: action buttons ──
  function portAction(action) {
    if (action === 'deposit') {
      // Open deposit modal with active quote coin context
      var info = (typeof window.excDepositCoinInfo === 'function') ? window.excDepositCoinInfo() : { sym:'USDT', name:'Tether USD', icon:'₮', iconColor:'#26a17b' };
      if (typeof window.excDepositOpen === 'function') window.excDepositOpen(info);
    } else if (action === 'send') {
      var info = (typeof window.excDepositCoinInfo === 'function') ? window.excDepositCoinInfo() : { sym:'USDT', name:'Tether USD', icon:'₮', iconColor:'#26a17b' };
      if (typeof window.excWithdrawOpen === 'function') window.excWithdrawOpen(info);
    } else if (action === 'transfer') {
      __NX.switchTab('transfer');
      if (typeof trfOpen === 'function') trfOpen();
    } else if (action === 'convert') {
      // Jump to Trade tab → Convert mode (reuses the existing Convert panel)
      __NX.switchTab('trade');
      __NX.convSetMode('convert');
    } else if (action === 'history') {
      __NX.switchTab('transfer');
      if (typeof trfOpen === 'function') trfOpen();
    } else {
      if (typeof showToast === 'function') showToast('Coming soon: ' + action);
    }
  }

})();