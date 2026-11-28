

// ── loadTokens public API — debounced wrapper ──
// All callers use this. Burst calls (homeOnGroupChange + homeOnWalletChange firing
// together) collapse into a single _loadTokensImpl execution on the next event-loop tick.
var _loadTokensDebounceTimer = null;
var loadTokens = function() {
  clearTimeout(_loadTokensDebounceTimer);
  _loadTokensDebounceTimer = setTimeout(function() {
    _loadTokensDebounceTimer = null;
    _loadTokensImpl();
  }, 0);
};

// ── SINGLE TOKEN BALANCE REFRESH — tap on token-amount triggers this ──
// Force-fetches balance for one token via RPC, bypassing cache TTL.
// Also called automatically when cache has no entry (undefined) for the token.
window.refreshTokenBalance = async function(tokenId) {
  const t = (typeof TOKEN_CONFIG !== 'undefined' ? TOKEN_CONFIG : []).find(function(x) { return x.id === tokenId; });
  if (!t) return;

  const card = document.getElementById('token-card-' + tokenId);
  if (!card) return;

  const balEl = card.querySelector('.token-amount');
  const usdEl = card.querySelector('.token-usd');
  if (!balEl) return;

  // ── Get current wallet key ──
  const _wk = (function() {
    try {
      var _hk = (typeof homeActiveKey !== 'undefined' && homeActiveKey) ? homeActiveKey : null;
      if (!_hk) _hk = _oneGetSelectedKey();
      return _hk;
    } catch(_e) { return null; }
  })();
  if (!_wk) return;

  // ── Loading state ──
  const _prevText = balEl.textContent;
  balEl.style.opacity = '0.45';
  balEl.style.pointerEvents = 'none';
  haptic && haptic();

  const tChain = t.chainId || 8453;
  const erc20Abi = ['function balanceOf(address) view returns (uint256)'];

  let walletAddrs = [];
  try {
    // Collect all addresses from wallet groups
    const _groups = typeof loadWalletGroups === 'function' ? loadWalletGroups() : [];
    const _norm = _wk.startsWith('0x') ? _wk : '0x' + _wk;
    walletAddrs = [new ethers.Wallet(_norm).address];
    // Also include any other wallets in the active group
    for (const g of _groups) {
      for (const k of (g.keys || [])) {
        try {
          const _a = new ethers.Wallet(k.startsWith('0x') ? k : '0x' + k).address;
          if (!walletAddrs.includes(_a)) walletAddrs.push(_a);
        } catch(_e) {}
      }
    }
  } catch(_e) {
    if (!walletAddrs.length) { balEl.style.opacity = '1'; balEl.style.pointerEvents = ''; return; }
  }

  try {
    let balance = null;
    if (t.isNative) {
      const bals = await Promise.all(walletAddrs.map(function(addr) {
        return _withRpcFallback(tChain, function(p) {
          return p.getBalance(addr).then(function(r) { return parseFloat(ethers.formatEther(r)); });
        }, 6000).catch(function() { return null; });
      }));
      const valid = bals.filter(function(b) { return b !== null; });
      if (valid.length > 0) balance = valid.reduce(function(a, b) { return a + b; }, 0);
    } else if (t.contract && t.contract.length > 10) {
      const bals = await Promise.all(walletAddrs.map(function(addr) {
        return _withRpcFallback(tChain, function(p) {
          return new ethers.Contract(t.contract, erc20Abi, p)
            .balanceOf(addr)
            .then(function(r) { return parseFloat(ethers.formatUnits(r, t.decimals || 18)); });
        }, 6000).catch(function() { return null; });
      }));
      const valid = bals.filter(function(b) { return b !== null; });
      if (valid.length > 0) balance = valid.reduce(function(a, b) { return a + b; }, 0);
    }

    // ── Save to cache — only if RPC succeeded (balance !== null) ──
    if (balance === null) { balEl.style.opacity = '1'; balEl.style.pointerEvents = ''; return; }
    const _wkSuffix = _wk.slice(-8);
    const _cacheKey = t.id + ':' + tChain + ':' + _wkSuffix;
    window._balanceCache = window._balanceCache || {};
    window._balanceCacheTime = window._balanceCacheTime || {};
    window._balanceCache[_cacheKey] = balance;
    window._balanceCacheTime[_cacheKey] = Date.now();
    if (typeof _saveBalanceCache === 'function') _saveBalanceCache();

    // ── Update card DOM ──
    const balStr = balance < 0.0001
      ? (balance > 0 ? balance.toExponential(3) : '0')
      : balance.toLocaleString('en-US', { maximumFractionDigits: 4 });
    balEl.textContent = balStr;
    balEl.style.color = balance > 0 ? 'var(--text-primary)' : 'var(--text-muted)';

    const price = (function() {
      try {
        if (typeof _globalPriceCache !== 'undefined' && _globalPriceCache && t.cgId) {
          var pd = _globalPriceCache[t.cgId];
          if (pd && pd.usd) return pd.usd;
        }
      } catch(_e) {}
      return 0;
    })();

    if (usdEl && price > 0 && usdEl.dataset.toggled !== '1') {
      const usdVal = balance * price;
      const usdStr = usdVal > 0 ? _formatCurrencyDisplay(usdVal) : '';
      _smoothSet(usdEl, usdStr);
      card.dataset.usdValue = (usdVal).toFixed(6);
    }

    // ── Sync bridge/swap balance lists ──
    if (typeof window._brSyncBalances === 'function') window._brSyncBalances();
    if (typeof window._swSyncTokenList === 'function') window._swSyncTokenList();
    if (typeof updatePortfolioTotal === 'function') {
      var _total = 0;
      document.querySelectorAll('.token-card[data-usd-value]').forEach(function(c) {
        _total += parseFloat(c.dataset.usdValue || '0') || 0;
      });
      _portfolioTotalUsd = _total;
      updatePortfolioTotal();
    }

  } catch(_err) {
    // Restore previous text on failure, show brief error hint
    balEl.textContent = _prevText || 'err';
    balEl.style.color = 'var(--accent-red)';
    setTimeout(function() {
      if (balEl.textContent === 'err') balEl.textContent = '—';
      balEl.style.color = '';
    }, 1800);
  } finally {
    balEl.style.opacity = '1';
    balEl.style.pointerEvents = '';
  }
};

// ── PORTFOLIO TOTAL (sum of all token USD values) ──
let _portfolioTotalUsd = 0;       // current chain filtered total
let _portfolioAllChainsTotal = 0; // always all-chains total for group pill
let _portfolioUpdateTimer = null;
let _portfolioLastDisplayed = null;

function updatePortfolioTotal() {
  // INSTANT update — no debounce, no fade animation
  if (_portfolioUpdateTimer) clearTimeout(_portfolioUpdateTimer);
  const el = document.getElementById('hw-total-value-text');
  if (!el) return;
  const newVal = _portfolioTotalUsd <= 0
    ? _formatCurrencyDisplay(0)
    : _formatCurrencyDisplay(_portfolioTotalUsd);
  if (_portfolioLastDisplayed === newVal) return;
  _portfolioLastDisplayed = newVal;
  // Set instantly — no opacity fade
  el.style.transition = 'none';
  el.style.opacity = '1';
  el.textContent = newVal;
  // Group pill: re-sum ALL token-card data-usd-value fresh each call (never stale)
  var _allTotal = 0;
  document.querySelectorAll('.token-card[data-usd-value]').forEach(function(c) {
    _allTotal += parseFloat(c.dataset.usdValue || '0') || 0;
  });
  // Always update _portfolioAllChainsTotal — reset to 0 when DOM has nothing
  _portfolioAllChainsTotal = _allTotal;
  var _gpVal = _portfolioAllChainsTotal > 0
    ? _formatCurrencyDisplay(_portfolioAllChainsTotal)
    : newVal;
  const gpEl = document.getElementById('hw-group-total-value');
  if (gpEl) {
    gpEl.style.transition = 'none';
    gpEl.style.opacity = '1';
    gpEl.textContent = _gpVal;
  }
}

// ── SILENT PRICE REFRESH (every 5s — no skeleton, no flicker) ──
let priceRefreshTimer = null; // poll disabled — manual refresh only

// ── Home price source label — hidden (source never shown in UI) ──
function _updateHomePriceSourceLabel(source) {
  // Show only when a wallet is connected
  const _walletKey = (function() {
    try { return _oneGetSelectedKey(); } catch { return null; }
  })();
  const el = document.getElementById('home-price-source-label');
  if (el) {
    el.style.display = (_walletKey || (typeof homeActiveKey !== 'undefined' && homeActiveKey)) ? 'flex' : 'none';
  }
}

// ── Global _smoothSet — debounced text update (no jumping/flicker) ──
// Problem: price fetch and balance fetch arrive at different times for the same
// token-usd element. Without debouncing, the element visibly jumps:
//   price arrives → sets "$0.0034"
//   balance arrives 50ms later → sets "$12.34"
// The user sees a brief flash of the intermediate value.
//
// Fix: buffer all writes to the same element and only commit the latest
// value once no further update arrives within one animation frame (~16ms).
// This collapses rapid bursts (price + balance + silent-refresh) into a
// single silent DOM write — zero visible jumping.
var _smoothSetPending = new Map(); // el → { text, rafId }
function _smoothSet(el, newText) {
  if (!el) return;
  if (el.textContent === newText) return; // already showing correct value

  var pending = _smoothSetPending.get(el);
  if (pending) {
    // Cancel the previously queued rAF for this element and update target text
    cancelAnimationFrame(pending.rafId);
  }

  var rafId = requestAnimationFrame(function() {
    _smoothSetPending.delete(el);
    if (!el.isConnected) return;
    if (el.textContent === newText) return; // re-check — may have been set synchronously
    el.style.transition = 'none';
    el.style.opacity = '1';
    el.textContent = newText;
  });

  _smoothSetPending.set(el, { text: newText, rafId: rafId });
}
// ── _applyCardOrder — re-order token cards ONLY if the order really changed ──
// appendChild() on an already-attached card detaches + re-inserts it. Doing that for every
// card on every sort made the whole list flash (logos reload, rows repaint) on each price /
// balance update. If the order is already correct, touch nothing.
function _applyCardOrder(listEl, ordered) {
  if (!listEl || !ordered) return;
  var current = Array.prototype.filter.call(listEl.children, function(c) {
    return c.classList && c.classList.contains('token-card');
  });
  var same = current.length === ordered.length;
  for (var i = 0; same && i < ordered.length; i++) { if (current[i] !== ordered[i]) same = false; }
  if (same) return;
  ordered.forEach(function(c) { listEl.appendChild(c); });
}
// ── _directSet — instant text update, no animation (cache restores, initial render) ──
function _directSet(el, newText) {
  if (!el || el.textContent === newText) return;
  el.style.transition = 'none';
  el.style.opacity = '1';
  el.textContent = newText;
}
// ── _recalcPortfolioTotal — single source of truth for portfolio sum ──
// Call this instead of manually summing data-usd-value in multiple places
function _recalcPortfolioTotal() {
  var total = 0;
  document.querySelectorAll('.token-card[data-usd-value]').forEach(function(c) {
    total += parseFloat(c.dataset.usdValue || '0') || 0;
  });
  _portfolioTotalUsd = total;
  if (typeof updatePortfolioTotal === 'function') updatePortfolioTotal();
  return total;
}

// BUG FIX 8: silentPriceRefresh concurrent call guard
// একাধিক জায়গা থেকে একসাথে call হলে শুধু একটা চলবে
let _silentPriceRefreshBusy = false;

async function silentPriceRefresh() {
  // BUG FIX 8: Already running — skip duplicate call
  if (_silentPriceRefreshBusy) return;
  _silentPriceRefreshBusy = true;

  try {
  // ── No wallet guard ──
  const _sprWalletKey = (function() {
    try { return _oneGetSelectedKey(); } catch { return null; }
  })();
  if (!_sprWalletKey && !homeActiveKey) return;

  let priceData = null;
  try { priceData = await fetchAllPrices(); } catch(e) { return; }

  // Update source label on home page
  _updateHomePriceSourceLabel(_lastPriceSource);

  const filteredTokens = activeHomeChainId === null
    ? TOKEN_CONFIG
    : TOKEN_CONFIG.filter(t => (t.chainId || 8453) === activeHomeChainId);

  // ── Fetch prices for tokens missing from batch (custom chain native coins + tokens without cgId) ──
  const missingCb = filteredTokens.filter(t => !t.cgId || !priceData[t.cgId]);
  if (missingCb.length > 0) {
    await Promise.allSettled(missingCb.map(async t => {
      // 1. Coinbase
      if (t.cbPair) {
        try {
          const cbData = await fetchPriceCoinbase(t.cbPair);
          if (cbData && cbData.usd > 0) {
            priceData[t.cgId || ('_cb_' + t.id)] = cbData;
            priceData['__tid__' + t.id] = cbData;
            return;
          }
        } catch {}
      }
      // 2. DexScreener symbol fallback
      if (t.sub) {
        try {
          const dsRes = await fetch('https://api.dexscreener.com/latest/dex/search?q=' + encodeURIComponent(t.sub), { signal: AbortSignal.timeout(4000) });
          if (dsRes.ok) {
            const dsData = await dsRes.json();
            const pairs = (dsData.pairs||[]).filter(p => p.baseToken && p.baseToken.symbol && p.baseToken.symbol.toUpperCase() === t.sub.toUpperCase() && p.priceUsd);
            pairs.sort((a,b) => (parseFloat(b.liquidity?.usd||0))-(parseFloat(a.liquidity?.usd||0)));
            if (pairs[0]) {
              const dsPrice = parseFloat(pairs[0].priceUsd);
              if (dsPrice > 0) priceData['__tid__' + t.id] = { usd: dsPrice, usd_24h_change: parseFloat(pairs[0].priceChange?.h24||0) };
            }
          }
        } catch {}
      }
    }));
  }

  // ── Balance fetch removed from silentPriceRefresh ──
  // loadTokens() handles all RPC balance fetching — no race condition
  // silentPriceRefresh only updates prices, reads balance from cache
  const _sprBalFetches = [];

  // ── Now update all cards with fresh price + balance ──
  let _freshTotal = 0;
  for (const t of filteredTokens) {
    const card = document.getElementById('token-card-' + t.id);
    if (!card) continue;

    const pd = priceData[t.cgId] || priceData['__tid__' + t.id];
    const price = (pd && pd.usd) ? pd.usd : 0;

    // Always update balance from cache even if price is missing
    {
      const tChain = t.chainId || 8453;
      const _bkPre = t.id + ':' + tChain + ':' + (_sprWalletKey || homeActiveKey || '').slice(-8);
      const _freshBalPre = (window._balanceCache || {})[_bkPre];
      const balElPre = card.querySelector('.token-amount');
      if (_freshBalPre !== undefined && _freshBalPre !== null && balElPre) {
        const s = _freshBalPre < 0.0001
          ? (_freshBalPre > 0 ? _freshBalPre.toExponential(3) : '0')
          : _freshBalPre.toLocaleString('en-US', {maximumFractionDigits:4});
        if (balElPre.textContent !== s) _smoothSet(balElPre, s);
      }
    }

    if (!price) continue; // no price — balance already updated above, skip USD calc
    const change24h = pd.usd_24h_change || 0;
    const _ch24c = (change24h == null || isNaN(change24h)) ? 0 : change24h;
    const pctSign = _ch24c >= 0 ? '+' : '';
    const pctColor = _ch24c > 0 ? 'var(--accent-green)' : _ch24c < 0 ? 'var(--accent-red)' : 'var(--text-muted)';
    const pctText = _ch24c !== 0 ? `${pctSign}${_ch24c.toFixed(2)}%` : '';
    const priceStr = _formatCurrencyDisplay(price);

    // Get latest balance — prefer freshly fetched from cache
    const tChain = t.chainId || 8453;
    const _bk = t.id + ':' + tChain + ':' + (_sprWalletKey || homeActiveKey || '').slice(-8);
    const _freshBal = (window._balanceCache || {})[_bk];
    const balEl = card.querySelector('.token-amount');

    // Update balance ONLY if value actually changed — no flicker on same value
    if (_freshBal !== undefined && _freshBal !== null && balEl) {
      const newBalStr = _freshBal < 0.0001
        ? (_freshBal > 0 ? _freshBal.toExponential(3) : '0')
        : _freshBal.toLocaleString('en-US', {maximumFractionDigits:4});
      if (balEl.textContent !== newBalStr) _smoothSet(balEl, newBalStr);
    }

    // Compute USD from best available balance
    const balRaw = _freshBal !== undefined ? _freshBal
      : (balEl ? parseFloat(balEl.textContent.replace(/,/g,'')) : NaN);
    const hasBalance = !isNaN(balRaw) && balRaw > 0;
    const usdValNum = hasBalance ? balRaw * price : 0;

    const usdEl = card.querySelector('.token-usd');
    if (usdEl) {
      const usdVal = hasBalance
        ? _formatCurrencyDisplay(usdValNum)
        : '';
      if (usdEl.textContent !== usdVal) _smoothSet(usdEl, usdVal);
      usdEl.style.color = ''; usdEl.classList.toggle('has-balance', hasBalance);
      if (hasBalance) {
        card.dataset.usdValue = usdValNum.toFixed(6);
      } else {
        card.dataset.usdValue = '0';
      }
    }
    if (hasBalance) _freshTotal += usdValNum;

    // Update live price label — only if changed
    const lpEl = document.getElementById('tlp-' + t.id);
    if (lpEl) {
      const lpPrice = lpEl.querySelector('.tlp-price');
      const lpChange = lpEl.querySelector('.tlp-change');
      if (lpPrice && lpPrice.textContent !== priceStr) _smoothSet(lpPrice, priceStr);
      if (lpChange) {
        if (lpChange.textContent !== pctText) {
          lpChange.style.transition = 'color 0.4s ease, opacity 0.3s ease';
          lpChange.textContent = pctText;
          lpChange.style.color = pctColor;
        }
      }
    }
  }

  // Recompute portfolio total ONCE after all tokens updated
  // Only update if we got at least some fresh USD data — never zero-out from a partial refresh
  if (_freshTotal > 0) {
    _portfolioTotalUsd = _freshTotal;
    updatePortfolioTotal();
  } else if (_freshTotal === 0) {
    // All balances are zero — verify by checking if ANY card has a non-zero balance
    var _anyBal = false;
    document.querySelectorAll('.token-card[data-usd-value]').forEach(function(c) {
      if (parseFloat(c.dataset.usdValue || '0') > 0) _anyBal = true;
    });
    if (!_anyBal) {
      _portfolioTotalUsd = 0;
      updatePortfolioTotal();
    }
    // else: keep existing displayed total — balances fetched but prices missing
  }

  // ── Re-sort by USD value descending after fresh data ──
  (function _sortAfterRefresh() {
    const listEl = document.getElementById('token-list');
    if (!listEl) return;
    const cards = Array.from(listEl.querySelectorAll('.token-card'));
    // Stamp stable index before sort so equal-USD cards never swap
    cards.forEach((c, i) => { if (!c.dataset.stableIdx) c.dataset.stableIdx = String(i); });
    cards.sort((a, b) => {
      const av = parseFloat(a.dataset.usdValue || '0');
      const bv = parseFloat(b.dataset.usdValue || '0');
      if (av > 0 && bv <= 0) return -1;
      if (bv > 0 && av <= 0) return 1;
      if (av > 0 && bv > 0) {
        const diff = bv - av;
        if (Math.abs(diff) < 0.000001) return parseInt(a.dataset.stableIdx, 10) - parseInt(b.dataset.stableIdx, 10);
        return diff;
      }
      return parseInt(a.dataset.stableIdx, 10) - parseInt(b.dataset.stableIdx, 10);
    });
    _applyCardOrder(listEl, cards);
  })();

  // ── Save balance cache + token snapshot with fresh data (single save after all complete) ──
  if (typeof _saveBalanceCache === 'function') _saveBalanceCache();
  if (typeof window._onePTRSaveNow === 'function') window._onePTRSaveNow();

  } catch(e) {
    // silentPriceRefresh error — silent fail
  } finally {
    // BUG FIX 8: সবসময় busy flag release করো
    _silentPriceRefreshBusy = false;
  }
}

// startPriceRefresh() removed — auto-poll disabled, refresh on page switch only



// ══════════════════════════════════════════════
// MULTI-KEY SWAP SYSTEM
// ══════════════════════════════════════════════

let validatedKeys = [];
