
        // Toggle Token Balances Box
        function toggleTokenBalancesBox() {
            const balanceList = document.getElementById('recipientBalancesListToken');
            const toggleIcon = document.getElementById('balanceBoxToggleIcon');
            
            if (balanceList.style.display === 'none') {
                balanceList.style.display = 'block';
                toggleIcon.style.transform = 'rotate(0deg)';
                toggleIcon.textContent = '▼';
            } else {
                balanceList.style.display = 'none';
                toggleIcon.style.transform = 'rotate(-90deg)';
                toggleIcon.textContent = '▶';
            }
        }

        // Check Recipient Token Balances
        async function checkRecipientTokenBalances() {
            const tokenAddress = document.getElementById('tokenContractAddress').value.trim();
            const rpcUrl = document.getElementById('rpcUrlToken').value.trim();
            const _thRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('rpcUrlToken') : (rpcUrl ? [rpcUrl] : []);
            const _thChainId = parseInt((document.getElementById('rpcUrlToken')||{}).getAttribute?.('data-chainid')||'',10)||null;
            const tokenSymbol = document.getElementById('tokenSymbol').value || 'TOKEN';
            const tokenDecimals = parseInt(document.getElementById('tokenDecimals').value) || 18;
            const addressesText = document.getElementById('receiverAddressesToken').value.trim();
            
            // Validation
            if (!tokenAddress || !ethers.isAddress(tokenAddress)) {
                logMessageToken('error', '❌ Please enter a valid token contract address');
                return;
            }
            
            if (!rpcUrl) {
                logMessageToken('error', '❌ Please enter RPC URL');
                return;
            }
            
            if (!addressesText) {
                logMessageToken('error', '❌ Please enter recipient addresses');
                return;
            }
            
            // Parse addresses
            const addresses = parseAddresses(addressesText);
            
            if (addresses.length === 0) {
                logMessageToken('error', '❌ No valid addresses found');
                return;
            }
            
                        
            try {
                // FIX: use thWithFallback for automatic multi-RPC failover
                let provider;
                try {
                  provider = await window.thWithFallback('rpcUrlToken', async function(_p) {
                    await Promise.race([_p.getBlockNumber(), new Promise((_,r)=>setTimeout(()=>r(new Error('probe timeout')),5000))]);
                    return _p;
                  }, 5000);
                } catch(_thErr) {
                  // All RPCs in list failed — fall back to single URL so caller can surface error naturally
                  const _fbCid = parseInt((document.getElementById('rpcUrlToken')||{}).getAttribute?.('data-chainid')||'',10)||null;
                  provider = window._thMakeProvider(rpcUrl, _fbCid);
                }
                const ERC20_ABI = [
                    "function balanceOf(address) view returns (uint256)",
                    "function symbol() view returns (string)",
                    "function decimals() view returns (uint8)"
                ];
                
                const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
                
                // Show balance box in collapsed state
                const balanceBox = document.getElementById('recipientBalancesToken');
                const balanceList = document.getElementById('recipientBalancesListToken');
                const toggleIcon = document.getElementById('balanceBoxToggleIcon');
                
                balanceBox.style.display = 'block';
                balanceList.style.display = 'none'; // Keep content hidden initially
                toggleIcon.textContent = '▶';
                toggleIcon.style.transform = 'rotate(-90deg)';
                balanceList.innerHTML = '<div style="color: #4a9eff; text-align: center; padding: 10px;">Loading balances...</div>';
                
                let balanceHTML = '';
                let totalBalance = 0n;
                
                for (let i = 0; i < addresses.length; i++) {
                    const address = addresses[i];
                    
                    try {
                        const balance = await tokenContract.balanceOf(address);
                        const balanceFormatted = ethers.formatUnits(balance, tokenDecimals);
                        totalBalance += balance;
                        
                        const balanceColor = balance > 0n ? '#43e97b' : '#f5576c';
                        const shortAddr = address.substring(0, 10) + '...' + address.substring(address.length - 8);
                        
                        balanceHTML += `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: #0f0f0f; border-radius: 6px; margin-bottom: 6px; border-left: 3px solid ${balanceColor};">
                                <span style="font-family: 'Courier New', monospace; font-size: 0.8rem; color: #a0a0a0;">${i + 1}. ${shortAddr}</span>
                                <span style="font-weight: 600; color: ${balanceColor}; font-size: 0.85rem;">${parseFloat(balanceFormatted).toFixed(6)} ${tokenSymbol}</span>
                            </div>
                        `;
                    } catch (error) {
                        balanceHTML += `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: #0f0f0f; border-radius: 6px; margin-bottom: 6px; border-left: 3px solid #f5576c;">
                                <span style="font-family: 'Courier New', monospace; font-size: 0.8rem; color: #a0a0a0;">${i + 1}. ${address.substring(0, 10)}...</span>
                                <span style="color: #f5576c; font-size: 0.85rem;">Error</span>
                            </div>
                        `;
                    }
                }
                
                // Add total at the end
                const totalFormatted = ethers.formatUnits(totalBalance, tokenDecimals);
                balanceHTML += `
                    <div style="margin-top: 12px; padding: 12px; background: linear-gradient(135deg, #1a2a3a 0%, #2a1a3a 100%); border-radius: 8px; border: 1px solid #4a9eff;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight: 600; color: #4a9eff; font-size: 0.9rem;">Total Balance:</span>
                            <span style="font-weight: 700; color: #43e97b; font-size: 1rem;">${parseFloat(totalFormatted).toFixed(6)} ${tokenSymbol}</span>
                        </div>
                    </div>
                `;
                
                balanceList.innerHTML = balanceHTML;
                
            } catch (error) {
                const balanceBox = document.getElementById('recipientBalancesToken');
                balanceBox.style.display = 'none';
                logMessageToken('error', `❌ Failed to check balances: ${error.message}`);
            }
        }

        function setAmountToken(amount) {
            document.getElementById('amountPerAddressToken').value = amount;
            calculateAmountsToken();
                    }

        // Calculate and update amounts for Token section
        function calculateAmountsToken() {
            const receiverAddressesTextarea = document.getElementById('receiverAddressesToken');
            const amountInput = document.getElementById('amountPerAddressToken');
            
            if (!receiverAddressesTextarea || !amountInput) return;
            
            const addresses = receiverAddressesTextarea.value.split('\n').filter(addr => addr.trim() && ethers.isAddress(addr.trim()));
            const addressCount = addresses.length;
            const amountPerAddress = parseFloat(amountInput.value) || 0;
            const totalAmount = addressCount * amountPerAddress;
            
            // Update display elements
            const totalAddressesElement = document.getElementById('totalAddressesToken');
            const perAddressDisplayElement = document.getElementById('perAddressDisplayToken');
            const totalAmountElement = document.getElementById('totalAmountToken');
            
            if (totalAddressesElement) totalAddressesElement.textContent = addressCount;
            if (perAddressDisplayElement) perAddressDisplayElement.textContent = amountPerAddress;
            if (totalAmountElement) totalAmountElement.textContent = totalAmount.toFixed(8);
        }

        // Setup amount calculation listeners
        function setupTokenAmountCalculation() {
            const receiverAddressesTextarea = document.getElementById('receiverAddressesToken');
            const amountInput = document.getElementById('amountPerAddressToken');
            
            if (receiverAddressesTextarea) {
                // DO NOT LOAD: Addresses are not saved anymore
                // const savedTokenAddresses = localStorage.getItem('receiverAddressesToken');
                // if (savedTokenAddresses) {
                //     receiverAddressesTextarea.value = savedTokenAddresses;
                //     // Count update
                //     const restored = savedTokenAddresses.split('\n').filter(a => a.trim() && ethers.isAddress(a.trim()));
                //     if (restored.length > 0) {
                //         document.getElementById('totalAddressesToken').textContent = restored.length;
                //     }
                // }
                
                receiverAddressesTextarea.addEventListener('input', calculateAmountsToken);
                receiverAddressesTextarea.addEventListener('input', validateTokenInputs);
                
                // DO NOT SAVE: Real-time localStorage save disabled
                // receiverAddressesTextarea.addEventListener('input', () => {
                //     localStorage.setItem('receiverAddressesToken', receiverAddressesTextarea.value);
                // });
                
                // Auto-validate on paste
                receiverAddressesTextarea.addEventListener('paste', () => {
                    setTimeout(() => {
                        formatAddressesToken();
                    }, 100);
                });
                
                // Debounced auto-validation on input (when user stops typing for 1.5 seconds)
                let validationTimeout;
                receiverAddressesTextarea.addEventListener('input', () => {
                    clearTimeout(validationTimeout);
                    validationTimeout = setTimeout(() => {
                        const text = receiverAddressesTextarea.value.trim();
                        if (text && text.includes('0x')) {
                            formatAddressesToken();
                        }
                    }, 1500);
                });
            }
            
            if (amountInput) {
                amountInput.addEventListener('input', calculateAmountsToken);
                amountInput.addEventListener('input', validateTokenInputs);
            }
            
            // Add validation listeners for other inputs
            const privateKeyInput = document.getElementById('privateKeyToken');
            const tokenAddressInput = document.getElementById('tokenContractAddress');
            const rpcUrlInput = document.getElementById('rpcUrlToken');
            
            if (privateKeyInput) privateKeyInput.addEventListener('input', validateTokenInputs);
            if (tokenAddressInput) tokenAddressInput.addEventListener('input', validateTokenInputs);
            if (rpcUrlInput) rpcUrlInput.addEventListener('input', validateTokenInputs);
        }
        
        // Validate inputs and enable/disable buttons
        function validateTokenInputs() {
            const _pkRawToken = (window.actualKeysStorage && window.actualKeysStorage['privateKeyToken'])
                ? window.actualKeysStorage['privateKeyToken'].trim()
                : document.getElementById('privateKeyToken')?.value.trim();
            const privateKey = _pkRawToken;
            const tokenAddress = document.getElementById('tokenContractAddress')?.value.trim();
            const rpcUrl = document.getElementById('rpcUrlToken')?.value.trim();
            const receiverAddresses = document.getElementById('receiverAddressesToken')?.value.trim();
            const amount = document.getElementById('amountPerAddressToken')?.value.trim();

            const deployBtnToken = document.getElementById('deployBtnToken');
            const executeBtnToken = document.getElementById('executeBtnToken');

            const hasContractSelectedToken = !!deployedContractAddressToken;

            // Validate private key format (same pattern as Native section)
            let hasValidWallet = false;
            if (privateKey) {
                let hexVal = privateKey.replace(/\s+/g, '');
                const hexMatches = hexVal.match(/0x[a-f0-9]+|[a-f0-9]+/gi);
                if (hexMatches && hexMatches.length > 0) {
                    let longestHex = hexMatches.reduce((a, b) => a.length > b.length ? a : b).toLowerCase();
                    if (!longestHex.startsWith('0x')) longestHex = '0x' + longestHex;
                    // Valid private key (64 hex chars) or address (40 hex chars)
                    if (longestHex.length === 66 || longestHex.length === 42) {
                        try {
                            if (longestHex.length === 66) new ethers.Wallet(longestHex); // throws if invalid
                            hasValidWallet = true;
                        } catch(e) { hasValidWallet = false; }
                    }
                }
            }

            // Core readiness: valid wallet + RPC + recipients + amount + valid token address
            const hasAddresses = receiverAddresses && receiverAddresses.length > 0;
            const hasAmount = amount && parseFloat(amount) > 0;
            const hasValidToken = tokenAddress && ethers.isAddress(tokenAddress);
            const hasRpc = !!rpcUrl;

            const coreReady = hasValidWallet && hasRpc && hasAddresses && hasAmount && hasValidToken;

            // Deploy: needs valid wallet + RPC + token address + recipients + amount + no saved contract selected
            const canDeploy = coreReady && !hasContractSelectedToken;
            if (deployBtnToken) deployBtnToken.disabled = !canDeploy;

            // Execute: needs all core ready + saved contract selected; Deploy disabled when contract selected
            if (executeBtnToken) executeBtnToken.disabled = !(coreReady && hasContractSelectedToken);
        }
        
        // Initialize amount calculation when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupTokenAmountCalculation);
        } else {
            setupTokenAmountCalculation();
        }

        // Auto-detect token symbol and decimals for Batch Transfer Token
        // Note: Event listener is already attached in DOMContentLoaded section (line ~3410-3443)
        // This prevents duplicate logging when token address changes

        // Auto-verify recipient addresses on paste/input
        let autoVerifyTimeoutToken = null;
        document.getElementById('receiverAddressesToken')?.addEventListener('input', function() {
            // Clear previous timeout
            if (autoVerifyTimeoutToken) {
                clearTimeout(autoVerifyTimeoutToken);
            }
            
            // Set new timeout to avoid too many validations while typing
            autoVerifyTimeoutToken = setTimeout(async () => {
                const rawText = this.value.trim();
                
                if (!rawText) {
                    return;
                }
                
                // parseAddresses handles addresses, private keys, any format
                const validAddresses = parseAddresses(rawText);
                
                if (validAddresses.length > 0) {
                    // Update count
                    document.getElementById('totalAddressesToken').textContent = validAddresses.length;
                    
                    // Calculate amounts
                    calculateAmountsToken();
                    
                    // Check token balances if possible
                    const tokenAddress = document.getElementById('tokenContractAddress').value.trim();
                    const rpcUrl = document.getElementById('rpcUrlToken').value.trim();
                    const _thRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('rpcUrlToken') : (rpcUrl ? [rpcUrl] : []);
                    const _thChainId = parseInt((document.getElementById('rpcUrlToken')||{}).getAttribute?.('data-chainid')||'',10)||null;
                    const tokenSymbol = document.getElementById('tokenSymbol').value || 'TOKEN';
                    const tokenDecimals = parseInt(document.getElementById('tokenDecimals').value) || 18;
                    
                    if (tokenAddress && ethers.isAddress(tokenAddress) && rpcUrl) {
                        await checkRecipientTokenBalances(validAddresses, tokenAddress, tokenSymbol, tokenDecimals, rpcUrl);
                    }
                }
            }, 100); // Wait 0.1 second after user stops typing
        });

        // Auto-update wallet info when private key is entered
        let walletUpdateTimeoutToken = null;
