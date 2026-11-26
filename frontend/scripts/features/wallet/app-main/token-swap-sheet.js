
// ── TOKEN ACTION SHEET (click on token card) ──
// ── SWAP SHEET: single click on token card ──
function showTokenSwapSheet(t) {
  const existing = document.getElementById('token-action-sheet');
  if (existing) existing.remove();

  const chainName = t.chainId ? (getAllChains().find(c => c.chainId === t.chainId)?.name || 'Chain ' + t.chainId) : 'Base';
  const chainId   = t.chainId || 8453;

  const overlay = document.createElement('div');
  overlay.id = 'token-action-sheet';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:calc(var(--nav-height) + env(safe-area-inset-bottom, 0px));z-index:980;background:rgba(0,0,0,0.82);display:flex;align-items:flex-end;justify-content:center;opacity:0;transition:opacity 0.2s ease;';

  overlay.innerHTML = `
    <div id="token-action-inner" style="width:100%;max-width: 100%;background:linear-gradient(170deg,rgba(13,13,26,0.99) 0%,rgba(8,8,18,1) 100%);backdrop-filter:blur(40px);-webkit-backdrop-filter:blur(40px);border-radius:36px 36px 0 0;border:1px solid rgba(99,102,241,0.28);border-bottom:none;padding:22px 18px calc(28px + env(safe-area-inset-bottom,0px));transform:translateY(100%);transition:transform 0.35s cubic-bezier(0.34,1.2,0.64,1);box-shadow:0 -12px 60px rgba(99,102,241,0.18),0 -4px 24px rgba(0,0,0,0.7),inset 0 1px 0 rgba(255,255,255,0.06);position:relative;overflow:hidden;">

      <!-- Ambient glow blobs -->
      <div style="position:absolute;top:-60px;left:50%;transform:translateX(-50%);width:280px;height:100px;background:radial-gradient(ellipse,rgba(99,102,241,0.22) 0%,transparent 70%);pointer-events:none;"></div>
      <div style="position:absolute;bottom:0;left:-40px;width:160px;height:160px;background:radial-gradient(circle,rgba(139,92,246,0.08),transparent 70%);pointer-events:none;"></div>
      <div style="position:absolute;bottom:0;right:-40px;width:140px;height:140px;background:radial-gradient(circle,rgba(6,182,212,0.07),transparent 70%);pointer-events:none;"></div>

      <!-- Drag handle -->
      <div style="width:48px;height:5px;background:linear-gradient(90deg,rgba(99,102,241,0.6),rgba(139,92,246,0.7),rgba(99,102,241,0.6));border-radius:3px;margin:0 auto 20px;box-shadow:0 0 12px rgba(99,102,241,0.4);"></div>

      <!-- Token header card -->
      <div style="display:flex;align-items:center;gap:13px;margin-bottom:20px;padding:14px 16px;background:linear-gradient(135deg,rgba(99,102,241,0.12),rgba(139,92,246,0.07));border:1px solid rgba(99,102,241,0.25);border-radius:24px;position:relative;overflow:hidden;box-shadow:0 4px 24px rgba(99,102,241,0.1),inset 0 1px 0 rgba(255,255,255,0.06);">
        <div style="position:absolute;inset:0;background:linear-gradient(135deg,rgba(99,102,241,0.05),transparent);pointer-events:none;border-radius:24px;"></div>
        <!-- Token icon — fully round -->
        <div id="tas-token-icon" style="width:48px;height:48px;border-radius:50%;background:${t.color || '#6366f1'}22;overflow:hidden;flex-shrink:0;box-shadow:0 0 18px ${t.color || '#6366f1'}55,0 3px 10px rgba(0,0,0,0.5);border:2px solid rgba(255,255,255,0.1);"></div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:16px;font-weight:800;letter-spacing:0.3px;">${t.name}</div>
          <div style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);margin-top:4px;display:flex;align-items:center;gap:6px;">
            <span style="background:linear-gradient(90deg,var(--accent-primary),var(--accent-secondary));-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-weight:800;">${t.sub}</span>
            <span style="width:3px;height:3px;border-radius:50%;background:var(--text-muted);flex-shrink:0;"></span>
            <span>${chainName}</span>
          </div>
        </div>
        <!-- Chart btn — pill shaped -->
        <div id="tas-header-chart-btn" style="display:flex;align-items:center;gap:6px;padding:8px 14px;background:linear-gradient(135deg,rgba(6,182,212,0.18),rgba(34,211,238,0.1));border:1px solid rgba(6,182,212,0.4);border-radius:50px;cursor:pointer;transition:all 0.18s;flex-shrink:0;box-shadow:0 0 14px rgba(6,182,212,0.15);" onmousedown="this.style.transform='scale(0.92)';this.style.boxShadow='0 0 20px rgba(6,182,212,0.3)'" onmouseup="this.style.transform='';this.style.boxShadow='0 0 14px rgba(6,182,212,0.15)'" ontouchstart="this.style.transform='scale(0.92)';this.style.boxShadow='0 0 20px rgba(6,182,212,0.3)'" ontouchend="this.style.transform='';this.style.boxShadow='0 0 14px rgba(6,182,212,0.15)'">
          <span class="material-icons-round" style="font-size:14px;color:var(--neon-cyan);">show_chart</span>
          <span style="font-size:10px;font-weight:800;color:var(--neon-cyan);font-family:var(--font-mono);letter-spacing:1px;">CHART</span>
        </div>
        <!-- Close btn — round -->
        <div onclick="" style="width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;margin-left:4px;transition:all 0.2s;" onmousedown="this.style.background='rgba(255,255,255,0.12)'" onmouseup="this.style.background='rgba(255,255,255,0.06)'" ontouchstart="this.style.background='rgba(255,255,255,0.12)'" ontouchend="this.style.background='rgba(255,255,255,0.06)'">
          <span class="material-icons-round" id="tas-close-x" style="font-size:16px;color:var(--text-muted);">close</span>
        </div>
      </div>

      <!-- Section label -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;padding-left:2px;">
        <div style="width:16px;height:2px;background:linear-gradient(90deg,var(--accent-primary),var(--accent-secondary));border-radius:1px;"></div>
        <div style="font-family:var(--font-mono);font-size:8px;color:var(--text-muted);letter-spacing:3px;font-weight:700;">QUICK ACTIONS</div>
        <div style="flex:1;height:1px;background:linear-gradient(90deg,rgba(99,102,241,0.15),transparent);"></div>
      </div>

      <div style="display:flex;flex-direction:column;gap:10px;">

        <!-- SWAP + BRIDGE row -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">

          <!-- SWAP button — rounded box -->
          <div id="tas-swap-btn" style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:18px 12px 16px;background:linear-gradient(155deg,rgba(99,102,241,0.16),rgba(139,92,246,0.1));border:1px solid rgba(99,102,241,0.32);border-radius:24px;cursor:pointer;transition:all 0.22s cubic-bezier(0.34,1.4,0.64,1);position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(99,102,241,0.1),inset 0 1px 0 rgba(255,255,255,0.06);" onmousedown="this.style.transform='scale(0.95)';this.style.borderColor='rgba(99,102,241,0.6)';this.style.boxShadow='0 0 28px rgba(99,102,241,0.3)'" onmouseup="this.style.transform='';this.style.borderColor='rgba(99,102,241,0.32)';this.style.boxShadow='0 4px 20px rgba(99,102,241,0.1)'" ontouchstart="this.style.transform='scale(0.95)';this.style.borderColor='rgba(99,102,241,0.6)';this.style.boxShadow='0 0 28px rgba(99,102,241,0.3)'" ontouchend="this.style.transform='';this.style.borderColor='rgba(99,102,241,0.32)';this.style.boxShadow='0 4px 20px rgba(99,102,241,0.1)'">
            <div style="position:absolute;top:-20px;right:-20px;width:80px;height:80px;border-radius:50%;background:radial-gradient(circle,rgba(99,102,241,0.18),transparent 70%);pointer-events:none;"></div>
            <div style="position:absolute;bottom:-15px;left:-15px;width:60px;height:60px;border-radius:50%;background:radial-gradient(circle,rgba(139,92,246,0.12),transparent 70%);pointer-events:none;"></div>
            <!-- Fully round icon -->
            <div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,var(--accent-primary),var(--accent-secondary));display:flex;align-items:center;justify-content:center;box-shadow:0 0 22px rgba(99,102,241,0.55),0 6px 16px rgba(0,0,0,0.4);border:2px solid rgba(255,255,255,0.15);">
              <span class="material-icons-round" style="font-size:24px;color:#fff;">swap_horiz</span>
            </div>
            <div style="text-align:center;position:relative;z-index:1;">
              <div style="font-size:13px;font-weight:800;letter-spacing:1px;background:linear-gradient(90deg,#a5b4fc,#c4b5fd);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">SWAP</div>
              <div style="font-size:9px;color:var(--text-muted);font-family:var(--font-mono);margin-top:3px;">${t.sub} → token</div>
            </div>
          </div>

          <!-- BRIDGE button — rounded box -->
          <div id="tas-bridge-btn" style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:18px 12px 16px;background:linear-gradient(155deg,rgba(6,182,212,0.14),rgba(34,211,238,0.08));border:1px solid rgba(6,182,212,0.28);border-radius:24px;cursor:pointer;transition:all 0.22s cubic-bezier(0.34,1.4,0.64,1);position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(6,182,212,0.09),inset 0 1px 0 rgba(255,255,255,0.06);" onmousedown="this.style.transform='scale(0.95)';this.style.borderColor='rgba(6,182,212,0.58)';this.style.boxShadow='0 0 28px rgba(6,182,212,0.28)'" onmouseup="this.style.transform='';this.style.borderColor='rgba(6,182,212,0.28)';this.style.boxShadow='0 4px 20px rgba(6,182,212,0.09)'" ontouchstart="this.style.transform='scale(0.95)';this.style.borderColor='rgba(6,182,212,0.58)';this.style.boxShadow='0 0 28px rgba(6,182,212,0.28)'" ontouchend="this.style.transform='';this.style.borderColor='rgba(6,182,212,0.28)';this.style.boxShadow='0 4px 20px rgba(6,182,212,0.09)'">
            <div style="position:absolute;top:-20px;right:-20px;width:80px;height:80px;border-radius:50%;background:radial-gradient(circle,rgba(6,182,212,0.15),transparent 70%);pointer-events:none;"></div>
            <div style="position:absolute;bottom:-15px;left:-15px;width:60px;height:60px;border-radius:50%;background:radial-gradient(circle,rgba(34,211,238,0.1),transparent 70%);pointer-events:none;"></div>
            <!-- Fully round icon -->
            <div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,var(--accent-tertiary),var(--neon-cyan));display:flex;align-items:center;justify-content:center;box-shadow:0 0 22px rgba(6,182,212,0.5),0 6px 16px rgba(0,0,0,0.4);border:2px solid rgba(255,255,255,0.15);">
              <span class="material-icons-round" style="font-size:24px;color:#fff;">alt_route</span>
            </div>
            <div style="text-align:center;position:relative;z-index:1;">
              <div style="font-size:13px;font-weight:800;letter-spacing:1px;background:linear-gradient(90deg,#67e8f9,#a5f3fc);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">BRIDGE</div>
              <div style="font-size:9px;color:var(--text-muted);font-family:var(--font-mono);margin-top:3px;">${t.sub} → chain</div>
            </div>
          </div>
        </div>

        <!-- SEND button — rounded wide box -->
        <div id="tas-send-btn" style="display:flex;align-items:center;gap:16px;padding:16px 18px;background:linear-gradient(155deg,rgba(245,158,11,0.13),rgba(217,119,6,0.08));border:1px solid rgba(245,158,11,0.28);border-radius:24px;cursor:pointer;transition:all 0.22s cubic-bezier(0.34,1.4,0.64,1);position:relative;overflow:hidden;box-shadow:0 4px 20px rgba(245,158,11,0.09),inset 0 1px 0 rgba(255,255,255,0.06);" onmousedown="this.style.transform='scale(0.97)';this.style.borderColor='rgba(245,158,11,0.55)';this.style.boxShadow='0 0 28px rgba(245,158,11,0.25)'" onmouseup="this.style.transform='';this.style.borderColor='rgba(245,158,11,0.28)';this.style.boxShadow='0 4px 20px rgba(245,158,11,0.09)'" ontouchstart="this.style.transform='scale(0.97)';this.style.borderColor='rgba(245,158,11,0.55)';this.style.boxShadow='0 0 28px rgba(245,158,11,0.25)'" ontouchend="this.style.transform='';this.style.borderColor='rgba(245,158,11,0.28)';this.style.boxShadow='0 4px 20px rgba(245,158,11,0.09)'">
          <div style="position:absolute;top:-24px;right:-24px;width:100px;height:100px;border-radius:50%;background:radial-gradient(circle,rgba(245,158,11,0.12),transparent 70%);pointer-events:none;"></div>
          <!-- Fully round icon -->
          <div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#f59e0b,#d97706);display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 0 22px rgba(245,158,11,0.5),0 6px 16px rgba(0,0,0,0.4);border:2px solid rgba(255,255,255,0.15);">
            <span class="material-icons-round" style="font-size:24px;color:#fff;">send</span>
          </div>
          <div style="flex:1;position:relative;z-index:1;">
            <div style="font-size:14px;font-weight:800;letter-spacing:0.8px;background:linear-gradient(90deg,#fcd34d,#fbbf24);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">SEND</div>
            <div style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);margin-top:3px;">${t.sub} on ${chainName} pre-selected</div>
          </div>
          <!-- Arrow chip -->
          <div style="width:34px;height:34px;border-radius:50%;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 0 10px rgba(245,158,11,0.15);">
            <span class="material-icons-round" style="font-size:18px;color:var(--accent-amber);">arrow_forward</span>
          </div>
        </div>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  // Inject DOM-based logo into action sheet header
  const tasIcon = overlay.querySelector('#tas-token-icon');
  if (tasIcon) {
    const logoEl = getTokenLogoEl(t);
    logoEl.style.width = '100%';
    logoEl.style.height = '100%';
    tasIcon.appendChild(logoEl);
  }

  requestAnimationFrame(() => requestAnimationFrame(() => {
    overlay.style.opacity = '1';
    overlay.querySelector('#token-action-inner').style.transform = 'none';
  }));

  function closeSheet() {
    overlay.style.opacity = '0';
    overlay.querySelector('#token-action-inner').style.transform = 'translateY(100%)';
    setTimeout(() => overlay.remove(), 260);
  }
  overlay.addEventListener('click', e => { if (e.target === overlay) closeSheet(); });
  overlay.querySelector('#tas-close-x').addEventListener('click', closeSheet);

  // ── Swipe-down-to-close ──
  (function() {
    const inner = overlay.querySelector('#token-action-inner');
    let startY = 0, curY = 0, dragging = false;
    inner.addEventListener('touchstart', function(e) {
      startY = e.touches[0].clientY; curY = startY; dragging = true;
      inner.style.transition = 'none';
    }, { passive: true });
    inner.addEventListener('touchmove', function(e) {
      if (!dragging) return;
      curY = e.touches[0].clientY;
      const dy = Math.max(0, curY - startY);
      inner.style.transform = 'translateY(' + dy + 'px)';
      overlay.style.opacity = String(Math.max(0, 1 - dy / 220));
    }, { passive: true });
    inner.addEventListener('touchend', function() {
      if (!dragging) return;
      dragging = false;
      inner.style.transition = 'transform 0.35s cubic-bezier(0.34,1.2,0.64,1)';
      const dy = curY - startY;
      if (dy > 80) { closeSheet(); } else { inner.style.transform = 'none'; overlay.style.opacity = '1'; }
    });
  })();

  overlay.querySelector('#tas-header-chart-btn').addEventListener('click', function() {
    closeSheet();
    setTimeout(() => openTokenChartFull(t), 120);
    haptic && haptic();
  });

  overlay.querySelector('#tas-send-btn').addEventListener('click', function() {
    closeSheet();
    // Determine the token id to pre-select in send modal
    const sendTokId = t.isNative ? null : t.id;
    const _homeKey = (typeof homeActiveKey !== 'undefined' && homeActiveKey) ? homeActiveKey : null;
    setTimeout(() => openSendModal(sendTokId, chainId, _homeKey), 80);
    haptic && haptic();
  });

  // ── SWAP button: sets token in swap page FROM box ──
  overlay.querySelector('#tas-swap-btn').addEventListener('click', function() {
    closeSheet();
    _swNavigateWithToken(t);
  });

  // ── BRIDGE button: sets token in bridge page FROM box ──
  overlay.querySelector('#tas-bridge-btn').addEventListener('click', function() {
    const chains = window.PRESET_CHAINS || [];
    const targetChain = chains.find(c => c.id === chainId);

    // Guard: if this token's chain is not in the bridge chain list, abort
    if (!targetChain) {
      if (typeof showToast === 'function') {
        showToast('Chain not supported in Bridge', 'link_off');
      }
      return;
    }

    closeSheet();
    // User intentionally navigating to bridge — clear disconnected flag
    // so home active key auto-connects
    try { localStorage.removeItem('one_br_disconnected'); } catch(_) {}
    const brObj = window.br;
    if (!brObj) { switchPage('bridge'); return; }

    // 1. Set fromChain
    brObj.fromChain = targetChain;
    const nameEl = document.getElementById('br-from-chain-name');
    if (nameEl) nameEl.textContent = targetChain.name;
    const emojiEl = document.getElementById('br-from-chain-emoji');
    if (emojiEl) {
      if (targetChain.logoURI) {
        emojiEl.innerHTML = `<img src="${targetChain.logoURI}" style="width:18px;height:18px;border-radius:50%;object-fit:cover;" onerror="this.parentElement.textContent='${(targetChain.emoji||'\uD83D\uDD17')}'">` ;
      } else {
        emojiEl.textContent = targetChain.emoji || '🔗';
      }
    }

    // 2. Set fromToken
    const logoURI = t.logoUrl || t.logo || t.logoURI || t.image || (typeof TOKEN_LOGOS !== 'undefined' ? TOKEN_LOGOS[t.sub] || TOKEN_LOGOS[(t.symbol||'').toUpperCase()] || '' : '') || '';
    brObj.fromToken = {
      symbol:   t.sub || t.symbol || '',
      address:  t.contract || t.address || t.contractAddress || '0x0000000000000000000000000000000000000000',
      decimals: t.decimals || 18,
      priceUSD: t.price || t.usdVal || 0,
      logoURI:  logoURI,
      name:     t.name || t.sub || '',
    };

    // 3. Update FROM token button UI
    const symEl  = document.getElementById('br-from-token-sym');
    const iconEl = document.getElementById('br-from-token-icon');
    if (symEl) symEl.textContent = t.sub;
    if (iconEl) {
      if (logoURI) {
        iconEl.innerHTML = `<img src="${logoURI}" style="width:20px;height:20px;border-radius:6px;object-fit:cover;" onerror="if(this.parentNode)this.outerHTML='<span style=\'font-size:11px;font-weight:800;\'>${t.sub.charAt(0)}</span>'">` ;
      } else {
        iconEl.innerHTML = `<span style="font-size:11px;font-weight:800;">${t.sub.charAt(0)}</span>`;
      }
    }

    // 4. Trigger brUpdateTokenBtn
    if (typeof window.brUpdateTokenBtn === 'function') window.brUpdateTokenBtn('from');

    // 5. Reload token list for new chain
    if (targetChain && typeof window.brLoadTokens === 'function') {
      window.brLoadTokens('from', chainId);
    }

    // ── Auto-connect home wallet to bridge sender ──
    (async function _brAutoConnectHomeWallet() {
      try {
        var brObj2 = window.br;
        if (!brObj2) return;

        // Skip if user explicitly disconnected
        var _dis = false;
        try { _dis = !!localStorage.getItem('one_br_disconnected'); } catch(_) {}
        if (_dis) return;

        // Restore manually-selected wallet if exists
        var _sv2 = null;
        try { _sv2 = JSON.parse(localStorage.getItem('one_br_sender') || 'null'); } catch(_) {}
        // AES decrypt encPk if present
        if (_sv2 && _sv2.addr && _sv2.encPk) {
          try {
            var _dp2 = await OneCrypto.decrypt(_sv2.encPk);
            if (_dp2) { _sv2.pk = _dp2; } else { _sv2 = null; } // don't delete
          } catch(_) { _sv2 = null; } // don't delete
        } else if (_sv2 && (_sv2.pk || _sv2.encPk) && !_sv2.encPk) {
          // Legacy plaintext — re-encrypt
          try {
            var _reEnc2 = await OneCrypto.encrypt(_sv2.pk);
            localStorage.setItem('one_br_sender', JSON.stringify({ addr: _sv2.addr, encPk: _reEnc2 }));
          } catch(_) {}
        }
        if (_sv2 && _sv2.addr && _sv2.pk) {
          try { var _nv2 = _sv2.pk.startsWith('0x') ? _sv2.pk : '0x' + _sv2.pk; new ethers.Wallet(_nv2); } catch(_) { localStorage.removeItem('one_br_sender'); _sv2 = null; }
        }
        if (_sv2 && _sv2.addr && _sv2.pk) {
          brObj2.senderAddr = _sv2.addr;
          brObj2.senderKey  = _sv2.pk;
          if (typeof brUpdateSenderRow === 'function') brUpdateSenderRow();
          if (typeof _brShowCachedBalance === 'function') _brShowCachedBalance('from');
          setTimeout(function() { if (typeof brFetchFromBalance === 'function') brFetchFromBalance(); }, 0);
          return;
        }

        var _hk = (typeof homeActiveKey !== 'undefined' && homeActiveKey) ? homeActiveKey : null;
        if (!_hk) {
          try { var _s = _oneGetSelectedKey(); if (_s) _hk = _s; } catch(_) {}
        }
        if (!_hk) return;
        var _norm = _hk.startsWith('0x') ? _hk : '0x' + _hk;
        var _hAddr = '';
        try { _hAddr = new ethers.Wallet(_norm).address; } catch(_e) { return; }
        if (!_hAddr) return;
        brObj2.senderAddr = _hAddr;
        brObj2.senderKey  = _hk;
        // Do NOT write to one_br_sender for auto-connect
        if (typeof brUpdateSenderRow === 'function') brUpdateSenderRow();
        if (typeof _brShowCachedBalance === 'function') _brShowCachedBalance('from');
        setTimeout(function() {
          if (typeof brFetchFromBalance === 'function') brFetchFromBalance();
        }, 300);
      } catch(_e) {}
    })();

    switchPage('bridge');
    haptic && haptic();
  });
}