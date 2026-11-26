

// ── Alias for backward compatibility ──
function closeTokenChartFull() { closeTokenChart(); }

// ── Copy contract address to clipboard with toast ──
function tcfCopyContract() {
  const t = window._tcfToken;
  if (!t) return;
  const addr = t.contract || t.address || t.contractAddress || '';
  if (!addr) return;
  let _toastShown = false;
  function _showToast() {
    if (_toastShown) return;
    _toastShown = true;
    // Move toast to body so overlay overflow:hidden doesn't trap it
    let toast = document.getElementById('tcf2-toast');
    if (toast && toast.parentElement !== document.body) {
      document.body.appendChild(toast);
    }
    if (!toast) return;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1800);
  }
  try {
    navigator.clipboard.writeText(addr).then(_showToast).catch(function() {
      const ta = document.createElement('textarea');
      ta.value = addr; ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
      document.body.appendChild(ta); ta.focus(); ta.select();
      try { document.execCommand('copy'); } catch(_) {}
      document.body.removeChild(ta);
      _showToast();
    });
  } catch(e) {
    const ta = document.createElement('textarea');
    ta.value = addr; ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
    document.body.appendChild(ta); ta.focus(); ta.select();
    try { document.execCommand('copy'); } catch(_) {}
    document.body.removeChild(ta);
    _showToast();
  }
}

function closeTokenChart() {
  const overlay = document.getElementById('token-chart-full-overlay');
  if (!overlay) return;
  // Save drawings before closing (in case not in fullscreen)
  try { _dtSaveDrawings(); } catch(e) {}
  // If fullscreen is active, exit it first so Android restores nav bar
  if (overlay.getAttribute('data-fs') === '1') {
    try { _tcfExitFsUI(overlay); } catch(e) {}
  }
  overlay.style.opacity = '0';
  setTimeout(() => overlay.remove(), 220);
  window._tcfToken = null;
  // Kill WebSocket
  _lwKillWs();
  // Clear market data refresh timer
  if (window._tcfMarketRefreshTimer) {
    clearInterval(window._tcfMarketRefreshTimer);
    window._tcfMarketRefreshTimer = null;
  }
  // Destroy chart instances
  try { if (_lwChart)    { _lwChart.remove();    _lwChart    = null; } } catch(e) {}
  try { if (_lwVolChart) { _lwVolChart.remove();  _lwVolChart = null; } } catch(e) {}
  _lwCandleSeries = null;
  _lwVolSeries    = null;
  _lwMa7 = null; _lwMa25 = null; _lwMa99 = null;
}

function tcfSelectTf(tf) {
  window._tcfTf = tf;
  window._lwTargetRange = null; // reset so new TF gets fresh range from _lwApplyCandles
  document.querySelectorAll('.tcf-tf-btn').forEach(b => {
    const active = b.dataset.tf === tf;
    b.classList.toggle('active', active);
    // Only clear inline styles if they were actually set (avoids forced reflow/flicker)
    if (b.style.background) b.style.background = '';
    if (b.style.border)     b.style.border = '';
    if (b.style.color)      b.style.color = '';
  });
  // Sync fullscreen HUD timeframe buttons
  const hudTfBar = document.getElementById('tcf-fshud-tf-bar');
  if (hudTfBar) {
    hudTfBar.querySelectorAll('[data-hud-tf]').forEach(b => {
      const active = b.dataset.hudTf === tf;
      b.style.background = active ? 'rgba(99,102,241,0.25)' : 'transparent';
      b.style.color = active ? '#a5b4fc' : 'rgba(255,255,255,0.35)';
    });
  }

  const coin = window._tcfActiveCoin || 'BTC';
  // Pass tfOnly=true so trade WS is NOT restarted on timeframe change
  _tcfLoadLWData(coin, tf, true);
}

function tcfSelectCoin(sym) {
  if (!sym || sym.length < 1) return;
  sym = sym.toUpperCase().replace('USDT','').replace('/','');
  // Save drawings of current coin before switching
  if (window._tcfActiveCoin && window._tcfActiveCoin !== sym) {
    _dtSaveDrawings();
  }
  window._tcfActiveCoin = sym;
  // Load drawings for the newly selected coin
  _dtLoadDrawings(sym);
  _tcfHighlightCoin(sym);
  // Update header name if known
  const knownNames = {BTC:'Bitcoin',ETH:'Ethereum',BNB:'BNB',SOL:'Solana'};
  const nameEl = document.querySelector('#token-chart-full-overlay #tcf-icon')?.closest('[style*="flex:1"]')?.querySelector('[style*="font-size:15px"]');
  // Update sub label
  const subEl = document.querySelector('#token-chart-full-overlay [style*="margin-top:1px"]');
  if (subEl) subEl.textContent = sym + '/USDT';
  _tcfLoadLWData(sym, window._tcfTf || '1h');
}

function _tcfHighlightCoin(sym) {
  document.querySelectorAll('.tcf-coin-btn').forEach(b => {
    const active = b.dataset.coin === sym;
    b.style.background = active ? 'rgba(99,102,241,0.15)' : 'var(--tc-raised, var(--bg-raised))';
    b.style.borderColor = active ? 'rgba(99,102,241,0.45)' : 'rgba(255,255,255,0.07)';
    b.style.color = active ? '#a5b4fc' : '#7878a0';
  });
}

// ── Switch chart type using cached candle data (no unnecessary API refetch) ──
function tcfSetChartType(type) {
  window._tcfChartType = type;
  // Update button icon
  const iconEl = document.getElementById('tcf-chart-type-icon');
  if (iconEl) iconEl.textContent = 'Charts';
  const coin = window._tcfActiveCoin;
  const tf   = window._tcfTf || '5m';
  const expectedKey = (coin || '') + '_' + tf;
  const candles = window._lwLastCandles;
  // If no cached candles, chart not ready, or the cached candles belong to a
  // different coin/timeframe (e.g. a TF switch fetch is still in flight) —
  // fetch fresh data for the CURRENTLY selected coin+TF instead of rendering
  // stale candles. _lwApplyCandles() will pick up window._tcfChartType (set
  // above) and render the right series type once the fresh data arrives.
  if (!candles || !candles.length || !_lwChart || window._lwLastCandlesKey !== expectedKey) {
    if (coin) _tcfLoadLWData(coin, tf, true);
    return;
  }
  _lwRenderMainSeries(type, candles);
  // Restore the current timeframe range instead of resetting with fitContent().
  // fitContent() ignores _lwTargetRange and resets the view to LWC defaults,
  // making it look like the wrong timeframe was applied after a chart type switch.
  if (_lwChart && window._lwTargetRange) {
    const r = window._lwTargetRange;
    // Cancel any leftover guard before starting a new one
    if (window._lwRangeGuard) { clearInterval(window._lwRangeGuard); window._lwRangeGuard = null; }
    const _applyRange = () => {
      if (!window._lwTargetRange) return;
      try { _lwChart.timeScale().setVisibleLogicalRange(r); } catch(e) {}
      try { if (_lwVolChart) _lwVolChart.timeScale().setVisibleLogicalRange(r); } catch(e) {}
    };
    _applyRange();
    let _gc = 0;
    window._lwRangeGuard = setInterval(() => {
      _applyRange();
      if (++_gc >= 10) { clearInterval(window._lwRangeGuard); window._lwRangeGuard = null; }
    }, 100);
  } else if (_lwChart) {
    _lwChart.timeScale().fitContent();
  }
}

function tcfShowChartTypeMenu(e) {
  e.stopPropagation();
  // Remove existing menu
  const existing = document.getElementById('tcf-chart-type-menu');
  if (existing) { existing.remove(); return; }
  const btn = document.getElementById('tcf-chart-type-btn');
  if (!btn) return;
  const rect = btn.getBoundingClientRect();
  const overlay = document.getElementById('token-chart-full-overlay');
  const ovRect = overlay ? overlay.getBoundingClientRect() : { left:0, top:0 };
  const menu = document.createElement('div');
  menu.id = 'tcf-chart-type-menu';
  menu.style.cssText = 'position:absolute;z-index:200;background:rgba(12,12,24,0.97);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:4px;box-shadow:0 8px 32px rgba(0,0,0,0.6);backdrop-filter:blur(16px);min-width:140px;';
  menu.style.top  = (rect.bottom - ovRect.top + 6) + 'px';
  menu.style.right = (ovRect.right - rect.right) + 'px';
  const types = [
    { id:'candle',      label:'Candlestick', icon:'C'  },
    { id:'heikinashi',  label:'Heikin Ashi', icon:'HA' },
    { id:'baseline',    label:'Baseline',    icon:'BL' },
    { id:'line',        label:'Line',        icon:'L'  },
    { id:'area',        label:'Area',        icon:'A'  },
    { id:'bar',         label:'Bar',         icon:'B'  },
    { id:'hollowcandle',label:'Hollow Candle',icon:'HC' },
    { id:'renko',       label:'Renko',       icon:'RK' },
    { id:'kagi',        label:'Kagi',        icon:'KG' },
    { id:'pnf',         label:'Point & Figure',icon:'PF' },
    { id:'linebreak',   label:'Line Break',  icon:'LB' },
  ];
  const cur = window._tcfChartType || 'candle';
  types.forEach(t => {
    const row = document.createElement('div');
    const isActive = t.id === cur;
    row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:7px;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background 0.12s;' + (isActive ? 'background:rgba(99,102,241,0.18);' : '');
    row.innerHTML = '<span style="font-family:var(--tc-mono,monospace);font-size:10px;font-weight:800;color:' + (isActive?'#a5b4fc':'#7878a0') + ';width:22px;text-align:center;">' + t.icon + '</span><span style="font-size:12px;font-weight:600;color:' + (isActive?'#f0f0fa':'rgba(255,255,255,0.6)') + ';">' + t.label + '</span>' + (isActive ? '<span class="material-icons-round" style="font-size:13px;color:#a5b4fc;margin-left:auto;">check</span>' : '');
    row.addEventListener('click', () => { tcfSetChartType(t.id); menu.remove(); });
    menu.appendChild(row);
  });
  if (overlay) overlay.appendChild(menu);
  else document.body.appendChild(menu);
  // Close on outside tap
  setTimeout(() => { document.addEventListener('click', function _close(){ menu.remove(); document.removeEventListener('click',_close); }, { once:true }); }, 50);
}

// ── Toggle About section Read More ──
function tcfSwitchTab(tab) {
  // Update tab buttons
  const tabs = ['action', 'about'];
  tabs.forEach(function(t) {
    const btn = document.getElementById('tcf-tab-' + t);
    const panel = document.getElementById('tcf-panel-' + t);
    if (btn)   btn.classList.toggle('active',   t === tab);
    if (panel) panel.classList.toggle('active', t === tab);
  });
}

function tcfToggleAbout(btn) {
  const txt = document.getElementById('tcf-about-text');
  const label = document.getElementById('tcf-readmore-label');
  const icon  = document.getElementById('tcf-readmore-icon');
  if (!txt) return;
  const isCollapsed = txt.classList.contains('collapsed');
  txt.classList.toggle('collapsed', !isCollapsed);
  txt.classList.toggle('expanded',   isCollapsed);
  if (label) label.textContent = isCollapsed ? 'Read less' : 'Read more';
  if (icon)  icon.textContent  = isCollapsed ? 'expand_less' : 'expand_more';
}

