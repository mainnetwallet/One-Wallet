
        // Wallet Functions
        // Named function so wallet picker can call it directly
        window.checkBatchNativeWallet = async function() {
                clearTimeout(walletCheckTimeout);
                const mySeq = ++_walletCheckSeq;
                
                let input = document.getElementById('privateKey').value.trim();
                
                signer = null;
                window.cachedWallet = null;
                
                if (!input) {
                    document.getElementById('walletAddress').textContent = '-';
                    document.getElementById('walletBalance').textContent = '-';
                    if (typeof checkDeployReady === 'function') checkDeployReady();
                    return;
                }

                let hexValue = input.replace(/\s+/g, '');
                const hexMatches = hexValue.match(/0x[a-f0-9]+|[a-f0-9]+/gi);
                if (!hexMatches || hexMatches.length === 0) {
                    document.getElementById('walletAddress').textContent = 'Invalid key';
                    document.getElementById('walletBalance').textContent = '-';
                    if (typeof checkDeployReady === 'function') checkDeployReady();
                    return;
                }
                let longestHex = hexMatches.reduce((a, b) => a.length > b.length ? a : b);
                longestHex = longestHex.toLowerCase();
                if (!longestHex.startsWith('0x')) longestHex = '0x' + longestHex;

                const is64Hex = longestHex.length === 66;
                const is40Hex = longestHex.length === 42;

                if (!is64Hex && !is40Hex) {
                    document.getElementById('walletAddress').textContent = 'Invalid key';
                    document.getElementById('walletBalance').textContent = '-';
                    if (typeof checkDeployReady === 'function') checkDeployReady();
                    return;
                }

                // STEP 1: Show address instantly (no RPC needed)
                let addressToShow;
                try {
                    if (is40Hex) {
                        addressToShow = longestHex;
                    } else {
                        const wallet = new ethers.Wallet(longestHex);
                        signer = wallet.connect(provider || null);
                        addressToShow = wallet.address;
                    }
                    const short = addressToShow.substring(0, 10) + '...' + addressToShow.substring(addressToShow.length - 8);
                    document.getElementById('walletAddress').textContent = short;
                    document.getElementById('walletBalance').textContent = 'Loading...';
                    checkDeployReady();
                } catch(e) {
                    document.getElementById('walletAddress').textContent = 'Invalid key';
                    document.getElementById('walletBalance').textContent = '-';
                    return;
                }

                // STEP 2: Fetch balance via RPC (async, non-blocking)
                walletCheckTimeout = setTimeout(async () => {
                    if (mySeq !== _walletCheckSeq) return;
                    try {
                        // Ensure provider is ready — auto-init with Base if needed
                        if (!provider || !currentChainConfig) {
                            try { await initializeProvider(); } catch(_) {}
                        }
                        if (!provider) {
                            document.getElementById('walletBalance').textContent = 'RPC error';
                            return;
                        }
                        const symbol = currentChainConfig?.symbol || 'ETH';
                        // Use thWithFallback for resilient balance fetch with auto-RPC-switch
                        let balance;
                        try {
                            balance = await window.thWithFallback('rpcUrl', async function(p) {
                                // Also keep provider in sync with whichever RPC is working
                                const bal = await p.getBalance(addressToShow);
                                provider = p;  // update provider reference to the working RPC
                                if (!is40Hex && signer) signer = new ethers.Wallet(longestHex, p);
                                return bal;
                            }, 8000);
                        } catch(_) {
                            // Last-resort: use existing provider directly
                            balance = await window.thRead('rpcUrl', provider, function(_p) { return _p.getBalance(addressToShow); }, 6000);
                        }
                        if (mySeq !== _walletCheckSeq) return;
                        const balanceEth = ethers.formatEther(balance);
                        document.getElementById('walletBalance').textContent = parseFloat(balanceEth).toFixed(6) + ' ' + symbol;
                        checkDeployReady();
                    } catch (error) {
                        if (mySeq === _walletCheckSeq) {
                            document.getElementById('walletBalance').textContent = 'RPC error';
                        }
                    }
                }, 0);
        };

        document.addEventListener('DOMContentLoaded', () => {
            document.getElementById('privateKey').addEventListener('input', window.checkBatchNativeWallet);

            document.getElementById('amountPerAddress').addEventListener('input', (e) => {
                let value = e.target.value;
                value = value.replace(/[^\d.]/g, '');
                const parts = value.split('.');
                if (parts.length > 2) {
                    value = parts[0] + '.' + parts.slice(1).join('');
                }
                e.target.value = value;
                
                const amount = parseFloat(value) || 0;
                const addresses = document.getElementById('totalAddresses').textContent;
                const total = (parseFloat(addresses) * amount).toFixed(18);
                
                document.getElementById('perAddressDisplay').textContent = amount;
                document.getElementById('totalAmount').textContent = parseFloat(total).toString();
                checkDeployReady();
            });

            let autoValidateTimeout;
            
            document.getElementById('receiverAddresses').addEventListener('input', (e) => {
                autoUpdateAddressCount();
                checkDeployReady();
                
                // Auto-validate after 500ms of no typing
                clearTimeout(autoValidateTimeout);
                autoValidateTimeout = setTimeout(() => {
                    const input = document.getElementById('receiverAddresses').value;
                    const addresses = parseAddresses(input);
                    if (addresses.length > 0) {
                        formatAddresses();
                    }
                }, 500);
            });

            document.getElementById('receiverAddresses').addEventListener('paste', (e) => {
                setTimeout(() => {
                    autoUpdateAddressCount();
                    checkDeployReady();
                    
                    // Auto-validate immediately after paste
                    const input = document.getElementById('receiverAddresses').value;
                    const addresses = parseAddresses(input);
                    if (addresses.length > 0) {
                        formatAddresses();
                    }
                }, 100);
            });
        });

        function checkDeployReady() {
            const hasWallet = signer !== null;
            const hasChain = currentChainConfig !== null;
            const hasProvider = provider !== null;
            const hasContract = compiledContract !== null;
            const addressInput = document.getElementById('receiverAddresses').value;
            const hasAddresses = parseAddresses(addressInput).length > 0;
            const amountVal = document.getElementById('amountPerAddress').value;
            const hasAmount = amountVal && parseFloat(amountVal) > 0;
            // Check both activeContractAddress and savedContracts isActive (handles page reload case)
            const hasContractSelected = !!activeContractAddress || savedContracts.some(c => c.isActive);

            // Deploy: needs wallet + chain + provider + compiledContract + recipients + amount + no saved contract
            const canDeploy = hasWallet && hasChain && hasProvider && hasContract && hasAddresses && hasAmount && !hasContractSelected;
            document.getElementById('deployBtn').disabled = !canDeploy;

            // Execute: needs wallet + recipients + amount + saved contract selected
            const canExecute = hasWallet && hasAddresses && hasAmount && hasContractSelected;
            document.getElementById('executeBtn').disabled = !canExecute;
        }
        function autoUpdateAddressCount() {
            const input = document.getElementById('receiverAddresses').value;
            const addresses = parseAddresses(input);
            
            if (addresses.length > 0) {
                document.getElementById('totalAddresses').textContent = addresses.length;
                const amount = parseFloat(document.getElementById('amountPerAddress').value) || 0;
                document.getElementById('totalAmount').textContent = (addresses.length * amount).toFixed(8);
            }
        }

        function formatAddresses() {
            const input = document.getElementById('receiverAddresses').value;
            
            // Enable verbose logging for this parse
            window.parseAddressesVerbose = true;
            let addresses = parseAddresses(input);
            window.parseAddressesVerbose = false;
            
            if (addresses.length === 0) {
                return;
            }
            
            const uniqueAddresses = [...new Set(addresses.map(addr => addr.toLowerCase()))];
            const duplicateCount = addresses.length - uniqueAddresses.length;
            
            const formattedAddresses = uniqueAddresses.map(addr => 
                addr.startsWith('0x') ? addr : '0x' + addr
            );
            
            document.getElementById('totalAddresses').textContent = formattedAddresses.length;
            const amount = parseFloat(document.getElementById('amountPerAddress').value) || 0;
            document.getElementById('totalAmount').textContent = (formattedAddresses.length * amount).toFixed(8);
            
            
            const totalValue = formattedAddresses.length * amount;
            if (amount > 0) {
            }
            
            if (duplicateCount > 0) {
            }
            
            document.getElementById('receiverAddresses').value = formattedAddresses.join('\n');
            // DO NOT SAVE: localStorage.setItem('receiverAddresses', formattedAddresses.join('\n'));
            
            checkDeployReady();
        }

        function parseAddresses(input) {
            const items = input.match(/0x[a-fA-F0-9]+|[a-fA-F0-9]+/g) || [];
            
            const addresses = items.filter(item => {
                // Check if it's an address (40 hex chars with or without 0x)
                if (item.length === 42 && item.startsWith('0x')) {
                    // Use ethers.isAddress() for proper checksum validation
                    return ethers.isAddress(item);
                }
                if (item.length === 40 && !item.startsWith('0x')) {
                    // Add 0x prefix and validate
                    return ethers.isAddress('0x' + item);
                }
                return false;
            });
            
            const privateKeys = items.filter(item => {
                const len = item.startsWith('0x') ? item.length : item.length + 2;
                return len === 66;
            });
            
            let extractedFromKeys = 0;
            privateKeys.forEach(pk => {
                try {
                    let key = pk.startsWith('0x') ? pk : '0x' + pk;
                    const wallet = new ethers.Wallet(key);
                    addresses.push(wallet.address);
                    extractedFromKeys++;
                } catch (e) {
                }
            });
            
            // Log detection summary if we're actively parsing (not just counting)
            if (window.parseAddressesVerbose && (addresses.length > 0 || privateKeys.length > 0)) {
                const directAddresses = addresses.length - extractedFromKeys;
                if (directAddresses > 0) {
                                    }
                if (extractedFromKeys > 0) {
                                    }
            }
            
            return addresses;
        }

        // Deploy and Transfer
        // ========================================
        // CONTRACT 1: BATCH NATIVE TRANSFER
        // ========================================
        // Purpose: Direct batch native coin transfer
        // Used in: Batch Transfer Native UI
        // Replace with your compiled bytecode from Contract1_BatchNativeTransfer.sol
        const BATCH_NATIVE_BYTECODE = "0x6080604052348015600e575f5ffd5b505f80546001600160a01b03191633179055610ac08061002d5f395ff3fe608060405260043610610054575f3560e01c806312065fe014610056578063169a0882146100775780632f622e6b1461008a5780633aeac4e1146100a95780633aecd0e3146100c85780638da5cb5b146100e7575b005b348015610061575f5ffd5b50475b6040519081526020015b60405180910390f35b6100546100853660046108cd565b61011d565b348015610095575f5ffd5b506100546100a4366004610950565b610440565b3480156100b4575f5ffd5b506100546100c3366004610972565b6105b1565b3480156100d3575f5ffd5b506100646100e2366004610950565b610817565b3480156100f2575f5ffd5b505f54610105906001600160a01b031681565b6040516001600160a01b03909116815260200161006e565b5f546001600160a01b0316331461014f5760405162461bcd60e51b8152600401610146906109a9565b60405180910390fd5b8281146101ad5760405162461bcd60e51b815260206004820152602660248201527f526563697069656e747320616e6420616d6f756e7473206c656e677468206d696044820152650e6dac2e8c6d60d31b6064820152608401610146565b826101f35760405162461bcd60e51b8152602060048201526016602482015275139bc81c9958da5c1a595b9d1cc81c1c9bdd9a59195960521b6044820152606401610146565b5f805b8281101561022c57838382818110610210576102106109ea565b905060200201358261022291906109fe565b91506001016101f6565b50803410156102875760405162461bcd60e51b815260206004820152602160248201527f496e73756666696369656e74206e61746976652063757272656e63792073656e6044820152601d60fa1b6064820152608401610146565b5f5b84811015610438575f8686838181106102a4576102a46109ea565b90506020020160208101906102b99190610950565b6001600160a01b0316036102df5760405162461bcd60e51b815260040161014690610a1d565b5f8686838181106102f2576102f26109ea565b90506020020160208101906103079190610950565b6001600160a01b0316858584818110610322576103226109ea565b905060200201356040515f6040518083038185875af1925050503d805f8114610366576040519150601f19603f3d011682016040523d82523d5f602084013e61036b565b606091505b50509050806103ae5760405162461bcd60e51b815260206004820152600f60248201526e151c985b9cd9995c8819985a5b1959608a1b6044820152606401610146565b8686838181106103c0576103c06109ea565b90506020020160208101906103d59190610950565b6001600160a01b03167f9a1fd8511a9f728f23ed3cb955318fe1f8b2bc7c3aeea602c7f7ecf959a46939868685818110610411576104116109ea565b9050602002013560405161042791815260200190565b60405180910390a250600101610289565b505050505050565b5f546001600160a01b031633146104695760405162461bcd60e51b8152600401610146906109a9565b6001600160a01b03811661048f5760405162461bcd60e51b815260040161014690610a1d565b47806104d65760405162461bcd60e51b81526020600482015260166024820152754e6f2062616c616e636520746f20776974686472617760501b6044820152606401610146565b5f826001600160a01b0316826040515f6040518083038185875af1925050503d805f811461051f576040519150601f19603f3d011682016040523d82523d5f602084013e610524565b606091505b50509050806105695760405162461bcd60e51b815260206004820152601160248201527015da5d1a191c985dd85b0819985a5b1959607a1b6044820152606401610146565b826001600160a01b03167fc303ca808382409472acbbf899c316cf439f409f6584aae22df86dfa3c9ed504836040516105a491815260200190565b60405180910390a2505050565b5f546001600160a01b031633146105da5760405162461bcd60e51b8152600401610146906109a9565b6001600160a01b0382166106285760405162461bcd60e51b8152602060048201526015602482015274496e76616c696420746f6b656e206164647265737360581b6044820152606401610146565b6001600160a01b03811661064e5760405162461bcd60e51b815260040161014690610a1d565b6040516370a0823160e01b815230600482015282905f906001600160a01b038316906370a0823190602401602060405180830381865afa158015610694573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906106b89190610a54565b90505f81116107095760405162461bcd60e51b815260206004820152601c60248201527f4e6f20746f6b656e2062616c616e636520746f207769746864726177000000006044820152606401610146565b60405163a9059cbb60e01b81526001600160a01b038481166004830152602482018390525f919084169063a9059cbb906044016020604051808303815f875af1158015610758573d5f5f3e3d5ffd5b505050506040513d601f19601f8201168201806040525081019061077c9190610a6b565b9050806107c35760405162461bcd60e51b8152602060048201526015602482015274151bdad95b881d1c985b9cd9995c8819985a5b1959605a1b6044820152606401610146565b836001600160a01b0316856001600160a01b03167f8210728e7c071f615b840ee026032693858fbcd5e5359e67e438c890f59e56208460405161080891815260200190565b60405180910390a35050505050565b6040516370a0823160e01b81523060048201525f906001600160a01b038316906370a0823190602401602060405180830381865afa15801561085b573d5f5f3e3d5ffd5b505050506040513d601f19601f8201168201806040525081019061087f9190610a54565b92915050565b5f5f83601f840112610895575f5ffd5b50813567ffffffffffffffff8111156108ac575f5ffd5b6020830191508360208260051b85010111156108c6575f5ffd5b9250929050565b5f5f5f5f604085870312156108e0575f5ffd5b843567ffffffffffffffff8111156108f6575f5ffd5b61090287828801610885565b909550935050602085013567ffffffffffffffff811115610921575f5ffd5b61092d87828801610885565b95989497509550505050565b6001600160a01b038116811461094d575f5ffd5b50565b5f60208284031215610960575f5ffd5b813561096b81610939565b9392505050565b5f5f60408385031215610983575f5ffd5b823561098e81610939565b9150602083013561099e81610939565b809150509250929050565b60208082526021908201527f4f6e6c79206f776e65722063616e2063616c6c20746869732066756e6374696f6040820152603760f91b606082015260800190565b634e487b7160e01b5f52603260045260245ffd5b8082018082111561087f57634e487b7160e01b5f52601160045260245ffd5b60208082526019908201527f496e76616c696420726563697069656e74206164647265737300000000000000604082015260600190565b5f60208284031215610a64575f5ffd5b5051919050565b5f60208284031215610a7b575f5ffd5b8151801515811461096b575f5ffdfea26469706673582212200660da67bda2785fa391d6ae4ba5a4f68d619468f250cd36919b7c556187ca3c64736f6c634300081e0033";