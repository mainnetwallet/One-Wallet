// Futures: margin mode and leverage pickers, exchange sync
// Part of the futures engine (FUT) module (split by topic; no logic change).
(function (__NX) {
  __NX._syncMarginModeFromExchange = _syncMarginModeFromExchange;
  __NX._applyMarginModeToExchange = _applyMarginModeToExchange;
  __NX._setLeverageValue = _setLeverageValue;
  __NX.openLeveragePicker = openLeveragePicker;
  __NX._fetchMaxLeverage = _fetchMaxLeverage;
  __NX._fetchLeverageFromExchange = _fetchLeverageFromExchange;


  // ── Sync actual margin mode from exchange on tab open ──
  async function _syncMarginModeFromExchange() {
    var excId = __NX.state.exchangeId;
    var cfg = __NX.getFutCfg();
    if (!cfg) return;
    var keys = __NX.getApiKeys();
    if (!keys || !keys.apiKey) return;
    var exSym = __NX.toExSym(__NX.state.symbol, cfg);
    try {
      if (excId === 'binance') {
        var r = await __NX.signedFetch(cfg, '/fapi/v2/positionRisk', { symbol: exSym }, 'GET');
        var pos = Array.isArray(r) ? r[0] : null;
        if (pos && pos.marginType) {
          var mode = pos.marginType === 'isolated' ? 'Isolated' : 'Cross';
          __NX.state.marginMode = mode;
          var el = document.getElementById('fut-margin-mode'); if (el) el.textContent = mode;
        }
      } else if (excId === 'bybit') {
        var r = await __NX.signedFetch(cfg, '/v5/position/list', { category: 'linear', symbol: exSym }, 'GET');
        var pos = r && r.result && r.result.list && r.result.list[0];
        if (pos && pos.tradeMode !== undefined) {
          var mode = pos.tradeMode === 1 ? 'Isolated' : 'Cross';
          __NX.state.marginMode = mode;
          var el = document.getElementById('fut-margin-mode'); if (el) el.textContent = mode;
        }
      } else if (excId === 'bitget') {
        var r = await __NX.signedFetch(cfg, '/api/v2/mix/account/account', { symbol: exSym, productType: 'USDT-FUTURES', marginCoin: 'USDT' }, 'GET');
        if (r && r.data && r.data.marginMode) {
          var mode = r.data.marginMode === 'isolated' ? 'Isolated' : 'Cross';
          __NX.state.marginMode = mode;
          var el = document.getElementById('fut-margin-mode'); if (el) el.textContent = mode;
        }
      } else if (excId === 'kucoin') {
        var r = await __NX.signedFetch(cfg, '/api/v1/position', { symbol: exSym }, 'GET');
        if (r && r.data && r.data.crossMode !== undefined) {
          var mode = r.data.crossMode ? 'Cross' : 'Isolated';
          __NX.state.marginMode = mode;
          var el = document.getElementById('fut-margin-mode'); if (el) el.textContent = mode;
        }
      }
      // Other exchanges: margin mode is per-order or not queryable — leave as-is
    } catch(e) {
      // Sync failure is silent — user can still toggle manually
    }
  }

  async function _applyMarginModeToExchange(newMode) {
    var excId = __NX.state.exchangeId;
    var cfg = __NX.getFutCfg();
    if (!cfg) return;
    var exSym = __NX.toExSym(__NX.state.symbol, cfg);
    try {
      if (excId === 'binance') {
        var r = await __NX.signedFetch(cfg, '/fapi/v1/marginType', null, 'POST', {
          symbol: exSym,
          marginType: newMode === 'Isolated' ? 'ISOLATED' : 'CROSSED',
        });
        if (r.code && r.code !== 200) throw new Error(r.msg || r.code);

      } else if (excId === 'bybit') {
        var lev = String(__NX.state.leverage || 20);
        var r = await __NX.signedFetch(cfg, '/v5/position/switch-isolated', null, 'POST', {
          category: 'linear',
          symbol: exSym,
          tradeMode: newMode === 'Isolated' ? 1 : 0,
          buyLeverage: lev,
          sellLeverage: lev,
        });
        if (r.retCode !== 0) throw new Error(r.retMsg || r.retCode);

      } else if (excId === 'bitget') {
        var r = await __NX.signedFetch(cfg, '/api/v2/mix/account/set-margin-mode', null, 'POST', {
          symbol: exSym,
          productType: 'USDT-FUTURES',
          marginCoin: 'USDT',
          marginMode: newMode === 'Isolated' ? 'isolated' : 'crossed',
        });
        if (r.code !== '00000') throw new Error(r.msg || r.code);

      } else if (excId === 'bingx') {
        var r = await __NX.signedFetch(cfg, '/openApi/swap/v2/trade/marginType', null, 'POST', {
          symbol: exSym,
          marginType: newMode === 'Isolated' ? 'ISOLATED' : 'CROSSED',
        });
        if (r.code !== 0) throw new Error(r.msg || r.code);

      } else if (excId === 'kucoin') {
        var r = await __NX.signedFetch(cfg, '/api/v2/position/changeMarginMode', null, 'POST', {
          symbol: exSym,
          marginMode: newMode === 'Isolated' ? 'ISOLATED' : 'CROSS',
        });
        // KuCoin returns code '200000' on success
        if (r.code && r.code !== '200000') throw new Error(r.msg || r.code);

      } else if (excId === 'mexc' || excId === 'gateio' || excId === 'htx' ||
                 excId === 'phemex' || excId === 'bitmart' || excId === 'digifinex' ||
                 excId === 'kraken' || excId === 'lbank' || excId === 'bitfinex') {
        // These exchanges: margin mode is set per-order or at account level (no switch endpoint)
        if (typeof showToast === 'function') showToast(
          (cfg.name || excId) + ': ' + newMode + ' mode set locally — applied per order', 'info'
        );
        return;
      } else {
        return;
      }
      if (typeof showToast === 'function') showToast('\u2705 ' + newMode + ' margin mode set', 'check_circle');
    } catch(e) {
      // Revert UI on failure
      var prev = newMode === 'Cross' ? 'Isolated' : 'Cross';
      __NX.state.marginMode = prev;
      var el = document.getElementById('fut-margin-mode'); if (el) el.textContent = prev;
      var _em = e.message || String(e);
      var _isApiKey = /api.?key|ip.*perm|invalid.*key|signature/i.test(_em);
      if (typeof showToast === 'function') showToast(
        _isApiKey ? 'API key has no Futures permission' : ('Margin mode not set: ' + _em.split(',')[0].trim()),
        _isApiKey ? 'vpn_key_off' : 'sync_problem',
        {type:'error'}
      );
    }
  }

  function _setLeverageValue(n) {
    if (isNaN(n) || n < 1) n = 1;
    if (n > 125) n = 125;
    __NX.state.leverage = n;
    var _lvKey = (__NX.state.exchangeId || '') + ':' + (__NX.state.symbol || '');
    __NX.state._leverageCache[_lvKey] = n;
    try { localStorage.setItem('fut_lev_' + (__NX.state.exchangeId || '') + '_' + (__NX.state.symbol || ''), String(n)); } catch(e) {}
    var txt = document.getElementById('fut-lev-text');
    if (txt) txt.textContent = n + 'x';
    var el = document.getElementById('fut-leverage-btn');
    if (el) el.setAttribute('data-lev', n);
    __NX.calcCost();
    __NX.state._leverageApplyPromise = _applyLeverageToExchange(n);
    __NX.state._leverageApplyPromise.catch(function(){});
  }

  function openLeveragePicker() {
    var existing = document.getElementById('fut-lev-sheet');
    if (existing) existing.remove();
    // Expose helpers to global scope so inline onclick strings can reach them
    window._leveragePresetClick = _leveragePresetClick;
    window._updateLevPresets = _updateLevPresets;

    var cur = __NX.state.leverage || 20;
    var max = __NX.state.maxLeverage || 125;
    // Build presets dynamically up to max
    var _allPresets = [1,2,3,5,10,15,20,25,50,75,100,125,150,200];
    var presets = _allPresets.filter(function(p){ return p <= max; });
    if (presets[presets.length-1] !== max) presets.push(max);

    var sheet = document.createElement('div');
    sheet.id = 'fut-lev-sheet';
    sheet.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;justify-content:flex-end;background:rgba(0,0,0,0.55);-webkit-tap-highlight-color:transparent;';

    sheet.innerHTML = '<div id="fut-lev-inner" style="background:var(--bg-card,#1a1b2e);border-radius:20px 20px 0 0;padding:0 0 calc(28px + env(safe-area-inset-bottom, 20px));max-height:80vh;overflow-y:auto;padding-bottom:calc(72px + env(safe-area-inset-bottom, 20px));">' +
      /* handle */
      '<div style="display:flex;justify-content:center;padding:10px 0 4px;">' +
        '<div style="width:36px;height:4px;border-radius:2px;background:rgba(255,255,255,0.15);"></div>' +
      '</div>' +
      /* title row */
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 18px 14px;">' +
        '<div style="font-size:15px;font-weight:800;color:var(--text-primary);font-family:var(--font-mono);">Leverage</div>' +
        '<div id="fut-lev-display" style="font-size:22px;font-weight:900;color:#818cf8;font-family:var(--font-mono);letter-spacing:1px;">' + cur + 'x</div>' +
      '</div>' +
      /* slider track */
      '<div style="padding:0 20px 18px;">' +
        '<input id="fut-lev-slider" type="range" min="1" max="' + max + '" value="' + cur + '" ' +
          'style="width:100%;height:4px;accent-color:#6366f1;cursor:pointer;margin:0;" ' +
          'oninput="(function(v){' +
            'document.getElementById(\'fut-lev-display\').textContent=v+\'x\';' +
            'document.getElementById(\'fut-lev-inp\').value=v;' +
            '_updateLevPresets(parseInt(v));' +
          '})(parseInt(this.value))">' +
        /* risk labels */
        '<div style="display:flex;justify-content:space-between;margin-top:5px;">' +
          '<span style="font-size:9px;color:#0ecb81;font-family:var(--font-mono);font-weight:700;">1x Low</span>' +
          '<span style="font-size:9px;color:#f6a000;font-family:var(--font-mono);font-weight:700;">20x Mid</span>' +
          '<span style="font-size:9px;color:#f6465d;font-family:var(--font-mono);font-weight:700;">' + max + 'x Max</span>' +
        '</div>' +
      '</div>' +
      /* preset chips */
      '<div style="padding:0 16px 16px;display:flex;flex-wrap:wrap;gap:7px;">' +
        presets.map(function(p) {
          var active = p === cur;
          return '<div onclick="_leveragePresetClick(' + p + ')" data-lev-preset="' + p + '" style="padding:7px 0;min-width:46px;text-align:center;border-radius:8px;font-size:12px;font-weight:800;font-family:var(--font-mono);cursor:pointer;-webkit-tap-highlight-color:transparent;border:1.5px solid ' +
            (active ? '#6366f1' : 'rgba(255,255,255,0.1)') + ';background:' +
            (active ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.04)') + ';color:' +
            (active ? '#818cf8' : 'var(--text-muted)') + ';">' + p + 'x</div>';
        }).join('') +
      '</div>' +
      /* manual input row */
      '<div style="padding:0 16px 16px;display:flex;gap:8px;align-items:center;">' +
        '<div style="flex:1;display:flex;align-items:center;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:8px 12px;gap:6px;">' +
          '<span style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">Custom</span>' +
          '<input id="fut-lev-inp" type="number" inputmode="numeric" min="1" max="125" value="' + cur + '" ' +
            'style="flex:1;background:transparent;border:none;outline:none;font-size:15px;font-weight:800;color:var(--text-primary);font-family:var(--font-mono);text-align:right;" ' +
            'oninput="(function(v){' +
              'var n=parseInt(v)||1;var _mx=(FUT&&FUT._getMaxLev&&FUT._getMaxLev())||125;if(n>_mx)n=_mx;' +
              'document.getElementById(\'fut-lev-slider\').value=n;' +
              'document.getElementById(\'fut-lev-display\').textContent=n+\'x\';' +
              '_updateLevPresets(n);' +
            '})(this.value)">' +
          '<span style="font-size:13px;font-weight:800;color:#818cf8;font-family:var(--font-mono);">x</span>' +
        '</div>' +
        '<div onclick="(function(){' +
            'var n=parseInt(document.getElementById(\'fut-lev-inp\').value)||20;' +
            'if(n<1)n=1;if(n>125)n=125;' +
            'FUT._setLeverageValue(n);' +
            'document.getElementById(\'fut-lev-sheet\').remove();' +
          '})()" ' +
          'style="padding:10px 22px;border-radius:10px;background:#6366f1;font-size:14px;font-weight:800;color:#fff;font-family:var(--font-mono);cursor:pointer;-webkit-tap-highlight-color:transparent;white-space:nowrap;">Confirm</div>' +
      '</div>' +
    '</div>';

    // tap outside to close
    sheet.addEventListener('click', function(e) {
      if (e.target === sheet) sheet.remove();
    });

    document.body.appendChild(sheet);

    // animate in
    var inner = document.getElementById('fut-lev-inner');
    if (inner) { inner.style.transform='translateY(100%)'; inner.style.transition='transform 0.22s cubic-bezier(0.32,0.72,0,1)'; requestAnimationFrame(function(){ requestAnimationFrame(function(){ inner.style.transform='translateY(0)'; }); }); }
  }

  function _leveragePresetClick(p) {
    document.getElementById('fut-lev-slider').value = p;
    document.getElementById('fut-lev-display').textContent = p + 'x';
    document.getElementById('fut-lev-inp').value = p;
    _updateLevPresets(p);
    FUT._setLeverageValue(p);
    var sheet = document.getElementById('fut-lev-sheet');
    if (sheet) sheet.remove();
  }

  function _updateLevPresets(n) {
    document.querySelectorAll('[data-lev-preset]').forEach(function(el) {
      var p = parseInt(el.getAttribute('data-lev-preset'));
      var active = p === n;
      el.style.borderColor = active ? '#6366f1' : 'rgba(255,255,255,0.1)';
      el.style.background = active ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.04)';
      el.style.color = active ? '#818cf8' : 'var(--text-muted)';
    });
  }

  async function _applyLeverageToExchange(n) {
    var excId = __NX.state.exchangeId;
    var cfg = __NX.getFutCfg();
    var exSym = __NX.toExSym(__NX.state.symbol, cfg);
    try {
      if (excId === 'bybit') {
        var r = await __NX.signedFetch(cfg, '/v5/position/set-leverage', null, 'POST', {
          category: 'linear', symbol: exSym, buyLeverage: String(n), sellLeverage: String(n),
        });
        // retCode 110043 = "leverage not modified" — harmless, already at that value
        if (r.retCode !== 0 && r.retCode !== 110043) throw new Error(r.retMsg || r.retCode);

      } else if (excId === 'binance') {
        // Binance: success returns {leverage, symbol, maxNotionalValue} (no code); error returns {code: negative, msg}
        var r = await __NX.signedFetch(cfg, '/fapi/v1/leverage', { symbol: exSym, leverage: n }, 'POST');
        if (r.code && r.code < 0) throw new Error(r.msg || r.code);

      } else if (excId === 'bitget') {
        var r = await __NX.signedFetch(cfg, '/api/v2/mix/account/set-leverage', null, 'POST', {
          symbol: exSym, productType: 'USDT-FUTURES', marginCoin: 'USDT', leverage: String(n),
        });
        if (r.code !== '00000') throw new Error(r.msg || r.code);

      } else if (excId === 'gateio') {
        var r = await __NX.signedFetch(cfg, '/api/v4/futures/usdt/positions/' + exSym + '/leverage', { leverage: String(n) }, 'POST');
        if (r && r.label) throw new Error(r.message || r.label);

      } else if (excId === 'htx') {
        var r = await __NX.signedFetch(cfg, '/linear-swap-api/v1/swap_cross_switch_lever_rate', null, 'POST', {
          contract_code: exSym, lever_rate: n,
        });
        if (r.status !== 'ok') throw new Error((r.err_msg) || r.status);

      } else if (excId === 'bingx') {
        var r = await __NX.signedFetch(cfg, '/openApi/swap/v2/trade/leverage', { symbol: exSym, side: 'BOTH', leverage: n }, 'POST');
        if (r.code !== 0) throw new Error(r.msg || r.code);

      } else if (excId === 'phemex') {
        // Confirmed docs: PUT /g-positions/leverage; leverageRr is the Rr-scaled param
        var r = await __NX.signedFetch(cfg, '/g-positions/leverage', null, 'PUT', {
          symbol: exSym, leverageRr: n,
        });
        if (r.code !== 0) throw new Error(r.msg || r.code);

      } else if (excId === 'bitmart') {
        var r = await __NX.signedFetch(cfg, '/contract/private/submit-leverage', null, 'POST', {
          symbol: exSym, leverage: String(n), open_type: __NX.state.marginMode === 'Isolated' ? 'isolated' : 'cross',
        });
        if (r.code !== 1000) throw new Error(r.message || r.code);

      } else if (excId === 'digifinex') {
        var r = await __NX.signedFetch(cfg, '/swap/v2/account/leverage', null, 'POST', {
          instrument_id: exSym, leverage: n,
        });
        if (r.code !== 0) throw new Error(r.msg || r.code);

      } else if (excId === 'kucoin') {
        // KuCoin Futures does have a standalone cross-margin leverage endpoint:
        // POST /api/v2/changeCrossUserLeverage  body: {symbol, leverage: String}
        // Confirmed: kucoin.com/docs-new/rest/futures-trading/positions/modify-cross-margin-leverage
        var r = await __NX.signedFetch(cfg, '/api/v2/changeCrossUserLeverage', null, 'POST', {
          symbol: exSym, leverage: String(n),
        });
        if (r.code !== '200000') throw new Error((r.msg) || r.code);

      } else if (excId === 'kraken') {
        // Confirmed: PUT /leveragepreferences — sets max leverage (ceiling) for isolated margin
        // docs.kraken.com/api/docs/futures-api/trading/set-leverage-setting
        // signedFetch supports PUT; maxLeverage omitted = cross/no-isolation mode
        var r = await __NX.signedFetch(cfg, '/derivatives/api/v3/leveragepreferences', null, 'PUT', {
          symbol: exSym, maxLeverage: n,
        });
        if (r.result !== 'success') throw new Error(r.error || r.result);

      } else if (excId === 'mexc') {
        // Confirmed: POST /api/v1/private/position/change_leverage
        // mexc.com/api-docs/futures/account-and-trading-endpoints/modify-leverage
        // When no open position: requires symbol + leverage + openType + positionType
        var mexcBody = { leverage: n };
        mexcBody.symbol = exSym;
        mexcBody.openType = (__NX.state.marginMode === 'Isolated') ? 1 : 2;
        mexcBody.positionType = (__NX.state.side === 'Short') ? 2 : 1;
        var r = await __NX.signedFetch(cfg, '/api/v1/private/position/change_leverage', null, 'POST', mexcBody);
        if (!r.success) throw new Error(r.message || ('code ' + r.code));

      } else if (excId === 'bitfinex' || excId === 'lbank' || excId === 'coinbase') {
        // Bitfinex: leverage is per-order collateral, no plain set-leverage endpoint.
        // LBank: futures API set-leverage endpoint not publicly documented.
        // Coinbase INTX: portfolio-margin system, no per-symbol leverage endpoint.
        if (typeof showToast === 'function') showToast('⚠️ Leverage shown here is local only — not yet wired for ' + (cfg && cfg.name || excId));
        return;
      }
    } catch (e) {
      if (typeof showToast === 'function') {
        var _em = (e.message || String(e));
        var _isApiKey = /api.?key|ip.*permission|permission.*ip|invalid.*key|signature/i.test(_em);
        if (_isApiKey) {
          showToast('API key has no Futures permission', 'vpn_key_off', {type:'error'});
        } else {
          showToast('Leverage not synced: ' + _em.split(',')[0].trim(), 'sync_problem', {type:'error'});
        }
      }
    }
  }


  // ── Fetch per-symbol max leverage from exchange (public endpoints where possible) ──
  async function _fetchMaxLeverage() {
    var excId = __NX.state.exchangeId;
    var cfg = __NX.getFutCfg();
    var sym = __NX.state.symbol;
    var exSym = __NX.toExSym(sym, cfg);
    var maxLev = 125; // safe fallback
    try {
      if (excId === 'binance') {
        // Public: GET /fapi/v1/leverageBracket — returns max leverage for the symbol
        var r = await __NX.signedFetch(cfg, '/fapi/v1/leverageBracket', { symbol: exSym }, 'GET');
        if (r && Array.isArray(r) && r[0] && r[0].brackets && r[0].brackets[0])
          maxLev = parseInt(r[0].brackets[0].initialLeverage);
      } else if (excId === 'bybit') {
        // Public: GET /v5/market/instruments-info — maxLeverage field
        var r = await fetch('https://api.bybit.com/v5/market/instruments-info?category=linear&symbol=' + exSym).then(function(x){return x.json();});
        var item = r && r.result && r.result.list && r.result.list[0];
        if (item && item.leverageFilter && item.leverageFilter.maxLeverage)
          maxLev = parseInt(item.leverageFilter.maxLeverage);
      } else if (excId === 'bitget') {
        // Public: GET /api/v2/mix/market/instruments-info
        var r = await fetch('https://api.bitget.com/api/v2/mix/market/instruments-info?productType=USDT-FUTURES&symbol=' + exSym).then(function(x){return x.json();});
        var item = r && r.data && r.data[0];
        if (item && item.maxLever) maxLev = parseInt(item.maxLever);
      } else if (excId === 'gateio') {
        // Public: GET /api/v4/futures/usdt/contracts/{contract}
        var r = await fetch('https://api.gateio.ws/api/v4/futures/usdt/contracts/' + exSym).then(function(x){return x.json();});
        if (r && r.leverage_max) maxLev = parseInt(r.leverage_max);
      } else if (excId === 'htx') {
        // Public: GET /linear-swap-ex/market/contract/contract_info
        var r = await fetch('https://api.hbdm.com/linear-swap-api/v1/swap_info?contract_code=' + exSym).then(function(x){return x.json();});
        var item = r && r.data && r.data[0];
        if (item && item.support_margin_mode) {
          // lever_rate is array of supported rates; max is last
          var rates = item.lever_rate || [];
          if (rates.length) maxLev = Math.max.apply(null, rates);
        }
      } else if (excId === 'bingx') {
        // Public: GET /openApi/swap/v2/quote/contracts
        var r = await fetch('https://open-api.bingx.com/openApi/swap/v2/quote/contracts').then(function(x){return x.json();});
        var list = (r && r.data) || [];
        var item = list.find(function(c){ return c.symbol === exSym; });
        if (item && item.maxLeverage) maxLev = parseInt(item.maxLeverage);
      } else if (excId === 'mexc') {
        // Public: GET /api/v1/contract/detail
        var r = await fetch('https://contract.mexc.com/api/v1/contract/detail?symbol=' + exSym).then(function(x){return x.json();});
        var item = r && r.data;
        if (item && item.maxLeverage) maxLev = parseInt(item.maxLeverage);
      } else if (excId === 'kucoin') {
        // Public: GET /api/v1/contracts/{symbol}
        var r = await fetch('https://api-futures.kucoin.com/api/v1/contracts/' + exSym).then(function(x){return x.json();});
        var item = r && r.data;
        if (item && item.maxRiskLimit) {
          // maxLeverage field directly available in newer API
          if (item.maxLeverage) maxLev = parseInt(item.maxLeverage);
        }
      } else if (excId === 'bitmart') {
        // Public: GET /contract/public/details
        var r = await fetch('https://api-cloud-v2.bitmart.com/contract/public/details?symbol=' + exSym).then(function(x){return x.json();});
        var item = r && r.data && r.data.symbols && r.data.symbols[0];
        if (item && item.max_leverage) maxLev = parseInt(item.max_leverage);
      } else if (excId === 'phemex') {
        // Public: GET /public/products
        var r = await fetch('https://api.phemex.com/public/products').then(function(x){return x.json();});
        var list = (r && r.data && r.data.perpProductsV2) || [];
        var item = list.find(function(c){ return c.symbol === exSym; });
        if (item && item.maxLeverage) maxLev = parseInt(item.maxLeverage);
      } else if (excId === 'kraken') {
        // Public: GET /derivatives/api/v3/instruments
        var r = await fetch('https://futures.kraken.com/derivatives/api/v3/instruments').then(function(x){return x.json();});
        var list = (r && r.instruments) || [];
        var item = list.find(function(c){ return c.symbol === exSym; });
        if (item && item.maxLeverage) maxLev = parseInt(item.maxLeverage);
      } else if (excId === 'digifinex') {
        // Public: GET /swap/v2/public/instruments
        var r = await fetch('https://openapi.digifinex.com/swap/v2/public/instruments').then(function(x){return x.json();});
        var list = (r && r.data) || [];
        var item = list.find(function(c){ return c.instrument_id === exSym; });
        if (item && item.max_leverage) maxLev = parseInt(item.max_leverage);
      } else if (excId === 'lbank') {
        maxLev = 100; // LBank futures max is 100x
      } else if (excId === 'bitfinex') {
        maxLev = 100; // Bitfinex derivatives max
      } else if (excId === 'coinbase') {
        maxLev = 10;  // Coinbase INTX max is 10x for most perps
      }
    } catch(e) {
      // keep fallback
    }
    if (maxLev < 1) maxLev = 125;
    __NX.state.maxLeverage = maxLev;
    // Cap current leverage if it exceeds new max
    if (__NX.state.leverage > maxLev) {
      __NX.state.leverage = maxLev;
      var _ck = (excId||'') + ':' + sym;
      __NX.state._leverageCache[_ck] = maxLev;
      var lvTxt = document.getElementById('fut-lev-text');
      if (lvTxt) lvTxt.textContent = maxLev + 'x';
    }
    return maxLev;
  }

  // ── Fetch actual leverage from exchange for current (exchange, symbol) ──
  async function _fetchLeverageFromExchange() {
    var excId = __NX.state.exchangeId;
    var cfg = __NX.getFutCfg();
    var keys = __NX.getApiKeys();
    var sym = __NX.state.symbol;
    var exSym = __NX.toExSym(sym, cfg);
    var DEFAULT_LEV = 20;
    var fetched = null;
    try {
      if (excId === 'binance') {
        var r = await __NX.signedFetch(cfg, '/fapi/v1/leverageBracket', { symbol: exSym }, 'GET');
        if (r && Array.isArray(r) && r[0] && r[0].brackets && r[0].brackets[0])
          fetched = parseInt(r[0].brackets[0].initialLeverage);
      } else if (excId === 'bybit') {
        var r = await __NX.signedFetch(cfg, '/v5/position/list', { category: 'linear', symbol: exSym }, 'GET');
        if (r && r.result && r.result.list && r.result.list[0] && r.result.list[0].leverage)
          fetched = parseInt(r.result.list[0].leverage);
      } else if (excId === 'bitget') {
        var r = await __NX.signedFetch(cfg, '/api/v2/mix/account/account', { symbol: exSym, productType: 'USDT-FUTURES', marginCoin: 'USDT' }, 'GET');
        if (r && r.data && r.data.crossedMaxAvailableAmount !== undefined) {
          // leverage in crossedRiskRate or use positions endpoint
          var rp = await __NX.signedFetch(cfg, '/api/v2/mix/position/single-position', { symbol: exSym, productType: 'USDT-FUTURES', marginCoin: 'USDT' }, 'GET');
          if (rp && rp.data && rp.data[0] && rp.data[0].leverage)
            fetched = parseInt(rp.data[0].leverage);
        }
      } else if (excId === 'gateio') {
        var r = await __NX.signedFetch(cfg, '/api/v4/futures/usdt/positions/' + exSym, {}, 'GET');
        if (r && r.leverage) fetched = parseInt(r.leverage);
      } else if (excId === 'htx') {
        // HTX: POST /linear-swap-api/v1/swap_cross_position_info with body
        var r = await __NX.signedFetch(cfg, '/linear-swap-api/v1/swap_cross_position_info', null, 'POST', { contract_code: exSym });
        if (r && r.data && r.data[0] && r.data[0].lever_rate)
          fetched = parseInt(r.data[0].lever_rate);
      } else if (excId === 'bingx') {
        var r = await __NX.signedFetch(cfg, '/openApi/swap/v2/trade/openOrders', { symbol: exSym }, 'GET');
        // BingX: get position for leverage
        var rp = await __NX.signedFetch(cfg, '/openApi/swap/v2/user/positions', { symbol: exSym }, 'GET');
        if (rp && rp.data && rp.data[0] && rp.data[0].leverage)
          fetched = parseInt(rp.data[0].leverage);
      } else if (excId === 'mexc') {
        // MEXC: GET /api/v1/private/account/settings — returns leverage per symbol
        var r = await __NX.signedFetch(cfg, '/api/v1/private/account/risk_limit', { symbol: exSym }, 'GET');
        if (r && r.data && r.data[0] && r.data[0].initLeverage)
          fetched = parseInt(r.data[0].initLeverage);
      } else if (excId === 'kucoin') {
        var r = await __NX.signedFetch(cfg, '/api/v1/position', { symbol: exSym }, 'GET');
        if (r && r.data && r.data.realLeverage)
          fetched = Math.round(r.data.realLeverage);
      } else if (excId === 'bitmart') {
        var r = await __NX.signedFetch(cfg, '/contract/private/position', { symbol: exSym }, 'GET');
        if (r && r.data && r.data.positions && r.data.positions[0] && r.data.positions[0].leverage)
          fetched = parseInt(r.data.positions[0].leverage);
      } else if (excId === 'phemex') {
        var r = await __NX.signedFetch(cfg, '/g-accounts/accountPositions', { currency: 'USDT' }, 'GET');
        if (r && r.data && r.data.positions) {
          var pos = r.data.positions.find(function(p){ return p.symbol === exSym; });
          if (pos && pos.leverageRr) fetched = Math.round(parseFloat(pos.leverageRr));
        }
      } else if (excId === 'digifinex') {
        var r = await __NX.signedFetch(cfg, '/swap/v2/account/positions', { instrument_id: exSym }, 'GET');
        if (r && r.data && r.data[0] && r.data[0].leverage)
          fetched = parseInt(r.data[0].leverage);
      } else if (excId === 'kraken') {
        var r = await __NX.signedFetch(cfg, '/derivatives/api/v3/openpositions', {}, 'GET');
        if (r && r.openPositions) {
          var pos = r.openPositions.find(function(p){ return p.symbol === exSym; });
          if (pos && pos.maxFixedLeverage) fetched = Math.round(pos.maxFixedLeverage);
        }
      }
      // bitfinex, lbank, coinbase: no per-symbol leverage fetch
    } catch(e) {
      // silently fall back to default
    }
    var lev = (fetched && fetched > 0) ? fetched : DEFAULT_LEV;
    // Only update if user hasn't manually set it for this pair yet
    var _cacheKey = (excId || '') + ':' + sym;
    if (__NX.state._leverageCache[_cacheKey] == null) {
      __NX.state.leverage = lev;
      __NX.state._leverageCache[_cacheKey] = lev;
      var lvEl = document.getElementById('fut-leverage-btn');
      if (lvEl) lvEl.setAttribute('data-lev', lev);
      var lvTxt = document.getElementById('fut-lev-text'); if (lvTxt) lvTxt.textContent = lev + 'x';
    }
  }
})((window.__nxp = window.__nxp || {}).mod_fut_futures_engine = window.__nxp.mod_fut_futures_engine || {});
