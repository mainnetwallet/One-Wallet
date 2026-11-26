// Open/history orders: load, render and cancel
// Part of the exchange spot engine (window.EXC) module (split by topic; no logic change).
(function (__NX) {
  __NX.loadOrders = loadOrders;
  __NX.switchOrdersCat = switchOrdersCat;
  __NX.cancelOrder = cancelOrder;


  // ── Orders ──
  async function loadOrders(mode, targetId) {
    __NX.state.ordersMode = mode;
    targetId = targetId || 'exc-orders-list';
    var openBtn = document.getElementById(targetId === 'exc-trade-orders-list' ? 'exc-trade-ord-open' : 'exc-ord-open');
    var histBtn = document.getElementById(targetId === 'exc-trade-orders-list' ? 'exc-trade-ord-hist' : 'exc-ord-hist');
    if (openBtn) openBtn.className = 'exc-ord-tab' + (mode==='open'?' exc-ord-active':'');
    if (histBtn) histBtn.className = 'exc-ord-tab' + (mode==='history'?' exc-ord-active':'');

    var el = document.getElementById(targetId);
    var keys = __NX.getExchangeKey(__NX.state.activeExchange);
    if (!keys) {
      if (el) el.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 0;gap:10px;"><span class="material-icons-round" style="font-size:40px;color:rgba(255,255,255,0.1);">receipt_long</span><span style="font-size:13px;color:var(--text-muted);font-family:var(--font-mono);">Available Funds: 0.00 USDT</span><span style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">Transfer funds to your Spot wallet to trade</span><span onclick="EXC.openApiSetup()" style="font-size:12px;color:var(--accent-primary);font-family:var(--font-mono);cursor:pointer;text-decoration:underline;margin-top:4px;">Setup API Key →</span></div>';
      return;
    }
    // ── Cache check: tab switch করলে cached orders instantly দেখাও ──
    var _ordCacheKey = __NX.state.activeExchange;
    var _ordCache = mode === 'open' ? __NX._ordersOpenCache[_ordCacheKey] : __NX._ordersHistCache[_ordCacheKey];
    if (_ordCache) {
      renderOrders(_ordCache, mode, targetId);
      return;
    }
    if (el) el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;padding:40px 0;gap:10px;"><div class="exc-spinner"></div><span style="font-size:13px;color:var(--text-muted);font-family:var(--font-mono);">Loading orders…</span></div>';
    try {
      var exc = __NX.activeExc();
      var orders = [];
      if (exc.id === 'binance' || exc.id === 'mexc') {
        var fn = exc.id === 'binance' ? __NX.binanceFetch : __NX.mexcFetch;
        var endpoint = mode==='open' ? exc.endpoints.openOrders : exc.endpoints.allOrders;
        var params = {};
        if (mode==='history') params.symbol = __NX.state.activePair;
        var data = await fn(endpoint, params, keys);
        orders = Array.isArray(data) ? data : [];
        orders = orders.map(function(o) {
          return {id:o.orderId, symbol:o.symbol, side:o.side, type:o.type, qty:o.origQty, price:o.price, status:o.status, time:o.time};
        });
      } else if (exc.id === 'bybit') {
        var endpoint = mode==='open' ? exc.endpoints.openOrders : exc.endpoints.allOrders;
        var data = await __NX.bybitFetch(endpoint, {category:'spot',symbol:__NX.state.activePair}, keys);
        orders = ((data.result||{}).list||[]).map(function(o) {
          return {id:o.orderId, symbol:o.symbol, side:o.side, type:o.orderType, qty:o.qty, price:o.price, status:o.orderStatus, time:parseInt(o.createdTime)};
        });
      } else if (exc.id === 'kucoin') {
        var kcParams = {status: mode==='open' ? 'active' : 'done'};
        if (mode === 'history') kcParams.symbol = __NX.toKucoinSymbol(__NX.state.activePair);
        var data = await __NX.kucoinFetch(exc.endpoints.order, kcParams, keys, 'GET', null, exc);
        orders = ((data.data||{}).items||[]).map(function(o) {
          return {
            id: o.id,
            symbol: (o.symbol||'').replace('-',''),
            side: (o.side||'').toUpperCase(),
            type: (o.type||'').toUpperCase(),
            qty: o.size,
            price: o.price,
            status: o.isActive ? 'NEW' : (o.cancelExist ? 'CANCELED' : 'FILLED'),
            time: parseInt(o.createdAt)
          };
        });
      } else if (exc.id === 'bitmart') {
        var data = await __NX.bitmartFetch(mode==='open' ? exc.endpoints.openOrders : exc.endpoints.allOrders, {symbol:__NX.toUnderscoreSymbol(__NX.state.activePair)}, keys, 'POST');
        orders = ((data.data)||[]).map(function(o) {
          return {id:o.orderId, symbol:__NX.fromUnderscoreSymbol(o.symbol), side:(o.side||'').toUpperCase(), type:(o.type||'').toUpperCase(), qty:o.size, price:o.price, status:o.state, time:parseInt(o.createTime)};
        });
      } else if (exc.id === 'bitget') {
        var endpoint = mode==='open' ? exc.endpoints.openOrders : exc.endpoints.allOrders;
        var data = await __NX.bitgetFetch(endpoint, {symbol:__NX.state.activePair}, keys);
        orders = ((data.data)||[]).map(function(o) {
          return {id:o.orderId, symbol:o.symbol, side:(o.side||'').toUpperCase(), type:(o.orderType||'').toUpperCase(), qty:o.size, price:o.price, status:o.status, time:parseInt(o.cTime)};
        });
      } else if (exc.id === 'kraken') {
        var endpoint = mode==='open' ? exc.endpoints.openOrders : exc.endpoints.allOrders;
        var data = await __NX.krakenFetch(endpoint, {}, keys);
        var grp = mode==='open' ? ((data.result||{}).open||{}) : ((data.result||{}).closed||{});
        orders = Object.keys(grp).map(function(txid) {
          var o = grp[txid];
          var d = o.descr || {};
          return {id:txid, symbol:(d.pair||'').replace(/^XBT/,'BTC'), side:(d.type||'').toUpperCase(), type:(d.ordertype||'').toUpperCase(), qty:o.vol, price:d.price, status:o.status, time:Math.round((o.opentm||0)*1000)};
        });
      } else if (exc.id === 'gateio') {
        var gtParams = mode==='open' ? {status:'open',currency_pair:__NX.toUnderscoreSymbol(__NX.state.activePair)} : {status:'finished',currency_pair:__NX.toUnderscoreSymbol(__NX.state.activePair)};
        var data = await __NX.gateioFetch(exc.endpoints.openOrders, gtParams, keys);
        orders = (data||[]).map(function(o) {
          return {id:o.id, symbol:__NX.fromUnderscoreSymbol(o.currency_pair), side:(o.side||'').toUpperCase(), type:(o.type||'').toUpperCase(), qty:o.amount, price:o.price, status:o.status, time:parseInt(o.create_time)*1000};
        });
      } else if (exc.id === 'coinbase') {
        var cbParams = {status: mode==='open' ? 'open' : 'done', product_id: __NX.toDashSymbol(__NX.state.activePair)};
        var data = await __NX.coinbaseFetch(exc.endpoints.openOrders, cbParams, keys, 'GET');
        orders = (data||[]).map(function(o) {
          return {id:o.id, symbol:__NX.fromDashSymbol(o.product_id), side:(o.side||'').toUpperCase(), type:(o.type||'').toUpperCase(), qty:o.size, price:o.price, status:o.status, time:new Date(o.created_at).getTime()};
        });
      } else if (exc.id === 'bingx') {
        var endpoint = mode==='open' ? exc.endpoints.openOrders : exc.endpoints.allOrders;
        var data = await __NX.bingxFetch(endpoint, {symbol:__NX.toDashSymbol(__NX.state.activePair)}, keys);
        orders = (((data.data)||{}).orders||[]).map(function(o) {
          return {id:o.orderId, symbol:__NX.fromDashSymbol(o.symbol), side:o.side, type:o.type, qty:o.origQty, price:o.price, status:o.status, time:o.time};
        });
      } else if (exc.id === 'htx') {
        var htxAccData = await __NX.htxFetch(exc.endpoints.balance, {}, keys);
        var htxAcc = ((htxAccData.data)||[]).find(function(a) { return a.type === 'spot'; });
        var endpoint = mode==='open' ? exc.endpoints.openOrders : exc.endpoints.allOrders;
        var htxParams = mode==='open' ? {symbol:__NX.state.activePair.toLowerCase(), 'account-id': htxAcc ? htxAcc.id.toString() : ''} : {symbol:__NX.state.activePair.toLowerCase(), states:'filled,partial-canceled,canceled'};
        var data = await __NX.htxFetch(endpoint, htxParams, keys);
        orders = ((data.data)||[]).map(function(o) {
          var parts = (o.type||'').split('-');
          return {id:o.id, symbol:(o.symbol||'').toUpperCase(), side:(parts[0]||'').toUpperCase(), type:(parts[1]||'').toUpperCase(), qty:o.amount, price:o.price, status:o.state, time:parseInt(o['created-at'])};
        });
      } else if (exc.id === 'phemex') {
        var endpoint = mode==='open' ? exc.endpoints.openOrders : exc.endpoints.allOrders;
        var data = await __NX.phemexFetch(endpoint, {symbol:__NX.state.activePair}, keys);
        orders = ((data.data)||(data.rows)||[]).map(function(o) {
          return {id:o.orderID, symbol:o.symbol, side:(o.side||'').toUpperCase(), type:(o.ordType||'').toUpperCase(), qty:(parseFloat(o.baseQtyEv)||0)/__NX.PHEMEX_SCALE, price:(parseFloat(o.priceEp)||0)/__NX.PHEMEX_SCALE, status:o.ordStatus, time:Math.round((parseFloat(o.actionTimeNs)||0)/1e6)};
        });
      } else if (exc.id === 'digifinex') {
        var endpoint = mode==='open' ? exc.endpoints.openOrders : exc.endpoints.allOrders;
        var data = await __NX.digifinexFetch(endpoint, {market:__NX.toLowerUnderscoreSymbol(__NX.state.activePair)}, keys);
        orders = ((data.data)||(data.list)||[]).map(function(o) {
          return {id:o.order_id, symbol:__NX.fromUnderscoreSymbol(o.symbol||__NX.state.activePair), side:(o.side||'').toUpperCase(), type:(o.type||'').toUpperCase(), qty:o.amount, price:o.price, status:o.status, time:parseInt(o.created_date)};
        });
      } else if (exc.id === 'lbank') {
        var endpoint = mode==='open' ? exc.endpoints.openOrders : exc.endpoints.allOrders;
        var data = await __NX.lbankFetch(endpoint, {symbol:__NX.toLowerUnderscoreSymbol(__NX.state.activePair), current_page:1, page_length:100}, keys);
        orders = ((data.data)||[]).map(function(o) {
          return {id:o.orderId, symbol:__NX.fromUnderscoreSymbol(o.symbol), side:(o.type||'').toUpperCase(), type:(o.type||'').toUpperCase(), qty:o.amount, price:o.price, status:o.status, time:parseInt(o.create_time)};
        });
      } else if (exc.id === 'bitfinex') {
        var endpoint = mode==='open' ? exc.endpoints.openOrders : exc.endpoints.allOrders;
        var data = await __NX.bitfinexFetch(endpoint, {}, keys);
        orders = (data||[]).map(function(o) {
          var amt = parseFloat(o[6]) || 0;
          return {id:o[0], symbol:(o[3]||'').slice(1).replace(/UST$/,'USDT'), side:amt>=0?'BUY':'SELL', type:(o[8]||'').toUpperCase(), qty:Math.abs(amt), price:o[16], status:o[13], time:o[4]};
        });
      }
      // Cache save করো — পরে tab switch করলে instant দেখাবে
      if (__NX.state.activeExchange === _ordCacheKey) {
        if (mode === 'open') __NX._ordersOpenCache[_ordCacheKey] = orders;
        else __NX._ordersHistCache[_ordCacheKey] = orders;
      }
      renderOrders(orders, mode, targetId);
    } catch(e) {
      if (el) el.innerHTML = '<div style="text-align:center;padding:40px 0;font-size:13px;color:#f87171;font-family:var(--font-mono);">Error loading orders</div>';
    }
  }

  // ── Orders category switcher (All / Spot / Futures / Convert) ──
  function switchOrdersCat(cat) {
    __NX.state.ordersCategory = cat;
    ['open','all','spot','futures','convert'].forEach(function(c) {
      var el = document.getElementById('exc-ocat-' + c);
      if (el) el.className = 'exc-ocat-tab' + (c === cat ? ' exc-ocat-active' : '');
    });
    var listEl = document.getElementById('exc-orders-list');
    if (cat === 'futures') {
      if (listEl) listEl.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 0;gap:12px;"><span class="material-icons-round" style="font-size:48px;color:rgba(255,255,255,0.1);">trending_up</span><span style="font-size:13px;color:var(--text-muted);font-family:var(--font-mono);">Futures Orders</span><span style="font-size:11px;color:rgba(255,255,255,0.2);font-family:var(--font-mono);">Open the Futures tab to trade perps</span></div>';
      return;
    }
    if (cat === 'convert') {
      if (listEl) listEl.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 0;gap:12px;"><span class="material-icons-round" style="font-size:48px;color:rgba(255,255,255,0.1);">swap_horiz</span><span style="font-size:13px;color:var(--text-muted);font-family:var(--font-mono);">Convert History</span><span style="font-size:11px;color:rgba(255,255,255,0.2);font-family:var(--font-mono);">Your instant conversions will appear here</span></div>';
      return;
    }
    if (cat === 'all' || cat === 'spot') {
      // All / Spot — completed order history
      loadOrders('history');
      return;
    }
    // 'open' tab — pending/limit orders only
    loadOrders('open');
  }

  function renderOrders(orders, mode, targetId) {
    targetId = targetId || 'exc-orders-list';
    var el = document.getElementById(targetId);
    if (targetId === 'exc-trade-orders-list' && mode === 'open') {
      var cnt = document.getElementById('exc-trade-open-count');
      if (cnt) cnt.textContent = orders.length;
    }
    if (!el) return;
    if (!orders.length) {
      var emptyMsg = mode === 'open'
        ? '<span style="font-size:13px;color:var(--text-muted);font-family:var(--font-mono);">No open orders</span><span style="font-size:11px;color:rgba(255,255,255,0.2);font-family:var(--font-mono);">Open limit orders will appear here</span>'
        : '<span style="font-size:13px;color:var(--text-muted);font-family:var(--font-mono);">No order history</span><span style="font-size:11px;color:rgba(255,255,255,0.2);font-family:var(--font-mono);">Completed orders will appear here</span>';
      el.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 0;gap:10px;">' +
        '<span class="material-icons-round" style="font-size:40px;color:rgba(255,255,255,0.1);">receipt_long</span>' +
        emptyMsg +
        '</div>';
      return;
    }
    // Build header row + order cards
    var isMainList = targetId === 'exc-orders-list';
    var isOpenMode = mode === 'open';
    var cat = __NX.state ? __NX.state.ordersCategory : 'open';
    var histLabel = cat === 'all' ? 'ALL HISTORY' : cat === 'spot' ? 'SPOT HISTORY' : 'ORDER HISTORY';
    var headerHtml = isMainList
      ? '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 2px 10px;">' +
          '<span style="font-size:11px;font-weight:700;color:var(--text-muted);font-family:var(--font-mono);letter-spacing:0.5px;">' + (isOpenMode ? 'POSITIONS' : histLabel) + ' (' + orders.length + ')</span>' +
          (isOpenMode ? '<span onclick="if(confirm(\'Cancel all open orders?\'))orders.forEach(function(o){EXC.cancelOrder(o.id,o.symbol);})" style="font-size:10px;color:#ef4444;font-family:var(--font-mono);cursor:pointer;font-weight:700;">Cancel All</span>' : '') +
        '</div>'
      : '';
    el.innerHTML = headerHtml + orders.map(function(o) {
      var isBuy = o.side && o.side.toLowerCase().includes('buy');
      var sideColor = isBuy ? '#22c55e' : '#ef4444';
      var sideBg   = isBuy ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)';
      var date = o.time ? new Date(o.time).toLocaleString([], {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';
      var typeLabel = (o.type||'').toUpperCase();
      var filled = o.filled ? parseFloat(o.filled) : 0;
      var total  = parseFloat(o.qty) || 0;
      var fillPct = total > 0 ? Math.round(filled / total * 100) : 0;
      return '<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:12px 14px;margin-bottom:8px;">' +
        // Row 1: symbol + side badge
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
          '<span style="font-size:14px;font-weight:800;color:var(--text-primary);font-family:var(--font-mono);">'+o.symbol+'</span>' +
          '<span style="font-size:10px;font-weight:700;color:'+sideColor+';background:'+sideBg+';border-radius:5px;padding:2px 7px;font-family:var(--font-mono);">'+o.side+'</span>' +
          '<span style="font-size:10px;font-weight:600;color:var(--text-muted);background:rgba(255,255,255,0.06);border-radius:5px;padding:2px 7px;font-family:var(--font-mono);">'+typeLabel+'</span>' +
          '<span style="margin-left:auto;font-size:10px;color:var(--text-muted);font-family:var(--font-mono);">'+date+'</span>' +
        '</div>' +
        // Row 2: qty / price
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
          '<div>' +
            '<div style="font-size:10px;color:rgba(255,255,255,0.3);font-family:var(--font-mono);margin-bottom:2px;">Amount</div>' +
            '<div style="font-size:12px;font-weight:700;color:var(--text-primary);font-family:var(--font-mono);">'+o.qty+'</div>' +
          '</div>' +
          '<div style="text-align:right;">' +
            '<div style="font-size:10px;color:rgba(255,255,255,0.3);font-family:var(--font-mono);margin-bottom:2px;">Price</div>' +
            '<div style="font-size:12px;font-weight:700;color:var(--text-primary);font-family:var(--font-mono);">'+__NX.fmtPrice(parseFloat(o.price))+'</div>' +
          '</div>' +
        '</div>' +
        // Row 3: fill progress bar + cancel
        '<div style="display:flex;align-items:center;gap:10px;">' +
          '<div style="flex:1;height:3px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;">' +
            '<div style="height:100%;width:'+fillPct+'%;background:var(--accent-primary);border-radius:3px;transition:width 0.3s;"></div>' +
          '</div>' +
          '<span style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);flex-shrink:0;">'+fillPct+'% filled</span>' +
          '<span onclick="EXC.cancelOrder(\''+o.id+'\',\''+o.symbol+'\')" style="font-size:11px;color:#ef4444;font-family:var(--font-mono);cursor:pointer;font-weight:700;flex-shrink:0;padding:4px 8px;background:rgba(239,68,68,0.1);border-radius:6px;-webkit-tap-highlight-color:transparent;">Cancel</span>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  async function cancelOrder(orderId, symbol) {
    var keys = __NX.getExchangeKey(__NX.state.activeExchange);
    if (!keys) return;
    if (!confirm('Cancel this order?')) return;
    try {
      var exc = __NX.activeExc();
      var res;
      if (exc.id === 'binance' || exc.id === 'mexc') {
        var fn = exc.id === 'binance' ? __NX.binanceFetch : __NX.mexcFetch;
        res = await fn(exc.endpoints.cancelOrder, {symbol:symbol, orderId:orderId}, keys, 'DELETE');
        if (!res || !res.orderId) throw new Error((res && res.msg) || 'Cancel rejected by exchange');
      } else if (exc.id === 'bybit') {
        res = await __NX.bybitFetch(exc.endpoints.cancelOrder, {category:'spot', symbol:symbol, orderId:orderId}, keys, 'POST');
        if (!res || res.retCode !== 0) throw new Error((res && res.retMsg) || 'Cancel rejected by exchange');
      } else if (exc.id === 'kucoin') {
        res = await __NX.kucoinFetch(exc.endpoints.cancelOrder + orderId, null, keys, 'DELETE', null, exc);
        if (!res || res.code !== '200000') throw new Error((res && res.msg) || 'Cancel rejected by exchange');
      } else if (exc.id === 'bitmart') {
        res = await __NX.bitmartFetch(exc.endpoints.cancelOrder, {symbol:__NX.toUnderscoreSymbol(symbol), order_id:orderId}, keys, 'POST');
        if (!res || res.code !== 1000) throw new Error((res && res.message) || 'Cancel rejected by exchange');
      } else if (exc.id === 'bitget') {
        res = await __NX.bitgetFetch(exc.endpoints.cancelOrder, {symbol:symbol, orderId:orderId}, keys, 'POST');
        if (!res || res.code !== '00000') throw new Error((res && res.msg) || 'Cancel rejected by exchange');
      } else if (exc.id === 'kraken') {
        res = await __NX.krakenFetch(exc.endpoints.cancelOrder, {txid:orderId}, keys);
        if (!res || (res.error && res.error.length)) throw new Error((res.error && res.error[0]) || 'Cancel rejected by exchange');
      } else if (exc.id === 'gateio') {
        res = await __NX.gateioFetch(exc.endpoints.cancelOrder + '/' + orderId, {currency_pair:__NX.toUnderscoreSymbol(symbol)}, keys, 'DELETE');
        if (!res || res.label) throw new Error((res && res.message) || 'Cancel rejected by exchange');
      } else if (exc.id === 'coinbase') {
        res = await __NX.coinbaseFetch(exc.endpoints.cancelOrder + '/' + orderId, null, keys, 'DELETE');
        if (res && res.message) throw new Error(res.message);
      } else if (exc.id === 'bingx') {
        res = await __NX.bingxFetch(exc.endpoints.cancelOrder, {symbol:__NX.toDashSymbol(symbol), orderId:orderId}, keys, 'POST');
        if (!res || res.code !== 0) throw new Error((res && res.msg) || 'Cancel rejected by exchange');
      } else if (exc.id === 'htx') {
        res = await __NX.htxFetch(exc.endpoints.cancelOrder + '/' + orderId + '/submitcancel', {}, keys, 'POST');
        if (!res || res.status !== 'ok') throw new Error((res && res['err-msg']) || 'Cancel rejected by exchange');
      } else if (exc.id === 'phemex') {
        res = await __NX.phemexFetch(exc.endpoints.cancelOrder, {symbol:symbol, orderID:orderId}, keys, 'DELETE');
        if (!res || res.code !== 0) throw new Error((res && res.msg) || 'Cancel rejected by exchange');
      } else if (exc.id === 'digifinex') {
        res = await __NX.digifinexFetch(exc.endpoints.cancelOrder, {order_id:orderId}, keys, 'POST');
        if (!res || res.code !== 0) throw new Error('Cancel rejected by exchange (code ' + (res && res.code) + ')');
      } else if (exc.id === 'lbank') {
        res = await __NX.lbankFetch(exc.endpoints.cancelOrder, {symbol:__NX.toLowerUnderscoreSymbol(symbol), order_id:orderId}, keys);
        if (!res || (res.result !== true && res.result !== 'true')) throw new Error((res && res.msg) || 'Cancel rejected by exchange');
      } else if (exc.id === 'bitfinex') {
        res = await __NX.bitfinexFetch(exc.endpoints.cancelOrder, {id:parseInt(orderId)}, keys);
        if (!res || res[6] !== 'SUCCESS') throw new Error((res && res[7]) || 'Cancel rejected by exchange');
      }
      __NX.showExcToast('✅ Order cancelled');
      loadOrders(__NX.state.ordersMode);
    } catch(e) {
      __NX.showExcToast('❌ Cancel failed: ' + e.message, true);
    }
  }
})((window.__nxp = window.__nxp || {}).mod_exc_spot_engine = window.__nxp.mod_exc_spot_engine || {});
