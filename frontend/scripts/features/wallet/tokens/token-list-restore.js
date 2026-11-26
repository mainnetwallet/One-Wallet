(function (__NX) {
'use strict';
__NX._restoreTokenList = _restoreTokenList;
  /* Restore saved token cards — creates cards matching renderTokenCard structure exactly */
  function _restoreTokenList(list) {
    var tokenListEl = document.getElementById('token-list');
    if (!tokenListEl || !list || !list.length) return false;
    // Remove skeletons
    ['skel1','skel2','skel3'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.remove();
    });
    tokenListEl.innerHTML = '';
    var portfolioFromCache = 0;
    list.forEach(function(item) {
      var tokenId = item.tokenId || '';
      // Look up token config for color/badge
      var tConf = null;
      if (typeof TOKEN_CONFIG !== 'undefined' && tokenId) {
        tConf = TOKEN_CONFIG.find(function(x) { return x.id === tokenId; });
      }

      var iconBg  = (tConf && tConf.color) ? tConf.color + '22' : (item.iconBg || 'rgba(99,102,241,0.13)');
      var badgeBg = (tConf && tConf.badge) ? tConf.badge + '44' : (item.badgeBg || 'rgba(99,102,241,0.27)');
      var iconColor = (tConf && tConf.color) ? tConf.color : 'var(--accent-primary)';

      var cardEl = document.createElement('div');
      cardEl.className = 'token-card';
      if (tokenId) cardEl.id = 'token-card-' + tokenId;
      // Restore numeric usdValue so portfolio total + sort works immediately
      var usdNum = item.usdValue || 0;
      portfolioFromCache += usdNum;
      if (usdNum > 0) cardEl.dataset.usdValue = usdNum.toFixed(6);
      // ── Serial order lock: preserve exact saved DOM order on restore ──
      if (typeof item.savedOrder === 'number') cardEl.dataset.savedOrder = item.savedOrder;

      // Build HTML matching renderTokenCard structure exactly
      var subChip = '';
      // chain label omitted on restore (unknown at this point) — loadTokens will fix
      var priceText = (item.price && item.price !== 'Loading…' && item.price !== '...' && item.price !== '—') ? item.price : '—';
      var changeHtml = item.change
        ? '<span class="tlp-change" style="font-size:9px;font-weight:700;color:' + (item.changeColor || 'var(--text-muted)') + ';">' + item.change + '</span>'
        : '<span class="tlp-change" style="font-size:9px;font-weight:700;"></span>';
      var amtText  = item.amount || '—';
      var usdText  = (item.usdValue > 0 && item.usd) ? item.usd : '';
      var nameText = item.name || '';
      var subText  = item.sub  || '';

      cardEl.innerHTML =
        '<div class="token-icon"' + (tokenId ? ' id="ticon-' + tokenId + '"' : '') +
          ' data-cgid="' + ((tConf && tConf.cgId) || '') + '"' +
          ' style="background:' + iconBg + ';color:' + iconColor + ';font-size:16px;overflow:hidden;cursor:pointer;position:relative;">' +
        '</div>' +
        '<div class="token-info">' +
          '<div class="token-name" style="display:flex;align-items:center;gap:5px;">' + nameText + '</div>' +
          '<div class="token-sub" style="display:flex;align-items:center;gap:6px;"><span style="font-weight:700;color:var(--text-secondary);">' + subText + '</span></div>' +
          '<div class="token-live-price"' + (tokenId ? ' id="tlp-' + tokenId + '"' : '') +
            ' style="font-family:var(--font-mono);font-size:10px;color:var(--text-secondary);margin-top:2px;display:flex;align-items:center;gap:4px;opacity:1;">' +
            '<span class="tlp-price">' + priceText + '</span>' + changeHtml +
          '</div>' +
        '</div>' +
        '<div class="token-value">' +
          '<div class="token-amount">' + amtText + '</div>' +
          '<div class="token-usd">' + usdText + '</div>' +
        '</div>' +
        '<div class="token-badge" style="background:' + badgeBg + ';"></div>';

      // Inject real logo immediately if TOKEN_CONFIG + getTokenLogoEl available
      var iconDiv = cardEl.querySelector('.token-icon');
      if (iconDiv && tConf && typeof getTokenLogoEl === 'function') {
        var logoEl = getTokenLogoEl(tConf);
        logoEl.style.width = '100%'; logoEl.style.height = '100%';
        iconDiv.appendChild(logoEl);
      }

      // Click handler
      cardEl.onclick = function(e) {
        var tObj = tConf;
        if (!tObj && typeof TOKEN_CONFIG !== 'undefined') {
          if (tokenId) tObj = TOKEN_CONFIG.find(function(x) { return x.id === tokenId; });
          if (!tObj && subText) tObj = TOKEN_CONFIG.find(function(x) { return x.sub === subText.trim(); });
        }
        var iconD = cardEl.querySelector('.token-icon');
        if (iconD && (e.target === iconD || iconD.contains(e.target))) {
          if (tObj && typeof showTokenAddrPopup === 'function') { e.stopPropagation(); showTokenAddrPopup(tObj.id, tObj.contract||'', tObj.sub, iconD); }
          return;
        }
        if (tObj && typeof showTokenSwapSheet === 'function') {
          if (typeof rippleEffect === 'function') rippleEffect(cardEl, e);
          showTokenSwapSheet(tObj);
        }
      };
      if (iconDiv) {
        iconDiv.onclick = function(ev) {
          ev.stopPropagation();
          var tObj = tConf;
          if (!tObj && typeof TOKEN_CONFIG !== 'undefined' && tokenId) tObj = TOKEN_CONFIG.find(function(x) { return x.id === tokenId; });
          if (tObj && typeof showTokenAddrPopup === 'function') showTokenAddrPopup(tObj.id, tObj.contract||'', tObj.sub, iconDiv);
        };
      }

      // Long press to delete
      var _lpTimer = null, _lpActive = false;
      cardEl.addEventListener('touchstart', function() {
        _lpActive = false;
        _lpTimer = setTimeout(function() {
          _lpActive = true; _lpTimer = null;
          var tObj = tConf || (typeof TOKEN_CONFIG !== 'undefined' && tokenId ? TOKEN_CONFIG.find(function(x) { return x.id === tokenId; }) : null);
          if (tObj && typeof showTokenDeleteConfirm === 'function') { if (typeof haptic === 'function') haptic(); showTokenDeleteConfirm(cardEl, tObj); }
        }, 650);
      }, { passive: true });
      cardEl.addEventListener('touchend',  function() { clearTimeout(_lpTimer); _lpTimer = null; }, { passive: true });
      cardEl.addEventListener('touchmove', function() { clearTimeout(_lpTimer); _lpTimer = null; }, { passive: true });

      tokenListEl.appendChild(cardEl);
      // No animation on cache restore — instant display
      if (typeof _animatedTokenIds !== 'undefined' && tokenId) {
        _animatedTokenIds.add(tokenId); // Mark as seen so fresh loadTokens won't re-animate
      }
    });

    // Restore portfolio total from cached USD values immediately (no flicker)
    if (portfolioFromCache > 0 && typeof _portfolioTotalUsd !== 'undefined') {
      _portfolioTotalUsd = portfolioFromCache;
      if (typeof updatePortfolioTotal === 'function') updatePortfolioTotal();
    }

    // Re-inject logos for all restored cards using TOKEN_CONFIG
    setTimeout(function() {
      if (typeof TOKEN_CONFIG === 'undefined' || typeof getTokenLogoEl !== 'function') return;
      list.forEach(function(item) {
        var tokenId = item.tokenId || '';
        if (!tokenId) return;
        var card = document.getElementById('token-card-' + tokenId);
        if (!card) return;
        var iconDiv = card.querySelector('.token-icon');
        if (!iconDiv) return;
        var tObj = TOKEN_CONFIG.find(function(x) { return x.id === tokenId; });
        if (!tObj) return;
        // Always ensure id and onclick are set on the icon div
        if (!iconDiv.id) iconDiv.id = 'ticon-' + tObj.id;
        iconDiv.setAttribute('data-cgid', tObj.cgId || '');
        // Always (re)attach onclick so it works whether logo is loaded or not
        iconDiv.onclick = function(ev) {
          ev.stopPropagation();
          if (typeof showTokenAddrPopup === 'function') showTokenAddrPopup(tObj.id, tObj.contract || '', tObj.sub, iconDiv);
        };
        // Only replace inner content if no real img/svg logo yet (only text placeholder)
        if (iconDiv.querySelector('img') || iconDiv.querySelector('div[style*="border-radius"]')) return;
        iconDiv.innerHTML = '';
        var logoEl = getTokenLogoEl(tObj);
        logoEl.style.width = '100%';
        logoEl.style.height = '100%';
        iconDiv.appendChild(logoEl);
      });
    }, 80);

    return true;
  }
})((window.__nxp = window.__nxp || {}).mod_token_cache_pull_refresh = window.__nxp.mod_token_cache_pull_refresh || {});
