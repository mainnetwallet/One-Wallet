        
        // Contract Ownership Verification
        let currentSelectedContract = null;
        let isOwnerVerified = false;
        
        // ── Withdraw Execute Button Gate ──────────────────────────────────
        // Both buttons enable only when:
        //   • Contract is selected
        //   • Ownership has been verified (isOwnerVerified = true)
        //   • Recipient Address is filled
        // ─────────────────────────────────────────────────────────────────
        function checkWithdrawExecuteReady() {
            const recipient = (document.getElementById('withdrawRecipient')?.value || '').trim();
            const tokenAddress = (document.getElementById('withdrawTokenAddress')?.value || '').trim();
            const hasRecipient = recipient !== '';
            const hasTokenAddress = tokenAddress !== '' && (typeof ethers !== 'undefined' ? ethers.isAddress(tokenAddress) : /^0x[0-9a-fA-F]{40}$/.test(tokenAddress));
            const ready = isOwnerVerified && hasRecipient;

            const nativeBtn = document.getElementById('withdrawNativeBtn');
            const tokenBtn  = document.getElementById('withdrawTokenBtn');
            if (nativeBtn) {
                // Native disabled if token address is entered
                const nativeReady = ready && !hasTokenAddress;
                nativeBtn.disabled      = !nativeReady;
                nativeBtn.style.opacity = nativeReady ? '1' : '0.45';
                nativeBtn.style.cursor  = nativeReady ? 'pointer' : 'not-allowed';
            }
            if (tokenBtn) {
                const tokenReady = ready && hasTokenAddress;
                tokenBtn.disabled      = !tokenReady;
                tokenBtn.style.opacity = tokenReady ? '1' : '0.45';
                tokenBtn.style.cursor  = tokenReady ? 'pointer' : 'not-allowed';
            }
        }

        // which: 'native' | 'token' | undefined (both)
        function _wdSetLoading(isLoading, which) {
            const nativeBtn = document.getElementById('withdrawNativeBtn');
            const tokenBtn  = document.getElementById('withdrawTokenBtn');
            const _spinner  = '<span style="display:inline-flex;align-items:center;gap:6px;"><span style="width:13px;height:13px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;display:inline-block;animation:_wdSpin 0.7s linear infinite;"></span>Processing...</span>';
            if (isLoading) {
                // Both disabled while tx in flight, only clicked one shows spinner
                [nativeBtn, tokenBtn].forEach(function(btn) {
                    if (!btn) return;
                    btn.disabled      = true;
                    btn.style.opacity = '0.55';
                    btn.style.cursor  = 'not-allowed';
                });
                if (which === 'native') {
                    if (nativeBtn) nativeBtn.innerHTML = _spinner;
                    if (tokenBtn)  tokenBtn.innerHTML  = '🪙 Withdraw Token';
                } else if (which === 'token') {
                    if (tokenBtn)  tokenBtn.innerHTML  = _spinner;
                    if (nativeBtn) nativeBtn.innerHTML = '💵 Withdraw Native';
                } else {
                    if (nativeBtn) nativeBtn.innerHTML = _spinner;
                    if (tokenBtn)  tokenBtn.innerHTML  = _spinner;
                }
            } else {
                if (nativeBtn) { nativeBtn.innerHTML = '💵 Withdraw Native'; nativeBtn.disabled = false; nativeBtn.style.opacity = null; nativeBtn.style.cursor = null; }
                if (tokenBtn)  { tokenBtn.innerHTML  = '🪙 Withdraw Token';  tokenBtn.disabled  = false; tokenBtn.style.opacity  = null; tokenBtn.style.cursor  = null; }
                // Restore correct enabled/disabled state
                checkWithdrawExecuteReady();
            }
        }

        async function verifyContractOwnership() {
            // Get actual key from storage (not masked value)
            let developerKey = '';
            if (window.actualKeysStorage && window.actualKeysStorage['withdrawDeveloperKey']) {
                developerKey = window.actualKeysStorage['withdrawDeveloperKey'].trim();
            } else {
                developerKey = document.getElementById('withdrawDeveloperKey').value.trim();
            }
            
            const ownershipStatusDiv = document.getElementById('ownershipStatus');
            const ownershipIcon = document.getElementById('ownershipIcon');
            const ownershipTitle = document.getElementById('ownershipTitle');
            const ownershipMessage = document.getElementById('ownershipMessage');
            const withdrawNativeBtn = document.getElementById('withdrawNativeBtn');
            const withdrawTokenBtn = document.getElementById('withdrawTokenBtn');
            
            // Reset state
            isOwnerVerified = false;
            withdrawNativeBtn.disabled = true;
            withdrawTokenBtn.disabled = true;
            
            if (!developerKey || !currentSelectedContract) {
                ownershipStatusDiv.style.display = 'none';
                return;
            }
            
            // Sanitize the key
            developerKey = sanitisePrivateKey(developerKey);
            
            // Validate key format (should be 0x + 64 hex chars)
            const hexPart = developerKey.startsWith('0x') ? developerKey.slice(2) : developerKey;
            const isValidHex = /^[a-fA-F0-9]{64}$/.test(hexPart);
            
            if (!isValidHex || developerKey.length !== 66) {
                ownershipStatusDiv.style.display = 'block';
                ownershipStatusDiv.style.background = 'linear-gradient(135deg, #3a1a1a 0%, #4a1a1a 100%)';
                ownershipStatusDiv.style.border = '2px solid #ef4444';
                ownershipIcon.textContent = '❌';
                ownershipTitle.textContent = 'Invalid Private Key Format';
                ownershipTitle.style.color = '#ef4444';
                ownershipMessage.textContent = `Expected 64 hex characters, got ${hexPart.length}. Please check your private key.`;
                ownershipMessage.style.color = '#fca5a5';
                return;
            }
            
            try {
                // Show checking status
                ownershipStatusDiv.style.display = 'block';
                ownershipStatusDiv.style.background = 'linear-gradient(135deg, #1a2a3a 0%, #2a3a4a 100%)';
                ownershipStatusDiv.style.border = '2px solid #4a9eff';
                ownershipIcon.textContent = '⏳';
                ownershipTitle.textContent = 'Verifying Ownership...';
                ownershipTitle.style.color = '#4a9eff';
                ownershipMessage.textContent = 'Checking if you are the contract owner';
                ownershipMessage.style.color = '#7db8ff';
                
                // Create wallet from private key
                const wallet = new ethers.Wallet(developerKey);
                const userAddress = wallet.address;
                
                // Get RPC URL
                const rpcUrl = document.getElementById('withdrawRpcUrl').value.trim();
                const _thRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('withdrawRpcUrl') : (rpcUrl ? [rpcUrl] : []);
                const _thChainId = parseInt((document.getElementById('withdrawRpcUrl')||{}).getAttribute?.('data-chainid')||'',10)||null;
                if (!rpcUrl) {
                    throw new Error('RPC URL not found');
                }
                
                // Create provider
                // FIX: use thWithFallback for automatic multi-RPC failover
                let provider;
                try {
                  provider = await window.thWithFallback('withdrawRpcUrl', async function(_p) {
                    await Promise.race([_p.getBlockNumber(), new Promise((_,r)=>setTimeout(()=>r(new Error('probe timeout')),5000))]);
                    return _p;
                  }, 5000);
                } catch(_thErr) {
                  // All RPCs in list failed — fall back to single URL so caller can surface error naturally
                  const _fbCid = parseInt((document.getElementById('withdrawRpcUrl')||{}).getAttribute?.('data-chainid')||'',10)||null;
                  provider = window._thMakeProvider(rpcUrl, _fbCid);
                }
                
                // Contract ABI for owner() function
                const CONTRACT_ABI = [
                    "function owner() view returns (address)"
                ];
                
                // Create contract instance
                const contract = new ethers.Contract(
                    currentSelectedContract.address,
                    CONTRACT_ABI,
                    provider
                );
                
                // Get owner address
                const ownerAddress = await contract.owner();
                
                
                // Compare addresses
                if (userAddress.toLowerCase() === ownerAddress.toLowerCase()) {
                    // Success - User is owner
                    isOwnerVerified = true;
                    ownershipStatusDiv.style.background = 'linear-gradient(135deg, #1a3a2a 0%, #2a4a3a 100%)';
                    ownershipStatusDiv.style.border = '2px solid #10b981';
                    ownershipIcon.textContent = '✅';
                    ownershipTitle.textContent = 'Ownership Verified';
                    ownershipTitle.style.color = '#10b981';
                    ownershipMessage.textContent = `You are the owner of this contract. Withdraw enabled.`;
                    ownershipMessage.style.color = '#6ee7b7';
                    
                    // Enable withdraw buttons (gated by recipient too)
                    checkWithdrawExecuteReady();
                    
                } else {
                    // Failed - User is not owner
                    isOwnerVerified = false;
                    ownershipStatusDiv.style.background = 'linear-gradient(135deg, #3a1a1a 0%, #4a2a2a 100%)';
                    ownershipStatusDiv.style.border = '2px solid #ef4444';
                    ownershipIcon.textContent = '🚫';
                    ownershipTitle.textContent = 'Access Denied';
                    ownershipTitle.style.color = '#ef4444';
                    ownershipMessage.textContent = `This private key is not the contract owner. Owner: ${ownerAddress.substring(0, 10)}...${ownerAddress.substring(ownerAddress.length - 8)}`;
                    ownershipMessage.style.color = '#fca5a5';
                    
                    logMessageWithdraw('error', `❌ Access denied! This key is not the contract owner`);
                }
                
            } catch (error) {
                // Error occurred
                isOwnerVerified = false;
                ownershipStatusDiv.style.display = 'block';
                ownershipStatusDiv.style.background = 'linear-gradient(135deg, #3a2a1a 0%, #4a3a2a 100%)';
                ownershipStatusDiv.style.border = '2px solid #f59e0b';
                ownershipIcon.textContent = '⚠️';
                ownershipTitle.textContent = 'Verification Failed';
                ownershipTitle.style.color = '#f59e0b';
                ownershipMessage.textContent = `Error: ${error.message}`;
                ownershipMessage.style.color = '#fbbf24';
                
                logMessageWithdraw('error', `❌ Ownership verification failed: ${error.message}`);
            }
        }
        
        function _mcSetHomeChain() {
            var _hcId = (typeof activeHomeChainId !== 'undefined' && activeHomeChainId !== null) ? activeHomeChainId : null;
            var chain = (_hcId ? getAllTHChains().find(function(c){ return c.chainId === _hcId; }) : null)
                     || getAllTHChains().find(function(c){ return c.chainId === 8453; })
                     || getAllTHChains().find(function(c){ return c.name === 'Base'; })
                     || getAllTHChains()[0];
            if (!chain) return;
            manualSelectedChain = chain;
            // Set hidden RPC field + data attrs
            var rpcEl = document.getElementById('manualContractRpc');
            var fullRpcs = (chain.rpcs && chain.rpcs.length) ? chain.rpcs : (chain.rpc ? [chain.rpc] : []);
            try {
                if (typeof _getRpcListForChain === 'function' && chain.chainId) {
                    var _rl = _getRpcListForChain(chain.chainId);
                    if (_rl && _rl.length) fullRpcs = _rl;
                }
            } catch(_) {}
            if (rpcEl) {
                rpcEl.value = fullRpcs[0] || chain.rpc || '';
                rpcEl.setAttribute('data-rpcs', JSON.stringify(fullRpcs));
                rpcEl.setAttribute('data-chainid', chain.chainId || '');
            }
            // Update display
            var nameEl  = document.getElementById('manualSelectedChainName');
            var subEl   = document.getElementById('manualSelectedChainSymbol');
            var emojiEl = document.getElementById('manualChainEmoji');
            if (nameEl)  nameEl.textContent  = chain.name;
            if (subEl)   subEl.textContent   = chain.symbol + (chain.chainId ? ' · Chain ID: ' + chain.chainId : '');
            if (emojiEl && typeof mcspUpdateTrigger === 'function') mcspUpdateTrigger(chain);
        }
        
        // Manual Contract Add Modal Functions
        let manualSelectedChain = null;
        
        function openManualContractModal() {
            document.getElementById('manualContractModal').classList.add('active');
            _mcSetHomeChain();
            // Show/hide token address field based on type
            document.getElementById('manualContractType').addEventListener('change', function() {
                const tokenGroup = document.getElementById('manualTokenAddressGroup');
                tokenGroup.style.display = this.value === 'TOKEN' ? 'block' : 'none';
            });
                    }
        
        function closeManualContractModal() {
            document.getElementById('manualContractModal').classList.remove('active');
            // Clear all inputs
            document.getElementById('manualContractType').value = 'NATIVE';
            document.getElementById('manualContractAddress').value = '';
            document.getElementById('manualContractRpc').value = '';
            document.getElementById('manualTokenAddress').value = '';
            safeHideElement('manualTokenAddressGroup');
            // Reset display to current home chain
            _mcSetHomeChain();
        }
        
        async function saveManualContract() {
            const contractType = document.getElementById('manualContractType').value;
            const contractAddress = document.getElementById('manualContractAddress').value.trim();
            const rpcUrl = document.getElementById('manualContractRpc').value.trim();
            const tokenAddress = document.getElementById('manualTokenAddress').value.trim();
            
            // Validation
            if (!contractAddress) {
                alert('❌ Please enter a contract address');
                return;
            }
            
            if (!ethers.isAddress(contractAddress)) {
                alert('❌ Invalid contract address format');
                return;
            }
            
            if (!manualSelectedChain) {
                alert('❌ Please select a network');
                return;
            }
            
            if (!rpcUrl) {
                alert('❌ Please enter an RPC URL');
                return;
            }
            
            if (contractType === 'TOKEN' && !tokenAddress) {
                alert('❌ Please enter a token contract address for TOKEN type');
                return;
            }
            
            if (contractType === 'TOKEN' && !ethers.isAddress(tokenAddress)) {
                alert('❌ Invalid token contract address format');
                return;
            }
            
            const chainName = manualSelectedChain.name;
            const chainId   = manualSelectedChain.chainId || 0;
            
            // Create contract object WITHOUT private key
            const newContract = {
                address: contractAddress,
                chain: chainName,
                chainName: chainName,
                chainId: chainId,
                deployedAt: new Date().toLocaleString(),
                type: contractType,
                rpcUrl: rpcUrl,
                symbol: manualSelectedChain.symbol
            };
            
            if (contractType === 'TOKEN') {
                newContract.tokenAddress = tokenAddress;
            }
            
            // Get existing contracts from localStorage
            let withdrawContracts = JSON.parse(localStorage.getItem('withdrawContracts') || '[]');
            
            // Check if contract already exists
            const existingIndex = withdrawContracts.findIndex(c => 
                c.address.toLowerCase() === contractAddress.toLowerCase() && 
                c.chain === chainName
            );
            
            if (existingIndex !== -1) {
                const overwrite = confirm('⚠️ This contract already exists in the list. Do you want to update it?');
                if (!overwrite) {
                    return;
                }
                // Remove old entry
                withdrawContracts.splice(existingIndex, 1);
            }
            
            // Add new contract
            withdrawContracts.push(newContract);
            
            // Save to localStorage (WITHOUT private key)
            localStorage.setItem('withdrawContracts', JSON.stringify(withdrawContracts));
            
            
            // Close modal
            closeManualContractModal();
            
            // Reload contracts display if we're on Withdraw Manager
            const currentRpc = document.getElementById('withdrawRpcUrl').value;
            if (currentRpc) {
                loadAllContracts();
            }
            
            alert(`✅ Contract Added Successfully!\n\n📍 Address: ${contractAddress}\n🌐 Chain: ${chainName}\n📦 Type: ${contractType}\n\n💡 Note: You will need to enter the owner private key when withdrawing.`);
        }
  