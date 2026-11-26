// ── Open / close swap-specific chain picker ──
function openSwapChainPicker() {
  renderSwapChainList();
  const overlay = document.getElementById('sw-chain-overlay');
  if (overlay) overlay.classList.add('open');
  if (typeof haptic === 'function') haptic();
}
function closeSwapChainPicker() {
  const overlay = document.getElementById('sw-chain-overlay');
  if (overlay) overlay.classList.remove('open');
  if (typeof haptic === 'function') haptic();
}
function renderSwapChainList() {
  const list = document.getElementById('sw-chain-list');
  if (!list) return;
  list.innerHTML = '';

  const searchEl = document.getElementById('sw-chain-search');
  const clearEl  = document.getElementById('sw-chain-search-clear');
  const q = searchEl ? searchEl.value.trim().toLowerCase() : '';
  if (clearEl) clearEl.style.display = q ? 'block' : 'none';

  // All chains except "All Networks" (chainId !== null)
  let chains = (typeof getAllChains === 'function' ? getAllChains() : []).filter(c => c.chainId !== null);
  if (q) {
    chains = chains.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.nativeSym && c.nativeSym.toLowerCase().includes(q)) ||
      String(c.chainId).includes(q)
    );
  }

  if (chains.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:32px 0;font-family:var(--font-mono);font-size:11px;color:var(--text-muted);">No networks found</div>';
    return;
  }

  chains.forEach(chain => {
    const isSelected = SW.network && SW.network.chainId === chain.chainId;
    const item = document.createElement('div');
    item.className = 'hcp-chain-item' + (isSelected ? ' selected' : '');
    item.style.cssText = 'position:relative;';

    const logoHtml = chain.logoURI
      ? `<img src="${chain.logoURI}" width="24" height="24" style="border-radius:6px;object-fit:cover;display:block;" onerror="this.style.display='none';this.parentNode.querySelector('.sw-emoji-fb').style.display='flex'"/><span class="sw-emoji-fb" style="display:none;font-size:20px;align-items:center;justify-content:center;">${chain.emoji||'🔗'}</span>`
      : `<span style="font-size:22px;line-height:1;">${chain.emoji||'🔗'}</span>`;

    item.innerHTML = `
      <div class="hcp-chain-emoji" style="${chain.color ? `border:1.5px solid ${chain.color}44;` : ''}display:flex;align-items:center;justify-content:center;">${logoHtml}</div>
      <div class="hcp-chain-info">
        <div class="hcp-chain-name">${chain.name}</div>
        <div class="hcp-chain-sub">Chain ID: ${chain.chainId}${chain.nativeSym ? ' · ' + chain.nativeSym : ''}</div>
      </div>
      ${isSelected ? '<span class="material-icons-round" style="font-size:18px;color:var(--accent-primary);flex-shrink:0;">check_circle</span>' : '<span style="width:18px;flex-shrink:0;"></span>'}
    `;
    item.addEventListener('click', function() {
      setSwapChain(chain);
      closeSwapChainPicker();
    });
    // Scroll detection: only select if touch didn't move (not a scroll)
    let _touchStartY = 0;
    let _touchStartX = 0;
    item.addEventListener('touchstart', function(e) {
      _touchStartY = e.touches[0].clientY;
      _touchStartX = e.touches[0].clientX;
    }, { passive: true });
    item.addEventListener('touchend', function(e) {
      const dy = Math.abs(e.changedTouches[0].clientY - _touchStartY);
      const dx = Math.abs(e.changedTouches[0].clientX - _touchStartX);
      // If moved more than 8px, it's a scroll — ignore
      if (dy > 8 || dx > 8) return;
      e.preventDefault();
      setSwapChain(chain);
      closeSwapChainPicker();
    }, { passive: false });
    list.appendChild(item);
  });
}
