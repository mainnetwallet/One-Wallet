
        
        async function executeApproval() {
            window._thStopFlags = window._thStopFlags || {}; window._thStopFlags['approval'] = false;
            try {
                if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txStart(); // BG: wake lock
                const rpcUrl = document.getElementById('rpcUrlApproval').value.trim();
                const _thRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('rpcUrlApproval') : (rpcUrl ? [rpcUrl] : []);
                const _thChainId = parseInt((document.getElementById('rpcUrlApproval')||{}).getAttribute?.('data-chainid')||'',10)||null;
                const privateKeysInput = document.getElementById('privateKeyApproval').value.trim();
                const tokenAddress = document.getElementById('tokenAddressApproval').value.trim();
                const spenderAddress = document.getElementById('spenderAddressApproval').value.trim();
                let amount = document.getElementById('approvalAmount').value.trim();
                
                if (!rpcUrl || !privateKeysInput || !tokenAddress || !spenderAddress) {
                    logApproval('error', 'Please fill all required fields');
                    return;
                }
                
                // Parse private keys using smart parser
                const privateKeys = parseKeysFromAnyFormat(privateKeysInput);
                
                if (privateKeys.length === 0) {
                    logApproval('error', '❌ No valid keys found');
                    return;
                }
                
                document.getElementById('walletsLoadedApproval').textContent = privateKeys.length;
                
                // FIX: use thWithFallback for automatic multi-RPC failover
                try {
                  approvalProvider = await window.thWithFallback('rpcUrlApproval', async function(_p) {
                    await Promise.race([_p.getBlockNumber(), new Promise((_,r)=>setTimeout(()=>r(new Error('probe timeout')),5000))]);
                    return _p;
                  }, 5000);
                } catch(_thErr) {
                  const _fbCid66509 = parseInt((document.getElementById('rpcUrlApproval')||{}).getAttribute?.('data-chainid')||'',10)||null;
                  approvalProvider = window._thMakeProvider(rpcUrl, _fbCid66509);
                }
                
                // ── OneGas AI gas (AUTO / EIP-1559 / LEGACY) ──
                // Get gas fee data once (like batch transfer)
                let txOptions = {};
                const _appGas = await window._thGas(approvalProvider);
                Object.assign(txOptions, _appGas);
                if (_appGas.maxFeePerGas) {
                } else if (_appGas.gasPrice) {
                }
                
                let successCount = 0;
                let failedCount = 0;
                let sentTxHashes = [];
                
                // Reset counters
                document.getElementById('successCountApproval').textContent = '0';
                document.getElementById('failedCountApproval').textContent = '0';
                
                                
                for (let i = 0; i < privateKeys.length; i++) {
                    if (window._thStopFlags && window._thStopFlags['approval']) { logApproval('warning', '⛔ Stopped by Pull-to-Refresh'); break; }
                    try {
                        const wallet = new ethers.Wallet(privateKeys[i], approvalProvider);
                        
                        logApproval('info', `[${i + 1}/${privateKeys.length}] 👤 ${wallet.address.substring(0, 10)}...${wallet.address.substring(wallet.address.length - 6)}`, false);
                        
                        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
                        
                        // Get token info
                        const [symbol, decimals] = await Promise.all([
                            tokenContract.symbol(),
                            tokenContract.decimals()
                        ]);
                        
                        // ⛔ PTR guard — re-check after async token info fetch
                        if (window._thStopFlags && window._thStopFlags['approval']) { break; }

                        // Handle unlimited approval
                        let approvalAmount;
                        if (!amount || amount === '0') {
                            if (!amount) {
                                approvalAmount = ethers.MaxUint256; // Unlimited
                            } else {
                                approvalAmount = 0n; // Revoke
                            }
                        } else {
                            approvalAmount = ethers.parseUnits(amount, decimals);
                        }
                        
                        // Send transaction (NO WAIT)
                        const tx = await tokenContract.approve(spenderAddress, approvalAmount, txOptions);
                        logApproval('success', `[${i + 1}/${privateKeys.length}] ✅ Sent! TX: ${createExplorerLink(tx.hash, {chainId: _thGetChainIdFromRpc('rpcUrlApproval')}, false)}`, true);
                        
                        sentTxHashes.push(tx.hash);
                        successCount++;
                        
                        // Fast 0.1s delay (no wait)
                        if (i < privateKeys.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }
                        
                    } catch (error) {
                        logApproval('error', `[${i + 1}/${privateKeys.length}] ❌ Failed: ${error.message.substring(0, 60)}`);
                        failedCount++;
                    }
                    
                    // Update counters
                    document.getElementById('successCountApproval').textContent = successCount;
                    document.getElementById('failedCountApproval').textContent = failedCount;
                }
                
                                logApproval('success', '🎉 Done! Sent: ' + successCount + (failedCount > 0 ? ' | Failed: ' + failedCount : ''));
                
            } catch (error) {
                logApproval('error', `❌ Error: ${error.message}`);
            }
        }
        
        function setApprovalAmount(value) {
            document.getElementById('approvalAmount').value = value;
            checkApprovalExecuteReady();
        }
        
        function clearApprovalData() {
            document.getElementById('privateKeyApproval').value = '';
            document.getElementById('tokenAddressApproval').value = '';
            document.getElementById('spenderAddressApproval').value = '';
            document.getElementById('approvalAmount').value = '';
            document.getElementById('walletsLoadedApproval').textContent = '0';
            document.getElementById('successCountApproval').textContent = '0';
            document.getElementById('failedCountApproval').textContent = '0';
            checkApprovalExecuteReady();
        }
        
        async function revokeAllLoadedKeys() {
            window._thStopFlags = window._thStopFlags || {}; window._thStopFlags['revokeApproval'] = false;
            try {
                const rpcUrl = document.getElementById('rpcUrlApproval').value.trim();
                const _thRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('rpcUrlApproval') : (rpcUrl ? [rpcUrl] : []);
                const _thChainId = parseInt((document.getElementById('rpcUrlApproval')||{}).getAttribute?.('data-chainid')||'',10)||null;
                const privateKeysInput = document.getElementById('privateKeyApproval').value.trim();
                const tokenAddress = document.getElementById('tokenAddressApproval').value.trim();
                const spenderAddress = document.getElementById('spenderAddressApproval').value.trim();
                
                if (!rpcUrl || !privateKeysInput || !tokenAddress || !spenderAddress) {
                    logApproval('error', '❌ Please fill all required fields (Keys, Token, Spender)');
                    return;
                }
                
                // Parse private keys using smart parser
                const privateKeys = parseKeysFromAnyFormat(privateKeysInput);
                
                if (privateKeys.length === 0) {
                    logApproval('error', '❌ No valid keys found');
                    return;
                }
                
                const confirmMsg = `⚠️ Are you sure you want to REVOKE approvals for ALL ${privateKeys.length} loaded wallet(s)?\n\nToken: ${tokenAddress}\nSpender: ${spenderAddress}\n\nThis will set allowance to 0 for all wallets.`;
                
                if (!confirm(confirmMsg)) {
                    return;
                }
                
                // FIX: use thWithFallback for automatic multi-RPC failover
                try {
                  approvalProvider = await window.thWithFallback('rpcUrlApproval', async function(_p) {
                    await Promise.race([_p.getBlockNumber(), new Promise((_,r)=>setTimeout(()=>r(new Error('probe timeout')),5000))]);
                    return _p;
                  }, 5000);
                } catch(_thErr) {
                  const _fbCid66654 = parseInt((document.getElementById('rpcUrlApproval')||{}).getAttribute?.('data-chainid')||'',10)||null;
                  approvalProvider = window._thMakeProvider(rpcUrl, _fbCid66654);
                }
                
                // ── OneGas AI gas (AUTO / EIP-1559 / LEGACY) ──
                // Get gas fee data once (batch style)
                let txOptions = {};
                Object.assign(txOptions, await window._thGas(approvalProvider));
                
                let successCount = 0;
                let failedCount = 0;
                let sentTxHashes = [];
                
                document.getElementById('successCountApproval').textContent = '0';
                document.getElementById('failedCountApproval').textContent = '0';
                
                                
                for (let i = 0; i < privateKeys.length; i++) {
                    if (window._thStopFlags && window._thStopFlags['revokeApproval']) { logApproval('warning', '⛔ Stopped by Pull-to-Refresh'); break; }
                    try {
                        const wallet = new ethers.Wallet(privateKeys[i], approvalProvider);
                        
                        
                        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
                        const symbol = await tokenContract.symbol();
                        
                        // ⛔ PTR guard — re-check after async symbol fetch
                        if (window._thStopFlags && window._thStopFlags['revokeApproval']) { break; }

                        // Set approval to 0 (revoke) - NO WAIT
                        const tx = await tokenContract.approve(spenderAddress, 0, txOptions);
                        logApproval('success', `[${i + 1}/${privateKeys.length}] ✅ Sent! TX: ${createExplorerLink(tx.hash, {chainId: _thGetChainIdFromRpc('rpcUrlApproval')}, false)}`, true);
                        
                        sentTxHashes.push(tx.hash);
                        successCount++;
                        
                        // Fast 0.1s delay
                        if (i < privateKeys.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }
                        
                    } catch (error) {
                        logApproval('error', `[${i + 1}/${privateKeys.length}] ❌ Failed: ${error.message.substring(0, 60)}`);
                        failedCount++;
                    }
                    
                    document.getElementById('successCountApproval').textContent = successCount;
                    document.getElementById('failedCountApproval').textContent = failedCount;
                }
                
                                logApproval('success', '🎉 Done! Revoked: ' + successCount + (failedCount > 0 ? ' | Failed: ' + failedCount : ''));
                
            } catch (error) {
                logApproval('error', `❌ Error: ${error.message}`);
            } finally {
                if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txEnd(); // BG: release wake lock
            }
        }
        
        // Auto-detect keys for Approval section
        // ── Approval Execute Button Gate ─────────────────────────────────
        // Enables ⚡ Fast Approve only when:
        //   • ≥1 private key loaded
        //   • Token Address filled
        //   • Spender Address filled
        // Amount is optional (empty = unlimited).
        // ─────────────────────────────────────────────────────────────────
        function checkApprovalExecuteReady() {
            const keys        = (document.getElementById('privateKeyApproval')?.value || '').trim();
            const tokenAddr   = (document.getElementById('tokenAddressApproval')?.value || '').trim();
            const spenderAddr = (document.getElementById('spenderAddressApproval')?.value || '').trim();

            const hasKeys    = keys.split('\n').filter(l => l.trim()).length > 0;
            const hasToken   = tokenAddr !== '';
            const hasSpender = spenderAddr !== '';

            const ready = hasKeys && hasToken && hasSpender;
            const btn   = document.getElementById('executeApprovalBtn');
            if (btn) {
                btn.disabled      = !ready;
                btn.style.opacity = ready ? '1' : '0.45';
                btn.style.cursor  = ready ? 'pointer' : 'not-allowed';
            }
        }

        function autoDetectKeysApproval() {
            const textarea = document.getElementById('privateKeyApproval');
            const input = textarea.value.trim();
            
            if (!input) {
                document.getElementById('autoDetectCountApproval').textContent = '0 keys';
                document.getElementById('walletsLoadedApproval').textContent = '0';
                checkApprovalExecuteReady();
                return;
            }
            
            const keys = parseKeysFromAnyFormat(input);
            
            // Auto-clean: Replace textarea with valid keys only
            if (keys.length > 0) {
                textarea.value = keys.join('\n');
            }
            
            document.getElementById('autoDetectCountApproval').textContent = `${keys.length} key${keys.length !== 1 ? 's' : ''}`;
            safeSetStyle('autoDetectCountApproval', 'background', keys.length > 0 ? '#2a4a2a' : '#2a2a2a');
            safeSetStyle('autoDetectCountApproval', 'color', keys.length > 0 ? '#4ade80' : '#4a9eff');
            document.getElementById('walletsLoadedApproval').textContent = keys.length;
            checkApprovalExecuteReady();
        }
        
        function logApproval(type, message, isHtml) {
            if (!_isUIVisible('tokenApprovalManagerUI')) return;
            const logContainer = document.getElementById('logContainerApproval');
            if (!logContainer) return;
            const timestamp = new Date().toLocaleTimeString();
            const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
            const logLine = document.createElement('div');
            logLine.className = `log-line log-${type}`;
            logLine.innerHTML = `[${timestamp}] ${icon} ${isHtml ? message : processLogMessage(message, _thGetChainIdFromRpc('rpcUrlApproval'))}`;
            logContainer.appendChild(logLine);
            logContainer.scrollTop = logContainer.scrollHeight;
        }
        
        function clearLogApproval() {
            document.getElementById('logContainerApproval').innerHTML = '<div class="log-line log-info">[INFO] Log cleared</div>';
        }