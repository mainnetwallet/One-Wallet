        function logMessageMultiKeyNative(type, message, isHtml) {
            if (!_isUIVisible('multiKeyNativeUI', 'multiKeyNativeModeContent')) return;
            const logContainer = document.getElementById('logContainerMultiKeyNative');
            if (!logContainer) return;
            
            const line = document.createElement('div');
            line.className = `log-line log-${type}`;
            
            const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
            line.innerHTML = `[${timestamp}] ${isHtml ? message : processLogMessage(message, _thGetChainIdFromRpc('rpcUrlMultiKeyNative'))}`;
            
            logContainer.appendChild(line);
            logContainer.scrollTop = logContainer.scrollHeight;
        }

        function setAmountMultiKeyNative(amount) {
            // FIXED VERSION v3.0.3 - Properly formats amount and prevents scientific notation
            
            // Convert scientific notation to fixed decimal string
            let formattedAmount = amount;
            if (typeof amount === 'number' || /e/i.test(String(amount))) {
                formattedAmount = parseFloat(amount).toFixed(18).replace(/\.?0+$/, '');
            }
            
            // Set the main amount field
            const amountField = document.getElementById('amountPerAddressMultiKeyNative');
            if (amountField) {
                amountField.value = formattedAmount;
            }
            
            // Also set the modal amount field if it exists  
            const modalAmountField = document.getElementById('amountMultiKeyNative');
            if (modalAmountField) {
                modalAmountField.value = formattedAmount;
            }
            
            // Update the display
            const perAddressDisplayElement = document.getElementById('perAddressDisplayMultiKeyNative');
            if (perAddressDisplayElement) {
                perAddressDisplayElement.textContent = formattedAmount;
            }
            
            // Calculate total amount
            const totalAmountElement = document.getElementById('totalAmountMultiKeyNative');
            const senderKeysTextarea = document.getElementById('senderPrivateKeysMultiKeyNative');
            
            if (totalAmountElement && senderKeysTextarea) {
                const keys = senderKeysTextarea.value.trim().split('\n').filter(k => k.trim());
                const numKeys = keys.length;
                
                if (numKeys > 0 && !isNaN(parseFloat(formattedAmount))) {
                    const total = (parseFloat(formattedAmount) * numKeys).toFixed(18).replace(/\.?0+$/, '');
                    totalAmountElement.textContent = total;
                } else {
                    totalAmountElement.textContent = '0';
                }
            }
            
            
            // Programmatic .value change doesn't fire input event — update buttons manually
            if (typeof updateButtonStates === 'function') updateButtonStates();
        }
        
        // Set MAX amount - calculates full balance minus gas fee
        async function setMaxAmountMultiKeyNative() {
            try {
                // Set "MAX" text in the amount field
                // This will trigger individual balance calculation for each wallet during execution
                document.getElementById('amountPerAddressMultiKeyNative').value = 'MAX';
                document.getElementById('perAddressDisplayMultiKeyNative').textContent = 'MAX';
                document.getElementById('totalAmountMultiKeyNative').textContent = 'MAX (Individual)';
                
                                
                // Programmatic .value change doesn't fire input event — update buttons manually
                if (typeof updateButtonStates === 'function') updateButtonStates();
                
            } catch (error) {
            }
        }

        // ========================================
        // PRIVATE KEY PARSER — reusable across all sections
        // Extracts valid private keys from any messy input
        // ========================================
        function parsePrivateKeys(input) {
            // যেকোনো format থেকে শুধু private keys extract করবো।
            // Supported: 0xABC...64hex, ABC...64hex (0x ছাড়া), "key", semicolons (;), commas (,), dots (.), spaces — সব handle।
            // Address, words, বাকি সব বাদ।
            
            const validKeys = [];
            
            // First, remove common words that might appear in the input
            // Remove: "key", "private", "wallet", "address", "0x0x" duplicates, quotes, etc.
            let cleanedInput = input
                .replace(/["'`]/g, ' ')                           // Remove quotes
                .replace(/\bkey\b/gi, ' ')                        // Remove "key" word
                .replace(/\bprivate\b/gi, ' ')                    // Remove "private" word
                .replace(/\bwallet\b/gi, ' ')                     // Remove "wallet" word
                .replace(/\baddress\b/gi, ' ')                    // Remove "address" word
                .replace(/\bseed\b/gi, ' ')                       // Remove "seed" word
                .replace(/\bmnemonic\b/gi, ' ')                   // Remove "mnemonic" word
                .replace(/0x0x/g, '0x')                           // Fix double 0x
                .replace(/\[|\]|\{|\}/g, ' ')                     // Remove brackets
                .replace(/:/g, ' ');                              // Remove colons
            
            // Then normalize by replacing all separators with spaces
            // This handles: semicolons (;), commas (,), dots (.), newlines, tabs, etc.
            let normalizedInput = cleanedInput
                .replace(/;/g, ' ')      // semicolon to space
                .replace(/,/g, ' ')      // comma to space
                .replace(/\./g, ' ')     // dot to space (but keeps hex decimals)
                .replace(/\n/g, ' ')     // newline to space
                .replace(/\t/g, ' ')     // tab to space
                .replace(/\r/g, ' ')     // carriage return to space
                .replace(/\s+/g, ' ');   // Multiple spaces to single space
            
            // সব hex tokens match করি — 0x prefixed বা raw 40+ hex
            const tokens = normalizedInput.match(/0x[a-fA-F0-9]+|[a-fA-F0-9]{40,}/g) || [];
            
            tokens.forEach(token => {
                // 0x normalize করি
                const normalized = token.startsWith('0x') ? token : '0x' + token;
                
                // শুধু exactly 66 chars (0x + 64 hex) = private key
                if (normalized.length === 66) {
                    try {
                        new ethers.Wallet(normalized); // invalid হলে throws
                        validKeys.push(normalized);
                    } catch (e) {
                        // valid key না, skip
                    }
                }
                // বাকি সব (address, short hex, long hex) বাদ দেওয়া হচ্ছে
            });
            
            return { keys: validKeys };
        }
