'use strict';
// ── Browser TX modal callbacks ────────────────────────────
// Called by MainActivity when user taps Confirm in the injected dApp modal
window._oneModalApproveFromBrowser = async function(reqId) {
  // Find the stored request by reqId and approve it
  // Use == (loose) to handle int/string type edge cases from Java bridge
  // eslint-disable-next-line eqeqeq
  if (!_w3mCurrentReq || _w3mCurrentReq.reqId != reqId) return;
  var req = _w3mCurrentReq;
  var _isSignOnly = (req.method === 'personal_sign' || req.method === 'eth_sign' ||
    req.method === 'eth_signTypedData' || req.method === 'eth_signTypedData_v3' ||
    req.method === 'eth_signTypedData_v4' || req.method === 'eth_signTransaction');

  // ── FIX: For sign-only methods, dismiss modal BEFORE calling onApprove().
  // Problem: doTypedSign calls _resolve(sig) which immediately triggers dApp's
  // follow-up eth_sendTransaction. That new request arrives in oneHandleWeb3Request,
  // opens a new modal (showTxModal), but then the DELAYED dismissTxModal(reqId) call
  // from after onApprove() removes it because data-reqid matches the NEW modal's reqId
  // if timing is tight, OR the dApp fires before _w3mOpen resets to false.
  // Fix: mark modal closed FIRST, then sign, then dismiss (which by then has no modal to clear).
  _w3mOpen = false;
  _w3mCurrentReq = null;
  if (_isSignOnly) {
    // Dismiss Permit2/sign modal now — BEFORE _resolve() fires so the dApp's follow-up
    // eth_sendTransaction request arrives after _w3mOpen=false and opens a fresh modal.
    try { if (window.OneAndroid) OneAndroid.dismissTxModal(req.reqId); } catch(_) {}
  }
  try {
    await req.onApprove();
    // For eth_sendTransaction: dismissTxModal() is called INSIDE doSendTx after broadcast.
    // Process queue immediately (no 300ms delay) so follow-up TX modal shows without lag.
    if (_w3mQueue.length > 0) {
      var next = _w3mQueue.shift();
      if (next) next();
    }
  } catch(err) {
    // On error: always dismiss so the modal doesn't stay stuck (both sign and tx paths)
    try { if (window.OneAndroid) OneAndroid.dismissTxModal(req.reqId); } catch(_) {}
    try { OneAndroid.web3Reject(req.reqId, err.message || 'Transaction failed'); } catch(_) {}
    // Show error notification so user can see what failed
    try { if (window.OneAndroid && OneAndroid.showNotification) OneAndroid.showNotification('Sign Failed ❌', (err.message || 'Unknown error').slice(0, 80)); } catch(_) {}

    if (_w3mQueue.length > 0) {
      var next = _w3mQueue.shift();
      if (next) next();
    }
  }
};

// Called by MainActivity when user taps Reject in the injected dApp modal
window._oneModalRejectFromBrowser = function(reqId) {
  // Use == (loose) to handle int/string type edge cases from Java bridge
  // eslint-disable-next-line eqeqeq
  if (!_w3mCurrentReq || _w3mCurrentReq.reqId != reqId) return;
  var req = _w3mCurrentReq;
  _w3mOpen = false;
  _w3mCurrentReq = null;
  // onReject already calls _reject() → web3Reject; don't double-reject
  if (req.onReject) req.onReject();
  if (_w3mQueue.length > 0) {
    setTimeout(function() { var next = _w3mQueue.shift(); if (next) next(); }, 300);
  }
};

// Fallback: called by Java when InAppBrowserActivity is not open
// Shows the built-in overlay modal instead of dApp-injected modal
window._oneFallbackOpenModal = function(reqId) {
  if (!_w3mCurrentReq || _w3mCurrentReq.reqId !== reqId) return;
  var opts = _w3mCurrentReq;
  var overlay = document.getElementById('one-w3-modal-overlay');
  var body    = document.getElementById('w3m-body');
  var siteName = document.getElementById('w3m-site-name');
  var actionLbl = document.getElementById('w3m-action-label');
  var siteIcon = document.getElementById('w3m-site-icon');
  var approveBtn = document.getElementById('w3m-btn-approve');
  var rejectBtn = document.getElementById('w3m-btn-reject');
  if (!overlay || !body) return;
  body.innerHTML    = opts.bodyHtml || '';
  siteName.textContent = opts.siteHost || 'dApp';
  actionLbl.textContent = (opts.actionLabel || 'REQUEST').toUpperCase();
  siteIcon.textContent  = _getSiteIcon(opts.siteHost);
  approveBtn.textContent = opts.approveLabel || 'Approve';
  approveBtn.disabled    = false;
  rejectBtn.style.display = opts.hideReject ? 'none' : '';
  // ── Show connected wallet name in modal header (fallback path) ──
  var _fbWalletRow  = document.getElementById('w3m-wallet-row');
  var _fbWalletLbl  = document.getElementById('w3m-wallet-label');
  var _fbWalletAddr = document.getElementById('w3m-wallet-addr');
  var _fbAddr = window._oneBrowserSelectedAddress || null;
  if (!_fbAddr) {
    try { if (window.OneAndroid && OneAndroid.getPersistedBrowserWallet) _fbAddr = OneAndroid.getPersistedBrowserWallet() || null; } catch(_) {}
  }
  if (_fbAddr && _fbWalletRow && _fbWalletLbl && _fbWalletAddr) {
    var _fbLabel = (typeof _getWalletLabelForAddress === 'function') ? _getWalletLabelForAddress(_fbAddr) : null;
    _fbWalletLbl.textContent  = _fbLabel || 'Connected Wallet';
    _fbWalletAddr.textContent = _fbAddr.slice(0,6) + '…' + _fbAddr.slice(-4);
    _fbWalletRow.style.display = '';
  } else if (_fbWalletRow) {
    _fbWalletRow.style.display = 'none';
  }
  overlay.classList.add('active');
  if (typeof haptic === 'function') try { haptic(); } catch(_) {}
};

// ── Browser wallet selection tracking ─────────────────────
// Called by MainActivity bridge when user picks a wallet in the in-app browser
// Sets _oneBrowserSelectedAddress so signing uses the right key
window.oneSetBrowserSelectedWallet = function(address, chainId) {
  var prevAddress = window._oneBrowserSelectedAddress;
  window._oneBrowserSelectedAddress = address || null;
  // Sync chainId if provided; otherwise pull from Java bridge (single source of truth)
  if (chainId) {
    window._oneBrowserChainId = chainId;
  } else {
    try {
      if (typeof OneAndroid !== 'undefined' && OneAndroid.getSelectedBrowserChainId) {
        var jc = OneAndroid.getSelectedBrowserChainId();
        if (jc && jc.length > 0) window._oneBrowserChainId = jc;
      }
    } catch(_) {}
  }
  // ── Wallet switch guard: if a modal is open with the OLD wallet's pending request,
  // dismiss + reject it so the dApp can re-fire with the new wallet address.
  // Without this, _w3mOpen stays true and the queue never processes the new request,
  // causing the TX modal to never appear after wallet change.
  if (address && prevAddress && address.toLowerCase() !== prevAddress.toLowerCase() && _w3mOpen && _w3mCurrentReq) {
    var _staleReq = _w3mCurrentReq;
    _w3mOpen = false;
    _w3mCurrentReq = null;
    try {
      if (window.OneAndroid) OneAndroid.dismissTxModal(_staleReq.reqId);
    } catch(_) {}
    try {
      _staleReq.onReject && _staleReq.onReject('Wallet changed — please try again');
    } catch(_) {}
    // Drain queue too — queued requests also used the old wallet address
    _w3mQueue.length = 0;
  }
};