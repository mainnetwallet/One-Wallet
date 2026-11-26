// ══════════════════════════════════════
// ADDRESS LIST MODAL
// ══════════════════════════════════════
function openAddrListModal() {
  // Build address list ONLY from Connected Wallets selection (_cwSelectedKeys / selectedGroupIds)
  // Never use validatedKeys (swap keys) here
  var keysToShow = [];

  // Collect keys respecting per-group key selection from Connected Wallets drawer
  const allGroups = loadWalletGroups ? loadWalletGroups() : [];
  const activeGroups = selectedGroupIds.length > 0
    ? allGroups.filter(g => selectedGroupIds.includes(g.id))
    : [];

  if (activeGroups.length > 0) {
    const seen = new Set();
    activeGroups.forEach(g => {
      const selSet = _cwGetSelectedKeys(g.id);
      const keys = selSet.size > 0 ? g.keys.filter((_, i) => selSet.has(i)) : g.keys;
      keys.forEach(k => { if (!seen.has(k)) { seen.add(k); keysToShow.push(k); } });
    });
  }

  if (keysToShow.length === 0) {
    showToast('Select a group or key from Connected Wallets', 'folder');
    return;
  }
  const container = document.getElementById('addr-list-container');
  const badge = document.getElementById('addr-list-count-badge');
  if (badge) badge.textContent = keysToShow.length + ' WALLET' + (keysToShow.length !== 1 ? 'S' : '');
  if (container) container.innerHTML = '';

  keysToShow.forEach((pk, i) => {
    let addr = '';
    try { addr = new ethers.Wallet(pk).address; } catch { return; }
    const item = document.createElement('div');
    item.style.cssText = 'display:flex;align-items:center;gap:12px;padding:13px 14px;background:var(--bg-glass);border:1px solid var(--border-subtle);border-radius:var(--radius-md);cursor:pointer;transition:all 0.2s;animation:slideIn 0.25s ease both;animation-delay:' + (i*0.04) + 's;';
    item.innerHTML =
      '<div style="width:32px;height:32px;border-radius:10px;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.25);display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
        '<span style="font-size:11px;font-weight:800;color:var(--accent-primary);font-family:var(--font-mono);">' + (i+1) + '</span>' +
      '</div>' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:12px;font-weight:700;color:var(--text-secondary);font-family:var(--font-mono);">W' + (i+1) + '</div>' +
        '<div style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);margin-top:2px;word-break:break-all;line-height:1.5;">' + addr + '</div>' +
      '</div>' +
      '<div style="width:34px;height:34px;border-radius:10px;background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.2s;" id="addr-copy-btn-' + i + '">' +
        '<span class="material-icons-round" style="font-size:16px;color:var(--accent-primary);">content_copy</span>' +
      '</div>';
    item.addEventListener('click', () => {
      navigator.clipboard?.writeText(addr).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = addr; document.body.appendChild(ta);
        ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      });
      const btn = document.getElementById('addr-copy-btn-' + i);
      if (btn) { btn.style.background = 'rgba(16,185,129,0.2)'; btn.style.borderColor = 'rgba(16,185,129,0.4)'; btn.innerHTML = '<span class="material-icons-round" style="font-size:16px;color:var(--accent-green);">check</span>'; }
      setTimeout(() => {
        if (btn) { btn.style.background = 'rgba(99,102,241,0.1)'; btn.style.borderColor = 'rgba(99,102,241,0.2)'; btn.innerHTML = '<span class="material-icons-round" style="font-size:16px;color:var(--accent-primary);">content_copy</span>'; }
      }, 1500);
      showToast('W' + (i+1) + ' copied!', 'content_copy');
      haptic();
    });
    item.addEventListener('mousedown', () => item.style.background = 'var(--bg-glass-hover)');
    item.addEventListener('mouseup', () => item.style.background = 'var(--bg-glass)');
    item.addEventListener('touchstart', () => item.style.background = 'var(--bg-glass-hover)', {passive:true});
    item.addEventListener('touchend', () => item.style.background = 'var(--bg-glass)');
    container.appendChild(item);
  });

  document.getElementById('addr-list-overlay')?.classList.add('open');
  haptic();
}

function closeAddrListModal() {
  document.getElementById('addr-list-overlay')?.classList.remove('open');
  haptic();
}

// ══════════════════════════════════════════════════════════════
// CONNECTED WALLETS DRAWER — Group list → Individual wallets
// ══════════════════════════════════════════════════════════════
let _cwExpandedGroupId = null;
// Per-group key selection map: { groupId: Set<keyIndex> }
let _cwSelectedKeys = {};

function _cwGetSelectedKeys(groupId) {
  if (!_cwSelectedKeys[groupId]) _cwSelectedKeys[groupId] = new Set();
  return _cwSelectedKeys[groupId];
}

function _cwToggleKey(groupId, keyIdx) {
  const sel = _cwGetSelectedKeys(groupId);
  if (sel.has(keyIdx)) sel.delete(keyIdx); else sel.add(keyIdx);
  // Instantly update settingsKeys and profile stats
  applySettingsGroupSelection();
  if (typeof updateProfileStats === 'function') updateProfileStats();
}

function _cwSelectAllKeys(groupId, total) {
  const sel = _cwGetSelectedKeys(groupId);
  if (sel.size === total) { sel.clear(); }
  else { sel.clear(); for (let i = 0; i < total; i++) sel.add(i); }
  applySettingsGroupSelection();
  if (typeof updateProfileStats === 'function') updateProfileStats();
}

