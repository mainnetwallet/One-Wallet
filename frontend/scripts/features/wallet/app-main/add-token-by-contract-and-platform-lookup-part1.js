

// Keyless rpc.ankr.com/<chain> endpoints now require an API key (return -32000 Unauthorized).
// They can still come from saved custom chains / chainlist imports, so push them to the END
// of every list instead of letting them be tried first.
function _rpcIsKeylessAnkr(u) {
  return /^https?:\/\/rpc\.ankr\.com\/[A-Za-z0-9_]+\/?$/i.test(String(u || '').trim());
}
function _rpcDeprioritize(list) {
  const good = [], bad = [];
  (list || []).forEach(r => (_rpcIsKeylessAnkr(r) ? bad : good).push(r));
  return good.concat(bad);
}
// Shared "known bad for a while" map (auth failures etc.) — url -> epoch ms until which to try it last
const _rpcBadUntil = {};
function _rpcIsAuthError(e) {
  const t = String((e && e.message) || '') + ' ' + String((e && e.info && e.info.error && e.info.error.message) || '') + ' ' + String((e && (e.status || e.code)) || '');
  return /unauthorized|api key|api-key|must authenticate|forbidden|\b401\b|\b403\b/i.test(t);
}
function _rpcSortByHealth(list) {
  const now = Date.now();
  const ok = [], bad = [];
  (list || []).forEach(r => ((_rpcBadUntil[r] && _rpcBadUntil[r] > now) ? bad : ok).push(r));
  return ok.concat(bad);
}

// Helper: get RPC list for a given chainId
function _getRpcListForChain(chainId) {
  const rpcs = [];

  // 0. one_custom_rpcs_v1 — user-added RPCs via RPC Manager or + RPC button
  //    Read directly here so ALL sections (home/swap/bridge/send) benefit without
  //    depending on the getChainRpcs patch timing.
  try {
    const _cStore = JSON.parse(localStorage.getItem('one_custom_rpcs_v1') || '{}');
    const _cEntry = _cStore[chainId];
    if (_cEntry) {
      // Put defaultRpc first, then rest of custom rpcs
      const _cDefault = _cEntry.defaultRpc;
      const _cRpcs = Array.isArray(_cEntry.rpcs) ? _cEntry.rpcs : [];
      if (_cDefault && !rpcs.includes(_cDefault)) rpcs.push(_cDefault);
      _cRpcs.forEach(r => { if (r && !rpcs.includes(r)) rpcs.push(r); });
    }
  } catch(_) {}

  // 1. getChainRpcs — BUILTIN_CHAINS rpcs[] or custom chain rpcs[] (patched version if available)
  const _gcr = (window.getChainRpcs && window.getChainRpcs.__rpcPatched)
    ? window.getChainRpcs
    : getChainRpcs;
  const fromChain = _gcr(chainId);
  fromChain.forEach(r => { if (r && !rpcs.includes(r)) rpcs.push(r); });

  // 2. Fallback hardcoded map (covers chains not in BUILTIN_CHAINS like FTM, Gnosis, etc.)
  const RPC_MAP = {
    1:    ['https://ethereum-rpc.publicnode.com','https://cloudflare-eth.com'],
    56:   ['https://bsc-dataseed.binance.org','https://bsc-dataseed1.defibit.io','https://bsc-rpc.publicnode.com'],
    137:  ['https://polygon-bor-rpc.publicnode.com','https://polygon.drpc.org','https://polygon-rpc.com','https://1rpc.io/matic'],
    42161:['https://arb1.arbitrum.io/rpc','https://arbitrum-one-rpc.publicnode.com'],
    10:   ['https://mainnet.optimism.io','https://optimism-rpc.publicnode.com'],
    8453: ['https://mainnet.base.org','https://base.drpc.org'],
    43114:['https://api.avax.network/ext/bc/C/rpc','https://avalanche-c-chain-rpc.publicnode.com'],
    250:  ['https://fantom-rpc.publicnode.com','https://fantom.drpc.org'],
    42220:['https://forno.celo.org','https://celo.drpc.org'],
    100:  ['https://rpc.gnosischain.com','https://gnosis-rpc.publicnode.com'],
    59144:['https://rpc.linea.build'],
    534352:['https://rpc.scroll.io','https://scroll.drpc.org'],
    5000: ['https://rpc.mantle.xyz'],
    1101: ['https://zkevm-rpc.com'],
    81457:['https://rpc.blast.io'],
    324:  ['https://mainnet.era.zksync.io','https://zksync.drpc.org'],
    34443:['https://mainnet.mode.network'],
  };
  (RPC_MAP[chainId] || []).forEach(r => { if (r && !rpcs.includes(r)) rpcs.push(r); });

  // 3. BR_CHAIN_RPC global table — covers ALL bridge-supported chains
  const _brRpc = (typeof window !== 'undefined' && window.BR_CHAIN_RPC && window.BR_CHAIN_RPC[chainId]);
  if (_brRpc) {
    const _brList = Array.isArray(_brRpc) ? _brRpc : [_brRpc];
    _brList.filter(Boolean).forEach(r => { if (!rpcs.includes(r)) rpcs.push(r); });
  }

  // Step 4 removed — 'customChains' localStorage key is no longer written;
  // user-added chains live under one_custom_chains_<groupId> and are
  // already covered by Step 1 (getChainRpcs → getAllChains → loadCustomChains).

  return _rpcSortByHealth(_rpcDeprioritize(rpcs.filter(r => r && r.startsWith('http'))));
}

// ── Contract add triggered from unified search box ──
async function addTokenByContractFromSearch(addr) {
  const status = document.getElementById('tm-contract-status');

  // Double-check not already added
  const existing = loadSavedTokens().find(t => t.contract?.toLowerCase() === addr.toLowerCase());
  if (existing) {
    if (status) { status.textContent = '⚠️ Already added: ' + existing.sub; status.style.color = 'var(--accent-amber)'; }
    return;
  }

  if (status) { status.innerHTML = '<span class="del-spinner" style="width:10px;height:10px;border-width:2px;margin-right:6px;display:inline-block;vertical-align:middle;"></span>Checking CoinGecko…'; status.style.color = 'var(--text-muted)'; }

  try {
    const chainId = _tmSelectedChainId || 8453;

    // ── Step 1: CoinGecko lookup by contract address ──
    const cgCoin = await _cgLookupByContract(addr, chainId);
    if (cgCoin) {
      if (status) { status.textContent = '✅ Found: ' + cgCoin.name + ' — select chain below'; status.style.color = 'var(--accent-green)'; }
      // Clear search box
      (document.getElementById('tm-search') || {}).value = '';
      const _cs2 = document.getElementById('tm-clear-search');
      const _sr2 = document.getElementById('tm-search-results');
      if (_cs2) _cs2.style.display = 'none';
      if (_sr2) _sr2.style.display = 'none';
      const icon2 = document.getElementById('tm-search-icon');
      if (icon2) icon2.textContent = 'search';
      setTimeout(() => { if (status) status.textContent = ''; }, 4000);
      // Open chain picker
      addTokenFromSearch(JSON.stringify(cgCoin));
      return;
    }

    // ── Step 2: RPC fallback with proxy support ──
    if (status) { status.innerHTML = '<span class="del-spinner" style="width:10px;height:10px;border-width:2px;margin-right:6px;display:inline-block;vertical-align:middle;"></span>Reading from blockchain…'; status.style.color = 'var(--text-muted)'; }

    const rpcList = _getRpcListForChain(chainId);
    const meta = await _readTokenMeta(addr, rpcList);

    if (!meta || !meta.symbol) {
      if (status) { status.textContent = '❌ Could not read token info from contract'; status.style.color = 'var(--accent-red)'; }
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
    (document.getElementById('tm-search') || {}).value = '';
    const _cs2 = document.getElementById('tm-clear-search');
    const _sr2 = document.getElementById('tm-search-results');
    if (_cs2) _cs2.style.display = 'none';
    if (_sr2) _sr2.style.display = 'none';
    const icon2 = document.getElementById('tm-search-icon');
    if (icon2) icon2.textContent = 'search';
    if (status) { status.textContent = '✅ ' + meta.symbol.toUpperCase() + ' added' + proxyNote + '!'; status.style.color = 'var(--accent-green)'; }
    setTimeout(() => { if (status) status.textContent = ''; }, 3000);
  } catch(e) {
    if (status) { status.textContent = '❌ Error: ' + e.message.slice(0,60); status.style.color = 'var(--accent-red)'; }
  }
}


function addToken(tokenData) {
  // Guard: must have a wallet selected to add tokens
  const _atGroups = (typeof loadWalletGroups === 'function') ? loadWalletGroups() : [];
  const _atSelected = (typeof selectedGroupIds !== 'undefined' && selectedGroupIds.length > 0)
    || (typeof activeGroupId !== 'undefined' && activeGroupId);
  if (!_atGroups || _atGroups.length === 0 || !_atSelected) {
    showToast('Please select a wallet first!', 'account_balance_wallet');
    haptic();
    return;
  }
  const tokens = loadSavedTokens();
  // Chain-aware duplicate check: same token on a DIFFERENT chain is NOT a duplicate
  // Match by id+chain OR by cgId+chain (catches DEFAULT_TOKENS vs search-added id mismatch)
  const isDuplicate = tokens.find(t => {
    const sameChain = (t.chainId || 8453) === (tokenData.chainId || 8453);
    if (!sameChain) return false;
    if (t.id === tokenData.id) return true;
    if (t.cgId && tokenData.cgId && t.cgId === tokenData.cgId) return true;
    if (t.contract && tokenData.contract &&
        t.contract.toLowerCase() === tokenData.contract.toLowerCase()) return true;
    return false;
  });
  if (isDuplicate) {
    showToast('Already added!', 'check_circle');
    return;
  }
  tokens.push(tokenData);
  saveTokenList(tokens);
  syncTokenConfig();
  renderTmActiveList();
  (document.getElementById('tm-count-badge') || {}).textContent = tokens.length + ' TOKENS';
  showToast(tokenData.name + ' added!', 'add_circle');
  haptic();
  // Clear price cache so new token's price is fetched immediately
  _globalPriceCache = null; _globalPriceCacheTime = 0;
  if (currentPage === 'home') loadTokens();
  // Do NOT replace the add icon with "ADDED" badge in search results.
  // The same token can be added again on a different chain with a different contract.
  // The chain-picker modal already shows "ADDED" per-chain row — that is sufficient.
}

function onTmSearch() {
  const q = document.getElementById('tm-search')?.value.trim();
  const clearBtn = document.getElementById('tm-clear-search');
  const status = document.getElementById('tm-contract-status');
  const searchIcon = document.getElementById('tm-search-icon');
  if (clearBtn) clearBtn.style.display = q.length > 0 ? 'block' : 'none';

  // ── Contract address mode ──
  if (/^0x[0-9a-fA-F]{1,40}$/.test(q)) {
    const isValid = /^0x[0-9a-fA-F]{40}$/.test(q);
    const _sr = document.getElementById('tm-search-results');
    if (_sr) _sr.style.display = 'none';
    // Hide preview if input changed
    const _prev = document.getElementById('tm-contract-preview');
    if (_prev) _prev.style.display = 'none';
    if (searchIcon) searchIcon.textContent = 'receipt_long';

    if (isValid) {
      // ── Chain must be selected first ──
      if (!_tmSelectedChainId) {
        if (status) { status.textContent = '⬆️ Please select a blockchain chain above first'; status.style.color = 'var(--accent-amber)'; }
        // Highlight chain selector
        const cs = document.getElementById('tm-chain-selector');
        if (cs) {
          cs.style.borderColor = 'rgba(245,158,11,0.6)';
          cs.style.background = 'rgba(245,158,11,0.07)';
          setTimeout(() => { cs.style.borderColor = ''; cs.style.background = ''; }, 2500);
        }
        return;
      }
      // Check already added (same contract on same chain)
      const existing = loadSavedTokens().find(t =>
        t.contract?.toLowerCase() === q.toLowerCase() &&
        (t.chainId || 8453) === (_tmSelectedChainId || 8453)
      );
      if (existing) {
        if (status) { status.textContent = '⚠️ Already added: ' + existing.sub + ' on this chain'; status.style.color = 'var(--accent-amber)'; }
      } else {
        if (status) { status.innerHTML = '<span class="del-spinner" style="width:9px;height:9px;border-width:2px;margin-right:6px;display:inline-block;vertical-align:middle;"></span>Checking CoinGecko…'; status.style.color = 'var(--text-muted)'; }
        clearTimeout(tmSearchTimer);
        tmSearchTimer = setTimeout(() => _fetchContractAndPreview(q), 700);
      }
    } else {
      if (status) { status.textContent = q.length > 2 ? '⚠️ Incomplete address…' : ''; status.style.color = 'var(--accent-amber)'; }
    }
    return;
  }

  // ── Normal search mode ──
  const _prev2 = document.getElementById('tm-contract-preview');
  if (_prev2) _prev2.style.display = 'none';
  if (searchIcon) searchIcon.textContent = 'search';
  if (status) status.textContent = '';

  if (q.length === 0) {
    const _sr0 = document.getElementById('tm-search-results');
    if (_sr0) _sr0.style.display = 'none';
    return;
  }

  const _srBlock = document.getElementById('tm-search-results');
  if (_srBlock) _srBlock.style.display = 'block';
  (document.getElementById('tm-results-list') || {}).innerHTML = '';
  const _searching = document.getElementById('tm-searching');
  const _noRes = document.getElementById('tm-no-results');
  if (_searching) _searching.style.display = 'block';
  if (_noRes) _noRes.style.display = 'none';

  clearTimeout(tmSearchTimer);
  tmSearchTimer = setTimeout(() => doTmSearch(q), 500);
}

// ── Fetch token info by contract address and show preview card (do NOT auto-add) ──
async function _fetchContractAndPreview(addr) {
  const status = document.getElementById('tm-contract-status');
  const previewWrap = document.getElementById('tm-contract-preview');
  const previewCard = document.getElementById('tm-contract-preview-card');
  const previewWarn = document.getElementById('tm-contract-preview-warn');
  const chainId = _tmSelectedChainId || 8453;
  const chainDef = getAllChains().find(c => c.chainId === chainId) || { emoji: '🔵', name: 'Chain ' + chainId, chainId };

  function _hidePreview() { if (previewWrap) previewWrap.style.display = 'none'; }

  // Step 1: Check CoinGecko
  let cgCoin = null;
  try {
    cgCoin = await _cgLookupByContract(addr, chainId);
  } catch {}

  if (cgCoin) {
    // CoinGecko token found — show preview with CG data, then open chain picker on Add
    if (status) { status.textContent = '✅ Found on CoinGecko: ' + cgCoin.name; status.style.color = 'var(--accent-green)'; }
    const sym2 = (cgCoin.symbol || '').slice(0,2).toUpperCase() || '?';
    const iconHtml = cgCoin.thumb
      ? `<img src="${cgCoin.thumb}" alt="${sym2}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;" onerror="this.style.display='none';this.parentNode.innerHTML='<span style=\\'font-size:14px;font-weight:800;\\'>${sym2}</span>'">`
      : `<span style="font-size:14px;font-weight:800;">${sym2}</span>`;
    if (previewCard) previewCard.innerHTML = `
      <div style="width:44px;height:44px;border-radius:13px;background:rgba(99,102,241,0.18);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;">
        ${iconHtml}
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${cgCoin.name}</div>
        <div style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);margin-top:2px;">${(cgCoin.symbol||'').toUpperCase()} · ${chainDef.emoji} ${chainDef.name}</div>
        <div style="font-size:9px;color:var(--neon-cyan);font-family:var(--font-mono);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">🦎 CoinGecko verified</div>
      </div>
      <div onclick="_cgContractAddToken('${cgCoin.id}','${(cgCoin.name||'').replace(/'/g,'&#39;')}','${(cgCoin.symbol||'').replace(/'/g,'&#39;')}','${(cgCoin.thumb||'').replace(/'/g,'&#39;')}')"
        style="padding:8px 14px;border-radius:11px;background:linear-gradient(135deg,rgba(99,102,241,0.25),rgba(139,92,246,0.2));border:1px solid rgba(99,102,241,0.45);font-size:11px;font-weight:700;color:var(--neon-purple);font-family:var(--font-mono);cursor:pointer;white-space:nowrap;flex-shrink:0;display:flex;align-items:center;gap:5px;"
        onmousedown="this.style.opacity='.7'" onmouseup="this.style.opacity='1'" ontouchstart="this.style.opacity='.7'" ontouchend="this.style.opacity='1'">
        <span class="material-icons-round" style="font-size:15px;">add_circle</span>ADD TOKEN
      </div>
    `;
    if (previewWarn) previewWarn.style.display = 'none';
    if (previewWrap) previewWrap.style.display = 'block';
    return;
  }

  // Step 2: RPC fallback — fetch name, symbol, decimals from blockchain
  if (status) { status.innerHTML = '<span class="del-spinner" style="width:9px;height:9px;border-width:2px;margin-right:6px;display:inline-block;vertical-align:middle;"></span>Reading from blockchain RPC…'; status.style.color = 'var(--text-muted)'; }

  const rpcList = _getRpcListForChain(chainId);
  let meta = null;
  try { meta = await _readTokenMeta(addr, rpcList); } catch {}

  if (!meta || !meta.symbol) {
    if (status) { status.textContent = '❌ Could not read token info from this contract'; status.style.color = 'var(--accent-red)'; }
    _hidePreview();
    return;
  }

  // Token found via RPC but NOT on CoinGecko/CMC → show preview with warning, require button click
  if (status) { status.textContent = '🔗 Loaded from blockchain'; status.style.color = 'var(--neon-cyan)'; }

  const colors = ['#6366f1','#8b5cf6','#22d3ee','#10b981','#f59e0b','#f472b6','#f43f5e','#a78bfa','#0052ff','#f7931a'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const sym2 = (meta.symbol || '??').slice(0,2).toUpperCase();
  const displayName = meta.name || meta.symbol;
  const displaySym = meta.symbol.toUpperCase();

  // Store pending token data for the Add button
  window._tmContractPending = {
    id: 'custom-' + addr.slice(2,10).toLowerCase(),
    chainId,
    name: displayName,
    sub: displaySym,
    icon: sym2,
    color, badge: color,
    contract: addr,
    decimals: meta.decimals || 18,
    cgId: null,
    cbPair: displaySym + '-USD',
    isDefault: false,
    isCustomContract: true,
    isProxy: !!meta.isProxy,
  };

  if (previewCard) previewCard.innerHTML = `
    <div style="width:44px;height:44px;border-radius:13px;background:${color}22;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:16px;font-weight:800;color:${color};">
      ${sym2}
    </div>
    <div style="flex:1;min-width:0;">
      <div style="font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${displayName}</div>
      <div style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);margin-top:2px;">${displaySym} · ${chainDef.emoji} ${chainDef.name}</div>
      <div style="font-size:9px;color:var(--text-muted);font-family:var(--font-mono);margin-top:3px;">Decimals: ${meta.decimals}${meta.isProxy ? ' · proxy contract' : ''}</div>
    </div>
    <div onclick="_addContractPendingToken()"
      style="padding:8px 14px;border-radius:11px;background:linear-gradient(135deg,rgba(99,102,241,0.25),rgba(139,92,246,0.2));border:1px solid rgba(99,102,241,0.45);font-size:11px;font-weight:700;color:var(--neon-purple);font-family:var(--font-mono);cursor:pointer;white-space:nowrap;flex-shrink:0;display:flex;align-items:center;gap:5px;"
      onmousedown="this.style.opacity='.7'" onmouseup="this.style.opacity='1'" ontouchstart="this.style.opacity='.7'" ontouchend="this.style.opacity='1'">
      <span class="material-icons-round" style="font-size:15px;">add_circle</span>ADD TOKEN
    </div>
  `;
  if (previewWarn) previewWarn.style.display = 'block';
  if (previewWrap) previewWrap.style.display = 'block';
}

// ── Add CoinGecko-verified contract token on current chain ──
function _cgContractAddToken(cgId, name, symbol, thumb) {
  addTokenFromSearch(JSON.stringify({ id: cgId, name, symbol, thumb }));
  // Clear search
  (document.getElementById('tm-search') || {}).value = '';
  const _cs = document.getElementById('tm-clear-search');
  const _sr = document.getElementById('tm-search-results');
  if (_cs) _cs.style.display = 'none';
  if (_sr) _sr.style.display = 'none';
  const _prev = document.getElementById('tm-contract-preview');
  if (_prev) _prev.style.display = 'none';
  const icon = document.getElementById('tm-search-icon');
  if (icon) icon.textContent = 'search';
  const status = document.getElementById('tm-contract-status');
  if (status) { status.textContent = ''; }
}
