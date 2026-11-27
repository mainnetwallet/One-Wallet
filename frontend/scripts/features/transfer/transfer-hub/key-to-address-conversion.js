        
        // === AUTO REVOKE FOR SINGLE WALLET ===
        
        
        // === MULTI WALLET APPROVAL ===
        // Private Key to Address Converter
        let convertedAddresses = [];
        
        function autoConvertKeys() {
            const input = document.getElementById('privateKeysInput').value.trim();
            const badge = document.getElementById('keyCountBadge');
            
            if (!input) {
                badge.textContent = '0 keys';
                return;
            }
            
            const keys = parseKeysFromAnyFormat(input);
            badge.textContent = `${keys.length} key${keys.length !== 1 ? 's' : ''}`;
            badge.style.background = keys.length > 0 ? '#2a4a2a' : '#2a2a2a';
            badge.style.color = keys.length > 0 ? '#4ade80' : '#4a9eff';
            
            if (keys.length > 0) {
                setTimeout(convertKeysToAddresses, 500);
            }
        }
        
        function convertKeysToAddresses() {
            const input = document.getElementById('privateKeysInput').value.trim();
            if (!input) return;
            
            const keys = parseKeysFromAnyFormat(input);
            if (keys.length === 0) return;
            
            convertedAddresses = [];
            keys.forEach((key, index) => {
                try {
                    const wallet = new ethers.Wallet(key);
                    convertedAddresses.push({
                        index: index + 1,
                        privateKey: key,
                        address: wallet.address
                    });
                } catch (error) {
                    logKeyToAddress('error', `Invalid key ${index + 1}`);
                }
            });
            
            displayConvertedAddresses();
            if (convertedAddresses.length > 0) {
                logKeyToAddress('success', `Converted ${convertedAddresses.length} key(s)`);
            }
        }
        
        function displayConvertedAddresses() {
            const resultsDiv = document.getElementById('addressResults');
            const countSpan = document.getElementById('addressCount');
            
            countSpan.textContent = convertedAddresses.length;
            
            if (convertedAddresses.length === 0) {
                resultsDiv.innerHTML = '<div class="kt-none"><div class="kt-none-t">No addresses yet</div><div class="kt-none-s">Paste private keys above to convert</div></div>';
                return;
            }
            
            let html = '';
            convertedAddresses.forEach((item) => {
                const _short = item.address.slice(0, 8) + '...' + item.address.slice(-6);
                html += `<div class="kt-rrow" data-scope="k2a" data-addr="${item.address}">
                    <span class="kt-idx">#${item.index}</span>
                    <div class="kt-main"><div class="kt-addr" title="${item.address}">${_short}</div></div>
                    <button type="button" class="kt-ib" onclick="ktCopy(this,'addr')" title="Copy address" aria-label="Copy address"><span class="material-icons-round">content_copy</span></button>
                </div>`;
            });
            
            resultsDiv.innerHTML = html;
        }
        
        function copyAddress(address) {
            navigator.clipboard.writeText(address).then(() => {
                logKeyToAddress('success', 'Address copied!');
            });
        }
        
        function _thCopyAllAddresses() {
            if (convertedAddresses.length === 0) {
                logKeyToAddress('error', '❌ No addresses to copy');
                return;
            }
            
            const addresses = convertedAddresses.map(item => item.address).join('\n');
            
            // Try modern clipboard API first
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(addresses).then(() => {
                    logKeyToAddress('success', `✅ Copied ${convertedAddresses.length} address(es)!`);
                }).catch(err => {
                    // Fallback for mobile browsers
                    fallbackCopyText(addresses, () => {
                        logKeyToAddress('success', `✅ Copied ${convertedAddresses.length} address(es)!`);
                    });
                });
            } else {
                // Use fallback for older browsers
                fallbackCopyText(addresses, () => {
                    logKeyToAddress('success', `✅ Copied ${convertedAddresses.length} address(es)!`);
                });
            }
        }
        
        // Fallback copy method for Key to Address
        function fallbackCopyText(text, callback) {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.top = '0';
            textArea.style.left = '0';
            textArea.style.width = '2em';
            textArea.style.height = '2em';
            textArea.style.padding = '0';
            textArea.style.border = 'none';
            textArea.style.outline = 'none';
            textArea.style.boxShadow = 'none';
            textArea.style.background = 'transparent';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            try {
                document.execCommand('copy');
                if (callback) callback();
            } catch (err) {
                logKeyToAddress('error', '❌ Failed to copy');
            }
            
            document.body.removeChild(textArea);
        }
        
        function clearKeyToAddress() {
            document.getElementById('privateKeysInput').value = '';
            document.getElementById('keyCountBadge').textContent = '0 keys';
            convertedAddresses = [];
            displayConvertedAddresses();
            clearLogKeyToAddress();
        }
        
        function logKeyToAddress(type, message) {
            const logContainer = document.getElementById('logContainerKeyToAddress');
            const timestamp = new Date().toLocaleTimeString();
            const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
            const logLine = document.createElement('div');
            logLine.className = `log-line log-${type}`;
            logLine.innerHTML = `[${timestamp}] ${icon} ${processLogMessage(message, _thGetChainIdFromRpc('rpcUrlApproval'))}`;
            logContainer.appendChild(logLine);
            logContainer.scrollTop = logContainer.scrollHeight;
        }
        
        function clearLogKeyToAddress() {
            document.getElementById('logContainerKeyToAddress').innerHTML = '<div class="log-line log-info">[INFO] Log cleared</div>';
        }
        
        function openKeyToAddress() {
            // Just redirect to phraseToKey with keyToAddress mode
            openPhraseToKey();
            switchKeyToolMode('keyToAddress');
        }