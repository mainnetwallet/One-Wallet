function _nxsw_getTokens() {
  // ── Use home screen TOKEN_CONFIG, filtered by current swap chain ──
  const chainId = SW.network.chainId;
  const source  = (typeof TOKEN_CONFIG !== 'undefined' && TOKEN_CONFIG.length > 0)
                  ? TOKEN_CONFIG : [];
  // TOKEN_CONFIG defaults chainId to 8453 (Base), same as home screen logic
  const filtered = chainId
    ? source.filter(t => (t.chainId || 8453) === chainId)
    : source;
  // ── Wallet suffix for cache key lookup ──
  // FIX: Match by address across all wallet groups so any wallet selected in Swap
  // correctly reads from the _balanceCache key that Home saved with that wallet's suffix.
  const _swWalletSuffix = (function() {
    const _swAddr = SW.walletConnected && SW.walletAddress ? SW.walletAddress.toLowerCase() : null;
    if (_swAddr) {
      // 1. validatedKeys (active home wallets — fastest)
      const _vk = (typeof validatedKeys !== 'undefined' && Array.isArray(validatedKeys)) ? validatedKeys : [];
      for (const k of _vk) {
        try { if (new ethers.Wallet(k).address.toLowerCase() === _swAddr) return k.slice(-8); } catch(_e) {}
      }
      // 2. All wallet groups
      try {
        const _gs = (typeof loadWalletGroups === 'function') ? loadWalletGroups() : [];
        for (const g of _gs) {
          for (const k of (g.keys || [])) {
            try { if (new ethers.Wallet(k).address.toLowerCase() === _swAddr) return k.slice(-8); } catch(_e) {}
          }
        }
      } catch(_e) {}
      // 3. SW.walletPK direct (if address matches)
      if (SW.walletPK) {
        try { if (new ethers.Wallet(SW.walletPK).address.toLowerCase() === _swAddr) return SW.walletPK.slice(-8); } catch(_e) {}
      }
    }
    // Fallback: homeActiveKey
    return (typeof homeActiveKey !== 'undefined' && homeActiveKey) ? homeActiveKey.slice(-8) : '';
  })();

  const mapped = filtered.map(t => {
    let price = 0;
    try {
      if (typeof _globalPriceCache !== 'undefined' && _globalPriceCache && t.cgId) {
        const pd = _globalPriceCache[t.cgId];
        if (pd && pd.usd) price = pd.usd;
      }
    } catch(e) {}

    // ── Pull real balance from home _balanceCache (only if wallet connected) ──
    let balance = 0;
    if (SW.walletConnected && SW.walletAddress) {
      try {
        const _bc = window._balanceCache || {};
        const _tChain = t.chainId || 8453;
        // Key format: t.id + ':' + chainId + ':' + walletSuffix
        const _cacheKey = t.id + ':' + _tChain + ':' + _swWalletSuffix;
        const _cached = _bc[_cacheKey];
        if (_cached !== undefined && !isNaN(_cached)) {
          balance = parseFloat(_cached);
        } else {
          // FIX: Only scan keys matching the swap wallet suffix — no cross-wallet contamination
          const _prefix = t.id + ':' + _tChain + ':' + _swWalletSuffix;
          const _exact = _bc[_prefix];
          if (_exact !== undefined && !isNaN(_exact)) balance = parseFloat(_exact);
        }
      } catch(e) {}
    }

    return {
      id:       t.id,
      sym:      t.sub,
      name:     t.name,
      icon:     t.icon || (t.sub || '').slice(0, 2),
      color:    t.color || t.badge || '#6366f1,#8b5cf6',
      price:    price,
      balance:  balance,
      decimals: t.decimals || 18,
      contract: t.contract || null,
      cgId:     t.cgId || null,
      isNative: t.isNative || false,
      isDefault: !!t.isDefault,   // price gate (oneSymbolPriceAllowed): built-in token
      logoURI:  t.logoUrl || t.logoURI || (typeof _nxsw_TOKEN_LOGOS !== 'undefined' ? _nxsw_TOKEN_LOGOS[(t.sub||'').toUpperCase()] || _nxsw_TOKEN_LOGOS[t.sub] : null) || null,
    };
  });
  // Fallback to built-in list if no home tokens exist for this chain
  if (mapped.length === 0) {
    const _netId = SW.network.id || 'base';
    const _fb = TOKENS_BY_NETWORK[_netId]
      || (function() {
           // For custom chains (id = 'custom-XXXX'), build a minimal native token entry from chain metadata
           const _cid = SW.network.chainId;
           const _chain = (typeof getAllChains === 'function' ? getAllChains() : []).find(c => c.chainId === _cid);
           if (!_chain) return null;
           const _sym = _chain.nativeSym || 'ETH';
           const KNOWN_CG = { 'ETH':'ethereum','BNB':'binancecoin','MATIC':'matic-network','POL':'matic-network',
             'AVAX':'avalanche-2','FTM':'fantom','OP':'optimism','ARB':'arbitrum','CRO':'crypto-com-chain',
             'CELO':'celo','GLMR':'moonbeam','KAVA':'kava','METIS':'metis-token','MNT':'mantle',
             'XDAI':'xdai','GNO':'gnosis','ASTR':'astar','CORE':'coredaoorg','ZETA':'zetachain',
             'SEI':'sei-network','KLAY':'klay-token','TLOS':'telos','ONE':'harmony','MOVR':'moonriver',
             'HT':'huobi-token','OKT':'oec-token','KCS':'kucoin-shares','FUSE':'fuse-network-token',
             'IOTX':'iotex','AURORA':'aurora-near','CANTO':'canto','VET':'vechain','HBAR':'hedera-hashgraph',
           };
           const _cgid = KNOWN_CG[_sym.toUpperCase()] || null;
           let _price = 0;
           try {
             if (_cgid && typeof _globalPriceCache !== 'undefined' && _globalPriceCache) {
               const _pd = _globalPriceCache[_cgid]; if (_pd && _pd.usd) _price = _pd.usd;
             }
           } catch(_e) {}
           return [{ sym:_sym, name:_chain.name||_sym, icon:_sym.slice(0,2), color:'#6366f1,#8b5cf6',
                     decimals:18, price:_price, balance:0, contract:null, cgId:_cgid, isNative:true,
                     logoURI:_chain.logoURI||null }];
         })()
      || TOKENS_BY_NETWORK.ethereum;
    return _fb.map(function(t){ return Object.assign({}, t, { logoURI: t.logoURI || t.logoUrl || (typeof _nxsw_TOKEN_LOGOS !== 'undefined' ? _nxsw_TOKEN_LOGOS[t.sym] || null : null) }); });
  }
  return mapped;
}

/* ── Safe net-box logo helper — emoji first, then try logo ── */
function _swSetNetBoxDisplay(el, emoji, logoURI) {
  if (!el) return;
  if (logoURI) {
    // Show logo image directly with emoji fallback
    el.textContent = '';
    el.style.fontSize = '';
    const imgEl = document.createElement('img');
    imgEl.src = logoURI;
    imgEl.width = 18; imgEl.height = 18;
    imgEl.style.cssText = 'border-radius:5px;object-fit:cover;vertical-align:middle;display:block;pointer-events:none;';
    imgEl.onerror = function() {
      if (el.isConnected) { el.textContent = emoji; el.style.fontSize = '16px'; }
    };
    el.appendChild(imgEl);
  } else {
    // No logo — show emoji
    el.textContent = emoji;
    el.style.fontSize = '16px';
  }
}

/* ── Init ── */

// ── Set active swap chain (swap-only, does NOT affect home screen) ──
function setSwapChain(chain, save) {
  if (!chain || chain.chainId === null) return;
  // Update SW.network
  SW.network = { id: chain.id || String(chain.chainId), name: chain.name, emoji: chain.emoji || '🔗', chainId: chain.chainId, logoURI: chain.logoURI || '' };
  SW.chainId = chain.chainId;
  // Persist
  if (save !== false) {
    try { localStorage.setItem('one_swap_chain_id', String(chain.chainId)); } catch {}
  }
  // Update bar UI
  _swSyncChainBar(chain.chainId, chain);
  // Reset tokens to match new chain — skip if tokens locked from Home
  if (!SW._lockedTokens) {
    const tokens = _nxsw_getTokens();
    if (tokens && tokens.length > 0) {
      if (chain.chainId === 8453) {
        const ethTok  = tokens.find(t => t.sym === 'ETH')  || tokens[0];
        const usdcTok = tokens.find(t => t.sym === 'USDC') || tokens.find(t => t.sym !== (ethTok && ethTok.sym)) || tokens[1] || null;
        SW.fromToken = ethTok;
        SW.toToken   = usdcTok && usdcTok.sym !== (ethTok && ethTok.sym) ? usdcTok : (tokens[1] && tokens[1].sym !== (ethTok && ethTok.sym) ? tokens[1] : null);
      } else {
        SW.fromToken = tokens[0];
        SW.toToken = tokens.find(t => t.sym !== (tokens[0] && tokens[0].sym)) || null;
      }
    }
  }
  // ── Chain changed: cancel all in-flight fetches ──
  clearTimeout(SW.quoteTimer);
  clearInterval(SW.scanDexInterval);
  SW.quoteTimer        = null;
  SW._fetchId          = (SW._fetchId || 0) + 1;
  // Increment by 2 so any in-flight async quote (which already did ++SW._quoteSession
  // at its start) can never match the new value — prevents stale TO-box updates
  SW._quoteSession     = (SW._quoteSession || 0) + 2;
  SW._cachedRouterAddr = null;
  SW._routerCache      = {};
  SW._cachedSwapTx     = null;
  SW.toAmount          = 0;
  SW.fromAmount        = '';

  // ── Instant DOM reset — FROM box ──
  const _amtInput = document.getElementById('sw-from-amount');
  if (_amtInput) _amtInput.value = '';
  const _fromUsd = document.getElementById('sw-from-usd');
  if (_fromUsd) _fromUsd.textContent = '\u2248 $\u2014';
  const _pctFill  = document.getElementById('sw-pct-fill');
  if (_pctFill)  _pctFill.style.width = '0%';
  const _pctThumb = document.getElementById('sw-pct-thumb');
  if (_pctThumb) { _pctThumb.style.display = 'none'; _pctThumb.style.left = '0%'; }
  const _pctDisp  = document.getElementById('sw-pct-display');
  if (_pctDisp)  { _pctDisp.textContent = '0%'; _pctDisp.style.color = 'var(--accent-primary)'; }
  const _pctRange = document.getElementById('sw-pct-range');
  if (_pctRange) _pctRange.value = '0';

  // ── Instant DOM reset — TO box ──
  const _toAmtEl = document.getElementById('sw-to-amount');
  if (_toAmtEl) { _toAmtEl.style.opacity = '1'; _toAmtEl.textContent = '\u2014'; _toAmtEl.style.color = 'var(--accent-green)'; }
  const _toUsdEl = document.getElementById('sw-to-usd');
  if (_toUsdEl) _toUsdEl.textContent = '\u2248 $0.00';

  // ── Hide all result panels instantly ──
  ['sw-dex-compare','sw-quote-loading','sw-error-box','sw-info-panel','sw-slip-quick','sw-selected-dex-badge','sw-split-badge'].forEach(function(id){
    var el = document.getElementById(id); if (el) el.style.display = 'none';
  });

  swUpdateUI();
}

