// Futures: pair picker, pair parsing and selection
// Part of the futures engine (FUT) module (split by topic; no logic change).
(function (__NX) {
  __NX.openPairPicker = openPairPicker;
  __NX._filterFutPairs = _filterFutPairs;
  __NX._selectFutPair = _selectFutPair;


  function openPairPicker() {
    var sheet = document.getElementById('fut-pair-sheet');
    if (!sheet) { _createFutPairSheet(); sheet = document.getElementById('fut-pair-sheet'); }
    sheet.style.display = 'flex';
    var inp = document.getElementById('fut-pair-search-inp');
    if (inp) inp.value = '';
    _loadFutPairs('');
  }

  function _createFutPairSheet() {
    var el = document.createElement('div');
    el.id = 'fut-pair-sheet';
    el.onclick = function(e) { if (e.target === el) el.style.display = 'none'; };
    el.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:30000;align-items:flex-end;justify-content:center;';
    el.innerHTML =
      '<div onclick="event.stopPropagation()" style="width:100%;max-width:480px;background:var(--bg-card);border-radius:24px 24px 0 0;padding:16px 16px 40px;max-height:80vh;display:flex;flex-direction:column;">' +
        '<div style="width:36px;height:4px;background:rgba(255,255,255,0.15);border-radius:2px;margin:0 auto 14px;"></div>' +
        '<div style="font-size:13px;font-weight:700;color:var(--text-primary);font-family:var(--font-mono);margin-bottom:12px;text-align:center;letter-spacing:0.5px;">SELECT PAIR</div>' +
        '<input id="fut-pair-search-inp" type="text" placeholder="Search (BTC, ETH, SOL…)" oninput="FUT._filterFutPairs(this.value)" style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:10px 14px;font-size:13px;color:var(--text-primary);font-family:var(--font-mono);outline:none;margin-bottom:10px;width:100%;box-sizing:border-box;" />' +
        '<div id="fut-pair-list" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:3px;"></div>' +
      '</div>';
    document.body.appendChild(el);
  }

  // Cache pairs per-exchange so switching exchanges doesn't reuse stale data
  var _futPairsCache = {};

  // KuCoin futures uses legacy ticker codes for a few coins
  var _KUCOIN_BASE_MAP = { XBT: 'BTC' };

  // Parse each exchange's exchangeInfo-style response into a normalized
  // [{symbol, base}] list of USDT-margined perpetual/swap contracts.
  function _parseFutPairs(excId, d) {
    try {
      if (excId === 'binance') {
        return (d.symbols || [])
          .filter(function(s){ return s.status === 'TRADING' && s.contractType === 'PERPETUAL' && s.quoteAsset === 'USDT'; })
          .map(function(s){ return { symbol: s.symbol, base: s.baseAsset }; });
      }
      if (excId === 'bybit') {
        var list = (d.result && d.result.list) || [];
        return list
          .filter(function(s){ return s.status === 'Trading' && s.quoteCoin === 'USDT'; })
          .map(function(s){ return { symbol: s.symbol, base: s.baseCoin }; });
      }
      if (excId === 'bitget') {
        return (d.data || [])
          .filter(function(s){ return s.symbolStatus === 'normal' && s.quoteCoin === 'USDT'; })
          .map(function(s){ return { symbol: s.symbol, base: s.baseCoin }; });
      }
      if (excId === 'gateio') {
        return (d || [])
          .filter(function(s){ return s.name && s.name.indexOf('_USDT') !== -1 && !s.in_delisting; })
          .map(function(s){ var base = s.name.split('_')[0]; return { symbol: base + 'USDT', base: base }; });
      }
      if (excId === 'kucoin') {
        return (d.data || [])
          .filter(function(s){ return (s.status === 'Open' || s.isOpen) && s.quoteCurrency === 'USDT' && !s.isInverse; })
          .map(function(s){
            var base = _KUCOIN_BASE_MAP[s.baseCurrency] || s.baseCurrency;
            return { symbol: base + 'USDT', base: base };
          });
      }
      // mexc — additional exchange with futures support, best-effort parse
      if (excId === 'mexc') {
        return (d.data || [])
          .filter(function(s){ return s.state === 0 && /_USDT$/.test(s.symbol || ''); })
          .map(function(s){ var base = s.symbol.split('_')[0]; return { symbol: base + 'USDT', base: base }; });
      }
      // htx (formerly Huobi) — linear USDT-margined swaps
      if (excId === 'htx') {
        return (d.data || [])
          .filter(function(s){ return s.contract_status === 1 && s.trade_partition === 'USDT' && s.business_type === 'swap'; })
          .map(function(s){ return { symbol: s.symbol + 'USDT', base: s.symbol }; });
      }
      // bingx — USDT-M perpetual swaps
      if (excId === 'bingx') {
        return (d.data || [])
          .filter(function(s){ return (s.status === 1 || s.apiStateOpen === true) && /-USDT$/.test(s.symbol || ''); })
          .map(function(s){ var base = s.symbol.split('-')[0]; return { symbol: base + 'USDT', base: base }; });
      }
      // lbank — USDT-margined swaps (productGroup=SwapU already filters server-side), best-effort parse
      if (excId === 'lbank') {
        return (d || [])
          .filter(function(s){ return s.clearCurrency === 'USDT'; })
          .map(function(s){ return { symbol: s.symbol, base: s.baseCurrency }; });
      }
      // coinbase INTX — perpetuals from /market/products?product_type=FUTURE&contract_expiry_type=PERPETUAL
      // Response: { products: [ { product_id:'BTC-PERP-INTX', base_currency_id:'BTC', ... } ] }
      if (excId === 'coinbase') {
        return ((d && d.products) || [])
          .filter(function(s){ return s.product_id && s.product_id.indexOf('-PERP-INTX') !== -1; })
          .map(function(s){
            var base = (s.base_currency_id || s.product_id.split('-')[0]);
            return { symbol: base + 'USDT', base: base };
          });
      }
      // phemex — USDT-margined perpetuals live under perpProductsV2 (PerpetualV2 type)
      if (excId === 'phemex') {
        return ((d && d.data && d.data.perpProductsV2) || [])
          .filter(function(s){ return s.status !== 'Delisted' && s.quoteCurrency === 'USDT'; })
          .map(function(s){ var base = s.baseCurrency || s.contractUnderlyingAssets; return { symbol: base + 'USDT', base: base }; });
      }
      // bitmart — contract symbol is already canonical (e.g. BTCUSDT)
      if (excId === 'bitmart') {
        return ((d && d.data && d.data.symbols) || [])
          .filter(function(s){ return s.quote_currency === 'USDT' && s.status !== 'Delisted'; })
          .map(function(s){ return { symbol: s.symbol, base: s.base_currency }; });
      }
      // kraken futures — USD-quoted PF_ (perpetual futures) instruments; XBT->BTC like KuCoin
      if (excId === 'kraken') {
        return ((d && d.instruments) || [])
          .filter(function(s){ return s.tradeable && /^PF_/.test(s.symbol || '') && s.quote === 'USD'; })
          .map(function(s){ var base = (s.base === 'XBT') ? 'BTC' : s.base; return { symbol: base + 'USDT', base: base }; });
      }
    } catch(e) {}
    return [];
  }

  function _loadFutPairs(q) {
    var list = document.getElementById('fut-pair-list');
    if (!list) return;
    var cfg = __NX.getFutCfg();
    var excId = __NX.state.exchangeId || 'binance';
    if (!cfg) {
      list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-family:var(--font-mono);font-size:12px;">Futures not supported on this exchange</div>';
      return;
    }
    if (_futPairsCache[excId] && _futPairsCache[excId].length) {
      _renderFutPairs(_futPairsCache[excId], q);
      return;
    }
    list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-family:var(--font-mono);font-size:12px;">Loading…</div>';
    (window.fetchJsonWithFallback ? window.fetchJsonWithFallback(cfg.baseUrl + cfg.exchangeInfo) : fetch(cfg.baseUrl + cfg.exchangeInfo).then(function(r){ return r.json(); }))
      .then(function(d){
        var pairs = _parseFutPairs(excId, d).sort(function(a,b){ return a.base.localeCompare(b.base); });
        _futPairsCache[excId] = pairs;
        _renderFutPairs(pairs, q);
      })
      .catch(function(){
        list.innerHTML = '<div style="text-align:center;padding:20px;color:#ef4444;font-family:var(--font-mono);font-size:12px;">Failed to load pairs</div>';
      });
  }

  function _filterFutPairs(q) {
    var excId = __NX.state.exchangeId || 'binance';
    _renderFutPairs(_futPairsCache[excId] || [], q.toUpperCase());
  }

  function _renderFutPairs(pairs, q) {
    var list = document.getElementById('fut-pair-list');
    if (!list) return;
    var filtered = q ? pairs.filter(function(p){ return p.base.toUpperCase().includes(q) || p.symbol.toUpperCase().includes(q); }) : pairs;
    if (!filtered.length) {
      list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-family:var(--font-mono);font-size:12px;">No pairs found</div>';
      return;
    }
    list.innerHTML = filtered.map(function(p) {
      var active = p.symbol === __NX.state.symbol;
      return '<div onclick="FUT._selectFutPair(\'' + p.symbol + '\',\'' + p.base + '\')" style="display:flex;align-items:center;justify-content:space-between;padding:11px 10px;border-radius:10px;cursor:pointer;background:' + (active ? 'rgba(99,102,241,0.15)' : 'transparent') + ';-webkit-tap-highlight-color:transparent;">' +
        '<span style="font-size:14px;font-weight:700;font-family:var(--font-mono);color:' + (active ? 'rgba(99,102,241,0.9)' : 'var(--text-primary)') + ';">' + p.base + '/USDT</span>' +
        (active ? '<span class="material-icons-round" style="font-size:16px;color:rgba(99,102,241,0.9);">check</span>' : '') +
      '</div>';
    }).join('');
  }

  function _selectFutPair(symbol, base) {
    var sheet = document.getElementById('fut-pair-sheet');
    if (sheet) sheet.style.display = 'none';
    base = base || symbol.replace(/[-_]?USDT.*$/i, '');
    __NX.state.symbol = symbol;
    __NX.state.displaySym = base + '/USDT';
    // Restore leverage for this (exchange, symbol) pair
    var _lvKey2 = (__NX.state.exchangeId || '') + ':' + symbol;
    if (__NX.state._leverageCache[_lvKey2] != null) {
      __NX.state.leverage = __NX.state._leverageCache[_lvKey2];
    }
    var _lvEl2 = document.getElementById('fut-leverage-btn');
    if (_lvEl2) _lvEl2.setAttribute('data-lev', __NX.state.leverage);
    var _lvTxt2 = document.getElementById('fut-lev-text'); if (_lvTxt2) _lvTxt2.textContent = __NX.state.leverage + 'x';
    // Fetch max leverage (for slider) and current leverage from exchange
    __NX._fetchMaxLeverage();
    __NX._fetchLeverageFromExchange();
    try { localStorage.setItem('one_fut_pair_' + (__NX.state.exchangeId || 'binance'), symbol); } catch(e) {}
    var symEl = document.getElementById('fut-symbol');
    if (symEl) symEl.textContent = base + '/USDT';
    __NX.stopFeed();
    __NX.startFeed();
    if (typeof __NX.loadPositions === 'function') __NX.loadPositions();
    if (typeof __NX.loadOpenOrders === 'function') __NX.loadOpenOrders();
    if (typeof showToast === 'function') showToast('Switched to ' + base + '/USDT');
  }
})((window.__nxp = window.__nxp || {}).mod_fut_futures_engine = window.__nxp.mod_fut_futures_engine || {});
