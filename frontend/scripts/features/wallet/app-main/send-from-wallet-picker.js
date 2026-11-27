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

// Deselect the wallet currently used as the send source (tapping the selected wallet again)
function _sendFromDeselect(pk) {
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
}

// FROM picker (shared wallet drawer UI, single select): a group only expands, one wallet is picked.
function _renderSendFromWgList() {
  const groups = loadWalletGroups();
  const list = document.getElementById('send-from-wg-list');
  if (!list) return;

  if (typeof _sendFromExpandedGroupIdx === 'undefined') window._sendFromExpandedGroupIdx = -1;

  WDU.renderList(list, {
    mode: 'single',
    groups: groups,
    emptyHtml: '<div class="wdu-empty">No wallet groups<br><span style="font-size:11px;opacity:.6;">Add them in Settings \u2192 Wallet Groups</span></div>',
    isOpen: function(gi) { return gi === _sendFromExpandedGroupIdx; },
    isKeySel: function(gi, ki) {
      return !!_sendFromSelectedPk && _normPk(groups[gi].keys[ki]) === _normPk(_sendFromSelectedPk);
    },
    onExpand: function(gi) {
      _sendFromExpandedGroupIdx = (_sendFromExpandedGroupIdx === gi) ? -1 : gi;
      _renderSendFromWgList();
    },
    onKey: function(gi, ki) {
      const g = groups[gi];
      const pk = g.keys[ki];
      if (!WDU.addressOf(pk)) return;
      if (_sendFromSelectedPk && _normPk(pk) === _normPk(_sendFromSelectedPk)) {
        _sendFromDeselect(pk);
      } else {
        _sendFromSelectedPk = pk;
        _renderSendFromWgList();
        _sendFromSelectTimer = setTimeout(() => selectSendFromWallet(pk, g.name, ki + 1), 120);
      }
    }
  });

  // Keep the id used to scroll the selected wallet into view
  const selEl = list.querySelector('.wdu-key.wdu-sel');
  if (selEl) selEl.id = 'send-from-wg-selected-item';
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

