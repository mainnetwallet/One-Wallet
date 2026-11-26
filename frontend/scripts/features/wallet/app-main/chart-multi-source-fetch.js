// ── Multi-source LINE chart data → [[ts, price], ...] ──
async function _fetchLineChartMulti(t, hours) {
  const sym = _cgIdToSymbol(t.cgId || '');

  // 1. Try Binance
  if (sym) {
    try {
      let interval, limit;
      if (hours <= 1)   { interval = '1m';  limit = 60; }
      else if (hours <= 4)  { interval = '5m';  limit = 48; }
      else if (hours <= 24) { interval = '1h';  limit = hours; }
      else if (hours <= 168){ interval = '4h';  limit = Math.ceil(hours/4); }
      else                  { interval = '1d';  limit = Math.ceil(hours/24); }
      const klines = await _binanceKlines(sym, interval, limit);
      if (klines) return klines.map(k => [parseInt(k[0]), parseFloat(k[4])]);
    } catch(e) {}
  }

  // 2. Try OKX (direct, no proxy)
  if (sym) {
    try {
      let bar, limit;
      if (hours <= 1)   { bar = '1m';  limit = 60; }
      else if (hours <= 4)  { bar = '5m';  limit = 48; }
      else if (hours <= 24) { bar = '1H';  limit = 24; }
      else if (hours <= 168){ bar = '4H';  limit = Math.ceil(hours/4); }
      else                  { bar = '1D';  limit = Math.ceil(hours/24); }
      const rows = await _okxKlines(sym, bar, limit);
      if (rows) return rows.map(r => [r[0], r[4]]);
    } catch(e) {}
  }

  // 3. Try Kraken (direct, no proxy)
  if (sym) {
    try {
      const rows = await _krakenOHLC(sym, null, hours);
      if (rows) return rows.map(r => [r[0], r[4]]);
    } catch(e) {}
  }

  // 4. Try KuCoin (via proxy)
  if (sym) {
    try {
      let type;
      if (hours <= 1)   { type = '1min'; }
      else if (hours <= 4)  { type = '5min'; }
      else if (hours <= 24) { type = '1hour'; }
      else if (hours <= 168){ type = '4hour'; }
      else                  { type = '1day'; }
      const rows = await _kucoinKlines(sym, type, hours);
      if (rows) return rows.map(r => [r[0], r[4]]);
    } catch(e) {}
  }

  // 5. Try Bitget
  if (sym) {
    try {
      let gran, limit;
      if (hours <= 1)   { gran = 60;    limit = 60; }
      else if (hours <= 4)  { gran = 300;   limit = 48; }
      else if (hours <= 24) { gran = 3600;  limit = hours; }
      else if (hours <= 168){ gran = 14400; limit = Math.ceil(hours/4); }
      else                  { gran = 86400; limit = Math.ceil(hours/24); }
      const rows = await _bitgetKlines(sym, gran, limit);
      if (rows) return rows.map(k => [parseInt(k[0]), parseFloat(k[4])]).sort((a,b)=>a[0]-b[0]);
    } catch(e) {}
  }

  // 6. Try CoinMarketCap
  if (sym || t.cgId) {
    try {
      const period = hours <= 24 ? '1D' : hours <= 168 ? '7D' : '30D';
      const prices = await _cmcQuoteChart(sym || t.cgId, period);
      if (prices && prices.length > 2) return prices;
    } catch(e) {}
  }

  // 7. Fallback: CoinGecko
  const days = hours <= 4 ? '1' : hours <= 24 ? '1' : hours <= 168 ? '7' : '30';
  const interval = hours <= 24 ? 'hourly' : 'daily';
  const data = await _cgFetch('coins/' + t.cgId + '/market_chart?vs_currency=usd&days=' + days + '&interval=' + interval);
  const prices = data.prices || [];
  if (hours < 24) {
    const cutoff = Date.now() - hours * 3600000;
    return prices.filter(p => p[0] >= cutoff);
  }
  return prices;
}

// ── Multi-source CANDLE chart data → [[ts,o,h,l,c], ...] ──
async function _fetchCandleChartMulti(t, hours) {
  const sym = _cgIdToSymbol(t.cgId || '');

  // 1. Try Binance candles
  if (sym) {
    try {
      let interval, limit;
      if (hours <= 4)   { interval = '5m';  limit = 48; }
      else if (hours <= 24) { interval = '1h';  limit = hours; }
      else if (hours <= 168){ interval = '4h';  limit = Math.ceil(hours/4); }
      else                  { interval = '1d';  limit = Math.ceil(hours/24); }
      const klines = await _binanceKlines(sym, interval, limit);
      if (klines) return klines.map(k => [parseInt(k[0]), parseFloat(k[1]), parseFloat(k[2]), parseFloat(k[3]), parseFloat(k[4])]);
    } catch(e) {}
  }

  // 2. Try OKX candles (direct, no proxy)
  if (sym) {
    try {
      let bar, limit;
      if (hours <= 4)   { bar = '5m';  limit = 48; }
      else if (hours <= 24) { bar = '1H';  limit = 24; }
      else if (hours <= 168){ bar = '4H';  limit = Math.ceil(hours/4); }
      else                  { bar = '1D';  limit = Math.ceil(hours/24); }
      const rows = await _okxKlines(sym, bar, limit);
      if (rows) return rows;
    } catch(e) {}
  }

  // 3. Try Kraken (direct, no proxy)
  if (sym) {
    try {
      const rows = await _krakenOHLC(sym, null, hours);
      if (rows) return rows;
    } catch(e) {}
  }

  // 4. Try KuCoin candles (via proxy)
  if (sym) {
    try {
      let type;
      if (hours <= 4)   { type = '5min'; }
      else if (hours <= 24) { type = '1hour'; }
      else if (hours <= 168){ type = '4hour'; }
      else                  { type = '1day'; }
      const rows = await _kucoinKlines(sym, type, hours);
      if (rows) return rows;
    } catch(e) {}
  }

  // 5. Try Bitget candles
  if (sym) {
    try {
      let gran, limit;
      if (hours <= 4)   { gran = 300;   limit = 48; }
      else if (hours <= 24) { gran = 3600;  limit = hours; }
      else if (hours <= 168){ gran = 14400; limit = Math.ceil(hours/4); }
      else                  { gran = 86400; limit = Math.ceil(hours/24); }
      const rows = await _bitgetKlines(sym, gran, limit);
      if (rows) return rows.map(k => [parseInt(k[0]), parseFloat(k[1]), parseFloat(k[2]), parseFloat(k[3]), parseFloat(k[4])]).sort((a,b)=>a[0]-b[0]);
    } catch(e) {}
  }

  // 6. CoinGecko OHLC fallback
  const days = hours <= 4 ? '1' : hours <= 168 ? '7' : '30';
  const raw = await _cgFetch('coins/' + t.cgId + '/ohlc?vs_currency=usd&days=' + days);
  let candles = Array.isArray(raw) ? raw : [];
  if (hours < 168) {
    const cutoff = Date.now() - hours * 3600000;
    candles = candles.filter(c => c[0] >= cutoff);
  }
  return candles;
}

// ── PRICE FETCH: CoinGecko (Pro key → Demo key → CORS proxies) ──
async function fetchPricesCoinGecko() {
  const allCgIds = new Set();
  TOKEN_CONFIG.forEach(t => { if (t.cgId) allCgIds.add(t.cgId); });
  if (typeof DEFAULT_TOKENS !== 'undefined') {
    DEFAULT_TOKENS.forEach(t => { if (t.cgId) allCgIds.add(t.cgId); });
  }
  const ids = [...allCgIds].filter(Boolean).join(',');
  if (!ids) throw new Error('No tokens');
  const path = `simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;

  // 1. Pro API — only if key is configured
  if (_API_KEYS.CG_PRO) {
    try {
      const res = await window.nxFetch(`https://pro-api.coingecko.com/api/v3/${path}&x_cg_pro_api_key=${_API_KEYS.CG_PRO}`, { ms: 8000 });
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object' && Object.keys(data).length > 0 && !data.status?.error_code) return data;
      }
      if ([400, 401, 403].includes(res.status)) _cgProApiFailed = true;
    } catch(e) {}
  }

  // 2. Public API with demo key
  try {
    const demoParam = _API_KEYS.CG_DEMO ? `&x_cg_demo_api_key=${_API_KEYS.CG_DEMO}` : '';
    const res = await fetch(`https://api.coingecko.com/api/v3/${path}${demoParam}`, {
      signal: AbortSignal.timeout(8000)
    });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object' && Object.keys(data).length > 0 && !data.status?.error_code) return data;
    }
  } catch(e) {}

  // 3. Native bridge — always used for file://, fallback otherwise
  const rawTarget2 = `https://api.coingecko.com/api/v3/${path}`;
  const data = await _cgNativeFetch(rawTarget2, 14000);
  if (data && typeof data === 'object' && Object.keys(data).length > 0) return data;
  throw new Error('CoinGecko all sources failed');
}

// ── PRICE FETCH: Coinbase spot (fallback 2, per-token) ──
async function fetchPriceCoinbase(pair) {
  const url = `https://api.coinbase.com/v2/prices/${pair}/spot`;
  const res = await window.nxFetch(url, { ms: 6000 });
  if (!res.ok) throw new Error('Coinbase ' + res.status);
  const data = await res.json();
  return parseFloat(data.data?.amount || '0');
}

// ── UNIFIED PRICE FETCH: Binance → CoinGecko → CoinMarketCap → DexScreener ──
// Tracks which source was used for display
let _lastPriceSource = 'Binance';
