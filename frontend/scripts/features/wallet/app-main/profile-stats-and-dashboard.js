
function _loadDelegationCache() {
  try {
    var raw = localStorage.getItem(_ONE_DEL_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function updateProfileStats() {
  // ── Reads from cache ONLY — no RPC call ──
  // RPC call হবে শুধু DELEGATED stat card click করলে (profileDelegatedCardClick)
  var walletEl  = document.getElementById('profile-stat-wallets');
  var delEl     = document.getElementById('profile-stat-keys');
  var ndelEl    = document.getElementById('profile-stat-notdelegated');
  var statsWrap = document.getElementById('profile-stats-wrap');

  var hasSelected = typeof settingsKeys !== 'undefined' && settingsKeys.length > 0;

  if (!hasSelected) {
    if (walletEl) walletEl.textContent = '—';
    if (delEl)    delEl.textContent    = '—';
    if (ndelEl)   ndelEl.textContent   = '—';
    if (statsWrap) {
      statsWrap.style.opacity = '0.35';
      statsWrap.style.pointerEvents = 'none';
      var hint = document.getElementById('profile-stats-hint');
      if (hint) hint.style.display = 'flex';
    }
    return;
  }

  if (statsWrap) {
    statsWrap.style.opacity = '1';
    statsWrap.style.pointerEvents = 'auto';
    var hint2 = document.getElementById('profile-stats-hint');
    if (hint2) hint2.style.display = 'none';
  }

  var total = settingsKeys.length;
  if (walletEl) walletEl.textContent = total;

  if (total === 0) {
    if (delEl)  delEl.textContent  = '0';
    if (ndelEl) ndelEl.textContent = '0';
    return;
  }

  // Load from cache — no RPC
  var cache = _loadDelegationCache();
  var effectiveChainId = (typeof _profSelectedChainId !== 'undefined' && _profSelectedChainId !== null)
    ? _profSelectedChainId : 8453;

  if (cache && cache.chainId === effectiveChainId) {
    // Cache আছে এবং same chain — সরাসরি দেখাও, কোনো RPC নয়
    if (delEl)  delEl.textContent  = String(cache.delegated);
    if (ndelEl) ndelEl.textContent = String(total - cache.delegated);
  } else {
    // No cache for this chain — auto trigger RPC check silently
    if (delEl)  delEl.textContent  = '…';
    if (ndelEl) ndelEl.textContent = '…';
    setTimeout(function() {
      if (typeof profileDelegatedCardClick === 'function') {
        var card = document.getElementById('delegated-stat-card');
        profileDelegatedCardClick(card, null);
      }
    }, 300);
  }
}

// ── UPDATE HOME & PROFILE WITH KEY DATA (uses settingsKeys from Settings selection) ──
function renderProfileChainBadges() {
  // Profile chain badges removed — chain display is now the grid selector
  // Keep function for backward compatibility with updateDashboard calls
}

function updateDashboard() {
  renderProfileChainBadges();
  const count = settingsKeys.length;

  // ── HOME ──
  const homeChips = document.getElementById('home-wallet-chips');

  homePopulateGroups();

  if (count === 0) {
    if (homeChips) homeChips.style.display = 'none';
  } else {
    if (homeChips) homeChips.style.display = 'none';
  }

  // ── PROFILE ──
  const profAddrText = document.getElementById('profile-addr-text');
  const profStatWallets = document.getElementById('profile-stat-wallets');
  const profStatKeys = document.getElementById('profile-stat-keys');

  // Count total wallets across ALL groups (regardless of selection)
  const allGroups = loadWalletGroups ? loadWalletGroups() : [];
  const totalWalletsAll = allGroups.reduce((s, g) => s + (g.keys ? g.keys.length : 0), 0);

  if (count === 0) {
    if (profAddrText) profAddrText.textContent = totalWalletsAll > 0 ? totalWalletsAll + ' wallet' + (totalWalletsAll !== 1 ? 's' : '') + ' across ' + allGroups.length + ' group' + (allGroups.length !== 1 ? 's' : '') : 'No wallets imported';
    const profHeroWC0 = document.getElementById('prof-hero-wallet-count');
    if (profHeroWC0) profHeroWC0.textContent = totalWalletsAll > 0 ? totalWalletsAll + (totalWalletsAll !== 1 ? ' WALLETS' : ' WALLET') : 'WALLETS';
    const addrWrap = document.getElementById('profile-addr-wrap');
    if (addrWrap) { addrWrap.style.opacity = '0.35'; addrWrap.style.pointerEvents = 'none'; }
  } else {
    let firstAddr = '';
    try { firstAddr = new ethers.Wallet(settingsKeys[0]).address; } catch(e){}
    const shortAddr = firstAddr ? firstAddr.slice(0,8) + '...' + firstAddr.slice(-6) : 'Unknown';
    if (profAddrText) profAddrText.textContent = shortAddr;
    const profHeroWC = document.getElementById('prof-hero-wallet-count');
    if (profHeroWC) profHeroWC.textContent = count + (count !== 1 ? ' WALLETS' : ' WALLET');
    const addrWrap2 = document.getElementById('profile-addr-wrap');
    if (addrWrap2) { addrWrap2.style.opacity = '1'; addrWrap2.style.pointerEvents = 'auto'; }
  }

  // Render chain selector and trigger per-chain stats (WALLETS / DELEGATED / NOT DELEGATED)
  renderProfChainSelector();
  updateProfileStats();
}


