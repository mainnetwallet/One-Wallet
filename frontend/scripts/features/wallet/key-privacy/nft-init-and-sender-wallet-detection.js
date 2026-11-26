
        
        // Initialize on page load
        document.addEventListener('DOMContentLoaded', () => {
            if (document.getElementById('w2wNativeModeBtn')) {
                selectW2WMode('native');
            }
            // NFT contract & sender key inputs — re-check execute button on every keystroke
            const nftFields = [
                'nftSenderKey',
                'nftContractAddress',
                'nftSenderKeys',
                'nftCollectRecipient',
                'nftContractAddressCollect'
            ];
            nftFields.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.addEventListener('input', checkNftExecuteReady);
            });
            // Initial state
            checkNftExecuteReady();

            // Token Approval fields — re-check execute button on every keystroke
            const approvalFields = [
                'tokenAddressApproval',
                'spenderAddressApproval'
            ];
            approvalFields.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.addEventListener('input', checkApprovalExecuteReady);
            });
            // Initial state
            checkApprovalExecuteReady();

            // Self Transfer token address (only relevant in token mode)
            const stTokenAddr = document.getElementById('tokenAddressSelfTransfer');
            if (stTokenAddr) stTokenAddr.addEventListener('input', checkSelfTransferExecuteReady);
            // Initial state
            checkSelfTransferExecuteReady();

            // Withdraw Manager — recipient address gates both buttons after ownership verified
            const withdrawRecipientEl = document.getElementById('withdrawRecipient');
            if (withdrawRecipientEl) withdrawRecipientEl.addEventListener('input', checkWithdrawExecuteReady);
        });
        
        // ========================================
        // NFT TRANSFER FUNCTIONS - ENHANCED WITH VISUAL SELECTOR
        // ========================================
        
        let currentNftMode = 'distribute';
        let fetchedNFTsDistribute = [];
        let fetchedNFTsCollect = [];
        let selectedNFTsDistribute = new Set();
        let selectedNFTsCollect = new Set();
        let walletNFTMapCollect = new Map();
        
                
        // NFT Sender Wallet Detection & Validation
        function setupNftSenderWalletDetection() {
            try {
                
                const privateKeyInput = document.getElementById('nftSenderKey');
                const walletInfoBox = document.getElementById('nftSenderWalletInfo');
                const addressElement = document.getElementById('nftSenderAddress');
                const statusElement = document.getElementById('nftSenderStatus');
                
                if (!privateKeyInput) {
                    
                    return;
                }
                
                if (!walletInfoBox || !addressElement || !statusElement) {
                    console.warn('⚠️ Some wallet info elements not found');
                    // Continue anyway - user can still input key
                }
                
                let validationTimeout;
                
                privateKeyInput.addEventListener('input', () => {
                    clearTimeout(validationTimeout);
                    
                    const rawKey = privateKeyInput.value.trim();
                    
                    // Hide if empty
                    if (!rawKey) {
                        if (walletInfoBox) walletInfoBox.style.display = 'none';
                        return;
                    }
                    
                    // Debounce validation
                    validationTimeout = setTimeout(() => {
                        validateAndDisplayWallet(rawKey);
                    }, 0); // Instant wallet loading
                });
                
            } catch (error) {
                // Silent error handling
            }
            
            function validateAndDisplayWallet(rawKey) {
                try {
                    // Clean the key - remove dots, spaces, and any non-hex characters
                    let cleanedKey = rawKey
                        .replace(/\./g, '')      // Remove dots
                        .replace(/\s/g, '')      // Remove spaces
                        .replace(/[^0-9a-fA-Fx]/g, ''); // Keep only hex chars and 0x
                    
                    // Normalize key - add 0x if missing
                    let normalizedKey = cleanedKey;
                    if (!normalizedKey.startsWith('0x')) {
                        normalizedKey = '0x' + normalizedKey;
                    }
                    
                    // Remove duplicate 0x if present
                    normalizedKey = normalizedKey.replace(/^0x0x/, '0x');
                    
                    // Validate key length (64 hex chars + 0x = 66 total)
                    if (normalizedKey.length !== 66) {
                        showInvalidKey(`Invalid length (got ${normalizedKey.length - 2} hex chars, need 64)`);
                        return;
                    }
                    
                    // Validate hex characters only
                    const hexPart = normalizedKey.substring(2);
                    if (!/^[0-9a-fA-F]{64}$/.test(hexPart)) {
                        showInvalidKey('Key contains invalid characters (only 0-9, a-f allowed)');
                        return;
                    }
                    
                    // Try to create wallet
                    const wallet = new ethers.Wallet(normalizedKey);
                    
                    // Success - show address
                    const addressElement = document.getElementById('nftSenderAddress');
                    const statusElement = document.getElementById('nftSenderStatus');
                    const walletInfoBox = document.getElementById('nftSenderWalletInfo');
                    
                    if (addressElement) addressElement.textContent = wallet.address;
                    if (statusElement) {
                        statusElement.textContent = '✅ Valid Key';
                        statusElement.style.color = '#10b981';
                    }
                    if (walletInfoBox) walletInfoBox.style.display = 'block';
                    
                    // Update log only if different from last logged address
                    if (!window.lastLoggedNftAddress || window.lastLoggedNftAddress !== wallet.address) {
                        window.lastLoggedNftAddress = wallet.address;
                    }
                    
                    // Auto-fetch NFTs if contract address and RPC are provided
                    autoFetchNFTsIfReady();
                    
                } catch (error) {
                    showInvalidKey(error.message);
                }
            }
            
            function showInvalidKey(reason) {
                addressElement.textContent = 'Invalid';
                statusElement.textContent = '❌ Invalid Key';
                statusElement.style.color = '#ef4444';
                walletInfoBox.style.display = 'block';
                
                // Only log once per error type to avoid spam
                if (!window.lastNftKeyError || window.lastNftKeyError !== reason) {
                    logMessageNft('warning', `⚠️ ${reason}`);
                    window.lastNftKeyError = reason;
                }
            }
            
        }
        
