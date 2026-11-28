'use strict';


// ── Main dispatcher ────────────────────────────────────────
window.oneHandleWeb3Request = async function(reqId, method, paramsJson, originHost) {
  // Host of the tab that made this request. Captured per request: window._oneActiveBrowserHost
  // is only "the page that started loading last", which may be another tab.
  var _siteHost = originHost || _getBrowserHost();
  var params = [];
  try { params = JSON.parse(paramsJson || '[]'); } catch(_) {}

  var _resolve = function(result) {
    try { OneAndroid.web3Resolve(reqId, JSON.stringify(result)); } catch(_) {}
  };
  var _reject = function(msg) {
    try { OneAndroid.web3Reject(reqId, msg || 'Unknown error'); } catch(_) {}
  };

  // Get current chain — always read from Java InAppBrowserActivity.selectedChainId
  // (the authoritative source) so we never use a stale JS-cached value.
  // JS cache (_oneBrowserChainId) can lag behind when the chain picker updates Java
  // without going through oneHandleWeb3Request (e.g. NativeChainAdapter direct click).
  var _rawChainHex = null;
  try {
    if (window.isOneAndroid && window.OneAndroid && OneAndroid.getSelectedBrowserChainId) {
      var _javaChain = OneAndroid.getSelectedBrowserChainId();
      if (_javaChain && _javaChain.startsWith('0x')) {
        _rawChainHex = _javaChain;
        window._oneBrowserChainId = _javaChain; // keep JS in sync
      }
    }
  } catch(_) {}
  // Fallback to JS cache if Java bridge unavailable
  if (!_rawChainHex) {
    _rawChainHex = (typeof window._oneBrowserChainId !== 'undefined' && window._oneBrowserChainId)
      ? window._oneBrowserChainId : null;
  }
  var chainId = _rawChainHex
    ? parseInt(_rawChainHex, 16)
    : (typeof activeHomeChainId !== 'undefined' && activeHomeChainId !== null)
      ? activeHomeChainId : 1;
  var chainHex = '0x' + chainId.toString(16);

  try {
    switch (method) {

      // ── eth_requestAccounts / eth_accounts ──────────────────
      case 'eth_requestAccounts':
      case 'eth_accounts': {
        // ── Fast path: already have a selected browser wallet ──────────────────
        // Also covers the case where dApp reconnects on page refresh and calls
        // eth_requestAccounts again — we must return the address AND ensure
        // _oneBrowserSelectedAddress is set so signing works without re-connecting.
        var _bsa = window._oneBrowserSelectedAddress;
        if (!_bsa) {
          // Try to restore from Java-persisted selection (survives page navigation)
          try {
            // oneHandleWeb3Request runs in Main WebView — OneAndroid bridge is available here.
            // getPersistedBrowserWallet() reads SharedPreferences via InAppBrowserActivity,
            // so the persisted wallet address survives page navigation and app backgrounding.
            if (typeof OneAndroid !== 'undefined' && OneAndroid.getPersistedBrowserWallet) {
              var _persisted = OneAndroid.getPersistedBrowserWallet();
              if (_persisted && /^0x[0-9a-fA-F]{40}$/.test(_persisted)) {
                window._oneBrowserSelectedAddress = _persisted;
                _bsa = _persisted;
              }
            }
          } catch(_) {}
        }
        if (_bsa) {
          // Verify the persisted address still has a key in One (wallet may have been deleted)
          var _bsaKey = _getPrivateKeyForAddress(_bsa);
          if (!_bsaKey) {
            // Key gone — clear stale state and fall through to wallet picker
            window._oneBrowserSelectedAddress = null;
            _bsa = null;
          }
        }
        if (_bsa) {
          var _selAddr = _bsa;
          var _selChain = '0x1';
          try {
            if (typeof OneAndroid !== 'undefined' && OneAndroid.getSelectedBrowserChainId) {
              _selChain = OneAndroid.getSelectedBrowserChainId() || '0x1';
            }
          } catch(_) {}
          // Sync chain so signing uses correct chain
          window._oneBrowserChainId = _selChain;
          _resolve([_selAddr]);
          try { OneAndroid.web3UpdateAccount(JSON.stringify([_selAddr]), _selChain); } catch(_) {}
          break;
        }
        // ── No wallet selected yet — open wallet picker ─────────────────────────
        // Store reqId so brBwdSelectWallet() can resolve it after user picks.
        // If there's already a pending request (e.g. dApp called twice), reject the old one first.
        if (window._onePendingBrowserReqId && window._onePendingBrowserReqId !== reqId) {
          try { OneAndroid.web3Reject(window._onePendingBrowserReqId, 'Superseded by new request'); } catch(_) {}
        }
        window._onePendingBrowserReqId = reqId;
        // Open wallet picker — shows the main wallet drawer with Connect buttons
        try { OneAndroid.web3OpenWalletDrawer(); } catch(_) {}
        // Resolution happens via brBwdSelectWallet() when user taps Connect
        // Do NOT resolve here.
        break;
      }

      // ── eth_chainId / net_version ───────────────────────────
      case 'eth_chainId': {
        _resolve(chainHex); break;
      }
      case 'net_version': {
        _resolve(chainId.toString()); break;
      }

      // ── wallet_switchEthereumChain ──────────────────────────
      case 'wallet_switchEthereumChain': {
        var newChainIdHex = params[0] && params[0].chainId;
        if (newChainIdHex) {
          // Validate chain is added in One before switching
          // EIP-3326: if chain unknown, reject with code 4902 so dApp can call wallet_addEthereumChain
          var _swChainId = parseInt(newChainIdHex, 16);
          var _swKnown = false;
          var _swChainObj = null;
          try {
            var _swAllChains = (typeof getAllChains === 'function') ? getAllChains() : [];
            _swChainObj = _swAllChains.find(function(c){ return c.chainId === _swChainId; });
            _swKnown = !!_swChainObj;
          } catch(_) { _swKnown = true; } // fail-open
          if (!_swKnown) {
            // Reject with EIP-3326 code 4902 — chain not added
            try { OneAndroid.web3Reject(reqId, JSON.stringify({code:4902,message:'Chain ' + newChainIdHex + ' not added in One Wallet. Add it first.'})); } catch(_) {}
            _reject('Chain ' + newChainIdHex + ' not added in One Wallet');
            break;
          }
          try {
            // Use browser-connected wallet (not homeActiveKey) so dApp stays connected to the right address
            var accsJson = JSON.stringify(
              window._oneBrowserSelectedAddress ? [window._oneBrowserSelectedAddress] : []
            );
            var switchChainName = _swChainObj ? (_swChainObj.name || newChainIdHex) : newChainIdHex;
            // Save chain in Java + update toolbar
            if (typeof OneAndroid !== 'undefined' && OneAndroid.web3SwitchChain) {
              OneAndroid.web3SwitchChain(newChainIdHex, switchChainName);
            }
            // Sync _oneBrowserChainId in main wallet JS so signing uses correct chain
            window._oneBrowserChainId = newChainIdHex;
            OneAndroid.web3UpdateAccount(accsJson, newChainIdHex);
          } catch(_) {}
        }
        _resolve(null);
        break;
      }

      // ── wallet_addEthereumChain ─────────────────────────────
      case 'wallet_addEthereumChain': {
        try {
          var addP = params[0] || {};
          var addChainId = addP.chainId ? parseInt(addP.chainId, 16) : NaN;
          if (addChainId && !isNaN(addChainId) &&
              typeof getAllChains === 'function' && typeof loadCustomChains === 'function' &&
              typeof saveCustomChains === 'function') {
            var _allCh4 = getAllChains();
            if (!_allCh4.find(function(c){ return c.chainId === addChainId; })) {
              var addRpc = (addP.rpcUrls && addP.rpcUrls[0]) || '';
              var newCustomChain = {
                id: 'custom-' + addChainId,
                chainId: addChainId,
                emoji: '🔗',
                name: addP.chainName || ('Chain ' + addChainId),
                nativeSym: (addP.nativeCurrency && addP.nativeCurrency.symbol) || 'ETH',
                rpc: addRpc,
                rpcs: addRpc ? [addRpc] : [],
                explorer: (addP.blockExplorerUrls && addP.blockExplorerUrls[0]) || '',
                builtIn: false,
                color: '#6366f1',
                // Store dApp-supplied icon so the tx modal can show it
                logoURI: (addP.iconUrls && addP.iconUrls[0]) || addP.iconUrl || null,
              };
              var _customs4 = loadCustomChains();
              _customs4.push(newCustomChain);
              saveCustomChains(_customs4);
              if (typeof window.brSyncChainToPicker === 'function') {
                try { window.brSyncChainToPicker(newCustomChain); } catch(_) {}
              }
            }
          }
        } catch(_) {}
        _resolve(null); break;
      }

      // ── wallet_watchAsset ───────────────────────────────────
      case 'wallet_watchAsset': {
        _resolve(true); break;
      }

      // ── wallet_requestPermissions / wallet_getPermissions ───
      // Required by Uniswap, Aave, many MetaMask-standard dApps
      case 'wallet_requestPermissions': {
        // Return permissions for eth_accounts (standard MetaMask response)
        var reqPerms = params[0] || {};
        var grantedPerms = [];
        if (reqPerms.eth_accounts !== undefined) {
          grantedPerms.push({
            parentCapability: 'eth_accounts',
            caveats: [{
              type: 'restrictReturnedAccounts',
              value: window._oneBrowserSelectedAddress ? [window._oneBrowserSelectedAddress] : []
            }]
          });
        }
        _resolve(grantedPerms);
        break;
      }
      case 'wallet_getPermissions': {
        _resolve([{
          parentCapability: 'eth_accounts',
          caveats: [{
            type: 'restrictReturnedAccounts',
            value: window._oneBrowserSelectedAddress ? [window._oneBrowserSelectedAddress] : []
          }]
        }]);
        break;
      }

      // ── personal_sign ───────────────────────────────────────
      case 'personal_sign': {
        // EIP spec: params[0]=message, params[1]=address
        // But some dApps (WalletConnect v1, older) send params[0]=address, params[1]=message
        // Auto-detect: whichever param looks like an Ethereum address (0x + 40 hex) is fromAddr
        var msgToSign, fromAddr;
        if (params[1] && typeof params[1] === 'string' && /^0x[0-9a-fA-F]{40}$/.test(params[1])) {
          msgToSign = params[0]; fromAddr = params[1];
        } else if (params[0] && typeof params[0] === 'string' && /^0x[0-9a-fA-F]{40}$/.test(params[0])) {
          msgToSign = params[1]; fromAddr = params[0];
        } else {
          msgToSign = params[0]; fromAddr = params[1];
        }
        // Fallback: use connected browser wallet if address not found in params
        if (!fromAddr || !/^0x[0-9a-fA-F]{40}$/.test(fromAddr)) {
          fromAddr = window._oneBrowserSelectedAddress || null;
        }
        var pk = _getPrivateKeyForAddress(fromAddr);
        if (!pk) { _reject('Wallet not found: ' + fromAddr); break; }

        var displayMsg = msgToSign;
        try {
          if (msgToSign && msgToSign.startsWith('0x')) {
            var bytes = ethers.utils.arrayify(msgToSign);
            displayMsg = new TextDecoder('utf-8', {fatal: false}).decode(bytes);
          }
        } catch(_) {}

        var bodyHtml = _W3M_BODY_STYLES + '<div class="w3m-network-badge">🔑 PERSONAL SIGN</div>' +
          '<div class="w3m-section-title">SIGNING AS</div>' +
          '<div class="w3m-address-box" style="display:flex;flex-direction:column;gap:3px;">' +
            '<div style="font-size:11px;font-weight:700;color:#a78bfa;">' + (_getWalletLabelForAddress(fromAddr) || 'Wallet') + '</div>' +
            '<div style="font-size:10px;color:#6b7280;font-family:monospace;">' + (fromAddr || 'Unknown') + '</div>' +
          '</div>' +
          '<div class="w3m-section-title">MESSAGE</div>' +
          '<div class="w3m-data-box">' + _escHtml(displayMsg) + '</div>' +
          '<div class="w3m-warn-box"><div class="w3m-warn-icon">⚠️</div>' +
          '<div class="w3m-warn-text">You are signing a message. This does not send any transaction or spend gas.</div></div>';

        var doSign = async function() {
          // Re-resolve pk at sign time in case _oneBrowserSelectedAddress was set
          // after the modal opened (e.g. wagmi reconnect flows that fire personal_sign
          // before brBwdSelectWallet() has run — pk captured in closure may be null).
          var _signPk = pk;
          if (!_signPk) {
            // Try fromAddr first, then fall back to currently connected browser wallet
            var _tryAddr = fromAddr || window._oneBrowserSelectedAddress;
            if (_tryAddr) _signPk = _getPrivateKeyForAddress(_tryAddr);
          }
          if (!_signPk) {
            _reject('Wallet not found — please reconnect wallet in browser');
            return;
          }
          var wallet = new ethers.Wallet(_signPk);
          var msg = msgToSign;
          if (msg && msg.startsWith('0x')) msg = ethers.utils.arrayify(msg);
          var sig = await wallet.signMessage(msg);
          _resolve(sig);
        };

        if (_w3mOpen) {
          // Snapshot all closure vars to prevent concurrent-request pollution
          (function(_rId,_meth,_bHtml,_doSign,_rej){
            _w3mQueue.push(function() { _openModal({ reqId:_rId, method:_meth, title:'Sign Message', actionLabel:'personal_sign', siteHost:_siteHost, bodyHtml:_bHtml, approveLabel:'Sign', onApprove:_doSign, onReject:function(){ _rej('User rejected'); } }); });
          })(reqId, method, bodyHtml, doSign, _reject);
        } else {
          _openModal({ reqId, method, title: 'Sign Message', actionLabel: 'personal_sign', siteHost: _siteHost, bodyHtml, approveLabel: 'Sign', onApprove: doSign, onReject: function(){ _reject('User rejected'); } });
        }
        break;
      }

      // ── eth_sign ────────────────────────────────────────────
      case 'eth_sign': {
        // eth_sign spec: params[0]=address, params[1]=hash
        var fromAddr2 = params[0];
        var hashToSign = params[1];
        // Fallback to browser connected wallet if address missing
        if (!fromAddr2 || !/^0x[0-9a-fA-F]{40}$/.test(fromAddr2)) {
          fromAddr2 = window._oneBrowserSelectedAddress || null;
        }
        var pk2 = _getPrivateKeyForAddress(fromAddr2);
        if (!pk2) { _reject('Wallet not found: ' + fromAddr2); break; }

        var bodyHtml2 = _W3M_BODY_STYLES + '<div class="w3m-network-badge">🔑 ETH SIGN (RAW)</div>' +
          '<div class="w3m-section-title">SIGNING AS</div>' +
          '<div class="w3m-address-box" style="display:flex;flex-direction:column;gap:3px;">' +
            '<div style="font-size:11px;font-weight:700;color:#a78bfa;">' + (_getWalletLabelForAddress(fromAddr2) || 'Wallet') + '</div>' +
            '<div style="font-size:10px;color:#6b7280;font-family:monospace;">' + (fromAddr2 || 'Unknown') + '</div>' +
          '</div>' +
          '<div class="w3m-section-title">HASH</div>' +
          '<div class="w3m-data-box">' + _escHtml(hashToSign) + '</div>' +
          '<div class="w3m-warn-box"><div class="w3m-warn-icon">🚨</div>' +
          '<div class="w3m-warn-text">eth_sign signs arbitrary data. Only approve if you trust this site completely.</div></div>';

        var doEthSign = async function() {
          var _signPk2 = pk2;
          if (!_signPk2) {
            var _tryAddr2 = fromAddr2 || window._oneBrowserSelectedAddress;
            if (_tryAddr2) _signPk2 = _getPrivateKeyForAddress(_tryAddr2);
          }
          if (!_signPk2) { _reject('Wallet not found — please reconnect wallet in browser'); return; }
          var wallet = new ethers.Wallet(_signPk2);
          // eth_sign must NOT add EIP-191 prefix — sign the raw hash directly
          // wallet.signMessage() adds "\x19Ethereum Signed Message" prefix, which is wrong here
          var sigObj = wallet.signingKey.sign(hashToSign);
          // ethers v6: sigObj.v is 27 or 28; ethers v5: same. Use ethers.Signature.from for safe serialization.
          var sig;
          try {
            // ethers v6: Signature.from gives serialized 65-byte hex
            sig = ethers.Signature.from(sigObj).serialized;
          } catch(_) {
            // ethers v5 fallback: manual concat
            sig = sigObj.r + sigObj.s.slice(2) + (sigObj.v === 27 ? '1b' : '1c');
          }
          _resolve(sig);
        };

        if (_w3mOpen) {
          _w3mQueue.push(function() { _openModal({ reqId, method, actionLabel: 'eth_sign', siteHost: _siteHost, bodyHtml: bodyHtml2, approveLabel: 'Sign', onApprove: doEthSign, onReject: function(){ _reject('User rejected'); } }); });
        } else {
          _openModal({ reqId, method, actionLabel: 'eth_sign', siteHost: _siteHost, bodyHtml: bodyHtml2, approveLabel: 'Sign', onApprove: doEthSign, onReject: function(){ _reject('User rejected'); } });
        }
        break;
      }

      // ── eth_signTypedData (EIP-712) ──────────────────────────
      case 'eth_signTypedData':
      case 'eth_signTypedData_v3':
      case 'eth_signTypedData_v4': {
        var fromAddr3 = params[0];
        var typedDataRaw = params[1];
        // Fallback to browser connected wallet if address missing
        if (!fromAddr3 || !/^0x[0-9a-fA-F]{40}$/.test(fromAddr3)) {
          fromAddr3 = window._oneBrowserSelectedAddress || null;
        }
        var typedData = (typeof typedDataRaw === 'string') ? JSON.parse(typedDataRaw) : typedDataRaw;
        var pk3 = _getPrivateKeyForAddress(fromAddr3);
        if (!pk3) { _reject('Wallet not found: ' + fromAddr3); break; }

        var msgPreview = '';
        try { msgPreview = JSON.stringify(typedData.message || typedData, null, 2); } catch(_) { msgPreview = String(typedDataRaw); }
        if (msgPreview.length > 500) msgPreview = msgPreview.slice(0,500) + '...';

        var typedDomain = typedData.domain || {};
        var bodyHtml3 = _W3M_BODY_STYLES + '<div class="w3m-network-badge">🔏 EIP-712 TYPED SIGN</div>' +
          '<div class="w3m-section-title">SIGNING AS</div>' +
          '<div class="w3m-address-box" style="display:flex;flex-direction:column;gap:3px;">' +
            '<div style="font-size:11px;font-weight:700;color:#a78bfa;">' + (_getWalletLabelForAddress(fromAddr3) || 'Wallet') + '</div>' +
            '<div style="font-size:10px;color:#6b7280;font-family:monospace;">' + (fromAddr3 || 'Unknown') + '</div>' +
          '</div>' +
          (typedDomain.name ? '<div class="w3m-section-title">CONTRACT</div><div class="w3m-address-box">' + _escHtml(typedDomain.name) + '</div>' : '') +
          '<div class="w3m-section-title">MESSAGE PREVIEW</div>' +
          '<div class="w3m-data-box">' + _escHtml(msgPreview) + '</div>' +
          '<div class="w3m-warn-box"><div class="w3m-warn-icon">⚠️</div>' +
          '<div class="w3m-warn-text">Typed signature. Often used for gasless approvals or permit2. Review carefully.</div></div>';

        var doTypedSign = async function() {
          var _signPk3 = pk3;
          if (!_signPk3) {
            var _tryAddr3 = fromAddr3 || window._oneBrowserSelectedAddress;
            if (_tryAddr3) _signPk3 = _getPrivateKeyForAddress(_tryAddr3);
          }
          if (!_signPk3) { _reject('Wallet not found — please reconnect wallet in browser'); return; }
          var wallet = new ethers.Wallet(_signPk3);
          var domain = Object.assign({}, typedData.domain || {});
          // Normalize domain.chainId: BigInt strings like "8453n" or numeric strings break ethers
          if (domain.chainId !== undefined) {
            try { domain.chainId = Number(String(domain.chainId).replace(/n$/, '')); } catch(_) {}
          }
          var types = Object.assign({}, typedData.types || {});
          delete types.EIP712Domain;
          var _rawMessage = typedData.message || typedData.value || {};
          // ── Normalize EIP-712 message fields for ethers v6 strict type checking ──
          // ethers v6 rejects uint256/uint128/etc fields that are plain JS strings.
          // LI.FI Permit2, OpenSea, etc send amounts/nonces/deadlines as strings.
          // Deep-walk the message and coerce numeric-string fields to BigInt by type.
          var _normalizeTypedMsg = function(typeKey, obj, allTypes) {
            if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
            var typeDef = allTypes[typeKey];
            if (!typeDef) return obj;
            var out = {};
            for (var fi = 0; fi < typeDef.length; fi++) {
              var fName = typeDef[fi].name;
              var fType = typeDef[fi].type;
              var fVal  = obj[fName];
              if (fVal === undefined || fVal === null) { out[fName] = fVal; continue; }
              // Strip array suffix to get base type (e.g. uint256[] → uint256)
              var _baseType = fType.replace(/\[.*\]$/, '');
              var _isArray  = fType !== _baseType;
              if (_isArray && Array.isArray(fVal)) {
                // Recursively normalize each element of the array
                out[fName] = fVal.map(function(item) {
                  if (/^u?int(\d*)$/.test(_baseType)) {
                    if (typeof item === 'string') { try { return BigInt(item.replace(/n$/, '')); } catch(_) {} }
                    if (typeof item === 'number')  { try { return BigInt(item); } catch(_) {} }
                    return item;
                  }
                  if (allTypes[_baseType]) return _normalizeTypedMsg(_baseType, item, allTypes);
                  return item;
                });
              } else if (/^u?int(\d*)$/.test(_baseType)) {
                // uint/int family: coerce string → BigInt so ethers v6 doesn't throw INVALID_ARGUMENT
                if (typeof fVal === 'string') {
                  try { fVal = BigInt(fVal.replace(/n$/, '')); } catch(_) {}
                } else if (typeof fVal === 'number') {
                  try { fVal = BigInt(fVal); } catch(_) {}
                }
                out[fName] = fVal;
              } else if (allTypes[_baseType]) {
                // Nested struct — recurse
                out[fName] = _normalizeTypedMsg(_baseType, fVal, allTypes);
              } else {
                out[fName] = fVal;
              }
            }
            return out;
          };
          // Find the primary (non-EIP712Domain) type — it's the first key in types
          var _primaryType = typedData.primaryType || Object.keys(types)[0] || '';
          var message = _primaryType ? _normalizeTypedMsg(_primaryType, _rawMessage, types) : _rawMessage;

          // ethers v6: wallet.signTypedData(domain, types, value)
          // ethers v5: wallet._signTypedData(domain, types, value)
          var sig;
          if (typeof wallet.signTypedData === 'function') {
            sig = await wallet.signTypedData(domain, types, message);
          } else if (typeof wallet._signTypedData === 'function') {
            sig = await wallet._signTypedData(domain, types, message);
          } else {
            throw new Error('signTypedData not available');
          }
          _resolve(sig);
        };

        if (_w3mOpen) {
          _w3mQueue.push(function() { _openModal({ reqId, method, actionLabel: method, siteHost: _siteHost, bodyHtml: bodyHtml3, approveLabel: 'Sign', onApprove: doTypedSign, onReject: function(){ _reject('User rejected'); } }); });
        } else {
          _openModal({ reqId, method, actionLabel: method, siteHost: _siteHost, bodyHtml: bodyHtml3, approveLabel: 'Sign', onApprove: doTypedSign, onReject: function(){ _reject('User rejected'); } });
        }
        break;
      }

      // ── eth_sendTransaction ─────────────────────────────────
      // v2: OneGas engine + Base Coinbase Paymaster (sponsored TX)
      case 'eth_sendTransaction': {

        // ── Chain validation: reject immediately if chain not added in One Wallet ──
        // Prevents modal from opening on unsupported chains — shows actionable toast instead.
        (function() {
          try {
            var _knownChains = (typeof getAllChains === 'function') ? getAllChains() : [];
            var _chainKnown  = _knownChains.some(function(c) { return c.chainId === chainId; });
            if (!_chainKnown) {
              // Toast in main wallet UI (visible if wallet is in foreground)
              if (typeof showToast === 'function') {
                showToast('⛓️ Chain 0x' + chainId.toString(16) + ' not added — add it first', 'error');
              }
              // Also surface via Android Toast so it shows even when wallet UI is behind browser
              try {
                if (window.OneAndroid && OneAndroid.showToast) {
                  OneAndroid.showToast('Chain not added in One Wallet — add chain 0x' + chainId.toString(16) + ' first');
                }
              } catch(_) {}
              // Inject a red error toast directly into the dApp WebView (always visible to user)
              try {
                if (window.OneAndroid && OneAndroid.injectChainError) {
                  OneAndroid.injectChainError(
                    '0x' + chainId.toString(16),
                    String(chainId)
                  );
                }
              } catch(_) {}
              _reject('Chain 0x' + chainId.toString(16) + ' (id:' + chainId + ') is not configured in One Wallet. Please add this network first.');
              return true; // signal: handled (caller ignores this but keeps flag clean)
            }
          } catch(_e) {
            // If chain check itself throws, allow through (fail-open is safer than false-blocking)
          }
          return false;
        })();
        // If chain was unknown, _reject() was already called above — but JS switch doesn't
        // early-exit from inside an IIFE, so we guard the rest with a flag.
        var _chainValidated = (function() {
          try {
            var _kc = (typeof getAllChains === 'function') ? getAllChains() : [];
            return _kc.some(function(c) { return c.chainId === chainId; });
          } catch(_) { return true; } // fail-open
        })();
        if (!_chainValidated) break;

        var txParams = params[0] || {};
        var fromAddr4 = txParams.from;
        // Fallback to browser connected wallet if from is missing
        if (!fromAddr4 || !/^0x[0-9a-fA-F]{40}$/.test(fromAddr4)) {
          fromAddr4 = window._oneBrowserSelectedAddress || null;
          if (fromAddr4) txParams.from = fromAddr4;
        }
        // Extra fallback: if _oneBrowserSelectedAddress was cleared (e.g. during sign→TX gap),
        // restore from Java-persisted wallet so TX modal still opens correctly.
        if (!fromAddr4 || !/^0x[0-9a-fA-F]{40}$/.test(fromAddr4)) {
          try {
            if (window.OneAndroid && OneAndroid.getPersistedBrowserWallet) {
              var _pAddr = OneAndroid.getPersistedBrowserWallet();
              if (_pAddr && /^0x[0-9a-fA-F]{40}$/.test(_pAddr)) {
                fromAddr4 = _pAddr;
                window._oneBrowserSelectedAddress = _pAddr; // restore
                if (txParams) txParams.from = fromAddr4;
              }
            }
          } catch(_) {}
        }
        var pk4 = _getPrivateKeyForAddress(fromAddr4);
        if (!pk4 && window._oneBrowserSelectedAddress) {
          // Retry with the currently connected browser wallet address
          fromAddr4 = window._oneBrowserSelectedAddress;
          if (txParams) txParams.from = fromAddr4;
          pk4 = _getPrivateKeyForAddress(fromAddr4);
        }
        if (!pk4) { _reject('Wallet not found: ' + fromAddr4); break; }

        var valDisplay = _fmtValue(txParams.value, chainId);
        var sym        = _getChainSymbol(chainId);
        var chainName  = _getChainName(chainId);
        var toShort    = txParams.to ? txParams.to.slice(0,8) + '...' + txParams.to.slice(-6) : 'Contract';
        var hasData    = txParams.data && txParams.data !== '0x' && txParams.data.length > 2;

        // ── ERC20 transfer/approve decode ──────────────────────────────────────
        // Selector 0xa9059cbb = transfer(address,uint256)
        // Selector 0x095ea7b3 = approve(address,uint256)
        // Selector 0x23b872dd = transferFrom(address,address,uint256)
        var _erc20Info = null;
        try {
          var _txData = txParams.data || '';
          var _sel4   = _txData.slice(0, 10).toLowerCase();
          if (_sel4 === '0xa9059cbb' || _sel4 === '0x095ea7b3') {
            // transfer(to, amount) or approve(spender, amount)
            // ABI-encoded: 32 bytes address (padded) + 32 bytes uint256
            if (_txData.length >= 10 + 128) {
              var _toRaw    = '0x' + _txData.slice(10 + 24, 10 + 64);       // address (last 20 bytes of 32)
              var _amtHex   = '0x' + _txData.slice(10 + 64, 10 + 128);      // uint256
              var _amtBig   = BigInt(_amtHex);
              // Resolve token decimals: 1) user TOKEN_CONFIG, 2) PAIR_DEFAULT_TOKENS, 3) on-chain call
              var _tokDec   = 18;
              var _tokSym2  = null;
              try {
                var _contractLow = (txParams.to||'').toLowerCase();
                // Layer 1: user's saved token list (TOKEN_CONFIG)
                var _savedToks = (typeof TOKEN_CONFIG !== 'undefined') ? TOKEN_CONFIG : [];
                var _savedMeta = _savedToks.find(function(t){
                  return (t.contract||t.address||'').toLowerCase() === _contractLow;
                });
                if (_savedMeta && _savedMeta.decimals != null) {
                  _tokDec  = parseInt(_savedMeta.decimals);
                  _tokSym2 = _savedMeta.sub || _savedMeta.symbol || _savedMeta.sym || null;
                } else {
                  // Layer 2: PAIR_DEFAULT_TOKENS (USDC=6, cbBTC=8, etc.)
                  var _pairMeta = PAIR_DEFAULT_TOKENS.find(function(t){
                    return t.addr.toLowerCase() === _contractLow;
                  });
                  if (_pairMeta && _pairMeta.decimals != null) {
                    _tokDec  = parseInt(_pairMeta.decimals);
                    _tokSym2 = _pairMeta.sym || null;
                  } else if (typeof fetchTokenInfo === 'function') {
                    // Layer 3: async on-chain decimals() call for unknown tokens
                    var _onChainInfo = await fetchTokenInfo(txParams.to).catch(function(){ return null; });
                    if (_onChainInfo && _onChainInfo.decimals != null) {
                      _tokDec  = parseInt(_onChainInfo.decimals);
                      _tokSym2 = _onChainInfo.sym || null;
                    }
                  }
                }
              } catch(_) {}
              // Format amount with correct decimals
              var _divisor  = BigInt(10) ** BigInt(_tokDec);
              var _whole    = _amtBig / _divisor;
              var _frac     = _amtBig % _divisor;
              var _fracStr  = _frac.toString().padStart(_tokDec, '0');
              // Trim trailing zeros, cap at 6 decimal places for display
              _fracStr = _fracStr.slice(0, 6).replace(/0+$/, '');
              // Check for MAX_UINT256 (unlimited approve)
              var _MAX_UINT256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
              var _amtDisplay = (_amtBig >= _MAX_UINT256)
                ? 'Unlimited ∞'
                : (_whole.toString() + (_fracStr ? '.' + _fracStr : ''));
              // Token symbol from resolved meta or fallback
              var _tokSym = _tokSym2 ? _tokSym2 : 'Token·' + (txParams.to ? txParams.to.slice(-4) : '????');
              var _toShortErc = _toRaw.length >= 10 ? _toRaw.slice(0,8) + '...' + _toRaw.slice(-6) : _toRaw;
              _erc20Info = {
                type:      _sel4 === '0xa9059cbb' ? 'ERC-20 Transfer' : 'ERC-20 Approve',
                recipient: _toRaw,
                recipientShort: _toShortErc,
                amount:    _amtDisplay,
                symbol:    _tokSym,
                decimals:  _tokDec,
                contract:  txParams.to || ''
              };
            }
          } else if (_sel4 === '0x23b872dd') {
            // transferFrom(from, to, amount)
            if (_txData.length >= 10 + 192) {
              var _tfFrom   = '0x' + _txData.slice(10 + 24,  10 + 64);
              var _tfTo     = '0x' + _txData.slice(10 + 88,  10 + 128);
              var _tfAmtHex = '0x' + _txData.slice(10 + 128, 10 + 192);
              var _tfAmtBig = BigInt(_tfAmtHex);
              var _tfDec    = 18;
              var _tfSymResolved = null;
              try {
                var _tfContractLow = (txParams.to||'').toLowerCase();
                // Layer 1: user's saved TOKEN_CONFIG
                var _tfSavedToks = (typeof TOKEN_CONFIG !== 'undefined') ? TOKEN_CONFIG : [];
                var _tfSavedMeta = _tfSavedToks.find(function(t){
                  return (t.contract||t.address||'').toLowerCase() === _tfContractLow;
                });
                if (_tfSavedMeta && _tfSavedMeta.decimals != null) {
                  _tfDec = parseInt(_tfSavedMeta.decimals);
                  _tfSymResolved = _tfSavedMeta.sub || _tfSavedMeta.symbol || _tfSavedMeta.sym || null;
                } else {
                  // Layer 2: PAIR_DEFAULT_TOKENS
                  var _tfPairMeta = PAIR_DEFAULT_TOKENS.find(function(t){
                    return t.addr.toLowerCase() === _tfContractLow;
                  });
                  if (_tfPairMeta && _tfPairMeta.decimals != null) {
                    _tfDec = parseInt(_tfPairMeta.decimals);
                    _tfSymResolved = _tfPairMeta.sym || null;
                  } else if (typeof fetchTokenInfo === 'function') {
                    // Layer 3: async on-chain decimals() call
                    var _tfOnChain = await fetchTokenInfo(txParams.to).catch(function(){ return null; });
                    if (_tfOnChain && _tfOnChain.decimals != null) {
                      _tfDec = parseInt(_tfOnChain.decimals);
                      _tfSymResolved = _tfOnChain.sym || null;
                    }
                  }
                }
              } catch(_) {}
              var _tfDiv    = BigInt(10) ** BigInt(_tfDec);
              var _tfWhole  = _tfAmtBig / _tfDiv;
              var _tfFrac   = (_tfAmtBig % _tfDiv).toString().padStart(_tfDec, '0').slice(0,6).replace(/0+$/,'');
              var _MAX_UINT256b = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
              var _tfAmt    = (_tfAmtBig >= _MAX_UINT256b)
                ? 'Unlimited ∞'
                : (_tfWhole.toString() + (_tfFrac ? '.' + _tfFrac : ''));
              var _tfSym    = _tfSymResolved ? _tfSymResolved : (txParams.to ? 'Token·' + txParams.to.slice(-4) : 'Token');
              _erc20Info = {
                type:      'ERC-20 TransferFrom',
                recipient: _tfTo,
                recipientShort: _tfTo.slice(0,8) + '...' + _tfTo.slice(-6),
                amount:    _tfAmt,
                symbol:    _tfSym,
                decimals:  _tfDec,
                contract:  txParams.to || ''
              };
            }
          }
        } catch(_e2) { _erc20Info = null; }

        // ── Determine gas badge for modal ──
        // Base (8453) + paymaster enabled → sponsored; else OneGas mode label
        var _isBaseChain   = (chainId === 8453);
        var _pmEnabled     = (function() {
          try { return isPaymasterEnabled(); } catch(_) { return false; }
        })();
        var _willSponsor   = _isBaseChain && _pmEnabled;
        // Note: actual sponsor attempt also checks isDelegated() at execution time.
        // Modal badge shows "Checking..." for Base+paymaster; updated after delegation check.
        var _gasBadgeLabel = _willSponsor
          ? '⏳ Sponsors tnx'
          : (window.OneGasMode === 'legacy' ? '⛽ Legacy Gas'
            : window.OneGasMode === 'eip1559' ? '⚡ EIP-1559'
            : '⚡ Auto Gas (OneGas)');
        var _gasBadgeColor = _willSponsor ? 'var(--accent-green)' : 'var(--accent-amber)';

        // ── Known DeFi selectors (for unknown-tx Action display) ──────────
        var KNOWN_SELECTORS = {
          // ── WETH / Wrapping ──────────────────────────────────────────────────
          '0xd0e30db0': { name: 'deposit()', desc: 'Wrap ETH → WETH' },
          '0x2e1a7d4d': { name: 'withdraw(uint256)', desc: 'Unwrap WETH → ETH' },

          // ── Multicall ────────────────────────────────────────────────────────
          '0xac9650d8': { name: 'multicall(bytes[])', desc: 'Multicall' },
          '0x3593564c': { name: 'execute(bytes,bytes[],uint256)', desc: 'Uniswap Universal Router' },
          '0x12aa3caf': { name: 'swap()', desc: '1inch Swap' },

          // ── ERC-20 ──────────────────────────────────────────────────────────
          '0xa9059cbb': { name: 'transfer(address,uint256)', desc: 'ERC-20 Transfer' },
          '0x095ea7b3': { name: 'approve(address,uint256)', desc: 'ERC-20 Approve' },
          '0x23b872dd': { name: 'transferFrom(address,address,uint256)', desc: 'ERC-20 TransferFrom' },
          '0x40c10f19': { name: 'mint(address,uint256)', desc: 'ERC-20 Mint' },
          '0x42966c68': { name: 'burn(uint256)', desc: 'ERC-20 Burn' },
          '0x79cc6790': { name: 'burnFrom(address,uint256)', desc: 'ERC-20 BurnFrom' },
          '0xa457c2d7': { name: 'decreaseAllowance(address,uint256)', desc: 'ERC-20 Decrease Allowance' },
          '0xd505accf': { name: 'permit(address,address,uint256,uint256,uint8,bytes32,bytes32)', desc: 'EIP-2612 Permit' },
          '0x8fcbaf0c': { name: 'permit(address,address,uint256,uint256,bool,uint8,bytes32,bytes32)', desc: 'DAI-Style Permit' },
          '0x3644e515': { name: 'DOMAIN_SEPARATOR()', desc: 'EIP-712 Domain Separator' },

          // ── ERC-721 NFT ──────────────────────────────────────────────────────
          '0x42842e0e': { name: 'safeTransferFrom(address,address,uint256)', desc: 'NFT Safe Transfer' },
          '0xb88d4fde': { name: 'safeTransferFrom(address,address,uint256,bytes)', desc: 'NFT Safe Transfer + Data' },
          '0xa22cb465': { name: 'setApprovalForAll(address,bool)', desc: 'NFT Set Approval For All' },
          '0x6352211e': { name: 'ownerOf(uint256)', desc: 'NFT Owner Of' },
          '0xc87b56dd': { name: 'tokenURI(uint256)', desc: 'NFT Token URI' },
          '0x40d097c3': { name: 'mintTo(address)', desc: 'NFT Mint To' },
          '0x1249c58b': { name: 'mint()', desc: 'NFT Mint' },
          '0xd0def521': { name: 'mint(address,string)', desc: 'NFT Mint with URI' },
          '0xe985e9c5': { name: 'isApprovedForAll(address,address)', desc: 'NFT Is Approved For All' },

          // ── ERC-1155 Multi-Token ─────────────────────────────────────────────
          '0xf242432a': { name: 'safeTransferFrom(address,address,uint256,uint256,bytes)', desc: 'ERC-1155 Transfer' },
          '0x2eb2c2d6': { name: 'safeBatchTransferFrom(address,address,uint256[],uint256[],bytes)', desc: 'ERC-1155 Batch Transfer' },

          // ── Uniswap V2 ──────────────────────────────────────────────────────
          '0x18cbafe5': { name: 'swapExactTokensForETH(uint256,uint256,address[],address,uint256)', desc: 'Uniswap V2 Swap Tokens→ETH' },
          '0x7ff36ab5': { name: 'swapExactETHForTokens(uint256,address[],address,uint256)', desc: 'Uniswap V2 Swap ETH→Tokens' },
          '0x38ed1739': { name: 'swapExactTokensForTokens(uint256,uint256,address[],address,uint256)', desc: 'Uniswap V2 Swap Tokens→Tokens' },
          '0xfb3bdb41': { name: 'swapETHForExactTokens(uint256,address[],address,uint256)', desc: 'Uniswap V2 ETH→Exact Tokens' },
          '0x8803dbee': { name: 'swapTokensForExactTokens(uint256,uint256,address[],address,uint256)', desc: 'Uniswap V2 Tokens→Exact Tokens' },
          '0x4a25d94a': { name: 'swapTokensForExactETH(uint256,uint256,address[],address,uint256)', desc: 'Uniswap V2 Tokens→Exact ETH' },
          '0x791ac947': { name: 'swapExactTokensForETHSupportingFeeOnTransferTokens(...)', desc: 'Uniswap V2 Fee-Token→ETH' },
          '0xb6f9de95': { name: 'swapExactETHForTokensSupportingFeeOnTransferTokens(...)', desc: 'Uniswap V2 ETH→Fee-Token' },
          '0xe8e33700': { name: 'addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256)', desc: 'Uniswap V2 Add Liquidity' },
          '0xf305d719': { name: 'addLiquidityETH(address,uint256,uint256,uint256,address,uint256)', desc: 'Uniswap V2 Add Liquidity ETH' },
          '0xbaa2abde': { name: 'removeLiquidity(address,address,uint256,uint256,uint256,address,uint256)', desc: 'Uniswap V2 Remove Liquidity' },
          '0x02751cec': { name: 'removeLiquidityETH(address,uint256,uint256,uint256,address,uint256)', desc: 'Uniswap V2 Remove Liquidity ETH' },
          '0xc9c65396': { name: 'createPair(address,address)', desc: 'Uniswap V2 Create Pair' },
          '0x022c0d9f': { name: 'swap(uint256,uint256,address,bytes)', desc: 'Uniswap V2 Pair Swap (low-level)' },

          // ── Uniswap V3 ──────────────────────────────────────────────────────
          '0x414bf389': { name: 'exactInputSingle(ExactInputSingleParams)', desc: 'Uniswap V3 Swap (Single Hop)' },
          '0xdb3e2198': { name: 'exactOutputSingle(ExactOutputSingleParams)', desc: 'Uniswap V3 Exact Output Single' },
          '0xc04b8d59': { name: 'exactInput(ExactInputParams)', desc: 'Uniswap V3 Swap (Multi Hop)' },
          '0xf28c0498': { name: 'exactOutput(ExactOutputParams)', desc: 'Uniswap V3 Exact Output Multi' },
          '0x88316456': { name: 'mint(MintParams)', desc: 'Uniswap V3 Add Liquidity (NFT)' },
          '0x49404b7c': { name: 'burn(uint256)', desc: 'Uniswap V3 Remove Position' },
          '0xfc6f7865': { name: 'collect(CollectParams)', desc: 'Uniswap V3 Collect Fees' },
          '0x219f5d17': { name: 'increaseLiquidity(IncreaseLiquidityParams)', desc: 'Uniswap V3 Increase Liquidity' },
          '0x0c49ccbe': { name: 'decreaseLiquidity(DecreaseLiquidityParams)', desc: 'Uniswap V3 Decrease Liquidity' },

          // ── AAVE V2/V3 ──────────────────────────────────────────────────────
          '0x2b4ac574': { name: 'supply()', desc: 'Aave Supply' },
          '0xe8eda9df': { name: 'deposit(address,uint256,address,uint16)', desc: 'Aave V2 Deposit' },
          '0x617ba037': { name: 'supply(address,uint256,address,uint16)', desc: 'Aave V3 Supply' },
          '0x69328dec': { name: 'withdraw(address,uint256,address)', desc: 'Aave Withdraw' },
          '0xa415bcad': { name: 'borrow(address,uint256,uint256,uint16,address)', desc: 'Aave Borrow' },
          '0x573ade81': { name: 'repay(address,uint256,uint256,address)', desc: 'Aave Repay' },
          '0x1c0c4e9b': { name: 'repayWithPermit(...)', desc: 'Aave Repay with Permit' },
          '0x02c205f0': { name: 'repayWithATokens(address,uint256,uint256)', desc: 'Aave Repay with aTokens' },
          '0xfca126ab': { name: 'swapBorrowRateMode(address,uint256)', desc: 'Aave Swap Borrow Rate' },
          '0x94ba89a2': { name: 'setUserUseReserveAsCollateral(address,bool)', desc: 'Aave Set Collateral' },
          '0xab9c4b5d': { name: 'flashLoan(address,address[],uint256[],uint256[],address,bytes,uint16)', desc: 'Aave Flash Loan' },
          '0x42b0b77c': { name: 'flashLoanSimple(address,address,uint256,bytes,uint16)', desc: 'Aave Flash Loan Simple' },
          '0xd65dc7a1': { name: 'claimAllRewards(address[],address)', desc: 'Aave Claim All Rewards' },

          // ── Compound V2/V3 ──────────────────────────────────────────────────
          '0xa0712d68': { name: 'mint(uint256)', desc: 'Compound V2 Supply (mint cToken)' },
          '0xdb006a75': { name: 'redeem(uint256)', desc: 'Compound V2 Withdraw' },
          '0x852a12e3': { name: 'redeemUnderlying(uint256)', desc: 'Compound V2 Redeem Underlying' },
          '0xc5ebeaec': { name: 'borrow(uint256)', desc: 'Compound V2 Borrow' },
          '0x0e752702': { name: 'repayBorrow(uint256)', desc: 'Compound V2 Repay' },
          '0x4e71d92d': { name: 'claim()', desc: 'Claim Rewards' },
          '0x372500ab': { name: 'claimRewards()', desc: 'Claim Rewards' },
          '0xb6b55f25': { name: 'deposit(uint256)', desc: 'Deposit to Vault/Pool' },
          '0x1249c58b': { name: 'mint()', desc: 'Compound V3 Supply ETH' },
          '0xe6aa216c': { name: 'supply(address,uint256)', desc: 'Compound V3 Supply' },
          '0xf3fef3a3': { name: 'withdraw(address,uint256)', desc: 'Compound V3 Withdraw' },

          // ── Curve Finance ────────────────────────────────────────────────────
          '0x3df02124': { name: 'exchange(int128,int128,uint256,uint256)', desc: 'Curve Swap' },
          '0xa6417ed6': { name: 'exchange_underlying(int128,int128,uint256,uint256)', desc: 'Curve Swap Underlying' },
          '0x0b4c7e4d': { name: 'add_liquidity(uint256[2],uint256)', desc: 'Curve Add Liquidity (2-pool)' },
          '0x4515cef3': { name: 'add_liquidity(uint256[3],uint256)', desc: 'Curve Add Liquidity (3-pool)' },
          '0x029b2f34': { name: 'add_liquidity(uint256[4],uint256)', desc: 'Curve Add Liquidity (4-pool)' },
          '0x1a4d01d2': { name: 'remove_liquidity_one_coin(uint256,int128,uint256)', desc: 'Curve Remove One Coin' },
          '0x5b36389c': { name: 'remove_liquidity(uint256,uint256[2])', desc: 'Curve Remove Liquidity' },

          // ── OpenSea / NFT Marketplace ────────────────────────────────────────
          '0xfb0f3ee1': { name: 'fulfillBasicOrder(BasicOrderParameters)', desc: 'OpenSea Buy NFT (Basic)' },
          '0xb3a34c4c': { name: 'fulfillOrder(Order,bytes32)', desc: 'OpenSea Fulfill Order' },
          '0xed98a574': { name: 'fulfillAvailableAdvancedOrders(...)', desc: 'OpenSea Fulfill Multiple Orders' },
          '0xe7acab24': { name: 'fulfillAdvancedOrder(...)', desc: 'OpenSea Advanced Order' },
          '0xf2d12b12': { name: 'cancel(OrderComponents[])', desc: 'OpenSea Cancel Order' },
          '0x06fdde03': { name: 'name()', desc: 'ERC-20 Token Name' },

          // ── 1inch ─────────────────────────────────────────────────────────────
          '0x7c025200': { name: 'swap(IAggregationExecutor,SwapDescription,bytes)', desc: '1inch Aggregation Swap' },
          '0xe449022e': { name: 'uniswapV3Swap(uint256,uint256,uint256[])', desc: '1inch V3 Route Swap' },
          '0x2e95b6c8': { name: 'unoswap(address,uint256,uint256,bytes32[])', desc: '1inch Unoswap' },
          '0xa7bfb8f5': { name: 'fillOrderRFQ(...)', desc: '1inch Fill RFQ Order' },

          // ── Blur NFT Marketplace ──────────────────────────────────────────────
          '0x9a1fc3a7': { name: 'execute(Input,Input)', desc: 'Blur Execute Order' },
          '0xb2e28f64': { name: 'bulkExecute(Execution[])', desc: 'Blur Bulk Execute' },
          '0x441a3e70': { name: 'withdraw(uint256)', desc: 'Blur Pool Withdraw ETH' },

          // ── LooksRare ─────────────────────────────────────────────────────────
          '0xb4e4b296': { name: 'executeTakerBid(TakerOrder,MakerOrder,...)', desc: 'LooksRare Taker Bid' },
          '0x38e29209': { name: 'executeTakerAsk(TakerOrder,MakerOrder,...)', desc: 'LooksRare Taker Ask' },
          '0x73e3d5ed': { name: 'claimRewards(bool)', desc: 'LooksRare Claim LOOKS Rewards' },

          // ── Zora / Creator NFT ────────────────────────────────────────────────
          '0x731133e9': { name: 'mint(address,uint256,uint256,bytes)', desc: 'Zora ERC-1155 Mint' },
          '0x45f7a80b': { name: 'mintWithRewards(address,uint256,uint256,bytes,address)', desc: 'Zora Mint with Rewards' },
          '0x84bb1e42': { name: 'purchase(uint256)', desc: 'Zora / Edition Purchase' },
          '0x26092b83': { name: 'mint(address)', desc: 'NFT Free Mint (Edition)' },
          '0x30176e13': { name: 'setContractURI(string)', desc: 'Set NFT Contract URI' },

          // ── Superfluid ────────────────────────────────────────────────────────
          '0x2c7c3b53': { name: 'createFlow(address,address,int96,bytes)', desc: 'Superfluid Create Stream' },
          '0x5b2f8507': { name: 'updateFlow(address,address,int96,bytes)', desc: 'Superfluid Update Stream' },
          '0xb4b333c6': { name: 'deleteFlow(address,address,bytes)', desc: 'Superfluid Delete Stream' },
          '0x73df2397': { name: 'upgrade(uint256)', desc: 'Superfluid Wrap to Super Token' },
          '0xe3f4d117': { name: 'downgrade(uint256)', desc: 'Superfluid Unwrap from Super Token' },

          // ── Sablier Stream ────────────────────────────────────────────────────
          '0x33e52a5a': { name: 'createWithTimestamps(CreateWithTimestamps)', desc: 'Sablier Create Stream' },
          '0x44e6a8e6': { name: 'createWithDurations(CreateWithDurations)', desc: 'Sablier Create Stream (Duration)' },
          '0xf3e13844': { name: 'cancel(uint256)', desc: 'Sablier Cancel Stream' },
          '0xbd4b7338': { name: 'withdraw(uint256,address,uint128)', desc: 'Sablier Withdraw from Stream' },

          // ── Wormhole / Axelar Bridge ──────────────────────────────────────────
          '0xc68785ef': { name: 'transferTokens(address,uint256,uint16,bytes32,uint256,uint32)', desc: 'Wormhole Transfer Tokens' },
          '0xcbdcc634': { name: 'completeTransfer(bytes)', desc: 'Wormhole Complete Transfer' },
          '0x96f4e9f9': { name: 'sendToken(string,string,address,uint256)', desc: 'Axelar Send Token' },

          // ── Stargate Bridge ───────────────────────────────────────────────────
          '0x8731cbf6': { name: 'swap(uint16,uint256,uint256,address,(uint256,uint256),address,bytes)', desc: 'Stargate Bridge Swap' },
          '0xf7d78bd1': { name: 'addLiquidity(uint256,uint256,address)', desc: 'Stargate Add Liquidity' },
          '0xf9cfbb6b': { name: 'instantRedeemLocal(uint16,uint256,address)', desc: 'Stargate Instant Redeem' },

          // ── Hop Protocol ─────────────────────────────────────────────────────
          '0xdeace8f5': { name: 'swapAndSend(uint256,address,uint256,uint256,uint256,uint256,uint256)', desc: 'Hop Bridge Swap+Send' },
          '0x90d25074': { name: 'send(uint256,address,uint256,uint256,uint256)', desc: 'Hop Bridge Send' },

          // ── Optimism / Arbitrum Bridge ────────────────────────────────────────
          '0x49c2a1a6': { name: 'depositERC20(address,address,uint256,uint32,bytes)', desc: 'Optimism L1 ERC-20 Deposit' },
          '0x32b7006d': { name: 'depositERC20To(address,address,address,uint256,uint32,bytes)', desc: 'Optimism ERC-20 Deposit To' },
          '0x4fb1a07b': { name: 'depositETH(uint32,bytes)', desc: 'Optimism Deposit ETH' },
          '0x2d67b4ce': { name: 'outboundTransfer(address,address,uint256,uint256,uint256,bytes)', desc: 'Arbitrum L1→L2 Transfer' },

          // ── zkSync / L2 Bridge ────────────────────────────────────────────────
          '0xeb672419': { name: 'requestL2Transaction(address,uint256,bytes,uint256,uint256,bytes[],address)', desc: 'zkSync Request L2 TX' },
          '0x6c0960f9': { name: 'deposit(address,address,uint256,uint256,address)', desc: 'zkSync L1→L2 Deposit' },

          // ── Polygon Bridge ────────────────────────────────────────────────────
          '0x58274156': { name: 'depositEtherFor(address)', desc: 'Polygon Bridge Deposit ETH' },
          '0x6a8ee2b8': { name: 'depositFor(address,address,bytes)', desc: 'Polygon Bridge Deposit Token' },
          '0x3805550f': { name: 'exit(bytes)', desc: 'Polygon Bridge Exit (Withdraw)' },

          // ── Chainlink Automation ──────────────────────────────────────────────
          '0x6e04ff0d': { name: 'performUpkeep(bytes)', desc: 'Chainlink Automation Perform Upkeep' },
          '0xaf953a7a': { name: 'registerUpkeep(address,uint32,address,bytes,bytes)', desc: 'Chainlink Register Upkeep' },
          '0x6cc6cde1': { name: 'addFunds(uint256,uint96)', desc: 'Chainlink Upkeep Add Funds' },

          // ── ERC-6551 Token Bound Accounts ─────────────────────────────────────
          '0x8a54c52f': { name: 'createAccount(address,uint256,uint256,address,uint256)', desc: 'ERC-6551 Create Token Bound Account' },
          '0x29d3d6b4': { name: 'execute(address,uint256,bytes,uint8)', desc: 'ERC-6551 Account Execute' },

          // ── Safe{Wallet} Modules ──────────────────────────────────────────────
          '0x610b5925': { name: 'enableModule(address)', desc: 'Safe Enable Module' },
          '0xe009cfde': { name: 'disableModule(address,address)', desc: 'Safe Disable Module' },

          // ── CoW Protocol ─────────────────────────────────────────────────────
          '0x13d79a0b': { name: 'setPreSignature(bytes,bool)', desc: 'CoW Protocol Pre-Sign Order' },
          '0xed49049b': { name: 'invalidateOrder(bytes)', desc: 'CoW Protocol Invalidate Order' },

          // ── Paraswap ─────────────────────────────────────────────────────────
          '0xa94e78ef': { name: 'megaSwap(MegaSwapSellData)', desc: 'ParaSwap Mega Swap' },
          '0x54840d1a': { name: 'multiSwap(SellData)', desc: 'ParaSwap Multi Swap' },
          '0x0b86a4c1': { name: 'swapOnUniswap(uint256,uint256,address[])', desc: 'ParaSwap via Uniswap' },

          // ── Synthetix ─────────────────────────────────────────────────────────
          '0x44a3d9e7': { name: 'exchange(bytes32,uint256,bytes32)', desc: 'Synthetix Exchange Synths' },
          '0x4f8794ac': { name: 'issueMaxSynths()', desc: 'Synthetix Issue Max sUSD' },
          '0x7e64c8b0': { name: 'burnSynths(uint256)', desc: 'Synthetix Burn sUSD' },
          '0xa7fce9dc': { name: 'getReward()', desc: 'Synthetix Claim Staking Fees' },

          // ── Uniswap X / Dutch Auction ─────────────────────────────────────────
          '0x3df021f4': { name: 'execute(SignedOrder)', desc: 'UniswapX Execute Order' },
          '0x4fe02b44': { name: 'executeBatch(SignedOrder[])', desc: 'UniswapX Execute Batch Orders' },
          '0x8d800d6b': { name: 'fill(Order,bytes,bytes)', desc: '0x Protocol Fill Order' },
          '0x415565b0': { name: 'transformERC20(address,address,uint256,uint256,Transformation[])', desc: '0x Transform ERC-20 (Swap)' },

          // ── Token Utils ───────────────────────────────────────────────────────
          '0x95d89b41': { name: 'symbol()', desc: 'ERC-20 Token Symbol' },
          '0x18160ddd': { name: 'totalSupply()', desc: 'ERC-20 Total Supply' },
          '0x70a08231': { name: 'balanceOf(address)', desc: 'ERC-20 Balance Of' },
          '0xdd62ed3e': { name: 'allowance(address,address)', desc: 'ERC-20 Allowance' },
          '0x08c379a0': { name: 'Error(string)', desc: 'Solidity Revert with Message' },
          '0x12210e8a': { name: 'refundETH()', desc: 'Refund Unused ETH' },
          '0x49616997': { name: 'selfPermit(address,uint256,uint256,uint8,bytes32,bytes32)', desc: 'Self-Permit (Uniswap Router)' },

          // ── Deployer / Factory ────────────────────────────────────────────────
          '0x485cc955': { name: 'initialize(address,address)', desc: 'Proxy Initialize (2-param)' },
          '0x1688f0b9': { name: 'createProxyWithCallback(address,bytes,uint256,address)', desc: 'Safe Proxy Factory Create' },
          '0x61b69abd': { name: 'createProxyWithNonce(address,bytes,uint256)', desc: 'Safe Proxy Factory (Nonce)' },
          '0x600b0da7': { name: 'deploy(bytes32,address,bytes)', desc: 'Factory Deploy Contract' },
          '0x60806040': { name: '(constructor)', desc: 'Contract Deploy (CREATE)' },
          '0x3d602d80': { name: '(minimal proxy)', desc: 'EIP-1167 Clone Deploy' },

          // ── Balancer V2 ───────────────────────────────────────────────────────
          '0x945bcec9': { name: 'batchSwap(uint8,SwapStep[],...)', desc: 'Balancer Batch Swap' },
          '0x52bbbe29': { name: 'swap(SingleSwap,FundManagement,uint256,uint256)', desc: 'Balancer Single Swap' },
          '0xb95cac28': { name: 'joinPool(bytes32,address,address,JoinPoolRequest)', desc: 'Balancer Join Pool' },
          '0x8bdb3913': { name: 'exitPool(bytes32,address,address,ExitPoolRequest)', desc: 'Balancer Exit Pool' },
          '0xfa6e671d': { name: 'flashLoan(address,address[],uint256[],bytes)', desc: 'Balancer Flash Loan' },

          // ── Staking & Farming ─────────────────────────────────────────────────
          '0xa694fc3a': { name: 'stake(uint256)', desc: 'Stake Tokens' },
          '0x3d18b912': { name: 'getReward()', desc: 'Claim Staking Reward' },
          '0xe9fad8ee': { name: 'exit()', desc: 'Exit Staking (Withdraw + Claim)' },
          '0x1c4b774b': { name: 'depositAll()', desc: 'Deposit All Tokens' },
          '0x853828b6': { name: 'withdrawAll()', desc: 'Withdraw All Tokens' },

          // ── Vote Locking / veToken ─────────────────────────────────────────────
          '0x5ea3df41': { name: 'create_lock(uint256,uint256)', desc: 'Create veToken Lock' },
          '0x65fc3873': { name: 'increase_amount(uint256)', desc: 'Increase Lock Amount' },
          '0x488670be': { name: 'increase_unlock_time(uint256)', desc: 'Extend Lock Time' },
          '0xd2946c2b': { name: 'checkpoint()', desc: 'Checkpoint Gauge' },

          // ── Convex ─────────────────────────────────────────────────────────────
          '0x43a0d066': { name: 'deposit(uint256,bool)', desc: 'Convex Deposit' },
          '0x600a4a87': { name: 'depositAll(bool)', desc: 'Convex Deposit All' },
          '0x27c0bdac': { name: 'earmarkRewards(uint256)', desc: 'Convex Earmark Rewards' },
          '0x7050ccd9': { name: 'getReward(address,bool)', desc: 'Convex Get Reward' },

          // ── Velodrome / Aerodrome ─────────────────────────────────────────────
          '0x6571d6be': { name: 'vote(uint256,address[],uint256[])', desc: 'Velodrome Vote' },
          '0xbe4a2abd': { name: 'claimBribes(address[],address[][],uint256)', desc: 'Velodrome Claim Bribes' },

          // ── Governance / DAO ──────────────────────────────────────────────────
          '0x56781388': { name: 'castVote(uint256,uint8)', desc: 'DAO Cast Vote' },
          '0x7d5e81e2': { name: 'propose(address[],uint256[],bytes[],string)', desc: 'DAO Create Proposal' },
          '0x379607f5': { name: 'queue(uint256)', desc: 'DAO Queue Proposal' },
          '0x15373e3d': { name: 'cancel(uint256)', desc: 'DAO Cancel Proposal' },
          '0x9c19cb43': { name: 'delegateBySig(address,uint256,uint256,uint8,bytes32,bytes32)', desc: 'Delegate Votes by Signature' },

          // ── Lido / Liquid Staking ─────────────────────────────────────────────
          '0xa1903eab': { name: 'submit(address)', desc: 'Lido Stake ETH → stETH' },
          '0xf69e2046': { name: 'wrap(uint256)', desc: 'Lido Wrap stETH → wstETH' },
          '0xde0e9a3e': { name: 'unwrap(uint256)', desc: 'Lido Unwrap wstETH → stETH' },
          '0x19aa6257': { name: 'requestWithdrawals(uint256[],address)', desc: 'Lido Request ETH Withdrawal' },
          '0xe3afe0a3': { name: 'claimWithdrawals(uint256[],uint256[])', desc: 'Lido Claim ETH Withdrawal' },

          // ── ENS ───────────────────────────────────────────────────────────────
          '0xd5fa2b00': { name: 'setAddr(bytes32,address)', desc: 'ENS Set Address Record' },
          '0x10f13a8c': { name: 'setText(bytes32,string,string)', desc: 'ENS Set Text Record' },
          '0x16a25cbd': { name: 'commit(bytes32)', desc: 'ENS Register Commit' },
          '0x85f6d155': { name: 'register(string,address,uint256,bytes32,...)', desc: 'ENS Register Name' },
          '0xacf1a841': { name: 'renew(string,uint256)', desc: 'ENS Renew Name' },
          '0x1896f70a': { name: 'setResolver(bytes32,address)', desc: 'ENS Set Resolver' },

          // ── Permit2 ───────────────────────────────────────────────────────────
          '0x2b67b570': { name: 'permit(address,PermitSingle,bytes)', desc: 'Permit2 Single Permit' },
          '0x2a2d80d1': { name: 'permit(address,PermitBatch,bytes)', desc: 'Permit2 Batch Permit' },
          '0x36c78516': { name: 'transferFrom(address,address,uint160,address)', desc: 'Permit2 Transfer From' },
          '0x137c29fe': { name: 'permitTransferFrom(PermitTransferFrom,SignatureTransferDetails,address,bytes)', desc: 'Permit2 Permit Transfer' },

          // ── MakerDAO / DAI ────────────────────────────────────────────────────
          '0x9f678cca': { name: 'frob(bytes32,address,address,address,int256,int256)', desc: 'MakerDAO Vault Frob' },
          '0x1b0e34d3': { name: 'open(bytes32,address)', desc: 'MakerDAO Open Vault' },

          // ── GMX / Perps ───────────────────────────────────────────────────────
          '0xe3274d3a': { name: 'createIncreasePosition(...)', desc: 'GMX Open Position' },
          '0x7be7d141': { name: 'createDecreasePosition(...)', desc: 'GMX Close Position' },

          // ── Access Control / Admin ────────────────────────────────────────────
          '0xf2fde38b': { name: 'transferOwnership(address)', desc: 'Transfer Contract Ownership' },
          '0x715018a6': { name: 'renounceOwnership()', desc: 'Renounce Ownership' },
          '0x2f2ff15d': { name: 'grantRole(bytes32,address)', desc: 'Grant Role' },
          '0xd547741f': { name: 'revokeRole(bytes32,address)', desc: 'Revoke Role' },
          '0x8456cb59': { name: 'pause()', desc: 'Pause Contract' },
          '0x3f4ba83a': { name: 'unpause()', desc: 'Unpause Contract' },

          // ── Proxy / Upgrades ──────────────────────────────────────────────────
          '0x3659cfe6': { name: 'upgradeTo(address)', desc: 'Upgrade Proxy Implementation' },
          '0x4f1ef286': { name: 'upgradeToAndCall(address,bytes)', desc: 'Upgrade Proxy + Init Call' },
          '0x8f283970': { name: 'changeAdmin(address)', desc: 'Change Proxy Admin' },

          // ── Flash Loans ───────────────────────────────────────────────────────
          '0x5cffe9de': { name: 'flash(address,uint256,uint256,bytes)', desc: 'Uniswap V3 Flash Loan' },
          '0x490a32c6': { name: 'flashBorrow(address,uint256)', desc: 'Flash Borrow' },

          // ── Ribbon / Options ──────────────────────────────────────────────────
          '0xde8d3d69': { name: 'depositFor(address)', desc: 'Ribbon Vault Deposit For' },
          '0x6e2c45d7': { name: 'initiateWithdraw(uint256)', desc: 'Ribbon Initiate Withdrawal' },
          '0x7a9f96cd': { name: 'completeWithdraw()', desc: 'Ribbon Complete Withdrawal' },
          '0xfbcea3a1': { name: 'claimRbn(uint256,address)', desc: 'Ribbon Claim RBN Rewards' },
          '0x27a14fc2': { name: 'exercise(uint256,uint256,bool)', desc: 'Options Exercise' },
          '0xcc9d0740': { name: 'settleExpiredOptions(uint256)', desc: 'Settle Expired Options' },

          // ── Gnosis Bridge ─────────────────────────────────────────────────────
          '0x01e4f53a': { name: 'relayTokens(address,address,uint256)', desc: 'Gnosis Bridge Relay Tokens' },
          '0x8b532f13': { name: 'relayTokensAndCall(address,address,uint256,bytes)', desc: 'Gnosis Bridge Relay + Call' },

          // ── The Graph ─────────────────────────────────────────────────────────
          '0x026e402b': { name: 'stake(address,uint256)', desc: 'Graph Protocol Stake GRT' },
          '0x4d99dd16': { name: 'unstake(address,uint256)', desc: 'Graph Protocol Unstake GRT' },
          '0x5a98a7a0': { name: 'allocate(address,bytes32,uint256,address,bytes,bytes)', desc: 'Graph Allocate to Subgraph' },
          '0x7018b5b8': { name: 'closeAllocation(address,bytes32)', desc: 'Graph Close Allocation' },
          '0xa2594d82': { name: 'withdraw()', desc: 'Graph Withdraw Thawing Stake' },

          // ── ERC-4626 Tokenised Vault ──────────────────────────────────────────
          '0x6e553f65': { name: 'deposit(uint256,address)', desc: 'ERC-4626 Vault Deposit' },
          '0xba087652': { name: 'mint(uint256,address)', desc: 'ERC-4626 Mint Shares' },
          '0xb460af94': { name: 'withdraw(uint256,address,address)', desc: 'ERC-4626 Withdraw Assets' },
          '0x4cdad506': { name: 'redeem(uint256,address,address)', desc: 'ERC-4626 Redeem Shares' },

          // ── Uniswap V4 / Universal Router extras ─────────────────────────────
          '0x24856bc3': { name: 'execute(bytes,bytes[])', desc: 'Uniswap Universal Router (no deadline)' },
          '0x13ead562': { name: 'createAndInitializePoolIfNecessary(...)', desc: 'Uniswap V3/V4 Create Pool' },

          // ── 1inch extra selectors ─────────────────────────────────────────────
          '0xf78dc253': { name: 'clipperSwap(...)', desc: '1inch Clipper Swap' },
          '0x62e238bb': { name: 'fillOrderRFQ(...)', desc: '1inch RFQ Order Fill' },

          // ── Compound V3 / Comet ───────────────────────────────────────────────
          '0xf2b9fdb8': { name: 'supply(address,uint256)', desc: 'Compound V3 (Comet) Supply' },
          '0xd5eed868': { name: 'setUserEMode(uint8)', desc: 'Aave V3 Set E-Mode' },

          // ── Curve extra ───────────────────────────────────────────────────────
          '0xecb586a5': { name: 'exchange_multiple(address[9],uint256[3][4],uint256,uint256)', desc: 'Curve Multi-hop Swap' },

          // ── Multicall3 ────────────────────────────────────────────────────────
          '0x252dba42': { name: 'aggregate(Call[])', desc: 'Multicall3 Aggregate' },
          '0x82ad56cb': { name: 'tryAggregate(bool,Call[])', desc: 'Multicall3 Try Aggregate' },
          '0x174dea71': { name: 'aggregate3(Call3[])', desc: 'Multicall3 Aggregate3' },

          // ── Gnosis Safe ───────────────────────────────────────────────────────
          '0x6a761202': { name: 'execTransaction(address,uint256,bytes,uint8,...)', desc: 'Safe Execute Transaction' },
          '0xe318b52b': { name: 'addOwnerWithThreshold(address,uint256)', desc: 'Safe Add Owner' },
          '0xf8dc5dd9': { name: 'removeOwner(address,address,uint256)', desc: 'Safe Remove Owner' },
          '0xd4d9bdcd': { name: 'approveHash(bytes32)', desc: 'Safe Approve Hash' },
          '0x7de7edef': { name: 'changeSingletonTo(address)', desc: 'Safe Change Singleton' },

          // ── EIP-7702 / Account Abstraction ────────────────────────────────────
          '0x34fcd5be': { name: 'executeBatch(Call[])', desc: 'EIP-7702 Batch Execute' },
          '0xb61d27f6': { name: 'execute(address,uint256,bytes)', desc: 'AA Execute Single Call' },
          '0x18dfb3c7': { name: 'executeBatch(address[],bytes[])', desc: 'AA Batch Execute' },
          '0x9b249f69': { name: 'handleOps(UserOperation[],address)', desc: 'EntryPoint Handle User Ops' },
          '0x0396cb60': { name: 'addStake(uint32)', desc: 'EntryPoint Add Stake' },

          // ── General / Utility ─────────────────────────────────────────────────
          '0x5c975abb': { name: 'paused()', desc: 'Check Paused State' },
          '0x01ffc9a7': { name: 'supportsInterface(bytes4)', desc: 'ERC-165 Supports Interface' },
          '0x8129fc1c': { name: 'initialize()', desc: 'Initialize Contract' },
          '0xc6c3bbe6': { name: 'claimFees()', desc: 'Claim Protocol Fees' },
          '0x4782f779': { name: 'withdrawETH(address,uint256)', desc: 'Withdraw ETH' },
          '0xea598cb0': { name: 'wrap(uint256)', desc: 'Wrap Token' },
          '0x4e487b71': { name: 'Panic(uint256)', desc: 'Solidity Panic Error' },
          '0x4e718483': { name: 'CustomError()', desc: 'Custom Revert Error' },
          '0xc1059bf7': { name: 'multicallWithNodeInterface(...)', desc: 'Arbitrum Multicall (NodeInterface)' },
          '0xb7011e52': { name: 'sweepToken(address,uint256,address)', desc: 'Sweep ERC-20 Token' },
          '0xa4a78f0c': { name: 'selfPermitAllowed(address,uint256,uint256,uint8,bytes32,bytes32)', desc: 'Self-Permit Allowed (DAI-style)' },

          // ── Bridge extras ─────────────────────────────────────────────────────
          '0x09c5eabe': { name: 'deposit(address,address,uint256,uint32,bytes)', desc: 'Across Protocol Deposit' },
          '0x838cde38': { name: 'sendMessage(uint256,bytes,uint256)', desc: 'Cross-chain Message Send' },

          // ── Synthetix extras ──────────────────────────────────────────────────
          '0xae8b7739': { name: 'exchangeWithTracking(bytes32,uint256,bytes32,address,bytes32)', desc: 'Synthetix Exchange with Tracking' },
          '0x8e9b4c2f': { name: 'issueSynths(uint256)', desc: 'Synthetix Issue sUSD' },
          '0x6d3d7ccc': { name: 'liquidateDelinquentAccount(address)', desc: 'Synthetix Liquidate Account' },

          // ── ERC-6551 extras ───────────────────────────────────────────────────
          '0xd92d8efd': { name: 'account(address,uint256,uint256,address,uint256)', desc: 'ERC-6551 Get Account Address' },

          // ── Chainlink extra ───────────────────────────────────────────────────
          '0x744bfe61': { name: 'cancelUpkeep(uint256)', desc: 'Chainlink Cancel Upkeep' },
        };
        var _knownSel = null;
        if (hasData) {
          var _checkSel = txParams.data.slice(0,10).toLowerCase();
          _knownSel = KNOWN_SELECTORS[_checkSel] || null;
        }

        // ── Build modal rows based on tx type ──────────────────────────────────
        var _modalToRow, _modalAmountRow, _modalTypeRow = '';
        if (_erc20Info) {
          // ERC20: show decoded recipient, amount, token symbol, contract
          _modalToRow = '<div class="w3m-tx-row"><span class="w3m-tx-label">To</span><span class="w3m-tx-value">' + _escHtml(_erc20Info.recipientShort) + '</span></div>';
          _modalAmountRow = '<div class="w3m-tx-row"><span class="w3m-tx-label">Amount</span><span class="w3m-tx-value" style="color:#10b981;font-weight:700;">' + _escHtml(_erc20Info.amount + ' ' + _erc20Info.symbol) + '</span></div>';
          _modalTypeRow = '<div class="w3m-tx-row"><span class="w3m-tx-label">Type</span><span class="w3m-tx-value" style="color:#a78bfa;">' + _escHtml(_erc20Info.type) + '</span></div>' +
            '<div class="w3m-tx-row"><span class="w3m-tx-label">Contract</span><span class="w3m-tx-value">' + _escHtml(_erc20Info.contract ? _erc20Info.contract.slice(0,8)+'...'+_erc20Info.contract.slice(-6) : '?') + '</span></div>';
        } else {
          // Native ETH / generic contract tx
          _modalToRow = '<div class="w3m-tx-row"><span class="w3m-tx-label">To</span><span class="w3m-tx-value">' + _escHtml(toShort) + '</span></div>';
          // Only show Value row if ETH value is non-zero, OR if there is no calldata (pure ETH send)
          var _rawVal = txParams.value ? BigInt(txParams.value) : 0n;
          if (_rawVal > 0n || !hasData) {
            _modalAmountRow = '<div class="w3m-tx-row"><span class="w3m-tx-label">Value</span><span class="w3m-tx-value">' + _escHtml(valDisplay + ' ' + sym) + '</span></div>';
          } else {
            _modalAmountRow = ''; // 0 ETH + has calldata → hide redundant zero value row
          }
          // Action row: known selector name + desc, plus Contract address row
          if (hasData) {
            var _actionLabel = _knownSel
              ? _knownSel.name + ' — ' + _knownSel.desc
              : txParams.data.slice(0,10) + '... (unknown)';
            var _contractShort = txParams.to ? txParams.to.slice(0,8) + '...' + txParams.to.slice(-6) : '?';
            _modalTypeRow =
              '<div class="w3m-tx-row"><span class="w3m-tx-label">Action</span><span class="w3m-tx-value" style="color:#a78bfa;">' + _escHtml(_actionLabel) + '</span></div>' +
              '<div class="w3m-tx-row"><span class="w3m-tx-label">Contract</span><span class="w3m-tx-value">' + _escHtml(_contractShort) + '</span></div>';
          } else {
            _modalTypeRow = '';
          }
        }

        var _chainLogoUri  = _resolveChainLogoUri(chainId);
        var _chainEmoji4   = _resolveChainEmoji(chainId);
        var _chainBadgeImg = '<img src="' + _escHtml(_chainLogoUri) + '" width="14" height="14" ' +
          'style="border-radius:50%;object-fit:cover;flex-shrink:0;vertical-align:middle;" ' +
          'onerror="this.outerHTML=\'<span style=&quot;font-size:11px;line-height:1;&quot;>' + _chainEmoji4 + '</span>\'">';

        var bodyHtml4 = _W3M_BODY_STYLES +
          '<div class="w3m-network-badge">' + _chainBadgeImg + ' ' + _escHtml(chainName.toUpperCase()) + '</div>' +
          '<div class="w3m-section-title">TRANSACTION DETAILS</div>' +
          '<div class="w3m-address-box">' +
          '<div class="w3m-tx-row"><span class="w3m-tx-label">From</span><span class="w3m-tx-value" style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;">' +
            '<span style="color:#a78bfa;font-weight:700;">' + _escHtml(_getWalletLabelForAddress(fromAddr4) || '') + '</span>' +
            '<span>' + _escHtml(fromAddr4 ? fromAddr4.slice(0,8)+'...'+fromAddr4.slice(-6) : '?') + '</span>' +
          '</span></div>' +
          _modalToRow +
          _modalAmountRow +
          _modalTypeRow +
          '<div class="w3m-tx-row"><span class="w3m-tx-label">Gas</span><span class="w3m-tx-value" data-gas="1" style="color:' + _gasBadgeColor + ';font-weight:700;">' + _gasBadgeLabel + '</span></div>' +
          '</div>' +
          '<div class="w3m-warn-box"><div class="w3m-warn-icon">' + (_willSponsor ? '✨' : '⛽') + '</div>' +
          '<div class="w3m-warn-text">' + (_willSponsor
            ? 'Gas fee is sponsored by Coinbase Paymaster. This transaction is free on Base.'
            : 'This will send a transaction. OneGas will calculate optimal gas. This action cannot be undone.')
          + '</div></div>';

        var doSendTx = async function() {
          // ── Sync Java chain selector now (after user confirmed) — safe to call here
          // because the modal is already open/approved, no risk of re-triggering queue.
          try {
            var _syncChainObj = null;
            try {
              var _syncAll = (typeof getAllChains === 'function') ? getAllChains() : [];
              _syncChainObj = _syncAll.find(function(c){ return c.chainId === chainId; });
            } catch(_) {}
            var _syncName = (_syncChainObj && _syncChainObj.name) ? _syncChainObj.name : chainHex;
            if (typeof OneAndroid !== 'undefined') {
              if (OneAndroid.web3SwitchChain) OneAndroid.web3SwitchChain(chainHex, _syncName);
            }
          } catch(_) {}

          var rpcList = [];
          try { if (typeof _getRpcListForChain === 'function') rpcList = _getRpcListForChain(chainId); } catch(_) {}
          if (!rpcList || rpcList.length === 0) rpcList = [_getRpcForChain(chainId)];

          // ── Explorer URL: getTHExplorerTx covers 40+ chains + custom chains from config ──
          var _getExpUrl = function(cid, hash) {
            // 1. getTHExplorerTx — covers all chains including custom (getTHExplorer + /tx/)
            if (window.getTHExplorerTx) {
              try { return window.getTHExplorerTx(cid) + hash; } catch(_) {}
            }
            // 2. getExplorerUrl — bridge explorer map + getAllChains config
            if (typeof getExplorerUrl === 'function') {
              try { var u = getExplorerUrl(cid, hash); if (u) return u; } catch(_) {}
            }
            // 3. Inline fallback for the most common chains
            var _fb = {
              1:'https://etherscan.io/tx/', 8453:'https://basescan.org/tx/',
              42161:'https://arbiscan.io/tx/', 10:'https://optimistic.etherscan.io/tx/',
              137:'https://polygonscan.com/tx/', 56:'https://bscscan.com/tx/',
              43114:'https://snowtrace.io/tx/', 59144:'https://lineascan.build/tx/',
              534352:'https://scrollscan.com/tx/', 324:'https://explorer.zksync.io/tx/',
              5000:'https://explorer.mantle.xyz/tx/', 81457:'https://blastscan.io/tx/',
              34443:'https://explorer.mode.network/tx/', 7777777:'https://explorer.zora.energy/tx/',
              250:'https://ftmscan.com/tx/', 42220:'https://celoscan.io/tx/',
              100:'https://gnosisscan.io/tx/', 1101:'https://zkevm.polygonscan.com/tx/',
              57073:'https://explorer.inkonchain.com/tx/', 1284:'https://moonscan.io/tx/',
              25:'https://cronoscan.com/tx/', 1313161554:'https://explorer.aurora.dev/tx/',
              1329:'https://seitrace.com/tx/', 60808:'https://explorer.gobob.xyz/tx/',
              13371:'https://explorer.immutable.com/tx/'
            };
            return (_fb[cid] || 'https://etherscan.io/tx/') + hash;
          };

          // ══════════════════════════════════════════════════════
          // PATH A: Base chain + Paymaster enabled + EIP-7702 delegated → ERC-4337 UserOp
          //         Coinbase Paymaster sponsors the gas fee
          //         REQUIRES delegation: non-delegated EOA has no execute() → AA23
          // ══════════════════════════════════════════════════════
          if (_willSponsor) {
            // Check EIP-7702 delegation before attempting sponsorship
            // Non-delegated wallet → skip to PATH B immediately (avoids AA23 error + delay)
            var _isDel = false;
            try { _isDel = await isDelegated(fromAddr4); } catch(_) {}
            // Update modal gas badge based on delegation result
            try {
              var _gb = document.querySelector('#_one_tx_modal_overlay .w3m-tx-value[data-gas]');
              var _wb = document.querySelector('#_one_tx_modal_overlay .w3m-warn-text');
              if (_isDel) {
                if (_gb) { _gb.style.color = 'var(--accent-green)'; _gb.textContent = '✨ FREE · Coinbase Sponsored'; }
                if (_wb) _wb.textContent = 'Gas fee is sponsored by Coinbase Paymaster. This transaction is free on Base.';
              } else {
                if (_gb) { _gb.style.color = 'var(--accent-amber)'; _gb.textContent = '⚡ Auto Gas (OneGas)'; }
                if (_wb) { _wb.style.color = '#f59e0b'; _wb.textContent = 'Wallet not EIP-7702 delegated — gas fees apply. Delegate first to get free sponsored transactions.'; }
              }
            } catch(_) {}
            if (!_isDel) {
              console.log('[OneBrowser] Wallet not delegated — skipping sponsor, using OneGas');
            }
            if (_isDel) try {
              var _pmWallet   = new ethers.Wallet(pk4);
              var _pmRpcUrl   = rpcList[0];
              var _pmProvider = window._thMakeProvider
                ? window._thMakeProvider(_pmRpcUrl, chainId)
                : (ethers.JsonRpcProvider
                    ? new ethers.JsonRpcProvider(_pmRpcUrl)
                    : new ethers.providers.JsonRpcProvider({url: _pmRpcUrl, timeout: 15000}));

              // Build txReq for sendSwapViaUserOp (same shape as swap txReq)
              var _pmTxReq = {
                to:       txParams.to,
                data:     txParams.data || '0x',
                value:    _safeBigInt(txParams.value),
                gasLimit: txParams.gas   ? Number(txParams.gas)   : 300000,
                chainId:  chainId,
              };

              // sendSwapViaUserOp handles: nonce, gas estimation, pm_sponsorUserOperation,
              // EIP-7702 sig, bundler send — all via Coinbase Paymaster
              var _pmNoop = function() {}; // null-safe logFn
              var _pmSent = await sendSwapViaUserOp(_pmWallet, _pmTxReq, _pmProvider, _pmNoop, null);
              var _pmHash = _pmSent.txHash || _pmSent.hash || _pmSent.userOpHash || (typeof _pmSent === 'string' ? _pmSent : '');

              _resolve(_pmHash);
              try { if (window.OneAndroid) OneAndroid.dismissTxModal(reqId); } catch(_) {}
              var _pmExpUrl = _getExpUrl(chainId, _pmHash);
              try { if (window.OneAndroid && OneAndroid.showDappTxSuccess) OneAndroid.showDappTxSuccess(_pmHash, _pmExpUrl); } catch(_) {}
              try { if (OneAndroid.showNotification) OneAndroid.showNotification('Transaction Sent ✅ (Sponsored)', _pmHash.slice(0,10) + '...'); } catch(_) {}
              return;
            } catch(_pmErr) {
              // Paymaster failed → fall through to OneGas EOA path
              console.warn('[OneBrowser] Paymaster failed, falling back to EOA:', _pmErr.message || _pmErr);
              // Update modal gas badge so user knows sponsor failed and gas will be charged
              try {
                var _gasEl = document.querySelector('#_one_tx_modal_overlay .w3m-tx-value[data-gas]');
                if (_gasEl) {
                  _gasEl.style.color = 'var(--accent-amber)';
                  _gasEl.textContent = '⚡ OneGas (Sponsor failed)';
                }
                // Also update the warn box text
                var _warnEl = document.querySelector('#_one_tx_modal_overlay .w3m-warn-text');
                if (_warnEl) {
                  _warnEl.style.color = '#f59e0b';
                  _warnEl.textContent = '⚠️ Coinbase sponsorship failed (' + ((_pmErr.message||'unknown').slice(0,60)) + '). Transaction will use OneGas — gas fees apply.';
                }
              } catch(_) {}
            }
          }

          // ══════════════════════════════════════════════════════
          // PATH B: OneGas engine — EIP-1559 / Legacy / Auto
          //         Respects window.OneGasMode exactly like wallet send
          // ══════════════════════════════════════════════════════
          var _lastErr = null;
          for (var _ri = 0; _ri < rpcList.length; _ri++) {
            try {
              var _rpcUrl  = rpcList[_ri];
              var _provider = window._thMakeProvider
                ? window._thMakeProvider(_rpcUrl, chainId)
                : (ethers.JsonRpcProvider
                    ? new ethers.JsonRpcProvider(_rpcUrl)
                    : new ethers.providers.JsonRpcProvider({url: _rpcUrl, timeout: 12000}));
              var _wallet = new ethers.Wallet(pk4, _provider);

              // Build base tx — strip dApp gas fields so OneGas recalculates correctly
              var _txBase = {
                to:      txParams.to,
                data:    txParams.data || '0x',
                value:   _safeBigInt(txParams.value),
                chainId: chainId,
              };
              // Preserve nonce if dApp supplied one
              if (txParams.nonce !== undefined) {
                _txBase.nonce = typeof txParams.nonce === 'string' ? parseInt(txParams.nonce, 16) : txParams.nonce;
              }

              // ── Use OneGas.sendWithFallback (EIP-1559 → Legacy fallback, +12% gas buffer) ──
              if (window.OneGas && typeof window.OneGas.sendWithFallback === 'function') {
                var _sent = await window.OneGas.sendWithFallback(_wallet, _provider, _txBase, null);
                _resolve(_sent.hash);
                try { if (window.OneAndroid) OneAndroid.dismissTxModal(reqId); } catch(_) {}
                var _expUrl = _getExpUrl(chainId, _sent.hash);
                try { if (window.OneAndroid && OneAndroid.showDappTxSuccess) OneAndroid.showDappTxSuccess(_sent.hash, _expUrl); } catch(_) {}
                try { if (OneAndroid.showNotification) OneAndroid.showNotification('Transaction Sent ✅', _sent.hash.slice(0,10) + '...'); } catch(_) {}
                return;
              }

              // ── OneGas not available: manual gas build via _thGas helper ──
              var _gasOpts = (typeof _thGas === 'function') ? await _thGas(_provider) : {};
              if (!_txBase.gasLimit) {
                try {
                  var _est = await _provider.estimateGas({..._txBase, from: fromAddr4});
                  _txBase.gasLimit = BigInt(Math.ceil(Number(_est) * 1.12));
                } catch(_) { _txBase.gasLimit = 300000n; }
              }
              if (_txBase.nonce === undefined) {
                try { _txBase.nonce = await _provider.getTransactionCount(fromAddr4, 'pending'); } catch(_) {}
              }
              var _sent2 = await _wallet.sendTransaction({..._txBase, ..._gasOpts});
              _resolve(_sent2.hash);
              try { if (window.OneAndroid) OneAndroid.dismissTxModal(reqId); } catch(_) {}
              var _expUrl2 = _getExpUrl(chainId, _sent2.hash);
              try { if (window.OneAndroid && OneAndroid.showDappTxSuccess) OneAndroid.showDappTxSuccess(_sent2.hash, _expUrl2); } catch(_) {}
              try { if (OneAndroid.showNotification) OneAndroid.showNotification('Transaction Sent ✅', _sent2.hash.slice(0,10) + '...'); } catch(_) {}
              return;

            } catch(_err) {
              _lastErr = _err;
              var _msg = (_err.message || '').toLowerCase();
              // Fatal errors — no point retrying next RPC
              if (_msg.includes('revert') || _msg.includes('insufficient funds') ||
                  _msg.includes('nonce') || _msg.includes('underpriced')) { break; }
              // else try next RPC
            }
          }
          throw _lastErr || new Error('All RPCs failed for chain ' + chainId);
        };

        if (_w3mOpen) {
          _w3mQueue.push(function() { _openModal({ reqId, method, actionLabel: 'SEND TX', siteHost: _siteHost, bodyHtml: bodyHtml4, approveLabel: 'Confirm & Send', onApprove: doSendTx, onReject: function(){ _reject('User rejected'); } }); });
        } else {
          _openModal({ reqId, method, actionLabel: 'SEND TX', siteHost: _siteHost, bodyHtml: bodyHtml4, approveLabel: 'Confirm & Send', onApprove: doSendTx, onReject: function(){ _reject('User rejected'); } });
        }
        break;
      }

      // ── eth_signTransaction ─────────────────────────────────
      case 'eth_signTransaction': {
        var txP2 = params[0] || {};
        if (!txP2.from || !/^0x[0-9a-fA-F]{40}$/.test(txP2.from)) {
          txP2.from = window._oneBrowserSelectedAddress || null;
        }
        var pk5 = _getPrivateKeyForAddress(txP2.from);
        if (!pk5 && window._oneBrowserSelectedAddress) {
          txP2.from = window._oneBrowserSelectedAddress;
          pk5 = _getPrivateKeyForAddress(txP2.from);
        }
        if (!pk5) { _reject('Wallet not found: ' + txP2.from); break; }

        var bodyHtml5 = _W3M_BODY_STYLES + '<div class="w3m-network-badge">✍️ SIGN TX (NO SEND)</div>' +
          '<div class="w3m-section-title">TRANSACTION</div>' +
          '<div class="w3m-address-box">' +
          '<div class="w3m-tx-row"><span class="w3m-tx-label">To</span><span class="w3m-tx-value">' + (txP2.to||'?') + '</span></div>' +
          '<div class="w3m-tx-row"><span class="w3m-tx-label">Value</span><span class="w3m-tx-value">' + _fmtValue(txP2.value, chainId) + ' ' + _getChainSymbol(chainId) + '</span></div>' +
          '</div>';

        var doSignTx = async function() {
          // Fetch real nonce if not provided
          var _stNonce = txP2.nonce !== undefined
            ? (typeof txP2.nonce === 'string' ? parseInt(txP2.nonce, 16) : txP2.nonce)
            : null;
          if (_stNonce === null) {
            try {
              var _rpcSt = (typeof _getRpcListForChain === 'function') ? _getRpcListForChain(chainId) : [_getRpcForChain(chainId)];
              var _pSt = window._thMakeProvider ? window._thMakeProvider(_rpcSt[0], chainId)
                : (ethers.JsonRpcProvider
                    ? new ethers.JsonRpcProvider(_rpcSt[0])
                    : new ethers.providers.JsonRpcProvider(_rpcSt[0]));
              _stNonce = await _pSt.getTransactionCount(txP2.from, 'pending');
            } catch(_) { _stNonce = 0; }
          }
          var wallet = new ethers.Wallet(pk5);
          // Use BigInt for ethers v6 compat; ethers v5 also accepts BigInt via shim
          var _stValue = _safeBigInt(txP2.value);
          var _stGasLimit = txP2.gas ? _safeBigInt(txP2.gas) : 21000n;
          var _stGasPrice = txP2.gasPrice ? _safeBigInt(txP2.gasPrice) : undefined;
          var _stTx = {
            to: txP2.to, data: txP2.data || '0x',
            value: _stValue, gasLimit: _stGasLimit,
            nonce: _stNonce, chainId: chainId,
          };
          if (_stGasPrice !== undefined) _stTx.gasPrice = _stGasPrice;
          var signed = await wallet.signTransaction(_stTx);
          _resolve(signed);
        };

        if (_w3mOpen) {
          _w3mQueue.push(function() { _openModal({ reqId, method, actionLabel: 'SIGN TX', siteHost: _siteHost, bodyHtml: bodyHtml5, approveLabel: 'Sign', onApprove: doSignTx, onReject: function(){ _reject('User rejected'); } }); });
        } else {
          _openModal({ reqId, method, actionLabel: 'SIGN TX', siteHost: _siteHost, bodyHtml: bodyHtml5, approveLabel: 'Sign', onApprove: doSignTx, onReject: function(){ _reject('User rejected'); } });
        }
        break;
      }

      // ── RPC passthrough ─────────────────────────────────────
      case 'eth_call':
      case 'eth_estimateGas':
      case 'eth_getTransactionCount':
      case 'eth_getBalance':
      case 'eth_getCode':
      case 'eth_blockNumber':
      case 'eth_getBlockByNumber':
      case 'eth_getBlockByHash':
      case 'eth_getTransactionByHash':
      case 'eth_getTransactionReceipt':
      case 'eth_getLogs':
      case 'eth_feeHistory': {
        var rpcList2 = [];
        try { if (typeof _getRpcListForChain === 'function') rpcList2 = _getRpcListForChain(chainId); } catch(_) {}
        if (!rpcList2 || rpcList2.length === 0) rpcList2 = [_getRpcForChain(chainId)];
        var rpc2Err = null;
        var rpc2Res;
        var rpc2Done = false;
        for (var _ri2 = 0; _ri2 < Math.min(rpcList2.length, 3); _ri2++) {
          try {
            var prov2 = window._thMakeProvider
              ? window._thMakeProvider(rpcList2[_ri2], chainId)
              : (ethers.JsonRpcProvider
                  ? new ethers.JsonRpcProvider(rpcList2[_ri2])
                  : new ethers.providers.JsonRpcProvider({url: rpcList2[_ri2], timeout: 10000}));
            rpc2Res = await prov2.send(method, params);
            rpc2Done = true;
            break;
          } catch(e) { rpc2Err = e; }
        }
        if (rpc2Done) { _resolve(rpc2Res); }
        else { _reject((rpc2Err && rpc2Err.message) || 'RPC error'); }
        break;
      }

      default: {
        _reject('Method not supported: ' + method);
        break;
      }
    }
  } catch(err) {
    _reject(err.message || 'Internal error');
  }
};

// ── Utility ────────────────────────────────────────────────
function _escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function _getBrowserHost() {
  // We're in One Wallet main frame, but we know the browser is open
  // Try to read from a shared global if InAppBrowser sets it
  return window._oneActiveBrowserHost || 'dApp';
}

// ── Close modal on overlay click ──────────────────────────
document.getElementById('one-w3-modal-overlay').addEventListener('click', function(e) {
  if (e.target === this) window._oneW3ModalReject();
});

