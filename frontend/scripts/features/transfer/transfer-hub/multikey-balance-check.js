        
        // Security measures initialized silently


        // ========================================

        // ========================================
        // BALANCE CHECK FUNCTIONS
        // ========================================
        
        let balanceCheckProvider = null;
        let balanceCheckResults = [];
        
        // Initialize chain grid for Balance Check
        function initChainGridBalanceCheck() {
            const chainGrid = document.getElementById('chainGridBalanceCheck');
            const chainSearch = document.getElementById('chainSearchBalanceCheck');
            if (!chainGrid) return;
            
            // Always re-render with current saved chain
            
            // ── FIX: restore saved chain per section ──
            let selectedChain = (typeof getTHSectionChain === 'function')
                ? getTHSectionChain('balanceCheck')
                : ((typeof activeHomeChainId !== 'undefined' && activeHomeChainId ? getAllTHChains().find(c => c.chainId === activeHomeChainId) : null) || getAllTHChains().find(c => c.chainId === 8453) || getAllTHChains().find(c => c.name === 'Base') || { name: 'Base', chainId: 8453, rpc: 'https://mainnet.base.org', symbol: 'ETH' });
            
            // Set default RPC (full list)
            const rpcInput = document.getElementById('rpcUrlBalanceCheck');
            if (rpcInput) {
                var _bcRpcs = (typeof _getRpcListForChain === 'function' && selectedChain.chainId) ? _getRpcListForChain(selectedChain.chainId) : (selectedChain.rpcs || (selectedChain.rpc ? [selectedChain.rpc] : []));
                rpcInput.value = _bcRpcs[0] || selectedChain.rpc || '';
                rpcInput.setAttribute('data-rpcs', JSON.stringify(_bcRpcs));
                if (selectedChain.chainId) rpcInput.setAttribute('data-chainid', String(selectedChain.chainId));
            }
            
            // Build full chain list
            function buildChainList() {
                let html = '<div class="chain-section-header">MAINNETS</div>';
                
                getAllTHChains().forEach(chain => {
                    const isActive = chain.name === selectedChain.name ? 'active' : '';
                    const safeName = chain.name.replace(/'/g, "\\'").replace(/"/g, '\\"');
                    const safeRpc = chain.rpc.replace(/'/g, "\\'").replace(/"/g, '\\"');
                    const safeSymbol = chain.symbol.replace(/'/g, "\\'").replace(/"/g, '\\"');
                    html += `<div class="chain-item ${isActive}" onclick="selectChainBalanceCheck('${safeName}', '${safeRpc}', '${safeSymbol}')">
                        <span class="chain-name">${chain.name}</span>
                        <span class="chain-symbol">${chain.symbol}</span>
                    </div>`;
                });
                
                if (testnetChains && testnetChains.length > 0) {
                html += '<div class="chain-section-header">TESTNETS</div>';
                }
                if (testnetChains && testnetChains.length > 0) {
                testnetChains.forEach(chain => {
                    const isActive = chain.name === selectedChain.name ? 'active' : '';
                    const safeName = chain.name.replace(/'/g, "\\'").replace(/"/g, '\\"');
                    const safeRpc = chain.rpc.replace(/'/g, "\\'").replace(/"/g, '\\"');
                    const safeSymbol = chain.symbol.replace(/'/g, "\\'").replace(/"/g, '\\"');
                    html += `<div class="chain-item ${isActive}" onclick="selectChainBalanceCheck('${safeName}', '${safeRpc}', '${safeSymbol}')">
                        <span class="chain-name">${chain.name}</span>
                        <span class="chain-symbol">${chain.symbol}</span>
                    </div>`;
                });
                }
                
                return html;
            }
            
            // Show selected chain only
            function showSelectedOnly() {
                chainGrid.innerHTML = '';
                chainGrid.style.maxHeight = 'none';
                chainGrid.style.overflow = 'visible';
                chainGrid.style.border = 'none';
                chainGrid.style.background = 'transparent';
                
                const display = document.createElement('div');
                display.className = 'selected-chain-display';
                display.onclick = toggleChainListBalanceCheck;
                display.innerHTML = `
                    <div>
                        <span class="chain-name">${selectedChain.name}</span>
                        <span class="chain-symbol">${selectedChain.symbol}</span>
                    </div>
                    <span class="expand-hint">▼ Click to change</span>
                `;
                chainGrid.appendChild(display);
                
                if (chainSearch) chainSearch.style.display = 'none';
            }
            
            // Show all chains
            function showAllChains() {
                chainGrid.innerHTML = buildChainList();
                chainGrid.style.maxHeight = '250px';
                chainGrid.style.overflow = 'auto';
                chainGrid.style.border = '1px solid #2a2a2a';
                chainGrid.style.background = '#0f0f0f';
                
                if (chainSearch) {
                    chainSearch.style.display = 'block';
                    chainSearch.value = '';
                }
            }
            
            // Toggle between selected and all chains
            window.toggleChainListBalanceCheck = function() {
                if (chainGrid.querySelector('.selected-chain-display')) {
                    showAllChains();
                }
            };
            
            // Select chain
            window.selectChainBalanceCheck = function(name, rpc, symbol) {
                selectedChain = { name, rpc, symbol };
                document.getElementById('rpcUrlBalanceCheck').value = rpc;
                logBalanceCheck('success', `Selected chain: ${name} (${symbol})`);
                showSelectedOnly();
            };
            
            // Search functionality
            if (chainSearch) {
                chainSearch.addEventListener('input', function() {
                    const searchTerm = this.value.toLowerCase();
                    const items = chainGrid.querySelectorAll('.chain-item');
                    items.forEach(item => {
                        const text = item.textContent.toLowerCase();
                        item.style.display = text.includes(searchTerm) ? 'flex' : 'none';
                    });
                });
            }
            
            // Initialize with selected chain only
            showSelectedOnly();
        }
        
        // Check balances function
        // Smart balance formatter - shows more decimals for very small amounts
        function formatBalanceSmart(balanceStr) {
            const num = parseFloat(balanceStr);
            
            if (num === 0) return '0';
            if (num >= 1) return num.toFixed(6);
            if (num >= 0.01) return num.toFixed(6);
            if (num >= 0.0001) return num.toFixed(8);
            if (num >= 0.000001) return num.toFixed(10);
            
            // For very small numbers, use scientific notation
            return num.toExponential(6);
        }
        
        async function checkBalances() {
            window._thStopFlags = window._thStopFlags || {}; window._thStopFlags['balanceCheck'] = false;
            const rpcUrl = document.getElementById('rpcUrlBalanceCheck').value.trim();
            const _thRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('rpcUrlBalanceCheck') : (rpcUrl ? [rpcUrl] : []);
            const _thChainId = parseInt((document.getElementById('rpcUrlBalanceCheck')||{}).getAttribute?.('data-chainid')||'',10)||null;
            const inputText = document.getElementById('inputBalanceCheck').value.trim();
            const tokenAddress = document.getElementById('tokenAddressBalanceCheck').value.trim();
            
            if (!rpcUrl) {
                logBalanceCheck('error', 'Please enter RPC URL');
                return;
            }
            
            if (!inputText) {
                logBalanceCheck('error', 'Please enter at least one address or private key');
                return;
            }
            
            try {
                // FIX: use thWithFallback for automatic multi-RPC failover
                try {
                  balanceCheckProvider = await window.thWithFallback('rpcUrlBalanceCheck', async function(_p) {
                    await Promise.race([_p.getBlockNumber(), new Promise((_,r)=>setTimeout(()=>r(new Error('probe timeout')),5000))]);
                    return _p;
                  }, 5000);
                } catch(_thErr) {
                  const _fbCid66123 = parseInt((document.getElementById('rpcUrlBalanceCheck')||{}).getAttribute?.('data-chainid')||'',10)||null;
                  balanceCheckProvider = window._thMakeProvider(rpcUrl, _fbCid66123);
                }
                
                // Use smart parser to extract keys/addresses from any format
                const parsedKeys = parseKeysFromAnyFormat(inputText);
                
                if (parsedKeys.length === 0) {
                    logBalanceCheck('error', '❌ No valid keys or addresses found');
                    return;
                }
                
                logBalanceCheck('info', `✅ Parsed ${parsedKeys.length} valid input(s)...`);
                
                const addresses = [];
                
                // Convert keys to addresses
                for (const item of parsedKeys) {
                    try {
                        if (item.length === 66) {
                            // Private key (64 chars + 0x)
                            const wallet = new ethers.Wallet(item);
                            addresses.push(wallet.address);
                        } else if (item.length === 42) {
                            // Address (40 chars + 0x)
                            addresses.push(item);
                        }
                    } catch (e) {
                        logBalanceCheck('warning', `⚠️ Failed to process: ${item.substring(0, 20)}...`);
                    }
                }
                
                if (addresses.length === 0) {
                    logBalanceCheck('error', '❌ No valid addresses found');
                    return;
                }
                
                logBalanceCheck('info', `🔍 Checking balances for ${addresses.length} address(es)...`);
                
                balanceCheckResults = [];
                let totalBalance = BigInt(0);
                
                // Check if token address is provided
                const isTokenCheck = tokenAddress && ethers.isAddress(tokenAddress);
                
                if (isTokenCheck) {
                    logBalanceCheck('info', `🪙 Checking ERC20 token: ${tokenAddress}`);
                    
                    const tokenContract = new ethers.Contract(
                        tokenAddress,
                        ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)', 'function symbol() view returns (string)'],
                        balanceCheckProvider
                    );
                    
                    // Try to get decimals and symbol with error handling
                    let decimals = 18; // Default fallback
                    let symbol = 'TOKEN'; // Default fallback
                    
                    try {
                        const results = await Promise.allSettled([
                            tokenContract.decimals(),
                            tokenContract.symbol()
                        ]);
                        
                        if (results[0].status === 'fulfilled') {
                            decimals = results[0].value;
                        } else {
                            logBalanceCheck('warning', `⚠️ Could not fetch decimals, using default: 18`);
                        }
                        
                        if (results[1].status === 'fulfilled') {
                            symbol = results[1].value;
                        } else {
                            logBalanceCheck('warning', `⚠️ Could not fetch symbol, using default: TOKEN`);
                        }
                        
                        logBalanceCheck('info', `📊 Token: ${symbol} (${decimals} decimals)`);
                    } catch (e) {
                        logBalanceCheck('warning', `⚠️ Token info fetch failed, using defaults (18 decimals)`);
                    }
                    
                    for (let i = 0; i < addresses.length; i++) {
                        if (window._thStopFlags && window._thStopFlags['balanceCheck']) { logBalanceCheck('warning', '⛔ Stopped by Pull-to-Refresh'); break; }
                        const address = addresses[i];
                        try {
                            const balance = await tokenContract.balanceOf(address);
                            const balanceFormatted = ethers.formatUnits(balance, decimals);
                            
                            balanceCheckResults.push({
                                index: i + 1,
                                address: address,
                                balance: balanceFormatted,
                                symbol: symbol,
                                raw: balance
                            });
                            
                            totalBalance += balance;
                            
                            logBalanceCheck('success', `[${i + 1}/${addresses.length}] ${address} : ${formatBalanceSmart(balanceFormatted)} ${symbol}`);
                        } catch (e) {
                            logBalanceCheck('error', `❌ [${i + 1}/${addresses.length}] ${address} : Failed - ${e.message.substring(0, 50)}`);
                        }
                    }
                    
                    const totalFormatted = ethers.formatUnits(totalBalance, decimals);
                    document.getElementById('totalBalanceSum').textContent = `${formatBalanceSmart(totalFormatted)} ${symbol}`;
                    
                } else {
                    logBalanceCheck('info', '💰 Checking native token balances');
                    
                    for (let i = 0; i < addresses.length; i++) {
                        if (window._thStopFlags && window._thStopFlags['balanceCheck']) { logBalanceCheck('warning', '⛔ Stopped by Pull-to-Refresh'); break; }
                        const address = addresses[i];
                        try {
                            const balance = await window.thRead('rpcUrlBalanceCheck', balanceCheckProvider, function(_p) { return _p.getBalance(address); }, 6000);
                            const balanceFormatted = ethers.formatEther(balance);
                            
                            balanceCheckResults.push({
                                index: i + 1,
                                address: address,
                                balance: balanceFormatted,
                                symbol: 'Native',
                                raw: balance
                            });
                            
                            totalBalance += balance;
                            
                            logBalanceCheck('success', `[${i + 1}/${addresses.length}] ${address} : ${formatBalanceSmart(balanceFormatted)}`);
                        } catch (e) {
                            logBalanceCheck('error', `❌ [${i + 1}/${addresses.length}] ${address} : Failed - ${e.message.substring(0, 50)}`);
                        }
                    }
                    
                    const totalFormatted = ethers.formatEther(totalBalance);
                    document.getElementById('totalBalanceSum').textContent = formatBalanceSmart(totalFormatted);
                }
                
                document.getElementById('totalAddressesBalance').textContent = addresses.length;
                
                // Display results
                displayBalanceResults();
                
                logBalanceCheck('success', `✅ Balance check complete! Total: ${addresses.length} addresses`);
                
            } catch (error) {
                logBalanceCheck('error', `❌ Failed: ${error.message}`);
            }
        }
        
        // Display balance results
        function displayBalanceResults() {
            const listDiv = document.getElementById('balanceResultsList');
            
            if (balanceCheckResults.length === 0) {
                listDiv.innerHTML = `
                    <div class="bc-none">
                        <div class="bc-none-t">No results yet</div>
                        <div class="bc-none-s">Add wallets and tap Check balances</div>
                    </div>
                `;
                return;
            }
            
            let html = '';
            
            // Compact rows (styles: th-balance-check-mobile.css). Result data and export are unchanged.
            balanceCheckResults.forEach(result => {
                const _addr = String(result.address);
                const _short = _addr.length > 16 ? _addr.slice(0, 8) + '...' + _addr.slice(-6) : _addr;
                const _zero = !(parseFloat(result.balance) > 0);
                html += `
                    <div class="bc-rrow${_zero ? ' bc-zero' : ''}">
                        <span class="bc-idx">#${result.index}</span>
                        <div class="bc-addr" title="${_addr}">${_short}</div>
                        <div class="bc-val">${formatBalanceSmart(result.balance)} <small>${result.symbol}</small></div>
                        <button type="button" class="bc-copy" onclick="bcCopy('${_addr}', this)" title="Copy address" aria-label="Copy address"><span class="material-icons-round">content_copy</span></button>
                    </div>
                `;
            });
            
            listDiv.innerHTML = html;
        }
        
        // Export as CSV
        function exportBalanceCSV() {
            if (balanceCheckResults.length === 0) {
                logBalanceCheck('warning', 'No results to export');
                return;
            }
            
            let csv = 'Index,Address,Balance,Symbol\n';
            
            balanceCheckResults.forEach(result => {
                csv += `${result.index},"${result.address}",${result.balance},${result.symbol}\n`;
            });
            
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `balance_check_${Date.now()}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            
            logBalanceCheck('success', 'Exported as CSV');
        }
        
        // Export as JSON
        function exportBalanceJSON() {
            if (balanceCheckResults.length === 0) {
                logBalanceCheck('warning', 'No results to export');
                return;
            }
            
            const json = JSON.stringify(balanceCheckResults, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `balance_check_${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            logBalanceCheck('success', 'Exported as JSON');
        }
        
        // Clear balance check
        function clearBalanceCheck() {
            document.getElementById('inputBalanceCheck').value = '';
            document.getElementById('tokenAddressBalanceCheck').value = '';
            document.getElementById('totalAddressesBalance').textContent = '0';
            document.getElementById('totalBalanceSum').textContent = '0';
            balanceCheckResults = [];
            displayBalanceResults();
            logBalanceCheck('info', 'All data cleared');
        }
        
        // Log function for Balance Check
        function logBalanceCheck(type, message) {
            if (!_isUIVisible('balanceCheckUI')) return;
            const logContainer = document.getElementById('logContainerBalanceCheck');
            if (!logContainer) return;
            const timestamp = new Date().toLocaleTimeString();
            const logClass = `log-${type}`;
            const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
            
            const logLine = document.createElement('div');
            logLine.className = `log-line ${logClass}`;
            logLine.innerHTML = `[${timestamp}] ${icon} ${processLogMessage(message, _thGetChainIdFromRpc('rpcUrlBalanceCheck'))}`;
            
            logContainer.appendChild(logLine);
            logContainer.scrollTop = logContainer.scrollHeight;
        }
        
        // Clear log for Balance Check
        function clearLogBalanceCheck() {
            const logContainer = document.getElementById('logContainerBalanceCheck');
            logContainer.innerHTML = '<div class="log-line log-info">[INFO] Log cleared</div>';
        }