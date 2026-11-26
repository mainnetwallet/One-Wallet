// Withdraw modal: token meta/selector, network chips and list, footer, unsupported banner
// Part of the exchange withdraw modal module (split by topic; no logic change).
(function (__NX) {
  __NX._wdTokenMeta = _wdTokenMeta;
  __NX._wdUpdateSelBtn = _wdUpdateSelBtn;
  __NX._wdRenderChips = _wdRenderChips;
  __NX._wdLoadNets = _wdLoadNets;
  __NX._wdResetAmount = _wdResetAmount;
  __NX._wdUpdateFooter = _wdUpdateFooter;
  __NX._wdSetUnsupportedBanner = _wdSetUnsupportedBanner;


  // ══════════════════════════════════════════════════════
  // ── UI render functions ──
  // ══════════════════════════════════════════════════════

  // ── Token meta lookup for chips display ──
  var _WD_TOKEN_META = {
    'USDT': { name:'Tether USD',     icon:'₮',  iconColor:'#26a17b' },
    'USDC': { name:'USD Coin',       icon:'$',  iconColor:'#2775ca' },
    'BUSD': { name:'Binance USD',    icon:'$',  iconColor:'#f3ba2f' },
    'BNB':  { name:'BNB',            icon:'⬡', iconColor:'#f3ba2f' },
    'ETH':  { name:'Ethereum',       icon:'Ξ',  iconColor:'#627eea' },
    'BTC':  { name:'Bitcoin',        icon:'₿',  iconColor:'#f7931a' },
    'SOL':  { name:'Solana',         icon:'◎',  iconColor:'#9945ff' },
    'XRP':  { name:'XRP',            icon:'✕',  iconColor:'#346aa9' },
    'TRX':  { name:'TRON',           icon:'T',  iconColor:'#eb0029' },
    'TON':  { name:'Toncoin',        icon:'◈',  iconColor:'#0098ea' },
    'DOGE': { name:'Dogecoin',       icon:'Ð',  iconColor:'#c2a633' },
    'ADA':  { name:'Cardano',        icon:'₳',  iconColor:'#0033ad' },
    'AVAX': { name:'Avalanche',      icon:'A',  iconColor:'#e84142' },
    'DOT':  { name:'Polkadot',       icon:'●',  iconColor:'#e6007a' },
    'MATIC':{ name:'Polygon',        icon:'M',  iconColor:'#8247e5' },
    'POL':  { name:'Polygon',        icon:'M',  iconColor:'#8247e5' },
    'LTC':  { name:'Litecoin',       icon:'Ł',  iconColor:'#bfbbbb' },
    'LINK': { name:'Chainlink',      icon:'⬡', iconColor:'#2a5ada' },
    'SHIB': { name:'Shiba Inu',      icon:'🐕', iconColor:'#e07222' },
    'UNI':  { name:'Uniswap',        icon:'🦄', iconColor:'#ff007a' },
    'OP':   { name:'Optimism',       icon:'●',  iconColor:'#ff0420' },
    'ARB':  { name:'Arbitrum',       icon:'A',  iconColor:'#28a0f0' },
  };

  function _wdTokenMeta(sym) {
    var m = _WD_TOKEN_META[sym];
    if (m) return { sym:sym, name:m.name, icon:m.icon, iconColor:m.iconColor };
    // Generic fallback — use first 2–3 chars as icon, grey color
    return { sym:sym, name:sym, icon:sym.slice(0,3), iconColor:'#8b8ba7' };
  }

  // ── Withdraw token modal state ──
  __NX._wdTokAssets = []; // [{sym, bal}] sorted: bal>0 first
  __NX._wdTokLoading = false;

  function _wdUpdateSelBtn(sym) {
    var t = _wdTokenMeta(sym);
    var iconEl = document.getElementById('exc-wd-sel-icon');
    var symEl2 = document.getElementById('exc-wd-sel-sym');
    var nameEl = document.getElementById('exc-wd-sel-name');
    if (iconEl) { iconEl.textContent = t.icon; iconEl.style.background = t.iconColor; }
    if (symEl2) symEl2.textContent = t.sym;
    if (nameEl) nameEl.textContent = t.name;
  }

  // legacy compat — keep _wdBuildChips/RenderChips stubs so old call-sites don't break
  function _wdBuildChips(assets, activeSym) {
    var symsInList = (assets||[]).map(function(a){ return a.sym || a.asset || a; });
    if (symsInList.indexOf(activeSym) === -1) {
      activeSym = symsInList.indexOf('USDT') !== -1 ? 'USDT' : (symsInList[0] || 'USDT');
      var t0 = _wdTokenMeta(activeSym);
      __NX._wdState.sym = t0.sym; __NX._wdState.name = t0.name; __NX._wdState.icon = t0.icon; __NX._wdState.iconColor = t0.iconColor;
    }
    _wdUpdateSelBtn(activeSym);
    var symEl = document.getElementById('exc-wd-coin-sym'); if (symEl) symEl.textContent = activeSym;
    var warnEl = document.getElementById('exc-wd-warn-sym'); if (warnEl) warnEl.textContent = activeSym;
    return activeSym;
  }
  function _wdRenderChips(activeSym) {
    // no-op: chips replaced by modal button; just sync the button label
    var t = _wdTokenMeta(activeSym || __NX._wdState.sym);
    _wdUpdateSelBtn(t.sym);
  }

  function _wdSetNetRow(label, sub) {
    var l = document.getElementById('exc-wd-net-label'); if (l) l.textContent = label;
    var s = document.getElementById('exc-wd-net-sub');   if (s) s.textContent = sub;
  }
  function _wdRenderNetRow(net) {
    if (!net) return;
    var l = document.getElementById('exc-wd-net-label'); if (l) l.textContent = net.label;
    var s = document.getElementById('exc-wd-net-sub');   if (s) s.textContent = net.label + ' (' + net.sub + ')';
  }

  function _wdRenderNetList(sym, nets) {
    var list = document.getElementById('exc-wd-net-list'); if (!list) return;
    list.innerHTML = '';
    nets.forEach(function(n) {
      var isActive = __NX._wdState.selectedNet && n.key === __NX._wdState.selectedNet.key;
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:14px 20px;cursor:pointer;-webkit-tap-highlight-color:transparent;' + (isActive ? 'background:rgba(99,102,241,0.07);' : '');
      row.innerHTML =
        '<div style="display:flex;align-items:center;gap:12px;">' +
          '<div style="width:36px;height:36px;border-radius:50%;background:' + n.color + ';display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;">' + n.icon + '</div>' +
          '<div>' +
            '<div style="font-size:14px;font-weight:' + (isActive?'700':'500') + ';color:' + (isActive?'#f1f1f8':'#8b8ba7') + ';">' + n.label + '</div>' +
            '<div style="font-size:11px;color:#4a4a65;margin-top:2px;">' + n.sub + '</div>' +
          '</div>' +
        '</div>' +
        '<div style="width:20px;height:20px;border-radius:50%;border:2px solid ' + (isActive ? n.color : 'rgba(255,255,255,0.12)') + ';display:flex;align-items:center;justify-content:center;">' +
          (isActive ? '<div style="width:10px;height:10px;border-radius:50%;background:' + n.color + ';"></div>' : '') +
        '</div>';
      row.onclick = async function() {
        __NX._wdState.selectedNet = n;
        _wdRenderNetRow(n);
        _wdRenderNetList(sym, nets);
        window.excWdNetModalClose(null, true);
        __NX._wdState.fee = null;
        _wdUpdateFooter();
        var excId = __NX._activeExcId();
        if (excId) { var keys = __NX._getKeys(excId); if (keys) await _wdFetchFeeUI(excId, keys); }
      };
      list.appendChild(row);
    });
  }

  async function _wdLoadNets(sym) {
    var symEl = document.getElementById('exc-wd-coin-sym'); if (symEl) symEl.textContent = sym;
    var warnEl = document.getElementById('exc-wd-warn-sym'); if (warnEl) warnEl.textContent = sym;
    _wdSetNetRow('Loading…', 'Fetching networks…');
    var wnl = document.getElementById('exc-wd-net-list'); if (wnl) wnl.innerHTML = '<div style="padding:32px 20px;text-align:center;color:#4a4a65;font-size:13px;">Loading networks…</div>';

    var excId = __NX._activeExcId();
    if (!excId) { _wdSetNetRow('No exchange', 'Connect an exchange first'); return; }
    var keys = __NX._getKeys(excId);
    if (!keys || !keys.apiKey || !keys.secret) { _wdSetNetRow('API key required', 'Add API key in Settings'); return; }

    var cacheKey = excId + ':' + sym;
    var nets = __NX._wdChainCache[cacheKey] || null;
    if (!nets) {
      try { nets = await window._fetchExcChainsForWithdraw(excId, sym, keys); } catch(e) {}
      if (nets && nets.length) __NX._wdChainCache[cacheKey] = nets;
    }
    if (!nets || !nets.length) { _wdSetNetRow('Unavailable', 'Could not load networks'); return; }

    if (typeof DEP_NETS !== 'undefined') DEP_NETS[sym] = nets;
    __NX._wdState.selectedNet = nets[0];
    _wdRenderNetRow(nets[0]);
    _wdRenderNetList(sym, nets);
    _wdFetchBalanceUI(excId, sym, keys);
    _wdFetchFeeUI(excId, keys);
  }

  async function _wdFetchBalanceUI(excId, sym, keys) {
    var balEl = document.getElementById('exc-wd-available');
    if (balEl) balEl.textContent = 'Available: loading…';
    __NX._wdState.balance = null;
    try { __NX._wdState.balance = await __NX._wdBalance(excId, sym, keys); } catch(e) {}
    if (balEl) {
      if (__NX._wdState.balance !== null) {
        var balStr = __NX._wdState.balance.toFixed(8).replace(/\.?0+$/, '') + ' ' + __NX._wdState.sym;
        // Binance: show Spot + Funding breakdown
        if (excId === 'binance' && window._wdBinanceBal) {
          var b = window._wdBinanceBal;
          if (b.spot > 0 || b.funding > 0) {
            balStr += ' (Spot: ' + b.spot.toFixed(4).replace(/\.?0+$/,'') + ' + Funding: ' + b.funding.toFixed(4).replace(/\.?0+$/,'') + ')';
          }
        }
        balEl.textContent = 'Available: ' + balStr;
      } else {
        balEl.textContent = 'Available: —';
      }
    }
    _wdUpdateFooter();
  }

  async function _wdFetchFeeUI(excId, keys) {
    __NX._wdState.fee = null;
    var net = __NX._wdState.selectedNet;
    if (!net) return;
    try { __NX._wdState.fee = await __NX._wdFee(excId, __NX._wdState.sym, net, keys); } catch(e) {}
    _wdUpdateFooter();
  }

  function _wdResetAmount() {
    var inp = document.getElementById('exc-wd-amount-inp'); if (inp) inp.value = '';
    __NX._wdState.amount = '';
    _wdUpdateFooter();
  }

  function _wdUpdateFooter() {
    var amt = parseFloat((document.getElementById('exc-wd-amount-inp')||{}).value||'0')||0;
    var fee = __NX._wdState.fee !== null ? __NX._wdState.fee : 0;
    var receive = Math.max(0, amt - fee);

    var feeEl = document.getElementById('exc-wd-fee-val');
    var rcvEl = document.getElementById('exc-wd-receive-val');
    var symTxt = __NX._wdState.sym;
    if (feeEl) feeEl.textContent = __NX._wdState.fee !== null ? (fee > 0 ? fee.toFixed(8).replace(/\.?0+$/,'') + ' ' + symTxt : 'Free') : '—';
    if (rcvEl) rcvEl.textContent = amt > 0 ? receive.toFixed(8).replace(/\.?0+$/,'') + ' ' + symTxt : '0 ' + symTxt;

    var btn = document.getElementById('exc-wd-btn');
    if (!btn) return;
    var addr = ((document.getElementById('exc-wd-addr-inp')||{}).value||'').trim();
    var bal = __NX._wdState.balance;
    var canWithdraw = addr.length > 10 && amt > 0 && __NX._wdState.selectedNet && (bal === null || amt <= bal);
    btn.style.opacity = canWithdraw ? '1' : '0.45';
    btn.style.cursor  = canWithdraw ? 'pointer' : 'not-allowed';
    btn.disabled = !canWithdraw;
  }

  // Exchanges that do NOT support crypto withdrawal via API
  var _WD_NO_SUPPORT = {
  }; __NX._WD_NO_SUPPORT = _WD_NO_SUPPORT;

  function _wdSetUnsupportedBanner(msg) {
    var banner = document.getElementById('exc-wd-unsupported-banner');
    var body   = document.getElementById('exc-wd-body');
    var footer = document.getElementById('exc-wd-footer');
    if (msg) {
      var bannerMsg = document.getElementById('exc-wd-unsupported-msg');
      if (bannerMsg) bannerMsg.textContent = msg;
      if (banner) banner.style.display = 'flex';
      if (body)   body.style.display   = 'none';
      if (footer) footer.style.display = 'none';
    } else {
      if (banner) banner.style.display = 'none';
      if (body)   body.style.display   = '';
      if (footer) footer.style.display = '';
    }
  }
})((window.__nxp = window.__nxp || {}).mod_withdraw_modal = window.__nxp.mod_withdraw_modal || {});
