
        
        // Render Multi-Wallet NFT Grid (for collect mode)
        function renderMultiWalletNFTGrid(containerId, walletNFTMap) {
            const container = document.getElementById(containerId);
            if (!container) {
                return;
            }
            container.innerHTML = '';
            container.style.cssText = `
                max-height: 400px;
                overflow-y: auto;
                padding: 10px;
                background: rgba(0, 0, 0, 0.2);
                border-radius: 8px;
            `;
            
            let globalIndex = 0;
            let totalNFTs = 0;
            
            walletNFTMap.forEach((data, walletAddress) => {
                totalNFTs += data.nfts.length;
                
                const walletGroup = document.createElement('div');
                walletGroup.style.cssText = `
                    margin-bottom: 20px;
                    background: rgba(0, 26, 51, 0.4);
                    border-radius: 12px;
                    padding: 15px;
                    border: 2px solid rgba(74, 158, 255, 0.3);
                    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
                `;
                
                const header = document.createElement('div');
                header.style.cssText = `
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                    padding: 10px;
                    background: rgba(74, 158, 255, 0.1);
                    border-radius: 8px;
                    border: 1px solid rgba(74, 158, 255, 0.2);
                `;
                header.innerHTML = `
                    <div style="color: #4a9eff; font-family: monospace; font-weight: 600; font-size: 0.95rem;">
                        📍 ${walletAddress.substring(0, 10)}...${walletAddress.substring(walletAddress.length - 8)}
                    </div>
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 6px 14px; border-radius: 20px; font-size: 0.85rem; font-weight: 700; box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);">
                        ${data.nfts.length} NFT${data.nfts.length !== 1 ? 's' : ''}
                    </div>
                `;
                walletGroup.appendChild(header);
                
                const grid = document.createElement('div');
                grid.style.cssText = `
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
                    gap: 12px;
                    padding: 5px;
                `;
                
                data.nfts.forEach((nft) => {
                    const card = document.createElement('div');
                    card.dataset.index = globalIndex;
                    card.dataset.tokenId = nft.tokenId;
                    card.dataset.wallet = walletAddress;
                    card.style.cssText = `
                        position: relative;
                        background: linear-gradient(135deg, #1a2a3a 0%, #2a3a4a 100%);
                        border: 2px solid #2a3a4a;
                        border-radius: 10px;
                        padding: 10px;
                        cursor: pointer;
                        transition: all 0.2s ease;
                        overflow: hidden;
                        user-select: none;
                        -webkit-user-select: none;
                        -webkit-tap-highlight-color: transparent;
                        -webkit-touch-callout: none;
                    `;
                    
                    if (nft.image) {
                        card.innerHTML = `
                            <img src="${nft.image}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 8px; margin-bottom: 8px; background: #0a0a0a;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                            <div style="display: none; width: 100%; height: 120px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; align-items: center; justify-content: center; font-size: 2.5rem; margin-bottom: 8px;">🎨</div>
                            <div style="text-align: center;">
                                <div style="font-size: 0.85rem; font-weight: 600; color: #ffffff; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${nft.name}</div>
                                <div style="font-size: 0.75rem; color: #4a9eff; font-family: monospace;">#${nft.tokenId}</div>
                            </div>
                        `;
                    } else {
                        card.innerHTML = `
                            <div style="width: 100%; height: 120px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; margin-bottom: 8px;">🎨</div>
                            <div style="text-align: center;">
                                <div style="font-size: 0.85rem; font-weight: 600; color: #ffffff; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${nft.name}</div>
                                <div style="font-size: 0.75rem; color: #4a9eff; font-family: monospace;">#${nft.tokenId}</div>
                            </div>
                        `;
                    }
                    
                    // Mouse hover effects
                    card.addEventListener('mouseenter', () => {
                        if (!selectedNFTsCollect.has(globalIndex)) {
                            card.style.transform = 'translateY(-3px)';
                            card.style.borderColor = '#4a9eff';
                            card.style.boxShadow = '0 5px 20px rgba(74, 158, 255, 0.3)';
                        }
                    });
                    
                    card.addEventListener('mouseleave', () => {
                        if (!selectedNFTsCollect.has(globalIndex)) {
                            card.style.transform = '';
                            card.style.borderColor = '#2a3a4a';
                            card.style.boxShadow = '';
                        }
                    });
                    
                    // Click/Touch handling
                    const handleSelect = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        const idx = parseInt(card.dataset.index);
                        
                        if (selectedNFTsCollect.has(idx)) {
                            selectedNFTsCollect.delete(idx);
                            card.style.borderColor = '#2a3a4a';
                            card.style.background = 'linear-gradient(135deg, #1a2a3a 0%, #2a3a4a 100%)';
                            card.style.boxShadow = '';
                            card.style.transform = '';
                            // Remove checkmark
                            const checkmark = card.querySelector('.checkmark');
                            if (checkmark) checkmark.remove();
                        } else {
                            selectedNFTsCollect.add(idx);
                            card.style.borderColor = '#10b981';
                            card.style.background = 'linear-gradient(135deg, #1a3a2a 0%, #2a4a3a 100%)';
                            card.style.boxShadow = '0 5px 20px rgba(16, 185, 129, 0.4)';
                            card.style.transform = 'translateY(-2px)';
                            // Add checkmark
                            const checkmark = document.createElement('div');
                            checkmark.className = 'checkmark';
                            checkmark.style.cssText = `
                                position: absolute;
                                top: 5px;
                                right: 5px;
                                background: #10b981;
                                color: white;
                                width: 28px;
                                height: 28px;
                                border-radius: 50%;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                font-weight: bold;
                                font-size: 18px;
                                z-index: 2;
                                box-shadow: 0 2px 8px rgba(16, 185, 129, 0.5);
                            `;
                            checkmark.textContent = '✓';
                            card.appendChild(checkmark);
                        }
                        
                        updateSelectedCountNft('collect');
                    };
                    
                    card.addEventListener('click', handleSelect);
                    card.addEventListener('touchend', handleSelect);
                    
                    grid.appendChild(card);
                    globalIndex++;
                });
                
                walletGroup.appendChild(grid);
                container.appendChild(walletGroup);
            });
            
            document.getElementById('totalCountCollect').textContent = totalNFTs;
        }
        
        // Toggle NFT Selection - Distribute
        function toggleNFTSelectionDistribute(index) {
            const container = document.getElementById('nftGridDistribute');
            if (!container) {
                return;
            }
            
            const card = container.querySelector(`[data-index="${index}"]`);
            if (!card) {
                return;
            }
            
            if (selectedNFTsDistribute.has(index)) {
                selectedNFTsDistribute.delete(index);
                card.classList.remove('selected');
            } else {
                selectedNFTsDistribute.add(index);
                card.classList.add('selected');
            }
            
            updateSelectedCountNft('distribute');
        }
        
        // Toggle NFT Selection - Collect (simplified - main logic now in renderMultiWalletNFTGrid)
        function toggleNFTSelectionCollect(index) {
            // This function is kept for compatibility but logic moved to inline handlers
            updateSelectedCountNft('collect');
        }
        
        // Select/Deselect All NFTs
        function selectAllNFTs(mode) {
            if (mode === 'collect') {
                const container = document.getElementById('nftGridCollect');
                if (!container) return;
                
                let totalNFTs = 0;
                walletNFTMapCollect.forEach(data => {
                    totalNFTs += data.nfts.length;
                });
                
                const cards = container.querySelectorAll('[data-index]');
                
                cards.forEach(card => {
                    const idx = parseInt(card.dataset.index);
                    if (!selectedNFTsCollect.has(idx)) {
                        selectedNFTsCollect.add(idx);
                        card.style.borderColor = '#10b981';
                        card.style.background = 'linear-gradient(135deg, #1a3a2a 0%, #2a4a3a 100%)';
                        card.style.boxShadow = '0 5px 20px rgba(16, 185, 129, 0.4)';
                        card.style.transform = 'translateY(-2px)';
                        
                        // Add checkmark if not exists
                        if (!card.querySelector('.checkmark')) {
                            const checkmark = document.createElement('div');
                            checkmark.className = 'checkmark';
                            checkmark.style.cssText = `
                                position: absolute;
                                top: 5px;
                                right: 5px;
                                background: #10b981;
                                color: white;
                                width: 28px;
                                height: 28px;
                                border-radius: 50%;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                font-weight: bold;
                                font-size: 18px;
                                z-index: 2;
                                box-shadow: 0 2px 8px rgba(16, 185, 129, 0.5);
                            `;
                            checkmark.textContent = '✓';
                            card.appendChild(checkmark);
                        }
                    }
                });
                
                updateSelectedCountNft('collect');
            } else {
                // Distribute mode
                const totalNFTs = fetchedNFTsDistribute.length;
                selectedNFTsDistribute.clear();
                for (let i = 0; i < totalNFTs; i++) {
                    selectedNFTsDistribute.add(i);
                }
                document.querySelectorAll('#nftGridDistribute .nft-card').forEach(card => {
                    card.classList.add('selected');
                });
                updateSelectedCountNft('distribute');
            }
        }
        
        function deselectAllNFTs(mode) {
            if (mode === 'collect') {
                const container = document.getElementById('nftGridCollect');
                if (!container) return;
                
                selectedNFTsCollect.clear();
                
                const cards = container.querySelectorAll('[data-index]');
                cards.forEach(card => {
                    card.style.borderColor = '#2a3a4a';
                    card.style.background = 'linear-gradient(135deg, #1a2a3a 0%, #2a3a4a 100%)';
                    card.style.boxShadow = '';
                    card.style.transform = '';
                    
                    // Remove checkmark
                    const checkmark = card.querySelector('.checkmark');
                    if (checkmark) checkmark.remove();
                });
                
                updateSelectedCountNft('collect');
            } else {
                // Distribute mode
                selectedNFTsDistribute.clear();
                document.querySelectorAll('#nftGridDistribute .nft-card').forEach(card => {
                    card.classList.remove('selected');
                });
                updateSelectedCountNft('distribute');
            }
        }