
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
    var _sy = 0, _sx = 0, _prevY = 0, _prevT = 0;
    var _dragging = false;
    var _THRESHOLD = 75;
    var _VEL_THRESHOLD = 0.45; // px/ms

    var _SNAP_EASE  = 'transform 0.3s cubic-bezier(0.25,1,0.5,1)';
    var _CLOSE_EASE = 'transform 0.28s cubic-bezier(0.4,0,0.6,1)';

    function _isInsideScrollable(el) {
      while (el && el !== sheet) {
        var ov = window.getComputedStyle(el).overflowY;
        if ((ov === 'auto' || ov === 'scroll') && el.scrollHeight > el.clientHeight + 2) return true;
        el = el.parentElement;
      }
      return false;
    }

    sheet.addEventListener('touchstart', function(e) {
      if (e.touches.length !== 1) return;
      _sy = e.touches[0].clientY;
      _sx = e.touches[0].clientX;
      _prevY = _sy; _prevT = e.timeStamp;
      _dragging = false;
      if (_isInsideScrollable(e.target)) return;
      _dragging = true;
      sheet.style.transition = 'none';
    }, { passive: true });

    sheet.addEventListener('touchmove', function(e) {
      if (!_dragging || e.touches.length !== 1) return;
      var cy = e.touches[0].clientY;
      var dy = cy - _sy;
      var dx = Math.abs(e.touches[0].clientX - _sx);
      if (dx > 38) {
        _dragging = false;
        sheet.style.transition = _SNAP_EASE;
        sheet.style.transform = 'translateY(0)';
        return;
      }
      if (dy > 0) {
        // Rubber-band: slight resistance past 50% sheet height
        var h = sheet.offsetHeight || 400;
        var res = dy < h * 0.5 ? dy : h * 0.5 + (dy - h * 0.5) * 0.3;
        sheet.style.transform = 'translateY(' + res + 'px)';
      }
      _prevY = cy; _prevT = e.timeStamp;
    }, { passive: true });

    sheet.addEventListener('touchend', function(e) {
      if (!_dragging) return;
      _dragging = false;
      var cy = e.changedTouches[0] ? e.changedTouches[0].clientY : _sy;
      var dy = cy - _sy;
      var dt = e.timeStamp - _prevT;
      var vel = dt > 0 ? (cy - _prevY) / dt : 0;
      if (dy >= _THRESHOLD || vel >= _VEL_THRESHOLD) {
        sheet.style.transition = _CLOSE_EASE;
        sheet.style.transform = 'translateY(110%)';
        setTimeout(function() { sheet.style.transition = ''; closeFn(); }, 280);
      } else {
        sheet.style.transition = _SNAP_EASE;
        sheet.style.transform = 'translateY(0)';
        setTimeout(function() { sheet.style.transition = ''; }, 320);
      }
    }, { passive: true });

    sheet.addEventListener('touchcancel', function() {
      _dragging = false;
      sheet.style.transition = _SNAP_EASE;
      sheet.style.transform = 'translateY(0)';
      setTimeout(function() { sheet.style.transition = ''; }, 320);
    }, { passive: true });
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
    _attachBottomSwipe('sw-settings-sheet',    function() { if (typeof window.swCloseSettings  === 'function') window.swCloseSettings(); });
    _attachBottomSwipe('br-settings-sheet',    function() { if (typeof window.brCloseSettings  === 'function') window.brCloseSettings(); });
    _attachBottomSwipe('sw-history-sheet',     function() { if (typeof window.swCloseHistory   === 'function') window.swCloseHistory(); });
    _attachBottomSwipe('br-history-sheet',     function() { if (typeof window.brCloseHistory   === 'function') window.brCloseHistory(); });
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

function _swRenderWalletPanel() {
  const body   = document.getElementById('sw-wallet-panel-body');
  const groups = (typeof loadWalletGroups === 'function') ? loadWalletGroups().filter(g => g && g.keys && g.keys.length > 0) : [];
  if (body) body.innerHTML = '';

  if (!groups.length) {
    if (body) body.innerHTML = '<div style="text-align:center;padding:24px 12px;font-family:var(--font-mono);font-size:11px;color:var(--text-muted);line-height:1.8;">No wallet groups.<br>Go to Settings → Wallet Groups.</div>';
    return;
  }

  groups.forEach(function(g, gi) {
    const isExpanded = gi === _swExpandedGroupIdx;

    const ghdr = document.createElement('div');
    ghdr.style.cssText = isExpanded
      ? 'display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:12px;margin-bottom:4px;cursor:pointer;border:1px solid rgba(99,102,241,0.55);background:linear-gradient(120deg,rgba(99,102,241,0.18) 0%,rgba(139,92,246,0.13) 100%);box-shadow:0 0 18px rgba(99,102,241,0.18),inset 0 1px 0 rgba(255,255,255,0.06);transition:all 0.22s;'
      : 'display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:12px;margin-bottom:4px;cursor:pointer;border:1px solid var(--border-subtle);background:var(--bg-glass);transition:all 0.22s;';
    ghdr.innerHTML = isExpanded
      ? '<span class="material-icons-round" style="font-size:15px;color:#a78bfa;filter:drop-shadow(0 0 4px rgba(167,139,250,0.6));">bolt</span>' +
        '<div style="flex:1;">' +
          '<div style="font-size:11px;font-weight:800;letter-spacing:0.5px;background:linear-gradient(90deg,#a78bfa,#6366f1);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">' + g.name.toUpperCase() + '</div>' +
          '<div style="font-size:8px;font-family:var(--font-mono);color:rgba(167,139,250,0.6);margin-top:1px;letter-spacing:1px;">' + g.keys.length + ' KEYS</div>' +
        '</div>' +
        '<span class="material-icons-round" style="font-size:15px;color:#a78bfa;transform:rotate(180deg);transition:transform 0.25s;">expand_more</span>'
      : '<span class="material-icons-round" style="font-size:15px;color:var(--text-muted);">folder</span>' +
        '<div style="flex:1;">' +
          '<div style="font-size:11px;font-weight:700;color:var(--text-secondary);">' + g.name + '</div>' +
          '<div style="font-size:8px;font-family:var(--font-mono);color:var(--text-muted);margin-top:1px;letter-spacing:1px;">' + g.keys.length + ' KEYS</div>' +
        '</div>' +
        '<span class="material-icons-round" style="font-size:15px;color:var(--text-muted);transform:rotate(0deg);transition:transform 0.25s;">expand_more</span>';

    ghdr.addEventListener('click', function(e) {
      e.stopPropagation();
      _swExpandedGroupIdx = isExpanded ? -1 : gi;
      _swRenderWalletPanel();
    });
    if (body) body.appendChild(ghdr);

    if (!isExpanded) return;

    const itemsWrap = document.createElement('div');
    itemsWrap.style.cssText = 'padding:3px 2px 10px;display:flex;flex-direction:column;gap:5px;margin-left:20%;';

    g.keys.forEach(function(pk, wi) {
      let addr = null;
      try { const n = pk.startsWith('0x') ? pk : '0x' + pk; addr = new ethers.Wallet(n).address; } catch(_) {}
      if (!addr) return;

      const isActive = SW.walletAddress === addr;

      // ── Outer card ──
      const item = document.createElement('div');
      item.style.cssText = isActive
        ? 'position:relative;display:flex;align-items:stretch;border-radius:10px;border:1px solid rgba(99,102,241,0.5);background:linear-gradient(120deg,rgba(99,102,241,0.16) 0%,rgba(139,92,246,0.10) 100%);box-shadow:0 0 12px rgba(99,102,241,0.13),inset 0 1px 0 rgba(255,255,255,0.07);cursor:pointer;transition:all 0.18s;overflow:hidden;width:100%;box-sizing:border-box;'
        : 'position:relative;display:flex;align-items:stretch;border-radius:10px;border:1px solid rgba(255,255,255,0.07);background:rgba(255,255,255,0.03);cursor:pointer;transition:all 0.18s;overflow:hidden;width:100%;box-sizing:border-box;';

      // shimmer top line
      const shimmer = document.createElement('div');
      shimmer.style.cssText = 'position:absolute;top:0;left:0;right:0;height:1px;background:' + (isActive ? 'linear-gradient(90deg,transparent,rgba(167,139,250,0.5),transparent)' : 'linear-gradient(90deg,transparent,rgba(255,255,255,0.07),transparent)') + ';pointer-events:none;';
      item.appendChild(shimmer);

      // ── LEFT — number pill (fixed 28px) ──
      const leftCol = document.createElement('div');
      leftCol.style.cssText = 'width:28px;flex-shrink:0;display:flex;align-items:center;justify-content:center;border-right:1px solid ' + (isActive ? 'rgba(99,102,241,0.22)' : 'rgba(255,255,255,0.06)') + ';';

      const walletNum = document.createElement('div');
      walletNum.style.cssText = isActive
        ? 'font-size:9px;font-weight:800;font-family:var(--font-mono);background:linear-gradient(135deg,#a78bfa,#6366f1);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;line-height:1;'
        : 'font-size:9px;font-weight:700;font-family:var(--font-mono);color:rgba(255,255,255,0.25);line-height:1;';
      walletNum.textContent = String(wi + 1).padStart(2, '0');
      leftCol.appendChild(walletNum);

      // ── RIGHT — address + indicator ──
      const rightCol = document.createElement('div');
      rightCol.style.cssText = 'flex:1;display:flex;align-items:center;justify-content:space-between;padding:8px 10px;min-width:0;';

      const info = document.createElement('div');
      info.style.cssText = 'min-width:0;';
      info.innerHTML = isActive
        ? '<div style="font-family:var(--font-mono);font-size:11px;font-weight:700;letter-spacing:0.4px;background:linear-gradient(90deg,#a78bfa,#818cf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">' + addr.slice(0,6) + '…' + addr.slice(-4) + '</div>'
        : '<div style="font-family:var(--font-mono);font-size:11px;font-weight:500;color:rgba(241,241,248,0.65);letter-spacing:0.4px;">' + addr.slice(0,6) + '…' + addr.slice(-4) + '</div>';

      const right = document.createElement('div');
      right.style.cssText = 'flex-shrink:0;display:flex;align-items:center;margin-left:6px;';
      right.innerHTML = isActive
        ? '<span class="material-icons-round" style="font-size:14px;color:#a78bfa;filter:drop-shadow(0 0 4px rgba(167,139,250,0.65));">check_circle</span>'
        : '<div style="width:12px;height:12px;border-radius:50%;border:1.5px solid rgba(255,255,255,0.13);"></div>';

      rightCol.appendChild(info);
      rightCol.appendChild(right);
      item.appendChild(leftCol);
      item.appendChild(rightCol);

      item.addEventListener('mouseenter', function() {
        if (!isActive) { item.style.background = 'rgba(99,102,241,0.07)'; item.style.borderColor = 'rgba(99,102,241,0.2)'; }
      });
      item.addEventListener('mouseleave', function() {
        if (!isActive) { item.style.background = 'rgba(255,255,255,0.03)'; item.style.borderColor = 'rgba(255,255,255,0.07)'; }
      });
      item.addEventListener('click', function(e) {
        e.stopPropagation();
        _swSelectWalletFromPanel(pk, addr);
      });
      itemsWrap.appendChild(item);
    });

    if (body) body.appendChild(itemsWrap);
  });
}
