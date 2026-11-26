        document.getElementById('privateKeyToken')?.addEventListener('input', async function() {
            // Clear previous timeout
            if (walletUpdateTimeoutToken) {
                clearTimeout(walletUpdateTimeoutToken);
            }
            
            // Clear cached wallet objects
            window.cachedWallet = null;
            signer = null;
            
            // If user is typing manually (not picker), sync actualKeysStorage with current value
            const _typedVal = this.value.trim();
            if (window.actualKeysStorage && _typedVal) {
                window.actualKeysStorage['privateKeyToken'] = _typedVal;
            } else if (window.actualKeysStorage && !_typedVal) {
                window.actualKeysStorage['privateKeyToken'] = '';
            }
            // Read from actualKeysStorage (wallet picker stores real key there, manual typing also synced above)
            const privateKey = (window.actualKeysStorage && window.actualKeysStorage['privateKeyToken'])
                ? window.actualKeysStorage['privateKeyToken'].trim()
                : _typedVal;
            
            if (!privateKey) {
                document.getElementById('walletAddressToken').textContent = '-';
                document.getElementById('walletNativeBalanceToken').textContent = '-';
                document.getElementById('walletTokenBalanceToken').textContent = '-';
                safeHideElement('walletInfoBoxToken');
                return;
            }
            
            // Set timeout to avoid too many updates while typing
            walletUpdateTimeoutToken = setTimeout(async () => {
                try {
                    // RE-READ fresh value inside timeout to ensure latest key
                    // Read from actualKeysStorage first (wallet picker stores real key there)
                    const _rawTokenKey = (window.actualKeysStorage && window.actualKeysStorage['privateKeyToken'])
                        ? window.actualKeysStorage['privateKeyToken'].trim()
                        : document.getElementById('privateKeyToken').value.trim();
                    
                    // Normalize key: add 0x prefix if missing
                    let freshPrivateKey = _rawTokenKey;
                    if (freshPrivateKey && !freshPrivateKey.startsWith('0x') && freshPrivateKey.length === 64) {
                        freshPrivateKey = '0x' + freshPrivateKey;
                    }
                    
                    
                    // Validate private key format
                    if (!freshPrivateKey.startsWith('0x') || freshPrivateKey.length !== 66) {
                        document.getElementById('walletAddressToken').textContent = 'Invalid key';
                        document.getElementById('walletNativeBalanceToken').textContent = '-';
                        document.getElementById('walletTokenBalanceToken').textContent = '-';
                        return;
                    }
                    
                    // Create NEW wallet with FRESH key
                    const wallet = new ethers.Wallet(freshPrivateKey);
                    const address = wallet.address;
                    
                    
                    // Display address
                    const explorerUrl = getTHExplorerFromConfig(currentTokenChainConfig);
                    const shortAddr = address.substring(0, 10) + '...' + address.substring(address.length - 8);
                    document.getElementById('walletAddressToken').innerHTML = `<a href="${explorerUrl}/address/${address}" target="_blank" rel="noopener noreferrer" class="log-link">${shortAddr}</a>`;
                    safeShowElement('walletInfoBoxToken');
                    
                    // Get token balance if token and RPC are configured
                    const tokenAddress = document.getElementById('tokenContractAddress').value.trim();
                    const rpcUrl = document.getElementById('rpcUrlToken').value.trim();
                    const _thRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('rpcUrlToken') : (rpcUrl ? [rpcUrl] : []);
                    const _thChainId = parseInt((document.getElementById('rpcUrlToken')||{}).getAttribute?.('data-chainid')||'',10)||null;
                    const tokenSymbol = document.getElementById('tokenSymbol').value || 'TOKEN';
                    const tokenDecimals = parseInt(document.getElementById('tokenDecimals').value) || 18;
                    
                    if (tokenAddress && ethers.isAddress(tokenAddress) && rpcUrl) {
                        document.getElementById('walletTokenBalanceToken').textContent = 'Loading...';
                        
                        // FIX: use thWithFallback for automatic multi-RPC failover
                        let provider;
                        try {
                          provider = await window.thWithFallback('rpcUrlToken', async function(_p) {
                            await Promise.race([_p.getBlockNumber(), new Promise((_,r)=>setTimeout(()=>r(new Error('probe timeout')),5000))]);
                            return _p;
                          }, 5000);
                        } catch(_thErr) {
                          const _fbCid = parseInt((document.getElementById('rpcUrlToken')||{}).getAttribute?.('data-chainid')||'',10)||null;
                          provider = window._thMakeProvider(rpcUrl, _fbCid);
                        }
                        
                        const balance = await tokenContract.balanceOf(address);
                        const balanceFormatted = ethers.formatUnits(balance, tokenDecimals);
                        
                        document.getElementById('walletTokenBalanceToken').innerHTML = `<span style="color: ${balance > 0n ? '#43e97b' : '#f5576c'}">${balanceFormatted} ${tokenSymbol}</span>`;
                    } else {
                        document.getElementById('walletNativeBalanceToken').textContent = '-';
                        document.getElementById('walletTokenBalanceToken').textContent = '-';
                    }
                    
                } catch (error) {
                    document.getElementById('walletAddressToken').textContent = 'Invalid key';
                    document.getElementById('walletNativeBalanceToken').textContent = '-';
                    document.getElementById('walletTokenBalanceToken').textContent = '-';
                }
            }, 0); // Instant wallet loading
        });

        let deployedContractAddressToken = null;
        let savedContractsToken = [];
        let activeContractAddressToken = null;
        
        let isDeployingToken = false; // Global flag to prevent double deployment
        
        async function deployContractToken() {
            // Prevent double-click deployment
            if (isDeployingToken) {
                return;
            }
            
            // Get actual key from storage (not masked value)
            let privateKey = '';
            if (window.actualKeysStorage && window.actualKeysStorage['privateKeyToken']) {
                privateKey = window.actualKeysStorage['privateKeyToken'].trim();
            } else {
                privateKey = document.getElementById('privateKeyToken').value.trim();
            }
            
            // Sanitize the private key
            if (privateKey) {
                privateKey = sanitisePrivateKey(privateKey);
                // Ensure it has 0x prefix for ethers.js
                if (!privateKey.startsWith('0x')) {
                    privateKey = '0x' + privateKey;
                }
            }
            
            const rpcUrl = document.getElementById('rpcUrlToken').value.trim();
            const _thRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('rpcUrlToken') : (rpcUrl ? [rpcUrl] : []);
            const _thChainId = parseInt((document.getElementById('rpcUrlToken')||{}).getAttribute?.('data-chainid')||'',10)||null;
            
            // Validation
            if (!privateKey || privateKey.length !== 66) {
                logMessageToken('error', '❌ Invalid private key (must be 64 hex characters)');
                return;
            }
            
            if (!rpcUrl) {
                logMessageToken('error', '❌ RPC URL required');
                return;
            }
            
            // Set deploying flag
            isDeployingToken = true;
            
                        
            const deployBtn = document.getElementById('deployBtnToken');
            const btnOriginalText = deployBtn.innerHTML;
            
            try {
                // Add loading state
                deployBtn.classList.add('loading');
                deployBtn.disabled = true;
                deployBtn.innerHTML = '⏳ Deploying...';
                
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
                const wallet = new ethers.Wallet(privateKey, provider);
                
                // SYNC: Verify currentTokenChainConfig matches actual connected network
                try {
                    const network = await provider.getNetwork();
                    const actualChainId = Number(network.chainId);
                    if (actualChainId && currentTokenChainConfig && actualChainId !== currentTokenChainConfig.chainId) {
                        const matchedChain = getAllTHChains().find(c => c.chainId === actualChainId);
                        currentTokenChainConfig.chainId = actualChainId;
                        if (matchedChain) {
                            currentTokenChainConfig.name = matchedChain.name;
                            currentTokenChainConfig.symbol = matchedChain.symbol;
                            currentTokenChainConfig.explorer = matchedChain.explorer || currentTokenChainConfig.explorer;
                        }
                                            }
                } catch (_syncErrT) { /* continue with existing config */ }
                
                                
                // ========================================
                // CONTRACT 2: BATCH TOKEN TRANSFER
                // ========================================
                // Purpose: Batch ERC20 token distribution with single transaction
                // Used in: Batch Transfer Token (ERC20) UI
                // Compiled bytecode from Contract2_BatchTokenTransfer.sol
                // Using global TOKEN_TRANSFER_CONTRACT_BYTECODE
                
                const factory = new ethers.ContractFactory(
                    [
                        "constructor()",
                        "function owner() view returns (address)",
                        "function executeTransfer(address tokenAddress, address[] calldata recipients, uint256[] calldata amounts) external",
                        "function withdrawToken(address tokenAddress, address to) external",
                        "function withdrawNative(address payable to) external"
                    ],
                    TOKEN_TRANSFER_CONTRACT_BYTECODE,
                    wallet
                );
                
                // ── OneGas AI gas (AUTO / EIP-1559 / LEGACY) ──
                // Get fee data for gas estimation
                const _tokenDeployGas = await window._thGas(provider);
                
                const contract = await factory.deploy(_tokenDeployGas);

                const deployTxToken = contract.deploymentTransaction();
                if (deployTxToken && deployTxToken.hash) {
                }
                
                                    await contract.waitForDeployment();
                
                const contractAddress = await contract.getAddress();
                deployedContractAddressToken = contractAddress;
                
                logMessageToken('success', `✅ Contract deployed at: ${contractAddress}`);
                                                        
                // Verify executeTransfer function exists onchain
                const functionExists = await verifyTokenContractFunction(contractAddress, provider);
                
                if (!functionExists) {
                    logMessageToken('error', '❌ executeTransfer function পাওয়া যায়নি - contract ব্যবহার করা যাবে না');
                    // Disable execute button
                    document.getElementById('executeBtnToken').disabled = true;
                    deployBtn.classList.remove('loading');
                    deployBtn.innerHTML = btnOriginalText;
                    deployBtn.disabled = false;
                    isDeployingToken = false;
                    return;
                }
                
                logMessageToken('success', '✅ Contract functions verified!');
                
                // Save contract to localStorage — get actual chainId from provider
                let chainName, chainId, chainSymbol;
                try {
                    const _netT = await provider.getNetwork();
                    const _actualIdT = Number(_netT.chainId);
                    const _mcT = getAllTHChains().find(c => c.chainId === _actualIdT);
                    chainName   = _mcT ? _mcT.name   : (currentTokenChainConfig?.name   || 'Unknown Chain');
                    chainId     = _actualIdT;
                    chainSymbol = _mcT ? _mcT.symbol : (currentTokenChainConfig?.symbol || 'ETH');
                } catch(_seT) {
                    chainName   = currentTokenChainConfig?.name   || 'Unknown Chain';
                    chainId     = currentTokenChainConfig?.chainId || 0;
                    chainSymbol = currentTokenChainConfig?.symbol || 'ETH';
                }
                saveContractToken(deployedContractAddressToken, chainName, chainId, chainSymbol, wallet ? wallet.address : '');
                
                // Load the newly deployed contract
                loadContractToken(deployedContractAddressToken, true);
                
                // Enable execute button
                document.getElementById('executeBtnToken').disabled = false;
                
                // Remove loading state
                deployBtn.classList.remove('loading');
                deployBtn.innerHTML = btnOriginalText;
                
                // Reset deployment flag
                isDeployingToken = false;
                
            } catch (error) {
                // Check if error is due to insufficient funds
                if (error.message.includes('insufficient funds') || 
                    error.message.includes('insufficient balance') ||
                    error.message.includes('sender doesn\'t have enough funds')) {
                    logMessageToken('error', '❌ Fee নেই - চেইনে contract deploy করার জন্য যথেষ্ট fee নেই');
                } else {
                    // For other errors, show minimal info
                    logMessageToken('error', '❌ Deployment failed');
                }
            } finally {
                // Always restore button state and reset flag
                isDeployingToken = false;
                deployBtn.classList.remove('loading');
                deployBtn.innerHTML = btnOriginalText;
                // Re-evaluate button state: if contract is now selected, deploy stays OFF
                setTimeout(function() { if (typeof validateTokenInputs === 'function') validateTokenInputs(); }, 100);
            }
        }