async function onSendPkInput(directPk) {
  const raw = directPk !== undefined ? directPk : (document.getElementById('send-pk')?.value?.trim() || '');
  sendWallet = null; sendBalances = {};
  (document.getElementById('send-btn') || {}).disabled = true;
  const _src2 = document.getElementById('send-review-card'); if (_src2) _src2.style.display = 'none';
  // Reset all dynamic token balance chips
  document.querySelectorAll('.send-token-bal').forEach(el => { el.textContent = '—'; });
  (document.getElementById('send-bal-display') || {}).textContent = 'Balance —';

  let pk = raw.startsWith('0x') ? raw : '0x' + raw;
  if (pk.length !== 66) { return; }

  try {
    // Create wallet instance first (no provider needed for address derivation)
    let tempWallet;
    try { tempWallet = new ethers.Wallet(pk); } catch(e) {
      return;
    }
    const addr = tempWallet.address;

    // Set wallet IMMEDIATELY — before any async work, so button can enable
    sendWallet = tempWallet;
    checkSendReady();

    // Show cached balances (non-blocking — errors don't block send button)
    try {
      await fetchSendBalancesDynamic(addr, pk);
      updateSendBalDisplayDynamic();
    } catch(_) {}

    // Init provider + attach wallet in background (needed for sending)
    getSendProvider().then(provider => {
      sendProvider = provider;
      sendWallet = new ethers.Wallet(pk, provider);
      checkSendReady();

      // Delegation badge (Base only)
      if (sendSelectedChainId === 8453) {
        isDelegated(addr).then(delegated => {
          const badge = delegated
            ? ' <span style="background:linear-gradient(135deg,rgba(16,185,129,0.2),rgba(6,182,212,0.2));border:1px solid rgba(16,185,129,0.4);color:var(--accent-green);font-size:9px;padding:1px 6px;border-radius:5px;font-family:var(--font-mono);letter-spacing:1px;">✨ SPONSORED</span>'
            : ' <span style="background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.3);color:var(--accent-amber);font-size:9px;padding:1px 6px;border-radius:5px;font-family:var(--font-mono);letter-spacing:1px;">⛽ EOA</span>';
          const gasEl = document.getElementById('review-gas');
          if (gasEl) gasEl.textContent = delegated ? '✨ FREE (Coinbase Sponsored)' : '⛽ Normal (User pays gas)';
        }).catch(() => {});
      } else {
        const gasEl = document.getElementById('review-gas');
        if (gasEl) gasEl.textContent = '⛽ Normal (User pays gas)';
      }
    }).catch(e => {});
  } catch(e) {}
}

function onSendToInput() {
  const val = document.getElementById('send-to')?.value.trim();
  const inp = document.getElementById('send-to');
  if (val.length === 0) { inp.className = 'send-input'; }
  else if (/^0x[0-9a-fA-F]{40}$/.test(val)) { inp.className = 'send-input valid'; }
  else { inp.className = 'send-input invalid'; }
  checkSendReady();
}
