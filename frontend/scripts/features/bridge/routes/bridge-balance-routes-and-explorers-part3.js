
  function _nxdm_brShowError(msg) {
    const el = $e('br-quote-error');
    if (el) el.textContent = '⚠️ ' + msg;
    el.style.display = 'block';
  }

  // ── Execute ──
  // ── Explorer URLs ──
  const BR_EXPLORERS = {
    1:           'https://etherscan.io/tx/',
    8453:        'https://basescan.org/tx/',
    42161:       'https://arbiscan.io/tx/',
    10:          'https://optimistic.etherscan.io/tx/',
    137:         'https://polygonscan.com/tx/',
    56:          'https://bscscan.com/tx/',
    43114:       'https://snowtrace.io/tx/',
    59144:       'https://lineascan.build/tx/',
    534352:      'https://scrollscan.com/tx/',
    324:         'https://explorer.zksync.io/tx/',
    100:         'https://gnosisscan.io/tx/',
    250:         'https://ftmscan.com/tx/',
    1088:        'https://andromeda-explorer.metis.io/tx/',
    1101:        'https://zkevm.polygonscan.com/tx/',
    5000:        'https://explorer.mantle.xyz/tx/',
    7777777:     'https://explorer.zora.energy/tx/',
    34443:       'https://explorer.mode.network/tx/',
    167000:      'https://taikoscan.io/tx/',
    81457:       'https://blastscan.io/tx/',
    1329:        'https://seitrace.com/tx/',
    33139:       'https://apescan.io/tx/',
    57073:       'https://explorer.inkonchain.com/tx/',
    130:         'https://uniscan.xyz/tx/',
    480:         'https://worldscan.org/tx/',
    2741:        'https://abscan.org/tx/',
    80094:       'https://berascan.com/tx/',
    1993:        'https://sonicscan.org/tx/',
    42220:       'https://celoscan.io/tx/',
    1284:        'https://moonscan.io/tx/',
    1285:        'https://moonriver.moonscan.io/tx/',
    25:          'https://cronoscan.com/tx/',
    2222:        'https://explorer.kava.io/tx/',
    1313161554:  'https://explorer.aurora.dev/tx/',
    122:         'https://explorer.fuse.io/tx/',
    30:          'https://explorer.rsk.co/tx/',
    690:         'https://explorer.redstone.xyz/tx/',
    255:         'https://kromascan.com/tx/',
    8217:        'https://klaytnscope.com/tx/',
    13371:       'https://explorer.immutable.com/tx/',
    185:         'https://explorer.mintchain.io/tx/',
    1625:        'https://explorer.gravity.xyz/tx/',
    88888:       'https://chiliscan.com/tx/',
    60808:       'https://explorer.gobob.xyz/tx/',
    14:          'https://flare-explorer.flare.network/tx/',
    1116:        'https://scan.coredao.org/tx/',
    1135:        'https://blockscout.lisk.com/tx/',
    288:         'https://bobascan.com/tx/',
    196:         'https://www.oklink.com/xlayer/tx/',
    360:         'https://shapescan.xyz/tx/',
    4337:        'https://subnets.avax.network/beam/mainnet/tx/',
    50104:       'https://explorer.sophon.xyz/tx/',
    146:         'https://sonicscan.org/tx/',
    1514:        'https://storyscan.io/tx/',
    // Additional Jumper chains
    252:         'https://fraxscan.com/tx/',
    169:         'https://pacific-explorer.manta.network/tx/',
    999:         'https://explorer.hyperliquid.xyz/tx/',
    2020:        'https://app.roninchain.com/tx/',
    1868:        'https://soneium-minato.blockscout.com/tx/',
    666666666:   'https://explorer.degen.tips/tx/',
    111188:      'https://explorer.re.al/tx/',
    1729:        'https://explorer.reya.network/tx/',
    1996:        'https://explorer.sanko.xyz/tx/',
    70700:       'https://apex-explorer.proofofplay.com/tx/',
    660279:      'https://explorer.xai-chain.net/tx/',
    7560:        'https://cyberscan.co/tx/',
    204:         'https://opbnbscan.com/tx/',
    5101:        'https://explorer.lumia.org/tx/',
    2192:        'https://explorer.snaxchain.io/tx/',
  };
  // Expose BR_EXPLORERS globally so swap + other sections can resolve explorer URLs
  window.BR_EXPLORERS = BR_EXPLORERS;

  // ── shared: save history + fire BSO success callbacks ──
  function _brPollSuccess(sentHash, recvHash, toAmtRaw) {
    _brUpdateHomeBalanceAfterSuccess && _brUpdateHomeBalanceAfterSuccess();
    const _recvExp = (BR_EXPLORERS[br.toChain.id] || (window.getTHExplorerTx ? window.getTHExplorerTx(br.toChain.id) : 'https://etherscan.io/tx/'));
    if (recvHash && typeof _bsoSetRecvHash === 'function') _bsoSetRecvHash(recvHash, _recvExp);

    if (typeof saveTxHistory === 'function' && typeof loadTxHistory === 'function') {
      const _allTxs = loadTxHistory();
      let _pendIdx = -1;
      if (window._bsoPendingHistId)
        _pendIdx = _allTxs.findIndex(t => t.id === window._bsoPendingHistId);
      if (_pendIdx === -1)
        _pendIdx = _allTxs.findIndex(t => t.hash === sentHash && t.pendingRecv === true);
      if (_pendIdx !== -1) {
        _allTxs[_pendIdx].pendingRecv = false;
        _allTxs[_pendIdx].recvHash    = recvHash || null;
        if (!_allTxs[_pendIdx].hash) _allTxs[_pendIdx].hash = sentHash;
        saveTxHistory(_allTxs);
        if (typeof updateTxMenuBadge === 'function') updateTxMenuBadge();
      } else {
        const _cleaned = _allTxs.filter(t => !(t.type === 'bridge' && t.pendingRecv === true && !t.hash));
        saveTxHistory(_cleaned);
        if (typeof saveTxToHistory === 'function') {
          saveTxToHistory({
            hash: sentHash, recvHash: recvHash || null,
            pair: br.fromToken.symbol + ' → ' + br.toToken.symbol,
            fromAmt: $e('br-from-amount') ? $e('br-from-amount').value : '—',
            fromToken: br.fromToken.symbol,
            toToken:   br.toToken ? br.toToken.symbol : '—',
            fromChain: br.fromChain.name, toChain: br.toChain.name,
            fromChainId: br.fromChain.id, toChainId: br.toChain.id,
            type: 'bridge', isDry: false, walletIndex: 1,
          });
        }
      }
      window._bsoPendingHistId = null;
    }
    brRefreshRecentTx && brRefreshRecentTx();
    showToast && showToast('Bridge confirmed!', 'check_circle');
    haptic && haptic();
    if (typeof _bsoSetStatus === 'function') _bsoSetStatus('✅ Bridge confirmed!');
    if (typeof _bsoSetToAmt === 'function' && toAmtRaw) {
      try {
        var _rcvDec = (br.toToken && br.toToken.decimals) || 18;
        var _rcvSym = (br.toToken && br.toToken.symbol) || '';
        var _rcvNum = parseFloat(ethers.formatUnits(toAmtRaw.toString(), _rcvDec));
        var _rcvFmt = _rcvNum < 0.000001 ? _rcvNum.toExponential(3) : _rcvNum < 1 ? _rcvNum.toFixed(6) : _rcvNum.toFixed(4);
        _bsoSetToAmt(_rcvFmt + ' ' + _rcvSym);
      } catch(_) {}
    }
    if (typeof _bsoDone === 'function') _bsoDone(true);
  }

  // ── Poll for receiver/destination tx — multi-provider ──
  async function brPollReceiverTx(sentHash, fromChainId, toChainId, providerHint, rangoRequestId, rubicTradeId) {
    br._recvHash = null;
    const _activeRoute = br.routes && br.selectedRoute !== null ? br.routes[br.selectedRoute] : null;
    const _prov = providerHint || (_activeRoute && _activeRoute._provider) || 'lifi';
    const maxAttempts = 120;
    const _recvExp = (BR_EXPLORERS[toChainId] || (window.getTHExplorerTx ? window.getTHExplorerTx(toChainId) : 'https://etherscan.io/tx/'));
    const isSame = fromChainId === toChainId;

    // ════════════════════════════════
    // RUBIC polling
    // ════════════════════════════════
    if (_prov === 'rubic') {
      // Rubic cross-chain: poll GET /api/routes/status?srcTxHash=<hash>
      // Same-chain swap: tx confirmed on-chain already (no dest chain), treat as done
      if (isSame) {
        _brPollSuccess(sentHash, null, null);
        return;
      }
      // NOT_FOUND / PENDING / LONG_PENDING → keep polling, never give up.
      // FAIL / REVERT / REVERTED are only trusted after 3 consecutive terminal-fail answers (~15s):
      // the source tx is already confirmed on-chain here, so one transient/indexing "FAIL" from Rubic
      // must not flip the UI to "Bridge Failed".
      let _rubicFailStreak = 0;
      while (true) {
        await new Promise(r => setTimeout(r, 5000));
        try {
          const _rs = await _brRubicStatus(sentHash, rubicTradeId || (_activeRoute && _activeRoute._rubicTradeId) || null, 10000);
          if (!_rs) continue;
          const data    = _rs.data || {};
          const status  = _rs.raw;
          const recvTx  = _rs.recv;

          if (recvTx && recvTx !== sentHash) {
            br._recvHash = recvTx;
            if (typeof _bsoSetRecvHash === 'function') _bsoSetRecvHash(recvTx, _recvExp);
            const _rtEl = document.getElementById('bso-recv-hash-txt');
            if (_rtEl) _rtEl.textContent = recvTx.slice(0,10) + '…' + recvTx.slice(-6);
          }

          const _rubicAmt = data.destinationTokenAmount || data.toAmount || data.destAmount || null;

          // SUCCESS → done
          if (status === 'SUCCESS') {
            if (_rubicAmt && typeof _bsoSetToAmt === 'function') {
              const _rubicSym = (br.toToken && br.toToken.symbol) || '';
              _bsoSetToAmt(parseFloat(_rubicAmt).toFixed(6).replace(/\.?0+$/, '') + ' ' + _rubicSym);
            }
            _brPollSuccess(sentHash, br._recvHash, null);
            return;
          }
          // FAIL → only after it is confirmed by consecutive polls
          if (_BR_RUBIC_FAIL.indexOf(status) !== -1) {
            _rubicFailStreak++;
            if (_rubicFailStreak >= 3) {
              if (typeof _bsoSetStatus === 'function') _bsoSetStatus('❌ Bridge failed on destination (Rubic: ' + status + ') — source tx confirmed, check Rubic status');
              if (typeof _bsoDone === 'function') _bsoDone(false);
              return;
            }
            if (typeof _bsoSetStatus === 'function') _bsoSetStatus('⏳ Verifying destination status…');
            continue;
          }
          _rubicFailStreak = 0;
          if (typeof _bsoSetStatus === 'function') {
            const readable = (status === 'PENDING' || status === 'LONG_PENDING' || status === 'NOT_FOUND')
              ? '⏳ Waiting for destination…'
              : status === 'READY_TO_CLAIM'
                ? '⏳ Ready to claim on destination'
                : '⏳ ' + status;
            _bsoSetStatus(readable);
          }
        } catch { /* network error — keep polling */ }
      }
    }

    // ════════════════════════════════
    // RANGO polling — dual-check: API + Explorer
    // ════════════════════════════════
    if (_prov === 'rango') {
      if (isSame) {
        _brPollSuccess(sentHash, null, null);
        return;
      }
      const RANGO_KEY = window._ONE_RANGO_KEY;
      const _rReqId   = rangoRequestId || (_activeRoute && _activeRoute._rangoExecuteRequestId) || null;

      // ── Helper: extract recv hash from any Rango response ──
      // Official Rango /basic/status response: bridgeData.destTxHash is the primary field
      const _rExtractRecv = (data) => {
        // 1) Official API field: bridgeData.destTxHash
        let recv = (data.bridgeData && data.bridgeData.destTxHash) || null;
        // 2) Fallback: explorerUrl array — look for "Outbound" or last entry
        if (!recv && Array.isArray(data.explorerUrl) && data.explorerUrl.length > 0) {
          const de = data.explorerUrl.find(e => e.description && (
                        e.description.toLowerCase().includes('outbound') ||
                        e.description.toLowerCase().includes('dest')
                      ))
                  || data.explorerUrl[data.explorerUrl.length - 1];
          if (de && de.url) {
            const p = de.url.split('/'), c = p[p.length - 1];
            if (c && c.startsWith('0x') && c.length >= 42) recv = c;
          }
        }
        // 3) Fallback: bridgeExtra.destTx (older field)
        if (!recv) recv = (data.bridgeExtra && data.bridgeExtra.destTx) || null;
        // 4) Fallback: output.receivedToken txHash (rare)
        if (!recv && Array.isArray(data.steps) && data.steps.length > 0) {
          const ls = data.steps[data.steps.length - 1];
          recv = (ls && (ls.outputTx || ls.destTxHash || ls.destinationTxHash)) || null;
          if (!recv && Array.isArray(ls && ls.explorerUrl) && ls.explorerUrl.length > 0) {
            const eu = ls.explorerUrl[0];
            if (eu && eu.url) { const ep = eu.url.split('/'); const ec = ep[ep.length-1]; if (ec && ec.startsWith('0x') && ec.length >= 42) recv = ec; }
          }
        }
        return recv || null;
      };

      // ── Helper: set recv hash in BSO UI ──
      const _rSetRecv = (recvTx) => {
        if (!recvTx || recvTx === sentHash) return;
        br._recvHash = recvTx;
        if (typeof _bsoSetRecvHash === 'function') _bsoSetRecvHash(recvTx, _recvExp);
        const _rtEl = document.getElementById('bso-recv-hash-txt');
        if (_rtEl) _rtEl.textContent = recvTx.slice(0,10) + '…' + recvTx.slice(-6);
      };

      for (let i = 0; i < maxAttempts; i++) {
        await new Promise(r => setTimeout(r, 5000));

        // ── Method 1: Rango Official API (/basic/status) ──
        // Required: requestId + txId per official docs
        let _rangoApiDone = false;
        try {
          // requestId is required; txId is the on-chain tx hash
          let _rangoStatusUrl = 'https://api.rango.exchange/basic/status'
            + '?apiKey=' + encodeURIComponent(RANGO_KEY)
            + '&txId='   + encodeURIComponent(sentHash);
          if (_rReqId) _rangoStatusUrl += '&requestId=' + encodeURIComponent(_rReqId);
          const res  = await fetch(_rangoStatusUrl, { method: 'GET', headers: { 'accept': 'application/json' }, signal: AbortSignal.timeout(8000) });
          if (res.ok) {
            const data   = await res.json();
            const status = (data.status || '').toUpperCase();
            _rSetRecv(_rExtractRecv(data));
            // Official field: data.output.amount (NOT outputAmount)
            const toAmtRaw = (data.output && data.output.amount) || null;
            if (status === 'SUCCESS') { _brPollSuccess(sentHash, br._recvHash, toAmtRaw); return; }
            if (status === 'FAILED')  { if (typeof _bsoSetStatus === 'function') _bsoSetStatus('❌ Bridge failed on destination'); if (typeof _bsoDone === 'function') _bsoDone(false); return; }
            if (typeof _bsoSetStatus === 'function') _bsoSetStatus(status === 'RUNNING' ? '⏳ Waiting for destination…' : '⏳ ' + status);
            _rangoApiDone = true; // got a valid non-final response
          }
        } catch { /* keep polling */ }

        // ── Method 2: Rango API retry with requestId only (when txId not indexed yet) ──
        // explorer.rango.exchange has no public REST API — only /basic/status is official
        if (!_rangoApiDone && _rReqId) {
          try {
            // Retry API call using requestId as primary identifier (txId may not be indexed yet)
            const _expUrl = 'https://api.rango.exchange/basic/status'
              + '?apiKey='    + encodeURIComponent(RANGO_KEY)
              + '&requestId=' + encodeURIComponent(_rReqId)
              + '&txId='      + encodeURIComponent(sentHash);
            const resE = await fetch(_expUrl, { method: 'GET', headers: { 'accept': 'application/json' }, signal: AbortSignal.timeout(8000) });
            if (resE.ok) {
              const dataE   = await resE.json();
              const statusE = (dataE.status || '').toUpperCase();
              _rSetRecv(_rExtractRecv(dataE));
              const toAmtE = (dataE.output && dataE.output.amount) || null;
              if (statusE === 'SUCCESS') { _brPollSuccess(sentHash, br._recvHash, toAmtE); return; }
              if (statusE === 'FAILED')  { if (typeof _bsoSetStatus === 'function') _bsoSetStatus('❌ Bridge failed on destination'); if (typeof _bsoDone === 'function') _bsoDone(false); return; }
              if (statusE && statusE !== 'RUNNING' && statusE !== 'PENDING' && typeof _bsoSetStatus === 'function') _bsoSetStatus('⏳ ' + statusE);
            }
          } catch { /* keep polling */ }
        }
      }
      if (typeof _bsoSetStatus === 'function') _bsoSetStatus('⏳ Timeout — check explorer');
      if (typeof _bsoDone === 'function') _bsoDone(false);
      return;
    }

    // ════════════════════════════════
    // LIFI polling (default)
    // ════════════════════════════════
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 5000));
      try {
        const url  = `${LIFI_API}/status?txHash=${sentHash}&fromChain=${fromChainId}&toChain=${toChainId}`;
        const res  = await fetch(url, { headers: { 'x-lifi-api-key': 'b3e55edd-de70-4578-b761-cd2aac0fbae0.685a5adf-2580-486e-a8ff-1df4992b3f2e' } });
        if (!res.ok) continue;
        const data      = await res.json();
        const status    = (data.status    || '').toUpperCase();
        const subStatus = (data.substatus || '').toUpperCase();
        const recvTx    = data.receiving?.txHash || data.toTxHash || data.destinationTxHash || null;

        if (recvTx && recvTx !== sentHash) {
          br._recvHash = recvTx;
          if (typeof _bsoSetRecvHash === 'function') _bsoSetRecvHash(recvTx, _recvExp);
          const _rtEl = document.getElementById('bso-recv-hash-txt');
          if (_rtEl) _rtEl.textContent = recvTx.slice(0,10) + '…' + recvTx.slice(-6);
        }

        if (status === 'DONE' || subStatus === 'COMPLETED' || subStatus === 'PARTIAL') {
          const _rcvAmt = (data.receiving && (data.receiving.amount || data.receiving.toAmount)) || data.toAmount || null;
          _brPollSuccess(sentHash, br._recvHash, _rcvAmt);
          return;
        }
        if (status === 'FAILED') {
          if (typeof _bsoSetStatus === 'function') _bsoSetStatus('❌ Bridge failed on destination');
          if (typeof _bsoDone === 'function') _bsoDone(false);
          return;
        }
      } catch { /* keep polling */ }
    }
    if (typeof _bsoSetStatus === 'function') _bsoSetStatus('⏳ Timeout — check explorer');
    if (typeof _bsoDone === 'function') _bsoDone(false);
  }