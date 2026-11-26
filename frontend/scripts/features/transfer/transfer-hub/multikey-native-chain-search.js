        // ========================================
        // MULTI KEY NATIVE FUNCTIONS
        // ========================================
        
        let currentMultiKeyNativeChainConfig = null;
        
        function setupMultiKeyNativeChainSearch() {
            const searchInput = document.getElementById('chainSearchMultiKeyNative');
            const chainGrid = document.getElementById('chainGridMultiKeyNative');
            
            if (!searchInput || !chainGrid) {
                return;
            }
            
            // Restore saved chain for mkNative section (fallback: home chain → Base)
            const _hcIdMKN = (typeof activeHomeChainId !== 'undefined' && activeHomeChainId !== null) ? activeHomeChainId : null;
            const _mkNSaved = (typeof getTHSectionChain === 'function') ? getTHSectionChain('mkNative') : null;
            const ethChain = _mkNSaved || (_hcIdMKN ? getAllTHChains().find(c => c.chainId === _hcIdMKN) : null) || getAllTHChains().find(c => c.chainId === 8453) || getAllTHChains().find(c => c.name === 'Base');
            const _mkNRpcs = (typeof _getRpcListForChain === 'function' && ethChain.chainId) ? _getRpcListForChain(ethChain.chainId) : ((Array.isArray(ethChain.rpcs) && ethChain.rpcs.length) ? ethChain.rpcs : [ethChain.rpc].filter(Boolean));
            const _mkNRpc = _mkNRpcs[0] || ethChain.rpc || '';
            currentMultiKeyNativeChainConfig = {
                name: ethChain.name,
                chainId: ethChain.chainId,
                symbol: ethChain.symbol,
                rpcs: _mkNRpcs,
                explorer: ethChain.explorer || ''
            };
            // Single shared chain — sync Token config and RPC too
            currentMultiKeyTokenChainConfig = currentMultiKeyNativeChainConfig;
            var _mkNRpcEl = document.getElementById('rpcUrlMultiKeyNative');
            if (_mkNRpcEl) { _mkNRpcEl.value = _mkNRpc; _mkNRpcEl.setAttribute('data-rpcs', JSON.stringify(_mkNRpcs)); _mkNRpcEl.setAttribute('data-chainid', String(ethChain.chainId || '')); }
            var _mkTRpc = document.getElementById('rpcUrlMultiKeyToken');
            if (_mkTRpc) { _mkTRpc.value = _mkNRpc; _mkTRpc.setAttribute('data-rpcs', JSON.stringify(_mkNRpcs)); _mkTRpc.setAttribute('data-chainid', String(ethChain.chainId || '')); }
            if (typeof updateButtonStates === 'function') updateButtonStates();
            
            renderAllChainsMultiKeyNative();
            
            function renderAllChainsMultiKeyNative() {
                chainGrid.innerHTML = '';
                
                const mainnetHeader = document.createElement('div');
                mainnetHeader.className = 'chain-section-header';
                mainnetHeader.textContent = `Networks (${getAllTHChains().length})`;
                chainGrid.appendChild(mainnetHeader);
                
                getAllTHChains().forEach(chain => {
                    createChainItemMultiKeyNative(chain);
                });
                
                if (testnetChains && testnetChains.length > 0) {
                const testnetHeader = document.createElement('div');
                testnetHeader.className = 'chain-section-header';
                testnetHeader.textContent = `Testnets (${testnetChains.length})`;
                testnetHeader.style.marginTop = '12px';
                chainGrid.appendChild(testnetHeader);
                }
                
                if (testnetChains && testnetChains.length > 0) {
                testnetChains.forEach(chain => {
                    createChainItemMultiKeyNative(chain);
                });
                }
            }
            
            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();
                
                if (!searchTerm) {
                    renderAllChainsMultiKeyNative();
                    return;
                }
                
                const allChains = getAllTHChains();
                const filtered = allChains.filter(chain => {
                    return chain.name.toLowerCase().includes(searchTerm) || 
                           chain.symbol.toLowerCase().includes(searchTerm);
                });
                
                renderChainsMultiKeyNative(filtered);
            });
            
            function renderChainsMultiKeyNative(chains) {
                chainGrid.innerHTML = '';
                
                if (chains.length === 0) {
                    chainGrid.innerHTML = '<div style="text-align: center; padding: 20px; color: #606060; font-size: 0.85rem;">No chains found</div>';
                    return;
                }
                
                chains.forEach(chain => {
                    createChainItemMultiKeyNative(chain);
                });
            }
            
            function createChainItemMultiKeyNative(chain) {
                const item = document.createElement('div');
                const _savedChain4 = (typeof getTHSectionChain === 'function') ? getTHSectionChain('mkNative') : null;
                const _savedName4 = _savedChain4 ? _savedChain4.name : null;
                item.className = 'chain-item' + (chain.name === _savedName4 ? ' active' : '');
                
                // Add special styling for Custom Chain
                if (chain.isCustom) {
                    item.style.background = 'linear-gradient(135deg, #1a2a1a 0%, #2a1a2a 100%)';
                    item.style.borderColor = '#f59e0b';
                }
                
                const leftContent = document.createElement('div');
                leftContent.innerHTML = `<span class="chain-name">${chain.name}</span>`;
                
                const rightContent = document.createElement('div');
                rightContent.className = 'chain-symbol';
                rightContent.textContent = chain.symbol;
                
                item.appendChild(leftContent);
                item.appendChild(rightContent);
                
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    
                    document.querySelectorAll('#chainGridMultiKeyNative .chain-item').forEach(i => i.classList.remove('active'));
                    item.classList.add('active');
                    
                    currentMultiKeyNativeChainConfig = {
                        name: chain.name,
                        chainId: chain.chainId,
                        symbol: chain.symbol,
                        rpcs: [chain.rpc],
                        explorer: chain.explorer || '',
                        isCustom: chain.isCustom || false
                    };
                    // Single shared chain — keep Token config in sync
                    currentMultiKeyTokenChainConfig = currentMultiKeyNativeChainConfig;
                    
                    // For Custom Chain, leave RPC empty
                    if (chain.isCustom) {
                        document.getElementById('rpcUrlMultiKeyNative').value = '';
                        document.getElementById('rpcUrlMultiKeyNative').placeholder = 'Enter your custom RPC URL...';
                        var _mkTRpcC = document.getElementById('rpcUrlMultiKeyToken');
                        if (_mkTRpcC) { _mkTRpcC.value = ''; _mkTRpcC.placeholder = 'Enter your custom RPC URL...'; }
                                                                        if (typeof updateButtonStates === 'function') updateButtonStates();
                    } else {
                        document.getElementById('rpcUrlMultiKeyNative').value = chain.rpc;
                        document.getElementById('rpcUrlMultiKeyNative').placeholder = 'https://...';
                        var _mkTRpcN = document.getElementById('rpcUrlMultiKeyToken');
                        if (_mkTRpcN) { _mkTRpcN.value = chain.rpc; _mkTRpcN.setAttribute('data-rpcs', JSON.stringify([chain.rpc])); _mkTRpcN.setAttribute('data-chainid', chain.chainId || ''); }
                        if (typeof updateButtonStates === 'function') updateButtonStates();
                        
                        // FIX: refresh the Developer wallet balance too (it kept a stale "RPC Error" from the previous chain/RPC)
                        if (typeof updateDeveloperWalletMultiKeyNative === 'function') updateDeveloperWalletMultiKeyNative();
                        // Update recipient balance if address is already entered
                        const recipientAddress = document.getElementById('recipientAddressMultiKeyNative')?.value.trim();
                        if (recipientAddress && ethers.isAddress(recipientAddress)) {
                            updateMultiKeyNativeRecipientBalance();
                        }
                        
                        // CRITICAL: Re-check sender keys balance if keys exist
                        const senderKeysField = document.getElementById('senderPrivateKeysMultiKeyNative');
                        if (senderKeysField && senderKeysField.value.trim()) {
                            // Trigger balance update for sender keys on new chain
                            updateSenderKeysBalanceMultiKeyNative();
                            
                        }
                    }
                    
                    safeHideElement('customRpcUrl2GroupMultiKeyNative');
                    
                    showSelectedChainOnlyMultiKeyNative(chain);
                    // Re-render saved contracts filtered by newly selected chain
                    if (typeof renderSavedContractsMultiKeyNative === 'function') renderSavedContractsMultiKeyNative();
                    
                    // Auto-select the saved contract for this chain (if any & in contract mode)
                    const _contractSection = document.getElementById('contractTransferSection');
                    const _isContractMode = _contractSection && _contractSection.style.display !== 'none';
                    if (_isContractMode && typeof savedContractsMultiKeyNative !== 'undefined') {
                        // Clear any previously active contract first
                        savedContractsMultiKeyNative.forEach(c => c.isActive = false);
                        activeContractAddressMultiKeyNative = null;
                        deployedContractAddressMultiKeyNative = null;
                        // Find first saved contract matching the newly selected chain
                        const _matchContract = savedContractsMultiKeyNative.find(c => parseInt(c.chainId || 0, 10) === parseInt(chain.chainId || 0, 10));
                        if (_matchContract) {
                            setTimeout(() => {
                                if (typeof loadContractMultiKeyNative === 'function') {
                                    loadContractMultiKeyNative(_matchContract.address);
                                }
                            }, 100);
                        } else {
                            if (typeof updateButtonStates === 'function') updateButtonStates();
                        }
                    }
                });
                
                chainGrid.appendChild(item);
            }
            
            function showSelectedChainOnlyMultiKeyNative(chain) {
                const searchInput = document.getElementById('chainSearchMultiKeyNative');
                const chainGrid = document.getElementById('chainGridMultiKeyNative');
                
                searchInput.style.display = 'none';
                chainGrid.innerHTML = '';
                
                const selectedDisplay = document.createElement('div');
                selectedDisplay.className = 'selected-chain-display';
                
                const leftContent = document.createElement('div');
                leftContent.innerHTML = `<span class="chain-name">${chain.name}</span>`;
                
                const rightContent = document.createElement('div');
                rightContent.className = 'expand-hint';
                rightContent.textContent = 'Click to change';
                
                selectedDisplay.appendChild(leftContent);
                selectedDisplay.appendChild(rightContent);
                
                selectedDisplay.addEventListener('click', (e) => {
                    e.preventDefault();
                    searchInput.style.display = 'block';
                    searchInput.value = '';
                    renderAllChainsMultiKeyNative();
                });
                
                chainGrid.appendChild(selectedDisplay);
            }
            
            // Auto-collapse on initial load - show saved/restored chain (fallback: Base)
            setTimeout(() => {
                // Use the already-restored chain (set above via getTHSectionChain) rather than
                // always overwriting with hardcoded Base. Only fall back to Base if nothing is set.
                const _restoredChain = currentMultiKeyNativeChainConfig;
                const ethChain = _restoredChain ||
                    getAllTHChains().find(c => c.chainId === 8453) ||
                    getAllTHChains().find(c => c.name === 'Base');
                if (ethChain) {
                    // Only update config if it wasn't already set by the restore logic above
                    if (!currentMultiKeyNativeChainConfig) {
                        currentMultiKeyNativeChainConfig = { name: ethChain.name, chainId: ethChain.chainId, symbol: ethChain.symbol, rpcs: (Array.isArray(ethChain.rpcs) && ethChain.rpcs.length) ? ethChain.rpcs : [ethChain.rpc].filter(Boolean), explorer: ethChain.explorer || '' };
                        currentMultiKeyTokenChainConfig = currentMultiKeyNativeChainConfig;
                        var _nRpc = document.getElementById('rpcUrlMultiKeyNative');
                        var _rpcVal = (currentMultiKeyNativeChainConfig.rpcs && currentMultiKeyNativeChainConfig.rpcs[0]) || ethChain.rpc || '';
                        if (_nRpc) { _nRpc.value = _rpcVal; _nRpc.setAttribute('data-rpcs', JSON.stringify(currentMultiKeyNativeChainConfig.rpcs || [ethChain.rpc])); _nRpc.setAttribute('data-chainid', String(ethChain.chainId || '')); }
                        var _tRpc = document.getElementById('rpcUrlMultiKeyToken');
                        if (_tRpc) { _tRpc.value = _rpcVal; _tRpc.setAttribute('data-rpcs', JSON.stringify(currentMultiKeyNativeChainConfig.rpcs || [ethChain.rpc])); _tRpc.setAttribute('data-chainid', String(ethChain.chainId || '')); }
                    }
                    showSelectedChainOnlyMultiKeyNative(currentMultiKeyNativeChainConfig || ethChain);
                    // Sync header button to the actual selected chain
                    var hdrEmEl = document.getElementById('th-net-emoji-mkNative-hdr');
                    var hdrNmEl = document.getElementById('th-net-name-mkNative-hdr');
                    var _displayChain = currentMultiKeyNativeChainConfig || ethChain;
                    if (hdrNmEl) hdrNmEl.textContent = _displayChain.name;
                    if (hdrEmEl) {
                        var em = (typeof chainEmoji === 'function') ? chainEmoji(_displayChain) : '🔵';
                        if (_displayChain.logoURI && typeof _chainLogoHtml === 'function') { hdrEmEl.innerHTML = _chainLogoHtml(_displayChain.logoURI, em, 18); if (typeof _fixChainLogos === 'function') _fixChainLogos(hdrEmEl); }
                        else { hdrEmEl.textContent = em; }
                    }
                    // Render saved contracts for the correctly restored chain
                    if (typeof renderSavedContractsMultiKeyNative === 'function') renderSavedContractsMultiKeyNative();
                }
            }, 0);
        }

