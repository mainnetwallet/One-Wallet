const _nxsw_NETWORKS = [
  { id:'ethereum',  name:'Ethereum',   emoji:'🔷', chainId:1,     logoURI:'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png' },
  { id:'polygon',   name:'Polygon',    emoji:'🟣', chainId:137,   logoURI:'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png' },
  { id:'arbitrum',  name:'Arbitrum',   emoji:'🔵', chainId:42161, logoURI:'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/arbitrum/info/logo.png' },
  { id:'optimism',  name:'Optimism',   emoji:'🔴', chainId:10,    logoURI:'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/optimism/info/logo.png' },
  { id:'bsc',       name:'BSC',        emoji:'🟡', chainId:56,    logoURI:'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/smartchain/info/logo.png' },
  { id:'base',      name:'Base',       emoji:'🔵', chainId:8453,  logoURI:'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/info/logo.png' },
  { id:'avalanche', name:'Avalanche',  emoji:'🔺', chainId:43114, logoURI:'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/info/logo.png' },
  { id:'zksync',    name:'zkSync',     emoji:'⚡',  chainId:324,   logoURI:'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/zksync/info/logo.png' },
];

const _nxsw_TOKEN_LOGOS = {
  'ETH':      'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  'WETH':     'https://assets.coingecko.com/coins/images/2518/small/weth.png',
  'USDC':     'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
  'USDT':     'https://assets.coingecko.com/coins/images/325/small/Tether.png',
  'WBTC':     'https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png',
  'LINK':     'https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png',
  'UNI':      'https://assets.coingecko.com/coins/images/12504/small/uniswap-uni.png',
  'AAVE':     'https://assets.coingecko.com/coins/images/12645/small/AAVE.png',
  'MKR':      'https://assets.coingecko.com/coins/images/1364/small/Mark_Maker.png',
  'CRV':      'https://assets.coingecko.com/coins/images/12124/small/Curve.png',
  'DAI':      'https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png',
  'LDO':      'https://assets.coingecko.com/coins/images/13573/small/Lido_DAO.png',
  'MATIC':    'https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png',
  'POL':      'https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png',
  'ARB':      'https://assets.coingecko.com/coins/images/16547/small/photo_2023-03-29_21.47.00.jpeg',
  'GMX':      'https://assets.coingecko.com/coins/images/18323/small/arbit.png',
  'BNB':      'https://assets.coingecko.com/coins/images/825/small/bnb-icon2_2x.png',
  'CAKE':     'https://assets.coingecko.com/coins/images/12632/small/pancakeswap-cake-logo.png',
  'AVAX':     'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png',
  'WAVAX':    'https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png',
  'CBETH':    'https://assets.coingecko.com/coins/images/27008/small/cbeth.png',
  'OP':       'https://assets.coingecko.com/coins/images/25244/small/Optimism.png',
  'USDBC':    'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
  'USDBC':    'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
  'USDBС':    'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
  'BUSD':     'https://assets.coingecko.com/coins/images/31273/small/new_binance-usd.png',
  'ABASEURC': 'https://assets.coingecko.com/coins/images/26045/small/euro-coin.png',
  'ABASEWETH':'https://assets.coingecko.com/coins/images/2518/small/weth.png',
  'ABASUSDC': 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
  'EURC':     'https://assets.coingecko.com/coins/images/26045/small/euro-coin.png',
};

const TOKENS_BY_NETWORK = {
  ethereum: [
    { sym:'ETH',   name:'Ethereum',       icon:'Ξ',  color:'#627EEA,#364FC7', decimals:18, price:3241.50, balance:1.2847, contract:null },
    { sym:'USDC',  name:'USD Coin',        icon:'$',  color:'#2775CA,#1557A0', decimals:6,  price:1.0,    balance:842.33, contract:'0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
    { sym:'USDT',  name:'Tether',          icon:'₮',  color:'#26A17B,#1a7a5a', decimals:6,  price:1.0,    balance:0,      contract:'0xdAC17F958D2ee523a2206206994597C13D831ec7' },
    { sym:'WBTC',  name:'Wrapped Bitcoin', icon:'₿',  color:'#F7931A,#c47209', decimals:8,  price:62400,  balance:0,      contract:'0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599' },
    { sym:'LINK',  name:'Chainlink',       icon:'⬡',  color:'#375BD2,#2347a0', decimals:18, price:14.22,  balance:0,      contract:'0x514910771AF9Ca656af840dff83E8264EcF986CA' },
    { sym:'UNI',   name:'Uniswap',         icon:'🦄', color:'#FF007A,#c4005e', decimals:18, price:7.85,   balance:0,      contract:'0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984' },
    { sym:'AAVE',  name:'Aave',            icon:'👻', color:'#B6509E,#8c3d7b', decimals:18, price:91.20,  balance:0,      contract:'0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9' },
    { sym:'MKR',   name:'Maker',           icon:'M',  color:'#1AAB9B,#138070', decimals:18, price:1820,   balance:0,      contract:'0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2' },
    { sym:'CRV',   name:'Curve',           icon:'C',  color:'#3466a4,#28508a', decimals:18, price:0.43,   balance:0,      contract:'0xD533a949740bb3306d119CC777fa900bA034cd52' },
    { sym:'DAI',   name:'Dai',             icon:'◈',  color:'#F5AC37,#c98b1e', decimals:18, price:1.0,    balance:0,      contract:'0x6B175474E89094C44Da98b954EedeAC495271d0F' },
    { sym:'WETH',  name:'Wrapped ETH',     icon:'Ξ',  color:'#8C7BC8,#6b5ca5', decimals:18, price:3241,   balance:0,      contract:'0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' },
    { sym:'LDO',   name:'Lido DAO',        icon:'L',  color:'#00A3FF,#0077cc', decimals:18, price:2.14,   balance:0,      contract:'0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32' },
  ],
  polygon: [
    { sym:'MATIC', name:'Polygon',    icon:'⬡', color:'#8247E5,#6330b8', decimals:18, price:0.72,  balance:0, contract:null },
    { sym:'USDC',  name:'USD Coin',   icon:'$', color:'#2775CA,#1557A0', decimals:6,  price:1.0,   balance:0, contract:'0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' },
    { sym:'USDT',  name:'Tether',     icon:'₮', color:'#26A17B,#1a7a5a', decimals:6,  price:1.0,   balance:0, contract:'0xc2132D05D31c914a87C6611C10748AEb04B58e8F' },
    { sym:'WETH',  name:'Wrapped ETH',icon:'Ξ', color:'#627EEA,#364FC7', decimals:18, price:3241,  balance:0, contract:'0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619' },
    { sym:'WBTC',  name:'Wrapped BTC',icon:'₿', color:'#F7931A,#c47209', decimals:8,  price:62400, balance:0, contract:'0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6' },
    { sym:'DAI',   name:'Dai',        icon:'◈', color:'#F5AC37,#c98b1e', decimals:18, price:1.0,   balance:0, contract:'0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063' },
  ],
  arbitrum: [
    { sym:'ETH',   name:'Ethereum',  icon:'Ξ', color:'#627EEA,#364FC7', decimals:18, price:3241.50, balance:0, contract:null },
    { sym:'USDC',  name:'USD Coin',  icon:'$', color:'#2775CA,#1557A0', decimals:6,  price:1.0,    balance:0, contract:'0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8' },
    { sym:'ARB',   name:'Arbitrum',  icon:'A', color:'#28A0F0,#1a78b8', decimals:18, price:0.88,   balance:0, contract:'0x912CE59144191C1204E64559FE8253a0e49E6548' },
    { sym:'USDT',  name:'Tether',    icon:'₮', color:'#26A17B,#1a7a5a', decimals:6,  price:1.0,    balance:0, contract:'0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9' },
    { sym:'GMX',   name:'GMX',       icon:'G', color:'#03D1CF,#02a8a6', decimals:18, price:28.40,  balance:0, contract:'0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a' },
    { sym:'WETH',  name:'Wrapped ETH',icon:'Ξ',color:'#8C7BC8,#6b5ca5', decimals:18, price:3241,   balance:0, contract:'0x82aF49447D8a07e3bd95BD0d56f35241523fBab1' },
    { sym:'DAI',   name:'Dai',       icon:'◈', color:'#F5AC37,#c98b1e', decimals:18, price:1.0,    balance:0, contract:'0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1' },
  ],
  bsc: [
    { sym:'BNB',   name:'BNB',        icon:'B',  color:'#F0B90B,#c49309', decimals:18, price:581.20, balance:0, contract:null },
    { sym:'USDT',  name:'Tether',     icon:'₮',  color:'#26A17B,#1a7a5a', decimals:6,  price:1.0,   balance:0, contract:'0x55d398326f99059fF775485246999027B3197955' },
    { sym:'USDC',  name:'USD Coin',   icon:'$',  color:'#2775CA,#1557A0', decimals:6,  price:1.0,   balance:0, contract:'0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d' },
    { sym:'CAKE',  name:'PancakeSwap',icon:'🥞', color:'#1FC7D4,#179bac', decimals:18, price:2.14,  balance:0, contract:'0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82' },
    { sym:'WBTC',  name:'Wrapped BTC',icon:'₿',  color:'#F7931A,#c47209', decimals:8,  price:62400, balance:0, contract:'0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c' },
    { sym:'BUSD',  name:'BUSD',       icon:'B',  color:'#F0B90B,#c49309', decimals:18, price:1.0,   balance:0, contract:'0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56' },
    { sym:'DAI',   name:'Dai',        icon:'◈',  color:'#F5AC37,#c98b1e', decimals:18, price:1.0,   balance:0, contract:'0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3' },
  ],
  optimism: [
    { sym:'ETH',   name:'Ethereum',  icon:'Ξ', color:'#627EEA,#364FC7', decimals:18, price:3241.50, balance:0, contract:null },
    { sym:'USDC',  name:'USD Coin',  icon:'$', color:'#2775CA,#1557A0', decimals:6,  price:1.0,    balance:0, contract:'0x7F5c764cBc14f9669B88837ca1490cCa17c31607' },
    { sym:'USDT',  name:'Tether',    icon:'₮', color:'#26A17B,#1a7a5a', decimals:6,  price:1.0,    balance:0, contract:'0x94b008aA00579c1307B0EF2c499aD98a8ce58e58' },
    { sym:'WETH',  name:'Wrapped ETH',icon:'Ξ',color:'#8C7BC8,#6b5ca5', decimals:18, price:3241,   balance:0, contract:'0x4200000000000000000000000000000000000006' },
    { sym:'OP',    name:'Optimism',  icon:'O', color:'#FF0420,#cc0019', decimals:18, price:1.82,   balance:0, contract:'0x4200000000000000000000000000000000000042' },
    { sym:'DAI',   name:'Dai',       icon:'◈', color:'#F5AC37,#c98b1e', decimals:18, price:1.0,    balance:0, contract:'0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1' },
  ],
  base: [
    { sym:'ETH',   name:'Ethereum',    icon:'Ξ',  color:'#627EEA,#364FC7', decimals:18, price:3241.50, balance:0, contract:null },
    { sym:'USDC',  name:'USD Coin',    icon:'$',  color:'#2775CA,#1557A0', decimals:6,  price:1.0,    balance:0, contract:'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
    { sym:'CBETH', name:'Coinbase ETH',icon:'cb', color:'#0052FF,#003dbf', decimals:18, price:3290,   balance:0, contract:'0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22' },
    { sym:'WETH',  name:'Wrapped ETH', icon:'Ξ',  color:'#8C7BC8,#6b5ca5', decimals:18, price:3241,   balance:0, contract:'0x4200000000000000000000000000000000000006' },
    { sym:'DAI',   name:'Dai',         icon:'◈',  color:'#F5AC37,#c98b1e', decimals:18, price:1.0,    balance:0, contract:'0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb' },
    { sym:'USDbC', name:'USD Base Coin',icon:'$', color:'#2775CA,#1557A0', decimals:6,  price:1.0,    balance:0, contract:'0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA' },
  ],
  avalanche: [
    { sym:'AVAX',  name:'Avalanche',  icon:'A', color:'#E84142,#b83233', decimals:18, price:36.50,  balance:0, contract:null },
    { sym:'USDC',  name:'USD Coin',   icon:'$', color:'#2775CA,#1557A0', decimals:6,  price:1.0,    balance:0, contract:'0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E' },
    { sym:'USDT',  name:'Tether',     icon:'₮', color:'#26A17B,#1a7a5a', decimals:6,  price:1.0,    balance:0, contract:'0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7' },
    { sym:'WAVAX', name:'Wrapped AVAX',icon:'A',color:'#E84142,#b83233', decimals:18, price:36.50,  balance:0, contract:'0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7' },
    { sym:'DAI',   name:'Dai',        icon:'◈', color:'#F5AC37,#c98b1e', decimals:18, price:1.0,    balance:0, contract:'0xd586E7F844cEa2F87f50152665BCbc2C279D8d70' },
  ],
  zksync: [
    { sym:'ETH',   name:'Ethereum',  icon:'Ξ', color:'#627EEA,#364FC7', decimals:18, price:3241.50, balance:0, contract:null },
    { sym:'USDC',  name:'USD Coin',  icon:'$', color:'#2775CA,#1557A0', decimals:6,  price:1.0,    balance:0, contract:'0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4' },
    { sym:'USDT',  name:'Tether',    icon:'₮', color:'#26A17B,#1a7a5a', decimals:6,  price:1.0,    balance:0, contract:'0x493257fD37EDB34451f62EDf8D2a0C418852bA4C' },
    { sym:'WBTC',  name:'Wrapped BTC',icon:'₿',color:'#F7931A,#c47209', decimals:8,  price:62400,  balance:0, contract:'0xBBeB516fb02a01611cBBE0453Fe3c580D7281011' },
  ],
};

// Per-chain router addresses for each DEX — used for approve spender & swap calldata
const DEX_ROUTERS = {
  'uniswap v3': {
    // SwapRouter02 (new, no deadline param): 0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45
    // SwapRouter01 (old, has deadline param): 0xE592427A0AEce92De3Edee1F18E0157C05861564
    1:     '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45', // SwapRouter02 Ethereum
    56:    '0xB971eF87ede563556b2ED4b1C0b0019111Dd85d2', // PancakeSwap V3 router on BSC
    137:   '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45', // SwapRouter02 Polygon
    42161: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45', // SwapRouter02 Arbitrum
    10:    '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45', // SwapRouter02 Optimism
    8453:  '0x2626664c2603336E57B271c5C0b26F421741e481', // SwapRouter02 Base
    43114: '0xbb00FF08d01D300023C629E8fFfFcb65A5a578cE', // SwapRouter02 Avalanche
  },
  'uniswap v2': {
    1:     '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    56:    '0x10ED43C718714eb63d5aA57B78B54704E256024E', // PancakeSwap V2 on BSC acts as UniV2
    137:   '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff', // QuickSwap on Polygon
    42161: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', // SushiSwap V2 on Arb
    10:    '0x4A7b5Da61326A6379179b40d00F57E5bbDC962c2',
    8453:  '0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24',
    43114: '0x60aE616a2155Ee3d9A68541Ba4544862310933d4',
  },
  'sushiswap': {
    1:     '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
    56:    '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
    137:   '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
    42161: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
    10:    '0x4C5D5234f232BD2D76B96aA33F5AE4FCF0E4BFAb',
    8453:  '0x6BDED42c6DA8FBf0d2bA55B2fa120C5e0c8D7891',
    43114: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
  },
  'curve': {
    1:     '0x99a58482BD75cbab83b27EC03CA68fF489b5788f',
    137:   '0x094d12e5b541784701FD8d65F11fc0598FBC6332',
    42161: '0x445FE580eF8d70FF569aB36e80c647af338db351',
    10:    '0xF0d4c12A5768D806021F80a262B4d39d26C58b8D',
    8453:  '0x4D1f323773E6A4c9e72Dd1D5eC2B57a3B3d9C4B0',
  },
  'balancer': {
    1:     '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
    137:   '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
    42161: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
    10:    '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
    8453:  '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
    43114: '0xBA12222222228d8Ba445958a75a0704d566BF2C8',
  },
  'lifi': {
    1:     '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE',
    56:    '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE',
    137:   '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE',
    42161: '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE',
    10:    '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE',
    8453:  '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE',
    43114: '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE',
  },
  'odos': {
    1:     '0xCf5540fFFCdC3d510B18bFcA6d2b9987b0772559',
    56:    '0xFc89B519658967fCBe1f525f1b8f4bf62d9b9018',
    137:   '0x4E3288c9ca110bCC82bf38F09A7b425c095d92Bf',
    42161: '0xa669e7A0d4b3e4Fa48af2dE86BD4CD7126Be4e1',
    10:    '0xCa423977156BB05b13A2BA3b76Bc5419E2fE9680',
    8453:  '0x19cEeAd7105607Cd444F5ad10dd51356cc098b3c',
    43114: '0x88de50B233052e4Fb783d4F6db78Cc34d6F054e2',
  },
  'pancakeswap': {
    1:     '0xEfF92A263d31888d860bD50809A8D171709b7b1c',
    56:    '0x10ED43C718714eb63d5aA57B78B54704E256024E',
    8453:  '0x678Aa4bF4E210cf2166753e054d5b7c31cc7fa86',
    42161: '0x8cFe327CEc66d1C090Dd72bd0FF11d690C33a2Eb',
  },
  'dydx': {
    1:     '0x1E0447b19BB6EcFdAe1e4AE1694b0C3659614e4e',
  },
};

// Helper: get router address for selected DEX on current chain
function _getDexRouter(dexName, chainId) {
  const map = DEX_ROUTERS[dexName.toLowerCase()];
  return (map && map[chainId]) || null;
}

const DEX_LIST = [
  { name:'LiFi',          color:'#8B5CF6', spread: 0.001, fee:'0%'    },
  { name:'KyberSwap',     color:'#31CB9E', spread: 0.002, fee:'0%'    },
  { name:'Odos',          color:'#F97316', spread: 0.001, fee:'0%'    },
  { name:'1inch',         color:'#1B314F', spread: 0.002, fee:'0%'    },
  { name:'Rango',         color:'#FF8C00', spread: 0.001, fee:'0%'    },
  { name:'Socket',        color:'#6366F1', spread: 0.001, fee:'0%'    },
  { name:'Symbiosis',     color:'#7ED321', spread: 0.001, fee:'0%'    },
  { name:'Squid',         color:'#E84A5F', spread: 0.001, fee:'0%'    },
  { name:'Enso',          color:'#3B82F6', spread: 0.001, fee:'0%'    },
  { name:'Velora',        color:'#A855F7', spread: 0.001, fee:'0%'    },
  { name:'0x Protocol',   color:'#FFFFFF', spread: 0.002, fee:'0%'    },
  { name:'DODO',          color:'#FFE804', spread: 0.001, fee:'0%'    },
  { name:'Portals',       color:'#00D4AA', spread: 0.001, fee:'0%'    },
  { name:'Fly',           color:'#00CFFD', spread: 0.001, fee:'0%'    },
];

