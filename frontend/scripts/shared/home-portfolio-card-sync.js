
// ══════════════════════════════════════════════════════════════════════
// ── HOME PORTFOLIO CARD SYNC: hw-total-value-text → home-portfolio-value ──
// ══════════════════════════════════════════════════════════════════════
(function _homePortfolioCardSync() {

  // ── 1. Greeting based on time ──
  function _updateGreeting() {
    var el = document.getElementById('home-greeting-main');
    if (!el) return;
    var h = new Date().getHours();
    var greet = h < 12 ? 'Good morning 👋' : h < 17 ? 'Good afternoon 👋' : 'Good evening 👋';
    el.textContent = greet;
  }

  // ── 2. Sync portfolio card value from wallet total ──
  function _syncPortfolioCard() {
    var srcEl = document.getElementById('hw-total-value-text');
    var dstEl = document.getElementById('home-portfolio-value');
    if (!srcEl || !dstEl) return;
    var val = srcEl.textContent || '$0.00';
    if (dstEl.textContent !== val) {
      dstEl.style.transition = 'none';
      dstEl.textContent = val;
    }

    // Update p-chip token count
    var chipTokens = document.getElementById('home-pchip-tokens');
    if (chipTokens) {
      var tokenCards = document.querySelectorAll('#token-list .token-card');
      chipTokens.textContent = tokenCards.length > 0 ? tokenCards.length : '—';
    }

    // Update p-chip chain count — use TOKEN_CONFIG directly (token-badge has no data-chain attr)
    var chipChains = document.getElementById('home-pchip-chains');
    if (chipChains) {
      var chainSet = new Set();
      if (typeof TOKEN_CONFIG !== 'undefined') {
        TOKEN_CONFIG.forEach(function(t) { if (t.chainId) chainSet.add(t.chainId); });
      }
      chipChains.textContent = chainSet.size > 0 ? chainSet.size : '—';
    }
    _syncPnl();
  }

  // ── 2b. 24h change from token cards (value now vs value implied by each token's 24h %) ──
  function _syncPnl() {
    var row = document.getElementById('home-pnl-row');
    var meta = document.getElementById('home-balance-meta');
    if (!row) return;
    var now = 0, prev = 0;
    document.querySelectorAll('#token-list .token-card').forEach(function(c) {
      var usd = parseFloat(c.dataset.usdValue) || 0;
      if (usd <= 0) return;
      var chEl = c.querySelector('.tlp-change');
      var pct = chEl ? parseFloat((chEl.textContent || '').replace(/\u2212/g, '-').replace(/[^0-9.+\-]/g, '')) : NaN;
      if (isNaN(pct) || pct <= -99.9) return;
      now += usd;
      prev += usd / (1 + pct / 100);
    });
    if (now <= 0 || prev <= 0) {
      row.style.display = 'none';
      if (meta) meta.style.display = 'flex';
      return;
    }
    var diff = now - prev, neg = diff < 0;
    var pctTot = Math.abs(diff / prev * 100).toFixed(2) + '%';
    var amt = (typeof _formatCurrencyDisplay === 'function') ? _formatCurrencyDisplay(Math.abs(diff)) : '$' + Math.abs(diff).toFixed(2);
    var chip = document.getElementById('home-pnl-chip');
    var icon = document.getElementById('home-pnl-icon');
    var pEl = document.getElementById('home-pnl-pct');
    var uEl = document.getElementById('home-pnl-usd');
    if (chip) chip.classList.toggle('neg', neg);
    if (icon) icon.textContent = neg ? 'trending_down' : 'trending_up';
    if (pEl) pEl.textContent = pctTot;
    if (uEl) uEl.textContent = (neg ? '-' : '+') + amt + ' today';
    row.style.display = 'flex';
    if (meta) meta.style.display = 'none';
  }

  // ── 3. MutationObserver: watch hw-total-value-text changes ──
  document.addEventListener('DOMContentLoaded', function() {
    _updateGreeting();
    _syncPortfolioCard();

    var srcEl = document.getElementById('hw-total-value-text');
    if (srcEl) {
      var obs = new MutationObserver(function() { _syncPortfolioCard(); });
      obs.observe(srcEl, { childList: true, characterData: true, subtree: true });
    }

    // Also watch hw-group-total-value
    var gpEl = document.getElementById('hw-group-total-value');
    if (gpEl) {
      var obs2 = new MutationObserver(function() {
        var dstEl = document.getElementById('home-portfolio-value');
        if (dstEl && gpEl.textContent && gpEl.textContent !== '$0.00') {
          dstEl.textContent = gpEl.textContent;
        }
      });
      obs2.observe(gpEl, { childList: true, characterData: true, subtree: true });
    }

    // Poll every 2s as safety net
    setInterval(_syncPortfolioCard, 2000);
  });

})();