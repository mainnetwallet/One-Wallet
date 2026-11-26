// Per-exchange signed fetch helpers and JSON fetch fallback
// Part of the exchange spot engine (window.EXC) module (split by topic; no logic change).
(function (__NX) {
  __NX.bitmartFetch = bitmartFetch;
  __NX.bitgetFetch = bitgetFetch;
  __NX.krakenFetch = krakenFetch;
  __NX.gateioFetch = gateioFetch;
  __NX.coinbaseFetch = coinbaseFetch;
  __NX.bingxFetch = bingxFetch;
  __NX.htxFetch = htxFetch;
  __NX.phemexFetch = phemexFetch;
  __NX.digifinexFetch = digifinexFetch;
  __NX.lbankFetch = lbankFetch;
  __NX.bitfinexFetch = bitfinexFetch;
  __NX.fetchJsonWithFallback = fetchJsonWithFallback;
  __NX.oneDataFetch = oneDataFetch;


  // ── BitMart signed request ──
  async function bitmartFetch(endpoint, params, keys, method, excOverride) {
    method = method || 'GET';
    params = params || {};
    var ts = Date.now().toString();
    var isGet = method === 'GET';
    var qs = isGet ? Object.keys(params).map(function(k) { return k+'='+encodeURIComponent(params[k]); }).join('&') : '';
    var bodyStr = isGet ? '' : JSON.stringify(params);
    var signStr = ts + '#' + (keys.passphrase||'') + '#' + (isGet ? qs : bodyStr);
    var sig = await __NX.hmacSha256(keys.secret, signStr);
    var url = (excOverride || __NX.activeExc()).baseUrl + endpoint + (isGet && qs ? '?' + qs : '');
    var res = await __NX._nxSignedFetch(url, {
      method: method,
      headers: { 'X-BM-KEY': keys.apiKey, 'X-BM-SIGN': sig, 'X-BM-TIMESTAMP': ts, 'Content-Type': 'application/json' },
      body: isGet ? undefined : bodyStr
    });
    return res.json();
  }

  // ── Bitget signed request ──
  async function bitgetFetch(endpoint, params, keys, method, excOverride) {
    method = method || 'GET';
    params = params || {};
    var ts = Date.now().toString();
    var isGet = method === 'GET';
    var qs = isGet ? Object.keys(params).map(function(k) { return k+'='+encodeURIComponent(params[k]); }).join('&') : '';
    var bodyStr = isGet ? '' : JSON.stringify(params);
    var path_ = endpoint + (isGet && qs ? '?' + qs : '');
    var sig = await __NX.hmacSha256B64(keys.secret, ts + method + path_ + bodyStr);
    var url = (excOverride || __NX.activeExc()).baseUrl + path_;
    var res = await __NX._nxSignedFetch(url, {
      method: method,
      headers: { 'ACCESS-KEY': keys.apiKey, 'ACCESS-SIGN': sig, 'ACCESS-TIMESTAMP': ts, 'ACCESS-PASSPHRASE': keys.passphrase||'', 'Content-Type': 'application/json' },
      body: isGet ? undefined : bodyStr
    });
    return res.json();
  }

  // ── Kraken signed request (nonce-based, secret is base64) ──
  var _krakenNonceBump = 0;
  async function krakenFetch(endpoint, params, keys) {
    params = params || {};
    var nonce = (Date.now() * 1000 + (_krakenNonceBump++ % 1000)).toString();
    params.nonce = nonce;
    var postdata = Object.keys(params).map(function(k) { return k+'='+encodeURIComponent(params[k]); }).join('&');
    var digest = await __NX.sha256DigestBytes(nonce + postdata);
    var pathBytes = new TextEncoder().encode(endpoint);
    var combined = new Uint8Array(pathBytes.length + digest.length);
    combined.set(pathBytes, 0); combined.set(digest, pathBytes.length);
    var sig = await __NX.hmacSha512B64RawSecret(keys.secret, combined);
    var res = await __NX._nxSignedFetch((__NX.activeExc()).baseUrl + endpoint, {
      method: 'POST',
      headers: { 'API-Key': keys.apiKey, 'API-Sign': sig, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: postdata
    });
    return res.json();
  }

  // ── Gate.io signed request ──
  async function gateioFetch(endpoint, params, keys, method, excOverride) {
    method = method || 'GET';
    params = params || {};
    var isGet = method === 'GET' || method === 'DELETE';
    var qs = isGet ? Object.keys(params).map(function(k) { return k+'='+encodeURIComponent(params[k]); }).join('&') : '';
    var bodyStr = isGet ? '' : JSON.stringify(params);
    var ts = Math.floor(Date.now()/1000).toString();
    var bodyHash = await __NX.sha512Hex(bodyStr);
    var signStr = method + "\n" + endpoint + "\n" + qs + "\n" + bodyHash + "\n" + ts;
    var sig = await __NX.hmacSha512Hex(keys.secret, signStr);
    var url = (excOverride || __NX.activeExc()).baseUrl + endpoint + (qs ? '?' + qs : '');
    var res = await __NX._nxSignedFetch(url, {
      method: method,
      headers: { 'KEY': keys.apiKey, 'SIGN': sig, 'Timestamp': ts, 'Content-Type': 'application/json' },
      body: isGet ? undefined : bodyStr
    });
    return res.json();
  }

  // ── Coinbase Exchange (legacy/institutional HMAC API) signed request ──
  async function coinbaseFetch(endpoint, params, keys, method, body, excOverride) {
    method = method || 'GET';
    var isGet = method === 'GET' || method === 'DELETE';
    var qs = isGet && params ? '?' + Object.keys(params).map(function(k) { return k+'='+encodeURIComponent(params[k]); }).join('&') : '';
    var bodyStr = !isGet && body ? JSON.stringify(body) : '';
    var ts = Math.floor(Date.now()/1000).toString();
    var sig = await __NX.hmacSha256B64RawSecret(keys.secret, ts + method + endpoint + qs + bodyStr);
    var url = (excOverride || __NX.activeExc()).baseUrl + endpoint + qs;
    var res = await __NX._nxSignedFetch(url, {
      method: method,
      headers: { 'CB-ACCESS-KEY': keys.apiKey, 'CB-ACCESS-SIGN': sig, 'CB-ACCESS-TIMESTAMP': ts, 'CB-ACCESS-PASSPHRASE': keys.passphrase||'', 'Content-Type': 'application/json' },
      body: bodyStr || undefined
    });
    return res.json();
  }

  // ── BingX signed request (Binance-style) ──
  async function bingxFetch(endpoint, params, keys, method, excOverride) {
    method = method || 'GET';
    params = params || {};
    params.timestamp = Date.now();
    var qs = Object.keys(params).map(function(k) { return k+'='+encodeURIComponent(params[k]); }).join('&');
    var sig = await __NX.hmacSha256(keys.secret, qs);
    var isGetBx = method === 'GET' || method === 'DELETE';
    var url = (excOverride || __NX.activeExc()).baseUrl + endpoint + '?' + qs + '&signature=' + sig;
    var res = await __NX._nxSignedFetch(url, { method: method, headers: { 'X-BX-APIKEY': keys.apiKey, 'Content-Type': 'application/json' }, body: isGetBx ? undefined : JSON.stringify(params) });
    return res.json();
  }

  // ── HTX (Huobi) signed request (signature lives in the query string) ──
  async function htxFetch(endpoint, params, keys, method, excOverride) {
    method = method || 'GET';
    params = params || {};
    var exc = excOverride || __NX.activeExc();
    var host = exc.baseUrl.replace(/^https?:\/\//,'');
    var ts = new Date().toISOString().slice(0,19);
    var allParams = Object.assign({}, params, {
      AccessKeyId: keys.apiKey, SignatureMethod: 'HmacSHA256', SignatureVersion: '2', Timestamp: ts
    });
    var sortedKeys = Object.keys(allParams).sort();
    var qs = sortedKeys.map(function(k) { return encodeURIComponent(k)+'='+encodeURIComponent(allParams[k]); }).join('&');
    var signStr = method + "\n" + host + "\n" + endpoint + "\n" + qs;
    var sig = await __NX.hmacSha256B64(keys.secret, signStr);
    var url = exc.baseUrl + endpoint + '?' + qs + '&Signature=' + encodeURIComponent(sig);
    var res = await __NX._nxSignedFetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'POST' ? JSON.stringify(params) : undefined
    });
    return res.json();
  }


  // ── Phemex signed request (prices/quantities are scaled integers, Ep/Ev ×1e8) ──
  var PHEMEX_SCALE = 1e8; __NX.PHEMEX_SCALE = PHEMEX_SCALE;
  async function phemexFetch(endpoint, params, keys, method, excOverride) {
    method = method || 'GET';
    params = params || {};
    var isGet = method === 'GET' || method === 'DELETE';
    var qs = isGet ? Object.keys(params).map(function(k) { return k+'='+encodeURIComponent(params[k]); }).join('&') : '';
    var bodyStr = isGet ? '' : JSON.stringify(params);
    var expiry = Math.floor(Date.now()/1000) + 60;
    var sig = await __NX.hmacSha256(keys.secret, endpoint + qs + expiry + bodyStr);
    var url = (excOverride || __NX.activeExc()).baseUrl + endpoint + (qs ? '?' + qs : '');
    var res = await __NX._nxSignedFetch(url, {
      method: method,
      headers: { 'x-phemex-access-token': keys.apiKey, 'x-phemex-request-signature': sig, 'x-phemex-request-expiry': expiry.toString(), 'Content-Type': 'application/json' },
      body: isGet ? undefined : bodyStr
    });
    return res.json();
  }

  // ── DigiFinex signed request ──
  async function digifinexFetch(endpoint, params, keys, method, excOverride) {
    method = method || 'GET';
    params = params || {};
    var ts = Math.floor(Date.now()/1000).toString();
    var isGet = method === 'GET';
    var qs = Object.keys(params).map(function(k) { return k+'='+encodeURIComponent(params[k]); }).join('&');
    var sig = await __NX.hmacSha256(keys.secret, qs);
    var url = (excOverride || __NX.activeExc()).baseUrl + endpoint + (qs ? '?' + qs : '');
    var res = await __NX._nxSignedFetch(url, {
      method: method,
      headers: { 'ACCESS-KEY': keys.apiKey, 'ACCESS-SIGN': sig, 'ACCESS-TIMESTAMP': ts, 'Content-Type': isGet ? 'application/x-www-form-urlencoded' : 'application/x-www-form-urlencoded' },
      body: isGet ? undefined : qs
    });
    return res.json();
  }

  // ── LBank signed request (MD5 digest, then HMAC-SHA256 of that digest) ──
  function _lbankEchostr() {
    var chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    var s = ''; for (var i=0;i<35;i++) s += chars[Math.floor(Math.random()*chars.length)];
    return s;
  }
  async function lbankFetch(endpoint, params, keys) {
    params = params || {};
    var allParams = Object.assign({}, params, {
      api_key: keys.apiKey, signature_method: 'HmacSHA256', timestamp: Date.now().toString(), echostr: _lbankEchostr()
    });
    var sortedKeys = Object.keys(allParams).sort();
    var qs = sortedKeys.map(function(k) { return k+'='+allParams[k]; }).join('&');
    var md5Digest = __NX.md5Hex(qs).toUpperCase();
    var sign = await __NX.hmacSha256(keys.secret, md5Digest);
    allParams.sign = sign;
    var bodyStr = Object.keys(allParams).map(function(k) { return encodeURIComponent(k)+'='+encodeURIComponent(allParams[k]); }).join('&');
    var res = await __NX._nxSignedFetch((__NX.activeExc()).baseUrl + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: bodyStr
    });
    return res.json();
  }

  // ── Bitfinex signed request (v2 auth) ──
  async function bitfinexFetch(endpoint, params, keys) {
    params = params || {};
    var nonce = (Date.now() * 1000).toString();
    var bodyStr = JSON.stringify(params);
    var sig = await __NX.hmacSha384Hex(keys.secret, '/api/' + endpoint + nonce + bodyStr);
    var res = await __NX._nxSignedFetch((__NX.activeExc()).baseUrl + endpoint, {
      method: 'POST',
      headers: { 'bfx-apikey': keys.apiKey, 'bfx-nonce': nonce, 'bfx-signature': sig, 'Content-Type': 'application/json' },
      body: bodyStr
    });
    return res.json();
  }

  async function fetchJsonWithFallback(url, ms) {
    ms = ms || 15000;

    // Strategy: native Android bridge first → direct fetch fallback.
    // Native requests run through Android's HTTP stack (no CORS).
    function _validateExcBody(json) {
      if (json && !Array.isArray(json) && typeof json.code !== 'undefined' &&
          typeof json.msg === 'string') {
        var codeStr = String(json.code);
        var msgLower = json.msg.toLowerCase();
        var looksSuccess = codeStr === '0' || codeStr === '00000' || codeStr === '200000' ||
          msgLower === 'success' || msgLower === 'ok' || msgLower === '';
        if (!looksSuccess) {
          throw new Error('API error ' + json.code + ': ' + json.msg);
        }
      }
      return json;
    }

    // 1. Try native Android bridge
    try {
      var nativeJson = await __NX.nxBridgeGet(url, ms);
      return _validateExcBody(nativeJson);
    } catch (nativeErr) {
      console.warn('[fetchJson] native bridge failed (' + url + '): ' + (nativeErr && nativeErr.message));
    }

    // 2. Direct fetch fallback
    var _res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(ms) });
    if (!_res.ok) throw new Error('fetchJsonWithFallback: HTTP ' + _res.status + ' for ' + url);
    var _json = await _res.json();
    return _validateExcBody(_json);
  }

  // ── Public market data (no auth) ── native bridge first, direct fetch fallback.
  // `label` is just for console logging (e.g. exchange id).
  async function oneDataFetch(url, ms, label) {
    label = label || 'EXC';
    try {
      var r = await fetchJsonWithFallback(url, ms);
      console.log('[' + label + '] native bridge OK');
      return r;
    } catch (nativeErr) {
      console.warn('[' + label + '] native bridge failed: ' + (nativeErr && nativeErr.message));
      throw nativeErr;
    }
  }
})((window.__nxp = window.__nxp || {}).mod_exc_spot_engine = window.__nxp.mod_exc_spot_engine || {});
