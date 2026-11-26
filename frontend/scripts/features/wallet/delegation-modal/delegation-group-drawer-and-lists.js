// ── Delegation group multi-select state ──
let delSelectedGroupIds = [];

// ── Render group checkbox list ──
// ══════════════════════════════════════════════════════════════
// DEL GROUP DRAWER — Nested Group + Individual Key Selection
// State:
//   delSelectedGroupIds  = Set of group IDs whose ALL keys are checked
//   _delSelectedKeys     = Set of individual private-key strings
//   _delExpandedGroupId  = which group is currently expanded (null = group list view)
// ══════════════════════════════════════════════════════════════
let _delSelectedKeys     = new Set();  // individual key selection
let _delExpandedGroupId  = null;       // null = root list; string = key-list view

function openDelGroupDrawer() {
  const overlay = document.getElementById('del-group-drawer-overlay');
  if (!overlay) return;
  var _dr = document.getElementById('del-group-drawer');
  if (_dr) { _dr.style.transition = 'none'; _dr.style.transform = 'translateX(100%)'; }
  overlay.style.opacity = '0'; overlay.style.pointerEvents = 'none';
  _delExpandedGroupId = null;
  _renderDelDrawer();
  overlay.classList.add('open');
  requestAnimationFrame(function() { requestAnimationFrame(function() {
    if (_dr) { _dr.style.transition = ''; _dr.style.transform = ''; }
    overlay.style.opacity = ''; overlay.style.pointerEvents = '';
  }); });
  haptic && haptic();
}

function closeDelGroupDrawer() {
  var ov = document.getElementById('del-group-drawer-overlay');
  var dr = document.getElementById('del-group-drawer');
  if (ov) { ov.style.opacity = '0'; ov.style.pointerEvents = 'none'; }
  if (dr) { dr.style.transition = 'transform 0.28s cubic-bezier(0.4,0,0.6,1)'; dr.style.transform = 'translateX(100%)'; }
  setTimeout(function() {
    if (ov) ov.classList.remove('open');
    if (dr) { dr.style.transition = ''; }
    _delExpandedGroupId = null;
  }, 300);
  haptic && haptic();
}

function handleDelDrawerOverlayClick(e) {
  if (e.target === document.getElementById('del-group-drawer-overlay')) closeDelGroupDrawer();
}

// ── Master render dispatcher ────────────────────────────────
function _renderDelDrawer() {
  if (_delExpandedGroupId) {
    _renderDelKeyList(_delExpandedGroupId);
  } else {
    _renderDelGroupList();
  }
  _updateDelDrawerFooter();
}

// ── Root: group list ────────────────────────────────────────
function _renderDelGroupList() {
  const list  = document.getElementById('del-drawer-group-list');
  const badge = document.getElementById('del-drawer-count-badge');
  const title = document.getElementById('del-drawer-title');
  const backBtn = document.getElementById('del-drawer-back-btn');
  if (!list) return;

  const groups = loadWalletGroups().filter(g => g && g.keys && g.keys.length > 0);

  if (badge) badge.textContent = groups.length + ' GROUP' + (groups.length !== 1 ? 'S' : '');
  if (title) title.textContent = 'Wallet Groups';
  if (backBtn) backBtn.style.display = 'none';
  const closeBtn = document.getElementById('del-drawer-close-btn');
  if (closeBtn) closeBtn.style.display = 'flex';

  if (groups.length === 0) {
    list.innerHTML = `<div style="text-align:center;padding:50px 20px;font-family:var(--font-mono);font-size:11px;color:var(--text-muted);line-height:2.2;">
      <div style="font-size:32px;margin-bottom:10px;">📁</div>
      NO GROUPS FOUND<br><span style="font-size:10px;opacity:0.5;">Import in Settings first</span>
    </div>`;
    return;
  }

  // Prune stale group IDs
  delSelectedGroupIds = delSelectedGroupIds.filter(id => groups.find(g => g.id === id));

  list.innerHTML = '';
  groups.forEach((g, idx) => {
    const clr = WG_COLORS[idx % WG_COLORS.length];

    // Count how many individual keys from this group are selected
    const selectedInGroup = g.keys.filter(k => _delSelectedKeys.has(k)).length;
    const allSelected     = selectedInGroup === g.keys.length;
    const someSelected    = selectedInGroup > 0 && !allSelected;
    const groupChecked    = delSelectedGroupIds.includes(g.id) || allSelected;

    const wrap = document.createElement('div');
    wrap.style.cssText = 'margin-bottom:8px;';

    wrap.innerHTML = `
      <div class="del-drawer-item${groupChecked ? ' selected' : ''}" data-gid="${g.id}" style="position:relative;" onclick="_delToggleGroup('${g.id}')">
        <!-- Checkbox: toggles whole group -->
        <div class="del-drawer-check" id="del-dchk-${g.id}" onclick="event.stopPropagation();_delToggleGroup('${g.id}')">
          <span class="material-icons-round">${someSelected ? 'remove' : 'check'}</span>
        </div>
        <!-- Colored badge -->
        <div style="width:40px;height:40px;border-radius:12px;background:${clr.num};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:17px;font-weight:900;color:#fff;box-shadow:0 2px 10px ${clr.glow};">
          ${g.emoji || (idx+1)}
        </div>
        <!-- Info -->
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:800;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${g.name}</div>
          <div style="font-size:10px;font-family:var(--font-mono);margin-top:2px;color:${clr.accent};font-weight:700;">
            ${selectedInGroup > 0 ? selectedInGroup + '/' + g.keys.length + ' selected' : g.keys.length + ' key' + (g.keys.length !== 1 ? 's' : '')}
          </div>
        </div>
        <!-- Expand arrow → opens key list -->
        <div onclick="event.stopPropagation();_delOpenKeyList('${g.id}')"
          style="width:34px;height:34px;border-radius:9px;background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.25);display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;transition:all 0.15s ease;"
          onmousedown="this.style.background='rgba(99,102,241,0.22)'" onmouseup="this.style.background='rgba(99,102,241,0.1)'"
          ontouchstart="this.style.background='rgba(99,102,241,0.22)'" ontouchend="this.style.background='rgba(99,102,241,0.1)'"
          title="View individual keys">
          <span class="material-icons-round" style="font-size:16px;color:var(--accent-primary);">chevron_right</span>
        </div>
      </div>`;

    // Style partial selection
    if (someSelected) {
      const chk = wrap.querySelector(`#del-dchk-${g.id}`);
      if (chk) { chk.style.background = 'rgba(99,102,241,0.5)'; chk.style.borderColor = 'var(--accent-primary)'; }
    }

    list.appendChild(wrap);
  });
}

// ── Drill: individual key list for one group ────────────────
function _renderDelKeyList(groupId) {
  const list  = document.getElementById('del-drawer-group-list');
  const badge = document.getElementById('del-drawer-count-badge');
  const title = document.getElementById('del-drawer-title');
  const backBtn = document.getElementById('del-drawer-back-btn');
  if (!list) return;

  const groups = loadWalletGroups();
  const g = groups.find(g => g.id === groupId);
  if (!g) { _delExpandedGroupId = null; _renderDelGroupList(); return; }

  const idx  = groups.indexOf(g);
  const clr  = WG_COLORS[idx % WG_COLORS.length];
  const selCount = g.keys.filter(k => _delSelectedKeys.has(k)).length;

  if (badge) badge.textContent = selCount + '/' + g.keys.length + ' SELECTED';
  if (title) title.textContent = g.name;
  if (backBtn) backBtn.style.display = 'flex';
  const closeBtn2 = document.getElementById('del-drawer-close-btn');
  if (closeBtn2) closeBtn2.style.display = 'none';

  list.innerHTML = '';

  // Select-all row for this group
  const allChk = document.createElement('div');
  allChk.style.cssText = 'display:flex;align-items:center;gap:6px;padding:6px 8px;margin-bottom:6px;border-radius:8px;background:rgba(99,102,241,0.07);border:1px solid rgba(99,102,241,0.2);cursor:pointer;';
  allChk.innerHTML = `
    <span class="material-icons-round" style="font-size:12px;color:var(--accent-primary);">select_all</span>
    <span style="font-size:9px;font-weight:700;color:var(--text-primary);flex:1;">Select all in "${g.name}"</span>
    <span style="font-size:8px;font-family:var(--font-mono);color:${clr.accent};font-weight:700;">${selCount}/${g.keys.length}</span>`;
  allChk.onclick = () => {
    const allIn = g.keys.every(k => _delSelectedKeys.has(k));
    if (allIn) { g.keys.forEach(k => _delSelectedKeys.delete(k)); }
    else { g.keys.forEach(k => _delSelectedKeys.add(k)); }
    // sync group-level state
    if (!allIn) { if (!delSelectedGroupIds.includes(g.id)) delSelectedGroupIds.push(g.id); }
    else { delSelectedGroupIds = delSelectedGroupIds.filter(id => id !== g.id); }
    _renderDelKeyList(groupId);
    _updateDelDrawerFooter();
    haptic && haptic();
  };
  list.appendChild(allChk);

  // Individual key rows
  g.keys.forEach((pk, i) => {
    let addr = '';
    try { addr = new ethers.Wallet(pk).address; } catch {}
    const short = addr ? addr.slice(0,10) + '…' + addr.slice(-6) : '—';
    const isChk = _delSelectedKeys.has(pk);

    const row = document.createElement('div');
    row.className = 'del-drawer-item' + (isChk ? ' selected' : '');
    row.style.marginBottom = '4px';
    row.innerHTML = `
      <div style="width:14px;height:14px;border-radius:4px;flex-shrink:0;border:1.5px solid var(--border-subtle);background:${isChk ? 'var(--accent-primary)' : 'var(--bg-raised)'};display:flex;align-items:center;justify-content:center;transition:all 0.2s;">
        ${isChk ? '<span class="material-icons-round" style="font-size:10px;color:#fff;">check</span>' : ''}
      </div>
      <div style="width:20px;height:20px;border-radius:6px;background:${clr.num};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:9px;font-weight:900;color:#fff;">${i+1}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:9px;font-weight:700;color:var(--text-secondary);">Wallet #${i+1}</div>
        <div style="font-family:var(--font-mono);font-size:8px;color:var(--text-muted);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${short}</div>
      </div>`;
    row.onclick = () => {
      if (_delSelectedKeys.has(pk)) _delSelectedKeys.delete(pk);
      else _delSelectedKeys.add(pk);
      // Keep group-level in sync: if any key selected, mark group
      const anyIn = g.keys.some(k => _delSelectedKeys.has(k));
      if (anyIn) { if (!delSelectedGroupIds.includes(g.id)) delSelectedGroupIds.push(g.id); }
      else { delSelectedGroupIds = delSelectedGroupIds.filter(id => id !== g.id); }
      _renderDelKeyList(groupId);
      _updateDelDrawerFooter();
      _delAutoImport();
      haptic && haptic();
    };
    list.appendChild(row);
  });
}

function _delOpenKeyList(groupId) {
  _delExpandedGroupId = groupId;
  _renderDelDrawer();
  haptic && haptic();
}

function _delGoBack() {
  _delExpandedGroupId = null;
  _renderDelDrawer();
  haptic && haptic();
}

