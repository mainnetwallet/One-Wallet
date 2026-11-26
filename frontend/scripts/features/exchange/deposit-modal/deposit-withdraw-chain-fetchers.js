// Deposit modal: per-exchange withdraw chain fetchers
// Part of the exchange deposit modal module (split by topic; no logic change).
(function (__NX) {
  __NX._fetchExcChainsForWithdraw = _fetchExcChainsForWithdraw;


  // ══════════════════════════════════════════════════════
  // ── Withdraw-specific chain fetchers (withdrawEnable filter) ──
  // ══════════════════════════════════════════════════════

  async function _binChainsWd(sym, keys) {
    var params = { timestamp: Date.now(), recvWindow: 10000 };
    var qs = Object.keys(params).map(function(k){return k+'='+params[k];}).join('&');
    var sig = await __NX._hmac256(keys.secret, qs);
    var res = await _nxSignedFetch('https://api.binance.com/sapi/v1/capital/config/getall?' + qs + '&signature=' + sig, {
      headers: {'X-MBX-APIKEY': keys.apiKey}, ms: 12000
    });
    var list = await res.json();
    if (!Array.isArray(list)) return null;
    var coin = list.find(function(c){ return c.coin && c.coin.toUpperCase() === sym.toUpperCase(); });
    if (!coin || !Array.isArray(coin.networkList)) return null;
    var chains = [];
    coin.networkList.forEach(function(n) {
      if (!n.withdrawEnable) return;  // ✅ withdraw filter
      var entry = __NX._buildChainDirect(n.networkFullName || n.network, n.network, '');
      if (entry) chains.push(entry);
    });
    return chains.length ? chains : null;
  }

  async function _bybitChainsWd(sym, keys) {
    var ts = Date.now().toString();
    var qs = 'coin=' + sym;
    var payload = ts + keys.apiKey + '5000' + qs;
    var sig = await __NX._hmac256(keys.secret, payload);
    var res = await _nxSignedFetch('https://api.bybit.com/v5/asset/coin/query-info?' + qs, {
      headers: {'X-BAPI-API-KEY': keys.apiKey,'X-BAPI-SIGN': sig,'X-BAPI-TIMESTAMP': ts,'X-BAPI-RECV-WINDOW':'5000'},
      ms: 12000
    });
    var d = await res.json();
    if (!d || !d.result || !Array.isArray(d.result.rows) || !d.result.rows[0]) return null;
    var chains = [];
    (d.result.rows[0].chains || []).forEach(function(ch) {
      if (ch.chainWithdraw !== '1') return;  // ✅ withdraw filter
      var entry = __NX._buildChainDirect(ch.chain, ch.chain, '');
      if (entry) chains.push(entry);
    });
    return chains.length ? chains : null;
  }

  async function _kucoinChainsWd(sym, keys) {
    var ts = Date.now().toString();
    var passphraseEnc = await __NX._hmac256b64(keys.secret, keys.passphrase || '');
    var path = '/api/v3/currencies/' + sym;
    var sig = await __NX._hmac256b64(keys.secret, ts + 'GET' + path);
    var res = await _nxSignedFetch('https://api.kucoin.com' + path, {
      headers: {'KC-API-KEY': keys.apiKey,'KC-API-SIGN': sig,'KC-API-TIMESTAMP': ts,'KC-API-PASSPHRASE': passphraseEnc,'KC-API-KEY-VERSION':'2'},
      ms: 12000
    });
    var d = await res.json();
    if (!d || !d.data || !Array.isArray(d.data.chains)) return null;
    var chains = [];
    d.data.chains.forEach(function(ch) {
      if (!ch.isWithdrawEnabled) return;  // ✅ withdraw filter
      // apiCode = ch.chainId (KuCoin short code e.g. 'eth','trx','opt','arb') — same as deposit
      var entry = __NX._buildChainDirect(ch.chainFullName || ch.chainName || ch.chainId, ch.chainId, ch.contractAddress || '');
      if (entry) chains.push(entry);
    });
    return chains.length ? chains : null;
  }

  async function _mexcChainsWd(sym, keys) {
    var params = { timestamp: Date.now(), recvWindow: 10000 };
    var qs = 'timestamp=' + params.timestamp + '&recvWindow=' + params.recvWindow;
    var sig = await __NX._hmac256(keys.secret, qs);
    var res = await _nxSignedFetch('https://api.mexc.com/api/v3/capital/config/getall?' + qs + '&signature=' + sig, {
      headers: {'X-MEXC-APIKEY': keys.apiKey}, ms: 12000
    });
    var list = await res.json();
    if (!Array.isArray(list)) return null;
    var coin = list.find(function(c){ return c.coin && c.coin.toUpperCase() === sym.toUpperCase(); });
    if (!coin || !Array.isArray(coin.networkList)) return null;
    var chains = [];
    coin.networkList.forEach(function(n) {
      if (!n.withdrawEnable) return;  // ✅ withdraw filter
      var entry = __NX._buildChainDirect(n.name || n.network, n.network, '');
      if (entry) chains.push(entry);
    });
    return chains.length ? chains : null;
  }

  async function _gateioChainsWd(sym, keys) {
    var ts = Math.floor(Date.now()/1000).toString();
    var path = '/api/v4/wallet/currency_chains';
    var qs = 'currency=' + sym;
    var body = '';
    var bodyHash = await __NX._sha512hex('');
    var signStr = 'GET\n' + path + '\n' + qs + '\n' + bodyHash + '\n' + ts;
    var sig = await __NX._hmac512hex(keys.secret, signStr);
    var res = await _nxSignedFetch('https://api.gateio.ws' + path + '?' + qs, {
      headers: {'KEY': keys.apiKey,'SIGN': sig,'Timestamp': ts},
      ms: 12000
    });
    var list = await res.json();
    if (!Array.isArray(list)) return null;
    var chains = [];
    list.forEach(function(ch) {
      if (ch.is_withdraw_disabled) return;  // ✅ withdraw filter
      var entry = __NX._buildChainDirect(ch.name_en || ch.chain, ch.chain, ch.contract_address || '');
      if (entry) chains.push(entry);
    });
    return chains.length ? chains : null;
  }

  async function _bitgetChainsWd(sym) {
    var res = await _nxSignedFetch('https://api.bitget.com/api/v2/spot/public/coins?coin=' + sym, {
      ms: 12000
    });
    var d = await res.json();
    if (!d || !Array.isArray(d.data) || !d.data[0]) return null;
    var chains = [];
    (d.data[0].chains || []).forEach(function(ch) {
      if (ch.withdrawable !== 'true' && ch.withdrawable !== true) return;  // ✅ withdraw filter
      var entry = __NX._buildChainDirect(ch.chainName || ch.chain, ch.chain, ch.contractAddress || '');
      if (entry) chains.push(entry);
    });
    return chains.length ? chains : null;
  }

  async function _htxChainsWd(sym, keys) {
    var host = 'api.huobi.pro', path = '/v2/reference/currencies';
    var ts = new Date().toISOString().slice(0,19);
    var params = { AccessKeyId: keys.apiKey, SignatureMethod:'HmacSHA256', SignatureVersion:'2', Timestamp: ts, currency: sym.toLowerCase() };
    var sortedKeys = Object.keys(params).sort();
    var qs = sortedKeys.map(function(k){return encodeURIComponent(k)+'='+encodeURIComponent(params[k]);}).join('&');
    var strToSign = 'GET\n' + host + '\n' + path + '\n' + qs;
    var sig = await __NX._hmac256b64(keys.secret, strToSign);
    var url = 'https://' + host + path + '?' + qs + '&Signature=' + encodeURIComponent(sig);
    var res = await _nxSignedFetch(url, { ms: 12000 });
    var d = await res.json();
    if (!d || !Array.isArray(d.data) || !d.data[0]) return null;
    var chains = [];
    (d.data[0].chains || []).forEach(function(ch) {
      if (ch.withdrawStatus !== 'allowed') return;  // ✅ withdraw filter
      var entry = __NX._buildChainDirect(ch.displayName || ch.baseChain, ch.baseChain || ch.displayName, ch.contractAddress || '');
      if (entry) chains.push(entry);
    });
    return chains.length ? chains : null;
  }

  async function _bitmartChainsWd(sym, keys) {
    var res = await _nxSignedFetch('https://api-cloud.bitmart.com/spot/v1/currencies', {
      ms: 12000
    });
    var d = await res.json();
    if (!d || !d.data || !Array.isArray(d.data.currencies)) return null;
    var coin = d.data.currencies.find(function(c){ return c.id && c.id.toUpperCase() === sym.toUpperCase(); });
    if (!coin || !Array.isArray(coin.networks)) return null;
    var chains = [];
    coin.networks.forEach(function(n) {
      if (!n.withdraw_enabled) return;  // ✅ withdraw filter
      var entry = __NX._buildChainDirect(n.network, n.network, n.contract_address || '');
      if (entry) chains.push(entry);
    });
    return chains.length ? chains : null;
  }


  async function _phemexChainsWd(sym, keys) {
    try {
      var d = await (await _nxSignedFetch('https://api.phemex.com/public/products', {ms: 12000})).json();
      if (!d || !d.data || !Array.isArray(d.data.currencies)) return null;
      var curr = d.data.currencies.find(function(c){ return c.currency && c.currency.toUpperCase() === sym.toUpperCase(); });
      if (!curr || !Array.isArray(curr.networks)) return null;
      var chains = [];
      curr.networks.forEach(function(n) {
        if (!n.network || n.withdrawEnabled === false) return;  // ✅ withdraw filter
        var e = __NX._buildChainDirect(n.network, n.network, '');
        if (e) chains.push(e);
      });
      return chains.length ? chains : null;
    } catch(e) { return null; }
  }

  async function _digifinexChainsWd(sym, keys) {
    // DigiFinex: GET /v3/withdraw/coins — withdraw-specific endpoint
    try {
      var ts = Math.floor(Date.now()/1000).toString();
      var enc = new TextEncoder();
      var buf = await crypto.subtle.digest('SHA-256', enc.encode(keys.apiKey + ts + keys.secret));
      var sig = Array.from(new Uint8Array(buf)).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
      var d = await (await _nxSignedFetch('https://openapi.digifinex.com/v3/withdraw/coins?coin_name=' + sym.toUpperCase(), {
        headers: {'ACCESS-KEY': keys.apiKey, 'ACCESS-SIGN': sig, 'ACCESS-TIMESTAMP': ts},
        ms: 12000
      })).json();
      if (!d || !Array.isArray(d.data) || !d.data.length) return null;
      var chains = []; var seen = {};
      d.data.forEach(function(entry) {
        var raw = entry.chain || entry.network;
        if (!raw || seen[raw]) return;
        seen[raw] = true;
        var e = __NX._buildChainDirect(raw, raw, '');
        if (e) chains.push(e);
      });
      return chains.length ? chains : null;
    } catch(e) { return null; }
  }

  async function _lbankChainsWd(sym, keys) {
    // LBank: /v2/withdrawConfigs.do — already withdraw-specific, no change needed
    try {
      var d = await (await _nxSignedFetch('https://api.lbank.com/v2/withdrawConfigs.do?assetCode=' + sym.toLowerCase(), {
        ms: 12000
      })).json();
      if (!d || d.result !== 'true' || !Array.isArray(d.data)) return null;
      var chains = [];
      d.data.forEach(function(entry) {
        var raw = entry.netWork || entry.network || entry.chain;
        if (!raw) return;
        var e = __NX._buildChainDirect(raw, raw, '');
        if (e) chains.push(e);
      });
      return chains.length ? chains : null;
    } catch(e) { return null; }
  }

  async function _bitfinexChainsWd(sym, keys) {
    // Bitfinex: pub:map:currency:tx:method — same endpoint, no deposit/withdraw split available
    try {
      var d = await (await _nxSignedFetch('https://api-pub.bitfinex.com/v2/conf/pub:map:currency:tx:method', {
        ms: 12000
      })).json();
      if (!Array.isArray(d) || !Array.isArray(d[0])) return null;
      var entry = d[0].find(function(item){ return item[0] && item[0].toUpperCase() === sym.toUpperCase(); });
      if (!entry || !Array.isArray(entry[1])) return null;
      var chains = [];
      entry[1].forEach(function(method) {
        if (!method) return;
        var e = __NX._buildChainDirect(method, method, '');
        if (e) chains.push(e);
      });
      return chains.length ? chains : null;
    } catch(e) { return null; }
  }

  // ── BingX: GET /openApi/wallets/v1/capital/config/getall ──
  async function _bingxChainsWd(sym, keys) {
    var ts = Date.now().toString();
    var params = { timestamp: ts, recvWindow: '10000' };
    var qs = Object.keys(params).sort().map(function(k){return k+'='+params[k];}).join('&');
    var sig = await __NX._hmac256(keys.secret, qs);
    var res = await _nxSignedFetch('https://open-api.bingx.com/openApi/wallets/v1/capital/config/getall?' + qs + '&signature=' + sig, {
      headers: {'X-BX-APIKEY': keys.apiKey}, ms: 12000
    });
    var d = await res.json();
    if (!d || !Array.isArray(d.data)) return null;
    var coin = d.data.find(function(c){ return c.coin && c.coin.toUpperCase() === sym.toUpperCase(); });
    if (!coin || !Array.isArray(coin.networkList)) return null;
    var chains = [];
    coin.networkList.forEach(function(n) {
      if (!n.withdrawEnable) return;  // ✅ withdraw filter
      var entry = __NX._buildChainDirect(n.name || n.network, n.network, '');
      if (entry) chains.push(entry);
    });
    return chains.length ? chains : null;
  }

  // ── Main withdraw chain fetcher (withdraw-filtered) ──
  // ── Kraken: GET /0/private/WithdrawMethods → available withdrawal methods ──
  async function _krakenChainsWd(sym, keys) {
    try {
      var nonce = Date.now().toString();
      var krakenMap = {'USDT':'USDT','BTC':'XBT','ETH':'ETH','BNB':'BNB','USDC':'USDC','SOL':'SOL','XRP':'XXRP','ADA':'ADA','DOT':'DOT','DOGE':'XDOGE','LTC':'XLTCZ'};
      var asset = krakenMap[sym] || sym;
      var path = '/0/private/WithdrawMethods';
      var postData = 'nonce=' + nonce + '&asset=' + asset;
      var enc = new TextEncoder();
      var sha256buf = await crypto.subtle.digest('SHA-256', enc.encode(nonce + postData));
      var msgToSign = path + String.fromCharCode.apply(null, new Uint8Array(sha256buf));
      var secretBytes = Uint8Array.from(atob(keys.secret), function(c){return c.charCodeAt(0);});
      var key = await crypto.subtle.importKey('raw', secretBytes, {name:'HMAC',hash:'SHA-512'}, false, ['sign']);
      var sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(msgToSign));
      var sig = btoa(String.fromCharCode.apply(null, new Uint8Array(sigBuf)));
      var res = await _nxSignedFetch('https://api.kraken.com' + path, {
        method: 'POST',
        headers: {'API-Key': keys.apiKey, 'API-Sign': sig, 'Content-Type': 'application/x-www-form-urlencoded'},
        body: postData, ms: 12000
      });
      var d = await res.json();
      if (!d || !d.result || !Array.isArray(d.result)) return null;
      var chains = []; var seen = {};
      d.result.forEach(function(m) {
        // m.method = withdrawal method name e.g. 'Bitcoin', 'Ether (ERC20)', 'USDT (TRC20)'
        var raw = m.method;
        if (!raw || seen[raw]) return;
        seen[raw] = true;
        var e = __NX._buildChainDirect(raw, raw, '');
        if (e) chains.push(e);
      });
      return chains.length ? chains : null;
    } catch(e) { return null; }
  }

  // ── Coinbase: same /currencies/{id} endpoint as deposit-chains — every
  // network listed there is usable for /withdrawals/crypto's `network` param
  // (confirmed in Coinbase Exchange changelog: network param added to that
  // endpoint precisely to pick among supported_networks). ──
  async function _coinbaseChainsWd(sym, keys) {
    try {
      var res = await _nxSignedFetch('https://api.exchange.coinbase.com/currencies/' + sym.toUpperCase(), { method: 'GET', ms: 10000 });
      var d = await res.json();
      if (!d || !Array.isArray(d.supported_networks)) return null;
      var chains = [];
      d.supported_networks.forEach(function(n) {
        if (n.status && n.status.toLowerCase() !== 'online') return;
        var entry = __NX._buildChainDirect(n.display_name || n.network, n.network, n.contract_address || '');
        if (entry) chains.push(entry);
      });
      return chains.length ? chains : null;
    } catch(e) { return null; }
  }

  async function _fetchExcChainsForWithdraw(excId, sym, keys) {
    var raw = null;
    try {
      if (excId === 'binance')   raw = await _binChainsWd(sym, keys);
      else if (excId === 'bybit')     raw = await _bybitChainsWd(sym, keys);
      else if (excId === 'kucoin')    raw = await _kucoinChainsWd(sym, keys);
      else if (excId === 'mexc')      raw = await _mexcChainsWd(sym, keys);
      else if (excId === 'gateio')    raw = await _gateioChainsWd(sym, keys);
      else if (excId === 'bitget')    raw = await _bitgetChainsWd(sym);
      else if (excId === 'htx')       raw = await _htxChainsWd(sym, keys);
      else if (excId === 'phemex')    raw = await _phemexChainsWd(sym, keys);
      else if (excId === 'digifinex') raw = await _digifinexChainsWd(sym, keys);
      else if (excId === 'lbank')     raw = await _lbankChainsWd(sym, keys);
      else if (excId === 'bitfinex')  raw = await _bitfinexChainsWd(sym, keys);
      else if (excId === 'bingx')     raw = await _bingxChainsWd(sym, keys);
      else if (excId === 'kraken')    raw = await _krakenChainsWd(sym, keys);
      else if (excId === 'bitmart')   raw = await _bitmartChainsWd(sym, keys);
      else if (excId === 'coinbase')  raw = await _coinbaseChainsWd(sym, keys);
    } catch(e) { console.warn('fetchChainsForWithdraw err', excId, e); }
    if (!raw || !raw.length) return null;
    // Deduplicate by normalized key (prevents BSC+BEP20 both mapping to same chain)
    var seen = {}; var deduped = [];
    raw.forEach(function(n) {
      if (!n || !n.key) return;
      if (seen[n.key]) return; // skip duplicate
      seen[n.key] = true;
      deduped.push(n);
    });
    return deduped.length ? deduped : null;
  }
})((window.__nxp = window.__nxp || {}).mod_deposit_modal = window.__nxp.mod_deposit_modal || {});
