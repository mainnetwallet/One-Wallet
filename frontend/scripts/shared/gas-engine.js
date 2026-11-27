
(function() {
'use strict';

/* ─────────────────────────────────────────────────
   OneGas v3 — simplified gasPrice-based engine
   ─────────────────────────────────────────────────
   Fee model (all derived from live eth_gasPrice):
     maxFeePerGas         = gasPrice × 1.05   (+5%)
     maxPriorityFeePerGas = gasPrice × 0.50   (+50% safety floor: ≥ 1 wei)
     gasLimit             = estimateGas × 1.12 (+12% buffer)
   Legacy fallback (on ANY EIP-1559 error):
     gasPrice (fresh)     × 1.10   (+10% boost)
   Max 1 retry — no infinite loops.
   ───────────────────────────────────────────────── */
window.OneGas = (function() {

  /* ── Constants ── */
  const GAS_BUFFER_MULTIPLIER   = 1.12;   // +12% on estimateGas
  const EIP1559_MAX_FEE_BOOST   = 1.20;   // maxFeePerGas   = gasPrice × 1.20
  const EIP1559_PRIORITY_RATIO  = 0.10;   // maxPriority    = gasPrice × 0.10
  const LEGACY_BOOST_MULTIPLIER = 1.10;   // legacy retry   = gasPrice × 1.10
  const MIN_PRIORITY_WEI        = 1n;     // safety floor   (never 0 or negative)
  const MAX_RETRIES             = 1;      // single fallback attempt
  // Chains that reject txs below a minimum priority fee (wei). Polygon PoS / Amoy: 25 gwei.
  const MIN_TIP_BY_CHAIN        = { 137: 25000000000n, 80002: 25000000000n };
  const ONE_TIP_CACHE         = {};     // chainId -> { v, exp } (60s cache of eth_maxPriorityFeePerGas)

  /* ─────────────────────────────────────────────────
     _fetchLiveGasPrice — always fetches a fresh price
     Tries eth_gasPrice first, falls back to getFeeData
     ───────────────────────────────────────────────── */
  async function _fetchLiveGasPrice(provider, chainId) {
    // Wrap with _withRpcFallback when chainId is available
    const _wf = (chainId && typeof _withRpcFallback === 'function')
      ? (fn) => _withRpcFallback(chainId, fn, 4000)
      : (fn) => fn(provider);

    // Primary: eth_gasPrice RPC call
    try {
      const hex = await _wf(_p => _p.send('eth_gasPrice', []));
      const gp = BigInt(hex);
      if (gp > 0n) return gp;
    } catch {}

    // Fallback: getFeeData
    try {
      const fd = await _wf(_p => _p.getFeeData());
      if (fd.gasPrice && fd.gasPrice > 0n) return fd.gasPrice;
      // EIP-1559 chain: derive effective gas price from maxFeePerGas
      if (fd.maxFeePerGas && fd.maxFeePerGas > 0n) return fd.maxFeePerGas;
    } catch {}

    // Both RPC methods failed — throw so caller can show UI error
    throw new Error('RPC_GAS_FAIL: Could not fetch gas price from network. Check your RPC connection.');
  }

  /* ── Detect EIP-1559 support on current chain ── */
  async function detectEIP1559(provider, chainId) {
    try {
      const _wf = (chainId && typeof _withRpcFallback === 'function')
        ? (fn) => _withRpcFallback(chainId, fn, 4000)
        : (fn) => fn(provider);
      const block = await _wf(_p => _p.getBlock('latest'));
      return block && block.baseFeePerGas !== null && block.baseFeePerGas !== undefined;
    } catch { return false; }
  }

  /* ─────────────────────────────────────────────────
     buildEIP1559Fees
       baseFee from latest block (exact current network base fee)
       maxPriorityFeePerGas from getFeeData() (validator tip)
       maxFeePerGas = (baseFee + priorityFee) × 1.20  (+20% headroom for next blocks)
     ───────────────────────────────────────────────── */
  async function buildEIP1559Fees(provider, chainId) {
    // Fetch latest block + feeData in parallel for accuracy
    const _wf = (chainId && typeof _withRpcFallback === 'function')
      ? (fn) => _withRpcFallback(chainId, fn, 4000)
      : (fn) => fn(provider);
    const [_block, _fd] = await Promise.all([
      _wf(_p => _p.getBlock('latest')).catch(() => null),
      _wf(_p => _p.getFeeData()).catch(() => null),
    ]);

    let baseFee, priorityFee;

    if (_block && _block.baseFeePerGas && _block.baseFeePerGas > 0n) {
      // EIP-1559 chain: use actual baseFee from latest block (most accurate)
      baseFee = _block.baseFeePerGas;
      priorityFee = (_fd && _fd.maxPriorityFeePerGas && _fd.maxPriorityFeePerGas > 0n)
        ? _fd.maxPriorityFeePerGas
        : 1000000n; // 0.001 Gwei min tip
    } else {
      // Legacy chain (BSC etc): fall back to eth_gasPrice
      const gasPrice = await _fetchLiveGasPrice(provider, chainId);
      baseFee    = gasPrice;
      priorityFee = BigInt(Math.floor(Number(gasPrice) * EIP1559_PRIORITY_RATIO));
      if (priorityFee < MIN_PRIORITY_WEI) priorityFee = MIN_PRIORITY_WEI;
    }

    // ethers v6 getFeeData() hardcodes a 1 gwei tip. Some chains (Polygon) enforce a higher minimum and reject
    // anything lower with "-32000 transaction underpriced". Ask the node for its own suggested tip and only ever RAISE ours.
    try {
      const _cidTip = Number(chainId || (provider && provider._network && provider._network.chainId) || 0);
      const _now = Date.now();
      ONE_TIP_CACHE._m = ONE_TIP_CACHE._m || {};
      let _nodeTip = (ONE_TIP_CACHE._m[_cidTip] && ONE_TIP_CACHE._m[_cidTip].exp > _now) ? ONE_TIP_CACHE._m[_cidTip].v : null;
      if (_nodeTip === null) {
        try {
          const _hexTip = await _wf(_p => _p.send('eth_maxPriorityFeePerGas', []));
          _nodeTip = BigInt(_hexTip);
        } catch (_) { _nodeTip = -1n; }   // -1n = node does not support the method
        ONE_TIP_CACHE._m[_cidTip] = { v: _nodeTip, exp: _now + 60000 };
      }
      // ethers v6 hardcodes a 1 gwei tip. On L2s like Arbitrum that makes maxFeePerGas ~100x the real price and
      // the node then demands balance >= gasLimit*maxFeePerGas, so dust wallets could never send. Trust the node's tip.
      if (_nodeTip >= 0n) priorityFee = _nodeTip;
      const _minTip = MIN_TIP_BY_CHAIN[_cidTip];
      if (_minTip && priorityFee < _minTip) priorityFee = _minTip;
    } catch (_) {}

    // effectiveGasPrice = baseFee + tip (what user actually pays)
    const effectiveGasPrice = baseFee + priorityFee;

    // maxFeePerGas = effectivePrice × 1.20 (headroom for baseFee fluctuation over next blocks)
    let maxFeePerGas = BigInt(Math.ceil(Number(effectiveGasPrice) * EIP1559_MAX_FEE_BOOST));
    // With a ~0 tip (Arbitrum/Base/OP) the 20% headroom above is tiny — keep at least 1.5x baseFee so a small base-fee bump
    // between estimate and send can't make the node reject with "max fee per gas less than block base fee".
    const _floorMax = (baseFee * 3n) / 2n + priorityFee;
    if (maxFeePerGas < _floorMax) maxFeePerGas = _floorMax;

    let maxPriorityFeePerGas = priorityFee;
    if (maxPriorityFeePerGas < MIN_PRIORITY_WEI) maxPriorityFeePerGas = MIN_PRIORITY_WEI;
    if (maxPriorityFeePerGas > maxFeePerGas)     maxPriorityFeePerGas = maxFeePerGas;

    // Cache effective price for gas USD display in DEX comparison bars
    try { SW._lastGasPriceGwei = Number(effectiveGasPrice) / 1e9; } catch(_) {}

    return { maxFeePerGas, maxPriorityFeePerGas, gasPrice: effectiveGasPrice };
  }

  /* ─────────────────────────────────────────────────
     buildLegacyFees
       gasPrice (fresh) boosted by +15% on retry
     ───────────────────────────────────────────────── */
  async function buildLegacyFees(provider, boost = false, chainId) {
    let gasPrice = await _fetchLiveGasPrice(provider, chainId);

    if (boost) {
      gasPrice = BigInt(Math.ceil(Number(gasPrice) * LEGACY_BOOST_MULTIPLIER));
    }

    return { gasPrice };
  }

  /* ── Estimate gas with +12% safety buffer — uses _swWithFallback + timeout ── */
  async function estimateGasWithBuffer(provider, txObj) {
    // Extract chainId from txObj for _swWithFallback, strip it from the estimate call
    const { chainId: _cid, ...estObj } = txObj;
    try {
      // Use _swWithFallback if chainId is available (swap context) — RPC flood-safe + timeout
      if (_cid && typeof _swWithFallback === 'function') {
        const est = await _swWithFallback(_cid, _p => _p.estimateGas(estObj));
        if (est) return BigInt(Math.ceil(Number(est) * GAS_BUFFER_MULTIPLIER));
      }
      // Fallback: direct provider call (non-swap context)
      const est = await provider.estimateGas(estObj);
      return BigInt(Math.ceil(Number(est) * GAS_BUFFER_MULTIPLIER));
    } catch {
      // Static fallback: use API-reported gasLimit hint if available, else 250k
      const hint = txObj.gasLimit || txObj.gas;
      return hint ? BigInt(Math.ceil(Number(hint) * GAS_BUFFER_MULTIPLIER)) : 250000n;
    }
  }

  /* ─────────────────────────────────────────────────
     sendWithEIP1559 — EIP-1559 type:0x2 attempt
     ───────────────────────────────────────────────── */
  async function sendWithEIP1559(wallet, provider, txBase, onStatus) {
    onStatus && onStatus('⛽ Calculating gas…', 'pending');
    const _cId = txBase.chainId || null;
    const fees    = await buildEIP1559Fees(provider, _cId);
    const gasLimit = await estimateGasWithBuffer(provider, { ...txBase, from: wallet.address });

    onStatus && onStatus('⚡ Sending via EIP-1559…', 'pending');
    const tx = await wallet.sendTransaction({
      ...txBase,
      type: 2,
      maxFeePerGas:         fees.maxFeePerGas,
      maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
      gasLimit,
    });
    return tx;
  }

  /* ─────────────────────────────────────────────────
     sendWithLegacy — Legacy type:0x0 transaction
     ───────────────────────────────────────────────── */
  async function sendWithLegacy(wallet, provider, txBase, onStatus, boost = false) {
    onStatus && onStatus('⛽ Calculating gas…', 'pending');
    const _cId = txBase.chainId || null;
    const fees    = await buildLegacyFees(provider, boost, _cId);
    const gasLimit = await estimateGasWithBuffer(provider, { ...txBase, from: wallet.address });

    onStatus && onStatus('🔄 EIP-1559 failed, switching to Legacy…', 'pending');
    const tx = await wallet.sendTransaction({
      ...txBase,
      type: 0,
      gasPrice:  fees.gasPrice,
      gasLimit,
    });
    return tx;
  }

  /* ─────────────────────────────────────────────────
     sendWithFallback — orchestrator
       1. Resolve chainId & nonce
       2. Try EIP-1559 (type 2) — if chain supports it
       3. On ANY error → immediate Legacy fallback (type 0)
       4. Max 1 retry — no infinite loops
     ───────────────────────────────────────────────── */
  async function sendWithFallback(wallet, provider, txBase, onStatus, nonce) {
    // Attach nonce
    if (nonce !== undefined) txBase = { ...txBase, nonce };

    // Attach chainId
    if (txBase.chainId === undefined) {
      try {
        // BUG FIX: _cid2 was set from txBase.chainId which is undefined here.
        // Use currentChainConfig.chainId or _getRpcListForChain as the chainId source instead.
        const _resolvedCid = (typeof currentChainConfig !== 'undefined' && currentChainConfig && currentChainConfig.chainId)
          ? currentChainConfig.chainId
          : null;
        const net = (_resolvedCid && typeof _withRpcFallback === 'function')
          ? await _withRpcFallback(_resolvedCid, _p => _p.getNetwork())
          : await provider.getNetwork();
        txBase.chainId = Number(net.chainId);
      } catch {}
    }

    const _ngChainId = txBase.chainId || null;
    let attempt = 0;

    // Check EIP-1559 support and respect manual gas mode override
    // Use _withRpcFallback if chainId available so dead RPC doesn't block EIP-1559 check
    const isEIP1559 = _ngChainId && typeof _withRpcFallback === 'function'
      ? await _withRpcFallback(_ngChainId, _p => detectEIP1559(_p)).catch(() => detectEIP1559(provider))
      : await detectEIP1559(provider);
    const gasMode   = window.OneGasMode || 'auto';
    const forceEIP1559 = gasMode === 'eip1559';
    const forceLegacy  = gasMode === 'legacy';

    /* ─── Attempt 1: EIP-1559 ─── */
    if (!forceLegacy && (isEIP1559 || forceEIP1559)) {
      try {
        const tx = await sendWithEIP1559(wallet, provider, txBase, onStatus);
        onStatus && onStatus('⏳ Transaction Submitted: ' + tx.hash.slice(0, 18) + '…', 'pending');
        return tx;
      } catch (e) {
        attempt++;
        if (attempt > MAX_RETRIES) throw e;

        // ANY error → fall through to legacy
        const reason = (e.shortMessage || e.message || String(e)).slice(0, 80);
        onStatus && onStatus('⚠️ EIP-1559 failed (' + reason + ') — switching to Legacy…', 'pending');
        await new Promise(r => setTimeout(r, 400)); // brief pause before retry
      }
    }

    /* ─── Attempt 2 (or primary on Legacy mode): Legacy ─── */
    
    if (attempt > 0) {
      try {
        const freshNonce = _ngChainId && typeof _withRpcFallback === 'function'
          ? await _withRpcFallback(_ngChainId, _p => _p.getTransactionCount(wallet.address, 'latest'))
          : await provider.getTransactionCount(wallet.address, 'latest');
        txBase = { ...txBase, nonce: freshNonce };
      } catch {}
    }

    const boosted = attempt > 0; // boost gas only when this is a fallback retry
    const tx = await sendWithLegacy(wallet, provider, txBase, onStatus, boosted);
    onStatus && onStatus('⏳ Legacy TX Submitted: ' + tx.hash.slice(0, 18) + '…', 'pending');
    return tx;
  }

  return {
    sendWithFallback,
    sendWithEIP1559,
    sendWithLegacy,
    buildEIP1559Fees,
    buildLegacyFees,
    detectEIP1559,
    estimateGasWithBuffer,
  };
})();

/* ─────────────────────────────────────────────────────────────
   DARK / LIGHT THEME TOGGLE
   ───────────────────────────────────────────────────────────── */
window._applyTheme = function(mode) {
  const body = document.body;
  const track    = document.getElementById('theme-toggle-track');
  const thumb    = document.getElementById('theme-toggle-thumb');
  const icon     = document.getElementById('theme-menu-icon-glyph');
  const iconWrap = document.getElementById('theme-menu-icon');
  const title    = document.getElementById('theme-menu-title');
  const sub      = document.getElementById('theme-menu-sub');

  if (mode === 'light') {
    body.classList.add('light-mode');
    if (track)    { track.classList.add('light'); }
    if (thumb)    { thumb.textContent = '☀️'; }
    if (icon)     { icon.textContent = 'light_mode'; icon.style.color = '#f59e0b'; }
    if (iconWrap) { iconWrap.style.background = 'rgba(245,158,11,0.15)'; }
    if (title)    { title.textContent = 'Light Mode'; }
    if (sub)      { sub.textContent = 'Switch to dark mode'; }
  } else {
    body.classList.remove('light-mode');
    if (track)    { track.classList.remove('light'); }
    if (thumb)    { thumb.textContent = '🌙'; }
    if (icon)     { icon.textContent = 'dark_mode'; icon.style.color = '#a78bfa'; }
    if (iconWrap) { iconWrap.style.background = 'rgba(99,102,241,0.15)'; }
    if (title)    { title.textContent = 'Dark Mode'; }
    if (sub)      { sub.textContent = 'Switch to light mode'; }
  }
};

window.toggleThemeMode = function() {
  const isLight = document.body.classList.contains('light-mode');
  const newMode = isLight ? 'dark' : 'light';
  try { localStorage.setItem('one-theme', newMode); } catch(e) {}
  window._applyTheme(newMode);
  try { if (typeof haptic === 'function') haptic(); } catch(e) {}
  try {
    if (typeof showToast === 'function') {
      showToast(newMode === 'light' ? '☀️ Light Mode' : '🌙 Dark Mode', 'info');
    }
  } catch(e) {}
};

// Restore saved preference on load
(function() {
  let saved = 'dark';
  try { saved = localStorage.getItem('one-theme') || 'dark'; } catch(e) {}
  if (saved === 'light') {
    try { document.body.classList.add('light-mode'); } catch(e) {}
  }
  // Update controls after DOM ready
  function doApply() { window._applyTheme(saved); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(doApply, 500); });
  } else {
    setTimeout(doApply, 500);
  }
})();

/* ─────────────────────────────────────────────────────────────
   GAS MODE TOGGLE — Auto / EIP-1559 / Legacy
   Gas engine: v3 — gasPrice-based EIP-1559 + instant Legacy fallback
   ───────────────────────────────────────────────────────────── */
window.OneGasMode = 'auto'; // default

(function _injectGasToggle() {
  const TOGGLE_HTML = `
    <div class="one-gas-toggle-widget" style="
      display:flex;align-items:center;gap:6px;
      background:rgba(255,255,255,0.04);
      border:1px solid rgba(255,255,255,0.08);
      border-radius:10px;padding:4px 6px;
      font-family:var(--font-mono);font-size:9px;
      color:var(--text-muted);flex-shrink:0;
      cursor:default;
    " title="Gas Mode">
      <span class="material-icons-round" style="font-size:12px;color:var(--accent-amber);">local_gas_station</span>
      <span class="ng-label" style="letter-spacing:1px;font-weight:700;">Gas Type</span>
      <div style="display:flex;gap:3px;">
        <button onclick="window._ngSet('auto')" class="ng-btn ng-btn-auto" style="padding:2px 6px;border-radius:6px;border:none;cursor:pointer;font-family:var(--font-mono);font-size:8px;font-weight:700;background:rgba(99,102,241,0.3);color:var(--neon-purple);">AUTO</button>
        <button onclick="window._ngSet('eip1559')" class="ng-btn ng-btn-eip1559" style="padding:2px 6px;border-radius:6px;border:none;cursor:pointer;font-family:var(--font-mono);font-size:8px;font-weight:700;background:var(--bg-raised);color:var(--text-muted);">1559</button>
        <button onclick="window._ngSet('legacy')" class="ng-btn ng-btn-legacy" style="padding:2px 6px;border-radius:6px;border:none;cursor:pointer;font-family:var(--font-mono);font-size:8px;font-weight:700;background:var(--bg-raised);color:var(--text-muted);">LEGACY</button>
      </div>
    </div>`;

  window._ngSet = function(mode) {
    window.OneGasMode = mode;
    const map = { auto:'AUTO', eip1559:'EIP-1559', legacy:'LEGACY' };
    const colors = { auto:'var(--neon-purple)', eip1559:'var(--neon-cyan)', legacy:'var(--accent-amber)' };
    document.querySelectorAll('[id^="one-gas-toggle"]').forEach(el => {
      const lbl = el.querySelector('.ng-label');
      if (lbl) { lbl.style.color = colors[mode]; }
      ['auto','eip1559','legacy'].forEach(m => {
        const btn = el.querySelector('.ng-btn-' + m);
        if (!btn) return;
        if (m === mode) {
          btn.style.background = m === 'auto' ? 'rgba(99,102,241,0.3)' : m === 'eip1559' ? 'rgba(6,182,212,0.25)' : 'rgba(245,158,11,0.25)';
          btn.style.color = colors[m];
        } else {
          btn.style.background = 'var(--bg-raised)';
          btn.style.color = 'var(--text-muted)';
        }
      });
    });
  };

  // Compact swap-screen pill: default AUTO, tap to cycle AUTO -> 1559 -> LEGACY
  const SWAP_PILL_HTML = `
    <span style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);letter-spacing:0.5px;">Network fee</span>
    <button type="button" onclick="window._ngCycle()" class="sw-gas-pill" aria-label="Gas type, tap to change" title="Tap to change gas type"
      style="display:flex;align-items:center;gap:6px;padding:5px 11px 5px 9px;border-radius:999px;background:var(--bg-raised);border:1px solid var(--border-subtle);cursor:pointer;font-family:var(--font-mono);font-size:10px;color:var(--text-secondary);-webkit-tap-highlight-color:transparent;">
      <span class="material-icons-round" style="font-size:14px;color:var(--accent-amber);pointer-events:none;">local_gas_station</span>
      <span style="pointer-events:none;">Gas</span>
      <span class="sw-gas-pill-label" style="font-weight:700;letter-spacing:0.5px;color:var(--neon-purple);pointer-events:none;">AUTO</span>
      <span class="material-icons-round" style="font-size:13px;color:var(--text-muted);pointer-events:none;">swap_horiz</span>
    </button>`;

  function _ngSyncPills(mode) {
    const names  = { auto:'AUTO', eip1559:'1559', legacy:'LEGACY' };
    const colors = { auto:'var(--neon-purple)', eip1559:'var(--neon-cyan)', legacy:'var(--accent-amber)' };
    document.querySelectorAll('.sw-gas-pill-label').forEach(el => {
      el.textContent = names[mode] || 'AUTO';
      el.style.color = colors[mode] || colors.auto;
    });
  }

  const _ngSetBase = window._ngSet;
  window._ngSet = function(mode) { _ngSetBase(mode); _ngSyncPills(mode); };

  window._ngCycle = function() {
    const order = ['auto', 'eip1559', 'legacy'];
    const next = order[(order.indexOf(window.OneGasMode || 'auto') + 1) % order.length];
    window._ngSet(next);
    try { if (typeof haptic === 'function') haptic(); } catch (e) {}
  };

  // Inject after DOM ready — place into send-review-card and bridge status area
  function _tryInject() {
    // Send section — inject near send-btn
    const sendBtn = document.getElementById('send-btn');
    if (sendBtn && !document.getElementById('one-gas-toggle-send')) {
      const wrap = document.createElement('div');
      wrap.id = 'one-gas-toggle-send';
      wrap.innerHTML = TOGGLE_HTML;
      wrap.querySelector('.one-gas-toggle-widget').id = 'one-gas-toggle-send-inner';
      wrap.style.cssText = 'padding:0 0 8px 0;display:flex;justify-content:flex-end;';
      sendBtn.parentNode.insertBefore(wrap, sendBtn);
    }

    // Swap section — compact gas pill above sw-action-btn
    const swapBtn = document.getElementById('sw-action-btn');
    if (swapBtn && !document.getElementById('one-gas-toggle-swap')) {
      const wrap3 = document.createElement('div');
      wrap3.id = 'one-gas-toggle-swap';
      wrap3.innerHTML = SWAP_PILL_HTML;
      wrap3.style.cssText = 'padding:2px 2px 10px;display:flex;align-items:center;justify-content:space-between;';
      swapBtn.parentNode.insertBefore(wrap3, swapBtn);
      _ngSyncPills(window.OneGasMode || 'auto');
    }

    // Bridge section — inject inside settings sheet GAS MODE div
    const brGasDiv = document.getElementById('one-gas-toggle-bridge');
    if (brGasDiv && !brGasDiv.hasChildNodes()) {
      brGasDiv.innerHTML = TOGGLE_HTML;
      brGasDiv.querySelector('.one-gas-toggle-widget').id = 'one-gas-toggle-bridge-inner';
    }
  }

    // ── Transfer Hub sections — inject above each execute button ──
    const _thTargets = [
      // [buttonId, toggleId]
      ['deployBtn',                      'th-batch-native-deploy'],
      ['deployBtnToken',                 'th-batch-token-deploy'],
      ['executeBtn',                     'th-batch-native'],
      ['executeBtnToken',                'th-batch-token'],
      ['executeDirectBtnMultiKeyNative', 'th-mkn-direct'],
      ['executeBtnMultiKeyNative',       'th-mkn-contract'],
      ['executeBtnMultiKeyToken',        'th-mkt'],
      ['executeNftDistributeBtn',        'th-nft-dist'],
      ['executeNftCollectBtn',           'th-nft-coll'],
      ['executeSelfTransferBtn',         'th-self'],
      ['withdrawNativeBtn',              'th-wd-native', 'one-gas-toggle-th-wd-static'],
      ['executeApprovalBtn',             'th-approval'],
      ['executeW2WBtn',                  'th-w2w'],
      ['executeW2WTokenBtn',             'th-w2w-token'],
    ];
    _thTargets.forEach(function([btnId, toggleId, staticId]) {
      const _btn = document.getElementById(btnId);
      const _wrapId = 'one-gas-toggle-' + toggleId;
      if (_btn && !document.getElementById(_wrapId)) {
        // Use pre-placed static container if provided or for known special cases
        const _staticTarget = (staticId ? document.getElementById(staticId) : null)
          || (btnId === 'executeBtnMultiKeyNative' ? document.getElementById('one-gas-toggle-th-mkn-contract-static') : null);
        if (_staticTarget) {
          _staticTarget.id = _wrapId;
          _staticTarget.innerHTML = TOGGLE_HTML;
          const _inner = _staticTarget.querySelector('.one-gas-toggle-widget');
          if (_inner) _inner.id = _wrapId + '-inner';
        } else {
          const _w = document.createElement('div');
          _w.id = _wrapId;
          _w.innerHTML = TOGGLE_HTML;
          _w.querySelector('.one-gas-toggle-widget').id = _wrapId + '-inner';
          _w.style.cssText = 'padding:0 0 8px 0;display:flex;justify-content:flex-end;';
          _btn.parentNode.insertBefore(_w, _btn);
        }
      }
    });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { setTimeout(_tryInject, 800); setTimeout(_tryInject, 2000); });
  } else {
    setTimeout(_tryInject, 800);
    setTimeout(_tryInject, 2000);
  }
})();

})();

/* ═══════════════════════════════════════════════════════════════
   TRANSFER HUB GAS HELPER — _thGas(provider)
   Reads window.OneGasMode (AUTO / EIP-1559 / LEGACY)
   Returns plain gas options object → spread into txOptions
   ═══════════════════════════════════════════════════════════════ */
window._thGas = async function(p) {
  const _mode    = window.OneGasMode || 'auto';
  const _legacy  = _mode === 'legacy';
  const _force59 = _mode === 'eip1559';
  // ── Use OneGas engine (same as swap / send / bridge) ──
  if (window.OneGas) {
    try {
      const _is59 = !_legacy && await window.OneGas.detectEIP1559(p).catch(() => false);
      if (!_legacy && (_is59 || _force59)) {
        const f = await window.OneGas.buildEIP1559Fees(p);
        return { maxFeePerGas: f.maxFeePerGas, maxPriorityFeePerGas: f.maxPriorityFeePerGas };
      }
    } catch (_e) {}
    try {
      const lf = await window.OneGas.buildLegacyFees(p);
      return { gasPrice: lf.gasPrice };
    } catch (_e2) {}
  }
  // ── Inline fallback ──
  try {
    const fd = await p.getFeeData();
    if (!_legacy && fd.maxFeePerGas && fd.maxPriorityFeePerGas) {
      const blk = await p.getBlock('latest');
      const bf  = blk && blk.baseFeePerGas;
      if (bf) {
          // priority: 1 gwei floor or 1% of baseFee (whichever is larger) — keeps tip reasonable
          const _tip = bf / 100n > 1000000000n ? bf / 100n : 1000000000n;
          // maxFee: baseFee * 1.5 + tip — guarantees maxFee >= baseFee + priority always
          const _maxFee = (bf * 150n) / 100n + _tip;
          return { maxFeePerGas: _maxFee, maxPriorityFeePerGas: _tip };
        }
    }
    if (fd.gasPrice) return { gasPrice: (fd.gasPrice * 110n) / 100n };
  } catch (_e3) {}
  return {};
};
