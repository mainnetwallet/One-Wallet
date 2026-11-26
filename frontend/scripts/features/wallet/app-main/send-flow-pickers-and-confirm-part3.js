
// ── Open Confirm Bottom Sheet ──
async function openSendConfirmSheet() {
  const to  = document.getElementById('send-to')?.value.trim();
  const _amtEl2 = document.getElementById('send-amount');
  let   amt = (_amtEl2?.dataset?.fullVal?.trim()) || (_amtEl2?.value?.trim()) || '';
  const tok = getSendTokenInfo(sendSelectedToken);
  if (!tok || !to || !amt) return;

  // Was native MAX clicked?
  const nativeTok = loadSavedTokens().find(t => (t.chainId || 8453) === sendSelectedChainId && t.isNative);
  const nativeId  = nativeTok ? nativeTok.id : 'eth';
  const isNative  = (sendSelectedToken === 'eth' || sendSelectedToken === nativeId);
  const isNativeMax = window._sendMaxIsNative && isNative;
  // ── Do NOT consume _sendMaxIsNative here — keep it alive so re-opening the sheet
  //    (after close → SEND again) still runs gas estimation correctly.
  //    Flag is only cleared when the user manually edits the amount (onSendAmountInput).
  window._executeSendIsNativeMax = isNativeMax; // pass to executeSend for final recalc

  // Populate sheet details (initial values)
  const amtEl  = document.getElementById('csheet-amount');
  const usdEl  = document.getElementById('csheet-usd');
  const fromEl = document.getElementById('csheet-from');
  const toEl   = document.getElementById('csheet-to');
  const netEl  = document.getElementById('csheet-network');
  const gasEl  = document.getElementById('csheet-gas');

  if (amtEl) amtEl.textContent = _fmtBalDisplay(parseFloat(amt)) + ' ' + tok.symbol;
  const usdRaw = document.getElementById('send-amount-usd')?.textContent || '≈ $0.00';
  if (usdEl) usdEl.textContent = usdRaw;
  if (fromEl && sendWallet) {
    const addr = sendWallet.address;
    fromEl.textContent = addr.slice(0,8) + '…' + addr.slice(-6);
  }
  if (toEl) toEl.textContent = to.slice(0,10) + '…' + to.slice(-8);
  const chainName = (getAllChains().find(c => c.chainId === sendSelectedChainId)?.name) || 'Unknown';
  if (netEl) netEl.textContent = chainName;
  if (gasEl) gasEl.textContent = 'Estimating…';

  // Open sheet first so the user sees it immediately
  const overlay = document.getElementById('send-confirm-overlay');
  const sheet   = document.getElementById('send-confirm-sheet');

  // ── Always reset confirm btn to original state on open ──
  const _cBtnReset = document.getElementById('confirm-send-btn');
  if (_cBtnReset) {
    _cBtnReset.style.cssText = [
      'width:100%','padding:16px',
      'background:linear-gradient(135deg,#f59e0b,#d97706)',
      'border:none','border-radius:var(--radius-md)',
      'font-family:var(--font-display)','font-size:14px','font-weight:700',
      'color:#fff','letter-spacing:0.5px','cursor:pointer',
      'transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      'box-shadow:0 0 24px rgba(245,158,11,0.35),0 4px 16px rgba(0,0,0,0.4)',
      'display:flex','align-items:center','justify-content:center','gap:8px',
      'opacity:1'
    ].join(';');
    _cBtnReset.disabled = false;
    _cBtnReset.innerHTML = '<span class="material-icons-round" style="font-size:18px;">rocket_launch</span> CONFIRM &amp; SEND';
    _cBtnReset.onclick = confirmAndSend;
  }
  if (overlay) {
    overlay.style.display = '';
    overlay.style.pointerEvents = 'auto';
    overlay.style.background    = 'rgba(0,0,0,0.6)';
    overlay.style.backdropFilter = 'blur(4px)';
    overlay.style.webkitBackdropFilter = 'blur(4px)';
  }
  if (sheet) sheet.style.transform = 'translateX(-50%) translateY(0%)';
  haptic && haptic();

  // ── Check delegation (Base only) — if sponsored skip gas estimation entirely ──
  if (sendSelectedChainId === 8453 && sendWallet) {
    isDelegated(sendWallet.address).then(delegated => {
      if (delegated) {
        if (gasEl) { gasEl.textContent = '✨ FREE (Sponsored)'; gasEl.style.color = 'var(--accent-green)'; }
        // Sponsored: gas is FREE — use full raw balance for native MAX (no gas deduction)
        if (isNativeMax && isNative) {
          const _nativeTokSp = loadSavedTokens().find(t => (t.chainId || 8453) === sendSelectedChainId && t.isNative);
          const _nativeIdSp  = _nativeTokSp ? _nativeTokSp.id : 'eth';
          const _rawBalSp    = parseFloat(sendBalances[sendSelectedToken] || sendBalances[_nativeIdSp] || 0);
          if (_rawBalSp > 0) {
            window._nativeMaxFinalAmt = _rawBalSp;  // full balance — paymaster pays gas
            const _spAmtInp = document.getElementById('send-amount');
            if (_spAmtInp) { _spAmtInp.value = _fmtAmtInput(_rawBalSp); _spAmtInp.dataset.fullVal = String(_rawBalSp); }
            if (amtEl) amtEl.textContent = _fmtAmtInput(_rawBalSp) + ' ' + tok.symbol;
            onSendAmountInput();
          }
        }
      } else {
        // Not sponsored — run normal gas estimation
        _runGasEstimation();
      }
    }).catch(() => {
      _runGasEstimation();
    });
  } else {
    _runGasEstimation();
  }

  async function _runGasEstimation() {
    // ── Gas estimation — always runs for native tokens to show live gas fee ──
    // Amount is only updated when isNativeMax (MAX button was clicked)
    if (!isNative) {
      // ERC-20 send: gas paid in native, just show estimate without touching amount
      estimateSendGas(to, parseFloat(amt));
      return;
    }

    // Ensure provider is ready
    let provider = sendProvider;
    if (!provider) {
      try { provider = await getSendProvider(); sendProvider = provider; } catch (_) {}
    }
    if (!provider || !sendWallet) {
      // Can't estimate live gas — fall back, keep pre-buffered amount from setSendMax
      estimateSendGas(to, parseFloat(amt));
      return;
    }

    try {
      const rawBal = parseFloat(sendBalances[sendSelectedToken] || sendBalances[nativeId] || 0);
      if (rawBal <= 0) throw new Error('zero_balance');

      // ── Estimate gas units ──
      let gasUnits;
      try {
        gasUnits = await _withRpcFallback(sendSelectedChainId, _p => _p.estimateGas({ from: sendWallet.address, to, value: 1n }));
      } catch (_) {
        gasUnits = 21000n;
      }

      // ── Gas price: respect OneGasMode (auto → EIP-1559 if supported, else legacy) ──
      const _gasMode     = window.OneGasMode || 'auto';
      const _forceLegacy = _gasMode === 'legacy';
      let gpBig;
      let _usingEIP1559  = false;
      let _gasModeLabel  = '⛽ Legacy';

      if (!_forceLegacy && window.OneGas) {
        const _isEIP1559 = await window.OneGas.detectEIP1559(provider);
        if (_isEIP1559 || _gasMode === 'eip1559') {
          try {
            const fees = await window.OneGas.buildEIP1559Fees(provider);
            // Use maxFeePerGas for worst-case reserve calculation
            gpBig         = fees.maxFeePerGas;
            _usingEIP1559 = true;
            _gasModeLabel = '⚡ EIP-1559';
          } catch (_) {
            // EIP-1559 build failed — fall through to legacy
          }
        }
      }

      if (!gpBig && window.OneGas) {
        try {
          const legacyFees = await window.OneGas.buildLegacyFees(provider);
          gpBig = legacyFees.gasPrice;
        } catch (_) {}
      }

      // Final fallback: plain getFeeData
      if (!gpBig) {
        const _fd = await _withRpcFallback(sendSelectedChainId, _p => _p.getFeeData());
        const _gp = _fd.maxFeePerGas || _fd.gasPrice || 1000000000n;
        gpBig = typeof _gp === 'bigint' ? _gp : BigInt(Math.ceil(Number(_gp)));
      }

      // ── Calculate: raw fee + 20% safety buffer ──
      const gasFeeWei  = gasUnits * gpBig;
      const reserveWei = gasFeeWei * 120n / 100n;          // gas * 1.2
      const gasCostEth = parseFloat(ethers.formatEther(gasFeeWei));
      const reserveEth = parseFloat(ethers.formatEther(reserveWei));

      // ── freshMax = what user can safely send ──
      const freshMax = Math.max(0, rawBal - reserveEth);

      if (freshMax <= 0) {
        if (gasEl) { gasEl.textContent = '⚠️ Insufficient for gas'; gasEl.style.color = 'var(--accent-red)'; }
        if (amtEl) amtEl.textContent = '0 ' + tok.symbol;
        return;
      }

      // ── Only update amount fields when MAX was clicked ──
      if (isNativeMax) {
        // Store gas-adjusted amount so executeSend uses exact same value
        window._nativeMaxFinalAmt = freshMax;

        const sendAmtInput = document.getElementById('send-amount');
        if (sendAmtInput) {
          sendAmtInput.value           = _fmtAmtInput(freshMax);
          sendAmtInput.dataset.fullVal = String(freshMax);
        }
        onSendAmountInput();

        if (amtEl) {
          const dispStr = freshMax.toLocaleString(undefined, { maximumFractionDigits: 8 });
          amtEl.textContent = dispStr + ' ' + tok.symbol;
        }

        const freshUsd = document.getElementById('send-amount-usd')?.textContent || '';
        if (usdEl && freshUsd) usdEl.textContent = freshUsd;
      }

      // ── Show gas fee: native token amount + USD value + gas mode ──
      const _nativeSym   = tok.symbol || 'ETH';
      const _symUpper    = _nativeSym.toUpperCase();
      // Resolve USD price for this native token
      const _nativeUsdPrice = sendPrices[_symUpper] || sendPrices['ETH'] || 0;
      const _gasCostUsd  = _nativeUsdPrice > 0
        ? '≈ $' + (gasCostEth * _nativeUsdPrice).toFixed(4)
        : '';
      const gasCostDisplay = _gasCostUsd
        ? _gasCostUsd.trim() + ' · ' + _gasModeLabel
        : '~' + gasCostEth.toFixed(6) + ' ' + _nativeSym + ' · ' + _gasModeLabel;
      if (gasEl) { gasEl.textContent = gasCostDisplay; gasEl.style.color = _usingEIP1559 ? 'var(--neon-cyan)' : ''; }
      const rg = document.getElementById('review-gas'); if (rg) rg.textContent = gasCostDisplay;

    } catch (_gasErr) {
      // Estimation failed — keep pre-buffered amount, show fallback gas estimate
      estimateSendGas(to, parseFloat(document.getElementById('send-amount')?.value || amt));
    }
  }
}
function closeSendConfirmSheet() {
  const overlay = document.getElementById('send-confirm-overlay');
  const sheet = document.getElementById('send-confirm-sheet');
  if (overlay) {
    overlay.style.pointerEvents = 'none';
    overlay.style.background = 'rgba(0,0,0,0)';
    overlay.style.backdropFilter = 'blur(0px)';
    overlay.style.webkitBackdropFilter = 'blur(0px)';
    // Fully hide after transition so it doesn't block the success card
    setTimeout(() => { overlay.style.display = 'none'; }, 400);
  }
  if (sheet) sheet.style.transform = 'translateX(-50%) translateY(110%)';
}

async function confirmAndSend() {
  closeSendConfirmSheet();
  // Small delay for sheet close animation, then execute
  setTimeout(() => executeSend(), 320);
}

async function executeSend() {
  if (!sendWallet || !sendProvider) return;
  window.sendRunning = true;
  if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txStart(); // BG: wake lock + audio
  if (typeof window._updateAllToolBadges === 'function') window._updateAllToolBadges();
  const walletDelegated = (typeof window.walletDelegated !== 'undefined') ? window.walletDelegated : false;
  const to  = document.getElementById('send-to')?.value.trim();
  const _amtEl = document.getElementById('send-amount');
  let   amt = (_amtEl?.dataset?.fullVal?.trim()) || (_amtEl?.value?.trim()) || '';
  const tok = getSendTokenInfo(sendSelectedToken);
  if (!tok) {
    _setStatus('❌ Token info not found for: ' + sendSelectedToken + '. Please re-select the token.', 'error');
    if (cBtn) { cBtn.innerHTML = '<span class="material-icons-round">send</span> RETRY SEND'; cBtn.disabled = false; cBtn.onclick = confirmAndSend; }
    return;
  }
  // Guard: ERC-20 must have a contract address
  if (!tok.native && !tok.contract) {
    _setStatus('❌ Missing contract address for ' + (tok.symbol || sendSelectedToken) + '. Remove and re-add this token.', 'error');
    if (cBtn) { cBtn.innerHTML = '<span class="material-icons-round">send</span> RETRY SEND'; cBtn.disabled = false; cBtn.onclick = confirmAndSend; }
    return;
  }

  // ── SAFETY: validate TO address before any tx ──
  if (!to || !ethers.isAddress(to)) {
    _setStatus('❌ Invalid recipient address. Please re-enter.', 'error');
    if (cBtn) { cBtn.innerHTML = '<span class="material-icons-round">send</span> RETRY SEND'; cBtn.disabled = false; cBtn.onclick = confirmAndSend; }
    window.sendRunning = false;
    if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txEnd();
    return;
  }
  if (to.toLowerCase() === '0x0000000000000000000000000000000000000000') {
    _setStatus('❌ Cannot send to zero address.', 'error');
    if (cBtn) { cBtn.innerHTML = '<span class="material-icons-round">send</span> RETRY SEND'; cBtn.disabled = false; cBtn.onclick = confirmAndSend; }
    window.sendRunning = false;
    if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txEnd();
    return;
  }

  // ── Native MAX: use the exact amount calculated by _runGasEstimation in the confirm sheet ──
  if (tok.native && window._executeSendIsNativeMax) {
    window._executeSendIsNativeMax = false;

    // Priority 1: use the amount already computed & shown in csheet (gas * 1.2 buffer)
    if (window._nativeMaxFinalAmt && window._nativeMaxFinalAmt > 0) {
      amt = _fmtAmtInput(window._nativeMaxFinalAmt);
      window._nativeMaxFinalAmt = null;

    } else {
      // Priority 2: freshly recalculate if confirm was tapped before estimation finished
      try {
        const nativeTok2 = loadSavedTokens().find(t => (t.chainId || 8453) === sendSelectedChainId && t.isNative);
        const nativeId2  = nativeTok2 ? nativeTok2.id : 'eth';
        const rawBal2    = parseFloat(sendBalances[sendSelectedToken] || sendBalances[nativeId2] || 0);

        if (rawBal2 <= 0) throw new Error('balance_zero');

        let gasUnits2;
        try {
          gasUnits2 = await _withRpcFallback(sendSelectedChainId, _p => _p.estimateGas({ from: sendWallet.address, to, value: 1n }));
        } catch (_) { gasUnits2 = 21000n; }

        const feeData2  = await _withRpcFallback(sendSelectedChainId, _p => _p.getFeeData());
        const gasPrice2 = feeData2.maxFeePerGas || feeData2.gasPrice || 1000000000n;
        const gpBig2    = typeof gasPrice2 === 'bigint' ? gasPrice2 : BigInt(Math.ceil(Number(gasPrice2)));

        // ── Sponsored check: Base + paymaster → gas is FREE, use full balance ──
        const _isBaseSponsored2 = sendSelectedChainId === 8453
          && typeof sendSwapViaUserOp === 'function'
          && (typeof isPaymasterEnabled === 'function' ? isPaymasterEnabled() : true);

        let safeMax2;
        if (_isBaseSponsored2) {
          // Paymaster pays gas — no deduction needed, use full raw balance
          safeMax2 = rawBal2;
        } else {
          const reserveWei2 = gasUnits2 * gpBig2 * 120n / 100n;   // gas fee + 20% buffer
          const reserveEth2 = parseFloat(ethers.formatEther(reserveWei2));
          safeMax2 = Math.max(0, rawBal2 - reserveEth2);
        }

        if (safeMax2 <= 0) throw new Error('insufficient funds for gas');

        amt = _fmtAmtInput(safeMax2);
        const inp = document.getElementById('send-amount');
        if (inp) { inp.value = amt; inp.dataset.fullVal = String(safeMax2); }

      } catch (nativeMaxErr) {
        // Priority 3: fall back to pre-buffered value from setSendMax (_getSendMaxBal - 0.0005)
        console.warn('[NativeMAX] fallback to pre-buffered amt:', nativeMaxErr.message);
      }
    }
  }


  // ── All UI updates go inside the confirm sheet ──
  const cBtn     = document.getElementById('confirm-send-btn');

  const cGasEl   = document.getElementById('csheet-gas');
  // Keep send-btn reference for RETRY state only
  const sendBtn  = document.getElementById('send-btn');

  const _setStatus = (msg, type) => {
    // ── send-btn: only show error state (with RETRY). pending/success handled by success card. ──
    if (sendBtn && type === 'error') {
      const plainMsg = msg.replace(/<[^>]*>/g, '').trim().split('\n')[0].slice(0, 80);
      sendBtn.classList.remove('sending','confirming');
      sendBtn.style.opacity       = '1';
      sendBtn.style.background    = 'linear-gradient(135deg,var(--accent-red),#be123c)';
      sendBtn.style.boxShadow     = '0 0 24px rgba(244,63,94,0.45),0 4px 16px rgba(0,0,0,0.4)';
      sendBtn.style.transition    = 'all 0.35s ease';
      sendBtn.style.minHeight     = '52px';
      sendBtn.style.flexDirection = 'column';
      sendBtn.style.gap           = '4px';
      sendBtn.style.padding       = '12px 16px';
      sendBtn.disabled            = false;
      sendBtn.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="material-icons-round" style="font-size:18px;">error_outline</span>
          <span style="font-family:var(--font-mono);font-size:11px;font-weight:700;letter-spacing:0.5px;">${plainMsg}</span>
        </div>
        <span style="font-family:var(--font-mono);font-size:9px;opacity:0.75;letter-spacing:0.5px;">TAP TO RETRY</span>
      `;
      sendBtn.onclick = () => { openSendConfirmSheet(); };

      // ── Auto-reset after 2s ──
      setTimeout(() => {
        if (!sendBtn) return;
        sendBtn.classList.remove('sending','confirming');
        sendBtn.style.cssText = '';
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<span class="material-icons-round">send</span> SEND';
        sendBtn.onclick = () => { openSendConfirmSheet(); };
      }, 2000);
    }
  };
  const _setBtn = (html, disabled) => {
    if (!cBtn) return;
    cBtn.innerHTML = html;
    cBtn.disabled  = !!disabled;
  };

  _setBtn('<span class="del-spinner"></span> SENDING…', true);

  // ── Helper: update send-btn with step info ──
  const _setSendBtnStep = (step, sub) => {
    if (!sendBtn) return;
    sendBtn.disabled = true;
    sendBtn.classList.remove('sending','confirming');
    sendBtn.classList.add(step === 'confirming' ? 'confirming' : 'sending');
    sendBtn.style.cssText = '';
    sendBtn.innerHTML = `
      <div class="send-btn-step">
        <span class="del-spinner" style="width:14px;height:14px;border-width:2px;flex-shrink:0;"></span>
        ${step === 'confirming' ? 'CONFIRMING…' : 'SENDING…'}
      </div>
      <div class="send-btn-sub">${sub || ''}</div>
    `;
  };
  _setSendBtnStep('sending', 'Preparing transaction…');
  haptic();

  try {
    // ── Step 1: Build txReq ──
    // Sanitize amt: ethers.parseUnits cannot handle scientific notation (e.g. 1.23e-8)
    // Convert to plain decimal string, capped at token decimals to avoid "too many decimals" error
    const _sanitizeAmt = (amtStr, decimals) => {
      const num = parseFloat(amtStr);
      if (!isFinite(num) || num <= 0) return '0';
      // If already plain decimal, use it; otherwise convert from scientific notation
      if (!amtStr.includes('e') && !amtStr.includes('E')) {
        // Still truncate to token decimals to be safe
        const parts = amtStr.split('.');
        if (parts[1] && parts[1].length > decimals) {
          return parts[0] + '.' + parts[1].slice(0, decimals);
        }
        return amtStr;
      }
      return num.toFixed(decimals).replace(/\.?0+$/, '') || '0';
    };
    amt = _sanitizeAmt(amt, tok.decimals || 18);

    let txReq;
    if (tok.native) {
      txReq = { to, value: ethers.parseEther(amt) };
    } else {
      const iface = new ethers.Interface(ERC20_SEND_ABI);
      txReq = {
        to: tok.contract, value: 0n,
        data: iface.encodeFunctionData('transfer', [to, ethers.parseUnits(amt, tok.decimals)])
      };
    }

    let txHash, blockNumber;
    let _sendSponsored = false;

    // ── Step 2: Try sponsor on Base first → EOA fallback ──
    if (sendSelectedChainId === 8453) {
      try {
        _setBtn('<span class="del-spinner"></span> SPONSORING…', true);
        _setSendBtnStep('sending', '✨ Trying gasless TX…');
        if (cGasEl) cGasEl.textContent = '⛽ Trying sponsored TX…';

        const result = await sendSwapViaUserOp(
          sendWallet, txReq, sendProvider,
          (msg) => _setStatus(msg, 'pending')
        );
        txHash = result.txHash || result;
        blockNumber = result.blockNumber || '—';
        _sendSponsored = true;
        if (cGasEl) cGasEl.textContent = '✨ FREE (Sponsored)';
      } catch (_sponsorErr) {
        _setSendBtnStep('sending', '⚠️ Sponsor failed, using wallet gas…');
        if (cGasEl) cGasEl.textContent = '⛽ Live gas';
        await new Promise(r => setTimeout(r, 600));
      }
    }

    if (!_sendSponsored) {
      if (cGasEl) cGasEl.textContent = '⛽ Live gas (auto-optimized)';
      _setBtn('<span class="del-spinner"></span> SENDING…', true);
      _setSendBtnStep('sending', 'Broadcasting transaction…');

      const _sendOnStatus = (msg, _type) => {
        if (msg.includes('Sending via EIP-1559')) _setSendBtnStep('sending', '⚡ EIP-1559 gas mode');
        else if (msg.includes('switching to Legacy')) _setSendBtnStep('sending', '⛽ Legacy gas mode');
      };

      let txBase;
      if (tok.native) {
        txBase = { to, value: ethers.parseEther(amt), data: '0x', chainId: sendSelectedChainId };
      } else {
        const iface2 = new ethers.Interface(ERC20_SEND_ABI);
        txBase = {
          to: tok.contract, value: 0n, chainId: sendSelectedChainId,
          data: iface2.encodeFunctionData('transfer', [to, ethers.parseUnits(amt, tok.decimals)])
        };
      }

      let sendNonce;
      try { sendNonce = await _withRpcFallback(sendSelectedChainId, _p => _p.getTransactionCount(sendWallet.address, 'latest')); } catch {}

      const tx = await window.OneGas.sendWithFallback(
        sendWallet, sendProvider, txBase, _sendOnStatus, sendNonce
      );

      _setSendBtnStep('confirming', 'Waiting for block confirmation…');
      _setBtn('<span class="del-spinner"></span> CONFIRMING…', true);
      const receipt = await tx.wait();
      txHash = tx.hash;
      blockNumber = receipt.blockNumber;
    }

    // ── Success ──
    const walletDelegated2 = (typeof window.walletDelegated !== 'undefined') ? window.walletDelegated : false;
    // ── Fix: use _sendSponsored for gasless label (walletDelegated is swap-specific) ──
    const _modeLabel = _sendSponsored ? '✨ Gasless (Coinbase Sponsored)' :
      (window.OneGasMode === 'legacy' ? '⛽ Legacy Gas' :
       window.OneGasMode === 'eip1559' ? '⚡ EIP-1559' : '⚡ Auto Gas');
    const chainName2 = getAllChains().find(c => c.chainId === sendSelectedChainId)?.name || 'Chain';
    const explorerBase = SEND_CHAIN_EXPLORER[sendSelectedChainId] ||
      ((() => { try { const cc = getAllChains().find(c => c.chainId === sendSelectedChainId); return cc?.explorer || cc?.blockExplorer || null; } catch { return null; } })()
        ? ((() => { try { const cc = getAllChains().find(c => c.chainId === sendSelectedChainId); return cc?.explorer || cc?.blockExplorer || null; } catch { return null; } })() + '/tx/')
        : (window.getTHExplorerTx ? window.getTHExplorerTx(sendSelectedChainId) : 'https://etherscan.io/tx/'));

    // ── Capture from address and logo before async timeout ──
    const _sndFromAddr = sendWallet ? sendWallet.address : '';
    // Logo: check saved token first, then known fallbacks
    const _knownLogos = {
      'ETH':  'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
      'WETH': 'https://assets.coingecko.com/coins/images/2518/small/weth.png',
      'USDC': 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
      'USDT': 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
      'DAI':  'https://assets.coingecko.com/coins/images/9956/small/4943.png',
      'CBBTC':'https://assets.coingecko.com/coins/images/40143/small/cbbtc.webp',
      'WBTC': 'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png',
      'OP':   'https://assets.coingecko.com/coins/images/25244/small/Optimism.png',
      'ARB':  'https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg',
      'POL':  'https://assets.coingecko.com/coins/images/32440/small/polygon.png',
      'MATIC':'https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png',
      'BNB':  'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
      'AVAX': 'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png',
    };
    const _savedTokForLogo = loadSavedTokens().find(t => t.id === sendSelectedToken && (t.chainId || 8453) === sendSelectedChainId);
    const _sndLogoURI = tok.logoURI || tok.logo
      || (_savedTokForLogo && (_savedTokForLogo.logoURI || _savedTokForLogo.logo))
      || _knownLogos[tok.symbol]
      || null;

    // ── Close confirm sheet, then show premium success card ──
    if (typeof closeSendConfirmSheet === 'function') closeSendConfirmSheet();

    setTimeout(() => {
      if (typeof window._sndSsoOpen === 'function') {
        window._sndSsoOpen({
          amt:         amt,
          sym:         tok.symbol,
          logoURI:     _sndLogoURI,
          iconBg:      tok.native
            ? 'linear-gradient(135deg,#627EEA,#364FC7)'
            : 'linear-gradient(135deg,#6366f1,#4f46e5)',
          iconText:    tok.symbol ? tok.symbol.slice(0,4) : '?',
          fromAddr:    _sndFromAddr,
          toAddr:      to,
          chainName:   chainName2,
          gasMode:     _modeLabel,
          block:       blockNumber,
          hash:        txHash,
          explorerBase: explorerBase
        });
      }
    }, 400);

    

    // ── Update home _balanceCache after send ──
    try {
      const _rawPkForCache = document.getElementById('send-pk')?.value?.trim() || '';
      const _fullPkForCache = _rawPkForCache.startsWith('0x') ? _rawPkForCache : '0x' + _rawPkForCache;
      const walletSuffix = _fullPkForCache.length === 66
        ? _fullPkForCache.slice(-8).toLowerCase()
        : (validatedKeys.length > 0 && sendSelectedKeyIndex >= 0
            ? ('0x' + validatedKeys[sendSelectedKeyIndex]).slice(-8).toLowerCase()
            : '');
      const sentAmt = parseFloat(amt) || 0;
      const nativeTokPost = loadSavedTokens().find(t => (t.chainId || 8453) === sendSelectedChainId && t.isNative);
      const nativeIdPost  = nativeTokPost ? nativeTokPost.id : 'eth';
      const nativeCacheKey = nativeIdPost + ':' + sendSelectedChainId + ':' + walletSuffix;
      const isNativeSend = tok.native;

      if (window._balanceCache) {
        if (isNativeSend && window._balanceCache[nativeCacheKey] !== undefined) {
          window._balanceCache[nativeCacheKey] = String(Math.max(0, parseFloat(window._balanceCache[nativeCacheKey]) - sentAmt));
          window._balanceCacheTime[nativeCacheKey] = Date.now();
        } else if (!isNativeSend && tok.id) {
          const erc20CacheKey = tok.id + ':' + sendSelectedChainId + ':' + walletSuffix;
          if (window._balanceCache[erc20CacheKey] !== undefined) {
            window._balanceCache[erc20CacheKey] = String(Math.max(0, parseFloat(window._balanceCache[erc20CacheKey]) - sentAmt));
            window._balanceCacheTime[erc20CacheKey] = Date.now();
          }
        }
        // ── Reflect deducted balance instantly in bridge section ──
        if (typeof window._brSyncBalances === 'function') {
          clearTimeout(window._brSyncDebounce);
          window._brSyncDebounce = setTimeout(window._brSyncBalances, 0);
        }
      }
      try {
        const tokenId = isNativeSend ? nativeIdPost : tok.id;
        const homeCard = document.getElementById('tc-' + tokenId) || document.querySelector('[data-token-id="' + tokenId + '"]');
        if (homeCard) {
          const balEl = homeCard.querySelector('.token-amount');
          const cacheKey2 = tokenId + ':' + sendSelectedChainId + ':' + walletSuffix;
          const newBalNum = parseFloat(window._balanceCache ? (window._balanceCache[cacheKey2] || '0') : '0');
          if (balEl) {
            balEl.classList.add('updating');
            setTimeout(() => {
              balEl.textContent = newBalNum < 0.0001 && newBalNum > 0 ? newBalNum.toExponential(3) : newBalNum.toFixed(newBalNum >= 100 ? 2 : 4);
              balEl.classList.remove('updating');
            }, 300);
          }
        }
      } catch(_hce) {}
    } catch(_bce) {}

    saveTxToHistory({
      type: 'send',
      hash: txHash,
      chainId: sendSelectedChainId || null,
      fromChainId: sendSelectedChainId || null,
      pair: txhFmtAmt(amt) + ' ' + tok.symbol + ' → ' + to.slice(0,8) + '…',
      wallet: sendWallet.address,
      walletIndex: 1,
      block: blockNumber,
      isDry: false,
      fromAmt: amt,
      fromToken: tok.symbol,
    });
    haptic();
    window.sendRunning = false;
    if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txEnd(); // BG: release wake lock
    if (typeof window._updateAllToolBadges === 'function') window._updateAllToolBadges();


  } catch(e) {
    const em = (e.message || '').toLowerCase();
    const errMsg = /rpc_gas_fail/.test(em)
      ? '❌ RPC Error: Could not fetch gas price. Check your network.'
      : '❌ Failed — ' + (e.shortMessage || e.message || String(e)).slice(0, 180);
    _setStatus(errMsg, 'error');
    window.sendRunning = false;
    if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txEnd(); // BG: release wake lock
    if (typeof window._updateAllToolBadges === 'function') window._updateAllToolBadges();

    if (cBtn) {
      cBtn.style.background = 'linear-gradient(135deg,#f59e0b,#d97706)';
      cBtn.style.opacity    = '1';
      cBtn.innerHTML = '<span class="material-icons-round">send</span> RETRY SEND';
      cBtn.disabled  = false;
      cBtn.onclick   = confirmAndSend;
    }
  }
}
