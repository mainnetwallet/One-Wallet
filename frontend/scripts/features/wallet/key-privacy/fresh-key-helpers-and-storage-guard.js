        // Helper function to get FRESH private key value (never cached)
        function getFreshPrivateKey(fieldId) {
            const field = document.getElementById(fieldId);
            if (!field) return '';
            
            // Force browser to give us the ACTUAL current DOM value
            // This prevents ANY caching issues
            const freshValue = field.value;
            
            // Triple-check with data attribute
            const dataValue = field.getAttribute('data-current-value');
            
            // If values don't match, field was modified - use DOM value
            if (freshValue !== dataValue && freshValue) {
                field.setAttribute('data-current-value', freshValue);
            }
            
            // Return trimmed value
            return freshValue.trim();
        }
        
        // Helper to clear ALL cached wallet data
        function clearWalletCache() {
            window.cachedWallet = null;
            window.cachedPrivateKey = null;
            window.lastUsedKey = null;
            signer = null; // Clear global signer
            
            // Force garbage collection of any wallet objects
            if (window.gc) {
                try { window.gc(); } catch(e) {}
            }
        }
        
        // CRITICAL: Helper to get fresh wallet from current input (NEVER cached)
        function getFreshWallet(fieldId, providerInstance) {
            const freshKey = getFreshPrivateKey(fieldId);
            if (!freshKey) {
                throw new Error('Private key is required');
            }
            
            // Always create NEW wallet object with FRESH key
            try {
                const wallet = new ethers.Wallet(freshKey, providerInstance);
                return wallet;
            } catch (e) {
                throw new Error('Invalid private key: ' + e.message);
            }
        }
        
        // Override localStorage/sessionStorage setItem for private keys
        const originalSetItem = Storage.prototype.setItem;
        const originalGetItem = Storage.prototype.getItem;
        
        Storage.prototype.setItem = function(key, value) {
            // All one_ app-state keys are allowed through — they store JSON, not bare keys
            if (typeof key === 'string' && key.startsWith('one_')) {
                originalSetItem.apply(this, arguments);
                return;
            }

            // Per-section TH chain keys are allowed through
            if (typeof key === 'string' && key.startsWith('transferHub_chain_')) {
                originalSetItem.apply(this, arguments);
                return;
            }

            // Whitelist: other allowed keys
            const allowedKeys = [
                // App state
                'currentSection', 'transferHub_currentSection', 'transferHub_selectedChainId', 'lastChain',
                'theme', 'language', 'settings',
                // Contracts ONLY (no keys inside)
                'batchTransferContracts', 'batchTransferContractsToken',
                'centralContracts', 'withdrawContracts', 'multiKeyNativeContracts'
            ];

            if (allowedKeys.includes(key)) {
                originalSetItem.apply(this, arguments);
                return;
            }

            // For any other key: block bare private keys or bare mnemonics only
            const strVal = String(value).trim();
            const looksLikePrivateKey = /^(0x)?[a-f0-9]{64}$/i.test(strVal);
            const looksLikeMnemonic   = /^(\w+\s+){11,23}\w+$/.test(strVal);
            if (looksLikePrivateKey || looksLikeMnemonic) {
                console.warn('🚫 Blocked storage of sensitive data:', key);
                return;
            }

            // Allow saving safe data
            originalSetItem.apply(this, arguments);
        };
        
        // getItem: allow all one_ keys through unchanged
        Storage.prototype.getItem = function(key) {
            const value = originalGetItem.apply(this, arguments);
            return value;
        };
        
        // Manual function to clear all storage except contracts
        
        // Clear bare private keys from non-one storage on page close
        function clearPrivateKeysFromStorage() {
            try {
                const localKeys = Object.keys(localStorage);
                localKeys.forEach(key => {
                    // Never touch one_ app-state keys — they include wallet groups, caches, settings
                    if (key.startsWith('one_')) return;

                    // Never touch per-section TH chain keys
                    if (key.startsWith('transferHub_chain_')) return;

                    // Contracts whitelist — keep these
                    const keepKeys = [
                        'batchTransferContracts', 'batchTransferContractsToken',
                        'centralContracts', 'withdrawContracts', 'multiKeyNativeContracts',
                        'transferHub_currentSection', 'transferHub_selectedChainId', 'currentSection',
                        'lastChain', 'theme', 'language', 'settings'
                    ];
                    if (keepKeys.includes(key)) return;

                    // Only remove if the value is a bare private key or mnemonic
                    const value = originalGetItem.call(localStorage, key);
                    const strVal = String(value || '').trim();
                    const isBareKey  = /^(0x)?[a-f0-9]{64}$/i.test(strVal);
                    const isMnemonic = /^(\w+\s+){11,23}\w+$/.test(strVal);
                    if (isBareKey || isMnemonic) {
                        console.warn('🗑️ Cleared sensitive field from storage:', key);
                        originalSetItem.call(localStorage, key, '');
                        localStorage.removeItem(key);
                    }
                });

                sessionStorage.clear();
            } catch (e) {
                console.error('Storage cleanup error:', e);
            }
        }
        
        // Initialize auto-hide on page load
        document.addEventListener('DOMContentLoaded', () => {
            setupAutoHideForPasswordInputs();
            setupAutoHideForSenderKeys();
            // Note: clearPrivateKeysFromStorage() removed - keys stay in form until page actually closes
        });
        
        // Re-initialize when new content is added dynamically
        const observer = new MutationObserver(() => {
            setupAutoHideForPasswordInputs();
            setupAutoHideForSenderKeys();
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
