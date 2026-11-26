
// ── RENDER TOKEN CARD ──
// ── Token logo helper: CoinGecko API → TrustWallet CDN → LiFi CDN → letter fallback ──

// Cache for CoinGecko image URLs
// TrustWallet chain slug mapping
const TW_CHAIN_SLUG = {
  1:      'ethereum',
  8453:   'base',
  42161:  'arbitrum',
  10:     'optimism',
  137:    'polygon',
  56:     'smartchain',
  43114:  'avalanchec',
  59144:  'linea',
  534352: 'scroll',
  324:    'zksync',
};
function _twLogoUrl(t) {
  const slug = TW_CHAIN_SLUG[t.chainId || 8453] || 'base';
  return 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/' + slug + '/assets/' + t.contract + '/logo.png';
}
function _lifiLogoUrl(t) {
  return 'https://raw.githubusercontent.com/lifinance/types/main/src/assets/icons/tokens/' + t.contract.toLowerCase() + '.png';
}

const _cgLogoCache = {};

// Build a fallback <div> element (DOM node, not string)
function _makeFallbackEl(t) {
  const letter = (t.icon && t.icon.length <= 3) ? t.icon : (t.sub||t.name||'?').slice(0,2).toUpperCase();
  const color  = t.color || 'var(--accent-primary)';
  const el = document.createElement('div');
  el.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;border-radius:14px;';
  el.style.color = color;
  el.style.background = color + '22';
  el.textContent = letter;
  return el;
}

// Build an <img> element with fallback chain (DOM node)
function _makeImgEl(src, alt, onErrorSrc, t) {
  const img = document.createElement('img');
  img.src = src;
  img.alt = alt;
  img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:14px;';
  img.addEventListener('error', function onErr() {
    img.removeEventListener('error', onErr);
    if (onErrorSrc) {
      img.src = onErrorSrc;
      img.addEventListener('error', function() {
        img.parentNode && img.parentNode.replaceChild(_makeFallbackEl(t), img);
      }, { once: true });
    } else {
      img.parentNode && img.parentNode.replaceChild(_makeFallbackEl(t), img);
    }
  }, { once: true });
  return img;
}

// Inject CoinGecko logo into a container element
function _injectCgLogo(container, url, t) {
  const img = _makeImgEl(url, t.sub, null, t);
  if (container) container.innerHTML = '';
  container.appendChild(img);
}

// Async fetch CoinGecko logo and inject into all matching containers
// Uses /coins/markets batch endpoint (1 call for all tokens) instead of per-token calls.
// Falls back to constructing a CDN URL via a lightweight HEAD check.
const _cgLogoBatchQueue = [];
let _cgLogoBatchTimer = null;

function _fetchAndInjectCgLogo(t) {
  _cgLogoCache[t.cgId] = 'pending';

  // 1. Try constructing CDN URL directly (no API call needed):
  //    CoinGecko CDN pattern: https://assets.coingecko.com/coins/images/{id}/small/{name}.png
  //    We can get this from /coins/markets in a batch — queue up and fire once.
  _cgLogoBatchQueue.push(t);
  if (_cgLogoBatchTimer) clearTimeout(_cgLogoBatchTimer);
  _cgLogoBatchTimer = setTimeout(_flushCgLogoBatch, 80); // wait 80ms to collect all tokens
}

async function _flushCgLogoBatch() {
  _cgLogoBatchTimer = null;
  const batch = _cgLogoBatchQueue.splice(0);
  if (!batch.length) return;

  // Only fetch tokens still pending
  const pending = batch.filter(t => _cgLogoCache[t.cgId] === 'pending');
  if (!pending.length) return;

  const ids = [...new Set(pending.map(t => t.cgId))].join(',');
  const path = 'coins/markets?vs_currency=usd&ids=' + encodeURIComponent(ids) + '&per_page=250&page=1&sparkline=false';

  try {
    const data = await _cgFetch(path);
    if (Array.isArray(data)) {
      const byId = {};
      data.forEach(function(coin) { byId[coin.id] = coin.image || null; });
      pending.forEach(function(t) {
        const url = byId[t.cgId] || null;
        _cgLogoCache[t.cgId] = url || 'none';
        if (!url) return;
        document.querySelectorAll('[data-cgid="' + t.cgId + '"]').forEach(function(container) {
          _injectCgLogo(container, url, t);
        });
      });
      return;
    }
  } catch(e) { /* fall through */ }

  // Fallback: mark all as none so we stop retrying
  pending.forEach(function(t) {
    if (_cgLogoCache[t.cgId] === 'pending') _cgLogoCache[t.cgId] = 'none';
  });
}

function getTokenLogoEl(t) {
  const color = t.color || 'var(--accent-primary)';

  // Wrapper div that all paths return
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'width:100%;height:100%;border-radius:14px;overflow:hidden;';

  // 1. Explicit logoUrl (custom token added via CoinGecko search)
  if (t.logoUrl) {
    wrapper.appendChild(_makeImgEl(t.logoUrl, t.sub, null, t));
    return wrapper;
  }

  // 2. Native token — always show chain logo (not CoinGecko ethereum logo)
  if (t.isNative) {
    // If token has explicit logoUrl (from chainlist icon), use it
    if (t.logoUrl) {
      wrapper.appendChild(_makeImgEl(t.logoUrl, t.sub, null, t));
      return wrapper;
    }
    const slug = TW_CHAIN_SLUG[t.chainId || 8453];
    const chainDef = (typeof CHAINS !== 'undefined') && CHAINS.find(function(c){ return c.chainId === t.chainId; });
    const chainLogoUrl = slug ? 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/' + slug + '/info/logo.png' : null;
    const fallbackUrl = (chainDef && chainDef.logoURI) ? chainDef.logoURI : null;
    if (chainLogoUrl) {
      wrapper.appendChild(_makeImgEl(chainLogoUrl, t.sub, fallbackUrl, t));
    } else if (fallbackUrl) {
      wrapper.appendChild(_makeImgEl(fallbackUrl, t.sub, null, t));
    } else {
      wrapper.appendChild(_makeFallbackEl(t));
    }
    return wrapper;
  }

  // 3. CoinGecko async path
  if (t.cgId) {
    wrapper.setAttribute('data-cgid', t.cgId);
    const cached = _cgLogoCache[t.cgId];

    if (cached && cached !== 'pending' && cached !== 'none') {
      // Already have URL — inject immediately
      wrapper.appendChild(_makeImgEl(cached, t.sub, null, t));
      return wrapper;
    }

    if (!cached) {
      // Not yet fetched — kick off fetch
      _fetchAndInjectCgLogo(t);
    } else if (cached === 'pending') {
      // Already fetching — poll until resolved, then inject into this new wrapper
      var _pollAttempts = 0;
      var _pollTimer = setInterval(function() {
        _pollAttempts++;
        var resolved = _cgLogoCache[t.cgId];
        if ((resolved && resolved !== 'pending') || _pollAttempts > 30) {
          clearInterval(_pollTimer);
          if (resolved && resolved !== 'pending' && resolved !== 'none' && wrapper.isConnected) {
            _injectCgLogo(wrapper, resolved, t);
          }
        }
      }, 200);
    }
    // While pending/none — show TrustWallet → LiFi → fallback as placeholder
    if (t.contract && /^0x[0-9a-fA-F]{40}$/.test(t.contract)) {
      const lifi = _lifiLogoUrl(t);
      const tw   = _twLogoUrl(t);
      wrapper.appendChild(_makeImgEl(tw, t.sub, lifi, t));
    } else {
      wrapper.appendChild(_makeFallbackEl(t));
    }
    return wrapper;
  }

  // 3. No cgId — TrustWallet → LiFi → letter fallback
  if (t.contract && /^0x[0-9a-fA-F]{40}$/.test(t.contract)) {
    const lifi = _lifiLogoUrl(t);
    const tw   = _twLogoUrl(t);
    wrapper.appendChild(_makeImgEl(tw, t.sub, lifi, t));
    return wrapper;
  }

  // 4. Pure letter fallback
  wrapper.appendChild(_makeFallbackEl(t));
  return wrapper;
}

// Thin string shim used by tm-token-icon / send modal (still need innerHTML path)
function getTokenLogoHTML(t) {
  const letter = (t.icon && t.icon.length <= 3) ? t.icon : (t.sub||t.name||'?').slice(0,2).toUpperCase();
  const color  = t.color || 'var(--accent-primary)';
  const fallback = '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;border-radius:14px;color:' + color + ';background:' + color + '22;">' + letter + '</div>';
  if (t.logoUrl) {
    return '<img src="' + t.logoUrl + '" alt="' + t.sub + '" style="width:100%;height:100%;object-fit:cover;border-radius:14px;">';
  }
  if (t.isNative) {
    // Always show chain logo for native tokens (ETH Optimism → OP, ETH Base → Base, etc.)
    const slug = TW_CHAIN_SLUG[t.chainId || 8453] || 'base';
    const nativeUrl = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/' + slug + '/info/logo.png';
    return '<img src="' + nativeUrl + '" alt="' + t.sub + '" style="width:100%;height:100%;object-fit:cover;border-radius:14px;" onerror="this.style.display=\'none\';this.parentNode.innerHTML=\'<div style=&quot;width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;border-radius:14px;&quot;>' + (t.icon||t.sub.slice(0,2)) + '</div>\'">';
  }
  const cached = t.cgId && _cgLogoCache[t.cgId];
  if (cached && cached !== 'pending' && cached !== 'none') {
    return '<img src="' + cached + '" alt="' + t.sub + '" style="width:100%;height:100%;object-fit:cover;border-radius:14px;">';
  }
  if (t.contract && /^0x[0-9a-fA-F]{40}$/.test(t.contract)) {
    const tw   = _twLogoUrl(t);
    const lifi = _lifiLogoUrl(t);
    return '<img src="' + tw + '" alt="' + t.sub + '" style="width:100%;height:100%;object-fit:cover;border-radius:14px;" onerror="this.src=\'' + lifi + '\';this.onerror=function(){this.outerHTML=\'<div style=&quot;width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;border-radius:14px;color:' + color + ';background:' + color + '22;&quot;>' + letter + '</div>\'}">';
  }
  return fallback;
}

function renderTokenCard(t, price, change24h, balance, list, idx) {
  // If a restored card already exists, update it in-place — don't remove/recreate (prevents flash)
  const existing = document.getElementById('token-card-' + t.id);
  if (existing) {
    // Wire up event handlers and logo that may be missing on restored cards
    const iconDiv = existing.querySelector('.token-icon');
    if (iconDiv) {
      if (!iconDiv.id) iconDiv.id = 'ticon-' + t.id;
      iconDiv.setAttribute('data-cgid', t.cgId || '');
      iconDiv.onclick = function(ev) { ev.stopPropagation(); showTokenAddrPopup(t.id, t.contract||'', t.sub, this); };
      if (!iconDiv.querySelector('img') && !iconDiv.querySelector('div[style*="border-radius"]')) {
        iconDiv.innerHTML = '';
        const logoEl = getTokenLogoEl(t);
        logoEl.style.width = '100%'; logoEl.style.height = '100%';
        iconDiv.appendChild(logoEl);
      }
    }
    // Re-wire card click handler
    existing.onclick = function(e) {
      if (e.target.closest('#ticon-' + t.id)) return;
      rippleEffect(this, e);
      showTokenSwapSheet(t);
    };
    // Add long-press listeners ONCE only — flag prevents stacking on re-renders
    if (!existing._lpBound) {
      existing._lpBound = true;
      let _lpTimer2 = null, _lpActive2 = false;
      existing.addEventListener('touchstart', function(e) {
        _lpActive2 = false;
        _lpTimer2 = setTimeout(() => { _lpActive2 = true; _lpTimer2 = null; haptic && haptic(); showTokenDeleteConfirm(existing, t); }, 650);
      }, { passive: true });
      existing.addEventListener('touchend', function() { clearTimeout(_lpTimer2); _lpTimer2 = null; }, { passive: true });
      existing.addEventListener('touchmove', function() { clearTimeout(_lpTimer2); _lpTimer2 = null; }, { passive: true });
    }
    // Update price — always update if we have a price
    if (price > 0) {
      const priceStr2 = _formatCurrencyDisplay(price);
      const lpEl = document.getElementById('tlp-' + t.id);
      if (lpEl) { const lp = lpEl.querySelector('.tlp-price'); if (lp) lp.textContent = priceStr2; }
    }
    if (balance !== null && balance !== undefined) {
      // Fresh balance — update amount and usd
      const balEl2 = existing.querySelector('.token-amount');
      const usdEl2 = existing.querySelector('.token-usd');
      const balFormatted = balance < 0.0001 ? (balance > 0 ? balance.toExponential(3) : '0') : balance.toLocaleString('en-US', {maximumFractionDigits:4});
      if (balEl2) balEl2.textContent = balFormatted;
      if (usdEl2 && price > 0 && usdEl2.dataset.toggled !== '1') {
        const usdVal2 = balance * price;
        const usdStr2 = usdVal2 > 0 ? _formatCurrencyDisplay(usdVal2) : '';
        _smoothSet(usdEl2, usdStr2);
        existing.dataset.usdValue = (usdVal2).toFixed(6);
      }
    }
    // If balance is null (cache restore pass), keep whatever is already in the DOM — do NOT blank it
    return; // keep existing card as-is
  }

  const usdVal = balance !== null ? (balance * price) : null;
  // Note: portfolio total is updated after fetchAllPrices resolves — not on initial render
  const _ch24 = (change24h == null || isNaN(change24h)) ? 0 : change24h;
  const pctSign = _ch24 >= 0 ? '+' : '';
  const pctColor = _ch24 > 0 ? 'var(--accent-green)' : _ch24 < 0 ? 'var(--accent-red)' : 'var(--text-muted)';
  const pctText = _ch24 !== 0 ? `${pctSign}${_ch24.toFixed(2)}%` : '';
  const priceStr = _formatCurrencyDisplay(price);
  const balStr = balance !== null
    ? (balance < 0.0001 ? balance.toExponential(3) : balance.toLocaleString('en-US', {maximumFractionDigits:4}))
    : '—';
  // ── Anti-flicker: if balance is unknown (null), show price ONLY when balance>0 is confirmed cached
  // Showing priceStr when balance=null causes a value jump (priceStr → balance*priceStr) once balance loads
  // Instead: show priceStr only when balance is actually known (non-null), else show the token price quietly
  const usdStr = usdVal !== null
    ? (usdVal > 0 ? _formatCurrencyDisplay(usdVal) : '')   // zero balance: no USD line (right side shows balance only)
    : '';

  const el = document.createElement('div');
  el.className = 'token-card';
  el.id = 'token-card-' + t.id;
  // Staggered entrance: only animate once per card ID per session
  const _delay = Math.min(idx * 55, 320); // max 320ms total stagger
  if (!_animatedTokenIds.has(t.id)) {
    _animatedTokenIds.add(t.id);
    el.style.animationDelay = _delay + 'ms';
    el.classList.add('tc-animate');
    setTimeout(() => { el.classList.remove('tc-animate'); el.style.animationDelay = ''; }, _delay + 420);
  }
  // Long-press → show delete confirm UI (no browser confirm())
  let _lpTimer = null, _lpActive = false;
  el.addEventListener('touchstart', function(e) {
    _lpActive = false;
    _lpTimer = setTimeout(() => {
      _lpActive = true;
      _lpTimer = null;
      haptic && haptic();
      showTokenDeleteConfirm(el, t);
    }, 650);
  }, { passive: true });
  el.addEventListener('touchend',  function() { clearTimeout(_lpTimer); _lpTimer = null; }, { passive: true });
  el.addEventListener('touchmove', function() { clearTimeout(_lpTimer); _lpTimer = null; }, { passive: true });
  el.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    showTokenDeleteConfirm(el, t);
  });
  // Single click — show SWAP action sheet (no delete option)
  el.onclick = function(e) {
    if (_lpActive) { _lpActive = false; return; }
    if (e.target.closest('#ticon-' + t.id)) return;
    rippleEffect(this, e);
    showTokenSwapSheet(t);
  };
  el.innerHTML = `
    <div class="token-icon" id="ticon-${t.id}" data-cgid="${t.cgId||''}" style="background:${t.color}22;color:${t.color};font-size:16px;overflow:hidden;cursor:pointer;position:relative;"></div>
    <div class="token-info">
      <div class="token-name" style="display:flex;align-items:center;gap:5px;">${t.name}</div>
      <div class="token-sub" style="display:flex;align-items:center;gap:6px;">
        <span style="font-weight:700;color:var(--text-secondary);">${t.sub}</span>${activeHomeChainId === null && t.chainId ? ` <span style="font-size:9px;padding:1px 5px;border-radius:4px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:var(--text-muted);">${getAllChains().find(c=>c.chainId===t.chainId)?.name || 'Chain '+t.chainId}</span>` : ''}
      </div>
      <div class="token-live-price" id="tlp-${t.id}" style="font-family:var(--font-mono);font-size:10px;color:var(--text-secondary);margin-top:2px;display:flex;align-items:center;gap:4px;opacity:1;">
        <span class="tlp-price">${price > 0 ? priceStr : '—'}</span>
        <span class="tlp-change" style="font-size:9px;font-weight:700;color:${pctColor};">${change24h !== 0 ? pctText : ''}</span>
      </div>
    </div>
    <div class="token-value">
      <div class="token-amount" onclick="event.stopPropagation();window.refreshTokenBalance&&window.refreshTokenBalance('${t.id}')" title="Tap to refresh balance" style="cursor:pointer;">${balStr}</div>
      <div class="token-usd">${usdStr}</div>
    </div>
    <div class="token-badge" style="background:${t.badge}44;"></div>
  `;
  // Inject logo via DOM (avoids all HTML quote-escaping issues)
  const iconDiv = el.querySelector('#ticon-' + t.id);
  iconDiv.onclick = function(ev) { ev.stopPropagation(); showTokenAddrPopup(t.id, t.contract||'', t.sub, this); };
  iconDiv.appendChild(getTokenLogoEl(t));
  list.appendChild(el);
}

// ── Session counter to cancel stale async callbacks on wallet switch ──
let _loadTokensSession = 0;
// ── Track which token card IDs have already animated — never animate twice ──
const _animatedTokenIds = new Set();

// ── Balance cache TTL: 5 minutes ──
const _BAL_CACHE_TTL = Infinity; // no expiry — RPC overwrites cache when fresh data arrives

// ── Persist balance cache to localStorage (wallet-specific key) ──
function _saveBalanceCache() {
  try {
    var _wk = (function() {
      try { return _oneGetSelectedKey(); } catch { return null; }
    })();
    if (!_wk) return;
    var payload = {
      walletKey: _wk,
      cache: window._balanceCache || {},
      cacheTime: window._balanceCacheTime || {},
      saved: Date.now()
    };
    localStorage.setItem('one_bal_cache_' + _wk.slice(-8), JSON.stringify(payload));
  } catch(e) {}
}

// ── Restore balance cache from localStorage on app open ──
function _restoreBalanceCache() {
  try {
    var _wk = (function() {
      try { return _oneGetSelectedKey(); } catch { return null; }
    })();
    // No wallet selected — never restore any balance cache
    if (!_wk) return;
    var raw = localStorage.getItem('one_bal_cache_' + _wk.slice(-8));
    if (!raw) return;
    var data = JSON.parse(raw);
    if (!data) return;
    // Wallet key mismatch guard
    if (data.walletKey && data.walletKey !== _wk) return;
    // No expiry — restore always (RPC will overwrite with fresh data)
    window._balanceCache = window._balanceCache || {};
    window._balanceCacheTime = window._balanceCacheTime || {};
    Object.keys(data.cache || {}).forEach(function(k) {
      if (window._balanceCache[k] === undefined) {
        window._balanceCache[k] = data.cache[k];
        window._balanceCacheTime[k] = data.cacheTime[k] || data.saved;
      }
    });
  } catch(e) {}
}
