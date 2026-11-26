        
        // Deploy multi-recipient contract
        // ========================================
        // MULTI KEY RECIPIENTS NATIVE - CONTRACT FUNCTIONS
        // ========================================

        // Deploy multi-recipient contract
        async function deployMultiRecipientContract() {
            const deployBtn = document.getElementById('deployBtnMultiKeyNative');
            const btnOriginalText = deployBtn.innerHTML;
            
            try {
                // Add loading state
                deployBtn.classList.add('loading');
                deployBtn.disabled = true;
                deployBtn.innerHTML = '⏳ Deploying...';
                
                                                
                const rpcUrl = document.getElementById('rpcUrlMultiKeyNative').value.trim();
                const _thRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('rpcUrlMultiKeyNative') : (rpcUrl ? [rpcUrl] : []);
                const _thChainId = parseInt((document.getElementById('rpcUrlMultiKeyNative')||{}).getAttribute?.('data-chainid')||'',10)||null;
                
                // Get actual key from storage (not masked value)
                let developerKey = '';
                if (window.actualKeysStorage && window.actualKeysStorage['privateKeyMultiKeyNative']) {
                    developerKey = window.actualKeysStorage['privateKeyMultiKeyNative'].trim();
                } else {
                    developerKey = document.getElementById('privateKeyMultiKeyNative').value.trim();
                }
                
                // Sanitize the key using our standard function
                if (developerKey) {
                    developerKey = sanitisePrivateKey(developerKey);
                    // Ensure it has 0x prefix for ethers.js
                    if (!developerKey.startsWith('0x')) {
                        developerKey = '0x' + developerKey;
                    }
                }
                
                // Validate: must have RPC and valid 64-char hex key (with 0x = 66 chars total)
                if (!rpcUrl || !developerKey || developerKey.length !== 66) {
                    throw Object.assign(new Error('Missing or invalid RPC URL or developer key'), {_validationSilent:true});
                }
                
                // FIX: use thWithFallback for automatic multi-RPC failover
                let provider;
                try {
                  provider = await window.thWithFallback('rpcUrlMultiKeyNative', async function(_p) {
                    await Promise.race([_p.getBlockNumber(), new Promise((_,r)=>setTimeout(()=>r(new Error('probe timeout')),5000))]);
                    return _p;
                  }, 5000);
                } catch(_thErr) {
                  // All RPCs in list failed — fall back to single URL so caller can surface error naturally
                  const _fbCid = parseInt((document.getElementById('rpcUrlMultiKeyNative')||{}).getAttribute?.('data-chainid')||'',10)||null;
                  provider = window._thMakeProvider(rpcUrl, _fbCid);
                }
                const developerWallet = new ethers.Wallet(developerKey, provider);
                
                
                // Transfer contract ABI and bytecode - Updated with actual contract functions
                const MULTI_RECIPIENT_ABI = [
                    "constructor()",
                    "function owner() view returns (address)",
                    "function withdrawNative(address payable to) external",
                    "function withdrawToken(address token, address to) external",
                    "function executeTransfer(address payable[] calldata recipients) external payable"
                ];
                
                // Transfer Contract Bytecode - v3.0 - Supports multi-recipient transfers
                // Using global TRANSFER_CONTRACT_BYTECODE
                
                const factory = new ethers.ContractFactory(
                    MULTI_RECIPIENT_ABI,
                    TRANSFER_CONTRACT_BYTECODE,
                    developerWallet
                );
                
                                
                const contract = await factory.deploy();
                await contract.waitForDeployment();
                
                const contractAddress = await contract.getAddress();
                
                logMessageMultiKeyNative('success', '✅ Contract deployed successfully!');
                logMessageMultiKeyNative('success', `📍 Address: ${contractAddress}`);
                                
                // Verify contract functions exist onchain
                const functionExists = await verifyMultiRecipientContractFunction(contractAddress, provider);
                
                if (!functionExists) {
                    logMessageMultiKeyNative('error', '❌ Contract functions পাওয়া যায়নি - contract ব্যবহার করা যাবে না');
                    deployBtn.classList.remove('loading');
                    deployBtn.disabled = false;
                    deployBtn.innerHTML = btnOriginalText;
                    updateButtonStates();
                    return;
                }
                
                // Save contract to both storages
                const chainName = currentMultiKeyNativeChainConfig?.name || 'Unknown';
                const chainId = currentMultiKeyNativeChainConfig?.chainId || 0;
                const chainSymbol = currentMultiKeyNativeChainConfig?.symbol || 'ETH';
                
                // Save to local storage (for this section)
                saveContractMultiKeyNative(contractAddress, chainName, chainId, chainSymbol, developerWallet.address);
                // Auto-select newly deployed contract so Execute button enables immediately
                activeContractAddressMultiKeyNative = contractAddress;
                deployedContractAddressMultiKeyNative = contractAddress;
                loadContractMultiKeyNative(contractAddress, true);
                updateButtonStates();
                
                // Save to central storage (for Withdraw Manager)
                addToCentralContracts({
                    address: contractAddress,
                    chainName: chainName,
                    chainId: chainId,
                    chainSymbol: chainSymbol,
                    type: 'native',
                    section: 'Multi Key Recipients',
                    symbol: chainSymbol,
                    deployedAt: new Date().toISOString(),
                    rpcUrl: rpcUrl
                });
                
                
            } catch (error) {
                if (error._validationSilent) {
                    // already logged above
                } else if (error.message.includes('insufficient funds') || 
                    error.message.includes('insufficient balance') ||
                    error.message.includes('sender doesn\'t have enough funds')) {
                    logMessageMultiKeyNative('error', '❌ Fee নেই - চেইনে contract deploy করার জন্য যথেষ্ট fee নেই');
                } else {
                    logMessageMultiKeyNative('error', '❌ Deployment failed');
                }
            } finally {
                // Remove loading state
                deployBtn.classList.remove('loading');
                deployBtn.innerHTML = btnOriginalText;
                // Re-evaluate: if contract selected, deploy stays OFF; otherwise re-enable
                setTimeout(function() { if (typeof updateButtonStates === 'function') updateButtonStates(); else deployBtn.disabled = false; }, 100);
            }
        }
        
        // Execute contract-based transfer to multiple recipients
        async function executeContractTransferMultiKeyRecipients() {
            window._thStopFlags = window._thStopFlags || {}; window._thStopFlags['multiKeyNative'] = false;
            const executeBtn = document.getElementById('executeBtnMultiKeyNative');
            const btnOriginalText = executeBtn.innerHTML;
            
            // Mark transaction as in progress for background execution
            isTransactionInProgress = true;
            if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txStart(); // BG: wake lock
            
            try {
                // Add loading state
                executeBtn.classList.add('loading');
                executeBtn.disabled = true;
                executeBtn.innerHTML = '⏳ Executing...';
                
                                
                const contractAddress = activeContractAddressMultiKeyNative;
                
                if (!contractAddress) {
                    logMessageMultiKeyNative('error', '❌ No contract deployed. Please deploy contract first.');
                    throw Object.assign(new Error('No contract deployed'), {_validationSilent:true});
                }
                
                // Get inputs - ALWAYS read fresh values from DOM
                const rpcUrl = document.getElementById('rpcUrlMultiKeyNative').value.trim();
                const _thRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('rpcUrlMultiKeyNative') : (rpcUrl ? [rpcUrl] : []);
                const _thChainId = parseInt((document.getElementById('rpcUrlMultiKeyNative')||{}).getAttribute?.('data-chainid')||'',10)||null;
                const privateKeysText = document.getElementById('senderPrivateKeysMultiKeyNative').value.trim();
                const recipientAddress = document.getElementById('recipientAddressMultiKeyNative').value.trim();
                const amount = document.getElementById('amountPerAddressMultiKeyNative').value.trim();
                
                
                if (!rpcUrl || !privateKeysText || !recipientAddress) {
                    logMessageMultiKeyNative('error', '❌ Missing required fields');
                    throw Object.assign(new Error('Missing required fields'), {_validationSilent:true});
                }
                
                // Parse inputs
                const { keys: privateKeys } = parsePrivateKeys(privateKeysText);
                const isMaxMode = amount.toUpperCase() === 'MAX';
                const amountValue = isMaxMode ? 0 : (parseFloat(amount) || 0);
                
                if (privateKeys.length === 0) {
                    logMessageMultiKeyNative('error', '❌ No valid sender keys found');
                    throw Object.assign(new Error('No valid sender keys'), {_validationSilent:true});
                }
                
                if (!ethers.isAddress(recipientAddress)) {
                    logMessageMultiKeyNative('error', '❌ Invalid recipient address');
                    throw Object.assign(new Error('Invalid recipient address'), {_validationSilent:true});
                }
                
                if (!isMaxMode && amountValue <= 0) {
                    logMessageMultiKeyNative('error', '❌ Invalid amount');
                    throw Object.assign(new Error('Invalid amount'), {_validationSilent:true});
                }
                
                // FIX: use thWithFallback for automatic multi-RPC failover
                let provider;
                try {
                  provider = await window.thWithFallback('rpcUrlMultiKeyNative', async function(_p) {
                    await Promise.race([_p.getBlockNumber(), new Promise((_,r)=>setTimeout(()=>r(new Error('probe timeout')),5000))]);
                    return _p;
                  }, 5000);
                } catch(_thErr) {
                  // All RPCs in list failed — fall back to single URL so caller can surface error naturally
                  const _fbCid = parseInt((document.getElementById('rpcUrlMultiKeyNative')||{}).getAttribute?.('data-chainid')||'',10)||null;
                  provider = window._thMakeProvider(rpcUrl, _fbCid);
                }
                
                if (isMaxMode) {
                    } else {
                    }
                                
                // Contract ABI - sendTo function for passthrough transfer
                const CONTRACT_ABI = [
                    "function sendTo(address payable recipient) external payable"
                ];
                
                let successCount = 0;
                let failCount = 0;
                let totalAmountSent = 0n;
                
                // Execute transfer from each sender wallet
                for (let i = 0; i < privateKeys.length; i++) {
                    if (window._thStopFlags && window._thStopFlags['multiKeyNative']) { logMessageMultiKeyNative('warning', '⛔ Stopped by Pull-to-Refresh'); break; }
                    try {
                        const wallet = new ethers.Wallet(privateKeys[i], provider);
                        const balance = await window.thRead('rpcUrlMultiKeyNative', provider, function(_p) { return _p.getBalance(wallet.address); }, 6000);
                        
                                        
                        let transferAmount;
                        
                        if (isMaxMode) {
                            // MAX MODE: Calculate individual max amount for this wallet
                            if (balance === 0n) {
                                logMessageMultiKeyNative('warning', `   ⚠️ Zero balance - Skipping`);
                                failCount++;
                                continue;
                            }
                            
                            // Get current gas price
                            const feeData = await window.thRead('rpcUrlMultiKeyNative', provider, function(_p) { return _p.getFeeData(); }, 6000);
                            
                            // Estimate gas for contract call (higher than normal transfer)
                            const estimatedGas = 100000n; // Contract call needs more gas
                            let gasCost;
                            
                            if (feeData.maxFeePerGas) {
                                // EIP-1559 chain - minimal buffer for contract
                                const block = await window.thRead('rpcUrlMultiKeyNative', provider, function(_p) { return _p.getBlock('latest'); }, 6000);
                                const baseFee = block.baseFeePerGas || feeData.maxFeePerGas;
                                const maxFeePerGas = (baseFee * 110n) / 100n; // Only 10% buffer for contract
                                gasCost = maxFeePerGas * estimatedGas;
                            } else if (feeData.gasPrice) {
                                // Legacy chain
                                const gasPriceWithBuffer = (feeData.gasPrice * 110n) / 100n; // Only 10% buffer
                                gasCost = gasPriceWithBuffer * estimatedGas;
                            } else {
                                // Fallback estimate
                                gasCost = ethers.parseUnits('0.001', 'ether'); // 0.001 ETH fallback for contract
                            }
                            
                            // Add small safety buffer (3% extra for contract complexity)
                            const totalBuffer = (gasCost * 103n) / 100n;
                            
                            // Calculate max transferable amount
                            transferAmount = balance - totalBuffer;
                            
                            if (transferAmount <= 0n) {
                                logMessageMultiKeyNative('warning', `   ⚠️ Insufficient balance to cover gas fees - Skipping`);
                                                                failCount++;
                                continue;
                            }
                            
                            
                        } else {
                            // FIXED AMOUNT MODE
                            transferAmount = ethers.parseEther(
                            typeof amountValue === 'number' 
                                ? amountValue.toFixed(18).replace(/\.?0+$/, '') 
                                : amountValue.toString()
                        );
                            
                            // Only check if wallet has gas fee - no need to hold amount + gas
                            // The transaction will proceed if there's enough for gas
                            const feeData = await window.thRead('rpcUrlMultiKeyNative', provider, function(_p) { return _p.getFeeData(); }, 6000);
                            const estimatedGas = 100000n;
                            let gasCost;
                            
                            if (feeData.maxFeePerGas) {
                                const block = await window.thRead('rpcUrlMultiKeyNative', provider, function(_p) { return _p.getBlock('latest'); }, 6000);
                                const baseFee = block.baseFeePerGas || feeData.maxFeePerGas;
                                const maxFeePerGas = (baseFee * 120n) / 100n;
                                gasCost = maxFeePerGas * estimatedGas;
                            } else if (feeData.gasPrice) {
                                const gasPriceWithBuffer = (feeData.gasPrice * 120n) / 100n;
                                gasCost = gasPriceWithBuffer * estimatedGas;
                            } else {
                                gasCost = ethers.parseUnits('0.001', 'ether');
                            }
                            
                            // Only check if balance covers gas fee, not amount
                            if (balance < gasCost) {
                                logMessageMultiKeyNative('warning', `   ⚠️ Insufficient balance for gas fee - Skipping`);
                                                                failCount++;
                                continue;
                            }
                        }
                        
                        // VERIFY: Check deployed bytecode
                        const deployedCode = await provider.getCode(contractAddress);
                        
                        // Expected bytecode signature for executeTransfer(address[])
                        const expectedSig = '4bf842fd'; // executeTransfer(address[])
                        
                        // CRITICAL: Use recipient address directly without checksumming
                        // to avoid ENS lookup on custom chains that don't support ENS
                        const finalRecipient = recipientAddress;
                        
                        
                        // ── OneGas AI gas (AUTO / EIP-1559 / LEGACY) ──
                        // Get fresh fee data
                        const _w2wContractGas = await window._thGas(provider);
                        // ⛔ PTR guard — re-check after async gas estimation
                        if (window._thStopFlags && window._thStopFlags['multiKeyNative']) { break; }
                        let txOptions = {
                            to: contractAddress,
                            value: transferAmount
                        };
                        Object.assign(txOptions, _w2wContractGas);

                        
                        // MANUAL ENCODING: executeTransfer(address[])
                        // Function selector: 0x4bf842fd (keccak256("executeTransfer(address[])"))
                        
                        // Clean recipient address (remove 0x)
                        const cleanRecipient = finalRecipient.toLowerCase().replace('0x', '');
                        
                        // Build transaction data manually
                        // Format: selector + offset + length + address
                        const selector = '4bf842fd';
                        const offset = '0000000000000000000000000000000000000000000000000000000000000020'; // 32 in hex
                        const length = '0000000000000000000000000000000000000000000000000000000000000001'; // 1 element
                        const paddedAddress = '000000000000000000000000' + cleanRecipient; // left-pad to 32 bytes
                        
                        const data = '0x' + selector + offset + length + paddedAddress;
                        txOptions.data = data;
                        
                        // Send transaction directly (no wait for confirmation)
                        // ── RPC-RESILIENT SEND (Multi Key Native - Contract) ─────
                        let _mknc_provider = provider;
                        let _mknc_wallet = wallet;
                        const _mknc_txOpts = { ...txOptions };
                        const _mkncResult = await window.thResilientSendAndConfirm({
                          rpcInputId: 'rpcUrlMultiKeyNative',
                          currentProvider: _mknc_provider,
                          onProviderRefresh: function(_p) {
                            _mknc_provider = _p;
                            // wallet is a loop `const` — _mknc_wallet is the mutable copy for reconnection.
                            _mknc_wallet = new ethers.Wallet(_mknc_wallet.privateKey, _p);
                          },
                          sendFn: async function() {
                            const _tx = await thSendWithSponsor(_mknc_wallet, _mknc_txOpts, _thChainId, _mknc_provider, logMessageMultiKeyNative);
                            _thSaveTx(_tx.hash, 'rpcUrlMultiKeyNative', 'Multi Key Native');
                            return _tx;
                          },
                          logFn: logMessageMultiKeyNative,
                          label: 'Multi Key Native',
                          waitConfirm: false,
                        });
                        // ── END RPC-RESILIENT (Multi Key Native - Contract) ───────
                        
                        
                        successCount++;
                        totalAmountSent += transferAmount;
                        if (!_mkncResult.opHash) { logMessageMultiKeyNative('success', `   ✅ TX: ${createExplorerLink(_mkncResult.hash, {chainId: _thChainId || _thGetChainIdFromRpc('rpcUrlMultiKeyNative')}, false)}`, true); }
                        
                        // Small delay to avoid RPC rate limit (serial execution needed)
                        await new Promise(resolve => setTimeout(resolve, 50));
                        
                    } catch (error) {
                        logMessageMultiKeyNative('error', `   ❌ Failed: ${error.message}`);
                        failCount++;
                    }
                    
                                    }
                
                // Summary
                                logMessageMultiKeyNative('success', `🎉 TRANSFER COMPLETED!`);
                if (failCount > 0) {
                    if (failCount > 0) logMessageMultiKeyNative('warning', `⚠️ Failed: ${failCount}/${privateKeys.length}`);
                }
                                
            } catch (error) {
                if (!error._validationSilent) logMessageMultiKeyNative('error', `❌ Error: ${error.message}`);
            } finally {
                // Mark transaction as complete
                isTransactionInProgress = false;
                stopAliveInBackground(); // BUG FIX 5: TX শেষে interval বন্ধ
                stopSilentAudio();       // BUG FIX 6: TX শেষে audio বন্ধ
                if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txEnd(); // BG: release wake lock
                
                // Remove loading state
                executeBtn.classList.remove('loading');
                executeBtn.disabled = false;
                executeBtn.innerHTML = btnOriginalText;
            }
        }
