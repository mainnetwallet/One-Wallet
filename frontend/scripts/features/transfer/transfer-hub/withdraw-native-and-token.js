
        async function withdrawNative() {
            if (!window.selectedWithdrawContract) {
                logMessageWithdraw('error', '❌ Please select a contract first');
                return;
            }
            // ── Abort flag: PTR or manual stop sets window._wdAborted = true ──
            window._wdAborted = false;
            _wdSetLoading(true, 'native');
            
            // Check if ownership is verified
            if (!isOwnerVerified) {
                logMessageWithdraw('error', '❌ Ownership not verified! Please enter the correct developer private key');
                alert('❌ You must verify ownership before withdrawing funds!\n\nEnter the developer private key that was used to deploy this contract.');
                _wdSetLoading(false);
                return;
            }
            
            const contractAddress = window.selectedWithdrawContract.address;
            
            // Get actual key from storage (not masked value)
            let developerKey = '';
            if (window.actualKeysStorage && window.actualKeysStorage['withdrawDeveloperKey']) {
                developerKey = window.actualKeysStorage['withdrawDeveloperKey'].trim();
            } else {
                developerKey = document.getElementById('withdrawDeveloperKey').value.trim();
            }
            
            // Sanitize the key
            if (developerKey) {
                developerKey = sanitisePrivateKey(developerKey);
            }
            
            const recipient = document.getElementById('withdrawRecipient').value.trim();
            const rpcUrl = document.getElementById('withdrawRpcUrl').value.trim();
            const _thRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('withdrawRpcUrl') : (rpcUrl ? [rpcUrl] : []);
            const _thChainId = parseInt((document.getElementById('withdrawRpcUrl')||{}).getAttribute?.('data-chainid')||'',10)||null;
            
            if (!developerKey || !recipient || !rpcUrl) {
                logMessageWithdraw('error', '❌ Please fill in all required fields');
                _wdSetLoading(false);
                return;
            }
            
            if (!ethers.isAddress(recipient)) {
                logMessageWithdraw('error', '❌ Invalid recipient address');
                _wdSetLoading(false);
                return;
            }
            
            try {
                                
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

                // ⛔ PTR abort guard — stop if PTR fired while waiting for RPC
                if (window._wdAborted) {
                    logMessageWithdraw('warning', '⛔ Stopped by Pull-to-Refresh');
                    _wdSetLoading(false);
                    return;
                }

                const wallet = new ethers.Wallet(developerKey, provider);
                
                // Check contract balance
                const balance = await window.thRead('withdrawRpcUrl', provider, function(_p) { return _p.getBalance(contractAddress); }, 6000);
                const balanceEth = ethers.formatEther(balance);
                
                if (balance === 0n) {
                    logMessageWithdraw('error', '❌ Contract has no native balance to withdraw');
                    _wdSetLoading(false);
                    return;
                }

                // ⛔ PTR abort guard — stop if PTR fired while checking balance
                if (window._wdAborted) {
                    logMessageWithdraw('warning', '⛔ Stopped by Pull-to-Refresh');
                    _wdSetLoading(false);
                    return;
                }
                
                                
                // Contract ABI for withdraw
                const CONTRACT_ABI = [
                    "function withdrawNative(address payable recipient) external"
                ];
                
                const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, wallet);
                
                                
                // ── OneGas AI gas (AUTO / EIP-1559 / LEGACY) ──
                // Get gas fee data
                let txOptions = {};
                Object.assign(txOptions, await window._thGas(provider));
                // ⛔ PTR guard — re-check after async gas estimation
                if (window._wdAborted) {
                    logMessageWithdraw('warning', '⛔ Stopped by Pull-to-Refresh');
                    _wdSetLoading(false);
                    return;
                }
                let _wdNativeReceipt;
                {
                  let _wdProvider = provider;
                  let _wdWallet = wallet;
                  let _wdContract = contract;
                  _wdNativeReceipt = await window.thResilientSendAndConfirm({
                    rpcInputId: 'withdrawRpcUrl',
                    currentProvider: _wdProvider,
                    onProviderRefresh: function(_p) {
                      _wdProvider = _p;
                      _wdWallet = new ethers.Wallet(developerKey, _p);
                      _wdContract = new ethers.Contract(contractAddress, CONTRACT_ABI, _wdWallet);
                    },
                    sendFn: async function() {
                      const tx = await _wdContract.withdrawNative(recipient, txOptions);
                      _thSaveTx(tx.hash, 'withdrawRpcUrl', 'Withdraw Native');
                      return tx;
                    },
                    logFn: logMessageWithdraw,
                    label: 'Withdraw Native',
                    waitConfirm: true,
                  });
                }
                const receipt = _wdNativeReceipt;
                // ── END RPC-RESILIENT (Withdraw Native) ───────────────────────
                
                logMessageWithdraw('success', `✅ Withdrawal successful! TX: ${receipt.hash || receipt.transactionHash}`);
                _wdSetLoading(false);
                
                // Reload contracts to update balances
                setTimeout(() => loadAllContracts(), 2000);
                
            } catch (error) {
                _wdSetLoading(false);
                logMessageWithdraw('error', `❌ Withdrawal failed: ${error.message}`);
            }
        }

        async function withdrawToken() {
            if (!window.selectedWithdrawContract) {
                logMessageWithdraw('error', '❌ Please select a contract first');
                return;
            }
            // ── Abort flag: PTR or manual stop sets window._wdAborted = true ──
            window._wdAborted = false;
            _wdSetLoading(true, 'token');
            
            // Check if ownership is verified
            if (!isOwnerVerified) {
                logMessageWithdraw('error', '❌ Ownership not verified! Please enter the correct developer private key');
                alert('❌ You must verify ownership before withdrawing funds!\n\nEnter the developer private key that was used to deploy this contract.');
                _wdSetLoading(false);
                return;
            }
            
            const contractAddress = window.selectedWithdrawContract.address;
            
            // Get actual key from storage (not masked value)
            let developerKey = '';
            if (window.actualKeysStorage && window.actualKeysStorage['withdrawDeveloperKey']) {
                developerKey = window.actualKeysStorage['withdrawDeveloperKey'].trim();
            } else {
                developerKey = document.getElementById('withdrawDeveloperKey').value.trim();
            }
            
            // Sanitize the key
            if (developerKey) {
                developerKey = sanitisePrivateKey(developerKey);
            }
            
            const recipient = document.getElementById('withdrawRecipient').value.trim();
            const tokenAddress = document.getElementById('withdrawTokenAddress').value.trim();
            const rpcUrl = document.getElementById('withdrawRpcUrl').value.trim();
            const _thRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('withdrawRpcUrl') : (rpcUrl ? [rpcUrl] : []);
            const _thChainId = parseInt((document.getElementById('withdrawRpcUrl')||{}).getAttribute?.('data-chainid')||'',10)||null;
            
            if (!developerKey || !recipient || !tokenAddress || !rpcUrl) {
                logMessageWithdraw('error', '❌ Please fill in all required fields');
                _wdSetLoading(false);
                return;
            }
            
            if (!ethers.isAddress(recipient) || !ethers.isAddress(tokenAddress)) {
                logMessageWithdraw('error', '❌ Invalid address format');
                _wdSetLoading(false);
                return;
            }
            
            try {
                                
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

                // ⛔ PTR abort guard — stop if PTR fired while waiting for RPC
                if (window._wdAborted) {
                    logMessageWithdraw('warning', '⛔ Stopped by Pull-to-Refresh');
                    _wdSetLoading(false);
                    return;
                }

                const wallet = new ethers.Wallet(developerKey, provider);
                
                // Get token details and balance
                const ERC20_ABI = [
                    "function balanceOf(address) view returns (uint256)",
                    "function symbol() view returns (string)",
                    "function decimals() view returns (uint8)"
                ];
                
                const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
                
                let balance, symbol, decimals;
                try {
                    [balance, symbol, decimals] = await Promise.all([
                        tokenContract.balanceOf(contractAddress),
                        tokenContract.symbol(),
                        tokenContract.decimals()
                    ]);
                } catch (tokenErr) {
                    // Token contract does not exist or is not a valid ERC20 on this chain
                    logMessageWithdraw('warning', `⚠️ Token contract not found or not a valid ERC20 on this network.`);
                    logMessageWithdraw('info', `ℹ️ Make sure the token address and selected network are correct.`);
                    _wdSetLoading(false);
                    return;
                }
                
                const balanceFormatted = ethers.formatUnits(balance, decimals);
                
                if (balance === 0n) {
                    logMessageWithdraw('warning', `⚠️ Contract has 0 ${symbol} balance — nothing to withdraw.`);
                    _wdSetLoading(false);
                    return;
                }

                // ⛔ PTR abort guard — stop if PTR fired while checking token balance
                if (window._wdAborted) {
                    logMessageWithdraw('warning', '⛔ Stopped by Pull-to-Refresh');
                    _wdSetLoading(false);
                    return;
                }
                
                                
                // Contract ABI for token withdraw
                const CONTRACT_ABI = [
                    "function withdrawToken(address token, address recipient) external"
                ];
                
                const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, wallet);
                
                                
                // ── OneGas AI gas (AUTO / EIP-1559 / LEGACY) ──
                // Get gas fee data
                let txOptions = {};
                Object.assign(txOptions, await window._thGas(provider));
                // ⛔ PTR guard — re-check after async gas estimation
                if (window._wdAborted) {
                    logMessageWithdraw('warning', '⛔ Stopped by Pull-to-Refresh');
                    _wdSetLoading(false);
                    return;
                }
                
                // ── RPC-RESILIENT SEND + CONFIRM (Withdraw Token) ───────────
                let _wdTokenReceipt;
                {
                  let _wdProvider = provider;
                  let _wdWallet = wallet;
                  let _wdContract = contract;
                  _wdTokenReceipt = await window.thResilientSendAndConfirm({
                    rpcInputId: 'withdrawRpcUrl',
                    currentProvider: _wdProvider,
                    onProviderRefresh: function(_p) {
                      _wdProvider = _p;
                      _wdWallet = new ethers.Wallet(developerKey, _p);
                      _wdContract = new ethers.Contract(contractAddress, CONTRACT_ABI, _wdWallet);
                    },
                    sendFn: async function() {
                      const tx = await _wdContract.withdrawToken(tokenAddress, recipient, txOptions);
                      _thSaveTx(tx.hash, 'withdrawRpcUrl', 'Withdraw Token');
                      return tx;
                    },
                    logFn: logMessageWithdraw,
                    label: 'Withdraw Token',
                    waitConfirm: true,
                  });
                }
                const receipt = _wdTokenReceipt;
                // ── END RPC-RESILIENT (Withdraw Token) ────────────────────────
                
                logMessageWithdraw('success', `✅ Token withdrawal successful! TX: ${receipt.hash || receipt.transactionHash}`);
                _wdSetLoading(false);
                
                // Reload contracts to update balances
                setTimeout(() => loadAllContracts(), 2000);
                
            } catch (error) {
                _wdSetLoading(false);
                const _msg = error.message || '';
                if (_msg.includes('missing revert data') || _msg.includes('CALL_EXCEPTION') || _msg.includes('data=null')) {
                    logMessageWithdraw('warning', `⚠️ Contract does not support this token withdrawal method.`);
                    logMessageWithdraw('info', `ℹ️ The contract at this address may not have a withdrawToken function or the token is not recognized.`);
                } else if (_msg.includes('insufficient funds') || _msg.includes('gas required exceeds')) {
                    logMessageWithdraw('error', `❌ Insufficient gas funds in developer wallet.`);
                } else if (_msg.includes('rejected') || _msg.includes('denied')) {
                    logMessageWithdraw('warning', `⚠️ Transaction rejected.`);
                } else {
                    logMessageWithdraw('error', `❌ Token withdrawal failed: ${_msg}`);
                }
            }
        }