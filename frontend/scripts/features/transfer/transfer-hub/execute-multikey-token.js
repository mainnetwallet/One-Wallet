        async function executeMultiKeyToken() {
            window._thStopFlags = window._thStopFlags || {}; window._thStopFlags['multiKeyToken'] = false;
            try {
                if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txStart(); // BG: wake lock
                                                
                // Get inputs
                const rpcUrl = document.getElementById('rpcUrlMultiKeyToken').value.trim();
                const _thRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('rpcUrlMultiKeyToken') : (rpcUrl ? [rpcUrl] : []);
                const _thChainId = parseInt((document.getElementById('rpcUrlMultiKeyToken')||{}).getAttribute?.('data-chainid')||'',10)||null;
                const developerKey = (document.getElementById('senderKeysMultiKeyToken').value.trim().split('\n')[0] || '').trim();
                const privateKeysText = document.getElementById('senderKeysMultiKeyToken').value.trim();
                const recipientAddress = document.getElementById('recipientAddressMultiKeyToken').value.trim();
                const tokenAddress = document.getElementById('tokenContractAddressMultiKeyToken').value.trim();
                const amount = document.getElementById('amountPerAddressMultiKeyToken').value.trim();
                const tokenSymbol = document.getElementById('tokenSymbolMultiKeyToken').value.trim();
                const tokenDecimals = parseInt(document.getElementById('tokenDecimalsMultiKeyToken').value || '18');
                
                // Validation
                if (!rpcUrl) {
                    logMessageMultiToken('error', '❌ Please enter RPC URL');
                    return;
                }
                
                if (!developerKey) {
                    logMessageMultiToken('error', '❌ Please enter developer private key');
                    return;
                }
                
                if (!tokenAddress || !ethers.isAddress(tokenAddress)) {
                    logMessageMultiToken('error', '❌ Invalid token contract address');
                    return;
                }
                
                if (!privateKeysText) {
                    logMessageMultiToken('error', '❌ Please enter at least one sender private key');
                    return;
                }
                
                if (!recipientAddress || !ethers.isAddress(recipientAddress)) {
                    logMessageMultiToken('error', '❌ Invalid recipient address');
                    return;
                }
                
                if (!amount || parseFloat(amount) <= 0) {
                    logMessageMultiToken('error', '❌ Please enter a valid amount');
                    return;
                }
                
                // Parse sender private keys
                const privateKeys = privateKeysText.split('\n')
                    .map(key => key.trim())
                    .filter(key => key.length > 0);
                
                if (privateKeys.length === 0) {
                    logMessageMultiToken('error', '❌ No valid sender private keys found');
                    return;
                }
                
                
                // Setup provider
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
                
                // Setup developer wallet
                const developerWallet = new ethers.Wallet(developerKey, provider);
                
                logMessageMultiToken('success', `🪙 Token: ${tokenSymbol || tokenAddress}`);
                logMessageMultiToken('success', `💰 Amount per wallet: ${amount} ${tokenSymbol}`);
                                
                // ========================================
                // STEP 1: DEPLOY TOKEN TRANSFER CONTRACT
                // ========================================
                                
                // Token Transfer Contract ABI and Bytecode
                const TOKEN_TRANSFER_CONTRACT_ABI = [
                    "constructor()",
                    "function owner() view returns (address)",
                    "function executeTransfer(address tokenAddress, address[] calldata recipients, uint256[] calldata amounts) external",
                    "function withdrawToken(address tokenAddress, address to) external",
                    "function withdrawNative(address payable to) external"
                ];
                
                // Using global TOKEN_TRANSFER_CONTRACT_BYTECODE
                
                try {
                    const factory = new ethers.ContractFactory(
                        TOKEN_TRANSFER_CONTRACT_ABI,
                        TOKEN_TRANSFER_CONTRACT_BYTECODE,
                        developerWallet
                    );
                    
                                        const contract = await factory.deploy();

                    const deployTxMulti = contract.deploymentTransaction();
                    if (deployTxMulti && deployTxMulti.hash) {
                        }
                    
                                        await contract.waitForDeployment();
                    
                    const contractAddress = await contract.getAddress();
                    logMessageMultiToken('success', `✅ Contract deployed successfully!`);
                    logMessageMultiToken('success', `📍 Address: ${contractAddress}`);
                    
                    // ========================================
                    // STEP 2: MULTI-KEY TOKEN TRANSFERS TO CONTRACT
                    // ========================================
                                        
                    const amountWei = ethers.parseUnits(amount, tokenDecimals);
                    let successCount = 0;
                    let failCount = 0;
                    
                    for (let i = 0; i < privateKeys.length; i++) {
                        if (window._thStopFlags && window._thStopFlags['multiKeyToken']) { logMessageMultiToken('warning', '⛔ Stopped by Pull-to-Refresh'); break; }
                        const walletNum = i + 1;
                        try {
                            const wallet = new ethers.Wallet(privateKeys[i], provider);
                            
                            
                            // Create token contract instance
                            const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
                            
                            // Check token balance
                            const balance = await tokenContract.balanceOf(wallet.address);
                            const balanceFormatted = ethers.formatUnits(balance, tokenDecimals);
                            
                            if (balance < amountWei) {
                                logMessageMultiToken('warning', `⚠️ [${walletNum}] Insufficient balance (${balanceFormatted} ${tokenSymbol}). Skipping...`);
                                failCount++;
                                continue;
                            }
                            
                            // ⛔ PTR guard — re-check after async balanceOf
                            if (window._thStopFlags && window._thStopFlags['multiKeyToken']) { break; }

                            // Transfer tokens to contract
                            // ── RPC-RESILIENT SEND + CONFIRM (Multi Token Deposit) ─
                            let _mtProvider = provider;
                            let _mtWallet = wallet;
                            let _mtContract = tokenContract;
                            const _mtResult = await window.thResilientSendAndConfirm({
                              rpcInputId: 'rpcUrlMultiKeyToken',
                              currentProvider: _mtProvider,
                              onProviderRefresh: function(_p) {
                                _mtProvider = _p;
                                _mtWallet = new ethers.Wallet(_mtWallet.privateKey, _p);
                                _mtContract = new ethers.Contract(tokenAddress, ERC20_ABI, _mtWallet);
                              },
                              sendFn: async function() {
                                const _tx = await thTokenSendWithSponsor(_mtWallet, _mtContract, contractAddress, amountWei, _thChainId, _mtProvider, logMessageMultiToken);
                                _thSaveTx(_tx.hash, 'rpcUrlMultiKeyToken', 'Multi Token Deposit');
                                return _tx;
                              },
                              logFn: logMessageMultiToken,
                              label: 'Multi Token Deposit',
                              waitConfirm: true,
                            });
                            // ── END RPC-RESILIENT (Multi Token Deposit) ────────────
                            
                            logMessageMultiToken('success', `✅ [${walletNum}] Transfer confirmed! ${_thChainId === 8453 ? 'AA Txn Hash' : 'TX'}: ${(_thChainId === 8453 && _mtResult.opHash) ? _mtResult.opHash : (_mtResult.hash || _mtResult.transactionHash)}`);
                            successCount++;
                            
                        } catch (error) {
                            logMessageMultiToken('error', `❌ [${walletNum}] Failed: ${error.message.substring(0, 80)}`);
                            failCount++;
                        }
                    }
                    
                    
                    // Check contract token balance
                    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
                    const contractBalance = await tokenContract.balanceOf(contractAddress);
                    const contractBalanceFormatted = ethers.formatUnits(contractBalance, tokenDecimals);
                    
                    // ========================================
                    // STEP 3: DEVELOPER WITHDRAWS TOKENS TO RECIPIENT
                    // ========================================
                    if (contractBalance > 0n) {
                                                
                        const contractWithSigner = new ethers.Contract(
                            contractAddress,
                            TOKEN_TRANSFER_CONTRACT_ABI,
                            developerWallet
                        );
                        
                                                
                        const withdrawTx = await contractWithSigner.withdrawToken(
                            tokenAddress,
                            recipientAddress
                        );
                        
                                                
                        const _wdReceipt = await withdrawTx.wait();
                        
                        logMessageMultiToken('success', `✅ Withdrawal confirmed! TX: ${withdrawTx.hash}`);
                        
                        // Verify final balance
                        const finalBalance = await tokenContract.balanceOf(contractAddress);
                        
                    } else {
                        logMessageMultiToken('warning', '⚠️ No tokens in contract to withdraw');
                    }
                    
                    // Final summary
                                                            logMessageMultiToken('success', '🎉 3-STEP TOKEN TRANSFER COMPLETED SUCCESSFULLY!');
                                        
                } catch (deployError) {
                    logMessageMultiToken('error', `❌ Deployment failed: ${deployError.message}`);
                }
                
            } catch (error) {
                logMessageMultiToken('error', `❌ Fatal error: ${error.message}`);
            } finally {
                if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txEnd(); // BG: release wake lock
            }
        }