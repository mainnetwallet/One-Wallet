// ══════════════════════════════════════════════════════════════
// ── DELEGATION CHAIN PICKER OVERLAY ──
// Dedicated chain picker for the Delegation page
// Mirrors hcp-overlay but only applies to delegation context
// ══════════════════════════════════════════════════════════════
function openDelChainPicker() {
  const overlay = document.getElementById('del-chain-overlay');
  if (!overlay) return;
  // Clear search
  const searchEl = document.getElementById('del-chain-search');
  if (searchEl) searchEl.value = '';
  const clearEl = document.getElementById('del-chain-search-clear');
  if (clearEl) clearEl.style.display = 'none';
  // Render list
  renderDelChainList();
  // Open
  overlay.classList.add('open');
}

function closeDelChainPicker() {
  const overlay = document.getElementById('del-chain-overlay');
  if (overlay) overlay.classList.remove('open');
}

function renderDelChainList() {
  const listEl = document.getElementById('del-chain-list');
  if (!listEl) return;

  const searchEl = document.getElementById('del-chain-search');
  const q = searchEl ? searchEl.value.trim().toLowerCase() : '';
  const clearEl = document.getElementById('del-chain-search-clear');
  if (clearEl) clearEl.style.display = q ? '' : 'none';

  const allChains = (typeof getAllChains === 'function') ? getAllChains().filter(c => c.chainId !== null) : [];
  const filtered = q
    ? allChains.filter(c => (c.name||'').toLowerCase().includes(q) || String(c.chainId||'').includes(q))
    : allChains;

  const activeChainId = (typeof delCurrentChainId !== 'undefined' && delCurrentChainId) ? delCurrentChainId : 8453;

  if (filtered.length === 0) {
    listEl.innerHTML = `<div style="text-align:center;padding:32px 20px;color:var(--text-muted);font-family:var(--font-mono);font-size:12px;">No networks found</div>`;
    return;
  }

  listEl.innerHTML = filtered.map(chain => {
    const isActive = chain.chainId === activeChainId;
    const isBase   = chain.chainId === 8453;
    const logoHTML = chain.logoURI
      ? `<img src="${chain.logoURI}" width="36" height="36" style="border-radius:10px;object-fit:cover;display:block;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';" /><span style="display:none;font-size:20px;line-height:1;width:36px;height:36px;align-items:center;justify-content:center;border-radius:10px;background:var(--bg-raised);">${chain.emoji||'🔗'}</span>`
      : `<span style="font-size:22px;line-height:1;width:36px;height:36px;display:flex;align-items:center;justify-content:center;">${chain.emoji||'🔗'}</span>`;
    const colorAccent = chain.color || '#6366f1';
    const activeBorder = isActive ? `border-color:${colorAccent};background:rgba(${_safeDelHexToRgb(colorAccent)},0.10);` : '';
    const baseBadge = isBase
      ? `<span style="font-size:8px;font-weight:700;letter-spacing:1px;padding:2px 6px;border-radius:4px;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.35);color:var(--accent-green);flex-shrink:0;">FREE GAS</span>`
      : '';
    const activeTick = isActive
      ? `<span class="material-icons-round" style="font-size:18px;color:${colorAccent};flex-shrink:0;">check_circle</span>`
      : `<span class="material-icons-round" style="font-size:18px;color:var(--border-subtle);flex-shrink:0;">radio_button_unchecked</span>`;

    return `<div onclick="selectDelChain(${chain.chainId})" style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:14px;background:var(--bg-glass);border:1.5px solid var(--border-subtle);cursor:pointer;margin-bottom:8px;transition:all 0.2s;${activeBorder}" onmousedown="this.style.transform='scale(0.98)'" onmouseup="this.style.transform=''" ontouchstart="this.style.transform='scale(0.98)'" ontouchend="this.style.transform=''">
      <div style="width:36px;height:36px;flex-shrink:0;position:relative;">${logoHTML}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:700;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${chain.name}</div>
        <div style="font-size:10px;font-family:var(--font-mono);color:var(--text-muted);margin-top:1px;">Chain ID: ${chain.chainId}</div>
      </div>
      ${baseBadge}
      ${activeTick}
    </div>`;
  }).join('');
}

function _safeDelHexToRgb(hex) {
  try {
    if (typeof hexToRgb === 'function') return hexToRgb(hex);
    const h = (hex||'6366f1').replace('#','');
    return parseInt(h.slice(0,2),16)+','+parseInt(h.slice(2,4),16)+','+parseInt(h.slice(4,6),16);
  } catch { return '99,102,241'; }
}

function selectDelChain(chainId) {
  // 1. Update delegation-only chain state — do NOT touch home screen chain
  delCurrentChainId = chainId;
  // 2. Sync delegation page UI (badge, RPC URLs, contract address)
  if (typeof delSyncActiveChain === 'function') delSyncActiveChain();
  // 3. Close overlay
  closeDelChainPicker();
  // 4. Haptic
  try { if (navigator.vibrate) navigator.vibrate(18); } catch(e) {}
  // 5. Toast feedback
  const chain = (typeof getAllChains === 'function') ? getAllChains().find(c => c.chainId === chainId) : null;
  if (chain && typeof showToast === 'function') {
    showToast((chain.emoji||'🔗') + ' ' + chain.name + ' selected (Delegation only)', 'success');
  }
}

