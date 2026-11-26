
        // ========================================
        // MAIN TRANSFER — parallel wallets,
        //   3× retry with 2 s delay, balance-0 skip
        // ========================================
        async function executeDirectTransferMultiKeyToken() {
            window._thStopFlags = window._thStopFlags || {}; window._thStopFlags['multiKeyToken'] = false;
            // --- disable button while running ---
            const execBtn = document.getElementById('executeBtnMultiKeyToken');
            if (execBtn) { execBtn.disabled = true; execBtn.classList.add('loading'); }
            if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txStart(); // BG: wake lock

            try {
                                
                // ---------- read inputs ----------
                const rpcUrl        = document.getElementById('rpcUrlMultiKeyToken').value.trim();
                const _thRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('rpcUrlMultiKeyToken') : (rpcUrl ? [rpcUrl] : []);
                const _thChainId = parseInt((document.getElementById('rpcUrlMultiKeyToken')||{}).getAttribute?.('data-chainid')||'',10)||null;
                const senderKeysRaw = document.getElementById('senderKeysMultiKeyToken').value.trim();
                const recipientRaw  = document.getElementById('recipientAddressMultiKeyToken').value.trim();
                const tokenAddress  = document.getElementById('tokenContractAddressMultiKeyToken').value.trim();
                const amount        = document.getElementById('amountPerAddressMultiKeyToken').value.trim();
                const tokenSymbol   = document.getElementById('tokenSymbolMultiKeyToken').value.trim() || 'TOKEN';
                const tokenDecimals = parseInt(document.getElementById('tokenDecimalsMultiKeyToken').value || '18');

                // ---------- validation ----------
                if (!rpcUrl) { logMessageMultiKeyToken('error', '❌ RPC URL is empty'); throw Object.assign(new Error('RPC URL is empty'), {_validationSilent:true}); }
                if (!tokenAddress || !ethers.isAddress(tokenAddress)) { logMessageMultiKeyToken('error', '❌ Invalid token contract address'); throw Object.assign(new Error('Invalid token address'), {_validationSilent:true}); }
                if (!senderKeysRaw) { logMessageMultiKeyToken('error', '❌ No sender keys'); throw Object.assign(new Error('No sender keys'), {_validationSilent:true}); }
                
                // Allow MAX mode or valid numeric amount
                if (!window.multiKeyTokenSendAllMode) {
                    if (!amount || parseFloat(amount) <= 0) { 
                        logMessageMultiKeyToken('error', '❌ Amount must be > 0 or click MAX button'); 
                        throw Object.assign(new Error('Invalid amount'), {_validationSilent:true});
                    }
                }

                // resolve recipient (key → address or raw address)
                const recipientAddress = resolveRecipientAddress(recipientRaw);
                if (!recipientAddress) { logMessageMultiKeyToken('error', '❌ Invalid recipient — paste a valid address or private key'); throw Object.assign(new Error('Invalid recipient'), {_validationSilent:true}); }

                // ---------- parse & sanitise sender keys ----------
                const senderKeys = senderKeysRaw
                    .split('\n')
                    .map(l => l.trim())
                    .filter(l => l.length > 0)
                    .map(l => sanitisePrivateKey(l))
                    .filter(k => /^0x[a-f0-9]{64}$/.test(k) || /^[a-f0-9]{64}$/.test(k)); // Accept with or without 0x

                if (senderKeys.length === 0) { logMessageMultiKeyToken('error', '❌ No valid sender keys found'); throw Object.assign(new Error('No valid sender keys'), {_validationSilent:true}); }

                logMessageMultiKeyToken('success', `🎯 Recipient        : ${recipientAddress}`);
                logMessageMultiKeyToken('success', `🪙 Token            : ${tokenSymbol}`);
                
                if (window.multiKeyTokenSendAllMode) {
                    logMessageMultiKeyToken('success', `⚡ Amount / wallet  : MAX (FULL BALANCE of each wallet)`);
                } else {
                    logMessageMultiKeyToken('success', `💰 Amount / wallet  : ${amount} ${tokenSymbol}`);
                }
                

                // ---------- setup ----------
                // FIX: use thWithFallback for automatic multi-RPC failover
                let provider;
                try {
                  provider = await window.thWithFallback('rpcUrlMultiKeyToken', async function(_p) {
                    await Promise.race([_p.getBlockNumber(), new Promise((_,r)=>setTimeout(()=>r(new Error('probe timeout')),5000))]);
                    return _p;
                  }, 5000);
                } catch(_thErr) {
                  const _fbCid64794 = parseInt((document.getElementById('rpcUrlMultiKeyToken')||{}).getAttribute?.('data-chainid')||'',10)||null;
                  provider = window._thMakeProvider(rpcUrl, _fbCid64794);
                }
                // In MAX mode, amountWei will be set per wallet; otherwise use fixed amount
                const amountWei  = window.multiKeyTokenSendAllMode ? 0n : ethers.parseUnits(amount, tokenDecimals);
                const progressEl = document.getElementById('progressFillMultiKeyToken');
                if (progressEl) progressEl.style.width = '0%';

                const ERC20_ABI = [
                    "function transfer(address to, uint256 amount) returns (bool)",
                    "function balanceOf(address account) view returns (uint256)"
                ];

                // ---------- per-wallet transfer with 3× retry ----------
                async function transferOneWallet(senderKey, index) {
                    const walletNum = index + 1;
                    // Ensure 0x prefix for ethers.js (add if missing)
                    const keyForEthers = senderKey.startsWith('0x') ? senderKey : '0x' + senderKey;
                    const wallet    = new ethers.Wallet(keyForEthers, provider);
                    const shortAddr = wallet.address.slice(0,10) + '…' + wallet.address.slice(-6);


                    // --- check balance ---
                    let balance;
                    try {
                        const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
                        balance = await contract.balanceOf(wallet.address);
                    } catch (e) {
                        logMessageMultiKeyToken('error', `   ❌ [${walletNum}] balance check failed: ${e.message}`);
                        return { status: 'error', amount: 0n };
                    }

                    const balFmt = ethers.formatUnits(balance, tokenDecimals);

                    // --- balance is 0 → skip silently ---
                    if (balance === 0n) {
                        logMessageMultiKeyToken('warning', `   💤 [${walletNum}] Balance 0 — skipped`);
                        return { status: 'skipped', amount: 0n };
                    }


                    // --- Determine amount to send ---
                    let amountToSend;
                    if (window.multiKeyTokenSendAllMode) {
                        // MAX MODE: Send full balance
                        amountToSend = balance;
                        logMessageMultiKeyToken('success', `   ⚡ MAX MODE: Sending FULL balance (${balFmt} ${tokenSymbol})`);
                    } else {
                        // NORMAL MODE: Send fixed amount
                        amountToSend = amountWei;
                        
                        // --- insufficient (> 0 but < amount) ---
                        if (balance < amountWei) {
                            logMessageMultiKeyToken('warning', `   ⚠️  [${walletNum}] Insufficient balance (need ${amount}, have ${balFmt}) — skipped`);
                            return { status: 'skipped', amount: 0n };
                        }
                    }

                    // --- 1× retry loop (total 2 attempts) ---
                    const MAX_RETRIES = 1; // 1 retry = 2 total attempts
                    const RETRY_DELAY = 2000; // ms

                    for (let attempt = 1; attempt <= (MAX_RETRIES + 1); attempt++) {
                        try {
                            const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
                            const sendAmtFmt = ethers.formatUnits(amountToSend, tokenDecimals);

                            // ── OneGas AI gas (AUTO / EIP-1559 / LEGACY) ──
                            // Get gas fee data (similar to Batch Transfer Native)
                            let txOptions = {};
                            const _mktGas = await window._thGas(provider);
                            Object.assign(txOptions, _mktGas);


                            // ⛔ PTR guard — re-check after async gas estimation
                            if (window._thStopFlags && window._thStopFlags['multiKeyToken']) { break; }

                            // ── RPC-RESILIENT SEND (Multi Key Token) ────────────
                            let _mktProvider = provider;
                            let _mktWallet = wallet;
                            let _mktContract = tokenContract;
                            const _mktResult = await window.thResilientSendAndConfirm({
                              rpcInputId: 'rpcUrlMultiKeyToken',
                              currentProvider: _mktProvider,
                              onProviderRefresh: function(_p) {
                                _mktProvider = _p;
                                _mktWallet = new ethers.Wallet(_mktWallet.privateKey, _p);
                                _mktContract = new ethers.Contract(tokenContract.target || tokenContract.address, tokenContract.interface, _mktWallet);
                              },
                              sendFn: async function() {
                                const _tx = await thTokenSendWithSponsor(_mktWallet, _mktContract, recipientAddress, amountToSend, _thChainId, _mktProvider, logMessageMultiKeyToken, txOptions);
                                _thSaveTx(_tx.hash, 'rpcUrlMultiKeyToken', 'Multi Key Token');
                                return _tx;
                              },
                              logFn: logMessageMultiKeyToken,
                              label: 'Multi Key Token',
                              waitConfirm: false,
                            });
                            // ── END RPC-RESILIENT (Multi Key Token) ──────────────

                            // NO WAIT - fire and forget
                            logMessageMultiKeyToken('success', `   ✅ [${walletNum}] Transaction sent! ${sendAmtFmt} ${tokenSymbol} — ${_thChainId === 8453 ? 'AA Txn Hash' : 'TX'}: ${(_thChainId === 8453 && _mktResult.opHash) ? _mktResult.opHash : _mktResult.hash}`);
                            return { status: 'success', amount: amountToSend };

                        } catch (e) {
                            const errorMsg = e.message.toLowerCase();
                            
                            // Check for insufficient funds errors - skip immediately without retry
                            if (errorMsg.includes('insufficient funds') || 
                                errorMsg.includes('insufficient balance') ||
                                errorMsg.includes('transfer amount exceeds balance') ||
                                errorMsg.includes('exceeds balance')) {
                                logMessageMultiKeyToken('warning', `   💤 [${walletNum}] Insufficient funds — skipped`);
                                return { status: 'skipped', amount: 0n };
                            }
                            
                            logMessageMultiKeyToken('error', `   ❌ [${walletNum}] Attempt ${attempt} failed: ${e.message}`);

                            if (attempt <= MAX_RETRIES) {
                                await new Promise(r => setTimeout(r, RETRY_DELAY));
                            }
                        }
                    }

                    // all retries exhausted
                    logMessageMultiKeyToken('error', `   🚫 [${walletNum}] All ${MAX_RETRIES + 1} attempts failed — giving up`);
                    return { status: 'error', amount: 0n };
                }

                // ---------- launch wallets SEQUENTIALLY with 0.1s delay ----------
                const results = [];
                for (let idx = 0; idx < senderKeys.length; idx++) {
                    if (window._thStopFlags && window._thStopFlags['multiKeyToken']) { logMessageMultiKeyToken('warning', '⛔ Stopped by Pull-to-Refresh'); break; }
                    const result = await transferOneWallet(senderKeys[idx], idx);
                    results.push(result);
                    
                    // Wait 0.1 second before next transfer (except for last wallet)
                    if (idx < senderKeys.length - 1) {
                        await new Promise(r => setTimeout(r, 100)); // 0.1 second = 100ms
                    }
                    
                    // Update progress
                    const progressPercent = ((idx + 1) / senderKeys.length) * 100;
                    if (progressEl) progressEl.style.width = `${progressPercent}%`;
                }

                // ---------- update progress to 100 % ----------
                if (progressEl) progressEl.style.width = '100%';

                // ---------- tally ----------
                let successCount = 0, skipCount = 0, errorCount = 0;
                let totalTransferred = 0n;
                
                results.forEach(r => {
                    if (r.status === 'success') {
                        successCount++;
                        totalTransferred += r.amount;
                    }
                    else if (r.status === 'skipped') skipCount++;
                    else errorCount++;
                });

                // ---------- summary ----------
                logMessageMultiKeyToken('success', '🎉 TRANSFER COMPLETE');
                if (skipCount > 0) logMessageMultiKeyToken('warning', `💤 Skipped: ${skipCount} (zero/insufficient balance)`);
                if (errorCount > 0) logMessageMultiKeyToken('error', `❌ Failed: ${errorCount} (after retries)`);
                if (window.multiKeyTokenSendAllMode) {
                }
                
            } catch (error) {
                if (!error._validationSilent) logMessageMultiKeyToken('error', `❌ Fatal: ${error.message}`);
            } finally {
                // re-enable button
                if (execBtn) { execBtn.disabled = false; execBtn.classList.remove('loading'); }
                if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txEnd(); // BG: release wake lock
                validateMultiKeyTokenInputs();
            }
        }

        // Validate Multi Key Token inputs and enable button
        function validateMultiKeyTokenInputs() {
            const rpcUrl        = document.getElementById('rpcUrlMultiKeyToken')?.value.trim();
            const _thRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('rpcUrlMultiKeyToken') : (rpcUrl ? [rpcUrl] : []);
            const _thChainId = parseInt((document.getElementById('rpcUrlMultiKeyToken')||{}).getAttribute?.('data-chainid')||'',10)||null;
            const senderKeys    = document.getElementById('senderKeysMultiKeyToken')?.value.trim();
            const recipientRaw  = document.getElementById('recipientAddressMultiKeyToken')?.value.trim();
            const tokenAddress  = document.getElementById('tokenContractAddressMultiKeyToken')?.value.trim();
            const amount        = document.getElementById('amountPerAddressMultiKeyToken')?.value.trim();
            const executeBtn    = document.getElementById('executeBtnMultiKeyToken');

            // Validate sender keys — at least one valid private key must be present
            let hasValidKeys = false;
            if (senderKeys) {
                const lines = senderKeys.split('\n').map(l => l.trim()).filter(Boolean);
                hasValidKeys = lines.some(line => {
                    let h = line.replace(/\s+/g, '');
                    if (!h.startsWith('0x')) h = '0x' + h;
                    return h.length === 66 && /^0x[a-f0-9]{64}$/i.test(h);
                });
            }

            // recipient can be a key or an address — try to resolve
            const recipientOk = recipientRaw && resolveRecipientAddress(recipientRaw);
            const hasValidToken = tokenAddress && ethers.isAddress(tokenAddress);

            if (executeBtn) {
                // Allow execution if MAX mode is enabled OR if a valid amount is entered
                const amountOk = window.multiKeyTokenSendAllMode || (amount && parseFloat(amount) > 0);
                const isValid = rpcUrl && hasValidKeys && recipientOk && hasValidToken && amountOk;
                executeBtn.disabled = !isValid;
            }
        }

        // Add event listeners for validation
        ['rpcUrlMultiKeyToken', 'senderKeysMultiKeyToken', 'recipientAddressMultiKeyToken', 'tokenContractAddressMultiKeyToken', 'amountPerAddressMultiKeyToken'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', validateMultiKeyTokenInputs);
        });

        // Auto-detect token for Multi Key Token
        document.getElementById('tokenContractAddressMultiKeyToken')?.addEventListener('input', async function() {
            const tokenAddress = this.value.trim();
            
            if (!tokenAddress || !ethers.isAddress(tokenAddress)) {
                return;
            }

            try {
                const rpcUrl = document.getElementById('rpcUrlMultiKeyToken').value.trim();
                const _thRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('rpcUrlMultiKeyToken') : (rpcUrl ? [rpcUrl] : []);
                const _thChainId = parseInt((document.getElementById('rpcUrlMultiKeyToken')||{}).getAttribute?.('data-chainid')||'',10)||null;
                if (!rpcUrl) return;

                // FIX: use thWithFallback for automatic multi-RPC failover
                let provider;
                try {
                  provider = await window.thWithFallback('rpcUrlMultiKeyToken', async function(_p) {
                    await Promise.race([_p.getBlockNumber(), new Promise((_,r)=>setTimeout(()=>r(new Error('probe timeout')),5000))]);
                    return _p;
                  }, 5000);
                } catch(_thErr) {
                  // All RPCs in list failed — fall back to single URL so caller can surface error naturally
                  const _fbCid = parseInt((document.getElementById('rpcUrlMultiKeyToken')||{}).getAttribute?.('data-chainid')||'',10)||null;
                  provider = window._thMakeProvider(rpcUrl, _fbCid);
                }
                
                const ERC20_ABI = [
                    "function symbol() view returns (string)",
                    "function decimals() view returns (uint8)"
                ];
                
                const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

                const [symbol, decimals] = await Promise.all([
                    tokenContract.symbol(),
                    tokenContract.decimals()
                ]);

                document.getElementById('tokenSymbolMultiKeyToken').value = symbol;
                document.getElementById('tokenDecimalsMultiKeyToken').value = decimals.toString();

                logMessageMultiKeyToken('success', `✅ Token detected: ${symbol} (${decimals} decimals)`);
                
                // Update recipient token balance if recipient address is entered
                updateMultiKeyTokenRecipientBalance();
            } catch (error) {
                logMessageMultiKeyToken('error', '❌ Failed to detect token: ' + error.message);
            }
        });

        // updateMultiKeyTokenWalletBalance — removed.
        // Developer wallet no longer exists in this section;
        // transfers go directly Sender → Recipient.
        async function updateMultiKeyTokenWalletBalance() { /* no-op */ }

        // setupMultiKeyTokenWalletDetection — removed (no dev key input).
        function setupMultiKeyTokenWalletDetection() { /* no-op */ }