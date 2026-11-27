

  window.brFilterChains = function () {
    const searchEl = $e('br-chain-search');
    const clearBtn = $e('br-chain-search-clear');
    const q = (searchEl ? searchEl.value : '').trim().toLowerCase();
    if (clearBtn) clearBtn.style.display = q ? 'inline-flex' : 'none';
    const filtered = q
      ? PRESET_CHAINS.filter(c =>
          c.name.toLowerCase().includes(q) ||
          c.nativeSym.toLowerCase().includes(q) ||
          String(c.id).includes(q)
        )
      : PRESET_CHAINS;
    brRenderChainItems(filtered);
  };

  window.brClearChainSearch = function () {
    const searchEl = $e('br-chain-search');
    const clearBtn = $e('br-chain-search-clear');
    if (searchEl) { searchEl.value = ''; searchEl.focus(); }
    if (clearBtn) clearBtn.style.display = 'none';
    brRenderChainItems(PRESET_CHAINS);
  };

  function brSetChainBtnIcon(elId, chain) {
    const el = $e(elId);
    if (!el) return;
    if (chain.logoURI) {
      const letter = (chain.nativeSym || chain.name || '?')[0].toUpperCase();
      el.innerHTML = `<img src="${chain.logoURI}" width="18" height="18"
        style="border-radius:5px;object-fit:cover;vertical-align:middle;"
        onerror="if(this.parentNode)this.outerHTML='<span style=\'font-size:15px;\'>${chain.emoji||'🔗'}</span>'" />`;
    } else {
      if (el) el.innerHTML = `<span style="font-size:15px;">${chain.emoji || '🔗'}</span>`;
    }
  }

  // ── Helper: find USDC token object for a given chainId from TOKEN_CONFIG ──
  function _brGetUsdcForChain(chainId) {
    var cfg = (typeof TOKEN_CONFIG !== 'undefined' ? TOKEN_CONFIG : [])
      .find(function(t) { return t.chainId === chainId && (t.sub || '').toUpperCase() === 'USDC'; });
    if (cfg) {
      return { symbol: cfg.sub, address: cfg.contract, decimals: cfg.decimals || 6, priceUSD: 1,
               logoURI: cfg.logoURI || 'https://assets.coingecko.com/coins/images/6319/small/usdc.png' };
    }
    // fallback: search in loaded token cache
    var toks = brTokCache[chainId] || (br.allTokens && br.allTokens['to']) || [];
    var usdc = toks.find(function(t) { return (t.symbol || '').toUpperCase() === 'USDC'; });
    if (usdc) {
      return { symbol: usdc.symbol, address: usdc.address, decimals: usdc.decimals || 6,
               priceUSD: parseFloat(usdc.priceUSD || 1), logoURI: usdc.logoURI || '' };
    }
    return null;
  }

  // ── Auto-set TO token when both chains are the same ──
  // FROM = native token  → TO = USDC
  // FROM = any other token → TO = native token
  function _brAutoSetSameChainToToken(chainNativeSym) {
    if (!br.fromChain || !br.toChain || br.fromChain.id !== br.toChain.id) return;
    var chainId = br.fromChain.id;
    var isFromNative = br.fromToken.address === '0x0000000000000000000000000000000000000000';
    if (isFromNative) {
      var usdc = _brGetUsdcForChain(chainId);
      if (usdc) { br.toToken = usdc; brUpdateTokenBtn('to'); }
    } else {
      var nSym = chainNativeSym || (br.fromChain && br.fromChain.nativeSym) || (br.toChain && br.toChain.nativeSym) || 'ETH';
      br.toToken = { symbol: nSym, address: '0x0000000000000000000000000000000000000000', decimals: 18, priceUSD: 0, logoURI: '' };
      brUpdateTokenBtn('to');
    }
  }

  function brSelectChain(chain) {
    var obj = { id: chain.id, name: chain.name, emoji: chain.emoji, logoURI: chain.logoURI || null, nativeSym: chain.nativeSym || 'ETH', color: chain.color || BR_CHAIN_COLORS[chain.id] || '#6366f1' };

    // Helper: resolve native token price from _globalPriceCache via TOKEN_CONFIG
    function _brNativePrice(nativeSym, chainId) {
      try {
        var _tc4 = typeof TOKEN_CONFIG !== 'undefined' ? TOKEN_CONFIG : [];
        var _tDef4 = _tc4.find(function(t){ return (t.sub||'').toUpperCase() === (nativeSym||'').toUpperCase() && !t.contract; });
        if (!_tDef4) _tDef4 = _tc4.find(function(t){ return (t.sub||'').toUpperCase() === (nativeSym||'').toUpperCase(); });
        if (_tDef4 && typeof _globalPriceCache !== 'undefined' && _globalPriceCache && _tDef4.cgId) {
          var _pd4 = _globalPriceCache[_tDef4.cgId];
          if (_pd4 && _pd4.usd) return _pd4.usd;
        }
      } catch(_e4) {}
      return 0;
    }

    if (br.pickerTarget === 'from') {
      // Allow same chain as TO — no forced swap
      br.fromChain = obj;
      br.fromToken = { symbol: chain.nativeSym, address: '0x0000000000000000000000000000000000000000', decimals: 18, priceUSD: _brNativePrice(chain.nativeSym, chain.id), logoURI: '' };
      brSetChainBtnIcon('br-from-chain-emoji', chain);
      $e('br-from-chain-name').textContent = chain.name;
      brUpdateTokenBtn('from');
      brLoadTokens('from', chain.id);
      // Same chain? → FROM just became native, so TO = USDC
      if (br.toChain && br.toChain.id === chain.id) {
        _brAutoSetSameChainToToken(chain.nativeSym);
      }
    } else {
      // Allow same chain as FROM — no forced swap
      br.toChain = obj;
      br.toToken = { symbol: chain.nativeSym, address: '0x0000000000000000000000000000000000000000', decimals: 18, priceUSD: _brNativePrice(chain.nativeSym, chain.id), logoURI: '' };
      brSetChainBtnIcon('br-to-chain-emoji', chain);
      $e('br-to-chain-name').textContent = chain.name;
      brUpdateTokenBtn('to');
      brLoadTokens('to', chain.id);
      // Same chain? → auto-set TO based on what FROM currently has
      if (br.fromChain && br.fromChain.id === chain.id) {
        _brAutoSetSameChainToToken(chain.nativeSym);
      }
    }
    brResetRoutes();
    brUpdateExecBtn(false);
    brCloseChainPicker();
    var amt = parseFloat($e('br-from-amount').value);
    if (amt > 0) setTimeout(function() { brFetchRoutes(); }, 300);
  }

  window.brCloseChainPicker = function () { $e('br-chain-overlay').classList.remove('open'); };

  // ── Drag-to-close for Bridge Chain & Token pickers ──
  // Gesture logic is shared: scripts/shared/ui/sheet-swipe-close.js
  // (the stylesheet sets transform/transition with !important on these sheets, so the helper does too)
  (function() {
    var BR_EASE_SNAP = 'transform 0.3s cubic-bezier(0.25,1,0.5,1)';
    function initDragClose() {
      if (typeof attachSheetSwipeClose !== 'function') return;
      [
        ['br-chain-modal-inner', 'br-chain-overlay', 'brCloseChainPicker', 'br-chain-list'],
        ['br-token-modal-inner', 'br-token-overlay', 'brCloseTokenPicker', 'br-token-list']
      ].forEach(function (c) {
        var sheet = document.getElementById(c[0]);
        if (!sheet) return;
        var closeFn = function () { if (typeof window[c[2]] === 'function') window[c[2]](); };
        attachSheetSwipeClose(sheet, { closeFn: closeFn, scroller: c[3], important: true, snapEase: BR_EASE_SNAP });
        attachBackdropSwipeClose(document.getElementById(c[1]), closeFn);
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initDragClose);
    } else {
      initDragClose();
    }
    window.addEventListener('load', initDragClose);
  })();

