// Futures: remaining exchange feeds, ticker parsing, order book render and funding
// Part of the futures engine (FUT) module (split by topic; no logic change).
(function (__NX) {
  __NX._startPhemexFeed = _startPhemexFeed;
  __NX._startBitmartFeed = _startBitmartFeed;
  __NX._startKrakenFeed = _startKrakenFeed;
  __NX._startDigifinexFeed = _startDigifinexFeed;
  __NX._startLbankFeed = _startLbankFeed;
  __NX._startBitfinexFeed = _startBitfinexFeed;
  __NX._startCoinbaseFeed = _startCoinbaseFeed;
  __NX._startBybitFeed = _startBybitFeed;
  __NX.stopFeed = stopFeed;
  __NX.renderBook = renderBook;
  __NX.fetchFunding = fetchFunding;
  __NX.setTick = setTick;
  __NX.setObView = setObView;


  // ── Phemex: wss://ws.phemex.com — orderbook.subscribe (scaled integer prices, /1e8) ──
  function _startPhemexFeed(cfg) {
    var exSym = __NX.toExSym(__NX.state.symbol, cfg);
    var ws = _obWsConnect('wss://ws.phemex.com');
    __NX.state._ws = ws;
    // USDT-margined "Hedged" perpetuals (symbol like BTCUSDT) live on the
    // orderbook_p channel, not the legacy orderbook channel (which is for
    // old inverse contracts like BTCUSD and uses Ep-scaled integer prices).
    // Subscribing BTCUSDT to "orderbook.subscribe" never errors — it just
    // never matches anything, so no book data ever arrives. orderbook_p
    // also returns real unscaled prices (priceRp), so the /1e8 scaling
    // here was wrong for this symbol family. Updates are incremental
    // (qty:0 means remove that price level), so merge into a local book
    // rather than replacing it wholesale on every message.
    __NX.state._phemexBook = { a:{}, b:{} };
    ws.onerror = function(ev) { console.error('[FUT-OB] phemex ws error', ev); };
    ws.onopen = function() {
      try { ws.send(JSON.stringify({id:1, method:'orderbook_p.subscribe', params:[exSym]})); } catch(e){}
      __NX.state._phemexPing = setInterval(function(){ try{ ws.send(JSON.stringify({id:2, method:'server.ping', params:[]})); }catch(e){} }, 15000);
    };
    ws.onclose = function(ev) { console.error('[FUT-OB] phemex ws closed', ev.code, ev.reason); if (__NX.state._phemexPing) { clearInterval(__NX.state._phemexPing); __NX.state._phemexPing=null; } };
    ws.onmessage = function(ev) {
      try {
        var d = JSON.parse(ev.data);
        if (d.error) { console.error('[FUT-OB] phemex subscribe error', d.error); return; }
        var book = d.orderbook_p;
        if (!book) return;
        if (d.type === 'snapshot') __NX.state._phemexBook = { a:{}, b:{} };
        (book.asks||[]).forEach(function(r){ if (parseFloat(r[1])>0) __NX.state._phemexBook.a[r[0]]=r[1]; else delete __NX.state._phemexBook.a[r[0]]; });
        (book.bids||[]).forEach(function(r){ if (parseFloat(r[1])>0) __NX.state._phemexBook.b[r[0]]=r[1]; else delete __NX.state._phemexBook.b[r[0]]; });
        var b = __NX._mkBook(Object.entries(__NX.state._phemexBook.a), Object.entries(__NX.state._phemexBook.b));
        __NX.state._lastDepth = b;
        requestAnimationFrame(function(){ renderBook(b); });
      } catch(e){}
    };
  }

  // ── BitMart Futures v2: wss://openapi-ws-v2.bitmart.com/api?protocol=1.1 — futures/depth20 ──
  function _startBitmartFeed(cfg) {
    var exSym = __NX.toExSym(__NX.state.symbol, cfg);
    var ws = _obWsConnect('wss://openapi-ws-v2.bitmart.com/api?protocol=1.1');
    __NX.state._ws = ws;
    // BitMart's futures/depth20 push is NOT {asks:[],bids:[]} like the spot
    // book — it's a flat "depths" array of {price,vol} rows tagged with a
    // single "way" for the whole message (1=ask side, 2=bid side), sent as
    // two separate messages. Reading d.data.asks/d.data.bids (object keys
    // that don't exist on this shape) was always undefined, so the book
    // never painted. Maintain a local per-side book and merge each push.
    __NX.state._bitmartBook = { a:{}, b:{} };
    ws.onerror = function(ev) { console.error('[FUT-OB] bitmart ws error', ev); };
    ws.onopen = function() {
      try { ws.send(JSON.stringify({action:'subscribe', args:['futures/depth20:'+exSym]})); } catch(e){}
      __NX.state._bitmartPing = setInterval(function(){ try{ ws.send('ping'); }catch(e){} }, 15000);
    };
    ws.onclose = function(ev) { console.error('[FUT-OB] bitmart ws closed', ev.code, ev.reason); if (__NX.state._bitmartPing) { clearInterval(__NX.state._bitmartPing); __NX.state._bitmartPing=null; } };
    ws.onmessage = function(ev) {
      try {
        if (ev.data === 'pong') return;
        var d = JSON.parse(ev.data);
        if (d.errorCode) { console.error('[FUT-OB] bitmart subscribe error', d); return; }
        if (!d.data || !/futures\/depth/.test(d.group||'')) return;
        var side = (d.data.way === 2) ? __NX.state._bitmartBook.b : __NX.state._bitmartBook.a;
        // Each push is a full snapshot for its side — replace that side wholesale.
        var fresh = {};
        (d.data.depths||[]).forEach(function(r){ fresh[r.price] = r.vol; });
        if (d.data.way === 2) __NX.state._bitmartBook.b = fresh; else __NX.state._bitmartBook.a = fresh;
        var book = __NX._mkBook(Object.entries(__NX.state._bitmartBook.a), Object.entries(__NX.state._bitmartBook.b));
        __NX.state._lastDepth = book;
        requestAnimationFrame(function(){ renderBook(book); });
      } catch(e){}
    };
  }

  // ── Kraken Futures: wss://futures.kraken.com/ws/v1 — book feed (snapshot then deltas) ──
  function _startKrakenFeed(cfg) {
    var exSym = __NX.toExSym(__NX.state.symbol, cfg);
    __NX.state._krakenBook = { a:{}, b:{} };
    var ws = _obWsConnect('wss://futures.kraken.com/ws/v1');
    __NX.state._ws = ws;
    ws.onopen = function() {
      try { ws.send(JSON.stringify({event:'subscribe', feed:'book', product_ids:[exSym]})); } catch(e){}
    };
    ws.onmessage = function(ev) {
      try {
        var d = JSON.parse(ev.data);
        if (d.feed !== 'book_snapshot' && d.feed !== 'book') return;
        if (d.feed === 'book_snapshot') {
          __NX.state._krakenBook = {a:{},b:{}};
          (d.asks||[]).forEach(function(r){ __NX.state._krakenBook.a[r.price]=r.qty; });
          (d.bids||[]).forEach(function(r){ __NX.state._krakenBook.b[r.price]=r.qty; });
        } else if (d.side) {
          var map = d.side === 'sell' ? __NX.state._krakenBook.a : __NX.state._krakenBook.b;
          if (parseFloat(d.qty) <= 0) delete map[d.price]; else map[d.price] = d.qty;
        }
        var book = __NX._mkBook(Object.entries(__NX.state._krakenBook.a), Object.entries(__NX.state._krakenBook.b));
        __NX.state._lastDepth = book;
        requestAnimationFrame(function(){ renderBook(book); });
      } catch(e){}
    };
  }

  // ── DigiFinex Swap: wss://openapi.digifinex.com/swap_ws/v2/ — depth.subscribe, zlib-deflate compressed ──
  function _startDigifinexFeed(cfg) {
    var exSym = __NX.toExSym(__NX.state.symbol, cfg);
    var ws = _obWsConnect('wss://openapi.digifinex.com/swap_ws/v2/');
    ws.binaryType = 'arraybuffer';
    __NX.state._ws = ws;
    ws.onerror = function(ev) { console.error('[FUT-OB] digifinex ws error', ev); };
    ws.onopen = function() {
      try { ws.send(JSON.stringify({event:'depth.subscribe', id:1, instrument_id:exSym, level:20})); } catch(e){}
      __NX.state._digifinexPing = setInterval(function(){ try{ ws.send(JSON.stringify({event:'server.ping', id:2})); }catch(e){} }, 25000);
    };
    ws.onclose = function(ev) { console.error('[FUT-OB] digifinex ws closed', ev.code, ev.reason); if (__NX.state._digifinexPing) { clearInterval(__NX.state._digifinexPing); __NX.state._digifinexPing=null; } };
    ws.onmessage = function(ev) {
      _inflateJson(ev.data).then(function(d) {
        if (!d) return;
        if (d.code && d.code !== 1) { console.error('[FUT-OB] digifinex subscribe error', d); return; }
        if (d.event !== 'depth.update' || !d.data) return;
        var book = __NX._mkBook(d.data.asks||[], d.data.bids||[]);
        __NX.state._lastDepth = book;
        requestAnimationFrame(function(){ renderBook(book); });
      }).catch(function(){});
    };
  }

  // ── Deflate decompress helper for binary WS frames (DigiFinex) using native browser DecompressionStream ──
  function _inflateJson(data) {
    try {
      var buf = (data instanceof ArrayBuffer) ? data : null;
      if (!buf) return Promise.resolve(null);
      if (typeof DecompressionStream === 'undefined') return Promise.resolve(null);
      var ds = new DecompressionStream('deflate');
      var stream = new Blob([buf]).stream().pipeThrough(ds);
      return new Response(stream).text().then(function(txt){ try { return JSON.parse(txt); } catch(e){ return null; } });
    } catch(e) { return Promise.resolve(null); }
  }

  // ── LBank Futures: wss://lbkperpws.lbank.com/ws — best-effort public depth subscribe ──
  // LBank's contract (futures) API documentation (lbank.com/docs/contract.html)
  // only specifies REST endpoints — there is no published WebSocket schema
  // for order book/ticker/funding (unlike every other exchange here, which
  // all have a documented WS push format). wss://lbkperpws.lbank.com/ws is
  // reachable but its message shape was guessed and never confirmed, which
  // is why the book stayed empty with no decodable error. Falling back to
  // the verified REST endpoint and polling it on an interval instead.
  function _startLbankFeed(cfg) {
    function poll() {
      var exSym = __NX.toExSym(__NX.state.symbol, cfg);
      (window.fetchJsonWithFallback ? window.fetchJsonWithFallback(cfg.baseUrl + cfg.depth(exSym), 10000) : fetch(cfg.baseUrl + cfg.depth(exSym)).then(function(r){ return r.json(); }))
        .then(function(d) {
          if (__NX.state.exchangeId !== 'lbank') return; // stale response after exchange switch
          if (d && d.error_code) { console.error('[FUT-OB] lbank depth error', d); return; }
          var book = (d && d.data) || d || {};
          var asksRaw = (book.asks||[]).map(function(r){ return [r.price, r.volume]; });
          var bidsRaw = (book.bids||[]).map(function(r){ return [r.price, r.volume]; });
          if (!asksRaw.length && !bidsRaw.length) { console.error('[FUT-OB] lbank unrecognized depth response', d); return; }
          var parsed = __NX._mkBook(asksRaw, bidsRaw);
          __NX.state._lastDepth = parsed;
          requestAnimationFrame(function(){ renderBook(parsed); });
        })
        .catch(function(e){ console.error('[FUT-OB] lbank depth fetch failed', e); });
    }
    poll();
    if (__NX.state._lbankDepthTimer) clearInterval(__NX.state._lbankDepthTimer);
    __NX.state._lbankDepthTimer = setInterval(poll, 2000);
    _startRestTickerPoll(cfg);
  }

  // ── Bitfinex: wss://api-pub.bitfinex.com/ws/2 — derivatives book channel (tBTCF0:USTF0 style symbols) ──
  function _startBitfinexFeed(cfg) {
    var exSym = __NX.toExSym(__NX.state.symbol, cfg);
    __NX.state._bitfinexBook = { a:{}, b:{} };
    __NX.state._bitfinexChanId = null;
    var ws = _obWsConnect('wss://api-pub.bitfinex.com/ws/2');
    __NX.state._ws = ws;
    ws.onopen = function() {
      try { ws.send(JSON.stringify({event:'subscribe', channel:'book', symbol:exSym, prec:'P0', len:'25'})); } catch(e){}
    };
    ws.onmessage = function(ev) {
      try {
        var d = JSON.parse(ev.data);
        if (!Array.isArray(d)) {
          if (d.event === 'subscribed' && d.channel === 'book') __NX.state._bitfinexChanId = d.chanId;
          return;
        }
        if (d[0] !== __NX.state._bitfinexChanId) return;
        var payload = d[1];
        if (payload === 'hb') return; // heartbeat
        var rows = (Array.isArray(payload[0])) ? payload : [payload]; // single update vs snapshot array
        rows.forEach(function(r) {
          if (!Array.isArray(r) || r.length < 3) return;
          var price = r[0], count = r[1], amount = parseFloat(r[2]);
          if (count === 0) {
            if (amount === 1) delete __NX.state._bitfinexBook.b[price]; else delete __NX.state._bitfinexBook.a[price];
          } else if (amount > 0) {
            __NX.state._bitfinexBook.b[price] = amount;
          } else {
            __NX.state._bitfinexBook.a[price] = Math.abs(amount);
          }
        });
        var book = __NX._mkBook(Object.entries(__NX.state._bitfinexBook.a), Object.entries(__NX.state._bitfinexBook.b));
        __NX.state._lastDepth = book;
        requestAnimationFrame(function(){ renderBook(book); });
      } catch(e){}
    };
  }


  // ── Coinbase Advanced Trade WebSocket — wss://advanced-trade-ws.coinbase.com
  // Authenticated via CDP JWT in the subscribe message (channel: "level2" for
  // order book, "ticker" for price/24h change). Auth is required even for
  // market data on the Advanced Trade WS (unlike most exchanges).
  // Docs: https://docs.cdp.coinbase.com/advanced-trade/docs/ws-overview
  function _startCoinbaseFeed(cfg) {
    var keys = __NX.getApiKeys();
    if (!keys || !keys.cdpKeyName || !keys.cdpPem) {
      // No CDP key — cannot connect; leave order book empty
      return;
    }
    var exSym = __NX.toExSym(__NX.state.symbol, cfg);
    __NX.state._cbBook = { a: {}, b: {} };

    var ws = window._obWsConnect('wss://advanced-trade-ws.coinbase.com');
    __NX.state._ws = ws;

    ws.onopen = function() {
      // Build JWT for WS — uri claim uses GET wss host per CDP docs
      __NX._coinbaseBuildJwt(keys, 'GET', 'advanced-trade-ws.coinbase.com', '').then(function(jwt) {
        // Subscribe to level2 (order book) + ticker channels
        var subLevel2 = JSON.stringify({
          type: 'subscribe',
          product_ids: [exSym],
          channel: 'level2',
          jwt: jwt,
        });
        var subTicker = JSON.stringify({
          type: 'subscribe',
          product_ids: [exSym],
          channel: 'ticker',
          jwt: jwt,
        });
        try { ws.send(subLevel2); } catch(e) {}
        try { ws.send(subTicker); } catch(e) {}
      }).catch(function() {});

      // Heartbeat every 30s to keep connection alive
      __NX.state._cbPing = setInterval(function() {
        __NX._coinbaseBuildJwt(keys, 'GET', 'advanced-trade-ws.coinbase.com', '').then(function(jwt) {
          try { ws.send(JSON.stringify({ type: 'subscribe', channel: 'heartbeats', jwt: jwt })); } catch(e) {}
        }).catch(function() {});
      }, 30000);
    };

    ws.onclose = function() {
      if (__NX.state._cbPing) { clearInterval(__NX.state._cbPing); __NX.state._cbPing = null; }
    };

    ws.onmessage = function(ev) {
      try {
        var d = JSON.parse(ev.data);
        if (!d || !d.channel || !d.events) return;

        // ── level2 channel: order book snapshot + updates ──
        if (d.channel === 'level2') {
          d.events.forEach(function(evt) {
            if (evt.type === 'snapshot') {
              // Full snapshot — reset local book
              __NX.state._cbBook = { a: {}, b: {} };
              (evt.updates || []).forEach(function(u) {
                var side = u.side === 'offer' ? 'a' : 'b';
                var qty = parseFloat(u.new_quantity);
                if (qty <= 0) delete __NX.state._cbBook[side][u.price_level];
                else __NX.state._cbBook[side][u.price_level] = u.new_quantity;
              });
            } else if (evt.type === 'update') {
              // Incremental update
              (evt.updates || []).forEach(function(u) {
                var side = u.side === 'offer' ? 'a' : 'b';
                var qty = parseFloat(u.new_quantity);
                if (qty <= 0) delete __NX.state._cbBook[side][u.price_level];
                else __NX.state._cbBook[side][u.price_level] = u.new_quantity;
              });
            }
            var book = __NX._mkBook(Object.entries(__NX.state._cbBook.a), Object.entries(__NX.state._cbBook.b));
            __NX.state._lastDepth = book;
            requestAnimationFrame(function() { renderBook(book); });
          });
        }

        // ── ticker channel: last price + 24h change ──
        if (d.channel === 'ticker') {
          d.events.forEach(function(evt) {
            (evt.tickers || []).forEach(function(t) {
              var last = parseFloat(t.price || 0);
              var chg = parseFloat(t.price_percent_chg_24h || 0);
              if (!last) return;
              __NX.state.lastPrice = last;
              var priceEl = document.getElementById('fut-price');
              if (priceEl && !priceEl.value) priceEl.value = last.toFixed(__NX.getDecimals(__NX.state.tickSize));
              var chgEl = document.getElementById('fut-chg');
              if (chgEl) { chgEl.textContent = (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%'; chgEl.style.color = chg >= 0 ? '#0ecb81' : '#f6465d'; }
            });
          });
        }
      } catch(e) {}
    };
  }


  function _startBybitFeed(cfg) {
    var exSym = __NX.toExSym(__NX.state.symbol, cfg);
    __NX.state._bybitBook = { a:{}, b:{} };
    var ws = _obWsConnect(cfg.wsUrl(exSym));
    __NX.state._ws = ws;
    ws.onopen = function() {
      try { ws.send(JSON.stringify(cfg.wsSub(exSym))); } catch(e){}
      __NX.state._bybitPing = setInterval(function(){ try{ ws.send(JSON.stringify({op:'ping'})); }catch(e){} }, 20000);
    };
    ws.onclose = function() { if(__NX.state._bybitPing){ clearInterval(__NX.state._bybitPing); __NX.state._bybitPing=null; } };
    ws.onmessage = function(ev) {
      try {
        var d = JSON.parse(ev.data);
        if (!d.data || d.op === 'pong') return;
        var data = d.data;
        if (d.type === 'snapshot') {
          __NX.state._bybitBook = {a:{},b:{}};
          (data.a||[]).forEach(function(r){ if(parseFloat(r[1])>0) __NX.state._bybitBook.a[r[0]]=r[1]; });
          (data.b||[]).forEach(function(r){ if(parseFloat(r[1])>0) __NX.state._bybitBook.b[r[0]]=r[1]; });
        } else {
          (data.a||[]).forEach(function(r){ if(parseFloat(r[1])===0) delete __NX.state._bybitBook.a[r[0]]; else __NX.state._bybitBook.a[r[0]]=r[1]; });
          (data.b||[]).forEach(function(r){ if(parseFloat(r[1])===0) delete __NX.state._bybitBook.b[r[0]]; else __NX.state._bybitBook.b[r[0]]=r[1]; });
        }
        var asks = Object.entries(__NX.state._bybitBook.a).map(function(e){ return [parseFloat(e[0]),parseFloat(e[1])]; }).sort(function(a,b){return a[0]-b[0];}).slice(0,20);
        var bids = Object.entries(__NX.state._bybitBook.b).map(function(e){ return [parseFloat(e[0]),parseFloat(e[1])]; }).sort(function(a,b){return b[0]-a[0];}).slice(0,20);
        var book = {asks:asks, bids:bids};
        __NX.state._lastDepth = book;
        requestAnimationFrame(function(){ renderBook(book); });
      } catch(e){}
    };
  }


  function _startRestTickerPoll(cfg) {
    function poll() {
      var sym = __NX.toExSym(__NX.state.symbol, cfg);
      var p = window.fetchJsonWithFallback ? window.fetchJsonWithFallback(cfg.baseUrl + cfg.ticker(sym), 10000) : fetch(cfg.baseUrl + cfg.ticker(sym)).then(function(r){return r.json();});
      p.then(function(d){ _parseTicker(d, __NX.state.exchangeId, sym); }).catch(function(){});
    }
    poll();
    if (__NX.state.pollTimer) clearInterval(__NX.state.pollTimer);
    __NX.state.pollTimer = setInterval(poll, 2000);
  }

  // ── Sole caller: _startRestTickerPoll, only invoked from _startLbankFeed.
  // lbank is the only exchange without a documented futures WS schema, so
  // it's the only excId that ever reaches this function — kept lbank-only. ──
  function _parseTicker(d, excId, sym) {
    var last = 0, chg = 0;
    if (excId === 'lbank') {
      // marketData?productGroup=SwapU returns ALL contracts in one array —
      // must filter to the row matching the active symbol, not blindly
      // take index [0] (that was showing whichever contract happened to
      // sort first, not BTCUSDT). Field names are also lastPrice/openPrice,
      // not last_price/price_change_percent (those belong to a different
      // exchange's shape that got pasted in here).
      var rows = Array.isArray(d) ? d : ((d||{}).data||[]);
      var t = rows.find(function(r){ return r.symbol === sym; }) || {};
      last = parseFloat(t.lastPrice||0);
      var openP = parseFloat(t.openPrice||0);
      chg = openP ? (last-openP)/openP*100 : 0;
    }
    if (!last) return;
    __NX.state.lastPrice = last;
    var priceEl = document.getElementById('fut-price');
    if (priceEl && !priceEl.value) priceEl.value = last.toFixed(__NX.getDecimals(__NX.state.tickSize));
    var chgEl = document.getElementById('fut-chg');
    if (chgEl) { chgEl.textContent = (chg>=0?'+':'')+chg.toFixed(2)+'%'; chgEl.style.color = chg>=0?'#0ecb81':'#f6465d'; }
  }

  function stopFeed() {
    if (__NX.state.pollTimer) { clearInterval(__NX.state.pollTimer); __NX.state.pollTimer = null; }
    if (__NX.state.fundingTimer) { clearInterval(__NX.state.fundingTimer); __NX.state.fundingTimer = null; }
    if (__NX.state._ws) { try { __NX.state._ws.close(); } catch(e){} __NX.state._ws = null; }
    if (__NX.state._bybitPing) { clearInterval(__NX.state._bybitPing); __NX.state._bybitPing = null; }
    if (__NX.state._mexcPing) { clearInterval(__NX.state._mexcPing); __NX.state._mexcPing = null; }
    if (__NX.state._bitgetPing) { clearInterval(__NX.state._bitgetPing); __NX.state._bitgetPing = null; }
    if (__NX.state._kucoinPing) { clearInterval(__NX.state._kucoinPing); __NX.state._kucoinPing = null; }
    if (__NX.state._phemexPing) { clearInterval(__NX.state._phemexPing); __NX.state._phemexPing = null; }
    if (__NX.state._bitmartPing) { clearInterval(__NX.state._bitmartPing); __NX.state._bitmartPing = null; }
    if (__NX.state._digifinexPing) { clearInterval(__NX.state._digifinexPing); __NX.state._digifinexPing = null; }
    if (__NX.state._lbankDepthTimer) { clearInterval(__NX.state._lbankDepthTimer); __NX.state._lbankDepthTimer = null; }
    if (__NX.state._cbPing) { clearInterval(__NX.state._cbPing); __NX.state._cbPing = null; }
    if (__NX.state._obRo) { try { __NX.state._obRo.disconnect(); } catch(e){} __NX.state._obRo = null; }

    // ── Reset all cached market data so previous exchange data
    //    never bleeds into the next exchange after a switch ──
    __NX.state.lastPrice       = 0;
    __NX.state.bestBid         = 0;
    __NX.state.bestAsk         = 0;
    __NX.state._lastDepth      = null;
    __NX.state._bybitBook      = { a:{}, b:{} };
    __NX.state._mexcBook       = { a:{}, b:{} };
    __NX.state._krakenBook     = { a:{}, b:{} };
    __NX.state._bitfinexBook   = { a:{}, b:{} };
    __NX.state._bitfinexChanId = null;
    __NX.state._cbBook         = { a:{}, b:{} };
    __NX.state.positions       = [];
    __NX.state.openOrders      = [];
  }

  function renderBook(d) {
    var asksEl = document.getElementById('fut-ob-asks');
    var bidsEl = document.getElementById('fut-ob-bids');
    var midEl  = document.getElementById('fut-ob-mid');
    var midEl2 = document.getElementById('fut-ob-mid2');
    if (!asksEl || !bidsEl) return;

    var ROW_H = 17;
    var asksRowCount = asksEl.clientHeight ? Math.max(1, Math.floor(asksEl.clientHeight / ROW_H)) : 5;
    var bidsRowCount = bidsEl.clientHeight ? Math.max(1, Math.floor(bidsEl.clientHeight / ROW_H)) : 5;

    var rawAsks = (d.asks || []).map(function(r){ return [parseFloat(r[0]), parseFloat(r[1])]; });
    var rawBids = (d.bids || []).map(function(r){ return [parseFloat(r[0]), parseFloat(r[1])]; });

    var maxVol = 0;
    rawAsks.slice(0, asksRowCount).forEach(function(r){ if(r[1]>maxVol) maxVol=r[1]; });
    rawBids.slice(0, bidsRowCount).forEach(function(r){ if(r[1]>maxVol) maxVol=r[1]; });

    var askRows = rawAsks.slice(0, asksRowCount).reverse();
    asksEl.innerHTML = askRows.map(function(r) {
      var pct = maxVol ? (r[1]/maxVol*100).toFixed(1) : 0;
      return '<div onclick="FUT.fillPrice('+r[0]+')" style="position:relative;display:flex;align-items:center;justify-content:space-between;padding:0 6px;height:17px;box-sizing:border-box;cursor:pointer;-webkit-tap-highlight-color:transparent;">'
        +'<div style="position:absolute;right:0;top:0;bottom:0;background:rgba(246,70,93,0.13);width:'+pct+'%;pointer-events:none;"></div>'
        +'<span style="font-size:9px;font-weight:600;color:#f6465d;font-family:var(--font-mono);position:relative;white-space:nowrap;">'+__NX.fmtP(r[0])+'</span>'
        +'<span style="font-size:9px;color:rgba(255,255,255,0.45);font-family:var(--font-mono);position:relative;white-space:nowrap;">'+__NX.fmtV(r[1])+'</span>'
        +'</div>';
    }).join('');

    var bidRows = rawBids.slice(0, bidsRowCount);
    bidsEl.innerHTML = bidRows.map(function(r) {
      var pct = maxVol ? (r[1]/maxVol*100).toFixed(1) : 0;
      return '<div onclick="FUT.fillPrice('+r[0]+')" style="position:relative;display:flex;align-items:center;justify-content:space-between;padding:0 6px;height:17px;box-sizing:border-box;cursor:pointer;-webkit-tap-highlight-color:transparent;">'
        +'<div style="position:absolute;right:0;top:0;bottom:0;background:rgba(14,203,129,0.13);width:'+pct+'%;pointer-events:none;"></div>'
        +'<span style="font-size:9px;font-weight:600;color:#0ecb81;font-family:var(--font-mono);position:relative;white-space:nowrap;">'+__NX.fmtP(r[0])+'</span>'
        +'<span style="font-size:9px;color:rgba(255,255,255,0.45);font-family:var(--font-mono);position:relative;white-space:nowrap;">'+__NX.fmtV(r[1])+'</span>'
        +'</div>';
    }).join('');

    if (rawAsks.length && rawBids.length) {
      __NX.state.bestAsk = rawAsks[0][0];
      __NX.state.bestBid = rawBids[0][0];
      var mid = (__NX.state.bestAsk + __NX.state.bestBid) / 2;
      var up = mid >= (__NX.state.lastPrice || mid);
      __NX.state.lastPrice = mid;
      if (midEl) { midEl.textContent = __NX.fmtP(mid); midEl.style.color = up ? '#0ecb81' : '#f6465d'; }
      if (midEl2) midEl2.textContent = '≈ $' + mid.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
    }

    var buyVol  = rawBids.reduce(function(s,r){ return s+r[0]*r[1]; }, 0);
    var sellVol = rawAsks.reduce(function(s,r){ return s+r[0]*r[1]; }, 0);
    var total = buyVol + sellVol || 1;
    var buyPct = Math.round(buyVol/total*100);
    var dBuy = document.getElementById('fut-depth-buy'); if (dBuy) dBuy.style.width = buyPct + '%';
    var dBuyPct = document.getElementById('fut-depth-buy-pct'); if (dBuyPct) dBuyPct.textContent = buyPct + '%';
    var dSellPct = document.getElementById('fut-depth-sell-pct'); if (dSellPct) dSellPct.textContent = (100-buyPct) + '%';
  }

  function fetchFunding(cfg) {
    cfg = cfg || __NX.getFutCfg();
    var excId = __NX.state.exchangeId; // snapshot at call time
    var sym = __NX.toExSym(__NX.state.symbol, cfg);
    var fundEl = document.getElementById('fut-funding');
    if (!fundEl) return;

    (window.fetchJsonWithFallback ? window.fetchJsonWithFallback(cfg.baseUrl + cfg.funding(sym), 10000) : fetch(cfg.baseUrl + cfg.funding(sym)).then(function(r){ return r.json(); }))
      .then(function(d) {
        // Discard if exchange changed while awaiting
        if (__NX.state.exchangeId !== excId) return;
        var rate = 0, nextMs = 0;
        if (excId === 'binance') {
          rate = parseFloat(d.lastFundingRate||0) * 100;
          nextMs = parseInt(d.nextFundingTime||0, 10) - Date.now();
        } else if (excId === 'bybit') {
          var item = ((d.result||{}).list||[])[0]||{};
          rate = parseFloat(item.fundingRate||0) * 100;
        } else if (excId === 'bitget') {
          rate = parseFloat((d.data||{}).fundingRate||0) * 100;
        } else if (excId === 'mexc') {
          rate = parseFloat((d.data||{}).fundingRate||0) * 100;
        } else if (excId === 'gateio') {
          var item = d||{}; rate = parseFloat(item.funding_rate||0)*100;
        } else if (excId === 'bingx') {
          rate = parseFloat((d.data||{}).fundingRate||0)*100;
        } else if (excId === 'kucoin') {
          rate = parseFloat((d.data||{}).value||0)*100;
        } else if (excId === 'htx') {
          var item = (d.data||[])[0]||{}; rate = parseFloat(item.funding_rate||0)*100;
        } else if (excId === 'phemex') {
          rate = parseFloat((d.result||{}).fundingRateRr||0)*100;
        } else if (excId === 'kraken') {
          var item = (d.tickers||[])[0]||{}; rate = parseFloat(item.fundingRate||0)*100; nextMs = parseInt(item.nextFundingTime||0,10) - Date.now();
        } else if (excId === 'bitmart') {
          rate = parseFloat((d.data||{}).rate_value||0)*100;
        } else if (excId === 'digifinex') {
          var item = d.data||{}; rate = parseFloat(item.funding_rate||0)*100; nextMs = parseInt(item.funding_time||0,10) - Date.now();
        } else if (excId === 'lbank') {
          // Same marketData array as the ticker — must filter by symbol,
          // and the funding-rate field is prePositionFeeRate, not
          // funding_rate (that name belongs to a different exchange).
          var lbRows = Array.isArray(d) ? d : ((d||{}).data||[]);
          var lbItem = lbRows.find(function(r){ return r.symbol === sym; }) || {};
          rate = parseFloat(lbItem.prePositionFeeRate||0)*100;
        } else if (excId === 'bitfinex') {
          var item = (Array.isArray(d) && d[0])||[]; rate = parseFloat(item[12]||0)*100;
        } else if (excId === 'coinbase') {
          // Get Product → future_product_details.perpetual_details.funding_rate (best-effort;
          // Coinbase's public schema for this nested object isn't fully documented).
          var fpd = (d && d.future_product_details) || {};
          var pdt = fpd.perpetual_details || {};
          rate = parseFloat(pdt.funding_rate || 0) * 100;
        }
        var h = Math.max(0, Math.floor(nextMs/3600000));
        var m = Math.max(0, Math.floor((nextMs%3600000)/60000));
        var s = Math.max(0, Math.floor((nextMs%60000)/1000));
        var pad = function(n){ return (n<10?'0':'')+n; };
        var timeStr = nextMs > 0 ? ' / '+pad(h)+':'+pad(m)+':'+pad(s) : '';
        fundEl.textContent = rate.toFixed(4)+'%' + timeStr;
      }).catch(function(){});
  }

  function setTick(v) { __NX.state.tickSize = parseFloat(v); }
  function setObView(v) {}
})((window.__nxp = window.__nxp || {}).mod_fut_futures_engine = window.__nxp.mod_fut_futures_engine || {});
