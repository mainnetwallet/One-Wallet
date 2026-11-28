

function wgCopyAllMnemonics() {
  if (!_wgCreatedWallets.length) { showToast('আগে Generate করো', 'error'); return; }
  const lines = _wgCreatedWallets.map(w => w.mnemonic || '').filter(Boolean).join('\n');
  try {
    navigator.clipboard.writeText(lines).then(() => {
      const btn = document.getElementById('wg-copy-all-btn');
      if (btn) {
        btn.innerHTML = '<span class="material-icons-round" style="font-size:13px;">check</span>COPIED';
        btn.style.color = '#10b981';
        btn.style.borderColor = 'rgba(16,185,129,0.5)';
        btn.style.background = 'rgba(16,185,129,0.15)';
        setTimeout(() => {
          btn.innerHTML = '<span class="material-icons-round" style="font-size:13px;">content_copy</span>COPY';
          btn.style.color = 'var(--accent-primary)';
          btn.style.borderColor = 'rgba(99,102,241,0.3)';
          btn.style.background = 'rgba(99,102,241,0.12)';
        }, 2000);
      }
      haptic();
    });
  } catch(e) {
    showToast('Copy failed', 'error');
  }
}

function wgSaveCreatedGroup() {
  if (!_wgCreatedWallets.length) return;
  const name = (document.getElementById('wg-create-name-input')?.value || '').trim();
  if (!name) return;

  const validKeys = _wgCreatedWallets.map(w => w.privateKey).filter(isValidPrivateKey).map(normalizeKey);
  if (!validKeys.length) return;

  // Collect mnemonics aligned with validKeys order
  const mnemonics = _wgCreatedWallets
    .filter(w => isValidPrivateKey(w.privateKey))
    .map(w => w.mnemonic || '');

  const saved = _doSaveWalletGroup(name, validKeys, 'created', mnemonics);
  if (!saved) return; // duplicate name or other error — keep overlay open
  _wgCreatedWallets = [];
  document.getElementById('wg-create-overlay')?.classList.remove('open');
  haptic();
}

// ── Step-2: Open/Close Key Input UI ──
function openWgKeyInputUI() {
  const _hasLock2 = !!localStorage.getItem('one_lock_pin') || !!localStorage.getItem('one_lock_pat') || !!localStorage.getItem('one_lock_cred_id');
  if (!_hasLock2) {
    setTimeout(function() {
      if (typeof oneLock !== 'undefined' && typeof oneLock.openSetup === 'function') {
        oneLock.openSetup();
      }
    }, 150);
    return;
  }

  (document.getElementById('wg-name-input') || {}).value = '';
  (document.getElementById('wg-key-textarea') || {}).value = '';
  (document.getElementById('wg-mn-bulk-textarea') || {}).value = '';
  _wgActiveTab = 'pk';
  _wgDerivedKeys = [];
  wgSwitchTab('pk', true);
  const listEl = document.getElementById('wg-mn-phrase-list');
  if (listEl) { listEl.innerHTML = ''; listEl.style.display = 'none'; }
  const badge = document.getElementById('wg-mn-line-badge');
  if (badge) badge.style.display = 'none';
  const statusEl = document.getElementById('wg-mnem-status');
  if (statusEl) statusEl.className = 'wg-mnem-status';
  const countBadge = document.getElementById('wg-mnem-count');
  if (countBadge) countBadge.style.display = 'none';
  const fromEl = document.getElementById('wg-mn-from');
  if (fromEl) fromEl.value = '0';
  const toEl = document.getElementById('wg-mn-to');
  if (toEl) toEl.value = '0';
  const _wgIC1 = document.getElementById('wg-import-count');
  if (_wgIC1) _wgIC1.style.display = 'none';
  const _wgSB1 = document.getElementById('wg-save-btn');
  if (_wgSB1) { _wgSB1.style.opacity = '0.5'; _wgSB1.style.pointerEvents = 'none'; }
  document.getElementById('wg-keyinput-overlay')?.classList.add('open');
  setTimeout(() => { _wgUpdateSaveBtn(); }, 300);
  haptic();
}

function closeWgKeyInputUI() {
  document.getElementById('wg-keyinput-overlay')?.classList.remove('open');
  _wgDerivedKeys = [];
  haptic();
  // ── Return to Import Wallet Group ──
  document.getElementById('wg-import-overlay')?.classList.add('open');
}

// ── Tab switching ──
function wgSwitchTab(tab, silent) {
  _wgActiveTab = tab;
  ['pk','mn'].forEach(t => {
    document.getElementById('wg-tab-' + t)?.classList.toggle('active', t === tab);
    document.getElementById('wg-panel-' + t)?.classList.toggle('active', t === tab);
  });
  _wgUpdateSaveBtn();
  if (!silent) haptic();
}

// ── Private key input handler ──
function onWgKeyInput() {
  if (_wgActiveTab !== 'pk') { _wgUpdateSaveBtn(); return; }
  const ta = document.getElementById('wg-key-textarea');
  const lines = (ta?.value || '').split('\n').map(l => l.trim()).filter(Boolean);
  const valid = lines.filter(isValidPrivateKey);
  const countEl = document.getElementById('wg-import-count');
  if (countEl) {
    countEl.style.display = valid.length > 0 ? 'inline-block' : 'none';
    countEl.textContent = valid.length + ' VALID';
  }
  _wgUpdateSaveBtn();
}

// ── Also update save btn when name changes ──
document.addEventListener('DOMContentLoaded', () => {
  const nameInput = document.getElementById('wg-name-input');
  if (nameInput) nameInput.addEventListener('input', () => {
    if (_wgActiveTab === 'pk') onWgKeyInput(); else _wgUpdateSaveBtn();
  });
});

// ── Shared save-button enable/disable ──
function _wgUpdateSaveBtn() {
  const btn = document.getElementById('wg-save-btn');
  if (!btn) return;
  const nameVal = (document.getElementById('wg-name-input')?.value || '').trim();
  let canSave = false;
  if (_wgActiveTab === 'pk') {
    const ta = document.getElementById('wg-key-textarea');
    const lines = (ta?.value || '').split('\n').map(l => l.trim()).filter(Boolean);
    canSave = lines.filter(isValidPrivateKey).length > 0 && nameVal.length > 0;
  } else {
    canSave = _wgDerivedKeys.length > 0 && nameVal.length > 0;
  }
  btn.style.opacity = canSave ? '1' : '0.5';
  btn.style.pointerEvents = canSave ? 'auto' : 'none';
}

// ════════════════════
//  MNEMONIC HELPERS
// ════════════════════

// ════════════════════
//  MNEMONIC HELPERS — Bulk multi-phrase
// ════════════════════

// Parse and validate all phrases from textarea
function _wgParsePhrases() {
  const ta = document.getElementById('wg-mn-bulk-textarea');
  const raw = (ta?.value || '');
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  const results = lines.map(line => {
    const words = line.split(/\s+/);
    const validCounts = [12, 15, 18, 24];
    if (!validCounts.includes(words.length)) return { phrase: line, valid: false, reason: words.length + ' words' };
    try {
      ethers.Mnemonic.fromPhrase(words.join(' '));
      return { phrase: words.join(' '), valid: true };
    } catch(e) {
      return { phrase: line, valid: false, reason: 'invalid phrase' };
    }
  });
  return results;
}

// Validate phrases & update UI list + status
let _wgMnemDebounceTimer = null;
function wgOnMnemInput() {
  clearTimeout(_wgMnemDebounceTimer);
  _wgMnemDebounceTimer = setTimeout(_wgOnMnemInputAsync, 300);
}

async function _wgOnMnemInputAsync() {
  const results = _wgParsePhrases();
  const valid = results.filter(r => r.valid);
  const invalid = results.filter(r => !r.valid);

  // Badge
  const badge = document.getElementById('wg-mn-line-badge');
  if (badge) {
    badge.style.display = results.length > 0 ? 'inline-block' : 'none';
    badge.textContent = valid.length + ' VALID' + (invalid.length > 0 ? ' · ' + invalid.length + ' ERR' : '');
    badge.style.borderColor = invalid.length > 0 ? 'rgba(244,63,94,0.35)' : 'rgba(99,102,241,0.3)';
    badge.style.color = invalid.length > 0 ? 'var(--accent-red)' : 'var(--neon-purple)';
    badge.style.background = invalid.length > 0 ? 'rgba(244,63,94,0.12)' : 'rgba(99,102,241,0.15)';
  }

  // Per-line validation list
  const listEl = document.getElementById('wg-mn-phrase-list');
  if (listEl) {
    if (results.length === 0) {
      listEl.style.display = 'none';
      listEl.innerHTML = '';
    } else {
      listEl.style.display = 'flex';
      listEl.innerHTML = results.map((r, i) => {
        const words = r.phrase.split(/\s+/);
        const preview = words.length >= 3 ? words[0] + ' ' + words[1] + ' … ' + words[words.length-1] : r.phrase;
        return `<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;
          border-radius:9px;border:1px solid ${r.valid ? 'rgba(16,185,129,0.25)' : 'rgba(244,63,94,0.2)'};
          background:${r.valid ? 'rgba(16,185,129,0.06)' : 'rgba(244,63,94,0.06)'};">
          <span class="material-icons-round" style="font-size:13px;color:${r.valid ? 'var(--accent-green)' : 'var(--accent-red)'};">${r.valid ? 'check_circle' : 'error'}</span>
          <span style="flex:1;font-family:var(--font-mono);font-size:10px;color:${r.valid ? 'var(--text-primary)' : 'var(--text-muted)'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${i+1}. ${preview}</span>
          ${!r.valid ? `<span style="font-family:var(--font-mono);font-size:9px;color:var(--accent-red);flex-shrink:0;">${r.reason}</span>` : ''}
        </div>`;
      }).join('');
    }
  }

  // Show deriving status
  const statusEl   = document.getElementById('wg-mnem-status');
  const statusIcon = document.getElementById('wg-mnem-status-icon');
  const statusText = document.getElementById('wg-mnem-status-text');
  const countBadge = document.getElementById('wg-mnem-count');

  if (valid.length === 0) {
    _wgDerivedKeys = [];
    if (statusEl) statusEl.className = results.length > 0 && invalid.length > 0 ? 'wg-mnem-status err' : 'wg-mnem-status';
    if (statusIcon) statusIcon.textContent = 'error';
    if (statusText) statusText.textContent = results.length > 0 ? 'No valid phrases detected' : '';
    if (countBadge) countBadge.style.display = 'none';
    _wgUpdateSaveBtn();
    return;
  }

  // Show loading indicator while deriving
  if (statusEl) statusEl.className = 'wg-mnem-status';
  if (statusIcon) statusIcon.textContent = 'autorenew';
  if (statusText) statusText.textContent = 'Deriving…';
  if (countBadge) countBadge.style.display = 'none';
  _wgUpdateSaveBtn();

  const basePath = document.getElementById('wg-deriv-path')?.value || "m/44'/60'/0'/0";
  const fromIdx = parseInt(document.getElementById('wg-mn-from')?.value) || 0;
  const toIdx   = parseInt(document.getElementById('wg-mn-to')?.value);
  const toIdxSafe = isNaN(toIdx) ? fromIdx : toIdx;
  const start = Math.max(0, Math.min(fromIdx, 999));
  const end   = Math.max(start, Math.min(toIdxSafe, 999));

  // Build flat work list: [{phrase, idx}]
  const workList = [];
  for (const r of valid) {
    for (let i = start; i <= end; i++) {
      workList.push({ phrase: r.phrase, idx: i });
    }
  }

  // Chunk size — process N items per frame to keep UI responsive
  const CHUNK = 20;
  const derived = [];
  let pos = 0;

  await new Promise(resolve => {
    function processChunk() {
      const end = Math.min(pos + CHUNK, workList.length);
      for (; pos < end; pos++) {
        try {
          const { phrase, idx } = workList[pos];
          const path = basePath + '/' + idx;
          const wallet = ethers.HDNodeWallet.fromPhrase(phrase, null, path);
          derived.push(wallet.privateKey);
        } catch(e) {}
      }
      if (pos < workList.length) {
        // Update progress text
        if (statusText) statusText.textContent = 'Deriving… ' + pos + '/' + workList.length;
        setTimeout(processChunk, 0);
      } else {
        resolve();
      }
    }
    processChunk();
  });

  _wgDerivedKeys = [...new Set(derived)];

  if (_wgDerivedKeys.length > 0) {
    if (statusEl) statusEl.className = 'wg-mnem-status ok';
    if (statusIcon) statusIcon.textContent = 'check_circle';
    if (statusText) statusText.textContent = valid.length + ' phrase' + (valid.length !== 1 ? 's' : '') + ' · ' + _wgDerivedKeys.length + ' wallet' + (_wgDerivedKeys.length !== 1 ? 's' : '') + ' total';
    if (countBadge) { countBadge.style.display = 'inline-block'; countBadge.textContent = _wgDerivedKeys.length + ' WALLETS'; }
  } else {
    if (statusEl) statusEl.className = 'wg-mnem-status err';
    if (statusIcon) statusIcon.textContent = 'error';
    if (statusText) statusText.textContent = 'No valid phrases detected';
    if (countBadge) countBadge.style.display = 'none';
  }

  _wgUpdateSaveBtn();
}

// ════════════════════
//  SAVE GROUP
// ════════════════════
function saveWalletGroup() {
  const name = (document.getElementById('wg-name-input')?.value || '').trim();
  if (!name) {
    showToast('Group name cannot be empty', 'error');
    document.getElementById('wg-name-input')?.focus();
    return;
  }

  let validKeys = [];

  if (_wgActiveTab === 'pk') {
    const ta = document.getElementById('wg-key-textarea');
    const raw = (ta?.value || '');
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    const allKeys = lines.filter(l => l.length > 0);
    validKeys = [...new Set(lines.filter(isValidPrivateKey).map(normalizeKey))];
    if (allKeys.length > 0 && validKeys.length === 0) {
      showToast('No valid private keys found. Check format (0x + 64 hex chars)', 'error');
      return;
    }
    if (validKeys.length === 0) {
      showToast('Please enter at least one private key', 'error');
      return;
    }
  } else {
    // Bug fix: mnemonic-derived keys-ও normalizeKey দিয়ে normalize করো
    validKeys = [...new Set(_wgDerivedKeys.filter(isValidPrivateKey).map(normalizeKey))];
    if (validKeys.length === 0) {
      showToast('No wallets derived. Enter valid seed phrase(s)', 'error');
      return;
    }
  }

  if (validKeys.length === 0) return;

  _doSaveWalletGroup(name, validKeys);
}

function _doSaveWalletGroup(name, validKeys, source, mnemonics) {
  const groups = loadWalletGroups();

  // Bug fix: edit mode — wgEditingId থাকলে নতুন group না বানিয়ে existing update করো
  if (wgEditingId) {
    const idx = groups.findIndex(g => g.id === wgEditingId);
    if (idx !== -1) {
      groups[idx].name = name;
      // Wallet names follow their keys (matched by key), new keys get the default name
      if (Array.isArray(groups[idx].labels)) {
        const _oldKeys = groups[idx].keys || [];
        const _oldLabels = groups[idx].labels;
        const _nameOf = {};
        _oldKeys.forEach((k, i) => { if (_oldLabels[i]) _nameOf[k] = _oldLabels[i]; });
        const _newLabels = validKeys.map(k => _nameOf[k] || '');
        if (_newLabels.some(l => !!l)) groups[idx].labels = _newLabels; else delete groups[idx].labels;
      }
      groups[idx].keys = validKeys;
      saveWalletGroups(groups);
      wgEditingId = null;
      // Re-apply selection so key list reflects updated keys
      applySettingsGroupSelection();
      applyMultiGroupSelection();
      renderWalletGroupsList();
      renderSwapGroupList();
      document.getElementById('wg-keyinput-overlay')?.classList.remove('open');
      if (typeof _wgRefreshModalGroupList === 'function') _wgRefreshModalGroupList();
      showToast(name + ' updated (' + validKeys.length + ' key' + (validKeys.length !== 1 ? 's' : '') + ')', 'check_circle');
      haptic();
      return;
    }
    // edit target না পেলে wgEditingId clear করে নতুন group হিসেবে save করো
    wgEditingId = null;
  }

  const newGroup = {
    id: 'wg-' + Date.now(),
    name,
    keys: validKeys,
    mnemonics: (mnemonics && mnemonics.length === validKeys.length) ? mnemonics : [],
    createdAt: Date.now(),
    source: source || 'imported',
  };

  // Duplicate name check
  if (groups.some(g => g.name.trim().toLowerCase() === name.trim().toLowerCase())) {
    showToast('Name already exists — please choose a different name', 'error');
    return false;
  }
  groups.push(newGroup);
  saveWalletGroups(groups);

  // Auto-activate the new group
  if (!selectedGroupIds.includes(newGroup.id)) {
    selectedGroupIds.push(newGroup.id);
    saveSelectedGroupIds();
    applySettingsGroupSelection();
  }

  // Reset inputs
  (document.getElementById('wg-name-input') || {}).value = '';
  (document.getElementById('wg-key-textarea') || {}).value = '';
  (document.getElementById('wg-mn-bulk-textarea') || {}).value = '';
  const _wgIC2 = document.getElementById('wg-import-count');
  if (_wgIC2) _wgIC2.style.display = 'none';
  const _wgSB2 = document.getElementById('wg-save-btn');
  if (_wgSB2) { _wgSB2.style.opacity = '0.5'; _wgSB2.style.pointerEvents = 'none'; }
  _wgDerivedKeys = [];
  const listEl = document.getElementById('wg-mn-phrase-list');
  if (listEl) { listEl.innerHTML = ''; listEl.style.display = 'none'; }
  const badge = document.getElementById('wg-mn-line-badge');
  if (badge) badge.style.display = 'none';
  const statusEl = document.getElementById('wg-mnem-status');
  if (statusEl) statusEl.className = 'wg-mnem-status';

  renderWalletGroupsList();
  renderSwapGroupList();
  // Close Step-2 key input overlay, refresh Step-1 group list
  document.getElementById('wg-keyinput-overlay')?.classList.remove('open');
  _wgDerivedKeys = [];
  if (typeof _wgRefreshModalGroupList === 'function') _wgRefreshModalGroupList();
  if (source !== 'created') showToast(name + ' saved (' + validKeys.length + ' key' + (validKeys.length !== 1 ? 's' : '') + ')', 'check_circle');
  haptic();
  return true;
}

function removeWalletGroup(id) {
  const groups = loadWalletGroups().filter(g => g.id !== id);
  saveWalletGroups(groups);
  renderWalletGroupsList();
  renderSwapGroupList();
  // If active group was removed, clear
  if (validatedKeys.length > 0) {
    const active = document.getElementById('swap-group-name');
    // Reset swap if needed
  }
  showToast('Group removed', 'delete');
  haptic();
}

// Color palettes for group cards
const WG_COLORS = [
  { bg:'rgba(99,102,241,0.18)', border:'rgba(99,102,241,0.35)', glow:'rgba(99,102,241,0.12)', accent:'#818cf8', num:'linear-gradient(135deg,#6366f1,#8b5cf6)' },
  { bg:'rgba(6,182,212,0.15)',  border:'rgba(6,182,212,0.32)',  glow:'rgba(6,182,212,0.1)',   accent:'#22d3ee', num:'linear-gradient(135deg,#0ea5e9,#06b6d4)' },
  { bg:'rgba(16,185,129,0.14)', border:'rgba(16,185,129,0.3)',  glow:'rgba(16,185,129,0.09)', accent:'#34d399', num:'linear-gradient(135deg,#10b981,#059669)' },
  { bg:'rgba(245,158,11,0.13)', border:'rgba(245,158,11,0.3)',  glow:'rgba(245,158,11,0.08)', accent:'#fbbf24', num:'linear-gradient(135deg,#f59e0b,#d97706)' },
  { bg:'rgba(244,63,94,0.13)',  border:'rgba(244,63,94,0.3)',   glow:'rgba(244,63,94,0.08)',  accent:'#fb7185', num:'linear-gradient(135deg,#f43f5e,#e11d48)' },
  { bg:'rgba(168,85,247,0.14)', border:'rgba(168,85,247,0.3)',  glow:'rgba(168,85,247,0.09)', accent:'#c084fc', num:'linear-gradient(135deg,#a855f7,#7c3aed)' },
];

function _updateWgManageBtn() {
  const manageBtn = document.getElementById('wg-manage-btn');
  if (!manageBtn) return;
  const hasSelected = (typeof selectedGroupIds !== 'undefined' && selectedGroupIds.length > 0)
    || (typeof hwSelectedKey !== 'undefined' && !!hwSelectedKey);
  if (hasSelected) {
    manageBtn.dataset.disabled = '';
    manageBtn.style.opacity = '1';
    manageBtn.style.cursor = 'pointer';
    manageBtn.onmousedown = function(){ this.style.transform='scale(0.93)'; };
    manageBtn.onmouseup   = function(){ this.style.transform=''; };
    manageBtn.ontouchstart= function(){ this.style.transform='scale(0.93)'; };
    manageBtn.ontouchend  = function(){ this.style.transform=''; };
  } else {
    manageBtn.dataset.disabled = '1';
    manageBtn.style.opacity = '0.35';
    manageBtn.style.cursor = 'not-allowed';
    manageBtn.onmousedown = null;
    manageBtn.onmouseup   = null;
    manageBtn.ontouchstart= null;
    manageBtn.ontouchend  = null;
  }
}
