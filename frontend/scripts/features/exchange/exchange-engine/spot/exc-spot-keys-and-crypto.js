// API key storage, HMAC/hash helpers and symbol converters
// Part of the exchange spot engine (window.EXC) module (split by topic; no logic change).
(function (__NX) {
  __NX.getKeys = getKeys;
  __NX.saveKeys = saveKeys;
  __NX.getExchangeKey = getExchangeKey;
  __NX.activeExc = activeExc;
  __NX.hmacSha256 = hmacSha256;
  __NX.binanceFetch = binanceFetch;
  __NX.mexcFetch = mexcFetch;
  __NX.kucoinFetch = kucoinFetch;
  __NX.toKucoinSymbol = toKucoinSymbol;
  __NX.bybitFetch = bybitFetch;
  __NX.hmacSha256B64 = hmacSha256B64;
  __NX.hmacSha256B64RawSecret = hmacSha256B64RawSecret;
  __NX.hmacSha512Hex = hmacSha512Hex;
  __NX.hmacSha512B64RawSecret = hmacSha512B64RawSecret;
  __NX.hmacSha384Hex = hmacSha384Hex;
  __NX.sha256DigestBytes = sha256DigestBytes;
  __NX.sha512Hex = sha512Hex;
  __NX.md5Hex = md5Hex;
  __NX.toUnderscoreSymbol = toUnderscoreSymbol;
  __NX.toDashSymbol = toDashSymbol;
  __NX.toLowerUnderscoreSymbol = toLowerUnderscoreSymbol;
  __NX.toKrakenPair = toKrakenPair;
  __NX.toBitfinexSymbol = toBitfinexSymbol;
  __NX.fromUnderscoreSymbol = fromUnderscoreSymbol;
  __NX.fromDashSymbol = fromDashSymbol;


  // ── Key storage (AES via SubtleCrypto) ──
  var KEY_STORE = 'one_exc_keys_v1';

  function getKeys() {
    try { return JSON.parse(localStorage.getItem(KEY_STORE) || '{}'); } catch(e) { return {}; }
  }
  function saveKeys(obj) {
    try { localStorage.setItem(KEY_STORE, JSON.stringify(obj)); } catch(e) {}
  }
  function getExchangeKey(exchId) {
    var keys = getKeys();
    return keys[exchId] || null; // {apiKey, secret, passphrase}
  }

  // ── Get active exchange config ──
  function activeExc() {
    return __NX.EXCHANGES.find(function(e) { return e.id === __NX.state.activeExchange; }) || __NX.EXCHANGES[0];
  }

  // ── HMAC-SHA256 signature (SubtleCrypto) ──
  async function hmacSha256(secret, message) {
    var enc = new TextEncoder();
    var key = await crypto.subtle.importKey('raw', enc.encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
    var sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
    return Array.from(new Uint8Array(sig)).map(function(b) { return b.toString(16).padStart(2,'0'); }).join('');
  }

  // ── Binance signed request ──
  async function binanceFetch(endpoint, params, keys, method, excOverride) {
    method = method || 'GET';
    params = params || {};
    params.timestamp = Date.now();
    params.recvWindow = 10000;
    var qs = Object.keys(params).map(function(k) { return k+'='+encodeURIComponent(params[k]); }).join('&');
    var sig = await hmacSha256(keys.secret, qs);
    var url = (excOverride || activeExc()).baseUrl + endpoint + '?' + qs + '&signature=' + sig;
    var res = await __NX._nxSignedFetch(url, {
      method: method,
      headers: { 'X-MBX-APIKEY': keys.apiKey }
    });
    return res.json();
  }

  // ── MEXC signed request (same as Binance) ──
  async function mexcFetch(endpoint, params, keys, method, excOverride) {
    method = method || 'GET';
    params = params || {};
    params.timestamp = Date.now();
    var qs = Object.keys(params).map(function(k) { return k+'='+encodeURIComponent(params[k]); }).join('&');
    var sig = await hmacSha256(keys.secret, qs);
    var url = (excOverride || activeExc()).baseUrl + endpoint + '?' + qs + '&signature=' + sig;
    var res = await __NX._nxSignedFetch(url, {
      method: method,
      headers: { 'X-MEXC-APIKEY': keys.apiKey }
    });
    return res.json();
  }

  // ── KuCoin signed request ──
  async function kucoinFetch(endpoint, params, keys, method, body, excOverride) {
    method = method || 'GET';
    var ts = Date.now().toString();
    var bodyStr = body ? JSON.stringify(body) : '';
    var strToSign = ts + method + endpoint + (method==='GET' && params ? '?'+new URLSearchParams(params) : '') + bodyStr;
    var sig = await hmacSha256(keys.secret, strToSign);
    var ppSig = await hmacSha256(keys.secret, keys.passphrase||'');
    var url = (excOverride || activeExc()).baseUrl + endpoint + (method==='GET' && params ? '?'+new URLSearchParams(params) : '');
    var res = await __NX._nxSignedFetch(url, {
      method: method,
      headers: {
        'KC-API-KEY': keys.apiKey,
        'KC-API-SIGN': btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', new TextEncoder().encode(keys.secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']), new TextEncoder().encode(strToSign))))),
        'KC-API-TIMESTAMP': ts,
        'KC-API-PASSPHRASE': btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', new TextEncoder().encode(keys.secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']), new TextEncoder().encode(keys.passphrase||''))))),
        'KC-API-KEY-VERSION': '2',
        'Content-Type': 'application/json'
      },
      body: bodyStr || undefined
    });
    return res.json();
  }

  // KuCoin's REST API needs symbols as 'BTC-USDT', but everywhere else in
  // this app (market lists, activePair, order book) uses the Binance-style
  // 'BTCUSDT' with no separator — this converts on the way out.
  function toKucoinSymbol(symbol) {
    var quote = symbol.replace(/^.*?(USDT|BTC|ETH)$/, '$1');
    var base = symbol.replace(new RegExp(quote + '$'), '');
    return base + '-' + quote;
  }

  // ── Bybit signed request ──
  // V5 signing differs by method: GET signs+sends the query string, POST
  // signs+sends a JSON body. The previous version always built a query
  // string for the signature and never attached a `body` to the fetch
  // call at all — so every POST (order create, cancel order) went out
  // with no actual payload and a signature Bybit would reject.
  async function bybitFetch(endpoint, params, keys, method, excOverride) {
    method = method || 'GET';
    params = params || {};
    var ts = Date.now().toString();
    var recvWindow = '5000';
    var isGet = method === 'GET';
    var qs = isGet ? Object.keys(params).sort().map(function(k) { return k+'='+params[k]; }).join('&') : '';
    var bodyStr = isGet ? '' : JSON.stringify(params);
    var strToSign = ts + keys.apiKey + recvWindow + (isGet ? qs : bodyStr);
    var sig = await hmacSha256(keys.secret, strToSign);
    var url = (excOverride || activeExc()).baseUrl + endpoint + (isGet && qs ? '?' + qs : '');
    var res = await __NX._nxSignedFetch(url, {
      method: method,
      headers: {
        'X-BAPI-API-KEY': keys.apiKey,
        'X-BAPI-SIGN': sig,
        'X-BAPI-TIMESTAMP': ts,
        'X-BAPI-RECV-WINDOW': recvWindow,
        'Content-Type': 'application/json'
      },
      body: isGet ? undefined : bodyStr
    });
    return res.json();
  }

  // ── Extra crypto helpers (for the 13 additional exchanges below) ──
  async function hmacSha256B64(secret, message) {
    var enc = new TextEncoder();
    var key = await crypto.subtle.importKey('raw', enc.encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
    var sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
    return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(sig))));
  }
  async function hmacSha256B64RawSecret(secretB64, message) {
    // secret is itself base64 (Coinbase) — decode it to raw bytes first
    var raw = Uint8Array.from(atob(secretB64), function(c) { return c.charCodeAt(0); });
    var key = await crypto.subtle.importKey('raw', raw, {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
    var sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
    return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(sig))));
  }
  async function hmacSha512Hex(secret, message) {
    var enc = new TextEncoder();
    var key = await crypto.subtle.importKey('raw', enc.encode(secret), {name:'HMAC',hash:'SHA-512'}, false, ['sign']);
    var sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
    return Array.from(new Uint8Array(sig)).map(function(b) { return b.toString(16).padStart(2,'0'); }).join('');
  }
  async function hmacSha512B64RawSecret(secretB64, path_) {
    var raw = Uint8Array.from(atob(secretB64), function(c) { return c.charCodeAt(0); });
    var key = await crypto.subtle.importKey('raw', raw, {name:'HMAC',hash:'SHA-512'}, false, ['sign']);
    var sig = await crypto.subtle.sign('HMAC', key, path_);
    return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(sig))));
  }
  async function hmacSha384Hex(secret, message) {
    var enc = new TextEncoder();
    var key = await crypto.subtle.importKey('raw', enc.encode(secret), {name:'HMAC',hash:'SHA-384'}, false, ['sign']);
    var sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
    return Array.from(new Uint8Array(sig)).map(function(b) { return b.toString(16).padStart(2,'0'); }).join('');
  }
  async function sha256DigestBytes(message) {
    var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message));
    return new Uint8Array(buf);
  }
  async function sha512Hex(message) {
    var buf = await crypto.subtle.digest('SHA-512', new TextEncoder().encode(message));
    return Array.from(new Uint8Array(buf)).map(function(b) { return b.toString(16).padStart(2,'0'); }).join('');
  }
  // Minimal MD5 (needed only for LBank's signing scheme — WebCrypto has no MD5)
  function md5Hex(str) {
    function rl(n,c){return (n<<c)|(n>>>(32-c));}
    function addU(x,y){var l=(x&0xFFFF)+(y&0xFFFF);var m=(x>>16)+(y>>16)+(l>>16);return (m<<16)|(l&0xFFFF);}
    function cmn(q,a,b,x,s,t){return addU(rl(addU(addU(a,q),addU(x,t)),s),b);}
    function ff(a,b,c,d,x,s,t){return cmn((b&c)|((~b)&d),a,b,x,s,t);}
    function gg(a,b,c,d,x,s,t){return cmn((b&d)|(c&(~d)),a,b,x,s,t);}
    function hh(a,b,c,d,x,s,t){return cmn(b^c^d,a,b,x,s,t);}
    function ii(a,b,c,d,x,s,t){return cmn(c^(b|(~d)),a,b,x,s,t);}
    function toWords(str){
      var bytes = new TextEncoder().encode(str);
      var n = bytes.length;
      var nblk = ((n + 8) >> 6) + 1;
      var blks = new Array(nblk * 16).fill(0);
      for (var i=0;i<n;i++) blks[i>>2] |= bytes[i] << ((i%4)*8);
      blks[n>>2] |= 0x80 << ((n%4)*8);
      blks[nblk*16-2] = n*8;
      return blks;
    }
    var x = toWords(str);
    var a=1732584193,b=-271733879,c=-1732584194,d=271733878;
    for (var i=0;i<x.length;i+=16){
      var oa=a,ob=b,oc=c,od=d;
      a=ff(a,b,c,d,x[i+0],7,-680876936); d=ff(d,a,b,c,x[i+1],12,-389564586); c=ff(c,d,a,b,x[i+2],17,606105819); b=ff(b,c,d,a,x[i+3],22,-1044525330);
      a=ff(a,b,c,d,x[i+4],7,-176418897); d=ff(d,a,b,c,x[i+5],12,1200080426); c=ff(c,d,a,b,x[i+6],17,-1473231341); b=ff(b,c,d,a,x[i+7],22,-45705983);
      a=ff(a,b,c,d,x[i+8],7,1770035416); d=ff(d,a,b,c,x[i+9],12,-1958414417); c=ff(c,d,a,b,x[i+10],17,-42063); b=ff(b,c,d,a,x[i+11],22,-1990404162);
      a=ff(a,b,c,d,x[i+12],7,1804603682); d=ff(d,a,b,c,x[i+13],12,-40341101); c=ff(c,d,a,b,x[i+14],17,-1502002290); b=ff(b,c,d,a,x[i+15],22,1236535329);
      a=gg(a,b,c,d,x[i+1],5,-165796510); d=gg(d,a,b,c,x[i+6],9,-1069501632); c=gg(c,d,a,b,x[i+11],14,643717713); b=gg(b,c,d,a,x[i+0],20,-373897302);
      a=gg(a,b,c,d,x[i+5],5,-701558691); d=gg(d,a,b,c,x[i+10],9,38016083); c=gg(c,d,a,b,x[i+15],14,-660478335); b=gg(b,c,d,a,x[i+4],20,-405537848);
      a=gg(a,b,c,d,x[i+9],5,568446438); d=gg(d,a,b,c,x[i+14],9,-1019803690); c=gg(c,d,a,b,x[i+3],14,-187363961); b=gg(b,c,d,a,x[i+8],20,1163531501);
      a=gg(a,b,c,d,x[i+13],5,-1444681467); d=gg(d,a,b,c,x[i+2],9,-51403784); c=gg(c,d,a,b,x[i+7],14,1735328473); b=gg(b,c,d,a,x[i+12],20,-1926607734);
      a=hh(a,b,c,d,x[i+5],4,-378558); d=hh(d,a,b,c,x[i+8],11,-2022574463); c=hh(c,d,a,b,x[i+11],16,1839030562); b=hh(b,c,d,a,x[i+14],23,-35309556);
      a=hh(a,b,c,d,x[i+1],4,-1530992060); d=hh(d,a,b,c,x[i+4],11,1272893353); c=hh(c,d,a,b,x[i+7],16,-155497632); b=hh(b,c,d,a,x[i+10],23,-1094730640);
      a=hh(a,b,c,d,x[i+13],4,681279174); d=hh(d,a,b,c,x[i+0],11,-358537222); c=hh(c,d,a,b,x[i+3],16,-722521979); b=hh(b,c,d,a,x[i+6],23,76029189);
      a=hh(a,b,c,d,x[i+9],4,-640364487); d=hh(d,a,b,c,x[i+12],11,-421815835); c=hh(c,d,a,b,x[i+15],16,530742520); b=hh(b,c,d,a,x[i+2],23,-995338651);
      a=ii(a,b,c,d,x[i+0],6,-198630844); d=ii(d,a,b,c,x[i+7],10,1126891415); c=ii(c,d,a,b,x[i+14],15,-1416354905); b=ii(b,c,d,a,x[i+5],21,-57434055);
      a=ii(a,b,c,d,x[i+12],6,1700485571); d=ii(d,a,b,c,x[i+3],10,-1894986606); c=ii(c,d,a,b,x[i+10],15,-1051523); b=ii(b,c,d,a,x[i+1],21,-2054922799);
      a=ii(a,b,c,d,x[i+8],6,1873313359); d=ii(d,a,b,c,x[i+15],10,-30611744); c=ii(c,d,a,b,x[i+6],15,-1560198380); b=ii(b,c,d,a,x[i+13],21,1309151649);
      a=ii(a,b,c,d,x[i+4],6,-145523070); d=ii(d,a,b,c,x[i+11],10,-1120210379); c=ii(c,d,a,b,x[i+2],15,718787259); b=ii(b,c,d,a,x[i+9],21,-343485551);
      a=addU(a,oa); b=addU(b,ob); c=addU(c,oc); d=addU(d,od);
    }
    function toHexLE(n){
      var s='';
      for (var j=0;j<4;j++) s += ((n>>(j*8))&0xFF).toString(16).padStart(2,'0');
      return s;
    }
    return (toHexLE(a)+toHexLE(b)+toHexLE(c)+toHexLE(d));
  }

  // ── Generic symbol converters for the 13 additional exchanges ──
  function splitSymbol(symbol) {
    var quote = symbol.replace(/^.*?(USDT|USDC|BTC|ETH|USD)$/, '$1');
    var base = symbol.replace(new RegExp(quote + '$'), '');
    return {base: base, quote: quote};
  }
  function toUnderscoreSymbol(symbol) { var p = splitSymbol(symbol); return p.base + '_' + p.quote; }
  function toDashSymbol(symbol) { var p = splitSymbol(symbol); return p.base + '-' + p.quote; }
  function toLowerUnderscoreSymbol(symbol) { var p = splitSymbol(symbol); return (p.base + '_' + p.quote).toLowerCase(); }
  function toKrakenPair(symbol) { var p = splitSymbol(symbol); var base = p.base === 'BTC' ? 'XBT' : p.base; return base + p.quote; }
  function toBitfinexSymbol(symbol) { var p = splitSymbol(symbol); var quote = p.quote === 'USDT' ? 'UST' : p.quote; return 't' + p.base + quote; }
  function fromUnderscoreSymbol(s) { return (s||'').replace('_','').toUpperCase(); }
  function fromDashSymbol(s) { return (s||'').replace('-','').toUpperCase(); }
})((window.__nxp = window.__nxp || {}).mod_exc_spot_engine = window.__nxp.mod_exc_spot_engine || {});
