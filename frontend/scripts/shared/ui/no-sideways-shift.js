// ══════════════════════════════════════════════
// SHARED — the page must never slide sideways
//
// Bug: long-press selects some text, then dragging the finger / selection handle left or right makes the
// WebView auto-scroll the clipped (overflow-x: hidden) containers horizontally. The UI stays shifted until
// the app is restarted, because nothing can scroll it back.
//
// Fix: any element that is clipped on X (overflow-x: hidden) is never meant to scroll sideways, so whenever
// its scrollLeft moves away from 0 we put it back immediately (same frame, before it is painted).
// Intentional horizontal scrollers use overflow-x: auto/scroll and are left alone.
// ══════════════════════════════════════════════
(function () {
  'use strict';

  var busy = false;

  function reset(el) {
    if (!el || !el.scrollLeft) return;
    try {
      var ox = window.getComputedStyle(el).overflowX;
      if (ox === 'auto' || ox === 'scroll') return;   // real horizontal scroller
    } catch (e) {}
    el.scrollLeft = 0;
  }

  function fixRoot() {
    var root = document.scrollingElement || document.documentElement;
    if (root && root.scrollLeft) root.scrollLeft = 0;
    if (document.body && document.body.scrollLeft) document.body.scrollLeft = 0;
    if (window.scrollX) window.scrollTo(0, window.scrollY || 0);
  }

  // scroll does not bubble → listen in the capture phase to see every element
  document.addEventListener('scroll', function (e) {
    if (busy) return;
    busy = true;
    try {
      var t = e.target;
      if (t === document || t === document.documentElement || t === document.body) fixRoot();
      else reset(t);
    } finally { busy = false; }
  }, true);

  // safety net: when a selection ends / the finger lifts, make sure the roots are back at x = 0
  ['touchend', 'touchcancel', 'selectionchange'].forEach(function (ev) {
    document.addEventListener(ev, function () {
      fixRoot();
      var app = document.getElementById('app');
      reset(app);
      document.querySelectorAll('.pages, .page').forEach(reset);
    }, { passive: true });
  });
})();
