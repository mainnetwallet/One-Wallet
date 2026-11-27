
// ══════════════════════════════════════════════════════
// ONE SECURE STORAGE — AES-GCM PIN-based Encryption
// Private keys are encrypted with the secret set via setSecret() (the app lock's master secret).
// With no secret set, encrypt() fails — it never falls back to returning plaintext.
// Keys live in memory only after unlock.
// ══════════════════════════════════════════════════════
// OneCrypto v4 — AES-256-GCM + PBKDF2
// ──────────────────────────────────────────────────────
// Storage format: "ncx4:<b64(iv12)>.<b64(ciphertext)>"
// Legacy ncx3/nsx2/ncx1 → decrypted on read, re-saved as ncx4 automatically.
// XOR completely removed. All encryption is AES-GCM.
// Sync API (encodeKey/decodeKey) removed — use async encrypt/decrypt.
// ══════════════════════════════════════════════════════
const OneCrypto = (function() {
  'use strict';

  var _unlockSecret  = null;  // 'pin:1234' | 'pat:0,1,4' | 'bio:...' | null
  var _keyCache      = null;  // Promise<CryptoKey>
  var _plaintextCache = null; // Array of groups with plain keys, or null

  var SALT = 'one-wallet-salt-v4';

  // ── PBKDF2 → AES-256-GCM key ──
  function _deriveKey(secret, salt) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveKey'])
      .then(function(km) {
        return crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: enc.encode(salt), iterations: 200000, hash: 'SHA-256' },
          km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
        );
      });
  }

  function _getKey() {
    if (!_unlockSecret) return Promise.reject(new Error('PIN_REQUIRED'));
    if (!_keyCache) _keyCache = _deriveKey(_unlockSecret, SALT);
    return _keyCache;
  }

  // ── AES-GCM encrypt → "ncx4:<iv_b64>.<ct_b64>" ──
  async function encrypt(plain) {
    if (!plain || typeof plain !== 'string') return plain;
    if (plain.startsWith('ncx4:')) return plain; // already encrypted
    // Throws (PIN_REQUIRED / WebCrypto error) when it cannot encrypt, so callers never
    // persist plaintext by accident (BUG-004). Callers must handle the rejection.
    var enc = new TextEncoder();
    var iv  = crypto.getRandomValues(new Uint8Array(12));
    var key = await _getKey();
    var ct  = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, enc.encode(plain));
    var b64 = function(u8) { return btoa(String.fromCharCode.apply(null, new Uint8Array(u8))); };
    return 'ncx4:' + b64(iv) + '.' + b64(ct);
  }

  // ── AES-GCM decrypt "ncx4:..." → plain ──
  async function decrypt(stored) {
    if (!stored || typeof stored !== 'string') return null;
    if (!stored.startsWith('ncx4:')) {
      // Legacy migration: ncx3/nsx2 XOR decode, ncx1 skip, plain pass-through
      return _migrateLegacy(stored);
    }
    try {
      var parts = stored.slice(5).split('.');
      if (parts.length !== 2) return null;
      var u8  = function(b) { return Uint8Array.from(atob(b), function(c){ return c.charCodeAt(0); }); };
      var iv  = u8(parts[0]);
      var ct  = u8(parts[1]);
      var key = await _getKey();
      var pt  = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, ct);
      return new TextDecoder().decode(pt);
    } catch(e) { return null; }
  }

  // ── Legacy XOR migration (read-only, never written) ──
  function _xorDecodeWith(stored, secret) {
    try {
      var prefix = stored.startsWith('ncx3:') || stored.startsWith('nsx2:') ? 5 : 0;
      var h = 0x811c9dc5;
      for (var i = 0; i < secret.length; i++) { h ^= secret.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
      var pad = new Uint8Array(64), v = h;
      for (var j = 0; j < 64; j++) {
        v ^= (v << 13) >>> 0; v ^= v >>> 7; v ^= (v << 17) >>> 0; v = v >>> 0;
        pad[j] = v & 0xff;
      }
      var raw = Uint8Array.from(atob(stored.slice(prefix)), function(c){ return c.charCodeAt(0); });
      var out = new Uint8Array(raw.length);
      for (var k = 0; k < raw.length; k++) out[k] = raw[k] ^ pad[k % pad.length];
      return new TextDecoder().decode(out);
    } catch(e) { return null; }
  }

  function _migrateLegacy(stored) {
    if (stored.startsWith('ncx3:')) return _unlockSecret ? _xorDecodeWith(stored, _unlockSecret) : null;
    if (stored.startsWith('nsx2:')) return null; // nsx2 used device secret — no longer recoverable without PIN
    if (stored.startsWith('ncx1:')) return null; // unrecoverable old async format
    return stored; // plain text (very old)
  }

  // ── Public: set/clear secret ──
  function setSecret(secret) {
    if (_unlockSecret === secret) return;
    _unlockSecret = secret;
    _keyCache = null;
  }

  function clearSecret() {
    _unlockSecret = null;
    _keyCache = null;
  }

  function hasSecret() { return !!_unlockSecret; }

  // ── Plaintext cache (used by sync loadWalletGroups) ──
  function setPlaintextCache(groups) {
    _plaintextCache = groups ? JSON.parse(JSON.stringify(groups)) : null;
  }
  function getPlaintextCache() {
    return _plaintextCache ? JSON.parse(JSON.stringify(_plaintextCache)) : null;
  }
  function clearPlaintextCache() {
    _plaintextCache = null;
  }

  // ── Async group encrypt/decrypt ──
  async function encryptGroups(groups) {
    if (!Array.isArray(groups)) return groups;
    var result = [];
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      if (!g || !Array.isArray(g.keys)) { result.push(g); continue; }
      var encKeys = [];
      for (var j = 0; j < g.keys.length; j++) {
        if (g.keys[j]) encKeys.push(await encrypt(g.keys[j]));
      }
      result.push(Object.assign({}, g, { keys: encKeys }));
    }
    return result;
  }

  async function decryptGroups(groups) {
    if (!Array.isArray(groups)) return groups;
    var result = [];
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      if (!g || !Array.isArray(g.keys)) { result.push(g); continue; }
      var plainKeys = [];
      var anyDecryptFailed = false;
      for (var j = 0; j < g.keys.length; j++) {
        var plain = await decrypt(g.keys[j]);
        if (plain) { plainKeys.push(plain); } else { anyDecryptFailed = true; }
      }
      // ── FIX: If ALL keys failed to decrypt, it means secret not yet set (race condition).
      // Return the group with 0 keys so callers can detect and retry rather than silently drop.
      // If SOME keys decrypted, push what we have (partial migration edge case).
      result.push(Object.assign({}, g, { keys: plainKeys, _decryptFailed: anyDecryptFailed && plainKeys.length === 0 }));
    }
    return result;
  }

  // ── Kept for compat — both delegate to async ──
  function encodeGroups(groups) { return encryptGroups(groups); }
  function decodeGroups(groups) { return decryptGroups(groups); }
  // encodeKey/decodeKey removed — use encrypt/decrypt
  function encodeKey(k) { return encrypt(k); }  // returns Promise
  function decodeKey(k) { return decrypt(k); }  // returns Promise

  return {
    setSecret:           setSecret,
    clearSecret:         clearSecret,
    hasSecret:           hasSecret,
    setPlaintextCache:   setPlaintextCache,
    getPlaintextCache:   getPlaintextCache,
    clearPlaintextCache: clearPlaintextCache,
    encrypt:             encrypt,
    decrypt:             decrypt,
    encodeKey:           encodeKey,
    decodeKey:           decodeKey,
    encryptGroups:       encryptGroups,
    decryptGroups:       decryptGroups,
    encodeGroups:        encodeGroups,
    decodeGroups:        decodeGroups,
  };
})();

