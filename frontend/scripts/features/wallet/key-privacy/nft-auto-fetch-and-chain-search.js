        // Auto-fetch NFTs when all fields are ready - DISABLED
        function autoFetchNFTsIfReady() {
            // Auto-fetch disabled - user must click Fetch button manually
            return;
        }
        
        // Setup listeners for auto-fetch on contract address and RPC changes - DISABLED
        function setupAutoFetchListeners() {
            // Auto-fetch listeners disabled - manual fetch only
            return;
        }
        
        // Setup NFT Chain Search
        function setupNftChainSearch() {
            const searchInput = document.getElementById('chainSearchNft');
            const chainGrid = document.getElementById('chainGridNft');
            const rpcInput = document.getElementById('rpcUrlNft');
            
            if (!searchInput || !chainGrid) {
                return;
            }
            
            // ── FIX: restore saved chain per section ──
            let selectedChain = (typeof getTHSectionChain === 'function')
                ? getTHSectionChain('nftDist')
                : (getAllTHChains().find(c => c.chainId === 8453) || getAllTHChains().find(c => c.name === 'Base') || getAllTHChains()[0]);
            
            // Build chain list HTML
            function buildChainList() {
                let html = '<div class="chain-section-header">Mainnets (' + getAllTHChains().length + ')</div>';
                
                getAllTHChains().forEach(chain => {
                    html += `<div class="chain-item" data-chain-name="${oneSanitize(chain.name)}" data-chain-rpc="${oneSanitize(chain.rpc)}" data-chain-symbol="${oneSanitize(chain.symbol)}" onclick="selectChainNft(this.dataset.chainName, this.dataset.chainRpc, this.dataset.chainSymbol)">
                        <div><span class="chain-name">${oneSanitize(chain.name)}</span></div>
                        <div class="chain-symbol">${oneSanitize(chain.symbol)}</div>
                    </div>`;
                });
                
                if (testnetChains && testnetChains.length > 0) {
                html += '<div class="chain-section-header" style="margin-top: 12px;">Testnets (' + testnetChains.length + ')</div>';
                }
                
                if (testnetChains && testnetChains.length > 0) {
                testnetChains.forEach(chain => {
                    html += `<div class="chain-item" data-chain-name="${oneSanitize(chain.name)}" data-chain-rpc="${oneSanitize(chain.rpc)}" data-chain-symbol="${oneSanitize(chain.symbol)}" onclick="selectChainNft(this.dataset.chainName, this.dataset.chainRpc, this.dataset.chainSymbol)">
                        <div><span class="chain-name">${oneSanitize(chain.name)}</span></div>
                        <div class="chain-symbol">${oneSanitize(chain.symbol)}</div>
                    </div>`;
                });
                }
                
                return html;
            }
            
            // Show only selected chain (collapsed state)
            function showSelectedOnly() {
                chainGrid.innerHTML = '';
                chainGrid.style.maxHeight = 'none';
                chainGrid.style.overflow = 'visible';
                chainGrid.style.border = 'none';
                chainGrid.style.background = 'transparent';
                
                const display = document.createElement('div');
                display.className = 'selected-chain-display';
                display.onclick = toggleChainListNft;
                display.innerHTML = `
                    <div>
                        <span class="chain-name">${oneSanitize(selectedChain.name)}</span>
                        <span class="chain-symbol">${oneSanitize(selectedChain.symbol)}</span>
                    </div>
                    <span class="expand-hint">▼ Click to change</span>
                `;
                chainGrid.appendChild(display);
                
                if (searchInput) searchInput.style.display = 'none';
            }
            
            // Show all chains (expanded state)
            function showAllChains() {
                chainGrid.innerHTML = buildChainList();
                chainGrid.style.maxHeight = '250px';
                chainGrid.style.overflow = 'auto';
                chainGrid.style.border = '1px solid #2a2a2a';
                chainGrid.style.background = '#0f0f0f';
                
                if (searchInput) {
                    searchInput.style.display = 'block';
                    searchInput.value = '';
                }
            }
            
            // Toggle between selected and all chains
            window.toggleChainListNft = function() {
                if (chainGrid.querySelector('.selected-chain-display')) {
                    showAllChains();
                }
            };
            
            // Update selectChain to save selection and collapse
            window.selectChainNft = function(name, rpc, symbol) {
                selectedChain = { name, rpc, symbol };
                rpcInput.value = rpc;
                showSelectedOnly();
            };
            
            // Search functionality
            if (searchInput) {
                searchInput.addEventListener('input', function() {
                    const searchTerm = this.value.toLowerCase();
                    const items = chainGrid.querySelectorAll('.chain-item');
                    items.forEach(item => {
                        const text = item.textContent.toLowerCase();
                        item.style.display = text.includes(searchTerm) ? 'flex' : 'none';
                    });
                });
            }
            
            // Set default RPC
            if (rpcInput) {
                rpcInput.value = selectedChain.rpc;
            }
            
            // Initialize with selected chain only
            showSelectedOnly();
        }
        
        // Setup NFT Chain Search for Collect Mode
        function setupNftChainSearchCollect() {
            const searchInput = document.getElementById('chainSearchNftCollect');
            const chainGrid = document.getElementById('chainGridNftCollect');
            const rpcInput = document.getElementById('rpcUrlNftCollect');
            
            if (!chainGrid) {
                return;
            }
            
            // FIX: restore saved chain per section, not always Base
            let selectedChain = (typeof getTHSectionChain === 'function')
                ? getTHSectionChain('nftCollect')
                : (getAllTHChains().find(c => c.chainId === 8453) || getAllTHChains().find(c => c.name === 'Base') || getAllTHChains()[0]);
            
            // Build chain list HTML
            function buildChainList() {
                let html = '<div class="chain-section-header">Mainnets (' + getAllTHChains().length + ')</div>';
                
                getAllTHChains().forEach(chain => {
                    html += `<div class="chain-item" data-chain-name="${oneSanitize(chain.name)}" data-chain-rpc="${oneSanitize(chain.rpc)}" data-chain-symbol="${oneSanitize(chain.symbol)}" onclick="selectChainNftCollect(this.dataset.chainName, this.dataset.chainRpc, this.dataset.chainSymbol)">
                        <div><span class="chain-name">${oneSanitize(chain.name)}</span></div>
                        <div class="chain-symbol">${oneSanitize(chain.symbol)}</div>
                    </div>`;
                });
                
                if (testnetChains && testnetChains.length > 0) {
                html += '<div class="chain-section-header" style="margin-top: 12px;">Testnets (' + testnetChains.length + ')</div>';
                }
                
                if (testnetChains && testnetChains.length > 0) {
                testnetChains.forEach(chain => {
                    html += `<div class="chain-item" data-chain-name="${oneSanitize(chain.name)}" data-chain-rpc="${oneSanitize(chain.rpc)}" data-chain-symbol="${oneSanitize(chain.symbol)}" onclick="selectChainNftCollect(this.dataset.chainName, this.dataset.chainRpc, this.dataset.chainSymbol)">
                        <div><span class="chain-name">${oneSanitize(chain.name)}</span></div>
                        <div class="chain-symbol">${oneSanitize(chain.symbol)}</div>
                    </div>`;
                });
                }
                
                return html;
            }
            
            // Show only selected chain (collapsed state)
            function showSelectedOnly() {
                chainGrid.innerHTML = '';
                chainGrid.style.maxHeight = 'none';
                chainGrid.style.overflow = 'visible';
                chainGrid.style.border = 'none';
                chainGrid.style.background = 'transparent';
                
                const display = document.createElement('div');
                display.className = 'selected-chain-display';
                display.onclick = toggleChainListNftCollect;
                display.innerHTML = `
                    <div>
                        <span class="chain-name">${oneSanitize(selectedChain.name)}</span>
                        <span class="chain-symbol">${oneSanitize(selectedChain.symbol)}</span>
                    </div>
                    <span class="expand-hint">▼ Click to change</span>
                `;
                chainGrid.appendChild(display);
                
                if (searchInput) searchInput.style.display = 'none';
            }
            
            // Show all chains (expanded state)
            function showAllChains() {
                chainGrid.innerHTML = buildChainList();
                chainGrid.style.maxHeight = '250px';
                chainGrid.style.overflow = 'auto';
                chainGrid.style.border = '1px solid #2a2a2a';
                chainGrid.style.background = '#0f0f0f';
                
                if (searchInput) {
                    searchInput.style.display = 'block';
                    searchInput.value = '';
                }
            }
            
            // Toggle between selected and all chains
            window.toggleChainListNftCollect = function() {
                if (chainGrid.querySelector('.selected-chain-display')) {
                    showAllChains();
                }
            };
            
            // Update selectChain to save selection and collapse
            window.selectChainNftCollect = function(name, rpc, symbol) {
                selectedChain = { name, rpc, symbol };
                if (rpcInput) rpcInput.value = rpc;
                showSelectedOnly();
            };
            
            // Search functionality
            if (searchInput) {
                searchInput.addEventListener('input', function() {
                    const searchTerm = this.value.toLowerCase();
                    const items = chainGrid.querySelectorAll('.chain-item');
                    items.forEach(item => {
                        const text = item.textContent.toLowerCase();
                        item.style.display = text.includes(searchTerm) ? 'flex' : 'none';
                    });
                });
            }
            
            // Set default RPC
            if (rpcInput) {
                rpcInput.value = selectedChain.rpc;
            }
            
            // Initialize with selected chain only
            showSelectedOnly();
            
        }
        
