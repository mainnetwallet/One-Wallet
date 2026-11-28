
/* ════════════════════════════════════════════════════
   SWAP WALLET PANEL — open / close / render / key input
   ════════════════════════════════════════════════════ */

let _swExpandedGroupIdx = -1;

window.swOpenWalletPanel = function() {
  // Auto-expand the group that contains the currently selected wallet
  if (SW.walletConnected && SW.walletAddress) {
    const _groups = (typeof loadWalletGroups === 'function') ? loadWalletGroups().filter(g => g && g.keys && g.keys.length > 0) : [];
    let _foundIdx = -1;
    for (let _gi = 0; _gi < _groups.length; _gi++) {
      for (const _pk of (_groups[_gi].keys || [])) {
        try {
          const _n = _pk.startsWith('0x') ? _pk : '0x' + _pk;
          if (new ethers.Wallet(_n).address.toLowerCase() === SW.walletAddress.toLowerCase()) {
            _foundIdx = _gi; break;
          }
        } catch(_) {}
      }
      if (_foundIdx !== -1) break;
    }
    if (_foundIdx !== -1) _swExpandedGroupIdx = _foundIdx;
  }
  _swRenderWalletPanel();
  // Clear key input state
  const ki = document.getElementById('sw-key-input');
  if (ki) ki.value = '';
  const kp = document.getElementById('sw-key-preview');
  if (kp) { kp.textContent = ''; kp._pk = null; kp._addr = null; }
  const overlay = document.getElementById('sw-wallet-panel-overlay');
  const panel   = document.getElementById('sw-wallet-panel');
  if (!overlay || !panel) return;
  overlay.style.pointerEvents = 'all';
  overlay.style.opacity       = '1';
  panel.style.transform       = 'translateX(0)';
  if (typeof haptic === 'function') haptic();
};

window.swCloseWalletPanel = function() {
  const overlay = document.getElementById('sw-wallet-panel-overlay');
  const panel   = document.getElementById('sw-wallet-panel');
  if (!overlay || !panel) return;
  overlay.style.opacity   = '0';
  overlay.style.pointerEvents = 'none'; // immediate — no setTimeout race
  panel.style.transform   = 'translateX(100%)';
};

// Swipe-to-close for this panel (and every other drawer / sheet) is one shared gesture:
// scripts/shared/ui/sheet-swipe-close.js, with the list of drawers and sheets in scripts/shared/ui/swipe-close-registry.js

// Signing wallet panel (shared wallet drawer UI, single select): a group only expands,
// one wallet is picked as the swap signer.
function _swRenderWalletPanel() {
  const body   = document.getElementById('sw-wallet-panel-body');
  if (!body) return;
  const groups = (typeof loadWalletGroups === 'function') ? loadWalletGroups().filter(g => g && g.keys && g.keys.length > 0) : [];
  const active = (typeof SW !== 'undefined' && SW.walletAddress) ? String(SW.walletAddress).toLowerCase() : '';

  WDU.renderList(body, {
    mode: 'single',
    groups: groups,
    emptyHtml: '<div class="wdu-empty">No wallet groups<br><span style="font-size:11px;opacity:.6;">Add them in Settings \u2192 Wallet Groups</span></div>',
    isOpen: function(gi) { return gi === _swExpandedGroupIdx; },
    isKeySel: function(gi, ki) {
      return !!active && WDU.addressOf(groups[gi].keys[ki]).toLowerCase() === active;
    },
    onExpand: function(gi) {
      _swExpandedGroupIdx = (_swExpandedGroupIdx === gi) ? -1 : gi;
      _swRenderWalletPanel();
    },
    onKey: function(gi, ki) {
      const pk = groups[gi].keys[ki];
      const addr = WDU.addressOf(pk);
      if (!addr) return;
      _swSelectWalletFromPanel(pk, addr);
    }
  });
}
