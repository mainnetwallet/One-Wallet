// ── Console Log Panel ──
function openConsoleLogPanel() {
  var m = document.getElementById('nx-console-modal');
  if (m) m.style.display = 'flex';
  renderConsoleLogPanel();
  haptic();
}
function closeConsoleLogPanel() {
  var m = document.getElementById('nx-console-modal');
  if (m) m.style.display = 'none';
}
function _nxLevelColor(level) {
  if (level === 'error') return '#f6465d';
  if (level === 'warn') return '#f5a623';
  if (level === 'info') return '#06b6d4';
  return 'var(--text-secondary)';
}
function _nxEscapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function renderConsoleLogPanel(onlyIfOpen) {
  var modal = document.getElementById('nx-console-modal');
  if (onlyIfOpen && (!modal || modal.style.display !== 'flex')) return;
  var list = document.getElementById('nx-console-list');
  var sub  = document.getElementById('nx-console-count-sub');
  var logs = window._nxConsoleLogs || [];
  if (sub) sub.textContent = logs.length + ' ' + (logs.length === 1 ? 'entry' : 'entries');
  if (!list) return;
  if (!logs.length) {
    list.innerHTML = '<div style="text-align:center;padding:50px 20px;color:var(--text-muted);font-size:11px;font-family:var(--font-mono);line-height:1.8;">No logs captured.<br>Turn on capture below.</div>';
    return;
  }
  list.innerHTML = logs.slice().reverse().map(function(e) {
    var time = new Date(e.t).toLocaleTimeString();
    return '<div style="padding:8px 16px;border-bottom:1px solid var(--border-subtle);">'
      + '<div style="display:flex;gap:8px;align-items:baseline;margin-bottom:3px;">'
      + '<span style="font-size:8px;color:var(--text-muted);font-family:var(--font-mono);">' + time + '</span>'
      + '<span style="font-size:8px;font-weight:800;color:' + _nxLevelColor(e.level) + ';text-transform:uppercase;letter-spacing:0.5px;font-family:var(--font-mono);">' + e.level + '</span>'
      + '</div>'
      + '<div style="font-size:10.5px;color:var(--text-primary);white-space:pre-wrap;word-break:break-word;line-height:1.5;font-family:var(--font-mono);">' + _nxEscapeHtml(e.msg) + '</div>'
      + '</div>';
  }).join('');
}
window._nxRenderConsoleLogPanel = renderConsoleLogPanel;

function toggleConsoleLogCapture() {
  window._nxConsoleEnabled = !window._nxConsoleEnabled;
  try { localStorage.setItem('one_console_log_enabled', window._nxConsoleEnabled ? 'on' : 'off'); } catch(e) {}
  ['nx-console-toggle','console-log-menu-toggle'].forEach(function(id) {
    var t = document.getElementById(id);
    if (t) { if (window._nxConsoleEnabled) t.classList.add('on'); else t.classList.remove('on'); }
  });
  var subEl = document.getElementById('console-log-menu-sub');
  if (subEl) subEl.textContent = window._nxConsoleEnabled ? 'Capturing — tap to view' : 'Off — tap to view & enable';
  showToast(window._nxConsoleEnabled ? 'Console logging ON' : 'Console logging OFF', window._nxConsoleEnabled ? 'check_circle' : 'cancel');
  haptic();
}

function clearConsoleLogs() {
  window._nxConsoleLogs = [];
  renderConsoleLogPanel();
  showToast('Logs cleared', 'check_circle');
  haptic();
}

function copyConsoleLogs() {
  var logs = window._nxConsoleLogs || [];
  if (!logs.length) { showToast('No logs to copy', 'info'); return; }
  var text = logs.map(function(e) {
    return new Date(e.t).toISOString() + ' [' + e.level.toUpperCase() + '] ' + e.msg;
  }).join('\n');
  function fallbackCopy(t) {
    try {
      var ta = document.createElement('textarea');
      ta.value = t;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch(e) { return false; }
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function() {
      showToast('Logs copied', 'check_circle'); haptic();
    }).catch(function() {
      if (fallbackCopy(text)) { showToast('Logs copied', 'check_circle'); haptic(); }
      else showToast('Copy failed', 'cancel');
    });
  } else {
    if (fallbackCopy(text)) { showToast('Logs copied', 'check_circle'); haptic(); }
    else showToast('Copy failed', 'cancel');
  }
}

