// ── KEY VALIDATION ──
function _stripKeyFormat(key) {
  return key.trim().replace(/^[\s"'`\[\(]+|[\s"'`,;\]\)]+$/g, '').trim();
}

function isValidPrivateKey(raw) {
  const key = _stripKeyFormat(raw);
  if (!key) return false;
  if (key.startsWith('#')) return false;
  if (key.toLowerCase() === 'key') return false;
  if (key.toLowerCase().includes('placeholder')) return false;
  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) return true;
  if (key.startsWith('0x') && key.length === 66 && /^0x[0-9a-fA-F]+$/i.test(key)) return true;
  return false;
}

function normalizeKey(raw) {
  const key = _stripKeyFormat(raw);
  if (key.length === 64 && /^[0-9a-fA-F]+$/i.test(key)) return '0x' + key.toLowerCase();
  if ((key.startsWith('0x') || key.startsWith('0X')) && key.length === 66) return '0x' + key.slice(2).toLowerCase();
  return key.toLowerCase();
}

function maskKey(key) {
  const k = normalizeKey(key);
  return k.slice(0, 8) + '••••••••••••••••••••••••••••••••••••••••' + k.slice(-6);
}

function getRealAddress(key) {
  try {
    const wallet = new ethers.Wallet(normalizeKey(key));
    const addr = wallet.address;
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  } catch(e) {
    return '0x????...????';
  }
}

function onKeysInput(ta) {
  const lines = ta.value.split('\n');
  const keys = lines.map(l => l.trim()).filter(l => l.length > 0);
  const valid = keys.filter(isValidPrivateKey);
  const invalid = keys.filter(k => k.length > 0 && !isValidPrivateKey(k));

  validatedKeys = valid.map(normalizeKey);

  // deduplicate
  const unique = [...new Set(validatedKeys)];
  if (unique.length < validatedKeys.length) {
    showToast('Duplicate keys removed', 'warning');
    validatedKeys = unique;
  }

  const badge = document.getElementById('key-count-badge');
  if (badge) badge.textContent = validatedKeys.length + ' KEY' + (validatedKeys.length !== 1 ? 'S' : '');
  badge.classList.toggle('has-keys', validatedKeys.length > 0);

  renderWalletPreview(validatedKeys, invalid);
  // Swap section only — does not affect Home/Profile
  if (currentPage === 'home') loadTokens();
}

// ── Wallet selection state (persisted in localStorage) ──
function getWalletSelectionKey() {
  return 'one_wallet_selection_v1';
}
function loadWalletSelection() {
  try { return JSON.parse(localStorage.getItem(getWalletSelectionKey()) || '{}'); } catch { return {}; }
}
function saveWalletSelection(sel) {
  try { localStorage.setItem(getWalletSelectionKey(), JSON.stringify(sel)); } catch {}
}
function isWalletSelected(index) {
  const sel = loadWalletSelection();
  return sel[index] !== false;
}
function toggleWalletSelection(index) {
  const sel = loadWalletSelection();
  sel[index] = sel[index] === false ? true : false;
  saveWalletSelection(sel);
}
function getSelectedWalletIndices(total) {
  const sel = loadWalletSelection();
  const result = [];
  for (let i = 0; i < total; i++) {
    if (sel[i] !== false) result.push(i);
  }
  return result;
}
function selectAllWallets() {
  const sel = {};
  for (let i = 0; i < validatedKeys.length; i++) sel[i] = true;
  saveWalletSelection(sel);
  renderWalletPreview(validatedKeys, []);
  haptic && haptic();
}
function deselectAllWallets() {
  const sel = {};
  for (let i = 0; i < validatedKeys.length; i++) sel[i] = false;
  saveWalletSelection(sel);
  renderWalletPreview(validatedKeys, []);
  haptic && haptic();
}
function toggleAllWallets() {
  const total = validatedKeys.length;
  const allSelected = getSelectedWalletIndices(total).length === total;
  const sel = {};
  for (let i = 0; i < total; i++) sel[i] = !allSelected;
  saveWalletSelection(sel);
  renderWalletPreview(validatedKeys, []);
  haptic && haptic();
}
function toggleAllGroups() {
  const groups = loadWalletGroups();
  const allSelected = groups.length > 0 && swapSelectedGroupIds.length === groups.length;
  swapSelectedGroupIds = allSelected ? [] : groups.map(g => g.id);
  saveSwapSelectedGroupIds();
  renderSwapGroupList();
  haptic && haptic();
}

function renderWalletPreview(validKeys, invalidLines) {
  const sec = document.getElementById('wallet-preview-section');
  const list = document.getElementById('wallet-preview-list');

  if (validKeys.length === 0 && invalidLines.length === 0) {
    if (sec) sec.style.display = 'none';
    return;
  }
  if (sec) sec.style.display = 'none'; return; // hidden — selection via drawer
  if (list) list.innerHTML = '';

  // Selection count badge — inserted before SELECT button
  const selCount = getSelectedWalletIndices(validKeys.length).length;
  let selBadge = document.getElementById('wallet-sel-badge');
  const titleRow = sec.querySelector('.section-title');
  const toggleBtn = document.getElementById('wallet-toggle-all-btn');
  if (!selBadge) {
    selBadge = document.createElement('div');
    selBadge.id = 'wallet-sel-badge';
    selBadge.style.cssText = 'font-family:var(--font-mono);font-size:10px;font-weight:700;color:var(--accent-primary);padding:3px 10px;background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.25);border-radius:8px;display:inline-block;';
    if (titleRow && toggleBtn) titleRow.insertBefore(selBadge, toggleBtn);
    else if (titleRow) titleRow.appendChild(selBadge);
  }
  if (selBadge) selBadge.textContent = selCount + '/' + validKeys.length + ' SELECTED';
  const wToggleBtn = document.getElementById('wallet-toggle-all-btn');
  if (wToggleBtn) {
    if (wToggleBtn) wToggleBtn.textContent = 'SELECT';
    wToggleBtn.className = 'sma-btn select-all';
  }

  validKeys.forEach((key, i) => {
    const selected = isWalletSelected(i);
    const el = document.createElement('div');
    el.className = 'wallet-preview-item valid' + (selected ? '' : ' deselected');
    el.style.animationDelay = (i * 0.05) + 's';
    el.innerHTML = `
      <div class="wpi-checkbox">
        <span class="material-icons-round">check</span>
      </div>
      <div class="wpi-index">W${i+1}</div>
      <div class="wpi-addr">${getRealAddress(key).slice(0,10)}...${getRealAddress(key).slice(-8)}</div>
    `;
    el.onclick = () => {
      toggleWalletSelection(i);
      haptic && haptic();
      renderWalletPreview(validKeys, invalidLines);
    };
    list.appendChild(el);
  });

  invalidLines.forEach((line, i) => {
    if (!line || line.length < 10) return;
    const el = document.createElement('div');
    el.className = 'wallet-preview-item invalid';
    el.style.animationDelay = ((validKeys.length + i) * 0.05) + 's';
    el.innerHTML = `
      <div class="wpi-index" style="background:rgba(244,63,94,0.15);color:var(--accent-red);">!</div>
      <div class="wpi-addr" style="color:var(--text-muted);">${line.slice(0,20)}… (invalid)</div>
      <div class="wpi-status"><span class="material-icons-round" style="color:var(--accent-red)">cancel</span></div>
    `;
    list.appendChild(el);
  });
}

