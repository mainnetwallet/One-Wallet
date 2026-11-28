
// ── Add pending RPC-fetched token on button click ──
function _addContractPendingToken() {
  const td = window._tmContractPending;
  if (!td) return;
  // Check already added
  const existing = loadSavedTokens().find(t =>
    t.contract?.toLowerCase() === td.contract.toLowerCase() &&
    (t.chainId || 8453) === td.chainId
  );
  if (existing) {
    showToast('Already added!', 'check_circle');
    return;
  }
  addToken(td);
  window._tmContractPending = null;
  // Clear UI
  (document.getElementById('tm-search') || {}).value = '';
  const _cs = document.getElementById('tm-clear-search');
  if (_cs) _cs.style.display = 'none';
  const _prev = document.getElementById('tm-contract-preview');
  if (_prev) _prev.style.display = 'none';
  const icon = document.getElementById('tm-search-icon');
  if (icon) icon.textContent = 'search';
  const status = document.getElementById('tm-contract-status');
  if (status) { status.textContent = ''; }
}

function clearTmSearch() {
  (document.getElementById('tm-search') || {}).value = '';
  const _csBt = document.getElementById('tm-clear-search');
  const _srCl = document.getElementById('tm-search-results');
  const _prev = document.getElementById('tm-contract-preview');
  if (_csBt) _csBt.style.display = 'none';
  if (_srCl) _srCl.style.display = 'none';
  if (_prev) _prev.style.display = 'none';
  (document.getElementById('tm-contract-status') || {}).textContent = '';
  const icon = document.getElementById('tm-search-icon');
  if (icon) icon.textContent = 'search';
  window._tmContractPending = null;
}

async function doTmSearch(query) {
  const searchingEl = document.getElementById('tm-searching');
  const noResultsEl = document.getElementById('tm-no-results');
  const resultsList = document.getElementById('tm-results-list');

  if (resultsList) resultsList.innerHTML = '';
  if (noResultsEl) noResultsEl.style.display = 'none';

  // ── Chain filter state ──
  const isChainFiltered = _tmSelectedChainId !== null;
  const selectedChain = isChainFiltered
    ? (getAllChains().find(c => c.chainId === _tmSelectedChainId) || { name: 'All Networks', emoji: '🌐', chainId: null })
    : { name: 'All Networks', emoji: '🌐', chainId: null };

  // ── Show selected chain banner ──
  if (resultsList) {
    const chainBanner = document.createElement('div');
    if (isChainFiltered) {
      chainBanner.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:10px;background:linear-gradient(135deg,rgba(99,102,241,0.12),rgba(139,92,246,0.08));border:1px solid rgba(99,102,241,0.35);margin-bottom:10px;';
      chainBanner.innerHTML = `
        <span style="font-size:16px;">${selectedChain.emoji}</span>
        <div style="flex:1;">
          <div style="font-size:10px;font-weight:700;color:var(--neon-purple);font-family:var(--font-mono);letter-spacing:0.5px;">CHAIN FILTER: ${selectedChain.name.toUpperCase()}</div>
          <div style="font-size:9px;color:var(--text-muted);font-family:var(--font-mono);margin-top:1px;">Showing tokens for this chain · Chain ID: ${selectedChain.chainId}</div>
        </div>
        <span class="material-icons-round" style="font-size:14px;color:var(--accent-primary);">filter_alt</span>
      `;
    } else {
      chainBanner.style.cssText = 'display:flex;align-items:center;gap:8px;padding:7px 12px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid var(--border-subtle);margin-bottom:10px;';
      chainBanner.innerHTML = `
        <span style="font-size:15px;">🌐</span>
        <div style="flex:1;">
          <span style="font-size:10px;font-weight:700;color:var(--text-secondary);font-family:var(--font-mono);">ALL NETWORKS — Showing tokens across all chains</span>
        </div>
        <span class="material-icons-round" style="font-size:13px;color:var(--text-muted);">public</span>
      `;
    }
    resultsList.appendChild(chainBanner);
  }

  // ── Check existing tokens (for already-added state) ──
  function _getAddedUniqueIds() {
    const tokens = (typeof loadSavedTokens === 'function') ? loadSavedTokens() : [];
    const set = new Set();
    tokens.forEach(t => {
      // Chain-aware key: cgId-chainX (same token on different chain = NOT added)
      if (t.cgId) set.add(t.cgId + '-chain' + (t.chainId || 8453));
      // Also store the full id (which already encodes chain via addToken logic)
      // Do NOT add bare t.id here — that would mark a token as "added" on ALL chains
      // even if it was only added on one specific chain.
    });
    return set;
  }

  // ── CoinGecko platform check: does this coin exist on selected chain? ──
  // Returns { hasChain: bool, contractAddr: string|null }
  async function _checkCgCoinOnChain(cgId, chainId) {
    if (!chainId) return { hasChain: true, contractAddr: null }; // All Networks = always show
    const _CG_CHAINID_TO_PLATFORM = {
      1: 'ethereum', 8453: 'base-protocol', 42161: 'arbitrum-one',
      10: 'optimistic-ethereum', 137: 'polygon-pos', 56: 'binance-smart-chain',
      43114: 'avalanche', 59144: 'linea', 534352: 'scroll', 324: 'zksync',
    };
    const platformKey = _CG_CHAINID_TO_PLATFORM[chainId];
    if (!platformKey) return { hasChain: false, contractAddr: null };

    // First check DEFAULT_TOKENS
    const defMatch = DEFAULT_TOKENS.find(t => t.cgId === cgId && t.chainId === chainId);
    if (defMatch) return { hasChain: true, contractAddr: defMatch.contract || null };

    try {
      let platforms = {};
      // Try CoinGecko detail_platforms via _cgFetch (handles Pro → Demo → proxy chain)
      try {
        const d = await _cgFetch(`coins/${cgId}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`);
        platforms = d.detail_platforms || d.platforms || {};
      } catch {}
      if (platforms[platformKey]) {
        const info = platforms[platformKey];
        const addr = typeof info === 'object' ? info.contract_address : info;
        return { hasChain: true, contractAddr: addr || null };
      }
      return { hasChain: false, contractAddr: null };
    } catch {
      return { hasChain: false, contractAddr: null };
    }
  }

  // ── CMC platform check: does this coin exist on selected chain? ──
  async function _checkCmcCoinOnChain(coin, chainId) {
    if (!chainId) return { hasChain: true, contractAddr: null };
    try {
      const platforms = await _fetchTokenPlatformsCMC(coin);
      // _fetchTokenPlatformsCMC returns CG-format detail_platforms
      const _CG_CHAINID_TO_PLATFORM = {
        1: 'ethereum', 8453: 'base-protocol', 42161: 'arbitrum-one',
        10: 'optimistic-ethereum', 137: 'polygon-pos', 56: 'binance-smart-chain',
        43114: 'avalanche', 59144: 'linea', 534352: 'scroll', 324: 'zksync',
      };
      const platformKey = _CG_CHAINID_TO_PLATFORM[chainId];
      if (!platformKey || !platforms[platformKey]) return { hasChain: false, contractAddr: null };
      const info = platforms[platformKey];
      const addr = typeof info === 'object' ? info.contract_address : info;
      return { hasChain: true, contractAddr: addr || null };
    } catch {
      return { hasChain: false, contractAddr: null };
    }
  }

  // ══════════════════════════════════════════
  // PARALLEL SEARCH: CoinGecko + CoinMarketCap
  // Both APIs fire simultaneously.
  // When chain is selected → filter tokens to only that chain.
  // When All Networks → show all (current behavior).
  // ══════════════════════════════════════════
  let cgDone = false, cmcDone = false;
  let cgResults = [], cmcResults = [];

  function _renderResults(coins, source, accentColor) {
    // Search rows come from third-party APIs (CoinGecko / DexScreener / CMC) where anyone can list a token with
    // any name, symbol or logo. Reduce every coin to plain, quote-free fields before it reaches innerHTML,
    // an attribute or a querySelector string below.
    if (coins && window.oneCleanCoin) coins = coins.map(window.oneCleanCoin).filter(Boolean);
    source = window.oneCleanText ? window.oneCleanText(source, 32, '') : source;
    if (!coins || coins.length === 0) return;
    if (resultsList) {
      const srcLabel = document.createElement('div');
      srcLabel.style.cssText = 'font-size:9px;font-weight:700;color:var(--text-muted);font-family:var(--font-mono);letter-spacing:1px;padding:4px 2px 8px;display:flex;align-items:center;gap:5px;';
      const dotColor = source === 'CoinGecko' ? '#10b981' : source === 'DexScreener' ? '#e8a838' : '#2775CA';
      const srcIcon = source === 'CoinGecko' ? '<span style="font-size:10px;">🦎</span>' : source === 'DexScreener' ? '<span style="font-size:10px;">📊</span>' : '<span style="font-size:10px;">🌐</span>';
      srcLabel.innerHTML = srcIcon + ' <span style="width:5px;height:5px;border-radius:50%;background:' + dotColor + ';display:inline-block;"></span> ' + source;
      resultsList.appendChild(srcLabel);
    }
    const addedIds = _getAddedUniqueIds();
    coins.forEach((coin, i) => {
      if (resultsList && resultsList.querySelector('[data-coin-id="' + coin.id + '"]')) return;
      const uniqueAddId = coin.id + '-chain' + (_tmSelectedChainId || 8453);
      // Never show "ADDED" badge in search results — the same token can always be
      // added again on a different chain. Per-chain "ADDED" is shown inside the
      // chain-picker modal. Always show the add icon here.
      const isAdded = false;
      const item = document.createElement('div');
      item.className = 'tm-token-item';
      item.setAttribute('data-coin-id', coin.id);
      item.style.animationDelay = (i * 0.04) + 's';
      const sym2 = (coin.symbol || '').slice(0,2).toUpperCase() || '?';
      const iconHtml = coin.thumb
        ? `<img src="${oneSanitize(coin.thumb)}" alt="${oneSanitize(sym2)}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;" onerror="this.style.display='none';this.parentNode.innerHTML='<span style=\\'font-size:13px;font-weight:800;\\'>${sym2}</span>'"/>`
        : `<span style="font-size:13px;font-weight:800;">${sym2}</span>`;
      const rank = coin.market_cap_rank
        ? `<span style="font-size:9px;background:rgba(255,255,255,0.06);padding:1px 6px;border-radius:5px;margin-left:4px;">#${coin.market_cap_rank}</span>`
        : '';
      const chainTag = isChainFiltered
        ? `${selectedChain.emoji} ${selectedChain.name}`
        : 'All Networks';
      item.dataset.coin = JSON.stringify({ id: coin.id, name: coin.name, symbol: coin.symbol?.toUpperCase?.() || coin.symbol, thumb: coin.thumb || '', _source: coin._source || '', _cmcId: coin._cmcId || null, _cmcSlug: coin._cmcSlug || '' });
      item.innerHTML = `
        <div class="tm-token-icon" style="background:rgba(${accentColor},0.12);">${iconHtml}</div>
        <div class="tm-token-info">
          <div class="tm-token-name">${oneSanitize(coin.name)}${rank}</div>
          <div class="tm-token-sub">${oneSanitize((coin.symbol||'').toUpperCase())} · ${oneSanitize(source)} · ${chainTag}</div>
        </div>
        ${isAdded
          ? `<div class="tm-already-badge">ADDED</div>`
          : `<div class="tm-add-btn" id="tmadd-${oneSanitize(coin.id)}"><span class="material-icons-round">add</span></div>`
        }
      `;
      if (!isAdded) {
        item.querySelector('.tm-add-btn').addEventListener('click', () => {
          if (typeof addTokenFromSearch === 'function') {
            addTokenFromSearch(item.dataset.coin);
          }
        });
      }
      if (resultsList) resultsList.appendChild(item);
    });
  }

  // ── Chain-filter a list of CoinGecko coins ──
  async function _filterCgByChain(coins, chainId) {
    if (!chainId) return coins; // All Networks: no filter
    // Run parallel platform checks (limit concurrency to avoid rate limits)
    const results = await Promise.all(
      coins.map(coin => _checkCgCoinOnChain(coin.id, chainId).catch(() => ({ hasChain: false })))
    );
    return coins.filter((_, i) => results[i].hasChain);
  }

  // ── Chain-filter a list of CMC coins ──
  async function _filterCmcByChain(coins, chainId) {
    if (!chainId) return coins;
    const results = await Promise.all(
      coins.map(coin => _checkCmcCoinOnChain(coin, chainId).catch(() => ({ hasChain: false })))
    );
    return coins.filter((_, i) => results[i].hasChain);
  }

  function _checkDone() {
    if (cgDone && cmcDone) {
      if (searchingEl) searchingEl.style.display = 'none';
      const visibleItems = resultsList ? resultsList.querySelectorAll('[data-coin-id]').length : 0;
      if (visibleItems === 0) {
        if (noResultsEl) {
          noResultsEl.style.display = 'block';
          // Update no-results message when chain filtered
          if (isChainFiltered) {
            noResultsEl.innerHTML = `
              <div style="font-size:32px;margin-bottom:10px;">${selectedChain.emoji}</div>
              <div style="font-size:12px;font-weight:700;color:var(--text-secondary);margin-bottom:6px;font-family:var(--font-display);">Token Not Found</div>
              <div style="line-height:1.7;font-size:10px;">Token not available on ${selectedChain.name}.<br>Try another chain or search with <span style="color:var(--neon-cyan);">All Networks</span>.</div>
            `;
          }
        }
      }
    }
  }

  // ── CoinGecko fetch (via _cgFetch — handles Pro → Demo → proxy chain) ──
  async function _fetchCoinGecko() {
    const q = encodeURIComponent(query);
    try {
      const d = await _cgFetch(`search?query=${q}`);
      if (d.coins?.length) return d.coins.slice(0,10);
    } catch {}
    return [];
  }

  // ── DexScreener + Extended CoinGecko fetch (replaces CMC — CORS-friendly) ──
  // CMC blocks all browser direct calls (CORS). DexScreener allows all origins.
  // CoinGecko free /search also works. We combine both for maximum coverage.
  async function _fetchCoinMarketCap() {
    const q = encodeURIComponent(query);
    const qLow = query.toLowerCase();

    function _mapDexItems(pairs) {
      // Deduplicate by baseToken symbol+name
      const seen = new Set();
      const out = [];
      for (const p of pairs) {
        const bt = p.baseToken || {};
        const key = (bt.symbol || '').toLowerCase() + '|' + (bt.name || '').toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const sym = (bt.symbol || '').toUpperCase();
        const sym2 = sym.slice(0, 2) || '?';
        out.push({
          id: 'dex-' + (bt.address || key).toLowerCase(),
          name: bt.name || sym,
          symbol: sym,
          thumb: `https://dd.dexscreener.com/ds-data/tokens/${(p.chainId || 'ethereum').toLowerCase()}/${(bt.address || '').toLowerCase()}.png`,
          market_cap_rank: null,
          _source: 'DexScreener',
          _dexPair: p,
        });
        if (out.length >= 8) break;
      }
      return out;
    }

    function _mapCgExtra(coins) {
      // Extra CoinGecko results beyond what _fetchCoinGecko already got
      return (coins || []).slice(0, 10).map(c => ({
        id: c.id || c.slug || '',
        name: c.name || '',
        symbol: (c.symbol || '').toUpperCase(),
        thumb: c.large || c.thumb || c.small || '',
        market_cap_rank: c.market_cap_rank || null,
        _source: 'CoinGecko',
      }));
    }

    // ── Attempt 1: DexScreener search (CORS open, no key needed) ──
    try {
      const res = await fetch(
        `https://api.dexscreener.com/latest/dex/search?q=${q}`,
        { signal: AbortSignal.timeout(7000), headers: { 'Accept': 'application/json' } }
      );
      if (res.ok) {
        const d = await res.json();
        const pairs = (d?.pairs || []).filter(p => {
          const name = (p.baseToken?.name || '').toLowerCase();
          const sym  = (p.baseToken?.symbol || '').toLowerCase();
          return name.includes(qLow) || sym.includes(qLow) || sym === qLow;
        });
        if (pairs.length > 0) return _mapDexItems(pairs);
      }
    } catch {}

    // ── Attempt 2: CoinGecko /search with extended limit (free, CORS open) ──
    try {
      const r = await fetch(
        `https://api.coingecko.com/api/v3/search?query=${q}`,
        { signal: AbortSignal.timeout(7000) }
      );
      if (r.ok) {
        const d = await r.json();
        const coins = (d?.coins || []).slice(10, 20); // take results 11-20 (1-10 already from _fetchCoinGecko)
        if (coins.length > 0) return _mapCgExtra(coins);
      }
    } catch {}

    // ── Attempt 3: CoinGecko via native bridge (extra fallback) ──
    try {
      const cgUrl = `https://api.coingecko.com/api/v3/search?query=${q}`;
      const res = await window.nxFetch(cgUrl, { ms: 9000 });
      if (res.ok) {
        const d = await res.json();
        const coins = (d?.coins || []).slice(10, 20);
        if (coins.length > 0) return _mapCgExtra(coins);
      }
    } catch {}

    // ── Attempt 4: DexScreener via native bridge ──
    try {
      const dexUrl = `https://api.dexscreener.com/latest/dex/search?q=${q}`;
      const res = await window.nxFetch(dexUrl, { ms: 9000 });
      if (res.ok) {
        const d = await res.json();
        const pairs = (d?.pairs || []).filter(p => {
          const name = (p.baseToken?.name || '').toLowerCase();
          const sym  = (p.baseToken?.symbol || '').toLowerCase();
          return name.includes(qLow) || sym.includes(qLow);
        });
        if (pairs.length > 0) return _mapDexItems(pairs);
      }
    } catch {}

    return [];
  }

  // ── Merge CMC into already-rendered CG results ──
  // Same symbol → update subtitle "CMC & CoinGecko" in-place
  // CMC-only → render as separate CoinMarketCap entry
  function _mergeCmcIntoCg() {
    if (!cmcResults.length) return;
    const chainTag = isChainFiltered ? `${selectedChain.emoji} ${selectedChain.name}` : 'All Networks';
    const cmcOnlyCoins = [];

    cmcResults.forEach(cmcCoin => {
      const cmcSym = (cmcCoin.symbol || '').toLowerCase();
      const cgMatch = cgResults.find(cg => (cg.symbol || '').toLowerCase() === cmcSym);

      if (cgMatch && resultsList) {
        // rows are keyed by the cleaned id (see _renderResults), so look up by the same cleaned id
        const _cgKey = String(cgMatch.id == null ? '' : cgMatch.id).replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 120);
        const existingEl = _cgKey ? resultsList.querySelector('[data-coin-id="' + _cgKey + '"]') : null;
        if (existingEl) {
          // Update subtitle with gradient "CMC & CoinGecko" badge
          const subEl = existingEl.querySelector('.tm-token-sub');
          if (subEl) {
            subEl.innerHTML =
              `${(cgMatch.symbol || '').toUpperCase()} · ` +
              `<span style="background:linear-gradient(90deg,#f59e0b,#10b981);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-weight:800;">CMC & CoinGecko</span>` +
              ` · ${chainTag}`;
          }
          // Merge CMC metadata so addTokenFromSearch can use both sources
          try {
            const coinData = JSON.parse(existingEl.dataset.coin || '{}');
            coinData._cmcId   = cmcCoin._cmcId;
            coinData._cmcSlug = cmcCoin._cmcSlug;
            coinData._source  = 'CMC & CoinGecko';
            existingEl.dataset.coin = JSON.stringify(coinData);
          } catch {}
        }
      } else {
        cmcOnlyCoins.push(cmcCoin);
      }
    });

    if (cmcOnlyCoins.length > 0) {
      if (searchingEl) searchingEl.style.display = 'none';
      // Determine correct label: DexScreener or CoinGecko (extended)
      const secondarySource = cmcOnlyCoins[0]?._source || 'DexScreener';
      const accentColor = secondarySource === 'DexScreener' ? '232,168,56' : '99,102,241';
      _renderResults(cmcOnlyCoins, secondarySource, accentColor);
    }
  }

  // ── Fire both in parallel ──
  // CG renders immediately when ready.
  // CMC: if CG already done → merge; else CG .then() will trigger merge.
  _fetchCoinGecko().then(async function(results) {
    let filtered = results || [];
    if (isChainFiltered && filtered.length > 0) {
      if (searchingEl) searchingEl.innerHTML = `<span class="del-spinner" style="margin-right:8px;"></span>${selectedChain.emoji} Filtering tokens for ${selectedChain.name}…`;
      filtered = await _filterCgByChain(filtered, _tmSelectedChainId);
    }
    cgResults = filtered;
    cgDone = true;
    if (cgResults.length > 0) {
      if (searchingEl) searchingEl.style.display = 'none';
      _renderResults(cgResults, 'CoinGecko', '99,102,241');
    }
    if (cmcDone) _mergeCmcIntoCg();
    _checkDone();
  }).catch(function() { cgDone = true; if (cmcDone) _mergeCmcIntoCg(); _checkDone(); });

  _fetchCoinMarketCap().then(async function(results) {
    let filtered = results || [];
    if (isChainFiltered && filtered.length > 0) {
      filtered = await _filterCmcByChain(filtered, _tmSelectedChainId);
    }
    cmcResults = filtered;
    cmcDone = true;
    if (cgDone) _mergeCmcIntoCg();
    _checkDone();
  }).catch(function() { cmcDone = true; _checkDone(); });
}

// ── CoinGecko platform id → chainId mapping ──
const _CG_PLATFORM_TO_CHAINID = {
  'ethereum':              1,
  'base-protocol':         8453,
  'arbitrum-one':          42161,
  'optimistic-ethereum':   10,
  'polygon-pos':           137,
  'binance-smart-chain':   56,
  'avalanche':             43114,
  'linea':                 59144,
  'scroll':                534352,
  'zksync':                324,
};

// ── Show chain contract picker modal before adding token ──
let _tmPendingCoin = null; // coin data waiting for chain selection

function addTokenFromSearch(coinJson) {
  // Wallet guard
  const _atGroups = (typeof loadWalletGroups === 'function') ? loadWalletGroups() : [];
  if (!_atGroups || _atGroups.length === 0) {
    showToast('Please add a wallet first!', 'account_balance_wallet');
    haptic();
    return;
  }

  const coin = JSON.parse(coinJson);
  _tmPendingCoin = coin;

  // Show loading in modal immediately
  _openTokenChainPickerModal(coin, null);

  // If from DexScreener: fetch platforms via contract address from pair data
  // If from CMC: fetch CMC contract platforms, also try CoinGecko by symbol
  // If from CoinGecko: fetch CoinGecko platforms as before
  const isCmc = coin._source === 'CoinMarketCap' || !!coin._cmcId;
  const isDex = coin._source === 'DexScreener';
  const fetchPlatforms = isCmc
    ? _fetchTokenPlatformsCMC(coin)
    : isDex
      ? Promise.resolve(_buildDexPlatforms(coin))
      : _fetchTokenPlatforms(coin.id);

  fetchPlatforms.then(platforms => {
    _openTokenChainPickerModal(coin, platforms);
  }).catch(() => {
    _openTokenChainPickerModal(coin, {});
  });
}

// ── DexScreener platform builder (converts pair data to CG-format platforms) ──
function _buildDexPlatforms(coin) {
  const pair = coin._dexPair;
  if (!pair) return {};
  const chainId = (() => {
    const c = (pair.chainId || '').toLowerCase();
    if (c === 'ethereum') return 1;
    if (c === 'base') return 8453;
    if (c === 'arbitrum') return 42161;
    if (c === 'optimism') return 10;
    if (c === 'polygon') return 137;
    if (c === 'bsc' || c === 'binance') return 56;
    if (c === 'avalanche') return 43114;
    if (c === 'linea') return 59144;
    if (c === 'scroll') return 534352;
    if (c === 'zksync') return 324;
    return null;
  })();
  const addr = pair.baseToken?.address || '';
  if (!chainId || !addr) return {};
  return { [chainId]: addr };
}

// ── CMC contract/platform fetcher ──
const _CMC_PLATFORM_TO_CHAINID = {
  'Ethereum': 1, 'ethereum': 1, 'ETH': 1,
  'Base': 8453, 'base': 8453,
  'Arbitrum': 42161, 'Arbitrum One': 42161, 'arbitrum-one': 42161,
  'Optimism': 10, 'optimism': 10,
  'Polygon': 137, 'Polygon POS': 137, 'polygon-pos': 137, 'MATIC': 137,
  'BNB Smart Chain (BEP20)': 56, 'BNB Chain': 56, 'BNB Smart Chain': 56,
  'Binance Smart Chain': 56, 'BSC': 56, 'BEP20': 56, 'binance-smart-chain': 56,
  'Avalanche C-Chain': 43114, 'Avalanche': 43114, 'avalanche': 43114,
  'Linea': 59144, 'linea': 59144,
  'Scroll': 534352, 'scroll': 534352,
  'zkSync Era': 324, 'zkSync': 324, 'zksync': 324,
};

async function _fetchTokenPlatformsCMC(coin) {
  const result = {};
  const cmcId = coin._cmcId;
  const slug   = coin._cmcSlug || coin.id;

  function _parseContracts(contracts) {
    const r = {};
    (contracts || []).forEach(entry => {
      const platformName = entry.platform?.name || entry.platform?.coin?.name || entry.platform?.slug || '';
      const addr = entry.contract_address || '';
      const chainId = _CMC_PLATFORM_TO_CHAINID[platformName];
      if (chainId && addr && addr.startsWith('0x')) r[chainId] = addr;
    });
    return r;
  }

  // 1. CMC Pro API v2 by ID
  if (cmcId) {
    try {
      const r = await window.nxFetch(
        `https://pro-api.coinmarketcap.com/v2/cryptocurrency/info?id=${cmcId}&aux=contract_address,logo`,
        { headers: { 'X-CMC_PRO_API_KEY': _API_KEYS.CMC_PRO, 'Accept': 'application/json' }, ms: 8000 }
      );
      if (r.ok) {
        const d = await r.json();
        const info = d?.data?.[String(cmcId)];
        if (info) {
          const parsed = _parseContracts(info.contract_address);
          if (Object.keys(parsed).length > 0) return _cmcPlatformResultToModalFormat(parsed);
        }
      }
    } catch {}
  }

  // 2. CMC Pro API v1 by slug
  if (slug) {
    try {
      const r = await window.nxFetch(
        `https://pro-api.coinmarketcap.com/v1/cryptocurrency/info?slug=${slug}&aux=contract_address,logo`,
        { headers: { 'X-CMC_PRO_API_KEY': _API_KEYS.CMC_PRO, 'Accept': 'application/json' }, ms: 8000 }
      );
      if (r.ok) {
        const d = await r.json();
        const dataEntries = Object.values(d?.data || {});
        for (const info of dataEntries) {
          const parsed = _parseContracts(info.contract_address);
          if (Object.keys(parsed).length > 0) return _cmcPlatformResultToModalFormat(parsed);
        }
      }
    } catch {}
  }

  // 3. Fallback: try CoinGecko by symbol/name to get contracts
  if (coin.symbol) {
    try {
      const d = await _cgFetch(`search?query=${encodeURIComponent(coin.symbol)}`);
      const match = (d.coins || []).find(c =>
        c.symbol?.toLowerCase() === coin.symbol.toLowerCase() ||
        c.name?.toLowerCase() === coin.name?.toLowerCase()
      );
      if (match?.id) return await _fetchTokenPlatforms(match.id);
    } catch {}
  }

  return {};
}

// Convert { chainId: contractAddr } → CoinGecko detail_platforms format
function _cmcPlatformResultToModalFormat(chainContractMap) {
  const _CHAINID_TO_CG_PLATFORM = {
    1:      'ethereum',
    8453:   'base-protocol',
    42161:  'arbitrum-one',
    10:     'optimistic-ethereum',
    137:    'polygon-pos',
    56:     'binance-smart-chain',
    43114:  'avalanche',
    59144:  'linea',
    534352: 'scroll',
    324:    'zksync',
  };
  const out = {};
  Object.entries(chainContractMap).forEach(([chainId, addr]) => {
    const platformKey = _CHAINID_TO_CG_PLATFORM[Number(chainId)];
    if (platformKey) {
      out[platformKey] = { contract_address: addr, decimal_place: 18 };
    }
  });
  return out;
}

async function _fetchTokenPlatforms(cgId) {
  // Try CoinGecko /coins/{id} with detail_platforms
  try {
    const d = await _cgFetch(`coins/${cgId}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`);
    return d.detail_platforms || d.platforms || {};
  } catch {}
  return {};
}
