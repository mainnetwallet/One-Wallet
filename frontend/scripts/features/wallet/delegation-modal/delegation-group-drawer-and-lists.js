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
  _delOpenGroups = new Set();
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

// ── Group list (shared wallet drawer UI, multi select) ───────
// One accordion list: tick a group for all its wallets, or expand it and tick any wallets.
let _delOpenGroups = new Set();   // expanded group ids

function _renderDelGroupList() {
  const list  = document.getElementById('del-drawer-group-list');
  const badge = document.getElementById('del-drawer-count-badge');
  const title = document.getElementById('del-drawer-title');
  const backBtn = document.getElementById('del-drawer-back-btn');
  const closeBtn = document.getElementById('del-drawer-close-btn');
  if (!list) return;

  const groups = loadWalletGroups().filter(g => g && g.keys && g.keys.length > 0);

  if (badge) badge.textContent = groups.length + ' GROUP' + (groups.length !== 1 ? 'S' : '');
  if (title) title.textContent = 'Wallet Groups';
  if (backBtn) backBtn.style.display = 'none';
  if (closeBtn) closeBtn.style.display = 'flex';

  // Prune stale group IDs
  delSelectedGroupIds = delSelectedGroupIds.filter(id => groups.find(g => g.id === id));

  WDU.renderList(list, {
    mode: 'multi',
    groups: groups,
    isOpen: function(gi) { return _delOpenGroups.has(groups[gi].id); },
    isKeySel: function(gi, ki) { return _delSelectedKeys.has(groups[gi].keys[ki]); },
    keyInfo: function(gi, ki, pk) {
      return { title: 'Wallet #' + (ki + 1), sub: WDU.short(WDU.addressOf(pk), 10, 6) };
    },
    onExpand: function(gi) { WDU.toggleInSet(_delOpenGroups, groups[gi].id); _renderDelGroupList(); },
    onGroup: function(gi) { _delToggleGroup(groups[gi].id); },
    onKey: function(gi, ki) {
      const g = groups[gi];
      const pk = g.keys[ki];
      if (_delSelectedKeys.has(pk)) _delSelectedKeys.delete(pk);
      else _delSelectedKeys.add(pk);
      // Keep group-level in sync: marked while any of its keys is selected
      const anyIn = g.keys.some(k => _delSelectedKeys.has(k));
      if (anyIn) { if (!delSelectedGroupIds.includes(g.id)) delSelectedGroupIds.push(g.id); }
      else { delSelectedGroupIds = delSelectedGroupIds.filter(id => id !== g.id); }
      _renderDelGroupList();
      _updateDelDrawerFooter();
      _delAutoImport();
    }
  });
}

// Legacy name: the drawer is one list now, there is no separate key view.
function _renderDelKeyList() { _renderDelGroupList(); }

function _delOpenKeyList(groupId) {
  WDU.toggleInSet(_delOpenGroups, groupId);
  _renderDelDrawer();
  haptic && haptic();
}

function _delGoBack() {
  _delExpandedGroupId = null;
  _renderDelDrawer();
  haptic && haptic();
}

