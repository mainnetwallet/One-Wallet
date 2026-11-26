        
        function setW2WMaxAmountToken() {
            document.getElementById('w2wCustomAmountToken').value = 'MAX';
            checkW2WExecuteReady();
        }
        
        // Placeholder for executeWalletToWalletToken (can be implemented later)
        async function executeWalletToWalletToken() {
            window._thStopFlags = window._thStopFlags || {}; window._thStopFlags['w2wToken'] = false;
            const rpcUrl = document.getElementById('rpcUrlW2WToken').value.trim();
            const _thRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('rpcUrlW2WToken') : (rpcUrl ? [rpcUrl] : []);
            const _thChainId = parseInt((document.getElementById('rpcUrlW2WToken')||{}).getAttribute?.('data-chainid')||'',10)||null;
            const senderKeys = document.getElementById('w2wSenderKeysToken').value
                .split('\n')
                .filter(k => k.trim().length > 0)
                .map(k => cleanPrivateKey(k.trim()));
            const receiverInputs = document.getElementById('w2wReceiverKeysToken').value
                .split('\n')
                .filter(k => k.trim().length > 0)
                .map(k => k.trim());
            const tokenContract = document.getElementById('w2wTokenContract').value.trim();
            const customAmount = document.getElementById('w2wCustomAmountToken').value.trim();
            
            // Validation
            if (!rpcUrl) {
                logW2W('error', '❌ Please provide RPC URL');
                return;
            }
            
            if (!tokenContract || !ethers.isAddress(tokenContract)) {
                logW2W('error', '❌ Please provide valid token contract address');
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
            
            if (!customAmount || (customAmount.toUpperCase() !== 'MAX' && parseFloat(customAmount) <= 0)) {
                logW2W('error', '❌ Amount must be greater than 0 (or use MAX button)');
                return;
            }
            
            const btn = document.getElementById('executeW2WTokenBtn');
            btn.disabled = true;
            btn.innerHTML = '<span class="loading-spinner"></span> Transferring...';
            if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txStart(); // BG: wake lock
            
            const progressBar = document.getElementById('progressBarW2WToken');
            const progressFill = document.getElementById('progressFillW2WToken');
            if (progressBar) progressBar.style.display = 'block';
            if (progressFill) progressFill.style.width = '0%';
            
            try {
                // FIX: use thWithFallback for automatic multi-RPC failover
                let provider;
                try {
                  provider = await window.thWithFallback('rpcUrlW2WToken', async function(_p) {
                    await Promise.race([_p.getBlockNumber(), new Promise((_,r)=>setTimeout(()=>r(new Error('probe timeout')),5000))]);
                    return _p;
                  }, 5000);
                } catch(_thErr) {
                  // All RPCs in list failed — fall back to single URL so caller can surface error naturally
                  const _fbCid = parseInt((document.getElementById('rpcUrlW2WToken')||{}).getAttribute?.('data-chainid')||'',10)||null;
                  provider = window._thMakeProvider(rpcUrl, _fbCid);
                }
                
                // Convert receivers to addresses
                const receiverAddresses = [];
                for (const input of receiverInputs) {
                    receiverAddresses.push(getReceiverAddress(input));
                }
                
                const pairCount = Math.min(senderKeys.length, receiverAddresses.length);
                
                                
                                
                let successCount = 0;
                let failCount = 0;
                
                // Token ABI
                const tokenAbi = [
                    'function balanceOf(address) view returns (uint256)',
                    'function decimals() view returns (uint8)',
                    'function symbol() view returns (string)',
                    'function transfer(address to, uint256 amount) returns (bool)'
                ];
                
                // Get token info once
                const tempWallet = new ethers.Wallet(senderKeys[0], provider);
                const token = new ethers.Contract(tokenContract, tokenAbi, tempWallet);
                const decimals = await token.decimals();
                const symbol = await token.symbol();
                
                
                for (let i = 0; i < pairCount; i++) {
                    if (window._thStopFlags && window._thStopFlags['w2wToken']) { logW2W('warning', '⛔ Stopped by Pull-to-Refresh'); break; }
                    const senderKey = senderKeys[i];
                    const receiverAddress = receiverAddresses[i];
                    
                    try {
                        const wallet = new ethers.Wallet(senderKey, provider);
                        const tokenContractInstance = new ethers.Contract(tokenContract, tokenAbi, wallet);
                        
                        
                        let amount;
                        
                        if (customAmount.toUpperCase() === 'MAX') {
                            // Get full token balance
                            amount = await tokenContractInstance.balanceOf(wallet.address);
                            
                            if (amount === 0n) {
                                logW2W('warning', `   💤 No token balance - skipped`);
                                failCount++;
                                continue;
                            }
                            
                            const balanceFormatted = ethers.formatUnits(amount, decimals);
                        } else {
                            // Custom amount
                            amount = ethers.parseUnits(customAmount, decimals);
                        }
                        
                        // ⛔ PTR guard — re-check after async balanceOf
                        if (window._thStopFlags && window._thStopFlags['w2wToken']) { break; }

                        // Send token transfer
                        const tx = await tokenContractInstance.transfer(receiverAddress, amount);
                        
                        logW2W('success', `✅ TX Sent: ${createExplorerLink(tx.hash, {chainId: _thGetChainIdFromRpc('rpcUrlW2WToken')}, false)}`, true);
                        _thSaveTx(tx.hash, 'rpcUrlW2WToken', 'W2W Token Transfer');
                        successCount++;
                        
                        // Update progress
                        if (progressFill) {
                            progressFill.style.width = `${((i + 1) / pairCount) * 100}%`;
                        }
                        
                        // Small delay before next transaction (100ms)
                        await new Promise(resolve => setTimeout(resolve, 100));
                        
                    } catch (error) {
                        logW2W('error', `   ❌ Failed: ${error.message.substring(0, 80)}`);
                        failCount++;
                    }
                }
                
                logW2W('success', '🎉 ALL TOKEN TRANSFERS SENT!');
                if (failCount > 0) {
                    logW2W('warning', `❌ Failed: ${failCount}/${pairCount}`);
                }
                                                
            } catch (error) {
                logW2W('error', `❌ Error: ${error.message}`);
            } finally {
                btn.disabled = false;
                btn.innerHTML = '🚀 Execute Token Transfer';
                if (progressBar) progressBar.style.display = 'none';
                if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txEnd(); // BG: release wake lock
            }
        }
        
