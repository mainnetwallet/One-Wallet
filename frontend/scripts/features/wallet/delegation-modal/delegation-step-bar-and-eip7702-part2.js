
// ── Footer: confirm button label ────────────────────────────
function _updateDelDrawerFooter() {
  const label = document.getElementById('del-drawer-confirm-label');
  const badge = document.getElementById('del-drawer-count-badge');
  const n = _delSelectedKeys.size;

  // If in key view, badge shows key count
  if (_delExpandedGroupId) {
    const groups = loadWalletGroups();
    const g = groups.find(g => g.id === _delExpandedGroupId);
    if (badge && g) badge.textContent = g.keys.filter(k => _delSelectedKeys.has(k)).length + '/' + g.keys.length + ' SELECTED';
  }

  if (!label) return;
  if (n === 0) { label.textContent = 'Select keys to import'; return; }
  label.textContent = `Import ${n} key${n !== 1 ? 's' : ''}`;
}

function delDrawerSelectAll() {
  const groups = loadWalletGroups().filter(g => g && g.keys && g.keys.length > 0);
  if (_delExpandedGroupId) {
    // Select all in current group
    const g = groups.find(g => g.id === _delExpandedGroupId);
    if (g) { g.keys.forEach(k => _delSelectedKeys.add(k)); if (!delSelectedGroupIds.includes(g.id)) delSelectedGroupIds.push(g.id); }
  } else {
    groups.forEach(g => { g.keys.forEach(k => _delSelectedKeys.add(k)); });
    delSelectedGroupIds = groups.map(g => g.id);
  }
  _renderDelDrawer();
  _delAutoImport();
  haptic && haptic();
}

function delDrawerClearAll() {
  if (_delExpandedGroupId) {
    const groups = loadWalletGroups();
    const g = groups.find(g => g.id === _delExpandedGroupId);
    if (g) { g.keys.forEach(k => _delSelectedKeys.delete(k)); delSelectedGroupIds = delSelectedGroupIds.filter(id => id !== g.id); }
  } else {
    _delSelectedKeys.clear();
    delSelectedGroupIds = [];
  }
  _renderDelDrawer();
  _delAutoImport();
  haptic && haptic();
}

function delDrawerConfirm() {
  const statusEl   = document.getElementById('del-group-import-status');
  const triggerMeta = document.getElementById('del-group-trigger-meta');

  // Collect keys: individual selected keys take priority; if none individually, fall back to group-level
  let keysToImport = [..._delSelectedKeys];

  // Also add any full-group-selected keys that aren't already covered
  if (keysToImport.length === 0 && delSelectedGroupIds.length > 0) {
    const groups = loadWalletGroups();
    const seen = new Set();
    delSelectedGroupIds.forEach(id => {
      const g = groups.find(g => g.id === id);
      if (!g) return;
      g.keys.forEach(k => { if (!seen.has(k)) { seen.add(k); keysToImport.push(k); } });
    });
  }

  if (keysToImport.length === 0) { showToast('Select at least one key', 'warning'); return; }

  const textarea = document.getElementById('del-privateKeys');
  if (textarea) {
    textarea.value = keysToImport.join('\n');
    textarea.dispatchEvent(new Event('input'));
    // Update masked overlay immediately
    delUpdateMaskedRows();
    // Keep in hidden/masked mode — show overlay, hide textarea
    textarea.style.display = 'none';
    const masked = document.getElementById('del-pk-masked');
    if (masked) masked.style.display = '';
    const icon = document.getElementById('del-pk-icon');
    const lbl  = document.getElementById('del-pk-lbl');
    if (icon) icon.textContent = 'visibility';
    if (lbl)  lbl.textContent  = 'Show';
  }

  const badge = document.getElementById('del-keyCountBadge');
  const num   = document.getElementById('del-keyCountNum');
  if (badge && num) { num.textContent = keysToImport.length; badge.style.display = 'block'; }

  if (triggerMeta) triggerMeta.textContent = `✓ ${keysToImport.length} key${keysToImport.length !== 1 ? 's' : ''} selected`;
  if (statusEl) { statusEl.style.display = 'block'; statusEl.style.color = 'var(--accent-green)'; statusEl.textContent = `✅ ${keysToImport.length} key(s) imported`; }

  closeDelGroupDrawer();
  showToast(`${keysToImport.length} keys imported`, 'download');
  haptic && haptic();
}

// Keep old names as aliases
function delPopulateGroupSelect() { _renderDelDrawer(); }
function delGroupSelectAll() { delDrawerSelectAll(); }
function delGroupDeselectAll() { delDrawerClearAll(); }
function delImportGroupKeys() { delDrawerConfirm(); }

function closeDelegationModal() {
  switchPage('profile');
  haptic && haptic();
}
document.getElementById('delegation-modal-overlay')?.addEventListener('click', function(e) {
  if (e.target === this) closeDelegationModal();
});

// delLog removed
function delLog(){}

let delEthersReady = false;

// ── Prefixed waitForEthers ──
function delWaitForEthers(cb, tries) {
  tries = tries || 0;
  if (window.ethers) { cb(); return; }
  if (tries > 100) { delLog('❌ ethers.js load failed', 'error'); return; }
  setTimeout(function() { delWaitForEthers(cb, tries + 1); }, 100);
}

delWaitForEthers(function() {

const { ethers } = window;
let delWallets = [];
let delStats = { total: 0, success: 0, fail: 0, skip: 0 };
let delCurrentChainId = 8453;
let delCurrentChainName = 'Base Mainnet';
let delRpcProviders = [];
let delRpcIndex = 0;

function delGetNextProvider() {
  if (delRpcProviders.length === 0) return null;
  const p = delRpcProviders[delRpcIndex % delRpcProviders.length];
  delRpcIndex++;
  return p;
}

async function delInitProviders() {
  const rawUrls = document.getElementById('del-rpcUrls')?.value.trim();
  const urls = rawUrls.split('\n').map(u => u.trim()).filter(u => u.length > 0 && u.startsWith('http'));
  if (urls.length === 0) { delLog('❌ No valid RPC URLs provided', 'error'); return false; }
  delLog('🔌 Testing ' + urls.length + ' RPC(s)...', 'info');
  const tested = await Promise.all(urls.map(async (url, idx) => {
    try {
      // Probe without chainId first to detect the chain
      const pProbe = _makeProvider(url);
      const network = await Promise.race([pProbe.getNetwork(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))]);
      const resolvedChainId = Number(network.chainId);
      // Re-make with resolved chainId: sets staticNetwork (no eth_chainId auto-poll)
      // and cache key matches _withRpcFallback so both share the same provider instance
      const p = _makeProvider(url, resolvedChainId);
      return { provider: p, url, chainId: resolvedChainId };
    } catch (err) {
      delLog('⚠️ RPC ' + (idx+1) + ' failed: ' + err.message.slice(0,40), 'warning');
      return null;
    }
  }));
  const valid = tested.filter(t => t !== null);
  if (valid.length === 0) {
    delLog('❌ All RPC URLs failed. Check your RPC URLs.', 'error');
    return false;
  }
  delRpcProviders = valid.map(t => t.provider);
  delCurrentChainId = valid[0].chainId;
  (document.getElementById('del-rpcUrl') || {}).value = valid[0].url;

  // ── Inject user-entered DEL RPCs into one_custom_rpcs_v1 so _withRpcFallback uses them ──
  // Without this, _withRpcFallback(delCurrentChainId,...) ignores the del-rpcUrls textarea entirely
  try {
    const _delStore = JSON.parse(localStorage.getItem('one_custom_rpcs_v1') || '{}');
    const _delValidUrls = valid.map(t => t.url);
    const _delEntry = _delStore[delCurrentChainId] || { rpcs: [], defaultRpc: null };
    _delValidUrls.forEach(function(r) { if (!_delEntry.rpcs.includes(r)) _delEntry.rpcs.push(r); });
    if (!_delEntry.defaultRpc) _delEntry.defaultRpc = _delValidUrls[0];
    _delStore[delCurrentChainId] = _delEntry;
    localStorage.setItem('one_custom_rpcs_v1', JSON.stringify(_delStore));
  } catch(_) {}

  const resolvedChainName = DEL_NETWORK_NAMES[delCurrentChainId] || ('Chain ' + delCurrentChainId);
  delLog('✅ Connected: ' + resolvedChainName + ' (ID: ' + delCurrentChainId + ') — ' + valid.length + '/' + urls.length + ' RPC(s) active', 'success');

  // ── Warn if RPC chain doesn't match home-screen active chain ──
  const homeChain = (typeof activeHomeChainId !== 'undefined') ? activeHomeChainId : null;
  if (homeChain !== null && homeChain !== delCurrentChainId) {
    const homeChainName = DEL_NETWORK_NAMES[homeChain] || ('Chain ' + homeChain);
    delLog('⚠️ Note: Home screen shows ' + homeChainName + ' but RPC resolved to ' + resolvedChainName + '. RPC chain will be used.', 'warning');
  }
  return true;
}

function delParsePrivateKeys() {
  const pks = document.getElementById('del-privateKeys')?.value.trim();
  if (!pks) return [];
  let list = [];
  if (pks.includes('[') && pks.includes(']')) {
    const content = pks.match(/\[(.*)\]/s);
    if (content && content[1]) list = content[1].split(',').map(k => k.trim().replace(/['"]/g, '')).filter(k => k.length > 0);
  } else if (pks.includes(',')) {
    list = pks.split(',').map(k => k.trim().replace(/['"]/g, '')).filter(k => k.length > 0);
  } else {
    list = pks.split('\n').map(k => k.trim().replace(/['"]/g, '')).filter(k => k.length > 0);
  }
  return list;
}

const DEL_NETWORK_NAMES = {1:'Ethereum Mainnet',56:'BSC',137:'Polygon',42161:'Arbitrum One',10:'Optimism',8453:'Base Mainnet',43114:'Avalanche',250:'Fantom',42220:'Celo',100:'Gnosis Chain',59144:'Linea',534352:'Scroll',5000:'Mantle',1101:'Polygon zkEVM',81457:'Blast',324:'zkSync Era',34443:'Mode',169:'Manta Pacific',1329:'Sei Network',11155111:'Sepolia',17000:'Holesky',84532:'Base Sepolia',11155420:'Optimism Sepolia',421614:'Arbitrum Sepolia',80002:'Polygon Amoy',97:'BSC Testnet',43113:'Avalanche Fuji',4002:'Fantom Testnet',534351:'Scroll Sepolia'};

let DEL_EIP1559_CHAINS = [1,5,11155111,17000,10,11155420,42161,421614,8453,84532,137,80002,43114,43113,42220,1101,59144,534352,534351,81457,5000,169,34443];
let delCustomEIP1559Chains = [];

const DEL_WALLET_ABI = [
  "function initialize(bytes[] calldata owners)",
  "function addOwnerAddress(address owner)",
  "function ownerAtIndex(uint256 index) view returns (bytes memory)",
  "function nextOwnerIndex() view returns (uint256)",
  "function implementation() view returns (address)",
  "function entryPoint() view returns (address)"
];

function delGetExplorerUrl(type, value) {
  const explorers = {1:'https://etherscan.io',56:'https://bscscan.com',137:'https://polygonscan.com',42161:'https://arbiscan.io',10:'https://optimistic.etherscan.io',8453:'https://basescan.org',84532:'https://sepolia.basescan.org',43114:'https://snowtrace.io',250:'https://ftmscan.com',42220:'https://celoscan.io',100:'https://gnosisscan.io',59144:'https://lineascan.build',534352:'https://scrollscan.com',5000:'https://explorer.mantle.xyz',1101:'https://zkevm.polygonscan.com',81457:'https://blastscan.io',324:'https://explorer.zksync.io',34443:'https://explorer.mode.network',169:'https://pacific-explorer.manta.network',1329:'https://seitrace.com',11155111:'https://sepolia.etherscan.io',17000:'https://holesky.etherscan.io',11155420:'https://sepolia-optimistic.etherscan.io',421614:'https://sepolia.arbiscan.io',80002:'https://amoy.polygonscan.com',97:'https://testnet.bscscan.com',43113:'https://testnet.snowtrace.io',4002:'https://testnet.ftmscan.com',534351:'https://sepolia.scrollscan.com'};
  const baseUrl = explorers[delCurrentChainId] || (window.getTHExplorer ? window.getTHExplorer(delCurrentChainId) : 'https://etherscan.io');
  return type === 'address' ? baseUrl+'/address/'+value : baseUrl+'/tx/'+value;
}

function delMakeClickableHash(hash, type='tx') {
  const url = delGetExplorerUrl(type, hash);
  return '<span class="del-clickable" onclick="window.open(\'' + url + '\',\'_blank\')">' + hash + '</span>';
}

function delTick() { return new Promise(r => setTimeout(r, 0)); }

function delUpdateStats() {
  const el = id => document.getElementById(id);
  if (el('del-totalWallets')) el('del-totalWallets').textContent = delStats.total;
  if (el('del-successCount')) el('del-successCount').textContent = delStats.success;
  if (el('del-failCount')) el('del-failCount').textContent = delStats.fail;
  if (el('del-skipCount')) el('del-skipCount').textContent = delStats.skip;
  // Progress ring: share of wallets finished (done + failed + skipped)
  const doneN = delStats.success + delStats.fail + delStats.skip;
  const pct = delStats.total > 0 ? Math.min(100, Math.round(doneN / delStats.total * 100)) : 0;
  if (el('del-ring')) el('del-ring').setAttribute('stroke-dashoffset', String(Math.round(226 * (1 - pct / 100))));
  if (el('del-ring-pct')) el('del-ring-pct').textContent = pct + '%';
}

// ── RLP helpers ──
function delRlpEncode(input) {
  if (Array.isArray(input)) {
    const output = input.map(i => delRlpEncode(i));
    const totalLen = output.reduce((acc, arr) => acc + arr.length, 0);
    const concat = new Uint8Array(totalLen);
    let off = 0; for (const arr of output) { concat.set(arr, off); off += arr.length; }
    return new Uint8Array([...delEncodeLength(concat.length, 192), ...concat]);
  } else {
    const bytes = delHexToBytes(input);
    if (bytes.length === 1 && bytes[0] < 128) return bytes;
    return new Uint8Array([...delEncodeLength(bytes.length, 128), ...bytes]);
  }
}
function delEncodeLength(len, offset) {
  if (len < 56) return [len + offset];
  let h = len.toString(16);
  if (h.length % 2) h = '0' + h; // ensure even hex digits
  const ll = h.length / 2;       // now always integer
  return [offset + 55 + ll, ...delHexToBytes(h)];
}
function delHexToBytes(hex) {
  if (hex === '0x' || hex === '') return new Uint8Array([]);
  hex = hex.replace(/^0x/i, '');
  if (hex.length % 2) hex = '0' + hex;
  const b = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) b[i/2] = parseInt(hex.slice(i, i+2), 16);
  return b;
}
function delBytesToHex(bytes) { return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2,'0')).join(''); }
function delToHex(value) {
  if (typeof value === 'bigint' || typeof value === 'number') {
    const h = value.toString(16); return h === '0' ? '0x' : '0x' + h;
  }
  return value;
}

async function delDelegateSingle(wallet, delegationAddress, provider, chainId, extraData) {
  // ── Always fetch a FRESH nonce right before signing — prevents stale nonce on retry ──
  const _wfDel = (chainId && typeof _withRpcFallback === 'function')
    ? (fn) => _withRpcFallback(chainId, fn, 5000)
    : (fn) => fn(provider);
  const nonce = await _wfDel(_p => _p.getTransactionCount(wallet.address, 'pending'));
  const feeData = await _wfDel(_p => _p.getFeeData());
  let maxPriorityFee, maxFee;
  const allChains = [...DEL_EIP1559_CHAINS, ...delCustomEIP1559Chains];
  const isEIP1559 = allChains.includes(chainId);
  if (isEIP1559 && feeData.maxPriorityFeePerGas && feeData.maxFeePerGas) {
    const baseFee = feeData.maxFeePerGas - feeData.maxPriorityFeePerGas;
    maxFee = (baseFee * 105n) / 100n;
    maxPriorityFee = (baseFee * 5n) / 100n;
    if (maxPriorityFee < 1000000n) maxPriorityFee = 1000000n;
    if (maxFee < maxPriorityFee) maxFee = maxPriorityFee;
    delLog('⛽ Gas: Base=' + ethers.formatUnits(baseFee,'gwei') + ' | MaxFee=Base+5%=' + ethers.formatUnits(maxFee,'gwei') + ' | Priority=Base-95%=' + ethers.formatUnits(maxPriorityFee,'gwei') + ' Gwei', 'info');
  } else if (feeData.gasPrice) {
    maxFee = (feeData.gasPrice * 105n) / 100n;
    maxPriorityFee = (feeData.gasPrice * 5n) / 100n;
    if (maxPriorityFee < 1000000n) maxPriorityFee = 1000000n;
    if (maxFee < maxPriorityFee) maxFee = maxPriorityFee;
    delLog('⛽ Gas: ' + ethers.formatUnits(maxFee,'gwei') + ' Gwei (+5%)', 'info');
  } else {
    maxPriorityFee = 0n; maxFee = 1100000000n;
    delLog('⛽ Gas: Fallback 1.1 Gwei', 'warning');
  }

  // ── Authorization hash: EIP-7702 magic 0x05 + RLP([chainId, address, nonce]) ──
  // authNonce = nonce+1 (Base/EIP-7702: auth nonce is post-TX nonce)
  const authNonce = BigInt(nonce) + 1n;
  const authTuple = [delToHex(chainId), delegationAddress.toLowerCase(), delToHex(authNonce)];
  const encodedAuth = delRlpEncode(authTuple);
  const authHash = ethers.keccak256(ethers.concat(['0x05', delBytesToHex(encodedAuth)]));
  const authSig = wallet.signingKey.sign(authHash);
  // authList item: [chainId, address, nonce, yParity, r, s]
  const authListItem = [delToHex(chainId), delegationAddress.toLowerCase(), delToHex(authNonce), delToHex(authSig.yParity), authSig.r, authSig.s];

  // ── Calldata: initialize(bytes[]) only if not yet initialized ──
  let txData = '0x';
  if (!extraData || extraData === '') {
    // ── Custom owner function support ──
    // If user provided a custom owner function, use it to check initialization.
    // Otherwise fall back to the default nextOwnerIndex() check (unchanged Base behavior).
    const customOwnerFn = (document.getElementById('del-ownerFunction')?.value.trim()) || '';
    let alreadyInitialized = false;

    if (customOwnerFn) {
      // Custom owner function: parse and attempt call
      try {
        // Attempt to call the function with index 0 or no args depending on signature
        const fnHasArg = customOwnerFn.includes('(') && !customOwnerFn.match(/\(\s*\)/);
        const abiEntry = fnHasArg
          ? `function ${customOwnerFn} view returns (bytes memory)`
          : `function ${customOwnerFn} view returns (uint256)`;
        const _checkContract = new ethers.Contract(wallet.address, [abiEntry], provider);
        const fnName = customOwnerFn.split('(')[0].trim();
        const result = fnHasArg
          ? await _checkContract[fnName](0)
          : await _checkContract[fnName]();
        // If it returned something meaningful, consider initialized
        if (result !== undefined && result !== null) {
          const asNum = typeof result === 'bigint' ? Number(result) : result;
          if (typeof asNum === 'number' && asNum > 0) alreadyInitialized = true;
          else if (typeof result === 'string' && result !== '0x') alreadyInitialized = true;
        }
      } catch(e) { /* not yet delegated or custom fn not available — initialize needed */ }
    } else {
      // DEFAULT: use nextOwnerIndex() (Base chain / standard Coinbase wallet behavior - unchanged)
      try {
        const _checkContract = new ethers.Contract(wallet.address, DEL_WALLET_ABI, provider);
        const ownerCount = await _checkContract.nextOwnerIndex();
        if (Number(ownerCount) > 0) alreadyInitialized = true;
      } catch(e) { /* not yet delegated or no code — initialize needed */ }
    }

    if (!alreadyInitialized) {
      // initialize(bytes[]) selector = 0x6f2de70e
      const _iface = new ethers.Interface(["function initialize(bytes[] calldata owners)"]);
      const _ownerBytes = ethers.zeroPadValue(wallet.address, 32);
      txData = _iface.encodeFunctionData("initialize", [[_ownerBytes]]);
    } else {
      delLog('ℹ️ Already initialized — delegating only...', 'info');
    }
  } else if (extraData !== '0x') {
    txData = extraData;
  }

  // ── Manual EIP-7702 (type 0x04) RLP encoding ──
  // TX fields: [chainId, nonce, maxPriorityFee, maxFee, gasLimit, to, value, data, accessList, authList]
  // value=0 must be encoded as '0x' (empty, not '0x00') in RLP
  const txFields = [
    delToHex(chainId),
    delToHex(nonce),
    delToHex(maxPriorityFee),
    delToHex(maxFee),
    delToHex(350000n),
    wallet.address.toLowerCase(),
    '0x',          // value = 0 → RLP empty bytes
    txData,        // calldata
    [],            // accessList
    [authListItem] // authorizationList
  ];

  // Sign the unsigned TX: keccak256(0x04 || RLP(txFields))
  const encodedTx = delRlpEncode(txFields);
  const txHash = ethers.keccak256(ethers.concat(['0x04', delBytesToHex(encodedTx)]));
  const txSig = wallet.signingKey.sign(txHash);

  // Signed TX: RLP([...txFields, yParity, r, s])
  const signedTxFields = [...txFields, delToHex(txSig.yParity), txSig.r, txSig.s];
  const signedEncoded = delRlpEncode(signedTxFields);
  const signedTx = '0x04' + delBytesToHex(signedEncoded).slice(2);

  const sentTxHash = await provider.send('eth_sendRawTransaction', [signedTx]);
  return { success: true, txHash: sentTxHash };
}

async function delBatchDelegate() {
  const delegationAddress = document.getElementById('del-delegationAddress')?.value.trim();
  if (!delegationAddress.startsWith('0x')) { delLog('❌ Invalid delegation address', 'error'); return; }
  (document.getElementById('del-activityLog') || {}).innerHTML = '';
  if (!(await delInitProviders())) return;
  const privateKeysList = delParsePrivateKeys();
  if (privateKeysList.length === 0) { delLog('❌ No private keys found', 'error'); return; }
  delWallets = [];
  delLog('🔄 Preparing ' + privateKeysList.length + ' wallet(s)...', 'info');
  window.delRunning = true;
  if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txStart(); // BG: wake lock
  if (typeof window._updateAllToolBadges === 'function') window._updateAllToolBadges();

  // ── Build wallet list with dedicated provider per wallet ──
  const resolved = [];
  for (let i = 0; i < privateKeysList.length; i++) {
    let pk = privateKeysList[i];
    if (!pk.startsWith('0x')) pk = '0x' + pk;
    if (pk.length !== 66) { delLog('❌ W'+(i+1)+': Invalid key length', 'error'); continue; }
    try {
      // Each wallet gets its own JsonRpcProvider instance — no shared state, no nonce collision
      const provider = await _withRpcFallback(delCurrentChainId, async (p) => { await p.getBlockNumber(); return p; }, 4000).catch(() => delRpcProviders[i % delRpcProviders.length]);
      const wallet = new ethers.Wallet(pk, provider);
      const balance = await _withRpcFallback(delCurrentChainId, _p => _p.getBalance(wallet.address), 5000);
      resolved.push({ wallet, balance, provider, index: i + 1 });
    } catch (err) { delLog('❌ W'+(i+1)+': '+err.message, 'error'); }
  }

  delWallets = resolved.map(r => ({ ...r, analysis: { isEOF: false, owners: [] } }));
  delStats = { total: resolved.length, success: 0, fail: 0, skip: 0 };
  delUpdateStats();
  delLog('✅ ' + resolved.length + ' wallet(s) ready — delegating sequentially...', 'success');

  // ── Sequential execution — one wallet at a time, no nonce collision ──
  for (const { wallet, balance, provider, index } of resolved) {
    if (balance === 0n) {
      delLog('⚪ W'+index+': Skipped (zero balance)', 'warning');
      delStats.skip++; delUpdateStats(); continue;
    }
    let sent = false;
    for (let retry = 1; retry <= 3; retry++) {
      try {
        delLog('🔄 W'+index+': Delegating + Initializing' + (retry > 1 ? ' (retry '+retry+')' : '') + '...', 'info');
        const result = await delDelegateSingle(wallet, delegationAddress, provider, delCurrentChainId);
        const txLink = delMakeClickableHash(result.txHash, 'tx');
        delLog('✅ W'+index+': TX sent — ' + txLink, 'success');
        delStats.success++; sent = true; break;
      } catch (error) {
        const errMsg = error.message || String(error);
        const isInsufficient = errMsg.toLowerCase().includes('insufficient');
        const addrSuffix = isInsufficient ? ' — Address: ' + wallet.address : '';
        if (retry < 3) {
          delLog('⚠️ W'+index+': Attempt '+retry+' failed, retrying in 1.5s...', 'warning');
          await new Promise(r => setTimeout(r, 1500));
        } else {
          delLog('❌ W'+index+': Failed — ' + errMsg.slice(0, 120) + addrSuffix, 'error');
          delStats.fail++;
        }
      }
    }
    delUpdateStats();
    // Small gap between wallets to avoid RPC rate-limiting
    if (sent) await new Promise(r => setTimeout(r, 300));
  }
  delLog('🏁 Delegation complete! ✅ ' + delStats.success + ' | ❌ ' + delStats.fail + ' | ⚪ ' + delStats.skip, 'success');
  window.delRunning = false;
  if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txEnd(); // BG: release wake lock
  if (typeof window._updateAllToolBadges === 'function') window._updateAllToolBadges();
  showToast && showToast('✅ Delegation done! ' + delStats.success + ' success, ' + delStats.fail + ' fail', delStats.fail === 0 ? 'check_circle' : 'warning');
  _oneSendNotif('One Wallet', '✅ Delegation done! ' + delStats.success + ' success, ' + delStats.fail + ' fail');
}


async function delRevokeAll() {
  (document.getElementById('del-activityLog') || {}).innerHTML = '';
  if (!(await delInitProviders())) return;
  const privateKeysList = delParsePrivateKeys();
  if (privateKeysList.length === 0) { delLog('❌ No private keys found', 'error'); return; }
  const revokeAddress = '0x0000000000000000000000000000000000000000';
  delLog('🔄 Revoking all delegations (sequential)...', 'info');
  window.delRunning = true;
  if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txStart(); // BG: wake lock
  if (typeof window._updateAllToolBadges === 'function') window._updateAllToolBadges();

  // Build wallet list with dedicated provider per wallet
  const revokeWallets = [];
  for (let i = 0; i < privateKeysList.length; i++) {
    let pk = privateKeysList[i];
    if (!pk.startsWith('0x')) pk = '0x' + pk;
    if (pk.length !== 66) continue;
    try {
      const provider = await _withRpcFallback(delCurrentChainId, async (p) => { await p.getBlockNumber(); return p; }, 4000).catch(() => delRpcProviders[i % delRpcProviders.length]);
      const wallet = new ethers.Wallet(pk, provider);
      const balance = await _withRpcFallback(delCurrentChainId, _p => _p.getBalance(wallet.address), 5000);
      revokeWallets.push({ wallet, balance, provider, index: i+1 });
    } catch { }
  }

  delStats = { total: revokeWallets.length, success: 0, fail: 0, skip: 0 }; delUpdateStats();
  for (const { wallet, balance, provider, index } of revokeWallets) {
    if (balance === 0n) { delLog('⚪ W'+index+': Skipped (zero balance)', 'warning'); delStats.skip++; delUpdateStats(); continue; }
    try {
      const result = await delDelegateSingle(wallet, revokeAddress, provider, delCurrentChainId, '0x');
      delLog('✅ W'+index+': Revoked — TX: ' + delMakeClickableHash(result.txHash, 'tx'), 'success');
      delStats.success++;
    } catch (error) { delLog('❌ W'+index+': ' + error.message.slice(0,50), 'error'); delStats.fail++; }
    delUpdateStats();
    await new Promise(r => setTimeout(r, 300));
  }
  delLog('✅ Revoke complete! ✅ ' + delStats.success + ' | ❌ ' + delStats.fail + ' | ⚪ ' + delStats.skip, 'success');
  window.delRunning = false;
  if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txEnd(); // BG: release wake lock
  if (typeof window._updateAllToolBadges === 'function') window._updateAllToolBadges();
  showToast && showToast('✅ Revoke done! ' + delStats.success + ' success', delStats.fail === 0 ? 'check_circle' : 'warning');
  _oneSendNotif('One Wallet', '✅ Revoke done! ' + delStats.success + ' success');
}

async function delCheckWallets() {
  (document.getElementById('del-activityLog') || {}).innerHTML = '';
  if (!(await delInitProviders())) return;
  const privateKeysList = delParsePrivateKeys();
  if (privateKeysList.length === 0) { delLog('❌ No private keys found', 'error'); return; }
  delLog('🔍 Checking ' + privateKeysList.length + ' wallet(s)...', 'info');
  for (let i = 0; i < privateKeysList.length; i++) {
    let pk = privateKeysList[i];
    if (!pk.startsWith('0x')) pk = '0x' + pk;
    if (pk.length !== 66) continue;
    try {
      const provider = delRpcProviders[0];
      const wallet = new ethers.Wallet(pk, provider);
      const code = await _withRpcFallback(delCurrentChainId, _p => _p.getCode(wallet.address), 5000);
      const isDelegated = code && code.startsWith('0xef01') && code.length >= 10;
      delLog('W'+(i+1)+': ' + wallet.address.slice(0,16) + '... ' + (isDelegated ? '🟢 Delegated' : '⚪ Not delegated'), isDelegated ? 'success' : 'info');
    } catch(err) { delLog('❌ W'+(i+1)+': ' + err.message, 'error'); }
  }
  delLog('✅ Status check complete', 'success');
}

async function delCheckAndRedelegate() {
  (document.getElementById('del-activityLog') || {}).innerHTML = '';
  if (!(await delInitProviders())) return;
  const privateKeysList = delParsePrivateKeys();
  if (privateKeysList.length === 0) { delLog('❌ No private keys found', 'error'); return; }
  const delegationAddress = document.getElementById('del-delegationAddress')?.value.trim();
  if (!delegationAddress.startsWith('0x')) { delLog('❌ Invalid delegation address', 'error'); return; }
  delLog('🔍 Checking ' + privateKeysList.length + ' wallet(s) for delegation status...', 'info');

  // Check status for all wallets (read-only, parallel is fine here)
  const resolved = [];
  for (let i = 0; i < privateKeysList.length; i++) {
    let pk = privateKeysList[i];
    if (!pk.startsWith('0x')) pk = '0x' + pk;
    if (pk.length !== 66) continue;
    try {
      const provider = await _withRpcFallback(delCurrentChainId, async (p) => { await p.getBlockNumber(); return p; }, 4000).catch(() => delRpcProviders[i % delRpcProviders.length]);
      const wallet = new ethers.Wallet(pk, provider);
      // Sequential instead of Promise.all — avoids race condition on shared _rpcHealthIdx[chainId]
      // (concurrent _withRpcFallback calls on same chainId can corrupt the health index)
      const balance = await _withRpcFallback(delCurrentChainId, _p => _p.getBalance(wallet.address), 5000);
      const code    = await _withRpcFallback(delCurrentChainId, _p => _p.getCode(wallet.address), 5000);
      const isDelegated = code && code.startsWith('0xef01') && code.length >= 10;
      resolved.push({ wallet, balance, provider, index: i+1, isDelegated });
    } catch(err) { delLog('❌ W'+(i+1)+': '+err.message, 'error'); }
  }

  const notDelegated = resolved.filter(w => !w.isDelegated && w.balance > 0n);
  const alreadyDelegated = resolved.filter(w => w.isDelegated).length;
  const zeroBal = resolved.filter(w => w.balance === 0n).length;
  delLog('📊 Already delegated: ' + alreadyDelegated + ' | Need delegation: ' + notDelegated.length + ' | Zero balance: ' + zeroBal, 'info');
  if (notDelegated.length === 0) { delLog('✅ All wallets already delegated!', 'success'); return; }

  delStats = { total: notDelegated.length, success: 0, fail: 0, skip: 0 }; delUpdateStats();
  window.delRunning = true;
  if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txStart(); // BG: wake lock
  if (typeof window._updateAllToolBadges === 'function') window._updateAllToolBadges();

  // ── Sequential delegation — no nonce collision ──
  for (const { wallet, provider, index } of notDelegated) {
    for (let retry = 1; retry <= 3; retry++) {
      try {
        delLog('🔄 W'+index+': Re-delegating' + (retry > 1 ? ' (retry '+retry+')' : '') + '...', 'info');
        const result = await delDelegateSingle(wallet, delegationAddress, provider, delCurrentChainId, '0x');
        delLog('✅ W'+index+': TX sent — ' + delMakeClickableHash(result.txHash, 'tx'), 'success');
        delStats.success++; break;
      } catch(error) {
        const errMsg = error.message || String(error);
        if (retry < 3) { delLog('⚠️ W'+index+': Attempt '+retry+' failed, retrying in 1.5s...', 'warning'); await new Promise(r => setTimeout(r, 1500)); }
        else { delLog('❌ W'+index+': Failed — ' + errMsg.slice(0,120), 'error'); delStats.fail++; }
      }
    }
    delUpdateStats();
    await new Promise(r => setTimeout(r, 300));
  }
  delLog('🏁 Re-delegation complete! ✅ ' + delStats.success + ' | ❌ ' + delStats.fail, 'success');
  _oneSendNotif('One Wallet', '✅ Re-delegation done! ' + delStats.success + ' success, ' + delStats.fail + ' fail');
  window.delRunning = false;
  if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txEnd(); // BG: release wake lock
  if (typeof window._updateAllToolBadges === 'function') window._updateAllToolBadges();
  showToast && showToast('✅ Re-delegation done! ' + delStats.success + ' success', delStats.fail === 0 ? 'check_circle' : 'warning');
}

// ── Event listeners ──
document.getElementById('del-btnDelegate')?.addEventListener('click', delBatchDelegate);
document.getElementById('del-btnRevokeBatch')?.addEventListener('click', delRevokeAll);
document.getElementById('del-btnCheckWallets')?.addEventListener('click', delCheckWallets);
document.getElementById('del-btnCheckAndRedelegate')?.addEventListener('click', delCheckAndRedelegate);
document.getElementById('del-btnRevoke')?.addEventListener('click', () => {
  (document.getElementById('del-delegationAddress') || {}).value = '0x0000000000000000000000000000000000000000';
  delLog('✅ Set to revoke address', 'success');
});
// ── Private Key Show/Hide toggle ──
window.delPkToggle = function() {
  const ta      = document.getElementById('del-privateKeys');
  const masked  = document.getElementById('del-pk-masked');
  const icon    = document.getElementById('del-pk-icon');
  const lbl     = document.getElementById('del-pk-lbl');
  const hidden  = masked.style.display !== 'none';
  if (hidden) {
    // Currently showing masked → switch to textarea (Show keys)
    masked.style.display  = 'none';
    ta.style.display      = '';
    icon.textContent      = 'visibility_off';
    lbl.textContent       = 'Hide';
    ta.focus();
  } else {
    // Currently showing textarea → switch to masked (Hide keys)
    ta.style.display      = 'none';
    masked.style.display  = '';
    icon.textContent      = 'visibility';
    lbl.textContent       = 'Show';
    delUpdateMaskedRows();
  }
};

function delUpdateMaskedRows() {
  const rows = document.getElementById('del-pk-masked-rows');
  if (!rows) return;
  const keys = delParsePrivateKeys();
  if (!keys.length) {
    rows.innerHTML = '<div class="dl-muted" style="padding:8px 0;">Paste keys to see addresses…</div>';
    return;
  }
  rows.innerHTML = keys.map(function(pk, i) {
    let addr = '';
    try {
      if (pk && (pk.length === 64 || (pk.startsWith('0x') && pk.length === 66))) {
        const w = new ethers.Wallet(pk.startsWith('0x') ? pk : '0x' + pk);
        addr = w.address;
      }
    } catch(e) { addr = ''; }
    const masked = '••••••••••' + (pk.length > 6 ? pk.slice(-4) : '••••');
    return '<div class="dl-wrow">'
      + '<span class="dl-wnum">' + (i+1) + '</span>'
      + '<div style="flex:1;min-width:0;">'
      + (addr ? '<div class="dl-waddr">' + addr.slice(0,6) + '…' + addr.slice(-4) + '</div>' : '<div class="dl-waddr">Invalid key</div>')
      + '<div class="dl-wkey">' + masked + '</div>'
      + '</div>'
      + (addr ? '<span class="dl-chip dl-chip-accent">Ready</span>' : '<span class="dl-chip dl-chip-bad">Invalid</span>')
      + '</div>';
  }).join('');
}

document.getElementById('del-privateKeys')?.addEventListener('input', function() {
  const keys = delParsePrivateKeys();
  const badge = document.getElementById('del-keyCountBadge');
  const num = document.getElementById('del-keyCountNum');
  if (keys.length > 0) { num.textContent = keys.length; badge.style.display = 'block'; }
  else badge.style.display = 'none';
  // Keep masked overlay in sync even while textarea is visible
  delUpdateMaskedRows();
});

// ── Custom owner function — live hint ──
document.getElementById('del-ownerFunction')?.addEventListener('input', function() {
  const statusEl = document.getElementById('del-owner-fn-status');
  if (!statusEl) return;
  const val = this.value.trim();
  if (val) {
    statusEl.style.display = 'block';
    statusEl.textContent = '⚡ Custom fn active: ' + val.split('(')[0].trim() + '() will be used for init check.';
    statusEl.style.color = 'var(--neon-purple)';
  } else {
    statusEl.style.display = 'block';
    statusEl.textContent = '✅ Using default: nextOwnerIndex() (Base / Coinbase standard)';
    statusEl.style.color = 'var(--accent-green)';
  }
});

delLog('⚡ Multi-RPC Parallel Mode ready. Paste private keys and click 🚀 Start Delegation.', 'info');

// ── Sync chain state on ethers ready (handles case where modal was opened before ethers loaded) ──
setTimeout(function() {
  if (typeof delSyncActiveChain === 'function') delSyncActiveChain();
  // Show active chain in log
  const hc = (typeof activeHomeChainId !== 'undefined') ? activeHomeChainId : null;
  const hcName = hc ? (DEL_NETWORK_NAMES[hc] || ('Chain ' + hc)) : null;
  if (hcName) delLog('🔗 Active chain: ' + hcName + ' (from Home Screen)', 'info');
}, 200);

}); // end delWaitForEthers

// ══════════════════════════════════════════
// BRIDGE PAGE — Multi-Provider (LiFi + Rubic + Rango)
// ══════════════════════════════════════════
