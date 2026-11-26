// ── FROM Wallet Group Picker ──
let _sendFromSelectedPk = null; // track currently selected pk in picker
let _sendFromSelectTimer = null; // cancel pending select on quick deselect
let _sendBoxLocked = false; // when true, _updateSendSelectedBox is blocked (deselected state)
const _sendKeyMetaOverride = {}; // pk -> {groupName, walletNum} set by FROM GROUPS picker

function _normPk(k) { return String(k||'').trim().replace(/^0x/i,'').toLowerCase(); }

async function openSendFromWgPicker() {
  // Sync current selected pk from send-pk input (most reliable) or localStorage (AES-decrypted)
  try {
    const inputPk = (document.getElementById('send-pk') || {}).value || '';
    const _rawSavedPk = localStorage.getItem('one_send_from_pk') || '';
    const _decSavedPk = _rawSavedPk ? (await OneCrypto.decrypt(_rawSavedPk) || '') : '';
    _sendFromSelectedPk = (inputPk.length >= 60 ? inputPk : _decSavedPk) || null;
  } catch(e) {}

  // Auto-expand the group that contains the selected key
  if (_sendFromSelectedPk) {
    const groups = loadWalletGroups();
    const normSel = _normPk(_sendFromSelectedPk);
    let foundIdx = -1;
    groups.forEach((g, gi) => {
      if (foundIdx !== -1) return;
      if (g.keys && g.keys.some(pk => _normPk(pk) === normSel)) foundIdx = gi;
    });
    window._sendFromExpandedGroupIdx = foundIdx;
  } else {
    window._sendFromExpandedGroupIdx = -1;
  }

  _renderSendFromWgList();
  const overlay = document.getElementById('send-from-wg-overlay');
  const modal   = document.getElementById('send-from-wg-modal');
  if (overlay) { overlay.style.opacity='1'; overlay.style.pointerEvents='all'; }
  if (modal)   modal.style.transform = 'translateX(0)';
  haptic();

  // Scroll selected wallet item into view after panel animation
  if (_sendFromSelectedPk) {
    setTimeout(() => {
      const sel = document.getElementById('send-from-wg-selected-item');
      if (sel) sel.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 340);
  }
}

function _renderSendFromWgList() {
  const groups = loadWalletGroups();
  const list = document.getElementById('send-from-wg-list');
  if (!list) return;
  list.innerHTML = '';

  if (groups.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:24px 12px;font-family:var(--font-mono);font-size:11px;color:var(--text-muted);line-height:1.8;">No wallet groups.<br>Go to Settings → Wallet Groups.</div>';
    return;
  }

  if (typeof _sendFromExpandedGroupIdx === 'undefined') window._sendFromExpandedGroupIdx = -1;

  groups.forEach((g, gi) => {
    const isExpanded = gi === _sendFromExpandedGroupIdx;

    const ghdr = document.createElement('div');
    ghdr.style.cssText = isExpanded
      ? 'display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:12px;margin-bottom:4px;cursor:pointer;border:1px solid rgba(99,102,241,0.55);background:linear-gradient(120deg,rgba(99,102,241,0.18) 0%,rgba(139,92,246,0.13) 100%);box-shadow:0 0 18px rgba(99,102,241,0.18),inset 0 1px 0 rgba(255,255,255,0.06);transition:all 0.22s;'
      : 'display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:12px;margin-bottom:4px;cursor:pointer;border:1px solid var(--border-subtle);background:var(--bg-glass);transition:all 0.22s;';
    ghdr.innerHTML = isExpanded
      ? '<span class="material-icons-round" style="font-size:15px;color:#a78bfa;filter:drop-shadow(0 0 4px rgba(167,139,250,0.6));">bolt</span>' +
        '<div style="flex:1;"><div style="font-size:11px;font-weight:800;letter-spacing:0.5px;background:linear-gradient(90deg,#a78bfa,#6366f1);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">' + g.name.toUpperCase() + '</div>' +
        '<div style="font-size:8px;font-family:var(--font-mono);color:rgba(167,139,250,0.6);margin-top:1px;letter-spacing:1px;">' + g.keys.length + ' KEYS</div></div>' +
        '<span class="material-icons-round" style="font-size:15px;color:#a78bfa;transform:rotate(180deg);transition:transform 0.25s;">expand_more</span>'
      : '<span class="material-icons-round" style="font-size:15px;color:var(--text-muted);">folder</span>' +
        '<div style="flex:1;"><div style="font-size:11px;font-weight:700;color:var(--text-secondary);">' + g.name + '</div>' +
        '<div style="font-size:8px;font-family:var(--font-mono);color:var(--text-muted);margin-top:1px;letter-spacing:1px;">' + g.keys.length + ' KEYS</div></div>' +
        '<span class="material-icons-round" style="font-size:15px;color:var(--text-muted);transition:transform 0.25s;">expand_more</span>';

    ghdr.addEventListener('click', e => {
      e.stopPropagation();
      _sendFromExpandedGroupIdx = isExpanded ? -1 : gi;
      _renderSendFromWgList();
    });
    list.appendChild(ghdr);

    if (!isExpanded) return;

    const itemsWrap = document.createElement('div');
    itemsWrap.style.cssText = 'padding:3px 2px 10px;display:flex;flex-direction:column;gap:5px;margin-left:20%;';

    g.keys.forEach((pk, wi) => {
      let addr = null;
      try { addr = new ethers.Wallet(pk.startsWith('0x') ? pk : '0x' + pk).address; } catch(_) {}
      if (!addr) return;

      const isSelected = _sendFromSelectedPk && _normPk(pk) === _normPk(_sendFromSelectedPk);
      const short = addr.slice(0, 6) + '…' + addr.slice(-4);

      const item = document.createElement('div');
      if (isSelected) item.id = 'send-from-wg-selected-item';
      item.style.cssText = isSelected
        ? 'position:relative;display:flex;align-items:stretch;border-radius:10px;border:1px solid rgba(99,102,241,0.5);background:linear-gradient(120deg,rgba(99,102,241,0.16) 0%,rgba(139,92,246,0.10) 100%);box-shadow:0 0 12px rgba(99,102,241,0.13),inset 0 1px 0 rgba(255,255,255,0.07);cursor:pointer;transition:all 0.18s;overflow:hidden;width:100%;box-sizing:border-box;'
        : 'position:relative;display:flex;align-items:stretch;border-radius:10px;border:1px solid rgba(255,255,255,0.07);background:rgba(255,255,255,0.03);cursor:pointer;transition:all 0.18s;overflow:hidden;width:100%;box-sizing:border-box;';

      const accentBar = document.createElement('div');
      accentBar.style.cssText = isSelected
        ? 'width:3px;flex-shrink:0;border-radius:3px 0 0 3px;background:linear-gradient(180deg,#a78bfa,#6366f1);'
        : 'width:3px;flex-shrink:0;border-radius:3px 0 0 3px;background:rgba(255,255,255,0.06);';

      const content = document.createElement('div');
      content.style.cssText = 'flex:1;display:flex;align-items:center;gap:8px;padding:8px 10px;min-width:0;';
      content.innerHTML =
        '<div style="width:22px;height:22px;border-radius:6px;background:' + (isSelected ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.05)') + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;font-family:var(--font-mono);font-size:9px;font-weight:700;color:' + (isSelected ? '#a78bfa' : 'var(--text-muted)') + ';">' + (wi + 1) + '</div>' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:10px;font-weight:700;color:' + (isSelected ? '#e0d7ff' : 'var(--text-secondary)') + ';">' + g.name + ' <span style="color:' + (isSelected ? '#a78bfa' : 'var(--text-muted)') + ';">#' + (wi + 1) + '</span></div>' +
          '<div style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);margin-top:1px;">' + short + '</div>' +
        '</div>' +
        (isSelected ? '<span class="material-icons-round" style="font-size:14px;color:#a78bfa;flex-shrink:0;">check_circle</span>' : '');

      item.appendChild(accentBar);
      item.appendChild(content);

      item.addEventListener('touchstart', () => { item.style.opacity = '0.75'; }, { passive: true });
      item.addEventListener('touchend', () => { item.style.opacity = ''; });

      item.onclick = () => {
        if (isSelected) {
          // Deselect
          _sendFromSelectedPk = null;
          clearTimeout(_sendFromSelectTimer);
          try { localStorage.removeItem('one_send_from_pk'); } catch(e) {}
          const _npkClear = _normPk(pk);
          if (_sendKeyMetaOverride[_npkClear]) delete _sendKeyMetaOverride[_npkClear];
          sendSelectedKeyIndex = -1;
          _clearSendSelectedBox();
          const _sks = document.getElementById('send-key-selector');
          if (_sks) _sks.style.display = 'none';
          const _skl = document.getElementById('send-key-list');
          if (_skl) _skl.innerHTML = '';
          const input = document.getElementById('send-pk');
          if (input) input.value = '';
          sendWallet = null; sendProvider = null; sendBalances = {};
          document.querySelectorAll('.send-token-bal').forEach(el => { el.textContent = '—'; });
          (document.getElementById('send-bal-display') || {}).textContent = 'Balance —';
          (document.getElementById('send-btn') || {}).disabled = true;
          checkSendReady();
          showToast('Wallet deselected', 'radio_button_unchecked');
          closeSendFromWgPicker();
        } else {
          // Select
          _sendFromSelectedPk = pk;
          _sendFromSelectTimer = setTimeout(() => selectSendFromWallet(pk, g.name, wi + 1), 120);
        }
      };

      itemsWrap.appendChild(item);
    });

    list.appendChild(itemsWrap);
  });
}

function closeSendFromWgPicker() {
  window._sendFromExpandedGroupIdx = -1;
  const overlay = document.getElementById('send-from-wg-overlay');
  const modal   = document.getElementById('send-from-wg-modal');
  if (!overlay) return;
  overlay.style.opacity = '0';
  overlay.style.pointerEvents = 'none';
  if (modal) modal.style.transform = 'translateX(100%)';
  haptic();
}

function selectSendFromWallet(pk, groupName, walletNum) {
  // Save to localStorage (AES-encrypted)
  OneCrypto.encrypt(pk).then(function(_encSfwPk) {
    try { localStorage.setItem('one_send_from_pk', _encSfwPk); } catch(e) {}
  });

  // Track selected pk so buildSendKeyList can skip it
  _sendFromSelectedPk = pk;

  // Store meta override so buildSendKeyList shows correct label
  const norm = (k) => String(k||'').trim().replace(/^0x/i,'').toLowerCase();
  _sendKeyMetaOverride[norm(pk)] = { groupName, walletNum };

  // Find index in validatedKeys
  const idx = validatedKeys.findIndex(k => norm(k) === norm(pk));
  sendSelectedKeyIndex = idx; // -1 if not in validatedKeys

  // Update unified selected wallet box first
  _sendBoxLocked = false;
  _updateSendSelectedBox(pk, groupName, walletNum, idx !== -1 ? idx + 1 : walletNum);

  // Always hide key-selector when selecting from FROM GROUPS — only the selected box shows
  const _sks = document.getElementById('send-key-selector');
  if (_sks) _sks.style.display = 'none';
  const _skl = document.getElementById('send-key-list');
  if (_skl) _skl.innerHTML = '';

  // Update pk input and trigger wallet load
  const input = document.getElementById('send-pk');
  if (input) input.value = pk;
  closeSendFromWgPicker();
  onSendPkInput(pk);
  showToast(groupName + ' #' + walletNum + ' selected', 'key');
  haptic();
}

async function _restoreSendFromWallet() {
  try {
    const rawPk = localStorage.getItem('one_send_from_pk');
    if (!rawPk) return;
    // AES-decrypt stored key (handles both ncx4 and legacy formats)
    const savedPk = await OneCrypto.decrypt(rawPk);
    if (!savedPk || savedPk.length < 60) return;
    const input = document.getElementById('send-pk');
    if (input) input.value = savedPk;
    onSendPkInput(savedPk);
  } catch(e) {}
}

// Close FROM picker when tapping backdrop
document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('send-from-wg-overlay');
  if (overlay) {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeSendFromWgPicker();
    });
  }
});

