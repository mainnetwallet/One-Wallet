
let activeHomeChainId = (() => {
  try { const v = localStorage.getItem(HCP_ACTIVE_KEY); return v === 'null' ? null : (v ? Number(v) : null); } catch { return null; }
})();
// null = All Networks

// ── Sync Swap chain bar display from SW.network ──
function _swSyncChainBar(chainId, chain) {
  const emojiEl = document.getElementById('sw-chain-emoji');
  const nameEl  = document.getElementById('sw-chain-name');
  const dotEl   = document.getElementById('sw-chain-status-dot');
  const barEl   = document.getElementById('sw-chain-bar');
  if (!emojiEl || !nameEl) return;

  const displayChain = chain || (typeof getAllChains === 'function' ? getAllChains().find(c => c.chainId === chainId) : null);
  const color = displayChain ? (displayChain.color || '#6366f1') : '#6366f1';

  if (displayChain && displayChain.logoURI) {
    emojiEl.innerHTML = '<img src="' + displayChain.logoURI + '" width="18" height="18" style="border-radius:4px;object-fit:cover;vertical-align:middle;display:block;" onerror="this.style.display=\'none\';this.parentNode.innerHTML=\'' + (displayChain.emoji || '🔗') + '\'\"/>';
  } else {
    emojiEl.innerHTML = '<span style="font-size:16px;line-height:1;">' + (displayChain ? displayChain.emoji || '🔗' : '🔗') + '</span>';
  }
  const fullName = displayChain ? displayChain.name : 'Base';
  nameEl.textContent = fullName.split(' ')[0].toUpperCase();
  if (dotEl) { dotEl.style.background = 'var(--accent-green)'; dotEl.style.boxShadow = '0 0 6px var(--accent-green)'; }
  if (barEl) {
    try {
      const hex = color.replace('#','');
      const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16);
      barEl.style.borderColor = 'rgba(' + r + ',' + g + ',' + b + ',0.4)';
      barEl.style.background  = 'rgba(' + r + ',' + g + ',' + b + ',0.07)';
    } catch(e) {}
  }
}

function setActiveChain(chainId) {
  const _prevChainId = activeHomeChainId;
  activeHomeChainId = chainId;
  try { localStorage.setItem(HCP_ACTIVE_KEY, chainId === null ? 'null' : String(chainId)); } catch {}
  // Also save per current wallet
  try { if (typeof homeActiveKey !== 'undefined' && homeActiveKey) _saveChainForWallet(homeActiveKey, chainId); } catch(_tdzE) {}

  // ── NETWORK SWITCH: clear token cache so stale data won't restore for new chain ──
  if (_prevChainId !== chainId) {
    try {
      localStorage.removeItem('one_token_cache');
    } catch(e) {}
  }

  // Update button
  const chain = getAllChains().find(c => c.chainId === chainId) || BUILTIN_CHAINS[0];
  const emojiEl = document.getElementById('home-chain-emoji');
  if (emojiEl) {
    if (chain.logoURI) {
      emojiEl.innerHTML = `<img src="${chain.logoURI}" width="16" height="16" style="border-radius:4px;object-fit:cover;vertical-align:middle;" onerror="if(this.parentNode)this.outerHTML='<span style=\\'font-size:14px;line-height:1;\\'>${chain.emoji}</span>'" />`;
    } else {
      emojiEl.innerHTML = `<span style="font-size:14px;line-height:1;">${chain.emoji}</span>`;
    }
  }
  (document.getElementById('home-chain-name') || {}).textContent = chainId === null ? 'ALL' : (chain.name.length > 8 ? chain.name.split(' ')[0].toUpperCase() : chain.name.toUpperCase());
  // Dot indicator — hidden (replaced by clear button)
  const dot = document.getElementById('home-chain-dot');
  if (dot) dot.style.display = 'none';
  // Clear × button — show when a chain is selected
  const clearBtn = document.getElementById('home-chain-clear');
  if (clearBtn) clearBtn.style.display = chainId !== null ? 'flex' : 'none';
  // Arrow — show only on All Networks
  const arrowEl = document.getElementById('home-chain-arrow');
  if (arrowEl) arrowEl.style.display = chainId !== null ? 'none' : 'inline';
  // Update chain switch button style
  const btn = document.getElementById('home-chain-btn');
  if (btn) {
    btn.style.borderColor = chainId !== null ? `rgba(${hexToRgb(chain.color || '#6366f1')},0.5)` : 'rgba(255,255,255,0.12)';
    btn.style.background  = chainId !== null ? `rgba(${hexToRgb(chain.color || '#6366f1')},0.12)` : 'rgba(255,255,255,0.07)';
  }

  // ── Notify delegation page if it is active ──
  if (window.currentPage === 'delegation') {
    if (typeof delSyncActiveChain === 'function') delSyncActiveChain();
  }

  // ── Update delegation menu entry sub-label ──
  const delMenuChainEl = document.getElementById('del-menu-chain');
  if (delMenuChainEl) {
    delMenuChainEl.textContent = chainId === null
      ? 'All Networks'
      : (chain.name || 'Unknown');
  }

  // ── Re-apply wallet guard after any style changes ──
  if (typeof window.homeWalletGuardRefresh === 'function') window.homeWalletGuardRefresh();
}

function clearHomeChain() {
  if (typeof setActiveChain === 'function') setActiveChain(null);
  if (typeof loadTokens === 'function') loadTokens();
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}

// Apply saved chain on boot — 0ms, instant
function _applyBootChain() {
  try {
    const btn = document.getElementById('home-chain-btn');
    const emojiEl = document.getElementById('home-chain-emoji');
    const nameEl = document.getElementById('home-chain-name');
    if (btn && emojiEl && nameEl &&
        typeof homeActiveKey !== 'undefined' &&
        typeof hwSelectedKey !== 'undefined') {
      // ── FIX: Load per-wallet chain for the persisted selected key on boot.
      // Without this, _applyBootChain uses the global one_active_chain which
      // may belong to Group 1's 1st key — causing a wrong-chain flash before
      // homeApplyWallet() corrects it once the wallet selectors are populated.
      let _bootChain = activeHomeChainId;
      try {
        const _persistedKey = (typeof hwSelectedKey !== 'undefined' && hwSelectedKey)
          ? hwSelectedKey
          : (typeof localStorage !== 'undefined' ? _oneGetSelectedKey() : null);
        if (_persistedKey && typeof _loadChainForWallet === 'function') {
          const _perWalletChain = _loadChainForWallet(_persistedKey);
          if (_perWalletChain !== undefined) {
            _bootChain = _perWalletChain;
            // Also update activeHomeChainId so everything downstream is consistent
            activeHomeChainId = _bootChain;
            try { localStorage.setItem('one_active_chain', _bootChain === null ? 'null' : String(_bootChain)); } catch {}
          }
        }
      } catch(_e) {}
      setActiveChain(_bootChain);
    } else {
      setTimeout(_applyBootChain, 0);
    }
  } catch(e) {
    setTimeout(_applyBootChain, 0);
  }
}
document.addEventListener('DOMContentLoaded', function() {
  _applyBootChain();
  // Remove the first-paint no-transition style so page-home can animate normally on switch
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      var s = document.getElementById('_ph_init_style');
      if (s) s.parentNode.removeChild(s);
    });
  });
});