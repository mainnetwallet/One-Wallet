// ══════════════════════════════════════════════════════════════════

// ── Sync HUD price when market data updates ──
function _tcfSyncFsHud() {
  if (document.getElementById('token-chart-full-overlay')?.getAttribute('data-fs') !== '1') return;
  const priceEl  = document.getElementById('tcf-price');
  const changeEl = document.getElementById('tcf-change');
  const fshudPrice  = document.getElementById('tcf-fshud-price');
  const fshudChange = document.getElementById('tcf-fshud-change');
  if (fshudPrice  && priceEl)  fshudPrice.textContent  = priceEl.textContent;
  if (fshudChange && changeEl) {
    fshudChange.textContent = changeEl.textContent;
    const isUp = changeEl.classList.contains('up');
    const isDn = changeEl.classList.contains('dn');
    fshudChange.style.background = isUp ? 'rgba(16,185,129,0.12)' : isDn ? 'rgba(244,63,94,0.12)' : 'rgba(120,120,160,0.12)';
    fshudChange.style.color = isUp ? '#10b981' : isDn ? '#f43f5e' : '#7878a0';
  }
}

function tcfGoSwap() {
  const t = window._tcfToken;
  closeTokenChart();
  if (!t) return;
  _swNavigateWithToken(t);
}
function tcfGoBridge() {
  const t = window._tcfToken;
  closeTokenChart();
  if (!t) return;

  setTimeout(() => {
    // User intentionally navigating to bridge — clear disconnected flag
    try { localStorage.removeItem('one_br_disconnected'); } catch(_) {}
    const brObj = window.br;
    if (!brObj) { switchPage('bridge'); return; }

    // 1. Set fromChain
    const chainId = t.chainId || 8453;
    const chains  = window.PRESET_CHAINS || [];
    const targetChain = chains.find(c => c.id === chainId);
    if (targetChain) {
      brObj.fromChain = targetChain;
      const nameEl  = document.getElementById('br-from-chain-name');
      const emojiEl = document.getElementById('br-from-chain-emoji');
      if (nameEl) nameEl.textContent = targetChain.name;
      if (emojiEl) {
        if (targetChain.logoURI) {
          emojiEl.innerHTML = `<img src="${targetChain.logoURI}" style="width:18px;height:18px;border-radius:50%;object-fit:cover;" onerror="this.parentElement.textContent='${targetChain.emoji||'🔗'}'">`;
        } else {
          emojiEl.textContent = targetChain.emoji || '🔗';
        }
      }
    }

    // 2. Set fromToken
    const logoURI = t.logoUrl || t.logo || t.logoURI || t.image || (typeof TOKEN_LOGOS !== 'undefined' ? TOKEN_LOGOS[t.sub] || TOKEN_LOGOS[(t.symbol||'').toUpperCase()] || '' : '') || '';
    brObj.fromToken = {
      symbol:   t.sub  || t.symbol || '',
      address:  t.contract || t.address || t.contractAddress || '0x0000000000000000000000000000000000000000',
      decimals: t.decimals || 18,
      priceUSD: t.price || t.usdVal || 0,
      logoURI:  logoURI,
      name:     t.name || t.sub || '',
    };

    // 3. Update FROM token button UI
    const symEl  = document.getElementById('br-from-token-sym');
    const iconEl = document.getElementById('br-from-token-icon');
    if (symEl)  symEl.textContent = t.sub || t.symbol || '';
    if (iconEl) {
      if (logoURI) {
        iconEl.innerHTML = `<img src="${logoURI}" style="width:20px;height:20px;border-radius:6px;object-fit:cover;" onerror="if(this.parentNode)this.outerHTML='<span style=\\'font-size:11px;font-weight:800;\\'>${(t.sub||'?').charAt(0)}</span>'">`;
      } else {
        iconEl.innerHTML = `<span style="font-size:11px;font-weight:800;">${(t.sub||'?').charAt(0)}</span>`;
      }
    }

    // 4. Call brUpdateTokenBtn
    if (typeof window.brUpdateTokenBtn === 'function') window.brUpdateTokenBtn('from');

    // 5. Reload token list for new chain
    if (targetChain && typeof window.brLoadTokens === 'function') {
      window.brLoadTokens('from', chainId);
    }

    switchPage('bridge');
    if (typeof haptic === 'function') haptic();
  }, 220);
}
function tcfGoSend() {
  const t = window._tcfToken;
  closeTokenChartFull();
  setTimeout(() => { if (t) openSendModal(t.isNative ? null : t.id, t.chainId || 8453); }, 200);
}


function _tcfFmtNum(n) {
  if (!n || isNaN(n)) return '—';
  if (n >= 1e9) return '$' + (n/1e9).toFixed(2) + 'B';
  if (n >= 1e6) return '$' + (n/1e6).toFixed(2) + 'M';
  if (n >= 1e3) return '$' + (n/1e3).toFixed(2) + 'K';
  return '$' + n.toFixed(2);
}
function _tcfFmtSupply(n, sym) {
  if (!n || isNaN(n)) return '—';
  if (n >= 1e9) return (n/1e9).toFixed(2) + 'B ' + sym;
  if (n >= 1e6) return (n/1e6).toFixed(2) + 'M ' + sym;
  if (n >= 1e3) return (n/1e3).toFixed(2) + 'K ' + sym;
  return n.toFixed(0) + ' ' + sym;
}

