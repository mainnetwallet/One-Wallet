// ══════════════════════════════════════════════════════
// NFT TRANSFER — UI-ONLY HELPERS
// Presentation glue for the compact NFT Transfer layout
// (html-src/partials/page-transfer-hub/nft-transfer.html).
// It never writes to wallet, signing or transfer state: it only
//   * opens/closes the logs box (nothing above it is hidden; it scrolls into view when opened),
//   * mirrors the 1 -> Many / Many -> 1 choice onto the segmented switch
//     (thumb position + active button; selectNftTransferMode still does the real mode change).
// ══════════════════════════════════════════════════════
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  // Logs header: collapse / expand the log box (collapsed by default)
  window.nftToggleLogs = function (open) {
    var box = $('nftLogs'), ui = $('nftTransferUI');
    if (!box) return;
    var willOpen = typeof open === 'boolean' ? open : box.classList.contains('collapsed');
    box.classList.toggle('collapsed', !willOpen);
    if (ui) ui.classList.toggle('nft-logs-open', willOpen);
    // Nothing above folds away, so if the opened log box ends up below the visible area, bring it into view
    if (willOpen) setTimeout(function () {
      try { box.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { box.scrollIntoView(false); }
    }, 60);
  };

  // Keep the segmented switch in step with the visible section
  function sync() {
    var ui = $('nftTransferUI');
    if (!ui || ui.getClientRects().length === 0) return; // not on screen
    var dist = $('nftDistributeSection');
    var mode = dist && dist.style.display === 'none' ? 'collect' : 'distribute';
    var seg = ui.querySelector('.bt-seg');
    var a = $('nftDistributeModeCard'), b = $('nftCollectModeCard');
    // the shared switch thumb sits on the second option when data-mode is "token"
    var thumb = mode === 'collect' ? 'token' : 'native';
    if (seg && seg.getAttribute('data-mode') !== thumb) seg.setAttribute('data-mode', thumb);
    if (ui.getAttribute('data-nft-mode') !== mode) ui.setAttribute('data-nft-mode', mode);
    if (a) a.classList.toggle('active', mode === 'distribute');
    if (b) b.classList.toggle('active', mode === 'collect');
  }

  setInterval(sync, 600);
  document.addEventListener('click', function (e) {
    // Starting a transfer opens the logs so progress is visible without scrolling
    var t = e.target && e.target.closest ? e.target.closest('#executeNftDistributeBtn, #executeNftCollectBtn') : null;
    if (t && !t.disabled && typeof window.nftToggleLogs === 'function') window.nftToggleLogs(true);
    setTimeout(sync, 0);
  }, true);
})();
