        
        // ========================================
        // TOKEN APPROVAL MANAGER FUNCTIONS
        // ========================================
        
        let approvalProvider = null;
        let multiApprovalProvider = null;
        let revokeProvider = null;
        let foundApprovals = [];
        
        // Use existing ERC20_ABI - no need to redeclare
        
        // === SINGLE WALLET APPROVAL ===
        
        function initChainGridApproval() {
            const chainGrid = document.getElementById('chainGridApproval');
            if (!chainGrid) return;
            // Always re-render with current saved chain
            
            // ── FIX: restore saved chain per section ──
            let selectedChain = (typeof getTHSectionChain === 'function')
                ? getTHSectionChain('approval')
                : (getAllTHChains().find(c => c.chainId === 8453) || getAllTHChains().find(c => c.name === 'Base') || { name: 'Base', chainId: 8453, rpc: 'https://mainnet.base.org', symbol: 'ETH' });
            let searchTerm = '';
            const rpcInput = document.getElementById('rpcUrlApproval');
            if (rpcInput) {
                const _rpcs = (typeof _getRpcListForChain === 'function' && selectedChain.chainId) ? _getRpcListForChain(selectedChain.chainId) : (selectedChain.rpcs || (selectedChain.rpc ? [selectedChain.rpc] : []));
                rpcInput.value = _rpcs[0] || selectedChain.rpc || '';
                rpcInput.setAttribute('data-rpcs', JSON.stringify(_rpcs));
                if (selectedChain.chainId) rpcInput.setAttribute('data-chainid', String(selectedChain.chainId));
            }
            
            function buildChainList() {
                const allChains = getAllTHChains();
                const filteredChains = searchTerm 
                    ? allChains.filter(c => 
                        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        c.symbol.toLowerCase().includes(searchTerm.toLowerCase()))
                    : allChains;
                
                let html = `<div style="position: sticky; top: 0; background: #1a1a1a; z-index: 10; padding: 8px; border-bottom: 1px solid #2a2a2a;">
                    <input type="text" 
                        placeholder="🔍 Search chains..." 
                        value="${searchTerm}"
                        oninput="window.updateChainSearchApproval(this.value)"
                        style="width: 100%; padding: 8px 12px; background: #0a0a0a; border: 1px solid #2a2a2a; border-radius: 6px; color: #e0e0e0; font-size: 0.85rem;"
                        onclick="event.stopPropagation()">
                </div>`;
                
                const mainnets = filteredChains.filter(c => getAllTHChains().includes(c));
                const testnets = filteredChains.filter(c => testnetChains.includes(c));
                
                if (mainnets.length > 0) {
                    html += '<div class="chain-section-header">MAINNETS</div>';
                    mainnets.forEach(chain => {
                        const isActive = chain.name === selectedChain.name ? 'active' : '';
                        const safeName = chain.name.replace(/'/g, "\\'").replace(/"/g, '\\"');
                        const safeRpc = chain.rpc.replace(/'/g, "\\'").replace(/"/g, '\\"');
                        const safeSymbol = chain.symbol.replace(/'/g, "\\'").replace(/"/g, '\\"');
                        html += `<div class="chain-item ${isActive}" onclick="selectChainApproval('${safeName}', '${safeRpc}', '${safeSymbol}')">
                            <span class="chain-name">${chain.name}</span>
                            <span class="chain-symbol">${chain.symbol}</span>
                        </div>`;
                    });
                }
                
                if (testnets.length > 0) {
                    html += '<div class="chain-section-header">TESTNETS</div>';
                    testnets.forEach(chain => {
                        const isActive = chain.name === selectedChain.name ? 'active' : '';
                        const safeName = chain.name.replace(/'/g, "\\'").replace(/"/g, '\\"');
                        const safeRpc = chain.rpc.replace(/'/g, "\\'").replace(/"/g, '\\"');
                        const safeSymbol = chain.symbol.replace(/'/g, "\\'").replace(/"/g, '\\"');
                        html += `<div class="chain-item ${isActive}" onclick="selectChainApproval('${safeName}', '${safeRpc}', '${safeSymbol}')">
                            <span class="chain-name">${chain.name}</span>
                            <span class="chain-symbol">${chain.symbol}</span>
                        </div>`;
                    });
                }
                
                if (filteredChains.length === 0) {
                    html += '<div style="padding: 20px; text-align: center; color: #888;">No chains found</div>';
                }
                
                return html;
            }
            
            function showSelectedOnly() {
                searchTerm = '';
                chainGrid.innerHTML = '';
                const display = document.createElement('div');
                display.className = 'selected-chain-display';
                display.onclick = () => chainGrid.innerHTML = buildChainList();
                display.innerHTML = `<div><span class="chain-name">${selectedChain.name}</span><span class="chain-symbol">${selectedChain.symbol}</span></div><span class="expand-hint">▼ Click to change</span>`;
                chainGrid.appendChild(display);
            }
            
            window.updateChainSearchApproval = function(value) {
                searchTerm = value;
                chainGrid.innerHTML = buildChainList();
            };
            
            window.selectChainApproval = function(name, rpc, symbol) {
                selectedChain = { name, rpc, symbol };
                document.getElementById('rpcUrlApproval').value = rpc;
                showSelectedOnly();
            };
            
            showSelectedOnly();
        }