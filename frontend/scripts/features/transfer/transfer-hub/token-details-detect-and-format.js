
        // Token Transfer Functions
        function logMessageToken(type, message, isHtml) {
            if (!_isUIVisible('batchTransferUI', 'tokenModeContent')) return;
            const logContainer = document.getElementById('logContainerToken');
            if (!logContainer) return;
            
            const line = document.createElement('div');
            line.className = `log-line log-${type}`;
            
            const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
            line.innerHTML = `[${timestamp}] ${isHtml ? message : processLogMessage(message, _thGetChainIdFromRpc('rpcUrlToken'))}`;
            
            logContainer.appendChild(line);
            logContainer.scrollTop = logContainer.scrollHeight;
        }

        // Auto-detect token details (decimals and symbol)
        async function detectTokenDetails() {
            const tokenAddress = document.getElementById('tokenContractAddress').value.trim();
            
            if (!tokenAddress) {
                logMessageToken('error', '❌ Please enter a token contract address first');
                return;
            }

            if (!ethers.isAddress(tokenAddress)) {
                logMessageToken('error', '❌ Invalid token contract address');
                return;
            }

            try {
                // Single info log for detection start
                                
                // Get RPC provider from token UI
                const rpcUrl = document.getElementById('rpcUrlToken').value.trim();
                const _thRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('rpcUrlToken') : (rpcUrl ? [rpcUrl] : []);
                const _thChainId = parseInt((document.getElementById('rpcUrlToken')||{}).getAttribute?.('data-chainid')||'',10)||null;
                if (!rpcUrl) {
                    logMessageToken('error', '❌ Please select a network/chain first');
                    return;
                }

                // Use thWithFallback — probe directly with getCode so we skip extra getBlockNumber round-trip
                let tokenProvider;
                try {
                    tokenProvider = await window.thWithFallback('rpcUrlToken', async function(_p) {
                        const _c = await Promise.race([
                            _p.getCode(tokenAddress),
                            new Promise((_,r) => setTimeout(() => r(new Error('timeout')), 8000))
                        ]);
                        if (_c === '0x' || _c === '0x0') throw new Error('NO_CONTRACT');
                        return _p;
                    }, 8000);
                } catch(_thErr) {
                    if (_thErr.message === 'NO_CONTRACT') {
                        logMessageToken('error', '❌ No contract found at this address. Please verify the token address.');
                        return;
                    }
                    tokenProvider = window._thMakeProvider(rpcUrl, _thChainId);
                }

                // VERIFY CONTRACT CODE EXISTS (fallback path may not have checked)
                let _codeCheck;
                try { _codeCheck = await tokenProvider.getCode(tokenAddress); } catch(_) { _codeCheck = null; }
                if (_codeCheck === '0x' || _codeCheck === '0x0') {
                    logMessageToken('error', '❌ No contract found at this address. Please verify the token address.');
                    return;
                }
                
                const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, tokenProvider);

                // Helper: call any view fn with RPC fallback
                async function _wcall(selector, fn) {
                    try { return await fn(tokenContract); } catch(_e1) {}
                    // retry with fresh provider from fallback list
                    try {
                        return await window.thWithFallback('rpcUrlToken', async function(_p) {
                            const _c2 = new ethers.Contract(tokenAddress, ERC20_ABI, _p);
                            return await fn(_c2);
                        }, 6000);
                    } catch(_e2) { return null; }
                }

                // Fetch token details — each call isolated so one revert won't kill the rest
                // Some older/non-standard tokens return bytes32 instead of string for name/symbol
                function _decodeBytes32(raw) {
                    try {
                        // raw is a hex string like 0x555344430000...
                        const hex = raw.replace(/^0x/, '');
                        let str = '';
                        for (let i = 0; i < hex.length; i += 2) {
                            const code = parseInt(hex.slice(i, i + 2), 16);
                            if (code === 0) break;
                            str += String.fromCharCode(code);
                        }
                        return str.trim() || null;
                    } catch { return null; }
                }

                async function _safeSymbol() {
                    // 1. Standard symbol()
                    const _s = await _wcall('symbol', c => c.symbol());
                    if (_s && typeof _s === 'string' && _s.trim()) return _s.trim();
                    // 2. bytes32 fallback (MKR, SAI, etc.)
                    try {
                        const raw = await tokenProvider.call({ to: tokenAddress, data: '0x95d89b41' });
                        const decoded = _decodeBytes32(raw);
                        if (decoded) return decoded;
                    } catch {}
                    // 3. Derive initials from name()
                    try {
                        const _n = await _wcall('name', c => c.name());
                        if (_n && _n.trim()) {
                            const _words = _n.trim().split(/\s+/);
                            return _words.map(w => w[0]).join('').toUpperCase().slice(0, 6) || _n.slice(0, 6).toUpperCase();
                        }
                    } catch {}
                    return null;
                }

                async function _safeName() {
                    const _n = await _wcall('name', c => c.name());
                    if (_n && typeof _n === 'string' && _n.trim()) return _n.trim();
                    try {
                        const raw = await tokenProvider.call({ to: tokenAddress, data: '0x06fdde03' });
                        const decoded = _decodeBytes32(raw);
                        if (decoded) return decoded;
                    } catch {}
                    return '';
                }

                async function _safeDecimals() {
                    const _d = await _wcall('decimals', c => c.decimals());
                    if (_d !== null && _d !== undefined) return Number(_d);
                    return 18;
                }

                const [symbol, decimals, name] = await Promise.all([
                    _safeSymbol(),
                    _safeDecimals(),
                    _safeName(),
                ]);

                // Update UI fields
                document.getElementById('tokenSymbol').value = symbol !== 'UNKNOWN' ? symbol : '';
                document.getElementById('tokenDecimals').value = decimals.toString();

                const _displayName = (name && name !== symbol) ? `${name} (${symbol})` : symbol;
                const _logDisplay = (symbol === 'UNKNOWN' || !symbol)
                    ? `${tokenAddress.slice(0,6)}…${tokenAddress.slice(-4)} (${decimals} dec)`
                    : _displayName;
                logMessageToken('success', `✅ Token detected: ${_logDisplay}`);
                
                // Show token balance if wallet is connected
                const privateKey = document.getElementById('privateKeyToken').value.trim();
                if (privateKey) {
                    try {
                        const wallet = new ethers.Wallet(privateKey, tokenProvider);
                        const balance = await tokenContract.balanceOf(wallet.address);
                        const formattedBalance = ethers.formatUnits(balance, decimals);
                    } catch (e) {
                        // Silently skip if wallet connection fails
                    }
                }
                
                // Auto-check recipient balances if addresses are already entered
                const receiverAddressesRaw = document.getElementById('receiverAddressesToken').value.trim();
                if (receiverAddressesRaw) {
                    const validAddresses = parseAddresses(receiverAddressesRaw);
                    
                    if (validAddresses.length > 0) {
                        // Trigger balance check automatically
                        setTimeout(() => {
                            checkRecipientTokenBalances();
                        }, 500);
                    }
                }

            } catch (error) {
                if (error.message.includes('could not decode result data')) {
                    logMessageToken('error', '❌ Not a valid ERC20 token contract');
                } else {
                    logMessageToken('error', '❌ Failed to detect token: ' + error.message);
                }
            }
        }

        async function formatAddressesToken() {
            const receiverAddressesTextarea = document.getElementById('receiverAddressesToken');
            const rawText = receiverAddressesTextarea.value;
            
            if (!rawText.trim()) {
                logMessageToken('error', '❌ No addresses provided');
                return;
            }
            
                        
            // parseAddresses() handles: direct addresses, private keys (→ extracts address), any messy format
            // Same engine Native section uses
            const rawItems = rawText.match(/0x[a-fA-F0-9]+|[a-fA-F0-9]+/g) || [];
            
            const directAddresses = [];
            const privateKeys = [];
            
            rawItems.forEach(item => {
                // Address: 42 chars with 0x OR 40 hex chars without
                if (item.length === 42 && item.startsWith('0x') && ethers.isAddress(item)) {
                    directAddresses.push(item);
                } else if (item.length === 40 && !item.startsWith('0x') && ethers.isAddress('0x' + item)) {
                    directAddresses.push('0x' + item);
                }
                // Private key: 66 chars with 0x OR 64 hex chars without
                const len = item.startsWith('0x') ? item.length : item.length + 2;
                if (len === 66) {
                    privateKeys.push(item.startsWith('0x') ? item : '0x' + item);
                }
            });
            
            // Convert private keys → addresses
            let extractedFromKeys = 0;
            privateKeys.forEach(pk => {
                try {
                    const wallet = new ethers.Wallet(pk);
                    directAddresses.push(wallet.address);
                    extractedFromKeys++;
                } catch (e) {
                    logMessageToken('warning', `⚠️ Invalid private key skipped`);
                }
            });
            
            if (directAddresses.length === 0) {
                logMessageToken('error', '❌ No valid addresses or private keys found');
                return;
            }
            
            // Dedupe (case-insensitive)
            const seen = new Set();
            const validAddresses = [];
            directAddresses.forEach(addr => {
                const lower = addr.toLowerCase();
                if (!seen.has(lower)) {
                    seen.add(lower);
                    validAddresses.push(addr);
                }
            });
            
            const duplicateCount = directAddresses.length - validAddresses.length;
            
            // Detection summary log
            const pureAddressCount = validAddresses.length - extractedFromKeys;
            if (pureAddressCount > 0) {
                            }
            if (extractedFromKeys > 0) {
                            }
            if (duplicateCount > 0) {
                logMessageToken('warning', `⚠️ Removed ${duplicateCount} duplicate address(es)`);
            }
            
            // Update textarea with clean addresses (one per line)
            receiverAddressesTextarea.value = validAddresses.join('\n');
            
            // DO NOT SAVE: localStorage.setItem('receiverAddressesToken', validAddresses.join('\n'));
            
            // Update address count
            document.getElementById('totalAddressesToken').textContent = validAddresses.length;
            
            // Calculate and update amounts
            calculateAmountsToken();
            
            // Log results
            
                        
            // Auto-check balances if token and RPC are configured
            const tokenAddress = document.getElementById('tokenContractAddress').value.trim();
            const rpcUrl = document.getElementById('rpcUrlToken').value.trim();
            const _thRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('rpcUrlToken') : (rpcUrl ? [rpcUrl] : []);
            const _thChainId = parseInt((document.getElementById('rpcUrlToken')||{}).getAttribute?.('data-chainid')||'',10)||null;
            
            if (tokenAddress && ethers.isAddress(tokenAddress) && rpcUrl && validAddresses.length > 0) {
                // Automatically check balances
                                await checkRecipientTokenBalances();
            }
        }

        function clearAllDataToken() {
            document.getElementById('receiverAddressesToken').value = '';
            document.getElementById('privateKeyToken').value = '';
            document.getElementById('tokenContractAddress').value = '';
            document.getElementById('tokenSymbol').value = '';
            document.getElementById('tokenDecimals').value = '18';
            document.getElementById('amountPerAddressToken').value = '0';
            
            // Clear persisted addresses
            localStorage.removeItem('receiverAddressesToken');
            
            document.getElementById('logContainerToken').innerHTML = '';
            
            // Hide balance box
            safeHideElement('recipientBalancesToken');
        }