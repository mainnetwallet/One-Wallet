
(function(){
  // HTML sanitizer — token name/symbol থেকে XSS prevent করে
  window.oneSanitize = function(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  // Image URL allow-list for <img src>: http(s) or data:image/* only, '' otherwise.
  // Always pass the result through oneSanitize() before putting it in an attribute.
  window.oneSafeImgUrl = function(u) {
    if (u == null) return '';
    var s = String(u).trim();
    return /^(https?:\/\/|data:image\/(png|jpe?g|gif|webp|avif|svg\+xml)[;,])/i.test(s) ? s : '';
  };

  // Plain-text field from an untrusted source (on-chain name()/symbol(), third-party APIs, dApps).
  // Token/chain text is interpolated into innerHTML and into onclick="..." attributes all over the UI,
  // so the stored value itself must carry no markup, quote, entity or backslash characters.
  window.oneCleanText = function(v, max, fallback) {
    var t = String(v == null ? '' : v)
      .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029<>"'`&\\]/g, '')
      .trim().slice(0, max || 64);
    return t || (fallback == null ? '' : fallback);
  };

  // Makes a saved-token record safe to render: text fields stripped, URLs limited to http(s)/data:image,
  // ids / colours / contract in their expected shape. Other properties are kept as they are.
  window.oneCleanToken = function(t) {
    if (!t || typeof t !== 'object') return t;
    var o = Object.assign({}, t);
    ['name', 'sub', 'symbol', 'icon'].forEach(function(k) {
      if (k in o && o[k] != null) o[k] = window.oneCleanText(o[k], 64, '');
    });
    ['id', 'cgId'].forEach(function(k) {
      if (k in o && o[k] != null) o[k] = String(o[k]).replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 80);
    });
    ['color', 'badge'].forEach(function(k) {
      if (k in o && o[k] != null && !/^#[0-9a-fA-F]{3,8}$/.test(String(o[k]))) o[k] = '#6366f1';
    });
    ['thumb', 'logo', 'logoURI', 'image'].forEach(function(k) {
      if (k in o && o[k] != null) {
        var u = window.oneSafeImgUrl(o[k]);
        o[k] = (u && !/[\s"'<>`\\]/.test(u)) ? u : '';
      }
    });
    if ('contract' in o && o.contract != null && o.contract !== '' && !/^0x[0-9a-fA-F]{40}$/.test(String(o.contract))) o.contract = '';
    return o;
  };

  // A coin row from a third-party search API (CoinGecko /search, DexScreener, CMC) before it is rendered
  // into the "add token" results list. Names/symbols/ids/thumbs there are attacker-controllable (anyone
  // can list a token called  <img src=x onerror=...>), and they go into innerHTML, attribute values and
  // querySelector strings, so every field is reduced to a plain, quote-free shape here.
  window.oneCleanCoin = function(c) {
    if (!c || typeof c !== 'object') return null;
    var o = window.oneCleanToken(c);
    var id = String(o.id == null ? '' : o.id).replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 120);
    if (!id) return null;
    o.id = id;
    o.name = window.oneCleanText(c.name, 64, '') || window.oneCleanText(c.symbol, 24, '?');
    o.symbol = window.oneCleanText(c.symbol, 24, '').toUpperCase();
    var rank = Number(c.market_cap_rank);
    o.market_cap_rank = (isFinite(rank) && rank > 0 && rank < 1e7) ? Math.floor(rank) : null;
    o._source = window.oneCleanText(c._source, 32, '');
    o._cmcSlug = String(c._cmcSlug == null ? '' : c._cmcSlug).replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 80);
    var cmcId = Number(c._cmcId);
    o._cmcId = (isFinite(cmcId) && cmcId > 0) ? Math.floor(cmcId) : null;
    return o;
  };

  // One entry of the public chainid.network / ChainList JSON, reduced to the fields the wallet uses, each
  // in a safe shape (plain text names, https/http URLs without quote/markup characters, a bare icon id).
  // Returns null for an entry that has no usable chainId or name. Chain names and symbols from that list
  // are interpolated into innerHTML and into the custom chain that gets saved, so they must carry no markup.
  window.oneCleanChainlistEntry = function(c) {
    if (!c || typeof c !== 'object') return null;
    var id = Number(c.chainId);
    if (!isFinite(id) || id <= 0 || id > 2147483647 || Math.floor(id) !== id) return null;
    var name = window.oneCleanText(c.name, 64, '');
    if (!name) return null;
    var urlOk = function(u) {
      return typeof u === 'string' && u.length < 300 && /^https?:\/\//i.test(u) && !/[\s"'<>`\\]/.test(u);
    };
    var nc = (c.nativeCurrency && typeof c.nativeCurrency === 'object') ? c.nativeCurrency : {};
    var dec = Number(nc.decimals);
    var sym = window.oneCleanText(nc.symbol, 16, '') || 'ETH';
    return {
      chainId: id,
      name: name,
      shortName: window.oneCleanText(c.shortName, 32, ''),
      nativeCurrency: {
        name: window.oneCleanText(nc.name, 64, '') || sym,
        symbol: sym,
        decimals: (isFinite(dec) && dec >= 0 && dec <= 36) ? Math.floor(dec) : 18
      },
      rpc: (Array.isArray(c.rpc) ? c.rpc : []).filter(urlOk),
      icon: /^[A-Za-z0-9_-]{1,64}$/.test(String(c.icon == null ? '' : c.icon)) ? String(c.icon) : '',
      explorers: (Array.isArray(c.explorers) ? c.explorers : []).map(function(e) {
        return { name: window.oneCleanText(e && e.name, 64, ''), url: urlOk(e && e.url) ? e.url : '' };
      }).filter(function(e) { return e.url; })
    };
  };

  // ── Price identity ──────────────────────────────────────────────────────────────────────────
  // A token's symbol is only text the token contract returns about itself. Pricing an unverified
  // contract token by its ticker (Coinbase "ETH-USD", CoinGecko/DexScreener symbol search, the
  // symbol-keyed price cache, "USDC" => $1) lets a scam token named "ETH" show real ETH's price.
  // Symbol-based price lookups are therefore allowed only for:
  //   - chain native coins (no contract),
  //   - the built-in default tokens,
  //   - tokens that carry a CoinGecko id (matched by CoinGecko itself, priced by id not ticker).
  // Every other contract token is priced by its CONTRACT ADDRESS on its OWN chain (oneDexPickPair).
  window.oneSymbolPriceAllowed = function(t) {
    if (!t || typeof t !== 'object') return false;
    if (t.isDefault || t.isNative) return true;
    var c = t.contract || t.address;
    if (!c || /^0x0*$/.test(String(c))) return true;
    return !!t.cgId;
  };

  // DexScreener chain slugs by EVM chainId. Unknown chain => no pair (we never guess a chain).
  var ONE_DS_CHAIN = { 1: 'ethereum', 10: 'optimism', 56: 'bsc', 137: 'polygon', 324: 'zksync',
                       8453: 'base', 42161: 'arbitrum', 43114: 'avalanche', 59144: 'linea', 534352: 'scroll' };

  // From a DexScreener /tokens/<address> response pick the pair whose BASE token is exactly this
  // contract on exactly this chain (the endpoint returns the address on every chain), deepest liquidity first.
  window.oneDexPickPair = function(pairs, t) {
    var addr = String((t && (t.contract || t.address)) || '').toLowerCase();
    var slug = ONE_DS_CHAIN[Number(t && t.chainId) || 8453];
    if (!addr || !slug || !Array.isArray(pairs)) return null;
    var ok = pairs.filter(function(p) {
      return p && p.chainId === slug && p.baseToken && String(p.baseToken.address || '').toLowerCase() === addr && parseFloat(p.priceUsd) > 0;
    });
    ok.sort(function(a, b) { return ((b.liquidity && b.liquidity.usd) || 0) - ((a.liquidity && a.liquidity.usd) || 0); });
    return ok[0] || null;
  };

  // Fetch with timeout wrapper — default 15s
  window.oneFetch = function(url, options, timeoutMs) {
    timeoutMs = timeoutMs || 15000;
    var controller = new AbortController();
    var timer = setTimeout(function(){ controller.abort(); }, timeoutMs);
    var opts = Object.assign({}, options || {}, { signal: controller.signal });
    return fetch(url, opts).finally(function(){ clearTimeout(timer); });
  };
})();
