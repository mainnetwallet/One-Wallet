        
        // Fetch NFTs - Collect Mode
        async function fetchNFTsCollect() {
            
            
            // Use Collect Mode specific inputs
            const rpcUrl = document.getElementById('rpcUrlNftCollect').value.trim();
            const _thRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('rpcUrlNftCollect') : (rpcUrl ? [rpcUrl] : []);
            const _thChainId = parseInt((document.getElementById('rpcUrlNftCollect')||{}).getAttribute?.('data-chainid')||'',10)||null;
            const contractAddress = document.getElementById('nftContractAddressCollect').value.trim();
            const privateKeysText = document.getElementById('nftSenderKeys').value.trim();
            const nftStandard = document.getElementById('nftStandardCollect').value;
            const tokenIdsInput = document.getElementById('nftTokenIdsCollect').value.trim();
            
            
            
            if (!rpcUrl || !contractAddress || !privateKeysText) {
                logMessageNft('error', '❌ Please fill all required fields (RPC URL, Contract Address, and Private Keys)');
                console.error('❌ Validation failed:', { rpcUrl: !!rpcUrl, contractAddress: !!contractAddress, privateKeysText: !!privateKeysText });
                
                // Visual feedback
                if (!rpcUrl) {
                    const rpcInput = document.getElementById('rpcUrlNftCollect');
                    if (rpcInput) {
                        rpcInput.style.border = '2px solid #ef4444';
                        setTimeout(() => rpcInput.style.border = '', 2000);
                    }
                }
                if (!contractAddress) {
                    const contractInput = document.getElementById('nftContractAddressCollect');
                    if (contractInput) {
                        contractInput.style.border = '2px solid #ef4444';
                        setTimeout(() => contractInput.style.border = '', 2000);
                    }
                }
                if (!privateKeysText) {
                    const keysInput = document.getElementById('nftSenderKeys');
                    if (keysInput) {
                        keysInput.style.border = '2px solid #ef4444';
                        setTimeout(() => keysInput.style.border = '', 2000);
                    }
                }
                return;
            }
            
            const privateKeys = privateKeysText.split('\n').filter(k => k.trim());
            
            if (privateKeys.length === 0) {
                logMessageNft('error', '❌ No valid private keys provided');
                console.error('❌ No valid private keys found');
                return;
            }
            
            console.log(`✅ Found ${privateKeys.length} private key(s)`);
            
            const btn = document.getElementById('fetchNftsCollectBtn');
            if (!btn) {
                console.error('❌ Button element not found!');
                return;
            }
            btn.disabled = true;
            btn.innerHTML = '<span class="loading-spinner"></span> Fetching NFTs...';
            
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
                
                                                
                walletNFTMapCollect.clear();
                fetchedNFTsCollect = [];
                let totalNFTs = 0;
                
                for (let i = 0; i < privateKeys.length; i++) {
                    // Clean the private key
                    let cleanedKey = privateKeys[i]
                        .replace(/\./g, '')      // Remove dots
                        .replace(/\s/g, '')      // Remove spaces
                        .replace(/[^0-9a-fA-Fx]/g, ''); // Keep only hex chars and 0x
                    
                    // Add 0x if missing
                    if (!cleanedKey.startsWith('0x')) {
                        cleanedKey = '0x' + cleanedKey;
                    }
                    
                    // Remove duplicate 0x
                    const finalKey = cleanedKey.replace(/^0x0x/, '0x');
                    
                    const wallet = new ethers.Wallet(finalKey, provider);
                    
                    let nfts = [];
                    
                    // If token IDs provided, fetch specific tokens
                    if (tokenIdsInput) {
                        const tokenIds = tokenIdsInput
                            .split(/[\s,\n]+/)  // Split by space, comma, or newline
                            .map(id => id.trim())
                            .filter(id => id && /^\d+$/.test(id));
                        
                        if (tokenIds.length > 0) {
                            nfts = await fetchNFTsByTokenIds(wallet.address, contractAddress, tokenIds, nftStandard, provider);
                        }
                    } else {
                        // Otherwise fetch all NFTs from wallet
                        nfts = await fetchNFTsFromWallet(wallet.address, contractAddress, nftStandard, provider);
                    }
                    
                    if (nfts.length > 0) {
                        walletNFTMapCollect.set(wallet.address, {
                            privateKey: finalKey,
                            nfts: nfts
                        });
                        fetchedNFTsCollect.push(...nfts);
                        totalNFTs += nfts.length;
                    } else {
                    }
                }
                
                if (totalNFTs === 0) {
                    logMessageNft('warning', '⚠️ No NFTs found in any wallet');
                    showEmptyStateNft('nftGridCollect', 'No NFTs found');
                    const selectorEl = document.getElementById('nftSelectorCollect');
                    if (selectorEl) selectorEl.style.display = 'block';
                } else {
                    selectedNFTsCollect.clear();
                    renderMultiWalletNFTGrid('nftGridCollect', walletNFTMapCollect);
                    const selectorEl = document.getElementById('nftSelectorCollect');
                    const recipientEl = document.getElementById('recipientSectionCollect');
                    if (selectorEl) selectorEl.style.display = 'block';
                    if (recipientEl) recipientEl.style.display = 'block';
                    updateSelectedCountNft('collect');
                    logMessageNft('success', `✅ Total: ${totalNFTs} NFT(s) from ${walletNFTMapCollect.size} wallet(s)`);
                }
                                
            } catch (error) {
                logMessageNft('error', `❌ Error: ${error.message}`);
                showEmptyStateNft('nftGridCollect', 'Error loading NFTs');
                const selectorEl = document.getElementById('nftSelectorCollect');
                if (selectorEl) selectorEl.style.display = 'block';
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<span class="material-icons-round">search</span>Fetch';
            }
        }
        
        // Fetch NFTs from a single wallet
        
        // Fetch ALL NFTs from wallet (OpenSea mode - any contract)
        async function fetchAllNFTsFromWallet(walletAddress, rpcUrl) {
            const nfts = [];
            
            try {
                // Detect if RPC is Alchemy (contains 'alchemy' in URL)
                if (rpcUrl.includes('alchemy')) {
                        
                    // Extract Alchemy API key from URL
                    const alchemyUrl = rpcUrl.replace('/v2/', '/nft/v3/');
                    
                    try {
                        const response = await fetch(`${alchemyUrl}/getNFTsForOwner?owner=${walletAddress}&withMetadata=true&pageSize=100`);
                        const data = await response.json();
                        
                        if (data.ownedNfts && data.ownedNfts.length > 0) {
                            
                            for (const nft of data.ownedNfts) {
                                nfts.push({
                                    tokenId: nft.tokenId,
                                    name: nft.name || nft.contract.name || `Token #${nft.tokenId}`,
                                    image: nft.image?.cachedUrl || nft.image?.originalUrl || nft.raw?.metadata?.image?.replace('ipfs://', 'https://ipfs.io/ipfs/') || null,
                                    contractAddress: nft.contract.address,
                                    contractName: nft.contract.name,
                                    tokenType: nft.contract.tokenType,
                                    walletAddress: walletAddress
                                });
                            }
                            
                            return nfts;
                        }
                    } catch (e) {
                    }
                }
                
                // Fallback: Scan for common NFT contracts on the chain
                                
                const _nftScanChainId = parseInt((document.getElementById('rpcUrlNft')||{}).getAttribute?.('data-chainid')||'',10)||null;
                const _nftScanRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('rpcUrlNft') : [];
                if (rpcUrl && !_nftScanRpcs.includes(rpcUrl)) _nftScanRpcs.unshift(rpcUrl);
                // FIX: iterate full RPC list with fallback instead of single URL
                let provider;
                for (const _rpc of (_nftScanRpcs.length ? _nftScanRpcs : [rpcUrl])) {
                  try {
                    const _p = window._thMakeProvider(_rpc, _nftScanChainId);
                    await Promise.race([_p.getBlockNumber(), new Promise((_,r)=>setTimeout(()=>r(new Error('timeout')),5000))]);
                    provider = _p; break;
                  } catch(_e) { continue; }
                }
                if (!provider) provider = window._thMakeProvider(rpcUrl, _nftScanChainId);
                const currentBlock = await provider.getBlockNumber();
                const fromBlock = Math.max(0, currentBlock - 50000);
                
                
                // Scan for ERC721 Transfer events
                const transferEvents = await provider.getLogs({
                    topics: [
                        ethers.id('Transfer(address,address,uint256)'),
                        null,
                        ethers.zeroPadValue(walletAddress, 32)
                    ],
                    fromBlock: fromBlock,
                    toBlock: 'latest'
                });
                
                                
                // Group by contract address
                const contractMap = new Map();
                for (const event of transferEvents) {
                    const contractAddr = event.address;
                    if (!contractMap.has(contractAddr)) {
                        contractMap.set(contractAddr, new Set());
                    }
                    const tokenId = BigInt(event.topics[3]);
                    contractMap.get(contractAddr).add(tokenId);
                }
                
                
                // Verify ownership for each NFT
                let verifiedCount = 0;
                for (const [contractAddr, tokenIds] of contractMap.entries()) {
                    const abi = [
                        'function ownerOf(uint256 tokenId) view returns (address)',
                        'function tokenURI(uint256 tokenId) view returns (string)',
                        'function name() view returns (string)'
                    ];
                    
                    try {
                        const contract = new ethers.Contract(contractAddr, abi, provider);
                        let contractName = '';
                        
                        try {
                            contractName = await contract.name();
                        } catch (e) {}
                        
                        for (const tokenId of tokenIds) {
                            try {
                                const owner = await contract.ownerOf(tokenId);
                                if (owner.toLowerCase() === walletAddress.toLowerCase()) {
                                    let metadata = null;
                                    let image = null;
                                    
                                    try {
                                        const uri = await contract.tokenURI(tokenId);
                                        if (uri.startsWith('data:application/json')) {
                                            const jsonString = atob(uri.split(',')[1]);
                                            metadata = JSON.parse(jsonString);
                                        } else if (uri.startsWith('http')) {
                                            const response = await fetch(uri.replace('ipfs://', 'https://ipfs.io/ipfs/'));
                                            metadata = await response.json();
                                        }
                                        image = metadata?.image?.replace('ipfs://', 'https://ipfs.io/ipfs/');
                                    } catch (e) {}
                                    
                                    nfts.push({
                                        tokenId: tokenId.toString(),
                                        name: metadata?.name || `${contractName} #${tokenId}`,
                                        image: image,
                                        contractAddress: contractAddr,
                                        contractName: contractName,
                                        tokenType: 'ERC721',
                                        walletAddress: walletAddress
                                    });
                                    
                                    verifiedCount++;
                                    if (verifiedCount % 5 === 0) {
                                    }
                                }
                            } catch (e) {}
                        }
                    } catch (e) {}
                }
                
                
            } catch (error) {
                logMessageNft('error', `❌ Error: ${error.message}`);
            }
            
            return nfts;
        }
        
        
