// ── TO Address Wallet Group Picker ──
let _sendToExpandedGroupIdx = -1;

function openSendToWgPicker() {
  // Get current TO address value
  const currentAddr = ((document.getElementById('send-to') || {}).value || '').trim();

  // Auto-expand group that contains the current TO address
  if (currentAddr && currentAddr.startsWith('0x')) {
    const groups = loadWalletGroups();
    let foundIdx = -1;
    groups.forEach((g, gi) => {
      if (foundIdx !== -1) return;
      const found = g.keys.some(pk => {
        try {
          const addr = new ethers.Wallet(pk.startsWith('0x') ? pk : '0x' + pk).address;
          return addr.toLowerCase() === currentAddr.toLowerCase();
        } catch { return false; }
      });
      if (found) foundIdx = gi;
    });
    _sendToExpandedGroupIdx = foundIdx;
  } else {
    _sendToExpandedGroupIdx = -1;
  }

  _renderSendToWgList();
  const overlay = document.getElementById('send-to-wg-overlay');
  const modal   = document.getElementById('send-to-wg-modal');
  if (overlay) { overlay.style.opacity = '1'; overlay.style.pointerEvents = 'all'; }
  if (modal) modal.style.transform = 'translateX(0)';
  haptic();

  // Scroll selected item into view after animation
  if (currentAddr) {
    setTimeout(() => {
      const sel = document.getElementById('send-to-wg-selected-item');
      if (sel) sel.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 340);
  }
}

// TO picker (shared wallet drawer UI, single select): a group only expands, one address is picked.
function _renderSendToWgList() {
  const groups = loadWalletGroups();
  const list = document.getElementById('send-to-wg-list');
  if (!list) return;

  const currentAddr = ((document.getElementById('send-to') || {}).value || '').trim().toLowerCase();

  WDU.renderList(list, {
    mode: 'single',
    groups: groups,
    emptyHtml: '<div class="wdu-empty">No wallet groups<br><span style="font-size:11px;opacity:.6;">Add them in Settings \u2192 Wallet Groups</span></div>',
    isOpen: function(gi) { return gi === _sendToExpandedGroupIdx; },
    isKeySel: function(gi, ki) {
      const addr = WDU.addressOf(groups[gi].keys[ki]);
      return !!currentAddr && !!addr && addr.toLowerCase() === currentAddr;
    },
    onExpand: function(gi) {
      _sendToExpandedGroupIdx = (_sendToExpandedGroupIdx === gi) ? -1 : gi;
      _renderSendToWgList();
    },
    onKey: function(gi, ki) {
      const addr = WDU.addressOf(groups[gi].keys[ki]);
      if (!addr) return;
      if (currentAddr && addr.toLowerCase() === currentAddr) {
        // Tapping the selected address again clears it
        const toInput = document.getElementById('send-to');
        if (toInput) toInput.value = '';
        closeSendToWgPicker();
        if (typeof onSendToInput === 'function') onSendToInput();
        haptic();
      } else {
        selectSendToAddress(addr);
      }
    }
  });

  // Keep the id used to scroll the selected address into view
  const selEl = list.querySelector('.wdu-key.wdu-sel');
  if (selEl) selEl.id = 'send-to-wg-selected-item';
}

function closeSendToWgPicker() {
  const overlay = document.getElementById('send-to-wg-overlay');
  const modal   = document.getElementById('send-to-wg-modal');
  if (!overlay) return;
  overlay.style.opacity = '0';
  overlay.style.pointerEvents = 'none';
  if (modal) modal.style.transform = 'translateX(100%)';
  _sendToExpandedGroupIdx = -1;
  haptic();
}

function selectSendToAddress(addr) {
  (document.getElementById('send-to') || {}).value = addr;
  closeSendToWgPicker();
  onSendToInput();
  haptic();
}

// Close picker when tapping backdrop
document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('send-to-wg-overlay');
  if (overlay) {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeSendToWgPicker();
    });
  }
});

