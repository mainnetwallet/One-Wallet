window.swKeyInputPreview = function() {
  const raw  = (document.getElementById('sw-key-input') || {}).value || '';
  const prev = document.getElementById('sw-key-preview');
  if (!prev) return;
  if (!raw.trim()) { prev.textContent = ''; prev.style.color = 'var(--text-muted)'; prev._pk = null; prev._addr = null; return; }
  try {
    const pk     = raw.trim().startsWith('0x') ? raw.trim() : '0x' + raw.trim();
    const wallet = new ethers.Wallet(pk);
    prev.textContent = wallet.address.slice(0,8) + '…' + wallet.address.slice(-6);
    prev.style.color = 'var(--accent-green)';
    prev._addr = wallet.address;
    prev._pk   = pk;
  } catch(_) {
    prev.textContent = 'Invalid key';
    prev.style.color = 'var(--accent-red)';
    prev._addr = null;
    prev._pk   = null;
  }
};

window.swUseKeyInput = function() {
  const prev = document.getElementById('sw-key-preview');
  let pk, addr;
  if (prev && prev._pk && prev._addr) {
    pk = prev._pk; addr = prev._addr;
  } else {
    const raw = ((document.getElementById('sw-key-input') || {}).value || '').trim();
    if (!raw) return;
    try {
      pk   = raw.startsWith('0x') ? raw : '0x' + raw;
      addr = new ethers.Wallet(pk).address;
    } catch(_) {
      if (typeof _nxsw_swShowToast === 'function') _nxsw_swShowToast('❌ Invalid private key');
      return;
    }
  }
  _swSelectWalletFromPanel(pk, addr);
  const ki = document.getElementById('sw-key-input');
  if (ki) ki.value = '';
  if (prev) { prev.textContent = ''; prev._pk = null; prev._addr = null; }
};

function swInit() {
  if (!SW._chainInitialized) {
    SW._chainInitialized = true;
    // Restore saved swap chain — independent from home chain
    const chains = (typeof getAllChains === 'function' ? getAllChains() : []).filter(c => c.chainId !== null);
    const targetChainId = _swSavedChainId || 8453;
    const targetChain = chains.find(c => String(c.chainId) === String(targetChainId)) || chains.find(c => c.chainId === 8453) || chains[0];
    if (targetChain) setSwapChain(targetChain, false);
  }
  // ── Sync connect button UI with restored wallet state ──
  _swUpdateConnectBtn();
  if (SW.walletConnected && typeof _nxsw_swUpdateBalances === 'function') _nxsw_swUpdateBalances();
  swRenderRecentSwaps();
  swUpdateUI();
  // ── FIX: Re-render token logos after small delay to ensure DOM is fully ready ──
  setTimeout(function() { swUpdateUI(); }, 80);
}

function swUpdateUI() {
  // ── Auto-reset logic: set sensible defaults if tokens missing ──
  if (!SW._lockedTokens) {
    if (SW.fromToken) {
      const _allToks = (typeof _nxsw_getTokens === 'function') ? _nxsw_getTokens() : [];
      if (!SW.toToken) {
        if (SW.fromToken.isNative) {
          const _u = _allToks.find(function(t){ return (t.sym||'').toUpperCase()==='USDC' && t.sym!==SW.fromToken.sym; });
          SW.toToken = _u || _allToks.find(function(t){ return !t.isNative && t.sym!==SW.fromToken.sym; }) || _allToks.find(function(t){ return t.sym!==SW.fromToken.sym; }) || null;
        } else {
          const _n = _allToks.find(function(t){ return t.isNative===true && t.sym!==SW.fromToken.sym; });
          SW.toToken = _n || _allToks.find(function(t){ return t.sym!==SW.fromToken.sym; }) || null;
        }
      }
      if (SW.toToken && SW.toToken.sym === SW.fromToken.sym) {
        const _altTo = _allToks.find(function(t){ return t.sym !== SW.fromToken.sym; });
        SW.toToken = _altTo || null;
      }
    }
  }
  // From token
  swRenderTokenBox('from', SW.fromToken);
  swRenderTokenBox('to', SW.toToken);
  // Balances
  _nxsw_swUpdateBalances();
  // Button state
  swUpdateButton();
}

function swRenderTokenBox(side, token) {
  const icon = document.getElementById(`sw-${side}-icon`);
  const sym  = document.getElementById(`sw-${side}-sym`);
  if (!icon) return;

  // No token selected — show empty "Select" state
  if (!token) {
    icon.style.cssText = 'width:28px;height:28px;border-radius:8px;background:var(--bg-raised);border:1.5px dashed var(--border-glow);display:flex;align-items:center;justify-content:center;flex-shrink:0;';
    icon.innerHTML = '<span class="material-icons-round" style="font-size:15px;color:var(--accent-primary);pointer-events:none;">add</span>';
    if (sym) sym.textContent = 'Select';
    return;
  }

  const [c1,c2] = (token.color || '#6366f1,#8b5cf6').split(',');
  const logoURI = token.logoUrl || token.logo || token.logoURI || _nxsw_TOKEN_LOGOS[(token.sym||'').toUpperCase()] || _nxsw_TOKEN_LOGOS[token.sym] || null;
  icon.innerHTML = '';
  if (logoURI) {
    icon.style.cssText = 'width:28px;height:28px;border-radius:8px;overflow:hidden;flex-shrink:0;background:transparent;display:flex;align-items:center;justify-content:center;';
    const img = document.createElement('img');
    img.src = logoURI;
    img.width = 28; img.height = 28;
    img.style.cssText = 'border-radius:8px;object-fit:cover;display:block;pointer-events:none;';
    img.onerror = function() {
      icon.style.cssText = `width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,${c1},${c2});display:flex;align-items:center;justify-content:center;flex-shrink:0;`;
      icon.innerHTML = '';
      const sp = document.createElement('span');
      sp.style.cssText = 'font-size:13px;font-weight:800;color:#fff;pointer-events:none;';
      sp.textContent = token.icon || token.sym.slice(0,2);
      icon.appendChild(sp);
    };
    icon.appendChild(img);
  } else {
    icon.style.cssText = `width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,${c1},${c2});display:flex;align-items:center;justify-content:center;flex-shrink:0;`;
    const sp = document.createElement('span');
    sp.style.cssText = 'font-size:13px;font-weight:800;color:#fff;pointer-events:none;';
    sp.textContent = token.icon || token.sym.slice(0,2);
    icon.appendChild(sp);
  }
  if (sym) sym.textContent = token.sym;
}

