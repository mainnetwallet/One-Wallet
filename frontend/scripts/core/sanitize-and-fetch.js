
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

  // Fetch with timeout wrapper — default 15s
  window.oneFetch = function(url, options, timeoutMs) {
    timeoutMs = timeoutMs || 15000;
    var controller = new AbortController();
    var timer = setTimeout(function(){ controller.abort(); }, timeoutMs);
    var opts = Object.assign({}, options || {}, { signal: controller.signal });
    return fetch(url, opts).finally(function(){ clearTimeout(timer); });
  };
})();
