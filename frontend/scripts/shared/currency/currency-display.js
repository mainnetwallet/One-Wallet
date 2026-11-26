
// ══════════════════════════════════════════════════
//  ONE — CURRENCY DISPLAY SYSTEM
// ══════════════════════════════════════════════════

// ── State ──
window._oneCurrency = localStorage.getItem('one_display_currency') || 'USD';
window._oneCurrencyRates = { USD: 1, BDT: 110, ETH: 0, BTC: 0 }; // ETH/BTC filled on fetch

const _CUR_META = {
  USD: { symbol: '$',  name: 'US Dollar',          decimals: 2,  prefix: true  },
  BDT: { symbol: '৳', name: 'Bangladeshi Taka',    decimals: 0,  prefix: false },
  ETH: { symbol: 'Ξ ', name: 'Ethereum',            decimals: 6,  prefix: true  },
  BTC: { symbol: '₿ ', name: 'Bitcoin',             decimals: 8,  prefix: true  },
};

// ── Format USD value into selected currency ──
function _formatCurrencyDisplay(usdVal) {
  const cur = window._oneCurrency;
  const meta = _CUR_META[cur];
  const rate = window._oneCurrencyRates[cur] || 1;

  if (!usdVal || isNaN(usdVal)) return meta.symbol + '0';

  const converted = usdVal * rate;

  let formatted;
  if (cur === 'ETH') {
    formatted = converted < 0.000001
      ? converted.toExponential(3)
      : converted.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
    return meta.symbol + formatted;
  }
  if (cur === 'BTC') {
    formatted = converted < 0.00000001
      ? converted.toExponential(3)
      : converted.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 8 });
    return meta.symbol + formatted;
  }
  if (cur === 'BDT') {
    formatted = Math.round(converted).toLocaleString('en-US');
    return '৳' + formatted;
  }
  // USD default
  return '$' + converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Fetch live rates (BDT from exchangerate, ETH+BTC from Binance) ──
async function _fetchCurrencyRates() {
  try {
    // Binance — ETH + BTC prices
    const binRes = await window.nxFetch('https://api.binance.com/api/v3/ticker/price?symbols=%5B%22ETHUSDT%22,%22BTCUSDT%22%5D', { ms: 8000 });
    if (binRes.ok) {
      const binData = await binRes.json();
      binData.forEach(t => {
        if (t.symbol === 'ETHUSDT') window._oneCurrencyRates.ETH = 1 / parseFloat(t.price);
        if (t.symbol === 'BTCUSDT') window._oneCurrencyRates.BTC = 1 / parseFloat(t.price);
      });
      // Update labels
      const ethPrice = 1 / window._oneCurrencyRates.ETH;
      const btcPrice = 1 / window._oneCurrencyRates.BTC;
      const el_eth = document.getElementById('eth-rate-label');
      const el_btc = document.getElementById('btc-rate-label');
      if (el_eth) el_eth.textContent = 'ETH — 1 ETH ≈ $' + ethPrice.toLocaleString('en-US', {maximumFractionDigits: 0});
      if (el_btc) el_btc.textContent = 'BTC — 1 BTC ≈ $' + btcPrice.toLocaleString('en-US', {maximumFractionDigits: 0});
    }
  } catch(e) {
    // Fallback defaults (approximate)
    if (!window._oneCurrencyRates.ETH) window._oneCurrencyRates.ETH = 1 / 3200;
    if (!window._oneCurrencyRates.BTC) window._oneCurrencyRates.BTC = 1 / 95000;
  }

  try {
    // BDT rate from exchangerate-api (open endpoint)
    const bdtRes = await window.nxFetch('https://open.er-api.com/v6/latest/USD', { ms: 8000 });
    if (bdtRes.ok) {
      const bdtData = await bdtRes.json();
      if (bdtData.rates && bdtData.rates.BDT) {
        window._oneCurrencyRates.BDT = bdtData.rates.BDT;
        const el_bdt = document.getElementById('bdt-rate-label');
        if (el_bdt) el_bdt.textContent = 'BDT — 1 USD ≈ ৳' + bdtData.rates.BDT.toFixed(2);
      }
    }
  } catch(e) {
    window._oneCurrencyRates.BDT = 110; // fallback
    const el_bdt = document.getElementById('bdt-rate-label');
    if (el_bdt) el_bdt.textContent = 'BDT — 1 USD ≈ ৳110 (est.)';
  }
}

// ── Re-render all token card USD values with selected currency ──
function _refreshAllTokenDisplayValues() {
  document.querySelectorAll('.token-card[data-usd-value], [data-usd-value]').forEach(card => {
    const rawUsd = parseFloat(card.dataset.usdValue);
    if (isNaN(rawUsd) || rawUsd <= 0) return;
    const usdEl = card.querySelector('.token-usd');
    if (usdEl && usdEl.dataset.toggled !== '1') usdEl.textContent = _formatCurrencyDisplay(rawUsd);
  });
  // Force portfolio total refresh
  if (typeof updatePortfolioTotal === 'function') {
    updatePortfolioTotal();
  }
}

// ── Patch updatePortfolioTotal to use selected currency ──
(function _patchPortfolioTotal() {
  const _originalUpdate = window.updatePortfolioTotal;
  if (!_originalUpdate) {
    // Will be patched after DOM ready
    document.addEventListener('DOMContentLoaded', _patchPortfolioTotal);
    return;
  }
  window.updatePortfolioTotal = function() {
    // Let original run first (it sets _portfolioTotalUsd)
    _originalUpdate.call(this);
    // Then override the displayed text with our currency
    setTimeout(function() {
      if (window._oneCurrency === 'USD') return; // USD = already correct
      const el = document.getElementById('hw-total-value-text');
      const gpEl = document.getElementById('hw-group-total-value');
      const usd = window._portfolioTotalUsd || 0;
      if (usd <= 0) return;
      const converted = _formatCurrencyDisplay(usd);
      if (el) el.textContent = converted;
      if (gpEl) gpEl.textContent = converted;
    }, 420); // slightly after the original's 350ms debounce + 110ms fade
  };
})();

// ── Open / Close picker ──
function openCurrencyPicker() {
  _fetchCurrencyRates(); // refresh live rates each time picker opens
  _updateCurrencyPickerSelection();
  const overlay = document.getElementById('currency-picker-overlay');
  const sheet = document.getElementById('currency-picker-sheet');
  overlay.style.opacity = '1';
  overlay.style.pointerEvents = 'all';
  sheet.style.transform = 'translateY(0)';
}

function closeCurrencyPicker() {
  const overlay = document.getElementById('currency-picker-overlay');
  const sheet = document.getElementById('currency-picker-sheet');
  overlay.style.opacity = '0';
  overlay.style.pointerEvents = 'none';
  sheet.style.transform = 'translateY(100%)';
}

// ── Highlight selected option in picker ──
function _updateCurrencyPickerSelection() {
  const cur = window._oneCurrency;
  document.querySelectorAll('.currency-option-row').forEach(row => {
    const isSel = row.dataset.cur === cur;
    row.style.borderColor = isSel ? 'var(--accent-green)' : 'var(--border-subtle)';
    row.style.background  = isSel ? 'rgba(16,185,129,0.08)' : 'var(--bg-glass)';
    const check = row.querySelector('.cur-check');
    if (check) check.style.opacity = isSel ? '1' : '0';
  });
}

// ── Set currency and apply everywhere ──
function setCurrency(cur) {
  window._oneCurrency = cur;
  localStorage.setItem('one_display_currency', cur);
  _updateCurrencyPickerSelection();

  // Update settings subtitle
  const labels = { USD: 'USD — US Dollar', BDT: 'BDT — Bangladeshi Taka', ETH: 'ETH — Ethereum', BTC: 'BTC — Bitcoin' };
  const subEl = document.getElementById('currency-menu-sub');
  if (subEl) subEl.textContent = labels[cur] || cur;

  _refreshAllTokenDisplayValues();
  closeCurrencyPicker();

  if (typeof showToast === 'function') {
    const icons = { USD: 'attach_money', BDT: 'currency_exchange', ETH: 'toll', BTC: 'currency_bitcoin' };
    showToast('Currency set to ' + cur, icons[cur] || 'check');
  }
}

// ── Init on load ──
document.addEventListener('DOMContentLoaded', function() {
  // Restore saved currency label in settings
  const labels = { USD: 'USD — US Dollar', BDT: 'BDT — Bangladeshi Taka', ETH: 'ETH — Ethereum', BTC: 'BTC — Bitcoin' };
  const subEl = document.getElementById('currency-menu-sub');
  if (subEl) subEl.textContent = labels[window._oneCurrency] || window._oneCurrency;

  // Fetch rates silently on boot so conversions are ready
  _fetchCurrencyRates();
});
