
        // ========================================
        // MULTI KEY NATIVE - CONTRACT MANAGEMENT
        // ========================================
        
        let savedContractsMultiKeyNative = [];
        let activeContractAddressMultiKeyNative = null;
        let deployedContractAddressMultiKeyNative = null;
        
        function loadSavedContractsMultiKeyNative() {
            const saved = localStorage.getItem('multiKeyNativeContracts');
            if (saved) {
                try {
                    savedContractsMultiKeyNative = JSON.parse(saved);
                    // Always start deselected on page/HTML open
                    savedContractsMultiKeyNative.forEach(c => c.isActive = false);
                    localStorage.setItem('multiKeyNativeContracts', JSON.stringify(savedContractsMultiKeyNative));
                    renderSavedContractsMultiKeyNative();
                } catch (e) {
                    savedContractsMultiKeyNative = [];
                }
            }
        }

        function saveContractMultiKeyNative(address, chainName, chainId, chainSymbol, ownerAddress) {
            const existing = savedContractsMultiKeyNative.findIndex(c => 
                c.address.toLowerCase() === address.toLowerCase() && c.chainId === chainId
            );
            
            // Mark all as inactive
            savedContractsMultiKeyNative.forEach(c => c.isActive = false);
            
            const rpcUrl = document.getElementById('rpcUrlMultiKeyNative').value.trim();
            const _thRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('rpcUrlMultiKeyNative') : (rpcUrl ? [rpcUrl] : []);
            const _thChainId = parseInt((document.getElementById('rpcUrlMultiKeyNative')||{}).getAttribute?.('data-chainid')||'',10)||null;
            
            const contractData = {
                address: address,
                chainName: chainName,
                chainId: chainId,
                chainSymbol: chainSymbol,
                deployedAt: new Date().toISOString(),
                isActive: true,
                rpcUrl: rpcUrl,
                ownerAddress: ownerAddress || ''
            };
            
            if (existing >= 0) {
                savedContractsMultiKeyNative[existing] = contractData;
            } else {
                savedContractsMultiKeyNative.unshift(contractData);
            }
            
            // Keep only last 10 contracts
            if (savedContractsMultiKeyNative.length > 10) {
                savedContractsMultiKeyNative = savedContractsMultiKeyNative.slice(0, 10);
            }
            
            localStorage.setItem('multiKeyNativeContracts', JSON.stringify(savedContractsMultiKeyNative));
            renderSavedContractsMultiKeyNative();
            
        }

        async function loadContractMultiKeyNative(address, silentVerify) {
            activeContractAddressMultiKeyNative = address;
            deployedContractAddressMultiKeyNative = address;
            
            const contract = savedContractsMultiKeyNative.find(c => c.address.toLowerCase() === address.toLowerCase());
            
            if (contract) {
                // Mark as active
                savedContractsMultiKeyNative.forEach(c => c.isActive = false);
                contract.isActive = true;
                localStorage.setItem('multiKeyNativeContracts', JSON.stringify(savedContractsMultiKeyNative));
                
                // Update UI
                const explorerUrl = getTHExplorerFromConfig(currentMultiKeyNativeChainConfig);
                // (contract info box removed)
                
                
                
                renderSavedContractsMultiKeyNative();
                
                
                // Verify contract functions if RPC URL is available
                if (contract.rpcUrl) {
                    try {
                                                const _vcmChainId = contract.chainId || null;
                        const _vcmRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('rpcUrlMultiKeyNative') : [];
                        if (contract.rpcUrl && !_vcmRpcs.includes(contract.rpcUrl)) _vcmRpcs.unshift(contract.rpcUrl);
                        let provider;
                        // FIX: use thWithFallback for automatic multi-RPC failover
                        try {
                          provider = await window.thWithFallback('rpcUrlMultiKeyNative', async function(_p) {
                            await Promise.race([_p.getBlockNumber(), new Promise((_,r)=>setTimeout(()=>r(new Error('probe timeout')),5000))]);
                            return _p;
                          }, 5000);
                        } catch(_thErr) {
                          const _fbCid63722 = parseInt((document.getElementById('rpcUrlMultiKeyNative')||{}).getAttribute?.('data-chainid')||'',10)||null;
                          provider = window._thMakeProvider(rpcUrl, _fbCid63722);
                        }
                        if (!provider) provider = window._thMakeProvider(contract.rpcUrl);
                        const functionExists = await verifyMultiRecipientContractFunction(address, provider);
                        
                        if (functionExists) {
                            if (!silentVerify) logMessageMultiKeyNative('success', '✅ Contract functions verified!');
                        } else {
                            logMessageMultiKeyNative('error', '❌ Contract functions পাওয়া যায়নি - contract ব্যবহার করা যাবে না');
                        }
                    } catch (error) {
                        logMessageMultiKeyNative('warning', '⚠️ Could not verify contract - RPC connection failed');
                                            }
                } else {
                    // No RPC URL available
                }
                // Re-evaluate all button states based on current inputs + contract
                updateButtonStates();
            }
        }

        function renderSavedContractsMultiKeyNative() {
            const container = document.getElementById('savedContractsListMultiKeyNative');
            const header = document.getElementById('savedContractsHeaderMultiKeyNative');
            const countSpan = document.getElementById('savedContractsCountMultiKeyNative');

            // Filter: show ONLY contracts for the currently selected chain
            const _selCid = parseInt(currentMultiKeyNativeChainConfig?.chainId || 0, 10);
            const _filtered = _selCid
                ? savedContractsMultiKeyNative.filter(c => parseInt(c.chainId || 0, 10) === _selCid)
                : savedContractsMultiKeyNative;

            // No contracts for this chain → hide everything
            if (_filtered.length === 0) {
                container.classList.remove('active');
                container.innerHTML = '';
                header.style.display = 'none';
                return;
            }

            header.style.display = 'block';
            countSpan.textContent = _filtered.length;
            container.classList.add('active');
            container.innerHTML = '';

            _filtered.forEach(contract => {
                const item = document.createElement('div');
                item.className = 'saved-contract-item' + (contract.isActive ? ' active' : '');

                // ── Checkbox indicator ──
                const checkbox = document.createElement('div');
                checkbox.className = 'saved-contract-checkbox';
                checkbox.textContent = contract.isActive ? '✓' : '';
                checkbox.title = contract.isActive ? 'Selected — click to deselect' : 'Click to select';

                // ── Body ──
                const bodyDiv = document.createElement('div');
                bodyDiv.className = 'saved-contract-body';

                const addressDiv = document.createElement('div');
                addressDiv.className = 'saved-contract-address';

                const explorerUrl = getTHExplorer(contract.chainId);
                const addr = contract.address || '';
                const shortAddr = addr.length > 20 ? addr.slice(0, 10) + '…' + addr.slice(-8) : addr;

                const explorerLink = document.createElement('a');
                explorerLink.href = `${explorerUrl}/address/${addr}`;
                explorerLink.target = '_blank';
                explorerLink.rel = 'noopener noreferrer';
                explorerLink.className = 'log-link';
                explorerLink.textContent = shortAddr;
                explorerLink.title = addr;
                explorerLink.onclick = (e) => { e.stopPropagation(); };
                addressDiv.appendChild(explorerLink);

                const metaDiv = document.createElement('div');
                metaDiv.className = 'saved-contract-meta';

                const resolvedChainName = contract.chainName
                    || (contract.chainId && typeof getAllChains === 'function'
                        ? (getAllChains().find(c => c.chainId === contract.chainId)?.name || ('Chain ' + contract.chainId))
                        : (contract.chainId ? 'Chain ' + contract.chainId : '—'));

                const _chainLink = document.createElement('span');
                _chainLink.className = 'saved-contract-chain';
                _chainLink.textContent = '⛓ ' + resolvedChainName;
                if (contract.chainId) {
                    _chainLink.style.cursor = 'pointer';
                    _chainLink.title = resolvedChainName + ' — click to open explorer';
                    _chainLink.onclick = (e) => {
                        e.stopPropagation();
                        window.open(window.getTHExplorer ? window.getTHExplorer(contract.chainId) : 'https://etherscan.io', '_blank', 'noopener');
                    };
                }
                metaDiv.appendChild(_chainLink);
                metaDiv.appendChild(document.createTextNode(` • ${new Date(contract.deployedAt).toLocaleDateString()}`));

                bodyDiv.appendChild(addressDiv);
                bodyDiv.appendChild(metaDiv);

                item.appendChild(checkbox);
                item.appendChild(bodyDiv);

                // Click → toggle select / deselect
                item.onclick = () => {
                    if (contract.isActive) {
                        // Deselect
                        savedContractsMultiKeyNative.forEach(c => c.isActive = false);
                        localStorage.setItem('multiKeyNativeContracts', JSON.stringify(savedContractsMultiKeyNative));
                        activeContractAddressMultiKeyNative = null;
                        deployedContractAddressMultiKeyNative = null;
                        renderSavedContractsMultiKeyNative();
                        if (typeof updateButtonStates === 'function') updateButtonStates();
                    } else {
                        // Select
                        loadContractMultiKeyNative(contract.address);
                    }
                };

                container.appendChild(item);
            });
        }

