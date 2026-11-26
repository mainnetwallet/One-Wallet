
(function(){
  if (typeof location === 'undefined') return;
  if (!location.search || !location.search.includes('__one_sw__')) return;

  // ── SECURITY: SHA-256 hash of the authorised SW_CODE ──
  // Generated at build time from the SW_CODE template literal below.
  // Any tampered value in localStorage will NOT match and will be rejected.
  var ONE_SW_CODE_HASH = '75f0db6c1fba1dc6ba8c4f841439cb45c2769b87effc5826d56778032a222903';

  // Verify code against expected hash using SubtleCrypto, then eval only if it matches.
  // Falls back to the hardcoded minimal SW when no stored code exists or hash fails.
  var FALLBACK_SW_CODE = [
    "'use strict';",
    "self.addEventListener('install', function(e){ self.skipWaiting(); });",
    "self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });",
    "self.addEventListener('sync', function(e){",
    "  e.waitUntil(self.clients.matchAll({type:'window'}).then(function(cls){",
    "    cls.forEach(function(c){ c.postMessage({type:'BG_SYNC',tag:e.tag,ts:Date.now()}); });",
    "  }));",
    "});",
    "self.addEventListener('periodicsync', function(e){",
    "  e.waitUntil(self.clients.matchAll({type:'window'}).then(function(cls){",
    "    cls.forEach(function(c){ c.postMessage({type:'PERIODIC_SYNC',tag:e.tag,ts:Date.now()}); });",
    "  }));",
    "});",
    "self.addEventListener('message', function(e){",
    "  if(e.data && e.data.type==='SKIP_WAITING') self.skipWaiting();",
    "});"
  ].join('\n');

  function _hexDigest(buffer) {
    return Array.from(new Uint8Array(buffer))
      .map(function(b){ return ('00' + b.toString(16)).slice(-2); })
      .join('');
  }

  function _runSW(code) {
    // eslint-disable-next-line no-eval
    eval(code);
  }

  var storedCode = null;
  try { storedCode = localStorage.getItem('__one_sw_code__'); } catch(e) {}

  if (!storedCode) {
    // No stored code — use hardcoded fallback directly (no hash check needed)
    _runSW(FALLBACK_SW_CODE);
    return;
  }

  // Verify stored code hash before eval — rejects any XSS-injected or tampered code
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    var enc = new TextEncoder();
    crypto.subtle.digest('SHA-256', enc.encode(storedCode))
      .then(function(hashBuf) {
        var hex = _hexDigest(hashBuf);
        if (hex === ONE_SW_CODE_HASH) {
          _runSW(storedCode);
        } else {
          // Hash mismatch — stored code was tampered; fall back to safe minimal SW
          // and clear the corrupted entry
          try { localStorage.removeItem('__one_sw_code__'); } catch(e) {}
          _runSW(FALLBACK_SW_CODE);
        }
      })
      .catch(function() {
        // SubtleCrypto unavailable (non-secure context) — use fallback only
        _runSW(FALLBACK_SW_CODE);
      });
  } else {
    // No SubtleCrypto — refuse to eval unverified code; use safe fallback
    _runSW(FALLBACK_SW_CODE);
  }
})();
