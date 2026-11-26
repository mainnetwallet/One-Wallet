// fetchMarkets: ticker/market loading for every exchange
// Part of the exchange spot engine (window.EXC) module (split by topic; no logic change).
(function (__NX) {
  __NX.fetchMarkets = fetchMarkets;

  // ── Public market data (no auth) ──
  async function fetchMarkets(excOverride) {
    var exc = excOverride || __NX.activeExc();
    try {
      if (exc.id === 'binance' || exc.id === 'mexc') {
        var data = await __NX.oneDataFetch(exc.baseUrl + exc.endpoints.ticker, undefined, 'binance');
        if (!Array.isArray(data)) {
          console.error('[EXC] fetchMarkets: unexpected non-array response for', exc.id, data);
          return [];
        }
        return data.map(function(t) {
          return {
            symbol: t.symbol,
            price: parseFloat(t.lastPrice),
            change: parseFloat(t.priceChangePercent),
            volume: parseFloat(t.quoteVolume),
            high: parseFloat(t.highPrice),
            low: parseFloat(t.lowPrice),
          };
        });
      }
      if (exc.id === 'kucoin') {
        var data = await __NX.oneDataFetch(exc.baseUrl + '/api/v1/market/allTickers', undefined, 'kucoin');
        return (data.data && data.data.ticker || []).map(function(t) {
          return {
            symbol: t.symbol.replace('-',''),
            price: parseFloat(t.last),
            change: parseFloat(t.changeRate) * 100,
            volume: parseFloat(t.volValue),
            high: parseFloat(t.high),
            low: parseFloat(t.low),
          };
        });
      }
      if (exc.id === 'bybit') {
        var data = await __NX.oneDataFetch(exc.baseUrl + '/v5/market/tickers?category=spot', undefined, 'bybit');
        return (data.result && data.result.list || []).map(function(t) {
          return {
            symbol: t.symbol,
            price: parseFloat(t.lastPrice),
            change: parseFloat(t.price24hPcnt) * 100,
            volume: parseFloat(t.turnover24h),
            high: parseFloat(t.highPrice24h),
            low: parseFloat(t.lowPrice24h),
          };
        });
      }
      if (exc.id === 'bitmart') {
        // BitMart v3 tickers: each row is a positional ARRAY, not an object —
        // [symbol, last, v_24h, qv_24h, open_24h, high_24h, low_24h, fluctuation,
        //  bid_px, bid_sz, ask_px, ask_sz, ts]. Reading t.symbol/t.last (object
        // access) on an array silently returns undefined for every field, which
        // collapsed every row to symbol:'' — the empty "/" pair, NaN%, and the
        // empty Amount() unit all traced back to this.
        var data = await __NX.oneDataFetch(exc.baseUrl + '/spot/quotation/v3/tickers', undefined, 'bitmart');
        return ((data.data)||[]).map(function(t) {
          return {
            symbol: __NX.fromUnderscoreSymbol(t[0]),
            price: parseFloat(t[1]),
            change: parseFloat(t[7]) * 100,
            volume: parseFloat(t[3]),
            high: parseFloat(t[5]),
            low: parseFloat(t[6]),
          };
        });
      }
      if (exc.id === 'bitget') {
        var data = await __NX.oneDataFetch(exc.baseUrl + '/api/v2/spot/market/tickers', undefined, 'bitget');
        return ((data.data)||[]).map(function(t) {
          return {
            symbol: t.symbol,
            price: parseFloat(t.lastPr),
            change: parseFloat(t.change24h) * 100,
            volume: parseFloat(t.quoteVolume),
            high: parseFloat(t.high24h),
            low: parseFloat(t.low24h),
          };
        });
      }
      if (exc.id === 'kraken') {
        if (!__NX._krakenPairCache.length) {
          var ap = await __NX.oneDataFetch(exc.baseUrl + '/0/public/AssetPairs', undefined, 'kraken');
          __NX._krakenPairCache = Object.keys(ap.result||{}).map(function(k) { return {key:k, altname:(ap.result[k].altname||'')}; });
        }
        var data = await __NX.oneDataFetch(exc.baseUrl + '/0/public/Ticker', undefined, 'kraken');
        var rows = [];
        __NX._krakenPairCache.forEach(function(p) {
          if (!/USDT$/.test(p.altname)) return;
          var t = (data.result||{})[p.key];
          if (!t) return;
          var sym = p.altname.replace(/^XBT/, 'BTC');
          var lastP = parseFloat((t.c||[])[0]) || 0;
          var openP = parseFloat(t.o) || 0;
          rows.push({
            symbol: sym,
            price: lastP,
            change: openP ? ((lastP - openP) / openP * 100) : 0,
            volume: (parseFloat((t.v||[])[1] || (t.v||[])[0] || 0)) * lastP,
            high: parseFloat((t.h||[])[1] || (t.h||[])[0] || 0),
            low: parseFloat((t.l||[])[1] || (t.l||[])[0] || 0),
          });
        });
        return rows;
      }
      if (exc.id === 'gateio') {
        var data = await __NX.oneDataFetch(exc.baseUrl + '/api/v4/spot/tickers', undefined, 'gateio');
        if (!Array.isArray(data)) {
          console.error('[EXC] fetchMarkets: unexpected non-array response for', exc.id, data);
          return [];
        }
        return data.map(function(t) {
          return {
            symbol: __NX.fromUnderscoreSymbol(t.currency_pair),
            price: parseFloat(t.last),
            change: parseFloat(t.change_percentage),
            volume: parseFloat(t.quote_volume),
            high: parseFloat(t.high_24h),
            low: parseFloat(t.low_24h),
          };
        });
      }
      if (exc.id === 'coinbase') {
        // Coinbase Exchange is overwhelmingly USD/USDC-quoted — USDT pairs
        // are rare-to-nonexistent (USDT support is limited to ERC-20 only,
        // per Coinbase's own help docs), so filtering for "-USDT$" returned
        // an almost-empty market list and effectively broke pair selection.
        // USDC is what this app's _QUOTE_ASSETS/splitSymbol already handle.
        var data = await __NX.oneDataFetch('https://api.coinbase.com/api/v3/brokerage/market/products', undefined, 'coinbase');
        return ((data.products)||[]).filter(function(p) { return /-USDC$/.test(p.product_id); }).map(function(t) {
          var price = parseFloat(t.price) || 0;
          return {
            symbol: __NX.fromDashSymbol(t.product_id),
            price: price,
            change: parseFloat(t.price_percentage_change_24h) || 0,
            volume: (parseFloat(t.volume_24h) || 0) * price,
            high: price,
            low: price,
          };
        });
      }
      if (exc.id === 'bingx') {
        var data = await __NX.oneDataFetch(exc.baseUrl + '/openApi/spot/v1/ticker/24hr', undefined, 'bingx');
        return ((data.data)||[]).map(function(t) {
          return {
            symbol: __NX.fromDashSymbol(t.symbol),
            price: parseFloat(t.lastPrice),
            change: parseFloat(String(t.priceChangePercent).replace('%','')),
            volume: parseFloat(t.quoteVolume),
            high: parseFloat(t.highPrice),
            low: parseFloat(t.lowPrice),
          };
        });
      }
      if (exc.id === 'htx') {
        var data = await __NX.oneDataFetch(exc.baseUrl + '/market/tickers', undefined, 'htx');
        return ((data.data)||[]).filter(function(t) { return /usdt$/.test(t.symbol); }).map(function(t) {
          var openP = parseFloat(t.open) || 0;
          var lastP = parseFloat(t.close) || 0;
          return {
            symbol: t.symbol.toUpperCase(),
            price: lastP,
            change: openP ? ((lastP - openP) / openP * 100) : 0,
            volume: parseFloat(t.vol),
            high: parseFloat(t.high),
            low: parseFloat(t.low),
          };
        });
      }

      if (exc.id === 'phemex') {
        var data = await __NX.oneDataFetch(exc.baseUrl + '/md/spot/ticker/24hr/all', undefined, 'phemex');
        return ((data.result)||[]).filter(function(t) { return /USDT$/.test(t.symbol||''); }).map(function(t) {
          var price = (parseFloat(t.lastEp) || 0) / __NX.PHEMEX_SCALE;
          var openP = (parseFloat(t.openEp) || 0) / __NX.PHEMEX_SCALE;
          return {
            symbol: (t.symbol||'').replace(/^s/,''),
            price: price,
            change: openP ? ((price - openP) / openP * 100) : 0,
            volume: (parseFloat(t.turnoverEv) || 0) / __NX.PHEMEX_SCALE,
            high: (parseFloat(t.highEp) || 0) / __NX.PHEMEX_SCALE,
            low: (parseFloat(t.lowEp) || 0) / __NX.PHEMEX_SCALE,
          };
        });
      }
      if (exc.id === 'digifinex') {
        var data = await __NX.oneDataFetch(exc.baseUrl + '/v3/ticker', undefined, 'digifinex');
        return ((data.ticker)||[]).map(function(t) {
          return {
            symbol: __NX.fromUnderscoreSymbol(t.symbol),
            price: parseFloat(t.last),
            change: parseFloat(t.change),
            volume: parseFloat(t.vol),
            high: parseFloat(t.high),
            low: parseFloat(t.low),
          };
        });
      }
      if (exc.id === 'lbank') {
        var data = await __NX.oneDataFetch('https://www.lbkex.net/v2/ticker/24hr.do', undefined, 'lbank');
        return ((data.data)||[]).map(function(t) {
          var tk = t.ticker || {};
          return {
            symbol: __NX.fromUnderscoreSymbol(t.symbol),
            price: parseFloat(tk.latest),
            change: parseFloat(tk.change),
            volume: parseFloat(tk.turnover),
            high: parseFloat(tk.high),
            low: parseFloat(tk.low),
          };
        });
      }
      if (exc.id === 'bitfinex') {
        var data = await __NX.oneDataFetch(exc.baseUrl + '/v2/tickers?symbols=ALL', undefined, 'bitfinex');
        if (!Array.isArray(data)) {
          console.error('[EXC] fetchMarkets: unexpected non-array response for', exc.id, data);
          return [];
        }
        return data.filter(function(row) { return /^t.*UST$/.test(row[0]); }).map(function(row) {
          var price = row[7] || 0;
          return {
            symbol: row[0].slice(1).replace(/UST$/, 'USDT'),
            price: price,
            change: (row[6] || 0) * 100,
            volume: (row[8] || 0) * price,
            high: row[9] || 0,
            low: row[10] || 0,
          };
        });
      }
    } catch(e) {
      console.error('[EXC] fetchMarkets error:', e);
      return [];
    }
  }
})((window.__nxp = window.__nxp || {}).mod_exc_spot_engine = window.__nxp.mod_exc_spot_engine || {});
