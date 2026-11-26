
// ── Alias for getAllTHChains (defined in outer scope, exposed on window) ──
var getAllTHChains = typeof getAllTHChains !== 'undefined' ? getAllTHChains : (typeof window.getAllTHChains === 'function' ? window.getAllTHChains : function(){ return []; });

// ══════════════════════════════════════════════════════════════
// TRANSFER HUB — Coinbase Paymaster Sponsor Helpers
// Base chain (8453): wraps TX in ERC-4337 UserOp via Coinbase Paymaster → gasless
// Other chains: falls back to regular EOA sendTransaction automatically
// ══════════════════════════════════════════════════════════════

// Native / any-calldata send: replaces wallet.sendTransaction(...)
async function thSendWithSponsor(wallet, txReq, chainId, provider, logFn, hintGasLimit) {
  const _log = typeof logFn === 'function' ? logFn : function(){};
  if (chainId === 8453 && typeof sendSwapViaUserOp === 'function') {
    try {
      // Paymaster path — no verbose log
      const pmResult = await sendSwapViaUserOp(wallet, {
        to:    txReq.to,
        value: txReq.value !== undefined ? txReq.value : 0n,
        data:  txReq.data  || '0x'
      }, provider, _log, hintGasLimit);
      const hash = (pmResult && pmResult.txHash) ? pmResult.txHash : String(pmResult);
      const opHash = pmResult?.opHash || null;
      return { hash, opHash, wait: async () => ({ transactionHash: hash, status: 1, gasUsed: 0n, blockNumber: 0 }) };
    } catch(e) {
      _log('warning', '⚠️ Paymaster sponsor failed: ' + e.message.slice(0, 200));
      _log('warning', '↪ Falling back to EOA (user pays gas)…');
    }
  }
  // EOA fallback (non-Base or paymaster failed)
  return await wallet.sendTransaction(txReq);
}

// ERC-20 transfer: replaces tokenContract.transfer(to, amount[, opts])
async function thTokenSendWithSponsor(wallet, tokenContractOrAddr, to, amount, chainId, provider, logFn, txOpts, noSponsor) {
  const _log = typeof logFn === 'function' ? logFn : function(){};
  const tokenAddr = typeof tokenContractOrAddr === 'string'
    ? tokenContractOrAddr
    : (tokenContractOrAddr.target || tokenContractOrAddr.address || '');
  if (!noSponsor && chainId === 8453 && typeof sendSwapViaUserOp === 'function') {
    try {
      // Paymaster token path — no verbose log
      const iface = new ethers.Interface(['function transfer(address to, uint256 amount) returns (bool)']);
      const data  = iface.encodeFunctionData('transfer', [to, amount]);
      const pmResult = await sendSwapViaUserOp(wallet, { to: tokenAddr, value: 0n, data }, provider, _log);
      const hash = (pmResult && pmResult.txHash) ? pmResult.txHash : String(pmResult);
      const opHash = pmResult?.opHash || null;
      return { hash, opHash, wait: async () => ({ transactionHash: hash, status: 1, gasUsed: 0n, blockNumber: 0 }) };
    } catch(e) {
      _log('warning', '⚠️ Paymaster err: ' + e.message.slice(0, 80) + ' → EOA fallback');
    }
  }
  // EOA fallback
  const tc = typeof tokenContractOrAddr === 'string'
    ? new ethers.Contract(tokenContractOrAddr, ['function transfer(address to, uint256 amount) returns (bool)'], wallet)
    : tokenContractOrAddr;
  return txOpts ? await tc.transfer(to, amount, txOpts) : await tc.transfer(to, amount);
}

// ══════════════════════════════════════════════════════════════

// ========================================
        // BACKGROUND EXECUTION PROTECTION
        // ========================================
        // Prevent browser from throttling script when minimized
        
        // Keep a persistent connection to prevent throttling
        let backgroundWorkerInterval = null;
        let isTransactionInProgress = false;

        // BUG FIX 5: 100ms interval শুধু TX চলাকালীন চালু হবে, বাকি সময় বন্ধ
        function keepAliveInBackground() {
            if (!backgroundWorkerInterval) {
                backgroundWorkerInterval = setInterval(() => {
                    if (isTransactionInProgress) {
                        window.lastBackgroundPing = Date.now();
                    } else {
                        // BUG FIX 5: TX নেই — interval বন্ধ করো, CPU/battery বাঁচাও
                        clearInterval(backgroundWorkerInterval);
                        backgroundWorkerInterval = null;
                    }
                }, 100);
            }
        }

        // BUG FIX 5: TX শেষে interval explicitly বন্ধ করো
        function stopAliveInBackground() {
            if (backgroundWorkerInterval) {
                clearInterval(backgroundWorkerInterval);
                backgroundWorkerInterval = null;
            }
        }

        // TX শুরু হলেই keepAliveInBackground() call হবে (নিচে isTransactionInProgress = true এর পাশে)
        
        // Prevent page visibility API from affecting our transactions
        let originalHidden = null;
        let originalVisibilityState = null;
        
        // Override document.hidden to always return false during transactions
        Object.defineProperty(document, 'hidden', {
            configurable: true,
            get: function() {
                if (isTransactionInProgress) {
                    return false; // Pretend page is always visible during transactions
                }
                return originalHidden !== null ? originalHidden : false;
            }
        });
        
        // Override document.visibilityState similarly
        Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            get: function() {
                if (isTransactionInProgress) {
                    return 'visible'; // Pretend page is always visible during transactions
                }
                return originalVisibilityState !== null ? originalVisibilityState : 'visible';
            }
        });
        
        // Audio context trick to prevent throttling (silent)
        // BUG FIX 6: oscillator + audioContext কখনো stop/close হতো না → memory leak
        let audioContext = null;
        let oscillator = null;

        function startSilentAudio() {
            try {
                if (!audioContext) {
                    audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    oscillator = audioContext.createOscillator();
                    const gainNode = audioContext.createGain();
                    gainNode.gain.value = 0.0001; // Almost silent
                    oscillator.connect(gainNode);
                    gainNode.connect(audioContext.destination);
                    oscillator.start();
                }
            } catch (e) {}
        }

        // BUG FIX 6: TX শেষে audio বন্ধ করো
        function stopSilentAudio() {
            try {
                if (oscillator) { oscillator.stop(); oscillator.disconnect(); oscillator = null; }
                if (audioContext) { audioContext.close(); audioContext = null; }
            } catch(e) {}
        }

        // BUG FIX 6: audio শুধু TX চলাকালীন চালু হবে
        // (নিচে isTransactionInProgress = true এর পাশে startSilentAudio() call হবে)

        // Wake lock API — OneBGGuard (line ~72736) এ ভালো implementation আছে
        // BUG FIX 6: duplicate wakeLock — এখানে শুধু OneBGGuard এ delegate করো
        let wakeLock = null;
        async function requestWakeLock() {
            try {
                // OneBGGuard এর _acquireWakeLock ব্যবহার করো (duplicate এড়াতে)
                if (typeof window.OneBGGuard !== 'undefined' && window.OneBGGuard.txStart) {
                    return; // OneBGGuard handle করবে
                }
                if ('wakeLock' in navigator) {
                    wakeLock = await navigator.wakeLock.request('screen');
                }
            } catch (e) {
                // Wake lock not available - silently continue
            }
        }
        
        // Request wake lock
        requestWakeLock();
        
        // ========================================
        // MAIN SCRIPT VARIABLES
        // ========================================
        let signer = null;
        let chainId = null;
        let currentChainConfig = null;
        let currentTokenChainConfig = null; // For Token section
        let compiledContract = null;
        let provider = null;
        let activeContractAddress = null;
        let savedContracts = [];

        // ── Transfer Hub → Tx History bridge ─────────────────────────────────────
        // Saves a tx hash to the global One tx history (openTxHistory).
        // rpcInputId: id of the hidden <input> that holds data-chainid
        // label     : short description e.g. 'Batch Transfer', 'W2W Native'
        function _thSaveTx(hash, rpcInputId, label) {
            try {
                if (!hash || typeof saveTxToHistory !== 'function') return;
                var rpcEl   = document.getElementById(rpcInputId);
                var _cid    = rpcEl ? parseInt(rpcEl.getAttribute('data-chainid') || '', 10) || null : null;
                var explorerBase = (window.getTHExplorerTx ? window.getTHExplorerTx(_cid) : 'https://etherscan.io/tx/');
                saveTxToHistory({ type: 'send', hash: hash, chainId: _cid, fromChainId: _cid, pair: label, explorerBase: explorerBase });
            } catch(_e) {}
        }
        // ─────────────────────────────────────────────────────────────

        // ========================================
        // EXPLORER LINK HELPER FUNCTION
        // ========================================
        
        /**
         * Creates a clickable explorer link for a transaction hash
         * @param {string} txHash - The transaction hash
         * @param {object} chainConfig - The chain configuration object containing explorer URL
         * @param {boolean} showFullHash - Whether to show full hash or truncated version
         * @returns {string} HTML string with clickable link
         */
        function createExplorerLink(txHash, chainConfig = null, showFullHash = true) {
            // Use provided chainConfig or fall back to currentChainConfig
            const config = chainConfig || currentChainConfig || currentTokenChainConfig;
            
            // Get explorer base URL
            // Always use getTHExplorer so custom chains work — config.explorer may be empty string
            let _chainId = config?.chainId;
            // If chainId still unknown, try to detect from any active RPC input
            if (!_chainId && typeof _thGetChainIdFromRpc === 'function') {
                const _rpcIds = ['rpcUrl','rpcUrlToken','rpcUrlMultiKeyNative','rpcUrlMultiKeyToken',
                                  'rpcUrlNft','rpcUrlNftCollect','rpcUrlW2W','rpcUrlW2WToken',
                                  'withdrawRpcUrl','rpcUrlSelfTransfer','rpcUrlBalanceCheck','rpcUrlApproval'];
                for (const _rid of _rpcIds) {
                    const _cid = _thGetChainIdFromRpc(_rid);
                    if (_cid) { _chainId = _cid; break; }
                }
            }
            let explorerBase = window.getTHExplorer ? window.getTHExplorer(_chainId) : 'https://etherscan.io';
            if (config && config.explorer) explorerBase = config.explorer.replace(/\/$/, '');
            
            // Create full explorer URL
            const explorerUrl = `${explorerBase}/tx/${txHash}`;
            
            // Display format
            const displayHash = showFullHash ? txHash : `${txHash.substring(0, 10)}...${txHash.substring(txHash.length - 8)}`;
            
            // Return clickable link with mobile-optimized styling and copy button
            return `<span style="display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                        <a href="${explorerUrl}" target="_blank" rel="noopener noreferrer" 
                           style="color: #4db8ff; 
                                  text-decoration: none; 
                                  cursor: pointer; 
                                  transition: all 0.2s;
                                  word-break: break-all;
                                  display: inline-block;
                                  padding: 4px 8px;
                                  border-radius: 4px;
                                  background: rgba(77, 184, 255, 0.1);
                                  margin: 2px 0;
                                  min-height: 32px;
                                  line-height: 1.5;
                                  -webkit-tap-highlight-color: rgba(77, 184, 255, 0.3);"
                           onmouseover="this.style.color='#00ff88'; this.style.background='rgba(0, 255, 136, 0.15)'" 
                           onmouseout="this.style.color='#4db8ff'; this.style.background='rgba(77, 184, 255, 0.1)'"
                           ontouchstart="this.style.background='rgba(0, 255, 136, 0.2)'"
                           ontouchend="this.style.background='rgba(77, 184, 255, 0.1)'"
                           title="Tap to view on ${config?.name || 'blockchain'} explorer">
                            🔗 ${displayHash}
                        </a>
                        <button onclick="copyToClipboard('${txHash}', this)" 
                                style="background: rgba(255, 255, 255, 0.1);
                                       border: 1px solid rgba(255, 255, 255, 0.2);
                                       color: #fff;
                                       padding: 4px 8px;
                                       border-radius: 4px;
                                       cursor: pointer;
                                       font-size: 0.85rem;
                                       min-height: 32px;
                                       min-width: 32px;
                                       transition: all 0.2s;"
                                onmouseover="this.style.background='rgba(255, 255, 255, 0.2)'"
                                onmouseout="this.style.background='rgba(255, 255, 255, 0.1)'"
                                title="Copy hash">
                            📋
                        </button>
                    </span>`;
        }
        
        /**
         * Copy text to clipboard with visual feedback
         */
        function copyToClipboard(text, button) {
            // Haptic feedback for APK
            if (navigator.vibrate) {
                navigator.vibrate(50);
            }

            // Android WebView: use native bridge (navigator.clipboard blocked on file://)
            if (window.isOneAndroid && window.OneAndroid && window.OneAndroid.copyToClipboard) {
                window.OneAndroid.copyToClipboard(text);
                const originalText = button.innerHTML;
                button.innerHTML = '✅';
                button.style.background = 'rgba(0, 255, 136, 0.2)';
                button.style.borderColor = 'rgba(0, 255, 136, 0.4)';
                if (navigator.vibrate) { navigator.vibrate([30, 50, 30]); }
                setTimeout(() => {
                    button.innerHTML = originalText;
                    button.style.background = 'rgba(255, 255, 255, 0.1)';
                    button.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                }, 1500);
                return;
            }
            
            navigator.clipboard.writeText(text).then(() => {
                const originalText = button.innerHTML;
                button.innerHTML = '✅';
                button.style.background = 'rgba(0, 255, 136, 0.2)';
                button.style.borderColor = 'rgba(0, 255, 136, 0.4)';
                
                // Success haptic
                if (navigator.vibrate) {
                    navigator.vibrate([30, 50, 30]);
                }
                
                setTimeout(() => {
                    button.innerHTML = originalText;
                    button.style.background = 'rgba(255, 255, 255, 0.1)';
                    button.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                }, 1500);
            }).catch(err => {
                console.error('Failed to copy:', err);
                button.innerHTML = '❌';
                
                // Error haptic
                if (navigator.vibrate) {
                    navigator.vibrate([100, 50, 100]);
                }
                
                setTimeout(() => {
                    button.innerHTML = '📋';
                }, 1000);
            });
        }
        
        /**
         * Haptic feedback helper — delegates to the global haptic() which
         * also respects the user's haptic-off preference setting.
         * The `pattern` param is kept for call-site compatibility but the
         * global haptic() uses a fixed short pulse (per app UX design).
         */
        function hapticFeedback(pattern) {
            if (typeof haptic === 'function') { haptic(); return; }
            // Fallback if global haptic not yet defined
            if (navigator.vibrate) navigator.vibrate(pattern || 50);
        }
        
        /**
         * Creates a simple text display of hash without link (for when explorer is not available)
         */
        function createHashDisplay(txHash, showFullHash = true) {
            const displayHash = showFullHash ? txHash : `${txHash.substring(0, 10)}...${txHash.substring(txHash.length - 8)}`;
            return `📋 ${displayHash}`;
        }
