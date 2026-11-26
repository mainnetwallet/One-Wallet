
function _lwApplyCandles(candles) {
  if (!_lwChart || !_lwVolSeries || !candles.length) return;
  window._lwLastCandles = candles;
  // Track which coin+timeframe these cached candles belong to, so chart-type
  // switches can detect a stale cache (e.g. a TF fetch still in flight) instead
  // of silently rendering candles for the wrong timeframe.
  window._lwLastCandlesKey = (window._tcfActiveCoin || '') + '_' + (window._tcfTf || '5m');
  const type = window._tcfChartType || 'candle';
  // Recreate the main series as the correct type (candlestick/line/area/baseline/bar/etc.)
  // and apply the (possibly transformed) data to it.
  _lwRenderMainSeries(type, candles);
  _lwVolSeries.setData(candles.map(c => ({
    time:  c.time,
    value: c.volume || 0,
    color: c.close >= c.open ? 'rgba(16,185,129,0.5)' : 'rgba(244,63,94,0.5)',
  })));
  // MA lines
  if (_lwMa7)  _lwMa7.setData(_calcMA(candles, 7));
  if (_lwMa25) _lwMa25.setData(_calcMA(candles, 25));
  if (_lwMa99) _lwMa99.setData(_calcMA(candles, 99));
  // Show last N candles — professional style: fit to screen width dynamically
  const tf = window._tcfTf || '5m';
  const total = candles.length;
  // Calculate visible candles based on chart width (like Binance/TradingView)
  // Target candle body width: ~8px per candle on mobile, ~10px on landscape
  const chartElW = document.getElementById('tcf-lw-chart');
  const chartPxWidth = (chartElW && chartElW.clientWidth > 0) ? chartElW.clientWidth : window.innerWidth || 390;
  const pxPerCandle = 8; // professional default: ~8px wide candle + spacing
  const screenBasedView = Math.floor((chartPxWidth - 60) / pxPerCandle); // 60px = right price scale
  const viewCount = Math.max(40, Math.min(screenBasedView, total));
  const from = Math.max(0, total - viewCount) - 0.5;
  const to   = total - 0.5;
  window._lwTargetRange = { from, to };

  // Cancel any previous range guard
  if (window._lwRangeGuard) { clearInterval(window._lwRangeGuard); window._lwRangeGuard = null; }

  const _applyRange = () => {
    const r = window._lwTargetRange;
    if (!r) return;
    if (_lwChart)    try { _lwChart.timeScale().setVisibleLogicalRange(r); } catch(e) {}
    if (_lwVolChart) try { _lwVolChart.timeScale().setVisibleLogicalRange(r); } catch(e) {}
  };

  // Apply immediately + aggressive guard for 1s (LWC fitContent fires asynchronously)
  _applyRange();
  let _guardCount = 0;
  window._lwRangeGuard = setInterval(() => {
    _applyRange();
    _guardCount++;
    if (_guardCount >= 10) { // 10 × 100ms = 1000ms total
      clearInterval(window._lwRangeGuard);
      window._lwRangeGuard = null;
    }
  }, 100);
  _tcfUpdateSparkline(candles.map(c => [c.time * 1000, c.close]));
}

function _lwApplyHighLowMarkers(candles) {
  if (!_lwCandleSeries || !candles.length) return;
  // Find highest high and lowest low
  let hiIdx = 0, loIdx = 0;
  candles.forEach((c, i) => {
    if (c.high > candles[hiIdx].high) hiIdx = i;
    if (c.low  < candles[loIdx].low)  loIdx = i;
  });
  const hi = candles[hiIdx], lo = candles[loIdx];
  const fmt = v => v >= 1 ? v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : v.toPrecision(5);
  _lwCandleSeries.setMarkers([
    { time: hi.time, position: 'aboveBar', color: '#10b981', shape: 'arrowDown', text: fmt(hi.high), size: 0 },
    { time: lo.time, position: 'belowBar', color: '#f43f5e', shape: 'arrowUp',   text: fmt(lo.low),  size: 0 },
  ]);
}

// ── REST: try Binance → Bitget → Bybit → Coinbase → KuCoin → OKX → CoinGecko ──
async function _lwFetchCandles(sym, tf) {
  const { interval, limit } = _TF_MAP[tf] || _TF_MAP['1h'];

  // For sub-minute timeframes, aggregate 1s candles into desired resolution
  function _aggregateCandles(candles, tfKey) {
    if (tfKey === '1s') return candles;
    const secPerBar = tfKey === '15s' ? 15 : tfKey === '30s' ? 30 : 1;
    if (secPerBar <= 1) return candles;
    const grouped = {};
    candles.forEach(c => {
      const bucket = Math.floor(c.time / secPerBar) * secPerBar;
      if (!grouped[bucket]) grouped[bucket] = { time: bucket, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume };
      else {
        grouped[bucket].high   = Math.max(grouped[bucket].high, c.high);
        grouped[bucket].low    = Math.min(grouped[bucket].low,  c.low);
        grouped[bucket].close  = c.close;
        grouped[bucket].volume += c.volume;
      }
    });
    return Object.values(grouped).sort((a, b) => a.time - b.time);
  }

  // 1. Binance
  try {
    const url = `https://api.binance.com/api/v3/klines?symbol=${sym}USDT&interval=${interval}&limit=${limit}`;
    const res = await window.nxFetch(url, { ms: 7000 });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length >= 2) {
        _lwSetSource('Binance', false);
        const _bnRaw = data.map(k => ({
          time: Math.floor(parseInt(k[0]) / 1000),
          open: parseFloat(k[1]), high: parseFloat(k[2]),
          low:  parseFloat(k[3]), close: parseFloat(k[4]),
          volume: parseFloat(k[5]),
        }));
        return _aggregateCandles(_bnRaw, tf);
      }
    }
  } catch(e) {}

  // 2. Bitget
  try {
    const granMap = {'1s':'1m','15s':'1m','30s':'1m','1m':'1m','5m':'5m','15m':'15m','1h':'1H','4h':'4H','1d':'1D','24H':'1H','7D':'4H','1M':'1D','1Y':'1D','ALL':'1W'};
    const gran = granMap[tf] || '1H';
    const url = `https://api.bitget.com/api/v2/spot/market/candles?symbol=${sym}USDT&granularity=${gran}&limit=${limit}`;
    const res = await window.nxFetch(url, { ms: 7000 });
    if (res.ok) {
      const data = await res.json();
      const rows = data?.data || data;
      if (Array.isArray(rows) && rows.length >= 2) {
        _lwSetSource('Bitget', true);
        return rows.map(k => ({
          time: Math.floor(parseInt(k[0]) / 1000),
          open: parseFloat(k[1]), high: parseFloat(k[2]),
          low:  parseFloat(k[3]), close: parseFloat(k[4]),
          volume: parseFloat(k[5] || 0),
        })).sort((a,b) => a.time - b.time);
      }
    }
  } catch(e) {}

  // 3. Bybit
  try {
    const intervalMap = {'1s':'1','15s':'1','30s':'1','1m':'1','5m':'5','15m':'15','1h':'60','4h':'240','1d':'D','24H':'60','7D':'240','1M':'D','1Y':'D','ALL':'W'};
    const itvl = intervalMap[tf] || '60';
    const url = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${sym}USDT&interval=${itvl}&limit=${limit}`;
    const res = await window.nxFetch(url, { ms: 7000 });
    if (res.ok) {
      const data = await res.json();
      const rows = data?.result?.list || [];
      if (rows.length >= 2) {
        _lwSetSource('Bybit', true);
        return rows.map(k => ({
          time: Math.floor(parseInt(k[0]) / 1000),
          open: parseFloat(k[1]), high: parseFloat(k[2]),
          low:  parseFloat(k[3]), close: parseFloat(k[4]),
          volume: parseFloat(k[5] || 0),
        })).sort((a,b) => a.time - b.time);
      }
    }
  } catch(e) {}

  // 4. OKX
  try {
    const barMap = {'1s':'1m','15s':'1m','30s':'1m','1m':'1m','5m':'5m','15m':'15m','1h':'1H','4h':'4H','1d':'1D','24H':'1H','7D':'4H','1M':'1D','1Y':'1D','ALL':'1W'};
    const bar = barMap[tf] || '1H';
    const url = `https://www.okx.com/api/v5/market/candles?instId=${sym}-USDT&bar=${bar}&limit=${Math.min(limit,300)}`;
    const data = window.fetchJsonWithFallback
      ? await window.fetchJsonWithFallback(url, 7000)
      : await (await window.nxFetch(url, { ms: 7000 })).json();
    {
      const rows = data?.data || [];
      if (rows.length >= 2) {
        _lwSetSource('OKX', true);
        return rows.map(k => ({
          time: Math.floor(parseInt(k[0]) / 1000),
          open: parseFloat(k[1]), high: parseFloat(k[2]),
          low:  parseFloat(k[3]), close: parseFloat(k[4]),
          volume: parseFloat(k[5] || 0),
        })).sort((a,b) => a.time - b.time);
      }
    }
  } catch(e) {}

  // 5. KuCoin
  try {
    const typeMap = {'1s':'1min','15s':'1min','30s':'1min','1m':'1min','5m':'5min','15m':'15min','1h':'1hour','4h':'4hour','1d':'1day','24H':'1hour','7D':'4hour','1M':'1day','1Y':'1day','ALL':'1week'};
    const type = typeMap[tf] || '1hour';
    const endAt = Math.floor(Date.now()/1000);
    const hours = {1:60,5:300,15:900,1:3600}; // unused but kept
    const startAt = endAt - limit * ({1:60,5:300,15:900,1:3600,4:14400,1440:86400}[parseInt(tf)] || 3600);
    const url = `https://api.kucoin.com/api/v1/market/candles?symbol=${sym}-USDT&type=${type}&startAt=${startAt}&endAt=${endAt}`;
    const res = await window.nxFetch(url, { ms: 7000 });
    if (res.ok) {
      const data = await res.json();
      const rows = data?.data || [];
      if (rows.length >= 2) {
        _lwSetSource('KuCoin', true);
        return rows.map(k => ({
          time: parseInt(k[0]),
          open: parseFloat(k[1]), close: parseFloat(k[2]),
          high: parseFloat(k[3]), low: parseFloat(k[4]),
          volume: parseFloat(k[5] || 0),
        })).sort((a,b) => a.time - b.time);
      }
    }
  } catch(e) {}

  // 6. CoinGecko OHLC — use token's cgId if available
  try {
    const daysMap = {'1s':'1','15s':'1','30s':'1','1m':'1','5m':'1','15m':'1','1h':'7','4h':'30','1d':'90','24H':'1','7D':'7','1M':'30','1Y':'365','ALL':'max'};
    const days = daysMap[tf] || '7';
    const cgSym = sym.toLowerCase();
    // Extended symbol→cgId map for common tokens
    const cgIdMap = {
      btc:'bitcoin',eth:'ethereum',bnb:'binancecoin',sol:'solana',
      xrp:'ripple',ada:'cardano',doge:'dogecoin',dot:'polkadot',
      matic:'matic-network',pol:'matic-network',link:'chainlink',
      uni:'uniswap',avax:'avalanche-2',shib:'shiba-inu',ltc:'litecoin',
      bch:'bitcoin-cash',xlm:'stellar',atom:'cosmos',near:'near',
      fil:'filecoin',apt:'aptos',op:'optimism',arb:'arbitrum',
      trx:'tron',ton:'the-open-network',sui:'sui',inj:'injective-protocol',
      sei:'sei-network',pepe:'pepe',floki:'floki',wif:'dogwifcoin',
      bonk:'bonk',jup:'jupiter-exchange-solana',pyth:'pyth-network',
      jto:'jito-governance-token',rndr:'render-token',fet:'fetch-ai',
      grt:'the-graph',mkr:'maker',aave:'aave',crv:'curve-dao-token',
      ldo:'lido-dao',snx:'havven',comp:'compound-governance-token',
      sand:'the-sandbox',mana:'decentraland',axs:'axie-infinity',
      ape:'apecoin',gala:'gala',imx:'immutable-x',blur:'blur',
      ens:'ethereum-name-service',chz:'chiliz',hbar:'hedera-hashgraph',
      algo:'algorand',egld:'elrond-erd-2',flow:'flow',icp:'internet-computer',
      ftm:'fantom',one:'harmony',zil:'zilliqa',vet:'vechain',
      theta:'theta-token',xtz:'tezos',eos:'eos',neo:'neo',
      iota:'iota',dash:'dash',zec:'zcash',bat:'basic-attention-token',
      lrc:'loopring','1inch':'1inch',sushi:'sushi',yfi:'yearn-finance',
      band:'band-protocol',rune:'thorchain',cake:'pancakeswap-token',
      spell:'spell-token',cvx:'convex-finance',fxs:'frax-share',
      frax:'frax',usdc:'usd-coin',usdt:'tether',busd:'binance-usd',
      dai:'dai',tusd:'true-usd',
    };
    // Priority: token's own cgId > map > sym as-is
    const tokenCgId = window._tcfToken?.cgId;
    const cgId = tokenCgId || cgIdMap[cgSym] || cgSym;
    const url = `https://api.coingecko.com/api/v3/coins/${cgId}/ohlc?vs_currency=usd&days=${days}`;
    const res = await window.nxFetch(url, { ms: 9000 });
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length >= 2) {
        _lwSetSource('CoinGecko', true);
        return rows.map(k => ({
          time: Math.floor(parseInt(k[0]) / 1000),
          open: k[1], high: k[2], low: k[3], close: k[4],
          volume: 0,
        }));
      }
    }
  } catch(e) {}

  // 7. CoinGecko market_chart fallback (line data → synthetic candles)
  try {
    const daysMap2 = {'1s':'1','15s':'1','30s':'1','1m':'1','5m':'1','15m':'1','1h':'7','4h':'30','1d':'90','24H':'1','7D':'7','1M':'30','1Y':'365','ALL':'max'};
    const days2 = daysMap2[tf] || '7';
    const tokenCgId2 = window._tcfToken?.cgId;
    const cgSym2 = sym.toLowerCase();
    const cgIdMap2 = {btc:'bitcoin',eth:'ethereum',bnb:'binancecoin',sol:'solana',xrp:'ripple',ada:'cardano',doge:'dogecoin',dot:'polkadot',matic:'matic-network',pol:'matic-network'};
    const cgId2 = tokenCgId2 || cgIdMap2[cgSym2] || cgSym2;
    const url2 = `https://api.coingecko.com/api/v3/coins/${cgId2}/market_chart?vs_currency=usd&days=${days2}`;
    const res2 = await window.nxFetch(url2, { ms: 9000 });
    if (res2.ok) {
      const data2 = await res2.json();
      const prices = data2?.prices;
      if (Array.isArray(prices) && prices.length >= 4) {
        _lwSetSource('CoinGecko', true);
        // Group price points into candles (every N points)
        const groupSize = Math.max(1, Math.floor(prices.length / Math.min(200, prices.length)));
        const candles = [];
        for (let i = 0; i < prices.length; i += groupSize) {
          const chunk = prices.slice(i, i + groupSize);
          if (!chunk.length) continue;
          const vals = chunk.map(p => p[1]);
          const t = Math.floor(chunk[0][0] / 1000);
          const o = vals[0], c = vals[vals.length-1];
          const h = Math.max(...vals), l = Math.min(...vals);
          candles.push({ time: t, open: o, high: h, low: l, close: c, volume: 0 });
        }
        if (candles.length >= 2) return candles;
      }
    }
  } catch(e) {}

  return null;
}