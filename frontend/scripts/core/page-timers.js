
(function(){
  // Page별 timer registry
  window._onePageTimers = {};

  // Page-scoped setInterval — page switch হলে auto-clear
  window.oneInterval = function(page, fn, ms) {
    if (!window._onePageTimers[page]) window._onePageTimers[page] = [];
    var id = setInterval(fn, ms);
    window._onePageTimers[page].push({type:'interval', id:id});
    return id;
  };

  // Page-scoped setTimeout
  window.oneTimeout = function(page, fn, ms) {
    if (!window._onePageTimers[page]) window._onePageTimers[page] = [];
    var id = setTimeout(fn, ms);
    window._onePageTimers[page].push({type:'timeout', id:id});
    return id;
  };

  // Page ছাড়ার সময় সেই page-এর সব timer clear করো
  window.oneClearPageTimers = function(page) {
    var timers = window._onePageTimers[page];
    if (!timers) return;
    timers.forEach(function(t) {
      if (t.type === 'interval') clearInterval(t.id);
      else clearTimeout(t.id);
    });
    window._onePageTimers[page] = [];
  };
})();
