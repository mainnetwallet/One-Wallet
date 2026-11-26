
async function _nxsw__swRunSwap() {
  const fromAmt = parseFloat(SW.fromAmount);
  const hasPK   = !!(SW.walletPK);

  // No signer — simulate
  if (!hasPK) {
    _swRecordAndReset(fromAmt, SW.toAmount, '(simulated)');
    _nxsw_swShowToast('✅ Swap simulated. Connect a real wallet for live swaps.');
    return;
  }

  // Guard: quote must exist
  if (!SW.toAmount || SW.toAmount <= 0) {
    _nxsw_swShowToast('⚠️ Please wait for quote to load before swapping.');
    return;
  }

  // Guard: cached tx data must exist (fetched during quote phase)
  // Allow price-only routes (LiFi, Rango, Socket) — real TX fetched at execution time
  const _activeTx = SW._lockedSwapTx || SW._cachedSwapTx;
  const _isRangoPriceOnly  = _activeTx?._priceOnly && _activeTx?._rangoRoute   && _activeTx?.source === 'rango';
  const _isLifiPriceOnly   = _activeTx?._priceOnly && _activeTx?._lifiStep     && _activeTx?.source === 'lifi';
  const _isSocketPriceOnly = _activeTx?._priceOnly && _activeTx?._socketQuoteId && _activeTx?.source === 'socket';
  if (!_activeTx || !_activeTx.to || (!_activeTx.data && !_isRangoPriceOnly && !_isLifiPriceOnly && !_isSocketPriceOnly)) {
    _nxsw_swShowToast('⚠️ No swap route available. Try changing the amount or pair.');
    return;
  }

  // 0x uses allowance-holder/quote — full tx calldata available directly

  // ── Background task tracking ──
  window.swRunning = true;
  if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txStart(); // BG: wake lock + audio
  if (typeof window._updateAllToolBadges === 'function') window._updateAllToolBadges();
  if (typeof window._bgPillUpdate === 'function') window._bgPillUpdate();

  _swBtnLoading('Preparing swap…');

  try {
    const chainId    = SW.network.chainId;
    const fromSym    = SW.fromToken.sym;
    const toSym      = SW.toToken.sym;
    const NATIVE      = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
    const EEEE_LOW    = 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    // Reliable native detection — same logic as quote phase
    const _runIsNative = (() => {
      const c = (SW.fromToken.contract || SW.fromToken.address || '').toLowerCase().replace(/^0x/, '');
      return !c || /^0+$/.test(c) || c === EEEE_LOW;
    })();
    const isFromNative = _runIsNative;
    const fromAddr     = isFromNative ? NATIVE : (SW.fromToken.contract || SW.fromToken.address || '');
    // Safe amountWei — string-based to avoid float overflow
    const amountWei    = (() => {
      try {
        const dec = Math.min(SW.fromToken.decimals || 18, 18);
        const str = fromAmt.toFixed(dec + 2);
        const [ip, fp = ''] = str.split('.');
        const frac = (fp + '0'.repeat(dec)).slice(0, dec);
        return (BigInt(ip) * BigInt('1' + '0'.repeat(dec)) + BigInt(frac)).toString();
      } catch(e) { return String(Math.floor(fromAmt * 1e6)); }
    })();

    let swapTxData = _activeTx;
    const sourceName = swapTxData.source || 'DEX';

    // ── Build "DEX via API" route label + logo meta for success card ──
    const _SW_API_LABELS = {
      'lifi':'LiFi', 'odos':'Odos', '1inch':'1inch', '0x':'0x Protocol',
      'kyberswap':'KyberSwap', 'openocean':'OpenOcean', 'cow':'CoW Protocol',
      'rango':'Rango', 'socket':'Socket', 'symbiosis':'Symbiosis',
      'squid':'Squid', 'enso':'Enso', 'velora':'Velora',
      'hashflow':'Hashflow', 'clipper':'Clipper', 'swapapi':'SwapAPI'
    };
    const _swApiLabel  = _SW_API_LABELS[sourceName] || sourceName;
    const _swDexName   = (SW.bestDex && SW.bestDex.dex) || _swApiLabel;
    const _hasBothParts = _swDexName && _swApiLabel && _swDexName !== _swApiLabel;
    // "Uniswap V3 via LiFi" — show both only when DEX name differs from API name
    const _swRouteLabel = _hasBothParts
      ? _swDexName + ' via ' + _swApiLabel
      : (_swDexName || _swApiLabel || 'DEX');
    // ── Resolve logos for success card ──
    // Helper: resolve display name → logo URI or inline SVG data URI
    function _resolveLogoURI(displayName) {
      if (!displayName) return null;
      // 1. Inline SVG (Socket, LiFi, etc.) → convert to data URI
      if (typeof _SW_INLINE_LOGOS !== 'undefined') {
        const _inKey = Object.keys(_SW_INLINE_LOGOS).find(k => displayName === k || displayName.startsWith(k));
        if (_inKey) {
          // Extract inner content of inline logo (could be <img> or <svg>)
          const _inRaw = _SW_INLINE_LOGOS[_inKey];
          // If it's an <img src=...> extract the src
          const _imgMatch = _inRaw.match(/src=["']([^"']+)["']/);
          if (_imgMatch) return _imgMatch[1];
          // If it's SVG, encode as data URI
          if (_inRaw.trim().startsWith('<svg')) {
            return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(_inRaw.trim());
          }
        }
      }
      // 2. Static logo map
      if (typeof SW_DEX_LOGOS !== 'undefined' && SW_DEX_LOGOS[displayName]) {
        return SW_DEX_LOGOS[displayName];
      }
      // 3. Prefix fallback
      if (typeof SW_DEX_LOGO_PREFIXES !== 'undefined') {
        for (const [prefix, url] of SW_DEX_LOGO_PREFIXES) {
          if (displayName.startsWith(prefix) || displayName.includes(prefix)) return url;
        }
      }
      return null;
    }
    const _swDexLogoURI = (SW.bestDex && SW.bestDex.routerLogoURI) || _resolveLogoURI(_swDexName);
    const _swApiLogoURI = _resolveLogoURI(_swApiLabel);
    // Store in SW so _swRecordAndReset (separate function) can access it
    SW._ssoRouteMeta = {
      dexName:    _swDexName,
      apiLabel:   _swApiLabel,
      hasBoth:    _hasBothParts,
      dexLogoURI: _swDexLogoURI,
      apiLogoURI: _swApiLogoURI
    };

    // ── LiFi: price-only route — build real TX via /advanced/stepTransaction ──
    if (swapTxData._priceOnly && swapTxData._lifiStep && swapTxData.source === 'lifi') {
      _swBtnLoading('Building LiFi route…');
      try {
        if (!SW.walletAddress) throw new Error('No wallet selected. Please select a wallet first.');
        const _lStep = JSON.parse(JSON.stringify(swapTxData._lifiStep)); // deep-copy — never mutate cached step
        // Inject wallet address + ensure fromAmount is set (some LI.FI routers strip it on /routes)
        if (_lStep.action) {
          _lStep.action.fromAddress = SW.walletAddress;
          _lStep.action.toAddress   = SW.walletAddress;
          // Ensure fromAmount is present — required by /advanced/stepTransaction for exact calldata
          if (!_lStep.action.fromAmount) _lStep.action.fromAmount = amountWei;
        }
        const _stResp = await _swProxyFetch('https://li.quest/v1/advanced/stepTransaction', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-lifi-api-key': 'b3e55edd-de70-4578-b761-cd2aac0fbae0.685a5adf-2580-486e-a8ff-1df4992b3f2e' },
          body: JSON.stringify(_lStep), signal: AbortSignal.timeout(12000),
        });
        if (!_stResp.ok) throw new Error('LiFi stepTransaction HTTP ' + _stResp.status);
        const _stJ = await _stResp.json();
        const _txReq = _stJ.transactionRequest || (_stJ.steps && _stJ.steps[0] && _stJ.steps[0].transactionRequest);
        if (!_txReq?.to || !_txReq?.data) throw new Error('LiFi stepTransaction: no tx data');
        // LiFi stepTransaction returns approvalAddress separately — it may differ from .to
        // (e.g. router contract vs approval target). Must carry this over so the ERC-20
        // approve goes to the correct spender, otherwise sponsored approve passes but
        // the actual swap reverts with TRANSFER_FROM_FAILED.
        const _lifiApprovalAddr = _txReq.approvalAddress
          || (_stJ.estimate?.approvalAddress)
          || null;
        swapTxData = {
          to: _txReq.to, data: _txReq.data,
          value: _txReq.value || '0x0',
          gas: Number(_txReq.gasLimit) || 300000,
          source: 'lifi',
          swapApiDisplay: swapTxData.swapApiDisplay,
          outputWei: swapTxData.outputWei,
          // ← critical: pass allowanceTarget so spender detection below works correctly
          allowanceTarget: _lifiApprovalAddr || _txReq.to,
        };
      } catch(_lErr) {
        _nxsw_swShowToast('⚠️ LiFi TX build failed: ' + _lErr.message);
        _nxsw__swBtnRestore();
        return;
      }
    }

    // ── Socket (Bungee): price-only route — fetch real TX via new /api/v1/bungee/build-tx ──
    if (swapTxData._priceOnly && swapTxData._socketQuoteId && swapTxData.source === 'socket') {
      _swBtnLoading('Building Bungee TX…');
      try {
        const _btR = await fetch(
          `https://public-backend.bungee.exchange/api/v1/bungee/build-tx?quoteId=${encodeURIComponent(swapTxData._socketQuoteId)}`,
          { signal: AbortSignal.timeout(10000) }
        );
        if (!_btR.ok) throw new Error('Bungee build-tx HTTP ' + _btR.status);
        const _btJ = await _btR.json();
        if (!_btJ.result?.txData?.to || !_btJ.result?.txData?.data)
          throw new Error('Bungee: no TX data in response');
        const _btVal = (() => {
          const v = _btJ.result.txData.value;
          if (!v || v === '0' || v === '0x0') return isFromNative ? ('0x' + BigInt(amountWei).toString(16)) : '0x0';
          if (String(v).startsWith('0x')) return v;
          try { return '0x' + BigInt(String(v)).toString(16); } catch(_) { return '0x0'; }
        })();
        swapTxData = {
          to:   _btJ.result.txData.to,
          data: _btJ.result.txData.data,
          value: _btVal,
          gas:  300000,
          source: 'socket',
          swapApiDisplay: swapTxData.swapApiDisplay,
          outputWei: swapTxData.outputWei,
          allowanceTarget: _btJ.result.approvalData?.spenderAddress || _btJ.result.txData.to,
        };
      } catch (_btErr) {
        _nxsw_swShowToast('⚠️ Bungee TX build failed: ' + _btErr.message);
        _nxsw__swBtnRestore();
        return;
      }
    }

    // ── Rango: price-only route — fetch real TX now via /basic/swap ──
    if (swapTxData._priceOnly && swapTxData._rangoRoute && swapTxData.source === 'rango') {
      _swBtnLoading('Building Rango TX…');
      try {
        const _rChain = {1:'ETH',56:'BSC',137:'POLYGON',42161:'ARBITRUM',10:'OPTIMISM',8453:'BASE',43114:'AVAX_CCHAIN'};
        const _rNative = {1:'ETH',56:'BNB',137:'MATIC',42161:'ETH',10:'ETH',8453:'ETH',43114:'AVAX'};
        const _rBC = _rChain[chainId];
        if (!_rBC) throw new Error('Rango: unsupported chain');
        const _rFromSym = isFromNative ? _rNative[chainId] : (SW.fromToken.symbol || SW.fromToken.sym || '');
        const _rToIsNative = (() => { const c=(SW.toToken.contract||SW.toToken.address||'').toLowerCase().replace(/^0x/,''); return !c||/^0+$/.test(c); })();
        const _rToSym = _rToIsNative ? _rNative[chainId] : (SW.toToken.symbol || SW.toToken.sym || '');
        const _rFromAddr = isFromNative ? null : (SW.fromToken.contract || SW.fromToken.address || null);
        const _rToAddr   = _rToIsNative ? null : (SW.toToken.contract   || SW.toToken.address   || null);
        const _rAmtHuman = String(parseFloat(amountWei) / Math.pow(10, SW.fromToken.decimals || 18));
        const _rSlip = String(parseFloat(SW.slippage || '1'));
        const _rFrom = encodeURIComponent(isFromNative ? `${_rBC}.${_rFromSym}` : `${_rBC}--${_rFromAddr}`);
        const _rTo   = encodeURIComponent(_rToIsNative ? `${_rBC}.${_rToSym}`   : `${_rBC}--${_rToAddr}`);
        const _rUrl = `https://api.rango.exchange/basic/swap?from=${_rFrom}&to=${_rTo}&amount=${amountWei}&slippage=${_rSlip}&fromAddress=${SW.walletAddress}&toAddress=${SW.walletAddress}&disableEstimate=true&apiKey=${window._ONE_RANGO_KEY}`;
        const _rResp = await fetch(_rUrl, { signal: AbortSignal.timeout(12000) });
        if (!_rResp.ok) throw new Error('Rango TX fetch failed: HTTP ' + _rResp.status);
        const _rJ = await _rResp.json();
        if (_rJ.resultType !== 'OK' || !_rJ.tx?.txData) throw new Error('Rango: no TX data (' + (_rJ.resultType || 'unknown') + ')');
        // Rango .value is a decimal WEI string — parse with BigInt directly to avoid float precision loss
        const _rTxVal = (() => {
          try {
            const _rv = _rJ.tx.value;
            if (!_rv || _rv === '0' || _rv === '0x0') return '0x0';
            if (String(_rv).startsWith('0x')) return _rv; // already hex
            return '0x' + BigInt(String(_rv)).toString(16); // decimal string → hex (no float)
          } catch(_) { return '0x0'; }
        })();
        // Rango approvalData: may be inside tx.approvalData or top-level approvalData
        const _rApprovalAddr = _rJ.tx?.approvalData?.approvalAddress
          || _rJ.approvalData?.approvalAddress
          || null;
        swapTxData = {
          to: _rJ.tx.txTo, data: _rJ.tx.txData, value: _rTxVal,
          gas: Number(_rJ.tx.gasLimit) || 300000, source: 'rango',
          swapApiDisplay: swapTxData.swapApiDisplay,
          outputWei: String(_rJ.route?.outputAmount ? (parseFloat(_rJ.route.outputAmount) * Math.pow(10, SW.toToken.decimals||18)).toFixed(0) : swapTxData.outputWei),
          _rangoRequestId: _rJ.requestId,
          // allowanceTarget: Rango router contract may differ from txTo (aggregator vs DEX router)
          allowanceTarget: _rApprovalAddr || _rJ.tx.txTo,
        };
      } catch(_rErr) {
        _nxsw_swShowToast('⚠️ Rango TX build failed: ' + _rErr.message);
        _nxsw__swBtnRestore();
        return;
      }
    }

    // ── Velora: price-only quote — build real TX now ──
    if (swapTxData._priceOnly && swapTxData.priceRoute) {
      _swBtnLoading(`Building ${sourceName} route…`);
      const slip = parseFloat(SW.slippage || '1');
      const builtTx = await _buildVeloraTx(swapTxData.priceRoute, SW.walletAddress, amountWei, slip, chainId);
      if (!builtTx || !builtTx.to || !builtTx.data || builtTx.data === '0x') {
        _nxsw_swShowToast(`⚠️ ${sourceName} TX build failed. Try a different route.`);
        _nxsw__swBtnRestore();
        return;
      }
      swapTxData = builtTx;
    }

    // ── OKX DEX: pending TX — fetch real calldata now at execution time ──
    if (swapTxData._okxPendingTx && swapTxData.source === 'okxdex') {
      _swBtnLoading('Fetching OKX route…');
      try {
        const _oci      = swapTxData._okxCi;
        const _oFrom    = swapTxData._okxFromAddr;
        const _oTo      = swapTxData._okxToAddr;
        const _oAmt     = swapTxData._okxAmountWei;
        const _oSlip    = swapTxData._okxSlip || SW.slippage || '1';
        const _oWallet  = SW.walletAddress;
        const _oDexId   = swapTxData._okxDexId ? '&dexIds=' + swapTxData._okxDexId : '';
        const OKX_KEY3        = '4ea63ec2-cc07-4855-98e9-37cece4bd3ff';
        const OKX_SECRET3     = 'CB2465C6DBB02286A8427B1CE9EFAEAC';
        const OKX_PASSPHRASE3 = 'ak01ALim@';

        // Helper: HMAC-SHA256 signed OKX GET request
        async function _okxSignedGet(path) {
          const ts  = new Date().toISOString().replace(/(\d{3})Z$/, '000Z');
          const ph  = ts + 'GET' + path;
          const kb  = new TextEncoder().encode(OKX_SECRET3);
          const mb  = new TextEncoder().encode(ph);
          const ck  = await crypto.subtle.importKey('raw', kb, {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
          const sg  = await crypto.subtle.sign('HMAC', ck, mb);
          const sig = btoa(String.fromCharCode(...new Uint8Array(sg)));
          return window.oneSignedFetch('https://www.okx.com' + path, {
            ms: 15000,
            headers: {
              'OK-ACCESS-KEY': OKX_KEY3, 'OK-ACCESS-SIGN': sig,
              'OK-ACCESS-TIMESTAMP': ts, 'OK-ACCESS-PASSPHRASE': OKX_PASSPHRASE3,
              'Content-Type': 'application/json'
            }
          });
        }

        // Step 1: Fetch correct spender address from OKX /approve-transaction
        // OKX uses a SEPARATE approve contract (dexContractAddress) that differs from
        // the swap router (tx.to). Approving the wrong address causes on-chain revert.
        let _oApproveAddr = null;
        if (_oFrom && _oFrom.toLowerCase() !== '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
          try {
            const _appPath = `/api/v6/dex/aggregator/approve-transaction?chainIndex=${_oci}&tokenContractAddress=${_oFrom}&approveAmount=${_oAmt}`;
            const _appResp = await _okxSignedGet(_appPath);
            if (_appResp.ok) {
              const _appJson = await _appResp.json();
              if (_appJson.code === '0' && _appJson.data?.[0]?.dexContractAddress) {
                _oApproveAddr = _appJson.data[0].dexContractAddress;
              }
            }
          } catch(_) { /* non-fatal — fallback to tx.to below */ }
        }

        // Step 2: Fetch swap calldata
        const _oQuery = `chainIndex=${_oci}&amount=${_oAmt}&fromTokenAddress=${_oFrom}&toTokenAddress=${_oTo}&slippagePercent=${_oSlip}&userWalletAddress=${_oWallet}&swapMode=exactIn` + _oDexId;
        const _oPath  = '/api/v6/dex/aggregator/swap?' + _oQuery;
        const _oResp  = await _okxSignedGet(_oPath);
        if (!_oResp.ok) throw new Error('OKX /swap HTTP ' + _oResp.status);
        const _oJson = await _oResp.json();
        if (_oJson.code !== '0' || !_oJson.data?.[0]) throw new Error('OKX swap error: ' + (_oJson.msg || _oJson.code));
        const _oStx = _oJson.data[0].tx;
        const _okxZeroSw = '0x0000000000000000000000000000000000000000';
        if (!_oStx?.to || _oStx.to.toLowerCase() === _okxZeroSw || !_oStx?.data) throw new Error('OKX did not return valid tx calldata.');
        let _oVal = '0x0';
        try {
          const _sv = String(_oStx.value || '0').trim();
          if (_sv && _sv !== '0' && _sv !== '0x0') _oVal = _sv.startsWith('0x') ? _sv : '0x' + BigInt(_sv).toString(16);
        } catch(_) {}
        swapTxData = {
          to: _oStx.to, data: _oStx.data, value: _oVal,
          gas: _oStx.gas ? Number(_oStx.gas) : 350000,
          source: 'okxdex',
          outputWei: swapTxData.outputWei,
          // Use approve contract from /approve-transaction (correct spender),
          // fallback to tx.to if the API call failed
          allowanceTarget: _oApproveAddr || _oStx.to,
        };
      } catch(_oErr) {
        _nxsw_swShowToast('⚠️ OKX TX build failed: ' + (_oErr.message || 'unknown error'));
        _nxsw__swBtnRestore();
        return;
      }
    }

    // ── Init provider + signer ──
    const rpcProvider = await _getSwapProvider(chainId);

    if (!rpcProvider) {
      _nxsw_swShowToast('❌ No RPC available for this network.');
      _nxsw__swBtnRestore();
      return;
    }

    const normalizedPK = SW.walletPK.startsWith('0x') ? SW.walletPK : '0x' + SW.walletPK;
    const signer    = new ethers.Wallet(normalizedPK, rpcProvider);
    const walletAddr = SW.walletAddress;

    // ── Safety: verify PK derives same address as selected wallet ──
    if (signer.address.toLowerCase() !== walletAddr.toLowerCase()) {
      _nxsw_swShowToast('❌ Wallet key mismatch. Please re-select your wallet.');
      _nxsw__swBtnRestore();
      return;
    }

    // ── Final safety guard: if swapTxData still has unresolved placeholder ──
    const _swZero = '0x0000000000000000000000000000000000000000';
    const _swFakeTo = ['0x0000000000000000000000000000000000000001'];
    if (!swapTxData.to || swapTxData.to.toLowerCase() === _swZero || _swFakeTo.includes(swapTxData.to.toLowerCase()) || !swapTxData.data || swapTxData.data === '0x' || swapTxData.data === '0x00') {
      _nxsw_swShowToast('⚠️ Route not ready. Please wait for quote or try a different router.');
      _nxsw__swBtnRestore();
      return;
    }

    // ── SAFETY: calldata must contain walletAddr (swap recipient = self) ──
    // Prevents rogue/corrupted API response sending output to wrong address
    // NOTE: OKX DEX calldata uses internal encoding — wallet addr not always in plain hex.
    //       OKX already takes userWalletAddress param in API call, so skip check for okxdex.
    const _swCalldataLow = (swapTxData.data || '').toLowerCase();
    const _swSelfAddr    = walletAddr.slice(2).toLowerCase();
    const _swSkipAddrCheck = swapTxData.source === 'okxdex';
    if (!_swSkipAddrCheck && swapTxData.data && swapTxData.data.length > 10 && !_swCalldataLow.includes(_swSelfAddr)) {
      _nxsw_swShowToast('❌ SAFETY: Wallet address not found in swap calldata. Swap aborted.');
      _nxsw__swBtnRestore();
      return;
    }

    // ⚠️ 0x v2: allowanceTarget is the AllowanceHolder contract — NEVER approve .to (Settler)
    // For other DEXes: allowanceTarget may be null → fallback to .to (router)
    const spender = swapTxData.allowanceTarget || swapTxData.to;

    // ── Step 1: Approve if ERC20 ──
    if (!isFromNative && fromAddr && fromAddr.toLowerCase() !== NATIVE.toLowerCase()) {
      try {
        _swBtnLoading('Checking allowance…');
        const erc20 = new ethers.Interface([
          'function allowance(address,address) view returns(uint256)',
          'function approve(address,uint256) returns(bool)'
        ]);
        let needsApprove = true;
        try {
          const allowanceData = erc20.encodeFunctionData('allowance', [walletAddr, spender]);
          const allowanceHex  = await _nxsw__swWithFallback(chainId, _p => _p.call({ to: fromAddr, data: allowanceData }));
          if (allowanceHex && allowanceHex !== '0x') {
            needsApprove = BigInt(allowanceHex) < BigInt(amountWei);
          }
        } catch(_) { needsApprove = true; }

        if (needsApprove) {
          _swBtnLoading('Approving…');
          window._txpSetStep && _txpSetStep('approve', 'Approving Token…');
          const approveData = erc20.encodeFunctionData('approve', [spender, ethers.MaxUint256]);

          // ── Sponsor approve on Base chain if paymaster enabled ──
          const _approveUsePaymaster = chainId === 8453
            && typeof sendSwapViaUserOp === 'function'
            && (typeof isSwapPaymasterEnabled === 'function' ? isSwapPaymasterEnabled() : isPaymasterEnabled());
          let _approveSponsored = false;
          if (_approveUsePaymaster) {
            try {
              _swBtnLoading('⛽ Sponsoring approve…');
              await sendSwapViaUserOp(signer, { to: fromAddr, value: '0x0', data: approveData }, rpcProvider, () => {});
              _approveSponsored = true;
              _swBtnLoading('✅ Approved (gasless)');
              window._txpSetStep && _txpSetStep('send', 'Approved gasless! Sending swap…');
            } catch (_appPmErr) {
              _swBtnLoading('⚠️ Sponsor approve failed, using wallet gas…');
              await new Promise(r => setTimeout(r, 400));
            }
          }
          if (!_approveSponsored) {
            // ── Use OneGas EIP-1559 → Legacy fallback for approve ──
            const approveTxBase = { to: fromAddr, data: approveData, value: BigInt(0), chainId };
            const approveTx = await window.OneGas.sendWithFallback(
              signer, rpcProvider, approveTxBase,
              (msg) => { _swBtnLoading(msg.slice(0, 40)); }
            );
            _swBtnLoading('Waiting for approval…');
            window._txpSetStep && _txpSetStep('send', 'Approval sent, waiting…');
            try {
              await Promise.race([approveTx.wait(1), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 30000))]);
            } catch(_) {
              await new Promise(r => setTimeout(r, 3000));
            }
            window._txpSetStep && _txpSetStep('send', 'Approved! Sending swap…');
          }
        }
      } catch(e) {
        console.error('[One Approve] error:', e);
        const _approveErr = (e?.reason || e?.shortMessage || e?.message || 'Approve failed');
        // User rejected or TX failed — stop, don't send swap
        if (_approveErr.toLowerCase().includes('user rejected') || _approveErr.toLowerCase().includes('denied') || _approveErr.toLowerCase().includes('cancel')) {
          _nxsw_swShowToast('❌ Approval cancelled.');
        } else {
          _nxsw_swShowToast('❌ Approve failed: ' + _approveErr.slice(0, 60));
        }
        _nxsw__swBtnRestore();
        if (typeof window._txpClose === 'function') window._txpClose();
        return;
      }
    }

    // ── Step 2: Send swap TX using cached data ──
    try {
      _swBtnLoading(`Swapping via ${sourceName}…`);

      // Open premium TX progress overlay
      if (typeof window._txpOpen === 'function') {
        const fromIconEl = document.getElementById('sw-conf-from-icon');
        const toIconEl   = document.getElementById('sw-conf-to-icon');
        _txpOpen({
          fromAmt:      fromAmt,
          fromSym:      fromSym,
          fromIconBg:   fromIconEl ? fromIconEl.style.background : '',
          fromIconText: fromIconEl ? fromIconEl.textContent : fromSym[0],
          toAmt:        SW.toAmount,
          toSym:        toSym,
          toIconBg:     toIconEl   ? toIconEl.style.background   : '',
          toIconText:   toIconEl   ? toIconEl.textContent : toSym[0],
        });
        _txpSetStep('send', `Sending via ${sourceName}…`);
      }

      let gasLimit = BigInt(swapTxData.gas || 300000);
      try {
        const estimated = await _nxsw__swWithFallback(chainId, _p => _p.estimateGas({ from:walletAddr, to:swapTxData.to, data:swapTxData.data, value:BigInt(swapTxData.value||'0') }));
        const withBuffer = estimated * BigInt(130) / BigInt(100);
        if (withBuffer > gasLimit) gasLimit = withBuffer;
      } catch(_estimateErr) {
        // ✅ FIX: detect on-chain revert during gas estimation — warn user instead of silent submit
        const _em = ((_estimateErr?.reason || _estimateErr?.message || '') + '').toLowerCase();
        if (_em.includes('revert') || _em.includes('execution reverted') || _em.includes('call_exception') || _em.includes('insufficient')) {
          if(window._swLog) window._swLog(swapTxData.source || 'Swap', 'WARN', 'estimateGas revert: ' + _em.slice(0, 80));
          _nxsw_swShowToast('⚠️ Swap may fail on-chain. Check allowance or try a different route.');
        }
        // Still proceed with fallback gasLimit — node estimates can be overly pessimistic
      }

      // ── Parse value safely — 0x API returns decimal string, others may return hex ──
      let _swapValue = 0n;
      try {
        const _rawV = swapTxData.value;
        if (_rawV && _rawV !== '0' && _rawV !== '0x0' && _rawV !== '0x00') {
          _swapValue = typeof _rawV === 'bigint' ? _rawV
            : String(_rawV).startsWith('0x') ? BigInt(String(_rawV))
            : BigInt(String(_rawV));
        }
      } catch(_) { _swapValue = 0n; }
      // ── Native ETH safety: if selling ETH but value=0, use amountWei ──
      // Prevents accidental 0-value TX if API omits value field for ETH input
      if (isFromNative && _swapValue === 0n) {
        try { _swapValue = BigInt(amountWei); } catch(_) {}
      }

      // ── Paymaster sponsor: Base chain only, respects swap-specific toggle ──
      const _swUsePaymaster = chainId === 8453
        && typeof sendSwapViaUserOp === 'function'
        && (typeof isSwapPaymasterEnabled === 'function' ? isSwapPaymasterEnabled() : isPaymasterEnabled());

      let tx;
      let _swSponsoredOk = false;

      if (_swUsePaymaster) {
        try {
          _swBtnLoading('⛽ Sponsoring swap…');
          if (typeof _txpSetStep === 'function') _txpSetStep('send', '⛽ Trying gasless sponsor…');
          const _pmTxReq = { to: swapTxData.to, data: swapTxData.data, value: '0x' + _swapValue.toString(16), gasLimit: swapTxData.gas };
          // Pass hintGasLimit for LI.FI routes — they use complex multi-hop paths that
          // need more gas than the default 500k minimum to avoid AA95/OOG reverts.
          const _pmHintGas = swapTxData.source === 'lifi' ? BigInt(Math.ceil((swapTxData.gas || 500000) * 1.3)) : undefined;
          const pmResult = await sendSwapViaUserOp(signer, _pmTxReq, rpcProvider, () => {}, _pmHintGas);
          SW._lastTxHash = pmResult.txHash;
          _swSponsoredOk = true;
          // Build a mock tx-like object for the confirmation flow below
          tx = { hash: pmResult.txHash, wait: async () => pmResult.receipt?.receipt || {} };
          if (typeof _txpSetStep === 'function') _txpSetStep('confirm', '✅ Sponsored! Confirming…');
        } catch (_pmSwErr) {
          // Fallback to normal gas
          _swBtnLoading('⚠️ Sponsor failed, using wallet gas…');
          if (typeof _txpSetStep === 'function') _txpSetStep('send', `Sending via ${sourceName}…`);
          await new Promise(r => setTimeout(r, 500));
        }
      }

      if (!_swSponsoredOk) {
        // ── Use OneGas EIP-1559 → Legacy fallback for swap ──
        const swapTxBase = {
          to:      swapTxData.to,
          data:    swapTxData.data,
          value:   _swapValue,
          gasLimit,
          chainId,
        };
        tx = await window.OneGas.sendWithFallback(
          signer, rpcProvider, swapTxBase,
          (msg) => {
            _swBtnLoading(msg.slice(0, 40));
            if (typeof _txpSetStep === 'function') {
              if (msg.includes('EIP-1559') || msg.includes('Legacy') || msg.includes('Submitted'))
                _txpSetStep('send', msg.slice(0, 60));
            }
          }
        );
        SW._lastTxHash = tx.hash;
      }

      // Update progress to confirming step
      if (typeof _txpSetStep === 'function') _txpSetStep('confirm', 'Waiting for confirmation…');
      _swBtnLoading('Confirming on-chain…');

      // ── Wait for on-chain confirmation & check status — fallback across all RPCs ──
      let receipt = null;
      if (_swSponsoredOk) {
        // UserOp already confirmed by bundler — skip polling
        receipt = { status: 1 };
      } else {
      try {
        // Primary: try waitForTransaction via _swWithFallback (each RPC polled with timeout)
        receipt = await _nxsw__swWithFallback(chainId, _p => _p.waitForTransaction(tx.hash, 1, 60000), 65000);
      } catch(_) {
        // Secondary: try tx.wait(1) — signer's provider may differ from rpcProvider
        try { receipt = await tx.wait(1); } catch(__) {
          // Tertiary: manual poll — getTransactionReceipt with fallback RPCs
          try {
            receipt = await _nxsw__swWithFallback(chainId, async _p => {
              for (let _i = 0; _i < 20; _i++) {
                const _r = await _p.getTransactionReceipt(tx.hash);
                if (_r) return _r;
                await new Promise(_res => setTimeout(_res, 3000));
              }
              return null;
            }, 65000);
          } catch(___) {}
        }
      }
      }

      // receipt.status: 1 = success, 0 = reverted
      const txFailed = receipt && receipt.status === 0;

      if (txFailed) {
        if (typeof window.swCloseConfirm === 'function') window.swCloseConfirm();
        if (typeof window._txpClose === 'function') window._txpClose();
        _nxsw__swBtnRestore();
        _swResetAmount();
        _swShowFailOverlay(fromAmt, SW.toAmount, fromSym, toSym, sourceName, 'Transaction reverted on-chain');
      } else {
        // ✅ SUCCESS (confirmed or unconfirmed but not reverted)
        if (typeof _txpSetStep === 'function') _txpSetStep('confirm', _swSponsoredOk ? '✅ Confirmed! Gas sponsored ⛽' : 'Confirmed!');
        _swRecordAndReset(fromAmt, SW.toAmount, _swRouteLabel, true);
      }

    } catch(e) {
      console.error('[One Swap TX] error:', e);
      // ❌ FAIL — close confirm + show fail overlay
      if (typeof window.swCloseConfirm === 'function') window.swCloseConfirm();
      if (typeof window._txpClose === 'function') window._txpClose();
      _nxsw__swBtnRestore();
      _swResetAmount();
      const errMsg = (e && e.reason) || (e && e.message) || 'Transaction failed';
      const shortErr = errMsg.length > 60 ? errMsg.slice(0, 57) + '…' : errMsg;
      _swShowFailOverlay(fromAmt, SW.toAmount, fromSym, toSym, sourceName, shortErr);
    }

  } catch(outerErr) {
    console.error('[One Swap] error:', outerErr);
    if (typeof window.swCloseConfirm === 'function') window.swCloseConfirm();
    if (typeof window._txpClose === 'function') window._txpClose();
    _nxsw__swBtnRestore();
    _swResetAmount();
    const errMsg = (outerErr && outerErr.reason) || (outerErr && outerErr.message) || 'Swap failed';
    const shortErr = errMsg.length > 60 ? errMsg.slice(0, 57) + '…' : errMsg;
    _swShowFailOverlay(parseFloat(SW.fromAmount)||0, SW.toAmount||0, fromSym||'?', toSym||'?', 'DEX', shortErr);
  } finally {
    window.swRunning = false;
    if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txEnd(); // BG: release wake lock
    if (typeof window._updateAllToolBadges === 'function') window._updateAllToolBadges();
    if (typeof window._bgPillUpdate === 'function') window._bgPillUpdate();
    setTimeout(() => {
      const btn = document.getElementById('sw-action-btn');
      if (btn && btn.style.cursor === 'not-allowed') _nxsw__swBtnRestore();
    }, 15000);
  }
}