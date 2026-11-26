

        // ========================================
        // HELPER: detect whether a string is a
        //   private key (64 hex chars after 0x)
        //   or an address (40 hex chars after 0x)
        // ========================================
        function classifyInput(raw) {
            const cleaned = raw.trim().replace(/[\"\'\\,\.\/\\\\]/g, '').trim();
            // strip optional 0x
            const hex = cleaned.startsWith('0x') || cleaned.startsWith('0X')
                ? cleaned.slice(2) : cleaned;
            if (/^[a-fA-F0-9]{64}$/.test(hex)) return 'key';
            if (/^[a-fA-F0-9]{40}$/.test(hex)) return 'address';
            return 'unknown';
        }

        // ========================================
        // HELPER: resolve recipient input →
        //   guaranteed valid 0x… address string
        //   Returns null if unresolvable.
        // ========================================
        function resolveRecipientAddress(raw) {
            const type = classifyInput(raw);
            if (type === 'key') {
                try {
                    const key = sanitisePrivateKey(raw);
                    const wallet = new ethers.Wallet(key);
                    return wallet.address;
                } catch { return null; }
            }
            if (type === 'address') {
                let cleaned = raw.trim().replace(/[\"\'\\,\.\/\\\\]/g, '').trim();
                if (!cleaned.startsWith('0x') && !cleaned.startsWith('0X')) cleaned = '0x' + cleaned;
                try {
                    return ethers.getAddress(cleaned); // checksum
                } catch { return null; }
            }
            return null;
        }

        // ========================================
        // VALIDATE & CLEAN sender keys textarea
        //   (bound to the Validate Keys button)
        // ========================================
        // Debounce timer for validation to prevent multiple rapid calls
        let validateSenderKeysTimeout = null;
        let lastValidatedKeysHash = null;
        
        // Auto-validation with debounce for Token mode
        let tokenKeyValidationTimer = null;
        function autoValidateTokenKeys() {
            // Clear previous timer
            if (tokenKeyValidationTimer) {
                clearTimeout(tokenKeyValidationTimer);
            }
            
            // Update button states immediately on every keystroke
            if (typeof validateMultiKeyTokenInputs === 'function') validateMultiKeyTokenInputs();
            
            // Set new timer - validate after 0.1 second of no typing
            tokenKeyValidationTimer = setTimeout(() => {
                validateAndCleanSenderKeys();
                // Re-check after clean
                if (typeof validateMultiKeyTokenInputs === 'function') validateMultiKeyTokenInputs();
            }, 100);
        }
        
        function validateAndCleanSenderKeys() {
            const ta = document.getElementById('senderKeysMultiKeyToken');
            const raw = ta.value.trim();
            
            if (!raw) {
                return;
            }

            // Create a simple hash of the input to detect if it's actually changed
            const currentHash = raw.length + '_' + raw.substring(0, 50);
            if (currentHash === lastValidatedKeysHash) {
                // Same input, skip validation to prevent duplicate logs
                return;
            }
            lastValidatedKeysHash = currentHash;

            const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            const cleaned = [];
            let validCount = 0, invalidCount = 0;

            lines.forEach((line, idx) => {
                const sanitised = sanitisePrivateKey(line);
                // A valid private key: either "0x" + 64 hex chars OR just 64 hex chars
                const isValid = /^0x[a-f0-9]{64}$/.test(sanitised) || /^[a-f0-9]{64}$/.test(sanitised);
                
                if (isValid) {
                    // extra check: ethers can actually create a wallet
                    try {
                        // Add 0x if missing for ethers.js validation
                        const keyForValidation = sanitised.startsWith('0x') ? sanitised : '0x' + sanitised;
                        new ethers.Wallet(keyForValidation);
                        cleaned.push(sanitised); // Store original format from user
                        validCount++;
                    } catch {
                        logMessageMultiKeyToken('error', `❌ Line ${idx + 1}: key format OK but invalid key`);
                        invalidCount++;
                    }
                } else {
                    logMessageMultiKeyToken('error', `❌ Line ${idx + 1}: not a valid private key - removed`);
                    invalidCount++;
                }
            });

            // Update the actual keys storage directly (this will keep them hidden)
            if (window.actualKeysStorage) {
                window.actualKeysStorage['senderKeysMultiKeyToken'] = cleaned.join('\n');
            }
            
            // REPLACE THE TEXTAREA - Remove invalid words, keep only valid keys
            ta.value = cleaned.join('\n');
            
            updateStatsMultiKeyTokenLocal();

            if (invalidCount === 0) {
            } else {
                logMessageMultiKeyToken('warning', `⚠️ ${validCount} valid, ${invalidCount} invalid keys removed from textarea`);
            }
        }

        // ========================================
        // UPDATE stats (sender count / per-wallet / total)
        //   for the inline UI (not the modal)
        // ========================================
        function updateStatsMultiKeyTokenLocal() {
            const ta = document.getElementById('senderKeysMultiKeyToken');
            const amountInput = document.getElementById('amountPerAddressMultiKeyToken');
            if (!ta || !amountInput) return;

            const keys = ta.value.trim().split('\n')
                .map(l => l.trim())
                .filter(l => {
                    // Must not be empty
                    if (l.length === 0) return false;
                    // Must not be masked text (dots)
                    if (/^[•\s]+$/.test(l)) return false;
                    // Accept any non-empty line - no 0x validation
                    return true;
                });
            const el = (id) => document.getElementById(id);
            
            // Check if MAX mode is enabled
            if (window.multiKeyTokenSendAllMode) {
                // In MAX mode, don't recalculate - keep the values set by setMaxAmountMultiKeyToken
                if (el('totalSendersMultiKeyToken')) el('totalSendersMultiKeyToken').textContent = keys.length;
                // perAddressDisplayMultiKeyToken and totalAmountMultiKeyToken are already set by MAX button
                return;
            }
            
            // Normal mode calculation
            const amount = parseFloat(amountInput.value) || 0;
            const total = keys.length * amount;

            if (el('totalSendersMultiKeyToken'))       el('totalSendersMultiKeyToken').textContent = keys.length;
            if (el('perAddressDisplayMultiKeyToken'))   el('perAddressDisplayMultiKeyToken').textContent = amount;
            if (el('totalAmountMultiKeyToken'))         el('totalAmountMultiKeyToken').textContent = total.toFixed(6);
        }

        // live stats update listeners (inline UI)
        (function attachInlineListeners() {
            const amountInput = document.getElementById('amountPerAddressMultiKeyToken');
            
            // Reset MAX mode when user manually changes amount
            if (amountInput) {
                amountInput.addEventListener('focus', () => {
                    if (window.multiKeyTokenSendAllMode) {
                        window.multiKeyTokenSendAllMode = false;
                        amountInput.value = '';
                        amountInput.readOnly = false;
                        amountInput.style.background = '';
                        amountInput.style.color = '';
                        amountInput.style.fontWeight = '';
                        amountInput.style.textAlign = '';
                                            }
                });
            }
            
            ['senderKeysMultiKeyToken', 'amountPerAddressMultiKeyToken'].forEach(id => {
                document.getElementById(id)?.addEventListener('input', () => {
                    updateStatsMultiKeyTokenLocal();
                    validateMultiKeyTokenInputs();
                });
            });
        })();

        // ========================================
        // RECIPIENT INPUT — live key/address detection
        //   If a private key is pasted the address
        //   badge appears and the hidden real-address
        //   field is filled.
        // ========================================
        (function attachRecipientDetection() {
            const input = document.getElementById('recipientAddressMultiKeyToken');
            if (!input) return;

            // guard: programmatic .value set fires 'input' again — skip it
            let skipNext = false;

            input.addEventListener('input', function () {
                if (skipNext) { skipNext = false; return; }

                const raw = this.value.trim();

                // badge is no longer used — always hidden
                const badge  = document.getElementById('recipientDerivedBadge');
                const derived = document.getElementById('recipientDerivedAddress');
                if (badge)   badge.style.display = 'none';
                if (derived) derived.textContent  = '-';

                if (!raw) {
                    validateMultiKeyTokenInputs();
                    updateMultiKeyTokenRecipientBalance();
                    return;
                }

                // ── key pasted → derive address, replace in-place ──
                if (classifyInput(raw) === 'key') {
                    const addr = resolveRecipientAddress(raw);
                    if (addr) {
                        skipNext   = true;   // ignore the next synthetic 'input'
                        this.value = addr;   // replace key with the derived address

                        // brief green flash so user knows the swap happened
                        this.style.borderColor = '#43e97b';
                        this.style.boxShadow  = '0 0 0 3px rgba(67,233,123,0.25)';
                        setTimeout(() => {
                            this.style.borderColor = '';
                            this.style.boxShadow  = '';
                        }, 1200);
                    }
                }

                validateMultiKeyTokenInputs();
                clearTimeout(window._recipientDebounce);
                window._recipientDebounce = setTimeout(() => {
                    updateMultiKeyTokenRecipientBalance();
                }, 600);
            });
        })();