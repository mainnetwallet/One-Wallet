
// ── CHAIN PICKER OPEN / CLOSE ──
function openHomeChainPicker() {
  // Snapshot the active group NOW so all adds/deletes in this session go to the right group
  _hcpGroupSnapshot = (function() {
    try {
      const sel = document.getElementById('home-group-select');
      if (sel && sel.value) return sel.value;
    } catch {}
    try {
      const v = localStorage.getItem('one_hw_group_id_v2');
      if (v) return v;
    } catch {}
    try {
      const v = localStorage.getItem('one_hw_selected_group_v1');
      if (v) return v;
    } catch {}
    try {
      const v = localStorage.getItem('one_active_group');
      if (v) return v;
    } catch {}
    return null;
  })();
  renderHcpList();
  document.getElementById('hcp-overlay')?.classList.add('open');
  haptic();
}
function closeHomeChainPicker() {
  _hcpGroupSnapshot = null; // clear snapshot when picker closes
  document.getElementById('hcp-overlay')?.classList.remove('open');
  // Reset add form
  const form = document.getElementById('hcp-add-form');
  if (form) { form.style.display = 'none'; }
  const chev = document.getElementById('hcp-add-chevron');
  if (chev) chev.style.transform = '';
  // Reset tab to My Networks
  if (_hcpActiveTab !== 'my') hcpSwitchTab('my');
  haptic();
}
function hcpOverlayClick(e) {
  if (e.target === document.getElementById('hcp-overlay')) closeHomeChainPicker();
}

// ── RENDER CHAIN LIST ──
let _hcpMySearchQuery = '';
function hcpMySearch() {
  const input = document.getElementById('hcp-my-search');
  const clear = document.getElementById('hcp-my-clear');
  _hcpMySearchQuery = input ? input.value.trim().toLowerCase() : '';
  if (clear) clear.style.display = _hcpMySearchQuery ? 'block' : 'none';
  renderHcpList();
}
function hcpMyClearSearch() {
  const input = document.getElementById('hcp-my-search');
  if (input) input.value = '';
  const clear = document.getElementById('hcp-my-clear');
  if (clear) clear.style.display = 'none';
  _hcpMySearchQuery = '';
  renderHcpList();
}
function renderHcpList() {
  const list = document.getElementById('hcp-list');
  if (!list) return;
  list.innerHTML = '';

  // ── Wallet check ──
  const _rcpGroups = (typeof loadWalletGroups === 'function') ? loadWalletGroups() : [];
  const _rcpHwKey  = (typeof hwSelectedKey !== 'undefined' && hwSelectedKey);
  const _rcpHasSel = !!_rcpHwKey
    || (typeof selectedGroupIds !== 'undefined' && selectedGroupIds.length > 0)
    || (typeof activeGroupId !== 'undefined' && !!activeGroupId);
  const _walletReady = _rcpGroups.length > 0 && _rcpHasSel;

  // Hide / show "Add Chain" footer based on wallet state
  const addFooter = document.getElementById('hcp-add-footer');
  if (addFooter) addFooter.style.display = _walletReady ? '' : 'none';

  // When no wallet: only show builtin chains (no custom, no delete btn)
  let allChains = _walletReady ? getAllChains() : BUILTIN_CHAINS;

  // Apply search filter
  if (_hcpMySearchQuery) {
    allChains = allChains.filter(c =>
      c.name.toLowerCase().includes(_hcpMySearchQuery) ||
      (c.nativeSym && c.nativeSym.toLowerCase().includes(_hcpMySearchQuery)) ||
      (c.chainId && String(c.chainId).includes(_hcpMySearchQuery))
    );
    if (allChains.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:32px 0;font-family:var(--font-mono);font-size:11px;color:var(--text-muted);">No networks found</div>';
      return;
    }
  }

  allChains.forEach(chain => {
    const isSelected = (chain.chainId === null && activeHomeChainId === null) ||
                       (chain.chainId !== null && chain.chainId === activeHomeChainId);
    const tokenCount = chain.chainId === null
      ? loadSavedTokens().length
      : loadSavedTokens().filter(t => (t.chainId || 8453) === chain.chainId).length;

    const item = document.createElement('div');
    item.className = 'hcp-chain-item' + (isSelected ? ' selected' : '');
    item.style.cssText = 'position:relative;';
    item.innerHTML = `
      <div class="hcp-chain-emoji" style="${chain.color ? `border:1.5px solid ${chain.color}44;` : ''}">${
        chain.logoURI
          ? `<span class="clogo-wrap" data-logo="${chain.logoURI}" data-fb="${(chain.emoji||'🔗').replace(/"/g,'&quot;')}" style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;"><span class="clogo-fb" style="font-size:18px;line-height:1;">${chain.emoji||'🔗'}</span></span>`
          : chain.emoji
      }</div>
      <div class="hcp-chain-info">
        <div class="hcp-chain-name">${chain.name}</div>
        <div class="hcp-chain-sub">${chain.chainId ? 'Chain ID: ' + chain.chainId : 'All chains combined'} · ${tokenCount} token${tokenCount !== 1 ? 's' : ''}${!chain.builtIn && chain.rpcs ? ' · ' + chain.rpcs.length + ' RPC' : ''}</div>
      </div>
      ${isSelected ? '<span class="material-icons-round" style="font-size:18px;color:var(--accent-primary);flex-shrink:0;">check_circle</span>' : '<span style="width:18px;flex-shrink:0;"></span>'}
      ${(!chain.builtIn && _walletReady) ? `<div onclick="hcpDeleteCustomChain(event,'${chain.id}')" style="width:28px;height:28px;border-radius:8px;background:rgba(244,63,94,0.1);border:1px solid rgba(244,63,94,0.2);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;margin-left:4px;" onmousedown="this.style.opacity='.6'" onmouseup="this.style.opacity='1'" ontouchstart="this.style.opacity='.6'" ontouchend="this.style.opacity='1'"><span class="material-icons-round" style="font-size:14px;color:var(--accent-red);">delete</span></div>` : ''}
    `;
    item.addEventListener('click', function(e) {
      if (e.target.closest('[onclick*="hcpDeleteCustomChain"]')) return;
      // Clear search so token list loads fresh instantly
      _homeTokenSearchQuery = '';
      const searchEl = document.getElementById('home-token-search');
      if (searchEl) searchEl.value = '';
      const clearBtn = document.getElementById('home-token-search-clear');
      if (clearBtn) clearBtn.style.display = 'none';
      const oldEmpty = document.getElementById('home-search-empty');
      if (oldEmpty) oldEmpty.remove();
      setActiveChain(chain.chainId);
      loadTokens();
      closeHomeChainPicker();
    });
    list.appendChild(item);
  });
  // Inject chain logos after render
  setTimeout(function(){ _fixChainLogos(list); }, 0);
}

// ── TOGGLE ADD CHAIN FORM ──
let _hcpFormOpen = false;
function hcpToggleAddChain() {
  // Wallet check: must have at least one wallet group selected
  const _hcpGroups = (typeof loadWalletGroups === 'function') ? loadWalletGroups() : [];
  if (!_hcpGroups || _hcpGroups.length === 0) {
    showToast('Please add a wallet first!', 'account_balance_wallet');
    haptic();
    return;
  }
  const _hcpHwKey = (typeof hwSelectedKey !== 'undefined' && hwSelectedKey);
  const _hcpHasSel = !!_hcpHwKey
    || (typeof selectedGroupIds !== 'undefined' && selectedGroupIds.length > 0)
    || (typeof activeGroupId !== 'undefined' && !!activeGroupId);
  if (!_hcpHasSel) {
    showToast('Please select a wallet first!', 'account_balance_wallet');
    haptic();
    return;
  }

  _hcpFormOpen = !_hcpFormOpen;
  const form = document.getElementById('hcp-add-form');
  const chev = document.getElementById('hcp-add-chevron');
  if (_hcpFormOpen) {
    if (form) { form.style.display = 'flex'; form.style.flexDirection = 'column'; }
    if (chev) chev.style.transform = 'rotate(180deg)';
    setTimeout(() => document.getElementById('hcp-new-name')?.focus(), 100);
  } else {
    if (form) form.style.display = 'none';
    if (chev) chev.style.transform = '';
  }
  haptic();
}

// ── SAVE CUSTOM CHAIN ──
function hcpSaveCustomChain() {
  const name    = document.getElementById('hcp-new-name')?.value.trim();
  const chainId = parseInt(document.getElementById('hcp-new-chainid')?.value);
  // Parse all RPC URLs — one per line
  const rpcRaw  = document.getElementById('hcp-new-rpc')?.value || '';
  const allRpcsInput = rpcRaw.split('\n').map(r => r.trim()).filter(r => r.startsWith('http'));
  const rpc     = allRpcsInput[0] || '';
  const emoji   = document.getElementById('hcp-new-emoji')?.value.trim() || '🔗';
  const explorer= document.getElementById('hcp-new-explorer')?.value.trim();
  const natSym  = document.getElementById('hcp-new-native-sym')?.value.trim() || 'ETH';
  const natName = document.getElementById('hcp-new-native-name')?.value.trim() || name;
  const natCgId = document.getElementById('hcp-new-native-cgid')?.value.trim();
  const status  = document.getElementById('hcp-new-status');

  if (!name) { status.textContent = '⚠️ Chain name required'; status.style.color = 'var(--accent-red)'; return; }
  if (!chainId || isNaN(chainId)) { status.textContent = '⚠️ Valid Chain ID required'; status.style.color = 'var(--accent-red)'; return; }
  if (allRpcsInput.length === 0) { status.textContent = '⚠️ Enter at least 1 valid RPC URL (https://...)'; status.style.color = 'var(--accent-red)'; return; }

  const existing = getAllChains();
  if (existing.find(c => c.chainId === chainId)) {
    if (status) status.textContent = '⚠️ Chain ID ' + chainId + ' already exists';
    status.style.color = 'var(--accent-red)'; return;
  }

  const newChain = {
    id: 'custom-' + chainId,
    chainId,
    emoji,
    name,
    nativeSym: natSym,
    rpc,
    rpcs: allRpcsInput,
    explorer,
    builtIn: false,
    color: '#6366f1',
  };
  const customs = loadCustomChains();
  customs.push(newChain);
  saveCustomChains(customs);

  // ── Sync to bridge chain picker immediately (no duplicate) ──
  if (typeof window.brSyncChainToPicker === 'function') window.brSyncChainToPicker(newChain);

  // Also add native token to TOKEN_CONFIG for this chain
  if (natSym) {
    const tokenId = 'custom-native-' + chainId;
    const nativeToken = {
      id: tokenId,
      chainId,
      name: natName,
      sub: natSym,
      icon: natSym.slice(0,2),
      color: '#6366f1',
      badge: '#6366f1',
      contract: '',
      decimals: 18,
      cgId: natCgId || '',
      cbPair: natSym + '-USD',
      isDefault: false,
      isNative: true,
    };
    const saved = loadSavedTokens();
    if (!saved.find(t => t.id === tokenId)) {
      saved.push(nativeToken);
      saveTokenList(saved);
      syncTokenConfig();
    }
  }

  if (status) status.textContent = '✓ ' + name + ' added! (' + allRpcsInput.length + ' RPC)';
  status.style.color = 'var(--accent-green)';

  // Clear form
  ['hcp-new-name','hcp-new-chainid','hcp-new-rpc','hcp-new-explorer','hcp-new-emoji','hcp-new-native-sym','hcp-new-native-name','hcp-new-native-cgid'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  setTimeout(() => {
    _hcpFormOpen = false;
    const form2 = document.getElementById('hcp-add-form');
    if (form2) form2.style.display = 'none';
    const chev = document.getElementById('hcp-add-chevron');
    if (chev) chev.style.transform = '';
    renderHcpList();
    showToast(name + ' added!', 'add_link');
    if (typeof renderProfileChainBadges === 'function') renderProfileChainBadges();
    if (typeof renderProfChainSelector === 'function') renderProfChainSelector();
    // Switch to the new chain and reload tokens instantly
    setActiveChain(chainId);
    closeHomeChainPicker();
    loadTokens();
  }, 800);
  haptic();
}