        // Update preview
        function updatePreview() {
            const senderKeys = document.getElementById('w2wSenderKeys').value
                .split('\n')
                .filter(k => k.trim().length > 0);
            const receiverKeys = document.getElementById('w2wReceiverKeys').value
                .split('\n')
                .filter(k => k.trim().length > 0);
            
            if (senderKeys.length === 0 || receiverKeys.length === 0) {
                safeHideElement('w2wPreviewSection');
                return;
            }
            
            const pairCount = Math.min(senderKeys.length, receiverKeys.length);
            const previewList = document.getElementById('w2wPreviewList');
            
            let html = '';
            for (let i = 0; i < Math.min(5, pairCount); i++) {
                try {
                    const senderWallet = new ethers.Wallet(cleanPrivateKey(senderKeys[i]));
                    const receiverAddr = getReceiverAddress(receiverKeys[i]);
                    
                    html += `
                        <div style="background: #1a1a1a; border-left: 3px solid #4a9eff; padding: 10px 12px; border-radius: 6px; display: flex; align-items: center; gap: 12px;">
                            <div style="color: #888; font-size: 0.75rem; min-width: 20px;">#${i + 1}</div>
                            <div style="flex: 1; font-family: monospace; font-size: 0.75rem; color: #4a9eff;">${senderWallet.address.substring(0, 8)}...${senderWallet.address.substring(38)}</div>
                            <div style="color: #888; font-size: 1rem;">→</div>
                            <div style="flex: 1; font-family: monospace; font-size: 0.75rem; color: #10b981;">${receiverAddr.substring(0, 8)}...${receiverAddr.substring(38)}</div>
                            <div style="color: #ffa500; font-size: 0.7rem; white-space: nowrap;">${w2wAmountMode === 'full' ? '💯' : '🎯'}</div>
                        </div>
                    `;
                } catch (error) {
                }
            }
            
            if (pairCount > 5) {
                html += `<div style="text-align: center; color: #666; font-size: 0.8rem; padding: 8px;">+ ${pairCount - 5} more</div>`;
            }
            
            previewList.innerHTML = html;
            safeShowElement('w2wPreviewSection');
        }
        
        // Helper: Clean private key
        function cleanPrivateKey(key) {
            let cleaned = key
                .replace(/\./g, '')
                .replace(/\s/g, '')
                .replace(/[^0-9a-fA-Fx]/g, '');
            
            if (!cleaned.startsWith('0x')) {
                cleaned = '0x' + cleaned;
            }
            
            return cleaned.replace(/^0x0x/, '0x');
        }
        
        // Helper: Get receiver address
        function getReceiverAddress(input) {
            input = input.trim();
            
            // If already address
            if (input.startsWith('0x') && input.length === 42) {
                return input;
            }
            
            // Convert from private key
            try {
                const wallet = new ethers.Wallet(cleanPrivateKey(input));
                return wallet.address;
            } catch (error) {
                return input; // Return as-is if conversion fails
            }
        }
        
        // Logging function
        // type: 'info' | 'success' | 'warning' | 'error'
        // message: plain text (will be processed by processLogMessage) OR pre-built HTML
        // isHtml: pass true when message already contains HTML (e.g. createExplorerLink output)
        function logW2W(type, message, isHtml) {
            if (!_isUIVisible('walletToWalletUI')) return;
            const logSection = document.getElementById('logSectionW2W');
            if (!logSection) return;
            
            const timestamp = new Date().toLocaleTimeString();
            const logClass = `log-${type}`;
            const logLine = document.createElement('div');
            logLine.className = `log-line ${logClass}`;
            logLine.innerHTML = `[${timestamp}] ${isHtml ? message : processLogMessage(message, _thGetChainIdFromRpc('rpcUrlW2W'))}`;
            
            logSection.appendChild(logLine);
            logSection.scrollTop = logSection.scrollHeight;
        }
        
        // Clear W2W logs
        function clearLogW2W() {
            const logSection = document.getElementById('logSectionW2W');
            if (!logSection) return;
            
            logSection.innerHTML = '<div class="log-line log-info">[INFO] Log cleared</div>';
        }
