function swUpdateButton() {
  const btn     = document.getElementById('sw-action-btn');
  const lbl     = document.getElementById('sw-btn-label');
  const ico     = document.getElementById('sw-btn-icon');
  const stepInd = document.getElementById('sw-step-indicator');
  const txProg  = document.getElementById('sw-tx-progress');
  if (!btn) return;

  function _dim(text, icon, clickable) {
    // Colours/shape come from CSS (#sw-action-btn) — same look as BRIDGE NOW.
    btn.style.opacity    = clickable ? '1' : '0.4';
    btn.style.filter     = clickable ? '' : 'grayscale(0.5)';
    btn.style.cursor     = clickable ? 'pointer' : 'not-allowed';
    if (lbl) lbl.textContent = text;
    if (ico) ico.textContent = icon;
    btn.onclick = null;
  }
  function _active(text, icon, fn, color) {
    btn.style.opacity    = '1';
    btn.style.filter     = '';
    btn.style.cursor     = 'pointer';
    if (lbl) lbl.textContent = text;
    if (ico) ico.textContent = icon;
    btn.onclick          = fn || null;
  }

  // Hide step indicator and tx progress always
  if (stepInd) stepInd.style.display = 'none';
  if (txProg)  txProg.style.display  = 'none';

  // State: Wallet not connected
  if (!SW.walletConnected || !SW.walletAddress) {
    _dim('Connect Wallet', 'account_balance_wallet', true);
    btn.style.cursor = 'pointer';
    btn.onclick = () => { if (typeof swOpenWalletPanel === 'function') swOpenWalletPanel(); };
    return;
  }

  // State: Input validation — read DOM input as ground truth
  const _inp = document.getElementById('sw-from-amount');
  const _inputVal = _inp ? _inp.value : (SW.fromAmount || '');
  const amt = parseFloat(_inputVal) || 0;
  if (!amt || amt <= 0) { _dim('Enter Amount', 'edit'); return; }
  if (!SW.toToken)      { _dim('Select Token', 'token'); return; }
  if (SW.fromToken && SW.toToken && SW.fromToken.sym === SW.toToken.sym) {
    _dim('Select Different Token', 'swap_horiz'); return;
  }
  if (SW.fromToken && SW.fromToken.balance !== undefined) {
    var _bal = parseFloat(SW.fromToken.balance) || 0;
    if (amt > _bal) { _dim('Insufficient Balance', 'account_balance_wallet'); return; }
  }

  // State: Quote is currently being fetched — show loading only if no route yet
  if (SW._routeFetching && !SW._cachedSwapTx) {
    _dim('Finding route…', 'sync', false);
    return;
  }

  // Ready: show Swap button
  if (SW._cachedSwapTx) {
    _active('SWAP NOW', 'rocket_launch', () => swHandleAction());
    return;
  }

  // APIs finished but no route found (and not fetching)
  if (!SW._routeFetching && !SW._cachedSwapTx && parseFloat(SW.fromAmount) > 0 && SW.toToken) {
    _dim('No route found', 'error_outline', false);
    return;
  }

  _active('SWAP NOW', 'rocket_launch', () => swHandleAction());
}