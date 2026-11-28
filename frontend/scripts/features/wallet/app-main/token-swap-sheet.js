
// ── Contract row helpers (copy address / open explorer in the phone's own browser) ──
// Wallet that is connected on Home right now (the one whose balance the token card shows)
function _tasHomeAddress() {
  try {
    if (typeof hwSelectedKey !== 'undefined' && hwSelectedKey && typeof ethers !== 'undefined') return new ethers.Wallet(hwSelectedKey).address;
  } catch (_) {}
  return '';
}
const _TAS_ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
// Token  -> <explorer>/token/<contract>?a=<Home wallet>#transactions  (that wallet's transfers of this token)
// Native -> <explorer>/address/<Home wallet>                          (that wallet's page)
function _tasExplorerUrl(t, chainId) {
  const base = (typeof window.getTHExplorer === 'function' ? window.getTHExplorer(chainId) : '') || 'https://etherscan.io';
  const wallet = _tasHomeAddress();
  if (t.isNative || !_TAS_ADDR_RE.test(t.contract || '')) return wallet ? base + '/address/' + wallet : base;
  return base + '/token/' + t.contract + (wallet ? '?a=' + wallet + '#transactions' : '');
}
// Always the phone's default browser (not the in-app browser), even for custom-chain explorers
function _tasOpenExternal(url) {
  try {
    if (window.OneAndroid && typeof OneAndroid.openInSystemBrowser === 'function') { OneAndroid.openInSystemBrowser(url); return; }
    if (window.OneAndroid && typeof OneAndroid.openExternalUrl === 'function') { OneAndroid.openExternalUrl(url); return; }
  } catch (_) {}
  window.open(url, '_blank', 'noopener,noreferrer');
}
function _tasCopy(text) {
  try {
    if (window.OneAndroid && typeof OneAndroid.copyToClipboard === 'function') { OneAndroid.copyToClipboard(text); return; }   // shows its own "Copied!" toast
  } catch (_) {}
  try { navigator.clipboard.writeText(text); } catch (_) {}
  if (typeof showToast === 'function') showToast('Contract copied', 'content_copy');
}

// ── TOKEN ACTION SHEET (click on token card) ──
// ── SWAP SHEET: single click on token card ──
function showTokenSwapSheet(t) {
  const existing = document.getElementById('token-action-sheet');
  if (existing) existing.remove();

  const chainName = t.chainId ? (getAllChains().find(c => c.chainId === t.chainId)?.name || 'Chain ' + t.chainId) : 'Base';
  const chainId   = t.chainId || 8453;
  const _tasHasContract = !t.isNative && _TAS_ADDR_RE.test(t.contract || '');
  const _tasShort = _tasHasContract ? t.contract.slice(0, 6) + '…' + t.contract.slice(-4) : '';
  const ctHtml = _tasHasContract ? `
      <div class="tas-label">Contract</div>
      <div class="tas-ct">
        <button type="button" id="tas-ct-addr" class="tas-ct-addr" aria-label="Show full contract address"><span class="material-icons-round">tag</span><span id="tas-ct-addr-txt">${_tasShort}</span></button>
        <button type="button" id="tas-ct-copy" class="tas-ct-btn copy"><span class="material-icons-round">content_copy</span><span id="tas-ct-copy-txt">Copy</span></button>
        <button type="button" id="tas-ct-explorer" class="tas-ct-btn" aria-label="Open in explorer">Explorer</button>
      </div>` : (t.isNative ? `
      <div class="tas-label">Contract</div>
      <div class="tas-ct plain">
        <span class="tas-ct-native"><span class="material-icons-round">local_gas_station</span>Native token · pays gas fees</span>
        <button type="button" id="tas-ct-explorer" class="tas-ct-btn" aria-label="Open explorer">Explorer</button>
      </div>` : '');

  const overlay = document.createElement('div');
  overlay.id = 'token-action-sheet';
  overlay.className = 'tas-overlay';

  overlay.innerHTML = `
    <div id="token-action-inner" class="tas-sheet">
      <div class="tas-grab"></div>

      <div class="tas-head">
        <div id="tas-token-icon" class="tas-icon"></div>
        <div class="tas-title">
          <div class="tas-name">${t.name}</div>
          <div class="tas-sub"><span class="tas-sym">${t.sub}</span><span>·</span><span class="tas-chain-dot"></span><span>${chainName}</span></div>
        </div>
        <button type="button" id="tas-header-chart-btn" class="tas-ib" aria-label="Price chart"><span class="material-icons-round">show_chart</span></button>
        <button type="button" id="tas-close-x" class="tas-ib" aria-label="Close"><span class="material-icons-round">close</span></button>
      </div>

      <div class="tas-bal" id="tas-bal" style="display:none;">
        <span class="tas-bal-label">Balance</span>
        <span class="tas-bal-right"><span class="tas-bal-amt" id="tas-bal-amt"></span><span class="tas-bal-usd" id="tas-bal-usd"></span></span>
      </div>

      ${ctHtml}
      <div class="tas-label">Actions</div>
      <div class="tas-list">
        <button type="button" id="tas-send-btn" class="tas-item">
          <span class="tas-ic send"><span class="material-icons-round">send</span></span>
          <span class="tas-txt"><span class="tas-t">Send</span><span class="tas-s">${t.sub} on ${chainName} pre-selected</span></span>
          <span class="material-icons-round tas-chev">chevron_right</span>
        </button>
        <button type="button" id="tas-swap-btn" class="tas-item">
          <span class="tas-ic swap"><span class="material-icons-round">swap_horiz</span></span>
          <span class="tas-txt"><span class="tas-t">Swap</span><span class="tas-s">${t.sub} to another token</span></span>
          <span class="material-icons-round tas-chev">chevron_right</span>
        </button>
        <button type="button" id="tas-bridge-btn" class="tas-item">
          <span class="tas-ic bridge"><span class="material-icons-round">alt_route</span></span>
          <span class="tas-txt"><span class="tas-t">Bridge</span><span class="tas-s">${t.sub} to another network</span></span>
          <span class="material-icons-round tas-chev">chevron_right</span>
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  // Inject DOM-based logo into action sheet header
  const tasIcon = overlay.querySelector('#tas-token-icon');
  if (tasIcon) {
    const logoEl = getTokenLogoEl(t);
    logoEl.style.width = '100%';
    logoEl.style.height = '100%';
    tasIcon.appendChild(logoEl);
  }

  // Balance row: read the live values already shown on the home token card
  (function() {
    const card = document.getElementById('token-card-' + t.id);
    const amt = ((card && card.querySelector('.token-amount')) || {}).textContent || '';
    const usd = ((card && card.querySelector('.token-usd')) || {}).textContent || '';
    if (!amt.trim()) return;
    overlay.querySelector('#tas-bal-amt').textContent = amt.trim() + ' ' + t.sub;
    overlay.querySelector('#tas-bal-usd').textContent = usd.trim();
    overlay.querySelector('#tas-bal').style.display = 'flex';
  })();

  requestAnimationFrame(() => requestAnimationFrame(() => {
    overlay.style.opacity = '1';
    overlay.querySelector('#token-action-inner').style.transform = 'none';
  }));

  function closeSheet() {
    overlay.style.opacity = '0';
    overlay.querySelector('#token-action-inner').style.transform = 'translateY(100%)';
    setTimeout(() => overlay.remove(), 260);
  }
  overlay.addEventListener('click', e => { if (e.target === overlay) closeSheet(); });
  overlay.querySelector('#tas-close-x').addEventListener('click', closeSheet);

  // Contract row: tap the address to show / hide the full address, Copy, open in explorer
  const _ctAddr = overlay.querySelector('#tas-ct-addr');
  if (_ctAddr) _ctAddr.addEventListener('click', () => {
    const txt = overlay.querySelector('#tas-ct-addr-txt');
    const full = _ctAddr.classList.toggle('open');
    txt.textContent = full ? t.contract : _tasShort;
    haptic && haptic();
  });
  const _ctCopy = overlay.querySelector('#tas-ct-copy');
  if (_ctCopy) _ctCopy.addEventListener('click', () => {
    _tasCopy(t.contract);
    haptic && haptic();
    const ic = _ctCopy.querySelector('.material-icons-round'), tx = overlay.querySelector('#tas-ct-copy-txt');
    _ctCopy.classList.add('ok'); ic.textContent = 'check'; tx.textContent = 'Copied';
    clearTimeout(_ctCopy._t);
    _ctCopy._t = setTimeout(() => { _ctCopy.classList.remove('ok'); ic.textContent = 'content_copy'; tx.textContent = 'Copy'; }, 1500);
  });
  const _ctExp = overlay.querySelector('#tas-ct-explorer');
  if (_ctExp) _ctExp.addEventListener('click', () => { _tasOpenExternal(_tasExplorerUrl(t, chainId)); haptic && haptic(); });

  // Swipe down to close: shared gesture (scripts/shared/ui/sheet-swipe-close.js)
  attachSheetSwipeClose(overlay.querySelector('#token-action-inner'), { closeFn: closeSheet });
  attachBackdropSwipeClose(overlay, closeSheet);

  overlay.querySelector('#tas-header-chart-btn').addEventListener('click', function() {
    closeSheet();
    setTimeout(() => openTokenChartFull(t), 120);
    haptic && haptic();
  });

  overlay.querySelector('#tas-send-btn').addEventListener('click', function() {
    closeSheet();
    // Determine the token id to pre-select in send modal
    const sendTokId = t.isNative ? null : t.id;
    const _homeKey = (typeof homeActiveKey !== 'undefined' && homeActiveKey) ? homeActiveKey : null;
    setTimeout(() => openSendModal(sendTokId, chainId, _homeKey), 80);
    haptic && haptic();
  });

  // ── SWAP button: sets token in swap page FROM box ──
  overlay.querySelector('#tas-swap-btn').addEventListener('click', function() {
    closeSheet();
    _swNavigateWithToken(t);
  });

  // ── BRIDGE button: sets token in bridge page FROM box ──
  overlay.querySelector('#tas-bridge-btn').addEventListener('click', function() {
    const chains = window.PRESET_CHAINS || [];
    const targetChain = chains.find(c => c.id === chainId);

    // Guard: if this token's chain is not in the bridge chain list, abort
    if (!targetChain) {
      if (typeof showToast === 'function') {
        showToast('Chain not supported in Bridge', 'link_off');
      }
      return;
    }

    closeSheet();
    // User intentionally navigating to bridge — clear disconnected flag
    // so home active key auto-connects
    try { localStorage.removeItem('one_br_disconnected'); } catch(_) {}
    const brObj = window.br;
    if (!brObj) { switchPage('bridge'); return; }

    // 1. Set fromChain
    brObj.fromChain = targetChain;
    const nameEl = document.getElementById('br-from-chain-name');
    if (nameEl) nameEl.textContent = targetChain.name;
    const emojiEl = document.getElementById('br-from-chain-emoji');
    if (emojiEl) {
      if (targetChain.logoURI) {
        emojiEl.innerHTML = `<img src="${targetChain.logoURI}" style="width:18px;height:18px;border-radius:50%;object-fit:cover;" onerror="this.parentElement.textContent='${(targetChain.emoji||'\uD83D\uDD17')}'">` ;
      } else {
        emojiEl.textContent = targetChain.emoji || '🔗';
      }
    }

    // 2. Set fromToken
    const logoURI = t.logoUrl || t.logo || t.logoURI || t.image || (typeof TOKEN_LOGOS !== 'undefined' ? TOKEN_LOGOS[t.sub] || TOKEN_LOGOS[(t.symbol||'').toUpperCase()] || '' : '') || '';
    brObj.fromToken = {
      symbol:   t.sub || t.symbol || '',
      address:  t.contract || t.address || t.contractAddress || '0x0000000000000000000000000000000000000000',
      decimals: t.decimals || 18,
      priceUSD: t.price || t.usdVal || 0,
      logoURI:  logoURI,
      name:     t.name || t.sub || '',
    };

    // 3. Update FROM token button UI
    const symEl  = document.getElementById('br-from-token-sym');
    const iconEl = document.getElementById('br-from-token-icon');
    if (symEl) symEl.textContent = t.sub;
    if (iconEl) {
      if (logoURI) {
        iconEl.innerHTML = `<img src="${logoURI}" style="width:20px;height:20px;border-radius:6px;object-fit:cover;" onerror="if(this.parentNode)this.outerHTML='<span style=\'font-size:11px;font-weight:800;\'>${t.sub.charAt(0)}</span>'">` ;
      } else {
        iconEl.innerHTML = `<span style="font-size:11px;font-weight:800;">${t.sub.charAt(0)}</span>`;
      }
    }

    // 4. Trigger brUpdateTokenBtn
    if (typeof window.brUpdateTokenBtn === 'function') window.brUpdateTokenBtn('from');

    // 5. Reload token list for new chain
    if (targetChain && typeof window.brLoadTokens === 'function') {
      window.brLoadTokens('from', chainId);
    }

    // ── Auto-connect home wallet to bridge sender ──
    (async function _brAutoConnectHomeWallet() {
      try {
        var brObj2 = window.br;
        if (!brObj2) return;

        // Skip if user explicitly disconnected
        var _dis = false;
        try { _dis = !!localStorage.getItem('one_br_disconnected'); } catch(_) {}
        if (_dis) return;

        // Restore manually-selected wallet if exists
        var _sv2 = null;
        try { _sv2 = JSON.parse(localStorage.getItem('one_br_sender') || 'null'); } catch(_) {}
        // AES decrypt encPk if present
        if (_sv2 && _sv2.addr && _sv2.encPk) {
          try {
            var _dp2 = await OneCrypto.decrypt(_sv2.encPk);
            if (_dp2) { _sv2.pk = _dp2; } else { _sv2 = null; } // don't delete
          } catch(_) { _sv2 = null; } // don't delete
        } else if (_sv2 && (_sv2.pk || _sv2.encPk) && !_sv2.encPk) {
          // Legacy plaintext — re-encrypt
          try {
            var _reEnc2 = await OneCrypto.encrypt(_sv2.pk);
            localStorage.setItem('one_br_sender', JSON.stringify({ addr: _sv2.addr, encPk: _reEnc2 }));
          } catch(_) {}
        }
        if (_sv2 && _sv2.addr && _sv2.pk) {
          try { var _nv2 = _sv2.pk.startsWith('0x') ? _sv2.pk : '0x' + _sv2.pk; new ethers.Wallet(_nv2); } catch(_) { localStorage.removeItem('one_br_sender'); _sv2 = null; }
        }
        if (_sv2 && _sv2.addr && _sv2.pk) {
          brObj2.senderAddr = _sv2.addr;
          brObj2.senderKey  = _sv2.pk;
          if (typeof brUpdateSenderRow === 'function') brUpdateSenderRow();
          if (typeof _brShowCachedBalance === 'function') _brShowCachedBalance('from');
          setTimeout(function() { if (typeof brFetchFromBalance === 'function') brFetchFromBalance(); }, 0);
          return;
        }

        var _hk = (typeof homeActiveKey !== 'undefined' && homeActiveKey) ? homeActiveKey : null;
        if (!_hk) {
          try { var _s = _oneGetSelectedKey(); if (_s) _hk = _s; } catch(_) {}
        }
        if (!_hk) return;
        var _norm = _hk.startsWith('0x') ? _hk : '0x' + _hk;
        var _hAddr = '';
        try { _hAddr = new ethers.Wallet(_norm).address; } catch(_e) { return; }
        if (!_hAddr) return;
        brObj2.senderAddr = _hAddr;
        brObj2.senderKey  = _hk;
        // Do NOT write to one_br_sender for auto-connect
        if (typeof brUpdateSenderRow === 'function') brUpdateSenderRow();
        if (typeof _brShowCachedBalance === 'function') _brShowCachedBalance('from');
        setTimeout(function() {
          if (typeof brFetchFromBalance === 'function') brFetchFromBalance();
        }, 300);
      } catch(_e) {}
    })();

    switchPage('bridge');
    haptic && haptic();
  });
}