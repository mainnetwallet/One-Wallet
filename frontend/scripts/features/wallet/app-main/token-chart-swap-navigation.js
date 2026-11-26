// ── Shared helper: navigate to Swap page with a home token pre-filled as FROM ──
// Always uses getTokens() so decimal/contract/isNative are correct.
function _swNavigateWithToken(t) {
  if (!t) return;
  const SW = window.SW;
  if (!SW) { switchPage('swap'); return; }

  const chainId = t.chainId || SW.chainId || 8453;
  const sym     = (t.sub || t.symbol || '').toUpperCase();

  // 1. Switch page first — swInit runs, resets to defaults
  switchPage('swap');
  if (typeof haptic === 'function') haptic();

  // 2. After swInit, override with chosen tokens
  const allToks = (typeof getTokens === 'function') ? getTokens() : [];

  let fromTok = allToks.find(tk => (tk.sym || '').toUpperCase() === sym) || null;
  if (!fromTok) {
    const addr = t.contract || t.address || t.contractAddress || '';
    fromTok = {
      id:       t.id || sym,
      sym:      t.sub || t.symbol || sym,
      name:     t.name || sym,
      decimals: t.decimals || 18,
      contract: addr,
      address:  addr || '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
      isNative: t.isNative || (!addr),
      price:    t.price || 0,
      balance:  0,
      logoURI:  t.logoUrl || t.logo || t.logoURI || t.image || '',
      chainId:  chainId,
    };
  }

  let toTok = null;
  if (fromTok.isNative) {
    toTok = allToks.find(tk => (tk.sym||'').toUpperCase() === 'USDC') || null;
  } else {
    toTok = allToks.find(tk => tk.isNative === true) || null;
  }

  SW.fromToken = fromTok;
  SW.toToken   = toTok;

  if (typeof swRenderTokenBox === 'function') {
    swRenderTokenBox('from', SW.fromToken);
    swRenderTokenBox('to',   SW.toToken);
  }
  if (typeof swUpdateButton === 'function') swUpdateButton();
}

