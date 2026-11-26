// Portfolio assets: fetch, render and load
// Part of the exchange spot engine (window.EXC) module (split by topic; no logic change).
(function (__NX) {
  __NX._portfolioNoKeyHtml = _portfolioNoKeyHtml;
  __NX.fetchPortfolioAssets = fetchPortfolioAssets;
  __NX._renderPortfolioResult = _renderPortfolioResult;
  __NX.loadPortfolio = loadPortfolio;


  // ── Portfolio ──

  function _portfolioNoKeyHtml() {
    return '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 0;gap:10px;"><span class="material-icons-round" style="font-size:40px;color:rgba(255,255,255,0.1);">pie_chart</span><span style="font-size:13px;color:var(--text-muted);font-family:var(--font-mono);">Available Funds: 0.00 USDT</span><span style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">Transfer funds to your Spot wallet to trade</span><span onclick="EXC.openApiSetup()" style="font-size:12px;color:var(--accent-primary);font-family:var(--font-mono);cursor:pointer;text-decoration:underline;margin-top:4px;">Setup API Key →</span></div>';
  }

  function _portfolioEmptyHtml() {
    return '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 0;gap:10px;"><span class="material-icons-round" style="font-size:40px;color:rgba(255,255,255,0.1);">pie_chart</span><span style="font-size:13px;color:var(--text-muted);font-family:var(--font-mono);">Available Funds: 0.00 USDT</span><span style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">Transfer funds to your Spot wallet to trade</span></div>';
  }

  // Fetches balances for ANY exchange (not just the currently active one) so
  // it can be safely used by preloadAllPortfolios() to warm every exchange
  // in parallel. Valuation uses that exchange's own cached market prices
  // (from preloadAllMarkets) rather than the globally active state.markets.
  async function fetchPortfolioAssets(exc, keys) {
    var assets = [];
    // Per sub-account (Funding/Spot/Futures) balance breakdown — only
    // populated for exchanges where the balance call already tells us
    // which account each entry belongs to. Stays null everywhere else.
    var byAccount = null;
    if (exc.id === 'binance' || exc.id === 'mexc') {
      var fn = exc.id === 'binance' ? __NX.binanceFetch : __NX.mexcFetch;
      var data = await fn('/api/v3/account', {}, keys, 'GET', exc);
      assets = (data.balances||[]).filter(function(b) { return parseFloat(b.free)+parseFloat(b.locked) > 0; }).map(function(b) {
        return {asset:b.asset, free:parseFloat(b.free), locked:parseFloat(b.locked)};
      });
    } else if (exc.id === 'kucoin') {
      var data = await __NX.kucoinFetch('/api/v1/accounts', null, keys, 'GET', null, exc);
      var rawList = data.data || [];
      assets = rawList.filter(function(b) { return parseFloat(b.available)+parseFloat(b.holds) > 0; }).map(function(b) {
        return {asset:b.currency, free:parseFloat(b.available), locked:parseFloat(b.holds)};
      });
      byAccount = {};
      rawList.forEach(function(b) {
        var free = parseFloat(b.available)||0, locked = parseFloat(b.holds)||0;
        if (free + locked <= 0) return;
        var t = b.type || 'main';
        if (!byAccount[t]) byAccount[t] = [];
        byAccount[t].push({asset:b.currency, free:free, locked:locked});
      });
    } else if (exc.id === 'bybit') {
      var data = await __NX.bybitFetch('/v5/account/wallet-balance', {accountType:'UNIFIED'}, keys, 'GET', exc);
      var list = ((data.result||{}).list||[{}])[0];
      assets = ((list||{}).coin||[]).filter(function(c) { return parseFloat(c.walletBalance) > 0; }).map(function(c) {
        return {asset:c.coin, free:parseFloat(c.availableToWithdraw), locked:parseFloat(c.walletBalance)-parseFloat(c.availableToWithdraw), usdtVal:parseFloat(c.usdValue)};
      });
    } else if (exc.id === 'bitmart') {
      var data = await __NX.bitmartFetch(exc.endpoints.balance, {}, keys, 'GET', exc);
      assets = (((data.data)||{}).wallet||[]).filter(function(b) { return parseFloat(b.available)+parseFloat(b.frozen) > 0; }).map(function(b) {
        // /account/v1/wallet returns "currency", not "id" — the latter was
        // a field name from the older /spot/v1/wallet endpoint. Reading
        // b.id here always evaluated to undefined, so every asset row
        // showed a blank/undefined symbol instead of its real currency.
        return {asset:b.currency, free:parseFloat(b.available), locked:parseFloat(b.frozen)};
      });
    } else if (exc.id === 'bitget') {
      var data = await __NX.bitgetFetch(exc.endpoints.balance, {}, keys, 'GET', exc);
      assets = ((data.data)||[]).filter(function(b) { return parseFloat(b.available)+parseFloat(b.frozen||0) > 0; }).map(function(b) {
        return {asset:b.coin, free:parseFloat(b.available), locked:parseFloat(b.frozen||0)+parseFloat(b.locked||0)};
      });
    } else if (exc.id === 'kraken') {
      // /Balance only returns one total figure per asset (no hold/locked
      // breakdown). /BalanceEx returns the same totals plus hold_trade —
      // the amount actually tied up in open orders — letting Free/Locked
      // be shown correctly instead of always reporting everything as Free.
      var data = await __NX.krakenFetch('/0/private/BalanceEx', {}, keys);
      assets = Object.keys(data.result||{}).filter(function(code) { return parseFloat((data.result||{})[code].balance||0) > 0; }).map(function(code) {
        var asset = code;
        if (code === 'XXBT') asset = 'BTC';
        else if (/^X.{3,}/.test(code)) asset = code.slice(1);
        else if (/^Z.{3}$/.test(code)) asset = code.slice(1);
        var entry = (data.result||{})[code] || {};
        var total = parseFloat(entry.balance||0);
        var locked = parseFloat(entry.hold_trade||0);
        return {asset:asset, free:Math.max(0,total-locked), locked:locked};
      });
    } else if (exc.id === 'gateio') {
      var data = await __NX.gateioFetch(exc.endpoints.balance, {}, keys, 'GET', exc);
      assets = (data||[]).filter(function(b) { return parseFloat(b.available)+parseFloat(b.locked) > 0; }).map(function(b) {
        return {asset:b.currency, free:parseFloat(b.available), locked:parseFloat(b.locked)};
      });
    } else if (exc.id === 'coinbase') {
      var data = await __NX.coinbaseFetch(exc.endpoints.balance, {}, keys, 'GET', null, exc);
      assets = (data||[]).filter(function(b) { return parseFloat(b.available)+parseFloat(b.hold) > 0; }).map(function(b) {
        return {asset:b.currency, free:parseFloat(b.available), locked:parseFloat(b.hold)};
      });
    } else if (exc.id === 'bingx') {
      var data = await __NX.bingxFetch(exc.endpoints.balance, {}, keys, 'GET', exc);
      assets = (((data.data)||{}).balances||[]).filter(function(b) { return parseFloat(b.free)+parseFloat(b.locked) > 0; }).map(function(b) {
        return {asset:b.asset, free:parseFloat(b.free), locked:parseFloat(b.locked)};
      });
    } else if (exc.id === 'htx') {
      var htxAccData = await __NX.htxFetch(exc.endpoints.balance, {}, keys);
      var htxAcc = ((htxAccData.data)||[]).find(function(a) { return a.type === 'spot'; });
      if (htxAcc) {
        var data = await __NX.htxFetch('/v1/account/accounts/' + htxAcc.id + '/balance', {}, keys);
        var byAsset = {};
        (((data.data)||{}).list||[]).forEach(function(b) {
          var key = (b.currency||'').toUpperCase();
          if (!byAsset[key]) byAsset[key] = {asset:key, free:0, locked:0};
          if (b.type === 'trade') byAsset[key].free += parseFloat(b.balance) || 0;
          else if (b.type === 'frozen') byAsset[key].locked += parseFloat(b.balance) || 0;
        });
        assets = Object.values(byAsset).filter(function(a) { return a.free + a.locked > 0; });
      }
    } else if (exc.id === 'phemex') {
      var data = await __NX.phemexFetch(exc.endpoints.balance, {}, keys, 'GET', exc);
      assets = ((data.data)||[]).filter(function(b) { return parseFloat(b.balanceEv) > 0; }).map(function(b) {
        // Two distinct lock reasons exist (trading + pending withdrawal) —
        // only counting lockedTradingBalanceEv understated what's actually
        // locked, overstating "free" by whatever was tied up in a pending
        // withdrawal.
        var locked = (parseFloat(b.lockedTradingBalanceEv||0) + parseFloat(b.lockedWithdrawEv||0))/__NX.PHEMEX_SCALE;
        var total = parseFloat(b.balanceEv)/__NX.PHEMEX_SCALE;
        return {asset:b.currency, free:total-locked, locked:locked};
      });
    } else if (exc.id === 'digifinex') {
      var data = await __NX.digifinexFetch(exc.endpoints.balance, {}, keys, 'GET', exc);
      assets = ((data.list)||[]).filter(function(b) { return parseFloat(b.total) > 0; }).map(function(b) {
        return {asset:(b.currency||'').toUpperCase(), free:parseFloat(b.free), locked:parseFloat(b.frozen)};
      });
    } else if (exc.id === 'lbank') {
      var data = await __NX.lbankFetch(exc.endpoints.balance, {}, keys);
      assets = ((data.data)||[]).filter(function(b) { return parseFloat(b.usableAmt)+parseFloat(b.freezeAmt||0) > 0; }).map(function(b) {
        return {asset:(b.coin||'').toUpperCase(), free:parseFloat(b.usableAmt), locked:parseFloat(b.freezeAmt||0)};
      });
    } else if (exc.id === 'bitfinex') {
      var data = await __NX.bitfinexFetch(exc.endpoints.balance, {}, keys);
      assets = (data||[]).filter(function(r) { return r[0] === 'exchange' && parseFloat(r[2]) > 0; }).map(function(r) {
        var asset = r[1] === 'UST' ? 'USDT' : r[1];
        var bal = parseFloat(r[2]) || 0;
        var avail = parseFloat(r[4]) || bal;
        return {asset:asset, free:avail, locked:bal-avail};
      });
    }
    // Estimate USDT values — prefer this exchange's own cached market list
    // (populated by preloadAllMarkets) so this works correctly even when
    // pricing an exchange that isn't the currently active one.
    var marketList = (exc.id === __NX.state.activeExchange && __NX.state.markets.length) ? __NX.state.markets : (__NX._marketsCache[exc.id] || []);
    var total = 0;
    assets.forEach(function(a) {
      if (a.usdtVal) { total += a.usdtVal; return; }
      if (a.asset === 'USDT') { a.usdtVal = a.free + a.locked; total += a.usdtVal; return; }
      var mkt = marketList.find(function(m) { return m.symbol === a.asset+'USDT'; });
      a.usdtVal = mkt ? (a.free + a.locked) * mkt.price : 0;
      total += a.usdtVal;
    });
    assets.sort(function(a,b) { return b.usdtVal - a.usdtVal; });
    return { assets: assets, total: total, byAccount: byAccount };
  }

  function _renderPortfolioResult(listId, totalId, result) {
    var el = document.getElementById(listId);
    var totalEl = document.getElementById(totalId);
    var assets = result.assets, total = result.total;

    if (listId === 'exc-trade-port-list') {
      var hc2 = document.getElementById('exc-trade-hold-count');
      if (hc2) hc2.textContent = assets.length;
      // trade-tab uses old compact style
      if (totalEl) totalEl.textContent = '$' + total.toFixed(2);
      if (!el) return;
      if (!assets.length) { el.innerHTML = _portfolioEmptyHtml(); return; }
      el.innerHTML = assets.map(function(a) {
        var pct = total > 0 ? (a.usdtVal / total * 100) : 0;
        return '<div style="display:flex;align-items:center;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.05);">' +
          '<div style="width:36px;height:36px;border-radius:50%;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-right:12px;">' +
            '<span style="font-size:9px;font-weight:800;color:var(--accent-primary);font-family:var(--font-mono);">'+a.asset.slice(0,3)+'</span>' +
          '</div>' +
          '<div style="flex:1;">' +
            '<div style="font-size:13px;font-weight:700;color:var(--text-primary);font-family:var(--font-mono);">'+a.asset+'</div>' +
            '<div style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);">'+a.free.toFixed(6)+'</div>' +
          '</div>' +
          '<div style="text-align:right;">' +
            '<div style="font-size:13px;font-weight:700;color:var(--text-primary);font-family:var(--font-mono);">$'+(a.usdtVal||0).toFixed(2)+'</div>' +
            '<div style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);">'+pct.toFixed(1)+'%</div>' +
          '</div>' +
        '</div>';
      }).join('');
      return;
    }

    // ── Main portfolio tab — KuCoin style ──
    // Total + USD
    if (totalEl) totalEl.textContent = total.toFixed(2);
    var usdEl = document.getElementById('exc-port-usd');
    if (usdEl) usdEl.textContent = '≈ $' + total.toFixed(2);

    // PNL row
    var pnlEl = document.getElementById('exc-port-pnl');
    if (pnlEl) {
      if (result.pnl != null) {
        var pnlSign = result.pnl >= 0 ? '+' : '';
        var pnlColor = result.pnl >= 0 ? '#0ecb81' : '#f6465d';
        pnlEl.innerHTML = 'PNL <span style="color:' + pnlColor + ';font-weight:700;">' + pnlSign + '$' + Math.abs(result.pnl).toFixed(2) + ' (1D)</span>';
      } else {
        pnlEl.textContent = 'PNL —';
      }
    }

    // Sparkline — simple upward line from 80% of total to total
    var spark = document.getElementById('exc-port-spark-line');
    if (spark && total > 0) {
      var pts = [];
      var steps = 8;
      for (var i = 0; i <= steps; i++) {
        var x = Math.round(i * 90 / steps);
        var ratio = 0.75 + (i / steps) * 0.25 + (Math.sin(i * 1.2) * 0.03);
        var y = Math.round(42 - ratio * 36);
        pts.push(x + ',' + y);
      }
      spark.setAttribute('points', pts.join(' '));
    }

    if (!el) return;
    if (!assets.length) { el.innerHTML = _portfolioEmptyHtml(); return; }

    var exc = __NX.activeExc();
    var marketList = (exc.id === __NX.state.activeExchange && __NX.state.markets.length) ? __NX.state.markets : (__NX._marketsCache[exc.id] || []);

    el.innerHTML = assets.map(function(a) {
      var pct     = total > 0 ? (a.usdtVal / total * 100) : 0;
      var bal     = (a.free || 0) + (a.locked || 0);
      // Price + 24h change from market list
      var mkt     = marketList.find(function(m) { return m.symbol === a.asset + 'USDT'; });
      var price   = mkt ? mkt.price : (a.asset === 'USDT' ? 1 : null);
      var chg24   = mkt ? mkt.priceChangePercent : null;
      var chgColor = (chg24 != null) ? (parseFloat(chg24) >= 0 ? '#0ecb81' : '#f6465d') : 'var(--text-muted)';
      var chgStr  = (chg24 != null) ? ((parseFloat(chg24) >= 0 ? '+' : '') + parseFloat(chg24).toFixed(2) + '%') : '';

      // Token logo
      var logoUrl = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/';
      var knownAddr = { USDT:'0xdAC17F958D2ee523a2206206994597C13D831ec7', BTC:'', ETH:'0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', BNB:'0xB8c77482e45F1F44dE1745F52C74426C631bDD52', SOL:'', USDC:'0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' };
      var logoHtml;
      if (knownAddr[a.asset]) {
        logoHtml = '<img src="https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/' + knownAddr[a.asset] + '/logo.png" style="width:36px;height:36px;border-radius:50%;" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">' +
          '<div style="display:none;width:36px;height:36px;border-radius:50%;background:' + __NX.convTokenColor(a.asset) + ';align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;font-family:var(--font-mono);">' + a.asset[0] + '</div>';
      } else {
        logoHtml = '<div style="display:flex;width:36px;height:36px;border-radius:50%;background:' + __NX.convTokenColor(a.asset) + ';align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;font-family:var(--font-mono);">' + a.asset[0] + '</div>';
      }

      return '<div style="display:flex;align-items:center;padding:13px 0;border-bottom:1px solid rgba(255,255,255,0.05);">' +
        // Logo
        '<div style="position:relative;flex-shrink:0;margin-right:12px;display:flex;">' + logoHtml + '</div>' +
        // Name + allocation %
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:14px;font-weight:700;color:var(--text-primary);font-family:var(--font-mono);">' + a.asset + '</div>' +
          '<div style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);margin-top:1px;">' + pct.toFixed(2) + '%</div>' +
          (price != null && a.asset !== 'USDT'
            ? '<div style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);margin-top:1px;">Last Price  ' +
              '<span style="color:' + chgColor + ';">' +
                parseFloat(price).toLocaleString('en-US', {maximumFractionDigits:6}) +
                (chgStr ? '  ' + chgStr : '') +
              '</span></div>'
            : '') +
        '</div>' +
        // Balance + USD value
        '<div style="text-align:right;flex-shrink:0;">' +
          '<div style="font-size:13px;font-weight:700;color:var(--text-primary);font-family:var(--font-mono);">' +
            (bal >= 0.00000001 ? bal.toFixed(bal < 0.001 ? 8 : bal < 1 ? 6 : 4) : '<0.00000001') +
          '</div>' +
          '<div style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);margin-top:1px;">$' + (a.usdtVal||0).toFixed(2) + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  async function loadPortfolio(listId, totalId) {
    listId = listId || 'exc-port-list';
    totalId = totalId || 'exc-port-total';
    var exc = __NX.activeExc();
    var keys = __NX.getExchangeKey(exc.id);
    if (!keys) {
      var elNoKey = document.getElementById(listId);
      if (elNoKey) elNoKey.innerHTML = _portfolioNoKeyHtml();
      var totalElNoKey = document.getElementById(totalId);
      if (totalElNoKey) totalElNoKey.textContent = '$0.00';
      if (listId === 'exc-trade-port-list') {
        var hc = document.getElementById('exc-trade-hold-count');
        if (hc) hc.textContent = '0';
      }
      return;
    }

    // Instant path: cache hit → show immediately, no background refresh.
    // Cache is invalidated on exchange switch via _clearExchangeCache().
    if (__NX._portfolioCache[exc.id]) {
      _renderPortfolioResult(listId, totalId, __NX._portfolioCache[exc.id]);
      return;
    }

    // Fallback path: not preloaded yet — show a spinner and wait on the
    // network like before.
    var el = document.getElementById(listId);
    if (el) el.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;padding:40px 0;gap:10px;"><div class="exc-spinner"></div><span style="font-size:13px;color:var(--text-muted);font-family:var(--font-mono);">Loading portfolio…</span></div>';
    try {
      var result = await fetchPortfolioAssets(exc, keys);
      __NX._portfolioCache[exc.id] = result;
      // If the user switched to a different exchange while this request was
      // still in flight, don't paint this (now stale) exchange's balance
      // over whatever the currently-selected exchange's panel should show —
      // that's exactly what was causing the previous exchange's holdings to
      // briefly (or persistently, on slow networks) show up after switching.
      if (__NX.state.activeExchange === exc.id) _renderPortfolioResult(listId, totalId, result);
    } catch(e) {
      if (__NX.state.activeExchange === exc.id && el) el.innerHTML = '<div style="text-align:center;padding:40px 0;font-size:13px;color:#f87171;font-family:var(--font-mono);">Error loading portfolio</div>';
    }
  }
})((window.__nxp = window.__nxp || {}).mod_exc_spot_engine = window.__nxp.mod_exc_spot_engine || {});
