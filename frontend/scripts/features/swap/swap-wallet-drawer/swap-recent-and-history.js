

// ── Render Recent Swaps (inline on swap page) ──
function swRenderRecentSwaps() {
  const container = document.getElementById('sw-recent-list');
  if (!container) return;
  const clearBtn = document.getElementById('sw-recent-clear-btn');

  // Filter by cleared timestamp — hides entries cleared by user, does NOT affect Profile history
  var _swClearedTs = 0;
  try { var _c = localStorage.getItem('sw_recent_cleared_ts'); if (_c) _swClearedTs = Number(_c); } catch(e) {}

  const allRecents = (SW && SW.recentSwaps) ? SW.recentSwaps : [];
  const recents = _swClearedTs > 0
    ? allRecents.filter(function(s) { return Number(s.timestamp || s.ts || 0) > _swClearedTs; })
    : allRecents;

  // Show/hide clear button
  if (clearBtn) clearBtn.style.display = recents.length > 0 ? 'flex' : 'none';

  container.innerHTML = '';
  if (!recents.length) {
    container.innerHTML =
      '<div style="text-align:center;padding:20px 16px;font-family:var(--font-mono);font-size:11px;color:var(--text-muted);line-height:1.8;">No recent swaps.</div>';
    return;
  }
  recents.slice().reverse().slice(0, 5).forEach(function(s) {
    var row = document.createElement('div');
    row.className = 'sw-recent-item';
    var hasHash = s.hash && s.hash !== 'null';
    var explorerBase = (function() {
      try {
        var EXPL = window.BR_EXPLORERS || {1:'https://etherscan.io/tx/',8453:'https://basescan.org/tx/',42161:'https://arbiscan.io/tx/',10:'https://optimistic.etherscan.io/tx/',137:'https://polygonscan.com/tx/',56:'https://bscscan.com/tx/'};
        return (EXPL[s.chainId || 1] || 'https://etherscan.io/tx/') + s.hash;
      } catch(e) { return 'https://etherscan.io/tx/' + (s.hash || ''); }
    })();
    // Clickable style if hash available
    if (hasHash) {
      row.style.cursor = 'default';
    }
    var hashShort = hasHash ? (s.hash.slice(0,6) + '....' + s.hash.slice(-4)) : '';
    row.innerHTML =
      '<div style="width:34px;height:34px;border-radius:10px;background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
        '<span class="material-icons-round" style="font-size:17px;color:var(--accent-primary);pointer-events:none;">swap_horiz</span>' +
      '</div>' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
          (s.fromSym || '?') + ' → ' + (s.toSym || '?') +
        '</div>' +
        '<div style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);margin-top:2px;">' +
          (s.dex || 'DEX') + ' · ' + (s.date || '') +
        '</div>' +
        (hasHash ? '<div onclick="window.open(\'' + explorerBase + '\',\'_blank\')" style="font-family:var(--font-mono);font-size:9px;color:var(--neon-cyan);margin-top:3px;cursor:pointer;display:inline-flex;align-items:center;gap:3px;" onmousedown="this.style.opacity=\'.6\'" onmouseup="this.style.opacity=\'1\'" ontouchend="event.preventDefault();event.stopPropagation();window.open(\'' + explorerBase + '\',\'_blank\')">' +
          hashShort + '<span class="material-icons-round" style="font-size:10px;pointer-events:none;">open_in_new</span></div>' : '') +
      '</div>' +
      '<div style="text-align:right;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:2px;">' +
        '<div style="font-size:11px;font-weight:700;color:var(--accent-green);">+' +
          parseFloat(s.toAmt || 0).toFixed(4) + ' ' + (s.toSym || '') +
        '</div>' +
        '<div style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);">' +
          parseFloat(s.fromAmt || 0).toFixed(4) + ' ' + (s.fromSym || '') +
        '</div>' +
      '</div>';
    container.appendChild(row);
  });
}
window.swRenderRecentSwaps = swRenderRecentSwaps;

// ── Clear Recent Swaps from swap page only — SW.recentSwaps & sw_recent untouched ──
window.swClearRecent = function() {
  var now = Date.now();
  try { localStorage.setItem('sw_recent_cleared_ts', String(now)); } catch(e) {}
  var listEl   = document.getElementById('sw-history-list');
  var clearBtn = document.getElementById('sw-recent-clear-btn');
  if (listEl) {
    listEl.style.transition = 'opacity 0.2s ease';
    listEl.style.opacity = '0';
    setTimeout(function() {
      swRenderHistoryList();
      listEl.style.opacity = '1';
    }, 200);
  }
  if (clearBtn) clearBtn.style.display = 'none';
  haptic && haptic();
};


// ── Render sw-history-list (shared by swOpenHistory & swClearRecent) ──
function swRenderHistoryList() {
  var list     = document.getElementById('sw-history-list');
  var clearBtn = document.getElementById('sw-recent-clear-btn');
  if (!list) return;

  // Filter by cleared timestamp — modal only, Profile history untouched
  var _swClearedTs = 0;
  try { var _c = localStorage.getItem('sw_recent_cleared_ts'); if (_c) _swClearedTs = Number(_c); } catch(e) {}
  var allRecents = (SW && SW.recentSwaps) ? SW.recentSwaps : [];
  var recents = _swClearedTs > 0
    ? allRecents.filter(function(s){ return Number(s.timestamp || s.ts || 0) > _swClearedTs; })
    : allRecents;

  // Show/hide clear button
  if (clearBtn) clearBtn.style.display = recents.length > 0 ? 'flex' : 'none';

  list.innerHTML = '';
  if (!recents.length) {
    list.innerHTML = '<div style="text-align:center;padding:32px 16px;font-family:var(--font-mono);font-size:11px;color:var(--text-muted);line-height:1.8;">No recent swaps.</div>';
    return;
  }
  recents.slice().reverse().forEach(function(s) {
    var row = document.createElement('div');
    var hasHash = s.hash && s.hash !== 'null';
    var explorerBase = (function() {
      try {
        var EXPL = window.BR_EXPLORERS || {1:'https://etherscan.io/tx/',8453:'https://basescan.org/tx/',42161:'https://arbiscan.io/tx/',10:'https://optimistic.etherscan.io/tx/',137:'https://polygonscan.com/tx/',56:'https://bscscan.com/tx/'};
        return (EXPL[s.chainId || 1] || 'https://etherscan.io/tx/') + s.hash;
      } catch(e) { return 'https://etherscan.io/tx/' + (s.hash || ''); }
    })();
    row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:12px 14px;background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:14px;transition:border-color 0.15s,transform 0.12s,opacity 0.12s;' + (hasHash ? 'cursor:pointer;' : '');
    if (hasHash) {
      row.addEventListener('click', function() { window.open(explorerBase, '_blank'); });
      row.addEventListener('mouseenter', function(){ this.style.borderColor='rgba(99,102,241,0.3)'; this.style.transform='translateY(-1px)'; });
      row.addEventListener('mouseleave', function(){ this.style.borderColor=''; this.style.transform=''; });
      row.addEventListener('mousedown', function(){ this.style.opacity='.75'; });
      row.addEventListener('mouseup', function(){ this.style.opacity='1'; });
      row.addEventListener('touchstart', function(){ this.style.opacity='.75'; }, {passive:true});
      row.addEventListener('touchend', function(e){ e.preventDefault(); this.style.opacity='1'; window.open(explorerBase,'_blank'); });
    } else {
      row.addEventListener('mouseenter', function(){ this.style.borderColor='rgba(99,102,241,0.2)'; });
      row.addEventListener('mouseleave', function(){ this.style.borderColor=''; });
    }
    row.innerHTML =
      '<div style="width:38px;height:38px;border-radius:11px;background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
        '<span class="material-icons-round" style="font-size:18px;color:var(--accent-primary);pointer-events:none;">swap_horiz</span>' +
      '</div>' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (s.fromSym||'?') + ' → ' + (s.toSym||'?') + '</div>' +
        '<div style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);margin-top:3px;">' + (s.dex||'DEX') + ' · ' + (s.date||'') + '</div>' +
      '</div>' +
      '<div style="text-align:right;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:2px;">' +
        '<div style="font-size:11px;font-weight:700;color:var(--accent-green);">+' + (parseFloat(s.toAmt||0).toFixed(4)) + ' ' + (s.toSym||'') + '</div>' +
        '<div style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);margin-top:2px;">' + (parseFloat(s.fromAmt||0).toFixed(4)) + ' ' + (s.fromSym||'') + '</div>' +
        (hasHash ? '<span class="material-icons-round" style="font-size:11px;color:var(--accent-primary);opacity:0.55;margin-top:1px;pointer-events:none;">open_in_new</span>' : '') +
      '</div>';
    list.appendChild(row);
  });
}

// ── History Modal ──
window.swOpenHistory = function() {
  const modal = document.getElementById('sw-history-modal');
  const sheet = document.getElementById('sw-history-sheet');
  if (!modal) return;

  // Render list with cleared_ts filter + show/hide clear button
  swRenderHistoryList();

  // Open sheet
  if (sheet) {
    sheet.style.maxHeight = '100vh';
    sheet.style.transition = '';
    sheet.style.transform = 'translateY(100%)';
  }
  modal.classList.add('sw-open');
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      if (sheet) {
        sheet.style.transition = 'transform 0.32s cubic-bezier(0.34,1.12,0.64,1)';
        sheet.style.transform = 'translateY(0)';
      }
    });
  });
  if (typeof haptic === 'function') haptic();
};

window.swCloseHistory = function() {
  const modal = document.getElementById('sw-history-modal');
  const sheet = document.getElementById('sw-history-sheet');
  // First remove open class (backdrop fade)
  modal.classList.remove('sw-open');
  // Then animate sheet sliding down in next frame
  requestAnimationFrame(function() {
    if (sheet) {
      sheet.style.transition = 'transform 0.28s cubic-bezier(0.4,0,0.6,1)';
      sheet.style.transform = 'translateY(100%)';
    }
  });
  setTimeout(function() {
    if (sheet) { sheet.style.transform = ''; sheet.style.transition = ''; }
  }, 300);
};