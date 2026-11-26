  // ── History sheet ──
  let brHistOpen  = false;
  let brHistFilter = 'all'; // 'all' | 'bridge' | 'swap'

  window.brHistSetFilter = function(f) {
    brHistFilter = f;
    ['all','bridge','swap'].forEach(function(k) {
      var el = document.getElementById('brh-filter-' + k);
      if (el) el.classList.toggle('active', k === f);
    });
    brRenderHistDropdown();
  };

  var _brHistCloseTimer = null;

  window.brToggleHistDropdown = function () {
    if (brHistOpen) {
      brCloseHistory();
    } else {
      brOpenHistory();
    }
    haptic && haptic();
  };

  window.brOpenHistory = function () {
    var modal = document.getElementById('br-history-modal');
    var sheet = document.getElementById('br-history-sheet');
    if (!modal || !sheet) return;
    // Cancel any pending close timer (race condition fix)
    if (_brHistCloseTimer) { clearTimeout(_brHistCloseTimer); _brHistCloseTimer = null; }
    brRenderHistDropdown();
    modal.style.display = 'flex';
    brHistOpen = true;
    // Update clear button visibility — only bridge entries count
    var _brhClearBtn = document.getElementById('brh-clear-btn');
    if (_brhClearBtn) {
      var _brhClearedTsOpen = 0;
      try { var _brhCTsO = localStorage.getItem('brh_cleared_ts'); if (_brhCTsO) _brhClearedTsOpen = Number(_brhCTsO); } catch(e) {}
      var _brhTxs = (typeof loadTxHistory === 'function') ? loadTxHistory().filter(function(t){
        if (t.type !== 'bridge' && t.type !== 'swap') return false;
        if (_brhClearedTsOpen > 0) {
          var _txTsO = t.timestamp || t.ts || 0;
          if (Number(_txTsO) <= _brhClearedTsOpen) return false;
        }
        return true;
      }) : [];
      _brhClearBtn.style.display = _brhTxs.length > 0 ? 'flex' : 'none';
      _brhClearBtn.style.opacity = '1';
    }
    // Clear any inline transform left by swipe-to-close gesture,
    // restore CSS transition so the open animation plays correctly
    sheet.style.transform = '';
    sheet.style.transition = '';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        modal.classList.add('brh-open');
      });
    });
    haptic && haptic();
    // Check & resolve any pending bridge txs in background
    brCheckPendingStatuses();
  };

  window.brCloseHistory = function () {
    var modal = document.getElementById('br-history-modal');
    var sheet = document.getElementById('br-history-sheet');
    if (!modal) return;
    brHistOpen = false;
    modal.classList.remove('brh-open');
    if (sheet) {
      requestAnimationFrame(function () {
        sheet.style.transition = 'transform 0.28s cubic-bezier(0.4,0,0.6,1)';
        sheet.style.transform = 'translateY(100%)';
      });
    }
    _brHistCloseTimer = setTimeout(function () {
      modal.style.display = 'none';
      if (sheet) { sheet.style.transform = ''; sheet.style.transition = ''; }
      _brHistCloseTimer = null;
    }, 300);
  };
