// Exchange list, shared state and per-exchange caches
// Part of the exchange spot engine (window.EXC) module (split by topic; no logic change).
(function (__NX) {
  __NX._clearExchangeCache = _clearExchangeCache;


  // ── Supported exchanges config ──
  var EXCHANGES = [
    {
      id: 'binance',
      name: 'Binance',
      logo: 'https://bin.bnbstatic.com/static/images/common/favicon.ico',
      color: '#F0B90B',
      baseUrl: 'https://api.binance.com',
      hasPassphrase: false,
      supportsConvert: true,
      endpoints: {
        ticker:    '/api/v3/ticker/24hr',
        balance:   '/api/v3/account',
        order:     '/api/v3/order',
        openOrders:'/api/v3/openOrders',
        allOrders: '/api/v3/allOrders',
        cancelOrder:'/api/v3/order',
        exchangeInfo:'/api/v3/exchangeInfo',
      }
    },
    {
      id: 'kucoin',
      name: 'KuCoin',
      logo: 'https://www.kucoin.com/favicon.ico',
      color: '#00B897',
      baseUrl: 'https://api.kucoin.com',
      hasPassphrase: true,
      supportsConvert: true,
      endpoints: {
        ticker:    '/api/v1/market/allTickers',
        balance:   '/api/v1/accounts',
        order:     '/api/v1/orders',
        openOrders:'/api/v1/orders?status=active',
        allOrders: '/api/v1/orders?status=done',
        cancelOrder:'/api/v1/orders/',
      }
    },
    {
      id: 'mexc',
      name: 'MEXC',
      logo: 'https://mexc.com/favicon.ico',
      color: '#2354E6',
      baseUrl: 'https://api.mexc.com',
      hasPassphrase: false,
      supportsConvert: false,
      endpoints: {
        ticker:    '/api/v3/ticker/24hr',
        balance:   '/api/v3/account',
        order:     '/api/v3/order',
        openOrders:'/api/v3/openOrders',
        allOrders: '/api/v3/allOrders',
        cancelOrder:'/api/v3/order',
      }
    },
    {
      id: 'bybit',
      name: 'Bybit',
      logo: 'https://www.bybit.com/favicon.ico',
      color: '#F7A600',
      baseUrl: 'https://api.bybit.com',
      hasPassphrase: false,
      supportsConvert: true,
      endpoints: {
        ticker:    '/v5/market/tickers',
        balance:   '/v5/account/wallet-balance',
        order:     '/v5/order/create',
        openOrders:'/v5/order/realtime',
        allOrders: '/v5/order/history',
        cancelOrder:'/v5/order/cancel',
      }
    },
    {
      id: 'bitmart',
      name: 'BitMart',
      logo: 'https://www.bitmart.com/favicon.ico',
      color: '#00B07A',
      baseUrl: 'https://api-cloud.bitmart.com',
      hasPassphrase: true,
      supportsConvert: false,
      endpoints: {
        ticker:    '/spot/quotation/v3/tickers',
        balance:   '/account/v1/wallet',
        order:     '/spot/v2/submit_order',
        openOrders:'/spot/v4/query/open-orders',
        allOrders: '/spot/v4/query/history-orders',
        cancelOrder:'/spot/v3/cancel_order',
      }
    },
    {
      id: 'bitget',
      name: 'Bitget',
      logo: 'https://www.bitget.com/favicon.ico',
      color: '#00F0FF',
      baseUrl: 'https://api.bitget.com',
      hasPassphrase: true,
      supportsConvert: true,
      endpoints: {
        ticker:    '/api/v2/spot/market/tickers',
        balance:   '/api/v2/spot/account/assets',
        order:     '/api/v2/spot/trade/place-order',
        openOrders:'/api/v2/spot/trade/unfilled-orders',
        allOrders: '/api/v2/spot/trade/history-orders',
        cancelOrder:'/api/v2/spot/trade/cancel-order',
      }
    },
    {
      id: 'kraken',
      name: 'Kraken',
      logo: 'https://www.kraken.com/favicon.ico',
      color: '#5741D9',
      baseUrl: 'https://api.kraken.com',
      hasPassphrase: false,
      supportsConvert: false,
      endpoints: {
        ticker:    '/0/public/Ticker',
        balance:   '/0/private/Balance',
        order:     '/0/private/AddOrder',
        openOrders:'/0/private/OpenOrders',
        allOrders: '/0/private/ClosedOrders',
        cancelOrder:'/0/private/CancelOrder',
      }
    },
    {
      id: 'gateio',
      name: 'Gate.io',
      logo: 'https://www.gate.io/favicon.ico',
      color: '#16C784',
      baseUrl: 'https://api.gateio.ws',
      hasPassphrase: false,
      supportsConvert: true,
      endpoints: {
        ticker:    '/api/v4/spot/tickers',
        balance:   '/api/v4/spot/accounts',
        order:     '/api/v4/spot/orders',
        openOrders:'/api/v4/spot/orders',
        allOrders: '/api/v4/spot/orders',
        cancelOrder:'/api/v4/spot/orders',
      }
    },
    {
      id: 'coinbase',
      name: 'Coinbase',
      logo: 'https://www.coinbase.com/favicon.ico',
      color: '#0052FF',
      baseUrl: 'https://api.exchange.coinbase.com',
      hasPassphrase: true,
      supportsConvert: false,
      defaultPair: 'BTCUSDC', // Coinbase is USD/USDC-quoted — USDT pairs are rare-to-nonexistent
      endpoints: {
        ticker:    '/products',
        balance:   '/accounts',
        order:     '/orders',
        openOrders:'/orders',
        allOrders: '/orders',
        cancelOrder:'/orders',
      }
    },
    {
      id: 'bingx',
      name: 'BingX',
      logo: 'https://bingx.com/favicon.ico',
      color: '#0052FF',
      baseUrl: 'https://open-api.bingx.com',
      hasPassphrase: false,
      supportsConvert: false,
      endpoints: {
        ticker:    '/openApi/spot/v1/ticker/24hr',
        balance:   '/openApi/spot/v1/account/balance',
        order:     '/openApi/spot/v1/trade/order',
        openOrders:'/openApi/spot/v1/trade/openOrders',
        allOrders: '/openApi/spot/v1/trade/historyOrders',
        cancelOrder:'/openApi/spot/v1/trade/cancel',
      }
    },
    {
      id: 'htx',
      name: 'HTX',
      logo: 'https://www.htx.com/favicon.ico',
      color: '#1E2329',
      baseUrl: 'https://api.huobi.pro',
      hasPassphrase: false,
      supportsConvert: false,
      endpoints: {
        ticker:    '/market/tickers',
        balance:   '/v1/account/accounts',
        order:     '/v1/order/orders/place',
        openOrders:'/v1/order/openOrders',
        allOrders: '/v1/order/orders',
        cancelOrder:'/v1/order/orders',
      }
    },

    {
      id: 'phemex',
      name: 'Phemex',
      logo: 'https://phemex.com/favicon.ico',
      color: '#39DBA3',
      baseUrl: 'https://api.phemex.com',
      hasPassphrase: false,
      supportsConvert: false,
      endpoints: {
        ticker:    '/md/spot/ticker/24hr/all',
        balance:   '/spot/wallets',
        order:     '/spot/orders',
        openOrders:'/spot/orders/active',
        allOrders: '/exchange/order/v2/orderList',
        cancelOrder:'/spot/orders',
      }
    },
    {
      id: 'digifinex',
      name: 'DigiFinex',
      logo: 'https://www.digifinex.com/favicon.ico',
      color: '#2762FF',
      baseUrl: 'https://openapi.digifinex.com',
      hasPassphrase: false,
      supportsConvert: false,
      endpoints: {
        ticker:    '/v3/ticker',
        balance:   '/v3/spot/assets',
        order:     '/v3/spot/order/new',
        openOrders:'/v3/spot/order/current',
        allOrders: '/v3/spot/order/history',
        cancelOrder:'/v3/spot/order/cancel',
      }
    },
    {
      id: 'lbank',
      name: 'LBank',
      logo: 'https://www.lbank.com/favicon.ico',
      color: '#F7B500',
      baseUrl: 'https://api.lbkex.com',
      hasPassphrase: false,
      supportsConvert: false,
      endpoints: {
        ticker:    '/v2/ticker/24hr.do',
        balance:   '/v2/supplement/user_info.do',
        order:     '/v2/supplement/create_order.do',
        openOrders:'/v2/supplement/orders_info_no_deal.do',
        allOrders: '/v2/supplement/orders_info_history.do',
        cancelOrder:'/v2/supplement/cancel_order.do',
      }
    },
    {
      id: 'bitfinex',
      name: 'Bitfinex',
      logo: 'https://www.bitfinex.com/favicon.ico',
      color: '#16B157',
      baseUrl: 'https://api.bitfinex.com',
      hasPassphrase: false,
      supportsConvert: false,
      endpoints: {
        ticker:    '/v2/tickers',
        balance:   '/v2/auth/r/wallets',
        order:     '/v2/auth/w/order/submit',
        openOrders:'/v2/auth/r/orders',
        allOrders: '/v2/auth/r/orders/hist',
        cancelOrder:'/v2/auth/w/order/cancel',
      }
    }
  ]; __NX.EXCHANGES = EXCHANGES;

  // ── Markets cache (one entry per exchange) ──
  // Populated by preloadAllMarkets() right when the app/page loads, so by the
  // time the user actually opens the exchange tab — or switches exchanges —
  // the list is already sitting in memory instead of waiting on a fetch.
  var _marketsCache = {}; __NX._marketsCache = _marketsCache;
  __NX._krakenPairCache = [];
  __NX._marketsPreloaded = false;
  __NX._bgPreloadStarted = false;
  var _portfolioCache = {}; __NX._portfolioCache = _portfolioCache;

  // ── Per-tab data caches (keyed by exchange id) ──
  // Tab switch করলে cached data instantly দেখাবে, কোনো API call হবে না।
  // Exchange switch করলে সেই exchange-এর সব cache clear হবে → fresh call।
  var _ordersOpenCache = {}; __NX._ordersOpenCache = _ordersOpenCache;  // exchange_id → [{id,symbol,side,...}]
  var _ordersHistCache = {}; __NX._ordersHistCache = _ordersHistCache;  // exchange_id → [{...}]
  var _balanceCache2 = {}; __NX._balanceCache2 = _balanceCache2;

  // Clears all tab-data caches for a given exchange so the next visit forces
  // a fresh API call. Called by selectExchange() on every exchange switch.
  function _clearExchangeCache(excId) {
    delete _ordersOpenCache[excId];
    delete _ordersHistCache[excId];
    // _balanceCache2 keys are excId_asset — delete all matching keys
    Object.keys(_balanceCache2).forEach(function(k) {
      if (k.indexOf(excId + '_') === 0) delete _balanceCache2[k];
    });
    delete _portfolioCache[excId];
    delete __NX._futBalCache[excId];
    delete __NX._futPosCache[excId];
    delete __NX._futOrdCache[excId];
  }
})((window.__nxp = window.__nxp || {}).mod_exc_spot_engine = window.__nxp.mod_exc_spot_engine || {});
