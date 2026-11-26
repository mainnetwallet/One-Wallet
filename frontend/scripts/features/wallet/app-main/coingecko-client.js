// ── API KEYS CONFIG ──
const _API_KEYS = {
  // CoinGecko Pro API key — leave empty string '' if you don't have a paid Pro plan key
  // Pro plan keys look like: CG-xxxx and are obtained at https://pro.coingecko.com
  CG_PRO:   '',  // ← Set your Pro key here if you have one; blank = skip Pro endpoint
  // CoinGecko Demo API key — free, get at https://www.coingecko.com/en/api
  CG_DEMO:  '',  // Public API — no key needed (30 calls/min free tier)
  // CoinMarketCap Pro API key — used first for all CMC requests
  CMC_PRO:  'fb8266cbc4414563977931a87ed3ef88',
  // 1inch Dev Portal API key — used for direct 1inch Swap API v6.0 calls
  // Get yours at: https://portal.1inch.dev/
  INCH_API: '5Pr7cq6rbWGFEvgJgJa9JOM5c21Ia1Nd',
};

// ── CORS-safe CoinGecko fetch ──
// file:// → skip direct API (CORS blocked), go straight to proxy chain
// Proxies are tried in order; first successful response wins.
let _cgProApiFailed = false;
let _cgDemoBackoffUntil = 0;
const _isLocalFile = (location.protocol === 'file:');

// Persistent disk cache via localStorage — survives page reload, cuts proxy calls
const _CG_LS_PREFIX = 'one_cg_';
const _CG_LS_TTL    = 3 * 60 * 1000; // 3 minutes

function _cgLsGet(path) {
  try {
    const raw = localStorage.getItem(_CG_LS_PREFIX + btoa(path).slice(0, 40));
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts < _CG_LS_TTL) return data;
    localStorage.removeItem(_CG_LS_PREFIX + btoa(path).slice(0, 40));
  } catch(e) {}
  return null;
}

function _cgLsSet(path, data) {
  try {
    localStorage.setItem(
      _CG_LS_PREFIX + btoa(path).slice(0, 40),
      JSON.stringify({ ts: Date.now(), data })
    );
  } catch(e) {}
}

async function _cgNativeFetch(url, ms) {
  try {
    const res = await window.nxFetch(url, { ms: ms });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && typeof data === 'object' && !data.status?.error_code) return data;
  } catch(e) {}
  return null;
}

async function _cgFetch(path) {
  const target = 'https://api.coingecko.com/api/v3/' + path;

  // 0. localStorage cache
  const cached = _cgLsGet(path);
  if (cached) return cached;

  // 1. CoinGecko Pro key (if set)
  if (!_cgProApiFailed && _API_KEYS.CG_PRO) {
    try {
      const sep = path.includes('?') ? '&' : '?';
      const res = await window.nxFetch(`https://pro-api.coingecko.com/api/v3/${path}${sep}x_cg_pro_api_key=${_API_KEYS.CG_PRO}`, { ms: 8000 });
      if (res.ok) {
        const data = await res.json();
        if (data && !data.status?.error_code) { _cgLsSet(path, data); return data; }
      }
      if ([400, 401, 403, 429].includes(res.status)) _cgProApiFailed = true;
    } catch(e) {}
  }

  // 2. Direct CoinGecko public API — fastest, no proxy needed
  if (Date.now() > _cgDemoBackoffUntil) {
    try {
      const sep = path.includes('?') ? '&' : '?';
      const demoParam = _API_KEYS.CG_DEMO ? `${sep}x_cg_demo_api_key=${_API_KEYS.CG_DEMO}` : '';
      const res = await fetch(target + demoParam, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const data = await res.json();
        if (data && !data.status?.error_code) { _cgLsSet(path, data); return data; }
      } else if (res.status === 429) {
        _cgDemoBackoffUntil = Date.now() + 120000;
      }
    } catch(e) {}
  }

  // 3. Native bridge — last resort only, no public CORS proxy needed
  const data = await _cgNativeFetch(target, 10000);
  if (data) { _cgLsSet(path, data); return data; }

  throw new Error('CoinGecko fetch failed: ' + path);
}

