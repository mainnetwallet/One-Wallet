// ── Console Log Panel ──
// Markup: html-src/partials/console-log-panel.html · styles: styles/features/home/console-log-panel.css
// Data:   window._nxConsoleLogs [{ t, level, msg }] (newest last) filled by scripts/core/console/console-capture.js
var _nxCl = {
  filter: 'all',          // all | error | warn | info | log
  query: '',              // lower-case search text
  raf: 0,
  qTimer: 0,
  chipsHtml: '',
  open: (typeof WeakSet === 'function') ? new WeakSet() : null,  // expanded entries (keyed by the entry object)
  view: []                // what is on screen: [{ key, long }], index = data-i
};
var _NX_FILTERS = [
  { id: 'all',   label: 'All',      color: 'var(--accent-primary)' },
  { id: 'error', label: 'Errors',   color: '#f6465d' },
  { id: 'warn',  label: 'Warnings', color: '#f5a623' },
  { id: 'info',  label: 'Info',     color: '#06b6d4' },
  { id: 'log',   label: 'Log',      color: 'var(--text-secondary)' }
];

function openConsoleLogPanel() {
  var m = document.getElementById('nx-console-modal');
  if (m) m.style.display = 'flex';
  renderConsoleLogPanel();
  haptic();
}
function closeConsoleLogPanel() {
  var m = document.getElementById('nx-console-modal');
  if (m) m.style.display = 'none';
  var q = document.getElementById('nx-console-search');
  if (q) q.blur();
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
// error / warn / info keep their own filter, log + debug share "Log"
function _nxBucket(level) { return (level === 'error' || level === 'warn' || level === 'info') ? level : 'log'; }

function _nxTime(t) {
  var d = new Date(t);
  function p(n, len) { n = String(n); while (n.length < (len || 2)) n = '0' + n; return n; }
  return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) + '.' + p(d.getMilliseconds(), 3);
}

// message with the search text highlighted (matches are found on the raw text, then each part is escaped)
function _nxMsgHtml(msg, q) {
  if (!q) return _nxEscapeHtml(msg);
  var low = msg.toLowerCase(), out = '', i = 0, at;
  while ((at = low.indexOf(q, i)) !== -1) {
    out += _nxEscapeHtml(msg.slice(i, at)) + '<mark>' + _nxEscapeHtml(msg.slice(at, at + q.length)) + '</mark>';
    i = at + q.length;
  }
  return out + _nxEscapeHtml(msg.slice(i));
}

// logs that pass the current level filter + search (oldest first)
function _nxVisibleLogs() {
  var logs = window._nxConsoleLogs || [];
  if (_nxCl.filter === 'all' && !_nxCl.query) return logs;
  return logs.filter(function(e) {
    if (_nxCl.filter !== 'all' && _nxBucket(e.level) !== _nxCl.filter) return false;
    if (_nxCl.query && String(e.msg).toLowerCase().indexOf(_nxCl.query) === -1) return false;
    return true;
  });
}

// capture strip + both toggles (this panel and the Settings row)
function _nxSyncStatus() {
  var on = !!window._nxConsoleEnabled;
  var t = document.getElementById('nx-console-toggle');
  if (t) t.classList.toggle('on', on);
  var cap = document.getElementById('nx-console-cap');
  if (cap) cap.classList.toggle('on', on);
  var ct = document.getElementById('nx-console-cap-t');
  var cs = document.getElementById('nx-console-cap-s');
  if (ct) ct.textContent = on ? 'Capturing logs' : 'Capture is off';
  if (cs) cs.textContent = on ? 'Recording console output and errors' : 'Nothing is recorded while off';
}

function _nxEmptyHtml(icon, title, sub, btn) {
  return '<div class="clp-empty"><div class="clp-empty-ic"><span class="material-icons-round">' + icon + '</span></div>'
    + '<div class="clp-empty-t">' + title + '</div><div class="clp-empty-s">' + sub + '</div>'
    + (btn ? '<button type="button" class="clp-empty-b" onclick="resetConsoleLogFilters()">' + btn + '</button>' : '')
    + '</div>';
}

function _nxRenderNow() {
  var list = document.getElementById('nx-console-list');
  var sub  = document.getElementById('nx-console-count-sub');
  var chipsEl = document.getElementById('nx-console-chips');
  var logs = window._nxConsoleLogs || [];
  _nxSyncStatus();

  // counts per level (whole buffer, not affected by search)
  var counts = { all: logs.length, error: 0, warn: 0, info: 0, log: 0 };
  logs.forEach(function(e) { counts[_nxBucket(e.level)]++; });

  if (chipsEl) {
    var ch = _NX_FILTERS.map(function(f) {
      var cls = 'clp-chip' + (_nxCl.filter === f.id ? ' a' : '') + (counts[f.id] ? '' : ' zero');
      return '<button type="button" class="' + cls + '" style="--c:' + f.color + '" onclick="setConsoleLogFilter(\'' + f.id + '\')">'
        + '<i></i>' + f.label + '<b>' + counts[f.id] + '</b></button>';
    }).join('');
    if (ch !== _nxCl.chipsHtml) { chipsEl.innerHTML = ch; _nxCl.chipsHtml = ch; }
  }

  var visible = _nxVisibleLogs();
  var filtered = _nxCl.filter !== 'all' || !!_nxCl.query;
  if (sub) {
    sub.textContent = filtered
      ? visible.length + ' of ' + logs.length + ' entries'
      : logs.length + ' ' + (logs.length === 1 ? 'entry' : 'entries');
  }
  if (!list) return;

  _nxCl.view = [];
  if (!logs.length) {
    list.innerHTML = window._nxConsoleEnabled
      ? _nxEmptyHtml('terminal', 'Listening', 'Logs show up here as soon as the app prints something.')
      : _nxEmptyHtml('terminal', 'Nothing recorded yet', 'Turn on capture above, then use the app. Logs and errors will be listed here.');
    return;
  }
  if (!visible.length) {
    list.innerHTML = _nxEmptyHtml('search_off', 'No matches', 'No entries match this filter or search.', 'Clear filters');
    return;
  }

  // newest first; identical neighbours collapse into one row with a ×N badge
  var groups = [];
  for (var i = visible.length - 1; i >= 0; i--) {
    var e = visible[i], g = groups[groups.length - 1];
    if (g && g.level === e.level && g.msg === e.msg) { g.n++; g.key = e; }
    else groups.push({ level: e.level, msg: String(e.msg), t: e.t, n: 1, key: e });
  }

  var prevTop = list.scrollTop, prevH = list.scrollHeight;
  list.innerHTML = groups.map(function(g, idx) {
    var long = g.msg.length > 200 || (g.msg.match(/\n/g) || []).length >= 4;
    var isOpen = long && _nxCl.open && _nxCl.open.has(g.key);
    _nxCl.view[idx] = { key: g.key, long: long };
    return '<div class="clp-e lv-' + _nxBucket(g.level) + (long ? ' can-open' : '') + (isOpen ? ' open' : '') + '" data-i="' + idx + '">'
      + '<div class="clp-meta"><span>' + _nxTime(g.t) + '</span><span class="clp-lv">' + _nxEscapeHtml(g.level) + '</span>'
      + (g.n > 1 ? '<span class="clp-rep">×' + g.n + '</span>' : '')
      + (long ? '<span class="material-icons-round clp-more">expand_more</span>' : '')
      + '</div><div class="clp-msg">' + _nxMsgHtml(g.msg, _nxCl.query) + '</div></div>';
  }).join('');
  // new entries land on top: when the user has scrolled down to read, keep what they are reading in place
  if (prevTop > 40) list.scrollTop = prevTop + (list.scrollHeight - prevH);
}

// Public: new logs call renderConsoleLogPanel(true) → batched to one render per frame while the panel is open
function renderConsoleLogPanel(onlyIfOpen) {
  if (onlyIfOpen) {
    var modal = document.getElementById('nx-console-modal');
    if (!modal || modal.style.display !== 'flex') return;
    if (_nxCl.raf) return;
    var run = function() { _nxCl.raf = 0; _nxRenderNow(); };
    _nxCl.raf = (typeof requestAnimationFrame === 'function') ? requestAnimationFrame(run) : setTimeout(run, 16);
    return;
  }
  _nxRenderNow();
}
window._nxRenderConsoleLogPanel = renderConsoleLogPanel;

function setConsoleLogFilter(id) {
  _nxCl.filter = id;
  haptic();
  _nxRenderNow();
  var list = document.getElementById('nx-console-list');
  if (list) list.scrollTop = 0;
}

function setConsoleLogQuery(v, immediate) {
  var q = String(v || '').trim().toLowerCase();
  var input = document.getElementById('nx-console-search');
  if (immediate && input) input.value = '';
  var box = input && input.closest('.clp-search');
  if (box) box.classList.toggle('has-q', !!(input && input.value));
  clearTimeout(_nxCl.qTimer);
  var apply = function() {
    _nxCl.query = q;
    _nxRenderNow();
    var list = document.getElementById('nx-console-list');
    if (list) list.scrollTop = 0;
  };
  if (immediate) apply(); else _nxCl.qTimer = setTimeout(apply, 120);
}

function resetConsoleLogFilters() {
  _nxCl.filter = 'all';
  setConsoleLogQuery('', true);
}

// tap a long entry to expand / collapse it (ignored while the user is selecting text)
function consoleLogListTap(ev) {
  var row = ev.target && ev.target.closest ? ev.target.closest('.clp-e') : null;
  if (!row || !row.classList.contains('can-open')) return;
  try { if (String(window.getSelection && window.getSelection()).length) return; } catch (e) {}
  var item = _nxCl.view[+row.getAttribute('data-i')];
  if (!item || !_nxCl.open) return;
  if (_nxCl.open.has(item.key)) _nxCl.open.delete(item.key); else _nxCl.open.add(item.key);
  row.classList.toggle('open');
}

function toggleConsoleLogCapture() {
  window._nxConsoleEnabled = !window._nxConsoleEnabled;
  try { localStorage.setItem('one_console_log_enabled', window._nxConsoleEnabled ? 'on' : 'off'); } catch(e) {}
  var mt = document.getElementById('console-log-menu-toggle');
  if (mt) mt.classList.toggle('on', !!window._nxConsoleEnabled);
  var subEl = document.getElementById('console-log-menu-sub');
  if (subEl) subEl.textContent = window._nxConsoleEnabled ? 'Capturing — tap to view' : 'Off — tap to view & enable';
  _nxRenderNow();
  showToast(window._nxConsoleEnabled ? 'Console logging ON' : 'Console logging OFF', window._nxConsoleEnabled ? 'check_circle' : 'cancel');
  haptic();
}

function clearConsoleLogs() {
  window._nxConsoleLogs = [];
  if (typeof WeakSet === 'function') _nxCl.open = new WeakSet();
  _nxRenderNow();
  showToast('Logs cleared', 'check_circle');
  haptic();
}

// copies what is on screen (everything, unless a filter / search is active), oldest first
function copyConsoleLogs() {
  var logs = _nxVisibleLogs();
  if (!logs.length) { showToast('No logs to copy', 'info'); return; }
  var text = logs.map(function(e) {
    return new Date(e.t).toISOString() + ' [' + e.level.toUpperCase() + '] ' + e.msg;
  }).join('\n');
  var done = function() { showToast(logs.length + (logs.length === 1 ? ' log copied' : ' logs copied'), 'check_circle'); haptic(); };
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
    navigator.clipboard.writeText(text).then(done).catch(function() {
      if (fallbackCopy(text)) done(); else showToast('Copy failed', 'cancel');
    });
  } else {
    if (fallbackCopy(text)) done(); else showToast('Copy failed', 'cancel');
  }
}
