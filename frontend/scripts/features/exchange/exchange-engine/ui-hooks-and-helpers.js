

// ── FUT split height: dynamic on resize ──
(function() {
  function adjustSplit() {
    if (typeof FUT !== 'undefined' && FUT._setSplitHeight) {
      FUT._setSplitHeight();
    } else {
      var split   = document.getElementById('fut-main-split');
      var futPanel= document.getElementById('exc-panel-future');
      if (!split || !futPanel) return;
      var panelH   = futPanel.offsetHeight || window.innerHeight;
      var base     = panelH <= 680 ? 52 : panelH <= 800 ? 55 : panelH <= 900 ? 58 : 61;
      var tpslRows = document.getElementById('fut-tpsl-rows');
      var tpslOn   = tpslRows && tpslRows.style.display !== 'none';
      var pct      = Math.min(base + (tpslOn ? 10 : 0), 78);
      split.style.flexBasis = pct + '%';
    }
  }
  if (typeof ResizeObserver !== 'undefined') {
    var ro = new ResizeObserver(function() { requestAnimationFrame(adjustSplit); });
    function hookObserver() {
      // Watch form column: fires when TP/SL rows expand/collapse
      var formCol  = document.getElementById('fut-form-col');
      var futPanel = document.getElementById('exc-panel-future');
      if (formCol)  ro.observe(formCol);
      if (futPanel) ro.observe(futPanel); // also watch panel for screen resize
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', hookObserver);
    } else { hookObserver(); }
  }
  window.addEventListener('resize', adjustSplit);
})();

// ── Portfolio account sub-tab switcher ──
function excPortSwitchTab(tab) {
  if (window.EXC && typeof EXC.switchPortTab === 'function') EXC.switchPortTab(tab);
}
function excOpenSelector()      { EXC.openSelector(); }
function excCloseSelector()     { EXC.closeSelector(); }
function excOpenApiSetup()      { EXC.openApiSetup(); }
function excCloseApiSetup()     { EXC.closeApiSetup(); }
function excToggleSecretVis()   { EXC.toggleSecretVis(); }
function excTestApiKey()        { EXC.testApiKey(); }
function excSaveApiKey()        { EXC.saveApiKey(); }
function excSetOrderType(t)     { EXC.setOrderType(t); }
function excSetPct(p)           { EXC.setPct(p); }
function excCalcTotal()         { EXC.calcTotal(); }
function excPlaceOrder(s)       { EXC.placeOrder(s); }
function excCloseOrderConfirm() { EXC.closeOrderConfirm(); }
function excOpenPairPicker()    { EXC.openPairPicker(); }
function excClosePairPicker()   { EXC.closePairPicker(); }

// ── Swipe-down-to-close for bottom sheets ──
(function() {
  var _swipeConfigs = [
    { panelId: 'exc-selector-panel', closeFn: function() { if(window.EXC) EXC.closeSelector(); } },
    { panelId: 'exc-pair-panel',     closeFn: function() { if(window.EXC) EXC.closePairPicker(); } },
  ];

  var _active = null; // { panel, sheet, startY, closeFn }

  document.addEventListener('touchstart', function(e) {
    var t = e.touches[0];
    for (var i = 0; i < _swipeConfigs.length; i++) {
      var cfg = _swipeConfigs[i];
      var panel = document.getElementById(cfg.panelId);
      if (!panel || panel.parentElement.style.display === 'none') continue;
      if (!panel.contains(e.target)) continue;
      // Don't hijack if user is scrolling an inner list that has content above
      var scrollEl = panel.querySelector('#exc-pair-list, #exc-selector-list');
      if (scrollEl && scrollEl.scrollTop > 2) continue;
      _active = { panel: panel, sheet: panel.parentElement, startY: t.clientY, lastY: t.clientY, closeFn: cfg.closeFn };
      panel.style.transition = 'none';
      break;
    }
  }, {passive: true});

  document.addEventListener('touchmove', function(e) {
    if (!_active) return;
    var dy = e.touches[0].clientY - _active.startY;
    _active.lastY = e.touches[0].clientY;
    if (dy <= 0) { _active.panel.style.transform = ''; return; }
    _active.panel.style.transform = 'translateY(' + dy + 'px)';
    var opacity = Math.max(0.05, 0.6 * (1 - dy / 250));
    _active.sheet.style.background = 'rgba(0,0,0,' + opacity + ')';
  }, {passive: true});

  document.addEventListener('touchend', function(e) {
    if (!_active) return;
    var dy = _active.lastY - _active.startY;
    var panel = _active.panel;
    var sheet = _active.sheet;
    var closeFn = _active.closeFn;
    _active = null;

    if (dy >= 80) {
      panel.style.transition = 'transform 0.28s ease';
      panel.style.transform = 'translateY(110%)';
      setTimeout(function() {
        panel.style.transition = '';
        panel.style.transform = '';
        sheet.style.background = '';
        closeFn();
      }, 280);
    } else {
      panel.style.transition = 'transform 0.22s ease';
      panel.style.transform = '';
      sheet.style.background = '';
      setTimeout(function() { panel.style.transition = ''; }, 220);
    }
  }, {passive: true});
})();
function excFilterPairPicker()  { EXC.filterPairPicker(); }
function excFilterMarkets()     { EXC.filterMarkets(); }
function excSetQuote(q)         { EXC.setQuote(q); }
function excSortMarkets(c)      { EXC.sortMarkets(c); }
function excLoadOrders(m)       { EXC.loadOrders(m); }
function excSwitchOrdersCat(c)  { EXC.switchOrdersCat(c); }
function excSetSide(s)          { EXC.setSide(s); }
function excSnapAmount()        { EXC.snapAmount(); }
function excSliderChange(v)     { EXC.sliderChange(v); }
function excStepPrice(d)        { EXC.stepPrice(d); }
function excStepAmount(d)       { EXC.stepAmount(d); }
// Convert bridge
function excConvSetMode(m)      { EXC.convSetMode(m); }
function excConvOnInput()       { EXC.convOnInput(); }
function excConvSwap()          { EXC.convSwap(); }
function excConvSetMax()        { EXC.convSetMax(); }
function excConvOpenPicker(s)   { EXC.convOpenPicker(s); }
function excConvClosePicker()   { EXC.convClosePicker(); }
function excConvFilterPicker()  { EXC.convFilterPicker(); }
function excConvSelectToken(s)  { EXC.convSelectToken(s); }
function excConvPreview()       { EXC.convPreview(); }
function excConvClosePreview()  { EXC.convClosePreview(); }
function excConvConfirm()       { EXC.convConfirm(); }

function excToggleTpSl() {
  var check  = document.getElementById('exc-tpsl-check');
  var rows   = document.getElementById('exc-tpsl-rows');
  if (!check || !rows) return;
  var on = check.getAttribute('data-on') === '1';
  on = !on;
  check.setAttribute('data-on', on ? '1' : '0');
  check.style.background  = on ? '#0ecb81' : 'transparent';
  check.style.borderColor = on ? '#0ecb81' : 'rgba(255,255,255,0.25)';
  check.innerHTML = on ? '<span class="material-icons-round" style="font-size:9px;color:#fff;">check</span>' : '';
  rows.style.display = on ? 'block' : 'none';
  excUpdateSplitSize();
}

// Shared: recompute top/bottom split sizing based on whatever extra rows
// are currently visible in the order form (Limit price row, TP/SL rows, ...)
// so the split dynamically grows/shrinks no matter which control toggled it.
function excUpdateSplitSize() {
  var top    = document.getElementById('exc-split-top');
  var bottom = document.getElementById('exc-split-bottom');
  if (!top || !bottom) return;
  var limRow    = document.getElementById('exc-limit-row');
  var tpslCheck = document.getElementById('exc-tpsl-check');
  var isLimit = !limRow || limRow.style.display !== 'none';
  var tpslOn  = tpslCheck && tpslCheck.getAttribute('data-on') === '1';
  var extra = (isLimit ? 7 : 0) + (tpslOn ? 14 : 0);
  var topPct = Math.min(50 + extra, 78);
  top.style.flexBasis    = topPct + '%';
  bottom.style.flexBasis = (100 - topPct) + '%';
}

function excToggleIceberg() {
  var check = document.getElementById('exc-iceberg-check');
  if (!check) return;
  var on = check.getAttribute('data-on') === '1';
  on = !on;
  check.setAttribute('data-on', on ? '1' : '0');
  check.style.background  = on ? '#f0b90b' : 'transparent';
  check.style.borderColor = on ? '#f0b90b' : 'rgba(255,255,255,0.25)';
  check.innerHTML = on ? '<span class="material-icons-round" style="font-size:9px;color:#fff;">check</span>' : '';
}

function excSetDepth(val) {
  window._excDepthTick = parseFloat(val) || 0.01;
  if (EXC && EXC.renderOrderBook) EXC.renderOrderBook();
}

function excToggleObView() {
  var btn = document.getElementById('exc-ob-view-btn');
  var icon = btn ? btn.querySelector('.material-icons-round') : null;
  if (!icon) return;
  var isChart = icon.textContent === 'candlestick_chart';
  icon.textContent = isChart ? 'format_list_bulleted' : 'candlestick_chart';
  // Future: switch between order book and mini trade history view
}

function excOpenDeposit(sym) {
  var info = excDepositCoinInfo(sym);
  window.excDepositOpen(info);
}

// ── Resolve coin info for deposit modal ──
function excDepositCoinInfo(sym) {
  if (!sym) {
    try {
      var st = window.EXC && EXC.getState ? EXC.getState() : null;
      if (st) sym = st.activeQuote || 'USDT';
    } catch(e) {}
  }
  var _coinMap = {
    'USDT': { sym:'USDT', name:'Tether USD',  icon:'₮', iconColor:'#26a17b' },
    'USDC': { sym:'USDC', name:'USD Coin',    icon:'$', iconColor:'#2775ca' },
    'BNB':  { sym:'BNB',  name:'BNB',         icon:'⬡', iconColor:'#f3ba2f' },
    'ETH':  { sym:'ETH',  name:'Ethereum',    icon:'Ξ', iconColor:'#627eea' },
    'BTC':  { sym:'BTC',  name:'Bitcoin',     icon:'₿', iconColor:'#f7931a' },
    'SOL':  { sym:'SOL',  name:'Solana',      icon:'◎', iconColor:'#9945ff' },
    'XRP':  { sym:'XRP',  name:'Ripple',      icon:'✕', iconColor:'#346aa9' },
    'DOGE': { sym:'DOGE', name:'Dogecoin',    icon:'Ð', iconColor:'#c2a633' },
    'TRX':  { sym:'TRX',  name:'TRON',        icon:'⚡', iconColor:'#e8463a' },
    'ADA':  { sym:'ADA',  name:'Cardano',     icon:'₳', iconColor:'#0033ad' },
  };
  return _coinMap[sym] || _coinMap['USDT'];
}

// Fill price from order book tap — only when Limit is already the selected
// order type. While in Market mode, tapping the order book does nothing
// (it must not force a switch to Limit).
function excFillPrice(price) {
  if (EXC) {
    var limRow = document.getElementById('exc-limit-row');
    var isLimitMode = limRow && limRow.style.display !== 'none';
    if (!isLimitMode) return;
    var inp = document.getElementById('exc-limit-price');
    if (inp) { inp.value = price.toFixed(price > 1000 ? 2 : price > 10 ? 4 : 6); }
    EXC.calcTotal();
  }
}


