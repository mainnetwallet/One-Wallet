
        async function generateKeysFromPhrase() {
            try {
                const mnemonicInput = document.getElementById('mnemonicInput').value.trim();
                const derivationPath = document.getElementById('derivationPath').value.trim() || "m/44'/60'/0'/0/0";
                const numAddresses = parseInt(document.getElementById('numAddresses').value) || 1;

                if (!mnemonicInput) {
                    logMessagePhraseToKey('error', '❌ Please enter at least one mnemonic phrase');
                    return;
                }

                // Split by newlines to get multiple phrases
                const phrases = mnemonicInput.split('\n')
                    .map(p => p.trim())
                    .filter(p => p.length > 0);

                if (phrases.length === 0) {
                    logMessagePhraseToKey('error', '❌ No valid phrases found');
                    return;
                }

                
                const container = document.getElementById('generatedKeysContainer');
                container.innerHTML = '';

                const generatedKeys = [];
                const generatedAddresses = [];
                
                let totalWallets = 0;
                let successCount = 0;
                let errorCount = 0;

                // Process each phrase
                for (let phraseIndex = 0; phraseIndex < phrases.length; phraseIndex++) {
                    const mnemonic = phrases[phraseIndex];
                    
                    // Validate mnemonic word count
                    const words = mnemonic.split(/\s+/);
                    const validWordCounts = [12, 15, 18, 21, 24];
                    
                    if (!validWordCounts.includes(words.length)) {
                        logMessagePhraseToKey('error', `❌ Phrase #${phraseIndex + 1}: Invalid word count (${words.length}). Must be ${validWordCounts.join(', ')} words. Skipping...`);
                        errorCount++;
                        continue;
                    }

                    // Validate and create mnemonic
                    let mnemonicObj;
                    try {
                        mnemonicObj = ethers.Mnemonic.fromPhrase(mnemonic);
                    } catch (error) {
                        logMessagePhraseToKey('error', `❌ Phrase #${phraseIndex + 1}: Invalid mnemonic - ${error.message}. Skipping...`);
                        errorCount++;
                        continue;
                    }


                    // Phrase header (compact caption line)
                    const phraseHeader = document.createElement('div');
                    phraseHeader.className = 'kt-phead';
                    phraseHeader.textContent = `Phrase #${phraseIndex + 1} · ${words.length} words · ${numAddresses} wallet${numAddresses !== 1 ? 's' : ''}`;
                    container.appendChild(phraseHeader);

                    // Generate keys for this phrase
                    for (let i = 0; i < numAddresses; i++) {
                        try {
                            // Modify path for multiple addresses
                            const modifiedPath = derivationPath.replace(/\/\d+$/, `/${i}`);
                            
                            const hdNode = ethers.HDNodeWallet.fromMnemonic(mnemonicObj, modifiedPath);
                            const privateKey = hdNode.privateKey;
                            const address = hdNode.address;

                            generatedKeys.push(privateKey);
                            generatedAddresses.push(address);
                            totalWallets++;
                            successCount++;

                            // Compact row for each wallet: short address, masked key, reveal + copy icons
                            const _short = address.slice(0, 8) + '...' + address.slice(-6);
                            const _mask = privateKey.slice(0, 4) + '••••••••' + privateKey.slice(-4);
                            const keyCard = document.createElement('div');
                            keyCard.className = 'kt-rrow';
                            keyCard.setAttribute('data-scope', 'p2k');
                            keyCard.setAttribute('data-addr', address);
                            keyCard.setAttribute('data-key', privateKey);
                            keyCard.setAttribute('data-key-mask', _mask);
                            keyCard.innerHTML = `
                                <span class="kt-idx" title="${modifiedPath}">#${i + 1}</span>
                                <div class="kt-main">
                                    <div class="kt-addr" title="${address}">${_short}</div>
                                    <div class="kt-key">${_mask}</div>
                                </div>
                                <button type="button" class="kt-ib" onclick="ktToggleKey(this)" title="Show / hide private key" aria-label="Show or hide private key"><span class="material-icons-round">visibility_off</span></button>
                                <button type="button" class="kt-ib" onclick="ktCopy(this,'addr')" title="Copy address" aria-label="Copy address"><span class="material-icons-round">place</span></button>
                                <button type="button" class="kt-ib" onclick="ktCopy(this,'key')" title="Copy private key" aria-label="Copy private key"><span class="material-icons-round">vpn_key</span></button>
                            `;
                            container.appendChild(keyCard);
                            

                        } catch (error) {
                            logMessagePhraseToKey('error', `   ❌ Failed to generate wallet #${i + 1}: ${error.message}`);
                            errorCount++;
                        }
                    }
                }

                // Store for copy all functionality
                window.generatedPrivateKeys = generatedKeys;
                window.generatedAddresses = generatedAddresses;

                // Show output section
                safeShowElement('outputSection');
                
                if (errorCount > 0) {
                    logMessagePhraseToKey('error', `   ❌ Errors: ${errorCount}`);
                }

            } catch (error) {
                logMessagePhraseToKey('error', '❌ Error: ' + error.message);
            }
        }

        function copyToClipboardLog(text, label) {
            // Android WebView: use native bridge
            if (window.isOneAndroid && window.OneAndroid && window.OneAndroid.copyToClipboard) {
                window.OneAndroid.copyToClipboard(text);
                logMessagePhraseToKey('success', `✅ ${label} copied to clipboard!`);
                return;
            }
            navigator.clipboard.writeText(text).then(() => {
                logMessagePhraseToKey('success', `✅ ${label} copied to clipboard!`);
            }).catch(err => {
                logMessagePhraseToKey('error', '❌ Failed to copy: ' + err.message);
            });
        }

        function copyAllKeys() {
            if (!window.generatedPrivateKeys || window.generatedPrivateKeys.length === 0) {
                logMessagePhraseToKey('error', '❌ No keys to copy');
                return;
            }
            
            const allKeys = window.generatedPrivateKeys.join('\n');
            
            // Try modern clipboard API first
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(allKeys).then(() => {
                    logMessagePhraseToKey('success', `✅ All ${window.generatedPrivateKeys.length} private keys copied!`);
                }).catch(err => {
                    // Fallback for mobile browsers
                    fallbackCopyToClipboard(allKeys, () => {
                        logMessagePhraseToKey('success', `✅ All ${window.generatedPrivateKeys.length} private keys copied!`);
                    });
                });
            } else {
                // Use fallback for older browsers
                fallbackCopyToClipboard(allKeys, () => {
                    logMessagePhraseToKey('success', `✅ All ${window.generatedPrivateKeys.length} private keys copied!`);
                });
            }
        }

        function _thCopyAllAddresses() {
            if (!window.generatedAddresses || window.generatedAddresses.length === 0) {
                logMessagePhraseToKey('error', '❌ No addresses to copy');
                return;
            }
            
            const allAddresses = window.generatedAddresses.join('\n');
            
            // Try modern clipboard API first
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(allAddresses).then(() => {
                    logMessagePhraseToKey('success', `✅ All ${window.generatedAddresses.length} addresses copied!`);
                }).catch(err => {
                    // Fallback for mobile browsers
                    fallbackCopyToClipboard(allAddresses, () => {
                        logMessagePhraseToKey('success', `✅ All ${window.generatedAddresses.length} addresses copied!`);
                    });
                });
            } else {
                // Use fallback for older browsers
                fallbackCopyToClipboard(allAddresses, () => {
                    logMessagePhraseToKey('success', `✅ All ${window.generatedAddresses.length} addresses copied!`);
                });
            }
        }
        
        // Fallback copy method for mobile browsers
        function fallbackCopyToClipboard(text, callback) {
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
                logMessagePhraseToKey('error', '❌ Failed to copy');
            }
            
            document.body.removeChild(textArea);
        }

        function clearPhraseToKey() {
            document.getElementById('mnemonicInput').value = '';
            document.getElementById('derivationPath').value = "m/44'/60'/0'/0/0";
            document.getElementById('numAddresses').value = '1';
            document.getElementById('generatedKeysContainer').innerHTML = '';
            safeHideElement('outputSection');
            document.getElementById('phraseCountBadge').textContent = '0 phrases';
            
            window.generatedPrivateKeys = [];
            window.generatedAddresses = [];
            
            clearLogPhraseToKey();
        }
        
        // Update phrase count badge
        function updatePhraseCount() {
            const mnemonicInput = document.getElementById('mnemonicInput').value.trim();
            const phrases = mnemonicInput.split('\n')
                .map(p => p.trim())
                .filter(p => p.length > 0);
            
            const badge = document.getElementById('phraseCountBadge');
            if (badge) {
                const count = phrases.length;
                badge.textContent = `${count} phrase${count !== 1 ? 's' : ''}`;
                
                // Change color based on count
                if (count === 0) {
                    badge.style.background = '#2a2a2a';
                    badge.style.color = '#4a9eff';
                } else if (count === 1) {
                    badge.style.background = '#10b98120';
                    badge.style.color = '#10b981';
                } else {
                    badge.style.background = '#f59e0b20';
                    badge.style.color = '#f59e0b';
                }
            }
            // Enable / disable Generate Keys button
            const genBtn = document.getElementById('generateKeysBtn');
            if (genBtn) {
                const hasPhrase = phrases.length >= 1;
                genBtn.disabled = !hasPhrase;
                genBtn.style.opacity = hasPhrase ? '1' : '0.45';
                genBtn.style.cursor  = hasPhrase ? 'pointer' : 'not-allowed';
            }
        }
        
        // Initialize phrase count update on input
        document.addEventListener('DOMContentLoaded', () => {
            const mnemonicInput = document.getElementById('mnemonicInput');
            if (mnemonicInput) {
                mnemonicInput.addEventListener('input', updatePhraseCount);
            }
            // Gate: Check Balances button enabled only when inputBalanceCheck has ≥1 entry
            const balanceInput = document.getElementById('inputBalanceCheck');
            const checkBtn = document.getElementById('checkBalancesBtn');
            if (balanceInput && checkBtn) {
                balanceInput.addEventListener('input', function() {
                    const hasEntry = balanceInput.value.trim().length > 0;
                    checkBtn.disabled = !hasEntry;
                    checkBtn.style.opacity = hasEntry ? '1' : '0.45';
                    checkBtn.style.cursor  = hasEntry ? 'pointer' : 'not-allowed';
                });
            }
        });

