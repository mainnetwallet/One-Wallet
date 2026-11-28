
// ══════════════════════════════════════════════════════════════════
// ⚡ SMART PARALLEL PRICE ENGINE v2
// STEP 1: Binance batch (all tokens at once, fastest)
// STEP 2: Remaining → CoinGecko batch
// STEP 3: Still missing → CoinMarketCap
// STEP 4: Final fallback → DexScreener (per contract address)
// All steps run in parallel where possible, no UI flicker
// ══════════════════════════════════════════════════════════════════

// ── Collect all unique cgIds from TOKEN_CONFIG + DEFAULT_TOKENS + saved custom tokens ──
function _getAllCgIds() {
  const allCgIds = new Set();
  TOKEN_CONFIG.forEach(t => { if (t.cgId) allCgIds.add(t.cgId); });
  if (typeof DEFAULT_TOKENS !== 'undefined') {
    DEFAULT_TOKENS.forEach(t => { if (t.cgId) allCgIds.add(t.cgId); });
  }
  // Also include any saved tokens (custom chain natives, user-added tokens)
  try {
    const saved = typeof loadSavedTokens === 'function' ? loadSavedTokens() : [];
    saved.forEach(t => { if (t.cgId) allCgIds.add(t.cgId); });
  } catch(e) {}
  return [...allCgIds];
}

// ── STEP 1: Binance Batch — all tokens in ONE request (primary price source) ──
async function _batchFetchBinance(cgIds) {
  // Stablecoins always return $1 — no API call needed
  const stableIds = new Set(['tether','usd-coin','bridged-usd-coin-base','dai','frax','true-usd','true-usd','binance-usd','usdd']);
  const symbolSet = new Set();
  const cgIdToSym = {};

  // Build symbol list from CG_TO_BINANCE map (skip stables & USDTUSDT pseudo-pair)
  cgIds.forEach(id => {
    if (stableIds.has(id)) return;
    const sym = CG_TO_BINANCE[id];
    if (!sym || sym === 'USDTUSDT') return;
    symbolSet.add(sym);
    cgIdToSym[id] = sym;
  });

  // Always include core liquid pairs to guarantee price coverage
  [
    'ETHUSDT','BTCUSDT','BNBUSDT','SOLUSDT','AVAXUSDT','MATICUSDT',
    'ARBUSDT','OPUSDT','DOTUSDT','ADAUSDT','XRPUSDT','DOGEUSDT',
    'SHIBUSDT','ATOMUSDT','LTCUSDT','NEARUSDT','INJUSDT','APTUSDT',
    'SUIUSDT','TIAUSDT','LINKUSDT','UNIUSDT','AAVEUSDT','CAKEUSDT',
    'EURUSDT','USDCUSDT','WBTCUSDT','DAIUSDT','LDOUSDT','GRTUSDT',
    'CRVUSDT','MKRUSDT','DYDXUSDT','GMXUSDT','PENDLEUSDT','RENDERUSDT',
    'FETUSDT','WLDUSDT',
  ].forEach(s => symbolSet.add(s));

  const symbols = [...symbolSet];
  if (!symbols.length) throw new Error('No Binance symbols');

  // Single batch request — Binance /ticker/24hr accepts JSON array of symbols
  const binanceUrl = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}`;
  let arr;
  try {
    const res = await window.nxFetch(binanceUrl, { ms: 8000 });
    if (!res.ok) throw new Error('Binance HTTP ' + res.status);
    const raw = await res.json();
    if (!Array.isArray(raw)) throw new Error('Binance bad response');
    arr = raw;
  } catch(e) {
    return {};
  }

  // Build symbol → ticker map
  const symMap = {};
  arr.forEach(t => { symMap[t.symbol] = t; });

  const result = {};
  // 1. Stables → always $1
  cgIds.forEach(cgId => {
    if (stableIds.has(cgId)) result[cgId] = { usd: 1, usd_24h_change: 0 };
  });
  // 2. All mapped tokens → from Binance ticker
  cgIds.forEach(cgId => {
    if (result[cgId]) return; // already set (stable)
    const sym = cgIdToSym[cgId] || CG_TO_BINANCE[cgId];
    if (!sym || sym === 'USDTUSDT') return;
    const entry = symMap[sym];
    if (!entry) return;
    const price = parseFloat(entry.lastPrice || 0);
    const change = parseFloat(entry.priceChangePercent || 0);
    if (price > 0) result[cgId] = { usd: price, usd_24h_change: change };
  });
  return result;
}

// ── STEP 2: CoinGecko Batch — only for cgIds NOT covered by Binance ──
async function _batchFetchCoinGecko(cgIds) {
  if (!cgIds.length) return {};
  const ids = cgIds.filter(Boolean).join(',');
  const path = `simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
  const data = await _cgFetch(path);
  if (!data || typeof data !== 'object') throw new Error('CoinGecko empty');
  const result = {};
  cgIds.forEach(id => {
    const d = data[id];
    if (d && d.usd > 0) result[id] = { usd: d.usd, usd_24h_change: d.usd_24h_change || 0 };
  });
  return result;
}

// ── STEP 3: CoinMarketCap Batch — only for tokens still missing ──
async function _batchFetchCMC(cgIds) {
  if (!cgIds.length) return {};
  const allTokens = [...TOKEN_CONFIG, ...(typeof DEFAULT_TOKENS !== 'undefined' ? DEFAULT_TOKENS : [])];
  const symToCgId = {};
  allTokens.forEach(t => {
    const s = _cgIdToSymbol(t.cgId||'');
    if (s && cgIds.includes(t.cgId)) symToCgId[s.toUpperCase()] = t.cgId;
  });
  const symList = Object.keys(symToCgId).join(',');
  if (!symList) throw new Error('CMC no symbols');

  // CMC: native bridge only — no proxy fallback. The bridge forwards the
  // X-CMC_PRO_API_KEY header through Java's HttpURLConnection.
  const _cmcDirectUrl = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${symList}&convert=USD`;
  const res = await window.nxFetch(_cmcDirectUrl, {
    headers: { 'X-CMC_PRO_API_KEY': _API_KEYS.CMC_PRO, 'Accept': 'application/json' },
    ms: 9000
  });
  if (!res.ok) throw new Error('CMC fetch failed: HTTP ' + res.status);
  const data = await res.json();
  const result = {};
  Object.values(data.data || {}).forEach(item => {
    const sym = (item.symbol||'').toUpperCase();
    const cgId = symToCgId[sym];
    const q = item.quote?.USD;
    if (cgId && q && q.price > 0) result[cgId] = { usd: q.price, usd_24h_change: q.percent_change_24h || 0 };
  });
  return result;
}

// ── STEP 4: DexScreener — final fallback for on-chain tokens ──
async function _batchFetchDexScreener(cgIds) {
  if (!cgIds.length) return {};
  const allTokens = [...TOKEN_CONFIG, ...(typeof DEFAULT_TOKENS !== 'undefined' ? DEFAULT_TOKENS : [])];
  const targetTokens = allTokens.filter(t => cgIds.includes(t.cgId) && t.address && t.address.startsWith('0x'));
  if (!targetTokens.length) return {};

  const result = {};
  await Promise.allSettled(targetTokens.map(async t => {
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${t.address}`, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) return;
      const data = await res.json();
      const pair = (data.pairs||[]).sort((a,b) => (b.liquidity?.usd||0)-(a.liquidity?.usd||0))[0];
      if (!pair || !pair.priceUsd) return;
      const price = parseFloat(pair.priceUsd);
      if (price > 0 && t.cgId) result[t.cgId] = { usd: price, usd_24h_change: parseFloat(pair.priceChange?.h24||0) };
    } catch(e) {}
  }));
  return result;
}

// ── PRICE FETCH: Binance — ALL tokens in one batch request (legacy compat) ──
async function fetchPricesBinance() {
  const cgIds = _getAllCgIds();
  return _batchFetchBinance(cgIds);
}

// ── Unverified contract tokens: price by CONTRACT + CHAIN only (never by ticker) ──
// See oneSymbolPriceAllowed() in core/sanitize-and-fetch.js. Returns { usd, usd_24h_change } or null.
async function _fetchPriceByContract(t) {
  try {
    const addr = t && (t.contract || t.address);
    if (!addr || !/^0x[0-9a-fA-F]{40}$/.test(addr)) return null;
    const res = await fetch('https://api.dexscreener.com/latest/dex/tokens/' + addr, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = await res.json();
    const pair = oneDexPickPair(data && data.pairs, t);
    if (!pair) return null;
    const usd = parseFloat(pair.priceUsd);
    if (!(usd > 0)) return null;
    return { usd, usd_24h_change: parseFloat(pair.priceChange && pair.priceChange.h24) || 0 };
  } catch (e) { return null; }
}
