// ── Drawing toolbar expand/collapse toggle ──
window._dtToolbarCollapsed = false;

function _dtToggleToolbar() {
  const toolbar = document.getElementById('tcf-draw-toolbar');
  const tab     = document.getElementById('tcf-draw-toggle');
  if (!toolbar) return;
  window._dtToolbarCollapsed = !window._dtToolbarCollapsed;
  if (window._dtToolbarCollapsed) {
    toolbar.classList.add('dt-collapsed');
    if (tab) { tab.classList.remove('dt-tab-hidden'); }
    // Switch to cursor so no orphan drawing tool stays active while hidden
    if (typeof _dtSelectTool === 'function') _dtSelectTool('cursor');
  } else {
    toolbar.classList.remove('dt-collapsed');
    if (tab) { tab.classList.add('dt-tab-hidden'); }
  }
}

// Apply / restore collapsed state when entering fullscreen
function _dtApplyToolbarCollapsed() {
  const toolbar = document.getElementById('tcf-draw-toolbar');
  const tab     = document.getElementById('tcf-draw-toggle');
  if (!toolbar) return;
  if (window._dtToolbarCollapsed) {
    toolbar.classList.add('dt-collapsed');
    if (tab) tab.classList.remove('dt-tab-hidden');
  } else {
    toolbar.classList.remove('dt-collapsed');
    if (tab) tab.classList.add('dt-tab-hidden');
  }
}

// ── Enter/exit fullscreen hooks ──
function _dtOnEnterFullscreen() {
  setTimeout(() => {
    _dtInitEvents();
    const canvas  = document.getElementById('tcf-draw-canvas');
    const chartEl = document.getElementById('tcf-lw-chart');
    if (canvas) {
      canvas.style.display = 'block';
      if (chartEl) {
        canvas.setAttribute('viewBox', '0 0 ' + chartEl.clientWidth + ' ' + (chartEl.clientHeight + 52));
      }
    }
    _dtRender();
    _dtSyncUndoBtn();
    _dtSyncRedoBtn();
    _dtApplyToolbarCollapsed();
  }, 300);
}

function _dtOnExitFullscreen() {
  // Cancel any in-progress drawing — but KEEP committed drawings for next open
  window._dtState.drawing    = null;
  window._dtState.selectedIdx = -1;
  _dtSelectTool('cursor');
  _dtSyncUndoBtn();
  // Hide the SVG canvas (drawings stay in _dtState.drawings)
  const canvas = document.getElementById('tcf-draw-canvas');
  if (canvas) {
    canvas.style.display = 'none';
    canvas.style.pointerEvents = 'none';
    while (canvas.firstChild) canvas.removeChild(canvas.firstChild);
  }
  // Reset toolbar collapse state on fullscreen exit
  const toolbar = document.getElementById('tcf-draw-toolbar');
  const tab     = document.getElementById('tcf-draw-toggle');
  if (toolbar) toolbar.classList.remove('dt-collapsed');
  if (tab)     tab.classList.add('dt-tab-hidden');
  window._dtToolbarCollapsed = false;
}
