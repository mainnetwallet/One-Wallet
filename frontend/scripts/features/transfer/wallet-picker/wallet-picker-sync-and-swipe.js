  // ── Internal: write selected keys/addresses into the target field ──
  function _thKeyToAddress(pk) {
    var t = (pk || '').trim();
    // Already an address — return as-is
    try { if (ethers.isAddress(t)) return ethers.getAddress(t); } catch(_) {}
    // Private key — derive address
    try { return new ethers.Wallet(t).address; } catch(_) {}
    return t; // fallback: return raw
  }

  function _thSyncToField() {
    var groups = thGetGroups();
    var values = [];
    var isAddrMode = (_thPickerMode === 'address' || _thPickerMode === 'addresses');
    if (_thPickerMode === 'single') {
      var done = false;
      _thPickerIndivSelected.forEach(function(key) {
        if (done) return;
        var parts = key.split('-');
        var gi = parseInt(parts[0], 10); var ki = parseInt(parts[1], 10);
        // Bug fix: NaN guard — invalid index の場合はskip
        if (isNaN(gi) || isNaN(ki)) return;
        if (groups[gi] && groups[gi].keys[ki]) {
          var raw = (groups[gi].keys[ki] || '').trim();
          values.push(raw);
          done = true;
        }
      });
    } else {
      if (_thPickerIndivSelected.size > 0) {
        var ordered = [];
        _thPickerIndivSelected.forEach(function(key) {
          var parts = key.split('-');
          var gi = parseInt(parts[0], 10); var ki = parseInt(parts[1], 10);
          // Bug fix: NaN guard
          if (isNaN(gi) || isNaN(ki)) return;
          ordered.push({ gi: gi, ki: ki });
        });
        ordered.sort(function(a, b) { return a.gi !== b.gi ? a.gi - b.gi : a.ki - b.ki; });
        ordered.forEach(function(o) {
          if (groups[o.gi] && groups[o.gi].keys[o.ki]) {
            var raw = (groups[o.gi].keys[o.ki] || '').trim();
            if (raw) values.push(isAddrMode ? _thKeyToAddress(raw) : raw);
          }
        });
      } else {
        _thPickerSelected.forEach(function(i) {
          if (!groups[i] || !groups[i].keys) return;
          groups[i].keys.forEach(function(pk) {
            var raw = (pk || '').trim();
            if (raw) values.push(isAddrMode ? _thKeyToAddress(raw) : raw);
          });
        });
      }
    }
    var target = thGid(_thPickerTargetId);
    if (!target) return;
    if (_thPickerMode === 'single') {
      // Bug fix: values[0] undefined হলে '' দাও, "undefined" string এড়াতে
      target.value = (values[0] !== undefined && values[0] !== null) ? values[0] : '';
    } else {
      target.value = values.join('\n');
    }
    // Also write directly to actualKeysStorage for password fields
    try {
      if (window.actualKeysStorage && _thPickerTargetId && window.actualKeysStorage.hasOwnProperty(_thPickerTargetId)) {
        window.actualKeysStorage[_thPickerTargetId] = target.value;
      }
    } catch(_ks) {}
    // KEY FIX: input + change event dispatch — JS .value set-এ browser নিজে
    // oninput trigger করে না, তাই manually fire করতে হবে
    try {
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
    } catch(_e) {}
  }

  // ── Right-swipe to close ──
  (function() {
    var attached = false;
    var _origOpen = window.thOpenWalletPicker;
    window.thOpenWalletPicker = function() {
      _origOpen.apply(this, arguments);
      if (attached) return;
      attached = true;
      var drawer = document.getElementById('th-wallet-picker-drawer');
      if (!drawer) return;
      var startX = 0, startY = 0, tracking = false, swiping = false;
      drawer.addEventListener('touchstart', function(e) {
        startX = e.touches[0].clientX; startY = e.touches[0].clientY;
        tracking = true; swiping = false;
      }, { passive: true });
      drawer.addEventListener('touchmove', function(e) {
        if (!tracking) return;
        var dx = e.touches[0].clientX - startX;
        var dy = Math.abs(e.touches[0].clientY - startY);
        if (!swiping && Math.abs(dx) > 8) {
          if (Math.abs(dx) > dy) { swiping = true; } else { tracking = false; return; }
        }
        if (swiping && dx > 0) { drawer.style.transition = 'none'; drawer.style.transform = 'translateX(' + dx + 'px)'; }
      }, { passive: true });
      drawer.addEventListener('touchend', function(e) {
        if (!swiping) { tracking = false; return; }
        var dx = e.changedTouches[0].clientX - startX;
        drawer.style.transition = '';
        if (dx > 72) { window.thCloseWalletPicker && window.thCloseWalletPicker(); }
        else { drawer.style.transform = 'translateX(0)'; }
        tracking = false; swiping = false;
      }, { passive: true });
    };
  })();
  