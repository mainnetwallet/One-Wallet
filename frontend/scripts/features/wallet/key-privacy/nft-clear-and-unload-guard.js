        
        // ========================================
        // CLEAR INPUT DATA BEFORE REFRESH (Keep Contracts & Section)
        // ========================================
        
        function clearInputDataBeforeRefresh() {
            try {
                // Clear private key input fields BEFORE refresh
                const privateKeyFields = [
                    'senderPrivateKeysMultiKeyNative',
                    'privateKeyMultiKeyNative',
                    'senderPrivateKey',
                    'privateKey',
                    'privateKeyToken',
                    'privateKeysSelfTransfer',
                    'senderKeysMultiKeyToken',
                    'w2wSenderKeys',
                    'w2wSenderKeysToken'
                ];
                
                privateKeyFields.forEach(fieldId => {
                    const field = document.getElementById(fieldId);
                    if (field) field.value = '';
                });
                
                // Keys that MUST be preserved
                const preservedKeys = [
                    // Contracts
                    'batchTransferContracts',
                    'batchTransferContractsToken',
                    'centralContracts',
                    'withdrawContracts',
                    'multiKeyNativeContracts',
                    // App state
                    'transferHub_currentSection',
                    'transferHub_selectedChainId',
                    'currentSection',
                    'lastChain',
                    'theme',
                    'language',
                    'settings'
                ];
                
                // Clear localStorage except preserved keys
                const localKeys = Object.keys(localStorage);
                localKeys.forEach(key => {
                    // NEVER remove one_ app-state keys (wallet groups, selection, settings, chains)
                    if (key.startsWith('one_')) return;
                    // NEVER remove per-section TH chain keys
                    if (key.startsWith('transferHub_chain_')) return;
                    if (!preservedKeys.includes(key)) {
                        localStorage.removeItem(key);
                    }
                });
                
                // Clear sessionStorage completely
                sessionStorage.clear();
            } catch (e) {
                // Silent error handling
            }
        }
        
        

        
        // ========================================
        // SERVICE WORKER FOR APK (Offline Support)
        // ========================================
        // Note: Service Workers with blob URLs are not supported in WebView/APK environments
        // This is disabled for APK compatibility. For web deployment, use an external SW file.
        
        // Detect if running in WebView/APK environment
        const isWebView = (() => {
            const ua = navigator.userAgent.toLowerCase();
            return (
                ua.includes('wv') ||
                ua.includes('webview') ||
                (window.navigator.standalone !== undefined) ||
                (!window.navigator.standalone && !ua.includes('safari'))
            );
        })();
        
        if ('serviceWorker' in navigator && !isWebView) {
            // Only attempt SW registration in standard browsers, not WebView
            window.addEventListener('load', () => {
                // Service worker disabled for APK - blob URLs not supported
                // To enable: create a separate 'sw.js' file and register it like:
                // navigator.serviceWorker.register('/sw.js')
                // APK Mode (log removed)
            });
        } else if (isWebView) {

        }
        // ========================================
        // END SERVICE WORKER
        // ========================================
        
        
        // Clear storage only when actually closing/leaving the page (not on refresh)
        window.addEventListener('beforeunload', (e) => {
            // Clear all private key input fields
            const privateKeyFields = [
                'senderPrivateKeysMultiKeyNative',
                'privateKeyMultiKeyNative',
                'senderPrivateKey',
                'privateKey',
                'privateKeyToken',
                'privateKeysSelfTransfer',
                'senderKeysMultiKeyToken',
                'w2wSenderKeys',
                'w2wSenderKeysToken'
            ];
            
            privateKeyFields.forEach(fieldId => {
                const field = document.getElementById(fieldId);
                if (field) field.value = '';
            });
            
            // Clear storage (keeps contracts & app state, removes any sensitive data)
            clearPrivateKeysFromStorage();
        });
  