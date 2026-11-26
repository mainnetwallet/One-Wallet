
// ── CONTRACT ADDRESS TOKEN IMPORT ──
const ERC20_META_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
];

// Proxy contract ABI — for reading implementation address
const PROXY_ABI = [
  'function implementation() view returns (address)',
  'function _implementation() view returns (address)',
];

// EIP-1967 implementation slot
const EIP1967_IMPL_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';

// ── Resolve proxy contract to real implementation address ──
async function _resolveProxyImpl(addr, provider) {
  // 1. Try EIP-1967 storage slot (most common: OpenZeppelin, etc.)
  try {
    const slotVal = await provider.getStorage(addr, EIP1967_IMPL_SLOT);
    if (slotVal && slotVal !== '0x' + '0'.repeat(64)) {
      const impl = '0x' + slotVal.slice(-40);
      if (impl !== '0x' + '0'.repeat(40)) return impl;
    }
  } catch {}
  // 2. Try function call implementation()
  try {
    const c = new ethers.Contract(addr, PROXY_ABI, provider);
    const impl = await c.implementation();
    if (impl && impl !== ethers.ZeroAddress) return impl;
  } catch {}
  try {
    const c = new ethers.Contract(addr, PROXY_ABI, provider);
    const impl = await c._implementation();
    if (impl && impl !== ethers.ZeroAddress) return impl;
  } catch {}
  return null;
}

// ── Read ERC-20 metadata, with proxy fallback ──
async function _readTokenMeta(addr, rpcList) {
  for (const rpc of rpcList) {
    try {
      const provider = _makeProvider(rpc);
      // Try direct read first
      try {
        const contract = new ethers.Contract(addr, ERC20_META_ABI, provider);
        const [name, symbol, decimals] = await Promise.all([
          contract.name(), contract.symbol(), contract.decimals(),
        ]);
        if (symbol) return { name, symbol, decimals: Number(decimals), resolvedAddr: addr };
      } catch {}
      // Proxy fallback — resolve implementation and read from there
      const impl = await _resolveProxyImpl(addr, provider);
      if (impl) {
        try {
          const implContract = new ethers.Contract(impl, ERC20_META_ABI, provider);
          const [name, symbol, decimals] = await Promise.all([
            implContract.name(), implContract.symbol(), implContract.decimals(),
          ]);
          if (symbol) return { name, symbol, decimals: Number(decimals), resolvedAddr: impl, isProxy: true };
        } catch {}
      }
    } catch {}
  }
  return null;
}

// ── CoinGecko lookup by contract address on selected chain ──
async function _cgLookupByContract(addr, chainId) {
  // Map chainId → CoinGecko platform id
  const chainToPlatform = {};
  Object.entries(_CG_PLATFORM_TO_CHAINID || {}).forEach(([pid, cid]) => { chainToPlatform[cid] = pid; });

  const platformId = chainToPlatform[chainId];
  if (!platformId) return null;

  const cgPath = `coins/${platformId}/contract/${addr.toLowerCase()}`;
  const tryUrl = async (url) => {
    const r = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (!r.ok) throw new Error('bad');
    return await r.json();
  };

  let data = null;
  try { data = await _cgFetch(cgPath); } catch {}

  if (!data || !data.id) return null;
  return {
    id: data.id,
    name: data.name || '',
    symbol: (data.symbol || '').toUpperCase(),
    thumb: data.image?.thumb || data.image?.small || null,
  };
}

function onTmContractInput() {
  const val = document.getElementById('tm-contract-input')?.value.trim();
  const btn = document.getElementById('tm-contract-btn');
  const status = document.getElementById('tm-contract-status');
  const isValid = /^0x[0-9a-fA-F]{40}$/.test(val);
  if (isValid) {
    if (btn) { btn.style.opacity = '1'; btn.style.pointerEvents = 'auto'; }
    if (status) { status.textContent = '✓ Valid address'; status.style.color = 'var(--accent-green)'; }
  } else {
    if (btn) { btn.style.opacity = '0.5'; btn.style.pointerEvents = 'none'; }
    if (status) { status.textContent = val.length > 2 ? '⚠️ Invalid address format' : ''; status.style.color = 'var(--accent-amber)'; }
  }
}

async function addTokenByContract() {
  const addr = document.getElementById('tm-contract-input')?.value.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) return;

  const btn = document.getElementById('tm-contract-btn');
  const status = document.getElementById('tm-contract-status');

  // Check if already added (chain-aware)
  const existing = loadSavedTokens().find(t =>
    t.contract?.toLowerCase() === addr.toLowerCase() &&
    (t.chainId || 8453) === (_tmSelectedChainId || 8453)
  );
  if (existing) {
    if (status) { status.textContent = '⚠️ Already added: ' + existing.sub; status.style.color = 'var(--accent-amber)'; }
    return;
  }

  if (btn) btn.innerHTML = '<span class="del-spinner" style="width:14px;height:14px;border-width:2px;"></span>';
  btn.style.pointerEvents = 'none';
  if (status) { status.textContent = '🔍 Checking CoinGecko…'; status.style.color = 'var(--text-muted)'; }

  try {
    const chainId = _tmSelectedChainId || 8453;

    // ── Step 1: Try CoinGecko lookup by contract address ──
    const cgCoin = await _cgLookupByContract(addr, chainId);
    if (cgCoin) {
      if (status) { status.textContent = '✅ Found on CoinGecko: ' + cgCoin.name; status.style.color = 'var(--accent-green)'; }
      if (btn) { btn.innerHTML = '<span class="material-icons-round" style="font-size:16px;">add</span>ADD'; btn.style.pointerEvents = 'auto'; }
      // Open chain picker modal (fetches all chain contracts)
      addTokenFromSearch(JSON.stringify(cgCoin));
      (document.getElementById('tm-contract-input') || {}).value = '';
      if (status) setTimeout(() => { status.textContent = ''; }, 3000);
      return;
    }

    // ── Step 2: Fallback — read metadata via RPC (with proxy support) ──
    if (status) { status.textContent = '🔗 Reading from blockchain…'; status.style.color = 'var(--text-muted)'; }

    const rpcList = _getRpcListForChain(chainId);
    const meta = await _readTokenMeta(addr, rpcList);

    if (!meta || !meta.symbol) {
      if (status) { status.textContent = '❌ Could not read token info from contract'; status.style.color = 'var(--accent-red)'; }
      if (btn) { btn.innerHTML = '<span class="material-icons-round" style="font-size:16px;">add</span>ADD'; btn.style.pointerEvents = 'auto'; }
      return;
    }

    const colors = ['#6366f1','#8b5cf6','#22d3ee','#10b981','#f59e0b','#f472b6','#f43f5e','#a78bfa','#0052ff','#f7931a'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const id = 'custom-' + addr.slice(2,10).toLowerCase();
    const proxyNote = meta.isProxy ? ' (proxy)' : '';

    const tokenData = {
      id, chainId,
      name: meta.name || meta.symbol,
      sub: meta.symbol.toUpperCase(),
      icon: meta.symbol.slice(0,2).toUpperCase(),
      color, badge: color,
      contract: addr,
      decimals: meta.decimals,
      cgId: null,
      cbPair: meta.symbol.toUpperCase() + '-USD',
      isDefault: false,
      isCustomContract: true,
    };

    addToken(tokenData);
    (document.getElementById('tm-contract-input') || {}).value = '';
    if (status) { status.textContent = '✅ ' + meta.symbol.toUpperCase() + ' added' + proxyNote + '!'; status.style.color = 'var(--accent-green)'; }
    btn.style.opacity = '0.5'; btn.style.pointerEvents = 'none';
  } catch(e) {
    if (status) { status.textContent = '❌ Error: ' + e.message.slice(0,60); status.style.color = 'var(--accent-red)'; }
  }

  if (btn) btn.innerHTML = '<span class="material-icons-round" style="font-size:16px;">add</span>ADD';
}