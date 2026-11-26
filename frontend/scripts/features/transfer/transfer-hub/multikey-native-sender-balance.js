        // ========================================
        // AUTO BALANCE UPDATE FOR SENDER KEYS
        // ========================================
        
        let senderKeysBalanceUpdateTimeout = null;
        
        async function updateSenderKeysBalanceMultiKeyNative() {
            // Get inputs
            const privateKeysText = document.getElementById('senderPrivateKeysMultiKeyNative').value.trim();
            const rpcUrl = document.getElementById('rpcUrlMultiKeyNative').value.trim();
            const _thRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('rpcUrlMultiKeyNative') : (rpcUrl ? [rpcUrl] : []);
            const _thChainId = parseInt((document.getElementById('rpcUrlMultiKeyNative')||{}).getAttribute?.('data-chainid')||'',10)||null;
            
            // Get the stats display elements
            const totalSendersElement = document.getElementById('totalSendersMultiKeyNative');
            const perAddressDisplayElement = document.getElementById('perAddressDisplayMultiKeyNative');
            const totalAmountElement = document.getElementById('totalAmountMultiKeyNative');
            
            // If no keys or no RPC, reset
            if (!privateKeysText || !rpcUrl) {
                if (totalSendersElement) totalSendersElement.textContent = '0';
                if (perAddressDisplayElement) perAddressDisplayElement.textContent = '0';
                if (totalAmountElement) totalAmountElement.textContent = '0';
                return;
            }
            
            try {
                // Parse sender private keys — any format supported
                const { keys: privateKeys } = parsePrivateKeys(privateKeysText);
                
                if (privateKeys.length === 0) {
                    if (totalSendersElement) totalSendersElement.textContent = '0';
                    if (perAddressDisplayElement) perAddressDisplayElement.textContent = '0';
                    if (totalAmountElement) totalAmountElement.textContent = '0';
                    return;
                }
                
                // Update sender count
                if (totalSendersElement) totalSendersElement.textContent = privateKeys.length;
                
                // Get amount per wallet
                const amountPerWallet = document.getElementById('amountPerAddressMultiKeyNative').value.trim();
                const amount = parseFloat(amountPerWallet) || 0;
                
                // Update per address display
                if (perAddressDisplayElement) {
                    perAddressDisplayElement.textContent = amount.toFixed(6);
                }
                
                // Calculate total amount
                const totalAmount = amount * privateKeys.length;
                if (totalAmountElement) {
                    totalAmountElement.textContent = totalAmount.toFixed(6);
                }
                
                // Now fetch balances for each wallet
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
                let totalBalance = 0;
                
                for (let i = 0; i < privateKeys.length; i++) {
                    try {
                        const wallet = new ethers.Wallet(privateKeys[i], provider);
                        const balance = await window.thRead('rpcUrlMultiKeyNative', provider, function(_p) { return _p.getBalance(wallet.address); }, 6000);
                        const balanceEth = parseFloat(ethers.formatEther(balance));
                        totalBalance += balanceEth;
                    } catch (error) {
                    }
                }
                
                // Log the total balance to console for debugging
                
            } catch (error) {
            }
        }
        
        // Setup event listeners for sender keys balance updates
        function setupSenderKeysBalanceDetection() {
            const senderKeysInput = document.getElementById('senderPrivateKeysMultiKeyNative');
            const rpcUrlInput = document.getElementById('rpcUrlMultiKeyNative');
            const amountInput = document.getElementById('amountPerAddressMultiKeyNative');
            
            if (senderKeysInput) {
                // Keys কখনো localStorage/sessionStorage এ persist হয় না — শুধু box এর মধ্যে থাকে
                senderKeysInput.addEventListener('input', function() {
                    // Update button states immediately
                    if (typeof updateButtonStates === 'function') {
                        updateButtonStates();
                    }
                    
                    // Debounce the balance update
                    clearTimeout(senderKeysBalanceUpdateTimeout);
                    senderKeysBalanceUpdateTimeout = setTimeout(updateSenderKeysBalanceMultiKeyNative, 800);
                });
            }
            
            if (rpcUrlInput) {
                rpcUrlInput.addEventListener('change', function() {
                    if (typeof updateButtonStates === 'function') {
                        updateButtonStates();
                    }
                    updateSenderKeysBalanceMultiKeyNative();
                });
                
                rpcUrlInput.addEventListener('input', function() {
                    if (typeof updateButtonStates === 'function') {
                        updateButtonStates();
                    }
                    
                    clearTimeout(senderKeysBalanceUpdateTimeout);
                    senderKeysBalanceUpdateTimeout = setTimeout(updateSenderKeysBalanceMultiKeyNative, 800);
                });
            }
            
            if (amountInput) {
                amountInput.addEventListener('input', function() {
                    const perAddressDisplayElement = document.getElementById('perAddressDisplayMultiKeyNative');
                    const totalAmountElement = document.getElementById('totalAmountMultiKeyNative');
                    
                    const privateKeysText = document.getElementById('senderPrivateKeysMultiKeyNative').value.trim();
                    const { keys: privateKeys } = parsePrivateKeys(privateKeysText);
                    
                    const amount = parseFloat(this.value) || 0;
                    
                    if (perAddressDisplayElement) perAddressDisplayElement.textContent = amount.toFixed(6);
                    if (totalAmountElement) totalAmountElement.textContent = (amount * privateKeys.length).toFixed(6);
                    
                    // Update button states whenever amount changes
                    if (typeof updateButtonStates === 'function') updateButtonStates();
                });
            }
        }
        
        // Initialize balance detection when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupSenderKeysBalanceDetection);
        } else {
            setupSenderKeysBalanceDetection();
        }

