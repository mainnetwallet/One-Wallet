
// ── RIPPLE ──
function rippleEffect(el, e) {
  const r = document.createElement('span');
  r.className = 'ripple';
  const rect = el.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  r.style.width = r.style.height = size + 'px';
  const x = (e?.clientX ?? rect.left + rect.width/2) - rect.left - size/2;
  const y = (e?.clientY ?? rect.top + rect.height/2) - rect.top - size/2;
  r.style.left = x + 'px'; r.style.top = y + 'px';
  r.style.zIndex = '0';
  el.style.position = el.style.position || 'relative';
  el.style.overflow = el.style.overflow || 'hidden';
  el.appendChild(r);
  setTimeout(() => r.remove(), 600);
}

// ── HAPTIC ──
let _hapticUnlocked = false;
(function _hapticUnlock() {
  const _unlock = () => { _hapticUnlocked = true; };
  ['touchstart','mousedown','pointerdown','keydown'].forEach(e => document.addEventListener(e, _unlock, {once:true, passive:true}));
})();

  /* ── Profile Browser Search Bar ── */

  // ── Browser History (localStorage) ──
  var _PROF_HIST_KEY = 'one_browser_history';
  var _PROF_HIST_MAX = 30;

  function profHistoryAdd(url) {
    try {
      var hist = profHistoryGet();
      // Remove duplicate
      hist = hist.filter(function(h){ return h.url !== url; });
      var entry = {url: url, title: _extractHostname(url), ts: Date.now()};
      hist.unshift(entry);
      if (hist.length > _PROF_HIST_MAX) hist = hist.slice(0, _PROF_HIST_MAX);
      localStorage.setItem(_PROF_HIST_KEY, JSON.stringify(hist));
    } catch(e) {}
  }

  function profHistoryGet() {
    try { return JSON.parse(localStorage.getItem(_PROF_HIST_KEY) || '[]'); } catch(e) { return []; }
  }

  function profClearBrowserHistory() {
    try { localStorage.removeItem(_PROF_HIST_KEY); } catch(e) {}
  }

  function _extractHostname(url) {
    try { return new URL(url.startsWith('http') ? url : 'https://'+url).hostname.replace(/^www\./,''); } catch(e) { return url; }
  }

  function _timeAgo(ts) {
    var diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff/60) + 'm ago';
    if (diff < 86400) return Math.floor(diff/3600) + 'h ago';
    return Math.floor(diff/86400) + 'd ago';
  }

  // ── New Tab ──
  function profNewTab() {
    try { haptic && haptic(); } catch(_) {}
    // Show browser tab switcher (or open browser if not running)
    if (window.OneAndroid && typeof OneAndroid.openBrowserTabSwitcher === 'function') {
      OneAndroid.openBrowserTabSwitcher();
    } else {
      var inp = document.getElementById('prof-search-input');
      if (inp) { inp.value = ''; inp.focus(); }
      profSearchHint('');
    }
  }

  // ── 3-dot menu toggle ──
  function profToggle3DotMenu(e) {
    if (e) { e.stopPropagation(); }
    try { haptic && haptic(); } catch(_) {}
    var menu = document.getElementById('prof-3dot-menu');
    if (!menu) return;
    if (menu.style.display === 'none' || !menu.style.display) {
      _prof3DotRenderHistory();
      menu.style.display = 'block';
      // Animate in
      menu.style.opacity = '0';
      menu.style.transform = 'scale(0.92) translateY(-8px)';
      menu.style.transition = 'opacity 0.18s, transform 0.18s';
      requestAnimationFrame(function(){
        menu.style.opacity = '1';
        menu.style.transform = 'scale(1) translateY(0)';
      });
      // Close on outside tap
      setTimeout(function(){
        document.addEventListener('click', _profClose3DotOutside, {once:true, capture:true});
        document.addEventListener('touchstart', _profClose3DotOutside, {once:true, capture:true});
      }, 50);
    } else {
      profClose3DotMenu();
    }
  }

  function _profClose3DotOutside(e) {
    var menu = document.getElementById('prof-3dot-menu');
    var btn  = document.getElementById('prof-sb-more');
    if (menu && btn) {
      if (!menu.contains(e.target) && !btn.contains(e.target)) {
        profClose3DotMenu();
      }
    }
  }

  function profClose3DotMenu() {
    var menu = document.getElementById('prof-3dot-menu');
    if (!menu) return;
    menu.style.opacity = '0';
    menu.style.transform = 'scale(0.92) translateY(-8px)';
    setTimeout(function(){ menu.style.display = 'none'; }, 160);
  }

  function _prof3DotRenderHistory() {
    var list = document.getElementById('prof-3dot-history-list');
    if (!list) return;
    var hist = profHistoryGet();
    if (!hist.length) {
      list.innerHTML = '<div style="padding:8px 14px 10px;font-size:12px;color:var(--text-muted);font-family:var(--font-sans);">No history yet</div>';
      return;
    }
    var frag = document.createDocumentFragment();
    var items = hist.slice(0, 12);
    for (var i = 0; i < items.length; i++) {
      var h = items[i];
      var host = _extractHostname(h.url);
      var ago  = _timeAgo(h.ts);
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:9px 14px;cursor:pointer;transition:background 0.12s;';
      (function(url) {
        row.addEventListener('click', function(){ profBrowserOpen(url); profClose3DotMenu(); });
        row.addEventListener('touchstart', function(){ row.style.background='rgba(99,102,241,0.10)'; }, {passive:true});
        row.addEventListener('touchend',   function(){ row.style.background=''; }, {passive:true});
        row.addEventListener('mousedown',  function(){ row.style.background='rgba(99,102,241,0.10)'; });
        row.addEventListener('mouseup',    function(){ row.style.background=''; });
      })(h.url);
      var img = document.createElement('img');
      img.src = 'https://www.google.com/s2/favicons?sz=16&domain=' + encodeURIComponent(h.url);
      img.width = 14; img.height = 14;
      img.style.cssText = 'border-radius:3px;flex-shrink:0;';
      img.onerror = function(){ this.style.display='none'; };
      var info = document.createElement('div');
      info.style.cssText = 'flex:1;min-width:0;';
      var title = document.createElement('div');
      title.style.cssText = 'font-size:12px;color:var(--text-primary,#fff);font-family:var(--font-sans);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      title.textContent = host;
      var time = document.createElement('div');
      time.style.cssText = 'font-size:10px;color:var(--text-muted,#888);font-family:var(--font-mono);';
      time.textContent = ago;
      info.appendChild(title);
      info.appendChild(time);
      row.appendChild(img);
      row.appendChild(info);
      frag.appendChild(row);
    }
    list.innerHTML = '';
    list.appendChild(frag);
  }

  /* ── Profile Browser Search Bar ── */
  function profSearchGo() {
    const inp = document.getElementById('prof-search-input');
    if (!inp) return;
    let val = inp.value.trim();
    if (!val) return;
    let url;
    // Detect URL vs search query
    if (/^https?:\/\//i.test(val)) {
      url = val;
    } else if (!val.includes(' ') && /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}([\/?#].*)?$/.test(val)) {
      url = 'https://' + val;
    } else {
      url = 'https://www.google.com/search?q=' + encodeURIComponent(val);
    }
    inp.blur();
    // Open in-page overlay browser (nav always visible)
    profBrowserOpen(url);
    // Clear search box after navigation
    profSearchClear();
  }

  // ── In-page browser overlay controls ──
  // ── In-App Browser via OneAndroid (replaces iframe overlay) ──
  // _profBrowserLastUrl — reload support
  var _profBrowserLastUrl = '';

  function profBrowserOpen(url) {
    _profBrowserLastUrl = url;
    // Save to history
    try { profHistoryAdd(url); } catch(_) {}
    // Track active browser host for Web3 modal display
    try { var _u = new URL(url.startsWith('http') ? url : 'https://'+url); window._oneActiveBrowserHost = _u.hostname; } catch(_) {}
    if (window.OneAndroid && typeof OneAndroid.openInAppBrowser === 'function') {
      OneAndroid.openInAppBrowser(url, '');
    } else {
      // Fallback: desktop browser / dev mode
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  // Kept as no-ops so any leftover HTML onclick= references don't throw errors
  function profBrowserClose()   {}
  function profBrowserReload()  {
    if (_profBrowserLastUrl) profBrowserOpen(_profBrowserLastUrl);
  }
  function profBrowserCopyUrl() {
    if (!_profBrowserLastUrl) return;
    try {
      if (window.OneAndroid && typeof OneAndroid.copyToClipboard === 'function') {
        OneAndroid.copyToClipboard(_profBrowserLastUrl);
      } else {
        navigator.clipboard.writeText(_profBrowserLastUrl);
      }
    } catch(e) {}
  }
  function profSearchHint(val) {
    const clearBtn = document.getElementById('prof-sb-clear');
    const icon = document.getElementById('prof-sb-icon');
    const goBtn = document.getElementById('prof-sb-go');
    const pasteBtn = document.getElementById('prof-sb-paste');
    if (clearBtn) clearBtn.style.display = val ? 'block' : 'none';
    if (goBtn) goBtn.style.display = val ? 'inline-block' : 'none';
    if (pasteBtn) pasteBtn.style.display = val ? 'none' : 'inline-block';
    if (icon) {
      if (/^https?:\/\//i.test(val) || (!val.includes(' ') && /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}/.test(val))) {
        icon.textContent = 'language';
        icon.style.color = 'var(--neon-purple,#6366f1)';
      } else if (val) {
        icon.textContent = 'search';
        icon.style.color = 'var(--accent-amber,#f59e0b)';
      } else {
        icon.textContent = 'search';
        icon.style.color = 'var(--text-muted,#888)';
      }
    }
  }
  function profSearchPaste() {
    const inp = document.getElementById('prof-search-input');
    if (!inp) return;
    // Use Clipboard API if available
    if (navigator.clipboard && navigator.clipboard.readText) {
      navigator.clipboard.readText().then(function(text) {
        text = text.trim();
        if (!text) {
          _profPasteToast('Clipboard is empty');
          return;
        }
        inp.value = text;
        profSearchHint(text);
        profSearchGo();
      }).catch(function() {
        // Clipboard API denied — try Android bridge
        _profPasteFallback(inp);
      });
    } else {
      _profPasteFallback(inp);
    }
  }
  function _profPasteFallback(inp) {
    // Android: read clipboard via OneAndroid bridge if available
    if (window.OneAndroid && typeof OneAndroid.getClipboardText === 'function') {
      var text = OneAndroid.getClipboardText();
      if (text && text.trim()) {
        inp.value = text.trim();
        profSearchHint(inp.value);
        profSearchGo();
      } else {
        _profPasteToast('Clipboard is empty');
      }
    } else {
      _profPasteToast('Clipboard is empty');
    }
  }
  function _profPasteToast(msg) {
    var old = document.getElementById('_profPasteToast');
    if (old) old.remove();
    var t = document.createElement('div');
    t.id = '_profPasteToast';
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);' +
      'background:rgba(30,30,50,0.95);color:#e5e7eb;font-size:13px;font-weight:600;' +
      'padding:10px 20px;border-radius:20px;z-index:9999;pointer-events:none;' +
      'border:1px solid rgba(255,255,255,0.1);box-shadow:0 4px 20px rgba(0,0,0,0.4);';
    document.body.appendChild(t);
    setTimeout(function() { if (t.parentNode) t.remove(); }, 2000);
  }

  function profSearchClear() {
    const inp = document.getElementById('prof-search-input');
    const clearBtn = document.getElementById('prof-sb-clear');
    const icon = document.getElementById('prof-sb-icon');
    const goBtn = document.getElementById('prof-sb-go');
    const pasteBtn = document.getElementById('prof-sb-paste');
    if (inp) inp.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
    if (goBtn) goBtn.style.display = 'none';
    if (pasteBtn) pasteBtn.style.display = 'inline-block';
    if (icon) { icon.textContent = 'search'; icon.style.color = 'var(--text-muted,#888)'; }
    if (inp) inp.focus();
  }

  // ── Fix: Restore nav + search bar when returning from in-app browser ──
  // When user comes back from InAppBrowserActivity, visibilitychange fires.
  // We blur any focused profile input so the keyboard dismisses and the
  // bottom nav + sticky search bar are fully visible again.
  (function _profRestoreOnResume() {
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState !== 'visible') return;
      try {
        // If profile page is active, dismiss keyboard and scroll to top
        if (window.currentPage === 'profile') {
          var inp = document.getElementById('prof-search-input');
          if (inp && document.activeElement === inp) inp.blur();
          // Also blur any other focused element inside profile page
          var profPage = document.getElementById('page-profile');
          if (profPage) {
            var focused = profPage.querySelector(':focus');
            if (focused) focused.blur();
            // Scroll profile page back to top so sticky search bar is visible
            setTimeout(function() { profPage.scrollTop = 0; }, 50);
          }
        }
      } catch(e) {}
    });
  })();

function haptic() {
  try { if (localStorage.getItem('one_haptic') === 'off') return; } catch(e) {}
  if (_hapticUnlocked && navigator.vibrate) navigator.vibrate(8);
}

// ══════════════════════════════════════════════════════════════
//  FIX: Profile page — keyboard উঠলে nav bar ও search bar
//       স্ক্রিনে থাকে। visualViewport API দিয়ে keyboard offset
//       detect করে bottom-nav ও prof-search-bar adjust করা হয়।
// ══════════════════════════════════════════════════════════════
(function _fixProfileKeyboardNav() {
  if (!window.visualViewport) return; // older browsers — no-op

  var _lastOffset = 0;

  function _applyOffset(kbOffset) {
    // bottom-nav কে keyboard-এর উপরে রাখো
    var nav = document.querySelector('.bottom-nav');
    if (nav) {
      nav.style.transform = kbOffset > 0
        ? 'translateX(-50%) translateY(-' + kbOffset + 'px)'
        : 'translateX(-50%)';
      nav.style.transition = kbOffset > 0 ? 'transform 0.18s ease' : 'transform 0.22s ease';
    }

    // prof-search-bar — শুধু profile page active থাকলে adjust করো
    var sb = document.getElementById('prof-search-bar');
    if (sb && window.currentPage === 'profile') {
      // sticky top:0 already handles position; just ensure it's not clipped
      // when keyboard is open, keep it in view by adjusting top if needed
      sb.style.top = '0px'; // always stick to top — search bar stays visible
    }
  }

  function _onViewportChange() {
    try {
      var vv = window.visualViewport;
      // keyboard height = window.innerHeight - vv.height (approximately)
      var kbHeight = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      // Only act when profile page keyboard is open (or any page nav overlap)
      if (Math.abs(kbHeight - _lastOffset) < 4) return; // debounce small jitter
      _lastOffset = kbHeight;
      _applyOffset(kbHeight);
    } catch(e) {}
  }

  window.visualViewport.addEventListener('resize', _onViewportChange);
  window.visualViewport.addEventListener('scroll', _onViewportChange);
})();

  // ── Overlay back-button support (Android hardware back) ──
  // OneAndroid bridge থেকে onBackPressed call হলে overlay close করে
  var _origOneBack = window.oneOnBackPressed;
  window.oneOnBackPressed = function() {
    var overlay = document.getElementById('prof-browser-overlay');
    if (overlay && overlay.style.display !== 'none') {
      profBrowserClose();
      return true; // consumed
    }
    if (typeof _origOneBack === 'function') return _origOneBack();
    return false;
  };

