
function _getSendMaxBal() {
  const tok = sendSelectedToken;
  const nativeTok = loadSavedTokens().find(t => (t.chainId || 8453) === sendSelectedChainId && t.isNative);
  const nativeId  = nativeTok ? nativeTok.id : 'eth';
  const isNative  = (tok === 'eth' || tok === nativeId);
  let bal = parseFloat(sendBalances[tok] || sendBalances[nativeId] || 0);
  // ── No gas buffer for Base — paymaster sponsors gas (delegation confirmed later in confirm sheet)
  // For non-Base native sends, keep conservative 0.0005 ETH buffer
  if (isNative && bal > 0.001 && sendSelectedChainId !== 8453) bal = bal - 0.0005;
  return bal > 0 ? bal : 0;
}

// ── Smart number formatter for send UI ──
// Input field value (full precision, no trailing zeros)
function _fmtAmtInput(n) {
  if (!n || n === 0) return '';
  // toPrecision(6) can produce scientific notation (e.g. 1.23e-8) which
  // ethers.parseUnits cannot parse → use toFixed with enough precision instead
  const p = parseFloat(n.toPrecision(6));
  // If toPrecision result is in scientific notation, fall back to toFixed(18)
  // and strip trailing zeros so the string stays clean
  const s = p.toString();
  if (s.includes('e') || s.includes('E')) {
    return p.toFixed(18).replace(/\.?0+$/, '') || '0';
  }
  return s;
}
// Premium balance display — Uniswap-style subscript zero notation
// e.g. 0.00000000000816 → 0.0₁₁816
function _fmtBalDisplay(n) {
  if (!n || n === 0) return '0';
  if (n >= 1000)   return n.toLocaleString('en-US', {maximumFractionDigits: 2});
  if (n >= 1)      return n.toLocaleString('en-US', {maximumFractionDigits: 4});
  if (n >= 0.001)  return parseFloat(n.toPrecision(3)).toString();
  // Count leading zeros after '0.'
  const str = n.toFixed(20);
  const match = str.match(/^0\.(0+)([1-9].*)$/);
  if (!match) return n.toExponential(2);
  const zeros = match[1].length;
  const sig = match[2].slice(0, 3).replace(/0+$/, '');
  if (zeros <= 3) return '0.' + match[1] + sig;
  // 4+ leading zeros → subscript compact: 0.0₄816
  const subMap = {'0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉'};
  const sub = String(zeros).split('').map(c => subMap[c]).join('');
  return '0.0' + sub + sig;
}

function _updateSendSliderUI(pct) {
  const rangeEl  = document.getElementById('send-pct-range');
  const fillEl   = document.getElementById('send-pct-fill');
  const badgeEl  = document.getElementById('send-pct-badge');
  const trackEl  = rangeEl?.parentElement;
  if (!rangeEl) return;
  const v = pct || 0;
  if (fillEl)  fillEl.style.width = v + '%';
  if (badgeEl) badgeEl.textContent = v > 0 ? v + '%' : '—%';
  if (trackEl) trackEl.style.setProperty('--thumb-pct', v + '%');
  rangeEl.value = v;
}

function onSendPctSlider(val) {
  const pct = parseInt(val, 10);
  const bal = _getSendMaxBal();
  const amt = bal > 0 ? (bal * pct / 100) : 0;
  const el  = document.getElementById('send-amount');
  if (el) {
    el.dataset.fullVal = amt > 0 ? String(amt) : '';
    el.value = amt > 0 ? _fmtBalDisplay(amt) : '';
  }
  _updateSendSliderUI(pct);
  onSendAmountInput();
}

function onSendAmountInput() {
  const el = document.getElementById('send-amount');
  const rawVal = el?.value || '';
  // If user manually typed a new value, clear the native MAX flag so re-opening
  // the confirm sheet won't override their entered amount
  if (el && rawVal && /^[\d.]+$/.test(rawVal) && el.dataset.userTyped === '1') {
    window._sendMaxIsNative    = false;
    window._nativeMaxFinalAmt  = null;
    el.dataset.userTyped = '';
  }
  // Parse the raw numeric value — strip subscript/unicode chars and re-parse
  const cleanVal = rawVal.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, '').replace(/[^\d.eE\-+]/g, '');
  const amt = parseFloat(el?.dataset?.fullVal || cleanVal) || 0;
  // If user typed a clean number, update fullVal to match
  if (el && rawVal && /^[\d.]+$/.test(rawVal)) {
    el.dataset.fullVal = rawVal;
  }
  const tok = sendSelectedToken;
  const tokInfo = getSendTokenInfo ? getSendTokenInfo(tok) : SEND_TOKENS[tok];
  // Price estimate — use ETH price for ETH/WETH-like tokens, stablecoin = 1
  const sym = tokInfo?.symbol?.toUpperCase() || '';
  let price = 0;
  if (tokInfo && tokInfo.symPriceOk === false) {
    // Unverified contract token: never priced by its ticker ("ETH" / "USDC" are just text it returns).
    // Use only the contract-based price the home screen already resolved for this token, if any.
    const _tc = (typeof TOKEN_CONFIG !== 'undefined' ? TOKEN_CONFIG : []).find(x => x.id === tok);
    price = (_tc && _tc.price > 0) ? _tc.price : 0;
  }
  else if (sym === 'ETH' || sym === 'WETH') price = sendPrices.ETH || 0;
  else if (sym === 'USDC' || sym === 'USDT' || sym === 'DAI' || sym === 'USDBC') price = 1;
  else price = sendPrices[sym] || 0;
  const usd = amt * price;
  (document.getElementById('send-amount-usd') || {}).textContent = usd > 0 ? '≈ ' + _formatCurrencyDisplay(usd) : '≈ ' + _formatCurrencyDisplay(0);
  checkSendReady();
}

function setSendMax() {
  const tok = sendSelectedToken;
  const nativeTok = loadSavedTokens().find(t => (t.chainId || 8453) === sendSelectedChainId && t.isNative);
  const nativeId  = nativeTok ? nativeTok.id : 'eth';
  const isNative  = (tok === 'eth' || tok === nativeId);

  // For native tokens: use _getSendMaxBal() which already has a conservative gas buffer (-0.0005).
  // For ERC-20: use raw balance (gas paid in native, not in token).
  const rawBal  = parseFloat(sendBalances[tok] || sendBalances[nativeId] || 0);
  const safeBal = isNative ? _getSendMaxBal() : rawBal;

  const amtInput = document.getElementById('send-amount');
  if (amtInput) {
    amtInput.dataset.fullVal = safeBal > 0 ? String(safeBal) : '';
    amtInput.value           = safeBal > 0 ? _fmtBalDisplay(safeBal) : '';
  }
  _updateSendSliderUI(safeBal > 0 ? 100 : 0);
  onSendAmountInput();

  // Flag: native MAX clicked — confirm sheet will do a precise live gas estimation on top
  window._sendMaxIsNative = isNative && rawBal > 0;
}

// ── HELPER: get current send token info from MY TOKENS or native ──
function getSendTokenInfo(tokenId) {
  // Check if it's the native token for current chain
  const nativeTok = loadSavedTokens().find(t => (t.chainId || 8453) === sendSelectedChainId && t.isNative);
  const nativeId = nativeTok ? nativeTok.id : 'eth';
  if (tokenId === 'eth' || tokenId === nativeId) {
    const sym = nativeTok?.sub || getAllChains().find(c => c.chainId === sendSelectedChainId)?.nativeSym || 'ETH';
    return { symbol: sym, decimals: 18, native: true, contract: null };
  }
  const t = loadSavedTokens().find(t => t.id === tokenId && (t.chainId || 8453) === sendSelectedChainId) ||
             loadSavedTokens().find(t => t.id === tokenId);
  if (t) return { symbol: t.sub, decimals: t.decimals || 18, native: false, contract: t.contract, symPriceOk: oneSymbolPriceAllowed(t) };
  if (SEND_TOKENS && SEND_TOKENS[tokenId]) return SEND_TOKENS[tokenId];
  return null;
}

function checkSendReady() {
  const pk = document.getElementById('send-pk')?.value.trim();
  const to = document.getElementById('send-to')?.value.trim();
  const _amtEl3 = document.getElementById('send-amount');
  // Parse amount: prefer fullVal (set by MAX/slider/key-select), fallback to cleaned display value
  const _fullVal = _amtEl3?.dataset?.fullVal;
  const _rawVal  = (_amtEl3?.value || '').replace(/[₀₁₂₃₄₅₆₇₈₉]/g,'').replace(/[^\d.eE\-+]/g,'');
  const amt = parseFloat(_fullVal || _rawVal || '0');
  const validPk = sendSelectedKeyIndex >= 0 ? true : pk && (pk.startsWith('0x') ? pk : '0x' + pk).length === 66;
  const validTo = /^0x[0-9a-fA-F]{40}$/.test(to);
  const validAmt = amt > 0;
  const ready = validPk && validTo && validAmt && sendWallet;
  (document.getElementById('send-btn') || {}).disabled = !ready;

  if (ready) {
    const tok = getSendTokenInfo(sendSelectedToken);
    const shortFrom = sendWallet.address.slice(0,8) + '…' + sendWallet.address.slice(-6);
    const shortTo = to.slice(0,8) + '…' + to.slice(-6);
    const chain = getAllChains().find(c => c.chainId === sendSelectedChainId);
    (document.getElementById('review-from') || {}).textContent = shortFrom;
    (document.getElementById('review-to') || {}).textContent = shortTo;
    (document.getElementById('review-amount') || {}).textContent = amt + ' ' + (tok?.symbol || sendSelectedToken.toUpperCase());
    (document.getElementById('review-token') || {}).textContent = tok?.symbol || sendSelectedToken.toUpperCase();
    (document.getElementById('review-network') || {}).textContent = chain ? chain.name : 'Unknown';
    (document.getElementById('review-gas') || {}).textContent = 'Estimating…';
    // review card shown only after SEND click
  } else {
    const _src4 = document.getElementById('send-review-card'); if (_src4) _src4.style.display = 'none';
  }
  if (typeof _sendUiRefresh === 'function') _sendUiRefresh();
}

async function estimateSendGas(to, amt) {
  if (!sendWallet || !sendProvider) return;
  try {
    const tok = getSendTokenInfo(sendSelectedToken);
    if (!tok) return;
    let gasLimit;
    if (tok.native) {
      try {
        gasLimit = await _withRpcFallback(sendSelectedChainId, _p => _p.estimateGas({ from: sendWallet.address, to, value: ethers.parseEther(String(amt)) }));
      } catch (_ge) {
        // estimateGas can fail if `to` is a contract with no payable fallback, or RPC issues
        // Safe fallback: 65000 covers plain EOA (21000) and most contract receives
        gasLimit = 65000n;
      }
    } else {
      try {
        gasLimit = await _withRpcFallback(sendSelectedChainId, _p => {
          const _c = new ethers.Contract(tok.contract, ERC20_SEND_ABI, _p);
          return _c.transfer.estimateGas(to, ethers.parseUnits(String(amt), tok.decimals));
        });
      } catch (_ge) {
        gasLimit = 65000n; // ERC-20 transfer safe fallback
      }
    }
    const feeData = await _withRpcFallback(sendSelectedChainId, _p => _p.getFeeData());
    const gasCost = gasLimit * (feeData.maxFeePerGas || feeData.gasPrice || 1000000000n);
    const gasCostEth = parseFloat(ethers.formatEther(gasCost)).toFixed(6);
    (document.getElementById('review-gas') || {}).textContent = '~' + gasCostEth + ' ETH';
    // Only update csheet-gas if not already showing sponsored/gasless
    const cg = document.getElementById('csheet-gas');
    if (cg && !cg.textContent.includes('FREE') && !cg.textContent.includes('Sponsored')) {
      cg.textContent = '~' + gasCostEth + ' ETH';
      cg.style.color = '';
    }
  } catch(e) {
    (document.getElementById('review-gas') || {}).textContent = 'Could not estimate';
    const cg = document.getElementById('csheet-gas');
    if (cg && !cg.textContent.includes('FREE') && !cg.textContent.includes('Sponsored')) {
      cg.textContent = 'Could not estimate';
      cg.style.color = '';
    }
  }
}
