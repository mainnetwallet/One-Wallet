// Futures: cancel order, positions, open orders and bottom tabs
// Part of the futures engine (FUT) module (split by topic; no logic change).
(function (__NX) {
  __NX.cancelOrder = cancelOrder;
  __NX.loadPositions = loadPositions;
  __NX.loadOpenOrders = loadOpenOrders;
  __NX.switchBottomTab = switchBottomTab;


  // ── CANCEL ORDER ──
  async function cancelOrder(orderId) {
    var keys = __NX.getApiKeys();
    if (!keys) { if (typeof showToast === 'function') showToast('No API key'); return; }
    var cfg = __NX.getFutCfg();
    var excId = __NX.state.exchangeId;
    var exSym = __NX.toExSym(__NX.state.symbol, cfg);
    try {
      var result;
      if (excId === 'binance') {
        result = await __NX.signedFetch(cfg, cfg.cancelOrder, { symbol: __NX.state.symbol, orderId: orderId }, 'DELETE');
        if (result.orderId) { if (typeof showToast === 'function') showToast('✅ Order cancelled'); loadOpenOrders(); }
        else throw new Error(result.msg);
      } else if (excId === 'bybit') {
        result = await __NX.signedFetch(cfg, cfg.cancelOrder, null, 'POST', { category:'linear', symbol:exSym, orderId:orderId });
        if (result.retCode === 0) { if (typeof showToast === 'function') showToast('✅ Order cancelled'); loadOpenOrders(); }
        else throw new Error(result.retMsg);
      } else if (excId === 'bitget') {
        result = await __NX.signedFetch(cfg, cfg.cancelOrder, null, 'POST', { symbol:exSym, productType:'USDT-FUTURES', orderId:orderId });
        if (result.code === '00000') { if (typeof showToast === 'function') showToast('✅ Order cancelled'); loadOpenOrders(); }
        else throw new Error(result.msg);
      } else if (excId === 'coinbase') {
        result = await __NX._coinbaseFetchJwt('POST', cfg.cancelOrder, keys, { order_ids: [orderId] });
        var cbCancelOk = result && Array.isArray(result.results) && result.results[0] && result.results[0].success;
        if (cbCancelOk) { if (typeof showToast === 'function') showToast('✅ Order cancelled'); loadOpenOrders(); }
        else throw new Error((result.results && result.results[0] && result.results[0].failure_reason) || 'Cancel failed');
      } else if (excId === 'mexc') {
        result = await __NX.signedFetch(cfg, cfg.cancelOrder, null, 'POST', { orderId: orderId });
        if (result.success) { if (typeof showToast === 'function') showToast('✅ Order cancelled'); loadOpenOrders(); }
        else throw new Error(result.message || JSON.stringify(result));
      } else if (excId === 'gateio') {
        result = await __NX.signedFetch(cfg, cfg.cancelOrder + '/' + orderId, null, 'DELETE');
        if (result.id) { if (typeof showToast === 'function') showToast('✅ Order cancelled'); loadOpenOrders(); }
        else throw new Error(result.label || JSON.stringify(result));
      } else if (excId === 'htx') {
        result = await __NX.signedFetch(cfg, cfg.cancelOrder, null, 'POST', { order_id: orderId, contract_code: exSym });
        if (result.status === 'ok') { if (typeof showToast === 'function') showToast('✅ Order cancelled'); loadOpenOrders(); }
        else throw new Error(result.err_msg || JSON.stringify(result));
      } else if (excId === 'bingx') {
        result = await __NX.signedFetch(cfg, cfg.cancelOrder, { symbol: exSym, orderId: orderId }, 'DELETE');
        if (result.code === 0) { if (typeof showToast === 'function') showToast('✅ Order cancelled'); loadOpenOrders(); }
        else throw new Error(result.msg || JSON.stringify(result));
      } else if (excId === 'kucoin') {
        result = await __NX.signedFetch(cfg, cfg.cancelOrder + '/' + orderId, null, 'DELETE');
        if (result.code === '200000') { if (typeof showToast === 'function') showToast('✅ Order cancelled'); loadOpenOrders(); }
        else throw new Error(result.msg || JSON.stringify(result));
      } else if (excId === 'phemex') {
        result = await __NX.signedFetch(cfg, cfg.cancelOrder, { symbol: exSym, orderID: orderId }, 'DELETE');
        if (result.code === 0) { if (typeof showToast === 'function') showToast('✅ Order cancelled'); loadOpenOrders(); }
        else throw new Error(result.msg || JSON.stringify(result));
      } else if (excId === 'bitmart') {
        result = await __NX.signedFetch(cfg, cfg.cancelOrder, null, 'POST', { symbol: exSym, order_id: String(orderId) });
        if (result.code === 1000) { if (typeof showToast === 'function') showToast('✅ Order cancelled'); loadOpenOrders(); }
        else throw new Error(result.message || JSON.stringify(result));
      } else if (excId === 'kraken') {
        result = await __NX.signedFetch(cfg, cfg.cancelOrder, null, 'POST', { order_id: orderId });
        if (result.result === 'success') { if (typeof showToast === 'function') showToast('✅ Order cancelled'); loadOpenOrders(); }
        else throw new Error((result.error||[]).join(',') || JSON.stringify(result));
      } else if (excId === 'digifinex') {
        result = await __NX.signedFetch(cfg, cfg.cancelOrder, null, 'POST', { orders: [orderId] });
        if (result.code === 0) { if (typeof showToast === 'function') showToast('✅ Order cancelled'); loadOpenOrders(); }
        else throw new Error(result.msg || JSON.stringify(result));
      } else if (excId === 'lbank') {
        result = await __NX.signedFetch(cfg, cfg.cancelOrder, null, 'POST', { order_id: orderId, symbol: exSym });
        if (result.result === true || result.error_code === 0) { if (typeof showToast === 'function') showToast('✅ Order cancelled'); loadOpenOrders(); }
        else throw new Error(result.msg || JSON.stringify(result));
      } else if (excId === 'bitfinex') {
        result = await __NX.signedFetch(cfg, cfg.cancelOrder, null, 'POST', [orderId]);
        if (Array.isArray(result) && result[6] === 'SUCCESS') { if (typeof showToast === 'function') showToast('✅ Order cancelled'); loadOpenOrders(); }
        else throw new Error((Array.isArray(result) && result[7]) || JSON.stringify(result));
      } else if (excId === 'mexc') {
        if (typeof showToast === 'function') showToast('Cancel not supported for ' + excId);
      }
    } catch(e) {
      if (typeof showToast === 'function') showToast('❌ Cancel failed: ' + e.message);
    }
  }

  // ── LOAD POSITIONS (real API) ──
  async function loadPositions() {
    var keys = __NX.getApiKeys();
    var cfg = __NX.getFutCfg();
    var excId = __NX.state.exchangeId;
    var exSym = __NX.toExSym(__NX.state.symbol, cfg);
    var listEl = document.getElementById('fut-bottom-list');
    var countEl = document.getElementById('fut-positions-count');
    __NX.state.positions = [];

    if (cfg && cfg.signType === 'coinbase_jwt') {
      if (!keys || !keys.cdpKeyName || !keys.cdpPem) { renderPositions([]); return; }
    } else if (!keys || !keys.apiKey) {
      renderPositions([]); return;
    }
    // ── Cache check: tab switch করলে instantly দেখাও ──
    if (__NX._futPosCache[excId] !== undefined) {
      __NX.state.positions = __NX._futPosCache[excId];
      renderPositions(__NX._futPosCache[excId]);
      if (countEl) countEl.textContent = __NX._futPosCache[excId].length;
      return;
    }

    try {
      var data, positions = [];

      if (excId === 'binance') {
        data = await __NX.signedFetch(cfg, cfg.positions, { symbol: __NX.state.symbol }, 'GET');
        positions = (Array.isArray(data) ? data : []).filter(function(p){ return parseFloat(p.positionAmt) !== 0; }).map(function(p) {
          return { sym: p.symbol, side: parseFloat(p.positionAmt) > 0 ? 'Long' : 'Short', size: Math.abs(parseFloat(p.positionAmt)), entry: parseFloat(p.entryPrice), liq: parseFloat(p.liquidationPrice), pnl: parseFloat(p.unRealizedProfit), leverage: p.leverage, margin: parseFloat(p.isolatedMargin) };
        });

      } else if (excId === 'bybit') {
        data = await __NX.signedFetch(cfg, cfg.positions, { category:'linear', symbol:exSym }, 'GET');
        positions = ((data.result||{}).list||[]).filter(function(p){ return parseFloat(p.size) > 0; }).map(function(p) {
          return { sym: p.symbol, side: p.side, size: parseFloat(p.size), entry: parseFloat(p.avgPrice), liq: parseFloat(p.liqPrice), pnl: parseFloat(p.unrealisedPnl), leverage: p.leverage, margin: parseFloat(p.positionIM) };
        });

      } else if (excId === 'bitget') {
        data = await __NX.signedFetch(cfg, cfg.positions, { symbol:exSym, productType:'USDT-FUTURES', marginCoin:'USDT' }, 'GET');
        positions = ((data.data)||[]).filter(function(p){ return parseFloat(p.total||p.available||0) > 0; }).map(function(p) {
          return { sym: p.symbol, side: p.holdSide === 'long' ? 'Long' : 'Short', size: parseFloat(p.total||0), entry: parseFloat(p.openPriceAvg||0), liq: parseFloat(p.liquidationPrice||0), pnl: parseFloat(p.unrealizedPL||0), leverage: p.leverage, margin: parseFloat(p.marginSize||0) };
        });

      } else if (excId === 'mexc') {
        data = await __NX.signedFetch(cfg, cfg.positions, { symbol: exSym }, 'GET');
        positions = ((data.data)||[]).filter(function(p){ return parseFloat(p.vol) > 0; }).map(function(p) {
          return { sym: p.symbol, side: p.positionType === 1 ? 'Long' : 'Short', size: parseFloat(p.vol), entry: parseFloat(p.openAvgPrice), liq: parseFloat(p.liquidatePrice||0), pnl: parseFloat(p.unrealizedValue||0), leverage: p.leverage, margin: parseFloat(p.initMargin||0) };
        });

      } else if (excId === 'gateio') {
        data = await __NX.signedFetch(cfg, cfg.positions + '/' + exSym, null, 'GET');
        if (data && parseFloat(data.size||0) !== 0) positions = [{ sym: data.contract, side: parseFloat(data.size) > 0 ? 'Long' : 'Short', size: Math.abs(parseFloat(data.size)), entry: parseFloat(data.entry_price||0), liq: parseFloat(data.liq_price||0), pnl: parseFloat(data.unrealised_pnl||0), leverage: data.leverage, margin: parseFloat(data.margin||0) }];

      } else if (excId === 'bingx') {
        data = await __NX.signedFetch(cfg, cfg.positions, { symbol:exSym }, 'GET');
        positions = ((data.data)||[]).filter(function(p){ return parseFloat(p.positionAmt||0) !== 0; }).map(function(p) {
          return { sym: p.symbol, side: parseFloat(p.positionAmt) > 0 ? 'Long' : 'Short', size: Math.abs(parseFloat(p.positionAmt)), entry: parseFloat(p.avgPrice||0), liq: parseFloat(p.liquidationPrice||0), pnl: parseFloat(p.unrealizedProfit||0), leverage: p.leverage, margin: parseFloat(p.initialMargin||0) };
        });

      } else if (excId === 'htx') {
        data = await __NX.signedFetch(cfg, cfg.positions, null, 'POST', { contract_code: exSym });
        positions = ((data.data)||[]).filter(function(p){ return parseFloat(p.volume||0) > 0; }).map(function(p) {
          return { sym: p.contract_code, side: p.direction === 'buy' ? 'Long' : 'Short', size: parseFloat(p.volume||0), entry: parseFloat(p.cost_open||0), liq: parseFloat(p.liquidation_price||0), pnl: parseFloat(p.profit_unreal||0), leverage: p.lever_rate, margin: parseFloat(p.position_margin||0) };
        });

      } else if (excId === 'kucoin') {
        data = await __NX.signedFetch(cfg, cfg.positions, null, 'GET');
        positions = ((data.data)||[]).filter(function(p){ return parseFloat(p.currentQty||0) !== 0; }).map(function(p) {
          return { sym: p.symbol, side: parseFloat(p.currentQty) > 0 ? 'Long' : 'Short', size: Math.abs(parseFloat(p.currentQty)), entry: parseFloat(p.avgEntryPrice||0), liq: parseFloat(p.liquidationPrice||0), pnl: parseFloat(p.unrealisedPnl||0), leverage: p.realLeverage, margin: parseFloat(p.maintMarginReq||0) };
        });

      } else if (excId === 'phemex') {
        data = await __NX.signedFetch(cfg, cfg.positions, { currency: 'USDT' }, 'GET');
        positions = ((data.data||{}).positions||[]).filter(function(p){ return parseFloat(p.size||0) !== 0; }).map(function(p) {
          return { sym: p.symbol, side: p.side === 'Buy' ? 'Long' : 'Short', size: parseFloat(p.size||0), entry: parseFloat(p.avgEntryPriceRp||0), liq: parseFloat(p.liquidationPriceRp||0), pnl: parseFloat(p.unrealisedPnlRv||0), leverage: p.leverageRr, margin: parseFloat(p.positionMarginRv||0) };
        });

      } else if (excId === 'bitmart') {
        data = await __NX.signedFetch(cfg, cfg.positions, { symbol: exSym }, 'GET');
        positions = ((data.data)||[]).filter(function(p){ return parseFloat(p.current_amount||0) > 0; }).map(function(p) {
          return { sym: p.symbol, side: p.position_type === 1 ? 'Long' : 'Short', size: parseFloat(p.current_amount||0), entry: parseFloat(p.open_avg_price||0), liq: parseFloat(p.liquidate_price||0), pnl: parseFloat(p.unrealized_value||0), leverage: p.leverage, margin: parseFloat(p.im||0) };
        });

      } else if (excId === 'kraken') {
        data = await __NX.signedFetch(cfg, cfg.positions, null, 'GET');
        positions = ((data.openPositions)||[]).filter(function(p){ return parseFloat(p.size||0) > 0; }).map(function(p) {
          return { sym: p.symbol, side: p.side === 'long' ? 'Long' : 'Short', size: parseFloat(p.size||0), entry: parseFloat(p.price||0), liq: 0, pnl: parseFloat(p.unrealisedPnl||p.unrealisedFunding||0), leverage: 1, margin: 0 };
        });

      } else if (excId === 'digifinex') {
        data = await __NX.signedFetch(cfg, cfg.positions, { instrument_id: exSym }, 'GET');
        positions = ((data.data)||[]).filter(function(p){ return parseFloat(p.qty||0) > 0; }).map(function(p) {
          return { sym: p.instrument_id, side: p.direction === 'long' ? 'Long' : 'Short', size: parseFloat(p.qty||0), entry: parseFloat(p.open_price||0), liq: parseFloat(p.liquidation_price||0), pnl: parseFloat(p.profit||0), leverage: p.leverage, margin: parseFloat(p.margin||0) };
        });

      } else if (excId === 'lbank') {
        data = await __NX.signedFetch(cfg, cfg.positions, { symbol: exSym }, 'GET');
        positions = ((data.data)||[]).filter(function(p){ return parseFloat(p.volume||0) > 0; }).map(function(p) {
          return { sym: p.symbol, side: p.direction === 'long' ? 'Long' : 'Short', size: parseFloat(p.volume||0), entry: parseFloat(p.open_price||0), liq: parseFloat(p.liquidation_price||0), pnl: parseFloat(p.profit||0), leverage: p.lever_rate, margin: parseFloat(p.margin||0) };
        });

      } else if (excId === 'bitfinex') {
        data = await __NX.signedFetch(cfg, cfg.positions, null, 'GET');
        positions = (Array.isArray(data)?data:[]).filter(function(p){ return p[0] === exSym && parseFloat(p[2]||0) !== 0; }).map(function(p) {
          return { sym: p[0], side: parseFloat(p[2]) > 0 ? 'Long' : 'Short', size: Math.abs(parseFloat(p[2]||0)), entry: parseFloat(p[3]||0), liq: 0, pnl: parseFloat(p[6]||0), leverage: p[9], margin: 0 };
        });

      } else if (excId === 'coinbase') {
        var portfolioUuid = await __NX._coinbaseGetPortfolioUuid(keys);
        data = await __NX._coinbaseFetchJwt('GET', cfg.positions + '/' + portfolioUuid, keys);
        positions = ((data && data.positions) || []).filter(function(p){ return parseFloat(p.net_size||0) !== 0; }).map(function(p) {
          var sz = parseFloat(p.net_size||0);
          return {
            sym: p.symbol || p.product_id,
            side: sz > 0 ? 'Long' : 'Short',
            size: Math.abs(sz),
            entry: parseFloat((p.entry_vwap||{}).value || 0),
            liq: parseFloat((p.liquidation_price||{}).value || 0),
            pnl: parseFloat((p.unrealized_pnl||{}).value || 0),
            leverage: p.leverage,
            margin: parseFloat((p.im_notional||{}).value || 0),
          };
        });

      }
      // Guard: if exchange switched while awaiting, discard result
      if (__NX.state.exchangeId !== excId) return;
      __NX.state.positions = positions;
      // Cache save
      __NX._futPosCache[excId] = positions;
      renderPositions(positions);
    } catch(e) {
      if (__NX.state.exchangeId === excId) renderPositions([]);
    }
    if (__NX.state.exchangeId === excId && countEl) countEl.textContent = __NX.state.positions.length;
  }

  function renderPositions(positions) {
    var curTab = window._futBottomTab || 'positions';
    if (curTab !== 'positions') return;
    var listEl = document.getElementById('fut-bottom-list'); if (!listEl) return;
    if (!positions || !positions.length) {
      listEl.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px 0;gap:8px;"><span class="material-icons-round" style="font-size:36px;color:rgba(255,255,255,0.1);">trending_up</span><span style="font-size:12px;color:var(--text-muted);font-family:var(--font-mono);">No open positions</span></div>';
      return;
    }
    listEl.innerHTML = positions.map(function(p) {
      var pnlColor = p.pnl >= 0 ? '#0ecb81' : '#f6465d';
      return '<div style="display:flex;flex-direction:column;gap:4px;padding:10px 14px;background:rgba(255,255,255,0.03);border-radius:10px;border:1px solid rgba(255,255,255,0.07);margin-bottom:6px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;">' +
          '<span style="font-size:12px;font-weight:800;color:var(--text-primary);font-family:var(--font-mono);">' + (p.sym||'?') + '</span>' +
          '<span style="font-size:11px;font-weight:700;color:' + (p.side==='Long'?'#0ecb81':'#f6465d') + ';font-family:var(--font-mono);">' + (p.side||'') + ' × ' + (p.leverage||'') + '</span>' +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;">' +
          '<span style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);">Size: ' + __NX.fmt(p.size,4) + '  Entry: $' + __NX.fmt(p.entry,2) + '</span>' +
          '<span style="font-size:11px;font-weight:700;color:' + pnlColor + ';font-family:var(--font-mono);">' + (p.pnl>=0?'+':'') + __NX.fmt(p.pnl,4) + ' USDT</span>' +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;">' +
          '<span style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);">Liq: $' + __NX.fmt(p.liq,2) + '</span>' +
          '<span style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);">Margin: ' + __NX.fmt(p.margin,2) + ' USDT</span>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  // ── LOAD OPEN ORDERS (real API) ──
  async function loadOpenOrders() {
    var keys = __NX.getApiKeys();
    var cfg = __NX.getFutCfg();
    var excId = __NX.state.exchangeId;
    var exSym = __NX.toExSym(__NX.state.symbol, cfg);
    var countEl = document.getElementById('fut-orders-count');
    __NX.state.openOrders = [];

    if (cfg && cfg.signType === 'coinbase_jwt') {
      if (!keys || !keys.cdpKeyName || !keys.cdpPem) { renderOrders([]); return; }
    } else if (!keys || !keys.apiKey) { renderOrders([]); return; }
    // ── Cache check: tab switch করলে instantly দেখাও ──
    if (__NX._futOrdCache[excId] !== undefined) {
      __NX.state.openOrders = __NX._futOrdCache[excId];
      if (countEl) countEl.textContent = __NX._futOrdCache[excId].length;
      renderOrders(__NX._futOrdCache[excId]);
      return;
    }

    try {
      var data, orders = [];

      if (excId === 'binance') {
        data = await __NX.signedFetch(cfg, cfg.openOrders, { symbol: __NX.state.symbol }, 'GET');
        orders = (Array.isArray(data) ? data : []).map(function(o) {
          return { id:o.orderId, sym:o.symbol, side:o.side, type:o.type, price:parseFloat(o.price), qty:parseFloat(o.origQty), filled:parseFloat(o.executedQty), status:o.status, time:o.time };
        });
      } else if (excId === 'bybit') {
        data = await __NX.signedFetch(cfg, cfg.openOrders, { category:'linear', symbol:exSym }, 'GET');
        orders = ((data.result||{}).list||[]).map(function(o) {
          return { id:o.orderId, sym:o.symbol, side:o.side, type:o.orderType, price:parseFloat(o.price), qty:parseFloat(o.qty), filled:parseFloat(o.cumExecQty), status:o.orderStatus, time:o.createdTime };
        });
      } else if (excId === 'bitget') {
        data = await __NX.signedFetch(cfg, cfg.openOrders, { symbol:exSym, productType:'USDT-FUTURES' }, 'GET');
        orders = ((data.data)||{entrustedList:[]}).entrustedList.map(function(o) {
          return { id:o.orderId, sym:o.symbol, side:o.side, type:o.orderType, price:parseFloat(o.price), qty:parseFloat(o.size), filled:parseFloat(o.baseVolume||0), status:o.status, time:o.cTime };
        });
      } else if (excId === 'mexc') {
        data = await __NX.signedFetch(cfg, cfg.openOrders + '/' + exSym, null, 'GET');
        orders = ((data.data)||{resultList:[]}).resultList.map(function(o) {
          return { id:o.id, sym:o.symbol, side:o.side===1?'Buy':'Sell', type:o.type, price:parseFloat(o.price), qty:parseFloat(o.vol), filled:parseFloat(o.dealVol||0), status:'open', time:o.createTime };
        });
      } else if (excId === 'bingx') {
        data = await __NX.signedFetch(cfg, cfg.openOrders, { symbol:exSym }, 'GET');
        orders = ((data.data)||{orders:[]}).orders.map(function(o) {
          return { id:o.orderId, sym:o.symbol, side:o.side, type:o.type, price:parseFloat(o.price), qty:parseFloat(o.origQty), filled:parseFloat(o.executedQty||0), status:o.status, time:o.time };
        });
      } else if (excId === 'gateio') {
        data = await __NX.signedFetch(cfg, cfg.openOrders + '&contract=' + exSym, null, 'GET');
        orders = (Array.isArray(data) ? data : []).map(function(o) {
          return { id:o.id, sym:o.contract, side:parseFloat(o.size)>0?'Buy':'Sell', type:o.tif==='ioc'?'Market':'Limit', price:parseFloat(o.price), qty:Math.abs(parseFloat(o.size)), filled:0, status:o.status, time:o.create_time*1000 };
        });
      } else if (excId === 'htx') {
        data = await __NX.signedFetch(cfg, cfg.openOrders, null, 'POST', { contract_code:exSym });
        orders = ((data.data)||{orders:[]}).orders.map(function(o) {
          return { id:o.order_id_str, sym:o.contract_code, side:o.direction==='buy'?'Buy':'Sell', type:o.order_price_type, price:parseFloat(o.price), qty:parseFloat(o.volume), filled:parseFloat(o.trade_volume||0), status:o.status, time:o.created_at };
        });
      } else if (excId === 'kucoin') {
        // /api/v1/openOrders doesn't exist on KuCoin Futures — the real
        // endpoint is the unified /api/v1/orders list filtered by status.
        // The call also wasn't passing status or symbol, so even hitting
        // a valid endpoint it would've returned the wrong/everything set.
        data = await __NX.signedFetch(cfg, cfg.openOrders, { status:'active', symbol:exSym }, 'GET');
        orders = ((data.data)||{items:[]}).items.map(function(o) {
          return { id:o.id, sym:o.symbol, side:o.side==='buy'?'Buy':'Sell', type:o.type, price:parseFloat(o.price||0), qty:parseFloat(o.size), filled:parseFloat(o.dealSize||0), status:o.status, time:o.createdAt };
        });
      } else if (excId === 'phemex') {
        data = await __NX.signedFetch(cfg, cfg.openOrders, { symbol: exSym }, 'GET');
        orders = ((data.data)||{rows:[]}).rows.map(function(o) {
          return { id:o.orderID, sym:o.symbol, side:o.side, type:o.ordType, price:parseFloat(o.priceRp||0), qty:parseFloat(o.orderQtyRq||0), filled:parseFloat(o.cumQtyRq||0), status:o.ordStatus, time:o.createTimeNs/1e6 };
        });
      } else if (excId === 'bitmart') {
        data = await __NX.signedFetch(cfg, cfg.openOrders, { symbol: exSym }, 'GET');
        orders = ((data.data)||[]).map(function(o) {
          return { id:o.order_id, sym:o.symbol, side:o.side===1?'Buy':'Sell', type:o.type, price:parseFloat(o.price||0), qty:parseFloat(o.size||0), filled:parseFloat(o.deal_size||0), status:'open', time:o.create_time };
        });
      } else if (excId === 'kraken') {
        data = await __NX.signedFetch(cfg, cfg.openOrders, null, 'GET');
        orders = ((data.openOrders)||[]).map(function(o) {
          return { id:o.order_id, sym:o.symbol, side:o.side, type:o.orderType, price:parseFloat(o.limitPrice||0), qty:parseFloat(o.size||0), filled:parseFloat(o.filled||0), status:'open', time:Date.now() };
        });
      } else if (excId === 'digifinex') {
        data = await __NX.signedFetch(cfg, cfg.openOrders, { instrument_id: exSym, state: 0 }, 'GET');
        orders = ((data.data)||[]).map(function(o) {
          return { id:o.order_id, sym:o.instrument_id, side:o.type===1?'Buy':'Sell', type:o.order_type===4?'Market':'Limit', price:parseFloat(o.price||0), qty:parseFloat(o.qty||0), filled:parseFloat(o.filled_qty||0), status:'open', time:o.timestamp*1000 };
        });
      } else if (excId === 'lbank') {
        data = await __NX.signedFetch(cfg, cfg.openOrders, { symbol: exSym, state: 0 }, 'GET');
        orders = ((data.data)||[]).map(function(o) {
          return { id:o.order_id, sym:o.symbol, side:o.direction.indexOf('Long')>-1?'Buy':'Sell', type:o.type, price:parseFloat(o.price||0), qty:parseFloat(o.quantity||0), filled:parseFloat(o.filled_qty||0), status:'open', time:o.create_time };
        });
      } else if (excId === 'bitfinex') {
        data = await __NX.signedFetch(cfg, '/v2/auth/r/orders/' + exSym, null, 'POST', []);
        orders = (Array.isArray(data)?data:[]).map(function(o) {
          return { id:o[0], sym:o[3], side:parseFloat(o[6])>0?'Buy':'Sell', type:o[8], price:parseFloat(o[16]||0), qty:Math.abs(parseFloat(o[6]||0)), filled:Math.abs(parseFloat(o[6]||0))-Math.abs(parseFloat(o[7]||0)), status:o[13], time:o[4] };
        });
      } else if (excId === 'coinbase') {
        // List Orders, filtered to this product + FUTURE/PERPETUAL + open statuses.
        // Price lives inside order_configuration (whichever variant key is
        // present) rather than as a flat top-level field.
        var cbQs = '?product_id=' + encodeURIComponent(exSym) + '&product_type=FUTURE&contract_expiry_type=PERPETUAL'
          + '&order_status=OPEN&order_status=PENDING&order_status=QUEUED';
        data = await __NX._coinbaseFetchJwt('GET', '/api/v3/brokerage/orders/historical/batch' + cbQs, keys);
        orders = ((data && data.orders) || []).map(function(o) {
          var ocfg = o.order_configuration || {};
          var variant = ocfg.limit_limit_gtc || ocfg.limit_limit_gtd || ocfg.limit_limit_fok || ocfg.market_market_ioc || ocfg.market_market_fok || {};
          return {
            id: o.order_id,
            sym: o.product_id,
            side: o.side === 'BUY' ? 'Buy' : 'Sell',
            type: o.order_type,
            price: parseFloat(variant.limit_price || o.average_filled_price || 0),
            qty: parseFloat(variant.base_size || 0),
            filled: parseFloat(o.filled_size || 0),
            status: o.status,
            time: o.created_time,
          };
        });
      }
      // Guard: if exchange switched while awaiting, discard result
      if (__NX.state.exchangeId !== excId) return;
      __NX.state.openOrders = orders;
      // Cache save
      __NX._futOrdCache[excId] = orders;
      if (countEl) countEl.textContent = orders.length;
      renderOrders(orders);
    } catch(e) {
      if (__NX.state.exchangeId === excId) {
        if (countEl) countEl.textContent = '0';
        renderOrders([]);
      }
    }
  }

  function renderOrders(orders) {
    var curTab = window._futBottomTab || 'positions';
    if (curTab !== 'orders') return;
    var listEl = document.getElementById('fut-bottom-list'); if (!listEl) return;
    if (!orders || !orders.length) {
      listEl.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px 0;gap:8px;"><span class="material-icons-round" style="font-size:36px;color:rgba(255,255,255,0.1);">receipt_long</span><span style="font-size:12px;color:var(--text-muted);font-family:var(--font-mono);">No open orders</span></div>';
      return;
    }
    listEl.innerHTML = orders.map(function(o) {
      var sideColor = (o.side||'').toLowerCase().includes('buy') ? '#0ecb81' : '#f6465d';
      var dt = o.time ? new Date(typeof o.time === 'string' ? parseInt(o.time,10) : o.time).toLocaleTimeString() : '';
      return '<div style="display:flex;flex-direction:column;gap:3px;padding:9px 14px;background:rgba(255,255,255,0.03);border-radius:10px;border:1px solid rgba(255,255,255,0.07);margin-bottom:5px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;">' +
          '<span style="font-size:11px;font-weight:800;color:' + sideColor + ';font-family:var(--font-mono);">' + (o.side||'') + ' ' + (o.type||'') + '</span>' +
          '<span onclick="FUT._cancelOrder(\'' + o.id + '\')" style="font-size:10px;color:#ef4444;font-family:var(--font-mono);cursor:pointer;padding:2px 6px;border:1px solid rgba(239,68,68,0.3);border-radius:4px;">Cancel</span>' +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;">' +
          '<span style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);">$' + __NX.fmt(o.price,2) + '  Qty:' + __NX.fmt(o.qty,4) + '</span>' +
          '<span style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);">' + dt + '</span>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  // ── Bottom tab switcher ──
  function switchBottomTab(tab) {
    window._futBottomTab = tab;
    ['positions','orders'].forEach(function(t) {
      var el = document.getElementById('fut-tt-' + t); if (!el) return;
      if (t === tab) { el.style.color = 'var(--text-primary)'; el.style.borderBottomColor = 'var(--accent-primary)'; }
      else { el.style.color = 'var(--text-muted)'; el.style.borderBottomColor = 'transparent'; }
    });
    if (tab === 'positions') renderPositions(__NX.state.positions);
    else renderOrders(__NX.state.openOrders);
  }
})((window.__nxp = window.__nxp || {}).mod_fut_futures_engine = window.__nxp.mod_fut_futures_engine || {});
