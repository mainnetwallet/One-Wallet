
        function renderSavedContracts() {
            const container = document.getElementById('savedContractsList');
            const header = document.getElementById('savedContractsHeader');
            const countSpan = document.getElementById('savedContractsCount');
            const toggleBtn = document.getElementById('savedContractsToggleBtn');
            
            // Filter: show only contracts for the currently selected chain
            const currentChainId = currentChainConfig?.chainId || null;
            const visibleContracts = currentChainId
                ? savedContracts.filter(c => c.chainId === currentChainId)
                : savedContracts;
            
            if (visibleContracts.length === 0) {
                container.classList.remove('active');
                header.style.display = 'none';
                return;
            }
            
            header.style.display = 'block';
            countSpan.textContent = visibleContracts.length;
            container.classList.add('active');
            container.innerHTML = '';
            
            // Update toggle button label based on whether any contract is active
            if (toggleBtn) {
                const anyActive = visibleContracts.some(c => c.isActive);
                toggleBtn.textContent = anyActive ? '☐ Deselect' : '☑ Select All';
            }
            
            visibleContracts.forEach(contract => {
                const item = document.createElement('div');
                item.className = 'saved-contract-item' + (contract.isActive ? ' active' : '');

                // ── Address row ──
                const addressDiv = document.createElement('div');
                addressDiv.className = 'saved-contract-address';

                // Truncated address: first 10 + … + last 8
                const addr = contract.address || '';
                const shortAddr = addr.length > 20
                    ? addr.slice(0, 10) + '…' + addr.slice(-8)
                    : addr;

                const explorerUrl = getTHExplorer(contract.chainId);
                const explorerLink = document.createElement('a');
                explorerLink.href = `${explorerUrl}/address/${addr}`;
                explorerLink.target = '_blank';
                explorerLink.rel = 'noopener noreferrer';
                explorerLink.className = 'log-link';
                explorerLink.textContent = shortAddr;
                explorerLink.title = addr;           // full address on hover
                explorerLink.onclick = (e) => { e.stopPropagation(); };

                addressDiv.appendChild(explorerLink);

                // ── Owner address row ──
                if (contract.ownerAddress) {
                    const ownerDiv = document.createElement('div');
                    ownerDiv.style.cssText = 'font-size:0.68rem;color:#6b7280;margin-bottom:3px;font-family:var(--font-mono,monospace);';
                    const ow = contract.ownerAddress;
                    const shortOwner = ow.length > 12 ? ow.slice(0,6) + '…' + ow.slice(-4) : ow;
                    ownerDiv.innerHTML = '<span style="color:#4a4a65;">Owner: </span><span style="color:#94a3b8;">' + shortOwner + '</span>';
                    ownerDiv.title = ow;
                    addressDiv.appendChild(ownerDiv);
                }

                // ── Meta row ──
                const metaDiv = document.createElement('div');
                metaDiv.className = 'saved-contract-meta';

                // Chain name — fallback chain lookup so it never shows blank
                const resolvedChainName = contract.chainName
                    || (contract.chainId && typeof getAllChains === 'function'
                        ? (getAllChains().find(c => c.chainId === contract.chainId)?.name || ('Chain ' + contract.chainId))
                        : (contract.chainId ? 'Chain ' + contract.chainId : '—'));

                const chainSpan = document.createElement('span');
                chainSpan.className = 'saved-contract-chain';
                chainSpan.textContent = '⛓ ' + resolvedChainName;
                if (contract.chainId) {
                    chainSpan.style.cursor = 'pointer';
                    chainSpan.title = resolvedChainName + ' — click to open explorer';
                    chainSpan.onclick = (e) => {
                        e.stopPropagation();
                        window.open(window.getTHExplorer ? window.getTHExplorer(contract.chainId) : 'https://etherscan.io', '_blank', 'noopener');
                    };
                }

                const dateSpan = document.createElement('span');
                dateSpan.className = 'saved-contract-date';
                dateSpan.textContent = new Date(contract.deployedAt).toLocaleDateString();

                metaDiv.appendChild(chainSpan);
                metaDiv.appendChild(dateSpan);

                item.appendChild(addressDiv);
                item.appendChild(metaDiv);
                
                item.onclick = () => {
                    // Check if correct chain
                    if (currentChainConfig?.chainId !== contract.chainId) {
                        return;
                    }
                    // Toggle: if already active, deselect; otherwise load/select
                    if (contract.isActive) {
                        savedContracts.forEach(c => c.isActive = false);
                        localStorage.setItem('batchTransferContracts', JSON.stringify(savedContracts));
                        activeContractAddress = null;
                        renderSavedContracts();
                        if (typeof checkDeployReady === 'function') checkDeployReady();
                    } else {
                        loadContract(contract.address, contract.chainId);
                    }
                };
                
                container.appendChild(item);
            });
        }

        // Toggle All helper for Native saved contracts
        function toggleAllSavedContracts() {
            const currentChainId = currentChainConfig?.chainId || null;
            const visibleContracts = currentChainId
                ? savedContracts.filter(c => c.chainId === currentChainId)
                : savedContracts;
            const anyActive = visibleContracts.some(c => c.isActive);
            if (anyActive) {
                // Deselect all
                savedContracts.forEach(c => c.isActive = false);
                localStorage.setItem('batchTransferContracts', JSON.stringify(savedContracts));
                renderSavedContracts();
            } else {
                // Select first visible contract (or the only one)
                if (visibleContracts.length === 1) {
                    loadContract(visibleContracts[0].address, visibleContracts[0].chainId);
                } else if (visibleContracts.length > 1) {
                    // Select all by marking all active
                    savedContracts.forEach(c => {
                        if (visibleContracts.find(v => v.address === c.address)) c.isActive = true;
                    });
                    localStorage.setItem('batchTransferContracts', JSON.stringify(savedContracts));
                    renderSavedContracts();
                }
            }
        }

        // Chain search functionality (same as before)
        function setupChainSearch() {
            const searchInput = document.getElementById('chainSearch');
            const chainGrid = document.getElementById('chainGrid');
            
            if (!searchInput || !chainGrid) {
                return;
            }
            
            renderAllChains();
            
            function renderAllChains() {
                chainGrid.innerHTML = '';
                
                // Mainnets
                const mainnetHeader = document.createElement('div');
                mainnetHeader.className = 'chain-section-header';
                mainnetHeader.textContent = `Networks (${getAllTHChains().length})`;
                chainGrid.appendChild(mainnetHeader);
                
                getAllTHChains().forEach(chain => {
                    createChainItem(chain);
                });
                
                // Testnets
                if (testnetChains && testnetChains.length > 0) {
                const testnetHeader = document.createElement('div');
                testnetHeader.className = 'chain-section-header';
                testnetHeader.textContent = `Testnets (${testnetChains.length})`;
                testnetHeader.style.marginTop = '12px';
                chainGrid.appendChild(testnetHeader);
                }
                
                if (testnetChains && testnetChains.length > 0) {
                testnetChains.forEach(chain => {
                    createChainItem(chain);
                });
                }
            }
            
            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();
                
                if (!searchTerm) {
                    renderAllChains();
                    return;
                }
                
                const allChains = getAllTHChains();
                const filtered = allChains.filter(chain => {
                    return chain.name.toLowerCase().includes(searchTerm) || 
                           chain.symbol.toLowerCase().includes(searchTerm);
                });
                
                renderChains(filtered);
            });
            
            function renderChains(chains) {
                chainGrid.innerHTML = '';
                
                if (chains.length === 0) {
                    chainGrid.innerHTML = '<div style="text-align: center; padding: 20px; color: #606060; font-size: 0.85rem;">No chains found</div>';
                    return;
                }
                
                chains.forEach(chain => {
                    createChainItem(chain);
                });
            }
            
            function createChainItem(chain) {
                const item = document.createElement('div');
                const _savedChain1 = (typeof getTHSectionChain === 'function') ? getTHSectionChain('batchNative') : null;
                const _savedName1 = _savedChain1 ? _savedChain1.name : null;
                item.className = 'chain-item' + (chain.name === _savedName1 ? ' active' : '');
                
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
                    
                    document.querySelectorAll('.chain-item').forEach(i => i.classList.remove('active'));
                    item.classList.add('active');
                    
                    currentChainConfig = {
                        name: chain.name,
                        chainId: chain.chainId,
                        symbol: chain.symbol,
                        rpcs: [chain.rpc],
                        explorer: chain.explorer || '',
                        isCustom: chain.isCustom || false
                    };
                    // Single shared chain — keep Token config in sync
                    currentTokenChainConfig = currentChainConfig;
                    
                    // For Custom Chain, leave RPC empty
                    if (chain.isCustom) {
                        document.getElementById('rpcUrl').value = '';
                        document.getElementById('rpcUrl').placeholder = 'Enter your custom RPC URL...';
                        var _btTRpcC = document.getElementById('rpcUrlToken');
                        if (_btTRpcC) { _btTRpcC.value = ''; _btTRpcC.placeholder = 'Enter your custom RPC URL...'; }
                                                                    } else {
                        document.getElementById('rpcUrl').value = chain.rpc;
                        document.getElementById('rpcUrl').placeholder = 'https://...';
                        var _btTRpcN = document.getElementById('rpcUrlToken');
                        if (_btTRpcN) { _btTRpcN.value = chain.rpc; _btTRpcN.setAttribute('data-rpcs', JSON.stringify([chain.rpc])); _btTRpcN.setAttribute('data-chainid', chain.chainId || ''); }
                        initializeProvider();
                        
                        // Check if there's a saved contract for this chain
                        const chainContract = savedContracts.find(c => c.chainId === chain.chainId);
                        if (chainContract) {
                            loadContract(chainContract.address, chainContract.chainId);
                        }
                    }
                    
                    // Update Saved Contracts list to show only current chain's contracts
                    renderSavedContracts();
                    
                    showSelectedChainOnly(chain);
                });
                
                chainGrid.appendChild(item);
            }
            
            function showSelectedChainOnly(chain) {
                const searchInput = document.getElementById('chainSearch');
                const chainGrid = document.getElementById('chainGrid');
                
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
                    renderAllChains();
                });
                
                chainGrid.appendChild(selectedDisplay);
            }
            
            // Initialize with Base as default
            setTimeout(() => {
                const _initChain = getAllTHChains().find(c => c.chainId === 8453) || getAllTHChains().find(c => c.name === 'Base');
                if (_initChain) {
                    currentChainConfig = { name: _initChain.name, chainId: _initChain.chainId, symbol: _initChain.symbol, rpcs: [_initChain.rpc], explorer: _initChain.explorer || '' };
                    currentTokenChainConfig = currentChainConfig;
                    var _rUrlEl = document.getElementById('rpcUrl');
                    if (_rUrlEl) { _rUrlEl.value = _initChain.rpc; _rUrlEl.setAttribute('data-rpcs', JSON.stringify([_initChain.rpc])); _rUrlEl.setAttribute('data-chainid', _initChain.chainId || ''); }
                    var _tRpcI = document.getElementById('rpcUrlToken');
                    if (_tRpcI) { _tRpcI.value = _initChain.rpc; _tRpcI.setAttribute('data-rpcs', JSON.stringify([_initChain.rpc])); _tRpcI.setAttribute('data-chainid', _initChain.chainId || ''); }
                    showSelectedChainOnly(_initChain);
                    // Sync header button to Base
                    var hdrEmEl = document.getElementById('th-net-emoji-batchNative-hdr');
                    var hdrNmEl = document.getElementById('th-net-name-batchNative-hdr');
                    if (hdrNmEl) hdrNmEl.textContent = _initChain.name;
                    if (hdrEmEl) {
                        var em = (typeof chainEmoji === 'function') ? chainEmoji(_initChain) : '🔵';
                        if (_initChain.logoURI && typeof _chainLogoHtml === 'function') { hdrEmEl.innerHTML = _chainLogoHtml(_initChain.logoURI, em, 18); if (typeof _fixChainLogos === 'function') _fixChainLogos(hdrEmEl); }
                        else { hdrEmEl.textContent = em; }
                    }
                }
            }, 0);
        }
                            
        // Pre-compiled Contract
        async function compileContract() {
            try {
                compiledContract = {
                    abi: [
                        {
                            "inputs": [],
                            "stateMutability": "nonpayable",
                            "type": "constructor"
                        },
                        {
                            "anonymous": false,
                            "inputs": [
                                {"indexed": true, "internalType": "address", "name": "recipient", "type": "address"},
                                {"indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256"}
                            ],
                            "name": "NativeWithdrawn",
                            "type": "event"
                        },
                        {
                            "anonymous": false,
                            "inputs": [
                                {"indexed": true, "internalType": "address", "name": "token", "type": "address"},
                                {"indexed": true, "internalType": "address", "name": "recipient", "type": "address"},
                                {"indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256"}
                            ],
                            "name": "TokenWithdrawn",
                            "type": "event"
                        },
                        {
                            "anonymous": false,
                            "inputs": [
                                {"indexed": true, "internalType": "address", "name": "recipient", "type": "address"},
                                {"indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256"}
                            ],
                            "name": "TransferExecuted",
                            "type": "event"
                        },
                        {
                            "inputs": [
                                {"internalType": "address[]", "name": "recipients", "type": "address[]"},
                                {"internalType": "uint256[]", "name": "amounts", "type": "uint256[]"}
                            ],
                            "name": "executeTransfer",
                            "outputs": [],
                            "stateMutability": "payable",
                            "type": "function"
                        },
                        {
                            "inputs": [],
                            "name": "getBalance",
                            "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
                            "stateMutability": "view",
                            "type": "function"
                        },
                        {
                            "inputs": [{"internalType": "address", "name": "token", "type": "address"}],
                            "name": "getTokenBalance",
                            "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
                            "stateMutability": "view",
                            "type": "function"
                        },
                        {
                            "inputs": [],
                            "name": "owner",
                            "outputs": [{"internalType": "address", "name": "", "type": "address"}],
                            "stateMutability": "view",
                            "type": "function"
                        },
                        {
                            "inputs": [{"internalType": "address payable", "name": "recipient", "type": "address"}],
                            "name": "withdrawNative",
                            "outputs": [],
                            "stateMutability": "nonpayable",
                            "type": "function"
                        },
                        {
                            "inputs": [
                                {"internalType": "address", "name": "token", "type": "address"},
                                {"internalType": "address", "name": "recipient", "type": "address"}
                            ],
                            "name": "withdrawToken",
                            "outputs": [],
                            "stateMutability": "nonpayable",
                            "type": "function"
                        },
                        {
                            "stateMutability": "payable",
                            "type": "fallback"
                        },
                        {
                            "stateMutability": "payable",
                            "type": "receive"
                        }
                    ],
                    bytecode: BATCH_NATIVE_BYTECODE
                };

                // Contract compiled silently on startup
            } catch (error) {
            }
        }

        let walletCheckTimeout;
        let _walletCheckSeq = 0; // sequence counter to cancel stale checks

        async function initializeProvider() {
            try {
                if (!currentChainConfig) {
                    // Auto-set Base as default chain instead of waiting
                    const _getTHC = typeof getAllTHChains === 'function' ? getAllTHChains : (typeof window.getAllTHChains === 'function' ? window.getAllTHChains : () => []);
                    const _autoChain = _getTHC().find(c => c.chainId === 8453) || _getTHC().find(c => c.name === 'Base') || _getTHC()[0];
                    if (_autoChain) {
                        currentChainConfig = {
                            name: _autoChain.name,
                            chainId: _autoChain.chainId,
                            symbol: _autoChain.symbol,
                            // BUG FIX: use full .rpcs array when available; single .rpc is a fallback only
                            rpcs: (Array.isArray(_autoChain.rpcs) && _autoChain.rpcs.length) ? _autoChain.rpcs : [_autoChain.rpc].filter(Boolean),
                            explorer: _autoChain.explorer || ''
                        };
                        // log removed: noise
                    } else {
                        // log removed: noise
                        return;
                    }
                }
                const chainId = currentChainConfig.chainId;
                // Build RPC list: merge _getRpcListForChain (all known RPCs for chain) + config rpcs
                const _thRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('rpcUrl') : [];
                const _chainRpcs = (typeof _getRpcListForChain === 'function' && chainId) ? _getRpcListForChain(chainId) : [];
                const allRpcs = [...new Set([..._thRpcs, ..._chainRpcs, ...currentChainConfig.rpcs].filter(Boolean))];

                // Persist the full RPC list onto the hidden input so thWithFallback can use it
                const _rpcEl = document.getElementById('rpcUrl');
                if (_rpcEl && allRpcs.length) {
                    _rpcEl.value = allRpcs[0];
                    _rpcEl.setAttribute('data-rpcs', JSON.stringify(allRpcs));
                    if (chainId) _rpcEl.setAttribute('data-chainid', String(chainId));
                }

                // Use thWithFallback to connect — shows live badge, auto-switches on failure
                try {
                    provider = await window.thWithFallback('rpcUrl', async function(p) {
                        // Light probe: getBlockNumber to verify connectivity
                        await Promise.race([
                            p.getBlockNumber(),
                            new Promise((_, rej) => setTimeout(() => rej(new Error('probe timeout')), 4000))
                        ]);
                        return p;
                    }, 5000);
                    // Log connected RPC — only if _thLogInitialRpc hasn't already logged within 2500ms
                    try {
                        var _activeRpc = (typeof window.thGetActiveRpc === 'function') ? window.thGetActiveRpc('rpcUrl') : (allRpcs[0] || '');
                        if (_activeRpc) {
                            var _ipNow = Date.now();
                            var _ipLast = (window._thRpcLogTs && window._thRpcLogTs['rpcUrl']) || 0;
                            if (_ipNow - _ipLast >= 2500) {
                                if (!window._thRpcLogTs) window._thRpcLogTs = {};
                                window._thRpcLogTs['rpcUrl'] = _ipNow;
                            }
                        }
                    } catch(_) {}
                } catch(_) {
                    // Fallback: at least create a provider so wallet address can show
                    provider = window._thMakeProvider(allRpcs[0] || currentChainConfig.rpcs[0]);
                }

                // Re-check wallet balance if key already entered (increment seq so stale check is discarded)
                const privateKeyField = document.getElementById('privateKey');
                if (privateKeyField && privateKeyField.value.trim()) {
                    _walletCheckSeq++; // invalidate any in-flight check
                    const event = new Event('input', { bubbles: true });
                    privateKeyField.dispatchEvent(event);
                }
            } catch (error) {
            }
        }
