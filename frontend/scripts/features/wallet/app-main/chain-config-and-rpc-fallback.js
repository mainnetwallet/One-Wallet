
// ══════════════════════════════════════════════════════════════
// MULTI-CHAIN SYSTEM
// ══════════════════════════════════════════════════════════════
const HCP_STORAGE_KEY = 'one_custom_chains'; // legacy fallback
const HCP_ACTIVE_KEY  = 'one_active_chain';

// Per-group custom chain storage key helper
// _hcpGroupSnapshot: set when HCP opens so add/delete always target the correct group
let _hcpGroupSnapshot = null;

function _resolveActiveGroupId() {
  // 1. Snapshot captured at HCP open time (most reliable during a picker session)
  if (_hcpGroupSnapshot) return _hcpGroupSnapshot;
  // 2. Live DOM: home-group-select value (exactly what the user sees)
  try {
    const sel = document.getElementById('home-group-select');
    if (sel && sel.value) return sel.value;
  } catch {}
  // 3. Persisted home wallet group — check BOTH persist keys (two systems exist)
  try {
    const v1 = localStorage.getItem('one_hw_group_id_v2');      // from _oneSaveHomeWallet
    const v2 = localStorage.getItem('one_hw_selected_group_v1'); // from _hwSaveSelection
    // Use the most recently written one by checking which exists
    // Prefer v1 (one_hw_group_id_v2) as it is patched on every group change
    if (v1) return v1;
    if (v2) return v2;
  } catch {}
  // 4. Active group from settings (one_active_group)
  try {
    const v = localStorage.getItem('one_active_group');
    if (v) return v;
  } catch {}
  return null;
}

function _getGroupChainKey() {
  const gid = _resolveActiveGroupId();
  if (gid) return 'one_custom_chains_' + gid;
  return HCP_STORAGE_KEY; // global fallback when no group is resolved
}

// Built-in chain definitions
const BUILTIN_CHAINS = [
  { id: 'all',     chainId: null,   emoji: '🌐', name: 'All Networks',   nativeSym: '',      color: '#6366f1', builtIn: true, logoURI: null, rpcs: [] },
  { id: 'base',    chainId: 8453,   emoji: '🔵', name: 'Base',           nativeSym: 'ETH',   color: '#0052ff', builtIn: true, logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png',
    rpcs: ['https://mainnet.base.org','https://base.drpc.org'] },
  { id: 'eth',     chainId: 1,      emoji: '⬡',  name: 'Ethereum',       nativeSym: 'ETH',   color: '#627eea', builtIn: true, logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
    rpcs: ['https://ethereum-rpc.publicnode.com','https://cloudflare-eth.com'] },
  { id: 'arb',     chainId: 42161,  emoji: '🔵', name: 'Arbitrum One',   nativeSym: 'ETH',   color: '#28a0f0', builtIn: true, logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png',
    rpcs: ['https://arb1.arbitrum.io/rpc','https://arbitrum-one-rpc.publicnode.com'] },
  { id: 'op',      chainId: 10,     emoji: '🔴', name: 'Optimism',       nativeSym: 'ETH',   color: '#ff0420', builtIn: true, logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png',
    rpcs: ['https://mainnet.optimism.io','https://optimism-rpc.publicnode.com'] },
  { id: 'matic',   chainId: 137,    emoji: '⬡',  name: 'Polygon',        nativeSym: 'POL',   color: '#8247e5', builtIn: true, logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png',
    rpcs: ['https://polygon-bor-rpc.publicnode.com','https://polygon.drpc.org','https://polygon-rpc.com','https://1rpc.io/matic'] },
  { id: 'bsc',     chainId: 56,     emoji: '💛', name: 'BNB Chain',      nativeSym: 'BNB',   color: '#f3ba2f', builtIn: true, logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/info/logo.png',
    rpcs: ['https://bsc-dataseed.binance.org','https://bsc-dataseed1.defibit.io','https://bsc-dataseed2.defibit.io','https://bsc-rpc.publicnode.com'] },
  { id: 'avax',    chainId: 43114,  emoji: '🔺', name: 'Avalanche C',    nativeSym: 'AVAX',  color: '#e84142', builtIn: true, logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/info/logo.png',
    rpcs: ['https://api.avax.network/ext/bc/C/rpc','https://avalanche-c-chain-rpc.publicnode.com'] },
  { id: 'linea',   chainId: 59144,  emoji: '◻️', name: 'Linea',          nativeSym: 'ETH',   color: '#61dfff', builtIn: true, logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/linea/info/logo.png',
    rpcs: ['https://rpc.linea.build'] },
  { id: 'scroll',  chainId: 534352, emoji: '📜', name: 'Scroll',         nativeSym: 'ETH',   color: '#efc042', builtIn: true, logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/scroll/info/logo.png',
    rpcs: ['https://rpc.scroll.io','https://scroll.drpc.org'] },
  { id: 'zksync',  chainId: 324,    emoji: '⚡', name: 'zkSync Era',     nativeSym: 'ETH',   color: '#8c8dfc', builtIn: true, logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/zksync/info/logo.png',
    rpcs: ['https://mainnet.era.zksync.io','https://zksync.drpc.org'] },
];

// ── Multi-RPC fallback helper — tries each RPC in order, returns first working provider ──
async function getProviderWithFallback(rpcs, chainId) {
  // If chainId provided, use the global fallback engine
  if (chainId) return await _getProviderWithFallback(chainId);
  // rpcs-only path: try each in order
  if (!rpcs || rpcs.length === 0) return null;
  for (const rpc of rpcs) {
    try {
      const p = _makeProvider(rpc, chainId);
      await Promise.race([
        p.getBlockNumber(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))
      ]);
      return p;
    } catch {
      const key = rpc + ':' + (chainId || 0);
      delete _providerCache[key];
    }
  }
  // All failed — return first provider anyway (caller may handle error)
  return _makeProvider(rpcs[0], chainId);
}

// ── Get RPC list for any chain (builtin or custom) ──
function getChainRpcs(chainId) {
  const chain = getAllChains().find(c => c.chainId === chainId);
  if (!chain) return [];
  // Custom chains: rpc field may be string or array
  if (!chain.builtIn) {
    const r = chain.rpcs || chain.rpc;
    if (Array.isArray(r)) return r.filter(Boolean);
    if (r) return [r];
    return [];
  }
  return chain.rpcs || [];
}

// ── Custom chains come from the user AND from untrusted dApps (wallet_addEthereumChain adds one
// with dApp-supplied chainName / iconUrls / rpcUrls). Those fields are later interpolated into
// innerHTML all over the UI, so a crafted logo URL or name ran script inside the wallet. Sanitise at
// the single load/save choke point so every consumer (and any already-stored bad entry) is safe.
function _ccText(v, max, fallback) {
  var t = String(v == null ? '' : v).replace(/[\u0000-\u001f<>"'`&\\]/g, '').trim().slice(0, max);
  return t || fallback;
}
function _ccUrl(v, schemes) {
  if (typeof v !== 'string') return null;
  var u = v.trim();
  if (!u || u.length > 2048 || /[\s"'<>`\\]/.test(u)) return null;
  return schemes.test(u) ? u : null;
}
function _sanitizeCustomChain(c) {
  if (!c || typeof c !== 'object') return null;
  var id = parseInt(c.chainId, 10);
  if (!isFinite(id) || id <= 0) return null;
  var out = Object.assign({}, c);
  out.chainId   = id;
  out.id        = _ccText(c.id, 40, 'custom-' + id).replace(/[^A-Za-z0-9_-]/g, '') || ('custom-' + id);
  out.name      = _ccText(c.name, 64, 'Chain ' + id);
  out.emoji     = _ccText(c.emoji, 8, '🔗');
  if ('nativeSym' in c || !('symbol' in c)) out.nativeSym = _ccText(c.nativeSym, 16, 'ETH').replace(/[^A-Za-z0-9$._ -]/g, '') || 'ETH';
  if ('symbol' in c) out.symbol = _ccText(c.symbol, 16, 'ETH').replace(/[^A-Za-z0-9$._ -]/g, '') || 'ETH';
  out.logoURI   = _ccUrl(c.logoURI, /^https?:\/\//i);
  out.explorer  = _ccUrl(c.explorer, /^https?:\/\//i) || '';
  var rpcOk = /^(https?|wss?):\/\//i;
  out.rpc       = _ccUrl(c.rpc, rpcOk) || '';
  out.rpcs      = (Array.isArray(c.rpcs) ? c.rpcs : []).map(function(r) { return _ccUrl(r, rpcOk); }).filter(Boolean);
  out.color     = (typeof c.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(c.color)) ? c.color : '#6366f1';
  return out;
}
function _sanitizeCustomChains(list) {
  return (Array.isArray(list) ? list : []).map(_sanitizeCustomChain).filter(Boolean);
}

function loadCustomChains() {
  try {
    const key = _getGroupChainKey();
    const val = localStorage.getItem(key);
    if (val) return _sanitizeCustomChains(JSON.parse(val));
    // Fallback: try global key (migration for old data)
    const global = localStorage.getItem(HCP_STORAGE_KEY);
    return global ? _sanitizeCustomChains(JSON.parse(global)) : [];
  } catch { return []; }
}
function saveCustomChains(chains) {
  try {
    const key = _getGroupChainKey();
    localStorage.setItem(key, JSON.stringify(_sanitizeCustomChains(chains)));
  } catch {}
}
function getAllChains() {
  return [...BUILTIN_CHAINS, ...loadCustomChains()];
}

// Active chain state — stored globally AND per-wallet
// Per-wallet key: one_chain_wallet_<address>
function _chainKeyForWallet(pk) {
  if (!pk) return null;
  try { const addr = new ethers.Wallet(pk).address; return 'one_chain_wallet_' + addr.toLowerCase(); } catch { return null; }
}
function _saveChainForWallet(pk, chainId) {
  const k = _chainKeyForWallet(pk);
  if (!k) return;
  try { localStorage.setItem(k, chainId === null ? 'null' : String(chainId)); } catch {}
}
function _loadChainForWallet(pk) {
  const k = _chainKeyForWallet(pk);
  if (!k) return undefined; // undefined = no saved preference
  try { const v = localStorage.getItem(k); if (v === null) return undefined; return v === 'null' ? null : Number(v); } catch { return undefined; }
}