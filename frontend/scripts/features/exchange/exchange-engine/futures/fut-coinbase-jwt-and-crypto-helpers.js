// Futures: base64url/DER helpers and Coinbase JWT/portfolio helpers
// Part of the futures engine (FUT) module (split by topic; no logic change).
(function (__NX) {
  __NX._coinbaseBuildJwt = _coinbaseBuildJwt;
  __NX._coinbaseFetchJwt = _coinbaseFetchJwt;
  __NX._coinbaseGetPortfolioUuid = _coinbaseGetPortfolioUuid;


  // ════════════════════════════════════════════════════════════════
  // ── Coinbase CDP JWT (ES256) — Advanced Trade / INTX perpetuals ──
  // auth is entirely separate from the legacy Exchange API HMAC keys
  // used for spot. Per official docs (docs.cdp.coinbase.com →
  // "Coinbase App API Key Authentication"):
  //   header: { alg:'ES256', kid:<key_name>, nonce:<random hex> }
  //   payload: { iss:'cdp', sub:<key_name>, nbf:now, exp:now+120,
  //              uri:'METHOD api.coinbase.com/path' }
  // signed with the EC (P-256) private key, Authorization: Bearer <jwt>.
  // ════════════════════════════════════════════════════════════════

  function _b64urlFromBytes(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function _b64urlFromStr(str) {
    return _b64urlFromBytes(new TextEncoder().encode(str));
  }
  function _randHex(len) {
    var bytes = new Uint8Array(len);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map(function(b){ return b.toString(16).padStart(2,'0'); }).join('');
  }

  // Strip PEM header/footer/whitespace → raw DER bytes
  function _pemToDer(pem) {
    var b64 = pem.replace(/-----BEGIN [^-]+-----/g, '').replace(/-----END [^-]+-----/g, '').replace(/\s+/g, '');
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  // Minimal DER reader — just enough to walk SEC1 ECPrivateKey structure:
  // SEQUENCE { INTEGER version, OCTET STRING privateKey, [0] params (opt), [1] publicKey (opt) }
  function _derReadTLV(bytes, pos) {
    var tag = bytes[pos];
    var lenByte = bytes[pos+1];
    var lenBytes, len;
    if (lenByte < 0x80) { len = lenByte; lenBytes = 1; }
    else {
      var n = lenByte & 0x7f;
      len = 0;
      for (var i = 0; i < n; i++) len = (len << 8) | bytes[pos+2+i];
      lenBytes = 1 + n;
    }
    var valueStart = pos + 1 + lenBytes;
    return { tag: tag, len: len, valueStart: valueStart, nextPos: valueStart + len, tlvStart: pos };
  }

  // DER length encoder (short or long form) — needed because the SEC1→PKCS8
  // re-wrap changes overall lengths, so lengths must be computed, not copied.
  function _derLen(len) {
    if (len < 0x80) return new Uint8Array([len]);
    var bytes = [];
    var n = len;
    while (n > 0) { bytes.unshift(n & 0xff); n = n >>> 8; }
    return new Uint8Array([0x80 | bytes.length].concat(bytes));
  }
  function _concatBytes(arrs) {
    var total = 0;
    for (var i = 0; i < arrs.length; i++) total += arrs[i].length;
    var out = new Uint8Array(total);
    var off = 0;
    for (var i = 0; i < arrs.length; i++) { out.set(arrs[i], off); off += arrs[i].length; }
    return out;
  }

  // Convert a SEC1 "EC PRIVATE KEY" DER blob → PKCS8 DER, preserving the
  // embedded public key (if present) so the structure byte-matches what
  // `openssl pkcs8 -topk8` would produce for the same key — verified against
  // a known-good reference key pair (SEC1 vs PKCS8 export of the same `d`).
  // SEC1 ECPrivateKey ::= SEQUENCE { version INTEGER(1), privateKey OCTET STRING,
  //                                  [0] parameters (optional, ignored — curve is
  //                                  fixed to P-256/NIST P-256 either way),
  //                                  [1] publicKey BIT STRING (optional) }
  // PKCS8 reuses the same inner SEQUENCE shape minus the [0] params (the curve
  // OID lives in PKCS8's own AlgorithmIdentifier instead).
  function _sec1ToPkcs8(der) {
    var outer = _derReadTLV(der, 0); // SEQUENCE
    var pos = outer.valueStart;
    var versionTlv = _derReadTLV(der, pos); // INTEGER version
    pos = versionTlv.nextPos;
    var dTlv = _derReadTLV(der, pos); // OCTET STRING privateKey
    var d = der.slice(dTlv.valueStart, dTlv.nextPos);
    if (d.length !== 32) {
      // Left-pad/truncate to exactly 32 bytes (P-256 scalar size)
      if (d.length > 32) d = d.slice(d.length - 32);
      else { var padded = new Uint8Array(32); padded.set(d, 32 - d.length); d = padded; }
    }
    pos = dTlv.nextPos;

    var pubKeyFullTlv = null; // capture the full [1]-tagged TLV verbatim, if present
    while (pos < outer.nextPos) {
      var ctx = _derReadTLV(der, pos);
      if (ctx.tag === 0xa1) pubKeyFullTlv = der.slice(ctx.tlvStart, ctx.nextPos);
      pos = ctx.nextPos;
    }

    var verPart = new Uint8Array([0x02, 0x01, 0x01]);
    var dPart = _concatBytes([new Uint8Array([0x04, 0x20]), d]);
    var innerBodyParts = [verPart, dPart];
    if (pubKeyFullTlv) innerBodyParts.push(pubKeyFullTlv);
    var innerBody = _concatBytes(innerBodyParts);
    var innerSeq = _concatBytes([new Uint8Array([0x30]), _derLen(innerBody.length), innerBody]);

    // ecPublicKey OID (1.2.840.10045.2.1) + prime256v1/P-256 OID (1.2.840.10045.3.1.7)
    var algId = new Uint8Array([
      0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
      0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07
    ]);
    var verOuter = new Uint8Array([0x02, 0x01, 0x00]);
    var privKeyOctet = _concatBytes([new Uint8Array([0x04]), _derLen(innerSeq.length), innerSeq]);
    var outerBody = _concatBytes([verOuter, algId, privKeyOctet]);
    return _concatBytes([new Uint8Array([0x30]), _derLen(outerBody.length), outerBody]);
  }

  // PEM (SEC1 "EC PRIVATE KEY" or PKCS8 "PRIVATE KEY") → CryptoKey usable for ECDSA P-256 signing.
  var _cbCryptoKeyCache = {}; // pem string → CryptoKey (avoid re-deriving every call)
  async function _coinbaseImportPemKey(pem) {
    if (_cbCryptoKeyCache[pem]) return _cbCryptoKeyCache[pem];
    var der = _pemToDer(pem);
    var pkcs8 = (pem.indexOf('BEGIN EC PRIVATE KEY') !== -1) ? _sec1ToPkcs8(der) : der;
    var key = await crypto.subtle.importKey(
      'pkcs8', pkcs8, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']
    );
    _cbCryptoKeyCache[pem] = key;
    return key;
  }

  // Build a CDP-signed ES256 JWT for one REST call.
  // keys = { cdpKeyName, cdpPem } (see API key modal's Coinbase-only CDP fields)
  async function _coinbaseBuildJwt(keys, method, host, path) {
    if (!keys || !keys.cdpKeyName || !keys.cdpPem) {
      throw new Error('Coinbase Futures requires a CDP API key — add it in the API key screen (CDP KEY NAME / CDP PRIVATE KEY fields)');
    }
    var cryptoKey = await _coinbaseImportPemKey(keys.cdpPem);
    var now = Math.floor(Date.now() / 1000);
    var header = { alg: 'ES256', kid: keys.cdpKeyName, nonce: _randHex(16), typ: 'JWT' };
    var payload = { iss: 'cdp', sub: keys.cdpKeyName, nbf: now, exp: now + 120, uri: method + ' ' + host + path };
    var signingInput = _b64urlFromStr(JSON.stringify(header)) + '.' + _b64urlFromStr(JSON.stringify(payload));
    var sigBuf = await crypto.subtle.sign(
      { name: 'ECDSA', hash: { name: 'SHA-256' } }, cryptoKey, new TextEncoder().encode(signingInput)
    );
    // WebCrypto ECDSA signatures are raw (r||s) — exactly the format JWS ES256 expects (no DER re-encoding needed).
    return signingInput + '.' + _b64urlFromBytes(new Uint8Array(sigBuf));
  }

  // Signed fetch against api.coinbase.com (Advanced Trade) using a fresh JWT per call.
  async function _coinbaseFetchJwt(method, path, keys, body) {
    var jwt = await _coinbaseBuildJwt(keys, method, 'api.coinbase.com', path);
    var res = await _nxSignedFetch('https://api.coinbase.com' + path, {
      method: method,
      headers: { 'Authorization': 'Bearer ' + jwt, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      ms: 15000
    });
    return res.json();
  }

  // Discover the INTX portfolio_uuid for this CDP key (GET /portfolios?portfolio_type=INTX),
  // cached per key name since it's effectively static for a given account.
  var _cbPortfolioUuidCache = {};
  async function _coinbaseGetPortfolioUuid(keys) {
    if (_cbPortfolioUuidCache[keys.cdpKeyName]) return _cbPortfolioUuidCache[keys.cdpKeyName];
    var d = await _coinbaseFetchJwt('GET', '/api/v3/brokerage/portfolios?portfolio_type=INTX', keys);
    var list = (d && d.portfolios) || [];
    if (!list.length) throw new Error('No INTX (Perpetuals) portfolio found on this Coinbase account — enable Perpetuals trading first.');
    var uuid = list[0].uuid;
    _cbPortfolioUuidCache[keys.cdpKeyName] = uuid;
    return uuid;
  }
})((window.__nxp = window.__nxp || {}).mod_fut_futures_engine = window.__nxp.mod_fut_futures_engine || {});
