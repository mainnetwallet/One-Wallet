// ── Apply market data to DOM ──
function _tcfApplyMarketData(price, change, mcap, vol, high, low, supply, ath, sym) {
  const set = (id, val) => { const el = document.getElementById(id); if (el && val !== null && val !== undefined) el.textContent = val; };
  const isUp = change >= 0;
  const priceEl = document.getElementById('tcf-price');
  const changeEl = document.getElementById('tcf-change');
  if (priceEl && price) priceEl.textContent = price >= 1 ? '$' + price.toLocaleString('en-US', {minimumFractionDigits:2,maximumFractionDigits:2}) : '$' + price.toPrecision(5);
  if (changeEl && change !== null) {
    changeEl.textContent = (isUp?'+':'') + change.toFixed(2) + '%';
    changeEl.style.color = isUp ? 'var(--accent-green)' : 'var(--accent-red)';
    // Update redesigned pill classes
    changeEl.className = changeEl.className.replace(/\bna\b|\bup\b|\bdn\b/g,'').trim() + ' ' + (isUp ? 'up' : 'dn');
  }
  if (mcap  !== null) set('tcf-mcap',   _tcfFmtNum(mcap));
  if (vol   !== null) set('tcf-vol',    _tcfFmtNum(vol));
  if (high  !== null) set('tcf-high',   high  ? '$' + high.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:6}) : '—');
  if (low   !== null) set('tcf-low',    low   ? '$' + low.toLocaleString('en-US', {minimumFractionDigits:2,maximumFractionDigits:6}) : '—');
  if (supply !== null) set('tcf-supply', _tcfFmtSupply(supply, sym||''));
  if (ath   !== null) set('tcf-ath',    ath   ? '$' + ath.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:6}) : '—');
  // Keep fullscreen HUD in sync
  if (typeof _tcfSyncFsHud === 'function') _tcfSyncFsHud();
}

// ── Fetch market data from DexScreener (for any token with a contract address) ──
async function _tcfFetchDexScreener(t) {
  // Try contract address first (t.contract is the canonical field name)
  const addr = t.contract || t.address || t.contractAddress || t.id;
  const chainId = t.chainId || t.chain;
  if (!addr || !addr.startsWith('0x')) return null;
  try {
    const chainMap = {1:'ethereum',8453:'base',42161:'arbitrum',10:'optimism',137:'polygon',56:'bsc',43114:'avalanche',324:'zksync'};
    const dsChain = chainMap[chainId] || 'ethereum';
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${addr}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    const pair = (data.pairs || []).sort((a,b) => (b.liquidity?.usd||0)-(a.liquidity?.usd||0))[0];
    if (!pair) return null;
    const price  = parseFloat(pair.priceUsd || 0);
    const change = parseFloat(pair.priceChange?.h24 || 0);
    const vol    = pair.volume?.h24 || null;
    const mcap   = pair.marketCap || pair.fdv || null;
    const high   = pair.priceUsd ? price * (1 + Math.abs(change)/100 * 0.5) : null; // estimate
    const low    = pair.priceUsd ? price * (1 - Math.abs(change)/100 * 0.5) : null; // estimate
    return { price, change, mcap, vol, high, low, supply: null, ath: null };
  } catch(e) { return null; }
}

// ── Fetch market data from CryptoCompare (by symbol) ──
async function _tcfFetchCryptoCompare(sym) {
  if (!sym) return null;
  try {
    const res = await window.nxFetch(`https://min-api.cryptocompare.com/data/pricemultifull?fsyms=${sym}&tsyms=USD`, { ms: 8000 });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = data.RAW?.[sym]?.USD;
    if (!raw) return null;
    return {
      price:  raw.PRICE || 0,
      change: raw.CHANGEPCT24HOUR || 0,
      mcap:   raw.MKTCAP || null,
      vol:    raw.TOTALVOLUME24H_TO || null,
      high:   raw.HIGH24HOUR || null,
      low:    raw.LOW24HOUR  || null,
      supply: raw.SUPPLY || null,
      ath:    null,
    };
  } catch(e) { return null; }
}

// ── Fetch market data from Binance ticker (price + 24h stats) ──
async function _tcfFetchBinanceTicker(sym) {
  if (!sym) return null;
  try {
    const res = await window.nxFetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${sym}USDT`, { ms: 6000 });
    if (!res.ok) return null;
    const d = await res.json();
    if (!d.lastPrice) return null;
    return {
      price:  parseFloat(d.lastPrice),
      change: parseFloat(d.priceChangePercent),
      mcap:   null,
      vol:    parseFloat(d.quoteVolume) || null,
      high:   parseFloat(d.highPrice) || null,
      low:    parseFloat(d.lowPrice)  || null,
      supply: null,
      ath:    null,
    };
  } catch(e) { return null; }
}

// ── CoinMarketCap live price fetch for chart overlay ──
async function _tcfFetchCoinMarketCap(t) {
  const sym = _cgIdToSymbol(t.cgId || '') || t.sub?.toUpperCase();
  if (!sym && !t.cgId) return null;
  try {
    const queryParam = sym ? `symbol=${sym.toUpperCase()}` : `slug=${t.cgId}`;
    const res = await fetch(
      `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?${queryParam}&convert=USD`,
      { headers: { 'X-CMC_PRO_API_KEY': _API_KEYS.CMC_PRO, 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const entry = Object.values(data.data || {})[0];
    const q = entry?.quote?.USD;
    if (!q || !q.price) return null;
    return {
      price:  q.price,
      change: q.percent_change_24h || 0,
      mcap:   q.market_cap || null,
      vol:    q.volume_24h || null,
      high:   null,
      low:    null,
      supply: entry.circulating_supply || null,
      ath:    null,
    };
  } catch(e) { return null; }
}