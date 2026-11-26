  // ══════════════════════════════════════════════════════════
  // brPendingBadgeCheck — PENDING badge click → live API check
  // ══════════════════════════════════════════════════════════
  window.brPendingBadgeCheck = async function(txKey, badgeEl) {
    if (!txKey || !window._brPendCheckMap) return;
    var tx = window._brPendCheckMap[txKey];
    if (!tx) return;
    if (badgeEl._brChecking) return;
    badgeEl._brChecking = true;

    badgeEl.innerHTML = '<span class="material-icons-round" style="font-size:9px;animation:spin 0.6s linear infinite;">refresh</span> CHECKING…';
    badgeEl.style.pointerEvents = 'none';
    badgeEl.style.opacity = '0.7';

    var RANGO_KEY = window._ONE_RANGO_KEY;
    var prov = (tx.provider || '').toLowerCase();
    var result = null;

    try {
      // ── RANGO ──
      if (prov === 'rango') {
        if (tx.hash) {
          try {
            var url1 = 'https://api.rango.exchange/basic/status?apiKey=' + encodeURIComponent(RANGO_KEY) + '&txId=' + encodeURIComponent(tx.hash);
            if (tx.rangoRequestId) url1 += '&requestId=' + encodeURIComponent(tx.rangoRequestId);
            var r1 = await fetch(url1, { headers: { 'accept': 'application/json' }, signal: AbortSignal.timeout(10000) });
            if (r1.ok) {
              var d1 = await r1.json();
              var st1 = (d1.status || '').toUpperCase();
              var recv1 = (d1.bridgeData && d1.bridgeData.destTxHash) || null;
              if (!recv1 && Array.isArray(d1.explorerUrl)) {
                var de = d1.explorerUrl.find(function(e){ return e.description && (e.description.toLowerCase().includes('outbound')||e.description.toLowerCase().includes('dest')); }) || d1.explorerUrl[d1.explorerUrl.length-1];
                if (de && de.url) { var pts=de.url.split('/'),c=pts[pts.length-1]; if(c&&c.startsWith('0x')&&c.length>=42) recv1=c; }
              }
              if (!recv1) recv1 = (d1.bridgeExtra && d1.bridgeExtra.destTx) || null;
              var toAmt1 = (d1.output && d1.output.amount) || null;
              if (st1 === 'SUCCESS') result = { status:'SUCCESS', recv:recv1, toAmt:toAmt1 };
              else if (st1 === 'FAILED') result = { status:'FAILED', recv:null };
              else result = { status:'RUNNING', raw:d1 };
            }
          } catch(_) {}
        }
        if ((!result || result.status === 'RUNNING') && tx.rangoRequestId) {
          try {
            var url2 = 'https://api.rango.exchange/basic/status?apiKey=' + encodeURIComponent(RANGO_KEY) + '&requestId=' + encodeURIComponent(tx.rangoRequestId) + (tx.hash ? '&txId=' + encodeURIComponent(tx.hash) : '');
            var r2 = await fetch(url2, { headers: { 'accept': 'application/json' }, signal: AbortSignal.timeout(10000) });
            if (r2.ok) {
              var d2 = await r2.json();
              var st2 = (d2.status || '').toUpperCase();
              var recv2 = (d2.bridgeData && d2.bridgeData.destTxHash) || null;
              var toAmt2 = (d2.output && d2.output.amount) || null;
              if (st2 === 'SUCCESS') result = { status:'SUCCESS', recv:recv2, toAmt:toAmt2 };
              else if (st2 === 'FAILED') result = { status:'FAILED', recv:null };
              else if (!result) result = { status:'RUNNING', raw:d2 };
            }
          } catch(_) {}
        }
      }
      // ── LIFI ──
      else if (prov === 'lifi' || prov === '') {
        try {
          var lUrl = 'https://li.quest/v1/status?txHash=' + encodeURIComponent(tx.hash || '');
          if (tx.fromChainId) lUrl += '&fromChain=' + tx.fromChainId;
          if (tx.toChainId) lUrl += '&toChain=' + tx.toChainId;
          var lr = await fetch(lUrl, { headers: { 'x-lifi-api-key': 'b3e55edd-de70-4578-b761-cd2aac0fbae0.685a5adf-2580-486e-a8ff-1df4992b3f2e' }, signal: AbortSignal.timeout(10000) });
          if (lr.ok) {
            var ld = await lr.json();
            var lst = (ld.status || '').toUpperCase();
            var lsub = (ld.substatus || '').toUpperCase();
            var lrecv = (ld.receiving && ld.receiving.txHash) || ld.toTxHash || ld.destinationTxHash || null;
            var lAmt = (ld.receiving && (ld.receiving.amount || ld.receiving.toAmount)) || ld.toAmount || null;
            if (lst === 'DONE' || lsub === 'COMPLETED' || lsub === 'PARTIAL') result = { status:'SUCCESS', recv:lrecv, toAmt:lAmt };
            else if (lst === 'FAILED') result = { status:'FAILED', recv:null };
            else result = { status:'RUNNING', raw:ld };
          }
        } catch(_) {}
      }
      // ── RUBIC ──
      else if (prov === 'rubic') {
        try {
          var rbs = await _brRubicStatus(tx.hash || '', tx.rubicTradeId || null, 10000);
          if (rbs) {
            if (rbs.raw === 'SUCCESS') result = { status:'SUCCESS', recv:rbs.recv||null };
            else if (_BR_RUBIC_FAIL.indexOf(rbs.raw) !== -1) result = { status:'FAILED', recv:null };
            else result = { status:'RUNNING', raw:rbs.data };
          }
        } catch(_) {}
      }
    } catch(_e) {}

    // ── Update badge ──
    if (!result) {
      badgeEl._brChecking = false;
      badgeEl.style.pointerEvents = '';
      badgeEl.style.opacity = '';
      badgeEl.innerHTML = '<span class="material-icons-round" style="font-size:9px;animation:spin 1.4s linear infinite;">sync</span> PENDING';
      if (typeof swShowToast === 'function') swShowToast('⚠️ Network error — try again');
      return;
    }

    if (result.status === 'SUCCESS') {
      badgeEl._brChecking = false;
      if (result.recv) {
        // Show recv hash as clickable link
        var _toChainId = tx.toChainId;
        var _recvBase = (typeof BR_EXPLORERS !== 'undefined' && _toChainId && BR_EXPLORERS[_toChainId]) || (window.getTHExplorerTx ? window.getTHExplorerTx(_toChainId) : 'https://etherscan.io/tx/');
        badgeEl.className = 'brh-hash-link brh-hash-recv';
        badgeEl.style.background = '';
        badgeEl.style.color = '';
        badgeEl.style.border = '';
        badgeEl.style.cursor = 'pointer';
        badgeEl.style.pointerEvents = '';
        badgeEl.style.opacity = '';
        var _recvShort = result.recv.slice(0,6) + '…' + result.recv.slice(-4);
        badgeEl.innerHTML = '<span class="material-icons-round" style="font-size:9px;">south_east</span> ' + _recvShort;
        badgeEl.onclick = function(e){ e.stopPropagation(); window.open(_recvBase + result.recv, '_blank', 'noopener'); };
      } else {
        badgeEl.className = 'brh-hash-link';
        badgeEl.style.background = 'rgba(16,185,129,0.13)';
        badgeEl.style.color = 'var(--accent-green)';
        badgeEl.style.border = '1px solid rgba(16,185,129,0.3)';
        badgeEl.style.cursor = 'default';
        badgeEl.style.pointerEvents = 'none';
        badgeEl.style.opacity = '';
        badgeEl.innerHTML = '<span class="material-icons-round" style="font-size:9px;">check_circle</span> SUCCESS';
      }
      // Remove from pending check map — SUCCESS/FAILED tx never checked again
      if (window._brPendCheckMap && txKey) delete window._brPendCheckMap[txKey];
      // Persist
      if (typeof loadTxHistory === 'function' && typeof saveTxHistory === 'function') {
        var allH = loadTxHistory();
        var hIdx = allH.findIndex(function(t){ return t.id === tx.id || (t.hash && t.hash === tx.hash); });
        if (hIdx !== -1) {
          allH[hIdx].pendingRecv = false;
          allH[hIdx].failed = false;
          if (result.recv) allH[hIdx].recvHash = result.recv;
          saveTxHistory(allH);
          if (typeof brRefreshRecentTx === 'function') brRefreshRecentTx();
        }
      }
      if (typeof swShowToast === 'function') swShowToast('✅ Bridge confirmed!');
    }
    else if (result.status === 'FAILED') {
      badgeEl._brChecking = false;
      badgeEl.className = 'brh-hash-link';
      badgeEl.style.background = 'rgba(244,63,94,0.12)';
      badgeEl.style.color = 'var(--accent-red)';
      badgeEl.style.border = '1px solid rgba(244,63,94,0.2)';
      badgeEl.style.cursor = 'default';
      badgeEl.style.pointerEvents = 'none';
      badgeEl.style.opacity = '';
      badgeEl.innerHTML = '<span class="material-icons-round" style="font-size:9px;">error_outline</span> FAILED';
      // Remove from pending check map — will never be re-checked
      if (window._brPendCheckMap && txKey) delete window._brPendCheckMap[txKey];
      if (typeof loadTxHistory === 'function' && typeof saveTxHistory === 'function') {
        var allH2 = loadTxHistory();
        var hIdx2 = allH2.findIndex(function(t){ return t.id === tx.id || (t.hash && t.hash === tx.hash); });
        if (hIdx2 !== -1) {
          allH2[hIdx2].pendingRecv = false;
          allH2[hIdx2].failed = true;
          saveTxHistory(allH2);
          if (typeof brRefreshRecentTx === 'function') brRefreshRecentTx();
        }
      }
      if (typeof swShowToast === 'function') swShowToast('❌ Bridge failed on destination');
    }
    else {
      // Still RUNNING
      badgeEl._brChecking = false;
      badgeEl.style.pointerEvents = '';
      badgeEl.style.opacity = '';
      var _rawSt = (result.raw && result.raw.status) ? result.raw.status : 'running';
      badgeEl.innerHTML = '<span class="material-icons-round" style="font-size:9px;animation:spin 1.4s linear infinite;">sync</span> ' + _rawSt.toUpperCase();
      if (typeof swShowToast === 'function') swShowToast('⏳ Still in progress — try again later');
    }
  };

