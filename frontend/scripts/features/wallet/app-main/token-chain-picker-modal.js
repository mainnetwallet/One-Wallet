
function _openTokenChainPickerModal(coin, platforms) {
  // Remove existing modal if any
  const existing = document.getElementById('tm-chain-contract-overlay');
  if (existing) existing.remove();

  const colors = ['#6366f1','#8b5cf6','#22d3ee','#10b981','#f59e0b','#f472b6','#f43f5e','#a78bfa'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  const sym2 = (coin.symbol || '').slice(0,2).toUpperCase() || '?';
  const iconHtml = coin.thumb
    ? `<img src="${coin.thumb}" alt="${sym2}" style="width:36px;height:36px;border-radius:10px;object-fit:cover;" onerror="this.style.display='none'" />`
    : `<div style="width:36px;height:36px;border-radius:10px;background:${color};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;">${sym2}</div>`;

  const isLoading = platforms === null;

  // Build two-section content
  let listHtml = '';
  if (isLoading) {
    listHtml = `<div style="text-align:center;padding:40px 0;font-family:var(--font-mono);font-size:11px;color:var(--text-muted);">
      <span class="del-spinner" style="margin-right:8px;"></span>Loading contracts from CoinGecko & CoinMarketCap…
    </div>`;
  } else {
    // Build list of supported chains
    const supportedChains = [];
    const allChains = getAllChains().filter(c => c.chainId !== null);

    if (platforms && typeof platforms === 'object') {
      Object.entries(platforms).forEach(([platformId, info]) => {
        const chainId = _CG_PLATFORM_TO_CHAINID[platformId];
        if (!chainId) return;
        const chainDef = allChains.find(c => c.chainId === chainId);
        if (!chainDef) return;
        const contractAddr = (typeof info === 'object' ? info.contract_address : info) || '';
        supportedChains.push({ chainDef, contractAddr, decimals: info?.decimal_place || 18 });
      });
    }

    // Also add any matching chains from DEFAULT_TOKENS (fallback)
    if (supportedChains.length === 0) {
      allChains.forEach(c => {
        const def = DEFAULT_TOKENS.find(t => t.cgId === coin.id && t.chainId === c.chainId);
        if (def) {
          supportedChains.push({ chainDef: c, contractAddr: def.contract || '', decimals: def.decimals || 18 });
        }
      });
    }

    // ── If TM chain filter is active, only show that chain in "found" section ──
    let displayChains = supportedChains;
    if (_tmSelectedChainId !== null && supportedChains.length > 0) {
      const onSelected = supportedChains.filter(sc => sc.chainDef.chainId === _tmSelectedChainId);
      if (onSelected.length > 0) displayChains = onSelected;
    }

    // Split into "contract found" vs "no contract"
    const foundChains    = displayChains.filter(sc => sc.contractAddr && sc.contractAddr.length === 42 && sc.contractAddr.startsWith('0x'));
    const noContractInSupported = displayChains.filter(sc => !(sc.contractAddr && sc.contractAddr.length === 42 && sc.contractAddr.startsWith('0x')));

    // "Other chains" = all chains NOT in supportedChains (for manual entry), filtered by TM chain if set
    const supportedChainIds = new Set(supportedChains.map(sc => sc.chainDef.chainId));
    const otherChains = (_tmSelectedChainId !== null
      ? allChains.filter(c => c.chainId === _tmSelectedChainId && !supportedChainIds.has(c.chainId))
      : allChains.filter(c => !supportedChainIds.has(c.chainId))
    );

    // ── SECTION 1: Contract found ──
    if (foundChains.length > 0) {
      listHtml += `
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:10px;">
          <div style="width:8px;height:8px;border-radius:50%;background:var(--accent-green);box-shadow:0 0 6px rgba(16,185,129,0.6);flex-shrink:0;"></div>
          <div style="font-size:9px;font-weight:700;color:var(--accent-green);letter-spacing:2px;font-family:var(--font-mono);">CONTRACT FOUND</div>
          <div style="font-size:9px;color:var(--text-muted);font-family:var(--font-mono);">· CoinGecko / CoinMarketCap</div>
        </div>`;
      foundChains.forEach(({ chainDef, contractAddr, decimals }) => {
        const alreadyAdded = (typeof loadSavedTokens === 'function')
          ? loadSavedTokens().find(t => t.cgId === coin.id && t.chainId === chainDef.chainId) : null;
        listHtml += _buildChainContractRow(chainDef, contractAddr, decimals, coin, color, alreadyAdded);
      });
    }

    // ── SECTION 2: Other Chains (no contract available) ──
    // Combine noContractInSupported + otherChains for the "other" section
    const allOtherChainRows = [...noContractInSupported, ...otherChains.map(c => ({ chainDef: c, contractAddr: '', decimals: 18 }))];

    // Deduplicate by chainId
    const seenOther = new Set();
    const dedupedOther = allOtherChainRows.filter(({ chainDef }) => {
      if (seenOther.has(chainDef.chainId)) return false;
      seenOther.add(chainDef.chainId);
      return true;
    });

    if (dedupedOther.length > 0) {
      const INITIAL_OTHER_SHOW = 4; // Show first 4, rest behind "more chain" button
      const visibleOther = dedupedOther.slice(0, INITIAL_OTHER_SHOW);
      const hiddenOther  = dedupedOther.slice(INITIAL_OTHER_SHOW);

      let otherRowsHtml = '';
      visibleOther.forEach(({ chainDef, contractAddr, decimals }) => {
        const alreadyAdded = (typeof loadSavedTokens === 'function')
          ? loadSavedTokens().find(t => t.cgId === coin.id && t.chainId === chainDef.chainId) : null;
        otherRowsHtml += _buildChainContractRow(chainDef, contractAddr || '', decimals, coin, color, alreadyAdded);
      });

      let hiddenRowsHtml = '';
      hiddenOther.forEach(({ chainDef, contractAddr, decimals }) => {
        const alreadyAdded = (typeof loadSavedTokens === 'function')
          ? loadSavedTokens().find(t => t.cgId === coin.id && t.chainId === chainDef.chainId) : null;
        hiddenRowsHtml += _buildChainContractRow(chainDef, contractAddr || '', decimals, coin, color, alreadyAdded);
      });

      const sectionTopMargin = foundChains.length > 0 ? 'margin-top:18px;' : '';
      listHtml += `
        <div style="${sectionTopMargin}display:flex;align-items:center;gap:7px;margin-bottom:10px;">
          <div style="width:8px;height:8px;border-radius:50%;background:var(--accent-amber);box-shadow:0 0 6px rgba(245,158,11,0.5);flex-shrink:0;"></div>
          <div style="font-size:9px;font-weight:700;color:var(--accent-amber);letter-spacing:2px;font-family:var(--font-mono);">OTHER CHAIN</div>
          <div style="font-size:9px;color:var(--text-muted);font-family:var(--font-mono);">· no contract, enter manually</div>
        </div>
        ${otherRowsHtml}`;

      if (hiddenOther.length > 0) {
        listHtml += `
          <div id="tm-ccp-hidden-chains" style="display:none;">${hiddenRowsHtml}</div>
          <div id="tm-ccp-more-btn" onclick="_tmCcpToggleMoreChains()" style="display:flex;align-items:center;justify-content:center;gap:7px;padding:11px 14px;margin-top:4px;border-radius:14px;background:rgba(245,158,11,0.07);border:1px dashed rgba(245,158,11,0.3);cursor:pointer;transition:all 0.2s;" onmousedown="this.style.opacity='.7'" onmouseup="this.style.opacity='1'" ontouchstart="this.style.opacity='.7'" ontouchend="this.style.opacity='1'">
            <span class="material-icons-round" id="tm-ccp-more-icon" style="font-size:16px;color:var(--accent-amber);transition:transform 0.25s;">expand_more</span>
            <span id="tm-ccp-more-label" style="font-size:10px;font-weight:700;color:var(--accent-amber);font-family:var(--font-mono);letter-spacing:1px;">Show ${hiddenOther.length} more chains</span>
          </div>`;
      }
    }

    // If absolutely nothing to show
    if (listHtml.trim() === '') {
      listHtml = `<div style="text-align:center;padding:32px 16px;font-family:var(--font-mono);font-size:11px;color:var(--text-muted);">
        <div style="font-size:32px;margin-bottom:10px;">🔍</div>
        <div style="font-size:12px;font-weight:700;color:var(--text-secondary);margin-bottom:6px;">No chains found</div>
        <div>Add chain networks from Settings</div>
      </div>`;
    }
  }

  const overlay = document.createElement('div');
  overlay.id = 'tm-chain-contract-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:calc(var(--nav-height) + env(safe-area-inset-bottom, 0px));z-index:26000;background:rgba(0,0,0,0.88);display:flex;align-items:flex-end;justify-content:center;';
  overlay.innerHTML = `
    <div id="tm-ccp-modal" style="width:100%;max-width: 100%;background:var(--bg-surface);border-radius:var(--radius-xl) var(--radius-xl) 0 0;border:1px solid var(--border-subtle);border-bottom:none;padding:20px 16px 40px;transform:translateY(100%);transition:transform 0.32s cubic-bezier(0.34,1.2,0.64,1);max-height:82vh;display:flex;flex-direction:column;">
      <!-- Handle -->
      <div style="width:36px;height:4px;background:rgba(255,255,255,0.15);border-radius:2px;margin:0 auto 16px;flex-shrink:0;"></div>
      <!-- Token header -->
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;padding:12px 14px;background:var(--bg-glass);border:1px solid var(--border-subtle);border-radius:14px;flex-shrink:0;">
        ${iconHtml}
        <div style="flex:1;">
          <div style="font-size:14px;font-weight:700;">${coin.name}</div>
          <div style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono);">${(coin.symbol||'').toUpperCase()}</div>
        </div>
        <div onclick="_closeTmChainContractModal()" style="width:30px;height:30px;border-radius:8px;background:var(--bg-raised);display:flex;align-items:center;justify-content:center;cursor:pointer;" onmousedown="this.style.opacity='.7'" onmouseup="this.style.opacity='1'" ontouchstart="this.style.opacity='.7'" ontouchend="this.style.opacity='1'">
          <span class="material-icons-round" style="font-size:16px;color:var(--text-muted);">close</span>
        </div>
      </div>
      <!-- Chain list — two sections -->
      <div id="tm-ccp-list" style="overflow-y:auto;scrollbar-width:none;flex:1;padding-right:2px;">${listHtml}</div>
    </div>
  `;

  overlay.addEventListener('click', e => { if (e.target === overlay) _closeTmChainContractModal(); });
  document.body.appendChild(overlay);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const modal = document.getElementById('tm-ccp-modal');
    if (modal) modal.style.transform = 'none';

    // Swipe down to close: shared gesture (scripts/shared/ui/sheet-swipe-close.js)
    if (modal) attachSheetSwipeClose(modal, { closeFn: _closeTmChainContractModal });
    attachBackdropSwipeClose(overlay, _closeTmChainContractModal);
  }));
}

