// ── RPC PANEL TOGGLE ──
let rpcPanelOpen = false;
function toggleRpcPanel() {
  rpcPanelOpen = !rpcPanelOpen;
  const body = document.getElementById('rpc-panel-body');
  const chevron = document.getElementById('rpc-chevron');
  const header = document.getElementById('rpc-header-row');
  if (rpcPanelOpen) {
    if (body) { body.style.display = 'flex'; body.style.flexDirection = 'column'; body.style.gap = '12px'; }
    if (chevron) { chevron.style.transform = 'rotate(180deg)'; chevron.style.color = 'var(--accent-primary)'; }
    if (header) { header.style.borderBottom = '1px solid var(--border-subtle)'; header.style.paddingBottom = '14px'; }
  } else {
    if (body) body.style.display = 'none';
    if (chevron) { chevron.style.transform = ''; chevron.style.color = 'var(--text-muted)'; }
    if (header) { header.style.borderBottom = ''; header.style.paddingBottom = ''; }
  }
  haptic();
}

// ── FAB ──
function fabAction() {
  const actions = {
    home: () => { switchPage('swap'); },
    swap: () => { showToast('Paste your real keys', 'vpn_key'); },
    profile: () => { },
    settings: () => { showToast('v2.5.1 — ERC-4337 + EIP-7702', 'info'); },
  };
  (actions[currentPage] || (() => {}))();
  haptic();
}

// ── TOAST ──
let toastTimer;
function showToast(msg, icon='check_circle', opts) {
  const t = document.getElementById('toast');
  const msgEl = document.getElementById('toast-msg');
  const iconEl = document.getElementById('toast-icon');
  if (msgEl) msgEl.textContent = msg;
  if (iconEl) iconEl.textContent = icon === 'warning' ? 'warning_amber' : icon;

  // Remove previous type classes
  t.classList.remove('toast-warning', 'toast-error', 'toast-center');

  if (icon === 'warning') {
    t.classList.add('toast-warning', 'toast-center');
  } else if (icon === 'error') {
    t.classList.add('toast-error');
  }

  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.classList.remove('toast-warning','toast-error','toast-center'), 300);
  }, icon === 'warning' ? 3500 : 2200);
}


// ══════════════════════════════════════════════════════
// BACKGROUND TASK SYSTEM — page switch করলেও bot চলে
// ══════════════════════════════════════════════════════
(function() {
  var BG_TOOLS = {
    'sup-transfer':  { label: 'SUP Transfer',        running: function() { return !!window.supRunning; } },
    'base-swap-bot': { label: 'Base Swap Bot',        running: function() { return !!window.bsbRunning; } },
    'nansen':        { label: 'Nansen & Jumper Swap', running: function() { return typeof swapBotRunning !== 'undefined' && swapBotRunning; } },
    'delegation':    { label: 'EIP-7702 Delegation',  running: function() { return !!window.delRunning; } },
    'bridge':        { label: function() { return window.brIsSameChain ? 'Swap' : 'Bridge'; }, running: function() { return !!window.brRunning; } },
    'swap':          { label: 'Swap',                 running: function() { return !!window.swRunning; } },
    'home':          { label: 'Send',                 running: function() { return !!window.sendRunning; } },
    'transfer-hub':  { label: 'Transfer Hub',         running: function() { var f = window._thStopFlags; return f ? Object.keys(f).some(function(k){ return !f[k] && k !== '__init'; }) : false; } }
  };

  // Wrap switchPage to show toast when leaving a running tool
  var _bgOrigSP = window.switchPage;
  window.switchPage = function(page) {
    return _bgOrigSP.apply(this, arguments);
  };

  window._bgTaskRunning = function() {
    return Object.values(BG_TOOLS).some(function(t) { return t.running(); });
  };
  window._bgTaskLabel = function() {
    var running = Object.entries(BG_TOOLS).filter(function(e) { return e[1].running(); });
    return running.map(function(e) { return e[1].label; }).join(', ');
  };

  // ── Profile tool badges update ──
  var LIVE_HTML = function(color) {
    return '<div style="font-size:9px;color:'+color+';font-family:var(--font-mono);font-weight:700;background:rgba(16,185,129,0.1);border:1px solid '+color+'55;border-radius:6px;padding:2px 9px;letter-spacing:1px;animation:_bsb_pulse 1.5s ease-in-out infinite;">LIVE</div>';
  };
  var CHEVRON_HTML = '<span class="material-icons-round" style="font-size:18px;color:var(--text-muted)">chevron_right</span>';
  window._updateAllToolBadges = function() {
    var bsbEl  = document.getElementById('bsb-menu-indicator');
    var supEl  = document.getElementById('sup-menu-indicator');
    var swapEl = document.getElementById('swap-menu-indicator');
    if(bsbEl)  bsbEl.innerHTML  = window.bsbRunning  ? LIVE_HTML('#10b981') : CHEVRON_HTML;
    if(supEl)  supEl.innerHTML  = window.supRunning  ? LIVE_HTML('#f472b6') : CHEVRON_HTML;
    if(swapEl) swapEl.innerHTML = (typeof swapBotRunning!=='undefined'&&swapBotRunning) ? LIVE_HTML('#6366f1') : CHEVRON_HTML;
  };
})();
