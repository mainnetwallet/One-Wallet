// Convert tab: token list, mode, balance, quote and execute
// Part of the exchange spot engine (window.EXC) module (split by topic; no logic change).
(function (__NX) {
  __NX.convFetchTokenList = convFetchTokenList;
  __NX.convSetMode = convSetMode;
  __NX.convRefreshUI = convRefreshUI;
  __NX.convRenderTokenBtn = convRenderTokenBtn;
  __NX.convTokenColor = convTokenColor;
  __NX.convLoadBalance = convLoadBalance;
  __NX.convFetchBalance = convFetchBalance;
  __NX.convOnInput = convOnInput;
  __NX._convStopBtnCountdown = _convStopBtnCountdown;
  __NX.convExecute = convExecute;
  __NX.convFmtAmt = convFmtAmt;

  // ──────────────────────────────────────────────

  // ═══════════════════════════════════════════════════════
  //  CONVERT MODE
  // ═══════════════════════════════════════════════════════
  var _convState = {
    fromSym: 'USDT',
    toSym:   'BNB',
    fromAmt: '',
    quoteId: null,
    quoteTtl: 30,
    quoteTimer: null,
    btnTimer:   null,   // countdown on Preview button
    debounceTimer: null,
    allTokens: [],
    pickerSide: 'from',
  }; __NX._convState = _convState;

  // Per-exchange convert token list cache
  var _convTokensCache = {};  // { excId: ['BTC','ETH',...] }

  // ── Fetch official convert-eligible token list per exchange ──
  async function convFetchTokenList() {
    var exc  = __NX.activeExc();
    var keys = __NX.getExchangeKey(__NX.state.activeExchange);
    var cached = _convTokensCache[exc.id];
    if (cached) return cached;

    var syms = [];
    try {
      if (exc.id === 'binance') {
        // GET /sapi/v1/convert/exchangeInfo — requires auth (HMAC)
        var d = await __NX.binanceFetch('/sapi/v1/convert/exchangeInfo', {}, keys);
        (d || []).forEach(function(item) {
          if (item.fromAsset) syms.push(item.fromAsset);
          if (item.toAsset)   syms.push(item.toAsset);
        });

      } else if (exc.id === 'kucoin') {
        // GET /api/v1/convert/currencies — public
        var d = await __NX.kucoinFetch('/api/v1/convert/currencies', {}, keys);
        ((d && d.data) || []).forEach(function(c) { syms.push(c.currency || c); });

      } else if (exc.id === 'bybit') {
        // GET /v5/asset/exchange/query-coin-list — auth required
        var d = await __NX.bybitFetch('/v5/asset/exchange/query-coin-list', { side: 0 }, keys);
        (((d && d.result) || {}).coins || []).forEach(function(c) { syms.push(c.coin); });

      } else if (exc.id === 'bitget') {
        // GET /api/v2/convert/currencies — public
        var d = await __NX.bitgetFetch('/api/v2/convert/currencies', {}, keys);
        ((d && d.data) || []).forEach(function(c) { syms.push(c.coin || c.currency || c); });

      } else if (exc.id === 'gateio') {
        // GET /api/v4/convert/currencies — public
        var d = await __NX.gateioFetch('/api/v4/convert/currencies', {}, keys);
        (d || []).forEach(function(c) { syms.push(c.currency || c); });

      }
    } catch(e) { /* fallback below */ }

    // Deduplicate + sort
    var unique = [];
    var seen = {};
    syms.forEach(function(s) {
      if (s && !seen[s]) { seen[s] = true; unique.push(s); }
    });
    unique.sort();

    // Fallback to spot market symbols if API failed or returned nothing
    if (unique.length === 0) {
      var markets = __NX._marketsCache[exc.id] || __NX.state.markets || [];
      var spotSeen = {};
      markets.forEach(function(m) {
        var b = (m.baseAsset || m.baseCurrency || m.base || '').toUpperCase();
        var q = (m.quoteAsset || m.quoteCurrency || m.quote || '').toUpperCase();
        if (b && !spotSeen[b]) { spotSeen[b]=true; unique.push(b); }
        if (q && !spotSeen[q]) { spotSeen[q]=true; unique.push(q); }
      });
      ['USDT','BTC','ETH','BNB','SOL','USDC'].forEach(function(s){
        if (!spotSeen[s]) { spotSeen[s]=true; unique.push(s); }
      });
      unique.sort();
    }

    _convTokensCache[exc.id] = unique;
    return unique;
  }

  // Convert API support per exchange
  // Binance:  /sapi/v1/convert/getQuote  + /sapi/v1/convert/acceptQuote
  // KuCoin:   /api/v1/convert/quote      + /api/v1/convert/order
  // Bybit:    /v5/asset/exchange/quote-info + /v5/asset/exchange/convert
  // Bitget:   /api/v2/convert/quote      + /api/v2/convert/trade
  // Gate.io:  /api/v4/convert/quote      + /api/v4/convert/trade
  // Coinbase: /brokerage/convert/quote   + /brokerage/convert/trade
  // HTX:      /v2/otc/pubinfo (limited)

  function convSupported() {
    return !!__NX.activeExc().supportsConvert;
  }

  // ── Switch between Convert / Spot modes ──
  function convSetMode(mode) {
    var convEl  = document.getElementById('exc-convert-content');
    var spotEl  = document.getElementById('exc-spot-content');
    var tabConv = document.getElementById('exc-ctab-convert');
    var tabSpot = document.getElementById('exc-ctab-spot');
    if (!convEl || !spotEl) return;

    if (mode === 'convert') {
      convEl.style.display = 'flex';
      spotEl.style.display = 'none';
      if (tabConv) { tabConv.classList.add('active'); }
      if (tabSpot) { tabSpot.classList.remove('active'); }
      convRefreshUI();
    } else {
      convEl.style.display = 'none';
      spotEl.style.display = 'flex';
      if (tabConv) { tabConv.classList.remove('active'); }
      if (tabSpot) { tabSpot.classList.add('active'); }
    }
  }

  // ── Refresh Convert UI when exchange changes ──
  function convRefreshUI() {
    var supported  = convSupported();
    var keys       = __NX.getExchangeKey(__NX.state.activeExchange);
    var uiEl       = document.getElementById('exc-conv-ui');
    var unsupEl    = document.getElementById('exc-conv-unsupported');
    var nokeyEl    = document.getElementById('exc-conv-nokey');
    var previewBtn = document.getElementById('exc-conv-preview-btn');

    if (!supported) {
      if (uiEl)    uiEl.style.display    = 'none';
      if (unsupEl) unsupEl.style.display = 'flex';
      return;
    }
    if (uiEl)    uiEl.style.display    = 'flex';
    if (unsupEl) unsupEl.style.display = 'none';
    if (nokeyEl) nokeyEl.style.display = keys ? 'none' : 'block';
    if (previewBtn) previewBtn.disabled = true; // always disable until valid quote

    // Reset _convState
    _convStopBtnCountdown();
    _convState.quoteId    = null;
    _convState.quoteTtl   = 30;
    _convState.toAmt      = null;
    _convState.fromAmt    = null;
    _convState.allTokens  = []; // force re-fetch on next picker open

    // Reset smart default: USDT → active pair's base token
    var pair = __NX.state.activePair || 'BTCUSDT';
    var base = pair.replace(/(USDT|BTC|ETH|BNB)$/, '');
    var quote = pair.replace(base, '');
    _convState.fromSym = quote || 'USDT';
    _convState.toSym   = base  || 'BTC';
    convRenderTokenBtn('from', _convState.fromSym);
    convRenderTokenBtn('to',   _convState.toSym);

    var fromAmtEl = document.getElementById('exc-conv-from-amt');
    if (fromAmtEl) fromAmtEl.value = '';
    __NX.convSetToAmt('—');
    __NX.convSetRate('Enter amount to get a quote');
    convLoadBalance(_convState.fromSym);
  }

  // ── Render a token button (logo + symbol) ──
  function convRenderTokenBtn(side, sym) {
    var logoEl = document.getElementById('exc-conv-' + side + '-logo');
    var symEl  = document.getElementById('exc-conv-' + side + '-sym');
    if (logoEl) {
      logoEl.textContent = sym[0];
      logoEl.style.background = convTokenColor(sym);
    }
    if (symEl) symEl.textContent = sym;
  }

  function convTokenColor(sym) {
    var colors = { BTC:'#F7931A', ETH:'#627EEA', BNB:'#F0B90B', SOL:'#9945FF',
      USDT:'#26A17B', USDC:'#2775CA', XRP:'#00AAE4', ADA:'#0033AD',
      DOGE:'#C2A633', DOT:'#E6007A', MATIC:'#8247E5', LINK:'#375BD2',
      AVAX:'#E84142', ATOM:'#2E3148', LTC:'#BFBBBB', TRX:'#EF0027',
      UNI:'#FF007A', SHIB:'#FFA409', FTM:'#1969FF', OP:'#FF0420', ARB:'#12AAFF'
    };
    return colors[sym] || '#' + (parseInt(sym.charCodeAt(0)*sym.charCodeAt(1||0)).toString(16).padStart(6,'0').slice(0,6));
  }

  // ── Load balance for From token ──
  async function convLoadBalance(sym) {
    var balEl = document.getElementById('exc-conv-from-bal');
    if (!balEl) return;
    balEl.textContent = 'Balance: —';
    var keys = __NX.getExchangeKey(__NX.state.activeExchange);
    if (!keys) return;
    try {
      var bal = await convFetchBalance(sym, keys);
      balEl.textContent = 'Balance: ' + (bal != null ? parseFloat(bal).toFixed(6) + ' ' + sym : '—');
    } catch(e) { balEl.textContent = 'Balance: —'; }
  }

  async function convFetchBalance(sym, keys) {
    var exc = __NX.activeExc();
    try {
      if (exc.id === 'binance' || exc.id === 'mexc') {
        var d = await __NX.binanceFetch('/api/v3/account', {}, keys);
        var bal = ((d.balances||[]).find(function(b){ return b.asset === sym; })||{}).free;
        return bal;
      } else if (exc.id === 'kucoin') {
        var d = await __NX.kucoinFetch('/api/v1/accounts', {type:'trade'}, keys);
        var bal = ((d.data||[]).find(function(b){ return b.currency === sym; })||{}).available;
        return bal;
      } else if (exc.id === 'bybit') {
        var d = await __NX.bybitFetch('/v5/account/wallet-balance', {accountType:'SPOT'}, keys);
        var coins = (((d.result||{}).list||[])[0]||{}).coin || [];
        var bal = (coins.find(function(c){ return c.coin === sym; })||{}).availableToWithdraw;
        return bal;
      } else if (exc.id === 'bitget') {
        var d = await __NX.bitgetFetch('/api/v2/spot/account/assets', {coin: sym}, keys);
        return ((d.data||[])[0]||{}).available;
      } else if (exc.id === 'gateio') {
        var d = await __NX.gateioFetch('/api/v4/spot/accounts', {currency: sym}, keys);
        return ((d||[])[0]||{}).available;
      }
    } catch(e) {}
    return null;
  }

  // ── Input handler with debounce ──
  function convOnInput() {
    clearTimeout(_convState.debounceTimer);
    _convStopBtnCountdown();
    var btn = document.getElementById('exc-conv-preview-btn');
    __NX.convSetToAmt('…');
    __NX.convSetRate('Getting quote…');
    if (btn) { btn.disabled = true; btn.textContent = 'Getting quote…'; }
    _convState.debounceTimer = setTimeout(convFetchQuote, 600);
  }

  // ── Start countdown on Preview button ──
  function _convStartBtnCountdown(ttl) {
    _convStopBtnCountdown();
    var btn  = document.getElementById('exc-conv-preview-btn');
    var secs = ttl;
    function _upd() {
      if (!btn) return;
      if (secs <= 5) {
        btn.style.background = '#ef4444';
      } else if (secs <= Math.ceil(ttl * 0.4)) {
        btn.style.background = '#f59e0b';
      } else {
        btn.style.background = '';
      }
      btn.textContent = 'Preview  ' + secs + 's';
    }
    _upd();
    _convState.btnTimer = setInterval(function() {
      secs--;
      if (secs <= 0) {
        _convStopBtnCountdown();
        // Quote expired — reset UI and auto re-fetch
        _convState.quoteId = null;
        if (btn) { btn.disabled = true; btn.textContent = 'Preview'; btn.style.background = ''; }
        __NX.convSetToAmt('—');
        __NX.convSetRate('Quote expired — refreshing…');
        convFetchQuote();
        return;
      }
      _upd();
    }, 1000);
  }

  function _convStopBtnCountdown() {
    if (_convState.btnTimer) { clearInterval(_convState.btnTimer); _convState.btnTimer = null; }
    var btn = document.getElementById('exc-conv-preview-btn');
    if (btn) { btn.textContent = 'Preview'; btn.style.background = ''; }
  }

  // ── Fetch quote from exchange ──
  async function convFetchQuote() {
    var amtEl = document.getElementById('exc-conv-from-amt');
    var amt   = parseFloat(amtEl ? amtEl.value : '');
    var btn   = document.getElementById('exc-conv-preview-btn');

    if (!amt || amt <= 0) {
      __NX.convSetToAmt('—');
      __NX.convSetRate('Enter amount to get a quote');
      if (btn) btn.disabled = true;
      return;
    }

    var keys = __NX.getExchangeKey(__NX.state.activeExchange);
    if (!keys) {
      __NX.convSetToAmt('—');
      __NX.convSetRate('API key required');
      if (btn) btn.disabled = true;
      return;
    }

    var fromSym = _convState.fromSym;
    var toSym   = _convState.toSym;

    try {
      var result = await convGetQuote(fromSym, toSym, amt, keys);
      if (result && result.toAmt) {
        _convState.quoteId  = result.quoteId || null;
        _convState.quoteTtl = result.quoteTtl || 30;
        _convState.toAmt    = result.toAmt;
        _convState.fromAmt  = amt;
        __NX.convSetToAmt(convFmtAmt(result.toAmt));
        __NX.convSetRate('1 ' + fromSym + ' ≈ ' + convFmtAmt(result.toAmt / amt) + ' ' + toSym);
        if (btn && keys) {
          btn.disabled = false;
          _convStartBtnCountdown(_convState.quoteTtl);
        }
      } else {
        _convStopBtnCountdown();
        __NX.convSetToAmt('—');
        __NX.convSetRate('Pair not available');
        if (btn) btn.disabled = true;
      }
    } catch(e) {
      _convStopBtnCountdown();
      __NX.convSetToAmt('—');
      __NX.convSetRate('Quote failed — try again');
      if (btn) btn.disabled = true;
    }
  }

  async function convGetQuote(fromSym, toSym, fromAmt, keys) {
    var exc = __NX.activeExc();

    if (exc.id === 'binance') {
      // Binance: quote valid 10 seconds (official docs)
      var d = await __NX.binanceFetch('/sapi/v1/convert/getQuote', {
        fromAsset: fromSym, toAsset: toSym,
        fromAmount: fromAmt.toString(), walletType: 'SPOT'
      }, keys, 'POST');
      if (d && d.toAmount) return { quoteId: d.quoteId, toAmt: parseFloat(d.toAmount), quoteTtl: 10 };
      throw new Error((d && d.msg) || 'Binance quote failed');

    } else if (exc.id === 'kucoin') {
      // KuCoin Convert quote — valid 30 seconds (official docs)
      var d = await __NX.kucoinFetch('/api/v1/convert/quote', {}, keys, 'POST', {
        baseCurrency: fromSym, quoteCurrency: toSym,
        amount: fromAmt.toString(), amount_type: 'base'
      });
      var q = d && d.data;
      if (q && q.quoteGoodsAmount) return { quoteId: q.orderId, toAmt: parseFloat(q.quoteGoodsAmount), quoteTtl: 30 };
      throw new Error((d && d.msg) || (d && d.code ? 'KuCoin: ' + d.code : '') || 'KuCoin quote failed');

    } else if (exc.id === 'bybit') {
      // Bybit Convert: POST /v5/asset/exchange/quote-apply — valid 15 seconds (official docs)
      var requestId = 'one-' + Date.now();
      var d = await __NX.bybitFetch('/v5/asset/exchange/quote-apply', {
        accountType:   'eb_convert_spot',
        requestId:     requestId,
        fromCoin:      fromSym,
        toCoin:        toSym,
        requestCoin:   fromSym,
        requestAmount: fromAmt.toString()
      }, keys, 'POST');
      var r = d && d.result;
      // Bybit returns expiredTime in ms; derive TTL from it
      var bybitTtl = 15;
      if (r && r.expiredTime) {
        var remaining = Math.floor((parseInt(r.expiredTime) - Date.now()) / 1000);
        if (remaining > 0 && remaining <= 60) bybitTtl = remaining;
      }
      if (r && r.toAmount) return { quoteId: r.quoteTxId, toAmt: parseFloat(r.toAmount), quoteTtl: bybitTtl };
      throw new Error((d && d.retMsg) || (d && d.retCode ? 'Bybit: ' + d.retCode : '') || 'Bybit quote failed');

    } else if (exc.id === 'bitget') {
      // Bitget Convert: tradeId valid 30 seconds (official docs)
      var d = await __NX.bitgetFetch('/api/v2/convert/quoted-price', {
        fromCoin: fromSym, toCoin: toSym, fromCoinSize: fromAmt.toString()
      }, keys, 'GET');
      var q = d && d.data;
      if (q && q.toCoinSize) return { quoteId: q.tradeId, toAmt: parseFloat(q.toCoinSize), quoteTtl: 30 };
      throw new Error((d && (d.msg||d.message)) || (d && d.code ? 'Bitget: ' + d.code : '') || 'Bitget quote failed');

    } else if (exc.id === 'gateio') {
      // Gate.io Convert: quote valid 30 seconds (official docs)
      var d = await __NX.gateioFetch('/api/v4/convert/quote', {
        from_currency: fromSym, to_currency: toSym, from_amount: fromAmt.toString()
      }, keys, 'POST');
      // Gate.io returns expire_time as unix timestamp
      var gioTtl = 30;
      if (d && d.expire_time) {
        var remaining = Math.floor(parseInt(d.expire_time) - Date.now() / 1000);
        if (remaining > 0 && remaining <= 60) gioTtl = remaining;
      }
      if (d && d.to_amount) return { quoteId: d.quote_id, toAmt: parseFloat(d.to_amount), quoteTtl: gioTtl };
      throw new Error((d && d.message) || (d && d.label) || 'Gate.io quote failed');

    } else if (exc.id === 'coinbase') {
      throw new Error('Coinbase Convert API not supported');

    } else if (exc.id === 'htx') {
      throw new Error('HTX Convert API not supported');
    }

    throw new Error('Convert not supported for ' + exc.name);
  }

  // ── Execute the convert ──
  async function convExecute(keys) {
    var exc     = __NX.activeExc();
    var fromSym = _convState.fromSym;
    var toSym   = _convState.toSym;
    var fromAmt = _convState.fromAmt;
    var quoteId = _convState.quoteId;

    if (exc.id === 'binance') {
      if (!quoteId) throw new Error('Quote expired — refresh and try again');
      var d = await __NX.binanceFetch('/sapi/v1/convert/acceptQuote', { quoteId: quoteId }, keys, 'POST');
      if (d && (d.orderId || d.orderStatus === 'PROCESS' || d.orderStatus === 'SUCCESS')) return { ok: true, orderId: d.orderId };
      throw new Error((d && d.msg) || JSON.stringify(d) || 'Convert failed');

    } else if (exc.id === 'kucoin') {
      if (!quoteId) throw new Error('Quote expired — refresh and try again');
      var d = await __NX.kucoinFetch('/api/v1/convert/order', {}, keys, 'POST', { orderId: quoteId });
      if (d && d.code === '200000' && d.data) return { ok: true, orderId: d.data.orderId || quoteId };
      throw new Error((d && d.msg) || (d && d.code ? 'KuCoin error: ' + d.code : '') || 'Convert failed');

    } else if (exc.id === 'bybit') {
      if (!quoteId) throw new Error('Quote expired — refresh and try again');
      var d = await __NX.bybitFetch('/v5/asset/exchange/convert-execute', {
        quoteTxId: quoteId
      }, keys, 'POST');
      if (d && d.retCode === 0) return { ok: true, orderId: quoteId };
      throw new Error((d && d.retMsg) || (d && d.retCode ? 'Bybit error: ' + d.retCode : '') || 'Convert failed');

    } else if (exc.id === 'bitget') {
      if (!quoteId) throw new Error('Quote expired — refresh and try again');
      var d = await __NX.bitgetFetch('/api/v2/convert/trade', {
        tradeId: quoteId, fromCoin: fromSym, toCoin: toSym, fromCoinSize: fromAmt.toString()
      }, keys, 'POST');
      if (d && d.code === '00000' && d.data) return { ok: true };
      throw new Error((d && (d.msg||d.message)) || (d && d.code ? 'Bitget error: ' + d.code : '') || 'Convert failed');

    } else if (exc.id === 'gateio') {
      if (!quoteId) throw new Error('Quote expired — refresh and try again');
      var d = await __NX.gateioFetch('/api/v4/convert/trade', null, keys, 'POST', quoteId);
      if (d && d.trade_id) return { ok: true, orderId: d.trade_id };
      throw new Error((d && d.message) || (d && d.label) || 'Convert failed');

    } else {
      throw new Error('Convert not supported for ' + exc.name);
    }
  }

  // ── Helper: format amount smartly ──
  function convFmtAmt(n) {
    if (!n || isNaN(n)) return '—';
    if (n >= 1000)  return n.toLocaleString('en-US', {maximumFractionDigits: 2});
    if (n >= 1)     return n.toFixed(4);
    if (n >= 0.001) return n.toFixed(6);
    return n.toFixed(8);
  }
})((window.__nxp = window.__nxp || {}).mod_exc_spot_engine = window.__nxp.mod_exc_spot_engine || {});
