// ══════════════════════════════════════════════
// SHARED — swipe-down-to-close for bottom sheets
//
//   attachSheetSwipeClose(sheet, { closeFn, scroller, important, snapEase, closeEase })
//   attachBackdropSwipeClose(backdrop, closeFn)
//
// Why one shared helper: each sheet used to carry its own copy and each copy could leave the sheet stuck half-way:
//   • no touchcancel handler (Android WebView cancels a touch the moment it starts a native pan), so the inline
//     transform stayed where the finger left it
//   • aborting the drag on the first sideways wobble, or never starting it if the first 8px were not perfectly downward
//   • a leftover inline transform overriding the closed state after the sheet was closed
// Here every way a gesture can end (touchend, touchcancel, window blur, a new touch) goes through one settle() path, so the
// sheet always ends fully open or fully closed.
// ══════════════════════════════════════════════
(function () {
  'use strict';

  var LOCK_PX = 8;            // finger travel before we decide vertical drag vs scroll
  var CLOSE_PX = 60;          // pulled down this far → close
  var FLICK_VEL = 0.35;       // px/ms (smoothed) → quick flick closes even when short
  var PAUSE_MS = 120;         // finger rested this long before lifting → ignore velocity
  var SNAP_MS = 300, CLOSE_MS = 260;

  window.attachSheetSwipeClose = function (sheet, opts) {
    if (!sheet || sheet._sheetSwipe) return sheet && sheet._sheetSwipe;
    opts = opts || {};
    var closeFn = typeof opts.closeFn === 'function' ? opts.closeFn : function () {};
    var imp = opts.important ? 'important' : '';
    var snapEase = opts.snapEase || 'transform ' + SNAP_MS + 'ms cubic-bezier(0.25,1,0.5,1)';
    var closeEase = opts.closeEase || 'transform ' + CLOSE_MS + 'ms cubic-bezier(0.4,0,0.6,1)';

    var state = 'idle';       // idle | pending | drag | scroll
    var sy = 0, sx = 0, baseY = 0, curDy = 0;
    var prevY = 0, prevT = 0, vel = 0;
    var scroller = null;
    var timer = null;
    var closing = false;      // close animation running: ignore new touches so it always finishes

    function getScroller(target) {
      var s = typeof opts.scroller === 'function' ? opts.scroller() : opts.scroller;
      if (typeof s === 'string') s = document.getElementById(s);
      return (s && s.contains(target)) ? s : null;
    }
    function setT(prop, val) { sheet.style.setProperty(prop, val, imp); }
    function clearInline() { sheet.style.removeProperty('transform'); sheet.style.removeProperty('transition'); }
    function stop() { clearTimeout(timer); timer = null; }

    // Hand control back to the stylesheet (open or closed state comes from the CSS class again)
    function release(delay) {
      stop();
      timer = setTimeout(function () { timer = null; if (state !== 'drag') clearInline(); }, delay);
    }
    function snapBack() {
      setT('transition', snapEase);
      setT('transform', 'translateY(0)');
      release(SNAP_MS + 30);
    }
    function closeNow() {
      setT('transition', closeEase);
      setT('transform', 'translateY(110%)');
      stop();
      closing = true;
      timer = setTimeout(function () {
        timer = null; closing = false;
        try { closeFn(); } finally { clearInline(); }
      }, CLOSE_MS);
    }

    // Single exit for every way a gesture can end
    function settle(endY, cancelled) {
      var was = state;
      state = 'idle'; scroller = null;
      if (was !== 'drag') return;
      var dy = (typeof endY === 'number' ? endY - baseY : curDy);
      if (dy < 0) dy = 0;
      var paused = (performance.now() - prevT) > PAUSE_MS;
      var v = paused ? 0 : vel;
      if (dy >= CLOSE_PX || (dy > 12 && v >= FLICK_VEL)) closeNow();
      else snapBack();
    }

    function onStart(e) {
      if (closing) return;
      if (e.touches.length !== 1) { if (state === 'drag') settle(null, true); state = 'idle'; return; }
      // A finger landing during the previous gesture's animation takes over cleanly
      if (state === 'drag') settle(null, true);
      stop();
      var t = e.touches[0];
      sy = t.clientY; sx = t.clientX; baseY = sy; curDy = 0;
      prevY = sy; prevT = performance.now(); vel = 0;
      scroller = getScroller(e.target);
      // Pulling down on a list that is scrolled away from its top must scroll the list, not move the sheet
      state = (scroller && scroller.scrollTop > 1) ? 'scroll' : 'pending';
    }

    function onMove(e) {
      if (closing || state === 'idle' || state === 'scroll' || e.touches.length !== 1) return;
      var t = e.touches[0], cy = t.clientY, cx = t.clientX;
      var dy = cy - sy, dx = cx - sx;

      if (state === 'pending') {
        if (Math.abs(dx) < LOCK_PX && Math.abs(dy) < LOCK_PX) return;
        // Clearly sideways, or upward, or the list started scrolling → not a close gesture, leave it to the browser
        if (Math.abs(dx) > Math.abs(dy) * 1.5 || dy < 0 || (scroller && scroller.scrollTop > 1)) { state = 'scroll'; return; }
        state = 'drag';
        baseY = cy;                       // begin from here so the sheet does not jump by the lock distance
        stop();
        setT('transition', 'none');
        try { if (document.activeElement && document.activeElement.tagName === 'INPUT') document.activeElement.blur(); } catch (_e) {}
      }

      // state === 'drag'
      curDy = cy - baseY;
      var shown = curDy > 0 ? curDy : 0;
      var h = sheet.offsetHeight || 400;
      if (shown > h * 0.6) shown = h * 0.6 + (shown - h * 0.6) * 0.3;   // light resistance near the bottom
      setT('transform', 'translateY(' + shown + 'px)');
      var dt = performance.now() - prevT;
      if (dt > 0) vel = 0.7 * ((cy - prevY) / dt) + 0.3 * vel;           // smoothed: one noisy sample cannot decide
      prevY = cy; prevT = performance.now();
      if (e.cancelable) e.preventDefault();                               // keep the list / page from scrolling under the drag
    }

    function onEnd(e) {
      var t = e.changedTouches && e.changedTouches[0];
      settle(t ? t.clientY : null, false);
    }
    function onCancel() {
      // The WebView took the touch (native pan / overscroll). Finish from where the finger was instead of freezing there.
      settle(null, true);
    }

    sheet.addEventListener('touchstart', onStart, { passive: true });
    sheet.addEventListener('touchmove', onMove, { passive: false });
    sheet.addEventListener('touchend', onEnd, { passive: true });
    sheet.addEventListener('touchcancel', onCancel, { passive: true });
    window.addEventListener('blur', onCancel);
    document.addEventListener('visibilitychange', function () { if (document.hidden) onCancel(); });

    var api = {
      // Call when the sheet is opened: drop any inline leftovers so the CSS open state is in charge
      reset: function () { stop(); closing = false; state = 'idle'; clearInline(); }
    };
    sheet._sheetSwipe = api;
    return api;
  };

  // Swipe down on the dim area outside the sheet also closes it
  window.attachBackdropSwipeClose = function (el, closeFn) {
    if (!el || el._backdropSwipe) return;
    el._backdropSwipe = true;
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
      var dy = t.clientY - y0, dx = Math.abs(t.clientX - x0);
      if (dy >= 40 && dx < dy) closeFn();
    }, { passive: true });
    el.addEventListener('touchcancel', function () { on = false; }, { passive: true });
  };
})();
