// ── Per-key selection state (groupId → Set of keyIndex) ──
if (typeof swapSelectedKeyMap === 'undefined') var swapSelectedKeyMap = {};

function _saveSwapSelectedKeyMap() {
  try {
    var obj = {};
    Object.keys(swapSelectedKeyMap).forEach(function(gid) {
      obj[gid] = Array.from(swapSelectedKeyMap[gid]);
    });
    localStorage.setItem('one_swap_selected_keys', JSON.stringify(obj));
  } catch(e) {}
}
function _loadSwapSelectedKeyMap() {
  try {
    var raw = localStorage.getItem('one_swap_selected_keys');
    if (!raw) return;
    var obj = JSON.parse(raw);
    Object.keys(obj).forEach(function(gid) {
      swapSelectedKeyMap[gid] = new Set(obj[gid]);
    });
  } catch(e) {}
}
_loadSwapSelectedKeyMap();

function _getGroupKeySet(groupId) {
  if (!swapSelectedKeyMap[groupId]) {
    // Default: no keys selected
    swapSelectedKeyMap[groupId] = new Set();
  }
  return swapSelectedKeyMap[groupId];
}

function _renderSwapWalletKeyList(groupId) {
  const list     = document.getElementById('swap-wallet-drawer-list');
  const badge    = document.getElementById('swap-wallet-drawer-badge');
  const title    = document.getElementById('swap-wallet-drawer-title');
  const backBtn  = document.getElementById('swap-wallet-drawer-back-btn');
  const closeBtn = document.getElementById('swap-wallet-drawer-close-btn');
  const actionsRow = document.getElementById('swap-wallet-drawer-actions');
  const confirmBtn = document.getElementById('swap-wallet-drawer-confirm-btn');
  if (!list) return;

  const groups = loadWalletGroups();
  const g = groups.find(function(x) { return x.id === groupId; });
  if (!g) { _swapWalletDrawerExpandedGroupId = null; _renderSwapWalletGroupList(); return; }

  const idx = groups.indexOf(g);
  const clr = WG_COLORS[idx % WG_COLORS.length];
  const selectedSet = _getGroupKeySet(g.id);

  function getSelCount() { return selectedSet.size; }

  function updateBadge() {
    var sc = getSelCount();
    if (badge) badge.textContent = sc + ' / ' + g.keys.length + ' SELECTED';
  }

  if (title)      title.textContent = g.name;
  if (backBtn)    backBtn.style.display    = 'flex';
  if (closeBtn)   closeBtn.style.display   = 'none';
  if (actionsRow) actionsRow.style.display = 'none';
  if (confirmBtn) {
    confirmBtn.style.display = 'flex';
    var confirmLbl = document.getElementById('swap-wallet-drawer-confirm-label');
    if (confirmLbl) confirmLbl.textContent = 'Confirm Keys';
  }
  updateBadge();

  list.innerHTML = '';
  // Override del-drawer-body class styles for key-view layout
  list.style.cssText = 'flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden;padding:12px 12px 0;';

  // ── Top action row: SELECT ALL / CLEAR ──
  var topRow = document.createElement('div');
  topRow.style.cssText = 'display:flex;gap:8px;margin-bottom:12px;flex-shrink:0;';

  var selAllBtn = document.createElement('button');
  selAllBtn.style.cssText = 'flex:1;padding:8px 0;border-radius:10px;border:1.5px solid rgba(99,102,241,0.35);background:rgba(99,102,241,0.10);font-family:var(--font-mono);font-size:10px;font-weight:800;color:var(--accent-primary);letter-spacing:1px;cursor:pointer;transition:all 0.2s;';
  selAllBtn.textContent = 'SELECT ALL';
  selAllBtn.addEventListener('click', function() {
    for (var i = 0; i < g.keys.length; i++) selectedSet.add(i);
    _saveSwapSelectedKeyMap();
    if (typeof applyMultiGroupSelection === 'function') applyMultiGroupSelection();
    _renderSwapWalletKeyList(groupId);
    haptic && haptic();
  });

  var clearBtn = document.createElement('button');
  clearBtn.style.cssText = 'flex:1;padding:8px 0;border-radius:10px;border:1.5px solid rgba(244,63,94,0.35);background:rgba(244,63,94,0.08);font-family:var(--font-mono);font-size:10px;font-weight:800;color:var(--accent-red);letter-spacing:1px;cursor:pointer;transition:all 0.2s;';
  clearBtn.textContent = 'CLEAR ALL';
  clearBtn.addEventListener('click', function() {
    selectedSet.clear();
    _saveSwapSelectedKeyMap();
    if (typeof applyMultiGroupSelection === 'function') applyMultiGroupSelection();
    _renderSwapWalletKeyList(groupId);
    haptic && haptic();
  });

  topRow.appendChild(selAllBtn);
  topRow.appendChild(clearBtn);
  list.appendChild(topRow);

  // ── Hint ──
  var hint = document.createElement('div');
  hint.style.cssText = 'font-family:var(--font-mono);font-size:9px;color:var(--text-muted);letter-spacing:1px;padding:0 4px 10px;text-align:center;flex-shrink:0;';
  hint.textContent = 'TAP KEY TO SELECT / DESELECT';
  list.appendChild(hint);

  // ── Scrollable key rows wrapper ──
  var keyScroll = document.createElement('div');
  keyScroll.style.cssText = 'flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;scrollbar-width:none;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding-bottom:8px;';

  // ── Key rows ──
  g.keys.forEach(function(k, ki) {
    var addr = '';
    try {
      var w = new ethers.Wallet(k.startsWith('0x') ? k : '0x' + k);
      addr = w.address;
    } catch(e) { addr = '—'; }
    var shortAddr = addr !== '—' ? addr.slice(0, 6) + '…' + addr.slice(-4) : '—';
    var isSelected = selectedSet.has(ki);

    var item = document.createElement('div');
    item.className = 'del-drawer-item' + (isSelected ? ' selected' : '');
    item.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:13px;margin-bottom:7px;cursor:pointer;transition:all 0.2s ease;position:relative;padding-right:46px;';

    var checkIcon = isSelected
      ? '<div style="position:absolute;top:50%;right:12px;transform:translateY(-50%);width:22px;height:22px;border-radius:7px;background:var(--accent-primary);display:flex;align-items:center;justify-content:center;box-shadow:0 0 8px rgba(99,102,241,0.5);flex-shrink:0;"><span class="material-icons-round" style="font-size:14px;color:#fff;">check</span></div>'
      : '<div style="position:absolute;top:50%;right:12px;transform:translateY(-50%);width:22px;height:22px;border-radius:7px;background:var(--bg-raised);border:1.5px solid var(--border-subtle);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span class="material-icons-round" style="font-size:13px;color:var(--text-muted);">radio_button_unchecked</span></div>';

    item.innerHTML =
      '<div style="width:34px;height:34px;border-radius:10px;background:' + clr.num + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:12px;font-weight:900;color:#fff;box-shadow:0 2px 8px ' + clr.glow + ';">W' + (ki + 1) + '</div>' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:12px;font-weight:700;font-family:var(--font-mono);color:var(--text-primary);">' + shortAddr + '</div>' +
        '<div style="font-size:9px;color:' + (isSelected ? 'var(--accent-green)' : 'var(--text-muted)') + ';font-family:var(--font-mono);margin-top:2px;font-weight:700;">' + (isSelected ? '● ACTIVE' : 'KEY ' + (ki + 1) + ' OF ' + g.keys.length) + '</div>' +
      '</div>' +
      checkIcon;

    item.addEventListener('click', function() {
      if (selectedSet.has(ki)) {
        selectedSet.delete(ki);
        showToast('W' + (ki + 1) + ' deselected', 'remove_circle_outline');
      } else {
        selectedSet.add(ki);
        showToast('W' + (ki + 1) + ' selected', 'check_circle');
      }
      _saveSwapSelectedKeyMap();
      if (typeof applyMultiGroupSelection === 'function') applyMultiGroupSelection();
      _renderSwapWalletKeyList(groupId);
      haptic && haptic();
    });
    item.addEventListener('touchstart', function() { item.style.opacity='0.75'; }, {passive:true});
    item.addEventListener('touchend',   function() { item.style.opacity='1'; });

    keyScroll.appendChild(item);
  });
  list.appendChild(keyScroll);
}

// Override applyMultiGroupSelection to respect per-key selection
var _origApplyMultiGroupSelection = (typeof applyMultiGroupSelection === 'function') ? applyMultiGroupSelection : function(){};
applyMultiGroupSelection = function() {
  _origApplyMultiGroupSelection();
  // Now filter validatedKeys by swapSelectedKeyMap
  var groups = loadWalletGroups();
  var filtered = [];
  var seen = new Set();
  (typeof swapSelectedGroupIds !== 'undefined' ? swapSelectedGroupIds : []).forEach(function(gid) {
    var g = groups.find(function(x) { return x.id === gid; });
    if (!g) return;
    var selSet = swapSelectedKeyMap[gid];
    // If no per-key map or empty set → all keys are active (no individual selection made)
    var useAll = !selSet || selSet.size === 0;
    g.keys.forEach(function(k, ki) {
      if ((useAll || selSet.has(ki)) && !seen.has(k)) { seen.add(k); filtered.push(k); }
    });
  });
  validatedKeys = filtered;
  // Update badge
  var badge = document.getElementById('key-count-badge');
  if (badge) {
    badge.textContent = validatedKeys.length + ' KEY' + (validatedKeys.length !== 1 ? 'S' : '');
    badge.classList.toggle('has-keys', validatedKeys.length > 0);
    badge.style.display = validatedKeys.length > 0 ? 'block' : 'none';
  }
  var pillMeta = document.getElementById('swap-group-meta');
  if (pillMeta) pillMeta.textContent = validatedKeys.length + ' keys loaded in order';
  // Sync step-1 next button visual state
  if (typeof updateStep2NextBtn === 'function') updateStep2NextBtn();
  // ── Sync key box with newly applied validatedKeys ──
  _step1SyncKeyBox(validatedKeys);
};
// ══════ END SWAP WALLET DRAWER ══════

