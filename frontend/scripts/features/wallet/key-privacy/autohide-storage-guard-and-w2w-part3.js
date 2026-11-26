        
        // Execute Wallet to Wallet Transfer
        async function executeWalletToWallet() {
            window._thStopFlags = window._thStopFlags || {}; window._thStopFlags['w2wNative'] = false;
            const rpcUrl = document.getElementById('rpcUrlW2W').value.trim();
            const _thRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('rpcUrlW2W') : (rpcUrl ? [rpcUrl] : []);
            // _thChainId resolved below after mode is determined (native→rpcUrlW2W, token→rpcUrlW2WToken)
            const _thChainIdNative = parseInt((document.getElementById('rpcUrlW2W')||{}).getAttribute?.('data-chainid')||'',10)||null;
            const senderKeys = document.getElementById('w2wSenderKeys').value
                .split('\n')
                .filter(k => k.trim().length > 0)
                .map(k => cleanPrivateKey(k.trim()));
            const receiverInputs = document.getElementById('w2wReceiverKeys').value
                .split('\n')
                .filter(k => k.trim().length > 0)
                .map(k => k.trim());
            
            // Validation
            if (!rpcUrl) {
                logW2W('error', '❌ Please provide RPC URL');
                return;
            }
            
            if (senderKeys.length === 0) {
                logW2W('error', '❌ Please provide sender private keys');
                return;
            }
            
            if (receiverInputs.length === 0) {
                logW2W('error', '❌ Please provide receiver keys/addresses');
                return;
            }
            
            if (w2wMode === 'token') {
                const tokenContract = document.getElementById('w2wTokenContract').value.trim();
                if (!tokenContract) {
                    logW2W('error', '❌ Please provide token contract address');
                    return;
                }
            }
            
            const customAmount = document.getElementById('w2wCustomAmount').value.trim();
            if (!customAmount || (customAmount.toUpperCase() !== 'MAX' && parseFloat(customAmount) <= 0)) {
                logW2W('error', '❌ Amount must be greater than 0 (or use MAX button)');
                return;
            }
            
            const btn = document.getElementById('executeW2WBtn');
            btn.disabled = true;
            btn.innerHTML = '<span class="loading-spinner"></span> Transferring...';
            if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txStart(); // BG: wake lock
            
            try {
                // BUG FIX: token mode must use rpcUrlW2WToken, native mode uses rpcUrlW2W.
                // Previously always used rpcUrlW2W (native RPC) even in token mode.
                const _activeRpcId = (w2wMode === 'token') ? 'rpcUrlW2WToken' : 'rpcUrlW2W';
                const _activeRpcEl = document.getElementById(_activeRpcId);
                const _activeRpcUrl = (_activeRpcEl?.value.trim()) || rpcUrl;
                const _thChainId = parseInt((_activeRpcEl||{}).getAttribute?.('data-chainid')||'',10)||_thChainIdNative||null;

                // FIX: use thWithFallback for automatic multi-RPC failover
                let provider;
                try {
                  provider = await window.thWithFallback(_activeRpcId, async function(_p) {
                    await Promise.race([_p.getBlockNumber(), new Promise((_,r)=>setTimeout(()=>r(new Error('probe timeout')),5000))]);
                    return _p;
                  }, 5000);
                } catch(_thErr) {
                  // All RPCs in list failed — fall back to single URL so caller can surface error naturally
                  const _fbCid = parseInt((_activeRpcEl||{}).getAttribute?.('data-chainid')||'',10)||null;
                  provider = window._thMakeProvider(_activeRpcUrl, _fbCid);
                }
                
                // Convert receivers to addresses
                const receiverAddresses = [];
                for (const input of receiverInputs) {
                    receiverAddresses.push(getReceiverAddress(input));
                }
                
                const pairCount = Math.min(senderKeys.length, receiverAddresses.length);
                
                                
                                
                let successCount = 0;
                let failCount = 0;
                
                for (let i = 0; i < pairCount; i++) {
                    if (window._thStopFlags && window._thStopFlags['w2wNative']) { logW2W('warning', '⛔ Stopped by Pull-to-Refresh'); break; }
                    const senderKey = senderKeys[i];
                    const receiverAddress = receiverAddresses[i];
                    
                    try {
                        const wallet = new ethers.Wallet(senderKey, provider);
                        
                        // Pair info merged into TX Sent line below
                        
                        let tx;
                        
                        if (w2wMode === 'native') {
                            // Native token transfer
                            const customAmount = document.getElementById('w2wCustomAmount').value.trim();
                            const isMaxMode = customAmount.toUpperCase() === 'MAX';
                            
                            // Check balance first
                            const balance = await provider.getBalance(wallet.address);
                            const balanceEth = ethers.formatEther(balance);
                            
                            // Skip if balance is zero
                            if (balance === 0n) {
                                logW2W('warning', `   💤 Balance is 0 — SKIPPED`);
                                failCount++;
                                continue;
                            }
                            
                            let transferAmount;
                            
                            // ── Gas estimation (for MAX mode balance math) ──
                            const feeData = await provider.getFeeData();
                            let txOptions = {};
                            
                            // For MAX mode, use actual gas estimation instead of fixed 21000
                            let estimatedGasUnits = 21000n;
                            let estimatedGasCost;
                            let isL2Chain = false;
                            
                            if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
                                const block = await provider.getBlock('latest');
                                let baseFee = block.baseFeePerGas;
                                if (!baseFee) baseFee = feeData.maxFeePerGas;
                                isL2Chain = baseFee < 10000000n;
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
                            const _w2wGas = await window._thGas(provider);
                            Object.assign(txOptions, _w2wGas);
                            if (_w2wGas.maxFeePerGas) {
                            } else if (_w2wGas.gasPrice) {
                            } else {
                            }
                            
                            // ⛔ PTR guard — re-check after async gas estimation
                            if (window._thStopFlags && window._thStopFlags['w2wNative']) { break; }

                            if (isMaxMode) {
                                // MAX MODE: Send full balance minus gas
                                
                                // Check if balance can cover gas
                                if (balance <= estimatedGasCost) {
                                    logW2W('warning', `   ⚠️ Insufficient balance to cover gas — SKIPPED`);
                                                                        failCount++;
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
                                
                                if (transferAmount <= 0n) {
                                    logW2W('warning', `   ⚠️ After gas buffer, nothing left to send — SKIPPED`);
                                                                        failCount++;
                                    continue;
                                }
                                
                                const bufferPercent = ((bufferMultiplier - 100n) * 100n) / 100n;
                                logW2W('success', `   ⚡ MAX MODE: Sending ${ethers.formatEther(transferAmount)} (balance - ${bufferPercent}% gas buffer)`);
                                
                            } else {
                                // FIXED AMOUNT MODE
                                transferAmount = ethers.parseEther(customAmount);
                                
                                // Check if balance can cover amount + gas
                                const totalNeeded = transferAmount + estimatedGasCost;
                                
                                if (balance < totalNeeded) {
                                    logW2W('warning', `   ⚠️ Insufficient balance — SKIPPED`);
                                                                        failCount++;
                                    continue;
                                }
                                
                            }
                            
                            // ── RPC-RESILIENT SEND (W2W Native) ─────────────────
                            let _w2wnProvider = provider;
                            let _w2wnWallet = wallet;
                            const _w2wnResult = await window.thResilientSendAndConfirm({
                              rpcInputId: 'rpcUrlW2W',
                              currentProvider: _w2wnProvider,
                              onProviderRefresh: function(_p) {
                                _w2wnProvider = _p;
                                // NOTE: do NOT overwrite outer `provider`/`wallet` — each loop iteration
                                // creates its own wallet from senderKey; overwriting here would corrupt
                                // subsequent iterations that share the same outer-scope variable.
                                _w2wnWallet = new ethers.Wallet(_w2wnWallet.privateKey, _p);
                              },
                              sendFn: async function() {
                                const _tx = await thSendWithSponsor(_w2wnWallet, { to: receiverAddress, value: transferAmount, ...txOptions }, _thChainId, _w2wnProvider, logW2W);
                                _thSaveTx(_tx.hash, 'rpcUrlW2W', 'W2W Transfer');
                                return _tx;
                              },
                              logFn: logW2W,
                              label: 'W2W Native',
                              waitConfirm: false,
                            });
                            tx = _w2wnResult;
                            // ── END RPC-RESILIENT (W2W Native) ───────────────────
                        } else {
                            // ERC20 token transfer
                            const tokenContract = document.getElementById('w2wTokenContract').value.trim();
                            const tokenAbi = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)', 'function transfer(address to, uint256 amount) returns (bool)'];
                            const token = new ethers.Contract(tokenContract, tokenAbi, wallet);
                            
                            const customAmount = document.getElementById('w2wCustomAmount').value.trim();
                            let amount;
                            
                            if (customAmount.toUpperCase() === 'MAX') {
                                // Get full token balance
                                amount = await token.balanceOf(wallet.address);
                                
                                if (amount === 0n) {
                                    failCount++;
                                    continue;
                                }
                                
                                const decimals = await token.decimals();
                            } else {
                                // Custom amount
                                const decimals = await token.decimals();
                                amount = ethers.parseUnits(customAmount, decimals);
                            }
                            
                            // ⛔ PTR guard — re-check after async token info/balance fetch
                            if (window._thStopFlags && window._thStopFlags['w2wNative']) { break; }

                            // ── RPC-RESILIENT SEND (W2W Token) ──────────────────
                            let _w2wtProvider = provider;
                            let _w2wtWallet = wallet;
                            let _w2wtToken = token;
                            const _w2wtResult = await window.thResilientSendAndConfirm({
                              rpcInputId: 'rpcUrlW2WToken',
                              currentProvider: _w2wtProvider,
                              onProviderRefresh: function(_p) {
                                _w2wtProvider = _p;
                                // NOTE: do NOT overwrite outer `provider`/`wallet` — same reason as W2W Native:
                                // loop-scoped wallet must stay isolated per iteration.
                                _w2wtWallet = new ethers.Wallet(_w2wtWallet.privateKey, _p);
                                _w2wtToken = new ethers.Contract(tokenContract, ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)', 'function transfer(address to, uint256 amount) returns (bool)'], _w2wtWallet);
                              },
                              sendFn: async function() {
                                const _tx = await thTokenSendWithSponsor(_w2wtWallet, _w2wtToken, receiverAddress, amount, _thChainId, _w2wtProvider, logW2W);
                                _thSaveTx(_tx.hash, 'rpcUrlW2WToken', 'W2W Token Transfer');
                                return _tx;
                              },
                              logFn: logW2W,
                              label: 'W2W Token',
                              waitConfirm: false,
                            });
                            tx = _w2wtResult;
                            // ── END RPC-RESILIENT (W2W Token) ────────────────────
                        }
                        
                        // Send transaction without waiting for confirmation
                        // Skip TX Sent line if Paymaster already logged it
                        if (!tx.opHash) {
                          logW2W('success', `✅ TX Sent: ${createExplorerLink(tx.hash, {chainId: _thGetChainIdFromRpc('rpcUrlW2W')}, false)}`, true);
                        }
                        successCount++;
                        
                        // Small delay before next transaction (100ms)
                        await new Promise(resolve => setTimeout(resolve, 100));
                        
                    } catch (error) {
                        logW2W('error', `   ❌ Failed: ${error.message.substring(0, 80)}`);
                        failCount++;
                    }
                }
                
                logW2W('success', '🎉 ALL TRANSACTIONS SENT!');
                if (failCount > 0) {
                    logW2W('warning', `❌ Failed: ${failCount}/${pairCount}`);
                }
                                                
            } catch (error) {
                logW2W('error', `❌ Error: ${error.message}`);
            } finally {
                btn.disabled = false;
                btn.innerHTML = '🚀 Execute Transfer';
                if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txEnd(); // BG: release wake lock
            }
        }