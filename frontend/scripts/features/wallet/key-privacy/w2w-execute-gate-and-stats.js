        // ── W2W Execute Button Gate ──────────────────────────────────────
        // Enables Execute Transfer only when ALL required fields are filled.
        // Native mode: Sender Keys + Receiver Keys/Addresses + Amount
        // Token mode:  Sender Keys + Receiver Keys/Addresses + Contract + Amount
        // ─────────────────────────────────────────────────────────────────
        function checkW2WExecuteReady() {
            // ── Native mode button ──
            const senderKeys   = (document.getElementById('w2wSenderKeys')?.value || '').trim();
            const receiverKeys = (document.getElementById('w2wReceiverKeys')?.value || '').trim();
            const amount       = (document.getElementById('w2wCustomAmount')?.value || '').trim();

            const hasSenders   = senderKeys.split('\n').filter(l => l.trim()).length > 0;
            const hasReceivers = receiverKeys.split('\n').filter(l => l.trim()).length > 0;
            const hasAmount    = amount !== '' && amount !== '0';

            const nativeReady  = hasSenders && hasReceivers && hasAmount;
            const nativeBtn    = document.getElementById('executeW2WBtn');
            if (nativeBtn) {
                nativeBtn.disabled      = !nativeReady;
                nativeBtn.style.opacity = nativeReady ? '1'   : '0.45';
                nativeBtn.style.cursor  = nativeReady ? 'pointer' : 'not-allowed';
            }

            // ── Token mode button ──
            const senderKeysT   = (document.getElementById('w2wSenderKeysToken')?.value || '').trim();
            const receiverKeysT = (document.getElementById('w2wReceiverKeysToken')?.value || '').trim();
            const contract      = (document.getElementById('w2wTokenContract')?.value || '').trim();
            const amountT       = (document.getElementById('w2wCustomAmountToken')?.value || '').trim();

            const hasSendersT   = senderKeysT.split('\n').filter(l => l.trim()).length > 0;
            const hasReceiversT = receiverKeysT.split('\n').filter(l => l.trim()).length > 0;
            const hasContract   = contract !== '';
            const hasAmountT    = amountT !== '' && amountT !== '0';

            const tokenReady    = hasSendersT && hasReceiversT && hasContract && hasAmountT;
            const tokenBtn      = document.getElementById('executeW2WTokenBtn');
            if (tokenBtn) {
                tokenBtn.disabled      = !tokenReady;
                tokenBtn.style.opacity = tokenReady ? '1'   : '0.45';
                tokenBtn.style.cursor  = tokenReady ? 'pointer' : 'not-allowed';
            }
        }

        // Update W2W stats display
        function updateW2WStats() {
            const w2wSenderKeysEl = document.getElementById('w2wSenderKeys');
            const w2wReceiverKeysEl = document.getElementById('w2wReceivers');
            const w2wTotalSendersEl = document.getElementById('w2wTotalSenders');
            const w2wTotalReceiversEl = document.getElementById('w2wTotalReceivers');
            const w2wCustomAmountEl = document.getElementById('w2wCustomAmount');
            
            if (!w2wSenderKeysEl || !w2wReceiverKeysEl || !w2wTotalSendersEl || !w2wTotalReceiversEl) {
                checkW2WExecuteReady();
                return;
            }
            
            const senders = w2wSenderKeysEl.value.split('\n').filter(l => l.trim()).length;
            const receivers = w2wReceiverKeysEl.value.split('\n').filter(l => l.trim()).length;
            
            w2wTotalSendersEl.textContent = senders;
            w2wTotalReceiversEl.textContent = receivers;
            
            const amount = w2wCustomAmountEl ? (w2wCustomAmountEl.value || '0') : '0';
            checkW2WExecuteReady();
        }
        
        // Update stats when textarea changes
        document.addEventListener('DOMContentLoaded', function() {
            const w2wSenderKeys = document.getElementById('w2wSenderKeys');
            const w2wReceiverKeys = document.getElementById('w2wReceiverKeys');
            const w2wCustomAmount = document.getElementById('w2wCustomAmount');
            
            // Native mode listeners
            if (w2wSenderKeys) {
                w2wSenderKeys.addEventListener('input', updateW2WStats);
            }
            if (w2wReceiverKeys) {
                w2wReceiverKeys.addEventListener('input', updateW2WStats);
            }
            if (w2wCustomAmount) {
                w2wCustomAmount.addEventListener('input', updateW2WStats);
            }
            
            // Token mode listeners
            const w2wSenderKeysToken = document.getElementById('w2wSenderKeysToken');
            const w2wReceiverKeysToken = document.getElementById('w2wReceiverKeysToken');
            const w2wCustomAmountToken = document.getElementById('w2wCustomAmountToken');
            const w2wTokenContract = document.getElementById('w2wTokenContract');
            
            if (w2wSenderKeysToken) {
                w2wSenderKeysToken.addEventListener('input', updateTokenCounts);
            }
            if (w2wReceiverKeysToken) {
                w2wReceiverKeysToken.addEventListener('input', updateTokenCounts);
            }
            if (w2wCustomAmountToken) {
                w2wCustomAmountToken.addEventListener('input', updateTokenCounts);
            }
            // Contract address change also gates the token execute button
            if (w2wTokenContract) {
                w2wTokenContract.addEventListener('input', checkW2WExecuteReady);
            }
            // Run once on load so buttons reflect initial state
            checkW2WExecuteReady();
        });
        
        // Update token mode counters
        function updateTokenCounts() {
            const senders = document.getElementById('w2wSenderKeysToken')?.value.split('\n').filter(l => l.trim()).length || 0;
            const receivers = document.getElementById('w2wReceiverKeysToken')?.value.split('\n').filter(l => l.trim()).length || 0;
            
            const senderCountEl = document.getElementById('w2wSenderCountToken');
            const receiverCountEl = document.getElementById('w2wReceiverCountToken');
            
            if (senderCountEl) senderCountEl.textContent = senders;
            if (receiverCountEl) receiverCountEl.textContent = receivers;
            checkW2WExecuteReady();
        }
        
        
        
