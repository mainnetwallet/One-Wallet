
(function(){
  // HTML sanitizer — token name/symbol থেকে XSS prevent করে
  window.oneSanitize = function(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  // Image URL allow-list for <img src>: http(s) or data:image/* only, '' otherwise.
  // Always pass the result through oneSanitize() before putting it in an attribute.
  window.oneSafeImgUrl = function(u) {
    if (u == null) return '';
    var s = String(u).trim();
    return /^(https?:\/\/|data:image\/(png|jpe?g|gif|webp|avif|svg\+xml)[;,])/i.test(s) ? s : '';
  };

  // Plain-text field from an untrusted source (on-chain name()/symbol(), third-party APIs, dApps).
  // Token/chain text is interpolated into innerHTML and into onclick="..." attributes all over the UI,
  // so the stored value itself must carry no markup, quote, entity or backslash characters.
  window.oneCleanText = function(v, max, fallback) {
    var t = String(v == null ? '' : v)
      .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029<>"'`&\\]/g, '')
      .trim().slice(0, max || 64);
    return t || (fallback == null ? '' : fallback);
  };

  // Makes a saved-token record safe to render: text fields stripped, URLs limited to http(s)/data:image,
  // ids / colours / contract in their expected shape. Other properties are kept as they are.
  window.oneCleanToken = function(t) {
    if (!t || typeof t !== 'object') return t;
    var o = Object.assign({}, t);
    ['name', 'sub', 'symbol', 'icon'].forEach(function(k) {
      if (k in o && o[k] != null) o[k] = window.oneCleanText(o[k], 64, '');
    });
    ['id', 'cgId'].forEach(function(k) {
      if (k in o && o[k] != null) o[k] = String(o[k]).replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 80);
    });
    ['color', 'badge'].forEach(function(k) {
      if (k in o && o[k] != null && !/^#[0-9a-fA-F]{3,8}$/.test(String(o[k]))) o[k] = '#6366f1';
    });
    ['thumb', 'logo', 'logoURI', 'image'].forEach(function(k) {
      if (k in o && o[k] != null) {
        var u = window.oneSafeImgUrl(o[k]);
        o[k] = (u && !/[\s"'<>`\\]/.test(u)) ? u : '';
      }
    });
    if ('contract' in o && o.contract != null && o.contract !== '' && !/^0x[0-9a-fA-F]{40}$/.test(String(o.contract))) o.contract = '';
    return o;
  };

  // Fetch with timeout wrapper — default 15s
  window.oneFetch = function(url, options, timeoutMs) {
    timeoutMs = timeoutMs || 15000;
    var controller = new AbortController();
    var timer = setTimeout(function(){ controller.abort(); }, timeoutMs);
    var opts = Object.assign({}, options || {}, { signal: controller.signal });
    return fetch(url, opts).finally(function(){ clearTimeout(timer); });
  };
})();
