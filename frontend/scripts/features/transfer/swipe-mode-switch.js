
// ══════════════════════════════════════════════════════
// TRANSFER HUB — SWIPE TO SWITCH MODE
// Batch Transfer: Native→Token = swipe left→right, Token→Native = swipe right→left
//   (the Native/Token thumb follows the finger while dragging)
// Other sections: Left→Right : first mode, Right→Left : next mode
// Axis-lock: horizontal swipe only (vertical scroll preserved)
// ══════════════════════════════════════════════════════
(function() {
  var SWIPE_THRESHOLD    = 100; // px — switch fires here
  var SWIPE_AXIS_LOCK    = 40;  // px — axis decided after this
  var SWIPE_MAX_VERTICAL = 100; // px — cancel if too vertical

  var sections = [
    {
      id: 'batchTransferUI',
      modes: ['native', 'token'],
      reverse: true,   // left→right = token, right→left = native (no wrap-around)
      threshold: 64,
      switcher: function(m) { if (typeof switchBatchMode === 'function') switchBatchMode(m); },
      getCurrent: function() {
        var btn = document.getElementById('nativeModeBtn');
        return (btn && btn.classList.contains('active')) ? 'native' : 'token';
      },
      getButtons: function(dir) {
        return dir < 0
          ? document.getElementById('tokenModeBtn')
          : document.getElementById('nativeModeBtn');
      }
    },
    {
      id: 'multiKeyNativeUI',
      modes: ['native', 'token'],
      switcher: function(m) { if (typeof switchMultiKeyMode === 'function') switchMultiKeyMode(m); },
      getCurrent: function() {
        var btn = document.getElementById('multiKeyNativeModeBtn');
        return (btn && btn.classList.contains('active')) ? 'native' : 'token';
      },
      getButtons: function(dir) {
        return dir < 0
          ? document.getElementById('multiKeyTokenModeBtn')
          : document.getElementById('multiKeyNativeModeBtn');
      }
    },
    {
      id: 'nftTransferUI',
      modes: ['distribute', 'collect'],
      switcher: function(m) { if (typeof selectNftTransferMode === 'function') selectNftTransferMode(m); },
      getCurrent: function() {
        var sec = document.getElementById('nftDistributeSection');
        return (sec && sec.style.display !== 'none') ? 'distribute' : 'collect';
      },
      getButtons: function(dir) { return null; }
    },
    {
      id: 'selfTransferUI',
      modes: ['native', 'token'],
      switcher: function(m) { if (typeof switchSelfTransferMode === 'function') switchSelfTransferMode(m); },
      getCurrent: function() {
        var btn = document.getElementById('selfNativeModeBtn');
        return (btn && btn.classList.contains('active')) ? 'native' : 'token';
      },
      getButtons: function(dir) {
        return dir < 0
          ? document.getElementById('selfTokenModeBtn')
          : document.getElementById('selfNativeModeBtn');
      }
    },
    {
      id: 'walletToWalletUI',
      modes: ['native', 'token'],
      switcher: function(m) { if (typeof selectW2WMode === 'function') selectW2WMode(m); },
      getCurrent: function() {
        var btn = document.getElementById('w2wNativeModeBtn');
        return (btn && btn.classList.contains('active')) ? 'native' : 'token';
      },
      getButtons: function(dir) {
        return dir < 0
          ? document.getElementById('w2wTokenModeBtn')
          : document.getElementById('w2wNativeModeBtn');
      }
    },
    {
      id: 'phraseToKeyUI',
      modes: ['phrase', 'keyToAddress'],
      switcher: function(m) { if (typeof switchKeyToolMode === 'function') switchKeyToolMode(m); },
      getCurrent: function() {
        var btn = document.getElementById('phraseModeBtn');
        return (btn && btn.classList.contains('active')) ? 'phrase' : 'keyToAddress';
      },
      getButtons: function(dir) { return null; }
    }
  ];

  function attachSwipe(section) {
    var el = document.getElementById(section.id);
    if (!el) return;

    var startX = 0, startY = 0;
    var axis = null;       // 'h' | 'v' | null
    var _hintBtn = null;
    var threshold = section.threshold || SWIPE_THRESHOLD;

    // reverse sections: the mode a swipe of this sign would switch to (or null at the ends)
    function targetFor(dx) {
      var modes = section.modes, idx = modes.indexOf(section.getCurrent());
      var next = dx > 0 ? idx + 1 : idx - 1;
      return (next >= 0 && next < modes.length) ? modes[next] : null;
    }

    // Batch thumb follows the finger (0 = Native side, 1 = Token side)
    function dragThumb(dx) {
      var seg = el.querySelector('.bt-seg');
      if (!seg) return;
      var modes = section.modes, idx = modes.indexOf(section.getCurrent());
      var p = Math.min(1, Math.abs(dx) / (threshold * 1.4));
      var allowed = targetFor(dx) !== null;
      var pos = idx + (allowed ? (dx > 0 ? p : -p) : 0);
      seg.classList.add('bt-dragging');
      seg.style.setProperty('--bt-p', String(Math.max(0, Math.min(1, pos))));
    }
    function endDragThumb() {
      var seg = el.querySelector('.bt-seg');
      if (!seg) return;
      seg.classList.remove('bt-dragging');
      seg.style.removeProperty('--bt-p');
    }

    function clearHint() {
      if (_hintBtn) {
        _hintBtn.style.transition = 'all 0.3s';
        _hintBtn.style.opacity = '';
        _hintBtn.style.transform = '';
        _hintBtn.style.boxShadow = '';
        _hintBtn = null;
      }
    }

    function applyHint(btn, progress) {
      if (!btn) return;
      _hintBtn = btn;
      btn.style.transition = 'none';
      btn.style.opacity = String(0.55 + progress * 0.45);
      btn.style.transform = 'scale(' + (1 + progress * 0.07) + ')';
      btn.style.boxShadow = 'inset 0 0 0 ' + Math.round(progress * 2) + 'px rgba(102,126,234,0.7)';
    }

    // passive:true on touchstart — never blocks scroll
    el.addEventListener('touchstart', function(e) {
      var t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      axis = null;
      clearHint();
    }, { passive: true });

    // passive:false on touchmove so we can preventDefault when horizontal
    el.addEventListener('touchmove', function(e) {
      var t = e.touches[0];
      var dx = t.clientX - startX;
      var dy = t.clientY - startY;
      var adx = Math.abs(dx);
      var ady = Math.abs(dy);

      // Decide axis once movement exceeds lock threshold
      if (axis === null && (adx > SWIPE_AXIS_LOCK || ady > SWIPE_AXIS_LOCK)) {
        axis = adx >= ady ? 'h' : 'v';
      }

      if (axis === 'v') { clearHint(); if (section.reverse) endDragThumb(); return; }
      if (axis !== 'h') return;

      // Horizontal — prevent page scroll while swiping
      e.preventDefault();

      if (section.reverse) { dragThumb(dx); return; }

      // Visual hint on mode button
      var progress = Math.min(1, Math.max(0, (adx - 40) / (SWIPE_THRESHOLD - 40)));
      var btn = section.getButtons ? section.getButtons(dx) : null;
      if (btn) applyHint(btn, progress);

    }, { passive: false });

    el.addEventListener('touchend', function(e) {
      var t = e.changedTouches[0];
      var dx = t.clientX - startX;
      var dy = t.clientY - startY;
      var savedAxis = axis;

      axis = null;
      clearHint();
      if (section.reverse) endDragThumb();

      // Only fire when axis was confirmed horizontal
      if (savedAxis !== 'h') return;
      if (Math.abs(dx) < threshold) return;
      if (Math.abs(dy) > SWIPE_MAX_VERTICAL) return;

      if (section.reverse) {
        var target = targetFor(dx);
        if (!target) return;
        // Content follows the finger: swiping →  brings the new mode in from the left
        window._btSlideDir = dx > 0 ? 'left' : 'right';
        section.switcher(target);
        return;
      }

      var modes   = section.modes;
      var current = section.getCurrent();
      var idx     = modes.indexOf(current);

      if (dx < 0) {
        // Right→Left swipe → next mode (token)
        section.switcher(modes[(idx + 1) % modes.length]);
      } else {
        // Left→Right swipe → previous mode (native)
        section.switcher(modes[(idx - 1 + modes.length) % modes.length]);
      }
    }, { passive: true });

    el.addEventListener('touchcancel', function() {
      axis = null;
      clearHint();
      if (section.reverse) endDragThumb();
    }, { passive: true });
  }

  function init() {
    sections.forEach(function(s) { attachSwipe(s); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(init, 600); });
  } else {
    setTimeout(init, 600);
  }
})();
