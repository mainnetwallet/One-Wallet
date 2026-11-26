// ══════════════════════════════════════════════
// SEND TOKEN FEATURE
// Supports: ETH (native), WETH, USDC on Base
// ══════════════════════════════════════════════

const SEND_TOKENS = {
  eth:  { name: 'ETH',  symbol: 'ETH',  decimals: 18, native: true,  contract: null },
  weth: { name: 'WETH', symbol: 'WETH', decimals: 18, native: false, contract: '0x4200000000000000000000000000000000000006' },
  usdc: { name: 'USDC', symbol: 'USDC', decimals: 6,  native: false, contract: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' },
};
const ERC20_SEND_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function transfer(address to, uint256 amount) returns (bool)',
];

let sendSelectedToken = 'eth';
let sendSelectedChainId = (() => { try { const _v = localStorage.getItem('one_send_chain_id'); return _v ? Number(_v) : 8453; } catch(e) { return 8453; } })(); // currently selected chain in send modal (persisted)
let sendProvider = null;
let sendWallet = null;
let sendBalances = {};
let sendPrices = { ETH: 0, WETH: 0, USDC: 1 };

// Chain RPC list for send — multi-RPC arrays, tries each in order on failure
const SEND_CHAIN_RPC = {
  1:      ['https://ethereum-rpc.publicnode.com','https://cloudflare-eth.com'],
  8453:   ['https://mainnet.base.org','https://base.drpc.org'],
  42161:  ['https://arb1.arbitrum.io/rpc','https://arbitrum-one-rpc.publicnode.com'],
  10:     ['https://mainnet.optimism.io','https://optimism-rpc.publicnode.com'],
  137:    ['https://polygon-bor-rpc.publicnode.com','https://polygon.drpc.org','https://polygon-rpc.com','https://1rpc.io/matic'],
  56:     ['https://bsc-dataseed.binance.org','https://bsc-dataseed1.defibit.io','https://bsc-dataseed2.defibit.io','https://bsc-rpc.publicnode.com'],
  43114:  ['https://api.avax.network/ext/bc/C/rpc','https://avalanche-c-chain-rpc.publicnode.com'],
  59144:  ['https://rpc.linea.build'],
  534352: ['https://rpc.scroll.io','https://scroll.drpc.org'],
  324:    ['https://mainnet.era.zksync.io','https://zksync.drpc.org'],
};
// Chain explorer base URLs for send
const SEND_CHAIN_EXPLORER = {
  1:      'https://etherscan.io/tx/',
  8453:   'https://basescan.org/tx/',
  42161:  'https://arbiscan.io/tx/',
  10:     'https://optimistic.etherscan.io/tx/',
  137:    'https://polygonscan.com/tx/',
  56:     'https://bscscan.com/tx/',
  43114:  'https://snowtrace.io/tx/',
  59144:  'https://lineascan.build/tx/',
  534352: 'https://scrollscan.com/tx/',
  324:    'https://explorer.zksync.io/tx/',
};

async function getSendProvider() {
  // Use the global fallback engine — it automatically tries all RPCs for the chain
  // _getRpcListForChain merges SEND_CHAIN_RPC + BR_CHAIN_RPC + custom RPCs in one call
  try {
    return await _withRpcFallback(sendSelectedChainId, async (provider) => {
      // Quick liveness check — if provider can't respond, try next RPC
      await Promise.race([
        provider.getBlockNumber(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))
      ]);
      return provider;
    }, 4000);
  } catch(e) {
    const customChain = (typeof getAllChains === 'function') ? getAllChains().find(c => c.chainId === sendSelectedChainId) : null;
    const chainName = (customChain && customChain.name) || ('Chain ' + sendSelectedChainId);
    throw new Error('All RPCs failed for ' + chainName + '. Check your internet connection or configure a custom RPC in Settings → Network.');
  }
}

let sendSelectedKeyIndex = -1; // which key is selected in the list
