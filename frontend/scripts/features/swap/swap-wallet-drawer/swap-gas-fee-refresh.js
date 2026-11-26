

  // ── swRefreshGasFee — click ⛽ chip → fresh RPC estimateGas + effectiveGasPrice ──
  async function swRefreshGasFee(chipEl) {
    const dexName = chipEl.dataset.dex;
    if (!dexName || !SW.quotes) return;
    const quote = SW.quotes.find(q => q.dex === dexName);
    if (!quote || !quote.txData) return;

    // Visual feedback
    const origText = chipEl.textContent;
    chipEl.textContent = '⛽ …';
    chipEl.style.opacity = '0.6';
    chipEl.style.pointerEvents = 'none'; // prevent double-click during fetch

    try {
      const chainId = (SW.network && SW.network.chainId) || 8453;
      const txD = quote.txData;

      // ── _priceOnly quotes: first check API-provided gas cost (_apiGasUSD), then estimate ──
      if (txD._priceOnly) {
        // PRIORITY 1: API-provided gas cost directly from route object
        if (txD._apiGasUSD != null && txD._apiGasUSD > 0) {
          const _usd = txD._apiGasUSD;
          const _lbl3 = _usd < 0.0001 ? '<$0.0001' : _usd < 0.01 ? '$' + _usd.toFixed(4) : '$' + _usd.toFixed(2);
          quote.gasFee = _lbl3;
          chipEl.textContent = '⛽ ' + _lbl3;
          chipEl.style.opacity = '1';
          chipEl.style.pointerEvents = '';
          chipEl.style.background = 'rgba(16,185,129,0.12)'; // green = API data
          setTimeout(() => { chipEl.style.background = ''; }, 1200);
          return;
        }
        // FALLBACK: estimate from stored gas units (Velora priceRoute)
        const _gasUnits    = BigInt(txD.gas || 300000);
        const _gasPriceWei = BigInt(Math.ceil((SW._lastGasPriceGwei || 1) * 1e9));
        const _gasEth      = Number(_gasUnits * _gasPriceWei) / 1e18;
        const EEEE3 = 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
        const _fin = !SW.fromToken?.contract || /^0x0+$/.test(SW.fromToken.contract) || SW.fromToken.contract.toLowerCase().replace(/^0x/,'') === EEEE3;
        const _tin = !SW.toToken?.contract   || /^0x0+$/.test(SW.toToken.contract)   || SW.toToken.contract.toLowerCase().replace(/^0x/,'') === EEEE3;
        const _getNativePrice3 = () => {
          const _nt3 = (typeof TOKENS_BY_NETWORK !== 'undefined' && TOKENS_BY_NETWORK[SW.network?.id||'base']||[]).find(t=>!t.contract);
          // 1. globalPriceCache via cgId from TOKENS_BY_NETWORK (already fetched by home section)
          if (_nt3?.cgId && typeof _globalPriceCache !== 'undefined' && _globalPriceCache) { const _p3c=_globalPriceCache[_nt3.cgId]; if(_p3c?.usd) return _p3c.usd; }
          if (_nt3?.price) return _nt3.price;
          // 2. Custom chain fallback via savedTokens
          try { const _at3=(typeof loadSavedTokens==='function'?loadSavedTokens():[]).find(t=>t.chainId===SW.network?.chainId&&(t.isNative||!t.contract)); if(_at3?.cgId&&typeof _globalPriceCache!=='undefined'&&_globalPriceCache){const _p3=_globalPriceCache[_at3.cgId];if(_p3?.usd)return _p3.usd;} } catch(_e3) {}
          return 0;
        };
        const _np3 = _fin ? (SW.fromToken?.price || _getNativePrice3() || 0) : _tin ? (SW.toToken?.price || _getNativePrice3() || 0) : _getNativePrice3();
        let _lbl3;
        if (_np3 > 0) {
          const _u = _gasEth * _np3;
          _lbl3 = _u < 0.0001 ? '<$0.0001' : _u < 0.01 ? '$' + _u.toFixed(4) : '$' + _u.toFixed(2);
        } else {
          _lbl3 = Number(_gasUnits).toLocaleString() + ' gas (est)';
        }
        quote.gasFee = _lbl3;
        chipEl.textContent = '⛽ ' + _lbl3;
        chipEl.style.opacity = '1';
        chipEl.style.pointerEvents = '';
        chipEl.style.background = 'rgba(245,158,11,0.12)'; // amber = estimated
        setTimeout(() => { chipEl.style.background = ''; }, 1200);
        return;
      }

      // ── Guard: need valid calldata to estimateGas ──
      if (!txD.to || !txD.data || txD.data === '0x') {
        chipEl.textContent = '⛽ no calldata';
        chipEl.style.opacity = '0.5';
        chipEl.style.pointerEvents = '';
        setTimeout(() => { chipEl.textContent = origText; chipEl.style.opacity = '1'; }, 1500);
        return;
      }

      // ── Safe value parsing: handle hex ("0x...") and decimal strings ──
      let _txValue = 0n;
      try {
        const _rawV = txD.value;
        if (_rawV && _rawV !== '0' && _rawV !== '0x' && _rawV !== '0x0' && _rawV !== '0x00') {
          _txValue = typeof _rawV === 'bigint' ? _rawV
            : String(_rawV).startsWith('0x') ? BigInt(String(_rawV))
            : BigInt(String(_rawV));
        }
      } catch(_) { _txValue = 0n; }

      // ── Get provider directly via _swWithFallback — single working RPC ──
      // Use a wrapper that returns the provider itself after confirming it's alive
      let _gasProvider = null;
      const _rpcs = (typeof _getRpcListForChain === 'function') ? _getRpcListForChain(chainId) : [];
      for (const _rpc of _rpcs) {
        try {
          const _p = _makeProvider(_rpc, chainId);
          await Promise.race([
            _p.getBlockNumber(),
            new Promise((_, rej) => setTimeout(() => rej(new Error('probe timeout')), 4000))
          ]);
          _gasProvider = _p;
          break;
        } catch(_) {
          // evict broken provider
          if (typeof _providerCache !== 'undefined') delete _providerCache[_rpc + ':' + chainId];
        }
      }
      if (!_gasProvider && _rpcs.length > 0) {
        _gasProvider = _makeProvider(_rpcs[0], chainId); // last resort
      }
      if (!_gasProvider) throw new Error('No RPC available');

      // ── Run estimateGas + getFeeData + getBlock in parallel on same provider ──
      const [_gasUnits, _block, _fd] = await Promise.all([
        _gasProvider.estimateGas({
          from:  SW.walletAddress || undefined,
          to:    txD.to,
          data:  txD.data,
          value: _txValue,
        }),
        _gasProvider.getBlock('latest').catch(() => null),
        _gasProvider.getFeeData().catch(() => null),
      ]);

      // Compute effectiveGasPrice = baseFee + priorityFee (exact, not maxFeePerGas)
      let _effectiveGasPrice;
      const _baseFee = _block?.baseFeePerGas;
      if (_baseFee && _baseFee > 0n) {
        const _tip = (_fd?.maxPriorityFeePerGas && _fd.maxPriorityFeePerGas > 0n)
          ? _fd.maxPriorityFeePerGas : 1000000n;
        _effectiveGasPrice = _baseFee + _tip;
      } else {
        _effectiveGasPrice = _fd?.gasPrice || _fd?.maxFeePerGas || BigInt(Math.ceil((SW._lastGasPriceGwei || 1) * 1e9));
      }

      // Update SW cache for other DEX bars
      try { SW._lastGasPriceGwei = Number(_effectiveGasPrice) / 1e9; } catch(_) {}

      // Ensure custom chain native price is cached before USD conversion
      await _swEnsureNativeTokenPrice(chainId);

      const _gasEth = Number(_gasUnits * _effectiveGasPrice) / 1e18;
      const EEEE2 = 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
      const _fromIsNative2 = !SW.fromToken?.contract || /^0x0+$/.test(SW.fromToken.contract) || SW.fromToken.contract.toLowerCase().replace(/^0x/,'') === EEEE2;
      const _toIsNative2   = !SW.toToken?.contract   || /^0x0+$/.test(SW.toToken.contract)   || SW.toToken.contract.toLowerCase().replace(/^0x/,'') === EEEE2;
      const _getNativePrice2 = () => {
        const _nt2 = (typeof TOKENS_BY_NETWORK !== 'undefined' && TOKENS_BY_NETWORK[SW.network?.id||'base']||[]).find(t=>!t.contract);
        // 1. globalPriceCache via cgId from TOKENS_BY_NETWORK (already fetched by home section)
        if (_nt2?.cgId && typeof _globalPriceCache !== 'undefined' && _globalPriceCache) { const _p2c=_globalPriceCache[_nt2.cgId]; if(_p2c?.usd) return _p2c.usd; }
        if (_nt2?.price) return _nt2.price;
        // 2. Custom chain fallback via savedTokens
        try {
          const _at2 = (typeof loadSavedTokens==='function' ? loadSavedTokens() : []).find(t => t.chainId===SW.network?.chainId && (t.isNative||!t.contract));
          if (_at2) {
            // 2a. cgId in globalPriceCache
            if (_at2.cgId && typeof _globalPriceCache !== 'undefined' && _globalPriceCache) { const _p2=_globalPriceCache[_at2.cgId]; if(_p2?.usd) return _p2.usd; }
            // 2b. symbol-based globalPriceCache lookup
            if (_at2.sub && typeof _globalPriceCache !== 'undefined' && _globalPriceCache) {
              for (const _k2 of Object.keys(_globalPriceCache)) {
                if (_k2.toLowerCase() === (_at2.sub||'').toLowerCase()) { const _pv2=_globalPriceCache[_k2]; if(_pv2?.usd) return _pv2.usd; }
              }
            }
            // 2c. .price field set by home section
            if (_at2.price > 0) return _at2.price;
          }
        } catch(_e2) {}
        // 3. Direct from SW token price fields
        if (_fromIsNative2 && SW.fromToken?.price > 0) return SW.fromToken.price;
        if (_toIsNative2   && SW.toToken?.price   > 0) return SW.toToken.price;
        return 0;
      };
      const _np = _fromIsNative2 ? (SW.fromToken?.price || _getNativePrice2() || 0)
                : _toIsNative2   ? (SW.toToken?.price   || _getNativePrice2() || 0)
                : _getNativePrice2(); // Token→Token: use chain's actual native token price

      let _label;
      if (_np > 0) {
        const _usd = _gasEth * _np;
        _label = _usd < 0.0001 ? '<$0.0001'
               : _usd < 0.01   ? '$' + _usd.toFixed(4)
               : '$' + _usd.toFixed(2);
      } else {
        const _gwei = Number(_effectiveGasPrice) / 1e9;
        _label = Number(_gasUnits).toLocaleString() + ' gas · ' + _gwei.toFixed(4) + ' Gwei';
      }

      quote.gasFee = _label;
      chipEl.textContent = '⛽ ' + _label;
      chipEl.style.opacity = '1';
      chipEl.style.pointerEvents = '';
      chipEl.style.background = 'rgba(16,185,129,0.12)';
      setTimeout(() => { chipEl.style.background = ''; }, 1200);

    } catch(_err) {
      console.warn('[One] Gas refresh failed:', _err?.message || _err);
      // Show short error reason instead of silent restore
      const _reason = (_err?.message || '').includes('timeout') ? '⛽ RPC timeout'
        : (_err?.message || '').includes('execution reverted') ? '⛽ reverted'
        : (_err?.message || '').includes('No RPC') ? '⛽ no RPC'
        : '⛽ retry';
      chipEl.textContent = _reason;
      chipEl.style.opacity = '0.7';
      chipEl.style.pointerEvents = '';
      chipEl.style.background = 'rgba(239,68,68,0.10)';
      setTimeout(() => {
        chipEl.textContent = origText;
        chipEl.style.opacity = '1';
        chipEl.style.background = '';
      }, 1800);
    }
  }