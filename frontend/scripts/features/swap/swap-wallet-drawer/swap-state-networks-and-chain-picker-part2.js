
/* ════════════════════════════════════════════════════
   SWAP WALLET PANEL — open / close / render / key input
   ════════════════════════════════════════════════════ */

let _swExpandedGroupIdx = -1;

window.swOpenWalletPanel = function() {
  // Auto-expand the group that contains the currently selected wallet
  if (SW.walletConnected && SW.walletAddress) {
    const _groups = (typeof loadWalletGroups === 'function') ? loadWalletGroups().filter(g => g && g.keys && g.keys.length > 0) : [];
    let _foundIdx = -1;
    for (let _gi = 0; _gi < _groups.length; _gi++) {
      for (const _pk of (_groups[_gi].keys || [])) {
        try {
          const _n = _pk.startsWith('0x') ? _pk : '0x' + _pk;
          if (new ethers.Wallet(_n).address.toLowerCase() === SW.walletAddress.toLowerCase()) {
            _foundIdx = _gi; break;
          }
        } catch(_) {}
      }
      if (_foundIdx !== -1) break;
    }
    if (_foundIdx !== -1) _swExpandedGroupIdx = _foundIdx;
  }
  _swRenderWalletPanel();
  // Clear key input state
  const ki = document.getElementById('sw-key-input');
  if (ki) ki.value = '';
  const kp = document.getElementById('sw-key-preview');
  if (kp) { kp.textContent = ''; kp._pk = null; kp._addr = null; }
  const overlay = document.getElementById('sw-wallet-panel-overlay');
  const panel   = document.getElementById('sw-wallet-panel');
  if (!overlay || !panel) return;
  overlay.style.pointerEvents = 'all';
  overlay.style.opacity       = '1';
  panel.style.transform       = 'translateX(0)';
  if (typeof haptic === 'function') haptic();
};

window.swCloseWalletPanel = function() {
  const overlay = document.getElementById('sw-wallet-panel-overlay');
  const panel   = document.getElementById('sw-wallet-panel');
  if (!overlay || !panel) return;
  overlay.style.opacity   = '0';
  overlay.style.pointerEvents = 'none'; // immediate — no setTimeout race
  panel.style.transform   = 'translateX(100%)';
};

// ── Swipe-to-close: left→right drag closes the wallet panel ──
(function _swPanelSwipeInit() {
  function _attachSwipe(panelId, closeFn) {
    var panel = document.getElementById(panelId);
    if (!panel) return;
    var _sx = 0, _sy = 0, _st = 0, _prevX = 0, _prevT = 0;
    var _dragging = false, _axisLocked = false, _isH = false;
    var _THRESHOLD = 55;   // px to trigger close
    var _VEL_THRESHOLD = 0.4; // px/ms — fast flick closes even below px threshold
    var _MAX_Y_RATIO = 1.2;   // vertical/horizontal ratio to cancel

    var _SNAP_EASE   = 'transform 0.3s cubic-bezier(0.25,1,0.5,1)';
    var _CLOSE_EASE  = 'transform 0.28s cubic-bezier(0.4,0,0.6,1)';

    // Find the associated overlay (sibling or parent overlay element)
    function _getOverlay() {
      var p = panel.parentElement;
      if (p && p.id && p.id.indexOf('overlay') !== -1) return p;
      if (p && p.className && p.className.indexOf('overlay') !== -1) return p;
      // Try common naming: panel id "foo-panel" → overlay "foo-panel-overlay" or "foo-overlay"
      var pid = panelId;
      return document.getElementById(pid + '-overlay') ||
             document.getElementById(pid.replace(/-panel$/, '-panel-overlay')
                                         .replace(/-drawer$/, '-overlay')
                                         .replace(/-modal$/, '-overlay'));
    }

    function _doClose() {
      // Animate panel out
      panel.style.transition = _CLOSE_EASE;
      panel.style.transform = 'translateX(100%)';
      // Fade overlay
      var ov = _getOverlay();
      if (ov) {
        ov.style.transition = 'opacity 0.28s ease';
        ov.style.opacity = '0';
        ov.style.pointerEvents = 'none';
      }
      // Mark that swipe animation is already in progress so closeFn
      // won't re-set transform/transition and cause a jump.
      panel._swipeClosing = true;
      // After animation completes: cleanup inline overrides, then call closeFn for state reset.
      setTimeout(function() {
        panel.style.transition = '';
        panel._swipeClosing = false;
        if (ov) ov.style.transition = '';
        closeFn();
      }, 300);
    }

    panel.addEventListener('touchstart', function(e) {
      if (e.touches.length !== 1) return;
      _sx = e.touches[0].clientX;
      _sy = e.touches[0].clientY;
      _st = e.timeStamp;
      _prevX = _sx; _prevT = _st;
      _dragging = true; _axisLocked = false; _isH = false;
      panel.style.transition = 'none';
    }, { passive: true });

    panel.addEventListener('touchmove', function(e) {
      if (!_dragging || e.touches.length !== 1) return;
      var cx = e.touches[0].clientX;
      var dx = cx - _sx;
      var dy = Math.abs(e.touches[0].clientY - _sy);

      if (!_axisLocked && (Math.abs(dx) > 5 || dy > 5)) {
        _isH = Math.abs(dx) >= dy / _MAX_Y_RATIO && dx > 0;
        _axisLocked = true;
        if (!_isH) {
          panel.style.transition = _SNAP_EASE;
          panel.style.transform = 'translateX(0)';
          _dragging = false;
          return;
        }
        // Horizontal drag confirmed — remove .open so !important CSS doesn't block movement
        var _ov0 = _getOverlay();
        if (_ov0) _ov0.classList.remove('open');
      }
      if (!_axisLocked || !_isH) return;

      if (dx > 0) {
        var w = panel.offsetWidth || 300;
        var res = dx < w * 0.6 ? dx : w * 0.6 + (dx - w * 0.6) * 0.25;
        panel.style.transform = 'translateX(' + res + 'px)';
        // Fade overlay proportionally
        var ov = _getOverlay();
        if (ov && ov.style.opacity !== '0') {
          var frac = Math.min(1, res / (w * 0.8));
          ov.style.opacity = String(Math.max(0, 1 - frac));
        }
      }
      _prevX = cx; _prevT = e.timeStamp;
    }, { passive: true });

    panel.addEventListener('touchend', function(e) {
      if (!_dragging) return;
      _dragging = false;
      var dx = (e.changedTouches[0] ? e.changedTouches[0].clientX : _sx) - _sx;
      var dt = e.timeStamp - _prevT;
      var vel = dt > 0 ? (e.changedTouches[0].clientX - _prevX) / dt : 0;
      if (_isH && (dx >= _THRESHOLD || vel >= _VEL_THRESHOLD)) {
        _doClose();
      } else {
        // Snap back — restore .open so CSS !important rule re-applies after transition
        panel.style.transition = _SNAP_EASE;
        panel.style.transform = 'translateX(0)';
        var ov = _getOverlay();
        if (ov) { ov.style.transition = 'opacity 0.28s ease'; ov.style.opacity = '1'; ov.classList.add('open'); }
        setTimeout(function() {
          panel.style.transition = '';
          if (ov) ov.style.transition = '';
        }, 300);
      }
    }, { passive: true });

    panel.addEventListener('touchcancel', function() {
      _dragging = false;
      panel.style.transition = _SNAP_EASE;
      panel.style.transform = 'translateX(0)';
      var ov = _getOverlay();
      if (ov) { ov.style.transition = 'opacity 0.28s ease'; ov.style.opacity = '1'; ov.classList.add('open'); }
      setTimeout(function() {
        panel.style.transition = '';
        if (ov) ov.style.transition = '';
      }, 340);
    }, { passive: true });
  }

  // Overlay swipe-to-close: any rightward swipe on the dark overlay closes panel
  function _attachOverlaySwipe(overlayId, panelId, closeFn) {
    var overlay = document.getElementById(overlayId);
    if (!overlay) return;
    var _ox = 0, _oy = 0, _oActive = false;
    var _O_THRESHOLD = 40;
    var _O_MAX_Y = 50;

    overlay.addEventListener('touchstart', function(e) {
      // Only trigger if touch started OUTSIDE the panel
      var panel = document.getElementById(panelId);
      if (panel && panel.contains(e.target)) return;
      if (e.touches.length !== 1) return;
      _ox = e.touches[0].clientX;
      _oy = e.touches[0].clientY;
      _oActive = true;
    }, { passive: true });

    overlay.addEventListener('touchend', function(e) {
      if (!_oActive) return;
      _oActive = false;
      var panel = document.getElementById(panelId);
      if (panel && panel.contains(e.target)) return;
      if (e.changedTouches.length !== 1) return;
      var dx = e.changedTouches[0].clientX - _ox;
      var dy = Math.abs(e.changedTouches[0].clientY - _oy);
      if (dx >= _O_THRESHOLD && dy < _O_MAX_Y) closeFn();
    }, { passive: true });

    overlay.addEventListener('touchcancel', function() { _oActive = false; }, { passive: true });
  }

  // ── Bottom sheet swipe-down-to-close ──
  function _attachBottomSwipe(sheetId, closeFn) {
    var sheet = document.getElementById(sheetId);
    if (!sheet) return;
    var _sy = 0, _sx = 0, _prevY = 0, _prevT = 0, _vel = 0;
    var _dragging = false;
    var _axis = null;                         // null until the gesture direction is known: 'v' | 'h'
    var _candidate = false, _scroller = null; // drag starting on a scroll list that sits at its top
    var _timer = null;                        // pending transition-reset timer of the previous gesture
    var _THRESHOLD = 60;
    var _VEL_THRESHOLD = 0.35; // px/ms

    var _SNAP_EASE  = 'transform 0.3s cubic-bezier(0.25,1,0.5,1)';
    var _CLOSE_EASE = 'transform 0.28s cubic-bezier(0.4,0,0.6,1)';

    function _findScrollable(el) {
      while (el && el !== sheet) {
        var ov = window.getComputedStyle(el).overflowY;
        if ((ov === 'auto' || ov === 'scroll') && el.scrollHeight > el.clientHeight + 2) return el;
        el = el.parentElement;
      }
      return null;
    }
    function _snapBack() {
      sheet.style.transition = _SNAP_EASE;
      sheet.style.transform = 'translateY(0)';
      clearTimeout(_timer);
      _timer = setTimeout(function() { sheet.style.transition = ''; }, 320);
    }
    function _startDrag(y, t) {
      _dragging = true; _axis = null; _vel = 0;
      _sy = y; _prevY = y; _prevT = t;
      clearTimeout(_timer);       // a leftover timer from the last gesture must not touch this drag
      sheet.style.transition = 'none';
    }

    sheet.addEventListener('touchstart', function(e) {
      if (e.touches.length !== 1) return;
      _sy = e.touches[0].clientY;
      _sx = e.touches[0].clientX;
      _prevY = _sy; _prevT = e.timeStamp; _vel = 0;
      _dragging = false; _candidate = false; _axis = null;
      _scroller = _findScrollable(e.target);
      if (_scroller) {
        // Scrolled list: only a pull-down from its very top may drag the sheet
        if (_scroller.scrollTop <= 0) _candidate = true;
        return;
      }
      _startDrag(_sy, e.timeStamp);
    }, { passive: true });

    sheet.addEventListener('touchmove', function(e) {
      if (e.touches.length !== 1) return;
      var cy = e.touches[0].clientY, cx = e.touches[0].clientX;
      if (_candidate && !_dragging) {
        var _dy0 = cy - _sy, _dx0 = Math.abs(cx - _sx);
        if (_dy0 < -12 || (_scroller && _scroller.scrollTop > 0)) { _candidate = false; return; }
        if (_dx0 > 24 && _dx0 > Math.abs(_dy0)) { _candidate = false; return; }
        if (_dy0 <= 10) return;
        _candidate = false;
        _startDrag(cy, e.timeStamp);   // start from here so the sheet does not jump
        _sx = cx; _axis = 'v';
      }
      if (!_dragging) return;
      var dy = cy - _sy;
      var dx = cx - _sx;
      if (!_axis) {
        // Lock direction once the finger has moved a little: thumbs swipe in arcs, so a bit of sideways drift is fine
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (Math.abs(dx) > Math.abs(dy) * 1.5) {   // clearly sideways — not ours
          _dragging = false; _axis = 'h';
          _snapBack();
          return;
        }
        _axis = 'v';
      }
      if (dy > 0) {
        // Rubber-band: slight resistance past 50% sheet height
        var h = sheet.offsetHeight || 400;
        var res = dy < h * 0.5 ? dy : h * 0.5 + (dy - h * 0.5) * 0.3;
        sheet.style.transform = 'translateY(' + res + 'px)';
      } else {
        sheet.style.transform = 'translateY(0)';
      }
      var dt = e.timeStamp - _prevT;
      if (dt > 0) _vel = 0.7 * ((cy - _prevY) / dt) + 0.3 * _vel;   // smoothed, so one noisy sample cannot decide
      _prevY = cy; _prevT = e.timeStamp;
    }, { passive: true });

    sheet.addEventListener('touchend', function(e) {
      _candidate = false;
      if (!_dragging) return;
      _dragging = false;
      var cy = e.changedTouches[0] ? e.changedTouches[0].clientY : _sy;
      var dy = cy - _sy;
      var paused = (e.timeStamp - _prevT) > 120;   // finger rested before lifting: ignore velocity
      var vel = paused ? 0 : _vel;
      if (dy >= _THRESHOLD || (dy > 12 && vel >= _VEL_THRESHOLD)) {
        sheet.style.transition = _CLOSE_EASE;
        sheet.style.transform = 'translateY(110%)';
        clearTimeout(_timer);
        _timer = setTimeout(function() { sheet.style.transition = ''; closeFn(); }, 280);
      } else {
        _snapBack();
      }
    }, { passive: true });

    sheet.addEventListener('touchcancel', function() {
      _candidate = false;
      _dragging = false;
      _snapBack();
    }, { passive: true });
  }

  // Swipe down on the dim area above a bottom sheet also closes it
  function _attachBackdropSwipeDown(modalId, closeFn) {
    var modal = document.getElementById(modalId);
    if (!modal) return;
    var _y = 0, _x = 0, _on = false;
    modal.addEventListener('touchstart', function(e) {
      _on = (e.target === modal && e.touches.length === 1);
      if (_on) { _y = e.touches[0].clientY; _x = e.touches[0].clientX; }
    }, { passive: true });
    modal.addEventListener('touchend', function(e) {
      if (!_on) return;
      _on = false;
      var t = e.changedTouches[0];
      if (!t) return;
      var dy = t.clientY - _y, dx = Math.abs(t.clientX - _x);
      if (dy >= 40 && dx < dy) closeFn();
    }, { passive: true });
    modal.addEventListener('touchcancel', function() { _on = false; }, { passive: true });
  }

  // ── send-modal / hcp-modal bottom sheet swipe ──
  function _attachBottomSwipeByClass(className, closeFnName) {
    document.querySelectorAll('.' + className).forEach(function(sheet) {
      // Skip if this sheet has opted out of swipe-to-close
      if (sheet.dataset.noSwipe === '1') return;
      var _sy = 0, _sx = 0, _dragging = false, _lockSwipe = false;
      var _THRESHOLD = 80;

      // Helper: is element (or its ancestor up to sheet) a scrollable container we should not interfere with?
      function _isInsideScrollable(target) {
        var el = target;
        while (el && el !== sheet) {
          if (el.classList && (
            el.classList.contains('send-chain-row') ||
            el.classList.contains('send-token-row')
          )) return true;
          // send-body: lock only if already scrolled
          if (el.classList && el.classList.contains('send-body')) {
            if (el.scrollTop > 2) return true;
          }
          // any inline overflow-y scroll element that has been scrolled
          if (el.style && (el.style.overflowY === 'auto' || el.style.overflowY === 'scroll')) {
            if (el.scrollTop > 2) return true;
          }
          el = el.parentElement;
        }
        return false;
      }

      sheet.addEventListener('touchstart', function(e) {
        if (e.touches.length !== 1) return;
        _sy = e.touches[0].clientY;
        _sx = e.touches[0].clientX;
        _dragging = true;
        _lockSwipe = _isInsideScrollable(e.target);
        sheet.style.transition = 'none';
      }, { passive: true });

      sheet.addEventListener('touchmove', function(e) {
        if (!_dragging || e.touches.length !== 1) return;
        if (_lockSwipe) { sheet.style.transform = ''; return; }
        var dx = Math.abs(e.touches[0].clientX - _sx);
        var dy = e.touches[0].clientY - _sy;
        // Lock if horizontal movement dominates
        if (dx > Math.abs(dy) + 6) { _lockSwipe = true; sheet.style.transform = ''; return; }
        // Re-check in case scrollable child got scrolled
        if (_isInsideScrollable(e.target)) { _lockSwipe = true; sheet.style.transform = ''; return; }
        if (dy > 0) { sheet.style.transform = 'translateY(' + dy + 'px)'; e.stopPropagation(); }
      }, { passive: true });

      sheet.addEventListener('touchend', function(e) {
        if (!_dragging) return;
        _dragging = false;
        sheet.style.transition = '';
        if (_lockSwipe) { sheet.style.transform = ''; _lockSwipe = false; return; }
        var dy = (e.changedTouches[0] ? e.changedTouches[0].clientY : _sy) - _sy;
        if (dy >= _THRESHOLD) {
          var overlay = sheet.closest('.send-overlay, .hcp-overlay, [id$="-overlay"], [id$="-modal"]');
          if (overlay) {
            var closeBtn = overlay.querySelector('[onclick*="close"], [onclick*="Close"]');
            if (closeBtn) {
              closeBtn.click();
              var _sh = sheet;
              setTimeout(function() { _sh.style.transform = ''; }, 420);
              return;
            }
          }
          if (typeof window[closeFnName] === 'function') window[closeFnName]();
          var _sh2 = sheet;
          setTimeout(function() { _sh2.style.transform = ''; }, 420);
        } else {
          sheet.style.transform = 'translateY(0)';
        }
      }, { passive: true });

      sheet.addEventListener('touchcancel', function() {
        _dragging = false;
        _lockSwipe = false;
        sheet.style.transition = '';
        sheet.style.transform = 'translateY(0)';
      }, { passive: true });
    });
  }

  function _init() {
    // ── RIGHT-SIDE DRAWERS (swipe right → close) ──
    _attachSwipe('sw-wallet-panel',      function() { if (typeof window.swCloseWalletPanel    === 'function') window.swCloseWalletPanel(); });
    _attachSwipe('br-wallet-panel',      function() { if (typeof window.brCloseWalletPanel    === 'function') window.brCloseWalletPanel(); });
    _attachSwipe('del-group-drawer',     function() { if (typeof closeDelGroupDrawer          === 'function') closeDelGroupDrawer(); });
    _attachSwipe('cw-drawer',            function() { if (typeof closeConnectedWalletsDrawer  === 'function') closeConnectedWalletsDrawer(); });
    _attachSwipe('rpc-manager-drawer',   function() { if (typeof closeRpcManager              === 'function') closeRpcManager(); });
    _attachSwipe('swap-wallet-drawer',   function() { if (typeof closeSwapWalletDrawer        === 'function') closeSwapWalletDrawer(); });
    _attachSwipe('send-from-wg-modal',   function() { if (typeof closeSendFromWgPicker        === 'function') closeSendFromWgPicker(); });
    _attachSwipe('send-to-wg-modal',     function() { if (typeof closeSendToWgPicker          === 'function') closeSendToWgPicker(); });

    // ── OVERLAY SWIPE (right swipe on dark overlay → close) ──
    _attachOverlaySwipe('sw-wallet-panel-overlay',    'sw-wallet-panel',    function() { if (typeof window.swCloseWalletPanel   === 'function') window.swCloseWalletPanel(); });
    _attachOverlaySwipe('br-wallet-panel-overlay',    'br-wallet-panel',    function() { if (typeof window.brCloseWalletPanel   === 'function') window.brCloseWalletPanel(); });
    _attachOverlaySwipe('del-group-drawer-overlay',   'del-group-drawer',   function() { if (typeof closeDelGroupDrawer         === 'function') closeDelGroupDrawer(); });
    _attachOverlaySwipe('cw-drawer-overlay',          'cw-drawer',          function() { if (typeof closeConnectedWalletsDrawer === 'function') closeConnectedWalletsDrawer(); });
    _attachOverlaySwipe('rpc-manager-overlay',        'rpc-manager-drawer', function() { if (typeof closeRpcManager             === 'function') closeRpcManager(); });
    _attachOverlaySwipe('swap-wallet-drawer-overlay', 'swap-wallet-drawer', function() { if (typeof closeSwapWalletDrawer       === 'function') closeSwapWalletDrawer(); });
    _attachOverlaySwipe('send-from-wg-overlay',       'send-from-wg-modal', function() { if (typeof closeSendFromWgPicker       === 'function') closeSendFromWgPicker(); });
    _attachOverlaySwipe('send-to-wg-overlay',         'send-to-wg-modal',   function() { if (typeof closeSendToWgPicker         === 'function') closeSendToWgPicker(); });

    // ── BOTTOM SHEETS (swipe down → close) ──
    _attachBottomSwipe('sw-token-sheet',     function() { if (typeof window.swCloseTokenPicker === 'function') window.swCloseTokenPicker(); });
    _attachBackdropSwipeDown('sw-token-modal', function() { if (typeof window.swCloseTokenPicker === 'function') window.swCloseTokenPicker(); });
    _attachBottomSwipe('sw-confirm-sheet',     function() { if (typeof window.swCloseConfirm   === 'function') window.swCloseConfirm(); });
    _attachBottomSwipe('send-confirm-sheet',   function() {
      var ov = document.getElementById('send-confirm-overlay');
      if (ov) { ov.style.opacity='0'; ov.style.pointerEvents='none'; }
      var sh = document.getElementById('send-confirm-sheet');
      if (sh) sh.style.transform='translateY(100%)';
    });
    _attachBottomSwipe('currency-picker-sheet',function() { if (typeof closeCurrencyPicker     === 'function') closeCurrencyPicker(); });
    // hw-group-modal is now a right-side drawer — swipe right to close
    (function() {
      var el = document.getElementById('hw-group-modal');
      if (!el) return;
      var startX = 0, startY = 0, dragging = false;
      el.addEventListener('touchstart', function(e) {
        startX = e.touches[0].clientX; startY = e.touches[0].clientY; dragging = false;
      }, { passive: true });
      el.addEventListener('touchmove', function(e) {
        var dx = e.touches[0].clientX - startX;
        var dy = Math.abs(e.touches[0].clientY - startY);
        if (!dragging && Math.abs(dx) > 8 && dy < 12) dragging = true;
        if (dragging && dx > 0) {
          el.style.transition = 'none';
          el.style.transform = 'translateX(' + dx + 'px)';
        }
      }, { passive: true });
      el.addEventListener('touchend', function(e) {
        if (!dragging) return;
        var dx = e.changedTouches[0].clientX - startX;
        el.style.transition = '';
        if (dx > 60) {
          typeof hwCloseGroupPicker === 'function' && hwCloseGroupPicker();
        } else {
          el.style.transform = 'translateX(0)';
        }
        dragging = false;
      }, { passive: true });
    })();
    _attachBottomSwipe('tm-chain-modal',       function() {
      var ov = document.getElementById('tm-chain-overlay');
      if (ov) { ov.style.opacity='0'; ov.style.pointerEvents='none'; }
      var sh = document.getElementById('tm-chain-modal');
      if (sh) sh.style.transform='translateY(100%)';
    });

    // ── send-modal & hcp-modal (generic class-based bottom sheets) ──
    _attachBottomSwipeByClass('send-modal',  '');
    _attachBottomSwipeByClass('hcp-modal',   '');
    _attachBottomSwipeByClass('txh-modal',   '');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(_init, 500); });
  } else {
    setTimeout(_init, 500);
  }
})();

// Signing wallet panel (shared wallet drawer UI, single select): a group only expands,
// one wallet is picked as the swap signer.
function _swRenderWalletPanel() {
  const body   = document.getElementById('sw-wallet-panel-body');
  if (!body) return;
  const groups = (typeof loadWalletGroups === 'function') ? loadWalletGroups().filter(g => g && g.keys && g.keys.length > 0) : [];
  const active = (typeof SW !== 'undefined' && SW.walletAddress) ? String(SW.walletAddress).toLowerCase() : '';

  WDU.renderList(body, {
    mode: 'single',
    groups: groups,
    emptyHtml: '<div class="wdu-empty">No wallet groups<br><span style="font-size:11px;opacity:.6;">Add them in Settings \u2192 Wallet Groups</span></div>',
    isOpen: function(gi) { return gi === _swExpandedGroupIdx; },
    isKeySel: function(gi, ki) {
      return !!active && WDU.addressOf(groups[gi].keys[ki]).toLowerCase() === active;
    },
    onExpand: function(gi) {
      _swExpandedGroupIdx = (_swExpandedGroupIdx === gi) ? -1 : gi;
      _swRenderWalletPanel();
    },
    onKey: function(gi, ki) {
      const pk = groups[gi].keys[ki];
      const addr = WDU.addressOf(pk);
      if (!addr) return;
      _swSelectWalletFromPanel(pk, addr);
    }
  });
}
