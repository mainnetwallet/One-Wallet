
function hwOpenGroupPicker() {
  const groups = loadWalletGroups();
  const list = document.getElementById('hw-group-list');
  list.innerHTML = '';

  groups.forEach(g => {
    // ── Group header ──
    const groupWrap = document.createElement('div');
    groupWrap.style.cssText = 'margin-bottom:6px;';

    const groupRow = document.createElement('div');
    // Auto-expand the group that contains the currently selected wallet key
    const isExpanded = (typeof hwSelectedKey !== 'undefined' && hwSelectedKey && g.keys.includes(hwSelectedKey))
      || g.id === (document.getElementById('home-group-select')?.value);
    const _gIsActive = (typeof hwSelectedKey !== 'undefined' && hwSelectedKey && g.keys.includes(hwSelectedKey));
    groupRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-radius:12px;background:' + (_gIsActive ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.05)') + ';border:1px solid ' + (_gIsActive ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.09)') + ';cursor:pointer;-webkit-tap-highlight-color:transparent;';
    groupRow.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;">' +
        '<span style="font-size:18px;">👛</span>' +
        '<div>' +
          '<div style="font-size:12px;font-weight:700;color:var(--text-primary);">' + g.name + '</div>' +
          '<div style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);margin-top:1px;">' + g.keys.length + ' wallet' + (g.keys.length !== 1 ? 's' : '') + '</div>' +
        '</div>' +
      '</div>' +
      '<span class="material-icons-round hw-chevron" style="font-size:16px;color:rgba(255,255,255,0.35);transition:transform 0.2s;">' + (isExpanded ? 'expand_less' : 'expand_more') + '</span>';

    // ── Wallet sub-list ──
    const walletList = document.createElement('div');
    walletList.style.cssText = 'overflow-y:auto;overflow-x:hidden;scrollbar-width:none;-webkit-overflow-scrolling:touch;transition:max-height 0.3s ease;max-height:' + (isExpanded ? 'calc(100dvh - var(--nav-height) - env(safe-area-inset-bottom, 0px) - 160px)' : '0') + ';';

    g.keys.forEach((k, i) => {
      try {
        const addr = new ethers.Wallet(k).address;
        const isSelected = k === hwSelectedKey;
        const wRow = document.createElement('div');
        wRow.setAttribute('data-key', k);
        wRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 14px 10px 18px;border-radius:10px;margin-top:4px;background:' + (isSelected ? 'rgba(99,102,241,0.13)' : 'rgba(255,255,255,0.03)') + ';border:1px solid ' + (isSelected ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)') + ';cursor:pointer;-webkit-tap-highlight-color:transparent;transition:all 0.15s;';
        wRow.innerHTML =
          '<div style="display:flex;align-items:center;gap:10px;">' +
            '<div style="width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,var(--accent-primary),var(--accent-secondary));display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;flex-shrink:0;">' + (i+1) + '</div>' +
            '<span style="font-family:var(--font-mono);font-size:10px;font-weight:600;color:var(--text-primary);">' + addr.slice(0,2) + '...' + addr.slice(-4) + '</span>' +
          '</div>' +
          '<span class="material-icons-round" style="font-size:16px;color:' + (isSelected ? 'var(--accent-primary)' : 'rgba(255,255,255,0.15)') + ';">' + (isSelected ? 'check_circle' : 'radio_button_unchecked') + '</span>';

        let _touchStartY = 0;
        let _touchStartX = 0;
        let _touchMoved = false;
        wRow.addEventListener('touchstart', function(e) {
          _touchStartY = e.touches[0].clientY;
          _touchStartX = e.touches[0].clientX;
          _touchMoved = false;
        }, { passive: true });
        wRow.addEventListener('touchmove', function(e) {
          if (Math.abs(e.touches[0].clientY - _touchStartY) > 6 ||
              Math.abs(e.touches[0].clientX - _touchStartX) > 6) _touchMoved = true;
        }, { passive: true });
        // ── shared handler for both touch and click ──
        function _hwWalletToggle() {
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

        wRow.addEventListener('touchend', function(e) {
          if (_touchMoved) return;
          e.preventDefault(); e.stopPropagation();
          _hwWalletToggle();
        }, { passive: false });
        wRow.addEventListener('click', function(e) {
          _hwWalletToggle();
        });
        walletList.appendChild(wRow);
      } catch {}
    });

    // Group row tap — expand/collapse
    let _gTouchStartY = 0, _gTouchMoved = false;
    groupRow.addEventListener('touchstart', function(e) {
      _gTouchStartY = e.touches[0].clientY; _gTouchMoved = false;
    }, { passive: true });
    groupRow.addEventListener('touchmove', function(e) {
      if (Math.abs(e.touches[0].clientY - _gTouchStartY) > 6) _gTouchMoved = true;
    }, { passive: true });
    const groupTap = function(e) {
      if (_gTouchMoved) return;
      e.preventDefault(); e.stopPropagation();
      const chevron = groupRow.querySelector('.hw-chevron');
      if (walletList.style.maxHeight === '0px' || walletList.style.maxHeight === '0') {
        walletList.style.maxHeight = 'calc(100dvh - var(--nav-height) - env(safe-area-inset-bottom, 0px) - 160px)';
        if (chevron) chevron.textContent = 'expand_less';
        // sync hidden select
        const gSel = document.getElementById('home-group-select');
        if (gSel) { gSel.value = g.id; gSel.dispatchEvent(new Event('change')); }
      } else {
        walletList.style.maxHeight = '0';
        if (chevron) chevron.textContent = 'expand_more';
      }
      if (typeof haptic === 'function') haptic();
    };
    groupRow.addEventListener('touchend', groupTap, { passive: false });
    groupRow.addEventListener('click', groupTap);

    groupWrap.appendChild(groupRow);
    groupWrap.appendChild(walletList);
    list.appendChild(groupWrap);
  });

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
