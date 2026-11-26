
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