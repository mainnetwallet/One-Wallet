

        // Toggle All helper for Token saved contracts
        function toggleAllSavedContractsToken() {
            const currentTokenChainId = currentTokenChainConfig?.chainId || null;
            const visibleContracts = currentTokenChainId
                ? savedContractsToken.filter(c => c.chainId === currentTokenChainId)
                : savedContractsToken;
            const anyActive = visibleContracts.some(c => c.isActive);
            if (anyActive) {
                // Deselect all
                savedContractsToken.forEach(c => c.isActive = false);
                localStorage.setItem('batchTransferContractsToken', JSON.stringify(savedContractsToken));
                renderSavedContractsToken();
            } else {
                // Select first (or mark all if multi)
                if (visibleContracts.length === 1) {
                    loadContractToken(visibleContracts[0].address);
                } else if (visibleContracts.length > 1) {
                    savedContractsToken.forEach(c => {
                        if (visibleContracts.find(v => v.address === c.address)) c.isActive = true;
                    });
                    localStorage.setItem('batchTransferContractsToken', JSON.stringify(savedContractsToken));
                    renderSavedContractsToken();
                }
            }
        }
        
        // Initialize Token contracts on page load
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', loadSavedContractsToken);
        } else {
            loadSavedContractsToken();
        }

        // Initialize Multi-Key Native contracts on page load
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', loadSavedContractsMultiKeyNative);
        } else {
            loadSavedContractsMultiKeyNative();
        }

        function clearLogToken() {
            document.getElementById('logContainerToken').innerHTML = '';
                    }

        // Auto-detect wallet info for Token section
        async function updateTokenWalletBalance() {
            const privateKeyInput = document.getElementById('privateKeyToken');
            const rpcUrlInput = document.getElementById('rpcUrlToken');
            const tokenAddressInput = document.getElementById('tokenContractAddress');
            const walletAddressElement = document.getElementById('walletAddressToken');
            const walletNativeBalanceElement = document.getElementById('walletNativeBalanceToken');
            const walletTokenBalanceElement = document.getElementById('walletTokenBalanceToken');
            
            // Get actual key from storage (not masked value)
            let privateKey = '';
            if (window.actualKeysStorage && window.actualKeysStorage['privateKeyToken']) {
                privateKey = window.actualKeysStorage['privateKeyToken'].trim();
            } else {
                privateKey = privateKeyInput?.value.trim();
            }
            
            const rpcUrl = rpcUrlInput?.value.trim();
            const tokenAddress = tokenAddressInput?.value.trim();
            
            
            if (!privateKey) {
                if (walletAddressElement) walletAddressElement.textContent = '-';
                if (walletNativeBalanceElement) walletNativeBalanceElement.textContent = '-';
                if (walletTokenBalanceElement) walletTokenBalanceElement.textContent = '-';
                return;
            }
            
            try {
                // Sanitize the private key (add 0x if missing, remove extra chars)
                const sanitizedKey = sanitisePrivateKey(privateKey);
                const wallet = new ethers.Wallet(sanitizedKey);
                const shortAddress = wallet.address.substring(0, 10) + '...' + wallet.address.substring(wallet.address.length - 8);
                if (walletAddressElement) {
                    walletAddressElement.textContent = shortAddress;
                }
                
                if (rpcUrl) {
                    try {
                        const _utwbChainId = parseInt((document.getElementById('rpcUrlToken')||{}).getAttribute?.('data-chainid')||'',10)||null;
                        const _utwbRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('rpcUrlToken') : [];
                        if (rpcUrl && !_utwbRpcs.includes(rpcUrl)) _utwbRpcs.unshift(rpcUrl);
                        // FIX: iterate full RPC list with fallback instead of single URL
                        let provider;
                        for (const _rpc of (_utwbRpcs.length ? _utwbRpcs : [rpcUrl])) {
                          try {
                            const _p = window._thMakeProvider(_rpc, _utwbChainId);
                            await Promise.race([_p.getBlockNumber(), new Promise((_,r)=>setTimeout(()=>r(new Error('timeout')),5000))]);
                            provider = _p; break;
                          } catch(_e) { continue; }
                        }
                        if (!provider) provider = window._thMakeProvider(rpcUrl, _utwbChainId);
                        
                        // Fetch native balance
                        if (walletNativeBalanceElement) {
                            walletNativeBalanceElement.textContent = 'Loading...';
                        }
                        const nativeBalance = await window.thRead('rpcUrlToken', provider, function(_p) { return _p.getBalance(wallet.address); }, 6000);
                        const nativeBalanceInEth = ethers.formatEther(nativeBalance);
                        if (walletNativeBalanceElement) {
                            walletNativeBalanceElement.textContent = parseFloat(nativeBalanceInEth).toFixed(6);
                        }
                        
                        // Fetch token balance if token address is provided
                        if (tokenAddress && ethers.isAddress(tokenAddress)) {
                            if (walletTokenBalanceElement) {
                                walletTokenBalanceElement.textContent = 'Loading...';
                            }
                            
                            const ERC20_ABI = [
                                "function balanceOf(address) view returns (uint256)",
                                "function decimals() view returns (uint8)",
                                "function symbol() view returns (string)"
                            ];
                            
                            const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
                            const [tokenBalance, decimals, symbol] = await Promise.all([
                                tokenContract.balanceOf(wallet.address),
                                tokenContract.decimals(),
                                tokenContract.symbol()
                            ]);
                            
                            const tokenBalanceFormatted = ethers.formatUnits(tokenBalance, decimals);
                            if (walletTokenBalanceElement) {
                                walletTokenBalanceElement.textContent = `${parseFloat(tokenBalanceFormatted).toFixed(6)} ${symbol}`;
                            }
                        } else {
                            if (walletTokenBalanceElement) {
                                walletTokenBalanceElement.textContent = 'No token';
                            }
                        }
                    } catch (error) {
                        if (walletNativeBalanceElement) walletNativeBalanceElement.textContent = 'RPC Error';
                        if (walletTokenBalanceElement) walletTokenBalanceElement.textContent = 'RPC Error';
                    }
                } else {
                    if (walletNativeBalanceElement) walletNativeBalanceElement.textContent = 'No RPC';
                    if (walletTokenBalanceElement) walletTokenBalanceElement.textContent = 'No RPC';
                }
            } catch (error) {
                if (walletAddressElement) walletAddressElement.textContent = 'Invalid Key';
                if (walletNativeBalanceElement) walletNativeBalanceElement.textContent = '-';
                if (walletTokenBalanceElement) walletTokenBalanceElement.textContent = '-';
            }
        }
        
        function setupTokenWalletDetection() {
            const privateKeyInput = document.getElementById('privateKeyToken');
            const rpcUrlInput = document.getElementById('rpcUrlToken');
            const tokenAddressInput = document.getElementById('tokenContractAddress');
            const walletAddressElement = document.getElementById('walletAddressToken');
            const walletNativeBalanceElement = document.getElementById('walletNativeBalanceToken');
            const walletTokenBalanceElement = document.getElementById('walletTokenBalanceToken');
            
            // Token wallet detection initialization
            
            if (!privateKeyInput || !rpcUrlInput || !walletAddressElement || !walletNativeBalanceElement || !walletTokenBalanceElement) {
                return;
            }
            
            // Token wallet detection ready
            
            // Private key input event
            privateKeyInput.addEventListener('input', updateTokenWalletBalance);
            
            // Update balance when RPC changes
            rpcUrlInput.addEventListener('change', updateTokenWalletBalance);
            
            // Also trigger on RPC input (not just change) with debounce
            rpcUrlInput.addEventListener('input', function() {
                if (privateKeyInput.value.trim() && this.value.trim()) {
                    clearTimeout(window.tokenRpcTimeout);
                    window.tokenRpcTimeout = setTimeout(updateTokenWalletBalance, 500);
                }
            });
            
            // Token address input event with debounce
            if (tokenAddressInput) {
                tokenAddressInput.addEventListener('input', function() {
                    if (this.value.trim() && ethers.isAddress(this.value.trim())) {
                        clearTimeout(window.tokenAddressTimeout);
                        window.tokenAddressTimeout = setTimeout(updateTokenWalletBalance, 500);
                    }
                });
            }
        }
        
        // Initialize wallet detection when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupTokenWalletDetection);
        } else {
            setupTokenWalletDetection();
        }

