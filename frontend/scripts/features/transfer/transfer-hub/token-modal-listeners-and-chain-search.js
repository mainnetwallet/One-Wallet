

        // Close modal when clicking outside
        document.getElementById('withdrawModal')?.addEventListener('click', function(event) {
            if (event.target === this) {
                closeWithdrawModal();
            }
        });

        document.getElementById('multiKeyTokenModal')?.addEventListener('click', function(event) {
            if (event.target === this) {
                closeMultiKeyTokenModal();
            }
        });

        // ERC20 ABI for token interaction
        const ERC20_ABI = [
            "function name() view returns (string)",
            "function symbol() view returns (string)",
            "function decimals() view returns (uint8)",
            "function balanceOf(address) view returns (uint256)",
            "function transfer(address to, uint256 amount) returns (bool)",
            "function allowance(address owner, address spender) view returns (uint256)",
            "function approve(address spender, uint256 amount) returns (bool)"
        ];

        // Token Transfer Chain Setup
        // currentTokenChainConfig is already declared globally at the top
        
        function setupTokenChainSearch() {
            const searchInput = document.getElementById('chainSearchToken');
            const chainGrid = document.getElementById('chainGridToken');
            
            if (!searchInput || !chainGrid) return;
            
            // Restore saved chain for batchToken section (fallback: Base)
            const _savedTokChain = (typeof getTHSectionChain === 'function')
                ? getTHSectionChain('batchToken')
                : (getAllTHChains().find(c => c.chainId === 8453) || getAllTHChains()[0]);
            currentTokenChainConfig = { name: _savedTokChain.name, chainId: _savedTokChain.chainId, symbol: _savedTokChain.symbol, rpcs: _savedTokChain.rpcs || [_savedTokChain.rpc], explorer: _savedTokChain.explorer || '' };
            const _tokRpcs = (typeof _getRpcListForChain === 'function' && _savedTokChain.chainId) ? _getRpcListForChain(_savedTokChain.chainId) : (_savedTokChain.rpcs || [_savedTokChain.rpc]);
            const _tokRpcEl = document.getElementById('rpcUrlToken');
            if (_tokRpcEl) { _tokRpcEl.value = (_tokRpcs[0] || _savedTokChain.rpc || ''); _tokRpcEl.setAttribute('data-rpcs', JSON.stringify(_tokRpcs)); if (_savedTokChain.chainId) _tokRpcEl.setAttribute('data-chainid', String(_savedTokChain.chainId)); }
            
            function renderAllChainsToken() {
                const allChains = getAllTHChains();
                renderChainsToken(allChains);
            }
            
            renderAllChainsToken();
            
            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase().trim();
                
                if (!searchTerm) {
                    renderAllChainsToken();
                    return;
                }
                
                const allChains = getAllTHChains();
                const filtered = allChains.filter(chain => {
                    return chain.name.toLowerCase().includes(searchTerm) || 
                           chain.symbol.toLowerCase().includes(searchTerm);
                });
                
                renderChainsToken(filtered);
            });
            
            function renderChainsToken(chains) {
                chainGrid.innerHTML = '';
                
                if (chains.length === 0) {
                    chainGrid.innerHTML = '<div style="text-align: center; padding: 20px; color: #606060; font-size: 0.85rem;">No chains found</div>';
                    return;
                }
                
                // Add Mainnet header
                const mainnetHeader = document.createElement('div');
                mainnetHeader.style.cssText = 'font-size: 0.75rem; color: #888; margin: 8px 0 4px 0; font-weight: 600; text-transform: uppercase;';
                mainnetHeader.textContent = 'Mainnet';
                chainGrid.appendChild(mainnetHeader);
                
                // Filter and display mainnets
                const mainnets = chains.filter(c => getAllTHChains().some(m => m.name === c.name));
                mainnets.forEach(chain => {
                    createChainItemToken(chain);
                });
                
                // Add Testnet header if there are testnets
                const testnets = chains.filter(c => testnetChains.some(t => t.name === c.name));
                if (testnets.length > 0) {
                    if (testnetChains && testnetChains.length > 0) {
                    const testnetHeader = document.createElement('div');
                    testnetHeader.style.cssText = 'font-size: 0.75rem; color: #888; margin: 16px 0 4px 0; font-weight: 600; text-transform: uppercase;';
                    testnetHeader.textContent = 'Testnet';
                    chainGrid.appendChild(testnetHeader);
                    }
                    
                    testnets.forEach(chain => {
                        createChainItemToken(chain);
                    });
                }
            }
            
            function createChainItemToken(chain) {
                const item = document.createElement('div');
                const _savedChain3 = (typeof getTHSectionChain === 'function') ? getTHSectionChain('batchToken') : null;
                const _savedName3 = _savedChain3 ? _savedChain3.name : null;
                item.className = 'chain-item' + (chain.name === _savedName3 ? ' active' : '');
                
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
                    
                    document.querySelectorAll('#chainGridToken .chain-item').forEach(i => i.classList.remove('active'));
                    item.classList.add('active');
                    
                    currentTokenChainConfig = {
                        name: chain.name,
                        chainId: chain.chainId,
                        symbol: chain.symbol,
                        rpcs: [chain.rpc],
                        explorer: chain.explorer || '',
                        isCustom: chain.isCustom || false
                    };

                    // ── BUG FIX: Persist selected chain so it survives page reopen ──
                    try {
                        if (chain.chainId) {
                            localStorage.setItem('transferHub_chain_batchToken', String(chain.chainId));
                        }
                    } catch(_) {}
                    
                    // For Custom Chain, leave RPC empty
                    if (chain.isCustom) {
                        document.getElementById('rpcUrlToken').value = '';
                        document.getElementById('rpcUrlToken').placeholder = 'Enter your custom RPC URL...';
                    } else {
                        document.getElementById('rpcUrlToken').value = chain.rpc;
                        document.getElementById('rpcUrlToken').placeholder = 'https://...';
                        
                        // CRITICAL: Re-check wallet balance if key exists
                        const privateKeyField = document.getElementById('privateKeyToken');
                        if (privateKeyField && privateKeyField.value.trim()) {
                            // Trigger wallet check with fresh key on new chain
                            const event = new Event('input', { bubbles: true });
                            privateKeyField.dispatchEvent(event);
                            
                        }
                    }
                    
                    safeHideElement('customRpcUrl2GroupToken');
                    
                    // Update Saved Contracts list to show only current chain's contracts
                    renderSavedContractsToken();
                    
                    showSelectedChainOnlyToken(chain);
                });
                
                chainGrid.appendChild(item);
            }
            
            function showSelectedChainOnlyToken(chain) {
                const searchInput = document.getElementById('chainSearchToken');
                const chainGrid = document.getElementById('chainGridToken');
                
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
                    renderAllChainsToken();
                });
                
                chainGrid.appendChild(selectedDisplay);
            }
            
            // ── BUG FIX: Restore saved chain (not always Base) ──
            setTimeout(() => {
                var _savedTokChainId = null;
                try { var _v = localStorage.getItem('transferHub_chain_batchToken'); if (_v) _savedTokChainId = parseInt(_v, 10) || null; } catch(_) {}
                const ethChain = (_savedTokChainId ? getAllTHChains().find(c => c.chainId === _savedTokChainId) : null)
                    || getAllTHChains().find(c => c.chainId === 8453) || getAllTHChains().find(c => c.name === 'Base');
                if (ethChain) {
                    currentTokenChainConfig = {
                        name: ethChain.name,
                        chainId: ethChain.chainId,
                        symbol: ethChain.symbol,
                        rpcs: (Array.isArray(ethChain.rpcs) && ethChain.rpcs.length) ? ethChain.rpcs : [ethChain.rpc].filter(Boolean),
                        explorer: ethChain.explorer || ''
                    };
                    document.getElementById('rpcUrlToken').value = ethChain.rpc;
                    if (document.getElementById('rpcUrlToken')) {
                        document.getElementById('rpcUrlToken').setAttribute('data-rpcs', JSON.stringify([ethChain.rpc]));
                        document.getElementById('rpcUrlToken').setAttribute('data-chainid', ethChain.chainId || '');
                    }
                    showSelectedChainOnlyToken(ethChain);
                    // Sync header chain button to Base
                    var hdrEmEl = document.getElementById('th-net-emoji-batchNative-hdr');
                    var hdrNmEl = document.getElementById('th-net-name-batchNative-hdr');
                    if (hdrNmEl) hdrNmEl.textContent = ethChain.name;
                    if (hdrEmEl) {
                        var em = (typeof chainEmoji === 'function') ? chainEmoji(ethChain) : '🔵';
                        if (ethChain.logoURI && typeof _chainLogoHtml === 'function') {
                            hdrEmEl.innerHTML = _chainLogoHtml(ethChain.logoURI, em, 18);
                            if (typeof _fixChainLogos === 'function') _fixChainLogos(hdrEmEl);
                        } else {
                            hdrEmEl.textContent = em;
                        }
                    }
                }
            }, 0);
        }