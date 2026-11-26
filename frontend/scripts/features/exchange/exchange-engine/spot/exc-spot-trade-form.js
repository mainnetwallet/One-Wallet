// Trade form: order type, side, sliders, totals and pair picker
// Part of the exchange spot engine (window.EXC) module (split by topic; no logic change).
(function (__NX) {
  __NX.setOrderType = setOrderType;
  __NX.setSide = setSide;
  __NX.setPct = setPct;
  __NX.sliderChange = sliderChange;
  __NX.stepPrice = stepPrice;
  __NX.stepAmount = stepAmount;
  __NX.snapAmount = snapAmount;
  __NX.updateMaxBuy = updateMaxBuy;
  __NX.calcTotal = calcTotal;
  __NX.updateTradePairPrice = updateTradePairPrice;
  __NX.openPairPicker = openPairPicker;
  __NX.closePairPicker = closePairPicker;
  __NX.filterPairPicker = filterPairPicker;
  __NX.selectPair = selectPair;
  __NX.selectPairFromMarket = selectPairFromMarket;


  // ── Trade tab ──
  function setOrderType(type) {
    __NX.state.orderType = type;
    var mkt = document.getElementById('exc-ot-market');
    var lmt = document.getElementById('exc-ot-limit');
    var limRow = document.getElementById('exc-limit-row');
    var sideColor = (window._excSide === 'sell') ? '#f6465d' : '#0ecb81';
    if (mkt) {
      mkt.style.color = type==='market' ? 'var(--text-primary)' : 'var(--text-muted)';
      mkt.style.borderBottomColor = type==='market' ? sideColor : 'transparent';
    }
    if (lmt) {
      lmt.style.color = type==='limit' ? 'var(--text-primary)' : 'var(--text-muted)';
      lmt.style.borderBottomColor = type==='limit' ? sideColor : 'transparent';
    }
    if (limRow) limRow.style.display = type==='limit' ? 'block' : 'none';
    if (typeof excUpdateSplitSize === 'function') excUpdateSplitSize();
  }

  function setSide(side) {
    window._excSide = side;
    var buyEl  = document.getElementById('exc-side-buy');
    var sellEl = document.getElementById('exc-side-sell');
    var btn    = document.getElementById('exc-main-btn');
    var pair   = (__NX.state.activePair||'BTCUSDT').replace('USDT','');
    if (buyEl)  { buyEl.style.background  = side==='buy'  ? '#0ecb81' : 'transparent'; buyEl.style.color  = side==='buy'  ? '#fff' : 'var(--text-muted)'; }
    if (sellEl) { sellEl.style.background = side==='sell' ? '#f6465d' : 'transparent'; sellEl.style.color = side==='sell' ? '#fff' : 'var(--text-muted)'; }
    if (btn) {
      btn.style.background = side==='buy' ? '#0ecb81' : '#f6465d';
      btn.textContent = side==='buy' ? 'Buy '+pair : 'Sell '+pair;
    }
    // re-color order type tabs
    setOrderType(__NX.state.orderType);
    __NX.loadAvailableBalance();
  }

  function setPct(pct) {
    var slider = document.getElementById('exc-trade-slider');
    if (slider) slider.value = pct;
    sliderChange(pct);
  }

  // Amount formatter — uses exchange step size precision when known
  function fmtAmt(v) {
    if (!v || !isFinite(v) || v <= 0) return '';
    var dec;
    if (__NX.state.currentStepSize > 0) {
      dec = __NX.state.currentStepDecimals;
    } else {
      // Auto-detect meaningful decimal places from value magnitude
      if (v >= 100)       dec = 2;
      else if (v >= 1)    dec = 4;
      else if (v >= 0.01) dec = 6;
      else                dec = 8;
    }
    // Use toFixed then strip trailing zeros for clean display
    return parseFloat(v.toFixed(dec)).toString();
  }

  // Truncate amount to exchange step size — floors to nearest valid step
  function truncateToStep(amount) {
    var step = __NX.state.currentStepSize;
    if (!step || step <= 0) return amount;
    var dec = __NX.state.currentStepDecimals;
    // Use integer math via scaling to avoid floating-point drift
    // e.g. 0.001 * 3 = 0.0030000000000000003 without this fix
    var scale = Math.pow(10, dec);
    var steps = Math.floor(Math.round(amount * scale) / Math.round(step * scale));
    return parseFloat((steps * step).toFixed(dec));
  }

  function sliderChange(pct) {
    pct = parseFloat(pct) || 0;
    var avail = parseFloat((document.getElementById('exc-avail-bal')||{}).textContent) || 0;
    var m = __NX.state.markets.find(function(x){ return x.symbol === __NX.state.activePair; });
    var price = 0;
    if (__NX.state.orderType === 'limit') {
      price = parseFloat((document.getElementById('exc-limit-price')||{}).value) || 0;
    } else {
      price = m ? m.price : 0;
    }
    if (!price) return;
    var side = window._excSide || 'buy';
    var inp = document.getElementById('exc-trade-amount');
    if (side === 'buy') {
      var usdtAmt = avail * pct / 100;
      var baseAmt = usdtAmt / price;
      var snapped = truncateToStep(baseAmt);
      if (inp) inp.value = fmtAmt(snapped > 0 ? snapped : baseAmt);
    } else {
      // sell side: avail is in base currency
      var baseAvail = parseFloat((document.getElementById('exc-avail-bal')||{}).textContent) || 0;
      var baseAmt2 = baseAvail * pct / 100;
      var snapped2 = truncateToStep(baseAmt2);
      if (inp) inp.value = fmtAmt(snapped2 > 0 ? snapped2 : baseAmt2);
    }
    calcTotal();
    updateMaxBuy();
  }

  function stepPrice(dir) {
    var inp = document.getElementById('exc-limit-price');
    if (!inp) return;
    var v = parseFloat(inp.value) || 0;
    var step = v > 1000 ? 1 : v > 10 ? 0.1 : 0.01;
    inp.value = Math.max(0, v + dir * step).toFixed(v > 1000 ? 2 : v > 10 ? 2 : 4);
    calcTotal();
  }

  function stepAmount(dir) {
    var inp = document.getElementById("exc-trade-amount");
    if (!inp) return;
    var v = parseFloat(inp.value) || 0;
    var step = __NX.state.currentStepSize > 0 ? __NX.state.currentStepSize : (v >= 1 ? 0.001 : v >= 0.001 ? 0.0001 : 0.00000001);
    var newVal = Math.max(0, v + dir * step);
    newVal = truncateToStep(newVal) || newVal;
    inp.value = fmtAmt(newVal) || "0";
    calcTotal();
  }

  // Called onblur — snaps user-typed amount to the exchange's step size
  function snapAmount() {
    var inp = document.getElementById('exc-trade-amount');
    if (!inp) return;
    var v = parseFloat(inp.value);
    if (!v || !isFinite(v) || v <= 0) return;
    var snapped = truncateToStep(v);
    var formatted = fmtAmt(snapped > 0 ? snapped : v);
    if (formatted !== inp.value) {
      inp.value = formatted;
      // Visual feedback: briefly highlight the field in amber to signal correction
      inp.style.color = '#f59e0b';
      setTimeout(function() { inp.style.color = ''; }, 600);
      calcTotal();
    }
  }









  function updateMaxBuy() {
    var avail = parseFloat((document.getElementById('exc-avail-bal')||{}).textContent) || 0;
    var m = __NX.state.markets.find(function(x){ return x.symbol === __NX.state.activePair; });
    var price = m ? m.price : 0;
    var el = document.getElementById('exc-max-buy');
    var labelEl = document.getElementById('exc-max-label');
    var side = window._excSide || 'buy';
    var quote = __NX.state.activePair.replace(/^.*?(USDT|BTC|ETH)$/, '$1');
    var base  = __NX.state.activePair.replace(new RegExp(quote + '$'), '') || 'BTC';
    if (labelEl) labelEl.textContent = side === 'sell' ? 'Max Sell' : 'Max Buy';
    if (el) {
      if (side === 'sell') {
        // avail is already the base-asset balance — that IS the max sellable amount
        el.textContent = fmtAmt(avail) + ' ' + base;
      } else if (price) {
        el.textContent = fmtAmt(avail / price) + ' ' + base;
      }
    }
  }

  function calcTotal() {
    var amount = parseFloat((document.getElementById('exc-trade-amount')||{}).value) || 0;
    var price = 0;

    // helper: get best available price from any source
    function getBestPrice() {
      // 1. state.markets
      var mkt = __NX.state.markets && __NX.state.markets.find(function(x) { return x.symbol === __NX.state.activePair; });
      if (mkt && mkt.price) return mkt.price;
      // 2. order book mid price element
      var midEl = document.getElementById('exc-ob-mid');
      if (midEl) { var mp = parseFloat(midEl.textContent.replace(/,/g,'')); if (mp) return mp; }
      // 3. top price display
      var prEl = document.getElementById('exc-trade-price');
      if (prEl) { var pp = parseFloat(prEl.textContent.replace(/,/g,'')); if (pp) return pp; }
      return 0;
    }

    if (__NX.state.orderType === 'limit') {
      price = parseFloat((document.getElementById('exc-limit-price')||{}).value) || 0;
      if (!price) price = getBestPrice();
    } else {
      price = getBestPrice();
    }

    var total = amount * price;
    var el = document.getElementById('exc-trade-total');
    if (el) el.textContent = total ? (total >= 1 ? parseFloat(total.toFixed(8)).toString() : parseFloat(total.toPrecision(8)).toString()) : '0.00';
    updateMaxBuy();
  }

  function updateTradePairPrice() {
    var m = __NX.state.markets.find(function(x) { return x.symbol === __NX.state.activePair; });
    var priceEl  = document.getElementById('exc-trade-price');
    var changeEl = document.getElementById('exc-trade-change');
    var pairEl   = document.getElementById('exc-trade-pair');
    var baseEl   = document.getElementById('exc-trade-base');
    var baseEl2  = document.getElementById('exc-trade-base2');
    var obMid    = document.getElementById('exc-ob-mid');
    var base = __NX.state.activePair.replace(/USDT$|BTC$|ETH$|BNB$/, '');
    if (pairEl) pairEl.textContent = base + '/' + __NX.state.activePair.replace(base,'');
    if (baseEl)  baseEl.textContent  = base;
    if (baseEl2) baseEl2.textContent = base;
    // Update main btn text
    var btn = document.getElementById('exc-main-btn');
    if (btn) btn.textContent = (window._excSide==='sell' ? 'Sell ' : 'Buy ') + base;
    if (m) {
      var c = m.change >= 0;
      if (priceEl) { priceEl.textContent = __NX.fmtPrice(m.price); priceEl.style.color = c ? '#0ecb81' : '#f6465d'; }
      if (changeEl) { changeEl.textContent = (c?'+':'')+m.change.toFixed(2)+'%'; changeEl.style.color = c?'#0ecb81':'#f6465d'; }
      if (obMid) { obMid.textContent = __NX.fmtPrice(m.price); obMid.style.color = c ? '#0ecb81' : '#f6465d'; }
      // Pre-fill limit price with current market price
      var lpEl = document.getElementById('exc-limit-price');
      if (lpEl && !lpEl.value) lpEl.value = __NX.fmtPrice(m.price);
    } else {
      if (priceEl) { priceEl.textContent = '—'; priceEl.style.color = '#0ecb81'; }
      if (changeEl) { changeEl.textContent = '—'; changeEl.style.color = 'var(--text-muted)'; }
    }
  }

  // ── Pair picker ──
  function openPairPicker() {
    var sheet = document.getElementById('exc-pair-sheet');
    if (!sheet) return;
    renderPairPicker('');
    sheet.style.display = 'flex';
  }

  function closePairPicker() {
    var s = document.getElementById('exc-pair-sheet');
    if (s) s.style.display = 'none';
  }

  function filterPairPicker() {
    var q = (document.getElementById('exc-pair-search')||{}).value || '';
    renderPairPicker(q.toUpperCase());
  }

  function renderPairPicker(q) {
    var list = document.getElementById('exc-pair-list');
    if (!list) return;
    var pairs = __NX.state.markets.filter(function(m) {
      return m.symbol.endsWith('USDT') && (!q || m.symbol.includes(q));
    }).slice(0,50);
    list.innerHTML = pairs.map(function(m) {
      return '<div onclick="EXC.selectPair(\''+m.symbol+'\')" style="display:flex;align-items:center;justify-content:space-between;padding:10px 8px;border-radius:10px;cursor:pointer;-webkit-tap-highlight-color:transparent;active:background:rgba(255,255,255,0.05);">' +
        '<span style="font-size:14px;font-weight:700;font-family:var(--font-mono);color:var(--text-primary);">'+m.symbol.replace('USDT','/USDT')+'</span>' +
        '<span style="font-size:13px;font-family:var(--font-mono);color:'+(m.change>=0?'#22c55e':'#ef4444')+';font-weight:600;">'+(m.change>=0?'+':'')+m.change.toFixed(2)+'%</span>' +
      '</div>';
    }).join('');
  }

  function selectPair(symbol) {
    __NX.state.activePair = symbol;
    __NX.state.currentStepSize = 0;
    __NX.state.currentStepDecimals = 8;
    try { localStorage.setItem('one_exc_pair_' + (__NX.state.activeExchange || 'binance'), symbol); } catch(e) {}
    closePairPicker();
    updateTradePairPrice();
    calcTotal();
    __NX.loadAvailableBalance();
    // Fetch exchange lot-size step for this pair and cache in state
    var exc = __NX.activeExc();
    if (exc) {
      __NX.getTradeMinimums(exc, symbol).then(function(min) {
        if (min && min.stepSize > 0) {
          __NX.state.currentStepSize = min.stepSize;
          __NX.state.currentStepDecimals = (min.stepSize.toString().split('.')[1] || '').length;
          // Update amount input placeholder to reflect precision
          var inp = document.getElementById('exc-trade-amount');
          if (inp) {
            var ex = '0.' + '0'.repeat(Math.max(0, __NX.state.currentStepDecimals - 1)) + '1';
            inp.placeholder = ex;
          }
        }
      }).catch(function(){});
    }
    // Update main button label
    var btn = document.getElementById('exc-main-btn');
    var base = symbol.replace('USDT','').replace('BTC','') || symbol.slice(0,-4);
    if (btn) btn.textContent = (window._excSide==='sell' ? 'Sell ' : 'Buy ') + base;
    var b1 = document.getElementById('exc-trade-base');
    var b2 = document.getElementById('exc-trade-base2');
    if (b1) b1.textContent = base;
    if (b2) b2.textContent = base;
    // Restart order book (all exchanges) — runs regardless of active tab,
    // so the feed is already live in the background before the user even
    // opens the Trade tab.
    __NX.startOrderBook(symbol);
  }

  function selectPairFromMarket(symbol) {
    selectPair(symbol);
    __NX.switchTab('trade');
  }
})((window.__nxp = window.__nxp || {}).mod_exc_spot_engine = window.__nxp.mod_exc_spot_engine || {});
