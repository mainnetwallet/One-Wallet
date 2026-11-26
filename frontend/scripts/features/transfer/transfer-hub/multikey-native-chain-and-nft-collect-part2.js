        
        // ========================================
        // KEYS OR ADDRESSES PARSER — for receiver fields
        // Extracts valid private keys OR addresses from input
        // ========================================
        function parseKeysOrAddresses(input) {
            const validItems = [];
            
            // Clean input
            let cleanedInput = input
                .replace(/["'`]/g, ' ')
                .replace(/\bkey\b/gi, ' ')
                .replace(/\bprivate\b/gi, ' ')
                .replace(/\bwallet\b/gi, ' ')
                .replace(/\baddress\b/gi, ' ')
                .replace(/\bseed\b/gi, ' ')
                .replace(/\bmnemonic\b/gi, ' ')
                .replace(/0x0x/g, '0x')
                .replace(/\[|\]|\{|\}/g, ' ')
                .replace(/:/g, ' ');
            
            // Normalize separators
            let normalizedInput = cleanedInput
                .replace(/;/g, ' ')
                .replace(/,/g, ' ')
                .replace(/\./g, ' ')
                .replace(/\n/g, ' ')
                .replace(/\t/g, ' ')
                .replace(/\r/g, ' ')
                .replace(/\s+/g, ' ');
            
            // Match hex tokens (both 40 and 64 hex chars)
            const tokens = normalizedInput.match(/0x[a-fA-F0-9]+|[a-fA-F0-9]{40,}/g) || [];
            
            tokens.forEach(token => {
                const normalized = token.startsWith('0x') ? token : '0x' + token;
                
                // Check if it's a private key (66 chars)
                if (normalized.length === 66) {
                    try {
                        const wallet = new ethers.Wallet(normalized);
                        validItems.push(wallet.address); // Convert key to address
                    } catch (e) {
                        // Invalid key, skip
                    }
                }
                // Check if it's an address (42 chars)
                else if (normalized.length === 42) {
                    try {
                        const address = ethers.getAddress(normalized); // Validate and checksum
                        validItems.push(address);
                    } catch (e) {
                        // Invalid address, skip
                    }
                }
            });
            
            return { items: validItems };
        }
        
        // ========================================
        // FORMAT / VALIDATE — Multi Key Native Sender Keys
        // ========================================
        // Auto-validation with debounce for Native mode
        let nativeKeyValidationTimer = null;
        function autoValidateNativeKeys() {
            // Clear previous timer
            if (nativeKeyValidationTimer) {
                clearTimeout(nativeKeyValidationTimer);
            }
            
            // Update button states immediately on every keystroke
            if (typeof updateButtonStates === 'function') updateButtonStates();
            
            // Set new timer - validate after 0.1 second of no typing
            nativeKeyValidationTimer = setTimeout(() => {
                formatAddressesMultiKeyNative();
                // Re-check after format cleans up the keys
                if (typeof updateButtonStates === 'function') updateButtonStates();
            }, 100);
        }
        
        // Auto-validation for Wallet to Wallet Native mode
        let w2wNativeKeyValidationTimer = null;
        function autoValidateW2WNativeKeys() {
            if (w2wNativeKeyValidationTimer) {
                clearTimeout(w2wNativeKeyValidationTimer);
            }
            
            w2wNativeKeyValidationTimer = setTimeout(() => {
                validateAndCleanW2WNativeKeys();
            }, 100);
        }
        
        // Auto-validation for Wallet to Wallet Token mode
        let w2wTokenKeyValidationTimer = null;
        function autoValidateW2WTokenKeys() {
            if (w2wTokenKeyValidationTimer) {
                clearTimeout(w2wTokenKeyValidationTimer);
            }
            
            w2wTokenKeyValidationTimer = setTimeout(() => {
                validateAndCleanW2WTokenKeys();
            }, 100);
        }
        
        // Validate and clean W2W Native sender keys
        function validateAndCleanW2WNativeKeys() {
            const textarea = document.getElementById('w2wSenderKeys');
            const rawText = textarea.value;
            
            if (!rawText.trim()) { checkW2WExecuteReady(); return; }
            
            const { keys } = parsePrivateKeys(rawText);
            
            if (keys.length === 0) { checkW2WExecuteReady(); return; }
            
            // Dedupe keys
            const uniqueKeys = [...new Set(keys)];
            
            // Replace textarea with clean keys only
            textarea.value = uniqueKeys.join('\n');
            
            // Update count
            document.getElementById('w2wSenderCount').textContent = uniqueKeys.length;
            document.getElementById('w2wTotalSenders').textContent = uniqueKeys.length;
            checkW2WExecuteReady();
        }
        
        // Validate and clean W2W Token sender keys
        function validateAndCleanW2WTokenKeys() {
            const textarea = document.getElementById('w2wSenderKeysToken');
            const rawText = textarea.value;
            
            if (!rawText.trim()) { checkW2WExecuteReady(); return; }
            
            const { keys } = parsePrivateKeys(rawText);
            
            if (keys.length === 0) { checkW2WExecuteReady(); return; }
            
            // Dedupe keys
            const uniqueKeys = [...new Set(keys)];
            
            // Replace textarea with clean keys only
            textarea.value = uniqueKeys.join('\n');
            
            // Update count
            document.getElementById('w2wSenderCountToken').textContent = uniqueKeys.length;
            checkW2WExecuteReady();
        }
        
        // Auto-validation for W2W Native receivers
        let w2wNativeReceiverValidationTimer = null;
        function autoValidateW2WNativeReceivers() {
            if (w2wNativeReceiverValidationTimer) {
                clearTimeout(w2wNativeReceiverValidationTimer);
            }
            
            w2wNativeReceiverValidationTimer = setTimeout(() => {
                validateAndCleanW2WNativeReceivers();
            }, 100);
        }
        
        // Auto-validation for W2W Token receivers
        let w2wTokenReceiverValidationTimer = null;
        function autoValidateW2WTokenReceivers() {
            if (w2wTokenReceiverValidationTimer) {
                clearTimeout(w2wTokenReceiverValidationTimer);
            }
            
            w2wTokenReceiverValidationTimer = setTimeout(() => {
                validateAndCleanW2WTokenReceivers();
            }, 100);
        }
        
        // Validate and clean W2W Native receivers (keys or addresses)
        function validateAndCleanW2WNativeReceivers() {
            const textarea = document.getElementById('w2wReceiverKeys');
            const rawText = textarea.value;
            
            if (!rawText.trim()) { checkW2WExecuteReady(); return; }
            
            const { items } = parseKeysOrAddresses(rawText);
            
            if (items.length === 0) { checkW2WExecuteReady(); return; }
            
            // Dedupe addresses
            const uniqueAddresses = [...new Set(items)];
            
            // Replace textarea with clean addresses only
            textarea.value = uniqueAddresses.join('\n');
            
            // Update count
            document.getElementById('w2wReceiverCount').textContent = uniqueAddresses.length;
            document.getElementById('w2wTotalReceivers').textContent = uniqueAddresses.length;
            checkW2WExecuteReady();
        }
        
        // Validate and clean W2W Token receivers (keys or addresses)
        function validateAndCleanW2WTokenReceivers() {
            const textarea = document.getElementById('w2wReceiverKeysToken');
            const rawText = textarea.value;
            
            if (!rawText.trim()) { checkW2WExecuteReady(); return; }
            
            const { items } = parseKeysOrAddresses(rawText);
            
            if (items.length === 0) { checkW2WExecuteReady(); return; }
            
            // Dedupe addresses
            const uniqueAddresses = [...new Set(items)];
            
            // Replace textarea with clean addresses only
            textarea.value = uniqueAddresses.join('\n');
            
            // Update count
            document.getElementById('w2wReceiverCountToken').textContent = uniqueAddresses.length;
            checkW2WExecuteReady();
        }
        
        // ========================================
        // NFT TRANSFER AUTO-VALIDATION
        // ========================================
        
        // Auto-validation for NFT Distribute recipients
        let nftDistributeRecipientsTimer = null;
        function autoValidateNftDistributeRecipients() {
            if (nftDistributeRecipientsTimer) {
                clearTimeout(nftDistributeRecipientsTimer);
            }
            
            nftDistributeRecipientsTimer = setTimeout(() => {
                validateNftDistributeRecipientsAuto();
            }, 100);
        }
        
        // Auto-validation for NFT Collect sender keys
        let nftSenderKeysTimer = null;
        function autoValidateNftSenderKeys() {
            if (nftSenderKeysTimer) {
                clearTimeout(nftSenderKeysTimer);
            }
            
            nftSenderKeysTimer = setTimeout(() => {
                validateNftSenderKeysAuto();
            }, 100);
        }
        
        // Auto-validation for NFT Collect recipient
        let nftCollectRecipientTimer = null;
        function autoValidateNftCollectRecipient() {
            if (nftCollectRecipientTimer) {
                clearTimeout(nftCollectRecipientTimer);
            }
            
            nftCollectRecipientTimer = setTimeout(() => {
                validateNftCollectRecipientAuto();
            }, 100);
        }
        
        // Validate NFT Distribute recipients (auto version)
        function validateNftDistributeRecipientsAuto() {
            const textarea = document.getElementById('nftRecipientsDistribute');
            const rawText = textarea.value;
            
            if (!rawText.trim()) { checkNftExecuteReady(); return; }
            
            const { items } = parseKeysOrAddresses(rawText);
            
            if (items.length === 0) { checkNftExecuteReady(); return; }
            
            // Dedupe addresses
            const uniqueAddresses = [...new Set(items)];
            
            // Replace textarea with clean addresses only
            textarea.value = uniqueAddresses.join('\n');
            
            // Update count
            document.getElementById('nftDistributeRecipientsCount').textContent = uniqueAddresses.length;
            checkNftExecuteReady();
        }
        
        // Validate NFT Collect sender keys (auto version)
        function validateNftSenderKeysAuto() {
            const textarea = document.getElementById('nftSenderKeys');
            const rawText = textarea.value;
            
            if (!rawText.trim()) { checkNftExecuteReady(); return; }
            
            const { keys } = parsePrivateKeys(rawText);
            
            if (keys.length === 0) { checkNftExecuteReady(); return; }
            
            // Dedupe keys
            const uniqueKeys = [...new Set(keys)];
            
            // Replace textarea with clean keys only
            textarea.value = uniqueKeys.join('\n');
            
            // Update count
            document.getElementById('nftCollectWalletCount').textContent = uniqueKeys.length;
            checkNftExecuteReady();
        }
        
        // Validate NFT Collect recipient (auto version)
        function validateNftCollectRecipientAuto() {
            const input = document.getElementById('nftCollectRecipient');
            const rawText = input.value;
            
            if (!rawText.trim()) { checkNftExecuteReady(); return; }
            
            const { items } = parseKeysOrAddresses(rawText);
            
            if (items.length > 0) {
                // Replace input with clean address (first one if multiple)
                input.value = items[0];
            }
            checkNftExecuteReady();
        }
        
        // ========================================
        // SELF TRANSFER AUTO-VALIDATION
        // ========================================
        
        // Auto-validation for Self Transfer keys
        let selfTransferKeysTimer = null;
        function autoValidateSelfTransferKeys() {
            if (selfTransferKeysTimer) {
                clearTimeout(selfTransferKeysTimer);
            }
            
            selfTransferKeysTimer = setTimeout(() => {
                validateSelfTransferKeysAuto();
            }, 100);
        }
        
        // Validate Self Transfer keys (auto version)
        function validateSelfTransferKeysAuto() {
            const textarea = document.getElementById('privateKeysSelfTransfer');
            const rawText = textarea.value;
            
            if (!rawText.trim()) {
                updateSelfTransferKeyCount();
                return;
            }
            
            const { keys } = parsePrivateKeys(rawText);
            
            if (keys.length === 0) {
                updateSelfTransferKeyCount();
                return;
            }
            
            // Dedupe keys
            const uniqueKeys = [...new Set(keys)];
            
            // Replace textarea with clean keys only
            textarea.value = uniqueKeys.join('\n');
            
            // Update count and estimates
            updateSelfTransferKeyCount();
        }
        

        
        async function formatAddressesMultiKeyNative() {
            const textarea = document.getElementById('senderPrivateKeysMultiKeyNative');
            const rawText = textarea.value;
            
            if (!rawText.trim()) {
                logMessageMultiKeyNative('error', '❌ No input provided');
                return;
            }
            
                        
            const { keys } = parsePrivateKeys(rawText);
            
            if (keys.length === 0) {
                logMessageMultiKeyNative('error', '❌ No valid private keys found');
                                return;
            }
            
            // Dedupe keys
            const uniqueKeys = [...new Set(keys)];
            const duplicateKeys = keys.length - uniqueKeys.length;
            
            if (duplicateKeys > 0) {
                logMessageMultiKeyNative('warning', `⚠️ Removed ${duplicateKeys} duplicate key(s)`);
            }
            
            // Check if RPC URL is provided for balance fetching
            const rpcUrl = document.getElementById('rpcUrlMultiKeyNative').value.trim();
            const _thRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('rpcUrlMultiKeyNative') : (rpcUrl ? [rpcUrl] : []);
            const _thChainId = parseInt((document.getElementById('rpcUrlMultiKeyNative')||{}).getAttribute?.('data-chainid')||'',10)||null;
            
            if (rpcUrl) {
                try {
                                        
                    // FIX: use thWithFallback for automatic multi-RPC failover
                    let provider;
                    try {
                      provider = await window.thWithFallback('rpcUrlMultiKeyNative', async function(_p) {
                        await Promise.race([_p.getBlockNumber(), new Promise((_,r)=>setTimeout(()=>r(new Error('probe timeout')),5000))]);
                        return _p;
                      }, 5000);
                    } catch(_thErr) {
                      const _fbCid = parseInt((document.getElementById('rpcUrlMultiKeyNative')||{}).getAttribute?.('data-chainid')||'',10)||null;
                      provider = window._thMakeProvider(rpcUrl, _fbCid);
                    }
                    let fetchedCount = 0;
                    let totalBalance = 0n;
                    
                    // Derive addresses and fetch balances
                    for (let i = 0; i < uniqueKeys.length; i++) {
                        try {
                            const wallet = new ethers.Wallet(uniqueKeys[i]);
                            const balance = await window.thRead('rpcUrlMultiKeyNative', provider, function(_p) { return _p.getBalance(wallet.address); }, 6000);
                            const balanceEth = ethers.formatEther(balance);
                            
                            totalBalance += balance;
                            fetchedCount++;
                            
                        } catch (e) {
                        }
                    }
                    
                    // Update Total Balance display
                    const totalBalanceEth = ethers.formatEther(totalBalance);
                    document.getElementById('totalBalanceMultiKeyNative').textContent = parseFloat(totalBalanceEth).toFixed(6);
                    
                    
                } catch (error) {
                    logMessageMultiKeyNative('error', `❌ Failed to fetch balances: ${error.message}`);
                    // Still show addresses without balances
                    uniqueKeys.forEach((key, i) => {
                        try {
                            const wallet = new ethers.Wallet(key);
                        } catch (e) {}
                    });
                }
            } else {
                // No RPC URL - just show addresses
                                uniqueKeys.forEach((key, i) => {
                    try {
                        const wallet = new ethers.Wallet(key);
                    } catch (e) {}
                });
            }
            
            // Write back clean keys ONLY - Remove all invalid words/text
            window.actualKeysStorage['senderPrivateKeysMultiKeyNative'] = uniqueKeys.join('\n');
            textarea.value = uniqueKeys.join('\n');
            
            // Update count
            document.getElementById('totalSendersMultiKeyNative').textContent = uniqueKeys.length;
            
            
            // Programmatic textarea.value change — update buttons
            if (typeof updateButtonStates === 'function') updateButtonStates();
        }
        
        function clearAllDataMultiKeyNative() {
            document.getElementById('privateKeyMultiKeyNative').value = '';
            document.getElementById('senderPrivateKeysMultiKeyNative').value = '';
            document.getElementById('recipientAddressMultiKeyNative').value = '';
            document.getElementById('amountPerAddressMultiKeyNative').value = '';
            
            // Clear in-memory keys (keys নিজেরা কখনো localStorage এ থাকে না)
            if (window.actualKeysStorage) {
                window.actualKeysStorage['senderPrivateKeysMultiKeyNative'] = '';
                window.actualKeysStorage['privateKeyMultiKeyNative'] = '';
            }
            
            // Reset counts
            document.getElementById('totalSendersMultiKeyNative').textContent = '0';
            document.getElementById('totalBalanceMultiKeyNative').textContent = '0';
            document.getElementById('perAddressDisplayMultiKeyNative').textContent = '0';
            document.getElementById('totalAmountMultiKeyNative').textContent = '0';
            
            document.getElementById('logContainerMultiKeyNative').innerHTML = '';
            
            // Programmatic .value changes don't fire input events — update buttons manually
            if (typeof updateButtonStates === 'function') updateButtonStates();
        }
