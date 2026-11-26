// Futures: formatting helpers, HMAC signing and signedFetch for every exchange
// Part of the futures engine (FUT) module (split by topic; no logic change).
(function (__NX) {
  __NX.fmt = fmt;
  __NX.fmtP = fmtP;
  __NX.fmtV = fmtV;
  __NX._setSplitHeight = _setSplitHeight;
  __NX.getActiveExchangeId = getActiveExchangeId;
  __NX.getFutCfg = getFutCfg;
  __NX.getApiKeys = getApiKeys;
  __NX.signedFetch = signedFetch;
  __NX.toExSym = toExSym;


  function fmt(n, d) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  function fmtP(p) {
    if (p >= 10000) return p.toLocaleString('en-US',{minimumFractionDigits:1,maximumFractionDigits:1});
    if (p >= 1000)  return p.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
    if (p >= 1)     return p.toFixed(4);
    return p.toFixed(6);
  }
  function fmtV(v) {
    if (v >= 1000000) return (v/1000000).toFixed(2)+'M';
    if (v >= 1000)    return (v/1000).toFixed(1)+'K';
    if (v >= 1)       return v.toFixed(1);
    return v.toFixed(3);
  }

  function _setSplitHeight() {
    var split   = document.getElementById('fut-main-split');
    var futPanel= document.getElementById('exc-panel-future');
    if (!split || !futPanel) return;
    var panelH = futPanel.offsetHeight || window.innerHeight;
    var base   = panelH <= 680 ? 52 : panelH <= 800 ? 55 : panelH <= 900 ? 58 : 61;
    var tpslRows = document.getElementById('fut-tpsl-rows');
    var tpslOn   = tpslRows && tpslRows.style.display !== 'none';
    var pct      = Math.min(base + (tpslOn ? 10 : 0), 78);
    split.style.flexBasis = pct + '%';
  }

  // ── Get active exchange id from EXC state ──
  function getActiveExchangeId() {
    try {
      var s = window.EXC && window.EXC.getState && window.EXC.getState();
      return (s && s.activeExchange) || 'binance';
    } catch(e) { return 'binance'; }
  }

  // ── Get futures config for active exchange ──
  function getFutCfg() {
    var id = getActiveExchangeId();
    return __NX.FUT_EXCHANGES[id];
  }

  // ── Get API keys for the active exchange ──
  function getApiKeys() {
    try {
      var id = getActiveExchangeId();
      return window.EXC && window.EXC._getKeys && window.EXC._getKeys(id);
    } catch(e) { return null; }
  }

  // ── HMAC-SHA256 ──
  async function hmac(secret, msg) {
    var enc = new TextEncoder();
    var key = await crypto.subtle.importKey('raw', enc.encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
    var sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
    return Array.from(new Uint8Array(sig)).map(function(b){ return b.toString(16).padStart(2,'0'); }).join('');
  }

  // ── Base64 (for KuCoin) ──
  async function hmacBase64(secret, msg) {
    var enc = new TextEncoder();
    var key = await crypto.subtle.importKey('raw', enc.encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
    var sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
    return btoa(String.fromCharCode.apply(null, new Uint8Array(sig)));
  }

  // ── Signed fetch for each exchange ──
  async function signedFetch(cfg, endpoint, params, method, bodyObj) {
    var keys = getApiKeys();
    if (cfg.signType === 'coinbase_jwt') {
      if (!keys || !keys.cdpKeyName || !keys.cdpPem) throw new Error('Coinbase Futures needs a CDP API key — add it in the API key screen (CDP KEY NAME / CDP PRIVATE KEY fields)');
    } else if (!keys || !keys.apiKey) {
      throw new Error('No API keys for ' + getActiveExchangeId());
    }
    method = method || 'GET';
    var ts = String(Date.now());
    var url, headers = { 'Content-Type': 'application/json' };

    if (cfg.signType === 'binance') {
      params = params || {};
      params.timestamp = ts;
      params.recvWindow = 10000;
      var qs = Object.keys(params).map(function(k){ return k+'='+encodeURIComponent(params[k]); }).join('&');
      var sig = await hmac(keys.secret, qs);
      url = cfg.baseUrl + endpoint + '?' + qs + '&signature=' + sig;
      Object.assign(headers, cfg.authHeader(keys));
      var res = await _nxSignedFetch(url, { method: method, headers: headers, body: (method !== 'GET' && bodyObj) ? JSON.stringify(bodyObj) : undefined });
      return res.json();

    } else if (cfg.signType === 'bybit') {
      var recvWindow = '5000';
      // Bybit V5 requires the GET query string to be sorted alphabetically
      // by key before signing — without .sort() this only happened to work
      // when params already landed in alpha order; any other param order
      // (or an added param) produces a signature mismatch (retCode 10004).
      var qs = params ? Object.keys(params).sort().map(function(k){ return k+'='+encodeURIComponent(params[k]); }).join('&') : '';
      var bodyStr = (method !== 'GET' && bodyObj) ? JSON.stringify(bodyObj) : '';
      var sigStr = ts + keys.apiKey + recvWindow + (method === 'GET' ? qs : bodyStr);
      var sig = await hmac(keys.secret, sigStr);
      url = cfg.baseUrl + endpoint + (method === 'GET' && qs ? '?' + qs : '');
      Object.assign(headers, cfg.authHeader(keys, ts, sig, recvWindow));
      var res = await _nxSignedFetch(url, { method: method, headers: headers, body: method !== 'GET' ? bodyStr : undefined });
      return res.json();

    } else if (cfg.signType === 'bitget') {
      var isoTs = new Date().toISOString().replace(/\.\d{3}/, '.000');
      var qs = params ? '?' + Object.keys(params).map(function(k){ return k+'='+encodeURIComponent(params[k]); }).join('&') : '';
      var bodyStr = (method !== 'GET' && bodyObj) ? JSON.stringify(bodyObj) : '';
      var preSign = isoTs + method + endpoint + (method === 'GET' ? qs : '') + bodyStr;
      var sig = await hmacBase64(keys.secret, preSign);
      url = cfg.baseUrl + endpoint + (method === 'GET' ? qs : '');
      Object.assign(headers, cfg.authHeader(keys, isoTs, sig));
      var res = await _nxSignedFetch(url, { method: method, headers: headers, body: method !== 'GET' ? bodyStr : undefined });
      return res.json();

    } else if (cfg.signType === 'gateio') {
      var bodyStr = (method !== 'GET' && bodyObj) ? JSON.stringify(bodyObj) : '';
      var qs = params ? Object.keys(params).map(function(k){ return k+'='+encodeURIComponent(params[k]); }).join('&') : '';
      var hashBody = bodyStr ? await window.crypto.subtle.digest('SHA-512', new TextEncoder().encode(bodyStr)).then(function(b){ return Array.from(new Uint8Array(b)).map(function(x){return x.toString(16).padStart(2,'0');}).join(''); }) : 'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e';
      var preSign = method + '\n' + endpoint + (qs ? '?' + qs : '') + '\n' + qs + '\n' + hashBody + '\n' + ts;
      var sig = await hmac(keys.secret, preSign);
      url = cfg.baseUrl + endpoint + (qs ? '?' + qs : '');
      Object.assign(headers, cfg.authHeader(keys, ts, sig));
      var res = await _nxSignedFetch(url, { method: method, headers: headers, body: method !== 'GET' ? bodyStr : undefined });
      return res.json();

    } else if (cfg.signType === 'kucoin') {
      var qs = params ? '?' + Object.keys(params).map(function(k){ return k+'='+encodeURIComponent(params[k]); }).join('&') : '';
      var bodyStr = (method !== 'GET' && bodyObj) ? JSON.stringify(bodyObj) : '';
      var preSign = ts + method + endpoint + (method === 'GET' ? qs : '') + bodyStr;
      var sig = await hmacBase64(keys.secret, preSign);
      var ppSign = await hmacBase64(keys.secret, keys.passphrase||'');
      url = cfg.baseUrl + endpoint + (method === 'GET' ? qs : '');
      Object.assign(headers, cfg.authHeader(keys, ts, sig, ppSign));
      var res = await _nxSignedFetch(url, { method: method, headers: headers, body: method !== 'GET' ? bodyStr : undefined });
      return res.json();

    } else if (cfg.signType === 'mexc_contract') {
      var qs = params ? Object.keys(params).sort().map(function(k){ return k+'='+encodeURIComponent(params[k]); }).join('&') : '';
      var sigStr = keys.apiKey + ts + qs;
      var sig = await hmac(keys.secret, sigStr);
      url = cfg.baseUrl + endpoint + (qs ? '?' + qs : '');
      Object.assign(headers, cfg.authHeader(keys, ts));
      headers['Signature'] = sig;
      var res = await _nxSignedFetch(url, { method: method, headers: headers, body: method !== 'GET' ? JSON.stringify(bodyObj||{}) : undefined });
      return res.json();

    } else if (cfg.signType === 'bingx') {
      params = params || {};
      params.timestamp = ts;
      var qs = Object.keys(params).sort().map(function(k){ return k+'='+encodeURIComponent(params[k]); }).join('&');
      var sig = await hmac(keys.secret, qs);
      url = cfg.baseUrl + endpoint + '?' + qs + '&signature=' + sig;
      Object.assign(headers, cfg.authHeader(keys));
      var res = await _nxSignedFetch(url, { method: method, headers: headers, body: method !== 'GET' ? JSON.stringify(bodyObj||{}) : undefined });
      return res.json();

    } else if (cfg.signType === 'htx') {
      // HTX/Huobi Linear Swap signature
      var host = 'api.hbdm.com';
      var path = endpoint;
      var nonce = new Date().toISOString().replace(/\.\d{3}Z/,'');
      var qs = params ? Object.keys(params).sort().map(function(k){ return k+'='+encodeURIComponent(params[k]); }).join('&') : '';
      var preSign = method + '\n' + host + '\n' + path + '\n' + 'AccessKeyId='+encodeURIComponent(keys.apiKey)+'&SignatureMethod=HmacSHA256&SignatureVersion=2&Timestamp='+encodeURIComponent(nonce) + (qs ? '&'+qs : '');
      var sig = await hmac(keys.secret, preSign);
      var authQs = 'AccessKeyId='+encodeURIComponent(keys.apiKey)+'&SignatureMethod=HmacSHA256&SignatureVersion=2&Timestamp='+encodeURIComponent(nonce)+'&Signature='+encodeURIComponent(sig);
      url = cfg.baseUrl + endpoint + '?' + authQs + (qs ? '&'+qs : '');
      var res = await _nxSignedFetch(url, { method: method, headers: headers, body: method !== 'GET' ? JSON.stringify(bodyObj||{}) : undefined });
      return res.json();

    } else if (cfg.signType === 'phemex') {
      // Phemex: HMAC-SHA256(secret, path + queryStr + expiry + body)
      var expiry = String(parseInt(ts) + 60000);
      var qs = params ? Object.keys(params).sort().map(function(k){ return k+'='+encodeURIComponent(params[k]); }).join('&') : '';
      var bodyStr = (method !== 'GET' && bodyObj) ? JSON.stringify(bodyObj) : '';
      var preSign = endpoint + qs + expiry + bodyStr;
      var sig = await hmac(keys.secret, preSign);
      url = cfg.baseUrl + endpoint + (qs ? '?' + qs : '');
      Object.assign(headers, cfg.authHeader(keys, expiry, sig));
      var res = await _nxSignedFetch(url, { method: method, headers: headers, body: method !== 'GET' ? bodyStr : undefined });
      return res.json();

    } else if (cfg.signType === 'bitmart_fut') {
      // BitMart futures: HMAC-SHA256(secret, timestamp + '#' + memo + '#' + body_or_qs)
      var memo = keys.passphrase || '';
      var qs = params ? Object.keys(params).map(function(k){ return k+'='+encodeURIComponent(params[k]); }).join('&') : '';
      var bodyStr = (method !== 'GET' && bodyObj) ? JSON.stringify(bodyObj) : '';
      var signContent = ts + '#' + memo + '#' + (method !== 'GET' ? bodyStr : qs);
      var sig = await hmac(keys.secret, signContent);
      url = cfg.baseUrl + endpoint + (method === 'GET' && qs ? '?' + qs : '');
      Object.assign(headers, cfg.authHeader(keys, ts, sig));
      if (memo) headers['X-BM-MEMO'] = memo;
      var res = await _nxSignedFetch(url, { method: method, headers: headers, body: method !== 'GET' ? bodyStr : undefined });
      return res.json();

    } else if (cfg.signType === 'kraken_fut') {
      // Kraken Futures: SHA-256(postData + SHA-256(nonce + endpoint)) → base64
      var nonce = ts;
      var qs = params ? Object.keys(params).map(function(k){ return k+'='+encodeURIComponent(params[k]); }).join('&') : '';
      var bodyStr = (method !== 'GET' && bodyObj) ? Object.keys(bodyObj).map(function(k){ return k+'='+encodeURIComponent(bodyObj[k]); }).join('&') : '';
      var postData = method !== 'GET' ? bodyStr : qs;
      var enc = new TextEncoder();
      var innerHash = await crypto.subtle.digest('SHA-256', enc.encode(nonce + endpoint));
      var innerHex = Array.from(new Uint8Array(innerHash)).map(function(b){ return b.toString(16).padStart(2,'0'); }).join('');
      var keyBuf = await crypto.subtle.importKey('raw', enc.encode(keys.secret), {name:'HMAC',hash:'SHA-512'}, false, ['sign']);
      var sigBuf = await crypto.subtle.sign('HMAC', keyBuf, enc.encode(postData + innerHex));
      var sig = btoa(String.fromCharCode.apply(null, new Uint8Array(sigBuf)));
      url = cfg.baseUrl + endpoint + (method === 'GET' && qs ? '?' + qs : '');
      Object.assign(headers, cfg.authHeader(keys, nonce, sig));
      headers['Nonce'] = nonce;
      var res = await _nxSignedFetch(url, { method: method, headers: headers, body: method !== 'GET' ? bodyStr : undefined });
      return res.json();

    } else if (cfg.signType === 'digifinex') {
      // DigiFinex swap: HMAC-SHA256(secret, timestamp + method.upper() + endpoint + body_or_qs)
      var qs = params ? Object.keys(params).sort().map(function(k){ return k+'='+encodeURIComponent(params[k]); }).join('&') : '';
      var bodyStr = (method !== 'GET' && bodyObj) ? JSON.stringify(bodyObj) : '';
      var preSign = ts + method.toUpperCase() + endpoint + (method !== 'GET' ? bodyStr : (qs ? '?' + qs : ''));
      var sig = await hmac(keys.secret, preSign);
      url = cfg.baseUrl + endpoint + (method === 'GET' && qs ? '?' + qs : '');
      Object.assign(headers, cfg.authHeader(keys, ts, sig));
      var res = await _nxSignedFetch(url, { method: method, headers: headers, body: method !== 'GET' ? bodyStr : undefined });
      return res.json();

    } else if (cfg.signType === 'lbank_fut') {
      // LBank futures signing — rewritten 2026-06-20 to match official docs
      // (lbank.com/docs/contract.html). Previous version skipped the required
      // MD5-then-HMAC two-step and the echostr header entirely, so every
      // signed call (balance/order/positions) would have failed auth regardless
      // of endpoint correctness. NOT yet live-tested — verify with a read-only
      // balance call before relying on this for order placement.
      var echostr = Array.from({length: 35}, function(){
        return 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random()*62)];
      }).join('');
      var allParams = Object.assign({}, params || {}, bodyObj || {}, {
        api_key: keys.apiKey, signature_method: 'HmacSHA256', timestamp: ts, echostr: echostr
      });
      var signQs = Object.keys(allParams).sort().map(function(k){ return k + '=' + allParams[k]; }).join('&');
      var md5Upper = md5Hex(signQs).toUpperCase();
      var sig = await hmac(keys.secret, md5Upper);
      var sendParams = Object.assign({}, params || {}, bodyObj || {}, { api_key: keys.apiKey, sign: sig });
      var sendQs = Object.keys(sendParams).sort().map(function(k){ return k + '=' + encodeURIComponent(sendParams[k]); }).join('&');
      url = cfg.baseUrl + endpoint + (method === 'GET' ? '?' + sendQs : '');
      headers['timestamp'] = ts;
      headers['signature_method'] = 'HmacSHA256';
      headers['echostr'] = echostr;
      var bodyStr = method !== 'GET' ? JSON.stringify(sendParams) : undefined;
      var res = await _nxSignedFetch(url, { method: method, headers: headers, body: bodyStr });
      return res.json();

    } else if (cfg.signType === 'bitfinex_fut') {
      // Bitfinex v2: HMAC-SHA384(secret, '/api' + path + nonce + body)
      var nonce = (Date.now() * 1000).toString();
      var bodyStr = (method !== 'GET' && bodyObj) ? JSON.stringify(bodyObj) : '';
      var qs = params ? '?' + Object.keys(params).map(function(k){ return k+'='+encodeURIComponent(params[k]); }).join('&') : '';
      var pathWithQs = endpoint + (method === 'GET' ? qs : '');
      var preSign = '/api' + pathWithQs + nonce + bodyStr;
      var enc = new TextEncoder();
      var keyBuf = await crypto.subtle.importKey('raw', enc.encode(keys.secret), {name:'HMAC',hash:'SHA-384'}, false, ['sign']);
      var sigBuf = await crypto.subtle.sign('HMAC', keyBuf, enc.encode(preSign));
      var sig = Array.from(new Uint8Array(sigBuf)).map(function(b){ return b.toString(16).padStart(2,'0'); }).join('');
      url = cfg.baseUrl + pathWithQs;
      Object.assign(headers, cfg.authHeader(keys, nonce, sig));
      var res = await _nxSignedFetch(url, { method: method, headers: headers, body: method !== 'GET' ? bodyStr : undefined });
      return res.json();

    } else if (cfg.signType === 'coinbase_jwt') {
      // CDP JWT bearer auth — no query-string signing, no apiKey/secret HMAC.
      // GET requests pass params as a query string; POST/etc send bodyObj as JSON.
      var qs = (method === 'GET' && params) ? '?' + Object.keys(params).map(function(k){ return k+'='+encodeURIComponent(params[k]); }).join('&') : '';
      var fullPath = endpoint + qs;
      var jwt = await __NX._coinbaseBuildJwt(keys, method, 'api.coinbase.com', endpoint); // uri claim excludes query string per CDP docs
      headers['Authorization'] = 'Bearer ' + jwt;
      url = cfg.baseUrl + fullPath;
      var res = await _nxSignedFetch(url, { method: method, headers: headers, body: (method !== 'GET' && bodyObj) ? JSON.stringify(bodyObj) : undefined });
      return res.json();

    }

    throw new Error('Unknown sign type');
  }

  // ── Convert symbol to exchange format ──
  function toExSym(sym, cfg) {
    // sym is like BTCUSDT, ETHUSDT etc
    if (!cfg) return sym; // defensive: exchange has no futures config
    var bases = ['BTC','ETH','SOL','BNB','XRP','ADA','AVAX','MATIC','DOGE','DOT','LINK','UNI','LTC','BCH','ETC','ATOM','ALGO','NEAR','FTM','SAND','MANA','APE','OP','ARB','SUI','SEI','INJ','TIA','JUP','WIF','BONK','PEPE'];
    var base = sym.replace(/USDT$|USDC$|BUSD$/, '');
    var quote = sym.slice(base.length) || 'USDT';
    return cfg.symFormat(base, quote);
  }

  // ── Build display symbol label ──
  function buildDisplaySym(sym) {
    var base = sym.replace(/USDT$|USDC$|BUSD$/, '');
    return base + '/USDT PERP';
  }
})((window.__nxp = window.__nxp || {}).mod_fut_futures_engine = window.__nxp.mod_fut_futures_engine || {});
