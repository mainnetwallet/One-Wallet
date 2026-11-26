
// ══════════════════════════════════════════════
// TRANSACTION HISTORY SYSTEM
// Saves swap/bridge/send TXs to localStorage
// ══════════════════════════════════════════════

const TX_HISTORY_KEY = 'one_tx_history';

function loadTxHistory() {
  try {
    const raw = localStorage.getItem(TX_HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch(e) { return []; }
}

function saveTxHistory(txs) {
  try { localStorage.setItem(TX_HISTORY_KEY, JSON.stringify(txs)); } catch(e) {}
}

function saveTxToHistory(txData) {
  const txs = loadTxHistory();
  const newEntry = {
    ...txData,
    timestamp: Date.now(),
    id: Date.now() + '_' + Math.random().toString(36).slice(2,7),
  };
  txs.unshift(newEntry);
  // Keep max 15 bridge/swap entries in recent — trim oldest beyond limit
  const bridgeSwap = txs.filter(t => t.type === 'bridge' || t.type === 'swap');
  const others     = txs.filter(t => t.type !== 'bridge' && t.type !== 'swap');
  const trimmed    = bridgeSwap.slice(0, 15);
  // Merge back preserving original order (newest first)
  const merged = [];
  let bi = 0, oi = 0;
  for (const t of txs) {
    if ((t.type === 'bridge' || t.type === 'swap') && bi < trimmed.length && trimmed[bi] === t) { merged.push(t); bi++; }
    else if (t.type !== 'bridge' && t.type !== 'swap') { merged.push(t); }
  }
  saveTxHistory(merged);
  updateTxMenuBadge();

  // ── Transaction Notification ──
  (function() {
    try {
      var notifEnabled = localStorage.getItem('one_notif') === 'on';
      if (!notifEnabled) return;
      if (!window.isOneAndroid || !window.OneAndroid) return;

      // Build notification text
      var txType = (newEntry.type || 'Transaction');
      txType = txType.charAt(0).toUpperCase() + txType.slice(1);
      var amount = newEntry.amount ? (newEntry.amount + ' ' + (newEntry.symbol || '')) : '';
      var body = amount ? (txType + ': ' + amount + ' sent successfully ✓') : (txType + ' completed successfully ✓');

      // Build explorer URL — check all possible chainId + hash fields
      var explorerUrl = '';
      try {
        var txHash = newEntry.hash || newEntry.txHash || '';
        var cid = newEntry.chainId || newEntry.fromChainId || newEntry.chain || null;

        if (txHash && txHash.length >= 10) {
          // Try getExplorerUrl if available in scope
          if (cid && typeof getExplorerUrl === 'function') {
            explorerUrl = getExplorerUrl(cid, txHash) || '';
          }
          // Inline fallback map — scope-safe
          if (!explorerUrl) {
            var _EXP = {
              1:          'https://etherscan.io/tx/',
              8453:       'https://basescan.org/tx/',
              42161:      'https://arbiscan.io/tx/',
              10:         'https://optimistic.etherscan.io/tx/',
              137:        'https://polygonscan.com/tx/',
              56:         'https://bscscan.com/tx/',
              43114:      'https://snowtrace.io/tx/',
              59144:      'https://lineascan.build/tx/',
              534352:     'https://scrollscan.com/tx/',
              324:        'https://explorer.zksync.io/tx/',
              81457:      'https://blastscan.io/tx/',
              100:        'https://gnosisscan.io/tx/',
              250:        'https://ftmscan.com/tx/',
              10143:      'https://testnet.monadexplorer.com/tx/',
            };
            var base = (cid && _EXP[cid]) ? _EXP[cid] : 'https://basescan.org/tx/';
            explorerUrl = base + txHash;
          }
        }
      } catch(ex) {}

      // Use showNotificationWithUrl → Android handles 1-5 normal, 6+ silent
      if (typeof window.OneAndroid.showNotificationWithUrl === 'function') {
        window.OneAndroid.showNotificationWithUrl('One Wallet', body, explorerUrl);
      } else if (typeof window.OneAndroid.showNotification === 'function') {
        window.OneAndroid.showNotification('One Wallet', body);
      }
    } catch(e) {}
  })();

  return newEntry; // return saved entry so callers can capture the id
}

function clearTxHistory() {
  try { localStorage.removeItem(TX_HISTORY_KEY); } catch(e) {}
  // resetNotifCount() intentionally NOT called here —
  // clearing history should not restart sound notifications
  updateTxMenuBadge();
  renderTxHistory();
  showToast('History cleared', 'delete_forever');
  haptic();
}

function updateTxMenuBadge() {
  const txs = loadTxHistory();
  const sub = document.getElementById('txh-menu-sub');
  if (sub) sub.textContent = txs.length + ' transaction' + (txs.length !== 1 ? 's' : '');
}

function openTxHistory() {
  // Purge expired before showing
  const txs = loadTxHistory();
  saveTxHistory(txs);
  renderTxHistory();
  document.getElementById('txh-overlay')?.classList.add('open');
  haptic();
  // Check & resolve any pending bridge txs in background
  txhCheckPendingStatuses();
}

async function txhCheckPendingStatuses() {
  const allTxs  = loadTxHistory();
  // Also re-check Rubic entries marked failed in the last 24h — a false FAIL can still flip to SUCCESS
  const pending = allTxs.filter(t => {
    if (t.type !== 'bridge' || !t.hash) return false;
    if (t.pendingRecv === true) return true;
    return t.failed === true && (t.provider || '').toLowerCase() === 'rubic' && (Date.now() - (t.timestamp || 0)) < 24 * 3600 * 1000;
  });
  if (!pending.length) return;

  const RANGO_KEY = window._ONE_RANGO_KEY;

  // ── Helper: check one provider, return { status, recv } or null ──
  async function _checkLifi(tx) {
    try {
      let url = 'https://li.quest/v1/status?txHash=' + tx.hash;
      if (tx.fromChainId) url += '&fromChain=' + tx.fromChainId;
      if (tx.toChainId)   url += '&toChain='   + tx.toChainId;
      const res = await fetch(url, { headers: { 'x-lifi-api-key': 'b3e55edd-de70-4578-b761-cd2aac0fbae0.685a5adf-2580-486e-a8ff-1df4992b3f2e' }, signal: AbortSignal.timeout(8000) });
      if (!res.ok) return null;
      const data = await res.json();
      const st  = (data.status    || '').toUpperCase();
      const sub = (data.substatus || '').toUpperCase();
      const recv = data.receiving?.txHash || data.toTxHash || data.destinationTxHash || null;
      if (st === 'DONE' || sub === 'COMPLETED' || sub === 'PARTIAL') return { status: 'SUCCESS', recv };
      if (st === 'FAILED') return { status: 'FAILED', recv: null };
    } catch(_) {}
    return null;
  }

  async function _checkRubic(tx) {
    try {
      let st, recv;
      if (typeof _brRubicStatus === 'function') {
        const rs = await _brRubicStatus(tx.hash, tx.rubicTradeId || null, 8000);
        if (!rs) return null;
        st = rs.raw; recv = rs.recv;
      } else {
        const res = await fetch('https://api-v2.rubic.exchange/api/info/status?srcTxHash=' + tx.hash, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return null;
        const data = await res.json();
        st = (data.status || '').toUpperCase();
        recv = data.destinationTxHash || null;
      }
      if (st === 'SUCCESS') return { status: 'SUCCESS', recv };
      // soft = needs a second consecutive failed check before it is persisted as FAILED
      if (st === 'FAIL' || st === 'FAILED' || st === 'REVERT' || st === 'REVERTED') return { status: 'FAILED', recv: null, soft: true };
      // NOT_FOUND / PENDING / LONG_PENDING → still waiting, return null to keep polling
    } catch(_) {}
    return null;
  }

  // ── Rango: extract dest recv hash from any Rango API response ──
  // Official field per /basic/status docs: bridgeData.destTxHash
  function _rangoExtractRecv(data) {
    // 1) Official: bridgeData.destTxHash
    var recv = (data.bridgeData && data.bridgeData.destTxHash) || null;
    // 2) explorerUrl — "Outbound" description
    if (!recv && Array.isArray(data.explorerUrl) && data.explorerUrl.length > 0) {
      var de = data.explorerUrl.find(function(e) {
                  return e.description && (
                    e.description.toLowerCase().includes('outbound') ||
                    e.description.toLowerCase().includes('dest')
                  );
                }) || data.explorerUrl[data.explorerUrl.length - 1];
      if (de && de.url) {
        var parts = de.url.split('/'), cand = parts[parts.length - 1];
        if (cand && cand.startsWith('0x') && cand.length >= 42) recv = cand;
      }
    }
    // 3) bridgeExtra.destTx (older field)
    if (!recv) recv = (data.bridgeExtra && data.bridgeExtra.destTx) || null;
    return recv || null;
  }

  async function _checkRango(tx) {
    if (!tx.hash) return null;
    const _rKey = window._ONE_RANGO_KEY;

    // ── Method 1: Rango Official /basic/status API (requestId + txId required) ──
    try {
      let _url1 = 'https://api.rango.exchange/basic/status'
        + '?apiKey='  + encodeURIComponent(_rKey)
        + '&txId='    + encodeURIComponent(tx.hash);
      if (tx.rangoRequestId) _url1 += '&requestId=' + encodeURIComponent(tx.rangoRequestId);
      const res1 = await fetch(_url1, {
        method: 'GET', headers: { 'accept': 'application/json' },
        signal: AbortSignal.timeout(8000)
      });
      if (res1.ok) {
        const d1 = await res1.json();
        const st1 = (d1.status || '').toUpperCase();
        if (st1 === 'SUCCESS') return { status: 'SUCCESS', recv: _rangoExtractRecv(d1) };
        if (st1 === 'FAILED')  return { status: 'FAILED',  recv: null };
        if (st1 === 'RUNNING') return null; // valid in-progress response
      }
    } catch(_) {}

    // ── Method 2: Retry with requestId as primary (txId may not be indexed yet) ──
    // Note: explorer.rango.exchange is a UI-only explorer with no public REST API.
    // All programmatic status checks MUST use api.rango.exchange/basic/status.
    if (tx.rangoRequestId) {
      try {
        const _url2 = 'https://api.rango.exchange/basic/status'
          + '?apiKey='    + encodeURIComponent(_rKey)
          + '&requestId=' + encodeURIComponent(tx.rangoRequestId)
          + '&txId='      + encodeURIComponent(tx.hash);
        const res2 = await fetch(_url2, {
          method: 'GET', headers: { 'accept': 'application/json' },
          signal: AbortSignal.timeout(8000)
        });
        if (res2.ok) {
          const d2 = await res2.json();
          const st2 = (d2.status || '').toUpperCase();
          if (st2 === 'SUCCESS') return { status: 'SUCCESS', recv: _rangoExtractRecv(d2) };
          if (st2 === 'FAILED')  return { status: 'FAILED',  recv: null };
        }
      } catch(_) {}
    }
    return null;
  }

  let changed = false;
  await Promise.all(pending.map(async function(tx) {
    try {
      const prov = (tx.provider || '').toLowerCase();
      let result = null;

      if (prov === 'rubic') {
        // Known rubic — check rubic only
        result = await _checkRubic(tx);
      } else if (prov === 'rango') {
        // Known rango — check rango only
        result = await _checkRango(tx);
      } else if (prov === 'lifi') {
        // Known lifi — check lifi only
        result = await _checkLifi(tx);
      } else {
        // Unknown provider (old entries without provider field) —
        // check all three in parallel, take first SUCCESS/FAILED result
        const [r1, r2, r3] = await Promise.all([
          _checkLifi(tx),
          _checkRubic(tx),
          _checkRango(tx)
        ]);
        result = (r1 && (r1.status === 'SUCCESS' || r1.status === 'FAILED')) ? r1
               : (r2 && (r2.status === 'SUCCESS' || r2.status === 'FAILED')) ? r2
               : (r3 && (r3.status === 'SUCCESS' || r3.status === 'FAILED')) ? r3
               : null;
      }

      if (!result) return;

      const idx = allTxs.findIndex(t => t.id === tx.id);
      if (idx === -1) return;

      if (result.status === 'SUCCESS') {
        allTxs[idx].pendingRecv = false;
        allTxs[idx].failed      = false;
        allTxs[idx].rubicFailSeen = 0;
        if (result.recv) allTxs[idx].recvHash = result.recv;
        changed = true;
      } else if (result.status === 'FAILED') {
        if (allTxs[idx].failed === true) return; // already marked failed — nothing to change
        if (result.soft) {
          allTxs[idx].rubicFailSeen = (allTxs[idx].rubicFailSeen || 0) + 1;
          if (allTxs[idx].rubicFailSeen < 2) { changed = true; return; } // persist counter, wait for 2nd check
        }
        allTxs[idx].pendingRecv = false;
        allTxs[idx].failed      = true;
        changed = true;
      }
    } catch(_e) { /* silent */ }
  }));

  if (changed) {
    saveTxHistory(allTxs);
    renderTxHistory();
    // ── Update bridge pending dot ──
    if (typeof brRefreshRecentTx === 'function') brRefreshRecentTx();
    if (typeof updateTxMenuBadge === 'function') updateTxMenuBadge();
  }
}

function closeTxHistory() {
  document.getElementById('txh-overlay')?.classList.remove('open');
  haptic();
}