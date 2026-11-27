
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

  // Fetch with timeout wrapper — default 15s
  window.oneFetch = function(url, options, timeoutMs) {
    timeoutMs = timeoutMs || 15000;
    var controller = new AbortController();
    var timer = setTimeout(function(){ controller.abort(); }, timeoutMs);
    var opts = Object.assign({}, options || {}, { signal: controller.signal });
    return fetch(url, opts).finally(function(){ clearTimeout(timer); });
  };
})();
