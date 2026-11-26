// Futures: live feed core and Binance/MEXC/Bitget/Gate/HTX/BingX/KuCoin feeds
// Part of the futures engine (FUT) module (split by topic; no logic change).
(function (__NX) {
  __NX.startFeed = startFeed;
  __NX._mkBook = _mkBook;


  // ── LIVE FEED: market data per exchange (every exchange uses its own official WS order book) ──
  function startFeed() {
    __NX.stopFeed();
    var cfg = __NX.getFutCfg();
    var excId = __NX.state.exchangeId;

    var WS_FEEDS = {
      binance:   _startBinanceFeed,
      bybit:     __NX._startBybitFeed,
      mexc:      _startMexcFeed,
      bitget:    _startBitgetFeed,
      gateio:    _startGateioFeed,
      htx:       _startHtxFeed,
      bingx:     _startBingxFeed,
      kucoin:    _startKucoinFeed,
      phemex:    __NX._startPhemexFeed,
      bitmart:   __NX._startBitmartFeed,
      kraken:    __NX._startKrakenFeed,
      digifinex: __NX._startDigifinexFeed,
      lbank:     __NX._startLbankFeed,
      bitfinex:  __NX._startBitfinexFeed,
      coinbase:  __NX._startCoinbaseFeed,
    };

    var fn = WS_FEEDS[excId];
    if (fn) fn(cfg);

    // Funding rate polling (separate, every 30s)
    __NX.fetchFunding(cfg);
    if (__NX.state.fundingTimer) clearInterval(__NX.state.fundingTimer);
    __NX.state.fundingTimer = setInterval(function(){ __NX.fetchFunding(cfg); }, 30000);

    // ResizeObserver
    if (typeof ResizeObserver !== 'undefined' && !__NX.state._obRo) {
      __NX.state._obRo = new ResizeObserver(function() {
        if (__NX.state._lastDepth) requestAnimationFrame(function(){ __NX.renderBook(__NX.state._lastDepth); });
      });
      var asksEl = document.getElementById('fut-ob-asks');
      var bidsEl = document.getElementById('fut-ob-bids');
      if (asksEl) __NX.state._obRo.observe(asksEl);
      if (bidsEl) __NX.state._obRo.observe(bidsEl);
    }
  }

  // ── Helper: build a standard {asks,bids} book from raw [price,qty] arrays, sorted+sliced ──
  function _mkBook(asksRaw, bidsRaw) {
    var asks = asksRaw.map(function(r){ return [parseFloat(r[0]), parseFloat(r[1])]; })
      .filter(function(r){ return r[1] > 0; }).sort(function(a,b){ return a[0]-b[0]; }).slice(0,20);
    var bids = bidsRaw.map(function(r){ return [parseFloat(r[0]), parseFloat(r[1])]; })
      .filter(function(r){ return r[1] > 0; }).sort(function(a,b){ return b[0]-a[0]; }).slice(0,20);
    return { asks:asks, bids:bids };
  }

  // ── Binance Futures: wss://fstream.binance.com — partial depth20 stream, full snapshot every 100ms ──
  function _startBinanceFeed(cfg) {
    var exSym = __NX.toExSym(__NX.state.symbol, cfg);
    var ws = _obWsConnect('wss://fstream.binance.com/ws/' + exSym.toLowerCase() + '@depth20@100ms');
    __NX.state._ws = ws;
    ws.onmessage = function(ev) {
      try {
        var d = JSON.parse(ev.data);
        if (!d.b && !d.a) return;
        var book = _mkBook(d.a||[], d.b||[]);
        __NX.state._lastDepth = book;
        requestAnimationFrame(function(){ __NX.renderBook(book); });
      } catch(e){}
    };
  }

  // ── MEXC Contract (Futures): wss://contract.mexc.com/edge — sub.depth incremental, maintain local book ──
  function _startMexcFeed(cfg) {
    var exSym = __NX.toExSym(__NX.state.symbol, cfg);
    __NX.state._mexcBook = { a:{}, b:{} };
    var ws = _obWsConnect('wss://contract.mexc.com/edge');
    __NX.state._ws = ws;
    ws.onopen = function() {
      try { ws.send(JSON.stringify({ method:'sub.depth', param:{ symbol: exSym } })); } catch(e){}
      __NX.state._mexcPing = setInterval(function(){ try{ ws.send(JSON.stringify({method:'ping'})); }catch(e){} }, 15000);
    };
    ws.onclose = function() { if (__NX.state._mexcPing) { clearInterval(__NX.state._mexcPing); __NX.state._mexcPing=null; } };
    ws.onmessage = function(ev) {
      try {
        var d = JSON.parse(ev.data);
        if (d.channel !== 'push.depth' || !d.data) return;
        var data = d.data;
        (data.asks||[]).forEach(function(r){ if (parseFloat(r[1])<=0) delete __NX.state._mexcBook.a[r[0]]; else __NX.state._mexcBook.a[r[0]]=r[1]; });
        (data.bids||[]).forEach(function(r){ if (parseFloat(r[1])<=0) delete __NX.state._mexcBook.b[r[0]]; else __NX.state._mexcBook.b[r[0]]=r[1]; });
        var book = _mkBook(Object.entries(__NX.state._mexcBook.a), Object.entries(__NX.state._mexcBook.b));
        __NX.state._lastDepth = book;
        requestAnimationFrame(function(){ __NX.renderBook(book); });
      } catch(e){}
    };
  }

  // ── Bitget v2: wss://ws.bitget.com/v2/ws/public — books5 channel, full snapshot pushes ──
  function _startBitgetFeed(cfg) {
    var exSym = __NX.toExSym(__NX.state.symbol, cfg);
    var ws = _obWsConnect('wss://ws.bitget.com/v2/ws/public');
    __NX.state._ws = ws;
    ws.onopen = function() {
      try { ws.send(JSON.stringify({op:'subscribe', args:[{instType:'USDT-FUTURES', channel:'books5', instId:exSym}]})); } catch(e){}
      try { ws.send(JSON.stringify({op:'subscribe', args:[{instType:'USDT-FUTURES', channel:'ticker', instId:exSym}]})); } catch(e){}
      __NX.state._bitgetPing = setInterval(function(){ try{ ws.send('ping'); }catch(e){} }, 20000);
    };
    ws.onclose = function() { if (__NX.state._bitgetPing) { clearInterval(__NX.state._bitgetPing); __NX.state._bitgetPing=null; } };
    ws.onmessage = function(ev) {
      try {
        if (ev.data === 'pong') return;
        var d = JSON.parse(ev.data);
        if (!d.arg || !d.data || !d.data.length) return;
        if (d.arg.channel === 'books5') {
          var book = _mkBook(d.data[0].asks||[], d.data[0].bids||[]);
          __NX.state._lastDepth = book;
          requestAnimationFrame(function(){ __NX.renderBook(book); });
        } else if (d.arg.channel === 'ticker') {
          var t = d.data[0]||{};
          var last = parseFloat(t.lastPr||0), chg = parseFloat(t.chgUtc||t.change24h||0)*100;
          if (last) {
            __NX.state.lastPrice = last;
            var priceEl = document.getElementById('fut-price');
            if (priceEl && !priceEl.value) priceEl.value = last.toFixed(__NX.getDecimals(__NX.state.tickSize));
            var chgEl = document.getElementById('fut-chg');
            if (chgEl) { chgEl.textContent = (chg>=0?'+':'')+chg.toFixed(2)+'%'; chgEl.style.color = chg>=0?'#0ecb81':'#f6465d'; }
          }
        }
      } catch(e){}
    };
  }

  // ── Gate.io Futures: wss://fx-ws.gateio.ws/v4/ws/usdt — futures.order_book, 'all' event = full snapshot ──
  function _startGateioFeed(cfg) {
    var exSym = __NX.toExSym(__NX.state.symbol, cfg);
    var ws = _obWsConnect('wss://fx-ws.gateio.ws/v4/ws/usdt');
    __NX.state._ws = ws;
    ws.onopen = function() {
      try { ws.send(JSON.stringify({time:Math.floor(Date.now()/1000), channel:'futures.order_book', event:'subscribe', payload:[exSym,'20','0']})); } catch(e){}
    };
    ws.onmessage = function(ev) {
      try {
        var d = JSON.parse(ev.data);
        if (d.channel !== 'futures.order_book' || !d.result) return;
        var r = d.result;
        var asksRaw = (r.asks||[]).map(function(x){ return [x.p, x.s]; });
        var bidsRaw = (r.bids||[]).map(function(x){ return [x.p, x.s]; });
        var book = _mkBook(asksRaw, bidsRaw);
        __NX.state._lastDepth = book;
        requestAnimationFrame(function(){ __NX.renderBook(book); });
      } catch(e){}
    };
  }

  // ── HTX linear-swap: wss://api.hbdm.com/linear-swap-ws — market.{contract}.depth.step0, gzip-compressed ──
  function _startHtxFeed(cfg) {
    var exSym = __NX.toExSym(__NX.state.symbol, cfg);
    var ws = _obWsConnect('wss://api.hbdm.com/linear-swap-ws');
    ws.binaryType = 'arraybuffer';
    __NX.state._ws = ws;
    ws.onopen = function() {
      try { ws.send(JSON.stringify({sub:'market.'+exSym+'.depth.step0', id:'futob1'})); } catch(e){}
    };
    ws.onmessage = function(ev) {
      _gunzipJson(ev.data).then(function(d) {
        if (!d) return;
        if (d.ping) { try { ws.send(JSON.stringify({pong:d.ping})); } catch(e){} return; }
        if (!d.tick) return;
        var book = _mkBook(d.tick.asks||[], d.tick.bids||[]);
        __NX.state._lastDepth = book;
        requestAnimationFrame(function(){ __NX.renderBook(book); });
      }).catch(function(){});
    };
  }

  // ── Gzip decompress helper for binary WS frames (HTX) using native browser DecompressionStream ──
  function _gunzipJson(data) {
    try {
      var buf = (data instanceof ArrayBuffer) ? data : null;
      if (!buf) return Promise.resolve(null);
      if (typeof DecompressionStream === 'undefined') return Promise.resolve(null);
      var ds = new DecompressionStream('gzip');
      var stream = new Blob([buf]).stream().pipeThrough(ds);
      return new Response(stream).text().then(function(txt){ try { return JSON.parse(txt); } catch(e){ return null; } });
    } catch(e) { return Promise.resolve(null); }
  }

  // ── BingX swap: wss://open-api-swap.bingx.com/swap-market — depth20 dataType, gzip-compressed ──
  function _startBingxFeed(cfg) {
    var exSym = __NX.toExSym(__NX.state.symbol, cfg);
    var ws = _obWsConnect('wss://open-api-swap.bingx.com/swap-market');
    ws.binaryType = 'arraybuffer';
    __NX.state._ws = ws;
    ws.onopen = function() {
      try { ws.send(JSON.stringify({id:'futob1', reqType:'sub', dataType:exSym+'@depth20'})); } catch(e){}
    };
    ws.onmessage = function(ev) {
      _gunzipJson(ev.data).then(function(d) {
        if (!d) return;
        if (d === 'Ping') { try { ws.send('Pong'); } catch(e){} return; }
        if (!d.data) return;
        var book = _mkBook(d.data.asks||[], d.data.bids||[]);
        __NX.state._lastDepth = book;
        requestAnimationFrame(function(){ __NX.renderBook(book); });
      }).catch(function(){});
    };
  }

  // ── KuCoin Futures: requires dynamic public token via REST, then wss://ws-api-futures.kucoin.com ──
  function _startKucoinFeed(cfg) {
    var exSym = __NX.toExSym(__NX.state.symbol, cfg);
    (_nxSignedFetch ? _nxSignedFetch('https://api-futures.kucoin.com/api/v1/bullet-public', { method: 'POST' }) : fetch('https://api-futures.kucoin.com/api/v1/bullet-public', { method:'POST' }))
      .then(function(r){ return r.json(); })
      .then(function(res) {
        if (__NX.state.exchangeId !== 'kucoin') return; // exchange switched while awaiting token
        var data = (res||{}).data;
        var server = data && data.instanceServers && data.instanceServers[0];
        if (!server) return;
        var ws = _obWsConnect(server.endpoint + '?token=' + data.token);
        __NX.state._ws = ws;
        ws.onopen = function() {
          try { ws.send(JSON.stringify({id:Date.now(), type:'subscribe', topic:'/contractMarket/level2Depth5:'+exSym, response:true})); } catch(e){}
          __NX.state._kucoinPing = setInterval(function(){ try{ ws.send(JSON.stringify({id:Date.now(), type:'ping'})); }catch(e){} }, Math.max(10000, (server.pingInterval||18000) - 5000));
        };
        ws.onclose = function() { if (__NX.state._kucoinPing) { clearInterval(__NX.state._kucoinPing); __NX.state._kucoinPing=null; } };
        ws.onmessage = function(ev) {
          try {
            var d = JSON.parse(ev.data);
            if (d.type !== 'message' || !d.data) return;
            var book = _mkBook(d.data.asks||[], d.data.bids||[]);
            __NX.state._lastDepth = book;
            requestAnimationFrame(function(){ __NX.renderBook(book); });
          } catch(e){}
        };
      })
      .catch(function(){});
  }
})((window.__nxp = window.__nxp || {}).mod_fut_futures_engine = window.__nxp.mod_fut_futures_engine || {});
