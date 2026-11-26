
(function() {
  // Callback registry — Java calls window.__nxBridgeResolve(callbackId, jsonString)
  var _nxBridgeCallbacks = {};
  var _nxBridgeSeq = 0;
  window.__nxBridgeResolve = function(callbackId, resultJsonString) {
    var pending = _nxBridgeCallbacks[callbackId];
    if (!pending) return;
    delete _nxBridgeCallbacks[callbackId];
    try { pending.resolve(JSON.parse(resultJsonString)); }
    catch (e) { pending.reject(e); }
  };

  function _nxBridgeRawGet(url, headersJson, ms) {
    return new Promise(function(resolve, reject) {
      if (!window.OneBridge || typeof window.OneBridge.httpGet !== 'function') {
        reject(new Error('OneBridge unavailable'));
        return;
      }
      var callbackId = 'nx_' + (++_nxBridgeSeq) + '_' + Date.now();
      var timer = setTimeout(function() {
        delete _nxBridgeCallbacks[callbackId];
        reject(new Error('native bridge timeout'));
      }, ms || 8000);
      _nxBridgeCallbacks[callbackId] = {
        resolve: function(v) { clearTimeout(timer); resolve(v); },
        reject:  function(e) { clearTimeout(timer); reject(e); },
      };
      window.OneBridge.httpGet(url, headersJson || '', callbackId);
    });
  }

  window.nxFetch = async function(url, opts) {
    opts = opts || {};
    var headersJson = opts.headers ? JSON.stringify(opts.headers) : '';
    var wrapper = await _nxBridgeRawGet(url, headersJson, opts.ms || 8000);
    return {
      ok:     !!wrapper.ok,
      status: wrapper.status || 0,
      json:   async function() {
        try { return JSON.parse(wrapper.body); }
        catch (e) { throw new Error('Invalid JSON from ' + url + ': ' + e.message); }
      },
      text:   async function() { return wrapper.body || ''; },
    };
  };

  window.nxBridgeGet = async function(url, ms) {
    var res = await window.nxFetch(url, { ms: ms });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  };

  function _nxBridgeRawPost(url, headersJson, bodyStr, ms) {
    return new Promise(function(resolve, reject) {
      if (!window.OneBridge || typeof window.OneBridge.httpPost !== 'function') {
        reject(new Error('OneBridge.httpPost unavailable'));
        return;
      }
      var callbackId = 'nx_' + (++_nxBridgeSeq) + '_' + Date.now();
      var timer = setTimeout(function() {
        delete _nxBridgeCallbacks[callbackId];
        reject(new Error('native bridge POST timeout'));
      }, ms || 15000);
      _nxBridgeCallbacks[callbackId] = {
        resolve: function(v) { clearTimeout(timer); resolve(v); },
        reject:  function(e) { clearTimeout(timer); reject(e); },
      };
      window.OneBridge.httpPost(url, headersJson || '', bodyStr || '', callbackId);
    });
  }

  window.nxPost = async function(url, opts) {
    opts = opts || {};
    var headersJson = opts.headers ? JSON.stringify(opts.headers) : '';
    var bodyStr = opts.body || '';
    var wrapper = await _nxBridgeRawPost(url, headersJson, bodyStr, opts.ms || 15000);
    return {
      ok:     !!wrapper.ok,
      status: wrapper.status || 0,
      json:   async function() {
        try { return JSON.parse(wrapper.body); }
        catch (e) { throw new Error('Invalid JSON from ' + url + ': ' + e.message); }
      },
      text:   async function() { return wrapper.body || ''; },
    };
  };

  // ── Signed-request chain (native bridge -> direct fetch) ──
  // Proxy/relay chain removed. Native bridge tried first (has device IP,
  // bypasses CORS/geo-block on many exchanges); direct fetch is the fallback.
  window.oneSignedFetch = async function(url, opts) {
    opts = opts || {};
    var method = (opts.method || 'GET').toUpperCase();
    var headers = opts.headers || {};
    var body = opts.body;
    var ms = opts.ms || 15000;

    function wrap(status, bodyText) {
      return {
        ok: status >= 200 && status < 300,
        status: status,
        json: async function() {
          try { return JSON.parse(bodyText); }
          catch (e) { throw new Error('Invalid JSON from ' + url + ': ' + e.message); }
        },
        text: async function() { return bodyText; },
      };
    }

    if (method === 'GET') {
      try {
        var nativeRes = await window.nxFetch(url, { headers: headers, ms: ms });
        if (nativeRes.ok) return nativeRes;
        throw new Error('native HTTP ' + nativeRes.status);
      } catch (nativeErr) {
        console.warn('[oneSignedFetch] native bridge failed: ' + (nativeErr && nativeErr.message));
      }
    }

    var direct = await fetch(url, { method: method, headers: headers, body: body, signal: AbortSignal.timeout(ms) });
    var directTxt = await direct.text();
    return wrap(direct.status, directTxt);
  };
})();
