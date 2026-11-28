// ══════════════════════════════════════════════
// SHARED — swipe-to-close for bottom sheets AND side drawers (ONE gesture, used everywhere)
//
//   attachSheetSwipeClose(sheet,  { closeFn, scroller, overlay, snapEase, closeEase })   bottom sheet: pull DOWN
//   attachDrawerSwipeClose(panel, { closeFn, overlay, snapEase, closeEase })             right drawer:  push RIGHT
//   attachBackdropSwipeClose(backdrop, closeFn, { axis: 'y' | 'x' })                      swipe on the dim area
//
// Same feel for every sheet and drawer: direction lock after 8px, close at 60px or a quick flick, the panel
// follows the finger (light resistance near the end), otherwise it snaps back.
//
// Why one helper: each sheet used to carry its own copy and each copy could leave the panel stuck half-way:
//   • no touchcancel handler (Android WebView cancels a touch the moment it starts a native pan)
//   • aborting the drag on the first sideways wobble, or never starting it
//   • a leftover inline transform overriding the closed state after the panel was closed
// Here every way a gesture can end (touchend, touchcancel, window blur, a new touch) goes through one settle() path,
// so the panel always ends fully open or fully closed.
//
// How the panel is handed back: while a gesture is active the helper sets transform / transition inline with
// !important (so it also beats stylesheet rules like ".open .drawer { transform: translateX(0) !important }").
// When the gesture is over it gives back exactly what it set - the value that was there before is restored, but only
// if nobody changed it meanwhile. closeFn can therefore close the panel its own way (toggle a class, set its own
// inline transform, hide the overlay ...) and the helper never undoes that.
//
// `overlay` (optional, drawers default to the parent element when it is an overlay): the dim layer behind the panel.
// Its `open` class is dropped right before closeFn runs, because a stylesheet like ".open .drawer { ... !important }"
// would otherwise keep the panel forced open while closeFn is still closing it.
//
// Opt-outs: put data-swipe-ignore on any element inside the panel (e.g. a slider) and a gesture that starts on it
// is left alone.
// ══════════════════════════════════════════════
(function () {
  'use strict';

  var LOCK_PX = 8;            // finger travel before we decide "close gesture" vs "scroll"
  var CLOSE_PX = 60;          // moved this far → close
  var FLICK_VEL = 0.35;       // px/ms (smoothed) → quick flick closes even when short
  var PAUSE_MS = 120;         // finger rested this long before lifting → ignore velocity
  var AXIS_RATIO = 1.5;       // cross-axis travel must stay below 1.5 × travel along the close direction
  var SNAP_MS = 300, CLOSE_MS = 260;
  var BACKDROP_PX = 40;       // swipe on the dim area

  var live = [];              // every attached gesture: all are cancelled together when the app loses focus

  function cancelAll() {
    live = live.filter(function (g) { return g.panel.isConnected !== false; });
    live.forEach(function (g) { g.cancel(); });
  }
  window.addEventListener('blur', cancelAll);
  document.addEventListener('visibilitychange', function () { if (document.hidden) cancelAll(); });

  function sel(el, css) { try { return !!(el && el.closest && el.closest(css)); } catch (_e) { return false; } }

  function autoOverlay(panel) {
    var p = panel.parentElement;
    if (!p) return null;
    var tag = (p.id || '') + ' ' + (typeof p.className === 'string' ? p.className : '');
    return /overlay|backdrop/i.test(tag) ? p : null;
  }

  // The core. axis 'y' = bottom sheet (close = down), 'x' = drawer (close = right)
  function attach(panel, opts, axis) {
    if (!panel) return null;
    if (panel._sheetSwipe) return panel._sheetSwipe;
    opts = opts || {};
    var horiz = axis === 'x';
    var closeFn = typeof opts.closeFn === 'function' ? opts.closeFn : function () {};
    var snapEase = opts.snapEase || 'transform ' + SNAP_MS + 'ms cubic-bezier(0.25,1,0.5,1)';
    var closeEase = opts.closeEase || 'transform ' + CLOSE_MS + 'ms cubic-bezier(0.4,0,0.6,1)';
    var ZERO = horiz ? 'translateX(0)' : 'translateY(0)';
    var OFF = horiz ? 'translateX(110%)' : 'translateY(110%)';

    var state = 'idle';       // idle | pending | drag | scroll
    var s0 = 0, c0 = 0;       // finger start: along the close direction / across it
    var base = 0, cur = 0;    // drag origin and current distance along the close direction
    var prevA = 0, prevT = 0, vel = 0;
    var scroller = null;
    var timer = null;
    var closing = false;      // close animation running: ignore new touches so it always finishes
    var saved = null;         // what the panel had inline before we touched it
    var own = null;           // what we last set (so we only hand back our own values)

    function snapshotProp(p) { return { v: panel.style.getPropertyValue(p), p: panel.style.getPropertyPriority(p) }; }
    function begin() {
      if (saved) return;      // a previous gesture is still being handed back: keep its snapshot
      saved = { transform: snapshotProp('transform'), transition: snapshotProp('transition') };
      own = {};
    }
    function setP(prop, val) {
      begin();
      panel.style.setProperty(prop, val, 'important');
      own[prop] = panel.style.getPropertyValue(prop);
    }
    function giveBackProp(prop) {
      var mine = own && panel.style.getPropertyPriority(prop) === 'important' && panel.style.getPropertyValue(prop) === own[prop];
      if (!mine) return;      // somebody else (closeFn, the opener) set it since: theirs now
      var s = saved[prop];
      if (s && s.v) panel.style.setProperty(prop, s.v, s.p); else panel.style.removeProperty(prop);
    }
    function giveBack() {
      if (!saved) return;
      giveBackProp('transform');
      giveBackProp('transition');
      saved = null; own = null;
    }
    function stop() { clearTimeout(timer); timer = null; }

    function overlayEl() {
      var o = opts.overlay;
      if (typeof o === 'function') o = o();
      if (typeof o === 'string') o = document.getElementById(o);
      return o || (horiz ? autoOverlay(panel) : null);
    }

    function release(delay) {
      stop();
      timer = setTimeout(function () { timer = null; if (state !== 'drag') giveBack(); }, delay);
    }
    function snapBack() {
      setP('transition', snapEase);
      setP('transform', ZERO);
      release(SNAP_MS + 30);
    }
    function closeNow() {
      setP('transition', closeEase);
      setP('transform', OFF);
      stop();
      closing = true;
      timer = setTimeout(function () {
        timer = null;
        try {
          var ov = overlayEl();
          if (ov && ov.classList && ov.classList.contains('open')) ov.classList.remove('open');
          closeFn();
        } finally {
          closing = false;
          giveBack();
        }
      }, CLOSE_MS);
    }

    // Single exit for every way a gesture can end
    function settle(endA, cancelled) {
      var was = state;
      state = 'idle'; scroller = null;
      if (was !== 'drag') return;
      var d = (typeof endA === 'number' ? endA - base : cur);
      if (d < 0) d = 0;
      var paused = (performance.now() - prevT) > PAUSE_MS;
      var v = paused ? 0 : vel;
      if (d >= CLOSE_PX || (d > 12 && v >= FLICK_VEL)) closeNow();
      else snapBack();
    }

    // Nearest scrollable ancestor of the touch inside the panel: vertical for sheets, horizontal for drawers
    function findScrollable(target) {
      var el = target;
      while (el && el !== panel && el.nodeType === 1) {
        var cs = window.getComputedStyle(el);
        if (horiz) {
          if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 2) return el;
        } else if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 2) return el;
        el = el.parentElement;
      }
      return null;
    }
    function getScroller(target) {
      if (!horiz) {
        var s = typeof opts.scroller === 'function' ? opts.scroller(target) : opts.scroller;
        if (typeof s === 'string') s = document.getElementById(s);
        if (s && s.contains && s.contains(target)) return s;
      }
      return findScrollable(target);
    }
    function scrolledAway(s) { return !!s && (horiz ? s.scrollLeft : s.scrollTop) > 1; }

    function onStart(e) {
      if (closing) return;
      if (e.touches.length !== 1) { if (state === 'drag') settle(null, true); state = 'idle'; return; }
      // A finger landing during the previous gesture's animation takes over cleanly
      if (state === 'drag') settle(null, true);
      stop();
      if (sel(e.target, '[data-swipe-ignore], input[type="range"]')) { state = 'scroll'; return; }
      var t = e.touches[0];
      s0 = horiz ? t.clientX : t.clientY;
      c0 = horiz ? t.clientY : t.clientX;
      base = s0; cur = 0;
      prevA = s0; prevT = performance.now(); vel = 0;
      scroller = getScroller(e.target);
      // Pulling on a list that is scrolled away from its start must scroll the list, not move the panel
      state = scrolledAway(scroller) ? 'scroll' : 'pending';
    }

    function onMove(e) {
      if (closing || state === 'idle' || state === 'scroll' || e.touches.length !== 1) return;
      var t = e.touches[0];
      var a = horiz ? t.clientX : t.clientY;
      var c = horiz ? t.clientY : t.clientX;
      var along = a - s0, across = c - c0;

      if (state === 'pending') {
        if (Math.abs(along) < LOCK_PX && Math.abs(across) < LOCK_PX) return;
        // Clearly across, or the wrong way, or the list started scrolling → not a close gesture, leave it to the browser
        if (Math.abs(across) > Math.abs(along) * AXIS_RATIO || along < 0 || scrolledAway(scroller)) { state = 'scroll'; return; }
        state = 'drag';
        base = a;                         // begin from here so the panel does not jump by the lock distance
        stop();
        begin();
        setP('transition', 'none');
        try { if (document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) document.activeElement.blur(); } catch (_e) {}
      }

      // state === 'drag'
      cur = a - base;
      var shown = cur > 0 ? cur : 0;
      var size = (horiz ? panel.offsetWidth : panel.offsetHeight) || (horiz ? 300 : 400);
      if (shown > size * 0.6) shown = size * 0.6 + (shown - size * 0.6) * 0.3;   // light resistance near the end
      setP('transform', (horiz ? 'translateX(' : 'translateY(') + shown + 'px)');
      var dt = performance.now() - prevT;
      if (dt > 0) vel = 0.7 * ((a - prevA) / dt) + 0.3 * vel;            // smoothed: one noisy sample cannot decide
      prevA = a; prevT = performance.now();
      if (e.cancelable) e.preventDefault();                               // keep the list / page from scrolling under the drag
    }

    function onEnd(e) {
      var t = e.changedTouches && e.changedTouches[0];
      settle(t ? (horiz ? t.clientX : t.clientY) : null, false);
    }
    function onCancel() {
      // The WebView took the touch (native pan / overscroll). Finish from where the finger was instead of freezing there.
      settle(null, true);
    }

    panel.addEventListener('touchstart', onStart, { passive: true });
    panel.addEventListener('touchmove', onMove, { passive: false });
    panel.addEventListener('touchend', onEnd, { passive: true });
    panel.addEventListener('touchcancel', onCancel, { passive: true });

    var api = {
      panel: panel,
      cancel: onCancel,
      // Call when the panel is opened: drop anything this helper left behind so the open state is in charge
      reset: function () { stop(); closing = false; state = 'idle'; giveBack(); },
      destroy: function () {
        stop(); giveBack();
        panel.removeEventListener('touchstart', onStart);
        panel.removeEventListener('touchmove', onMove);
        panel.removeEventListener('touchend', onEnd);
        panel.removeEventListener('touchcancel', onCancel);
        live = live.filter(function (g) { return g !== api; });
        panel._sheetSwipe = null;
      }
    };
    panel._sheetSwipe = api;
    live = live.filter(function (g) { return g.panel.isConnected !== false; });
    live.push(api);
    return api;
  }

  window.attachSheetSwipeClose = function (sheet, opts) { return attach(sheet, opts, 'y'); };
  window.attachDrawerSwipeClose = function (panel, opts) { return attach(panel, opts, 'x'); };

  // Swipe on the dim area outside the panel also closes it: down for a bottom sheet (default), right for a drawer
  window.attachBackdropSwipeClose = function (el, closeFn, opts) {
    if (!el || el._backdropSwipe) return;
    el._backdropSwipe = true;
    var horiz = !!(opts && opts.axis === 'x');
    var on = false, y0 = 0, x0 = 0;
    el.addEventListener('touchstart', function (e) {
      on = (e.target === el && e.touches.length === 1);
      if (on) { y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; }
    }, { passive: true });
    el.addEventListener('touchend', function (e) {
      if (!on) return;
      on = false;
      var t = e.changedTouches[0];
      if (!t) return;
      var along = horiz ? t.clientX - x0 : t.clientY - y0;
      var across = Math.abs(horiz ? t.clientY - y0 : t.clientX - x0);
      if (along >= BACKDROP_PX && across < along) closeFn();
    }, { passive: true });
    el.addEventListener('touchcancel', function () { on = false; }, { passive: true });
  };
})();
