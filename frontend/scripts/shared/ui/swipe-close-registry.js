// ══════════════════════════════════════════════
// SHARED — which drawers / sheets close with a swipe (the one list)
//
// Every side drawer closes with a swipe RIGHT, every bottom sheet with a swipe DOWN. The gesture itself lives in
// sheet-swipe-close.js; this file only says which element uses it and which function closes it.
//   • drawer:  [panel id, overlay id, close function name]   - also closes by swiping right on the dim area
//   • sheet:   [sheet id, backdrop id, close function]       - also closes by swiping down on the dim area
// Close functions are looked up by name when the gesture ends, so scripts loaded later are fine.
//
// A NEW drawer / sheet: add one line here (or call attachDrawerSwipeClose / attachSheetSwipeClose from its own
// script when the element is created at run time). Do not write another touchstart / touchmove copy.
// ══════════════════════════════════════════════
(function () {
  'use strict';

  function call(name) {
    return function () {
      var f = window[name];
      if (typeof f === 'function') f();
    };
  }
  function exc(method) {
    return function () {
      if (window.EXC && typeof window.EXC[method] === 'function') window.EXC[method]();
    };
  }
  // closes an overlay-wrapped sheet through its own close button (same as tapping it)
  function overlayCloser(sheet) {
    return function () {
      var overlay = sheet.closest('.send-overlay, .hcp-overlay, [id$="-overlay"], [id$="-modal"]');
      var btn = overlay && overlay.querySelector('[onclick*="close"], [onclick*="Close"]');
      if (btn) btn.click();
    };
  }

  // ── Right-side drawers (swipe right → close) ──
  var DRAWERS = [
    ['sw-wallet-panel',           'sw-wallet-panel-overlay',     'swCloseWalletPanel'],
    ['br-wallet-panel',           'br-wallet-panel-overlay',     'brCloseWalletPanel'],
    ['del-group-drawer',          'del-group-drawer-overlay',    'closeDelGroupDrawer'],
    ['cw-drawer',                 'cw-drawer-overlay',           'closeConnectedWalletsDrawer'],
    ['br-browser-wallet-drawer',  'br-browser-wallet-overlay',   'closeBrowserWalletDrawer'],
    ['rpc-manager-drawer',        'rpc-manager-overlay',         'closeRpcManager'],
    ['swap-wallet-drawer',        'swap-wallet-drawer-overlay',  'closeSwapWalletDrawer'],
    ['send-from-wg-modal',        'send-from-wg-overlay',        'closeSendFromWgPicker'],
    ['send-to-wg-modal',          'send-to-wg-overlay',          'closeSendToWgPicker'],
    ['hw-group-modal',            'hw-group-overlay',            'hwCloseGroupPicker'],
    ['bsb-wallet-picker-drawer',  'bsb-wallet-picker-overlay',   'bsbCloseWalletPicker'],
    ['th-wallet-picker-drawer',   'th-wallet-picker-overlay',    'thCloseWalletPicker'],
    ['sup-wallet-picker-drawer',  'sup-wallet-picker-overlay',   'supCloseWalletPicker']
  ];

  // ── Bottom sheets (swipe down → close) ──
  var SHEETS = [
    // Swap > Select token closes by fading #sw-token-modal (0.22s), so the sheet is held off-screen meanwhile (4th item = options)
    ['sw-token-sheet',      'sw-token-modal',       call('swCloseTokenPicker'), { holdMs: 400 }],
    ['sw-confirm-sheet',    'sw-confirm-modal',     call('swCloseConfirm')],
    ['br-confirm-sheet',    'br-confirm-modal',     call('brCloseConfirm')],
    ['currency-picker-sheet', 'currency-picker-overlay', call('closeCurrencyPicker')],
    // App Lock setup (Settings > App Lock). The pattern pad is marked data-swipe-ignore so drawing a pattern never drags the sheet.
    ['one-lock-setup-sheet', 'one-lock-setup', function () {
      if (typeof oneLock !== 'undefined' && oneLock && typeof oneLock.closeSetup === 'function') oneLock.closeSetup(false);
    }],
    // Add Keys (Wallet Groups > ADD). Swiping down on the sheet or the dim area closes it.
    ['wgak-sheet',         'wgak-overlay',         call('closeWgakModal')],
    ['send-confirm-sheet',  'send-confirm-overlay', function () {
      var ov = document.getElementById('send-confirm-overlay');
      if (ov) { ov.style.opacity = '0'; ov.style.pointerEvents = 'none'; }
      var sh = document.getElementById('send-confirm-sheet');
      if (sh) sh.style.transform = 'translateY(100%)';
    }],
    ['tm-chain-modal',      'tm-chain-overlay',     function () {
      var ov = document.getElementById('tm-chain-overlay');
      if (ov) { ov.style.opacity = '0'; ov.style.pointerEvents = 'none'; }
      var sh = document.getElementById('tm-chain-modal');
      if (sh) sh.style.transform = 'translateY(100%)';
    }],
    ['exc-selector-panel',  'exc-selector-sheet',   exc('closeSelector')],
    ['exc-pair-panel',      'exc-pair-sheet',       exc('closePairPicker')]
  ];

  // Generic bottom sheets found by class (a sheet opts out with data-no-swipe="1")
  var SHEET_CLASSES = ['send-modal', 'hcp-modal', 'txh-modal'];

  function attachAll() {
    var i;
    for (i = 0; i < DRAWERS.length; i++) {
      var d = DRAWERS[i], panel = document.getElementById(d[0]);
      if (!panel) continue;
      attachDrawerSwipeClose(panel, { closeFn: call(d[2]), overlay: d[1] });
      attachBackdropSwipeClose(document.getElementById(d[1]), call(d[2]), { axis: 'x' });
    }
    for (i = 0; i < SHEETS.length; i++) {
      var s = SHEETS[i], sheet = document.getElementById(s[0]);
      if (!sheet) continue;
      attachSheetSwipeClose(sheet, { closeFn: s[2], holdMs: s[3] && s[3].holdMs });
      attachBackdropSwipeClose(document.getElementById(s[1]), s[2]);
    }
    SHEET_CLASSES.forEach(function (cls) {
      var list = document.querySelectorAll('.' + cls);
      for (var k = 0; k < list.length; k++) {
        if (list[k].dataset.noSwipe === '1') continue;
        attachSheetSwipeClose(list[k], { closeFn: overlayCloser(list[k]) });
      }
    });
  }

  // Attaching twice is harmless (every attach is idempotent), so retry for elements that are added a little later
  function start() {
    attachAll();
    setTimeout(attachAll, 500);
    setTimeout(attachAll, 2500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
