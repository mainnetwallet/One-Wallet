        // Toggle Multi Key Token Submenu
        // Removed toggleMultiKeyTokenSubmenu - no longer needed with simple header
        /*
        function toggleMultiKeyTokenSubmenu() {
            const submenu = document.getElementById('multiKeyTokenSubmenu');
            if (submenu) {
                submenu.classList.toggle('active');
            } else {
            }
        }

        // Close submenu when clicking outside
        document.addEventListener('click', function(event) {
            const submenu = document.getElementById('multiKeyTokenSubmenu');
        });
        */

        // Show notification
        function showNotification(message) {
            // Create notification element
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #1a1a1a;
                border: 1px solid #2a2a2a;
                border-radius: 8px;
                padding: 15px 20px;
                color: #10b981;
                font-size: 0.9rem;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
                z-index: 9999;
                animation: slideInRight 0.3s ease-out;
            `;
            notification.textContent = '✅ ' + message;
            document.body.appendChild(notification);

            // Remove after 3 seconds
            setTimeout(() => {
                notification.style.animation = 'slideOutRight 0.3s ease-out';
                setTimeout(() => notification.remove(), 300);
            }, 3000);
        }

        // Show help for Multi Key Token
        function showMultiKeyTokenHelp() {
            alert(`🔐 Multi Key Recipients Help

This feature allows you to:

1. Deploy a smart contract
2. Transfer ERC20 tokens from multiple wallets to the contract
3. Withdraw all collected tokens to a recipient address

Steps:
1. Enter RPC URL and chain details
2. Enter token contract address
3. Enter developer wallet private key
4. Enter multiple sender private keys (one per line)
5. Enter recipient address and amount
6. Deploy contract
7. Execute transfer

Need more help? Check the logs for detailed information.`);
        }


        function logMessageMultiNative(type, message, isHtml) {
            if (!_isUIVisible('multiKeyNativeUI')) return;
            const logContainer = document.getElementById('logContainerMultiKeyNative');
            if (!logContainer) return;
            
            const line = document.createElement('div');
            line.className = `log-line log-${type}`;
            
            const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
            line.innerHTML = `[${timestamp}] ${isHtml ? message : processLogMessage(message, _thGetChainIdFromRpc('rpcUrlMultiKeyNative'))}`;
            
            logContainer.appendChild(line);
            logContainer.scrollTop = logContainer.scrollHeight;
        }

        function clearLogMultiNative() {
            document.getElementById('logContainerMultiKeyNative').innerHTML = '';
                    }

        // Multi Key Token Modal Functions

        function closeMultiKeyTokenModal() {
            document.getElementById('multiKeyTokenModal').classList.remove('active');
        }

        function logMessageMultiToken(type, message, isHtml) {
            if (!_isUIVisible('multiKeyNativeUI', 'multiKeyTokenModeContent')) return;
            const logContainer = document.getElementById('logContainerMultiKeyToken');
            if (!logContainer) return;
            
            const line = document.createElement('div');
            line.className = `log-line log-${type}`;
            
            const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
            line.innerHTML = `[${timestamp}] ${isHtml ? message : processLogMessage(message, _thGetChainIdFromRpc('rpcUrlMultiKeyToken'))}`;
            
            logContainer.appendChild(line);
            logContainer.scrollTop = logContainer.scrollHeight;
        }

        function clearLogMultiToken() {
            document.getElementById('logContainerMultiKeyToken').innerHTML = '';
                    }

