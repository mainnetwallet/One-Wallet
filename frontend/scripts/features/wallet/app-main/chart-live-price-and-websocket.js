
// ── Live price element updater with flash animation ──
let _lwLastPrice = 0;
function _lwUpdatePriceEl(p) {
  const priceEl = document.getElementById('tcf-price');
  if (!priceEl || !p || p <= 0) return;
  const formatted = p >= 1
    ? _formatCurrencyDisplay(p)
    : '$' + p.toPrecision(5);
  if (priceEl.textContent === formatted) return;
  const dir = p > _lwLastPrice ? 'up' : p < _lwLastPrice ? 'down' : '';
  _lwLastPrice = p;
  priceEl.textContent = formatted;
  if (dir) {
    priceEl.style.transition = 'color 0.18s ease';
    priceEl.style.color = dir === 'up' ? '#22c55e' : '#ef4444';
    clearTimeout(priceEl._flashTimer);
    priceEl._flashTimer = setTimeout(() => { priceEl.style.color = ''; }, 400);
  }
  // Sync fullscreen HUD price live
  const fshudPrice = document.getElementById('tcf-fshud-price');
  if (fshudPrice) {
    fshudPrice.textContent = formatted;
    if (dir) {
      fshudPrice.style.transition = 'color 0.18s ease';
      fshudPrice.style.color = dir === 'up' ? '#22c55e' : '#ef4444';
      clearTimeout(fshudPrice._flashTimer);
      fshudPrice._flashTimer = setTimeout(() => { fshudPrice.style.color = '#f0f0fa'; }, 400);
    }
  }
}

// ── Set LIVE dot status on chart price label ──
function _lwSetLiveDot(active, sourceName) {
  const labelEl = document.getElementById('tcf-price-label');
  if (!labelEl) return;
  if (active) {
    // Always show source name
    const srcTag = sourceName
      ? ` <span style="font-size:8px;letter-spacing:.5px;opacity:.75;font-weight:500;">· ${sourceName}</span>`
      : '';
    labelEl.innerHTML = `<span style="display:inline-flex;align-items:center;gap:4px;"><span style="width:5px;height:5px;border-radius:50%;background:#22c55e;box-shadow:0 0 6px #22c55e;animation:pulse 2s infinite;display:inline-block;flex-shrink:0;"></span> LIVE${srcTag}</span>`;
    labelEl.style.color = '#22c55e';
  } else {
    labelEl.innerHTML = 'Current Price';
    labelEl.style.color = '';
  }
}

// ── Trade WebSocket for live price — Binance → Coinbase → Bybit → MEXC → Gate.io → Bitget → Kraken ──
let _lwTradeWs = null;
let _lwTradeRetry = 0;
let _lwTradeTimer = null;
let _lwTradeSource = 0; // 0=Binance,1=Coinbase,2=Bybit,3=MEXC,4=Gate.io,5=Bitget,6=Kraken

const _LW_WS_SOURCES = [
  // ── 0: Binance aggTrade ──
  {
    name: 'Binance',
    url:  sym => `wss://stream.binance.com:9443/ws/${sym.toLowerCase()}usdt@aggTrade`,
    parse: msg => parseFloat(msg.p) || 0,
  },
  // ── 1: Coinbase Advanced market trades ──
  {
    name: 'Coinbase',
    url:  sym => `wss://advanced-trade-ws.coinbase.com`,
    onopen: (ws, sym) => {
      const productId = sym.toUpperCase() === 'BTC' ? 'BTC-USDT' : `${sym.toUpperCase()}-USDT`;
      ws.send(JSON.stringify({ type: 'subscribe', product_ids: [productId], channel: 'market_trades' }));
    },
    parse: msg => {
      if (msg.channel === 'market_trades') {
        const trades = msg.events?.[0]?.trades;
        if (Array.isArray(trades) && trades.length) return parseFloat(trades[trades.length - 1].price) || 0;
      }
      return 0;
    },
  },
  // ── 2: Bybit publicTrade ──
  {
    name: 'Bybit',
    url:  sym => `wss://stream.bybit.com/v5/public/spot`,
    onopen: (ws, sym) => {
      ws.send(JSON.stringify({ op: 'subscribe', args: [`publicTrade.${sym.toUpperCase()}USDT`] }));
    },
    parse: msg => {
      const data = msg.data;
      if (Array.isArray(data) && data.length) return parseFloat(data[data.length - 1].p) || 0;
      return 0;
    },
  },
  // ── 3: MEXC spot trade ──
  {
    name: 'MEXC',
    url:  sym => `wss://wbs.mexc.com/ws`,
    onopen: (ws, sym) => {
      ws.send(JSON.stringify({ method: 'SUBSCRIPTION', params: [`spot@public.deals.v3.api@${sym.toUpperCase()}USDT`] }));
    },
    parse: msg => {
      const deals = msg.d?.deals;
      if (Array.isArray(deals) && deals.length) return parseFloat(deals[0].p) || 0;
      return 0;
    },
  },
  // ── 4: Gate.io spot trades ──
  {
    name: 'Gate.io',
    url:  sym => `wss://api.gateio.ws/ws/v4/`,
    onopen: (ws, sym) => {
      ws.send(JSON.stringify({ time: Math.floor(Date.now()/1000), channel: 'spot.trades', event: 'subscribe', payload: [`${sym.toUpperCase()}_USDT`] }));
    },
    parse: msg => {
      if (msg.channel === 'spot.trades' && msg.event === 'update') {
        return parseFloat(msg.result?.price) || 0;
      }
      return 0;
    },
  },
  // ── 5: Bitget spot trades ──
  {
    name: 'Bitget',
    url:  sym => `wss://ws.bitget.com/v2/ws/public`,
    onopen: (ws, sym) => {
      ws.send(JSON.stringify({ op: 'subscribe', args: [{ instType: 'SPOT', channel: 'trade', instId: `${sym.toUpperCase()}USDT` }] }));
    },
    parse: msg => {
      const data = msg.data;
      if (Array.isArray(data) && data.length) return parseFloat(data[data.length - 1][1]) || 0;
      return 0;
    },
  },
  // ── 6: Kraken spot trade ──
  {
    name: 'Kraken',
    url:  sym => `wss://ws.kraken.com/v2`,
    onopen: (ws, sym) => {
      const pair = sym.toUpperCase() === 'BTC' ? 'XBT/USDT' : `${sym.toUpperCase()}/USDT`;
      ws.send(JSON.stringify({ method: 'subscribe', params: { channel: 'trade', symbol: [pair] } }));
    },
    parse: msg => {
      if (msg.channel === 'trade' && Array.isArray(msg.data) && msg.data.length) {
        return parseFloat(msg.data[msg.data.length - 1].price) || 0;
      }
      return 0;
    },
  },
];

function _lwStartTradeWs(sym) {
  if (_lwTradeWs) { try { _lwTradeWs.onclose = null; _lwTradeWs.close(); } catch(e) {} _lwTradeWs = null; }
  clearTimeout(_lwTradeTimer);

  const sourceIdx = _lwTradeSource % _LW_WS_SOURCES.length;
  const source    = _LW_WS_SOURCES[sourceIdx];

  function _onFail() {
    _lwSetLiveDot(false);
    _lwTradeSource++;
    const nextIdx = _lwTradeSource % _LW_WS_SOURCES.length;
    // Full cycle completed → backoff before retrying from Binance
    if (nextIdx === 0) {
      _lwTradeRetry++;
      const delay = Math.min(30000, 3000 * Math.pow(2, _lwTradeRetry - 1));
      _lwTradeTimer = setTimeout(() => {
        if (document.getElementById('token-chart-full-overlay')) _lwStartTradeWs(window._tcfActiveCoin || sym);
      }, delay);
    } else {
      // Instantly try next source — no delay
      if (document.getElementById('token-chart-full-overlay')) _lwStartTradeWs(window._tcfActiveCoin || sym);
    }
  }

  function _onPrice(p) {
    if (p > 0) { _lwTradeRetry = 0; _lwUpdatePriceEl(p); }
  }

  // ── KuCoin uses async connect ──
  if (source.connectAsync) {
    source.connectAsync(sym, _onPrice, _onFail).then(ws => {
      if (ws) {
        _lwTradeWs = ws;
        _lwSetLiveDot(true, source.name);
        // Wrap onclose for reconnect
        ws.onclose = _onFail;
        ws.onerror = _onFail;
      }
    });
    return;
  }

  try {
    const url = source.url(sym);
    _lwTradeWs = new WebSocket(url);
    _lwTradeWs.onopen = () => {
      _lwTradeRetry = 0;
      _lwSetLiveDot(true, source.name);
      if (source.onopen) source.onopen(_lwTradeWs, sym);
    };
    _lwTradeWs.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        const p = source.parse(msg);
        _onPrice(p);
      } catch(err) {}
    };
    _lwTradeWs.onerror = _onFail;
    _lwTradeWs.onclose = _onFail;
  } catch(err) { _onFail(); }
}

// ── WebSocket: Binance kline stream → candle chart updates ──
// skipTradeWs=true → only restart kline WS, keep trade WS alive (used on timeframe change)
function _lwStartWs(sym, tf, skipTradeWs) {
  if (skipTradeWs) {
    // Only kill & restart kline WS — trade WS stays connected for live price
    clearTimeout(_lwWsTimer);
    if (_lwWs) { try { _lwWs.onclose = null; _lwWs.close(); } catch(e) {} _lwWs = null; }
  } else {
    _lwKillWs();
    _lwStartTradeWs(sym); // 1s live price via aggTrade
  }

  const { interval } = _TF_MAP[tf] || _TF_MAP['1h'];
  const streamUrl = `wss://stream.binance.com:9443/ws/${sym.toLowerCase()}usdt@kline_${interval}`;
  try {
    _lwWs = new WebSocket(streamUrl);

    _lwWs.onopen = () => {
      _lwWsRetry = 0;
      clearTimeout(_lwWsTimer);
      _lwSetSource('Binance Live', false);
    };

    _lwWs.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        const k = msg.k;
        if (!k) return;
        const candle = {
          time:   Math.floor(parseInt(k.t) / 1000),
          open:   parseFloat(k.o), high: parseFloat(k.h),
          low:    parseFloat(k.l), close: parseFloat(k.c),
          volume: parseFloat(k.v),
        };
        const cacheKey = sym + '_' + tf;
        if (_lwCache[cacheKey]) {
          const cache = _lwCache[cacheKey];
          const last = cache[cache.length - 1];
          if (last && last.time === candle.time) cache[cache.length - 1] = candle;
          else if (!last || candle.time > last.time) { cache.push(candle); if (cache.length > 1000) cache.shift(); }
        }
        if (_lwCandleSeries) {
          const _ct = window._tcfChartType || 'candle';
          if (_ct === 'heikinashi') {
            const prev = window._lwLastCandles && window._lwLastCandles.length > 0 ? window._lwLastCandles[window._lwLastCandles.length - 1] : null;
            const haClose = (candle.open + candle.high + candle.low + candle.close) / 4;
            const haOpen  = prev ? (prev.open + prev.close) / 2 : (candle.open + candle.close) / 2;
            const haHigh  = Math.max(candle.high, haOpen, haClose);
            const haLow   = Math.min(candle.low,  haOpen, haClose);
            _lwCandleSeries.update({ time: candle.time, open: haOpen, high: haHigh, low: haLow, close: haClose });
          } else if (_ct === 'baseline' || _ct === 'line' || _ct === 'area') {
            _lwCandleSeries.update({ time: candle.time, value: candle.close });
          } else if (_ct === 'candle' || _ct === 'bar' || _ct === 'hollowcandle') {
            _lwCandleSeries.update(candle);
          }
          // renko/kagi/pnf/linebreak are derived/aggregated chart types where a single
          // live kline tick doesn't map 1:1 to one bar/box/point — skip live series
          // updates for these (they're fully recomputed on each TF/data reload instead
          // of being fed mismatched raw OHLC data, which previously could corrupt or
          // silently fail to render on the underlying series type).
        }
        if (_lwVolSeries) _lwVolSeries.update({ time: candle.time, value: candle.volume, color: candle.close >= candle.open ? 'rgba(16,185,129,0.5)' : 'rgba(244,63,94,0.5)' });
        // Live MA update — use already-updated _lwLastCandles (cache block above already synced it)
        if ((_lwMa7 || _lwMa25 || _lwMa99) && window._lwLastCandles) {
          const allC = window._lwLastCandles;
          const n = allC.length;
          const maPoint = (period) => {
            if (n < period) return null;
            let sum = 0;
            for (let i = n - period; i < n; i++) sum += allC[i].close;
            return { time: candle.time, value: sum / period };
          };
          const v7 = maPoint(7), v25 = maPoint(25), v99 = maPoint(99);
          if (_lwMa7  && v7)  try { _lwMa7.update(v7);  } catch(e){}
          if (_lwMa25 && v25) try { _lwMa25.update(v25); } catch(e){}
          if (_lwMa99 && v99) try { _lwMa99.update(v99); } catch(e){}
        }
        // Always sync HUD price from candle close (matches chart label exactly)
        const fshudPrice = document.getElementById('tcf-fshud-price');
        if (fshudPrice) {
          const p = candle.close;
          const formatted = p >= 1 ? _formatCurrencyDisplay(p) : '$' + p.toPrecision(5);
          if (fshudPrice.textContent !== formatted) {
            const dir = p > _lwLastPrice ? 'up' : p < _lwLastPrice ? 'down' : '';
            fshudPrice.textContent = formatted;
            if (dir) {
              fshudPrice.style.transition = 'color 0.18s ease';
              fshudPrice.style.color = dir === 'up' ? '#22c55e' : '#ef4444';
              clearTimeout(fshudPrice._flashTimer);
              fshudPrice._flashTimer = setTimeout(() => { fshudPrice.style.color = '#f0f0fa'; }, 400);
            }
          }
        }
        // Fallback price if trade WS not connected
        if (!_lwTradeWs || _lwTradeWs.readyState !== 1) _lwUpdatePriceEl(candle.close);
      } catch(err) {}
    };

    _lwWs.onerror = () => {};

    _lwWs.onclose = () => {
      const delay = Math.min(30000, 2000 * Math.pow(2, _lwWsRetry));
      _lwWsRetry++;
      _lwWsTimer = setTimeout(() => {
        if (document.getElementById('token-chart-full-overlay')) _lwStartWs(window._tcfActiveCoin || sym, window._tcfTf || tf, true);
      }, delay);
    };
  } catch(err) {}
}

function _lwKillWs() {
  clearTimeout(_lwWsTimer);
  clearTimeout(_lwTradeTimer);
  clearInterval(_lwPollTimer);
  _lwPollTimer = null;
  if (_lwWs) { try { _lwWs.onclose = null; _lwWs.close(); } catch(e) {} _lwWs = null; }
  if (_lwTradeWs) { try { _lwTradeWs.onclose = null; _lwTradeWs.close(); } catch(e) {} _lwTradeWs = null; }
  _lwTradeSource = 0; // reset to Binance for next open
  _lwTradeRetry  = 0;
  _lwSetLiveDot(false);
}