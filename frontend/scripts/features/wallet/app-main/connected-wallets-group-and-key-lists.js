// ── Connected wallets drawer list (shared wallet drawer UI, multi select) ──
// One accordion list: tick a group for all its wallets, or expand it and tick any wallets.
// Selection state lives in selectedGroupIds + _cwSelectedKeys (groupId -> Set of key index).
var _cwOpen = new Set();   // expanded group indices

// A group is "selected" while it has at least one ticked wallet.
function _cwSyncGroupMembership(g) {
  const set = _cwGetSelectedKeys(g.id);
  const at = selectedGroupIds.indexOf(g.id);
  if (set.size > 0 && at === -1) selectedGroupIds.push(g.id);
  else if (set.size === 0 && at !== -1) selectedGroupIds.splice(at, 1);
}

function _cwApplySelection() {
  saveSelectedGroupIds();
  applySettingsGroupSelection();
  if (typeof renderWalletGroupsList === 'function') renderWalletGroupsList();
  if (typeof updateProfileStats === 'function') updateProfileStats();
}

function _cwCopyAddress(addr, n) {
  if (!addr) return;
  navigator.clipboard?.writeText(addr).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = addr; document.body.appendChild(ta);
    ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
  });
  showToast('W' + n + ' copied!', 'content_copy');
}

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

  // Wallets the copy button will copy: selected keys of selected groups, otherwise everything
  const activeGroups = selectedGroupIds.length > 0 ? groups.filter(g => selectedGroupIds.includes(g.id)) : groups;
  const copyCount = activeGroups.reduce((s, g) => {
    const sel = _cwGetSelectedKeys(g.id);
    return s + (sel.size > 0 ? sel.size : g.keys.length);
  }, 0);
  const hasSel = selectedGroupIds.length > 0;

  if (badge)    badge.textContent = groups.length + ' GROUP' + (groups.length !== 1 ? 'S' : '');
  if (title)    title.textContent = 'Connected Wallets';
  if (backBtn)  backBtn.style.display = 'none';
  if (closeBtn) closeBtn.style.display = 'flex';
  if (copyLbl)  copyLbl.textContent = hasSel ? 'Copy Selected (' + copyCount + ')' : 'Copy All (' + totalWallets + ' addresses)';
  if (copyBtn)  copyBtn.style.display = totalWallets > 0 ? 'flex' : 'none';

  WDU.renderList(list, {
    mode: 'multi',
    groups: groups,
    isOpen: function(gi) { return _cwOpen.has(gi); },
    isKeySel: function(gi, ki) { return _cwGetSelectedKeys(groups[gi].id).has(ki); },
    keyInfo: function(gi, ki, pk) {
      return { title: 'Wallet #' + (ki + 1), sub: WDU.short(WDU.addressOf(pk), 10, 8) };
    },
    keyAction: {
      icon: 'content_copy',
      label: 'Copy address',
      onTap: function(gi, ki, el) {
        _cwCopyAddress(WDU.addressOf(groups[gi].keys[ki]), ki + 1);
        const ico = el.querySelector('.material-icons-round');
        if (ico) { ico.textContent = 'check'; setTimeout(function() { ico.textContent = 'content_copy'; }, 1500); }
      }
    },
    onExpand: function(gi) { WDU.toggleInSet(_cwOpen, gi); _renderCwGroupList(); },
    onGroup: function(gi) {
      const g = groups[gi];
      const set = _cwGetSelectedKeys(g.id);
      if (set.size === g.keys.length) {
        set.clear();
        showToast(g.name + ' deselected', 'folder');
      } else {
        g.keys.forEach(function(_, i) { set.add(i); });
        showToast(g.name + ' selected', 'folder_special');
      }
      _cwSyncGroupMembership(g);
      _cwApplySelection();
      _renderCwGroupList();
    },
    onKey: function(gi, ki) {
      const g = groups[gi];
      const set = _cwGetSelectedKeys(g.id);
      if (set.has(ki)) set.delete(ki); else set.add(ki);
      _cwSyncGroupMembership(g);
      _cwApplySelection();
      _renderCwGroupList();
    }
  });
}

// Legacy name: the drawer is one list now, there is no separate key view.
function _renderCwKeyList() { _renderCwGroupList(); }
