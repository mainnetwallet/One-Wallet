// Home wallet picker (shared wallet drawer UI, single select): groups only expand, one wallet is active.
let _hwOpenGroups = new Set();   // expanded group indices

// Select (or deselect, when it is already active) a wallet as the home wallet
function _hwToggleWallet(g, k) {
    if (hwSelectedKey === k) {
      // DESELECT
      hwSelectedKey = null;
      homeActiveKey = null;
      validatedKeys = [];
      _hwSaveSelection(null, null);
      // ── Clear balance cache so stale balances don't show ──
      window._balanceCache = {};
      window._balanceCacheTime = {};
      // ── Clear token list and portfolio total immediately (no wallet = no balance) ──
      var _tlEl = document.getElementById('token-list');
      if (_tlEl) { _tlEl.innerHTML = ''; }
      if (typeof window._portfolioTotalUsd !== 'undefined') { window._portfolioTotalUsd = 0; }
      if (typeof window._portfolioAllChainsTotal !== 'undefined') { window._portfolioAllChainsTotal = 0; }
      if (typeof updatePortfolioTotal === 'function') updatePortfolioTotal();
      // Reset chain to All Networks when no wallet is selected
      if (typeof setActiveChain === 'function') setActiveChain(null);
      // ── Immediately disable chain-switch-btn & home-manage-btn (setActiveChain may re-style it) ──
      (function _instantDisable() {
        ['home-chain-btn', 'home-manage-btn'].forEach(function(id) {
          var el = document.getElementById(id);
          if (!el) return;
          el.classList.add('wg-no-wallet');
          el.dataset.wgDisabled = '1';
          el.style.setProperty('opacity',        '0.35',           'important');
          el.style.setProperty('filter',         'grayscale(0.6)', 'important');
          el.style.setProperty('pointer-events', 'none',           'important');
          el.style.setProperty('cursor',         'not-allowed',    'important');
        });
      })();
      // Remove group from selectedGroupIds
      if (typeof selectedGroupIds !== 'undefined') {
        const idx = selectedGroupIds.indexOf(g.id);
        if (idx !== -1) selectedGroupIds.splice(idx, 1);
        try { if (typeof saveSelectedGroupIds === 'function') saveSelectedGroupIds(); } catch {}
      }
      // Clear activeGroupId
      if (typeof activeGroupId !== 'undefined') {
        activeGroupId = null;
        try { localStorage.removeItem(WG_ACTIVE_KEY); } catch {}
      }
      if (typeof loadTokens === 'function') loadTokens();
    } else {
      // SELECT
      hwSelectedKey = k;
      _hwSaveSelection(k, g.id);
      // ── FIX: set homeActiveKey & validatedKeys BEFORE any dispatchEvent ──
      // homeApplyWallet() (called synchronously by dispatchEvent) uses homeActiveKey
      // to restore per-wallet chain via _loadChainForWallet(). If homeActiveKey still
      // holds the previous wallet's key at that point, the wrong chain gets applied
      // and flashes briefly before being overwritten — this is the chain-flash bug.
      homeActiveKey = k;
      validatedKeys = [k];
      const wSel = document.getElementById('home-wallet-select');
      const gSel = document.getElementById('home-group-select');
      // Set group first, then pre-set wallet value BEFORE dispatching
      // so homePopulateWallets() sees the correct prevKey on first run
      if (gSel) { gSel.value = g.id; }
      if (wSel) { wSel.value = k; }
      if (gSel) { gSel.dispatchEvent(new Event('change')); }
      // After group change repopulates wallet list, force correct wallet
      if (wSel) { wSel.value = k; wSel.dispatchEvent(new Event('change')); }
      // Sync selectedGroupIds & activeGroupId
      if (typeof selectedGroupIds !== 'undefined' && !selectedGroupIds.includes(g.id)) {
        selectedGroupIds.push(g.id);
        try { if (typeof saveSelectedGroupIds === 'function') saveSelectedGroupIds(); } catch {}
      }
      if (typeof activeGroupId !== 'undefined') {
        activeGroupId = g.id;
        try { localStorage.setItem(WG_ACTIVE_KEY, g.id); } catch {}
      }
    }
    hwUpdateGroupLabel();
    hwCloseGroupPicker();
    if (typeof haptic === 'function') haptic();
    // Sync Manage button enabled/disabled state
    if (typeof _updateWgManageBtn === 'function') _updateWgManageBtn();
    // ── WALLET GUARD: deselect হলে সাথে সাথে chain-switch-btn ও home-manage-btn disable ──
    if (typeof window.homeWalletGuardRefresh === 'function') window.homeWalletGuardRefresh();
  
}

function _hwRenderGroupPicker() {
  const groups = loadWalletGroups();
  const list = document.getElementById('hw-group-list');
  if (!list) return;
  WDU.renderList(list, {
    mode: 'single',
    groups: groups,
    isOpen: function(gi) { return _hwOpenGroups.has(gi); },
    isKeySel: function(gi, ki) {
      return typeof hwSelectedKey !== 'undefined' && !!hwSelectedKey && groups[gi].keys[ki] === hwSelectedKey;
    },
    onExpand: function(gi) {
      if (_hwOpenGroups.has(gi)) {
        _hwOpenGroups.delete(gi);
      } else {
        _hwOpenGroups.add(gi);
        // sync hidden select
        const gSel = document.getElementById('home-group-select');
        if (gSel) { gSel.value = groups[gi].id; gSel.dispatchEvent(new Event('change')); }
      }
      _hwRenderGroupPicker();
    },
    onKey: function(gi, ki) {
      const k = groups[gi].keys[ki];
      if (!WDU.addressOf(k)) return;
      _hwToggleWallet(groups[gi], k);
    }
  });
}

function hwOpenGroupPicker() {
  const groups = loadWalletGroups();
  const homeGroupId = document.getElementById('home-group-select')?.value;
  // Auto-expand the group that holds the active wallet (or the current home group)
  _hwOpenGroups = new Set();
  groups.forEach(function(g, gi) {
    const hasActive = typeof hwSelectedKey !== 'undefined' && hwSelectedKey && g.keys.includes(hwSelectedKey);
    if (hasActive || g.id === homeGroupId) _hwOpenGroups.add(gi);
  });
  _hwRenderGroupPicker();

  const ov    = document.getElementById('hw-group-overlay');
  const modal = document.getElementById('hw-group-modal');
  // Reset first — clears any stuck state from previous open/close cycle
  ov.style.pointerEvents = 'none';
  ov.style.opacity = '0';
  modal.style.transform = 'translateX(100%)';
  // Now open
  requestAnimationFrame(() => {
    ov.style.pointerEvents = 'all';
    ov.style.opacity = '1';
    requestAnimationFrame(() => {
      modal.style.transform = 'translateX(0)';
    });
  });
  ov.onclick = e => { if (e.target === ov) hwCloseGroupPicker(); };
}

function hwCloseGroupPicker() {
  const ov    = document.getElementById('hw-group-overlay');
  const modal = document.getElementById('hw-group-modal');
  if (!ov || !modal) return;
  modal.style.transform = 'translateX(100%)';
  ov.style.opacity = '0';
  ov.style.pointerEvents = 'none'; // immediate — prevents race on rapid select/deselect
  // Re-render home chain picker list so it shows THIS group's custom chains
  setTimeout(() => {
    if (typeof renderHcpList === 'function') renderHcpList();
  }, 350);
}

function hwOpenWalletPicker() { hwOpenGroupPicker(); }
function hwCloseWalletPicker() { hwCloseGroupPicker(); }

// ── Profile selected chain for stats ──
let _profSelectedChainId = 8453; // default Base

function renderProfChainSelector() {
  const grid = document.getElementById('prof-chain-grid');
  if (!grid) return;

  // Use SAME chains as home screen: getAllChains() = BUILTIN_CHAINS + user custom chains
  // Filter out "All Networks" (chainId null) — we show that as the special ALL node
  const chains = (typeof getAllChains === 'function' ? getAllChains() : [])
    .filter(c => c.chainId !== null);

  grid.innerHTML = '';

  // ALL node
  const allNode = document.createElement('div');
  allNode.className = 'prof-chain-node all-node' + (_profSelectedChainId === null ? ' active' : '');
  allNode.innerHTML = `<div class="prof-chain-node-emoji">🌐</div><div class="prof-chain-node-name">ALL</div>`;
  allNode.addEventListener('click', () => { openProfChainPicker(); haptic && haptic(); });
  grid.appendChild(allNode);

  // One node per chain (same order as home screen)
  chains.forEach(c => {
    const chainId = c.chainId;
    const node = document.createElement('div');
    node.className = 'prof-chain-node' + (chainId === _profSelectedChainId ? ' active' : '');
    const emoji = c.emoji || '🔗';
    const shortName = (c.shortName || c.name || '').toUpperCase().slice(0, 6);
    node.innerHTML = `<div class="prof-chain-node-emoji">${emoji}</div><div class="prof-chain-node-name">${shortName}</div>`;
    node.addEventListener('click', () => { _pcpSelect(chainId); haptic && haptic(); });
    grid.appendChild(node);
  });

  // Also update the single display chip
  if (typeof renderProfChainSingle === 'function') renderProfChainSingle();
}

// ── Profile Chain Picker Modal — same chains as home screen ──
let _pcpAllChains = [];

function openProfChainPicker() {
  // getAllChains() = home screen chains (BUILTIN + custom added)
  _pcpAllChains = (typeof getAllChains === 'function' ? getAllChains() : [])
    .filter(c => c.chainId !== null); // exclude the "All Networks" meta entry

  _pcpRenderList(_pcpAllChains);

  const overlay = document.getElementById('pcp-overlay');
  if (!overlay) return;
  overlay.classList.add('open');

  const inp = document.getElementById('pcp-search');
  if (inp) inp.value = '';
  const clr = document.getElementById('pcp-search-clear');
  if (clr) clr.style.display = 'none';
  haptic && haptic();
}

function closeProfChainPicker() {
  document.getElementById('pcp-overlay')?.classList.remove('open');
  haptic && haptic();
}

function pcpOverlayClick(e) {
  if (e.target === document.getElementById('pcp-overlay')) closeProfChainPicker();
}

function pcpSearch() {
  const q = (document.getElementById('pcp-search')?.value || '').toLowerCase().trim();
  const clr = document.getElementById('pcp-search-clear');
  if (clr) clr.style.display = q ? 'block' : 'none';
  _pcpRenderList(q ? _pcpAllChains.filter(c => (c.name||'').toLowerCase().includes(q)) : _pcpAllChains);
}

function pcpClearSearch() {
  const inp = document.getElementById('pcp-search');
  if (inp) inp.value = '';
  document.getElementById('pcp-search-clear').style.display = 'none';
  _pcpRenderList(_pcpAllChains);
}

function _pcpSelect(chainId) {
  _profSelectedChainId = chainId;
  renderProfChainSelector();
  renderProfChainSingle();
  updateProfileStats();
  closeProfChainPicker();
  haptic && haptic();
}

function renderProfChainSingle() {
  const emojiEl = document.getElementById('prof-chain-single-emoji');
  const nameEl  = document.getElementById('prof-chain-single-name');
  if (!emojiEl || !nameEl) return;
  const allChains = (typeof getAllChains === 'function' ? getAllChains() : []);
  const chain = allChains.find(c => c.chainId === _profSelectedChainId);
  if (chain) {
    const emoji = chain.emoji || '\u{1F517}';
    if (chain.logoURI) {
      emojiEl.innerHTML = `<img src="${chain.logoURI}" width="22" height="22" style="border-radius:50%;object-fit:cover;display:block;" onerror="if(this.parentNode)this.outerHTML='<span style=\\'font-size:16px;line-height:1;\\'>${emoji}</span>'" />`;
    } else {
      emojiEl.innerHTML = `<span style="font-size:16px;line-height:1;">${emoji}</span>`;
    }
    nameEl.textContent  = (chain.name || '').toUpperCase();
  } else {
    emojiEl.innerHTML = `<span style="font-size:16px;line-height:1;">\u{1F310}</span>`;
    nameEl.textContent  = 'ALL NETWORKS';
  }
}

function _pcpRenderList(chains) {
  const list = document.getElementById('pcp-list');
  if (!list) return;
  list.innerHTML = '';



  chains.forEach(c => {
    const chainId = c.chainId;
    const isSelected = chainId === _profSelectedChainId;
    const item = document.createElement('div');
    item.className = 'hcp-chain-item' + (isSelected ? ' selected' : '');

    const logoURI = c.logoURI || null;
    const emoji   = c.emoji || '🔗';
    item.innerHTML = `
      <div class="hcp-chain-emoji">${typeof _chainLogoHtml === 'function' ? _chainLogoHtml(logoURI, emoji, 26) : '<span style="font-size:20px;line-height:1;">' + emoji + '</span>'}</div>
      <div class="hcp-chain-info">
        <div class="hcp-chain-name">${c.name}</div>
        <div class="hcp-chain-sub">Chain ID: ${chainId}&nbsp;·&nbsp;${c.nativeSym || 'ETH'}</div>
      </div>
      ${isSelected ? '<span class="material-icons-round" style="font-size:18px;color:var(--accent-primary);margin-left:auto;flex-shrink:0;">check_circle</span>' : ''}
    `;
    item.addEventListener('click', () => _pcpSelect(chainId));
    list.appendChild(item);
  });
  setTimeout(function(){ _fixChainLogos(list); }, 0);
}

// ── Delegation cache helpers ──
var _ONE_DEL_CACHE_KEY = 'one_delegation_stat_cache';

function _saveDelegationCache(delegated, total, chainId) {
  try {
    localStorage.setItem(_ONE_DEL_CACHE_KEY, JSON.stringify({
      delegated: delegated,
      total: total,
      chainId: chainId,
      ts: Date.now()
    }));
  } catch {}
}
