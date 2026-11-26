
// ══════════════════════════════════════════════════════
// ══ Exchange Withdraw Modal JS ══
// ══════════════════════════════════════════════════════
(function() {
  var __NX = window.__nxp.mod_withdraw_modal; delete window.__nxp.mod_withdraw_modal;


  window._renderWdTokList = function(query) {
    var list = document.getElementById('exc-wd-tok-list'); if (!list) return;
    var q = (query || '').toUpperCase().trim();
    var items = __NX._wdTokAssets;
    if (q) items = items.filter(function(a){ return a.sym.indexOf(q) !== -1; });

    if (__NX._wdTokLoading) {
      list.innerHTML = '<div style="padding:32px 20px;text-align:center;"><div style="font-size:13px;color:#4a4a65;">Loading tokens…</div></div>';
      return;
    }
    if (!items.length) {
      list.innerHTML = '<div style="padding:32px 20px;text-align:center;font-size:13px;color:#4a4a65;">No tokens found</div>';
      return;
    }

    var logos = {};
    try { if (window.EXC && window.EXC.getState) { var st = window.EXC.getState(); if (st && st.logoMap) logos = st.logoMap; } } catch(e) {}

    var html = '';
    // Section: with balance
    var withBal = items.filter(function(a){ return a.bal > 0; });
    var zeroBal = items.filter(function(a){ return a.bal <= 0; });

    if (withBal.length && zeroBal.length) {
      html += '<div style="padding:8px 20px 4px;font-size:10px;color:#4a4a65;letter-spacing:0.8px;text-transform:uppercase;">With Balance</div>';
    }
    withBal.concat(zeroBal.length && withBal.length ? [null] : []).concat(zeroBal).forEach(function(a) {
      if (!a) {
        // divider
        html += '<div style="padding:8px 20px 4px;margin-top:4px;font-size:10px;color:#4a4a65;letter-spacing:0.8px;text-transform:uppercase;border-top:1px solid rgba(255,255,255,0.04);">Zero Balance</div>';
        return;
      }
      var t = __NX._wdTokenMeta(a.sym);
      var isActive = a.sym === __NX._wdState.sym;
      var logoUrl = logos[a.sym] || null;
      var iconHtml = logoUrl
        ? '<img src="' + logoUrl + '" style="width:38px;height:38px;border-radius:50%;object-fit:cover;" onerror="this.style.display=\'none\';this.nextSibling.style.display=\'flex\';" />' +
          '<div style="display:none;width:38px;height:38px;border-radius:50%;background:' + t.iconColor + ';align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff;">' + t.icon + '</div>'
        : '<div style="width:38px;height:38px;border-radius:50%;background:' + t.iconColor + ';display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff;">' + t.icon + '</div>';
      var balStr = a.bal > 0 ? '<div style="font-size:12px;font-weight:600;color:#f59e0b;">' + (a.bal < 0.0001 ? a.bal.toExponential(2) : a.bal.toFixed(a.bal < 1 ? 6 : 4)) + ' ' + a.sym + '</div>' : '<div style="font-size:12px;color:#4a4a65;">0</div>';
      html += '<div onclick="excWdTokSelect(\'' + a.sym + '\')" style="display:flex;align-items:center;gap:12px;padding:12px 20px;cursor:pointer;-webkit-tap-highlight-color:transparent;background:' + (isActive ? 'rgba(245,158,11,0.08)' : 'transparent') + ';">' +
        '<div style="position:relative;flex-shrink:0;display:flex;">' + iconHtml + '</div>' +
        '<div style="flex:1;">' +
          '<div style="font-size:15px;font-weight:' + (isActive ? '700' : '600') + ';color:' + (isActive ? '#fcd34d' : '#f1f1f8') + ';">' + a.sym + '</div>' +
          '<div style="font-size:12px;color:#8b8ba7;margin-top:1px;">' + t.name + '</div>' +
        '</div>' +
        '<div style="text-align:right;">' + balStr + '</div>' +
        (isActive ? '<span class="material-icons-round" style="font-size:18px;color:#f59e0b;margin-left:4px;">check_circle</span>' : '') +
      '</div>';
    });
    list.innerHTML = html;
  };

  window.excWdTokSelect = function(sym) {
    var t = __NX._wdTokenMeta(sym);
    __NX._wdState.sym = t.sym; __NX._wdState.name = t.name; __NX._wdState.icon = t.icon; __NX._wdState.iconColor = t.iconColor;
    __NX._wdState.selectedNet = null; __NX._wdState.balance = null; __NX._wdState.fee = null;
    __NX._wdUpdateSelBtn(sym);
    var symEl = document.getElementById('exc-wd-coin-sym'); if (symEl) symEl.textContent = sym;
    var warnEl = document.getElementById('exc-wd-warn-sym'); if (warnEl) warnEl.textContent = sym;
    excWdTokModalClose(null, true);
    __NX._wdLoadNets(sym);
    __NX._wdResetAmount();
  };

  window.excWdTokModalOpen = function() {
    var ov = document.getElementById('exc-wd-tok-overlay');
    var sh = document.getElementById('exc-wd-tok-sheet');
    if (!ov || !sh) return;
    var si = document.getElementById('exc-wd-tok-search'); if (si) si.value = '';
    var excId = __NX._activeExcId();
    // Set exchange label
    var lbl = document.getElementById('exc-wd-tok-exch-label');
    if (lbl && excId) {
      var exchName = excId.charAt(0).toUpperCase() + excId.slice(1);
      try { if (window.EXC && window.EXC.getExchange) { var ex = window.EXC.getExchange(excId); if (ex && ex.name) exchName = ex.name; } } catch(e) {}
      lbl.textContent = exchName;
    }
    // Load assets with balances
    __NX._wdTokLoading = true;
    __NX._wdTokAssets = [];
    _renderWdTokList('');
    ov.style.display = 'block';
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ sh.style.transform = 'translateY(0)'; }); });

    // Fetch assets + balances async
    var keys = excId ? __NX._getKeys(excId) : null;
    var excObj = excId && window.EXC && typeof window.EXC.getExchange === 'function' ? window.EXC.getExchange(excId) : null;
    var cache = window.EXC && typeof window.EXC.portfolioCache === 'function' ? window.EXC.portfolioCache() : null;
    var cachedAssets = cache && cache[excId] && cache[excId].assets ? cache[excId].assets : null;

    function _buildTokAssetsWithBal(assetList, balMap) {
      var result = assetList.map(function(a) {
        var s = a.asset || a.sym || a;
        var bal = balMap && balMap[s] != null ? balMap[s] : (a.free != null ? parseFloat(a.free)||0 : (a.balance != null ? parseFloat(a.balance)||0 : 0));
        return { sym: s, bal: bal };
      });
      // sort: bal desc, then alpha
      result.sort(function(a, b) {
        if (b.bal !== a.bal) return b.bal - a.bal;
        return a.sym < b.sym ? -1 : 1;
      });
      return result;
    }

    function _finishLoad(assetList, balMap) {
      __NX._wdTokLoading = false;
      __NX._wdTokAssets = _buildTokAssetsWithBal(assetList, balMap);
      // Show total exchange balance summary
      var totalNonZero = __NX._wdTokAssets.filter(function(a){ return a.bal > 0; }).length;
      var sumEl = document.getElementById('exc-wd-tok-bal-summary');
      var valEl = document.getElementById('exc-wd-tok-bal-val');
      if (sumEl && valEl && totalNonZero > 0) {
        valEl.textContent = totalNonZero + ' token' + (totalNonZero !== 1 ? 's' : '') + ' with balance';
        sumEl.style.display = 'block';
      } else if (sumEl) { sumEl.style.display = 'none'; }
      var srch = document.getElementById('exc-wd-tok-search');
      _renderWdTokList(srch ? srch.value : '');
    }

    if (cachedAssets && cachedAssets.length) {
      // Build balance map from cached portfolio
      var balMap2 = {};
      cachedAssets.forEach(function(a){ 
        var s = a.asset || a.sym || a;
        balMap2[s] = a.free != null ? parseFloat(a.free)||0 : 0;
      });
      // Merge: all market tokens + portfolio tokens (union)
      var allTokens = _getExcTokenList();
      cachedAssets.forEach(function(a){
        var s = a.asset || a.sym || a;
        if (allTokens.indexOf(s) === -1) allTokens.push(s);
      });
      _finishLoad(allTokens.map(function(s){ return {asset:s}; }), balMap2);
    } else if (excObj && keys && typeof window.EXC.fetchAssets === 'function') {
      window.EXC.fetchAssets(excObj, keys).then(function(result) {
        var balMap3 = {};
        if (result && result.assets) {
          result.assets.forEach(function(a){ 
            var s = a.asset || a.sym || a;
            balMap3[s] = a.free != null ? parseFloat(a.free)||0 : 0;
          });
        }
        // Full token list from market
        var allToks = _getExcTokenList();
        if (result && result.assets) {
          result.assets.forEach(function(a){
            var s = a.asset || a.sym || a;
            if (allToks.indexOf(s) === -1) allToks.push(s);
          });
        }
        if (allToks.length) {
          _finishLoad(allToks.map(function(s){ return {asset:s}; }), balMap3);
        } else { __NX._wdTokLoading = false; __NX._wdTokAssets = [{sym:'USDT',bal:0}]; _renderWdTokList(''); }
      }).catch(function() {
        // fallback: at least show market tokens without balance
        var fallbackToks = _getExcTokenList();
        if (fallbackToks.length) {
          _finishLoad(fallbackToks.map(function(s){ return {asset:s}; }), {});
        } else {
          __NX._wdTokLoading = false; __NX._wdTokAssets = [{sym:'USDT',bal:0}]; _renderWdTokList('');
        }
      });
    } else {
      // No keys — still show market tokens
      var mkToks = _getExcTokenList();
      if (mkToks.length) {
        _finishLoad(mkToks.map(function(s){ return {asset:s}; }), {});
      } else {
        __NX._wdTokLoading = false;
        __NX._wdTokAssets = [{sym:'USDT',bal:0}];
        _renderWdTokList('');
      }
    }
  };

  window.excWdTokModalClose = function(e, force) {
    if (!force && e && e.target !== document.getElementById('exc-wd-tok-overlay')) return;
    var ov = document.getElementById('exc-wd-tok-overlay');
    var sh = document.getElementById('exc-wd-tok-sheet');
    if (!sh) return;
    sh.style.transform = 'translateY(100%)';
    setTimeout(function(){ if (ov) ov.style.display = 'none'; }, 300);
  };

  // ── Public API ──
  window.excWdMax = function() {
    var bal = __NX._wdState.balance;
    if (bal === null || bal <= 0) { if (typeof showToast==='function') showToast('Balance unavailable'); return; }
    var fee = __NX._wdState.fee || 0;
    var maxAmt = Math.max(0, bal - fee);
    var inp = document.getElementById('exc-wd-amount-inp');
    if (inp) inp.value = maxAmt.toFixed(8).replace(/\.?0+$/,'');
    __NX._wdUpdateFooter();
  };

  window.excWdPasteAddr = async function() {
    try {
      var text = await navigator.clipboard.readText();
      var inp = document.getElementById('exc-wd-addr-inp');
      if (inp && text) { inp.value = text.trim(); __NX._wdUpdateFooter(); if (typeof showToast==='function') showToast('Address pasted'); }
    } catch(e) { if (typeof showToast==='function') showToast('Long press the field to paste'); }
  };

  window.excWdAddrBook = function() {
    if (typeof showToast==='function') showToast('Address book — coming soon');
  };

  window.excWdNetModalOpen = function() {
    var ov = document.getElementById('exc-wd-net-overlay'), sh = document.getElementById('exc-wd-net-sheet');
    if (!ov || !sh) return;
    ov.style.display = 'block';
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ sh.style.transform = 'translateY(0)'; }); });
  };
  window.excWdNetModalClose = function(e, force) {
    if (!force && e && e.target !== document.getElementById('exc-wd-net-overlay')) return;
    var ov = document.getElementById('exc-wd-net-overlay'), sh = document.getElementById('exc-wd-net-sheet');
    if (!sh) return;
    sh.style.transform = 'translateY(100%)';
    setTimeout(function(){ if (ov) ov.style.display = 'none'; }, 280);
  };

  window.excWdUpdateFooter = __NX._wdUpdateFooter;

  window.excWdSubmit = async function() {
    var btn = document.getElementById('exc-wd-btn');
    if (btn && btn.disabled) return;
    var addr = ((document.getElementById('exc-wd-addr-inp')||{}).value||'').trim();
    var amt  = parseFloat((document.getElementById('exc-wd-amount-inp')||{}).value||'0')||0;
    var net  = __NX._wdState.selectedNet;
    if (!addr || !amt || !net) { if (typeof showToast==='function') showToast('Fill in address and amount'); return; }
    var excId = __NX._activeExcId();
    if (!excId) { if (typeof showToast==='function') showToast('No exchange connected'); return; }
    var keys = __NX._getKeys(excId);
    if (!keys) { if (typeof showToast==='function') showToast('API key required'); return; }
    var bal = __NX._wdState.balance;
    if (bal !== null && amt > bal) { if (typeof showToast==='function') showToast('Amount exceeds available balance'); return; }

    if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; btn.style.opacity = '0.6'; }
    try {
      var result = await __NX._wdSubmitExc(excId, __NX._wdState.sym, addr, amt, net, keys);
      if (typeof showToast==='function') showToast('✅ Withdraw submitted! ID: ' + result.id);
      window.excWithdrawClose(null, true);
    } catch(e) {
      if (typeof showToast==='function') showToast('❌ ' + (e.message||'Withdraw failed'));
    } finally {
      if (btn) { btn.textContent = 'Withdraw'; __NX._wdUpdateFooter(); }
    }
  };

  window.excWithdrawOpen = function(opts) {
    opts = opts || {};
    __NX._wdState.sym       = opts.sym       || 'USDT';
    __NX._wdState.name      = opts.name      || 'Tether USD';
    __NX._wdState.icon      = opts.icon      || '₮';
    __NX._wdState.iconColor = opts.iconColor || '#26a17b';
    __NX._wdState.selectedNet = null; __NX._wdState.balance = null; __NX._wdState.fee = null;

    var symEl = document.getElementById('exc-wd-coin-sym'); if (symEl) symEl.textContent = __NX._wdState.sym;
    var warnEl = document.getElementById('exc-wd-warn-sym'); if (warnEl) warnEl.textContent = __NX._wdState.sym;
    var addrInp = document.getElementById('exc-wd-addr-inp'); if (addrInp) addrInp.value = '';
    var amtInp  = document.getElementById('exc-wd-amount-inp'); if (amtInp) amtInp.value = '';
    var balEl   = document.getElementById('exc-wd-available'); if (balEl) balEl.textContent = 'Available: loading…';

    // Sync selector button
    __NX._wdUpdateSelBtn(__NX._wdState.sym);

    // Check exchange support
    var excId = __NX._activeExcId();
    var noSupportMsg = excId && __NX._WD_NO_SUPPORT[excId] ? __NX._WD_NO_SUPPORT[excId] : null;
    __NX._wdSetUnsupportedBanner(noSupportMsg);

    if (!noSupportMsg) {
      __NX._wdRenderChips(__NX._wdState.sym);
      __NX._wdLoadNets(__NX._wdState.sym);
      __NX._wdUpdateFooter();
    }

    var ov = document.getElementById('exc-withdraw-overlay'), sh = document.getElementById('exc-withdraw-sheet');
    if (ov && sh) {
      ov.style.display = 'block';
      requestAnimationFrame(function(){ requestAnimationFrame(function(){ sh.style.transform = 'translateY(0)'; }); });
    }
  };

  window.excWithdrawClose = function(e, force) {
    if (!force && e && e.target !== document.getElementById('exc-withdraw-overlay')) return;
    var ov = document.getElementById('exc-withdraw-overlay'), sh = document.getElementById('exc-withdraw-sheet');
    if (!sh) return;
    sh.style.transform = 'translateY(100%)';
    setTimeout(function(){ if (ov) ov.style.display = 'none'; }, 320);
  };

})();
