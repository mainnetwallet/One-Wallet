
// ── Keyboard shortcut: Ctrl+Z = undo, Ctrl+Shift+Z / Ctrl+Y = redo ──
if (!window._dtKeyInited) {
  window._dtKeyInited = true;
  document.addEventListener('keydown', e => {
    const overlay = document.getElementById('token-chart-full-overlay');
    if (!overlay || overlay.getAttribute('data-fs') !== '1') return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) _dtRedo(); else _dtUndo();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); _dtRedo(); }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      _dtDeleteSelected();
    }
    if (e.key === 'Escape') { window._dtState.selectedIdx = -1; _dtRender(); _dtSyncUndoBtn(); }
  });
}

function _dtInitEvents() {
  const canvas = document.getElementById('tcf-draw-canvas');
  if (!canvas || canvas._dtInited) return;
  canvas._dtInited = true;

  let isDown = false;

  // ── Multi-click tools state (pitchfork, channel, long/short position, fib extension) ──
  // These tools collect points across multiple taps, not a single drag
  const MULTI_CLICK_TOOLS = { pitchfork: 3, channel: 3, triangle: 3, abcd: 4, long: 3, short: 3, fibext: 3 };

  function _commit(d) {
    window._dtState.drawings.push({...d, points:[...d.points]});
    window._dtState.drawing = null;
    // A new committed drawing invalidates the redo history
    window._dtRedoStack = [];
    _dtSyncRedoBtn();
    _dtSaveDrawings();
  }

  function onStart(e) {
    e.stopPropagation();
    const st = window._dtState;
    const pt = _dtEvtPt(e, canvas);

    // ── Long-press (500ms): 1st = select, 2nd = delete ──
    if (window._dtLongPressTimer) clearTimeout(window._dtLongPressTimer);
    window._dtLongPress = { pt, fired: false };
    window._dtLongPressTimer = setTimeout(() => {
      if (!window._dtLongPress) return;
      window._dtLongPress.fired = true;
      // Cancel any in-progress drawing
      if (st.drawing) { st.drawing = null; isDown = false; }
      const hit = _dtHitTest(window._dtLongPress.pt);
      if (hit >= 0 && hit === st.selectedIdx) {
        // Already selected → delete
        const removed = st.drawings.splice(hit, 1)[0];
        if (removed) window._dtRedoStack.push(removed);
        st.selectedIdx = -1;
      } else if (hit >= 0) {
        // Not selected → select first
        st.selectedIdx = hit;
      } else if (st.selectedIdx >= 0) {
        // Long-press on empty space → deselect
        st.selectedIdx = -1;
      }
      _dtRender();
      _dtSyncUndoBtn();
      _dtSyncRedoBtn();
      window._dtLongPressTimer = null;
    }, 500);

    // ── Cursor mode: chart panning only, no drawing ──
    if (st.activeTool === 'cursor') return;
    if (st.locked) return;

    const magPt = _dtMagnetSnap(pt);

    // ── Multi-click tools ──
    if (MULTI_CLICK_TOOLS[st.activeTool] !== undefined) {
      const needed = MULTI_CLICK_TOOLS[st.activeTool];
      if (!st.drawing) {
        // Only start new drawing if nothing is selected; if selected, deselect first
        if (st.selectedIdx >= 0) { st.selectedIdx = -1; _dtSyncUndoBtn(); _dtRender(); return; }
        st.drawing = { type: st.activeTool, points: [magPt], color: _dtNextColor() };
      } else {
        st.drawing.points.push(magPt);
        if (st.drawing.points.length >= needed) _commit(st.drawing);
      }
      _dtRender();
      return;
    }

    // ── Text tool ──
    if (st.activeTool === 'text') {
      if (st.selectedIdx >= 0) { st.selectedIdx = -1; _dtSyncUndoBtn(); _dtRender(); return; }
      _dtPlaceTextInput(magPt, _dtNextColor());
      return;
    }

    // ── Drag tools: if something is selected, a plain tap deselects it ──
    if (st.selectedIdx >= 0) {
      const hit = _dtHitTest(pt);
      if (hit < 0) {
        // Tapped empty space → deselect, do NOT start drawing
        st.selectedIdx = -1;
        _dtSyncUndoBtn();
        _dtRender();
        return;
      }
      // Tapped same selected drawing → keep selected, no new drawing
      if (hit === st.selectedIdx) return;
    }

    // ── Start new drag drawing ──
    e.preventDefault();
    isDown = true;
    st.selectedIdx = -1;
    _dtSyncUndoBtn();
    st.drawing = { type: st.activeTool, points: [magPt], color: _dtNextColor() };
    _dtRender();
  }

  function onMove(e) {
    // Cancel long-press if finger moved significantly
    if (window._dtLongPress && !window._dtLongPress.fired) {
      const cur = _dtEvtPt(e, canvas);
      if (Math.abs(cur.x - window._dtLongPress.pt.x) > 8 ||
          Math.abs(cur.y - window._dtLongPress.pt.y) > 8) {
        clearTimeout(window._dtLongPressTimer);
        window._dtLongPressTimer = null;
        window._dtLongPress = null;
      }
    }
    if (!isDown) return;
    const st = window._dtState;
    if (!st.drawing) return;
    e.preventDefault(); e.stopPropagation();
    const pt = _dtMagnetSnap(_dtEvtPt(e, canvas));

    if (st.activeTool === 'brush') {
      st.drawing.points.push(pt);
    } else {
      if (st.drawing.points.length < 2) st.drawing.points.push(pt);
      else st.drawing.points[1] = pt;
    }
    _dtRender();
  }

  function onEnd(e) {
    // Always cancel long-press timer on release
    if (window._dtLongPressTimer) {
      clearTimeout(window._dtLongPressTimer);
      window._dtLongPressTimer = null;
    }
    const longFired = window._dtLongPress && window._dtLongPress.fired;
    window._dtLongPress = null;

    const st = window._dtState;

    // Quick tap (no long press, no drag) on empty space → deselect
    if (!longFired && !isDown && st.selectedIdx >= 0) {
      const hit = _dtHitTest(_dtEvtPt(e, canvas));
      if (hit < 0) {
        st.selectedIdx = -1;
        _dtRender();
        _dtSyncUndoBtn();
      }
    }

    if (!isDown) return;
    isDown = false;
    e.stopPropagation();
    if (!st.drawing) return;

    if (st.activeTool === 'zoom') {
      if (st.drawing.points.length >= 2) _dtApplyZoom(st.drawing.points);
      st.drawing = null; _dtRender(); return;
    }

    if (st.drawing.points.length >= 2 ||
        ['hline','hray','vline','pricelabel'].includes(st.activeTool)) {
      _commit(st.drawing);
    } else {
      st.drawing = null;
    }
    _dtRender();
  }

  // Mouse events
  canvas.addEventListener('mousedown', onStart, { passive: false });
  canvas.addEventListener('mousemove', onMove,  { passive: false });
  canvas.addEventListener('mouseup',   onEnd,   { passive: false });
  // Touch events
  canvas.addEventListener('touchstart', onStart, { passive: false });
  canvas.addEventListener('touchmove',  onMove,  { passive: false });
  canvas.addEventListener('touchend',   onEnd,   { passive: false });

  // ── Cursor-mode long-press: attach to chart wrapper so canvas pointer-events:none doesn't block it ──
  const wrap = document.getElementById('tcf-lw-wrap');
  if (wrap) {
    let _cwLpTimer = null, _cwLpPt = null;
    wrap.addEventListener('touchstart', function(e) {
      const st = window._dtState;
      if (st.activeTool !== 'cursor') return; // canvas handles non-cursor modes
      const t = e.touches[0];
      _cwLpPt = { x: t.clientX, y: t.clientY, moved: false };
      if (_cwLpTimer) clearTimeout(_cwLpTimer);
      _cwLpTimer = setTimeout(() => {
        if (!_cwLpPt || _cwLpPt.moved) return;
        const cvs = document.getElementById('tcf-draw-canvas');
        if (!cvs) return;
        const r = cvs.getBoundingClientRect();
        const pt = { x: _cwLpPt.x - r.left, y: _cwLpPt.y - r.top };
        const hit = _dtHitTest(pt);
        if (hit >= 0 && hit === st.selectedIdx) {
          // Already selected → delete
          const removed = st.drawings.splice(hit, 1)[0];
          if (removed) window._dtRedoStack.push(removed);
          st.selectedIdx = -1;
        } else if (hit >= 0) {
          // Not selected → select first
          st.selectedIdx = hit;
        } else if (st.selectedIdx >= 0) {
          // Long-press on empty space → deselect
          st.selectedIdx = -1;
        }
        _dtRender();
        _dtSyncUndoBtn();
        _dtSyncRedoBtn();
        _cwLpTimer = null;
        _cwLpPt = null;
      }, 500);
    }, { passive: true });
    wrap.addEventListener('touchmove', function(e) {
      if (!_cwLpPt) return;
      const t = e.touches[0];
      if (Math.abs(t.clientX - _cwLpPt.x) > 8 || Math.abs(t.clientY - _cwLpPt.y) > 8) {
        _cwLpPt.moved = true;
        if (_cwLpTimer) { clearTimeout(_cwLpTimer); _cwLpTimer = null; }
      }
    }, { passive: true });
    wrap.addEventListener('touchend', function() {
      if (_cwLpTimer) { clearTimeout(_cwLpTimer); _cwLpTimer = null; }
      _cwLpPt = null;
    }, { passive: true });
  }
}

// ── Text input placement ──
function _dtPlaceTextInput(pt, color) {
  const canvas = document.getElementById('tcf-draw-canvas');
  if (!canvas) return;
  const rect  = canvas.getBoundingClientRect();
  const wrap  = canvas.parentElement;
  const wRect = wrap ? wrap.getBoundingClientRect() : rect;

  // Position input relative to wrap
  let inp = document.getElementById('tcf-draw-textinput');
  if (!inp) return;
  inp.style.left   = (pt.x) + 'px';
  inp.style.top    = (pt.y - 14) + 'px';
  inp.style.color  = color;
  inp.style.borderColor = color;
  inp.style.display = 'block';
  inp.value = '';
  inp.focus();

  const commit = () => {
    const txt = inp.value.trim();
    if (txt) {
      window._dtState.drawings.push({ type:'text', points:[{...pt}], color, text:txt });
      window._dtRedoStack = [];
      _dtSyncRedoBtn();
      _dtRender();
      _dtSaveDrawings();
    }
    inp.style.display = 'none';
    inp.value = '';
    inp.removeEventListener('keydown', onKey);
    inp.removeEventListener('blur',    onBlur);
  };
  const onKey  = e => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); commit(); } };
  const onBlur = () => setTimeout(commit, 100);

  inp.addEventListener('keydown', onKey);
  inp.addEventListener('blur',    onBlur, { once: true });
}

// ── Zoom: set chart visible range from pixel rect ──
function _dtApplyZoom(pts) {
  if (!_lwChart) return;
  try {
    const ts = _lwChart.timeScale();
    // Save current range so zoom can be undone
    const prev = ts.getVisibleLogicalRange();
    if (prev) {
      window._dtZoomHistory = window._dtZoomHistory || [];
      window._dtZoomHistory.push({ from: prev.from, to: prev.to });
    }
    const x1 = Math.min(pts[0].x, pts[1].x);
    const x2 = Math.max(pts[0].x, pts[1].x);
    const l1 = ts.coordinateToLogical(x1);
    const l2 = ts.coordinateToLogical(x2);
    if (l1 != null && l2 != null && l2 > l1) ts.setVisibleLogicalRange({ from:l1, to:l2 });
  } catch(_) {}
}

