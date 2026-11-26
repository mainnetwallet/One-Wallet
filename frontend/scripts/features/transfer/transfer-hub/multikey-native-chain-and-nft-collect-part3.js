
        async function executeMultiKeyNative() {
            window._thStopFlags = window._thStopFlags || {}; window._thStopFlags['multiKeyNative'] = false;
            // Mark transaction as in progress for background execution
            isTransactionInProgress = true;
            keepAliveInBackground(); // BUG FIX 5: TX শুরুতে interval চালু
            startSilentAudio();      // BUG FIX 6: TX চলাকালীন audio চালু
            if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txStart(); // BG: wake lock
            
            try {
                                                
                // Get inputs - ALWAYS read fresh values from DOM
                const rpcUrl = document.getElementById('rpcUrlMultiKeyNative').value.trim();
                const _thRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('rpcUrlMultiKeyNative') : (rpcUrl ? [rpcUrl] : []);
                const _thChainId = parseInt((document.getElementById('rpcUrlMultiKeyNative')||{}).getAttribute?.('data-chainid')||'',10)||null;
                const developerKey = document.getElementById('privateKeyMultiKeyNative').value.trim();
                const privateKeysText = document.getElementById('senderPrivateKeysMultiKeyNative').value.trim();
                const recipientAddress = document.getElementById('recipientAddressMultiKeyNative').value.trim();
                const amount = document.getElementById('amountPerAddressMultiKeyNative').value.trim();
                
                // DEBUG LOG
                
                // Validation
                if (!rpcUrl) {
                    logMessageMultiKeyNative('error', '❌ Please enter RPC URL');
                    return;
                }
                
                if (!developerKey) {
                    logMessageMultiKeyNative('error', '❌ Please enter developer private key');
                    return;
                }
                
                if (!privateKeysText) {
                    logMessageMultiKeyNative('error', '❌ Please enter at least one sender private key');
                    return;
                }
                
                if (!recipientAddress || !ethers.isAddress(recipientAddress)) {
                    logMessageMultiKeyNative('error', '❌ Invalid recipient address');
                    return;
                }
                
                // Allow MAX mode or valid numeric amount
                const isMaxMode = amount.toUpperCase() === 'MAX';
                if (!isMaxMode && (!amount || parseFloat(amount) <= 0)) {
                    logMessageMultiKeyNative('error', '❌ Please enter a valid amount or click MAX button');
                    return;
                }
                
                // Parse sender private keys — any format supported
                const { keys: privateKeys } = parsePrivateKeys(privateKeysText);
                
                if (privateKeys.length === 0) {
                    logMessageMultiKeyNative('error', '❌ No valid sender private keys found');
                    return;
                }
                
                
                // Setup provider
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
                
                // Setup developer wallet
                const developerWallet = new ethers.Wallet(developerKey, provider);
                
                // Recipient + Amount logs removed
                
                                
                // ========================================
                // STEP 1: DEPLOY TRANSFER CONTRACT
                // ========================================
                                                                
                // Transfer Contract ABI and Bytecode
                const TRANSFER_CONTRACT_ABI = [
                    "constructor()",
                    "function owner() view returns (address)",
                    "function executeTransfer(address payable[] calldata recipients) public payable",
                    "function withdrawNative(address payable to) external",
                    "function withdrawToken(address token, address to) external",
                    "receive() external payable"
                ];
                
                // Transfer Contract Bytecode - v3.0 - Supports multi-recipient transfers
                // Using global TRANSFER_CONTRACT_BYTECODE
                
                try {
                    const factory = new ethers.ContractFactory(
                        TRANSFER_CONTRACT_ABI,
                        TRANSFER_CONTRACT_BYTECODE,
                        developerWallet
                    );
                    
                                        
                    // ── OneGas AI gas (AUTO / EIP-1559 / LEGACY) ──
                    // Get gas fee data
                    let deployOptions = {};
                    Object.assign(deployOptions, await window._thGas(provider));
                    
                    const contract = await factory.deploy(deployOptions);
                    
                                        await contract.waitForDeployment();
                    
                    const contractAddress = await contract.getAddress();
                    logMessageMultiKeyNative('success', `✅ Contract deployed successfully!`);
                    logMessageMultiKeyNative('success', `📍 Address: ${contractAddress}`);
                    
                    // ========================================
                    // STEP 2: SENDER WALLETS → RECIPIENT VIA CONTRACT
                    // ========================================
                                                                                
                    // Parse amount only if NOT in MAX mode
                    let amountWei;
                    if (!isMaxMode) {
                        amountWei = ethers.parseEther(
                            typeof amount === 'number' 
                                ? amount.toFixed(18).replace(/\.?0+$/, '') 
                                : amount
                        );
                    }
                    
                    let successCount = 0;
                    let failCount = 0;
                    let totalSent = 0n;
                    
                    // Get contract instance
                    const contractWithProvider = new ethers.Contract(
                        contractAddress,
                        TRANSFER_CONTRACT_ABI,
                        provider
                    );
                    
                    for (let i = 0; i < privateKeys.length; i++) {
                        if (window._thStopFlags && window._thStopFlags['multiKeyNative']) { logMessageMultiKeyNative('warning', '⛔ Stopped by Pull-to-Refresh'); break; }
                        const walletNum = i + 1;
                        try {
                            const wallet = new ethers.Wallet(privateKeys[i], provider);
                            
                                                        
                            // Check balance
                            const balance = await window.thRead('rpcUrlMultiKeyNative', provider, function(_p) { return _p.getBalance(wallet.address); }, 6000);
                            const balanceEth = ethers.formatEther(balance);
                                                        
                            // Determine transfer amount based on mode
                            let transferAmount;
                            
                            if (isMaxMode) {
                                // MAX MODE: Calculate max amount after gas estimation
                                
                                // Skip if balance is zero
                                if (balance === 0n) {
                                    logMessageMultiKeyNative('warning', `   💤 [${walletNum}] Balance is 0 — SKIPPED`);
                                    failCount++;
                                    continue;
                                }
                                
                                // Estimate gas for contract call
                                const txFeeData = await window.thRead('rpcUrlMultiKeyNative', provider, function(_p) { return _p.getFeeData(); }, 6000);
                                let estimatedGasUnits = 100000n; // Contract call uses more gas than simple transfer
                                let estimatedGasCost;
                                let isL2Chain = false;
                                
                                if (txFeeData.maxFeePerGas && txFeeData.maxPriorityFeePerGas) {
                                    const block = await window.thRead('rpcUrlMultiKeyNative', provider, function(_p) { return _p.getBlock('latest'); }, 6000);
                                    let baseFee = block.baseFeePerGas;
                                    
                                    if (!baseFee) {
                                        baseFee = txFeeData.maxFeePerGas;
                                    }
                                    
                                    // Detect L2 chains by very low baseFee (< 0.01 gwei)
                                    isL2Chain = baseFee < 10000000n; // 0.01 gwei
                                    
                                    const maxFeePerGas = (baseFee * 120n) / 100n;
                                    estimatedGasCost = maxFeePerGas * estimatedGasUnits;
                                } else if (txFeeData.gasPrice) {
                                    const gasPriceWithBuffer = (txFeeData.gasPrice * 120n) / 100n;
                                    estimatedGasCost = gasPriceWithBuffer * estimatedGasUnits;
                                } else {
                                    estimatedGasCost = ethers.parseUnits('0.001', 'ether'); // Fallback
                                }
                                
                                // Check if balance can cover gas
                                if (balance <= estimatedGasCost) {
                                    logMessageMultiKeyNative('warning', `   ⚠️ [${walletNum}] Insufficient balance to cover gas — SKIPPED`);
                                                                        failCount++;
                                    continue;
                                }
                                
                                // Calculate max transferable (balance - gas with buffer)
                                // For L2 chains or small balances, use much larger buffer
                                let bufferMultiplier;
                                if (isL2Chain) {
                                    // L2 chains have L1 data posting costs - need 300-400% buffer for contract calls
                                    bufferMultiplier = 400n; // 4x the estimated gas
                                } else if (balance < ethers.parseEther('0.001')) {
                                    // Very small balance - use larger buffer
                                    bufferMultiplier = 300n; // 3x the estimated gas
                                } else {
                                    // Normal case - 50% buffer for contract calls
                                    bufferMultiplier = 150n;
                                }
                                
                                const gasBuffer = (estimatedGasCost * bufferMultiplier) / 100n;
                                transferAmount = balance - gasBuffer;
                                
                                if (transferAmount <= 0n) {
                                    logMessageMultiKeyNative('warning', `   ⚠️ [${walletNum}] After gas buffer, nothing left to send — SKIPPED`);
                                                                        failCount++;
                                    continue;
                                }
                                
                                const bufferPercent = ((bufferMultiplier - 100n) * 100n) / 100n;
                                logMessageMultiKeyNative('success', `   ⚡ MAX MODE: Sending ${ethers.formatEther(transferAmount)} ETH (balance - ${bufferPercent}% gas buffer)`);
                                
                            } else {
                                // FIXED AMOUNT MODE
                                transferAmount = amountWei;
                                
                                if (balance < transferAmount) {
                                    logMessageMultiKeyNative('warning', `⚠️ [${walletNum}] Insufficient balance (${balanceEth} ETH). Skipping...`);
                                    failCount++;
                                    continue;
                                }
                            }
                            
                            
                            // Create fresh contract instance with sender wallet (fixing ABI attachment)
                            const contractWithSigner = new ethers.Contract(
                                contractAddress,
                                TRANSFER_CONTRACT_ABI,
                                wallet
                            );
                            
                            // ── OneGas AI gas (AUTO / EIP-1559 / LEGACY) ──
                            // Prepare transaction options
                            let txOptions = {
                                value: transferAmount
                            };
                            const _mkGas = await window._thGas(provider);
                            Object.assign(txOptions, _mkGas);
                            // FIX: keep value + gasLimit*maxFeePerGas <= balance in MAX mode (see Direct Transfer fix)
                            if (isMaxMode) {
                                const _feeCapC = _mkGas.maxFeePerGas || _mkGas.gasPrice;
                                if (_feeCapC) {
                                    const _reserveC = (_feeCapC * 120000n * 110n) / 100n;
                                    if (balance - _reserveC < txOptions.value) {
                                        txOptions.value = balance - _reserveC;
                                        transferAmount = txOptions.value;
                                        if (txOptions.value <= 0n) {
                                            logMessageMultiKeyNative('warning', `   ⚠️ [${walletNum}] Balance too low to cover gas — SKIPPED`);
                                            failCount++;
                                            continue;
                                        }
                                    }
                                }
                            }
                            if (_mkGas.maxFeePerGas) {
                            } else if (_mkGas.gasPrice) {
                            }
                            
                            // ⛔ PTR guard — re-check after async gas estimation
                            if (window._thStopFlags && window._thStopFlags['multiKeyNative']) { break; }

                            // ── RPC-RESILIENT SEND + CONFIRM (MK Native Contract) ──
                            let _mknCProvider = provider;
                            let _mknCWallet = wallet;
                            let _mknCContract = contractWithSigner;
                            const _mknCReceipt = await window.thResilientSendAndConfirm({
                              rpcInputId: 'rpcUrlMultiKeyNative',
                              currentProvider: _mknCProvider,
                              onProviderRefresh: function(_p) {
                                _mknCProvider = _p;
                                _mknCWallet = new ethers.Wallet(_mknCWallet.privateKey, _p);
                                _mknCContract = new ethers.Contract(contractAddress, TRANSFER_CONTRACT_ABI, _mknCWallet);
                              },
                              sendFn: async function() {
                                const _tx = await _mknCContract.executeTransfer([recipientAddress], txOptions);
                                _thSaveTx(_tx.hash, 'rpcUrlMultiKeyNative', 'Multi Key Native');
                                return _tx;
                              },
                              logFn: logMessageMultiKeyNative,
                              label: 'MK Native Contract',
                              waitConfirm: true,
                            });
                            const receipt = _mknCReceipt;
                            // ── END RPC-RESILIENT (MK Native Contract) ─────────────
                            
                            logMessageMultiKeyNative('success', `✅ [${walletNum}] Transfer confirmed! TX: ${_mknCReceipt.hash || _mknCReceipt.transactionHash}`);
                            
                            successCount++;
                            totalSent += transferAmount;
                            
                        } catch (error) {
                            logMessageMultiKeyNative('error', `❌ [${walletNum}] Failed: ${error.message.substring(0, 80)}`);
                            failCount++;
                        }
                    }
                    
                                            logMessageMultiKeyNative('success', `💰 Total sent to recipient: ${ethers.formatEther(totalSent)} ETH`);
                    
                    // Final summary
                                                            logMessageMultiKeyNative('success', '🎉 MULTI-KEY TRANSFER COMPLETED!');
                                                
                    // SAVE CONTRACT TO CENTRAL STORAGE
                    const chainName = currentChainConfigMultiKeyNative?.name || 'Unknown Chain';
                    const chainId = currentChainConfigMultiKeyNative?.chainId || 0;
                    const chainSymbol = currentChainConfigMultiKeyNative?.symbol || 'ETH';
                    const rpcUrlForSave = document.getElementById('rpcUrlMultiKeyNative').value.trim();
                    
                    addToCentralContracts({
                        address: contractAddress,
                        chainName: chainName,
                        chainId: chainId,
                        chainSymbol: chainSymbol,
                        type: 'native',
                        section: 'Multi Key Native',
                        symbol: chainSymbol,
                        deployedAt: new Date().toISOString(),
                        recipientAddress: recipientAddress,
                        rpcUrl: rpcUrlForSave
                    });
                    
                    
                } catch (deployError) {
                    logMessageMultiKeyNative('error', `❌ Deployment failed: ${deployError.message}`);
                }
                
            } catch (error) {
                logMessageMultiKeyNative('error', `❌ Fatal error: ${error.message}`);
            } finally {
                // Mark transaction as complete
                isTransactionInProgress = false;
                stopAliveInBackground(); // BUG FIX 5: TX শেষে interval বন্ধ
                stopSilentAudio();       // BUG FIX 6: TX শেষে audio বন্ধ
                if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txEnd(); // BG: release wake lock
            }
        }

        function clearLogMultiKeyNative() {
            document.getElementById('logContainerMultiKeyNative').innerHTML = '';
                    }

        // ========================================
        // MULTI-RECIPIENT CONTRACT DEPLOYMENT & TRANSFER
        // ========================================
        
        let selectedTransferMode = 'direct'; // 'direct' or 'contract'
        
        function selectTransferMode(mode) {
            selectedTransferMode = mode;
            
            const directCard = document.getElementById('directTransferModeCard');
            const contractCard = document.getElementById('contractTransferModeCard');
            const directSection = document.getElementById('directTransferSection');
            const contractSection = document.getElementById('contractTransferSection');
            
            if (mode === 'direct') {
                // Highlight direct mode
                directCard.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
                directCard.style.border = '3px solid #10b981';
                directCard.style.color = 'white';
                
                contractCard.style.background = '#1a2a3a';
                contractCard.style.border = '2px solid #2a3a4a';
                contractCard.style.color = '#4a9eff';
                
                directSection.style.display = 'block';
                contractSection.style.display = 'none';
                
            } else {
                // Highlight contract mode
                contractCard.style.background = 'linear-gradient(135deg, #4a9eff 0%, #3b82f6 100%)';
                contractCard.style.border = '3px solid #4a9eff';
                contractCard.style.color = 'white';
                
                directCard.style.background = '#1a2a3a';
                directCard.style.border = '2px solid #2a3a4a';
                directCard.style.color = '#4a9eff';
                
                directSection.style.display = 'none';
                contractSection.style.display = 'block';

                // ── Deselect any previously active contract so user must
                //    explicitly pick one in this session ──────────────────
                savedContractsMultiKeyNative.forEach(c => c.isActive = false);
                activeContractAddressMultiKeyNative = null;
                deployedContractAddressMultiKeyNative = null;
                try {
                    localStorage.setItem('multiKeyNativeContracts', JSON.stringify(savedContractsMultiKeyNative));
                } catch(_) {}
                renderSavedContractsMultiKeyNative();
            }
            updateButtonStates();
        }
        
        function parseRecipients(input) {
            const lines = input.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            const recipients = [];
            
            for (const line of lines) {
                const parts = line.split(/\s+/);
                const address = parts[0];
                
                // Validate address
                if (!ethers.isAddress(address)) {
                    continue;
                }
                
                // Check for custom amount
                let amount = null;
                if (parts.length > 1) {
                    const customAmount = parseFloat(parts[1]);
                    if (!isNaN(customAmount) && customAmount > 0) {
                        amount = customAmount;
                    }
                }
                
                recipients.push({ address, customAmount: amount });
            }
            
            return recipients;
        }
        
        function validateRecipientsMultiKeyNative() {
            const textarea = document.getElementById('recipientsListMultiKeyNative');
            const defaultAmount = document.getElementById('amountPerAddressMultiKeyNative').value;
            
            if (!textarea.value.trim()) {
                logMessageMultiKeyNative('error', '❌ No recipients provided');
                return;
            }
            
            const recipients = parseRecipients(textarea.value);
            
            if (recipients.length === 0) {
                logMessageMultiKeyNative('error', '❌ No valid recipients found');
                return;
            }
            
            // Update display
            document.getElementById('recipientCountMultiKeyNative').textContent = recipients.length;
            document.getElementById('defaultAmountDisplayMultiKeyNative').textContent = defaultAmount || '0';
            
            // Calculate total
            const defaultAmt = parseFloat(defaultAmount) || 0;
            let totalAmount = 0;
            recipients.forEach(r => {
                totalAmount += r.customAmount || defaultAmt;
            });
            
            document.getElementById('totalRecipientsAmountMultiKeyNative').textContent = totalAmount.toFixed(6);
            
            
            // Update clean list
            const cleanedList = recipients.map(r => {
                if (r.customAmount) {
                    return `${r.address} ${r.customAmount}`;
                }
                return r.address;
            }).join('\n');
            textarea.value = cleanedList;
            
            updateButtonStates();
        }
        
        function clearRecipientsMultiKeyNative() {
            document.getElementById('recipientsListMultiKeyNative').value = '';
            document.getElementById('recipientCountMultiKeyNative').textContent = '0';
            document.getElementById('totalRecipientsAmountMultiKeyNative').textContent = '0';
            updateButtonStates();
        }
