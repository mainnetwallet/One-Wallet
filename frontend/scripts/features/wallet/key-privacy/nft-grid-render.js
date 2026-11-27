        // Render NFT Grid (for distribute mode)
        function renderNFTGrid(containerId, nfts, mode) {
            const container = document.getElementById(containerId);
            if (!container) {
                return;
            }
            container.innerHTML = '';
            
            if (nfts.length === 0) {
                showEmptyStateNft(containerId, 'No NFTs found');
                return;
            }
            
            nfts.forEach((nft, index) => {
                const card = document.createElement('div');
                card.className = 'nft-card';
                card.dataset.index = index;
                card.dataset.tokenId = nft.tokenId;
                
                // Add contract address if available (for multi-contract display)
                const contractInfo = nft.contractAddress 
                    ? `<div class="nft-contract" style="font-size: 0.7rem; color: #888; margin-top: 2px;">${oneSanitize(nft.contractName || nft.contractAddress.substring(0, 8))}...</div>` 
                    : '';
                
                const _nftImg = oneSafeImgUrl(nft.image);
                if (_nftImg) {
                    card.innerHTML = `
                        <img src="${oneSanitize(_nftImg)}" class="nft-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <div class="nft-placeholder" style="display: none;">🎨</div>
                        <div class="nft-info">
                            <div class="nft-name">${oneSanitize(nft.name)}</div>
                            <div class="nft-id">#${oneSanitize(nft.tokenId)}</div>
                            ${contractInfo}
                        </div>
                    `;
                } else {
                    card.innerHTML = `
                        <div class="nft-placeholder">🎨</div>
                        <div class="nft-info">
                            <div class="nft-name">${oneSanitize(nft.name)}</div>
                            <div class="nft-id">#${oneSanitize(nft.tokenId)}</div>
                            ${contractInfo}
                        </div>
                    `;
                }
                
                // Improved touch/click handling
                card.style.cursor = 'pointer';
                card.style.userSelect = 'none';
                card.style.webkitUserSelect = 'none';
                card.style.webkitTouchCallout = 'none';
                
                // Add both click and touchend handlers for better mobile support
                const handleSelect = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (mode === 'distribute') {
                        toggleNFTSelectionDistribute(index);
                    } else {
                        toggleNFTSelectionCollect(index);
                    }
                };
                
                card.addEventListener('click', handleSelect);
                card.addEventListener('touchend', handleSelect);
                
                container.appendChild(card);
            });
            
            const totalCountEl = document.getElementById('totalCountDistribute');
            if (totalCountEl) {
                totalCountEl.textContent = nfts.length;
            }
        }