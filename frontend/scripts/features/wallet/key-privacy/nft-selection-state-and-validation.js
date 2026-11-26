        
        // ── NFT Execute Button Gate ───────────────────────────────────────
        // Distribute (1→Many): Sender Key + Recipients + NFT Contract + ≥1 NFT Selected
        // Collect   (Many→1): Sender Keys + Recipient Address + NFT Contract + ≥1 NFT Selected
        // ─────────────────────────────────────────────────────────────────
        function checkNftExecuteReady() {
            // ── Distribute button ──
            const senderKey      = (document.getElementById('nftSenderKey')?.value || '').trim();
            const recipients     = (document.getElementById('nftRecipientsDistribute')?.value || '').trim();
            const nftContract    = (document.getElementById('nftContractAddress')?.value || '').trim();
            const nftSelected    = selectedNFTsDistribute.size;

            const distReady = senderKey !== '' &&
                              recipients.split('\n').filter(l => l.trim()).length > 0 &&
                              nftContract !== '' &&
                              nftSelected > 0;

            const distBtn = document.getElementById('executeNftDistributeBtn');
            if (distBtn) {
                distBtn.disabled      = !distReady;
                distBtn.style.opacity = distReady ? '1' : '0.45';
                distBtn.style.cursor  = distReady ? 'pointer' : 'not-allowed';
            }

            // ── Collect button ──
            const senderKeys      = (document.getElementById('nftSenderKeys')?.value || '').trim();
            const recipient       = (document.getElementById('nftCollectRecipient')?.value || '').trim();
            const nftContractC    = (document.getElementById('nftContractAddressCollect')?.value || '').trim();
            const nftSelectedC    = selectedNFTsCollect.size;

            const collectReady = senderKeys.split('\n').filter(l => l.trim()).length > 0 &&
                                  recipient !== '' &&
                                  nftContractC !== '' &&
                                  nftSelectedC > 0;

            const collectBtn = document.getElementById('executeNftCollectBtn');
            if (collectBtn) {
                collectBtn.disabled      = !collectReady;
                collectBtn.style.opacity = collectReady ? '1' : '0.45';
                collectBtn.style.cursor  = collectReady ? 'pointer' : 'not-allowed';
            }
        }

        // Update Selected Count
        function updateSelectedCountNft(mode) {
            const selectedCount = mode === 'distribute' ? selectedNFTsDistribute.size : selectedNFTsCollect.size;
            const selectedCountEl = document.getElementById(`selectedCount${mode === 'distribute' ? 'Distribute' : 'Collect'}`);
            if (selectedCountEl) {
                selectedCountEl.textContent = selectedCount;
            }
            
            // Update stats for distribute mode
            if (mode === 'distribute') {
                const tokenCountEl = document.getElementById('nftDistributeTokenCount');
                if (tokenCountEl) {
                    tokenCountEl.textContent = selectedCount;
                }
            }
            
            const btn = document.getElementById(`selectAll${mode === 'distribute' ? 'Distribute' : 'Collect'}Btn`);
            const totalCountEl = document.getElementById(`totalCount${mode === 'distribute' ? 'Distribute' : 'Collect'}`);
            
            if (btn && totalCountEl) {
                const totalCount = parseInt(totalCountEl.textContent);
                
                if (selectedCount === totalCount && totalCount > 0) {
                    btn.textContent = 'Deselect All';
                } else {
                    btn.textContent = 'Select All';
                }
            }
            // Re-evaluate execute button after every selection change
            checkNftExecuteReady();
        }
        
        // Validate Recipients (Distribute)
        function validateNftDistributeRecipients() {
            const recipientsEl = document.getElementById('nftRecipientsDistribute');
            if (!recipientsEl) return;
            
            const recipientsText = recipientsEl.value.trim();
            const recipients = recipientsText.split('\n').filter(r => r.trim());
            
            const recipientsCountEl = document.getElementById('nftDistributeRecipientsCount');
            if (recipientsCountEl) {
                recipientsCountEl.textContent = recipients.length;
            }
            
            if (recipients.length > 0) {
            } else {
                logMessageNft('warning', '⚠️ No recipients provided');
            }
        }
        
        // Clear Data
        // Missing function: detect token details for Multi Key Token section
        async function detectTokenDetailsMultiKeyToken() {
            const tokenAddress = document.getElementById('tokenContractAddressMultiKeyToken')?.value?.trim();
            if (!tokenAddress) {
                logMessageMultiToken('error', '❌ Please enter a token contract address first');
                return;
            }
            if (!ethers.isAddress(tokenAddress)) {
                logMessageMultiToken('error', '❌ Invalid token contract address');
                return;
            }
            try {
                const rpcUrl = document.getElementById('rpcUrlMultiKeyToken')?.value?.trim();
                if (!rpcUrl) {
                    logMessageMultiToken('error', '❌ Please select a network/chain first');
                    return;
                }
                const _dtmkChainId = parseInt((document.getElementById('rpcUrlMultiKeyToken')||{}).getAttribute?.('data-chainid')||'',10)||null;
                const _dtmkRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('rpcUrlMultiKeyToken') : [];
                if (rpcUrl && !_dtmkRpcs.includes(rpcUrl)) _dtmkRpcs.unshift(rpcUrl);
                // FIX: iterate full RPC list with fallback instead of single URL
                let provider;
                for (const _rpc of (_dtmkRpcs.length ? _dtmkRpcs : [rpcUrl])) {
                  try {
                    const _p = window._thMakeProvider(_rpc, _dtmkChainId);
                    await Promise.race([_p.getBlockNumber(), new Promise((_,r)=>setTimeout(()=>r(new Error('timeout')),5000))]);
                    provider = _p; break;
                  } catch(_e) { continue; }
                }
                if (!provider) provider = window._thMakeProvider(rpcUrl, _dtmkChainId);
                const code = await provider.getCode(tokenAddress);
                if (code === '0x' || code === '0x0') {
                    logMessageMultiToken('error', '❌ No contract found at this address');
                    return;
                }
                const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

                // Isolated calls — one revert won't kill the others; bytes32 fallback for non-standard tokens
                function _decodeBytes32Mk(raw) {
                    try {
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
                async function _mkSafeSymbol() {
                    try { return await tokenContract.symbol(); } catch {}
                    try { const r = await provider.call({ to: tokenAddress, data: '0x95d89b41' }); const d = _decodeBytes32Mk(r); if (d) return d; } catch {}
                    return 'UNKNOWN';
                }
                async function _mkSafeName() {
                    try { return await tokenContract.name(); } catch {}
                    try { const r = await provider.call({ to: tokenAddress, data: '0x06fdde03' }); const d = _decodeBytes32Mk(r); if (d) return d; } catch {}
                    return '';
                }
                async function _mkSafeDecimals() {
                    try { return await tokenContract.decimals(); } catch {}
                    return 18;
                }
                const [symbol, decimals, name] = await Promise.all([
                    _mkSafeSymbol(),
                    _mkSafeDecimals(),
                    _mkSafeName(),
                ]);
                const symEl = document.getElementById('tokenSymbolMultiKeyToken');
                const decEl = document.getElementById('tokenDecimalsMultiKeyToken');
                if (symEl) symEl.value = symbol;
                if (decEl) decEl.value = decimals.toString();
                logMessageMultiToken('success', `\u2705 Token detected: ${name || symbol} (${symbol}, ${decimals} decimals)`);
            } catch (e) {
                logMessageMultiToken('error', `❌ Failed to detect token: ${e.message}`);
            }
        }

        // Missing function: clear NFT collect source wallet data
        function clearNftCollectData() {
            const keysEl = document.getElementById('nftSenderKeys');
            if (keysEl) keysEl.value = '';
            const countEl = document.getElementById('nftCollectWalletCount');
            if (countEl) countEl.textContent = '0';
        }

        function clearNftDistributeData() {
            document.getElementById('nftRecipientsDistribute').value = '';
            document.getElementById('nftDistributeRecipientsCount').textContent = '0';
        }
        
        // Show Empty State
        function showEmptyStateNft(containerId, message) {
            const container = document.getElementById(containerId);
            if (!container) {
                return;
            }
            container.innerHTML = `
                <div class="nft-empty-state">
                    <div class="nft-empty-state-icon">🎨</div>
                    <div style="font-size: 1.1rem; font-weight: 600; color: #a0a0a0;">${message}</div>
                </div>
            `;
        }