

// Fetch live prices + real swap tx data during quote phase, cache for swap
async function swFetchLivePricesAndGenerateQuotes(fromAmt) {
  const fromToken = SW.fromToken;
  const toToken   = SW.toToken;
  const chainId   = SW.network.chainId;

  // ── Pre-fetch live gas price ONCE — reused by all DEX gas estimates ──
  // Uses baseFeePerGas + priorityFee (actual cost), NOT maxFeePerGas (overestimate)
  (async () => {
    try {
      const [_fd, _block] = await Promise.all([
        _nxsw__swWithFallback(chainId, _p => _p.getFeeData()),
        _nxsw__swWithFallback(chainId, _p => _p.getBlock('latest')),
      ]);
      if (_fd) {
        let _effectiveGasPrice;
        const _baseFee     = _block?.baseFeePerGas;          // EIP-1559 base fee from latest block
        const _priorityFee = _fd.maxPriorityFeePerGas;       // tip (validator fee)
        if (_baseFee && _baseFee > 0n) {
          // EIP-1559 chain: actual = baseFee + priorityFee (capped at maxFeePerGas)
          const _tip = (_priorityFee && _priorityFee > 0n) ? _priorityFee : 1000000n; // 0.001 Gwei min tip
          _effectiveGasPrice = _baseFee + _tip;
          if (_fd.maxFeePerGas && _effectiveGasPrice > _fd.maxFeePerGas)
            _effectiveGasPrice = _fd.maxFeePerGas; // cap at max
        } else {
          // Legacy chain (BSC, etc): use gasPrice directly
          _effectiveGasPrice = _fd.gasPrice || _fd.maxFeePerGas;
        }
        if (_effectiveGasPrice && _effectiveGasPrice > 0n)
          SW._lastGasPriceGwei = Number(_effectiveGasPrice) / 1e9;
      }
    } catch(_) {}
  })();

  // ── Ensure custom/chainlist chain native token price is cached for USD gas display ──
  await _swEnsureNativeTokenPrice(chainId);

  const myFetchId = ++SW._fetchId; // capture current fetch ID — if chain changes, SW._fetchId will differ

  // ── Canonical address constants per API type ──
  const ZERO_ADDR  = '0x0000000000000000000000000000000000000000';
  const EEEE_ADDR  = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
  const NATIVE_SYM = { 1:'ETH', 56:'BNB', 137:'MATIC', 42161:'ETH', 10:'ETH', 8453:'ETH', 43114:'AVAX' };

  // ── Reliable native detection: contract null/empty/0x000/0xEeee = native ──
  function _isNativeToken(token) {
    const c = (token.contract || token.address || '').toLowerCase().replace(/^0x/, '');
    return !c || c === '' || /^0+$/.test(c) || c === 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
  }

  const isNative   = _isNativeToken(fromToken);
  const isToNative = _isNativeToken(toToken);

  // ── Per-API token address helpers — always return a valid address or null ──
  // Native token address helper (Velora, KyberSwap etc.): native = 0xEeee..., ERC20 = contract address
  function addrEeee(token, isNat) {
    if (isNat) return EEEE_ADDR;
    const c = token.contract || token.address || token.contractAddress || '';
    return (c && c.startsWith('0x') && c.length === 42) ? c : null;
  }
  // Odos: native = 0x000..., ERC20 = contract address
  function addrZero(token, isNat) {
    if (isNat) return ZERO_ADDR;
    const c = token.contract || token.address || token.contractAddress || '';
    return (c && c.startsWith('0x') && c.length === 42) ? c : null;
  }
  // LiFi: native = symbol string, ERC20 = contract address
  function addrLifi(token, isNat) {
    if (isNat) return NATIVE_SYM[chainId] || 'ETH';
    const c = token.contract || token.address || token.contractAddress || '';
    return (c && c.startsWith('0x') && c.length === 42) ? c : null;
  }

  // ── Guard: if non-native token has no valid contract → skip all API calls ──
  const fromContractOk = isNative   || !!(fromToken.contract || fromToken.address || '').match(/^0x[0-9a-fA-F]{40}$/);
  const toContractOk   = isToNative || !!(toToken.contract   || toToken.address   || '').match(/^0x[0-9a-fA-F]{40}$/);
  if (!fromContractOk || !toContractOk) {
    console.warn('[One] Token missing contract address — cannot fetch swap routes.',
      'from:', fromToken.sym, fromToken.contract,
      'to:',   toToken.sym,   toToken.contract);
  }
  const canFetchRoutes = fromContractOk && toContractOk;

  // ── Safe amountWei: avoid floating point overflow ──
  // Use string-based shifting to stay in BigInt territory
  function toWei(amount, decimals) {
    try {
      const dec = Math.min(decimals || 18, 18);
      // Convert to string with enough precision, then shift decimal
      const str = amount.toFixed(dec + 2);
      const [intPart, fracPart = ''] = str.split('.');
      const frac = (fracPart + '0'.repeat(dec)).slice(0, dec);
      return (BigInt(intPart) * BigInt('1' + '0'.repeat(dec)) + BigInt(frac)).toString();
    } catch(e) {
      // Fallback: safe for amounts < 10^9
      return String(Math.floor(amount * Math.pow(10, Math.min(decimals || 18, 9))));
    }
  }

  const amountWei = toWei(fromAmt, fromToken.decimals || 18);

  // ── Wallet Guard: no wallet connected → no API call ──
  if (!SW.walletConnected || !SW.walletAddress) {
    clearInterval(SW.scanDexInterval);
    document.getElementById('sw-quote-loading').style.display = 'none';
    const errBox = document.getElementById('sw-error-box');
    if (errBox) {
      errBox.style.display = 'flex';
      const errMsg = errBox.querySelector('.sw-error-msg') || errBox;
      errMsg.textContent = 'Please connect a wallet to get swap quotes.';
    }
    return;
  }

  const userAddr  = SW.walletAddress;
  const slip      = SW.slippage || 0.5;

  // Helper: get price for a token
  async function _fetchTokenPrice(token) {
    // 1. globalPriceCache via cgId (already fetched by home section — no extra network call needed)
    if (typeof _globalPriceCache !== 'undefined' && _globalPriceCache && token.cgId) {
      const cached = _globalPriceCache[token.cgId];
      if (cached && cached.usd > 0) return cached.usd;
    }
    // 2. globalPriceCache symbol-based lookup
    if (typeof _globalPriceCache !== 'undefined' && _globalPriceCache) {
      for (const k of Object.keys(_globalPriceCache)) {
        if (k.toLowerCase() === (token.sym || '').toLowerCase()) {
          const v = _globalPriceCache[k];
          if (v && v.usd > 0) return v.usd;
        }
      }
    }
    // 3. .price field set by home section (most reliable for custom/chainlist chains)
    if (token.price > 0) return token.price;
    // 4. savedTokens .price field (in case token object is a shallow copy)
    try {
      const _st = (typeof loadSavedTokens === 'function') ? loadSavedTokens() : [];
      const _match = _st.find(t =>
        (token.cgId && t.cgId === token.cgId) ||
        (token.contract && t.contract && t.contract.toLowerCase() === token.contract.toLowerCase() && t.chainId === (SW.network?.chainId)) ||
        (token.sym && t.sub && t.sub.toLowerCase() === token.sym.toLowerCase() && t.chainId === (SW.network?.chainId))
      );
      if (_match?.price > 0) return _match.price;
      // also try globalPriceCache with matched token's cgId
      if (_match?.cgId && typeof _globalPriceCache !== 'undefined' && _globalPriceCache) {
        const _mp = _globalPriceCache[_match.cgId]; if (_mp?.usd > 0) return _mp.usd;
      }
    } catch(_) {}
    // 5. Stablecoins always = $1
    const sym = (token.sym || '').toUpperCase();
    if (/^(USDC|USDT|DAI|BUSD|TUSD|USDP|GUSD|FRAX|LUSD|CRVUSD|PYUSD)$/.test(sym)) return 1;
    // 6. CoinGecko fallback (no CORS issues, works for all chains)
    const cgId = token.cgId || sym.toLowerCase();
    try {
      const j3 = await _cgFetch(`simple/price?ids=${cgId}&vs_currencies=usd`);
      if (j3[cgId] && j3[cgId].usd) {
        // Cache the fetched price so subsequent calls are instant
        if (typeof _globalPriceCache !== 'undefined') {
          if (!_globalPriceCache) window._globalPriceCache = {};
          _globalPriceCache[cgId] = j3[cgId];
        }
        return j3[cgId].usd;
      }
    } catch(_) {}
    return 0;
  }

  // ── Fetch real swap tx data from each API ──
  // Returns { to, data, value, gas, allowanceTarget?, source } or null

  // Pre-compute from-token USD value once — used by all minimum-amount guards
  // Uses _globalPriceCache first (already loaded), then _fetchTokenPrice as fallback
  // If price still unavailable, uses a conservative hardcoded fallback so guards always work
  function _getFromPriceSync() {
    if (typeof _globalPriceCache !== 'undefined' && _globalPriceCache) {
      // Try by cgId
      if (fromToken.cgId && _globalPriceCache[fromToken.cgId]?.usd > 0)
        return _globalPriceCache[fromToken.cgId].usd;
      // Try by symbol match
      const sym = (fromToken.sym || '').toLowerCase();
      for (const [k, v] of Object.entries(_globalPriceCache)) {
        if (k.toLowerCase() === sym && v?.usd > 0) return v.usd;
      }
    }
    // Conservative hardcoded fallbacks for common native tokens
    const _FALLBACK_PRICES = {
      'ETH':1800, 'WETH':1800, 'BNB':300, 'MATIC':0.5,
      'AVAX':25, 'OP':1.5, 'ARB':0.8, 'BASE':0,
    };
    const fsym = (fromToken.sym || '').toUpperCase();
    return _FALLBACK_PRICES[fsym] || 0;
  }

  let _fromUsdVal = _getFromPriceSync() * fromAmt;
  // If sync price was 0, try async fetch (won't block the API calls)
  if (_fromUsdVal === 0) {
    _fetchTokenPrice(fromToken).then(p => {
      _fromUsdVal = p * fromAmt;
    }).catch(() => {});
  }

  // Minimum USD thresholds per aggregator (below this → skip to avoid 400 errors)
  const _MIN_RANGO     = 0.50;  // Rango
  const _MIN_SYMBIOSIS = 0.50;  // Symbiosis

  // ── Proxy-aware fetch for swap APIs: native bridge → direct → relay/GET proxies ──
  const _SW_RELAY_PROXIES = [
    'https://project-dn5l2.vercel.app/api/relay',
    'https://oneproxy.alihasi.deno.net/relay',
    'https://one-wallet-proxy.netlify.app/.netlify/functions/relay',
    'https://one-relay-workers.alihasan09765.workers.dev/relay',
    'https://seslyfqxbbrgpxhtprhu.supabase.co/functions/v1/relay',
  ];
  const _SW_GET_PROXIES   = [
    'https://project-dn5l2.vercel.app/api/proxy?url=',
    'https://oneproxy.alihasi.deno.net/proxy?url=',
    'https://one-wallet-proxy.netlify.app/.netlify/functions/proxy?url=',
    'https://one-relay-workers.alihasan09765.workers.dev/proxy?url=',
    'https://seslyfqxbbrgpxhtprhu.supabase.co/functions/v1/proxy?url=',
  ];

  async function _swProxyFetch(url, init, ms) {
    ms = ms || 20000;
    const isPost = init && (init.method || 'GET').toUpperCase() === 'POST';
    // 1. Native Android bridge (GET only)
    if (!isPost && window.nxBridgeGet) {
      try {
        const _nj = await nxBridgeGet(url, ms);
        if (_nj != null) return { ok: true, status: 200, json: () => Promise.resolve(_nj), text: () => Promise.resolve(JSON.stringify(_nj)) };
      } catch (_) {}
    }
    // 2. Direct fetch
    try {
      const _r = await fetch(url, { ...(init || {}), signal: AbortSignal.timeout(ms) });
      if (_r.ok) return _r;
    } catch (_) {}
    // 3. Proxy fallback
    if (isPost) {
      for (const _p of _SW_RELAY_PROXIES) {
        try {
          const _rb = JSON.stringify({ url, method: 'POST', headers: (init && init.headers) || {}, body: init && init.body });
          const _r = await fetch(_p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: _rb, signal: AbortSignal.timeout(ms) });
          if (_r.ok) return _r;
        } catch (_) {}
      }
    } else {
      for (const _p of _SW_GET_PROXIES) {
        try {
          const _r = await fetch(_p + encodeURIComponent(url), { ...(init || {}), signal: AbortSignal.timeout(ms) });
          if (_r.ok) return _r;
        } catch (_) {}
      }
    }
    throw new Error('_swProxyFetch: all failed for ' + url.split('?')[0]);
  }

  async function _quoteLiFi() {
    // LiFi multi-route: /advanced/routes — ALL routes (best + alternatives)
    // Real TX is built fresh at execution time via /advanced/stepTransaction for every route
    // This avoids stale calldata from /quote and ensures reliable on-chain transactions
    try {
      const fromAddr = isNative   ? '0x0000000000000000000000000000000000000000' : (fromToken.contract || fromToken.address || '');
      const toAddr   = isToNative ? '0x0000000000000000000000000000000000000000' : (toToken.contract   || toToken.address   || '');
      if (!fromAddr || !toAddr) return null;

      const routesBody = {
        fromChainId: chainId, toChainId: chainId,
        fromTokenAddress: fromAddr, toTokenAddress: toAddr,
        fromAmount: amountWei,
        fromAddress: userAddr,
        options: {
          slippage: slip / 100,
          integrator: 'OneWallet',
          order: 'RECOMMENDED',
        },
      };

      const routesResp = await _swProxyFetch('https://li.quest/v1/advanced/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-lifi-api-key': 'b3e55edd-de70-4578-b761-cd2aac0fbae0.685a5adf-2580-486e-a8ff-1df4992b3f2e' },
        body: JSON.stringify(routesBody),
        signal: AbortSignal.timeout(10000),
      });
      if (!routesResp.ok) { if(window._swLog)window._swLog('LiFi','FAIL',_httpErr(routesResp.status)); return null; }

      const rj = await routesResp.json().catch(() => null);
      const allRoutes = rj?.routes || [];
      if (!allRoutes.length) { if(window._swLog)window._swLog('LiFi','FAIL','no routes'); return null; }

      const results = [];
      const seenTools = new Set();

      for (const rt of allRoutes) {
        const step = rt.steps && rt.steps[0];
        if (!step) continue;
        const outWei = String(rt.toAmount || rt.toAmountMin || '0');
        if (outWei === '0') continue;
        const toolName = step.toolDetails?.name || step.tool || 'LiFi';
        if (seenTools.has(toolName)) continue;
        seenTools.add(toolName);
        // Store full route + step — real TX built at execution via /advanced/stepTransaction
        // Extract API-provided gas cost in USD (LiFi estimate.gasCosts[].amountUSD)
        const _lifiGasCosts = step.estimate?.gasCosts || [];
        const _lifiGasUSD = _lifiGasCosts.reduce((s, c) => s + parseFloat(c.amountUSD || 0), 0);
        // LiFi protocol/integrator fee from feeCosts (separate from gasCosts)
        const _lifiFeeCosts = [
          ...(rt.estimate?.feeCosts || []),
          ...(rt.steps?.flatMap(st => st.estimate?.feeCosts || []) || []),
        ];
        const _lifiProtoFeeUsd = _lifiFeeCosts.reduce((s, f) => s + parseFloat(f.amountUSD || 0), 0);
        results.push({
          to: '0x0000000000000000000000000000000000000001', // placeholder until execution
          data: '0x',
          value: '0x0',
          gas: Number(step.estimate?.gasCosts?.[0]?.estimate || 300000),
          source: 'lifi',
          swapApiDisplay: toolName,
          // LI.FI provides router logo directly — use it instead of CoinGecko static map
          routerLogoURI: step.toolDetails?.logoURI || null,
          outputWei: outWei,
          _lifiStep: step,    // injected with wallet address at execution
          _lifiRoute: rt,
          _priceOnly: true,   // triggers stepTransaction call in swHandleAction
          _apiGasUSD: _lifiGasUSD > 0 ? _lifiGasUSD : null, // API-provided gas cost → shown directly in route card
          _swProtocolFeeUsd: parseFloat(_lifiProtoFeeUsd.toFixed(4)), // protocol fee USD (0 = FREE)
        });
        if(window._swLog) window._swLog('LiFi', 'OK', 'via '+toolName+' out:'+outWei);
      }

      return results.length ? results : null;
    } catch(e) { if(window._swLog) window._swLog('LiFi', 'FAIL', 'err: '+(e.message||String(e)).slice(0,60)); return null; }
  }

  async function _quoteOdos() {
    // Odos V2 — supports any EVM chain via chainId. No whitelist needed.
    try {
      const inToken  = addrZero(fromToken, isNative);
      const outToken = addrZero(toToken,   isToNative);
      if (!inToken || !outToken) { if(window._swLog)window._swLog('Odos','FAIL','no addr'); return null; }
      // Step 1: quote/v2
      const quoteR = await _swProxyFetch('https://api.odos.xyz/sor/quote/v2', {
        method:'POST', headers:{'Content-Type':'application/json','x-api-key':'7d27cb7c-404e-4fd1-af63-4ef048678e2f'},
        body: JSON.stringify({ chainId, inputTokens:[{tokenAddress:inToken,amount:amountWei}], outputTokens:[{tokenAddress:outToken,proportion:1}], userAddr:userAddr, slippageLimitPercent:slip, compact:true, simple:false }),
        signal:AbortSignal.timeout(8000)
      });
      if (!quoteR.ok) { if(window._swLog)window._swLog('Odos','FAIL',_httpErr(quoteR.status)); return null; }
      const quoteJ = await quoteR.json();
      if (!quoteJ.pathId) { if(window._swLog)window._swLog('Odos','FAIL','bad resp'); return null; }
      const outWei = String(quoteJ.outAmounts?.[0] || '0');
      if (outWei === '0') { if(window._swLog)window._swLog('Odos','FAIL','zero output'); return null; }
      // Step 2: assemble
      const asmR = await _swProxyFetch('https://api.odos.xyz/sor/assemble', {
        method:'POST', headers:{'Content-Type':'application/json','x-api-key':'7d27cb7c-404e-4fd1-af63-4ef048678e2f'},
        body: JSON.stringify({ pathId:quoteJ.pathId, userAddr:userAddr, simulate:false }),
        signal:AbortSignal.timeout(8000)
      });
      if (!asmR.ok) { if(window._swLog)window._swLog('Odos','FAIL','assemble: '+_httpErr(asmR.status)); return null; }
      const asmJ = await asmR.json();
      if (!asmJ.transaction?.to) { if(window._swLog)window._swLog('Odos','FAIL','bad resp'); return null; }
      // Odos official: quoteJ.gasEstimateValue = gas cost in USD (from /sor/quote/v2 response)
      const _odosGasUSD = parseFloat(quoteJ.gasEstimateValue || 0) || null;
      if(window._swLog) window._swLog('Odos', 'OK', 'out: '+outWei);
      return { to:asmJ.transaction.to, data:asmJ.transaction.data, value:asmJ.transaction.value||'0x0', gas:Number(asmJ.transaction.gas)||300000, source:'odos', outputWei:outWei, _apiGasUSD: _odosGasUSD > 0 ? _odosGasUSD : null };
    } catch(e) { if(window._swLog) window._swLog('Odos', 'FAIL', 'err: '+(e.message||String(e)).slice(0,60)); return null; }
  }

  async function _quote1inch() {
    // 1inch Swap API v6.0 — direct call to official 1inch API with API key
    // Endpoint: https://api.1inch.dev/swap/v6.0/{chainId}/swap
    // Requires Authorization: Bearer <API_KEY> header
    const INCH_CHAINS = {1:true,56:true,137:true,42161:true,10:true,8453:true,43114:true,324:true,250:true,100:true,59144:true,534352:true,81457:true};
    if (!INCH_CHAINS[chainId]) { if(window._swLog)window._swLog('1inch','FAIL','chain unsupported'); return null; }
    try {
      const srcAddr = isNative   ? '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' : (fromToken.contract || fromToken.address || '');
      const dstAddr = isToNative ? '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' : (toToken.contract   || toToken.address   || '');
      if (!srcAddr || !dstAddr) return null;
      // 1inch slippage is in percent (0.5 = 0.5%), max 50
      const slippagePct = Math.min(slip, 50).toFixed(2);
      const params = new URLSearchParams({
        src:            srcAddr,
        dst:            dstAddr,
        amount:         amountWei,
        from:           userAddr,
        slippage:       slippagePct,
        disableEstimate:'true',
        allowPartialFill:'false',
      });
      const r = await fetch(
        `https://api.1inch.dev/swap/v6.0/${chainId}/swap?${params}`,
        {
          headers: {
            'Authorization': 'Bearer ' + _API_KEYS.INCH_API,
            'Accept':        'application/json',
          },
          signal: AbortSignal.timeout(9000)
        }
      );
      if (!r.ok) { const _ej = await r.json().catch(()=>null); if(window._swLog)window._swLog('1inch','FAIL',_httpErr(r.status)+(_ej?.description?' — '+String(_ej.description).slice(0,40):_ej?.error?' — '+String(_ej.error).slice(0,40):'')); return null; }
      const j = await r.json();
      // 1inch v6 response: { dstAmount, tx: { to, data, value, gas } }
      if (!j.tx?.to || !j.tx?.data) { if(window._swLog)window._swLog('1inch','FAIL','bad resp: '+JSON.stringify(j).slice(0,60)); return null; }
      const outWei = String(j.dstAmount || '0');
      if (outWei === '0') { if(window._swLog)window._swLog('1inch','FAIL','zero output'); return null; }
      // 1inch v6: no direct gas USD field — compute tentative estimate from tx.gas × live gas price
      // Real calldata available → RPC estimateGas in queue will refine this
      const txValue = j.tx.value && j.tx.value !== '0' ? j.tx.value : '0x0';
      const _inchGasUnits = Number(j.tx.gas) || 300000;
      let _inchApiGasUSD = null;
      try {
        const _inchGasGwei = SW._lastGasPriceGwei || 1;
        const _inchEthPrice = SW?.fromToken?.price || SW?.toToken?.price || SW?._nativePriceUSD || 0;
        if (_inchEthPrice > 0) {
          const _inchGasEth = (_inchGasUnits * _inchGasGwei * 1e9) / 1e18;
          _inchApiGasUSD = _inchGasEth * _inchEthPrice;
        }
      } catch(_) {}
      if(window._swLog) window._swLog('1inch', 'OK', 'out: '+outWei);
      return { to: j.tx.to, data: j.tx.data, value: txValue, gas: _inchGasUnits, source: '1inch', outputWei: outWei, _apiGasUSD: _inchApiGasUSD > 0 ? _inchApiGasUSD : null };
    } catch(e) { if(window._swLog) window._swLog('1inch', 'FAIL', 'err: '+(e.message||String(e)).slice(0,60)); return null; }
  }

  async function _quoteSwapApi() {
    // swapapi.dev — authenticated aggregator proxy, 46 EVM chains, returns best-route calldata
    // Runs independently of _quote1inch — no aggregator param, picks best DEX automatically
    try {
      const srcAddr = isNative   ? '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' : (fromToken.contract || fromToken.address || '');
      const dstAddr = isToNative ? '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' : (toToken.contract   || toToken.address   || '');
      if (!srcAddr || !dstAddr) return null;
      const maxSlip = (slip / 100).toFixed(4); // swapapi uses 0–1 decimal (0.5% → 0.005)
      const r = await fetch(
        `https://api.swapapi.dev/v1/swap/${chainId}?tokenIn=${srcAddr}&tokenOut=${dstAddr}&amount=${amountWei}&sender=${userAddr}&maxSlippage=${maxSlip}`,
        {
          signal: AbortSignal.timeout(9000)
        }
      );
      if (!r.ok) { if(window._swLog)window._swLog('SwapAPI','FAIL',_httpErr(r.status)); return null; }
      const j = await r.json();
      if (!j.success || j.data?.status !== 'Successful') { if(window._swLog)window._swLog('SwapAPI','FAIL',j.message||j.error||j.data?.status||'bad resp'); return null; }
      const outWei = String(j.data.expectedAmountOut || '0');
      if (outWei === '0') { if(window._swLog)window._swLog('SwapAPI','FAIL','zero output'); return null; }
      const tx = j.data.tx;
      if (!tx?.to || !tx?.data) { if(window._swLog)window._swLog('SwapAPI','FAIL','bad resp'); return null; }
      const txValue = tx.value && tx.value !== '0' ? tx.value : '0x0';
      // Use actual DEX/aggregator name from response so the correct logo is shown
      // swapapi.dev returns the underlying DEX in j.data.aggregator or j.data.protocol
      const rawDex = (j.data.aggregator || j.data.protocol || j.data.dex || j.data.exchange || j.data.router || '').trim();

      // Normalize SwapAPI DEX names → canonical display names that match SW_DEX_LOGOS keys
      const _SWAPAPI_NAME_MAP = {
        'uniswap_v2':      'Uniswap V2',   'uniswap_v3':      'Uniswap V3',   'uniswap_v4':    'Uniswap V4',
        'uniswapv2':       'Uniswap V2',   'uniswapv3':       'Uniswap V3',   'uniswapv4':     'Uniswap V4',
        'uniswap':         'Uniswap',
        'pancakeswap':     'PancakeSwap',  'pancakeswap_v3':  'PancakeSwap V3','pancakev3':     'PancakeSwap V3',
        'sushiswap':       'SushiSwap',    'sushi':           'SushiSwap',
        'curve':           'Curve',        'curve_finance':   'Curve Finance',
        'balancer':        'Balancer',     'balancer_v2':     'Balancer',
        'dodo':            'DODO',         'dodo_v2':         'DODO',
        'velodrome':       'Velodrome',    'velodrome_v2':    'Velodrome',
        'aerodrome':       'Aerodrome',    'aerodrome_v2':    'Aerodrome',
        'camelot':         'Camelot',      'camelot_v3':      'Camelot',
        'traderjoe':       'Trader Joe',   'trader_joe':      'Trader Joe',    'joe_v2':        'Trader Joe',
        'quickswap':       'QuickSwap',    'quickswap_v3':    'QuickSwap',
        'spookyswap':      'SpookySwap',
        'biswap':          'Biswap',
        'maverick':        'Maverick',     'maverick_v2':     'Maverick',
        'ambient':         'Ambient',
        'kyberswap':       'KyberSwap',    'kyber':           'KyberSwap',
        'odos':            'Odos',
        '1inch':           '1inch',        '1inch_v5':        '1inch',         '1inch_v6':      '1inch',
        '0x':              '0x',           '0x_v4':           '0x',
        'openocean':       'OpenOcean',    'open_ocean':      'OpenOcean',
        'cow':             'CoW Protocol', 'cowswap':         'CoW Protocol',  'cow_protocol':  'CoW Protocol',
        'hashflow':        'Hashflow',
        'clipper':         'Clipper',
        'dydx':            'dYdX',
        'bancor':          'Bancor',
        'izumi':           'Izumi',        'izumi_finance':   'Izumi',
        'zyberswap':       'Zyberswap',
        'rango':           'Rango',
        'squid':           'Squid',
        'lifi':            'LiFi',         'li.fi':           'LiFi',
        'socket':          'Socket',
        'symbiosis':       'Symbiosis',
        'enso':            'Enso',
        'velora':          'Velora',
      };

      const _normalizeSwapApiDex = (raw) => {
        if (!raw) return '';
        const key = raw.toLowerCase().replace(/[\s\-\.]/g, '_');
        if (_SWAPAPI_NAME_MAP[key]) return _SWAPAPI_NAME_MAP[key];
        // Partial prefix match
        for (const [k, v] of Object.entries(_SWAPAPI_NAME_MAP)) {
          if (key.startsWith(k) || k.startsWith(key)) return v;
        }
        // Title-case fallback
        return raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      };

      const displayDex = _normalizeSwapApiDex(rawDex);
      const source = displayDex ? displayDex.toLowerCase().replace(/\s+/g, '') : 'swapapi';
      // swapapi.dev response has NO gasUsd field (confirmed from official docs/schema)
      // Fields available: tx.gas (units string), tx.gasPrice (wei number)
      // Compute gas USD from tx.gas × tx.gasPrice × native ETH price (done later in gas queue)
      const _swapApiGasUnits = Number(tx.gas || 300000);
      const _swapApiGasPriceWei = Number(tx.gasPrice || 0); // gasPrice in wei from response
      let _swapApiGasUSD = null;
      if (_swapApiGasPriceWei > 0) {
        // Compute tentative USD using cached ETH price (may be 0 if price not yet loaded)
        const _swapApiEthPrice = SW?.fromToken?.price || SW?.toToken?.price || 0;
        if (_swapApiEthPrice > 0) {
          const _swapApiGasEth = (_swapApiGasUnits * _swapApiGasPriceWei) / 1e18;
          _swapApiGasUSD = _swapApiGasEth * _swapApiEthPrice;
        }
      }
      return { to: tx.to, data: tx.data, value: txValue, gas: _swapApiGasUnits, source, swapApiDisplay: displayDex || 'SwapAPI', outputWei: outWei, _apiGasUSD: _swapApiGasUSD > 0 ? _swapApiGasUSD : null };
    } catch(e) { if(window._swLog) window._swLog('SwapAPI', 'FAIL', 'err: '+(e.message||String(e)).slice(0,60)); return null; }
  }

  async function _quoteKyber() {
    // KyberSwap V1 API — supports any EVM chain. Slug map used where available, chainId string fallback.
    const KYBER_CHAIN = {1:'ethereum',56:'bsc',137:'polygon',42161:'arbitrum',10:'optimism',8453:'base',43114:'avalanche',250:'fantom',25:'cronos',1313161554:'aurora',1101:'polygon-zkevm',324:'zksync',59144:'linea',534352:'scroll',81457:'blast',7777777:'zora',5000:'mantle',169:'manta-pacific'};
    const slug = KYBER_CHAIN[chainId] || String(chainId);
    const tokenIn  = addrEeee(fromToken, isNative);
    const tokenOut = addrEeee(toToken,   isToNative);
    if (!tokenIn || !tokenOut) return null;
    try {
      const routeR = await fetch(`https://aggregator-api.kyberswap.com/${slug}/api/v1/routes?tokenIn=${tokenIn}&tokenOut=${tokenOut}&amountIn=${amountWei}&origin=${userAddr}`, { headers:{'X-Client-Id':'OneWallet'}, signal:AbortSignal.timeout(7000) });
      if (!routeR.ok) { if(window._swLog)window._swLog('KyberSwap','FAIL','route: '+_httpErr(routeR.status)); return null; }
      const routeJ = await routeR.json();
      if (!routeJ.data?.routeSummary) { if(window._swLog)window._swLog('KyberSwap','FAIL',routeJ.message||routeJ.error||'no route summary'); return null; }
      const encodeR = await fetch(`https://aggregator-api.kyberswap.com/${slug}/api/v1/route/build`, {
        method:'POST', headers:{'Content-Type':'application/json','X-Client-Id':'OneWallet'},
        body:JSON.stringify({ routeSummary:routeJ.data.routeSummary, sender:userAddr, recipient:userAddr, slippageTolerance:Math.round(slip*100), deadline:Math.floor(Date.now()/1000)+1200 }),
        signal:AbortSignal.timeout(7000)
      });
      if (!encodeR.ok) { if(window._swLog)window._swLog('KyberSwap','FAIL','build: '+_httpErr(encodeR.status)); return null; }
      const encodeJ = await encodeR.json();
      if (!encodeJ.data?.data) { if(window._swLog)window._swLog('KyberSwap','FAIL','bad resp'); return null; }
      const outWei = String(routeJ.data.routeSummary.amountOut || '0');
      if (outWei === '0') { if(window._swLog)window._swLog('KyberSwap','FAIL','zero output'); return null; }
      const txValue = isNative ? ('0x' + BigInt(amountWei).toString(16)) : '0x0';
      // KyberSwap: gasUsd confirmed in routeSummary.gasUsd (from /v1/routes endpoint)
      // Also available at routeJ.data.gasUsd (top-level in some responses) — check both
      const _kyberGasUSD = parseFloat(routeJ.data.routeSummary?.gasUsd || routeJ.data.gasUsd || 0) || null;
      if(window._swLog) window._swLog('KyberSwap', 'OK', 'out: '+outWei);
      return { to:routeJ.data.routerAddress, data:encodeJ.data.data, value:txValue, gas:Number(routeJ.data.routeSummary.gas)||300000, source:'kyberswap', outputWei:outWei, _apiGasUSD: _kyberGasUSD > 0 ? _kyberGasUSD : null };
    } catch(e) { if(window._swLog) window._swLog('KyberSwap', 'FAIL', 'err: '+(e.message||String(e)).slice(0,60)); return null; }
  }
  // _quoteSwapApi defined above — swapapi.dev proxy covers chains 1inch API doesn't support
  async function _quoteOpenOcean() {
    // OpenOcean v4 — v3 is deprecated, new endpoint: open-api.openocean.finance/v4/:chain/swap
    // amount = human-readable (without decimals), gasPrice = Gwei without decimals
    const OO_CHAIN = {1:'eth',56:'bsc',137:'polygon',42161:'arbitrum',10:'optimism',8453:'base',43114:'avax'};
    const slug = OO_CHAIN[chainId]; if (!slug) return null;
    try {
      const inAddr  = isNative   ? '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' : fromToken.contract;
      const outAddr = isToNative ? '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' : toToken.contract;
      if (!inAddr || !outAddr) return null;
      const humanAmt = (parseFloat(amountWei) / Math.pow(10, fromToken.decimals || 18)).toFixed(8);
      // v4: /swap returns calldata directly when account is provided; gasPrice in Gwei (no decimals)
      const r = await fetch(`https://open-api.openocean.finance/v4/${slug}/swap?inTokenAddress=${inAddr}&outTokenAddress=${outAddr}&amount=${humanAmt}&slippage=${slip}&account=${userAddr}&gasPrice=5`, { signal:AbortSignal.timeout(7000) });
      if (!r.ok) { if(window._swLog)window._swLog('OpenOcean','FAIL',_httpErr(r.status)); return null; }
      const j = await r.json();
      if (!j.data?.to || !j.data?.data) { if(window._swLog)window._swLog('OpenOcean','FAIL',j.message||j.errorMsg||j.error||'bad resp'); return null; }
      const outWei = String(j.data.outAmount || '0');
      if (outWei === '0') { if(window._swLog)window._swLog('OpenOcean','FAIL','zero output'); return null; }
      // OpenOcean v4: NO gasUsd field (confirmed from official docs/response example)
      // j.data.estimatedGas = gas units (integer)
      // j.data.gasPrice = gasPrice in WEI (e.g. "1000000000" = 1 Gwei) — same unit sent in request scaled
      const _ooGasUnits = Number(j.data.estimatedGas || 300000);
      // j.data.gasPrice comes back in WEI — divide by 1e9 to get Gwei, fallback to SW._lastGasPriceGwei
      const _ooGasPriceWei = Number(j.data.gasPrice || 0) || ((SW._lastGasPriceGwei || 1) * 1e9);
      let _ooGasUSD = null;
      {
        // Always use native chain token price, not swap token price
        const _netId = SW.network?.id || 'base';
        const _cid   = SW.network?.chainId;
        const _netTokens = (typeof TOKENS_BY_NETWORK !== 'undefined' && TOKENS_BY_NETWORK[_netId]) || [];
        const _nativeTok = _netTokens.find(t => !t.contract);
        let _ooNativePrice = 0;
        if (_nativeTok?.cgId && typeof _globalPriceCache !== 'undefined') {
          const _pd = _globalPriceCache[_nativeTok.cgId]; if (_pd?.usd) _ooNativePrice = _pd.usd;
        }
        if (!_ooNativePrice && _nativeTok?.price) _ooNativePrice = _nativeTok.price;
        if (!_ooNativePrice) {
          try {
            const _allToks = (typeof loadSavedTokens === 'function') ? loadSavedTokens() : [];
            const _nt2 = _allToks.find(t => t.chainId === _cid && (t.isNative || !t.contract));
            if (_nt2?.cgId && typeof _globalPriceCache !== 'undefined') {
              const _pd2 = _globalPriceCache[_nt2.cgId]; if (_pd2?.usd) _ooNativePrice = _pd2.usd;
            }
            if (!_ooNativePrice && _nt2?.price > 0) _ooNativePrice = _nt2.price;
          } catch(_e) {}
        }
        // Fallback: if fromToken or toToken IS native, use its price
        if (!_ooNativePrice && SW.fromToken && !SW.fromToken.contract) _ooNativePrice = SW.fromToken.price || 0;
        if (!_ooNativePrice && SW.toToken   && !SW.toToken.contract)   _ooNativePrice = SW.toToken.price   || 0;
        if (_ooNativePrice > 0 && _ooGasPriceWei > 0) {
          const _ooGasEth = (_ooGasUnits * _ooGasPriceWei) / 1e18;
          _ooGasUSD = _ooGasEth * _ooNativePrice;
        }
      }
      if(window._swLog) window._swLog('OpenOcean', 'OK', 'out: '+outWei);
      return { to:j.data.to, data:j.data.data, value:j.data.value||'0x0', gas:_ooGasUnits, source:'openocean', outputWei:outWei, _apiGasUSD: _ooGasUSD > 0 ? _ooGasUSD : null };
    } catch(e) { if(window._swLog) window._swLog('OpenOcean', 'FAIL', 'err: '+(e.message||String(e)).slice(0,60)); return null; }
  }
  async function _quoteSocket() {
    // Bungee API v1 (new) — /api/v1/bungee/quote with enableManual=true
    // Returns manualRoutes[] array: multiple bridge providers (Across, Stargate, Mayan, Synapse, etc.)
    // TX built at execution via GET /api/v1/bungee/build-tx?quoteId=...
    // Docs: https://docs.bungee.exchange/api-reference/core-api/get-bungee-quote
    try {
      const srcAddr = isNative   ? '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' : (fromToken.contract || fromToken.address || '');
      const dstAddr = isToNative ? '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' : (toToken.contract   || toToken.address   || '');
      if (!srcAddr || !dstAddr || !userAddr) return null;
      const _socketSlip = parseFloat(SW.slippage || '1').toFixed(1);
      const url = `https://public-backend.bungee.exchange/api/v1/bungee/quote`
        + `?userAddress=${userAddr}&receiverAddress=${userAddr}`
        + `&originChainId=${chainId}&destinationChainId=${chainId}`
        + `&inputToken=${srcAddr}&outputToken=${dstAddr}`
        + `&inputAmount=${amountWei}&slippage=${_socketSlip}`
        + `&enableManual=true&disableAuto=true`;
      const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!r.ok) { if(window._swLog)window._swLog('Socket','FAIL',_httpErr(r.status)); return null; }
      const j = await r.json();
      const manualRoutes = j.result?.manualRoutes || [];
      if (!manualRoutes.length) return null;

      const results = [];
      const seenNames = new Set();
      for (const route of manualRoutes) {
        const outWei = String(route.output?.amount || '0');
        if (outWei === '0' || !route.quoteId) continue;
        const name = route.routeDetails?.name || 'Bungee';
        if (seenNames.has(name)) continue;
        seenNames.add(name);
        const logoURI = route.routeDetails?.logoURI || null;

        // ── Socket gas cost estimate from API response ──
        // route.gasFee: { gasLimit (units), gasPrice (wei string), gasToken: { decimals, symbol, usdPrice } }
        // Estimate: gasLimit × gasPrice (wei) → ETH → USD via gasToken.usdPrice
        let _socketGasUSD = null;
        try {
          const _gf        = route.gasFee || {};
          const _gasLimit  = Number(_gf.gasLimit  || 350000);
          // gasPrice: prefer API field (wei), fallback to SW._lastGasPriceGwei
          const _gasPriceWei = _gf.gasPrice
            ? Number(_gf.gasPrice)
            : (SW._lastGasPriceGwei || 1) * 1e9;
          const _gasTokenDecimals = Number((_gf.gasToken && _gf.gasToken.decimals) || 18);
          const _nativeUSD = (_gf.gasToken && _gf.gasToken.usdPrice)
            ? Number(_gf.gasToken.usdPrice)
            : (isNative ? (SW.fromToken?.price || 0) : (SW.toToken?.price || 0))
              || (SW._nativePriceUSD || 0);
          if (_nativeUSD > 0 && _gasPriceWei > 0) {
            const _gasNative = (_gasLimit * _gasPriceWei) / Math.pow(10, _gasTokenDecimals);
            _socketGasUSD = _gasNative * _nativeUSD;
          }
        } catch(_e) { _socketGasUSD = null; }

        // Socket protocol fee: routeDetails.routeFee.feeInUsd
        const _socketProtoFeeUsd = parseFloat((route.routeDetails && route.routeDetails.routeFee && route.routeDetails.routeFee.feeInUsd) || 0);
        results.push({
          to:   '0x0000000000000000000000000000000000000001', // placeholder
          data: '0x',
          value:'0x0',
          gas:  Number(route.gasFee?.gasLimit) || 350000,
          source: 'socket',
          swapApiDisplay: name,
          routerLogoURI: logoURI,
          outputWei: outWei,
          _socketQuoteId: route.quoteId,  // used in build-tx
          _priceOnly: true,
          // Use Socket API-derived gas estimate (PRIORITY 1); falls back to SW._lastGasPriceGwei estimate if null
          _apiGasUSD: (_socketGasUSD != null && _socketGasUSD > 0) ? _socketGasUSD : null,
          _swProtocolFeeUsd: parseFloat(_socketProtoFeeUsd.toFixed(4)), // 0 = FREE
        });
        if(window._swLog) window._swLog('Socket', 'OK', 'via '+name+' out:'+outWei);
      }
      return results.length ? results : null;
    } catch(e) { if(window._swLog) window._swLog('Socket', 'FAIL', 'err: '+(e.message||String(e)).slice(0,60)); return null; }
  }

  // ── NEW API #1: Rango Exchange — public test key, same-chain swap ──
  // ── NEW API #1: Rango Exchange ──
  async function _quoteRango() {
    // Rango /routing/bests — returns multiple routes (multi-route support)
    const RANGO_CHAIN = {1:'ETH',56:'BSC',137:'POLYGON',42161:'ARBITRUM',10:'OPTIMISM',8453:'BASE',43114:'AVAX_CCHAIN'};
    const RANGO_NATIVE = {1:'ETH',56:'BNB',137:'MATIC',42161:'ETH',10:'ETH',8453:'ETH',43114:'AVAX'};
    const blockchain = RANGO_CHAIN[chainId]; if (!blockchain) return null;
    if (_fromUsdVal > 0 && _fromUsdVal < _MIN_RANGO) return null;
    try {
      const nativeSym  = RANGO_NATIVE[chainId] || 'ETH';
      const fromSym    = isNative   ? nativeSym : (fromToken.symbol || fromToken.sym || '');
      const toSym      = isToNative ? nativeSym : (toToken.symbol   || toToken.sym   || '');
      const fromAddr   = isNative   ? null : (fromToken.contract || fromToken.address || null);
      const toAddr     = isToNative ? null : (toToken.contract   || toToken.address   || null);
      if (!fromSym || !toSym) return null;
      const amtHuman = String(parseFloat(amountWei) / Math.pow(10, fromToken.decimals || 18));
      const body = {
        from: { blockchain, symbol: fromSym, address: fromAddr },
        to:   { blockchain, symbol: toSym,   address: toAddr   },
        amount: amtHuman,
        slippage: String(slip),
        checkPrerequisites: false,
      };
      if (userAddr) {
        body.selectedWallets = { [blockchain]: userAddr };
      }
      const r = await _swProxyFetch('https://api.rango.exchange/routing/bests?limit=20&apiKey=' + window._ONE_RANGO_KEY, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(12000),
      });
      if (!r.ok) { if(window._swLog)window._swLog('Rango','FAIL',_httpErr(r.status)); return null; }
      const j = await r.json();
      const rangoRoutes = j.results || [];
      if (!rangoRoutes.length) return null;
      // Each Rango route: needs a separate /basic/swap call to get tx data
      // For multi-route display we return price-only results (no tx yet); tx fetched at execution
      const results = [];
      for (const rt of rangoRoutes) {
        const swaps = rt.swaps || [];
        const swapper = (swaps[0] && swaps[0].swapperId) || 'Rango';
        const swapperLogo = (swaps[0] && swaps[0].swapperLogo) || '';
        const outHuman = rt.outputAmount || '0';
        const outWei = (parseFloat(outHuman) * Math.pow(10, toToken.decimals || 18)).toFixed(0);
        if (outWei === '0' || outWei === 'NaN') continue;
        // Rango swapperId is ALL_CAPS_UNDERSCORE (e.g. "UNISWAP_V3") — convert to canonical display name
        // Explicit map prevents "Uni Swap", "Pancake Swap" etc. from title-case fallback
        const _RANGO_NAME_FIXES = {
          'UNISWAP_V2': 'Uniswap V2', 'UNISWAP_V3': 'Uniswap V3', 'UNISWAP_V4': 'Uniswap V4',
          'UNISWAP': 'Uniswap V3', 'UNI_SWAP': 'Uniswap V3', 'UNI_SWAP_V2': 'Uniswap V2',
          'UNI_SWAP_V3': 'Uniswap V3', 'UNI_SWAP_V4': 'Uniswap V4',
          'PANCAKESWAP': 'PancakeSwap', 'PANCAKE_SWAP': 'PancakeSwap',
          'PANCAKESWAP_V2': 'PancakeSwap V2', 'PANCAKE_SWAP_V2': 'PancakeSwap V2',
          'PANCAKESWAP_V3': 'PancakeSwap V3', 'PANCAKE_SWAP_V3': 'PancakeSwap V3',
          'SUSHISWAP': 'SushiSwap', 'SUSHI_SWAP': 'SushiSwap',
          'QUICKSWAP': 'QuickSwap', 'QUICK_SWAP': 'QuickSwap',
          'QUICKSWAP_V3': 'QuickSwap V3', 'QUICK_SWAP_V3': 'QuickSwap V3',
          'TRADERJOE': 'Trader Joe', 'TRADER_JOE': 'Trader Joe',
          'KYBERSWAP': 'KyberSwap', 'KYBER_SWAP': 'KyberSwap',
          'OPENOCEAN': 'OpenOcean', 'OPEN_OCEAN': 'OpenOcean',
          'COWSWAP': 'CoW Protocol', 'COW_SWAP': 'CoW Protocol', 'COW_PROTOCOL': 'CoW Protocol',
          '1INCH': '1inch', 'ONE_INCH': '1inch', 'ONEINCH': '1inch',
          'NATIVE_ROUTER': 'Native Router', 'NATIVE': 'Native Router',
          'CURVE': 'Curve', 'CURVE_FINANCE': 'Curve Finance',
          'BALANCER': 'Balancer', 'BALANCER_V2': 'Balancer V2',
          'VELODROME': 'Velodrome', 'VELODROME_V2': 'Velodrome V2',
          'AERODROME': 'Aerodrome', 'CAMELOT': 'Camelot', 'CAMELOT_V3': 'Camelot V3',
          'SPOOKYSWAP': 'SpookySwap', 'BISWAP': 'BiSwap', 'WOOFI': 'WOOFi',
        };
        const swapperDisplay = _RANGO_NAME_FIXES[swapper.toUpperCase()] || swapper
          .replace(/_/g, ' ')
          .replace(/\bV(\d+)\b/g, 'V$1')
          .replace(/\b\w/g, c => c.toUpperCase())
          .replace(/\bFi\b/, 'Fi');
        // Extract Rango API gas cost: fee[].expenseType === 'FROM_SOURCE_WALLET' → network gas
        const _rFeeArr = (rt.fee && rt.fee.length) ? rt.fee : swaps.flatMap(s => s.fee || []);
        let _rangoGasUSD = 0;
        _rFeeArr.forEach(function(f) {
          const _amt = parseFloat(f.amount || 0);
          const _usdP = parseFloat((f.token && f.token.usdPrice) || f.price || 0);
          if (f.expenseType === 'FROM_SOURCE_WALLET') _rangoGasUSD += _amt * _usdP;
        });
        if (_rangoGasUSD === 0 && rt.feeUsd) _rangoGasUSD = parseFloat(rt.feeUsd);
        // Rango protocol fee: DECREASE_FROM_OUTPUT = deducted from output (platform fee)
        let _rangoProtoFeeUsd = 0;
        _rFeeArr.forEach(function(f) {
          const _amt = parseFloat(f.amount || 0);
          const _usdP = parseFloat((f.token && f.token.usdPrice) || f.price || 0);
          if (f.expenseType === 'DECREASE_FROM_OUTPUT') _rangoProtoFeeUsd += _amt * _usdP;
        });
        results.push({
          to: '0x0000000000000000000000000000000000000001', // placeholder — real tx fetched on execute
          data: '0x',
          value: '0x0',
          gas: 300000,
          source: 'rango',
          swapApiDisplay: swapperDisplay,
          // Rango provides swapperLogo per swap — use it directly (avoids static-map miss)
          routerLogoURI: swapperLogo || null,
          outputWei: outWei,
          _rangoRoute: rt,         // full route object for execution
          _rangoRequestId: rt.requestId,
          _priceOnly: true,        // signals gasEstQueue to skip estimateGas (no real calldata yet)
          _apiGasUSD: _rangoGasUSD > 0 ? _rangoGasUSD : null, // API-provided gas cost USD
          _swProtocolFeeUsd: parseFloat(_rangoProtoFeeUsd.toFixed(4)), // 0 = FREE
        });
        if(window._swLog) window._swLog('Rango', 'OK', 'via '+swapperDisplay+' out:'+outWei);
      }
      return results.length ? results : null;
    } catch(e) { if(window._swLog) window._swLog('Rango', 'FAIL', 'err: '+(e.message||String(e)).slice(0,60)); return null; }
  }

  async function _quoteSymbiosis() {
    // Symbiosis v1 — same-chain supported via crosschain endpoint
    const SYM_CHAINS = {1:true,56:true,137:true,42161:true,10:true,8453:true,43114:true};
    if (!SYM_CHAINS[chainId]) { if(window._swLog)window._swLog('Symbiosis','FAIL','chain unsupported'); return null; }
    // Symbiosis requires minimum ~$1 swap
    if (_fromUsdVal > 0 && _fromUsdVal < _MIN_SYMBIOSIS) return null;
    try {
      const srcAddr = isNative   ? '0x0000000000000000000000000000000000000000' : (fromToken.contract || fromToken.address || '');
      const dstAddr = isToNative ? '0x0000000000000000000000000000000000000000' : (toToken.contract   || toToken.address   || '');
      if (!srcAddr || !dstAddr) return null;
      const body = {
        tokenAmountIn: { chainId, address:srcAddr, amount:amountWei, decimals:fromToken.decimals||18, symbol:fromToken.sym||'' },
        tokenOut:      { chainId, address:dstAddr, decimals:toToken.decimals||18, symbol:toToken.sym||'' },
        from: userAddr,
        to:   userAddr,
        revertableAddress: userAddr,
        slippage: Math.round(slip * 100),
      };
      const r = await _swProxyFetch('https://api.symbiosis.finance/crosschain/v1/swap', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify(body),
        signal:AbortSignal.timeout(9000)
      });
      if (!r.ok) { if(window._swLog)window._swLog('Symbiosis','FAIL',_httpErr(r.status)); return null; }
      const j = await r.json();
      if (!j.tx?.to || !j.tx?.data) { if(window._swLog)window._swLog('Symbiosis','FAIL',j.error||j.message||'bad resp'); return null; }
      const outWei = String(j.tokenAmountOut?.amount || '0');
      if (outWei === '0') { if(window._swLog)window._swLog('Symbiosis','FAIL','zero output'); return null; }
      const txValue = j.tx.value ? ('0x' + BigInt(String(j.tx.value)).toString(16)) : '0x0';
      // Symbiosis: no gasUsd field — estimate from tx.gas × live gas price × native price
      const _symGasUnits = Number(j.tx.gas) || 400000;
      let _symApiGasUSD = null;
      try {
        const _symGasGwei = SW._lastGasPriceGwei || 1;
        const _symEthPrice = SW?.fromToken?.price || SW?.toToken?.price || SW?._nativePriceUSD || 0;
        if (_symEthPrice > 0) {
          _symApiGasUSD = (_symGasUnits * _symGasGwei * 1e9 / 1e18) * _symEthPrice;
        }
      } catch(_) {}
      if(window._swLog) window._swLog('Symbiosis', 'OK', 'out: '+outWei);
      return { to:j.tx.to, data:j.tx.data, value:txValue, gas:_symGasUnits, source:'symbiosis', outputWei:outWei, _apiGasUSD: _symApiGasUSD > 0 ? _symApiGasUSD : null };
    } catch(e) { if(window._swLog) window._swLog('Symbiosis', 'FAIL', 'err: '+(e.message||String(e)).slice(0,60)); return null; }
  }

  // ── NEW API #5: Enso Finance — free aggregator, no key, any EVM chain ──
  async function _quoteEnso() {
    // Enso Finance API — free public, chainId passed directly in URL
    try {
      const srcAddr = isNative   ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' : (fromToken.contract || fromToken.address || '');
      const dstAddr = isToNative ? '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' : (toToken.contract   || toToken.address   || '');
      if (!srcAddr || !dstAddr) return null;
      const url = `https://api.enso.finance/api/v1/shortcuts/route?chainId=${chainId}&fromAddress=${userAddr}&spender=${userAddr}&receiver=${userAddr}&amountIn=${amountWei}&tokenIn=${srcAddr}&tokenOut=${dstAddr}&slippage=${Math.round(slip*100)}`;
      const r = await fetch(url, { headers:{'Content-Type':'application/json','Authorization':'Bearer 2fd500e4-7ae5-41ef-8298-b2966662a612'}, signal:AbortSignal.timeout(8000) });
      if (!r.ok) { if(window._swLog)window._swLog('Enso','FAIL',_httpErr(r.status)); return null; }
      const j = await r.json();
      if (!j.tx?.to || !j.tx?.data) { if(window._swLog)window._swLog('Enso','FAIL',j.message||'bad resp'); return null; }
      const outWei = String(j.amountOut || '0');
      if (outWei === '0') { if(window._swLog)window._swLog('Enso','FAIL','zero output'); return null; }
      const txValue = j.tx.value ? ('0x' + BigInt(j.tx.value).toString(16)) : '0x0';
      // Enso: only gas units in response — estimate from j.gas × live gas price × native price
      const _ensoGasUnits = Number(j.gas) || 300000;
      let _ensoApiGasUSD = null;
      try {
        const _ensoGasGwei = SW._lastGasPriceGwei || 1;
        const _ensoEthPrice = SW?.fromToken?.price || SW?.toToken?.price || SW?._nativePriceUSD || 0;
        if (_ensoEthPrice > 0) {
          _ensoApiGasUSD = (_ensoGasUnits * _ensoGasGwei * 1e9 / 1e18) * _ensoEthPrice;
        }
      } catch(_) {}
      if(window._swLog) window._swLog('Enso', 'OK', 'out: '+outWei);
      return { to:j.tx.to, data:j.tx.data, value:txValue, gas:_ensoGasUnits, source:'enso', outputWei:outWei,
               // Enso: no gasUsd in response — tentative estimate; RPC estimateGas in queue refines
               _apiGasUSD: _ensoApiGasUSD > 0 ? _ensoApiGasUSD : null };
    } catch(e) { if(window._swLog) window._swLog('Enso', 'FAIL', 'err: '+(e.message||String(e)).slice(0,60)); return null; }
  }

  // ── NEW API #10: Velora — free public endpoint, any EVM chain ──
  async function _quoteVelora() {
    // Velora price route only — tx build returns 400 from null origin
    try {
      const srcAddr  = addrEeee(fromToken, isNative);
      const destAddr = addrEeee(toToken,   isToNative);
      if (!srcAddr || !destAddr) { if(window._swLog)window._swLog('Velora','FAIL','no addr'); return null; }
      const priceR = await fetch(`https://api.velora.xyz/prices/?srcToken=${srcAddr}&destToken=${destAddr}&amount=${amountWei}&srcDecimals=${fromToken.decimals||18}&destDecimals=${toToken.decimals||18}&side=SELL&network=${chainId}&userAddress=${userAddr}&version=6.2&partner=one-wallet&ignoreBadUsdPrice=true`, { signal:AbortSignal.timeout(8000) });
      if (!priceR.ok) { if(window._swLog)window._swLog('Velora','FAIL',_httpErr(priceR.status)); return null; }
      const priceJ = await priceR.json();
      if (!priceJ.priceRoute) { if(window._swLog)window._swLog('Velora','FAIL',priceJ.error||priceJ.message||'no priceRoute'); return null; }
      const outWei = String(priceJ.priceRoute.destAmount || '0');
      if (outWei === '0') { if(window._swLog)window._swLog('Velora','FAIL','zero output'); return null; }
      if(window._swLog) window._swLog('Velora', 'OK', 'out: '+outWei);
      return { to: priceJ.priceRoute.contractAddress || '0x', data:'0x', value:'0x0', gas:Number(priceJ.priceRoute.gasCost)||300000, source:'velora', outputWei:outWei, priceRoute:priceJ.priceRoute, _priceOnly:true,
               // Velora (Paraswap fork): priceRoute.gasCostUSD = gas cost in USD (official field)
               _apiGasUSD: parseFloat(priceJ.priceRoute.gasCostUSD || 0) || null };
    } catch(e) { if(window._swLog) window._swLog('Velora', 'FAIL', 'err: '+(e.message||String(e)).slice(0,60)); return null; }
  }

  async function _quoteDODO() {
    try {
      const DODO_CHAINS = {1:1,10:10,56:56,137:137,8453:8453,42161:42161,43114:43114,534352:534352,59144:59144,5000:5000};
      if (!DODO_CHAINS[chainId]) { if(window._swLog)window._swLog('DODO','FAIL','chain unsupported'); return null; }
      const fromAddr = isNative ? '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' : (fromToken.contract || fromToken.address || '');
      const toAddr   = isToNative ? '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' : (toToken.contract || toToken.address || '');
      if (!fromAddr || !toAddr) { if(window._swLog)window._swLog('DODO','FAIL','no token addr'); return null; }
      const params = new URLSearchParams({ chainId:String(chainId), fromAmount:amountWei, fromTokenAddress:fromAddr, toTokenAddress:toAddr, apikey:'317de7e2d83f1f6b96', slippage:String(slip/100), userAddr:userAddr });
      const r = await _swProxyFetch('https://api.dodoex.io/route-service/developer/swap?' + params, {}, 9000);
      if (!r.ok) { if(window._swLog)window._swLog('DODO','FAIL',_httpErr(r.status)); return null; }
      const j = await r.json();
      if (j.status !== 200 || !j.data || !j.data.to || !j.data.data) { if(window._swLog)window._swLog('DODO','FAIL',j.status!==200?(j.message||'status '+j.status):'missing tx data'); return null; }
      const outWei = j.data.resAmount != null ? String(Math.floor(j.data.resAmount * Math.pow(10, toToken.decimals||18))) : null;
      if (!outWei || outWei === '0') { if(window._swLog)window._swLog('DODO','FAIL','zero output'); return null; }
      const dv = j.data.value; const dhex = (!dv||dv==='0'||dv==='0x0')?'0x0':(String(dv).startsWith('0x')?dv:'0x'+BigInt(String(dv)).toString(16));
      if(window._swLog) window._swLog('DODO', 'OK', 'out: '+outWei);
      return { to:j.data.to, data:j.data.data, value:dhex, gas:350000, source:'dodo', outputWei:outWei };
    } catch(e) { if(window._swLog) window._swLog('DODO', 'FAIL', 'err: '+(e.message||String(e)).slice(0,60)); return null; }
  }

  async function _quotePortals() {
    try {
      const PORTALS_NET = {1:'ethereum',56:'bsc',137:'polygon',8453:'base',42161:'arbitrum',10:'optimism',43114:'avalanche',250:'fantom',324:'zksync',100:'gnosis',1101:'polygon-zkevm',59144:'linea',534352:'scroll',81457:'blast'};
      const net = PORTALS_NET[chainId]; if (!net) return null;
      const fromAddr = isNative ? '0x0000000000000000000000000000000000000000' : (fromToken.contract || fromToken.address || '');
      const toAddr   = isToNative ? '0x0000000000000000000000000000000000000000' : (toToken.contract || toToken.address || '');
      if (!fromAddr || !toAddr) { if(window._swLog)window._swLog('Portals','FAIL','no token addr'); return null; }
      const inputTok  = net + ':' + fromAddr;
      const outputTok = net + ':' + toAddr;
      const url = `https://api.portals.fi/v2/portal?inputToken=${encodeURIComponent(inputTok)}&inputAmount=${amountWei}&outputToken=${encodeURIComponent(outputTok)}&sender=${userAddr}&slippageTolerancePercentage=${slip.toFixed(1)}&validate=false`;
      const r = await fetch(url, { signal:AbortSignal.timeout(10000) });
      if (!r.ok) { if(window._swLog)window._swLog('Portals','FAIL',_httpErr(r.status)); return null; }
      const j = await r.json();
      if (!j.tx || !j.tx.to || !j.tx.data) { if(window._swLog)window._swLog('Portals','FAIL',j.error||j.message||'missing tx data'); return null; }
      const outWei = String(j.context?.outputAmount || j.context?.minOutputAmount || '0');
      if (!outWei || outWei === '0') { if(window._swLog)window._swLog('Portals','FAIL','zero output'); return null; }
      const pv = j.tx.value; const phex = (!pv||pv==='0'||pv==='0x0')?'0x0':(String(pv).startsWith('0x')?pv:'0x'+BigInt(String(pv)).toString(16));
      if(window._swLog) window._swLog('Portals', 'OK', 'out: '+outWei);
      return { to:j.tx.to, data:j.tx.data, value:phex, gas:Number(j.context?.gasLimit)||350000, source:'portals', outputWei:outWei };
    } catch(e) { if(window._swLog) window._swLog('Portals', 'FAIL', 'err: '+(e.message||String(e)).slice(0,60)); return null; }
  }

  async function _quoteFly() {
    try {
      const FLY_NETS = {1:'ethereum',56:'bsc',137:'polygon',8453:'base',42161:'arbitrum',10:'optimism',43114:'avalanche',250:'fantom',324:'zksync',59144:'linea',534352:'scroll',81457:'blast',1101:'polygonzk'};
      const net = FLY_NETS[chainId]; if (!net) { if(window._swLog)window._swLog('Fly','FAIL','chain unsupported'); return null; }
      const FLY_NATIVE = '0x0000000000000000000000000000000000000000';
      const fromAddr = isNative ? FLY_NATIVE : (fromToken.contract || fromToken.address || '');
      const toAddr   = isToNative ? FLY_NATIVE : (toToken.contract || toToken.address || '');
      if (!fromAddr || !toAddr) { if(window._swLog)window._swLog('Fly','FAIL','no token addr'); return null; }
      const slip4 = (slip / 100).toFixed(4);
      const qr = await fetch(`https://api.fly.trade/aggregator/quote?network=${net}&fromTokenAddress=${fromAddr}&toTokenAddress=${toAddr}&sellAmount=${amountWei}&slippage=${slip4}&fromAddress=${userAddr}&toAddress=${userAddr}&gasless=false`, { signal:AbortSignal.timeout(9000) });
      if (!qr.ok) { if(window._swLog)window._swLog('Fly','FAIL','quote: '+_httpErr(qr.status)); return null; }
      const qj = await qr.json();
      if (!qj.id || !qj.amountOut || qj.amountOut === '0') { if(window._swLog)window._swLog('Fly','FAIL',qj.message||qj.error||'no route'); return null; }
      const outWei = String(qj.amountOut);
      // Build tx
      const tr = await fetch(`https://api.fly.trade/aggregator/transaction?quoteId=${qj.id}&estimateGas=false`, { signal:AbortSignal.timeout(9000) });
      if (!tr.ok) { if(window._swLog)window._swLog('Fly','FAIL','tx: '+_httpErr(tr.status)); return null; }
      const tj = await tr.json();
      if (!tj.to || !tj.data) { if(window._swLog)window._swLog('Fly','FAIL','bad resp'); return null; }
      const mgv = tj.value; const mghex = (!mgv||mgv==='0'||mgv==='0x0')?'0x0':(String(mgv).startsWith('0x')?mgv:'0x'+BigInt(String(mgv)).toString(16));
      if(window._swLog) window._swLog('Fly', 'OK', 'out: '+outWei);
      return { to:tj.to, data:tj.data, value:mghex, gas:Number(tj.gasLimit)||350000, source:'fly', outputWei:outWei };
    } catch(e) { if(window._swLog) window._swLog('Fly', 'FAIL', 'err: '+(e.message||String(e)).slice(0,60)); return null; }
  }

  async function _quoteOKX() {
    // OKX DEX — True per-DEX routing:
    // 1. /get-liquidity → full list of DEXes on this chain (id, name, logo)
    // 2. Per-DEX /quote?dexIds=<id> in parallel → each DEX real output amount
    // 3. Only DEXes that return non-zero output become cards
    // 4. On execution: /swap?dexIds=<id> → real tx calldata for that specific DEX
    try {
      const OKX_CHAINS = {1:'1',56:'56',137:'137',8453:'8453',42161:'42161',10:'10',43114:'43114',324:'324',59144:'59144',534352:'534352',81457:'81457',1101:'1101',5000:'5000',169:'169',130:'130'};
      const ci = OKX_CHAINS[chainId];
      if (!ci) { if(window._swLog)window._swLog('OKX DEX','FAIL','chain unsupported'); return null; }

      const OKX_NATIVE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
      const fromAddr = isNative ? OKX_NATIVE : (fromToken.contract || fromToken.address || '');
      const toAddr   = isToNative ? OKX_NATIVE : (toToken.contract || toToken.address || '');
      if (!fromAddr || !toAddr) { if(window._swLog)window._swLog('OKX DEX','FAIL','no token addr'); return null; }

      const OKX_KEY        = '4ea63ec2-cc07-4855-98e9-37cece4bd3ff';
      const OKX_SECRET     = 'CB2465C6DBB02286A8427B1CE9EFAEAC';
      const OKX_PASSPHRASE = 'ak01ALim@';

      // Helper: HMAC-SHA256 sign → signed GET fetch
      async function _okxGet(path) {
        const ts = new Date().toISOString().replace(/\.(\d{3})Z$/, '.000Z');
        const ph = ts + 'GET' + path;
        const kb = new TextEncoder().encode(OKX_SECRET);
        const mb = new TextEncoder().encode(ph);
        const ck = await crypto.subtle.importKey('raw', kb, {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
        const sg = await crypto.subtle.sign('HMAC', ck, mb);
        const sign = btoa(String.fromCharCode(...new Uint8Array(sg)));
        return window.oneSignedFetch('https://www.okx.com' + path, {
          ms: 15000,
          headers: {
            'OK-ACCESS-KEY': OKX_KEY, 'OK-ACCESS-SIGN': sign,
            'OK-ACCESS-TIMESTAMP': ts, 'OK-ACCESS-PASSPHRASE': OKX_PASSPHRASE,
            'Content-Type': 'application/json'
          }
        });
      }

      // ── Step 1: /get-liquidity → full DEX list for this chain ──
      const liqResp = await _okxGet('/api/v6/dex/aggregator/get-liquidity?chainIndex=' + ci);
      if (!liqResp.ok) { if(window._swLog)window._swLog('OKX DEX','FAIL','liquidity HTTP '+liqResp.status); return null; }
      const liqJson = await liqResp.json();
      if (liqJson.code !== '0' || !Array.isArray(liqJson.data) || liqJson.data.length === 0) {
        if(window._swLog)window._swLog('OKX DEX','FAIL','no liquidity sources');
        return null;
      }
      // liqJson.data: [{id, name, logo}, ...]
      const allDexes = liqJson.data; // up to ~50-100 DEXes per chain
      if(window._swLog) window._swLog('OKX DEX','OK', allDexes.length+' DEXes on chain '+ci);

      // ── Step 2: Per-DEX /quote?dexIds=<id> in parallel (staggered 150ms) ──
      // Each call: restrict routing to ONLY this one DEX → get that DEX's real output
      const baseQuery = `chainIndex=${ci}&amount=${amountWei}&fromTokenAddress=${fromAddr}&toTokenAddress=${toAddr}&swapMode=exactIn`;

      async function _okxQuoteOneDex(dex) {
        // dex = {id, name, logo}
        try {
          const path = '/api/v6/dex/aggregator/quote?' + baseQuery + '&dexIds=' + dex.id;
          const r = await _okxGet(path);
          if (!r.ok) return null;
          const j = await r.json();
          if (j.code !== '0' || !j.data?.[0]) return null;
          const d = j.data[0];
          const outWei = String(d.toTokenAmount || '0');
          if (!outWei || outWei === '0') return null;
          if(window._swLog) window._swLog('OKX:'+dex.name, 'OK', 'out:'+outWei);
          return {
            to: '0x0000000000000000000000000000000000000000', // placeholder — real tx on exec
            data: '0x00',
            value: '0x0',
            gas: Number(d.estimateGasFee || 350000),
            source: 'okxdex',
            outputWei: outWei,
            _okxDexName: dex.name,
            _okxDexId: dex.id,         // store for /swap on execution
            _okxCi: ci,
            _okxFromAddr: fromAddr,
            _okxToAddr: toAddr,
            _okxAmountWei: amountWei,
            _okxSlip: slip,
            _okxUserAddr: userAddr,
            _okxPendingTx: true,       // tx calldata fetched fresh at execution time
            routerLogoURI: dex.logo || 'https://static.okx.com/cdn/assets/imgs/232/4B1D6E8E0FD09F52.png',
          };
        } catch(_e) {
          if(window._swLog) window._swLog('OKX:'+dex.name, 'FAIL', (_e.message||'').slice(0,30));
          return null;
        }
      }

      // Stagger 150ms between calls to stay under OKX rate limit
      const perDexPromises = allDexes.map((dex, i) =>
        new Promise(res => setTimeout(() => _okxQuoteOneDex(dex).then(res), i * 150))
      );
      const perDexResults = await Promise.all(perDexPromises);
      const results = perDexResults.filter(Boolean);

      if (results.length === 0) { if(window._swLog)window._swLog('OKX DEX','FAIL','no DEX returned quote'); return null; }
      if(window._swLog) window._swLog('OKX DEX','OK', results.length+' DEX card(s) with real quotes');
      return results;

    } catch(e) { if(window._swLog) window._swLog('OKX DEX', 'FAIL', 'err: '+(e.message||String(e)).slice(0,60)); return null; }
  }

  async function _quoteSquid() {
    try {
      const fromAddr = isNative ? '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' : (fromToken.contract || fromToken.address || '');
      const toAddr   = isToNative ? '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' : (toToken.contract || toToken.address || '');
      if (!fromAddr || !toAddr) { if(window._swLog)window._swLog('Squid','FAIL','no token addr'); return null; }
      const r = await _swProxyFetch('https://v2.api.squidrouter.com/v2/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-integrator-id': 'one-wallet-8a0ab990-3b1a-4445-83aa-52d3b7471357' },
        body: JSON.stringify({
          fromChain: String(chainId), toChain: String(chainId),
          fromToken: fromAddr, toToken: toAddr,
          fromAmount: amountWei, fromAddress: userAddr, toAddress: userAddr,
          slippage: Number(slip)
        }),
        signal: AbortSignal.timeout(12000)
      });
      if (!r.ok) { if(window._swLog)window._swLog('Squid','FAIL','HTTP '+r.status); return null; }
      const j = await r.json();
      const route = j.route;
      if (!route?.estimate) return null;
      const outWei = String(route.estimate.toAmountMin || route.estimate.toAmount || '0');
      if (!outWei || outWei === '0') return null;
      const tx = route.transactionRequest;
      if (!tx?.target || !tx?.data) return null;
      const sqVal = tx.value && tx.value !== '0' && tx.value !== '0x0' ? tx.value : '0x0';
      let dexName = 'Squid';
      try {
        const swapAction = (route.estimate?.actions||[]).find(a => a.type === 'swap');
        dexName = swapAction?.data?.dex || swapAction?.provider || 'Squid';
      } catch(_) {}
      if(window._swLog) window._swLog('Squid:'+dexName, 'OK', 'out:'+outWei);
      return [{ to: tx.target, data: tx.data, value: sqVal,
                gas: Number(tx.gasLimit)||400000, source: 'squid',
                outputWei: outWei, _squidDexName: dexName,
                routerLogoURI: 'https://icons.llamao.fi/icons/protocols/squid?w=48&h=48' }];
    } catch(e) { if(window._swLog)window._swLog('Squid','FAIL',(e.message||String(e)).slice(0,60)); return null; }
  }
  // _swLog removed
  window._swLog = function(){};
  // HTTP status → human-readable reason for swap log
  function _httpErr(status) {
    const map = {400:'bad request',401:'unauthorized',403:'API key/domain restricted',404:'endpoint not found',429:'rate limited',500:'server error',502:'bad gateway',503:'service unavailable',504:'gateway timeout'};
    return 'http '+status+(map[status]?' ('+map[status]+')':'');
  }
  try {
    // ── Step 1: Fetch prices (fast) → render quotes immediately ──
    SW._routerCache = {};
    SW._cachedSwapTx = null; // clear old cached tx
    const [fromPrice, toPrice] = await Promise.all([
      _fetchTokenPrice(fromToken),
      _fetchTokenPrice(toToken),
    ]);

    if (fromPrice > 0) SW.fromToken.price = fromPrice;
    if (toPrice > 0)   SW.toToken.price   = toPrice;

    // ── Update FROM usd with real fetched price ──
    const _fromAmt = parseFloat(SW.fromAmount);
    const _fromUsdEl = document.getElementById('sw-from-usd');
    if (_fromUsdEl && fromPrice > 0 && _fromAmt > 0) {
      const _fromUsdVal = _fromAmt * fromPrice;
      _fromUsdEl.textContent = `≈ ${_formatCurrencyDisplay(_fromUsdVal)}`;
    }

    clearInterval(SW.scanDexInterval);
    document.getElementById('sw-quote-loading').style.display = 'none';


    // ── Step 2: Fetch real swap tx data — race all APIs ──
    // Skip if token contracts are missing (can't build valid calldata)
    if (!canFetchRoutes) {
      SW._routeFetching = false;
      document.getElementById('sw-dex-compare').style.display = 'none';
      swUpdateButton();
      return;
    }

    SW._routeFetching = true;
    swUpdateButton();

    // Badge: EST while loading
    const _cmpBadge = document.getElementById('sw-compare-badge');
    if (_cmpBadge) { const _bt=document.getElementById('sw-badge-text'); if(_bt)_bt.textContent='EST'; _cmpBadge.style.background='rgba(245,158,11,0.12)'; _cmpBadge.style.borderColor='rgba(245,158,11,0.3)'; _cmpBadge.style.color='var(--accent-amber)'; }

    // Helper: wei string → human float (safe BigInt arithmetic)
    function weiToFloat(weiStr, decimals) {
      try {
        if (!weiStr || weiStr === '0') return 0;
        const dec = Math.max(0, Math.min(decimals || 18, 18));
        // Use ethers.formatUnits for correct precision if available
        if (typeof ethers !== 'undefined' && ethers.formatUnits) {
          return parseFloat(ethers.formatUnits(BigInt(weiStr), dec));
        }
        const wei = BigInt(weiStr);
        const div = BigInt('1' + '0'.repeat(dec));
        // Integer part + fractional part — avoid floating point loss
        const intPart  = Number(wei / div);
        const fracWei  = wei % div;
        const fracPart = Number(fracWei) / Number(div);
        return intPart + fracPart;
      } catch(_) { return 0; }
    }

    const SOURCE_INFO = {
      'lifi':       { color:'#8B5CF6', fee:'0%', display:'LiFi'        },
      'odos':       { color:'#F97316', fee:'0%', display:'Odos'        },
      '1inch':      { color:'#1B314F', fee:'0%', display:'1inch'       },
      '0x':         { color:'#FFFFFF', fee:'0%', display:'0x Protocol'  },
      'kyberswap':  { color:'#31CB9E', fee:'0%', display:'KyberSwap'   },
      'swapapi':    { color:'#6366f1', fee:'0%', display:'SwapAPI'     }, // fallback only if DEX name not returned
      'openocean':  { color:'#00D1FF', fee:'0%', display:'OpenOcean'   },
      'cow':        { color:'#65B4D9', fee:'0%', display:'CoW Protocol' },
      'hashflow':   { color:'#FF6B6B', fee:'0%', display:'Hashflow'    },
      'clipper':    { color:'#4ECDC4', fee:'0%', display:'Clipper'     },
      'rango':      { color:'#FF8C00', fee:'0%', display:'Rango'       },
      'socket':     { color:'#6366F1', fee:'0%', display:'Socket'      },
      'symbiosis':  { color:'#7ED321', fee:'0%', display:'Symbiosis'   },
      'squid':      { color:'#E84A5F', fee:'0%', display:'Squid'       },
      'enso':       { color:'#3B82F6', fee:'0%', display:'Enso'        },
      'velora':     { color:'#A855F7', fee:'0%', display:'Velora'      },
      'dodo':       { color:'#FFE804', fee:'0%', display:'DODO'        },
      'portals':    { color:'#00D4AA', fee:'0%', display:'Portals'     },
      'fly':        { color:'#00CFFD', fee:'0%', display:'Fly'         },
      'okxdex':     { color:'#00D4FF', fee:'0%', display:'OKX DEX'     },
    };

    // ── Stream results: show first API that returns, update as more come in ──
    const _quoteSessionId = ++SW._quoteSession; // track current session to avoid stale updates
    SW._gasEstQueue   = [];    // reset gas queue on every new quote
    SW._gasEstRunning = false;

    function _processQuoteResult(r) {
      // Stale session — ignore (chain changed or new quote started)
      if (_quoteSessionId !== SW._quoteSession) return;
      // FROM amount cleared (e.g. chain change happened mid-flight) — ignore
      if (!SW.fromAmount || parseFloat(SW.fromAmount) <= 0) return;
      if (!r || !r.to || !r.data) return;
      const outputAmt = weiToFloat(r.outputWei, toToken.decimals);
      if (outputAmt <= 0) return;
      // For swapapi.dev results: use the actual DEX display name (e.g. "Uniswap V3")
      // so _swDexIconHtml can find the correct logo via exact/prefix matching
      const staticInfo = SOURCE_INFO[r.source];
      // OKX per-DEX: use the specific DEX name (e.g. "Uniswap V3", "Aerodrome")
      // SwapAPI: use real DEX name from API response
      // Others: static SOURCE_INFO display name
      const displayName = r._okxDexName
        ? r._okxDexName                             // OKX per-DEX call: "Uniswap V3", "Curve" etc
        : r._squidDexName
          ? r._squidDexName                         // Squid per-DEX call: "Uniswap V3", "Aerodrome" etc
          : r.swapApiDisplay && r.swapApiDisplay !== 'SwapAPI'
            ? r.swapApiDisplay                      // SwapAPI real DEX name
            : (staticInfo ? staticInfo.display : (r.source || 'DEX'));
      // ── Log successful quote ──
      _swLog(displayName, 'OK', `out: ${outputAmt.toFixed(6)} ${toToken.symbol||toToken.sym||''}`);

      // Color: try static source map first, then match by display name prefix for any DEX SwapAPI returns
      const _DEX_COLORS = {
        'Uniswap':    '#FF007A', 'PancakeSwap': '#1FC7D4', 'SushiSwap':  '#FA52A0',
        'Curve':      '#3399FF', 'Balancer':    '#1E1E1E', 'DODO':        '#FFE804',
        'Velodrome':  '#EF4444', 'Aerodrome':   '#0052FF', 'Camelot':     '#F59E0B',
        'Trader Joe': '#FF6B35', 'QuickSwap':   '#5D2BE9', 'SpookySwap':  '#7B3FE4',
        'Biswap':     '#F0B90B', 'Maverick':    '#00CFFD', 'Ambient':     '#14B8A6',
        'CoW':        '#65B4D9', 'dYdX':        '#6966FF', 'Bancor':      '#000D30',
        'Izumi':      '#5B21B6', 'Zyberswap':   '#00FF85',
        'KyberSwap':  '#31CB9E', 'Kyber':       '#31CB9E',
        'Odos':       '#F97316', '1inch':       '#1B314F',
        '0x':          '#FFFFFF',
        'OpenOcean':  '#00D1FF',
        'Hashflow':   '#FF6B6B',
        'Clipper':    '#4ECDC4',
        'Rango':      '#FF8C00', 'Socket':      '#6366F1',
        'Squid':      '#E84A5F', 'Enso':        '#3B82F6',
        'Velora':     '#A855F7',
        'LiFi':       '#8B5CF6', 'Hashflow':    '#FF6B6B',
      };
      let color = staticInfo ? staticInfo.color : null;
      if (!color) {
        for (const [prefix, col] of Object.entries(_DEX_COLORS)) {
          if (displayName.startsWith(prefix) || displayName.includes(prefix)) { color = col; break; }
        }
        color = color || '#6366f1';
      }
      const fee   = staticInfo ? staticInfo.fee   : '0%';

      // ── Immediate gas fee: if API already provided USD cost, show it now (no ⏳) ──
      let _initGasFee = '⏳';
      if (r._apiGasUSD != null && r._apiGasUSD > 0) {
        const _u = r._apiGasUSD;
        _initGasFee = _u < 0.0001 ? '<$0.0001' : _u < 0.01 ? '$' + _u.toFixed(4) : '$' + _u.toFixed(2);
      } else if (r._priceOnly && SW._lastGasPriceGwei > 0) {
        try {
          const _gu  = BigInt(r.gas || 350000);
          const _gpw = BigInt(Math.ceil(SW._lastGasPriceGwei * 1e9));
          const _ge  = Number(_gu * _gpw) / 1e18;
          const _np  = SW.fromToken?.price || SW.toToken?.price || SW._nativePriceUSD || 0;
          if (_np > 0) {
            const _u = _ge * _np;
            _initGasFee = _u < 0.0001 ? '<$0.0001' : _u < 0.01 ? '$' + _u.toFixed(4) : '$' + _u.toFixed(2);
          }
        } catch(_) {}
      }

      // Protocol fee: use API-provided USD value if available (_swProtocolFeeUsd on r),
      // otherwise 0 (FREE) — static fee% string is unreliable for display
      const _swProtoFeeUsd = (r._swProtocolFeeUsd != null) ? r._swProtocolFeeUsd : 0;
      // Real price impact: (toUSD - fromUSD) / fromUSD × 100
      // Positive = user gets more than they put in (bonus/favorable)
      // Negative = user gets less (slippage/loss)
      // Uses live prices fetched at quote time; falls back to 0 if prices unavailable
      let _calcImpact = 0;
      try {
        const _fp = SW.fromToken?.price || 0;
        const _tp = SW.toToken?.price   || 0;
        const _fromAmt2 = parseFloat(SW.fromAmount) || 0;
        if (_fp > 0 && _tp > 0 && _fromAmt2 > 0 && outputAmt > 0) {
          const _fromUSD2 = _fromAmt2 * _fp;
          const _toUSD2   = outputAmt  * _tp;
          _calcImpact = ((_toUSD2 - _fromUSD2) / _fromUSD2) * 100;
        }
      } catch(_) {}
      const quote = { dex: displayName, color, output: outputAmt, gasFee: _initGasFee, impact: _calcImpact, fee, isReal: true, txData: r, apiSource: r.source || '', routerLogoURI: r.routerLogoURI || null, _swProtoFeeUsd };

      // ── Async: estimateGas via staggered queue (100ms apart) → no RPC flood ──
      // Queue is shared per quote-session; each entry fires 100ms after the previous
      if (!SW._gasEstQueue) SW._gasEstQueue = [];
      if (!SW._gasEstRunning) SW._gasEstRunning = false;

      // Only queue if gas fee still unknown
      if (_initGasFee === '⏳') {
      SW._gasEstQueue.push({ quote, r, chainId, sessionId: _quoteSessionId, priceOnly: !!(r._priceOnly) });
      }

      if (!SW._gasEstRunning) {
        SW._gasEstRunning = true;
        (async () => {
          while (SW._gasEstQueue.length > 0) {
            const _job = SW._gasEstQueue.shift();
            // Skip stale sessions (new quote started)
            if (_job.sessionId !== SW._quoteSession) continue;
            try {
              const _txD = _job.r.txData || _job.r;
              // Gas is always paid in native ETH — use ETH price regardless of swap direction
              // ETH→Token: fromToken is ETH → use fromToken.price
              // Token→ETH: toToken is ETH   → use toToken.price
              // Token→Token: neither is ETH  → try both, pick whichever looks like ETH price (>100)
              const EEEE = 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
              const _fromIsNative = !SW.fromToken?.contract || /^0x0+$/.test(SW.fromToken.contract) || SW.fromToken.contract.toLowerCase().replace(/^0x/,'') === EEEE;
              const _toIsNative   = !SW.toToken?.contract   || /^0x0+$/.test(SW.toToken.contract)   || SW.toToken.contract.toLowerCase().replace(/^0x/,'') === EEEE;
              // Gas is always paid in the chain's native token — use its USD price
              const _getNativePrice = () => {
                const _netId = SW.network?.id || 'base';
                const _cid = SW.network?.chainId;
                const _netTokens = (typeof TOKENS_BY_NETWORK !== 'undefined' && TOKENS_BY_NETWORK[_netId]) || [];
                const _nativeTok = _netTokens.find(t => !t.contract);
                // 1. Try globalPriceCache via cgId from TOKENS_BY_NETWORK (already fetched by home section)
                if (_nativeTok?.cgId && typeof _globalPriceCache !== 'undefined' && _globalPriceCache) {
                  const _pd = _globalPriceCache[_nativeTok.cgId]; if (_pd?.usd) return _pd.usd;
                }
                if (_nativeTok?.price) return _nativeTok.price;
                // 2. Custom/chainlist chain: look up native token from savedTokens
                try {
                  const _allToks = (typeof loadSavedTokens === 'function') ? loadSavedTokens() : [];
                  const _nt2 = _allToks.find(t => t.chainId === _cid && (t.isNative || !t.contract));
                  if (_nt2) {
                    // 2a. globalPriceCache via cgId
                    if (_nt2.cgId && typeof _globalPriceCache !== 'undefined' && _globalPriceCache) {
                      const _pd2 = _globalPriceCache[_nt2.cgId]; if (_pd2?.usd) return _pd2.usd;
                    }
                    // 2b. globalPriceCache symbol-based lookup (home section stores prices by symbol too)
                    if (_nt2.sub && typeof _globalPriceCache !== 'undefined' && _globalPriceCache) {
                      for (const _k of Object.keys(_globalPriceCache)) {
                        if (_k.toLowerCase() === (_nt2.sub || '').toLowerCase()) {
                          const _pv = _globalPriceCache[_k]; if (_pv?.usd) return _pv.usd;
                        }
                      }
                    }
                    // 2c. .price field set when home section loaded prices (most reliable for custom chains)
                    if (_nt2.price > 0) return _nt2.price;
                  }
                } catch(_e) {}
                // 3. SW.fromToken / SW.toToken direct price field
                if (_fromIsNative && SW.fromToken?.price > 0) return SW.fromToken.price;
                if (_toIsNative   && SW.toToken?.price   > 0) return SW.toToken.price;
                return 0;
              };
              const _ethPrice = _fromIsNative ? (SW.fromToken?.price || _getNativePrice() || 0)
                              : _toIsNative   ? (SW.toToken?.price   || _getNativePrice() || 0)
                              : _getNativePrice(); // Token→Token: use chain's native token price

              // ── PRIORITY 1: API-provided gas cost (LiFi gasCosts.amountUSD, Rango FROM_SOURCE_WALLET, Socket feeInUsd) ──
              // If the route object already carries a USD gas cost from the API, use it directly.
              // This avoids unnecessary RPC estimateGas calls and is more accurate for cross-chain routes.
              if (_job.r._apiGasUSD != null && _job.r._apiGasUSD > 0) {
                const _usd = _job.r._apiGasUSD;
                _job.quote.gasFee = _usd < 0.0001 ? '<$0.0001'
                                  : _usd < 0.01   ? '$' + _usd.toFixed(4)
                                  : '$' + _usd.toFixed(2);
              }
              // ── PRIORITY 2: _priceOnly (Velora / no real calldata) — estimate from stored gas units ──
              else if (_job.priceOnly) {
                const _gasUnits    = BigInt(_txD.gas || 300000);
                const _gasPriceWei = BigInt(Math.ceil((SW._lastGasPriceGwei || 1) * 1e9));
                const _gasEth      = Number(_gasUnits * _gasPriceWei) / 1e18;
                if (_ethPrice > 0) {
                  const _usd = _gasEth * _ethPrice;
                  _job.quote.gasFee = _usd < 0.0001 ? '<$0.0001'
                                    : _usd < 0.01   ? '$' + _usd.toFixed(4)
                                    : '$' + _usd.toFixed(2);
                } else {
                  const _gwei = Number(_gasPriceWei) / 1e9;
                  _job.quote.gasFee = Number(_gasUnits).toLocaleString() + ' gas · ' + _gwei.toFixed(4) + ' Gwei';
                }
              }
              // ── PRIORITY 3 (Fallback): Real calldata available → RPC estimateGas ──
              else {
                const _estObj = {
                  from:  SW.walletAddress || undefined,
                  to:    _txD.to,
                  data:  _txD.data,
                  value: _txD.value ? BigInt(_txD.value) : 0n,
                };
                // getFeeData() pre-fetched once → SW._lastGasPriceGwei (no per-DEX RPC call)
                const _gasUnits    = await _nxsw__swWithFallback(_job.chainId, _p => _p.estimateGas(_estObj));
                const _gasPriceWei = BigInt(Math.ceil((SW._lastGasPriceGwei || 1) * 1e9));
                const _gasEth      = Number(_gasUnits * _gasPriceWei) / 1e18;
                if (_ethPrice > 0) {
                  const _usd = _gasEth * _ethPrice;
                  _job.quote.gasFee = _usd < 0.0001 ? '<$0.0001'
                                    : _usd < 0.01   ? '$' + _usd.toFixed(4)
                                    : '$' + _usd.toFixed(2);
                } else {
                  const _gwei = Number(_gasPriceWei) / 1e9;
                  _job.quote.gasFee = Number(_gasUnits).toLocaleString() + ' gas · ' + _gwei.toFixed(4) + ' Gwei';
                }
              }
            } catch(_) {
              _job.quote.gasFee = '—';
            }
            if (_job.sessionId === SW._quoteSession && typeof swRenderDexComparison === 'function') swRenderDexComparison();
            // 100ms stagger before next estimateGas → RPC rate limit safe
            if (SW._gasEstQueue.length > 0) await new Promise(res => setTimeout(res, 100));
          }
          SW._gasEstRunning = false;
        })();
      }

      // Add to realQuotes, re-sort by output
      realQuotes.push(quote);
      realQuotes.sort((a, b) => b.output - a.output);
      SW.quotes = realQuotes;

      // If user manually picked a route, keep showing that in TO box
      // Otherwise always show best (highest output)
      if (SW._manualRouteKey) {
        const manualIdx = realQuotes.findIndex(q => (q.dex + '::' + (q.apiSource || '')) === SW._manualRouteKey);
        if (manualIdx >= 0) {
          // Keep user's manual selection active
          SW._userSelectedDexIdx = manualIdx;
          SW.bestDex = realQuotes[manualIdx];
          SW.toAmount = realQuotes[manualIdx].output;
          SW._cachedSwapTx = realQuotes[manualIdx].txData;
          SW._manualDexIdx = manualIdx;
          SW._manualDexName = realQuotes[manualIdx].dex;
        } else {
          // Manual dex no longer available — fall back to best
          SW._manualDexName = null;
          SW._manualDexIdx = null;
          SW._manualRouteKey = null;
          SW._userSelectedDexIdx = 0;
          SW.bestDex = realQuotes[0];
          SW.toAmount = realQuotes[0].output;
          SW._cachedSwapTx = realQuotes[0].txData;
        }
      } else {
        // Auto-select best route — always update to highest output
        SW._userSelectedDexIdx = 0;
        SW.bestDex = realQuotes[0];
        SW.toAmount = realQuotes[0].output;
        SW._cachedSwapTx = realQuotes[0].txData;
      }

      // Update TO box with smooth fade
      const _tp = SW.toToken.price || 0;
      const _usdTxt = _tp > 0
        ? `≈ ${_formatCurrencyDisplay(SW.toAmount * _tp)}`
        : '≈ —';
      _swSetToAmount(
        swFormatAmount(SW.toAmount, SW.toToken ? SW.toToken.decimals : 18),
        _usdTxt
      );
      const toAmtEl = document.getElementById('sw-to-amount');
      if (toAmtEl) toAmtEl.style.color = 'var(--accent-green)';

      // Show comparison box live
      swRenderDexComparison();
      document.getElementById('sw-dex-compare').style.display = 'block';
      if (_cmpBadge) { const _rCount = SW.quotes ? SW.quotes.length : 0; const _bt=document.getElementById('sw-badge-text'); if(_bt)_bt.textContent='LIVE · '+_rCount+' router'+(_rCount!==1?'s':''); _cmpBadge.style.background='rgba(16,185,129,0.12)'; _cmpBadge.style.borderColor='rgba(16,185,129,0.3)'; _cmpBadge.style.color='var(--accent-green)'; const _bd=document.getElementById('sw-badge-dot'); if(_bd)_bd.style.animation='pulse 2s infinite'; }
      swUpdateButton();
    }

    const realQuotes = [];
    let doneCount = 0;
    const _apiNames = ['LiFi','Odos','1inch','SwapAPI','KyberSwap','OpenOcean','Socket','Rango','Symbiosis','Enso','Velora','DODO','Portals','Fly','OKX DEX','Squid'];
    const apiList = [_quoteLiFi(), _quoteOdos(), _quote1inch(), _quoteSwapApi(), _quoteKyber(), _quoteOpenOcean(), _quoteSocket(), _quoteRango(), _quoteSymbiosis(), _quoteEnso(), _quoteVelora(), _quoteDODO(), _quotePortals(), _quoteFly(), _quoteOKX(), _quoteSquid()];
    const total = apiList.length;

    apiList.forEach((p, _apiIdx) => {
      // OKX DEX (index 14) needs more time: /get-liquidity + N per-dex /quote calls staggered 150ms
      const _apiTimeout = (_apiIdx === 14) ? 90000 : 12000;
      Promise.race([p, new Promise(r => setTimeout(() => r('__timeout__'), _apiTimeout))])
        .then(result => {
          if (_quoteSessionId !== SW._quoteSession) return;
          const _aName = _apiNames[_apiIdx] || ('API#'+_apiIdx);
          if (result === '__timeout__') {
            _swLog(_aName, 'FAIL', 'timeout >7s');
          } else if (!result || (Array.isArray(result) && result.length === 0)) {
            _swLog(_aName, 'FAIL', 'no route');
          } else {
            // Support both single result (object) and multi-route array
            if (Array.isArray(result)) {
              result.forEach(r => _processQuoteResult(r));
            } else {
              _processQuoteResult(result);
            }
          }
          doneCount++;
          if (doneCount === total) {
            // All APIs done
            SW._routeFetching = false;
            if (realQuotes.length === 0) {
              // No routes found
              // No routes found — show clear message to user
              SW._cachedSwapTx = null;
              SW.toAmount = 0;
              document.getElementById('sw-dex-compare').style.display = 'none';
              if (_cmpBadge) { const _bt=document.getElementById('sw-badge-text'); if(_bt)_bt.textContent='EST'; _cmpBadge.style.background='rgba(245,158,11,0.12)'; _cmpBadge.style.borderColor='rgba(245,158,11,0.3)'; _cmpBadge.style.color='var(--accent-amber)'; }
              const _toAmtEl = document.getElementById('sw-to-amount');
              if (_toAmtEl) { _toAmtEl.textContent = '—'; _toAmtEl.style.color = 'var(--accent-green)'; }
              const _toUsdEl = document.getElementById('sw-to-usd');
              if (_toUsdEl) _toUsdEl.textContent = '≈ $0.00';
              const _errBox = document.getElementById('sw-error-box');
              if (_errBox) { _errBox.textContent = '⚠️ No routes available — no DEX aggregator returned a valid quote for this pair. Try a different amount or token.'; _errBox.style.display = 'block'; }
              console.warn('[One] No API returned valid quote');
            } else {
            }
            swUpdateButton();
          }
        })
        .catch(() => {
          doneCount++;
          if (doneCount === total && _quoteSessionId === SW._quoteSession) {
            SW._routeFetching = false;
            swUpdateButton();
          }
        });
    });

    // Don't await — let APIs stream in. Fall through.

  } catch(e) {
    clearInterval(SW.scanDexInterval);
    SW._routeFetching = false;
    SW._cachedSwapTx = null;
    SW.toAmount = 0;
    document.getElementById('sw-quote-loading').style.display = 'none';
    // Keep comparison box hidden on error — no real data available
    document.getElementById('sw-dex-compare').style.display = 'none';
    // Clear TO box on error
    const _toAmtElErr = document.getElementById('sw-to-amount');
    if (_toAmtElErr) { _toAmtElErr.textContent = '—'; _toAmtElErr.style.color = 'var(--accent-green)'; }
    const _toUsdElErr = document.getElementById('sw-to-usd');
    if (_toUsdElErr) _toUsdElErr.textContent = '≈ $0.00';
    swUpdateButton();
  }
}