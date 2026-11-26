

/* ── DEX Comparison Render ── */
let _swRoutesExpanded = false;

// ── Official DEX logo URLs (DefiLlama CDN — reliable, no CORS issues) ──
const _DL = (slug) => `https://icons.llamao.fi/icons/protocols/${slug}?w=48&h=48`;
const SW_DEX_LOGOS = {
  // Aggregators / APIs
  'LiFi':           'https://li.fi/assets/branding/png/logo_lifi_light.png',
  'Odos':           _DL('odos'),
  'KyberSwap':      _DL('kyberswap'),
  'SwapAPI':        _DL('0x-protocol'),  // fallback — real DEX names always surface from swapapi.dev response
  '1inch':          _DL('1inch-network'),
  '0x':             _DL('0x-protocol'),
  'OpenOcean':      _DL('openocean'),
  'CoW Protocol':   _DL('cow-swap'),
  'CoW':            _DL('cow-swap'),
  'Hashflow':       _DL('hashflow'),
  'Clipper':        _DL('clipper'),
  'Rango':          _DL('rango'),
  'Socket':         'https://www.socket.tech/favicon.ico',
  'OKX':            'https://static.okx.com/cdn/assets/imgs/232/4B1D6E8E0FD09F52.png',
  'Symbiosis':      _DL('symbiosis'),
  'Squid':          _DL('squid'),
  'Enso':           _DL('enso'),
  'Velora':         _DL('velora'),
  'Uniswap X':      'https://assets.coingecko.com/coins/images/12504/small/uniswap-logo.png',
  'UniswapX':       'https://assets.coingecko.com/coins/images/12504/small/uniswap-logo.png',
  'Portals':        'https://www.google.com/s2/favicons?domain=portals.fi&sz=64',
  'Fly':            'https://www.google.com/s2/favicons?domain=fly.trade&sz=64',
  'OKX DEX':        'https://static.okx.com/cdn/assets/imgs/232/4B1D6E8E0FD09F52.png',
  'Squid':          'https://www.google.com/s2/favicons?domain=squidrouter.com&sz=64',
  // DEX protocols
  'Uniswap':        'https://assets.coingecko.com/coins/images/12504/small/uniswap-logo.png',
  'Uniswap V2':     'https://assets.coingecko.com/coins/images/12504/small/uniswap-logo.png',
  'Uniswap V3':     'https://assets.coingecko.com/coins/images/12504/small/uniswap-logo.png',
  'Uniswap V4':     'https://assets.coingecko.com/coins/images/12504/small/uniswap-logo.png',
  // Rango/API variant spellings — prevent logo miss
  'Uni Swap':       'https://assets.coingecko.com/coins/images/12504/small/uniswap-logo.png',
  'Uni Swap V2':    'https://assets.coingecko.com/coins/images/12504/small/uniswap-logo.png',
  'Uni Swap V3':    'https://assets.coingecko.com/coins/images/12504/small/uniswap-logo.png',
  'Uni Swap V4':    'https://assets.coingecko.com/coins/images/12504/small/uniswap-logo.png',
  'SushiSwap':      _DL('sushiswap'),
  'Sushi':          _DL('sushiswap'),
  'PancakeSwap':    _DL('pancakeswap'),
  'PancakeSwap V3': _DL('pancakeswap'),
  'Curve':          _DL('curve'),
  'Curve Finance':  _DL('curve'),
  'Balancer':       _DL('balancer'),
  'DODO':           _DL('dodo'),
  'dYdX':           _DL('dydx'),
  'Velodrome':      _DL('velodrome'),
  'Velodrome V2':   _DL('velodrome'),
  'Aerodrome':      null,
  'Camelot':        null,
  'Camelot V3':     null,
  'Trader Joe':     _DL('traderjoe'),
  'TraderJoe':      _DL('traderjoe'),
  'QuickSwap':      _DL('quickswap'),
  'QuickSwap V3':   _DL('quickswap'),
  'SpookySwap':     _DL('spookyswap'),
  'BiSwap':         _DL('biswap'),
  'Biswap':         _DL('biswap'),
  'Maverick':       _DL('maverick-protocol'),
  'Maverick V2':    _DL('maverick-protocol'),
  'Ambient':        _DL('ambient-finance'),
  'Zyberswap':      _DL('zyberswap'),
  'iZUMi':          _DL('izumi-finance'),
  'Integral':       _DL('integral'),
  'Bancor':         _DL('bancor'),
  'Gnosis':         _DL('gnosis'),
  'Synapse':        _DL('synapse'),
  'Hop':            _DL('hop-protocol'),
  'Across':         _DL('across'),
  'Stargate':       _DL('stargate'),
  'Celer':          _DL('celer'),
  'Algebra':        _DL('algebra'),
  'THENA':          'https://www.google.com/s2/favicons?domain=thena.fi&sz=64',
  'Solidly':        'https://www.google.com/s2/favicons?domain=solidly.exchange&sz=64',
  'BaseSwap':       'https://www.google.com/s2/favicons?domain=baseswap.fi&sz=64',
  'SwapBased':      'https://www.google.com/s2/favicons?domain=swapbased.finance&sz=64',
  'SmarDex':        _DL('smardex'),
  'Pearl':          'https://www.google.com/s2/favicons?domain=pearl.exchange&sz=64',
  'Ramses':         'https://www.google.com/s2/favicons?domain=ramses.exchange&sz=64',
  'Ramses V2':      'https://www.google.com/s2/favicons?domain=ramses.exchange&sz=64',
  'Chronos':        'https://www.google.com/s2/favicons?domain=chronos.exchange&sz=64',
  'Nile':           'https://www.google.com/s2/favicons?domain=nile.exchange&sz=64',
  'Hercules':       'https://www.google.com/s2/favicons?domain=herculesdefi.com&sz=64',
  'Retro':          'https://www.google.com/s2/favicons?domain=retro.finance&sz=64',
  'SpiritSwap':     _DL('spiritswap'),
  'BeethovenX':     _DL('beethoven-x'),
  'Equalizer':      'https://www.google.com/s2/favicons?domain=equalizer.exchange&sz=64',
  'WOOFi':          _DL('woofi'),
  'VVS Finance':    'https://www.google.com/s2/favicons?domain=vvs.finance&sz=64',
  'MM Finance':     'https://www.google.com/s2/favicons?domain=mm.finance&sz=64',
  'Elk Finance':    'https://www.google.com/s2/favicons?domain=elk.finance&sz=64',
  'ApeSwap':        _DL('apeswap'),
  'BakerySwap':     'https://www.google.com/s2/favicons?domain=bakeryswap.org&sz=64',
  'BabySwap':       'https://www.google.com/s2/favicons?domain=babyswap.finance&sz=64',
  'Nomiswap':       'https://www.google.com/s2/favicons?domain=nomiswap.io&sz=64',
  'Wombat':         _DL('wombat-exchange'),
  'Platypus':       _DL('platypus-finance'),
  'Solidex':        'https://www.google.com/s2/favicons?domain=solidexfinance.com&sz=64',
  'OKX DEX':        'https://static.okx.com/cdn/assets/imgs/232/4B1D6E8E0FD09F52.png',
  'Morphex':        'https://www.google.com/s2/favicons?domain=morphex.trade&sz=64',
  'Slingshot':      'https://www.google.com/s2/favicons?domain=slingshot.finance&sz=64',
  'Transit Swap':   'https://www.google.com/s2/favicons?domain=transit.finance&sz=64',
  'ParaSwap':       _DL('paraswap'),
  'Native Router':  'https://assets.coingecko.com/coins/images/27475/small/NATIVE.png',
  'Verse':          'https://www.google.com/s2/favicons?domain=verse.bitcoin.com&sz=64',
};

// Prefix/substring fallback map for partial matches
const SW_DEX_LOGO_PREFIXES = [
  ['Uniswap',     'https://assets.coingecko.com/coins/images/12504/small/uniswap-logo.png'],
  ['Uni Swap',    'https://assets.coingecko.com/coins/images/12504/small/uniswap-logo.png'],
  ['PancakeSwap', _DL('pancakeswap')],
  ['SushiSwap',   _DL('sushiswap')],
  ['Sushi',       _DL('sushiswap')],
  ['Curve',       _DL('curve')],
  ['Balancer',    _DL('balancer')],
  ['KyberSwap',   _DL('kyberswap')],
  ['Kyber',       _DL('kyberswap')],
  ['1inch',       _DL('1inch-network')],
  ['CoW',         _DL('cow-swap')],
  ['OKX',         'https://static.okx.com/cdn/assets/imgs/232/4B1D6E8E0FD09F52.png'],
  ['LiFi',        'https://li.fi/assets/branding/png/logo_lifi_light.png'],
  ['Odos',        _DL('odos')],
  ['dYdX',        _DL('dydx')],
  ['Velodrome',   _DL('velodrome')],
  ['Rango',       _DL('rango')],
  ['Socket',      'https://www.socket.tech/favicon.ico'],
  ['Squid',       _DL('squid')],
  ['QuickSwap',   _DL('quickswap')],
  ['Trader Joe',  _DL('traderjoe')],
  ['TraderJoe',   _DL('traderjoe')],
  ['Maverick',    _DL('maverick-protocol')],
  ['WOOFi',       _DL('woofi')],
  ['ParaSwap',    _DL('paraswap')],
  ['THENA',       'https://www.google.com/s2/favicons?domain=thena.fi&sz=64'],
  ['BaseSwap',    'https://www.google.com/s2/favicons?domain=baseswap.fi&sz=64'],
  ['SmarDex',     _DL('smardex')],
  ['Ramses',      'https://www.google.com/s2/favicons?domain=ramses.exchange&sz=64'],
  ['ApeSwap',     _DL('apeswap')],
  ['Wombat',      _DL('wombat-exchange')],
  ['SpiritSwap',  _DL('spiritswap')],
  ['BeethovenX',  _DL('beethoven-x')],
  ['Algebra',     _DL('algebra')],
  ['Native Router','https://assets.coingecko.com/coins/images/27475/small/NATIVE.png'],
  ['Native',      'https://assets.coingecko.com/coins/images/27475/small/NATIVE.png'],
  ['Verse',       'https://www.google.com/s2/favicons?domain=verse.bitcoin.com&sz=64'],
  ['Uniswap X',   'https://assets.coingecko.com/coins/images/12504/small/uniswap-logo.png'],
  ['UniswapX',    'https://assets.coingecko.com/coins/images/12504/small/uniswap-logo.png'],
  ['DODO',        _DL('dodo')],
  ['Portals',     'https://www.google.com/s2/favicons?domain=portals.fi&sz=64'],
  ['Fly',         'https://www.google.com/s2/favicons?domain=fly.trade&sz=64'],
  ['OKX DEX',      'https://static.okx.com/cdn/assets/imgs/232/4B1D6E8E0FD09F52.png'],
  ['Squid',        'https://www.google.com/s2/favicons?domain=squidrouter.com&sz=64'],
];

// Inline SVG logos for Socket and LiFi — always renders, no external request needed
const _SW_INLINE_LOGOS = {
  'Socket': `<svg width="20" height="20" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="8" fill="#6366F1"/>
    <path d="M8 12.5C8 10.567 9.567 9 11.5 9H20.5C22.433 9 24 10.567 24 12.5C24 14.433 22.433 16 20.5 16H11.5C9.567 16 8 17.567 8 19.5C8 21.433 9.567 23 11.5 23H20.5C22.433 23 24 21.433 24 19.5" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="20.5" cy="12.5" r="2" fill="white"/>
    <circle cx="11.5" cy="19.5" r="2" fill="white"/>
  </svg>`,
  'LiFi': `<img src="https://li.fi/assets/branding/png/logo_lifi_dark.png" width="22" height="22" style="object-fit:contain;border-radius:4px;" />`,
  'Camelot': `<svg width="20" height="20" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="16" fill="#1A1A2E"/>
    <polygon points="50,10 90,35 90,65 50,90 10,65 10,35" fill="none" stroke="#F59E0B" stroke-width="5"/>
    <polygon points="50,22 80,38 80,62 50,78 20,62 20,38" fill="#F59E0B" opacity="0.15"/>
    <text x="50" y="57" text-anchor="middle" font-size="28" font-weight="900" font-family="Arial,sans-serif" fill="#F59E0B">C</text>
  </svg>`,
  'Aerodrome': `<svg width="20" height="20" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="16" fill="#0A0A1A"/>
    <circle cx="50" cy="50" r="36" fill="none" stroke="#0052FF" stroke-width="6"/>
    <ellipse cx="50" cy="50" rx="36" ry="14" fill="none" stroke="#0052FF" stroke-width="4" opacity="0.6"/>
    <circle cx="50" cy="50" r="8" fill="#0052FF"/>
    <line x1="50" y1="14" x2="50" y2="86" stroke="#0052FF" stroke-width="3" opacity="0.4"/>
  </svg>`,
};