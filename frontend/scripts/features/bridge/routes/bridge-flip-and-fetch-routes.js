  // ── Flip chains ──
  window.brFlipChains = function () {
    [br.fromChain, br.toChain] = [br.toChain, br.fromChain];
    [br.fromToken, br.toToken] = [br.toToken, br.fromToken];
    [br.allTokens.from, br.allTokens.to] = [br.allTokens.to, br.allTokens.from];
    brSetChainBtnIcon('br-from-chain-emoji', br.fromChain);
    $e('br-from-chain-name').textContent  = br.fromChain.name;
    brSetChainBtnIcon('br-to-chain-emoji', br.toChain);
    $e('br-to-chain-name').textContent    = br.toChain.name;
    brUpdateTokenBtn('from');
    brUpdateTokenBtn('to');
    $e('br-flip-btn').style.transform = 'rotate(180deg)';
    setTimeout(() => $e('br-flip-btn').style.transform = '', 300);
    // Reset slider since balance context changed
    br._fromBalance = null;
    brUpdateSliderUI(0);
    // Clear auto-fetch in-progress flag so new FROM token fetches immediately if cache miss
    window._brAutoFetchInProgress = false;
    // Show new FROM balance from cache instantly (no RPC) — also sets br._fromBalance & shows/hides pct-row
    // If cache miss, _brShowCachedBalance auto-triggers RPC fetch internally
    setTimeout(function(){ _brShowCachedBalance('from'); _brShowCachedBalance('to'); }, 0);
    brResetRoutes();
    brUpdateExecBtn(false);
    haptic && haptic();
    // auto re-quote if amount present
    const amt = parseFloat($e('br-from-amount').value);
    if (amt > 0) brFetchRoutes();
  };

  // ── Fetch Routes ──
  window.brFetchRoutes = async function () {
    const amount = parseFloat($e('br-from-amount').value);
    if (!amount || amount <= 0) { _nxdm_brShowError('Enter an amount'); return; }

    // ── Wallet Guard: no wallet → no API call ──
    if (!br.senderAddr) {
      _nxdm_brShowError('Please connect a wallet to fetch bridge routes.');
      return;
    }

    // ── Stale-fetch guard: PTR (or any reset) increments _routeSession to cancel in-flight calls ──
    const _myRouteSession = ++br._routeSession;

    $e('br-quote-loading').style.display = 'flex';
    brResetRoutes();



    // ── Update provider label in header ──
    const provLabelEl = document.getElementById('br-provider-label');
    const _provNames = { lifi:'LiFi', rubic:'Rubic', rango:'Rango', socket:'Socket' };

    try {
      // Safe BigInt conversion: use ethers.parseUnits to avoid floating-point precision loss
      const _faDec = br.fromToken.decimals || 18;
      const _faStr = (function(s, d) {
        var dot = s.indexOf('.');
        if (dot === -1) return s;
        return s.slice(0, dot + d + 1);
      })(String(amount), _faDec);
      const fromAmt = ethers.parseUnits(_faStr, _faDec).toString();
      const isSameChain = br.fromChain.id === br.toChain.id;
      let routes = [];

      // ── Fetch from ALL providers simultaneously (unlimited routes) ──
      if (provLabelEl) provLabelEl.textContent = 'LiFi · RUBIC · RANGO · SOCKET · FETCHING ALL…';

      // Run all 3 providers in parallel — failures are silently ignored
      // LiFi fetch helper (returns normalized route array)
      async function _fetchLifi() {
        const body = {
          fromChainId:      br.fromChain.id,
          toChainId:        br.toChain.id,
          fromTokenAddress: br.fromToken.address,
          toTokenAddress:   br.toToken.address,
          fromAmount:       fromAmt,
          options: {
            slippage:   br.slippage / 100,
            integrator: 'OneWallet',
            // Same-chain: fetch ALL DEX routes sorted by output; cross-chain: recommended order
            order:      'RECOMMENDED',
          },
        };
        if (br.senderAddr) {
          body.fromAddress = br.senderAddr;
          body.toAddress   = br.recipientAddr || br.senderAddr;
        } else if (br.recipientAddr) {
          body.toAddress   = br.recipientAddr;
        }
        const resp = await _brProxyFetch(`${LIFI_API}/advanced/routes`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'x-lifi-api-key': 'b3e55edd-de70-4578-b761-cd2aac0fbae0.685a5adf-2580-486e-a8ff-1df4992b3f2e' },
          body:    JSON.stringify(body),
        });
        if (!resp.ok) throw new Error('LiFi HTTP ' + resp.status);
        const data = await resp.json();
        const rts = (data.routes || []).map(rt => {
          rt._provider = rt._provider || 'lifi';
          // ── Extract LiFi protocol/integrator fee (feeCosts) ──
          // LiFi returns feeCosts[] at route.estimate level and/or per-step
          // feeCosts are protocol fees (integrator + LiFi platform), separate from gasCosts
          const _allFeeCosts = [
            ...(rt.estimate?.feeCosts || []),
            ...(rt.steps?.flatMap(st => st.estimate?.feeCosts || []) || []),
          ];
          const _lifiProtoUsd = _allFeeCosts.reduce((sum, f) => sum + parseFloat(f.amountUSD || 0), 0);
          // Always set — 0 means Fee FREE (same display as Socket FREE)
          rt._lifiProtocolFeeUsd = _lifiProtoUsd > 0 ? parseFloat(_lifiProtoUsd.toFixed(4)) : 0;

          if (rt.estimate?.toAmount) return rt;
          const steps = rt.steps || [];
          const lastStep = steps[steps.length - 1];
          const toAmt = lastStep?.estimate?.toAmount || lastStep?.action?.toAmount;
          const toUSD = lastStep?.estimate?.toAmountUSD;
          const dur   = rt.steps?.reduce((s, st) => s + (st.estimate?.executionDuration || 0), 0) || 0;
          const gas   = rt.steps?.flatMap(st => st.estimate?.gasCosts || []) || [];
          if (!rt.estimate) rt.estimate = {};
          if (toAmt) rt.estimate.toAmount = toAmt;
          if (toUSD) rt.estimate.toAmountUSD = toUSD;
          if (dur)   rt.estimate.executionDuration = dur;
          if (gas.length) rt.estimate.gasCosts = gas;
          return rt;
        });
        return rts;
      }

      // ── Each API resolves independently — render immediately as each arrives ──
      function _mergeAndRender() {
        const merged = [
          ..._brProvRoutes.lifi,
          ..._brProvRoutes.rubic,   // included for both same-chain swap and cross-chain bridge
          ..._brProvRoutes.rango,
          ..._brProvRoutes.socket,
        ];
        // Sort: BEST RATE always 1st, rest by output amount only
        const _pf = (r) =>
          r._lifiProtocolFeeUsd  != null ? r._lifiProtocolFeeUsd  :
          r._protocolFeeUsd      != null ? r._protocolFeeUsd      :
          r._rangoProtocolFeeUsd != null ? r._rangoProtocolFeeUsd :
          r._socketBridgeFeeUsd  != null ? r._socketBridgeFeeUsd  : null;
        const _out = (r) => parseFloat(r.estimate?.toAmount || '0');
        // Find BEST RATE route: fee-free + highest output
        const _freePool = merged.filter(r => _pf(r) === 0);
        const _pool = _freePool.length ? _freePool : merged;
        const _bestOut = Math.max(..._pool.map(_out));
        const _bestRoute = _pool.find(r => _out(r) === _bestOut);
        // Remove best from array, sort rest by output, put best at front
        const _rest = merged.filter(r => r !== _bestRoute).sort((a, b) => _out(b) - _out(a));
        merged.length = 0;
        if (_bestRoute) merged.push(_bestRoute);
        merged.push(..._rest);
        if (merged.length > 0) {
          br.routes = merged;
          brRenderRoutes(merged, isSameChain);
        }
      }

      let _anySuccess = false;

      // Wrap each API: hide loading spinner as soon as first result arrives,
      // then silently merge remaining APIs in background
      function _makeApiFetch(fetchPromise, provKey) {
        return fetchPromise.then(rts => {
          if (provKey) _brProvRoutes[provKey] = rts;
          // ── Stale check: if PTR or reset fired after this call started, discard results ──
          if (br._routeSession !== _myRouteSession) return;
          if (rts.length) {
            _anySuccess = true;
            // Hide loading spinner on first success
            $e('br-quote-loading').style.display = 'none';
            _mergeAndRender();
          }
        }).catch(() => {});
      }

      // Same-chain swap: LiFi + Rubic + Rango + Socket (all 4 providers)
      // Cross-chain bridge: all 4 providers
      const _apiFetches = [
        _makeApiFetch(_fetchLifi(), 'lifi'),
        _makeApiFetch(_brFetchRubic(fromAmt).catch(() => []), 'rubic'),
        _makeApiFetch(_brFetchRango(fromAmt).catch(() => []), 'rango'),
        _makeApiFetch(_brFetchSocket(fromAmt).catch(() => []), 'socket'),
      ];

      // Wait for all to finish before checking failure / hiding spinner
      await Promise.allSettled(_apiFetches);

      // Update provider label
      if (provLabelEl) provLabelEl.textContent = 'LiFi · RUBIC · RANGO · SOCKET';

      if (!_anySuccess) throw new Error(
        `No routes found for ${br.fromChain.name} → ${br.toChain.name}.\n\n` +
        `Possible reasons:\n• Chain not supported by any bridge\n• No liquidity for this token pair\n• Amount too small\n\n` +
        `Use preset chains (Base, ETH, Arbitrum, Polygon) for best support.`
      );

    } catch (e) {
      if (br._routeSession !== _myRouteSession) return; // stale — PTR already cleared
      _nxdm_brShowError('Routes fetch failed: ' + e.message);
    } finally {
      // Ensure spinner is always hidden (covers error/no-route case)
      if (br._routeSession === _myRouteSession) $e('br-quote-loading').style.display = 'none';
    }
  };

