
// ── Build chain chips for send modal ──
function buildSendChainList(preChainId) {
  const row = document.getElementById('send-chain-row');
  if (!row) return;
  row.innerHTML = '';

  const chains = getAllChains().filter(c => c.chainId !== null);
  chains.forEach(chain => {
    const chip = document.createElement('div');
    chip.className = 'send-chain-chip' + (chain.chainId === sendSelectedChainId ? ' selected' : '');
    chip.dataset.chainId = chain.chainId;

    // Try to get logoURI from PRESET_CHAINS
    const preset = (window.PRESET_CHAINS || []).find(p => p.id === chain.chainId);
    const logoURI = preset?.logoURI || null;
    const emojiHtml = logoURI
      ? `<img src="${logoURI}" style="width:18px;height:18px;border-radius:50%;object-fit:cover;" onerror="if(this.parentNode)this.outerHTML='<span class=send-chain-emoji>${chain.emoji}</span>'">`
      : `<span class="send-chain-emoji">${chain.emoji}</span>`;

    chip.innerHTML = `${emojiHtml}<span>${chain.name}</span>`;
    chip.onclick = () => selectSendChain(chain.chainId);
    row.appendChild(chip);
  });
}

function selectSendChain(chainId) {
  sendSelectedChainId = chainId;
  try { localStorage.setItem('one_send_chain_id', String(chainId)); } catch(e) {}
  // Update chip styles
  document.querySelectorAll('.send-chain-chip').forEach(c => {
    c.classList.toggle('selected', parseInt(c.dataset.chainId) === chainId);
  });
  // Update header badge
  const chain = getAllChains().find(c => c.chainId === chainId);
  const nameEl = document.getElementById('send-network-name');
  if (nameEl && chain) nameEl.textContent = chain.name.toUpperCase();
  // Rebuild token list for new chain
  buildSendTokenList();
  // Reset wallet + balances since chain changed
  sendWallet = null; sendProvider = null; sendBalances = {};
  document.querySelectorAll('.send-token-bal').forEach(el => { el.textContent = '—'; });
  (document.getElementById('send-bal-display') || {}).textContent = 'Balance: —';
  if (typeof _updateSendSliderUI === 'function') _updateSendSliderUI(0);
  const _src = document.getElementById('send-review-card'); if (_src) _src.style.display = 'none';
  (document.getElementById('send-btn') || {}).disabled = true;
  // Re-init wallet if key already entered
  const pk = document.getElementById('send-pk')?.value?.trim();
  if (pk && pk.length > 10) {
    onSendPkInput(pk);
  } else if (sendSelectedKeyIndex >= 0) {
    selectSendKey(sendSelectedKeyIndex);
  } else if (sendWallet) {
    // Wallet already loaded (e.g. key selector mode) — just fetch balances for new chain
    const addr = sendWallet.address;
    const rawPk = (typeof _sendFromSelectedPk !== 'undefined' && _sendFromSelectedPk) || '';
    getSendProvider().then(provider => {
      sendProvider = provider;
      sendWallet = sendWallet.connect ? sendWallet.connect(provider) : sendWallet;
      fetchSendBalancesDynamic(addr, rawPk, false).catch(() => {});
    }).catch(() => {
      fetchSendBalancesDynamic(addr, rawPk, false).catch(() => {});
    });
  }
  haptic();
}

function buildSendTokenList() {
  const row = document.getElementById('send-token-row');
  if (row) row.innerHTML = '';

  const chainId = sendSelectedChainId;
  // Get all tokens for this chain
  const allTokens = loadSavedTokens().filter(t => (t.chainId || 8453) === chainId);
  const nativeToken = allTokens.find(t => t.isNative);
  const erc20Tokens = allTokens.filter(t => !t.isNative && t.contract && /^0x[0-9a-fA-F]{40}$/.test(t.contract));

  // Native token chip (always first)
  const nativeSym = nativeToken?.sub || getAllChains().find(c => c.chainId === chainId)?.nativeSym || 'ETH';
  const nativeId = nativeToken?.id || 'eth';
  const nativeColor = nativeToken?.color || '#6366f1';

  const ethChip = document.createElement('div');
  ethChip.className = 'send-token-chip' + (sendSelectedToken === nativeId || sendSelectedToken === 'eth' ? ' selected' : '');
  ethChip.id = 'send-chip-native';

  // Native icon — use DOM logo if token exists, else letter fallback
  const nativeIconWrap = document.createElement('div');
  nativeIconWrap.className = 'send-token-icon';
  nativeIconWrap.style.background = nativeColor + '22';
  if (nativeToken) {
    nativeIconWrap.appendChild(getTokenLogoEl(nativeToken));
  } else {
    const fb = document.createElement('div');
    fb.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;';
    fb.style.color = nativeColor;
    fb.textContent = nativeSym.charAt(0);
    nativeIconWrap.appendChild(fb);
  }

  const nativeNameEl = document.createElement('div');
  nativeNameEl.className = 'send-token-name';
  nativeNameEl.innerHTML = nativeSym;

  const nativeBalEl = document.createElement('div');
  nativeBalEl.className = 'send-token-bal';
  nativeBalEl.id = 'send-bal-native';
  nativeBalEl.textContent = '—';

  ethChip.appendChild(nativeIconWrap);
  ethChip.appendChild(nativeNameEl);
  ethChip.appendChild(nativeBalEl);
  ethChip.onclick = () => {
    selectSendTokenDynamic(nativeId, ethChip);
    if (nativeId !== 'eth') { sendBalances['eth'] = sendBalances[nativeId]; }
  };
  row.appendChild(ethChip);
  // Normalise selection
  if (sendSelectedToken === 'eth') sendSelectedToken = nativeId;

  // ERC-20 tokens for this chain
  erc20Tokens.forEach(t => {
    const chipId = 'send-chip-' + t.id;
    const balId  = 'send-bal-' + t.id;
    const chip = document.createElement('div');
    chip.className = 'send-token-chip' + (sendSelectedToken === t.id ? ' selected' : '');
    chip.id = chipId;

    // Icon container — use DOM-based logo so CoinGecko async update works
    const iconWrap = document.createElement('div');
    iconWrap.className = 'send-token-icon';
    iconWrap.style.background = (t.color || '#6366f1') + '22';
    iconWrap.appendChild(getTokenLogoEl(t));

    const nameEl2 = document.createElement('div');
    nameEl2.className = 'send-token-name';
    nameEl2.textContent = t.sub;

    const balEl = document.createElement('div');
    balEl.className = 'send-token-bal';
    balEl.id = balId;
    balEl.textContent = '—';

    chip.appendChild(iconWrap);
    chip.appendChild(nameEl2);
    chip.appendChild(balEl);
    chip.onclick = () => selectSendTokenDynamic(t.id, chip);
    row.appendChild(chip);
  });

  // If no chip is selected yet, select native
  const hasSelected = row.querySelector('.send-token-chip.selected');
  if (!hasSelected) {
    sendSelectedToken = nativeId;
    ethChip.classList.add('selected');
  }

  // Update review-network
  const chain = getAllChains().find(c => c.chainId === chainId);
  const rvNet = document.getElementById('review-network');
  if (rvNet && chain) rvNet.textContent = chain.name;
  const nameEl = document.getElementById('send-network-name');
  if (nameEl && chain) nameEl.textContent = chain.name.toUpperCase();

  // Reset drag scroll
  setTimeout(() => { const r2 = document.getElementById('send-token-row'); if (r2) r2._dragInited = false; }, 50);
}

function selectSendTokenDynamic(tokenId, el) {
  const isReclick = (sendSelectedToken === tokenId);

  // 2nd click on already-selected token → RPC refresh
  if (isReclick && sendWallet) {
    const addr  = sendWallet.address;
    // Key selector mode stores pk in _sendFromSelectedPk; manual input uses send-pk field
    const rawPk = (typeof _sendFromSelectedPk !== 'undefined' && _sendFromSelectedPk)
      ? _sendFromSelectedPk
      : (document.getElementById('send-pk')?.value?.trim() || '');
    fetchSendBalancesDynamic(addr, rawPk, true).catch(function() {});
    haptic();
    return;
  }

  sendSelectedToken = tokenId;
  document.querySelectorAll('.send-token-chip').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');

  // Reset amount + slider on token switch
  const amtEl = document.getElementById('send-amount');
  if (amtEl) { amtEl.value = ''; amtEl.dataset.fullVal = ''; }
  if (typeof _updateSendSliderUI === 'function') _updateSendSliderUI(0);

  // Update review token name
  if (tokenId === 'eth') {
    (document.getElementById('review-token') || {}).textContent = 'ETH';
  } else {
    const tok = loadSavedTokens().find(t => t.id === tokenId);
    (document.getElementById('review-token') || {}).textContent = tok ? tok.sub : tokenId.toUpperCase();
  }

  // Show cached balance immediately (no RPC on first select)
  updateSendBalDisplayDynamic();
  onSendAmountInput();
  haptic();
}

function updateSendBalDisplayDynamic() {
  const tok = sendSelectedToken;
  const nativeTok = loadSavedTokens().find(t => (t.chainId || 8453) === sendSelectedChainId && t.isNative);
  const nativeId  = nativeTok ? nativeTok.id : 'eth';
  const bal = sendBalances[tok] || sendBalances[nativeId] || '0';
  let symbol = nativeTok?.sub || getAllChains().find(c => c.chainId === sendSelectedChainId)?.nativeSym || 'ETH';
  if (tok !== 'eth' && tok !== nativeId) {
    const t = loadSavedTokens().find(t => t.id === tok);
    symbol = t ? t.sub : tok.toUpperCase();
  }
  const balNum = parseFloat(bal);
  const balStr = _fmtBalDisplay(balNum);
  (document.getElementById('send-bal-display') || {}).textContent = 'Balance: ' + balStr + ' ' + symbol;
  // Re-check send readiness — balance may now allow button to enable
  if (typeof checkSendReady === 'function') checkSendReady();
}

async function fetchSendBalancesDynamic(addr, pkForCache, forceRpc) {
  // ── Use home screen _balanceCache instead of making new RPC calls ──
  // Cache key uses last 8 chars of PRIVATE KEY (same as home screen), not address
  const rawPk = pkForCache || (typeof _sendFromSelectedPk !== 'undefined' && _sendFromSelectedPk) || (document.getElementById('send-pk')?.value?.trim() || '');
  const fullPk = rawPk.startsWith('0x') ? rawPk : '0x' + rawPk;
  const walletSuffix = fullPk.length === 66 ? fullPk.slice(-8).toLowerCase() : '';
  const allHomeKeys  = Object.keys(window._balanceCache || {});

  // Find all cache keys that match this wallet address suffix
  const matchKeys = allHomeKeys.filter(k => k.toLowerCase().endsWith(':' + walletSuffix));

  const nativeTok = loadSavedTokens().find(t => (t.chainId || 8453) === sendSelectedChainId && t.isNative);
  const nativeId  = nativeTok ? nativeTok.id : 'eth';
  const allChainTokens = loadSavedTokens().filter(t => (t.chainId || 8453) === sendSelectedChainId);

  let foundAny = false;

  allChainTokens.forEach(t => {
    // Cache key format: tokenId:chainId:walletSuffix
    const cacheKey = matchKeys.find(k => k.startsWith(t.id + ':' + ((t.chainId || 8453)) + ':'));
    if (cacheKey !== undefined) {
      const bal = window._balanceCache[cacheKey];
      if (bal !== undefined && bal !== null) {
        sendBalances[t.id] = String(bal);
        if (t.isNative) {
          sendBalances['eth'] = String(bal);
        }
        // Update chip balance label
        const elId = t.isNative ? 'send-bal-native' : ('send-bal-' + t.id);
        const el = document.getElementById(elId);
        if (el) {
          const val = parseFloat(bal);
          el.textContent = val < 0.0001 && val > 0 ? val.toExponential(2) : val.toFixed(4);
        }
        foundAny = true;
      }
    }
  });

  updateSendBalDisplayDynamic();

  forceRpc = forceRpc === true;

  // forceRpc=true (2nd click on selected token): fetch ONLY the selected token from RPC
  if (forceRpc) {
    const selTok = sendSelectedToken;
    const isNativeSel = (selTok === 'eth' || selTok === nativeId);
    const _cid = sendSelectedChainId;
    try {
      if (isNativeSel) {
        const nativeBal = ethers.formatEther(
          await _withRpcFallback(_cid, p => p.getBalance(addr), 5000)
        );
        sendBalances[nativeId] = nativeBal;
        sendBalances['eth']    = nativeBal;
        const nativeEl = document.getElementById('send-bal-native');
        if (nativeEl) nativeEl.textContent = parseFloat(nativeBal).toFixed(4);
      } else {
        const t = loadSavedTokens().find(t => t.id === selTok && (t.chainId || 8453) === sendSelectedChainId);
        if (t && t.contract && /^0x[0-9a-fA-F]{40}$/.test(t.contract)) {
          const formatted = ethers.formatUnits(
            await _withRpcFallback(_cid, p => new ethers.Contract(t.contract, ERC20_SEND_ABI, p).balanceOf(addr), 5000),
            t.decimals || 18
          );
          sendBalances[t.id] = formatted;
          const el = document.getElementById('send-bal-' + t.id);
          if (el) {
            const val = parseFloat(formatted);
            el.textContent = val < 0.0001 && val > 0 ? val.toExponential(2) : val.toFixed(4);
          }
        }
      }
      updateSendBalDisplayDynamic();
    } catch(e) { console.warn('Balance RPC fetch (selected token):', e); }
    return;
  }

  // If no cached balance found (wallet not yet loaded on home), fallback to RPC for all tokens
  if (!foundAny) {
    const _cid = sendSelectedChainId;
    try {
      const nativeBal = ethers.formatEther(
        await _withRpcFallback(_cid, p => p.getBalance(addr), 5000)
      );
      sendBalances[nativeId] = nativeBal;
      sendBalances['eth']    = nativeBal;
      const nativeEl = document.getElementById('send-bal-native');
      if (nativeEl) nativeEl.textContent = parseFloat(nativeBal).toFixed(4);

      const myTokens = loadSavedTokens().filter(t =>
        (t.chainId || 8453) === sendSelectedChainId &&
        !t.isNative &&
        t.contract && /^0x[0-9a-fA-F]{40}$/.test(t.contract)
      );
      await Promise.all(myTokens.map(async t => {
        try {
          const formatted = ethers.formatUnits(
            await _withRpcFallback(_cid, p => new ethers.Contract(t.contract, ERC20_SEND_ABI, p).balanceOf(addr), 5000),
            t.decimals || 18
          );
          sendBalances[t.id] = formatted;
          const el = document.getElementById('send-bal-' + t.id);
          if (el) {
            const val = parseFloat(formatted);
            el.textContent = val < 0.0001 && val > 0 ? val.toExponential(2) : val.toFixed(4);
          }
        } catch { sendBalances[t.id] = '0'; }
      }));
      updateSendBalDisplayDynamic();
    } catch(e) { console.warn('Balance fetch fallback:', e); }
  }
}

function openSendModal(preTokenId, preChainId, preFromPk) {
  // Set chain before building lists
  if (preChainId) {
    sendSelectedChainId = preChainId;
    try { localStorage.setItem('one_send_chain_id', String(preChainId)); } catch(e) {}
  } else {
    // Restore last used chain from localStorage (sendSelectedChainId already initialized from LS)
    if (!sendSelectedChainId) sendSelectedChainId = 8453;
  }

  // Set pre-selected token id (will be applied in buildSendTokenList)
  if (preTokenId) sendSelectedToken = preTokenId;
  else {
    // Reset to native of selected chain
    const nativeTok = loadSavedTokens().find(t => (t.chainId || 8453) === sendSelectedChainId && t.isNative);
    sendSelectedToken = nativeTok ? nativeTok.id : 'eth';
  }

  document.getElementById('send-overlay')?.classList.add('open');
  // Reset any stale inline transform left by swipe-to-close gesture
  const _sendModalEl = document.querySelector('#send-overlay .send-modal');
  if (_sendModalEl) _sendModalEl.style.transform = '';

  // Build chain selector
  buildSendChainList();

  // Build dynamic token list from MY TOKENS (filtered by chain)
  buildSendTokenList();

  // Reset UI
  (document.getElementById('send-to') || {}).value = '';
  const _amtElReset = document.getElementById('send-amount');
  if (_amtElReset) { _amtElReset.value = ''; _amtElReset.dataset.fullVal = ''; }
  (document.getElementById('send-status') || {}).className = 'send-status';
  (document.getElementById('send-status') || {}).textContent = '';
  const _src1 = document.getElementById('send-review-card'); if (_src1) _src1.style.display = 'none';
  (document.getElementById('send-btn') || {}).disabled = true;
  (document.getElementById('send-amount-usd') || {}).textContent = '≈ $0.00';
  (document.getElementById('send-bal-display') || {}).textContent = 'Balance: —';
  if (typeof _updateSendSliderUI === 'function') _updateSendSliderUI(0);

  // Build key selector or show manual input
  if (validatedKeys.length > 0) {
    buildSendKeyList();
    const _sks = document.getElementById('send-key-selector'); if (_sks) _sks.style.display = 'block';
    const badge = document.getElementById('send-key-count-badge');
    if (badge) badge.style.display = 'inline-block';
    if (badge) badge.textContent = validatedKeys.length + ' KEYS';
    // Restore last selected wallet from localStorage (or use preFromPk from home)
    let _restoreIdx = -1;
    let _savedPkRestore = null;
    try {
      // one_send_from_pk is AES-encrypted — raw value only used if already in memory
      const _savedPk = (preFromPk && preFromPk.length >= 60) ? preFromPk : null; // encrypted LS value resolved async below
      if (_savedPk) {
        _savedPkRestore = _savedPk;
        const _norm = (k) => String(k||'').trim().replace(/^0x/i,'').toLowerCase();
        const _found = validatedKeys.findIndex(k => _norm(k) === _norm(_savedPk));
        if (_found !== -1) _restoreIdx = _found;
      }
    } catch(e) {}
    if (_restoreIdx !== -1) {
      // Found in validatedKeys — normal flow
      selectSendKey(_restoreIdx);
    } else if (_savedPkRestore && _savedPkRestore.length >= 60) {
      // Saved pk not in validatedKeys (WalletGroup key) — restore box directly
      _sendFromSelectedPk = _savedPkRestore;
      _sendBoxLocked = false;
      const _meta = _getWalletGroupMeta(_savedPkRestore);
      const _gName = _meta ? _meta.groupName : null;
      const _wNum = _meta ? _meta.walletNum : 1;
      _updateSendSelectedBox(_savedPkRestore, _gName, _wNum, _wNum);
      try { document.getElementById('send-pk') && (document.getElementById('send-pk').value = _savedPkRestore); } catch(e) {}
      onSendPkInput(_savedPkRestore);
    } else {
      // No saved key — default to first
      selectSendKey(0);
    }
  } else {
    const _sks2 = document.getElementById('send-key-selector'); if (_sks2) _sks2.style.display = 'none';
    const _skcb = document.getElementById('send-key-count-badge'); if (_skcb) _skcb.style.display = 'none';
    _clearSendSelectedBox(); // reset box first
    // Restore last selected wallet from localStorage
    setTimeout(() => {
      if (typeof _restoreSendFromWallet === 'function') _restoreSendFromWallet();
      try {
        const _rawPk2 = localStorage.getItem('one_send_from_pk');
        if (_rawPk2) {
          // AES-decrypt before use
          Promise.resolve(OneCrypto.decrypt(_rawPk2)).then(function(_savedPk2) {
            if (!_savedPk2 || _savedPk2.length < 60) return;
            const _meta2 = _getWalletGroupMeta(_savedPk2);
            if (_meta2) {
              _sendFromSelectedPk = _savedPk2;
              _sendBoxLocked = false;
              _updateSendSelectedBox(_savedPk2, _meta2.groupName, _meta2.walletNum, _meta2.walletNum);
            }
          }).catch(function(){});
        }
      } catch(e) {}
    }, 80);
  }
  haptic();
}

// ── Unified selected wallet box helpers ──
function _updateSendSelectedBox(pk, groupName, walletNum, displayNum) {
  if (_sendBoxLocked) return; // deselected state — don't show box
  let addr = '';
  try { addr = new ethers.Wallet(pk).address; } catch(e) {}
  const box   = document.getElementById('send-selected-wallet-box');
  const num   = document.getElementById('send-sel-wallet-num');
  const label = document.getElementById('send-sel-wallet-label');
  const addrEl= document.getElementById('send-sel-wallet-addr');
  if (!box) return;
  if (num) num.textContent = displayNum || walletNum || 1;
  if (label) {
    if (groupName) {
      label.innerHTML =
        '<span style="font-weight:700;color:var(--text-primary);">' + groupName + '</span>' +
        ' <span style="color:var(--neon-purple);font-weight:700;">#' + walletNum + '</span>';
    } else {
      label.innerHTML = '<span style="color:var(--text-secondary);font-weight:600;">Wallet #' + walletNum + '</span>';
    }
  }
  if (addrEl) addrEl.textContent = addr;
  _showSendSelectedBox();
}