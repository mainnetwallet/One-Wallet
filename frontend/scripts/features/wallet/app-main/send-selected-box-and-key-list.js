

function _clearSendSelectedBox() {
  _sendBoxLocked = true; // lock — prevent any _updateSendSelectedBox from showing box
  const box = document.getElementById('send-selected-wallet-box');
  if (box) {
    box.style.cssText = box.style.cssText.replace(/display\s*:[^;]*/g, '') + ';display:none !important;';
    box.setAttribute('hidden', '');
  }
  const labelEl = document.getElementById('send-sel-wallet-label');
  if (labelEl) labelEl.innerHTML = '';
  const addrEl = document.getElementById('send-sel-wallet-addr');
  if (addrEl) addrEl.textContent = '';
  const numEl = document.getElementById('send-sel-wallet-num');
  if (numEl) numEl.textContent = '';
}

function _showSendSelectedBox() {
  const box = document.getElementById('send-selected-wallet-box');
  if (box) {
    box.removeAttribute('hidden');
    box.style.cssText = box.style.cssText.replace(/display\s*:[^;]*!important[;]*/g, '');
    box.style.display = 'block';
  }
}

function _getWalletGroupMeta(pk) {
  // Normalize: strip 0x, lowercase, trim
  const norm = (k) => String(k||'').trim().replace(/^0x/i,'').toLowerCase();
  const npk = norm(pk);
  // 1) Try groupOrderedKeys (populated by swap group selection)
  if (typeof groupOrderedKeys !== 'undefined' && Array.isArray(groupOrderedKeys) && groupOrderedKeys.length > 0) {
    for (const m of groupOrderedKeys) {
      if (norm(m.key) === npk) {
        return { groupName: String(m.groupName||''), walletNum: Number(m.keyIndexInGroup) + 1 };
      }
    }
  }
  // 2) Fallback: scan all wallet groups in localStorage
  try {
    const groups = loadWalletGroups();
    for (const g of groups) {
      const keys = g.keys || [];
      for (let i = 0; i < keys.length; i++) {
        if (norm(keys[i]) === npk) {
          return { groupName: String(g.name||''), walletNum: i + 1 };
        }
      }
    }
  } catch(e) {}
  return null;
}

function buildSendKeyList() {
  const list = document.getElementById('send-key-list');
  if (list) list.innerHTML = '';
  let unselectedCount = 0;
  const _selectedNpk = _sendFromSelectedPk ? String(_sendFromSelectedPk||'').trim().replace(/^0x/i,'').toLowerCase() : null;
  validatedKeys.forEach((pk, i) => {
    // Skip the currently selected key — it shows in the unified box
    // Match by index OR by pk (for wg-selected keys)
    if (i === sendSelectedKeyIndex) return;
    if (_selectedNpk && String(pk||'').trim().replace(/^0x/i,'').toLowerCase() === _selectedNpk) return;
    unselectedCount++;
    let addr = '...';
    try { addr = new ethers.Wallet(pk).address; } catch(e) {}
    const _npk = String(pk||'').trim().replace(/^0x/i,'').toLowerCase();
    const meta = (_sendKeyMetaOverride && _sendKeyMetaOverride[_npk]) || _getWalletGroupMeta(pk);
    const addrLabel = meta
      ? '<span style="font-weight:700;color:var(--text-primary);">' + meta.groupName + '</span>'
        + ' <span style="color:var(--neon-purple);font-weight:700;">#' + meta.walletNum + '</span>'
      : '<span style="color:var(--text-secondary);font-weight:600;">Wallet #' + (i + 1) + '</span>';

    const item = document.createElement('div');
    item.className = 'send-key-item';
    item.id = 'send-key-item-' + i;
    item.innerHTML =
      '<div class="send-key-num">' + (i + 1) + '</div>' +
      '<div class="send-key-info">' +
        '<div class="send-key-addr">' + addrLabel + '</div>' +
        '<div class="send-key-addr-full">' + addr + '</div>' +
      '</div>' +
      '<div class="send-key-check"><span class="material-icons-round">check_circle</span></div>';
    item.onclick = () => selectSendKey(i);
    list.appendChild(item);
  });
  // Hide the list container if nothing left to show
  const selector = document.getElementById('send-key-selector');
  if (selector) selector.style.display = unselectedCount > 0 ? 'block' : 'none';
}

async function selectSendKey(index) {
  sendSelectedKeyIndex = index;
  // Load the key
  const pk = validatedKeys[index];
  document.getElementById('send-pk') && ((document.getElementById('send-pk') || {}).value = pk);
  // Save to localStorage (AES-encrypted) and sync picker state
  OneCrypto.encrypt(pk).then(function(_encSendPk) {
    try { localStorage.setItem('one_send_from_pk', _encSendPk); } catch(e) {}
  });
  _sendFromSelectedPk = pk;
  // Update unified selected box
  const meta = (_sendKeyMetaOverride && _sendKeyMetaOverride[String(pk||'').trim().replace(/^0x/i,'').toLowerCase()]) || _getWalletGroupMeta(pk);
  const gName = meta ? meta.groupName : null;
  const wNum  = meta ? meta.walletNum : (index + 1);
  _sendBoxLocked = false; // unlock — a real selection is happening
  _updateSendSelectedBox(pk, gName, wNum, index + 1);
  // Rebuild list — selected item will be excluded
  buildSendKeyList();
  await onSendPkInput(pk);
  haptic();
}

function closeSendModal() {
  document.getElementById('send-overlay')?.classList.remove('open');
  closeSendToWgPicker();
  // Stop QR camera if open
  if (typeof closeSendQrScanner === 'function') closeSendQrScanner();
  sendWallet = null; sendProvider = null;
  haptic();
}

