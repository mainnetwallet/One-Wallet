
async function fetchPricesCoinMarketCap() {
  const allTokens = [...TOKEN_CONFIG, ...(typeof DEFAULT_TOKENS !== 'undefined' ? DEFAULT_TOKENS : [])];
  const seen = new Set();
  const unique = allTokens.filter(t => { if (!t.cgId || seen.has(t.cgId)) return false; seen.add(t.cgId); return true; });
  const syms = unique.map(t => _cgIdToSymbol(t.cgId)||'').filter(Boolean);
  if (!syms.length) throw new Error('No symbols');
  const slugList = unique.map(t=>t.cgId).join(',');
  const symList  = syms.join(',');

  // Try Pro API first — use native bridge (no CORS, header support)
  const tryUrl = async (url) => {
    const res = await window.nxFetch(url, {
      headers: { 'X-CMC_PRO_API_KEY': _API_KEYS.CMC_PRO, 'Accept': 'application/json' },
      ms: 8000
    });
    if (!res.ok) throw new Error('CMC ' + res.status);
    return res.json();
  };

  let data;
  try {
    data = await tryUrl(`https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?slug=${slugList}&convert=USD`);
  } catch(e) {
    data = await tryUrl(`https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${symList}&convert=USD`);
  }

  const result = {};
  const entries = Object.values(data.data || {});
  if (!entries.length) throw new Error('CMC empty');

  // Build cgId → price map using reverse symbol lookup
  const symToCgId = {};
  unique.forEach(t => { const s = _cgIdToSymbol(t.cgId)||''; if(s) symToCgId[s.toUpperCase()] = t.cgId; });

  entries.forEach(item => {
    const sym = (item.symbol||'').toUpperCase();
    const cgId = symToCgId[sym];
    const q = item.quote?.USD;
    if (cgId && q && q.price > 0) {
      result[cgId] = { usd: q.price, usd_24h_change: q.percent_change_24h || 0 };
    }
  });
  if (!Object.keys(result).length) throw new Error('CMC no matching tokens');
  return result;
}

async function fetchPricesDexScreener() {
  const allTokens = [...TOKEN_CONFIG, ...(typeof DEFAULT_TOKENS !== 'undefined' ? DEFAULT_TOKENS : [])];
  const withAddr = allTokens.filter(t => t.address && t.address.startsWith('0x'));
  if (!withAddr.length) throw new Error('No contract addresses for DexScreener');

  const result = {};
  const chainMap = {1:'ethereum',8453:'base',42161:'arbitrum',10:'optimism',137:'polygon',56:'bsc',43114:'avalanche',324:'zksync'};

  await Promise.allSettled(withAddr.map(async t => {
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${t.address}`, { signal: AbortSignal.timeout(7000) });
      if (!res.ok) return;
      const data = await res.json();
      const pair = (data.pairs||[]).sort((a,b)=>(b.liquidity?.usd||0)-(a.liquidity?.usd||0))[0];
      if (!pair || !pair.priceUsd) return;
      const price = parseFloat(pair.priceUsd);
      if (price > 0 && t.cgId) {
        result[t.cgId] = { usd: price, usd_24h_change: parseFloat(pair.priceChange?.h24||0) };
      }
    } catch(e) {}
  }));

  if (!Object.keys(result).length) throw new Error('DexScreener no prices');
  return result;
}

// ══════════════════════════════════════════════════════════════════
// ⚡ SMART PARALLEL fetchAllPrices
// Per-token fallback: Binance first → CoinGecko → CMC → DexScreener
// All done in parallel batch calls, not sequential per-token loops
// ══════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════
// ⚡ SMART PARALLEL fetchAllPrices — Binance PRIMARY
// Binance covers ~95% of tokens in one batch request (free, no API key)
// Only truly missing tokens fall through to CoinGecko / CMC / DexScreener
// ══════════════════════════════════════════════════════════════════

// ── GLOBAL PRICE CACHE — shared across loadTokens, silentPriceRefresh, chain switch ──
// TTL: 90 seconds (reduced API calls significantly)
let _globalPriceCache = null;
let _globalPriceCacheTime = 0;
const _PRICE_CACHE_TTL = 15000; // 15 seconds — matches live countdown
const _PRICE_LS_KEY = 'one_price_cache_v1';
const _PRICE_LS_TTL = 5 * 60 * 1000; // 5 minutes — price persists across reopen

// ── Persist price cache to localStorage ──
function _savePriceCache() {
  try {
    if (!_globalPriceCache || !Object.keys(_globalPriceCache).length) return;
    localStorage.setItem(_PRICE_LS_KEY, JSON.stringify({
      cache: _globalPriceCache,
      saved: Date.now()
    }));
  } catch(e) {}
}

// ── Restore price cache from localStorage on app open ──
function _restorePriceCache() {
  try {
    var raw = localStorage.getItem(_PRICE_LS_KEY);
    if (!raw) return;
    var data = JSON.parse(raw);
    if (!data || !data.cache) return;
    if (Date.now() - (data.saved || 0) > _PRICE_LS_TTL) return; // expired
    _globalPriceCache = data.cache;
    _globalPriceCacheTime = data.saved; // use saved time so TTL calc is correct
  } catch(e) {}
}

// Detect if running as local file (no server) — Binance blocks origin:null with CORS
const _IS_LOCAL_FILE = (location.protocol === 'file:');

async function fetchAllPrices() {
  // Return cached data if fresh — prevents re-fetch on chain switch or page switch
  const now = Date.now();
  if (_globalPriceCache && (now - _globalPriceCacheTime) < _PRICE_CACHE_TTL) {
    return _globalPriceCache;
  }

  const allCgIds = _getAllCgIds();
  if (!allCgIds.length) throw new Error('No tokens to price');

  const result = {};

  // ── STEP 1: Binance (PRIMARY — free, no key, fastest, covers all major tokens) ──
  // Returns {} silently on file:// CORS block; fallbacks handle remainder
  let binanceResult = {};
  try {
    binanceResult = await _batchFetchBinance(allCgIds);
  } catch(e) { /* silent */ }
  Object.assign(result, binanceResult);

  // ── STEP 2: CoinGecko for tokens NOT covered by Binance (exotic/new tokens) ──
  const missingAfterBinance = allCgIds.filter(id => !result[id]);
  if (missingAfterBinance.length > 0) {
    try {
      const cgResult = await _batchFetchCoinGecko(missingAfterBinance);
      Object.assign(result, cgResult || {});
    } catch(e) { /* silent */ }
  }

  // ── STEP 3: CMC for anything still missing after CoinGecko ──
  const missingAfterCG = allCgIds.filter(id => !result[id]);
  if (missingAfterCG.length > 0) {
    try {
      const cmcResult = await _batchFetchCMC(missingAfterCG);
      Object.assign(result, cmcResult || {});
    } catch(e) {}
  }

  // ── STEP 4: DexScreener — final fallback (on-chain DEX price via contract address) ──
  const missingAfterCMC = allCgIds.filter(id => !result[id]);
  if (missingAfterCMC.length > 0) {
    try {
      const dexResult = await _batchFetchDexScreener(missingAfterCMC);
      Object.assign(result, dexResult || {});
    } catch(e) {}
  }

  if (!Object.keys(result).length) throw new Error('All price sources failed');
  _lastPriceSource = 'Binance';
  // Store in global cache
  _globalPriceCache = result;
  _globalPriceCacheTime = Date.now();
  // Persist to localStorage so prices are instant on app reopen
  _savePriceCache();
  return result;
}

// ══════════════════════════════════════════════════════════════════════════════
// ── CORE RPC ENGINE — _makeProvider / _withRpcFallback / _getProviderWithFallback
// These are used by Home, Swap, Bridge, Send, and every other section.
// They MUST be defined before any section-level code runs.
// ══════════════════════════════════════════════════════════════════════════════

// Provider cache: keyed by "rpcUrl:chainId" — avoids creating duplicate objects
const _providerCache = {};

// Health index per chain — tracks last known working RPC index (shared with _swWithFallback)
const _withRpcHealthIdx = {};

/**
 * _makeProvider(rpc, chainId?)
 * Cached ethers JsonRpcProvider factory. Uses staticNetwork to suppress
 * background eth_chainId polling. Returns cached instance on repeated calls.
 */
function _makeProvider(rpc, chainId) {
  const key = rpc + ':' + (chainId || 0);
  if (_providerCache[key]) return _providerCache[key];
  let p;
  if (chainId) {
    p = new ethers.JsonRpcProvider(rpc, Number(chainId), { staticNetwork: true });
  } else {
    p = new ethers.JsonRpcProvider(rpc);
  }
  _providerCache[key] = p;
  return p;
}

/**
 * _withRpcFallback(chainId, fn, timeoutMs?)
 * Tries each RPC in _getRpcListForChain(chainId) order until fn(provider) succeeds.
 * Maintains a per-chain health index so subsequent calls start from last good RPC.
 * Evicts failed providers from cache. Mirrors _swWithFallback pattern.
 */
async function _withRpcFallback(chainId, fn, timeoutMs = 8000) {
  const rpcs = (typeof _getRpcListForChain === 'function')
    ? _getRpcListForChain(chainId)
    : (typeof getChainRpcs === 'function' ? getChainRpcs(chainId) : []);

  // Graceful fallback if no RPC list is available yet (e.g. very early call)
  if (!rpcs || rpcs.length === 0) {
    const fallbackRpcs = chainId === 8453
      ? ['https://mainnet.base.org', 'https://base.drpc.org', 'https://base-rpc.publicnode.com']
      : ['https://mainnet.base.org'];
    for (const rpc of fallbackRpcs) {
      try {
        const p = _makeProvider(rpc, chainId);
        return await Promise.race([
          fn(p),
          new Promise((_, rej) => setTimeout(() => rej(new Error('RPC timeout')), timeoutMs))
        ]);
      } catch { continue; }
    }
    throw new Error('All RPCs failed for chainId ' + chainId);
  }

  const startIdx = Math.min(_withRpcHealthIdx[chainId] || 0, rpcs.length - 1);
  const ordered  = [...rpcs.slice(startIdx), ...rpcs.slice(0, startIdx)];

  let lastErr;
  for (const rpc of ordered) {
    try {
      const p = _makeProvider(rpc, chainId);
      const result = await Promise.race([
        fn(p),
        new Promise((_, rej) => setTimeout(() => rej(new Error('RPC timeout: ' + rpc)), timeoutMs))
      ]);
      // Success — record healthy index
      const idx = rpcs.indexOf(rpc);
      if (idx >= 0) _withRpcHealthIdx[chainId] = idx;
      return result;
    } catch(e) {
      lastErr = e;
      if (typeof _rpcIsAuthError === 'function' && _rpcIsAuthError(e)) _rpcBadUntil[rpc] = Date.now() + 10 * 60 * 1000;
      // Evict failed provider + advance health index
      const failIdx = rpcs.indexOf(rpc);
      if (failIdx >= 0) _withRpcHealthIdx[chainId] = (failIdx + 1) % rpcs.length;
      const cacheKey = rpc + ':' + (chainId || 0);
      delete _providerCache[cacheKey];
      continue;
    }
  }
  _withRpcHealthIdx[chainId] = 0;
  throw lastErr || new Error('All RPCs failed for chainId ' + chainId);
}

/**
 * _getProviderWithFallback(chainId)
 * Returns the first live provider for the given chain (real liveness test).
 * Used by getProviderWithFallback() and other sections needing a ready provider.
 */
async function _getProviderWithFallback(chainId) {
  const rpcs = (typeof _getRpcListForChain === 'function')
    ? _getRpcListForChain(chainId)
    : (typeof getChainRpcs === 'function' ? getChainRpcs(chainId) : []);
  const list = (rpcs && rpcs.length > 0) ? rpcs : ['https://mainnet.base.org'];
  for (const rpc of list) {
    try {
      const p = _makeProvider(rpc, chainId);
      await Promise.race([
        p.getBlockNumber(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('probe timeout')), 4000))
      ]);
      return p;
    } catch (e) {
      if (typeof _rpcIsAuthError === 'function' && _rpcIsAuthError(e)) _rpcBadUntil[rpc] = Date.now() + 10 * 60 * 1000;
      const key = rpc + ':' + (chainId || 0);
      delete _providerCache[key];
    }
  }
  // All probes failed — return first provider as last resort
  return _makeProvider(list[0], chainId);
}

// ══════════════════════════════════════════════════════════════════════════════

// ── BALANCE FETCH: Basescan (ERC-20 balance for address) ──
// Uses public Basescan API — no key needed for basic calls
async function fetchTokenBalance(contractAddr, walletAddr, decimals) {
  // Use RPC fallback list — tries each in order on failure
  const rpcs = typeof buildRpcList === 'function' ? buildRpcList() : ['https://mainnet.base.org'];
  const erc20Abi = ['function balanceOf(address) view returns (uint256)'];
  for (const rpc of rpcs) {
    try {
      const provider = _makeProvider(rpc, 8453);
      const ct = new ethers.Contract(contractAddr, erc20Abi, provider);
      const raw = await ct.balanceOf(walletAddr);
      return parseFloat(ethers.formatUnits(raw, decimals));
    } catch(e) { continue; }
  }
  return null;
}

// ── TOTAL BALANCES: sum across all loaded wallets via RPC ──
async function fetchAllWalletBalances(contractAddr, decimals) {
  if (validatedKeys.length === 0) return null;
  try {
    const _fbRpcs = typeof buildRpcList === 'function' ? buildRpcList() : ['https://mainnet.base.org'];
    const erc20Abi = ['function balanceOf(address) view returns (uint256)'];
    const addrs = validatedKeys.map(k => { try { return new ethers.Wallet(k).address; } catch(e) { return null; } }).filter(Boolean);
    if (!addrs.length) return null;
    for (const rpc of _fbRpcs) {
      try {
        const provider = _makeProvider(rpc, 8453);
        const ct = new ethers.Contract(contractAddr, erc20Abi, provider);
        const bals = await Promise.all(addrs.map(addr =>
          ct.balanceOf(addr).then(r => parseFloat(ethers.formatUnits(r, decimals))).catch(() => 0)
        ));
        return bals.reduce((a, b) => a + b, 0);
      } catch(e) { continue; }
    }
    return null;
  } catch(e) {}
  return null;
}
