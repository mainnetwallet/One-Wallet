
  // ══════════════════════════════════════════════════════
  // BACKGROUND TX PILL — swap/bridge background progress
  // ══════════════════════════════════════════════════════
  (function() {
    var pill      = document.getElementById('bg-tx-pill');
    var pillLabel = document.getElementById('bgp-label');
    // Track which page the active bg task is on
    var _bgActivePage = null;
    var _bgNavDots = {};     // navItemId → dot element
    var _bgPollTimer = null;

    // BG_TASKS: page → { label, running }
    // These mirror window.swRunning / window.brRunning
    var BG_TASKS = {
      'swap':   { label: 'Swap processing…',   running: function() { return !!window.swRunning; },   navId: 'nav-swap' },
      'bridge': { label: function() { return window.brIsSameChain ? 'Swap processing…' : 'Bridge processing…'; }, running: function() { return !!window.brRunning; }, navId: 'nav-bridge' },
    };

    // Show pill for a given page
    function _showPill(page) {
      var task = BG_TASKS[page];
      if (!task || !pill) return;
      if (pillLabel) pillLabel.textContent = typeof task.label === 'function' ? task.label() : task.label;
      _bgActivePage = page;
      pill.style.display = 'flex';
      requestAnimationFrame(function() {
        requestAnimationFrame(function() { pill.classList.add('bgp-visible'); });
      });
      // Add nav dot to the relevant nav item
      _addNavDot(task.navId);
    }

    // Hide pill
    function _hidePill() {
      if (!pill) return;
      pill.classList.remove('bgp-visible');
      setTimeout(function() {
        if (!pill.classList.contains('bgp-visible')) pill.style.display = 'none';
      }, 350);
      _bgActivePage = null;
      _removeAllNavDots();
    }

    // Add pulsing dot badge on nav item
    function _addNavDot(navId) {
      if (!navId) return;
      if (_bgNavDots[navId]) return; // already there
      var navEl = document.getElementById(navId);
      if (!navEl) return;
      navEl.style.position = 'relative';
      var dot = document.createElement('div');
      dot.className = 'bgp-nav-dot';
      navEl.appendChild(dot);
      _bgNavDots[navId] = dot;
    }

    // Remove all nav dots
    function _removeAllNavDots() {
      Object.keys(_bgNavDots).forEach(function(id) {
        var dot = _bgNavDots[id];
        if (dot && dot.parentNode) dot.parentNode.removeChild(dot);
      });
      _bgNavDots = {};
    }

    // Core update function — called on page change and polled
    window._bgPillUpdate = function() {
      var currentPg = window.currentPage || 'home';

      // Check if any bg task is running
      var activePage = null;
      Object.keys(BG_TASKS).forEach(function(pg) {
        if (BG_TASKS[pg].running()) activePage = pg;
      });

      if (activePage && currentPg !== activePage) {
        // Task running, user is on different page → show pill
        if (!pill.classList.contains('bgp-visible')) {
          _showPill(activePage);
        } else if (_bgActivePage !== activePage) {
          // Task changed (unlikely but handle it)
          _showPill(activePage);
        }
        // Start polling
        _startPoll();
      } else {
        // No task, or user is already on the task page → hide pill
        _hidePill();
        _stopPoll();
      }
    };

    // Tap pill → navigate to the processing page
    window._bgPillTap = function() {
      if (_bgActivePage && typeof window.switchPage === 'function') {
        window.switchPage(_bgActivePage);
      }
    };

    // Poll every 800ms to auto-hide when task finishes
    function _startPoll() {
      if (_bgPollTimer) return;
      _bgPollTimer = setInterval(function() {
        window._bgPillUpdate();
      }, 800);
    }
    function _stopPoll() {
      if (_bgPollTimer) { clearInterval(_bgPollTimer); _bgPollTimer = null; }
    }

    // Patch switchPage to trigger pill update on every navigation
    var _pillOrigSP = window.switchPage;
    if (typeof _pillOrigSP === 'function') {
      window.switchPage = function(page) {
        var result = _pillOrigSP.apply(this, arguments);
        // Delay slightly so currentPage has updated
        setTimeout(window._bgPillUpdate, 50);
        return result;
      };
    } else {
      // switchPage not yet defined — patch after DOM ready
      document.addEventListener('DOMContentLoaded', function() {
        var _sp = window.switchPage;
        if (typeof _sp === 'function') {
          window.switchPage = function(page) {
            var result = _sp.apply(this, arguments);
            setTimeout(window._bgPillUpdate, 50);
            return result;
          };
        }
      });
    }

    // Initial update
    setTimeout(window._bgPillUpdate, 500);
  })();
  