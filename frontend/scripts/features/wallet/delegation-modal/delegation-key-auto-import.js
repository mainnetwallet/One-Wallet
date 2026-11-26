// ── Auto-import: sync selected keys → textarea immediately ──
function _delAutoImport() {
  const keysToImport = [..._delSelectedKeys];
  const textarea = document.getElementById('del-privateKeys');
  const triggerMeta = document.getElementById('del-group-trigger-meta');
  const statusEl = document.getElementById('del-group-import-status');
  const badge = document.getElementById('del-keyCountBadge');
  const num = document.getElementById('del-keyCountNum');

  if (textarea) {
    textarea.value = keysToImport.join('\n');
    textarea.dispatchEvent(new Event('input'));
  }
  // Update masked overlay
  delUpdateMaskedRows();
  // Keep masked/hidden mode
  if (textarea) textarea.style.display = 'none';
  const masked = document.getElementById('del-pk-masked');
  if (masked) masked.style.display = '';
  const icon = document.getElementById('del-pk-icon');
  const lbl  = document.getElementById('del-pk-lbl');
  if (icon) icon.textContent = 'visibility';
  if (lbl)  lbl.textContent  = 'Show';

  if (badge && num) {
    if (keysToImport.length > 0) { num.textContent = keysToImport.length; badge.style.display = 'block'; }
    else badge.style.display = 'none';
  }
  if (triggerMeta) {
    triggerMeta.textContent = keysToImport.length > 0
      ? `✓ ${keysToImport.length} key${keysToImport.length !== 1 ? 's' : ''} selected`
      : 'Tap to choose groups →';
  }
  if (statusEl) {
    if (keysToImport.length > 0) {
      statusEl.style.display = 'block';
      statusEl.style.color = 'var(--accent-green)';
      statusEl.textContent = `✅ ${keysToImport.length} key(s) imported`;
    } else {
      statusEl.style.display = 'none';
    }
  }
}

// ── Toggle whole group (all keys on/off) ────────────────────
function _delToggleGroup(groupId) {
  const groups = loadWalletGroups();
  const g = groups.find(g => g.id === groupId);
  if (!g) return;

  const allIn = g.keys.every(k => _delSelectedKeys.has(k));
  if (allIn) {
    g.keys.forEach(k => _delSelectedKeys.delete(k));
    delSelectedGroupIds = delSelectedGroupIds.filter(id => id !== groupId);
  } else {
    g.keys.forEach(k => _delSelectedKeys.add(k));
    if (!delSelectedGroupIds.includes(groupId)) delSelectedGroupIds.push(groupId);
  }
  _renderDelDrawer();
  _updateDelDrawerFooter();
  _delAutoImport();
  haptic && haptic();
}
