// ── Set data source label — hidden per design spec ──
function _lwSetSource(label, fallback) {
  const el = document.getElementById('tcf-data-source-label');
  if (el) el.style.display = 'none';
}

// ── Load candle data & start WebSocket ──
// tfOnly=true → timeframe-only change: keep trade WS + price poll alive, only restart kline WS
async function _tcfLoadLWData(sym, tf, tfOnly) {
  if (!sym) return;
  sym = sym.toUpperCase();
  window._tcfActiveCoin = sym;
  tf = tf || '24H';

  // Show loading
  const loadEl = document.getElementById('tcf-chart-loading');
  if (loadEl) loadEl.style.display = 'flex';

  // Kill existing WS + polling (skip trade WS & poll if only timeframe changed)
  if (tfOnly) {
    clearTimeout(_lwWsTimer);
    if (_lwWs) { try { _lwWs.onclose = null; _lwWs.close(); } catch(e) {} _lwWs = null; }
  } else {
    _lwKillWs();
  }

  // Try to get REST historical candles
  const cacheKey = sym + '_' + tf;
  let candles = _lwCache[cacheKey] || null;

  if (!candles || candles.length < 2) {
    candles = await _lwFetchCandles(sym, tf);
  }

  if (candles && candles.length >= 2) {
    // IMPORTANT: slice ONCE and reuse the same array reference for both the
    // cache and the rendered candles. The live WS tick handler mutates
    // _lwCache[cacheKey] in place (push/replace last candle) — if this were
    // two separate slice() calls (two different array objects), those live
    // tick updates would never reach window._lwLastCandles, so switching
    // chart type later would silently render stale data even though the
    // coin+timeframe still match.
    const trimmed = candles.slice(-1000);
    _lwCache[cacheKey] = trimmed;
    _lwApplyCandles(trimmed);
    if (loadEl) loadEl.style.display = 'none';
  } else {
    // All REST sources failed — keep loading spinner, show error hint
    if (loadEl) {
      loadEl.style.display = 'flex';
      loadEl.style.background = 'transparent';
      loadEl.style.alignItems = 'flex-end';
      loadEl.style.justifyContent = 'center';
      loadEl.style.paddingBottom = '4px';
      loadEl.innerHTML = '<span style="font-size:8px;color:rgba(255,255,255,0.25);font-family:var(--font-mono);background:rgba(0,0,0,0.5);padding:2px 8px;border-radius:5px;pointer-events:none;">NO DATA</span>';
    }
  }

  // Start WebSocket for live updates (Binance)
  // If tfOnly, skip restarting trade WS (live price stays connected)
  _lwStartWs(sym, tf, tfOnly);
  // Also start REST polling as fallback for live price (skip if tfOnly)
  if (!tfOnly) _lwStartPricePoll(sym);
}

// ── REST price polling fallback (when WebSocket fails) ──
let _lwPollTimer = null;
function _lwStartPricePoll(sym) {
  clearInterval(_lwPollTimer);

  function _applyPrice(p) {
    if (!(p > 0)) return false;
    _lwUpdatePriceEl(p);
    return true;
  }

  _lwPollTimer = setInterval(async () => {
    if (!document.getElementById('token-chart-full-overlay')) {
      clearInterval(_lwPollTimer); return;
    }
    // Skip poll if WS is live
    if (_lwTradeWs && _lwTradeWs.readyState === 1) return;

    // 1. Binance REST
    try {
      const r = await window.nxFetch(`https://api.binance.com/api/v3/ticker/price?symbol=${sym}USDT`, { ms: 5000 });
      if (r.ok) { const d = await r.json(); if (_applyPrice(parseFloat(d.price))) return; }
    } catch(e) {}

    // 2. DexScreener — on-chain tokens not listed on CEX
    try {
      const t = window._tcfToken;
      const addr = t && (t.contract || t.address || t.contractAddress);
      if (addr && addr.startsWith('0x')) {
        const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${addr}`, { signal: AbortSignal.timeout(7000) });
        if (r.ok) {
          const d = await r.json();
          const pair = (d.pairs || []).sort((a,b) => (b.liquidity?.usd||0)-(a.liquidity?.usd||0))[0];
          if (_applyPrice(parseFloat(pair?.priceUsd))) return;
        }
      }
    } catch(e) {}
  }, 15000);
}


