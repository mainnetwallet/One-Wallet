        
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
                resultsDiv.innerHTML = '<div style="text-align: center; color: #808080; padding: 60px 20px;"><div style="font-size: 3rem;">🔐</div><div style="font-size: 1.1rem; font-weight: 600;">No addresses yet</div></div>';
                return;
            }
            
            let html = '';
            convertedAddresses.forEach((item) => {
                html += `<div style="background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 10px; padding: 15px; margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                        <div style="color: #4a9eff; font-weight: 700;">Wallet #${item.index}</div>
                        <button onclick="copyAddress('${item.address}')" style="background: #2a2a2a; border: 1px solid #3a3a3a; color: #4a9eff; padding: 4px 12px; border-radius: 6px; cursor: pointer;">📋 Copy</button>
                    </div>
                    <div style="background: #0a0a0a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 12px; margin-bottom: 8px;">
                        <div style="font-size: 0.7rem; color: #888; margin-bottom: 4px;">ADDRESS</div>
                        <div style="font-family: monospace; font-size: 0.85rem; color: #4ade80; word-break: break-all;">${item.address}</div>
                    </div>
                    <div style="background: #0a0a0a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 12px;">
                        <div style="font-size: 0.7rem; color: #888; margin-bottom: 4px;">PRIVATE KEY</div>
                        <div style="font-family: monospace; font-size: 0.75rem; color: #ffa500; word-break: break-all;">${item.privateKey.substring(0, 20)}...${item.privateKey.substring(item.privateKey.length - 20)}</div>
                    </div>
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