// ── Token-decimal-aware balance formatter ──
// Shows appropriate precision based on how many decimals the token actually has.
// e.g. USDC (6 dec): shows up to 6 places; WBTC (8 dec): up to 8; ETH (18 dec): up to 6
function _swFmtBal(val, tokenDecimals) {
  if (!isFinite(val) || val == null) return '0';
  const maxDec = Math.min(tokenDecimals != null ? tokenDecimals : 18, 8); // cap UI at 8 digits
  if (val === 0) return '0';
  if (val >= 1000)  return val.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:Math.min(2, maxDec)});
  if (val >= 1)     return parseFloat(val.toFixed(Math.min(4, maxDec))).toString();
  if (val >= 0.001) return parseFloat(val.toFixed(Math.min(6, maxDec))).toString();
  return parseFloat(val.toFixed(Math.min(8, maxDec))).toString();
}

function _nxsw_swUpdateBalances() {
  const fb = document.getElementById('sw-from-bal');
  const tb = document.getElementById('sw-to-bal');

  if (!SW.walletConnected || !SW.walletAddress) {
    if (fb) fb.textContent = '—';
    if (tb) tb.textContent = '—';
    return;
  }

  // ── Try home _balanceCache first (instant, no RPC) ──
  _swFetchRealBalances();
}

function _swFetchRealBalances() {
  const _cache  = window._balanceCache || {};
  const chainId = SW.network ? SW.network.chainId : 8453;

  // ── Find the correct cache key suffix for the Swap wallet ──
  // The balance cache key is: tokenId:chainId:walletKey.slice(-8)
  // Home saves balance using homeActiveKey or _currentWalletKey suffix.
  // Swap may use a DIFFERENT wallet (SW.walletPK), so we must find its suffix
  // by scanning validatedKeys (all home wallets) for address match.
  function _getSuffix() {
    const _swAddr = SW.walletAddress ? SW.walletAddress.toLowerCase() : null;
    if (!_swAddr) return '';

    // 1. Check all Home wallet keys (validatedKeys) for address match
    const _vKeys = (typeof validatedKeys !== 'undefined' && Array.isArray(validatedKeys)) ? validatedKeys : [];
    for (const k of _vKeys) {
      try {
        const addr = new ethers.Wallet(k).address.toLowerCase();
        if (addr === _swAddr) return k.slice(-8);
      } catch(_e) {}
    }

    // 2. Scan all cache keys — find a suffix that belongs to this address
    // by checking all wallet groups
    try {
      const _groups = (typeof loadWalletGroups === 'function') ? loadWalletGroups() : [];
      for (const g of _groups) {
        for (const k of (g.keys || [])) {
          try {
            const addr = new ethers.Wallet(k).address.toLowerCase();
            if (addr === _swAddr) return k.slice(-8);
          } catch(_e) {}
        }
      }
    } catch(_e) {}

    // 3. SW.walletPK direct fallback
    if (SW.walletPK) return String(SW.walletPK).slice(-8);

    // 4. homeActiveKey last resort
    const _hk = (typeof homeActiveKey !== 'undefined' ? homeActiveKey : null)
               || (() => { try { return _oneGetSelectedKey(); } catch(e) { return null; } })();
    return _hk ? String(_hk).slice(-8) : '';
  }

  const _swWkSuffix = _getSuffix();

  function _getHomeBal(token) {
    if (!token) return undefined;
    if (!_swWkSuffix) return undefined; // no suffix = unknown wallet, don't guess
    const ids = [token.id, token.sym, token.symbol].filter(Boolean);

    // 1. Exact key match (fast path)
    for (const id of ids) {
      const key = id + ':' + chainId + ':' + _swWkSuffix;
      if (_cache[key] !== undefined) return _cache[key];
      const keyLegacy = id + ':' + _swWkSuffix;
      if (_cache[keyLegacy] !== undefined) return _cache[keyLegacy];
    }

    // 2. Wallet-specific suffix scan — handles token id case mismatches (e.g. 'eth' vs 'ETH')
    // ONLY looks at cache keys ending with THIS wallet's suffix — never returns another wallet's balance
    const suffixPattern = ':' + _swWkSuffix;
    const idsLower = ids.map(function(x) { return x.toLowerCase(); });
    for (var _ck in _cache) {
      if (!_ck.endsWith(suffixPattern)) continue; // must belong to this exact wallet
      var _parts = _ck.split(':');
      if (_parts.length < 3) continue;
      var cachedChain = _parts[_parts.length - 2]; // chainId is second-to-last
      if (String(cachedChain) !== String(chainId)) continue; // must match chain
      var cachedId = _parts[0].toLowerCase();
      if (idsLower.indexOf(cachedId) !== -1 && _cache[_ck] !== undefined) return _cache[_ck];
    }

    // 3. Check localStorage for this wallet's own saved balance cache
    // (home clears in-memory cache on wallet switch, but localStorage still has the data)
    try {
      var _lsRaw = localStorage.getItem('one_bal_cache_' + _swWkSuffix);
      if (_lsRaw) {
        var _lsData = JSON.parse(_lsRaw);
        if (_lsData && _lsData.cache && true /* no expiry */) {
          var _lsCache = _lsData.cache;
          // Exact match in localStorage cache
          for (var _ii = 0; _ii < ids.length; _ii++) {
            var _lsKey = ids[_ii] + ':' + chainId + ':' + _swWkSuffix;
            if (_lsCache[_lsKey] !== undefined) {
              window._balanceCache[_lsKey] = _lsCache[_lsKey]; // warm in-memory cache
              return _lsCache[_lsKey];
            }
            var _lsLegacy = ids[_ii] + ':' + _swWkSuffix;
            if (_lsCache[_lsLegacy] !== undefined) {
              window._balanceCache[_lsLegacy] = _lsCache[_lsLegacy];
              return _lsCache[_lsLegacy];
            }
          }
          // Case-insensitive scan inside localStorage cache (token id case mismatch)
          var _lsSuffix = ':' + _swWkSuffix;
          var _lsIdsLow = ids.map(function(x) { return x.toLowerCase(); });
          for (var _lsK in _lsCache) {
            if (!_lsK.endsWith(_lsSuffix)) continue;
            var _lsParts = _lsK.split(':');
            if (_lsParts.length < 3) continue;
            if (String(_lsParts[_lsParts.length - 2]) !== String(chainId)) continue;
            if (_lsIdsLow.indexOf(_lsParts[0].toLowerCase()) !== -1 && _lsCache[_lsK] !== undefined) {
              window._balanceCache[_lsK] = _lsCache[_lsK]; // warm in-memory cache
              return _lsCache[_lsK];
            }
          }
        }
      }
    } catch(_lsE) {}

    return undefined; // truly not cached for this wallet on this chain -> will trigger live RPC
  }

  // ── Parse cached balance value to float ──
  function _parseBal(v) {
    if (v === undefined || v === null) return undefined;
    const n = parseFloat(v);
    return isNaN(n) ? undefined : n;
  }

  const fromBal = _parseBal(_getHomeBal(SW.fromToken));
  const toBal   = _parseBal(_getHomeBal(SW.toToken));

  const fb = document.getElementById('sw-from-bal');
  const tb = document.getElementById('sw-to-bal');

  // ── FROM token balance ──
  if (SW.fromToken) {
    if (fromBal !== undefined) {
      // ✅ Cache hit — show instantly, NO RPC call
      SW.fromToken.balance = fromBal;
      if (fb) {
        fb.textContent = _swFmtBal(fromBal, SW.fromToken.decimals) + ' ' + SW.fromToken.sym;
        fb.style.color = 'var(--text-secondary)';
      }
    } else if (SW.fromToken.balance !== undefined && SW.fromToken.balance >= 0) {
      // Already has balance on the token object (e.g. from tas-swap-btn)
      if (fb) {
        fb.textContent = _swFmtBal(SW.fromToken.balance, SW.fromToken.decimals) + ' ' + SW.fromToken.sym;
        fb.style.color = 'var(--text-secondary)';
      }
    } else {
      // Cache miss — show '—', let user click to refresh (no auto RPC)
      if (fb) { fb.textContent = '—'; fb.style.color = 'var(--text-muted)'; }
    }
  }

  // ── TO token balance ──
  if (SW.toToken) {
    if (toBal !== undefined) {
      // ✅ Cache hit — show instantly, NO RPC call
      SW.toToken.balance = toBal;
      if (tb) {
        tb.textContent = _swFmtBal(toBal, SW.toToken.decimals) + ' ' + SW.toToken.sym;
        tb.style.color = 'var(--text-secondary)';
      }
    } else if (SW.toToken.balance !== undefined && SW.toToken.balance >= 0) {
      if (tb) {
        tb.textContent = _swFmtBal(SW.toToken.balance, SW.toToken.decimals) + ' ' + SW.toToken.sym;
        tb.style.color = 'var(--text-secondary)';
      }
    } else {
      if (tb) { tb.textContent = '—'; tb.style.color = 'var(--text-muted)'; }
    }
  }

  if (typeof swUpdateButton === 'function') swUpdateButton();
}

// ── Live RPC balance fetch for the TO token ──
async function _swFetchToBalanceLive() {
  const chainId    = SW.network?.chainId;
  const walletAddr = SW.walletAddress;
  const token      = SW.toToken;
  if (!walletAddr || !token || !chainId || typeof ethers === 'undefined') return;

  const tbEl = document.getElementById('sw-to-bal');

  try {
    const contract = token.contract || token.address || '';
    const isNative = !contract || /^0x0+$/.test(contract)
      || contract.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
      || token.sym === (typeof nativeSym !== 'undefined' ? nativeSym : '');

    let bal = 0;
    if (isNative) {
      const raw = await _nxsw__swWithFallback(chainId, _p => _p.getBalance(walletAddr));
      bal = parseFloat(ethers.formatEther(raw));
    } else {
      const ERC20_ABI = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'];
      const dec = token.decimals !== undefined ? token.decimals
        : await _nxsw__swWithFallback(chainId, _p => new ethers.Contract(contract, ERC20_ABI, _p).decimals()).catch(() => 18);
      const raw = await _nxsw__swWithFallback(chainId, _p => new ethers.Contract(contract, ERC20_ABI, _p).balanceOf(walletAddr));
      bal = parseFloat(ethers.formatUnits(raw, dec));
    }

    // Stale check — wallet or chain changed mid-flight
    if (SW.walletAddress !== walletAddr || SW.network?.chainId !== chainId) return;

    SW.toToken.balance = bal;
    if (tbEl) {
      tbEl.textContent = bal.toFixed(4) + ' ' + token.sym;
      tbEl.style.color = 'var(--accent-green)';
      setTimeout(() => { if (tbEl) tbEl.style.color = 'var(--text-secondary)'; }, 1200);
    }
  } catch(e) {
    console.warn('[One] Live TO bal fetch failed:', e.message);
    if (tbEl) {
      tbEl.textContent = (SW.toToken && SW.toToken.balance > 0 ? SW.toToken.balance.toFixed(4) + ' ' + token.sym : '—');
      tbEl.style.color = 'var(--text-secondary)';
    }
  }
}

