
// ── MAIN: loadTokens ──
async function _loadTokensImpl() {
  // Increment session — any callback from a previous call will see a stale session and bail
  const _mySession = ++_loadTokensSession;

  const list = document.getElementById('token-list');

  // ── NO WALLET GUARD: if no wallet is selected, clear balance and show empty state ──
  const _currentWalletKey = (function() {
    try { return _oneGetSelectedKey(); } catch { return null; }
  })();
  if (!_currentWalletKey && !homeActiveKey) {
    list.innerHTML = '<div style="text-align:center;padding:48px 20px;font-family:var(--font-mono);">' +
      '<div style="font-size:40px;margin-bottom:14px;">👛</div>' +
      '<div style="font-size:13px;font-weight:700;color:var(--text-secondary);margin-bottom:6px;">No Wallet Selected</div>' +
      '<div style="font-size:10px;color:var(--text-muted);line-height:1.7;">Select a wallet from the top<br>to view your balances &amp; tokens</div>' +
      '</div>';
    _portfolioTotalUsd = 0;
    _portfolioLastDisplayed = null;
    updatePortfolioTotal();
    // Hide live label when no wallet
    var _psl = document.getElementById('home-price-source-label');
    if (_psl) _psl.style.display = 'none';
    return;
  }

  // Preserve portfolio total — only reset if no cards AND no pre-cached total
  const _preExistingCards = list ? list.querySelectorAll('.token-card') : [];
  // Remember which wallet these cards belong to so a later snapshot-restore for the SAME wallet
  // can be skipped instead of wiping + rebuilding every card (that was the open-time flicker).
  try { if (list) list.dataset.nxWallet = String(_currentWalletKey || homeActiveKey || '').slice(-8); } catch (e) {}
  if (_preExistingCards.length === 0) {
    // Only zero out if no pre-cached total was set (from Step 0b)
    if (!(_portfolioTotalUsd > 0)) {
      _portfolioTotalUsd = 0;
      _portfolioLastDisplayed = null;
      updatePortfolioTotal();
    }
  } else {
    // Recalculate from existing restored cards (they have cached USD values)
    let _restoredTotal = 0;
    _preExistingCards.forEach(function(c) { _restoredTotal += parseFloat(c.dataset.usdValue || '0') || 0; });
    if (_restoredTotal > 0) { _portfolioTotalUsd = _restoredTotal; }
  }

  // Ensure TOKEN_CONFIG is always in sync with localStorage
  syncTokenConfig();

  // Determine which tokens to show based on active chain
  const allTokens = TOKEN_CONFIG;
  const filteredTokens = activeHomeChainId === null
    ? allTokens
    : allTokens.filter(t => (t.chainId || 8453) === activeHomeChainId);

  // Clear list immediately - but only if no cached cards are showing
  // (if cached cards exist, keep them visible and update in-place to prevent blank flash)
  const _hasExistingCards = list.querySelectorAll('.token-card').length > 0;
  if (!_hasExistingCards) list.innerHTML = '';
  // Clear skeletons only (leave real token cards intact)
  ['skel1','skel2','skel3'].forEach(function(id) {
    var sk = document.getElementById(id);
    if (sk) sk.remove();
  });

  // Empty state for filtered chain
  if (filteredTokens.length === 0) {
    list.innerHTML = '';
    const empty = document.createElement('div');
    empty.style.cssText = 'text-align:center;padding:40px 20px;font-family:var(--font-mono);font-size:11px;color:var(--text-muted);';
    const chainInfo = getAllChains().find(c => c.chainId === activeHomeChainId);
    if (empty) empty.innerHTML = `<div style="font-size:32px;margin-bottom:12px;">${chainInfo ? chainInfo.emoji : '🔗'}</div><div style="font-size:13px;font-weight:700;color:var(--text-secondary);margin-bottom:6px;">No tokens on ${chainInfo ? chainInfo.name : 'this chain'}</div><div style="font-size:10px;color:var(--text-muted);line-height:1.6;">Add tokens via <strong style="color:var(--accent-primary);">MY TOKENS → MANAGE</strong></div>`;
    list.appendChild(empty);
    return;
  }

  // ── INSTANT RENDER: use cached prices if available → zero flicker on chain switch/re-open ──
  // If fresh price cache exists, render immediately with real prices (no 0→value flash)
  // If cached cards already exist in DOM (from snapshot restore), skip re-render to avoid flash
  var _holdSortUntilLoaded = false; // set when the list came from a snapshot (keep saved order until data complete)
  const _cachedNow = Date.now();
  const _hasFreshCache = _globalPriceCache && (_cachedNow - _globalPriceCacheTime) < _PRICE_CACHE_TTL;
  const _hasCardNow = list.querySelectorAll('.token-card').length > 0;

  if (!_hasCardNow) {
    // No cards in DOM — render fresh
    filteredTokens.forEach((t, i) => {
      let initPrice = 0, initChange = 0;
      if (_hasFreshCache) {
        const pd = _globalPriceCache[t.cgId];
        if (pd && pd.usd) { initPrice = pd.usd; initChange = pd.usd_24h_change || 0; }
      }
      renderTokenCard(t, initPrice, initChange, null, list, i);
    });
  } else {
    // Cards already showing (from cache restore) — only add missing token cards
    // Also fix logos on existing restored cards (snapshot only saves text, not images)
    filteredTokens.forEach((t, i) => {
      const existingCard = document.getElementById('token-card-' + t.id);
      if (!existingCard) {
        let initPrice = 0, initChange = 0;
        if (_hasFreshCache) {
          const pd = _globalPriceCache[t.cgId];
          if (pd && pd.usd) { initPrice = pd.usd; initChange = pd.usd_24h_change || 0; }
        }
        renderTokenCard(t, initPrice, initChange, null, list, i);
      } else {
        // Card exists (from snapshot restore) — inject proper logo if icon only has text
        // ── Saved-order lock is released only after price + ALL balances are in (see _debouncedSort) ──
        if (existingCard.dataset.savedOrder !== undefined) _holdSortUntilLoaded = true;
        delete existingCard.dataset.savedOrder;
        const iconDiv = existingCard.querySelector('.token-icon');
        if (iconDiv) {
          // Always ensure id is set and onclick is wired (may be missing on restored cards)
          if (!iconDiv.id) iconDiv.id = 'ticon-' + t.id;
          iconDiv.setAttribute('data-cgid', t.cgId || '');
          // Bind onclick unconditionally so contract address popup always works
          iconDiv.onclick = (function(tok) {
            return function(ev) { ev.stopPropagation(); showTokenAddrPopup(tok.id, tok.contract||'', tok.sub, this); };
          })(t);
          if (!iconDiv.querySelector('img') && !iconDiv.querySelector('div[style*="border-radius"]')) {
            iconDiv.innerHTML = '';
            const logoEl = getTokenLogoEl(t);
            logoEl.style.width = '100%';
            logoEl.style.height = '100%';
            iconDiv.appendChild(logoEl);
          }
        }
      }
    });
    // Remove cards that no longer belong (e.g. chain filter changed)
    const validIds = new Set(filteredTokens.map(t => 'token-card-' + t.id));
    list.querySelectorAll('.token-card').forEach(card => {
      if (!validIds.has(card.id)) card.remove();
    });
  }
  if (_homeTokenSearchQuery) _renderFilteredTokenCards();

  // ── Restored-from-snapshot lists keep last session's order until price AND every balance are in,
  // then re-sort ONCE (only changes if balances really changed). Re-sorting on each partial result
  // (balance arrived but price not yet -> USD 0 -> card drops, then jumps back) made rows jump.
  var _ltPriceDone = false;
  var _ltAllBalDone = (validatedKeys.length === 0);


  // ── DEBOUNCED SORT — only re-orders once per batch of balance updates ──
  let _sortDebounceTimer = null;
  function _debouncedSort() {
    if (_holdSortUntilLoaded && !(_ltPriceDone && _ltAllBalDone)) return;
    if (_sortDebounceTimer) clearTimeout(_sortDebounceTimer);
    _sortDebounceTimer = setTimeout(() => {
      _sortDebounceTimer = null;
      _sortTokenCards();
    }, 50); // fast sort after balance arrives
  }

  function _sortTokenCards() {
    const listEl = document.getElementById('token-list');
    if (!listEl) return;
    const cards = Array.from(listEl.querySelectorAll('.token-card'));

    // ── If ALL cards carry data-saved-order, honour the snapshot serial ──
    const allHaveSavedOrder = cards.every(c => c.dataset.savedOrder !== undefined);
    if (allHaveSavedOrder) {
      cards.sort((a, b) => parseInt(a.dataset.savedOrder, 10) - parseInt(b.dataset.savedOrder, 10));
      _applyCardOrder(listEl, cards);
      return;
    }

    // ── Stamp stable index ONCE per card (never overwrite) ──
    cards.forEach((c, i) => { if (!c.dataset.stableIdx) c.dataset.stableIdx = String(i); });

    // ── Helper: does this card have a real on-chain balance? ──
    function _hasRealBalance(card) {
      const balEl = card.querySelector('.token-amount');
      if (!balEl) return false;
      const raw = parseFloat((balEl.textContent || '0').replace(/,/g, ''));
      return raw > 0;
    }

    // ── Separate cards into two groups ──
    // Group A: cards with real balance  → sorted dynamically by USD value (desc)
    // Group B: cards with zero balance  → kept in stable original order, always below A
    const withBalance    = cards.filter(c => _hasRealBalance(c));
    const withoutBalance = cards.filter(c => !_hasRealBalance(c));

    // Sort only the balance-holding cards by their live USD value (highest first)
    withBalance.sort((a, b) => {
      const av = parseFloat(a.dataset.usdValue || '0');
      const bv = parseFloat(b.dataset.usdValue || '0');
      const diff = bv - av;
      // Truly identical USD values → keep relative order stable
      if (Math.abs(diff) < 1e-10) return parseInt(a.dataset.stableIdx, 10) - parseInt(b.dataset.stableIdx, 10);
      return diff; // higher USD first
    });

    // No-balance cards keep their existing stable order
    withoutBalance.sort((a, b) => parseInt(a.dataset.stableIdx, 10) - parseInt(b.dataset.stableIdx, 10));

    // Re-append: balance cards first, then no-balance cards
    _applyCardOrder(listEl, [...withBalance, ...withoutBalance]);
  }

  // ── Wallet cache key for balance lookup (wallet-specific, last 8 chars of key) ──
  const _walletCacheKey = (_currentWalletKey || homeActiveKey || '').slice(-8);

  // ── BACKGROUND: fetch prices then update cards ──
  // Keep a shared priceMap so balance handler can also compute USD
  const _sharedPriceMap = {};

  // If fresh cache exists, populate _sharedPriceMap immediately without waiting for network
  if (_hasFreshCache) {
    filteredTokens.forEach(t => {
      const pd = _globalPriceCache[t.cgId];
      if (pd && pd.usd) _sharedPriceMap[t.id] = pd.usd;
    });
    // Cards already rendered with cached prices — just populate sharedPriceMap for balance handler
    // Still call fetchAllPrices so it stores in cache (will return instantly from cache)
  }

  // ── START balance fetch IMMEDIATELY (parallel with price fetch) ──
  // Don't wait for fetchAllPrices — start RPC calls now so both resolve around same time
  const _balFetchPromises = [];
  if (validatedKeys.length > 0) {
    const _providers = {};
    const _rpcValidated = {}; // track chains already validated — don't re-validate every load
    const _getProvider = (chainId) => {
      if (!_providers[chainId]) {
        // Build full RPC list: built-in array + custom chain RPC
        const builtinRpcs = SEND_CHAIN_RPC[chainId];
        const customRpc   = (loadCustomChains().find(c => c.chainId === chainId) || {}).rpc || null;
        const rpcList     = [
          ...(Array.isArray(builtinRpcs) ? builtinRpcs : builtinRpcs ? [builtinRpcs] : []),
          ...(customRpc ? [customRpc] : [])
        ];
        // Try first RPC immediately (sync) for instant use
        for (const rpc of rpcList) {
          try { _providers[chainId] = _makeProvider(rpc); break; } catch(e) { continue; }
        }
        // Async background validation: only once per chain, find fastest working RPC
        if (_providers[chainId] && rpcList.length > 1 && !_rpcValidated[chainId]) {
          _rpcValidated[chainId] = true; // mark immediately to prevent concurrent runs
          (async (cId, list) => {
            for (const rpc of list) {
              try {
                const _p = _makeProvider(rpc, cId);
                // Actually test the RPC — don't just create provider object (it never throws)
                await Promise.race([
                  _p.getBlockNumber(),
                  new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))
                ]);
                _providers[cId] = _p;
                return; // use first RPC that actually responds
              } catch { continue; }
            }
          })(chainId, rpcList);
        }
      }
      return _providers[chainId] || null;
    };
    const erc20Abi = ['function balanceOf(address) view returns (uint256)'];
    const walletAddrs = validatedKeys.map(k => { try { return new ethers.Wallet(k).address; } catch(e) { return null; } }).filter(Boolean);

    // Apply cached balance instantly (before any network call)
    // Build all possible wallet key suffixes to find balance in cache
    const _allBalKeySuffixes = (function() {
      var suffixes = new Set();
      if (_walletCacheKey) suffixes.add(_walletCacheKey);
      try {
        Object.keys(window._balanceCache || {}).forEach(function(k) {
          var parts = k.split(':');
          if (parts.length === 3) suffixes.add(parts[2]);
        });
      } catch(e) {}
      return Array.from(suffixes);
    })();

    filteredTokens.forEach(t => {
      const tChain = t.chainId || 8453;
      // Try all known suffixes to find cached balance
      var _cachedBal = undefined;
      for (var _si = 0; _si < _allBalKeySuffixes.length; _si++) {
        var _bck = t.id + ':' + tChain + ':' + _allBalKeySuffixes[_si];
        if (window._balanceCache[_bck] !== undefined) { _cachedBal = window._balanceCache[_bck]; break; }
      }
      if (_cachedBal === undefined) return;
      const card = document.getElementById('token-card-' + t.id);
      if (!card) return;
      const balEl = card.querySelector('.token-amount');
      const usdEl = card.querySelector('.token-usd');
      if (!balEl) return;
      const balStr = _cachedBal < 0.0001 ? (_cachedBal > 0 ? _cachedBal.toExponential(3) : '0') : _cachedBal.toLocaleString('en-US', {maximumFractionDigits:4});
      balEl.textContent = balStr;
      const _cachedPrice = (_globalPriceCache && _globalPriceCache[t.cgId]) ? _globalPriceCache[t.cgId].usd : 0;
      if (usdEl && _cachedBal > 0 && _cachedPrice > 0 && usdEl.dataset.toggled !== '1') {
        const _usdVal = _cachedBal * _cachedPrice;
        const _usdStr = _formatCurrencyDisplay(_usdVal);
        _smoothSet(usdEl, _usdStr);
        card.dataset.usdValue = _usdVal.toFixed(6);
      }
    });

    filteredTokens.forEach(t => {
      const tChain = t.chainId || 8453;
      // ── Chain-aware cache key: include chainId so switching chain triggers fresh fetch ──
      const _balCacheKey = t.id + ':' + tChain + ':' + _walletCacheKey;
      const _cachedBal = window._balanceCache[_balCacheKey];
      // No TTL — always fetch fresh balance from RPC
      // (cache is only used for instant display before RPC responds)

      let fetchPromise = null;
      const erc20Abi_local = ['function balanceOf(address) view returns (uint256)'];

      if (t.isNative) {
        // Native token: use _withRpcFallback for automatic failover
        // catch → null (not 0) so RPC failure does NOT overwrite cached balance
        fetchPromise = Promise.all(walletAddrs.map(addr =>
          _withRpcFallback(tChain, p => p.getBalance(addr).then(r => parseFloat(ethers.formatEther(r))), 5000)
            .catch(() => null)
        )).then(bals => {
          const valid = bals.filter(b => b !== null);
          return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) : null;
        });
      } else if (t.contract && t.contract.length > 10 && !t.contract.includes('...')) {
        // ERC20 token: use _withRpcFallback for automatic failover
        // catch → null (not 0) so RPC failure does NOT overwrite cached balance
        fetchPromise = Promise.all(walletAddrs.map(addr =>
          _withRpcFallback(tChain, p => {
            const ct = new ethers.Contract(t.contract, erc20Abi_local, p);
            return ct.balanceOf(addr).then(r => parseFloat(ethers.formatUnits(r, t.decimals || 18)));
          }, 5000).catch(() => null)
        )).then(bals => {
          const valid = bals.filter(b => b !== null);
          return valid.length > 0 ? valid.reduce((a, b) => a + b, 0) : null;
        });
      }

      if (fetchPromise) {
        _balFetchPromises.push(fetchPromise.catch(() => null));
        fetchPromise.then(balance => {
          if (_mySession !== _loadTokensSession) return;
          // null = RPC failed — keep existing cached balance, do NOT overwrite with 0
          if (balance === null || balance === undefined) return;

          // Save to balance cache (batch save happens after all tokens complete)
          window._balanceCache[_balCacheKey] = balance;
          window._balanceCacheTime[_balCacheKey] = Date.now();

          // ── Instantly reflect updated balance in bridge & swap token list ──
          if (typeof window._brSyncBalances === 'function') {
            clearTimeout(window._brSyncDebounce);
            window._brSyncDebounce = setTimeout(window._brSyncBalances, 0);
          }
          if (typeof window._swSyncTokenList === 'function') {
            clearTimeout(window._swSyncDebounce);
            window._swSyncDebounce = setTimeout(window._swSyncTokenList, 120);
          }

          const card = document.getElementById('token-card-' + t.id);
          if (!card) return;
          const balEl = card.querySelector('.token-amount');
          const usdEl = card.querySelector('.token-usd');
          if (!balEl) return;

          const balStr = balance < 0.0001
            ? (balance > 0 ? balance.toExponential(3) : '0')
            : balance.toLocaleString('en-US', {maximumFractionDigits:4});
          _smoothSet(balEl, balStr);

          // Compute USD using shared price map (populated when prices arrive)
          // Live price may not be in yet — fall back to the last known (cached) price so the card's
          // USD value (and so its position) doesn't collapse to 0 and bounce back when price arrives.
          const price = _sharedPriceMap[t.id]
            || ((_globalPriceCache && _globalPriceCache[t.cgId] && _globalPriceCache[t.cgId].usd) || 0)
            || t.price || 0;
          const usdValue = balance > 0 && price > 0 ? balance * price : 0;
          if (price > 0 || balance <= 0) card.dataset.usdValue = usdValue.toFixed(6);

          if (usdEl && price > 0) {
            const usdValStr = usdValue > 0 ? _formatCurrencyDisplay(usdValue) : '';
            _smoothSet(usdEl, usdValStr);
          }

          if (usdValue > 0 && _ltPriceDone) {
            // Only recalc total once price data is in — avoids stale intermediate values
            _recalcPortfolioTotal();
          }
          _debouncedSort();
          // Signal balance side done — coordinated save will fire when both price+balance complete
          _ltBalanceDone = true;
          _ltTrySave();
        }).catch(() => {});
      }
    });
  }

  // ── All balance fetches settled → release the hold, one final sort ──
  (function _watchAllBalances() {
    if (!_balFetchPromises.length) { _ltAllBalDone = true; return; }
    Promise.allSettled(_balFetchPromises).then(function() {
      if (_mySession !== _loadTokensSession) return;
      _ltAllBalDone = true;
      _debouncedSort();
    });
  })();

  // ── Coordinated save: fires once AFTER both price fetch AND all balance fetches complete ──
  // Prevents partial saves where price is fresh but balance isn't (or vice versa)
  let _ltBalanceDone = (validatedKeys.length === 0); // no wallets → balance side immediately done
  let _ltSaveTimer = null;
  function _ltTrySave() {
    if (!_ltPriceDone || !_ltBalanceDone) return;
    if (_ltSaveTimer) clearTimeout(_ltSaveTimer);
    _ltSaveTimer = setTimeout(function() {
      if (_mySession !== _loadTokensSession) return;
      if (typeof _saveBalanceCache === 'function') _saveBalanceCache();
      if (typeof window._onePTRSaveNow === 'function') window._onePTRSaveNow();
      // ── All balances fetched & saved — final definitive bridge & swap refresh ──
      if (typeof window._brSyncBalances === 'function') {
        clearTimeout(window._brSyncDebounce);
        window._brSyncDebounce = setTimeout(window._brSyncBalances, 0);
      }
      if (typeof window._swSyncTokenList === 'function') {
        clearTimeout(window._swSyncDebounce);
        window._swSyncDebounce = setTimeout(window._swSyncTokenList, 80);
      }
    }, 400);
  }

  // ── Price fetch (runs in parallel with balance fetch above) ──
  fetchAllPrices().then(async priceData => {
    if (!priceData) return;
    // Update home price source label
    _updateHomePriceSourceLabel(_lastPriceSource);

    // ── Fetch prices for tokens missing from priceData (no cgId or unrecognized) ──
    // Handles native tokens of custom chains that have cbPair but no cgId in the batch
    const missingTokens = filteredTokens.filter(t => !t.cgId || !priceData[t.cgId]);
    if (missingTokens.length > 0) {
      await Promise.allSettled(missingTokens.map(async t => {
        // Unverified contract token: its symbol is attacker-controlled text — price it by contract+chain
        // only, never by ticker (a scam token called "ETH" must not show ETH's price).
        if (!oneSymbolPriceAllowed(t)) {
          const cd = await _fetchPriceByContract(t);
          if (cd) priceData['__tid__' + t.id] = cd;
          return;
        }
        // 1. Try Coinbase first (fastest)
        if (t.cbPair) {
          try {
            const cbData = await fetchPriceCoinbase(t.cbPair);
            if (cbData && cbData.usd > 0) {
              const key = t.cgId || ('_cb_' + t.id);
              priceData[key] = cbData;
              priceData['__tid__' + t.id] = cbData;
              return;
            }
          } catch {}
        }
        // 2. Try CoinGecko by symbol search (for native tokens with no cgId)
        if (!t.cgId && t.sub) {
          try {
            const symLower = t.sub.toLowerCase();
            const cgSearchUrl = 'https://api.coingecko.com/api/v3/search?query=' + encodeURIComponent(symLower);
            const cgRes = await fetch(cgSearchUrl, { signal: AbortSignal.timeout(4000) });
            if (cgRes.ok) {
              const cgData = await cgRes.json();
              const match = (cgData.coins || []).find(c => c.symbol && c.symbol.toLowerCase() === symLower && c.market_cap_rank && c.market_cap_rank < 500);
              if (match && match.id) {
                const cgPriceUrl = 'https://api.coingecko.com/api/v3/simple/price?ids=' + encodeURIComponent(match.id) + '&vs_currencies=usd&include_24hr_change=true';
                const gpRes = await fetch(cgPriceUrl, { signal: AbortSignal.timeout(4000) });
                if (gpRes.ok) {
                  const gpData = await gpRes.json();
                  if (gpData[match.id] && gpData[match.id].usd > 0) {
                    priceData['__tid__' + t.id] = { usd: gpData[match.id].usd, usd_24h_change: gpData[match.id].usd_24h_change || 0 };
                    return;
                  }
                }
              }
            }
          } catch {}
        }
        // 3. Try DexScreener as last resort (good for small cap native tokens)
        if (t.chainId && t.sub) {
          try {
            const dsUrl = 'https://api.dexscreener.com/latest/dex/search?q=' + encodeURIComponent(t.sub);
            const dsRes = await fetch(dsUrl, { signal: AbortSignal.timeout(4000) });
            if (dsRes.ok) {
              const dsData = await dsRes.json();
              const pairs = (dsData.pairs || []).filter(p => p.chainId && p.baseToken && p.baseToken.symbol && p.baseToken.symbol.toUpperCase() === t.sub.toUpperCase() && p.priceUsd);
              // Sort by liquidity to get most reliable pair
              pairs.sort((a,b) => (parseFloat(b.liquidity?.usd||0)) - (parseFloat(a.liquidity?.usd||0)));
              if (pairs[0]) {
                const dsPrice = parseFloat(pairs[0].priceUsd);
                if (dsPrice > 0) {
                  priceData['__tid__' + t.id] = { usd: dsPrice, usd_24h_change: parseFloat(pairs[0].priceChange?.h24||0) };
                }
              }
            }
          } catch {}
        }
      }));
    }

    filteredTokens.forEach(t => {
      const card = document.getElementById('token-card-' + t.id);
      if (!card) return;
      // Try cgId first, then direct token-id fallback (for tokens fetched via cbPair)
      const pd = priceData[t.cgId] || priceData['__tid__' + t.id];
      if (!pd) {
        // Still no price — show '—' instead of 'Loading...'
        const lpEl = document.getElementById('tlp-' + t.id);
        if (lpEl) { const lpP = lpEl.querySelector('.tlp-price'); if (lpP && lpP.textContent === 'Loading…') lpP.textContent = '—'; }
        return;
      }
      const price = pd.usd || 0;
      _sharedPriceMap[t.id] = price;   // store for balance handler
      // ── Save price to token object in memory so swap/send sections can use it directly ──
      // This allows _getNativePrice() / _fetchTokenPrice() to find it without any API call
      if (price > 0) {
        t.price = price;
        // Also update globalPriceCache by symbol (for custom chains without cgId)
        // Symbol-keyed cache entries only from tokens whose ticker is trustworthy (else a scam "ETH" overwrites real ETH)
        if (t.sub && oneSymbolPriceAllowed(t) && typeof _globalPriceCache !== 'undefined' && _globalPriceCache) {
          _globalPriceCache[t.sub.toLowerCase()] = { usd: price, usd_24h_change: pd.usd_24h_change || 0 };
        }
      }
      const change24h = pd.usd_24h_change || 0;
      const _ch24b = (change24h == null || isNaN(change24h)) ? 0 : change24h;
      const pctSign = _ch24b >= 0 ? '+' : '';
      const pctColor = _ch24b > 0 ? 'var(--accent-green)' : _ch24b < 0 ? 'var(--accent-red)' : 'var(--text-muted)';
      const priceStr = _formatCurrencyDisplay(price);
      const balEl = card.querySelector('.token-amount');
      const balRaw = balEl ? parseFloat(balEl.textContent.replace(/,/g,'')) : NaN;
      const hasBalance = !isNaN(balRaw) && balRaw > 0;
      const usdValNum = hasBalance ? balRaw * price : 0;
      const usdValStr = hasBalance ? _formatCurrencyDisplay(usdValNum) : '';
      const usdEl = card.querySelector('.token-usd');
      if (usdEl) {
        _smoothSet(usdEl, usdValStr);
        // Green only when wallet has a real balance; muted when balance is 0
        usdEl.style.color = ''; usdEl.classList.toggle('has-balance', hasBalance);
      }
      // Update live price label (always visible, shows market price)
      const lpEl = document.getElementById('tlp-' + t.id);
      if (lpEl) {
        const lpPrice = lpEl.querySelector('.tlp-price');
        const lpChange = lpEl.querySelector('.tlp-change');
        if (lpPrice) _smoothSet(lpPrice, priceStr);
        if (lpChange) { lpChange.textContent = _ch24b !== 0 ? `${pctSign}${_ch24b.toFixed(2)}%` : ''; lpChange.style.color = pctColor; }
        lpEl.style.opacity = '1';
      }
      if (hasBalance) {
        card.dataset.usdValue = usdValNum.toFixed(6);
      } else {
        card.dataset.usdValue = '0';
      }
    });
    // Recalculate total from DOM after all tokens processed — single source of truth
    _recalcPortfolioTotal();
    _ltPriceDone = true;
    _debouncedSort();
    // Signal price side done — coordinated save will fire when both price+balance complete
    _ltPriceDone = true;
    _ltTrySave();
  }).catch(() => {});

}