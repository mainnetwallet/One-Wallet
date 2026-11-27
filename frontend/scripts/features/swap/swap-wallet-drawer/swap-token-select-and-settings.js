
let _swContractFetchTimer = null;
let _swPendingContractToken = null;

window.swFilterTokens = function(q) {
  const statusEl = document.getElementById('sw-contract-status');
  const previewEl = document.getElementById('sw-contract-preview');
  _swPendingContractToken = null;

  // Hide contract preview by default
  if (previewEl) previewEl.style.display = 'none';
  if (statusEl) { statusEl.style.display = 'none'; statusEl.textContent = ''; }

  const isAddress = /^0x[0-9a-fA-F]{40}$/.test(q.trim());

  if (isAddress) {
    // Show loading status
    if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = '⏳ Fetching token info from contract…'; statusEl.style.color = 'var(--text-muted)'; }
    // Filter existing tokens by contract
    const byContract = _swAllTokens.filter(t => t.contract && t.contract.toLowerCase() === q.trim().toLowerCase());
    swRenderTokenList(byContract);
    // Debounced fetch
    clearTimeout(_swContractFetchTimer);
    _swContractFetchTimer = setTimeout(() => _swFetchContractToken(q.trim()), 600);
  } else {
    const filtered = _swAllTokens.filter(t =>
      t.sym.toLowerCase().includes(q.toLowerCase()) ||
      t.name.toLowerCase().includes(q.toLowerCase()) ||
      (t.contract && t.contract.toLowerCase().includes(q.toLowerCase()))
    );
    swRenderTokenList(filtered);
  }
};

async function _swFetchContractToken(addr) {
  const statusEl = document.getElementById('sw-contract-status');
  const previewEl = document.getElementById('sw-contract-preview');
  const iconEl = document.getElementById('sw-contract-icon');
  const symEl = document.getElementById('sw-contract-sym');
  const nameEl = document.getElementById('sw-contract-name');

  // Check if already in token list
  const existing = _swAllTokens.find(t => t.contract && t.contract.toLowerCase() === addr.toLowerCase());
  if (existing) {
    if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = '✓ Token already in list'; statusEl.style.color = 'var(--accent-green)'; }
    swRenderTokenList([existing]);
    return;
  }

  // Try ERC20 via RPC
  const ERC20_ABI = ['function symbol() view returns (string)','function name() view returns (string)','function decimals() view returns (uint8)'];
  let sym = '', tname = '', decimals = 18;
  try {
    const chainId = SW.network?.chainId || SW.chainId || 8453;
    const provider = await _getSwapProvider(chainId);
    if (provider) {
      const ct = new ethers.Contract(addr, ERC20_ABI, provider);
      [sym, tname, decimals] = await Promise.all([
        ct.symbol().catch(() => ''),
        ct.name().catch(() => ''),
        ct.decimals().catch(() => 18)
      ]);
    }
  } catch(e) {}

  // Fallback: try DexScreener
  if (!sym) {
    try {
      const dsRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${addr}`);
      const dsJson = await dsRes.json();
      const pair = dsJson?.pairs?.[0];
      if (pair) {
        const bt = pair.baseToken;
        sym = bt?.symbol || '';
        tname = bt?.name || '';
      }
    } catch(e) {}
  }

  if (!sym) {
    if (statusEl) { statusEl.textContent = '❌ Could not fetch token info for this contract'; statusEl.style.color = 'var(--accent-red)'; }
    return;
  }

  const token = {
    id: 'custom-' + addr.slice(2,8).toLowerCase(),
    sym: sym,
    name: tname || sym,
    icon: sym.slice(0,2),
    color: '#6366f1,#8b5cf6',
    contract: addr,
    decimals: Number(decimals),
    price: 0,
    balance: 0,
    chainId: SW.chainId || 8453,
    isCustom: true
  };

  _swPendingContractToken = token;

  if (statusEl) { statusEl.textContent = '✅ Token found — tap card to select'; statusEl.style.color = 'var(--accent-green)'; }
  if (iconEl) iconEl.textContent = sym.slice(0,2);
  if (symEl) symEl.textContent = sym;
  if (nameEl) nameEl.textContent = tname + ' · ' + addr.slice(0,8) + '…' + addr.slice(-6);
  if (previewEl) previewEl.style.display = 'block';
}

window.swSelectContractToken = function() {
  if (!_swPendingContractToken) return;
  const t = _swPendingContractToken;
  if (_swPickerSide === 'from') {
    SW.fromToken = t;
  } else {
    SW.toToken = t;
  }
  // Also push into custom tokens so it persists this session
  if (!_swAllTokens.find(x => x.contract && x.contract.toLowerCase() === t.contract.toLowerCase())) {
    _swAllTokens.push(t);
  }
  // Token changed — clear router cache, new quotes will repopulate
  SW._routerCache      = {};
  SW._cachedRouterAddr = null;
  swCloseTokenPicker();
  swUpdateUI();
  const inp = document.getElementById('sw-from-amount');
  if (inp && inp.value) swOnAmountChange();
};
window.swSelectToken = function(sym) {
  const token = _nxsw_getTokens().find(t => t.sym === sym);
  if (!token) return;
  if (_swPickerSide === 'from') {
    // Same as TO? → swap them
    if (SW.toToken && SW.toToken.sym === sym) {
      const tmp = SW.toToken;
      SW.toToken = SW.fromToken;
      SW.fromToken = tmp;
    } else {
      SW.fromToken = token;
    }
  } else {
    // Same as FROM? → swap them
    if (SW.fromToken && SW.fromToken.sym === sym) {
      const tmp = SW.fromToken;
      SW.fromToken = SW.toToken;
      SW.toToken = tmp;
    } else {
      SW.toToken = token;
    }
  }
  swCloseTokenPicker();
  swUpdateUI();
  const inp = document.getElementById('sw-from-amount');
  if (inp && inp.value) swOnAmountChange();
};

/* ── Settings ── */
// Drop focus from any text field first, so the keyboard does not pop up behind the popup
function _swBlurActiveInput() {
  try {
    var a = document.activeElement;
    if (a && a !== document.body && /^(INPUT|TEXTAREA)$/.test(a.tagName)) a.blur();
  } catch (e) {}
}
window._swBlurActiveInput = _swBlurActiveInput;

window.swOpenSettings = function() {
  const m = document.getElementById('sw-settings-modal');
  if (!m) return;
  _swBlurActiveInput();
  if (m.parentElement !== document.body) document.body.appendChild(m);
  m.classList.add('sw-open');
  document.body.style.overflow = 'hidden';
};
window.swCloseSettings = function() {
  const m = document.getElementById('sw-settings-modal');
  if (!m) return;
  m.classList.remove('sw-open');
  setTimeout(function() { document.body.style.overflow = ''; }, 300);
};
window.swSelectSlipAdv = function(el, val) {
  document.querySelectorAll('.sw-slip-chip-lg').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  SW.slippage = parseFloat(val);
  document.getElementById('sw-adv-slip').value = val;
};
window.swAdvSlipInput = function(val) {
  SW.slippage = parseFloat(val) || 0.5;
  document.querySelectorAll('.sw-slip-chip-lg').forEach(c => c.classList.remove('selected'));
};
window.swToggleMultiRoute = function(el) {
  SW.multiRoute = el.dataset.on !== 'true';
  el.dataset.on = SW.multiRoute;
  el.style.background = SW.multiRoute ? 'var(--accent-primary)' : 'var(--bg-raised)';
  el.style.borderColor = SW.multiRoute ? 'var(--accent-primary)' : 'var(--border-subtle)';
  el.querySelector('div').style.right = SW.multiRoute ? '2px' : 'auto';
  el.querySelector('div').style.left = SW.multiRoute ? 'auto' : '2px';
};
window.swToggleExpert = function(el) {
  const on = el.dataset.on !== 'true';
  el.dataset.on = on;
  el.style.background = on ? 'var(--accent-red)' : 'var(--bg-raised)';
  el.style.borderColor = on ? 'var(--accent-red)' : 'var(--border-subtle)';
  el.querySelector('div').style.right = on ? '2px' : 'auto';
  el.querySelector('div').style.left = on ? 'auto' : '2px';
  el.querySelector('div').style.background = on ? '#fff' : 'var(--text-muted)';
};