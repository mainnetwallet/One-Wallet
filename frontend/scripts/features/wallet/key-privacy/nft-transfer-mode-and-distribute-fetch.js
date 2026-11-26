function selectNftTransferMode(mode) {
            currentNftMode = mode;
            
            const distributeCard = document.getElementById('nftDistributeModeCard');
            const collectCard = document.getElementById('nftCollectModeCard');
            const distributeSection = document.getElementById('nftDistributeSection');
            const collectSection = document.getElementById('nftCollectSection');
            
            if (mode === 'distribute') {
                // Distribute button active
                distributeCard.style.background = 'linear-gradient(135deg, #4a90e2, #357abd)';
                distributeCard.style.color = 'white';
                distributeCard.style.boxShadow = '0 2px 10px rgba(74, 144, 226, 0.4)';
                
                // Collect button inactive
                collectCard.style.background = 'rgba(255, 255, 255, 0.08)';
                collectCard.style.color = '#78c8ff';
                collectCard.style.boxShadow = 'none';
                
                distributeSection.style.display = 'block';
                collectSection.style.display = 'none';
            } else {
                // Collect button active
                collectCard.style.background = 'linear-gradient(135deg, #4a90e2, #357abd)';
                collectCard.style.color = 'white';
                collectCard.style.boxShadow = '0 2px 10px rgba(74, 144, 226, 0.4)';
                
                // Distribute button inactive
                distributeCard.style.background = 'rgba(255, 255, 255, 0.08)';
                distributeCard.style.color = '#78c8ff';
                distributeCard.style.boxShadow = 'none';
                
                distributeSection.style.display = 'none';
                collectSection.style.display = 'block';
            }
            
            // Reset selections
            fetchedNFTsDistribute = [];
            fetchedNFTsCollect = [];
            selectedNFTsDistribute.clear();
            selectedNFTsCollect.clear();
            walletNFTMapCollect.clear();
            
            if (mode === 'distribute') { _thLogInitialRpc('rpcUrlNft', logMessageNft); }
            else { _thLogInitialRpc('rpcUrlNftCollect', logMessageNft); }
        }
        
        // Fetch NFTs - Distribute Mode (TOKEN ID ONLY - NO AUTO DETECT)
        async function fetchNFTsDistribute() {
            const rpcUrl = document.getElementById('rpcUrlNft').value.trim();
            const _thRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('rpcUrlNft') : (rpcUrl ? [rpcUrl] : []);
            const _thChainId = parseInt((document.getElementById('rpcUrlNft')||{}).getAttribute?.('data-chainid')||'',10)||null;
            const contractAddress = document.getElementById('nftContractAddress').value.trim();
            const tokenIdsInput = document.getElementById('nftTokenIds').value.trim();
            let privateKey = document.getElementById('nftSenderKey').value.trim();
            const nftStandard = document.getElementById('nftStandard').value;
            
            // Validate required fields
            if (!rpcUrl || !privateKey) {
                logMessageNft('error', '❌ Select a network via the chain button (top right) and provide a private key');
                return;
            }
            
            if (!contractAddress) {
                logMessageNft('error', '❌ Please provide NFT contract address');
                return;
            }
            
            if (!tokenIdsInput) {
                logMessageNft('error', '❌ Please provide Token IDs (auto-detect is disabled)');
                                return;
            }

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

            
            // Mark as fetch in progress
            window.nftFetchInProgress = true;
            
            // Show loading in NFT count
            const nftCountRow = document.getElementById('nftCountRow');
            const nftCountElement = document.getElementById('nftSenderCount');
            if (nftCountRow) {
                nftCountRow.style.display = '';
                if (nftCountElement) {
                    nftCountElement.innerHTML = '<span class="loading-spinner" style="width: 14px; height: 14px; border-width: 2px;"></span> Loading...';
                }
            }
            
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
                
                
                let nfts = [];
                
                // TOKEN ID MODE ONLY - Parse and validate token IDs
                const tokenIds = tokenIdsInput
                    .split(/[\s,\n]+/)  // Split by space, comma, or newline
                    .map(id => id.trim())
                    .filter(id => id && /^\d+$/.test(id));
                
                if (tokenIds.length === 0) {
                    logMessageNft('error', '❌ No valid token IDs found. Please enter numbers only.');
                                        if (nftCountElement) {
                        nftCountElement.innerHTML = '0 NFTs';
                        nftCountElement.style.color = '#ef4444';
                    }
                    window.nftFetchInProgress = false;
                    return;
                }
                
                
                nfts = await fetchNFTsByTokenIds(wallet.address, contractAddress, tokenIds, nftStandard, provider);
                
                // Update NFT count display
                if (nftCountElement) {
                    nftCountElement.innerHTML = `<strong>${nfts.length}</strong> NFT${nfts.length !== 1 ? 's' : ''}`;
                    nftCountElement.style.color = nfts.length > 0 ? '#10b981' : '#ef4444';
                }
                
                if (nfts.length === 0) {
                    logMessageNft('warning', '⚠️ No NFTs found in this wallet');
                    showEmptyStateNft('nftGridDistribute', 'No NFTs found');
                    const selectorEl = document.getElementById('nftSelectorDistribute');
                    if (selectorEl) selectorEl.style.display = 'block';
                } else {
                    fetchedNFTsDistribute = nfts;
                    selectedNFTsDistribute.clear();
                    renderNFTGrid('nftGridDistribute', nfts, 'distribute');
                    const selectorEl = document.getElementById('nftSelectorDistribute');
                    const recipientsEl = document.getElementById('recipientsSectionDistribute');
                    if (selectorEl) selectorEl.style.display = 'block';
                    if (recipientsEl) recipientsEl.style.display = 'block';
                    updateSelectedCountNft('distribute');
                }
                
            } catch (error) {
                logMessageNft('error', `❌ Error: ${error.message}`);
                showEmptyStateNft('nftGridDistribute', 'Error loading NFTs');
                const selectorEl = document.getElementById('nftSelectorDistribute');
                if (selectorEl) selectorEl.style.display = 'block';
                
                // Show error in count
                if (nftCountElement) {
                    nftCountElement.innerHTML = 'Error';
                    nftCountElement.style.color = '#ef4444';
                }
            } finally {
                window.nftFetchInProgress = false;
            }
        }
