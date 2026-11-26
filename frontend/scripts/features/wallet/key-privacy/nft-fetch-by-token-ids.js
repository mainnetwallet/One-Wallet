        // Fetch specific NFTs by token IDs (FAST MODE)
        async function fetchNFTsByTokenIds(walletAddress, contractAddress, tokenIds, nftStandard, provider) {
            const nfts = [];
            
            
            try {
                const abi = [
                    'function ownerOf(uint256 tokenId) view returns (address)',
                    'function tokenURI(uint256 tokenId) view returns (string)',
                    'function balanceOf(address account, uint256 id) view returns (uint256)',
                    'function uri(uint256 id) view returns (string)'
                ];
                
                const contract = new ethers.Contract(contractAddress, abi, provider);
                
                let successCount = 0;
                let notOwnedCount = 0;
                
                for (const tokenId of tokenIds) {
                    try {
                        if (nftStandard === 'ERC721') {
                            const owner = await contract.ownerOf(tokenId);
                            
                            if (owner.toLowerCase() !== walletAddress.toLowerCase()) {
                                logMessageNft('warning', `  ⚠️ Token #${tokenId}: Not owned by this wallet (Owner: ${owner})`);
                                notOwnedCount++;
                                continue;
                            }
                            
                            let metadata = null;
                            try {
                                const uri = await contract.tokenURI(tokenId);
                                if (uri.startsWith('data:application/json')) {
                                    const jsonString = atob(uri.split(',')[1]);
                                    metadata = JSON.parse(jsonString);
                                } else if (uri.startsWith('http')) {
                                    const response = await fetch(uri.replace('ipfs://', 'https://ipfs.io/ipfs/'));
                                    metadata = await response.json();
                                }
                            } catch (e) {
                            }
                            
                            nfts.push({
                                tokenId: tokenId,
                                name: metadata?.name || `Token #${tokenId}`,
                                image: metadata?.image?.replace('ipfs://', 'https://ipfs.io/ipfs/') || null,
                                walletAddress: walletAddress
                            });
                            
                            successCount++;
                            
                        } else {
                            // ERC1155
                            const balance = await contract.balanceOf(walletAddress, tokenId);
                            
                            if (balance === 0n) {
                                logMessageNft('warning', `  ⚠️ Token #${tokenId}: Balance is 0`);
                                notOwnedCount++;
                                continue;
                            }
                            
                            let metadata = null;
                            try {
                                const uri = await contract.uri(tokenId);
                                const actualUri = uri.replace('{id}', tokenId.toString().padStart(64, '0'));
                                if (actualUri.startsWith('data:application/json')) {
                                    const jsonString = atob(actualUri.split(',')[1]);
                                    metadata = JSON.parse(jsonString);
                                } else if (actualUri.startsWith('http')) {
                                    const response = await fetch(actualUri.replace('ipfs://', 'https://ipfs.io/ipfs/'));
                                    metadata = await response.json();
                                }
                            } catch (e) {}
                            
                            nfts.push({
                                tokenId: tokenId.toString(),
                                name: metadata?.name || `Token #${tokenId}`,
                                image: metadata?.image?.replace('ipfs://', 'https://ipfs.io/ipfs/') || null,
                                amount: balance.toString(),
                                walletAddress: walletAddress
                            });
                            
                            successCount++;
                        }
                        
                    } catch (error) {
                        logMessageNft('error', `  ❌ Token #${tokenId}: ${error.message.substring(0, 50)}`);
                    }
                }
                
                if (notOwnedCount > 0) {
                    logMessageNft('warning', `⚠️ ${notOwnedCount} token(s) not owned by this wallet`);
                }
                
                
            } catch (error) {
                logMessageNft('error', `❌ Error: ${error.message}`);
            }
            
            return nfts;
        }
        
