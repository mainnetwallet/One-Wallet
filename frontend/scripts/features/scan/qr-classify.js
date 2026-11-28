// ── QR classifier ─────────────────────────────────────────────
// Turns the raw text of a scanned QR code into ONE of:
//   { type:'address',       address, chainId?, token? }   wallet address (plain, ethereum:, EIP-681)
//   { type:'walletconnect', uri, version }                WalletConnect pairing link (also inside deep links)
//   { type:'url',           url, host }                   website (http/https or a bare domain)
//   { type:'unknown',       reason }                      anything else (never acted on)
// Pure function, no DOM access, so it can be unit-tested in node.
(function (root) {
  'use strict';

  var ADDR_RE  = /^0x[0-9a-fA-F]{40}$/;
  var WC_V2_RE = /^wc:[0-9a-fA-F]{64}@2(?:[?\/].*)?$/i;
  var WC_V1_RE = /^wc:[0-9a-zA-Z-]{8,}@1(?:[?\/].*)?$/i;
  var HOST_RE  = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

  function _safeDecode(s) {
    try { return decodeURIComponent(s); } catch (e) { return s; }
  }

  // Wallet apps and dApps wrap the pairing link: metamask://wc?uri=wc%3A...,
  // https://link.trustwallet.com/wc?uri=..., https://site/?uri=wc:... , one://wc?uri=...
  function _unwrapWc(text) {
    var t = text.trim();
    if (/^wc:/i.test(t)) return t;
    var m = t.match(/[?&](?:uri|wc|walletconnect)=([^&#]+)/i);
    if (m) {
      var v = _safeDecode(m[1]);
      if (/^wc:/i.test(v)) return v;
      v = _safeDecode(v);
      if (/^wc:/i.test(v)) return v;
    }
    // wc:// prefix used by a few dApps: wc://wc:abc@2?... or wc://abc@2?...
    var m2 = t.match(/^wc:\/\/(wc:)?(.+)$/i);
    if (m2) return 'wc:' + m2[2];
    return null;
  }

  function _parseAddress(text) {
    var t = text.trim();
    if (ADDR_RE.test(t)) return { type: 'address', address: t };
    // EIP-681: ethereum:[pay-]<addr>[@chainId][/function][?params]
    var m = t.match(/^(?:ethereum|eth):(?:pay-)?(0x[0-9a-fA-F]{40})(?:@(\d+))?(?:\/([a-zA-Z0-9_]+))?(?:\?(.*))?$/i);
    if (!m) return null;
    var res = { type: 'address', address: m[1] };
    if (m[2]) res.chainId = parseInt(m[2], 10);
    if (m[3] && m[3].toLowerCase() === 'transfer' && m[4]) {
      // token transfer: m[1] is the token contract, the recipient is the ?address= param
      var pm = m[4].match(/(?:^|&)address=(0x[0-9a-fA-F]{40})(?:&|$)/i);
      if (pm) { res.token = m[1]; res.address = pm[1]; }
    }
    return res;
  }

  function _parseUrl(text) {
    var t = text.trim();
    if (/\s/.test(t)) return null;
    var full = null;
    if (/^https?:\/\//i.test(t)) {
      full = t;
    } else if (/^(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?::\d{2,5})?(?:[\/?#].*)?$/i.test(t) && !/^[a-z][a-z0-9+.-]*:/i.test(t)) {
      full = 'https://' + t;
    }
    if (!full) return null;
    var u;
    try { u = new URL(full); } catch (e) { return null; }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (u.username || u.password) return null; // user:pass@host is a classic spoofing trick
    var host = u.hostname.toLowerCase();
    if (host !== 'localhost' && !HOST_RE.test(host) && !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return null;
    return { type: 'url', url: u.href, host: host.replace(/^www\./, '') };
  }

  function qrClassify(raw) {
    if (raw == null) return { type: 'unknown', reason: 'empty' };
    var text = String(raw).replace(/^[\s"'`]+|[\s"'`]+$/g, '');
    if (!text) return { type: 'unknown', reason: 'empty' };
    if (text.length > 4096) return { type: 'unknown', reason: 'too-long' };

    // 1. WalletConnect (before URL, because deep links look like URLs)
    var wc = _unwrapWc(text);
    if (wc) {
      if (WC_V2_RE.test(wc)) return { type: 'walletconnect', uri: wc, version: 2 };
      if (WC_V1_RE.test(wc)) return { type: 'walletconnect', uri: wc, version: 1 };
      return { type: 'unknown', reason: 'bad-walletconnect' };
    }

    // 2. Wallet address
    var a = _parseAddress(text);
    if (a) return a;
    if (/^0x[0-9a-fA-F]{20,}/.test(text)) return { type: 'unknown', reason: 'bad-address' };

    // 3. Website
    var u = _parseUrl(text);
    if (u) return u;

    return { type: 'unknown', reason: 'unsupported' };
  }

  root.qrClassify = qrClassify;
  if (typeof module !== 'undefined' && module.exports) module.exports = { qrClassify: qrClassify };
})(typeof window !== 'undefined' ? window : globalThis);
