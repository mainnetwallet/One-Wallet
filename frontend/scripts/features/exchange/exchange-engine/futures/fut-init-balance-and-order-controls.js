// Futures: init, balance loading, side/order-type/position-mode controls
// Part of the futures engine (FUT) module (split by topic; no logic change).
(function (__NX) {
  __NX.init = init;
  __NX.refreshAvbl = refreshAvbl;
  __NX.loadFutBalance = loadFutBalance;
  __NX.setSide = setSide;
  __NX.setOrderType = setOrderType;
  __NX.togglePosMode = togglePosMode;
  __NX.openMarginPicker = openMarginPicker;


  // ── Init ──
  function init() {
    var excId = __NX.getActiveExchangeId();
    var cfg = __NX.getFutCfg();

    // Convert current symbol to this exchange's format
    // Restore last Future pair from localStorage (independent from Spot)
    var _savedFutPair = '';
    try { _savedFutPair = localStorage.getItem('one_fut_pair_' + excId) || ''; } catch(e) {}
    var rawSym = (_savedFutPair || __NX.state.symbol || 'BTCUSDT')
      .replace(/USDT$/i, '')
      .replace(/[-_\/\s].*$/, '');
    if (!rawSym || rawSym.length > 8) rawSym = 'BTC';

    __NX.state.exchangeId = excId;
    __NX.state.symbol = rawSym.toUpperCase() + 'USDT';

    // Update header
    var symEl = document.getElementById('fut-symbol');
    if (symEl) symEl.textContent = rawSym.toUpperCase() + '/USDT';

    // Show exchange badge on header
    var exBadge = document.getElementById('fut-exchange-badge');
    if (exBadge) exBadge.textContent = cfg.name + ' FUTURES';

    setSide(__NX.state.side);
    setOrderType(__NX.state.orderType);
    var mmEl = document.getElementById('fut-margin-mode'); if (mmEl) mmEl.textContent = __NX.state.marginMode;
    // Restore saved leverage for this exchange+symbol from localStorage (persists across sessions)
    try {
      var _lsLev = parseInt(localStorage.getItem('fut_lev_' + excId + '_' + __NX.state.symbol));
      if (!isNaN(_lsLev) && _lsLev >= 1) __NX.state.leverage = _lsLev;
    } catch(e) {}
    // Restore cached leverage for this (exchange, symbol) if available
    var _lvKey3 = excId + ':' + __NX.state.symbol;
    if (__NX.state._leverageCache[_lvKey3] != null) __NX.state.leverage = __NX.state._leverageCache[_lvKey3];
    var lvEl = document.getElementById('fut-leverage-btn'); if (lvEl) lvEl.setAttribute('data-lev', __NX.state.leverage); var lvTxt = document.getElementById('fut-lev-text'); if (lvTxt) lvTxt.textContent = __NX.state.leverage + 'x';
    // Fetch max leverage (for slider) and current leverage from exchange
    __NX._fetchMaxLeverage();
    __NX._fetchLeverageFromExchange();
    __NX._syncMarginModeFromExchange();
    __NX._updateAmtUnit();
    // Reset amount field and margin display on exchange change
    var _amtReset = document.getElementById('fut-amount'); if (_amtReset) _amtReset.value = '';
    var _costReset = document.getElementById('fut-cost'); if (_costReset) _costReset.textContent = '0.00 USDT';
    var _liqReset = document.getElementById('fut-liq-price'); if (_liqReset) _liqReset.textContent = '-- USDT';
    var _pctFillR = document.getElementById('fut-pct-fill'); if (_pctFillR) _pctFillR.style.width = '0%';
    document.querySelectorAll('.fut-pct-dot').forEach(function(d){ d.classList.remove('fut-pct-on'); });
    __NX._attachScrollInputs();
    refreshAvbl();
    __NX._setSplitHeight();
    __NX.startFeed();
    __NX.loadPositions();
    __NX.loadOpenOrders();
    loadFutBalance();
  }

  function refreshAvbl() {
    var bal = (window._excUsdtBalanceCache) ? window._excUsdtBalanceCache : 0;
    var avblEl = document.getElementById('fut-avbl');
    if (avblEl) avblEl.textContent = __NX.fmt(bal, 2) + ' USDT';
  }

  // ── Load futures USDT balance from exchange API ──
  async function loadFutBalance() {
    var keys = __NX.getApiKeys();
    var cfg0 = __NX.getFutCfg();
    if (cfg0 && cfg0.signType === 'coinbase_jwt') {
      if (!keys || !keys.cdpKeyName || !keys.cdpPem) return;
    } else if (!keys || !keys.apiKey) return;
    var cfg = __NX.getFutCfg();
    var excId = __NX.state.exchangeId;
    // ── Cache check: tab switch করলে instantly দেখাও ──
    if (__NX._futBalCache[excId] !== undefined) {
      window._excUsdtBalanceCache = __NX._futBalCache[excId];
      refreshAvbl();
      __NX.calcCost();
      return;
    }
    var bal = 0;
    try {
      var data;
      if (excId === 'binance') {
        data = await __NX.signedFetch(cfg, cfg.balance, {}, 'GET');
        var item = (Array.isArray(data) ? data : []).find(function(a){ return a.asset === 'USDT'; });
        bal = parseFloat((item || {}).availableBalance || 0);

      } else if (excId === 'bybit') {
        // Linear USDT perpetuals settle in the UNIFIED account, not the
        // legacy CONTRACT account — CONTRACT returns an empty list for
        // unified-margin accounts (now the default for all new Bybit
        // accounts), so this always showed 0 balance.
        data = await __NX.signedFetch(cfg, cfg.balance, { accountType: 'UNIFIED', coin: 'USDT' }, 'GET');
        var coin = (((data.result || {}).list || [])[0] || {}).coin;
        var c = (Array.isArray(coin) ? coin : []).find(function(x){ return x.coin === 'USDT'; });
        bal = parseFloat((c || {}).availableToWithdraw || 0);

      } else if (excId === 'bitget') {
        data = await __NX.signedFetch(cfg, cfg.balance, { productType: 'USDT-FUTURES', marginCoin: 'USDT' }, 'GET');
        bal = parseFloat(((data.data || [])[0] || {}).available || 0);

      } else if (excId === 'mexc') {
        data = await __NX.signedFetch(cfg, cfg.balance, {}, 'GET');
        var asset = (data.data || []).find(function(a){ return a.currency === 'USDT'; });
        bal = parseFloat((asset || {}).available || 0);

      } else if (excId === 'gateio') {
        data = await __NX.signedFetch(cfg, cfg.balance, null, 'GET');
        bal = parseFloat((data || {}).available || 0);

      } else if (excId === 'htx') {
        data = await __NX.signedFetch(cfg, cfg.balance, null, 'POST', { margin_account: 'USDT' });
        var acct = ((data.data || [])[0] || {});
        bal = parseFloat(acct.margin_available || acct.margin_balance || 0);

      } else if (excId === 'bingx') {
        data = await __NX.signedFetch(cfg, cfg.balance, {}, 'GET');
        bal = parseFloat(((data.data || {}).balance || {}).availableMargin || 0);

      } else if (excId === 'kucoin') {
        data = await __NX.signedFetch(cfg, cfg.balance, { currency: 'USDT' }, 'GET');
        bal = parseFloat((data.data || {}).availableBalance || 0);

      } else if (excId === 'phemex') {
        data = await __NX.signedFetch(cfg, cfg.balance, { currency: 'USDT' }, 'GET');
        var acct = ((data.data || {}).account || {});
        bal = parseFloat(acct.availableBalanceRv || acct.availBalRv || acct.accountBalanceRv || 0);

      } else if (excId === 'bitmart') {
        data = await __NX.signedFetch(cfg, cfg.balance, {}, 'GET');
        var item = ((data.data || {}).assets || []).find(function(a){ return a.currency === 'USDT'; });
        bal = parseFloat((item || {}).available_balance || 0);

      } else if (excId === 'kraken') {
        data = await __NX.signedFetch(cfg, cfg.balance, null, 'GET');
        // Kraken Futures: accounts object, find cash account with USD/XBT
        var accs = data.accounts || {};
        var cashKey = Object.keys(accs).find(function(k){ return k === 'cash' || k.startsWith('fi_'); });
        bal = parseFloat((((accs[cashKey] || {}).balances || {}).USD) || 0);

      } else if (excId === 'digifinex') {
        data = await __NX.signedFetch(cfg, cfg.balance, {}, 'GET');
        var item = ((data.data || {}).assets || []).find(function(a){ return a.currency === 'USDT'; });
        bal = parseFloat((item || {}).available || 0);

      } else if (excId === 'lbank') {
        data = await __NX.signedFetch(cfg, cfg.balance, {}, 'GET');
        var item = ((data.data || [])[0] || {});
        bal = parseFloat(item.available_balance || item.availableBalance || 0);

      } else if (excId === 'bitfinex') {
        data = await __NX.signedFetch(cfg, cfg.balance, null, 'POST', []);
        var wallets = Array.isArray(data) ? data : [];
        // Bitfinex v2 wallets: [type, currency, balance, unsettled, available]
        var w = wallets.find(function(x){ return Array.isArray(x) && x[0]==='margin' && (x[1]==='UST'||x[1]==='USDT'); });
        bal = parseFloat((w || [])[4] || 0);

      } else if (excId === 'coinbase') {
        // INTX perps are USDC-margined, not USDT — but the rest of this UI
        // treats this number as "available futures balance" regardless of
        // denomination, so USDC is fine here (1:1 USD-pegged in practice).
        var portfolioUuid = await __NX._coinbaseGetPortfolioUuid(keys);
        data = await __NX._coinbaseFetchJwt('GET', '/api/v3/brokerage/intx/balances/' + portfolioUuid, keys);
        var pb = ((data && data.portfolio_balances) || [])[0] || {};
        var usdcBal = (pb.balances || []).find(function(b){ return b.asset && b.asset.asset_name === 'USDC'; });
        bal = usdcBal ? (parseFloat(usdcBal.quantity || 0) - parseFloat(usdcBal.hold || 0)) : 0;

      }
    } catch(e) { bal = 0; }

    if (bal >= 0) {
      window._excUsdtBalanceCache = bal;
      // Cache save for instant display on future tab switch
      if (__NX.state.exchangeId === excId) __NX._futBalCache[excId] = bal;
      refreshAvbl();
      __NX.calcCost();
    }
  }

  // ── Side ──
  function setSide(side) {
    __NX.state.side = side;
    var b = document.getElementById('fut-tab-buy');
    var s = document.getElementById('fut-tab-sell');
    var btn = document.getElementById('fut-submit-btn');
    if (!b || !s || !btn) return;
    if (side === 'buy') {
      b.style.background = '#0ecb81'; b.style.color = '#fff';
      s.style.background = 'transparent'; s.style.color = 'var(--text-muted)';
      btn.style.background = '#0ecb81'; btn.textContent = 'Buy / Long';
    } else {
      s.style.background = '#f6465d'; s.style.color = '#fff';
      b.style.background = 'transparent'; b.style.color = 'var(--text-muted)';
      btn.style.background = '#f6465d'; btn.textContent = 'Sell / Short';
    }
  }

  function setOrderType(t) {
    __NX.state.orderType = t;
    var sel = document.getElementById('fut-order-type'); if (sel) sel.value = t;
    var isMarket = (t === 'market');
    var priceRow = document.getElementById('fut-price-row'); if (priceRow) priceRow.style.display = isMarket ? 'none' : 'flex';
    var priceInp = document.getElementById('fut-price'); if (priceInp) priceInp.disabled = isMarket;
  }

  function togglePosMode() {
    __NX.state.posMode = (__NX.state.posMode === 'S') ? 'H' : 'S';
    var el = document.getElementById('fut-pos-mode'); if (el) el.textContent = __NX.state.posMode;
    if (typeof showToast === 'function') showToast(__NX.state.posMode === 'S' ? 'One-way mode' : 'Hedge mode');
  }

  function openMarginPicker() {
    var newMode = (__NX.state.marginMode === 'Cross') ? 'Isolated' : 'Cross';
    __NX.state.marginMode = newMode;
    var el = document.getElementById('fut-margin-mode'); if (el) el.textContent = newMode;
    // ── Apply to exchange API ──
    __NX._applyMarginModeToExchange(newMode).catch(function(){});
  }
})((window.__nxp = window.__nxp || {}).mod_fut_futures_engine = window.__nxp.mod_fut_futures_engine || {});
