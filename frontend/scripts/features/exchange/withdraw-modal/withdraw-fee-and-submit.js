// Withdraw modal: per-exchange fee lookup and withdrawal submit
// Part of the exchange withdraw modal module (split by topic; no logic change).
(function (__NX) {
  __NX._wdFee = _wdFee;
  __NX._wdSubmitExc = _wdSubmitExc;


  // ══════════════════════════════════════════════════════
  // ── Fee fetch per exchange ──
  // ══════════════════════════════════════════════════════
  async function _wdFee(excId, sym, net, keys) {
    // net.apiCode = raw API code from exchange (set by _buildChainDirect), net.label = API display name
    var netCode = net ? (net.apiCode || net.key).toUpperCase() : '';
    var netSub  = net ? (net.sub || '') : '';
    try {
      if (excId === 'binance') {
        var params = { timestamp: Date.now(), recvWindow: 10000 };
        var qs = Object.keys(params).map(function(k){return k+'='+params[k];}).join('&');
        var sig = await __NX._wdHmac256(keys.secret, qs);
        var d = await (await _nxSignedFetch('https://api.binance.com/sapi/v1/capital/config/getall?' + qs + '&signature=' + sig, {
          headers: {'X-MBX-APIKEY': keys.apiKey}, ms: 10000
        })).json();
        if (Array.isArray(d)) {
          var coin = d.find(function(c){return c.coin===sym;});
          if (coin && coin.networkList) {
            var nm = coin.networkList.find(function(n){return n.network===netCode||n.networkName===net.label;});
            return nm ? parseFloat(nm.withdrawFee)||0 : null;
          }
        }

      } else if (excId === 'bybit') {
        var ts = Date.now().toString();
        var qs = 'coin=' + sym;
        var sig = await __NX._wdHmac256(keys.secret, ts + keys.apiKey + '5000' + qs);
        var d = await (await _nxSignedFetch('https://api.bybit.com/v5/asset/coin/query-info?' + qs, {
          headers: {'X-BAPI-API-KEY': keys.apiKey,'X-BAPI-SIGN': sig,'X-BAPI-TIMESTAMP': ts,'X-BAPI-RECV-WINDOW':'5000'},
          ms: 10000
        })).json();
        if (d && d.result && d.result.rows && d.result.rows.length) {
          var chains = d.result.rows[0].chains;
          if (chains) {
            var ch = chains.find(function(c){return c.chain===netCode||c.chain===net.label;});
            return ch ? parseFloat(ch.withdrawFee)||0 : null;
          }
        }

      } else if (excId === 'kucoin') {
        // KuCoin quotas chain param = chainId as returned by /v3/currencies (lowercase, e.g. "eth","trx","bsc")
        var kcChain = net ? (net.apiCode || net.key) : '';
        var ts = Date.now().toString();
        var pp = await __NX._wdHmac256b64(keys.secret, keys.passphrase||'');
        var path = '/api/v1/withdrawals/quotas?currency=' + sym + (kcChain ? '&chain=' + kcChain : '');
        var sig = await __NX._wdHmac256b64(keys.secret, ts + 'GET' + path);
        var d = await (await _nxSignedFetch('https://api.kucoin.com' + path, {
          headers: {'KC-API-KEY': keys.apiKey,'KC-API-SIGN': sig,'KC-API-TIMESTAMP': ts,'KC-API-PASSPHRASE': pp,'KC-API-KEY-VERSION':'2'},
          ms: 10000
        })).json();
        return d && d.data ? parseFloat(d.data.withdrawMinFee)||0 : null;

      } else if (excId === 'mexc') {
        var params = { timestamp: Date.now(), recvWindow: 10000 };
        var qs = Object.keys(params).map(function(k){return k+'='+params[k];}).join('&');
        var sig = await __NX._wdHmac256(keys.secret, qs);
        var d = await (await _nxSignedFetch('https://api.mexc.com/api/v3/capital/config/getall?' + qs + '&signature=' + sig, {
          headers: {'X-MEXC-APIKEY': keys.apiKey}, ms: 10000
        })).json();
        if (Array.isArray(d)) {
          var coin = d.find(function(c){return c.coin===sym;});
          if (coin && coin.networkList) {
            var nm = coin.networkList.find(function(n){return n.network===netCode;});
            return nm ? parseFloat(nm.withdrawFee)||0 : null;
          }
        }

      } else if (excId === 'gateio') {
        var gwRes = await (await _nxSignedFetch('https://api.gateio.ws/api/v4/wallet/withdraw_status?currency=' + sym, {
          ms: 10000
        })).json();
        if (Array.isArray(gwRes) && gwRes.length) {
          var gwData = gwRes[0];
          var gwFee = gwData.withdraw_fix_on_chains && gwData.withdraw_fix_on_chains[netCode];
          if (!gwFee) gwFee = gwData.withdraw_fix;
          return gwFee ? parseFloat(gwFee)||0 : null;
        }

      } else if (excId === 'bitget') {
        var d = await (await _nxSignedFetch('https://api.bitget.com/api/v2/spot/public/coins?coin=' + sym, {
          ms: 10000
        })).json();
        if (d && d.data && d.data.length) {
          var chains = d.data[0].chains;
          if (chains) {
            var ch = chains.find(function(c){return c.chain===netCode||c.chain.toUpperCase()===netCode;});
            return ch ? parseFloat(ch.withdrawFee)||0 : null;
          }
        }

      } else if (excId === 'htx') {
        var d = await (await _nxSignedFetch('https://api.huobi.pro/v2/reference/currencies?currency=' + sym.toLowerCase(), {
          ms: 10000
        })).json();
        if (d && d.data && d.data.length) {
          var chains = d.data[0].chains;
          if (chains) {
            var ch = chains.find(function(c){
              if (!c.chain) return false;
              var cl = c.chain.toLowerCase();
              var _htxKey = net ? (net.key || '').toLowerCase() : '';
              return cl === _htxKey || (_htxKey && cl.indexOf(_htxKey.slice(0,4)) !== -1) || cl.indexOf(netSub.toLowerCase()) !== -1 || cl.indexOf(netCode.toLowerCase().slice(0,4)) !== -1;
            });
            return ch ? parseFloat(ch.transactFeeWithdraw)||0 : null;
          }
        }

      } else if (excId === 'bingx') {
        var ts = Date.now().toString();
        var params = { timestamp: ts, coin: sym };
        var qs = Object.keys(params).sort().map(function(k){return k+'='+params[k];}).join('&');
        var sig = await __NX._wdHmac256(keys.secret, qs);
        var d = await (await _nxSignedFetch('https://open-api.bingx.com/openApi/wallets/v1/capital/config/getall?' + qs + '&signature=' + sig, {
          headers: {'X-BX-APIKEY': keys.apiKey}, ms: 10000
        })).json();
        if (d && d.data) {
          var coin = Array.isArray(d.data) ? d.data.find(function(c){return c.coin===sym;}) : null;
          if (coin && coin.networkList) {
            var nm = coin.networkList.find(function(n){return n.network===netCode;});
            return nm ? parseFloat(nm.withdrawFee)||0 : null;
          }
        }

      } else if (excId === 'phemex') {
        var d = await (await _nxSignedFetch('https://api.phemex.com/public/products', { ms: 10000 })).json();
        if (d && d.data && d.data.currencies) {
          var curr = d.data.currencies.find(function(c){return c.currency===sym;});
          if (curr && curr.networks) {
            var nm = curr.networks.find(function(n){return n.network&&(n.network.toUpperCase()===netCode||(net&&net.key&&n.network.toUpperCase()===net.key.toUpperCase()));});
            return nm ? parseFloat(nm.withdrawFee)||0 : null;
          }
        }


      } else if (excId === 'digifinex') {
        var ts3 = Math.floor(Date.now()/1000).toString();
        var enc3 = new TextEncoder();
        var buf3 = await crypto.subtle.digest('SHA-256', enc3.encode(keys.apiKey + ts3 + keys.secret));
        var sig3 = Array.from(new Uint8Array(buf3)).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
        var d3 = await (await _nxSignedFetch('https://openapi.digifinex.com/v3/withdraw/coins?coin_name=' + sym.toUpperCase(), {
          headers: {'ACCESS-KEY': keys.apiKey, 'ACCESS-SIGN': sig3, 'ACCESS-TIMESTAMP': ts3},
          ms: 10000
        })).json();
        if (d3 && Array.isArray(d3.data)) {
          var nm3 = d3.data.find(function(n){
            if (!n.chain) return false;
            var cl = n.chain.toUpperCase();
            return cl === netCode || cl.indexOf(netCode.slice(0,3)) !== -1 || cl.indexOf(netSub) !== -1;
          });
          return nm3 ? parseFloat(nm3.fee)||0 : null;
        }

      } else if (excId === 'lbank') {
        var d4 = await (await _nxSignedFetch('https://api.lbank.com/v2/withdrawConfigs.do?assetCode=' + sym.toLowerCase(), {
          ms: 10000
        })).json();
        if (d4 && d4.result === 'true' && Array.isArray(d4.data)) {
          var nm4 = d4.data.find(function(n){
            var raw = (n.netWork || n.network || n.chain || '').toUpperCase();
            return raw === netCode || raw.indexOf(netCode.slice(0,3)) !== -1 || raw.indexOf(netSub) !== -1;
          });
          return nm4 ? parseFloat(nm4.fee)||0 : null;
        }

      } else if (excId === 'bitfinex') {
        // Bitfinex: use conf/pub:map:currency:tx:fee:deposit (public endpoint, no auth needed)
        var bfFeeData = await (await _nxSignedFetch('https://api-pub.bitfinex.com/v2/conf/pub:map:currency:tx:fee', {
          ms: 10000
        })).json();
        if (Array.isArray(bfFeeData) && Array.isArray(bfFeeData[0])) {
          var bfEntry = bfFeeData[0].find(function(item){ return item[0] && item[0].toUpperCase() === sym.toUpperCase(); });
          if (bfEntry && Array.isArray(bfEntry[1])) {
            // bfEntry[1] = [[method, fee, minFee], ...] or [fee] depending on version
            // Try to match by netCode/net.key in method name
            var bfMatch = bfEntry[1].find(function(row){
              if (!Array.isArray(row)) return false;
              var meth = (row[0]||'').toUpperCase();
              return meth.indexOf(netCode) !== -1 || meth.indexOf(netSub.toUpperCase()) !== -1;
            });
            if (bfMatch) return parseFloat(bfMatch[1])||0;
            // fallback: first entry
            if (bfEntry[1][0]) return parseFloat(Array.isArray(bfEntry[1][0]) ? bfEntry[1][0][1] : bfEntry[1][0])||0;
          }
        }

      } else if (excId === 'kraken') {
        // Kraken: /0/private/WithdrawInfo needs address, skip fee lookup — use null (shows — )
        // Method names like 'Ether (ERC20)', 'USDT (TRC20)' can't be matched without address
        return null;

      } else if (excId === 'bitmart') {
        var dBm = await (await _nxSignedFetch('https://api-cloud.bitmart.com/account/v1/currencies', {
          ms: 10000
        })).json();
        if (dBm && dBm.data && Array.isArray(dBm.data.currencies)) {
          var rowBm = dBm.data.currencies.find(function(c){ return c.currency && c.currency.toUpperCase() === netCode; });
          if (rowBm) return parseFloat(rowBm.withdraw_fee) || 0;
        }

      }
    } catch(e) {}
    return null;
  }

  // ══════════════════════════════════════════════════════
  // ── Withdraw submit per exchange ──
  // ══════════════════════════════════════════════════════
  async function _wdSubmitExc(excId, sym, addr, amt, net, keys) {
    var netCode = net ? (net.apiCode || net.key).toUpperCase() : '';

    if (excId === 'binance') {
      // walletType: 0=Spot (default), 1=Funding
      // Use Spot first; if spot balance < amt, use Funding
      var binBal = window._wdBinanceBal || { spot: 0, funding: 0 };
      var walletType = (binBal.spot >= amt) ? 0 : 1;
      var params = { coin: sym, address: addr, amount: amt, network: netCode, walletType: walletType, timestamp: Date.now(), recvWindow: 10000 };
      var qs = Object.keys(params).map(function(k){return k+'='+encodeURIComponent(params[k]);}).join('&');
      var sig = await __NX._wdHmac256(keys.secret, qs);
      var res = await _nxSignedFetch('https://api.binance.com/sapi/v1/capital/withdraw/apply', {
        method:'POST', headers:{'X-MBX-APIKEY': keys.apiKey,'Content-Type':'application/x-www-form-urlencoded'},
        body: qs + '&signature=' + sig, ms: 15000
      });
      var d = await res.json();
      if (d && d.id) return { id: d.id };
      throw new Error(d.msg || JSON.stringify(d));

    } else if (excId === 'bybit') {
      // POST /v5/asset/withdraw/create — accountType=FUND (withdraw from Funding wallet)
      var ts = Date.now().toString();
      var body = JSON.stringify({ coin: sym, chain: netCode, address: addr, amount: String(amt), accountType: 'FUND' });
      var sig = await __NX._wdHmac256(keys.secret, ts + keys.apiKey + '5000' + body);
      var res = await _nxSignedFetch('https://api.bybit.com/v5/asset/withdraw/create', {
        method:'POST', headers:{'X-BAPI-API-KEY': keys.apiKey,'X-BAPI-SIGN': sig,'X-BAPI-TIMESTAMP': ts,'X-BAPI-RECV-WINDOW':'5000','Content-Type':'application/json'},
        body: body, ms: 15000
      });
      var d = await res.json();
      if (d && d.result && d.result.id) return { id: d.result.id };
      throw new Error((d.retMsg||d.ret_msg||JSON.stringify(d)));

    } else if (excId === 'kucoin') {
      // POST /api/v3/withdrawals — v3 uses chainId (lowercase short code e.g. 'eth','trx','opt','arb')
      // net.apiCode = ch.chainId from _kucoinChainsWd, which is exactly what v3 expects
      var ts = Date.now().toString();
      var pp = await __NX._wdHmac256b64(keys.secret, keys.passphrase||'');
      var chainCode = (net && net.apiCode) ? net.apiCode : net.key;
      var path = '/api/v3/withdrawals';
      var body = JSON.stringify({ currency: sym, address: addr, amount: String(amt), chain: chainCode, withdrawType: 'ADDRESS' });
      var sig = await __NX._wdHmac256b64(keys.secret, ts + 'POST' + path + body);
      var res = await _nxSignedFetch('https://api.kucoin.com' + path, {
        method:'POST', headers:{'KC-API-KEY': keys.apiKey,'KC-API-SIGN': sig,'KC-API-TIMESTAMP': ts,'KC-API-PASSPHRASE': pp,'KC-API-KEY-VERSION':'2','Content-Type':'application/json'},
        body: body, ms: 15000
      });
      var d = await res.json();
      if (d && d.data && d.data.withdrawalId) return { id: d.data.withdrawalId };
      throw new Error((d.msg||JSON.stringify(d)));

    } else if (excId === 'mexc') {
      // POST /api/v3/capital/withdraw/apply
      var params = { coin: sym, address: addr, amount: amt, network: netCode, timestamp: Date.now(), recvWindow: 10000 };
      var qs = Object.keys(params).map(function(k){return k+'='+encodeURIComponent(params[k]);}).join('&');
      var sig = await __NX._wdHmac256(keys.secret, qs);
      var res = await _nxSignedFetch('https://api.mexc.com/api/v3/capital/withdraw/apply', {
        method:'POST', headers:{'X-MEXC-APIKEY': keys.apiKey,'Content-Type':'application/x-www-form-urlencoded'},
        body: qs + '&signature=' + sig, ms: 15000
      });
      var d = await res.json();
      if (d && d.id) return { id: d.id };
      throw new Error(d.msg || JSON.stringify(d));

    } else if (excId === 'gateio') {
      // POST /api/v4/withdrawals
      var ts = Math.floor(Date.now()/1000).toString();
      var path = '/api/v4/withdrawals';
      var body = JSON.stringify({ currency: sym, address: addr, amount: String(amt), chain: netCode });
      var bodyHash = await __NX._wdSha512hex(body);
      var signStr = 'POST\n' + path + '\n\n' + bodyHash + '\n' + ts;
      var sig = await __NX._wdHmac512hex(keys.secret, signStr);
      var res = await _nxSignedFetch('https://api.gateio.ws' + path, {
        method:'POST', headers:{'KEY': keys.apiKey,'SIGN': sig,'Timestamp': ts,'Content-Type':'application/json'},
        body: body, ms: 15000
      });
      var d = await res.json();
      if (d && d.id) return { id: d.id };
      throw new Error((d.message||JSON.stringify(d)));

    } else if (excId === 'bitget') {
      // POST /api/v2/spot/wallet/withdrawal
      var ts = Date.now().toString();
      var path = '/api/v2/spot/wallet/withdrawal';
      var body = JSON.stringify({ coin: sym, address: addr, size: String(amt), chain: netCode, transferType: 'on_chain' });
      var sig = await __NX._wdHmac256b64(keys.secret, ts + 'POST' + path + body);
      var res = await _nxSignedFetch('https://api.bitget.com' + path, {
        method:'POST', headers:{'ACCESS-KEY': keys.apiKey,'ACCESS-SIGN': sig,'ACCESS-TIMESTAMP': ts,'ACCESS-PASSPHRASE': keys.passphrase||'','Content-Type':'application/json','locale':'en-US'},
        body: body, ms: 15000
      });
      var d = await res.json();
      if (d && d.data && d.data.orderId) return { id: d.data.orderId };
      throw new Error((d.msg||JSON.stringify(d)));

    } else if (excId === 'htx') {
      // POST /v1/dw/withdraw/api/create — signed query string
      var host = 'api.huobi.pro';
      var path = '/v1/dw/withdraw/api/create';
      var ts = new Date().toISOString().slice(0,19);
      var queryParams = { AccessKeyId: keys.apiKey, SignatureMethod:'HmacSHA256', SignatureVersion:'2', Timestamp: ts };
      var qs = Object.keys(queryParams).sort().map(function(k){return encodeURIComponent(k)+'='+encodeURIComponent(queryParams[k]);}).join('&');
      var signStr = 'POST\n' + host + '\n' + path + '\n' + qs;
      var sig = await __NX._wdHmac256b64(keys.secret, signStr);
      // HTX chain field: use raw apiCode from HTX chains API (baseChain e.g. 'usdterc20','trc20usdt','usdtbep20')
      // net.apiCode = ch.baseChain as returned by /v2/reference/currencies — exact value HTX expects
      var htxChain = (net && net.apiCode) ? net.apiCode.toLowerCase() : ((net && net.sub) ? (sym.toLowerCase() + net.sub.toLowerCase().replace(/[^a-z0-9]/g,'')) : netCode.toLowerCase());
      var body = JSON.stringify({ address: addr, amount: amt, currency: sym.toLowerCase(), chain: htxChain });
      var res = await _nxSignedFetch('https://' + host + path + '?' + qs + '&Signature=' + encodeURIComponent(sig), {
        method:'POST', headers:{'Content-Type':'application/json'}, body: body, ms: 15000
      });
      var d = await res.json();
      if (d && d.data) return { id: String(d.data) };
      throw new Error((d['err-msg']||JSON.stringify(d)));

    } else if (excId === 'bingx') {
      // POST /openApi/wallets/v1/capital/withdraw/apply
      // walletType: 1=Standard(Spot), 2=Fund — auto-select based on balance
      var bxBal = window._wdBingxBal || { spot: 0, funding: 0 };
      var bxWalletType = (bxBal.spot >= amt) ? '1' : '2';
      var ts = Date.now().toString();
      var params = { coin: sym, address: addr, amount: String(amt), network: netCode, walletType: bxWalletType, timestamp: ts, recvWindow: '10000' };
      var qs = Object.keys(params).sort().map(function(k){return k+'='+encodeURIComponent(params[k]);}).join('&');
      var sig = await __NX._wdHmac256(keys.secret, qs);
      var res = await _nxSignedFetch('https://open-api.bingx.com/openApi/wallets/v1/capital/withdraw/apply?' + qs + '&signature=' + sig, {
        method:'POST', headers:{'X-BX-APIKEY': keys.apiKey}, ms: 15000
      });
      var d = await res.json();
      if (d && d.data && d.data.id) return { id: d.data.id };
      throw new Error((d.msg||JSON.stringify(d)));

    } else if (excId === 'phemex') {
      // POST /phemex-user/users/spot/wallets/v1/withdrawals
      var expiry = (Date.now()+60000).toString();
      var path = '/phemex-user/users/spot/wallets/v1/withdrawals';
      var body = JSON.stringify({ currency: sym, address: addr, amount: String(amt), chainName: netCode });
      var sig = await __NX._wdHmac256(keys.secret, path + '' + expiry + body);
      var res = await _nxSignedFetch('https://api.phemex.com' + path, {
        method:'POST', headers:{'x-phemex-access-token': keys.apiKey,'x-phemex-request-signature': sig,'x-phemex-request-expiry': expiry,'Content-Type':'application/json'},
        body: body, ms: 15000
      });
      var d = await res.json();
      if (d && d.data && d.data.id) return { id: String(d.data.id) };
      if (d && d.data) return { id: String(d.data) };
      throw new Error((d.msg||d.message||JSON.stringify(d)));

    } else if (excId === 'digifinex') {
      // POST /v3/withdraw/create
      var ts = Math.floor(Date.now()/1000).toString();
      var enc = new TextEncoder();
      var buf = await crypto.subtle.digest('SHA-256', enc.encode(keys.apiKey + ts + keys.secret));
      var sig = Array.from(new Uint8Array(buf)).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
      var body = new URLSearchParams({ symbol: sym.toLowerCase(), amount: String(amt), address: addr, chain: netCode }).toString();
      var res = await _nxSignedFetch('https://openapi.digifinex.com/v3/withdraw/create', {
        method:'POST', headers:{'ACCESS-KEY': keys.apiKey,'ACCESS-SIGN': sig,'ACCESS-TIMESTAMP': ts,'Content-Type':'application/x-www-form-urlencoded'},
        body: body, ms: 15000
      });
      var d = await res.json();
      if (d && d.withdraw_id) return { id: String(d.withdraw_id) };
      throw new Error((d.errmsg||JSON.stringify(d)));

    } else if (excId === 'lbank') {
      // POST /v2/withdraw.do — LBank signing: MD5(sorted_params) → HMAC-SHA256(secret, MD5.toUpperCase())
      var ts = Date.now().toString();
      var echostr5 = (function(){ var c='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; var s=''; for(var i=0;i<35;i++) s+=c[Math.floor(Math.random()*c.length)]; return s; })();
      var lbWdParams = { api_key: keys.apiKey, signature_method: 'HmacSHA256', timestamp: ts, echostr: echostr5,
        assetCode: sym.toLowerCase(), amount: String(amt), address: addr, netWork: netCode };
      var lbWdSorted = Object.keys(lbWdParams).sort();
      var lbWdQs = lbWdSorted.map(function(k){return k+'='+lbWdParams[k];}).join('&');
      var lbWdMd5 = md5Hex(lbWdQs).toUpperCase();
      var sig = await hmacSha256(keys.secret, lbWdMd5);
      lbWdParams.sign = sig;
      var body = Object.keys(lbWdParams).map(function(k){return encodeURIComponent(k)+'='+encodeURIComponent(lbWdParams[k]);}).join('&');
      var res = await _nxSignedFetch('https://api.lbank.com/v2/withdraw.do', {
        method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: body, ms: 15000
      });
      var d = await res.json();
      if (d && d.result === 'true' && d.withdrawId) return { id: String(d.withdrawId) };
      throw new Error((d.error_code||JSON.stringify(d)));

    } else if (excId === 'bitfinex') {
      // POST /v2/auth/w/withdraw — Bitfinex v2, requires HMAC-SHA384
      var nonce = (Date.now() * 1000).toString(); // microsecond nonce
      var path = '/v2/auth/w/withdraw';
      var body = JSON.stringify({ wallet: 'exchange', method: net.label, amount: String(amt), address: addr });
      var preSign = '/api' + path + nonce + body;
      var sig = await hmacSha384Hex(keys.secret, preSign);
      var res = await _nxSignedFetch('https://api.bitfinex.com' + path, {
        method:'POST', headers:{'bfx-nonce': nonce,'bfx-apikey': keys.apiKey,'bfx-signature': sig,'Content-Type':'application/json'},
        body: body, ms: 15000
      });
      var d = await res.json();
      // Response: [MTS, TYPE, MSG_ID, null, [[WD_ID, ...]], CODE, STATUS, TEXT]
      if (Array.isArray(d) && d[6] && d[6].toLowerCase()==='success') return { id: String(d[4]&&d[4][0]&&d[4][0][0]||'ok') };
      throw new Error((d[7]||JSON.stringify(d)));

    } else if (excId === 'kraken') {
      // POST /0/private/Withdraw
      var nonce = Date.now().toString();
      var path = '/0/private/Withdraw';
      var krakenMap = {'USDT':'USDT','BTC':'XBT','ETH':'ETH','BNB':'BNB','USDC':'USDC','SOL':'SOL','XRP':'XRP'};
      var asset = krakenMap[sym] || sym;
      // Kraken requires a pre-saved withdrawal address KEY NAME (not raw address)
      // User must save the address in Kraken first, then enter the key name here
      var postData = 'nonce=' + nonce + '&asset=' + asset + '&key=' + encodeURIComponent(addr) + '&amount=' + amt;
      var enc2 = new TextEncoder();
      var sha256buf = await crypto.subtle.digest('SHA-256', enc2.encode(nonce + postData));
      var msgToSign = path + String.fromCharCode.apply(null, new Uint8Array(sha256buf));
      var sig = await __NX._wdHmac512b64(keys.secret, msgToSign);
      var res = await _nxSignedFetch('https://api.kraken.com' + path, {
        method:'POST', headers:{'API-Key': keys.apiKey,'API-Sign': sig,'Content-Type':'application/x-www-form-urlencoded'},
        body: postData, ms: 15000
      });
      var d = await res.json();
      if (d && d.result && d.result.refid) return { id: d.result.refid };
      throw new Error((d.error&&d.error[0]||JSON.stringify(d)));

    } else if (excId === 'coinbase') {
      // POST /withdrawals/crypto — official Coinbase Exchange API endpoint
      // (confirmed in docs: amount, currency, crypto_address, network are accepted body fields).
      // NOTE: signing inlined locally (cross-IIFE scope leak avoidance —
      // _coinbaseSign/_coinbaseHeaders live in the deposit/withdraw-chains module).
      var cbPath = '/withdrawals/crypto';
      var cbBody = { amount: String(amt), currency: sym, crypto_address: addr };
      if (netCode) cbBody.network = netCode.toLowerCase();
      var cbBodyStr = JSON.stringify(cbBody);
      var cbTs = Math.floor(Date.now()/1000).toString();
      var cbSig = await __NX._wdHmac256b64(keys.secret, cbTs + 'POST' + cbPath + cbBodyStr);
      var res = await _nxSignedFetch('https://api.exchange.coinbase.com' + cbPath, {
        method: 'POST',
        headers: { 'CB-ACCESS-KEY': keys.apiKey, 'CB-ACCESS-SIGN': cbSig, 'CB-ACCESS-TIMESTAMP': cbTs, 'CB-ACCESS-PASSPHRASE': keys.passphrase||'', 'Content-Type': 'application/json' },
        body: cbBodyStr, ms: 15000
      });
      var d = await res.json();
      if (d && d.id) return { id: d.id };
      throw new Error((d && (d.message || JSON.stringify(d))) || 'Withdraw rejected by Coinbase');
    } else if (excId === 'bitmart') {
      return await _bitmartWithdraw(sym, netCode, addr, amt, keys);
    }

    throw new Error('Withdraw not yet implemented for ' + excId);
  }
})((window.__nxp = window.__nxp || {}).mod_withdraw_modal = window.__nxp.mod_withdraw_modal || {});
