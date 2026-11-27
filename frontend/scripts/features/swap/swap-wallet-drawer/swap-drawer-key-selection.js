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

// Legacy name: the drawer is one list now, there is no separate key view.
function _renderSwapWalletKeyList() { _renderSwapWalletGroupList(); }

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

