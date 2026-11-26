
(function(){
  var MAX_LOGS = 500;
  window._nxConsoleLogs = [];
  window._nxConsoleEnabled = false;
  try { window._nxConsoleEnabled = localStorage.getItem('one_console_log_enabled') === 'on'; } catch(e) {}

  function _nxStringify(a) {
    if (a instanceof Error) return (a.message || String(a)) + (a.stack ? '\n' + a.stack : '');
    if (typeof a === 'object' && a !== null) { try { return JSON.stringify(a); } catch(e) { return String(a); } }
    return String(a);
  }
  function _nxPush(level, args) {
    if (!window._nxConsoleEnabled) return;
    try {
      var msg = Array.prototype.map.call(args, _nxStringify).join(' ');
      window._nxConsoleLogs.push({ t: Date.now(), level: level, msg: msg });
      if (window._nxConsoleLogs.length > MAX_LOGS) window._nxConsoleLogs.shift();
      if (typeof window._nxRenderConsoleLogPanel === 'function') window._nxRenderConsoleLogPanel(true);
    } catch(e) {}
  }
  ['log','warn','error','info','debug'].forEach(function(level){
    var orig = (console[level] || console.log || function(){}).bind(console);
    console[level] = function(){
      _nxPush(level, arguments);
      try { orig.apply(console, arguments); } catch(e) {}
    };
  });
  window.addEventListener('error', function(ev){
    _nxPush('error', [(ev.message || 'Error') + ' @ ' + (ev.filename || '') + ':' + (ev.lineno || 0) + ':' + (ev.colno || 0)]);
  });
  window.addEventListener('unhandledrejection', function(ev){
    var r = ev && ev.reason;
    _nxPush('error', ['Unhandled promise rejection: ' + (r && r.message ? r.message : String(r))]);
  });
})();
