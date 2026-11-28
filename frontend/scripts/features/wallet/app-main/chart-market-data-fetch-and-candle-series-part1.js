

async function _tcfFetchMarketData(t) {
  const sym = _cgIdToSymbol(t.cgId || '') || (oneSymbolPriceAllowed(t) ? t.sub?.toUpperCase() : null);

  // ── Parallel fetch: Binance + CoinGecko run simultaneously ──
  // Winner = first valid price, with Binance preferred
  function apply(result) {
    _tcfApplyMarketData(result.price, result.change, result.mcap, result.vol, result.high, result.low, result.supply, result.ath, t.sub);
    _lwSetSource('', false); // source label hidden from UI
  }

  // ── Launch Binance + CoinGecko in parallel ──
  const binancePromise = sym ? _tcfFetchBinanceTicker(sym).catch(() => null) : Promise.resolve(null);
  const cgPromise = t.cgId
    ? _cgFetch('coins/' + t.cgId + '?localization=false&tickers=false&community_data=false&developer_data=false')
        .then(d => {
          const md = d.market_data || {};
          // Update About section
          const desc = d.description?.en;
          if (desc) {
            const aboutSec = document.getElementById('tcf-about-section');
            const aboutTxt = document.getElementById('tcf-about-text');
            if (aboutSec && aboutTxt) {
              const clean = desc.replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
              aboutTxt.textContent = clean;
              aboutTxt.className = 'tc-about-txt collapsed';
              aboutSec.style.display = 'block';
              // Show Read More if text is long enough
              const readmoreBtn = document.getElementById('tcf-readmore-btn');
              if (readmoreBtn && clean.length > 120) readmoreBtn.style.display = 'inline-flex';
            }
          }
          const price = md.current_price?.usd || 0;
          if (!price) return null;
          return {
            price, change: md.price_change_percentage_24h || 0,
            mcap: md.market_cap?.usd || null, vol: md.total_volume?.usd || null,
            high: md.high_24h?.usd || null, low: md.low_24h?.usd || null,
            supply: md.circulating_supply || null, ath: md.ath?.usd || null,
          };
        }).catch(() => null)
    : Promise.resolve(null);

  // Race: apply Binance first if it wins AND has price
  const [binanceResult, cgResult] = await Promise.all([binancePromise, cgPromise]);

  if (binanceResult && binanceResult.price) {
    // Use Binance price but supplement with CoinGecko rich data (mcap, supply, ath)
    const merged = { ...binanceResult };
    if (cgResult) {
      merged.mcap   = cgResult.mcap   || binanceResult.mcap;
      merged.supply = cgResult.supply || null;
      merged.ath    = cgResult.ath    || null;
    }
    apply(merged);
    return;
  }

  if (cgResult && cgResult.price) { apply(cgResult); return; }

  // ── Parallel fallback: CMC + DexScreener ──
  const [cmcResult, dexResult] = await Promise.allSettled([
    _tcfFetchCoinMarketCap(t),
    _tcfFetchDexScreener(t),
  ]);
  if (cmcResult.status === 'fulfilled' && cmcResult.value?.price) { apply(cmcResult.value); return; }
  if (dexResult.status === 'fulfilled' && dexResult.value?.price) { apply(dexResult.value); return; }

  // ── Final: OKX as last resort ──
  if (sym) {
    try {
      const d = window.fetchJsonWithFallback
        ? await window.fetchJsonWithFallback(`https://www.okx.com/api/v5/market/ticker?instId=${sym}-USDT`, 7000)
        : await (await window.nxFetch(`https://www.okx.com/api/v5/market/ticker?instId=${sym}-USDT`, { ms: 7000 })).json();
      {
        const item = d.data?.[0];
        if (item) {
          const price = parseFloat(item.last);
          const open  = parseFloat(item.open24h);
          if (price > 0) {
            apply({
              price, change: open ? ((price - open) / open) * 100 : 0,
              mcap: null, vol: parseFloat(item.volCcy24h) || null,
              high: parseFloat(item.high24h) || null,
              low:  parseFloat(item.low24h)  || null,
              supply: null, ath: null,
            });
          }
        }
      }
    } catch(e) {}
  }
}

async function _tcfFetchChart(t, hours) {
  const loadEl = document.getElementById('tcf-chart-loading');
  const svgEl  = document.getElementById('tcf-chart-svg');

  function setLoadMsg(msg) {
    if (loadEl) {
      loadEl.style.display = 'flex';
      loadEl.style.background = 'rgba(10,10,18,0.55)';
      loadEl.style.alignItems = 'center';
      loadEl.style.justifyContent = 'center';
      loadEl.style.paddingBottom = '0';
      loadEl.innerHTML = `<div style="display:flex;align-items:center;gap:7px;"><div style="width:12px;height:12px;border:2px solid rgba(99,102,241,0.3);border-top-color:var(--accent-primary);border-radius:50%;animation:spin 0.8s linear infinite;flex-shrink:0;"></div><span style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);">${msg}</span></div>`;
    }
  }

  const sym = _cgIdToSymbol(t.cgId || '');
  if (!t.cgId && !sym) {
    const basePrice = parseFloat((document.getElementById('tcf-price')?.textContent||'').replace(/[$,]/g,'')) || 100;
    const chartType = window._tcfChartType || 'line';
    if (svgEl) svgEl.style.display = 'block';
    if (chartType === 'candle') _tcfDrawCandleChart(_genDemoCandleData(hours, basePrice), hours);
    else _tcfDrawChart(_genDemoLineData(hours, basePrice), hours);
    if (loadEl) { loadEl.style.display = 'flex'; loadEl.style.background = 'transparent'; loadEl.style.alignItems = 'flex-end'; loadEl.style.justifyContent = 'center'; loadEl.style.paddingBottom = '4px'; loadEl.innerHTML = '<span style="font-size:9px;color:var(--text-muted);font-family:var(--font-mono);background:rgba(10,10,18,0.7);padding:2px 8px;border-radius:5px;">DEMO DATA</span>'; }
    return;
  }

  const chartType = window._tcfChartType || 'line';
  // Try CoinGecko/CMC first if cgId is available for reliable data
  const SOURCES = t.cgId
    ? (sym
        ? ['CoinGecko','CoinMarketCap','Binance','OKX','Kraken','KuCoin','Bitget','DexScreener']
        : ['CoinGecko','DexScreener'])
    : (sym
        ? ['Binance','OKX','Kraken','KuCoin','Bitget','CoinMarketCap','DexScreener']
        : ['DexScreener']);

  // Try each source sequentially — auto-retry without user interaction
  for (let i = 0; i < SOURCES.length; i++) {
    const src = SOURCES[i];
    setLoadMsg(`Trying ${src}…`);
    try {
      let result = null;
      if (chartType === 'candle') {
        // Run targeted single-source attempt
        result = await _fetchCandleFromSource(t, sym, src, hours);
        if (result && result.length >= 2) {
          _tcfDrawCandleChart(result, hours);
          if (loadEl) loadEl.style.display = 'none';
          if (svgEl) svgEl.style.display = 'block';
          return;
        }
      } else {
        result = await _fetchLineFromSource(t, sym, src, hours);
        if (result && result.length >= 2) {
          _tcfDrawChart(result, hours);
          _tcfUpdateSparkline(result);
          if (loadEl) loadEl.style.display = 'none';
          if (svgEl) svgEl.style.display = 'block';
          return;
        }
      }
    } catch(e) {}
  }

  // All sources failed — show demo chart with note
  const basePrice = parseFloat((document.getElementById('tcf-price')?.textContent||'').replace(/[$,]/g,'')) || 100;
  if (svgEl) svgEl.style.display = 'block';
  if (chartType === 'candle') _tcfDrawCandleChart(_genDemoCandleData(hours, basePrice), hours);
  else _tcfDrawChart(_genDemoLineData(hours, basePrice), hours);
  if (loadEl) {
    loadEl.style.display = 'flex';
    loadEl.style.background = 'transparent';
    loadEl.style.alignItems = 'flex-end';
    loadEl.style.justifyContent = 'center';
    loadEl.style.paddingBottom = '4px';
    loadEl.innerHTML = '<span style="font-size:9px;color:var(--text-muted);font-family:var(--font-mono);cursor:pointer;background:rgba(10,10,18,0.75);padding:3px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.06);" onclick="_tcfFetchChart(window._tcfToken,window._tcfHours||24)">\u21ba All sources failed — tap to retry</span>';
  }
}

// ── Draw mini sparkline in top bar from price data ──
function _tcfUpdateSparkline(prices) {
  // prices: array of [timestamp, price] or just [price]
  try {
    const sparkSvg = document.getElementById('tcf-sparkline');
    const sparkLine = document.getElementById('tcf-sparkline-line');
    if (!sparkSvg || !sparkLine || !prices || prices.length < 2) return;
    const vals = prices.map(p => Array.isArray(p) ? p[1] : p);
    const W = 52, H = 22, pad = 1.5;
    const min = Math.min(...vals), max = Math.max(...vals);
    const range = max - min || 1;
    const pts = vals.map((v, i) => {
      const x = pad + (i / (vals.length - 1)) * (W - pad * 2);
      const y = pad + (1 - (v - min) / range) * (H - pad * 2);
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    sparkLine.setAttribute('points', pts);
    // Color: green if last > first, red if down
    const isUp = vals[vals.length-1] >= vals[0];
    sparkLine.setAttribute('stroke', isUp ? 'var(--accent-green)' : 'var(--accent-red)');
    sparkSvg.style.opacity = '1';
  } catch(e) {}
}

// ── Single-source LINE fetch ──
async function _fetchLineFromSource(t, sym, source, hours) {
  switch(source) {
    case 'Binance': {
      if (!sym) return null;
      let interval, limit;
      if (hours <= 1)   { interval='1m';  limit=60; }
      else if (hours<=4)  { interval='5m';  limit=48; }
      else if (hours<=24) { interval='1h';  limit=hours; }
      else if (hours<=168){ interval='4h';  limit=Math.ceil(hours/4); }
      else                { interval='1d';  limit=Math.ceil(hours/24); }
      const k = await _binanceKlines(sym, interval, limit);
      return k ? k.map(r=>[parseInt(r[0]),parseFloat(r[4])]) : null;
    }
    case 'OKX': {
      if (!sym) return null;
      let bar, limit;
      if (hours<=1)   { bar='1m';  limit=60; }
      else if (hours<=4)  { bar='5m';  limit=48; }
      else if (hours<=24) { bar='1H';  limit=24; }
      else if (hours<=168){ bar='4H';  limit=Math.ceil(hours/4); }
      else                { bar='1D';  limit=Math.ceil(hours/24); }
      const r = await _okxKlines(sym, bar, limit);
      return r ? r.map(x=>[x[0],x[4]]) : null;
    }
    case 'Kraken': {
      if (!sym) return null;
      const r = await _krakenOHLC(sym, null, hours);
      return r ? r.map(x=>[x[0],x[4]]) : null;
    }
    case 'KuCoin': {
      if (!sym) return null;
      let type;
      if (hours<=1) type='1min'; else if (hours<=4) type='5min';
      else if (hours<=24) type='1hour'; else if (hours<=168) type='4hour'; else type='1day';
      const r = await _kucoinKlines(sym, type, hours);
      return r ? r.map(x=>[x[0],x[4]]) : null;
    }
    case 'Bitget': {
      if (!sym) return null;
      let gran, limit;
      if (hours<=1) {gran=60;limit=60;} else if (hours<=4) {gran=300;limit=48;}
      else if (hours<=24) {gran=3600;limit=hours;} else if (hours<=168) {gran=14400;limit=Math.ceil(hours/4);}
      else {gran=86400;limit=Math.ceil(hours/24);}
      const r = await _bitgetKlines(sym, gran, limit);
      return r ? r.map(k=>[parseInt(k[0]),parseFloat(k[4])]).sort((a,b)=>a[0]-b[0]) : null;
    }
    case 'CoinMarketCap': {
      const period = hours<=24?'1D':hours<=168?'7D':'30D';
      const p = await _cmcQuoteChart(sym||t.cgId, period);
      return (p&&p.length>2) ? p : null;
    }
    case 'CoinGecko': {
      const days = hours<=4?'1':hours<=24?'1':hours<=168?'7':'30';
      const interval = hours<=24?'hourly':'daily';
      const data = await _cgFetch('coins/'+t.cgId+'/market_chart?vs_currency=usd&days='+days+'&interval='+interval);
      let prices = data.prices||[];
      if (hours<24) { const cutoff=Date.now()-hours*3600000; prices=prices.filter(p=>p[0]>=cutoff); }
      return prices.length>=2 ? prices : null;
    }
    case 'DexScreener': {
      // DexScreener returns single price, build synthesized line
      const addr = t.contract || t.address || t.contractAddress || t.id;
      if (!addr || !addr.startsWith('0x')) return null;
      try {
        const chainId = t.chainId || t.chain;
        const chainMap = {1:'ethereum',8453:'base',42161:'arbitrum',10:'optimism',137:'polygon',56:'bsc',43114:'avalanche',324:'zksync'};
        const dsChain = chainMap[chainId] || 'ethereum';
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${addr}`, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return null;
        const data = await res.json();
        const pair = (data.pairs||[]).sort((a,b)=>(b.liquidity?.usd||0)-(a.liquidity?.usd||0))[0];
        if (!pair) return null;
        const price = parseFloat(pair.priceUsd||0);
        if (!price) return null;
        const change = parseFloat(pair.priceChange?.h24||0)/100;
        const openPrice = price / (1 + change);
        const now = Date.now();
        const count = Math.min(80, hours<=4?48:hours<=24?72:90);
        const step = (hours*3600000)/count;
        const out = [];
        for (let i=0;i<count;i++) {
          const frac = i/(count-1);
          const p = openPrice + (price-openPrice)*frac + (Math.random()-0.5)*price*0.012;
          out.push([now-(count-i)*step, Math.max(price*0.01, p)]);
        }
        return out.length>=2 ? out : null;
      } catch(e) { return null; }
    }
  }
  return null;
}

// ── Single-source CANDLE fetch ──
async function _fetchCandleFromSource(t, sym, source, hours) {
  switch(source) {
    case 'Binance': {
      if (!sym) return null;
      let interval, limit;
      if (hours<=4)   { interval='5m';  limit=48; }
      else if (hours<=24) { interval='1h';  limit=hours; }
      else if (hours<=168){ interval='4h';  limit=Math.ceil(hours/4); }
      else                { interval='1d';  limit=Math.ceil(hours/24); }
      const k = await _binanceKlines(sym, interval, limit);
      return k ? k.map(r=>[parseInt(r[0]),parseFloat(r[1]),parseFloat(r[2]),parseFloat(r[3]),parseFloat(r[4])]) : null;
    }
    case 'OKX': {
      if (!sym) return null;
      let bar, limit;
      if (hours<=4)   { bar='5m';  limit=48; }
      else if (hours<=24) { bar='1H';  limit=24; }
      else if (hours<=168){ bar='4H';  limit=Math.ceil(hours/4); }
      else                { bar='1D';  limit=Math.ceil(hours/24); }
      return await _okxKlines(sym, bar, limit);
    }
    case 'Kraken': {
      if (!sym) return null;
      return await _krakenOHLC(sym, null, hours);
    }
    case 'KuCoin': {
      if (!sym) return null;
      let type;
      if (hours<=4) type='5min'; else if (hours<=24) type='1hour';
      else if (hours<=168) type='4hour'; else type='1day';
      return await _kucoinKlines(sym, type, hours);
    }
    case 'Bitget': {
      if (!sym) return null;
      let gran, limit;
      if (hours<=4) {gran=300;limit=48;} else if (hours<=24) {gran=3600;limit=hours;}
      else if (hours<=168) {gran=14400;limit=Math.ceil(hours/4);} else {gran=86400;limit=Math.ceil(hours/24);}
      const r = await _bitgetKlines(sym, gran, limit);
      return r ? r.map(k=>[parseInt(k[0]),parseFloat(k[1]),parseFloat(k[2]),parseFloat(k[3]),parseFloat(k[4])]).sort((a,b)=>a[0]-b[0]) : null;
    }
    case 'CoinMarketCap': {
      // CMC directly doesn't provide OHLC — fallback to CoinGecko OHLC if cgId exists
      if (!t.cgId) return null;
      const days = hours<=4?'1':hours<=168?'7':'30';
      try {
        const raw = await _cgFetch('coins/'+t.cgId+'/ohlc?vs_currency=usd&days='+days);
        let candles = Array.isArray(raw) ? raw : [];
        if (hours<168) { const cutoff=Date.now()-hours*3600000; candles=candles.filter(c=>c[0]>=cutoff); }
        return candles.length>=2 ? candles : null;
      } catch(e) { return null; }
    }
    case 'CoinGecko': {
      if (!t.cgId) return null;
      const days = hours<=4?'1':hours<=168?'7':'30';
      try {
        const raw = await _cgFetch('coins/'+t.cgId+'/ohlc?vs_currency=usd&days='+days);
        let candles = Array.isArray(raw) ? raw : [];
        if (hours<168) { const cutoff=Date.now()-hours*3600000; candles=candles.filter(c=>c[0]>=cutoff); }
        return candles.length>=2 ? candles : null;
      } catch(e) { return null; }
    }
    case 'DexScreener': {
      // DexScreener does not return candles — convert line data to candles
      const addr = t.address || t.contractAddress || t.id;
      const chainId = t.chainId || t.chain;
      if (!addr || !addr.startsWith('0x')) return null;
      try {
        const chainMap = {1:'ethereum',8453:'base',42161:'arbitrum',10:'optimism',137:'polygon',56:'bsc',43114:'avalanche',324:'zksync'};
        const dsChain = chainMap[chainId] || 'ethereum';
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${addr}`, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return null;
        const data = await res.json();
        const pair = (data.pairs||[]).sort((a,b)=>(b.liquidity?.usd||0)-(a.liquidity?.usd||0))[0];
        if (!pair) return null;
        // DexScreener gives price only — synthesize fake candles from single price
        const price = parseFloat(pair.priceUsd||0);
        if (!price) return null;
        const change = parseFloat(pair.priceChange?.h24||0)/100;
        const openPrice = price / (1 + change);
        const now = Date.now();
        const step = (hours*3600000) / 20;
        const out = [];
        for (let i=0;i<20;i++) {
          const frac = i/19;
          const p = openPrice + (price-openPrice)*frac + (Math.random()-0.5)*price*0.008;
          const h = p * (1 + Math.random()*0.005);
          const l = p * (1 - Math.random()*0.005);
          out.push([now-(20-i)*step, p*0.999, h, l, p]);
        }
        return out;
      } catch(e) { return null; }
    }
  }
  return null;
}

function _tcfDrawCandleChart(candles, hours) {
  const svgEl = document.getElementById('tcf-chart-svg');
  if (!svgEl || candles.length < 2) return;

  const W = 430, H = 220, PAD_T = 14, PAD_B = 22, PAD_L = 6, PAD_R = 6;
  const chartH = H - PAD_T - PAD_B, chartW = W - PAD_L - PAD_R;

  const highs  = candles.map(c => c[2]);
  const lows   = candles.map(c => c[3]);
  const minV   = Math.min(...lows);
  const maxV   = Math.max(...highs);
  const rangeV = maxV - minV || 1;

  const toX = i  => PAD_L + (i / (candles.length - 1)) * chartW;
  const toY = v  => PAD_T + chartH - ((v - minV) / rangeV) * chartH;
  const fmt = v  => v >= 1 ? '$' + v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : '$' + v.toPrecision(4);

  // Candle width
  const candleW = Math.max(2, Math.min(10, Math.floor(chartW / candles.length * 0.7)));

  let candleSvg = '';
  candles.forEach((c, i) => {
    const [ts, o, h, l, cl] = c;
    const isGreen = cl >= o;
    const color   = isGreen ? '#10b981' : '#f43f5e';
    const x       = toX(i);
    const openY   = toY(o);
    const closeY  = toY(cl);
    const highY   = toY(h);
    const lowY    = toY(l);
    const bodyTop = Math.min(openY, closeY);
    const bodyH   = Math.max(1, Math.abs(closeY - openY));
    // Wick
    candleSvg += `<line x1='${x.toFixed(1)}' y1='${highY.toFixed(1)}' x2='${x.toFixed(1)}' y2='${lowY.toFixed(1)}' stroke='${color}' stroke-width='1' opacity='0.7'/>`;
    // Body
    candleSvg += `<rect x='${(x - candleW/2).toFixed(1)}' y='${bodyTop.toFixed(1)}' width='${candleW}' height='${bodyH.toFixed(1)}' fill='${color}' rx='1'/>`;
  });

  // Grid lines
  const gridLines = [0.25, 0.5, 0.75].map(f =>
    `<line x1='${PAD_L}' y1='${(PAD_T + chartH * f).toFixed(1)}' x2='${W-PAD_R}' y2='${(PAD_T + chartH * f).toFixed(1)}' stroke='rgba(255,255,255,0.05)' stroke-width='1'/>`
  ).join('');

  // X-axis labels
  const labelCount = 4;
  const labelIdxs = Array.from({length: labelCount}, (_, i) => Math.round(i * (candles.length - 1) / (labelCount - 1)));
  const labelsX = labelIdxs.map(i => {
    const d = new Date(candles[i][0]);
    const txt = hours <= 24
      ? d.toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit', hour12:false})
      : d.toLocaleDateString('en-US', {month:'short', day:'numeric'});
    return `<text x='${toX(i).toFixed(1)}' y='${H-4}' text-anchor='middle' font-size='7.5' font-family='JetBrains Mono,monospace' fill='rgba(255,255,255,0.28)'>${txt}</text>`;
  }).join('');

  svgEl.innerHTML = `
    ${gridLines}
    ${candleSvg}
    <text x='${W-PAD_R-2}' y='${Math.max(PAD_T+8, toY(maxV)-4).toFixed(1)}' text-anchor='end' font-size='7' font-family='JetBrains Mono,monospace' fill='rgba(16,185,129,0.65)'>${fmt(maxV)}</text>
    <text x='${W-PAD_R-2}' y='${Math.min(H-PAD_B-4, toY(minV)+10).toFixed(1)}' text-anchor='end' font-size='7' font-family='JetBrains Mono,monospace' fill='rgba(244,63,94,0.65)'>${fmt(minV)}</text>
    ${labelsX}
  `;

  // Touch/mouse tooltip for candles
  svgEl.onmousemove = svgEl.ontouchmove = function(e) {
    if (e.cancelable) e.preventDefault();
    const rect = svgEl.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const relX = (clientX - rect.left) / rect.width * W;
    const idx = Math.min(candles.length-1, Math.max(0, Math.round((relX - PAD_L) / chartW * (candles.length-1))));
    const [ts, o, h, l, cl] = candles[idx];
    const tip = document.getElementById('tcf-tooltip');
    const crosshair = document.getElementById('tcf-crosshair');
    if (tip) {
      const fmtP = v => v >= 1 ? '$' + v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4}) : '$' + v.toPrecision(5);
      const timeStr = hours <= 24
        ? new Date(ts).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false})
        : new Date(ts).toLocaleDateString('en-US',{month:'short',day:'numeric'});
      const dir = cl >= o ? '▲' : '▼';
      tip.textContent = timeStr + '  O:' + fmtP(o) + '  H:' + fmtP(h) + '  L:' + fmtP(l) + '  C:' + fmtP(cl);
      tip.style.display = 'block';
      const pct = (toX(idx) / W * 100).toFixed(1);
      tip.style.left = pct + '%';
    }
    if (crosshair) {
      crosshair.style.display = 'block';
      crosshair.style.left = ((toX(idx) / W * 100)).toFixed(1) + '%';
    }
  };
  svgEl.onmouseleave = svgEl.ontouchend = function() {
    const tip = document.getElementById('tcf-tooltip');
    const ch  = document.getElementById('tcf-crosshair');
    if (tip) tip.style.display = 'none';
    if (ch)  ch.style.display  = 'none';
  };
}

function _tcfDrawChart(prices, hours) {
  const svgEl = document.getElementById('tcf-chart-svg');
  if (!svgEl || prices.length < 2) return;

  const W = 430, H = 220, PAD_T = 16, PAD_B = 24, PAD_L = 4, PAD_R = 4;
  const vals = prices.map(p => p[1]);
  const minV = Math.min(...vals), maxV = Math.max(...vals);
  const rangeV = maxV - minV || 1;
  const chartH = H - PAD_T - PAD_B, chartW = W - PAD_L - PAD_R;
  const firstPrice = vals[0], lastPrice = vals[vals.length-1];
  const isUp = lastPrice >= firstPrice;
  const lineColor = isUp ? '#10b981' : '#f43f5e';
  const gradStop1 = isUp ? 'rgba(16,185,129,0.28)' : 'rgba(244,63,94,0.28)';
  const gradStop2 = isUp ? 'rgba(16,185,129,0.0)' : 'rgba(244,63,94,0.0)';
  const gradId = 'tcfgrd' + (isUp?'up':'dn');

  const toX = i => PAD_L + (i / (prices.length-1)) * chartW;
  const toY = v => PAD_T + chartH - ((v - minV) / rangeV) * chartH;

  const pts = prices.map((p,i) => toX(i).toFixed(1) + ',' + toY(p[1]).toFixed(1)).join(' ');
  const fillPts = [PAD_L + ',' + (H-PAD_B)]
    .concat(prices.map((p,i) => toX(i).toFixed(1) + ',' + toY(p[1]).toFixed(1)))
    .concat([(W-PAD_R) + ',' + (H-PAD_B)]).join(' ');

  // Y-axis labels (high/low)
  const highY = toY(maxV), lowY = toY(minV);
  const fmt = v => v >= 1 ? '$' + v.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}) : '$' + v.toPrecision(4);

  // X-axis time labels
  const labelCount = 5;
  const labelIdxs = Array.from({length:labelCount}, (_,i) => Math.round(i*(prices.length-1)/(labelCount-1)));
  const labelsX = labelIdxs.map(i => {
    const d = new Date(prices[i][0]);
    const txt = hours <= 24
      ? d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false})
      : d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
    return `<text x='${toX(i).toFixed(1)}' y='${H-4}' text-anchor='middle' font-size='8' font-family='JetBrains Mono,monospace' fill='rgba(255,255,255,0.28)'>${txt}</text>`;
  }).join('');

  svgEl.innerHTML = `
    <defs>
      <linearGradient id='${gradId}' x1='0' y1='0' x2='0' y2='1'>
        <stop offset='0%' stop-color='${gradStop1}'/>
        <stop offset='100%' stop-color='${gradStop2}'/>
      </linearGradient>
    </defs>
    <line x1='${PAD_L}' y1='${(PAD_T+chartH*0.25).toFixed(1)}' x2='${W-PAD_R}' y2='${(PAD_T+chartH*0.25).toFixed(1)}' stroke='rgba(255,255,255,0.04)' stroke-width='1'/>
    <line x1='${PAD_L}' y1='${(PAD_T+chartH*0.5).toFixed(1)}'  x2='${W-PAD_R}' y2='${(PAD_T+chartH*0.5).toFixed(1)}'  stroke='rgba(255,255,255,0.06)' stroke-width='1'/>
    <line x1='${PAD_L}' y1='${(PAD_T+chartH*0.75).toFixed(1)}' x2='${W-PAD_R}' y2='${(PAD_T+chartH*0.75).toFixed(1)}' stroke='rgba(255,255,255,0.04)' stroke-width='1'/>
    <polygon points='${fillPts}' fill='url(#${gradId})'/>
    <polyline points='${pts}' fill='none' stroke='${lineColor}' stroke-width='2' stroke-linejoin='round' stroke-linecap='round'/>
    <circle cx='${toX(prices.length-1).toFixed(1)}' cy='${toY(vals[vals.length-1]).toFixed(1)}' r='4' fill='${lineColor}' stroke='var(--bg-deep)' stroke-width='2'/>
    <text x='${W-PAD_R-2}' y='${Math.max(PAD_T+8, highY-4).toFixed(1)}' text-anchor='end' font-size='7.5' font-family='JetBrains Mono,monospace' fill='rgba(16,185,129,0.7)'>${fmt(maxV)}</text>
    <text x='${W-PAD_R-2}' y='${Math.min(H-PAD_B-4, lowY+10).toFixed(1)}' text-anchor='end' font-size='7.5' font-family='JetBrains Mono,monospace' fill='rgba(244,63,94,0.7)'>${fmt(minV)}</text>
    ${labelsX}
  `;

  // Touch/mouse interaction
  svgEl.onmousemove = svgEl.ontouchmove = function(e) {
    if (e.cancelable) e.preventDefault();
    const rect = svgEl.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const relX = (clientX - rect.left) / rect.width * W;
    const idx = Math.min(prices.length-1, Math.max(0, Math.round((relX - PAD_L) / chartW * (prices.length-1))));
    const price = prices[idx][1];
    const ts = new Date(prices[idx][0]);
    const tip = document.getElementById('tcf-tooltip');
    const crosshair = document.getElementById('tcf-crosshair');
    if (tip) {
      const priceStr = price >= 1 ? '$' + price.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:4}) : '$' + price.toPrecision(5);
      const timeStr = hours <= 24
        ? ts.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false})
        : ts.toLocaleDateString('en-US',{month:'short',day:'numeric'});
      tip.textContent = timeStr + '  ' + priceStr;
      tip.style.display = 'block';
      const pct = (toX(idx) / W * 100).toFixed(1);
      tip.style.left = pct + '%';
    }
    if (crosshair) {
      crosshair.style.display = 'block';
      crosshair.style.left = ((toX(idx) / W * 100)).toFixed(1) + '%';
    }
  };
  svgEl.onmouseleave = svgEl.ontouchend = function() {
    const tip = document.getElementById('tcf-tooltip');
    const ch = document.getElementById('tcf-crosshair');
    if (tip) tip.style.display = 'none';
    if (ch) ch.style.display = 'none';
  };
}
