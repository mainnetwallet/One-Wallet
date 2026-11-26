// RPC manager: endpoint rotation helpers, status badge, RPC log and log viewer
// Part of the RPC manager module (split by topic; no logic change).
(function (__NX) {
  __NX._thDispatchRpcInput = _thDispatchRpcInput;
  __NX._thNormalizeRpc = _thNormalizeRpc;
  __NX._thDedupeRpcs = _thDedupeRpcs;
  __NX._thDepri = _thDepri;
  __NX._thAdvanceRpc = _thAdvanceRpc;
  __NX._thGetOrCreateBadge = _thGetOrCreateBadge;
  __NX._escHtml = _escHtml;
  __NX._thLogRpc = _thLogRpc;

    // Section → { rpcId, label, callbacks }
    // ── Helper: fire an 'input' event on a hidden RPC field so any listener
    //    on that field (e.g. updateRpcProvider) picks up the new value. ──
    function _thDispatchRpcInput(rpcId) {
      try {
        var el = document.getElementById(rpcId);
        if (el) el.dispatchEvent(new Event('input', { bubbles: true }));
      } catch(_) {}
    }

    // ══════════════════════════════════════════════════════════════════════
    // ▶ TRANSFER HUB — SMART MULTI-RPC FALLBACK ENGINE v2.0
    //
    //   • Per-page RPC state: each page's hidden rpcUrl input carries
    //     data-rpcs (JSON array) + data-chainid + data-rpc-index (cursor)
    //   • thGetRpcList(rpcInputId)      → string[]  full ordered list
    //   • thGetActiveRpc(rpcInputId)    → string     current RPC url
    //   • thWithFallback(rpcInputId, fn, timeoutMs) → Promise
    //       Tries each RPC in order. On timeout/rate-limit/error it
    //       advances to next, updates the status badge, retries.
    //       Prevents infinite loops: max 1 full cycle per call.
    //   • thSetRpcStatus(rpcInputId, state, url)
    //       state: 'connected' | 'switching' | 'failed'
    //   • Status badge is rendered lazily per page, shown in each
    //     th-section-header next to the chain button.
    // ══════════════════════════════════════════════════════════════════════

    // ── Per-page health index: rpcInputId → current active index ──
    var _thRpcIdx = {}; __NX._thRpcIdx = _thRpcIdx;   // rpcInputId → number (which RPC we're on)
    var _thRpc429 = {}; __NX._thRpc429 = _thRpc429;   // rpcUrl     → timestamp banned until
    // ── Manual pin: tracks RPCs explicitly chosen by user via Status Log modal ──
    // Set by _thSelectRpcManually, cleared by chain change (thResetRpcIdx).
    // rpcSetDefault (Step 6) checks this before overriding the active RPC.
    var _thManualPin = {}; __NX._thManualPin = _thManualPin; // rpcInputId → normalized rpcUrl string (or null)

    // ── Normalize RPC URL: strip trailing slash for deduplication ──
    function _thNormalizeRpc(url) {
      return String(url || '').trim().replace(/\/+$/, '');
    }

    // ── Deduplicate an RPC list by normalized URL (preserves first occurrence) ──
    function _thDedupeRpcs(arr) {
      var seen = {};
      return arr.filter(function(r) {
        var key = _thNormalizeRpc(r).toLowerCase();
        if (!key || seen[key]) return false;
        seen[key] = true;
        return true;
      });
    }

    // Keyless Ankr endpoints need an API key now — always try them last
    function _thDepri(arr) {
      return (typeof _rpcDeprioritize === 'function') ? _rpcDeprioritize(arr) : arr;
    }

    // ── Advance to next RPC (internal) ──
    function _thAdvanceRpc(rpcInputId) {
      var list = window.thGetRpcList(rpcInputId);
      if (!list.length) return;
      var cur = _thRpcIdx[rpcInputId] || 0;
      _thRpcIdx[rpcInputId] = (cur + 1) % list.length;
    }

    var _TH_BADGE_STATES = {
      connected: { dot:'🟢', bg:'rgba(16,185,129,0.15)', border:'rgba(16,185,129,0.35)', color:'#6ee7b7', label:'RPC' },
      switching:  { dot:'🟡', bg:'rgba(245,158,11,0.15)', border:'rgba(245,158,11,0.35)', color:'#fcd34d', label:'RPC' },
      failed:     { dot:'🔴', bg:'rgba(244,63,94,0.15)',  border:'rgba(244,63,94,0.35)',  color:'#fda4af', label:'RPC' },
      idle:       { dot:'⚪', bg:'rgba(255,255,255,0.05)', border:'rgba(255,255,255,0.1)', color:'#8b8ba7', label:'RPC' },
    }; __NX._TH_BADGE_STATES = _TH_BADGE_STATES;

    function _thGetOrCreateBadge(rpcInputId) {
      var badgeId = 'th-rpc-badge-' + rpcInputId;

      // ── Find target header first ──────────────────────────────────
      var rpcEl = document.getElementById(rpcInputId);
      if (!rpcEl) return null;

      var parent = rpcEl.closest
        ? rpcEl.closest('[id$="UI"],[id^="mainDashboard"],[id$="Section"],[id^="section"],.section,[id^="balanceCheckUI"],[id^="selfTransfer"],[id^="tokenApprovalUI"],[id^="w2wUI"],[id^="withdrawUI"]')
        : null;
      var hdr = parent ? parent.querySelector('.th-section-header') : null;
      if (!hdr) {
        var container = rpcEl.parentNode;
        for (var i = 0; i < 6 && container; i++) {
          hdr = container.querySelector('.th-section-header');
          if (hdr) break;
          container = container.parentNode;
        }
      }

      // ── Deduplication: remove any orphan badges with this id ──────
      // On chain change the badge may have been appended to a header
      // that is now in a different DOM position, leaving stale clones.
      var existing = document.getElementById(badgeId);
      if (existing) {
        // If it is already inside the correct header, reuse it directly
        if (hdr && hdr.contains(existing)) return existing;
        // Otherwise remove the stale one so we inject a fresh one in
        // the right place below
        existing.parentNode && existing.parentNode.removeChild(existing);
      }

      // ── Also purge any extra badges without an id that ended up in hdr ──
      if (hdr) {
        var extras = hdr.querySelectorAll('[id^="th-rpc-badge-"]');
        for (var ei = 0; ei < extras.length; ei++) {
          if (extras[ei].id === badgeId) continue; // keep the canonical one
          extras[ei].parentNode && extras[ei].parentNode.removeChild(extras[ei]);
        }
      }

      // ── Create fresh badge ────────────────────────────────────────
      var badge = document.createElement('span');
      badge.id = badgeId;
      badge.setAttribute('style', __NX._TH_BADGE_STYLE);
      badge.title = 'RPC Status — click to see details';
      badge.onclick = function() { _thShowRpcLog(rpcInputId); };
      if (hdr) {
        hdr.appendChild(badge);
      } else {
        rpcEl.insertAdjacentElement('afterend', badge);
      }
      return badge;
    }

    function _escHtml(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    // ── Per-page RPC log (last N entries) ──
    var _thRpcLog = {};  // rpcInputId → string[]

    function _thLogRpc(rpcInputId, msg) {
      if (!_thRpcLog[rpcInputId]) _thRpcLog[rpcInputId] = [];
      var ts = new Date().toLocaleTimeString('en-US', { hour12: false, hour:'2-digit', minute:'2-digit', second:'2-digit' });
      _thRpcLog[rpcInputId].push('[' + ts + '] ' + msg);
      if (_thRpcLog[rpcInputId].length > 40) _thRpcLog[rpcInputId].shift();
    }

    function _thShowRpcLog(rpcInputId) {
      var logs = _thRpcLog[rpcInputId] || [];
      var list = window.thGetRpcList(rpcInputId);
      var curIdx = _thRpcIdx[rpcInputId] || 0;
      var modal = document.getElementById('th-rpc-log-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'th-rpc-log-modal';
        modal.setAttribute('data-rpc-input-id', rpcInputId);
        modal.setAttribute('style', [
          'position:fixed;inset:0;z-index:99999;',
          'display:flex;align-items:flex-end;justify-content:center;',
          'background:rgba(0,0,0,0.72);backdrop-filter:blur(6px);',
          '-webkit-backdrop-filter:blur(6px);',
        ].join(''));
        modal.innerHTML = [
          '<div id="th-rpc-log-inner" style="',
            'width:100%;max-width: 100%;',
            'background:var(--bg-raised);border:1px solid var(--border-subtle);',
            'border-radius:24px 24px 0 0;padding:20px 18px 28px;',
            'max-height:70vh;display:flex;flex-direction:column;gap:12px;',
            'box-shadow:0 -8px 40px rgba(0,0,0,0.6);',
          '">',
            '<div style="display:flex;align-items:center;justify-content:space-between;">',
              '<span style="font-size:13px;font-weight:700;color:var(--text-primary);letter-spacing:.5px;">⚡ RPC Status Log</span>',
              '<button onclick="document.getElementById(\'th-rpc-log-modal\').remove()" ',
                'style="background:var(--bg-glass);border:1px solid var(--border-subtle);color:var(--text-secondary);',
                'padding:4px 10px;border-radius:8px;font-size:12px;cursor:pointer;">✕ Close</button>',
            '</div>',
            '<div id="th-rpc-log-rpclist" style="',
              'display:flex;flex-direction:column;gap:4px;',
              'max-height:180px;overflow-y:auto;',
              'scrollbar-width:thin;scrollbar-color:rgba(99,102,241,0.35) transparent;',
              'padding-right:2px;',
            '"></div>',
            '<div id="th-rpc-log-entries" style="',
              'flex:1;overflow-y:auto;',
              'scrollbar-width:thin;scrollbar-color:rgba(99,102,241,0.35) transparent;',
              'font-family:var(--font-mono);font-size:10px;line-height:1.7;',
              'color:var(--text-secondary);',
              'background:var(--bg-deep);border-radius:10px;padding:10px 12px;',
              'max-height:200px;',
            '"></div>',
          '</div>',
        ].join('');
        modal.addEventListener('click', function(e){ if(e.target===modal) modal.remove(); });
        document.getElementById('app').appendChild(modal);
      }
      // Always update the stored rpcInputId so click-to-select targets the right section
      modal.setAttribute('data-rpc-input-id', rpcInputId);
      // ── Inject RPC-select click style once ──
      if (!document.getElementById('th-rpc-select-style')) {
        var _rss = document.createElement('style');
        _rss.id = 'th-rpc-select-style';
        _rss.textContent = [
          '.th-rpc-row{transition:background .15s,border-color .15s,transform .1s;cursor:pointer;}',
          '.th-rpc-row:hover{background:rgba(99,102,241,0.13)!important;border-color:rgba(99,102,241,0.45)!important;transform:translateX(2px);}',
          '.th-rpc-row:active{transform:scale(0.98);}',
          '.th-rpc-row.th-rpc-active{background:rgba(16,185,129,0.15)!important;border-color:rgba(16,185,129,0.4)!important;}',
          '.th-rpc-row.th-rpc-banned{opacity:0.65;}',
        ].join('');
        document.head.appendChild(_rss);
      }

      // ── RPC manual-select function ──
      window._thSelectRpcManually = function(rpcInputId, idx) {
        var list = window.thGetRpcList(rpcInputId);
        if (!list || idx < 0 || idx >= list.length) return;
        var rpc = _thNormalizeRpc(list[idx]);
        // ── Pin this RPC as manually chosen ──
        // rpcSetDefault (Step 6) checks _thManualPin before overriding the active RPC.
        _thManualPin[rpcInputId] = rpc;
        // Force the index
        _thRpcIdx[rpcInputId] = idx;
        // Remove any ban on the selected RPC so it's immediately usable
        delete _thRpc429[rpc];
        // Update the input element value (downstream code reads .value)
        var el = document.getElementById(rpcInputId);
        if (el) {
          el.value = rpc;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
        window.thSetRpcStatus(rpcInputId, 'connected', rpc);
        var shortRpc = rpc.replace(/^https?:\/\//, '').slice(0, 50);
        _thLogRpc(rpcInputId, '👆 Manually selected → ' + shortRpc);

        // ── FIX: notify section's own log panel on manual RPC select ──
        // Token mode log was silent because logMessageToken has _isUIVisible guard
        // but _thSelectRpcManually never called the section log fn at all.
        try {
          var _sfn = (typeof _thGetSectionLogFn === 'function') ? _thGetSectionLogFn(rpcInputId) : null;
          if (typeof _sfn === 'function') {
            // Reset debounce so log fires (manual select is intentional)
            if (window._thRpcLogTs) delete window._thRpcLogTs[rpcInputId];
            _sfn('success', '🟢 Connected: ' + shortRpc);
          }
        } catch(e) {}

        // ── FIX: sync paired rpcInput IDs so both modes stay in sync ──
        // Each section has a native+token pair. Manually selecting one must
        // update the other so token mode always has a live RPC.
        // Pairs: rpcUrl↔rpcUrlToken, rpcUrlMultiKeyNative↔rpcUrlMultiKeyToken,
        //        rpcUrlNft↔rpcUrlNftCollect, rpcUrlW2W↔rpcUrlW2WToken
        var _PAIRED = {
          'rpcUrl':                'rpcUrlToken',
          'rpcUrlToken':           'rpcUrl',
          'rpcUrlMultiKeyNative':  'rpcUrlMultiKeyToken',
          'rpcUrlMultiKeyToken':   'rpcUrlMultiKeyNative',
          'rpcUrlNft':             'rpcUrlNftCollect',
          'rpcUrlNftCollect':      'rpcUrlNft',
          'rpcUrlW2W':             'rpcUrlW2WToken',
          'rpcUrlW2WToken':        'rpcUrlW2W'
        };
        try {
          var _pairedId = _PAIRED[rpcInputId];
          if (_pairedId) {
            var _pEl = document.getElementById(_pairedId);
            if (_pEl) {
              _pEl.value = rpc;
              // Copy data-rpcs with selected RPC at front
              var _rpcsAttr = el ? el.getAttribute('data-rpcs') : null;
              if (_rpcsAttr) {
                try {
                  var _rArr = JSON.parse(_rpcsAttr);
                  _rArr = [rpc].concat(_rArr.filter(function(r){ return _thNormalizeRpc(r) !== rpc; }));
                  _pEl.setAttribute('data-rpcs', JSON.stringify(_rArr));
                } catch(_) {}
              }
              var _cidAttr = el ? el.getAttribute('data-chainid') : null;
              if (_cidAttr) _pEl.setAttribute('data-chainid', _cidAttr);
              _thRpcIdx[_pairedId] = 0;
              window.thSetRpcStatus(_pairedId, 'connected', rpc);
              _thLogRpc(_pairedId, '👆 Synced from pair → ' + shortRpc);
              // Notify paired section log (reset debounce so it shows)
              if (window._thRpcLogTs) delete window._thRpcLogTs[_pairedId];
              try {
                var _psfn = (typeof _thGetSectionLogFn === 'function') ? _thGetSectionLogFn(_pairedId) : null;
                if (typeof _psfn === 'function') _psfn('success', '🟢 Connected: ' + shortRpc);
              } catch(_) {}
            }
          }
        } catch(e) {}

        // Re-render modal to reflect new active state
        _thShowRpcLog(rpcInputId);
      };

      // Populate RPC list (with click-to-select)
      var rpcListEl = modal.querySelector('#th-rpc-log-rpclist');
      if (rpcListEl) {
        if (!list.length) {
          rpcListEl.innerHTML = '<div style="color:var(--text-muted);font-size:10px;">No RPCs configured</div>';
        } else {
          // Header hint
          var _hdr = '<div style="font-size:9px;color:var(--text-muted);margin-bottom:3px;padding:0 2px;">Tap an RPC to make it active for this section</div>';
          rpcListEl.innerHTML = _hdr + list.map(function(r, i) {
            var normalR = _thNormalizeRpc(r);
            var isCur = (i === curIdx);
            var isBanned = _thRpc429[normalR] && Date.now() < _thRpc429[normalR];
            var dot = isBanned ? '🔴' : (isCur ? '🟢' : '⚪');
            var bg = isCur ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.03)';
            var border = isCur ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.06)';
            var shortR = normalR.replace(/^https?:\/\//, '');
            var rowClass = 'th-rpc-row' + (isCur ? ' th-rpc-active' : '') + (isBanned ? ' th-rpc-banned' : '');
            return '<div class="' + rowClass + '" ' +
              'onclick="window._thSelectRpcManually(\'' + _escHtml(rpcInputId) + '\',' + i + ')" ' +
              'title="Click to use this RPC" ' +
              'style="display:flex;align-items:center;gap:7px;padding:6px 9px;border-radius:8px;' +
              'background:' + bg + ';border:1px solid ' + border + ';font-family:var(--font-mono);font-size:9.5px;' +
              'user-select:none;-webkit-user-select:none;">' +
              '<span style="font-size:11px;">' + dot + '</span>' +
              '<span style="flex:1;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
                _escHtml(shortR) + '</span>' +
              (isCur
                ? '<span style="color:var(--accent-green);font-size:9px;font-weight:700;white-space:nowrap;">✓ ACTIVE</span>'
                : '<span style="color:var(--text-muted);font-size:9px;white-space:nowrap;">USE</span>') +
              (isBanned ? '<span style="color:var(--accent-red);font-size:9px;font-weight:700;margin-left:4px;white-space:nowrap;">RATE LTD</span>' : '') +
              '</div>';
          }).join('');
        }
      }
      // Populate log entries
      var entriesEl = modal.querySelector('#th-rpc-log-entries');
      if (entriesEl) {
        if (!logs.length) {
          entriesEl.innerHTML = '<span style="color:var(--text-muted);">No log entries yet.</span>';
        } else {
          entriesEl.innerHTML = logs.slice().reverse().map(function(l) {
            var color = l.includes('✅') ? '#6ee7b7'
                      : l.includes('🔴') || l.includes('❌') ? '#fda4af'
                      : l.includes('🟡') ? '#fcd34d' : 'var(--text-secondary)';
            return '<div style="color:' + color + ';">' + _escHtml(l) + '</div>';
          }).join('');
        }
      }
    }
})((window.__nxp = window.__nxp || {}).mod_rpc_manager = window.__nxp.mod_rpc_manager || {});
