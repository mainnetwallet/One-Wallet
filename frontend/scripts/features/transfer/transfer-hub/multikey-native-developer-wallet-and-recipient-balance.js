
        // ========================================
        // MULTI KEY NATIVE - DEVELOPER WALLET ADDRESS DISPLAY
        // ========================================
        
        // Update developer wallet address and balance for Multi Key Native
        async function updateDeveloperWalletMultiKeyNative() {
            const developerKeyInput = document.getElementById('privateKeyMultiKeyNative');
            const rpcUrlInput = document.getElementById('rpcUrlMultiKeyNative');
            const walletInfoBox = document.getElementById('walletInfoBoxMultiKeyNative');
            const walletAddressElement = document.getElementById('walletAddressMultiKeyNative');
            const walletBalanceElement = document.getElementById('walletBalanceMultiKeyNative');
            
            // Get the actual value directly (plain text field)
            let developerKey = developerKeyInput?.value || '';
            const rpcUrl = rpcUrlInput?.value?.trim();
            
            
            // Reset if no key
            if (!developerKey || developerKey.trim().length === 0) {
                if (walletAddressElement) walletAddressElement.textContent = '-';
                if (walletBalanceElement) walletBalanceElement.textContent = '-';
                return;
            }
            
            try {
                // Step 1: Clean up the key thoroughly
                developerKey = developerKey
                    .replace(/["'`]/g, '')           // Remove quotes
                    .replace(/\s+/g, '')             // Remove all whitespace
                    .replace(/[\r\n\t]/g, '')        // Remove newlines/tabs
                    .replace(/[,;.]/g, '')           // Remove separators
                    .replace(/0x0x/g, '0x')          // Fix double 0x
                    .trim();
                
                
                // Step 2: Handle 0x prefix
                // Remove all 0x first, then add one at the start
                developerKey = developerKey.replace(/0x/gi, '');
                
                
                // Step 3: Validate it's only hex characters
                if (!/^[a-fA-F0-9]+$/.test(developerKey)) {
                    if (walletAddressElement) walletAddressElement.textContent = 'Non-Hex Chars';
                    if (walletBalanceElement) walletBalanceElement.textContent = '-';
                    return;
                }
                
                // Step 4: Check length (should be exactly 64 hex characters for private key)
                if (developerKey.length !== 64) {
                    if (walletAddressElement) walletAddressElement.textContent = `Wrong Length (${developerKey.length})`;
                    if (walletBalanceElement) walletBalanceElement.textContent = '-';
                    return;
                }
                
                // Step 5: Add 0x prefix
                developerKey = '0x' + developerKey.toLowerCase();
                
                
                // Step 6: Try to create wallet from key
                const wallet = new ethers.Wallet(developerKey);
                const address = wallet.address;
                
                
                // Display shortened address
                const shortAddress = address.substring(0, 10) + '...' + address.substring(address.length - 8);
                if (walletAddressElement) {
                    walletAddressElement.textContent = shortAddress;
                    walletAddressElement.title = address; // Full address on hover
                }
                
                // Fetch balance if RPC is available
                if (rpcUrl) {
                    try {
                        const _udwChainId = parseInt((document.getElementById('rpcUrlMultiKeyNative')||{}).getAttribute?.('data-chainid')||'',10)||null;
                        const _udwRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('rpcUrlMultiKeyNative') : [];
                        if (rpcUrl && !_udwRpcs.includes(rpcUrl)) _udwRpcs.unshift(rpcUrl);
                        // FIX: iterate full RPC list with fallback instead of single URL
                        let provider;
                        for (const _rpc of (_udwRpcs.length ? _udwRpcs : [rpcUrl])) {
                          try {
                            const _p = window._thMakeProvider(_rpc, _udwChainId);
                            await Promise.race([_p.getBlockNumber(), new Promise((_,r)=>setTimeout(()=>r(new Error('timeout')),5000))]);
                            provider = _p; break;
                          } catch(_e) { continue; }
                        }
                        if (!provider) provider = window._thMakeProvider(rpcUrl, _udwChainId);
                        const balance = await window.thRead('rpcUrlMultiKeyNative', provider, function(_p) { return _p.getBalance(address); }, 6000);
                        const balanceFormatted = ethers.formatEther(balance);
                        const chainSymbol = currentMultiKeyNativeChainConfig?.symbol || 'ETH';
                        
                        if (walletBalanceElement) {
                            walletBalanceElement.textContent = `${parseFloat(balanceFormatted).toFixed(6)} ${chainSymbol}`;
                        }
                        window._thDevBalRetry = 0;
                    } catch (balanceError) {
                        // RPC error - show error message, then retry automatically (max 2x) instead of staying stuck
                        if (walletBalanceElement) {
                            walletBalanceElement.textContent = 'RPC Error';
                        }
                        window._thDevBalRetry = (window._thDevBalRetry || 0) + 1;
                        if (window._thDevBalRetry <= 2) {
                            clearTimeout(window._thDevBalRetryTimer);
                            window._thDevBalRetryTimer = setTimeout(function() {
                                if (typeof updateDeveloperWalletMultiKeyNative === 'function') updateDeveloperWalletMultiKeyNative();
                            }, 2500);
                        }
                    }
                } else {
                    if (walletBalanceElement) walletBalanceElement.textContent = 'No RPC';
                }
                
            } catch (error) {
                // Invalid private key
                if (walletAddressElement) walletAddressElement.textContent = 'Invalid Key';
                if (walletBalanceElement) walletBalanceElement.textContent = '-';
            }
        }
        
        // ── Developer Key helpers ─────────────────────────────────────────
        function mkNativeDevKeySync(el) {
            var v = el.value.trim();
            if (window.actualKeysStorage) window.actualKeysStorage['privateKeyMultiKeyNative'] = v;
            if (typeof updateButtonStates === 'function') updateButtonStates();
            if (typeof updateDeveloperWalletMultiKeyNative === 'function') updateDeveloperWalletMultiKeyNative();
        }
        function mkNativeDevKeyClear(el) {
            el.value = '';
            if (window.actualKeysStorage) window.actualKeysStorage['privateKeyMultiKeyNative'] = '';
            var addrEl = document.getElementById('walletAddressMultiKeyNative');
            var balEl  = document.getElementById('walletBalanceMultiKeyNative');
            if (addrEl) addrEl.textContent = '-';
            if (balEl)  balEl.textContent  = '-';
            if (typeof updateButtonStates === 'function') updateButtonStates();
        }

        // Setup event listeners for developer wallet
        function setupDeveloperWalletDetection() {
            const developerKeyInput = document.getElementById('privateKeyMultiKeyNative');
            const rpcUrlInput = document.getElementById('rpcUrlMultiKeyNative');
            
            let updateTimeout;
            
            if (developerKeyInput) {
                // Debounced input handler
                developerKeyInput.addEventListener('input', function() {
                    // Sync actualKeysStorage immediately
                    if (window.actualKeysStorage) window.actualKeysStorage['privateKeyMultiKeyNative'] = this.value.trim();
                    // Update button states immediately
                    if (typeof updateButtonStates === 'function') {
                        updateButtonStates();
                    }
                    
                    clearTimeout(updateTimeout);
                    updateTimeout = setTimeout(() => {
                        updateDeveloperWalletMultiKeyNative();
                    }, 300); // Wait 300ms after typing stops
                });
                
                // Immediate update on change (when field loses focus)
                developerKeyInput.addEventListener('change', function() {
                    if (typeof updateButtonStates === 'function') {
                        updateButtonStates();
                    }
                    
                    clearTimeout(updateTimeout);
                    updateDeveloperWalletMultiKeyNative();
                });
                
                // Handle paste event
                developerKeyInput.addEventListener('paste', function() {
                    setTimeout(() => {
                        if (typeof updateButtonStates === 'function') {
                            updateButtonStates();
                        }
                    }, 10);
                    
                    clearTimeout(updateTimeout);
                    updateTimeout = setTimeout(() => {
                        updateDeveloperWalletMultiKeyNative();
                    }, 100); // Quick update after paste
                });
                
                // Handle blur (when clicking away)
                developerKeyInput.addEventListener('blur', function() {
                    if (typeof updateButtonStates === 'function') {
                        updateButtonStates();
                    }
                    
                    clearTimeout(updateTimeout);
                    updateDeveloperWalletMultiKeyNative();
                });
                
                // Handle keyup — catches Delete/Backspace key release instantly
                developerKeyInput.addEventListener('keyup', function(e) {
                    if (e.key === 'Delete' || e.key === 'Backspace') {
                        if (window.actualKeysStorage) {
                            window.actualKeysStorage['privateKeyMultiKeyNative'] = this.value.trim();
                        }
                        if (typeof updateButtonStates === 'function') updateButtonStates();
                    }
                });
                
                // Handle cut event — value updates after cut completes
                developerKeyInput.addEventListener('cut', function() {
                    var _el = this;
                    setTimeout(function() {
                        if (window.actualKeysStorage) {
                            window.actualKeysStorage['privateKeyMultiKeyNative'] = _el.value.trim();
                        }
                        if (typeof updateButtonStates === 'function') updateButtonStates();
                    }, 0);
                });
            }
            
            if (rpcUrlInput) {
                rpcUrlInput.addEventListener('change', function() {
                    if (typeof updateButtonStates === 'function') {
                        updateButtonStates();
                    }
                    updateDeveloperWalletMultiKeyNative();
                });
                
                rpcUrlInput.addEventListener('input', function() {
                    if (typeof updateButtonStates === 'function') {
                        updateButtonStates();
                    }
                    
                    clearTimeout(updateTimeout);
                    updateTimeout = setTimeout(() => {
                        updateDeveloperWalletMultiKeyNative();
                    }, 500);
                });
            }
        }
        
        // Initialize developer wallet detection when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupDeveloperWalletDetection);
        } else {
            setupDeveloperWalletDetection();
        }

        // ========================================
        // MULTI KEY NATIVE - RECIPIENT BALANCE DETECTION
        // ========================================
        
        // Auto-detect recipient balance for Multi Key Native section
        async function updateMultiKeyNativeRecipientBalance() {
            
            const recipientAddressInput = document.getElementById('recipientAddressMultiKeyNative');
            const rpcUrlInput = document.getElementById('rpcUrlMultiKeyNative');
            const recipientInfoBox = document.getElementById('recipientInfoBoxMultiKeyNative');
            const recipientAddressDisplay = document.getElementById('recipientAddressDisplayMultiKeyNative');
            const recipientBalanceElement = document.getElementById('recipientBalanceMultiKeyNative');
            
            let recipientAddress = recipientAddressInput?.value?.trim() || '';
            const rpcUrl = rpcUrlInput?.value?.trim();
            
            
            // Reset if empty
            if (!recipientAddress) {
                if (recipientInfoBox) recipientInfoBox.style.display = 'none';
                return;
            }
            
            // ========================================
            // CHECK IF INPUT IS A PRIVATE KEY
            // ========================================
            let isPrivateKey = false;
            let derivedAddress = '';
            
            try {
                // Clean the input
                let cleanedInput = recipientAddress
                    .replace(/["'`]/g, '')           // Remove quotes
                    .replace(/\s+/g, '')             // Remove whitespace
                    .replace(/[\r\n\t]/g, '')        // Remove newlines/tabs
                    .replace(/[,;.]/g, '')           // Remove separators
                    .replace(/0x0x/g, '0x')          // Fix double 0x
                    .trim();
                
                // Remove 0x to check
                let keyWithout0x = cleanedInput.replace(/^0x/i, '');
                
                // Check if it looks like a private key (64 hex characters)
                if (/^[a-fA-F0-9]{64}$/.test(keyWithout0x)) {
                    
                    // Try to derive address from private key
                    const privateKey = '0x' + keyWithout0x;
                    const wallet = new ethers.Wallet(privateKey);
                    derivedAddress = wallet.address;
                    isPrivateKey = true;
                    
                    
                    // Update the input field with the derived address
                    recipientAddressInput.value = derivedAddress;
                    recipientAddress = derivedAddress;
                }
            } catch (error) {
            }
            
            // ========================================
            // VALIDATE ADDRESS
            // ========================================
            if (!ethers.isAddress(recipientAddress)) {
                if (recipientInfoBox) recipientInfoBox.style.display = 'none';
                return;
            }
            
            // Show info box
            if (recipientInfoBox) recipientInfoBox.style.display = 'block';
            
            // Display shortened address
            const shortAddress = recipientAddress.substring(0, 10) + '...' + recipientAddress.substring(recipientAddress.length - 8);
            if (recipientAddressDisplay) {
                recipientAddressDisplay.textContent = shortAddress;
                recipientAddressDisplay.title = recipientAddress; // Full address on hover
            }
            
            if (!rpcUrl) {
                if (recipientBalanceElement) recipientBalanceElement.textContent = 'No RPC';
                return;
            }
            
            try {
                const _umnrChainId = parseInt((document.getElementById('rpcUrlMultiKeyNative')||{}).getAttribute?.('data-chainid')||'',10)||null;
                const _umnrRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('rpcUrlMultiKeyNative') : [];
                if (rpcUrl && !_umnrRpcs.includes(rpcUrl)) _umnrRpcs.unshift(rpcUrl);
                // FIX: iterate full RPC list with fallback instead of single URL
                let provider;
                for (const _rpc of (_umnrRpcs.length ? _umnrRpcs : [rpcUrl])) {
                  try {
                    const _p = window._thMakeProvider(_rpc, _umnrChainId);
                    await Promise.race([_p.getBlockNumber(), new Promise((_,r)=>setTimeout(()=>r(new Error('timeout')),5000))]);
                    provider = _p; break;
                  } catch(_e) { continue; }
                }
                if (!provider) provider = window._thMakeProvider(rpcUrl, _umnrChainId);
                
                // Show loading state
                if (recipientBalanceElement) {
                    recipientBalanceElement.textContent = 'Loading...';
                }
                
                
                // Fetch native balance
                const balance = await window.thRead('rpcUrlMultiKeyNative', provider, function(_p) { return _p.getBalance(recipientAddress); }, 6000);
                const balanceInEth = ethers.formatEther(balance);
                
                
                if (recipientBalanceElement) {
                    recipientBalanceElement.textContent = parseFloat(balanceInEth).toFixed(6);
                }
                
            } catch (error) {
                if (recipientBalanceElement) recipientBalanceElement.textContent = 'RPC Error';
            }
        }
