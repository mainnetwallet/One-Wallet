function openBrowserWalletDrawer() {
  _brBwdExpandedGroupId = null;
  _renderBrowserWalletDrawer();
  var ov = document.getElementById('br-browser-wallet-overlay');
  if (ov) { ov.style.opacity = '1'; ov.style.pointerEvents = 'all'; }
  var dr = document.getElementById('br-browser-wallet-drawer');
  if (dr) dr.style.transform = 'translateX(0)';
  haptic && haptic();
}

function closeBrowserWalletDrawer() {
  var ov = document.getElementById('br-browser-wallet-overlay');
  var dr = document.getElementById('br-browser-wallet-drawer');
  if (dr) dr.style.transform = 'translateX(100%)';
  if (ov) { ov.style.opacity = '0'; setTimeout(function(){ ov.style.pointerEvents = 'none'; }, 300); }
  _brBwdExpandedGroupId = null;
  haptic && haptic();
  // Reject any pending eth_requestAccounts so dApp doesn't hang forever
  if (window._onePendingBrowserReqId) {
    try { OneAndroid.web3Reject(window._onePendingBrowserReqId, 'User rejected the request'); } catch(_) {}
    window._onePendingBrowserReqId = null;
  }
}

var _brBwdExpandedGroupId = null;

// Called by InAppBrowserActivity via evaluateJavascript to get wallet data
// Returns JSON string: [{id, name, wallets:[{address, label}]}]
function getBrowserWalletDataJson() {
  try {
    var groups = loadWalletGroups().filter(function(g){ return g && g.keys && g.keys.length > 0; });
    var result = groups.map(function(g, gi) {
      var wallets = [];
      g.keys.forEach(function(pk, i) {
        try {
          var addr = new ethers.Wallet(pk).address;
          var short = addr.slice(0,6) + '...' + addr.slice(-4);
          wallets.push({ address: addr, short: short, label: g.labels && g.labels[i] ? g.labels[i] : ('Wallet ' + (i+1)) });
        } catch(e) {}
      });
      return { id: g.id || ('g'+gi), name: g.name || ('Group '+(gi+1)), wallets: wallets };
    });
    return JSON.stringify(result);
  } catch(e) { return '[]'; }
}
// Called by InAppBrowserActivity to get dynamic chain list from getAllChains()
// Returns JSON string: [{name, chainId, hex}]
function getBrowserChainListJson() {
  try {
    var chains = (typeof getAllChains === 'function' ? getAllChains() : [])
      .filter(function(c){ return c.chainId !== null && c.chainId > 0; })
      .map(function(c){
        return {
          name:    c.name || c.id || ('Chain ' + c.chainId),
          chainId: c.chainId,
          hex:     '0x' + c.chainId.toString(16),
          emoji:   c.emoji || '🔗',
          color:   c.color || '#6366f1',
          logoURI: c.logoURI || null
        };
      });
    return JSON.stringify(chains);
  } catch(e) { return '[]'; }
}



function brBwdGoBack() {
  _brBwdExpandedGroupId = null;
  _renderBrowserWalletDrawer();
  haptic && haptic();
}

function _renderBrowserWalletDrawer() {
  if (_brBwdExpandedGroupId) {
    _renderBrBwdKeyList(_brBwdExpandedGroupId);
  } else {
    _renderBrBwdGroupList();
  }
}

function _renderBrBwdGroupList() {
  var list     = document.getElementById('br-bwd-list');
  var badge    = document.getElementById('br-bwd-badge');
  var title    = document.getElementById('br-bwd-title');
  var backBtn  = document.getElementById('br-bwd-back-btn');
  var closeBtn = document.getElementById('br-bwd-close-btn');
  if (!list) return;

  var groups = loadWalletGroups().filter(function(g){ return g && g.keys && g.keys.length > 0; });

  if (badge)   badge.textContent  = groups.length + ' GROUP' + (groups.length !== 1 ? 'S' : '');
  if (title)   title.textContent  = 'My Wallets';
  if (backBtn) backBtn.style.display  = 'none';
  if (closeBtn)closeBtn.style.display = 'flex';

  list.innerHTML = '';

  if (groups.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:50px 20px;font-family:var(--font-mono);font-size:11px;color:var(--text-muted);line-height:2.2;"><div style="font-size:32px;margin-bottom:10px;">📁</div>NO GROUPS FOUND<br><span style="font-size:10px;opacity:0.5;">Import in Settings first</span></div>';
    return;
  }

  var hintEl = document.createElement('div');
  hintEl.style.cssText = 'font-family:var(--font-mono);font-size:9px;color:var(--text-muted);letter-spacing:1px;padding:0 4px 10px;text-align:center;';
  hintEl.textContent = 'TAP GROUP = VIEW WALLETS   •   → = ADDRESSES';
  list.appendChild(hintEl);

  groups.forEach(function(g, i) {
    var clr = WG_COLORS[i % WG_COLORS.length];
    var card = document.createElement('div');
    card.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:8px;';

    var inner = document.createElement('div');
    inner.className = 'del-drawer-item';
    inner.style.cssText = 'flex:1;cursor:pointer;display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:10px;transition:all 0.2s ease;';
    inner.innerHTML =
      '<div style="width:32px;height:32px;border-radius:9px;background:' + clr.num + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 0 10px ' + clr.glow + ';">' +
        '<span style="font-family:var(--font-mono);font-size:13px;font-weight:800;color:#fff;">' + (i+1) + '</span>' +
      '</div>' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:12px;font-weight:700;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (g.name || 'Group '+(i+1)) + '</div>' +
        '<div style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);">' + g.keys.length + ' wallet' + (g.keys.length !== 1 ? 's' : '') + '</div>' +
      '</div>' +
      '<span class="material-icons-round" style="font-size:18px;color:var(--text-muted);">chevron_right</span>';

    inner.addEventListener('click', function() {
      _brBwdExpandedGroupId = g.id;
      _renderBrowserWalletDrawer();
      haptic && haptic();
    });
    card.appendChild(inner);
    list.appendChild(card);
  });
}

function _renderBrBwdKeyList(groupId) {
  var list     = document.getElementById('br-bwd-list');
  var badge    = document.getElementById('br-bwd-badge');
  var title    = document.getElementById('br-bwd-title');
  var backBtn  = document.getElementById('br-bwd-back-btn');
  var closeBtn = document.getElementById('br-bwd-close-btn');
  if (!list) return;

  var groups = loadWalletGroups();
  var g = groups.find(function(x){ return x.id === groupId; });
  if (!g) { _brBwdExpandedGroupId = null; _renderBrBwdGroupList(); return; }

  if (title)   title.textContent = g.name || 'Group';
  if (badge)   badge.textContent = g.keys.length + ' WALLET' + (g.keys.length !== 1 ? 'S' : '');
  if (backBtn) backBtn.style.display  = 'flex';
  if (closeBtn)closeBtn.style.display = 'none';

  list.innerHTML = '';

  // Show currently selected wallet banner if any
  var selectedAddr = window._oneBrowserSelectedAddress || null;
  if (selectedAddr) {
    var selBanner = document.createElement('div');
    selBanner.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 12px;margin-bottom:10px;' +
      'background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:10px;';
    selBanner.innerHTML =
      '<span class="material-icons-round" style="font-size:14px;color:#10b981;">check_circle</span>' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:9px;color:#10b981;font-weight:700;letter-spacing:0.5px;">CONNECTED TO dAPP</div>' +
        '<div style="font-size:10px;color:#6ee7b7;font-family:var(--font-mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
          selectedAddr.slice(0,10) + '\u2026' + selectedAddr.slice(-8) +
        '</div>' +
      '</div>';
    list.appendChild(selBanner);
  }

  var gi = groups.indexOf(g);
  var clr = WG_COLORS[gi % WG_COLORS.length];

  g.keys.forEach(function(pk, i) {
    var addr = '';
    try { addr = new ethers.Wallet(pk).address; } catch(e){}
    var short = addr ? addr.slice(0,10) + '\u2026' + addr.slice(-8) : '\u2014';
    var isSelected = selectedAddr && addr && addr.toLowerCase() === selectedAddr.toLowerCase();

    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 12px;' +
      'background:' + (isSelected
        ? 'linear-gradient(145deg,rgba(16,185,129,0.08),rgba(16,185,129,0.04))'
        : 'linear-gradient(145deg,var(--bg-glass),rgba(15,15,25,0.5))') + ';' +
      'border:1.5px solid ' + (isSelected ? 'rgba(16,185,129,0.35)' : 'var(--border-subtle)') + ';' +
      'border-radius:14px;margin-bottom:7px;' +
      'animation:slideIn 0.22s ease both;animation-delay:' + (i*0.03) + 's;';

    var numDiv = document.createElement('div');
    numDiv.style.cssText = 'width:28px;height:28px;border-radius:8px;background:' + clr.num + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;';
    numDiv.innerHTML = '<span style="font-family:var(--font-mono);font-size:11px;font-weight:800;color:#fff;">' + (i+1) + '</span>';

    var addrDiv = document.createElement('div');
    addrDiv.style.cssText = 'flex:1;min-width:0;';
    addrDiv.innerHTML =
      '<div style="font-size:11px;font-weight:600;color:var(--text-primary);font-family:var(--font-mono);' +
        'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + short + '</div>' +
      (isSelected ? '<div style="font-size:9px;color:#10b981;font-weight:600;margin-top:1px;">● Connected</div>' : '');

    // Select wallet icon (active indicator)
    var selectIcon = document.createElement('div');
    selectIcon.style.cssText = 'width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;' +
      (isSelected ? 'background:rgba(16,185,129,0.15);' : 'background:transparent;');
    selectIcon.innerHTML = isSelected
      ? '<span class="material-icons-round" style="font-size:16px;color:#10b981;">check_circle</span>'
      : '<span class="material-icons-round" style="font-size:16px;color:var(--text-muted);opacity:0.4;">radio_button_unchecked</span>';

    // Whole row is clickable to select wallet
    row.style.cursor = isSelected ? 'default' : 'pointer';
    (function(a) {
      row.addEventListener('click', function() {
        if (!isSelected) { brBwdSelectWallet(a); }
      });
    })(addr);

    row.appendChild(numDiv);
    row.appendChild(addrDiv);
    row.appendChild(selectIcon);
    list.appendChild(row);
  });
}

// Called when user taps "Connect" on a wallet in the browser wallet drawer
function brBwdSelectWallet(address) {
  if (!address) return;

  // 1. Store as the active browser wallet
  window._oneBrowserSelectedAddress = address;

  // 2. Notify Android → sets _oneBrowserSelectedAddress in main wallet JS for signing
  try {
    if (typeof OneAndroid !== 'undefined' && OneAndroid.web3SetSelectedWallet) {
      OneAndroid.web3SetSelectedWallet(address);
    }
  } catch(_) {}

  // 3. Get chainId directly from Java InAppBrowserActivity — single source of truth
  var chainId = '0x1';
  try {
    if (typeof OneAndroid !== 'undefined' && OneAndroid.getSelectedBrowserChainId) {
      var javaChain = OneAndroid.getSelectedBrowserChainId();
      if (javaChain && javaChain.length > 0) chainId = javaChain;
    }
  } catch(_) {}

  console.log('[OneWallet] brBwdSelectWallet addr=' + address + ' chain=' + chainId);

  // 3b. Sync _oneBrowserChainId so signing always uses the correct chain
  window._oneBrowserChainId = chainId;

  // 4. Update window.ethereum state FIRST — dApp needs chain before resolve
  try { OneAndroid.web3UpdateAccount(JSON.stringify([address]), chainId); } catch(_) {}

  // 5. Resolve pending eth_requestAccounts — dApp is waiting for this
  if (window._onePendingBrowserReqId) {
    try { OneAndroid.web3Resolve(window._onePendingBrowserReqId, JSON.stringify([address])); } catch(_) {}
    window._onePendingBrowserReqId = null;
  }

  // 6. Close drawer
  closeBrowserWalletDrawer();
  if (typeof haptic === 'function') haptic();
  if (typeof showToast === 'function') showToast('Wallet connected to dApp ✓', 'check');
}

