// Order book WebSocket state, reconnect and per-exchange connect
// Part of the exchange spot engine (window.EXC) module (split by topic; no logic change).
(function (__NX) {
  __NX._obGotData = _obGotData;
  __NX._obScheduleReconnect = _obScheduleReconnect;
  __NX._wireObReconnect = _wireObReconnect;
  __NX._obWsConnect = _obWsConnect;
  __NX.startOrderBook = startOrderBook;


  // ── Public API ──
  // ──────────────────────────────────────────────
  // ORDER BOOK (Binance WebSocket)
  // ──────────────────────────────────────────────
  __NX._obWs = null;
  __NX._obPing = null;
  __NX._obAsks = [];
  __NX._obBids = [];
  __NX._obAnimFrame = null;
  __NX._obResizeObs = null;
  // Bumped every time the order book is (re)started or stopped. Pollers
  // capture the value at creation time and check it before applying a
  // result or scheduling their next poll — if it's changed, a newer
  // pair/exchange selection has taken over and this poller's in-flight
  // request is stale and should do nothing further.
  __NX._obGen = 0;
  __NX._obReconnectTimer = null;
  __NX._obReconnectAttempts = 0;
  var _OB_MAX_RECONNECT = 6; // after this many failed attempts in a row, stop auto-retrying and leave the "unavailable" message up; switching pair/exchange forces a fresh retry sequence

  function _obGotData() {
    __NX._obReconnectAttempts = 0;
    if (!__NX._obAnimFrame) __NX._obAnimFrame = requestAnimationFrame(__NX.renderOrderBook);
  }

  // Reconnect-on-disconnect for the live order book. Every exchange branch's
  // WebSocket used to just go silent on a dropped connection — no retry, no
  // indication to the user that the numbers on screen had gone stale. This
  // wraps onclose (chaining whatever cleanup the branch already does, e.g.
  // clearing a ping interval) and schedules a fresh connect attempt with
  // capped exponential backoff, bailing out if the user has since switched
  // pair/exchange (myGen no longer matches the live generation).
  function _obScheduleReconnect(connectFn, myGen) {
    if (myGen !== __NX._obGen) return;
    __NX._obReconnectAttempts++;
    __NX._showOrderBookFailMessage();
    if (__NX._obReconnectAttempts > _OB_MAX_RECONNECT) return;
    var delay = Math.min(3000 * __NX._obReconnectAttempts, 15000);
    __NX._obReconnectTimer = setTimeout(function() {
      if (myGen !== __NX._obGen) return;
      connectFn();
    }, delay);
  }

  function _wireObReconnect(connectFn, myGen) {
    if (!__NX._obWs) return;
    var origOnClose = __NX._obWs.onclose;
    __NX._obWs.onclose = function(ev) {
      if (origOnClose) { try { origOnClose(ev); } catch(e){} }
      _obScheduleReconnect(connectFn, myGen);
    };
  }

  function _obWsConnect(directUrl) {
    var handlers = { onopen: null, onmessage: null, onerror: null, onclose: null };
    var shim = {
      get onopen() { return handlers.onopen; }, set onopen(fn) { handlers.onopen = fn; },
      get onmessage() { return handlers.onmessage; }, set onmessage(fn) { handlers.onmessage = fn; },
      get onerror() { return handlers.onerror; }, set onerror(fn) { handlers.onerror = fn; },
      get onclose() { return handlers.onclose; }, set onclose(fn) { handlers.onclose = fn; },
      send: function(data) { if (real && real.readyState === WebSocket.OPEN) real.send(data); },
      close: function(code, reason) { if (real) { try { real.close(code, reason); } catch(e){} } },
    };
    var real = null;

    var ws = new WebSocket(directUrl);
    real = ws;
    ws.onopen = function(ev) { if (handlers.onopen) handlers.onopen(ev); };
    ws.onmessage = function(ev) { if (handlers.onmessage) handlers.onmessage(ev); };
    ws.onerror = function(ev) { if (handlers.onerror) handlers.onerror(ev); };
    ws.onclose = function(ev) { if (handlers.onclose) handlers.onclose(ev); };

    return shim;
  }

  function _obDispatchConnect(exc, symbol, symLow, myGen) {
    try {
      if (exc.id === 'kucoin') {
        // KuCoin: public WS needs a short-lived "bullet" token first (POST
        // /api/v1/bullet-public, no auth required) — the same flow KuCoin's
        // own SDK/web widgets use directly from a browser. Once we have the
        // token + WS endpoint, connect and subscribe to the level2Depth50
        // snapshot topic, same as every other exchange here.
        __NX._startKuCoinOrderBookWs(symbol, myGen);
      } else if (exc.id === 'mexc') {
        // MEXC's market-data WebSocket depth channels push protobuf-only
        // binary frames (see MEXC docs: "Protocol Buffers Integration") —
        // JSON.parse() on them silently fails every message. Decoded below
        // with a small generic protobuf field reader (_pbFields) instead of
        // pulling in protobuf.js; see PublicLimitDepthsV3Api in
        // https://github.com/mexcdevelop/websocket-proto for the schema.
        __NX._startMexcOrderBookWs(symbol, myGen);
      } else if (exc.id === 'bybit') {
        // Bybit spot WS: snapshot on connect, then delta updates; needs 20s ping
        __NX._obWs = _obWsConnect('wss://stream.bybit.com/v5/public/spot');
        var _bybitPing = null;
        var _bybitBook = { a: {}, b: {} }; // local book for delta merging
        __NX._obWs.onopen = function() {
          try {
            __NX._obWs.send(JSON.stringify({op:'subscribe',args:['orderbook.50.'+symbol]}));
            _bybitPing = setInterval(function(){ try{ __NX._obWs.send(JSON.stringify({op:'ping'})); }catch(e){} }, 20000);
          } catch(e) {}
        };
        __NX._obWs.onclose = function() { if(_bybitPing) clearInterval(_bybitPing); _bybitBook={a:{},b:{}}; };
        __NX._obWs.onmessage = function(ev) {
          try {
            if (myGen !== __NX._obGen) return; // stale socket from a previous pair/exchange — ignore
            var d = JSON.parse(ev.data);
            if (d.op === 'pong' || !d.data) return;
            var data = d.data;
            if (d.type === 'snapshot') {
              // Full snapshot: replace local book
              _bybitBook = { a: {}, b: {} };
              (data.a||[]).forEach(function(r){ if(parseFloat(r[1])>0) _bybitBook.a[r[0]]=r[1]; });
              (data.b||[]).forEach(function(r){ if(parseFloat(r[1])>0) _bybitBook.b[r[0]]=r[1]; });
            } else {
              // Delta: merge into local book
              (data.a||[]).forEach(function(r){ if(parseFloat(r[1])===0) delete _bybitBook.a[r[0]]; else _bybitBook.a[r[0]]=r[1]; });
              (data.b||[]).forEach(function(r){ if(parseFloat(r[1])===0) delete _bybitBook.b[r[0]]; else _bybitBook.b[r[0]]=r[1]; });
            }
            // Sort and slice to 20 levels
            __NX._obAsks = Object.entries(_bybitBook.a).map(function(e){ return [parseFloat(e[0]),parseFloat(e[1])]; }).sort(function(a,b){return a[0]-b[0];}).slice(0,20);
            __NX._obBids = Object.entries(_bybitBook.b).map(function(e){ return [parseFloat(e[0]),parseFloat(e[1])]; }).sort(function(a,b){return b[0]-a[0];}).slice(0,20);
            _obGotData();
          } catch(e) {}
        };
        __NX._obWs.onerror = function() { if(_bybitPing) clearInterval(_bybitPing); };
      } else if (exc.id === 'bitget') {
        // Bitget spot WS: wss://ws.bitget.com/v2/ws/public, books5, instType SPOT
        __NX._obWs = _obWsConnect('wss://ws.bitget.com/v2/ws/public');
        __NX._obWs.onopen = function() {
          try { __NX._obWs.send(JSON.stringify({op:'subscribe',args:[{instType:'SPOT',channel:'books5',instId:symbol}]})); } catch(e){}
          __NX._obPing = setInterval(function(){ try{ __NX._obWs.send('ping'); }catch(e){} }, 25000);
        };
        __NX._obWs.onclose = function(){ if(__NX._obPing){clearInterval(__NX._obPing);__NX._obPing=null;} };
        __NX._obWs.onmessage = function(ev) {
          try {
            if (myGen !== __NX._obGen) return; // stale socket from a previous pair/exchange — ignore
            if (ev.data === 'pong') return;
            var d = JSON.parse(ev.data);
            var book = (d.data || [])[0] || {};
            if (!book.asks && !book.bids) return;
            __NX._obAsks = (book.asks||[]).slice(0,20).map(function(r){return [parseFloat(r[0]),parseFloat(r[1])];});
            __NX._obBids = (book.bids||[]).slice(0,20).map(function(r){return [parseFloat(r[0]),parseFloat(r[1])];});
            _obGotData();
          } catch(e) {}
        };
      } else if (exc.id === 'gateio') {
        // Gate.io spot WS: wss://api.gateio.ws/ws/v4/, spot.order_book
        var sqGate = __NX._splitBaseQuote(symbol);
        __NX._obWs = _obWsConnect('wss://api.gateio.ws/ws/v4/');
        __NX._obWs.onopen = function() {
          try { __NX._obWs.send(JSON.stringify({time:Math.floor(Date.now()/1000),channel:'spot.order_book',event:'subscribe',payload:[sqGate.base+'_'+sqGate.quote,'20','0']})); } catch(e){}
        };
        __NX._obWs.onerror = function(ev) { console.error('[OB] gateio ws error', ev); };
        __NX._obWs.onmessage = function(ev) {
          try {
            if (myGen !== __NX._obGen) return; // stale socket from a previous pair/exchange — ignore
            var d = JSON.parse(ev.data);
            // Legacy spot.order_book channel pushes the full snapshot as
            // event:"all" (every payload[2]-seconds interval / on change)
            // and only sends event:"update" for incremental diffs on some
            // accounts. Only handling "update" meant the snapshot — the
            // only message most sessions ever receive — was silently
            // dropped, leaving the book permanently empty.
            if ((d.event !== 'update' && d.event !== 'all') || !d.result) return;
            var book = d.result;
            __NX._obAsks = (book.asks||[]).slice(0,20).map(function(r){return [parseFloat(r[0]),parseFloat(r[1])];});
            __NX._obBids = (book.bids||[]).slice(0,20).map(function(r){return [parseFloat(r[0]),parseFloat(r[1])];});
            _obGotData();
          } catch(e) {}
        };
      } else if (exc.id === 'htx') {
        // HTX spot WS: wss://api.huobi.pro/ws, market.{sym}.depth.step0, gzip-compressed
        __NX._obWs = _obWsConnect('wss://api.huobi.pro/ws');
        __NX._obWs.binaryType = 'arraybuffer';
        __NX._obWs.onopen = function() {
          try { __NX._obWs.send(JSON.stringify({sub:'market.'+symLow+'.depth.step0', id:'spotob1'})); } catch(e){}
        };
        __NX._obWs.onmessage = function(ev) {
          __NX._gunzipJsonOb(ev.data).then(function(d) {
            if (myGen !== __NX._obGen) return; // stale socket from a previous pair/exchange — ignore
            if (!d) return;
            if (d.ping) { try { __NX._obWs.send(JSON.stringify({pong:d.ping})); } catch(e){} return; }
            if (!d.tick) return;
            __NX._obAsks = (d.tick.asks||[]).slice(0,20).map(function(r){return [parseFloat(r[0]),parseFloat(r[1])];});
            __NX._obBids = (d.tick.bids||[]).slice(0,20).map(function(r){return [parseFloat(r[0]),parseFloat(r[1])];});
            _obGotData();
          }).catch(function(){});
        };
      } else if (exc.id === 'bingx') {
        // BingX spot WS: wss://open-api-ws.bingx.com/market, {sym}@depth20, gzip-compressed
        var sqBx = __NX._splitBaseQuote(symbol);
        __NX._obWs = _obWsConnect('wss://open-api-ws.bingx.com/market');
        __NX._obWs.binaryType = 'arraybuffer';
        __NX._obWs.onopen = function() {
          try { __NX._obWs.send(JSON.stringify({id:'spotob1',reqType:'sub',dataType:sqBx.base+'-'+sqBx.quote+'@depth20'})); } catch(e){}
        };
        __NX._obWs.onmessage = function(ev) {
          __NX._gunzipJsonOb(ev.data).then(function(d) {
            if (myGen !== __NX._obGen) return; // stale socket from a previous pair/exchange — ignore
            if (!d) return;
            if (d === 'Ping') { try { __NX._obWs.send('Pong'); } catch(e){} return; }
            if (!d.data) return;
            __NX._obAsks = (d.data.asks||[]).slice(0,20).map(function(r){return [parseFloat(r[0]),parseFloat(r[1])];});
            __NX._obBids = (d.data.bids||[]).slice(0,20).map(function(r){return [parseFloat(r[0]),parseFloat(r[1])];});
            _obGotData();
          }).catch(function(){});
        };
      } else if (exc.id === 'phemex') {
        // Phemex spot WS: wss://ws.phemex.com, orderbook.subscribe, s-prefixed symbol, scaled /1e8
        __NX._obWs = _obWsConnect('wss://ws.phemex.com');
        __NX._obWs.onopen = function() {
          try { __NX._obWs.send(JSON.stringify({id:1,method:'orderbook.subscribe',params:['s'+symbol]})); } catch(e){}
          __NX._obPing = setInterval(function(){ try{ __NX._obWs.send(JSON.stringify({id:2,method:'server.ping',params:[]})); }catch(e){} }, 15000);
        };
        __NX._obWs.onclose = function(){ if(__NX._obPing){clearInterval(__NX._obPing);__NX._obPing=null;} };
        __NX._obWs.onmessage = function(ev) {
          try {
            if (myGen !== __NX._obGen) return; // stale socket from a previous pair/exchange — ignore
            var d = JSON.parse(ev.data);
            var book = d.book || ((d.result||{}).book);
            if (!book) return;
            __NX._obAsks = (book.asks||[]).slice(0,20).map(function(r){return [parseFloat(r[0])/1e8,parseFloat(r[1])/1e8];});
            __NX._obBids = (book.bids||[]).slice(0,20).map(function(r){return [parseFloat(r[0])/1e8,parseFloat(r[1])/1e8];});
            _obGotData();
          } catch(e) {}
        };
      } else if (exc.id === 'bitmart') {
        // BitMart spot WS: wss://ws-manager-compress.bitmart.com/api?protocol=1.1, spot/depth20
        var sqBm = __NX._splitBaseQuote(symbol);
        __NX._obWs = _obWsConnect('wss://ws-manager-compress.bitmart.com/api?protocol=1.1');
        __NX._obWs.onopen = function() {
          try { __NX._obWs.send(JSON.stringify({op:'subscribe',args:['spot/depth20:'+sqBm.base+'_'+sqBm.quote]})); } catch(e){}
          __NX._obPing = setInterval(function(){ try{ __NX._obWs.send('ping'); }catch(e){} }, 15000);
        };
        __NX._obWs.onclose = function(){ if(__NX._obPing){clearInterval(__NX._obPing);__NX._obPing=null;} };
        __NX._obWs.onmessage = function(ev) {
          try {
            if (myGen !== __NX._obGen) return; // stale socket from a previous pair/exchange — ignore
            if (ev.data === 'pong') return;
            var d = JSON.parse(ev.data);
            if (!d.data || !/spot\/depth/.test(d.table||d.group||'')) return;
            // d.data is an ARRAY containing one book object: [{asks,bids,symbol,ms_t}] —
            // not the book object itself. Reading d.data.asks straight off the array
            // was always undefined, so the BitMart book never painted any rows.
            var bmBook = (d.data||[])[0] || {};
            __NX._obAsks = (bmBook.asks||[]).slice(0,20).map(function(r){return [parseFloat(r.price||r[0]),parseFloat(r.amount||r[1])];});
            __NX._obBids = (bmBook.bids||[]).slice(0,20).map(function(r){return [parseFloat(r.price||r[0]),parseFloat(r.amount||r[1])];});
            _obGotData();
          } catch(e) {}
        };
      } else if (exc.id === 'kraken') {
        // Kraken spot WS v2: wss://ws.kraken.com/v2, book channel, BASE/QUOTE symbol.
        // v2 uses plain "BTC/USD" — unlike the legacy v1/REST "XBT" asset
        // code, v2 never expects XBT. Subscribing with "XBT/USDT" gets a
        // silent no-match (no error, just no data), which is why the book
        // never painted: the symbol simply didn't exist on this channel.
        // IMPORTANT: only the first message (type:"snapshot") is the full book —
        // every later message (type:"update") carries ONLY the price levels that
        // changed, with qty:0 meaning "remove this level". Previously this just
        // replaced the whole displayed book with each message's contents, which
        // collapsed a 20-row book down to the 1-2 rows in the latest update.
        var sqKr = __NX._splitBaseQuote(symbol);
        var krBase = sqKr.base;
        var _krBook = { a: {}, b: {} }; // local book for delta merging, keyed by price string
        __NX._obWs = _obWsConnect('wss://ws.kraken.com/v2');
        __NX._obWs.onerror = function(ev) { console.error('[OB] kraken ws error', ev); };
        __NX._obWs.onopen = function() {
          try { __NX._obWs.send(JSON.stringify({method:'subscribe',params:{channel:'book',symbol:[krBase+'/'+sqKr.quote]}})); } catch(e){}
        };
        __NX._obWs.onmessage = function(ev) {
          try {
            if (myGen !== __NX._obGen) return; // stale socket from a previous pair/exchange — ignore
            var d = JSON.parse(ev.data);
            if (d.method === 'subscribe' && d.success === false) { console.error('[OB] kraken subscribe rejected', d.error); return; }
            if (d.channel !== 'book' || !d.data) return;
            var book = d.data[0] || {};
            if (d.type === 'snapshot') _krBook = { a: {}, b: {} };
            (book.asks||[]).forEach(function(r){
              var qty = parseFloat(r.qty);
              if (!qty) delete _krBook.a[r.price]; else _krBook.a[r.price] = qty;
            });
            (book.bids||[]).forEach(function(r){
              var qty = parseFloat(r.qty);
              if (!qty) delete _krBook.b[r.price]; else _krBook.b[r.price] = qty;
            });
            __NX._obAsks = Object.keys(_krBook.a).map(function(p){return [parseFloat(p),_krBook.a[p]];}).sort(function(x,y){return x[0]-y[0];}).slice(0,20);
            __NX._obBids = Object.keys(_krBook.b).map(function(p){return [parseFloat(p),_krBook.b[p]];}).sort(function(x,y){return y[0]-x[0];}).slice(0,20);
            _obGotData();
          } catch(e) {}
        };
      } else if (exc.id === 'digifinex') {
        // DigiFinex spot WS: wss://openapi.digifinex.com/ws/v1/, depth.subscribe, zlib-deflate compressed
        var sqDf = __NX._splitBaseQuote(symbol);
        __NX._obWs = _obWsConnect('wss://openapi.digifinex.com/ws/v1/');
        __NX._obWs.binaryType = 'arraybuffer';
        __NX._obWs.onopen = function() {
          try { __NX._obWs.send(JSON.stringify({id:1,method:'depth.subscribe',params:[sqDf.base+'_'+sqDf.quote]})); } catch(e){}
          __NX._obPing = setInterval(function(){ try{ __NX._obWs.send(JSON.stringify({id:2,method:'server.ping',params:[]})); }catch(e){} }, 25000);
        };
        __NX._obWs.onclose = function(){ if(__NX._obPing){clearInterval(__NX._obPing);__NX._obPing=null;} };
        __NX._obWs.onmessage = function(ev) {
          __NX._inflateJsonOb(ev.data).then(function(d) {
            if (myGen !== __NX._obGen) return; // stale socket from a previous pair/exchange — ignore
            if (!d || d.method !== 'depth.update' || !d.params) return;
            var book = d.params[1] || {};
            __NX._obAsks = (book.asks||[]).slice(0,20).map(function(r){return [parseFloat(r[0]),parseFloat(r[1])];});
            __NX._obBids = (book.bids||[]).slice(0,20).map(function(r){return [parseFloat(r[0]),parseFloat(r[1])];});
            _obGotData();
          }).catch(function(){});
        };
      } else if (exc.id === 'lbank') {
        // LBank spot WS: wss://www.lbkex.net/ws/V2/, public depth subscribe, lowercase underscore pair
        var sqLb = __NX._splitBaseQuote(symbol);
        __NX._obWs = _obWsConnect('wss://www.lbkex.net/ws/V2/');
        __NX._obWs.onopen = function() {
          try { __NX._obWs.send(JSON.stringify({action:'subscribe',subscribe:'depth',depth:'20',pair:sqLb.base.toLowerCase()+'_'+sqLb.quote.toLowerCase()})); } catch(e){}
          __NX._obPing = setInterval(function(){ try{ __NX._obWs.send(JSON.stringify({action:'ping',ping:String(Date.now())})); }catch(e){} }, 20000);
        };
        __NX._obWs.onclose = function(){ if(__NX._obPing){clearInterval(__NX._obPing);__NX._obPing=null;} };
        __NX._obWs.onmessage = function(ev) {
          try {
            if (myGen !== __NX._obGen) return; // stale socket from a previous pair/exchange — ignore
            var d = JSON.parse(ev.data);
            if (!d.depth) return;
            __NX._obAsks = (d.depth.asks||[]).slice(0,20).map(function(r){return [parseFloat(r[0]),parseFloat(r[1])];});
            __NX._obBids = (d.depth.bids||[]).slice(0,20).map(function(r){return [parseFloat(r[0]),parseFloat(r[1])];});
            _obGotData();
          } catch(e) {}
        };
      } else if (exc.id === 'bitfinex') {
        // Bitfinex spot WS: wss://api-pub.bitfinex.com/ws/2, book channel.
        // Per Bitfinex's documented book algorithm, only the very first message
        // is a full snapshot (array of [price,count,amount] rows) — every later
        // message is a SINGLE [price,count,amount] delta: count>0 means add/update
        // that price level (amount>0=bid, amount<0=ask, size=abs(amount));
        // count===0 means delete that price level (amount===1=from bids,
        // amount===-1=from asks). Previously every delta replaced the whole
        // displayed book with just that one row, so the book collapsed to ~1
        // row per side right after the snapshot, and deletes were never applied.
        var sqBf = __NX._splitBaseQuote(symbol);
        // Bitfinex's actual trading-pair suffix is UST, not USDT (e.g.
        // tBTCUST) — fetchMarkets() already knew this when parsing tickers
        // (".replace(/UST$/,'USDT')"), but this WS subscribe still sent the
        // raw "USDT" quote, producing an unknown symbol like "tBTCUSDT" that
        // Bitfinex silently never confirms, so the book stayed empty.
        var bfQuote = sqBf.quote === 'USDT' ? 'UST' : sqBf.quote;
        __NX._obWs = _obWsConnect('wss://api-pub.bitfinex.com/ws/2');
        var _bfChanId = null;
        var _bfBook = { a: {}, b: {} }; // local book for delta merging, keyed by price
        __NX._obWs.onerror = function(ev) { console.error('[OB] bitfinex ws error', ev); };
        __NX._obWs.onopen = function() {
          try { __NX._obWs.send(JSON.stringify({event:'subscribe',channel:'book',symbol:'t'+sqBf.base+bfQuote,prec:'P0',len:25})); } catch(e){}
        };
        __NX._obWs.onmessage = function(ev) {
          try {
            if (myGen !== __NX._obGen) return; // stale socket from a previous pair/exchange — ignore
            var d = JSON.parse(ev.data);
            if (d.event === 'error') { console.error('[OB] bitfinex subscribe error', d); return; }
            if (d.event === 'subscribed' && d.channel === 'book') { _bfChanId = d.chanId; return; }
            if (!Array.isArray(d) || d[0] !== _bfChanId || !Array.isArray(d[1])) return;
            var isSnapshot = Array.isArray(d[1][0]);
            var rows = isSnapshot ? d[1] : [d[1]];
            if (isSnapshot) _bfBook = { a: {}, b: {} };
            rows.forEach(function(r){
              if (!Array.isArray(r) || r.length < 3) return;
              var p = r[0], count = r[1], amt = parseFloat(r[2]);
              if (count > 0) {
                if (amt > 0) { _bfBook.b[p] = amt; delete _bfBook.a[p]; }
                else { _bfBook.a[p] = Math.abs(amt); delete _bfBook.b[p]; }
              } else {
                if (amt === 1) delete _bfBook.b[p];
                else if (amt === -1) delete _bfBook.a[p];
              }
            });
            __NX._obAsks = Object.keys(_bfBook.a).map(function(p){return [parseFloat(p),_bfBook.a[p]];}).sort(function(x,y){return x[0]-y[0];}).slice(0,20);
            __NX._obBids = Object.keys(_bfBook.b).map(function(p){return [parseFloat(p),_bfBook.b[p]];}).sort(function(x,y){return y[0]-x[0];}).slice(0,20);
            _obGotData();
          } catch(e) {}
        };
      } else if (exc.id === 'coinbase') {
        // Coinbase Exchange spot WS: wss://ws-feed.exchange.coinbase.com.
        // The plain "level2" channel started requiring authentication —
        // subscribing without a key/passphrase/signature now gets rejected
        // with "level2, level3, and full channels now require authentication",
        // which is why the book never painted. "level2_batch" is still public
        // (no auth) and uses the identical snapshot/l2update schema, just
        // delivered in 50ms batches instead of per-event.
        var sqCb = __NX._splitBaseQuote(symbol);
        var _cbBook = { a: {}, b: {} };
        __NX._obWs = _obWsConnect('wss://ws-feed.exchange.coinbase.com');
        __NX._obWs.onerror = function(ev) { console.error('[OB] coinbase ws error', ev); };
        __NX._obWs.onclose = function(ev) { console.error('[OB] coinbase ws closed', ev.code, ev.reason); };
        __NX._obWs.onopen = function() {
          try { __NX._obWs.send(JSON.stringify({type:'subscribe',product_ids:[sqCb.base+'-'+sqCb.quote],channels:['level2_batch']})); } catch(e){}
        };
        __NX._obWs.onmessage = function(ev) {
          try {
            if (myGen !== __NX._obGen) return; // stale socket from a previous pair/exchange — ignore
            var d = JSON.parse(ev.data);
            if (d.type === 'error') { console.error('[OB] coinbase subscribe error', d.message, d.reason); return; }
            if (d.type === 'snapshot') {
              _cbBook = { a:{}, b:{} };
              (d.asks||[]).forEach(function(r){ _cbBook.a[r[0]]=r[1]; });
              (d.bids||[]).forEach(function(r){ _cbBook.b[r[0]]=r[1]; });
            } else if (d.type === 'l2update') {
              (d.changes||[]).forEach(function(c){
                var side = c[0]==='sell' ? _cbBook.a : _cbBook.b;
                if (parseFloat(c[2])===0) delete side[c[1]]; else side[c[1]]=c[2];
              });
            } else return;
            __NX._obAsks = Object.entries(_cbBook.a).map(function(e){return [parseFloat(e[0]),parseFloat(e[1])];}).sort(function(a,b){return a[0]-b[0];}).slice(0,20);
            __NX._obBids = Object.entries(_cbBook.b).map(function(e){return [parseFloat(e[0]),parseFloat(e[1])];}).sort(function(a,b){return b[0]-a[0];}).slice(0,20);
            _obGotData();
          } catch(e) {}
        };
      } else if (exc.id === 'binance') {
        // Binance WebSocket (default fast path)
        __NX._obWs = _obWsConnect('wss://stream.binance.com:9443/ws/' + symLow + '@depth20@100ms');
        __NX._obWs.onmessage = function(ev) {
          try {
            if (myGen !== __NX._obGen) return; // stale socket from a previous pair/exchange — ignore
            var d = JSON.parse(ev.data);
            __NX._obAsks = (d.asks || []).slice(0,20).map(function(r){ return [parseFloat(r[0]), parseFloat(r[1])]; });
            __NX._obBids = (d.bids || []).slice(0,20).map(function(r){ return [parseFloat(r[0]), parseFloat(r[1])]; });
            _obGotData();
          } catch(e) {}
        };
        __NX._obWs.onerror = function() {};
      }
    } catch(e) {}
    // Auto-reconnect on disconnect for every exchange below — KuCoin is wired
    // inside _startKuCoinOrderBookWs() instead, since its socket is created
    // asynchronously (after the public bullet-token fetch resolves), so _obWs
    // isn't set yet at this point for that branch.
    if (__NX._obWs && exc.id !== 'kucoin') {
      _wireObReconnect(function(){ _obDispatchConnect(exc, symbol, symLow, myGen); }, myGen);
    }
  }

  function startOrderBook(symbol) {
    __NX.stopOrderBook();
    var exc = __NX.activeExc();
    symbol = symbol || __NX.state.activePair || 'BTCUSDT';
    var symLow = symbol.toLowerCase();

    // Without this, the previous pair's (or previous exchange's) bid/ask
    // rows stayed on screen — frozen, unrelated to the new symbol — for as
    // long as the new fetch took, or forever if the new fetch failed. That
    // looked exactly like "switching token doesn't do anything".
    __NX._obAsks = [];
    __NX._obBids = [];
    __NX.renderOrderBook();
    var _obAmtLabel = document.getElementById('exc-ob-amt-label');
    if (_obAmtLabel) _obAmtLabel.textContent = __NX._splitBaseQuote(symbol).base;
    __NX._obGen++;
    var myGen = __NX._obGen;

    _obDispatchConnect(exc, symbol, symLow, myGen);

    // Re-render when the order book containers actually settle to their
    // final height (handles the case where the panel was just switched to
    // `display:flex` and the first paint still reports a stale/zero height,
    // which previously caused the row count to be wrong and the list to
    // overflow its column instead of respecting it).
    try {
      if (typeof ResizeObserver !== 'undefined') {
        var asksEl = document.getElementById('exc-ob-asks');
        var bidsEl = document.getElementById('exc-ob-bids');
        __NX._obResizeObs = new ResizeObserver(function() {
          if (!__NX._obAnimFrame) __NX._obAnimFrame = requestAnimationFrame(__NX.renderOrderBook);
        });
        if (asksEl) __NX._obResizeObs.observe(asksEl);
        if (bidsEl) __NX._obResizeObs.observe(bidsEl);
      }
    } catch(e) {}
  }
})((window.__nxp = window.__nxp || {}).mod_exc_spot_engine = window.__nxp.mod_exc_spot_engine || {});
