



// Show/hide tx progress bar
function _swShowTxProgress(label, sub, txHash) {
  // Hide success message when loading starts
  _swHideSuccessMsg();
  // Simplify label — remove "Step X/X:" prefix for cleaner UI
  if (label) label = label.replace(/^Step \d+\/\d+:\s*/i, '');
  // Map to clean button loading label
  let btnLabel = 'Processing…';
  if (/approv/i.test(label))  btnLabel = 'Approving…';
  if (/swap|confirm/i.test(label) && !/approv/i.test(label)) btnLabel = 'Swapping…';
  if (/waiting|broadcast/i.test(label)) btnLabel = 'Confirming…';
  _swBtnLoading(btnLabel);

  // Still update hidden progress elements for logic compatibility
  const p = document.getElementById('sw-tx-progress');
  const l = document.getElementById('sw-tx-progress-label');
  const s = document.getElementById('sw-tx-progress-sub');
  const spinner = document.getElementById('sw-tx-spinner');
  const hashRow = document.getElementById('sw-tx-hash-row');
  // Keep box hidden — no visible box
  if (p) p.style.display = 'none';
  if (l) l.textContent = label || 'Processing…';
  if (s) s.textContent = sub || '';
  const retryRow = document.getElementById('sw-approve-retry-row');
  if (retryRow) retryRow.style.display = 'none';
  if (hashRow) {
    if (txHash) {
      hashRow.style.display = 'block';
      const link = document.getElementById('sw-tx-explorer-link');
      const shortEl = document.getElementById('sw-tx-hash-short');
      const chainId = SW.network ? SW.network.chainId : 1;
      const EXPLORERS = {1:'https://etherscan.io/tx/',56:'https://bscscan.com/tx/',137:'https://polygonscan.com/tx/',42161:'https://arbiscan.io/tx/',10:'https://optimistic.etherscan.io/tx/',8453:'https://basescan.org/tx/',43114:'https://snowtrace.io/tx/'};
      const base = EXPLORERS[chainId] || (window.getTHExplorerTx ? window.getTHExplorerTx(chainId) : 'https://etherscan.io/tx/');
      if (link) link.href = base + txHash;
      if (shortEl) shortEl.textContent = txHash.slice(0,8) + '…' + txHash.slice(-6);
    } else {
      if (hashRow) hashRow.style.display = 'none';
    }
  }
}
function _swHideSuccessMsg() { /* sw-success-msg removed */ }
function _swShowSuccessMsg(title, sub) { /* sw-success-msg removed — use _ssoOpen */ }

// Set button to loading state (disabled + spinning icon)
function _swBtnLoading(label) {
  const btn  = document.getElementById('sw-action-btn');
  const icon = document.getElementById('sw-btn-icon');
  const lbl  = document.getElementById('sw-btn-label');
  if (!btn) return;
  btn.style.opacity       = '0.7';
  btn.style.cursor        = 'not-allowed';
  btn.style.pointerEvents = 'none';
  btn.disabled            = true;
  btn.onclick             = null;
  if (icon) { icon.textContent = 'sync'; icon.style.animation = 'swSpin 0.8s linear infinite'; }
  if (lbl)  lbl.textContent = label || 'Processing…';
}
// Restore button to correct state via swUpdateButton
function _nxsw__swBtnRestore() {
  const btn  = document.getElementById('sw-action-btn');
  const icon = document.getElementById('sw-btn-icon');
  if (btn) {
    btn.style.pointerEvents = '';
    btn.disabled            = false;
  }
  if (icon) icon.style.animation = '';
  swUpdateButton();
}


/* ── Smart amount formatter: 2 decimals for normal, significant digits for tiny values ── */
function swFormatAmount(val, tokenDecimals) {
  if (!isFinite(val) || val <= 0) return '—';
  // Determine how many decimal places the token supports
  const maxDec = (tokenDecimals != null) ? Math.min(tokenDecimals, 18) : 18;
  // For stablecoins / low-decimal tokens (e.g. USDC=6, USDT=6) cap display precision
  const dispDec = Math.min(maxDec, 8); // never show more than 8 decimal places
  if (val >= 1e6) {
    const d = Math.min(2, dispDec);
    return val.toLocaleString('en-US', {minimumFractionDigits:d, maximumFractionDigits:d});
  }
  if (val >= 1000) {
    const d = Math.min(2, dispDec);
    return val.toLocaleString('en-US', {minimumFractionDigits:d, maximumFractionDigits:d});
  }
  if (val >= 100) {
    const d = Math.min(3, dispDec);
    return parseFloat(val.toFixed(d)).toString();
  }
  if (val >= 1) {
    const d = Math.min(4, dispDec);
    return parseFloat(val.toFixed(d)).toString();
  }
  if (val >= 0.01) {
    const d = Math.min(6, dispDec);
    return parseFloat(val.toFixed(d)).toString();
  }
  if (val > 0) {
    // Very small amounts — use up to 8 significant digits, capped by token decimals
    const sigFig = parseFloat(val.toPrecision(Math.min(6, dispDec + 2)));
    return sigFig.toString();
  }
  return '—';
}

/* ── Amount Change ── */
function swOnAmountChange() {
  SW._cachedRouterAddr  = null;
  SW._routerCache       = {};   // new quotes will repopulate this
  SW._cachedSwapTx      = null; // clear stale route on new input
  SW._routeFetching     = false;
  SW.quotes             = [];   // clear stale quotes list
  _swHideSuccessMsg();

  // Guard: if tokens not yet initialized, re-init with Base defaults
  if (!SW.fromToken || !SW.toToken) {
    const _tokens = (typeof _nxsw_getTokens === 'function') ? _nxsw_getTokens() : [];
    if (_tokens && _tokens.length > 0) {
      SW.fromToken = _tokens.find(function(t){ return t.sym === 'ETH'; })  || _tokens[0];
      SW.toToken   = _tokens.find(function(t){ return t.sym === 'USDC'; }) || _tokens[1] || _tokens[0];
    }
    if (!SW.fromToken || !SW.toToken) return;
  }

  const input = document.getElementById('sw-from-amount');
  SW.fromAmount = input ? input.value : '';
  const amt = parseFloat(SW.fromAmount);
  // USD preview from
  const fromUsd = document.getElementById('sw-from-usd');
  if (fromUsd) {
    const fromUsdVal = amt > 0 && SW.fromToken && SW.fromToken.price > 0 ? (amt * SW.fromToken.price) : null;
    fromUsd.textContent = fromUsdVal != null ? `≈ ${_formatCurrencyDisplay(fromUsdVal)}` : '≈ —';
  }
  // Hide to amount, reset
  const toAmtEl = document.getElementById('sw-to-amount');
  if (toAmtEl) { toAmtEl.textContent = '—'; toAmtEl.style.color = 'var(--accent-green)'; }
  const _toUsdEl = document.getElementById('sw-to-usd');
  if (_toUsdEl) _toUsdEl.textContent = '≈ $0.00';
  {const _ip=document.getElementById('sw-info-panel');if(_ip)_ip.style.display='none';}
  document.getElementById('sw-dex-compare').style.display = 'none';
  {const _sb=document.getElementById('sw-split-badge');if(_sb)_sb.style.display='none';}
  {const _sq=document.getElementById('sw-slip-quick');if(_sq)_sq.style.display='none';}
  {const _sd=document.getElementById('sw-selected-dex-badge');if(_sd)_sd.style.display='none';}
  document.getElementById('sw-error-box').style.display = 'none';
  swUpdateButton();
  if (!amt || amt <= 0) {
    document.getElementById('sw-quote-loading').style.display = 'none';
    return;
  }
  // Debounce quote fetch
  clearTimeout(SW.quoteTimer);
  SW.quoteTimer = setTimeout(swFetchQuotes, 600);
}

function swSetMax() {
  if (!SW.walletConnected || !SW.fromToken) return;
  const input = document.getElementById('sw-from-amount');
  if (!input) return;
  var bal = parseFloat(SW.fromToken.balance) || 0;
  // blur + readOnly prevents mobile keyboard from opening on programmatic value set
  input.blur();
  input.readOnly = true;
  // Use exact JS string representation — no toFixed truncation
  input.value = bal > 0 ? String(bal) : '0';
  input.readOnly = false;
  swOnAmountChange();
}

async function _swFetchFromBalanceLive(onDone) {
  const chainId    = SW.network?.chainId;
  const walletAddr = SW.walletAddress;
  const token      = SW.fromToken;
  if (!walletAddr || !token || !chainId || typeof ethers === 'undefined') return;

  const fbEl = document.getElementById('sw-from-bal');
  if (fbEl) { fbEl.textContent = '\u2026'; fbEl.style.color = 'var(--accent-primary)'; }

  try {
    const contract = token.contract || token.address || '';
    const isNative = !contract || /^0x0+$/.test(contract)
      || contract.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
      || token.sym === (typeof nativeSym !== 'undefined' ? nativeSym : '');

    let bal = 0;
    if (isNative) {
      // _swWithFallback: tries each RPC with 5s timeout, switches on fail/hang
      const raw = await _nxsw__swWithFallback(chainId, _p => _p.getBalance(walletAddr));
      bal = parseFloat(ethers.formatEther(raw));
    } else {
      const ERC20_ABI = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'];
      const dec = token.decimals !== undefined ? token.decimals
        : await _nxsw__swWithFallback(chainId, _p => new ethers.Contract(contract, ERC20_ABI, _p).decimals()).catch(() => 18);
      const raw = await _nxsw__swWithFallback(chainId, _p => new ethers.Contract(contract, ERC20_ABI, _p).balanceOf(walletAddr));
      bal = parseFloat(ethers.formatUnits(raw, dec));
    }

    // Stale check — chain or wallet changed mid-flight
    if (SW.walletAddress !== walletAddr || SW.network?.chainId !== chainId) return;

    SW.fromToken.balance = bal;
    if (fbEl) {
      fbEl.textContent = bal.toFixed(4) + ' ' + token.sym;
      fbEl.style.color = 'var(--accent-green)';
      setTimeout(() => { if (fbEl) fbEl.style.color = 'var(--text-secondary)'; }, 1200);
    }
    if (onDone) onDone(bal);
  } catch(e) {
    console.warn('[One] Live bal fetch failed:', e.message);
    if (fbEl) {
      fbEl.textContent = (SW.fromToken.balance > 0 ? SW.fromToken.balance.toFixed(4) + ' ' + token.sym : '\u2014');
      fbEl.style.color = 'var(--text-secondary)';
    }
    if (onDone) onDone(SW.fromToken.balance || 0);
  }
}

/* ── Fetch Quotes (simulated) ── */
function swFetchQuotes() {
  const amt = parseFloat(SW.fromAmount);
  if (!amt || amt <= 0) return;
  if (!SW.fromToken || !SW.toToken) return;
  if (SW.fromToken.sym === SW.toToken.sym) return;

  // ── Wallet Guard: no wallet → no API call ──
  if (!SW.walletConnected || !SW.walletAddress) {
    const errBox = document.getElementById('sw-error-box');
    if (errBox) {
      errBox.style.display = 'flex';
      const errMsg = errBox.querySelector('.sw-error-msg') || errBox;
      errMsg.textContent = 'Please connect a wallet to get swap quotes.';
    }
    document.getElementById('sw-quote-loading').style.display = 'none';
    return;
  }

  SW._userSelectedDexIdx = null; // reset user selection on new quote request
  SW._manualDexName = null;       // reset manual pick on new quote
  SW._manualDexIdx = null;
  SW._manualRouteKey = null;      // reset unique route key
  document.getElementById('sw-quote-loading').style.display = 'flex';
  document.getElementById('sw-dex-compare').style.display = 'none';
  {const _ip=document.getElementById('sw-info-panel');if(_ip)_ip.style.display='none';}
  {const _sq=document.getElementById('sw-slip-quick');if(_sq)_sq.style.display='none';}
  document.getElementById('sw-error-box').style.display = 'none';

  const dexNames = DEX_LIST.map(d => d.name);
  let idx = 0;
  const scanEl = document.getElementById('sw-scan-dex-name');
  clearInterval(SW.scanDexInterval);
  SW.scanDexInterval = setInterval(() => {
    if (scanEl && idx < dexNames.length) scanEl.textContent = dexNames[idx++];
  }, 150);

  // Fetch real prices then generate quotes
  swFetchLivePricesAndGenerateQuotes(amt);
}




// Tries each RPC in order with the actual operation fn(provider) — no ping test needed
// Per-chain health index for swap fallback (same pattern as _withRpcFallback)
const _nxsw__swRpcHealthIdx = {};
// 429 blacklist: rpc -> timestamp until which it is banned
const _nxsw__swRpc429Until = {};

async function _nxsw__swWithFallback(chainId, fn, timeoutMs = 8000) {
  const rpcs = (typeof _getRpcListForChain === 'function')
    ? _getRpcListForChain(chainId)
    : (typeof getChainRpcs === 'function' ? getChainRpcs(chainId) : []);
  if (!rpcs || rpcs.length === 0) return null;

  const now = Date.now();

  // Start from last known good RPC index
  const startIdx = Math.min(_nxsw__swRpcHealthIdx[chainId] || 0, rpcs.length - 1);
  const orderedRpcs = [...rpcs.slice(startIdx), ...rpcs.slice(0, startIdx)];

  // Non-banned RPCs first, banned ones as last resort
  const available = orderedRpcs.filter(r => !_nxsw__swRpc429Until[r] || now > _nxsw__swRpc429Until[r]);
  const banned    = orderedRpcs.filter(r =>  _nxsw__swRpc429Until[r] && now <= _nxsw__swRpc429Until[r]);
  const tryOrder  = [...available, ...banned];

  let lastErr;
  for (const _rpc of tryOrder) {
    try {
      const _p = _makeProvider(_rpc, chainId);
      const _result = await Promise.race([
        fn(_p),
        new Promise((_, rej) => setTimeout(() => rej(new Error('RPC timeout: ' + _rpc)), timeoutMs)),
      ]);
      // Success - record healthy index + clear any 429 ban
      const origIdx = rpcs.indexOf(_rpc);
      if (origIdx >= 0) _nxsw__swRpcHealthIdx[chainId] = origIdx;
      delete _nxsw__swRpc429Until[_rpc];
      return _result;
    } catch(e) {
      lastErr = e;
      const msg = String(e?.message || '') + String(e?.info?.error?.message || '') + String(e?.error?.message || '');
      const code = e?.status || e?.code || e?.error?.code || 0;

      // ── Advance health index so NEXT call starts from the next RPC, not this failed one ──
      const failedOrigIdx = rpcs.indexOf(_rpc);
      if (failedOrigIdx >= 0) {
        _nxsw__swRpcHealthIdx[chainId] = (failedOrigIdx + 1) % rpcs.length;
      }

      // 429 Too Many Requests - ban this RPC for 15 seconds
      if (code === 429 || msg.includes('429') || msg.toLowerCase().includes('too many requests') || msg.toLowerCase().includes('rate limit')) {
        _nxsw__swRpc429Until[_rpc] = Date.now() + 15000;
      }

      // Evict failed provider from cache so next attempt gets fresh connection
      if (typeof _providerCache !== 'undefined') {
        const _key = _rpc + ':' + (chainId || 0);
        delete _providerCache[_key];
      }
      continue;
    }
  }
  // All RPCs failed — reset health index to 0 so next call starts fresh
  _nxsw__swRpcHealthIdx[chainId] = 0;
  throw lastErr || new Error('All RPCs failed for chainId ' + chainId);
}

// Convenience: get a working provider — does real liveness test, returns first responding RPC
async function _getSwapProvider(chainId) {
  const rpcs = (typeof _getRpcListForChain === 'function')
    ? _getRpcListForChain(chainId)
    : (typeof getChainRpcs === 'function' ? getChainRpcs(chainId) : []);
  if (!rpcs || rpcs.length === 0) return null;

  // Start from last known good index (shared with _swWithFallback)
  const startIdx = Math.min(_nxsw__swRpcHealthIdx[chainId] || 0, rpcs.length - 1);
  const orderedRpcs = [...rpcs.slice(startIdx), ...rpcs.slice(0, startIdx)];

  // Real liveness test: probe each RPC with getBlockNumber(), return first that responds
  for (const rpc of orderedRpcs) {
    try {
      const _p = _makeProvider(rpc, chainId);
      await Promise.race([
        _p.getBlockNumber(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('probe timeout')), 3000)),
      ]);
      // Record this as healthy
      const origIdx = rpcs.indexOf(rpc);
      if (origIdx >= 0) _nxsw__swRpcHealthIdx[chainId] = origIdx;
      return _p; // ✅ this RPC is alive
    } catch(_) {
      // Evict broken provider from cache + advance health index
      const key = rpc + ':' + (chainId || 0);
      if (typeof _providerCache !== 'undefined') delete _providerCache[key];
      const failIdx = rpcs.indexOf(rpc);
      if (failIdx >= 0) _nxsw__swRpcHealthIdx[chainId] = (failIdx + 1) % rpcs.length;
    }
  }
  // All probes failed — return provider for first RPC as last resort
  _nxsw__swRpcHealthIdx[chainId] = 0;
  return _makeProvider(rpcs[0], chainId);
}

// ── Ensure custom/chainlist chain's native token price is in _globalPriceCache ──
// Called before gas estimation — fills cache so _getNativePrice() returns a valid USD value
async function _swEnsureNativeTokenPrice(chainId) {
  try {
    // 1. Try to find native token's cgId from savedTokens
    const _allToks = (typeof loadSavedTokens === 'function') ? loadSavedTokens() : [];
    const _nativeTok = _allToks.find(t => t.chainId === chainId && (t.isNative || !t.contract));
    if (!_nativeTok) return; // no native token saved → nothing to do

    const cgId = _nativeTok.cgId;

    // 2. Already in cache and fresh → skip
    if (cgId && typeof _globalPriceCache !== 'undefined' && _globalPriceCache && _globalPriceCache[cgId]?.usd) return;

    // 3. Check .price field set by home section — most reliable for custom/chainlist chains
    //    Store it in globalPriceCache so all subsequent lookups find it instantly
    if (_nativeTok.price > 0) {
      if (typeof _globalPriceCache === 'undefined' || !_globalPriceCache) window._globalPriceCache = {};
      // Store under cgId if available, also under symbol for symbol-based lookups
      if (cgId) _globalPriceCache[cgId] = { usd: _nativeTok.price, usd_24h_change: 0 };
      if (_nativeTok.sub) _globalPriceCache[_nativeTok.sub.toLowerCase()] = { usd: _nativeTok.price, usd_24h_change: 0 };
      // Sync SW token price fields
      if (SW.fromToken && !SW.fromToken.contract && !SW.fromToken.price) SW.fromToken.price = _nativeTok.price;
      if (SW.toToken   && !SW.toToken.contract   && !SW.toToken.price)   SW.toToken.price   = _nativeTok.price;
      return;
    }

    // 4. No cgId and no saved price → cannot fetch
    if (!cgId) return;

    // 5. Fetch from CoinGecko
    const data = await _cgFetch(`simple/price?ids=${encodeURIComponent(cgId)}&vs_currencies=usd&include_24hr_change=true`);
    if (data && data[cgId] && data[cgId].usd) {
      if (typeof _globalPriceCache === 'undefined' || !_globalPriceCache) {
        window._globalPriceCache = {};
      }
      _globalPriceCache[cgId] = data[cgId];
      // Also index by symbol for symbol-based lookups
      if (_nativeTok.sub) _globalPriceCache[_nativeTok.sub.toLowerCase()] = data[cgId];
      // Also update the token's .price field in SW state if it matches
      if (SW.fromToken && !SW.fromToken.contract && !SW.fromToken.price) {
        SW.fromToken.price = data[cgId].usd;
      }
      if (SW.toToken && !SW.toToken.contract && !SW.toToken.price) {
        SW.toToken.price = data[cgId].usd;
      }
    }
  } catch(_e) {
    // Silent fail — gas fee will show in gwei format instead of USD
  }
}