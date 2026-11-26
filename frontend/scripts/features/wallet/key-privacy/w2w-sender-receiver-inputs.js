        // Auto convert receiver keys to addresses
        function autoConvertReceivers() {
            const receiverInput = document.getElementById('w2wReceiverKeys');
            const lines = receiverInput.value.split('\n').filter(line => line.trim());
            
            const converted = [];
            let changeCount = 0;
            
            for (let line of lines) {
                line = line.trim();
                if (!line) continue;
                
                // If already an address (starts with 0x and 42 chars)
                if (line.startsWith('0x') && line.length === 42) {
                    converted.push(line);
                } else {
                    // Try to convert as private key
                    try {
                        let cleanedKey = line
                            .replace(/\./g, '')
                            .replace(/\s/g, '')
                            .replace(/[^0-9a-fA-Fx]/g, '');
                        
                        if (!cleanedKey.startsWith('0x')) {
                            cleanedKey = '0x' + cleanedKey;
                        }
                        
                        cleanedKey = cleanedKey.replace(/^0x0x/, '0x');
                        
                        const wallet = new ethers.Wallet(cleanedKey);
                        converted.push(wallet.address);
                        changeCount++;
                    } catch (error) {
                        // If conversion fails, keep original
                        converted.push(line);
                    }
                }
            }
            
            receiverInput.value = converted.join('\n');
            updateReceiverCount();
            
            if (changeCount > 0) {
            } else {
            }
            
            updatePreview();
        }
        
        // Update sender count
        document.getElementById('w2wSenderKeys')?.addEventListener('input', updateSenderCount);
        
        // Debounced sender update with auto cleaning
        let senderUpdateTimeout;
        document.getElementById('w2wSenderKeys')?.addEventListener('input', () => {
            clearTimeout(senderUpdateTimeout);
            senderUpdateTimeout = setTimeout(updateSenderCount, 800);
        });
        
        function updateSenderCount() {
            const senderInput = document.getElementById('w2wSenderKeys');
            const lines = senderInput.value.split('\n');
            
            // Auto clean and extract valid keys
            let hasChanges = false;
            const cleaned = lines.map(line => {
                const original = line;
                
                // Remove all non-hex characters except 0x prefix
                let cleanedKey = line
                    .replace(/\s+/g, '')        // Remove all whitespace
                    .replace(/\./g, '')         // Remove dots
                    .replace(/,/g, '')          // Remove commas
                    .replace(/;/g, '')          // Remove semicolons
                    .replace(/-/g, '')          // Remove hyphens
                    .replace(/[^0-9a-fA-Fx]/g, ''); // Keep only hex chars and x
                
                // Handle 0x prefix
                if (!cleanedKey.startsWith('0x') && cleanedKey.length > 0) {
                    cleanedKey = '0x' + cleanedKey;
                }
                
                // Remove duplicate 0x
                cleanedKey = cleanedKey.replace(/^0x0x+/, '0x');
                
                // Check if we have a valid length private key
                if (cleanedKey.length === 66 && cleanedKey !== original) {
                    hasChanges = true;
                }
                
                return cleanedKey || original;
            });
            
            // Update textarea if cleaning happened
            if (hasChanges) {
                const cursorPos = senderInput.selectionStart;
                senderInput.value = cleaned.join('\n');
                senderInput.setSelectionRange(cursorPos, cursorPos);
            }
            
            const keys = cleaned.filter(k => k.trim().length > 0);
            document.getElementById('w2wSenderCount').textContent = `${keys.length} sender${keys.length !== 1 ? 's' : ''}`;
            updatePreview();
        }
        
        // Debounced receiver update with auto conversion
        let receiverUpdateTimeout;
        document.getElementById('w2wReceiverKeys')?.addEventListener('input', () => {
            clearTimeout(receiverUpdateTimeout);
            receiverUpdateTimeout = setTimeout(updateReceiverCount, 800); // Wait 800ms after typing stops
        });
        
        function updateReceiverCount() {
            const receiverInput = document.getElementById('w2wReceiverKeys');
            const lines = receiverInput.value.split('\n');
            
            // Auto clean and convert keys to addresses
            let hasChanges = false;
            const converted = lines.map(line => {
                const original = line.trim();
                if (!original) return original;
                
                // If already a valid address (0x + 40 hex chars), keep it
                if (original.startsWith('0x') && original.length === 42 && /^0x[0-9a-fA-F]{40}$/.test(original)) {
                    return original;
                }
                
                // Clean the input - remove all non-hex characters
                let cleanedKey = original
                    .replace(/\s+/g, '')        // Remove all whitespace
                    .replace(/\./g, '')         // Remove dots
                    .replace(/,/g, '')          // Remove commas
                    .replace(/;/g, '')          // Remove semicolons
                    .replace(/-/g, '')          // Remove hyphens
                    .replace(/[^0-9a-fA-Fx]/g, ''); // Keep only hex chars and x
                
                // Handle 0x prefix
                if (!cleanedKey.startsWith('0x') && cleanedKey.length > 0) {
                    cleanedKey = '0x' + cleanedKey;
                }
                
                // Remove duplicate 0x
                cleanedKey = cleanedKey.replace(/^0x0x+/, '0x');
                
                // Check if it's a valid address now
                if (cleanedKey.startsWith('0x') && cleanedKey.length === 42 && /^0x[0-9a-fA-F]{40}$/.test(cleanedKey)) {
                    if (cleanedKey !== original) hasChanges = true;
                    return cleanedKey;
                }
                
                // Try to convert as private key (66 chars = 0x + 64 hex)
                if (cleanedKey.length === 66) {
                    try {
                        const wallet = new ethers.Wallet(cleanedKey);
                        hasChanges = true;
                        return wallet.address;
                    } catch (error) {
                        // If conversion fails, return cleaned key
                        if (cleanedKey !== original) hasChanges = true;
                        return cleanedKey;
                    }
                }
                
                // Return cleaned version or original
                if (cleanedKey !== original && cleanedKey.length > 0) {
                    hasChanges = true;
                    return cleanedKey;
                }
                
                return original;
            });
            
            // Update textarea if changes happened
            if (hasChanges) {
                const cursorPos = receiverInput.selectionStart;
                receiverInput.value = converted.join('\n');
                receiverInput.setSelectionRange(cursorPos, cursorPos);
            }
            
            // Update count
            const keys = converted.filter(k => k.trim().length > 0);
            document.getElementById('w2wReceiverCount').textContent = `${keys.length} receiver${keys.length !== 1 ? 's' : ''}`;
            updatePreview();
        }
        
