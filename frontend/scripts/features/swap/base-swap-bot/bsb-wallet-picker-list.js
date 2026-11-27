// Base swap bot: wallet picker state, list rendering and textarea sync
// Part of the Base swap bot module (split by topic; no logic change).
(function (__NX) {
  __NX._bsbRenderList = _bsbRenderList;
  __NX._bsbSyncTextarea = _bsbSyncTextarea;


      // ── BSB Wallet Picker (right-side drawer) ──
      __NX._bsbPickerSelected = new Set();   // selected group indices
      __NX._bsbPickerExpanded = new Set();   // expanded group indices
      __NX._bsbPickerIndivSelected = new Set(); // "gi-ki" individual key selections

      // ── Render helper (shared wallet drawer UI, multi select) ──
      function _bsbRenderList() {
        var list = __NX.bsbGid('bsb-wallet-picker-list');
        if (!list) return;
        var groups = (typeof loadWalletGroups === 'function') ? loadWalletGroups() : [];
        groups = groups.filter(function(g) { return g && g.keys && g.keys.length > 0; });

        WDU.renderList(list, {
          mode: 'multi',
          groups: groups,
          emptyHtml: '<div class="wdu-empty">No wallet groups<br><span style="font-size:11px;opacity:.6;">Add them in Settings \u2192 Wallet Groups</span></div>',
          isOpen: function(gi) { return __NX._bsbPickerExpanded.has(gi); },
          isKeySel: function(gi, ki) { return __NX._bsbPickerIndivSelected.has(gi + '-' + ki); },
          onExpand: function(gi) { window.bsbPickerToggleExpand(gi); },
          onGroup: function(gi) { window.bsbPickerToggle(gi); },
          onKey: function(gi, ki) { window.bsbPickerToggleKey(gi, ki); }
        });
      }

      function _bsbSyncTextarea() {
        var groups = (typeof loadWalletGroups === 'function') ? loadWalletGroups() : [];
        groups = groups.filter(function(g) { return g && g.keys && g.keys.length > 0; });
        var allKeys = [];
        // Always use individual selection — group select/deselect syncs individual keys too
        var ordered = [];
        __NX._bsbPickerIndivSelected.forEach(function(key) {
          var parts = key.split('-');
          ordered.push({ gi: parseInt(parts[0]), ki: parseInt(parts[1]) });
        });
        ordered.sort(function(a,b) { return a.gi !== b.gi ? a.gi - b.gi : a.ki - b.ki; });
        ordered.forEach(function(o) {
          if (groups[o.gi] && groups[o.gi].keys[o.ki]) {
            var raw = (groups[o.gi].keys[o.ki] || '').trim();
            if (raw) allKeys.push(raw);
          }
        });
        var area = __NX.bsbGid('bsb-keys');
        if (area) area.value = allKeys.join('\n');
      }
})((window.__nxp = window.__nxp || {}).mod_base_swap_bot = window.__nxp.mod_base_swap_bot || {});
