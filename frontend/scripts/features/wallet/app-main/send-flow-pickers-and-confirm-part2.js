
// ── QR Scanner for Send-To Address ──
var _qrScanStream = null;
var _qrScanAnim = null;
var _qrBarcodeDetector = null;
var _qrCanvasRetry = 0;        // Bug 3 fix: canvas zero-size retry counter
var _qrCameraStarted = false;  // Bug 1 fix: atomic lock across async paths

// fromHome=true: opened from the home top bar; a valid scan then opens Send with the address filled in
function openSendQrScanner(fromHome) {
  var overlay = document.getElementById('send-qr-modal-overlay');
  if (!overlay) return;
  window._qrFromHome = (fromHome === true);
  overlay.classList.add('open');
  _startQrCamera();
  if (typeof haptic === 'function') haptic();
}

function homeOpenQrScan() { openSendQrScanner(true); }

function closeSendQrScanner() {
  var overlay = document.getElementById('send-qr-modal-overlay');
  if (overlay) overlay.classList.remove('open');
  _stopQrCamera();
}

function _stopQrCamera() {
  if (_qrScanAnim) { cancelAnimationFrame(_qrScanAnim); _qrScanAnim = null; }
  if (_qrScanStream) {
    _qrScanStream.getTracks().forEach(function(t) { t.stop(); });
    _qrScanStream = null;
  }
  var video = document.getElementById('send-qr-video');
  if (video) { video.srcObject = null; }
}

async function _startQrCamera() {
  _stopQrCamera();
  _qrCameraStarted = false; // Bug 1 fix: reset atomic lock
  _qrCanvasRetry = 0;       // Bug 3 fix: reset canvas retry counter

  var video = document.getElementById('send-qr-video');
  var status = document.getElementById('send-qr-status');
  if (!video || !status) return;

  status.textContent = '';

  // Pre-init BarcodeDetector
  if (typeof BarcodeDetector !== 'undefined') {
    try { _qrBarcodeDetector = new BarcodeDetector({ formats: ['qr_code'] }); } catch(e) { _qrBarcodeDetector = null; }
  } else { _qrBarcodeDetector = null; }

  // Check permission state first
  if (navigator.permissions) {
    try {
      var perm = await navigator.permissions.query({ name: 'camera' });
      if (perm.state === 'denied') { _showQrPermissionUI(); return; }
    } catch(e) {}
  }

  try {
    var stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    _qrScanStream = stream;

    // Android WebView: force muted + set attributes before srcObject
    video.muted = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('autoplay', '');
    video.srcObject = stream;

    // Bug 1 fix: single guarded entry point using _qrCameraStarted
    // replaces the old _started local var which was racy across async paths
    function _onCanPlay() {
      if (_qrCameraStarted) return;
      _qrCameraStarted = true;
      var p = video.play();
      if (p && p.catch) p.catch(function(){});
      status.textContent = 'Scanning...';
      status.style.color = 'var(--neon-purple)';
      _qrScanLoop();
    }
    video.addEventListener('canplay', _onCanPlay, { once: true });
    video.addEventListener('loadeddata', _onCanPlay, { once: true });
    video.addEventListener('loadedmetadata', _onCanPlay, { once: true });

    // Immediate play attempt — _onCanPlay guard prevents double-start
    var p0 = video.play();
    if (p0 && p0.then) {
      p0.then(function() { _onCanPlay(); }).catch(function(){});
    }

    // Hard fallback: 1.5s timeout
    setTimeout(function() { _onCanPlay(); }, 1500);

  } catch(err) {
    var isDenied = err && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError');
    if (isDenied) { _showQrPermissionUI(); }
    else { status.textContent = 'Camera unavailable'; status.style.color = 'rgba(244,63,94,0.9)'; }
  }
}

function _showQrPermissionUI() {
  var inner = document.getElementById('send-qr-inner');
  if (!inner) return;
  // Replace video area with permission prompt
  var videoWrap = document.getElementById('send-qr-video-wrap');
  var status = document.getElementById('send-qr-status');
  if (videoWrap) {
    videoWrap.innerHTML =
      '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'padding:32px 20px;gap:14px;min-height:200px;">' +
      '<span class="material-icons-round" style="font-size:48px;color:rgba(99,102,241,0.7);">photo_camera</span>' +
      '<div style="font-size:13px;font-weight:700;color:var(--text-primary);text-align:center;">Camera Permission Required</div>' +
      '<div style="font-size:11px;color:var(--text-muted);text-align:center;line-height:1.6;font-family:var(--font-mono);">' +
      'Allow camera access to scan<br>wallet address QR codes</div>' +
      '<button onclick="_requestQrCameraPermission()" style="margin-top:6px;padding:10px 24px;border-radius:10px;' +
      'background:rgba(99,102,241,0.18);border:1px solid rgba(99,102,241,0.45);' +
      'color:var(--neon-purple);font-family:var(--font-mono);font-size:11px;font-weight:700;' +
      'letter-spacing:1px;cursor:pointer;">ALLOW CAMERA</button>' +
      '</div>';
  }
  if (status) { status.textContent = ''; }
}

async function _requestQrCameraPermission() {
  // Re-trigger getUserMedia to prompt the system permission dialog
  try {
    var stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    stream.getTracks().forEach(function(t) { t.stop(); });
    // Permission granted — rebuild modal and start camera
    var videoWrap = document.getElementById('send-qr-video-wrap');
    if (videoWrap) {
      videoWrap.innerHTML =
        '<video id="send-qr-video" autoplay playsinline muted></video>' +
        '<canvas id="send-qr-canvas" style="display:none;"></canvas>' +
        '<div id="send-qr-aim">' +
        '<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M10 30 L10 10 L30 10" stroke="#6366f1" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="M70 10 L90 10 L90 30" stroke="#6366f1" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="M90 70 L90 90 L70 90" stroke="#6366f1" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="M30 90 L10 90 L10 70" stroke="#6366f1" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>' +
        '</svg></div>';
    }
    _qrCameraStarted = false; // Bug 4 fix: reset lock before restarting camera after DOM rebuild
    _startQrCamera();
  } catch(err) {
    // Still denied — show settings hint
    var videoWrap = document.getElementById('send-qr-video-wrap');
    if (videoWrap) {
      var btn = videoWrap.querySelector('button');
      if (btn) {
        btn.textContent = 'OPEN APP SETTINGS';
        btn.onclick = function() {
          // Android: open app settings via intent if available
          if (window.android && typeof window.android.openAppSettings === 'function') {
            window.android.openAppSettings();
          } else {
            closeSendQrScanner();
          }
        };
        var hint = videoWrap.querySelector('div:nth-child(3)');
        if (hint) hint.innerHTML = 'Permission denied. Enable camera<br>in App Settings to scan QR codes.';
      }
    }
  }
}

function _qrScanLoop() {
  var video = document.getElementById('send-qr-video');
  var canvas = document.getElementById('send-qr-canvas');
  if (!video || !canvas || !_qrScanStream) return;

  // BarcodeDetector path (native, fast)
  if (_qrBarcodeDetector) {
    _qrBarcodeDetector.detect(video).then(function(codes) {
      if (codes && codes.length > 0) {
        var raw = codes[0].rawValue || '';
        _handleQrResult(raw);
        return;
      }
      _qrScanAnim = requestAnimationFrame(_qrScanLoop);
    }).catch(function() {
      _qrScanAnim = requestAnimationFrame(_qrScanLoop);
    });
    return;
  }

  // Bug 2 fix: jsQR loaded from local asset — no CDN dependency
  if (typeof jsQR === 'undefined') {
    var s = document.createElement('script');
    s.src = 'js/vendor/jsqr.min.js'; // local asset, works offline
    s.onload = function() { _qrScanAnim = requestAnimationFrame(_qrScanLoop); };
    s.onerror = function() {
      var status = document.getElementById('send-qr-status');
      if (status) { status.textContent = 'QR library unavailable. Paste address manually.'; status.style.color = 'rgba(245,158,11,0.9)'; }
    };
    document.head.appendChild(s);
    return;
  }

  var ctx = canvas.getContext('2d');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  // Bug 3 fix: canvas zero-size — limit retries to ~2.5s (150 frames) then show error
  if (canvas.width === 0 || canvas.height === 0) {
    _qrCanvasRetry++;
    if (_qrCanvasRetry > 150) {
      var status = document.getElementById('send-qr-status');
      if (status) { status.textContent = 'Camera feed unavailable. Try closing and reopening.'; status.style.color = 'rgba(244,63,94,0.9)'; }
      return; // stop loop — don't spin forever
    }
    _qrScanAnim = requestAnimationFrame(_qrScanLoop);
    return;
  }
  _qrCanvasRetry = 0; // reset once video is live

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  var code = jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: 'dontInvert' });
  if (code && code.data) {
    _handleQrResult(code.data);
    return;
  }
  _qrScanAnim = requestAnimationFrame(_qrScanLoop);
}

function _handleQrResult(raw) {
  if (!raw) return;

  // Extract address: handles plain 0x address, ethereum:0x..., or EIP-681
  var addr = raw.trim();
  // ethereum:0xABC...?value=... or EIP-681 URI
  var match = addr.match(/(?:ethereum:)?(0x[0-9a-fA-F]{40})/i);
  if (match) addr = match[1];

  // Basic format check
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) {
    var status = document.getElementById('send-qr-status');
    if (status) { status.textContent = 'Not a valid address QR. Try again.'; status.style.color = 'rgba(244,63,94,0.9)'; }
    _qrScanAnim = requestAnimationFrame(_qrScanLoop);
    return;
  }

  // Checksum validation via ethers.js — rejects corrupted/partial scans
  // ethers.isAddress() verifies EIP-55 checksum if mixed-case, accepts lowercase
  try {
    if (typeof ethers !== 'undefined' && ethers.isAddress) {
      if (!ethers.isAddress(addr)) {
        var status = document.getElementById('send-qr-status');
        if (status) { status.textContent = 'Invalid address checksum. Try again.'; status.style.color = 'rgba(244,63,94,0.9)'; }
        _qrScanAnim = requestAnimationFrame(_qrScanLoop);
        return;
      }
      // Normalize to checksum address (EIP-55)
      addr = ethers.getAddress(addr);
    }
  } catch(e) {
    // ethers validation failed — address is corrupt
    var status = document.getElementById('send-qr-status');
    if (status) { status.textContent = 'Invalid address. Try again.'; status.style.color = 'rgba(244,63,94,0.9)'; }
    _qrScanAnim = requestAnimationFrame(_qrScanLoop);
    return;
  }

  // Valid checksum address found
  var _fromHome = (window._qrFromHome === true);
  window._qrFromHome = false;
  closeSendQrScanner();
  function _fillSendTo() {
    var inp = document.getElementById('send-to');
    if (inp && inp.value !== addr) {
      inp.value = addr;
      if (typeof onSendToInput === 'function') onSendToInput();
    }
  }
  // Home scan: open Send first (it clears the recipient field), then fill the address
  if (_fromHome && typeof openSendModal === 'function') {
    openSendModal();
    _fillSendTo();
    setTimeout(_fillSendTo, 300);
  } else {
    _fillSendTo();
  }
  if (typeof haptic === 'function') haptic();
}

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
  if (sym === 'ETH' || sym === 'WETH') price = sendPrices.ETH || 0;
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
  if (t) return { symbol: t.sub, decimals: t.decimals || 18, native: false, contract: t.contract };
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
