// Portfolio account tabs, balances, preload and engine init
// Part of the exchange spot engine (window.EXC) module (split by topic; no logic change).
(function (__NX) {
  __NX.renderPortTabs = renderPortTabs;
  __NX.switchPortTab = switchPortTab;
  __NX.preloadAllPortfolios = preloadAllPortfolios;
  __NX.switchTradeTab = switchTradeTab;
  __NX.filterMarkets = filterMarkets;
  __NX.setQuote = setQuote;
  __NX.sortMarkets = sortMarkets;
  __NX.showExcToast = showExcToast;
  __NX.init = init;


  // ─────────────────────────────────────────────────
  //  PORTFOLIO SUB-TABS — dynamic per exchange
  //  (Overview always shown; Funding/Spot/Futures/Margin/etc.
  //  built from EXC_PORT_CFG for whichever exchange is active)
  // ─────────────────────────────────────────────────
  var _portAcctCache = {};   // keyed `${excId}:${acctId}` → {assets,total}
  var _portActiveAcctId = null;

  function renderPortTabs(excId) {
    var bar = document.getElementById('exc-port-tabs');
    if (!bar) return;
    var cfg = (window._getPortCfg ? window._getPortCfg(excId) : [{id:'spot', label:'Spot', type:'spot'}]);
    var html = '<div class="exc-port-tab exc-port-tab-active" id="exc-ptab-overview" onclick="excPortSwitchTab(\'overview\')">Overview</div>';
    cfg.forEach(function(a) {
      html += '<div class="exc-port-tab" id="exc-ptab-' + a.id + '" onclick="excPortSwitchTab(\'' + a.id + '\')">' + a.label + '</div>';
    });
    bar.innerHTML = html;
  }

  function switchPortTab(tabId) {
    var excId = __NX.state.activeExchange;
    var cfg = (window._getPortCfg ? window._getPortCfg(excId) : [{id:'spot', label:'Spot', type:'spot'}]);
    var isOverview = (tabId === 'overview');
    var acctCfg = isOverview ? null : cfg.find(function(a) { return a.id === tabId; });

    // Highlight active tab button
    var allBtns = document.querySelectorAll('#exc-port-tabs .exc-port-tab');
    allBtns.forEach(function(btn) {
      btn.classList.toggle('exc-port-tab-active', btn.id === 'exc-ptab-' + tabId);
    });

    var overviewPanel = document.getElementById('exc-port-sub-overview');
    var acctPanel = document.getElementById('exc-port-sub-account');

    if (isOverview) {
      if (overviewPanel) overviewPanel.style.display = 'flex';
      if (acctPanel) acctPanel.style.display = 'none';
      return;
    }

    if (overviewPanel) overviewPanel.style.display = 'none';
    if (acctPanel) { acctPanel.style.display = 'flex'; acctPanel.style.flexDirection = 'column'; }
    if (!acctCfg) return; // unknown tab id, nothing to populate

    _portActiveAcctId = acctCfg.id;
    var labelEl = document.getElementById('exc-acct-label');
    var listLabelEl = document.getElementById('exc-acct-list-label');
    if (labelEl) labelEl.textContent = acctCfg.label + ' Account';
    if (listLabelEl) listLabelEl.textContent = (acctCfg.type === 'futures' || acctCfg.type === 'unified') ? 'ASSETS' : 'ASSETS';

    loadPortAccountBalance(excId, acctCfg);
  }

  function _renderAcctEmptyHtml(label) {
    return '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:50px 0;gap:12px;">' +
      '<span class="material-icons-round" style="font-size:42px;color:rgba(255,255,255,0.1);">account_balance</span>' +
      '<span style="font-size:12px;color:var(--text-muted);font-family:var(--font-mono);">No balance in ' + label + '</span></div>';
  }

  function _renderAcctListHtml(assets, total) {
    if (!assets.length) return _renderAcctEmptyHtml('this account');
    return assets.map(function(a) {
      var pct = total > 0 ? (a.usdtVal / total * 100) : 0;
      return '<div style="display:flex;align-items:center;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.05);">' +
        '<div style="width:36px;height:36px;border-radius:50%;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-right:12px;">' +
          '<span style="font-size:9px;font-weight:800;color:var(--accent-primary);font-family:var(--font-mono);">' + a.asset.slice(0,3) + '</span>' +
        '</div>' +
        '<div style="flex:1;">' +
          '<div style="font-size:13px;font-weight:700;color:var(--text-primary);font-family:var(--font-mono);">' + a.asset + '</div>' +
          '<div style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);">' + a.free.toFixed(6) + '</div>' +
        '</div>' +
        '<div style="text-align:right;">' +
          '<div style="font-size:13px;font-weight:700;color:var(--text-primary);font-family:var(--font-mono);">$' + (a.usdtVal||0).toFixed(2) + '</div>' +
          '<div style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);">' + pct.toFixed(1) + '%</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  // Values a raw {asset, free, locked} list against this exchange's cached
  // market prices — same approach as fetchPortfolioAssets() so $ totals
  // are consistent between Overview and the per-account sub-tabs.
  function _valueAssets(exc, assets) {
    var marketList = (exc.id === __NX.state.activeExchange && __NX.state.markets.length) ? __NX.state.markets : (__NX._marketsCache[exc.id] || []);
    var total = 0;
    assets.forEach(function(a) {
      if (a.usdtVal != null) { total += a.usdtVal; return; }
      if (a.asset === 'USDT') { a.usdtVal = a.free + a.locked; total += a.usdtVal; return; }
      var mkt = marketList.find(function(m) { return m.symbol === a.asset + 'USDT'; });
      a.usdtVal = mkt ? (a.free + a.locked) * mkt.price : 0;
      total += a.usdtVal;
    });
    assets.sort(function(a,b) { return b.usdtVal - a.usdtVal; });
    return total;
  }

  // Fetches the balance for ONE account-type (Funding/Spot/Margin/Unified/
  // Trading) on the given exchange. Futures delegates to the FUT module's
  // existing per-exchange futures-balance logic instead of duplicating it
  // here — FUT already covers all 17 exchanges' derivatives balance.
  async function _fetchAccountBalance(exc, keys, acctCfg) {
    var assets = [];

    if (acctCfg.type === 'futures') {
      // Delegate to FUT (separate module, already has all 17 exchanges'
      // futures balance logic wired and HMAC-signed).
      if (window.FUT && typeof FUT.loadFutBalance === 'function') {
        await FUT.loadFutBalance();
        var bal = window._excUsdtBalanceCache || 0;
        if (bal > 0) assets = [{ asset:'USDT', free:bal, locked:0, usdtVal:bal }];
      }
      return assets;
    }

    if (exc.id === 'binance') {
      if (acctCfg.type === 'funding') {
        var data = await __NX.binanceFetch('/sapi/v1/asset/get-funding-asset', {}, keys, 'POST', exc);
        assets = (Array.isArray(data) ? data : []).filter(function(b) { return parseFloat(b.free)+parseFloat(b.locked||0)+parseFloat(b.freeze||0) > 0; }).map(function(b) {
          return { asset:b.asset, free:parseFloat(b.free), locked:parseFloat(b.locked||0)+parseFloat(b.freeze||0) };
        });
      } else if (acctCfg.type === 'margin') {
        // Cross-margin account: /sapi/v1/margin/account → userAssets array
        var data = await __NX.binanceFetch('/sapi/v1/margin/account', {}, keys, 'GET', exc);
        assets = ((data.userAssets)||[]).filter(function(b) {
          return parseFloat(b.netAsset) > 0;
        }).map(function(b) {
          return { asset:b.asset, free:parseFloat(b.free), locked:parseFloat(b.locked)+parseFloat(b.interest||0) };
        });
      } else if (acctCfg.type === 'coinm') {
        // COIN-M Futures account: /dapi/v1/account → assets array (coin-denominated)
        var data = await __NX.binanceFetch('/dapi/v1/account', {}, keys, 'GET', exc);
        assets = ((data.assets)||[]).filter(function(b) {
          return parseFloat(b.walletBalance) > 0;
        }).map(function(b) {
          return { asset:b.asset, free:parseFloat(b.availableBalance), locked:parseFloat(b.walletBalance)-parseFloat(b.availableBalance) };
        });
      } else { // spot
        var data = await __NX.binanceFetch('/api/v3/account', {}, keys, 'GET', exc);
        assets = (data.balances||[]).filter(function(b) { return parseFloat(b.free)+parseFloat(b.locked) > 0; }).map(function(b) {
          return { asset:b.asset, free:parseFloat(b.free), locked:parseFloat(b.locked) };
        });
      }
    } else if (exc.id === 'kucoin') {
      // KuCoin /api/v1/accounts accepts type: main|trade|margin
      var acctType = (acctCfg.type === 'funding') ? 'main' : (acctCfg.type === 'margin') ? 'margin' : 'trade';
      var data = await __NX.kucoinFetch('/api/v1/accounts', { type:acctType }, keys, 'GET', null, exc);
      assets = (data.data||[]).filter(function(b) { return parseFloat(b.balance) > 0; }).map(function(b) {
        return { asset:b.currency, free:parseFloat(b.available), locked:parseFloat(b.holds) };
      });
    } else if (exc.id === 'mexc') {
      var data = await __NX.mexcFetch('/api/v3/account', {}, keys, 'GET', exc);
      assets = (data.balances||[]).filter(function(b) { return parseFloat(b.free)+parseFloat(b.locked) > 0; }).map(function(b) {
        return { asset:b.asset, free:parseFloat(b.free), locked:parseFloat(b.locked) };
      });
    } else if (exc.id === 'bybit') {
      if (acctCfg.type === 'funding') {
        var data = await __NX.bybitFetch('/v5/asset/transfer/query-account-coins-balance', { accountType:'FUND' }, keys, 'GET', exc);
        assets = ((data.result||{}).balance||[]).filter(function(b) { return parseFloat(b.walletBalance) > 0; }).map(function(b) {
          return { asset:b.coin, free:parseFloat(b.transferBalance||b.walletBalance), locked:Math.max(0, parseFloat(b.walletBalance)-parseFloat(b.transferBalance||b.walletBalance)) };
        });
      } else { // unified
        var data = await __NX.bybitFetch('/v5/account/wallet-balance', { accountType:'UNIFIED' }, keys, 'GET', exc);
        var list = ((data.result||{}).list||[{}])[0];
        assets = ((list||{}).coin||[]).filter(function(c) { return parseFloat(c.walletBalance) > 0; }).map(function(c) {
          return { asset:c.coin, free:parseFloat(c.availableToWithdraw||0), locked:parseFloat(c.walletBalance)-parseFloat(c.availableToWithdraw||0), usdtVal:parseFloat(c.usdValue||0) };
        });
      }
    } else if (exc.id === 'bitget') {
      if (acctCfg.type === 'funding') {
        var data = await __NX.bitgetFetch('/api/v2/account/funding-assets', {}, keys, 'GET', exc);
        assets = (data.data||[]).filter(function(b) { return parseFloat(b.available)+parseFloat(b.frozen||0) > 0; }).map(function(b) {
          return { asset:b.coin, free:parseFloat(b.available), locked:parseFloat(b.frozen||0) };
        });
      } else if (acctCfg.type === 'coinm') {
        // COIN-M Futures: productType=COIN-FUTURES → asset list from /api/v2/mix/account/accounts
        var data = await __NX.bitgetFetch('/api/v2/mix/account/accounts', { productType:'COIN-FUTURES' }, keys, 'GET', exc);
        assets = (data.data||[]).filter(function(b) { return parseFloat(b.available)+parseFloat(b.locked||0) > 0; }).map(function(b) {
          return { asset:b.marginCoin, free:parseFloat(b.available), locked:parseFloat(b.locked||0)+parseFloat(b.crossedUnrealizedPL||0) };
        });
      } else if (acctCfg.type === 'usdcm') {
        // USDC-M Futures: productType=USDC-FUTURES
        var data = await __NX.bitgetFetch('/api/v2/mix/account/accounts', { productType:'USDC-FUTURES' }, keys, 'GET', exc);
        assets = (data.data||[]).filter(function(b) { return parseFloat(b.available)+parseFloat(b.locked||0) > 0; }).map(function(b) {
          return { asset:b.marginCoin, free:parseFloat(b.available), locked:parseFloat(b.locked||0)+parseFloat(b.crossedUnrealizedPL||0) };
        });
      } else { // spot
        var data = await __NX.bitgetFetch(__NX.activeExc().endpoints.balance, {}, keys, 'GET', exc);
        assets = ((data.data)||[]).filter(function(b) { return parseFloat(b.available)+parseFloat(b.frozen||0) > 0; }).map(function(b) {
          return { asset:b.coin, free:parseFloat(b.available), locked:parseFloat(b.frozen||0)+parseFloat(b.locked||0) };
        });
      }
    } else if (exc.id === 'bingx') {
      if (acctCfg.type === 'funding') {
        // NOTE: /api/v3/fund/balance does not exist. As of BingX's May 2025
        // account-system upgrade, /openApi/spot/v1/account/balance now
        // returns Spot-only (Fund Account was split out). The Fund Account
        // is queryable via /openApi/account/v1/allAccountBalance, but that
        // endpoint returns a USDT-valued overview per account type, not a
        // confirmed per-coin asset breakdown — wiring it without a
        // verified response shape risks showing silently wrong numbers,
        // so this is left as a clear "unavailable" state instead.
        throw new Error('BingX funding balance view not yet available');
      } else { // spot
        var data = await __NX.bingxFetch(exc.endpoints.balance, {}, keys, 'GET', exc);
        assets = (((data.data)||{}).balances||[]).filter(function(b) { return parseFloat(b.free)+parseFloat(b.locked) > 0; }).map(function(b) {
          return { asset:b.asset, free:parseFloat(b.free), locked:parseFloat(b.locked) };
        });
      }
    } else if (exc.id === 'gateio') {
      var data = await __NX.gateioFetch(exc.endpoints.balance, {}, keys, 'GET', exc);
      assets = (data||[]).filter(function(b) { return parseFloat(b.available)+parseFloat(b.locked) > 0; }).map(function(b) {
        return { asset:b.currency, free:parseFloat(b.available), locked:parseFloat(b.locked) };
      });
    } else if (exc.id === 'htx') {
      var htxAccData = await __NX.htxFetch(exc.endpoints.balance, {}, keys);
      var htxAcc = ((htxAccData.data)||[]).find(function(a) { return a.type === 'spot'; });
      if (htxAcc) {
        var data = await __NX.htxFetch('/v1/account/accounts/' + htxAcc.id + '/balance', {}, keys);
        var byAsset = {};
        (((data.data)||{}).list||[]).forEach(function(b) {
          var key = (b.currency||'').toUpperCase();
          if (!byAsset[key]) byAsset[key] = { asset:key, free:0, locked:0 };
          if (b.type === 'trade') byAsset[key].free += parseFloat(b.balance) || 0;
          else if (b.type === 'frozen') byAsset[key].locked += parseFloat(b.balance) || 0;
        });
        assets = Object.values(byAsset).filter(function(a) { return a.free + a.locked > 0; });
      }
    } else if (exc.id === 'phemex') {
      var data = await __NX.phemexFetch(exc.endpoints.balance, {}, keys, 'GET', exc);
      assets = ((data.data)||[]).filter(function(b) { return parseFloat(b.balanceEv) > 0; }).map(function(b) {
        var locked = (parseFloat(b.lockedTradingBalanceEv||0) + parseFloat(b.lockedWithdrawEv||0))/__NX.PHEMEX_SCALE;
        var total2 = parseFloat(b.balanceEv)/__NX.PHEMEX_SCALE;
        return { asset:b.currency, free:total2-locked, locked:locked };
      });
    } else if (exc.id === 'digifinex') {
      if (acctCfg.type === 'margin') {
        // DigiFinex exposes the same {market}/assets shape for both spot
        // and margin — only spot was ever wired. Margin: /v3/margin/assets
        var data = await __NX.digifinexFetch('/v3/margin/assets', {}, keys, 'GET', exc);
        assets = ((data.list)||[]).filter(function(b) { return parseFloat(b.total) > 0; }).map(function(b) {
          var tot = parseFloat(b.total) || 0;
          var free = parseFloat(b.free) || 0;
          return { asset:(b.currency||'').toUpperCase(), free:free, locked:Math.max(0, tot-free) };
        });
        return assets;
      }
      var data = await __NX.digifinexFetch(exc.endpoints.balance, {}, keys, 'GET', exc);
      assets = ((data.list)||[]).filter(function(b) { return parseFloat(b.total) > 0; }).map(function(b) {
        return { asset:(b.currency||'').toUpperCase(), free:parseFloat(b.free), locked:parseFloat(b.frozen) };
      });
    } else if (exc.id === 'lbank') {
      var data = await __NX.lbankFetch(exc.endpoints.balance, {}, keys);
      assets = ((data.data)||[]).filter(function(b) { return parseFloat(b.usableAmt)+parseFloat(b.freezeAmt||0) > 0; }).map(function(b) {
        return { asset:(b.coin||'').toUpperCase(), free:parseFloat(b.usableAmt), locked:parseFloat(b.freezeAmt||0) };
      });
    } else if (exc.id === 'bitfinex') {
      var data = await __NX.bitfinexFetch(exc.endpoints.balance, {}, keys);
      var walletType = (acctCfg.type === 'funding') ? 'funding' : (acctCfg.type === 'margin' ? 'margin' : 'exchange');
      assets = (data||[]).filter(function(r) { return r[0] === walletType && parseFloat(r[2]) > 0; }).map(function(r) {
        var asset = r[1] === 'UST' ? 'USDT' : r[1];
        var bal2 = parseFloat(r[2]) || 0;
        var avail = parseFloat(r[4]) || bal2;
        return { asset:asset, free:avail, locked:bal2-avail };
      });
    } else if (exc.id === 'kraken') {
      var data = await __NX.krakenFetch('/0/private/BalanceEx', {}, keys);
      assets = Object.keys(data.result||{}).filter(function(code) { return parseFloat((data.result||{})[code].balance||0) > 0; }).map(function(code) {
        var asset = code;
        if (code === 'XXBT') asset = 'BTC';
        else if (/^X.{3,}/.test(code)) asset = code.slice(1);
        else if (/^Z.{3}$/.test(code)) asset = code.slice(1);
        var entry = (data.result||{})[code] || {};
        var total = parseFloat(entry.balance||0);
        var locked = parseFloat(entry.hold_trade||0);
        return { asset:asset, free:Math.max(0,total-locked), locked:locked };
      });
    } else if (exc.id === 'bitmart') {
      var data = await __NX.bitmartFetch(exc.endpoints.balance, {}, keys, 'GET', exc);
      assets = (((data.data)||{}).wallet||[]).filter(function(b) { return parseFloat(b.available)+parseFloat(b.frozen) > 0; }).map(function(b) {
        return { asset:b.currency, free:parseFloat(b.available), locked:parseFloat(b.frozen) };
      });
    } else if (exc.id === 'coinbase') {
      var data = await __NX.coinbaseFetch(exc.endpoints.balance, {}, keys, 'GET', null, exc);
      assets = (data||[]).filter(function(b) { return parseFloat(b.available)+parseFloat(b.hold) > 0; }).map(function(b) {
        return { asset:b.currency, free:parseFloat(b.available), locked:parseFloat(b.hold) };
      });
    }

    return assets;
  }

  async function loadPortAccountBalance(excId, acctCfg) {
    var exc = __NX.activeExc();
    var keys = __NX.getExchangeKey(excId);
    var listEl = document.getElementById('exc-acct-list');
    var totalEl = document.getElementById('exc-acct-total');
    var usdEl = document.getElementById('exc-acct-usd');
    var cacheKey = excId + ':' + acctCfg.id;

    if (!keys) {
      if (listEl) listEl.innerHTML = __NX._portfolioNoKeyHtml();
      if (totalEl) totalEl.textContent = '0.00';
      if (usdEl) usdEl.textContent = '≈ $0.00';
      return;
    }

    if (_portAcctCache[cacheKey]) {
      var cached = _portAcctCache[cacheKey];
      if (listEl) listEl.innerHTML = _renderAcctListHtml(cached.assets, cached.total);
      if (totalEl) totalEl.textContent = cached.total.toFixed(2);
      if (usdEl) usdEl.textContent = '≈ $' + cached.total.toFixed(2);
      return;
    }

    if (listEl) listEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;padding:40px 0;gap:10px;"><div class="exc-spinner"></div><span style="font-size:13px;color:var(--text-muted);font-family:var(--font-mono);">Loading…</span></div>';

    try {
      var assets = await _fetchAccountBalance(exc, keys, acctCfg);
      var total = _valueAssets(exc, assets);
      _portAcctCache[cacheKey] = { assets:assets, total:total };
      // Bail if the user switched exchange or sub-tab while this was in flight
      if (__NX.state.activeExchange !== excId || _portActiveAcctId !== acctCfg.id) return;
      if (listEl) listEl.innerHTML = _renderAcctListHtml(assets, total);
      if (totalEl) totalEl.textContent = total.toFixed(2);
      if (usdEl) usdEl.textContent = '≈ $' + total.toFixed(2);
    } catch(e) {
      if (__NX.state.activeExchange === excId && _portActiveAcctId === acctCfg.id && listEl) {
        var msg = (e && e.message) ? e.message : 'Error loading balance';
        listEl.innerHTML = '<div style="text-align:center;padding:40px 0;font-size:13px;color:#f87171;font-family:var(--font-mono);">' + msg + '</div>';
      }
    }
  }

  // ── Preload every exchange's portfolio (that has a saved API key) ──
  // Called right after preloadAllMarkets() so valuation has prices to work
  // with. By the time the user taps the Portfolio tab, balances are already
  // sitting in memory instead of waiting on a spinner.
  async function preloadAllPortfolios() {
    await Promise.all(__NX.EXCHANGES.map(function(exc) {
      var keys = __NX.getExchangeKey(exc.id);
      if (!keys) return Promise.resolve();
      return __NX.fetchPortfolioAssets(exc, keys).then(function(result) {
        __NX._portfolioCache[exc.id] = result;
      }).catch(function() {});
    }));
    // If the portfolio tab happens to already be open and showing the
    // spinner/empty state, render the now-available data immediately.
    if (__NX.state.activeTab === 'portfolio' && __NX._portfolioCache[__NX.state.activeExchange]) {
      __NX._renderPortfolioResult('exc-port-list', 'exc-port-total', __NX._portfolioCache[__NX.state.activeExchange]);
    }
  }

  // ── Inline Trade-tab Open Orders / Holdings toggle ──
  function switchTradeTab(which) {
    var openTab  = document.getElementById('exc-trade-tt-open');
    var holdTab  = document.getElementById('exc-trade-tt-hold');
    var ordersEl = document.getElementById('exc-trade-orders-list');
    var portEl   = document.getElementById('exc-trade-port-list');
    var isOpen = which === 'open';
    if (openTab) { openTab.style.color = isOpen ? 'var(--text-primary)' : 'var(--text-muted)'; openTab.style.borderBottomColor = isOpen ? 'var(--accent-primary)' : 'transparent'; }
    if (holdTab) { holdTab.style.color = !isOpen ? 'var(--text-primary)' : 'var(--text-muted)'; holdTab.style.borderBottomColor = !isOpen ? 'var(--accent-primary)' : 'transparent'; }
    if (ordersEl) ordersEl.style.display = isOpen ? 'block' : 'none';
    if (portEl)   portEl.style.display   = !isOpen ? 'block' : 'none';
    if (isOpen) __NX.loadOrders('open', 'exc-trade-orders-list');
    else __NX.loadPortfolio('exc-trade-port-list', null);
  }

  // ── Market filter helpers ──
  function filterMarkets() { __NX.filterAndRender(); }
  function setQuote(q) {
    __NX.state.activeQuote = q;
    ['USDT','BTC','ETH'].forEach(function(v) {
      var b = document.getElementById('exc-q-'+v);
      if (b) b.className = 'exc-q-btn' + (v===q?' exc-q-active':'');
    });
    __NX.filterAndRender();
  }
  function sortMarkets(col) {
    if (__NX.state.sortCol === col) __NX.state.sortDir *= -1;
    else { __NX.state.sortCol = col; __NX.state.sortDir = -1; }
    __NX.filterAndRender();
  }

  // ── Toast ──
  function showExcToast(msg, isErr) {
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:'+(isErr?'#7f1d1d':'#14532d')+';color:#fff;padding:10px 20px;border-radius:12px;font-size:13px;font-family:var(--font-mono);font-weight:700;z-index:9999;max-width:88vw;white-space:'+(isErr?'normal':'nowrap')+';text-align:center;box-shadow:0 4px 20px rgba(0,0,0,0.4);';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function() { t.remove(); }, isErr ? 6000 : 3000);
  }

  // ── Init ──
  function init() {
    try {
      var saved = localStorage.getItem('one_exc_active');
      if (saved) __NX.state.activeExchange = saved;
    } catch(e) {}
    // First Wallet -> Exchange entry per app session: just show the
    // SELECT EXCHANGE picker. Nothing else runs — no header/status/tab
    // setup, no market/balance/portfolio calls. selectExchange() (fired
    // by the user's tap in the modal) handles all of that itself.
    __NX.openSelector();
  }
})((window.__nxp = window.__nxp || {}).mod_exc_spot_engine = window.__nxp.mod_exc_spot_engine || {});
