        // ========================================
        // MULTI KEY TOKEN FUNCTIONS
        // ========================================
        
        let currentMultiKeyTokenChainConfig = null;
        
        function setupMultiKeyTokenChainSearch() {
            const searchInput = document.getElementById('chainSearchMultiKeyToken');
            const chainGrid = document.getElementById('chainGridMultiKeyToken');
            
            if (!searchInput || !chainGrid) {
                return;
            }
            
            // Set default chain to Home active chain (fallback: Base)
            const _hcIdMKT = (typeof activeHomeChainId !== 'undefined' && activeHomeChainId !== null) ? activeHomeChainId : null;
            const ethChain = (_hcIdMKT ? getAllTHChains().find(c => c.chainId === _hcIdMKT) : null) || getAllTHChains().find(c => c.chainId === 8453) || getAllTHChains().find(c => c.name === 'Base');
            currentMultiKeyTokenChainConfig = {
                name: ethChain.name,
                chainId: ethChain.chainId,
                symbol: ethChain.symbol,
                rpcs: (Array.isArray(ethChain.rpcs) && ethChain.rpcs.length) ? ethChain.rpcs : [ethChain.rpc].filter(Boolean),
                explorer: ethChain.explorer || ''
            };
            document.getElementById('rpcUrlMultiKeyToken').value = ethChain.rpc;
            
            renderAllChainsMultiKeyToken();
            
            function renderAllChainsMultiKeyToken() {
                chainGrid.innerHTML = '';
                
                const mainnetHeader = document.createElement('div');
                mainnetHeader.className = 'chain-section-header';
                mainnetHeader.textContent = `Networks (${getAllTHChains().length})`;
                chainGrid.appendChild(mainnetHeader);
                
                getAllTHChains().forEach(chain => {
                    createChainItemMultiKeyToken(chain);
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
                    createChainItemMultiKeyToken(chain);
                });
                }
            }
            
            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();
                
                if (!searchTerm) {
                    renderAllChainsMultiKeyToken();
                    return;
                }
                
                const allChains = getAllTHChains();
                const filtered = allChains.filter(chain => {
                    return chain.name.toLowerCase().includes(searchTerm) || 
                           chain.symbol.toLowerCase().includes(searchTerm);
                });
                
                renderChainsMultiKeyToken(filtered);
            });
            
            function renderChainsMultiKeyToken(chains) {
                chainGrid.innerHTML = '';
                
                if (chains.length === 0) {
                    chainGrid.innerHTML = '<div style="text-align: center; padding: 20px; color: #606060; font-size: 0.85rem;">No chains found</div>';
                    return;
                }
                
                chains.forEach(chain => {
                    createChainItemMultiKeyToken(chain);
                });
            }
            
            function createChainItemMultiKeyToken(chain) {
                const item = document.createElement('div');
                const _savedChain5 = (typeof getTHSectionChain === 'function') ? getTHSectionChain('mkToken') : null;
                const _savedName5 = _savedChain5 ? _savedChain5.name : null;
                item.className = 'chain-item' + (chain.name === _savedName5 ? ' active' : '');
                
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
                    
                    document.querySelectorAll('#chainGridMultiKeyToken .chain-item').forEach(i => i.classList.remove('active'));
                    item.classList.add('active');
                    
                    currentMultiKeyTokenChainConfig = {
                        name: chain.name,
                        chainId: chain.chainId,
                        symbol: chain.symbol,
                        rpcs: [chain.rpc],
                        explorer: chain.explorer || '',
                        isCustom: chain.isCustom || false
                    };
                    
                    // For Custom Chain, leave RPC empty
                    if (chain.isCustom) {
                        document.getElementById('rpcUrlMultiKeyToken').value = '';
                        document.getElementById('rpcUrlMultiKeyToken').placeholder = 'Enter your custom RPC URL...';
                                                                    } else {
                        document.getElementById('rpcUrlMultiKeyToken').value = chain.rpc;
                        document.getElementById('rpcUrlMultiKeyToken').placeholder = 'https://...';
                    }
                    
                    safeHideElement('customRpcUrl2GroupMultiKeyToken');
                    
                    showSelectedChainOnlyMultiKeyToken(chain);
                });
                
                chainGrid.appendChild(item);
            }
            
            function showSelectedChainOnlyMultiKeyToken(chain) {
                const searchInput = document.getElementById('chainSearchMultiKeyToken');
                const chainGrid = document.getElementById('chainGridMultiKeyToken');
                
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
                    renderAllChainsMultiKeyToken();
                });
                
                chainGrid.appendChild(selectedDisplay);
            }
            
            // Auto-collapse on initial load - show saved/restored chain (fallback: Base)
            setTimeout(() => {
                // Prefer the already-set shared chain config; only fall back to Base
                const _restoredTok = currentMultiKeyNativeChainConfig || currentMultiKeyTokenChainConfig;
                const ethChain = _restoredTok ||
                    getAllTHChains().find(c => c.chainId === 8453) ||
                    getAllTHChains().find(c => c.name === 'Base');
                if (ethChain) {
                    if (!currentMultiKeyTokenChainConfig) {
                        currentMultiKeyTokenChainConfig = { name: ethChain.name, chainId: ethChain.chainId, symbol: ethChain.symbol, rpcs: (Array.isArray(ethChain.rpcs) && ethChain.rpcs.length) ? ethChain.rpcs : [ethChain.rpc].filter(Boolean), explorer: ethChain.explorer || '' };
                        var _mkRpcEl2 = document.getElementById('rpcUrlMultiKeyToken');
                        var _rpcVal2 = (currentMultiKeyTokenChainConfig.rpcs && currentMultiKeyTokenChainConfig.rpcs[0]) || ethChain.rpc || '';
                        if (_mkRpcEl2) { _mkRpcEl2.value = _rpcVal2; _mkRpcEl2.setAttribute('data-rpcs', JSON.stringify(currentMultiKeyTokenChainConfig.rpcs || [ethChain.rpc])); _mkRpcEl2.setAttribute('data-chainid', String(ethChain.chainId || '')); }
                    }
                    showSelectedChainOnlyMultiKeyToken(currentMultiKeyTokenChainConfig || ethChain);
                    // Sync header button to the actual selected chain
                    var hdrEmEl = document.getElementById('th-net-emoji-mkNative-hdr');
                    var hdrNmEl = document.getElementById('th-net-name-mkNative-hdr');
                    var _dispTok = currentMultiKeyNativeChainConfig || currentMultiKeyTokenChainConfig || ethChain;
                    if (hdrNmEl) hdrNmEl.textContent = _dispTok.name;
                    if (hdrEmEl) {
                        var em = (typeof chainEmoji === 'function') ? chainEmoji(_dispTok) : '🔵';
                        if (_dispTok.logoURI && typeof _chainLogoHtml === 'function') { hdrEmEl.innerHTML = _chainLogoHtml(_dispTok.logoURI, em, 18); if (typeof _fixChainLogos === 'function') _fixChainLogos(hdrEmEl); }
                        else { hdrEmEl.textContent = em; }
                    }
                    // Render saved contracts for correctly restored chain
                    if (typeof renderSavedContractsMultiKeyNative === 'function') renderSavedContractsMultiKeyNative();
                }
            }, 0);
        }

        function logMessageMultiKeyToken(type, message, isHtml) {
            if (!_isUIVisible('multiKeyNativeUI', 'multiKeyTokenModeContent')) return;
            const logContainer = document.getElementById('logContainerMultiKeyToken');
            if (!logContainer) return;
            
            const line = document.createElement('div');
            line.className = `log-line log-${type}`;
            
            const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
            line.innerHTML = `[${timestamp}] ${isHtml ? message : processLogMessage(message, _thGetChainIdFromRpc('rpcUrlMultiKeyToken'))}`;
            
            logContainer.appendChild(line);
            logContainer.scrollTop = logContainer.scrollHeight;
        }

        function setAmountMultiKeyToken(amount) {
            // target the inline UI input (not the old modal input)
            const input = document.getElementById('amountPerAddressMultiKeyToken');
            if (input) input.value = amount;
            updateStatsMultiKeyTokenLocal();
            validateMultiKeyTokenInputs();
        }
