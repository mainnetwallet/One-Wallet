        
        function setupChainSearchWithdraw() {
            const searchInput = document.getElementById('chainSearchWithdraw');
            const chainGrid = document.getElementById('chainGridWithdraw');
            
            if (!searchInput || !chainGrid) {
                return;
            }
            
            // Restore saved chain for withdraw section (fallback: home chain → Base)
            const _hcIdW = (typeof activeHomeChainId !== 'undefined' && activeHomeChainId !== null) ? activeHomeChainId : null;
            const _wSaved = (typeof getTHSectionChain === 'function') ? getTHSectionChain('withdraw') : null;
            const ethChain = _wSaved || (_hcIdW ? getAllTHChains().find(c => c.chainId === _hcIdW) : null) || getAllTHChains().find(c => c.chainId === 8453) || getAllTHChains().find(c => c.name === 'Base');
            if (ethChain) {
                const _wRpcs = (typeof _getRpcListForChain === 'function' && ethChain.chainId) ? _getRpcListForChain(ethChain.chainId) : ((Array.isArray(ethChain.rpcs) && ethChain.rpcs.length) ? ethChain.rpcs : [ethChain.rpc].filter(Boolean));
                const _wRpc = _wRpcs[0] || ethChain.rpc || '';
                currentChainConfigWithdraw = {
                    name: ethChain.name,
                    chainId: ethChain.chainId,
                    symbol: ethChain.symbol,
                    rpcs: _wRpcs,
                    explorer: ethChain.explorer || ''
                };
                var _wRpcEl = document.getElementById('withdrawRpcUrl');
                if (_wRpcEl) { _wRpcEl.value = _wRpc; _wRpcEl.setAttribute('data-rpcs', JSON.stringify(_wRpcs)); _wRpcEl.setAttribute('data-chainid', String(ethChain.chainId || '')); }
                
                // Hide search input and show only selected chain
                searchInput.style.display = 'none';
                showSelectedChainOnlyWithdraw(ethChain);
                
                                            }
            
            function renderAllChainsWithdraw() {
                chainGrid.innerHTML = '';
                
                const mainnetHeader = document.createElement('div');
                mainnetHeader.className = 'chain-section-header';
                mainnetHeader.textContent = `Networks (${getAllTHChains().length})`;
                chainGrid.appendChild(mainnetHeader);
                
                getAllTHChains().forEach(chain => {
                    createChainItemWithdraw(chain);
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
                    createChainItemWithdraw(chain);
                });
                }
            }
            
            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();
                
                if (!searchTerm) {
                    renderAllChainsWithdraw();
                    return;
                }
                
                const allChains = getAllTHChains();
                const filtered = allChains.filter(chain => {
                    return chain.name.toLowerCase().includes(searchTerm) || 
                           chain.symbol.toLowerCase().includes(searchTerm);
                });
                
                renderChainsWithdraw(filtered);
            });
            
            function renderChainsWithdraw(chains) {
                chainGrid.innerHTML = '';
                
                if (chains.length === 0) {
                    chainGrid.innerHTML = '<div style="text-align: center; padding: 20px; color: #606060; font-size: 0.85rem;">No chains found</div>';
                    return;
                }
                
                chains.forEach(chain => {
                    createChainItemWithdraw(chain);
                });
            }
            
            function createChainItemWithdraw(chain) {
                const item = document.createElement('div');
                const _savedChain2 = (typeof getTHSectionChain === 'function') ? getTHSectionChain('withdraw') : null;
                const _savedName2 = _savedChain2 ? _savedChain2.name : null;
                item.className = 'chain-item' + (chain.name === _savedName2 ? ' active' : '');
                
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
                    
                    document.querySelectorAll('#chainGridWithdraw .chain-item').forEach(i => i.classList.remove('active'));
                    item.classList.add('active');

                    const _wdRpcs = (typeof _getRpcListForChain === 'function' && chain.chainId)
                        ? _getRpcListForChain(chain.chainId)
                        : ((Array.isArray(chain.rpcs) && chain.rpcs.length) ? chain.rpcs : [chain.rpc].filter(Boolean));
                    
                    currentChainConfigWithdraw = {
                        name: chain.name,
                        chainId: chain.chainId,
                        symbol: chain.symbol,
                        rpcs: _wdRpcs,
                        explorer: chain.explorer || '',
                        isCustom: chain.isCustom || false
                    };
                    
                    // For Custom Chain, leave RPC empty and show message
                    if (chain.isCustom) {
                        const _wdEl = document.getElementById('withdrawRpcUrl');
                        if (_wdEl) {
                            _wdEl.value = '';
                            _wdEl.setAttribute('data-chainid', String(chain.chainId || ''));
                            _wdEl.setAttribute('data-rpcs', '[]');
                            _wdEl.placeholder = 'Enter your custom RPC URL...';
                        }
                    } else {
                        const _wdEl = document.getElementById('withdrawRpcUrl');
                        if (_wdEl) {
                            _wdEl.value = _wdRpcs[0] || chain.rpc || '';
                            _wdEl.setAttribute('data-chainid', String(chain.chainId || ''));
                            _wdEl.setAttribute('data-rpcs', JSON.stringify(_wdRpcs));
                            _wdEl.placeholder = 'https://...';
                        }
                        // Save chain selection for this section
                        if (typeof localStorage !== 'undefined') {
                            localStorage.setItem('transferHub_chain_withdraw', String(chain.chainId));
                        }
                        // Auto-load contracts when chain is selected
                        autoLoadContracts();
                    }
                    
                    safeHideElement('customRpcUrl2GroupWithdraw');
                    
                    showSelectedChainOnlyWithdraw(chain);
                });
                
                chainGrid.appendChild(item);
            }
            
            function showSelectedChainOnlyWithdraw(chain) {
                const searchInput = document.getElementById('chainSearchWithdraw');
                const chainGrid = document.getElementById('chainGridWithdraw');
                
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
                    renderAllChainsWithdraw();
                });
                
                chainGrid.appendChild(selectedDisplay);
            }
        }

        function closeWithdrawModal() {
            // Legacy function - redirects to dashboard
            safeHideElement('withdrawManagerUI');
            safeShowElement('mainDashboard');
        }

        // Withdraw Functions
        function logMessageWithdraw(type, message, isHtml) {
            if (!_isUIVisible('withdrawManagerUI')) return;
            const logContainer = document.getElementById('logContainerWithdraw');
            if (!logContainer) return;
            
            const line = document.createElement('div');
            line.className = `log-line log-${type}`;
            
            const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
            line.innerHTML = `[${timestamp}] ${isHtml ? message : processLogMessage(message, _thGetChainIdFromRpc('withdrawRpcUrl'))}`;
            
            logContainer.appendChild(line);
            logContainer.scrollTop = logContainer.scrollHeight;
        }

        function clearLogWithdraw() {
            const logContainer = document.getElementById('logContainerWithdraw');
            if (logContainer) {
                logContainer.innerHTML = '';
                            }
        }

