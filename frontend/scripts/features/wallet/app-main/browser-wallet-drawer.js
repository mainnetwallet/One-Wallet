function openBrowserWalletDrawer() {
  _brBwdOpen = new Set();
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
  _brBwdOpen = new Set();
  haptic && haptic();
  // Reject any pending eth_requestAccounts so dApp doesn't hang forever
  if (window._onePendingBrowserReqId) {
    try { OneAndroid.web3Reject(window._onePendingBrowserReqId, 'User rejected the request'); } catch(_) {}
    window._onePendingBrowserReqId = null;
  }
}

var _brBwdOpen = new Set();   // expanded group indices

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
  _renderBrowserWalletDrawer();
  haptic && haptic();
}

// Single select: groups only expand, one wallet is connected to the dApp.
function _renderBrowserWalletDrawer() {
  var list     = document.getElementById('br-bwd-list');
  var badge    = document.getElementById('br-bwd-badge');
  var title    = document.getElementById('br-bwd-title');
  var backBtn  = document.getElementById('br-bwd-back-btn');
  var closeBtn = document.getElementById('br-bwd-close-btn');
  if (!list) return;

  var groups = loadWalletGroups().filter(function(g){ return g && g.keys && g.keys.length > 0; });

  if (badge)    badge.textContent  = groups.length + ' GROUP' + (groups.length !== 1 ? 'S' : '');
  if (title)    title.textContent  = 'My Wallets';
  if (backBtn)  backBtn.style.display  = 'none';
  if (closeBtn) closeBtn.style.display = 'flex';

  var selectedAddr = window._oneBrowserSelectedAddress || null;
  var selLower = selectedAddr ? selectedAddr.toLowerCase() : '';
  var banner = selectedAddr
    ? '<div class="wdu-hint" style="padding:8px 10px;margin-bottom:10px;border-radius:10px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);color:#6ee7b7;">' +
        '<span class="material-icons-round" style="font-size:16px;color:#10b981;">check_circle</span>' +
        '<span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--font-mono);">Connected \u00b7 ' + selectedAddr.slice(0, 8) + '\u2026' + selectedAddr.slice(-6) + '</span>' +
      '</div>'
    : '';

  WDU.renderList(list, {
    mode: 'single',
    groups: groups,
    topHtml: banner,
    isOpen: function(gi) { return _brBwdOpen.has(gi); },
    isKeySel: function(gi, ki) {
      if (!selLower) return false;
      return WDU.addressOf(groups[gi].keys[ki]).toLowerCase() === selLower;
    },
    keyInfo: function(gi, ki, pk) {
      var g = groups[gi];
      var addr = WDU.addressOf(pk);
      var isSel = selLower && addr && addr.toLowerCase() === selLower;
      return {
        title: (g.labels && g.labels[ki]) || ('Wallet ' + (ki + 1)),
        sub: WDU.short(addr, 8, 6) + (isSel ? ' \u00b7 connected' : '')
      };
    },
    onExpand: function(gi) { WDU.toggleInSet(_brBwdOpen, gi); _renderBrowserWalletDrawer(); },
    onKey: function(gi, ki) {
      var addr = WDU.addressOf(groups[gi].keys[ki]);
      if (!addr || (selLower && addr.toLowerCase() === selLower)) return;
      brBwdSelectWallet(addr);
    }
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

