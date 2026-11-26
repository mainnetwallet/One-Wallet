
(function() {
  'use strict';
  var LS_KEY = 'one_token_cache';

  function _earlyLoad() {
    try {
      // ── GUARD: No wallet selected → never show cached tokens ──
      var wk = null;
      try { wk = _oneGetSelectedKey(); } catch(e) {}
      if (!wk) return null; // No wallet → bail immediately

      var raw = null;
      // Try wallet-specific key first
      try {
        raw = localStorage.getItem(LS_KEY + '_' + wk.slice(-8));
      } catch(e) {}
      // Fallback: legacy key (only if it belongs to this wallet)
      if (!raw) {
        try {
          var _legacy = localStorage.getItem(LS_KEY);
          if (_legacy) {
            var _ld = JSON.parse(_legacy);
            // Only use legacy cache if it matches the active wallet
            if (_ld && _ld.walletKey && (_ld.walletKey === wk || _ld.walletKey === wk.slice(-8))) raw = _legacy;
            else if (_ld && !_ld.walletKey && Array.isArray(_ld)) raw = _legacy; // old format, allow
          }
        } catch(e) {}
      }
      if (!raw) return null;
      var data = JSON.parse(raw);
      // Final wallet ownership check (support both full key and slice(-8) identifier)
      if (data && data.walletKey && data.walletKey !== wk && data.walletKey !== wk.slice(-8)) return null;
      return Array.isArray(data) ? data : (data && data.tokens ? data.tokens : null);
    } catch(e) { return null; }
  }

  var _earlyTokens = _earlyLoad();

  if (_earlyTokens && _earlyTokens.length > 0) {
    // Store globally so PTR module picks it up
    window._oneEarlyTokens = _earlyTokens;

    // Try to inject directly once token-list is in DOM
    function _tryInject() {
      var listEl = document.getElementById('token-list');
      if (!listEl) return false;
      if (listEl.querySelectorAll('.token-card').length > 0) return true;

      // Remove skeletons
      ['skel1','skel2','skel3'].forEach(function(id) {
        var el = document.getElementById(id); if (el) el.remove();
      });
      listEl.innerHTML = '';

      _earlyTokens.forEach(function(item) {
        var tokenId = item.tokenId || '';
        var iconBg  = item.iconBg  || 'rgba(99,102,241,0.13)';
        var badgeBg = item.badgeBg || 'rgba(99,102,241,0.27)';
        var priceText = (item.price && item.price !== 'Loading…' && item.price !== '...' && item.price !== '—') ? item.price : '—';
        var changeHtml = item.change
          ? '<span class="tlp-change" style="font-size:9px;font-weight:700;color:' + (item.changeColor || 'var(--text-muted)') + ';">' + item.change + '</span>'
          : '<span class="tlp-change" style="font-size:9px;font-weight:700;"></span>';

        var cardEl = document.createElement('div');
        cardEl.className = 'token-card';
        if (tokenId) cardEl.id = 'token-card-' + tokenId;
        var usdNum = item.usdValue || 0;
        if (usdNum > 0) cardEl.dataset.usdValue = usdNum.toFixed(6);

        cardEl.innerHTML =
          '<div class="token-icon"' + (tokenId ? ' id="ticon-' + tokenId + '"' : '') +
            ' style="background:' + iconBg + ';color:var(--accent-primary);font-size:16px;overflow:hidden;cursor:pointer;position:relative;">' +
          '</div>' +
          '<div class="token-info">' +
            '<div class="token-name" style="display:flex;align-items:center;gap:5px;">' + (item.name || '') + '</div>' +
            '<div class="token-sub" style="display:flex;align-items:center;gap:6px;"><span style="font-weight:700;color:var(--text-secondary);">' + (item.sub || '') + '</span></div>' +
            '<div class="token-live-price"' + (tokenId ? ' id="tlp-' + tokenId + '"' : '') +
              ' style="font-family:var(--font-mono);font-size:10px;color:var(--text-secondary);margin-top:2px;display:flex;align-items:center;gap:4px;opacity:1;">' +
              '<span class="tlp-price">' + priceText + '</span>' + changeHtml +
            '</div>' +
          '</div>' +
          '<div class="token-value">' +
            '<div class="token-amount">' + (item.amount || '—') + '</div>' +
            '<div class="token-usd">' + (item.usd || '') + '</div>' +
          '</div>' +
          '<div class="token-badge" style="background:' + badgeBg + ';"></div>';

        listEl.appendChild(cardEl);
      });

      // Set portfolio total instantly from cached usdValues
      var _earlyTotal = 0;
      _earlyTokens.forEach(function(t) { _earlyTotal += parseFloat(t.usdValue || 0) || 0; });
      if (_earlyTotal > 0) {
        if (typeof window._portfolioTotalUsd !== 'undefined') window._portfolioTotalUsd = _earlyTotal;
        var _formatted = _formatCurrencyDisplay(_earlyTotal);
        var _totEl = document.getElementById('hw-total-value-text');
        if (_totEl) { _totEl.textContent = _formatted; _totEl.style.opacity = '1'; }
        var _gpEl = document.getElementById('hw-group-total-value');
        if (_gpEl) { _gpEl.textContent = _formatted; _gpEl.style.opacity = '1'; }
      }

      return true;
    }

    // Attempt immediately — no DOMContentLoaded wait, no delays
    if (!_tryInject()) {
      // Micro-retries in case token-list not yet in DOM at script parse time
      var _earlyTimer1 = setInterval(function() {
        if (_tryInject()) clearInterval(_earlyTimer1);
      }, 16); // ~1 frame
      setTimeout(function() { clearInterval(_earlyTimer1); }, 1500);
    }
  }
})();
