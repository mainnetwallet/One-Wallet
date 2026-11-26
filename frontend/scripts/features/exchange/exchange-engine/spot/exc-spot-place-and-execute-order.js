// Available balance, order placement and execution
// Part of the exchange spot engine (window.EXC) module (split by topic; no logic change).
(function (__NX) {
  __NX.loadAvailableBalance = loadAvailableBalance;
  __NX.placeOrder = placeOrder;
  __NX.closeOrderConfirm = closeOrderConfirm;


  // ── Available balance ──
  async function loadAvailableBalance() {
    var keys = __NX.getExchangeKey(__NX.state.activeExchange);
    var el = document.getElementById('exc-trade-avbl') || document.getElementById('exc-avail-bal');
    var side = window._excSide || 'buy';
    var quote = __NX.state.activePair.replace(/^.*?(USDT|BTC|ETH)$/, '$1');
    var base  = __NX.state.activePair.replace(new RegExp(quote + '$'), '');
    var asset = side === 'sell' ? base : quote;
    if (!keys) { if (el) el.textContent = '0.0000 ' + asset; return; }
    // ── Cache check: tab/pair switch হলে cached balance instantly দেখাও ──
    var _balCK = __NX.state.activeExchange + '_' + asset;
    if (__NX._balanceCache2[_balCK] !== undefined) {
      if (el) el.textContent = __NX._balanceCache2[_balCK].toFixed(4) + ' ' + asset;
      return;
    }
    try {
      var exc = __NX.activeExc();
      var balance = 0;
      if (exc.id === 'binance' || exc.id === 'mexc') {
        var fn = exc.id === 'binance' ? __NX.binanceFetch : __NX.mexcFetch;
        var data = await fn('/api/v3/account', {}, keys);
        var a = (data.balances||[]).find(function(b) { return b.asset === asset; });
        balance = a ? parseFloat(a.free) : 0;
      } else if (exc.id === 'kucoin') {
        var data = await __NX.kucoinFetch('/api/v1/accounts', {type:'trade',currency:asset}, keys);
        var item = (data.data||[]).find(function(b) { return b.currency === asset; });
        balance = item ? parseFloat(item.available) : 0;
      } else if (exc.id === 'bybit') {
        var data = await __NX.bybitFetch('/v5/account/wallet-balance', {accountType:'UNIFIED',coin:asset}, keys);
        var coin = ((data.result||{}).list||[{}])[0];
        balance = coin ? parseFloat((coin.totalAvailableBalance||0)) : 0;
      } else if (exc.id === 'bitmart') {
        var data = await __NX.bitmartFetch(exc.endpoints.balance, {}, keys);
        var w = (((data.data)||{}).wallet||[]).find(function(b) { return b.currency === asset; });
        balance = w ? parseFloat(w.available) : 0;
      } else if (exc.id === 'bitget') {
        var data = await __NX.bitgetFetch(exc.endpoints.balance, {}, keys);
        var a2 = ((data.data)||[]).find(function(b) { return b.coin === asset; });
        balance = a2 ? parseFloat(a2.available) : 0;
      } else if (exc.id === 'kraken') {
        var krAsset = asset === 'BTC' ? 'XXBT' : (asset === 'ETH' ? 'XETH' : asset);
        var data = await __NX.krakenFetch(exc.endpoints.balance, {}, keys);
        balance = parseFloat((data.result||{})[krAsset] || (data.result||{})[asset] || 0);
      } else if (exc.id === 'gateio') {
        var data = await __NX.gateioFetch(exc.endpoints.balance, {}, keys);
        var a3 = (data||[]).find(function(b) { return b.currency === asset; });
        balance = a3 ? parseFloat(a3.available) : 0;
      } else if (exc.id === 'coinbase') {
        var data = await __NX.coinbaseFetch(exc.endpoints.balance, {}, keys, 'GET');
        var a4 = (data||[]).find(function(b) { return b.currency === asset; });
        balance = a4 ? parseFloat(a4.available) : 0;
      } else if (exc.id === 'bingx') {
        var data = await __NX.bingxFetch(exc.endpoints.balance, {}, keys);
        var a5 = (((data.data)||{}).balances||[]).find(function(b) { return b.asset === asset; });
        balance = a5 ? parseFloat(a5.free) : 0;
      } else if (exc.id === 'htx') {
        var accData = await __NX.htxFetch(exc.endpoints.balance, {}, keys);
        var spotAcc = ((accData.data)||[]).find(function(a) { return a.type === 'spot'; });
        if (spotAcc) {
          var balData = await __NX.htxFetch('/v1/account/accounts/' + spotAcc.id + '/balance', {}, keys);
          var item = (((balData.data)||{}).list||[]).find(function(b) { return b.currency === asset.toLowerCase() && b.type === 'trade'; });
          balance = item ? parseFloat(item.balance) : 0;
        }
      } else if (exc.id === 'phemex') {
        var data = await __NX.phemexFetch(exc.endpoints.balance, {}, keys);
        var a6 = ((data.data)||[]).find(function(b) { return b.currency === asset; });
        balance = a6 ? parseFloat(a6.balanceEv) / __NX.PHEMEX_SCALE : 0;
      } else if (exc.id === 'digifinex') {
        var data = await __NX.digifinexFetch(exc.endpoints.balance, {}, keys);
        var a7 = ((data.list)||[]).find(function(b) { return b.currency === asset; });
        balance = a7 ? parseFloat(a7.free) : 0;
      } else if (exc.id === 'lbank') {
        var data = await __NX.lbankFetch(exc.endpoints.balance, {}, keys);
        var a8 = ((data.data)||[]).find(function(b) { return (b.coin||'').toUpperCase() === asset; });
        balance = a8 ? parseFloat(a8.usableAmt) : 0;
      } else if (exc.id === 'bitfinex') {
        var data = await __NX.bitfinexFetch(exc.endpoints.balance, {}, keys);
        var bfAsset = asset === 'USDT' ? 'UST' : asset;
        var row2 = (data||[]).find(function(r) { return r[0] === 'exchange' && r[1] === bfAsset; });
        balance = row2 ? parseFloat(row2[4] || row2[2] || 0) : 0;
      }
      // Cache save — exchange switch করলে _clearExchangeCache() এটা মুছে দেবে
      if (__NX.state.activeExchange === exc.id) {
        __NX._balanceCache2[_balCK] = balance;
      }
      if (el) el.textContent = balance.toFixed(4) + ' ' + asset;
    } catch(e) {
      if (el) el.textContent = '0.0000 ' + asset;
    }
    __NX.updateMaxBuy();
  }

  // ── Place order ──
  async function placeOrder(side) {
    var keys = __NX.getExchangeKey(__NX.state.activeExchange);
    if (!keys) { excOpenApiSetup(); return; }
    var amount = parseFloat((document.getElementById('exc-trade-amount')||{}).value) || 0;
    if (!amount) { showToast('Enter amount', 'warning'); return; }
    __NX.state.orderSide = side;
    var price = __NX.state.orderType === 'limit' ? parseFloat((document.getElementById('exc-limit-price')||{}).value) : null;
    var exc = __NX.activeExc();
    var min = await __NX.getTradeMinimums(exc, __NX.state.activePair);
    var base = __NX.state.activePair.replace(new RegExp((__NX.state.activePair.replace(/^.*?(USDT|BTC|ETH)$/, '$1')) + '$'), '');
    // ── Round to the exchange's lot-size step (e.g. KuCoin baseIncrement) ──
    // Exchanges reject orders whose quantity isn't an exact multiple of
    // their step size with "Order size increment invalid" — amounts coming
    // from the % slider are arbitrary decimals, so we floor to the nearest
    // valid step here before any further checks or the network request.
    if (min.stepSize && min.stepSize > 0) {
      var decimals = (min.stepSize.toString().split('.')[1] || '').length;
      var scale = Math.pow(10, decimals);
      var steps = Math.floor(Math.round(amount * scale) / Math.round(min.stepSize * scale));
      amount = parseFloat((steps * min.stepSize).toFixed(decimals));
      var amtInput = document.getElementById('exc-trade-amount');
      if (amtInput) amtInput.value = parseFloat(amount.toFixed(decimals)).toString();
    }
    if (!amount) { showToast('Amount too small after rounding to exchange step size', 'warning'); return; }
    // ── Base-asset quantity floor (e.g. KuCoin requires >=0.1 KCS per order) ──
    // This is a hard exchange-side rule enforced server-side regardless of
    // USD value, so we check it client-side too to avoid a round-trip
    // rejection ("Order size below the minimum requirement").
    if (min.minQty && amount < min.minQty) {
      showToast('⚠️ Min order: ' + min.minQty + ' ' + base + ' (' + exc.name + ')', 'warning');
      return;
    }
    var refPrice = price || (__NX.state.markets.find(function(m) { return m.symbol === __NX.state.activePair; }) || {}).price || 0;
    var notional = amount * refPrice;
    if (min.minNotional && refPrice && notional < min.minNotional) {
      showToast('⚠️ Min order value: $' + min.minNotional.toFixed(2) + ' — your order ~$' + notional.toFixed(2) + ' (' + exc.name + ')', 'warning');
      return;
    }
    // Show confirm sheet
    var content = document.getElementById('exc-confirm-content');
    var btn = document.getElementById('exc-confirm-btn');
    if (content) {
      var rows = [
        ['Exchange', __NX.activeExc().name],
        ['Pair', __NX.state.activePair],
        ['Side', side.toUpperCase()],
        ['Type', __NX.state.orderType.toUpperCase()],
        ['Amount', amount + ' ' + __NX.state.activePair.replace(/USDT|BTC|ETH/,'')],
      ];
      if (price) rows.push(['Limit Price', __NX.fmtPrice(price) + ' USDT']);
      content.innerHTML = rows.map(function(r) {
        return '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);">' +
          '<span style="font-size:12px;color:var(--text-muted);font-family:var(--font-mono);">'+r[0]+'</span>' +
          '<span style="font-size:13px;font-weight:700;color:var(--text-primary);font-family:var(--font-mono);">'+r[1]+'</span>' +
        '</div>';
      }).join('');
    }
    if (btn) {
      btn.textContent = 'CONFIRM ' + side.toUpperCase();
      btn.style.background = side === 'buy' ? '#16a34a' : '#dc2626';
      btn.onclick = function() { executeOrder(side, amount, price); };
    }
    var sheet = document.getElementById('exc-order-confirm');
    if (sheet) sheet.style.display = 'flex';
  }

  function closeOrderConfirm() {
    var s = document.getElementById('exc-order-confirm');
    if (s) s.style.display = 'none';
  }

  async function executeOrder(side, amount, limitPrice) {
    var btn = document.getElementById('exc-confirm-btn');
    if (btn) btn.textContent = 'Placing…';
    var keys = __NX.getExchangeKey(__NX.state.activeExchange);
    try {
      var exc = __NX.activeExc();
      var res;
      var refPrice = limitPrice || (__NX.state.markets.find(function(m) { return m.symbol === __NX.state.activePair; }) || {}).price || 0;
      if (exc.id === 'binance' || exc.id === 'mexc') {
        var fn = exc.id === 'binance' ? __NX.binanceFetch : __NX.mexcFetch;
        var params = {
          symbol: __NX.state.activePair,
          side: side.toUpperCase(),
          type: __NX.state.orderType.toUpperCase(),
          quantity: amount,
        };
        if (__NX.state.orderType === 'limit') { params.price = limitPrice; params.timeInForce = 'GTC'; }
        res = await fn(exc.endpoints.order, params, keys, 'POST');
        // Binance/MEXC return {code, msg} on failure instead of throwing —
        // a successful order always has an orderId, so its absence means
        // the exchange rejected it (bad signature, below min size, etc.)
        if (!res || !res.orderId) throw new Error((res && res.msg) || 'Order rejected by exchange');
      } else if (exc.id === 'bybit') {
        var body = {
          category: 'spot',
          symbol: __NX.state.activePair,
          side: side === 'buy' ? 'Buy' : 'Sell',
          orderType: __NX.state.orderType === 'limit' ? 'Limit' : 'Market',
          qty: amount.toString(),
        };
        if (__NX.state.orderType === 'limit') {
          body.price = limitPrice.toString();
        } else if (side === 'buy') {
          // Bybit spot market-buy treats `qty` as quote-currency (USDT)
          // amount by default — `amount` here is always the base-asset
          // quantity the user entered, so without marketUnit:'baseCoin'
          // a market buy for e.g. 0.01 BTC actually got sent (and filled)
          // as 0.01 USDT worth of BTC.
          body.marketUnit = 'baseCoin';
        }
        res = await __NX.bybitFetch(exc.endpoints.order, body, keys, 'POST');
        if (!res || res.retCode !== 0) throw new Error((res && res.retMsg) || 'Order rejected by exchange');
      } else if (exc.id === 'kucoin') {
        var kcBody = {
          clientOid: 'nx' + Date.now().toString(36) + Math.floor(Math.random()*1e6).toString(36),
          side: side,
          symbol: __NX.toKucoinSymbol(__NX.state.activePair),
          type: __NX.state.orderType === 'limit' ? 'limit' : 'market',
          size: amount.toString(),
        };
        if (__NX.state.orderType === 'limit') kcBody.price = limitPrice.toString();
        res = await __NX.kucoinFetch(exc.endpoints.order, null, keys, 'POST', kcBody, exc);
        if (!res || res.code !== '200000') {
          console.error('[KuCoin order failed] request:', kcBody, 'response:', res);
          throw new Error((res && (res.msg || res.code)) || 'Order rejected by exchange');
        }
      } else if (exc.id === 'bitmart') {
        var bmBody = {
          symbol: __NX.toUnderscoreSymbol(__NX.state.activePair),
          side: side,
          type: __NX.state.orderType === 'limit' ? 'limit' : 'market',
        };
        if (__NX.state.orderType === 'limit') { bmBody.size = amount.toString(); bmBody.price = limitPrice.toString(); }
        else if (side === 'buy') { bmBody.notional = (amount * refPrice).toFixed(6); }
        else { bmBody.size = amount.toString(); }
        res = await __NX.bitmartFetch(exc.endpoints.order, bmBody, keys, 'POST');
        if (!res || res.code !== 1000) throw new Error((res && res.message) || 'Order rejected by exchange');
      } else if (exc.id === 'bitget') {
        var bgBody = {
          symbol: __NX.state.activePair,
          side: side,
          orderType: __NX.state.orderType === 'limit' ? 'limit' : 'market',
          force: 'gtc',
          size: amount.toString(),
        };
        if (__NX.state.orderType === 'limit') bgBody.price = limitPrice.toString();
        res = await __NX.bitgetFetch(exc.endpoints.order, bgBody, keys, 'POST');
        if (!res || res.code !== '00000') throw new Error((res && res.msg) || 'Order rejected by exchange');
      } else if (exc.id === 'kraken') {
        var krBody = {
          pair: __NX.toKrakenPair(__NX.state.activePair),
          type: side,
          ordertype: __NX.state.orderType === 'limit' ? 'limit' : 'market',
          volume: amount.toString(),
        };
        if (__NX.state.orderType === 'limit') krBody.price = limitPrice.toString();
        res = await __NX.krakenFetch(exc.endpoints.order, krBody, keys);
        if (!res || (res.error && res.error.length)) throw new Error((res.error && res.error[0]) || 'Order rejected by exchange');
      } else if (exc.id === 'gateio') {
        var gtBody = {
          currency_pair: __NX.toUnderscoreSymbol(__NX.state.activePair),
          side: side,
          type: __NX.state.orderType === 'limit' ? 'limit' : 'market',
          time_in_force: __NX.state.orderType === 'limit' ? 'gtc' : 'ioc',
          account: 'spot',
        };
        gtBody.amount = (__NX.state.orderType === 'market' && side === 'buy') ? (amount * refPrice).toFixed(6) : amount.toString();
        if (__NX.state.orderType === 'limit') gtBody.price = limitPrice.toString();
        res = await __NX.gateioFetch(exc.endpoints.order, gtBody, keys, 'POST');
        if (!res || !res.id) throw new Error((res && res.message) || 'Order rejected by exchange');
      } else if (exc.id === 'coinbase') {
        var cbBody = {
          product_id: __NX.toDashSymbol(__NX.state.activePair),
          side: side,
          type: __NX.state.orderType === 'limit' ? 'limit' : 'market',
          size: amount.toString(),
        };
        if (__NX.state.orderType === 'limit') { cbBody.price = limitPrice.toString(); cbBody.time_in_force = 'GTC'; }
        res = await __NX.coinbaseFetch(exc.endpoints.order, null, keys, 'POST', cbBody);
        if (!res || !res.id) throw new Error((res && res.message) || 'Order rejected by exchange');
      } else if (exc.id === 'bingx') {
        var bxParams = {
          symbol: __NX.toDashSymbol(__NX.state.activePair),
          side: side.toUpperCase(),
          type: __NX.state.orderType === 'limit' ? 'LIMIT' : 'MARKET',
          quantity: amount,
        };
        if (__NX.state.orderType === 'limit') { bxParams.price = limitPrice; bxParams.timeInForce = 'GTC'; }
        res = await __NX.bingxFetch(exc.endpoints.order, bxParams, keys, 'POST');
        if (!res || res.code !== 0 || !res.data || !res.data.orderId) throw new Error((res && res.msg) || 'Order rejected by exchange');
      } else if (exc.id === 'htx') {
        var htxAccData = await __NX.htxFetch(exc.endpoints.balance, {}, keys);
        var htxAcc = ((htxAccData.data)||[]).find(function(a) { return a.type === 'spot'; });
        if (!htxAcc) throw new Error('Could not find HTX spot account');
        var htxBody = {
          'account-id': htxAcc.id.toString(),
          symbol: __NX.state.activePair.toLowerCase(),
          type: side + '-' + (__NX.state.orderType === 'limit' ? 'limit' : 'market'),
          amount: amount.toString(),
          source: 'spot-api',
        };
        if (__NX.state.orderType === 'limit') htxBody.price = limitPrice.toString();
        res = await __NX.htxFetch(exc.endpoints.order, htxBody, keys, 'POST');
        if (!res || res.status !== 'ok') throw new Error((res && res['err-msg']) || 'Order rejected by exchange');
      } else if (exc.id === 'phemex') {
        var phBody = {
          symbol: __NX.state.activePair,
          side: side === 'buy' ? 'Buy' : 'Sell',
          ordType: __NX.state.orderType === 'limit' ? 'Limit' : 'Market',
          baseQtyEv: Math.round(amount * __NX.PHEMEX_SCALE),
        };
        if (__NX.state.orderType === 'limit') phBody.priceEp = Math.round(limitPrice * __NX.PHEMEX_SCALE);
        res = await __NX.phemexFetch(exc.endpoints.order, phBody, keys, 'POST');
        if (!res || res.code !== 0) throw new Error((res && res.msg) || 'Order rejected by exchange');
      } else if (exc.id === 'digifinex') {
        var dfParams = {
          market: __NX.toLowerUnderscoreSymbol(__NX.state.activePair),
          amount: amount.toString(),
          price: __NX.state.orderType === 'limit' ? limitPrice.toString() : '0',
          type: __NX.state.orderType === 'market' ? (side + '_market') : side,
        };
        res = await __NX.digifinexFetch(exc.endpoints.order, dfParams, keys, 'POST');
        if (!res || res.code !== 0) throw new Error('Order rejected by exchange (code ' + (res && res.code) + ')');
      } else if (exc.id === 'lbank') {
        var lbParams = {
          symbol: __NX.toLowerUnderscoreSymbol(__NX.state.activePair),
          type: __NX.state.orderType === 'market' ? (side + '_market') : side,
          price: __NX.state.orderType === 'limit' ? limitPrice.toString() : '0',
          amount: amount.toString(),
        };
        res = await __NX.lbankFetch(exc.endpoints.order, lbParams, keys);
        if (!res || (res.result !== true && res.result !== 'true')) throw new Error((res && res.msg) || 'Order rejected by exchange');
      } else if (exc.id === 'bitfinex') {
        var bfBody = {
          type: __NX.state.orderType === 'limit' ? 'EXCHANGE LIMIT' : 'EXCHANGE MARKET',
          symbol: __NX.toBitfinexSymbol(__NX.state.activePair),
          amount: side === 'buy' ? amount.toString() : ('-' + amount.toString()),
        };
        if (__NX.state.orderType === 'limit') bfBody.price = limitPrice.toString();
        res = await __NX.bitfinexFetch(exc.endpoints.order, bfBody, keys);
        if (!res || res[6] !== 'SUCCESS') throw new Error((res && res[7]) || 'Order rejected by exchange');
      }
      closeOrderConfirm();
      __NX.showExcToast((side==='buy'?'🟢':'🔴') + ' Order placed! ' + side.toUpperCase() + ' ' + amount + ' ' + __NX.state.activePair);
      // Stay on the current tab after a successful order — refresh the inline
      // open-orders list in the background instead of force-switching to Orders.
      if (__NX.state.activeTab === 'trade') {
        __NX.loadOrders('open', 'exc-trade-orders-list');
      }
    } catch(e) {
      if (btn) btn.textContent = 'Error — Retry';
      __NX.showExcToast('❌ Order failed: ' + e.message, true);
    }
  }
})((window.__nxp = window.__nxp || {}).mod_exc_spot_engine = window.__nxp.mod_exc_spot_engine || {});
