
// ── Sync HUD layout: landscape = single row, portrait = two rows ──
function _tcfSyncFsLayout() {
  var hud = document.getElementById('tcf-fs-hud');
  var hudTfBar = document.getElementById('tcf-fshud-tf-bar');
  // Hide any legacy strip if present
  var tfStrip = document.getElementById('tcf-fs-tf-strip');
  if (tfStrip) tfStrip.style.display = 'none';
  if (!hud || !hudTfBar) return;

  var ov = document.getElementById('token-chart-full-overlay');
  var orient = ov ? (ov.getAttribute('data-fs-orient') || 'portrait') : 'portrait';
  var isLandscape = orient === 'landscape';

  if (isLandscape) {
    // ── LANDSCAPE: single row — price + tf-bar + exit btn ──
    hud.style.flexDirection = 'row';
    hud.style.alignItems = 'center';
    hud.style.padding = '4px 10px 4px 14px';
    hud.style.gap = '8px';
    // Move tf-bar back into main HUD row (remove it from wrapper if needed)
    var topRow = hud.querySelector('[data-hud-toprow]');
    if (topRow && topRow.contains(hudTfBar)) {
      hud.insertBefore(hudTfBar, topRow.nextSibling);
    }
    hudTfBar.style.flex = '0 0 auto';
    hudTfBar.style.width = 'auto';
    hudTfBar.style.display = 'flex';
    hudTfBar.style.justifyContent = 'flex-end';
    hudTfBar.style.marginLeft = 'auto';
  } else {
    // ── PORTRAIT: two rows — row1: price+exit, row2: tf-bar full width ──
    hud.style.flexDirection = 'column';
    hud.style.alignItems = 'stretch';
    hud.style.padding = '6px 10px 4px 14px';
    hud.style.gap = '4px';
    // Ensure tf-bar is last child (second row)
    if (hud.lastChild !== hudTfBar) {
      hud.appendChild(hudTfBar);
    }
    hudTfBar.style.flex = '';
    hudTfBar.style.width = '100%';
    hudTfBar.style.display = 'flex';
    hudTfBar.style.justifyContent = 'flex-end';
    hudTfBar.style.marginLeft = '';
  }
}

// ── HUD always visible in fullscreen ──
function _tcfFsHudAutoHide() {
  var hud = document.getElementById('tcf-fs-hud');
  if (!hud) return;
  // Keep HUD always visible — no auto-hide
  hud.style.opacity = '1';
  hud.style.pointerEvents = 'auto';

  // Initial layout sync
  _tcfSyncFsLayout();

  // Orientation / window resize → re-fit chart in fullscreen
  if (!window._tcfOrientationListening) {
    window._tcfOrientationListening = true;
    var _tcfOnResize = function() {
      var ov = document.getElementById('token-chart-full-overlay');
      if (!ov || ov.getAttribute('data-fs') !== '1') return;
      clearTimeout(window._tcfResizeTimer);
      window._tcfResizeTimer = setTimeout(function() {
        var ov2 = document.getElementById('token-chart-full-overlay');
        if (!ov2) return;
        var isLand = window.innerWidth > window.innerHeight;
        var prevOrient = ov2.getAttribute('data-fs-orient') || 'portrait';

        // Physical rotation detected — sync orientation state & system UI
        if (isLand && prevOrient === 'portrait') {
          // portrait → landscape via physical rotate
          _dtSwitchOrientDrawings('landscape');
          ov2.setAttribute('data-fs-orient', 'landscape');
          // Hide system UI for landscape (nav bar should hide)
          if (window.OneAndroid && window.OneAndroid.setOrientation) {
            window.OneAndroid.setOrientation('landscape');
          }
          setTimeout(_dtInitEvents, 150);
          _dtSelectTool('cursor');
          _tcfSyncFsLayout();
          _dtRender();
        } else if (!isLand && prevOrient === 'landscape') {
          // landscape → portrait via physical rotate
          _dtSwitchOrientDrawings('portrait');
          ov2.setAttribute('data-fs-orient', 'portrait');
          // Portrait fullscreen: restore nav bar
          if (window.OneAndroid && window.OneAndroid.setOrientation) {
            window.OneAndroid.setOrientation('portrait');
          }
          _dtSelectTool('cursor');
          _tcfSyncFsLayout();
          _dtRender();
        } else {
          // Same orientation resize (keyboard, etc.) — just update attribute
          ov2.setAttribute('data-fs-orient', isLand ? 'landscape' : 'portrait');
        }

        var ce = document.getElementById('tcf-lw-chart');
        if (!ce) return;
        var w = ce.clientWidth  || window.innerWidth;
        var h = ce.clientHeight || (window.innerHeight - 40);
        if (_lwChart)    _lwChart.resize(w, Math.max(h, 100));
        if (_lwVolChart) _lwVolChart.resize(w, 0);
        if (_lwChart) { const r = window._lwTargetRange; if (r) { try { _lwChart.timeScale().setVisibleLogicalRange(r); } catch(e) {} } }
        _tcfSyncFsLayout();
        var cvs = document.getElementById('tcf-draw-canvas');
        if (cvs) cvs.setAttribute('viewBox', '0 0 ' + w + ' ' + Math.max(h, 100));
      }, 200);
    };
    window.addEventListener('resize',            _tcfOnResize, { passive: true });
    window.addEventListener('orientationchange', _tcfOnResize, { passive: true });
    // screen.orientation API (newer Android)
    if (screen && screen.orientation) {
      screen.orientation.addEventListener('change', _tcfOnResize);
    }
  }
}



// ══════════════════════════════════════════════════════════════════
//  CHART DRAWING ENGINE  — lightweight-charts canvas overlay (fixed)
// ══════════════════════════════════════════════════════════════════

window._dtState = {
  activeTool : 'cursor',
  drawings   : [],     // committed drawings (active orientation)
  drawing    : null,   // in-progress drawing
  magnetMode : false,
  locked     : false,
  visible    : true,
  selectedIdx: -1,
  nextId     : 1,
};

// ── Redo stack: holds drawings removed via undo/delete, restorable via _dtRedo() ──
window._dtRedoStack = [];

// ── Separate drawing stores per orientation ──
window._dtDrawingsPortrait  = [];  // drawings made in portrait fullscreen
window._dtDrawingsLandscape = [];  // drawings made in landscape fullscreen

// Save current drawings into the store for the given orientation, then load the other
function _dtSwitchOrientDrawings(toOrient) {
  const st = window._dtState;
  // Cancel any in-progress stroke first
  st.drawing    = null;
  st.selectedIdx = -1;
  // Reset tool to cursor so portrait tool doesn't carry over to landscape and vice versa
  st.activeTool = 'cursor';
  // Redo stack is orientation-specific; clear it on switch to avoid restoring into the wrong view
  window._dtRedoStack = [];

  // Save current drawings into the orientation we're leaving
  if (toOrient === 'landscape') {
    // We were in portrait, save portrait drawings
    window._dtDrawingsPortrait = st.drawings.map(d => ({...d, points: d.points.map(p => ({...p}))}));
    // Load landscape drawings
    st.drawings = window._dtDrawingsLandscape.map(d => ({...d, points: d.points.map(p => ({...p}))}));
  } else {
    // We were in landscape, save landscape drawings
    window._dtDrawingsLandscape = st.drawings.map(d => ({...d, points: d.points.map(p => ({...p}))}));
    // Load portrait drawings
    st.drawings = window._dtDrawingsPortrait.map(d => ({...d, points: d.points.map(p => ({...p}))}));
  }
  // Persist both orientation stores to localStorage
  _dtSaveDrawings();
}

// ── colour palette ──
const _DT_COLORS = ['#6366f1','#22d3ee','#10b981','#f59e0b','#f43f5e','#a5b4fc','#ffffff'];
let _dtColorIdx = 0;
function _dtNextColor() { const c = _DT_COLORS[_dtColorIdx % _DT_COLORS.length]; _dtColorIdx++; return c; }

// ── Select tool ──
function _dtSelectTool(tool) {
  const st = window._dtState;
  // ── Toggle: same tool clicked again → back to cursor ──
  if (tool !== 'cursor' && st.activeTool === tool) {
    tool = 'cursor';
  }
  // finishing a multi-click tool (pitchfork/channel) if we switch away mid-draw
  if (st.drawing && ['pitchfork','channel'].includes(st.drawing.type) && st.drawing.points.length >= 2) {
    st.drawings.push({...st.drawing, points:[...st.drawing.points]});
  }
  st.activeTool = tool;
  st.drawing    = null;

  document.querySelectorAll('#tcf-draw-toolbar .dt-btn[data-tool]').forEach(b => {
    b.classList.toggle('active', b.dataset.tool === tool);
  });

  const canvas = document.getElementById('tcf-draw-canvas');
  if (!canvas) return;
  if (tool === 'cursor') {
    canvas.style.pointerEvents = 'none';  // cursor = pan mode only
    canvas.style.cursor = 'default';
  } else if (tool === 'zoom') {
    canvas.style.pointerEvents = 'auto';
    canvas.style.cursor = 'zoom-in';
  } else {
    canvas.style.pointerEvents = 'auto';
    canvas.style.cursor = 'crosshair';
  }
}

// ── Toggle magnet ──
function _dtToggleMagnet(btn) {
  const st = window._dtState;
  st.magnetMode = !st.magnetMode;
  btn.classList.toggle('active', st.magnetMode);
}

// ── Toggle lock ──
function _dtToggleLock(btn) {
  const st = window._dtState;
  st.locked = !st.locked;
  btn.classList.toggle('active', st.locked);
  const canvas = document.getElementById('tcf-draw-canvas');
  if (!canvas) return;
  // When locked: pointer-events none (can't draw or interact)
  // When unlocked: restore tool state
  if (st.locked) {
    canvas.style.pointerEvents = 'none';
  } else {
    _dtSelectTool(st.activeTool); // restore
  }
}

// ── Toggle visibility ──
function _dtToggleVisibility(btn) {
  const st = window._dtState;
  st.visible = !st.visible;
  btn.classList.toggle('active', !st.visible);
  const canvas = document.getElementById('tcf-draw-canvas');
  if (canvas) canvas.style.opacity = st.visible ? '1' : '0';
}

// ── Clear all ──
function _dtUndo() {
  const st = window._dtState;
  if (st.drawing) { st.drawing = null; }
  else if (st.selectedIdx >= 0 && st.selectedIdx < st.drawings.length) {
    // Delete selected drawing if one is selected
    const removed = st.drawings.splice(st.selectedIdx, 1)[0];
    if (removed) window._dtRedoStack.push(removed);
    st.selectedIdx = -1;
  } else if (st.drawings.length) {
    const removed = st.drawings.pop();
    if (removed) window._dtRedoStack.push(removed);
  } else if (window._dtZoomHistory && window._dtZoomHistory.length) {
    // Undo last zoom — restore previous time range
    const prev = window._dtZoomHistory.pop();
    try {
      if (_lwChart) _lwChart.timeScale().setVisibleLogicalRange(prev);
      if (_lwVolChart) _lwVolChart.timeScale().setVisibleLogicalRange(prev);
      window._lwTargetRange = prev;
    } catch(_) {}
  }
  _dtRender();
  _dtSyncUndoBtn();
  _dtSyncRedoBtn();
  _dtSaveDrawings();
}

// ── Redo: restore the most recently undone/deleted drawing ──
function _dtRedo() {
  const st = window._dtState;
  if (!window._dtRedoStack || !window._dtRedoStack.length) return;
  const restored = window._dtRedoStack.pop();
  st.drawings.push(restored);
  st.selectedIdx = -1;
  _dtRender();
  _dtSyncUndoBtn();
  _dtSyncRedoBtn();
  _dtSaveDrawings();
}

// Update redo button appearance based on whether anything is available to redo
function _dtSyncRedoBtn() {
  const btn = document.querySelector('#tcf-draw-toolbar .dt-btn[data-tool="redo"]');
  if (!btn) return;
  const has = window._dtRedoStack && window._dtRedoStack.length > 0;
  btn.style.opacity = has ? '1' : '0.35';
  btn.style.pointerEvents = has ? 'auto' : 'none';
}

function _dtDeleteSelected() {
  const st = window._dtState;
  if (st.selectedIdx < 0 || st.selectedIdx >= st.drawings.length) return;
  const removed = st.drawings.splice(st.selectedIdx, 1)[0];
  if (removed) window._dtRedoStack.push(removed);
  st.selectedIdx = -1;
  _dtRender();
  _dtSyncUndoBtn();
  _dtSyncRedoBtn();
  _dtSaveDrawings();
}

// Update undo button appearance based on selection state
function _dtSyncUndoBtn() {
  const st  = window._dtState;
  const btn = document.querySelector('#tcf-draw-toolbar .dt-btn[data-tool="undo"]');
  if (!btn) return;
  if (st.selectedIdx >= 0) {
    btn.setAttribute('data-tip', 'Delete Selected');
    btn.style.color = '#f43f5e';
    btn.classList.add('active');
  } else {
    btn.setAttribute('data-tip', 'Undo Last');
    btn.style.color = '';
    btn.classList.remove('active');
  }
}

function _dtClearAll() {
  const st = window._dtState;
  st.drawings    = [];
  st.drawing     = null;
  st.selectedIdx = -1;   // ✅ reset selection
  window._dtRedoStack = [];
  window._dtDrawingsPortrait  = [];
  window._dtDrawingsLandscape = [];
  _dtRender();
  _dtSyncUndoBtn();       // ✅ undo button-ও normal state-এ ফেরাও
  _dtSyncRedoBtn();
  _dtSaveDrawings();
}

// ══ DRAWING PERSISTENCE ══════════════════════════════════════════
// Save all drawings (both orientations) to localStorage keyed by coin symbol.
function _dtSaveDrawings() {
  try {
    const coin = (window._tcfActiveCoin || 'DEFAULT').toUpperCase();
    // Capture current orientation's drawings into the right store before saving
    const overlay = document.getElementById('token-chart-full-overlay');
    const orient  = overlay ? (overlay.getAttribute('data-fs-orient') || 'portrait') : 'portrait';
    const st = window._dtState;
    if (orient === 'landscape') {
      window._dtDrawingsLandscape = st.drawings.map(d => ({...d, points: d.points.map(p => ({...p}))}));
    } else {
      window._dtDrawingsPortrait  = st.drawings.map(d => ({...d, points: d.points.map(p => ({...p}))}));
    }
    const payload = {
      portrait  : window._dtDrawingsPortrait,
      landscape : window._dtDrawingsLandscape,
      v: 1
    };
    localStorage.setItem('_oneDraw_' + coin, JSON.stringify(payload));
  } catch(e) {}
}

// Load drawings from localStorage for the given coin symbol.
function _dtLoadDrawings(coin) {
  try {
    const key  = '_oneDraw_' + (coin || 'DEFAULT').toUpperCase();
    const raw  = localStorage.getItem(key);
    if (!raw) return;
    const payload = JSON.parse(raw);
    window._dtDrawingsPortrait  = (payload.portrait  || []).map(d => ({...d, points: (d.points||[]).map(p => ({...p}))}));
    window._dtDrawingsLandscape = (payload.landscape || []).map(d => ({...d, points: (d.points||[]).map(p => ({...p}))}));
    // Load portrait drawings into active state (chart opens in portrait by default)
    window._dtState.drawings = window._dtDrawingsPortrait.map(d => ({...d, points: d.points.map(p => ({...p}))}));
    window._dtState.selectedIdx = -1;
  } catch(e) {
    window._dtDrawingsPortrait  = [];
    window._dtDrawingsLandscape = [];
    window._dtState.drawings = [];
  }
}
// ═════════════════════════════════════════════════════════════════

function _dtEvtPt(e, canvas) {
  const rect = canvas.getBoundingClientRect();
  const src  = (e.touches && e.touches.length) ? e.touches[0]
               : (e.changedTouches && e.changedTouches.length) ? e.changedTouches[0]
               : e;
  return { x: src.clientX - rect.left, y: src.clientY - rect.top };
}

// ── Magnet: snap Y to nearest OHLC price level ──
function _dtMagnetSnap(pt) {
  if (!window._dtState.magnetMode || !_lwCandleSeries || !_lwChart) return pt;
  try {
    const data = window._lwLastCandles || [];
    if (!data.length) return pt;
    const ts  = _lwChart.timeScale();
    const idx = Math.round(ts.coordinateToLogical(pt.x) || 0);
    const bar = data[Math.max(0, Math.min(idx, data.length - 1))];
    if (!bar) return pt;
    // coordinateToPrice via chart price scale
    const ps   = _lwChart.priceScale('right');
    // price → coordinate conversion: use series
    const candidates = ['open','high','low','close'].map(k => {
      try {
        const coord = _lwCandleSeries.priceToCoordinate(bar[k]);
        return { y: coord, dist: Math.abs(coord - pt.y) };
      } catch(_) { return null; }
    }).filter(Boolean);
    if (!candidates.length) return pt;
    candidates.sort((a,b) => a.dist - b.dist);
    if (candidates[0].dist < 18) return { x: pt.x, y: candidates[0].y };
  } catch(_) {}
  return pt;
}

// ── FIB levels ──
const _FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const _FIB_COLORS = [
  'rgba(255,255,255,0.55)', '#a5b4fc', '#6366f1',
  '#22d3ee', '#6366f1', '#a5b4fc', 'rgba(255,255,255,0.55)'
];

// ── Fibonacci Extension levels (projected from point C, scaled by A→B move) ──
const _FIBEXT_LEVELS = [0, 0.618, 1, 1.272, 1.618, 2, 2.618];
const _FIBEXT_COLORS = [
  'rgba(255,255,255,0.5)', '#a5b4fc', '#22d3ee',
  '#10b981', '#f59e0b', '#f43f5e', '#a855f7'
];

// ── SVG helpers ──
function _svgEl(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k,v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}
function _svgLine(canvas, x1,y1, x2,y2, color, dash='', width=1.5) {
  const l = _svgEl('line', {x1,y1,x2,y2, stroke:color, 'stroke-width':width, 'stroke-linecap':'round'});
  if (dash) l.setAttribute('stroke-dasharray', dash);
  canvas.appendChild(l); return l;
}
function _svgCircle(canvas, cx,cy,r, color) {
  const c = _svgEl('circle', {cx,cy,r, fill:color, stroke:'none'});
  canvas.appendChild(c); return c;
}
function _svgText(canvas, x, y, txt, color='rgba(255,255,255,0.75)', fontSize=11) {
  const t = _svgEl('text', {x, y, fill:color, 'font-size':fontSize,
    'font-family':'monospace', 'font-weight':'600', 'dominant-baseline':'middle'});
  t.textContent = txt;
  canvas.appendChild(t); return t;
}
function _svgRect(canvas, x1,y1, x2,y2, color, fill='transparent') {
  const rx = Math.min(x1,x2), ry = Math.min(y1,y2);
  const rw = Math.abs(x2-x1), rh = Math.abs(y2-y1);
  const r = _svgEl('rect', {x:rx, y:ry, width:rw, height:rh,
    stroke:color, 'stroke-width':1.5, fill, rx:1});
  canvas.appendChild(r); return r;
}
// Small price/label tag used by the Long/Short Position tool (TP / SL / Entry)
function _dtPosLabel(canvas, x, y, color, text) {
  const bw = text.length*5.6+10;
  const bg = _svgEl('rect',{x:x+2,y:y-8,width:bw,height:14,rx:3,
    fill:'rgba(10,10,22,0.9)',stroke:color,'stroke-width':1});
  canvas.appendChild(bg);
  _svgText(canvas, x+6, y-1, text, color, 9);
}

// ── Render all drawings ──
function _dtRender() {
  const canvas = document.getElementById('tcf-draw-canvas');
  if (!canvas) return;
  while (canvas.firstChild) canvas.removeChild(canvas.firstChild);
  const st = window._dtState;
  const all = [...st.drawings];
  if (st.drawing) all.push(st.drawing);
  all.forEach((d, i) => {
    const isSel = i === st.selectedIdx && !st.drawing;
    _dtRenderOne(canvas, d, isSel);
    if (isSel) _dtRenderDeleteHandle(canvas, d);
  });
  // If something is selected, ensure canvas accepts pointer events so × is tappable
  if (st.selectedIdx >= 0 && !st.drawing) {
    canvas.style.pointerEvents = 'auto';
  } else if (st.activeTool === 'cursor') {
    canvas.style.pointerEvents = 'none';
  }
}

// Draw × handle at the "end" point of selected drawing
function _dtRenderDeleteHandle(canvas, d) {
  if (!d || !d.points || !d.points.length) return;
  const p = d.points;
  // Pick a good anchor point: last point, or midpoint for hline/vline
  let hx, hy;
  if (d.type === 'hline') { hx = 40; hy = p[0].y; }
  else if (d.type === 'vline') { hx = p[0].x; hy = 20; }
  else if (p.length >= 2) { hx = p[p.length-1].x; hy = p[p.length-1].y; }
  else { hx = p[0].x; hy = p[0].y; }

  const R = 10;
  // Circle background
  const circle = _svgEl('circle', {cx:hx, cy:hy, r:R,
    fill:'rgba(244,63,94,0.9)', stroke:'rgba(255,255,255,0.3)', 'stroke-width':'1'});
  canvas.appendChild(circle);
  // × cross
  const X = 5.5;
  const l1 = _svgEl('line',{x1:hx-X,y1:hy-X,x2:hx+X,y2:hy+X,
    stroke:'#fff','stroke-width':'1.8','stroke-linecap':'round'});
  const l2 = _svgEl('line',{x1:hx+X,y1:hy-X,x2:hx-X,y2:hy+X,
    stroke:'#fff','stroke-width':'1.8','stroke-linecap':'round'});
  canvas.appendChild(l1); canvas.appendChild(l2);

  // Invisible larger tap target on the × button
  const tap = _svgEl('circle', {cx:hx, cy:hy, r:R+6,
    fill:'transparent', stroke:'none', style:'cursor:pointer;pointer-events:all;'});
  tap.addEventListener('click',  e => { e.stopPropagation(); _dtDeleteSelected(); });
  tap.addEventListener('touchend', e => { e.stopPropagation(); e.preventDefault(); _dtDeleteSelected(); });
  canvas.appendChild(tap);
}
