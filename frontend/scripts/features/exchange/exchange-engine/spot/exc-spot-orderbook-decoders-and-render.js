// Order book decoders (gzip/inflate/protobuf), KuCoin/MEXC feeds and render
// Part of the exchange spot engine (window.EXC) module (split by topic; no logic change).
(function (__NX) {
  __NX._splitBaseQuote = _splitBaseQuote;
  __NX._showOrderBookFailMessage = _showOrderBookFailMessage;
  __NX._gunzipJsonOb = _gunzipJsonOb;
  __NX._inflateJsonOb = _inflateJsonOb;
  __NX._startKuCoinOrderBookWs = _startKuCoinOrderBookWs;
  __NX._startMexcOrderBookWs = _startMexcOrderBookWs;
  __NX.stopOrderBook = stopOrderBook;
  __NX.renderOrderBook = renderOrderBook;


  // Quote assets ordered longest-first so the correct suffix is matched
  // (chained .replace() calls used to strip "BTC"/"ETH" from ANYWHERE in the
  // string, which collapsed BTCUSDT/ETHUSDT to an empty base -> "-USDT",
  // an invalid KuCoin symbol that silently failed every request).
  var _QUOTE_ASSETS = ['FDUSD','BUSD','USDT','USDC','DAI','TRY','EUR','BRL','BTC','ETH'];
  function _splitBaseQuote(symbol) {
    for (var i = 0; i < _QUOTE_ASSETS.length; i++) {
      var q = _QUOTE_ASSETS[i];
      if (symbol.length > q.length && symbol.slice(-q.length) === q) {
        return { base: symbol.slice(0, -q.length), quote: q };
      }
    }
    return { base: symbol, quote: 'USDT' };
  }

  function _showOrderBookFailMessage() {
    var asksEl = document.getElementById('exc-ob-asks');
    var bidsEl = document.getElementById('exc-ob-bids');
    if (asksEl) asksEl.innerHTML = '<div style="padding:16px 6px;text-align:center;font-size:10px;color:var(--text-muted);font-family:var(--font-mono);">Order book unavailable — retrying…</div>';
    if (bidsEl) bidsEl.innerHTML = '';
  }

  // ── Gzip decompress helper for binary WS frames (HTX/BingX spot) using native browser DecompressionStream ──
  function _gunzipJsonOb(data) {
    try {
      var buf = (data instanceof ArrayBuffer) ? data : null;
      if (!buf) return Promise.resolve(null);
      if (typeof DecompressionStream === 'undefined') return Promise.resolve(null);
      var ds = new DecompressionStream('gzip');
      var stream = new Blob([buf]).stream().pipeThrough(ds);
      return new Response(stream).text().then(function(txt){ try { return JSON.parse(txt); } catch(e){ return null; } });
    } catch(e) { return Promise.resolve(null); }
  }

  // ── Deflate decompress helper for binary WS frames (DigiFinex spot) using native browser DecompressionStream ──
  function _inflateJsonOb(data) {
    try {
      var buf = (data instanceof ArrayBuffer) ? data : null;
      if (!buf) return Promise.resolve(null);
      if (typeof DecompressionStream === 'undefined') return Promise.resolve(null);
      var ds = new DecompressionStream('deflate');
      var stream = new Blob([buf]).stream().pipeThrough(ds);
      return new Response(stream).text().then(function(txt){ try { return JSON.parse(txt); } catch(e){ return null; } });
    } catch(e) { return Promise.resolve(null); }
  }

  // ── Minimal generic protobuf wire-format reader (MEXC binary WS frames) ──
  // MEXC's depth channel pushes PushDataV3ApiWrapper messages (see schema at
  // https://github.com/mexcdevelop/websocket-proto) encoded as raw protobuf,
  // not JSON. Rather than pull in protobuf.js for the handful of fields we
  // actually need, this reads every field into {fieldNumber: [rawBytes...]}
  // generically — callers then pick out known field numbers (per the
  // published .proto files) and decide how to interpret each one.
  function _pbVarint(buf, pos) {
    var result = 0, shift = 1, b;
    do {
      b = buf[pos++];
      result += (b & 0x7f) * shift;
      shift *= 128;
    } while (b & 0x80);
    return [result, pos];
  }
  function _pbFields(buf) {
    var pos = 0, len = buf.length, fields = {};
    while (pos < len) {
      var tagRes = _pbVarint(buf, pos); pos = tagRes[1];
      var fieldNum = tagRes[0] >>> 3;
      var wireType = tagRes[0] & 7;
      var val;
      if (wireType === 0) { // varint
        var vRes = _pbVarint(buf, pos); pos = vRes[1]; val = vRes[0];
      } else if (wireType === 2) { // length-delimited (string / bytes / nested message)
        var lRes = _pbVarint(buf, pos); pos = lRes[1];
        val = buf.slice(pos, pos + lRes[0]); pos += lRes[0];
      } else if (wireType === 1) { // 64-bit fixed
        val = buf.slice(pos, pos + 8); pos += 8;
      } else if (wireType === 5) { // 32-bit fixed
        val = buf.slice(pos, pos + 4); pos += 4;
      } else {
        break; // unsupported wire type (e.g. deprecated groups) — bail rather than misread the rest
      }
      if (!fields[fieldNum]) fields[fieldNum] = [];
      fields[fieldNum].push(val);
    }
    return fields;
  }
  function _pbUtf8(bytes) {
    try { return new TextDecoder().decode(bytes); } catch(e) { return ''; }
  }

  function _startKuCoinOrderBookWs(symbol, myGen) {
    // Public bullet token — no API key needed, this is the exact flow
    // KuCoin's own SDK/web widgets use to open a public WS from a browser.
    var sq = _splitBaseQuote(symbol);
    var kcSym = sq.base + '-' + sq.quote;
    (__NX._nxSignedFetch ? __NX._nxSignedFetch('https://api.kucoin.com/api/v1/bullet-public', { method: 'POST' }) : fetch('https://api.kucoin.com/api/v1/bullet-public', { method: 'POST' }))
      .then(function(r){ return r.json(); })
      .then(function(d){
        if (myGen !== __NX._obGen) return; // user already switched pair/exchange — drop this stale connect attempt
        var token = d && d.data && d.data.token;
        var server = d && d.data && d.data.instanceServers && d.data.instanceServers[0];
        if (!token || !server) throw new Error('no kucoin ws token');
        var pingMs = server.pingInterval || 18000;
        __NX._obWs = __NX._obWsConnect(server.endpoint + '?token=' + token + '&connectId=nx' + Date.now());
        __NX._obWs.onopen = function() {
          try {
            __NX._obWs.send(JSON.stringify({ id: String(Date.now()), type: 'subscribe', topic: '/spotMarket/level2Depth50:' + kcSym, response: true }));
            __NX._obPing = setInterval(function(){ try{ __NX._obWs.send(JSON.stringify({ id: String(Date.now()), type: 'ping' })); }catch(e){} }, pingMs);
          } catch(e) {}
        };
        __NX._obWs.onclose = function(){ if(__NX._obPing){clearInterval(__NX._obPing);__NX._obPing=null;} };
        __NX._obWs.onmessage = function(ev) {
          try {
            if (myGen !== __NX._obGen) return; // stale socket from a previous pair/exchange — ignore
            var msg = JSON.parse(ev.data);
            if (msg.type !== 'message' || msg.subject !== 'level2' || !msg.data) return;
            var book = msg.data;
            __NX._obAsks = (book.asks||[]).slice(0,20).map(function(r){ return [parseFloat(r[0]), parseFloat(r[1])]; });
            __NX._obBids = (book.bids||[]).slice(0,20).map(function(r){ return [parseFloat(r[0]), parseFloat(r[1])]; });
            __NX._obGotData();
          } catch(e) {}
        };
        __NX._obWs.onerror = function() {};
        // Reconnect (with backoff) if this socket drops later — same mechanism
        // every other exchange below gets via _obDispatchConnect.
        __NX._wireObReconnect(function(){ _startKuCoinOrderBookWs(symbol, myGen); }, myGen);
      })
      .catch(function(){
        // Bullet-token fetch itself failed (e.g. transient network drop) — retry
        // with backoff instead of giving up after a single attempt.
        __NX._obScheduleReconnect(function(){ _startKuCoinOrderBookWs(symbol, myGen); }, myGen);
      });
  }

  function _startMexcOrderBookWs(symbol, myGen) {
    __NX._obWs = __NX._obWsConnect('wss://wbs-api.mexc.com/ws');
    __NX._obWs.binaryType = 'arraybuffer';
    __NX._obWs.onopen = function() {
      try {
        __NX._obWs.send(JSON.stringify({ method: 'SUBSCRIPTION', params: ['spot@public.limit.depth.v3.api.pb@' + symbol + '@20'] }));
        __NX._obPing = setInterval(function(){ try{ __NX._obWs.send(JSON.stringify({ method: 'PING' })); }catch(e){} }, 20000);
      } catch(e) {}
    };
    __NX._obWs.onclose = function(){ if(__NX._obPing){clearInterval(__NX._obPing);__NX._obPing=null;} };
    __NX._obWs.onmessage = function(ev) {
      try {
        if (myGen !== __NX._obGen) return; // stale socket from a previous pair/exchange — ignore
        if (typeof ev.data === 'string') return; // subscribe ack / pong — control frames stay JSON, only depth pushes are protobuf
        var top = _pbFields(new Uint8Array(ev.data));
        var ld = top[303]; // PushDataV3ApiWrapper.publicLimitDepths
        if (!ld || !ld.length) return;
        var inner = _pbFields(ld[0]); // PublicLimitDepthsV3Api
        function pbLevel(b) {
          var f = _pbFields(b);
          var price = f[1] && f[1][0] ? _pbUtf8(f[1][0]) : '0';
          var qty = f[2] && f[2][0] ? _pbUtf8(f[2][0]) : '0';
          return [parseFloat(price), parseFloat(qty)];
        }
        __NX._obAsks = (inner[1] || []).slice(0,20).map(pbLevel);
        __NX._obBids = (inner[2] || []).slice(0,20).map(pbLevel);
        __NX._obGotData();
      } catch(e) {}
    };
    __NX._obWs.onerror = function() {};
  }

  function stopOrderBook() {
    if (__NX._obWs) { try { __NX._obWs.onclose = null; __NX._obWs.onmessage = null; __NX._obWs.close(); } catch(e) {} __NX._obWs = null; }
    if (__NX._obPing) { clearInterval(__NX._obPing); __NX._obPing = null; }
    if (__NX._obAnimFrame) { cancelAnimationFrame(__NX._obAnimFrame); __NX._obAnimFrame = null; }
    if (__NX._obResizeObs) { try { __NX._obResizeObs.disconnect(); } catch(e) {} __NX._obResizeObs = null; }
    if (__NX._obReconnectTimer) { clearTimeout(__NX._obReconnectTimer); __NX._obReconnectTimer = null; }
    __NX._obReconnectAttempts = 0;
    __NX._obGen++; // invalidate any in-flight KuCoin bullet-token fetch / pending auto-reconnect
  }

  function renderOrderBook() {
    __NX._obAnimFrame = null;
    var asksEl = document.getElementById('exc-ob-asks');
    var bidsEl = document.getElementById('exc-ob-bids');
    var midEl  = document.getElementById('exc-ob-mid');
    var midUsd = document.getElementById('exc-ob-mid-usd');
    var dBuy   = document.getElementById('exc-depth-buy');
    var dSell  = document.getElementById('exc-depth-sell');
    var dBuyPct= document.getElementById('exc-depth-buy-pct');
    var dSellPct=document.getElementById('exc-depth-sell-pct');
    if (!asksEl || !bidsEl) return;

    var maxVol = 0;
    __NX._obAsks.forEach(function(r){ if(r[1]>maxVol) maxVol=r[1]; });
    __NX._obBids.forEach(function(r){ if(r[1]>maxVol) maxVol=r[1]; });

    function fmtVol(v) {
      if (v >= 1000) return (v/1000).toFixed(2)+'K';
      if (v >= 1) return v.toFixed(3);
      return v.toFixed(6);
    }
    function fmtPrice(p) {
      if (p >= 1000) return p.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
      if (p >= 1) return p.toFixed(4);
      return p.toFixed(6);
    }

    // Dynamically size row count to fill the full available height (like Binance),
    // instead of a fixed 8 rows that leaves blank space on taller screens.
    // Falls back to 0 rows (rather than guessing a height) if the container
    // hasn't been laid out yet — the ResizeObserver in startOrderBook() will
    // trigger a re-render once it has a real height, so we never render more
    // rows than the column can actually hold.
    var ROW_H = 17;
    var asksH = asksEl.clientHeight;
    var bidsH = bidsEl.clientHeight;
    var asksRowCount = asksH ? Math.max(1, Math.floor(asksH / ROW_H)) : 0;
    var bidsRowCount = bidsH ? Math.max(1, Math.floor(bidsH / ROW_H)) : 0;

    // Asks (sells) — lowest ask at bottom, so reverse before rendering
    var askRows = __NX._obAsks.slice(0, asksRowCount).reverse();
    asksEl.innerHTML = askRows.map(function(r) {
      var pct = maxVol ? (r[1]/maxVol*100) : 0;
      return '<div onclick="excFillPrice('+r[0]+')" style="position:relative;display:flex;align-items:center;justify-content:space-between;padding:0 6px;height:17px;box-sizing:border-box;cursor:pointer;-webkit-tap-highlight-color:transparent;">'
        +'<div style="position:absolute;right:0;top:0;bottom:0;background:rgba(246,70,93,0.13);width:'+pct.toFixed(1)+'%;pointer-events:none;"></div>'
        +'<span style="font-size:9px;font-weight:600;color:#f6465d;font-family:var(--font-mono);position:relative;white-space:nowrap;">'+fmtPrice(r[0])+'</span>'
        +'<span style="font-size:9px;color:rgba(255,255,255,0.45);font-family:var(--font-mono);position:relative;white-space:nowrap;">'+fmtVol(r[1])+'</span>'
        +'</div>';
    }).join('');

    // Bids (buys) — best bid at top
    var bidRows = __NX._obBids.slice(0, bidsRowCount);
    bidsEl.innerHTML = bidRows.map(function(r) {
      var pct = maxVol ? (r[1]/maxVol*100) : 0;
      return '<div onclick="excFillPrice('+r[0]+')" style="position:relative;display:flex;align-items:center;justify-content:space-between;padding:0 6px;height:17px;box-sizing:border-box;cursor:pointer;-webkit-tap-highlight-color:transparent;">'
        +'<div style="position:absolute;right:0;top:0;bottom:0;background:rgba(14,203,129,0.13);width:'+pct.toFixed(1)+'%;pointer-events:none;"></div>'
        +'<span style="font-size:9px;font-weight:600;color:#0ecb81;font-family:var(--font-mono);position:relative;white-space:nowrap;">'+fmtPrice(r[0])+'</span>'
        +'<span style="font-size:9px;color:rgba(255,255,255,0.45);font-family:var(--font-mono);position:relative;white-space:nowrap;">'+fmtVol(r[1])+'</span>'
        +'</div>';
    }).join('');

    // Mid price
    var bestAsk = __NX._obAsks.length ? __NX._obAsks[0][0] : 0;
    var bestBid = __NX._obBids.length ? __NX._obBids[0][0] : 0;
    var mid = bestBid || bestAsk;
    if (midEl && mid) midEl.textContent = fmtPrice(mid);
    if (midUsd && mid) midUsd.textContent = '≈ $' + mid.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});

    // Depth bar
    var totalBuy  = __NX._obBids.reduce(function(s,r){ return s+r[0]*r[1]; }, 0);
    var totalSell = __NX._obAsks.reduce(function(s,r){ return s+r[0]*r[1]; }, 0);
    var total = totalBuy + totalSell;
    if (total > 0 && dBuy && dSell) {
      var buyPct = (totalBuy/total*100).toFixed(0);
      dBuy.style.width = buyPct + '%';
      if (dBuyPct) dBuyPct.textContent = buyPct + '%';
      if (dSellPct) dSellPct.textContent = (100-parseInt(buyPct)) + '%';
    }
  }
})((window.__nxp = window.__nxp || {}).mod_exc_spot_engine = window.__nxp.mod_exc_spot_engine || {});
