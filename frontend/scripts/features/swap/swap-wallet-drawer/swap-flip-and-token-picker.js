
/* ── Flip ── */
window.swFlipTokens = function() {
  const tmp = SW.fromToken;
  SW.fromToken = SW.toToken;
  SW.toToken = tmp;
  // Clear cached route & state
  SW._cachedSwapTx   = null;
  SW._routeFetching  = false;
  SW._routerCache    = {};
  SW.quotes          = [];
  SW._userSelectedDexIdx = null;
  // Clear amounts
  const inp = document.getElementById('sw-from-amount');
  if (inp) inp.value = '';
  SW.fromAmount = '';
  const _toAmtEl = document.getElementById('sw-to-amount');
  if (_toAmtEl) _toAmtEl.textContent = '—';
  const _fromUsdEl = document.getElementById('sw-from-usd');
  if (_fromUsdEl) _fromUsdEl.textContent = '≈ $0.00';
  const _toUsdEl = document.getElementById('sw-to-usd');
  if (_toUsdEl) _toUsdEl.textContent = '≈ $0.00';
  const _errBox = document.getElementById('sw-error-box');
  if (_errBox) _errBox.style.display = 'none';
  {const _ip=document.getElementById('sw-info-panel');if(_ip)_ip.style.display='none';}
  const _dexCmp = document.getElementById('sw-dex-compare');
  if (_dexCmp) _dexCmp.style.display = 'none';
  {const _sb=document.getElementById('sw-split-badge');if(_sb)_sb.style.display='none';}
  {const _sq=document.getElementById('sw-slip-quick');if(_sq)_sq.style.display='none';}
  {const _sd=document.getElementById('sw-selected-dex-badge');if(_sd)_sd.style.display='none';}
  swUpdateUI();
  // Refresh balance for new fromToken
  if (SW.walletConnected) {
    setTimeout(function() { _swFetchFromBalanceLive(); }, 100);
  }
};

/* ── Network Picker ── */







/* ── Shared network change logic ── */
function _swApplyNetworkChange() {
  // Reset router cache for new chain
  SW._cachedRouterAddr  = null;
  SW._routerCache       = {};
  // Update tokens for new network — uses home screen TOKEN_CONFIG
  const tokens = _nxsw_getTokens();
  SW.fromToken = tokens[0] || null;
  SW.toToken   = tokens.length > 1 ? tokens[1] : null;
  swUpdateUI();
  // Reset amounts & panels
  const inp = document.getElementById('sw-from-amount');
  if (inp) inp.value = '';
  SW.fromAmount = '';
  const toAmtEl = document.getElementById('sw-to-amount');
  if (toAmtEl) toAmtEl.textContent = '—';
  const fromUsd = document.getElementById('sw-from-usd');
  if (fromUsd) fromUsd.textContent = '≈ $0.00';
  const toUsd = document.getElementById('sw-to-usd');
  if (toUsd) toUsd.textContent = '≈ $0.00';
  const infoPanel = document.getElementById('sw-info-panel');
  if (infoPanel) infoPanel.style.display = 'none';
  const dexCompare = document.getElementById('sw-dex-compare');
  if (dexCompare) dexCompare.style.display = 'none';
  const slipQuick = document.getElementById('sw-slip-quick');
  if (slipQuick) slipQuick.style.display = 'none';
  
  // NOTE: Home chain selector is NOT updated when swap network changes.
  // Home → Swap is one-way sync only (Home controls Swap, not the reverse).
}

/* ── Token Picker ── */
let _swPickerSide = 'from';
let _swAllTokens = [];

window.swOpenTokenPicker = function(side) {
  // Guard: only open when swap page is actually active
  if (window.currentPage !== 'swap') return;
  _swPickerSide = side;
  _swAllTokens = _nxsw_getTokens();
  const modal = document.getElementById('sw-token-modal');
  if (!modal) return;
  // Move modal to body so position:fixed isn't broken by ancestor overflow/transform
  if (modal.parentElement !== document.body) {
    document.body.appendChild(modal);
  }
  // Reset sheet transform in case it was left by swipe-to-close
  const sheet = document.getElementById('sw-token-sheet');
  if (sheet) { sheet.style.transition = 'none'; sheet.style.transform = 'translateY(0)'; }
  modal.classList.add('sw-open');
  document.body.style.overflow = 'hidden';
  // Clear search
  const search = document.getElementById('sw-token-search');
  if (search) search.value = '';
  const _lbl = document.getElementById('sw-tp-label');
  if (_lbl) _lbl.textContent = (SW.network && SW.network.name) ? ('All tokens on ' + SW.network.name) : 'All tokens';
  swRenderTokenList(_swAllTokens);
  // Reset contract fetch state
  _swPendingContractToken = null;
  const _scs = document.getElementById('sw-contract-status');
  const _scp = document.getElementById('sw-contract-preview');
  if (_scs) { _scs.style.display = 'none'; _scs.textContent = ''; }
  if (_scp) _scp.style.display = 'none';
};
window.swPasteTokenSearch = async function() {
  const inp = document.getElementById('sw-token-search');
  if (!inp) return;
  try {
    const txt = await navigator.clipboard.readText();
    if (txt) { inp.value = txt.trim(); swFilterTokens(inp.value); return; }
  } catch (_e) {}
  inp.focus();
};
window.swCloseTokenPicker = function() {
  // Drop the keyboard if the search box still has focus
  try { const _ae = document.activeElement; if (_ae && _ae.id === 'sw-token-search') _ae.blur(); } catch (_e) {}
  const modal = document.getElementById('sw-token-modal');
  if (modal) { modal.classList.remove('sw-open'); document.body.style.overflow = ''; }
  // Reset sheet transform so next open starts clean
  const sheet = document.getElementById('sw-token-sheet');
  if (sheet) { setTimeout(function() { sheet.style.transition = ''; sheet.style.transform = ''; }, 350); }
};

function swTokLogoFallback(img) {
  var wrap = img.parentElement;
  if (!wrap) return;
  var c1 = wrap.dataset.c1 || '#6366f1';
  var c2 = wrap.dataset.c2 || '#8b5cf6';
  var label = wrap.dataset.label || '?';
  var size = parseInt(wrap.dataset.size || '38');
  var fs = Math.round(size * 0.4);
  wrap.style.background = 'linear-gradient(135deg,' + c1 + ',' + c2 + ')';
  wrap.innerHTML = '<span style="font-size:' + fs + 'px;font-weight:800;color:#fff;">' + label + '</span>';
}
window.swTokLogoFallback = swTokLogoFallback;

function _swTokenIconHtml(t, size) {
  const logoURI = t.logoUrl || t.logo || t.logoURI || _nxsw_TOKEN_LOGOS[t.sym] || null;
  const [c1,c2] = (t.color || '#6366f1,#8b5cf6').split(',');
  const r = Math.round(size * 0.29);
  const fs = Math.round(size * 0.4);
  const label = (t.icon || t.sym.slice(0,2)).replace(/</g,'&lt;');
  if (!logoURI) {
    return `<div style="width:${size}px;height:${size}px;border-radius:${r}px;background:linear-gradient(135deg,${c1},${c2});display:flex;align-items:center;justify-content:center;font-size:${fs}px;font-weight:800;color:#fff;flex-shrink:0;">${label}</div>`;
  }
  // Use data attributes for fallback — no nested quotes in onerror
  return `<div class="sw-tok-logo-wrap" data-c1="${c1}" data-c2="${c2}" data-label="${label}" data-size="${size}" style="width:${size}px;height:${size}px;border-radius:${r}px;overflow:hidden;flex-shrink:0;background:linear-gradient(135deg,${c1},${c2});display:flex;align-items:center;justify-content:center;"><img src="${logoURI}" width="${size}" height="${size}" style="border-radius:${r}px;object-fit:cover;display:block;" onerror="swTokLogoFallback(this)" /></div>`;
}

function swRenderTokenList(tokens) {
  const list = document.getElementById('sw-token-list');
  if (!list) return;

  // ── Pull real balances from home _balanceCache (SW wallet-aware) ──
  function _swGetLiveBalance(sym) {
    try {
      const _bc  = window._balanceCache || {};
      const _cid = (SW.network && SW.network.chainId) || 8453;

      // ── Resolve correct wallet suffix for the SWAP wallet (not necessarily homeActiveKey) ──
      function _swGetSuffix() {
        const _swAddr = SW.walletAddress ? SW.walletAddress.toLowerCase() : null;
        if (!_swAddr) {
          return (typeof homeActiveKey !== 'undefined' && homeActiveKey) ? homeActiveKey.slice(-8) : '';
        }
        const _vKeys = (typeof validatedKeys !== 'undefined' && Array.isArray(validatedKeys)) ? validatedKeys : [];
        for (const k of _vKeys) {
          try { if (new ethers.Wallet(k).address.toLowerCase() === _swAddr) return k.slice(-8); } catch(_e) {}
        }
        try {
          const _groups = (typeof loadWalletGroups === 'function') ? loadWalletGroups() : [];
          for (const g of _groups) {
            for (const k of (g.keys || [])) {
              try { if (new ethers.Wallet(k).address.toLowerCase() === _swAddr) return k.slice(-8); } catch(_e) {}
            }
          }
        } catch(_e) {}
        if (SW.walletPK) return String(SW.walletPK).slice(-8);
        return '';
      }

      const _wSuffix = _swGetSuffix();
      if (!_wSuffix) return null;

      const _tc = (typeof TOKEN_CONFIG !== 'undefined' ? TOKEN_CONFIG : [])
        .find(function(t) { return t.sub === sym && (t.chainId || 8453) === _cid; });
      if (_tc) {
        const _key    = _tc.id + ':' + _cid + ':' + _wSuffix;
        if (_bc[_key] !== undefined && !isNaN(_bc[_key])) return parseFloat(_bc[_key]);
        const _pfx    = _tc.id + ':' + _cid + ':';
        const _sfxEnd = ':' + _wSuffix;
        const _k2 = Object.keys(_bc).find(function(k) { return k.startsWith(_pfx) && k.endsWith(_sfxEnd); });
        if (_k2 && !isNaN(_bc[_k2])) return parseFloat(_bc[_k2]);
      }
    } catch(_) {}
    return null;
  }

  const enriched = tokens.map(t => {
    const liveBal = _swGetLiveBalance(t.sym);
    const balance = liveBal != null ? liveBal : (t.balance || 0);
    return Object.assign({}, t, { _liveBal: balance, _usdVal: balance * (t.price || 0) });
  });
  const _walletOk = SW.walletConnected && !!SW.walletAddress;

  // Wallet connected হলে balance (USD) অনুযায়ী sort — বেশি balance উপরে
  if (_walletOk) {
    enriched.sort((a, b) => {
      if (b._usdVal !== a._usdVal) return b._usdVal - a._usdVal;
      return b._liveBal - a._liveBal;
    });
  }

  const _selTok = (_swPickerSide === 'from') ? SW.fromToken : SW.toToken;
  const _selSym = _selTok ? _selTok.sym : '';

  if (!enriched.length) {
    list.innerHTML = '<div class="sw-tp-empty">No tokens found</div>';
    return;
  }

  list.innerHTML = enriched.map(t => {
    const bal    = t._liveBal;
    const usdVal = t._usdVal;
    const hasBal = _walletOk && bal > 0;
    const isSel  = t.sym === _selSym;

    let rightHtml;
    if (!_walletOk) {
      rightHtml = '<div class="sw-tp-right"><div class="sw-tp-bal">' + _formatCurrencyDisplay(t.price||0) + '</div></div>';
    } else {
      const balStr = bal >= 1000 ? bal.toLocaleString('en-US',{maximumFractionDigits:2})
                   : bal >= 0.01 ? bal.toFixed(4)
                   : bal > 0     ? bal.toFixed(6) : '0';
      rightHtml = '<div class="sw-tp-right">'
        + '<div class="sw-tp-bal' + (hasBal ? ' has' : '') + '">' + balStr + '</div>'
        + '<div class="sw-tp-usd' + (hasBal ? ' has' : '') + '">' + _formatCurrencyDisplay(usdVal) + '</div>'
        + '</div>';
    }
    return '<div class="sw-tp-row' + (isSel ? ' sel' : '') + '" onclick="swSelectToken(\'' + t.sym + '\')">'
      + _swTokenIconHtml(t, 38)
      + '<div class="sw-tp-row-main"><div class="sw-tp-sym">' + t.sym + '</div><div class="sw-tp-name">' + t.name + '</div></div>'
      + rightHtml
      + (isSel ? '<span class="material-icons-round sw-tp-check">check</span>' : '')
      + '</div>';
  }).join('');
}