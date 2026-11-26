
// ── DELEGATED Stat Card: Silent RPC Delegation Re-check ──
(function _oneDelegatedStatClick() {

  // Debounce: prevent double-tap spam
  var _delegatedCheckBusy = false;

  window.profileDelegatedCardClick = async function(el, event) {
    if (el && event) rippleEffect(el, event); // null event = auto-trigger, skip ripple
    if (_delegatedCheckBusy) return; // already running — ignore tap

    const delEl   = document.getElementById('profile-stat-keys');
    const ndelEl  = document.getElementById('profile-stat-notdelegated');
    const spinner = document.getElementById('delegated-refresh-spinner');

    // No wallet selected — nothing to do
    const hasSelected = typeof settingsKeys !== 'undefined' && settingsKeys.length > 0;
    if (!hasSelected) return;

    _delegatedCheckBusy = true;

    // Show subtle spinner (no toast, no modal — fully silent)
    if (spinner) {
      spinner.style.display = 'inline';
      spinner.style.animation = 'spin360 0.9s linear infinite';
      if (!document.getElementById('_spin360style')) {
        const s = document.createElement('style');
        s.id = '_spin360style';
        s.textContent = '@keyframes spin360{to{transform:rotate(360deg)}}';
        document.head.appendChild(s);
      }
    }

    try {
      const keysToUse = settingsKeys;
      const total     = keysToUse.length;

      // Get selected chain RPC list (default: Base)
      const effectiveChainId = (typeof _profSelectedChainId !== 'undefined' && _profSelectedChainId !== null)
        ? _profSelectedChainId : 8453;
      const chain = (typeof getAllChains === 'function' ? getAllChains() : [])
        .find(c => c.chainId === effectiveChainId);
      const rpcs = chain
        ? (chain.rpcs || (chain.rpc ? [chain.rpc] : []))
        : ['https://mainnet.base.org'];

      // Derive wallet addresses
      const wallets = keysToUse.map(pk => {
        let addr = '';
        try { addr = new ethers.Wallet(pk).address; } catch {}
        return addr;
      }).filter(Boolean);

      if (wallets.length === 0) { _delegatedCheckBusy = false; if (spinner) spinner.style.display = 'none'; return; }

      const BATCH_SIZE  = 20;
      const TIMEOUT_MS  = 7000;
      const MAX_RETRIES = 2;

      async function _fetch(rpc, body) {
        const ctrl = new AbortController();
        const tid  = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
        try {
          const r = await fetch(rpc, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: ctrl.signal
          });
          return await r.json();
        } finally { clearTimeout(tid); }
      }

      async function _batchCheck(addrs) {
        const payload = addrs.map((addr, idx) => ({
          jsonrpc: '2.0', id: idx, method: 'eth_getCode', params: [addr, 'latest']
        }));
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          const rpc = rpcs[attempt % rpcs.length];
          try {
            const data = await _fetch(rpc, payload);
            if (Array.isArray(data)) return data.map(r => r.result || '0x');
            throw new Error('non-batch');
          } catch {
            if (attempt === MAX_RETRIES) {
              return await Promise.all(addrs.map(async addr => {
                for (const r2 of rpcs) {
                  try {
                    const d = await _fetch(r2, { jsonrpc:'2.0', id:1, method:'eth_getCode', params:[addr,'latest'] });
                    return d.result || '0x';
                  } catch { continue; }
                }
                return '0x';
              }));
            }
            await new Promise(r => setTimeout(r, 250 * (attempt + 1)));
          }
        }
        return addrs.map(() => '0x');
      }

      // Batch into chunks
      const batches = [];
      for (let i = 0; i < wallets.length; i += BATCH_SIZE) {
        batches.push(wallets.slice(i, i + BATCH_SIZE));
      }

      let delegated = 0;
      let checked   = 0;

      // Run batches, progressive update
      const CONCURRENCY = 4;
      for (let i = 0; i < batches.length; i += CONCURRENCY) {
        const chunk   = batches.slice(i, i + CONCURRENCY);
        const results = await Promise.allSettled(chunk.map(b => _batchCheck(b)));
        results.forEach((res, ci) => {
          const codes = res.status === 'fulfilled' ? res.value : chunk[ci].map(() => '0x');
          codes.forEach(code => {
            if (code && code.startsWith('0xef0100') && code.length >= 10) delegated++;
            checked++;
          });
        });
        // Progressive feedback while still running
        if (i + CONCURRENCY < batches.length) {
          if (delEl)  delEl.textContent  = delegated + '…';
          if (ndelEl) ndelEl.textContent = (checked - delegated) + '…';
        }
      }

      // Final result — silent update, no notification
      if (delEl)  delEl.textContent  = String(delegated);
      if (ndelEl) ndelEl.textContent = String(total - delegated);

      // Save result to cache so profile page re-opens without RPC call
      _saveDelegationCache(delegated, total, effectiveChainId);

      // Brief green flash to confirm refresh completed
      if (delEl) {
        delEl.style.transition = 'opacity 0.15s';
        delEl.style.opacity    = '0.4';
        setTimeout(() => { delEl.style.opacity = '1'; }, 150);
      }

    } catch (e) {
      // Silent failure — no error toast
    } finally {
      _delegatedCheckBusy = false;
      if (spinner) spinner.style.display = 'none';
    }
  };

})();
