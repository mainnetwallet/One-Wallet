
// ── Token Manager selected chain (for adding tokens to a specific chain) ──
// ── Default to null (All Networks); TH chain picker sets this per-section independently ──
let _tmSelectedChainId = null;

function _tmUpdateChainSelector() {
  const el = document.getElementById('tm-chain-emoji');
  const nm = document.getElementById('tm-chain-name');
  const sb = document.getElementById('tm-chain-sub');
  if (_tmSelectedChainId === null) {
    if (el) el.innerHTML = '<span style="font-size:20px;">🌐</span>';
    if (nm) nm.textContent = 'All Networks';
    if (sb) sb.textContent = 'All chains';
  } else {
    const chain = getAllChains().find(c => c.chainId === _tmSelectedChainId) || { emoji: '🔵', name: 'Base', chainId: 8453 };
    if (el) {
      if (chain.logoURI) {
        el.innerHTML = `<img src="${chain.logoURI}" width="24" height="24" style="border-radius:6px;object-fit:cover;display:block;" onerror="if(this.parentNode)this.outerHTML='<span style=\\'font-size:20px;\\'>${chain.emoji || '🔗'}</span>'" />`;
      } else {
        el.innerHTML = `<span style="font-size:20px;">${chain.emoji || '🔗'}</span>`;
      }
    }
    if (nm) nm.textContent = chain.name;
    if (sb) sb.textContent = 'ChainID: ' + (chain.chainId || '?');
  }
}

function _tmBuildChainItem(c, isSelected) {
  const item = document.createElement('div');
  item.style.cssText = 'display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:14px;background:var(--bg-glass);border:1px solid ' + (isSelected ? 'rgba(99,102,241,0.5)' : 'var(--border-subtle)') + ';cursor:pointer;transition:all 0.2s;margin-bottom:8px;' + (isSelected ? 'background:rgba(99,102,241,0.08);' : '');

  // Logo cell
  const logoWrap = document.createElement('div');
  logoWrap.style.cssText = 'width:36px;height:36px;border-radius:10px;background:var(--bg-raised);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;';
  if (c === null) {
    // "All Networks"
    logoWrap.innerHTML = '<span style="font-size:22px;line-height:1;">🌐</span>';
  } else if (c.logoURI) {
    logoWrap.innerHTML = `<img src="${c.logoURI}" width="26" height="26" style="border-radius:6px;object-fit:cover;display:block;" onerror="if(this.parentNode)this.outerHTML='<span style=\\'font-size:20px;line-height:1;\\'>${(c.emoji||'🔗').replace(/'/g, "\\'")}</span>'" />`;
  } else {
    logoWrap.innerHTML = `<span style="font-size:20px;line-height:1;">${c.emoji || '🔗'}</span>`;
  }
  item.appendChild(logoWrap);

  // Text
  const info = document.createElement('div');
  info.style.cssText = 'flex:1;min-width:0;';
  if (c === null) {
    info.innerHTML = '<div style="font-size:13px;font-weight:700;">All Networks</div><div style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);">Search tokens across all chains</div>';
  } else {
    info.innerHTML = `<div style="font-size:13px;font-weight:700;">${c.name}</div><div style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);">ChainID: ${c.chainId}</div>`;
  }
  item.appendChild(info);

  // Check icon
  if (isSelected) {
    const chk = document.createElement('span');
    chk.className = 'material-icons-round';
    chk.style.cssText = 'color:var(--accent-primary);font-size:18px;flex-shrink:0;';
    chk.textContent = 'check_circle';
    item.appendChild(chk);
  }

  // Press feedback
  item.addEventListener('mousedown',  () => { item.style.opacity = '.7'; });
  item.addEventListener('mouseup',    () => { item.style.opacity = '1';  });
  item.addEventListener('touchstart', () => { item.style.opacity = '.7'; }, { passive: true });
  item.addEventListener('touchend',   () => { item.style.opacity = '1';  }, { passive: true });

  // Select handler
  item.addEventListener('click', () => {
    _tmSelectedChainId = c === null ? null : c.chainId;
    _tmUpdateChainSelector();
    closeTmChainPicker();
    if (typeof renderTmActiveList === 'function') renderTmActiveList();
    const q = document.getElementById('tm-search')?.value.trim();
    if (q && q.length > 1 && !/^0x/.test(q)) {
      const _srBlock = document.getElementById('tm-search-results');
      if (_srBlock) _srBlock.style.display = 'block';
      (document.getElementById('tm-results-list') || {}).innerHTML = '';
      const _searching = document.getElementById('tm-searching');
      if (_searching) _searching.style.display = 'block';
      clearTimeout(tmSearchTimer);
      tmSearchTimer = setTimeout(() => doTmSearch(q), 200);
    }
  });
  return item;
}

// Render (or re-render) chain list based on current search query
function tmFilterChains() {
  const list    = document.getElementById('tm-chain-list');
  const searchEl = document.getElementById('tm-chain-search');
  if (!list) return;
  const q = (searchEl ? searchEl.value : '').trim().toLowerCase();
  const allChains = getAllChains().filter(c => c.chainId !== null);
  list.innerHTML = '';


  // Filtered chains
  const filtered = q
    ? allChains.filter(c =>
        c.name.toLowerCase().includes(q) ||
        String(c.chainId).includes(q) ||
        (c.nativeSym || '').toLowerCase().includes(q))
    : allChains;

  // Always show "All Networks" at top (only when not searching)
  if (!q) {
    list.appendChild(_tmBuildChainItem(null, _tmSelectedChainId === null));
  }

  if (filtered.length === 0 && q) {
    const empty = document.createElement('div');
    empty.style.cssText = 'text-align:center;padding:24px 16px;font-family:var(--font-mono);font-size:11px;color:var(--text-muted);';
    empty.innerHTML = '<div style="font-size:28px;margin-bottom:8px;">🔍</div><div>No chains match "<strong style="color:var(--text-secondary);">' + q + '</strong>"</div>';
    list.appendChild(empty);
    return;
  }

  filtered.forEach(c => list.appendChild(_tmBuildChainItem(c, c.chainId === _tmSelectedChainId)));
}

function openTmChainPicker() {
  const overlay  = document.getElementById('tm-chain-overlay');
  const modal    = document.getElementById('tm-chain-modal');
  const searchEl = document.getElementById('tm-chain-search');
  if (!overlay || !modal) return;

  // Clear search and render full list
  if (searchEl) searchEl.value = '';
  tmFilterChains();

  overlay.style.opacity = '1';
  overlay.style.pointerEvents = 'all';
  requestAnimationFrame(() => requestAnimationFrame(() => { modal.style.transform = 'none'; }));
  // Focus search after animation
  setTimeout(() => { if (searchEl) searchEl.focus(); }, 320);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeTmChainPicker(); }, { once: true });
}

function closeTmChainPicker() {
  const overlay  = document.getElementById('tm-chain-overlay');
  const modal    = document.getElementById('tm-chain-modal');
  const searchEl = document.getElementById('tm-chain-search');
  if (!overlay || !modal) return;
  modal.style.transform = 'translateY(100%)';
  overlay.style.opacity = '0';
  if (searchEl) searchEl.blur();
  setTimeout(() => { overlay.style.pointerEvents = 'none'; }, 300);
}

// Run on boot
syncTokenConfig();

let tmSearchTimer = null;

function openTokenManager() {
  // Wallet check: must have at least one wallet group AND one must be selected
  const _tmGroups = (typeof loadWalletGroups === 'function') ? loadWalletGroups() : [];
  if (!_tmGroups || _tmGroups.length === 0) {
    showToast('Please add a wallet first!', 'account_balance_wallet');
    haptic();
    return;
  }
  // Check if any group is selected — also check hwSelectedKey (home pill live selection)
  const _hwKeySelected = (typeof hwSelectedKey !== 'undefined' && hwSelectedKey);
  const _hasSelected = _hwKeySelected
    || (typeof selectedGroupIds !== 'undefined' && selectedGroupIds.length > 0)
    || (typeof activeGroupId !== 'undefined' && activeGroupId);
  if (!_hasSelected) {
    showToast('Please select a wallet group first!', 'account_balance_wallet');
    haptic();
    return;
  }
  document.getElementById('tm-overlay')?.classList.add('open');
  (document.getElementById('tm-search') || {}).value = '';
  const _tmSR = document.getElementById('tm-search-results');
  const _tmCS = document.getElementById('tm-clear-search');
  const _tmPrev = document.getElementById('tm-contract-preview');
  if (_tmSR) _tmSR.style.display = 'none';
  if (_tmCS) _tmCS.style.display = 'none';
  if (_tmPrev) _tmPrev.style.display = 'none';
  (document.getElementById('tm-contract-status') || {}).textContent = '';
  window._tmContractPending = null;
  // Default: Always start on "All Networks"
  _tmSelectedChainId = null;
  _tmUpdateChainSelector();
  renderTmActiveList();
  haptic();
}

// ── HOME TOKEN SEARCH FILTER ──
let _homeTokenSearchQuery = '';
function homeFilterTokens(q) {
  _homeTokenSearchQuery = q.trim().toLowerCase();
  const clearBtn = document.getElementById('home-token-search-clear');
  if (clearBtn) clearBtn.style.display = _homeTokenSearchQuery ? 'inline-flex' : 'none';
  // Re-run loadTokens with filter applied
  _renderFilteredTokenCards();
}

function _renderFilteredTokenCards() {
  const q = _homeTokenSearchQuery;
  const cards = document.querySelectorAll('#token-list .token-card');
  let visibleCount = 0;
  cards.forEach(card => {
    const id = card.id.replace('token-card-', '');
    const tok = TOKEN_CONFIG.find(t => t.id === id);
    if (!tok) { card.style.display = ''; visibleCount++; return; }
    const match = !q ||
      tok.name.toLowerCase().includes(q) ||
      tok.sub.toLowerCase().includes(q) ||
      (tok.contract || '').toLowerCase().includes(q);
    card.style.display = match ? '' : 'none';
    if (match) visibleCount++;
  });

  // Remove old empty state if exists
  const oldEmpty = document.getElementById('home-search-empty');
  if (oldEmpty) oldEmpty.remove();

  // Show beautiful empty state if search has no results
  if (q && visibleCount === 0) {
    const list = document.getElementById('token-list');
    const empty = document.createElement('div');
    empty.id = 'home-search-empty';
    empty.style.cssText = 'text-align:center;padding:48px 24px;font-family:var(--font-mono);';
    empty.innerHTML = `
      <div style="font-size:44px;margin-bottom:14px;opacity:0.7;">🔍</div>
      <div style="font-size:15px;font-weight:800;color:var(--text-secondary);margin-bottom:8px;font-family:var(--font-display);">Token Not Found</div>
      <div style="font-size:11px;color:var(--text-muted);line-height:1.7;margin-bottom:18px;"><span style="color:var(--neon-purple);font-weight:700;">"${q}"</span> No token found<br>or not yet added on this chain</div>
      <div onclick="openTokenManager()" style="display:inline-flex;align-items:center;gap:7px;padding:10px 18px;background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.35);border-radius:10px;cursor:pointer;transition:all 0.2s ease;color:var(--neon-purple);font-size:11px;font-weight:700;letter-spacing:1px;" onmousedown="this.style.opacity='.7'" onmouseup="this.style.opacity='1'" ontouchstart="this.style.opacity='.7'" ontouchend="this.style.opacity='1'">
        <span class="material-icons-round" style="font-size:15px;">add_circle</span>
        ADD TO MY TOKENS
      </div>
    `;
    if (list) list.appendChild(empty);
  }
}