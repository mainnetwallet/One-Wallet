
(function() {
  'use strict';

  // ── State ──
  var supWallets  = [];
  var supRunning  = false;
  var supStopped  = false;
  var supDone = 0, supErr = 0, supSkip = 0;

  // ── Constants ──
  var ENTRYPOINT = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
  var CSW_IFACE = new ethers.Interface([
    'function execute(address target, uint256 value, bytes calldata data) external payable',
    'function executeBatch((address target, uint256 value, bytes data)[] calls) external payable',
  ]);
  var ERC20_IFACE = new ethers.Interface([
    'function transfer(address to, uint256 amount) returns (bool)',
    'function balanceOf(address) view returns (uint256)',
  ]);
  var EP_IFACE = new ethers.Interface([
    'function getNonce(address sender, uint192 key) view returns (uint256)',
  ]);

  // ── Helpers ──
  var supGid = function(id) { return document.getElementById(id); };
  var supSl  = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };
  var supToH = function(v)  { return '0x' + BigInt(v || 0).toString(16); };
  var supHb  = function(v)  { return typeof v === 'bigint' ? v : BigInt(v); };

  function supNowTs() {
    return new Date().toLocaleTimeString('en-GB', {hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'});
  }

  // ── Tab switching ──
  window.supSwitchTab = function(name) {
    var tabs = ['config','keys','queue','log'];
    tabs.forEach(function(t) {
      var btn = supGid('sup-tab-' + t);
      var panel = supGid('sup-panel-' + t);
      var isActive = t === name;
      if (btn) {
        if (isActive) {
          btn.style.background = 'linear-gradient(145deg,var(--accent-primary),#3060d8)';
          btn.style.color = '#fff';
          btn.style.boxShadow = '0 2px 12px rgba(99,102,241,.3)';
        } else {
          btn.style.background = 'transparent';
          btn.style.color = 'var(--text-muted)';
          btn.style.boxShadow = '';
        }
      }
      if (panel) panel.style.display = isActive ? 'block' : 'none';
    });
    // Action Bar: Config tab → Next button only; others → Start/Stop/Clear
    var isConfig = name === 'config';
    var btnNext  = supGid('sup-btn-next');
    var btnStart = supGid('sup-btn-start');
    var btnStop  = supGid('sup-btn-stop');
    if (btnNext)  btnNext.style.display  = isConfig ? 'flex' : 'none';
    if (btnStart) btnStart.style.display = isConfig ? 'none' : 'flex';
    if (btnStop)  btnStop.style.display  = isConfig ? 'none' : 'flex';
    if (name === 'log') {
      var badge = supGid('sup-log-badge');
      if (badge) badge.style.display = 'none';
      var box = supGid('sup-log-box');
      if (box) setTimeout(function() { box.scrollTop = box.scrollHeight; }, 50);
    }
  };

  window.supOnModeChange = function() {
    var fw = supGid('sup-fixedWrap');
    if (fw) fw.style.display = (supGid('sup-mode') || {}).value === 'fixed' ? 'block' : 'none';
  };

  // ── Log ──
  function supLog(msg, type) {
    var box = supGid('sup-log-box');
    if (!box) return;
    var d = document.createElement('div');
    d.style.cssText = 'display:flex;gap:8px;border-bottom:1px solid rgba(30,38,60,.5);padding:1px 0;';
    var colorMap = {ok:'var(--accent-green)',err:'var(--accent-red)',warn:'var(--accent-amber)',acc:'var(--neon-purple)',muted:'var(--text-muted)',txt:'var(--text-primary)'};
    var color = colorMap[type] || 'var(--text-primary)';
    d.innerHTML = '<span style="color:var(--text-muted);min-width:62px;flex-shrink:0;font-size:9px;padding-top:2px;opacity:.7;">' + supNowTs() + '</span>'
                + '<span style="color:' + color + ';word-break:break-all;flex:1;">' + msg + '</span>';
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
    var activePanel = document.querySelector('#page-sup-transfer .sup-panel-active');
    var logPanel = supGid('sup-panel-log');
    if (logPanel && logPanel.style.display === 'none') {
      var badge = supGid('sup-log-badge');
      if (badge) badge.style.display = 'block';
    }
  }

  function supNormalizeKey(raw) {
    var s = (raw || '').trim();
    if (!s) return null;
    var hex = s.startsWith('0x') ? s.slice(2) : s;
    if (!/^[0-9a-fA-F]{64}$/.test(hex)) return null;
    return '0x' + hex;
  }

  async function supRpc(url, method, params) {
    var r = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({jsonrpc:'2.0', id: Date.now(), method: method, params: params})
    });
    var j = await r.json();
    if (j.error) throw new Error(method + ': ' + (j.error.message || JSON.stringify(j.error)));
    return j.result;
  }

  // ── Stats & UI ──
  function supUpdateStats() {
    var total     = supWallets.length;
    var processed = supDone + supErr + supSkip;
    var pct       = total > 0 ? Math.round(processed / total * 100) : 0;
    var set = function(id, v) { var e = supGid(id); if (e) e.textContent = v; };
    set('sup-s-total', total);
    set('sup-s-done', supDone);
    set('sup-s-err', supErr);
    set('sup-s-pct', pct + '%');
    var pf = supGid('sup-prog-fill');
    if (pf) pf.style.width = pct + '%';
    set('sup-prog-l', processed + ' / ' + total);
    set('sup-prog-r', pct + '%');
    var qi = supGid('sup-q-info');
    if (qi) qi.textContent = '✅ ' + supDone + ' · ❌ ' + supErr + ' · ⏭ ' + supSkip;
  }

  function supRenderTable() {
    var list = supGid('sup-wallet-list');
    if (!list) return;
    if (!supWallets.length) {
      list.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:32px;font-size:11px;font-family:var(--font-mono);">No wallets loaded</div>';
      return;
    }
    list.innerHTML = supWallets.map(function(w, i) {
      var statusColors = {pending:'var(--text-muted)',running:'var(--accent-primary)',done:'var(--accent-green)',error:'var(--accent-red)',skipped:'var(--accent-amber)'};
      var sc = statusColors[w.status] || 'var(--text-muted)';
      return '<div id="sup-wrow-' + i + '" style="background:var(--bg-raised);border:1px solid var(--border-subtle);border-radius:10px;padding:10px 12px;display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;transition:border-color .2s;">'
        + '<div style="color:var(--text-muted);font-size:10px;font-weight:700;min-width:22px;">' + (i+1) + '</div>'
        + '<div style="min-width:0;">'
        + '<div style="font-size:10px;color:var(--neon-cyan);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + w.address + '</div>'
        + '<div style="font-size:9px;color:var(--text-muted);margin-top:3px;">Bal: <span id="sup-bal-' + i + '">—</span> &nbsp;→&nbsp; <span style="color:var(--accent-green);" id="sup-amt-' + i + '">—</span></div>'
        + '<div style="margin-top:2px;font-size:9px;" id="sup-tx-' + i + '"></div>'
        + '</div>'
        + '<div><span id="sup-st-' + i + '" style="font-size:9px;padding:3px 8px;border-radius:5px;font-weight:700;color:' + sc + ';background:rgba(0,0,0,.2);border:1px solid ' + sc + '33;">' + w.status + '</span></div>'
        + '</div>';
    }).join('');
  }

  function supSetStatus(i, status) {
    supWallets[i].status = status;
    var el  = supGid('sup-st-' + i);
    var row = supGid('sup-wrow-' + i);
    var statusColors = {pending:'var(--text-muted)',running:'var(--accent-primary)',done:'var(--accent-green)',error:'var(--accent-red)',skipped:'var(--accent-amber)'};
    var sc = statusColors[status] || 'var(--text-muted)';
    if (el)  { el.textContent = status; el.style.color = sc; el.style.borderColor = sc + '33'; }
    if (row) { row.style.borderColor = status === 'done' ? 'rgba(16,185,129,.25)' : status === 'error' ? 'rgba(244,63,94,.25)' : status === 'running' ? 'rgba(99,102,241,.3)' : ''; }
  }
  function supSetBal(i, v) { var e = supGid('sup-bal-'+i); if (e) e.textContent = v; }
  function supSetAmt(i, v) { var e = supGid('sup-amt-'+i); if (e) e.textContent = v; }
  function supSetTx(i, h) {
    var el = supGid('sup-tx-'+i);
    if (!el) return;
    if (h) {
      var url = 'https://basescan.org/tx/' + h;
      el.innerHTML = '<a href="' + url + '" target="_blank" rel="noopener" style="color:var(--neon-cyan);word-break:break-all;">' + h.slice(0,22) + '…</a>';
    } else { el.textContent = ''; }
  }

  // ── Key Input ──
  window.supOnPkInput = function() {
    var area    = supGid('sup-pkArea');
    var derived = supGid('sup-pk-derived');
    if (!area || !derived) return;
    var lines = area.value.split('\n');
    var count = 0, rows = [];
    lines.forEach(function(line) {
      var key = supNormalizeKey(line);
      if (!key) return;
      count++;
      try {
        var w = new ethers.Wallet(key);
        rows.push('<div style="display:flex;align-items:center;gap:10px;padding:7px 12px;border-bottom:1px solid rgba(30,38,60,.4);">'
          + '<span style="color:var(--text-muted);font-size:9px;min-width:18px;">' + count + '</span>'
          + '<span style="font-size:10px;color:var(--accent-green);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + w.address + '</span>'
          + '</div>');
      } catch(e) {}
    });
    if (!rows.length) {
      derived.innerHTML = '';
    } else {
      derived.innerHTML = '<div style="background:var(--bg-raised);border:1px solid var(--border-subtle);border-radius:10px;overflow:hidden;margin-top:10px;">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid var(--border-subtle);background:var(--bg-glass);">'
        + '<span style="font-size:9px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;">Derived Addresses</span>'
        + '<span style="font-size:9px;color:var(--neon-purple);">' + count + ' wallets</span>'
        + '</div>'
        + '<div style="max-height:150px;overflow-y:auto;">' + rows.join('') + '</div>'
        + '</div>';
    }
    var pk = supGid('sup-pk-count');
    if (pk) pk.textContent = count + ' keys';
    var st = supGid('sup-s-total');
    if (st) st.textContent = count;
    (function(_areaVal) { OneCrypto.encrypt(_areaVal).then(function(_encSupPks) { try { localStorage.setItem('one_sup_pks', _encSupPks); } catch(_) {} }); })(area.value);
  };

  // ══════════════════════════════════════════════════════
  // SUP ADVANCED WALLET PICKER  (th-style: expand + individual key select)
  // ══════════════════════════════════════════════════════
  (function() {
    // ── State ──
    var _supPickerSelected     = new Set();  // selected group indices
    var _supPickerIndivSelected = new Set(); // 'gi-ki' individual key selections
    var _supPickerExpanded     = new Set();  // expanded group indices

    // ── Helpers ──
    function supGetGroups() {
      // Use plaintext cache via loadWalletGroups to get decrypted keys
      var g = (typeof loadWalletGroups === 'function') ? loadWalletGroups() : [];
      return g.filter(function(g) { return g && g.keys && g.keys.length > 0; });
    }
    function _supKeyDisplay(pk) {
      try {
        var addr = new ethers.Wallet((pk||'').trim()).address;
        return addr.slice(0,6) + '…' + addr.slice(-4);
      } catch(_) { return (pk||'').slice(0,8) + '…'; }
    }

    // ── Render the full list ──
    function _supRenderList() {
      var groups = supGetGroups();
      var list = document.getElementById('sup-wallet-picker-list');
      if (!list) return;
      if (!groups.length) {
        list.innerHTML = '<div style="text-align:center;padding:40px 16px;color:var(--text-muted);font-family:var(--font-mono);font-size:11px;line-height:1.8;">কোনো wallet group নেই।<br>Profile → Wallet Groups-এ add করুন।</div>';
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
        var sel      = _supPickerSelected.has(i);
        var expanded = _supPickerExpanded.has(i);

        // Group header
        var header = '<div style="border:2px solid ' + (sel ? 'rgba(99,102,241,.5)' : 'var(--border-subtle)') + ';border-radius:12px;transition:border-color .18s;background:' + (sel ? 'rgba(99,102,241,.04)' : '') + ';" id="sup-picker-card-' + i + '">'
          + '<div style="display:flex;gap:10px;align-items:center;padding:11px 12px;cursor:pointer;" onclick="supPickerToggle(' + i + ')" onmousedown="this.style.opacity=\'.8\'" onmouseup="this.style.opacity=\'1\'" ontouchstart="this.style.opacity=\'.8\'" ontouchend="this.style.opacity=\'1\'">'
          // Checkbox
          + '<div id="sup-picker-chk-' + i + '" style="width:20px;height:20px;border-radius:6px;border:2px solid ' + (sel ? 'var(--accent-primary)' : 'var(--border-subtle)') + ';flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all .18s;background:' + (sel ? 'var(--accent-primary)' : 'var(--bg-raised)') + ';">'
            + (sel ? '<span class="material-icons-round" style="font-size:13px;color:#fff;">check</span>' : '')
          + '</div>'
          // Name + key count badge
          + '<div style="flex:1;min-width:0;display:flex;align-items:center;gap:8px;">'
            + '<span style="font-family:var(--font-display);font-size:13px;font-weight:800;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (g.name || 'Group ' + (i+1)) + '</span>'
            + '<span style="font-size:9px;padding:2px 8px;border-radius:5px;font-weight:700;font-family:var(--font-mono);background:' + clr.bg + ';border:1px solid ' + clr.border + ';color:' + clr.accent + ';flex-shrink:0;">' + g.keys.length + ' KEYS</span>'
          + '</div>'
          // Expand button
          + '<div onclick="event.stopPropagation();supPickerToggleExpand(' + i + ')" style="width:28px;height:28px;border-radius:8px;border:1px solid var(--border-subtle);background:var(--bg-raised);display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;transition:all .18s;" id="sup-picker-expbtn-' + i + '" onmousedown="this.style.background=\'var(--bg-glass-hover)\'" onmouseup="this.style.background=\'var(--bg-raised)\'" ontouchstart="this.style.background=\'var(--bg-glass-hover)\'" ontouchend="this.style.background=\'var(--bg-raised)\'">'
            + '<span class="material-icons-round" id="sup-picker-expicon-' + i + '" style="font-size:16px;color:var(--text-muted);transition:transform .2s;transform:' + (expanded ? 'rotate(180deg)' : 'rotate(0deg)') + ';">expand_more</span>'
          + '</div>'
          + '</div>';

        // Individual key rows (only when expanded)
        var keyRows = '';
        if (expanded) {
          keyRows = '<div style="border-top:1px solid var(--border-subtle);padding:6px 10px 8px;display:flex;flex-direction:column;gap:4px;max-height:40vh;overflow-y:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;" id="sup-picker-keys-' + i + '">';
          g.keys.forEach(function(pk, ki) {
            var indivKey = i + '-' + ki;
            var indivSel = _supPickerIndivSelected.has(indivKey);
            var display  = _supKeyDisplay(pk);
            keyRows += '<div id="sup-picker-krow-' + i + '-' + ki + '" onclick="supPickerToggleKey(' + i + ',' + ki + ')" style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;border:1px solid ' + (indivSel ? 'rgba(99,102,241,.45)' : 'var(--border-subtle)') + ';background:' + (indivSel ? 'rgba(99,102,241,.08)' : 'var(--bg-glass)') + ';cursor:pointer;transition:all .15s;" onmousedown="this.style.opacity=\'.7\'" onmouseup="this.style.opacity=\'1\'" ontouchstart="this.style.opacity=\'.7\'" ontouchend="this.style.opacity=\'1\'">'
              + '<div id="sup-picker-kchk-' + i + '-' + ki + '" style="width:16px;height:16px;border-radius:4px;border:2px solid ' + (indivSel ? 'var(--accent-primary)' : 'var(--border-subtle)') + ';flex-shrink:0;display:flex;align-items:center;justify-content:center;background:' + (indivSel ? 'var(--accent-primary)' : 'var(--bg-raised)') + ';transition:all .15s;">'
                + (indivSel ? '<span class="material-icons-round" style="font-size:11px;color:#fff;">check</span>' : '')
              + '</div>'
              + '<span style="font-family:var(--font-mono);font-size:10px;color:' + (indivSel ? 'var(--neon-cyan)' : 'var(--text-secondary)') + ';flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">#' + (ki+1) + ' ' + display + '</span>'
            + '</div>';
          });
          keyRows += '</div>';
        } else {
          keyRows = '<div id="sup-picker-keys-' + i + '" style="display:none;"></div>';
        }
        return header + keyRows + '</div>';
      }).join('');
    }

    // ── Sync selected keys → sup-pkArea textarea ──
    function _supSyncToField() {
      var groups = supGetGroups();
      var values = [];
      if (_supPickerIndivSelected.size > 0) {
        var ordered = [];
        _supPickerIndivSelected.forEach(function(key) {
          var parts = key.split('-');
          ordered.push({ gi: parseInt(parts[0]), ki: parseInt(parts[1]) });
        });
        ordered.sort(function(a, b) { return a.gi !== b.gi ? a.gi - b.gi : a.ki - b.ki; });
        ordered.forEach(function(o) {
          if (groups[o.gi] && groups[o.gi].keys[o.ki]) {
            var raw = (groups[o.gi].keys[o.ki] || '').trim();
            if (raw) values.push(raw);
          }
        });
      } else {
        _supPickerSelected.forEach(function(i) {
          if (!groups[i] || !groups[i].keys) return;
          groups[i].keys.forEach(function(pk) {
            var raw = (pk || '').trim();
            if (raw) values.push(raw);
          });
        });
      }
      var area = document.getElementById('sup-pkArea');
      if (!area) return;
      if (typeof window.supSwitchTab === 'function') window.supSwitchTab('keys');
      area.value = values.join('\n');
      if (typeof window.supOnPkInput === 'function') window.supOnPkInput();
      try { area.dispatchEvent(new Event('input', { bubbles: true })); } catch(_) {}
      // Flash key count badge green as feedback
      var pk = document.getElementById('sup-pk-count');
      if (pk) {
        pk.style.background = 'rgba(16,185,129,.25)';
        pk.style.borderColor = 'rgba(16,185,129,.5)';
        pk.style.color = 'var(--accent-green)';
        setTimeout(function() {
          pk.style.background = 'rgba(99,102,241,.1)';
          pk.style.borderColor = 'rgba(99,102,241,.2)';
          pk.style.color = 'var(--neon-purple)';
        }, 600);
      }
    }

    // ── Open ──
    window.supOpenWalletPicker = function() {
      _supPickerSelected     = new Set();
      _supPickerIndivSelected = new Set();
      _supPickerExpanded     = new Set();

      var overlay = document.getElementById('sup-wallet-picker-overlay');
      var drawer  = document.getElementById('sup-wallet-picker-drawer');
      if (!overlay || !drawer) return;

      // Keep overlay inside #app so it respects the app container bounds (not full browser window)
      var appEl = document.getElementById('app');
      if (appEl && overlay.parentNode !== appEl) appEl.appendChild(overlay);

      overlay.style.display = 'block';
      overlay.style.background = 'rgba(5,5,8,0)';
      overlay.style.backdropFilter = 'blur(0px)';
      drawer.style.transform = 'translateX(100%)';
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          overlay.style.background = 'rgba(5,5,8,0.75)';
          overlay.style.backdropFilter = 'blur(4px)';
          drawer.style.transform = 'translateX(0)';
        });
      });

      // Pre-select groups whose keys are already in the textarea
      var existingKeys = new Set();
      var area = document.getElementById('sup-pkArea');
      if (area && area.value.trim()) {
        area.value.trim().split('\n').forEach(function(k) {
          var t = k.trim(); if (t) existingKeys.add(t.toLowerCase());
        });
      }
      if (existingKeys.size > 0) {
        var groups = supGetGroups();
        groups.forEach(function(g, i) {
          if (!g.keys || !g.keys.length) return;
          var allMatch = g.keys.every(function(pk) { return existingKeys.has((pk||'').trim().toLowerCase()); });
          if (allMatch) {
            _supPickerSelected.add(i);
            g.keys.forEach(function(_, ki) { _supPickerIndivSelected.add(i + '-' + ki); });
          }
        });
      }

      _supRenderList();
    };

    // ── Toggle expand/collapse ──
    window.supPickerToggleExpand = function(idx) {
      if (_supPickerExpanded.has(idx)) { _supPickerExpanded.delete(idx); }
      else { _supPickerExpanded.add(idx); }
      _supRenderList();
    };

    // ── Toggle individual key ──
    window.supPickerToggleKey = function(gi, ki) {
      var groups  = supGetGroups();
      var g       = groups[gi];
      if (!g) return;
      var indivKey = gi + '-' + ki;
      if (_supPickerIndivSelected.has(indivKey)) {
        _supPickerIndivSelected.delete(indivKey);
      } else {
        _supPickerIndivSelected.add(indivKey);
      }
      // Sync group-level checkbox: selected only if ALL keys individually selected
      var allSelected = g.keys.every(function(_, k) { return _supPickerIndivSelected.has(gi + '-' + k); });
      if (allSelected) { _supPickerSelected.add(gi); } else { _supPickerSelected.delete(gi); }
      _supRenderList();
      _supSyncToField();
    };

    // ── Toggle whole group ──
    window.supPickerToggle = function(idx) {
      var groups = supGetGroups();
      var g      = groups[idx];
      if (!g) return;
      if (_supPickerSelected.has(idx)) {
        _supPickerSelected.delete(idx);
        g.keys.forEach(function(_, ki) { _supPickerIndivSelected.delete(idx + '-' + ki); });
      } else {
        _supPickerSelected.add(idx);
        g.keys.forEach(function(_, ki) { _supPickerIndivSelected.add(idx + '-' + ki); });
      }
      _supRenderList();
      _supSyncToField();
    };

    // ── Select All / Deselect All ──
    window.supWalletPickerSelectAll = function() {
      var groups     = supGetGroups();
      var allSel     = _supPickerSelected.size === groups.length;
      if (allSel) {
        _supPickerSelected     = new Set();
        _supPickerIndivSelected = new Set();
      } else {
        groups.forEach(function(g, i) {
          _supPickerSelected.add(i);
          g.keys.forEach(function(_, ki) { _supPickerIndivSelected.add(i + '-' + ki); });
        });
      }
      _supRenderList();
      _supSyncToField();
    };

    // ── Apply (close button) ──
    window.supApplyWalletPicker = function() {
      _supSyncToField();
      window.supCloseWalletPicker();
    };

    // ── Close ──
    window.supCloseWalletPicker = function() {
      var overlay = document.getElementById('sup-wallet-picker-overlay');
      var drawer  = document.getElementById('sup-wallet-picker-drawer');
      if (!overlay || !drawer) return;
      overlay.style.background = 'rgba(5,5,8,0)';
      overlay.style.backdropFilter = 'blur(0px)';
      drawer.style.transform = 'translateX(100%)';
      setTimeout(function() {
        overlay.style.display = 'none';
      }, 320);
    };

    // Swipe right to close: shared gesture, see scripts/shared/ui/swipe-close-registry.js

  })();
  // ══════════════════════════════════════════════════════
  // END SUP ADVANCED WALLET PICKER
  // ══════════════════════════════════════════════════════

  window.supClearAll = function() {
    var area = supGid('sup-pkArea');
    if (area) area.value = '';
    var derived = supGid('sup-pk-derived');
    if (derived) derived.innerHTML = '';
    var pk = supGid('sup-pk-count');
    if (pk) pk.textContent = '0 keys';
    supWallets = []; supDone = 0; supErr = 0; supSkip = 0;
    supRenderTable(); supUpdateStats();
    try { localStorage.removeItem('one_sup_pks'); } catch(_) {}
  };

  window.supExportLog = function() {
    var box = supGid('sup-log-box');
    if (!box) return;
    var text = Array.from(box.querySelectorAll('div')).map(function(el) { return el.textContent; }).join('\n');
    var a = document.createElement('a');
    a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(text);
    a.download = 'sup-log-' + Date.now() + '.txt';
    a.click();
  };

  // ── UserOp Hash ──
  function supLocalUserOpHash(uop, entryPoint, chainId) {
    var abi = ethers.AbiCoder.defaultAbiCoder();
    var packed = abi.encode(
      ['address','uint256','bytes32','bytes32','uint256','uint256','uint256','uint256','uint256','bytes32'],
      [
        uop.sender,
        supHb(uop.nonce),
        ethers.keccak256(uop.initCode || '0x'),
        ethers.keccak256(uop.callData || '0x'),
        supHb(uop.callGasLimit),
        supHb(uop.verificationGasLimit),
        supHb(uop.preVerificationGas),
        supHb(uop.maxFeePerGas),
        supHb(uop.maxPriorityFeePerGas),
        ethers.keccak256(uop.paymasterAndData || '0x'),
      ]
    );
    var opHash = ethers.keccak256(packed);
    return ethers.keccak256(abi.encode(['bytes32','address','uint256'], [opHash, entryPoint, BigInt(chainId)]));
  }

  // Fixed-amount mode: strict decimal string -> base units. There is no default: an empty, zero or
  // invalid field used to turn into 1 whole token per wallet (BUG-009).
  function supParseFixedAmount(decimals) {
    var str = String((supGid('sup-amount') || {}).value || '').trim();
    if (!/^(\d+(\.\d+)?|\.\d+)$/.test(str)) return { err: 'Valid amount দিন (যেমন 1 বা 0.5) — empty/invalid হলে transfer হবে না' };
    if (str.charAt(0) === '.') str = '0' + str; // ".5" -> "0.5"
    var v;
    try { v = ethers.parseUnits(str, decimals); }
    catch (e) { return { err: 'Amount-এ সর্বোচ্চ ' + decimals + ' দশমিক ঘর দেওয়া যাবে' }; }
    if (v <= 0n) return { err: 'Amount 0-র বেশি হতে হবে' };
    return { value: v };
  }

  // ── Core Batch ──
  async function supRunBatch() {
    var ethRpcList = supGid('sup-ethRpc').value.split('\n').map(function(s) { return s.trim(); }).filter(Boolean);
    if (!ethRpcList.length) { supLog('❌ অন্তত একটা ETH RPC দিন','err'); return; }

    var ethProviders = ethRpcList.map(function(url) { return window._thMakeProvider(url); });
    var getProvider  = function(i) { return ethProviders[i % ethProviders.length]; };
    var getRpcUrl    = function(i) { return ethRpcList[i % ethRpcList.length]; };
    supLog('🔀 ' + ethRpcList.length + ' RPC তে ' + supWallets.length + ' wallet ভাগ হবে', 'acc');

    var abi         = ethers.AbiCoder.defaultAbiCoder();
    var bundlerRpc  = supGid('sup-rpc').value.trim();
    var chainId     = parseInt(supGid('sup-chainId').value) || 8453;
    var chainHex    = '0x' + chainId.toString(16);
    var recipient   = supGid('sup-recipient').value.trim();
    var tokenAddr   = supGid('sup-tokenAddr').value.trim();
    var decimals    = parseInt(supGid('sup-tokenDecimals').value) || 18;
    var mode        = supGid('sup-mode').value;
    var fixedAmt    = null;
    if (mode !== 'full') {
      var _fa = supParseFixedAmount(decimals);
      if (_fa.err) { supLog('❌ ' + _fa.err, 'err'); return; }
      fixedAmt = _fa.value;
    }

    // Gas
    var BUNDLER_MIN = 7660000n;
    var gasPriceHex = await supRpc(ethRpcList[0], 'eth_gasPrice', []).catch(function() { return null; });
    var networkGas  = gasPriceHex ? BigInt(gasPriceHex) : BUNDLER_MIN;
    var effectiveGas = networkGas > BUNDLER_MIN ? networkGas : BUNDLER_MIN;
    var maxFee  = effectiveGas * 12n / 10n;
    var maxPrio = effectiveGas * 12n / 10n;
    supLog('⛽ Gas: ' + (Number(maxFee)/1e9).toFixed(6) + ' Gwei', 'muted');

    var dummySig = abi.encode(
      ['tuple(uint256 ownerIndex, bytes signatureData)'],
      [{ ownerIndex: 0n, signatureData: '0x' + '00'.repeat(65) }]
    );

    supLog('⏳ Fetching ' + supWallets.length + ' balances...', 'muted');

    async function fetchBalWithRetry(address, tc, retries, delay) {
      for (var attempt = 1; attempt <= retries; attempt++) {
        try { return await tc.balanceOf(address); }
        catch(e) { if (attempt < retries) await supSl(delay * attempt); }
      }
      return 0n;
    }

    var balances = [];
    for (var i = 0; i < supWallets.length; i++) {
      if (supStopped) break;
      var tc = new ethers.Contract(tokenAddr, ERC20_IFACE, getProvider(i));
      var bal = await fetchBalWithRetry(supWallets[i].address, tc, 3, 800);
      balances.push(bal);
      var formatted = parseFloat(ethers.formatUnits(bal, decimals)).toFixed(6);
      supSetBal(i, formatted);
      supLog('[W' + (i+1) + '] ' + supWallets[i].address.slice(0,10) + '… Balance: ' + formatted, bal > 0n ? 'ok' : 'acc');
      if (i < supWallets.length - 1) await supSl(200);
    }

    supLog('📋 Building UserOps for ' + supWallets.length + ' wallets...', 'muted');

    var jobResults = await Promise.allSettled(supWallets.map(async function(w, i) {
      try {
        var bal = balances[i];
        var transferAmt;
        if (mode === 'full') {
          transferAmt = bal;
        } else {
          transferAmt = fixedAmt;
        }

        if (bal === 0n) {
          supLog('[W' + (i+1) + '] ⏭ Zero balance — skipped', 'muted');
          supSetStatus(i, 'skipped'); supSkip++; supUpdateStats(); return null;
        }
        if (transferAmt > bal) {
          supLog('[W' + (i+1) + '] ⏭ Insufficient (have ' + ethers.formatUnits(bal, decimals) + ') — skipped', 'muted');
          supSetStatus(i, 'skipped'); supSkip++; supUpdateStats(); return null;
        }

        supSetStatus(i, 'running');
        supSetAmt(i, ethers.formatUnits(transferAmt, decimals));

        var erc20Call = ERC20_IFACE.encodeFunctionData('transfer', [recipient, transferAmt]);
        var callData  = CSW_IFACE.encodeFunctionData('execute', [tokenAddr, 0n, erc20Call]);

        var nonce = 0n;
        try {
          var cd2 = EP_IFACE.encodeFunctionData('getNonce', [w.address, 0n]);
          var res = await supRpc(getRpcUrl(i), 'eth_call', [{ to: ENTRYPOINT, data: cd2 }, 'latest']);
          if (res && res !== '0x') nonce = BigInt(res);
        } catch(e) { nonce = 0n; }

        var uop = {
          sender: w.address,
          nonce: supToH(nonce),
          initCode: '0x',
          callData: callData,
          callGasLimit: '0x493E0',
          verificationGasLimit: '0x186A0',
          preVerificationGas: '0xC350',
          maxFeePerGas: supToH(maxFee),
          maxPriorityFeePerGas: supToH(maxPrio),
          paymasterAndData: '0x',
          signature: dummySig,
        };

        try {
          var stub = await supRpc(bundlerRpc, 'pm_getPaymasterStubData', [uop, ENTRYPOINT, chainHex, {}]);
          if (stub && stub.paymasterAndData) uop.paymasterAndData = stub.paymasterAndData;
        } catch(e) { supLog('[W' + (i+1) + '] ⚠ PaymasterStub: ' + e.message, 'warn'); }

        try {
          var pm = await supRpc(bundlerRpc, 'pm_getPaymasterData', [uop, ENTRYPOINT, chainHex, {}]);
          if (pm && pm.paymasterAndData) uop.paymasterAndData = pm.paymasterAndData;
        } catch(e) { supLog('[W' + (i+1) + '] ⚠ PaymasterData: ' + e.message, 'warn'); }

        var opHash = supLocalUserOpHash(uop, ENTRYPOINT, chainId);
        var rawSig = w.signer.signingKey.sign(ethers.getBytes(opHash)).serialized;
        uop.signature = abi.encode(
          ['tuple(uint256 ownerIndex, bytes signatureData)'],
          [{ ownerIndex: 0n, signatureData: rawSig }]
        );

        supLog('[W' + (i+1) + '] ✓ Signed — ' + ethers.formatUnits(transferAmt, decimals) + ' → recipient', 'ok');
        return { uop: uop, idx: i, transferAmt: transferAmt };

      } catch(e) {
        supLog('[W' + (i+1) + '] ❌ Build failed: ' + e.message.slice(0,80), 'err');
        supSetStatus(i, 'error'); supErr++; supUpdateStats(); return null;
      }
    }));

    var ready = jobResults.map(function(r) { return r.status === 'fulfilled' ? r.value : null; }).filter(Boolean);
    if (!ready.length) { supLog('❌ কোনো valid wallet নেই — সব skip হয়েছে','err'); return; }

    supLog('📤 Sending ' + ready.length + ' UserOps একসাথে bundler-এ...', 'acc');

    var MAX_SEND_MS = 60000;
    var sendResults = await Promise.all(ready.map(async function(job) {
      var uop = job.uop, idx = job.idx;
      var sendStart = Date.now();
      var sendAttempt = 0;
      while (Date.now() - sendStart < MAX_SEND_MS) {
        sendAttempt++;
        try {
          var h = await supRpc(bundlerRpc, 'eth_sendUserOperation', [uop, ENTRYPOINT]);
          supSetTx(idx, h);
          supLog('[W' + (idx+1) + '] 📤 Sent! Hash: ' + h.slice(0,22) + '...', 'acc');
          return { hash: h, idx: idx };
        } catch(e) {
          var isRL = e.message.toLowerCase().includes('rate limit') || e.message.includes('429');
          if (isRL) {
            var wait = Math.min(3000 + sendAttempt * 500, 10000);
            supLog('[W' + (idx+1) + '] ⏳ Rate limited — waiting ' + (wait/1000).toFixed(1) + 's... (attempt ' + sendAttempt + ')', 'warn');
            await supSl(wait); continue;
          }
          var isNonceErr = e.message.includes('AA25') || e.message.toLowerCase().includes('nonce');
          if (isNonceErr && sendAttempt < 5) {
            supLog('[W' + (idx+1) + '] ⚠ Nonce mismatch — re-fetching & rebuilding (attempt ' + sendAttempt + ')...', 'warn');
            await supSl(800);
            try {
              var freshNonce = 0n;
              try {
                var cd3 = EP_IFACE.encodeFunctionData('getNonce', [supWallets[idx].address, 0n]);
                var res3 = await supRpc(getRpcUrl(idx), 'eth_call', [{ to: ENTRYPOINT, data: cd3 }, 'latest']);
                if (res3 && res3 !== '0x') freshNonce = BigInt(res3);
              } catch(_) { freshNonce = 0n; }
              uop.nonce = supToH(freshNonce);
              uop.paymasterAndData = '0x';
              uop.signature = abi.encode(['tuple(uint256 ownerIndex, bytes signatureData)'],[{ ownerIndex: 0n, signatureData: '0x'+'00'.repeat(65) }]);
              try {
                var stub2 = await supRpc(bundlerRpc, 'pm_getPaymasterStubData', [uop, ENTRYPOINT, chainHex, {}]);
                if (stub2 && stub2.paymasterAndData) uop.paymasterAndData = stub2.paymasterAndData;
              } catch(_) {}
              try {
                var pm2 = await supRpc(bundlerRpc, 'pm_getPaymasterData', [uop, ENTRYPOINT, chainHex, {}]);
                if (pm2 && pm2.paymasterAndData) uop.paymasterAndData = pm2.paymasterAndData;
              } catch(_) {}
              var newHash = supLocalUserOpHash(uop, ENTRYPOINT, chainId);
              var rawSig2 = supWallets[idx].signer.signingKey.sign(ethers.getBytes(newHash)).serialized;
              uop.signature = abi.encode(['tuple(uint256 ownerIndex, bytes signatureData)'],[{ ownerIndex: 0n, signatureData: rawSig2 }]);
              supLog('[W' + (idx+1) + '] 🔄 Rebuilt with nonce ' + freshNonce + ' + fresh paymaster', 'acc');
            } catch(ne) { supLog('[W' + (idx+1) + '] ⚠ Rebuild failed: ' + ne.message.slice(0,60), 'warn'); }
            continue;
          }
          supLog('[W' + (idx+1) + '] ❌ Send failed: ' + e.message, 'err');
          supSetStatus(idx, 'error'); supErr++; supUpdateStats(); return null;
        }
      }
      supLog('[W' + (idx+1) + '] ❌ Send timeout after 1 min', 'err');
      supSetStatus(idx, 'error'); supErr++; supUpdateStats(); return null;
    }));

    var sent = sendResults.filter(Boolean);
    if (!sent.length) { supLog('❌ সব send fail হয়েছে','err'); return; }

    supLog('⏳ ' + sent.length + 'টা UserOp confirm হওয়ার অপেক্ষা করছি...', 'muted');
    var pending = sent.slice();
    for (var p = 0; p < 40 && pending.length > 0 && !supStopped; p++) {
      await supSl(3000);
      var stillPending = [];
      for (var pi = 0; pi < pending.length; pi++) {
        var item = pending[pi];
        var receipt = await supRpc(bundlerRpc, 'eth_getUserOperationReceipt', [item.hash]).catch(function() { return null; });
        if (receipt) {
          var ok = receipt.success !== false;
          var txHash = (receipt.receipt && receipt.receipt.transactionHash) || '';
          var explorerUrl = txHash ? 'https://basescan.org/tx/' + txHash : '';
          supLog('[W' + (item.idx+1) + '] ' + (ok ? '✅ Confirmed!' : '❌ On-chain Failed') + ' Tx: <a href="' + explorerUrl + '" target="_blank" style="color:var(--neon-cyan);">' + txHash.slice(0,20) + '…</a>', ok ? 'ok' : 'err');
          supSetStatus(item.idx, ok ? 'done' : 'error');
          if (ok) supDone++; else supErr++;
          supUpdateStats();
        } else { stillPending.push(item); }
      }
      pending = stillPending;
      if (pending.length > 0) supLog('⏳ এখনো ' + pending.length + 'টা pending... (poll #' + (p+1) + ')', 'muted');
    }

    for (var fi = 0; fi < pending.length; fi++) {
      supLog('[W' + (pending[fi].idx+1) + '] ⚠ Receipt timeout — manually check করুন', 'warn');
      supSetStatus(pending[fi].idx, 'error'); supErr++; supUpdateStats();
    }
  }

  // ── Start / Stop ──
  window.supStartBot = async function() {
    if (supRunning) return;
    var recipient = (supGid('sup-recipient') || {}).value || '';
    var tokenAddr = (supGid('sup-tokenAddr') || {}).value || '';
    recipient = recipient.trim(); tokenAddr = tokenAddr.trim();
    if (!ethers.isAddress(recipient)) { supLog('❌ Valid recipient address দিন','err'); window.supSwitchTab('log'); return; }
    if (!ethers.isAddress(tokenAddr))  { supLog('❌ Valid ERC20 token address দিন','err'); window.supSwitchTab('log'); return; }
    if (supGid('sup-mode').value !== 'full') {
      var _amtCheck = supParseFixedAmount(parseInt(supGid('sup-tokenDecimals').value) || 18);
      if (_amtCheck.err) { supLog('❌ ' + _amtCheck.err, 'err'); window.supSwitchTab('log'); return; }
    }

    supWallets = [];
    var lines = (supGid('sup-pkArea') || {}).value || '';
    lines.split('\n').forEach(function(line) {
      var key = supNormalizeKey(line);
      if (!key) return;
      try {
        var signer = new ethers.Wallet(key);
        supWallets.push({ address: signer.address, signer: signer, status: 'pending' });
      } catch(e) {}
    });

    if (!supWallets.length) { supLog('❌ অন্তত একটা valid private key দিন','err'); window.supSwitchTab('keys'); return; }

    supDone = 0; supErr = 0; supSkip = 0;
    supRunning = true; window.supRunning = true; supStopped = false;
    if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txStart(); // BG: wake lock

    var btnStart = supGid('sup-btn-start');
    var btnStop  = supGid('sup-btn-stop');
    var liveDot  = supGid('sup-live-dot');
    var statusTxt = supGid('sup-status-txt');
    if (btnStart) {
      btnStart.disabled = true;
      btnStart.style.opacity = '0.6';
      btnStart.style.cursor = 'not-allowed';
      btnStart.style.pointerEvents = 'none';
      btnStart.innerHTML = '<span style="display:inline-block;width:13px;height:13px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;margin-right:6px;vertical-align:middle;"></span> Loading...';
    }
    if (btnStop)  { btnStop.disabled = false; btnStop.style.opacity = '1'; }
    if (liveDot)  { liveDot.style.background = 'var(--accent-green)'; liveDot.style.boxShadow = '0 0 8px var(--accent-green)'; }
    if (statusTxt){ statusTxt.textContent = 'RUNNING'; statusTxt.style.color = 'var(--accent-green)'; }

    supRenderTable(); supUpdateStats(); window.supSwitchTab('log');

    supLog('🚀 Bot started — ' + supWallets.length + ' wallets', 'ok');
    supLog('→ Token: ' + tokenAddr, 'acc');
    supLog('→ Recipient: ' + recipient, 'acc');
    supLog('→ Mode: ' + (supGid('sup-mode').value === 'full' ? 'Full balance (সব token)' : 'Fixed: ' + supGid('sup-amount').value), 'acc');

    try { await supRunBatch(); } catch(e) { supLog('❌ Batch error: ' + e.message, 'err'); console.error(e); }

    supRunning = false; window.supRunning = false;
    if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txEnd(); // BG: release wake lock
    if (btnStart) {
      btnStart.disabled = false;
      btnStart.style.opacity = '1';
      btnStart.style.cursor = 'pointer';
      btnStart.style.pointerEvents = '';
      btnStart.innerHTML = '▶ Start Bot';
    }
    if (btnStop)  { btnStop.disabled = true; btnStop.style.opacity = '.3'; }
    if (liveDot)  { liveDot.style.background = 'var(--text-muted)'; liveDot.style.boxShadow = ''; }
    if (statusTxt){ statusTxt.textContent = 'IDLE'; statusTxt.style.color = 'var(--text-muted)'; }
    supLog('━━ Finished ── ✅ ' + supDone + ' done | ❌ ' + supErr + ' failed | ⏭ ' + supSkip + ' skipped ━━', supDone > 0 ? 'ok' : 'warn');
  };

  window.supStopBot = function() {
    supStopped = true; supRunning = false; window.supRunning = false;
    var btnStop  = supGid('sup-btn-stop');
    var btnStart = supGid('sup-btn-start');
    var liveDot  = supGid('sup-live-dot');
    var statusTxt = supGid('sup-status-txt');
    if (btnStop)  { btnStop.disabled = true; btnStop.style.opacity = '.3'; }
    if (btnStart) {
      btnStart.disabled = false;
      btnStart.style.opacity = '1';
      btnStart.style.cursor = 'pointer';
      btnStart.style.pointerEvents = '';
      btnStart.innerHTML = '▶ Start Bot';
    }
    if (liveDot)  { liveDot.style.background = 'var(--text-muted)'; liveDot.style.boxShadow = ''; }
    if (statusTxt){ statusTxt.textContent = 'STOPPED'; statusTxt.style.color = 'var(--accent-amber)'; }
    supLog('⚠ Stop requested — current ops finishing...', 'warn');
  };

  // ── onPageEnter: init when page becomes visible ──
  window.supOnPageEnter = function() {
    window.supSwitchTab('keys');
    setTimeout(function() {
      try {
        var _rawSupPks = localStorage.getItem('one_sup_pks');
        var area  = supGid('sup-pkArea');
        if (_rawSupPks && area && !area.value) {
          Promise.resolve(OneCrypto.decrypt(_rawSupPks)).then(function(_decSupPks) {
            // Only use decrypted value — never expose raw ncx4 blob in UI
            if (_decSupPks && area && !area.value) { area.value = _decSupPks; window.supOnPkInput(); }
          }).catch(function() { /* decrypt failed — leave textarea empty */ });
        }
      } catch(_) {}
      supLog('SUP Transfer Bot v2 ready ✓', 'ok');
      supLog('Keys tab-এ private key গুলো দিন → Start করুন', 'acc');
      supLog('সব wallet থেকে একসাথে token যাবে recipient-এ', 'muted');
    }, 100);
  };

  // ── Auto-restore on first load (AES-decrypted) ──
  (function() {
    try {
      var _rawSup11 = localStorage.getItem('one_sup_pks');
      if (_rawSup11) {
        document.addEventListener('DOMContentLoaded', function() {
          Promise.resolve(OneCrypto.decrypt(_rawSup11)).then(function(_decSup11) {
            // Only use decrypted value — never expose raw ncx4 blob in UI
            var area = supGid('sup-pkArea');
            if (_decSup11 && area && !area.value) { area.value = _decSup11; window.supOnPkInput(); }
          }).catch(function() { /* decrypt failed — leave textarea empty */ });
        });
      }
    } catch(_) {}
  })();

})();
