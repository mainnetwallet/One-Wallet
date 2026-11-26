// Deposit modal: per-exchange chain/network fetchers
// Part of the exchange deposit modal module (split by topic; no logic change).
(function (__NX) {
  __NX._fetchExcChains = _fetchExcChains;
  __NX._buildChainDirect = _buildChainDirect;


  // ── Fetch supported chain list for a coin from exchange API ──
  // Returns array of DEP_NETS-compatible objects, or null on failure
  async function _fetchExcChains(excId, sym, keys) {
    var raw = null;
    try {
      if (excId === 'binance')   raw = await _binChains(sym, keys);
      else if (excId === 'bybit')     raw = await _bybitChains(sym, keys);
      else if (excId === 'kucoin')    raw = await _kucoinChains(sym, keys);
      else if (excId === 'mexc')      raw = await _mexcChains(sym, keys);
      else if (excId === 'gateio')    raw = await _gateioChains(sym, keys);
      else if (excId === 'bitget')    raw = await _bitgetChains(sym);
      else if (excId === 'htx')       raw = await _htxChains(sym, keys);
      else if (excId === 'bitmart')   raw = await _bitmartChains(sym, keys);
      else if (excId === 'phemex')    raw = await _phemexChains(sym, keys);
      else if (excId === 'digifinex') raw = await _digifinexChains(sym, keys);
      else if (excId === 'lbank')     raw = await _lbankChains(sym, keys);
      else if (excId === 'bitfinex')  raw = await _bitfinexChains(sym, keys);
      else if (excId === 'bingx')     raw = await _bingxChains(sym, keys);
      else if (excId === 'kraken')    raw = await _krakenChains(sym, keys);
      else if (excId === 'coinbase')  raw = await _coinbaseChains(sym, keys);
    } catch(e) { console.warn('fetchChains err', excId, e); }
    if (!raw || !raw.length) return null;
    // Deduplicate: prefer apiCode (exchange-native id) so distinct chains that happen
    // to share a normalized key (e.g. two KuCoin networks both mapping to 'eth') are kept.
    // Fall back to n.key only when apiCode is absent.
    var seen = {}; var deduped = [];
    raw.forEach(function(n) {
      if (!n || !n.key) return;
      var dedupKey = (n.apiCode || '').toLowerCase() || n.key;
      if (seen[dedupKey]) return;
      seen[dedupKey] = true;
      deduped.push(n);
    });
    return deduped.length ? deduped : null;
  }

  // Map exchange network name → our internal key + display info
  // ── Chain color/icon lookup by API code (well-known chains only) ──
  function _chainMeta(apiCode) {
    if (!apiCode) return { color:'#8b8ba7', icon:'🔗' };
    var n = apiCode.toUpperCase().replace(/[\s\-_]+/g,'');
    var _map = [
      { keys:['ETH','ERC20','ETHEREUM','ETHEREUMERC20'],           color:'#627eea', icon:'Ξ' },
      { keys:['BSC','BEP20','BNBSMARTCHAIN','BNBSMARTCHAINBEP20'], color:'#f3ba2f', icon:'⬡' },
      { keys:['MATIC','POLYGON','POL'],                            color:'#8247e5', icon:'⬡' },
      { keys:['ARB','ARBITRUM','ARBITRUMONE','ARBI'],              color:'#12aaff', icon:'🔵' },
      { keys:['BASE'],                                             color:'#0052ff', icon:'🔵' },
      { keys:['OPT','OPTIMISM','OPTIMISML2'],                      color:'#ff0420', icon:'🔴' },
      { keys:['SOL','SOLANA','SPL'],                               color:'#9945ff', icon:'◎' },
      { keys:['TRX','TRC20','TRON'],                               color:'#e8463a', icon:'⚡' },
      { keys:['BTC','BITCOIN','BECH32'],                           color:'#f7931a', icon:'₿' },
      { keys:['AVAXC','AVAX','AVALANCHE','AVALANCHECCHAIN'],       color:'#e84142', icon:'🔺' },
      { keys:['NEAR'],                                             color:'#00c08b', icon:'Ⓝ' },
      { keys:['DOT','POLKADOT'],                                   color:'#e6007a', icon:'●' },
      { keys:['KSM','KUSAMA'],                                     color:'#000000', icon:'●' },
      { keys:['SUI'],                                              color:'#6fbcf0', icon:'💧' },
      { keys:['APT','APTOS'],                                      color:'#00bfff', icon:'▲' },
      { keys:['TON','THEOPENNETWORK'],                             color:'#0098ea', icon:'💎' },
      { keys:['XRP','RIPPLE','XRPLEDGER'],                         color:'#346aa9', icon:'✕' },
      { keys:['ADA','CARDANO'],                                    color:'#0033ad', icon:'₳' },
      { keys:['DOGE','DOGECOIN'],                                  color:'#c2a633', icon:'Ð' },
      { keys:['LTC','LITECOIN'],                                   color:'#bfbbbb', icon:'Ł' },
      { keys:['KCC','KUCOINCHAIN','KUCOIN'],                       color:'#23af91', icon:'K' },
      { keys:['KAS','KASPA'],                                      color:'#70c7ba', icon:'K' },
      { keys:['ALGO','ALGORAND'],                                  color:'#00b4d8', icon:'A' },
      { keys:['ATOM','COSMOS'],                                    color:'#2e3148', icon:'⚛' },
      { keys:['OSMO','OSMOSIS'],                                   color:'#750daf', icon:'⚛' },
      { keys:['FIL','FILECOIN'],                                   color:'#0090ff', icon:'⏣' },
      { keys:['ICP'],                                              color:'#eb5528', icon:'∞' },
      { keys:['ZIL','ZILLIQA'],                                    color:'#29ccc4', icon:'Z' },
      { keys:['HBAR','HEDERA'],                                    color:'#222222', icon:'ℏ' },
      { keys:['EOS'],                                              color:'#443f54', icon:'E' },
      { keys:['XLM','STELLAR'],                                    color:'#7d00ff', icon:'*' },
      { keys:['VET','VECHAIN'],                                    color:'#15bdff', icon:'V' },
      { keys:['FTM','FANTOM'],                                     color:'#1969ff', icon:'👻' },
      { keys:['ZKSYNC','ZKSYNCE','ZKSYNCERA'],                     color:'#8c8dfc', icon:'Ζ' },
      { keys:['LINEA'],                                            color:'#61dfff', icon:'L' },
      { keys:['MNT','MANTLE'],                                     color:'#000000', icon:'M' },
      { keys:['BLAST'],                                            color:'#fcfc03', icon:'💥' },
      { keys:['STX','STACKS'],                                     color:'#5546ff', icon:'S' },
      { keys:['EGLD','ELROND','MULTIVERSX'],                       color:'#1b46c2', icon:'X' },
      { keys:['ONE','HARMONY'],                                    color:'#00aee9', icon:'H' },
      { keys:['WAVES'],                                            color:'#0055ff', icon:'〜' },
      { keys:['CRO','CRONOS'],                                     color:'#002d74', icon:'C' },
      { keys:['FLOW'],                                             color:'#00ef8b', icon:'F' },
      { keys:['HECO','HUOBI'],                                     color:'#01943f', icon:'H' },
      { keys:['OKT','OKTC','OKEXCHAIN'],                           color:'#2b63f1', icon:'O' },
      { keys:['SCROLL'],                                           color:'#eeb64b', icon:'S' },
      { keys:['KLAY','KLAYTN'],                                    color:'#ff5c00', icon:'K' },
      { keys:['CFX','CONFLUX'],                                    color:'#15c784', icon:'C' },
      { keys:['CELO'],                                             color:'#35d07f', icon:'C' },
      { keys:['KAVA'],                                             color:'#ff564f', icon:'K' },
      { keys:['GLMR','MOONBEAM'],                                  color:'#e1147b', icon:'🌕' },
      { keys:['MOVR','MOONRIVER'],                                 color:'#f2ab37', icon:'🌕' },
      { keys:['METIS'],                                            color:'#00dacc', icon:'M' },
      { keys:['BOBA'],                                             color:'#cbff00', icon:'B' },
      { keys:['AURORA'],                                           color:'#70d44b', icon:'A' },
      { keys:['ASTAR'],                                            color:'#006ef7', icon:'A' },
      { keys:['CORE'],                                             color:'#ff9211', icon:'C' },
      { keys:['CSPR','CASPER'],                                    color:'#ff473e', icon:'C' },
      { keys:['CKB','NERVOS'],                                     color:'#3cc68a', icon:'N' },
      { keys:['ROSE','OASIS'],                                     color:'#0092f6', icon:'O' },
      { keys:['XDC','XINFIN'],                                     color:'#2f80ed', icon:'X' },
      { keys:['ICX','ICON'],                                       color:'#00b8cc', icon:'I' },
      { keys:['ONT','ONTOLOGY'],                                   color:'#00a6c2', icon:'O' },
      { keys:['THETA'],                                            color:'#2ab8e6', icon:'Θ' },
      { keys:['BAND'],                                             color:'#516aff', icon:'B' },
      { keys:['SCRT','SECRET'],                                    color:'#1b1b1b', icon:'S' },
      { keys:['XTZ','TEZOS'],                                      color:'#0177c1', icon:'ꜩ' },
      { keys:['NEO'],                                              color:'#58bf00', icon:'N' },
      { keys:['NULS'],                                             color:'#0facac', icon:'N' },
      { keys:['FUSE'],                                             color:'#b4f000', icon:'F' },
      { keys:['ETHW','ETHEREUMPOW'],                               color:'#9b9b9b', icon:'Ξ' },
      { keys:['BNB','BNBBEACONCHAIN'],                             color:'#f3ba2f', icon:'⬡' },
      { keys:['STEEM'],                                            color:'#4ba2f2', icon:'S' },
      { keys:['HIVE'],                                             color:'#e31337', icon:'H' },
    ];
    for (var i=0; i<_map.length; i++) {
      for (var j=0; j<_map[i].keys.length; j++) {
        if (n === _map[i].keys[j]) return _map[i];
      }
    }
    // substring fallback for longer codes
    for (var i=0; i<_map.length; i++) {
      for (var j=0; j<_map[i].keys.length; j++) {
        var k = _map[i].keys[j];
        if (k.length >= 4 && (n.indexOf(k) !== -1 || (n.length >= 4 && k.indexOf(n) !== -1))) return _map[i];
      }
    }
    return { color:'#8b8ba7', icon:'🔗' };
  }

  // ── Build chain entry directly from API label (no normalization mapping) ──
  function _buildChainDirect(label, apiCode, contract, colorOverride, iconOverride) {
    if (!label && !apiCode) return null;
    var displayLabel = label || apiCode;
    var key = (apiCode || label).toLowerCase().replace(/[^a-z0-9]/g,'');
    var meta = (colorOverride && iconOverride) ? { color: colorOverride, icon: iconOverride } : _chainMeta(apiCode || label);
    return { key: key, label: displayLabel, sub: apiCode || displayLabel, chainId: 0, color: meta.color, contract: contract || '', icon: meta.icon, apiCode: apiCode || label };
  }


  // ── Binance: /sapi/v1/capital/config/getall ──
  async function _binChains(sym, keys) {
    var params = { timestamp: Date.now(), recvWindow: 10000 };
    var qs = Object.keys(params).map(function(k){return k+'='+params[k];}).join('&');
    var sig = await __NX._hmac256(keys.secret, qs);
    var res = await _nxSignedFetch('https://api.binance.com/sapi/v1/capital/config/getall?' + qs + '&signature=' + sig, {
      headers: {'X-MBX-APIKEY': keys.apiKey}, ms: 12000
    });
    var list = await res.json();
    if (!Array.isArray(list)) return null;
    var coin = list.find(function(c){ return c.coin && c.coin.toUpperCase() === sym.toUpperCase(); });
    if (!coin || !Array.isArray(coin.networkList)) return null;
    var chains = [];
    coin.networkList.forEach(function(n) {
      if (!n.depositEnable) return;
      var entry = _buildChainDirect(n.networkFullName || n.network, n.network, n.contractAddressUrl ? '' : '');
      if (entry) chains.push(entry);
    });
    return chains.length ? chains : null;
  }

  // ── Bybit: /v5/asset/coin/query-info ──
  async function _bybitChains(sym, keys) {
    var ts = Date.now().toString();
    var qs = 'coin=' + sym;
    var payload = ts + keys.apiKey + '5000' + qs;
    var sig = await __NX._hmac256(keys.secret, payload);
    var res = await _nxSignedFetch('https://api.bybit.com/v5/asset/coin/query-info?' + qs, {
      headers: {'X-BAPI-API-KEY': keys.apiKey,'X-BAPI-SIGN': sig,'X-BAPI-TIMESTAMP': ts,'X-BAPI-RECV-WINDOW':'5000'},
      ms: 12000
    });
    var d = await res.json();
    if (!d || !d.result || !Array.isArray(d.result.rows) || !d.result.rows[0]) return null;
    var chains = [];
    (d.result.rows[0].chains || []).forEach(function(ch) {
      if (ch.chainDeposit !== '1') return;
      var entry = _buildChainDirect(ch.chain, ch.chain, '');
      if (entry) chains.push(entry);
    });
    return chains.length ? chains : null;
  }

  // ── KuCoin deposit chains: /api/v3/currencies/{sym} → all deposit-enabled chains ──
  // (/api/v3/deposit-addresses only returns already-created addresses — chains never
  //  deposited to before would be missing. /api/v3/currencies gives the full chain list.)
  var _kcDepAddrCache = {}; __NX._kcDepAddrCache = _kcDepAddrCache; // sym → { chainId → {address, memo} }
  async function _kucoinChains(sym, keys) {
    var ts = Date.now().toString();
    var passphraseEnc = await __NX._hmac256b64(keys.secret, keys.passphrase || '');
    var path = '/api/v3/currencies/' + sym;
    var sig  = await __NX._hmac256b64(keys.secret, ts + 'GET' + path);
    var res  = await _nxSignedFetch('https://api.kucoin.com' + path, {
      headers: {'KC-API-KEY': keys.apiKey,'KC-API-SIGN': sig,'KC-API-TIMESTAMP': ts,
                'KC-API-PASSPHRASE': passphraseEnc,'KC-API-KEY-VERSION':'2'},
      ms: 12000
    });
    var d = await res.json();
    if (!d || !d.data || !Array.isArray(d.data.chains)) return null;
    var chains = [];
    d.data.chains.forEach(function(ch) {
      if (!ch.isDepositEnabled) return; // skip deposit-disabled chains
      var chainId = ch.chainId || '';
      if (!chainId) return;
      var entry = _buildChainDirect(ch.chainFullName || ch.chainName || chainId, chainId, ch.contractAddress || '');
      if (entry) chains.push(entry);
    });
    return chains.length ? chains : null;
  }

  // ── MEXC: /api/v3/capital/config/getall ──
  async function _mexcChains(sym, keys) {
    var params = { timestamp: Date.now(), recvWindow: 10000 };
    var qs = 'timestamp=' + params.timestamp + '&recvWindow=' + params.recvWindow;
    var sig = await __NX._hmac256(keys.secret, qs);
    var res = await _nxSignedFetch('https://api.mexc.com/api/v3/capital/config/getall?' + qs + '&signature=' + sig, {
      headers: {'X-MEXC-APIKEY': keys.apiKey}, ms: 12000
    });
    var list = await res.json();
    if (!Array.isArray(list)) return null;
    var coin = list.find(function(c){ return c.coin && c.coin.toUpperCase() === sym.toUpperCase(); });
    if (!coin || !Array.isArray(coin.networkList)) return null;
    var chains = [];
    coin.networkList.forEach(function(n) {
      if (!n.depositEnable) return;
      var entry = _buildChainDirect(n.network, n.network, '');
      if (entry) chains.push(entry);
    });
    return chains.length ? chains : null;
  }

  // ── Gate.io: /api/v4/wallet/currency_chains ──
  async function _gateioChains(sym, keys) {
    var ts = Math.floor(Date.now()/1000).toString();
    var path = '/api/v4/wallet/currency_chains';
    var qs = 'currency=' + sym;
    var body = '';
    var bodyHash = await __NX._sha512hex('');
    var signStr = 'GET\n' + path + '\n' + qs + '\n' + bodyHash + '\n' + ts;
    var sig = await __NX._hmac512hex(keys.secret, signStr);
    var res = await _nxSignedFetch('https://api.gateio.ws' + path + '?' + qs, {
      headers: {'KEY': keys.apiKey,'SIGN': sig,'Timestamp': ts},
      ms: 12000
    });
    var list = await res.json();
    if (!Array.isArray(list)) return null;
    var chains = [];
    list.forEach(function(ch) {
      if (ch.is_deposit_disabled) return;
      var entry = _buildChainDirect(ch.name_en || ch.chain, ch.chain, ch.contract_address || '');
      if (entry) chains.push(entry);
    });
    return chains.length ? chains : null;
  }

  // ── Bitget: /api/v2/spot/public/coins (PUBLIC - no auth) ──
  async function _bitgetChains(sym) {
    var res = await _nxSignedFetch('https://api.bitget.com/api/v2/spot/public/coins?coin=' + sym, {
      ms: 12000
    });
    var d = await res.json();
    if (!d || !Array.isArray(d.data) || !d.data[0]) return null;
    var chains = [];
    (d.data[0].chains || []).forEach(function(ch) {
      if (ch.rechargeable !== 'true' && ch.rechargeable !== true) return;
      var entry = _buildChainDirect(ch.chainName || ch.chain, ch.chain, ch.contractAddress || '');
      if (entry) chains.push(entry);
    });
    return chains.length ? chains : null;
  }

  // ── HTX: /v2/reference/currencies ──
  async function _htxChains(sym, keys) {
    var host = 'api.huobi.pro', path = '/v2/reference/currencies';
    var ts = new Date().toISOString().slice(0,19);
    var params = { AccessKeyId: keys.apiKey, SignatureMethod:'HmacSHA256', SignatureVersion:'2', Timestamp: ts, currency: sym.toLowerCase() };
    var sortedKeys = Object.keys(params).sort();
    var qs = sortedKeys.map(function(k){return encodeURIComponent(k)+'='+encodeURIComponent(params[k]);}).join('&');
    var strToSign = 'GET\n' + host + '\n' + path + '\n' + qs;
    var sig = await __NX._hmac256b64(keys.secret, strToSign);
    var url = 'https://' + host + path + '?' + qs + '&Signature=' + encodeURIComponent(sig);
    var res = await _nxSignedFetch(url, { ms: 12000 });
    var d = await res.json();
    if (!d || !Array.isArray(d.data) || !d.data[0]) return null;
    var chains = [];
    (d.data[0].chains || []).forEach(function(ch) {
      if (ch.depositStatus !== 'allowed') return;
      var entry = _buildChainDirect(ch.displayName || ch.baseChain, ch.baseChain || ch.displayName, ch.contractAddress || '');
      if (entry) chains.push(entry);
    });
    return chains.length ? chains : null;
  }

  // ── BitMart: /spot/v1/currencies (public) ──
  async function _bitmartChains(sym, keys) {
    var res = await _nxSignedFetch('https://api-cloud.bitmart.com/account/v1/currencies', {
      ms: 12000
    });
    var d = await res.json();
    if (!d || !d.data || !Array.isArray(d.data.currencies)) return null;
    var symUp = sym.toUpperCase();
    var rows = d.data.currencies.filter(function(c) {
      if (!c.currency) return false;
      var base = c.currency.split('-')[0].toUpperCase();
      return base === symUp;
    });
    var chains = [];
    rows.forEach(function(c) {
      if (!c.deposit_enabled) return;
      var entry = _buildChainDirect(c.network || c.currency, c.currency, c.contract_address || '');
      if (entry) chains.push(entry);
    });
    return chains.length ? chains : null;
  }

  // ── BitMart withdraw-enabled chains (same endpoint, withdraw_enabled filter) ──
  async function _bitmartChainsWd(sym, keys) {
    var res = await _nxSignedFetch('https://api-cloud.bitmart.com/account/v1/currencies', {
      ms: 12000
    });
    var d = await res.json();
    if (!d || !d.data || !Array.isArray(d.data.currencies)) return null;
    var symUp = sym.toUpperCase();
    var rows = d.data.currencies.filter(function(c) {
      if (!c.currency) return false;
      var base = c.currency.split('-')[0].toUpperCase();
      return base === symUp;
    });
    var chains = [];
    rows.forEach(function(c) {
      if (!c.withdraw_enabled) return;
      var entry = _buildChainDirect(c.network || c.currency, c.currency, c.contract_address || '');
      if (entry) chains.push(entry);
    });
    return chains.length ? chains : null;
  }


  // ── Phemex: GET /public/products → currencies[].networks[] ──
  async function _phemexChains(sym, keys) {
    try {
      var d = await (await _nxSignedFetch('https://api.phemex.com/public/products', {ms: 12000})).json();
      if (!d || !d.data || !Array.isArray(d.data.currencies)) return null;
      var curr = d.data.currencies.find(function(c){ return c.currency && c.currency.toUpperCase() === sym.toUpperCase(); });
      if (!curr || !Array.isArray(curr.networks)) return null;
      var chains = [];
      curr.networks.forEach(function(n) {
        if (!n.network || n.depositEnabled === false) return;
        var e = _buildChainDirect(n.network, n.network, '');
        if (e) chains.push(e);
      });
      return chains.length ? chains : null;
    } catch(e) { return null; }
  }

  // ── DigiFinex: GET /v3/deposit/address → available chains for coin ──
  async function _digifinexChains(sym, keys) {
    try {
      var ts = Math.floor(Date.now()/1000).toString();
      var enc = new TextEncoder();
      var buf = await crypto.subtle.digest('SHA-256', enc.encode(keys.apiKey + ts + keys.secret));
      var sig = Array.from(new Uint8Array(buf)).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
      var d = await (await _nxSignedFetch('https://openapi.digifinex.com/v3/deposit/address?symbol=' + sym.toLowerCase(), {
        headers: {'ACCESS-KEY': keys.apiKey, 'ACCESS-SIGN': sig, 'ACCESS-TIMESTAMP': ts},
        ms: 12000
      })).json();
      if (!d || !Array.isArray(d.data) || !d.data.length) return null;
      var chains = []; var seen = {};
      d.data.forEach(function(entry) {
        var raw = entry.chain || entry.network;
        if (!raw || seen[raw]) return;
        seen[raw] = true;
        var e = _buildChainDirect(raw, raw, '');
        if (e) chains.push(e);
      });
      return chains.length ? chains : null;
    } catch(e) { return null; }
  }

  // ── LBank: GET /v2/withdrawConfigs.do (public) → coin chain list ──
  async function _lbankChains(sym, keys) {
    try {
      var d = await (await _nxSignedFetch('https://api.lbank.com/v2/withdrawConfigs.do?assetCode=' + sym.toLowerCase(), {
        ms: 12000
      })).json();
      if (!d || d.result !== 'true' || !Array.isArray(d.data)) return null;
      var chains = [];
      d.data.forEach(function(entry) {
        var raw = entry.netWork || entry.network || entry.chain;
        if (!raw) return;
        var e = _buildChainDirect(raw, raw, '');
        if (e) chains.push(e);
      });
      return chains.length ? chains : null;
    } catch(e) { return null; }
  }

  // ── Bitfinex: public /v2/conf/pub:map:currency:tx:method → methods per coin ──
  async function _bitfinexChains(sym, keys) {
    try {
      var d = await (await _nxSignedFetch('https://api-pub.bitfinex.com/v2/conf/pub:map:currency:tx:method', {
        ms: 12000
      })).json();
      if (!Array.isArray(d) || !Array.isArray(d[0])) return null;
      var entry = d[0].find(function(item){ return item[0] && item[0].toUpperCase() === sym.toUpperCase(); });
      if (!entry || !Array.isArray(entry[1])) return null;
      var chains = [];
      entry[1].forEach(function(method) {
        if (!method) return;
        var e = _buildChainDirect(method, method, '');
        if (e) chains.push(e);
      });
      return chains.length ? chains : null;
    } catch(e) { return null; }
  }

  // ── BingX: /openApi/wallets/v1/capital/config/getall (deposit-enabled networks) ──
  async function _bingxChains(sym, keys) {
    var ts = Date.now().toString();
    var params = { timestamp: ts, recvWindow: '10000' };
    var qs = Object.keys(params).sort().map(function(k){return k+'='+params[k];}).join('&');
    var sig = await __NX._hmac256(keys.secret, qs);
    var res = await _nxSignedFetch('https://open-api.bingx.com/openApi/wallets/v1/capital/config/getall?' + qs + '&signature=' + sig, {
      headers: {'X-BX-APIKEY': keys.apiKey}, ms: 12000
    });
    var d = await res.json();
    if (!d || !Array.isArray(d.data)) return null;
    var coin = d.data.find(function(c){ return c.coin && c.coin.toUpperCase() === sym.toUpperCase(); });
    if (!coin || !Array.isArray(coin.networkList)) return null;
    var chains = [];
    coin.networkList.forEach(function(n) {
      if (!n.depositEnable) return;
      var entry = _buildChainDirect(n.name || n.network, n.network, '');
      if (entry) chains.push(entry);
    });
    return chains.length ? chains : null;
  }

  // ── Kraken: GET /0/private/WithdrawMethods also lists the method names
  // DepositAddresses accepts as its "method" param, so reuse it here too. ──
  async function _krakenChains(sym, keys) {
    try {
      var nonce = Date.now().toString();
      var krakenMap = {'USDT':'USDT','BTC':'XBT','ETH':'ETH','BNB':'BNB','USDC':'USDC','SOL':'SOL','XRP':'XXRP','ADA':'ADA','DOT':'DOT','DOGE':'XDOGE','LTC':'XLTCZ'};
      var asset = krakenMap[sym] || sym;
      var path = '/0/private/WithdrawMethods';
      var postData = 'nonce=' + nonce + '&asset=' + asset;
      var enc = new TextEncoder();
      var sha256buf = await crypto.subtle.digest('SHA-256', enc.encode(nonce + postData));
      var msgToSign = path + String.fromCharCode.apply(null, new Uint8Array(sha256buf));
      var secretBytes = Uint8Array.from(atob(keys.secret), function(c){return c.charCodeAt(0);});
      var key = await crypto.subtle.importKey('raw', secretBytes, {name:'HMAC',hash:'SHA-512'}, false, ['sign']);
      var sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(msgToSign));
      var sig = btoa(String.fromCharCode.apply(null, new Uint8Array(sigBuf)));
      var res = await _nxSignedFetch('https://api.kraken.com' + path, {
        method: 'POST',
        headers: {'API-Key': keys.apiKey, 'API-Sign': sig, 'Content-Type': 'application/x-www-form-urlencoded'},
        body: postData, ms: 12000
      });
      var d = await res.json();
      if (!d || !d.result || !Array.isArray(d.result)) return null;
      var chains = []; var seen = {};
      d.result.forEach(function(m) {
        var raw = m.method;
        if (!raw || seen[raw]) return;
        seen[raw] = true;
        var entry = _buildChainDirect(raw, raw, '');
        if (entry) chains.push(entry);
      });
      return chains.length ? chains : null;
    } catch(e) { return null; }
  }

  // ── Coinbase: GET /currencies/{id} (public, no auth) → supported_networks ──
  async function _coinbaseChains(sym, keys) {
    try {
      var res = await _nxSignedFetch('https://api.exchange.coinbase.com/currencies/' + sym.toUpperCase(), { method: 'GET', ms: 10000 });
      var d = await res.json();
      if (!d || !Array.isArray(d.supported_networks)) return null;
      var chains = [];
      d.supported_networks.forEach(function(n) {
        if (n.status && n.status.toLowerCase() !== 'online') return;
        var entry = _buildChainDirect(n.display_name || n.network, n.network, n.contract_address || '');
        if (entry) chains.push(entry);
      });
      return chains.length ? chains : null;
    } catch(e) { return null; }
  }
})((window.__nxp = window.__nxp || {}).mod_deposit_modal = window.__nxp.mod_deposit_modal || {});
