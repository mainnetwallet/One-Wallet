
        async function executeSelfTransfer() {
            const rpcUrl = document.getElementById('rpcUrlSelfTransfer').value.trim();
            const _thRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('rpcUrlSelfTransfer') : (rpcUrl ? [rpcUrl] : []);
            const _thChainId = parseInt((document.getElementById('rpcUrlSelfTransfer')||{}).getAttribute?.('data-chainid')||'',10)||null;
            const privateKeysInput = document.getElementById('privateKeysSelfTransfer').value.trim();
            const txCountPerWallet = parseInt(document.getElementById('txCountPerWallet').value) || 1;
            
            if (!rpcUrl || !privateKeysInput) {
                logSelfTransfer('error', '❌ Please fill in RPC URL and private keys');
                return;
            }
            
            // Validate based on mode
            if (currentSelfTransferMode === 'native') {
                const amountPerTx = document.getElementById('amountPerTx').value.trim();
                if (!amountPerTx || parseFloat(amountPerTx) < 0) {
                    logSelfTransfer('error', '❌ Please enter a valid amount');
                    return;
                }
            } else {
                const tokenAddress = document.getElementById('tokenAddressSelfTransfer').value.trim();
                const tokenAmount = document.getElementById('tokenAmountPerTx').value.trim();
                if (!tokenAddress || !tokenAmount) {
                    logSelfTransfer('error', '❌ Please enter token address and amount');
                    return;
                }
            }
            
            const btn = document.getElementById('executeSelfTransferBtn');
            btn.disabled = true;
            btn.innerHTML = '<span class="loading-spinner"></span> Processing...';
            window._thStopFlags = window._thStopFlags || {}; window._thStopFlags['selfTransfer'] = false;
            if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txStart(); // BG: wake lock
            
            try {
                // FIX: use thWithFallback for automatic multi-RPC failover
                let provider;
                try {
                  provider = await window.thWithFallback('rpcUrlSelfTransfer', async function(_p) {
                    await Promise.race([_p.getBlockNumber(), new Promise((_,r)=>setTimeout(()=>r(new Error('probe timeout')),5000))]);
                    return _p;
                  }, 5000);
                } catch(_thErr) {
                  // All RPCs in list failed — fall back to single URL so caller can surface error naturally
                  const _fbCid = parseInt((document.getElementById('rpcUrlSelfTransfer')||{}).getAttribute?.('data-chainid')||'',10)||null;
                  provider = window._thMakeProvider(rpcUrl, _fbCid);
                }
                const keys = parseKeysFromAnyFormat(privateKeysInput);
                
                
                if (currentSelfTransferMode === 'native') {
                    const amountPerTx = document.getElementById('amountPerTx').value.trim();
                } else {
                    const tokenAmount = document.getElementById('tokenAmountPerTx').value.trim();
                    const tokenAddress = document.getElementById('tokenAddressSelfTransfer').value.trim();
                }
                
                
                let totalSuccess = 0;
                let totalFailed = 0;
                
                for (let i = 0; i < keys.length; i++) {
                    if (window._thStopFlags && window._thStopFlags['selfTransfer']) { logSelfTransfer('warning', '⛔ Stopped by Pull-to-Refresh'); break; }
                    const key = keys[i];
                    const wallet = new ethers.Wallet(key, provider);
                    
                    logSelfTransfer('info', `👛 Wallet ${i + 1}/${keys.length}: ${wallet.address.substring(0, 10)}...`);
                    
                    // ── OneGas AI gas — refresh per wallet so price is always current ──
                    let txOptions = {};
                    Object.assign(txOptions, await window._thGas(provider));
                    
                    // ⛔ PTR guard — re-check after async gas estimation
                    if (window._thStopFlags && window._thStopFlags['selfTransfer']) { break; }

                    // Get onchain nonce
                    let nonce = await window.thRead('rpcUrlSelfTransfer', provider, function(_p) { return _p.getTransactionCount(wallet.address, 'latest'); }, 6000);
                                        
                    for (let j = 0; j < txCountPerWallet; j++) {
                        if (window._thStopFlags && window._thStopFlags['selfTransfer']) { logSelfTransfer('warning', '⛔ Stopped by Pull-to-Refresh'); break; }
                        try {
                            if (currentSelfTransferMode === 'native') {
                                // Native transfer
                                const amountPerTx = document.getElementById('amountPerTx').value.trim();
                                const amountWei = ethers.parseEther(amountPerTx);
                                
                                                                
                                // ── RPC-RESILIENT SEND (Self Transfer Native) ───────
                                let _stNProvider = provider;
                                let _stNWallet = wallet;
                                const _stNResult = await window.thResilientSendAndConfirm({
                                  rpcInputId: 'rpcUrlSelfTransfer',
                                  currentProvider: _stNProvider,
                                  onProviderRefresh: function(_p) {
                                    _stNProvider = _p;
                                    // NOTE: do NOT overwrite outer `provider` or `wallet` (wallet is a loop const).
                                    // _stNWallet and _stNProvider are the only live references inside sendFn.
                                    _stNWallet = new ethers.Wallet(_stNWallet.privateKey, _p);
                                  },
                                  sendFn: async function() {
                                    const _tx = await thSendWithSponsor(_stNWallet, { to: _stNWallet.address, value: amountWei, nonce: nonce, ...txOptions }, _thChainId, _stNProvider, logSelfTransfer);
                                    _thSaveTx(_tx.hash, 'rpcUrlSelfTransfer', 'Self Transfer');
                                    return _tx;
                                  },
                                  logFn: logSelfTransfer,
                                  label: 'Self Transfer Native',
                                  waitConfirm: false,
                                });
                                // ── END RPC-RESILIENT (Self Transfer Native) ─────────
                                
                                if (!_stNResult.opHash) {
                                  logSelfTransfer('success', `   ✅ Sent! Hash: ${createExplorerLink(_stNResult.hash, null, false)}`, true);
                                }
                                totalSuccess++;
                                
                            } else {
                                // Token transfer
                                const tokenAddress = document.getElementById('tokenAddressSelfTransfer').value.trim();
                                const tokenAmount = document.getElementById('tokenAmountPerTx').value.trim();
                                
                                                                
                                const tokenAbi = [
                                    'function transfer(address to, uint256 amount) returns (bool)'
                                ];
                                const tokenContract = new ethers.Contract(tokenAddress, tokenAbi, wallet);
                                
                                // ── RPC-RESILIENT SEND (Self Transfer Token) ────────
                                let _stTProvider = provider;
                                let _stTWallet = wallet;
                                let _stTContract = tokenContract;
                                const _stTResult = await window.thResilientSendAndConfirm({
                                  rpcInputId: 'rpcUrlSelfTransfer',
                                  currentProvider: _stTProvider,
                                  onProviderRefresh: function(_p) {
                                    _stTProvider = _p;
                                    // NOTE: do NOT overwrite outer `provider`/`wallet`/`tokenContract`.
                                    // wallet is a loop const; tokenContract is re-bound to _stTContract below.
                                    _stTWallet = new ethers.Wallet(_stTWallet.privateKey, _p);
                                    _stTContract = new ethers.Contract(_stTContract.target || _stTContract.address, ['function transfer(address to, uint256 amount) returns (bool)'], _stTWallet);
                                  },
                                  sendFn: async function() {
                                    const _tx = await thTokenSendWithSponsor(_stTWallet, _stTContract, _stTWallet.address, tokenAmount, _thChainId, _stTProvider, logSelfTransfer, { nonce, ...txOptions });
                                    _thSaveTx(_tx.hash, 'rpcUrlSelfTransfer', 'Self Transfer Token');
                                    return _tx;
                                  },
                                  logFn: logSelfTransfer,
                                  label: 'Self Transfer Token',
                                  waitConfirm: false,
                                });
                                // ── END RPC-RESILIENT (Self Transfer Token) ──────────
                                
                                if (!_stTResult.opHash) {
                                  logSelfTransfer('success', `   ✅ Sent! Hash: ${createExplorerLink(_stTResult.hash, null, false)}`, true);
                                }
                                totalSuccess++;
                            }
                            
                            // Increment nonce for next transaction
                            nonce++;
                            
                        } catch (error) {
                            logSelfTransfer('error', `   ❌ Failed: ${error.message.substring(0, 100)}`);
                            totalFailed++;
                            // Still increment nonce to continue
                            nonce++;
                        }
                    }
                }
                
                                logSelfTransfer('success', '🎉 SELF TRANSFER COMPLETED!');
                if (totalFailed > 0) {
                    logSelfTransfer('warning', `❌ Failed: ${totalFailed}`);
                }
                                
            } catch (error) {
                logSelfTransfer('error', `❌ Error: ${error.message}`);
            } finally {
                btn.disabled = false;
                btn.innerHTML = '🚀 Execute Self Transfers';
                if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txEnd(); // BG: release wake lock
            }
        }

        function clearSelfTransfer() {
            document.getElementById('privateKeysSelfTransfer').value = '';
            document.getElementById('txCountPerWallet').value = '1';
            document.getElementById('amountPerTx').value = '0';
            document.getElementById('tokenAddressSelfTransfer').value = '';
            document.getElementById('tokenAmountPerTx').value = '';
            updateSelfTransferKeyCount();
            clearLogSelfTransfer();
                        checkSelfTransferExecuteReady();
        }

        function logSelfTransfer(type, message, isHtml) {
            if (!_isUIVisible('selfTransferUI')) return;
            const logContainer = document.getElementById('logContainerSelfTransfer');
            if (!logContainer) return;
            const timestamp = new Date().toLocaleTimeString();
            const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
            const logLine = document.createElement('div');
            logLine.className = `log-line log-${type}`;
            logLine.innerHTML = `[${timestamp}] ${icon} ${isHtml ? message : processLogMessage(message, _thGetChainIdFromRpc('rpcUrlSelfTransfer'))}`;
            logContainer.appendChild(logLine);
            logContainer.scrollTop = logContainer.scrollHeight;
        }

        function clearLogSelfTransfer() {
            document.getElementById('logContainerSelfTransfer').innerHTML = '<div class="log-line log-info">[INFO] Log cleared</div>';
        }

        function initChainGridSelfTransfer() {
            const chainGrid = document.getElementById('chainGridSelfTransfer');
            if (!chainGrid) return;
            
            // Always re-render with current saved chain (no one-time guard)
            
            // ── FIX: restore saved chain per section ──
            let selectedChain = (typeof getTHSectionChain === 'function')
                ? getTHSectionChain('selfTransfer')
                : (getAllTHChains().find(c => c.chainId === 8453) || getAllTHChains().find(c => c.name === 'Base') || getAllTHChains()[0]);
            let searchTerm = '';
            const rpcInput = document.getElementById('rpcUrlSelfTransfer');
            if (rpcInput) {
                var _stRpcs = (typeof _getRpcListForChain === 'function' && selectedChain.chainId) ? _getRpcListForChain(selectedChain.chainId) : (selectedChain.rpcs || (selectedChain.rpc ? [selectedChain.rpc] : []));
                rpcInput.value = _stRpcs[0] || selectedChain.rpc || '';
                rpcInput.setAttribute('data-rpcs', JSON.stringify(_stRpcs));
                if (selectedChain.chainId) rpcInput.setAttribute('data-chainid', String(selectedChain.chainId));
            }
            
            function showSelectedOnly() {
                searchTerm = '';
                chainGrid.innerHTML = '';
                const display = document.createElement('div');
                display.className = 'selected-chain-display';
                display.onclick = showAllChains;
                display.innerHTML = `
                    <div>
                        <span class="chain-name">${selectedChain.name}</span>
                        <span class="chain-symbol">${selectedChain.symbol}</span>
                    </div>
                    <span class="expand-hint">▼ Click to change</span>
                `;
                chainGrid.appendChild(display);
            }
            
            function showAllChains() {
                chainGrid.innerHTML = '';
                chainGrid.style.maxHeight = '250px';
                chainGrid.style.overflow = 'auto';
                
                // Add search box
                const searchBox = document.createElement('div');
                searchBox.style.cssText = 'position: sticky; top: 0; background: #1a1a1a; z-index: 10; padding: 8px; border-bottom: 1px solid #2a2a2a;';
                searchBox.innerHTML = `<input type="text" 
                    placeholder="🔍 Search chains..." 
                    value="${searchTerm}"
                    style="width: 100%; padding: 8px 12px; background: #0a0a0a; border: 1px solid #2a2a2a; border-radius: 6px; color: #e0e0e0; font-size: 0.85rem;">`;
                const searchInput = searchBox.querySelector('input');
                searchInput.oninput = (e) => {
                    searchTerm = e.target.value;
                    updateChainList();
                };
                searchInput.onclick = (e) => e.stopPropagation();
                chainGrid.appendChild(searchBox);
                
                updateChainList();
            }
            
            function updateChainList() {
                // Remove existing chain items (keep search box)
                const items = chainGrid.querySelectorAll('.chain-item, .chain-section-header');
                items.forEach(item => item.remove());
                
                const allChains = getAllTHChains();
                const filteredChains = searchTerm 
                    ? allChains.filter(c => 
                        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        c.symbol.toLowerCase().includes(searchTerm.toLowerCase()))
                    : allChains;
                
                const mainnets = filteredChains.filter(c => getAllTHChains().includes(c));
                const testnets = filteredChains.filter(c => testnetChains.includes(c));
                
                if (mainnets.length > 0) {
                    const mainnetHeader = document.createElement('div');
                    mainnetHeader.className = 'chain-section-header';
                    mainnetHeader.textContent = 'MAINNETS';
                    chainGrid.appendChild(mainnetHeader);
                    
                    mainnets.forEach(chain => {
                        const item = document.createElement('div');
                        item.className = 'chain-item' + (chain.name === selectedChain.name ? ' active' : '');
                        item.innerHTML = `
                            <span class="chain-name">${chain.name}</span>
                            <span class="chain-symbol">${chain.symbol}</span>
                        `;
                        item.onclick = () => {
                            selectedChain = chain;
                            document.getElementById('rpcUrlSelfTransfer').value = chain.rpc;
                            showSelectedOnly();
                        };
                        chainGrid.appendChild(item);
                    });
                }
                
                if (testnets.length > 0) {
                    if (testnetChains && testnetChains.length > 0) {
                    const testnetHeader = document.createElement('div');
                    testnetHeader.className = 'chain-section-header';
                    testnetHeader.textContent = 'TESTNETS';
                    chainGrid.appendChild(testnetHeader);
                    }
                    
                    testnets.forEach(chain => {
                        const item = document.createElement('div');
                        item.className = 'chain-item' + (chain.name === selectedChain.name ? ' active' : '');
                        item.innerHTML = `
                            <span class="chain-name">${chain.name}</span>
                            <span class="chain-symbol">${chain.symbol}</span>
                        `;
                        item.onclick = () => {
                            selectedChain = chain;
                            document.getElementById('rpcUrlSelfTransfer').value = chain.rpc;
                            showSelectedOnly();
                        };
                        chainGrid.appendChild(item);
                    });
                }
                
                if (filteredChains.length === 0) {
                    const noResults = document.createElement('div');
                    noResults.style.cssText = 'padding: 20px; text-align: center; color: #888;';
                    noResults.textContent = 'No chains found';
                    chainGrid.appendChild(noResults);
                }
            }
            
            showSelectedOnly();
        }

        // Add event listener for tx count changes
        document.addEventListener('DOMContentLoaded', () => {
            const txCountInput = document.getElementById('txCountPerWallet');
            if (txCountInput) {
                txCountInput.addEventListener('input', updateSelfTransferEstimate);
            }
        });


        function openBalanceCheck() {
                        
            // Hide all other UIs
            safeHideElement('mainDashboard');
            safeHideElement('withdrawManagerUI');
            safeHideElement('batchTransferUI');
            safeHideElement('multiKeyNativeUI');
            safeHideElement('nftTransferUI');
            safeHideElement('phraseToKeyUI');
            safeHideElement('tokenApprovalManagerUI');
            safeHideElement('walletToWalletUI');
            safeHideElement('selfTransferUI'); // Added missing hide!
            
            // Show Balance Check UI
            safeShowElement('balanceCheckUI');
            
            // Save current section to localStorage
            localStorage.setItem('transferHub_currentSection', 'balanceCheck');
            // ── Sync header chain button every time section opens ──
            if (typeof thSyncSectionHeader === 'function') thSyncSectionHeader('balanceCheck');
            initChainGridBalanceCheck();
            _thLogInitialRpc('rpcUrlBalanceCheck', logBalanceCheck);
        }

        function openTokenApprovalManager() {
                        
            // Hide all other UIs
            safeHideElement('mainDashboard');
            safeHideElement('withdrawManagerUI');
            safeHideElement('batchTransferUI');
            safeHideElement('multiKeyNativeUI');
            safeHideElement('nftTransferUI');
            safeHideElement('phraseToKeyUI');
            safeHideElement('balanceCheckUI');
            safeHideElement('walletToWalletUI');
            safeHideElement('selfTransferUI'); // Added missing hide!
            
            // Show Token Approval Manager UI
            safeShowElement('tokenApprovalManagerUI');
            
            // Save current section to localStorage
            localStorage.setItem('transferHub_currentSection', 'tokenApprovalManager');
            // ── Sync header chain button every time section opens ──
            if (typeof thSyncSectionHeader === 'function') thSyncSectionHeader('approval');
            initChainGridApproval();
                        _thLogInitialRpc('rpcUrlApproval', logApproval);
        }



        function openWalletToWallet() {
                        
            // Hide all other UIs
            safeHideElement('mainDashboard');
            safeHideElement('withdrawManagerUI');
            safeHideElement('batchTransferUI');
            safeHideElement('multiKeyNativeUI');
            safeHideElement('nftTransferUI');
            safeHideElement('phraseToKeyUI');
            safeHideElement('balanceCheckUI');
            safeHideElement('tokenApprovalManagerUI');
            safeHideElement('selfTransferUI');
            
            // Show Wallet to Wallet UI
            safeShowElement('walletToWalletUI');
            
            // Save current section to localStorage
            localStorage.setItem('transferHub_currentSection', 'walletToWallet');
            // ── Sync header chain button every time section opens ──
            if (typeof thSyncSectionHeader === 'function') thSyncSectionHeader('w2wNative');
            initChainGridW2W();
                        _thLogInitialRpc('rpcUrlW2W', logW2W);
        }

        function closePhraseToKey() {
            safeHideElement('phraseToKeyUI');
            safeHideElement('batchTransferUI');
            safeHideElement('withdrawManagerUI');
            safeHideElement('multiKeyNativeUI');
            safeHideElement('nftTransferUI');
            safeHideElement('selfTransferUI');
            safeHideElement('balanceCheckUI');
            safeHideElement('tokenApprovalManagerUI');
            safeHideElement('walletToWalletUI');
            safeShowElement('mainDashboard');
        }

        function logMessagePhraseToKey(type, message) {
            if (!_isUIVisible('phraseToKeyUI')) return;
            const logContainer = document.getElementById('logContainerPhraseToKey');
            if (!logContainer) return;
            
            const line = document.createElement('div');
            line.className = `log-line log-${type}`;
            
            const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
            line.innerHTML = `[${timestamp}] ${processLogMessage(message)}`;
            
            logContainer.appendChild(line);
            logContainer.scrollTop = logContainer.scrollHeight;
        }

        function clearLogPhraseToKey() {
            const logContainer = document.getElementById('logContainerPhraseToKey');
            if (logContainer) {
                logContainer.innerHTML = '';
                            }
        }
