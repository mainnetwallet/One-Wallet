  // ── Render route cards ──
  function brRenderRoutes(routes, isSameChain) {
    const listEl = $e('br-routes-list');
    if (listEl) listEl.innerHTML = '';

    // Update static ROUTES FOUND label
    const foundLabel = $e('br-routes-found-label');
    const foundText  = $e('br-routes-found-text');
    if (foundLabel) { foundLabel.style.display = 'flex'; }
    if (foundText)  { foundText.textContent = routes.length + ' ROUTE' + (routes.length > 1 ? 'S' : '') + ' FOUND'; }

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

      // Protocol logo pills
      const toolPills = tools.slice(0, 3).map(t =>
        `<div style="display:flex;align-items:center;gap:3px;padding:2px 6px;border-radius:5px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);">
          ${t.logo ? `<img src="${t.logo}" style="width:10px;height:10px;border-radius:2px;object-fit:cover;" onerror="this.style.display='none'">` : ''}
          <span style="font-size:9px;font-weight:700;color:var(--text-secondary);font-family:var(--font-mono);">${t.name}</span>
        </div>`
      ).join('');

      const card = document.createElement('div');
      card.className = 'br-route-card' + (isBest ? ' br-route-best' : '');
      card.dataset.idx = idx;

      // Glow on best
      const glowDiv = isBest ? `<div style="position:absolute;top:-40px;right:-40px;width:130px;height:130px;border-radius:50%;background:radial-gradient(circle,rgba(99,102,241,0.14) 0%,transparent 70%);pointer-events:none;"></div>` : '';

      card.innerHTML = `
        <!-- ROW 1: Badge · [spacer] · Amount+USD · Radio -->
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px;">

          <!-- Badge + fee tag inline -->
          <div style="display:flex;align-items:center;gap:5px;flex-shrink:0;">
            ${badge
              ? `<div style="font-size:9px;font-weight:800;color:${badge.color};background:${badge.bg};border:1px solid ${badge.border};padding:2px 7px;border-radius:5px;font-family:var(--font-mono);letter-spacing:0.5px;white-space:nowrap;align-self:center;">${badge.label}</div>`
              : `<div style="font-size:9px;font-weight:700;color:var(--text-muted);font-family:var(--font-mono);background:var(--bg-glass);border:1px solid var(--border-subtle);padding:2px 7px;border-radius:5px;white-space:nowrap;align-self:center;">ROUTE ${idx+1}</div>`}
            ${protoFeeDisplay !== null
              ? _protoFeeUsd <= 0.01
                ? `<div style="display:flex;align-items:center;gap:2px;padding:2px 6px;border-radius:5px;background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.35);white-space:nowrap;" title="Protocol fee">
                    <span style="font-family:var(--font-mono);font-size:9px;font-weight:700;color:#10b981;">Fee FREE</span>
                  </div>`
                : `<div style="display:flex;align-items:center;gap:2px;padding:2px 6px;border-radius:5px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.35);white-space:nowrap;" title="Protocol fee">
                    <span style="font-family:var(--font-mono);font-size:9px;font-weight:700;color:#f59e0b;">Fee ${protoFeeDisplay}</span>
                  </div>`
              : ''}
          </div>

          <!-- Spacer -->
          <div style="flex:1;min-width:0;"></div>

          <!-- You get (right-aligned) -->
          <div style="display:flex;flex-direction:column;align-items:flex-end;flex-shrink:0;margin-right:7%;align-self:center;">
            <div style="display:flex;align-items:baseline;gap:3px;">
              <span style="font-family:var(--font-mono);font-size:13px;font-weight:700;color:${isBest ? 'var(--accent-green)' : 'var(--text-primary)'};">${toAmt}</span>
              <span style="font-family:var(--font-mono);font-size:10px;font-weight:600;color:var(--text-secondary);white-space:nowrap;">${br.toToken.symbol}</span>
            </div>
            ${toUSD ? `<span style="font-family:var(--font-mono);font-size:9px;color:rgba(255,255,255,0.55);white-space:nowrap;">${toUSD}</span>` : ''}
          </div>

          <!-- Radio -->
          <div id="br-radio-${idx}" style="width:20px;height:20px;border-radius:50%;border:2px solid ${isBest ? 'var(--accent-primary)' : 'rgba(255,255,255,0.2)'};display:flex;align-items:center;justify-content:center;flex-shrink:0;align-self:flex-end;background:${isBest ? 'var(--accent-primary)' : 'transparent'};transition:all 0.2s ease;">
            ${isBest ? `<svg width="11" height="9" viewBox="0 0 11 9" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 4L4 7.5L10 1" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>` : ''}
          </div>
        </div>

        <!-- ROW 2: Gas · Time · Via inline -->
        <div style="display:flex;align-items:center;gap:6px;">

          <!-- Gas cost only -->
          <div style="display:flex;align-items:center;gap:3px;background:var(--bg-glass);border:1px solid var(--border-subtle);border-radius:5px;padding:3px 7px;flex-shrink:0;">
            <span style="font-size:10px;">⛽</span>
            <span style="font-family:var(--font-mono);font-size:10px;font-weight:600;color:var(--text-secondary);">${gasUSD}</span>
          </div>

          <!-- Time -->
          <div style="display:flex;align-items:center;gap:3px;background:var(--bg-glass);border:1px solid var(--border-subtle);border-radius:5px;padding:3px 7px;flex-shrink:0;">
            <span style="font-size:10px;">⏱</span>
            <span style="font-family:var(--font-mono);font-size:10px;font-weight:600;color:var(--text-secondary);">${time}</span>
          </div>

          <!-- Via -->
          <div style="display:flex;align-items:center;gap:4px;flex:1;min-width:0;overflow:hidden;">
            <span style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);flex-shrink:0;">via</span>
            ${tools.slice(0,2).map(t => {
              const _slug = t.name.toLowerCase().replace(/[\s\/]+/g,'-').replace(/[^a-z0-9\-]/g,'');
              const _fb = 'https://icons.llamao.fi/icons/protocols/'+_slug+'?w=48&h=48';
              const _src = t.logo || _fb;
              return '<div style="display:flex;align-items:center;gap:2px;background:var(--bg-glass);border:1px solid var(--border-subtle);border-radius:4px;padding:2px 5px;flex-shrink:0;">'
                +'<img src="'+_src+'" style="width:10px;height:10px;border-radius:2px;object-fit:cover;background:#fff;padding:1px;box-sizing:border-box;" onerror="if(this.src!==\''+_fb+'\'){this.src=\''+_fb+'\'}else{this.style.display=\'none\'}">'
                +'<span style="font-family:var(--font-mono);font-size:9px;font-weight:700;color:var(--text-secondary);">'+t.name+'</span>'
                +'</div>';
            }).join('')}
            <!-- Provider source badge -->
            <div style="margin-left:auto;display:flex;align-items:center;gap:3px;padding:2px 6px;border-radius:4px;font-size:8px;font-weight:800;font-family:var(--font-mono);letter-spacing:0.5px;flex-shrink:0;${
              !route._provider || route._provider==='lifi'
                ? 'color:#6366f1;background:rgba(99,102,241,0.10);border:1px solid rgba(99,102,241,0.3);'
                : route._provider==='rubic'
                  ? 'color:#a78bfa;background:rgba(167,139,250,0.10);border:1px solid rgba(167,139,250,0.3);'
                  : route._provider==='socket'
                    ? 'color:#818cf8;background:rgba(99,102,241,0.10);border:1px solid rgba(99,102,241,0.3);'
                    : 'color:#22d3ee;background:rgba(34,211,238,0.08);border:1px solid rgba(34,211,238,0.25);'
            }"><img src="${
              !route._provider || route._provider==='lifi'
                ? 'https://www.google.com/s2/favicons?domain=li.fi&sz=64'
                : route._provider==='rubic'
                  ? 'https://icons.llamao.fi/icons/protocols/rubic?w=48&h=48'
                  : route._provider==='socket'
                    ? 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSI4IiBmaWxsPSIjNjM2NkYxIi8+PHBhdGggZD0iTTggMTIuNUM4IDEwLjU2NyA5LjU2NyA5IDExLjUgOUgyMC41QzIyLjQzMyA5IDI0IDEwLjU2NyAyNCAxMi41QzI0IDE0LjQzMyAyMi40MzMgMTYgMjAuNSAxNkgxMS41QzkuNTY3IDE2IDggMTcuNTY3IDggMTkuNUM4IDIxLjQzMyA5LjU2NyAyMyAxMS41IDIzSDIwLjVDMjIuNDMzIDIzIDI0IDIxLjQzMyAyNCAxOS41IiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PGNpcmNsZSBjeD0iMjAuNSIgY3k9IjEyLjUiIHI9IjIiIGZpbGw9IndoaXRlIi8+PGNpcmNsZSBjeD0iMTEuNSIgY3k9IjE5LjUiIHI9IjIiIGZpbGw9IndoaXRlIi8+PC9zdmc+'
                    : 'https://www.google.com/s2/favicons?domain=rango.exchange&sz=64'
}" style="width:10px;height:10px;border-radius:2px;object-fit:cover;background:#fff;padding:1px;box-sizing:border-box;" onerror="this.onerror=null;this.style.display='none';">${
              !route._provider || route._provider==='lifi' ? 'LiFi' : route._provider==='rubic' ? 'Rubic' : route._provider==='socket' ? 'Socket' : route._provider.toUpperCase()
            }</div>
          </div>

        </div>

      `;

      card.addEventListener('click', () => brSelectRoute(idx));
      card.addEventListener('mouseenter', () => { card.style.transform = 'translateY(-2px)'; card.style.boxShadow = isBest ? '0 10px 36px rgba(99,102,241,0.25)' : '0 6px 24px rgba(0,0,0,0.45)'; });
      card.addEventListener('mouseleave', () => { card.style.transform = ''; card.style.boxShadow = ''; });
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

