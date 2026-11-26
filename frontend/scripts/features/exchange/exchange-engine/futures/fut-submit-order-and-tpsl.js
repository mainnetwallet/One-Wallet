// Futures: TP/SL placement and submitOrder for every exchange
// Part of the futures engine (FUT) module (split by topic; no logic change).
(function (__NX) {
  __NX.submitOrder = submitOrder;


  // ── SUBMIT ORDER (real API) ──
  // ── TP/SL helper: Gate.io — price-triggered orders ──
  async function _futGatePlaceTpSl(cfg, exSym, side, size, tpPrice, slPrice) {
    var closeSide = side === 'BUY' ? 'sell' : 'buy';
    var closeSize = -Math.abs(size); // negative = sell in Gate futures
    if (closeSide === 'buy') closeSize = Math.abs(size);
    if (tpPrice > 0) {
      try {
        await __NX.signedFetch(cfg, '/api/v4/futures/usdt/price_orders', null, 'POST', {
          initial: { contract: exSym, size: closeSize, price: '0', tif: 'ioc', reduce_only: true },
          trigger: { strategy_type: 0, price_type: 1, price: String(tpPrice), rule: closeSide === 'sell' ? 1 : 2 },
        });
      } catch(e) { if (typeof showToast === 'function') showToast('TP order failed: ' + (e.message||''), 'warning'); }
    }
    if (slPrice > 0) {
      try {
        await __NX.signedFetch(cfg, '/api/v4/futures/usdt/price_orders', null, 'POST', {
          initial: { contract: exSym, size: closeSize, price: '0', tif: 'ioc', reduce_only: true },
          trigger: { strategy_type: 0, price_type: 1, price: String(slPrice), rule: closeSide === 'sell' ? 2 : 1 },
        });
      } catch(e) { if (typeof showToast === 'function') showToast('SL order failed: ' + (e.message||''), 'warning'); }
    }
  }

  // ── TP/SL helper: HTX — cross-margin trigger orders ──
  async function _futHtxPlaceTpSl(cfg, exSym, side, tpPrice, slPrice) {
    var closeSide = side === 'BUY' ? 'sell' : 'buy';
    if (tpPrice > 0) {
      try {
        await __NX.signedFetch(cfg, '/linear-swap-api/v1/swap_cross_tpsl_order', null, 'POST', {
          contract_code: exSym, direction: closeSide, offset: 'close',
          tp_trigger_price: tpPrice, tp_order_price_type: 'optimal_5',
        });
      } catch(e) {}
    }
    if (slPrice > 0) {
      try {
        await __NX.signedFetch(cfg, '/linear-swap-api/v1/swap_cross_tpsl_order', null, 'POST', {
          contract_code: exSym, direction: closeSide, offset: 'close',
          sl_trigger_price: slPrice, sl_order_price_type: 'optimal_5',
        });
      } catch(e) {}
    }
  }

  // ── TP/SL helper: KuCoin — stop orders ──
  async function _futKucoinPlaceTpSl(cfg, exSym, side, tpPrice, slPrice, size) {
    var closeSide = side === 'BUY' ? 'sell' : 'buy';
    if (tpPrice > 0) {
      try {
        await __NX.signedFetch(cfg, '/api/v1/orders', null, 'POST', {
          clientOid: 'nx_tp_' + Date.now(), symbol: exSym, side: closeSide,
          type: 'market', size: Math.max(1, Math.round(size)), leverage: String(__NX.state.leverage),
          stop: closeSide === 'sell' ? 'up' : 'down', stopPrice: String(tpPrice), stopPriceType: 'MP',
          reduceOnly: true,
        });
      } catch(e) {}
    }
    if (slPrice > 0) {
      try {
        await __NX.signedFetch(cfg, '/api/v1/orders', null, 'POST', {
          clientOid: 'nx_sl_' + Date.now(), symbol: exSym, side: closeSide,
          type: 'market', size: Math.max(1, Math.round(size)), leverage: String(__NX.state.leverage),
          stop: closeSide === 'sell' ? 'down' : 'up', stopPrice: String(slPrice), stopPriceType: 'MP',
          reduceOnly: true,
        });
      } catch(e) {}
    }
  }

  // ── TP/SL helper: Kraken Derivatives — separate trigger orders ──
  async function _futKrakenPlaceTpSl(cfg, exSym, side, tpPrice, slPrice, size) {
    var closeSide = side === 'BUY' ? 'sell' : 'buy';
    if (tpPrice > 0) {
      try {
        await __NX.signedFetch(cfg, cfg.order, null, 'POST', {
          orderType: 'take_profit', symbol: exSym, side: closeSide,
          size: parseFloat(size).toFixed(5), triggerSignal: 'mark', stopPrice: tpPrice,
          reduceOnly: true,
        });
      } catch(e) { if (typeof showToast === 'function') showToast('TP order failed: ' + (e.message||''), 'warning'); }
    }
    if (slPrice > 0) {
      try {
        await __NX.signedFetch(cfg, cfg.order, null, 'POST', {
          orderType: 'stop', symbol: exSym, side: closeSide,
          size: parseFloat(size).toFixed(5), triggerSignal: 'mark', stopPrice: slPrice,
          reduceOnly: true,
        });
      } catch(e) { if (typeof showToast === 'function') showToast('SL order failed: ' + (e.message||''), 'warning'); }
    }
  }

  // ── TP/SL helper: DigiFinex Swap — separate plan/trigger orders ──
  async function _futDigifinexPlaceTpSl(cfg, exSym, side, tpPrice, slPrice, size) {
    var closeSide = side === 'BUY' ? 2 : 1; // 1=buy, 2=sell
    if (tpPrice > 0) {
      try {
        await __NX.signedFetch(cfg, '/swap/v2/trade/plan_order', null, 'POST', {
          instrument_id: exSym, type: closeSide,
          trigger_type: 1, // 1=mark_price
          trigger_price: String(tpPrice),
          price: '0', qty: parseFloat(size).toFixed(5), order_type: 4, // 4=market close
        });
      } catch(e) { if (typeof showToast === 'function') showToast('TP order failed: ' + (e.message||''), 'warning'); }
    }
    if (slPrice > 0) {
      try {
        await __NX.signedFetch(cfg, '/swap/v2/trade/plan_order', null, 'POST', {
          instrument_id: exSym, type: closeSide,
          trigger_type: 1,
          trigger_price: String(slPrice),
          price: '0', qty: parseFloat(size).toFixed(5), order_type: 4,
        });
      } catch(e) { if (typeof showToast === 'function') showToast('SL order failed: ' + (e.message||''), 'warning'); }
    }
  }

  async function submitOrder() {
    if (__NX.state.loading) return;
    var keys = __NX.getApiKeys();
    var cfgCheck = __NX.getFutCfg();
    var keysOk = (cfgCheck && cfgCheck.signType === 'coinbase_jwt') ? (keys && keys.cdpKeyName && keys.cdpPem) : (keys && keys.apiKey);
    if (!keysOk) {
      if (typeof showToast === 'function') showToast('⚠️ No API key — go to Exchange settings');
      return;
    }
    var price = parseFloat(document.getElementById('fut-price').value) || 0;
    var amt   = parseFloat(document.getElementById('fut-amount').value) || 0;
    if (amt <= 0) { if (typeof showToast === 'function') showToast('Enter amount first'); return; }
    var excId = __NX.state.exchangeId;
    var _contractExcSub = ['kucoin','kraken','htx','bitmart','mexc'];
    var _refPrice = price || __NX.state.lastPrice || 1;
    if (_contractExcSub.indexOf(excId) !== -1 && __NX.state.amtUnit === 'USDT') {
      // Amount field = margin (collateral). Convert: margin → notional → contracts
      var _notional = amt * __NX.state.leverage;
      amt = _notional / (__NX._contractSize() * _refPrice);
    } else if (_contractExcSub.indexOf(excId) === -1) {
      // Non-contract exchange (binance, bybit, bitget, gate etc).
      // Amount field = USDT margin. Convert: margin → notional → coin qty
      var _notional2 = amt * __NX.state.leverage;
      amt = _notional2 / _refPrice;
    }
    if ((__NX.state.orderType === 'limit' || __NX.state.orderType === 'stop_limit' || __NX.state.orderType === 'stop_market') && price <= 0) { if (typeof showToast === 'function') showToast('Enter price for limit/stop order'); return; }

    // Wait for any in-flight leverage-set call to finish before placing the order,
    // so the exchange sees the correct leverage. Errors are already toasted inside
    // _applyLeverageToExchange, so we suppress them here.
    if (__NX.state._leverageApplyPromise) {
      try { await __NX.state._leverageApplyPromise; } catch(e) {}
      __NX.state._leverageApplyPromise = null;
    }

    __NX.state.loading = true;
    var btn = document.getElementById('fut-submit-btn');
    var origText = btn ? btn.textContent : '';
    if (btn) btn.textContent = 'Placing…';

    var cfg = __NX.getFutCfg();
    var exSym = __NX.toExSym(__NX.state.symbol, cfg);
    var side = __NX.state.side.toUpperCase(); // BUY / SELL

    // ── Read TP / SL / TIF from UI ──
    var tifEl   = document.getElementById('fut-tif');
    var tif     = tifEl ? tifEl.value : 'GTC'; // GTC | IOC | FOK
    var tpslOn  = !!(document.getElementById('fut-chk-tpsl') && document.getElementById('fut-chk-tpsl').classList.contains('fut-chk-on'));
    var tpPrice = tpslOn ? (parseFloat(document.getElementById('fut-tp') && document.getElementById('fut-tp').value) || 0) : 0;
    var slPrice = tpslOn ? (parseFloat(document.getElementById('fut-sl') && document.getElementById('fut-sl').value) || 0) : 0;
    // TIF map helpers
    function _tifBinance(t) { return t === 'IOC' ? 'IOC' : t === 'FOK' ? 'FOK' : 'GTC'; }
    function _tifGate(t)    { return t === 'IOC' ? 'ioc' : t === 'FOK' ? 'poc' : 'gtc'; }
    function _tifKucoin(t)  { return t === 'IOC' ? 'IOC' : t === 'FOK' ? 'FOK' : 'GTC'; }

    try {
      var result;

      if (excId === 'binance') {
        // positionSide must match the account's actual mode: 'BOTH' is only
        // valid in One-way mode — Hedge-mode accounts require LONG/SHORT or
        // Binance rejects the order (-4061, position side mismatch). The
        // posMode (S/H) toggle wasn't actually wired into this before.
        // Also: in Hedge mode, a reduce-only order CLOSES a position, so
        // the side/positionSide mapping flips (BUY+reduceOnly closes a
        // SHORT, so positionSide is still SHORT, not LONG).
        var reduceOnly = !!(document.getElementById('fut-chk-reduce') && document.getElementById('fut-chk-reduce').classList.contains('fut-chk-on'));
        var posSide = 'BOTH';
        if (__NX.state.posMode === 'H') {
          if (reduceOnly) posSide = (side === 'BUY') ? 'SHORT' : 'LONG';
          else posSide = (side === 'BUY') ? 'LONG' : 'SHORT';
        }
        var body = {
          symbol: __NX.state.symbol,
          side: side,
          type: __NX.state.orderType === 'market' ? 'MARKET' : __NX.state.orderType === 'stop_market' ? 'STOP_MARKET' : __NX.state.orderType === 'stop_limit' ? 'STOP' : 'LIMIT',
          quantity: amt.toFixed(5),
          positionSide: posSide,
        };
        // reduceOnly is rejected by Binance when positionSide isn't BOTH —
        // in Hedge mode the LONG/SHORT positionSide itself already
        // expresses close-intent, so only send it in One-way mode.
        if (reduceOnly && posSide === 'BOTH') body.reduceOnly = 'true';
        if (__NX.state.orderType === 'limit' || __NX.state.orderType === 'stop_limit') { body.price = price.toFixed(__NX.getDecimals(__NX.state.tickSize)); body.timeInForce = _tifBinance(tif); }
        if (__NX.state.orderType === 'stop_limit' || __NX.state.orderType === 'stop_market') { body.stopPrice = price.toFixed(__NX.getDecimals(__NX.state.tickSize)); }
        if (tpPrice > 0) { body.takeProfit = tpPrice.toFixed(__NX.getDecimals(__NX.state.tickSize)); body.workingType = 'MARK_PRICE'; }
        if (slPrice > 0) { body.stopLoss   = slPrice.toFixed(__NX.getDecimals(__NX.state.tickSize)); body.workingType = 'MARK_PRICE'; }
        result = await __NX.signedFetch(cfg, cfg.order, body, 'POST');
        if (result.orderId) {
          if (typeof showToast === 'function') showToast('\u2705 Order placed #' + result.orderId);
          __NX.loadOpenOrders(); __NX.loadPositions();
        } else { throw new Error(result.msg || JSON.stringify(result)); }

      } else if (excId === 'bybit') {
        // positionIdx must match the account's actual position mode:
        // 0 = One-way (only valid value there). In Hedge mode Bybit
        // requires 1 (Buy/long side) or 2 (Sell/short side) — sending 0
        // on a hedge-mode account gets the order rejected (retCode 10001,
        // "position idx not match position mode"). Hardcoding 0 ignored
        // the posMode toggle entirely; now it follows it like the
        // Binance branch already does.
        var bybitReduceOnly = !!(document.getElementById('fut-chk-reduce') && document.getElementById('fut-chk-reduce').classList.contains('fut-chk-on'));
        var bybitPosIdx = 0;
        if (__NX.state.posMode === 'H') {
          var isLongSide = bybitReduceOnly ? (__NX.state.side !== 'buy') : (__NX.state.side === 'buy');
          bybitPosIdx = isLongSide ? 1 : 2;
        }
        var body = {
          category: 'linear',
          symbol: exSym,
          side: __NX.state.side === 'buy' ? 'Buy' : 'Sell',
          orderType: __NX.state.orderType === 'market' ? 'Market' : __NX.state.orderType === 'stop_market' ? 'Market' : __NX.state.orderType === 'stop_limit' ? 'Limit' : 'Limit',
          qty: amt.toFixed(5),
          timeInForce: tif === 'FOK' ? 'FOK' : tif === 'IOC' ? 'IOC' : 'GTC',
          positionIdx: bybitPosIdx,
        };
        if (bybitReduceOnly) body.reduceOnly = true;
        if (__NX.state.orderType === 'limit' || __NX.state.orderType === 'stop_limit') body.price = price.toFixed(__NX.getDecimals(__NX.state.tickSize));
        if (__NX.state.orderType === 'stop_market' || __NX.state.orderType === 'stop_limit') { body.triggerPrice = price.toFixed(__NX.getDecimals(__NX.state.tickSize)); body.triggerBy = 'MarkPrice'; body.triggerDirection = __NX.state.side === 'buy' ? 1 : 2; }
        if (tpPrice > 0) { body.takeProfit = tpPrice.toFixed(__NX.getDecimals(__NX.state.tickSize)); body.tpTriggerBy = 'MarkPrice'; }
        if (slPrice > 0) { body.stopLoss   = slPrice.toFixed(__NX.getDecimals(__NX.state.tickSize)); body.slTriggerBy = 'MarkPrice'; }
        result = await __NX.signedFetch(cfg, cfg.order, null, 'POST', body);
        if (result.retCode === 0) {
          if (typeof showToast === 'function') showToast('\u2705 Order placed #' + result.result.orderId);
          __NX.loadOpenOrders(); __NX.loadPositions();
        } else { throw new Error(result.retMsg || JSON.stringify(result)); }


      } else if (excId === 'bitget') {
        var bgReduceOnly = !!(document.getElementById('fut-chk-reduce') && document.getElementById('fut-chk-reduce').classList.contains('fut-chk-on'));
        var body = {
          symbol: exSym,
          productType: 'USDT-FUTURES',
          marginMode: __NX.state.marginMode.toLowerCase(),
          marginCoin: 'USDT',
          size: amt.toFixed(5),
          side: __NX.state.side === 'buy' ? 'buy' : 'sell',
          tradeSide: bgReduceOnly ? 'close' : 'open',
          orderType: __NX.state.orderType === 'market' ? 'market' : __NX.state.orderType === 'stop_market' ? 'market' : __NX.state.orderType === 'stop_limit' ? 'limit' : 'limit',
        };
        if (__NX.state.orderType === 'limit' || __NX.state.orderType === 'stop_limit') {
          body.price = price.toFixed(__NX.getDecimals(__NX.state.tickSize));
          body.force = tif === 'IOC' ? 'ioc' : tif === 'FOK' ? 'fok' : 'normal';
        }
        if (__NX.state.orderType === 'stop_market' || __NX.state.orderType === 'stop_limit') { body.triggerPrice = price.toFixed(__NX.getDecimals(__NX.state.tickSize)); body.triggerType = 'fill_price'; body.planType = __NX.state.orderType === 'stop_market' ? 'normal_plan' : 'normal_plan'; }
        if (tpPrice > 0) { body.presetStopSurplusPrice = tpPrice.toFixed(__NX.getDecimals(__NX.state.tickSize)); }
        if (slPrice > 0) { body.presetStopLossPrice    = slPrice.toFixed(__NX.getDecimals(__NX.state.tickSize)); }
        result = await __NX.signedFetch(cfg, cfg.order, null, 'POST', body);
        if (result.code === '00000') {
          if (typeof showToast === 'function') showToast('\u2705 Order placed #' + (result.data||{}).orderId);
          __NX.loadOpenOrders(); __NX.loadPositions();
        } else { throw new Error(result.msg || JSON.stringify(result)); }

      } else if (excId === 'mexc') {
        var mexcReduceOnly = !!(document.getElementById('fut-chk-reduce') && document.getElementById('fut-chk-reduce').classList.contains('fut-chk-on'));
        // MEXC side: 1=open_long, 2=close_long, 3=open_short, 4=close_short
        var mexcSide = mexcReduceOnly
          ? (__NX.state.side === 'buy' ? 4 : 2)  // reduce: buy=close_short, sell=close_long
          : (__NX.state.side === 'buy' ? 1 : 3); // open:   buy=open_long, sell=open_short
        // MEXC encodes TIF in orderType: 1=Limit(GTC), 3=IOC, 4=FOK, 5=Market
        var mexcType = __NX.state.orderType === 'market' ? 5 : __NX.state.orderType === 'stop_market' ? 6 : __NX.state.orderType === 'stop_limit' ? 2 : (tif === 'IOC' ? 3 : tif === 'FOK' ? 4 : 1);
        var body = {
          symbol: exSym,
          side: mexcSide,
          orderType: mexcType,
          vol: amt.toFixed(5),
          leverage: __NX.state.leverage,
          openType: __NX.state.marginMode === 'Cross' ? 2 : 1,
        };
        if (__NX.state.orderType === 'limit') body.price = price;
        if (__NX.state.orderType === 'stop_limit' || __NX.state.orderType === 'stop_market') { body.price = price; body.stopPrice = price; }
        if (tpPrice > 0) body.takeProfitPrice = tpPrice;
        if (slPrice > 0) body.stopLossPrice   = slPrice;
        result = await __NX.signedFetch(cfg, cfg.order, null, 'POST', body);
        if (result.success) {
          if (typeof showToast === 'function') showToast('\u2705 Order placed #' + result.data);
          __NX.loadOpenOrders(); __NX.loadPositions();
        } else { throw new Error(result.message || JSON.stringify(result)); }

      } else if (excId === 'gateio') {
        var gateReduceOnly = !!(document.getElementById('fut-chk-reduce') && document.getElementById('fut-chk-reduce').classList.contains('fut-chk-on'));
        var body = {
          contract: exSym,
          size: Math.max(1, Math.round(amt)),
          price: __NX.state.orderType === 'market' ? '0' : price.toFixed(__NX.getDecimals(__NX.state.tickSize)),
          tif: __NX.state.orderType === 'market' || __NX.state.orderType === 'stop_market' ? 'ioc' : _tifGate(tif),
          reduce_only: gateReduceOnly,
        };
        if (__NX.state.side === 'sell') body.size = -Math.abs(body.size);
        if (__NX.state.orderType === 'stop_market' || __NX.state.orderType === 'stop_limit') {
          // Gate.io stop orders use /api/v4/futures/usdt/price_orders endpoint
          var gateStopBody = {
            initial: { contract: exSym, size: body.size, price: __NX.state.orderType === 'stop_limit' ? price.toFixed(__NX.getDecimals(__NX.state.tickSize)) : '0', tif: __NX.state.orderType === 'stop_limit' ? _tifGate(tif) : 'ioc', reduce_only: gateReduceOnly },
            trigger: { strategy_type: 0, price_type: 1, price: price.toFixed(__NX.getDecimals(__NX.state.tickSize)), rule: __NX.state.side === 'buy' ? 1 : 2 },
          };
          result = await __NX.signedFetch(cfg, '/api/v4/futures/usdt/price_orders', null, 'POST', gateStopBody);
          if (result.id) {
            if (typeof showToast === 'function') showToast('✅ Stop order placed #' + result.id);
            __NX.loadOpenOrders(); __NX.loadPositions();
          } else { throw new Error(result.label || JSON.stringify(result)); }
          // early return — do not fall through to regular order block
        } else if (true) {
        result = await __NX.signedFetch(cfg, cfg.order, null, 'POST', body);
        if (result.id) {
          // Gate.io: place TP/SL as separate price-triggered orders after main order
          if (tpPrice > 0 || slPrice > 0) _futGatePlaceTpSl(cfg, exSym, side, body.size, tpPrice, slPrice).catch(function(){});
          if (typeof showToast === 'function') showToast('\u2705 Order placed #' + result.id);
          __NX.loadOpenOrders(); __NX.loadPositions();
        } else { throw new Error(result.label || JSON.stringify(result)); }
        }

      } else if (excId === 'bingx') {
        var bingxReduceOnly = !!(document.getElementById('fut-chk-reduce') && document.getElementById('fut-chk-reduce').classList.contains('fut-chk-on'));
        // positionSide: hedge mode → LONG/SHORT (close reverses); one-way → BOTH
        var bingxPosSide;
        if (__NX.state.posMode === 'H') {
          bingxPosSide = bingxReduceOnly ? (__NX.state.side === 'buy' ? 'SHORT' : 'LONG') : (__NX.state.side === 'buy' ? 'LONG' : 'SHORT');
        } else {
          bingxPosSide = 'BOTH';
        }
        var params = {
          symbol: exSym,
          side: __NX.state.side === 'buy' ? 'BUY' : 'SELL',
          positionSide: bingxPosSide,
          type: __NX.state.orderType === 'market' ? 'MARKET' : __NX.state.orderType === 'stop_market' ? 'STOP_MARKET' : __NX.state.orderType === 'stop_limit' ? 'STOP' : 'LIMIT',
          quantity: amt.toFixed(5),
        };
        if (bingxReduceOnly && __NX.state.posMode !== 'H') params.reduceOnly = 'true';
        if (__NX.state.orderType === 'limit' || __NX.state.orderType === 'stop_limit') {
          params.price = price.toFixed(__NX.getDecimals(__NX.state.tickSize));
          params.timeInForce = tif === 'IOC' ? 'IOC' : tif === 'FOK' ? 'FOK' : 'GTC';
        }
        if (__NX.state.orderType === 'stop_market' || __NX.state.orderType === 'stop_limit') { params.stopPrice = price.toFixed(__NX.getDecimals(__NX.state.tickSize)); params.workingType = 'MARK_PRICE'; }
        if (tpPrice > 0) { params.takeProfit = JSON.stringify({ type:'TAKE_PROFIT_MARKET', stopPrice: tpPrice, workingType:'MARK_PRICE' }); }
        if (slPrice > 0) { params.stopLoss   = JSON.stringify({ type:'STOP_MARKET',        stopPrice: slPrice, workingType:'MARK_PRICE' }); }
        result = await __NX.signedFetch(cfg, cfg.order, params, 'POST');
        if (result.code === 0) {
          if (typeof showToast === 'function') showToast('\u2705 Order placed #' + (result.data||{}).orderId);
          __NX.loadOpenOrders(); __NX.loadPositions();
        } else { throw new Error(result.msg || JSON.stringify(result)); }

      } else if (excId === 'htx') {
        var htxReduceOnly = !!(document.getElementById('fut-chk-reduce') && document.getElementById('fut-chk-reduce').classList.contains('fut-chk-on'));
        // HTX encodes TIF inside order_price_type: limit=GTC, ioc=IOC, fok=FOK
        var htxPriceType = __NX.state.orderType === 'market' ? 'market' : (tif === 'IOC' ? 'ioc' : tif === 'FOK' ? 'fok' : 'limit');
        var body = {
          contract_code: exSym,
          direction: __NX.state.side,
          offset: htxReduceOnly ? 'close' : 'open',
          lever_rate: __NX.state.leverage,
          order_price_type: htxPriceType,
          volume: Math.max(1, Math.round(amt)),
        };
        if (__NX.state.orderType === 'limit') body.price = price;
        if (__NX.state.orderType === 'stop_limit' || __NX.state.orderType === 'stop_market') { body.trigger_price = price; if (__NX.state.orderType === 'stop_limit') body.price = price; }
        // HTX: tp/sl placed as separate trigger orders after main order
        result = await __NX.signedFetch(cfg, cfg.order, null, 'POST', body);
        if (result.status === 'ok') {
          var _htxOrdId = (result.data||{}).order_id_str;
          if ((tpPrice > 0 || slPrice > 0) && _htxOrdId) _futHtxPlaceTpSl(cfg, exSym, side, tpPrice, slPrice).catch(function(){});
          if (typeof showToast === 'function') showToast('\u2705 Order placed #' + _htxOrdId);
          __NX.loadOpenOrders(); __NX.loadPositions();
        } else { throw new Error((result.err_msg) || JSON.stringify(result)); }

      } else if (excId === 'kucoin') {
        // Sync margin mode to exchange before placing order to avoid mismatch error
        try {
          var _kcMM = __NX.state.marginMode === 'Isolated' ? 'ISOLATED' : 'CROSS';
          await __NX.signedFetch(cfg, '/api/v2/position/changeMarginMode', null, 'POST', { symbol: exSym, marginMode: _kcMM });
        } catch(e) { /* ignore — order will fail with clear error if still mismatched */ }
        var body = {
          clientOid: 'nex_' + Date.now(),
          symbol: exSym,
          side: __NX.state.side,
          type: __NX.state.orderType === 'market' || __NX.state.orderType === 'stop_market' ? 'market' : 'limit',
          size: Math.max(1, Math.round(amt)),
          leverage: String(__NX.state.leverage),
          timeInForce: _tifKucoin(tif),
          marginMode: __NX.state.marginMode === 'Isolated' ? 'ISOLATED' : 'CROSS',
        };
        if (__NX.state.orderType === 'limit' || __NX.state.orderType === 'stop_limit') body.price = price.toFixed(__NX.getDecimals(__NX.state.tickSize));
        if (__NX.state.orderType === 'stop_market' || __NX.state.orderType === 'stop_limit') { body.stop = __NX.state.side === 'buy' ? 'up' : 'down'; body.stopPrice = price.toFixed(__NX.getDecimals(__NX.state.tickSize)); body.stopPriceType = 'MP'; }
        // KuCoin: TP/SL placed as separate stop orders after main order; do NOT set stop on main body
        result = await __NX.signedFetch(cfg, cfg.order, null, 'POST', body);
        if (result.code === '200000') {
          var _kcOrdId = (result.data||{}).orderId;
          if (tpPrice > 0 || slPrice > 0) _futKucoinPlaceTpSl(cfg, exSym, side, tpPrice, slPrice, amt).catch(function(){});
          if (typeof showToast === 'function') showToast('\u2705 Order placed #' + _kcOrdId);
          __NX.loadOpenOrders(); __NX.loadPositions();
        } else { throw new Error(result.msg || JSON.stringify(result)); }
      } else if (excId === 'phemex') {
        var phemexReduceOnly = !!(document.getElementById('fut-chk-reduce') && document.getElementById('fut-chk-reduce').classList.contains('fut-chk-on'));
        // posSide: one-way mode = 'Net'; hedge mode = 'Long'/'Short' (close reverses)
        var phemexPosSide;
        if (__NX.state.posMode === 'H') {
          phemexPosSide = phemexReduceOnly ? (__NX.state.side === 'buy' ? 'Short' : 'Long') : (__NX.state.side === 'buy' ? 'Long' : 'Short');
        } else {
          phemexPosSide = 'Net';
        }
        var body = {
          symbol: exSym,
          side: __NX.state.side === 'buy' ? 'Buy' : 'Sell',
          orderQtyRq: amt.toFixed(5),
          ordType: __NX.state.orderType === 'market' ? 'Market' : __NX.state.orderType === 'stop_market' ? 'Stop' : __NX.state.orderType === 'stop_limit' ? 'StopLimit' : 'Limit',
          posSide: phemexPosSide,
          reduceOnly: phemexReduceOnly && __NX.state.posMode !== 'H',
        };
        if (__NX.state.orderType === 'limit' || __NX.state.orderType === 'stop_limit') {
          body.priceRp = price.toFixed(__NX.getDecimals(__NX.state.tickSize));
          body.timeInForce = tif === 'IOC' ? 'ImmediateOrCancel' : tif === 'FOK' ? 'FillOrKill' : 'GoodTillCancel';
        }
        if (__NX.state.orderType === 'stop_market' || __NX.state.orderType === 'stop_limit') { body.stopPxRp = price.toFixed(__NX.getDecimals(__NX.state.tickSize)); body.triggerType = 'ByMarkPrice'; }
        if (tpPrice > 0) body.takeProfitRp = tpPrice.toFixed(__NX.getDecimals(__NX.state.tickSize));
        if (slPrice > 0) body.stopLossRp   = slPrice.toFixed(__NX.getDecimals(__NX.state.tickSize));
        result = await __NX.signedFetch(cfg, cfg.order, null, 'POST', body);
        if (result.code === 0) {
          if (typeof showToast === 'function') showToast('✅ Order placed #' + (result.data||{}).orderID);
          __NX.loadOpenOrders(); __NX.loadPositions();
        } else { throw new Error(result.msg || JSON.stringify(result)); }

      } else if (excId === 'bitmart') {
        var body = {
          symbol: exSym,
          side: __NX.state.side === 'buy' ? 1 : 2,
          type: __NX.state.orderType === 'market' ? 5 : __NX.state.orderType === 'stop_market' ? 6 : __NX.state.orderType === 'stop_limit' ? 2 : 1,
          leverage: __NX.state.leverage,
          size: Math.max(1, Math.round(amt)),
          open_type: __NX.state.marginMode === 'Isolated' ? 'isolated' : 'cross',
        };
        if (__NX.state.orderType === 'limit' || __NX.state.orderType === 'stop_limit') {
          body.price = price.toFixed(__NX.getDecimals(__NX.state.tickSize));
          body.timeInForce = tif === 'IOC' ? 2 : tif === 'FOK' ? 4 : 1;
        }
        if (__NX.state.orderType === 'stop_market' || __NX.state.orderType === 'stop_limit') { body.trigger_price = price.toFixed(__NX.getDecimals(__NX.state.tickSize)); }
        if (tpPrice > 0) body.preset_take_profit_price = parseFloat(tpPrice.toFixed(__NX.getDecimals(__NX.state.tickSize)));
        if (slPrice > 0) body.preset_stop_loss_price   = parseFloat(slPrice.toFixed(__NX.getDecimals(__NX.state.tickSize)));
        result = await __NX.signedFetch(cfg, cfg.order, null, 'POST', body);
        if (result.code === 1000) {
          if (typeof showToast === 'function') showToast('✅ Order placed #' + (result.data||{}).order_id);
          __NX.loadOpenOrders(); __NX.loadPositions();
        } else { throw new Error(result.message || JSON.stringify(result)); }

      } else if (excId === 'kraken') {
        var krakenReduceOnly = !!(document.getElementById('fut-chk-reduce') && document.getElementById('fut-chk-reduce').classList.contains('fut-chk-on'));
        var body = {
          orderType: __NX.state.orderType === 'market' ? 'mkt' : __NX.state.orderType === 'stop_market' ? 'stp' : __NX.state.orderType === 'stop_limit' ? 'stp' : 'lim',
          symbol: exSym,
          side: __NX.state.side === 'buy' ? 'buy' : 'sell',
          size: amt.toFixed(5),
          reduceOnly: krakenReduceOnly,
        };
        if (__NX.state.orderType === 'limit' || __NX.state.orderType === 'stop_limit') {
          body.limitPrice = price.toFixed(__NX.getDecimals(__NX.state.tickSize));
          body.timeInForce = tif === 'IOC' ? 'ioc' : 'gtc';
        }
        if (__NX.state.orderType === 'stop_market' || __NX.state.orderType === 'stop_limit') { body.stopPrice = price.toFixed(__NX.getDecimals(__NX.state.tickSize)); body.triggerSignal = 'mark'; }
        result = await __NX.signedFetch(cfg, cfg.order, null, 'POST', body);
        if (result.result === 'success') {
          if (tpPrice > 0 || slPrice > 0) _futKrakenPlaceTpSl(cfg, exSym, side, tpPrice, slPrice, amt).catch(function(){});
          if (typeof showToast === 'function') showToast('✅ Order placed');
          __NX.loadOpenOrders(); __NX.loadPositions();
        } else { throw new Error((result.error||[]).join(',') || JSON.stringify(result)); }

      } else if (excId === 'digifinex') {
        var digiReduceOnly = !!(document.getElementById('fut-chk-reduce') && document.getElementById('fut-chk-reduce').classList.contains('fut-chk-on'));
        // DigiFinex type: 1=open_long, 2=open_short, 3=close_long, 4=close_short
        var digiType = digiReduceOnly
          ? (__NX.state.side === 'buy' ? 4 : 3)   // close: buy=close_short(4), sell=close_long(3)
          : (__NX.state.side === 'buy' ? 1 : 2);  // open:  buy=open_long(1),  sell=open_short(2)
        var body = {
          instrument_id: exSym,
          type: digiType,
          order_type: __NX.state.orderType === 'market' ? 4 : __NX.state.orderType === 'stop_market' ? 3 : __NX.state.orderType === 'stop_limit' ? 2 : 1,
          qty: amt.toFixed(5),
          margin_mode: __NX.state.marginMode === 'Isolated' ? 'Isolated' : 'Cross',
        };
        if (__NX.state.orderType === 'limit' || __NX.state.orderType === 'stop_limit') {
          body.price = price.toFixed(__NX.getDecimals(__NX.state.tickSize));
          body.time_in_force = tif === 'IOC' ? 'IOC' : tif === 'FOK' ? 'FOK' : 'GTC';
        }
        if (__NX.state.orderType === 'stop_market' || __NX.state.orderType === 'stop_limit') { body.trigger_price = price.toFixed(__NX.getDecimals(__NX.state.tickSize)); }
        result = await __NX.signedFetch(cfg, cfg.order, null, 'POST', body);
        if (result.code === 0) {
          if (tpPrice > 0 || slPrice > 0) _futDigifinexPlaceTpSl(cfg, exSym, side, tpPrice, slPrice, amt).catch(function(){});
          if (typeof showToast === 'function') showToast('✅ Order placed #' + result.data);
          __NX.loadOpenOrders(); __NX.loadPositions();
        } else { throw new Error(result.msg || JSON.stringify(result)); }

      } else if (excId === 'lbank') {
        var lbankReduceOnly = !!(document.getElementById('fut-chk-reduce') && document.getElementById('fut-chk-reduce').classList.contains('fut-chk-on'));
        // LBank direction: openLong/openShort for new positions; closeShort/closeLong to reduce
        var lbankDir = lbankReduceOnly
          ? (__NX.state.side === 'buy' ? 'closeShort' : 'closeLong')
          : (__NX.state.side === 'buy' ? 'openLong'   : 'openShort');
        var body = {
          symbol: exSym,
          direction: lbankDir,
          type: __NX.state.orderType === 'market' || __NX.state.orderType === 'stop_market' ? 'market' : 'limit',
          quantity: amt.toFixed(5),
          lever_rate: __NX.state.leverage,
        };
        if (__NX.state.orderType === 'limit' || __NX.state.orderType === 'stop_limit') {
          body.price = price.toFixed(__NX.getDecimals(__NX.state.tickSize));
          body.time_in_force = tif === 'IOC' ? 'IOC' : tif === 'FOK' ? 'FOK' : 'GTC';
        }
        if (__NX.state.orderType === 'stop_market' || __NX.state.orderType === 'stop_limit') { body.trigger_price = price.toFixed(__NX.getDecimals(__NX.state.tickSize)); }
        if (tpPrice > 0) body.take_profit_price = tpPrice.toFixed(__NX.getDecimals(__NX.state.tickSize));
        if (slPrice > 0) body.stop_loss_price   = slPrice.toFixed(__NX.getDecimals(__NX.state.tickSize));
        result = await __NX.signedFetch(cfg, cfg.order, null, 'POST', body);
        if (result.result === true || result.error_code === 0) {
          if (typeof showToast === 'function') showToast('✅ Order placed #' + result.data);
          __NX.loadOpenOrders(); __NX.loadPositions();
        } else { throw new Error(result.msg || JSON.stringify(result)); }

      } else if (excId === 'bitfinex') {
        var body = [
          null, null, null, null,
          __NX.state.side === 'buy' ? amt : -amt,
          (__NX.state.orderType === 'limit' || __NX.state.orderType === 'stop_limit') ? price : null,
          __NX.state.orderType === 'market' ? 'MARKET' : __NX.state.orderType === 'stop_market' ? 'STOP' : __NX.state.orderType === 'stop_limit' ? 'STOP LIMIT' : 'LIMIT',
          null, null, null, null, null,
          { lev: __NX.state.leverage },
          null,
          null,
          exSym,
        ];
        result = await __NX.signedFetch(cfg, cfg.order, null, 'POST', body);
        if (Array.isArray(result) && result[6] === 'SUCCESS') {
          if (typeof showToast === 'function') showToast('✅ Order placed');
          __NX.loadOpenOrders(); __NX.loadPositions();
        } else { throw new Error((Array.isArray(result) && result[7]) || JSON.stringify(result)); }

      } else if (excId === 'coinbase') {
        // Advanced Trade Create Order — same /orders endpoint as spot, but
        // perpetuals add top-level leverage + margin_type fields alongside
        // the usual order_configuration (confirmed against the official
        // Create Order reference: these are siblings, not nested inside
        // order_configuration).
        var orderCfg;
        if (__NX.state.orderType === 'market') {
          orderCfg = { market_market_ioc: { base_size: String(amt) } };
        } else if (__NX.state.orderType === 'stop_market') {
          orderCfg = { stop_limit_stop_limit_gtc: { base_size: String(amt), stop_price: String(price), limit_price: String(price) } };
        } else if (__NX.state.orderType === 'stop_limit') {
          orderCfg = { stop_limit_stop_limit_gtc: { base_size: String(amt), stop_price: String(price), limit_price: String(price) } };
        } else if (tif === 'FOK') {
          orderCfg = { limit_limit_fok: { base_size: String(amt), limit_price: String(price) } };
        } else {
          orderCfg = { limit_limit_gtc: { base_size: String(amt), limit_price: String(price), post_only: false } };
        }
        var cbOrderBody = {
          client_order_id: 'nx' + Date.now(),
          product_id: exSym, // e.g. BTC-PERP-INTX
          side: side, // BUY / SELL
          order_configuration: orderCfg,
          leverage: String(__NX.state.leverage),
          margin_type: __NX.state.marginMode === 'Isolated' ? 'ISOLATED' : 'CROSS',
        };
        result = await __NX._coinbaseFetchJwt('POST', cfg.order, keys, cbOrderBody);
        if (result && result.success) {
          if (typeof showToast === 'function') showToast('✅ Order placed');
          __NX.loadOpenOrders(); __NX.loadPositions();
        } else {
          var cbErr = (result && result.error_response) ? (result.error_response.message || result.error_response.error) : JSON.stringify(result);
          throw new Error(cbErr || 'Order rejected');
        }

      } else {
        if (typeof showToast === 'function') showToast('This exchange futures API not supported yet');
      }
    } catch(e) {
      if (typeof showToast === 'function') showToast('\u274c ' + (e.message || 'Order failed'));
    } finally {
      __NX.state.loading = false;
      if (btn) btn.textContent = origText;
      // Refresh balance after order attempt
      setTimeout(__NX.loadFutBalance, 1200);
    }
  }
})((window.__nxp = window.__nxp || {}).mod_fut_futures_engine = window.__nxp.mod_fut_futures_engine || {});
