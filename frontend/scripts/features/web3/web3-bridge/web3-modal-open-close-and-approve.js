'use strict';
// ── Modal open/close ───────────────────────────────────────
function _openModal(opts) {
  // opts: { reqId, method, title, actionLabel, bodyHtml, siteHost, onApprove, onReject, approveLabel }
  _w3mCurrentReq = opts;
  _w3mOpen = true;

  // If InAppBrowserActivity is open, inject modal directly into dApp WebView
  // so browser never closes/switches. Approve/Reject come back via
  // _oneModalApproveFromBrowser / _oneModalRejectFromBrowser callbacks.
  // Only inject into dApp WebView if InAppBrowserActivity is actually running.
  // If browser was closed (back-press) but request arrived in-flight, isBrowserOpen()
  // returns false and we fall through to the built-in overlay in Main WebView instead.
  var _browserActive = false;
  try { _browserActive = !!(window.OneAndroid && OneAndroid.isBrowserOpen && OneAndroid.isBrowserOpen()); } catch(_) {}
  if (window.isOneAndroid && window.OneAndroid && _browserActive) {
    var _sentToAndroid = false;
    try {
      // Prepend a wallet badge to bodyHtml so the dApp-injected modal also shows wallet name
      var _txAddr = window._oneBrowserSelectedAddress || null;
      if (!_txAddr) {
        try { if (OneAndroid.getPersistedBrowserWallet) _txAddr = OneAndroid.getPersistedBrowserWallet() || null; } catch(_) {}
      }
      var _txWalletBadge = '';
      if (_txAddr) {
        var _txWLabel = (typeof _getWalletLabelForAddress === 'function') ? _getWalletLabelForAddress(_txAddr) : null;
        var _txShort  = _txAddr.slice(0,6) + '…' + _txAddr.slice(-4);
        _txWalletBadge = '<div style="display:flex;align-items:center;gap:8px;background:rgba(167,139,250,0.08);border:1px solid rgba(167,139,250,0.2);border-radius:10px;padding:8px 12px;margin-bottom:10px;">' +
          '<div style="width:7px;height:7px;border-radius:50%;background:#10b981;box-shadow:0 0 5px rgba(16,185,129,0.6);flex-shrink:0;"></div>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:11px;font-weight:700;color:#a78bfa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (_txWLabel || 'Connected Wallet') + '</div>' +
            '<div style="font-size:10px;color:#4b5563;font-family:monospace;">' + _txShort + '</div>' +
          '</div>' +
        '</div>';
      }
      OneAndroid.showTxModal(
        String(opts.reqId),
        opts.actionLabel || 'REQUEST',
        opts.siteHost || 'dApp',
        _txWalletBadge + (opts.bodyHtml || ''),
        opts.approveLabel || 'Confirm'
      );
      _sentToAndroid = true;
    } catch(_) {}
    if (_sentToAndroid) return; // modal is in dApp WebView; callbacks handle approve/reject
  }

  // Fallback: show built-in overlay modal (non-browser context)
  var overlay = document.getElementById('one-w3-modal-overlay');
  var body    = document.getElementById('w3m-body');
  var siteName = document.getElementById('w3m-site-name');
  var actionLbl = document.getElementById('w3m-action-label');
  var siteIcon = document.getElementById('w3m-site-icon');
  var approveBtn = document.getElementById('w3m-btn-approve');
  var rejectBtn = document.getElementById('w3m-btn-reject');

  body.innerHTML    = opts.bodyHtml || '';
  siteName.textContent = opts.siteHost || 'dApp';
  actionLbl.textContent = (opts.actionLabel || 'REQUEST').toUpperCase();
  siteIcon.textContent  = _getSiteIcon(opts.siteHost);
  approveBtn.textContent = opts.approveLabel || 'Approve';
  approveBtn.disabled    = false;
  rejectBtn.style.display = opts.hideReject ? 'none' : '';

  // ── Show connected wallet name in modal header ─────────────
  var _walletRow  = document.getElementById('w3m-wallet-row');
  var _walletLbl  = document.getElementById('w3m-wallet-label');
  var _walletAddr = document.getElementById('w3m-wallet-addr');
  var _curAddr = window._oneBrowserSelectedAddress || null;
  if (!_curAddr) {
    try { if (window.OneAndroid && OneAndroid.getPersistedBrowserWallet) _curAddr = OneAndroid.getPersistedBrowserWallet() || null; } catch(_) {}
  }
  if (_curAddr && _walletRow && _walletLbl && _walletAddr) {
    var _wLabel = (typeof _getWalletLabelForAddress === 'function') ? _getWalletLabelForAddress(_curAddr) : null;
    _walletLbl.textContent  = _wLabel || 'Connected Wallet';
    _walletAddr.textContent = _curAddr.slice(0,6) + '…' + _curAddr.slice(-4);
    _walletRow.style.display = '';
  } else if (_walletRow) {
    _walletRow.style.display = 'none';
  }

  overlay.classList.add('active');
  if (typeof haptic === 'function') try { haptic(); } catch(_) {}
}

function _closeModal() {
  _w3mOpen = false;
  _w3mCurrentReq = null;
  var overlay = document.getElementById('one-w3-modal-overlay');
  overlay.classList.remove('active');
  // Process queue
  if (_w3mQueue.length > 0) {
    setTimeout(function() {
      var next = _w3mQueue.shift();
      if (next) next();
    }, 300);
  }
}

window._oneW3ModalReject = function() {
  if (!_w3mCurrentReq) return;
  var req = _w3mCurrentReq;
  // Disable both buttons immediately so user knows action is processing
  var rejectBtn = document.getElementById('w3m-btn-reject');
  var approveBtn = document.getElementById('w3m-btn-approve');
  if (rejectBtn) { rejectBtn.disabled = true; rejectBtn.innerHTML = '<span class="w3m-spinner-red"></span>Rejecting'; }
  if (approveBtn) { approveBtn.disabled = true; }
  _closeModal();
  // onReject already calls _reject() → web3Reject; don't double-reject
  if (req.onReject) req.onReject();
};

window._oneW3ModalApprove = async function() {
  if (!_w3mCurrentReq) return;
  var req = _w3mCurrentReq;
  var btn = document.getElementById('w3m-btn-approve');
  var rejectBtn = document.getElementById('w3m-btn-reject');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="w3m-spinner"></span>Processing'; }
  if (rejectBtn) { rejectBtn.disabled = true; }
  try {
    await req.onApprove();
    _closeModal();
  } catch(err) {
    if (btn) { btn.disabled = false; btn.textContent = req.approveLabel || 'Approve'; }
    if (rejectBtn) { rejectBtn.disabled = false; rejectBtn.textContent = 'Reject'; }
    // Show error in body
    var body = document.getElementById('w3m-body');
    if (body) {
      var errDiv = document.createElement('div');
      errDiv.style.cssText = 'background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:10px 14px;margin-top:10px;font-size:11px;color:#f87171;word-break:break-all;';
      errDiv.textContent = '❌ ' + (err.message || err.toString());
      body.appendChild(errDiv);
    }
    try { OneAndroid.web3Reject(req.reqId, err.message || 'Transaction failed'); } catch(_) {}
    _closeModal();
  }
};

