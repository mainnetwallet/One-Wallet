        async function fetchNFTsFromWallet(walletAddress, contractAddress, nftStandard, provider) {
            const nfts = [];
            
            try {
                if (nftStandard === 'ERC721') {
                    const abi = [
                        'function balanceOf(address owner) view returns (uint256)',
                        'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
                        'function tokenURI(uint256 tokenId) view returns (string)',
                        'function ownerOf(uint256 tokenId) view returns (address)'
                    ];
                    
                    const contract = new ethers.Contract(contractAddress, abi, provider);
                    
                    const balance = await contract.balanceOf(walletAddress);
                    
                    if (Number(balance) === 0) {
                        logMessageNft('warning', '⚠️ Balance is 0 - wallet has no NFTs from this contract');
                        return nfts;
                    }
                    
                    try {
                        for (let i = 0; i < Number(balance); i++) {
                            const tokenId = await contract.tokenOfOwnerByIndex(walletAddress, i);
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
                                tokenId: tokenId.toString(),
                                name: metadata?.name || `Token #${tokenId}`,
                                image: metadata?.image?.replace('ipfs://', 'https://ipfs.io/ipfs/') || null,
                                walletAddress: walletAddress
                            });
                        }
                    } catch (e) {
                        // Use Transfer events fallback
                        
                        const currentBlock = await provider.getBlockNumber();
                        // Scan last 500,000 blocks for better coverage
                        const fromBlock = Math.max(0, currentBlock - 500000);
                        
                        
                        let candidateTokenIds = new Set();
                        let tokenIds = new Set();
                        
                        try {
                            const transferEvents = await provider.getLogs({
                                address: contractAddress,
                                topics: [
                                    ethers.id('Transfer(address,address,uint256)'),
                                    null,
                                    ethers.zeroPadValue(walletAddress, 32)
                                ],
                                fromBlock: fromBlock,
                                toBlock: 'latest'
                            });
                            
                                                        
                            // Collect all potential token IDs from events
                            for (const event of transferEvents) {
                                const tokenId = BigInt(event.topics[3]);
                                candidateTokenIds.add(tokenId.toString());
                            }
                            
                            
                            // Now verify which ones are still owned
                            let checked = 0;
                            for (const tokenId of candidateTokenIds) {
                                try {
                                    const owner = await contract.ownerOf(tokenId);
                                    if (owner.toLowerCase() === walletAddress.toLowerCase()) {
                                        tokenIds.add(tokenId);
                                        if (tokenIds.size === balanceNum) break; // Found all
                                    }
                                } catch (e) {}
                                
                                checked++;
                                if (checked % 10 === 0 && tokenIds.size < balanceNum) {
                                }
                            }
                            
                        } catch (rpcError) {
                        }
                        
                        // If still no NFTs found, try smart sequential scan
                        if (tokenIds.size === 0) {
                            const balanceCheck = await contract.balanceOf(walletAddress);
                            const balanceNum = Number(balanceCheck);
                            
                            if (balanceNum > 0) {
                                
                                // Strategy 1: Sample common ranges first (faster)
                                const ranges = [
                                    [1, 100],           // Very early tokens
                                    [1000, 1500],       // Mid-range
                                    [10000, 10100],     // Higher range
                                    [100, 1000],        // Extended early
                                    [1500, 5000],       // Mid-extended
                                    [5000, 15000]       // Wide range
                                ];
                                
                                for (const [start, end] of ranges) {
                                    if (tokenIds.size >= balanceNum) break;
                                    
                                    
                                    for (let tokenId = start; tokenId <= end && tokenIds.size < balanceNum; tokenId++) {
                                        try {
                                            const owner = await contract.ownerOf(tokenId);
                                            if (owner.toLowerCase() === walletAddress.toLowerCase()) {
                                                tokenIds.add(tokenId.toString());
                                            }
                                        } catch (e) {
                                            // Token doesn't exist, continue
                                        }
                                        
                                        // Quick progress for large ranges
                                        if (tokenId % 200 === 0 && tokenIds.size < balanceNum) {
                                        }
                                    }
                                }
                                
                                if (tokenIds.size > 0) {
                                        }
                            }
                        }
                        
                        for (const tokenId of tokenIds) {
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
                            } catch (e) {}
                            
                            nfts.push({
                                tokenId: tokenId,
                                name: metadata?.name || `Token #${tokenId}`,
                                image: metadata?.image?.replace('ipfs://', 'https://ipfs.io/ipfs/') || null,
                                walletAddress: walletAddress
                            });
                        }
                    }
                    
                } else {
                    // ERC1155
                    const abi = [
                        'function balanceOf(address account, uint256 id) view returns (uint256)',
                        'function uri(uint256 id) view returns (string)'
                    ];
                    
                    const contract = new ethers.Contract(contractAddress, abi, provider);
                    
                    for (let tokenId = 1; tokenId <= 100; tokenId++) {
                        try {
                            const balance = await contract.balanceOf(walletAddress, tokenId);
                            if (balance > 0n) {
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
                            }
                        } catch (e) {}
                    }
                }
            } catch (error) {
                logMessageNft('error', `❌ Critical error: ${error.message}`);
            }
            
            return nfts;
        }
        
