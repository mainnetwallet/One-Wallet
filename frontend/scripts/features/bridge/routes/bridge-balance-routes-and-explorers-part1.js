

  // ── Show balance from home _balanceCache for bridge (same logic as swap) ──
  function _brShowCachedBalance(side) {
    try {
      const tok     = side === 'from' ? br.fromToken : br.toToken;
      const chainId = side === 'from' ? br.fromChain.id : br.toChain.id;

      const rowId  = side === 'from' ? 'br-from-balance-row' : 'br-to-balance-row';
      const valId  = side === 'from' ? 'br-from-balance-val' : 'br-to-balance-val';
      const maxId  = side === 'from' ? 'br-bal-max-btn'      : null;
      const iconId = side === 'from' ? 'br-bal-status-icon'  : null;
      const wrapId = side === 'from' ? 'br-from-token-bal-wrap' : 'br-to-token-bal-wrap';
      const balId  = side === 'from' ? 'br-from-token-bal'      : 'br-to-token-bal';
      const usdId  = side === 'from' ? 'br-from-token-usd'      : 'br-to-token-usd';

      if (!tok || !tok.symbol) return;

      const _cache   = window._balanceCache || {};
      const _tc      = typeof TOKEN_CONFIG !== 'undefined' ? TOKEN_CONFIG : [];

      // ── Step 1: resolve correct wallet suffix ──
      // FROM side → sender wallet, TO side → recipient wallet (fallback to sender if same)
      function _brGetSuffix(targetAddr) {
        const _addr = (targetAddr || '').toLowerCase();
        if (!_addr) return '';

        // Try matching against all home wallet keys (validatedKeys)
        const _vKeys = (typeof validatedKeys !== 'undefined' && Array.isArray(validatedKeys)) ? validatedKeys : [];
        for (const k of _vKeys) {
          try {
            if (new ethers.Wallet(k).address.toLowerCase() === _addr) return k.slice(-8);
          } catch(_e) {}
        }

        // Try all wallet groups
        try {
          const _groups = (typeof loadWalletGroups === 'function') ? loadWalletGroups()
                        : (typeof loadGroups === 'function') ? loadGroups() : [];
          for (const g of _groups) {
            for (const k of (g.keys || [])) {
              try {
                if (new ethers.Wallet(k).address.toLowerCase() === _addr) return k.slice(-8);
              } catch(_e) {}
            }
          }
        } catch(_e) {}

        return '';
      }

      // Pick the right address for each side
      // TO side: only show balance if recipient is one of our own wallets (= sender, or another known wallet)
      // If recipient is an external address, we won't have its balance cached
      const _senderAddr    = br.senderAddr || '';
      const _recipientAddr = br.recipientAddr || ''; // empty = same as sender
      const _targetAddr    = side === 'to'
        ? (_recipientAddr || _senderAddr)  // TO → custom recipient first, fallback sender
        : _senderAddr;                     // FROM → sender always

      let _suffix = _brGetSuffix(_targetAddr);

      // Fallback chain for FROM side only
      if (!_suffix && side === 'from') {
        if (br.senderKey) _suffix = String(br.senderKey).slice(-8);
        if (!_suffix) {
          const _hk = (typeof homeActiveKey !== 'undefined' && homeActiveKey) ? homeActiveKey : null;
          _suffix = _hk ? String(_hk).slice(-8) : '';
        }
      }
      // TO side with external recipient → show row but display dash (we don't know their balance)
      if (!_suffix && side === 'to') {
        const _rowExt = document.getElementById(rowId);
        if (_rowExt) _rowExt.style.display = 'flex';
        const _valExt = document.getElementById(valId);
        if (_valExt) { _valExt.textContent = '—'; _valExt.style.color = 'var(--text-muted)'; }
        return;
      }

      // ── Step 2: find TOKEN_CONFIG entry (by address first, then symbol) ──
      const _tokAddrLow = (tok.address || '').toLowerCase();
      const _tokSym     = (tok.symbol || tok.sym || '').toUpperCase();
      let _tDef = null;

      if (_tokAddrLow) {
        _tDef = _tc.find(function(t) {
          return (t.contract || '').toLowerCase() === _tokAddrLow && (t.chainId || 8453) === chainId;
        });
      }
      if (!_tDef) {
        _tDef = _tc.find(function(t) {
          return (t.sub || '').toUpperCase() === _tokSym && (t.chainId || 8453) === chainId;
        });
      }

      const ids = _tDef
        ? [_tDef.id, _tDef.sub, tok.id, tok.symbol, tok.sym].filter(Boolean)
        : [tok.id, tok.symbol, tok.sym].filter(Boolean);

      // ── Step 3: look up cache — exact suffix match only (never return another wallet's balance) ──
      let bal = undefined;

      if (_suffix) {
        const _sfxPattern = ':' + _suffix;

        // 3a. Exact key match
        for (const id of ids) {
          const k = id + ':' + chainId + ':' + _suffix;
          if (_cache[k] !== undefined) { bal = parseFloat(_cache[k]); break; }
          const kLeg = id + ':' + _suffix;
          if (_cache[kLeg] !== undefined) { bal = parseFloat(_cache[kLeg]); break; }
        }

        // 3b. Case-insensitive suffix scan
        if (bal === undefined) {
          const _idsLow = ids.map(function(x) { return x.toLowerCase(); });
          for (const _ck in _cache) {
            if (!_ck.endsWith(_sfxPattern)) continue;
            const _parts = _ck.split(':');
            if (_parts.length < 3) continue;
            if (String(_parts[_parts.length - 2]) !== String(chainId)) continue;
            if (_idsLow.indexOf(_parts[0].toLowerCase()) !== -1 && _cache[_ck] !== undefined) {
              bal = parseFloat(_cache[_ck]); break;
            }
          }
        }

        // 3c. localStorage fallback (same as swap — handles page-refresh case)
        if (bal === undefined) {
          try {
            const _lsRaw = localStorage.getItem('one_bal_cache_' + _suffix);
            if (_lsRaw) {
              const _lsData = JSON.parse(_lsRaw);
              if (_lsData && _lsData.cache && true /* no expiry */) {
                const _lsC = _lsData.cache;
                for (const id of ids) {
                  const _lsKey = id + ':' + chainId + ':' + _suffix;
                  if (_lsC[_lsKey] !== undefined) {
                    window._balanceCache[_lsKey] = _lsC[_lsKey]; // warm in-memory
                    bal = parseFloat(_lsC[_lsKey]); break;
                  }
                }
                if (bal === undefined) {
                  const _lsSfx = ':' + _suffix;
                  const _idsLow2 = ids.map(function(x) { return x.toLowerCase(); });
                  for (const _lsK in _lsC) {
                    if (!_lsK.endsWith(_lsSfx)) continue;
                    const _lsParts = _lsK.split(':');
                    if (_lsParts.length < 3) continue;
                    if (String(_lsParts[_lsParts.length - 2]) !== String(chainId)) continue;
                    if (_idsLow2.indexOf(_lsParts[0].toLowerCase()) !== -1 && _lsC[_lsK] !== undefined) {
                      window._balanceCache[_lsK] = _lsC[_lsK];
                      bal = parseFloat(_lsC[_lsK]); break;
                    }
                  }
                }
              }
            }
          } catch(_lsE) {}
        }
      }

      // ── Step 4: get price ──
      let price = 0;
      try {
        if (_tDef && typeof _globalPriceCache !== 'undefined' && _globalPriceCache && _tDef.cgId) {
          const _pd = _globalPriceCache[_tDef.cgId];
          if (_pd && _pd.usd) price = _pd.usd;
        }
        if (!price && tok.priceUSD) price = tok.priceUSD;
      } catch(_pe) {}

      // ── Step 5: format ──
      const _fmtBal = function(b) {
        if (b <= 0)       return '0';
        if (b < 0.000001) return b.toExponential(2);
        if (b < 0.01)     return b.toFixed(6);
        if (b < 1000)     return b.toFixed(4);
        return b.toLocaleString('en-US', { maximumFractionDigits: 2 });
      };

      const _hasBal = bal !== undefined && !isNaN(bal);

      // ── Step 6: update inline token-button balance ──
      const wrapEl = document.getElementById(wrapId);
      const balEl  = document.getElementById(balId);
      const usdEl  = document.getElementById(usdId);
      if (wrapEl && balEl && usdEl) {
        if (_hasBal) {
          wrapEl.style.display = 'block';
          balEl.textContent    = _fmtBal(bal);
          balEl.style.color    = bal > 0 ? 'var(--text-primary)' : 'var(--text-muted)';
          if (price > 0 && bal > 0) {
            const usdVal = bal * price;
            usdEl.textContent = _formatCurrencyDisplay(usdVal);
            usdEl.style.color = ''; usdEl.classList.add('has-balance');
          } else {
            usdEl.textContent = '$0.00';
            usdEl.style.color = ''; usdEl.classList.remove('has-balance');
          }
        } else {
          wrapEl.style.display = 'none';
        }
      }

      // ── Step 7: update legacy FROM balance row ──
      // Always show row when sender wallet is connected — cache miss shows "—" (tap to refresh via RPC)
      const rowEl = document.getElementById(rowId);
      const legEl = document.getElementById(valId);
      const _hasWallet = side === 'from' ? !!br.senderAddr : !!br.recipientAddr || !!br.senderAddr;
      if (rowEl && _hasWallet) {
        rowEl.style.display = 'flex';
        if (legEl) {
          if (_hasBal) {
            // Show real balance — plain text is fine here (no inner icon needed)
            legEl.innerHTML = _fmtBal(bal) + ' ' + _tokSym + '&nbsp;<span class="material-icons-round" style="font-size:11px;color:' + (bal > 0 ? 'rgba(16,185,129,0.5)' : 'var(--text-muted)') + ';pointer-events:none;">refresh</span>';
            legEl.style.color = bal > 0 ? 'var(--accent-green)' : 'var(--text-secondary)';
          } else {
            // No cache — show "—" + refresh icon so user knows to tap for RPC fetch
            legEl.innerHTML = '\u2014&nbsp;<span class="material-icons-round" style="font-size:11px;color:var(--text-muted);pointer-events:none;">refresh</span>';
            legEl.style.color = 'var(--text-muted)';
          }
        }
        if (iconId) {
          const _ico = document.getElementById(iconId);
          if (_ico) {
            _ico.textContent = _hasBal && bal > 0 ? 'account_balance_wallet' : (_hasBal ? 'warning' : 'refresh');
            _ico.style.color  = _hasBal && bal > 0 ? 'var(--accent-primary)' : 'var(--text-muted)';
          }
        }
        if (maxId) {
          const _max = document.getElementById(maxId);
          if (_max) _max.style.display = (_hasBal && bal > 0) ? 'block' : 'none';
          if (_hasBal && bal > 0) br._fromBalance = bal;
          else if (_hasBal) br._fromBalance = 0; // zero balance — allow slider to show 0
        }
        // ── Show / hide slider row ──
        if (side === 'from') {
          const _pctRow = document.getElementById('br-pct-row');
          if (_pctRow) _pctRow.style.display = 'flex';
        }
      } else {
        // No wallet connected — keep row visible, reset balance display
        const _noWalBal = document.getElementById('br-from-balance-val');
        if (_noWalBal && side === 'from') {
          _noWalBal.innerHTML = '—&nbsp;<span class="material-icons-round" style="font-size:10px;color:var(--text-muted);pointer-events:none;">refresh</span>';
          _noWalBal.style.color = 'var(--text-secondary)';
        }
      }

      // ── Auto RPC fetch on cache miss (FROM side only) ──
      // Rules: (1) only 1 fetch per unique chain+token+wallet key
      //        (2) while fetch is in progress, _brShowCachedBalance must NOT re-trigger
      //        (3) on RPC fail, _withRpcFallback handles fallback automatically
      //        (4) 60s cooldown after a completed fetch cycle (success or all-fail)
      if (!_hasBal && side === 'from' && br.senderAddr && br.fromToken && br.fromChain) {
        // Skip entirely if a fetch is already running (prevents loop: brFetchFromBalance → _brShowCachedBalance → trigger again)
        if (!window._brAutoFetchInProgress) {
          if (!window._brRpcFetchCooldown) window._brRpcFetchCooldown = {};
          if (!window._brRpcFetchTimer)    window._brRpcFetchTimer    = {};
          const _autoKey = br.fromChain.id + ':' + (br.fromToken.address || br.fromToken.symbol).toLowerCase() + ':' + br.senderAddr.toLowerCase();
          const _lastFetch   = window._brRpcFetchCooldown[_autoKey] || 0;
          const _timerActive = !!window._brRpcFetchTimer[_autoKey];
          // Skip if cooldown (60s) or timer already pending
          if (!_timerActive && (Date.now() - _lastFetch) > 60000) {
            window._brRpcFetchTimer[_autoKey] = setTimeout(async function() {
              window._brRpcFetchTimer[_autoKey] = null;
              // Guard: still no balance and context unchanged?
              if (window._brAutoFetchInProgress) return;
              const _curKey = (br.fromChain && br.fromToken && br.senderAddr)
                ? br.fromChain.id + ':' + (br.fromToken.address || br.fromToken.symbol).toLowerCase() + ':' + br.senderAddr.toLowerCase()
                : null;
              if (_curKey !== _autoKey) return; // token/chain switched while waiting — skip
              // Set cooldown + in-progress flag BEFORE any async work
              window._brRpcFetchCooldown[_autoKey] = Date.now();
              window._brAutoFetchInProgress = true;
              // ── Show spinning loader (keep balance if already shown) ──
              const _valElLoad = document.getElementById('br-from-balance-val');
              if (_valElLoad) {
                const _eIcon = _valElLoad.querySelector('.material-icons-round');
                if (_eIcon) {
                  _eIcon.textContent = 'sync';
                  _eIcon.style.color = 'var(--accent-primary)';
                  _eIcon.style.animation = 'spin 0.8s linear infinite';
                  _eIcon.style.display = 'inline-block';
                } else {
                  _valElLoad.innerHTML = '<span class="material-icons-round" style="font-size:11px;color:var(--accent-primary);pointer-events:none;display:inline-block;animation:spin 0.8s linear infinite;vertical-align:middle;">sync</span>';
                  _valElLoad.style.color = 'var(--text-muted)';
                }
              }
              try {
                // Direct RPC call with fallback — 1 success = done, auto fallback on fail
                const _cid  = br.fromChain.id;
                const _tok  = br.fromToken;
                const _addr = br.senderAddr;
                const _isNative = (_tok.address || '').toLowerCase() === '0x0000000000000000000000000000000000000000'
                               || (_tok.address || '').toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
                const _dec = _tok.decimals || 18;
                let _raw;
                if (_isNative) {
                  _raw = await _withRpcFallback(_cid, _p => _p.getBalance(_addr), 5000);
                } else {
                  const _erc20Abi = ['function balanceOf(address) view returns (uint256)'];
                  _raw = await _withRpcFallback(_cid, _p => new ethers.Contract(_tok.address, _erc20Abi, _p).balanceOf(_addr), 5000);
                }
                const _fmt = parseFloat(ethers.formatUnits(_raw, _dec));
                br._fromBalance = _fmt;
                // Write into balance cache so _brShowCachedBalance finds it instantly next time
                const _sfx = _addr.slice(-8).toLowerCase();
                const _cacheKey = (_tok.symbol || _tok.sym || 'NATIVE').toUpperCase() + ':' + _cid + ':' + _sfx;
                if (!window._balanceCache) window._balanceCache = {};
                window._balanceCache[_cacheKey] = _fmt;
                // Update UI directly — one clean call, no recursion risk
                const _valEl = document.getElementById('br-from-balance-val');
                const _rowEl = document.getElementById('br-from-balance-row');
                if (_rowEl) _rowEl.style.display = 'flex';
                if (_valEl) {
                  if (_fmt > 0) {
                    const _d = _fmt < 0.000001 ? _fmt.toExponential(2) : _fmt < 0.01 ? _fmt.toFixed(6) : _fmt < 1000 ? _fmt.toFixed(4) : _fmt.toFixed(2);
                    _valEl.innerHTML = _d + ' ' + (_tok.symbol || '') + '&nbsp;<span class="material-icons-round" style="font-size:11px;color:rgba(16,185,129,0.6);pointer-events:none;">refresh</span>';
                    _valEl.style.color = 'var(--accent-green)';
                    const _pctRow = document.getElementById('br-pct-row');
                    if (_pctRow) _pctRow.style.display = 'flex';
                    const _maxBtn = document.getElementById('br-bal-max-btn');
                    if (_maxBtn) _maxBtn.style.display = 'block';
                  } else {
                    _valEl.innerHTML = '0 ' + (_tok.symbol || '') + '&nbsp;<span class="material-icons-round" style="font-size:11px;color:var(--text-muted);pointer-events:none;">refresh</span>';
                    _valEl.style.color = 'var(--accent-red)';
                    const _pctRowZ2 = document.getElementById('br-pct-row');
                    if (_pctRowZ2) _pctRowZ2.style.display = 'flex';
                  }
                }
              } catch(_autoE) {
                // All RPCs failed — show tap-to-retry state, do NOT loop
                const _valEl = document.getElementById('br-from-balance-val');
                if (_valEl) {
                  _valEl.innerHTML = '—&nbsp;<span class="material-icons-round" style="font-size:11px;color:var(--accent-red);pointer-events:none;">refresh</span>';
                  _valEl.style.color = 'var(--accent-red)';
                }
              } finally {
                window._brAutoFetchInProgress = false;
              }
            }, 800);
          }
        }
      }
    } catch(_e) {}
  }

  // ── Auto-restore bridge sender wallet after page refresh ──
  var _BR_DEFAULT_ADDR_PREFIX = '0x394f';
  var _BR_DEFAULT_ADDR_SUFFIX = '3bbc';
  (function _brRestoreSenderOnLoad() {
    async function _doRestore() {
      try {
        // ── If user explicitly disconnected, leave box empty ──
        var _disconnected = false;
        try { _disconnected = !!localStorage.getItem('one_br_disconnected'); } catch(_) {}
        if (_disconnected) return;

        // 1. Try localStorage saved wallet first
        var saved = JSON.parse(localStorage.getItem('one_br_sender') || 'null');
        // AES decrypt encPk if present
        // NOTE: do NOT delete one_br_sender on decrypt failure here —
        // OneCrypto may not be ready yet (before PIN unlock).
        // switchPage('bridge') will properly restore once crypto is ready.
        if (saved && saved.addr && saved.encPk) {
          try {
            var _dp = await OneCrypto.decrypt(saved.encPk);
            if (_dp) { saved.pk = _dp; } else { saved = null; } // skip, don't delete
          } catch(_) { saved = null; } // skip, don't delete
        } else if (saved && saved.pk && !saved.encPk) {
          // Legacy plaintext — re-encrypt and resave
          try {
            var _reEncR = await OneCrypto.encrypt(saved.pk);
            localStorage.setItem('one_br_sender', JSON.stringify({ addr: saved.addr, encPk: _reEncR }));
          } catch(_) {}
        }
        if (saved && saved.addr && saved.pk) {
          try { var nv = saved.pk.startsWith('0x') ? saved.pk : '0x' + saved.pk; new ethers.Wallet(nv); } catch(_) { saved = null; } // skip, don't delete
        }
        if (saved && saved.addr && saved.pk) {
          br.senderAddr = saved.addr;
          br.senderKey  = saved.pk;
          brUpdateSenderRow();
          _brShowCachedBalance('from');
          return;
        }
        // 2. Fallback: scan wallet groups for address 0x394f...3bbc
        // Only runs if user has NOT explicitly disconnected
        var groups = (typeof loadGroups === 'function' ? loadGroups() : []);
        for (var gi = 0; gi < groups.length; gi++) {
          var keys = groups[gi].keys || [];
          for (var ki = 0; ki < keys.length; ki++) {
            try {
              var pk = keys[ki];
              var nn = pk.startsWith('0x') ? pk : '0x' + pk;
              var wallet = new ethers.Wallet(nn);
              var addr = wallet.address;
              if (addr.toLowerCase().startsWith(_BR_DEFAULT_ADDR_PREFIX) && addr.toLowerCase().endsWith(_BR_DEFAULT_ADDR_SUFFIX)) {
                br.senderAddr = addr;
                br.senderKey  = pk;
                try {
                  var _encFb = await OneCrypto.encrypt(pk);
                  localStorage.setItem('one_br_sender', JSON.stringify({ addr: addr, encPk: _encFb }));
                } catch(_) {}
                brUpdateSenderRow();
                _brShowCachedBalance('from');
                return;
              }
            } catch(_) {}
          }
        }
      } catch(_) {}
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() { setTimeout(_doRestore, 400); });
    } else {
      setTimeout(_doRestore, 400);
    }
  })();

  // ── Update sender row ──
  function brUpdateSenderRow() {
    const el   = $e('br-sender-addr');
    const btn  = document.getElementById('br-connect-btn');
    const lbl  = document.getElementById('br-connect-label');
    const addr = document.getElementById('br-connect-addr');
    const ico  = document.getElementById('br-connect-icon');
    if (br.senderAddr) {
      const short = br.senderAddr.slice(0,6) + '…' + br.senderAddr.slice(-4);
      if (el)   { el.textContent = short; el.style.color = 'var(--accent-primary)'; }
      if (lbl)  { lbl.textContent = 'Connected'; lbl.style.color = 'var(--text-primary)'; }
      if (addr) { addr.textContent = short; addr.style.display = 'block'; }
      if (ico)  { ico.style.color = 'var(--accent-green)'; ico.textContent = 'check_circle'; }
      if (btn)  { btn.style.border = '1px solid rgba(16,185,129,0.4)'; btn.style.background = 'rgba(16,185,129,0.08)'; }
    } else {
      if (el)   { el.textContent = 'Tap to select wallet'; el.style.color = 'var(--text-secondary)'; }
      if (lbl)  { lbl.textContent = 'Connect'; lbl.style.color = 'var(--text-primary)'; }
      if (addr) { addr.textContent = ''; addr.style.display = 'none'; }
      if (ico)  { ico.style.color = 'var(--accent-primary)'; ico.textContent = 'account_balance_wallet'; }
      if (btn)  { btn.style.border = '1px solid var(--border-subtle)'; btn.style.background = 'var(--bg-glass)'; }
    }
  }
  window.brUpdateSenderRow = brUpdateSenderRow;

  // ── Amount debounce ──
  window.brOnAmountChange = function () {
    clearTimeout(br.quoteDebounce);
    const val = parseFloat($e('br-from-amount').value);
    // Reset slider when user types manually (not when triggered from slider pct)
    if (!br._fromSlider) brUpdateSliderUI(0);
    // If input cleared, also reset pct label explicitly
    if (!$e('br-from-amount').value || $e('br-from-amount').value === '') {
      const _lbl = document.getElementById('br-pct-label');
      if (_lbl) _lbl.textContent = '0%';
    }
    // Always clear routes; only re-fetch when amount > 0
    brResetRoutes();
    if (!val || val <= 0) return;
    br.quoteDebounce = setTimeout(() => brFetchRoutes(), 600);

    // ── Resolve live price: _globalPriceCache → TOKEN_CONFIG cgId → priceUSD → LiFi API fallback ──
    let _brFromPrice = 0;
    try {
      const _tc3 = typeof TOKEN_CONFIG !== 'undefined' ? TOKEN_CONFIG : [];
      const _tokSym3 = (br.fromToken && br.fromToken.symbol) ? br.fromToken.symbol.toUpperCase() : '';
      const _tokAddr3 = (br.fromToken && br.fromToken.address) ? br.fromToken.address.toLowerCase() : '';
      const _chainId3 = br.fromChain ? br.fromChain.id : 8453;
      let _tDef3 = null;
      if (_tokAddr3) {
        _tDef3 = _tc3.find(function(t){ return (t.contract||'').toLowerCase() === _tokAddr3 && (t.chainId||8453) === _chainId3; });
      }
      if (!_tDef3 && _tokSym3) {
        _tDef3 = _tc3.find(function(t){ return (t.sub||'').toUpperCase() === _tokSym3; });
      }
      if (_tDef3 && typeof _globalPriceCache !== 'undefined' && _globalPriceCache && _tDef3.cgId) {
        const _pd3 = _globalPriceCache[_tDef3.cgId];
        if (_pd3 && _pd3.usd) _brFromPrice = _pd3.usd;
      }
      if (!_brFromPrice && br.fromToken && br.fromToken.priceUSD) _brFromPrice = br.fromToken.priceUSD;
      // Fallback: fetch live price from LiFi token API for non-home-chain tokens
      if (!_brFromPrice && br.fromToken && br.fromToken.address && br.fromChain) {
        (async function() {
          try {
            const _lifiPriceUrl = 'https://li.quest/v1/token?chain=' + br.fromChain.id + '&token=' + br.fromToken.address;
            const _lifiPriceR = await fetch(_lifiPriceUrl, { signal: AbortSignal.timeout(5000) });
            if (_lifiPriceR.ok) {
              const _lifiPriceD = await _lifiPriceR.json();
              const _lifiPrice = parseFloat(_lifiPriceD.priceUSD || 0);
              if (_lifiPrice > 0) {
                br.fromToken.priceUSD = _lifiPrice;
                const _curVal = parseFloat($e('br-from-amount') && $e('br-from-amount').value || 0);
                if (_curVal > 0) {
                  $e('br-from-usd').textContent = '≈ ' + _formatCurrencyDisplay(_curVal * _lifiPrice);
                }
              }
            }
          } catch(_) {}
        })();
      }
    } catch(_pe3) {
      if (br.fromToken && br.fromToken.priceUSD) _brFromPrice = br.fromToken.priceUSD;
    }

    if (val > 0 && _brFromPrice > 0) {
      $e('br-from-usd').textContent = '≈ ' + _formatCurrencyDisplay(val * _brFromPrice);
    } else {
      $e('br-from-usd').textContent = val > 0 ? '≈ $—' : '≈ $0.00';
    }
    // Always refresh button state so hint updates immediately on amount change
    brUpdateExecBtn(false);
  };

  window.brOnRecipientInput = function () {
    // 1. Store value immediately — never touch the DOM or route list here.
    //    The old code called brResetRoutes() on every keystroke which rebuilt
    //    nearby DOM while the field was focused → mobile WebView dismissed the
    //    keyboard and visually cleared the input (the real bug).
    br.recipientAddr = $e('br-recipient').value.trim();
    brUpdateRecipientDisplay();

    // 2. Show/hide the ✕ clear button
    const clearBtn = $e('br-recipient-clear');
    if (clearBtn) clearBtn.style.display = br.recipientAddr ? 'flex' : 'none';

    // 3. Debounced route re-fetch — only after user stops typing for 800ms.
    //    brFetchRoutes() calls brResetRoutes() once internally (not on each
    //    keystroke), so the input field is never disturbed mid-type.
    clearTimeout(br.recipientDebounce);
    const amt = parseFloat($e('br-from-amount').value);
    if (amt > 0 && br.senderAddr) {
      br.recipientDebounce = setTimeout(function() {
        // Re-fetch only when recipient looks like a full address (≥10 chars)
        // or was fully cleared (reverting to sender default).
        const v = br.recipientAddr;
        if (v === '' || v.length >= 10) brFetchRoutes();
      }, 800);
    }
  };

  // Clear recipient — resets to "same as sender" default
  window.brUpdateRecipientDisplay = function(focused) {
    const inp = $e('br-recipient');
    const display = $e('br-recipient-display-text');
    if (!inp || !display) return;
    const val = inp.value.trim();
    if (!val) {
      inp.style.color = 'transparent';
      inp.style.webkitTextFillColor = 'transparent';
      display.style.color = 'var(--text-primary)';
      display.textContent = 'Default: same as sender';
      return;
    }
    // Always transparent input — overlay handles display
    inp.style.color = 'transparent';
    inp.style.webkitTextFillColor = 'transparent';
    display.style.color = 'var(--neon-cyan)';
    display.textContent = val;
    // Scroll display to end so last chars are visible
    const dw = $e('br-recipient-display');
    if (dw) requestAnimationFrame(function(){ dw.scrollLeft = dw.scrollWidth; });
  };

  window.brClearRecipient = function () {
    br.recipientAddr = '';
    const inp = $e('br-recipient');
    if (inp) inp.value = '';
    const clearBtn = $e('br-recipient-clear');
    if (clearBtn) clearBtn.style.display = 'none';
    brUpdateRecipientDisplay(false);
    // Re-fetch routes so toAddress reverts to senderAddr
    const amt = parseFloat($e('br-from-amount').value);
    if (amt > 0 && br.senderAddr) brFetchRoutes();
  };

  function brResetRoutes() {
    br.routes = [];
    br.selectedRoute = null;
    $e('br-routes-list').style.display = 'none';
    $e('br-routes-list').innerHTML = '';
    const _rfl = $e('br-routes-found-label');
    if (_rfl) _rfl.style.display = 'none';
    brUpdateExecBtn(false);
    $e('br-quote-error').style.display = 'none';
    $e('br-to-amount').textContent = '—';
    $e('br-to-usd').textContent = '≈ $0.00';
    const slipRow = $e('br-slippage-row');
    if (slipRow) slipRow.style.display = 'none';
  }
