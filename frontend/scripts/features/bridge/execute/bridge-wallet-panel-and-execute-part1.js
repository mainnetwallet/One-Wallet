

  window.brOpenRecvExplorer = function () {
    if (!br._recvHash) return;
    const url = (BR_EXPLORERS[br.toChain.id] || (window.getTHExplorerTx ? window.getTHExplorerTx(br.toChain.id) : 'https://etherscan.io/tx/')) + br._recvHash;
    window.open(url, '_blank', 'noopener');
  };

  // ── Confirm a broadcast source tx WITHOUT false failures ──
  // Returns receipt (status 1/0) or null if still unknown after ~5 min (tx was broadcast;
  // bridge status API decides the real outcome). Throws only if tx was cancelled/replaced-away.
  async function _brConfirmSentTx(sent, chainId) {
    const hash = sent.hash;
    try {
      const r = await Promise.race([
        sent.wait(1),
        new Promise((_, rej) => setTimeout(() => rej(new Error('__wait_timeout__')), 45000)),
      ]);
      if (r) return r;
    } catch (e) {
      // ethers v6 throws CALL_EXCEPTION (with receipt) for a real revert
      if (e && e.receipt && Number(e.receipt.status) === 0 && !e.cancelled) return e.receipt;
      if (e && e.code === 'TRANSACTION_REPLACED') {
        if (e.cancelled) throw new Error('Transaction was cancelled/replaced before confirming.');
        if (e.receipt) return e.receipt; // speed-up: replacement mined
      }
      // any other error (RPC timeout, network, missing response) → fall through to manual polling
    }
    const deadline = Date.now() + 5 * 60 * 1000;
    while (Date.now() < deadline) {
      try {
        const rc = await _withRpcFallback(chainId, _p => _p.getTransactionReceipt(hash), 8000);
        if (rc) return rc;
      } catch (_) { /* RPC hiccup — keep polling */ }
      await new Promise(r => setTimeout(r, 3000));
    }
    return null;
  }

  window.brExecute = async function () {
    if (br.selectedRoute === null || !br.routes[br.selectedRoute]) {
      _nxdm_brShowError('Please select a route'); return;
    }
    if (!br.senderKey) {
      _nxdm_brShowError('Select a wallet (no private key)'); return;
    }
    // ── Fresh sync: always re-read recipient from input field before execute ──
    // Handles programmatic paste / autofill that may not fire oninput
    const _execRecipInp = $e('br-recipient');
    if (_execRecipInp) {
      const _execRecipVal = _execRecipInp.value.trim();
      if (_execRecipVal !== br.recipientAddr) {
        br.recipientAddr = _execRecipVal;
      }
    }
    // Guard: recipient address must be valid if provided
    if (br.recipientAddr && !ethers.isAddress(br.recipientAddr)) {
      _nxdm_brShowError('Invalid recipient address. Please enter a valid 0x address.'); return;
    }

    const route    = br.routes[br.selectedRoute];
    const execBtn   = $e('br-exec-btn');
    const execIcon  = $e('br-exec-icon');
    const execSpin  = $e('br-exec-spin');
    const labelEl   = $e('br-exec-label');   // ← loading text button এর ভেতরে

    // reset UI — button spinner show, icon hide
    execIcon.style.display = 'none';
    execSpin.style.display = 'block';
    execBtn.disabled       = true;
    execBtn.style.opacity  = '0.85';
    execBtn.style.background = '';
    if (labelEl) labelEl.textContent = 'Preparing…';
    br._recvHash = null;
    br.txHash    = null;
    window.brRunning = true;
    if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txStart(); // BG: wake lock + audio
    window.brIsSameChain = (br.fromChain && br.toChain && br.fromChain.id === br.toChain.id) ? true : false;
    if (typeof window._updateAllToolBadges === 'function') window._updateAllToolBadges();
    if (typeof window._bgPillUpdate === 'function') window._bgPillUpdate();

    // Helper to restore button after done/error
    const _resetExecBtn = () => {
      execIcon.style.display   = 'block';
      execSpin.style.display   = 'none';
      execBtn.disabled         = false;
      execBtn.style.opacity    = '1';
      execBtn.style.background = '';
      if (labelEl) labelEl.textContent = isSameChain ? 'SWAP NOW' : 'BRIDGE NOW';
      window.brRunning = false;
      if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txEnd(); // BG: release wake lock
      if (typeof window._updateAllToolBadges === 'function') window._updateAllToolBadges();
      if (typeof window._bgPillUpdate === 'function') window._bgPillUpdate();
    };

    const RPC_MULTI = {
      1:      ['https://cloudflare-eth.com','https://ethereum-rpc.publicnode.com'],
      8453:   ['https://mainnet.base.org','https://base.drpc.org'],
      42161:  ['https://arb1.arbitrum.io/rpc','https://arbitrum-one-rpc.publicnode.com'],
      10:     ['https://mainnet.optimism.io','https://optimism-rpc.publicnode.com'],
      137:    ['https://polygon-bor-rpc.publicnode.com','https://polygon.drpc.org','https://polygon-rpc.com','https://1rpc.io/matic'],
      56:     ['https://bsc-dataseed.binance.org','https://bsc-dataseed1.defibit.io','https://bsc-rpc.publicnode.com'],
      43114:  ['https://api.avax.network/ext/bc/C/rpc','https://avalanche-c-chain-rpc.publicnode.com'],
      59144:  ['https://rpc.linea.build'],
      534352: ['https://rpc.scroll.io','https://scroll.drpc.org'],
      324:    ['https://mainnet.era.zksync.io','https://zksync.drpc.org'],
    };
    // legacy single-RPC map kept for any remaining references
    const RPC = Object.fromEntries(Object.entries(RPC_MULTI).map(([k,v]) => [k, v[0]]));

    async function _getBridgeProvider(chainId) {
      
      // Add bridge-specific RPCs to the global list via temporary override
      const rpcMultiEntry = RPC_MULTI[chainId];
      if (rpcMultiEntry) {
        const existing = _getRpcListForChain(chainId);
        rpcMultiEntry.filter(r => !existing.includes(r)).forEach(r => {
          // These are bridge-specific RPCs; merge them into _withRpcFallback by providing explicit list
        });
      }
      // Build merged list: RPC_MULTI (bridge-specific) + global chain RPCs
      const list = [];
      const rpcEntry = RPC_MULTI[chainId];
      if (rpcEntry) rpcEntry.forEach(r => { if (!list.includes(r)) list.push(r); });
      _getRpcListForChain(chainId).forEach(r => { if (!list.includes(r)) list.push(r); });
      const rpcs = [...new Set(list)].filter(r => r && r.startsWith('http'));

      if (rpcs.length === 0) {
        const customChain = getAllChains().find(c => c.chainId === chainId);
        const name = (customChain && customChain.name) || ('Chain ' + chainId);
        throw new Error('No RPC found for ' + name + '. Please re-add this chain from Chainlist.');
      }

      
      let lastErr;
      for (const rpc of rpcs) {
        try {
          const p = _makeProvider(rpc, chainId);
          await Promise.race([
            p.getBlockNumber(),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))
          ]);
          return p;
        } catch(e) {
          lastErr = e;
          const key = rpc + ':' + (chainId || 0);
          delete _providerCache[key];
        }
      }
      const customChain2 = getAllChains().find(c => c.chainId === chainId);
      const name2 = (customChain2 && customChain2.name) || ('Chain ' + chainId);
      throw lastErr || new Error('All RPCs failed for ' + name2 + '. Check your connection or configure a custom RPC.');
    }

    // Hoist so catch block can read them for balance display
    let _provider = null, _wallet = null, _txReq = null;
    let _txDone = false; // hoisted so finally block can always read it
    let _capturedEoaFromAmt = '—'; // hoisted so isSame block can always read it

    // ── Capture fromAmount immediately (before any async that might clear the input) ──
    const _execFromAmtStr = ($e('br-from-amount') ? $e('br-from-amount').value.trim() : '') || '0';
    const _execFromDec    = br.fromToken ? (br.fromToken.decimals || 18) : 18;

    try {
      _provider = await _getBridgeProvider(br.fromChain.id);
      const pk  = br.senderKey.startsWith('0x') ? br.senderKey : '0x' + br.senderKey;
      _wallet   = new ethers.Wallet(pk, _provider);
      // alias for readability inside try
      const provider = _provider, wallet = _wallet;
      // Guard: verify PK derives same address as selected wallet
      if (_wallet.address.toLowerCase() !== br.senderAddr.toLowerCase()) {
        throw new Error('Wallet key mismatch. Please re-select your sender wallet.');
      }

      // Get transactionRequest
      // LiFi /advanced/routes: same-chain swaps → transactionRequest is inside steps[0]
      //                        cross-chain bridges → need separate /advanced/stepTransaction call
      const _routeSteps = route.steps || [];

      // ══ RUBIC TX FETCH ══
      if (route._provider === 'rubic') {
        if (labelEl) labelEl.textContent = 'Fetching Rubic tx data…';
        const _raw = route._raw || {};
        if (!br.senderAddr) throw new Error('No sender wallet selected.');

        const RUBIC_CHAINS_REV = {
          1:'ETH',56:'BSC',137:'POLYGON',43114:'AVALANCHE',42161:'ARBITRUM',
          10:'OPTIMISM',8453:'BASE',250:'FANTOM',100:'GNOSIS',59144:'LINEA',
          534352:'SCROLL',324:'ZK_SYNC',5000:'MANTLE',81457:'BLAST',
        };
        const fromBC = RUBIC_CHAINS_REV[br.fromChain.id];
        const toBC   = RUBIC_CHAINS_REV[br.toChain.id];
        if (!fromBC || !toBC) throw new Error('Chain not supported by Rubic: ' + br.fromChain.name);

        // Route id — required by official Rubic API for both same-chain and cross-chain
        const _rubicRouteId = (_raw && _raw.id) ? _raw.id : null;
        const _isOnchain = route._rubicMode === 'onchain'; // legacy flag, no longer used

        if (!_rubicRouteId) {
          throw new Error('Rubic route ID missing — please re-fetch routes and try again.');
        }

        // ── Stale route guard: Rubic quotes expire ~3 minutes after fetch ──
        // Executing with a stale route ID causes error 1003 / TRANSACTION REJECTED.
        const _rubicFetchAge = route._fetchedAt ? (Date.now() - route._fetchedAt) : 0;
        if (_rubicFetchAge > 150000) { // 2m 30s — safe margin before Rubic 3m TTL
          throw new Error('Rubic route expired (fetched ' + Math.round(_rubicFetchAge / 1000) + 's ago). Please click Refresh Routes and try again immediately.');
        }

        // Amount — MUST be the EXACT string sent during quoteAll to avoid Rubic error 1003.
        const _faDec = br.fromToken.decimals || 18;
        const _humanAmt = route._quoteHumanAmt
          || (parseFloat(_execFromAmtStr) / Math.pow(10, _faDec)).toFixed(18).replace(/\.?0+$/, '');

        // Pre-check Rubic error 2005 (min amount)
        const _rubicMinAmt = route._minAmount || (_raw.minAmount) || null;
        if (_rubicMinAmt && parseFloat(_humanAmt) < parseFloat(_rubicMinAmt)) {
          const _minSym = (br.fromToken && br.fromToken.symbol) || 'ETH';
          throw new Error('Amount too low for this Rubic route. Minimum: ' + parseFloat(_rubicMinAmt).toPrecision(6) + '\u00a0' + _minSym + '. Increase your amount or pick a different route.');
        }

        // Official Rubic swap endpoint — same for both same-chain and cross-chain
        const _swapEndpoint = 'https://api-v2.rubic.exchange/api/routes/swap';

        // Official swap body per docs.rubic.finance
        const swapBody = {
          srcTokenAddress:    br.fromToken.address || '0x0000000000000000000000000000000000000000',
          srcTokenBlockchain: fromBC,
          srcTokenAmount:     _humanAmt,
          dstTokenAddress:    br.toToken.address || '0x0000000000000000000000000000000000000000',
          dstTokenBlockchain: toBC,
          fromAddress:        br.senderAddr,
          receiver:           br.recipientAddr || br.senderAddr,
          referrer:           'OneWallet',
          id:                 _rubicRouteId,
          // enableChecks: official schema type is object/boolean, default true.
          // Do NOT pass false string — omit to use API default (true), which is fine
          // since we disable only per-route, not globally.
        };

        const rubicSwapR = await fetch(_swapEndpoint, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(swapBody),
          signal:  AbortSignal.timeout(20000),
        });
        if (!rubicSwapR.ok) {
          const eb = await rubicSwapR.json().catch(() => ({}));
          const _ebCode = eb.error && eb.error.code;
          const _ebData = eb.error && eb.error.data;
          // Friendly messages for known Rubic error codes
          if (_ebCode === 2005 && _ebData && _ebData.minAmount) {
            const _minSym = (br.fromToken && br.fromToken.symbol) || 'ETH';
            throw new Error('Amount too low for this Rubic route. Minimum: ' + parseFloat(_ebData.minAmount).toPrecision(6) + '\u00a0' + _minSym + '. Increase your amount or pick a different route.');
          }
          if (_ebCode === 1003) {
            throw new Error('Rubic route expired or amount mismatch (error 1003). Click the refresh/search button to get fresh routes, then try again within 2 minutes.');
          }
          const _errMsg = (eb.error && (eb.error.reason || eb.error.message || eb.error.detail)) || eb.message || ('HTTP ' + rubicSwapR.status);
          // "not enough balance" is a Rubic-side validation false positive — skip and try anyway, or suggest LiFi
          if (typeof _errMsg === 'string' && _errMsg.toLowerCase().includes('balance')) {
            throw new Error('Rubic reports insufficient balance (false positive — your wallet has funds). Please use LiFi or Rango route instead.');
          }
          throw new Error('Rubic swap error: ' + _errMsg);
        }
        const rubicData = await rubicSwapR.json();
        // Trade id is needed for /info/statusExtended (accurate status for NEAR Intents & other deposit-based providers)
        route._rubicTradeId = rubicData.id || null;

        // Official Rubic /routes/swap response structure (docs.rubic.finance):
        // result.transaction = { approvalAddress, data, to, value }
        // value is a decimal wei string e.g. "1050785817564594203"
        const _rtx = rubicData.transaction;
        if (!_rtx || !_rtx.to) throw new Error('Rubic did not return transaction data. Try again or use LiFi.');

        // ── Official response: gasLimit lives in fees.gasTokenFees.gas.gasLimit, NOT in transaction ──
        // Docs: SwapResponseDto.fees.gasTokenFees.gas.gasLimit
        const _rubicGasLimit = rubicData.fees
          && rubicData.fees.gasTokenFees
          && rubicData.fees.gasTokenFees.gas
          && rubicData.fees.gasTokenFees.gas.gasLimit
          ? rubicData.fees.gasTokenFees.gas.gasLimit
          : null;

        // approvalAddress: official field inside transaction object
        // MUST use this for ERC-20 approve — may differ from tx.to (router vs aggregator)
        const _rubicApprovalAddr = _rtx.approvalAddress || _rtx.to;

        // value: decimal string → BigInt
        let _rubicValue = 0n;
        try {
          const _rv = String(_rtx.value || '0').trim();
          if (_rv && _rv !== '0' && _rv !== '0x0') {
            _rubicValue = _rv.startsWith('0x') ? BigInt(_rv) : BigInt(_rv);
          }
        } catch(_) { _rubicValue = 0n; }
        // Native safety: Rubic should always return correct value, but guard against 0
        const _rubicIsNative = !br.fromToken.address || br.fromToken.address === '0x0000000000000000000000000000000000000000';
        if (_rubicIsNative && _rubicValue === 0n) {
          try { _rubicValue = ethers.parseUnits((_execFromAmtStr||'0').replace(/[^0-9.]/g,'')||'0', _execFromDec); } catch(_) {}
        }

        _txReq = {
          to:              _rtx.to,
          data:            _rtx.data || '0x',
          value:           _rubicValue,
          // gasLimit: from fees.gasTokenFees.gas.gasLimit (official location per Rubic docs)
          gasLimit:        _rubicGasLimit || undefined,
          approvalAddress: _rubicApprovalAddr,
        };
      }

      // ══ RANGO TX FETCH ══
      else if (route._provider === 'rango') {
        if (labelEl) labelEl.textContent = 'Confirming Rango route…';
        if (!br.senderAddr) throw new Error('No sender wallet selected.');

        const RANGO_CHAINS_REV = {
          1:'ETH',56:'BSC',137:'POLYGON',43114:'AVAX_CCHAIN',42161:'ARBITRUM',
          10:'OPTIMISM',8453:'BASE',250:'FANTOM',100:'GNOSIS',59144:'LINEA',
          534352:'SCROLL',324:'ZKSYNC',5000:'MANTLE',81457:'BLAST',130:'UNICHAIN',
        };
        const fromBC = RANGO_CHAINS_REV[br.fromChain.id];
        const toBC   = RANGO_CHAINS_REV[br.toChain.id];
        if (!fromBC || !toBC) throw new Error('Chain not supported by Rango: ' + br.fromChain.name);

        const RANGO_KEY = window._ONE_RANGO_KEY;
        const _faDec2 = br.fromToken.decimals || 18;
        const _rawAmtStr2 = $e('br-from-amount').value.trim() || '0';
        const _safeAmt2 = (function(s, d){ var dot=s.indexOf('.'); return dot===-1?s:s.slice(0,dot+d+1); })(_rawAmtStr2, _faDec2);

        // Step 1: confirm route → get requestId
        const confirmBody = {
          requestId:       route._rangoRequestId,
          selectedWallets: { [fromBC]: br.senderAddr },
          destination:     br.recipientAddr || undefined,
        };
        // Always set toBC wallet — even same-chain — so recipient address is respected
        confirmBody.selectedWallets[toBC] = br.recipientAddr || br.senderAddr;

        const confirmR = await _brProxyFetch('https://api.rango.exchange/routing/confirm?apiKey=' + RANGO_KEY, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(confirmBody),
        });
        if (!confirmR.ok) {
          const eb = await confirmR.json().catch(() => ({}));
          throw new Error('Rango confirm error: ' + (eb.error || 'HTTP ' + confirmR.status));
        }
        const confirmData = await confirmR.json();
        if (!confirmData.ok) throw new Error('Rango route confirm failed: ' + (confirmData.error || 'unknown error'));

        // Step 2: create transaction
        if (labelEl) labelEl.textContent = 'Fetching Rango tx data…';
        const createBody = {
          requestId:    route._rangoRequestId,
          step:         1,
          userSettings: {
            slippage:       String(br.slippage || 1),
            infiniteApprove: false,
          },
          validations: { balance: false, fee: false },
        };
        const createR = await _brProxyFetch('https://api.rango.exchange/tx/create?apiKey=' + RANGO_KEY, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(createBody),
        });
        if (!createR.ok) {
          const eb = await createR.json().catch(() => ({}));
          throw new Error('Rango tx error: ' + (eb.error || 'HTTP ' + createR.status));
        }
        const rangoTxData = await createR.json();
        const _rtx = rangoTxData.transaction;
        if (!_rtx) throw new Error('Rango did not return transaction data. Try again or use LiFi.');

        // Rango EVM tx fields: from, to, data, value, gasLimit, gasPrice
        // Rango tx.value is a decimal WEI string — normalise to hex for sendSwapViaUserOp
        const _rangoBrVal = (() => {
          try {
            const _rv = _rtx.value;
            if (!_rv || _rv === '0' || _rv === '0x0') return '0x0';
            if (String(_rv).startsWith('0x')) return _rv;
            return '0x' + BigInt(String(_rv)).toString(16);
          } catch(_) { return '0x0'; }
        })();
        // Native safety for Rango
        let _rangoBrValFinal = _rangoBrVal;
        const _rangoIsNative = !br.fromToken.address || br.fromToken.address === '0x0000000000000000000000000000000000000000';
        if (_rangoIsNative && (!_rangoBrVal || _rangoBrVal === '0x0')) {
          try {
            const _rangoNativeAmt = ethers.parseUnits((_execFromAmtStr||'0').replace(/[^0-9.]/g,'')||'0', _execFromDec);
            if (_rangoNativeAmt > 0n) _rangoBrValFinal = '0x' + _rangoNativeAmt.toString(16);
          } catch(_) {}
        }
        _txReq = {
          to:       _rtx.to,
          data:     _rtx.data || '0x',
          value:    _rangoBrValFinal,
          gasLimit: _rtx.gasLimit || _rtx.gas || undefined,
        };
        // Save requestId for status polling later
        route._rangoExecuteRequestId = route._rangoRequestId;
      }

      // ══ SOCKET (Bungee) TX FETCH ══
      else if (route._provider === 'socket') {
        if (labelEl) labelEl.textContent = 'Fetching Socket tx data…';
        if (!br.senderAddr) throw new Error('No sender wallet selected.');
        if (!route._socketQuoteId) throw new Error('Socket quote ID missing — please re-fetch routes.');

        // Stale guard: Socket quotes expire ~3 minutes
        const _socketAge = route._fetchedAt ? (Date.now() - route._fetchedAt) : 0;
        if (_socketAge > 150000) {
          throw new Error('Socket route expired. Please refresh routes and try again.');
        }

        // Recipient mismatch guard: Socket bakes receiver into the quoteId at quote time.
        // If recipient changed after last route fetch, the quoteId has the wrong receiver → re-fetch required.
        const _socketExpectedReceiver = (route._socketReceiverAddr || '').toLowerCase();
        const _socketCurrentReceiver  = (br.recipientAddr || br.senderAddr || '').toLowerCase();
        if (_socketExpectedReceiver && _socketCurrentReceiver && _socketExpectedReceiver !== _socketCurrentReceiver) {
          throw new Error('Recipient changed after route fetch. Please click "Refresh Routes" to get a fresh Socket quote with the correct receiver address.');
        }

        const buildUrl = 'https://public-backend.bungee.exchange/api/v1/bungee/build-tx'
          + '?quoteId=' + encodeURIComponent(route._socketQuoteId);

        const buildR = await fetch(buildUrl, { signal: AbortSignal.timeout(15000) });
        if (!buildR.ok) {
          const eb = await buildR.json().catch(() => ({}));
          throw new Error('Socket build-tx error: ' + (eb.message || 'HTTP ' + buildR.status));
        }
        const buildData = await buildR.json();
        // Bungee API v1: result.txData.{to, data, value} — NOT result.txTarget
        const _stxData = buildData.result && buildData.result.txData;
        if (!_stxData || !_stxData.to || !_stxData.data) {
          throw new Error('Socket did not return transaction data. Try again or use another route.');
        }

        // Socket value is in hex or decimal
        let _socketValue = '0x0';
        try {
          const _sv = String(_stxData.value || '0').trim();
          if (_sv && _sv !== '0' && _sv !== '0x0') {
            _socketValue = _sv.startsWith('0x') ? _sv : '0x' + BigInt(_sv).toString(16);
          }
        } catch(_) { _socketValue = '0x0'; }

        _txReq = {
          to:       _stxData.to,
          data:     _stxData.data,
          value:    _socketValue,
          gasLimit: _stxData.gasLimit || undefined,
          approvalAddress: (buildData.result.approvalData && buildData.result.approvalData.spenderAddress)
            || (buildData.result.approvalData && buildData.result.approvalData.allowanceTarget)
            || _stxData.to,
        };
      }
      // ══ OKX DEX TX FETCH ══
      // OKX quote cards carry _okxPendingTx=true — tx calldata is fetched here fresh at execution time.
      // This avoids stale calldata from the quote phase and respects OKX /swap rate limits.
      else if (route.source === 'okxdex' && route._okxPendingTx) {
        if (labelEl) labelEl.textContent = 'Fetching OKX route…';
        if (!br.senderAddr) throw new Error('No sender wallet selected.');

        const _ci        = route._okxCi;
        const _fromAddr  = route._okxFromAddr;
        const _toAddr    = route._okxToAddr;
        const _amt       = route._okxAmountWei;
        const _slippage  = route._okxSlip || br.slippage || '1';
        const _wallet    = br.senderAddr;

        const OKX_KEY2        = '4ea63ec2-cc07-4855-98e9-37cece4bd3ff';
        const OKX_SECRET2     = 'CB2465C6DBB02286A8427B1CE9EFAEAC';
        const OKX_PASSPHRASE2 = 'ak01ALim@';

        const _dexIdParam = route._okxDexId ? '&dexIds=' + route._okxDexId : '';

        // Helper: HMAC-SHA256 signed OKX GET for brExecute
        async function _brOkxGet(path) {
          const _bts  = new Date().toISOString().replace(/(\d{3})Z$/, '000Z');
          const _bph  = _bts + 'GET' + path;
          const _bkb  = new TextEncoder().encode(OKX_SECRET2);
          const _bmb  = new TextEncoder().encode(_bph);
          const _bck  = await crypto.subtle.importKey('raw', _bkb, {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
          const _bsg  = await crypto.subtle.sign('HMAC', _bck, _bmb);
          const _bsig = btoa(String.fromCharCode(...new Uint8Array(_bsg)));
          return window.oneSignedFetch('https://www.okx.com' + path, {
            ms: 30000,
            headers: {
              'OK-ACCESS-KEY': OKX_KEY2, 'OK-ACCESS-SIGN': _bsig,
              'OK-ACCESS-TIMESTAMP': _bts, 'OK-ACCESS-PASSPHRASE': OKX_PASSPHRASE2,
              'Content-Type': 'application/json'
            }
          });
        }

        // Fetch correct approve spender from OKX /approve-transaction
        // OKX uses a SEPARATE approve contract (dexContractAddress) that differs
        // from the swap router tx.to — approving wrong address causes on-chain revert
        let _brOkxApproveAddr = null;
        const _brOkxNativeAddr = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
        if (_fromAddr && _fromAddr.toLowerCase() !== _brOkxNativeAddr) {
          try {
            const _brAppPath = `/api/v6/dex/aggregator/approve-transaction?chainIndex=${_ci}&tokenContractAddress=${_fromAddr}&approveAmount=${_amt}`;
            const _brAppResp = await _brOkxGet(_brAppPath);
            if (_brAppResp.ok) {
              const _brAppJson = await _brAppResp.json();
              if (_brAppJson.code === '0' && _brAppJson.data?.[0]?.dexContractAddress) {
                _brOkxApproveAddr = _brAppJson.data[0].dexContractAddress;
              }
            }
          } catch(_) { /* non-fatal — fallback to tx.to */ }
        }

        const _swapQuery = `chainIndex=${_ci}&amount=${_amt}&fromTokenAddress=${_fromAddr}&toTokenAddress=${_toAddr}&slippagePercent=${_slippage}&userWalletAddress=${_wallet}&swapMode=exactIn` + _dexIdParam;
        const _swapPath  = '/api/v6/dex/aggregator/swap?' + _swapQuery;
        const _swapResp  = await _brOkxGet(_swapPath);
        if (!_swapResp.ok) throw new Error('OKX /swap HTTP ' + _swapResp.status);
        const _swapJson = await _swapResp.json();
        if (_swapJson.code !== '0' || !_swapJson.data?.[0]) {
          throw new Error('OKX swap error: ' + (_swapJson.msg || _swapJson.code || 'unknown'));
        }
        const _sd = _swapJson.data[0];
        const _stx = _sd.tx;
        const _okxZero = '0x0000000000000000000000000000000000000000';
        if (!_stx?.to || _stx.to.toLowerCase() === _okxZero || !_stx?.data) throw new Error('OKX did not return valid tx calldata. Try again.');

        let _okxValue = '0x0';
        try {
          const _sv = String(_stx.value || '0').trim();
          if (_sv && _sv !== '0' && _sv !== '0x0') {
            _okxValue = _sv.startsWith('0x') ? _sv : '0x' + BigInt(_sv).toString(16);
          }
        } catch(_) { _okxValue = '0x0'; }

        _txReq = {
          to:              _stx.to,
          data:            _stx.data,
          value:           _okxValue,
          gasLimit:        _stx.gas ? BigInt(_stx.gas) : undefined,
          approvalAddress: _brOkxApproveAddr || _stx.to,
        };
        if(window._swLog) window._swLog('OKX:' + (route._okxDexName||'DEX'), 'OK', 'tx fetched');
      }

      // 1. Check top-level route.transactionRequest
      if (!_txReq) _txReq = route.transactionRequest;

      // 2. Check inside steps[0].transactionRequest (same-chain swap via /advanced/routes)
      if (!_txReq && _routeSteps.length && _routeSteps[0].transactionRequest) {
        _txReq = _routeSteps[0].transactionRequest;
      }

      // 3. Fallback: POST to /advanced/stepTransaction (cross-chain bridges)
      if (!_txReq) {
        if (labelEl) labelEl.textContent = 'Fetching transaction data…';
        if (!br.senderAddr) throw new Error('No sender wallet selected. Please select a wallet before executing.');

        if (!_routeSteps.length) throw new Error('Selected route has no steps. Please refresh quotes.');
        const _step = _routeSteps[0];

        // Inject fromAddress/toAddress into the step's action (required by stepTransaction)
        const _stepWithAddr = {
          ..._step,
          action: {
            ..._step.action,
            fromAddress: br.senderAddr,
            toAddress:   br.recipientAddr || br.senderAddr,
          },
        };

        const r2 = await _brProxyFetch(`${LIFI_API}/advanced/stepTransaction`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'x-lifi-api-key': 'b3e55edd-de70-4578-b761-cd2aac0fbae0.685a5adf-2580-486e-a8ff-1df4992b3f2e' },
          body:    JSON.stringify(_stepWithAddr),
        });

        if (!r2.ok) {
          let em = 'Failed to get transaction data for selected route';
          try { const eb = await r2.json(); em = eb?.message || em; } catch {}
          throw new Error(em);
        }

        const r2json = await r2.json();
        _txReq = r2json.transactionRequest;

        if (!_txReq) throw new Error('Could not get transaction data for selected route. Please refresh quotes and try again.');
      }
      const txReq = _txReq;

      // ── Paymaster: Base chain → try sponsor first (both same-chain swap & cross-chain bridge), auto-fallback to EOA ──
      const usePaymaster = br.fromChain.id === 8453
        && typeof sendSwapViaUserOp === 'function'
        && (typeof isPaymasterEnabled === 'function' ? isPaymasterEnabled() : true);

      // ── ERC-20 approve if needed ──
      const zeroAddr = '0x0000000000000000000000000000000000000000';
      const eeeeAddr = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
      const _fromAddrLow = br.fromToken.address.toLowerCase();
      if (_fromAddrLow !== zeroAddr && _fromAddrLow !== eeeeAddr) {
        if (labelEl) labelEl.textContent = 'Checking allowance…';
        const ERC20_ABI = [
          'function allowance(address,address) view returns(uint256)',
          'function approve(address,uint256) returns(bool)',
        ];
        const tokenC  = new ethers.Contract(br.fromToken.address, ERC20_ABI, wallet);
        // Use pre-captured amount (avoids reading DOM after it may be cleared by _bsoOpen reset)
        const _rawAmtStr = (function(s, d) {
          var dot = s.indexOf('.');
          if (dot === -1) return s;
          return s.slice(0, dot + d + 1);
        })(_execFromAmtStr, _execFromDec);
        const fromAmt = ethers.parseUnits(_rawAmtStr || '0', _execFromDec);
        // approvalAddress: Rubic returns this separately (may differ from txReq.to).
        // Using wrong approval target = router has no allowance → TX revert (main same-chain bug).
        const _approvalAddr = txReq.approvalAddress
          || ((_routeSteps[0] && (_routeSteps[0].estimate?.approvalAddress || _routeSteps[0].action?.approvalAddress)) || txReq.to);
        // The spender comes from the quote response: refuse anything that is not a real, non-zero address
        if (!ethers.isAddress(_approvalAddr) || _approvalAddr.toLowerCase() === zeroAddr) {
          throw new Error('Invalid approval address in route — nothing was approved or sent');
        }
        const allowance = await tokenC.allowance(wallet.address, _approvalAddr);
        if (allowance < fromAmt) {
          if (usePaymaster) {
            if (labelEl) labelEl.textContent = '⛽ Sponsoring approve…';
            let _approveSponsored = false;
            try {
              const approveData = tokenC.interface.encodeFunctionData('approve', [_approvalAddr, fromAmt]);
              await sendSwapViaUserOp(wallet, { to: br.fromToken.address, value: '0x0', data: approveData }, provider, () => {});
              _approveSponsored = true;
            } catch (_appSponsorErr) {
              // Sponsor approve failed — fallback to normal EOA approve
              if (labelEl) labelEl.textContent = '⚠️ Gasless approve failed, using wallet gas…';
              await new Promise(r => setTimeout(r, 500));
            }
            if (!_approveSponsored) {
              if (labelEl) labelEl.textContent = 'Approving token…';
              const appTx = await tokenC.approve(_approvalAddr, fromAmt);
              try {
                await Promise.race([appTx.wait(1), new Promise((_, rej) => setTimeout(() => rej(new Error('approve timeout')), 60000))]);
              } catch(_appWaitErr) { /* timeout — proceed anyway */ }
            }
          } else {
            if (labelEl) labelEl.textContent = 'Approving token…';
            const appTx = await tokenC.approve(_approvalAddr, fromAmt);
            try {
              await Promise.race([appTx.wait(1), new Promise((_, rej) => setTimeout(() => rej(new Error('approve timeout')), 60000))]);
            } catch(_appWaitErr) {
              // Timeout waiting for approval confirmation — wait extra 5s then continue
              // (node may be slow; approval is likely confirmed on-chain)
              if (_appWaitErr.message && _appWaitErr.message.includes('timeout')) {
                if (labelEl) labelEl.textContent = 'Approval pending, waiting…';
                await new Promise(r => setTimeout(r, 5000));
              } else {
                throw new Error('Approve failed: ' + (_appWaitErr.message || 'unknown error'));
              }
            }
          }
          // Stop if the approval did not land on-chain. A timeout / failed wait used to be ignored
          // and the swap was sent anyway.
          let _allowanceOk = false;
          for (let _ai = 0; _ai < 8 && !_allowanceOk; _ai++) {
            try { _allowanceOk = (await tokenC.allowance(wallet.address, _approvalAddr)) >= fromAmt; } catch(_) {}
            if (!_allowanceOk) await new Promise(r => setTimeout(r, 2500));
          }
          if (!_allowanceOk) throw new Error('Approve not confirmed on-chain — nothing was sent. Please try again.');
          if (labelEl) labelEl.textContent = '✅ Approved';
          await new Promise(r => setTimeout(r, 800));
        }
      }

      // ── Send main TX ──
      let finalTxHash;
      let sponsoredOk = false;
      if (usePaymaster) {
        try {
          if (labelEl) labelEl.textContent = '⛽ Sponsoring transaction…';
          // Pass hintGasLimit: LI.FI txReq.gasLimit + 30% buffer to avoid AA95 OOG.
          // Both LI.FI and Rango can return complex multi-hop routes needing >500k gas
          const _brPmHint = txReq.gasLimit
            ? BigInt(Math.ceil(Number(txReq.gasLimit) * 1.3))
            : (_brProvider === 'lifi' || _brProvider === 'rango') ? 500000n : undefined;
          const pmResult = await sendSwapViaUserOp(wallet, txReq, provider, () => {}, _brPmHint);
          finalTxHash  = pmResult.txHash;
          br.txHash    = finalTxHash;
          sponsoredOk  = true;
          // Capture fromAmt (sendSwapViaUserOp already confirmed onchain)
          const _capturedSponsorFromAmt = $e('br-from-amount') ? $e('br-from-amount').value : '—';
          // Cross-chain only: open BSO progress card
          const _isSameSponsor = br.fromChain.id === br.toChain.id;
          if (!_isSameSponsor && typeof _bsoOpen === 'function') {
            _bsoOpen({ fromAmt: _capturedSponsorFromAmt, fromSym: br.fromToken.symbol, toSym: br.toToken.symbol, fromChain: br.fromChain.name, toChain: br.toChain.name, isSameChain: false, provider: (typeof _brProvider !== 'undefined' ? _brProvider : 'lifi') });
            const _sentExp = (typeof BR_EXPLORERS !== 'undefined' ? BR_EXPLORERS : {})[br.fromChain.id] || (window.getTHExplorerTx ? window.getTHExplorerTx(br.fromChain.id) : 'https://etherscan.io/tx/');
            _bsoSetSentHash(finalTxHash, _sentExp);
          }
          if (_isSameSponsor) {
            if (typeof saveTxToHistory === 'function') {
              saveTxToHistory({
                hash:        finalTxHash,
                recvHash:    null,
                pair:        br.fromToken.symbol + ' → ' + br.toToken.symbol,
                fromAmt:     _capturedSponsorFromAmt,
                fromToken:   br.fromToken.symbol,
                toAmt:       (function(){ try { var _r = br.routes && br.selectedRoute !== null ? br.routes[br.selectedRoute] : null; var _raw = _r && _r.estimate && _r.estimate.toAmount; var _dec = (br.toToken && br.toToken.decimals) || 18; return _raw ? parseFloat(ethers.formatUnits(_raw, _dec)).toFixed(6).replace(/\.?0+$/,'') : null; } catch(e){ return null; } })(),
                toToken:     br.toToken ? br.toToken.symbol : null,
                fromChain:   br.fromChain.name,
                toChain:     br.toChain.name,
                fromChainId: br.fromChain.id,
                toChainId:   br.toChain.id,
                type:        'swap',
                isDry:       false,
                walletIndex: 1,
              });
            }
            brRefreshRecentTx && brRefreshRecentTx();
            haptic && haptic();
            // Set received amount in success card
            if (typeof _bsoSetToAmt === 'function') {
              // ── Sponsored same-chain swap: close BSO, open _ssoOpen ──
              if (typeof _bsoClose === 'function') _bsoClose();
              var _rtS = null, _brSsoToAmtS = null;
              try {
                _rtS = br.routes && br.selectedRoute !== null ? br.routes[br.selectedRoute] : null;
                var _toRawS = _rtS && _rtS.estimate && _rtS.estimate.toAmount;
                var _toDecS = (br.toToken && br.toToken.decimals) || 18;
                if (_toRawS) {
                  var _toNumS = parseFloat(ethers.formatUnits(_toRawS.toString(), _toDecS));
                  _brSsoToAmtS = _toNumS < 0.000001 ? _toNumS.toExponential(3) : _toNumS < 1 ? _toNumS.toFixed(6) : _toNumS.toFixed(4);
                }
              } catch(_taErrS) {}
              if (typeof window._ssoOpen === 'function') {
                var _brFTS = br.fromToken || {}, _brTTS = br.toToken || {};
                var _brFCS = (_brFTS.color || '#627EEA,#364FC7').split(',');
                var _brTCS = (_brTTS.color || '#2775CA,#1557A0').split(',');
                window._ssoOpen({
                  fromAmt:      _capturedSponsorFromAmt,
                  fromSym:      _brFTS.symbol || '?',
                  fromIconBg:   'linear-gradient(135deg,' + _brFCS[0] + ',' + (_brFCS[1] || _brFCS[0]) + ')',
                  fromIconText: (_brFTS.symbol || '?').slice(0, 2),
                  fromLogoURI:  _brFTS.logoURI || null,
                  toAmt:        _brSsoToAmtS,
                  toSym:        _brTTS.symbol || '?',
                  toIconBg:     'linear-gradient(135deg,' + _brTCS[0] + ',' + (_brTCS[1] || _brTCS[0]) + ')',
                  toIconText:   (_brTTS.symbol || '?').slice(0, 2),
                  toLogoURI:    _brTTS.logoURI || null,
                  dex:          (_rtS && _rtS.steps && _rtS.steps[0] && _rtS.steps[0].toolDetails && _rtS.steps[0].toolDetails.name) || 'DEX',
                  hash:         finalTxHash || null,
                  chainId:      br.fromChain.id,
                  chainName:    br.fromChain.name,
                });
              }
            }
            _brUpdateHomeBalanceAfterSuccess && _brUpdateHomeBalanceAfterSuccess();
            _txDone = true;
          }
          _resetExecBtn();
          // sendSwapViaUserOp already confirmed
        } catch (pmErr) {
          // Paymaster failed → fallback to normal EOA TX
          if (labelEl) labelEl.textContent = '⚠️ Sponsor failed, sending normal TX…';
          await new Promise(r => setTimeout(r, 600));
        }
      }

      if (!sponsoredOk) {
        if (labelEl) labelEl.textContent = '⚡ Preparing gas (auto-optimized)…';

        // Build base txObj — OneGas will attach gas fields
        // value: Rubic sends decimal string, Rango/LiFi may send hex — handle all
        let _brTxValue = 0n;
        try {
          const _brRv = txReq.value;
          if (_brRv !== undefined && _brRv !== null && _brRv !== '' && _brRv !== '0' && _brRv !== '0x0' && _brRv !== '0x00') {
            _brTxValue = typeof _brRv === 'bigint' ? _brRv
              : String(_brRv).startsWith('0x') ? BigInt(String(_brRv))
              : BigInt(String(_brRv));
          }
        } catch(_) { _brTxValue = 0n; }

        // Native ETH safety: if sending native ETH and value=0, use fromAmount
        const _brIsNative = !br.fromToken.address || br.fromToken.address === '0x0000000000000000000000000000000000000000';
        if (_brIsNative && _brTxValue === 0n) {
          try {
            const _brNativeAmt = ethers.parseUnits(
              (_execFromAmtStr || '0').replace(/[^0-9.]/g,'') || '0',
              _execFromDec
            );
            if (_brNativeAmt > 0n) _brTxValue = _brNativeAmt;
          } catch(_) {}
        }
        const brTxBase = {
          to:      txReq.to,
          data:    txReq.data || '0x',
          value:   _brTxValue,
          chainId: br.fromChain.id,
        };
        // Gas limit hint — Rubic same-chain swaps often omit gasLimit, causing underestimation → revert
        if (txReq.gasLimit) {
          // Use Rubic-provided gasLimit with 30% buffer (was 20% — increased to reduce revert risk)
          brTxBase._hintGasLimit = BigInt(Math.ceil(Number(txReq.gasLimit) * 1.3));
        } else if (route._provider === 'rubic' && br.fromChain.id === br.toChain.id) {
          // Same-chain DEX aggregator swap (multi-hop) needs ≥500k–600k gas.
          // 400k was too low for complex routes (e.g. split-route via Uniswap V3 + Curve).
          // Bumped to 600k to prevent TRANSACTION REJECTED / on-chain revert.
          brTxBase._hintGasLimit = 600000n;
        }

        // OneGas onStatus — routes to bridge label
        const _brOnStatus = (msg) => {
          if (labelEl) labelEl.textContent = msg;
        };

        // Fetch nonce before attempt
        let brNonce;
        try { brNonce = await _withRpcFallback(br.fromChain.id, _p => _p.getTransactionCount(wallet.address, 'pending'), 5000); } catch {}

        const sent = await window.OneGas.sendWithFallback(
          wallet, provider, brTxBase, _brOnStatus, brNonce
        );
        finalTxHash = sent.hash;
        br.txHash   = finalTxHash;
        if (labelEl) labelEl.textContent = 'Confirming on ' + br.fromChain.name + '…';
        // Capture fromAmt BEFORE wait clears any state
        _capturedEoaFromAmt = $e('br-from-amount') ? $e('br-from-amount').value : '—';
        const _isSameChainEoa = br.fromChain.id === br.toChain.id;

        if (!_isSameChainEoa) {
          // Cross-chain: open BSO immediately so user sees progress while waiting
          if (typeof _bsoOpen === 'function') {
            _bsoOpen({ fromAmt: _capturedEoaFromAmt, fromSym: br.fromToken.symbol, toSym: br.toToken.symbol, fromChain: br.fromChain.name, toChain: br.toChain.name, isSameChain: false, provider: (typeof _brProvider !== 'undefined' ? _brProvider : 'lifi') });
            const _sentExp = (typeof BR_EXPLORERS !== 'undefined' ? BR_EXPLORERS : {})[br.fromChain.id] || (window.getTHExplorerTx ? window.getTHExplorerTx(br.fromChain.id) : 'https://etherscan.io/tx/');
            _bsoSetSentHash(finalTxHash, _sentExp);
            _resetExecBtn();
          }
        }

        // Wait for onchain confirmation FIRST
        // FIX: sent.wait() throws on flaky RPC / timeout / "replaced" even though the tx IS already
        // broadcast → UI wrongly showed "Bridge Failed". Now only a real on-chain revert counts as failure.
        const _sentReceipt = await _brConfirmSentTx(sent, br.fromChain.id);
        // ── Onchain revert check: status 0 = failed on-chain ──
        if (_sentReceipt && _sentReceipt.status === 0) {
          throw new Error('Transaction reverted on-chain (status 0). Check explorer for details.');
        }
      }

      // ── Source confirmed ──
      const isSame = br.fromChain.id === br.toChain.id;
      if (isSame && !_txDone) {
        if (typeof saveTxToHistory === 'function') {
          saveTxToHistory({
            hash:        finalTxHash,
            recvHash:    null,
            pair:        br.fromToken.symbol + ' → ' + br.toToken.symbol,
            fromAmt:     _capturedEoaFromAmt,
            fromToken:   br.fromToken.symbol,
            toAmt:       (function(){ try { var _r = br.routes && br.selectedRoute !== null ? br.routes[br.selectedRoute] : null; var _raw = _r && _r.estimate && _r.estimate.toAmount; var _dec = (br.toToken && br.toToken.decimals) || 18; return _raw ? parseFloat(ethers.formatUnits(_raw, _dec)).toFixed(6).replace(/\.?0+$/,'') : null; } catch(e){ return null; } })(),
            toToken:     br.toToken ? br.toToken.symbol : null,
            fromChain:   br.fromChain.name,
            toChain:     br.toChain.name,
            fromChainId: br.fromChain.id,
            toChainId:   br.toChain.id,
            type:        'swap',
            isDry:       false,
            walletIndex: 1,
          });
        }
        brRefreshRecentTx();
        haptic && haptic();
        // ── Fix: clear brRunning so bg pill/badge stop immediately ──
        window.brRunning = false;
        if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txEnd(); // BG: release wake lock
        if (typeof window._updateAllToolBadges === 'function') window._updateAllToolBadges();
        if (typeof window._bgPillUpdate === 'function') window._bgPillUpdate();
        // ── Same-chain swap confirmed: close BSO, open _ssoOpen success card ──
        if (typeof _bsoClose === 'function') _bsoClose();

        // Compute received amount for _ssoOpen
        var _brSsoToAmt = null;
        var _rt5 = null;
        try {
          _rt5 = br.routes && br.selectedRoute !== null ? br.routes[br.selectedRoute] : null;
          var _toRaw5 = _rt5 && _rt5.estimate && _rt5.estimate.toAmount;
          var _toDec5 = (br.toToken && br.toToken.decimals) || 18;
          if (_toRaw5) {
            var _toNum5 = parseFloat(ethers.formatUnits(_toRaw5.toString(), _toDec5));
            _brSsoToAmt = _toNum5 < 0.000001 ? _toNum5.toExponential(3) : _toNum5 < 1 ? _toNum5.toFixed(6) : _toNum5.toFixed(4);
          }
        } catch(_taErr) {}

        if (typeof window._ssoOpen === 'function') {
          var _brFT = br.fromToken || {}, _brTT = br.toToken || {};
          var _brFColors = (_brFT.color || '#627EEA,#364FC7').split(',');
          var _brTColors = (_brTT.color || '#2775CA,#1557A0').split(',');
          window._ssoOpen({
            fromAmt:      _capturedEoaFromAmt,
            fromSym:      _brFT.symbol || '?',
            fromIconBg:   'linear-gradient(135deg,' + _brFColors[0] + ',' + (_brFColors[1] || _brFColors[0]) + ')',
            fromIconText: (_brFT.symbol || '?').slice(0, 2),
            fromLogoURI:  _brFT.logoURI || null,
            toAmt:        _brSsoToAmt,
            toSym:        _brTT.symbol || '?',
            toIconBg:     'linear-gradient(135deg,' + _brTColors[0] + ',' + (_brTColors[1] || _brTColors[0]) + ')',
            toIconText:   (_brTT.symbol || '?').slice(0, 2),
            toLogoURI:    _brTT.logoURI || null,
            dex:          (_rt5 && _rt5.steps && _rt5.steps[0] && _rt5.steps[0].toolDetails && _rt5.steps[0].toolDetails.name) || 'DEX',
            hash:         finalTxHash || null,
            chainId:      br.fromChain.id,
            chainName:    br.fromChain.name,
          });
        }
        _brUpdateHomeBalanceAfterSuccess();
      } else if (!_txDone) {
        // ── Save pending bridge entry to history BEFORE polling starts ──
        // This ensures Recent Transactions shows the tx immediately with PENDING badge
        if (typeof saveTxToHistory === 'function') {
          var _pendingHistEntry = {
            hash:        finalTxHash,
            recvHash:    null,
            pair:        br.fromToken.symbol + ' → ' + br.toToken.symbol,
            fromAmt:     _capturedEoaFromAmt,
            fromToken:   br.fromToken.symbol,
            toAmt:       (function(){ try { var _r = br.routes && br.selectedRoute !== null ? br.routes[br.selectedRoute] : null; var _raw = _r && _r.estimate && _r.estimate.toAmount; var _dec = (br.toToken && br.toToken.decimals) || 18; return _raw ? parseFloat(ethers.formatUnits(_raw, _dec)).toFixed(6).replace(/\\.?0+$/,'') : null; } catch(e){ return null; } })(),
            toToken:     br.toToken ? br.toToken.symbol : null,
            fromChain:   br.fromChain.name,
            toChain:     br.toChain.name,
            fromChainId: br.fromChain.id,
            toChainId:   br.toChain.id,
            type:        'bridge',
            pendingRecv: true,
            isDry:       false,
            walletIndex: 1,
            provider:        (typeof _brProvider !== 'undefined' ? _brProvider : (route._provider || 'lifi')),
            rangoRequestId:  route._rangoExecuteRequestId || route._rangoRequestId || null,
            rubicTradeId:    route._rubicTradeId || null,
          };
          var _savedEntry = saveTxToHistory(_pendingHistEntry);
          // Store the id so brPollReceiverTx can find and update this exact record
          window._bsoPendingHistId = _savedEntry && _savedEntry.id ? _savedEntry.id : null;
        }
        brRefreshRecentTx && brRefreshRecentTx();
        brPollReceiverTx(finalTxHash, br.fromChain.id, br.toChain.id, route._provider || 'lifi', route._rangoExecuteRequestId || null, route._rubicTradeId || null);
      }

    } catch (e) {
      const errMsg = e.message || String(e);
      const isInsufficient = errMsg.toLowerCase().includes('insufficient fund');
      let _errText = '❌ Transaction Failed';

      if (isInsufficient && _provider && _wallet) {
        const _brErrChainId = br.fromChain && br.fromChain.id;
        try {
          const _wfb = (_brErrChainId && typeof _withRpcFallback === 'function') ? (fn => _withRpcFallback(_brErrChainId, fn)) : (fn => fn(_provider));
          const ethBal  = await _wfb(_p => _p.getBalance(_wallet.address));
          const feeData = await _wfb(_p => _p.getFeeData());
          let effectiveFee;
          if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
            const baseFee = feeData.maxFeePerGas - feeData.maxPriorityFeePerGas;
            const tip     = feeData.maxPriorityFeePerGas < 1000000n ? 1000000n : feeData.maxPriorityFeePerGas;
            effectiveFee  = baseFee + tip;
          } else {
            effectiveFee  = feeData.gasPrice || 1000000n;
          }
          let gasLim;
          if (_txReq?.gasLimit) {
            gasLim = BigInt(_txReq.gasLimit);
          } else {
            try {
              const estObj = { to: _txReq?.to, data: _txReq?.data, value: _txReq?.value ? BigInt(_txReq.value) : 0n };
              gasLim = await _wfb(_p => _p.estimateGas(estObj));
            } catch(_) { gasLim = null; }
          }
          const txVal   = _txReq?.value ? BigInt(_txReq.value) : 0n;
          const fmt     = (wei) => parseFloat(ethers.formatEther(wei)).toFixed(6);
          _errText = `❌ Insufficient ETH — Bal: ${fmt(ethBal)} / Need: ${gasLim ? fmt(txVal + gasLim * effectiveFee) : '—'} ETH`;
        } catch(_) {
          _errText = '❌ Insufficient funds';
        }
      } else {
        _errText = '❌ ' + errMsg.slice(0, 100);
      }

      // ── Determine if this was a same-chain swap or cross-chain bridge ──
      var _failIsSameChain = br.fromChain && br.toChain && br.fromChain.id === br.toChain.id;
      var _cleanErrText = _errText.replace(/^❌\s*/, '');

      if (_failIsSameChain) {
        // Same-chain swap fail: close BSO (if open), show _ssoOpen fail card
        if (typeof _bsoClose === 'function') _bsoClose();
        if (typeof window._ssoOpen === 'function') {
          var _brFTf = br.fromToken || {}, _brTTf = br.toToken || {};
          var _brFCf = (_brFTf.color || '#627EEA,#364FC7').split(',');
          var _brTCf = (_brTTf.color || '#2775CA,#1557A0').split(',');
          window._ssoOpen({
            fromAmt:      _capturedEoaFromAmt,
            fromSym:      _brFTf.symbol || '?',
            fromIconBg:   'linear-gradient(135deg,' + _brFCf[0] + ',' + (_brFCf[1] || _brFCf[0]) + ')',
            fromIconText: (_brFTf.symbol || '?').slice(0, 2),
            fromLogoURI:  _brFTf.logoURI || null,
            toAmt:        null,
            toSym:        _brTTf.symbol || '?',
            toIconBg:     'linear-gradient(135deg,' + _brTCf[0] + ',' + (_brTCf[1] || _brTCf[0]) + ')',
            toIconText:   (_brTTf.symbol || '?').slice(0, 2),
            toLogoURI:    _brTTf.logoURI || null,
            hash:         br.txHash || null,
            chainId:      br.fromChain.id,
            chainName:    br.fromChain.name,
            failed:       true,
            failMsg:      _cleanErrText,
          });
        }
      } else {
        // Cross-chain bridge fail: use BSO card as before
        if (typeof _bsoSetStatus === 'function') _bsoSetStatus(_errText);
        if (typeof _bsoOpen === 'function' && typeof _bsoIsOpen === 'function' && !_bsoIsOpen()) {
          _bsoOpen({ fromAmt: $e('br-from-amount') ? $e('br-from-amount').value : '—', fromSym: br.fromToken ? br.fromToken.symbol : '—', toSym: br.toToken ? br.toToken.symbol : '—', fromChain: br.fromChain ? br.fromChain.name : '—', toChain: br.toChain ? br.toChain.name : '—', isSameChain: false, provider: (typeof _brProvider !== 'undefined' ? _brProvider : 'lifi') });
          setTimeout(function() { if (typeof _bsoSetStatus === 'function') _bsoSetStatus(_errText); if (typeof _bsoDone === 'function') _bsoDone(false); }, 50);
        } else {
          if (typeof _bsoDone === 'function') _bsoDone(false);
        }
      }
    } finally {
      if (!_txDone) _resetExecBtn();
    }
  };
