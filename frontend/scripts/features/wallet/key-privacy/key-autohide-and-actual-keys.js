
// ========================================
        // AUTO-HIDE PRIVATE KEYS & PREVENT STORAGE
        // ========================================
        // Automatically hide password inputs immediately while typing
        function setupAutoHideForPasswordInputs() {
            // PASSWORD MASKING REMOVED - plain text mode
            return;
        }
        
        // ========================================
        // AUTO-HIDE SENDER PRIVATE KEYS TEXTAREA
        // ========================================
        // Global storage for actual keys (not masked)
        window.actualKeysStorage = {
            'senderKeys': '',
            'senderKeysMultiKeyToken': '',
            'senderPrivateKeysMultiKeyNative': '',
            'privateKeyToken': '',
            'privateKeyMultiKeyNative': '',
            'withdrawDeveloperKey': ''
        };
        
        // Helper function to get actual keys (use this when reading keys)
        window.getActualKeys = function(textareaId) {
            var el = document.getElementById(textareaId);
            // If the element exists and has a non-empty value, use it
            if (el && el.value && el.value.trim()) return el.value.trim();
            // If element exists but is empty, the user cleared it — return empty (don't use stale storage)
            if (el) return '';
            // Element not found — fall back to storage
            return window.actualKeysStorage[textareaId] || '';
        };
        
        function setupAutoHideForSenderKeys() {
            // AUTO-HIDE DISABLED - Keys will be shown in plain text
            // User wants to see their keys without masking
            return;
        }
        
        // ========================================
        // PREVENT PRIVATE KEY STORAGE - ENHANCED
        // ========================================
        
        // Force clear any cached input values on page load
        window.addEventListener('DOMContentLoaded', () => {
            const privateKeyFields = [
                'privateKey',
                'privateKeyToken', 
                'privateKeyMultiKeyNative',
                'senderPrivateKeysMultiKeyNative',
                'privateKeysSelfTransfer',
                'senderKeysMultiKeyToken',
                'privateKeyApproval',
                'privateKeysMultiApproval',
                'privateKeysInput',
                'nftSenderKey',
                'withdrawDeveloperKey'
            ];
            
            // Don't clear values, just prevent autocomplete/caching
            privateKeyFields.forEach(fieldId => {
                const field = document.getElementById(fieldId);
                if (field) {
                    field.setAttribute('autocomplete', 'off');
                    field.setAttribute('autocorrect', 'off');
                    field.setAttribute('autocapitalize', 'off');
                    field.setAttribute('spellcheck', 'false');
                }
            });
        });
        
        // Add input event listeners to prevent caching
        document.addEventListener('DOMContentLoaded', () => {
            const privateKeyFields = [
                'privateKey',
                'privateKeyToken', 
                'privateKeyMultiKeyNative',
                'senderPrivateKeysMultiKeyNative',
                'privateKeysSelfTransfer',
                'senderKeysMultiKeyToken',
                'privateKeyApproval',
                'privateKeysMultiApproval',
                'privateKeysInput',
                'nftSenderKey',
                'withdrawDeveloperKey'
            ];
            
            privateKeyFields.forEach(fieldId => {
                const field = document.getElementById(fieldId);
                if (field) {
                    // Force immediate update on ANY key press
                    field.addEventListener('input', function(e) {
                        // Store current value in data attribute
                        this.setAttribute('data-current-value', this.value);
                        
                        // Clear any cached wallet objects (if they exist)
                        window.cachedWallet = null;
                        window.cachedPrivateKey = null;
                        
                        // Force re-validation on next transaction
                        this.setAttribute('data-modified', 'true');
                    });
                    
                    // Also handle paste events
                    field.addEventListener('paste', function(e) {
                        setTimeout(() => {
                            this.setAttribute('data-current-value', this.value);
                            window.cachedWallet = null;
                            window.cachedPrivateKey = null;
                        }, 0);
                    });
                    
                    // Handle manual changes
                    field.addEventListener('change', function() {
                        this.setAttribute('data-current-value', this.value);
                        window.cachedWallet = null;
                        window.cachedPrivateKey = null;
                    });
                }
            });
        });
        
