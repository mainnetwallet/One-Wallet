        
        function updateButtonStates() {
            // Use getActualKeys() where available to handle masked/actualKeysStorage fields
            const senderKeysRaw  = (window.getActualKeys ? window.getActualKeys('senderPrivateKeysMultiKeyNative') : document.getElementById('senderPrivateKeysMultiKeyNative').value).trim();
            const recipientAddress = document.getElementById('recipientAddressMultiKeyNative').value.trim();
            const rpcUrl         = document.getElementById('rpcUrlMultiKeyNative').value.trim();
            const developerKey   = (window.getActualKeys ? window.getActualKeys('privateKeyMultiKeyNative') : document.getElementById('privateKeyMultiKeyNative').value).trim();
            const amountRaw      = document.getElementById('amountPerAddressMultiKeyNative').value.trim();

            // ── Validate Developer / Wallet key ──────────────────────────────
            let hasWallet = false;
            if (developerKey) {
                // Strip all non-hex chars the same way updateDeveloperWalletMultiKeyNative does
                let cleaned = developerKey.replace(/["'`\s\r\n\t,;.]/g, '').replace(/0x0x/gi, '0x').replace(/0x/gi, '');
                if (/^[a-fA-F0-9]+$/.test(cleaned) && cleaned.length === 64) {
                    try { new ethers.Wallet('0x' + cleaned); hasWallet = true; } catch(e) {}
                }
            }

            // ── Validate Sender Keys — at least one valid 64-char hex key ────
            let hasSenderKeys = false;
            if (senderKeysRaw) {
                const lines = senderKeysRaw.split('\n').map(l => l.trim()).filter(Boolean);
                hasSenderKeys = lines.some(line => {
                    let h = line.replace(/\s+/g, '');
                    if (!h.startsWith('0x')) h = '0x' + h;
                    return h.length === 66 && /^0x[a-f0-9]{64}$/i.test(h);
                });
            }

            // ── Validate Recipient ────────────────────────────────────────────
            const hasRecipient = recipientAddress.length > 0 &&
                (ethers.isAddress(recipientAddress) || /^0x[a-f0-9]{40}/i.test(recipientAddress));

            // ── Validate Amount ───────────────────────────────────────────────
            const hasAmount = amountRaw === 'MAX' || (amountRaw && parseFloat(amountRaw) > 0);

            // ── Validate RPC ──────────────────────────────────────────────────
            const hasRpc = rpcUrl.length > 0;

            // ── Check if a saved contract is currently selected ───────────────
            const hasContractSelected = !!(activeContractAddressMultiKeyNative) ||
                savedContractsMultiKeyNative.some(c => c.isActive);

            // ────────────────────────────────────────────────────────────────
            // CONDITION 1 — Direct Transfer button
            // Requires: Developer Key + Sender Keys + Recipient + Amount + RPC
            // ────────────────────────────────────────────────────────────────
            const directReady = hasWallet && hasSenderKeys && hasRecipient && hasAmount && hasRpc;

            const directBtn = document.getElementById('executeDirectBtnMultiKeyNative');
            if (directBtn) directBtn.disabled = !directReady;

            // ────────────────────────────────────────────────────────────────
            // Via Contract needs all fields including Wallet key
            // ────────────────────────────────────────────────────────────────
            const contractReady = hasWallet && hasSenderKeys && hasRecipient && hasAmount && hasRpc;

            // CONDITION 2 — Contract selected → Execute ON, Deploy OFF
            // CONDITION 3 — No contract     → Deploy ON,   Execute OFF
            const deployBtn  = document.getElementById('deployBtnMultiKeyNative');
            const executeBtn = document.getElementById('executeBtnMultiKeyNative');

            if (hasContractSelected) {
                if (executeBtn) executeBtn.disabled = !contractReady;
                if (deployBtn)  deployBtn.disabled  = true;
            } else {
                if (deployBtn)  deployBtn.disabled  = !contractReady;
                if (executeBtn) executeBtn.disabled  = true;
            }
        }
        
        // Direct transfer to single recipient
        async function executeDirectTransferMultiKeyRecipients() {
            window._thStopFlags = window._thStopFlags || {}; window._thStopFlags['multiKeyNative'] = false;
            const executeDirectBtn = document.getElementById('executeDirectBtnMultiKeyNative');
            const btnOriginalText = executeDirectBtn.innerHTML;
            
            // Mark transaction as in progress for background execution
            isTransactionInProgress = true;
            if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txStart(); // BG: wake lock
            
            try {
                // Add loading state
                executeDirectBtn.classList.add('loading');
                executeDirectBtn.disabled = true;
                executeDirectBtn.innerHTML = '⏳ Executing...';
                
                                
                // ---------- read inputs ----------
                const rpcUrl        = document.getElementById('rpcUrlMultiKeyNative').value.trim();
                const _thRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('rpcUrlMultiKeyNative') : (rpcUrl ? [rpcUrl] : []);
                const _thChainId = parseInt((document.getElementById('rpcUrlMultiKeyNative')||{}).getAttribute?.('data-chainid')||'',10)||null;
                const senderKeysRaw = document.getElementById('senderPrivateKeysMultiKeyNative').value.trim();
                const recipientRaw  = document.getElementById('recipientAddressMultiKeyNative').value.trim();
                const tokenAddress  = document.getElementById('tokenContractAddressMultiKeyToken').value.trim();
                const amount        = document.getElementById('amountPerAddressMultiKeyNative').value.trim();
                const tokenSymbol   = document.getElementById('tokenSymbolMultiKeyToken').value.trim() || 'TOKEN';
                const tokenDecimals = parseInt(document.getElementById('tokenDecimalsMultiKeyToken').value || '18');

                // ---------- validation ----------
                if (!rpcUrl) { logMessageMultiKeyNative('error', '❌ RPC URL is empty'); throw Object.assign(new Error('RPC URL is empty'), {_validationSilent:true}); }
                if (!senderKeysRaw) { logMessageMultiKeyNative('error', '❌ No sender keys'); throw Object.assign(new Error('No sender keys'), {_validationSilent:true}); }
                
                // Allow MAX mode or valid numeric amount
                const isMaxMode = amount.toUpperCase() === 'MAX';
                if (!isMaxMode && (!amount || parseFloat(amount) <= 0)) { 
                    logMessageMultiKeyNative('error', '❌ Amount must be > 0 or click MAX button'); 
                    throw Object.assign(new Error('Invalid amount'), {_validationSilent:true});
                }

                // resolve recipient (key → address or raw address)
                const recipientAddress = resolveRecipientAddress(recipientRaw);
                if (!recipientAddress) { logMessageMultiKeyNative('error', '❌ Invalid recipient — paste a valid address or private key'); throw Object.assign(new Error('Invalid recipient'), {_validationSilent:true}); }

                // ---------- parse & sanitise sender keys ----------
                const senderKeys = senderKeysRaw
                    .split('\n')
                    .map(l => l.trim())
                    .filter(l => l.length > 0)
                    .map(l => sanitisePrivateKey(l))
                    .filter(k => /^0x[a-f0-9]{64}$/.test(k));

                if (senderKeys.length === 0) { logMessageMultiKeyNative('error', '❌ No valid sender keys found'); throw Object.assign(new Error('No valid sender keys'), {_validationSilent:true}); }

                // Recipient + Amount logs removed
                

                // ---------- setup ----------
                // FIX: use thWithFallback for automatic multi-RPC failover
                let provider;
                try {
                  provider = await window.thWithFallback('rpcUrlMultiKeyNative', async function(_p) {
                    await Promise.race([_p.getBlockNumber(), new Promise((_,r)=>setTimeout(()=>r(new Error('probe timeout')),5000))]);
                    return _p;
                  }, 5000);
                } catch(_thErr) {
                  const _fbCid62984 = parseInt((document.getElementById('rpcUrlMultiKeyNative')||{}).getAttribute?.('data-chainid')||'',10)||null;
                  provider = window._thMakeProvider(rpcUrl, _fbCid62984);
                }
                const progressEl = document.getElementById('progressFillMultiKeyNative');
                if (progressEl) progressEl.style.width = '0%';

                let totalSuccessfulTransfers = 0;
                let totalFailedTransfers = 0;
                let totalSkippedTransfers = 0;
                let totalAmountSent = 0n;

                // ---------- per-wallet transfer ----------
                for (let i = 0; i < senderKeys.length; i++) {
                    if (window._thStopFlags && window._thStopFlags['multiKeyNative']) { logMessageMultiKeyNative('warning', '⛔ Stopped by Pull-to-Refresh'); break; }
                    const senderNum = i + 1;
                    const wallet = new ethers.Wallet(senderKeys[i], provider);
                    
                    
                    try {
                        // Check balance (RPC failover; a failure here must only skip THIS wallet, not abort the whole run)
                        const balance = await window.thRead('rpcUrlMultiKeyNative', provider, function(_p) { return _p.getBalance(wallet.address); }, 6000);
                        const balanceEth = ethers.formatEther(balance);
                        // Skip if balance is zero
                        if (balance === 0n) {
                            logMessageMultiKeyNative('warning', `   💤 [${senderNum}] Balance is 0 — SKIPPED`);
                            totalSkippedTransfers++;
                            continue;
                        }
                        
                        let transferAmount;
                        let estimatedGasCost;
                        let txOptions = {};
                        
                        // ── Gas estimation (for MAX mode balance math) ──
                        const feeData = await window.thRead('rpcUrlMultiKeyNative', provider, function(_p) { return _p.getFeeData(); }, 6000);
                        let estimatedGasUnits = 21000n;
                        let isL2Chain = false;
                        
                        if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
                            const block = await window.thRead('rpcUrlMultiKeyNative', provider, function(_p) { return _p.getBlock('latest'); }, 6000);
                            let baseFee = block.baseFeePerGas;
                            if (!baseFee) baseFee = feeData.maxFeePerGas;
                            isL2Chain = baseFee < 10000000n; // 0.01 gwei
                            let estMaxFee;
                            if (isL2Chain) {
                                estMaxFee = baseFee * 2n;
                            } else {
                                estMaxFee = (baseFee * 110n) / 100n;
                            }
                            estimatedGasCost = estMaxFee * estimatedGasUnits;
                        } else if (feeData.gasPrice) {
                            const _estGP = (feeData.gasPrice * 110n) / 100n;
                            estimatedGasCost = _estGP * estimatedGasUnits;
                        } else {
                            estimatedGasCost = ethers.parseUnits('0.0005', 'ether');
                        }
                        
                        // ── OneGas AI gas (AUTO / EIP-1559 / LEGACY) ──
                        const _mkdGas = await window._thGas(provider);
                        Object.assign(txOptions, _mkdGas);

                        
                        // ⛔ PTR guard — re-check after async gas estimation
                        if (window._thStopFlags && window._thStopFlags['multiKeyNative']) { break; }

                        if (isMaxMode) {
                            // MAX MODE: Send full balance minus gas
                            
                            // Check if balance can cover gas
                            if (balance <= estimatedGasCost) {
                                logMessageMultiKeyNative('warning', `   ⚠️ [${senderNum}] Insufficient balance to cover gas — SKIPPED`);
                                                                totalSkippedTransfers++;
                                continue;
                            }
                            
                            // Calculate max transferable (balance - gas with buffer)
                            // For L2 chains or small balances, use much larger buffer due to L1 data costs
                            let bufferMultiplier;
                            if (isL2Chain) {
                                // L2 chains have L1 data posting costs - need 200-300% buffer
                                bufferMultiplier = 300n; // 3x the estimated gas
                            } else if (balance < ethers.parseEther('0.001')) {
                                // Very small balance - use larger buffer
                                bufferMultiplier = 200n; // 2x the estimated gas
                            } else {
                                // Normal case - 30% buffer
                                bufferMultiplier = 130n;
                            }
                            
                            const gasBuffer = (estimatedGasCost * bufferMultiplier) / 100n;
                            transferAmount = balance - gasBuffer;

                            // FIX: nodes require balance >= value + gasLimit * maxFeePerGas. The heuristic buffer above ignores the
                            // tip, so on chains like Polygon the MAX amount left too little and every send failed with -32000.
                            // Reserve the real worst-case fee from the gas options we are actually going to send with.
                            try {
                                const _feeCap = txOptions.maxFeePerGas || txOptions.gasPrice;
                                if (_feeCap) {
                                    let _gl = 21000n;
                                    try { _gl = await window.thRead('rpcUrlMultiKeyNative', provider, function(_p) { return _p.estimateGas({ from: wallet.address, to: recipientAddress, value: 1n }); }, 6000); } catch(_) {}
                                    const _reserve = (_feeCap * _gl * 110n) / 100n;
                                    if (balance - _reserve < transferAmount) transferAmount = balance - _reserve;
                                    if (transferAmount <= 0n) {
                                        logMessageMultiKeyNative('warning', `   ⚠️ [${senderNum}] Balance ${ethers.formatEther(balance)} < gas reserve ${ethers.formatEther(_reserve)} — SKIPPED`);
                                        totalSkippedTransfers++;
                                        continue;
                                    }
                                }
                            } catch(_) {}
                            
                            if (transferAmount <= 0n) {
                                logMessageMultiKeyNative('warning', `   ⚠️ [${senderNum}] After gas buffer, nothing left to send — SKIPPED`);
                                                                totalSkippedTransfers++;
                                continue;
                            }
                            
                            const bufferPercent = ((bufferMultiplier - 100n) * 100n) / 100n;
                            logMessageMultiKeyNative('success', `   ⚡ MAX MODE: Sending ${ethers.formatEther(transferAmount)} ETH (balance - ${bufferPercent}% gas buffer)`);
                            
                        } else {
                            // FIXED AMOUNT MODE
                            const amountFormatted = typeof amount === 'number' 
                                ? amount.toFixed(18).replace(/\.?0+$/, '') 
                                : amount;
                            transferAmount = ethers.parseEther(amountFormatted);
                            
                            // Check if balance can cover amount + gas
                            const totalNeeded = transferAmount + estimatedGasCost;
                            
                            if (balance < totalNeeded) {
                                logMessageMultiKeyNative('warning', `   ⚠️ [${senderNum}] Insufficient balance — SKIPPED`);
                                                                totalSkippedTransfers++;
                                continue;
                            }
                            
                        }
                        
                        // ── RPC-RESILIENT SEND (Multi Key Native - Direct) ──────
                        let _mkndProvider = provider;
                        let _mkndWallet = wallet; // mutable reference so onProviderRefresh can reconnect
                        let tx;
                        try {
                          tx = await window.thResilientSendAndConfirm({
                            rpcInputId: 'rpcUrlMultiKeyNative',
                            currentProvider: _mkndProvider,
                            onProviderRefresh: function(_p) {
                              _mkndProvider = _p;
                              // wallet is a loop `const` so we use _mkndWallet as the mutable copy.
                              _mkndWallet = new ethers.Wallet(_mkndWallet.privateKey, _p);
                            },
                            sendFn: async function() {
                              const _tx = await thSendWithSponsor(_mkndWallet, { to: recipientAddress, value: transferAmount, ...txOptions }, _thChainId, _mkndProvider, logMessageMultiKeyNative);
                              _thSaveTx(_tx.hash, 'rpcUrlMultiKeyNative', 'Multi Key Native');
                              return _tx;
                            },
                            logFn: logMessageMultiKeyNative,
                            label: 'Multi Key Native',
                            waitConfirm: false,
                          });
                        } catch(_mkndErr) {
                          throw _mkndErr;
                        }
                        // ── END RPC-RESILIENT (Multi Key Native - Direct) ────────

                        
                        totalSuccessfulTransfers++;
                        totalAmountSent += transferAmount;
                        if (!tx.opHash) { logMessageMultiKeyNative('success', `   ✅ TX: ${createExplorerLink(tx.hash, {chainId: _thChainId || _thGetChainIdFromRpc('rpcUrlMultiKeyNative')}, false)}`, true); }
                        
                        // Small delay to avoid RPC rate limit (serial execution needed)
                        await new Promise(resolve => setTimeout(resolve, 50));
                        
                    } catch (error) {
                        logMessageMultiKeyNative('error', `   ❌ Failed: ${error.message.substring(0, 60)}`);
                        totalFailedTransfers++;
                    }
                    
                    // Update progress
                    const progressPercent = ((i + 1) / senderKeys.length) * 100;
                    if (progressEl) progressEl.style.width = `${progressPercent}%`;
                }
                
                // Final summary
                                                logMessageMultiKeyNative('success', '🎉 DIRECT TRANSFER COMPLETED!');
                                
            } catch (error) {
                if (!error._validationSilent) logMessageMultiKeyNative('error', `❌ Error: ${error.message}`);
            } finally {
                // Mark transaction as complete
                isTransactionInProgress = false;
                stopAliveInBackground(); // BUG FIX 5: TX শেষে interval বন্ধ
                stopSilentAudio();       // BUG FIX 6: TX শেষে audio বন্ধ
                if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txEnd(); // BG: release wake lock
                
                // Remove loading state
                executeDirectBtn.classList.remove('loading');
                executeDirectBtn.disabled = false;
                executeDirectBtn.innerHTML = btnOriginalText;
            }
        }
