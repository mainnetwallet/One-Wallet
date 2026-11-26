        // Select Transfer Mode
        function selectW2WMode(mode) {
            w2wMode = mode;
            
            // Update button styles
            const nativeBtn = document.getElementById('w2wNativeModeBtn');
            const tokenBtn = document.getElementById('w2wTokenModeBtn');
            const nativeFields = document.getElementById('w2wNativeFields');
            const tokenFields = document.getElementById('w2wTokenFields');
            
            if (!nativeBtn || !tokenBtn || !nativeFields || !tokenFields) {
                return; // Elements not ready yet
            }
            
            if (mode === 'native') {
                nativeBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                nativeBtn.style.color = 'white';
                nativeBtn.classList.add('active');
                tokenBtn.style.background = 'transparent';
                tokenBtn.style.color = '#888';
                tokenBtn.classList.remove('active');
                
                // Show native fields, hide token fields
                nativeFields.style.display = 'block';
                tokenFields.style.display = 'none';
            } else {
                tokenBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                tokenBtn.style.color = 'white';
                tokenBtn.classList.add('active');
                nativeBtn.style.background = 'transparent';
                nativeBtn.style.color = '#888';
                nativeBtn.classList.remove('active');
                
                // Show token fields, hide native fields
                nativeFields.style.display = 'none';
                tokenFields.style.display = 'block';
                
                // Initialize token chain grid when switching to token mode
                initChainGridW2WToken();
            }
            
            if (mode === 'native') { _thLogInitialRpc('rpcUrlW2W', logW2W); }
            else { _thLogInitialRpc('rpcUrlW2WToken', logW2W); }
            updatePreview();
        }
        
        // Select Amount Mode
        // Set W2W amount preset
        function setW2WAmount(value) {
            document.getElementById('w2wCustomAmount').value = value;
                        updateW2WStats();
        }
        
        // Set W2W MAX amount
        function setW2WMaxAmount() {
            document.getElementById('w2wCustomAmount').value = 'MAX';
            updateW2WStats();
        }
        
        // Token mode helpers
        function setW2WAmountToken(value) {
            document.getElementById('w2wCustomAmountToken').value = value;
            checkW2WExecuteReady();
        }
