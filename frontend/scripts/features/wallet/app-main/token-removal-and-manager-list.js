
// ── end LIGHTWEIGHT-CHARTS ENGINE ──

// ── end FULL CHART SCREEN ──



// ── DELETE CONFIRM: long-press on token card — bottom sheet ──
function showTokenDeleteConfirm(cardEl, t) {
  const existing = document.getElementById('tok-del-sheet');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'tok-del-sheet';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:calc(var(--nav-height) + env(safe-area-inset-bottom, 0px));z-index:990;background:rgba(0,0,0,0.82);display:flex;align-items:flex-end;justify-content:center;opacity:0;transition:opacity 0.2s ease;';

  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const chain = (typeof getAllChains === 'function' ? getAllChains() : []).find(c => c.chainId === (t.chainId || 8453));
  const chainName = chain ? chain.name : 'Network ' + (t.chainId || 8453);
  const shortAddr = t.contract ? t.contract.slice(0, 6) + '…' + t.contract.slice(-4) : '';
  const chip = (icon, text, mono) => `<div style="display:flex;align-items:center;gap:5px;padding:6px 10px;border-radius:999px;background:var(--bg-glass);border:1px solid var(--border-subtle);font-size:11px;font-weight:500;color:var(--text-secondary);${mono ? 'font-family:var(--font-mono);' : ''}"><span class="material-icons-round" style="font-size:13px;color:var(--text-muted);">${icon}</span>${text}</div>`;
  const btnBase = 'padding:15px 10px;text-align:center;border-radius:var(--radius-lg);font-size:14px;font-weight:500;letter-spacing:0.4px;cursor:pointer;transition:transform 0.12s ease;display:flex;align-items:center;justify-content:center;gap:6px;';
  const press = `onmousedown="this.style.transform='scale(0.97)'" onmouseup="this.style.transform=''" ontouchstart="this.style.transform='scale(0.97)'" ontouchend="this.style.transform=''"`;
  const shell = (tone, badgeIcon, inner) => `
      <div class="tok-del-inner" style="width:100%;max-width:100%;background:linear-gradient(180deg,var(--bg-surface) 0%,var(--bg-deep) 100%);border-radius:28px 28px 0 0;border:1px solid var(--border-subtle);border-bottom:none;box-shadow:0 -1px 0 0 ${tone}66,0 -18px 50px rgba(0,0,0,0.55);padding:10px 20px 28px;font-family:var(--font-ui);transform:translateY(100%);transition:transform 0.28s cubic-bezier(0.34,1.2,0.64,1);">
        <div style="width:40px;height:4px;background:rgba(255,255,255,0.16);border-radius:2px;margin:0 auto 22px;"></div>
        <div style="display:flex;flex-direction:column;align-items:center;text-align:center;">
          <div style="position:relative;width:68px;height:68px;margin-bottom:16px;">
            <div class="tok-del-logo" style="width:68px;height:68px;border-radius:22px;overflow:hidden;background:var(--bg-glass);border:1px solid var(--border-subtle);box-shadow:0 8px 24px rgba(0,0,0,0.45);"></div>
            <div style="position:absolute;right:-6px;bottom:-6px;width:28px;height:28px;border-radius:50%;background:${tone};border:3px solid var(--bg-surface);display:flex;align-items:center;justify-content:center;">
              <span class="material-icons-round" style="font-size:15px;color:#fff;">${badgeIcon}</span>
            </div>
          </div>
          ${inner}
        </div>`;

  if (t.isNative) {
    // Native token — cannot delete, show info sheet instead
    overlay.innerHTML = shell('#6366f1', 'lock', `
          <div style="font-size:19px;font-weight:500;color:var(--text-primary);letter-spacing:0;"><span style="color:var(--neon-purple);">${esc(t.sub)}</span> can't be removed</div>
          <div style="font-size:12px;color:var(--text-muted);line-height:1.6;margin-top:6px;max-width:290px;">It is the native token of ${esc(chainName)} and is needed to pay gas fees.</div>
          <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-top:16px;">${chip('language', esc(chainName))}${chip('local_gas_station', 'Gas token')}</div>
        </div>
        <div style="margin-top:24px;">
          <div class="tok-del-cancel" style="${btnBase}background:rgba(99,102,241,0.14);border:1px solid rgba(99,102,241,0.4);color:var(--neon-purple);" ${press}>GOT IT</div>
        </div>
      </div>`);
  } else {
    overlay.innerHTML = shell('#f43f5e', 'delete', `
          <div style="font-size:19px;font-weight:500;color:var(--text-primary);letter-spacing:0;">Remove <span style="color:var(--accent-red);">${esc(t.sub)}</span>?</div>
          <div style="font-size:12px;color:var(--text-muted);line-height:1.6;margin-top:6px;">${esc(t.name)} will be removed from My Tokens.</div>
          <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-top:16px;">${chip('language', esc(chainName))}${shortAddr ? chip('tag', esc(shortAddr), true) : ''}</div>
          <div style="display:flex;align-items:flex-start;gap:8px;margin-top:16px;padding:10px 12px;border-radius:var(--radius-md);background:rgba(244,63,94,0.06);border:1px solid rgba(244,63,94,0.16);text-align:left;">
            <span class="material-icons-round" style="font-size:15px;color:var(--accent-red);margin-top:1px;">info</span>
            <span style="font-size:11px;color:var(--text-secondary);line-height:1.5;">Only hides it in this wallet. Your balance stays on-chain and you can add the token again anytime.</span>
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:24px;">
          <div class="tok-del-cancel" style="${btnBase}flex:1;background:var(--bg-glass);border:1px solid var(--border-subtle);color:var(--text-secondary);" ${press}>CANCEL</div>
          <div class="tok-del-confirm" style="${btnBase}flex:1.25;background:linear-gradient(135deg,#f43f5e,#e11d48);border:1px solid rgba(244,63,94,0.6);color:#fff;box-shadow:0 6px 20px rgba(244,63,94,0.3);" ${press}><span class="material-icons-round" style="font-size:17px;">delete</span>DELETE</div>
        </div>
      </div>`);
  }

  // Token logo (same renderer as the token list: logo URL, chain logo or letter fallback)
  const logoBox = overlay.querySelector('.tok-del-logo');
  try { if (logoBox && typeof getTokenLogoEl === 'function') { const el = getTokenLogoEl(t); el.style.borderRadius = '22px'; logoBox.appendChild(el); } } catch (_) {}
  if (logoBox && !logoBox.firstChild) {
    logoBox.style.cssText += 'display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:500;color:var(--text-primary);';
    logoBox.textContent = (t.icon || t.sub || '?').slice(0, 2).toUpperCase();
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