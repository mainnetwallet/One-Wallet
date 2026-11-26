// Deposit modal: address/memo rendering, network selector, QR update, close and copy fallback
// Part of the exchange deposit modal module (split by topic; no logic change).
(function (__NX) {
  __NX._setAddrLoading = _setAddrLoading;
  __NX._activeExcId = _activeExcId;
  __NX._renderNets = _renderNets;
  __NX._updateAddrAndQR = _updateAddrAndQR;
  __NX._doClose = _doClose;
  __NX._fallbackCopy = _fallbackCopy;


  // ── Address display helpers ──
  function _setAddrLoading() {
    var addrEl = document.getElementById('exc-dep-addr-text');
    if (addrEl) { addrEl.textContent = 'Fetching address…'; addrEl.style.color = '#4a4a65'; }
    var _qrEl = document.getElementById('exc-dep-qr');
    if (_qrEl) _qrEl.innerHTML = '<div style="width:196px;height:196px;display:flex;align-items:center;justify-content:center;"><span style="font-size:12px;color:#4a4a65;font-family:monospace;">Loading…</span></div>';
    // Hide memo row while fetching — will re-show if new address has memo
    var memoRow = document.getElementById('exc-dep-memo-row');
    var memoWarn = document.getElementById('exc-dep-memo-warn');
    if (memoRow) memoRow.style.display = 'none';
    if (memoWarn) memoWarn.style.display = 'none';
  }

  function _setAddrAndMemo(addr, memo) {
    __NX._depState.addr = addr || '';
    __NX._depState.memo = memo || '';
    var addrEl = document.getElementById('exc-dep-addr-text');
    if (addrEl) {
      addrEl.style.color = addr ? '#f59e0b' : '#4a4a65';
      addrEl.textContent = addr || 'No address available';
    }
    // Memo/Tag row
    var memoRow = document.getElementById('exc-dep-memo-row');
    var memoVal = document.getElementById('exc-dep-memo-val');
    var memoWarn = document.getElementById('exc-dep-memo-warn');
    if (memoRow && memoVal) {
      if (memo) {
        memoVal.textContent = memo;
        memoRow.style.display = 'block';
        if (memoWarn) memoWarn.style.display = 'block';
      } else {
        memoRow.style.display = 'none';
        if (memoWarn) memoWarn.style.display = 'none';
      }
    }
    if (addr) {
      __NX._drawQR('exc-dep-qr', addr);
    } else {
      var _qrEl = document.getElementById('exc-dep-qr');
      if (_qrEl) _qrEl.innerHTML = '<div style="width:196px;height:196px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;"><span style="font-size:28px;">🔐</span><span style="font-size:11px;color:#4a4a65;font-family:monospace;">No address</span></div>';
    }
  }

  // ── Get active exchange id ──
  function _activeExcId() {
    try { return window.EXC && EXC.getState ? EXC.getState().activeExchange : null; } catch(e){}
    return null;
  }

  // ── Render networks ──
  function _renderNets(sym, selectedKey) {
    var nets = __NX.DEP_NETS[sym];
    // No chains yet — show loading state, do not fall back to hardcoded data
    if (!nets || !nets.length) {
      var labelEl = document.getElementById('exc-dep-net-label');
      var subEl   = document.getElementById('exc-dep-net-sub');
      if (labelEl) labelEl.textContent = 'Loading…';
      if (subEl)   subEl.textContent   = 'Fetching networks…';
      var contRow = document.getElementById('exc-dep-contract-row');
      if (contRow) contRow.style.display = 'none';
      var list = document.getElementById('exc-dep-net-list');
      if (list) list.innerHTML = '<div style="padding:32px 20px;text-align:center;color:#4a4a65;font-size:13px;">Loading networks from exchange…</div>';
      __NX._depState.selectedNet = null;
      return;
    }
    // Default: API's first chain, or restore previously selected
    if (!selectedKey) {
      selectedKey = nets[0].apiCode;
    }
    __NX._depState.selectedNet = nets.find(function(n){return n.apiCode===selectedKey;}) || nets[0];

    // Update single selected row in main sheet
    var net = __NX._depState.selectedNet;
    var labelEl = document.getElementById('exc-dep-net-label');
    var subEl   = document.getElementById('exc-dep-net-sub');
    if (labelEl) labelEl.textContent = net.label;
    if (subEl)   subEl.textContent   = net.label + ' (' + net.sub + ')';

    // Contract row
    var contRow = document.getElementById('exc-dep-contract-row');
    var contVal = document.getElementById('exc-dep-contract-val');
    if (contRow && contVal) {
      if (net.contract) {
        contVal.textContent = '***' + net.contract.slice(-5);
        contRow.style.display = 'block';
      } else {
        contRow.style.display = 'none';
      }
    }

    // Render modal list
    var list = document.getElementById('exc-dep-net-list');
    if (!list) return;
    list.innerHTML = '';
    nets.forEach(function(n) {
      var isActive = n.apiCode === __NX._depState.selectedNet.apiCode;
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:14px 20px;cursor:pointer;-webkit-tap-highlight-color:transparent;' + (isActive ? 'background:rgba(99,102,241,0.07);' : '');
      row.innerHTML =
        '<div style="display:flex;align-items:center;gap:12px;">' +
          '<div style="width:36px;height:36px;border-radius:50%;background:' + n.color + ';display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;">' + n.icon + '</div>' +
          '<div>' +
            '<div style="font-size:14px;font-weight:' + (isActive ? '700' : '500') + ';color:' + (isActive ? '#f1f1f8' : '#8b8ba7') + ';">' + n.label + '</div>' +
            '<div style="font-size:11px;color:#4a4a65;margin-top:2px;">' + n.sub + '</div>' +
          '</div>' +
        '</div>' +
        '<div style="width:20px;height:20px;border-radius:50%;border:2px solid ' + (isActive ? n.color : 'rgba(255,255,255,0.12)') + ';display:flex;align-items:center;justify-content:center;">' +
          (isActive ? '<div style="width:10px;height:10px;border-radius:50%;background:' + n.color + ';"></div>' : '') +
        '</div>';
      row.onclick = (function(nc){ return function() { _selectNet(sym, nc.apiCode || nc.key); excDepositNetModalClose(null, true); }; })(n);
      list.appendChild(row);
    });
  }

  function _selectNet(sym, key) {
    _renderNets(sym, key);
    _updateAddrAndQR();
  }

  function _shortenContract(addr) {
    if (!addr || addr.length < 10) return '—';
    return '***' + addr.slice(-5);
  }

  async function _updateAddrAndQR() {
    // Update contract row
    var net = __NX._depState.selectedNet;
    var contEl = document.getElementById('exc-dep-contract-val');
    var contRow = document.getElementById('exc-dep-contract-row');
    if (contEl && net) {
      if (net.contract) {
        contEl.textContent = _shortenContract(net.contract);
        if (contRow) contRow.style.display = 'flex';
      } else {
        if (contRow) contRow.style.display = 'none';
      }
    }

    var excId = _activeExcId();
    if (excId) {
      if (!net) return; // no network selected yet — wait for chains to load
      _setAddrLoading();
      var excAddr = null;
      try { excAddr = await __NX._fetchExcDepositAddr(excId, __NX._depState.sym, net.apiCode); } catch(e) {}
      if (excAddr && excAddr.address) {
        _setAddrAndMemo(excAddr.address, excAddr.memo || '');
        return;
      }
      // Exchange connected but address fetch failed — show error, never fall back to wallet address
      _setAddrAndMemo('', '');
      var addrEl2 = document.getElementById('exc-dep-addr-text');
      if (addrEl2) {
        // Check if keys exist at all
        var _hasKeys = false;
        try {
          var _ks2 = (window.EXC && typeof EXC._getKeys === 'function') ? EXC._getKeys(excId) : JSON.parse(localStorage.getItem('one_exc_keys_v1') || '{}')[excId];
          _hasKeys = !!(_ks2 && _ks2.apiKey && _ks2.secret);
        } catch(e) {}
        addrEl2.textContent = _hasKeys ? 'Could not fetch address — check API key permissions' : 'Add API key to fetch exchange deposit address';
        addrEl2.style.color = '#4a4a65';
      }
      return;
    }
    // No exchange connected — show wallet address
    var walletAddr = _getWalletAddr();
    _setAddrAndMemo(walletAddr || '', '');
    if (!walletAddr) {
      var addrEl = document.getElementById('exc-dep-addr-text');
      if (addrEl) { addrEl.textContent = 'Connect wallet to view address'; addrEl.style.color = '#4a4a65'; }
    }
  }

  function _getWalletAddr() {
    try { if (window.SW && SW.walletAddress) return SW.walletAddress; } catch(e){}
    var el = document.getElementById('walletAddress');
    if (el && el.textContent && el.textContent.startsWith('0x')) return el.textContent.trim();
    el = document.getElementById('walletAddressMultiKeyNative');
    if (el && el.value && el.value.startsWith('0x')) return el.value.trim();
    return '';
  }

  function _doClose() {
    var ov = document.getElementById('exc-deposit-overlay');
    var sh = document.getElementById('exc-deposit-sheet');
    if (!sh) return;
    sh.style.transform = 'translateY(100%)';
    setTimeout(function() { if (ov) ov.style.display = 'none'; }, 320);
  }

  function _fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position='fixed'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); if (typeof showToast==='function') showToast('Address copied!'); }
    catch(e) { if (typeof showToast==='function') showToast('Copy failed'); }
    document.body.removeChild(ta);
  }
})((window.__nxp = window.__nxp || {}).mod_deposit_modal = window.__nxp.mod_deposit_modal || {});
