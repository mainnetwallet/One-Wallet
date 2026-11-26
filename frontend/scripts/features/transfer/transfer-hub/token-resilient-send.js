
        async function executeTransferToken() {
            window._thStopFlags = window._thStopFlags || {}; window._thStopFlags['batchTransfer'] = false;
            // CRITICAL: Read key from actualKeysStorage (wallet picker stores real key there; DOM may be masked)
            const freshPrivateKey = (window.actualKeysStorage && window.actualKeysStorage['privateKeyToken'])
                ? window.actualKeysStorage['privateKeyToken'].trim()
                : document.getElementById('privateKeyToken').value.trim();
            
            if (!freshPrivateKey) {
                logMessageToken('error', '❌ Private key is required');
                return;
            }
            
            
            // Sanitize the private key
            let privateKey = freshPrivateKey;
            if (privateKey) {
                privateKey = sanitisePrivateKey(privateKey);
                // Ensure it has 0x prefix for ethers.js
                if (!privateKey.startsWith('0x')) {
                    privateKey = '0x' + privateKey;
                }
            }
            
            const tokenAddress = document.getElementById('tokenContractAddress').value.trim();
            const tokenSymbol = document.getElementById('tokenSymbol').value.trim() || 'TOKEN';
            const tokenDecimals = parseInt(document.getElementById('tokenDecimals').value) || 18;
            const rpcUrl = document.getElementById('rpcUrlToken').value.trim();
            const _thRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('rpcUrlToken') : (rpcUrl ? [rpcUrl] : []);
            const _thChainId = parseInt((document.getElementById('rpcUrlToken')||{}).getAttribute?.('data-chainid')||'',10)||null;
            const receiverAddresses = parseAddresses(document.getElementById('receiverAddressesToken').value);
            const amountPerAddress = document.getElementById('amountPerAddressToken').value.trim();
            
            // Check if contract is deployed
            if (!deployedContractAddressToken) {
                logMessageToken('error', '❌ Please deploy contract first!');
                return;
            }
            
            // Validation
            if (!privateKey || privateKey.length !== 66) {
                logMessageToken('error', '❌ Invalid private key (must be 64 hex characters)');
                return;
            }
            
            if (!tokenAddress || !ethers.isAddress(tokenAddress)) {
                logMessageToken('error', '❌ Invalid token address');
                return;
            }
            
            if (!rpcUrl) {
                logMessageToken('error', '❌ RPC URL required');
                return;
            }
            
            if (receiverAddresses.length === 0) {
                logMessageToken('error', '❌ No recipient addresses');
                return;
            }
            
            if (!amountPerAddress || parseFloat(amountPerAddress) <= 0) {
                logMessageToken('error', '❌ Invalid amount');
                return;
            }
            
            // Validate all addresses
            const validAddresses = [];
            for (const addr of receiverAddresses) {
                const cleanAddr = addr.trim();
                if (cleanAddr && ethers.isAddress(cleanAddr)) {
                    validAddresses.push(cleanAddr);
                }
            }
            
            if (validAddresses.length === 0) {
                logMessageToken('error', '❌ No valid addresses found');
                return;
            }
            
            // Add loading state to Execute button
            const executeBtn = document.getElementById('executeBtnToken');
            const btnOriginalText = executeBtn.innerHTML;
            
            executeBtn.classList.add('loading');
            executeBtn.disabled = true;
            executeBtn.innerHTML = '⏳ Executing...';
            if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txStart(); // BG: wake lock
            
                                                            
            try {
                // FIX: use thWithFallback for automatic multi-RPC failover
                let provider;
                try {
                  provider = await window.thWithFallback('rpcUrlToken', async function(_p) {
                    await Promise.race([_p.getBlockNumber(), new Promise((_,r)=>setTimeout(()=>r(new Error('probe timeout')),5000))]);
                    return _p;
                  }, 5000);
                } catch(_thErr) {
                  // All RPCs in list failed — fall back to single URL so caller can surface error naturally
                  const _fbCid = parseInt((document.getElementById('rpcUrlToken')||{}).getAttribute?.('data-chainid')||'',10)||null;
                  provider = window._thMakeProvider(rpcUrl, _fbCid);
                }
                let wallet = new ethers.Wallet(privateKey, provider);
                
                                
                // ERC20 ABI
                const ERC20_ABI = [
                    "function transfer(address to, uint256 amount) returns (bool)",
                    "function balanceOf(address account) view returns (uint256)",
                    "function decimals() view returns (uint8)",
                    "function symbol() view returns (string)",
                    "function approve(address spender, uint256 amount) returns (bool)",
                    "function allowance(address owner, address spender) view returns (uint256)"
                ];
                
                const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
                
                // Check user balance
                const userBalance = await tokenContract.balanceOf(wallet.address);
                const balanceFormatted = ethers.formatUnits(userBalance, tokenDecimals);
                                
                const amountWei = ethers.parseUnits(amountPerAddress, tokenDecimals);
                const totalRequired = amountWei * BigInt(validAddresses.length);
                
                if (userBalance < totalRequired) {
                    logMessageToken('error', `❌ Insufficient balance. Need: ${ethers.formatUnits(totalRequired, tokenDecimals)} ${tokenSymbol}`);
                    return;
                }
                
                // Step 2: Transfer tokens to contract
                                
                // Check contract balance BEFORE transfer
                const balanceBefore = await tokenContract.balanceOf(deployedContractAddressToken);
                                
                // ── OneGas AI gas (AUTO / EIP-1559 / LEGACY) ──
                // Get gas fee data
                let txOptions = {};
                Object.assign(txOptions, await window._thGas(provider));
                // ⛔ PTR guard — re-check after async gas estimation
                if (window._thStopFlags && window._thStopFlags['batchTransfer']) { return; }
                const transferTx = await thTokenSendWithSponsor(wallet, tokenContract, deployedContractAddressToken, totalRequired, _thChainId, provider, function(){}, txOptions, false);
                                
                const transferReceipt = await transferTx.wait();
                                
                // CRITICAL: Verify transfer by checking balance AFTER
                const balanceAfter = await tokenContract.balanceOf(deployedContractAddressToken);
                const actualTransferred = balanceAfter - balanceBefore;
                
                // Verify the transfer was successful
                // fee-on-transfer / tax tokens may arrive less — still proceed if any tokens arrived
                if (actualTransferred <= 0n) {
                                        logMessageToken('error', '❌ TRANSFER VERIFICATION FAILED!');
                                        logMessageToken('error', '⚠️ Cannot proceed with distribution - no tokens arrived in contract');
                    return;
                }
                if (actualTransferred < totalRequired) {
                    const pct = Number(actualTransferred * 100n / totalRequired);
                    logMessageToken('warning', `⚠️ Fee-on-transfer detected: ${pct}% received (${ethers.formatUnits(actualTransferred, tokenDecimals)} ${tokenSymbol}). Distributing actual balance.`);
                }
                
                logMessageToken('success', `✅ Tokens sent to contract TX: ${transferTx.hash}`);
                
                // Use ACTUAL contract balance for distribution
                const contractBalance = balanceAfter;
                const contractBalanceFormatted = ethers.formatUnits(contractBalance, tokenDecimals);
                                
                // Check if contract has any tokens
                if (contractBalance === 0n) {
                    logMessageToken('error', `❌ Contract has no tokens to distribute!`);
                    return;
                }
                
                // Calculate equal distribution per address based on ACTUAL contract balance
                const baseAmountPerRecipient = contractBalance / BigInt(validAddresses.length);
                const remainder = contractBalance % BigInt(validAddresses.length);
                
                
                if (remainder > 0n) {
                                    }
                
                                
                                
                // Batch Size অনুযায়ী chunk করে executeTransfer চালাবো
                const contractABI = [
                    "function executeTransfer(address tokenAddress, address[] calldata recipients, uint256[] calldata amounts) external"
                ];
                
                let deployedContract = new ethers.Contract(deployedContractAddressToken, contractABI, wallet);
                
                const batchSize = parseInt(document.getElementById('batchSizeToken').value) || 50;
                const totalBatches = Math.ceil(validAddresses.length / batchSize);
                
                                updateProgressToken(50);
                
                try {
                    let totalGasUsed = BigInt(0);
                    let completedCount = 0;
                    
                    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
                        if (window._thStopFlags && window._thStopFlags['batchTransfer']) { logMessageToken('warning', '⛔ Stopped by Pull-to-Refresh'); break; }
                        const startIdx = batchIndex * batchSize;
                        const endIdx = Math.min(startIdx + batchSize, validAddresses.length);
                        const batchAddresses = validAddresses.slice(startIdx, endIdx);
                        
                        // প্রতিটা address এর জন্য baseAmountPerRecipient
                        // শুধু last batch এর last recipient এ remainder যাবে
                        const batchAmounts = new Array(batchAddresses.length).fill(baseAmountPerRecipient);
                        
                        const isLastBatch = (batchIndex === totalBatches - 1);
                        if (isLastBatch && remainder > 0n) {
                            batchAmounts[batchAmounts.length - 1] = baseAmountPerRecipient + remainder;
                        }
                        
                        logMessageToken('info', `📤 Batch ${batchIndex + 1}/${totalBatches} — ${batchAddresses.length} addresses`);
                        
                        // ── OneGas AI gas (AUTO / EIP-1559 / LEGACY) ──
                        // প্রতিটা batch এর জন্য fresh fee data
                        let batchTxOptions = {};
                        Object.assign(batchTxOptions, await window._thGas(provider));
                        
                        // ⛔ PTR guard — re-check after async gas estimation
                        if (window._thStopFlags && window._thStopFlags['batchTransfer']) { break; }

                        // ── RPC-RESILIENT SEND + CONFIRM (Token) ──────────────────
                        let _tokenSentTxHash = null;
                        const _tRpcList = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('rpcUrlToken') : [];
                        const _tMaxTries = Math.max(_tRpcList.length, 1);
                        let _tokenReceipt = null;

                        for (let _tRpcTry = 0; _tRpcTry < _tMaxTries; _tRpcTry++) {
                          try {
                            if (_tokenSentTxHash) {
                              // TX broadcast — switch RPC just to confirm
                              const _tfp = await (async () => {
                                for (let _fi = 0; _fi < _tRpcList.length; _fi++) {
                                  try {
                                    const _fp = window._thMakeProvider(_tRpcList[(_tRpcTry + _fi) % _tRpcList.length],
                                      parseInt((document.getElementById('rpcUrlToken')||{}).getAttribute?.('data-chainid')||'',10)||null);
                                    await Promise.race([_fp.getBlockNumber(), new Promise((_,r)=>setTimeout(()=>r(new Error('probe')),4000))]);
                                    return _fp;
                                  } catch(_) {}
                                }
                                return provider;
                              })();
                              _tokenReceipt = await _tfp.waitForTransaction(_tokenSentTxHash, 1, 60000);
                              break;
                            }

                            if (_tRpcTry > 0) {
                              try {
                                provider = await window.thWithFallback('rpcUrlToken', async function(_p) {
                                  await Promise.race([_p.getBlockNumber(), new Promise((_,r)=>setTimeout(()=>r(new Error('probe')),4000))]);
                                  return _p;
                                }, 5000);
                                wallet = new ethers.Wallet(privateKey, provider);
                                deployedContract = new ethers.Contract(deployedContractAddressToken, contractABI, wallet);
                              } catch(_) {}
                            }

                            let batchTx;
                            if (_thChainId === 8453 && typeof sendSwapViaUserOp === 'function') {
                                // Base chain — sponsor distribution via Paymaster
                                try {
                                    const _distIface = new ethers.Interface([
                                        "function executeTransfer(address tokenAddress, address[] calldata recipients, uint256[] calldata amounts) external"
                                    ]);
                                    const _distData = _distIface.encodeFunctionData('executeTransfer', [
                                        tokenAddress, batchAddresses, batchAmounts
                                    ]);
                                    const _pmRes = await sendSwapViaUserOp(
                                        wallet,
                                        { to: deployedContractAddressToken, value: 0n, data: _distData },
                                        provider,
                                        function(){}
                                    );
                                    _tokenSentTxHash = _pmRes.txHash || String(_pmRes);
                                    _tokenReceipt = { gasUsed: 0n, transactionHash: _tokenSentTxHash };
                                    break;
                                } catch(_pmErr) {
                                    logMessageToken('warning', '⚠️ Sponsor failed: ' + _pmErr.message.slice(0, 80) + ' → EOA fallback');
                                    // fall through to EOA
                                }
                            }
                            batchTx = await deployedContract.executeTransfer(
                                tokenAddress,
                                batchAddresses,
                                batchAmounts,
                                batchTxOptions
                            );
                            _tokenSentTxHash = batchTx.hash;
                            _thSaveTx(batchTx.hash, 'rpcUrlToken', 'Batch Token Transfer');
                            _tokenReceipt = await batchTx.wait();
                            break;

                          } catch (_tErr) {
                            const _tIsLast = (_tRpcTry === _tMaxTries - 1);
                            if (_tokenSentTxHash) {
                            } else {
                            }
                            if (_tIsLast) throw _tErr;
                          }
                        }

                        const receipt = _tokenReceipt;
                        totalGasUsed += receipt.gasUsed;
                        completedCount += batchAddresses.length;
                        // ── END RPC-RESILIENT SEND (Token) ────────────────────────
                        
                        // Progress: 50% থেকে 100% পর্যন্ত বাড়ানো
                        const progress = 50 + Math.round((completedCount / validAddresses.length) * 50);
                        updateProgressToken(progress);
                        
                        logMessageToken('success', `✅ Batch ${batchIndex + 1}/${totalBatches} confirmed! TX: ${_tokenSentTxHash}`);
                    }
                    
                    updateProgressToken(100);
                                        logMessageToken('success', `🎉 All ${validAddresses.length} recipients received tokens!`);
                                                            if (remainder > 0n) {
                                            }
                                        
                    // Contract stays selected after execute — user can re-run without redeploying
                    renderSavedContractsToken();
                    validateTokenInputs();
                    
                } catch (error) {
                    updateProgressToken(0);
                    logMessageToken('error', `❌ Batch transfer failed: ${error.message}`);
                    
                    // Check if it's an overflow error (special token like Aave v3)
                    if (error.message.includes('OVERFLOW') || error.message.includes('Panic')) {
                                                                                                                                                    }
                    
                    // Show failed status
                                    }
                
                // Reset progress bar
                setTimeout(() => updateProgressToken(0), 2000);
                
            } catch (error) {
                logMessageToken('error', `❌ Error: ${error.message}`);
                updateProgressToken(0);
            } finally {
                // Restore button state
                const executeBtn = document.getElementById('executeBtnToken');
                executeBtn.classList.remove('loading');
                executeBtn.innerHTML = btnOriginalText;
                executeBtn.disabled = false;
                if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txEnd(); // BG: release wake lock
            }
        }
        
        function updateProgressToken(percent) {
            const progressFill = document.getElementById('progressFillToken');
            if (progressFill) {
                progressFill.style.width = percent + '%';
            }
        }