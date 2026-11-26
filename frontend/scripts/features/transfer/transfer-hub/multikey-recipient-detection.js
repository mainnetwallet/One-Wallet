        
        // Setup event listeners for Multi Key Native recipient detection
        function setupMultiKeyNativeRecipientDetection() {
            
            const recipientAddressInput = document.getElementById('recipientAddressMultiKeyNative');
            const rpcUrlInput = document.getElementById('rpcUrlMultiKeyNative');
            
            
            if (recipientAddressInput) {
                
                // Input event - trigger on every keystroke/paste
                recipientAddressInput.addEventListener('input', function() {
                    const input = this.value.trim();
                    
                    // Update button states immediately
                    if (typeof updateButtonStates === 'function') {
                        updateButtonStates();
                    }
                    
                    // Debounce the update
                    clearTimeout(window.multiKeyNativeRecipientTimeout);
                    window.multiKeyNativeRecipientTimeout = setTimeout(() => {
                        updateMultiKeyNativeRecipientBalance();
                    }, 300);
                });
                
                // Paste event - immediate trigger
                recipientAddressInput.addEventListener('paste', function() {
                    
                    // Update button states
                    setTimeout(() => {
                        if (typeof updateButtonStates === 'function') {
                            updateButtonStates();
                        }
                    }, 10);
                    
                    clearTimeout(window.multiKeyNativeRecipientTimeout);
                    window.multiKeyNativeRecipientTimeout = setTimeout(() => {
                        updateMultiKeyNativeRecipientBalance();
                    }, 100);
                });
                
                // Change event - when focus is lost
                recipientAddressInput.addEventListener('change', function() {
                    
                    if (typeof updateButtonStates === 'function') {
                        updateButtonStates();
                    }
                    
                    clearTimeout(window.multiKeyNativeRecipientTimeout);
                    updateMultiKeyNativeRecipientBalance();
                });
                
                // Blur event - when clicking away
                recipientAddressInput.addEventListener('blur', function() {
                    
                    if (typeof updateButtonStates === 'function') {
                        updateButtonStates();
                    }
                    
                    clearTimeout(window.multiKeyNativeRecipientTimeout);
                    updateMultiKeyNativeRecipientBalance();
                });
            } else {
            }
            
            if (rpcUrlInput) {
                rpcUrlInput.addEventListener('change', updateMultiKeyNativeRecipientBalance);
                rpcUrlInput.addEventListener('input', function() {
                    const recipientAddress = document.getElementById('recipientAddressMultiKeyNative')?.value.trim();
                    if (recipientAddress && this.value.trim()) {
                        // Debounce the update
                        clearTimeout(window.multiKeyNativeRpcTimeout);
                        window.multiKeyNativeRpcTimeout = setTimeout(updateMultiKeyNativeRecipientBalance, 500);
                    }
                });
            } else {
            }
            
        }
        
        // Initialize recipient detection when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupMultiKeyNativeRecipientDetection);
        } else {
            setupMultiKeyNativeRecipientDetection();
        }

        // ========================================
        // MULTI KEY TOKEN - RECIPIENT BALANCE DETECTION
        // ========================================
        
        // Auto-detect recipient balance and convert private key to address for Token mode
        async function updateMultiKeyTokenRecipientBalance() {
            const recipientAddressInput = document.getElementById('recipientAddressMultiKeyToken');
            const rpcUrlInput = document.getElementById('rpcUrlMultiKeyToken');
            const tokenContractInput = document.getElementById('tokenContractAddressMultiKeyToken');
            const recipientInfoBox = document.getElementById('recipientTokenInfoBoxMultiKeyToken');
            const recipientAddressDisplay = document.getElementById('recipientAddressDisplayMultiKeyToken');
            const recipientBalanceElement = document.getElementById('recipientTokenBalanceMultiKeyToken');
            
            let recipientInput = recipientAddressInput?.value?.trim() || '';
            const rpcUrl = rpcUrlInput?.value?.trim();
            const tokenContract = tokenContractInput?.value?.trim();
            
            // Reset if empty
            if (!recipientInput) {
                if (recipientInfoBox) recipientInfoBox.style.display = 'none';
                return;
            }
            
            try {
                // Clean the input (same as Native mode)
                let cleanedInput = recipientInput
                    .replace(/["'`]/g, '')           // Remove quotes
                    .replace(/\s+/g, '')             // Remove whitespace
                    .replace(/[\r\n\t]/g, '')        // Remove newlines/tabs
                    .replace(/[,;.]/g, '')           // Remove separators
                    .replace(/0x0x/g, '0x')          // Fix double 0x
                    .trim();
                
                let finalAddress = '';
                let isPrivateKey = false;
                
                // Check if it's a private key (64 hex chars with or without 0x)
                const withoutPrefix = cleanedInput.replace(/^0x/i, '');
                
                if (/^[a-fA-F0-9]{64}$/.test(withoutPrefix)) {
                    // It's a private key - convert to address
                    const privateKey = '0x' + withoutPrefix.toLowerCase();
                    const wallet = new ethers.Wallet(privateKey);
                    finalAddress = wallet.address;
                    isPrivateKey = true;
                    
                    // Replace the input field with the address
                    recipientAddressInput.value = finalAddress;
                } else if (/^0x[a-fA-F0-9]{40}$/.test(cleanedInput)) {
                    // It's already an address
                    finalAddress = cleanedInput;
                } else {
                    // Invalid format
                    if (recipientAddressDisplay) recipientAddressDisplay.textContent = 'Invalid Format';
                    if (recipientBalanceElement) recipientBalanceElement.textContent = '-';
                    if (recipientInfoBox) recipientInfoBox.style.display = 'none';
                    return;
                }
                
                // Show address in wallet info
                if (recipientAddressDisplay) {
                    recipientAddressDisplay.textContent = finalAddress.substring(0, 10) + '...' + finalAddress.substring(finalAddress.length - 8);
                    recipientAddressDisplay.style.color = isPrivateKey ? '#43e97b' : '#4ade80';
                }
                
                // Show the info box
                if (recipientInfoBox) recipientInfoBox.style.display = 'block';
                
                // Try to fetch token balance if RPC and contract are available
                if (rpcUrl && tokenContract && /^0x[a-fA-F0-9]{40}$/.test(tokenContract)) {
                    try {
                        const _mktRecChainId = parseInt((document.getElementById('rpcUrlMultiKeyToken')||{}).getAttribute?.('data-chainid')||'',10)||null;
                        const _mktRecRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('rpcUrlMultiKeyToken') : [];
                        if (rpcUrl && !_mktRecRpcs.includes(rpcUrl)) _mktRecRpcs.unshift(rpcUrl);
                        // FIX: iterate full RPC list with fallback instead of single URL
                        let provider;
                        for (const _rpc of (_mktRecRpcs.length ? _mktRecRpcs : [rpcUrl])) {
                          try {
                            const _p = window._thMakeProvider(_rpc, _mktRecChainId);
                            await Promise.race([_p.getBlockNumber(), new Promise((_,r)=>setTimeout(()=>r(new Error('timeout')),5000))]);
                            provider = _p; break;
                          } catch(_e) { continue; }
                        }
                        if (!provider) provider = window._thMakeProvider(rpcUrl, _mktRecChainId);
                        const tokenAbi = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)', 'function symbol() view returns (string)'];
                        const tokenContractObj = new ethers.Contract(tokenContract, tokenAbi, provider);
                        
                        const balance = await tokenContractObj.balanceOf(finalAddress);
                        const decimals = await tokenContractObj.decimals();
                        const symbol = await tokenContractObj.symbol();
                        
                        const balanceFormatted = ethers.formatUnits(balance, decimals);
                        
                        if (recipientBalanceElement) {
                            recipientBalanceElement.textContent = `${parseFloat(balanceFormatted).toFixed(4)} ${symbol}`;
                        }
                        
                        // Update token symbol field if empty
                        const tokenSymbolInput = document.getElementById('tokenSymbolMultiKeyToken');
                        if (tokenSymbolInput && !tokenSymbolInput.value) {
                            tokenSymbolInput.value = symbol;
                        }
                        
                        // Update decimals
                        const tokenDecimalsInput = document.getElementById('tokenDecimalsMultiKeyToken');
                        if (tokenDecimalsInput) {
                            tokenDecimalsInput.value = decimals.toString();
                        }
                    } catch (error) {
                        if (recipientBalanceElement) recipientBalanceElement.textContent = 'Balance fetch failed';
                    }
                } else {
                    if (recipientBalanceElement) recipientBalanceElement.textContent = 'Need RPC & Token Contract';
                }
                
            } catch (error) {
                if (recipientAddressDisplay) recipientAddressDisplay.textContent = 'Invalid Key/Address';
                if (recipientBalanceElement) recipientBalanceElement.textContent = '-';
                if (recipientInfoBox) recipientInfoBox.style.display = 'none';
            }
        }
        
        // Setup event listeners for Token mode recipient detection
        function setupMultiKeyTokenRecipientDetection() {
            const recipientAddressInput = document.getElementById('recipientAddressMultiKeyToken');
            const rpcUrlInput = document.getElementById('rpcUrlMultiKeyToken');
            const tokenContractInput = document.getElementById('tokenContractAddressMultiKeyToken');
            
            if (recipientAddressInput) {
                // Input event - debounced
                recipientAddressInput.addEventListener('input', function() {
                    if (typeof updateButtonStates === 'function') {
                        updateButtonStates();
                    }
                    
                    clearTimeout(window.multiKeyTokenRecipientTimeout);
                    window.multiKeyTokenRecipientTimeout = setTimeout(() => {
                        updateMultiKeyTokenRecipientBalance();
                    }, 300);
                });
                
                // Paste event - quick trigger
                recipientAddressInput.addEventListener('paste', function() {
                    setTimeout(() => {
                        if (typeof updateButtonStates === 'function') {
                            updateButtonStates();
                        }
                    }, 10);
                    
                    clearTimeout(window.multiKeyTokenRecipientTimeout);
                    window.multiKeyTokenRecipientTimeout = setTimeout(() => {
                        updateMultiKeyTokenRecipientBalance();
                    }, 100);
                });
                
                // Change & blur events
                recipientAddressInput.addEventListener('change', function() {
                    if (typeof updateButtonStates === 'function') {
                        updateButtonStates();
                    }
                    clearTimeout(window.multiKeyTokenRecipientTimeout);
                    updateMultiKeyTokenRecipientBalance();
                });
                
                recipientAddressInput.addEventListener('blur', function() {
                    if (typeof updateButtonStates === 'function') {
                        updateButtonStates();
                    }
                    clearTimeout(window.multiKeyTokenRecipientTimeout);
                    updateMultiKeyTokenRecipientBalance();
                });
            }
            
            // RPC URL change - update balance
            if (rpcUrlInput) {
                rpcUrlInput.addEventListener('change', updateMultiKeyTokenRecipientBalance);
                rpcUrlInput.addEventListener('input', function() {
                    const recipientValue = document.getElementById('recipientAddressMultiKeyToken')?.value.trim();
                    if (recipientValue && this.value.trim()) {
                        clearTimeout(window.multiKeyTokenRpcTimeout);
                        window.multiKeyTokenRpcTimeout = setTimeout(updateMultiKeyTokenRecipientBalance, 500);
                    }
                });
            }
            
            // Token contract change - update balance
            if (tokenContractInput) {
                tokenContractInput.addEventListener('change', updateMultiKeyTokenRecipientBalance);
                tokenContractInput.addEventListener('input', function() {
                    const recipientValue = document.getElementById('recipientAddressMultiKeyToken')?.value.trim();
                    if (recipientValue && this.value.trim()) {
                        clearTimeout(window.multiKeyTokenContractTimeout);
                        window.multiKeyTokenContractTimeout = setTimeout(updateMultiKeyTokenRecipientBalance, 500);
                    }
                });
            }
        }
        
        // Initialize Token recipient detection when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupMultiKeyTokenRecipientDetection);
        } else {
            setupMultiKeyTokenRecipientDetection();
        }

        // ========================================
        // EVENT LISTENERS FOR MULTI-RECIPIENT FEATURES
        // ========================================
        
        function setupMultiRecipientEventListeners() {
            // Update button states when any input changes
            const inputs = [
                'senderPrivateKeysMultiKeyNative',
                'recipientsListMultiKeyNative',
                'rpcUrlMultiKeyNative',
                'privateKeyMultiKeyNative',
                'amountPerAddressMultiKeyNative'
            ];
            
            inputs.forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    element.addEventListener('input', () => {
                        if (typeof updateButtonStates === 'function') {
                            updateButtonStates();
                        }
                        
                        // Update recipient count and total on input
                        if (id === 'recipientsListMultiKeyNative' || id === 'amountPerAddressMultiKeyNative') {
                            const recipientsTextEl = document.getElementById('recipientsListMultiKeyNative');
                            const defaultAmountEl = document.getElementById('amountPerAddressMultiKeyNative');
                            const recipientCountEl = document.getElementById('recipientCountMultiKeyNative');
                            const defaultAmountDisplayEl = document.getElementById('defaultAmountDisplayMultiKeyNative');
                            const totalRecipientsAmountEl = document.getElementById('totalRecipientsAmountMultiKeyNative');
                            
                            if (!recipientsTextEl || !defaultAmountEl || !recipientCountEl || !defaultAmountDisplayEl || !totalRecipientsAmountEl) {
                                return;
                            }
                            
                            const recipientsText = recipientsTextEl.value;
                            const defaultAmount = defaultAmountEl.value;
                            
                            if (recipientsText.trim()) {
                                const recipients = parseRecipients(recipientsText);
                                recipientCountEl.textContent = recipients.length;
                                defaultAmountDisplayEl.textContent = defaultAmount || '0';
                                
                                const defaultAmt = parseFloat(defaultAmount) || 0;
                                let totalAmount = 0;
                                recipients.forEach(r => {
                                    totalAmount += r.customAmount || defaultAmt;
                                });
                                
                                totalRecipientsAmountEl.textContent = totalAmount.toFixed(6);
                            }
                        }
                    });
                }
            });
        }
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupMultiRecipientEventListeners);
        } else {
            setupMultiRecipientEventListeners();
        }