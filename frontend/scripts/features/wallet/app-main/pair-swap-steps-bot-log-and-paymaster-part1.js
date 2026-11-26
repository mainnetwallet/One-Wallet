
function goToStep3() {
  setStep(3);
  // Update active pair banner
  const bannerText = document.getElementById('active-pair-text');
  if (bannerText) bannerText.textContent = activePair ? (activePair.label || (activePair.fromSym + ' ↔ ' + activePair.toSym)) : '— Select a pair —';
  haptic();
  updateStep2NextBtn(); // sync Review & Start + step-4 tab state
  // Auto-fetch live gas fees
  fetchSwapGasFees();
}

async function fetchSwapGasFees() {
  const baseEl     = document.getElementById('gas-base-val');
  const maxEl      = document.getElementById('gas-max-val');
  const priorityEl = document.getElementById('gas-priority-val');
  const statusEl   = document.getElementById('gas-status-row');
  const iconEl     = document.getElementById('gas-refresh-icon');

  // Loading state
  if (iconEl) { iconEl.style.animation = 'spin 0.8s linear infinite'; iconEl.textContent = 'sync'; }
  if (statusEl) statusEl.textContent = 'FETCHING LIVE GAS…';
  [baseEl, maxEl, priorityEl].forEach(el => { if (el) el.textContent = '…'; });

  try {
    // Use current swap chain — not hardcoded Base (8453)
    const _gasChainId = (typeof SW !== 'undefined' && SW && SW.network && SW.network.chainId)
      ? SW.network.chainId : 8453;
    const feeData = await _withRpcFallback(_gasChainId, p => p.getFeeData(), 5000);
    if (!feeData) throw new Error('All RPCs failed');

    // MAX FEE   = baseFee + 5%   → baseFee * 105 / 100
    // MAX PRIORITY = baseFee - 95% → baseFee * 5 / 100 (min 1000000 wei)
    let baseFee, maxFee, maxPriority;
    if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
      baseFee     = feeData.maxFeePerGas - feeData.maxPriorityFeePerGas;
      maxFee      = (baseFee * 105n) / 100n;
      maxPriority = (baseFee * 5n)   / 100n;
    } else if (feeData.gasPrice) {
      baseFee     = feeData.gasPrice;
      maxFee      = (baseFee * 105n) / 100n;
      maxPriority = (baseFee * 5n)   / 100n;
    } else {
      throw new Error('No fee data');
    }
    if (maxPriority < 1000000n) maxPriority = 1000000n;
    if (maxFee < maxPriority) maxFee = maxPriority;

    const fmt = (v) => parseFloat(ethers.formatUnits(v, 'gwei')).toFixed(4);

    if (baseEl)     baseEl.textContent     = fmt(baseFee)     + ' Gwei';
    if (maxEl)      maxEl.textContent      = fmt(maxFee)      + ' Gwei';
    if (priorityEl) priorityEl.textContent = fmt(maxPriority) + ' Gwei';
    if (statusEl) {
      const now = new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'});
      if (statusEl) statusEl.textContent = 'UPDATED ' + now;
      statusEl.style.color = 'var(--accent-green)';
    }
  } catch(e) {
    if (baseEl)     baseEl.textContent     = 'Error';
    if (maxEl)      maxEl.textContent      = 'Error';
    if (priorityEl) priorityEl.textContent = 'Error';
    if (statusEl) { statusEl.textContent = 'FETCH FAILED — TAP RETRY'; statusEl.style.color = 'var(--accent-red)'; }
  } finally {
    if (iconEl) { iconEl.style.animation = ''; iconEl.textContent = 'refresh'; }
  }
}

function goToStep4() {
  // ── Pre-flight: key check BEFORE switching step ──
  // Re-apply first so validatedKeys is up-to-date
  if (typeof applyMultiGroupSelection === 'function') applyMultiGroupSelection();
  if (!validatedKeys || validatedKeys.length === 0) {
    showToast('No keys — go to Step 1', 'warning');
    setStep(1);
    haptic && haptic();
    return;
  }
  if (!activePair) {
    showToast('⚠️ Pair select করা হয়নি — Step 2 (PAIR) এ ফিরে pair choose করুন।', 'warning');
    setStep(2);
    haptic && haptic();
    return;
  }

  setStep(4);
  haptic();

  // Save BEFORE applyMultiGroupSelection wipes assignedSwapCounts
  const _savedSwapCounts = assignedSwapCounts.slice();

  // Re-apply swap group selection FIRST — home page wallet switch can override validatedKeys to 1 key
  if (typeof applyMultiGroupSelection === 'function') applyMultiGroupSelection();

  // Restore previously randomized counts if wallet count matches; otherwise generate fresh
  if (_savedSwapCounts.length && _savedSwapCounts.length === validatedKeys.length) {
    assignedSwapCounts = _savedSwapCounts;
  } else {
    const min = parseInt(document.getElementById('swap-min')?.value) || 2;
    const max = parseInt(document.getElementById('swap-max')?.value) || 6;
    const vals = [];
    for (let v = (min % 2 === 0 ? min : min + 1); v <= max; v += 2) vals.push(v);
    if (!vals.length) vals.push(min % 2 === 0 ? min : min + 1);
    assignedSwapCounts = validatedKeys.map(() => vals[Math.floor(Math.random() * vals.length)]);
  }

  // Update preview chips in step 3
  const preview = document.getElementById('randomize-preview');
  if (preview) { preview.style.display = 'flex'; preview.style.flexWrap = 'wrap'; preview.style.gap = '6px';
    preview.innerHTML = assignedSwapCounts.map((c, i) =>
      `<div style="font-family:var(--font-mono);font-size:10px;background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.25);border-radius:7px;padding:4px 10px;color:var(--text-secondary);">W${i+1} <span style="color:var(--accent-primary);font-weight:700;">${c}</span></div>`
    ).join('');
  }

  (document.getElementById('sum-wallets') || {}).textContent = validatedKeys.length + ' wallets';
  (document.getElementById('sum-total-swaps') || {}).textContent = assignedSwapCounts.reduce((a, b) => a + b, 0) + ' swaps';
  // Update pair in summary
  const sumPair = document.getElementById('sum-pair');
  if (sumPair) sumPair.textContent = activePair ? (activePair.label || (activePair.fromSym + ' ↔ ' + activePair.toSym)) : '—';
  // Update integrator in summary
  updateIntegratorSummary();
  // ── Update gas mode display to match current paymaster toggle ──
  onPaymasterToggle();

  buildWalletProgressBars();
}

function saveResumeToStorage(val) {
  try {
    if (val) localStorage.setItem(RESUME_STORAGE_KEY, String(val));
    else localStorage.removeItem(RESUME_STORAGE_KEY);
  } catch {}
}

function loadResumeFromStorage() {
  try { return localStorage.getItem(RESUME_STORAGE_KEY) || ''; } catch { return ''; }
}

function restoreResumeUI() {
  const saved = loadResumeFromStorage();
  if (!saved) return;
  const input = document.getElementById('resume-wallet-input');
  const badge = document.getElementById('resume-saved-badge');
  const row   = document.getElementById('resume-row');
  if (input) input.value = saved;
  if (badge) badge.style.display = 'inline-block';
  if (row)   row.style.display = 'block';
  updateResumeHint();
}

function stopBot() {
  swapBotRunning = false;
  if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txEnd(); // BG: release wake lock
  const _stopTime = Date.now();
  const _stopElapsed = _stopTime - (_runStart || _stopTime);
  const _stopMins = Math.floor(_stopElapsed / 60000);
  const _stopSecs = Math.floor((_stopElapsed % 60000) / 1000);
  const _stopTimeStr = _stopMins > 0 ? `${_stopMins}m ${_stopSecs}s` : `${_stopSecs}s`;
  log('⛔ Bot stopped by user', 'error');
  log('📊 ── PARTIAL SUMMARY ────────────', 'purple');
  log(`✅  Successful swaps : ${_totalSuccess || 0}`, 'success');
  log(`❌  Failed swaps     : ${_totalFail || 0}`, (_totalFail || 0) > 0 ? 'error' : 'info');
  log(`⏭️  Skipped swaps    : ${_totalSkip || 0}`, (_totalSkip || 0) > 0 ? 'warn' : 'info');
  log(`⏱️  Elapsed time     : ${_stopTimeStr}`, 'cyan');
  (document.getElementById('terminal-status') || {}).className = 'term-status-badge done';
  (document.getElementById('terminal-status') || {}).textContent = '⛔ STOPPED';
  // Save stopped wallet index for resume
  const walletNum = currentRunWalletIndex + 1;
  const resumeInput = document.getElementById('resume-wallet-input');
  if (resumeInput) {
    resumeInput.value = walletNum;
    const badge = document.getElementById('resume-saved-badge');
    if (badge) badge.style.display = 'inline-block';
  }
  saveResumeToStorage(walletNum);
  showToast('Bot stopped — W#' + walletNum + ' saved', 'stop_circle');
  resetRunBtn(true);
}

function clearResumeWallet() {
  const input = document.getElementById('resume-wallet-input');
  const badge = document.getElementById('resume-saved-badge');
  const row   = document.getElementById('resume-row');
  if (input) input.value = '';
  if (badge) badge.style.display = 'none';
  if (row)   row.style.display = 'none';
  saveResumeToStorage('');
  clearSwapProgress();
  updateResumeHint();
  showToast('Resume cleared — fresh start', 'refresh');
  haptic();
}

function onResumeInputChange() {
  const input = document.getElementById('resume-wallet-input');
  const badge = document.getElementById('resume-saved-badge');
  if (badge) badge.style.display = 'none';
  saveResumeToStorage(input?.value || '');
  updateResumeHint();
}

function updateResumeHint() {
  const input = document.getElementById('resume-wallet-input');
  const hint = document.getElementById('resume-hint');
  if (!input || !hint) return;
  const val = parseInt(input.value || '0');
  if (val >= 1 && val <= validatedKeys.length) {
    if (hint) hint.textContent = '▶ Next run will start from W#' + val + ' of ' + validatedKeys.length;
    hint.style.color = 'var(--accent-green)';
  } else if (input.value === '' || val === 0) {
    if (hint) hint.textContent = '▶ Next run will start from W#1 (fresh)';
    hint.style.color = 'var(--text-muted)';
  } else {
    if (hint) hint.textContent = '⚠ Invalid — max W#' + validatedKeys.length;
    hint.style.color = 'var(--accent-red)';
  }
}

function clearSwapProgress() {
  const progSec = document.getElementById('wallet-progress-section');
  if (progSec) progSec.style.display = 'none';
}

function resetRunBtn(showResume = false) {
  swapBotRunning = false;
  if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txEnd(); // BG: release wake lock
  const runBtn = document.getElementById('run-btn');
  const backBtn = document.getElementById('back-btn-3');
  if (runBtn) runBtn.innerHTML = '<span class="material-icons-round" style="vertical-align:middle;font-size:16px;margin-right:6px;">replay</span>RUN AGAIN';
  if (runBtn) { runBtn.style.background = ''; runBtn.onclick = () => { startSwapBot(); }; }
  if (backBtn) { backBtn.style.opacity = '1'; backBtn.style.pointerEvents = 'auto'; }
  // Show resume row only when explicitly requested (bot stopped mid-run)
  const resumeRow = document.getElementById('resume-row');
  if (showResume) {
    if (resumeRow) resumeRow.style.display = 'block';
    updateResumeHint();
  } else {
    // All wallets done — hide resume row and clear storage
    if (resumeRow) resumeRow.style.display = 'none';
    saveResumeToStorage('');
    clearSwapProgress();
  }
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Bot log output function ──
function log(msg, type) {
  const el = document.getElementById('log-output');
  if (!el) return;
  const colors = {
    success: 'var(--accent-green)', error: 'var(--accent-red)', warn: 'var(--accent-amber)',
    info: 'var(--text-secondary)', cyan: 'var(--neon-cyan)', purple: 'var(--neon-purple)'
  };
  const color = colors[type] || colors.info;
  const line = document.createElement('div');
  line.style.cssText = 'color:' + color + ';padding:1px 0;word-break:break-all;';
  line.innerHTML = msg;
  el.appendChild(line);
  logScrollToBottom();
}
function logScrollToBottom() {
  const el = document.getElementById('log-output');
  if (el) el.scrollTop = el.scrollHeight;
}



// ══════════════════════════════════════════════
// NANSEN BOT — Standalone Swap Executor
// Fetches real LI.FI quote + sends on-chain tx
// ══════════════════════════════════════════════
// swapOptions: { swapNum, totalSwaps, isLastTwoSwaps, isLastSwap, nextWalletAddr, holdRatio }
async function _nansenBotSwap(pk, pair, swapNum, totalSwaps, swapOptions) {
  const CHAIN_ID = 8453; // Base
  const LIFI_API = 'https://li.quest/v1';
  const NATIVE   = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
  const ZERO     = '0x0000000000000000000000000000000000000000';

  const opts = swapOptions || {};
  // ── Alternating direction: odd swaps = A→B, even swaps = B→A ──
  const isReversed = (swapNum % 2 === 0); // swap #2, #4, #6… = reversed
  // ── Hold 0.02% on last 2 swaps ──
  const isLastTwo  = !!opts.isLastTwoSwaps;
  const HOLD_RATIO = opts.holdRatio || 0.0002; // 0.02%
  // ── Last swap: send to next wallet address ──
  const isLastSwap     = !!opts.isLastSwap;
  const nextWalletAddr = opts.nextWalletAddr || null;

  // ── 1. Create wallet ──
  const walletKey = pk.startsWith('0x') ? pk : '0x' + pk;
  const walletObj = new ethers.Wallet(walletKey);
  const walletAddr = walletObj.address;

  // ── 2. Resolve token addresses — flip direction on even swaps ──
  const baseFromAddr = (pair.fromAddr || '').trim() || NATIVE;
  const baseToAddr   = (pair.toAddr   || '').trim() || NATIVE;
  const baseFromSym  = pair.fromSym || '?';
  const baseToSym    = pair.toSym   || '?';
  const baseFromDec  = pair.fromDecimals || 18;
  const baseToDec    = pair.toDecimals   || 18;

  // Apply direction flip for alternating swaps
  const fromAddr = isReversed ? baseToAddr   : baseFromAddr;
  const toAddr   = isReversed ? baseFromAddr : baseToAddr;
  const fromSym  = isReversed ? baseToSym    : baseFromSym;
  const toSym    = isReversed ? baseFromSym  : baseToSym;
  const fromDec  = isReversed ? baseToDec    : baseFromDec;
  const toDec    = isReversed ? baseFromDec  : baseToDec;



  const isFromNative = /^0x0+$/i.test(fromAddr) || fromAddr.toLowerCase() === NATIVE.toLowerCase();

  // ── 3. Build provider (moved up — needed for balance fetch before quote) ──
  const rpcList = (typeof _getRpcListForChain === 'function')
    ? _getRpcListForChain(CHAIN_ID)
    : ['https://mainnet.base.org', 'https://base.drpc.org', 'https://base.llamarpc.com', 'https://base-rpc.publicnode.com'];
  let provider = null;
  let _rpcAttempt = 0;
  while (!provider) {
    // ── Stop check at TOP of every iteration ──
    if (!swapBotRunning) throw new Error('Bot stopped');
    const rpc = rpcList[_rpcAttempt % rpcList.length];
    try {
      const p = new ethers.JsonRpcProvider(rpc, CHAIN_ID, { staticNetwork: true });
      await Promise.race([p.getBlockNumber(), new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 2500))]);
      provider = p;
      if (_rpcAttempt > 0) log('  \u2705 RPC connected: ' + rpc.slice(0, 40), 'success');
    } catch(_) {
      if (!swapBotRunning) throw new Error('Bot stopped');
      log('  \u26a0\ufe0f RPC fail [' + ((_rpcAttempt % rpcList.length) + 1) + '/' + rpcList.length + ']: ' + rpc.slice(0, 40) + ' — next...', 'warn');
      _rpcAttempt++;
      if (_rpcAttempt % rpcList.length === 0) {
        log('  \U0001f504 সব RPC fail — retry হচ্ছে…', 'warn');
        // ── Interruptible 2s sleep: check stop every 200ms ──
        for (let _w = 0; _w < 10; _w++) {
          if (!swapBotRunning) throw new Error('Bot stopped');
          await new Promise(r => setTimeout(r, 200));
        }
      }
    }
  }
  const signer = walletObj.connect(provider);

  // ── 4. ERC20 interface (needed for balance fetch) ──
  const erc20iface = new ethers.Interface([
    'function balanceOf(address) view returns(uint256)',
    'function allowance(address,address) view returns(uint256)',
    'function approve(address,uint256) returns(bool)'
  ]);

  // ── 5. Fetch real wallet balance FIRST, use it as swap amount ──
  const slippage   = (typeof SW !== 'undefined' && SW.slippage) ? SW.slippage / 100 : 0.005;
  const integrator = (typeof getActiveIntegrator === 'function') ? getActiveIntegrator() : 'OneWallet';
  let amountWei;
  let amountFloat;

  if (!isFromNative) {
    // ERC20 — read on-chain balance
    let balance = 0n;
    try {
      const balHex = await provider.call({ to: fromAddr, data: erc20iface.encodeFunctionData('balanceOf', [walletAddr]) });
      if (balHex && balHex !== '0x') balance = BigInt(balHex);
    } catch(_) {}

    const balFmt = parseFloat(ethers.formatUnits(balance, fromDec)).toFixed(6);

    if (balance === 0n) throw new Error('Insufficient ' + fromSym + ' balance (wallet is empty)');

    // ── Last 2 swaps: hold 0.02% in wallet ──
    let spendBalance = balance;
    if (isLastTwo) {
      const holdWei = balance * BigInt(Math.round(HOLD_RATIO * 1e8)) / BigInt(1e8);
      spendBalance = balance > holdWei ? balance - holdWei : balance;
    }

    amountWei   = spendBalance.toString();
    amountFloat = parseFloat(ethers.formatUnits(spendBalance, fromDec));
  } else {
    // Native ETH — check if paymaster sponsors gas
    const paymasterOn = typeof sendSwapViaUserOp === 'function'
      && (typeof isSwapPaymasterEnabled === 'function' ? isSwapPaymasterEnabled() : (typeof isPaymasterEnabled === 'function' ? isPaymasterEnabled() : false));
    let ethBal = 0n;
    try { ethBal = await provider.getBalance(walletAddr); } catch(_) {}
    const ethFmt = parseFloat(ethers.formatEther(ethBal)).toFixed(6);
    if (ethBal === 0n) throw new Error('Insufficient ETH balance (wallet is empty)');
    if (paymasterOn) {
      // Gasless — full balance, no gas reserve needed
      let spendBal = ethBal;
      if (isLastTwo) {
        const holdWei = ethBal * BigInt(Math.round(HOLD_RATIO * 1e8)) / BigInt(1e8);
        spendBal = ethBal > holdWei ? ethBal - holdWei : ethBal;
      }
      amountWei   = spendBal.toString();
      amountFloat = parseFloat(ethers.formatEther(spendBal));
    } else {
      // EOA — reserve 0.002 ETH for gas
      const GAS_RESERVE = ethers.parseEther('0.002');
      let spendable   = ethBal > GAS_RESERVE ? ethBal - GAS_RESERVE : 0n;
      if (isLastTwo && spendable > 0n) {
        const holdWei = spendable * BigInt(Math.round(HOLD_RATIO * 1e8)) / BigInt(1e8);
        spendable = spendable > holdWei ? spendable - holdWei : spendable;
      }
      if (spendable === 0n) throw new Error('Insufficient ETH balance (need > 0.002 ETH for gas)');
      amountWei   = spendable.toString();
      amountFloat = parseFloat(ethers.formatEther(spendable));
    }
  }

  // ── Determine output recipient address ──
  // Last swap: output goes to next wallet address instead of self
  const toAddress = (isLastSwap && nextWalletAddr && ethers.isAddress(nextWalletAddr))
    ? nextWalletAddr
    : walletAddr;

  // ══════════════════════════════════════════════════════════════════
  // ── PRE-QUOTE TO ADDRESS VERIFICATION ──
  // Quota fetch করার আগে wallet group panel থেকে selected key নিয়ে
  // TO address verify করো। Fail হলে 2 বার retry, তারপর bot বন্ধ।
  // ══════════════════════════════════════════════════════════════════
  (function _preQuoteToAddrVerify() {
    // Hover tooltip element update করো
    try {
      const hoverEl = document.getElementById('nansen-toadd-verify-badge');
      if (hoverEl) {
        hoverEl.textContent = '🔍 Verifying TO: ' + toAddress.slice(0,6) + '…' + toAddress.slice(-4);
        hoverEl.style.color = 'var(--accent-amber)';
      }
    } catch(_) {}
  })();

  // TO address verify function — wallet group panel থেকে selected key দিয়ে
  async function _verifyToAddress(targetAddr, attempt) {
    // Silent background verify — no log output
    // Step 1: ethers.isAddress দিয়ে format check
    if (!ethers.isAddress(targetAddr)) {
      return false;
    }
    // Step 2: wallet group panel-এ selected key থেকে derive করা address-এর সাথে match করো
    // validatedKeys (global) থেকে expected addresses বের করো
    // Use snapshot passed from bot loop — never trust live global validatedKeys (race condition)
    const knownAddresses = Array.isArray(opts.knownAddrs) ? opts.knownAddrs : [];

    const targetLower = targetAddr.toLowerCase();
    const walletLower = walletAddr.toLowerCase();

    // Self-address (non-last swap) — always valid
    if (targetLower === walletLower) return true;

    // Last swap: must be in known wallet group addresses
    if (knownAddresses.length > 0) {
      if (knownAddresses.includes(targetLower)) return true;
      // not found in wallet group — REJECT (prevent fund loss to unknown address)
      return false;
    }

    // Zero-address reject
    if (targetLower === '0x0000000000000000000000000000000000000000') return false;

    // knownAddresses empty (keys not loaded yet) — reject to be safe
    return false;
  }

  // Verify with retry (max 3 attempts = 1 initial + 2 retries)
  let _toVerified = false;
  for (let _vAttempt = 1; _vAttempt <= 3; _vAttempt++) {
    _toVerified = await _verifyToAddress(toAddress, _vAttempt);
    if (_toVerified) break;
    if (_vAttempt < 3) {
      await new Promise(r => setTimeout(r, 1500));
    }
  }
  if (!_toVerified) {
    // Retry সব fail — bot বন্ধ করো
    swapBotRunning = false;
    if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txEnd(); // BG: release wake lock
    if (typeof window._updateAllToolBadges === 'function') window._updateAllToolBadges();
    const _termStatus = document.getElementById('terminal-status');
    if (_termStatus) { _termStatus.className = 'term-status-badge'; _termStatus.textContent = '🛑 STOPPED'; _termStatus.style.color = 'var(--accent-red)'; }
    try {
      const hoverEl = document.getElementById('nansen-toadd-verify-badge');
      if (hoverEl) { hoverEl.textContent = '❌ Verify FAILED — bot stopped'; hoverEl.style.color = 'var(--accent-red)'; }
    } catch(_) {}
    throw new Error(
      '🛑 TO address verify 3 বার fail — BOT STOPPED. TO: ' + toAddress.slice(0,8) + '…' +
      ' wallet group-এ নেই বা invalid।'
    );
  }
  // Update hover badge to verified
  try {
    const hoverEl = document.getElementById('nansen-toadd-verify-badge');
    if (hoverEl) { hoverEl.textContent = '✅ TO verified: ' + toAddress.slice(0,6) + '…' + toAddress.slice(-4); hoverEl.style.color = 'var(--accent-green)'; }
  } catch(_) {}
  // ══════════════════════════════════════════════════════════════════

  // ── 6. Fetch LI.FI quote with full balance ──
  const qParams = new URLSearchParams({
    fromChain:   CHAIN_ID,
    toChain:     CHAIN_ID,
    fromToken:   isFromNative ? ZERO : fromAddr,
    toToken:     /^0x0+$/i.test(toAddr) || toAddr.toLowerCase() === NATIVE.toLowerCase() ? ZERO : toAddr,
    fromAmount:  amountWei,
    fromAddress: walletAddr,
    toAddress:   toAddress,
    integrator:  integrator,
    slippage:    slippage,
  });
  const qResp = await fetch(LIFI_API + '/quote?' + qParams.toString(), {
    headers: { 'x-lifi-api-key': 'b3e55edd-de70-4578-b761-cd2aac0fbae0.685a5adf-2580-486e-a8ff-1df4992b3f2e' },
    signal: AbortSignal.timeout(14000)
  });
  if (!qResp.ok) {
    const errBody = await qResp.text().catch(() => '');
    throw new Error('LI.FI quote HTTP ' + qResp.status + (errBody ? ': ' + errBody.slice(0, 80) : ''));
  }
  const qData = await qResp.json();
  const txReq = qData.transactionRequest;
  if (!txReq || !txReq.to || !txReq.data) throw new Error('LI.FI: no tx data returned');

  // ── SAFETY: last swap-এ next wallet address verify করো — 3 layer ──
  if (isLastSwap && nextWalletAddr && ethers.isAddress(nextWalletAddr)) {
    const _expLow    = nextWalletAddr.toLowerCase();
    const _expChk    = ethers.getAddress(nextWalletAddr).toLowerCase();

    // Layer 1: LI.FI declared toAddress field
    const _lifiTo    = (qData.action?.toAddress || qData.toAddress || '').toLowerCase();
    if (_lifiTo && _lifiTo !== _expLow) {
      throw new Error(
        'SAFETY ABORT: LI.FI toAddress (' + _lifiTo.slice(0,8) + '…) ≠ next wallet — ' +
        'fund ভুল address-এ যাবে!'
      );
    }

    // Layer 2: calldata hex includes next wallet address (without 0x prefix)
    const calldataLower  = (txReq.data || '').toLowerCase();
    const expectedHex    = _expLow.slice(2);   // 0x ছাড়া
    const expectedChkHex = _expChk.slice(2);
    if (!calldataLower.includes(expectedHex) && !calldataLower.includes(expectedChkHex)) {
      throw new Error(
        'SAFETY ABORT: Next wallet (' + nextWalletAddr.slice(0,8) + '…) calldata-এ নেই — ' +
        'fund ভুল address-এ যাবে, swap বাতিল করা হলো!'
      );
    }

    // Layer 3: knownAddrs snapshot confirm (nextWalletAddr must be from our own key set)
    if (opts.knownAddrs && opts.knownAddrs.length > 0 && !opts.knownAddrs.includes(_expLow)) {
      throw new Error(
        'SAFETY ABORT: Next wallet (' + nextWalletAddr.slice(0,8) + '…) snapshot-এ নেই — ' +
        'key set পরিবর্তন হয়েছে কি? Swap বাতিল!'
      );
    }

    log('  🔒 Next wallet 3-layer verified ✓ ' + nextWalletAddr.slice(0,6) + '…' + nextWalletAddr.slice(-4), 'success');
  }
  // ── SAFETY: non-last swap — LI.FI action.toAddress must equal walletAddr ──
  if (!isLastSwap) {
    // Check LI.FI's declared recipient fields (more reliable than raw calldata)
    const _lifiTo = (qData.action?.toAddress || qData.toAddress || '').toLowerCase();
    if (_lifiTo && _lifiTo !== walletAddr.toLowerCase()) {
      throw new Error(
        'SAFETY ABORT: LI.FI toAddress (' + _lifiTo.slice(0,8) + '…) ≠ walletAddr — ' +
        'output ভুল address-এ যাবে, swap বাতিল!'
      );
    }
    // Secondary: calldata check (skip for native wraps — they have no address in calldata)
    const _isNativeWrap = isFromNative && /^0xd0e30db0/i.test(txReq.data || '');
    if (!_isNativeWrap) {
      const calldataLower = (txReq.data || '').toLowerCase();
      const selfAddr = walletAddr.slice(2).toLowerCase();
      if (txReq.data && txReq.data.length > 74 && !calldataLower.includes(selfAddr)) {
        throw new Error(
          'SAFETY ABORT: Self-address (' + walletAddr.slice(0,8) + '…) calldata-এ নেই — ' +
          'output ভুল address-এ যেতে পারে, swap বাতিল!'
        );
      }
    }
  }
  // ────────────────────────────────────────────────────────────────────

  const routeName = (qData.toolDetails && qData.toolDetails.name) || qData.tool || 'DEX';
  const outAmt    = qData.estimate && qData.estimate.toAmount
    ? parseFloat(ethers.formatUnits(qData.estimate.toAmount, toDec)).toFixed(6)
    : '?';
  log('  ✅ Route: ' + routeName + ' | ~' + outAmt + ' ' + toSym, 'cyan');

  if (!isFromNative) {

    // Spender: LI.FI uses estimate.approvalAddress as canonical spender
    const spender = qData.estimate?.approvalAddress || txReq.approvalAddress || txReq.to;

    let needApprove = true;
    try {
      const aHex = await provider.call({ to: fromAddr, data: erc20iface.encodeFunctionData('allowance', [walletAddr, spender]) });
      if (aHex && aHex !== '0x') needApprove = BigInt(aHex) < BigInt(amountWei);
    } catch(_) {}

    if (needApprove) {
      log('  🔓 Approving ' + fromSym + ' → spender ' + spender.slice(0,10) + '…', 'warn');
      // ── DRY RUN: skip real approve ──
      const _dryEl = document.getElementById('cfg-dry');
      const _isDryRun = _dryEl && _dryEl.classList.contains('on');
      if (_isDryRun) {
        log('  🧪 [DRY RUN] Approve skipped — no real tx sent', 'warn');
      } else {
        const approveTx = await signer.sendTransaction({
          to: fromAddr,
          data: erc20iface.encodeFunctionData('approve', [spender, ethers.MaxUint256]),
          chainId: CHAIN_ID,
        });
        log('  ⏳ Approve tx: ' + approveTx.hash.slice(0, 20) + '…', 'info');
        await approveTx.wait(1);
        await new Promise(r => setTimeout(r, 2000)); // propagation buffer
        log('  ✅ Approved!', 'success');
      }
    } else {
      // allowance sufficient — no action needed
    }
  }

  // ── 7. Send swap tx ──
  let txValue = 0n;
  try {
    const v = txReq.value;
    if (v && v !== '0' && v !== '0x0') txValue = String(v).startsWith('0x') ? BigInt(v) : BigInt(String(v));
  } catch(_) {}
  // Native safety: if LiFi returns 0 value for native token swap, fallback to full amountWei
  if (isFromNative && txValue === 0n) {
    try { txValue = BigInt(amountWei); } catch(_) {}
  }

  // ── DRY RUN CHECK: skip real swap tx ──
  const _dryToggle = document.getElementById('cfg-dry');
  const _isDry = _dryToggle && _dryToggle.classList.contains('on');
  if (_isDry) {
    const _fakeHash = '0xdry' + Math.random().toString(16).slice(2, 14).padEnd(12,'0') + walletAddr.slice(2,14);
    log('  🧪 [DRY RUN] Would swap <b>' + parseFloat(ethers.formatUnits(amountWei, fromDec)).toFixed(6) + ' ' + fromSym + '</b> → <b>' + outAmt + ' ' + toSym + '</b>', 'warn');
    log('  🧪 [DRY RUN] Route: ' + routeName + ' | No real tx sent', 'warn');
    log('  🧪 [DRY RUN] Simulated hash: ' + _fakeHash.slice(0,20) + '…', 'warn');
    return { hash: _fakeHash, isDry: true };
  }

  // Use paymaster if enabled (Base only)
  const usePaymaster = typeof sendSwapViaUserOp === 'function'
    && (typeof isSwapPaymasterEnabled === 'function' ? isSwapPaymasterEnabled() : (typeof isPaymasterEnabled === 'function' ? isPaymasterEnabled() : false));

  let txHash = '';
  if (usePaymaster) {
    const pmResult = await sendSwapViaUserOp(signer, {
      to: txReq.to, data: txReq.data,
      value: '0x' + txValue.toString(16),
      gasLimit: BigInt(Math.ceil(Number(txReq.gasLimit || txReq.gas || 400000) * 1.3)),
    }, provider, () => {}, BigInt(Math.ceil((Number(txReq.gasLimit || txReq.gas || 400000)) * 1.3)));
    txHash = pmResult.txHash;
    log('  ✅ swap sent! Tx: <a href="https://basescan.org/tx/' + txHash + '" target="_blank" style="color:var(--neon-cyan);">' + txHash.slice(0,6) + '....' + txHash.slice(-4) + '</a>', 'success');
    return { hash: txHash };
  }

  // EOA tx (only when paymaster is OFF)
  const swapTx = await signer.sendTransaction({
    to:       txReq.to,
    data:     txReq.data,
    value:    txValue,
    gasLimit: BigInt(txReq.gasLimit || txReq.gas || 400000),
    chainId:  CHAIN_ID,
  });
  txHash = swapTx.hash;
  log('  ✅ swap sent! Tx: <a href="https://basescan.org/tx/' + txHash + '" target="_blank" style="color:var(--neon-cyan);">' + txHash.slice(0,6) + '....' + txHash.slice(-4) + '</a>', 'success');

  // ── 8. Wait for receipt ──
  const receipt = await Promise.race([
    swapTx.wait(1),
    new Promise((_, rej) => setTimeout(() => rej(new Error('confirmation timeout after 90s')), 90000))
  ]);
  if (!receipt || receipt.status === 0) throw new Error('Tx reverted on-chain');
  log('  ✅ Confirmed! Block #' + receipt.blockNumber, 'success');
  return { hash: txHash, receipt };
}
