// Base swap bot: wallet picker state, list rendering and textarea sync
// Part of the Base swap bot module (split by topic; no logic change).
(function (__NX) {
  __NX._bsbRenderList = _bsbRenderList;
  __NX._bsbSyncTextarea = _bsbSyncTextarea;


      // ── BSB Wallet Picker (right-side drawer) ──
      __NX._bsbPickerSelected = new Set();   // selected group indices
      __NX._bsbPickerExpanded = new Set();   // expanded group indices
      __NX._bsbPickerIndivSelected = new Set(); // "gi-ki" individual key selections

      // ── Render helper ──
      function _bsbRenderList() {
        var list = __NX.bsbGid('bsb-wallet-picker-list');
        var groups = (typeof loadWalletGroups === 'function') ? loadWalletGroups() : [];
        groups = groups.filter(function(g) { return g && g.keys && g.keys.length > 0; });
        if (!list) return;

        if (!groups.length) {
          list.innerHTML = '<div style="text-align:center;padding:40px 16px;color:var(--text-muted);font-family:var(--font-mono);font-size:11px;line-height:1.8;">কোনো wallet group নেই।<br>Settings → Wallet Groups-এ add করুন।</div>';
          return;
        }

        var colors = [
          {accent:'#6366f1',border:'rgba(99,102,241,.3)',bg:'rgba(99,102,241,.08)'},
          {accent:'#0ab87a',border:'rgba(10,184,122,.3)',bg:'rgba(10,184,122,.08)'},
          {accent:'#f43f5e',border:'rgba(244,63,94,.3)',bg:'rgba(244,63,94,.08)'},
          {accent:'#f59e0b',border:'rgba(245,158,11,.3)',bg:'rgba(245,158,11,.08)'},
          {accent:'#06b6d4',border:'rgba(6,182,212,.3)',bg:'rgba(6,182,212,.08)'},
        ];

        list.innerHTML = groups.map(function(g, i) {
          var clr      = colors[i % colors.length];
          var sel      = __NX._bsbPickerSelected.has(i);
          var expanded = __NX._bsbPickerExpanded.has(i);
          var selInGroup = g.keys.filter(function(_, ki) { return __NX._bsbPickerIndivSelected.has(i+'-'+ki); }).length;
          var allIndivSel = selInGroup === g.keys.length && g.keys.length > 0;
          var someIndivSel = selInGroup > 0 && !allIndivSel;

          // Group header
          var card = '<div style="border:2px solid ' + (sel ? 'rgba(59,130,246,.5)' : 'var(--border-subtle)') + ';border-radius:12px;transition:border-color .18s;background:' + (sel ? 'rgba(59,130,246,.04)' : '') + ';" id="bsb-picker-card-' + i + '">'
            + '<div style="display:flex;gap:10px;align-items:center;padding:11px 12px;cursor:pointer;" onclick="bsbPickerToggle(' + i + ')" onmousedown="this.style.opacity=\'.8\'" onmouseup="this.style.opacity=\'1\'" ontouchstart="this.style.opacity=\'.8\'" ontouchend="this.style.opacity=\'1\'">'
            // Checkbox
            + '<div id="bsb-picker-chk-' + i + '" style="width:20px;height:20px;border-radius:6px;border:2px solid ' + (sel ? '#3b82f6' : (someIndivSel ? '#3b82f6' : 'var(--border-subtle)')) + ';flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all .18s;background:' + (sel ? '#3b82f6' : (someIndivSel ? 'rgba(59,130,246,0.4)' : 'var(--bg-raised)')) + ';">'
              + (sel ? '<span class="material-icons-round" style="font-size:13px;color:#fff;">check</span>' : (someIndivSel ? '<span class="material-icons-round" style="font-size:13px;color:#fff;">remove</span>' : ''))
            + '</div>'
            // Name + badge
            + '<div style="flex:1;min-width:0;display:flex;align-items:center;gap:8px;">'
              + '<span style="font-family:var(--font-display);font-size:13px;font-weight:800;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (g.name || 'Group ' + (i+1)) + '</span>'
              + '<span style="font-size:9px;padding:2px 8px;border-radius:5px;font-weight:700;font-family:var(--font-mono);background:' + clr.bg + ';border:1px solid ' + clr.border + ';color:' + clr.accent + ';flex-shrink:0;">' + g.keys.length + ' KEYS</span>'
              + (selInGroup > 0 ? '<span style="font-size:9px;padding:2px 6px;border-radius:5px;font-weight:700;font-family:var(--font-mono);background:rgba(59,130,246,.15);border:1px solid rgba(59,130,246,.3);color:#60a5fa;flex-shrink:0;">' + selInGroup + ' sel</span>' : '')
            + '</div>'
            // Expand button
            + '<div onclick="event.stopPropagation();bsbPickerToggleExpand(' + i + ')" style="width:28px;height:28px;border-radius:8px;border:1px solid var(--border-subtle);background:var(--bg-raised);display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;transition:all .18s;" id="bsb-picker-expbtn-' + i + '" onmousedown="this.style.background=\'var(--bg-glass-hover)\'" onmouseup="this.style.background=\'var(--bg-raised)\'" ontouchstart="this.style.background=\'var(--bg-glass-hover)\'" ontouchend="this.style.background=\'var(--bg-raised)\'">'
              + '<span class="material-icons-round" id="bsb-picker-expicon-' + i + '" style="font-size:16px;color:var(--text-muted);transition:transform .2s;transform:' + (expanded ? 'rotate(180deg)' : 'rotate(0deg)') + ';">expand_more</span>'
            + '</div>'
            + '</div>';

          // Individual key rows when expanded
          var keyRows = '';
          if (expanded) {
            keyRows = '<div style="border-top:1px solid var(--border-subtle);padding:6px 10px 8px;display:flex;flex-direction:column;gap:4px;max-height:40vh;overflow-y:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;" id="bsb-picker-keys-' + i + '">';
            g.keys.forEach(function(pk, ki) {
              var indivKey = i + '-' + ki;
              var indivSel = __NX._bsbPickerIndivSelected.has(indivKey);
              var addr = '';
              try { addr = new ethers.Wallet(pk).address; } catch(_) {}
              var display = addr ? (addr.slice(0,6) + '…' + addr.slice(-4)) : ('#' + (ki+1));
              keyRows += '<div id="bsb-picker-krow-' + i + '-' + ki + '" onclick="bsbPickerToggleKey(' + i + ',' + ki + ')" style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;border:1px solid ' + (indivSel ? 'rgba(59,130,246,.45)' : 'var(--border-subtle)') + ';background:' + (indivSel ? 'rgba(59,130,246,.08)' : 'var(--bg-glass)') + ';cursor:pointer;transition:all .15s;" onmousedown="this.style.opacity=\'.7\'" onmouseup="this.style.opacity=\'1\'" ontouchstart="this.style.opacity=\'.7\'" ontouchend="this.style.opacity=\'1\'">'
                + '<div style="width:16px;height:16px;border-radius:4px;border:2px solid ' + (indivSel ? '#3b82f6' : 'var(--border-subtle)') + ';flex-shrink:0;display:flex;align-items:center;justify-content:center;background:' + (indivSel ? '#3b82f6' : 'var(--bg-raised)') + ';transition:all .15s;">'
                  + (indivSel ? '<span class="material-icons-round" style="font-size:11px;color:#fff;">check</span>' : '')
                + '</div>'
                + '<span style="font-family:var(--font-mono);font-size:10px;color:' + (indivSel ? '#60a5fa' : 'var(--text-secondary)') + ';flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">#' + (ki+1) + ' ' + display + '</span>'
              + '</div>';
            });
            keyRows += '</div>';
          } else {
            keyRows = '<div id="bsb-picker-keys-' + i + '" style="display:none;"></div>';
          }

          return card + keyRows + '</div>';
        }).join('');
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
