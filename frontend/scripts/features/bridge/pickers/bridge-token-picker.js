  // ════════════════════════════════════════
  // TOKEN PICKER
  // ════════════════════════════════════════
  let brTokCache = {};

  async function brLoadTokens(side, chainId) {
    if (brTokCache[chainId]) {
      br.allTokens[side] = brTokCache[chainId];
      brRefreshTokenBtnLogo(side);
      return;
    }
    try {
      const r = await _brProxyFetch(`${LIFI_API}/tokens?chains=${chainId}`, { headers: { 'x-lifi-api-key': 'b3e55edd-de70-4578-b761-cd2aac0fbae0.685a5adf-2580-486e-a8ff-1df4992b3f2e' } });
      const d = await r.json();
      const toks = (d.tokens && d.tokens[chainId]) || [];
      brTokCache[chainId] = toks;
      br.allTokens[side] = toks;
      brRefreshTokenBtnLogo(side);
      // Warn if LiFi has no tokens for this chain (likely unsupported)
      if (toks.length === 0) {
        const chainName = side === 'from' ? br.fromChain.name : br.toChain.name;
        const warnEl = $e('br-quote-error');
        if (warnEl) {
          warnEl.textContent = `⚠️ "${chainName}" is not supported by LiFi bridge/swap. Use a preset chain (Base, ETH, Arbitrum, Polygon) for routing.`;
          warnEl.style.display = 'block';
        }
      }
    } catch {}
  }

  // After token list loads, update current token button logo from the fetched list
  function brRefreshTokenBtnLogo(side) {
    const cur = side === "from" ? br.fromToken : br.toToken;
    const toks = br.allTokens[side] || [];
    const match = toks.find(t => t.address.toLowerCase() === cur.address.toLowerCase() && t.symbol === cur.symbol);
    if (match && match.logoURI) {
      if (side === "from") br.fromToken = { ...cur, logoURI: match.logoURI };
      else                 br.toToken   = { ...cur, logoURI: match.logoURI };
      brUpdateTokenBtn(side);
    }
  }

  window.tokenIconHTML = tokenIconHTML;
  window.brUpdateTokenBtn = brUpdateTokenBtn;
  window.brLoadTokens = brLoadTokens;
  window.brFetchFromBalance = brFetchFromBalance;
  window._brShowCachedBalance = _brShowCachedBalance;

  // ── Global hook: called whenever _balanceCache is updated (home fetch, send, etc.) ──
  // Instantly refreshes bridge FROM/TO balance display without any RPC call
  window._brSyncBalances = function() {
    try {
      if (typeof brUpdateTokenBtn === 'function') {
        brUpdateTokenBtn('from');
        brUpdateTokenBtn('to');
      }
    } catch(_e) {}
  };
  window.brOpenTokenPicker = async function (target) {
    br.pickerTarget = target;
    const side = target;
    const chainId = side === 'from' ? br.fromChain.id : br.toChain.id;
    const chainName = side === 'from' ? br.fromChain.name : br.toChain.name;
    const listEl = $e('br-token-list');
    if (listEl) listEl.innerHTML = '<div class="sw-tp-empty">Loading…</div>';
    const _lbl = $e('br-tp-label');
    if (_lbl) _lbl.textContent = chainName ? ('All tokens on ' + chainName) : 'All tokens';
    $e('br-token-search').value = '';
    $e('br-token-overlay').classList.add('open');
    haptic && haptic();
    if (!br.allTokens[side]?.length) await brLoadTokens(side, chainId);
    brRenderTokenList(br.allTokens[side] || [], side);
  };

  function brRenderTokenList(tokens, side) {
    const listEl = $e('br-token-list');
    if (listEl) listEl.innerHTML = '';
    const curAddr = (side === 'from' ? br.fromToken : br.toToken).address.toLowerCase();
    if (!tokens.length) {
      if (listEl) listEl.innerHTML = '<div class="sw-tp-empty">No tokens found</div>';
      return;
    }

    // ── Build balance lookup from home _balanceCache ──
    const _bc      = window._balanceCache || {};
    const _tc      = typeof TOKEN_CONFIG !== 'undefined' ? TOKEN_CONFIG : [];
    const _gc      = typeof _globalPriceCache !== 'undefined' ? _globalPriceCache : {};
    // ── Use bridge sender key first (wallet change aware), fallback to homeActiveKey ──
    const _brKey   = (side === 'from')
      ? (br.senderKey || '')
      : '';
    const _wSuffix = _brKey
      ? String(_brKey).slice(-8)
      : ((typeof homeActiveKey !== 'undefined' && homeActiveKey) ? homeActiveKey.slice(-8) : '');
    const _pickChainId = side === 'from' ? br.fromChain.id : br.toChain.id;

    const _getCachedBal = function(sym) {
      const _tDef = _tc.find(function(t) {
        return (t.sub || '').toUpperCase() === sym.toUpperCase() && (t.chainId || 8453) === _pickChainId;
      });
      if (!_tDef) return null;
      if (!_wSuffix) return null; // no wallet suffix → can't safely identify balance
      const _exact = _tDef.id + ':' + _pickChainId + ':' + _wSuffix;
      if (_bc[_exact] !== undefined) return parseFloat(_bc[_exact]);
      // suffix-safe prefix scan — only match keys ending in correct suffix
      const _pfx  = _tDef.id + ':' + _pickChainId + ':';
      const _sfxEnd = ':' + _wSuffix;
      const _aKey = Object.keys(_bc).find(function(k) { return k.startsWith(_pfx) && k.endsWith(_sfxEnd); });
      return _aKey !== undefined ? parseFloat(_bc[_aKey]) : null;
    };

    const _getPrice = function(sym, fallbackPrice) {
      if (fallbackPrice && fallbackPrice > 0) return fallbackPrice;
      const _tDef = _tc.find(function(t) { return (t.sub || '').toUpperCase() === sym.toUpperCase(); });
      if (_tDef && _tDef.cgId && _gc[_tDef.cgId] && _gc[_tDef.cgId].usd) return _gc[_tDef.cgId].usd;
      return 0;
    };

    const _fmtBal = function(b) {
      if (b <= 0)       return '0';
      if (b < 0.000001) return b.toExponential(2);
      if (b < 0.01)     return b.toFixed(6);
      if (b < 1000)     return b.toFixed(4);
      return b.toLocaleString('en-US', { maximumFractionDigits: 2 });
    };

    const _sortedTokens = tokens.slice(0, 80).sort((a, b) => {
      const balA = _getCachedBal(a.symbol || '');
      const balB = _getCachedBal(b.symbol || '');
      const hasA = balA !== null && !isNaN(balA) && balA > 0;
      const hasB = balB !== null && !isNaN(balB) && balB > 0;
      if (hasA && !hasB) return -1;
      if (!hasA && hasB) return 1;
      if (hasA && hasB) {
        const priceA = _getPrice(a.symbol || '', parseFloat(a.priceUSD || 0));
        const priceB = _getPrice(b.symbol || '', parseFloat(b.priceUSD || 0));
        return (balB * priceB) - (balA * priceA);
      }
      return 0;
    });

    _sortedTokens.forEach(tok => {
      const active = tok.address.toLowerCase() === curAddr;
      const sym    = tok.symbol || '?';
      const bal    = _getCachedBal(sym);
      const price  = _getPrice(sym, parseFloat(tok.priceUSD || 0));
      const hasBal = bal !== null && !isNaN(bal) && bal > 0;
      const usdVal = hasBal && price > 0 ? bal * price : 0;

      // Row is built with DOM calls (textContent), so token names coming from the API or a contract can never inject markup
      const item = document.createElement('div');
      item.className = 'sw-tp-row' + (active ? ' sel' : '');

      const ico = document.createElement('div');
      ico.className = 'sw-tp-ico';
      const _letter = String(sym).charAt(0).toUpperCase();
      if (tok.logoURI) {
        const img = document.createElement('img');
        img.alt = '';
        img.loading = 'lazy';
        img.onerror = function () { img.remove(); ico.textContent = _letter; };
        img.src = tok.logoURI;
        ico.appendChild(img);
      } else {
        ico.textContent = _letter;
      }

      const main = document.createElement('div');
      main.className = 'sw-tp-row-main';
      const symEl = document.createElement('div');
      symEl.className = 'sw-tp-sym';
      symEl.textContent = sym;
      const nameEl = document.createElement('div');
      nameEl.className = 'sw-tp-name';
      nameEl.textContent = tok.name || '';
      main.appendChild(symEl);
      main.appendChild(nameEl);

      item.appendChild(ico);
      item.appendChild(main);

      if (hasBal) {
        const right = document.createElement('div');
        right.className = 'sw-tp-right';
        const balEl = document.createElement('div');
        balEl.className = 'sw-tp-bal has';
        balEl.textContent = _fmtBal(bal);
        const usdEl = document.createElement('div');
        usdEl.className = 'sw-tp-usd has';
        usdEl.textContent = _formatCurrencyDisplay(usdVal);
        right.appendChild(balEl);
        right.appendChild(usdEl);
        item.appendChild(right);
      }
      if (active) {
        const chk = document.createElement('span');
        chk.className = 'material-icons-round sw-tp-check';
        chk.textContent = 'check';
        item.appendChild(chk);
      }
      item.addEventListener('click', () => {
        // Resolve live price from cache, fallback to tok.priceUSD
        let _pickPrice = parseFloat(tok.priceUSD || 0);
        try {
          const _tcP = typeof TOKEN_CONFIG !== 'undefined' ? TOKEN_CONFIG : [];
          const _chainIdP = side === 'from' ? br.fromChain.id : br.toChain.id;
          let _tDefP = _tcP.find(t => (t.contract||'').toLowerCase() === tok.address.toLowerCase() && (t.chainId||8453) === _chainIdP);
          if (!_tDefP) _tDefP = _tcP.find(t => (t.sub||'').toUpperCase() === (tok.symbol||'').toUpperCase());
          if (_tDefP && typeof _globalPriceCache !== 'undefined' && _globalPriceCache && _tDefP.cgId) {
            const _pdP = _globalPriceCache[_tDefP.cgId];
            if (_pdP && _pdP.usd) _pickPrice = _pdP.usd;
          }
        } catch(_eP) {}
        const newTok = { symbol: tok.symbol, address: tok.address, decimals: tok.decimals||18, priceUSD: _pickPrice, logoURI: tok.logoURI||'' };
        if (side === 'from') {
          // Same token on same chain in TO box → swap them
          const sameChain = br.fromChain.id === br.toChain.id;
          if (sameChain && br.toToken && br.toToken.address.toLowerCase() === tok.address.toLowerCase()) {
            const tmp = br.toToken;
            br.toToken = br.fromToken;
            br.fromToken = newTok;
            brUpdateTokenBtn('to');
          } else {
            br.fromToken = newTok;
          }
        } else {
          // Same token on same chain in FROM box → swap them
          const sameChain = br.fromChain.id === br.toChain.id;
          if (sameChain && br.fromToken && br.fromToken.address.toLowerCase() === tok.address.toLowerCase()) {
            const tmp = br.fromToken;
            br.fromToken = br.toToken;
            br.toToken = newTok;
            brUpdateTokenBtn('from');
          } else {
            br.toToken = newTok;
          }
        }
        brUpdateTokenBtn(side);
        brResetRoutes();
        brCloseTokenPicker();
        haptic && haptic();
        const amt = parseFloat($e('br-from-amount').value);
        // ── Refresh FROM USD display immediately whenever token changes ──
        if (typeof brOnAmountChange === 'function') brOnAmountChange();
        if (amt > 0) setTimeout(() => brFetchRoutes(), 300);
      });
      listEl.appendChild(item);
    });
  }

  window.brFilterTokens = async function () {
    const raw  = $e('br-token-search').value.trim();
    const q    = raw.toLowerCase();
    const side = br.pickerTarget;
    const toks = br.allTokens[side] || [];

    if (!q) { brRenderTokenList(toks, side); return; }

    // Standard symbol/name/partial-address filter
    const filtered = toks.filter(t =>
      t.symbol.toLowerCase().includes(q) ||
      (t.name || '').toLowerCase().includes(q) ||
      t.address.toLowerCase().includes(q)
    );

    // Contract address lookup (0x + 40 hex chars)
    const _isAddr = /^0x[0-9a-f]{40}$/i.test(raw);
    if (_isAddr && !filtered.length) {
      const listEl = $e('br-token-list');
      if (listEl) listEl.innerHTML = '<div class="sw-tp-empty" style="display:flex;flex-direction:column;align-items:center;gap:8px;"><span class="material-icons-round" style="font-size:20px;animation:spin 0.8s linear infinite;color:var(--accent-primary);">sync</span>Looking up contract…</div>';

      const chainId = side === 'from' ? br.fromChain.id : br.toChain.id;
      let found = null;

      // 1. Check already-loaded list by exact address
      found = toks.find(t => t.address.toLowerCase() === q) || null;

      // 2. LiFi /token API
      if (!found) {
        try {
          const _r = await _brProxyFetch(`${LIFI_API}/token?chain=${chainId}&token=${raw}`, { headers: { 'x-lifi-api-key': 'b3e55edd-de70-4578-b761-cd2aac0fbae0.685a5adf-2580-486e-a8ff-1df4992b3f2e' } });
          if (_r.ok) {
            const _d = await _r.json();
            if (_d && _d.address) found = { symbol: _d.symbol || '?', name: _d.name || '', address: _d.address, decimals: _d.decimals || 18, priceUSD: parseFloat(_d.priceUSD || 0), logoURI: _d.logoURI || '' };
          }
        } catch(_e) {}
      }

      // 3. RPC fallback - read name/symbol/decimals from contract
      if (!found) {
        try {
          const _abi = ['function symbol() view returns (string)', 'function name() view returns (string)', 'function decimals() view returns (uint8)'];
          const _con = await _withRpcFallback(chainId, _p => {
            const c = new ethers.Contract(raw, _abi, _p);
            return Promise.all([c.symbol(), c.name(), c.decimals()]);
          }, 5000);
          if (_con && _con[0]) found = { symbol: _con[0], name: _con[1] || '', address: raw, decimals: Number(_con[2]) || 18, priceUSD: 0, logoURI: '' };
        } catch(_e) {}
      }

      if (found) {
        brRenderTokenList([found], side);
      } else {
        if (listEl) listEl.innerHTML = '<div class="sw-tp-empty" style="color:var(--accent-red);">Token not found on this chain</div>';
      }
      return;
    }

    brRenderTokenList(filtered, side);
  };

  window.brPasteTokenSearch = async function () {
    const inp = $e('br-token-search');
    if (!inp) return;
    try {
      const txt = await navigator.clipboard.readText();
      if (txt) { inp.value = txt.trim(); brFilterTokens(); return; }
    } catch (_e) {}
    inp.focus();
  };

  window.brCloseTokenPicker = function () {
    // Drop the keyboard if the search box still has focus
    try { const _ae = document.activeElement; if (_ae && _ae.id === 'br-token-search') _ae.blur(); } catch (_e) {}
    $e('br-token-overlay').classList.remove('open');
  };

