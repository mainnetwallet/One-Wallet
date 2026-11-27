  // ── Compact amount formatter + font auto-fit (Bridge page) ──
  window.brFmtAmt = function (n) {
    n = Number(n);
    if (!isFinite(n) || n <= 0) return '—';
    if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
    if (n >= 1)    return String(parseFloat(n.toFixed(4)));
    if (n < 0.000001) return '<0.000001';
    return String(parseFloat(n.toPrecision(5)));
  };
  window.brFitAmt = function (el, text) {
    if (!el) return;
    var len = String(text == null ? '' : text).length;
    if (len <= 8) el.removeAttribute('data-sz');
    else el.setAttribute('data-sz', len <= 11 ? 'm' : 's');
  };

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
      ? window.brFmtAmt(parseFloat(ethers.formatUnits(est.toAmount.toString(), toDecim)))
      : '—';
    const _toUsdNum = parseFloat(est.toAmountUSD || 0);
    const toUSD = (_toUsdNum > 0) ? '≈ ' + _formatCurrencyDisplay(_toUsdNum) : '≈ $—';
    $e('br-to-amount').textContent = toAmt;
    window.brFitAmt($e('br-to-amount'), toAmt);
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
