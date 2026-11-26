// Trade minimums, logo map, market list rendering and preloading
// Part of the exchange spot engine (window.EXC) module (split by topic; no logic change).
(function (__NX) {
  __NX.getTradeMinimums = getTradeMinimums;
  __NX.fmtPrice = fmtPrice;
  __NX.filterAndRender = filterAndRender;
  __NX.loadMarkets = loadMarkets;
  __NX.preloadAllMarkets = preloadAllMarkets;


  // ── Per-exchange minimum order size / notional ──
  // Every exchange enforces its own minimum trade size (a min base-asset
  // quantity and/or a min order value in quote currency) — nothing in this
  // app fetched or checked that before, so an order below the minimum
  // would just get silently rejected by the exchange with a cryptic error.
  var _minTradeCache = {};

  // ── Official static fallback minimums (used when API fetch fails) ──
  // Sources: each exchange's official trading rules page (2025)
  var _STATIC_MIN = {
    binance:    { minQty: 0,       minNotional: 5,   stepSize: 0.00001  },  // binance: LOT_SIZE stepSize typical for major pairs
    mexc:       { minQty: 0,       minNotional: 1,   stepSize: 0.000001 },  // MEXC: 6 decimal precision common
    kucoin:     { minQty: 0,       minNotional: 0.1, stepSize: 0.000001 },  // KuCoin: baseIncrement typically 0.000001
    bybit:      { minQty: 0,       minNotional: 1,   stepSize: 0.000001 },  // Bybit: basePrecision 6 decimals common
    gateio:     { minQty: 0,       minNotional: 1,   stepSize: 0.0001   },  // Gate.io: amount_precision typically 4
    bitget:     { minQty: 0,       minNotional: 1,   stepSize: 0.0001   },  // Bitget: quantityPrecision 4 common
    bitmart:    { minQty: 0,       minNotional: 5,   stepSize: 0.000001 },  // BitMart: 6 decimal precision common
    bingx:      { minQty: 0,       minNotional: 1,   stepSize: 0.0001   },  // BingX: stepSize 4 decimals typical
    htx:        { minQty: 0,       minNotional: 1,   stepSize: 0.000001 },  // HTX (Huobi): amount-precision 6 common
    kraken:     { minQty: 0.0001,  minNotional: 1,   stepSize: 0.0001   },  // Kraken: ordermin BTC=0.0001, 4 dec typical
    phemex:     { minQty: 0,       minNotional: 1,   stepSize: 0.000001 },  // Phemex: 6 decimal precision common
    coinbase:   { minQty: 0,       minNotional: 1,   stepSize: 0.000001 },  // Coinbase: base_increment typically 0.000001
    digifinex:  { minQty: 0,       minNotional: 1,   stepSize: 0.0001   },  // Digifinex: 4 decimal conservative
    lbank:      { minQty: 0,       minNotional: 1,   stepSize: 0.0001   },  // LBank: 4 decimal conservative
    bitfinex:   { minQty: 0,       minNotional: 5,   stepSize: 0.000001 },  // Bitfinex: minimum_order_size 6 dec common
  };

  async function getTradeMinimums(exc, symbol) {
    var cacheKey = exc.id + '_' + symbol;
    if (_minTradeCache[cacheKey]) return _minTradeCache[cacheKey];

    // Start with official static fallback so we always have a safe floor
    var staticFallback = _STATIC_MIN[exc.id] || { minQty: 0, minNotional: 1, stepSize: 0.000001 };
    var result = { minQty: staticFallback.minQty, minNotional: staticFallback.minNotional, stepSize: staticFallback.stepSize };

    try {
      if (exc.id === 'binance' || exc.id === 'mexc') {
        var data = await __NX.fetchJsonWithFallback(exc.baseUrl + '/api/v3/exchangeInfo?symbol=' + symbol);
        var sym = (data.symbols || [])[0];
        (sym ? sym.filters || [] : []).forEach(function(f) {
          if (f.filterType === 'LOT_SIZE') {
            result.minQty = parseFloat(f.minQty) || 0;
            result.stepSize = parseFloat(f.stepSize) || 0;
          }
          if (f.filterType === 'MIN_NOTIONAL' || f.filterType === 'NOTIONAL') {
            result.minNotional = parseFloat(f.minNotional || f.minNotionalValue || 0) || 0;
          }
        });
      } else if (exc.id === 'kucoin') {
        var data = await __NX.fetchJsonWithFallback(exc.baseUrl + '/api/v2/symbols');
        var dashSym = __NX.toKucoinSymbol(symbol);
        var sym = (data.data || []).find(function(s) { return s.symbol === dashSym; });
        if (sym) {
          result.minQty = parseFloat(sym.baseMinSize) || 0;
          result.minNotional = parseFloat(sym.minFunds) || staticFallback.minNotional;
          result.stepSize = parseFloat(sym.baseIncrement) || 0;
        }
      } else if (exc.id === 'bybit') {
        var data = await __NX.fetchJsonWithFallback(exc.baseUrl + '/v5/market/instruments-info?category=spot&symbol=' + symbol);
        var sym = ((data.result||{}).list||[])[0];
        if (sym && sym.lotSizeFilter) {
          result.minQty = parseFloat(sym.lotSizeFilter.minOrderQty) || 0;
          result.minNotional = parseFloat(sym.lotSizeFilter.minOrderAmt) || staticFallback.minNotional;
          result.stepSize = parseFloat(sym.lotSizeFilter.basePrecision) || staticFallback.stepSize;
        }
      } else if (exc.id === 'gateio') {
        var gateSym = symbol.replace(/^([A-Z0-9]+)(USDT|BTC|ETH)$/, '$1_$2');
        var data = await __NX.fetchJsonWithFallback(exc.baseUrl + '/api/v4/spot/currency_pairs/' + gateSym);
        if (data) {
          result.minQty = parseFloat(data.min_base_amount) || 0;
          result.minNotional = parseFloat(data.min_quote_amount) || staticFallback.minNotional;
          // Gate.io amount_precision is decimal places, convert to stepSize
          var amtPrec = parseInt(data.amount_precision);
          result.stepSize = (!isNaN(amtPrec) && amtPrec >= 0) ? Math.pow(10, -amtPrec) : staticFallback.stepSize;
        }
      } else if (exc.id === 'bitget') {
        var data = await __NX.fetchJsonWithFallback(exc.baseUrl + '/api/v2/spot/public/symbols?symbol=' + symbol);
        var sym = ((data.data) || [])[0];
        if (sym) {
          result.minQty = parseFloat(sym.minTradeAmount) || 0;
          result.minNotional = parseFloat(sym.minTradeUSDT) || staticFallback.minNotional;
          // quantityPrecision is decimal places
          var qPrec = parseInt(sym.quantityPrecision);
          result.stepSize = (!isNaN(qPrec) && qPrec >= 0) ? Math.pow(10, -qPrec) : staticFallback.stepSize;
        }
      } else if (exc.id === 'bitmart') {
        var bmSym = symbol.replace(/^([A-Z0-9]+)(USDT|BTC|ETH)$/, '$1_$2');
        var data = await __NX.fetchJsonWithFallback(exc.baseUrl + '/spot/v1/symbols/details');
        var sym = ((data.data && data.data.symbols) || []).find(function(s){ return s.symbol === bmSym; });
        if (sym) {
          result.minQty = parseFloat(sym.min_buy_amount) || 0;
          result.minNotional = parseFloat(sym.min_buy_amount) || staticFallback.minNotional;
          // trade_step is the step size string e.g. "0.000001"
          result.stepSize = parseFloat(sym.trade_step) || staticFallback.stepSize;
        }
      } else if (exc.id === 'bingx') {
        var data = await __NX.fetchJsonWithFallback(exc.baseUrl + '/openApi/spot/v1/common/symbols?symbol=' + symbol);
        var sym = ((data.data && data.data.symbols) || [])[0];
        if (sym) {
          result.minQty = parseFloat(sym.minQty) || 0;
          result.minNotional = parseFloat(sym.minNotional) || staticFallback.minNotional;
          result.stepSize = parseFloat(sym.stepSize) || staticFallback.stepSize;
        }
      } else if (exc.id === 'htx') {
        var data = await __NX.fetchJsonWithFallback(exc.baseUrl + '/v1/settings/common/symbols');
        var sym = ((data.data) || []).find(function(s){ return s['sc'] === symbol.toLowerCase(); });
        var htxStepResolved = false;
        if (sym) {
          result.minQty = parseFloat(sym['minoa']) || 0;
          result.minNotional = parseFloat(sym['minov']) || staticFallback.minNotional;
          // New endpoint: 'tap' = trade amount precision (decimal places)
          // Also try 'ap' as alternate abbreviation in case 'tap' is missing
          var tapRaw = (sym['tap'] != null) ? sym['tap'] : sym['ap'];
          var tap = parseInt(tapRaw);
          if (!isNaN(tap) && tap >= 0) {
            result.stepSize = Math.pow(10, -tap);
            htxStepResolved = true;
          }
        }
        // Fallback: old /v1/common/symbols endpoint — 'amount-precision' field (confirmed in official docs)
        if (!htxStepResolved) {
          try {
            var oldData = await __NX.fetchJsonWithFallback(exc.baseUrl + '/v1/common/symbols');
            var oldSym = ((oldData.data) || []).find(function(s){ return s['symbol'] === symbol.toLowerCase(); });
            if (oldSym) {
              var amtPrec = parseInt(oldSym['amount-precision']);
              if (!isNaN(amtPrec) && amtPrec >= 0) {
                result.stepSize = Math.pow(10, -amtPrec);
                htxStepResolved = true;
              }
            }
          } catch(e2) { /* keep staticFallback */ }
        }
      } else if (exc.id === 'kraken') {
        var kSym = symbol.replace('BTC','XBT');
        var data = await __NX.fetchJsonWithFallback(exc.baseUrl + '/0/public/AssetPairs?pair=' + kSym);
        var pairs = data.result || {};
        var pairKey = Object.keys(pairs)[0];
        if (pairKey && pairs[pairKey]) {
          result.minQty = parseFloat(pairs[pairKey].ordermin) || staticFallback.minQty;
          result.minNotional = staticFallback.minNotional; // Kraken = ~1 USD equiv
          // lot_decimals = decimal places for lot size
          var lotDec = parseInt(pairs[pairKey].lot_decimals);
          result.stepSize = (!isNaN(lotDec) && lotDec >= 0) ? Math.pow(10, -lotDec) : staticFallback.stepSize;
        }
      } else if (exc.id === 'phemex') {
        var data = await __NX.fetchJsonWithFallback(exc.baseUrl + '/public/products');
        var sym = ((data.data && data.data.products) || []).find(function(s){ return s.symbol === symbol && s.type === 'Spot'; });
        if (sym) {
          result.minQty = parseFloat(sym.minOrderValue) || 0;
          result.minNotional = staticFallback.minNotional;
          // baseQtyPrecision = decimal places
          var bqp = parseInt(sym.baseQtyPrecision);
          result.stepSize = (!isNaN(bqp) && bqp >= 0) ? Math.pow(10, -bqp) : staticFallback.stepSize;
        }
      } else if (exc.id === 'coinbase') {
        // Public, unauthenticated — GET /products/{product_id} on the same
        // legacy Exchange API (api.exchange.coinbase.com) the rest of the
        // Coinbase integration uses.
        var cbDashSym = __NX.toDashSymbol(symbol);
        var data = await __NX.fetchJsonWithFallback(exc.baseUrl + '/products/' + cbDashSym);
        if (data && data.base_increment) {
          result.minQty = parseFloat(data.base_min_size) || 0;
          result.minNotional = parseFloat(data.min_market_funds) || staticFallback.minNotional;
          result.stepSize = parseFloat(data.base_increment) || staticFallback.stepSize;
        }
      }
      // For any exchange not listed above, staticFallback of 1 USDT applies
    } catch(e) {
      // API fetch failed — staticFallback already set as result, keep it
    }
    _minTradeCache[cacheKey] = result;
    return result;
  }

  // Shows the current pair's minimum order size/value under the Avbl/Max
  // row, and re-fetches whenever the pair or exchange changes.

  async function fetchLogoMap() {
    if (__NX.state.logoMap && Object.keys(__NX.state.logoMap).length > 50) return __NX.state.logoMap;
    var map = __NX.state.logoMap || {};
    try {
      for (var p = 1; p <= 2; p++) {
        var data = await (typeof _cgFetch === 'function'
          ? _cgFetch('coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=' + p + '&sparkline=false')
          : fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=' + p + '&sparkline=false').then(function(r){ return r.json(); }));
        if (!Array.isArray(data) || !data.length) break;
        data.forEach(function(c) {
          var sym = (c.symbol || '').toUpperCase();
          if (sym && !map[sym]) map[sym] = c.image;
        });
      }
    } catch(e) { console.error('[EXC] fetchLogoMap error:', e); }
    __NX.state.logoMap = map;
    return map;
  }

  // ── Render markets list ──
  function renderMarkets(list) {
    var el = document.getElementById('exc-markets-list');
    if (!el) return;
    if (!list || !list.length) {
      el.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 0;gap:10px;"><span style="font-size:13px;color:var(--text-muted);font-family:var(--font-mono);">No pairs found</span><span onclick="EXC.loadMarkets()" style="font-size:12px;color:var(--accent-primary);font-family:var(--font-mono);cursor:pointer;text-decoration:underline;">Retry</span></div>';
      return;
    }
    var html = '';
    var logos = __NX.state.logoMap || {};
    list.forEach(function(m) {
      var up = m.change >= 0;
      var chgColor = up ? '#22c55e' : '#ef4444';
      var baseSym = m.symbol.endsWith(__NX.state.activeQuote) ? m.symbol.slice(0, -__NX.state.activeQuote.length) : m.symbol;
      var logoUrl = logos[baseSym.toUpperCase()];
      html += '<div class="exc-mkt-row" onclick="EXC.selectPairFromMarket(\''+m.symbol+'\')">' +
        '<div style="flex:1;display:flex;align-items:center;gap:10px;">' +
          '<div style="width:32px;height:32px;border-radius:50%;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;position:relative;">' +
            '<span style="font-size:9px;font-weight:800;color:var(--accent-primary);font-family:var(--font-mono);">'+baseSym.slice(0,3)+'</span>' +
            (logoUrl ? '<img src="'+logoUrl+'" alt="" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.remove()" />' : '') +
          '</div>' +
          '<div>' +
            '<div style="font-size:13px;font-weight:700;color:var(--text-primary);font-family:var(--font-mono);">'+baseSym+'</div>' +
            '<div style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);">/'+__NX.state.activeQuote+'</div>' +
          '</div>' +
        '</div>' +
        '<div style="width:90px;text-align:right;">' +
          '<div style="font-size:13px;font-weight:700;color:var(--text-primary);font-family:var(--font-mono);">'+fmtPrice(m.price)+'</div>' +
        '</div>' +
        '<div style="width:72px;text-align:right;">' +
          '<div style="font-size:12px;font-weight:700;color:'+chgColor+';font-family:var(--font-mono);">'+(up?'+':'')+m.change.toFixed(2)+'%</div>' +
        '</div>' +
      '</div>';
    });
    el.innerHTML = html;
  }

  function fmtPrice(p) {
    if (!p || isNaN(p)) return '—';
    if (p >= 1000) return p.toLocaleString(undefined, {maximumFractionDigits:2});
    if (p >= 1) return p.toFixed(4);
    if (p >= 0.001) return p.toFixed(6);
    return p.toFixed(8);
  }

  // ── Filter / sort markets ──
  var _topTokens = ['BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT','DOGEUSDT','ADAUSDT','TRXUSDT','AVAXUSDT','DOTUSDT'];
  function filterAndRender() {
    var q = (document.getElementById('exc-mkt-search')||{}).value || '';
    q = q.toUpperCase().trim();
    var list = __NX.state.markets.filter(function(m) {
      return m.symbol.endsWith(__NX.state.activeQuote) && (!q || m.symbol.includes(q));
    });
    // Sort
    list.sort(function(a,b) { return (b[__NX.state.sortCol] - a[__NX.state.sortCol]) * __NX.state.sortDir; });
    // Pin top tokens at top (only when no search query)
    if (!q) {
      var pinned = [], rest = [];
      list.forEach(function(m) {
        if (_topTokens.indexOf(m.symbol) !== -1) pinned.push(m);
        else rest.push(m);
      });
      pinned.sort(function(a,b) { return _topTokens.indexOf(a.symbol) - _topTokens.indexOf(b.symbol); });
      list = pinned.concat(rest);
    }
    __NX.state.marketsFiltered = list;
    renderMarkets(list);
  }

  // ── Load markets ──
  async function loadMarkets() {
    var exc = __NX.activeExc();

    // Instant path: this exchange was already preloaded on app start (or a
    // previous visit), so show it immediately with no spinner/network wait,
    // then quietly refresh in the background to keep prices current.
    if (__NX._marketsCache[exc.id]) {
      __NX.state.markets = __NX._marketsCache[exc.id];
      filterAndRender();
      __NX.updateTradePairPrice();
      fetchLogoMap();
      __NX.fetchMarkets(exc).then(function(list) {
        __NX._marketsCache[exc.id] = list;
        if (__NX.state.activeExchange === exc.id) {
          __NX.state.markets = list;
          filterAndRender();
          __NX.updateTradePairPrice();
        }
      });
      return;
    }

    // Fallback path: not preloaded yet (e.g. preload is still in flight) —
    // show a spinner and wait on the network like before.
    var el = document.getElementById('exc-markets-list');
    if (el) el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;padding:40px 0;gap:10px;"><div class="exc-spinner"></div><span style="font-size:13px;color:var(--text-muted);font-family:var(--font-mono);">Loading markets…</span></div>';
    var results = await Promise.all([__NX.fetchMarkets(exc), fetchLogoMap()]);
    __NX.state.markets = results[0];
    __NX._marketsCache[exc.id] = __NX.state.markets;
    filterAndRender();
    __NX.updateTradePairPrice();
  }

  // ── Preload every exchange's market list up front ──
  // Called as soon as the app loads (see bottom of this script), so all four
  // exchanges are sitting in _marketsCache before the user ever opens the
  // exchange tab or switches exchanges — no waiting, no spinner.
  async function preloadAllMarkets() {
    if (__NX._marketsPreloaded) return;
    __NX._marketsPreloaded = true;
    // Skip the currently-active exchange — selectExchange()/loadMarkets()
    // already fetched its market list before this runs, so fetching it
    // again here would just be a duplicate network hit. If it's somehow
    // not in cache yet (edge case), still fetch it as a safety net.
    var activeId = __NX.state.activeExchange;
    var toPreload = __NX.EXCHANGES.filter(function(exc) {
      return exc.id !== activeId || !__NX._marketsCache[activeId];
    });
    // Batch in small groups instead of all 17 at once — firing every
    // exchange's ticker fetch (each of which may itself fan out to several
    // CORS-proxy attempts) simultaneously was overloading the shared free
    // proxies, so the exchanges later in the list were the most likely to
    // get rate-limited and silently come back empty.
    var batchSize = 4;
    for (var i = 0; i < toPreload.length; i += batchSize) {
      var batch = toPreload.slice(i, i + batchSize);
      await Promise.all(batch.map(function(exc) {
        return __NX.fetchMarkets(exc).then(function(list) {
          __NX._marketsCache[exc.id] = list || [];
        }).catch(function(e) {
          console.error('[EXC] preload failed for', exc.id, e);
          __NX._marketsCache[exc.id] = __NX._marketsCache[exc.id] || [];
        });
      }));
      // If the exchange tab is already open, render whatever's ready so far
      // instead of waiting for every batch to finish.
      if (__NX.state.activeTab === 'markets' && __NX._marketsCache[__NX.state.activeExchange] && !__NX.state.markets.length) {
        __NX.state.markets = __NX._marketsCache[__NX.state.activeExchange];
        filterAndRender();
        __NX.updateTradePairPrice();
      }
    }
  }
})((window.__nxp = window.__nxp || {}).mod_exc_spot_engine = window.__nxp.mod_exc_spot_engine || {});
