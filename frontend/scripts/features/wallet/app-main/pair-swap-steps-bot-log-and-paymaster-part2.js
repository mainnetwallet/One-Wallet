
// ── Nansen Swap Bot — startSwapBot ──
async function startSwapBot() {
  if (swapBotRunning) return;
  if (!validatedKeys || validatedKeys.length === 0) {
    showToast('⚠️ কোনো wallet/key load হয়নি। Step 1 (KEYS) এ ফিরে group বা key select করুন।', 'warning');
    return;
  }
  if (!activePair) {
    showToast('No trading pair selected. Go back to step 1.', 'warning');
    return;
  }

  swapBotRunning = true;
  if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txStart(); // BG: wake lock
  if (typeof window._updateAllToolBadges === 'function') window._updateAllToolBadges();

  // UI: run button → stop
  const runBtn = document.getElementById('run-btn');
  const backBtn = document.getElementById('back-btn-3');
  if (runBtn) { runBtn.innerHTML = '<span class="material-icons-round" style="vertical-align:middle;font-size:16px;margin-right:6px;">stop</span>STOP BOT'; runBtn.onclick = stopBot; }
  if (backBtn) { backBtn.style.opacity = '0.3'; backBtn.style.pointerEvents = 'none'; }

  // Show terminal card (was hidden by default — this is the fix)
  const termCard = document.getElementById('terminal-card');
  if (termCard) { termCard.style.display = 'block'; termCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
  const termStatus = document.getElementById('terminal-status');
  if (termStatus) { termStatus.style.display = 'block'; termStatus.className = 'term-status-badge running'; termStatus.textContent = '● RUNNING'; }
  const logOut = document.getElementById('log-output');
  if (logOut) logOut.innerHTML = '';

  // Show TO address verify badge wrap
  const _verifyWrap = document.getElementById('nansen-toadd-verify-wrap');
  if (_verifyWrap) { _verifyWrap.style.display = 'block'; }
  const _verifyBadge = document.getElementById('nansen-toadd-verify-badge');
  if (_verifyBadge) { _verifyBadge.textContent = '⏳ TO address verify pending…'; _verifyBadge.style.color = 'var(--accent-amber)'; }
  // Show wallet progress section
  const progSec = document.getElementById('wallet-progress-section');
  if (progSec) progSec.style.display = 'block';

  _runStart = Date.now();
  _totalSuccess = 0; _totalFail = 0; _totalSkip = 0;

  // Resume from wallet index
  const resumeInput = document.getElementById('resume-wallet-input');
  const startFromIdx = Math.max(0, parseInt(resumeInput?.value || '1') - 1);

  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'purple');
  log('🚀 Nansen Swap Bot started', 'success');
  log('👛 Wallets loaded : ' + validatedKeys.length, 'info');
  log('📌 Pair : ' + (activePair.label || activePair.fromSym + ' ↔ ' + activePair.toSym), 'cyan');
  log('🔗 Network : Base', 'info');
  log('⛽ Gas mode : ' + (document.getElementById('swap-modes-paymaster')?.classList.contains('on') ? 'GASLESS (Paymaster)' : 'EOA (Self-pay)'), 'info');
  log('📦 Total swaps : ' + (assignedSwapCounts ? assignedSwapCounts.reduce((a,b)=>a+b,0) : '?'), 'info');
  const _dryStartEl = document.getElementById('cfg-dry');
  if (_dryStartEl && _dryStartEl.classList.contains('on')) {
    log('🧪 DRY RUN MODE — No real transactions will be sent', 'warn');
  }
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'purple');
  if (startFromIdx > 0) log('⏭ Resuming from W#' + (startFromIdx + 1), 'warn');

  // ── SAFETY: Snapshot keys + pair at start — prevents mid-run mutation race condition ──
  const _botKeys       = validatedKeys.slice(); // immutable copy
  const _botPair       = Object.assign({}, activePair); // immutable copy
  const _botSwapCounts = assignedSwapCounts ? assignedSwapCounts.slice() : null;

  for (let i = startFromIdx; i < _botKeys.length; i++) {
    if (!swapBotRunning) break;
    currentRunWalletIndex = i;
    const pk = _botKeys[i];
    let addr = '';
    try { addr = new ethers.Wallet(pk.startsWith('0x') ? pk : '0x' + pk).address; } catch {}
    const swapCount = (_botSwapCounts && _botSwapCounts[i] != null ? _botSwapCounts[i] : 1) || 2; // min 2 (even)
    if (i > 0) { const _sep = document.createElement('div'); _sep.style.cssText = 'height:8px'; document.getElementById('log-output') && document.getElementById('log-output').appendChild(_sep); }
    log('👛 [W#' + (i + 1) + '] ' + (addr ? addr.slice(0,6) + '...' + addr.slice(-4) : ''), 'cyan');

    // Update progress bar
    const progBar = document.getElementById('wp-bar-' + i);
    if (progBar) { progBar.style.background = 'linear-gradient(90deg,var(--accent-primary),var(--accent-secondary))'; progBar.style.width = '0%'; }
    const progLabel = document.getElementById('wp-label-' + i);
    if (progLabel) progLabel.textContent = '0/' + swapCount;
    const progStatus = document.getElementById('wp-status-' + i);
    if (progStatus) { progStatus.textContent = '🔄'; }

    for (let s = 0; s < swapCount; s++) {
      if (!swapBotRunning) break;
      try {
        await delay(600 + Math.random() * 800);

        // ── Alternating swap direction ──
        const swapNum = s + 1;
        // ── Last 2 swaps: hold 0.02% ──
        const isLastTwoSwaps = swapCount >= 2 && s >= swapCount - 2;
        // ── Last swap: send to next wallet (circular: last key → 1st key) ──
        const isLastSwap    = (s === swapCount - 1);
        const isLastWallet  = (i === _botKeys.length - 1);
        const nextWalletAddr = isLastSwap
          ? (function() {
              try {
                // Last key → send to 1st key address (circular)
                // Other keys → send to next key address
                const nextPk = isLastWallet ? _botKeys[0] : _botKeys[i + 1];
                return new ethers.Wallet(nextPk.startsWith('0x') ? nextPk : '0x' + nextPk).address;
              } catch(_) { return null; }
            })()
          : null;

        const swapOpts = {
          isLastTwoSwaps,
          isLastSwap,
          isLastWallet,
          nextWalletAddr,
          holdRatio: 0.0002, // 0.02%
          // ── Pass snapshot addresses for verification (never trust live global) ──
          knownAddrs: _botKeys.map(k => { try { return new ethers.Wallet(k.startsWith('0x')?k:'0x'+k).address.toLowerCase(); } catch(_){return null;} }).filter(Boolean),
        };

        const dirLabel = swapNum % 2 === 0
          ? (_botPair.toSym + ' → ' + _botPair.fromSym)
          : (_botPair.fromSym + ' → ' + _botPair.toSym);

        log('  🔄 Swap ' + swapNum + '/' + swapCount + ' [' + dirLabel + ']', 'info');
        if (isLastSwap && nextWalletAddr) {
          const nextLabel = isLastWallet ? 'W#1 ' : 'W#' + (i + 2);
          const _nwa = nextWalletAddr ? nextWalletAddr.slice(0,6) + '...' + nextWalletAddr.slice(-5) : '';
          log('  ➡️ Next wallet [' + nextLabel + ']: ' + _nwa, 'warn');
        }

        // ── Retry up to 2 times on failure, skip if balance empty ──
        let _swapDone = false;
        for (let _retry = 0; _retry <= 2; _retry++) {
          try {
            await _nansenBotSwap(pk, _botPair, swapNum, swapCount, swapOpts);
            _swapDone = true;
            break;
          } catch(_re) {
            const _msg = (_re.message || '');
            const _isEmpty = _msg.toLowerCase().includes('wallet is empty') || (_msg.toLowerCase().includes('insufficient') && _msg.toLowerCase().includes('balance'));
            if (_isEmpty) {
              // ── Balance check: retry up to 2x before skipping ──
              let _balOk = false;
              for (let _bc = 1; _bc <= 2; _bc++) {
                log('  🔍 Balance check ' + _bc + '/2 — waiting...', 'warn');
                await delay(3000 + Math.random() * 1000);
                try {
                  const _bcRpcs = (typeof _getRpcListForChain === 'function') ? _getRpcListForChain(8453) : ['https://mainnet.base.org'];
                  const _bcProvider = new ethers.JsonRpcProvider(_bcRpcs[0], 8453, { staticNetwork: true });
                  const _bcAddr = pk.startsWith('0x') ? pk : '0x' + pk;
                  const _bcWallet = new ethers.Wallet(_bcAddr);
                  const _isNative = /^0x0+$/i.test(_botPair.fromAddr || '') || (_botPair.fromAddr || '').toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
                  let _bcBal = 0n;
                  if (_isNative) {
                    _bcBal = await _bcProvider.getBalance(_bcWallet.address);
                  } else {
                    const _bcHex = await _bcProvider.call({ to: _botPair.fromAddr, data: '0x70a08231' + _bcWallet.address.slice(2).padStart(64, '0') });
                    if (_bcHex && _bcHex !== '0x') _bcBal = BigInt(_bcHex);
                  }
                  if (_bcBal > 0n) { _balOk = true; break; }
                  log('  ⏳ Check ' + _bc + '/2 — still empty', 'warn');
                } catch(_bce) { log('  ⚠️ Balance check error: ' + (_bce.message||'').slice(0,60), 'warn'); }
              }
              if (!_balOk) {
                log('  ⚠️ Swap ' + swapNum + '/' + swapCount + ' skipped', 'warn');
                _totalSkip++;
                _swapDone = false;
                break;
              }
              // Balance found — retry the swap
              continue;
            }
            if (_retry < 2) {
              log('  🔁 Retry ' + (_retry + 1) + '/2 — ' + _msg.slice(0, 80), 'warn');
              await delay(2000 + Math.random() * 1000);
            } else {
              throw _re;
            }
          }
        }
        if (_swapDone) _totalSuccess++;

        if (progBar) progBar.style.width = Math.round(((s + 1) / swapCount) * 100) + '%';
        if (progLabel) progLabel.textContent = (s + 1) + '/' + swapCount;

        // ── If this was the last key's last swap → stop bot ──
        if (isLastSwap && isLastWallet) {
          swapBotRunning = false;
          if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txEnd(); // BG: release wake lock
          const elapsed2 = Date.now() - _runStart;
          const mins2 = Math.floor(elapsed2 / 60000), secs2 = Math.floor((elapsed2 % 60000) / 1000);
          log('🏁 ── BOT COMPLETE ──────────────────', 'purple');
          log('✅ Successful: ' + _totalSuccess, 'success');
          log('⏭️ Skipped:    ' + _totalSkip,   _totalSkip > 0 ? 'warn' : 'info');
          log('❌ Failed:     ' + _totalFail,   _totalFail > 0 ? 'error' : 'info');
          log('⏱ Time:       ' + (mins2 > 0 ? mins2 + 'm ' : '') + secs2 + 's', 'cyan');
          log('🔁 last swap  W#' + _botKeys.length + ' → W#1', 'warn');
          if (termStatus) { termStatus.className = 'term-status-badge done'; termStatus.textContent = '✅ DONE'; }
          if (typeof window._updateAllToolBadges === 'function') window._updateAllToolBadges();
          showToast && showToast('✅ Swap Bot done! ' + _totalSuccess + ' success', 'check_circle');
          _oneSendNotif('One Wallet', '✅ Swap Bot done! ' + _totalSuccess + ' success');
          resetRunBtn(false);
          break;
        }

        if (s < swapCount - 1) await delay(1500 + Math.random() * 1000);
      } catch(e) {
        _totalFail++;
        log('  ❌ Swap ' + (s + 1) + ' failed: ' + (e.message || '').slice(0, 120), 'error');
      }
    }

    if (progStatus) progStatus.textContent = swapBotRunning ? '✅' : '⛔';
    if (!swapBotRunning) break;
    if (i < _botKeys.length - 1) await delay(1200 + Math.random() * 800);
  }

  if (swapBotRunning) {
    // Completed normally
    const elapsed = Date.now() - _runStart;
    const mins = Math.floor(elapsed / 60000), secs = Math.floor((elapsed % 60000) / 1000);
    log('🏁 ── BOT COMPLETE ──────────────────', 'purple');
    log('✅ Successful: ' + _totalSuccess, 'success');
    log('⏭️ Skipped:    ' + _totalSkip,   _totalSkip > 0 ? 'warn' : 'info');
    log('❌ Failed:     ' + _totalFail,   _totalFail > 0 ? 'error' : 'info');
    log('⏱ Time:       ' + (mins > 0 ? mins + 'm ' : '') + secs + 's', 'cyan');
    log('🔁 last swap  W#' + _botKeys.length + ' → W#1', 'warn');
    swapBotRunning = false;
    if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txEnd(); // BG: release wake lock
    if (typeof window._updateAllToolBadges === 'function') window._updateAllToolBadges();
    if (termStatus) { termStatus.className = 'term-status-badge done'; termStatus.textContent = '✅ DONE'; }
    showToast && showToast('✅ Swap Bot done! ' + _totalSuccess + ' success', 'check_circle');
    _oneSendNotif('One Wallet', '✅ Swap Bot done! ' + _totalSuccess + ' success');
    resetRunBtn(false);
  }
}

// ══════════════════════════════════════════════
// PAYMASTER / BUNDLER CONFIG
// ══════════════════════════════════════════════

const PAYMASTER_URL_KEY = 'one_paymaster_url';
const DEFAULT_PAYMASTER_URL = 'https://api.developer.coinbase.com/rpc/v1/base/A6jXZc7eEPBCQQEErk6jTcw5LRWUnwzv';

// EntryPoint v0.6 (Coinbase Paymaster requires v0.6)
const ENTRYPOINT_V06 = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';

function getPaymasterUrl() {
  return localStorage.getItem(PAYMASTER_URL_KEY) || DEFAULT_PAYMASTER_URL;
}
function savePaymasterUrl() {
  const val = document.getElementById('paymaster-url-input')?.value.trim();
  const st = document.getElementById('paymaster-url-status');
  if (val) {
    localStorage.setItem(PAYMASTER_URL_KEY, val);
    if (typeof _updateAllPaymasterInputs === 'function') _updateAllPaymasterInputs(val);
    if (st) { st.textContent = '✓ Saved'; st.style.color = 'var(--accent-green)'; }
  } else {
    // Empty input — silently restore default and warn user
    if (st) { st.textContent = '⚠ Empty — default restored'; st.style.color = 'var(--accent-amber)'; }
    localStorage.setItem(PAYMASTER_URL_KEY, DEFAULT_PAYMASTER_URL);
    if (typeof _updateAllPaymasterInputs === 'function') _updateAllPaymasterInputs(DEFAULT_PAYMASTER_URL);
  }
}
function setDefaultPaymasterUrl() {
  localStorage.setItem(PAYMASTER_URL_KEY, DEFAULT_PAYMASTER_URL);
  if (typeof _updateAllPaymasterInputs === 'function') _updateAllPaymasterInputs(DEFAULT_PAYMASTER_URL);
  const st = document.getElementById('paymaster-url-status');
  if (st) { st.textContent = '✓ Default set'; st.style.color = 'var(--accent-green)'; }
}
function onPaymasterToggle() {
  const isOn = (document.getElementById('toggle-paymaster') || document.getElementById('cfg-paymaster'))?.classList.contains('on');
  const gasEl = document.getElementById('sum-gas');
  if (gasEl) {
    gasEl.textContent = isOn ? 'FREE (PAYMASTER)' : 'WALLET GAS (EOA)';
    gasEl.style.color = isOn ? 'var(--accent-green)' : 'var(--accent-amber)';
  }
  // Show/hide the URL panel to match toggle state
  const urlPanel = document.getElementById('cfg-paymaster-url-panel');
  if (urlPanel) urlPanel.style.display = isOn ? 'flex' : 'none';
  // Keep chevron in sync
  const chevron = document.querySelector('.cfg-pm-chevron');
  if (chevron) chevron.style.transform = isOn ? 'rotate(180deg)' : 'rotate(0deg)';
}
function isPaymasterEnabled() {
  return (document.getElementById('toggle-paymaster') || document.getElementById('cfg-paymaster'))?.classList.contains('on') ?? true;
}
function isSwapPaymasterEnabled() {
  // Swap-specific paymaster toggle (Swap Modes page only)
  var el = document.getElementById('swap-modes-paymaster');
  return el ? el.classList.contains('on') : true;
}
// ── Settings page: Base Paymaster URL helpers ──
function _updateAllPaymasterInputs(val) {
  // Keep all paymaster URL inputs in sync (Settings, config panel, and Swap Bot)
  ['paymaster-url-input', 'settings-paymaster-url-input', 'bsb-pm', 'sup-rpc'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = val;
  });
  // Update subtitle in settings
  var sub = document.getElementById('settings-pm-sub');
  if (sub) {
    var short = val.length > 38 ? val.slice(0, 38) + '…' : val;
    sub.textContent = short;
  }
}
function syncPaymasterUrlFromSettings(val) {
  // Live-sync the config page input while typing
  var cfg = document.getElementById('paymaster-url-input');
  if (cfg) cfg.value = val;
}
function savePaymasterUrlFromSettings() {
  var val = (document.getElementById('settings-paymaster-url-input') || {}).value;
  val = val ? val.trim() : '';
  var st = document.getElementById('settings-pm-status');
  if (val) {
    localStorage.setItem(PAYMASTER_URL_KEY, val);
    _updateAllPaymasterInputs(val);
    if (st) { st.textContent = '✓ Saved'; st.style.color = 'var(--accent-green)'; }
    setTimeout(function(){ if (st) st.textContent = ''; }, 2500);
    showToast('Paymaster URL saved', 'check_circle');
  } else {
    if (st) { st.textContent = '⚠ Empty — default restored'; st.style.color = 'var(--accent-amber)'; }
    setTimeout(function(){ if (st) st.textContent = ''; }, 2500);
    setDefaultPaymasterUrlFromSettings();
  }
}
function setDefaultPaymasterUrlFromSettings() {
  localStorage.setItem(PAYMASTER_URL_KEY, DEFAULT_PAYMASTER_URL);
  _updateAllPaymasterInputs(DEFAULT_PAYMASTER_URL);
  var st = document.getElementById('settings-pm-status');
  if (st) { st.textContent = '✓ Default set'; st.style.color = 'var(--accent-green)'; }
  setTimeout(function(){ if (st) st.textContent = ''; }, 2500);
}

function restorePaymasterUrl() {
  const saved = localStorage.getItem(PAYMASTER_URL_KEY);
  const val = saved || DEFAULT_PAYMASTER_URL;
  // Populate all paymaster URL inputs
  ['paymaster-url-input', 'settings-paymaster-url-input', 'bsb-pm', 'sup-rpc'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = val;
  });
  // Update settings subtitle
  const sub = document.getElementById('settings-pm-sub');
  if (sub) { var short = val.length > 38 ? val.slice(0,38) + '…' : val; sub.textContent = short; }
  // Restore toggle ON/OFF state
  const savedState = localStorage.getItem('one_paymaster_enabled');
  if (savedState !== null) {
    ['cfg-paymaster', 'toggle-paymaster', 'settings-cfg-paymaster'].forEach(function(id) {
      const el = document.getElementById(id);
      if (el) {
        if (savedState === 'on') el.classList.add('on');
        else el.classList.remove('on');
      }
    });
  }
  // Restore swap-specific paymaster toggle separately
  var savedSwapState = localStorage.getItem('one_swap_paymaster_enabled');
  var swapPmEl = document.getElementById('swap-modes-paymaster');
  if (swapPmEl) {
    if (savedSwapState === 'off') swapPmEl.classList.remove('on');
    else swapPmEl.classList.add('on'); // default ON
  }
}