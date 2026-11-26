
/* ── Record swap in history + reset UI + show success overlay ── */
function _swRecordAndReset(fromAmt, toAmt, dex, success) {
  // 1. Save to recent swaps history
  if (!SW.recentSwaps) SW.recentSwaps = [];
  SW.recentSwaps.push({
    fromSym:  (SW.fromToken && SW.fromToken.sym) || '?',
    toSym:    (SW.toToken   && SW.toToken.sym)   || '?',
    fromAmt:  fromAmt  || 0,
    toAmt:    toAmt    || 0,
    dex:      dex      || 'DEX',
    date:     new Date().toLocaleDateString(),
    hash:     (SW._lastTxHash || null),
    chainId:  (SW.network && SW.network.chainId) || 1,
    timestamp: Date.now()
  });
  if (SW.recentSwaps.length > 50) SW.recentSwaps.shift();

  // 1b. Persist to localStorage so history survives page reload
  try { localStorage.setItem('sw_recent', JSON.stringify(SW.recentSwaps)); } catch(_) {}

  // 1c. Save to unified TX history (Transaction History panel)
  if (typeof saveTxToHistory === 'function') {
    var _fSym = (SW.fromToken && SW.fromToken.sym) || '?';
    var _tSym = (SW.toToken   && SW.toToken.sym)   || '?';
    var _swChainId = (SW.network && SW.network.chainId) || 8453;
    var _swChainName = (SW.network && SW.network.name) || 'Network';
    saveTxToHistory({
      type:        'swap',
      hash:        SW._lastTxHash || null,
      pair:        txhFmtAmt(fromAmt) + ' ' + _fSym + ' → ' + txhFmtAmt(toAmt) + ' ' + _tSym,
      fromAmt:     fromAmt  || 0,
      fromToken:   _fSym,
      toAmt:       toAmt    || 0,
      toToken:     _tSym,
      dex:         dex      || 'DEX',
      chainId:     _swChainId,
      fromChainId: _swChainId,
      toChainId:   _swChainId,
      fromChain:   _swChainName,
      toChain:     _swChainName,
      isDry:       !success,
    });
  }

  // 2. Close confirm modal + progress overlay
  if (typeof window.swCloseConfirm === 'function') window.swCloseConfirm();
  var _hasTxp = typeof window._txpClose === 'function';
  if (_hasTxp) window._txpClose();

  // 3. Show success overlay — wait for TXP fade-out (360ms) to avoid double backdrop-filter blur glitch
  var fromToken  = SW.fromToken || {};
  var toToken    = SW.toToken   || {};
  var chainId    = (SW.network && SW.network.chainId) || 1;
  var chainName  = (SW.network && SW.network.name)    || 'Network';

  // Snapshot icon data directly from SW token state (not DOM — img tags have no textContent)
  var _fromSym     = fromToken.sym || '?';
  var _toSym       = toToken.sym   || '?';
  var _fromLogoURI = (fromToken.logoURI) || (typeof _nxsw_TOKEN_LOGOS!=='undefined' && _nxsw_TOKEN_LOGOS[_fromSym]) || null;
  var _toLogoURI   = (toToken.logoURI)   || (typeof _nxsw_TOKEN_LOGOS!=='undefined' && _nxsw_TOKEN_LOGOS[_toSym])   || null;
  var _fromColors  = (fromToken.color || '#627EEA,#364FC7').split(',');
  var _toColors    = (toToken.color   || '#2775CA,#1557A0').split(',');
  var _fromIconBg  = 'linear-gradient(135deg,' + _fromColors[0] + ',' + (_fromColors[1]||_fromColors[0]) + ')';
  var _toIconBg    = 'linear-gradient(135deg,' + _toColors[0]   + ',' + (_toColors[1]  ||_toColors[0])   + ')';
  var _fromIconTxt = fromToken.icon || _fromSym.slice(0,2);
  var _toIconTxt   = toToken.icon   || _toSym.slice(0,2);
  var _fromAmt     = fromAmt;
  var _toAmt       = toAmt;
  var _dex         = dex  || 'DEX';
  var _hash        = SW._lastTxHash || null;

  var _openSSO = function() {
    if (typeof window._ssoOpen === 'function') {
      var _meta = SW._ssoRouteMeta || {};
      window._ssoOpen({
        fromAmt:      _fromAmt,
        fromSym:      _fromSym,
        fromIconBg:   _fromIconBg,
        fromIconText: _fromIconTxt,
        fromLogoURI:  _fromLogoURI,
        toAmt:        _toAmt,
        toSym:        _toSym,
        toIconBg:     _toIconBg,
        toIconText:   _toIconTxt,
        toLogoURI:    _toLogoURI,
        dex:          _dex,
        dexLogoURI:   _meta.dexLogoURI  || null,
        apiLogoURI:   _meta.apiLogoURI  || null,
        apiLabel:     _meta.apiLabel    || null,
        dexName:      _meta.dexName     || null,
        hasBothParts: _meta.hasBoth     || false,
        hash:         _hash,
        chainId:      chainId,
        chainName:    chainName
      });
    }
  };

  // Delay SSO open by 400ms when TXP was open (its fade-out is 360ms),
  // otherwise open immediately for the no-TXP path (simulated swap etc.)
  if (_hasTxp) {
    setTimeout(_openSSO, 400);
  } else {
    _openSSO();
  }

  // 4. Reset swap UI
  var input = document.getElementById('sw-from-amount');
  if (input) { input.value = ''; }
  SW.fromAmount = '';
  SW.toAmount   = 0;
  SW._cachedSwapTx = null;
  SW._lastTxHash   = null;
  // ── Reset % slider ──
  var _rPctRange = document.getElementById('sw-pct-range');
  if (_rPctRange) _rPctRange.value = '0';
  var _rPctFill = document.getElementById('sw-pct-fill');
  if (_rPctFill) _rPctFill.style.width = '0%';
  var _rPctThumb = document.getElementById('sw-pct-thumb');
  if (_rPctThumb) _rPctThumb.style.display = 'none';
  var _rPctDisp = document.getElementById('sw-pct-display');
  if (_rPctDisp) _rPctDisp.textContent = '0%';

  // 5. Restore button
  _nxsw__swBtnRestore();

  // 6. ── INSTANT balance update after successful swap ──
  try {
    var _fromTok = SW.fromToken;
    var _toTok   = SW.toToken;
    var _fAmt    = parseFloat(fromAmt) || 0;
    var _tAmt    = parseFloat(toAmt)   || 0;
    var _chainId = (SW.network && SW.network.chainId) || 8453;
    var _wSuffix = (typeof homeActiveKey !== 'undefined' && homeActiveKey) ? homeActiveKey.slice(-8)
                   : (SW.walletPK ? SW.walletPK.slice(-8) : '');
    // Combined token list: TOKEN_CONFIG + DEFAULT_TOKENS
    var _allTkCfg = [
      ...(typeof TOKEN_CONFIG   !== 'undefined' ? TOKEN_CONFIG   : []),
      ...(typeof DEFAULT_TOKENS !== 'undefined' ? DEFAULT_TOKENS : [])
    ];

    // ── Helper: find cache key + card for a sym ──
    var _getInfoForSym = function(sym) {
      var cfg = _allTkCfg.find(function(t) { return t.sub === sym && (t.chainId || 8453) === _chainId; });
      // Build candidate cache keys in priority order
      var keys = [];
      if (cfg) {
        keys.push(cfg.id + ':' + _chainId + ':' + _wSuffix);  // exact
        // Any suffix variant
        var _pfx = cfg.id + ':' + _chainId + ':';
        var _any = Object.keys(window._balanceCache || {}).find(function(k) { return k.startsWith(_pfx); });
        if (_any) keys.push(_any);
      }
      // Find first key that exists in cache
      var _foundKey = keys.find(function(k) { return window._balanceCache && window._balanceCache[k] !== undefined; })
                      || (cfg ? (cfg.id + ':' + _chainId + ':' + _wSuffix) : null);
      // Card element
      var card = cfg ? document.getElementById('token-card-' + cfg.id) : null;
      if (!card) {
        document.querySelectorAll('.token-card').forEach(function(c) {
          var subEl = c.querySelector('.token-sub span');
          if (subEl && subEl.textContent.trim() === sym) card = c;
        });
      }
      return { key: _foundKey, card: card, price: cfg ? 0 : 0 };
    };

    // ── 1. Update _balanceCache + compute new balances ──
    var _fNewBal = undefined, _tNewBal = undefined;
    var _fInfo = _fromTok ? _getInfoForSym(_fromTok.sym) : null;
    var _tInfo = _toTok   ? _getInfoForSym(_toTok.sym)   : null;

    if (window._balanceCache) {
      if (_fInfo && _fInfo.key && _fAmt > 0) {
        _fNewBal = Math.max(0, parseFloat(window._balanceCache[_fInfo.key] || 0) - _fAmt);
        window._balanceCache[_fInfo.key] = _fNewBal;
      }
      if (_tInfo && _tInfo.key && _tAmt > 0) {
        _tNewBal = parseFloat(window._balanceCache[_tInfo.key] || 0) + _tAmt;
        window._balanceCache[_tInfo.key] = _tNewBal;
      }
    }

    // ── 2. Update swap section FROM/TO balance display instantly ──
    if (_fromTok && _fNewBal !== undefined) _fromTok.balance = _fNewBal;
    if (_toTok   && _tNewBal !== undefined) _toTok.balance   = _tNewBal;
    if (typeof _nxsw_swUpdateBalances === 'function') _nxsw_swUpdateBalances();

    // ── 3. Update home screen token card DOM instantly ──
    var _flashCard = function(info, sym, newBal) {
      if (!info || !info.card || newBal === undefined || isNaN(newBal)) return;
      var amtEl = info.card.querySelector('.token-amount');
      if (amtEl) {
        amtEl.textContent = newBal >= 1000 ? newBal.toLocaleString('en-US', {maximumFractionDigits:2})
                          : newBal >= 0.01  ? newBal.toFixed(4) : newBal.toFixed(6);
        amtEl.style.transition = 'color 0.3s';
        amtEl.style.color = 'var(--accent-green)';
        setTimeout(function() { amtEl.style.color = ''; }, 1200);
      }
      var usdEl = info.card.querySelector('.token-usd');
      if (usdEl) {
        try {
          var _tk = _allTkCfg.find(function(t) { return t.sub === sym && (t.chainId||8453) === _chainId; });
          var _pr = 0;
          if (_tk && typeof _globalPriceCache !== 'undefined' && _globalPriceCache && _tk.cgId) {
            var _pd = _globalPriceCache[_tk.cgId];
            if (_pd && _pd.usd) _pr = _pd.usd;
          }
          if (_pr > 0 && usdEl.dataset.toggled !== '1') { _smoothSet(usdEl, _formatCurrencyDisplay(newBal * _pr)); }
        } catch(_) {}
      }
    };
    _flashCard(_fInfo, _fromTok && _fromTok.sym, _fNewBal);
    _flashCard(_tInfo, _toTok   && _toTok.sym,   _tNewBal);

  } catch(_swBalErr) { /* silent fail */ }
}

// ── Reset from-amount input + SW state after fail ──
function _swResetAmount() {
  var _inp = document.getElementById('sw-from-amount');
  if (_inp) { _inp.value = ''; }
  SW.fromAmount = '';
  SW.toAmount   = 0;
  SW._cachedSwapTx = null;
  SW._lastTxHash   = null;
  // Reset % slider
  var _rr = document.getElementById('sw-pct-range');  if (_rr) _rr.value = '0';
  var _rf = document.getElementById('sw-pct-fill');   if (_rf) _rf.style.width = '0%';
  var _rt = document.getElementById('sw-pct-thumb');  if (_rt) _rt.style.display = 'none';
  var _rd = document.getElementById('sw-pct-display');if (_rd) _rd.textContent = '0%';
  // Clear quote panel
  if (typeof swClearQuotes === 'function') swClearQuotes();
}

// ── Swap Fail Overlay — reuses _ssoOpen with fail mode ──
function _swShowFailOverlay(fromAmt, toAmt, fromSym, toSym, dex, errMsg) {
  if (typeof window._ssoOpen !== 'function') {
    _nxsw_swShowToast('❌ Swap failed: ' + (errMsg || 'Unknown error'));
    return;
  }
  const fromToken = SW.fromToken || {};
  const toToken   = SW.toToken   || {};
  const _fromLogoURI = fromToken.logoURI || null;
  const _toLogoURI   = toToken.logoURI   || null;
  const _fromColors  = (fromToken.color || '#627EEA,#364FC7').split(',');
  const _toColors    = (toToken.color   || '#2775CA,#1557A0').split(',');
  window._ssoOpen({
    fromAmt, fromSym,
    fromIconBg:   'linear-gradient(135deg,' + _fromColors[0] + ',' + (_fromColors[1]||_fromColors[0]) + ')',
    fromIconText: fromToken.icon || (fromSym||'?').slice(0,2),
    fromLogoURI:  _fromLogoURI,
    toAmt, toSym,
    toIconBg:   'linear-gradient(135deg,' + _toColors[0] + ',' + (_toColors[1]||_toColors[0]) + ')',
    toIconText: toToken.icon || (toSym||'?').slice(0,2),
    toLogoURI:  _toLogoURI,
    dex,
    hash:      SW._lastTxHash || null,
    chainId:   (SW.network && SW.network.chainId) || 1,
    chainName: (SW.network && SW.network.name)    || 'Network',
    failed:    true,
    failMsg:   errMsg || 'Transaction failed',
  });
}

// ── Build real Velora TX from priceRoute (called at swap execution time) ──
// Official docs: https://developers.velora.xyz/api/velora-api/velora-market-api/build-parameters-for-transaction
async function _buildVeloraTx(priceRoute, userAddr, amountWei, slip, chainId) {
  try {
    const slippageBps = Math.round(parseFloat(slip) * 100);
    const body = {
      srcToken:     priceRoute.srcToken,
      srcDecimals:  priceRoute.srcDecimals  ?? SW.fromToken?.decimals ?? 18,
      destToken:    priceRoute.destToken,
      destDecimals: priceRoute.destDecimals ?? SW.toToken?.decimals   ?? 18,
      srcAmount:    amountWei,
      slippage:     slippageBps,
      priceRoute:   priceRoute,
      userAddress:  userAddr,
      partner:      'one-wallet',
      deadline:     Math.floor(Date.now() / 1000) + 1800,
    };
    const txR = await fetch(
      'https://api.velora.xyz/transactions/' + chainId + '?ignoreGasEstimate=true',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(12000),
      }
    );
    if (!txR.ok) {
      const errTxt = await txR.text().catch(() => '');
      console.warn('[One] Velora TX build error:', txR.status, errTxt);
      return null;
    }
    const txJ = await txR.json();
    if (!txJ.to || !txJ.data) { if(window._swLog)window._swLog('Velora','FAIL','bad resp'); return null; }
    return {
      to:     txJ.to,
      data:   txJ.data,
      value:  txJ.value != null ? String(txJ.value) : '0x0',
      gas:    Number(priceRoute.gasCost) || 300000,
      source: 'velora',
    };
  } catch(e) {
    console.warn('[One] _buildVeloraTx exception:', e);
    return null;
  }
}
