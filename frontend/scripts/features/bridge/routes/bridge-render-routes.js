  // ── Render route cards ──
  function brRenderRoutes(routes, isSameChain) {
    const listEl = $e('br-routes-list');
    if (listEl) listEl.innerHTML = '';

    // Update static ROUTES FOUND label
    const foundLabel = $e('br-routes-found-label');
    const foundText  = $e('br-routes-found-text');
    if (foundLabel) { foundLabel.style.display = 'flex'; }
    if (foundText)  { foundText.textContent = routes.length + (routes.length > 1 ? ' routes' : ' route') + ' found'; }

    function renderCard(route, idx) {
      const est  = route.estimate || {};
      const toDecim = br.toToken.decimals || 18;

      // YOU GET
      const lastStep = (route.steps || [])[(route.steps||[]).length - 1];
      const toRaw = est.toAmount || est.toAmountMin
        || lastStep?.estimate?.toAmount || lastStep?.estimate?.toAmountMin || null;
      const toAmtNum = toRaw ? Number(toRaw) / 10 ** toDecim : 0;
      const toAmt = toRaw ? (toAmtNum < 0.000001 ? toAmtNum.toExponential(3) : toAmtNum < 1 ? toAmtNum.toFixed(6) : toAmtNum.toFixed(4)) : '—';
      const toUSD = (est.toAmountUSD || lastStep?.estimate?.toAmountUSD)
        ? _formatCurrencyDisplay(parseFloat(est.toAmountUSD || lastStep?.estimate?.toAmountUSD)) : '';

      // ── GAS COST (pure network gas only, no protocol fee mixed in) ──
      // LiFi/Socket : est.gasCosts[].amountUSD
      // Rubic       : est.gasCosts[].amountUSD  (mapped from fees.gasTokenFees.gas.totalUsdAmount)
      //               fallback → route._raw.fees.gasTokenFees.gas.totalUsdAmount
      // Rango       : est.gasCosts[].amountUSD  (FROM_SOURCE_WALLET fees — network gas)
      let gasRaw = null;
      if (est.gasCosts && est.gasCosts.length) {
        gasRaw = est.gasCosts.reduce((a, c) => a + parseFloat(c.amountUSD || 0), 0);
      } else if (est.feeCosts && est.feeCosts.length) {
        gasRaw = est.feeCosts.reduce((a, c) => a + parseFloat(c.amountUSD || 0), 0);
      } else if (route._provider === 'rubic' && route._raw && route._raw.fees) {
        // Official: fees.gasTokenFees.gas.totalUsdAmount
        // Cross-chain routes return 0 (gas included in bridge) → treat as null → show '—'
        const _rGasUsd = parseFloat(route._raw.fees?.gasTokenFees?.gas?.totalUsdAmount ?? -1);
        if (_rGasUsd > 0) gasRaw = _rGasUsd;
      }
      const gasUSD = gasRaw !== null ? (gasRaw < 0.01 ? '<$0.01' : '$' + gasRaw.toFixed(2)) : '—';

      // ── PROTOCOL FEE (bridge/DEX platform fee, separate from gas) ──
      // Each provider stores this in a dedicated field set during fetch:
      //   LiFi   → route._lifiProtocolFeeUsd
      //   Rubic  → route._protocolFeeUsd  (fees.gasTokenFees.protocol.fixedUsdAmount)
      //   Rango  → route._rangoProtocolFeeUsd
      //   Socket → route._socketBridgeFeeUsd
      const _protoFeeUsd =
        route._lifiProtocolFeeUsd   != null ? route._lifiProtocolFeeUsd   :
        route._protocolFeeUsd       != null ? route._protocolFeeUsd       :
        route._rangoProtocolFeeUsd  != null ? route._rangoProtocolFeeUsd  :
        route._socketBridgeFeeUsd   != null ? route._socketBridgeFeeUsd   :
        null;
      const protoFeeDisplay = _protoFeeUsd != null
        ? (_protoFeeUsd <= 0.01 ? 'FREE' : '$' + _protoFeeUsd.toFixed(3))
        : null;

      // TIME
      const secs = est.executionDuration || est.duration || 0;
      const time = secs > 0 ? (secs < 60 ? secs + 's' : Math.round(secs/60) + 'm') : '~1m';

      // Protocol steps — with logos if available
      const steps = route.steps || route.includedSteps || [];
      const _rawTools = steps.length
        ? steps.map(s => ({ name: s.toolDetails?.name || s.tool || '', logo: s.toolDetails?.logoURI || s.toolDetails?.logo || '' }))
        : [{ name: route.tool || route.toolDetails?.name || 'LiFi', logo: route.toolDetails?.logoURI || route.toolDetails?.logo || '' }];
      // Deduplicate by name (Set cannot deduplicate plain objects)
      const _seenToolNames = new Set();
      const tools = _rawTools.filter(t => {
        if (!t.name || _seenToolNames.has(t.name)) return false;
        _seenToolNames.add(t.name);
        return true;
      });

      // Step count badge
      const stepCount = steps.length;

      // BEST RATE = protocol fee FREE + highest output amount
      const _getProtoFee = (r) =>
        r._lifiProtocolFeeUsd  != null ? r._lifiProtocolFeeUsd  :
        r._protocolFeeUsd      != null ? r._protocolFeeUsd      :
        r._rangoProtocolFeeUsd != null ? r._rangoProtocolFeeUsd :
        r._socketBridgeFeeUsd  != null ? r._socketBridgeFeeUsd  : null;

      const _getOutput = (r) => Number(r.estimate?.toAmount || 0);

      // Among fee-free routes pick highest output; if none are fee-free, pick highest output overall
      const _freeFeeRoutes = routes.filter(r => { const f = _getProtoFee(r); return f != null && f <= 0.01; });
      const _candidateRoutes = _freeFeeRoutes.length ? _freeFeeRoutes : routes;
      const _bestOutput = Math.max(..._candidateRoutes.map(_getOutput));
      const _thisProtoFee = _getProtoFee(route);
      const _thisOutput   = _getOutput(route);

      const isBest = _freeFeeRoutes.length
        ? (_thisProtoFee != null && _thisProtoFee <= 0.01 && _thisOutput === _bestOutput)
        : (_thisOutput === _bestOutput);
      const isFast  = !isBest && secs > 0 && secs === Math.min(...routes.map(r => r.estimate?.executionDuration || 9999));
      const isCheap = false;

      // Badge config
      const badge = isBest
        ? { label: '✦ BEST RATE', color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' }
        : isFast
          ? { label: '⚡ FASTEST',  color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)' }
          : isCheap
            ? { label: '💰 CHEAPEST',color: '#22d3ee', bg: 'rgba(34,211,238,0.08)', border: 'rgba(34,211,238,0.25)' }
            : null;

      // ── Provider / protocol labels ──
      const _provName = !route._provider || route._provider === 'lifi' ? 'LiFi'
        : route._provider === 'rubic' ? 'Rubic'
        : route._provider === 'socket' ? 'Socket'
        : String(route._provider).toUpperCase();
      const _viaNames = tools.slice(0, 2).map(t => t.name).join(' + ');
      const _viaLabel = _provName + (_viaNames ? ' \u00b7 ' + _viaNames : '');
      const _t0 = tools[0];
      const _t0slug = _t0 ? _t0.name.toLowerCase().replace(/[\s\/]+/g, '-').replace(/[^a-z0-9\-]/g, '') : '';
      const _viaLogo = _t0 ? (_t0.logo || ('https://icons.llamao.fi/icons/protocols/' + _t0slug + '?w=48&h=48')) : '';

      // ── Tags ──
      const _tagMain = isBest
        ? '<span class="br-tag br-tag-best"><span class="material-icons-round">auto_awesome</span>Best rate</span>'
        : isFast
          ? '<span class="br-tag br-tag-amber"><span class="material-icons-round">bolt</span>Fastest</span>'
          : '<span class="br-tag">Route ' + (idx + 1) + '</span>';
      const _tagFee = protoFeeDisplay !== null
        ? (_protoFeeUsd <= 0.01
            ? '<span class="br-tag br-tag-green">Fee free</span>'
            : '<span class="br-tag br-tag-amber">Fee ' + protoFeeDisplay + '</span>')
        : '';

      const card = document.createElement('div');
      card.className = 'br-route-card' + (isBest ? ' br-route-best' : '');
      card.dataset.idx = idx;

      card.innerHTML = `
        <div class="br-rc-top">
          <div class="br-rc-tags">${_tagMain}${_tagFee}</div>
          <div class="br-rc-out">
            <div class="br-rc-amt${isBest ? ' best' : ''}">${toAmt} ${br.toToken.symbol}</div>
            ${toUSD ? `<div class="br-rc-sub">${toUSD}</div>` : ''}
          </div>
        </div>
        <div class="br-rc-path">
          <span class="br-rc-dot"></span>
          <span class="br-rc-line"></span>
          <div class="br-rc-via">
            ${_viaLogo ? `<img src="${_viaLogo}" alt="" onerror="this.style.display='none'">` : ''}
            <span>${_viaLabel}</span>
          </div>
          <span class="br-rc-line"></span>
          <span class="br-rc-dot end"></span>
        </div>
        <div class="br-rc-stats">
          <span class="br-tag"><span class="material-icons-round">schedule</span>${time}</span>
          <span class="br-tag"><span class="material-icons-round">local_gas_station</span>${gasUSD}</span>
          ${stepCount > 1 ? `<span class="br-tag"><span class="material-icons-round">alt_route</span>${stepCount} steps</span>` : ''}
        </div>
        <div id="br-radio-${idx}"></div>
      `;

      card.addEventListener('click', () => brSelectRoute(idx));
      return card;
    }

    // Render ALL routes vertically — scroll down to see more
    routes.forEach((route, idx) => {
      const card = renderCard(route, idx);
      card.style.width = '100%';
      card.style.marginBottom = '10px';
      listEl.appendChild(card);
    });

    listEl.style.display = 'block';

    // Auto-select BEST RATE route (protocol fee FREE + highest output)
    const _getProtoFeeAuto = (r) =>
      r._lifiProtocolFeeUsd  != null ? r._lifiProtocolFeeUsd  :
      r._protocolFeeUsd      != null ? r._protocolFeeUsd      :
      r._rangoProtocolFeeUsd != null ? r._rangoProtocolFeeUsd :
      r._socketBridgeFeeUsd  != null ? r._socketBridgeFeeUsd  : null;
    const _getOutputAuto = (r) => Number(r.estimate?.toAmount || 0);
    const _freeRoutes = routes.filter(r => _getProtoFeeAuto(r) === 0);
    const _pool = _freeRoutes.length ? _freeRoutes : routes;
    const _bestOut = Math.max(..._pool.map(_getOutputAuto));
    const _bestIdx = routes.indexOf(_pool.find(r => _getOutputAuto(r) === _bestOut));
    brSelectRoute(_bestIdx >= 0 ? _bestIdx : 0);
  }

