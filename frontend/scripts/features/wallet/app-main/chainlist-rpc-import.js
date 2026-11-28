

function hcpClClearSearch() {
  const input = document.getElementById('hcp-cl-search');
  if (input) input.value = '';
  document.getElementById('hcp-cl-clear').style.display = 'none';
  const totalR = (_clAllChains||[]).reduce((s,c)=>s+(c.rpc||[]).length,0);
  document.getElementById('hcp-cl-status-text').textContent = _clAllChains ? _clAllChains.length + ' chains · ' + totalR.toLocaleString() + ' RPCs' : '';
  hcpClRenderResults([]);
}

// Chains suggested on the Chainlist tab before the user types anything
const HCP_POPULAR_CHAIN_IDS = [1, 8453, 56, 42161, 10, 137, 43114, 59144, 534352, 324, 81457, 5000, 146, 130, 42220, 100];

function hcpClRenderResults(chains) {
  const container = document.getElementById('hcp-cl-results');
  if (!container) return;
  const q = document.getElementById('hcp-cl-search')?.value.trim();
  let heading = '';

  if (!chains.length) {
    if (q) { container.innerHTML = ''; return; }
    // Nothing typed yet: suggest popular chains that are not added yet
    const have = new Set(getAllChains().map(c => c.chainId).filter(Boolean));
    const byId = {};
    (_clAllChains || []).forEach(c => { byId[c.chainId] = c; });
    const popular = (_clShowTestnets ? [] : HCP_POPULAR_CHAIN_IDS).filter(id => byId[id] && !have.has(id)).map(id => byId[id]);
    if (!popular.length) {
      container.innerHTML = `
        <div style="text-align:center;padding:32px 20px;">
          <div style="width:52px;height:52px;border-radius:16px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.15);display:flex;align-items:center;justify-content:center;margin:0 auto 12px;">
            <span class="material-icons-round" style="font-size:24px;color:var(--accent-primary);opacity:0.5;">travel_explore</span>
          </div>
          <div style="font-size:14px;font-weight:700;color:var(--text-secondary);margin-bottom:6px;">${_clShowTestnets ? 'Search testnets' : 'Search chainlist'}</div>
          <div style="font-size:12px;color:var(--text-muted);line-height:1.7;">Type a name or chain ID<br>to find any EVM network. Not listed? Add a custom network below.</div>
        </div>`;
      return;
    }
    chains = popular;
    heading = '<div class="hcp-sec">Popular chains</div>';
  }

  const existingIds = new Set(getAllChains().map(c => c.chainId).filter(Boolean));
  container.innerHTML = heading;

  chains.forEach(c => {
    const alreadyAdded = existingIds.has(c.chainId);
    const sym = c.nativeCurrency?.symbol || 'ETH';
    const allRpcs = (c.rpc || []).filter(r => r.startsWith('https://') && !r.includes('${') && !r.includes('API_KEY') && !r.includes('api-key'));
    const hasRpc = allRpcs.length > 0;
    const icon = c.icon ? `https://icons.llamao.fi/icons/chains/rsz_${c.icon}.jpg` : '';

    const item = document.createElement('div');
    item.className = 'hcp-cl-row';
    item.innerHTML = `
      <div class="hcp-chain-emoji" style="overflow:hidden;">
        <span style="font-size:18px;">🔗</span>
        ${icon ? `<img src="${icon}" width="28" height="28" alt="" style="position:absolute;inset:6px;border-radius:50%;object-fit:cover;background:var(--bg-raised);" onerror="this.remove()" />` : ''}
      </div>
      <div style="flex:1;min-width:0;">
        <div class="hcp-chain-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.name}</div>
        <div class="hcp-chain-sub">ID ${c.chainId} · ${sym}</div>
        ${!hasRpc ? `<div class="hcp-rpc-note warn">No public RPC</div>` : `<div class="hcp-rpc-note">${allRpcs.length} RPC endpoint${allRpcs.length > 1 ? 's' : ''}</div>`}
      </div>
      ${alreadyAdded
        ? `<div class="hcp-act">
             ${hasRpc ? `<button class="hcp-btn-rpc" onclick="hcpAddRpcFromChainList(event,${c.chainId})" title="Add RPCs from chainlist to this chain">+ RPC</button>` : ''}
             <span class="hcp-added"><span class="material-icons-round">check</span>Added</span>
           </div>`
        : `<button class="hcp-btn-add" onclick="hcpAddFromChainList(event, ${c.chainId})">Add</button>`
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