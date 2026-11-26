// Deposit modal: per-exchange deposit address fetchers
// Part of the exchange deposit modal module (split by topic; no logic change).
(function (__NX) {
  __NX._fetchExcDepositAddr = _fetchExcDepositAddr;
  __NX._hmac256 = _hmac256;
  __NX._hmac256b64 = _hmac256b64;
  __NX._hmac512hex = _hmac512hex;
  __NX._sha512hex = _sha512hex;


  // ── Fetch deposit address from exchange API ──
  async function _fetchExcDepositAddr(excId, sym, netApiCode) {
    try {
      var keys = null;

      if (window.EXC && typeof EXC._getKeys === 'function') {
        keys = EXC._getKeys(excId);
      } else {
        // Read directly from localStorage (same KEY_STORE as EXC)
        try { var _ks = JSON.parse(localStorage.getItem('one_exc_keys_v1') || '{}'); keys = _ks[excId] || null; } catch(e){}
      }
      if (!keys || !keys.apiKey || !keys.secret) return null;

      if (excId === 'binance') {
        return await _binDepAddr(sym, netApiCode, keys);
      } else if (excId === 'bybit') {
        return await _bybitDepAddr(sym, netApiCode, keys);
      } else if (excId === 'kucoin') {
        return await _kucoinDepAddr(sym, netApiCode, keys);
      } else if (excId === 'mexc') {
        return await _mexcDepAddr(sym, netApiCode, keys);
      } else if (excId === 'gateio') {
        return await _gateioDepAddr(sym, netApiCode, keys);
      } else if (excId === 'bitget') {
        return await _bitgetDepAddr(sym, netApiCode, keys);
      } else if (excId === 'htx') {
        return await _htxDepAddr(sym, netApiCode, keys);
      } else if (excId === 'bitmart') {
        return await _bitmartDepAddr(sym, netApiCode, keys);
      } else if (excId === 'kraken') {
        return await _krakenDepAddr(sym, netApiCode, keys);
      } else if (excId === 'coinbase') {
        return await _coinbaseDepAddr(sym, netApiCode, keys);
      } else if (excId === 'bingx') {
        return await _bingxDepAddr(sym, netApiCode, keys);
      } else if (excId === 'phemex') {
        return await _phemexDepAddr(sym, netApiCode, keys);
      } else if (excId === 'digifinex') {
        return await _digifinexDepAddr(sym, netApiCode, keys);
      } else if (excId === 'lbank') {
        return await _lbankDepAddr(sym, netApiCode, keys);
      } else if (excId === 'bitfinex') {
        return await _bitfinexDepAddr(sym, netApiCode, keys);
      }
    } catch(e) { console.warn('depAddr fetch err', excId, e); }
    return null;
  }

  // ── HMAC-SHA256 hex (reuse if EXC exposes it, else inline) ──
  async function _hmac256(secret, message) {
    var enc = new TextEncoder();
    var key = await crypto.subtle.importKey('raw', enc.encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
    var sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
    return Array.from(new Uint8Array(sig)).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
  }
  async function _hmac256b64(secret, message) {
    var enc = new TextEncoder();
    var key = await crypto.subtle.importKey('raw', enc.encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
    var sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
    return btoa(String.fromCharCode.apply(null, new Uint8Array(sig)));
  }

  // ── Binance deposit address ──
  async function _binDepAddr(sym, network, keys) {
    var params = { coin: sym, network: network, timestamp: Date.now(), recvWindow: 10000 };
    var qs = Object.keys(params).map(function(k){return k+'='+encodeURIComponent(params[k]);}).join('&');
    var sig = await _hmac256(keys.secret, qs);
    var url = 'https://api.binance.com/sapi/v1/capital/deposit/address?' + qs + '&signature=' + sig;
    var res = await _nxSignedFetch(url, { method:'GET', headers:{'X-MBX-APIKEY': keys.apiKey}, ms: 10000 });
    var d = await res.json();
    if (d && d.address) return { address: d.address, memo: d.tag || '' };
    return null;
  }

  // ── Bybit deposit address ──
  async function _bybitDepAddr(sym, network, keys) {
    var ts = Date.now().toString();
    var params = { coin: sym, chainType: network };
    var qs = Object.keys(params).map(function(k){return k+'='+encodeURIComponent(params[k]);}).join('&');
    var payload = ts + keys.apiKey + '5000' + qs;
    var sig = await _hmac256(keys.secret, payload);
    var url = 'https://api.bybit.com/v5/asset/deposit/query-address?' + qs;
    var res = await _nxSignedFetch(url, { method:'GET', headers:{'X-BAPI-API-KEY': keys.apiKey,'X-BAPI-SIGN': sig,'X-BAPI-TIMESTAMP': ts,'X-BAPI-RECV-WINDOW':'5000'}, ms: 10000 });
    var d = await res.json();
    if (d && d.result && d.result.chains && d.result.chains.length > 0) {
      var ch = d.result.chains[0];
      return { address: ch.depositAddress || '', memo: ch.tag || '' };
    }
    return null;
  }

  // ── KuCoin deposit address — /api/v3/deposit-addresses?currency=X&chain=RAW_CHAIN_ID ──
  async function _kucoinDepAddr(sym, network, keys) {
    // Address already fetched by _kucoinChains — just read from cache
    var cached = __NX._kcDepAddrCache[sym] && __NX._kcDepAddrCache[sym][(network || '').toLowerCase()];
    if (cached) return cached;
    // Cache miss — GET first, then POST to create if not found, then GET again
    try {
      var ts, passphraseEnc, path, sig, res, d;
      var _kcHeaders = function(ts, sig, pp) {
        return {'KC-API-KEY': keys.apiKey,'KC-API-SIGN': sig,'KC-API-TIMESTAMP': ts,
                'KC-API-PASSPHRASE': pp,'KC-API-KEY-VERSION':'2'};
      };
      var _kcGet = async function() {
        ts = Date.now().toString();
        passphraseEnc = await _hmac256b64(keys.secret, keys.passphrase || '');
        path = '/api/v3/deposit-addresses?currency=' + sym + (network ? '&chain=' + encodeURIComponent(network) : '');
        sig = await _hmac256b64(keys.secret, ts + 'GET' + path);
        res = await _nxSignedFetch('https://api.kucoin.com' + path, {
          headers: _kcHeaders(ts, sig, passphraseEnc), ms: 12000
        });
        d = await res.json();
        if (d && d.data && Array.isArray(d.data) && d.data.length) {
          var match = d.data.find(function(ch){ return ch.chainId && ch.chainId.toLowerCase() === (network || '').toLowerCase(); });
          // No d.data[0] fallback — exact chainId match required to avoid returning wrong chain address
          if (match && match.address) {
            var r = { address: match.address, memo: match.memo || '' };
            if (!__NX._kcDepAddrCache[sym]) __NX._kcDepAddrCache[sym] = {};
            __NX._kcDepAddrCache[sym][(match.chainId || network || '').toLowerCase()] = r;
            return r;
          }
        }
        return null;
      };
      // Step 1: try GET
      var result = await _kcGet();
      if (result) return result;
      // Step 2: address not created yet — POST to create it
      ts = Date.now().toString();
      passphraseEnc = await _hmac256b64(keys.secret, keys.passphrase || '');
      var createPath = '/api/v1/deposit-addresses';
      var body = JSON.stringify({ currency: sym, chain: network || '' });
      sig = await _hmac256b64(keys.secret, ts + 'POST' + createPath + body);
      await _nxSignedFetch('https://api.kucoin.com' + createPath, {
        method: 'POST',
        headers: Object.assign(_kcHeaders(ts, sig, passphraseEnc), {'Content-Type':'application/json'}),
        body: body,
        ms: 15000
      });
      // Step 3: GET again after creation
      result = await _kcGet();
      if (result) return result;
    } catch(e) { console.warn('kucoinDepAddr fetch err', e); }
    return null;
  }

  // ── MEXC deposit address ── response is array [{coin,network,address,memo}]
  async function _mexcDepAddr(sym, network, keys) {
    var params = { coin: sym, timestamp: Date.now() };
    var qs = Object.keys(params).map(function(k){return k+'='+params[k];}).join('&');
    var sig = await _hmac256(keys.secret, qs);
    var url = 'https://api.mexc.com/api/v3/capital/deposit/address?' + qs + '&signature=' + sig;
    var res = await _nxSignedFetch(url, { method:'GET', headers:{'X-MEXC-APIKEY': keys.apiKey}, ms: 10000 });
    var d = await res.json();
    if (Array.isArray(d) && d.length > 0) {
      // MEXC uses different network string formats across endpoints
      // (e.g. "BSC" vs "BEP20(BSC)"). Match by normalized code first, then substring.
      var wantN = (network||'').toUpperCase().replace(/[\s\-_()]+/g,'');
      var match = d.find(function(x){
        if (!x.network) return false;
        var gotN = x.network.toUpperCase().replace(/[\s\-_()]+/g,'');
        return gotN === wantN || gotN.indexOf(wantN) !== -1 || wantN.indexOf(gotN) !== -1;
      });
      if (!match) return null;
      return { address: match.address || '', memo: match.memo || '' };
    }
    if (d && d.address) return { address: d.address, memo: d.memo || '' };
    return null;
  }

  // ── Gate.io deposit address ── uses HMAC-SHA512 signing
  async function _hmac512hex(secret, message) {
    var enc = new TextEncoder();
    var key = await crypto.subtle.importKey('raw', enc.encode(secret), {name:'HMAC',hash:'SHA-512'}, false, ['sign']);
    var sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
    return Array.from(new Uint8Array(sig)).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
  }
  async function _sha512hex(message) {
    var enc = new TextEncoder();
    var buf = await crypto.subtle.digest('SHA-512', enc.encode(message));
    return Array.from(new Uint8Array(buf)).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
  }
  async function _gateioDepAddr(sym, network, keys) {
    var ts = Math.floor(Date.now()/1000).toString();
    var path = '/api/v4/wallet/deposit_address';
    var qs = 'currency=' + sym;
    var bodyHash = await _sha512hex('');
    var signStr = 'GET\n' + path + '\n' + qs + '\n' + bodyHash + '\n' + ts;
    var sig = await _hmac512hex(keys.secret, signStr);
    var url = 'https://api.gateio.ws' + path + '?' + qs;
    var res = await _nxSignedFetch(url, { method:'GET', headers:{'KEY': keys.apiKey,'SIGN': sig,'Timestamp': ts}, ms: 10000 });
    var d = await res.json();
    if (d && d.multichain_addresses && d.multichain_addresses.length > 0) {
      var netUp = network.toUpperCase();
      var match = d.multichain_addresses.find(function(x){ return x.chain && x.chain.toUpperCase() === netUp && x.obtain_failed === 0; });
      if (!match) return null;
      return { address: match.address || '', memo: match.payment_id || match.memo || '' };
    }
    if (d && d.address) return { address: d.address, memo: d.payment_id || d.memo || '' };
    return null;
  }

  // ── Bitget deposit address ──
  async function _bitgetDepAddr(sym, network, keys) {
    var ts = Date.now().toString();
    var path = '/api/v2/spot/wallet/deposit-address';
    var qs = 'coin=' + sym + '&chain=' + network;
    var preSign = ts + 'GET' + path + '?' + qs;
    var sig = await _hmac256b64(keys.secret, preSign);
    var url = 'https://api.bitget.com' + path + '?' + qs;
    var res = await _nxSignedFetch(url, { method:'GET', headers:{'ACCESS-KEY': keys.apiKey,'ACCESS-SIGN': sig,'ACCESS-TIMESTAMP': ts,'ACCESS-PASSPHRASE': keys.passphrase||'','Content-Type':'application/json','locale':'en-US'}, ms: 10000 });
    var d = await res.json();
    if (d && d.data && d.data.address) return { address: d.data.address, memo: d.data.tag || d.data.memo || '' };
    return null;
  }

  // ── HTX deposit address ──
  async function _htxDepAddr(sym, network, keys) {
    var host = 'api.huobi.pro';
    var path = '/v2/account/deposit/address';
    var ts = new Date().toISOString().slice(0,19);
    var params = { currency: sym.toLowerCase(), AccessKeyId: keys.apiKey, SignatureMethod:'HmacSHA256', SignatureVersion:'2', Timestamp: ts };
    var sortedKeys = Object.keys(params).sort();
    var qs = sortedKeys.map(function(k){return encodeURIComponent(k)+'='+encodeURIComponent(params[k]);}).join('&');
    var signStr = 'GET\n' + host + '\n' + path + '\n' + qs;
    var sig = await _hmac256b64(keys.secret, signStr);
    var url = 'https://' + host + path + '?' + qs + '&Signature=' + encodeURIComponent(sig);
    var res = await _nxSignedFetch(url, { ms: 10000 });
    var d = await res.json();
    if (d && d.data && d.data.length > 0) {
      var match = d.data.find(function(x){ return x.chain && x.chain.toLowerCase().indexOf(network.toLowerCase().slice(0,4)) !== -1; });
      if (!match) return null;
      return { address: match.address || '', memo: match.addressTag || match.tag || '' };
    }
    return null;
  }

  // ── BitMart deposit address ──
  async function _bitmartDepAddr(sym, network, keys) {
    // BitMart sign: HMAC-SHA256(secret, timestamp + '#' + memo + '#' + body)
    // For GET requests, body is the JSON form of the query params.
    var ts = Date.now().toString();
    var pass = keys.passphrase || '';
    var bodyStr = JSON.stringify({ currency: sym });
    var sigStr = ts + '#' + pass + '#' + bodyStr;
    var sig = await _hmac256(keys.secret, sigStr);
    var url = 'https://api-cloud.bitmart.com/account/v1/deposit/address?currency=' + sym;
    var res = await _nxSignedFetch(url, {
      method: 'GET',
      headers: { 'X-BM-KEY': keys.apiKey, 'X-BM-SIGN': sig, 'X-BM-TIMESTAMP': ts },
      ms: 10000
    });
    var d = await res.json();
    if (d && d.data && d.data.address) return { address: d.data.address, memo: d.data.address_memo || d.data.memo || '' };
    return null;
  }

  // ── BitMart withdraw — POST /account/v1/withdraw/apply
  // BitMart can withdraw via API, but ONLY to addresses already verified
  // on the website/app (Account → Withdraw → Add withdrawal address →
  // save as Verified). Unverified addresses are rejected by the API with
  // a clear error, which we surface as-is so the user knows to verify
  // the address on bitmart.com first.
  async function _bitmartWithdraw(sym, network, addr, amt, keys) {
    var ts = Date.now().toString();
    var pass = keys.passphrase || '';
    // currency must be the combined token-network string BitMart uses,
    // e.g. "USDT-TRC20" — network here is already that apiCode.
    var currency = network || sym;
    var body = { currency: currency, amount: String(amt), address: addr };
    var bodyStr = JSON.stringify(body);
    var sigStr = ts + '#' + pass + '#' + bodyStr;
    var sig = await _hmac256(keys.secret, sigStr);
    var res = await _nxSignedFetch('https://api-cloud.bitmart.com/account/v1/withdraw/apply', {
      method: 'POST',
      headers: { 'X-BM-KEY': keys.apiKey, 'X-BM-SIGN': sig, 'X-BM-TIMESTAMP': ts, 'Content-Type': 'application/json' },
      body: bodyStr,
      ms: 15000
    });
    var d = await res.json();
    if (d && d.data && d.data.withdraw_id) return { id: d.data.withdraw_id };
    // Surface BitMart's own message verbatim — most commonly "This address
    // is not verified. Please add and verify this address on the client"
    throw new Error(d && d.message ? d.message : 'BitMart withdraw failed');
  }

  async function _krakenDepAddr(sym, network, keys) {
    // Kraken uses OTP-nonce-based auth; method list: DepositAddresses
    var nonce = Date.now().toString();
    var path = '/0/private/DepositAddresses';
    var postData = 'nonce=' + nonce + '&asset=' + sym + '&method=' + encodeURIComponent(network) + '&new=false';
    var enc = new TextEncoder();
    var sha256buf = await crypto.subtle.digest('SHA-256', enc.encode(nonce + postData));
    var msgToSign = path + String.fromCharCode.apply(null, new Uint8Array(sha256buf));
    var secretBytes = Uint8Array.from(atob(keys.secret), function(c){return c.charCodeAt(0);});
    var key = await crypto.subtle.importKey('raw', secretBytes, {name:'HMAC',hash:'SHA-512'}, false, ['sign']);
    var sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(msgToSign));
    var sig = btoa(String.fromCharCode.apply(null, new Uint8Array(sigBuf)));
    var res = await _nxSignedFetch('https://api.kraken.com' + path, {
      method: 'POST',
      headers: { 'API-Key': keys.apiKey, 'API-Sign': sig, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: postData,
      ms: 10000
    });
    var d = await res.json();
    if (d && d.result && d.result.length > 0) {
      var r = d.result[0];
      return { address: r.address || '', memo: r.tag || r.memo || '' };
    }
    return null;
  }

  // ── Coinbase Exchange deposit address ──
  // Verified against official docs (api.exchange.coinbase.com — the same
  // legacy Exchange API this app's coinbaseFetch/baseUrl already use, NOT
  // the newer Advanced Trade v3 API which indeed has no /addresses resource):
  //   GET  /coinbase-accounts                       → wallet list (id is keyed by currency code)
  //   POST /coinbase-accounts/{account_id}/addresses → generates a deposit address, body {network}
  // Requires "transfer" permission API key, default profile.
  async function _coinbaseSign(keys, method, path, bodyStr) {
    var ts = Math.floor(Date.now()/1000).toString();
    var sig = await _hmac256b64(keys.secret, ts + method + path + (bodyStr||''));
    return { ts: ts, sig: sig };
  }
  function _coinbaseHeaders(keys, ts, sig) {
    return { 'CB-ACCESS-KEY': keys.apiKey, 'CB-ACCESS-SIGN': sig, 'CB-ACCESS-TIMESTAMP': ts, 'CB-ACCESS-PASSPHRASE': keys.passphrase||'', 'Content-Type': 'application/json' };
  }
  async function _coinbaseDepAddr(sym, network, keys) {
    try {
      var path1 = '/coinbase-accounts';
      var a1 = await _coinbaseSign(keys, 'GET', path1, '');
      var res1 = await _nxSignedFetch('https://api.exchange.coinbase.com' + path1, {
        method: 'GET', headers: _coinbaseHeaders(keys, a1.ts, a1.sig), ms: 10000
      });
      var wallets = await res1.json();
      if (!Array.isArray(wallets)) return null;
      var w = wallets.find(function(x) { return x.currency && x.currency.toUpperCase() === sym.toUpperCase() && x.type === 'wallet'; });
      if (!w) return null;
      var path2 = '/coinbase-accounts/' + w.id + '/addresses';
      var body2 = { network: network || undefined };
      var bodyStr2 = JSON.stringify(body2);
      var a2 = await _coinbaseSign(keys, 'POST', path2, bodyStr2);
      var res2 = await _nxSignedFetch('https://api.exchange.coinbase.com' + path2, {
        method: 'POST', headers: _coinbaseHeaders(keys, a2.ts, a2.sig), body: bodyStr2, ms: 10000
      });
      var d = await res2.json();
      if (d && d.address) return { address: d.address, memo: d.destination_tag || '' };
      return null;
    } catch(e) { console.warn('[coinbase] depAddr err', e); return null; }
  }

  // ── BingX deposit address ──
  async function _bingxDepAddr(sym, network, keys) {
    var ts = Date.now().toString();
    var params = { coin: sym, network: network, timestamp: ts, recvWindow: '10000' };
    var qs = Object.keys(params).sort().map(function(k){return k+'='+params[k];}).join('&');
    var sig = await _hmac256(keys.secret, qs);
    var url = 'https://open-api.bingx.com/openApi/wallets/v1/capital/deposit/address?' + qs + '&signature=' + sig;
    var res = await _nxSignedFetch(url, {
      method: 'GET',
      headers: { 'X-BX-APIKEY': keys.apiKey },
      ms: 10000
    });
    var d = await res.json();
    if (d && d.data && d.data.address) return { address: d.data.address, memo: d.data.tag || d.data.memo || '' };
    if (d && d.data && Array.isArray(d.data) && d.data.length > 0) {
      var item = d.data[0];
      return { address: item.address || '', memo: item.tag || item.memo || '' };
    }
    return null;
  }


  // ── Phemex deposit address ──
  async function _phemexDepAddr(sym, network, keys) {
    var expiry = (Date.now() + 60000).toString();
    var path = '/phemex-user/users/depositAddress/details/list';
    var qs = 'currency=' + sym;
    var preSign = path + '?' + qs + expiry;
    var sig = await _hmac256(keys.secret, preSign);
    var url = 'https://api.phemex.com' + path + '?' + qs;
    var res = await _nxSignedFetch(url, {
      method: 'GET',
      headers: { 'x-phemex-access-token': keys.apiKey, 'x-phemex-request-signature': sig, 'x-phemex-request-expiry': expiry },
      ms: 10000
    });
    var d = await res.json();
    if (d && d.data && Array.isArray(d.data) && d.data.length > 0) {
      var netUp = network.toUpperCase();
      var match = d.data.find(function(x){ return x.type && x.type.toUpperCase().indexOf(netUp.slice(0,3)) !== -1; });
      if (!match) return null;
      return { address: match.address || '', memo: match.addressTag || match.tag || match.memo || '' };
    }
    return null;
  }

  // ── DigiFinex deposit address ──
  async function _digifinexDepAddr(sym, network, keys) {
    var ts = Math.floor(Date.now() / 1000).toString();
    var sigStr = keys.apiKey + ts + keys.secret;
    var enc = new TextEncoder();
    var buf = await crypto.subtle.digest('SHA-256', enc.encode(sigStr));
    var sig = Array.from(new Uint8Array(buf)).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
    var url = 'https://openapi.digifinex.com/v3/deposit/address?symbol=' + sym.toLowerCase();
    var res = await _nxSignedFetch(url, {
      method: 'GET',
      headers: { 'ACCESS-KEY': keys.apiKey, 'ACCESS-SIGN': sig, 'ACCESS-TIMESTAMP': ts },
      ms: 10000
    });
    var d = await res.json();
    if (d && d.data && Array.isArray(d.data) && d.data.length > 0) {
      var netUp = network.toUpperCase();
      var match = d.data.find(function(x){ return x.chain && x.chain.toUpperCase().indexOf(netUp.slice(0,3)) !== -1; });
      if (!match) return null;
      return { address: match.address || '', memo: match.memo || match.tag || '' };
    }
    return null;
  }

  // ── LBank deposit address ──
  async function _lbankDepAddr(sym, network, keys) {
    var ts = Date.now().toString();
    var params = { api_key: keys.apiKey, time: ts, assetCode: sym.toLowerCase(), netWork: network };
    var sortedKeys = Object.keys(params).sort();
    var preSign = sortedKeys.map(function(k){return k+'='+params[k];}).join('&');
    var sig = await _hmac256(keys.secret, preSign);
    var body = preSign + '&sign=' + sig.toUpperCase();
    var res = await _nxSignedFetch('https://api.lbank.com/v2/user/depositAddress.do', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'echostr': ts },
      body: body,
      ms: 10000
    });
    var d = await res.json();
    if (d && d.data && d.data.address) return { address: d.data.address, memo: d.data.memo || d.data.tag || '' };
    if (d && d.result === 'true' && d.data) return { address: d.data.address || '', memo: d.data.memo || '' };
    return null;
  }

  // ── Bitfinex deposit address (v2) ──
  async function _bitfinexDepAddr(sym, network, keys) {
    var nonce = Date.now().toString();
    var path = '/v2/auth/w/deposit/address';
    var body = JSON.stringify({ wallet: 'exchange', method: network, op_renew: 0 });
    var preSign = '/api' + path + nonce + body;
    var sig = await _hmac256(keys.secret, preSign);
    var res = await _nxSignedFetch('https://api.bitfinex.com' + path, {
      method: 'POST',
      headers: { 'bfx-nonce': nonce, 'bfx-apikey': keys.apiKey, 'bfx-signature': sig, 'Content-Type': 'application/json' },
      body: body,
      ms: 10000
    });
    var d = await res.json();
    // Response: [MTS, TYPE, MESSAGE_ID, null, [[WALLET, METHOD, STATUS, null, ADDRESS, MEMO, ...]], CODE, STATUS, TEXT]
    if (Array.isArray(d) && d[4] && Array.isArray(d[4]) && d[4][0]) {
      var inner = d[4][0];
      return { address: inner[4] || '', memo: inner[5] || '' }; // index 4 = address, index 5 = memo
    }
    return null;
  }
})((window.__nxp = window.__nxp || {}).mod_deposit_modal = window.__nxp.mod_deposit_modal || {});
