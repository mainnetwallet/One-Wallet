        // Debounced auto-load — prevents multiple rapid calls
        let _autoLoadTimer = null;
        function autoLoadContracts() {
            clearTimeout(_autoLoadTimer);
            _autoLoadTimer = setTimeout(() => {
                loadAllContracts();
            }, 0);
        }
        
        let _loadAllContractsRunning = false;
        async function loadAllContracts() {
            // Guard: skip if already running to prevent duplicate parallel calls
            if (_loadAllContractsRunning) return;
            _loadAllContractsRunning = true;
            try {
                
                // ── CHAIN FILTER: only show contracts for the currently selected chain ──
                // Get selected chainId from withdrawRpcUrl data-chainid attribute
                // or from currentChainConfigWithdraw variable
                let _selectedChainId = null;
                try {
                    const _rpcEl = document.getElementById('withdrawRpcUrl');
                    if (_rpcEl) {
                        const _attrId = parseInt(_rpcEl.getAttribute('data-chainid') || '', 10);
                        if (!isNaN(_attrId) && _attrId > 0) _selectedChainId = _attrId;
                    }
                    if (!_selectedChainId && typeof currentChainConfigWithdraw !== 'undefined' && currentChainConfigWithdraw) {
                        _selectedChainId = currentChainConfigWithdraw.chainId || null;
                    }
                } catch(_e) {}

                // Get from CENTRAL storage
                const _allContractsRaw = getCentralContracts();
                
                // Filter by selected chain if a chain is selected
                let allContracts;
                if (_selectedChainId) {
                    allContracts = _allContractsRaw.filter(c => {
                        // chainId may be stored as string or number — compare as integers
                        const cid = parseInt(c.chainId || c.chain_id || c.chainid || 0, 10);
                        return cid > 0 && cid === _selectedChainId;
                    });
                } else {
                    allContracts = _allContractsRaw;
                }
                
                const contractsList = document.getElementById('contractsList');

                if (allContracts.length === 0) {
                    const _noContractMsg = _selectedChainId
                        ? `No contracts found for the selected chain. Deploy a contract on this chain or switch chain.`
                        : `Deploy contracts or add manually using "➕ Add Manually" button`;
                    contractsList.innerHTML = `
                        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: #888;">
                            <div style="font-size: 4rem; margin-bottom: 15px; opacity: 0.5;">📦</div>
                            <div style="font-size: 1.1rem; font-weight: 600; margin-bottom: 8px;">${_selectedChainId ? 'No Contracts on This Chain' : 'No Contracts Deployed Yet'}</div>
                            <div style="font-size: 0.9rem; opacity: 0.7;">${_noContractMsg}</div>
                        </div>
                    `;
                    logMessageWithdraw('warning', _selectedChainId
                        ? `⚠️ No contracts found for selected chain (chainId: ${_selectedChainId}).`
                        : '⚠️ No contracts found. Deploy contracts first.');
                    document.getElementById('contractCount').textContent = '0';
                    return;
                }
                
                contractsList.innerHTML = '';
                
                for (let i = 0; i < allContracts.length; i++) {
                    const contract = allContracts[i];
                    
                    try {
                        // Use contract's own RPC URL to check balance
                        let nativeBalanceEth = '0.000000';
                        let balanceCheckStatus = '⏳ Checking...';
                        let ownerAddress = 'Loading...';
                        
                        if (contract.rpcUrl) {
                            try {
                                const _lacChainId = contract.chainId || null;
                                const _lacRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('withdrawRpcUrl') : [];
                                if (contract.rpcUrl && !_lacRpcs.includes(contract.rpcUrl)) _lacRpcs.unshift(contract.rpcUrl);
                                // FIX: rpcUrl was undefined in this scope; iterate _lacRpcs with fallback
                                let provider;
                                for (const _lacRpc of (_lacRpcs.length ? _lacRpcs : [contract.rpcUrl])) {
                                  try {
                                    const _p = window._thMakeProvider(_lacRpc, _lacChainId);
                                    await Promise.race([_p.getBlockNumber(), new Promise((_,r)=>setTimeout(()=>r(new Error('timeout')),5000))]);
                                    provider = _p; break;
                                  } catch(_e) { continue; }
                                }
                                if (!provider) provider = window._thMakeProvider(contract.rpcUrl, _lacChainId);
                                
                                // Get native balance
                                const nativeBalance = await window.thRead('withdrawRpcUrl', provider, function(_p) { return _p.getBalance(contract.address); }, 6000);
                                nativeBalanceEth = ethers.formatEther(nativeBalance);
                                balanceCheckStatus = '✅';
                                
                                // Get owner address from contract
                                try {
                                    const contractABI = [
                                        "function owner() view returns (address)"
                                    ];
                                    const contractInstance = new ethers.Contract(contract.address, contractABI, provider);
                                    ownerAddress = await contractInstance.owner();
                                } catch (ownerError) {
                                    ownerAddress = 'Unable to fetch';
                                }
                                
                            } catch (balanceError) {
                                balanceCheckStatus = '⚠️ RPC Error';
                                ownerAddress = 'RPC Error';
                            }
                        } else {
                            balanceCheckStatus = '⚠️ No RPC';
                            ownerAddress = 'No RPC URL';
                        }
                        
                        // Create contract card with compact design
                        const card = document.createElement('div');
                        card.setAttribute('data-contract-addr', contract.address);
                        card.style.cssText = `
                            background: linear-gradient(135deg, #111518 0%, #141820 100%);
                            border: 1px solid #1e2530;
                            border-radius: 10px;
                            padding: 9px 11px;
                            transition: all 0.25s;
                            position: relative;
                            overflow: hidden;
                            cursor: pointer;
                        `;
                        
                        const _wdCardAddr = contract.address;
                        const _wdCardType = contract.type;
                        const _wdCardChain = contract.chainName || contract.chain || 'Unknown';
                        const _wdCardSym = contract.symbol || 'ETH';
                        const _wdCardRpc = contract.rpcUrl || '';
                        
                        card.onclick = (e) => {
                            // Don't trigger if clicking on buttons or explorer links
                            if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
                            if (e.target.getAttribute('title') && e.target.getAttribute('title').includes('explorer')) return;
                            const _isSelected = window.selectedWithdrawContract && window.selectedWithdrawContract.address === _wdCardAddr;
                            if (_isSelected) {
                                // Deselect
                                window.selectedWithdrawContract = null;
                                if (typeof currentSelectedContract !== 'undefined') currentSelectedContract = null;
                                window.isOwnerVerified = false;
                                if (typeof isOwnerVerified !== 'undefined') isOwnerVerified = false;
                                safeHideElement('selectedContractInfoBox');
                                safeHideElement('withdrawInputs');
                                safeShowElement('noContractSelected');
                                // Reset card style
                                card.style.borderColor = '#1e2530';
                                card.style.boxShadow = 'none';
                                card.style.background = 'linear-gradient(135deg, #111518 0%, #141820 100%)';
                            } else {
                                // Deselect all other cards first
                                document.querySelectorAll('[data-contract-addr]').forEach(c => {
                                    c.style.borderColor = '#1e2530';
                                    c.style.boxShadow = 'none';
                                    c.style.background = 'linear-gradient(135deg, #111518 0%, #141820 100%)';
                                });
                                // Highlight this card
                                card.style.borderColor = '#3a7abf';
                                card.style.boxShadow = '0 0 0 1px #1a4a7a, 0 4px 20px rgba(74,158,255,0.15)';
                                card.style.background = 'linear-gradient(135deg, #0e1c2e 0%, #0f1e30 100%)';
                                selectContractForWithdraw(_wdCardAddr, _wdCardType, _wdCardChain, _wdCardSym, _wdCardRpc);
                            }
                        };
                        
                        card.onmouseenter = () => {
                            const _sel = window.selectedWithdrawContract && window.selectedWithdrawContract.address === _wdCardAddr;
                            if (!_sel) {
                                card.style.borderColor = '#2a4a6a';
                                card.style.transform = 'translateY(-1px)';
                                card.style.boxShadow = '0 4px 16px rgba(74,158,255,0.10)';
                                card.style.background = 'linear-gradient(135deg, #131820 0%, #171d28 100%)';
                            }
                        };
                        
                        card.onmouseleave = () => {
                            const _sel = window.selectedWithdrawContract && window.selectedWithdrawContract.address === _wdCardAddr;
                            if (!_sel) {
                                card.style.borderColor = '#1e2530';
                                card.style.transform = 'translateY(0)';
                                card.style.boxShadow = 'none';
                                card.style.background = 'linear-gradient(135deg, #111518 0%, #141820 100%)';
                            } else {
                                card.style.transform = 'translateY(0)';
                            }
                        };
                        
                        const typeText = contract.type === 'native' || contract.type === 'NATIVE' ? 'Native' : 'Token';
                        const typeColor = contract.type === 'native' || contract.type === 'NATIVE' ? '#10b981' : '#f59e0b';
                        const _wdHasBal = parseFloat(nativeBalanceEth) > 0;
                        const _wdOwnerShort = ownerAddress.length > 12 ? ownerAddress.slice(0,6)+'...'+ownerAddress.slice(-4) : ownerAddress;
                        const _wdAddrShort = contract.address.length > 14 ? contract.address.slice(0,8)+'...'+contract.address.slice(-6) : contract.address;
                        
                        // Compact row (styles: th-withdraw-manager-theme.css). Handlers and arguments are unchanged.
                        card.className = 'wd-crow';
                        card.innerHTML = `
                            <div class="wd-cmain">
                                <div class="wd-ctop">
                                    <span class="wd-cname">Contract #${i + 1}</span>
                                    <span class="wd-ctype" style="background:${typeColor}22;color:${typeColor};">${typeText.toUpperCase()}</span>
                                    <span class="wd-cbal" style="color:${_wdHasBal?'#34d399':'#666'};">${parseFloat(nativeBalanceEth).toFixed(4)} <small>${contract.symbol||'ETH'}</small></span>
                                </div>
                                <div class="wd-caddr">
                                    <span class="wd-caddr-t" title="${contract.address}">${_wdAddrShort}</span>
                                    <button type="button" class="wd-cbtn wd-cbtn-ext" onclick="event.stopPropagation();(function(){var _cid=${contract.chainId||0};var _exp=_cid&&window.getTHExplorer?window.getTHExplorer(_cid):'https://etherscan.io';window.open(_exp+'/address/${contract.address}','_blank','noopener');})();" title="View contract on explorer" aria-label="View contract on explorer"><span class="material-icons-round">open_in_new</span></button>
                                </div>
                                <div class="wd-cmeta">${contract.chainName||contract.chain||'Unknown'} · owner <span class="wd-cowner" title="${ownerAddress}" onclick="event.stopPropagation();(function(){var _cid=${contract.chainId||0};var _exp=_cid&&window.getTHExplorer?window.getTHExplorer(_cid):'https://etherscan.io';if('${ownerAddress}'.startsWith('0x')){window.open(_exp+'/address/${ownerAddress}','_blank','noopener');}})();">${_wdOwnerShort}</span></div>
                            </div>
                            <div class="wd-cacts">
                                <button type="button" class="wd-cbtn" onclick="selectContractForWithdraw('${contract.address}','${contract.type}','${contract.chainName||contract.chain||'Unknown'}','${contract.symbol||'ETH'}','${contract.rpcUrl||''}')" title="Select for withdraw" aria-label="Select for withdraw"><span class="material-icons-round">account_balance_wallet</span></button>
                                <button type="button" class="wd-cbtn wd-cbtn-del" onclick="deleteFromWithdrawManager('${contract.address}')" title="Delete contract" aria-label="Delete contract"><span class="material-icons-round">delete_outline</span></button>
                            </div>
                        `;
                        
                        contractsList.appendChild(card);
                        
                        
                    } catch (error) {
                    }
                }
                
                document.getElementById('contractCount').textContent = allContracts.length;
                
                // Re-highlight selected card if any contract is still selected
                const _reSelAddr = window.selectedWithdrawContract && window.selectedWithdrawContract.address;
                if (_reSelAddr) {
                    const _reSelCard = document.querySelector('[data-contract-addr="' + _reSelAddr + '"]');
                    if (_reSelCard) {
                        _reSelCard.style.borderColor = '#3a7abf';
                        _reSelCard.style.boxShadow = '0 0 0 1px #1a4a7a, 0 4px 20px rgba(74,158,255,0.15)';
                        _reSelCard.style.background = 'linear-gradient(135deg, #0e1c2e 0%, #0f1e30 100%)';
                    }
                }
                
            } catch (error) {
                logMessageWithdraw('error', `❌ Error: ${error.message}`);
            } finally {
                _loadAllContractsRunning = false;
            }
        }