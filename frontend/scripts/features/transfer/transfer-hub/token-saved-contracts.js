        
        // ========================================
        // TOKEN CONTRACT MANAGEMENT FUNCTIONS
        // ========================================
        
        function loadSavedContractsToken() {
            const saved = localStorage.getItem('batchTransferContractsToken');
            if (saved) {
                try {
                    savedContractsToken = JSON.parse(saved);
                    // Always start deselected on page/HTML open
                    savedContractsToken.forEach(c => c.isActive = false);
                    localStorage.setItem('batchTransferContractsToken', JSON.stringify(savedContractsToken));
                    renderSavedContractsToken();
                } catch (e) {
                    savedContractsToken = [];
                }
            }
        }

        function saveContractToken(address, chainName, chainId, chainSymbol, ownerAddress) {
            const existing = savedContractsToken.findIndex(c => 
                c.address.toLowerCase() === address.toLowerCase() && c.chainId === chainId
            );
            
            // Mark all as inactive
            savedContractsToken.forEach(c => c.isActive = false);
            
            const rpcUrl = document.getElementById('rpcUrlToken').value.trim();
            const _thRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('rpcUrlToken') : (rpcUrl ? [rpcUrl] : []);
            const _thChainId = parseInt((document.getElementById('rpcUrlToken')||{}).getAttribute?.('data-chainid')||'',10)||null;
            
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
                savedContractsToken[existing] = contractData;
            } else {
                savedContractsToken.unshift(contractData);
            }
            
            // Keep only last 10 contracts
            if (savedContractsToken.length > 10) {
                savedContractsToken = savedContractsToken.slice(0, 10);
            }
            
            localStorage.setItem('batchTransferContractsToken', JSON.stringify(savedContractsToken));
            
            // ALSO ADD TO CENTRAL STORAGE FOR WITHDRAW MANAGER
            addToCentralContracts({
                ...contractData,
                type: 'token',
                section: 'Batch Transfer Token',
                symbol: chainSymbol
            });
            
            renderSavedContractsToken();
            
        }

        async function loadContractToken(address, silentVerify) {
            activeContractAddressToken = address;
            deployedContractAddressToken = address;
            
            const contract = savedContractsToken.find(c => c.address.toLowerCase() === address.toLowerCase());
            
            if (contract) {
                // Mark as active
                savedContractsToken.forEach(c => c.isActive = false);
                contract.isActive = true;
                localStorage.setItem('batchTransferContractsToken', JSON.stringify(savedContractsToken));
                
                // Update UI with clickable address
                const explorerUrl = getTHExplorerFromConfig(currentTokenChainConfig);
                const _ciT = document.getElementById('currentContractInfoToken');
                if (_ciT) _ciT.classList.add('active');
                
                const addressElement = document.getElementById('currentContractAddressToken');
                const shortAddress = address.substring(0, 10) + '...' + address.substring(address.length - 8);
                if (addressElement) addressElement.innerHTML = `<a href="${explorerUrl}/address/${address}" target="_blank" rel="noopener noreferrer" class="log-link" title="View on block explorer">${shortAddress}</a>`;
                
                const _ccT = document.getElementById('currentContractChainToken');
                if (_ccT) _ccT.textContent = contract.chainName;
                const _cdT = document.getElementById('currentContractDateToken');
                if (_cdT) _cdT.textContent = new Date(contract.deployedAt).toLocaleString();
                
                renderSavedContractsToken();
                
                                
                // Verify contract functions if RPC URL is available
                if (contract.rpcUrl) {
                    try {
                                                const _vctChainId = contract.chainId || null;
                        const _vctRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('rpcUrlToken') : [];
                        if (contract.rpcUrl && !_vctRpcs.includes(contract.rpcUrl)) _vctRpcs.unshift(contract.rpcUrl);
                        let provider;
                        // FIX: use thWithFallback for automatic multi-RPC failover
                        try {
                          provider = await window.thWithFallback('rpcUrlToken', async function(_p) {
                            await Promise.race([_p.getBlockNumber(), new Promise((_,r)=>setTimeout(()=>r(new Error('probe timeout')),5000))]);
                            return _p;
                          }, 5000);
                        } catch(_thErr) {
                          const _fbCid61108 = parseInt((document.getElementById('rpcUrlToken')||{}).getAttribute?.('data-chainid')||'',10)||null;
                          provider = window._thMakeProvider(rpcUrl, _fbCid61108);
                        }
                        if (!provider) provider = window._thMakeProvider(contract.rpcUrl);
                        const functionExists = await verifyTokenContractFunction(address, provider);
                        
                        if (functionExists) {
                            if (!silentVerify) logMessageToken('success', '✅ Contract functions verified!');
                            if (typeof validateTokenInputs === 'function') validateTokenInputs();
                                                    } else {
                            logMessageToken('error', '❌ executeTransfer function পাওয়া যায়নি - contract ব্যবহার করা যাবে না');
                            document.getElementById('executeBtnToken').disabled = true;
                        }
                    } catch (error) {
                        logMessageToken('warning', '⚠️ Could not verify contract - RPC connection failed');
                                                    if (typeof validateTokenInputs === 'function') validateTokenInputs();
                    }
                } else {
                    // No RPC URL available, enable button anyway
                            if (typeof validateTokenInputs === 'function') validateTokenInputs();
                                    }
            }
        }

        function deleteContractToken(address, chainId) {
            if (!confirm('Are you sure you want to delete this contract?')) {
                return;
            }
            
            savedContractsToken = savedContractsToken.filter(c => 
                !(c.address.toLowerCase() === address.toLowerCase() && c.chainId === chainId)
            );
            
            localStorage.setItem('batchTransferContractsToken', JSON.stringify(savedContractsToken));
            
            if (activeContractAddressToken?.toLowerCase() === address.toLowerCase()) {
                activeContractAddressToken = null;
                deployedContractAddressToken = null;
                const _ciTR = document.getElementById('currentContractInfoToken'); if (_ciTR) _ciTR.classList.remove('active');
                document.getElementById('executeBtnToken').disabled = true;
            }
            
            renderSavedContractsToken();
                    }

        function clearAllContractsToken() {
            if (savedContractsToken.length === 0) {
                return;
            }
            
            const contractCount = savedContractsToken.length;
            
            if (!confirm(`Are you sure you want to delete all ${contractCount} saved contract(s)?\n\nThis action cannot be undone.`)) {
                return;
            }
            
            // Clear all contracts
            savedContractsToken = [];
            localStorage.setItem('batchTransferContractsToken', JSON.stringify(savedContractsToken));
            
            // Reset active contract
            activeContractAddressToken = null;
            deployedContractAddressToken = null;
            const _ciTR = document.getElementById('currentContractInfoToken'); if (_ciTR) _ciTR.classList.remove('active');
            document.getElementById('executeBtnToken').disabled = true;
            
            // Update UI
            renderSavedContractsToken();
            
                    }

        function renderSavedContractsToken() {
            const container = document.getElementById('savedContractsListToken');
            const header = document.getElementById('savedContractsHeaderToken');
            const countSpan = document.getElementById('savedContractsCountToken');
            const toggleBtn = document.getElementById('savedContractsToggleBtnToken');
            
            // Filter: show only contracts for the currently selected token chain
            const currentTokenChainId = currentTokenChainConfig?.chainId || null;
            const visibleContractsToken = currentTokenChainId
                ? savedContractsToken.filter(c => c.chainId === currentTokenChainId)
                : savedContractsToken;
            
            if (visibleContractsToken.length === 0) {
                container.classList.remove('active');
                header.style.display = 'none';
                return;
            }
            
            header.style.display = 'block';
            countSpan.textContent = visibleContractsToken.length;
            container.classList.add('active');
            container.innerHTML = '';

            // Update toggle button label based on whether any contract is active
            if (toggleBtn) {
                const anyActiveToken = visibleContractsToken.some(c => c.isActive);
                toggleBtn.textContent = anyActiveToken ? '☐ Deselect' : '☑ Select All';
            }
            
            visibleContractsToken.forEach(contract => {
                const item = document.createElement('div');
                item.className = 'saved-contract-item' + (contract.isActive ? ' active' : '');

                // ── Address row ──
                const addressDiv = document.createElement('div');
                addressDiv.className = 'saved-contract-address';

                const addr = contract.address || '';
                const shortAddr = addr.length > 20 ? addr.slice(0, 10) + '…' + addr.slice(-8) : addr;

                const explorerUrl = getTHExplorer(contract.chainId);
                const explorerLink = document.createElement('a');
                explorerLink.href = `${explorerUrl}/address/${addr}`;
                explorerLink.target = '_blank';
                explorerLink.rel = 'noopener noreferrer';
                explorerLink.className = 'log-link';
                explorerLink.textContent = shortAddr;
                explorerLink.title = addr;
                explorerLink.onclick = (e) => { e.stopPropagation(); };

                addressDiv.appendChild(explorerLink);

                // ── Owner address row (Token) ──
                if (contract.ownerAddress) {
                    const ownerDivT = document.createElement('div');
                    ownerDivT.style.cssText = 'font-size:0.68rem;color:#6b7280;margin-bottom:3px;font-family:var(--font-mono,monospace);';
                    const owT = contract.ownerAddress;
                    const shortOwnerT = owT.length > 12 ? owT.slice(0,6) + '…' + owT.slice(-4) : owT;
                    ownerDivT.innerHTML = '<span style="color:#4a4a65;">Owner: </span><span style="color:#94a3b8;">' + shortOwnerT + '</span>';
                    ownerDivT.title = owT;
                    addressDiv.appendChild(ownerDivT);
                }

                // ── Meta row ──
                const metaDiv = document.createElement('div');
                metaDiv.className = 'saved-contract-meta';

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
                    // Toggle: if already active, deselect; otherwise load/select
                    if (contract.isActive) {
                        savedContractsToken.forEach(c => c.isActive = false);
                        localStorage.setItem('batchTransferContractsToken', JSON.stringify(savedContractsToken));
                        deployedContractAddressToken = null;
                        renderSavedContractsToken();
                        if (typeof validateTokenInputs === 'function') validateTokenInputs();
                    } else {
                        loadContractToken(contract.address);
                    }
                };
                
                container.appendChild(item);
            });
        }