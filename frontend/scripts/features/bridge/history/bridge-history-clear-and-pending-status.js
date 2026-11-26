
  // ── Clear bridge entries from Recent Bridge/Swap modal ONLY ──
  // one_tx_history is NOT modified — Profile Transaction History stays intact.
  // Strategy: store a "cleared before" timestamp in 'brh_cleared_ts'.
  // Any bridge tx with ts <= that timestamp is hidden in this modal.
  window.brClearHistory = function () {
    var allTxs = (typeof loadTxHistory === 'function') ? loadTxHistory() : [];
    var now = Date.now();
    var bridgeTxs = allTxs.filter(function(t){ return t.type === 'bridge' || t.type === 'swap'; });
    if (!bridgeTxs.length) return;

    var listEl   = document.getElementById('br-hist-list');
    var clearBtn = document.getElementById('brh-clear-btn');
    var pill     = document.getElementById('brh-count-pill');

    if (listEl) { listEl.style.transition = 'opacity 0.2s ease'; listEl.style.opacity = '0'; }

    setTimeout(function () {
      // Save cleared-before timestamp — all bridge txs added before now are hidden in modal
      try { localStorage.setItem('brh_cleared_ts', String(now)); } catch(e) {}

      if (typeof brRenderHistDropdown === 'function') brRenderHistDropdown();
      if (listEl) { listEl.style.opacity = '1'; }

      // Count pill: both bridge AND swap filtered by cleared_ts
      var clearedTs = now;
      var poolAfter = allTxs.filter(function(t){
        if (t.type !== 'bridge' && t.type !== 'swap') return false;
        var txTs = t.timestamp || t.ts || 0;
        return Number(txTs) > clearedTs;
      });
      if (pill) pill.textContent = poolAfter.length;
      if (clearBtn) clearBtn.style.display = 'none';

      haptic && haptic();
    }, 200);
  };

  function brHistOutsideClick(e) { /* no-op */ }

  // brHistOpenPendingCard disabled — card click করলে success card খুলবে না
  window.brHistOpenPendingCard = function(e, key) { /* no-op: card click disabled */ };

  // ── Check pending bridge txs — provider-aware (LiFi / Rubic / Rango) ──
  async function brCheckPendingStatuses() {
    if (typeof loadTxHistory !== 'function' || typeof saveTxHistory !== 'function') return;
    var allTxs  = loadTxHistory();
    // Also re-check Rubic entries marked failed in the last 24h — a false FAIL can still flip to SUCCESS
    var pending = allTxs.filter(function(t){
      if (t.type !== 'bridge' || !t.hash) return false;
      if (t.pendingRecv === true) return true;
      return t.failed === true && (t.provider || '').toLowerCase() === 'rubic' && (Date.now() - (t.timestamp || 0)) < 24 * 3600 * 1000;
    });
    if (!pending.length) return;

    var RANGO_KEY = window._ONE_RANGO_KEY;

    async function _chkLifi(tx) {
      try {
        var url = 'https://li.quest/v1/status?txHash=' + tx.hash;
        if (tx.fromChainId) url += '&fromChain=' + tx.fromChainId;
        if (tx.toChainId)   url += '&toChain='   + tx.toChainId;
        var res = await fetch(url, { headers: { 'x-lifi-api-key': 'b3e55edd-de70-4578-b761-cd2aac0fbae0.685a5adf-2580-486e-a8ff-1df4992b3f2e' }, signal: AbortSignal.timeout(8000) });
        if (!res.ok) return null;
        var data = await res.json();
        var st  = (data.status    || '').toUpperCase();
        var sub = (data.substatus || '').toUpperCase();
        var recv = (data.receiving && data.receiving.txHash) || data.toTxHash || data.destinationTxHash || null;
        if (st === 'DONE' || sub === 'COMPLETED' || sub === 'PARTIAL') return { status: 'SUCCESS', recv: recv };
        if (st === 'FAILED') return { status: 'FAILED', recv: null };
      } catch(_) {}
      return null;
    }

    async function _chkRubic(tx) {
      try {
        var rs = await _brRubicStatus(tx.hash, tx.rubicTradeId || null, 8000);
        if (!rs) return null;
        if (rs.raw === 'SUCCESS') return { status: 'SUCCESS', recv: rs.recv };
        // soft = needs a second consecutive failed check before it is persisted as FAILED
        if (_BR_RUBIC_FAIL.indexOf(rs.raw) !== -1) return { status: 'FAILED', recv: null, soft: true };
      } catch(_) {}
      return null;
    }

    // ── Rango recv hash extractor — official field: bridgeData.destTxHash ──
    function _chkRangoExtractRecv(data) {
      // 1) Official API field: bridgeData.destTxHash
      var recv = (data.bridgeData && data.bridgeData.destTxHash) || null;
      // 2) Fallback: explorerUrl — look for "Outbound" description
      if (!recv && Array.isArray(data.explorerUrl) && data.explorerUrl.length > 0) {
        var de = data.explorerUrl.find(function(e){
                    return e.description && (
                      e.description.toLowerCase().includes('outbound') ||
                      e.description.toLowerCase().includes('dest')
                    );
                  })
              || data.explorerUrl[data.explorerUrl.length - 1];
        if (de && de.url) {
          var parts = de.url.split('/'), cand = parts[parts.length - 1];
          if (cand && cand.startsWith('0x') && cand.length >= 42) recv = cand;
        }
      }
      // 3) Fallback: bridgeExtra.destTx (older field)
      if (!recv) recv = (data.bridgeExtra && data.bridgeExtra.destTx) || null;
      // 4) Fallback: last step explorerUrl
      if (!recv && Array.isArray(data.steps) && data.steps.length > 0) {
        var ls = data.steps[data.steps.length - 1];
        recv = (ls && (ls.outputTx || ls.destTxHash || ls.destinationTxHash)) || null;
        if (!recv && Array.isArray(ls && ls.explorerUrl) && ls.explorerUrl.length > 0) {
          var eu = ls.explorerUrl[0];
          if (eu && eu.url) {
            var ep = eu.url.split('/'); var ec = ep[ep.length - 1];
            if (ec && ec.startsWith('0x') && ec.length >= 42) recv = ec;
          }
        }
      }
      return recv || null;
    }

    async function _chkRango(tx) {
      if (!tx.hash) return null;
      var _rKey = window._ONE_RANGO_KEY;

      // ── Method 1: Rango Official /basic/status API (requestId + txId) ──
      try {
        var _url1 = 'https://api.rango.exchange/basic/status'
          + '?apiKey='  + encodeURIComponent(_rKey)
          + '&txId='    + encodeURIComponent(tx.hash);
        if (tx.rangoRequestId) _url1 += '&requestId=' + encodeURIComponent(tx.rangoRequestId);
        var res1 = await fetch(_url1, {
          method: 'GET', headers: { 'accept': 'application/json' },
          signal: AbortSignal.timeout(8000)
        });
        if (res1.ok) {
          var d1 = await res1.json();
          var st1 = (d1.status || '').toUpperCase();
          if (st1 === 'SUCCESS') return { status: 'SUCCESS', recv: _chkRangoExtractRecv(d1) };
          if (st1 === 'FAILED')  return { status: 'FAILED',  recv: null };
          // RUNNING — got a valid response but not final
          if (st1 === 'RUNNING') return null; // still in progress
        }
      } catch(_) {}

      // ── Method 2: Retry with requestId only (txId may not be indexed yet) ──
      // Note: explorer.rango.exchange has NO public REST API — only the official
      // api.rango.exchange/basic/status endpoint exists for programmatic status checks.
      if (tx.rangoRequestId) {
        try {
          var _url2 = 'https://api.rango.exchange/basic/status'
            + '?apiKey='    + encodeURIComponent(_rKey)
            + '&requestId=' + encodeURIComponent(tx.rangoRequestId)
            + '&txId='      + encodeURIComponent(tx.hash);
          var res2 = await fetch(_url2, {
            method: 'GET', headers: { 'accept': 'application/json' },
            signal: AbortSignal.timeout(8000)
          });
          if (res2.ok) {
            var d2 = await res2.json();
            var st2 = (d2.status || '').toUpperCase();
            if (st2 === 'SUCCESS') return { status: 'SUCCESS', recv: _chkRangoExtractRecv(d2) };
            if (st2 === 'FAILED')  return { status: 'FAILED',  recv: null };
          }
        } catch(_) {}
      }
      return null;
    }

    var changed = false;
    await Promise.all(pending.map(async function(tx) {
      try {
        var prov = (tx.provider || '').toLowerCase();
        var result = null;

        if (prov === 'rubic') {
          result = await _chkRubic(tx);
        } else if (prov === 'rango') {
          result = await _chkRango(tx);
        } else if (prov === 'lifi') {
          result = await _chkLifi(tx);
        } else {
          // Unknown provider (old entries) — try all three in parallel
          var results = await Promise.all([_chkLifi(tx), _chkRubic(tx), _chkRango(tx)]);
          for (var i = 0; i < results.length; i++) {
            if (results[i] && (results[i].status === 'SUCCESS' || results[i].status === 'FAILED')) {
              result = results[i]; break;
            }
          }
        }

        if (!result) return;

        var idx = allTxs.findIndex(function(t){ return t.id === tx.id; });
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
      } catch(_e) { /* silent – network/timeout */ }
    }));

    if (changed) {
      saveTxHistory(allTxs);
      brRenderHistDropdown();
      // ── Update pending dot on history button ──
      if (typeof brRefreshRecentTx === 'function') brRefreshRecentTx();
    }
  }

