
  // ── Rango: fetch routes ──
  async function _brFetchRango(fromAmt) {
    const fromBC = RANGO_CHAINS[br.fromChain.id];
    const toBC   = RANGO_CHAINS[br.toChain.id];
    if (!fromBC || !toBC) throw new Error('Chain not supported by Rango');

    const amtHuman = String(parseFloat(fromAmt) / Math.pow(10, br.fromToken.decimals || 18));
    const _isSameChainRango = br.fromChain.id === br.toChain.id;
    const body = {
      from: { blockchain: fromBC, symbol: br.fromToken.symbol, address: br.fromToken.address === '0x0000000000000000000000000000000000000000' ? null : br.fromToken.address },
      to:   { blockchain: toBC,   symbol: br.toToken.symbol,   address: br.toToken.address   === '0x0000000000000000000000000000000000000000' ? null : br.toToken.address   },
      amount:               amtHuman,
      slippage:             String(br.slippage || 1),
      checkPrerequisites:   false,                         // don't filter by wallet balance
    };
    if (br.senderAddr) {
      body.selectedWallets = {};
      body.selectedWallets[fromBC] = br.senderAddr;
      if (toBC !== fromBC) body.selectedWallets[toBC] = br.recipientAddr || br.senderAddr;
    }

    const r = await fetch(RANGO_API + '/routing/bests?apiKey=' + RANGO_KEY, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    if (!r.ok) {
      const eb = await r.json().catch(() => ({}));
      throw new Error(eb.message || 'Rango: HTTP ' + r.status);
    }
    const data = await r.json();
    const list = data.results || [];
    if (!list.length) throw new Error('No Rango routes found');

    // Debug: log first Rango route structure
    if (list.length > 0) {
    }

    return list.map(function(rt) {
      const toAmtHuman = rt.outputAmount || '0';
      const toAmtRaw   = (parseFloat(toAmtHuman) * Math.pow(10, br.toToken.decimals || 18)).toFixed(0);

      // ── Duration ──
      // Fee and time are inside rt.swaps[i], NOT at top-level
      const swaps = rt.swaps || [];
      let execSecs = swaps.reduce(function(sum, s) {
        return sum + (s.estimatedTimeInSeconds || s.timeStat && s.timeStat.avg || 0);
      }, 0);
      if (!execSecs) execSecs = rt.estimatedTimeInSeconds || 120;

      // ── Gas / fee — Official Rango API (docs.rango.exchange) ──
      // route.fee[] — top-level array (also available per swap in swaps[i].fee[])
      // fee[].expenseType:
      //   'FROM_SOURCE_WALLET'  = Network/gas fee — paid separately from user wallet
      //   'DECREASE_FROM_OUTPUT'= Protocol/swapper fee — deducted from output (already in outputAmount)
      // fee[].amount   = token units (string)
      // fee[].token.usdPrice = USD price of that fee token
      // route.feeUsd   = total fee USD (ready-made, use as fallback)
      let gasUSD = 0;
      let protocolFeeUSD = 0;

      // Collect fees from top-level route.fee[] first, fallback to swaps[i].fee[]
      const _rangoFeeArr = rt.fee && rt.fee.length
        ? rt.fee
        : swaps.flatMap(s => s.fee || []);

      _rangoFeeArr.forEach(function(f) {
        const amt      = parseFloat(f.amount || 0);
        const usdPrice = parseFloat((f.token && f.token.usdPrice) || f.price || 0);
        const feeUsd   = amt * usdPrice;
        if (f.expenseType === 'FROM_SOURCE_WALLET') {
          // Gas/network fee — user pays from wallet on top of swap
          gasUSD += feeUsd;
        } else {
          // DECREASE_FROM_OUTPUT — protocol/swapper fee already deducted from output
          protocolFeeUSD += feeUsd;
        }
      });

      // Fallback: use route.feeUsd if fee array gave nothing
      if (gasUSD === 0 && protocolFeeUSD === 0 && rt.feeUsd) {
        gasUSD = parseFloat(rt.feeUsd);
      }

      const gasCosts = gasUSD > 0 ? [{ amountUSD: gasUSD.toFixed(4) }] : [];

      const steps = swaps.map(function(s) {
        return {
          tool: s.swapperId || 'Rango',
          toolDetails: { name: s.swapperId || 'Rango', logoURI: s.swapperLogo || '' },
          estimate: {
            toAmount:          toAmtRaw,
            executionDuration: s.estimatedTimeInSeconds || s.timeStat && s.timeStat.avg || execSecs,
            gasCosts,
          }
        };
      });

      return {
        _provider: 'rango',
        _raw: rt,
        _rangoRequestId: rt.requestId,
        _rangoProtocolFeeUsd: protocolFeeUSD > 0 ? parseFloat(protocolFeeUSD.toFixed(4)) : 0,
        id: rt.requestId || ('rango-' + Math.random()),
        tool: (swaps[0] && swaps[0].swapperId) || 'Rango',
        toolDetails: { name: (swaps[0] && swaps[0].swapperId) || 'Rango', logoURI: (swaps[0] && swaps[0].swapperLogo) || '' },
        steps: steps.length ? steps : [{
          tool: 'Rango', toolDetails: { name:'Rango', logoURI:'' },
          estimate: { toAmount:toAmtRaw, executionDuration:execSecs, gasCosts }
        }],
        estimate: {
          toAmount:          toAmtRaw,
          toAmountUSD:       rt.outputAmountUsd
            ? parseFloat(rt.outputAmountUsd).toFixed(2)
            : (parseFloat(toAmtHuman) * (br.toToken.priceUSD || 0)).toFixed(2),
          executionDuration: execSecs,
          gasCosts,
        },
      };
    });
  }

  // ── Socket (Bungee): fetch routes — cross-chain bridge + same-chain swap ──
  async function _brFetchSocket(fromAmt) {
    const fromChainId = br.fromChain.id;
    const toChainId   = br.toChain.id;
    const fromAddr    = (br.fromToken.address === '0x0000000000000000000000000000000000000000')
      ? '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
      : br.fromToken.address;
    const toAddr      = (br.toToken.address === '0x0000000000000000000000000000000000000000')
      ? '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
      : br.toToken.address;
    const userAddr    = br.senderAddr || '0x0000000000000000000000000000000000000000';
    const slip        = parseFloat(br.slippage || 1).toFixed(1);

    const _baseParams = '?userAddress='       + userAddr
      + '&receiverAddress='   + (br.recipientAddr || userAddr)
      + '&originChainId='     + fromChainId
      + '&destinationChainId='+ toChainId
      + '&inputToken='        + fromAddr
      + '&outputToken='       + toAddr
      + '&inputAmount='       + fromAmt
      + '&slippage='          + slip;

    // Single API call — manual + auto routes
    const _resp = await _brProxyFetch('https://public-backend.bungee.exchange/api/v1/bungee/quote' + _baseParams + '&enableManual=true&enableAuto=true', {}, 12000);
    if (!_resp.ok) throw new Error('Socket HTTP ' + _resp.status);
    const _json = await _resp.json();
    const _allRawRoutes = [
      ...((_json.result && _json.result.manualRoutes) || []),
      ...((_json.result && _json.result.autoRoutes)   || []),
    ];

    if (!_allRawRoutes.length) throw new Error('No Socket routes found');

    const routes = [];

    for (const rt of _allRawRoutes) {
      if (!rt.quoteId) continue;
      const outWei = String((rt.output && rt.output.amount) || '0');

      const routeName    = (rt.routeDetails && rt.routeDetails.name)  || 'Socket';
      // Logo priority: userTxs[0].protocol.icon → routeDetails.logoURI → official Socket logo
      const _userTxLogo  = (rt.userTxs && rt.userTxs[0] && rt.userTxs[0].protocol && rt.userTxs[0].protocol.icon) || '';
      const routeLogo    = _userTxLogo || (rt.routeDetails && rt.routeDetails.logoURI) || 'https://raw.githubusercontent.com/SocketDotTech/socket-tech-mono/main/apps/socket-landing/public/logo.png';
      // Official field: gasFee.feeInUsd (number, direct USD value)
      const gasUSD       = parseFloat((rt.gasFee && rt.gasFee.feeInUsd) || 0);
      // Official field: routeDetails.routeFee.feeInUsd (bridge protocol fee)
      const bridgeFeeUsd = parseFloat((rt.routeDetails && rt.routeDetails.routeFee && rt.routeDetails.routeFee.feeInUsd) || 0);
      // Official field: estimatedTime (seconds)
      const execSecs     = parseInt(rt.estimatedTime || 0, 10) || 60;

      const toAmtNum = Number(outWei) / Math.pow(10, br.toToken.decimals || 18);
      // Fix: Use Socket API's own USD value first, then _globalPriceCache, then br.toToken.priceUSD
      let _toUsdPrice = br.toToken.priceUSD || 0;
      // Socket API: rt.output.usdValue = direct USD value of output amount
      let toAmtUSD;
      const _socketApiUsd = rt.output && rt.output.usdValue ? parseFloat(rt.output.usdValue) : null;
      if (_socketApiUsd !== null && _socketApiUsd > 0) {
        toAmtUSD = _socketApiUsd.toFixed(2);
      } else {
        try {
          const _tcS = typeof TOKEN_CONFIG !== 'undefined' ? TOKEN_CONFIG : [];
          const _chainIdS = br.toChain.id;
          let _tDefS = _tcS.find(t => (t.contract||'').toLowerCase() === br.toToken.address.toLowerCase() && (t.chainId||8453) === _chainIdS);
          if (!_tDefS) _tDefS = _tcS.find(t => (t.sub||'').toUpperCase() === (br.toToken.symbol||'').toUpperCase());
          if (_tDefS && typeof _globalPriceCache !== 'undefined' && _globalPriceCache && _tDefS.cgId) {
            const _pdS = _globalPriceCache[_tDefS.cgId];
            if (_pdS && _pdS.usd) _toUsdPrice = _pdS.usd;
          }
        } catch(_eS) {}
        toAmtUSD = (toAmtNum * _toUsdPrice).toFixed(2);
      }

      routes.push({
        _provider:           'socket',
        _socketQuoteId:      rt.quoteId,
        _socketReceiverAddr: br.recipientAddr || br.senderAddr, // baked into quote — stale check at execute
        _fetchedAt:          Date.now(),
        _socketBridgeFeeUsd: bridgeFeeUsd,   // protocol fee (shown on card)
        id:               rt.quoteId,
        tool:             routeName,
        toolDetails:      { name: routeName, logoURI: routeLogo },
        steps: [{
          tool:        routeName,
          toolDetails: { name: routeName, logoURI: routeLogo },
          estimate: {
            toAmount:          outWei,
            executionDuration: execSecs,
            gasCosts:          gasUSD > 0 ? [{ amountUSD: gasUSD.toFixed(4) }] : null,
          },
        }],
        estimate: {
          toAmount:          outWei,
          toAmountUSD:       toAmtUSD,
          executionDuration: execSecs,
          gasCosts:          gasUSD > 0 ? [{ amountUSD: gasUSD.toFixed(4) }] : null,
        },
      });
    }

    if (!routes.length) throw new Error('No usable Socket routes');
    return routes.sort((a, b) => Number(b.estimate.toAmount) - Number(a.estimate.toAmount));
  }

  // expose helpers for brExecute to detect provider
  window._brGetProvider  = function() { return _brProvider; };
  window._brProvRoutes   = _brProvRoutes;
  window._brFetchRubic   = _brFetchRubic;
  window._brFetchRango   = _brFetchRango;
  window._brFetchSocket  = _brFetchSocket;