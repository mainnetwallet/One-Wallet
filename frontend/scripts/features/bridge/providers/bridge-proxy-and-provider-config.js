

  const LIFI_API  = 'https://li.quest/v1';
  const RUBIC_API = 'https://api-v2.rubic.exchange/api';
  const RANGO_API = 'https://api.rango.exchange';
  const RANGO_KEY = window._ONE_RANGO_KEY;

  // ── Proxy-aware fetch for bridge APIs: native bridge → direct → relay/GET proxies ──
  const _BR_RELAY_PROXIES = [
    'https://project-dn5l2.vercel.app/api/relay',
    'https://oneproxy.alihasi.deno.net/relay',
    'https://one-wallet-proxy.netlify.app/.netlify/functions/relay',
    'https://one-relay-workers.alihasan09765.workers.dev/relay',
    'https://seslyfqxbbrgpxhtprhu.supabase.co/functions/v1/relay',
  ];
  const _BR_GET_PROXIES   = [
    'https://project-dn5l2.vercel.app/api/proxy?url=',
    'https://oneproxy.alihasi.deno.net/proxy?url=',
    'https://one-wallet-proxy.netlify.app/.netlify/functions/proxy?url=',
    'https://one-relay-workers.alihasan09765.workers.dev/proxy?url=',
    'https://seslyfqxbbrgpxhtprhu.supabase.co/functions/v1/proxy?url=',
  ];

  async function _brProxyFetch(url, init, ms) {
    ms = ms || 20000;
    const isPost = init && (init.method || 'GET').toUpperCase() === 'POST';
    // 1. Native Android bridge (GET only)
    if (!isPost && window.nxBridgeGet) {
      try {
        const _nj = await nxBridgeGet(url, ms);
        if (_nj != null) return { ok: true, status: 200, json: () => Promise.resolve(_nj), text: () => Promise.resolve(JSON.stringify(_nj)) };
      } catch (_) {}
    }
    // 2. Direct fetch
    try {
      const _r = await fetch(url, { ...(init || {}), signal: AbortSignal.timeout(ms) });
      if (_r.ok) return _r;
    } catch (_) {}
    // 3. Proxy fallback
    if (isPost) {
      for (const _p of _BR_RELAY_PROXIES) {
        try {
          const _rb = JSON.stringify({ url, method: 'POST', headers: (init && init.headers) || {}, body: init && init.body });
          const _r = await fetch(_p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: _rb, signal: AbortSignal.timeout(ms) });
          if (_r.ok) return _r;
        } catch (_) {}
      }
    } else {
      for (const _p of _BR_GET_PROXIES) {
        try {
          const _r = await fetch(_p + encodeURIComponent(url), { ...(init || {}), signal: AbortSignal.timeout(ms) });
          if (_r.ok) return _r;
        } catch (_) {}
      }
    }
    throw new Error('_brProxyFetch: all failed for ' + url.split('?')[0]);
  }

  // ── Rubic status (shared by live poller + history checkers) ──
  // Prefers /info/statusExtended (needs the trade `id` from /routes/swap — required for
  // deposit/intent-based providers such as NEAR Intents) and falls back to the legacy
  // /info/status?srcTxHash= endpoint. Returns { raw:'SUCCESS'|'FAIL'|..., data, recv } or null.
  const _BR_RUBIC_FAIL = ['FAIL', 'FAILED', 'REVERT', 'REVERTED'];
  async function _brRubicStatus(srcTxHash, tradeId, ms) {
    ms = ms || 10000;
    const urls = [];
    if (tradeId) urls.push('https://api-v2.rubic.exchange/api/info/statusExtended?id=' + encodeURIComponent(tradeId) + '&srcTxHash=' + encodeURIComponent(srcTxHash));
    urls.push('https://api-v2.rubic.exchange/api/info/status?srcTxHash=' + encodeURIComponent(srcTxHash));
    for (let i = 0; i < urls.length; i++) {
      try {
        const r = await _brProxyFetch(urls[i], {}, ms);
        if (!r || !r.ok) continue;
        const d = await r.json();
        const st = String((d && d.status) || '').toUpperCase();
        if (!st) continue;
        // extended endpoint can't resolve it yet → ask the legacy endpoint too
        if (i < urls.length - 1 && (st === 'NOT_FOUND' || st === 'INDETERMINATE')) continue;
        return { raw: st, data: d, recv: d.destinationTxHash || d.dstTxHash || null };
      } catch (_) { /* try next endpoint */ }
    }
    return null;
  }

  // ── Active provider state ──
  let _brProvider = 'lifi'; // 'lifi' | 'rubic' | 'rango' | 'socket'
  // Per-provider cached routes
  const _brProvRoutes = { lifi: [], rubic: [], rango: [], socket: [] };

  // ── Rango chain id map (chainId → Rango blockchain name) ──
  const RANGO_CHAINS = {
    1:      'ETH',
    56:     'BSC',
    137:    'POLYGON',
    43114:  'AVAX_CCHAIN',
    42161:  'ARBITRUM',
    10:     'OPTIMISM',
    8453:   'BASE',
    250:    'FANTOM',
    100:    'GNOSIS',
    59144:  'LINEA',
    534352: 'SCROLL',
    324:    'ZKSYNC',
    5000:   'MANTLE',
    81457:  'BLAST',
    130:    'UNICHAIN',
  };

  // ── Rubic blockchain name map ──
  const RUBIC_CHAINS = {
    1:      'ETH',
    56:     'BSC',
    137:    'POLYGON',
    43114:  'AVALANCHE',
    42161:  'ARBITRUM',
    10:     'OPTIMISM',
    8453:   'BASE',
    250:    'FANTOM',
    100:    'GNOSIS',
    59144:  'LINEA',
    534352: 'SCROLL',
    324:    'ZK_SYNC',
    5000:   'MANTLE',
    81457:  'BLAST',
  };

  // ── Provider chip switcher ── (no-op: all routes shown together)
  window.brSetProvider = function(prov) { /* all providers always shown */ };

  function _brUpdateProvCount(prov, count) {
    // Individual provider counts no longer shown; update single total badge
    const allEl = document.getElementById('br-prov-all-count');
    if (allEl) {
      const total = (_brProvRoutes.lifi ? _brProvRoutes.lifi.length : 0)
                  + (_brProvRoutes.rubic ? _brProvRoutes.rubic.length : 0)
                  + (_brProvRoutes.rango ? _brProvRoutes.rango.length : 0)
                  + (_brProvRoutes.socket ? _brProvRoutes.socket.length : 0);
      allEl.textContent = total > 0 ? '(' + total + ')' : '';
    }
  }