// Withdraw modal: state, key and HMAC helpers, per-exchange balance lookup
// Part of the exchange withdraw modal module (split by topic; no logic change).
(function (__NX) {
  __NX._activeExcId = _activeExcId;
  __NX._getKeys = _getKeys;
  __NX._wdHmac256 = _wdHmac256;
  __NX._wdHmac256b64 = _wdHmac256b64;
  __NX._wdHmac512b64 = _wdHmac512b64;
  __NX._wdSha512hex = _wdSha512hex;
  __NX._wdHmac512hex = _wdHmac512hex;
  __NX._wdBalance = _wdBalance;


  var _wdState = {
    sym: 'USDT', name: 'Tether USD', icon: '₮', iconColor: '#26a17b',
    selectedNet: null, amount: '', address: '', balance: null, fee: null
  }; __NX._wdState = _wdState;
  var _wdChainCache = {}; __NX._wdChainCache = _wdChainCache; // separate from deposit cache

  function _activeExcId() {
    try { return window.EXC && typeof EXC.getState === 'function' ? (EXC.getState().activeExchange || null) : null; } catch(e) { return null; }
  }
  function _getKeys(excId) {
    try {
      if (window.EXC && typeof EXC._getKeys === 'function') return EXC._getKeys(excId);
      var ks = JSON.parse(localStorage.getItem('one_exc_keys_v1') || '{}'); return ks[excId] || null;
    } catch(e) { return null; }
  }

  // ── HMAC helpers (mirrors deposit block) ──
  async function _wdHmac256(secret, msg) {
    var enc = new TextEncoder();
    var key = await crypto.subtle.importKey('raw', enc.encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
    var buf = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
    return Array.from(new Uint8Array(buf)).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
  }
  async function _wdHmac256b64(secret, msg) {
    var enc = new TextEncoder();
    var key = await crypto.subtle.importKey('raw', enc.encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
    var buf = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
    return btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
  }
  async function _wdHmac512b64(secret, msg) {
    var enc = new TextEncoder();
    var secretBytes = typeof secret === 'string' ? Uint8Array.from(atob(secret), function(c){return c.charCodeAt(0);}) : enc.encode(secret);
    var key = await crypto.subtle.importKey('raw', secretBytes, {name:'HMAC',hash:'SHA-512'}, false, ['sign']);
    var buf = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
    return btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
  }
  async function _wdSha512hex(msg) {
    var enc = new TextEncoder();
    var buf = await crypto.subtle.digest('SHA-512', enc.encode(msg));
    return Array.from(new Uint8Array(buf)).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
  }
  async function _wdHmac512hex(secret, msg) {
    var enc = new TextEncoder();
    var key = await crypto.subtle.importKey('raw', enc.encode(secret), {name:'HMAC',hash:'SHA-512'}, false, ['sign']);
    var buf = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
    return Array.from(new Uint8Array(buf)).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
  }

  // ══════════════════════════════════════════════════════
  // ── Balance fetch per exchange ──
  // ══════════════════════════════════════════════════════
  async function _wdBalance(excId, sym, keys) {
    if (excId === 'binance') {
      // Binance: withdraw can come from Spot (walletType=0) or Funding (walletType=1)
      // Show combined available = spot.free + funding balance
      var params = { timestamp: Date.now(), recvWindow: 10000 };
      var qs = Object.keys(params).map(function(k){return k+'='+params[k];}).join('&');
      var sig = await _wdHmac256(keys.secret, qs);
      // Spot balance
      var dSpot = await (await _nxSignedFetch('https://api.binance.com/api/v3/account?' + qs + '&signature=' + sig, {
        headers: {'X-MBX-APIKEY': keys.apiKey}, ms: 10000
      })).json();
      var spotBal = 0;
      if (dSpot && dSpot.balances) { var f = dSpot.balances.find(function(b){return b.asset===sym;}); spotBal = f ? parseFloat(f.free)||0 : 0; }
      // Funding balance
      var params2 = { timestamp: Date.now(), recvWindow: 10000 };
      var qs2 = Object.keys(params2).map(function(k){return k+'='+params2[k];}).join('&');
      var sig2 = await _wdHmac256(keys.secret, qs2);
      var fundBal = 0;
      try {
        var dFund = await (await _nxSignedFetch('https://api.binance.com/sapi/v1/asset/get-funding-asset?' + qs2 + '&signature=' + sig2, {
          method: 'POST', headers: {'X-MBX-APIKEY': keys.apiKey, 'Content-Type': 'application/x-www-form-urlencoded'}, ms: 10000
        })).json();
        if (Array.isArray(dFund)) { var ff = dFund.find(function(b){return b.asset===sym;}); fundBal = ff ? parseFloat(ff.free)||0 : 0; }
      } catch(e) {}
      // Store breakdown for UI
      window._wdBinanceBal = { spot: spotBal, funding: fundBal };
      return spotBal + fundBal;

    } else if (excId === 'bybit') {
      // Bybit withdraw comes from FUND account — show FUND balance
      var ts = Date.now().toString();
      var qs = 'accountType=FUND&coin=' + sym;
      var sig = await _wdHmac256(keys.secret, ts + keys.apiKey + '5000' + qs);
      var d = await (await _nxSignedFetch('https://api.bybit.com/v5/asset/transfer/query-account-coin-balance?' + qs, {
        headers: {'X-BAPI-API-KEY': keys.apiKey,'X-BAPI-SIGN': sig,'X-BAPI-TIMESTAMP': ts,'X-BAPI-RECV-WINDOW':'5000'},
        ms: 10000
      })).json();
      if (d && d.result && d.result.balance) {
        return parseFloat(d.result.balance.transferBalance || d.result.balance.walletBalance) || 0;
      }
      return 0;

    } else if (excId === 'kucoin') {
      var ts = Date.now().toString();
      var pp = await _wdHmac256b64(keys.secret, keys.passphrase||'');
      var path = '/api/v1/accounts?currency=' + sym + '&type=main'; // main = funding/withdraw wallet
      var sig = await _wdHmac256b64(keys.secret, ts + 'GET' + path);
      var d = await (await _nxSignedFetch('https://api.kucoin.com' + path, {
        headers: {'KC-API-KEY': keys.apiKey,'KC-API-SIGN': sig,'KC-API-TIMESTAMP': ts,'KC-API-PASSPHRASE': pp,'KC-API-KEY-VERSION':'2'},
        ms: 10000
      })).json();
      if (d && d.data && d.data.length) return parseFloat(d.data[0].available)||0;

    } else if (excId === 'mexc') {
      var mexcParams = { timestamp: Date.now(), recvWindow: 10000 };
      var qs = Object.keys(mexcParams).map(function(k){return k+'='+mexcParams[k];}).join('&');
      var sig = await _wdHmac256(keys.secret, qs);
      var d = await (await _nxSignedFetch('https://api.mexc.com/api/v3/account?' + qs + '&signature=' + sig, {
        headers: {'X-MEXC-APIKEY': keys.apiKey}, ms: 10000
      })).json();
      if (d && d.balances) { var f = d.balances.find(function(b){return b.asset===sym;}); return f ? parseFloat(f.free)||0 : 0; }

    } else if (excId === 'gateio') {
      var ts = Math.floor(Date.now()/1000).toString();
      var path = '/api/v4/spot/accounts';
      var qs = 'currency=' + sym;
      var bodyHash = await _wdSha512hex('');
      var signStr = 'GET\n' + path + '\n' + qs + '\n' + bodyHash + '\n' + ts;
      var sig = await _wdHmac512hex(keys.secret, signStr);
      var d = await (await _nxSignedFetch('https://api.gateio.ws' + path + '?' + qs, {
        headers: {'KEY': keys.apiKey,'SIGN': sig,'Timestamp': ts},
        ms: 10000
      })).json();
      if (Array.isArray(d) && d.length) return parseFloat(d[0].available)||0;

    } else if (excId === 'bitget') {
      var ts = Date.now().toString();
      var path = '/api/v2/spot/account/assets';
      var qs = 'coin=' + sym;
      var sig = await _wdHmac256b64(keys.secret, ts + 'GET' + path + '?' + qs);
      var d = await (await _nxSignedFetch('https://api.bitget.com' + path + '?' + qs, {
        headers: {'ACCESS-KEY': keys.apiKey,'ACCESS-SIGN': sig,'ACCESS-TIMESTAMP': ts,'ACCESS-PASSPHRASE': keys.passphrase||'','Content-Type':'application/json'},
        ms: 10000
      })).json();
      if (d && d.data && d.data.length) return parseFloat(d.data[0].available)||0;

    } else if (excId === 'htx') {
      var host = 'api.huobi.pro';
      var path = '/v1/account/accounts';
      var ts = new Date().toISOString().slice(0,19);
      var params = { AccessKeyId: keys.apiKey, SignatureMethod:'HmacSHA256', SignatureVersion:'2', Timestamp: ts };
      var sortedKeys = Object.keys(params).sort();
      var qs = sortedKeys.map(function(k){return encodeURIComponent(k)+'='+encodeURIComponent(params[k]);}).join('&');
      var signStr = 'GET\n' + host + '\n' + path + '\n' + qs;
      var sig = await _wdHmac256b64(keys.secret, signStr);
      var d = await (await _nxSignedFetch('https://' + host + path + '?' + qs + '&Signature=' + encodeURIComponent(sig), {
        ms: 10000
      })).json();
      if (d && d.data && d.data.length) {
        var acc = d.data.find(function(a){return a.type==='spot';});
        if (!acc) return null;
        // Get balance for this account
        var path2 = '/v1/account/accounts/' + acc.id + '/balance';
        var ts2 = new Date().toISOString().slice(0,19);
        var params2 = { AccessKeyId: keys.apiKey, SignatureMethod:'HmacSHA256', SignatureVersion:'2', Timestamp: ts2 };
        var qs2 = Object.keys(params2).sort().map(function(k){return encodeURIComponent(k)+'='+encodeURIComponent(params2[k]);}).join('&');
        var sig2 = await _wdHmac256b64(keys.secret, 'GET\n' + host + '\n' + path2 + '\n' + qs2);
        var d2 = await (await _nxSignedFetch('https://' + host + path2 + '?' + qs2 + '&Signature=' + encodeURIComponent(sig2), {
          ms: 10000
        })).json();
        if (d2 && d2.data && d2.data.list) {
          var bal = d2.data.list.find(function(b){return b.currency===sym.toLowerCase() && b.type==='trade';});
          return bal ? parseFloat(bal.balance)||0 : 0;
        }
      }

    } else if (excId === 'bingx') {
      // Spot balance: /openApi/spot/v1/account/balance
      var tsBx = Date.now().toString();
      var pBx = { timestamp: tsBx, recvWindow: '10000' };
      var qsBx = Object.keys(pBx).sort().map(function(k){return k+'='+pBx[k];}).join('&');
      var sigBx = await _wdHmac256(keys.secret, qsBx);
      var spotBx = 0, fundBx = 0;
      try {
        var dSpBx = await (await _nxSignedFetch('https://open-api.bingx.com/openApi/spot/v1/account/balance?' + qsBx + '&signature=' + sigBx, {
          headers: {'X-BX-APIKEY': keys.apiKey}, ms: 10000
        })).json();
        if (dSpBx && dSpBx.data && dSpBx.data.balances) {
          var fBx = dSpBx.data.balances.find(function(b){return b.asset===sym;}); spotBx = fBx ? parseFloat(fBx.free)||0 : 0;
        }
      } catch(e) {}
      // Funding balance: /openApi/account/v1/balance
      try {
        var tsBx2 = Date.now().toString();
        var pBx2 = { timestamp: tsBx2, recvWindow: '10000' };
        var qsBx2 = Object.keys(pBx2).sort().map(function(k){return k+'='+pBx2[k];}).join('&');
        var sigBx2 = await _wdHmac256(keys.secret, qsBx2);
        var dFuBx = await (await _nxSignedFetch('https://open-api.bingx.com/openApi/account/v1/balance?' + qsBx2 + '&signature=' + sigBx2, {
          headers: {'X-BX-APIKEY': keys.apiKey}, ms: 10000
        })).json();
        if (dFuBx && dFuBx.data && dFuBx.data.balances) {
          var fFuBx = dFuBx.data.balances.find(function(b){return b.asset===sym;}); fundBx = fFuBx ? parseFloat(fFuBx.free)||0 : 0;
        }
      } catch(e) {}
      window._wdBingxBal = { spot: spotBx, funding: fundBx };
      return spotBx + fundBx;

    } else if (excId === 'phemex') {
      var expiry = (Date.now() + 60000).toString();
      var path = '/phemex-user/users/asset/info';
      var qs = 'currency=' + sym;
      var sig = await _wdHmac256(keys.secret, path + qs + expiry);
      var d = await (await _nxSignedFetch('https://api.phemex.com' + path + '?' + qs, {
        headers: {'x-phemex-access-token': keys.apiKey,'x-phemex-request-signature': sig,'x-phemex-request-expiry': expiry},
        ms: 10000
      })).json();
      if (d && d.data && d.data.spotBalances) {
        var bal = d.data.spotBalances.find(function(b){return b.currency===sym;});
        return bal ? parseFloat(bal.availableBalanceEv||bal.available||0)/1e8 : 0;
      }

    } else if (excId === 'digifinex') {
      var ts = Math.floor(Date.now()/1000).toString();
      var enc = new TextEncoder();
      var buf = await crypto.subtle.digest('SHA-256', enc.encode(keys.apiKey + ts + keys.secret));
      var sig = Array.from(new Uint8Array(buf)).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
      var d = await (await _nxSignedFetch('https://openapi.digifinex.com/v3/spot/assets', {
        headers: {'ACCESS-KEY': keys.apiKey,'ACCESS-SIGN': sig,'ACCESS-TIMESTAMP': ts},
        ms: 10000
      })).json();
      if (d && d.list) { var f = d.list.find(function(b){return b.currency.toUpperCase()===sym;}); return f ? parseFloat(f.available)||0 : 0; }

    } else if (excId === 'lbank') {
      // LBank signing: MD5(sorted_params) → HMAC-SHA256(secret, MD5_result.toUpperCase())
      var ts = Date.now().toString();
      var echostr = (function(){ var c='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; var s=''; for(var i=0;i<35;i++) s+=c[Math.floor(Math.random()*c.length)]; return s; })();
      var lbParams = { api_key: keys.apiKey, signature_method: 'HmacSHA256', timestamp: ts, echostr: echostr };
      var lbSorted = Object.keys(lbParams).sort();
      var lbQs = lbSorted.map(function(k){return k+'='+lbParams[k];}).join('&');
      var lbMd5 = md5Hex(lbQs).toUpperCase();
      var sig = await hmacSha256(keys.secret, lbMd5);
      lbParams.sign = sig;
      var body = Object.keys(lbParams).map(function(k){return encodeURIComponent(k)+'='+encodeURIComponent(lbParams[k]);}).join('&');
      var d = await (await _nxSignedFetch('https://api.lbank.com/v2/user_info.do', {
        method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: body, ms: 10000
      })).json();
      if (d && d.result === 'true' && d.info && d.info.free) {
        return parseFloat(d.info.free[sym.toLowerCase()]||d.info.free[sym]||0)||0;
      }

    } else if (excId === 'bitfinex') {
      var nonce = (Date.now() * 1000).toString(); // Bitfinex needs microsecond nonce
      var path = '/v2/auth/r/wallets';
      var preSign = '/api' + path + nonce + '{}';
      var sig = await hmacSha384Hex(keys.secret, preSign); // Bitfinex v2 requires SHA-384
      var d = await (await _nxSignedFetch('https://api.bitfinex.com' + path, {
        method:'POST', headers:{'bfx-nonce': nonce,'bfx-apikey': keys.apiKey,'bfx-signature': sig,'Content-Type':'application/json'},
        body: '{}', ms: 10000
      })).json();
      // Response: [[TYPE, CURRENCY, _, _, BALANCE, AVAILABLE, ...], ...]
      if (Array.isArray(d)) {
        var w = d.find(function(x){return x[0]==='exchange' && x[1]===sym;});
        return w ? parseFloat(w[5])||0 : 0;
      }

    } else if (excId === 'kraken') {
      var nonce = Date.now().toString();
      var path = '/0/private/Balance';
      var postData = 'nonce=' + nonce;
      var enc2 = new TextEncoder();
      var sha256buf = await crypto.subtle.digest('SHA-256', enc2.encode(nonce + postData));
      var msgToSign = path + String.fromCharCode.apply(null, new Uint8Array(sha256buf));
      var sig = await _wdHmac512b64(keys.secret, msgToSign);
      var d = await (await _nxSignedFetch('https://api.kraken.com' + path, {
        method:'POST', headers:{'API-Key': keys.apiKey,'API-Sign': sig,'Content-Type':'application/x-www-form-urlencoded'},
        body: postData, ms: 10000
      })).json();
      if (d && d.result) {
        // Kraken uses asset codes: ZUSD, XXBT, XETH, USDT
        var krakenMap = {'USDT':'USDT','BTC':'XXBT','ETH':'XETH','BNB':'BNB','USDC':'USDC','SOL':'SOL','XRP':'XXRP'};
        var code = krakenMap[sym] || sym;
        return parseFloat(d.result[code]||d.result[sym]||0)||0;
      }

    } else if (excId === 'bitmart') {
      // GET /account/v1/wallet — BitMart spot wallet balance
      var tsBm = Date.now().toString();
      var passBm = keys.passphrase || '';
      var bmQs = 'currency=' + sym;
      var bmSigStr = tsBm + '#' + passBm + '#' + bmQs;
      var bmSig = await _hmac256(keys.secret, bmSigStr);
      var dBmBal = await (await _nxSignedFetch('https://api-cloud.bitmart.com/account/v1/wallet?' + bmQs, {
        headers: {'X-BM-KEY': keys.apiKey, 'X-BM-SIGN': bmSig, 'X-BM-TIMESTAMP': tsBm},
        ms: 10000
      })).json();
      if (dBmBal && dBmBal.data && Array.isArray(dBmBal.data.wallet)) {
        var bmRow = dBmBal.data.wallet.find(function(w){ return w.currency && w.currency.toUpperCase() === sym.toUpperCase(); });
        return bmRow ? parseFloat(bmRow.available) || 0 : 0;
      }

      } else if (excId === 'bitmart') {
      // GET /account/v1/wallet — BitMart spot wallet balance
      var tsBm = Date.now().toString();
      var passBm = keys.passphrase || '';
      var bmQs = 'currency=' + sym;
      var bmSigStr = tsBm + '#' + passBm + '#' + bmQs;
      var bmSig = await _hmac256(keys.secret, bmSigStr);
      var dBmBal = await (await _nxSignedFetch('https://api-cloud.bitmart.com/account/v1/wallet?' + bmQs, {
        headers: {'X-BM-KEY': keys.apiKey, 'X-BM-SIGN': bmSig, 'X-BM-TIMESTAMP': tsBm},
        ms: 10000
      })).json();
      if (dBmBal && dBmBal.data && Array.isArray(dBmBal.data.wallet)) {
        var bmRow = dBmBal.data.wallet.find(function(w){ return w.currency && w.currency.toUpperCase() === sym.toUpperCase(); });
        return bmRow ? parseFloat(bmRow.available) || 0 : 0;
      }

      } else if (excId === 'coinbase') {
      // Use the same legacy Exchange API (api.exchange.coinbase.com) and
      // CB-ACCESS-* + passphrase auth as the rest of this app's Coinbase
      // integration (coinbaseFetch/_coinbaseDepAddr) — Advanced Trade's
      // api.coinbase.com uses a different JWT/ES256 scheme entirely, so
      // signing it with HMAC like this never actually authenticates.
      // NOTE: _coinbaseSign/_coinbaseHeaders live in a different IIFE
      // (deposit/withdraw-chains module) — inlined locally here to avoid
      // a cross-IIFE scope leak.
      var cbWdTs = Math.floor(Date.now()/1000).toString();
      var cbWdSig = await _wdHmac256b64(keys.secret, cbWdTs + 'GET' + '/accounts');
      var dCbBal = await (await _nxSignedFetch('https://api.exchange.coinbase.com/accounts', {
        headers: { 'CB-ACCESS-KEY': keys.apiKey, 'CB-ACCESS-SIGN': cbWdSig, 'CB-ACCESS-TIMESTAMP': cbWdTs, 'CB-ACCESS-PASSPHRASE': keys.passphrase||'' },
        ms: 10000
      })).json();
      if (Array.isArray(dCbBal)) {
        var cbRow = dCbBal.find(function(a){ return a.currency && a.currency.toUpperCase() === sym.toUpperCase(); });
        return cbRow ? parseFloat(cbRow.available) || 0 : 0;
      }
      return 0;
    }
    return null;
  }
})((window.__nxp = window.__nxp || {}).mod_withdraw_modal = window.__nxp.mod_withdraw_modal || {});
