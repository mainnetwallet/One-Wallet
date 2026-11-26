'use strict';
// ── Helper: get wallet label + group name for address ─────
// Returns e.g. "Main Group · Wallet 2" or null if not found
function _getWalletLabelForAddress(address) {
  if (!address || !/^0x[0-9a-fA-F]{40}$/i.test(address)) return null;
  var addrLow = address.toLowerCase();
  try {
    var groups = loadWalletGroups();
    for (var gi = 0; gi < groups.length; gi++) {
      var g = groups[gi];
      if (!g || !g.keys) continue;
      for (var ki = 0; ki < g.keys.length; ki++) {
        try {
          var pk = g.keys[ki];
          if (!pk) continue;
          var n = pk.startsWith('0x') ? pk : '0x' + pk;
          if (new ethers.Wallet(n).address.toLowerCase() === addrLow) {
            var walletLabel = (g.labels && g.labels[ki]) ? g.labels[ki] : ('Wallet ' + (ki + 1));
            var groupName   = g.name || ('Group ' + (gi + 1));
            return groupName + ' · ' + walletLabel;
          }
        } catch(_) {}
      }
    }
  } catch(_) {}
  return null;
}

function _getPrivateKeyForAddress(address) {
  // Search all wallet groups for the given address.
  // If _oneBrowserSelectedAddress is set and matches, use it (fast path).
  // If it is null/mismatched (e.g. after app backgrounded or page reload), fall back to
  // a full wallet-group scan and auto-restore _oneBrowserSelectedAddress so future
  // calls keep working. This fixes "Wallet not found" on Jumper/viem dApps after reconnect.
  if (!address || !/^0x[0-9a-fA-F]{40}$/i.test(address)) return null;
  var addrLow = address.toLowerCase();
  try {
    var bsa = window._oneBrowserSelectedAddress;
    var groups = loadWalletGroups();
    // Fast path: _oneBrowserSelectedAddress matches → only search within that address
    if (bsa && bsa.toLowerCase() === addrLow) {
      for (var gi = 0; gi < groups.length; gi++) {
        var g = groups[gi];
        if (!g || !g.keys) continue;
        for (var ki = 0; ki < g.keys.length; ki++) {
          try {
            var pk = g.keys[ki];
            if (!pk) continue;
            var n = pk.startsWith('0x') ? pk : '0x' + pk;
            if (new ethers.Wallet(n).address.toLowerCase() === addrLow) return n;
          } catch(_) {}
        }
      }
    }
    // Fallback path: _oneBrowserSelectedAddress is null/stale — scan all wallets
    // This recovers from app backgrounding, page reload, or wagmi re-connect flows
    for (var gi2 = 0; gi2 < groups.length; gi2++) {
      var g2 = groups[gi2];
      if (!g2 || !g2.keys) continue;
      for (var ki2 = 0; ki2 < g2.keys.length; ki2++) {
        try {
          var pk2 = g2.keys[ki2];
          if (!pk2) continue;
          var n2 = pk2.startsWith('0x') ? pk2 : '0x' + pk2;
          if (new ethers.Wallet(n2).address.toLowerCase() === addrLow) {
            // Auto-restore _oneBrowserSelectedAddress so subsequent calls use fast path
            window._oneBrowserSelectedAddress = new ethers.Wallet(n2).address;
            return n2;
          }
        } catch(_) {}
      }
    }
  } catch(_) {}
  return null;
}

// ── Helper: get RPC for chainId ────────────────────────────
function _getRpcForChain(chainId) {
  try {
    var chains = getAllChains();
    var chain = chains.find(function(c) { return c.chainId === chainId; });
    if (chain) {
      var rpcs = chain.rpcs || (chain.rpc ? [chain.rpc] : []);
      if (rpcs.length > 0) return rpcs[0];
    }
  } catch(_) {}
  // Public fallbacks by chainId
  var FALLBACKS = {
    1:     'https://eth.llamarpc.com',
    56:    'https://bsc-dataseed.binance.org',
    137:   'https://polygon-rpc.com',
    42161: 'https://arb1.arbitrum.io/rpc',
    10:    'https://mainnet.optimism.io',
    8453:  'https://mainnet.base.org',
    43114: 'https://api.avax.network/ext/bc/C/rpc',
    250:   'https://fantom-rpc.publicnode.com',
    100:   'https://rpc.gnosischain.com',
    25:    'https://evm.cronos.org',
  };
  return FALLBACKS[chainId] || 'https://eth.llamarpc.com';
}

// ── Helper: format value for display ──────────────────────
// Safely convert tx value (hex, decimal string, or scientific-notation string) to BigInt
function _safeBigInt(val) {
  if (val === undefined || val === null || val === '' || val === '0x' || val === '0') return 0n;
  try {
    if (typeof val === 'string' && !val.startsWith('0x') && /e/i.test(val)) {
      return BigInt(Math.round(parseFloat(val)));
    }
    return BigInt(val);
  } catch(_) {
    try { return BigInt(Math.round(parseFloat(val))); } catch(_) { return 0n; }
  }
}

function _fmtValue(hexVal, chainId) {
  try {
    if (!hexVal || hexVal === '0x' || hexVal === '0x0') return '0';
    // ethers v6 compat: use formatEther directly (works v5+v6), avoid BigNumber.from
    var eth = (typeof ethers.formatEther === 'function')
      ? ethers.formatEther(_safeBigInt(hexVal))
      : ethers.utils.formatEther(ethers.BigNumber.from(hexVal));
    var num = parseFloat(eth);
    if (num === 0) return '0';
    return num.toFixed(num < 0.001 ? 8 : num < 1 ? 6 : 4);
  } catch(_) { return hexVal; }
}

function _getChainSymbol(chainId) {
  try {
    var chains = getAllChains();
    var c = chains.find(function(x) { return x.chainId === chainId; });
    if (c) {
      // nativeSym is the primary field used throughout the app
      if (c.nativeSym) return c.nativeSym;
      // custom chains added via Add Network use nativeCurrency.symbol
      if (c.nativeCurrency && c.nativeCurrency.symbol) return c.nativeCurrency.symbol;
      // legacy fallback
      if (c.symbol) return c.symbol;
    }
  } catch(_) {}
  // Expanded static fallback covering all supported chains
  var SYM = {
    1:'ETH', 8453:'ETH', 42161:'ETH', 10:'ETH', 59144:'ETH',
    534352:'ETH', 324:'ETH', 81457:'ETH', 34443:'ETH', 7777777:'ETH',
    57073:'ETH', 60808:'ETH', 1313161554:'ETH', 1101:'ETH',
    56:'BNB', 97:'BNB',
    137:'POL', 80001:'MATIC',
    43114:'AVAX', 43113:'AVAX',
    250:'FTM', 4002:'FTM',
    42220:'CELO', 44787:'CELO',
    100:'XDAI', 10200:'XDAI',
    25:'CRO', 338:'CRO',
    1284:'GLMR', 1287:'DEV',
    1329:'SEI', 713715:'SEI',
    5000:'MNT', 5001:'MNT',
    13371:'IMX'
  };
  return SYM[chainId] || 'ETH';
}

// Returns best available logo URL for any chain (built-in, custom, or unknown).
// Priority: getAllChains().logoURI → trustwallet CDN → chainid.network CDN
function _resolveChainLogoUri(chainId) {
  try {
    var _chs = (typeof getAllChains === 'function') ? getAllChains() : [];
    var _c = _chs.find(function(x) { return x.chainId === chainId; });
    if (_c) {
      if (_c.logoURI)  return _c.logoURI;
      if (_c.iconUrl)  return _c.iconUrl;  // dApp-supplied via wallet_addEthereumChain
    }
  } catch(_) {}
  // Trustwallet Assets — comprehensive slug map (covers 25+ chains)
  var _TW = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/';
  var _slugs = {
    1:'ethereum', 8453:'base', 56:'smartchain', 137:'polygon',
    42161:'arbitrum', 10:'optimism', 43114:'avalanchec',
    250:'fantom', 42220:'celo', 100:'xdai', 59144:'linea',
    534352:'scroll', 324:'zksync', 1284:'moonbeam', 25:'cronos',
    1313161554:'aurora', 1101:'polygonzkevm', 5000:'mantle',
    81457:'blast', 34443:'mode', 7777777:'zora',
    13371:'immutablezkevm', 1329:'sei', 57073:'ink', 60808:'bob',
    42170:'arbitrumnova', 7700:'canto', 1088:'metis',
    288:'boba', 2222:'kava', 1666600000:'harmony',
    106:'velas', 40:'telos', 70:'hoo', 4689:'iotex',
    1234:'step', 122:'fuse'
  };
  if (_slugs[chainId]) return _TW + _slugs[chainId] + '/info/logo.png';
  // Last-resort: chainid.network icon CDN (covers most EVM chains by ID)
  return 'https://chainid.network/chain-icons/eip155-' + chainId + '.png';
}

// Returns emoji for a chain (from chain data or a sane default).
function _resolveChainEmoji(chainId) {
  try {
    var _chs = (typeof getAllChains === 'function') ? getAllChains() : [];
    var _c = _chs.find(function(x) { return x.chainId === chainId; });
    if (_c && _c.emoji) return _c.emoji;
  } catch(_) {}
  var _EM = {1:'⬡',56:'💛',137:'⬡',42161:'🔵',10:'🔴',8453:'🔵',43114:'🔺',250:'👻',42220:'🟡',100:'🦉',59144:'◻️',534352:'📜',324:'⚡'};
  return _EM[chainId] || '🔗';
}

function _getChainName(chainId) {
  try {
    var chains = getAllChains();
    var c = chains.find(function(x) { return x.chainId === chainId; });
    if (c && c.name) return c.name;
  } catch(_) {}
  var NM = {1:'Ethereum',56:'BNB Chain',137:'Polygon',42161:'Arbitrum',10:'Optimism',8453:'Base',43114:'Avalanche',250:'Fantom'};
  return NM[chainId] || 'Chain ' + chainId;
}

