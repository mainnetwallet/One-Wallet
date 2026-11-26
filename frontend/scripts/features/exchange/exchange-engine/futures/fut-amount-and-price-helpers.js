// Futures: price/amount steps, contract size, unit toggle, percent and cost
// Part of the futures engine (FUT) module (split by topic; no logic change).
(function (__NX) {
  __NX.getDecimals = getDecimals;
  __NX.stepPrice = stepPrice;
  __NX.stepAmount = stepAmount;
  __NX._contractSize = _contractSize;
  __NX._updateAmtUnit = _updateAmtUnit;
  __NX._attachScrollInputs = _attachScrollInputs;
  __NX.fillPrice = fillPrice;
  __NX.useBBO = useBBO;
  __NX.toggleCheck = toggleCheck;
  __NX.sliderClick = sliderClick;
  __NX.calcCost = calcCost;


  function getDecimals(step) {
    var s = String(step); var i = s.indexOf('.');
    return i === -1 ? 0 : (s.length - i - 1);
  }

  function stepPrice(dir) {
    var inp = document.getElementById('fut-price'); if (!inp) return;
    var v = parseFloat(inp.value) || __NX.state.lastPrice || 0;
    v = v + dir * __NX.state.tickSize;
    inp.value = v.toFixed(getDecimals(__NX.state.tickSize));
    calcCost();
  }

  function stepAmount(dir) {
    var inp = document.getElementById('fut-amount'); if (!inp) return;
    var v = parseFloat(inp.value) || 0;
    var _contractExc = ['kucoin','kraken','htx','bitmart','mexc'];
    var isContMode = _contractExc.indexOf(__NX.state.exchangeId) !== -1 && __NX.state.amtUnit !== 'USDT';
    if (isContMode) {
      v = Math.max(1, Math.round(v + dir));
      inp.value = String(v);
    } else {
      var step = __NX.state.lastPrice > 1000 ? 1 : 0.1;
      v = Math.max(0, v + dir * step);
      inp.value = v.toFixed(2);
    }
    calcCost();
  }

  // ── Contract size helper ──
  function _contractSize() {
    if (__NX.state.exchangeId === 'kucoin' && __NX.state.symbol === 'BTCUSDT') return 0.001;
    if (__NX.state.exchangeId === 'kucoin') return 0.01;
    return 1;
  }

  // ── Convert USDT → contracts ──
  function _usdtToCont(usdt) {
    var price = parseFloat(document.getElementById('fut-price').value) || __NX.state.lastPrice || 1;
    return usdt / (_contractSize() * price);
  }

  // ── Convert contracts → USDT ──
  function _contToUsdt(cont) {
    var price = parseFloat(document.getElementById('fut-price').value) || __NX.state.lastPrice || 1;
    return cont * _contractSize() * price;
  }

  // ── Toggle amount unit USDT ↔ Cont (only for contract exchanges) ──
  function toggleAmtUnit() {
    var _contractExc = ['kucoin','kraken','htx','bitmart','mexc'];
    if (_contractExc.indexOf(__NX.state.exchangeId) === -1) return; // non-contract: always USDT
    var inp = document.getElementById('fut-amount');
    var cur = parseFloat(inp ? inp.value : '') || 0;
    if (__NX.state.amtUnit === 'USDT') {
      // Switch to Cont — convert current value
      __NX.state.amtUnit = 'Cont';
      if (inp && cur > 0) inp.value = String(Math.max(1, Math.round(_usdtToCont(cur))));
    } else {
      // Switch to USDT — convert current value
      __NX.state.amtUnit = 'USDT';
      if (inp && cur > 0) inp.value = _contToUsdt(cur).toFixed(2);
    }
    _updateAmtUnit();
    calcCost();
  }

  // ── Update amount unit label based on exchange ──
  function _updateAmtUnit() {
    var el = document.getElementById('fut-amt-unit'); if (!el) return;
    var _contractExc = ['kucoin','kraken','htx','bitmart','mexc'];
    var isContract = _contractExc.indexOf(__NX.state.exchangeId) !== -1;
    // Non-contract exchanges have no Cont concept — always USDT.
    // Contract exchanges default to USDT too unless the user explicitly toggled to Cont.
    if (!isContract) __NX.state.amtUnit = 'USDT';
    if (!__NX.state.amtUnit) __NX.state.amtUnit = 'USDT';
    el.childNodes[0].textContent = __NX.state.amtUnit + ' ';
  }

  // ── Scroll-to-change for amount & price inputs ──
  function _attachScrollInputs() {
    var amtInp = document.getElementById('fut-amount');
    if (!amtInp || amtInp._scrollAttached) return;
    amtInp._scrollAttached = true;

    function _curPct() {
      var fill = document.getElementById('fut-pct-fill');
      var v = fill ? parseFloat(fill.style.width) : 0;
      return isNaN(v) ? 0 : v;
    }

    function _scrollPct(delta) {
      var pct = Math.max(0, Math.min(100, _curPct() + delta * 5));
      applyPct(pct);
    }

    // Mouse wheel (desktop/trackpad) — amount box scroll = % of Avbl balance
    amtInp.addEventListener('wheel', function(e) {
      e.preventDefault();
      _scrollPct(e.deltaY < 0 ? 1 : -1);
    }, { passive: false });

    // Touch swipe (mobile) — swipe up = increase %, swipe down = decrease %
    var _touchY = null;
    amtInp.addEventListener('touchstart', function(e) {
      _touchY = e.touches[0].clientY;
    }, { passive: true });
    amtInp.addEventListener('touchmove', function(e) {
      if (_touchY === null) return;
      var dy = _touchY - e.touches[0].clientY;
      if (Math.abs(dy) < 5) return;
      e.preventDefault();
      _scrollPct(dy > 0 ? 1 : -1);
      _touchY = e.touches[0].clientY;
    }, { passive: false });
    amtInp.addEventListener('touchend', function() { _touchY = null; }, { passive: true });
    // Price box intentionally has no scroll/swipe-to-change behavior.
  }

  function fillPrice(p) {
    var ot = document.getElementById('fut-order-type');
    if (ot && ot.value === 'market') return;
    var inp = document.getElementById('fut-price');
    if (inp) { inp.value = p.toFixed(getDecimals(__NX.state.tickSize)); calcCost(); }
  }

  function useBBO() {
    var inp = document.getElementById('fut-price');
    if (inp) { inp.value = (__NX.state.side === 'buy' ? __NX.state.bestBid : __NX.state.bestAsk).toFixed(getDecimals(__NX.state.tickSize)); calcCost(); }
  }

  function toggleCheck(which) {
    var el = document.getElementById('fut-chk-' + which); if (!el) return;
    var on = el.classList.contains('fut-chk-on');
    if (on) {
      el.classList.remove('fut-chk-on'); el.style.background = 'transparent'; el.innerHTML = '';
    } else {
      el.classList.add('fut-chk-on'); el.style.background = 'var(--accent-primary)'; el.style.borderColor = 'var(--accent-primary)';
      el.innerHTML = '<span class="material-icons-round" style="font-size:11px;color:#fff;">check</span>';
    }
    if (which === 'tpsl') {
      var rows = document.getElementById('fut-tpsl-rows');
      if (rows) rows.style.display = on ? 'none' : 'flex';
      __NX._setSplitHeight();
    }
  }

  function sliderClick(ev) {
    var track = document.getElementById('fut-pct-track'); if (!track) return;
    var rect = track.getBoundingClientRect();
    var pct = Math.max(0, Math.min(100, ((ev.clientX - rect.left) / rect.width) * 100));
    applyPct(Math.round(pct / 25) * 25);
  }

  function applyPct(pct) {
    var fill = document.getElementById('fut-pct-fill'); if (fill) fill.style.width = pct + '%';
    document.querySelectorAll('.fut-pct-dot').forEach(function(d) {
      var dp = parseInt(d.getAttribute('data-pct'), 10);
      if (dp <= pct) d.classList.add('fut-pct-on'); else d.classList.remove('fut-pct-on');
    });
    var bal = (window._excUsdtBalanceCache) ? window._excUsdtBalanceCache : 0;
    var price = parseFloat(document.getElementById('fut-price').value) || __NX.state.lastPrice || 0;
    if (price > 0 && bal > 0) {
      var marginAmt = bal * (pct / 100);            // USDT margin (collateral) — what user is putting up
      var notional  = marginAmt * __NX.state.leverage;     // leveraged position size
      var amtEl = document.getElementById('fut-amount');
      var _contractExc = ['kucoin','kraken','htx','bitmart','mexc'];
      var isContExc = _contractExc.indexOf(__NX.state.exchangeId) !== -1;
      if (amtEl) {
        if (isContExc && __NX.state.amtUnit === 'USDT') {
          // Amount field shows margin (collateral), not notional
          amtEl.value = marginAmt.toFixed(2);
        } else if (isContExc) {
          amtEl.value = String(Math.max(1, Math.round(_usdtToCont(notional))));
        } else {
          // Non-contract exchange: Amount = USDT margin (collateral)
          amtEl.value = marginAmt.toFixed(2);
        }
      }
    }
    calcCost();
  }

  function calcCost() {
    var price = parseFloat(document.getElementById('fut-price').value) || 0;
    if (__NX.state.orderType === 'market' || __NX.state.orderType === 'stop_market') price = __NX.state.lastPrice || price;
    var amt = parseFloat(document.getElementById('fut-amount').value) || 0;
    var _contractExc = ['kucoin','kraken','htx','bitmart','mexc'];
    var isContExc = _contractExc.indexOf(__NX.state.exchangeId) !== -1;
    var margin;
    var costEl = document.getElementById('fut-cost');

    if (isContExc && __NX.state.amtUnit === 'USDT') {
      // Amount field = margin (collateral). Margin row = position size (notional).
      margin = __NX.state.leverage > 0 ? amt * __NX.state.leverage : amt;
    } else if (isContExc) {
      // Amount field = contracts. Margin row = notional position size.
      var notional = amt * _contractSize() * price;
      margin = notional; // show full position size, not collateral
    } else {
      // Amount field = USDT margin (collateral). Margin row = position size (notional).
      margin = __NX.state.leverage > 0 ? amt * __NX.state.leverage : amt;
    }
    if (costEl) { costEl.textContent = __NX.fmt(margin, 2) + ' USDT'; costEl.style.color = ''; }

    // ── Est. Liq. Price ──
    // APPROXIMATE ONLY — real liquidation price depends on each exchange's
    // tiered maintenance-margin-rate table (varies by notional bracket),
    // which we don't have client-side. This uses a generic 0.5% MMR ballpark
    // (isolated-margin style, ignoring funding/fees) so it's in the right
    // neighborhood, not an exchange-verified number. Falls back to "--"
    // when price/leverage aren't known yet — same as KuCoin's own app does.
    var liqEl = document.getElementById('fut-liq-price');
    if (liqEl) {
      var _mmr = 0.005;
      if (price > 0 && __NX.state.leverage > 0 && margin > 0) {
        var liqPrice = __NX.state.side === 'sell'
          ? price * (1 + 1 / __NX.state.leverage - _mmr)
          : price * (1 - 1 / __NX.state.leverage + _mmr);
        liqEl.textContent = (liqPrice > 0 ? __NX.fmt(liqPrice, 1) : '--') + ' USDT';
      } else {
        liqEl.textContent = '-- USDT';
      }
    }
  }
})((window.__nxp = window.__nxp || {}).mod_fut_futures_engine = window.__nxp.mod_fut_futures_engine || {});
