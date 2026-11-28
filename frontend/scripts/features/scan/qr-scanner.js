// ── QR scanner + router ───────────────────────────────────────
// One scanner for the whole app (Home top-bar button and the Send "To" field).
// What a scan does depends on what the code is (see qr-classify.js):
//   address        -> opens Send with the recipient filled in (or fills the Send "To" field)
//   walletconnect  -> starts a WalletConnect pairing; the connect-confirm sheet shows (wcPair in walletconnect/)
//   url            -> opens the website in the app's own browser
//   unknown        -> message in the scanner, camera keeps running
var _qrScanStream = null;
var _qrScanAnim = null;
var _qrBarcodeDetector = null;
var _qrCanvasRetry = 0;
var _qrDetectFails = 0;
var _qrCameraStarted = false;
var _qrTorchOn = false;
var _qrHandling = false;
var _qrFrame = 0;
var _qrLastBad = { raw: '', t: 0 };

// fromHome=true: opened from the home top bar; a valid address then opens Send with the address filled in
function openSendQrScanner(fromHome) {
  var overlay = document.getElementById('send-qr-modal-overlay');
  if (!overlay) return;
  window._qrFromHome = (fromHome === true);
  _qrHandling = false;
  overlay.classList.remove('qr-ok', 'qr-noperm');
  overlay.classList.add('open');
  _startQrCamera();
  if (typeof haptic === 'function') haptic();
}

function homeOpenQrScan() { openSendQrScanner(true); }

function closeSendQrScanner() {
  var overlay = document.getElementById('send-qr-modal-overlay');
  if (overlay) overlay.classList.remove('open', 'qr-ok');
  _qrHandling = false;
  _stopQrCamera();
}

function _qrSetStatus(text, kind) {
  var el = document.getElementById('send-qr-status');
  if (!el) return;
  el.textContent = text;
  el.setAttribute('data-kind', kind || 'scan');
}

function _stopQrCamera() {
  if (_qrScanAnim) { cancelAnimationFrame(_qrScanAnim); _qrScanAnim = null; }
  if (_qrScanStream) {
    _qrScanStream.getTracks().forEach(function (t) { t.stop(); });
    _qrScanStream = null;
  }
  _qrTorchOn = false;
  var torch = document.getElementById('send-qr-torch');
  if (torch) { torch.classList.remove('on'); torch.style.display = 'none'; }
  var video = document.getElementById('send-qr-video');
  if (video) { video.srcObject = null; }
}

async function _startQrCamera() {
  _stopQrCamera();
  _qrCameraStarted = false;
  _qrCanvasRetry = 0;
  _qrDetectFails = 0;
  _qrFrame = 0;

  var video = document.getElementById('send-qr-video');
  var overlay = document.getElementById('send-qr-modal-overlay');
  if (!video || !overlay) return;
  overlay.classList.remove('qr-noperm');
  _qrSetStatus('Starting camera...', 'scan');

  if (typeof BarcodeDetector !== 'undefined') {
    try { _qrBarcodeDetector = new BarcodeDetector({ formats: ['qr_code'] }); } catch (e) { _qrBarcodeDetector = null; }
  } else { _qrBarcodeDetector = null; }

  if (navigator.permissions) {
    try {
      var perm = await navigator.permissions.query({ name: 'camera' });
      if (perm.state === 'denied') { _showQrPermissionUI(); return; }
    } catch (e) {}
  }

  try {
    var stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    // The scanner may have been closed while the permission dialog was open
    if (!overlay.classList.contains('open')) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
    _qrScanStream = stream;

    video.muted = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('autoplay', '');
    video.srcObject = stream;

    _qrSetupTorch(stream);

    var onCanPlay = function () {
      if (_qrCameraStarted) return;
      _qrCameraStarted = true;
      var p = video.play();
      if (p && p.catch) p.catch(function () {});
      _qrSetStatus('Point the camera at a QR code', 'scan');
      _qrScanLoop();
    };
    video.addEventListener('canplay', onCanPlay, { once: true });
    video.addEventListener('loadeddata', onCanPlay, { once: true });
    video.addEventListener('loadedmetadata', onCanPlay, { once: true });
    var p0 = video.play();
    if (p0 && p0.then) p0.then(onCanPlay).catch(function () {});
    setTimeout(onCanPlay, 1500);
  } catch (err) {
    var denied = err && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError');
    if (denied) { _showQrPermissionUI(); }
    else { _qrSetStatus('Camera unavailable. You can scan from the gallery.', 'err'); }
  }
}

// ── Flashlight (only shown when the camera reports torch support) ──
function _qrSetupTorch(stream) {
  var btn = document.getElementById('send-qr-torch');
  if (!btn) return;
  try {
    var track = stream.getVideoTracks()[0];
    var caps = track && track.getCapabilities ? track.getCapabilities() : null;
    if (caps && caps.torch) btn.style.display = 'flex';
  } catch (e) {}
}

function qrToggleTorch() {
  if (!_qrScanStream) return;
  var track = _qrScanStream.getVideoTracks()[0];
  if (!track || !track.applyConstraints) return;
  var next = !_qrTorchOn;
  track.applyConstraints({ advanced: [{ torch: next }] }).then(function () {
    _qrTorchOn = next;
    var btn = document.getElementById('send-qr-torch');
    if (btn) btn.classList.toggle('on', next);
    if (typeof haptic === 'function') haptic();
  }).catch(function () {
    if (typeof showToast === 'function') showToast('Flashlight not available', 'warning');
  });
}

// ── Camera permission state ──
function _showQrPermissionUI() {
  var overlay = document.getElementById('send-qr-modal-overlay');
  if (overlay) overlay.classList.add('qr-noperm');
  var btn = document.getElementById('send-qr-perm-btn');
  if (btn) { btn.textContent = 'Allow camera'; btn.onclick = _requestQrCameraPermission; }
}

async function _requestQrCameraPermission() {
  try {
    var stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    stream.getTracks().forEach(function (t) { t.stop(); });
    _startQrCamera();
  } catch (err) {
    var txt = document.getElementById('send-qr-perm-text');
    var btn = document.getElementById('send-qr-perm-btn');
    if (txt) txt.innerHTML = 'Camera access was denied.<br>Turn it on in the app settings to scan.';
    if (btn) {
      btn.textContent = 'Open app settings';
      btn.onclick = function () {
        if (window.OneAndroid && typeof OneAndroid.openAppSettings === 'function') OneAndroid.openAppSettings();
        else closeSendQrScanner();
      };
    }
  }
}

// ── Decode loop ──
function _qrScanLoop() {
  var video = document.getElementById('send-qr-video');
  var canvas = document.getElementById('send-qr-canvas');
  if (!video || !canvas || !_qrScanStream || _qrHandling) return;

  if (_qrBarcodeDetector) {
    _qrBarcodeDetector.detect(video).then(function (codes) {
      _qrDetectFails = 0;
      if (codes && codes.length > 0 && codes[0].rawValue) { _handleQrResult(codes[0].rawValue); return; }
      _qrScanAnim = requestAnimationFrame(_qrScanLoop);
    }).catch(function () {
      // BarcodeDetector can exist but be unusable in a WebView (e.g. no Google Play services). Retrying it
      // forever means the code is never decoded, so after 3 failures on a live frame switch to jsQR.
      if (video.readyState >= 2 && ++_qrDetectFails >= 3) _qrBarcodeDetector = null;
      _qrScanAnim = requestAnimationFrame(_qrScanLoop);
    });
    return;
  }

  if (typeof jsQR === 'undefined') {
    _qrSetStatus('QR library unavailable. Scan from the gallery.', 'warn');
    return;
  }

  // Decode every 2nd frame on a downscaled copy: much lighter on weak phones
  if ((++_qrFrame & 1) === 1) { _qrScanAnim = requestAnimationFrame(_qrScanLoop); return; }

  var vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh) {
    _qrCanvasRetry++;
    if (_qrCanvasRetry > 150) { _qrSetStatus('Camera feed unavailable. Close and open the scanner again.', 'err'); return; }
    _qrScanAnim = requestAnimationFrame(_qrScanLoop);
    return;
  }
  _qrCanvasRetry = 0;

  var scale = Math.min(1, 720 / vw);
  var w = Math.round(vw * scale), h = Math.round(vh * scale);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  var ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(video, 0, 0, w, h);
  var img = ctx.getImageData(0, 0, w, h);
  var code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
  if (code && code.data) { _handleQrResult(code.data); return; }
  _qrScanAnim = requestAnimationFrame(_qrScanLoop);
}

// ── Scan from a gallery image ──
function qrPickImage() {
  var f = document.getElementById('send-qr-file');
  if (f) { f.value = ''; f.click(); }
}

function qrImageChosen(input) {
  var file = input && input.files && input.files[0];
  if (!file) return;
  var overlay = document.getElementById('send-qr-modal-overlay');
  if (overlay) overlay.classList.remove('qr-noperm');
  _qrSetStatus('Reading image...', 'scan');
  var url = URL.createObjectURL(file);
  var img = new Image();
  img.onload = function () {
    try {
      var scale = Math.min(1, 1400 / Math.max(img.width, img.height));
      var c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * scale));
      c.height = Math.max(1, Math.round(img.height * scale));
      var ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, c.width, c.height);
      var data = ctx.getImageData(0, 0, c.width, c.height);
      var code = (typeof jsQR === 'function') ? jsQR(data.data, data.width, data.height, { inversionAttempts: 'attemptBoth' }) : null;
      if (code && code.data) { _handleQrResult(code.data); }
      else { _qrSetStatus('No QR code found in that image', 'err'); }
    } catch (e) { _qrSetStatus('Could not read that image', 'err'); }
    URL.revokeObjectURL(url);
  };
  img.onerror = function () { URL.revokeObjectURL(url); _qrSetStatus('Could not read that image', 'err'); };
  img.src = url;
}

// ── Result handling ──
function _qrReject(raw, msg) {
  var now = Date.now();
  // the same wrong code is seen on every frame: show the message once, then keep scanning quietly
  if (_qrLastBad.raw !== raw || now - _qrLastBad.t > 2500) {
    _qrSetStatus(msg, 'err');
    if (typeof haptic === 'function') haptic();
  }
  _qrLastBad = { raw: raw, t: now };
  if (_qrScanStream) _qrScanAnim = requestAnimationFrame(_qrScanLoop);
}

function _handleQrResult(raw) {
  if (!raw || _qrHandling) return;
  var res = qrClassify(raw);

  if (res.type === 'unknown') {
    var msg = res.reason === 'bad-address' ? 'That address looks incomplete. Try again.'
            : res.reason === 'bad-walletconnect' ? 'That WalletConnect code is not valid.'
            : 'This QR code is not supported';
    return _qrReject(raw, msg);
  }

  if (res.type === 'address') {
    var addr = res.address;
    try {
      if (typeof ethers !== 'undefined' && ethers.isAddress) {
        // isAddress checks the EIP-55 checksum of mixed-case addresses: rejects corrupted scans
        if (!ethers.isAddress(addr)) return _qrReject(raw, 'Invalid address checksum. Try again.');
        addr = ethers.getAddress(addr);
      }
    } catch (e) { return _qrReject(raw, 'Invalid address. Try again.'); }
    res.address = addr;
  }

  if (res.type === 'walletconnect' && res.version === 1) {
    return _qrReject(raw, 'WalletConnect v1 is no longer supported');
  }

  _qrHandling = true;
  if (_qrScanAnim) { cancelAnimationFrame(_qrScanAnim); _qrScanAnim = null; }
  var label = res.type === 'address' ? 'Address found' : res.type === 'walletconnect' ? 'WalletConnect found' : 'Website found';
  _qrSetStatus(label, 'ok');
  var overlay = document.getElementById('send-qr-modal-overlay');
  if (overlay) overlay.classList.add('qr-ok');
  if (typeof haptic === 'function') haptic();
  setTimeout(function () { _qrDispatch(res); }, 380);
}

function _qrDispatch(res) {
  var fromHome = (window._qrFromHome === true);
  window._qrFromHome = false;
  closeSendQrScanner();

  if (res.type === 'address') return _qrUseAddress(res.address, fromHome);
  if (res.type === 'walletconnect') return _qrStartWalletConnect(res.uri);
  if (res.type === 'url') return _qrOpenWebsite(res);
}

function _qrUseAddress(addr, fromHome) {
  function fill() {
    var inp = document.getElementById('send-to');
    if (inp && inp.value !== addr) {
      inp.value = addr;
      if (typeof onSendToInput === 'function') onSendToInput();
    }
  }
  // Home scan: open Send first (it clears the recipient field), then fill the address
  if (fromHome && typeof openSendModal === 'function') {
    openSendModal();
    fill();
    setTimeout(fill, 300);
  } else {
    fill();
  }
}

function _qrStartWalletConnect(uri) {
  if (typeof wcPair === 'function') { wcPair(uri); return; }
  if (typeof showToast === 'function') showToast('WalletConnect is not available yet', 'warning');
}

function _qrOpenWebsite(res) {
  if (typeof showToast === 'function') showToast('Opening ' + res.host, 'language');
  if (window.OneAndroid && typeof OneAndroid.openInAppBrowser === 'function') OneAndroid.openInAppBrowser(res.url, res.host);
  else window.open(res.url, '_blank', 'noopener');
}
