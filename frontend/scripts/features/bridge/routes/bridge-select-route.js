  function brSelectRoute(idx) {
    br.selectedRoute = idx;
    const route = br.routes[idx];
    if (!route) return;

    // Update radio icons
    br.routes.forEach((_, i) => {
      const r = $e('br-radio-' + i);
      if (r) {
        if (i === idx) {
          r.style.border = '2px solid var(--accent-primary)';
          r.style.background = 'var(--accent-primary)';
          r.style.width = '20px';
          r.style.height = '20px';
          r.style.alignSelf = 'flex-end';
          r.innerHTML = '<svg width="11" height="9" viewBox="0 0 11 9" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 4L4 7.5L10 1" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        } else {
          r.style.border = '2px solid rgba(255,255,255,0.2)';
          r.style.background = 'transparent';
          r.style.width = '20px';
          r.style.height = '20px';
          r.style.alignSelf = 'flex-end';
          r.innerHTML = '';
        }
      }
      const c = document.querySelector(`.br-route-card[data-idx="${i}"]`);
      if (c) {
        c.classList.toggle('br-route-selected', i === idx);
        c.style.borderColor = '';
        c.style.background = '';
        c.style.boxShadow = '';
      }
    });

    // Update TO amount display
    const est = route.estimate || {};
    const toDecim = br.toToken.decimals || 18;
    const toAmt = est.toAmount
      ? parseFloat(ethers.formatUnits(est.toAmount.toString(), toDecim)).toFixed(6)
      : '—';
    const _toUsdNum = parseFloat(est.toAmountUSD || 0);
    const toUSD = (_toUsdNum > 0) ? '≈ ' + _formatCurrencyDisplay(_toUsdNum) : '≈ $—';
    $e('br-to-amount').textContent = toAmt;
    $e('br-to-amount').classList.add('br-has-val');
    $e('br-to-usd').textContent = toUSD;

    // ── Sync _brProvider with selected route's provider ──
    if (route._provider) _brProvider = route._provider;

    // Determine if bridge or swap
    const isSame = br.fromChain.id === br.toChain.id;
    $e('br-exec-label').textContent = isSame ? 'Review swap' : 'Review bridge';
    brUpdateExecBtn(true);
    haptic && haptic();
  }
