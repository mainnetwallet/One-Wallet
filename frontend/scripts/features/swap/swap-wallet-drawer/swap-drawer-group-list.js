
// Swap wallet drawer list (shared wallet drawer UI, multi select).
// One accordion list: tick a group for all its wallets, or expand it and tick any wallets.
// Selection: swapSelectedGroupIds (groups in use) + swapSelectedKeyMap (groupId -> Set of key index).
// A selected group with an empty key set means "all keys of the group".
var _swapDrawerOpen = new Set();   // expanded group ids

function _swapGroupKeySelected(g, ki) {
  if (typeof swapSelectedGroupIds === 'undefined' || !swapSelectedGroupIds.includes(g.id)) return false;
  var set = (typeof swapSelectedKeyMap !== 'undefined') ? swapSelectedKeyMap[g.id] : null;
  return !set || set.size === 0 || set.has(ki);
}

function _swapDrawerApplyChange() {
  if (typeof _saveSwapSelectedKeyMap === 'function') _saveSwapSelectedKeyMap();
  if (typeof saveSwapSelectedGroupIds === 'function') saveSwapSelectedGroupIds();
  if (typeof applyMultiGroupSelection === 'function') applyMultiGroupSelection();
  if (typeof renderSwapGroupList === 'function') renderSwapGroupList();
  _renderSwapWalletGroupList();
}

function _swapDrawerToggleGroup(g) {
  var i = swapSelectedGroupIds.indexOf(g.id);
  var keysSel = g.keys.filter(function(_, ki) { return _swapGroupKeySelected(g, ki); }).length;
  if (i !== -1 && keysSel === g.keys.length) {
    swapSelectedGroupIds.splice(i, 1);
    if (typeof swapSelectedKeyMap !== 'undefined') delete swapSelectedKeyMap[g.id];
    showToast(g.name + ' deselected', 'folder');
  } else {
    if (i === -1) swapSelectedGroupIds.push(g.id);
    if (typeof swapSelectedKeyMap !== 'undefined') swapSelectedKeyMap[g.id] = new Set();
    showToast(g.name + ' selected', 'folder_special');
  }
  _swapDrawerApplyChange();
}

function _swapDrawerToggleKey(g, ki) {
  var i = swapSelectedGroupIds.indexOf(g.id);
  var set = _getGroupKeySet(g.id);
  if (i === -1) {
    // First wallet picked from an unselected group: start an explicit selection
    swapSelectedGroupIds.push(g.id);
    set.clear(); set.add(ki);
  } else if (set.size === 0) {
    // Group was "all keys": untick this one, keep the rest
    g.keys.forEach(function(_, k) { if (k !== ki) set.add(k); });
  } else if (set.has(ki)) {
    set.delete(ki);
  } else {
    set.add(ki);
  }
  // Nothing left ticked: the group is no longer in use
  if (i !== -1 && set.size === 0) {
    swapSelectedGroupIds.splice(i, 1);
    delete swapSelectedKeyMap[g.id];
  }
  _swapDrawerApplyChange();
}

function _renderSwapWalletGroupList() {
  const list       = document.getElementById('swap-wallet-drawer-list');
  // Reset inline styles so del-drawer-body CSS class takes over
  if (list) list.style.cssText = '';
  const badge      = document.getElementById('swap-wallet-drawer-badge');
  const title      = document.getElementById('swap-wallet-drawer-title');
  const backBtn    = document.getElementById('swap-wallet-drawer-back-btn');
  const closeBtn   = document.getElementById('swap-wallet-drawer-close-btn');
  const confirmBtn = document.getElementById('swap-wallet-drawer-confirm-btn');
  const confirmLbl = document.getElementById('swap-wallet-drawer-confirm-label');
  const actionsRow = document.getElementById('swap-wallet-drawer-actions');
  if (!list) return;

  const groups   = loadWalletGroups().filter(g => g && g.keys && g.keys.length > 0);
  const selCount = (typeof swapSelectedGroupIds !== 'undefined') ? swapSelectedGroupIds.length : 0;
  const totalKeys= (typeof validatedKeys !== 'undefined') ? validatedKeys.length : 0;

  if (badge)      badge.textContent  = groups.length + ' GROUP' + (groups.length !== 1 ? 'S' : '');
  if (title)      title.textContent  = 'Select Wallet';
  if (backBtn)    backBtn.style.display  = 'none';
  if (closeBtn)   closeBtn.style.display = 'flex';
  if (actionsRow) actionsRow.style.display = groups.length > 0 ? 'flex' : 'none';

  // Confirm button
  if (confirmBtn) confirmBtn.style.display = selCount > 0 ? 'flex' : 'none';
  if (confirmLbl) {
    if (_swapDrawerMode === 'profile') {
      confirmLbl.textContent = selCount > 0
        ? 'Open Swap (' + selCount + ' group' + (selCount !== 1 ? 's' : '') + ')'
        : 'Open Swap';
    } else {
      confirmLbl.textContent = selCount > 0
        ? 'Confirm (' + selCount + ' group' + (selCount !== 1 ? 's' : '') + ' · ' + totalKeys + ' keys)'
        : 'Confirm Selection';
    }
  }

  WDU.renderList(list, {
    mode: 'multi',
    groups: groups,
    isOpen: function(gi) { return _swapDrawerOpen.has(groups[gi].id); },
    isKeySel: function(gi, ki) { return _swapGroupKeySelected(groups[gi], ki); },
    keyInfo: function(gi, ki, pk) {
      return { title: 'Wallet ' + (ki + 1), sub: WDU.short(WDU.addressOf(pk), 6, 4) };
    },
    onExpand: function(gi) { WDU.toggleInSet(_swapDrawerOpen, groups[gi].id); _renderSwapWalletGroupList(); },
    onGroup: function(gi) { _swapDrawerToggleGroup(groups[gi]); },
    onKey: function(gi, ki) { _swapDrawerToggleKey(groups[gi], ki); }
  });

  // Update step-1 button sub-label if in step1 mode
  var subEl = document.getElementById('swap-group-btn-sub');
  if (subEl) {
    subEl.textContent = selCount > 0
      ? selCount + ' GROUP' + (selCount !== 1 ? 'S' : '') + ' SELECTED · ' + totalKeys + ' KEYS'
      : 'TAP TO CHOOSE GROUPS';
    subEl.style.color = selCount > 0 ? 'var(--accent-green)' : '';
  }
}
