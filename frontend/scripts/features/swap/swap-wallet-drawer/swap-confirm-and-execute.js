
// ── Confirm Modal ──
window.swCloseConfirm = function() {
  const modal = document.getElementById('sw-confirm-modal');
  if (!modal) return;
  modal.classList.remove('cs-visible');
  setTimeout(function(){ modal.classList.remove('sw-open'); }, 380);
  SW._lockedSwapTx = null;
};

function _swOpenConfirm() {
  const modal = document.getElementById('sw-confirm-modal');
  if (!modal) { _nxsw__swRunSwap(); return; }

  // Populate confirm modal fields
  const fromSym = SW.fromToken ? SW.fromToken.sym : '?';
  const toSym   = SW.toToken   ? SW.toToken.sym   : '?';
  const fromAmt = parseFloat(SW.fromAmount) || 0;
  const toAmt   = SW.toAmount  || 0;
  const slip    = SW.slippage  || 0.5;

  const setEl = function(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('sw-conf-from-sym', fromSym);
  setEl('sw-conf-to-sym',   toSym);
  setEl('sw-conf-from-amt', fromAmt.toFixed(6));
  setEl('sw-conf-to-amt',   parseFloat(toAmt).toFixed(6));
  setEl('sw-conf-slip',     slip + '%');

  const rate = fromAmt > 0 && toAmt > 0 ? '1 ' + fromSym + ' = ' + (toAmt / fromAmt).toFixed(4) + ' ' + toSym : '—';
  setEl('sw-conf-rate', rate);

  const minReceived = toAmt > 0 ? (toAmt * (1 - slip / 100)).toFixed(6) + ' ' + toSym : '—';
  setEl('sw-conf-min', minReceived);
  // Set impact from selected quote
  const _selQ = SW._manualDexName
    ? (SW.quotes || []).find(q => q.dex === SW._manualDexName)
    : (SW.quotes && SW.quotes[0]);
  if (_selQ != null && typeof _selQ.impact === 'number') {
    const _impEl = document.getElementById('sw-conf-impact');
    if (_impEl) {
      const _iv = _selQ.impact;
      _impEl.textContent = (_iv > 0 ? '+' : '') + (Math.abs(_iv) < 0.01 ? (_iv >= 0 ? '<+0.01' : '<-0.01') : _iv.toFixed(3)) + '%';
      _impEl.style.color = _iv > 0 ? 'var(--accent-green)' : _iv < -1 ? 'var(--accent-red)' : _iv < -0.3 ? 'var(--accent-amber)' : 'var(--text-secondary)';
    }
  } else {
    setEl('sw-conf-impact', '—');
  }

  const cachedTx   = SW._cachedSwapTx;
  const bestDexName = (SW.quotes && SW.quotes[0]) ? SW.quotes[0].dex : '—';
  const isManual    = !!SW._manualDexName;
  const activeDex   = SW._manualDexName || bestDexName;

  // DEX badge — green verified = best, amber tune = manually selected
  const _dexIconEl  = document.getElementById('sw-conf-dex-icon');
  const _dexLabelEl = document.getElementById('sw-conf-dex-label');
  const _dexEl      = document.getElementById('sw-conf-dex');
  if (_dexEl)      _dexEl.textContent = activeDex;
  if (_dexIconEl)  { _dexIconEl.textContent = isManual ? 'tune' : 'verified'; _dexIconEl.style.color = isManual ? 'var(--accent-amber)' : 'var(--accent-green)'; }
  // For 0x: show underlying fill source e.g. "0x Protocol · SpartaDex"
  const _0xSubRoute = (cachedTx && cachedTx.source === '0x' && cachedTx._0xRoute && cachedTx._0xRoute !== '0x Protocol')
    ? ' · ' + cachedTx._0xRoute : '';
  if (_dexLabelEl) {
    const _prefix = isManual ? 'Selected · ' : 'Best price · ';
    _dexLabelEl.innerHTML = _prefix + '<strong>' + (activeDex + _0xSubRoute) + '</strong>';
  } else if (_dexEl) { _dexEl.textContent = activeDex + _0xSubRoute; }

  const sourceName = cachedTx ? (cachedTx.source || activeDex) : null;

  if (cachedTx) {
    // ── Use already-calculated gasFee from selected quote — no RPC call needed ──
    const _selectedQuote = SW.quotes && (SW._manualRouteKey
      ? SW.quotes.find(q => (q.dex + '::' + (q.apiSource || '')) === SW._manualRouteKey)
      : SW.quotes.find(q => q.dex === (SW._manualDexName || bestDexName)));
    const _gasFeeStr = (_selectedQuote && _selectedQuote.gasFee && _selectedQuote.gasFee !== '⏳')
      ? _selectedQuote.gasFee
      : (SW.quotes && SW.quotes[0] && SW.quotes[0].gasFee && SW.quotes[0].gasFee !== '⏳')
        ? SW.quotes[0].gasFee
        : '—';
    setEl('sw-conf-gas', _gasFeeStr);
  } else {
    setEl('sw-conf-gas', '—');
  }

  // Token icons
  const fromIconEl = document.getElementById('sw-conf-from-icon');
  const toIconEl   = document.getElementById('sw-conf-to-icon');
  function _setConfIcon(el, token, sym) {
    if (!el || !token) return;
    const logo = token.logoURI || (typeof _nxsw_TOKEN_LOGOS !== 'undefined' && _nxsw_TOKEN_LOGOS[sym]) || null;
    const [c1,c2] = (token.color || '#6366f1,#8b5cf6').split(',');
    const fallbackTxt = token.icon || sym.slice(0,2).toUpperCase();
    el.innerHTML = '';
    if (logo) {
      el.style.background = 'transparent';
      const img = document.createElement('img');
      img.src = logo;
      img.style.cssText = 'width:40px;height:40px;border-radius:12px;object-fit:cover;display:block;';
      img.onerror = function() {
        el.style.background = 'linear-gradient(135deg,' + c1 + ',' + (c2||c1) + ')';
        el.innerHTML = '<span style="font-size:15px;font-weight:800;color:#fff;">' + fallbackTxt + '</span>';
      };
      el.appendChild(img);
    } else {
      el.style.background = 'linear-gradient(135deg,' + c1 + ',' + (c2||c1) + ')';
      el.innerHTML = '<span style="font-size:15px;font-weight:800;color:#fff;">' + fallbackTxt + '</span>';
    }
  }
  _setConfIcon(fromIconEl, SW.fromToken, fromSym);
  _setConfIcon(toIconEl,   SW.toToken,   toSym);

  modal.style.display = 'flex';
  modal.style.alignItems = 'flex-end';
  // ── Lock the tx at confirm time — background route updates won't affect execution ──
  SW._lockedSwapTx = SW._cachedSwapTx;
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      modal.classList.add('cs-visible');
    });
  });
  if (typeof haptic === 'function') haptic();
}

// ── Main action button handler ──
window.swHandleAction = function() {
  // Guard: ignore ghost touch clicks right after SSO overlay close (Android 300ms bleed)
  if (window._ssoClosedAt && (Date.now() - window._ssoClosedAt) < 700) return;
  if (!SW.walletConnected || !SW.walletAddress) {
    window.swOpenWalletPanel();
    return;
  }
  const amt = parseFloat(SW.fromAmount);
  if (!amt || amt <= 0) { if (typeof _nxsw_swShowToast === 'function') _nxsw_swShowToast('Enter an amount to swap'); return; }
  if (!SW.toToken) { if (typeof _nxsw_swShowToast === 'function') _nxsw_swShowToast('Select a token to receive'); return; }
  if (SW.fromToken && SW.toToken && SW.fromToken.sym === SW.toToken.sym) { if (typeof _nxsw_swShowToast === 'function') _nxsw_swShowToast('Select different tokens'); return; }
  if (SW.fromToken && SW.fromToken.balance !== undefined && amt > SW.fromToken.balance) { if (typeof _nxsw_swShowToast === 'function') _nxsw_swShowToast('Insufficient balance'); return; }

  if (SW.expertMode) {
    // Expert mode: skip confirm, go direct
    swExecuteSwapDirect();
  } else {
    _swOpenConfirm();
  }
};

// swExecuteSwapDirect — called from Swap Now button (no modal)
async function swExecuteSwapDirect() {
  const _modalOpen = (function(){
    var m = document.getElementById('sw-confirm-modal');
    return m && m.classList.contains('cs-visible');
  })();
  swCloseConfirm();
  if (_modalOpen) await new Promise(function(r){ setTimeout(r, 420); });
  await _nxsw__swRunSwap();
}

// swExecuteSwap — called from confirm modal button
window.swExecuteSwap = async function() {
  // If cached tx not ready yet, wait briefly and retry once
  if (!SW._cachedSwapTx || !SW._cachedSwapTx.to) {
    const btn = document.getElementById('sw-conf-execute-btn');
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) { btn.innerHTML = '<span class="material-icons-round" style="font-size:17px;animation:swSpin 0.8s linear infinite;">sync</span> Finding route…'; btn.style.opacity = '0.7'; btn.onclick = null; }
    // Wait up to 8s for route to arrive
    let waited = 0;
    while (!SW._cachedSwapTx && waited < 8000) {
      await new Promise(r => setTimeout(r, 500));
      waited += 500;
    }
    if (btn) { btn.innerHTML = origHtml; btn.style.opacity = '1'; btn.onclick = () => window.swExecuteSwap(); }
    if (!SW._cachedSwapTx || !SW._cachedSwapTx.to) {
      if (typeof _nxsw_swShowToast === 'function') _nxsw_swShowToast('⚠️ No route found. Try a different amount or pair.');
      return;
    }
  }
  swCloseConfirm();
  // Wait for confirm modal fade-out (380ms) before opening TXP overlay
  // — prevents double backdrop-filter blur glitch on screen
  await new Promise(function(r){ setTimeout(r, 420); });
  await _nxsw__swRunSwap();
};

// ── Show a tx result card for N seconds ──
function _swShowTxCard(opts) {
  // sw-success-msg removed — success handled by premium _ssoOpen overlay
}