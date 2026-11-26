
  // ── State ──
  var _thPickerSelected     = new Set();   // selected group indices
  var _thPickerIndivSelected = new Set();  // 'gi-ki' individual key selections
  var _thPickerExpanded     = new Set();   // expanded group indices
  var _thPickerTargetId     = '';
  var _thPickerMode         = '';   // 'single' | 'multi' | 'address'

  // ── Helpers ──
  function thGid(id) { return document.getElementById(id); }
  function thGetGroups() {
    var g = [];
    g = (typeof loadWalletGroups === 'function') ? loadWalletGroups() : [];
    return g.filter(function(g) { return g && g.keys && g.keys.length > 0; });
  }
  function _thKeyDisplay(pk, mode) {
    try {
      var t = (pk || '').trim();
      if (mode === 'address' || mode === 'addresses') {
        try { if (ethers.isAddress(t)) { var ca = ethers.getAddress(t); return ca.slice(0,6)+'…'+ca.slice(-4); } } catch(_e) {}
        var addr = new ethers.Wallet(t).address;
        return addr.slice(0,6)+'…'+addr.slice(-4);
      }
      var addr2 = new ethers.Wallet(pk).address;
      return addr2.slice(0, 6) + '…' + addr2.slice(-4);
    } catch(_) { return (pk || '').slice(0, 8) + '…'; }
  }

  // ── Render the full list ──
  function _thRenderList() {
    var groups = thGetGroups();
    var list = thGid('th-wallet-picker-list');
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

    var isSingleAddr = (_thPickerMode === 'single' || _thPickerMode === 'address'); // 'addresses' = multi+addr, NOT single

    list.innerHTML = groups.map(function(g, i) {
      var clr      = colors[i % colors.length];
      var sel      = _thPickerSelected.has(i);
      var expanded = _thPickerExpanded.has(i);

      // In single/address mode: group header click = expand toggle (not select)
      var headerOnclick = isSingleAddr
        ? 'thPickerToggleExpand(' + i + ')'
        : 'thPickerToggle(' + i + ')';

      // Group header row
      var header = '<div style="border:2px solid ' + (sel ? 'rgba(99,102,241,.5)' : 'var(--border-subtle)') + ';border-radius:12px;transition:border-color .18s;background:' + (sel ? 'rgba(99,102,241,.04)' : '') + ';" id="th-picker-card-' + i + '">'
        + '<div style="display:flex;gap:10px;align-items:center;padding:11px 12px;cursor:pointer;" onclick="' + headerOnclick + '" onmousedown="this.style.opacity=\'.8\'" onmouseup="this.style.opacity=\'1\'" ontouchstart="this.style.opacity=\'.8\'" ontouchend="this.style.opacity=\'1\'">';

      // Checkbox — hide in single/address mode
      if (!isSingleAddr) {
        header += '<div id="th-picker-chk-' + i + '" style="width:20px;height:20px;border-radius:6px;border:2px solid ' + (sel ? 'var(--accent-primary)' : 'var(--border-subtle)') + ';flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all .18s;background:' + (sel ? 'var(--accent-primary)' : 'var(--bg-raised)') + ';">'
          + (sel ? '<span class="material-icons-round" style="font-size:13px;color:#fff;">check</span>' : '')
        + '</div>';
      }

      header += '<div style="flex:1;min-width:0;display:flex;align-items:center;gap:8px;">'
          + '<span style="font-family:var(--font-display);font-size:13px;font-weight:800;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (g.name || 'Group ' + (i + 1)) + '</span>'
          + '<span style="font-size:9px;padding:2px 8px;border-radius:5px;font-weight:700;font-family:var(--font-mono);background:' + clr.bg + ';border:1px solid ' + clr.border + ';color:' + clr.accent + ';flex-shrink:0;">' + g.keys.length + ' KEYS</span>'
        + '</div>'
        // expand toggle — in multi mode stop propagation; in single/address the whole row IS expand
        + '<div onclick="' + (isSingleAddr ? 'thPickerToggleExpand(' + i + ')' : 'event.stopPropagation();thPickerToggleExpand(' + i + ')') + '" style="width:28px;height:28px;border-radius:8px;border:1px solid var(--border-subtle);background:var(--bg-raised);display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;transition:all .18s;" id="th-picker-expbtn-' + i + '" onmousedown="this.style.background=\'var(--bg-glass-hover)\'" onmouseup="this.style.background=\'var(--bg-raised)\'" ontouchstart="this.style.background=\'var(--bg-glass-hover)\'" ontouchend="this.style.background=\'var(--bg-raised)\'">'
          + '<span class="material-icons-round" id="th-picker-expicon-' + i + '" style="font-size:16px;color:var(--text-muted);transition:transform .2s;transform:' + (expanded ? 'rotate(180deg)' : 'rotate(0deg)') + ';">expand_more</span>'
        + '</div>'
      + '</div>';

      // Individual keys sub-list (shown only when expanded)
      var keyRows = '';
      if (expanded) {
        keyRows = '<div style="border-top:1px solid var(--border-subtle);padding:6px 10px 8px;display:flex;flex-direction:column;gap:4px;max-height:40vh;overflow-y:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;" id="th-picker-keys-' + i + '">';
        g.keys.forEach(function(pk, ki) {
          var indivKey  = i + '-' + ki;
          var indivSel  = _thPickerIndivSelected.has(indivKey);
          var display   = _thKeyDisplay(pk, _thPickerMode);
          // In single/address mode: clicking a key row selects + auto-closes the picker
          var keyOnclick = isSingleAddr
            ? 'thPickerSelectSingle(' + i + ',' + ki + ')'
            : 'thPickerToggleKey(' + i + ',' + ki + ')';
          keyRows += '<div id="th-picker-krow-' + i + '-' + ki + '" onclick="' + keyOnclick + '" style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;border:1px solid ' + (indivSel ? 'rgba(99,102,241,.45)' : 'var(--border-subtle)') + ';background:' + (indivSel ? 'rgba(99,102,241,.08)' : 'var(--bg-glass)') + ';cursor:pointer;transition:all .15s;" onmousedown="this.style.opacity=\'.7\'" onmouseup="this.style.opacity=\'1\'" ontouchstart="this.style.opacity=\'.7\'" ontouchend="this.style.opacity=\'1\'">'
            + '<div id="th-picker-kchk-' + i + '-' + ki + '" style="width:16px;height:16px;border-radius:4px;border:2px solid ' + (indivSel ? 'var(--accent-primary)' : 'var(--border-subtle)') + ';flex-shrink:0;display:flex;align-items:center;justify-content:center;background:' + (indivSel ? 'var(--accent-primary)' : 'var(--bg-raised)') + ';transition:all .15s;">'
              + (indivSel ? '<span class="material-icons-round" style="font-size:11px;color:#fff;">check</span>' : '')
            + '</div>'
            + '<span style="font-family:var(--font-mono);font-size:10px;color:' + (indivSel ? 'var(--neon-cyan)' : 'var(--text-secondary)') + ';flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">#' + (ki + 1) + ' ' + display + '</span>'
          + '</div>';
        });
        keyRows += '</div>';
      } else {
        keyRows = '<div id="th-picker-keys-' + i + '" style="display:none;"></div>';
      }

      return header + keyRows + '</div>';
    }).join('');
  }

