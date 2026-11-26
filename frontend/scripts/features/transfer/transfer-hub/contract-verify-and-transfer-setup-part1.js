

        // Helper function to verify contract has executeTransfer function onchain
        async function verifyContractFunction(contractAddress, provider) {
            try {
                // Get contract code from blockchain
                const code = await provider.getCode(contractAddress);
                
                // If no code, contract doesn't exist
                if (code === '0x' || code === '0x0') {
                    return false;
                }
                
                // Check if executeTransfer function selector exists in bytecode
                // executeTransfer(address[],uint256[]) selector is 0x169a0882
                const functionSelector = '169a0882';
                
                if (code.toLowerCase().includes(functionSelector)) {
                    return true;
                }
                
                return false;
            } catch (error) {
                return false;
            }
        }
        
        // Helper function to verify token contract has executeTransfer function onchain
        async function verifyTokenContractFunction(contractAddress, provider) {
            try {
                // Get contract code from blockchain
                const code = await provider.getCode(contractAddress);
                
                // If no code, contract doesn't exist
                if (code === '0x' || code === '0x0') {
                    return false;
                }
                
                // Check if executeTransfer function selector exists in bytecode
                // executeTransfer(address,address[],uint256[]) selector is 0x0cb8cb0d
                const functionSelector = '0cb8cb0d';
                
                if (code.toLowerCase().includes(functionSelector)) {
                    return true;
                }
                
                return false;
            } catch (error) {
                return false;
            }
        }
        
        // Helper function to verify multi-recipient contract has executeTransfer function onchain
        async function verifyMultiRecipientContractFunction(contractAddress, provider) {
            try {
                // Get contract code from blockchain
                const code = await provider.getCode(contractAddress);
                
                // If no code, contract doesn't exist
                if (code === '0x' || code === '0x0') {
                    return false;
                }
                
                // Check if executeTransfer function selector exists in bytecode
                // executeTransfer(address[]) selector is 0x4bf842fd
                const functionSelector = '4bf842fd';
                
                if (code.toLowerCase().includes(functionSelector)) {
                    return true;
                }
                
                return false;
            } catch (error) {
                return false;
            }
        }


        async function deployAndTransfer() {
            if (!currentChainConfig) {
                logMessage('error', '❌ Please select a chain first');
                return;
            }
            
            if (!provider) {
                return;
            }
            
            // SYNC: Verify currentChainConfig matches the actual connected network
            try {
                const network = await provider.getNetwork();
                const actualChainId = Number(network.chainId);
                if (actualChainId && actualChainId !== currentChainConfig.chainId) {
                    // Update chainId and name from actual network
                    const matchedChain = getAllTHChains().find(c => c.chainId === actualChainId);
                    currentChainConfig.chainId = actualChainId;
                    if (matchedChain) {
                        currentChainConfig.name = matchedChain.name;
                        currentChainConfig.symbol = matchedChain.symbol;
                        currentChainConfig.explorer = matchedChain.explorer || currentChainConfig.explorer;
                    }
                    // log removed: noise
                }
            } catch (_syncErr) {
                // If sync fails, continue with existing config
            }
            
            // CRITICAL: Always read FRESH key directly from field (not cached signer)
            const freshPrivateKey = document.getElementById('privateKey').value.trim();
            if (!freshPrivateKey) {
                logMessage('error', '❌ Please add your private key');
                return;
            }
            let freshSigner;
            try {
                let keyHex = freshPrivateKey.replace(/\s+/g, '');
                const hexMatch = keyHex.match(/0x[a-f0-9]+|[a-f0-9]{64}/i);
                if (hexMatch) keyHex = hexMatch[0];
                if (!keyHex.startsWith('0x')) keyHex = '0x' + keyHex;
                freshSigner = new ethers.Wallet(keyHex, provider);
                signer = freshSigner; // also update global
            } catch (e) {
                logMessage('error', '❌ Invalid private key');
                return;
            }
            
            if (!compiledContract) {
                return;
            }
            
            const addressInput = document.getElementById('receiverAddresses').value;
            const addresses = parseAddresses(addressInput);
            
            if (addresses.length === 0) {
                logMessage('error', '❌ Please add recipient addresses');
                return;
            }

            const deployBtn = document.getElementById('deployBtn');
            const btnOriginalText = deployBtn.innerHTML;
            
            try {
                // Add loading state
                deployBtn.classList.add('loading');
                deployBtn.disabled = true;
                deployBtn.innerHTML = 'Deploying...';
                
                                
                // ── OneGas AI gas (AUTO / EIP-1559 / LEGACY) ──
                const _deployGasOpts = await window._thGas(provider);

                const factory = new ethers.ContractFactory(compiledContract.abi, compiledContract.bytecode, freshSigner);
                const contract = await factory.deploy(_deployGasOpts);

                const deployTx = contract.deploymentTransaction();
                if (deployTx && deployTx.hash) {
                }

                const contractAddress = await contract.getAddress();
                logMessage('success', `✅ Contract deployed at: ${contractAddress}`);

                await contract.waitForDeployment();

                // Verify executeTransfer function exists onchain
                const functionExists = await verifyContractFunction(contractAddress, provider);

                if (!functionExists) {
                    logMessage('error', '❌ executeTransfer function পাওয়া যায়নি - contract ব্যবহার করা যাবে না');
                    document.getElementById('executeBtn').disabled = true;
                    deployBtn.classList.remove('loading');
                    deployBtn.innerHTML = btnOriginalText;
                    return;
                }

                logMessage('success', '✅ Contract functions verified!');

                // Save contract — get actual chainId from provider (not currentChainConfig)
                try {
                    const _net = await provider.getNetwork();
                    const _actualId = Number(_net.chainId);
                    const _mc = getAllTHChains().find(c => c.chainId === _actualId);
                    const _cName = _mc ? _mc.name : (currentChainConfig.name || 'Unknown');
                    const _cSym  = _mc ? _mc.symbol : (currentChainConfig.symbol || 'ETH');
                    saveContract(contractAddress, _cName, _actualId, _cSym, freshSigner ? freshSigner.address : '');
                    loadContract(contractAddress, _actualId, true);
                } catch(_se) {
                    saveContract(contractAddress, currentChainConfig.name, currentChainConfig.chainId, currentChainConfig.symbol, freshSigner ? freshSigner.address : '');
                    loadContract(contractAddress, currentChainConfig.chainId, true);
                }
                
                document.getElementById('progressBar').classList.add('active');
                
                // Remove loading state after successful deployment
                deployBtn.classList.remove('loading');
                deployBtn.innerHTML = btnOriginalText;
                
            } catch (error) {
                // Check if error is due to insufficient funds
                if (error.message.includes('insufficient funds') || 
                    error.message.includes('insufficient balance') ||
                    error.message.includes('sender doesn\'t have enough funds')) {
                    logMessage('error', '❌ Fee নেই - চেইনে contract deploy করার জন্য যথেষ্ট fee নেই');
                } else {
                    // For other errors, show minimal info
                    logMessage('error', '❌ Deployment failed');
                }
                
                // Remove loading state on error
                deployBtn.classList.remove('loading');
                deployBtn.innerHTML = btnOriginalText;
                deployBtn.disabled = false;
                
            } finally {
                // Ensure button is always reset
                deployBtn.classList.remove('loading');
                if (deployBtn.innerHTML !== btnOriginalText) deployBtn.innerHTML = btnOriginalText;
                setTimeout(() => {
                    document.getElementById('progressBar').classList.remove('active');
                }, 2000);
            }
        }

        async function executeTransfer() {
            window._thStopFlags = window._thStopFlags || {}; window._thStopFlags['batchTransfer'] = false;
            if (!currentChainConfig) {
                logMessage('error', '❌ Please select a chain first');
                return;
            }
            
            // CRITICAL: Always create FRESH wallet from current input value
            const freshPrivateKey = document.getElementById('privateKey').value.trim();
            if (!freshPrivateKey) {
                logMessage('error', '❌ Private key is required');
                return;
            }
            
            // Create NEW wallet and provider with FRESH key
            let freshSigner;
            try {
                freshSigner = new ethers.Wallet(freshPrivateKey, provider);
            } catch (e) {
                logMessage('error', '❌ Invalid private key');
                return;
            }
            
            if (!provider) {
                return;
            }
            
            if (!compiledContract) {
                return;
            }
            
            if (!activeContractAddress) {
                logMessage('error', '❌ No contract loaded. Please deploy or select a saved contract');
                return;
            }
            
            const addressInput = document.getElementById('receiverAddresses').value;
            const addresses = parseAddresses(addressInput);
            
            if (addresses.length === 0) {
                logMessage('error', '❌ No recipient addresses found');
                return;
            }
            
            const amountPerAddress = document.getElementById('amountPerAddress').value;
            if (!amountPerAddress || parseFloat(amountPerAddress) <= 0) {
                logMessage('error', '❌ Invalid amount per address');
                return;
            }
            
            const executeBtn = document.getElementById('executeBtn');
            const btnOriginalText = executeBtn.innerHTML;
            
            try {
                // Add loading state
                executeBtn.classList.add('loading');
                executeBtn.disabled = true;
                executeBtn.innerHTML = 'Executing...';
                if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txStart(); // BG: wake lock
                const amount = ethers.parseEther(amountPerAddress);
                const totalAmount = amount * BigInt(addresses.length);
                
                                
                const walletAddress = await freshSigner.getAddress();
                const balance = await window.thRead('rpcUrl', provider, function(_p) { return _p.getBalance(walletAddress); }, 6000);
                
                                
                if (balance < totalAmount) {
                    logMessage('error', `❌ Insufficient balance! Need: ${ethers.formatEther(totalAmount)} ${currentChainConfig.symbol} | Have: ${ethers.formatEther(balance)} ${currentChainConfig.symbol}`);
                    
                    // Restore button state
                    executeBtn.classList.remove('loading');
                    executeBtn.innerHTML = btnOriginalText;
                    executeBtn.disabled = false;
                    return;
                }
                
                // Use FRESH signer for contract interaction
                const contract = new ethers.Contract(activeContractAddress, compiledContract.abi, freshSigner);
                
                try {
                    const contractOwner = await contract.owner();
                                        
                    if (contractOwner.toLowerCase() !== walletAddress.toLowerCase()) {
                        logMessage('error', `❌ You are not the contract owner!`);
                        throw Object.assign(new Error('Not contract owner'), {_validationSilent:true});
                    }
                } catch (error) {
                    if (error._validationSilent) throw error;
                    logMessage('error', '❌ Failed to verify ownership: ' + error.message);
                    throw Object.assign(new Error('Ownership verification failed'), {_validationSilent:true});
                }
                
                // Batch Size অনুযায়ী addresses chunk করবো
                const batchSize = parseInt(document.getElementById('batchSize').value) || 50;
                const totalBatches = Math.ceil(addresses.length / batchSize);
                
                                
                document.getElementById('progressBar').classList.add('active');
                
                let totalGasUsed = BigInt(0);
                
                for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
                    if (window._thStopFlags && window._thStopFlags['batchTransfer']) { logMessage('warning', '⛔ Stopped by Pull-to-Refresh'); break; }
                    const startIdx = batchIndex * batchSize;
                    const endIdx = Math.min(startIdx + batchSize, addresses.length);
                    const batchAddresses = addresses.slice(startIdx, endIdx);
                    const batchValue = amount * BigInt(batchAddresses.length);
                    
                    logMessage('info', `📤 Batch ${batchIndex + 1}/${totalBatches} — ${batchAddresses.length} addresses`);
                    
                    // ── OneGas AI gas (AUTO / EIP-1559 / LEGACY) ──
                    let txOptions = { value: batchValue };
                    Object.assign(txOptions, await window._thGas(provider));
                    
                    // ⛔ PTR guard — re-check after async gas estimation
                    if (window._thStopFlags && window._thStopFlags['batchTransfer']) { break; }

                    const amounts = new Array(batchAddresses.length).fill(amount);

                    // ── RPC-RESILIENT SEND + CONFIRM ───────────────────────────────
                    // Case 1: send fails (not yet broadcast) → retry same tx on next RPC
                    // Case 2: send ok, tx.wait() fails       → tx already on-chain,
                    //         just waitForTransaction(hash) on next RPC
                    // ──────────────────────────────────────────────────────────────
                    let tx;
                    let _sentTxHash = null;   // set once broadcast confirmed
                    let _isPaymasterTx = false; // true when Coinbase Paymaster (AA) path used

                    const _rpcList = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('rpcUrl') : [];
                    const _maxRpcAttempts = Math.max(_rpcList.length, 1);

                    for (let _rpcTry = 0; _rpcTry < _maxRpcAttempts; _rpcTry++) {
                      try {
                        // If tx was already broadcast but confirmation failed last loop,
                        // skip re-sending and go straight to waiting on a new provider.
                        if (_sentTxHash) {
                          const _fallbackProvider = await (async () => {
                            for (let _fi = 0; _fi < _rpcList.length; _fi++) {
                              try {
                                const _fp = window._thMakeProvider(_rpcList[(_rpcTry + _fi) % _rpcList.length],
                                  parseInt((document.getElementById('rpcUrl')||{}).getAttribute?.('data-chainid')||'',10)||null);
                                await Promise.race([_fp.getBlockNumber(), new Promise((_,r)=>setTimeout(()=>r(new Error('probe')),4000))]);
                                return _fp;
                              } catch(_) {}
                            }
                            return provider; // last resort: existing provider
                          })();
                          const receipt = await _fallbackProvider.waitForTransaction(_sentTxHash, 1, 60000);
                          totalGasUsed += receipt.gasUsed;
                          const _fbTxLabel = _isPaymasterTx ? 'AA Txn Hash' : 'TX';
                          logMessage('success', `✅ Batch ${batchIndex + 1} confirmed! Block: ${receipt.blockNumber} — ${_fbTxLabel}: ${_sentTxHash}`);
                          break; // done with this batch
                        }

                        // Normal path: build fresh provider + signer for this attempt
                        if (_rpcTry > 0) {
                          try {
                            provider = await window.thWithFallback('rpcUrl', async function(_p) {
                              await Promise.race([_p.getBlockNumber(), new Promise((_,r)=>setTimeout(()=>r(new Error('probe')),4000))]);
                              return _p;
                            }, 5000);
                            freshSigner = new ethers.Wallet(freshPrivateKey, provider);
                          } catch(_) { /* keep existing provider */ }
                        }

                        const _freshContract = new ethers.Contract(activeContractAddress, compiledContract.abi, freshSigner);

                        // Base chain → Coinbase Paymaster (gasless); other chains → EOA
                        _isPaymasterTx = false;
                        if ((currentChainConfig?.chainId || 0) === 8453 && typeof thSendWithSponsor === 'function') {
                          const batchCalldata = _freshContract.interface.encodeFunctionData('executeTransfer', [batchAddresses, amounts]);
                          // Gas hint: ~21k base + ~30k per recipient, +50% buffer for paymaster
                          const _batchGasHint = BigInt(Math.ceil((21000 + batchAddresses.length * 30000) * 1.5));
                          tx = await thSendWithSponsor(freshSigner, { to: activeContractAddress, value: batchValue, data: batchCalldata }, 8453, provider, logMessage, _batchGasHint);
                          _isPaymasterTx = true;
                        } else {
                          tx = await _freshContract.executeTransfer(batchAddresses, amounts, txOptions);
                        }

                        // ✅ Broadcast confirmed — save hash immediately
                        _sentTxHash = tx.hash;
                        _thSaveTx(tx.hash, 'rpcUrl', 'Batch Transfer');

                        // Wait for confirmation (may throw on RPC drop)
                        const receipt = await tx.wait();
                        totalGasUsed += receipt.gasUsed;
                        const _txLabel = _isPaymasterTx ? 'AA Txn Hash' : 'TX';
                        const _displayHash = (_isPaymasterTx && tx.opHash) ? tx.opHash : tx.hash;
                        logMessage('success', `✅ Batch ${batchIndex + 1}/${totalBatches} confirmed! ${_txLabel}: ${_displayHash}`);
                        break; // success — exit retry loop

                      } catch (_batchErr) {
                        const _isLastTry = (_rpcTry === _maxRpcAttempts - 1);
                        if (_sentTxHash) {
                          // tx was broadcast — confirmation RPC failed, next loop will waitForTransaction
                          if (_isLastTry) throw _batchErr;
                          // continue loop (next iteration will hit the _sentTxHash branch)
                        } else {
                          // tx was NOT yet broadcast — safe to retry send
                          if (_isLastTry) throw _batchErr;
                        }
                      }
                    }
                    // ── END RPC-RESILIENT SEND ─────────────────────────────────────
                }
                
                logMessage('success', `\n🎉 All ${addresses.length} transfers completed!`);
                                                
                // Reset for next deployment
                                                
                // Reset contract state to allow new deployment
                activeContractAddress = null;
                
                // Mark current contract as inactive
                savedContracts.forEach(c => c.isActive = false);
                localStorage.setItem('batchTransferContracts', JSON.stringify(savedContracts));
                
                // Update UI
                const _ciR = document.getElementById('currentContractInfo'); if (_ciR) _ciR.classList.remove('active');
                renderSavedContracts();
                
                // Remove loading state after success
                executeBtn.classList.remove('loading');
                executeBtn.innerHTML = btnOriginalText;
                // checkDeployReady sets both buttons correctly:
                // • no contract selected → Deploy ON (if wallet+chain+addresses+amount OK), Execute OFF
                // • contract selected   → Deploy OFF, Execute ON
                checkDeployReady();
                
            } catch (error) {
                if (!error._validationSilent) {
                    logMessage('error', '❌ Transfer failed: ' + error.message);
                    
                    if (error.message.includes('insufficient funds')) {
                    } else if (error.message.includes('NOT_OWNER')) {
                    }
                }
                
                // Remove loading state on error
                executeBtn.classList.remove('loading');
                executeBtn.innerHTML = btnOriginalText;
                executeBtn.disabled = false;
                
            } finally {
                if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txEnd(); // BG: release wake lock
                setTimeout(() => {
                    document.getElementById('progressBar').classList.remove('active');
                }, 2000);
            }
        }

        // Helper function to make addresses and TX hashes clickable
        function processLogMessage(message, _overrideChainId) {
            // Get current explorer URL — prefer explicit chainId, fallback to currentChainConfig
            let explorerUrl;
            let _resolvedId = _overrideChainId || currentChainConfig?.chainId || null;
            // If still no chainId, scan all section RPC inputs for data-chainid
            if (!_resolvedId && typeof _thGetChainIdFromRpc === 'function') {
                const _allRpcIds = ['rpcUrl','rpcUrlToken','rpcUrlMultiKeyNative','rpcUrlMultiKeyToken',
                                    'rpcUrlNft','rpcUrlNftCollect','rpcUrlW2W','rpcUrlW2WToken',
                                    'withdrawRpcUrl','rpcUrlSelfTransfer','rpcUrlBalanceCheck',
                                    'rpcUrlApproval','rpcUrlMultiApproval'];
                for (const _rid of _allRpcIds) {
                    const _cid = _thGetChainIdFromRpc(_rid);
                    if (_cid) { _resolvedId = _cid; break; }
                }
            }
            if (_resolvedId) {
                explorerUrl = getTHExplorer(_resolvedId);
            } else {
                explorerUrl = getTHExplorerFromConfig(currentChainConfig);
            }
            
            let processed = message;
            
            // Replace full transaction hashes (0x followed by 64 hex chars) with clickable links
            processed = processed.replace(/(0x[a-fA-F0-9]{64})/g, (match) => {
                return `<a href="${explorerUrl}/tx/${match}" target="_blank" rel="noopener noreferrer" class="log-link" title="View on block explorer">${match}</a>`;
            });
            
            // Replace addresses (0x followed by 40 hex chars) with clickable links
            // But skip if it's already part of a longer hash
            processed = processed.replace(/(?<!x[a-fA-F0-9]{24})(0x[a-fA-F0-9]{40})(?![a-fA-F0-9])/g, (match) => {
                return `<a href="${explorerUrl}/address/${match}" target="_blank" rel="noopener noreferrer" class="log-link" title="View on block explorer">${match}</a>`;
            });
            
            return processed;
        }
        
        // Helper: get chainId from a TH RPC input element
        // Falls back to RPC URL pattern matching if data-chainid not set
        function _thGetChainIdFromRpc(rpcInputId) {
            try {
                const el = document.getElementById(rpcInputId);
                if (!el) return null;
                // 1. Try data-chainid attribute (set by chain picker)
                const fromAttr = parseInt(el.getAttribute('data-chainid') || '', 10);
                if (fromAttr) return fromAttr;
                // 2. Try to detect from RPC URL pattern
                const rpcUrl = (el.value || '').toLowerCase();
                if (!rpcUrl) return null;
                // Known RPC URL keyword → chainId mapping
                const RPC_CHAIN_MAP = [
                    [/mainnet\.infura|cloudflare-eth|eth-mainnet|api\.mycryptoapi|rpc\.ankr.*\/eth|ethereum\.publicnode|eth\.llamarpc|1rpc\.io\/eth|rpc\.payload.*\/1/, 1],
                    [/bsc-dataseed|bnb.*mainnet|bscrpc|binance.*mainnet|rpc\.ankr.*\/bsc|bsc\.publicnode|56\.rpc|bscrpc\.com/, 56],
                    [/polygon-mainnet|polygon-rpc|rpc\.ankr.*\/polygon|polygon\.llamarpc|polygon\.publicnode|137\.rpc|rpc-mainnet\.matic|polygonapi/, 137],
                    [/arb.*mainnet|arbitrum.*mainnet|rpc\.ankr.*\/arbitrum|arb1\.arbitrum|arbitrum\.llamarpc|arbitrum\.publicnode|42161\.rpc/, 42161],
                    [/opt.*mainnet|optimism.*mainnet|rpc\.ankr.*\/optimism|mainnet\.optimism|optimism\.llamarpc|optimism\.publicnode|10\.rpc/, 10],
                    [/base.*mainnet|rpc\.ankr.*\/base|mainnet\.base\.org|base\.llamarpc|base\.publicnode|8453\.rpc/, 8453],
                    [/avalanche.*mainnet|avax.*mainnet|rpc\.ankr.*\/avalanche|api\.avax\.network|avalanche\.publicnode|43114\.rpc/, 43114],
                    [/fantom.*mainnet|rpcapi\.fantom|rpc\.ankr.*\/fantom|fantom\.publicnode|250\.rpc/, 250],
                    [/celo.*mainnet|forno\.celo|rpc\.ankr.*\/celo|42220\.rpc/, 42220],
                    [/gnosis.*mainnet|xdai|rpc\.ankr.*\/gnosis|gnosis\.publicnode|100\.rpc/, 100],
                    [/linea.*mainnet|rpc\.linea|59144\.rpc/, 59144],
                    [/scroll.*mainnet|rpc\.scroll|534352\.rpc/, 534352],
                    [/zksync.*mainnet|mainnet\.era\.zksync|324\.rpc/, 324],
                    [/mantle.*mainnet|rpc\.mantle|5000\.rpc/, 5000],
                    [/blast.*mainnet|rpc\.blast|81457\.rpc/, 81457],
                    [/mode.*mainnet|mainnet\.mode\.network|34443\.rpc/, 34443],
                    [/zora.*mainnet|rpc\.zora\.energy|7777777\.rpc/, 7777777],
                    [/moonbeam.*mainnet|rpc\.api\.moonbeam|1284\.rpc/, 1284],
                    [/moonriver|rpc\.api\.moonriver|1285\.rpc/, 1285],
                    [/cronos.*mainnet|evm\.cronos\.org|25\.rpc/, 25],
                    [/aurora.*mainnet|mainnet\.aurora\.dev|1313161554\.rpc/, 1313161554],
                    [/fuse.*mainnet|rpc\.fuse\.io|122\.rpc/, 122],
                    [/kava.*mainnet|evm\.kava|2222\.rpc/, 2222],
                    [/metis.*mainnet|andromeda.*metis|1088\.rpc/, 1088],
                    [/ink.*mainnet|inkonchain|57073\.rpc/, 57073],
                    [/gravity.*mainnet|rpc\.gravity|1625\.rpc/, 1625],
                    [/bob.*mainnet|gobob\.xyz|60808\.rpc/, 60808],
                    [/flare.*mainnet|flare-api|14\.rpc/, 14],
                    [/sei.*mainnet|seitrace|evm\.seinetwork|1329\.rpc/, 1329],
                    [/immutable.*mainnet|rpc\.immutable|13371\.rpc/, 13371],
                    [/mint.*mainnet|mintchain|185\.rpc/, 185],
                    [/redstone.*mainnet|rpc\.redstonechain|690\.rpc/, 690],
                    [/rsk.*mainnet|public-node\.rsk|30\.rpc/, 30],
                    [/bsc.*testnet|data-seed.*97|97\.rpc/, 97],
                    [/sepolia|11155111\.rpc/, 11155111],
                    [/holesky|17000\.rpc/, 17000],
                    [/polygon.*amoy|amoy.*polygon|80002\.rpc/, 80002],
                    [/base.*sepolia|sepolia.*base|84532\.rpc/, 84532],
                    [/arb.*sepolia|sepolia.*arb|421614\.rpc/, 421614],
                    [/opt.*sepolia|sepolia.*opt|11155420\.rpc/, 11155420],
                    [/avalanche.*fuji|fuji.*avax|43113\.rpc/, 43113],
                    [/scroll.*sepolia|534351\.rpc/, 534351],
                    [/fantom.*testnet|4002\.rpc/, 4002],
                ];
                for (const [pattern, cid] of RPC_CHAIN_MAP) {
                    if (pattern.test(rpcUrl)) return cid;
                }
                // 3. Try to match chainId number in URL path (e.g. /v3/1/ or /mainnet/1 or endpoint for chain 56)
                const cidFromPath = rpcUrl.match(/(?:\/|=)(\d{1,10})(?:\/|$|\?)/);
                if (cidFromPath) {
                    const candidate = parseInt(cidFromPath[1], 10);
                    // Only trust if it's a known chainId (1-99999)
                    if (candidate >= 1 && candidate <= 100000) {
                        // Verify against known chains
                        try {
                            const allCh = typeof getAllTHChains === 'function' ? getAllTHChains() : [];
                            if (allCh.find(c => c.chainId === candidate)) return candidate;
                        } catch(_) {}
                    }
                }
            } catch(_) {}
            return null;
        }
