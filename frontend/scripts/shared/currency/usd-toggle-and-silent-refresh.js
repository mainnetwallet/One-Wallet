

(function _oneUsdToggleAndSilentRefresh() {

  // ── 1. TOKEN-USD CLICK TOGGLE ──
  // token-usd এ tap করলে:
  //   normal state  → balance × price (যেমন $12.34)  [সবুজ]
  //   toggled state → token market price (যেমন $0.0034) [cyan]
  document.addEventListener('click', function(e) {
    const usdEl = e.target.closest('.token-usd');
    if (!usdEl) return;
    e.stopPropagation();

    const card = usdEl.closest('[id^="token-card-"]');
    if (!card) return;
    const tokenId = card.id.replace('token-card-', '');

    // Get current stored values
    const usdVal = card.dataset.usdValue ? parseFloat(card.dataset.usdValue) : 0;
    const lpEl = document.getElementById('tlp-' + tokenId);
    const priceEl = lpEl ? lpEl.querySelector('.tlp-price') : null;
    const marketPrice = priceEl ? priceEl.textContent : null;

    const isToggled = usdEl.dataset.toggled === '1';

    if (isToggled) {
      // Restore USD/balance value
      usdEl.dataset.toggled = '0';
      if (usdVal > 0) {
        usdEl.textContent = _formatCurrencyDisplay(usdVal);
        usdEl.style.color = ''; usdEl.classList.add('has-balance');
      } else if (marketPrice && marketPrice !== '—') {
        usdEl.textContent = marketPrice;
        usdEl.style.color = ''; usdEl.classList.remove('has-balance');
      }
    } else {
      // Show market price
      if (!marketPrice || marketPrice === '—') return; // nothing to show
      // Store current display for restore
      usdEl.dataset.prevText = usdEl.textContent;
      usdEl.dataset.toggled = '1';
      usdEl.textContent = '📈 ' + marketPrice;
      usdEl.style.color = 'var(--accent-tertiary)';

      // Auto-revert after 3 seconds
      setTimeout(function() {
        if (usdEl.dataset.toggled !== '1') return;
        usdEl.dataset.toggled = '0';
        const freshUsdVal = card.dataset.usdValue ? parseFloat(card.dataset.usdValue) : 0;
        if (freshUsdVal > 0) {
          usdEl.textContent = _formatCurrencyDisplay(freshUsdVal);
          usdEl.style.color = ''; usdEl.classList.add('has-balance');
        } else {
          usdEl.textContent = usdEl.dataset.prevText || marketPrice;
          usdEl.style.color = ''; usdEl.classList.remove('has-balance');
        }
      }, 3000);
    }
  }, true);

  // ── 2. SILENT REFRESH: প্রতি ৩০ সেকেন্ডে silently prices+balances update ──
  // - কোনো loading indicator দেখাবে না
  // - শুধু prices silently update হবে
  // - localStorage cache silently save হবে
  // - page/scroll position অপরিবর্তিত থাকবে

  var _silentRefreshInterval = 15 * 1000; // 15 seconds
  var _silentRefreshTimer = null;
  var _liveCountdownTimer = null;
  var _liveCountdownVal = 15;

  function _startLiveCountdown() {
    if (_liveCountdownTimer) clearInterval(_liveCountdownTimer);
    _liveCountdownVal = 15;
    var el = document.getElementById('live-countdown');
    if (el) el.textContent = _liveCountdownVal;
    _liveCountdownTimer = setInterval(function() {
      _liveCountdownVal--;
      if (_liveCountdownVal < 0) _liveCountdownVal = 15;
      var el = document.getElementById('live-countdown');
      if (el) el.textContent = _liveCountdownVal;
    }, 1000);
  }
  var _silentRefreshActive = false;

  function _silentPriceRefresh() {
    if (_silentRefreshActive) return;
    // Only refresh if home page is active and wallet connected
    const homePage = document.getElementById('page-home');
    if (!homePage || !homePage.classList.contains('active')) return;
    const tokenList = document.getElementById('token-list');
    if (!tokenList || tokenList.querySelectorAll('.token-card').length === 0) return;
    // Hide label if no wallet
    const _wkCheck = (function() {
      try { return _oneGetSelectedKey(); } catch { return null; }
    })();
    const _pslEl = document.getElementById('home-price-source-label');
    if (_pslEl) _pslEl.style.display = (_wkCheck || (typeof homeActiveKey !== 'undefined' && homeActiveKey)) ? 'flex' : 'none';
    if (!_wkCheck && !(typeof homeActiveKey !== 'undefined' && homeActiveKey)) return;

    _silentRefreshActive = true;

    // Call fetchAllPrices silently
    if (typeof fetchAllPrices !== 'function') { _silentRefreshActive = false; return; }

    fetchAllPrices().then(function(priceData) {
      if (!priceData) { _silentRefreshActive = false; return; }

      // Update each token card silently (no flicker, no scroll jump)
      document.querySelectorAll('.token-card').forEach(function(card) {
        const tokenId = card.id.replace('token-card-', '');
        if (!tokenId) return;

        // Find token config
        var t = null;
        if (typeof TOKEN_CONFIG !== 'undefined') {
          t = TOKEN_CONFIG.find(function(x) { return x.id === tokenId; });
        }
        if (!t) return;

        const pd = priceData[t.cgId] || priceData['__tid__' + tokenId];
        if (!pd || !pd.usd) return;

        const price = pd.usd;
        const change24h = pd.usd_24h_change || 0;

        // Update live price label (always)
        const lpEl = document.getElementById('tlp-' + tokenId);
        if (lpEl) {
          const lpPrice = lpEl.querySelector('.tlp-price');
          const lpChange = lpEl.querySelector('.tlp-change');
          const priceStr = price >= 1
            ? _formatCurrencyDisplay(price)
            : _formatCurrencyDisplay(price);
          if (lpPrice && lpPrice.textContent !== priceStr) lpPrice.textContent = priceStr;
          if (lpChange) {
            const pctSign = change24h >= 0 ? '+' : '';
            const pctColor = change24h > 0 ? 'var(--accent-green)' : change24h < 0 ? 'var(--accent-red)' : 'var(--text-muted)';
            const pctText = change24h !== 0 ? pctSign + change24h.toFixed(2) + '%' : '';
            if (lpChange.textContent !== pctText) { lpChange.textContent = pctText; lpChange.style.color = pctColor; }
          }
        }

        // Update token-usd (only if NOT toggled to price view)
        const usdEl = card.querySelector('.token-usd');
        if (usdEl && usdEl.dataset.toggled !== '1') {
          const balEl = card.querySelector('.token-amount');
          const balRaw = balEl ? parseFloat((balEl.textContent || '0').replace(/,/g,'')) : 0;
          const hasBalance = balRaw > 0;
          const usdValNum = hasBalance ? balRaw * price : 0;

          if (hasBalance && usdValNum > 0) {
            const newUsdStr = _formatCurrencyDisplay(usdValNum);
            if (usdEl.textContent !== newUsdStr) usdEl.textContent = newUsdStr;
            usdEl.style.color = ''; usdEl.classList.add('has-balance');
            card.dataset.usdValue = usdValNum.toFixed(6);
          } else {
            const priceStr2 = price >= 1
              ? _formatCurrencyDisplay(price)
              : _formatCurrencyDisplay(price);
            if (usdEl.textContent !== priceStr2) usdEl.textContent = priceStr2;
            usdEl.style.color = ''; usdEl.classList.remove('has-balance');
          }
        }

        // Update global price cache silently
        if (typeof _globalPriceCache !== 'undefined' && _globalPriceCache && t.sub) {
          _globalPriceCache[t.sub.toLowerCase()] = { usd: price, usd_24h_change: change24h };
        }
      });

      // Recalculate portfolio total silently
      if (typeof _recalcPortfolioTotal === 'function') _recalcPortfolioTotal();

      // Save to localStorage silently (no page reload, no scroll reset)
      if (typeof _saveBalanceCache === 'function') _saveBalanceCache();
      if (typeof window._onePTRSaveNow === 'function') window._onePTRSaveNow();

      _silentRefreshActive = false;
    }).catch(function() {
      _silentRefreshActive = false;
    });
  }

  // Start silent refresh timer after page loads
  function _startSilentRefresh() {
    if (_silentRefreshTimer) clearInterval(_silentRefreshTimer);
    _startLiveCountdown(); // start countdown immediately
    _silentRefreshTimer = setInterval(function() {
      _silentPriceRefresh();
      _startLiveCountdown(); // restart countdown after each refresh
    }, _silentRefreshInterval);
  }

  // Wait for app to be ready
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(_startSilentRefresh, 5000); // 5s দেরিতে শুরু হবে (initial load শেষ হোক)
  });

  // Page visibility: tab active হলে refresh করবে
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
      setTimeout(_silentPriceRefresh, 800);
    }
  });

})();