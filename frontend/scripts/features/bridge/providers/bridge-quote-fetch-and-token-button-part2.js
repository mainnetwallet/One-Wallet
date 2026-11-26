
  // ── Instant home balance update after bridge/swap success ──
  function _brUpdateHomeBalanceAfterSuccess() {
    try {
      const _fAmtRaw  = document.getElementById('br-from-amount') ? document.getElementById('br-from-amount').value : '0';
      const _fAmt     = parseFloat(_fAmtRaw) || 0;
      const _fromSym  = br.fromToken && br.fromToken.symbol;
      const _toSym    = br.toToken   && br.toToken.symbol;
      const _fChainId = br.fromChain && br.fromChain.id;
      const _tChainId = br.toChain   && br.toChain.id;
      const _isSame   = _fChainId && _tChainId && _fChainId === _tChainId;
      const _tc       = typeof TOKEN_CONFIG !== 'undefined' ? TOKEN_CONFIG : [];
      const _bc       = window._balanceCache;
      if (!_bc) return;
      if (!window._balanceCacheTime) window._balanceCacheTime = {};

      const _wSuffix = (typeof homeActiveKey !== 'undefined' && homeActiveKey) ? homeActiveKey.slice(-8) : '';

      // ── Helper: find existing cache key or build one ──
      const _getCacheKey = function(sym, chainId) {
        const _t = _tc.find(function(t){ return (t.sub||'').toUpperCase() === sym.toUpperCase() && (t.chainId||8453) === chainId; });
        if (!_t) return null;
        const _exact = _t.id + ':' + chainId + ':' + _wSuffix;
        if (_bc[_exact] !== undefined) return _exact;
        const _pfx = _t.id + ':' + chainId + ':';
        return Object.keys(_bc).find(function(k){ return k.startsWith(_pfx); }) || _exact;
      };

      // ── Helper: get estimated received amount from selected route ──
      const _getToAmt = function() {
        try {
          const _rt = br.routes && br.selectedRoute !== null ? br.routes[br.selectedRoute] : null;
          const _raw = _rt && _rt.estimate && (_rt.estimate.toAmount || _rt.estimate.toAmountMin);
          if (!_raw) return 0;
          const _dec = (br.toToken && br.toToken.decimals) || 18;
          return parseFloat(ethers.formatUnits(_raw.toString(), _dec)) || 0;
        } catch(_e) { return 0; }
      };

      // ── 1. Deduct FROM balance in cache ──
      if (_fromSym && _fAmt > 0 && _fChainId) {
        const _fKey = _getCacheKey(_fromSym, _fChainId);
        if (_fKey) {
          const _cur = parseFloat(_bc[_fKey] || 0);
          _bc[_fKey] = String(Math.max(0, _cur - _fAmt));
          window._balanceCacheTime[_fKey] = Date.now();
        }
      }

      // ── 2. Add TO balance in cache (same-chain swap: immediate; cross-chain: optimistic) ──
      const _toAmt = _getToAmt();
      if (_toSym && _toAmt > 0 && _tChainId) {
        const _tKey = _getCacheKey(_toSym, _tChainId);
        if (_tKey) {
          const _curTo = parseFloat(_bc[_tKey] || 0);
          _bc[_tKey] = String(_curTo + _toAmt);
          window._balanceCacheTime[_tKey] = Date.now();
        }
      }

      // ── 3. Update home token card DOM immediately (FROM + TO) ──
      const _allTks = (typeof getTokens === 'function') ? getTokens() : [];
      const _updateCard = function(sym, newBal, flash) {
        if (!sym || isNaN(newBal)) return;
        document.querySelectorAll('.token-card').forEach(function(card) {
          const symEl = card.querySelector('.token-name');
          if (!symEl || symEl.textContent.trim() !== sym) return;
          const amtEl = card.querySelector('.token-amount');
          if (amtEl) {
            amtEl.textContent = newBal >= 1000 ? newBal.toLocaleString('en-US',{maximumFractionDigits:2})
                              : newBal >= 0.01  ? newBal.toFixed(4)
                              : newBal.toFixed(6);
            if (flash) {
              amtEl.style.transition = 'color 0.3s';
              amtEl.style.color = flash;
              setTimeout(function(){ amtEl.style.color = ''; }, 1400);
            }
          }
          const usdEl = card.querySelector('.token-usd');
          if (usdEl) {
            try {
              const _tk = _allTks.find(function(t){ return t.sym === sym; });
              if (_tk && _tk.price > 0 && usdEl.dataset.toggled !== '1') { _smoothSet(usdEl, _formatCurrencyDisplay(newBal * _tk.price)); }
            } catch(_e) {}
          }
        });
      };

      if (_fromSym && _fAmt > 0 && _fChainId) {
        const _fKey2 = _getCacheKey(_fromSym, _fChainId);
        if (_fKey2 && _bc[_fKey2] !== undefined) _updateCard(_fromSym, parseFloat(_bc[_fKey2]), 'var(--accent-red)');
      }
      if (_toSym && _toAmt > 0 && _tChainId) {
        const _tKey2 = _getCacheKey(_toSym, _tChainId);
        if (_tKey2 && _bc[_tKey2] !== undefined) _updateCard(_toSym, parseFloat(_bc[_tKey2]), 'var(--accent-green)');
      }

      // ── 4. Recalculate portfolio total instantly from updated cache ──
      try {
        let _newTotal = 0;
        const _activeChain = typeof activeHomeChainId !== 'undefined' ? activeHomeChainId : null;
        _tc.forEach(function(t) {
          if (_activeChain !== null && _activeChain !== 'all' && t.chainId !== _activeChain) return;
          const _k = _getCacheKey(t.sub, t.chainId || 8453);
          if (!_k) return;
          const _b = parseFloat(_bc[_k] || 0);
          if (!_b) return;
          const _tk = _allTks.find(function(x){ return x.sym === t.sub && (!t.chainId || x.chainId === t.chainId); })
                   || _allTks.find(function(x){ return x.sym === t.sub; });
          if (_tk && _tk.price > 0) _newTotal += _b * _tk.price;
        });
        if (_newTotal > 0) {
          window._portfolioTotalUsd = _newTotal;
          if (typeof updatePortfolioTotal === 'function') updatePortfolioTotal();
        }
      } catch(_pe) {}

      // ── 5. Refresh bridge section balance rows instantly (no RPC) ──
      setTimeout(function(){
        if (typeof _brShowCachedBalance === 'function') {
          _brShowCachedBalance('from');
          _brShowCachedBalance('to');
        }
        // ── Re-render token modal if currently open ──
        try {
          const _overlay = document.getElementById('br-token-overlay');
          if (_overlay && _overlay.classList.contains('open') && typeof brRenderTokenList === 'function') {
            const _side = br.pickerTarget || 'from';
            const _toks = br.allTokens && br.allTokens[_side] ? br.allTokens[_side] : [];
            if (_toks.length) brRenderTokenList(_toks, _side);
          }
        } catch(_me) {}
      }, 100);

      // ── 6. Re-render home token list immediately from updated cache (no RPC) ──
      setTimeout(function(){
        if (typeof loadTokens === 'function') loadTokens();
      }, 150);

      // ── 7. Full background RPC refresh after 8s (blockchain confirms settle) ──
      setTimeout(function(){
        if (typeof loadTokens === 'function') loadTokens();
        if (typeof silentPriceRefresh === 'function') silentPriceRefresh();
      }, 8000);
    } catch(_e) {}
  }

  async function brFetchFromBalance() {
    if (!br.senderAddr) {
      // Wallet disconnected — keep rows visible but reset values
      brUpdateSliderUI(0);
      return;
    }
    // Always show balance row when sender is connected
    var _brRow = $e('br-from-balance-row');
    if (_brRow) _brRow.style.display = 'flex';
    // Always show slider row when sender is connected
    var _brPctRowInit = document.getElementById('br-pct-row');
    if (_brPctRowInit) _brPctRowInit.style.display = 'flex';
    const myId = ++brBalFetchId;
    const tok     = br.fromToken;
    const chainId = br.fromChain.id;
    const rpcEntry = BR_CHAIN_RPC[chainId];

    // ── Show cached balance instantly (uses robust _brShowCachedBalance) ──
    _brShowCachedBalance('from');

    const valEl  = $e('br-from-balance-val');
    const rowEl  = $e('br-from-balance-row');
    const maxBtn = $e('br-bal-max-btn');
    const icon   = $e('br-bal-status-icon');

    // ── Check if Home section already has a fresh balance — skip RPC if yes ──
    (function() {
      try {
        const _hCache     = window._balanceCache || {};
        const _hCacheTime = window._balanceCacheTime || {};
        const _hAddr      = (br.senderAddr || '').toLowerCase();
        const _hSuffix    = _hAddr ? _hAddr.slice(-8) : (br.senderKey ? String(br.senderKey).slice(-8) : '');
        if (!_hSuffix) return; // no wallet — RPC needed
        const _hChainId   = br.fromChain.id;
        const _hTok       = br.fromToken;
        const _hTokSym    = (_hTok.symbol || _hTok.sym || '').toUpperCase();
        const _hTokAddr   = (_hTok.address || '').toLowerCase();
        const _hTTL       = (typeof _BAL_CACHE_TTL !== 'undefined') ? _BAL_CACHE_TTL : 5 * 60 * 1000;

        // Build candidate cache keys (same order as _brShowCachedBalance Step 3)
        const _hIds = [];
        if (typeof TOKEN_CONFIG !== 'undefined') {
          const _htDef = TOKEN_CONFIG.find(function(t) {
            return ((t.contract || '').toLowerCase() === _hTokAddr && (t.chainId || 8453) === _hChainId)
                || ((t.sub || '').toUpperCase() === _hTokSym && (t.chainId || 8453) === _hChainId);
          });
          if (_htDef) { [_htDef.id, _htDef.sub].filter(Boolean).forEach(function(x){ _hIds.push(x); }); }
        }
        [_hTok.id, _hTok.symbol, _hTok.sym].filter(Boolean).forEach(function(x){ if (_hIds.indexOf(x) === -1) _hIds.push(x); });

        const _sfxPat = ':' + _hSuffix;
        let _hBal = undefined, _hBalTime = 0;

        // Exact key
        for (var _hi = 0; _hi < _hIds.length; _hi++) {
          var _hk1 = _hIds[_hi] + ':' + _hChainId + ':' + _hSuffix;
          if (_hCache[_hk1] !== undefined) { _hBal = parseFloat(_hCache[_hk1]); _hBalTime = _hCacheTime[_hk1] || 0; break; }
          var _hk2 = _hIds[_hi] + ':' + _hSuffix;
          if (_hCache[_hk2] !== undefined) { _hBal = parseFloat(_hCache[_hk2]); _hBalTime = _hCacheTime[_hk2] || 0; break; }
        }
        // Suffix scan fallback
        if (_hBal === undefined) {
          const _hIdsLow = _hIds.map(function(x){ return x.toLowerCase(); });
          for (var _hck in _hCache) {
            if (!_hck.endsWith(_sfxPat)) continue;
            var _hParts = _hck.split(':');
            if (_hParts.length < 3) continue;
            if (String(_hParts[_hParts.length - 2]) !== String(_hChainId)) continue;
            if (_hIdsLow.indexOf(_hParts[0].toLowerCase()) !== -1 && _hCache[_hck] !== undefined) {
              _hBal = parseFloat(_hCache[_hck]); _hBalTime = _hCacheTime[_hck] || 0; break;
            }
          }
        }

        // Fresh cache hit → set br._fromBalance and return early (no RPC needed)
        if (_hBal !== undefined && !isNaN(_hBal) && true /* no expiry — always use cached balance */) {
          br._fromBalance = _hBal;
          brFetchFromBalance._homeHit = myId; // signal to skip RPC below
        }
      } catch(_hE) { /* ignore — fall through to RPC */ }
    })();

    // ── If Home balance was fresh, skip RPC entirely ──
    if (brFetchFromBalance._homeHit === myId) {
      brFetchFromBalance._homeHit = null;
      return;
    }

    // ── Show spinning loader while fetching via RPC ──
    // If cached balance already shown, just spin the icon — don't hide balance text
    if (valEl) {
      const _existingIcon = valEl.querySelector('.material-icons-round');
      if (_existingIcon) {
        _existingIcon.textContent = 'sync';
        _existingIcon.style.color = 'var(--accent-primary)';
        _existingIcon.style.animation = 'spin 0.8s linear infinite';
        _existingIcon.style.display = 'inline-block';
      } else {
        valEl.innerHTML = '<span class="material-icons-round" style="font-size:11px;color:var(--accent-primary);pointer-events:none;display:inline-block;animation:spin 0.8s linear infinite;vertical-align:middle;">sync</span>';
        valEl.style.color = 'var(--text-muted)';
      }
    }

    const rpcs = Array.isArray(rpcEntry) ? rpcEntry.slice() : (rpcEntry ? [rpcEntry] : []);
    // Include custom RPCs from RPC Manager (one_custom_rpcs_v1)
    try {
      const _cs = JSON.parse(localStorage.getItem('one_custom_rpcs_v1') || '{}');
      const _ce = _cs[chainId];
      if (_ce) {
        if (_ce.defaultRpc && !rpcs.includes(_ce.defaultRpc)) rpcs.unshift(_ce.defaultRpc);
        (_ce.rpcs || []).forEach(r => { if (r && !rpcs.includes(r)) rpcs.push(r); });
      }
    } catch(_) {}
    const _brGcr = (window.getChainRpcs && window.getChainRpcs.__rpcPatched) ? window.getChainRpcs : (typeof getChainRpcs === 'function' ? getChainRpcs : null);
    if (_brGcr) {
      _brGcr(chainId).forEach(r => { if (!rpcs.includes(r)) rpcs.push(r); });
    }
    if (rpcs.length === 0) {
      const _customChain = (typeof getAllChains === "function") ? getAllChains().find(c => c.chainId === chainId) : null;
      if (_customChain) {
        const _r = _customChain.rpcs || _customChain.rpc;
        const _rList = Array.isArray(_r) ? _r : (_r ? [_r] : []);
        _rList.filter(Boolean).forEach(x => rpcs.push(x));
      }
    }
    if (rpcs.length === 0) {
      if (valEl) valEl.textContent = 'RPC unavailable';
      return;
    }

    // Use _withRpcFallback for automatic RPC failover
    let provider = null;
    try {
      provider = await _withRpcFallback(chainId, async (p) => {
        await Promise.race([p.getBlockNumber(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000))]);
        return p;
      }, 3000);
    } catch {
      if (valEl) valEl.textContent = 'RPC unavailable';
      return;
    }
    if (!provider) {
      if (valEl) valEl.textContent = 'RPC unavailable';
      return;
    }

    try {
      let rawBal;
      let decimals = tok.decimals || 18;

      const isNative = tok.address.toLowerCase() === BR_ZERO_ADDR ||
                       tok.address.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
      if (isNative) {
        rawBal = await _withRpcFallback(chainId, _p => _p.getBalance(br.senderAddr), 5000);
      } else {
        rawBal = await _withRpcFallback(chainId, _p => new ethers.Contract(tok.address, BR_ERC20_ABI, _p).balanceOf(br.senderAddr), 5000);
      }

      if (myId !== brBalFetchId) return; // stale, discard

      const formatted = parseFloat(ethers.formatUnits(rawBal, decimals));
      br._fromBalance = formatted; // store for MAX button

      // ── helper: update inline button balance display ──
      const _updateInlineBtn = function(bal, priceUSD) {
        const _wrap = document.getElementById('br-from-token-bal-wrap');
        const _bal  = document.getElementById('br-from-token-bal');
        const _usd  = document.getElementById('br-from-token-usd');
        if (!_wrap || !_bal || !_usd) return;
        if (bal <= 0) { _wrap.style.display = 'none'; return; }
        _wrap.style.display = 'block';
        const _disp = bal < 0.000001 ? bal.toExponential(2)
                    : bal < 0.01     ? bal.toFixed(6)
                    : bal < 1000     ? bal.toFixed(4)
                                     : bal.toLocaleString('en-US',{maximumFractionDigits:2});
        _bal.textContent  = _disp;
        _bal.style.color  = 'var(--text-primary)';
        if (priceUSD > 0) {
          const _usdVal = bal * priceUSD;
          _usd.textContent = _formatCurrencyDisplay(_usdVal);
          _usd.style.color = 'var(--accent-green)';
        } else {
          _usd.textContent = '$0.00';
          _usd.style.color = 'var(--text-muted)';
        }
      };

      // ── get price for this token ──
      let _livePrice = tok.priceUSD || 0;
      try {
        const _tc2 = typeof TOKEN_CONFIG !== 'undefined' ? TOKEN_CONFIG : [];
        const _tDef2 = _tc2.find(function(t){ return (t.sub||'').toUpperCase() === tok.symbol.toUpperCase(); });
        if (_tDef2 && typeof _globalPriceCache !== 'undefined' && _globalPriceCache && _tDef2.cgId) {
          const _pd2 = _globalPriceCache[_tDef2.cgId];
          if (_pd2 && _pd2.usd) _livePrice = _pd2.usd;
        }
      } catch(_pe2) {}

      if (formatted === 0) {
        if (valEl) {
          valEl.innerHTML = '0 ' + tok.symbol + '&nbsp;<span class="material-icons-round" style="font-size:11px;color:var(--text-muted);pointer-events:none;">refresh</span>';
          valEl.style.color = 'var(--accent-red)';
        }
        var _pctRowZ = document.getElementById('br-pct-row');
        if (_pctRowZ) _pctRowZ.style.display = 'flex';
        _updateInlineBtn(0, 0);
      } else {
        const display = formatted < 0.000001 ? formatted.toExponential(2) :
                        formatted < 0.01      ? formatted.toFixed(6)      :
                        formatted < 1000      ? formatted.toFixed(4)      :
                                                formatted.toFixed(2);
        if (valEl) {
          valEl.innerHTML = display + ' ' + tok.symbol + '&nbsp;<span class="material-icons-round" style="font-size:11px;color:rgba(16,185,129,0.6);pointer-events:none;">refresh</span>';
          valEl.style.color = 'var(--accent-green)';
        }
        var _pctRowY = document.getElementById('br-pct-row');
        if (_pctRowY) _pctRowY.style.display = 'flex';
        // Also show the balance row itself in case it was hidden
        if (rowEl) rowEl.style.display = 'flex';
        br._fromBalance = formatted;
        brUpdateSliderUI(0);
        _updateInlineBtn(formatted, _livePrice);
      }
    } catch (err) {
      if (myId !== brBalFetchId) return;
      if (valEl) { valEl.innerHTML = 'Fetch failed&nbsp;<span class="material-icons-round" style="font-size:11px;color:var(--accent-red);pointer-events:none;">refresh</span>'; valEl.style.color = 'var(--accent-red)'; }
    }
  }

  window.brSetMaxBalance = function () {
    if (br._fromBalance === null || br._fromBalance === undefined) return;
    const inputEl = $e('br-from-amount');
    inputEl.value = parseFloat(br._fromBalance.toFixed(8)).toString();
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    brUpdateSliderUI(100);
    haptic && haptic();
  };

  // ── Slider input handler ──
  window.brOnSliderInput = function(val) {
    val = Math.max(0, Math.min(100, parseInt(val) || 0));
    // Always update UI immediately so label/fill track the thumb
    brUpdateSliderUI(val);
    // Then attempt to update the amount (requires balance to be loaded)
    brSetPct(val);
  };

  // ── Percentage / slider amount setter ──
  window.brSetPct = function (pct) {
    if (br._fromBalance === null || br._fromBalance === undefined) return;
    pct = Math.max(0, Math.min(100, parseInt(pct) || 0));
    const inputEl = $e('br-from-amount');
    let amount = br._fromBalance * (pct / 100);

    // Native token MAX: reserve gas so TX doesn't fail due to insufficient funds
    // Reserve ~0.001 ETH equivalent (covers most chains); skip for ERC-20 tokens
    const _zeroAddr = '0x0000000000000000000000000000000000000000';
    const _isNative = !br.fromToken || !br.fromToken.address ||
      br.fromToken.address.toLowerCase() === _zeroAddr ||
      br.fromToken.address.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    if (pct === 100 && _isNative && amount > 0.002) {
      // Gas reserve: 0.001 for most chains, slightly more for mainnet ETH
      const _gasRes = (br.fromChain && br.fromChain.id === 1) ? 0.003 : 0.001;
      amount = Math.max(0, amount - _gasRes);
    }

    inputEl.value = pct === 0 ? '' : parseFloat(amount.toFixed(8)).toString();
    brUpdateSliderUI(pct);
    // Trigger amount change — clears routes if 0, fetches if > 0
    br._fromSlider = true;
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    br._fromSlider = false;
    haptic && haptic();
  };

  window.brUpdateSliderUI = function brUpdateSliderUI(pct) {
    pct = Math.max(0, Math.min(100, parseInt(pct) || 0));
    var slider = document.getElementById('br-pct-slider');
    var fill   = document.getElementById('br-slider-track-fill');
    var label  = document.getElementById('br-pct-label');
    var maxBtn = document.getElementById('br-pct-100');
    if (slider) slider.value = pct;
    if (fill) {
      // Thumb is 22px wide — compensate so fill aligns with thumb center
      var thumbW = 22;
      var trackW = slider ? slider.offsetWidth : (fill.parentElement ? fill.parentElement.offsetWidth : 0);
      if (trackW > 0) {
        var fillPx = (pct / 100) * (trackW - thumbW) + thumbW / 2;
        fill.style.width = fillPx + 'px';
      } else {
        fill.style.width = pct + '%';
      }
    }
    if (label)  label.textContent = pct + '%';
    if (maxBtn) {
      if (pct === 100) {
        maxBtn.style.background = 'rgba(99,102,241,0.25)';
        maxBtn.style.borderColor = 'rgba(99,102,241,0.7)';
      } else {
        maxBtn.style.background = 'rgba(99,102,241,0.07)';
        maxBtn.style.borderColor = 'rgba(99,102,241,0.35)';
      }
    }
  }

  function brHighlightPct(activePct) {
    // no-op — slider handles its own UI via brUpdateSliderUI
  }

  // ── Force RPC refresh on tap of balance value ──
  window.brForceRefreshBalance = async function () {
    const valEl = document.getElementById('br-from-balance-val');
    if (!br.fromToken || !br.fromChain) return;
    haptic && haptic();
    // Show loading state — preserve inner icon span
    const _prevHTML = valEl ? valEl.innerHTML : '';
    if (valEl) {
      valEl.innerHTML = '&#8203;…&nbsp;<span class="material-icons-round" style="font-size:11px;color:var(--accent-primary);animation:spin 0.8s linear infinite;display:inline-block;pointer-events:none;">refresh</span>';
      valEl.style.color = 'var(--accent-primary)';
    }
    br._fromBalance = null;
    await brFetchFromBalance();
    // Restore icon if fetch didn't update the element
    if (valEl && valEl.innerHTML.includes('&#8203;…')) {
      valEl.innerHTML = _prevHTML || '—&nbsp;<span class="material-icons-round" style="font-size:11px;color:var(--text-muted);pointer-events:none;">refresh</span>';
      valEl.style.color = 'var(--text-secondary)';
    }
  };

  function brUpdateTokenBtn(side) {
    const tok = side === 'from' ? br.fromToken : br.toToken;
    $e(`br-${side}-token-sym`).textContent = tok.symbol || '?';
    $e(`br-${side}-token-icon`).innerHTML  = tokenIconHTML(tok, 20);
    // Show home _balanceCache balance instantly (no RPC needed)
    _brShowCachedBalance(side);
  }