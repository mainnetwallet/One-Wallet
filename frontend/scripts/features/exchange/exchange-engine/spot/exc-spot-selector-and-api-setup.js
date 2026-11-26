// Tab switching, exchange selector and API key setup
// Part of the exchange spot engine (window.EXC) module (split by topic; no logic change).
(function (__NX) {
  __NX.switchTab = switchTab;
  __NX.openSelector = openSelector;
  __NX.closeSelector = closeSelector;
  __NX.selectExchange = selectExchange;
  __NX.openApiSetup = openApiSetup;
  __NX.closeApiSetup = closeApiSetup;
  __NX.toggleSecretVis = toggleSecretVis;
  __NX.testApiKey = testApiKey;
  __NX.saveApiKey = saveApiKey;
  __NX.deleteKey = deleteKey;


  // ── Tab switching ──
  function switchTab(tab) {
    __NX.state.activeTab = tab;
    ['markets','trade','orders','portfolio','future','transfer'].forEach(function(t) {
      var tabEl = document.getElementById('exc-tab-'+t);
      var panEl = document.getElementById('exc-panel-'+t);
      var navEl = document.getElementById('exc-nav-'+t);
      if (tabEl) tabEl.className = 'exc-tab' + (t===tab ? ' exc-tab-active' : '');
      if (panEl) panEl.style.display = (t===tab ? 'flex' : 'none');
      if (navEl) navEl.className = 'nav-item exc-nav-item' + (t===tab ? ' active' : '');
    });
    if (tab === 'orders') {
      // Restore last active category tab (default: open)
      var cat = __NX.state.ordersCategory || 'open';
      ['open','all','spot','futures','convert'].forEach(function(c) {
        var el = document.getElementById('exc-ocat-' + c);
        if (el) el.className = 'exc-ocat-tab' + (c === cat ? ' exc-ocat-active' : '');
      });
      __NX.switchOrdersCat(cat);
    }
    if (tab === 'portfolio') {
      // Build the Overview/Funding/Spot/Futures/etc. tab bar for whichever
      // exchange is active, then land back on Overview each time the tab
      // is opened (matches old default behavior).
      __NX.renderPortTabs(__NX.state.activeExchange);
      __NX.switchPortTab('overview');
      // Cache আছে? instantly দেখাও, API call নাই
      if (__NX._portfolioCache[__NX.state.activeExchange]) {
        __NX._renderPortfolioResult('exc-port-list', 'exc-port-total', __NX._portfolioCache[__NX.state.activeExchange]);
      } else {
        __NX.loadPortfolio();
      }
    }
    if (tab === 'transfer') { if (typeof trfOpen === 'function') trfOpen(); }
    if (tab === 'future') {
      // FUT.init() syncs exchangeId, restarts feed if stale, and
      // refreshes balance/positions/orders. Handles first-ever visit
      // to Futures tab before any exchange switch has occurred.
      if (window.FUT) {
        try { FUT.init(); } catch(e) {}
      }
    }
    if (tab === 'trade') {
      __NX.updateTradePairPrice();
      // Init side/type UI
      if (!window._excSide) window._excSide = 'buy';
      __NX.setSide(window._excSide);
      __NX.setOrderType(__NX.state.orderType || 'limit');
      // Order book WS already running in background since exchange switch —
      // just repaint instantly with whatever's already live, no reconnect.
      __NX.renderOrderBook();
      __NX.loadAvailableBalance();
      __NX.switchTradeTab('open');
      // Always land on Spot when opening the trade tab
      __NX.convSetMode('spot');
      // Update convert tab — disable if exchange doesn't support it
      var convTab = document.getElementById('exc-ctab-convert');
      if (convTab) {
        if (__NX.activeExc().supportsConvert) {
          convTab.classList.remove('disabled');
          convTab.onclick = function() { __NX.convSetMode('convert'); };
        } else {
          convTab.classList.add('disabled');
          convTab.onclick = function() {
            if (typeof showToast === 'function') showToast(__NX.activeExc().name + ' does not support Convert');
          };
        }
      }
    }
  }

  // ── Exchange selector ──
  function openSelector() {
    var sheet = document.getElementById('exc-selector-sheet');
    var list  = document.getElementById('exc-selector-list');
    if (!sheet || !list) return;
    var html = '';
    __NX.EXCHANGES.forEach(function(e) {
      var isActive = e.id === __NX.state.activeExchange;
      var keys = __NX.getExchangeKey(e.id);
      var logoHtml = '<div style="width:28px;height:28px;border-radius:8px;background:'+e.color+';display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#fff;flex-shrink:0;font-family:var(--font-mono);">'+e.name[0]+'</div>';
      html += '<div class="exc-exchange-item'+(isActive?' exc-active':'')+'" onclick="EXC.selectExchange(\''+e.id+'\')">' +
        '<div style="position:relative;width:28px;height:28px;flex-shrink:0;">' +
          '<img src="'+e.logo+'" style="width:28px;height:28px;border-radius:8px;object-fit:contain;background:#111;position:absolute;inset:0;" ' +
            'onerror="this.style.display=\'none\';this.nextSibling.style.display=\'flex\'" />' +
          '<div style="width:28px;height:28px;border-radius:8px;background:'+e.color+';display:none;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#fff;font-family:var(--font-mono);">'+e.name[0]+'</div>' +
        '</div>' +
        '<div style="flex:1;">' +
          '<div style="font-size:14px;font-weight:700;color:var(--text-primary);font-family:var(--font-mono);">'+e.name+'</div>' +
          '<div style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);margin-top:2px;">'+(keys ? '🔑 Key saved' : 'No key')+'</div>' +
        '</div>' +
        (isActive ? '<span class="material-icons-round" style="font-size:18px;color:var(--accent-primary);">check_circle</span>' : '') +
      '</div>';
    });
    list.innerHTML = html;
    sheet.style.display = 'flex';
  }

  function closeSelector() {
    var s = document.getElementById('exc-selector-sheet');
    if (s) s.style.display = 'none';
  }

  async function selectExchange(id) {
    __NX.state.activeExchange = id;
    try { localStorage.setItem('one_exc_active', id); } catch(e) {}
    // Restore saved Spot pair for the new exchange, or fall back to that
    // exchange's own default (e.g. Coinbase is USDC-quoted, not USDT) —
    // without this, switching to Coinbase for the first time left
    // state.activePair on whatever USDT pair was active before, which
    // doesn't exist in Coinbase's market list.
    try {
      var _excSavedPair = localStorage.getItem('one_exc_pair_' + id);
      var _excEntry = __NX.EXCHANGES.find(function(e){ return e.id === id; });
      __NX.state.activePair = _excSavedPair || (_excEntry && _excEntry.defaultPair) || 'BTCUSDT';
    } catch(e) {}
    closeSelector();
    updateExchangeHeader();
    updateApiStatus();

    // ── Kill previous exchange's order book WS immediately ──
    // Must happen before DOM clear — stopOrderBook() bumps _obGen which
    // invalidates any in-flight relay-fallback timers from the old exchange,
    // preventing stale data from the previous exchange painting over the
    // new one's order book after the 6 s direct-connect timeout fires.
    __NX.stopOrderBook();

    // ── Clear stale data from previous exchange immediately ──
    // Price / ticker
    var _prEl  = document.getElementById('exc-trade-price');  if (_prEl)  { _prEl.textContent = '—'; _prEl.style.color = 'var(--text-muted)'; }
    var _chEl  = document.getElementById('exc-trade-change'); if (_chEl)  _chEl.textContent = '—';
    // Order book
    var _obA   = document.getElementById('exc-ob-asks');      if (_obA)   _obA.innerHTML = '';
    var _obB   = document.getElementById('exc-ob-bids');      if (_obB)   _obB.innerHTML = '';
    var _obM   = document.getElementById('exc-ob-mid');       if (_obM)   { _obM.textContent = '—'; _obM.style.color = 'var(--text-muted)'; }
    var _obMU  = document.getElementById('exc-ob-mid-usd');   if (_obMU)  _obMU.textContent = '';
    // Depth bar
    var _dbuy  = document.getElementById('exc-depth-buy');    if (_dbuy)  _dbuy.style.width = '50%';
    var _dbuyP = document.getElementById('exc-depth-buy-pct');  if (_dbuyP)  _dbuyP.textContent = '50%';
    var _dselP = document.getElementById('exc-depth-sell-pct'); if (_dselP) _dselP.textContent = '50%';
    // Open orders in trade tab
    var _ordL  = document.getElementById('exc-trade-orders-list'); if (_ordL) _ordL.innerHTML = '';
    var _ordC  = document.getElementById('exc-trade-open-count');  if (_ordC) _ordC.textContent = '0';
    // Available balance
    window._excUsdtBalanceCache = 0;
    var _avblEl = document.getElementById('exc-trade-avbl'); if (_avblEl) _avblEl.textContent = '—';

    await __NX.loadMarkets();
    // Portfolio tab (and the Holdings sub-tab inside Trade) was left showing
    // the previous exchange's balance — nothing told either panel to
    // re-fetch for state.activeExchange's new id. Done before the
    // pair-existence check below since that check can return early and
    // these refreshes don't depend on activePair at all.
    if (__NX.state.activeTab === 'portfolio') {
      // Tab list (Funding/Spot/Futures/etc.) varies per exchange — rebuild
      // it and land back on Overview, same as opening the tab fresh,
      // otherwise the previous exchange's sub-tabs (and whatever sub-panel
      // was open) would keep showing after the switch.
      __NX.renderPortTabs(id);
      __NX.switchPortTab('overview');
      __NX.loadPortfolio();
    }
    var tradePortEl = document.getElementById('exc-trade-port-list');
    if (__NX.state.activeTab === 'trade' && tradePortEl && tradePortEl.style.display !== 'none') {
      __NX.loadPortfolio('exc-trade-port-list', null);
    }
    // The previously active pair may not exist on this exchange at all
    // (e.g. a token only listed on Binance) — without this check the trade
    // page kept showing/trading that token after switching exchanges, even
    // though the new exchange's market list never contained it.
    var stillExists = __NX.state.markets.some(function(m) { return m.symbol === __NX.state.activePair; });
    if (!stillExists) {
      var fallback = __NX.state.markets.find(function(m) { return m.symbol === 'BTCUSDT'; }) || __NX.state.markets[0];
      if (fallback) { __NX.selectPair(fallback.symbol); }
    }
    // Refresh convert UI if it's visible; if new exchange doesn't support
    // convert (or spot tab is active) always fall back to Spot mode.
    var convEl = document.getElementById('exc-convert-content');
    if (convEl && convEl.style.display !== 'none') {
      if (__NX.activeExc().supportsConvert) {
        __NX.convRefreshUI();
      } else {
        __NX.convSetMode('spot');
      }
    }
    // Also update the convert tab enabled/disabled state on exchange switch
    if (__NX.state.activeTab === 'trade') {
      var _convTab = document.getElementById('exc-ctab-convert');
      if (_convTab) {
        if (__NX.activeExc().supportsConvert) {
          _convTab.classList.remove('disabled');
          _convTab.onclick = function() { __NX.convSetMode('convert'); };
        } else {
          _convTab.classList.add('disabled');
          _convTab.onclick = function() {
            if (typeof showToast === 'function') showToast(__NX.activeExc().name + ' does not support Convert');
          };
        }
      }
    }

    // ── Exchange switch: clear all cached tab data ──
    __NX._clearExchangeCache(id);

    // ── Spot/Trade: OB + balance — always fire regardless of active tab ──
    __NX.selectPair(__NX.state.activePair || 'BTCUSDT');
    __NX.loadAvailableBalance();

    // ── Background prefetch ALL tabs in parallel — fills cache ──
    // Tab switch করলে cache থেকে instantly দেখাবে, আর API call হবে না।

    // Trade tab open orders + holdings
    __NX.loadOrders('open', 'exc-trade-orders-list');
    __NX.loadPortfolio('exc-trade-port-list', null);

    // Orders tab (open + history both)
    __NX.loadOrders('open', 'exc-orders-list');
    __NX.loadOrders('history', 'exc-orders-list');

    // Portfolio tab
    __NX.loadPortfolio();

    // Transfer tab: if open during the switch, re-init for the new exchange
    // so the From/To account list (Funding/Spot/Unified etc.) matches the
    // newly selected exchange instead of showing the previous exchange's
    // stale _state.accounts (e.g. Bitget's list left showing after
    // switching to Bybit).
    if (__NX.state.activeTab === 'transfer' && typeof trfOpen === 'function') {
      trfOpen();
    }

    // Future tab: FUT.init() syncs FUT's own state.exchangeId to the new
    // active exchange (read via getActiveExchangeId() -> EXC.getState()),
    // then internally calls startFeed() + loadPositions() + loadOpenOrders()
    // + loadFutBalance(). Calling startFeed()/loadFutBalance() etc directly
    // here without going through init() left state.exchangeId pointing at
    // whatever exchange was active last time FUT.init() ran — so the feed
    // kept connecting to the old exchange, and the Select Pair modal kept
    // showing the old exchange's pair list after switching.
    if (window.FUT) {
      try {
        FUT.init();
      } catch(e) {}
    }

    // ── Background warm-up of OTHER exchanges, deferred until the user ──
    // has actually picked one (was previously firing on every Wallet ->
    // Exchange mode entry, before any selection — hitting signed
    // portfolio APIs for exchanges the user might never open). Runs once
    // per app session.
    if (!__NX._bgPreloadStarted) {
      __NX._bgPreloadStarted = true;
      try {
        __NX.preloadAllMarkets().then(function() {
          try { __NX.preloadAllPortfolios(); } catch(e) {}
        });
      } catch(e) {}
    }
  }

  function updateExchangeHeader() {
    var exc = __NX.activeExc();
    var nameEl = document.getElementById('exc-name');
    var logoEl = document.getElementById('exc-logo');
    var setupTitle = document.getElementById('exc-setup-title');
    if (nameEl) nameEl.textContent = exc.name.toUpperCase();
    if (logoEl) { logoEl.src = exc.logo; logoEl.style.display = 'block'; }
    var logoFb = document.getElementById('exc-logo-fb');
    if (logoFb) { logoFb.style.display = 'none'; logoFb.style.background = exc.color; logoFb.textContent = exc.name[0]; }
    if (setupTitle) setupTitle.textContent = exc.name.toUpperCase() + ' API';
    // Passphrase row — shown for exchanges that require one (KuCoin, BitMart "Memo", Bitget, Coinbase)
    var ppRow = document.getElementById('exc-passphrase-row');
    if (ppRow) ppRow.style.display = exc.hasPassphrase ? 'block' : 'none';
    var ppLabel = document.getElementById('exc-passphrase-label');
    if (ppLabel) ppLabel.textContent = (exc.id === 'bitmart' ? 'MEMO' : 'PASSPHRASE') + ' (' + exc.name.toUpperCase() + ')';
    // Coinbase-only CDP key section (Futures/INTX auth)
    var cdpSec = document.getElementById('exc-cdp-section');
    if (cdpSec) cdpSec.style.display = (exc.id === 'coinbase') ? 'block' : 'none';
  }

  function updateApiStatus() {
    var keys = __NX.getExchangeKey(__NX.state.activeExchange);
    var dot   = document.getElementById('exc-api-dot');
    var label = document.getElementById('exc-api-label');
    var nokey = document.getElementById('exc-trade-nokey');
    if (keys) {
      if (dot) dot.style.background = '#22c55e';
      if (label) label.textContent = 'CONNECTED';
      if (nokey) nokey.style.display = 'none';
    } else {
      if (dot) dot.style.background = '#ef4444';
      if (label) label.textContent = 'NO KEY';
      if (nokey) nokey.style.display = 'block';
    }
  }

  // ── API Key setup ──
  function openApiSetup() {
    var sheet = document.getElementById('exc-apisetup-sheet');
    if (!sheet) return;
    // Pre-fill if key exists
    var keys = __NX.getExchangeKey(__NX.state.activeExchange);
    var inp1 = document.getElementById('exc-input-apikey');
    var inp2 = document.getElementById('exc-input-secret');
    var inp3 = document.getElementById('exc-input-passphrase');
    if (inp1) inp1.value = keys ? keys.apiKey : '';
    if (inp2) inp2.value = keys ? keys.secret : '';
    if (inp3) inp3.value = keys ? (keys.passphrase||'') : '';
    var inp4 = document.getElementById('exc-input-cdpkeyname');
    var inp5 = document.getElementById('exc-input-cdppem');
    if (inp4) inp4.value = keys ? (keys.cdpKeyName||'') : '';
    if (inp5) inp5.value = keys ? (keys.cdpPem||'') : '';
    renderSavedKeys();
    sheet.style.display = 'flex';
    // Fetch current IP
    var ipEl = document.getElementById('exc-my-ip');
    if (ipEl) {
      ipEl.textContent = 'Loading…';
      fetch('https://api.ipify.org?format=json')
        .then(function(r){ return r.json(); })
        .then(function(d){ if (ipEl) ipEl.textContent = d.ip || '—'; })
        .catch(function(){ if (ipEl) ipEl.textContent = '—'; });
    }
  }

  function closeApiSetup() {
    var s = document.getElementById('exc-apisetup-sheet');
    if (s) s.style.display = 'none';
  }

  function toggleSecretVis() {
    var inp = document.getElementById('exc-input-secret');
    var ic  = document.querySelector('#exc-apisetup-sheet .material-icons-round[onclick*="ToggleSecretVis"]');
    if (!inp) return;
    if (inp.type === 'password') { inp.type = 'text'; } else { inp.type = 'password'; }
  }

  async function testApiKey() {
    var apiKey = (document.getElementById('exc-input-apikey')||{}).value||'';
    var secret = (document.getElementById('exc-input-secret')||{}).value||'';
    var passphrase = (document.getElementById('exc-input-passphrase')||{}).value||'';
    var res = document.getElementById('exc-key-test-result');
    var btn = document.getElementById('exc-btn-test');
    if (!apiKey || !secret) { if (res) { res.textContent = '⚠ Enter API key and secret'; res.style.color='#f87171'; } return; }
    if (btn) btn.textContent = 'Testing…';
    if (res) res.textContent = '';
    try {
      var keys = {apiKey, secret, passphrase};
      var exc = __NX.activeExc();
      var ok = false;
      if (exc.id === 'binance') {
        var data = await __NX.binanceFetch('/api/v3/account', {}, keys);
        ok = !!data.balances;
      } else if (exc.id === 'mexc') {
        var data = await __NX.mexcFetch('/api/v3/account', {recvWindow: 10000}, keys);
        ok = !!data.balances;
      } else if (exc.id === 'kucoin') {
        var data = await __NX.kucoinFetch('/api/v1/accounts', null, keys);
        ok = Array.isArray(data.data);
      } else if (exc.id === 'bybit') {
        var data = await __NX.bybitFetch('/v5/account/wallet-balance', {accountType:'UNIFIED'}, keys);
        ok = data.retCode === 0;
      } else if (exc.id === 'bitmart') {
        var data = await __NX.bitmartFetch(exc.endpoints.balance, {}, keys);
        ok = data.code === 1000;
      } else if (exc.id === 'bitget') {
        var data = await __NX.bitgetFetch(exc.endpoints.balance, {}, keys);
        ok = data.code === '00000';
      } else if (exc.id === 'kraken') {
        var data = await __NX.krakenFetch(exc.endpoints.balance, {}, keys);
        ok = !!data.result && (!data.error || !data.error.length);
      } else if (exc.id === 'gateio') {
        var data = await __NX.gateioFetch(exc.endpoints.balance, {}, keys);
        ok = Array.isArray(data);
      } else if (exc.id === 'coinbase') {
        var data = await __NX.coinbaseFetch(exc.endpoints.balance, {}, keys, 'GET');
        ok = Array.isArray(data);
      } else if (exc.id === 'bingx') {
        var data = await __NX.bingxFetch(exc.endpoints.balance, {}, keys);
        ok = data.code === 0;
      } else if (exc.id === 'htx') {
        var data = await __NX.htxFetch(exc.endpoints.balance, {}, keys);
        ok = data.status === 'ok';
      } else if (exc.id === 'phemex') {
        var data = await __NX.phemexFetch(exc.endpoints.balance, {}, keys);
        ok = data.code === 0;
      } else if (exc.id === 'digifinex') {
        var data = await __NX.digifinexFetch(exc.endpoints.balance, {}, keys);
        ok = data.code === 0;
      } else if (exc.id === 'lbank') {
        var data = await __NX.lbankFetch(exc.endpoints.balance, {}, keys);
        ok = !!data.result || !!data.info;
      } else if (exc.id === 'bitfinex') {
        var data = await __NX.bitfinexFetch(exc.endpoints.balance, {}, keys);
        ok = Array.isArray(data);
      }
      if (res) { res.textContent = ok ? '✅ Connection successful!' : '❌ Invalid key or insufficient permissions'; res.style.color = ok ? '#22c55e' : '#f87171'; }
    } catch(e) {
      if (res) { res.textContent = '❌ Error: ' + e.message; res.style.color = '#f87171'; }
    }
    if (btn) btn.textContent = 'Test';
  }

  function saveApiKey() {
    var apiKey = (document.getElementById('exc-input-apikey')||{}).value||'';
    var secret = (document.getElementById('exc-input-secret')||{}).value||'';
    var passphrase = (document.getElementById('exc-input-passphrase')||{}).value||'';
    var cdpKeyName = (document.getElementById('exc-input-cdpkeyname')||{}).value||'';
    var cdpPem = (document.getElementById('exc-input-cdppem')||{}).value||'';
    var res = document.getElementById('exc-key-test-result');
    if (!apiKey || !secret) { if (res) { res.textContent = '⚠ API key and secret required'; res.style.color='#f87171'; } return; }
    var keys = __NX.getKeys();
    keys[__NX.state.activeExchange] = {apiKey, secret, passphrase};
    if (__NX.state.activeExchange === 'coinbase' && cdpKeyName && cdpPem) {
      keys[__NX.state.activeExchange].cdpKeyName = cdpKeyName.trim();
      keys[__NX.state.activeExchange].cdpPem = cdpPem.trim();
    }
    __NX.saveKeys(keys);
    updateApiStatus();
    renderSavedKeys();
    if (res) { res.textContent = '✅ Key saved successfully'; res.style.color='#22c55e'; }
    setTimeout(function() { closeApiSetup(); if (res) res.textContent=''; }, 1200);
  }

  function renderSavedKeys() {
    var sec = document.getElementById('exc-saved-keys-section');
    var list = document.getElementById('exc-saved-keys-list');
    if (!sec || !list) return;
    var keys = __NX.getKeys();
    var saved = Object.keys(keys);
    if (!saved.length) { sec.style.display = 'none'; return; }
    sec.style.display = 'block';
    list.innerHTML = saved.map(function(id) {
      var exc = __NX.EXCHANGES.find(function(e) { return e.id === id; });
      var name = exc ? exc.name : id;
      var k = keys[id];
      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(255,255,255,0.04);border-radius:10px;border:1px solid rgba(255,255,255,0.07);">' +
        '<div>' +
          '<div style="font-size:13px;font-weight:700;color:var(--text-primary);font-family:var(--font-mono);">'+name+'</div>' +
          '<div style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);margin-top:2px;">'+k.apiKey.slice(0,8)+'…'+k.apiKey.slice(-4)+'</div>' +
        '</div>' +
        '<span onclick="EXC.deleteKey(\''+id+'\')" class="material-icons-round" style="font-size:20px;color:#ef4444;cursor:pointer;">delete</span>' +
      '</div>';
    }).join('');
  }

  function deleteKey(id) {
    var keys = __NX.getKeys();
    delete keys[id];
    __NX.saveKeys(keys);
    renderSavedKeys();
    updateApiStatus();
  }
})((window.__nxp = window.__nxp || {}).mod_exc_spot_engine = window.__nxp.mod_exc_spot_engine || {});
