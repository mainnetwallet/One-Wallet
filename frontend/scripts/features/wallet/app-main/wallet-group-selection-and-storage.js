// ── OneSecure: transparent getter for selected key ──
// Returns hwSelectedKey from memory (already decrypted after unlock).
// Falls back to sync decodeKey for legacy ncx3/nsx2 formats.
// Returns hwSelectedKey from memory (decrypted after unlock).
// Use hwSelectedKey directly — this is a compat shim only.
function _oneGetSelectedKey() {
  if (typeof hwSelectedKey !== 'undefined' && hwSelectedKey) return hwSelectedKey;
  return null; // Not yet unlocked — key unavailable until _hwRestoreSelection runs
}
const WG_STORAGE_KEY = 'one_wallet_groups';
// Remove legacy device fallback secret — no longer used, PIN is mandatory
try { localStorage.removeItem('__one_fsk_v1__'); } catch(e) {}

const WG_ACTIVE_KEY = 'one_active_group';
const WG_SELECTED_MULTI_KEY = 'one_selected_groups_multi';        // Settings selection
const WG_SWAP_SELECTED_KEY  = 'one_swap_selected_groups_multi';   // Swap selection (separate)
let wgEditingId = null;
let activeGroupId = localStorage.getItem(WG_ACTIVE_KEY) || null; // persisted selected group

// Settings multi-select: array of selected group IDs
let selectedGroupIds = (() => {
  try { return JSON.parse(localStorage.getItem(WG_SELECTED_MULTI_KEY)) || []; } catch { return []; }
})();

function saveSelectedGroupIds() {
  try { localStorage.setItem(WG_SELECTED_MULTI_KEY, JSON.stringify(selectedGroupIds)); } catch {}
}

// Swap multi-select: completely separate from Settings selection
let swapSelectedGroupIds = (() => {
  try { return JSON.parse(localStorage.getItem(WG_SWAP_SELECTED_KEY)) || []; } catch { return []; }
})();

function saveSwapSelectedGroupIds() {
  try { localStorage.setItem(WG_SWAP_SELECTED_KEY, JSON.stringify(swapSelectedGroupIds)); } catch {}
}

// groupOrderedKeys: [{key, groupId, groupName, groupIndex, keyIndexInGroup}]
// This is used by the swap bot to know group boundaries and order
let groupOrderedKeys = [];

// settingsKeys: keys from Settings selectedGroupIds — used by Home & Profile
let settingsKeys = [];

function applyMultiGroupSelection() {
  const groups = loadWalletGroups();
  // Swap uses swapSelectedGroupIds — completely separate from Settings selectedGroupIds
  swapSelectedGroupIds = swapSelectedGroupIds.filter(id => groups.find(g => g.id === id));
  saveSwapSelectedGroupIds();

  const selectedGroups = swapSelectedGroupIds.map(id => groups.find(g => g.id === id)).filter(Boolean);

  // Build ordered key list with group metadata (deduplicate keys)
  groupOrderedKeys = [];
  const seen = new Set();
  selectedGroups.forEach((g, groupIndex) => {
    g.keys.forEach((k, keyIndexInGroup) => {
      if (!seen.has(k)) {
        seen.add(k);
        groupOrderedKeys.push({ key: k, groupId: g.id, groupName: g.name, groupIndex, keyIndexInGroup });
      }
    });
  });

  validatedKeys = groupOrderedKeys.map(x => x.key);
  assignedSwapCounts = [];

  // Update key count badge
  const badge = document.getElementById('key-count-badge');
  if (badge) {
    if (badge) badge.textContent = validatedKeys.length + ' KEY' + (validatedKeys.length !== 1 ? 'S' : '');
    badge.classList.toggle('has-keys', validatedKeys.length > 0);
  }

  // Update summary bar
  const summary = document.getElementById('swap-multiselect-summary');
  const smsText = document.getElementById('sms-text');
  const smsCount = document.getElementById('sms-count');
  if (summary && smsText && smsCount) {
    if (swapSelectedGroupIds.length > 0) {
      summary.classList.add('visible');
      const orderStr = selectedGroups.map((g, i) => `${i+1}. ${g.name}`).join(' → ');
      if (smsText) smsText.textContent = orderStr;
      if (smsCount) smsCount.textContent = validatedKeys.length + ' KEYS';
    } else {
      summary.classList.remove('visible');
    }
  }

  // Update active pill — never auto-close picker, user uses Done button
  const pill = document.getElementById('swap-active-group-pill');
  const pillName = document.getElementById('swap-group-name');
  const pillMeta = document.getElementById('swap-group-meta');
  const picker = document.getElementById('swap-group-picker');
  const isPickerOpen = picker && picker.style.display !== 'none';

  // Show/hide Private Keys box based on wallet selection
  var _keyBox = document.getElementById('step1-key-box');

  if (swapSelectedGroupIds.length > 0) {
    if (pillName) {
      pillName.textContent = selectedGroups.length === 1
        ? selectedGroups[0].name
        : selectedGroups.map((g,i) => `${i+1}. ${g.name}`).join(' \u2192 ');
    }
    if (pillMeta) pillMeta.textContent = validatedKeys.length + ' keys loaded in order';
    activeGroupId = swapSelectedGroupIds[0];
    try { localStorage.setItem(WG_ACTIVE_KEY, activeGroupId); } catch {}
    if (!isPickerOpen) {
      if (pill) pill.style.display = 'flex';
    }
    // Wallet selected → show Private Keys box
    if (_keyBox) _keyBox.style.display = 'block';
  } else {
    if (pill) pill.style.display = 'none';
    if (picker) picker.style.display = 'block';
    activeGroupId = null;
    try { localStorage.removeItem(WG_ACTIVE_KEY); } catch {}
    // No wallet selected → hide Private Keys box
    if (_keyBox) _keyBox.style.display = 'none';
  }

  // Show/hide Done button
  const doneBtn = document.getElementById('swap-picker-done-btn');
  if (doneBtn) doneBtn.style.display = swapSelectedGroupIds.length > 0 ? 'block' : 'none';

  renderWalletPreview(validatedKeys, []);
}

// ── Settings group selection → Home & Profile ──
function applySettingsGroupSelection() {
  const groups = loadWalletGroups();
  selectedGroupIds = selectedGroupIds.filter(id => groups.find(g => g.id === id));
  saveSelectedGroupIds();
  const selGroups = selectedGroupIds.map(id => groups.find(g => g.id === id)).filter(Boolean);
  const seen = new Set();
  settingsKeys = [];
  selGroups.forEach(g => {
    const perKeySel = typeof _cwSelectedKeys !== 'undefined' && _cwSelectedKeys[g.id];
    if (perKeySel && perKeySel.size > 0) {
      // Use only individually selected keys
      g.keys.forEach((k, i) => {
        if (perKeySel.has(i) && !seen.has(k)) { seen.add(k); settingsKeys.push(k); }
      });
    } else {
      // No per-key selection → use all keys in group
      g.keys.forEach(k => {
        if (!seen.has(k)) { seen.add(k); settingsKeys.push(k); }
      });
    }
  });
  updateDashboard();
}

// ── loadWalletGroups: sync — returns in-memory plaintext cache ──
// Cache is populated by loadWalletGroupsAsync (called on unlock/boot)
// and kept up-to-date by saveWalletGroups.
function loadWalletGroups() {
  // 1. Return in-memory plaintext cache if available
  const cached = OneCrypto.getPlaintextCache();
  if (cached !== null) return cached;

  // 2. Fallback: sync check — if any key is ncx4 AES blob, must wait for async decrypt
  try {
    const raw = localStorage.getItem(WG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // If any key is an ncx4 AES blob, decodeGroups returns a Promise (async-only)
    // Calling .some() on a Promise throws TypeError → return [] and wait for loadWalletGroupsAsync
    const hasAesBlob = parsed.some(g => Array.isArray(g && g.keys) &&
      g.keys.some(k => typeof k === 'string' && k.startsWith('ncx4:')));
    if (hasAesBlob) return []; // Must unlock first — loadWalletGroupsAsync will populate cache
    const decoded = OneCrypto.decodeGroups(parsed);
    // Guard: decodeGroups might return a Promise if called with unexpected data
    if (!decoded || typeof decoded.then === 'function') return [];
    // If any key came back null it means AES blob — wallet is locked
    const hasLocked = decoded.some(g => g && Array.isArray(g.keys) &&
      g.keys.some(k => k === null || k === undefined));
    if (hasLocked) return [];
    return decoded;
  } catch { return []; }
}

// ── loadWalletGroupsAsync: true AES-GCM decrypt → populates cache ──
async function loadWalletGroupsAsync() {
  try {
    const raw = localStorage.getItem(WG_STORAGE_KEY);
    if (!raw) {
      // Fix: try plain backup if main key missing (app closed during async encrypt)
      try {
        const _backup = localStorage.getItem(WG_STORAGE_KEY + '_plain_backup');
        if (_backup) {
          const _bg = JSON.parse(_backup);
          if (Array.isArray(_bg) && _bg.length > 0) {
            OneCrypto.setPlaintextCache(_bg);
            saveWalletGroups(_bg); // re-encrypt and save properly
            return _bg;
          }
        }
      } catch(_) {}
      OneCrypto.setPlaintextCache([]); return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) { OneCrypto.setPlaintextCache([]); return []; }
    const groups = await OneCrypto.decryptGroups(parsed);
    // ── FIX: If secret wasn't set yet (race), groups will have _decryptFailed=true and 0 keys.
    // Don't overwrite cache with empty result — keep existing cache if any.
    const allFailed = groups && groups.length > 0 && groups.every(g => g._decryptFailed);
    if (allFailed) {
      const existing = OneCrypto.getPlaintextCache();
      if (existing && existing.length > 0) return existing; // keep current cache
      // else fall through — check backup below
    }
    // Fix: if decrypt returned empty but backup exists, restore from backup
    if ((!groups || groups.length === 0 || groups.every(g => !g.keys || g.keys.length === 0))) {
      try {
        const _backup = localStorage.getItem(WG_STORAGE_KEY + '_plain_backup');
        if (_backup) {
          const _bg = JSON.parse(_backup);
          if (Array.isArray(_bg) && _bg.length > 0) {
            OneCrypto.setPlaintextCache(_bg);
            saveWalletGroups(_bg);
            return _bg;
          }
        }
      } catch(_) {}
    }
    OneCrypto.setPlaintextCache(groups);
    return groups;
  } catch { return []; }
}

// ── saveWalletGroups: update plaintext cache + AES-encrypt to localStorage ──
function saveWalletGroups(groups) {
  // Update in-memory plaintext cache immediately (sync, used by loadWalletGroups)
  OneCrypto.setPlaintextCache(groups);
  // AES-encrypt async then persist
  // Fix: also do an immediate plain-JSON save as backup so keys are never lost
  // if the async encrypt hasn't finished before app closes
  try {
    const _backupKey = WG_STORAGE_KEY + '_plain_backup';
    localStorage.setItem(_backupKey, JSON.stringify(groups));
  } catch(_bErr) {}
  OneCrypto.encryptGroups(groups).then(function(encoded) {
    try {
      localStorage.setItem(WG_STORAGE_KEY, JSON.stringify(encoded));
      // Clear plain backup once encrypted version is safely stored
      try { localStorage.removeItem(WG_STORAGE_KEY + '_plain_backup'); } catch(_) {}
    } catch (e) {
      if (e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || (e.code && e.code === 22))) {
        if (typeof showToast === 'function') showToast('Storage full — keys not saved!', 'error');
      }
    }
  }).catch(function() {});
  if (typeof window.homeWalletGuardRefresh === 'function') window.homeWalletGuardRefresh();
}

