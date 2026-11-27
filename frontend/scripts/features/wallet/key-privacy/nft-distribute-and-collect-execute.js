        
        // Execute Distribute
        async function executeNftDistribute() {
            window._thStopFlags = window._thStopFlags || {}; window._thStopFlags['nftDistribute'] = false;
            if (selectedNFTsDistribute.size === 0) {
                logMessageNft('error', '❌ Please select at least one NFT');
                return;
            }
            
            const recipients = document.getElementById('nftRecipientsDistribute').value.trim().split('\n').filter(r => r.trim());
            
            if (recipients.length === 0) {
                logMessageNft('error', '❌ Please provide recipient addresses');
                return;
            }
            
            if (selectedNFTsDistribute.size < recipients.length) {
                logMessageNft('error', `❌ Not enough NFTs selected (${selectedNFTsDistribute.size}) for ${recipients.length} recipients`);
                return;
            }
            
            const rpcUrl = document.getElementById('rpcUrlNft').value.trim();
            const _thRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('rpcUrlNft') : (rpcUrl ? [rpcUrl] : []);
            const _thChainId = parseInt((document.getElementById('rpcUrlNft')||{}).getAttribute?.('data-chainid')||'',10)||null;
            const contractAddress = document.getElementById('nftContractAddress').value.trim();
            let privateKey = document.getElementById('nftSenderKey').value.trim();
            const nftStandard = document.getElementById('nftStandard').value;
            

                    // Clean and normalize private key
                    let cleanedKey = privateKey
                        .replace(/\./g, '')      // Remove dots
                        .replace(/\s/g, '')      // Remove spaces
                        .replace(/[^0-9a-fA-Fx]/g, ''); // Keep only hex chars and 0x
                    
                    // Add 0x if missing
                    if (!cleanedKey.startsWith('0x')) {
                        cleanedKey = '0x' + cleanedKey;
                    }
                    
                    // Remove duplicate 0x
                    privateKey = cleanedKey.replace(/^0x0x/, '0x');

            
            const btn = document.getElementById('executeNftDistributeBtn');
            btn.disabled = true;
            btn.innerHTML = '<span class="loading-spinner"></span> Distributing...';
            if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txStart(); // BG: wake lock
            
            const progressBar = document.getElementById('progressFillNft');
            progressBar.style.width = '0%';
            
            try {
                // FIX: use thWithFallback for automatic multi-RPC failover
                let provider;
                try {
                  provider = await window.thWithFallback('rpcUrlNft', async function(_p) {
                    await Promise.race([_p.getBlockNumber(), new Promise((_,r)=>setTimeout(()=>r(new Error('probe timeout')),5000))]);
                    return _p;
                  }, 5000);
                } catch(_thErr) {
                  // All RPCs in list failed — fall back to single URL so caller can surface error naturally
                  const _fbCid = parseInt((document.getElementById('rpcUrlNft')||{}).getAttribute?.('data-chainid')||'',10)||null;
                  provider = window._thMakeProvider(rpcUrl, _fbCid);
                }
                const wallet = new ethers.Wallet(privateKey, provider);
                

                                
                const selectedNFTArray = Array.from(selectedNFTsDistribute).map(index => fetchedNFTsDistribute[index]);
                let successCount = 0;
                let failCount = 0;
                
                for (let i = 0; i < recipients.length; i++) {
                    if (window._thStopFlags && window._thStopFlags['nftDistribute']) { logMessageNft('warning', '⛔ Stopped by Pull-to-Refresh'); break; }
                    const nft = selectedNFTArray[i];
                    const recipient = recipients[i].trim();
                    
                    // Use NFT's contract address if available (multi-contract mode), otherwise use the input field
                    const nftContractAddress = nft.contractAddress || contractAddress;
                    const nftTokenType = nft.tokenType || nftStandard;
                    
                    try {
                        const contractInfo = nft.contractName ? ` from ${nft.contractName}` : '';
                        
                        // ── OneGas AI gas (AUTO / EIP-1559 / LEGACY) ──
                        // Get gas fee data for optimized L2 transactions
                        let txOptions = {};
                        const _nftDGas = await window._thGas(provider);
                        Object.assign(txOptions, _nftDGas);

                        // ⛔ PTR guard — re-check after async gas estimation
                        if (window._thStopFlags && window._thStopFlags['nftDistribute']) { break; }
                        let _nftDProvider = provider;
                        let _nftDWallet = wallet;
                        let _nftDReceipt;
                        _nftDReceipt = await window.thResilientSendAndConfirm({
                          rpcInputId: 'rpcUrlNft',
                          currentProvider: _nftDProvider,
                          onProviderRefresh: function(_p) {
                            _nftDProvider = _p;
                            // wallet is a loop `const` — _nftDWallet is the mutable reconnect reference.
                            _nftDWallet = new ethers.Wallet(_nftDWallet.privateKey, _p);
                          },
                          sendFn: async function() {
                            let _tx;
                            if (nftTokenType === 'ERC721') {
                              const _abi = ['function safeTransferFrom(address from, address to, uint256 tokenId) external'];
                              const _c = new ethers.Contract(nftContractAddress, _abi, _nftDWallet);
                              _tx = await _c.safeTransferFrom(_nftDWallet.address, recipient, nft.tokenId, txOptions);
                            } else {
                              const _abi = ['function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data) external'];
                              const _c = new ethers.Contract(nftContractAddress, _abi, _nftDWallet);
                              _tx = await _c.safeTransferFrom(_nftDWallet.address, recipient, nft.tokenId, 1, '0x', txOptions);
                            }
                            _thSaveTx(_tx.hash, 'rpcUrlNft', 'NFT Distribute');
                            return _tx;
                          },
                          logFn: logMessageNft,
                          label: 'NFT Distribute',
                          waitConfirm: true,
                        });
                        const receipt = _nftDReceipt;
                        // ── END RPC-RESILIENT (NFT Distribute) ───────────────────
                        
                        logMessageNft('success', `   ✅ TX: ${receipt.hash || receipt.transactionHash}`);
                        successCount++;
                        
                    } catch (error) {
                        logMessageNft('error', `   ❌ Failed: ${error.message.substring(0, 80)}`);
                        failCount++;
                    }
                    
                    progressBar.style.width = `${((i + 1) / recipients.length) * 100}%`;
                }
                
                logMessageNft('success', '🎉 DISTRIBUTION COMPLETED!');
                if (failCount > 0) {
                    if (failCount > 0) logMessageNft('warning', `⚠️ Failed: ${failCount}/${recipients.length}`);
                }
                                
            } catch (error) {
                logMessageNft('error', `❌ Error: ${error.message}`);
            } finally {
                btn.disabled = false;
                btn.innerHTML = 'Transfer NFTs';
                if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txEnd(); // BG: release wake lock
            }
        }
        
        // Execute Collect
        async function executeNftCollect() {
            window._thStopFlags = window._thStopFlags || {}; window._thStopFlags['nftCollect'] = false;
            if (selectedNFTsCollect.size === 0) {
                logMessageNft('error', '❌ Please select at least one NFT');
                return;
            }
            
            const recipient = document.getElementById('nftCollectRecipient').value.trim();
            
            if (!recipient) {
                logMessageNft('error', '❌ Please provide recipient address');
                return;
            }
            
            // Use Collect Mode specific inputs
            const rpcUrl = document.getElementById('rpcUrlNftCollect').value.trim();
            const _thRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('rpcUrlNftCollect') : (rpcUrl ? [rpcUrl] : []);
            const _thChainId = parseInt((document.getElementById('rpcUrlNftCollect')||{}).getAttribute?.('data-chainid')||'',10)||null;
            const contractAddress = document.getElementById('nftContractAddressCollect').value.trim();
            const nftStandard = document.getElementById('nftStandardCollect').value;
            
            if (!rpcUrl || !contractAddress) {
                logMessageNft('error', '❌ Select a network via the chain button (top right) and provide a contract address');
                return;
            }
            
            const btn = document.getElementById('executeNftCollectBtn');
            btn.disabled = true;
            btn.innerHTML = '<span class="loading-spinner"></span> Collecting...';
            if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txStart(); // BG: wake lock
            
            const progressBar = document.getElementById('progressFillNft');
            progressBar.style.width = '0%';
            
            try {
                // FIX: use thWithFallback for automatic multi-RPC failover
                let provider;
                try {
                  provider = await window.thWithFallback('rpcUrlNftCollect', async function(_p) {
                    await Promise.race([_p.getBlockNumber(), new Promise((_,r)=>setTimeout(()=>r(new Error('probe timeout')),5000))]);
                    return _p;
                  }, 5000);
                } catch(_thErr) {
                  // All RPCs in list failed — fall back to single URL so caller can surface error naturally
                  const _fbCid = parseInt((document.getElementById('rpcUrlNftCollect')||{}).getAttribute?.('data-chainid')||'',10)||null;
                  provider = window._thMakeProvider(rpcUrl, _fbCid);
                }
                

                                
                // Build array of selected NFTs with wallet info
                const selectedNFTArray = [];
                let globalIndex = 0;
                
                walletNFTMapCollect.forEach((data, walletAddress) => {
                    data.nfts.forEach((nft) => {
                        if (selectedNFTsCollect.has(globalIndex)) {
                            selectedNFTArray.push({
                                ...nft,
                                privateKey: data.privateKey
                            });
                        }
                        globalIndex++;
                    });
                });
                
                let successCount = 0;
                let failCount = 0;
                
                for (let i = 0; i < selectedNFTArray.length; i++) {
                    if (window._thStopFlags && window._thStopFlags['nftCollect']) { logMessageNft('warning', '⛔ Stopped by Pull-to-Refresh'); break; }
                    const nft = selectedNFTArray[i];
                    const wallet = new ethers.Wallet(nft.privateKey, provider);
                    
                    try {
                        
                        // ── OneGas AI gas (AUTO / EIP-1559 / LEGACY) ──
                        // Get gas fee data for optimized L2 transactions
                        let txOptions = {};
                        const _nftCGas = await window._thGas(provider);
                        Object.assign(txOptions, _nftCGas);

                        // ⛔ PTR guard — re-check after async gas estimation
                        if (window._thStopFlags && window._thStopFlags['nftCollect']) { break; }
                        
                        // ── RPC-RESILIENT SEND + CONFIRM (NFT Collect) ──────────
                        let _nftCProvider = provider;
                        let _nftCWalletLocal = wallet;
                        let _nftCReceipt;
                        _nftCReceipt = await window.thResilientSendAndConfirm({
                          rpcInputId: 'rpcUrlNftCollect',
                          currentProvider: _nftCProvider,
                          onProviderRefresh: function(_p) {
                            _nftCProvider = _p;
                            _nftCWalletLocal = new ethers.Wallet(nft.privateKey, _p);
                          },
                          sendFn: async function() {
                            let _tx;
                            if (nftStandard === 'ERC721') {
                              const _abi = ['function safeTransferFrom(address from, address to, uint256 tokenId) external'];
                              const _c = new ethers.Contract(contractAddress, _abi, _nftCWalletLocal);
                              _tx = await _c.safeTransferFrom(_nftCWalletLocal.address, recipient, nft.tokenId, txOptions);
                            } else {
                              const _abi = ['function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data) external'];
                              const _c = new ethers.Contract(contractAddress, _abi, _nftCWalletLocal);
                              _tx = await _c.safeTransferFrom(_nftCWalletLocal.address, recipient, nft.tokenId, 1, '0x', txOptions);
                            }
                            _thSaveTx(_tx.hash, 'rpcUrlNftCollect', 'NFT Collect');
                            return _tx;
                          },
                          logFn: logMessageNft,
                          label: 'NFT Collect',
                          waitConfirm: true,
                        });
                        const receipt = _nftCReceipt;
                        // ── END RPC-RESILIENT (NFT Collect) ──────────────────────
                        logMessageNft('success', `   ✅ TX: ${receipt.hash || receipt.transactionHash}`);
                        successCount++;
                        
                    } catch (error) {
                        logMessageNft('error', `   ❌ Failed: ${error.message.substring(0, 80)}`);
                        failCount++;
                    }
                    
                    progressBar.style.width = `${((i + 1) / selectedNFTArray.length) * 100}%`;
                }
                
                logMessageNft('success', '🎉 COLLECTION COMPLETED!');
                if (failCount > 0) {
                    if (failCount > 0) logMessageNft('warning', `⚠️ Failed: ${failCount}/${selectedNFTArray.length}`);
                }
                                
            } catch (error) {
                logMessageNft('error', `❌ Error: ${error.message}`);
            } finally {
                btn.disabled = false;
                btn.innerHTML = 'Collect NFTs';
                if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txEnd(); // BG: release wake lock
            }
        }