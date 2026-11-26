

/* ── State ── */
// Restore saved swap chain from localStorage at declaration time
const _swSavedChainId = (() => { try { const v = localStorage.getItem('one_swap_chain_id'); return v ? parseInt(v) : null; } catch { return null; } })();
const _swSavedNetwork = (() => {
  if (!_swSavedChainId) return null;
  const _map = {1:{id:'ethereum',name:'Ethereum',emoji:'⟠',chainId:1},56:{id:'bsc',name:'BNB Chain',emoji:'🟡',chainId:56},137:{id:'polygon',name:'Polygon',emoji:'🟣',chainId:137},42161:{id:'arbitrum',name:'Arbitrum',emoji:'🔵',chainId:42161},10:{id:'optimism',name:'Optimism',emoji:'🔴',chainId:10},8453:{id:'base',name:'Base',emoji:'🔵',chainId:8453,logoURI:'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png'},43114:{id:'avalanche',name:'Avalanche',emoji:'🔺',chainId:43114}};
  return _map[_swSavedChainId] || null;
})();

const SW = {
  walletConnected: false,
  walletAddress: '',
  walletPK: null,      // set when connected via private key
  network: _swSavedNetwork || { id:'base', name:'Base', emoji:'🔵', chainId:8453, logoURI:'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png' },
  fromToken: { sym:'ETH', name:'Ethereum', icon:'Ξ', color:'#627EEA,#364FC7', decimals:18, price:3241.50, balance:1.2847, logoURI:'https://assets.coingecko.com/coins/images/279/small/ethereum.png' },
  toToken:   { sym:'USDC', name:'USD Coin',  icon:'$', color:'#2775CA,#1557A0', decimals:6,  price:1.0,    balance:842.33, logoURI:'https://assets.coingecko.com/coins/images/6319/small/usdc.png' },
  fromAmount: '',
  toAmount: '',
  slippage: 0.5,
  deadline: 20,
  multiRoute: true,
  expertMode: false,
  quoteTimer: null,
  _fetchId: 0,
  quotes: [],
  bestDex: null,
  scanDexInterval: null,
  recentSwaps: JSON.parse(localStorage.getItem('sw_recent') || '[]'),
  _cachedRouterAddr: null,   // from last quote
  _routerCache: {},          // { dexName: routerAddress } — populated when quotes arrive
  _cachedSwapTx: null,       // real tx data from quote API — used directly for swap
  _routeFetching: false,     // true while background API calls are in-flight
  _quoteSession: 0,          // incremented on each new quote request to cancel stale results
  _manualDexName: null,      // dex name user manually selected
  _manualDexIdx: null,       // display index of manual selection
  _manualRouteKey: null,     // unique key "dexName::apiSource" — prevents same-name cross-API collision
};

// ── Early restore: wallet persists across page refreshes (AES-decrypted) ──
(function() {
  try {
    const saved = JSON.parse(localStorage.getItem('one_sw_signer') || 'null');
    if (!saved || !saved.addr) return;
    // Support both new encPk and legacy plaintext pk
    const _rawPk = saved.encPk || saved.pk || null;
    if (!_rawPk) return;
    Promise.resolve(OneCrypto.decrypt(_rawPk)).then(function(plainPk) {
      if (!plainPk) return;
      SW.walletConnected = true;
      SW.walletAddress   = saved.addr;
      SW.walletPK        = plainPk;
      // Migrate legacy plaintext to encrypted if needed
      if (!saved.encPk) {
        OneCrypto.encrypt(plainPk).then(function(enc) {
          try { localStorage.setItem('one_sw_signer', JSON.stringify({ addr: saved.addr, encPk: enc })); } catch(_) {}
        });
      }
      if (typeof _swUpdateConnectBtn === 'function') _swUpdateConnectBtn();
    }).catch(function() {});
  } catch(_) {}
})();

// ── swShowToast: local alias for global showToast ──
function _nxsw_swShowToast(msg) {
  if (typeof showToast === 'function') showToast(msg);
}

