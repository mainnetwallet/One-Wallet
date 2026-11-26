

        function selectContractForWithdraw(address, type, chainName, symbol, rpcUrl = '') {
            // Hide no contract message, show contract info
            safeHideElement('noContractSelected');
            safeShowElement('selectedContractInfoBox');
            safeShowElement('withdrawInputs');
            
            // Update contract info
            document.getElementById('selectedContract').textContent = address;
            document.getElementById('selectedContractType').textContent = type.toUpperCase();
            // Make chain name clickable → opens chain explorer
            const _wdChainEl = document.getElementById('selectedContractChain');
            _wdChainEl.textContent = chainName;
            const _wdChainId = (typeof _thGetChainIdFromRpc === 'function'
                ? _thGetChainIdFromRpc('withdrawRpcUrl')
                : parseInt((document.getElementById('withdrawRpcUrl')||{}).getAttribute?.('data-chainid')||'',10)) || null;
            const _wdExplorer = window.getTHExplorer ? window.getTHExplorer(_wdChainId) : 'https://etherscan.io';
            _wdChainEl.style.cursor = 'pointer';
            _wdChainEl.title = 'View chain explorer';
            _wdChainEl.onclick = () => window.open(_wdExplorer, '_blank', 'noopener');
            // Make contract address clickable → opens address on explorer
            const _wdAddrEl = document.getElementById('selectedContract');
            if (address && address !== '-') {
                _wdAddrEl.style.cursor = 'pointer';
                _wdAddrEl.title = 'View contract on explorer';
                _wdAddrEl.onclick = () => window.open(_wdExplorer + '/address/' + address, '_blank', 'noopener');
            }
            
            // If RPC URL is provided, update the RPC URL field
            if (rpcUrl) {
                document.getElementById('withdrawRpcUrl').value = rpcUrl;
            }
            
            // Show/hide token address field based on type
            if (type.toLowerCase() === 'token') {
                safeShowElement('tokenAddressGroup');
            } else {
                safeHideElement('tokenAddressGroup');
            }
            
            // Set current selected contract for ownership verification
            currentSelectedContract = {
                address: address,
                type: type,
                chainName: chainName,
                symbol: symbol || 'ETH',
                rpcUrl: rpcUrl || document.getElementById('withdrawRpcUrl').value.trim()
            };
            
            window.selectedWithdrawContract = currentSelectedContract;
            
            // Reset ownership verification status
            safeHideElement('ownershipStatus');
            document.getElementById('withdrawDeveloperKey').value = '';
            isOwnerVerified = false;
            checkWithdrawExecuteReady();
            
                        
            // Get and display native balance
            const currentRpcUrl = rpcUrl || document.getElementById('withdrawRpcUrl').value.trim();
            if (currentRpcUrl) {
                const _scwChainId = parseInt((document.getElementById('withdrawRpcUrl')||{}).getAttribute?.('data-chainid')||'',10)||null;
                const _scwRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('withdrawRpcUrl') : [];
                if (currentRpcUrl && !_scwRpcs.includes(currentRpcUrl)) _scwRpcs.unshift(currentRpcUrl);
                (async () => {
                    // FIX: iterate _scwRpcs list with fallback instead of single URL
                    let _scwProvider;
                    for (const _rpc of (_scwRpcs.length ? _scwRpcs : [currentRpcUrl])) {
                      try {
                        const _p = window._thMakeProvider(_rpc, _scwChainId);
                        await Promise.race([_p.getBlockNumber(), new Promise((_,r)=>setTimeout(()=>r(new Error('timeout')),5000))]);
                        _scwProvider = _p; break;
                      } catch(_e) { continue; }
                    }
                    if (!_scwProvider) _scwProvider = window._thMakeProvider(currentRpcUrl, _scwChainId);
                    return _scwProvider;
                })().then(provider => provider.getBalance(address)).then(balance => {
                    const balanceEth = ethers.formatEther(balance);
                    const formattedBalance = parseFloat(balanceEth).toFixed(6);
                    document.getElementById('selectedContractBalance').textContent = `${formattedBalance} ${symbol || 'ETH'}`;
                    
                    if (parseFloat(balanceEth) > 0) {
                        safeSetStyle('selectedContractBalance', 'color', '#10b981');
                    } else {
                        safeSetStyle('selectedContractBalance', 'color', '#888');
                    }
                }).catch(err => {
                    document.getElementById('selectedContractBalance').textContent = 'Error';
                    safeSetStyle('selectedContractBalance', 'color', '#ef4444');
                });
                
                // Reset token balance display
                document.getElementById('selectedContractTokenBalance').textContent = '-';
                safeSetStyle('selectedContractTokenBalance', 'color', '#f59e0b');
            }
        }
        
        // Auto-check token balance when token address is entered
        async function checkTokenBalanceAuto() {
            const tokenAddress = document.getElementById('withdrawTokenAddress').value.trim();
            const contractAddress = window.selectedWithdrawContract?.address;
            const rpcUrl = document.getElementById('withdrawRpcUrl').value.trim();
            const _thRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('withdrawRpcUrl') : (rpcUrl ? [rpcUrl] : []);
            const _thChainId = parseInt((document.getElementById('withdrawRpcUrl')||{}).getAttribute?.('data-chainid')||'',10)||null;
            
            if (!tokenAddress || !ethers.isAddress(tokenAddress) || !contractAddress || !rpcUrl) {
                document.getElementById('selectedContractTokenBalance').textContent = '-';
                return;
            }
            
            try {
                // FIX: use thWithFallback for automatic multi-RPC failover
                let provider;
                try {
                  provider = await window.thWithFallback('withdrawRpcUrl', async function(_p) {
                    await Promise.race([_p.getBlockNumber(), new Promise((_,r)=>setTimeout(()=>r(new Error('probe timeout')),5000))]);
                    return _p;
                  }, 5000);
                } catch(_thErr) {
                  // All RPCs in list failed — fall back to single URL so caller can surface error naturally
                  const _fbCid = parseInt((document.getElementById('withdrawRpcUrl')||{}).getAttribute?.('data-chainid')||'',10)||null;
                  provider = window._thMakeProvider(rpcUrl, _fbCid);
                }
                
                const ERC20_ABI = [
                    "function balanceOf(address) view returns (uint256)",
                    "function symbol() view returns (string)",
                    "function decimals() view returns (uint8)"
                ];
                
                const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
                
                                
                const [balance, symbol, decimals] = await Promise.all([
                    tokenContract.balanceOf(contractAddress),
                    tokenContract.symbol(),
                    tokenContract.decimals()
                ]);
                
                const balanceFormatted = ethers.formatUnits(balance, decimals);
                const displayBalance = `${parseFloat(balanceFormatted).toFixed(6)} ${symbol}`;
                
                document.getElementById('selectedContractTokenBalance').textContent = displayBalance;
                
                if (parseFloat(balanceFormatted) > 0) {
                    safeSetStyle('selectedContractTokenBalance', 'color', '#f59e0b');
                } else {
                    safeSetStyle('selectedContractTokenBalance', 'color', '#888');
                }
                
            } catch (error) {
                document.getElementById('selectedContractTokenBalance').textContent = 'Error';
                safeSetStyle('selectedContractTokenBalance', 'color', '#ef4444');
                logMessageWithdraw('error', `❌ Failed to check token: ${error.message}`);
            }
        }

        async function checkTokenBalance(contractAddress) {
            const tokenAddress = prompt('Enter ERC20 Token Address to check:');
            if (!tokenAddress || !ethers.isAddress(tokenAddress)) {
                logMessageWithdraw('error', '❌ Invalid token address');
                return;
            }
            
            try {
                const rpcUrl = document.getElementById('withdrawRpcUrl').value.trim();
                const _thRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('withdrawRpcUrl') : (rpcUrl ? [rpcUrl] : []);
                const _thChainId = parseInt((document.getElementById('withdrawRpcUrl')||{}).getAttribute?.('data-chainid')||'',10)||null;
                // FIX: use thWithFallback for automatic multi-RPC failover
                let provider;
                try {
                  provider = await window.thWithFallback('withdrawRpcUrl', async function(_p) {
                    await Promise.race([_p.getBlockNumber(), new Promise((_,r)=>setTimeout(()=>r(new Error('probe timeout')),5000))]);
                    return _p;
                  }, 5000);
                } catch(_thErr) {
                  // All RPCs in list failed — fall back to single URL so caller can surface error naturally
                  const _fbCid = parseInt((document.getElementById('withdrawRpcUrl')||{}).getAttribute?.('data-chainid')||'',10)||null;
                  provider = window._thMakeProvider(rpcUrl, _fbCid);
                }
                
                const ERC20_ABI = [
                    "function balanceOf(address) view returns (uint256)",
                    "function symbol() view returns (string)",
                    "function decimals() view returns (uint8)"
                ];
                
                const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
                
                                
                const [balance, symbol, decimals] = await Promise.all([
                    tokenContract.balanceOf(contractAddress),
                    tokenContract.symbol(),
                    tokenContract.decimals()
                ]);
                
                const balanceFormatted = ethers.formatUnits(balance, decimals);
                
                
                alert(`Token Balance:\n\n${balanceFormatted} ${symbol}\n\nToken: ${tokenAddress}\nContract: ${contractAddress}`);
                
            } catch (error) {
                logMessageWithdraw('error', `❌ Failed to check token: ${error.message}`);
            }
        }