

// ════════════════════════════════════════════════════════
// ── LIGHTWEIGHT-CHARTS ENGINE (Binance-style pro chart) ──
// ════════════════════════════════════════════════════════

// TF → Binance interval + candle count
// Supports: 1m 5m 15m 24H 7D 1M 1Y ALL (plus legacy 1h 4h 1d aliases)
const _TF_MAP = {
  '1s':  { interval:'1s',  limit:1000, view:120 },
  '15s': { interval:'1s',  limit:900,  view:120 },
  '30s': { interval:'1s',  limit:600,  view:100 },
  '1m':  { interval:'1m',  limit:1000, view:80  },
  '5m':  { interval:'5m',  limit:1000, view:80  },
  '15m': { interval:'15m', limit:1000, view:60  },
  '24H': { interval:'1h',  limit:1000, view:80  },
  '7D':  { interval:'4h',  limit:1000, view:80  },
  '1M':  { interval:'1d',  limit:1000, view:80  },
  '1Y':  { interval:'1d',  limit:1000, view:90  },
  'ALL': { interval:'1w',  limit:1000, view:100 },
  '1h':  { interval:'1h',  limit:1000, view:80  },
  '4h':  { interval:'4h',  limit:1000, view:60  },
  '1d':  { interval:'1d',  limit:1000, view:90  },
};

// Candle cache: key = "SYM_TF"
const _lwCache = {};

// Active WebSocket ref
let _lwWs = null;
let _lwWsRetry = 0;
let _lwWsTimer = null;

// Lightweight-charts instance refs
let _lwChart     = null;
let _lwCandleSeries = null;
let _lwVolSeries = null;
let _lwMa7  = null, _lwMa25 = null, _lwMa99 = null;

function _tcfInitLWCharts() {
  const chartEl  = document.getElementById('tcf-lw-chart');
  const volEl    = document.getElementById('tcf-lw-volume');
  if (!chartEl || !volEl || typeof LightweightCharts === 'undefined') return;

  // Guard: destroy any existing instances before creating new ones (prevents duplicate canvas)
  try { if (_lwChart)    { _lwChart.remove();    _lwChart    = null; } } catch(e) {}
  try { if (_lwVolChart) { _lwVolChart.remove(); _lwVolChart = null; } } catch(e) {}
  _lwCandleSeries = null; _lwVolSeries = null;
  _lwMa7 = null; _lwMa25 = null; _lwMa99 = null;

  const bg = '#07070e';
  const grid = 'rgba(255,255,255,0.05)';

  // Main candlestick chart
  _lwChart = LightweightCharts.createChart(chartEl, {
    width:  chartEl.clientWidth  || 390,
    height: 240,
    layout: { background: { color: bg }, textColor: 'rgba(255,255,255,0.4)' },
    grid:   { vertLines: { color: grid }, horzLines: { color: grid } },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)', textColor: 'rgba(255,255,255,0.35)' },
    timeScale: {
      borderColor: 'rgba(255,255,255,0.06)',
      timeVisible: true,
      secondsVisible: false,
      lockVisibleTimeRangeOnResize: false,
      rightOffset: 5,
    },
    handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
    handleScale: { axisPressedMouseMove: { time: true, price: true }, mouseWheel: true, pinch: true },
  });

  _lwCandleSeries = _lwChart.addCandlestickSeries({
    upColor:          '#10b981',
    downColor:        '#f43f5e',
    borderUpColor:    '#10b981',
    borderDownColor:  '#f43f5e',
    wickUpColor:      '#10b981',
    wickDownColor:    '#f43f5e',
    autoscaleInfoProvider: (original) => {
      const res = original();
      if (!res) return null;
      // Add small padding so candles aren't at very edge
      const range = res.priceRange;
      if (!range) return res;
      const pad = (range.maxValue - range.minValue) * 0.05;
      return { priceRange: { minValue: range.minValue - pad, maxValue: range.maxValue + pad } };
    },
  });

  // MA line series — priceScaleId matches candle so they share scale but don't auto-stretch it
  const _maOpts = { priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, priceScaleId: 'right',
    autoscaleInfoProvider: () => null };
  _lwMa7  = _lwChart.addLineSeries({ ..._maOpts, color: 'rgba(234,179,8,0.85)',  lineWidth: 1 });
  _lwMa25 = _lwChart.addLineSeries({ ..._maOpts, color: 'rgba(236,72,153,0.85)', lineWidth: 1 });
  _lwMa99 = _lwChart.addLineSeries({ ..._maOpts, color: 'rgba(139,92,246,0.85)', lineWidth: 1 });

  // Volume sub-chart
  _lwVolChart = LightweightCharts.createChart(volEl, {
    width:  volEl.clientWidth || 390,
    height: 52,
    layout: { background: { color: bg }, textColor: 'rgba(255,255,255,0.2)' },
    grid:   { vertLines: { color: 'transparent' }, horzLines: { color: 'transparent' } },
    rightPriceScale: { visible: false, borderColor: 'transparent', scaleMargins: { top: 0.05, bottom: 0 } },
    timeScale: { visible: false },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    handleScroll: false, handleScale: false,
  });

  _lwVolSeries = _lwVolChart.addHistogramSeries({
    priceFormat: { type: 'volume' },
    priceScaleId: '',
  });

  // Sync volume chart time scale with main chart
  _lwChart.timeScale().subscribeVisibleLogicalRangeChange(range => {
    if (_lwVolChart && range) _lwVolChart.timeScale().setVisibleLogicalRange(range);
    // Update _lwTargetRange when user pans/zooms so guard interval respects user's view
    if (range && !window._lwRangeGuard) {
      window._lwTargetRange = { from: range.from, to: range.to };
    }
  });

  // Crosshair subscription for OHLC bar
  _lwChart.subscribeCrosshairMove(param => {
    const bar = document.getElementById('tcf-ohlc-bar');
    if (!bar) return;
    if (!param || !param.time || !param.seriesData) { bar.style.display = 'none'; return; }
    const d = param.seriesData.get(_lwCandleSeries);
    if (!d) { bar.style.display = 'none'; return; }
    const fmt = v => v == null ? '—' : (v >= 1 ? '$'+v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : '$'+v.toPrecision(5));
    const tf = window._tcfTf || '1h';
    let timeStr;
    try {
      const ts = typeof param.time === 'object' ? new Date(param.time.year,param.time.month-1,param.time.day) : new Date(param.time * 1000);
      timeStr = tf === '1d' ? ts.toLocaleDateString('en-US',{month:'short',day:'numeric'}) : ts.toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
    } catch(e) { timeStr = ''; }
    document.getElementById('tcf-ohlc-time').textContent = timeStr;
    document.getElementById('tcf-ohlc-o').textContent = fmt(d.open);
    document.getElementById('tcf-ohlc-h').textContent = fmt(d.high);
    document.getElementById('tcf-ohlc-l').textContent = fmt(d.low);
    document.getElementById('tcf-ohlc-c').textContent = fmt(d.close);
    // MA values in crosshair
    const fmtMA = v => v == null ? null : (v >= 1 ? v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : v.toPrecision(5));
    const ma7v  = _lwMa7  && param.seriesData.get(_lwMa7);
    const ma25v = _lwMa25 && param.seriesData.get(_lwMa25);
    const ma99v = _lwMa99 && param.seriesData.get(_lwMa99);
    let maEl = document.getElementById('tcf-ohlc-ma');
    if (!maEl) {
      maEl = document.createElement('div');
      maEl.id = 'tcf-ohlc-ma';
      maEl.style.cssText = 'display:flex;gap:6px;align-items:center;margin-left:4px;';
      bar.querySelector('.tc-ohlc-inner').appendChild(maEl);
    }
    maEl.innerHTML = (ma7v  ? '<span style="color:rgba(234,179,8,0.9);font-size:8px;font-weight:700;">MA7: ' +fmtMA(ma7v.value) +'</span>' : '') +
                     (ma25v ? '<span style="color:rgba(236,72,153,0.9);font-size:8px;font-weight:700;">MA25: '+fmtMA(ma25v.value)+'</span>' : '') +
                     (ma99v ? '<span style="color:rgba(139,92,246,0.9);font-size:8px;font-weight:700;">MA99: '+fmtMA(ma99v.value)+'</span>' : '');
    bar.style.display = 'block';
  });

  // Resize observer — fullscreen-aware, restores target range after resize
  // Debounced to avoid flicker during fullscreen enter/exit transitions
  if (window.ResizeObserver) {
    let _roTimer = null;
    new ResizeObserver(() => {
      clearTimeout(_roTimer);
      _roTimer = setTimeout(() => {
        // Skip if fullscreen transition is in progress (chart hidden during resize)
        if (window._tcfFsTransitioning) return;
        const overlay = document.getElementById('token-chart-full-overlay');
        const isFs = overlay && overlay.getAttribute('data-fs') === '1';
        const fsOrient = overlay ? (overlay.getAttribute('data-fs-orient') || 'portrait') : 'portrait';
        const w = chartEl.clientWidth || window.innerWidth || 390;
        let h;
        if (!isFs) {
          h = 240;
        } else if (fsOrient === 'landscape') {
          h = window.innerHeight || screen.height || 600;
        } else {
          // portrait fullscreen: use parent wrap height or viewport
          h = chartEl.parentElement?.clientHeight || window.innerHeight || 700;
          h = Math.max(h, window.innerHeight * 0.75 || 500);
        }
        if (w > 0 && _lwChart)    _lwChart.resize(w, h);
        if (w > 0 && _lwVolChart) _lwVolChart.resize(w, isFs ? 0 : 52);
        // After resize, recalculate range based on new chart width
        if (_lwChart && window._lwLastCandles && window._lwLastCandles.length > 0) {
          const pxW = chartEl.clientWidth || window.innerWidth || 390;
          const pxPerC = 8;
          const dynView = Math.max(40, Math.min(Math.floor((pxW - 60) / pxPerC), window._lwLastCandles.length));
          const tot = window._lwLastCandles.length;
          const newRange = { from: Math.max(0, tot - dynView) - 0.5, to: tot - 0.5 };
          window._lwTargetRange = newRange;
          try { _lwChart.timeScale().setVisibleLogicalRange(newRange); } catch(e) {}
          try { if (_lwVolChart) _lwVolChart.timeScale().setVisibleLogicalRange(newRange); } catch(e) {}
        }
      }, 80);
    }).observe(chartEl);
  }

  // ── Price scale touch drag (right side up/down to zoom price axis) ──
  (function() {
    const PRICE_SCALE_WIDTH = 65;
    let _psTouch = null;
    // Per-mode margins: each mode has its own independent zoom level
    window._psMarginsPerMode = window._psMarginsPerMode || {
      normal:    { top: 0.1, bottom: 0.1 },
      portrait:  { top: 0.1, bottom: 0.1 },
      landscape: { top: 0.1, bottom: 0.1 }
    };

    function _lwGetCurrentMode() {
      const ov = document.getElementById('token-chart-full-overlay');
      if (!ov || ov.getAttribute('data-fs') !== '1') return 'normal';
      return (ov.getAttribute('data-fs-orient') || 'portrait') === 'landscape' ? 'landscape' : 'portrait';
    }

    // Exposed helper — call this after mode switch to restore saved margins
    window._lwRestorePsMarginsForMode = function() {
      if (!_lwChart) return;
      const m = _lwGetCurrentMode();
      const mg = window._psMarginsPerMode[m];
      try {
        _lwChart.priceScale('right').applyOptions({
          scaleMargins: { top: mg.top, bottom: mg.bottom }
        });
      } catch(e) {}
    };

    chartEl.addEventListener('touchstart', function(e) {
      const t = e.touches[0];
      const rect = chartEl.getBoundingClientRect();
      const fromRight = rect.right - t.clientX;
      if (fromRight > PRICE_SCALE_WIDTH) return;
      _psTouch = { y: t.clientY };
      // Read current chart margins once at touch start into per-mode store
      try {
        const ps = _lwChart.priceScale('right');
        const opts = ps.options ? ps.options() : {};
        if (opts.scaleMargins) {
          const m = _lwGetCurrentMode();
          window._psMarginsPerMode[m] = { top: opts.scaleMargins.top, bottom: opts.scaleMargins.bottom };
        }
      } catch(e) {}
      e.stopPropagation();
    }, { passive: true, capture: true });

    chartEl.addEventListener('touchmove', function(e) {
      if (!_psTouch || !_lwChart) return;
      const t = e.touches[0];
      const rect = chartEl.getBoundingClientRect();
      if ((rect.right - t.clientX) > PRICE_SCALE_WIDTH + 20) { _psTouch = null; return; }
      const dy = _psTouch.y - t.clientY;
      _psTouch.y = t.clientY;
      if (Math.abs(dy) < 0.5) { e.preventDefault(); return; }
      // Accumulate into the current mode's margins only
      const m = _lwGetCurrentMode();
      const mg = window._psMarginsPerMode[m];
      const delta = dy * 0.00075;
      mg.top    = Math.max(0.01, Math.min(0.95, mg.top    - delta));
      mg.bottom = Math.max(0.01, Math.min(0.95, mg.bottom - delta));
      try {
        _lwChart.priceScale('right').applyOptions({
          scaleMargins: { top: mg.top, bottom: mg.bottom }
        });
      } catch(_e) {}
      e.preventDefault();
      e.stopPropagation();
    }, { passive: false, capture: true });

    chartEl.addEventListener('touchend', function() {
      _psTouch = null;
    }, { passive: true, capture: true });
  })();
}

