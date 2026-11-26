// ── Internal: lock orientation for fullscreen ──
function _tcfLockOrientation(orient) {
  try {
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock(orient).catch(() => {});
    }
  } catch(e) {}
  try {
    if (window.OneAndroid && window.OneAndroid.setOrientation) {
      window.OneAndroid.setOrientation(orient);
    }
  } catch(e) {}
}

// ── Internal: enter fullscreen UI (shared by portrait & landscape entry) ──
function _tcfEnterFsUI(overlay) {
  const icon = document.getElementById('tcf-fs-icon');
  overlay.setAttribute('data-fs', '1');
  if (icon) icon.textContent = 'fullscreen_exit';

  overlay.style.bottom = '0';
  overlay.style.height = '100dvh';

  const hdr   = overlay.querySelector('.tc-hdr');
  const stats = overlay.querySelector('.tc-price-stats-row');
  const coins = overlay.querySelector('#tcf-coin-row');
  const tf    = overlay.querySelector('.tc-tf-bar');
  const scroll= overlay.querySelector('.tc-scroll');
  [hdr, stats, coins, tf, scroll].forEach(el => {
    if (el) { el.style.transition = 'opacity 0.18s'; el.style.opacity = '0'; setTimeout(() => { if(el) el.style.display = 'none'; }, 180); }
  });

  const wrap = document.getElementById('tcf-lw-wrap');
  if (wrap) {
    wrap.style.flex = '1';
    wrap.style.height = '100%';
    wrap.style.borderTop = 'none';
  }
  // Reset drawing tool to cursor so toolbar always shows correct active state
  if (typeof _dtSelectTool === 'function') _dtSelectTool(window._dtState ? window._dtState.activeTool : 'cursor');
  // Instantly collapse volume chart so it never flickers during transition
  const volEl = document.getElementById('tcf-lw-volume');
  if (volEl) { volEl.style.height = '0'; volEl.style.minHeight = '0'; volEl.style.visibility = 'hidden'; }
  if (_lwVolChart) try { _lwVolChart.resize(0, 0); } catch(e) {}

  // Show / create the floating fullscreen HUD
  let hud = document.getElementById('tcf-fs-hud');
  if (!hud) {
    hud = document.createElement('div');
    hud.id = 'tcf-fs-hud';
    hud.style.cssText = [
      'position:absolute','top:0','left:0','right:0','z-index:50',
      'display:flex','flex-direction:column','align-items:stretch',
      'padding:6px 10px 4px 14px',
      'background:linear-gradient(to bottom, rgba(7,7,15,0.95) 75%, transparent)',
      'pointer-events:none',
      'transition:opacity 0.2s',
      'box-sizing:border-box',
      'gap:4px',
    ].join(';');

    hud.innerHTML = `
      <div data-hud-toprow="1" style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <div style="display:flex;flex-direction:column;gap:1px;pointer-events:none;flex-shrink:0;">
          <div id="tcf-fshud-sym" style="font-family:var(--tc-mono,monospace);font-size:9px;letter-spacing:1.5px;color:rgba(255,255,255,0.38);text-transform:uppercase;"></div>
          <div style="display:flex;align-items:baseline;gap:6px;">
            <div id="tcf-fshud-price" style="font-family:var(--tc-mono,monospace);font-size:17px;font-weight:700;color:#f0f0fa;letter-spacing:-0.3px;"></div>
            <div id="tcf-fshud-change" style="font-family:var(--tc-mono,monospace);font-size:10px;font-weight:600;padding:2px 6px;border-radius:5px;background:rgba(16,185,129,0.12);color:#10b981;"></div>
          </div>
        </div>
      </div>
      <div id="tcf-fshud-tf-bar" style="display:flex;gap:2px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:3px;pointer-events:auto;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;-ms-overflow-style:none;width:100%;box-sizing:border-box;"></div>
    `;
    overlay.appendChild(hud);

    const tfBar = hud.querySelector('#tcf-fshud-tf-bar');
    if (tfBar) {
      [['1s','1s'],['15s','15s'],['30s','30s'],['1m','1m'],['5m','5m'],['15m','15m'],['24H','24H'],['7D','7D'],['1M','1M'],['1Y','1Y'],['ALL','ALL']].forEach(([label, val]) => {
        const btn = document.createElement('div');
        const activeTf = window._tcfTf || '5m';
        const isActive = val === activeTf;
        btn.dataset.hudTf = val;
        btn.textContent = label;
        btn.style.cssText = [
          'font-family:var(--tc-mono,monospace)',
          'font-size:9px','font-weight:700','letter-spacing:0.5px',
          'padding:4px 5px','border-radius:5px','cursor:pointer',
          'white-space:nowrap','flex-shrink:0',
          '-webkit-tap-highlight-color:transparent',
          'transition:background 0.15s,color 0.15s',
          isActive ? 'background:rgba(99,102,241,0.25);color:#a5b4fc;' : 'background:transparent;color:rgba(255,255,255,0.35);',
        ].join(';');
        btn.addEventListener('click', () => {
          tfBar.querySelectorAll('[data-hud-tf]').forEach(b => {
            b.style.background = 'transparent';
            b.style.color = 'rgba(255,255,255,0.35)';
          });
          btn.style.background = 'rgba(99,102,241,0.25)';
          btn.style.color = '#a5b4fc';
          tcfSelectTf(val);
        });
        tfBar.appendChild(btn);
      });
      // Add fullscreen exit button inside tf-bar (rightmost)
      const fsBtnInTf = document.createElement('div');
      fsBtnInTf.id = 'tcf-fshud-fs-btn';
      fsBtnInTf.onclick = tcfToggleFullscreen;
      fsBtnInTf.style.cssText = [
        'flex-shrink:0','width:26px','height:26px','border-radius:6px',
        'background:rgba(255,255,255,0.06)','border:1px solid rgba(255,255,255,0.1)',
        'display:flex','align-items:center','justify-content:center',
        'cursor:pointer','margin-left:4px',
        '-webkit-tap-highlight-color:transparent','pointer-events:auto',
      ].join(';');
      fsBtnInTf.innerHTML = '<span class="material-icons-round" style="font-size:14px;color:rgba(255,255,255,0.5);pointer-events:none;">fullscreen_exit</span>';
      tfBar.appendChild(fsBtnInTf);
    }
  }

  const priceEl  = document.getElementById('tcf-price');
  const changeEl = document.getElementById('tcf-change');
  const symEl    = document.querySelector('#token-chart-full-overlay .tc-token-sym');
  const fshudPrice  = document.getElementById('tcf-fshud-price');
  const fshudChange = document.getElementById('tcf-fshud-change');
  const fshudSym    = document.getElementById('tcf-fshud-sym');
  if (fshudPrice  && priceEl)  fshudPrice.textContent  = priceEl.textContent;
  if (fshudSym    && symEl)    fshudSym.textContent    = symEl.textContent;
  if (fshudChange && changeEl) {
    fshudChange.textContent = changeEl.textContent;
    const isUp = changeEl.classList.contains('up');
    const isDn = changeEl.classList.contains('dn');
    fshudChange.style.background = isUp ? 'rgba(16,185,129,0.12)' : isDn ? 'rgba(244,63,94,0.12)' : 'rgba(120,120,160,0.12)';
    fshudChange.style.color = isUp ? '#10b981' : isDn ? '#f43f5e' : '#7878a0';
  }
  hud.style.display = 'flex';
  hud.style.opacity = '0';
  setTimeout(() => { if (hud) hud.style.opacity = '1'; }, 20);

  // Ensure collapse tab starts hidden (toolbar is expanded by default on FS entry)
  const dtab = document.getElementById('tcf-draw-toggle');
  if (dtab) dtab.classList.add('dt-tab-hidden');

  _tcfFsHudAutoHide();
}

// ── Internal: exit fullscreen UI ──
function _tcfExitFsUI(overlay) {
  // Save current drawings into the orientation we're leaving
  const leavingOrient = overlay.getAttribute('data-fs-orient') || 'portrait';
  const st = window._dtState;
  if (leavingOrient === 'landscape') {
    window._dtDrawingsLandscape = st.drawings.map(d => ({...d, points: d.points.map(p => ({...p}))}));
  } else {
    window._dtDrawingsPortrait = st.drawings.map(d => ({...d, points: d.points.map(p => ({...p}))}));
  }
  // Persist to localStorage before exiting
  _dtSaveDrawings();

  const icon = document.getElementById('tcf-fs-icon');
  overlay.setAttribute('data-fs', '0');
  overlay.removeAttribute('data-fs-orient');
  if (icon) icon.textContent = 'fullscreen';

  overlay.style.bottom = 'calc(var(--nav-height, 72px) + env(safe-area-inset-bottom, 0px))';
  overlay.style.height = '';

  // NOTE: must NOT pass 'portrait' here — the Android bridge treats that as
  // "fullscreen portrait-only mode" and keeps the system UI/nav bar hidden.
  // Any string outside {sensor, landscape, portrait, unspecified} routes to
  // the bridge's real exit branch, which restores the nav bar.
  _tcfLockOrientation('exit');

  _dtOnExitFullscreen();

  const hud = document.getElementById('tcf-fs-hud');
  if (hud) { hud.style.opacity = '0'; setTimeout(() => { if (hud) hud.style.display = 'none'; }, 200); }

  if (window._tcfFsHideTimer) { clearTimeout(window._tcfFsHideTimer); window._tcfFsHideTimer = null; }

  const hdr   = overlay.querySelector('.tc-hdr');
  const stats = overlay.querySelector('.tc-price-stats-row');
  const coins = overlay.querySelector('#tcf-coin-row');
  const tf    = overlay.querySelector('.tc-tf-bar');
  const scroll= overlay.querySelector('.tc-scroll');
  [hdr, stats, coins, tf, scroll].forEach(el => {
    if (el) { el.style.display = ''; el.style.opacity = ''; el.style.transition = ''; }
  });

  const wrap = document.getElementById('tcf-lw-wrap');
  if (wrap) { wrap.style.flex = ''; wrap.style.height = ''; wrap.style.borderTop = ''; }
  // Restore volume chart visibility on exit
  const volElExit = document.getElementById('tcf-lw-volume');
  if (volElExit) { volElExit.style.height = ''; volElExit.style.minHeight = ''; volElExit.style.visibility = ''; }
  if (_lwVolChart) try { _lwVolChart.resize(_lwVolChart.options ? (_lwVolChart.options().width || 390) : 390, 52); } catch(e) {}
}

// ── 3-state fullscreen toggle ──
// Normal → Portrait FS → Landscape FS → Portrait FS → …
function tcfToggleFullscreen() {
  const overlay = document.getElementById('token-chart-full-overlay');
  if (!overlay) return;

  const isFs     = overlay.getAttribute('data-fs') === '1';
  const fsOrient = overlay.getAttribute('data-fs-orient') || 'portrait'; // 'portrait' | 'landscape'

  if (!isFs) {
    // ── ENTER FULLSCREEN → Portrait ──
    // Set data-fs BEFORE UI changes so ResizeObserver reads correct state, preventing flicker
    overlay.setAttribute('data-fs', '1');
    _tcfEnterFsUI(overlay);
    overlay.setAttribute('data-fs-orient', 'portrait');
    _tcfLockOrientation('portrait');
    // Load portrait drawings into active state
    window._dtState.drawings = window._dtDrawingsPortrait.map(d => ({...d, points: d.points.map(p => ({...p}))}));
    _dtOnEnterFullscreen();

  } else if (fsOrient === 'portrait') {
    // ── Portrait FS → Landscape FS ──
    _dtSwitchOrientDrawings('landscape');
    overlay.setAttribute('data-fs-orient', 'landscape');
    // Sync HUD layout IMMEDIATELY (before chart hide) so tf-bar DOM move doesn't flicker
    var _hudFs = document.getElementById('tcf-fs-hud');
    if (_hudFs) { _hudFs.style.visibility = 'hidden'; }
    _tcfSyncFsLayout();
    if (_hudFs) { requestAnimationFrame(function(){ if (_hudFs) _hudFs.style.visibility = ''; }); }
    _tcfLockOrientation('landscape');
    _dtSelectTool('cursor');
    setTimeout(() => { _dtRender(); }, 350);

  } else {
    // ── Landscape FS → Portrait FS ──
    _dtSwitchOrientDrawings('portrait');
    overlay.setAttribute('data-fs-orient', 'portrait');
    // Sync HUD layout IMMEDIATELY so tf-bar DOM move doesn't flicker
    var _hudFs2 = document.getElementById('tcf-fs-hud');
    if (_hudFs2) { _hudFs2.style.visibility = 'hidden'; }
    _tcfSyncFsLayout();
    if (_hudFs2) { requestAnimationFrame(function(){ if (_hudFs2) _hudFs2.style.visibility = ''; }); }
    _tcfLockOrientation('portrait');
    _dtSelectTool('cursor');
    setTimeout(() => { _dtRender(); }, 350);
  }

  // Capture target orientation AFTER attribute is set above
  const _tcfWantLandscape = (overlay.getAttribute('data-fs-orient') || 'portrait') === 'landscape';

  // Resize charts after DOM/orientation settles
  const chartElR = document.getElementById('tcf-lw-chart');
  window._tcfFsTransitioning = true;
  if (chartElR) chartElR.style.visibility = 'hidden';

  const _tcfDoResize = () => {
    const overlay2 = document.getElementById('token-chart-full-overlay');
    const nowFs = overlay2 && overlay2.getAttribute('data-fs') === '1';
    const w = chartElR ? (chartElR.clientWidth  || window.innerWidth)  : window.innerWidth;
    const h = chartElR ? (chartElR.clientHeight || (window.innerHeight - 40)) : (window.innerHeight - 40);
    const mainH = nowFs ? Math.max(h, window.innerHeight - 40) : 240;
    const volH  = nowFs ? 0 : 52;
    if (w > 0 && _lwChart) {
      _lwChart.resize(w, mainH);
      const r = window._lwTargetRange;
      if (r) { try { _lwChart.timeScale().setVisibleLogicalRange(r); } catch(e) {} }
    }
    if (w > 0 && _lwVolChart) _lwVolChart.resize(w, volH);
    if (chartElR) chartElR.style.visibility = 'visible';
    window._tcfFsTransitioning = false;
    // Restore this mode's saved price-scale zoom after resize
    if (window._lwRestorePsMarginsForMode) window._lwRestorePsMarginsForMode();
  };

  // Poll until viewport matches target orientation (max 40 attempts × 40ms = 1.6s)
  let _tcfRotWait = 0;
  const _tcfWaitRotate = () => {
    const isLandNow = window.innerWidth > window.innerHeight;
    if (isLandNow === _tcfWantLandscape || _tcfRotWait > 40) {
      setTimeout(_tcfDoResize, 60);
    } else {
      _tcfRotWait++;
      setTimeout(_tcfWaitRotate, 40);
    }
  };
  setTimeout(_tcfWaitRotate, 120);
}

// ── Exit fullscreen completely (used by back-button in portrait FS) ──
function tcfExitFullscreen() {
  const overlay = document.getElementById('token-chart-full-overlay');
  if (!overlay || overlay.getAttribute('data-fs') !== '1') return;
  _tcfExitFsUI(overlay);

  const chartElR = document.getElementById('tcf-lw-chart');
  window._tcfFsTransitioning = true;
  if (chartElR) chartElR.style.visibility = 'hidden';
  setTimeout(() => {
    const w = chartElR ? (chartElR.clientWidth  || window.innerWidth)  : window.innerWidth;
    if (w > 0 && _lwChart) {
      _lwChart.resize(w, 240);
      const r = window._lwTargetRange;
      if (r) { try { _lwChart.timeScale().setVisibleLogicalRange(r); } catch(e) {} }
    }
    if (w > 0 && _lwVolChart) _lwVolChart.resize(w, 52);
    if (chartElR) chartElR.style.visibility = 'visible';
    window._tcfFsTransitioning = false;
    // Restore normal-mode price-scale zoom
    if (window._lwRestorePsMarginsForMode) window._lwRestorePsMarginsForMode();
  }, 300);
}
