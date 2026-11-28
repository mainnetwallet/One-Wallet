
// ── end LIGHTWEIGHT-CHARTS ENGINE ──

// ── end FULL CHART SCREEN ──



// ── DELETE CONFIRM: long-press on token card — bottom sheet ──
function showTokenDeleteConfirm(cardEl, t) {
  const existing = document.getElementById('tok-del-sheet');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'tok-del-sheet';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:calc(var(--nav-height) + env(safe-area-inset-bottom, 0px));z-index:990;background:rgba(0,0,0,0.82);display:flex;align-items:flex-end;justify-content:center;opacity:0;transition:opacity 0.2s ease;';

  if (t.isNative) {
    // Native token — cannot delete, show info sheet instead
    overlay.innerHTML = `
      <div class="tok-del-inner" style="width:100%;max-width: 100%;background:var(--bg-surface);border-radius:var(--radius-xl) var(--radius-xl) 0 0;border:1px solid var(--border-subtle);border-bottom:none;padding:20px 16px 40px;transform:translateY(100%);transition:transform 0.28s cubic-bezier(0.34,1.2,0.64,1);">
        <div style="width:36px;height:4px;background:rgba(255,255,255,0.15);border-radius:2px;margin:0 auto 18px;"></div>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;padding:12px 14px;background:rgba(99,102,241,0.07);border:1px solid rgba(99,102,241,0.25);border-radius:var(--radius-md);">
          <div style="width:42px;height:42px;border-radius:12px;background:rgba(99,102,241,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <span class="material-icons-round" style="font-size:22px;color:var(--accent-primary);">lock</span>
          </div>
          <div>
            <div style="font-size:13px;font-weight:800;color:var(--text-primary);"><span style="color:var(--neon-purple);">${t.sub}</span> is a Native Token</div>
            <div style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);margin-top:3px;line-height:1.5;">Native tokens are required for gas fees<br>and cannot be removed from your wallet.</div>
          </div>
        </div>
        <div class="tok-del-cancel" style="width:100%;padding:14px;text-align:center;background:var(--bg-glass);border:1px solid var(--border-subtle);border-radius:var(--radius-md);font-size:13px;font-weight:700;cursor:pointer;color:var(--text-secondary);" onmousedown="this.style.transform='scale(0.97)'" onmouseup="this.style.transform=''" ontouchstart="this.style.transform='scale(0.97)'" ontouchend="this.style.transform=''">GOT IT</div>
      </div>`;
  } else {
    overlay.innerHTML = `
      <div class="tok-del-inner" style="width:100%;max-width: 100%;background:var(--bg-surface);border-radius:var(--radius-xl) var(--radius-xl) 0 0;border:1px solid var(--border-subtle);border-bottom:none;padding:20px 16px 40px;transform:translateY(100%);transition:transform 0.28s cubic-bezier(0.34,1.2,0.64,1);">
        <div style="width:36px;height:4px;background:rgba(255,255,255,0.15);border-radius:2px;margin:0 auto 18px;"></div>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;padding:12px 14px;background:rgba(244,63,94,0.07);border:1px solid rgba(244,63,94,0.2);border-radius:var(--radius-md);">
          <div style="width:42px;height:42px;border-radius:12px;background:rgba(244,63,94,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <span class="material-icons-round" style="font-size:22px;color:var(--accent-red);">delete_forever</span>
          </div>
          <div>
            <div style="font-size:13px;font-weight:800;color:var(--text-primary);">Remove <span style="color:var(--accent-red);">${t.sub}</span>?</div>
            <div style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);margin-top:3px;">${t.name} will be removed from My Tokens</div>
          </div>
        </div>
        <div style="display:flex;gap:10px;">
          <div class="tok-del-cancel" style="flex:1;padding:14px;text-align:center;background:var(--bg-glass);border:1px solid var(--border-subtle);border-radius:var(--radius-md);font-size:13px;font-weight:700;cursor:pointer;color:var(--text-secondary);" onmousedown="this.style.transform='scale(0.97)'" onmouseup="this.style.transform=''" ontouchstart="this.style.transform='scale(0.97)'" ontouchend="this.style.transform=''">CANCEL</div>
          <div class="tok-del-confirm" style="flex:1;padding:14px;text-align:center;background:rgba(244,63,94,0.15);border:1px solid rgba(244,63,94,0.4);border-radius:var(--radius-md);font-size:13px;font-weight:800;cursor:pointer;color:var(--accent-red);" onmousedown="this.style.transform='scale(0.97)'" onmouseup="this.style.transform=''" ontouchstart="this.style.transform='scale(0.97)'" ontouchend="this.style.transform=''">DELETE</div>
        </div>
      </div>`;
  }

  document.body.appendChild(overlay);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    overlay.style.opacity = '1';
    overlay.querySelector('.tok-del-inner').style.transform = 'none';
  }));

  function closeSheet() {
    overlay.style.opacity = '0';
    const inner = overlay.querySelector('.tok-del-inner');
    if (inner) inner.style.transform = 'translateY(100%)';
    setTimeout(() => overlay.remove(), 260);
  }

  // Swipe down to close: shared gesture (scripts/shared/ui/sheet-swipe-close.js)
  attachSheetSwipeClose(overlay.querySelector('.tok-del-inner'), { closeFn: closeSheet });
  attachBackdropSwipeClose(overlay, closeSheet);

  overlay.addEventListener('click', e => { if (e.target === overlay) closeSheet(); });
  overlay.querySelector('.tok-del-cancel').addEventListener('click', closeSheet);
  if (!t.isNative) {
    overlay.querySelector('.tok-del-confirm').addEventListener('click', function() {
      closeSheet();
      cardEl.style.transition = 'opacity 0.22s, transform 0.22s';
      cardEl.style.opacity = '0';
      cardEl.style.transform = 'translateX(50px)';
      setTimeout(() => removeToken(t.id), 240);
      haptic && haptic();
    });
  }
}
function closeTokenManager() {
  document.getElementById('tm-overlay')?.classList.remove('open');
  haptic();
}

function renderTmActiveList() {
  const list = document.getElementById('tm-active-list');
  const badge = document.getElementById('tm-count-badge');
  const allTokens = loadSavedTokens();

  // Filter by selected chain
  const chainFiltered = _tmSelectedChainId
    ? allTokens.filter(t => (t.chainId || 8453) === _tmSelectedChainId)
    : allTokens;

  if (badge) badge.textContent = allTokens.length + ' TOKENS';

  if (!list) return;
  list.innerHTML = '';

  // Chain filter info bar
  if (_tmSelectedChainId) {
    const chain = getAllChains().find(c => c.chainId === _tmSelectedChainId) || { name: 'Selected Chain', emoji: '🔗' };
    const filterBar = document.createElement('div');
    filterBar.style.cssText = 'display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:9px;background:rgba(99,102,241,0.07);border:1px dashed rgba(99,102,241,0.25);margin-bottom:10px;';
    filterBar.innerHTML = `
      <span style="font-size:13px;">${chain.emoji}</span>
      <span style="font-size:9px;color:var(--neon-purple);font-family:var(--font-mono);font-weight:700;">Showing ${chainFiltered.length} token${chainFiltered.length !== 1 ? 's' : ''} on ${chain.name}</span>
      <span style="margin-left:auto;font-size:9px;color:var(--text-muted);font-family:var(--font-mono);">${allTokens.length} total</span>
    `;
    list.appendChild(filterBar);
  }

  if (chainFiltered.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'text-align:center;padding:24px;font-family:var(--font-mono);font-size:11px;color:var(--text-muted);';
    const chain = getAllChains().find(c => c.chainId === _tmSelectedChainId) || { name: 'this chain', emoji: '🔗' };
    empty.innerHTML = _tmSelectedChainId
      ? `<div style="font-size:24px;margin-bottom:8px;">${chain.emoji}</div>No tokens on ${chain.name}.<br>Search above to add tokens.`
      : `No tokens added yet.<br>Search above to add tokens.`;
    list.appendChild(empty);
    return;
  }

  chainFiltered.forEach((t, i) => {
    const item = document.createElement('div');
    item.className = 'tm-token-item';
    const iconHtml = getTokenLogoHTML(t);
    item.innerHTML = `
      <div class="tm-token-icon" style="background:${t.color || '#6366f1'}22;color:${t.color || '#6366f1'};">${iconHtml}</div>
      <div class="tm-token-info">
        <div class="tm-token-name">${t.name}</div>
        <div class="tm-token-sub">${t.sub} · ${t.chainId ? (BUILTIN_CHAINS.find(c=>c.chainId===t.chainId)?.name || 'Chain '+t.chainId) : 'Base'}</div>
      </div>
      ${t.isNative ? '' : `<div class="tm-remove-btn" onclick="removeToken('${t.id}')"><span class="material-icons-round">delete</span></div>`}
    `;
    list.appendChild(item);
  });
}

function removeToken(id) {
  const tokens = loadSavedTokens().filter(t => t.id !== id);
  // If this was a default token, persist its ID so loadSavedTokens won't re-inject it
  const _wasDefault = DEFAULT_TOKENS.some(t => t.id === id);
  if (_wasDefault) {
    try {
      const _rdKey = _getTmStorageKey() + '_removed_defaults';
      const _rdRaw = localStorage.getItem(_rdKey);
      const _rdSet = _rdRaw ? new Set(JSON.parse(_rdRaw)) : new Set();
      _rdSet.add(id);
      localStorage.setItem(_rdKey, JSON.stringify([..._rdSet]));
    } catch {}
  }
  saveTokenList(tokens);
  syncTokenConfig();
  renderTmActiveList();
  (document.getElementById('tm-count-badge') || {}).textContent = tokens.length + ' TOKENS';
  showToast('Token removed', 'delete');
  haptic();
  // Re-render home token list
  if (currentPage === 'home') loadTokens();
}