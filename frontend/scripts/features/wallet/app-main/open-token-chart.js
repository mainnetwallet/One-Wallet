
function openTokenChart(t) {
  const existing = document.getElementById('token-chart-full-overlay');
  if (existing) {
    // Destroy chart instances BEFORE removing DOM to prevent ghost/flicker from stale ResizeObserver
    try { if (_lwChart)    { _lwChart.remove();    _lwChart    = null; } } catch(e) {}
    try { if (_lwVolChart) { _lwVolChart.remove();  _lwVolChart = null; } } catch(e) {}
    _lwCandleSeries = null; _lwVolSeries = null;
    _lwMa7 = null; _lwMa25 = null; _lwMa99 = null;
    existing.remove();
  }

  const overlay = document.createElement('div');
  overlay.id = 'token-chart-full-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:calc(var(--nav-height, 72px) + env(safe-area-inset-bottom, 0px));z-index:1100;background:var(--bg-deep);display:flex;flex-direction:column;opacity:0;transition:opacity 0.22s ease;overflow:hidden;max-width:100%;margin:0 auto;';

  // Contract address helpers
  const _tcfContractRaw  = t.contract || t.address || t.contractAddress || '';
  const _tcfContractShort = _tcfContractRaw.length > 12
    ? _tcfContractRaw.slice(0, 6) + '...' + _tcfContractRaw.slice(-4) : _tcfContractRaw;

  overlay.innerHTML = `
<style>
/* ═══════════════════════════════════════════════
   TOKEN CHART SCREEN — REDESIGNED
   Clean · Modern · Professional
═══════════════════════════════════════════════ */
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

#tcf2 {
  --tc-font: 'DM Sans', sans-serif;
  --tc-mono: 'IBM Plex Mono', monospace;
  --tc-bg: #07070f;
  --tc-surface: #0d0d1a;
  --tc-raised: #131325;
  --tc-border: rgba(255,255,255,0.07);
  --tc-border-strong: rgba(255,255,255,0.12);
  --tc-text: #f0f0fa;
  --tc-sub: #7878a0;
  --tc-muted: #3a3a58;
  --tc-accent: #6366f1;
  --tc-accent-soft: rgba(99,102,241,0.12);
  --tc-accent-border: rgba(99,102,241,0.35);
  --tc-green: #22c55e;
  --tc-green-soft: rgba(34,197,94,0.1);
  --tc-green-border: rgba(34,197,94,0.25);
  --tc-red: #ef4444;
  --tc-red-soft: rgba(239,68,68,0.1);
  --tc-red-border: rgba(239,68,68,0.25);
  --tc-amber: #f59e0b;
  font-family: var(--tc-font);
}
#tcf2 * { box-sizing: border-box; }

/* ── HEADER ── */
#tcf2 .tc-hdr {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 14px 12px;
  background: var(--tc-bg);
  border-bottom: 1px solid var(--tc-border);
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
}
#tcf2 .tc-back {
  width: 34px; height: 34px;
  border-radius: 10px;
  background: var(--tc-raised);
  border: 1px solid var(--tc-border);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; flex-shrink: 0;
  transition: background 0.15s, transform 0.12s;
  -webkit-tap-highlight-color: transparent;
}
#tcf2 .tc-back:active { transform: scale(0.87); background: rgba(255,255,255,0.08); }
#tcf2 .tc-logo {
  width: 38px; height: 38px;
  border-radius: 11px;
  overflow: hidden; flex-shrink: 0;
  border: 1px solid var(--tc-border);
}
#tcf2 .tc-token-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--tc-text);
  line-height: 1.2;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 100px;
  letter-spacing: -0.2px;
}
#tcf2 .tc-token-sym {
  font-family: var(--tc-mono);
  font-size: 10px;
  color: var(--tc-sub);
  margin-top: 2px;
  letter-spacing: 0.3px;
}
#tcf2 .tc-sparkline-wrap {
  margin-left: auto;
  flex-shrink: 0;
}

/* ── PRICE + STATS ROW ── */
#tcf2 .tc-price-stats-row {
  display: flex;
  align-items: flex-start;
  gap: 0;
  padding: 16px 16px 12px;
  flex-shrink: 0;
  background: var(--tc-bg);
}
/* Left: price block */
#tcf2 .tc-price-block {
  flex: 1;
  min-width: 0;
}
#tcf2 .tc-price-label {
  font-family: var(--tc-mono);
  font-size: 9px;
  letter-spacing: 2px;
  color: var(--tc-sub);
  text-transform: uppercase;
  margin-bottom: 5px;
}
#tcf2 .tc-price-main {
  font-family: var(--tc-mono);
  font-size: 30px;
  font-weight: 600;
  color: var(--tc-text);
  letter-spacing: -1px;
  line-height: 1;
  transition: color 0.3s ease;
}
#tcf2 .tc-price-row2 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
}
#tcf2 .tc-change-pill {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 4px 10px;
  border-radius: 6px;
  font-family: var(--tc-mono);
  font-size: 11px;
  font-weight: 600;
  transition: all 0.25s;
}
#tcf2 .tc-change-pill.up {
  background: var(--tc-green-soft);
  color: var(--tc-green);
  border: 1px solid var(--tc-green-border);
}
#tcf2 .tc-change-pill.dn {
  background: var(--tc-red-soft);
  color: var(--tc-red);
  border: 1px solid var(--tc-red-border);
}
#tcf2 .tc-change-pill.na {
  background: rgba(255,255,255,0.04);
  color: var(--tc-sub);
  border: 1px solid var(--tc-border);
}
#tcf2 .tc-contract-chip {
  display: inline-flex; align-items: center; gap: 4px;
  background: var(--tc-raised); border: 1px solid var(--tc-border);
  border-radius: 6px; padding: 4px 8px;
  cursor: pointer; transition: background 0.13s;
  -webkit-tap-highlight-color: transparent;
}
#tcf2 .tc-contract-chip:active { background: rgba(255,255,255,0.07); }
#tcf2 .tc-contract-addr {
  font-family: var(--tc-mono); font-size: 9px;
  color: var(--tc-sub); letter-spacing: 0.3px;
}
#tcf2 .tc-contract-icon { font-size: 11px !important; color: var(--tc-sub); line-height: 1; }

/* Right: key stats grid */
#tcf2 .tc-stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  background: var(--tc-border);
  border: 1px solid var(--tc-border);
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
  width: 158px;
  margin-left: 12px;
  align-self: flex-start;
}
#tcf2 .tc-sg-cell {
  background: var(--tc-raised);
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
#tcf2 .tc-sg-label {
  font-family: var(--tc-mono);
  font-size: 8px;
  letter-spacing: 1.2px;
  color: var(--tc-sub);
  text-transform: uppercase;
  white-space: nowrap;
}
#tcf2 .tc-sg-val {
  font-family: var(--tc-mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--tc-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
#tcf2 .tc-sg-val.green { color: var(--tc-green); }
#tcf2 .tc-sg-val.red   { color: var(--tc-red);   }

/* ── COIN QUICK-SELECT ── */
#tcf2 .tc-coin-row {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 0 16px 10px;
  overflow-x: auto;
  scrollbar-width: none;
  flex-shrink: 0;
  background: var(--tc-bg);
}
#tcf2 .tc-coin-row::-webkit-scrollbar { display: none; }

/* ── TIMEFRAME BAR ── */
#tcf2 .tc-tf-bar {
  display: flex;
  align-items: center;
  padding: 0 16px 10px;
  gap: 3px;
  flex-shrink: 0;
  background: var(--tc-bg);
}
#tcf2 .tc-tf-btn {
  flex: 1;
  text-align: center;
  padding: 6px 2px;
  border-radius: 7px;
  font-family: var(--tc-mono);
  font-size: 9px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  -webkit-tap-highlight-color: transparent;
  color: var(--tc-sub);
  background: transparent;
  border: 1px solid transparent;
  letter-spacing: 0.3px;
}
#tcf2 .tc-tf-btn.active {
  background: var(--tc-accent-soft);
  border-color: var(--tc-accent-border);
  color: #a5b4fc;
}
#tcf2 .tc-tf-btn:active { transform: scale(0.91); }

/* ── CHART WRAP ── */
#tcf2 .tc-chart-wrap {
  position: relative;
  flex: 0 0 auto;
  background: #06060d;
  border-top: 1px solid var(--tc-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
/* ── NORMAL mode: chart fixed height, scroll area below ── */
#tcf-lw-wrap {
  flex: 0 0 auto !important;
}
#tcf-lw-chart {
  height: 240px !important;
  min-height: 0 !important;
}
#tcf2 .tc-scroll {
  flex: 1 !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  overscroll-behavior: contain !important;
}

/* ── FULLSCREEN (both orientations): shared base ── */
[data-fs="1"] #tcf-lw-wrap {
  flex: 1 !important;
  height: 100% !important;
  border-top: none !important;
  overflow: hidden !important;
}
[data-fs="1"] #tcf-lw-volume {
  height: 0 !important;
  min-height: 0 !important;
  max-height: 0 !important;
  overflow: hidden !important;
  flex-shrink: 0 !important;
  visibility: hidden !important;
  transition: none !important;
}
[data-fs="1"] #tcf-fs-btn {
  display: none !important;
}
/* hide scroll section in fullscreen */
[data-fs="1"] .tc-scroll {
  display: none !important;
}

/* ── PORTRAIT fullscreen ── */
[data-fs="1"][data-fs-orient="portrait"] #tcf2 {
  height: 100vh !important;
  height: 100dvh !important;
}
[data-fs="1"][data-fs-orient="portrait"] .tc-hdr {
  padding-right: max(14px, env(safe-area-inset-right, 14px)) !important;
}
[data-fs="1"][data-fs-orient="portrait"] #tcf-lw-chart {
  flex: 1 !important;
  width: 100% !important;
  height: 100% !important;
  min-height: 0 !important;
}
/* portrait fullscreen: tf-bar right-align, no empty space */
[data-fs="1"][data-fs-orient="portrait"] .tc-tf-bar {
  justify-content: flex-end !important;
  gap: 2px !important;
  padding: 0 8px 8px !important;
}
[data-fs="1"][data-fs-orient="portrait"] .tc-tf-btn {
  flex: 0 0 auto !important;
  padding: 5px 8px !important;
  font-size: 9px !important;
}
[data-fs="1"][data-fs-orient="portrait"] #tcf-data-source-label {
  display: none !important;
}

/* ── LANDSCAPE fullscreen ── */
[data-fs="1"][data-fs-orient="landscape"] #tcf2 {
  height: 100vh !important;
  height: 100dvh !important;
}
[data-fs="1"][data-fs-orient="landscape"] #tcf-lw-chart {
  flex: 1 !important;
  width: 100vw !important;
  width: 100dvw !important;
  height: 100% !important;
  min-height: 0 !important;
}
/* landscape: tf-bar compact — buttons fixed width, right-aligned, no empty space */
[data-fs="1"][data-fs-orient="landscape"] .tc-tf-bar {
  padding: 0 8px 8px !important;
  gap: 2px !important;
  justify-content: flex-end !important;
}
[data-fs="1"][data-fs-orient="landscape"] .tc-tf-btn {
  flex: 0 0 auto !important;
  padding: 5px 9px !important;
  font-size: 9px !important;
}
/* landscape: show landscape fs exit button inside tf-bar */
[data-fs="1"][data-fs-orient="landscape"] #tcf-fs-btn-landscape {
  display: flex !important;
  margin-left: 6px !important;
}
/* landscape: hide the header fs btn */
[data-fs="1"][data-fs-orient="landscape"] #tcf-fs-btn {
  display: none !important;
}
/* landscape: hide data-source label gap */
[data-fs="1"][data-fs-orient="landscape"] #tcf-data-source-label {
  display: none !important;
}
#tcf2 .tc-ohlc-bar {
  display: none;
  position: absolute;
  top: 7px; left: 0; right: 0;
  padding: 0 12px;
  pointer-events: none;
  z-index: 20;
}
#tcf2 .tc-ohlc-inner {
  display: flex;
  gap: 10px;
  font-family: var(--tc-mono);
  font-size: 9px;
  font-weight: 500;
  align-items: center;
}

/* ── SCROLL AREA ── */
#tcf2 .tc-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  scrollbar-width: none;
  padding-bottom: calc(var(--nav-height, 72px) + env(safe-area-inset-bottom, 0px) + 16px);
  background: var(--tc-bg);
  /* Isolate scroll: prevent propagating to parent */
  touch-action: pan-y;
}
#tcf2 .tc-scroll::-webkit-scrollbar { display: none; }

/* ── SECTION DIVIDER ── */
#tcf2 .tc-section-divider {
  height: 1px;
  background: var(--tc-border);
  margin: 0 16px;
}

/* ── SUPPLY + ATH BLOCK (below chart) ── */
#tcf2 .tc-supply-block {
  display: flex;
  gap: 1px;
  background: var(--tc-border);
  border: 1px solid var(--tc-border);
  border-radius: 12px;
  overflow: hidden;
  margin: 14px 16px 4px;
}
#tcf2 .tc-supply-cell {
  flex: 1;
  background: var(--tc-raised);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
#tcf2 .tc-supply-label {
  font-family: var(--tc-mono);
  font-size: 8.5px;
  letter-spacing: 1.5px;
  color: var(--tc-sub);
  text-transform: uppercase;
}
#tcf2 .tc-supply-val {
  font-family: var(--tc-mono);
  font-size: 13px;
  font-weight: 600;
  color: var(--tc-text);
}
#tcf2 .tc-supply-sub {
  font-family: var(--tc-mono);
  font-size: 9px;
  color: var(--tc-muted);
  margin-top: 1px;
}

/* ATH badge */
#tcf2 .tc-ath-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(99,102,241,0.08);
  border: 1px solid rgba(99,102,241,0.2);
  border-radius: 6px;
  padding: 3px 8px;
  margin: 4px 16px 0;
  width: fit-content;
}
#tcf2 .tc-ath-badge-label {
  font-family: var(--tc-mono);
  font-size: 8px;
  letter-spacing: 1.5px;
  color: var(--tc-accent);
  text-transform: uppercase;
}
#tcf2 .tc-ath-badge-val {
  font-family: var(--tc-mono);
  font-size: 11px;
  font-weight: 600;
  color: #a5b4fc;
}

/* ── ABOUT SECTION ── */
#tcf2 .tc-about {
  display: none;
  margin: 14px 16px 0;
  background: var(--tc-raised);
  border: 1px solid var(--tc-border);
  border-radius: 12px;
  padding: 14px;
  overflow: hidden;
}
#tcf2 .tc-about-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
#tcf2 .tc-about-label {
  font-family: var(--tc-mono);
  font-size: 8.5px;
  letter-spacing: 2px;
  color: var(--tc-sub);
  text-transform: uppercase;
}
#tcf2 .tc-about-txt {
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--tc-sub);
  font-weight: 400;
  overflow: hidden;
  transition: max-height 0.4s ease;
}
#tcf2 .tc-about-txt.collapsed { max-height: 0; overflow: hidden; }
#tcf2 .tc-about-txt.expanded  { max-height: 999px; }
#tcf2 .tc-readmore {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  font-family: var(--tc-mono);
  font-size: 10px;
  font-weight: 600;
  color: var(--tc-accent);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  letter-spacing: 0.3px;
  transition: opacity 0.13s;
}
#tcf2 .tc-readmore:active { opacity: 0.7; }

/* ── ACTION BUTTONS ── */
#tcf2 .tc-actions {
  display: flex;
  gap: 10px;
  padding: 16px 16px 16px;
}
#tcf2 .tc-btn-swap {
  flex: 1;
  display: flex; align-items: center; justify-content: center;
  gap: 8px;
  padding: 15px;
  background: linear-gradient(135deg, #5254e8, #8b5cf6);
  border-radius: 13px;
  cursor: pointer;
  transition: transform 0.13s, filter 0.13s;
  -webkit-tap-highlight-color: transparent;
  box-shadow: 0 4px 20px rgba(99,102,241,0.25);
}
#tcf2 .tc-btn-swap:active { transform: scale(0.97); filter: brightness(0.88); }
#tcf2 .tc-btn-bridge {
  flex: 1;
  display: flex; align-items: center; justify-content: center;
  gap: 8px;
  padding: 15px;
  background: rgba(34,211,238,0.08);
  border: 1px solid rgba(34,211,238,0.25);
  border-radius: 13px;
  cursor: pointer;
  transition: transform 0.13s, filter 0.13s;
  -webkit-tap-highlight-color: transparent;
}
#tcf2 .tc-btn-bridge:active { transform: scale(0.97); filter: brightness(0.88); }
#tcf2 .tc-btn-send {
  flex: 1;
  display: flex; align-items: center; justify-content: center;
  gap: 8px;
  padding: 15px;
  background: rgba(245,158,11,0.08);
  border: 1px solid rgba(245,158,11,0.25);
  border-radius: 13px;
  cursor: pointer;
  transition: transform 0.13s;
  -webkit-tap-highlight-color: transparent;
}
#tcf2 .tc-btn-send:active { transform: scale(0.97); }
#tcf2 .tc-btn-label {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1.5px;
  text-transform: uppercase;
}

/* ── BOTTOM TAB BAR (Action / About) ── */
#tcf2 .tc-tab-bar {
  display: flex;
  gap: 0;
  margin: 14px 16px 0;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
}
#tcf2 .tc-tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 11px 8px;
  font-family: var(--tc-mono);
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: var(--tc-muted);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.18s, color 0.18s;
  position: relative;
}
#tcf2 .tc-tab-btn .material-icons-round {
  font-size: 14px !important;
  transition: color 0.18s;
}
#tcf2 .tc-tab-btn:active { opacity: 0.7; }
#tcf2 .tc-tab-btn.active {
  background: rgba(99,102,241,0.13);
  color: var(--tc-accent);
}
#tcf2 .tc-tab-btn.active .material-icons-round { color: var(--tc-accent); }
#tcf2 .tc-tab-btn + .tc-tab-btn {
  border-left: 1px solid rgba(255,255,255,0.07);
}

/* ── TAB PANELS ── */
#tcf2 .tc-tab-panel { display: none; }
#tcf2 .tc-tab-panel.active { display: block; }

/* Action panel: keep existing .tc-actions style but remove bottom padding (tab handles spacing) */
#tcf2 #tcf-panel-action .tc-actions {
  padding-bottom: 16px;
}

/* About panel */
#tcf2 #tcf-panel-about .tc-about {
  display: block !important;
  margin: 14px 0 16px;
}

/* ── TOAST ── */
#tcf2-toast {
  position: fixed; bottom: 24px; left: 50%;
  transform: translateX(-50%) translateY(10px);
  background: rgba(34,197,94,0.9);
  backdrop-filter: blur(8px);
  color: #fff;
  font-family: var(--tc-mono);
  font-size: 10px; font-weight: 600;
  padding: 6px 14px;
  border-radius: 20px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s, transform 0.2s;
  z-index: 50;
  white-space: nowrap;
  letter-spacing: 0.5px;
}
#tcf2-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }


/* ══════════════════════════════════════════
   CHART DRAWING TOOLBAR  (left-side, fullscreen)
══════════════════════════════════════════ */
#tcf-draw-toolbar {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 42;
  display: none;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  background: rgba(10,10,20,0.88);
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 12px;
  padding: 5px 4px;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 8px 32px rgba(0,0,0,0.55);
  user-select: none;
  -webkit-user-select: none;
  /* ── Scrollable: max height = 80% of screen, scrolls inside ── */
  max-height: 80vh;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;          /* Firefox */
  -ms-overflow-style: none;       /* IE/Edge */
  /* Landscape phone: smaller buttons, tighter gaps */
}
#tcf-draw-toolbar::-webkit-scrollbar { display: none; }
#tcf-fshud-tf-bar::-webkit-scrollbar { display: none; }

/* Portrait phone: normal size */
[data-fs="1"] #tcf-draw-toolbar { display: flex; }

/* ── Collapsed state: slide toolbar off-screen left ── */
#tcf-draw-toolbar {
  transition: transform 0.22s cubic-bezier(0.4,0,0.2,1), opacity 0.22s;
}
#tcf-draw-toolbar.dt-collapsed {
  transform: translateY(-50%) translateX(calc(-100% - 14px));
  opacity: 0;
  pointer-events: none;
}

/* ── Drawing toolbar toggle tab ── */
#tcf-draw-toggle {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 43;
  display: none;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 48px;
  background: rgba(10,10,20,0.88);
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 0 8px 8px 0;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  box-shadow: 2px 0 12px rgba(0,0,0,0.4);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  transition: background 0.15s, transform 0.22s cubic-bezier(0.4,0,0.2,1);
  user-select: none;
  -webkit-user-select: none;
}
[data-fs="1"] #tcf-draw-toggle { display: flex; }
#tcf-draw-toggle:active { background: rgba(99,102,241,0.2); }
/* When toolbar is expanded, toggle tab hides (toolbar itself is visible) */
#tcf-draw-toggle.dt-tab-hidden { opacity: 0; pointer-events: none; transition: opacity 0.15s; }
#tcf-draw-toggle svg {
  width: 10px; height: 10px;
  fill: none; stroke: rgba(255,255,255,0.4);
  stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
  pointer-events: none;
}

/* ── Landscape: shrink toolbar to fit, show scroll hint ── */
@media (max-height: 500px) {
  #tcf-draw-toolbar {
    max-height: 80vh;
    top: 56%;
    padding: 3px 3px;
    gap: 0px;
    border-radius: 10px;
  }
  #tcf-draw-toolbar .dt-btn {
    width: 28px !important;
    height: 28px !important;
    border-radius: 6px !important;
  }
  #tcf-draw-toolbar .dt-btn svg {
    width: 13px !important;
    height: 13px !important;
  }
  #tcf-draw-toolbar .dt-sep {
    margin: 2px 0 !important;
  }
}

/* Scroll fade indicators top/bottom */
#tcf-draw-toolbar::before,
#tcf-draw-toolbar::after {
  content: '';
  position: sticky;
  left: 0; right: 0;
  height: 18px;
  pointer-events: none;
  z-index: 2;
  flex-shrink: 0;
}
#tcf-draw-toolbar::before {
  top: 0;
  background: linear-gradient(to bottom, rgba(10,10,20,0.9), transparent);
}
#tcf-draw-toolbar::after {
  bottom: 0;
  background: linear-gradient(to top, rgba(10,10,20,0.9), transparent);
}

/* separator line */
#tcf-draw-toolbar .dt-sep {
  width: 22px;
  height: 1px;
  background: rgba(255,255,255,0.08);
  margin: 3px 0;
  flex-shrink: 0;
}

/* each tool button */
#tcf-draw-toolbar .dt-btn {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background 0.14s, color 0.14s;
  position: relative;
  flex-shrink: 0;
  color: rgba(255,255,255,0.45);
}
#tcf-draw-toolbar .dt-btn:active { opacity: 0.65; }
#tcf-draw-toolbar .dt-btn:hover  { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.85); }
#tcf-draw-toolbar .dt-btn.active {
  background: rgba(99,102,241,0.22);
  color: #a5b4fc;
}
#tcf-draw-toolbar .dt-btn.active svg { opacity: 1; }
#tcf-draw-toolbar .dt-btn svg {
  width: 16px; height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  pointer-events: none;
  flex-shrink: 0;
}
/* tooltip label on hover */
#tcf-draw-toolbar .dt-btn::after {
  content: attr(data-tip);
  position: absolute;
  left: calc(100% + 8px);
  top: 50%;
  transform: translateY(-50%);
  background: rgba(10,10,22,0.95);
  color: rgba(255,255,255,0.85);
  font-family: var(--tc-mono, monospace);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.5px;
  white-space: nowrap;
  padding: 4px 8px;
  border-radius: 6px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s;
  border: 1px solid rgba(255,255,255,0.08);
}
#tcf-draw-toolbar .dt-btn:hover::after { opacity: 1; }

/* SVG drawing overlay canvas */
#tcf-draw-canvas {
  position: absolute;
  inset: 0;
  z-index: 20;
  pointer-events: none;
  touch-action: none;
  overflow: hidden;
}
[data-fs="1"] #tcf-draw-canvas { display: block; }
#tcf-draw-canvas.drawing-active { pointer-events: auto; }
#tcf-draw-canvas.crosshair-cursor { cursor: crosshair; }
#tcf-draw-canvas.default-cursor   { cursor: default; }

/* Text input for text tool */
#tcf-draw-textinput {
  position: absolute;
  background: transparent;
  border: 1px dashed rgba(99,102,241,0.6);
  color: #a5b4fc;
  font-family: var(--tc-mono, monospace);
  font-size: 13px;
  font-weight: 600;
  padding: 2px 6px;
  outline: none;
  border-radius: 4px;
  min-width: 80px;
  z-index: 60;
  display: none;
}

/* ── CHART LOADING STATE ── */
#tcf2 .tc-chart-loading {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  gap: 8px;
  font-family: var(--tc-mono);
  font-size: 10px;
  color: var(--tc-sub);
  background: #06060d;
  z-index: 10;
  letter-spacing: 0.5px;
}
</style>

<div id="tcf2" style="display:flex;flex-direction:column;height:100%;position:relative;overflow:hidden;background:#07070f;">

  <!-- ── HEADER ── -->
  <div class="tc-hdr">
    <div id="tcf-back" class="tc-back">
      <span class="material-icons-round" style="font-size:18px;color:#7878a0;">arrow_back_ios_new</span>
    </div>
    <div id="tcf-icon" class="tc-logo"></div>
    <div style="flex:1;min-width:0;">
      <div class="tc-token-name">${t.name}</div>
      <div class="tc-token-sym">${t.sub} / USDT</div>
    </div>
    <!-- Chart type button -->
    <div id="tcf-chart-type-btn" onclick="tcfShowChartTypeMenu(event)" style="width:68px;height:28px;border-radius:7px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;gap:3px;-webkit-tap-highlight-color:transparent;">
      <span id="tcf-chart-type-icon" style="font-size:11px;font-family:var(--tc-mono,monospace);font-weight:700;color:#a5b4fc;letter-spacing:0.3px;">Charts</span>
      <span class="material-icons-round" style="font-size:10px;color:#7878a0;pointer-events:none;">expand_more</span>
    </div>
    <!-- Fullscreen toggle button -->
    <div id="tcf-fs-btn" onclick="tcfToggleFullscreen()" style="width:32px;height:32px;border-radius:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;margin-left:4px;margin-right:0px;transition:background 0.15s;">
      <span id="tcf-fs-icon" class="material-icons-round" style="font-size:16px;color:#7878a0;pointer-events:none;">fullscreen</span>
    </div>
  </div>

  <!-- ── PRICE + STATS ROW ── -->
  <div class="tc-price-stats-row">
    <!-- Left: price -->
    <div class="tc-price-block">
      <div class="tc-price-label" id="tcf-price-label">Current Price</div>
      <div id="tcf-price" class="tc-price-main">—</div>
      <div class="tc-price-row2">
        <div id="tcf-change" class="tc-change-pill na">—</div>
        ${_tcfContractShort ? `<div class="tc-contract-chip" onclick="event.stopPropagation();tcfCopyContract()">
          <span class="tc-contract-addr">${_tcfContractShort}</span>
          <span class="material-icons-round tc-contract-icon">content_copy</span>
        </div>` : ''}
      </div>
    </div>

    <!-- Right: key stats grid 2×2 -->
    <div class="tc-stats-grid">
      <div class="tc-sg-cell">
        <span class="tc-sg-label">Mkt Cap</span>
        <span id="tcf-mcap" class="tc-sg-val">—</span>
      </div>
      <div class="tc-sg-cell">
        <span class="tc-sg-label">24H Vol</span>
        <span id="tcf-vol" class="tc-sg-val">—</span>
      </div>
      <div class="tc-sg-cell">
        <span class="tc-sg-label">24H High</span>
        <span id="tcf-high" class="tc-sg-val green">—</span>
      </div>
      <div class="tc-sg-cell">
        <span class="tc-sg-label">24H Low</span>
        <span id="tcf-low" class="tc-sg-val red">—</span>
      </div>
    </div>
  </div>

  <!-- ── COIN QUICK-SELECT (TICKER GO removed) ── -->
  <div id="tcf-coin-row" class="tc-coin-row"></div>

  <!-- ── TIMEFRAME BAR ── -->
  <div class="tc-tf-bar">
    ${[['1s','1s'],['15s','15s'],['30s','30s'],['1m','1m'],['5m','5m'],['15m','15m'],['24H','24H'],['7D','7D'],['1M','1M'],['1Y','1Y'],['ALL','ALL']].map(([label,val]) =>
      `<div class="tcf-tf-btn tc-tf-btn${val==='5m'?' active':''}" data-tf="${val}" onclick="tcfSelectTf('${val}')">${label}</div>`
    ).join('')}
    <div id="tcf-data-source-label" style="display:none;"></div>
    <!-- Landscape fullscreen exit button — shown only in landscape FS -->
    <div id="tcf-fs-btn-landscape" onclick="tcfToggleFullscreen()" style="display:none;width:30px;height:28px;border-radius:7px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;-webkit-tap-highlight-color:transparent;">
      <span class="material-icons-round" style="font-size:15px;color:#7878a0;pointer-events:none;">fullscreen_exit</span>
    </div>
  </div>

  <!-- ── CHART AREA ── -->
  <div id="tcf-lw-wrap" class="tc-chart-wrap">

  <!-- ── DRAWING OVERLAY CANVAS ── -->
  <svg id="tcf-draw-canvas" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" style="position:absolute;inset:0;z-index:20;pointer-events:none;touch-action:none;overflow:hidden;display:none;"></svg>
  <input id="tcf-draw-textinput" type="text" placeholder="Type text..." />

  <!-- ── DRAWING TOOLBAR (left side, fullscreen only) ── -->
  <!-- Collapsed tab: visible only when toolbar is hidden, tap to re-expand -->
  <div id="tcf-draw-toggle" onclick="_dtToggleToolbar()" title="Show Drawing Tools">
    <svg viewBox="0 0 10 16"><polyline points="2,2 8,8 2,14"/></svg>
  </div>
  <div id="tcf-draw-toolbar">

    <!-- Collapse handle at top of toolbar -->
    <div class="dt-btn dt-collapse-btn" data-tip="Hide Toolbar" onclick="_dtToggleToolbar()" style="color:rgba(255,255,255,0.3);">
      <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
    </div>
    <div class="dt-sep"></div>

    <!-- Cursor / pointer -->
    <div class="dt-btn" data-tool="cursor" data-tip="Cursor" onclick="_dtSelectTool('cursor')">
      <svg viewBox="0 0 24 24"><path d="M5 3l14 9-7 1-3 7z"/></svg>
    </div>
    <!-- Undo last drawing -->
    <div class="dt-btn" data-tool="undo" data-tip="Undo (Ctrl+Z)" onclick="_dtUndo()">
      <svg viewBox="0 0 24 24"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>
    </div>
    <!-- Redo last undone drawing -->
    <div class="dt-btn" data-tool="redo" data-tip="Redo (Ctrl+Shift+Z)" onclick="_dtRedo()">
      <svg viewBox="0 0 24 24"><polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/></svg>
    </div>

    <div class="dt-sep"></div>

    <!-- Trend Line -->
    <div class="dt-btn" data-tool="trendline" data-tip="Trend Line" onclick="_dtSelectTool('trendline')">
      <svg viewBox="0 0 24 24"><line x1="4" y1="20" x2="20" y2="4"/></svg>
    </div>
    <!-- Ray -->
    <div class="dt-btn" data-tool="ray" data-tip="Ray" onclick="_dtSelectTool('ray')">
      <svg viewBox="0 0 24 24"><line x1="4" y1="20" x2="20" y2="4"/><circle cx="20" cy="4" r="1.5" fill="currentColor" stroke="none"/></svg>
    </div>
    <!-- Extended Line -->
    <div class="dt-btn" data-tool="extline" data-tip="Extended Line" onclick="_dtSelectTool('extline')">
      <svg viewBox="0 0 24 24"><line x1="2" y1="22" x2="22" y2="2"/><path d="M19 5l3-3M5 19l-3 3" stroke-dasharray="2 2"/></svg>
    </div>

    <div class="dt-sep"></div>

    <!-- Horizontal Line -->
    <div class="dt-btn" data-tool="hline" data-tip="Horizontal Line" onclick="_dtSelectTool('hline')">
      <svg viewBox="0 0 24 24"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="12" x2="6" y2="9"/><line x1="3" y1="12" x2="6" y2="15"/></svg>
    </div>
    <!-- Horizontal Ray -->
    <div class="dt-btn" data-tool="hray" data-tip="Horizontal Ray" onclick="_dtSelectTool('hray')">
      <svg viewBox="0 0 24 24"><line x1="3" y1="12" x2="21" y2="12"/><circle cx="21" cy="12" r="1.5" fill="currentColor" stroke="none"/></svg>
    </div>
    <!-- Vertical Line -->
    <div class="dt-btn" data-tool="vline" data-tip="Vertical Line" onclick="_dtSelectTool('vline')">
      <svg viewBox="0 0 24 24"><line x1="12" y1="3" x2="12" y2="21"/><line x1="12" y1="3" x2="9" y2="6"/><line x1="12" y1="3" x2="15" y2="6"/></svg>
    </div>

    <div class="dt-sep"></div>

    <!-- Rectangle -->
    <div class="dt-btn" data-tool="rectangle" data-tip="Rectangle" onclick="_dtSelectTool('rectangle')">
      <svg viewBox="0 0 24 24"><rect x="4" y="6" width="16" height="12" rx="1"/></svg>
    </div>
    <!-- Parallel Channel -->
    <div class="dt-btn" data-tool="channel" data-tip="Parallel Channel" onclick="_dtSelectTool('channel')">
      <svg viewBox="0 0 24 24"><line x1="3" y1="18" x2="21" y2="6"/><line x1="3" y1="13" x2="21" y2="1"/><line x1="3" y1="23" x2="21" y2="11"/></svg>
    </div>

    <div class="dt-sep"></div>

    <!-- Fibonacci Retracement -->
    <div class="dt-btn" data-tool="fib" data-tip="Fibonacci Retracement" onclick="_dtSelectTool('fib')">
      <svg viewBox="0 0 24 24">
        <line x1="4" y1="20" x2="20" y2="4" stroke-dasharray="2 0"/>
        <line x1="4" y1="16" x2="20" y2="16" stroke-width="1" stroke-dasharray="2 2"/>
        <line x1="4" y1="12" x2="20" y2="12" stroke-width="1" stroke-dasharray="2 2"/>
        <line x1="4" y1="8"  x2="20" y2="8"  stroke-width="1" stroke-dasharray="2 2"/>
      </svg>
    </div>
    <!-- Fibonacci Extension -->
    <div class="dt-btn" data-tool="fibext" data-tip="Fibonacci Extension (3 taps: A → B → C)" onclick="_dtSelectTool('fibext')">
      <svg viewBox="0 0 24 24">
        <line x1="3" y1="21" x2="13" y2="11" stroke-dasharray="2 2"/>
        <line x1="13" y1="11" x2="21" y2="3"/>
        <line x1="3" y1="17" x2="21" y2="17" stroke-width="1" stroke-dasharray="2 2"/>
        <line x1="3" y1="9"  x2="21" y2="9"  stroke-width="1" stroke-dasharray="2 2"/>
      </svg>
    </div>
    <!-- Pitchfork -->
    <div class="dt-btn" data-tool="pitchfork" data-tip="Pitchfork" onclick="_dtSelectTool('pitchfork')">
      <svg viewBox="0 0 24 24">
        <line x1="4" y1="20" x2="20" y2="4"/>
        <line x1="4" y1="20" x2="12" y2="4"/>
        <line x1="4" y1="20" x2="4" y2="4"/>
        <line x1="4" y1="12" x2="20" y2="12" stroke-dasharray="2 2"/>
      </svg>
    </div>

    <div class="dt-sep"></div>

    <!-- Long Position -->
    <div class="dt-btn" data-tool="long" data-tip="Long Position (3 taps: Entry → Target → Stop)" onclick="_dtSelectTool('long')">
      <svg viewBox="0 0 24 24">
        <line x1="3" y1="18" x2="21" y2="18" stroke-width="1"/>
        <line x1="3" y1="6"  x2="21" y2="6"  stroke-width="1" stroke-dasharray="2 2"/>
        <line x1="12" y1="18" x2="12" y2="6"/>
        <polyline points="8 10 12 6 16 10"/>
      </svg>
    </div>
    <!-- Short Position -->
    <div class="dt-btn" data-tool="short" data-tip="Short Position (3 taps: Entry → Target → Stop)" onclick="_dtSelectTool('short')">
      <svg viewBox="0 0 24 24">
        <line x1="3" y1="6"  x2="21" y2="6"  stroke-width="1"/>
        <line x1="3" y1="18" x2="21" y2="18" stroke-width="1" stroke-dasharray="2 2"/>
        <line x1="12" y1="6" x2="12" y2="18"/>
        <polyline points="8 14 12 18 16 14"/>
      </svg>
    </div>

    <div class="dt-sep"></div>

    <!-- Brush / Pencil -->
    <div class="dt-btn" data-tool="brush" data-tip="Brush" onclick="_dtSelectTool('brush')">
      <svg viewBox="0 0 24 24"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-.25 1.75-1 2.5S3 18 3 19v2z"/><path d="M9 3H5"/><path d="M6.08 3C6.08 3.5 5.5 6 5.5 9 5.5 12 6 14 6 14"/></svg>
    </div>
    <!-- Text -->
    <div class="dt-btn" data-tool="text" data-tip="Text" onclick="_dtSelectTool('text')">
      <svg viewBox="0 0 24 24"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
    </div>
    <!-- Measure -->
    <div class="dt-btn" data-tool="measure" data-tip="Measure" onclick="_dtSelectTool('measure')">
      <svg viewBox="0 0 24 24"><line x1="4" y1="20" x2="20" y2="4"/><line x1="4" y1="20" x2="4" y2="14"/><line x1="4" y1="20" x2="10" y2="20"/><line x1="20" y1="4" x2="14" y2="4"/><line x1="20" y1="4" x2="20" y2="10"/></svg>
    </div>
    <!-- Price Range -->
    <div class="dt-btn" data-tool="pricerange" data-tip="Price Range" onclick="_dtSelectTool('pricerange')">
      <svg viewBox="0 0 24 24"><line x1="2" y1="6" x2="22" y2="6"/><line x1="2" y1="18" x2="22" y2="18"/><line x1="12" y1="6" x2="12" y2="18"/><polyline points="9 9 12 6 15 9"/><polyline points="9 15 12 18 15 15"/></svg>
    </div>
    <!-- Zoom -->
    <div class="dt-btn" data-tool="zoom" data-tip="Zoom In Area" onclick="_dtSelectTool('zoom')">
      <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="22" y2="22"/><line x1="8" y1="11" x2="14" y2="11"/><line x1="11" y1="8" x2="11" y2="14"/></svg>
    </div>

    <div class="dt-sep"></div>

    <!-- Arrow -->
    <div class="dt-btn" data-tool="arrow" data-tip="Arrow" onclick="_dtSelectTool('arrow')">
      <svg viewBox="0 0 24 24"><line x1="5" y1="19" x2="19" y2="5"/><polyline points="9 5 19 5 19 15"/></svg>
    </div>
    <!-- Triangle -->
    <div class="dt-btn" data-tool="triangle" data-tip="Triangle" onclick="_dtSelectTool('triangle')">
      <svg viewBox="0 0 24 24"><polygon points="12 4 22 20 2 20"/></svg>
    </div>
    <!-- Ellipse -->
    <div class="dt-btn" data-tool="ellipse" data-tip="Ellipse" onclick="_dtSelectTool('ellipse')">
      <svg viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="10" ry="6"/></svg>
    </div>
    <!-- Horizontal Zone (support/resistance band) -->
    <div class="dt-btn" data-tool="hzone" data-tip="Horizontal Zone" onclick="_dtSelectTool('hzone')">
      <svg viewBox="0 0 24 24"><rect x="2" y="8" width="20" height="8" rx="1" fill="rgba(99,102,241,0.3)" stroke-width="1.5"/><line x1="2" y1="8" x2="22" y2="8"/><line x1="2" y1="16" x2="22" y2="16"/></svg>
    </div>

    <div class="dt-sep"></div>

    <!-- Price Label -->
    <div class="dt-btn" data-tool="pricelabel" data-tip="Price Label" onclick="_dtSelectTool('pricelabel')">
      <svg viewBox="0 0 24 24"><line x1="2" y1="12" x2="22" y2="12" stroke-dasharray="3 2"/><rect x="14" y="8" width="8" height="8" rx="2"/><text x="15.5" y="14" font-size="6" fill="currentColor" stroke="none" font-family="monospace" font-weight="bold">$</text></svg>
    </div>
    <!-- Date Range -->
    <div class="dt-btn" data-tool="daterange" data-tip="Date Range" onclick="_dtSelectTool('daterange')">
      <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><line x1="5" y1="6" x2="5" y2="18"/><line x1="19" y1="6" x2="19" y2="18"/><polyline points="8 9 5 12 8 15"/><polyline points="16 9 19 12 16 15"/></svg>
    </div>
    <!-- ABCD Pattern (4-point) -->
    <div class="dt-btn" data-tool="abcd" data-tip="ABCD Pattern" onclick="_dtSelectTool('abcd')">
      <svg viewBox="0 0 24 24"><polyline points="3 18 8 6 13 15 19 4"/><text x="2" y="22" font-size="5" fill="currentColor" stroke="none" font-family="monospace" font-weight="bold">A</text><text x="7" y="5" font-size="5" fill="currentColor" stroke="none" font-family="monospace" font-weight="bold">B</text><text x="12" y="19" font-size="5" fill="currentColor" stroke="none" font-family="monospace" font-weight="bold">C</text><text x="18" y="4" font-size="5" fill="currentColor" stroke="none" font-family="monospace" font-weight="bold">D</text></svg>
    </div>

    <div class="dt-sep"></div>

    <!-- Magnet mode -->
    <div class="dt-btn" data-tool="magnet" data-tip="Magnet Mode" onclick="_dtToggleMagnet(this)">
      <svg viewBox="0 0 24 24"><path d="M6 3h12v7a6 6 0 0 1-12 0V3z"/><line x1="9" y1="3" x2="9" y2="10"/><line x1="15" y1="3" x2="15" y2="10"/><line x1="3" y1="21" x2="9" y2="15"/><line x1="21" y1="21" x2="15" y2="15"/></svg>
    </div>
    <!-- Lock drawings -->
    <div class="dt-btn" data-tool="lock" data-tip="Lock Drawings" onclick="_dtToggleLock(this)">
      <svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
    </div>
    <!-- Visibility -->
    <div class="dt-btn" data-tool="visibility" data-tip="Hide/Show Drawings" onclick="_dtToggleVisibility(this)">
      <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
    </div>

    <div class="dt-sep"></div>

    <!-- Clear all -->
    <div class="dt-btn" data-tool="trash" data-tip="Clear All Drawings" onclick="_dtClearAll()">
      <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
    </div>

  </div>

    <!-- OHLC bar -->
    <div id="tcf-ohlc-bar" class="tc-ohlc-bar">
      <div class="tc-ohlc-inner">
        <span id="tcf-ohlc-time" style="color:#7878a0;margin-right:2px;"></span>
        <span style="color:#7878a0;">O</span><span id="tcf-ohlc-o" style="color:#f0f0fa;margin-right:6px;"></span>
        <span style="color:#7878a0;">H</span><span id="tcf-ohlc-h" style="color:#22c55e;margin-right:6px;"></span>
        <span style="color:#7878a0;">L</span><span id="tcf-ohlc-l" style="color:#ef4444;margin-right:6px;"></span>
        <span style="color:#7878a0;">C</span><span id="tcf-ohlc-c" style="color:#f0f0fa;"></span>
      </div>
    </div>
    <div id="tcf-lw-chart" style="width:100%;height:240px;flex-shrink:0;"></div>
    <div id="tcf-lw-volume" style="width:100%;height:48px;flex-shrink:0;"></div>
    <div id="tcf-chart-loading" class="tc-chart-loading">
      <div style="width:14px;height:14px;border:2px solid rgba(99,102,241,0.2);border-top-color:#6366f1;border-radius:50%;animation:spin 0.8s linear infinite;flex-shrink:0;"></div>
      Loading chart
    </div>
  </div>

  <!-- legacy compat -->
  <svg id="tcf-chart-svg" width="0" height="0" style="display:none;"></svg>
  <div id="tcf-tooltip" style="display:none;"></div>
  <div id="tcf-crosshair" style="display:none;"></div>

  <!-- ── SCROLLABLE BOTTOM CONTENT ── -->
  <div class="tc-scroll">

    <!-- Supply + ATH row -->
    <div class="tc-supply-block">
      <div class="tc-supply-cell">
        <span class="tc-supply-label">Circulating Supply</span>
        <span id="tcf-supply" class="tc-supply-val">—</span>
      </div>
      <div class="tc-supply-cell" style="border-left:1px solid var(--tc-border);">
        <span class="tc-supply-label">All-Time High</span>
        <span id="tcf-ath" class="tc-supply-val" style="color:#a5b4fc;">—</span>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="tc-actions" style="justify-content:center;">
      <div onclick="tcfGoSwap()" class="tc-btn-swap" style="flex:0 0 auto;width:100px;"
        ontouchstart="this.style.transform='scale(0.97)'" ontouchend="this.style.transform=''">
        <span class="material-icons-round" style="font-size:18px;color:#fff;">swap_horiz</span>
        <span class="tc-btn-label" style="color:#fff;">Swap</span>
      </div>
      <div onclick="tcfGoBridge()" class="tc-btn-bridge" style="flex:0 0 auto;width:100px;"
        ontouchstart="this.style.transform='scale(0.97)'" ontouchend="this.style.transform=''">
        <span class="material-icons-round" style="font-size:18px;color:#22d3ee;">alt_route</span>
        <span class="tc-btn-label" style="color:#22d3ee;">Bridge</span>
      </div>
      <div onclick="tcfGoSend()" class="tc-btn-send" style="flex:0 0 auto;width:100px;"
        ontouchstart="this.style.transform='scale(0.97)'" ontouchend="this.style.transform=''">
        <span class="material-icons-round" style="font-size:18px;color:#f59e0b;">send</span>
        <span class="tc-btn-label" style="color:#f59e0b;">Send</span>
      </div>
    </div>

    <!-- About section -->
    <div id="tcf-about-section" class="tc-about" style="display:none;">
      <div class="tc-about-header">
        <span class="tc-about-label">About ${t.name}</span>
      </div>
      <div id="tcf-about-text" class="tc-about-txt collapsed"></div>
      <div id="tcf-readmore-btn" class="tc-readmore" onclick="tcfToggleAbout(this)" style="display:none;">
        <span id="tcf-readmore-label">Read more</span>
        <span class="material-icons-round" id="tcf-readmore-icon" style="font-size:12px;">expand_more</span>
      </div>
    </div>

  </div>

    <!-- Copied toast -->
  <div id="tcf2-toast">Address copied!</div>

</div>
  `;

  document.body.appendChild(overlay);

  // Inject icon
  const iconBox = overlay.querySelector('#tcf-icon');
  if (iconBox) {
    const logoEl = getTokenLogoEl(t);
    logoEl.style.width = '100%'; logoEl.style.height = '100%';
    iconBox.appendChild(logoEl);
  }

  // Back button
  overlay.querySelector('#tcf-back').addEventListener('click', closeTokenChart);

  // Enter key on custom symbol input
  const customInput = overlay.querySelector('#tcf-custom-sym');
  if (customInput) {
    customInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') tcfSelectCoin(customInput.value.trim().toUpperCase());
    });
  }

  // Animate in
  requestAnimationFrame(() => requestAnimationFrame(() => { overlay.style.opacity = '1'; }));

  // Store state
  window._tcfToken  = t;
  window._tcfTf     = '5m';
  window._tcfChartType = 'candle'; // always candlestick now
  window._tcfActiveCoin = (t.sub || 'BTC').toUpperCase().replace('USDT','').replace('/','');

  // ── Load persisted drawings for this coin ──
  _dtLoadDrawings(window._tcfActiveCoin);

  // ── Mark active coin button ──
  _tcfHighlightCoin(window._tcfActiveCoin);

  // ── Init lightweight charts ──
  _tcfInitLWCharts();

  // ── Load chart data + market data ──
  _tcfLoadLWData(window._tcfActiveCoin, window._tcfTf);
  _tcfFetchMarketData(t);



  // ── Auto-refresh market data every 10s (synced with chart) ──
  window._tcfMarketRefreshTimer = setInterval(() => {
    const token = window._tcfToken;
    if (token && document.getElementById('token-chart-full-overlay')) {
      _tcfFetchMarketData(token);
    }
  }, 60000);
}