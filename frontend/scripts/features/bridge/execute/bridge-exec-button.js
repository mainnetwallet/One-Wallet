
  // ── BRIDGE NOW button state manager ──
  // ── Chain color map for exec button ──
  var BR_CHAIN_COLORS = {
    8453:   '#0052ff', // Base
    1:      '#627eea', // Ethereum
    42161:  '#28a0f0', // Arbitrum
    10:     '#ff0420', // Optimism
    137:    '#8247e5', // Polygon
    56:     '#f3ba2f', // BNB
    43114:  '#e84142', // Avalanche
    59144:  '#61dfff', // Linea
    534352: '#efc042', // Scroll
    324:    '#8c8dfc', // zkSync
  };
  function brExecBtnColor() {
    if (!br.fromChain) return '#6366f1';
    // Check chain's own color field first (from PRESET_CHAINS), then BR_CHAIN_COLORS map
    if (br.fromChain.color) return br.fromChain.color;
    var preset = (typeof PRESET_CHAINS !== 'undefined') && PRESET_CHAINS.find(function(c){ return c.id === br.fromChain.id; });
    if (preset && preset.color) return preset.color;
    return BR_CHAIN_COLORS[br.fromChain.id] || '#6366f1';
  }
  function brExecBtnBg() {
    var c = brExecBtnColor();
    return 'linear-gradient(160deg,' + c + 'cc 0%,' + c + 'aa 50%,' + c + '77 100%)';
  }

  function brUpdateExecBtn(routesReady) {
    const btn   = $e('br-exec-btn');
    if (!btn) return;

    // Update label immediately based on same/cross chain
    const labelEl = $e('br-exec-label');
    const isSame = br.fromChain && br.toChain && br.fromChain.id === br.toChain.id;
    if (labelEl) {
      labelEl.textContent = isSame ? 'SWAP NOW' : 'BRIDGE NOW';
    }

    const hasWallet = !!br.senderAddr;
    const hasAmount = parseFloat(($e('br-from-amount') || {}).value) > 0;
    const hasRoute  = routesReady && br.selectedRoute !== null;
    const canExecute = hasWallet && hasAmount && hasRoute;

    // Fixed purple gradient — does not change with chain
    btn.style.background = 'linear-gradient(135deg,#6366f1,#8b5cf6,#a78bfa)';
    btn.style.borderColor = 'rgba(167,139,250,0.6)';
    btn.style.boxShadow = '0 0 18px rgba(99,102,241,0.45),0 0 40px rgba(139,92,246,0.2),0 4px 16px rgba(0,0,0,0.45)';
    btn.onmouseenter = null;
    btn.onmouseleave = null;
    btn.ontouchstart = null;
    btn.ontouchend   = null;

    // Hint message below button
    let hintEl = $e('br-exec-hint');
    if (!hintEl) {
      hintEl = document.createElement('div');
      hintEl.id = 'br-exec-hint';
      hintEl.style.cssText = 'font-family:var(--font-mono);font-size:10px;font-weight:700;letter-spacing:0.5px;text-align:center;margin-top:6px;min-height:16px;transition:opacity 0.2s;';
      btn.parentNode.insertBefore(hintEl, btn.nextSibling);
    }

    if (canExecute) {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      btn.style.filter = '';
      btn.style.pointerEvents = '';
      hintEl.textContent = '';
      hintEl.style.opacity = '0';
    } else {
      btn.disabled = true;
      btn.style.opacity = '0.4';
      btn.style.cursor = 'not-allowed';
      btn.style.filter = 'grayscale(0.5)';
      btn.style.pointerEvents = 'none';

      if (!hasWallet) {
        hintEl.textContent = '⚠️ Connect a wallet first';
        hintEl.style.color = 'var(--accent-amber)';
      } else if (!hasAmount) {
        hintEl.textContent = '⚠️ Enter an amount';
        hintEl.style.color = 'var(--text-muted)';
      } else if (!hasRoute) {
        hintEl.textContent = '⚠️ Please select a route';
        hintEl.style.color = 'var(--accent-amber)';
      } else {
        hintEl.textContent = '';
      }
      hintEl.style.opacity = hintEl.textContent ? '1' : '0';
    }
  }
  window.brUpdateExecBtn = brUpdateExecBtn;

