        // ========================================
        // NFT TRANSFER FUNCTIONS
        // ========================================
        
        let currentNftChainConfig = null;
        let selectedNftMode = 'distribute'; // 'distribute' or 'collect'
        
        // Logging function
        function logMessageNft(type, message, isHtml) {
            if (!_isUIVisible('nftTransferUI')) return;
            const logContainer = document.getElementById('logContainerNft');
            if (!logContainer) return;
            const timestamp = new Date().toLocaleTimeString();
            const logLine = document.createElement('div');
            logLine.className = `log-line log-${type}`;
            logLine.innerHTML = `[${timestamp}] ${isHtml ? message : processLogMessage(message, _thGetChainIdFromRpc('rpcUrlNft'))}`;
            logContainer.appendChild(logLine);
            logContainer.scrollTop = logContainer.scrollHeight;
        }
        
        function clearLogNft() {
            document.getElementById('logContainerNft').innerHTML = '';
                    }
        
        // Mode selection
        
        // ========================================
        // WALLET TO WALLET TRANSFER FUNCTIONS
        // ========================================
        
        let w2wMode = 'native'; // 'native' or 'token'
        
        // Initialize Chain Grid for W2W Token Mode
        function initChainGridW2WToken() {
            const chainGrid = document.getElementById('chainGridW2WToken');
            if (!chainGrid || chainGrid.dataset.initialized === 'true') return;
            chainGrid.dataset.initialized = 'true';
            
            // ── FIX: restore saved chain per section ──
            let selectedChain = (typeof getTHSectionChain === 'function')
                ? getTHSectionChain('w2wToken')
                : ((typeof getAllTHChains === 'function')
                    ? ((typeof activeHomeChainId !== 'undefined' && activeHomeChainId ? getAllTHChains().find(c => c.chainId === activeHomeChainId) : null) || getAllTHChains().find(c => c.chainId === 8453) || getAllTHChains().find(c => c.name === 'Base') || getAllTHChains()[0])
                    : { name: 'Base', chainId: 8453, rpc: '', symbol: 'ETH' });
            const rpcInput = document.getElementById('rpcUrlW2WToken');
            if (rpcInput) {
                const _rpcs = (typeof _getRpcListForChain === 'function' && selectedChain.chainId) ? _getRpcListForChain(selectedChain.chainId) : (selectedChain.rpcs || (selectedChain.rpc ? [selectedChain.rpc] : []));
                rpcInput.value = _rpcs[0] || selectedChain.rpc || '';
                if (selectedChain.chainId) rpcInput.setAttribute('data-chainid', selectedChain.chainId);
                if (_rpcs.length) rpcInput.setAttribute('data-rpcs', JSON.stringify(_rpcs));
            }
            
            function buildChainList(filterText = '') {
                const filter = filterText.toLowerCase();
                
                let html = '<input type="text" id="chainSearchW2WToken" placeholder="🔍 Search chains..." value="' + filterText + '" style="width: 100%; padding: 10px; margin-bottom: 8px; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 6px; color: #e0e0e0; font-size: 0.85rem;">';
                
                const filteredMainnets = getAllTHChains().filter(chain => 
                    chain.name.toLowerCase().includes(filter) || 
                    chain.symbol.toLowerCase().includes(filter)
                );
                
                if (filteredMainnets.length > 0) {
                    html += '<div class="chain-section-header">MAINNETS</div>';
                    filteredMainnets.forEach(chain => {
                        const isActive = chain.name === selectedChain.name ? 'active' : '';
                        const safeName = chain.name.replace(/'/g, "\\'").replace(/"/g, '\\"');
                        const safeRpc = chain.rpc.replace(/'/g, "\\'").replace(/"/g, '\\"');
                        const safeSymbol = chain.symbol.replace(/'/g, "\\'").replace(/"/g, '\\"');
                        html += `<div class="chain-item ${isActive}" onclick="selectChainW2WToken('${safeName}', '${safeRpc}', '${safeSymbol}')">
                            <span class="chain-name">${chain.name}</span>
                            <span class="chain-symbol">${chain.symbol}</span>
                        </div>`;
                    });
                }
                
                const filteredTestnets = testnetChains.filter(chain => 
                    chain.name.toLowerCase().includes(filter) || 
                    chain.symbol.toLowerCase().includes(filter)
                );
                
                if (filteredTestnets.length > 0) {
                    html += '<div class="chain-section-header">TESTNETS</div>';
                    filteredTestnets.forEach(chain => {
                        const isActive = chain.name === selectedChain.name ? 'active' : '';
                        const safeName = chain.name.replace(/'/g, "\\'").replace(/"/g, '\\"');
                        const safeRpc = chain.rpc.replace(/'/g, "\\'").replace(/"/g, '\\"');
                        const safeSymbol = chain.symbol.replace(/'/g, "\\'").replace(/"/g, '\\"');
                        html += `<div class="chain-item ${isActive}" onclick="selectChainW2WToken('${safeName}', '${safeRpc}', '${safeSymbol}')">
                            <span class="chain-name">${chain.name}</span>
                            <span class="chain-symbol">${chain.symbol}</span>
                        </div>`;
                    });
                }
                
                if (filteredMainnets.length === 0 && filteredTestnets.length === 0) {
                    html += '<div style="padding: 20px; text-align: center; color: #888;">No chains found</div>';
                }
                
                return html;
            }
            
            function attachSearchListener() {
                const searchInput = document.getElementById('chainSearchW2WToken');
                if (searchInput) {
                    searchInput.focus();
                    searchInput.addEventListener('input', (e) => {
                        const searchValue = e.target.value;
                        const cursorPos = e.target.selectionStart;
                        chainGrid.innerHTML = buildChainList(searchValue);
                        attachSearchListener();
                        const newSearchInput = document.getElementById('chainSearchW2WToken');
                        if (newSearchInput) {
                            newSearchInput.setSelectionRange(cursorPos, cursorPos);
                        }
                    });
                }
            }
            
            function showSelectedOnly() {
                chainGrid.innerHTML = '';
                const display = document.createElement('div');
                display.className = 'selected-chain-display';
                display.onclick = () => {
                    chainGrid.innerHTML = buildChainList('');
                    attachSearchListener();
                };
                display.innerHTML = `<div><span class="chain-name">${selectedChain.name}</span><span class="chain-symbol">${selectedChain.symbol}</span></div><span class="expand-hint">▼ Click to change</span>`;
                chainGrid.appendChild(display);
            }
            
            window.selectChainW2WToken = function(name, rpc, symbol) {
                selectedChain = { name, rpc, symbol };
                document.getElementById('rpcUrlW2WToken').value = rpc;
                showSelectedOnly();
            };
            
            showSelectedOnly();
        }
        
        // Initialize Chain Grid for W2W
        function initChainGridW2W() {
            const chainGrid = document.getElementById('chainGridW2W');
            if (!chainGrid) return;
            // Always re-render with current saved chain
            
            // ── FIX: restore saved chain per section ──
            let selectedChain = (typeof getTHSectionChain === 'function')
                ? getTHSectionChain('w2wNative')
                : ((typeof getAllTHChains === 'function')
                    ? ((typeof activeHomeChainId !== 'undefined' && activeHomeChainId ? getAllTHChains().find(c => c.chainId === activeHomeChainId) : null) || getAllTHChains().find(c => c.chainId === 8453) || getAllTHChains().find(c => c.name === 'Base') || getAllTHChains()[0])
                    : { name: 'Base', chainId: 8453, rpc: '', symbol: 'ETH' });
            const rpcInput = document.getElementById('rpcUrlW2W');
            if (rpcInput) {
                const _rpcs = (typeof _getRpcListForChain === 'function' && selectedChain.chainId) ? _getRpcListForChain(selectedChain.chainId) : (selectedChain.rpcs || (selectedChain.rpc ? [selectedChain.rpc] : []));
                rpcInput.value = _rpcs[0] || selectedChain.rpc || '';
                if (selectedChain.chainId) rpcInput.setAttribute('data-chainid', selectedChain.chainId);
                if (_rpcs.length) rpcInput.setAttribute('data-rpcs', JSON.stringify(_rpcs));
            }
            
            function buildChainList(filterText = '') {
                const filter = filterText.toLowerCase();
                
                let html = '<input type="text" id="chainSearchW2W" placeholder="🔍 Search chains..." value="' + filterText + '" style="width: 100%; padding: 10px; margin-bottom: 8px; background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 6px; color: #e0e0e0; font-size: 0.85rem;">';
                
                // Filter mainnets
                const filteredMainnets = getAllTHChains().filter(chain => 
                    chain.name.toLowerCase().includes(filter) || 
                    chain.symbol.toLowerCase().includes(filter)
                );
                
                if (filteredMainnets.length > 0) {
                    html += '<div class="chain-section-header">MAINNETS</div>';
                    filteredMainnets.forEach(chain => {
                        const isActive = chain.name === selectedChain.name ? 'active' : '';
                        const safeName = chain.name.replace(/'/g, "\\'").replace(/"/g, '\\"');
                        const safeRpc = chain.rpc.replace(/'/g, "\\'").replace(/"/g, '\\"');
                        const safeSymbol = chain.symbol.replace(/'/g, "\\'").replace(/"/g, '\\"');
                        html += `<div class="chain-item ${isActive}" onclick="selectChainW2W('${safeName}', '${safeRpc}', '${safeSymbol}')">
                            <span class="chain-name">${chain.name}</span>
                            <span class="chain-symbol">${chain.symbol}</span>
                        </div>`;
                    });
                }
                
                // Filter testnets
                const filteredTestnets = testnetChains.filter(chain => 
                    chain.name.toLowerCase().includes(filter) || 
                    chain.symbol.toLowerCase().includes(filter)
                );
                
                if (filteredTestnets.length > 0) {
                    html += '<div class="chain-section-header">TESTNETS</div>';
                    filteredTestnets.forEach(chain => {
                        const isActive = chain.name === selectedChain.name ? 'active' : '';
                        const safeName = chain.name.replace(/'/g, "\\'").replace(/"/g, '\\"');
                        const safeRpc = chain.rpc.replace(/'/g, "\\'").replace(/"/g, '\\"');
                        const safeSymbol = chain.symbol.replace(/'/g, "\\'").replace(/"/g, '\\"');
                        html += `<div class="chain-item ${isActive}" onclick="selectChainW2W('${safeName}', '${safeRpc}', '${safeSymbol}')">
                            <span class="chain-name">${chain.name}</span>
                            <span class="chain-symbol">${chain.symbol}</span>
                        </div>`;
                    });
                }
                
                if (filteredMainnets.length === 0 && filteredTestnets.length === 0) {
                    html += '<div style="padding: 20px; text-align: center; color: #888;">No chains found</div>';
                }
                
                return html;
            }
            
            function attachSearchListener() {
                const searchInput = document.getElementById('chainSearchW2W');
                if (searchInput) {
                    searchInput.focus();
                    searchInput.addEventListener('input', (e) => {
                        const searchValue = e.target.value;
                        const cursorPos = e.target.selectionStart;
                        chainGrid.innerHTML = buildChainList(searchValue);
                        attachSearchListener();
                        // Restore cursor position
                        const newSearchInput = document.getElementById('chainSearchW2W');
                        if (newSearchInput) {
                            newSearchInput.setSelectionRange(cursorPos, cursorPos);
                        }
                    });
                }
            }
            
            function showSelectedOnly() {
                chainGrid.innerHTML = '';
                const display = document.createElement('div');
                display.className = 'selected-chain-display';
                display.onclick = () => {
                    chainGrid.innerHTML = buildChainList('');
                    attachSearchListener();
                };
                display.innerHTML = `<div><span class="chain-name">${selectedChain.name}</span><span class="chain-symbol">${selectedChain.symbol}</span></div><span class="expand-hint">▼ Click to change</span>`;
                chainGrid.appendChild(display);
            }
            
            window.selectChainW2W = function(name, rpc, symbol) {
                selectedChain = { name, rpc, symbol };
                document.getElementById('rpcUrlW2W').value = rpc;
                showSelectedOnly();
            };
            
            showSelectedOnly();
        }
        
