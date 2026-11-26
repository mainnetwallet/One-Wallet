
        // Self Transfer Functions
        function openSelfTransfer() {
                        
            // Hide all other UIs
            safeHideElement('mainDashboard');
            safeHideElement('withdrawManagerUI');
            safeHideElement('batchTransferUI');
            safeHideElement('multiKeyNativeUI');
            safeHideElement('nftTransferUI');
            safeHideElement('phraseToKeyUI');
            safeHideElement('tokenApprovalManagerUI');
            safeHideElement('walletToWalletUI');
            safeHideElement('balanceCheckUI');
            
            // Show Self Transfer UI
            safeShowElement('selfTransferUI');
            
            // Save current section to localStorage
            localStorage.setItem('transferHub_currentSection', 'selfTransfer');
            // ── Sync header chain button every time section opens ──
            if (typeof thSyncSectionHeader === 'function') thSyncSectionHeader('selfTransfer');
            initChainGridSelfTransfer();
            updateSelfTransferEstimate();
                        _thLogInitialRpc('rpcUrlSelfTransfer', logSelfTransfer);
        }

        // ── Self Transfer Execute Button Gate ────────────────────────────
        // Native mode : ≥1 key
        // Token mode  : ≥1 key + Token Contract Address filled
        // ─────────────────────────────────────────────────────────────────
        function checkSelfTransferExecuteReady() {
            const input    = (document.getElementById('privateKeysSelfTransfer')?.value || '').trim();
            const hasKeys  = input.split('\n').filter(l => l.trim()).length > 0;

            let ready;
            if (currentSelfTransferMode === 'token') {
                const tokenAddr = (document.getElementById('tokenAddressSelfTransfer')?.value || '').trim();
                ready = hasKeys && tokenAddr !== '';
            } else {
                ready = hasKeys;
            }

            const btn = document.getElementById('executeSelfTransferBtn');
            if (btn) {
                btn.disabled      = !ready;
                btn.style.opacity = ready ? '1' : '0.45';
                btn.style.cursor  = ready ? 'pointer' : 'not-allowed';
            }
        }

        function updateSelfTransferKeyCount() {
            const input = document.getElementById('privateKeysSelfTransfer').value.trim();
            const badge = document.getElementById('selfTransferKeyCount');
            
            if (!input) {
                badge.textContent = '0 wallets';
                updateSelfTransferEstimate();
                checkSelfTransferExecuteReady();
                return;
            }
            
            const keys = parseKeysFromAnyFormat(input);
            badge.textContent = `${keys.length} wallet${keys.length !== 1 ? 's' : ''}`;
            badge.style.background = keys.length > 0 ? '#2a4a2a' : '#2a2a2a';
            badge.style.color = keys.length > 0 ? '#4ade80' : '#4a9eff';
            
            updateSelfTransferEstimate();
            checkSelfTransferExecuteReady();
        }

        // Mode switching for Self Transfer
        let currentSelfTransferMode = 'native';
        
        function switchSelfTransferMode(mode) {
            currentSelfTransferMode = mode;
            
            const nativeBtn = document.getElementById('selfNativeModeBtn');
            const tokenBtn = document.getElementById('selfTokenModeBtn');
            const tokenConfig = document.getElementById('tokenConfigSelfTransfer');
            const nativeAmountGroup = document.getElementById('nativeAmountGroup');
            
            if (mode === 'native') {
                nativeBtn.classList.add('active');
                tokenBtn.classList.remove('active');
                nativeBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                nativeBtn.style.color = 'white';
                tokenBtn.style.background = 'transparent';
                tokenBtn.style.color = '#888';
                tokenConfig.style.display = 'none';
                nativeAmountGroup.style.display = 'block';
            } else {
                tokenBtn.classList.add('active');
                nativeBtn.classList.remove('active');
                tokenBtn.style.background = 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
                tokenBtn.style.color = 'white';
                nativeBtn.style.background = 'transparent';
                nativeBtn.style.color = '#888';
                tokenConfig.style.display = 'block';
                nativeAmountGroup.style.display = 'none';
            }
            
                        checkSelfTransferExecuteReady();
        }

        function updateSelfTransferEstimate() {
            const input = document.getElementById('privateKeysSelfTransfer').value.trim();
            const txPerWallet = parseInt(document.getElementById('txCountPerWallet').value) || 0;
            
            const keys = input ? parseKeysFromAnyFormat(input) : [];
            const totalTx = keys.length * txPerWallet;
            
            document.getElementById('totalTxEstimate').textContent = totalTx;
            document.getElementById('totalWalletsEstimate').textContent = keys.length;
            document.getElementById('txPerWalletEstimate').textContent = txPerWallet;
        }
