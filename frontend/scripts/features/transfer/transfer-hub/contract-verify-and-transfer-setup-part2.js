
        function logMessage(type, message, isHtml) {
            if (!_isUIVisible('batchTransferUI', 'nativeModeContent')) return;
            const logContainer = document.getElementById('logContainer');
            if (!logContainer) return;
            const line = document.createElement('div');
            line.className = `log-line log-${type}`;
            
            const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
            line.innerHTML = `[${timestamp}] ${isHtml ? message : processLogMessage(message, _thGetChainIdFromRpc('rpcUrl'))}`;
            
            logContainer.appendChild(line);
            logContainer.scrollTop = logContainer.scrollHeight;
        }

        function loadSavedData() {
            // DO NOT LOAD: Addresses are not saved anymore
            // const savedAddresses = localStorage.getItem('receiverAddresses');
            // if (savedAddresses) {
            //     document.getElementById('receiverAddresses').value = savedAddresses;
            // }
        }

        async function updateRpcProvider() {
            const rpcUrl = document.getElementById('rpcUrl').value.trim();

            if (rpcUrl) {
                // Build full RPC list from chain picker + _getRpcListForChain
                let rpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('rpcUrl') : [rpcUrl];
                const chainId = parseInt((document.getElementById('rpcUrl')||{}).getAttribute?.('data-chainid')||'',10)||null;

                // Merge in all known RPCs for this chain
                if (chainId && typeof _getRpcListForChain === 'function') {
                    const chainRpcs = _getRpcListForChain(chainId);
                    rpcs = [...new Set([...rpcs, ...chainRpcs])].filter(Boolean);
                }

                // Persist full RPC list so thWithFallback can use them
                const _rpcEl = document.getElementById('rpcUrl');
                if (_rpcEl) {
                    _rpcEl.setAttribute('data-rpcs', JSON.stringify(rpcs));
                    if (chainId) _rpcEl.setAttribute('data-chainid', String(chainId));
                }

                // If currentChainConfig is null, create it now
                if (!currentChainConfig) {
                    currentChainConfig = { name: 'Custom RPC', chainId: chainId || 1, symbol: 'ETH', rpcs: rpcs, explorer: '' };
                } else {
                    currentChainConfig.rpcs = rpcs;
                    if (chainId) currentChainConfig.chainId = chainId;
                }

                try {
                    // Use thWithFallback: probe each RPC, use first that responds
                    provider = await window.thWithFallback('rpcUrl', async function(p) {
                        await Promise.race([
                            p.getBlockNumber(),
                            new Promise((_, rej) => setTimeout(() => rej(new Error('probe timeout')), 4000))
                        ]);
                        return p;
                    }, 5000);
                    // Detect actual chainId from connected provider and sync to currentChainConfig + data-chainid
                    try {
                        const _net = await provider.getNetwork();
                        const _detectedId = Number(_net.chainId);
                        if (_detectedId) {
                            const _rEl = document.getElementById('rpcUrl');
                            if (_rEl) _rEl.setAttribute('data-chainid', String(_detectedId));
                            if (currentChainConfig) {
                                currentChainConfig.chainId = _detectedId;
                                // Also update explorer if we now have a better match
                                const _mc = (typeof getAllTHChains === 'function') ? getAllTHChains().find(c => c.chainId === _detectedId) : null;
                                if (_mc && _mc.explorer) currentChainConfig.explorer = _mc.explorer;
                                if (_mc && _mc.name && currentChainConfig.name === 'Custom RPC') currentChainConfig.name = _mc.name;
                            }
                        }
                    } catch(_ne) {}
                    // Connected log handled by initializeProvider — no duplicate here
                    if (typeof checkDeployReady === 'function') checkDeployReady();
                } catch (error) {
                    if (typeof checkDeployReady === 'function') checkDeployReady();
                }
            }
        }



        function clearLog() {
            document.getElementById('logContainer').innerHTML = '';
                    }

        function setAmount(amount) {
            document.getElementById('amountPerAddress').value = amount;
            const event = new Event('input', { bubbles: true });
            document.getElementById('amountPerAddress').dispatchEvent(event);
                    }

        document.addEventListener('DOMContentLoaded', () => {
            document.getElementById('rpcUrl').addEventListener('input', updateRpcProvider);
            
            // Auto-detect token details when token address is entered
            const tokenAddressInput = document.getElementById('tokenContractAddress');
            if (tokenAddressInput) {
                let debounceTimer;
                
                // Cleanup function
                const cleanup = () => {
                    if (debounceTimer) {
                        clearTimeout(debounceTimer);
                        debounceTimer = null;
                    }
                };
                
                // Add cleanup on page unload
                window.addEventListener('beforeunload', cleanup);
                
                // Auto-detect on input only (with debouncing)
                let _tokenDetectPending = false;
                tokenAddressInput.addEventListener('input', function() {
                    clearTimeout(debounceTimer);
                    const address = this.value.trim();
                    
                    if (address && ethers.isAddress(address)) {
                        _tokenDetectPending = true;
                        debounceTimer = setTimeout(async () => {
                            _tokenDetectPending = false;
                            await detectTokenDetails();
                        }, 800);
                    } else {
                        _tokenDetectPending = false;
                    }
                });
                
                // Detect on paste (fires input event after delay)
                tokenAddressInput.addEventListener('paste', function() {
                    setTimeout(() => {
                        tokenAddressInput.dispatchEvent(new Event('input', { bubbles: true }));
                    }, 50);
                });
            }
        });

        // Menu and UI Switching Functions
        function closeAllMenus() { /* removed */ }

        // ── parseKeysFromAnyFormat ──────────────────────────────────────────────
        // Parses a multi-line text input and returns an array of normalised
        // private keys (0x + 64 hex chars) AND/OR checksummed addresses (0x + 40
        // hex chars).  Accepts keys with or without 0x prefix, comma/semicolon/
        // tab separated values, numbered lists ("1. 0x…"), JSON arrays, etc.
        function parseKeysFromAnyFormat(raw) {
            if (!raw || typeof raw !== 'string') return [];

            // Normalise separators → one item per line
            const lines = raw
                .replace(/[\t,;|]+/g, '\n')   // tabs / commas / semicolons / pipes
                .split('\n')
                .map(l => l.trim())
                // Strip leading numbering like "1." "1)" "#1"
                .map(l => l.replace(/^[\s\d]+[.)\]#\-:]+\s*/, '').trim())
                // Strip surrounding quotes / brackets
                .map(l => l.replace(/^["'`\[({]+|["'`\])}]+$/g, '').trim())
                .filter(Boolean);

            const results = [];
            const seen   = new Set();

            for (const line of lines) {
                // ── Private key (64 hex chars, with or without 0x) ──
                const hexMatch = line.match(/(?:0x)?([0-9a-fA-F]{64})(?:[^0-9a-fA-F]|$)/);
                if (hexMatch) {
                    const norm = '0x' + hexMatch[1].toLowerCase();
                    if (!seen.has(norm)) { seen.add(norm); results.push(norm); }
                    continue;
                }

                // ── Ethereum address (0x + 40 hex chars) ──
                const addrMatch = line.match(/0x[0-9a-fA-F]{40}(?:[^0-9a-fA-F]|$)/);
                if (addrMatch) {
                    const addr = addrMatch[0].slice(0, 42);
                    try {
                        const checksummed = ethers.getAddress(addr);
                        if (!seen.has(checksummed)) { seen.add(checksummed); results.push(checksummed); }
                    } catch(_) { /* invalid address — skip */ }
                    continue;
                }
            }
            return results;
        }
        // ───────────────────────────────────────────────────────────────────────

        // Helper function to safely hide UI elements
        function safeHideElement(elementId) {
            const element = document.getElementById(elementId);
            if (element) {
                element.style.display = 'none';
                return true;
            }


            function showMainDashboard() {
                const subUIs = ['batchTransferUI', 'multiKeyNativeUI', 'nftTransferUI', 'phraseToKeyUI', 'balanceCheckUI', 'tokenApprovalManagerUI', 'walletToWalletUI', 'selfTransferUI', 'withdrawManagerUI'];
                subUIs.forEach(id => safeHideElement(id));
                safeShowElement('mainDashboard');
            }
            return false;
        }
        
        function safeShowElement(elementId, displayType = 'block') {
            const element = document.getElementById(elementId);
            if (element) {
                element.style.display = displayType;
                return true;
            }
            return false;
        }

        function safeSetStyle(elementId, property, value) {
            const element = document.getElementById(elementId);
            if (element && element.style) {
                element.style[property] = value;
                return true;
            }
            return false;
        }
        
        // Hide all UI sections safely
        function hideAllUISections() {
            safeHideElement('mainDashboard');
            safeHideElement('batchTransferUI');
            safeHideElement('multiKeyNativeUI');
            safeHideElement('nftTransferUI');
            safeHideElement('phraseToKeyUI');
            safeHideElement('balanceCheckUI');
            safeHideElement('selfTransferUI');
            safeHideElement('tokenApprovalManagerUI');
            safeHideElement('withdrawManagerUI');
            safeHideElement('walletToWalletUI');
        }

        // ── Log Guard: returns true only if ALL given element IDs are currently visible ──
        // Prevents background sections from writing into each other's logs
        function _isUIVisible() {
            for (var _i = 0; _i < arguments.length; _i++) {
                var _el = document.getElementById(arguments[_i]);
                if (!_el) return false;
                // Always use computed style for reliable display check
                var _cs = window.getComputedStyle(_el);
                if (_cs.display === 'none') return false;
            }
            return true;
        }
        
        // ── _thGetSectionLogFn: maps rpcInputId → that section's log function ──
        // All log fns are function-declarations in this block so they are hoisted
        // and safe to reference here even though their source appears later.
        function _thGetSectionLogFn(rpcInputId) {
            var _m = {
                'rpcUrl':               logMessage,
                'rpcUrlToken':          logMessageToken,
                'withdrawRpcUrl':       logMessageWithdraw,
                'rpcUrlMultiKeyNative': logMessageMultiKeyNative,
                'rpcUrlMultiKeyToken':  logMessageMultiKeyToken,
                'rpcUrlNft':            logMessageNft,
                'rpcUrlNftCollect':     logMessageNft,
                'rpcUrlSelfTransfer':   logSelfTransfer,
                'rpcUrlBalanceCheck':   logBalanceCheck,
                'rpcUrlApproval':       logApproval,
                'rpcUrlMultiApproval':  logApproval,
                'rpcUrlW2W':            logW2W,
                'rpcUrlW2WToken':       logW2W,
            };
            return _m[rpcInputId] || null;
        }

        // ── _thLogInitialRpc: show active RPC in any section's log on open/mode-switch ──
        // rpcInputId : id of the hidden <input> that holds the RPC URL + data-rpcs
        // logFn      : the section's log function, e.g. logMessage, logMessageWithdraw …
        function _thLogInitialRpc(rpcInputId, logFn) {
            // Debounce: same rpcId within 2500ms → only first call fires
            if (!window._thRpcLogTs) window._thRpcLogTs = {};
            var _now = Date.now();
            if (window._thRpcLogTs[rpcInputId] && _now - window._thRpcLogTs[rpcInputId] < 2500) return;
            window._thRpcLogTs[rpcInputId] = _now;
            setTimeout(function() {
                try {
                    var rpc = (typeof window.thGetActiveRpc === 'function')
                        ? window.thGetActiveRpc(rpcInputId)
                        : null;
                    if (!rpc) {
                        var el = document.getElementById(rpcInputId);
                        rpc = el ? (el.value || '').trim() : null;
                    }
                    if (rpc) {
                        var display = rpc.replace(/^https?:\/\//, '').slice(0, 50);
                        logFn('success', '🟢 Connected: ' + display);
                    } else {
                        logFn('info', '⚪ No RPC configured — select a chain above');
                    }
                } catch(e) {}
            }, 180);
        }

        function openDashboard(fromPopstate) {
            // Hide all other UIs safely
            hideAllUISections();
            
            // Show main dashboard UI
            safeShowElement('mainDashboard');
            
            // Save current section to localStorage with namespace
            localStorage.setItem('transferHub_currentSection', 'dashboard');
        }
        
        // Back button: always return to Dashboard when on any sub-section
        

        function openBatchTransfer() {
            // ── Batch Transfer own init (runs once) ──
            if (!window._batchTransferBaseInit) {
                window._batchTransferBaseInit = true;
                try { if (typeof loadSavedData        === 'function') loadSavedData();        } catch(_) {}
                try { if (typeof loadSavedContracts   === 'function') loadSavedContracts();   } catch(_) {}
                try { if (typeof initializeProvider   === 'function') initializeProvider();   } catch(_) {}
            } else {
                // Re-entry: always re-render saved contracts to reflect current isActive state
                try { if (typeof renderSavedContracts === 'function') renderSavedContracts(); } catch(_) {}
            }
                        
            // Hide dashboard and withdraw
            safeHideElement('mainDashboard');
            safeHideElement('withdrawManagerUI');
            safeHideElement('multiKeyNativeUI');
            safeHideElement('nftTransferUI');
            safeHideElement('phraseToKeyUI');
            safeHideElement('balanceCheckUI');
            safeHideElement('tokenApprovalManagerUI');
            safeHideElement('walletToWalletUI');
            safeHideElement('selfTransferUI'); // Added missing hide!
            
            // Show unified batch transfer UI
            safeShowElement('batchTransferUI');

            // Pre-set header: restore saved chain (fallback Base) immediately
            (function() {
                // ── FIX: use saved chain from localStorage, not always Base ──
                var _bc = (typeof getTHSectionChain === 'function')
                    ? getTHSectionChain('batchNative')
                    : ((typeof getAllTHChains === 'function')
                        ? (getAllTHChains().find(function(c){ return c.chainId === 8453; }) || getAllTHChains().find(function(c){ return c.name === 'Base'; }))
                        : null);
                if (_bc) {
                    if (!currentChainConfig) {
                        var _bcRpcs = (typeof _getRpcListForChain === 'function' && _bc.chainId) ? _getRpcListForChain(_bc.chainId) : (_bc.rpcs || (_bc.rpc ? [_bc.rpc] : []));
                        if (!_bcRpcs.length) _bcRpcs = _bc.rpcs || (_bc.rpc ? [_bc.rpc] : []);
                        currentChainConfig = { name: _bc.name, chainId: _bc.chainId, symbol: _bc.symbol, rpcs: _bcRpcs, explorer: _bc.explorer || '' };
                        currentTokenChainConfig = currentChainConfig;
                        var _nRpc = document.getElementById('rpcUrl');
                        if (_nRpc) { _nRpc.value = _bcRpcs[0] || ''; _nRpc.setAttribute('data-rpcs', JSON.stringify(_bcRpcs)); _nRpc.setAttribute('data-chainid', String(_bc.chainId || '')); }
                        var _tRpc = document.getElementById('rpcUrlToken');
                        if (_tRpc) { _tRpc.value = _bcRpcs[0] || ''; _tRpc.setAttribute('data-rpcs', JSON.stringify(_bcRpcs)); _tRpc.setAttribute('data-chainid', String(_bc.chainId || '')); }
                    }
                    var hdrEmEl = document.getElementById('th-net-emoji-batchNative-hdr');
                    var hdrNmEl = document.getElementById('th-net-name-batchNative-hdr');
                    var cfg = currentChainConfig;
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
            switchBatchMode('native');
            // (removed duplicate: switchBatchMode already calls _thLogInitialRpc)

            // Initialize chain selector if not already done
            if (!window.batchNativeChainInitialized) {
                setupChainSearch();
                window.batchNativeChainInitialized = true;
            }
            
            if (!window.tokenChainInitialized) {
                setupTokenChainSearch();
                window.tokenChainInitialized = true;
            }
            
            // Save current section to localStorage
            localStorage.setItem('transferHub_currentSection', 'batchTransfer');
        }

        // Toggle between Native and Token modes in unified Batch Transfer UI
        function switchBatchMode(mode) {
            const nativeModeContent = document.getElementById('nativeModeContent');
            const tokenModeContent = document.getElementById('tokenModeContent');
            const nativeModeBtn = document.getElementById('nativeModeBtn');
            const tokenModeBtn = document.getElementById('tokenModeBtn');
            const _btWasToken = tokenModeBtn.classList.contains('active');

            // Shared header sync — single chain for both modes
            function _syncHdr() {
                var cfg = currentChainConfig || currentTokenChainConfig;
                var hdrEmEl = document.getElementById('th-net-emoji-batchNative-hdr');
                var hdrNmEl = document.getElementById('th-net-name-batchNative-hdr');
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
                _syncHdr();
                _thLogInitialRpc('rpcUrl', logMessage);

            } else {
                nativeModeContent.style.display = 'none';
                tokenModeContent.style.display = 'block';
                tokenModeBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                tokenModeBtn.style.color = 'white';
                tokenModeBtn.classList.add('active');
                nativeModeBtn.style.background = 'transparent';
                nativeModeBtn.style.color = '#888';
                nativeModeBtn.classList.remove('active');
                // Sync Token from Native config (single shared chain)
                if (currentChainConfig && !currentTokenChainConfig) {
                    currentTokenChainConfig = currentChainConfig;
                    var _tEl = document.getElementById('rpcUrlToken');
                    if (_tEl) { _tEl.value = currentChainConfig.rpcs[0] || ''; _tEl.setAttribute('data-rpcs', JSON.stringify(currentChainConfig.rpcs)); _tEl.setAttribute('data-chainid', currentChainConfig.chainId || ''); }
                }
                _syncHdr();
                                _thLogInitialRpc('rpcUrlToken', logMessageToken);
            }

            // Move the Native/Token thumb right away (no waiting for the UI sync poll)
            var _btSeg = document.querySelector('#batchTransferUI .bt-seg');
            if (_btSeg) _btSeg.setAttribute('data-mode', mode);
            var _btRoot = document.getElementById('batchTransferUI');
            if (_btRoot) _btRoot.setAttribute('data-mode', mode);

            // Slide the incoming mode in (swipe: follows the finger; tap: follows the thumb)
            var _btSwipeDir = window._btSlideDir; window._btSlideDir = null;
            if ((mode === 'token') !== _btWasToken) {
                var _btIn = mode === 'native' ? nativeModeContent : tokenModeContent;
                var _btFrom = _btSwipeDir || (mode === 'token' ? 'right' : 'left'); // side it enters from
                var _btReduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                if (!_btReduce && _btIn && _btIn.children) {
                    var _btX = _btFrom === 'right' ? 28 : -28;
                    Array.prototype.forEach.call(_btIn.children, function (c) {
                        if (c.animate) c.animate(
                            [{ opacity: 0, transform: 'translateX(' + _btX + 'px)' }, { opacity: 1, transform: 'translateX(0)' }],
                            { duration: 260, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
                        );
                    });
                }
            }
        }

        function openWithdraw() {
                        
            // Hide all other UIs
            safeHideElement('mainDashboard');
            safeHideElement('batchTransferUI');
            safeHideElement('multiKeyNativeUI');
            safeHideElement('nftTransferUI');
            safeHideElement('balanceCheckUI');
            safeHideElement('tokenApprovalManagerUI');
            safeHideElement('walletToWalletUI');
            safeHideElement('phraseToKeyUI');
            safeHideElement('selfTransferUI'); // Added missing hide!
            
            // Show withdraw manager UI
            safeShowElement('withdrawManagerUI');
            
            // Save current section to localStorage
            localStorage.setItem('transferHub_currentSection', 'withdraw');
            // ── Sync header chain button every time section opens ──
            if (typeof thSyncSectionHeader === 'function') thSyncSectionHeader('withdraw');
            // Re-initialize chain selector every time to show saved chain
            window.withdrawChainInitialized = false;
            if (!window.withdrawChainInitialized) {
                setupChainSearchWithdraw();
                window.withdrawChainInitialized = true;
            }
            
            _thLogInitialRpc('withdrawRpcUrl', logMessageWithdraw);
            // Load contracts once after section opens (debounce handles any rapid calls)
            autoLoadContracts();
        }
        
        // Chain selector setup for Withdraw Manager
        let currentChainConfigWithdraw = null;
