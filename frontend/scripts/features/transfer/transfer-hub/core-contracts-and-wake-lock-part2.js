
        // ========================================
        // GLOBAL CONTRACT BYTECODES - v3.0
        // ========================================
        
        // Token Transfer Contract Bytecode - For Multi Key Recipients
        const TOKEN_TRANSFER_CONTRACT_BYTECODE = "0x6080604052348015600e575f5ffd5b505f80546001600160a01b031916331790556107f88061002d5f395ff3fe608060405260043610610041575f3560e01c80630cb8cb0d1461004c5780632f622e6b1461006d5780633aeac4e11461008c5780638da5cb5b146100ab575f5ffd5b3661004857005b5f5ffd5b348015610057575f5ffd5b5061006b610066366004610626565b6100e5565b005b348015610078575f5ffd5b5061006b6100873660046106a8565b610334565b348015610097575f5ffd5b5061006b6100a63660046106ca565b610438565b3480156100b6575f5ffd5b505f546100c9906001600160a01b031681565b6040516001600160a01b03909116815260200160405180910390f35b5f546001600160a01b031633146101175760405162461bcd60e51b815260040161010e90610701565b60405180910390fd5b8281146101585760405162461bcd60e51b815260206004820152600f60248201526e098cadccee8d040dad2e6dac2e8c6d608b1b604482015260640161010e565b826101945760405162461bcd60e51b815260206004820152600c60248201526b456d7074792061727261797360a01b604482015260640161010e565b845f5b8481101561032b575f8686838181106101b2576101b2610724565b90506020020160208101906101c791906106a8565b6001600160a01b0316036101ed5760405162461bcd60e51b815260040161010e90610738565b5f84848381811061020057610200610724565b90506020020135116102455760405162461bcd60e51b815260206004820152600e60248201526d125b9d985b1a5908185b5bdd5b9d60921b604482015260640161010e565b5f826001600160a01b031663a9059cbb88888581811061026757610267610724565b905060200201602081019061027c91906106a8565b87878681811061028e5761028e610724565b6040516001600160e01b031960e087901b1681526001600160a01b03909416600485015260200291909101356024830152506044016020604051808303815f875af11580156102df573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906103039190610763565b9050806103225760405162461bcd60e51b815260040161010e90610782565b50600101610197565b50505050505050565b5f546001600160a01b0316331461035d5760405162461bcd60e51b815260040161010e90610701565b6001600160a01b0381166103835760405162461bcd60e51b815260040161010e90610738565b47806103c45760405162461bcd60e51b815260206004820152601060248201526f4e6f206e617469766520746f6b656e7360801b604482015260640161010e565b5f826001600160a01b0316826040515f6040518083038185875af1925050503d805f811461040d576040519150601f19603f3d011682016040523d82523d5f602084013e610412565b606091505b50509050806104335760405162461bcd60e51b815260040161010e90610782565b505050565b5f546001600160a01b031633146104615760405162461bcd60e51b815260040161010e90610701565b6001600160a01b0381166104875760405162461bcd60e51b815260040161010e90610738565b6040516370a0823160e01b815230600482015282905f906001600160a01b038316906370a0823190602401602060405180830381865afa1580156104cd573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906104f191906107ab565b90505f811161052e5760405162461bcd60e51b81526020600482015260096024820152684e6f20746f6b656e7360b81b604482015260640161010e565b60405163a9059cbb60e01b81526001600160a01b038481166004830152602482018390525f919084169063a9059cbb906044016020604051808303815f875af115801561057d573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906105a19190610763565b9050806105c05760405162461bcd60e51b815260040161010e90610782565b5050505050565b6001600160a01b03811681146105db575f5ffd5b50565b5f5f83601f8401126105ee575f5ffd5b50813567ffffffffffffffff811115610605575f5ffd5b6020830191508360208260051b850101111561061f575f5ffd5b9250929050565b5f5f5f5f5f6060868803121561063a575f5ffd5b8535610645816105c7565b9450602086013567ffffffffffffffff811115610660575f5ffd5b61066c888289016105de565b909550935050604086013567ffffffffffffffff81111561068b575f5ffd5b610697888289016105de565b969995985093965092949392505050565b5f602082840312156106b8575f5ffd5b81356106c3816105c7565b9392505050565b5f5f604083850312156106db575f5ffd5b82356106e6816105c7565b915060208301356106f6816105c7565b809150509250929050565b6020808252600990820152682737ba1037bbb732b960b91b604082015260600190565b634e487b7160e01b5f52603260045260245ffd5b602080825260119082015270125b9d985b1a59081c9958da5c1a595b9d607a1b604082015260600190565b5f60208284031215610773575f5ffd5b815180151581146106c3575f5ffd5b6020808252600f908201526e151c985b9cd9995c8819985a5b1959608a1b604082015260600190565b5f602082840312156107bb575f5ffd5b505191905056fea26469706673582212203f6712ef1ff186b31b58827e0d9c9e16c27ceb4de15e48b6065fbfc570facc8c64736f6c634300081e0033";
        
        // Native Transfer Contract Bytecode - For Multi Key Recipients
        // SIMPLE PASSTHROUGH CONTRACT - No owner restriction
        // Anyone can call and send ETH through contract to recipient
        // Contract: function sendTo(address payable recipient) external payable
        const TRANSFER_CONTRACT_BYTECODE = "0x6080604052348015600e575f5ffd5b505f80546001600160a01b031916331790556109bf8061002d5f395ff3fe608060405260043610610041575f3560e01c80632f622e6b1461004c5780633aeac4e11461006d5780634bf842fd1461008c5780638da5cb5b1461009f575f5ffd5b3661004857005b5f5ffd5b348015610057575f5ffd5b5061006b6100663660046107e7565b6100d9565b005b348015610078575f5ffd5b5061006b610087366004610809565b610253565b61006b61009a366004610840565b610554565b3480156100aa575f5ffd5b505f546100bd906001600160a01b031681565b6040516001600160a01b03909116815260200160405180910390f35b5f546001600160a01b0316331461010b5760405162461bcd60e51b8152600401610102906108b1565b60405180910390fd5b6001600160a01b0381166101315760405162461bcd60e51b8152600401610102906108f2565b47806101785760405162461bcd60e51b81526020600482015260166024820152754e6f2062616c616e636520746f20776974686472617760501b6044820152606401610102565b5f826001600160a01b0316826040515f6040518083038185875af1925050503d805f81146101c1576040519150601f19603f3d011682016040523d82523d5f602084013e6101c6565b606091505b505090508061020b5760405162461bcd60e51b815260206004820152601160248201527015da5d1a191c985dd85b0819985a5b1959607a1b6044820152606401610102565b826001600160a01b03167fc303ca808382409472acbbf899c316cf439f409f6584aae22df86dfa3c9ed5048360405161024691815260200190565b60405180910390a2505050565b5f546001600160a01b0316331461027c5760405162461bcd60e51b8152600401610102906108b1565b6001600160a01b0382166102ca5760405162461bcd60e51b8152602060048201526015602482015274496e76616c696420746f6b656e206164647265737360581b6044820152606401610102565b6001600160a01b0381166102f05760405162461bcd60e51b8152600401610102906108f2565b6040513060248201525f9081906001600160a01b0385169060440160408051601f198184030181529181526020820180516001600160e01b03166370a0823160e01b179052516103409190610929565b5f604051808303815f865af19150503d805f8114610379576040519150601f19603f3d011682016040523d82523d5f602084013e61037e565b606091505b5091509150816103c75760405162461bcd60e51b815260206004820152601460248201527310985b185b98d94818da1958dac819985a5b195960621b6044820152606401610102565b5f818060200190518101906103dc919061093f565b90505f81116104205760405162461bcd60e51b815260206004820152601060248201526f4e6f20746f6b656e2062616c616e636560801b6044820152606401610102565b6040516001600160a01b038581166024830152604482018390525f919087169060640160408051601f198184030181529181526020820180516001600160e01b031663a9059cbb60e01b179052516104789190610929565b5f604051808303815f865af19150503d805f81146104b1576040519150601f19603f3d011682016040523d82523d5f602084013e6104b6565b606091505b50509050806104ff5760405162461bcd60e51b8152602060048201526015602482015274151bdad95b881d1c985b9cd9995c8819985a5b1959605a1b6044820152606401610102565b846001600160a01b0316866001600160a01b03167f8210728e7c071f615b840ee026032693858fbcd5e5359e67e438c890f59e56208460405161054491815260200190565b60405180910390a3505050505050565b8061059a5760405162461bcd60e51b8152602060048201526016602482015275139bc81c9958da5c1a595b9d1cc81c1c9bdd9a59195960521b6044820152606401610102565b5f34116105d95760405162461bcd60e51b815260206004820152600d60248201526c139bc81d985b1d59481cd95b9d609a1b6044820152606401610102565b5f6105e48234610956565b90505f81116106495760405162461bcd60e51b815260206004820152602b60248201527f416d6f756e742070657220726563697069656e74206d7573742062652067726560448201526a061746572207468616e20360ac1b6064820152608401610102565b5f5b828110156107ca575f84848381811061066657610666610975565b905060200201602081019061067b91906107e7565b6001600160a01b0316036106a15760405162461bcd60e51b8152600401610102906108f2565b5f8484838181106106b4576106b4610975565b90506020020160208101906106c991906107e7565b6001600160a01b0316836040515f6040518083038185875af1925050503d805f8114610710576040519150601f19603f3d011682016040523d82523d5f602084013e610715565b606091505b50509050806107585760405162461bcd60e51b815260206004820152600f60248201526e151c985b9cd9995c8819985a5b1959608a1b6044820152606401610102565b84848381811061076a5761076a610975565b905060200201602081019061077f91906107e7565b6001600160a01b03167f8aa89c45e00b1dc8befa3736e4d341042a1cd0021a629920526985a6028f7525846040516107b991815260200190565b60405180910390a25060010161064b565b50505050565b6001600160a01b03811681146107e4575f5ffd5b50565b5f602082840312156107f7575f5ffd5b8135610802816107d0565b9392505050565b5f5f6040838503121561081a575f5ffd5b8235610825816107d0565b91506020830135610835816107d0565b809150509250929050565b5f5f60208385031215610851575f5ffd5b823567ffffffffffffffff811115610867575f5ffd5b8301601f81018513610877575f5ffd5b803567ffffffffffffffff81111561088d575f5ffd5b8560208260051b84010111156108a1575f5ffd5b6020919091019590945092505050565b60208082526021908201527f4f6e6c79206f776e65722063616e2063616c6c20746869732066756e6374696f6040820152603760f91b606082015260800190565b60208082526019908201527f496e76616c696420726563697069656e74206164647265737300000000000000604082015260600190565b5f82518060208501845e5f920191825250919050565b5f6020828403121561094f575f5ffd5b5051919050565b5f8261097057634e487b7160e01b5f52601260045260245ffd5b500490565b634e487b7160e01b5f52603260045260245ffdfea2646970667358221220eaecc71e86adc8c3222fe3e8225feecb244f10e96f0e4ff249865729247a110f64736f6c634300081e0033";

        // Solidity Source Code (same as before)
        const SOLIDITY_SOURCE = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract BatchTransfer {
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    function Transfer(address[] calldata recipients, uint256 amount) external payable onlyOwner {
        require(recipients.length > 0, "EMPTY_RECIPIENTS");
        require(msg.value == recipients.length * amount, "INSUFFICIENT_VALUE");

        for (uint256 i = 0; i < recipients.length; i++) {
            (bool success, ) = recipients[i].call{value: amount}("");
            require(success, "SEND_FAIL");
        }
    }

    function withdrawNative(address receiver) external onlyOwner {
        require(receiver != address(0), "INVALID_RECEIVER");
        (bool success, ) = receiver.call{value: address(this).balance}("");
        require(success, "WITHDRAW_FAIL");
    }

    function withdrawToken(address token, address receiver) external onlyOwner {
        require(token != address(0) && receiver != address(0), "INVALID_ADDRESS");
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSignature("transfer(address,uint256)", receiver, type(uint256).max)
        );
        require(success, "TOKEN_TRANSFER_FAIL");
    }

    receive() external payable {}
}`;

        // Chain arrays for dropdown selection — populated in DOMContentLoaded
        const mainnetChains = [];

        const testnetChains = [];

        // Populate mainnetChains/testnetChains from getAllTHChains once DOM is ready
        function _populateChainArrays() {
            try {
                if (typeof getAllTHChains !== 'function') return;
                var _all = getAllTHChains();
                // testnet heuristic: name/id matching common testnet patterns
                var _testnetIds = new Set([11155111,17000,11155420,421614,80002,97,43113,4002,534351,84532]);
                var _testnetWords = ['testnet','sepolia','goerli','mumbai','fuji','holesky','amoy'];
                _all.forEach(function(c) {
                    var _isTest = _testnetIds.has(c.chainId) ||
                        _testnetWords.some(function(w){ return c.name.toLowerCase().includes(w); });
                    if (_isTest) {
                        if (!testnetChains.find(function(x){ return x.chainId === c.chainId; }))
                            testnetChains.push(c);
                    } else {
                        if (!mainnetChains.find(function(x){ return x.chainId === c.chainId; }))
                            mainnetChains.push(c);
                    }
                });
            } catch(_) {}
        }

        // Initialize on page load - Use DOMContentLoaded for faster rendering
        document.addEventListener('DOMContentLoaded', async () => {
            // Set initial history state for back button support
            // If a sub-section was saved, push a new history entry AFTER the dashboard base state
            // so that pressing back always returns to dashboard instead of exiting the app
            const savedSection = localStorage.getItem('transferHub_currentSection');
            if (savedSection && savedSection !== 'dashboard') {
                }
            
            // ── CRITICAL ORDER FIX ──
            // Populate chain arrays FIRST so section open-functions can call getAllTHChains()
            _populateChainArrays();
            
            // Load saved data/contracts before restoring section
            compileContract();
            loadSavedData();
            loadSavedContracts();
            if (typeof checkDeployReady === 'function') checkDeployReady();

            // Use Home section active chain as default (fallback: Base)
            const _hcId0 = (typeof activeHomeChainId !== 'undefined' && activeHomeChainId !== null) ? activeHomeChainId : null;
            const _defChain0 = (_hcId0 ? getAllTHChains().find(c => c.chainId === _hcId0) : null) || getAllTHChains().find(c => c.chainId === 8453) || getAllTHChains().find(c => c.name === 'Base') || getAllTHChains()[0];
            const ethChain = _defChain0;
            if (ethChain) {
                currentChainConfig = {
                    name: ethChain.name,
                    chainId: ethChain.chainId,
                    symbol: ethChain.symbol,
                    rpcs: (Array.isArray(ethChain.rpcs) && ethChain.rpcs.length) ? ethChain.rpcs : [ethChain.rpc].filter(Boolean),
                    explorer: ethChain.explorer || ''
                };
                // Sync data-chainid on rpcUrl input immediately
                var _rEl0 = document.getElementById('rpcUrl');
                if (_rEl0) { _rEl0.setAttribute('data-chainid', ethChain.chainId || ''); }
            }
            await initializeProvider();
            
            setupChainSearch();

            // Now restore the last-opened section (chains are ready)
            restoreLastSection();
            
            // Hide loading screen after section is restored
            setTimeout(() => {
                const loadingScreen = document.getElementById('loadingScreen');
                if (loadingScreen) {
                    loadingScreen.classList.add('hidden');
                }
            }, 100);
            
        });
        
        // Function to restore the last opened section
        function restoreLastSection() {
            try {
                var _savedSection = localStorage.getItem('transferHub_currentSection') || 'dashboard';
                var _sectionFnMap = {
                    'dashboard':            openDashboard,
                    'batchTransfer':        openBatchTransfer,
                    'withdraw':             openWithdraw,
                    'multiKeyNative':       openMultiKeyNative,
                    'nftTransfer':          openNftTransfer,
                    'phraseToKey':          openPhraseToKey,
                    'selfTransfer':         openSelfTransfer,
                    'balanceCheck':         openBalanceCheck,
                    'tokenApprovalManager': openTokenApprovalManager,
                    'walletToWallet':       openWalletToWallet,
                };
                var _fn = _sectionFnMap[_savedSection];
                if (typeof _fn === 'function') { _fn(); } else { openDashboard(); }
            } catch (error) {
                try { openDashboard(); } catch (e) {}
            }
        }
        
        // Initialize chain grid for Batch Transfer Native
        function initChainGrid() {
            const chainGrid = document.getElementById('chainGrid');
            const chainSearch = document.getElementById('chainSearch');
            if (!chainGrid) return;
            
            // ── FIX: restore saved chain per section, not always Base ──
            let selectedChain = (typeof getTHSectionChain === 'function')
                ? getTHSectionChain('batchNative')
                : (getAllTHChains().find(c => c.chainId === 8453) || getAllTHChains().find(c => c.name === 'Base') || getAllTHChains()[0]);
            
            // Set default RPC (full list)
            const rpcInput = document.getElementById('rpcUrl');
            if (rpcInput) {
                const _rpcs = (typeof _getRpcListForChain === 'function' && selectedChain.chainId) ? _getRpcListForChain(selectedChain.chainId) : (selectedChain.rpcs || (selectedChain.rpc ? [selectedChain.rpc] : []));
                rpcInput.value = (_rpcs[0] || selectedChain.rpc || '');
                rpcInput.setAttribute('data-rpcs', JSON.stringify(_rpcs));
                if (selectedChain.chainId) rpcInput.setAttribute('data-chainid', String(selectedChain.chainId));
            }
            
            // Build full chain list (hidden by default)
            function buildChainList() {
                let html = '<div class="chain-section-header">MAINNETS</div>';
                
                getAllTHChains().forEach(chain => {
                    const isActive = chain.name === selectedChain.name ? 'active' : '';
                    const safeName = chain.name.replace(/'/g, "\\'").replace(/"/g, '\\"');
                    const safeRpc = chain.rpc.replace(/'/g, "\\'").replace(/"/g, '\\"');
                    const safeSymbol = chain.symbol.replace(/'/g, "\\'").replace(/"/g, '\\"');
                    html += `<div class="chain-item ${isActive}" onclick="selectChain('${safeName}', '${safeRpc}', '${safeSymbol}')">
                        <span class="chain-name">${chain.name}</span>
                        <span class="chain-symbol">${chain.symbol}</span>
                    </div>`;
                });
                
                if (testnetChains && testnetChains.length > 0) {
                html += '<div class="chain-section-header">TESTNETS</div>';
                }
                if (testnetChains && testnetChains.length > 0) {
                testnetChains.forEach(chain => {
                    const isActive = chain.name === selectedChain.name ? 'active' : '';
                    const safeName = chain.name.replace(/'/g, "\\'").replace(/"/g, '\\"');
                    const safeRpc = chain.rpc.replace(/'/g, "\\'").replace(/"/g, '\\"');
                    const safeSymbol = chain.symbol.replace(/'/g, "\\'").replace(/"/g, '\\"');
                    html += `<div class="chain-item ${isActive}" onclick="selectChain('${safeName}', '${safeRpc}', '${safeSymbol}')">
                        <span class="chain-name">${chain.name}</span>
                        <span class="chain-symbol">${chain.symbol}</span>
                    </div>`;
                });
                }
                
                return html;
            }
            
            // Show selected chain only
            function showSelectedOnly() {
                chainGrid.innerHTML = '';
                chainGrid.style.maxHeight = 'none';
                chainGrid.style.overflow = 'visible';
                chainGrid.style.border = 'none';
                chainGrid.style.background = 'transparent';
                
                const display = document.createElement('div');
                display.className = 'selected-chain-display';
                display.onclick = toggleChainList;
                display.innerHTML = `
                    <div>
                        <span class="chain-name">${selectedChain.name}</span>
                        <span class="chain-symbol">${selectedChain.symbol}</span>
                    </div>
                    <span class="expand-hint">▼ Click to change</span>
                `;
                chainGrid.appendChild(display);
                
                if (chainSearch) chainSearch.style.display = 'none';
            }
            
            // Show all chains
            function showAllChains() {
                chainGrid.innerHTML = buildChainList();
                chainGrid.style.maxHeight = '250px';
                chainGrid.style.overflow = 'auto';
                chainGrid.style.border = '1px solid #2a2a2a';
                chainGrid.style.background = '#0f0f0f';
                
                if (chainSearch) {
                    chainSearch.style.display = 'block';
                    chainSearch.value = '';
                }
            }
            
            // Toggle between selected and all chains
            window.toggleChainList = function() {
                if (chainGrid.querySelector('.selected-chain-display')) {
                    showAllChains();
                }
            };
            
            // Update selectChain to save selection and collapse
            window.selectChain = function(name, rpc, symbol) {
                selectedChain = { name, rpc, symbol };
                document.getElementById('rpcUrl').value = rpc;
                
                // Find full chain config to get chainId and explorer
                const fullChain = getAllTHChains().find(c => c.name === name) || 
                                  (testnetChains || []).find(c => c.name === name);
                
                // Fully update currentChainConfig (not just rpcs)
                currentChainConfig = {
                    name: name,
                    chainId: fullChain?.chainId || currentChainConfig?.chainId || 1,
                    symbol: symbol,
                    rpcs: [rpc],
                    explorer: fullChain?.explorer || currentChainConfig?.explorer || ''
                };
                
                // Sync data-chainid on rpcUrl input so processLogMessage uses correct explorer
                const _rEl = document.getElementById('rpcUrl');
                if (_rEl) { _rEl.setAttribute('data-chainid', currentChainConfig.chainId || ''); }

                // ── BUG FIX: Persist selected chain so it survives page reopen ──
                try {
                    if (currentChainConfig.chainId) {
                        localStorage.setItem('transferHub_chain_batchNative', String(currentChainConfig.chainId));
                    }
                } catch(_) {}
                
                // Trigger RPC provider re-init so the new chain is active immediately
                if (typeof updateRpcProvider === 'function') updateRpcProvider();
                
                // Update Saved Contracts list to show only current chain's contracts
                renderSavedContracts();
                
                // Auto-load saved contract for this chain if exists
                const chainContract = savedContracts.find(c => c.chainId === (fullChain?.chainId || currentChainConfig?.chainId));
                if (chainContract) {
                    loadContract(chainContract.address, chainContract.chainId);
                }
                
                showSelectedOnly();
            };
            
            // Search functionality
            if (chainSearch) {
                chainSearch.addEventListener('input', function() {
                    const searchTerm = this.value.toLowerCase();
                    const items = chainGrid.querySelectorAll('.chain-item');
                    items.forEach(item => {
                        const text = item.textContent.toLowerCase();
                        item.style.display = text.includes(searchTerm) ? 'flex' : 'none';
                    });
                });
            }
            
            // Initialize with selected chain only
            showSelectedOnly();
        }
        
        // Contract Management Functions
        function loadSavedContracts() {
            const saved = localStorage.getItem('batchTransferContracts');
            if (saved) {
                try {
                    savedContracts = JSON.parse(saved);
                    // Always start deselected on page/HTML open
                    savedContracts.forEach(c => c.isActive = false);
                    localStorage.setItem('batchTransferContracts', JSON.stringify(savedContracts));
                    renderSavedContracts();
                } catch (e) {
                    savedContracts = [];
                }
            }
        }

        function saveContract(address, chainName, chainId, chainSymbol, ownerAddress) {
            const existing = savedContracts.findIndex(c => 
                c.address.toLowerCase() === address.toLowerCase() && c.chainId === chainId
            );
            
            // Mark all as inactive
            savedContracts.forEach(c => c.isActive = false);
            
            const rpcUrl = document.getElementById('rpcUrl').value.trim();
            const _thRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('rpcUrl') : (rpcUrl ? [rpcUrl] : []);
            const _thChainId = parseInt((document.getElementById('rpcUrl')||{}).getAttribute?.('data-chainid')||'',10)||null;
            
            const contractData = {
                address: address,
                chainName: chainName,
                chainId: chainId,
                chainSymbol: chainSymbol,
                deployedAt: new Date().toISOString(),
                isActive: true,
                rpcUrl: rpcUrl,
                ownerAddress: ownerAddress || ''
            };
            
            if (existing >= 0) {
                savedContracts[existing] = contractData;
            } else {
                savedContracts.unshift(contractData);
            }
            
            // Keep only last 10 contracts
            if (savedContracts.length > 10) {
                savedContracts = savedContracts.slice(0, 10);
            }
            
            localStorage.setItem('batchTransferContracts', JSON.stringify(savedContracts));
            
            // ALSO ADD TO CENTRAL STORAGE FOR WITHDRAW MANAGER
            addToCentralContracts({
                ...contractData,
                type: 'native',
                section: 'Batch Transfer Native',
                symbol: chainSymbol
            });
            
            renderSavedContracts();
            
        }

        async function loadContract(address, chainId, silentVerify) {
            activeContractAddress = address;
            if (typeof checkDeployReady === 'function') checkDeployReady();
            
            // Match by address AND chainId when provided — prevents wrong contract getting isActive:true
            const _lc_cid = chainId || currentChainConfig?.chainId || null;
            const contract = savedContracts.find(c =>
                c.address.toLowerCase() === address.toLowerCase() &&
                (_lc_cid ? c.chainId === _lc_cid : true)
            );
            
            if (contract) {
                // Mark as active
                savedContracts.forEach(c => c.isActive = false);
                contract.isActive = true;
                localStorage.setItem('batchTransferContracts', JSON.stringify(savedContracts));
                
                // Update UI with clickable address
                const explorerUrl = getTHExplorerFromConfig(currentChainConfig);
                const _ci = document.getElementById('currentContractInfo');
                if (_ci) _ci.classList.add('active');
                
                const addressElement = document.getElementById('currentContractAddress');
                const shortAddress = address.substring(0, 10) + '...' + address.substring(address.length - 8);
                if (addressElement) addressElement.innerHTML = `<a href="${explorerUrl}/address/${address}" target="_blank" rel="noopener noreferrer" class="log-link" title="View on block explorer">${shortAddress}</a>`;
                
                const _cc = document.getElementById('currentContractChain');
                if (_cc) _cc.textContent = contract.chainName;
                const _cd = document.getElementById('currentContractDate');
                if (_cd) _cd.textContent = new Date(contract.deployedAt).toLocaleString();
                
                renderSavedContracts();
                
                                
                // Verify contract functions if RPC URL is available
                if (contract.rpcUrl) {
                    try {
                                                const _vcChainId = contract.chainId || null;
                        const _vcRpcs = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList('rpcUrl') : [];
                        if (contract.rpcUrl && !_vcRpcs.includes(contract.rpcUrl)) _vcRpcs.unshift(contract.rpcUrl);
                        // FIX: use thWithFallback instead of single URL
                        let provider;
                        try {
                          provider = await window.thWithFallback('rpcUrl', async function(_p) {
                            await Promise.race([_p.getBlockNumber(), new Promise((_,r)=>setTimeout(()=>r(new Error('probe timeout')),5000))]);
                            return _p;
                          }, 5000);
                        } catch(_thErr) {
                          provider = window._thMakeProvider(contract.rpcUrl || rpcUrl, _vcChainId);
                        }
                        const functionExists = await verifyContractFunction(address, provider);
                        
                        if (functionExists) {
                            if (!silentVerify) logMessage('success', '✅ Contract functions verified!');
                            if (typeof checkDeployReady === 'function') checkDeployReady();
                                                    } else {
                            logMessage('error', '❌ executeTransfer function পাওয়া যায়নি - contract ব্যবহার করা যাবে না');
                            document.getElementById('executeBtn').disabled = true;
                        }
                    } catch (error) {
                        logMessage('warning', '⚠️ Could not verify contract - RPC connection failed');
                                                    if (typeof checkDeployReady === 'function') checkDeployReady();
                    }
                } else {
                    // No RPC URL available, enable button anyway
                            if (typeof checkDeployReady === 'function') checkDeployReady();
                                    }
            }
        }

        function deleteContract(address, chainId) {
            if (!confirm('Are you sure you want to delete this contract?')) {
                return;
            }
            
            savedContracts = savedContracts.filter(c => 
                !(c.address.toLowerCase() === address.toLowerCase() && c.chainId === chainId)
            );
            
            localStorage.setItem('batchTransferContracts', JSON.stringify(savedContracts));
            
            if (activeContractAddress?.toLowerCase() === address.toLowerCase()) {
                activeContractAddress = null;
                const _ciR = document.getElementById('currentContractInfo'); if (_ciR) _ciR.classList.remove('active');
                document.getElementById('executeBtn').disabled = true;
            }
            
            renderSavedContracts();
                    }

        function clearAllContracts() {
            if (savedContracts.length === 0) {
                return;
            }
            
            const contractCount = savedContracts.length;
            
            if (!confirm(`Are you sure you want to delete all ${contractCount} saved contract(s)?\n\nThis action cannot be undone.`)) {
                return;
            }
            
            // Clear all contracts
            savedContracts = [];
            localStorage.setItem('batchTransferContracts', JSON.stringify(savedContracts));
            
            // Reset active contract
            activeContractAddress = null;
            const _ciR = document.getElementById('currentContractInfo'); if (_ciR) _ciR.classList.remove('active');
            document.getElementById('executeBtn').disabled = true;
            
            // Update UI
            renderSavedContracts();
            
                    }
