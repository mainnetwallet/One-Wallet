function openConnectedWalletsDrawer() {
  const groups = loadWalletGroups();
  if (groups.length === 0) { showToast('No wallet groups imported', 'folder'); return; }
  _cwExpandedGroupId = null;

  // Pre-populate selected keys for all already-selected groups
  groups.forEach(function(g) {
    if (selectedGroupIds.includes(g.id)) {
      const sel = _cwGetSelectedKeys(g.id);
      if (sel.size === 0) {
        g.keys.forEach(function(k, i) { sel.add(i); });
      }
    }
  });

  _renderCwDrawer();
  var _cwOv = document.getElementById('cw-drawer-overlay');
  var _cwDr = document.getElementById('cw-drawer');
  if (_cwDr) { _cwDr.style.transition = 'none'; _cwDr.style.transform = 'translateX(100%)'; }
  if (_cwOv) { _cwOv.style.opacity = '0'; _cwOv.style.pointerEvents = 'none'; _cwOv.classList.add('open'); }
  requestAnimationFrame(function() { requestAnimationFrame(function() {
    if (_cwDr) { _cwDr.style.transition = ''; _cwDr.style.transform = ''; }
    if (_cwOv) { _cwOv.style.opacity = ''; _cwOv.style.pointerEvents = ''; }
  }); });
  haptic();
}

function closeConnectedWalletsDrawer() {
  var ov = document.getElementById('cw-drawer-overlay');
  var dr = document.getElementById('cw-drawer');
  if (dr && dr._swipeClosing) {
    // Swipe gesture already animated the close — just do state cleanup
    setTimeout(function() {
      if (ov) ov.classList.remove('open');
      _cwExpandedGroupId = null;
    }, 0);
    haptic();
    return;
  }
  if (ov) { ov.style.opacity = '0'; ov.style.pointerEvents = 'none'; }
  if (dr) { dr.style.transition = 'transform 0.28s cubic-bezier(0.4,0,0.6,1)'; dr.style.transform = 'translateX(100%)'; }
  setTimeout(function() {
    if (ov) ov.classList.remove('open');
    if (dr) { dr.style.transition = ''; }
    _cwExpandedGroupId = null;
  }, 300);
  haptic();
}

function handleCwDrawerOverlayClick(e) {
  if (e.target === document.getElementById('cw-drawer-overlay')) closeConnectedWalletsDrawer();
}

function cwDrawerGoBack() {
  _cwExpandedGroupId = null;
  _renderCwDrawer();
  haptic();
}

function _renderCwDrawer() {
  if (_cwExpandedGroupId) {
    _renderCwKeyList(_cwExpandedGroupId);
  } else {
    _renderCwGroupList();
  }
}
