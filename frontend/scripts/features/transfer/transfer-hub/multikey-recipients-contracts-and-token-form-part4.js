
        // ========================================
        // MAX button — reads every sender key's
        //   on-chain token balance, then sets the
        //   amount to the MINIMUM non-zero balance
        //   so that every wallet can send.
        // ========================================
        // Global flag for "send all balance" mode
        window.multiKeyTokenSendAllMode = false;
        
        // Version identifier
        // Transfer Hub v3.0 initialization

        async function setMaxAmountMultiKeyToken() {
            // Simple MAX mode activation (like Native mode)
            // Balance calculation will happen during execution
            
            try {
                // Enable "Send All Balance" mode
                window.multiKeyTokenSendAllMode = true;

                const input = document.getElementById('amountPerAddressMultiKeyToken');
                if (input) {
                    input.value = 'MAX';
                    input.readOnly = true;
                    input.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
                    input.style.color = '#fff';
                    input.style.fontWeight = '700';
                    input.style.textAlign = 'center';
                    input.style.fontSize = '1.2rem';
                    input.style.letterSpacing = '0.1em';
                }

                // Update display stats
                const el = (id) => document.getElementById(id);
                if (el('perAddressDisplayMultiKeyToken')) el('perAddressDisplayMultiKeyToken').textContent = 'FULL';
                if (el('totalAmountMultiKeyToken')) el('totalAmountMultiKeyToken').textContent = 'FULL (Each Wallet)';

                // Manually trigger validation
                validateMultiKeyTokenInputs();


                
            } catch (error) {
            }
        }

        function validateKeysMultiKeyToken() {
            const privateKeysText = document.getElementById('senderKeysMultiKeyToken').value.trim();
            
            if (!privateKeysText) {
                return;
            }

            const lines = privateKeysText.split('\n').filter(line => line.trim());
            let validCount = 0;
            let invalidCount = 0;

            lines.forEach((line, index) => {
                const key = line.trim();
                if (key.startsWith('0x') && key.length === 66) {
                    validCount++;
                } else {
                    invalidCount++;
                    logMessageMultiKeyToken('error', `❌ Invalid key at line ${index + 1}`);
                }
            });

            if (invalidCount === 0) {
            } else {
                logMessageMultiKeyToken('warning', `⚠️ ${validCount} valid, ${invalidCount} invalid keys`);
            }

            updateStatsMultiKeyToken();
        }

        function validateAddressesMultiKeyToken() {
            const recipientsText = document.getElementById('recipientAddressMultiKeyToken').value.trim();
            
            if (!recipientsText) {
                return;
            }

            const lines = recipientsText.split('\n').filter(line => line.trim());
            let validCount = 0;
            let invalidCount = 0;
            let cleanedAddresses = [];

            lines.forEach((line, index) => {
                const match = line.match(/0x[a-fA-F0-9]{40}/);
                if (match) {
                    validCount++;
                    cleanedAddresses.push(match[0]);
                } else {
                    invalidCount++;
                    logMessageMultiKeyToken('error', `❌ Invalid address at line ${index + 1}`);
                }
            });

            if (invalidCount === 0) {
                // Update textarea with cleaned addresses
                document.getElementById('recipientAddressMultiKeyToken').value = cleanedAddresses.join('\n');
            } else {
                logMessageMultiKeyToken('warning', `⚠️ ${validCount} valid, ${invalidCount} invalid addresses`);
            }

            updateStatsMultiKeyToken();
        }

        function clearKeysMultiKeyToken() {
            document.getElementById('senderKeysMultiKeyToken').value = '';
            updateStatsMultiKeyToken();
        }

        function updateStatsMultiKeyToken() {
            const privateKeysText = document.getElementById('senderKeysMultiKeyToken').value.trim();
            const recipientsText = document.getElementById('recipientAddressMultiKeyToken').value.trim();
            const amount = parseFloat(document.getElementById('amountPerAddressMultiKeyToken').value || 0);
            
            const privateKeys = privateKeysText
                .split('\n')
                .map(line => line.trim())
                .filter(line => {
                    // Must not be empty
                    if (line.length === 0) return false;
                    // Must not be masked text (dots)
                    if (/^[•\s]+$/.test(line)) return false;
                    // Accept any non-empty line - no 0x validation
                    return true;
                });
            
            // Extract addresses from recipients (supports various formats)
            const recipientLines = recipientsText.split('\n').filter(line => line.trim());
            const recipientAddresses = recipientLines
                .map(line => {
                    const match = line.match(/0x[a-fA-F0-9]{40}/);
                    return match ? match[0] : null;
                })
                .filter(addr => addr !== null);
            
            const totalSenders = privateKeys.length;
            const totalRecipients = recipientAddresses.length;
            const totalAmount = totalRecipients * amount;

            document.getElementById('totalSendersMultiKeyToken').textContent = totalSenders;
            document.getElementById('totalRecipientsMultiKeyToken').textContent = totalRecipients;
            document.getElementById('perAddressDisplayMultiKeyToken').textContent = amount;
            document.getElementById('totalAmountMultiKeyToken').textContent = totalAmount.toFixed(6);
        }

        // Update stats when amount, keys, or recipients change
        document.getElementById('amountPerAddressMultiKeyToken')?.addEventListener('input', updateStatsMultiKeyToken);
        document.getElementById('recipientAddressMultiKeyToken')?.addEventListener('input', updateStatsMultiKeyToken);
        document.getElementById('senderKeysMultiKeyToken')?.addEventListener('input', updateStatsMultiKeyToken);


        function clearAllDataMultiKeyToken() {
            const clr = (id, val='') => { const el = document.getElementById(id); if (el) el.value = val; };

            // --- inline UI fields ---
            clr('senderKeysMultiKeyToken');
            clr('recipientAddressMultiKeyToken');
            clr('tokenContractAddressMultiKeyToken');
            clr('tokenSymbolMultiKeyToken');
            clr('tokenDecimalsMultiKeyToken', '18');
            clr('amountPerAddressMultiKeyToken', '0');

            // --- Reset MAX mode ---
            window.multiKeyTokenSendAllMode = false;
            const amountInput = document.getElementById('amountPerAddressMultiKeyToken');
            if (amountInput) {
                amountInput.readOnly = false;
                amountInput.style.background = '';
                amountInput.style.color = '';
                amountInput.style.fontWeight = '';
                amountInput.style.textAlign = '';
                amountInput.style.fontSize = '';
                amountInput.style.letterSpacing = '';
            }

            // --- modal UI fields (if present) ---
            clr('developerKeyMultiKeyToken');
            clr('senderKeysMultiKeyToken');
            clr('recipientAddressMultiKeyToken');
            clr('amountMultiKeyToken', '0');

            // --- hide recipient info box ---
            const recipientInfoBox = document.getElementById('recipientTokenInfoBoxMultiKeyToken');
            if (recipientInfoBox) recipientInfoBox.style.display = 'none';

            // --- reset stats & progress ---
            updateStatsMultiKeyTokenLocal();
            const prog = document.getElementById('progressFillMultiKeyToken');
            if (prog) prog.style.width = '0%';

            validateMultiKeyTokenInputs();

            const logContainer = document.getElementById('logContainerMultiKeyToken');
            if (logContainer) logContainer.innerHTML = '';
        }


        function clearLogMultiKeyToken() {
            document.getElementById('logContainerMultiKeyToken').innerHTML = '';
                    }

        // Direct Transfer Function (No Contract)
        // ========================================
        // HELPER: sanitise a raw private-key string
        //   • strips leading/trailing whitespace
        //   • removes  "  '  ,  .  /  \  characters
        //   • prepends 0x if missing
        // ========================================
        function sanitisePrivateKey(raw) {
            let k = raw.trim().replace(/[\"\'\\,\.\/\\\\]/g, '').trim();
            // Remove any existing 0x prefix first
            if (k.toLowerCase().startsWith('0x')) {
                k = k.slice(2);
            }
            // Clean and ensure it's only hex characters
            k = k.replace(/[^a-fA-F0-9]/g, '');
            // Add 0x prefix
            if (k.length === 64) {
                return '0x' + k.toLowerCase();
            }
            return k.toLowerCase(); // Return as is if length is wrong
        }