
function _swDexIconHtml(dexDisplayName, bgColor, apiLogoUrl) {
  const _imgDiv = (src) =>
    `<div style="width:28px;height:28px;border-radius:8px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;">
      <img src="${src}" width="20" height="20" style="border-radius:4px;object-fit:contain;" onerror="if(this.parentNode){this.parentNode.innerHTML='<span style=\'font-size:9px;font-weight:800;color:#fff;\'>${dexDisplayName.slice(0,2).toUpperCase()}</span>';this.parentNode.style.background='${bgColor}';}" />
    </div>`;
  // Priority 1: API-provided logo (LI.FI toolDetails.logoURI / Rango swapperLogo)
  if (apiLogoUrl) return _imgDiv(apiLogoUrl);
  // Priority 2: Inline SVG for Socket & LiFi
  const _inlineName = Object.keys(_SW_INLINE_LOGOS).find(k => dexDisplayName === k || dexDisplayName.startsWith(k));
  if (_inlineName) {
    return `<div style="width:28px;height:28px;border-radius:8px;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;">${_SW_INLINE_LOGOS[_inlineName]}</div>`;
  }
  // Priority 3: Static logo map (exact match)
  let logoUrl = SW_DEX_LOGOS[dexDisplayName];
  if (logoUrl === null) logoUrl = undefined; // null = intentionally no URL, fall through to prefix/inline
  // Priority 4: Prefix/substring fallback
  if (!logoUrl) {
    for (const [prefix, url] of SW_DEX_LOGO_PREFIXES) {
      if (dexDisplayName.startsWith(prefix) || dexDisplayName.includes(prefix)) { logoUrl = url; break; }
    }
  }
  if (logoUrl) return _imgDiv(logoUrl);
  // Fallback: colored initials badge
  return `<div style="width:28px;height:28px;border-radius:8px;background:${bgColor};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:#fff;flex-shrink:0;">${dexDisplayName.slice(0,2).toUpperCase()}</div>`;
}

function swRenderDexComparison() {
  const list = document.getElementById('sw-dex-list');
  if (!list) return;

  // Respect user's existing selection; only default to 0 if none set
  if (SW._userSelectedDexIdx == null) SW._userSelectedDexIdx = 0;
  const selectedIdx = SW._userSelectedDexIdx;

  if (!SW.quotes || !SW.quotes[0] || SW.quotes[0].output == null) return;
  const best = SW.quotes[0].output; // true best is always SW.quotes[0]

  function buildRow(q, i, dqArr) {
    const pct = ((q.output / best) * 100).toFixed(1);
    const selectedDexName = SW._manualDexName || (SW.quotes[0] && SW.quotes[0].dex);
    // Use unique route key (dex::apiSource) to distinguish same-name routers from different APIs
    const _qRouteKey = q.dex + '::' + (q.apiSource || '');
    const _selRouteKey = SW._manualRouteKey || (SW.quotes[0] && (SW.quotes[0].dex + '::' + (SW.quotes[0].apiSource || '')));
    const isSelected = SW._manualRouteKey ? (_qRouteKey === _selRouteKey) : (i === 0 && !SW._manualDexName);
    const isBest = q.dex === SW.quotes[0].dex && (q.apiSource || '') === (SW.quotes[0].apiSource || '');
    const checkIcon = isSelected
      ? `<span class="material-icons-round" style="font-size:16px;color:var(--accent-green);flex-shrink:0;filter:drop-shadow(0 0 4px rgba(16,185,129,0.6));">check_circle</span>`
      : `<span style="width:16px;display:inline-block;flex-shrink:0;"></span>`;
    const badge = '';
    // ── API source tag ──
    const _API_TAG_MAP = {
      'lifi': { label: 'LiFi', bg: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.35)', color: '#a78bfa' },
      'rango': { label: 'Rango', bg: 'rgba(255,140,0,0.12)', border: 'rgba(255,140,0,0.35)', color: '#fb923c' },
      'odos': { label: 'Odos', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)', color: '#fb923c' },
      '1inch': { label: '1inch', bg: 'rgba(27,49,79,0.2)', border: 'rgba(99,102,241,0.3)', color: '#818cf8' },
      'kyberswap': { label: 'Kyber', bg: 'rgba(49,203,158,0.12)', border: 'rgba(49,203,158,0.3)', color: '#34d399' },
      'openocean': { label: 'OcnOcn', bg: 'rgba(0,209,255,0.1)', border: 'rgba(0,209,255,0.3)', color: '#22d3ee' },
      'socket': { label: 'Socket', bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.3)', color: '#818cf8' },
      'symbiosis': { label: 'Symbi', bg: 'rgba(126,211,33,0.1)', border: 'rgba(126,211,33,0.3)', color: '#a3e635' },
      'enso': { label: 'Enso', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)', color: '#60a5fa' },
      'velora': { label: 'Velora', bg: 'rgba(168,85,247,0.1)', border: 'rgba(168,85,247,0.3)', color: '#c084fc' },
      'dodo': { label: 'DODO', bg: 'rgba(255,232,4,0.12)', border: 'rgba(255,232,4,0.3)', color: '#fbbf24' },
      'portals': { label: 'Portals', bg: 'rgba(0,212,170,0.12)', border: 'rgba(0,212,170,0.3)', color: '#00d4aa' },
      'fly':    { label: 'Fly',    bg: 'rgba(0,207,253,0.12)', border: 'rgba(0,207,253,0.3)', color: '#22d3ee' },
      'okxdex': { label: 'OKX',    bg: 'rgba(0,212,255,0.12)', border: 'rgba(0,212,255,0.35)', color: '#00d4ff' },
      'squid':  { label: 'Squid',  bg: 'rgba(232,74,95,0.12)', border: 'rgba(232,74,95,0.35)', color: '#e84a5f' },
    };
    const _srcKey = (q.apiSource || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const _apiTag = _API_TAG_MAP[_srcKey];
    const apiTagHtml = _apiTag
      ? `<span style="font-size:7px;font-weight:700;letter-spacing:0.4px;padding:1px 5px;border-radius:4px;background:${_apiTag.bg};border:1px solid ${_apiTag.border};color:${_apiTag.color};flex-shrink:0;">${_apiTag.label}</span>`
      : '';
    const _v1 = q.output;
    const _toDecDisplay = SW.toToken ? Math.min(SW.toToken.decimals || 18, 8) : 8;
    // Adaptive precision based on value magnitude AND token decimal cap
    const fmtOut = _v1 >= 1e6 ? _v1.toLocaleString('en-US',{minimumFractionDigits:Math.min(1,_toDecDisplay),maximumFractionDigits:Math.min(1,_toDecDisplay)})
                 : _v1 >= 1000 ? _v1.toLocaleString('en-US',{minimumFractionDigits:Math.min(2,_toDecDisplay),maximumFractionDigits:Math.min(2,_toDecDisplay)})
                 : _v1 >= 100  ? _v1.toLocaleString('en-US',{minimumFractionDigits:Math.min(2,_toDecDisplay),maximumFractionDigits:Math.min(3,_toDecDisplay)})
                 : _v1 >= 10   ? _v1.toLocaleString('en-US',{minimumFractionDigits:Math.min(3,_toDecDisplay),maximumFractionDigits:Math.min(4,_toDecDisplay)})
                 : _v1 >= 1    ? _v1.toLocaleString('en-US',{minimumFractionDigits:Math.min(3,_toDecDisplay),maximumFractionDigits:Math.min(5,_toDecDisplay)})
                 : _v1 >= 0.01 ? parseFloat(_v1.toFixed(Math.min(6,_toDecDisplay))).toString()
                 :               parseFloat(_v1.toPrecision(Math.min(6,_toDecDisplay+2))).toString();
    // Fix: match by BOTH dex name AND apiSource — prevents same-name router from 2 different APIs colliding
    const realIdx = SW.quotes.findIndex(rq => rq.dex === q.dex && (rq.apiSource || '') === (q.apiSource || ''));
    const rowClass = isSelected ? 'sw-dex-row selected-dex' : isBest ? 'sw-dex-row best-dex' : 'sw-dex-row';
    return `<div class="${rowClass}" onclick="swSelectDex(${realIdx >= 0 ? realIdx : i})" data-dex-idx="${i}" style="">
      <div class="sw-dex-bar" style="width:${pct}%;"></div>
      <div class="sw-dex-content">
        ${_swDexIconHtml(q.dex, q.color, q.routerLogoURI || null)}
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <span style="font-size:12px;font-weight:700;white-space:nowrap;flex-shrink:0;">${q.dex}</span>
            ${apiTagHtml}
            ${badge}
            ${isBest && !isSelected ? '<span style="font-size:8px;font-weight:700;color:var(--accent-green);background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.25);padding:1px 6px;border-radius:5px;letter-spacing:0.5px;flex-shrink:0;">BEST</span>' : ''}
          </div>
          <div style="font-family:var(--font-mono);font-size:9px;color:var(--text-secondary);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><span class="sw-gas-fee-chip" data-dex="${q.dex}" onclick="event.stopPropagation();swRefreshGasFee(this)" style="cursor:pointer;border-radius:4px;padding:1px 3px;transition:background 0.15s;" onmouseenter="this.style.background='rgba(99,102,241,0.15)'" onmouseleave="this.style.background=''">⛽ ${q.gasFee}</span> · <span style="color:${q.impact > 0 ? 'var(--accent-green)' : q.impact < -1 ? 'var(--accent-red)' : q.impact < -0.3 ? 'var(--accent-amber)' : 'var(--text-secondary)'}">Impact: ${q.impact > 0 ? '+' : ''}${Math.abs(q.impact) < 0.01 ? (q.impact >= 0 ? '<+0.01' : '<-0.01') : q.impact.toFixed(2)}%</span></div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
          <div style="text-align:right;">
            <div style="font-family:var(--font-mono);font-size:11px;font-weight:700;color:var(--accent-green);">${fmtOut}</div>
            <div style="font-family:var(--font-mono);font-size:9px;color:var(--text-secondary);">${pct}%</div>
          </div>
          ${checkIcon}
        </div>
      </div>
    </div>`;
  }

  // Build display order: best always 1st, manual-selected always 2nd (if different), rest after
  let displayQuotes = [...SW.quotes];
  const manualKey = SW._manualRouteKey;
  if (manualKey && (displayQuotes[0].dex + '::' + (displayQuotes[0].apiSource || '')) !== manualKey) {
    const mIdx = displayQuotes.findIndex(q => (q.dex + '::' + (q.apiSource || '')) === manualKey);
    if (mIdx > 1) {
      const [picked] = displayQuotes.splice(mIdx, 1);
      displayQuotes.splice(1, 0, picked);
    }
  }

  // Render all quotes — scroll wrapper handles overflow
  list.innerHTML = displayQuotes.map((q, i) => buildRow(q, i, displayQuotes)).join('');

  // Show selected DEX badge
  _swUpdateSelectedDexBadge(SW.bestDex?.dex || SW.quotes[0].dex);
}

window.swToggleMoreRoutes = function() {}; // no-op — replaced by scroll

// Track which index user has manually selected (null = auto best)
SW._userSelectedDexIdx = null;

// ── Smooth TO amount update with fade ──
function _swSetToAmount(val, usdText) {
  const el = document.getElementById('sw-to-amount');
  const usdEl = document.getElementById('sw-to-usd');
  if (!el) return;
  // Fade out → update → fade in
  el.style.opacity = '0';
  setTimeout(() => {
    el.textContent = val;
    if (usdEl && usdText !== undefined) usdEl.textContent = usdText;
    el.style.opacity = '1';
  }, 120);
}



function swSelectDex(idx) {
  if (!SW.quotes || !SW.quotes[idx]) return;

  const pickedDex = SW.quotes[idx];

  // If picking index 0 (best), clear manual selection
  if (idx === 0) {
    SW._manualDexName = null;
    SW._manualDexIdx = null;
    SW._manualRouteKey = null;
    SW._userSelectedDexIdx = 0;
    SW.bestDex = pickedDex;
    SW.toAmount = pickedDex.output;
    if (pickedDex.txData) SW._cachedSwapTx = pickedDex.txData;
  } else {
    // User manually picked a non-best route — store unique key to avoid same-name cross-API collision
    SW._manualDexName = pickedDex.dex;
    SW._manualRouteKey = pickedDex.dex + '::' + (pickedDex.apiSource || '');
    SW._manualDexIdx = idx;
    // TO box still shows BEST (index 0) but we mark manual for display
    // Actually: TO box shows the manually selected route as per user intent
    SW._userSelectedDexIdx = idx;
    SW.bestDex = pickedDex;
    SW.toAmount = pickedDex.output;
    if (pickedDex.txData) SW._cachedSwapTx = pickedDex.txData;
  }

  // Update TO box with smooth fade
  const _tp2 = SW.toToken?.price || 0;
  const _usdTxt2 = _tp2 > 0
    ? `≈ ${_formatCurrencyDisplay(SW.toAmount * _tp2)}`
    : '≈ —';
  _swSetToAmount(
    swFormatAmount(SW.toAmount, SW.toToken ? SW.toToken.decimals : 18),
    _usdTxt2
  );
  const toAmtEl2 = document.getElementById('sw-to-amount');
  if (toAmtEl2) toAmtEl2.style.color = 'var(--accent-green)';
  swRenderInfoPanel();

  // Rebuild DEX rows — best always 1st, selected always 2nd (if different)
  swRenderDexComparison();

  // Update selected DEX indicator badge
  _swUpdateSelectedDexBadge(SW.bestDex.dex);

  // Cache router for selected DEX
  const _newDexName = SW.bestDex.dex || '';
  const _hardcodedRouter = _getDexRouter(_newDexName, SW.network.chainId);
  SW._cachedRouterAddr = _hardcodedRouter || SW._routerCache[_newDexName] || null;

  _swHideSuccessMsg();
  swUpdateButton();
  if (typeof haptic === 'function') haptic();
}

// Re-render all visible DEX rows with correct selected highlight
function _swRedrawDexRows(selectedIdx) {
  if (!SW.quotes) return;
  const best = SW.quotes[0].output;
  const list = document.getElementById('sw-dex-list');
  if (!list) return;

  function buildRow(q, i) {
    const pct = ((q.output / best) * 100).toFixed(1);
    const isSelected = i === selectedIdx;
    const isBest = i === 0;
    const checkIcon = isSelected
      ? `<span class="material-icons-round" style="font-size:16px;color:var(--accent-green);flex-shrink:0;filter:drop-shadow(0 0 4px rgba(16,185,129,0.6));">check_circle</span>`
      : `<span style="width:16px;display:inline-block;flex-shrink:0;"></span>`;
    const selectedBadge = isSelected
      ? ``
      : (isBest ? `<span style="font-size:8px;font-weight:700;color:var(--accent-green);background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.25);padding:1px 6px;border-radius:5px;letter-spacing:0.5px;">BEST</span>` : '');
    const _API_TAG_MAP2 = {
      'lifi': { label: 'LiFi', bg: 'rgba(139,92,246,0.15)', border: 'rgba(139,92,246,0.35)', color: '#a78bfa' },
      'rango': { label: 'Rango', bg: 'rgba(255,140,0,0.12)', border: 'rgba(255,140,0,0.35)', color: '#fb923c' },
      'odos': { label: 'Odos', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)', color: '#fb923c' },
      '1inch': { label: '1inch', bg: 'rgba(27,49,79,0.2)', border: 'rgba(99,102,241,0.3)', color: '#818cf8' },
      'kyberswap': { label: 'Kyber', bg: 'rgba(49,203,158,0.12)', border: 'rgba(49,203,158,0.3)', color: '#34d399' },
      'openocean': { label: 'OcnOcn', bg: 'rgba(0,209,255,0.1)', border: 'rgba(0,209,255,0.3)', color: '#22d3ee' },
      'socket': { label: 'Socket', bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.3)', color: '#818cf8' },
      'symbiosis': { label: 'Symbi', bg: 'rgba(126,211,33,0.1)', border: 'rgba(126,211,33,0.3)', color: '#a3e635' },
      'enso': { label: 'Enso', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)', color: '#60a5fa' },
      'velora': { label: 'Velora', bg: 'rgba(168,85,247,0.1)', border: 'rgba(168,85,247,0.3)', color: '#c084fc' },
      'dodo': { label: 'DODO', bg: 'rgba(255,232,4,0.12)', border: 'rgba(255,232,4,0.3)', color: '#fbbf24' },
      'portals': { label: 'Portals', bg: 'rgba(0,212,170,0.12)', border: 'rgba(0,212,170,0.3)', color: '#00d4aa' },
      'fly':    { label: 'Fly',    bg: 'rgba(0,207,253,0.12)', border: 'rgba(0,207,253,0.3)', color: '#22d3ee' },
      'okxdex': { label: 'OKX',    bg: 'rgba(0,212,255,0.12)', border: 'rgba(0,212,255,0.35)', color: '#00d4ff' },
      'squid':  { label: 'Squid',  bg: 'rgba(232,74,95,0.12)', border: 'rgba(232,74,95,0.35)', color: '#e84a5f' },
    };
    const _srcKey2 = (q.apiSource || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const _apiTag2 = _API_TAG_MAP2[_srcKey2];
    const apiTagHtml2 = _apiTag2
      ? `<span style="font-size:7px;font-weight:700;letter-spacing:0.4px;padding:1px 5px;border-radius:4px;background:${_apiTag2.bg};border:1px solid ${_apiTag2.border};color:${_apiTag2.color};flex-shrink:0;">${_apiTag2.label}</span>`
      : '';
    const _v2 = q.output;
    const fmtOut = _v2 >= 1000 ? _v2.toLocaleString('en-US',{minimumFractionDigits:1,maximumFractionDigits:1})
                 : _v2 >= 100  ? _v2.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})
                 : _v2 >= 10   ? _v2.toLocaleString('en-US',{minimumFractionDigits:3,maximumFractionDigits:3})
                 : _v2 >= 1    ? _v2.toLocaleString('en-US',{minimumFractionDigits:3,maximumFractionDigits:3})
                 :               _v2.toPrecision(4);
    const rowClass3 = isSelected ? 'sw-dex-row selected-dex' : isBest ? 'sw-dex-row best-dex' : 'sw-dex-row';
    return `<div class="${rowClass3}" onclick="swSelectDex(${i})" data-dex-idx="${i}" style="">
      <div class="sw-dex-bar" style="width:${pct}%;"></div>
      <div class="sw-dex-content">
        ${_swDexIconHtml(q.dex, q.color, q.routerLogoURI || null)}
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <span style="font-size:12px;font-weight:700;white-space:nowrap;flex-shrink:0;">${q.dex}</span>
            ${apiTagHtml2}
            ${selectedBadge}
          </div>
          <div style="font-family:var(--font-mono);font-size:9px;color:var(--text-secondary);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><span class="sw-gas-fee-chip" data-dex="${q.dex}" onclick="event.stopPropagation();swRefreshGasFee(this)" style="cursor:pointer;border-radius:4px;padding:1px 3px;transition:background 0.15s;" onmouseenter="this.style.background='rgba(99,102,241,0.15)'" onmouseleave="this.style.background=''">⛽ ${q.gasFee}</span> · <span style="color:${q.impact > 0 ? 'var(--accent-green)' : q.impact < -1 ? 'var(--accent-red)' : q.impact < -0.3 ? 'var(--accent-amber)' : 'var(--text-secondary)'}">Impact: ${q.impact > 0 ? '+' : ''}${Math.abs(q.impact) < 0.01 ? (q.impact >= 0 ? '<+0.01' : '<-0.01') : q.impact.toFixed(2)}%</span></div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
          <div style="text-align:right;">
            <div style="font-family:var(--font-mono);font-size:11px;font-weight:700;color:var(--accent-green);">${fmtOut}</div>
            <div style="font-family:var(--font-mono);font-size:9px;color:var(--text-secondary);">${pct}%</div>
          </div>
          ${checkIcon}
        </div>
      </div>
    </div>`;
  }

  // Render all quotes — scroll wrapper handles overflow
  list.innerHTML = SW.quotes.map((q, i) => buildRow(q, i)).join('');
}

// Show/update the selected DEX badge above swap button
function _swUpdateSelectedDexBadge(dexName) {
  let badge = document.getElementById('sw-selected-dex-badge');
  if (!badge) {
    // Create the badge element just before sw-action-btn
    const btn = document.getElementById('sw-action-btn');
    if (!btn) return;
    badge = document.createElement('div');
    badge.id = 'sw-selected-dex-badge';
    badge.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.25);border-radius:10px;margin-bottom:10px;';
    btn.parentNode.insertBefore(badge, btn);
  }
  badge.innerHTML = ''; // ROUTING VIA removed
  badge.style.display = 'none';
}

function swRenderInfoPanel() {
  if (!SW.bestDex) return;
  const fromAmt = parseFloat(SW.fromAmount);
  const q = SW.bestDex;
  const rateVal = (fromAmt > 0 && isFinite(q.output/fromAmt)) ? (q.output/fromAmt).toLocaleString('en-US',{minimumFractionDigits:4,maximumFractionDigits:4}) : '—';
  const rate = `1 ${SW.fromToken.sym} = ${rateVal} ${SW.toToken.sym}`;
  const impact = q.impact > 0 ? 'var(--accent-green)' : q.impact > -0.3 ? 'var(--text-secondary)' : q.impact > -1 ? 'var(--accent-amber)' : 'var(--accent-red)';
  const minReceived = (q.output * (1 - SW.slippage/100)).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4});

  const r = document.getElementById('sw-info-rate');
  const imp = document.getElementById('sw-info-impact');
  const gas = document.getElementById('sw-info-gas');
  const min = document.getElementById('sw-info-min');
  if (r)   r.textContent = rate;
  if (imp) { imp.textContent = `${q.impact > 0 ? '+' : ''}${q.impact.toFixed(3)}%`; imp.style.color = impact; }
  if (gas) gas.textContent = q.gasFee && (q.gasFee.startsWith('$') || q.gasFee.startsWith('<') || q.gasFee === '—' || q.gasFee === '⏳') ? q.gasFee : `~$${q.gasFee}`;
  if (min) min.textContent = `${minReceived} ${SW.toToken.sym}`;

  // Route nodes
  const routePath = document.getElementById('sw-route-path');
  const routeNodes = document.getElementById('sw-route-nodes');
  if (routePath && routeNodes) {
    routePath.style.display = 'block';
    const mid = SW.fromToken.sym !== 'WETH' && SW.toToken.sym !== 'WETH' ? ['WETH'] : [];
    const path = [SW.fromToken.sym, ...mid, SW.toToken.sym];
    routeNodes.innerHTML = path.map((p,i) => 
      `<span class="sw-route-node">${p}</span>${i < path.length-1 ? '<span class="sw-route-arrow"> → </span>' : ''}`
    ).join('');
  }
}

function swCheckSplitRoute() {
  if (!SW.multiRoute || SW.quotes.length < 2) {
    {const _sb=document.getElementById('sw-split-badge');if(_sb)_sb.style.display='none';}
    return;
  }
  const diff = ((SW.quotes[0].output - SW.quotes[1].output) / SW.quotes[0].output) * 100;
  if (diff < 0.05) {
    // Show split badge for close quotes
    const split = document.getElementById('sw-split-badge');
    const desc = document.getElementById('sw-split-desc');
    if (split && desc) {
      split.style.display = 'flex';
      desc.textContent = `60% via ${SW.quotes[0].dex} + 40% via ${SW.quotes[1].dex}`;
    }
  } else {
    {const _sb=document.getElementById('sw-split-badge');if(_sb)_sb.style.display='none';}
  }
}