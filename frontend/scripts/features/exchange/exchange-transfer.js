
    // ═══════════════════════════════════════════════════
    //  TRANSFER PAGE — Internal Account Transfer
    //  Per-exchange accounts, real signed API calls
    // ═══════════════════════════════════════════════════
    (function() {

    // ─────────────────────────────────────────────────
    //  EXCHANGE TRANSFER CONFIG
    //  Each entry defines which account types exist and
    //  how to build a signed transfer request.
    //  accounts: array of {id, label} shown in picker.
    //  If null → exchange has no internal transfer API.
    // ─────────────────────────────────────────────────
    var EXC_TRF_CFG = {

      binance: {
        accounts: [
          { id:'FUNDING',     label:'Funding' },
          { id:'SPOT',        label:'Spot' },
          { id:'USDT_FUTURE', label:'Futures (USDT-M)' }
        ],
        defaultFrom: 'FUNDING', defaultTo: 'SPOT',
        build: async function(keys, coin, amount, fromId, toId) {
          var ts = String(Date.now());
          var type = fromId + '_TO_' + toId;
          var qs = 'type='+encodeURIComponent(type)+'&asset='+encodeURIComponent(coin)+'&amount='+encodeURIComponent(amount)+'&timestamp='+ts+'&recvWindow=10000';
          var sig = await _hmac(keys.secret, qs);
          return {
            url: 'https://api.binance.com/sapi/v1/asset/transfer?' + qs + '&signature=' + sig,
            method: 'POST', body: null,
            headers: { 'X-MBX-APIKEY': keys.apiKey, 'Content-Type': 'application/json' }
          };
        },
        parse: function(data) {
          if (data.tranId) return { ok:true, id:String(data.tranId) };
          return { ok:false, msg: data.msg || JSON.stringify(data) };
        }
      },

      kucoin: {
        accounts: [
          { id:'main',     label:'Funding (Main)' },
          { id:'trade',    label:'Spot (Trade)' },
          { id:'contract', label:'Futures' }
        ],
        defaultFrom: 'main', defaultTo: 'trade',
        build: async function(keys, coin, amount, fromId, toId) {
          var ts = String(Date.now());
          var clientOid = 'nx' + ts + Math.random().toString(36).slice(2,6);
          var endpoint = '/api/v2/accounts/inner-transfer';
          var bodyObj = { clientOid:clientOid, currency:coin, from:fromId, to:toId, amount:String(amount) };
          var bodyStr = JSON.stringify(bodyObj);
          var preSign = ts + 'POST' + endpoint + bodyStr;
          var sig = await _hmacB64(keys.secret, preSign);
          var ppSign = await _hmacB64(keys.secret, keys.passphrase||'');
          return {
            url: 'https://api.kucoin.com' + endpoint,
            method: 'POST', body: bodyStr,
            headers: { 'KC-API-KEY':keys.apiKey, 'KC-API-SIGN':sig, 'KC-API-TIMESTAMP':ts,
                       'KC-API-PASSPHRASE':ppSign, 'KC-API-KEY-VERSION':'2', 'Content-Type':'application/json' }
          };
        },
        parse: function(data) {
          if (data.code === '200000') return { ok:true, id:(data.data||{}).orderId||'' };
          return { ok:false, msg: data.msg || data.code };
        }
      },

      mexc: {
        accounts: [
          { id:'SPOT',    label:'Spot' },
          { id:'FUTURES', label:'Futures' }
        ],
        defaultFrom: 'SPOT', defaultTo: 'FUTURES',
        build: async function(keys, coin, amount, fromId, toId) {
          var ts = String(Date.now());
          var qs = 'fromAccountType='+fromId+'&toAccountType='+toId+'&asset='+encodeURIComponent(coin)+'&amount='+encodeURIComponent(amount)+'&timestamp='+ts+'&recvWindow=10000';
          var sig = await _hmac(keys.secret, qs);
          return {
            url: 'https://api.mexc.com/api/v3/capital/transfer?' + qs + '&signature=' + sig,
            method: 'POST', body: null,
            headers: { 'X-MEXC-APIKEY':keys.apiKey, 'Content-Type':'application/json' }
          };
        },
        parse: function(data) {
          if (data.code === 200 || data.tranId) return { ok:true, id:String(data.tranId||'') };
          return { ok:false, msg: data.msg || JSON.stringify(data) };
        }
      },

      bybit: {
        accounts: [
          { id:'FUND',    label:'Funding' },
          { id:'SPOT',    label:'Spot' },
          { id:'UNIFIED', label:'Unified (Futures)' }
        ],
        defaultFrom: 'FUND', defaultTo: 'SPOT',
        build: async function(keys, coin, amount, fromId, toId) {
          var ts = String(Date.now());
          var recvWindow = '5000';
          var transferId = 'nx-' + ts + '-' + Math.random().toString(36).slice(2,8);
          var bodyObj = { transferId:transferId, coin:coin, amount:String(amount), fromAccountType:fromId, toAccountType:toId };
          var bodyStr = JSON.stringify(bodyObj);
          var preSign = ts + keys.apiKey + recvWindow + bodyStr;
          var sig = await _hmac(keys.secret, preSign);
          return {
            url: 'https://api.bybit.com/v5/asset/transfer/inter-transfer',
            method: 'POST', body: bodyStr,
            headers: { 'X-BAPI-API-KEY':keys.apiKey, 'X-BAPI-SIGN':sig,
                       'X-BAPI-TIMESTAMP':ts, 'X-BAPI-RECV-WINDOW':recvWindow, 'Content-Type':'application/json' }
          };
        },
        parse: function(data) {
          if (data.retCode === 0) return { ok:true, id:((data.result||{}).transferId)||'' };
          return { ok:false, msg: data.retMsg || ('retCode:'+data.retCode) };
        }
      },

      bitget: {
        accounts: [
          { id:'funding',  label:'Funding' },
          { id:'spot',     label:'Spot' },
          { id:'mix_usdt', label:'Futures (USDT-M)' }
        ],
        defaultFrom: 'funding', defaultTo: 'spot',
        build: async function(keys, coin, amount, fromId, toId) {
          var endpoint = '/api/v2/account/transfer';
          var isoTs = new Date().toISOString().replace(/\.\d{3}/, '.000');
          var bodyObj = { fromType:fromId, toType:toId, amount:String(amount), coin:coin };
          var bodyStr = JSON.stringify(bodyObj);
          var preSign = isoTs + 'POST' + endpoint + bodyStr;
          var sig = await _hmacB64(keys.secret, preSign);
          return {
            url: 'https://api.bitget.com' + endpoint,
            method: 'POST', body: bodyStr,
            headers: { 'ACCESS-KEY':keys.apiKey, 'ACCESS-SIGN':sig, 'ACCESS-TIMESTAMP':isoTs,
                       'ACCESS-PASSPHRASE':keys.passphrase||'', 'Content-Type':'application/json' }
          };
        },
        parse: function(data) {
          if (data.code === '00000') return { ok:true, id:(data.data||{}).transferId||'' };
          return { ok:false, msg: data.msg || data.code };
        }
      },

      bingx: {
        // walletType: 1=fund, 2=standard(spot), 3=perpetual(futures)
        accounts: [
          { id:'1', label:'Fund' },
          { id:'2', label:'Standard (Spot)' },
          { id:'3', label:'Perpetual (Futures)' }
        ],
        defaultFrom: '1', defaultTo: '2',
        build: async function(keys, coin, amount, fromId, toId) {
          var ts = String(Date.now());
          var params = { coin:coin, amount:String(amount), walletType:fromId, targetWalletType:toId, timestamp:ts };
          var qs = Object.keys(params).sort().map(function(k){ return k+'='+encodeURIComponent(params[k]); }).join('&');
          var sig = await _hmac(keys.secret, qs);
          return {
            url: 'https://open-api.bingx.com/openApi/wallets/v1/capital/innerTransfer/apply?' + qs + '&signature=' + sig,
            method: 'POST', body: null,
            headers: { 'X-BX-APIKEY':keys.apiKey, 'Content-Type':'application/json' }
          };
        },
        parse: function(data) {
          if (data.code === 0) return { ok:true, id:String((data.data||{}).transferId||'') };
          return { ok:false, msg: data.msg || ('code:'+data.code) };
        }
      },

      gateio: {
        // Gate.io: no funding account. spot <-> futures (settle=usdt)
        accounts: [
          { id:'spot',    label:'Spot' },
          { id:'futures', label:'Futures (USDT)' }
        ],
        defaultFrom: 'spot', defaultTo: 'futures',
        build: async function(keys, coin, amount, fromId, toId) {
          var ts = String(Date.now());
          var endpoint = '/api/v4/wallet/transfers';
          // futures needs settle param
          var bodyObj = { currency:coin, from:fromId, to:toId, amount:String(amount) };
          if (fromId === 'futures' || toId === 'futures') bodyObj.settle = 'usdt';
          var bodyStr = JSON.stringify(bodyObj);
          var bodyHash = await crypto.subtle.digest('SHA-512', new TextEncoder().encode(bodyStr))
            .then(function(b){ return Array.from(new Uint8Array(b)).map(function(x){return x.toString(16).padStart(2,'0');}).join(''); });
          var qs = '';
          var preSign = 'POST\n' + endpoint + '\n' + qs + '\n' + bodyHash + '\n' + ts;
          var sig = await _hmac(keys.secret, preSign);
          return {
            url: 'https://api.gateio.ws' + endpoint,
            method: 'POST', body: bodyStr,
            headers: { 'KEY':keys.apiKey, 'SIGN':sig, 'Timestamp':ts, 'Content-Type':'application/json' }
          };
        },
        parse: function(data) {
          // Gate.io returns empty 204 on success, or error object
          if (!data || (Array.isArray(data) && !data.length)) return { ok:true };
          if (data.label) return { ok:false, msg: data.message || data.label };
          return { ok:true };
        }
      },

      htx: {
        // HTX: spot IS the main account. spot <-> linear-swap (futures)
        accounts: [
          { id:'spot',        label:'Spot' },
          { id:'linear-swap', label:'Futures (Linear)' }
        ],
        defaultFrom: 'spot', defaultTo: 'linear-swap',
        build: async function(keys, coin, amount, fromId, toId) {
          var endpoint = '/v2/account/transfer';
          var nonce = new Date().toISOString().replace(/\.\d{3}Z/, '');
          var qs = 'AccessKeyId='+encodeURIComponent(keys.apiKey)+'&SignatureMethod=HmacSHA256&SignatureVersion=2&Timestamp='+encodeURIComponent(nonce);
          var preSign = 'POST\napi.huobi.pro\n' + endpoint + '\n' + qs;
          var sig = await _hmac(keys.secret, preSign);
          var bodyObj = {
            'from-account-type': fromId,
            'to-account-type': toId,
            'currency': coin.toLowerCase(),
            'amount': String(amount)
          };
          return {
            url: 'https://api.huobi.pro' + endpoint + '?' + qs + '&Signature=' + encodeURIComponent(sig),
            method: 'POST', body: JSON.stringify(bodyObj),
            headers: { 'Content-Type':'application/json' }
          };
        },
        parse: function(data) {
          if (data.status === 'ok') return { ok:true, id:String(data.data||'') };
          return { ok:false, msg: data['err-msg'] || data.message || JSON.stringify(data) };
        }
      },

      phemex: {
        // Phemex: spot <-> contract. POST /assets/transfer
        accounts: [
          { id:'SpotAccount',     label:'Spot' },
          { id:'ContractAccount', label:'Futures' }
        ],
        defaultFrom: 'SpotAccount', defaultTo: 'ContractAccount',
        build: async function(keys, coin, amount, fromId, toId) {
          var ts = String(Date.now());
          var expiry = String(parseInt(ts) + 60000);
          var endpoint = '/assets/transfer';
          // moveOp: 1=spot->contract, 2=contract->spot
          var moveOp = (fromId === 'SpotAccount') ? 1 : 2;
          var bodyObj = { currency:coin, amount:String(amount), moveOp:moveOp };
          var bodyStr = JSON.stringify(bodyObj);
          var preSign = endpoint + '' + expiry + bodyStr;
          var sig = await _hmac(keys.secret, preSign);
          return {
            url: 'https://api.phemex.com' + endpoint,
            method: 'POST', body: bodyStr,
            headers: { 'x-phemex-access-token':keys.apiKey, 'x-phemex-request-expiry':expiry,
                       'x-phemex-request-signature':sig, 'Content-Type':'application/json' }
          };
        },
        parse: function(data) {
          if (data.code === 0) return { ok:true };
          return { ok:false, msg: data.msg || ('code:'+data.code) };
        }
      },

      bitfinex: {
        // Bitfinex: exchange(spot) <-> margin <-> funding(lending)
        accounts: [
          { id:'exchange', label:'Exchange (Spot)' },
          { id:'margin',   label:'Margin' },
          { id:'funding',  label:'Funding (Lending)' }
        ],
        defaultFrom: 'exchange', defaultTo: 'margin',
        build: async function(keys, coin, amount, fromId, toId) {
          var endpoint = '/v2/auth/w/transfer';
          var nonce = (Date.now() * 1000).toString();
          var bodyObj = { from:fromId, to:toId, currency:coin, currency_to:coin, amount:String(amount) };
          var bodyStr = JSON.stringify(bodyObj);
          var preSign = '/api' + endpoint + nonce + bodyStr;
          var enc = new TextEncoder();
          var kb = enc.encode(keys.secret);
          var mb = enc.encode(preSign);
          var ck = await crypto.subtle.importKey('raw', kb, {name:'HMAC',hash:'SHA-384'}, false, ['sign']);
          var sg = await crypto.subtle.sign('HMAC', ck, mb);
          var sig = Array.from(new Uint8Array(sg)).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
          return {
            url: 'https://api.bitfinex.com' + endpoint,
            method: 'POST', body: bodyStr,
            headers: { 'bfx-nonce':nonce, 'bfx-apikey':keys.apiKey, 'bfx-signature':sig,
                       'Content-Type':'application/json' }
          };
        },
        parse: function(data) {
          if (Array.isArray(data) && data[0] === 1) return { ok:true };
          if (Array.isArray(data) && data[0] === 0) return { ok:false, msg: data[2]||'Transfer failed' };
          return { ok:false, msg: JSON.stringify(data) };
        }
      },

      kraken: {
        // Kraken Spot API has WalletTransfer (Spot→Futures only). Reverse
        // direction needs a separate Kraken Futures API key/auth scheme
        // (futures.kraken.com) which this wallet doesn't store — block it
        // client-side with a clear message instead of a confusing API error.
        accounts: [
          { id:'spot',    label:'Spot' },
          { id:'futures', label:'Futures' }
        ],
        defaultFrom: 'spot', defaultTo: 'futures',
        build: async function(keys, coin, amount, fromId, toId) {
          if (fromId !== 'spot' || toId !== 'futures') {
            throw new Error('Futures→Spot needs a separate Kraken Futures API key — do this one in the Kraken app.');
          }
          var nonce = String(Date.now());
          var endpoint = '/0/private/WalletTransfer';
          var bodyObj = { nonce:nonce, asset:coin, from:'Spot Wallet', to:'Futures Wallet', amount:String(amount) };
          var postdata = Object.keys(bodyObj).map(function(k){ return k+'='+encodeURIComponent(bodyObj[k]); }).join('&');
          var enc = new TextEncoder();
          var shaBuf = await crypto.subtle.digest('SHA-256', enc.encode(nonce + postdata));
          var pathBuf = enc.encode(endpoint);
          var msg = new Uint8Array(pathBuf.length + shaBuf.byteLength);
          msg.set(pathBuf, 0);
          msg.set(new Uint8Array(shaBuf), pathBuf.length);
          var secretBytes = Uint8Array.from(atob(keys.secret), function(c){ return c.charCodeAt(0); });
          var ck = await crypto.subtle.importKey('raw', secretBytes, {name:'HMAC',hash:'SHA-512'}, false, ['sign']);
          var sgBuf = await crypto.subtle.sign('HMAC', ck, msg);
          var sig = btoa(String.fromCharCode.apply(null, new Uint8Array(sgBuf)));
          return {
            url: 'https://api.kraken.com' + endpoint,
            method: 'POST', body: postdata,
            headers: { 'API-Key':keys.apiKey, 'API-Sign':sig, 'Content-Type':'application/x-www-form-urlencoded' }
          };
        },
        parse: function(data) {
          if (data.error && data.error.length) return { ok:false, msg: data.error.join(', ') };
          return { ok:true, id: data.result && data.result.refid };
        }
      },

      bitmart: {
        // BitMart Spot↔Futures transfer lives on the v2 (futures) base URL,
        // same X-BM-KEY/SIGN/TIMESTAMP/MEMO scheme as the rest of the wallet's
        // BitMart calls (ts + '#' + memo + '#' + body, HMAC-SHA256 hex).
        accounts: [
          { id:'spot',     label:'Spot' },
          { id:'contract', label:'Futures' }
        ],
        defaultFrom: 'spot', defaultTo: 'contract',
        build: async function(keys, coin, amount, fromId, toId) {
          var ts = Date.now().toString();
          var endpoint = '/account/v1/transfer-contract';
          var type = (fromId === 'spot') ? 'spot_to_contract' : 'contract_to_spot';
          var bodyObj = { currency:coin, amount:String(amount), type:type };
          var bodyStr = JSON.stringify(bodyObj);
          var signStr = ts + '#' + (keys.passphrase||'') + '#' + bodyStr;
          var sig = await _hmac(keys.secret, signStr);
          return {
            url: 'https://api-cloud-v2.bitmart.com' + endpoint,
            method: 'POST', body: bodyStr,
            headers: { 'X-BM-KEY':keys.apiKey, 'X-BM-SIGN':sig, 'X-BM-TIMESTAMP':ts, 'Content-Type':'application/json' }
          };
        },
        parse: function(data) {
          if (data.code === 1000) return { ok:true };
          return { ok:false, msg: data.message || ('code:'+data.code) };
        }
      },

      digifinex: {
        // DigiFinex /v3/transfer officially supports Spot↔Margin↔OTC only
        // (margin↔OTC blocked exchange-side). Perpetual Swap transfer lives
        // on a different, undocumented-here endpoint, so no Futures account
        // is offered — Spot↔Margin is what's actually confirmed to work.
        accounts: [
          { id:'1', label:'Spot' },
          { id:'2', label:'Margin' }
        ],
        defaultFrom: '1', defaultTo: '2',
        build: async function(keys, coin, amount, fromId, toId) {
          var ts = Math.floor(Date.now()/1000).toString();
          var endpoint = '/transfer';
          var bodyObj = { currency_mark:coin, num:String(amount), from:fromId, to:toId };
          var qs = Object.keys(bodyObj).map(function(k){ return k+'='+encodeURIComponent(bodyObj[k]); }).join('&');
          var sig = await _hmac(keys.secret, qs);
          return {
            url: 'https://openapi.digifinex.com/v3' + endpoint,
            method: 'POST', body: qs,
            headers: { 'ACCESS-KEY':keys.apiKey, 'ACCESS-SIGN':sig, 'ACCESS-TIMESTAMP':ts, 'Content-Type':'application/x-www-form-urlencoded' }
          };
        },
        parse: function(data) {
          if (data.code === 0) return { ok:true };
          return { ok:false, msg: 'code:' + data.code };
        }
      },

      // ── Exchanges with no internal transfer API (verified) ──
      coinbase:  null,   // Exchange API key is profile-scoped; no same-key spot↔derivatives transfer (Advanced Trade's separate "portfolios" feature is a different product/auth)
      lbank:     null,   // Spot v1/v2 REST docs have no transfer endpoint; UI/API-key "Transfer" scope likely maps to internal account-to-account send, not Spot↔Futures
    };

    // ─────────────────────────────────────────────────
    //  PORTFOLIO TAB — per-exchange account-type list
    //  Drives the dynamic sub-tabs after "Overview" (Funding/
    //  Trading/Future etc.) inside the Portfolio panel. "Overview"
    //  itself is always shown (handled separately, not listed here)
    //  and always shows the blended/all-accounts view.
    //
    //  Each entry's `type` tells _loadPortAccountBalance() which
    //  branch to use:
    //    'funding' → exchange's funding/main wallet
    //    'spot'    → spot/trading wallet only
    //    'futures' → derivatives wallet (delegates to FUT module
    //                where one already exists, to avoid duplicating
    //                the 17-exchange futures-balance logic)
    //    'margin'  → margin wallet (Bitfinex margin, DigiFinex margin)
    //    'unified' → Bybit-style combined spot+derivatives wallet
    // ─────────────────────────────────────────────────
    var EXC_PORT_CFG = {
      binance:   [ {id:'funding', label:'Funding', type:'funding'}, {id:'spot', label:'Spot', type:'spot'}, {id:'futures', label:'Futures (USDT-M)', type:'futures'} ],
      kucoin:    [ {id:'funding', label:'Funding', type:'funding'}, {id:'spot', label:'Spot', type:'spot'}, {id:'futures', label:'Futures', type:'futures'} ],
      mexc:      [ {id:'spot', label:'Spot', type:'spot'}, {id:'futures', label:'Futures', type:'futures'} ],
      bybit:     [ {id:'funding', label:'Funding', type:'funding'}, {id:'futures', label:'Unified (Spot + Futures)', type:'unified'} ],
      bitget:    [ {id:'funding', label:'Funding', type:'funding'}, {id:'spot', label:'Spot', type:'spot'}, {id:'futures', label:'Futures (USDT-M)', type:'futures'} ],
      bingx:     [ {id:'funding', label:'Funding', type:'funding'}, {id:'spot', label:'Spot', type:'spot'}, {id:'futures', label:'Futures', type:'futures'} ],
      gateio:    [ {id:'spot', label:'Spot', type:'spot'}, {id:'futures', label:'Futures', type:'futures'} ],
      htx:       [ {id:'spot', label:'Spot', type:'spot'}, {id:'futures', label:'Futures', type:'futures'} ],
      phemex:    [ {id:'spot', label:'Spot', type:'spot'}, {id:'futures', label:'Futures', type:'futures'} ],
      bitfinex:  [ {id:'spot', label:'Exchange', type:'spot'}, {id:'margin', label:'Margin', type:'margin'}, {id:'funding', label:'Funding', type:'funding'} ],
      kraken:    [ {id:'spot', label:'Spot', type:'spot'}, {id:'futures', label:'Futures', type:'futures'} ],
      bitmart:   [ {id:'spot', label:'Spot', type:'spot'}, {id:'futures', label:'Futures', type:'futures'} ],
      digifinex: [ {id:'spot', label:'Spot', type:'spot'}, {id:'margin', label:'Margin', type:'margin'} ],
      coinbase:  [ {id:'spot', label:'Spot', type:'spot'} ],
      lbank:     [ {id:'spot', label:'Spot', type:'spot'} ],
    };

    function _getPortCfg(excId) {
      return EXC_PORT_CFG[excId] || [ {id:'spot', label:'Spot', type:'spot'} ];
    }
    // Exposed globally — EXC_PORT_CFG/​_getPortCfg are defined inside the
    // Transfer module's own closure, but the Portfolio tab's dynamic
    // sub-tab rendering lives inside the separate `EXC` module closure
    // and needs to read this same per-exchange account list.
    window.EXC_PORT_CFG = EXC_PORT_CFG;
    window._getPortCfg = _getPortCfg;

    // ─────────────────────────────────────────────────
    //  HMAC helpers
    // ─────────────────────────────────────────────────
    async function _hmac(secret, message) {
      var enc = new TextEncoder();
      var ck  = await crypto.subtle.importKey('raw', enc.encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
      var sg  = await crypto.subtle.sign('HMAC', ck, enc.encode(message));
      return Array.from(new Uint8Array(sg)).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
    }
    async function _hmacB64(secret, message) {
      var enc = new TextEncoder();
      var ck  = await crypto.subtle.importKey('raw', enc.encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
      var sg  = await crypto.subtle.sign('HMAC', ck, enc.encode(message));
      return btoa(String.fromCharCode.apply(null, new Uint8Array(sg)));
    }

    // ─────────────────────────────────────────────────
    //  STATE
    // ─────────────────────────────────────────────────
    var _state = {
      from: null,
      to:   null,
      coin: { sym:'USDT', name:'Tether USD', icon:'₮', color:'#26a17b', free:0 },
      pickerTarget: null,
      excId: null,
      accounts: []   // current exchange account list
    };

    // ─────────────────────────────────────────────────
    //  ACCOUNT HELPERS
    // ─────────────────────────────────────────────────
    function _getCfg(excId) {
      return EXC_TRF_CFG[excId] || null;
    }

    function _acctLabel(id) {
      var a = _state.accounts.find(function(x){ return x.id === id; });
      return a ? a.label : id;
    }

    // ─────────────────────────────────────────────────
    //  INIT per exchange — called on trfOpen() and
    //  whenever the active exchange changes
    // ─────────────────────────────────────────────────
    function _initForExchange(excId) {
      _state.excId = excId;
      _state._bgLoadTried = false;
      var cfg = _getCfg(excId);

      var noTrfEl  = document.getElementById('trf-no-transfer-msg');
      var formEl   = document.getElementById('trf-form-wrap');
      var histBtn  = document.getElementById('trf-hist-btn');

      if (!cfg) {
        // Exchange doesn't support internal transfer
        if (noTrfEl) {
          noTrfEl.style.display = 'flex';
          var nameEl = noTrfEl.querySelector('#trf-no-trf-name');
          if (nameEl) {
            // Get exchange display name
            var excName = excId.charAt(0).toUpperCase() + excId.slice(1);
            try {
              var excs = window.EXC && window.EXC.getState ? null : null;
              // Try to get from EXCHANGES config via EXC
              if (window.EXC && typeof window.EXC._getExchangeName === 'function') excName = window.EXC._getExchangeName(excId);
            } catch(e) {}
            nameEl.textContent = excName;
          }
        }
        if (formEl) formEl.style.display = 'none';
        return;
      }

      if (noTrfEl) noTrfEl.style.display = 'none';
      if (formEl) formEl.style.display = 'block';

      _state.accounts = cfg.accounts;
      _state.from = cfg.defaultFrom;
      _state.to   = cfg.defaultTo;

      var inp = document.getElementById('trf-amount-input');
      if (inp) inp.value = '';

      _renderAccounts();
      _loadAvailableBalance();
    }

    // ─────────────────────────────────────────────────
    //  BALANCE — fetch from Funding account balance
    //  Uses portfolio cache for spot; for funding uses
    //  exchange-specific funding balance if available.
    // ─────────────────────────────────────────────────
    function _availableCoins() {
      try {
        var excId = _state.excId;
        var cache = window._portfolioCache || (window.EXC && window.EXC._portfolioCache);
        var entry = (cache && excId) ? cache[excId] : null;
        if (entry) {
          // Prefer a real per-account (Funding/Spot/Futures) breakdown when
          // the exchange's fetch provides one, so Coin From reflects the
          // sub-account actually selected — not one merged balance list.
          if (entry.byAccount) {
            var sub = entry.byAccount[_state.from];
            return (sub||[]).map(function(a) {
              return { sym:a.asset, name:a.asset, free:parseFloat(a.free)||0, color:'#6366f1', glyph:a.asset.slice(0,1) };
            });
          }
          if (entry.assets && entry.assets.length) {
            return entry.assets.map(function(a) {
              return { sym:a.asset, name:a.asset, free:parseFloat(a.free)||0, color:'#6366f1', glyph:a.asset.slice(0,1) };
            });
          }
        }
      } catch(e) {}
      return [
        { sym:'USDT', name:'Tether USD',  free:0, color:'#26a17b', glyph:'₮' },
        { sym:'BTC',  name:'Bitcoin',     free:0, color:'#f0b90b', glyph:'₿' },
        { sym:'ETH',  name:'Ethereum',    free:0, color:'#627eea', glyph:'Ξ' }
      ];
    }

    function _loadAvailableBalance() {
      // Try to pick a coin from the portfolio cache
      var coins = _availableCoins();
      // Prefer USDT as default
      var preferred = coins.find(function(c){ return c.sym === 'USDT' && c.free > 0; })
                   || coins.find(function(c){ return c.free > 0; })
                   || coins[0]
                   || { sym:'USDT', name:'Tether USD', free:0, color:'#26a17b', glyph:'₮' };
      _state.coin = { sym:preferred.sym, name:preferred.name||preferred.sym, free:preferred.free||0,
                      icon:preferred.glyph||preferred.sym.slice(0,1), color:preferred.color||'#6366f1' };
      _renderCoinSelection();

      // No cached balances for this exchange yet (e.g. user opened Transfer
      // without visiting Portfolio first) — fetch once in the background via
      // the same loader Portfolio uses, then re-render with real data.
      var excId = _state.excId;
      var cache = window.EXC && window.EXC._portfolioCache;
      if (excId && !_state._bgLoadTried && (!cache || !cache[excId]) &&
          window.EXC && typeof window.EXC.loadPortfolio === 'function') {
        _state._bgLoadTried = true;
        window.EXC.loadPortfolio().then(function() {
          if (_state.excId !== excId) return;
          _loadAvailableBalance();
          var ov = document.getElementById('trf-coin-overlay');
          if (ov && ov.style.display !== 'none') {
            _coinListCache = _availableCoins();
            _renderCoinList(_coinListCache);
          }
        }).catch(function(){ _state._bgLoadTried = false; });
      }
    }

    // ─────────────────────────────────────────────────
    //  RENDER
    // ─────────────────────────────────────────────────
    function _renderAccounts() {
      var fromEl = document.getElementById('trf-from-label');
      var toEl   = document.getElementById('trf-to-label');
      if (fromEl) fromEl.textContent = _acctLabel(_state.from);
      if (toEl)   toEl.textContent   = _acctLabel(_state.to);
      _updateConfirmState();
    }

    function _renderCoinSelection() {
      var iconEl     = document.getElementById('trf-coin-icon');
      var symEl      = document.getElementById('trf-coin-sym');
      var nameEl     = document.getElementById('trf-coin-name');
      var unitEl     = document.getElementById('trf-amount-unit');
      var availSymEl = document.getElementById('trf-available-sym');
      var availAmtEl = document.getElementById('trf-available-amt');
      var warnEl     = document.getElementById('trf-warning');

      if (iconEl)     { iconEl.style.background = _state.coin.color; iconEl.textContent = _state.coin.icon; }
      if (symEl)      symEl.textContent  = _state.coin.sym;
      if (nameEl)     nameEl.textContent = _state.coin.name;
      if (unitEl)     unitEl.textContent = _state.coin.sym;
      if (availSymEl) availSymEl.textContent = _state.coin.sym;
      if (availAmtEl) availAmtEl.textContent = (_state.coin.free||0).toFixed(8);
      if (warnEl)     warnEl.style.display = (_state.coin.free||0) > 0 ? 'none' : 'block';

      _updateConfirmState();
    }

    function _updateConfirmState() {
      var btn = document.getElementById('trf-confirm-btn');
      if (!btn) return;
      var amtRaw = (document.getElementById('trf-amount-input')||{}).value || '';
      var amt  = parseFloat(amtRaw);
      var free = _state.coin.free || 0;
      var valid = amt > 0 && amt <= free && _state.from !== _state.to;
      btn.disabled = !valid;
      btn.style.background = valid ? '#f0b90b' : 'rgba(240,185,11,0.2)';
      btn.style.color      = valid ? '#1e1e1e' : 'rgba(240,185,11,0.4)';
      btn.style.cursor     = valid ? 'pointer' : 'default';
    }

    // ─────────────────────────────────────────────────
    //  ACCOUNT PICKER
    // ─────────────────────────────────────────────────
    window.trfSwapDirection = function() {
      var tmp  = _state.from;
      _state.from = _state.to;
      _state.to   = tmp;
      _renderAccounts();
      var swapInp = document.getElementById('trf-amount-input');
      if (swapInp) swapInp.value = '';
      _loadAvailableBalance();
    };

    window.trfOpenAccountPicker = function(target) {
      _state.pickerTarget = target;
      var listEl = document.getElementById('trf-acct-list');
      if (listEl) {
        listEl.innerHTML = _state.accounts.map(function(a) {
          var selected = (target === 'from' ? _state.from : _state.to) === a.id;
          return '<div onclick="trfSelectAccount(\''+a.id+'\')" style="display:flex;align-items:center;padding:14px 12px;border-radius:12px;cursor:pointer;-webkit-tap-highlight-color:transparent;'+(selected?'background:rgba(240,185,11,0.07);':'')+'">' +
            '<div style="flex:1;font-size:15px;font-weight:600;color:#f1f1f8;font-family:var(--font-mono,monospace);">'+a.label+'</div>' +
            (selected ? '<span class="material-icons-round" style="font-size:20px;color:#f0b90b;">check</span>' : '') +
          '</div>';
        }).join('');
      }
      var ov = document.getElementById('trf-acct-overlay');
      var sh = document.getElementById('trf-acct-sheet');
      if (ov && sh) {
        ov.style.display = 'block';
        requestAnimationFrame(function(){ requestAnimationFrame(function(){ sh.style.transform = 'translateY(0)'; }); });
      }
    };

    window.trfSelectAccount = function(id) {
      var prevFrom = _state.from;
      if (_state.pickerTarget === 'from') {
        if (id === _state.to) _state.to = _state.from;
        _state.from = id;
      } else {
        if (id === _state.from) _state.from = _state.to;
        _state.to = id;
      }
      _renderAccounts();
      trfCloseAccountPicker();
      if (_state.from !== prevFrom) {
        var inp = document.getElementById('trf-amount-input');
        if (inp) inp.value = '';
        _loadAvailableBalance();
      }
    };

    window.trfCloseAccountPicker = function(e) {
      if (e && e.target !== document.getElementById('trf-acct-overlay')) return;
      var ov = document.getElementById('trf-acct-overlay');
      var sh = document.getElementById('trf-acct-sheet');
      if (!sh) return;
      sh.style.transform = 'translateY(100%)';
      setTimeout(function(){ if (ov) ov.style.display = 'none'; }, 280);
    };

    // ─────────────────────────────────────────────────
    //  COIN PICKER
    // ─────────────────────────────────────────────────
    var _coinListCache = [];

    window.trfOpenCoinPicker = function() {
      _coinListCache = _availableCoins();
      _renderCoinList(_coinListCache);
      var ov = document.getElementById('trf-coin-overlay');
      var sh = document.getElementById('trf-coin-sheet');
      var search = document.getElementById('trf-coin-search');
      if (search) search.value = '';
      if (ov && sh) {
        ov.style.display = 'block';
        requestAnimationFrame(function(){ requestAnimationFrame(function(){ sh.style.transform = 'translateY(0)'; }); });
      }
    };

    function _renderCoinList(list) {
      var el = document.getElementById('trf-coin-list');
      if (!el) return;
      if (!list.length) { el.innerHTML = '<div style="text-align:center;padding:40px 0;font-size:13px;color:#4a4a65;font-family:var(--font-mono);">No coins found</div>'; return; }
      el.innerHTML = list.map(function(c) {
        var glyph   = c.glyph || c.sym.slice(0,1);
        var color   = c.color || '#6366f1';
        var freeTxt = (c.free||0).toFixed(8);
        return '<div onclick="trfSelectCoin(\''+c.sym+'\')" style="display:flex;align-items:center;padding:11px 8px;border-radius:12px;cursor:pointer;-webkit-tap-highlight-color:transparent;">' +
          '<div style="width:30px;height:30px;border-radius:50%;background:'+color+';display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-right:10px;font-size:14px;color:#fff;font-weight:700;">'+glyph+'</div>' +
          '<div style="flex:1;"><div style="font-size:15px;font-weight:700;color:#f1f1f8;font-family:var(--font-mono);">'+c.sym+'</div><div style="font-size:12px;color:#4a4a65;font-family:var(--font-mono);">'+(c.name||c.sym)+'</div></div>' +
          '<div style="font-size:12px;color:#8b8ba7;font-family:var(--font-mono);">'+freeTxt+'</div></div>';
      }).join('');
    }

    window.trfFilterCoins = function() {
      var q = (document.getElementById('trf-coin-search').value||'').trim().toUpperCase();
      if (!q) { _renderCoinList(_coinListCache); return; }
      _renderCoinList(_coinListCache.filter(function(c){ return c.sym.toUpperCase().indexOf(q) !== -1; }));
    };

    window.trfSelectCoin = function(sym) {
      var c = _coinListCache.find(function(x){ return x.sym === sym; }) || { sym:sym, name:sym, free:0, color:'#6366f1' };
      _state.coin = { sym:c.sym, name:c.name||c.sym, free:c.free||0, icon:(c.glyph||c.sym.slice(0,1)), color:c.color||'#6366f1' };
      var inp = document.getElementById('trf-amount-input');
      if (inp) inp.value = '';
      _renderCoinSelection();
      trfCloseCoinPicker();
    };

    window.trfCloseCoinPicker = function(e) {
      if (e && e.target !== document.getElementById('trf-coin-overlay')) return;
      var ov = document.getElementById('trf-coin-overlay');
      var sh = document.getElementById('trf-coin-sheet');
      if (!sh) return;
      sh.style.transform = 'translateY(100%)';
      setTimeout(function(){ if (ov) ov.style.display = 'none'; }, 280);
    };

    // ─────────────────────────────────────────────────
    //  AMOUNT
    // ─────────────────────────────────────────────────
    window.trfOnAmountInput = function() { _updateConfirmState(); };

    window.trfSetMax = function() {
      var inp = document.getElementById('trf-amount-input');
      if (inp) inp.value = (_state.coin.free||0) > 0 ? String(_state.coin.free) : '';
      _updateConfirmState();
    };

    // ─────────────────────────────────────────────────
    //  CONFIRM — real signed API call
    // ─────────────────────────────────────────────────
    window.trfConfirm = async function() {
      var btn = document.getElementById('trf-confirm-btn');
      if (!btn || btn.disabled) return;

      var excId = _state.excId || ((window.EXC && window.EXC.getState) ? window.EXC.getState().activeExchange : null);
      if (!excId) { if (typeof showToast === 'function') showToast('No exchange selected'); return; }

      var keys = (window.EXC && typeof window.EXC._getKeys === 'function') ? window.EXC._getKeys(excId) : null;
      if (!keys || !keys.apiKey) {
        if (typeof showToast === 'function') showToast('No API key — setup in Exchange settings');
        return;
      }

      var cfg = _getCfg(excId);
      if (!cfg) { if (typeof showToast === 'function') showToast('Transfer not supported for this exchange'); return; }

      var coin   = _state.coin.sym;
      var amtRaw = (document.getElementById('trf-amount-input')||{}).value || '';
      var amount = parseFloat(amtRaw);
      if (!amount || amount <= 0) { if (typeof showToast === 'function') showToast('Invalid amount'); return; }

      btn.disabled = true;
      btn.textContent = 'TRANSFERRING\u2026';
      btn.style.background = 'rgba(240,185,11,0.2)';
      btn.style.color = 'rgba(240,185,11,0.4)';

      try {
        var req = await cfg.build(keys, coin, amount, _state.from, _state.to);

        var fetchOpts = { method:req.method, headers:req.headers };
        if (req.body) fetchOpts.body = req.body;

        // Use native Android bridge for POST transfers — avoids relay proxy US IP geo-block.
        // Falls back to oneSignedFetch if bridge unavailable or native POST fails.
        var res;
        var _nativePostOk = req.method === 'POST' && window.nxPost && window.OneBridge && typeof window.OneBridge.httpPost === 'function';
        if (_nativePostOk) {
          try {
            res = await window.nxPost(req.url, { headers: req.headers, body: req.body, ms: 20000 });
          } catch(_nativeErr) {
            console.warn('[transfer] native POST failed, falling back to relay:', _nativeErr && _nativeErr.message);
            var relay = window.oneSignedFetch || window.fetch.bind(window);
            res = await relay(req.url, fetchOpts);
          }
        } else {
          var relay = window.oneSignedFetch || window.fetch.bind(window);
          res = await relay(req.url, fetchOpts);
        }
        var data  = null;
        try { data = await res.json(); } catch(e) { data = {}; } // Gate.io returns 204

        var result = cfg.parse(data);

        if (result.ok) {
          var inp = document.getElementById('trf-amount-input');
          if (inp) inp.value = '';
          try { if (window._portfolioCache) delete window._portfolioCache[excId]; } catch(e) {}
          try { if (window.EXC && window.EXC._portfolioCache) delete window.EXC._portfolioCache[excId]; } catch(e) {}
          if (typeof loadPortfolio === 'function') setTimeout(function(){ loadPortfolio('exc-port-list','exc-port-total'); }, 800);
          if (typeof showToast === 'function') showToast('\u2713 Transfer successful' + (result.id ? ' \u00b7 ' + result.id : ''));
          setTimeout(function(){
            try { if (typeof excSwitchTab === 'function') excSwitchTab('portfolio'); } catch(e) {}
            try { if (typeof excPortSwitchTab === 'function') excPortSwitchTab('overview'); } catch(e) {}
          }, 1200);
        } else {
          if (typeof showToast === 'function') showToast('Transfer failed: ' + result.msg);
        }
      } catch(err) {
        if (typeof showToast === 'function') showToast('Error: ' + (err.message||err));
      }

      btn.textContent = 'CONFIRM TRANSFER';
      _updateConfirmState();
    };

    // ─────────────────────────────────────────────────
    //  HISTORY (placeholder)
    // ─────────────────────────────────────────────────
    window.trfOpenHistory = function() {
      if (typeof showToast === 'function') showToast('Transfer history — coming soon');
    };

    // ─────────────────────────────────────────────────
    //  BACK
    // ─────────────────────────────────────────────────
    window.trfBack = function() {
      try { if (typeof excSwitchTab === 'function') excSwitchTab('portfolio'); } catch(e) {}
      try { if (typeof excPortSwitchTab === 'function') excPortSwitchTab('overview'); } catch(e) {}
    };

    // ─────────────────────────────────────────────────
    //  ENTRY POINT — called on tab switch
    // ─────────────────────────────────────────────────
    window.trfOpen = function() {
      var excId = (window.EXC && window.EXC.getState) ? window.EXC.getState().activeExchange : 'binance';
      _initForExchange(excId || 'binance');
    };

    })();
    