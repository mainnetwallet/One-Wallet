
  window.brOpenTxExplorer = function () {
    if (!br.txHash) return;
    window.open((BR_EXPLORERS[br.fromChain.id]||(window.getTHExplorerTx ? window.getTHExplorerTx(br.fromChain.id) : 'https://etherscan.io/tx/'))+br.txHash,'_blank','noopener');
  };

  // ════════════════════════════════════════
  // WALLET PANEL (right-side drawer)
  // ════════════════════════════════════════
  function _brAutoExpandGroup(targetAddr) {
    if (!targetAddr) return;
    const _gs = loadGroups();
    for (let _gi = 0; _gi < _gs.length; _gi++) {
      for (const _pk of (_gs[_gi].keys || [])) {
        try {
          const _n = _pk.startsWith('0x') ? _pk : '0x' + _pk;
          if (new ethers.Wallet(_n).address.toLowerCase() === targetAddr.toLowerCase()) {
            brExpandedGroupIdx = _gi; return;
          }
        } catch(_) {}
      }
    }
  }

  window.brOpenWalletPanel = async function () {
    br.walletPanelTarget = 'sender';
    $e('br-wallet-panel-title').textContent = 'Select Sender';
    $e('br-wallet-panel-sub').textContent   = 'FROM wallet (signer)';
    // Auto-expand group of currently selected sender wallet
    if (br.senderAddr) _brAutoExpandGroup(br.senderAddr);
    brRenderWalletPanel();
    // clear key input
    const ki = $e('br-key-input'); if (ki) ki.value = '';
    const kp = $e('br-key-preview'); if (kp) { kp.textContent = ''; kp._pk = null; kp._addr = null; }
    const overlay = $e('br-wallet-panel-overlay');
    const panel   = $e('br-wallet-panel');
    overlay.style.pointerEvents = 'all';
    overlay.style.opacity = '1';
    panel.style.transform = 'translateX(0)';
    haptic && haptic();
  };

  window.brOpenRecipientPanel = async function () {
    br.walletPanelTarget = 'recipient';
    $e('br-wallet-panel-title').textContent = 'Select Recipient';
    $e('br-wallet-panel-sub').textContent   = 'TO wallet (receives funds)';
    // Auto-expand group of currently selected recipient (or sender fallback)
    const _rTarget = br.recipientAddr || br.senderAddr;
    if (_rTarget) _brAutoExpandGroup(_rTarget);
    brRenderWalletPanel();
    const overlay = $e('br-wallet-panel-overlay');
    const panel   = $e('br-wallet-panel');
    overlay.style.pointerEvents = 'all';
    overlay.style.opacity = '1';
    panel.style.transform = 'translateX(0)';
    haptic && haptic();
  };

  window.brCloseWalletPanel = function () {
    const overlay = $e('br-wallet-panel-overlay');
    const panel   = $e('br-wallet-panel');
    overlay.style.opacity = '0';
    panel.style.transform = 'translateX(100%)';
    setTimeout(() => { overlay.style.pointerEvents = 'none'; }, 260);
  };

  // track which group is expanded in panel
  let brExpandedGroupIdx = -1;

  async function brRenderWalletPanel() {
    const body = $e('br-wallet-panel-body');
    if (body) body.innerHTML = '<div style="text-align:center;padding:24px 12px;font-family:var(--font-mono);font-size:11px;color:var(--text-muted);">Loading wallets…</div>';
    // Decrypt groups — keys may be AES-encrypted (ncx4:...)
    let groups = [];
    try {
      const rawGroups = loadGroups();
      groups = await OneCrypto.decryptGroups(rawGroups);
    } catch(_) {
      groups = loadGroups(); // fallback to raw if decrypt fails
    }
    if (body) body.innerHTML = '';
    body.style.display = 'flex';
    body.style.flexDirection = 'column';
    body.style.overflowY = 'auto';

    if (!groups.length) {
      if (body) body.innerHTML = '<div style="text-align:center;padding:24px 12px;font-family:var(--font-mono);font-size:11px;color:var(--text-muted);line-height:1.8;">No wallet groups.<br>Go to Settings → Wallet Groups.</div>';
      return;
    }

    groups.forEach((g, gi) => {
      const isExpanded = gi === brExpandedGroupIdx;

      // Group header - clickable accordion
      const ghdr = document.createElement('div');
      ghdr.style.cssText = 'flex-shrink:0;display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:11px;margin-bottom:4px;cursor:pointer;border:1px solid ' + (isExpanded ? 'rgba(99,102,241,0.4)' : 'var(--border-subtle)') + ';background:' + (isExpanded ? 'rgba(99,102,241,0.1)' : 'var(--bg-glass)') + ';transition:all 0.2s;';
      ghdr.innerHTML =
        '<span class="material-icons-round" style="font-size:16px;color:' + (isExpanded ? 'var(--accent-primary)' : 'var(--text-muted)') + ';">' + (isExpanded ? 'folder_open' : 'folder') + '</span>' +
        '<div style="flex:1;">' +
          '<div style="font-size:12px;font-weight:700;color:' + (isExpanded ? 'var(--text-primary)' : 'var(--text-secondary)') + ';">' + g.name + '</div>' +
          '<div style="font-size:9px;font-family:var(--font-mono);color:var(--text-muted);margin-top:1px;">' + g.keys.length + ' KEYS</div>' +
        '</div>' +
        '<span class="material-icons-round" style="font-size:16px;color:var(--text-muted);transform:' + (isExpanded ? 'rotate(180deg)' : 'rotate(0deg)') + ';transition:transform 0.25s;">expand_more</span>';

      ghdr.addEventListener('click', async function(e) {
        e.stopPropagation();
        brExpandedGroupIdx = isExpanded ? -1 : gi;
        await brRenderWalletPanel();
      });
      body.appendChild(ghdr);

      if (!isExpanded) return;

      // Wallet items
      const itemsWrap = document.createElement('div');
      itemsWrap.style.cssText = 'flex:1;overflow-y:auto;overflow-x:hidden;padding:0 4px 8px;scrollbar-width:none;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;';

      g.keys.forEach(function(pk, wi) {
        const addr = deriveAddress(pk);
        if (!addr) return;

        const isCurSender    = br.walletPanelTarget === 'sender'    && addr === br.senderAddr;
        const isCurRecipient = br.walletPanelTarget === 'recipient' && addr === br.recipientAddr;
        const isActive = isCurSender || isCurRecipient;

        const item = document.createElement('div');
        item.style.cssText = 'display:flex;align-items:center;gap:8px;padding:9px 10px;border-radius:10px;border:1px solid ' + (isActive ? 'rgba(99,102,241,0.5)' : 'var(--border-subtle)') + ';background:' + (isActive ? 'rgba(99,102,241,0.12)' : 'var(--bg-glass)') + ';cursor:pointer;margin-bottom:5px;transition:all 0.15s;';

        const walletNum = document.createElement('div');
        walletNum.style.cssText = 'width:24px;height:24px;border-radius:7px;background:rgba(99,102,241,0.15);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;font-family:var(--font-mono);color:var(--neon-purple);flex-shrink:0;';
        if (walletNum) walletNum.textContent = wi + 1;

        const info = document.createElement('div');
        info.style.cssText = 'flex:1;min-width:0;';
        info.innerHTML =
          '<div style="font-family:var(--font-mono);font-size:11px;font-weight:700;color:' + (isActive ? 'var(--accent-primary)' : 'var(--text-primary)') + ';">' + addr.slice(0,6) + '…' + addr.slice(-4) + '</div>' +
          '<div style="font-size:9px;color:var(--text-muted);font-family:var(--font-mono);margin-top:1px;">' + addr.slice(0,12) + '…</div>';

        const right = document.createElement('span');
        right.className = 'material-icons-round';
        right.style.cssText = 'font-size:16px;color:' + (isActive ? 'var(--accent-primary)' : 'var(--text-muted)') + ';flex-shrink:0;';
        if (right) right.textContent = isActive ? 'check_circle' : 'radio_button_unchecked';

        item.appendChild(walletNum);
        item.appendChild(info);
        item.appendChild(right);
        item.addEventListener('click', function(e) { e.stopPropagation(); brSelectWalletFromPanel(pk, addr); });
        itemsWrap.appendChild(item);
      });

      body.appendChild(itemsWrap);
    });
  }

  // ── Key input in wallet panel ──
  window.brKeyInputPreview = function () {
    const raw = $e('br-key-input').value.trim();
    const prev = $e('br-key-preview');
    if (!raw) { prev.textContent = ''; prev.style.color = 'var(--text-muted)'; return; }
    // Check if it's a plain Ethereum address (0x + 40 hex chars)
    const isAddress = /^0x[0-9a-fA-F]{40}$/.test(raw);
    if (isAddress) {
      const checksumAddr = ethers.getAddress(raw);
      if (prev) prev.textContent = '📬 ' + checksumAddr.slice(0,8) + '…' + checksumAddr.slice(-6) + (br.walletPanelTarget === 'recipient' ? ' (recipient address)' : ' (address)');
      prev.style.color = 'var(--neon-cyan)';
      prev._addr = checksumAddr;
      prev._pk   = null; // no private key — address only
      return;
    }
    try {
      const pk = raw.startsWith('0x') ? raw : '0x' + raw;
      const wallet = new ethers.Wallet(pk);
      if (prev) prev.textContent = wallet.address.slice(0,8) + '…' + wallet.address.slice(-6);
      prev.style.color = 'var(--accent-green)';
      prev._addr = wallet.address;
      prev._pk   = pk;
    } catch {
      if (prev) prev.textContent = 'Invalid key or address';
      prev.style.color = 'var(--accent-red)';
      prev._addr = null;
      prev._pk   = null;
    }
  };

  window.brUseKeyInput = function () {
    const prev = $e('br-key-preview');
    const raw = $e('br-key-input').value.trim();

    // ── Case 1: plain Ethereum address (no private key needed) ──
    const isAddress = /^0x[0-9a-fA-F]{40}$/.test(raw);
    if (isAddress) {
      let addr;
      try { addr = ethers.getAddress(raw); } catch { showToast('❌ Invalid address', 'error'); return; }
      // For recipient target — set address directly without needing private key
      if (br.walletPanelTarget === 'recipient') {
        br.recipientAddr = addr;
        const inp = $e('br-recipient');
        if (inp) { inp.value = addr; }
        const clearBtn = $e('br-recipient-clear');
        if (clearBtn) clearBtn.style.display = 'flex';
        if (typeof brUpdateRecipientDisplay === 'function') brUpdateRecipientDisplay(false);
        $e('br-key-input').value = '';
        if (prev) { prev.textContent = ''; prev._pk = null; prev._addr = null; }
        brCloseWalletPanel();
        showToast('✅ Recipient set: ' + addr.slice(0,6) + '…' + addr.slice(-4), 'person');
        // Re-fetch routes with new recipient
        const amt = parseFloat($e('br-from-amount').value);
        if (amt > 0 && br.senderAddr) {
          clearTimeout(br.recipientDebounce);
          br.recipientDebounce = setTimeout(function() { brFetchRoutes(); }, 300);
        }
        return;
      }
      // For sender target — address only (no signing capability), show warning
      showToast('⚠️ Sender needs a private key to sign', 'warning');
      return;
    }

    // ── Case 2: private key ──
    if (!prev._pk || !prev._addr) {
      // try parse fresh
      if (!raw) return;
      try {
        const pk = raw.startsWith('0x') ? raw : '0x' + raw;
        const wallet = new ethers.Wallet(pk);
        prev._pk   = pk;
        prev._addr = wallet.address;
      } catch { showToast('❌ Invalid private key', 'error'); return; }
    }
    brSelectWalletFromPanel(prev._pk, prev._addr);
    // clear input after use
    $e('br-key-input').value = '';
    if (prev) prev.textContent = '';
    prev._pk = null; prev._addr = null;
  };

  function brSelectWalletFromPanel(pk, addr) {
    if (br.walletPanelTarget === 'sender') {
      if (br.senderAddr === addr) {
        // deselect — same wallet clicked again
        br.senderAddr = '';
        br.senderKey  = '';
        br._fromBalance = null;
        try { localStorage.removeItem('one_br_sender'); } catch(_) {}
        try { localStorage.setItem('one_br_disconnected', '1'); } catch(_) {}
        brUpdateSenderRow();
        brResetRoutes();
        // Reset balance display but keep rows visible
        const _fbv2 = document.getElementById('br-from-balance-val');
        if (_fbv2) { _fbv2.innerHTML = '—&nbsp;<span class="material-icons-round" style="font-size:10px;color:var(--text-muted);pointer-events:none;">refresh</span>'; _fbv2.style.color = 'var(--text-secondary)'; }
        // Reset slider UI
        brUpdateSliderUI(0);
        brRenderWalletPanel();
        haptic && haptic();
        return; // don't close panel
      }
      br.senderAddr = addr;
      br.senderKey  = pk;
      br._fromBalance = null;
      try {
        OneCrypto.encrypt(pk).then(function(_encSel) {
          localStorage.setItem('one_br_sender', JSON.stringify({ addr: addr, encPk: _encSel }));
        }).catch(function(_) {});
      } catch(_) {}
      try { localStorage.removeItem('one_br_disconnected'); } catch(_) {}
      brUpdateSenderRow();
      brResetRoutes();
      _brShowCachedBalance('from');
      // TO box also uses sender wallet when recipient is not set
      if (!br.recipientAddr) _brShowCachedBalance('to');
      // Auto-fetch routes if amount already entered
      const _selAmt = parseFloat($e('br-from-amount').value);
      if (_selAmt > 0) {
        clearTimeout(br.quoteDebounce);
        br.quoteDebounce = setTimeout(function() { brFetchRoutes(); }, 400);
      }
    } else {
      // Recipient selected via panel — update field + show clear btn
      if (br.recipientAddr === addr) {
        // deselect — same wallet clicked again → reset to sender default
        br.recipientAddr = '';
        const _rInpD = $e('br-recipient');
        if (_rInpD) _rInpD.value = '';
        const _rClearD = $e('br-recipient-clear');
        if (_rClearD) _rClearD.style.display = 'none';
        if (typeof brUpdateRecipientDisplay === 'function') brUpdateRecipientDisplay(false);
        brRenderWalletPanel();
        haptic && haptic();
        // Re-fetch routes so toAddress reverts to sender default
        const _dAmt = parseFloat($e('br-from-amount').value);
        if (_dAmt > 0 && br.senderAddr) {
          clearTimeout(br.recipientDebounce);
          br.recipientDebounce = setTimeout(function() { brFetchRoutes(); }, 300);
        } else {
          brResetRoutes();
        }
        brCloseWalletPanel();
        return;
      }
      br.recipientAddr = addr;
      const _rInp = $e('br-recipient');
      if (_rInp) _rInp.value = addr;
      const _rClear = $e('br-recipient-clear');
      if (_rClear) _rClear.style.display = addr ? 'flex' : 'none';
      if (typeof brUpdateRecipientDisplay === 'function') brUpdateRecipientDisplay(false);
      // Re-fetch routes so the new toAddress is baked into LiFi calldata.
      // Delay slightly so the panel close animation completes first,
      // preventing the closing panel's DOM updates from interfering with focus.
      const _pAmt = parseFloat($e('br-from-amount').value);
      if (_pAmt > 0 && br.senderAddr) {
        clearTimeout(br.recipientDebounce);
        br.recipientDebounce = setTimeout(function() { brFetchRoutes(); }, 300);
      }
    }
    brCloseWalletPanel();
    haptic && haptic();
  }

  // ════════════════════════════════════════
  // BRIDGE SETTINGS SHEET
  // ════════════════════════════════════════
  window.brOpenSettings = function () {
    const modal = document.getElementById('br-settings-modal');
    if (!modal) return;
    if (typeof window._swBlurActiveInput === 'function') window._swBlurActiveInput();
    if (modal.parentElement !== document.body) document.body.appendChild(modal);
    modal.classList.add('sw-open');
    document.body.style.overflow = 'hidden';
    haptic && haptic();
  };
  window.brCloseSettings = function () {
    const modal = document.getElementById('br-settings-modal');
    if (!modal) return;
    modal.classList.remove('sw-open');
    setTimeout(function () { document.body.style.overflow = ''; }, 300);
  };

  // ════════════════════════════════════════
  // SLIPPAGE
  // ════════════════════════════════════════
  window.brSelectSlip = function (el, val) {
    document.querySelectorAll('.br-slip-chip').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');
    // hide custom input unless Custom selected
    const customWrap = $e('br-slip-custom-wrap');
    if (val === 'auto') {
      br.slippage = 0.5; // auto = LiFi picks best, we pass 0.5 as default
      br.slippageAuto = true;
      if (customWrap) customWrap.style.display = 'none';
    } else {
      br.slippage = parseFloat(val);
      br.slippageAuto = false;
      if (customWrap) customWrap.style.display = 'none';
    }
    brResetRoutes();
  };

  window.brToggleCustomSlip = function () {
    document.querySelectorAll('.br-slip-chip').forEach(c => c.classList.remove('selected'));
    $e('br-slip-custom-btn').classList.add('selected');
    const wrap = $e('br-slip-custom-wrap');
    wrap.style.display = 'block';
    $e('br-slip-custom-input').focus();
    br.slippageAuto = false;
  };

  window.brApplyCustomSlip = function () {
    const v = parseFloat($e('br-slip-custom-input').value);
    if (v > 0 && v <= 50) { br.slippage = v; brResetRoutes(); }
  };

  // ════════════════════════════════════════
  // CHAIN PICKER
  // ════════════════════════════════════════
  // ── Chain list render helper (used by open + filter) ──
  function brChainIconHTML(chain) {
    const size = 36;
    const emoji = chain.emoji || '🔗';
    if (chain.logoURI) {
      return `<span class="clogo-wrap" data-logo="${chain.logoURI}" data-fb="${(emoji).replace(/"/g,'&quot;')}" style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:10px;background:rgba(99,102,241,0.1);flex-shrink:0;"><span class="clogo-fb" style="font-size:22px;line-height:1;">${emoji}</span></span>`;
    }
    return `<div style="width:${size}px;height:${size}px;border-radius:10px;background:rgba(99,102,241,0.1);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">${emoji}</div>`;
  }

  function brRenderChainItems(chains) {
    const list  = $e('br-chain-list');
    const curId = br.pickerTarget === 'from' ? br.fromChain.id : br.toChain.id;
    const count = $e('br-chain-count');

    if (list) list.innerHTML = '';

    if (!chains.length) {
      list.innerHTML = `<div style="text-align:center;padding:40px 20px;font-family:var(--font-mono);font-size:12px;color:var(--text-muted);">
        <span class="material-icons-round" style="font-size:36px;display:block;margin-bottom:10px;color:var(--text-muted);">search_off</span>
        No chains found
      </div>`;
      if (count) count.textContent = '0 chains';
      return;
    }

    if (count) count.textContent = chains.length + ' chain' + (chains.length !== 1 ? 's' : '');

    chains.forEach(chain => {
      const active = chain.id === curId;
      const item = document.createElement('div');
      item.className = 'br-chain-item' + (active ? ' active' : '');
      item.innerHTML = `
        ${brChainIconHTML(chain)}
        <div style="flex:1;">
          <div style="font-size:14px;font-weight:700;">${chain.name}</div>
          <div style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);">Native: ${chain.nativeSym} &nbsp;·&nbsp; ID: ${chain.id}</div>
        </div>
        ${active ? '<span class="material-icons-round" style="color:var(--accent-primary);font-size:18px;">check_circle</span>' : ''}
      `;
      item.addEventListener('click', () => brSelectChain(chain));
      list.appendChild(item);
    });
    setTimeout(function(){ _fixChainLogos(list); }, 0);
  }

  window.brOpenChainPicker = function (target) {
    br.pickerTarget = target;
    // Clear search on open
    const searchEl = $e('br-chain-search');
    const clearBtn = $e('br-chain-search-clear');
    if (searchEl) { searchEl.value = ''; }
    if (clearBtn) { clearBtn.style.display = 'none'; }
    brRenderChainItems(PRESET_CHAINS);
    $e('br-chain-overlay').classList.add('open');
    haptic && haptic();
    // Auto-focus removed — prevents mobile keyboard from opening
    // Show live-updating hint if chain list is still default (small)
    const countEl = $e('br-chain-count');
    if (countEl && PRESET_CHAINS.length < 20) {
      if (countEl) countEl.innerHTML = PRESET_CHAINS.length + ' chains &nbsp;<span style="color:var(--accent-primary);animation:pulse 1.5s infinite;">● fetching live list…</span>';
    }
  };