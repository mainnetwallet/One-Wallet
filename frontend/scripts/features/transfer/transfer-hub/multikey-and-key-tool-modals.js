
        // Multi Key Native Functions
        function openMultiKeyNative() {
            // ── Multi Key own init ──
            if (!window._multiKeyBaseInit) {
                window._multiKeyBaseInit = true;
                try { if (typeof loadSavedContractsMultiKeyNative === 'function') loadSavedContractsMultiKeyNative(); } catch(_) {}
            }
                        
            // Hide all other UIs
            safeHideElement('mainDashboard');
            safeHideElement('withdrawManagerUI');
            safeHideElement('batchTransferUI');
            safeHideElement('nftTransferUI');
            safeHideElement('phraseToKeyUI');
            safeHideElement('balanceCheckUI');
            safeHideElement('tokenApprovalManagerUI');
            safeHideElement('walletToWalletUI');
            safeHideElement('selfTransferUI'); // Added missing hide!
            
            // Show multi key native UI
            safeShowElement('multiKeyNativeUI');
            
            // Save current section to localStorage
            localStorage.setItem('transferHub_currentSection', 'multiKeyNative');
            // ── Sync header chain button every time section opens ──
            if (typeof thSyncSectionHeader === 'function') thSyncSectionHeader('mkNative');
                        _thLogInitialRpc('rpcUrlMultiKeyNative', logMessageMultiKeyNative);
            
            // Re-initialize chain selector every time to show saved chain
            window.multiKeyNativeChainInitialized = false;
            if (!window.multiKeyNativeChainInitialized) {
                setupMultiKeyNativeChainSearch();
                window.multiKeyNativeChainInitialized = true;
            }
            
            // Initialize recipient balance detection if not already done
            if (!window.multiKeyNativeRecipientInitialized) {
                setupMultiKeyNativeRecipientDetection();
                window.multiKeyNativeRecipientInitialized = true;
            }
            
            // Re-initialize developer wallet detection (ensure listeners are attached)
            if (!window.multiKeyNativeDeveloperInitialized) {
                setupDeveloperWalletDetection();
                window.multiKeyNativeDeveloperInitialized = true;
            }
            
            // Trigger wallet info update if key already entered
            setTimeout(function() {
                var pkField = document.getElementById('privateKeyMultiKeyNative');
                if (pkField && pkField.value && pkField.value.trim().length > 0) {
                    updateDeveloperWalletMultiKeyNative();
                }
                var recipField = document.getElementById('recipientAddressMultiKeyNative');
                if (recipField && recipField.value && recipField.value.trim().length > 0) {
                    updateMultiKeyNativeRecipientBalance();
                }
            }, 100);

            // Re-initialize token chain selector every time to show saved chain
            window.multiKeyTokenChainInitialized = false;
            if (!window.multiKeyTokenChainInitialized) {
                setupMultiKeyTokenChainSearch();
                window.multiKeyTokenChainInitialized = true;
            }

            if (!window.multiKeyTokenRecipientInitialized) {
                setupMultiKeyTokenRecipientDetection();
                window.multiKeyTokenRecipientInitialized = true;
            }

            // Pre-set header: restore saved chain (fallback Base) immediately
            (function() {
                // ── FIX: use saved chain from localStorage, not always Base ──
                var _bc = (typeof getTHSectionChain === 'function')
                    ? getTHSectionChain('mkNative')
                    : ((typeof getAllTHChains === 'function')
                        ? (getAllTHChains().find(function(c){ return c.chainId === 8453; }) || getAllTHChains().find(function(c){ return c.name === 'Base'; }))
                        : null);
                if (_bc) {
                    if (!currentMultiKeyNativeChainConfig) {
                        var _bcRpcs = (typeof _getRpcListForChain === 'function' && _bc.chainId) ? _getRpcListForChain(_bc.chainId) : (_bc.rpcs || (_bc.rpc ? [_bc.rpc] : []));
                        if (!_bcRpcs.length) _bcRpcs = _bc.rpcs || (_bc.rpc ? [_bc.rpc] : []);
                        currentMultiKeyNativeChainConfig = { name: _bc.name, chainId: _bc.chainId, symbol: _bc.symbol, rpcs: _bcRpcs, explorer: _bc.explorer || '' };
                        currentMultiKeyTokenChainConfig = currentMultiKeyNativeChainConfig;
                        var _nRpc = document.getElementById('rpcUrlMultiKeyNative');
                        if (_nRpc) { _nRpc.value = _bcRpcs[0] || ''; _nRpc.setAttribute('data-rpcs', JSON.stringify(_bcRpcs)); _nRpc.setAttribute('data-chainid', String(_bc.chainId || '')); }
                        var _tRpc = document.getElementById('rpcUrlMultiKeyToken');
                        if (_tRpc) { _tRpc.value = _bcRpcs[0] || ''; _tRpc.setAttribute('data-rpcs', JSON.stringify(_bcRpcs)); _tRpc.setAttribute('data-chainid', String(_bc.chainId || '')); }
                    }
                    var hdrEmEl = document.getElementById('th-net-emoji-mkNative-hdr');
                    var hdrNmEl = document.getElementById('th-net-name-mkNative-hdr');
                    var cfg = currentMultiKeyNativeChainConfig;
                    if (hdrNmEl) hdrNmEl.textContent = cfg.name || 'Network';
                    if (hdrEmEl) {
                        var fullChain = (typeof getAllTHChains === 'function') ? getAllTHChains().find(function(c){ return c.chainId === cfg.chainId; }) : null;
                        var em = (typeof chainEmoji === 'function' && fullChain) ? chainEmoji(fullChain) : '🔵';
                        if (fullChain && fullChain.logoURI && typeof _chainLogoHtml === 'function') { hdrEmEl.innerHTML = _chainLogoHtml(fullChain.logoURI, em, 18); if (typeof _fixChainLogos === 'function') _fixChainLogos(hdrEmEl); }
                        else { hdrEmEl.textContent = em; }
                    }
                }
            })();
            // Show native mode by default
            switchMultiKeyMode('native');
        }

        // Toggle between Native and Token modes in unified Multi Key UI
        function switchMultiKeyMode(mode) {
            const nativeModeContent = document.getElementById('multiKeyNativeModeContent');
            const tokenModeContent = document.getElementById('multiKeyTokenModeContent');
            const nativeModeBtn = document.getElementById('multiKeyNativeModeBtn');
            const tokenModeBtn = document.getElementById('multiKeyTokenModeBtn');

            // Shared header sync — uses the single shared chain config
            function _syncMKHdr() {
                var cfg = currentMultiKeyNativeChainConfig || currentMultiKeyTokenChainConfig;
                var hdrEmEl = document.getElementById('th-net-emoji-mkNative-hdr');
                var hdrNmEl = document.getElementById('th-net-name-mkNative-hdr');
                if (!cfg) { if (hdrNmEl) hdrNmEl.textContent = 'Network'; if (hdrEmEl) hdrEmEl.textContent = '⛓️'; return; }
                if (hdrNmEl) hdrNmEl.textContent = cfg.name || 'Network';
                if (hdrEmEl) {
                    var fullChain = (typeof getAllTHChains === 'function') ? getAllTHChains().find(function(c){ return c.chainId === cfg.chainId; }) : null;
                    var em = (typeof chainEmoji === 'function' && fullChain) ? chainEmoji(fullChain) : '⛓️';
                    if (fullChain && fullChain.logoURI && typeof _chainLogoHtml === 'function') { hdrEmEl.innerHTML = _chainLogoHtml(fullChain.logoURI, em, 18); if (typeof _fixChainLogos === 'function') _fixChainLogos(hdrEmEl); }
                    else { hdrEmEl.textContent = em; }
                }
            }

            if (mode === 'native') {
                nativeModeContent.style.display = 'block';
                tokenModeContent.style.display = 'none';
                nativeModeBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                nativeModeBtn.style.color = 'white';
                nativeModeBtn.classList.add('active');
                tokenModeBtn.style.background = 'transparent';
                tokenModeBtn.style.color = '#888';
                tokenModeBtn.classList.remove('active');
                _syncMKHdr();
                                _thLogInitialRpc('rpcUrlMultiKeyNative', logMessageMultiKeyNative);
            } else {
                nativeModeContent.style.display = 'none';
                tokenModeContent.style.display = 'block';
                tokenModeBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                tokenModeBtn.style.color = 'white';
                tokenModeBtn.classList.add('active');
                nativeModeBtn.style.background = 'transparent';
                nativeModeBtn.style.color = '#888';
                nativeModeBtn.classList.remove('active');
                // Sync Token RPC from Native config (single shared chain)
                if (currentMultiKeyNativeChainConfig && !currentMultiKeyTokenChainConfig) {
                    currentMultiKeyTokenChainConfig = currentMultiKeyNativeChainConfig;
                    var _mkRpcEl = document.getElementById('rpcUrlMultiKeyToken');
                    if (_mkRpcEl) { _mkRpcEl.value = currentMultiKeyNativeChainConfig.rpcs[0] || ''; _mkRpcEl.setAttribute('data-rpcs', JSON.stringify(currentMultiKeyNativeChainConfig.rpcs)); _mkRpcEl.setAttribute('data-chainid', currentMultiKeyNativeChainConfig.chainId || ''); }
                }
                _syncMKHdr();
                                _thLogInitialRpc('rpcUrlMultiKeyToken', logMessageMultiKeyToken);
            }
        }

        function openNftTransfer() {
            try {
                                
                // Hide all other UIs safely
                hideAllUISections();
                
                // Show NFT transfer UI
                if (safeShowElement('nftTransferUI')) {
                    // Save current section to localStorage
                    localStorage.setItem('transferHub_currentSection', 'nftTransfer');
                                        _thLogInitialRpc('rpcUrlNft', logMessageNft);
                    
                    // Re-initialize chain selector every time to show saved chain
                    window.nftChainInitialized = false;
                    if (!window.nftChainInitialized) {
                        try {
                            setupNftSenderWalletDetection();
                            setupAutoFetchListeners();

                            // ── Sync saved chain to both RPC inputs ──
                            (function() {
                                var _def = (typeof getTHSectionChain === 'function')
                                    ? getTHSectionChain('nftDist')
                                    : (getAllTHChains().find(function(c){ return c.chainId === 8453; }) || getAllTHChains().find(function(c){ return c.name === 'Base'; }) || getAllTHChains()[0]);
                                if (_def) {
                                    var _rpcs = (typeof _getRpcListForChain === 'function' && _def.chainId) ? _getRpcListForChain(_def.chainId) : (_def.rpcs || [_def.rpc]);
                                    var _rpc0 = _rpcs[0] || _def.rpc || '';
                                    var _distRpc = document.getElementById('rpcUrlNft');
                                    var _collRpc = document.getElementById('rpcUrlNftCollect');
                                    if (_distRpc) { _distRpc.value = _rpc0; _distRpc.setAttribute('data-rpcs', JSON.stringify(_rpcs)); _distRpc.setAttribute('data-chainid', String(_def.chainId || '')); }
                                    if (_collRpc) { _collRpc.value = _rpc0; _collRpc.setAttribute('data-rpcs', JSON.stringify(_rpcs)); _collRpc.setAttribute('data-chainid', String(_def.chainId || '')); }
                                    // Update header btn display
                                    var _em = (typeof chainEmoji === 'function') ? chainEmoji(_def) : '⛓️';
                                    var _emEl = document.getElementById('th-net-emoji-nftDist-hdr');
                                    var _nmEl = document.getElementById('th-net-name-nftDist-hdr');
                                    if (_nmEl) _nmEl.textContent = _def.name;
                                    if (_emEl) {
                                        if (_def.logoURI && typeof _chainLogoHtml === 'function') {
                                            _emEl.innerHTML = _chainLogoHtml(_def.logoURI, _em, 18);
                                            if (typeof _fixChainLogos === 'function') _fixChainLogos(_emEl);
                                        } else { _emEl.textContent = _em; }
                                    }
                                }
                            })();

                            window.nftChainInitialized = true;
                        } catch (initError) {
                                }
                    }
                } else {
                }
            } catch (error) {
            }
        }

        function closeMultiKeyToken() {
            safeHideElement('multiKeyNativeUI');
            safeShowElement('mainDashboard');
        }

        // Phrase to Key Functions
        function openPhraseToKey() {
                        
            // Hide all other UIs
            safeHideElement('mainDashboard');
            safeHideElement('withdrawManagerUI');
            safeHideElement('batchTransferUI');
            safeHideElement('multiKeyNativeUI');
            safeHideElement('nftTransferUI');
            safeHideElement('balanceCheckUI');
            safeHideElement('tokenApprovalManagerUI');
            safeHideElement('walletToWalletUI');
            safeHideElement('selfTransferUI'); // Added missing hide!
            
            // Show phrase to key UI
            safeShowElement('phraseToKeyUI');
            
            // Default to phrase mode
            switchKeyToolMode('phrase');
            
            // Save current section to localStorage
            localStorage.setItem('transferHub_currentSection', 'phraseToKey');
                    }

        // Mode switching for Key & Address Tools
        function switchKeyToolMode(mode) {
            const phraseModeBtn = document.getElementById('phraseModeBtn');
            const keyToAddressModeBtn = document.getElementById('keyToAddressModeBtn');
            const phraseModeContent = document.getElementById('phraseModeContent');
            const keyToAddressModeContent = document.getElementById('keyToAddressModeContent');
            
            if (mode === 'phrase') {
                if (phraseModeContent) phraseModeContent.style.display = 'block';
                if (keyToAddressModeContent) keyToAddressModeContent.style.display = 'none';
                
                if (phraseModeBtn) {
                    phraseModeBtn.classList.add('active');
                    phraseModeBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                    phraseModeBtn.style.color = 'white';
                }
                if (keyToAddressModeBtn) {
                    keyToAddressModeBtn.classList.remove('active');
                    keyToAddressModeBtn.style.background = 'transparent';
                    keyToAddressModeBtn.style.color = '#888';
                }
            } else if (mode === 'keyToAddress') {
                if (phraseModeContent) phraseModeContent.style.display = 'none';
                if (keyToAddressModeContent) keyToAddressModeContent.style.display = 'block';
                
                if (keyToAddressModeBtn) {
                    keyToAddressModeBtn.classList.add('active');
                    keyToAddressModeBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                    keyToAddressModeBtn.style.color = 'white';
                }
                if (phraseModeBtn) {
                    phraseModeBtn.classList.remove('active');
                    phraseModeBtn.style.background = 'transparent';
                    phraseModeBtn.style.color = '#888';
                }
            }
        }