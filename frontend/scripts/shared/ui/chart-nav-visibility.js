
// ── Nav hide/show: only when chart overlay is open AND phone is landscape ──
(function() {
  function handleOrientationChange() {
    var nav = document.querySelector('.bottom-nav');
    if (!nav) return;
    var chartOpen = !!document.getElementById('token-chart-full-overlay');
    var isLandscape = window.innerWidth > window.innerHeight;
    var overlay = document.getElementById('token-chart-full-overlay');
    if (chartOpen && isLandscape) {
      nav.style.display = 'none';
      if (overlay) { overlay.style.bottom = '0'; overlay.style.height = '100dvh'; }
    } else {
      nav.style.display = '';
      nav.style.opacity = '1';
      if (overlay && overlay.getAttribute('data-fs') !== '1') {
        overlay.style.bottom = 'calc(var(--nav-height, 72px) + env(safe-area-inset-bottom, 0px))';
        overlay.style.height = '';
      }
    }
  }

  window.addEventListener('resize', handleOrientationChange);
  if (screen.orientation) {
    screen.orientation.addEventListener('change', handleOrientationChange);
  }
  window.addEventListener('orientationchange', handleOrientationChange);
})();
