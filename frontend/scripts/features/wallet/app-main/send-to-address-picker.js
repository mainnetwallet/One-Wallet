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

function _renderSendToWgList() {
  const groups = loadWalletGroups();
  const list = document.getElementById('send-to-wg-list');
  if (!list) return;
  list.innerHTML = '';

  if (groups.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:24px 12px;font-family:var(--font-mono);font-size:11px;color:var(--text-muted);line-height:1.8;">No wallet groups.<br>Go to Settings → Wallet Groups.</div>';
    return;
  }

  const currentAddr = ((document.getElementById('send-to') || {}).value || '').trim().toLowerCase();

  groups.forEach((g, gi) => {
    const isExpanded = gi === _sendToExpandedGroupIdx;

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
      _sendToExpandedGroupIdx = isExpanded ? -1 : gi;
      _renderSendToWgList();
    });
    list.appendChild(ghdr);

    if (!isExpanded) return;

    const itemsWrap = document.createElement('div');
    itemsWrap.style.cssText = 'padding:3px 2px 10px;display:flex;flex-direction:column;gap:5px;margin-left:20%;';

    g.keys.forEach((pk, wi) => {
      let addr = null;
      try { addr = new ethers.Wallet(pk.startsWith('0x') ? pk : '0x' + pk).address; } catch(_) {}
      if (!addr) return;

      const isSelected = currentAddr && addr.toLowerCase() === currentAddr;
      const short = addr.slice(0, 6) + '…' + addr.slice(-4);

      const item = document.createElement('div');
      if (isSelected) item.id = 'send-to-wg-selected-item';
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
        (isSelected ? '<span class="material-icons-round" style="font-size:14px;color:#a78bfa;flex-shrink:0;">check_circle</span>' : '<span class="material-icons-round" style="font-size:14px;color:var(--text-muted);flex-shrink:0;">arrow_forward</span>');

      item.appendChild(accentBar);
      item.appendChild(content);

      item.addEventListener('touchstart', () => { item.style.opacity = '0.75'; }, { passive: true });
      item.addEventListener('touchend', () => { item.style.opacity = ''; });
      item.onclick = () => {
        if (isSelected) {
          const toInput = document.getElementById('send-to');
          if (toInput) toInput.value = '';
          closeSendToWgPicker();
          if (typeof onSendToInput === 'function') onSendToInput();
          haptic();
        } else {
          selectSendToAddress(addr);
        }
      };
      itemsWrap.appendChild(item);
    });

    list.appendChild(itemsWrap);
  });
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

