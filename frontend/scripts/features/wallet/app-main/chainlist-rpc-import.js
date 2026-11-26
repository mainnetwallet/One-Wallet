

function hcpClClearSearch() {
  const input = document.getElementById('hcp-cl-search');
  if (input) input.value = '';
  document.getElementById('hcp-cl-clear').style.display = 'none';
  const totalR = (_clAllChains||[]).reduce((s,c)=>s+(c.rpc||[]).length,0);
  document.getElementById('hcp-cl-status-text').textContent = _clAllChains ? _clAllChains.length + ' chains · ' + totalR.toLocaleString() + ' RPCs' : '';
  hcpClRenderResults([]);
}

function hcpClRenderResults(chains) {
  const container = document.getElementById('hcp-cl-results');
  if (!container) return;

  if (!chains.length) {
    const q = document.getElementById('hcp-cl-search')?.value.trim();
    container.innerHTML = q ? '' : `
      <div style="text-align:center;padding:32px 20px;">
        <div style="width:52px;height:52px;border-radius:16px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.15);display:flex;align-items:center;justify-content:center;margin:0 auto 12px;">
          <span class="material-icons-round" style="font-size:24px;color:var(--accent-primary);opacity:0.5;">travel_explore</span>
        </div>
        <div style="font-size:13px;font-weight:700;color:var(--text-secondary);margin-bottom:6px;">Search ChainList</div>
        <div style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);line-height:1.7;">Type a chain name or Chain ID<br>to discover any EVM network</div>
      </div>`;
    return;
  }

  const existingIds = new Set(getAllChains().map(c => c.chainId).filter(Boolean));
  container.innerHTML = '';

  chains.forEach(c => {
    const alreadyAdded = existingIds.has(c.chainId);
    const sym = c.nativeCurrency?.symbol || 'ETH';
    const allRpcs = (c.rpc || []).filter(r => r.startsWith('https://') && !r.includes('${') && !r.includes('API_KEY') && !r.includes('api-key'));
    const hasRpc = allRpcs.length > 0;
    const icon = c.icon ? `https://icons.llamao.fi/icons/chains/rsz_${c.icon}.jpg` : '';

    const item = document.createElement('div');
    item.style.cssText = 'display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:14px;background:var(--bg-glass);border:1px solid var(--border-subtle);margin-bottom:7px;transition:all 0.2s;';
    item.innerHTML = `
      <div style="width:40px;height:40px;border-radius:12px;background:var(--bg-raised);border:1px solid var(--border-subtle);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;">
        ${icon ? `<img src="${icon}" width="28" height="28" style="border-radius:7px;object-fit:cover;" onerror="this.parentElement.innerHTML='<span style=\\'font-size:18px;\\'>🔗</span>'" />` : '<span style="font-size:18px;">🔗</span>'}
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:12px;font-weight:700;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.name}</div>
        <div style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);margin-top:2px;">Chain ID: ${c.chainId} · ${sym}</div>
        ${!hasRpc ? `<div style="font-size:9px;color:var(--accent-amber);font-family:var(--font-mono);margin-top:2px;">⚠ No public RPC</div>` : `<div style="font-size:9px;color:${allRpcs.length>=5?'var(--neon-cyan)':'var(--accent-green)'};font-family:var(--font-mono);margin-top:2px;">✓ ${allRpcs.length} RPC endpoint${allRpcs.length > 1 ? 's' : ''}</div>`}
      </div>
      ${alreadyAdded
        ? `<div style="display:flex;align-items:center;gap:5px;flex-shrink:0;">
             ${hasRpc ? `<button onclick="hcpAddRpcFromChainList(event,${c.chainId})" title="Add RPCs from chainlist to this chain" style="padding:6px 9px;border-radius:8px;border:1px solid rgba(6,182,212,0.4);background:rgba(6,182,212,0.1);color:var(--neon-cyan);font-family:var(--font-mono);font-size:10px;font-weight:700;cursor:pointer;transition:all 0.2s;white-space:nowrap;" onmousedown="this.style.transform='scale(0.92)'" onmouseup="this.style.transform=''" ontouchstart="this.style.transform='scale(0.92)'" ontouchend="this.style.transform=''">+ RPC</button>` : ''}
             <div style="padding:6px 10px;border-radius:8px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.25);font-size:10px;font-weight:700;color:var(--accent-green);font-family:var(--font-mono);">ADDED</div>
           </div>`
        : `<button onclick="hcpAddFromChainList(event, ${c.chainId})" style="padding:7px 12px;border-radius:9px;border:1px solid rgba(99,102,241,0.45);background:rgba(99,102,241,0.12);color:var(--neon-purple);font-family:var(--font-mono);font-size:10px;font-weight:700;cursor:pointer;flex-shrink:0;transition:all 0.2s;" onmousedown="this.style.transform='scale(0.92)'" onmouseup="this.style.transform=''" ontouchstart="this.style.transform='scale(0.92)'" ontouchend="this.style.transform=''">+ ADD</button>`
      }
    `;
    container.appendChild(item);
  });
}

// ── ADD RPCs FROM CHAINLIST TO ALREADY-ADDED CHAIN ──
function hcpAddRpcFromChainList(e, targetChainId) {
  e.stopPropagation();

  const clChain = (_clAllChains || []).find(c => c.chainId === targetChainId);
  if (!clChain) { showToast('Chain data not found', 'error'); return; }

  // Get all public RPCs from chainlist (filter out key-gated ones)
  const newRpcs = (clChain.rpc || []).filter(r =>
    r.startsWith('https://') && !r.includes('${') && !r.includes('API_KEY') && !r.includes('api-key')
  );
  if (!newRpcs.length) { showToast('No public RPCs available', 'wifi_off'); return; }

  // Check if it's a built-in chain or custom chain
  const customs = loadCustomChains();
  const customChain = customs.find(c => c.chainId === targetChainId);

  // ── Helper: write RPCs into one_custom_rpcs_v1 so RPC Manager shows them ──
  function _mergeIntoRpcManager(chainId, rpcsToAdd) {
    try {
      const storeKey = 'one_custom_rpcs_v1';
      let store = {};
      try { store = JSON.parse(localStorage.getItem(storeKey)) || {}; } catch(_) {}
      if (!store[chainId]) store[chainId] = { rpcs: [], defaultRpc: null };
      const existingSet = new Set(store[chainId].rpcs || []);
      rpcsToAdd.forEach(r => existingSet.add(r));
      store[chainId].rpcs = [...existingSet];
      if (!store[chainId].defaultRpc && store[chainId].rpcs.length > 0) {
        store[chainId].defaultRpc = store[chainId].rpcs[0];
      }
      try { localStorage.setItem(storeKey, JSON.stringify(store)); } catch(_) {}
      // Re-render RPC Manager UI if it's open on this chain
      if (typeof _rpcDrawerChainId !== 'undefined' && _rpcDrawerChainId === chainId) {
        if (typeof _rpcRenderList === 'function') try { _rpcRenderList(chainId); } catch(_) {}
      }
      if (typeof _rpcRenderChainList === 'function') try { _rpcRenderChainList(); } catch(_) {}
    } catch(_) {}
  }

  if (customChain) {
    // Custom chain — update rpcs array, dedup
    const existing = new Set(customChain.rpcs || (customChain.rpc ? [customChain.rpc] : []));
    const added = [];
    newRpcs.forEach(r => { if (!existing.has(r)) { existing.add(r); added.push(r); } });
    customChain.rpcs = [...existing];
    if (!customChain.rpc) customChain.rpc = customChain.rpcs[0];
    saveCustomChains(customs);
    // Also sync into RPC Manager so they appear in the Custom RPC panel
    _mergeIntoRpcManager(targetChainId, newRpcs);
    haptic();
    if (added.length) {
      showToast(`+${added.length} RPC added to ${clChain.name}`, 'cable');
    } else {
      showToast('All RPCs already present', 'check_circle');
    }
  } else {
    // Built-in chain — save extra RPCs in BR_CHAIN_RPC (runtime only) + localStorage override
    const builtInKey = 'one_extra_rpcs_' + targetChainId;
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem(builtInKey) || '[]'); } catch {}
    const existing = new Set(saved);
    const added = [];
    // Also exclude RPCs already in BR_CHAIN_RPC
    const alreadyInMap = new Set((window.BR_CHAIN_RPC && window.BR_CHAIN_RPC[targetChainId]) || []);
    newRpcs.forEach(r => {
      if (!existing.has(r) && !alreadyInMap.has(r)) { existing.add(r); added.push(r); }
    });
    saved = [...existing];
    try { localStorage.setItem(builtInKey, JSON.stringify(saved)); } catch {}
    // Merge into runtime BR_CHAIN_RPC
    if (window.BR_CHAIN_RPC) {
      const cur = window.BR_CHAIN_RPC[targetChainId] || [];
      window.BR_CHAIN_RPC[targetChainId] = [...new Set([...cur, ...saved])];
    }
    // Also sync into RPC Manager so they appear in the Custom RPC panel
    _mergeIntoRpcManager(targetChainId, added.length ? added : saved);
    haptic();
    if (added.length) {
      showToast(`+${added.length} RPC added to ${clChain.name}`, 'cable');
    } else {
      showToast('All RPCs already present', 'check_circle');
    }
  }
}

function hcpAddFromChainList(e, targetChainId) {
  e.stopPropagation();

  // Wallet check
  const _cafGroups = (typeof loadWalletGroups === 'function') ? loadWalletGroups() : [];
  const _cafHwKey  = (typeof hwSelectedKey !== 'undefined' && hwSelectedKey);
  const _cafHasSel = !!_cafHwKey
    || (typeof selectedGroupIds !== 'undefined' && selectedGroupIds.length > 0)
    || (typeof activeGroupId !== 'undefined' && !!activeGroupId);
  if (!_cafGroups.length) {
    showToast('Please add a wallet first!', 'account_balance_wallet'); haptic(); return;
  }
  if (!_cafHasSel) {
    showToast('Please select a wallet first!', 'account_balance_wallet'); haptic(); return;
  }

  const chain = (_clAllChains || []).find(c => c.chainId === targetChainId);
  if (!chain) return;

  const existing = getAllChains();
  if (existing.find(c => c.chainId === targetChainId)) {
    showToast('Already added!', 'check_circle'); return;
  }

  const sym  = chain.nativeCurrency?.symbol || 'ETH';
  const name = chain.nativeCurrency?.name || sym;
  // ── Save ALL public RPCs (no API key placeholders) ──
  const allRpcs = (chain.rpc || []).filter(r => r.startsWith('https://') && !r.includes('${') && !r.includes('API_KEY') && !r.includes('api-key'));
  const rpc  = allRpcs[0] || '';
  const explorer = (chain.explorers || [])[0]?.url || '';
  const icon = chain.icon ? `https://icons.llamao.fi/icons/chains/rsz_${chain.icon}.jpg` : '';

  // Auto-map known native token symbols to CoinGecko IDs for price fetching
  const KNOWN_CGID = {
    'ETH':'ethereum','WETH':'weth','BNB':'binancecoin','MATIC':'matic-network',
    'AVAX':'avalanche-2','FTM':'fantom','OP':'optimism','ARB':'arbitrum',
    'SOL':'solana','CRO':'crypto-com-chain','CELO':'celo','GLMR':'moonbeam',
    'MOVR':'moonriver','KLAY':'klay-token','ROSE':'oasis-network','ONE':'harmony',
    'METIS':'metis-token','BOBA':'boba-network','XDAI':'xdai','GNO':'gnosis',
    'ASTR':'astar','SDN':'shiden-network','SGB':'songbird','FLR':'flare-networks',
    'EVMOS':'evmos','TLOS':'telos','CLO':'callisto','KCS':'kucoin-shares',
    'OKT':'oec-token','HT':'huobi-token','MNT':'mantle','MANTA':'manta-network',
    'LINEA':'linea','ZK':'zksync','STRK':'starknet','SCROLL':'scroll',
    'BASE':'ethereum','WAN':'wanchain','FUSE':'fuse-network-token',
    // Additional chains
    'POL':'matic-network','ZKEVM':'matic-network','zkEVM':'matic-network',
    'BLAST':'blast','MERLIN':'merlin-chain','BOB':'bob',
    'MODE':'mode','TAIKO':'taiko','FRAX':'frax-ether',
    'CORE':'coredaoorg','DOGE':'dogecoin','LTC':'litecoin',
    'ZETA':'zetachain','IMX':'immutable-x','KROMA':'kroma',
    'OPBNB':'binancecoin','BEAM':'beam-2','LISK':'lisk',
    'CYBER':'cyberconnect','MINT':'mint','REDSTONE':'redstone',
    'ZERO':'zero-network','INK':'ink','SONEIUM':'soneium',
    'UNICHAIN':'unichain','WORLD':'worldcoin-wld','APECHAIN':'apecoin',
    'GRAVITY':'gravity-alpha','HAM':'ham','XMTP':'ethereum',
    'DEGEN':'degen-base','FORMA':'forma','ARENA':'arena-z',
    'ANCIENT8':'ancient8','SHAPE':'shape-network','SUPERSEED':'superseed',
    'STACK':'stack','FLOW':'flow','SEI':'sei-network','SUI':'sui',
    'APT':'aptos','NEAR':'near','ALGO':'algorand','ATOM':'cosmos',
    'DOT':'polkadot','KSM':'kusama','ADA':'cardano',
    'KAVA':'kava','AURORA':'aurora-near','NEON':'neon-evm',
    'CANTO':'canto','TOMO':'tomochain','VET':'vechain',
    'HBAR':'hedera-hashgraph','XDC':'xdce-crowd-sale',
    'CLV':'clover-finance','OONE':'harmony','IOTX':'iotex',
    'PALM':'palm','SYSCOIN':'syscoin','MILKOMEDA':'milkomeda-cardano',
    'CUBE':'cube-network','BRISE':'bitrise-token','XPLA':'xpla',
    'SHIB':'shiba-inu','PEPE':'pepe','FLOKI':'floki',
    'CBETH':'coinbase-wrapped-staked-eth','RETH':'rocket-pool-eth',
    'WSTETH':'wrapped-steth','STETH':'staked-ether',
  };
  const cgId = KNOWN_CGID[sym.toUpperCase()] || '';

  const newChain = {
    id: 'custom-' + targetChainId,
    chainId: targetChainId,
    emoji: '🔗',
    name: chain.name,
    nativeSym: sym,
    rpc,
    rpcs: allRpcs,
    explorer,
    builtIn: false,
    color: '#6366f1',
    logoURI: icon || null,
  };
  const customs = loadCustomChains();
  customs.push(newChain);
  saveCustomChains(customs);

  // ── Sync to bridge chain picker immediately (no duplicate) ──
  if (typeof window.brSyncChainToPicker === 'function') window.brSyncChainToPicker(newChain);

  // Add native token with proper cgId so price + chart work
  const tokenId = 'custom-native-' + targetChainId;
  const saved = loadSavedTokens();
  if (!saved.find(t => t.id === tokenId)) {
    saved.push({
      id: tokenId, chainId: targetChainId,
      name, sub: sym,
      icon: sym.slice(0,2), color: '#6366f1', badge: '#6366f1',
      contract: '', decimals: 18,
      cgId: cgId, cbPair: sym + '-USD',
      isDefault: false,
      isNative: true,
      logoUrl: icon || null,
    });
    saveTokenList(saved);
    if (typeof syncTokenConfig === 'function') syncTokenConfig();
  }

  haptic();
  showToast(chain.name + ' added! (' + allRpcs.length + ' RPC)', 'add_link');
  if (typeof renderProfileChainBadges === 'function') renderProfileChainBadges();
    if (typeof renderProfChainSelector === 'function') renderProfChainSelector();

  // Re-render to show ADDED state
  const q = document.getElementById('hcp-cl-search')?.value.trim();
  if (q) hcpClSearch();

  // After short delay, switch to this chain
  setTimeout(() => {
    setActiveChain(targetChainId);
    closeHomeChainPicker();
    // Clear price cache so native token price is fetched fresh for new chain
    _globalPriceCache = null; _globalPriceCacheTime = 0;
    loadTokens();
    _hcpActiveTab = 'my';
  }, 900);
}

// ── DELETE CUSTOM CHAIN ──
function hcpDeleteCustomChain(e, chainId) {
  e.stopPropagation();

  // Find the chain being deleted BEFORE removing it
  const allCustoms = loadCustomChains();
  const deletedChain = allCustoms.find(c => c.id === chainId);
  const deletedChainId = deletedChain ? deletedChain.chainId : null;

  // Remove the chain from custom chains list
  const customs = allCustoms.filter(c => c.id !== chainId);
  saveCustomChains(customs);

  // ── Remove all tokens belonging to this chain from MY TOKENS ──
  if (deletedChainId !== null && deletedChainId !== undefined) {
    try {
      const savedTokens = loadSavedTokens();
      const remaining = savedTokens.filter(t => (t.chainId || 8453) !== deletedChainId);
      if (remaining.length !== savedTokens.length) {
        saveTokenList(remaining);
        if (typeof syncTokenConfig === 'function') syncTokenConfig();
      }
    } catch(err) {}
  }

  // If active chain was deleted, reset to All Networks
  if (deletedChain && deletedChainId === activeHomeChainId) {
    setActiveChain(null);
  }

  // Clear price cache so removed tokens don't linger
  _globalPriceCache = null; _globalPriceCacheTime = 0;

  renderHcpList();
  if (typeof renderTmActiveList === 'function') renderTmActiveList();
  loadTokens();
  showToast('Chain removed', 'delete');
  if (typeof renderProfileChainBadges === 'function') renderProfileChainBadges();
  if (typeof renderProfChainSelector === 'function') renderProfChainSelector();
  haptic();
}