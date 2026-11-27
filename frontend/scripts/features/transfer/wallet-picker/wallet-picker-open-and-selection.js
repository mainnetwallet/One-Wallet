  // ── Open ──
  window.thOpenWalletPicker = function(targetId, mode) {
    _thPickerTargetId      = targetId || '';
    _thPickerMode          = mode     || 'multi';
    _thPickerSelected      = new Set();
    _thPickerIndivSelected = new Set();
    _thPickerExpanded      = new Set();

    var overlay = thGid('th-wallet-picker-overlay');
    if (!overlay) return;

    // Update mode badge
    var badge = thGid('th-picker-mode-badge');
    if (badge) {
      var labels = { single: 'SINGLE KEY', multi: 'MULTI KEY', address: 'ADDRESS', addresses: 'ADDRESSES' };
      badge.textContent = labels[_thPickerMode] || _thPickerMode.toUpperCase();
    }

    // In single/address mode: hide Select All + Apply (key tap auto-closes)
    // 'addresses' mode = multi-select writing addresses → show Select All + Apply
    var isSA = (_thPickerMode === 'single' || _thPickerMode === 'address');
    var selectAllBtn = thGid('th-picker-mode-badge') && thGid('th-picker-mode-badge').parentNode
      ? thGid('th-picker-mode-badge').parentNode.querySelector('button[onclick*="thPickerSelectAll"]')
      : null;
    if (selectAllBtn) selectAllBtn.style.display = isSA ? 'none' : '';
    var applyBtn = thGid('th-picker-apply-btn');
    if (applyBtn) applyBtn.parentNode.style.display = isSA ? 'none' : '';
    var subtitle = thGid('th-picker-subtitle');
    if (subtitle) subtitle.textContent = isSA
      ? 'Group expand করুন → Key tap করুন'
      : (_thPickerMode === 'addresses'
          ? 'Group select করুন → Addresses field-এ load হবে'
          : 'Select করুন → Field-এ load হবে');

    // Animate in
    overlay.style.display = 'block';
    overlay.style.background = 'rgba(5,5,8,0)';
    overlay.style.backdropFilter = 'blur(0px)';
    var drawer = thGid('th-wallet-picker-drawer');
    if (drawer) drawer.style.transform = 'translateX(100%)';
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        overlay.style.background = 'rgba(5,5,8,0.75)';
        overlay.style.backdropFilter = 'blur(4px)';
        if (drawer) drawer.style.transform = 'translateX(0)';
      });
    });

    // Pre-select groups already loaded into the target field
    var existingKeys = new Set();
    var target = thGid(_thPickerTargetId);
    if (target && target.value && target.value.trim()) {
      target.value.trim().split('\n').forEach(function(k) {
        var t = k.trim(); if (t) existingKeys.add(t.toLowerCase());
      });
    }
    var groups = thGetGroups();
    groups.forEach(function(g, i) {
      if (!g.keys || !g.keys.length) return;
      // Bug fix: existingKeys empty থাকলে কোনো group pre-select করবে না
      if (existingKeys.size === 0) return;
      var allMatch;
      if (_thPickerMode === 'addresses') {
        // Field has addresses, so convert group keys to addresses for comparison
        allMatch = g.keys.every(function(pk) {
          try { return existingKeys.has(_thKeyToAddress((pk||'').trim()).toLowerCase()); } catch(_) { return false; }
        });
      } else {
        allMatch = g.keys.every(function(pk) { return existingKeys.has((pk||'').trim().toLowerCase()); });
      }
      if (allMatch) {
        _thPickerSelected.add(i);
        g.keys.forEach(function(_, ki) { _thPickerIndivSelected.add(i + '-' + ki); });
      }
    });

    _thRenderList();
  };

  // ── Toggle expand/collapse a group ──
  window.thPickerToggleExpand = function(idx) {
    if (_thPickerExpanded.has(idx)) {
      _thPickerExpanded.delete(idx);
    } else {
      _thPickerExpanded.add(idx);
    }
    _thRenderList();
  };

  // ── Toggle an individual key inside a group ──
  window.thPickerToggleKey = function(gi, ki) {
    var indivKey = gi + '-' + ki;
    var groups   = thGetGroups();
    var g        = groups[gi];
    if (!g) return;

    // In single mode: clear everything else first
    if (_thPickerMode === 'single') {
      _thPickerSelected      = new Set();
      _thPickerIndivSelected = new Set();
    }

    if (_thPickerIndivSelected.has(indivKey)) {
      _thPickerIndivSelected.delete(indivKey);
    } else {
      _thPickerIndivSelected.add(indivKey);
    }

    // Keep group-level checkbox in sync:
    // selected if ALL keys of that group are individually selected
    var allSelected = g.keys.every(function(_, k) { return _thPickerIndivSelected.has(gi + '-' + k); });
    if (allSelected) { _thPickerSelected.add(gi); } else { _thPickerSelected.delete(gi); }

    _thRenderList();
    _thSyncToField();
  };

  // ── Select single key in single/address mode → write to field + close ──
  window.thPickerSelectSingle = function(gi, ki) {
    var groups = thGetGroups();
    var g      = groups[gi];
    if (!g || !g.keys[ki]) return;
    _thPickerSelected      = new Set();
    _thPickerIndivSelected = new Set();
    _thPickerIndivSelected.add(gi + '-' + ki);
    _thPickerSelected.add(gi);
    // Bug fix: 'address' mode-এ raw private key না দিয়ে address derive করো
    var target = thGid(_thPickerTargetId);
    if (target) {
      var raw = (g.keys[ki] || '').trim();
      if (_thPickerMode === 'address') {
        target.value = _thKeyToAddress(raw);
      } else {
        target.value = raw;
      }
      // KEY FIX: JS .value set-এ oninput trigger হয় না — manually dispatch করো
      try {
        // Also write directly to actualKeysStorage for password fields
        if (window.actualKeysStorage && _thPickerTargetId && window.actualKeysStorage.hasOwnProperty(_thPickerTargetId)) {
          window.actualKeysStorage[_thPickerTargetId] = target.value;
        }
      } catch(_ks) {}
      try {
        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
      } catch(_e) {}
      
      // Extra fix: directly call balance update functions based on target field ID
      setTimeout(function() {
        try {
          if (_thPickerTargetId === 'privateKeyMultiKeyNative' && typeof updateDeveloperWalletMultiKeyNative === 'function') {
            updateDeveloperWalletMultiKeyNative();
            if (typeof updateButtonStates === 'function') updateButtonStates();
          } else if (_thPickerTargetId === 'senderPrivateKeysMultiKeyNative') {
            if (typeof updateButtonStates === 'function') updateButtonStates();
          } else if (_thPickerTargetId === 'recipientAddressMultiKeyNative' && typeof updateMultiKeyNativeRecipientBalance === 'function') {
            updateMultiKeyNativeRecipientBalance();
            if (typeof updateButtonStates === 'function') updateButtonStates();
          } else if (_thPickerTargetId === 'privateKey' && typeof window.checkBatchNativeWallet === 'function') {
            window.checkBatchNativeWallet();
          } else if (_thPickerTargetId === 'privateKeyToken') {
            // Trigger token wallet check — dispatch input event so listener picks up actualKeysStorage
            var _tkField = document.getElementById('privateKeyToken');
            if (_tkField) {
              _tkField.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }
        } catch(_e2) {}
      }, 150);
    }
    thCloseWalletPicker();
  };

  // ── Toggle a whole group row ──
  window.thPickerToggle = function(idx) {
    var groups = thGetGroups();
    var g      = groups[idx];
    if (!g) return;

    if (_thPickerMode === 'single') {
      // Clear all selections first
      _thPickerSelected      = new Set();
      _thPickerIndivSelected = new Set();
      // Select only the first key of this group as individual
      _thPickerIndivSelected.add(idx + '-0');
      _thPickerSelected.add(idx);
    } else {
      if (_thPickerSelected.has(idx)) {
        // Deselect group + all its individual keys
        _thPickerSelected.delete(idx);
        g.keys.forEach(function(_, ki) { _thPickerIndivSelected.delete(idx + '-' + ki); });
      } else {
        // Select group + all its individual keys
        _thPickerSelected.add(idx);
        g.keys.forEach(function(_, ki) { _thPickerIndivSelected.add(idx + '-' + ki); });
      }
    }

    _thRenderList();
    _thSyncToField();
  };

  // ── Select All / Deselect All ──
  window.thPickerSelectAll = function() {
    var groups     = thGetGroups();
    var allSelected = _thPickerSelected.size === groups.length;
    if (allSelected) {
      _thPickerSelected      = new Set();
      _thPickerIndivSelected = new Set();
    } else {
      groups.forEach(function(g, i) {
        _thPickerSelected.add(i);
        g.keys.forEach(function(_, ki) { _thPickerIndivSelected.add(i + '-' + ki); });
      });
    }
    _thRenderList();
    _thSyncToField();
  };

  // ── Apply ──
  window.thApplyWalletPicker = function() {
    _thSyncToField();
    thCloseWalletPicker();
  };

  // ── Close ──
  window.thCloseWalletPicker = function() {
    var overlay = thGid('th-wallet-picker-overlay');
    if (!overlay) return;
    var drawer = thGid('th-wallet-picker-drawer');
    overlay.style.background = 'rgba(5,5,8,0)';
    overlay.style.backdropFilter = 'blur(0px)';
    if (drawer) drawer.style.transform = 'translateX(100%)';
    setTimeout(function() { overlay.style.display = 'none'; }, 320);
  };

