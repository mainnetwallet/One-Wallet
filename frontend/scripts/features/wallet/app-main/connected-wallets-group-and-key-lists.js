
// ── Root: group list ──────────────────────────────────────────
function _renderCwGroupList() {
  const list    = document.getElementById('cw-drawer-list');
  const badge   = document.getElementById('cw-drawer-badge');
  const title   = document.getElementById('cw-drawer-title');
  const backBtn = document.getElementById('cw-drawer-back-btn');
  const closeBtn= document.getElementById('cw-drawer-close-btn');
  const copyBtn = document.getElementById('cw-copy-all-btn');
  const copyLbl = document.getElementById('cw-copy-label');
  if (!list) return;

  const groups = loadWalletGroups().filter(g => g && g.keys && g.keys.length > 0);
  const totalWallets = groups.reduce((s, g) => s + g.keys.length, 0);

  if (badge)   badge.textContent  = groups.length + ' GROUP' + (groups.length !== 1 ? 'S' : '');
  if (title)   title.textContent  = 'Connected Wallets';
  if (backBtn) backBtn.style.display = 'none';
  if (closeBtn)closeBtn.style.display = 'flex';
  if (copyLbl) copyLbl.textContent = 'Copy All (' + totalWallets + ' addresses)';
  if (copyBtn) copyBtn.style.display = totalWallets > 0 ? 'flex' : 'none';

  list.innerHTML = '';

  if (groups.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:50px 20px;font-family:var(--font-mono);font-size:11px;color:var(--text-muted);line-height:2.2;"><div style="font-size:32px;margin-bottom:10px;">📁</div>NO GROUPS FOUND<br><span style="font-size:10px;opacity:0.5;">Import in Settings first</span></div>';
    return;
  }

  // Hint row
  const hintEl = document.createElement('div');
  hintEl.style.cssText = 'font-family:var(--font-mono);font-size:9px;color:var(--text-muted);letter-spacing:1px;padding:0 4px 10px;text-align:center;';
  hintEl.textContent = 'TAP = SELECT GROUP   •   → = VIEW & SELECT KEYS';
  list.appendChild(hintEl);

  groups.forEach(function(g, idx) {
    var clr      = WG_COLORS[idx % WG_COLORS.length];
    var isActive = selectedGroupIds.includes(g.id);

    // Count selected keys in this group
    var selKeys = _cwGetSelectedKeys(g.id);
    var selKeyCount = selKeys.size;
    var keySelBadge = selKeyCount > 0
      ? '<div style="font-size:8px;font-weight:800;font-family:var(--font-mono);letter-spacing:1px;padding:2px 7px;border-radius:6px;background:rgba(6,182,212,0.15);border:1px solid rgba(6,182,212,0.35);color:var(--neon-cyan);white-space:nowrap;">' + selKeyCount + ' KEY' + (selKeyCount !== 1 ? 'S' : '') + '</div>'
      : '';

    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:8px;';

    // Main card (select/deselect group)
    var card = document.createElement('div');
    card.className = 'del-drawer-item' + (isActive ? ' selected' : '');
    card.style.cssText = 'flex:1;cursor:pointer;position:relative;transition:all 0.2s ease;display:flex;align-items:center;gap:6px;padding:6px 24px 6px 7px;border-radius:8px;';

    var checkIcon = isActive
      ? '<div style="position:absolute;top:50%;right:6px;transform:translateY(-50%);width:14px;height:14px;border-radius:4px;background:var(--accent-primary);display:flex;align-items:center;justify-content:center;box-shadow:0 0 6px rgba(99,102,241,0.5);flex-shrink:0;"><span class="material-icons-round" style="font-size:10px;color:#fff;">check</span></div>'
      : '<div style="position:absolute;top:50%;right:6px;transform:translateY(-50%);width:14px;height:14px;border-radius:4px;background:var(--bg-raised);border:1.5px solid var(--border-subtle);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span class="material-icons-round" style="font-size:10px;color:var(--text-muted);">radio_button_unchecked</span></div>';

    var activeBadge = isActive
      ? '<div style="font-size:7px;font-weight:800;font-family:var(--font-mono);letter-spacing:1px;padding:1px 5px;border-radius:4px;background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.4);color:var(--accent-primary);white-space:nowrap;display:inline-block;margin-top:2px;">● GROUP</div>'
      : '';

    card.innerHTML =
      '<div style="width:22px;height:22px;border-radius:7px;background:' + clr.num + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:10px;font-weight:900;color:#fff;box-shadow:0 2px 8px ' + clr.glow + ';">' + (g.emoji || (idx + 1)) + '</div>' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:9px;font-weight:800;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + g.name + '</div>' +
        '<div style="display:flex;align-items:center;gap:4px;flex-wrap:nowrap;">' +
          '<div style="font-size:8px;font-family:var(--font-mono);margin-top:1px;color:' + clr.accent + ';font-weight:700;">' + g.keys.length + 'w</div>' +
          activeBadge + keySelBadge +
        '</div>' +
      '</div>' +
      checkIcon;

    // Arrow button → opens key list
    var arrowBtn = document.createElement('button');
    arrowBtn.style.cssText = 'flex-shrink:0;width:22px;height:22px;border-radius:7px;border:1px solid ' + clr.border + ';background:' + clr.bg + ';display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.2s ease;padding:0;';
    arrowBtn.innerHTML = '<span class="material-icons-round" style="font-size:12px;color:' + clr.accent + ';">chevron_right</span>';
    arrowBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      _cwExpandedGroupId = g.id;
      _renderCwDrawer();
      haptic();
    });
    arrowBtn.addEventListener('touchstart', function() { arrowBtn.style.opacity='0.7'; }, {passive:true});
    arrowBtn.addEventListener('touchend',   function() { arrowBtn.style.opacity='1'; });

    // Card tap = toggle select/deselect group + all its keys
    card.addEventListener('click', function() {
      var i2 = selectedGroupIds.indexOf(g.id);
      if (i2 !== -1) {
        selectedGroupIds.splice(i2, 1);
        // deselect all keys in this group
        _cwGetSelectedKeys(g.id).clear();
        showToast(g.name + ' deselected', 'folder');
      } else {
        selectedGroupIds.push(g.id);
        // select all keys in this group
        var ks = _cwGetSelectedKeys(g.id);
        g.keys.forEach(function(k, i) { ks.add(i); });
        showToast(g.name + ' selected', 'folder_special');
      }
      saveSelectedGroupIds();
      applySettingsGroupSelection();
      renderWalletGroupsList();
      _renderCwGroupList();
      haptic();
    });

    wrap.appendChild(card);
    wrap.appendChild(arrowBtn);
    list.appendChild(wrap);
  });
}

// ── Drill: individual wallet list for one group ───────────────
function _renderCwKeyList(groupId) {
  const list    = document.getElementById('cw-drawer-list');
  const badge   = document.getElementById('cw-drawer-badge');
  const title   = document.getElementById('cw-drawer-title');
  const backBtn = document.getElementById('cw-drawer-back-btn');
  const closeBtn= document.getElementById('cw-drawer-close-btn');
  const copyLbl = document.getElementById('cw-copy-label');
  if (!list) return;

  const groups = loadWalletGroups();
  const g = groups.find(g => g.id === groupId);
  if (!g) { _cwExpandedGroupId = null; _renderCwGroupList(); return; }

  const idx = groups.indexOf(g);
  const clr = WG_COLORS[idx % WG_COLORS.length];
  const selSet = _cwGetSelectedKeys(groupId);

  function refreshBadgeAndCopy() {
    const sc = selSet.size;
    if (badge) badge.textContent = sc > 0 ? sc + '/' + g.keys.length + ' SELECTED' : g.keys.length + ' WALLET' + (g.keys.length !== 1 ? 'S' : '');
    if (copyLbl) copyLbl.textContent = sc > 0 ? 'Copy Selected (' + sc + ')' : 'Copy All (' + g.keys.length + ')';
  }

  if (title)   title.textContent = g.name;
  if (backBtn) backBtn.style.display = 'flex';
  if (closeBtn)closeBtn.style.display = 'none';
  refreshBadgeAndCopy();

  list.innerHTML = '';

  // Select All / Deselect All bar
  const selAllBar = document.createElement('div');
  selAllBar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:0 4px 10px;';
  selAllBar.innerHTML =
    '<span style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);letter-spacing:1px;">TAP = SELECT KEY   •   COPY ICON = COPY ADDR</span>' +
    '<button id="cw-sel-all-btn" style="padding:4px 10px;border-radius:8px;border:1px solid ' + clr.border + ';background:' + clr.bg + ';color:' + clr.accent + ';font-family:var(--font-mono);font-size:9px;font-weight:700;cursor:pointer;letter-spacing:1px;transition:all 0.2s;">' +
      (selSet.size === g.keys.length ? 'DESELECT ALL' : 'SELECT ALL') +
    '</button>';
  list.appendChild(selAllBar);

  selAllBar.querySelector('#cw-sel-all-btn').addEventListener('click', function() {
    _cwSelectAllKeys(groupId, g.keys.length);
    _renderCwKeyList(groupId);
    haptic();
  });

  g.keys.forEach((pk, i) => {
    let addr = '';
    try { addr = new ethers.Wallet(pk).address; } catch {}
    const short = addr ? addr.slice(0, 10) + '…' + addr.slice(-8) : '—';

    const isKeySelected = selSet.has(i);

    const row = document.createElement('div');
    row.style.cssText = `display:flex;align-items:center;gap:10px;padding:11px 12px;
      background:${isKeySelected ? 'rgba(99,102,241,0.09)' : 'linear-gradient(145deg,var(--bg-glass),rgba(15,15,25,0.5))'};
      border:1.5px solid ${isKeySelected ? 'rgba(99,102,241,0.45)' : 'var(--border-subtle)'};
      border-radius:14px;cursor:pointer;transition:all 0.2s ease;margin-bottom:7px;
      animation:slideIn 0.22s ease both;animation-delay:${i * 0.03}s;`;

    const checkIcon = isKeySelected
      ? `<div style="width:24px;height:24px;border-radius:7px;background:var(--accent-primary);display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 0 8px rgba(99,102,241,0.5);"><span class="material-icons-round" style="font-size:14px;color:#fff;">check</span></div>`
      : `<div style="width:24px;height:24px;border-radius:7px;background:var(--bg-raised);border:1.5px solid var(--border-subtle);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span class="material-icons-round" style="font-size:13px;color:var(--text-muted);">radio_button_unchecked</span></div>`;

    row.innerHTML = `
      ${checkIcon}
      <div style="width:34px;height:34px;border-radius:10px;background:${clr.num};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;font-weight:900;color:#fff;box-shadow:0 2px 8px ${clr.glow};">${i + 1}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:11px;font-weight:700;color:${isKeySelected ? 'var(--neon-purple)' : 'var(--text-secondary)'};font-family:var(--font-mono);">Wallet #${i + 1}</div>
        <div style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${short}</div>
      </div>
      <div id="cw-row-copy-${i}" style="width:32px;height:32px;border-radius:9px;background:${clr.bg};border:1px solid ${clr.border};display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.2s;">
        <span class="material-icons-round" style="font-size:15px;color:${clr.accent};">content_copy</span>
      </div>`;

    // Tap row = toggle select
    row.addEventListener('click', (e) => {
      // Don't trigger if copy btn clicked
      if (e.target.closest('#cw-row-copy-' + i)) return;
      _cwToggleKey(groupId, i);
      refreshBadgeAndCopy();
      // Update row style in-place
      const sc2 = selSet.has(i);
      row.style.background = sc2 ? 'rgba(99,102,241,0.09)' : 'linear-gradient(145deg,var(--bg-glass),rgba(15,15,25,0.5))';
      row.style.borderColor = sc2 ? 'rgba(99,102,241,0.45)' : 'var(--border-subtle)';
      const chk = row.querySelector('div:first-child');
      if (chk) chk.outerHTML; // re-render check icon
      // Re-render this row's check icon
      const firstDiv = row.querySelector('div');
      if (firstDiv) {
        firstDiv.style.background = sc2 ? 'var(--accent-primary)' : 'var(--bg-raised)';
        firstDiv.style.border = sc2 ? 'none' : '1.5px solid var(--border-subtle)';
        firstDiv.style.boxShadow = sc2 ? '0 0 8px rgba(99,102,241,0.5)' : 'none';
        const ico = firstDiv.querySelector('.material-icons-round');
        if (ico) { ico.textContent = sc2 ? 'check' : 'radio_button_unchecked'; ico.style.color = sc2 ? '#fff' : 'var(--text-muted)'; ico.style.fontSize = sc2 ? '14px' : '13px'; }
      }
      const walletLabel = row.querySelectorAll('.material-icons-round')[2];
      // Update wallet label color
      const walletDiv = row.querySelector('div:nth-child(4) div:first-child');
      if (walletDiv) walletDiv.style.color = sc2 ? 'var(--neon-purple)' : 'var(--text-secondary)';
      showToast(sc2 ? 'Key #' + (i+1) + ' selected' : 'Key #' + (i+1) + ' deselected', sc2 ? 'key' : 'key_off');
      haptic();
    });

    // Copy icon tap = copy address only
    const copyBtn2 = row.querySelector('#cw-row-copy-' + i);
    if (copyBtn2) {
      copyBtn2.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!addr) return;
        navigator.clipboard?.writeText(addr).catch(() => {
          const ta = document.createElement('textarea');
          ta.value = addr; document.body.appendChild(ta);
          ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
        });
        copyBtn2.style.background = 'rgba(16,185,129,0.2)';
        copyBtn2.style.borderColor = 'rgba(16,185,129,0.4)';
        copyBtn2.innerHTML = '<span class="material-icons-round" style="font-size:15px;color:var(--accent-green);">check</span>';
        setTimeout(() => {
          copyBtn2.style.background = clr.bg;
          copyBtn2.style.borderColor = clr.border;
          copyBtn2.innerHTML = `<span class="material-icons-round" style="font-size:15px;color:${clr.accent};">content_copy</span>`;
        }, 1500);
        showToast('W' + (i + 1) + ' copied!', 'content_copy');
        haptic();
      });
    }

    list.appendChild(row);
  });
}

