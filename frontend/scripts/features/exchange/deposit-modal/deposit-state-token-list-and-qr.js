// Deposit modal: networks state, token chips/list, coin meta and QR drawing
// Part of the exchange deposit modal module (split by topic; no logic change).
(function (__NX) {
  __NX._loadExcChains = _loadExcChains;
  __NX._renderTokenChips = _renderTokenChips;
  __NX._updateDepTokenBtn = _updateDepTokenBtn;
  __NX._getDepTokenInfo = _getDepTokenInfo;
  __NX._renderDepTokenList = _renderDepTokenList;
  __NX._drawQR = _drawQR;


  // ── Network definitions per coin symbol ──
  // No hardcoded chains — all data comes from exchange API only
  var DEP_NETS = {}; __NX.DEP_NETS = DEP_NETS;


  var _depState = { sym:'USDT', name:'Tether USD', icon:'₮', iconColor:'#26a17b', addr:'', memo:'', selectedNet: null }; __NX._depState = _depState;
  var _dynChainCache = {}; // excId+sym → chains[], cached per session

  // ── Load chains from exchange API, update network list if different ──
  async function _loadExcChains(sym) {
    var excId = __NX._activeExcId();
    if (!excId) {
      // No exchange connected — show message instead of leaving loading state
      var labelEl = document.getElementById('exc-dep-net-label');
      var subEl   = document.getElementById('exc-dep-net-sub');
      if (labelEl) labelEl.textContent = 'No exchange';
      if (subEl)   subEl.textContent   = 'Connect an exchange first';
      var list = document.getElementById('exc-dep-net-list');
      if (list) list.innerHTML = '<div style="padding:32px 20px;text-align:center;color:#4a4a65;font-size:13px;">Connect an exchange to view supported networks.</div>';
      return;
    }
    var keys = null;
    try {
      if (window.EXC && typeof EXC._getKeys === 'function') keys = EXC._getKeys(excId);
      else { var _ks = JSON.parse(localStorage.getItem('one_exc_keys_v1') || '{}'); keys = _ks[excId] || null; }
    } catch(e) {}
    if (!keys || !keys.apiKey || !keys.secret) {
      // Keys missing — show message
      var labelEl2 = document.getElementById('exc-dep-net-label');
      var subEl2   = document.getElementById('exc-dep-net-sub');
      if (labelEl2) labelEl2.textContent = 'API key required';
      if (subEl2)   subEl2.textContent   = 'Add API key in Settings';
      var list2 = document.getElementById('exc-dep-net-list');
      if (list2) list2.innerHTML = '<div style="padding:32px 20px;text-align:center;color:#4a4a65;font-size:13px;">Add your exchange API key in Settings to load networks.</div>';
      return;
    }

    var cacheKey = excId + ':' + sym;
    // Use cached result if available
    var chains = _dynChainCache[cacheKey] || null;
    if (!chains) {
      // Show loading indicator in network row
      var netLabel = document.getElementById('exc-dep-net-label');
      if (netLabel) netLabel.textContent = 'Loading…';
      try {
        chains = await __NX._fetchExcChains(excId, sym, keys);
      } catch(e) {}
      if (chains && chains.length) _dynChainCache[cacheKey] = chains;
    }

    // Only update if this token is still the active one (user may have switched)
    if (_depState.sym !== sym) return;

    if (chains && chains.length) {
      // Set chains from exchange API — this is the only source, no fallback
      DEP_NETS[sym] = chains;
      // Re-render with first chain selected
      _depState.selectedNet = null;
      __NX._renderNets(sym, null);
      __NX._updateAddrAndQR();
    } else {
      // API returned no chains — show error, do not fall back to hardcoded data
      if (_depState.sym === sym) {
        var errLabel = document.getElementById('exc-dep-net-label');
        var errSub   = document.getElementById('exc-dep-net-sub');
        if (errLabel) errLabel.textContent = 'Unavailable';
        if (errSub)   errSub.textContent   = 'Could not load networks';
        var errList = document.getElementById('exc-dep-net-list');
        if (errList) errList.innerHTML = '<div style="padding:32px 20px;text-align:center;color:#4a4a65;font-size:13px;">Could not fetch networks from exchange. Check API key permissions or try again.</div>';
      }
    }
  }

  // ── Update selected token button UI ──
  function _renderTokenChips(activeSym) {
    // Legacy chip container no longer used — update the selector button instead
    _updateDepTokenBtn(activeSym);
  }

  // ── Update the Select Token button display ──
  function _updateDepTokenBtn(sym) {
    var iconEl = document.getElementById('exc-dep-sel-icon');
    var symEl  = document.getElementById('exc-dep-sel-sym');
    var nameEl = document.getElementById('exc-dep-sel-name');
    var info   = _getDepTokenInfo(sym);
    if (iconEl) { iconEl.textContent = info.icon; iconEl.style.background = info.iconColor; }
    if (symEl)  symEl.textContent  = info.sym;
    if (nameEl) nameEl.textContent = info.name;
  }

  // ── Static fallback info for known coins ──
  var _DEP_COIN_META = {
    'USDT': { icon:'₮',  iconColor:'#26a17b', name:'Tether USD' },
    'USDC': { icon:'$',  iconColor:'#2775ca', name:'USD Coin' },
    'BNB':  { icon:'⬡',  iconColor:'#f3ba2f', name:'BNB' },
    'ETH':  { icon:'Ξ',  iconColor:'#627eea', name:'Ethereum' },
    'BTC':  { icon:'₿',  iconColor:'#f7931a', name:'Bitcoin' },
    'SOL':  { icon:'◎',  iconColor:'#9945ff', name:'Solana' },
    'XRP':  { icon:'✕',  iconColor:'#346aa9', name:'Ripple' },
    'DOGE': { icon:'Ð',  iconColor:'#c2a633', name:'Dogecoin' },
    'TRX':  { icon:'⚡', iconColor:'#e8463a', name:'TRON' },
    'ADA':  { icon:'₳',  iconColor:'#0033ad', name:'Cardano' },
    'AVAX': { icon:'🔺', iconColor:'#e84142', name:'Avalanche' },
    'MATIC':{ icon:'⬡',  iconColor:'#8247e5', name:'Polygon' },
    'DOT':  { icon:'●',  iconColor:'#e6007a', name:'Polkadot' },
    'LTC':  { icon:'Ł',  iconColor:'#bfbbbb', name:'Litecoin' },
    'LINK': { icon:'⬡',  iconColor:'#2a5ada', name:'Chainlink' },
    'UNI':  { icon:'🦄', iconColor:'#ff007a', name:'Uniswap' },
    'ATOM': { icon:'⚛',  iconColor:'#6f4cdb', name:'Cosmos' },
    'SUI':  { icon:'💧', iconColor:'#6fbcf0', name:'Sui' },
    'APT':  { icon:'▲',  iconColor:'#00bfff', name:'Aptos' },
    'TON':  { icon:'💎', iconColor:'#0098ea', name:'TON' },
    'NEAR': { icon:'Ⓝ',  iconColor:'#00c08b', name:'NEAR' },
    'OP':   { icon:'🔴', iconColor:'#ff0420', name:'Optimism' },
    'ARB':  { icon:'🔵', iconColor:'#12aaff', name:'Arbitrum' },
  };

  function _getDepTokenInfo(sym) {
    var meta = _DEP_COIN_META[sym] || {};
    // Try to get logo from EXC logoMap
    var logoUrl = null;
    try {
      if (window.EXC && window.EXC.getState) {
        var st = window.EXC.getState();
        if (st && st.logoMap) logoUrl = st.logoMap[sym] || null;
      }
    } catch(e) {}
    return {
      sym: sym,
      name: meta.name || sym,
      icon: meta.icon || sym.charAt(0),
      iconColor: meta.iconColor || '#6366f1',
      logoUrl: logoUrl
    };
  }

  // ── Build token list from exchange market data ──
  function _getExcTokenList() {
    var markets = [];
    try {
      if (window.EXC && window.EXC.getState) {
        var st = window.EXC.getState();
        if (st && st.markets && st.markets.length) markets = st.markets;
      }
    } catch(e) {}

    if (!markets.length) {
      // Fallback: try marketsCache for active exchange
      try {
        var excId = __NX._activeExcId();
        if (excId) {
          var st2 = window.EXC && window.EXC.getState ? window.EXC.getState() : null;
          if (st2 && st2.marketsCache && st2.marketsCache[excId]) {
            markets = st2.marketsCache[excId];
          }
        }
      } catch(e) {}
    }

    // Extract unique base tokens from all quote pairs
    var seen = {};
    var tokens = [];
    var quotes = ['USDT','USDC','BTC','ETH','BNB','TRX','EUR','TRY','BUSD','DAI','FDUSD'];

    markets.forEach(function(m) {
      if (!m || !m.symbol) return;
      var sym = m.symbol;
      // Try to strip known quote suffixes
      var base = null;
      for (var i = 0; i < quotes.length; i++) {
        if (sym.endsWith(quotes[i]) && sym.length > quotes[i].length) {
          var b = sym.slice(0, -quotes[i].length);
          if (b.length >= 2 && b.length <= 10) { base = b; break; }
        }
      }
      if (!base) return;
      if (seen[base]) return;
      seen[base] = true;
      tokens.push(base);
    });

    // Also include quote tokens themselves if not already in list
    ['USDT','USDC','BTC','ETH','BNB'].forEach(function(q) {
      if (!seen[q]) { seen[q] = true; tokens.push(q); }
    });

    // Sort: known coins first, then alphabetical
    var priority = ['USDT','USDC','BTC','ETH','BNB','SOL','XRP','DOGE','TRX','ADA','AVAX','MATIC','DOT','LTC','LINK','UNI'];
    tokens.sort(function(a, b) {
      var pa = priority.indexOf(a), pb = priority.indexOf(b);
      if (pa !== -1 && pb !== -1) return pa - pb;
      if (pa !== -1) return -1;
      if (pb !== -1) return 1;
      return a.localeCompare(b);
    });

    return tokens;
  }

  function _renderDepTokenList(query) {
    var list = document.getElementById('exc-dep-tok-list');
    if (!list) return;
    var tokens = _getExcTokenList();
    var q = (query || '').toUpperCase().trim();
    if (q) tokens = tokens.filter(function(t) { return t.indexOf(q) !== -1; });

    var logos = {};
    try {
      if (window.EXC && window.EXC.getState) {
        var st = window.EXC.getState();
        if (st && st.logoMap) logos = st.logoMap;
      }
    } catch(e) {}

    if (!tokens.length) {
      list.innerHTML = '<div style="padding:32px 20px;text-align:center;color:#4a4a65;font-size:13px;">No tokens found</div>';
      return;
    }

    var html = '';
    tokens.forEach(function(sym) {
      var info    = _getDepTokenInfo(sym);
      var logoUrl = logos[sym] || null;
      var isActive = sym === _depState.sym;
      var iconHtml = logoUrl
        ? '<img src="' + logoUrl + '" style="width:38px;height:38px;border-radius:50%;object-fit:cover;" onerror="this.style.display=\'none\';this.nextSibling.style.display=\'flex\';" />' +
          '<div style="display:none;width:38px;height:38px;border-radius:50%;background:' + info.iconColor + ';align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff;">' + info.icon + '</div>'
        : '<div style="width:38px;height:38px;border-radius:50%;background:' + info.iconColor + ';display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff;">' + info.icon + '</div>';
      html += '<div onclick="excDepTokenSelect(\'' + sym + '\')" style="display:flex;align-items:center;gap:12px;padding:12px 20px;cursor:pointer;-webkit-tap-highlight-color:transparent;background:' + (isActive ? 'rgba(99,102,241,0.1)' : 'transparent') + ';">' +
        '<div style="position:relative;flex-shrink:0;display:flex;">' + iconHtml + '</div>' +
        '<div style="flex:1;">' +
          '<div style="font-size:15px;font-weight:' + (isActive ? '700' : '600') + ';color:' + (isActive ? '#a5b4fc' : '#f1f1f8') + ';">' + sym + '</div>' +
          '<div style="font-size:12px;color:#8b8ba7;margin-top:1px;">' + info.name + '</div>' +
        '</div>' +
        (isActive ? '<span class="material-icons-round" style="font-size:18px;color:#6366f1;">check_circle</span>' : '') +
      '</div>';
    });
    list.innerHTML = html;
  }

  // ── QR code generator ──
  var _depQRInstance = null;
  function _drawQR(divId, text) {
    var el = document.getElementById(divId);
    if (!el) return;
    el.innerHTML = '';
    _depQRInstance = null;
    // Ensure el has explicit size
    el.style.width  = '196px';
    el.style.height = '196px';
    if (!window.QRCode) {
      el.style.cssText = 'width:196px;height:196px;display:flex;align-items:center;justify-content:center;padding:8px;box-sizing:border-box;';
      el.innerHTML = '<div style="font-size:9px;color:#555;word-break:break-all;text-align:center;font-family:monospace;line-height:1.4;">'+text+'</div>';
      return;
    }
    try {
      _depQRInstance = new QRCode(el, { text: text, width: 196, height: 196, colorDark: '#000000', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
    } catch(e) {
      el.innerHTML = '<div style="font-size:9px;color:#555;word-break:break-all;text-align:center;font-family:monospace;padding:8px;line-height:1.4;">'+text+'</div>';
    }
  }
})((window.__nxp = window.__nxp || {}).mod_deposit_modal = window.__nxp.mod_deposit_modal || {});
