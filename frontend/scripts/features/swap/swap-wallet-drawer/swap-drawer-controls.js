
// ══════ SWAP WALLET DRAWER ══════
// _swapDrawerMode: 'profile' = from profile card → confirm opens swap modal
//                  'step1'   = from step-1 Select Wallet button → confirm closes drawer
var _swapWalletDrawerExpandedGroupId = null;
var _swapDrawerMode = 'step1';

// Called from Profile card (Nansen & Jumper Swap)
function openSwapWalletDrawer() {
  _swapDrawerMode = 'profile';
  _swapWalletDrawerExpandedGroupId = null;
  _swapDrawerOpen = new Set();
  _renderSwapWalletDrawer();
  var ov = document.getElementById('swap-wallet-drawer-overlay');
  var dr = document.getElementById('swap-wallet-drawer');
  if (dr) { dr.style.transition = 'none'; dr.style.transform = 'translateX(100%)'; }
  if (ov) { ov.style.opacity = '0'; ov.style.pointerEvents = 'none'; ov.classList.add('open'); }
  requestAnimationFrame(function() { requestAnimationFrame(function() {
    if (dr) { dr.style.transition = ''; dr.style.transform = ''; }
    if (ov) { ov.style.opacity = ''; ov.style.pointerEvents = ''; }
  }); });
  haptic && haptic();
}

// Called from step-1 Select Wallet button
function openSwapGroupDrawer() {
  _swapDrawerMode = 'step1';
  _swapWalletDrawerExpandedGroupId = null;
  _swapDrawerOpen = new Set();
  _renderSwapWalletDrawer();
  var ov = document.getElementById('swap-wallet-drawer-overlay');
  var dr = document.getElementById('swap-wallet-drawer');
  if (dr) { dr.style.transition = 'none'; dr.style.transform = 'translateX(100%)'; }
  if (ov) { ov.style.opacity = '0'; ov.style.pointerEvents = 'none'; ov.classList.add('open'); }
  requestAnimationFrame(function() { requestAnimationFrame(function() {
    if (dr) { dr.style.transition = ''; dr.style.transform = ''; }
    if (ov) { ov.style.opacity = ''; ov.style.pointerEvents = ''; }
  }); });
  haptic && haptic();
}

function closeSwapWalletDrawer() {
  var ov = document.getElementById('swap-wallet-drawer-overlay');
  var dr = document.getElementById('swap-wallet-drawer');
  if (dr && dr._swipeClosing) {
    setTimeout(function() {
      if (ov) ov.classList.remove('open');
      _swapWalletDrawerExpandedGroupId = null;
    }, 0);
    haptic && haptic();
    return;
  }
  if (ov) { ov.style.opacity = '0'; ov.style.pointerEvents = 'none'; }
  if (dr) { dr.style.transition = 'transform 0.28s cubic-bezier(0.4,0,0.6,1)'; dr.style.transform = 'translateX(100%)'; }
  setTimeout(function() {
    if (ov) ov.classList.remove('open');
    if (dr) { dr.style.transition = ''; }
    _swapWalletDrawerExpandedGroupId = null;
  }, 300);
  haptic && haptic();
}

function swapWalletDrawerGoBack() {
  _swapWalletDrawerExpandedGroupId = null;
  _renderSwapWalletDrawer();
  haptic && haptic();
}

function confirmSwapWalletDrawer() {
  // If we are in expanded key-list view, save key selection and go back to group list
  if (_swapWalletDrawerExpandedGroupId) {
    if (typeof _saveSwapSelectedKeyMap === 'function') _saveSwapSelectedKeyMap();
    _swapWalletDrawerExpandedGroupId = null;
    _renderSwapWalletDrawer();
    haptic && haptic();
    return;
  }

  closeSwapWalletDrawer();
  if (_swapDrawerMode === 'profile') {
    openSwapModal();
  } else {
    // step1 mode — save key map then apply selection and update UI
    if (typeof _saveSwapSelectedKeyMap === 'function') _saveSwapSelectedKeyMap();
    if (typeof applyMultiGroupSelection === 'function') applyMultiGroupSelection();
    if (typeof renderSwapGroupList === 'function') renderSwapGroupList();
    var doneBtn = document.getElementById('swap-picker-done-btn');
    if (doneBtn) doneBtn.style.display = 'none';
    var summary = document.getElementById('swap-multiselect-summary');
    if (summary) summary.classList.remove('visible');
    var previewSection = document.getElementById('wallet-preview-section');
    if (previewSection) previewSection.style.display = 'none';
    // Show pill if wallets selected, hide picker; otherwise show picker
    var pill   = document.getElementById('swap-active-group-pill');
    var picker = document.getElementById('swap-group-picker');
    if (typeof swapSelectedGroupIds !== 'undefined' && swapSelectedGroupIds.length > 0) {
      if (pill)   pill.style.display   = 'flex';
      if (picker) picker.style.display = 'none';
    } else {
      if (pill)   pill.style.display   = 'none';
      if (picker) picker.style.display = 'block';
    }
  }
  haptic && haptic();
}

function swapDrawerSelectAll() {
  const groups = loadWalletGroups().filter(g => g && g.keys && g.keys.length > 0);
  if (typeof swapSelectedGroupIds !== 'undefined') {
    swapSelectedGroupIds = groups.map(g => g.id);
    // Clear per-key selection so ALL keys in each group are used
    if (typeof swapSelectedKeyMap !== 'undefined') {
      groups.forEach(function(g) { swapSelectedKeyMap[g.id] = new Set(); });
    }
    if (typeof _saveSwapSelectedKeyMap === 'function') _saveSwapSelectedKeyMap();
    if (typeof saveSwapSelectedGroupIds === 'function') saveSwapSelectedGroupIds();
    if (typeof applyMultiGroupSelection === 'function') applyMultiGroupSelection();
    if (typeof renderSwapGroupList === 'function') renderSwapGroupList();
  }
  _renderSwapWalletDrawer();
  haptic && haptic();
}

function swapDrawerClearAll() {
  if (typeof swapSelectedGroupIds !== 'undefined') {
    swapSelectedGroupIds = [];
    // Clear per-key selection as well
    if (typeof swapSelectedKeyMap !== 'undefined') swapSelectedKeyMap = {};
    if (typeof _saveSwapSelectedKeyMap === 'function') _saveSwapSelectedKeyMap();
    if (typeof saveSwapSelectedGroupIds === 'function') saveSwapSelectedGroupIds();
    if (typeof applyMultiGroupSelection === 'function') applyMultiGroupSelection();
    if (typeof renderSwapGroupList === 'function') renderSwapGroupList();
  }
  _renderSwapWalletDrawer();
  haptic && haptic();
}

function _renderSwapWalletDrawer() {
  if (_swapWalletDrawerExpandedGroupId) {
    _renderSwapWalletKeyList(_swapWalletDrawerExpandedGroupId);
  } else {
    _renderSwapWalletGroupList();
  }
}
