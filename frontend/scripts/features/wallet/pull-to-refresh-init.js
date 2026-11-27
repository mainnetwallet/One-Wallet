(function (__NX) {
'use strict';
__NX._initPTR = _initPTR;
  /* Trigger a live price + balance refresh using existing app functions */
  /* ─── PULL TO REFRESH — per-page isolated, preserves app state ─── */
  function _initPTR() {
    var indicator = document.getElementById('ptr-indicator-global');
    var arc       = document.getElementById('gptr-arc');
    var label     = document.getElementById('gptr-label');
    if (!indicator || indicator._ptrReady) return;
    indicator._ptrReady = true;

    var CIRCUMFERENCE = 53.4;
    var PTR_THRESHOLD = 260;
    var PTR_DEAD_ZONE = 160;
    var refreshing = false;

    // ── Per-page refresh actions — only affects current page, preserves state ──
    function _refreshCurrentPage(page, onDone) {
      // Accept explicit page param — never fall back to window.currentPage to avoid wrong-page refresh
      if (typeof page === 'function') { onDone = page; page = null; }
      if (!page) page = window.currentPage || 'home';
      try {
        if (page === 'home') {
          // ── Force price cache stale so fresh prices are fetched ──
          if (typeof window._globalPriceCacheTime !== 'undefined') window._globalPriceCacheTime = 0;

          // ── Load tokens — RPC will overwrite cache with fresh balances ──
          if (typeof window.loadTokens === 'function') window.loadTokens();

          // ── silentPriceRefresh: fetch price + balance → update USD → sort → save ──
          setTimeout(function() {
            if (typeof window.silentPriceRefresh === 'function') {
              window.silentPriceRefresh().then(function() {
                // Save balance cache
                if (typeof window._saveBalanceCache === 'function') window._saveBalanceCache();
                // Save token list snapshot (list + balance + price)
                if (typeof window._onePTRSaveNow === 'function') window._onePTRSaveNow();
                // Signal PTR indicator done
                if (typeof onDone === 'function') onDone();
              }).catch(function() {
                if (typeof onDone === 'function') onDone();
              });
            } else {
              if (typeof onDone === 'function') onDone();
            }
          }, 400);

        } else if (page === 'swap') {
          // Pull-to-refresh: clear form, quotes, errors, in-memory state — keep chain/tokens/wallet intact
          try {
            // ── Cancel any in-flight quote fetches first ──
            if (typeof SW !== 'undefined') {
              clearTimeout(SW.quoteTimer);
              clearInterval(SW.scanDexInterval);
              SW.quoteTimer        = null;
              SW.scanDexInterval   = null;
              SW._fetchId          = (SW._fetchId || 0) + 1;   // invalidates promise chains
              SW._quoteSession     = (SW._quoteSession || 0) + 2; // invalidates async callbacks
              SW._cachedSwapTx     = null;
              SW._cachedRouterAddr = null;
              SW._routerCache      = {};
              SW._routeFetching    = false;
              SW.quotes            = [];
              SW.toAmount          = 0;
              SW.fromAmount        = '';
              SW._manualDexName    = null;
              SW._manualDexIdx     = null;
              SW._manualRouteKey   = null;
              SW._userSelectedDexIdx = null;
            }
            // ── Clear from-amount input + USD display ──
            var _swFromAmt = document.getElementById('sw-from-amount');
            if (_swFromAmt) { _swFromAmt.value = ''; }
            var _swFromUsd = document.getElementById('sw-from-usd');
            if (_swFromUsd) _swFromUsd.textContent = '≈ $—';
            // ── Clear to-amount + USD ──
            var _swToAmt = document.getElementById('sw-to-amount');
            if (_swToAmt) _swToAmt.textContent = '—';
            var _swToUsd = document.getElementById('sw-to-usd');
            if (_swToUsd) _swToUsd.textContent = '≈ $0.00';
            // ── Reset % slider ──
            var _swPctRange = document.getElementById('sw-pct-range');
            if (_swPctRange) _swPctRange.value = '0';
            var _swPctFill = document.getElementById('sw-pct-fill');
            if (_swPctFill) _swPctFill.style.width = '0%';
            var _swPctThumb = document.getElementById('sw-pct-thumb');
            if (_swPctThumb) _swPctThumb.style.display = 'none';
            var _swPctDisp = document.getElementById('sw-pct-display');
            if (_swPctDisp) _swPctDisp.textContent = '0%';
            // ── Hide all quote/error/info panels ──
            ['sw-error-box','sw-quote-loading','sw-dex-compare',
             'sw-info-panel','sw-slip-quick','sw-selected-dex-badge','sw-split-badge'].forEach(function(id) {
              var el = document.getElementById(id);
              if (el) { el.style.display = 'none'; if (id === 'sw-error-box') el.textContent = ''; }
            });
            // ── Clear dex list content ──
            var _swDexList = document.getElementById('sw-dex-list');
            if (_swDexList) _swDexList.innerHTML = '';
            // ── Clear scan-dex-name text ──
            var _swScanName = document.getElementById('sw-scan-dex-name');
            if (_swScanName) { _swScanName.textContent = ''; _swScanName.style.display = 'none'; }
            // ── Hide legacy tx progress elements ──
            ['sw-step-indicator','sw-tx-progress-label','sw-tx-progress-sub',
             'sw-tx-spinner','sw-tx-hash-row','sw-approve-retry-row'].forEach(function(id) {
              var el = document.getElementById(id); if (el) el.style.display = 'none';
            });
            // ── Dismiss success overlay if it got stuck ──
            var _swSuccOv = document.getElementById('sw-success-overlay');
            if (_swSuccOv && _swSuccOv.classList.contains('sso-visible')) {
              _swSuccOv.classList.remove('sso-visible');
              setTimeout(function() { _swSuccOv.style.display = 'none'; }, 420);
            }
            // ── Dismiss tx-progress overlay if stuck ──
            var _swTxOv = document.getElementById('sw-tx-progress');
            if (_swTxOv && _swTxOv.classList.contains('txp-visible')) {
              _swTxOv.classList.remove('txp-visible');
              setTimeout(function() { _swTxOv.style.display = 'none'; }, 360);
            }
            // ── Reset action button to "Enter Amount" state ──
            if (typeof window.swUpdateButton === 'function') window.swUpdateButton();
          } catch(e) {}
          // ── Refresh live balances (keep wallet/chain intact) ──
          if (typeof window._swUpdateConnectBtn === 'function') window._swUpdateConnectBtn();
          if (typeof window.swUpdateBalances === 'function') window.swUpdateBalances();
          if (typeof window._swFetchFromBalanceLive === 'function') window._swFetchFromBalanceLive();

        } else if (page === 'bridge') {
          // Pull-to-refresh: clear form, quotes, errors — keep chain/tokens/wallet intact
          try {
            // ── Cancel in-flight quote debounce ──
            if (typeof br !== 'undefined') {
              clearTimeout(br.quoteDebounce);
              clearTimeout(br.recipientDebounce);
              br.quoteDebounce    = null;
              br.recipientDebounce = null;
              br.routes           = [];
              br.selectedRoute    = null;
              br.txHash           = null;
              br._routeSession    = (br._routeSession || 0) + 1; // cancel any in-flight brFetchRoutes
            }
            // ── Clear amount input + USD ──
            var _brFromAmt = document.getElementById('br-from-amount');
            if (_brFromAmt) { _brFromAmt.blur(); _brFromAmt.readOnly = true; _brFromAmt.value = ''; _brFromAmt.readOnly = false; }
            var _brFromUsd = document.getElementById('br-from-usd');
            if (_brFromUsd) _brFromUsd.textContent = '≈ $0.00';
            // ── Clear to-amount + USD ──
            var _brToAmt = document.getElementById('br-to-amount');
            if (_brToAmt) _brToAmt.textContent = '—';
            var _brToUsd = document.getElementById('br-to-usd');
            if (_brToUsd) _brToUsd.textContent = '≈ $0.00';
            // ── Reset % slider ──
            var _brSlider = document.getElementById('br-pct-slider');
            if (_brSlider) _brSlider.value = '0';
            var _brFill = document.getElementById('br-slider-track-fill');
            if (_brFill) _brFill.style.width = '0%';
            var _brPctLbl = document.getElementById('br-pct-label');
            if (_brPctLbl) _brPctLbl.textContent = '0%';
            // ── Hide routes, quote loading, errors ──
            ['br-quote-loading','br-quote-error','br-routes-found-label'].forEach(function(id) {
              var el = document.getElementById(id);
              if (el) { el.style.display = 'none'; if (id === 'br-quote-error') el.textContent = ''; }
            });
            var _brRoutesList = document.getElementById('br-routes-list');
            if (_brRoutesList) { _brRoutesList.style.display = 'none'; _brRoutesList.innerHTML = ''; }
            // ── Hide slippage row if visible ──
            var _brSlipRow = document.getElementById('br-slippage-row');
            if (_brSlipRow) _brSlipRow.style.display = 'none';
            // ── Dismiss success overlay if stuck ──
            var _brSuccOv = document.getElementById('br-success-overlay');
            if (_brSuccOv && _brSuccOv.classList.contains('bso-visible')) {
              _brSuccOv.classList.remove('bso-visible');
              setTimeout(function() { _brSuccOv.style.display = 'none'; }, 420);
            }
            // ── Reset exec button to idle state ──
            if (typeof window.brUpdateExecBtn === 'function') window.brUpdateExecBtn(false);
            // ── Reset recipient → "Default: same as sender" ──
            var _brRecInp = document.getElementById('br-recipient');
            if (_brRecInp) _brRecInp.value = '';
            var _brRecClear = document.getElementById('br-recipient-clear');
            if (_brRecClear) _brRecClear.style.display = 'none';
            if (typeof br !== 'undefined') br.recipientAddr = '';
            if (typeof window.brUpdateRecipientDisplay === 'function') window.brUpdateRecipientDisplay(false);
          } catch(e) {}
          // ── Refresh balance only — recent tx list is NOT cleared on PTR ──
          if (typeof window.brFetchFromBalance === 'function') window.brFetchFromBalance();

        } else if (page === 'profile') {
          if (typeof window.updateProfileStats === 'function') window.updateProfileStats();
          if (typeof window.applySettingsGroupSelection === 'function') window.applySettingsGroupSelection();

        } else if (page === 'settings') {
          // PTR disabled for settings — no action
        } else if (page === 'nansen') {
          // Refresh nansen page — re-sync wallet connection and balances
          if (typeof window._swUpdateConnectBtn === 'function') window._swUpdateConnectBtn();
          if (typeof window.swUpdateBalances === 'function') window.swUpdateBalances();
          if (typeof window._swFetchFromBalanceLive === 'function') window._swFetchFromBalanceLive();
          // PTR: recalculate swap counts + clear terminal log
          if (!swapBotRunning && typeof randomizeSwapCounts === 'function') randomizeSwapCounts();
          var _logEl = document.getElementById('log-output');
          if (_logEl && !swapBotRunning) _logEl.innerHTML = '';
        } else if (page === 'delegation') {
          // Refresh delegation page — re-sync chain, group select, and step state
          if (typeof window.delSyncActiveChain === 'function') window.delSyncActiveChain();
          if (typeof window.delPopulateGroupSelect === 'function') window.delPopulateGroupSelect();
          if (typeof window.updateProfileStats === 'function') window.updateProfileStats();
        } else if (page === 'transfer-hub') {
          // ── If Withdraw Manager sub-UI is open, PTR only affects Withdraw Manager ──
          var _wdUIOpen = (function() {
            var el = document.getElementById('withdrawManagerUI');
            return el && el.style.display !== 'none' && el.style.display !== '';
          })();
          if (_wdUIOpen) {
            // Abort any in-progress withdraw + reset loading state
            window._wdAborted = true;
            if (typeof _wdSetLoading === 'function') _wdSetLoading(false);
            // Reload contracts to refresh balances
            if (typeof loadAllContracts === 'function') {
              try { loadAllContracts(); } catch(_) {}
            }
            // Log refresh message
            var _wdLogEl = document.getElementById('logContainerWithdraw');
            if (_wdLogEl) {
              _wdLogEl.innerHTML += '<div class="log-line log-info">[INFO] Refreshed — contracts reloaded.</div>';
              _wdLogEl.scrollTop = _wdLogEl.scrollHeight;
            }
            if (typeof onDone === 'function') onDone();
            return;
          }
          // ── PTR: STOP all running TH transactions immediately ──
          try {
            window._thStopFlags = window._thStopFlags || {};
            ['selfTransfer','multiKeyNative','multiKeyToken','batchTransfer','balanceCheck',
             'approval','revokeApproval','w2wNative','w2wToken','nftDistribute','nftCollect'].forEach(function(k) {
              window._thStopFlags[k] = true;
            });
          } catch(_) {}
          // Pull-to-refresh: clear fields based on active section + mode
          try {
            var _thSection = (typeof localStorage !== 'undefined' && localStorage.getItem('transferHub_currentSection')) || 'dashboard';

            if (_thSection === 'phraseToKey') {
              var _ptk_phraseVis = (function() {
                var pc = document.getElementById('phraseModeContent');
                return pc && pc.style.display !== 'none';
              })();

              if (_ptk_phraseVis) {
                // ── Phrase → Key mode ──
                var _ptk_mnem = document.getElementById('mnemonicInput');
                if (_ptk_mnem) _ptk_mnem.value = '';
                var _ptk_pcBadge = document.getElementById('phraseCountBadge');
                if (_ptk_pcBadge) _ptk_pcBadge.textContent = '0 phrases';
                var _ptk_deriv = document.getElementById('derivationPath');
                if (_ptk_deriv) _ptk_deriv.value = "m/44'/60'/0'/0/0";
                var _ptk_numAddr = document.getElementById('numAddresses');
                if (_ptk_numAddr) _ptk_numAddr.value = '1';
                // Hide output section + clear generated keys
                var _ptk_outSec = document.getElementById('outputSection');
                if (_ptk_outSec) _ptk_outSec.style.display = 'none';
                var _ptk_genCont = document.getElementById('generatedKeysContainer');
                if (_ptk_genCont) _ptk_genCont.innerHTML = '';
                // Disable generate button
                var _ptk_genBtn = document.getElementById('generateKeysBtn');
                if (_ptk_genBtn) { _ptk_genBtn.disabled = true; _ptk_genBtn.style.opacity = '0.45'; _ptk_genBtn.style.cursor = 'not-allowed'; }

              } else {
                // ── Key → Address mode ──
                var _ptk_keys = document.getElementById('privateKeysInput');
                if (_ptk_keys) _ptk_keys.value = '';
                if (window.actualKeysStorage) window.actualKeysStorage['privateKeysInput'] = '';
                var _ptk_keyCnt = document.getElementById('keyCountBadge');
                if (_ptk_keyCnt) _ptk_keyCnt.textContent = '0 keys';
                var _ptk_addrCnt = document.getElementById('addressCount');
                if (_ptk_addrCnt) _ptk_addrCnt.textContent = '0';
                // Reset address results
                var _ptk_addrRes = document.getElementById('addressResults');
                if (_ptk_addrRes) _ptk_addrRes.innerHTML = '<div style="text-align:center;color:#808080;padding:60px 20px;"><div style="font-size:3rem;">🔐</div><div style="font-size:1.1rem;font-weight:600;">No addresses yet</div><div style="font-size:0.85rem;margin-top:8px;">Paste private keys above to convert</div></div>';
                // Log reset
                var _ptk_log = document.getElementById('logContainerKeyToAddress');
                if (_ptk_log) _ptk_log.innerHTML = '<div class="log-line log-info">[INFO] Refreshed. Paste private keys to convert to addresses.</div>';
              }

            } else if (_thSection === 'balanceCheck') {
              // Input field
              var _bcInput = document.getElementById('inputBalanceCheck');
              if (_bcInput) _bcInput.value = '';
              if (window.actualKeysStorage) window.actualKeysStorage['inputBalanceCheck'] = '';

              // Token address
              var _bcTok = document.getElementById('tokenAddressBalanceCheck');
              if (_bcTok) _bcTok.value = '';

              // Summary stats
              var _bcTotalAddr = document.getElementById('totalAddressesBalance');
              var _bcTotalBal  = document.getElementById('totalBalanceSum');
              if (_bcTotalAddr) _bcTotalAddr.textContent = '0';
              if (_bcTotalBal)  _bcTotalBal.textContent  = '0';

              // Results list reset
              var _bcResults = document.getElementById('balanceResultsList');
              if (_bcResults) _bcResults.innerHTML = '<div class="bc-none"><div class="bc-none-t">No results yet</div><div class="bc-none-s">Add wallets and tap Check balances</div></div>';

              // Check Balances button
              var _bcBtn = document.getElementById('checkBalancesBtn');
              if (_bcBtn) { _bcBtn.disabled = true; _bcBtn.style.opacity = '0.45'; _bcBtn.style.cursor = 'not-allowed'; }

              // Log reset
              var _bcLog = document.getElementById('logContainerBalanceCheck');
              if (_bcLog) _bcLog.innerHTML = '';

            } else if (_thSection === 'selfTransfer') {
              // Private keys
              var _stKeys = document.getElementById('privateKeysSelfTransfer');
              if (_stKeys) _stKeys.value = '';
              if (window.actualKeysStorage) window.actualKeysStorage['privateKeysSelfTransfer'] = '';
              var _stKeyCnt = document.getElementById('selfTransferKeyCount');
              if (_stKeyCnt) _stKeyCnt.textContent = '0 wallets';

              // Transaction settings
              var _stTxCnt = document.getElementById('txCountPerWallet');
              if (_stTxCnt) _stTxCnt.value = '1';
              var _stAmt = document.getElementById('amountPerTx');
              if (_stAmt) _stAmt.value = '0';

              // Token config
              var _stTokAddr = document.getElementById('tokenAddressSelfTransfer');
              if (_stTokAddr) _stTokAddr.value = '';
              var _stTokAmt = document.getElementById('tokenAmountPerTx');
              if (_stTokAmt) _stTokAmt.value = '';

              // Summary estimates
              var _stTotalTx = document.getElementById('totalTxEstimate');
              var _stTotalW  = document.getElementById('totalWalletsEstimate');
              var _stTxPerW  = document.getElementById('txPerWalletEstimate');
              if (_stTotalTx) _stTotalTx.textContent = '0';
              if (_stTotalW)  _stTotalW.textContent  = '0';
              if (_stTxPerW)  _stTxPerW.textContent  = '0';

              // Execute button
              var _stExec = document.getElementById('executeSelfTransferBtn');
              if (_stExec) { _stExec.disabled = true; _stExec.style.opacity = '0.45'; _stExec.style.cursor = 'not-allowed'; }

              // Log reset
              var _stLog = document.getElementById('logContainerSelfTransfer');
              if (_stLog) _stLog.innerHTML = '<div class="log-line log-info">[INFO] Refreshed. Configure settings and click Execute to start.</div>';

            } else if (_thSection === 'tokenApprovalManager') {
              // Private keys
              var _apKey = document.getElementById('privateKeyApproval');
              if (_apKey) _apKey.value = '';
              if (window.actualKeysStorage) window.actualKeysStorage['privateKeyApproval'] = '';

              // Key count badges + stat
              var _apCnt = document.getElementById('autoDetectCountApproval');
              if (_apCnt) _apCnt.textContent = '0 keys';
              var _apLoaded = document.getElementById('walletsLoadedApproval');
              if (_apLoaded) _apLoaded.textContent = '0';

              // Approval details
              var _apTok = document.getElementById('tokenAddressApproval');
              if (_apTok) _apTok.value = '';
              var _apSpend = document.getElementById('spenderAddressApproval');
              if (_apSpend) _apSpend.value = '';
              var _apAmt = document.getElementById('approvalAmount');
              if (_apAmt) _apAmt.value = '';

              // Success / Failed counters
              var _apSucc = document.getElementById('successCountApproval');
              var _apFail = document.getElementById('failedCountApproval');
              if (_apSucc) _apSucc.textContent = '0';
              if (_apFail) _apFail.textContent = '0';

              // Disable execute button
              var _apExec = document.getElementById('executeApprovalBtn');
              if (_apExec) { _apExec.disabled = true; _apExec.style.opacity = '0.45'; _apExec.style.cursor = 'not-allowed'; }

              // Log reset
              var _apLog = document.getElementById('logContainerApproval');
              if (_apLog) _apLog.innerHTML = '<div class="log-line log-info">[INFO] Refreshed. Enter wallet and approval details.</div>';

            } else if (_thSection === 'withdraw') {
              // ── Stop any in-progress withdraw transaction ──
              window._wdAborted = true;
              if (typeof _wdSetLoading === 'function') _wdSetLoading(false);
              // ── Deselect contract ──
              window.selectedWithdrawContract = null;
              if (typeof currentSelectedContract !== 'undefined') currentSelectedContract = null;
              window.isOwnerVerified = false;
              if (typeof isOwnerVerified !== 'undefined') isOwnerVerified = false;

              // Developer key + ownership status
              var _wdKey = document.getElementById('withdrawDeveloperKey');
              if (_wdKey) _wdKey.value = '';
              if (window.actualKeysStorage) window.actualKeysStorage['withdrawDeveloperKey'] = '';
              var _wdOS = document.getElementById('ownershipStatus');
              if (_wdOS) _wdOS.style.display = 'none';

              // Recipient + token address
              var _wdRecip = document.getElementById('withdrawRecipient');
              if (_wdRecip) _wdRecip.value = '';
              var _wdTokAddr = document.getElementById('withdrawTokenAddress');
              if (_wdTokAddr) _wdTokAddr.value = '';

              // Hide withdraw inputs + contract info, show empty state
              var _wdInputs = document.getElementById('withdrawInputs');
              if (_wdInputs) _wdInputs.style.display = 'none';
              var _wdSelBox = document.getElementById('selectedContractInfoBox');
              if (_wdSelBox) _wdSelBox.style.display = 'none';
              var _wdNone = document.getElementById('noContractSelected');
              if (_wdNone) _wdNone.style.display = 'block';

              // Reset selected contract display values
              var _wdSelContract = document.getElementById('selectedContract');
              var _wdSelBal = document.getElementById('selectedContractBalance');
              var _wdSelTokBal = document.getElementById('selectedContractTokenBalance');
              var _wdSelChain = document.getElementById('selectedContractChain');
              if (_wdSelContract) _wdSelContract.textContent = '-';
              if (_wdSelBal) _wdSelBal.textContent = '0.000000';
              if (_wdSelTokBal) _wdSelTokBal.textContent = '-';
              if (_wdSelChain) _wdSelChain.textContent = '-';

              // Disable withdraw buttons
              var _wdNativeBtn = document.getElementById('withdrawNativeBtn');
              var _wdTokenBtn  = document.getElementById('withdrawTokenBtn');
              if (_wdNativeBtn) { _wdNativeBtn.disabled = true; _wdNativeBtn.style.opacity = '0.45'; _wdNativeBtn.style.cursor = 'not-allowed'; }
              if (_wdTokenBtn)  { _wdTokenBtn.disabled  = true; _wdTokenBtn.style.opacity  = '0.45'; _wdTokenBtn.style.cursor = 'not-allowed'; }

              // Log reset
              var _wdLog = document.getElementById('logContainerWithdraw');
              if (_wdLog) _wdLog.innerHTML = '<div class="log-line log-info">[INFO] Refreshed. Select a contract to withdraw funds.</div>';

            } else if (_thSection === 'nftTransfer') {
              var _nftDistVis = (function() {
                var ds = document.getElementById('nftDistributeSection');
                return ds && ds.style.display !== 'none';
              })();

              if (_nftDistVis) {
                // ── Distribute (1 → Many) ──
                var _nftSK = document.getElementById('nftSenderKey');
                if (_nftSK) _nftSK.value = '';
                if (window.actualKeysStorage) window.actualKeysStorage['nftSenderKey'] = '';
                var _nftSWI = document.getElementById('nftSenderWalletInfo');
                if (_nftSWI) _nftSWI.style.display = 'none';
                var _nftSAddr = document.getElementById('nftSenderAddress');
                var _nftSStat = document.getElementById('nftSenderStatus');
                if (_nftSAddr) _nftSAddr.textContent = '-';
                if (_nftSStat) _nftSStat.textContent = '✅ Valid';
                var _nftRecip = document.getElementById('nftRecipientsDistribute');
                if (_nftRecip) _nftRecip.value = '';
                var _nftRecipCnt = document.getElementById('nftDistributeRecipientsCount');
                if (_nftRecipCnt) _nftRecipCnt.textContent = '0';
                var _nftContract = document.getElementById('nftContractAddress');
                if (_nftContract) _nftContract.value = '';
                var _nftTokenIds = document.getElementById('nftTokenIds');
                if (_nftTokenIds) _nftTokenIds.value = '';
                var _nftStd = document.getElementById('nftStandard');
                if (_nftStd) _nftStd.value = 'ERC721';
                // Reset NFT grid
                var _nftGrid = document.getElementById('nftGridDistribute');
                if (_nftGrid) _nftGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px 10px;color:#808080;"><div style="font-size:2rem;margin-bottom:6px;">🎨</div><div style="font-size:0.8rem;">No NFTs loaded</div><div style="font-size:0.72rem;margin-top:4px;color:#606060;">Click \"Fetch\" to load</div></div>';
                ['totalCountDistribute','selectedCountDistribute','nftDistributeTokenCount'].forEach(function(id) {
                  var el = document.getElementById(id); if (el) el.textContent = '0';
                });
                var _execNftD = document.getElementById('executeNftDistributeBtn');
                if (_execNftD) { _execNftD.disabled = true; _execNftD.style.opacity = '0.45'; _execNftD.style.cursor = 'not-allowed'; }

              } else {
                // ── Collect (Many → 1) ──
                var _nftSKeys = document.getElementById('nftSenderKeys');
                if (_nftSKeys) _nftSKeys.value = '';
                if (window.actualKeysStorage) window.actualKeysStorage['nftSenderKeys'] = '';
                var _nftCWCnt = document.getElementById('nftCollectWalletCount');
                if (_nftCWCnt) _nftCWCnt.textContent = '0';
                var _nftCRecip = document.getElementById('nftCollectRecipient');
                if (_nftCRecip) _nftCRecip.value = '';
                var _nftCRI = document.getElementById('nftCollectRecipientInfo');
                if (_nftCRI) _nftCRI.style.display = 'none';
                var _nftCRAddr = document.getElementById('nftCollectRecipientAddress');
                var _nftCRStat = document.getElementById('nftCollectRecipientStatus');
                if (_nftCRAddr) _nftCRAddr.textContent = '-';
                if (_nftCRStat) _nftCRStat.textContent = '✅ Valid';
                var _nftCContract = document.getElementById('nftContractAddressCollect');
                if (_nftCContract) _nftCContract.value = '';
                var _nftCTokenIds = document.getElementById('nftTokenIdsCollect');
                if (_nftCTokenIds) _nftCTokenIds.value = '';
                var _nftCStd = document.getElementById('nftStandardCollect');
                if (_nftCStd) _nftCStd.value = 'ERC721';
                var _nftCGrid = document.getElementById('nftGridCollect');
                if (_nftCGrid) _nftCGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px 10px;color:#808080;"><div style="font-size:2rem;margin-bottom:6px;">🎨</div><div style="font-size:0.8rem;">No NFTs loaded</div><div style="font-size:0.72rem;margin-top:4px;color:#606060;">Click \"Fetch\" to load</div></div>';
                ['totalCountCollect','selectedCountCollect'].forEach(function(id) {
                  var el = document.getElementById(id); if (el) el.textContent = '0';
                });
                var _execNftC = document.getElementById('executeNftCollectBtn');
                if (_execNftC) { _execNftC.disabled = true; _execNftC.style.opacity = '0.45'; _execNftC.style.cursor = 'not-allowed'; }
              }

              // Shared log + progress
              var _nftLog = document.getElementById('logContainerNft');
              if (_nftLog) _nftLog.innerHTML = '<div class="log-line log-info">[INFO] Refreshed. Ready to transfer NFTs.</div>';
              var _nftPF = document.getElementById('progressFillNft');
              if (_nftPF) _nftPF.style.width = '0%';

            } else if (_thSection === 'walletToWallet') {
              var _w2wNativeVis = (function() {
                var nf = document.getElementById('w2wNativeFields');
                return nf && nf.style.display !== 'none';
              })();

              if (_w2wNativeVis) {
                // Native mode: clear sender keys
                var _w2wSK = document.getElementById('w2wSenderKeys');
                if (_w2wSK) _w2wSK.value = '';
                // Clear receiver keys
                var _w2wRK = document.getElementById('w2wReceiverKeys');
                if (_w2wRK) _w2wRK.value = '';
                // Clear amount
                var _w2wAmt = document.getElementById('w2wCustomAmount');
                if (_w2wAmt) _w2wAmt.value = '';
                // Reset counters
                ['w2wSenderCount','w2wReceiverCount','w2wTotalSenders','w2wTotalReceivers'].forEach(function(id) {
                  var el = document.getElementById(id); if (el) el.textContent = '0';
                });
                // Disable execute btn
                var _w2wBtn = document.getElementById('executeW2WBtn');
                if (_w2wBtn) { _w2wBtn.disabled = true; _w2wBtn.style.opacity = '0.45'; _w2wBtn.style.cursor = 'not-allowed'; }
              } else {
                // Token mode: clear sender keys
                var _w2wSKT = document.getElementById('w2wSenderKeysToken');
                if (_w2wSKT) _w2wSKT.value = '';
                // Clear receiver keys
                var _w2wRKT = document.getElementById('w2wReceiverKeysToken');
                if (_w2wRKT) _w2wRKT.value = '';
                // Clear token contract + amount
                var _w2wTok = document.getElementById('w2wTokenContract');
                if (_w2wTok) _w2wTok.value = '';
                var _w2wAmtT = document.getElementById('w2wCustomAmountToken');
                if (_w2wAmtT) _w2wAmtT.value = '';
                // Reset counters
                ['w2wSenderCountToken','w2wReceiverCountToken'].forEach(function(id) {
                  var el = document.getElementById(id); if (el) el.textContent = '0';
                });
                // Disable execute btn
                var _w2wBtnT = document.getElementById('executeW2WTokenBtn');
                if (_w2wBtnT) { _w2wBtnT.disabled = true; _w2wBtnT.style.opacity = '0.45'; _w2wBtnT.style.cursor = 'not-allowed'; }
              }

              // Clear shared log
              var _w2wLog = document.getElementById('logSectionW2W');
              if (_w2wLog) _w2wLog.innerHTML = '';

            } else if (_thSection === 'multiKeyNative') {
              var _mkNativeVis = (function() {
                var nc = document.getElementById('multiKeyNativeModeContent');
                return nc && nc.style.display !== 'none';
              })();

              if (_mkNativeVis) {
                // Dev/Contract key (single sender)
                var _mkDevKey = document.getElementById('privateKeyMultiKeyNative');
                if (_mkDevKey) _mkDevKey.value = '';
                if (window.actualKeysStorage) { window.actualKeysStorage['privateKeyMultiKeyNative'] = ''; }
                var _mkWAddr = document.getElementById('walletAddressMultiKeyNative');
                var _mkWBal  = document.getElementById('walletBalanceMultiKeyNative');
                if (_mkWAddr) _mkWAddr.textContent = '-';
                if (_mkWBal)  _mkWBal.textContent  = '-';
                /* walletInfoBoxMultiKeyNative always visible — do not hide */
                // Sender keys (multi)
                var _mkSenderKeys = document.getElementById('senderPrivateKeysMultiKeyNative');
                if (_mkSenderKeys) _mkSenderKeys.value = '';
                if (window.actualKeysStorage) { window.actualKeysStorage['senderPrivateKeysMultiKeyNative'] = ''; }
                // Recipient
                var _mkRecip = document.getElementById('recipientAddressMultiKeyNative');
                if (_mkRecip) _mkRecip.value = '';
                var _mkRecipBox = document.getElementById('recipientInfoBoxMultiKeyNative');
                if (_mkRecipBox) _mkRecipBox.style.display = 'none';
                var _mkRecipAddr = document.getElementById('recipientAddressDisplayMultiKeyNative');
                var _mkRecipBal  = document.getElementById('recipientBalanceMultiKeyNative');
                if (_mkRecipAddr) _mkRecipAddr.textContent = '-';
                if (_mkRecipBal)  _mkRecipBal.textContent  = '-';
                // Amount
                var _mkAmt = document.getElementById('amountPerAddressMultiKeyNative');
                if (_mkAmt) _mkAmt.value = '';
                // Counters
                ['totalSendersMultiKeyNative','totalBalanceMultiKeyNative','perAddressDisplayMultiKeyNative','totalAmountMultiKeyNative'].forEach(function(id) {
                  var el = document.getElementById(id); if (el) el.textContent = '0';
                });
                // Log
                var _mkLog = document.getElementById('logContainerMultiKeyNative');
                if (_mkLog) _mkLog.innerHTML = '';
                if (typeof window.updateButtonStates === 'function') window.updateButtonStates();

              } else {
                // Token mode
                var _mkSenderT = document.getElementById('senderKeysMultiKeyToken');
                if (_mkSenderT) _mkSenderT.value = '';
                if (window.actualKeysStorage) { window.actualKeysStorage['senderKeysMultiKeyToken'] = ''; }
                var _mkRecipT = document.getElementById('recipientAddressMultiKeyToken');
                if (_mkRecipT) _mkRecipT.value = '';
                var _mkRecipBoxT = document.getElementById('recipientTokenInfoBoxMultiKeyToken');
                if (_mkRecipBoxT) _mkRecipBoxT.style.display = 'none';
                var _mkRecipAddrT = document.getElementById('recipientAddressDisplayMultiKeyToken');
                var _mkRecipBalT  = document.getElementById('recipientTokenBalanceMultiKeyToken');
                if (_mkRecipAddrT) _mkRecipAddrT.textContent = '-';
                if (_mkRecipBalT)  _mkRecipBalT.textContent  = '-';
                var _mkTokContract = document.getElementById('tokenContractAddressMultiKeyToken');
                var _mkTokSymbol   = document.getElementById('tokenSymbolMultiKeyToken');
                if (_mkTokContract) _mkTokContract.value = '';
                if (_mkTokSymbol)   _mkTokSymbol.value   = '';
                var _mkAmtT = document.getElementById('amountPerAddressMultiKeyToken');
                if (_mkAmtT) { _mkAmtT.value = '0'; }
                ['totalSendersMultiKeyToken','perAddressDisplayMultiKeyToken','totalAmountMultiKeyToken'].forEach(function(id) {
                  var el = document.getElementById(id); if (el) el.textContent = '0';
                });
                var _mkLogT = document.getElementById('logContainerMultiKeyToken');
                if (_mkLogT) _mkLogT.innerHTML = '<div class="log-line log-info">[INFO] Refreshed. Enter sender keys and token contract address.</div>';
                if (typeof window.updateButtonStates === 'function') window.updateButtonStates();
              }
            }
          } catch(e) {}

          // Pull-to-refresh on Batch Transfer: clear Wallet, Sender Keys, Recipients, Amount
          try {
            var _thSection = (typeof localStorage !== 'undefined' && localStorage.getItem('transferHub_currentSection')) || 'dashboard';
            if (_thSection === 'batchTransfer') {
              var _nativeVis = (function() {
                var nc = document.getElementById('nativeModeContent');
                return nc && nc.style.display !== 'none';
              })();

              if (_nativeVis) {
                // Native mode: clear private key
                var _pkEl = document.getElementById('privateKey');
                if (_pkEl) { _pkEl.value = ''; }
                if (window.actualKeysStorage) window.actualKeysStorage['privateKey'] = '';
                var _wAddr = document.getElementById('walletAddress');
                var _wBal  = document.getElementById('walletBalance');
                if (_wAddr) _wAddr.textContent = '-';
                if (_wBal)  _wBal.textContent  = '-';
                /* walletInfoBox always visible — do not hide */
                var _recvEl = document.getElementById('receiverAddresses');
                if (_recvEl) { _recvEl.value = ''; _recvEl.dispatchEvent(new Event('input', { bubbles: true })); }
                var _amtEl = document.getElementById('amountPerAddress');
                if (_amtEl) { _amtEl.value = '0'; _amtEl.dispatchEvent(new Event('input', { bubbles: true })); }
                var _totAddr = document.getElementById('totalAddresses');
                var _perAddr = document.getElementById('perAddressDisplay');
                var _totAmt  = document.getElementById('totalAmount');
                if (_totAddr) _totAddr.textContent = '0';
                if (_perAddr) _perAddr.textContent = '0';
                if (_totAmt)  _totAmt.textContent  = '0';
                var _logEl = document.getElementById('logContainer');
                if (_logEl) _logEl.innerHTML = '<div class="log-line log-info">[INFO] Refreshed. Enter sender key to begin.</div>';
                if (typeof window.checkDeployReady === 'function') window.checkDeployReady();

              } else {
                // Token mode: clear private key
                var _pkTEl = document.getElementById('privateKeyToken');
                if (_pkTEl) { _pkTEl.value = ''; }
                if (window.actualKeysStorage) window.actualKeysStorage['privateKeyToken'] = '';
                var _wAddrT = document.getElementById('walletAddressToken');
                var _wNatT  = document.getElementById('walletNativeBalanceToken');
                var _wTokT  = document.getElementById('walletTokenBalanceToken');
                if (_wAddrT) _wAddrT.textContent = '-';
                if (_wNatT)  _wNatT.textContent  = '-';
                if (_wTokT)  _wTokT.textContent  = '-';
                /* walletInfoBoxToken always visible — do not hide */
                var _recvTEl = document.getElementById('receiverAddressesToken');
                if (_recvTEl) { _recvTEl.value = ''; _recvTEl.dispatchEvent(new Event('input', { bubbles: true })); }
                var _recvBal = document.getElementById('recipientBalancesToken');
                if (_recvBal) _recvBal.style.display = 'none';
                var _amtTEl = document.getElementById('amountPerAddressToken');
                if (_amtTEl) { _amtTEl.value = '0'; _amtTEl.dispatchEvent(new Event('input', { bubbles: true })); }
                var _totAddrT = document.getElementById('totalAddressesToken');
                var _perAddrT = document.getElementById('perAddressDisplayToken');
                var _totAmtT  = document.getElementById('totalAmountToken');
                if (_totAddrT) _totAddrT.textContent = '0';
                if (_perAddrT) _perAddrT.textContent = '0';
                if (_totAmtT)  _totAmtT.textContent  = '0';
                var _logTEl = document.getElementById('logContainerToken');
                if (_logTEl) _logTEl.innerHTML = '';
                if (typeof window.validateTokenInputs === 'function') window.validateTokenInputs();
              }
            }
          } catch(e) {}
        }
      } catch(e) {}
    }

    // ── Transfer-Hub running-transactions check ──
    function _thHasRunning() {
      var _f = window._thStopFlags;
      return !!_f && Object.keys(_f).some(function(k){ return !_f[k] && k !== '__init'; });
    }
    // Shared stop-mode flag so _showRefreshing / _showDone can render correct labels
    var _ptrStopMode = false;

    function _setIndicator(dist) {
      if (dist < PTR_DEAD_ZONE) {
        indicator.style.transition = 'none';
        indicator.style.transform  = 'translateY(-100%)';
        indicator.style.opacity    = '0';
        return;
      }
      var active  = dist - PTR_DEAD_ZONE;
      var range   = PTR_THRESHOLD - PTR_DEAD_ZONE;
      var clamped = Math.min(1, active / range);
      indicator.style.transition = 'none';
      indicator.style.transform  = 'translateY(' + Math.round((clamped - 1) * 56) + 'px)';
      indicator.style.opacity    = clamped.toFixed(2);
      if (arc) arc.style.strokeDashoffset = (CIRCUMFERENCE * (1 - clamped)).toFixed(1);
      var ready = dist >= PTR_THRESHOLD;
      if (label) { label.textContent = ready ? 'Release to refresh' : 'Pull to refresh'; label.style.color = ready ? '#10b981' : '#a78bfa'; }
      if (arc)   { arc.style.stroke  = ready ? '#10b981' : '#6366f1'; }
    }

    function _showRefreshing() {
      refreshing = true;
      indicator.style.transition = 'transform 0.25s cubic-bezier(0.34,1.2,0.64,1), opacity 0.25s ease';
      indicator.style.transform  = 'translateY(0)';
      indicator.style.opacity    = '1';
      indicator.classList.add('ptr-spinning');
      if (arc)   { arc.style.strokeDashoffset = '0'; arc.style.stroke = '#6366f1'; }
      if (label) { label.textContent = _ptrStopMode ? 'Stopping…' : 'Refreshing…'; label.style.color = '#a78bfa'; }
    }

    function _showDone() {
      indicator.classList.remove('ptr-spinning');
      if (arc)   { arc.style.animation = 'none'; arc.style.strokeDashoffset = '0'; arc.style.stroke = '#10b981'; }
      if (label) { label.textContent = _ptrStopMode ? 'Stopped ✓' : 'Updated ✓'; label.style.color = '#10b981'; }
      _ptrStopMode = false;
      indicator.classList.remove('ptr-done');
      void indicator.offsetWidth;
      indicator.classList.add('ptr-done');
      setTimeout(function() {
        indicator.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        indicator.style.transform  = 'translateY(-100%)';
        indicator.style.opacity    = '0';
        indicator.classList.remove('ptr-spinning', 'ptr-done');
        refreshing = false;
      }, 1400);
    }

    function _attachPTR(scrollEl) {
      if (!scrollEl || scrollEl._ptrAttached) return;
      scrollEl._ptrAttached = true;
      var startY = 0, pulling = false, pullDist = 0, triggered = false;
      // Determine this element's page name — locked at attach time, never changes
      var pageId = scrollEl.id === 'home-token-scroll' ? 'page-home' : scrollEl.id === 'sw-scroll-body' ? 'page-swap' : scrollEl.id;
      var ownPage = pageId.replace('page-', ''); // e.g. 'home', 'swap', 'nansen', 'delegation'
      var isOverflowHidden = (scrollEl.id === 'page-bridge' || scrollEl.id === 'page-nansen' || scrollEl.id === 'page-delegation');

      function _isActive() {
        var el = document.getElementById(pageId) || scrollEl;
        // inner scroll containers — check the parent page element for active class
        if (scrollEl.id === 'sw-scroll-body') el = document.getElementById('page-swap') || scrollEl;

        return el.classList.contains('active');
      }

      function _canPull() {
        if (!_isActive() || refreshing) return false;
        // For overflow:hidden pages, always allow (no scrollTop to check)
        if (isOverflowHidden) return true;
        // transfer-hub: always allow PTR — scroll position check done in touchmove via startScrollTop
        if (ownPage === 'transfer-hub') return true;
        return scrollEl.scrollTop <= 0;
      }

      // Bridge page: #page-bridge itself never scrolls (overflow:hidden), the routes list scrolls inside
      // #br-routes-scroll-area. Pulling is only allowed while that list is at its top, otherwise scrolling
      // the list back up would count as a pull and refresh (clear) the page.
      function _innerScrollTop(target) {
        if (ownPage !== 'bridge') return 0;
        var sa = document.getElementById('br-routes-scroll-area');
        return (sa && target && sa.contains(target)) ? sa.scrollTop : 0;
      }

      var startScrollTop = 0;
      var startInnerTop = 0;
      var touchTarget = null;
      scrollEl.addEventListener('touchstart', function(e) {
        if (!_canPull()) return;
        startY = e.touches[0].clientY;
        startScrollTop = scrollEl.scrollTop;
        touchTarget = e.target;
        startInnerTop = _innerScrollTop(touchTarget);
        pulling = false; triggered = false; pullDist = 0;
      }, { passive: true });

      scrollEl.addEventListener('touchmove', function(e) {
        if (refreshing || !_isActive()) return;
        var dy = e.touches[0].clientY - startY;
        var _thForce = ownPage === 'transfer-hub' && _thHasRunning();

        // Activate pulling only if: finger moving DOWN + was at top when touch started
        if (!pulling) {
          if (dy <= 10) return; // not a downward pull gesture
          var _atTop = isOverflowHidden || startScrollTop === 0;
          if (!_atTop) return; // was scrolled down when touch started — ignore
          if (startInnerTop > 0 || _innerScrollTop(touchTarget) > 0) return; // inner list is scrolled — it is a scroll, not a pull
          pulling = true;
        }

        if (dy <= 0) { pulling = false; _setIndicator(0); return; }
        // Cancel if page scrolled during pull
        if (!isOverflowHidden && scrollEl.scrollTop > startScrollTop) { pulling = false; _setIndicator(0); return; }
        if (_innerScrollTop(touchTarget) > 0) { pulling = false; _setIndicator(0); return; } // inner list scrolled during the gesture
        pullDist = dy;
        // When TH is running use same threshold as normal PTR (260px)
        var _effThresh = PTR_THRESHOLD;
        // Don't show indicator until past dead zone
        if (dy < PTR_DEAD_ZONE) { _setIndicator(0); return; }
        var _normDy = dy > _effThresh ? _effThresh + (dy - _effThresh) * 0.2 : dy;
        _setIndicator(_normDy);
        // Stop-mode: use same PTR style, just change label text
        if (_thForce && label) {
          var _sReady = dy >= _effThresh;
          label.textContent = _sReady ? 'Release to stop' : 'Pull to stop';
        }
      }, { passive: true });

      scrollEl.addEventListener('touchend', function() {
        if (!pulling || refreshing) return;
        pulling = false;
        var _thForce = ownPage === 'transfer-hub' && _thHasRunning();
        var _effThresh = PTR_THRESHOLD;
        // Never refresh (which clears the route, amount and recipient) while a bridge execution is running.
        var _brBusy = ownPage === 'bridge' && !!window.brRunning;
        if (pullDist >= _effThresh && !triggered && !_brBusy) {
          triggered = true;
          _ptrStopMode = _thForce;
          _showRefreshing();
          // ── Use ownPage (locked at attach time) — never use window.currentPage ──
          // This guarantees PTR on nansen/delegation/settings stays on that page
          if (ownPage === 'home') {
            var _ptrDoneTimer = setTimeout(_showDone, 10000); // hard fallback 10s
            _refreshCurrentPage(ownPage, function() {
              clearTimeout(_ptrDoneTimer);
              _showDone();
            });
          } else {
            _refreshCurrentPage(ownPage);
            setTimeout(_showDone, _thForce ? 1000 : 2000);
          }
        } else {
          _setIndicator(0);
          setTimeout(function() {
            indicator.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
            indicator.style.transform  = 'translateY(-100%)';
            indicator.style.opacity    = '0';
          }, 50);
        }
      }, { passive: true });

      // A cancelled touch (system gesture, incoming call, palm rejection) never fires touchend, which used to
      // leave `pulling` set with a stale pullDist. Reset everything and hide the indicator.
      scrollEl.addEventListener('touchcancel', function() {
        pulling = false; triggered = false; pullDist = 0;
        if (refreshing) return;
        _setIndicator(0);
        setTimeout(function() {
          indicator.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
          indicator.style.transform  = 'translateY(-100%)';
          indicator.style.opacity    = '0';
        }, 50);
      }, { passive: true });
    }

    _attachPTR(document.getElementById('home-token-scroll'));
    // Swap page: attach PTR to the inner scroll body (page-swap is overflow:hidden so touch events land on the inner div)
    _attachPTR(document.getElementById('sw-scroll-body'));
    // Bridge page: attach PTR directly to page-bridge (overflow:hidden, captures all child touches)
    _attachPTR(document.getElementById('page-bridge'));
    ['profile', 'nansen', 'delegation', 'transfer-hub'].forEach(function(p) {
      _attachPTR(document.getElementById('page-' + p));
    });
  }
})((window.__nxp = window.__nxp || {}).mod_token_cache_pull_refresh = window.__nxp.mod_token_cache_pull_refresh || {});
