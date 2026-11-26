// ── cgId → Binance/Bitget symbol map ──
const _CG_TO_SYMBOL = {
  'bitcoin':'BTC','ethereum':'ETH','binancecoin':'BNB','solana':'SOL',
  'matic-network':'MATIC','polygon':'POL','avalanche-2':'AVAX','chainlink':'LINK',
  'uniswap':'UNI','aave':'AAVE','the-sandbox':'SAND','decentraland':'MANA',
  'axie-infinity':'AXS','the-graph':'GRT','compound-governance-token':'COMP',
  'maker':'MKR','curve-dao-token':'CRV','yearn-finance':'YFI','sushi':'SUSHI',
  'wrapped-bitcoin':'WBTC','litecoin':'LTC','ripple':'XRP','cardano':'ADA',
  'dogecoin':'DOGE','shiba-inu':'SHIB','polkadot':'DOT','cosmos':'ATOM',
  'near':'NEAR','arbitrum':'ARB','optimism':'OP','aptos':'APT','sui':'SUI',
  'injective-protocol':'INJ','sei-network':'SEI','celestia':'TIA','starknet':'STRK',
  'fantom':'FTM','harmony':'ONE','algorand':'ALGO','tezos':'XTZ','stellar':'XLM',
  'monero':'XMR','eos':'EOS','iota':'IOTA','neo':'NEO','dash':'DASH','zcash':'ZEC',
  'ethereum-classic':'ETC','vechain':'VET','tron':'TRX','filecoin':'FIL',
  'internet-computer':'ICP','hedera-hashgraph':'HBAR','flow':'FLOW',
  'theta-token':'THETA','gala':'GALA','immutable-x':'IMX','blur':'BLUR',
  'pepe':'PEPE','floki':'FLOKI','bonk':'BONK','wif':'WIF','brett':'BRETT',
  'dydx':'DYDX','gmx':'GMX','pendle':'PENDLE','eigenlayer':'EIGEN',
  'base':'BASE','linea':'LINEA','scroll':'SCR','zksync':'ZK',
  'lido-dao':'LDO','rocket-pool':'RPL','frax-share':'FXS',
  'fetch-ai':'FET','singularitynet':'AGIX','ocean-protocol':'OCEAN',
  'render-token':'RENDER','worldcoin-wld':'WLD','apecoin':'APE',
  'sandbox':'SAND','axie-infinity':'AXS','stepn':'GMT',
  'usd-coin':'USDC','tether':'USDT','dai':'DAI','binance-usd':'BUSD',
};

function _cgIdToSymbol(cgId) {
  if (!cgId) return null;
  const mapped = _CG_TO_SYMBOL[cgId.toLowerCase()];
  if (mapped) return mapped;
  // Fallback: uppercase last segment (e.g. "wrapped-bitcoin" → skip, but "near" → "NEAR")
  const seg = cgId.split('-');
  if (seg.length === 1) return cgId.toUpperCase();
  return null;
}

// ── Binance Klines (OHLCV) — via native bridge, no CORS issues ──
async function _binanceKlines(symbol, interval, limit) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=${interval}&limit=${limit}`;
  try {
    const res = await window.nxFetch(url, { ms: 9000 });
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data.length > 1) return data;
  } catch(e) {}
  return null;
}

// ── Bitget Klines (via native bridge) ──
async function _bitgetKlines(symbol, granularity, limit) {
  // granularity in seconds: 60,300,900,3600,14400,86400
  const url = `https://api.bitget.com/api/v2/spot/market/candles?symbol=${symbol}USDT&granularity=${granularity}&limit=${limit}`;
  try {
    const res = await window.nxFetch(url, { ms: 9000 });
    if (!res.ok) return null;
    const data = await res.json();
    // Bitget returns {code:"00000", data:[[ts,o,h,l,c,vol,...], ...]}
    const rows = data?.data || data;
    if (Array.isArray(rows) && rows.length > 1) return rows;
  } catch(e) {}
  return null;
}

// ── Kraken OHLC (direct, no CORS issue) ──
async function _krakenOHLC(symbol, interval, hours) {
  // Kraken uses pair names like XBTUSD, ETHUSD, etc.
  const KRAKEN_PAIRS = {
    'BTC':'XBTUSD','ETH':'ETHUSD','SOL':'SOLUSD','BNB':'BNBUSD','ADA':'ADAUSD',
    'DOT':'DOTUSD','LINK':'LINKUSD','AVAX':'AVAXUSD','MATIC':'MATICUSD','POL':'POLUSD',
    'UNI':'UNIUSD','ATOM':'ATOMUSD','LTC':'LTCUSD','XRP':'XRPUSD','DOGE':'DOGEUSD',
    'NEAR':'NEARUSD','ARB':'ARBUSD','OP':'OPUSD','FIL':'FILUSD','XLM':'XLMUSD',
    'AAVE':'AAVEUSD','MKR':'MKRUSD','COMP':'COMPUSD','CRV':'CRVUSD','LDO':'LDOUSD',
    'APT':'APTUSD','SUI':'SUIUSD','INJ':'INJUSD','TIA':'TIAUSD','PEPE':'PEPEUSD',
  };
  const pair = KRAKEN_PAIRS[symbol];
  if (!pair) return null;
  // interval in minutes: 1,5,15,30,60,240,1440
  const ivMap = { 60:1, 240:5, 1440:60, 10080:240, 43200:1440 };
  const mins = hours <= 1 ? 1 : hours <= 4 ? 5 : hours <= 24 ? 60 : hours <= 168 ? 240 : 1440;
  const since = Math.floor((Date.now() - hours * 3600000) / 1000);
  const url = `https://api.kraken.com/0/public/OHLC?pair=${pair}&interval=${mins}&since=${since}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.error && json.error.length) return null;
    const rows = json.result?.[pair] || json.result?.[Object.keys(json.result||{})[0]];
    if (!Array.isArray(rows) || rows.length < 2) return null;
    // Kraken OHLC: [time, open, high, low, close, vwap, volume, count]
    return rows.map(r => [parseInt(r[0]) * 1000, parseFloat(r[1]), parseFloat(r[2]), parseFloat(r[3]), parseFloat(r[4])]);
  } catch(e) { return null; }
}

// ── OKX Klines (native bridge + proxy fallback — OKX geo-blocks some regions, e.g. Bangladesh) ──
async function _okxKlines(symbol, bar, limit) {
  const url = `https://www.okx.com/api/v5/market/candles?instId=${symbol}-USDT&bar=${bar}&limit=${limit}`;
  try {
    const json = window.fetchJsonWithFallback
      ? await window.fetchJsonWithFallback(url, 8000)
      : await (await fetch(url, { signal: AbortSignal.timeout(8000) })).json();
    const rows = json?.data;
    if (!Array.isArray(rows) || rows.length < 2) return null;
    // OKX: [ts, o, h, l, c, vol, volCcy, ...] — newest first
    return rows.map(r => [parseInt(r[0]), parseFloat(r[1]), parseFloat(r[2]), parseFloat(r[3]), parseFloat(r[4])]).reverse();
  } catch(e) { return null; }
}

// ── KuCoin Klines (via native bridge) ──
async function _kucoinKlines(symbol, type, hours) {
  const startAt = Math.floor((Date.now() - hours * 3600000) / 1000);
  const endAt   = Math.floor(Date.now() / 1000);
  const url = `https://api.kucoin.com/api/v1/market/candles?symbol=${symbol}-USDT&type=${type}&startAt=${startAt}&endAt=${endAt}`;
  try {
    const res = await window.nxFetch(url, { ms: 9000 });
    if (!res.ok) return null;
    const json = await res.json();
    const rows = json?.data;
    if (!Array.isArray(rows) || rows.length < 2) return null;
    // KuCoin: [startTime, open, close, high, low, volume, amount] — newest first
    return rows.map(r => [parseInt(r[0]) * 1000, parseFloat(r[1]), parseFloat(r[3]), parseFloat(r[4]), parseFloat(r[2])]).reverse();
  } catch(e) { return null; }
}

// ── CoinMarketCap chart data ──
// Priority: 1) Pro API (private key)  2) Public widget endpoint (no key, proxy)
async function _cmcQuoteChart(symbol, timePeriod) {
  // 1. Try CMC Pro API with private key — official, high rate limit
  // symbol can be a ticker (e.g. "BTC") or slug (e.g. "bitcoin")
  try {
    // Convert timePeriod (1D/7D/30D) to CMC time_period
    const periodMap = { '1D': '24h', '7D': '7d', '30D': '30d' };
    const tp = periodMap[timePeriod] || '7d';
    // Try by slug first (cgId is often the slug), then by symbol
    const slugUrl = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/historical?slug=${symbol.toLowerCase()}&time_period=${tp}&count=168&interval=hourly&convert=USD`;
    const symUrl  = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/historical?symbol=${symbol.toUpperCase()}&time_period=${tp}&count=168&interval=hourly&convert=USD`;
    for (const url of [slugUrl, symUrl]) {
      try {
        const res = await window.nxFetch(url, {
          headers: { 'X-CMC_PRO_API_KEY': _API_KEYS.CMC_PRO, 'Accept': 'application/json' },
          ms: 9000
        });
        if (!res.ok) continue;
        const json = await res.json();
        if (json.status?.error_code && json.status.error_code !== 0) continue;
        // Find the coin's quote array
        const coinData = json.data;
        if (!coinData) continue;
        // data can be object keyed by id or symbol
        const entry = Array.isArray(coinData)
          ? coinData[0]
          : Object.values(coinData)[0];
        const quotes = entry?.quotes || entry?.data?.quotes;
        if (Array.isArray(quotes) && quotes.length > 2) {
          const prices = quotes
            .map(q => [new Date(q.timestamp).getTime(), q.quote?.USD?.price || 0])
            .filter(p => p[1] > 0)
            .sort((a, b) => a[0] - b[0]);
          if (prices.length > 2) return prices;
        }
      } catch(e) {}
    }
  } catch(e) {}

  // 2. Fallback: CMC public widget endpoint (no key required, via native bridge)
  const url = `https://api.coinmarketcap.com/data-api/v3/cryptocurrency/detail/chart?id=&slug=${symbol.toLowerCase()}&range=${timePeriod}`;
  try {
    const res = await window.nxFetch(url, { ms: 9000 });
    if (res.ok) {
      const data = await res.json();
      const points = data?.data?.points;
      if (points && typeof points === 'object') {
        const prices = Object.entries(points)
          .map(([ts, v]) => [parseInt(ts) * 1000, v?.v?.[0] || v?.c || 0])
          .filter(p => p[1] > 0)
          .sort((a, b) => a[0] - b[0]);
        if (prices.length > 2) return prices;
      }
    }
  } catch(e) {}
  return null;
}

