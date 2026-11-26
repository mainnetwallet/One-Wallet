  function brRenderHistDropdown() {
    var listEl = $e('br-hist-list');
    if (!listEl) return;

    // Clear stale pending-check map on every re-render (new keys are assigned below)
    window._brPendCheckMap = {};

    var allTxs = (typeof loadTxHistory === 'function') ? loadTxHistory() : [];
    // Filter out bridge entries cleared via brClearHistory — does NOT affect Profile Transaction History
    // Uses 'brh_cleared_ts': any bridge tx with ts <= that value is hidden in this modal only
    var _brhClearedTs = 0;
    try { var _brhCTs = localStorage.getItem('brh_cleared_ts'); if (_brhCTs) _brhClearedTs = Number(_brhCTs); } catch(e) {}
    var pool   = allTxs.filter(function(t){
      if (t.type !== 'bridge' && t.type !== 'swap') return false;
      if (_brhClearedTs > 0) {
        // Apply to BOTH bridge AND swap — hidden in modal only, Profile history untouched
        var _txTs = t.timestamp || t.ts || 0;
        if (Number(_txTs) <= _brhClearedTs) return false;
      }
      return true;
    });

    // update count pill
    var pill = document.getElementById('brh-count-pill');
    if (pill) pill.textContent = pool.length;

    // apply filter
    var filtered = brHistFilter === 'all' ? pool
      : pool.filter(function(t){ return t.type === brHistFilter; });
    var recent = filtered.slice(0, 15);

    if (!recent.length) {
      var emptyMsg = brHistFilter === 'all' ? 'No transactions yet.' : 'No ' + brHistFilter + 's yet.';
      listEl.innerHTML =
        '<div class="brh-empty">' +
          '<div class="brh-empty-icon"><span class="material-icons-round" style="font-size:24px;color:var(--text-muted);">receipt_long</span></div>' +
          '<div class="brh-empty-title">' + emptyMsg + '</div>' +
          '<div class="brh-empty-sub">Your bridge &amp; swap transactions will appear here.</div>' +
        '</div>';
      return;
    }

    listEl.innerHTML = recent.map(function(tx) {
      var isBridge   = tx.type === 'bridge';
      var iconName   = isBridge ? 'alt_route' : 'swap_horiz';
      var iconBg     = isBridge ? 'rgba(34,211,238,0.13)' : 'rgba(99,102,241,0.13)';
      var iconColor  = isBridge ? 'var(--neon-cyan)'      : 'var(--accent-primary)';
      var cardClass  = isBridge ? 'brh-bridge'            : 'brh-swap';
      var typeClass  = isBridge ? 'brh-type-bridge'       : 'brh-type-swap';
      var typeLabel  = isBridge ? 'BRIDGE'                : 'SWAP';

      // explorer URLs — use BR_EXPLORERS (now on window) with chainId fallback
      var _brExpMap = window.BR_EXPLORERS || {};
      var _sentCid  = tx.fromChainId || tx.chainId || 1;
      var _recvCid  = tx.toChainId   || tx.chainId || 1;
      var sentBase = (_brExpMap[_sentCid]) || (window.getTHExplorerTx ? window.getTHExplorerTx(_sentCid) : 'https://etherscan.io/tx/');
      var recvBase = (_brExpMap[_recvCid]) || (window.getTHExplorerTx ? window.getTHExplorerTx(_recvCid) : 'https://etherscan.io/tx/');
      var sentUrl  = tx.hash     ? sentBase + tx.hash     : null;
      var recvUrl  = tx.recvHash ? recvBase + tx.recvHash : null;

      var sentShort = tx.hash     ? tx.hash.slice(0,6)     + '…' + tx.hash.slice(-4)     : null;
      var recvShort = tx.recvHash ? tx.recvHash.slice(0,6) + '…' + tx.recvHash.slice(-4) : null;

      // hash links
      var sentHtml = sentShort
        ? (sentUrl
            ? '<span class="brh-hash-link brh-hash-sent" onclick="event.stopPropagation();window.open(\'' + sentUrl + '\',\'_blank\',\'noopener\');">' +
                '<span class="material-icons-round">north_east</span>' + sentShort +
              '</span>'
            : '<span class="brh-no-hash">' + sentShort + '</span>')
        : '<span class="brh-no-hash">No hash</span>';

      var recvHtml = recvShort
        ? (recvUrl
            ? '<span class="brh-hash-link brh-hash-recv" onclick="event.stopPropagation();window.open(\'' + recvUrl + '\',\'_blank\',\'noopener\');">' +
                '<span class="material-icons-round">south_east</span>' + recvShort +
              '</span>'
            : '<span class="brh-no-hash">' + recvShort + '</span>')
        : (isBridge && tx.pendingRecv
            ? (function() {
                // PENDING badge — click triggers live API check, NOT explorer open
                var _txKey = 'brpend_' + (tx.id || tx.hash || tx.timestamp || Date.now()).toString().replace(/\W/g,'_');
                if (!window._brPendCheckMap) window._brPendCheckMap = {};
                window._brPendCheckMap[_txKey] = tx;
                var _pendOnclick = 'event.stopPropagation();brPendingBadgeCheck(\'' + _txKey + '\',this);';
                return '<span class=\"brh-hash-link brh-pending-badge\" id=\"' + _txKey + '\" style=\"cursor:pointer;\" onclick=\"' + _pendOnclick + '\">' +
                  '<span class=\"material-icons-round\" style=\"font-size:9px;animation:spin 1.4s linear infinite;\">sync</span> PENDING</span>';
              })()
            : (isBridge && tx.failed
                ? '<span class="brh-hash-link" style="cursor:default;background:rgba(244,63,94,0.12);color:var(--accent-red);border:1px solid rgba(244,63,94,0.2);pointer-events:none;"><span class="material-icons-round" style="font-size:9px;">error_outline</span> FAILED</span>'
                : ''));

      // chain meta — resolve names from chainId if field missing (swap-section entries)
      var _brChainName = function(id, fallback) {
        if (!id) return fallback || '?';
        if (typeof getAllChains === 'function') {
          var _c = getAllChains().find(function(c){ return c.chainId === id; });
          if (_c) return _c.name;
        }
        var _NAMES = {1:'Ethereum',8453:'Base',42161:'Arbitrum',10:'Optimism',137:'Polygon',56:'BSC',43114:'Avalanche',59144:'Linea',534352:'Scroll',324:'zkSync',100:'Gnosis',250:'Fantom',25:'Cronos',42220:'Celo'};
        return _NAMES[id] || fallback || ('Chain '+id);
      };
      var _fromChainLabel = tx.fromChain || _brChainName(tx.fromChainId, tx.chainId ? _brChainName(tx.chainId) : null);
      var _toChainLabel   = tx.toChain   || _brChainName(tx.toChainId,   tx.chainId ? _brChainName(tx.chainId) : null);
      var chainHtml = '';
      if (isBridge && _fromChainLabel && _toChainLabel) {
        chainHtml = '<span class="brh-chain-badge">' + _fromChainLabel + ' → ' + _toChainLabel + '</span>';
      } else if (!isBridge && _fromChainLabel) {
        // Same-chain swap — show single chain pill
        chainHtml = '<span class="brh-chain-badge">' + _fromChainLabel + '</span>';
      } else if (tx.chainId) {
        chainHtml = '<span class="brh-chain-badge">' + _brChainName(tx.chainId) + '</span>';
      }

      // amount display
      var _fmtBrhAmt = function(v) {
        var n = parseFloat(v);
        if (!n || !isFinite(n)) return v || '—';
        if (n >= 1e6)  return (n/1e6).toFixed(2)+'M';
        if (n >= 1000) return n.toLocaleString('en-US',{maximumFractionDigits:2});
        if (n >= 1)    return parseFloat(n.toPrecision(6)).toString();
        if (n >= 1e-4) return parseFloat(n.toPrecision(4)).toString();
        return n.toExponential(2);
      };
      var fromAmtStr = (tx.fromAmt && tx.fromToken) ? (_fmtBrhAmt(tx.fromAmt) + ' ' + tx.fromToken)
                     : tx.fromAmt ? _fmtBrhAmt(tx.fromAmt) : '—';
      var toAmtStr   = (tx.toAmt   && tx.toToken)   ? (_fmtBrhAmt(tx.toAmt)   + ' ' + tx.toToken)
                     : tx.toAmt   ? _fmtBrhAmt(tx.toAmt)   : null;
      var amtHtml;
      if (toAmtStr) {
        amtHtml = '<div class="brh-amt-from">' + fromAmtStr + '</div>' +
                  '<div class="brh-amt-arrow">↓</div>' +
                  '<div class="brh-amt-to">' + toAmtStr + '</div>';
      } else {
        amtHtml = '<div class="brh-amt-from">' + fromAmtStr + '</div>';
      }

      // time
      var timeStr = (typeof formatTxTime === 'function') ? formatTxTime(tx.timestamp) : '';

      // card এ কোনো onclick নেই — শুধু brh-hash-link / brh-hash-sent click হবে
      var cardClick = '';
      if (isBridge && tx.pendingRecv) {
        if (!window._brPendingCards) window._brPendingCards = {};
        var _pk = 'p_' + (tx.hash || tx.timestamp || Date.now()).toString().replace(/\W/g,'');
        window._brPendingCards[_pk] = tx;
        cardClick = 'data-pending-key="' + _pk + '"';
      }

      return '<div class="brh-tx-card ' + cardClass + '" ' + cardClick + '>' +
        '<div class="brh-tx-icon-wrap">' +
          '<div class="brh-tx-icon" style="background:' + iconBg + ';border:1px solid ' + iconColor + '33;">' +
            '<span class="material-icons-round" style="font-size:18px;color:' + iconColor + ';">' + iconName + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="brh-tx-body">' +
          '<div class="brh-tx-pair">' + (tx.pair || '—') + '</div>' +
          '<div class="brh-tx-meta">' +
            '<span class="brh-type-badge ' + typeClass + '">' + typeLabel + '</span>' +
            chainHtml +
          '</div>' +
          '<div class="brh-hash-row">' + sentHtml + recvHtml + '</div>' +
        '</div>' +
        '<div class="brh-tx-right">' +
          '<div class="brh-tx-amt">' + amtHtml + '</div>' +
          '<div class="brh-tx-time">' + timeStr + '</div>' +
          '' +
        '</div>' +
      '</div>';
    }).join('');
  }

  // brRefreshRecentTx — called after confirmed (re-renders if sheet is open)
  window.brRefreshRecentTx = function () {
    if (brHistOpen) brRenderHistDropdown();
    brRenderRecentInline();
    // Update pending dot on history button
    var _allTxs = (typeof loadTxHistory === 'function') ? loadTxHistory() : [];
    var _hasPending = _allTxs.some(function(t){ return (t.type === 'bridge' || t.type === 'swap') && t.pendingRecv === true && t.hash; });
    var _dot = document.getElementById('br-hist-pending-dot');
    if (_dot) _dot.style.display = _hasPending ? 'block' : 'none';
  };
