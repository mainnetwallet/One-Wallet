
// ════════════════════════════════════════════════════════════
// ONE WEB3 BRIDGE — Main handler
// ════════════════════════════════════════════════════════════

'use strict';

// ── Ethers v5/v6 compatibility shims ───────────────────────
// ethers v6 removed BigNumber, utils, constants — shim them back
(function() {
  if (!ethers) return;
  // BigNumber
  if (!ethers.BigNumber) {
    ethers.BigNumber = { from: function(v) { return BigInt(v); } };
  }
  // utils.arrayify
  if (!ethers.utils) ethers.utils = {};
  if (!ethers.utils.arrayify) {
    ethers.utils.arrayify = function(v) {
      if (v instanceof Uint8Array) return v;
      if (typeof v === 'string' && v.startsWith('0x')) {
        var hex = v.slice(2);
        if (hex.length % 2) hex = '0' + hex;
        var arr = new Uint8Array(hex.length / 2);
        for (var i = 0; i < arr.length; i++) arr[i] = parseInt(hex.slice(i*2, i*2+2), 16);
        return arr;
      }
      return new Uint8Array(v);
    };
  }
  if (!ethers.utils.formatEther) {
    ethers.utils.formatEther = function(v) {
      return ethers.formatEther ? ethers.formatEther(v) : (Number(v) / 1e18).toString();
    };
  }
  if (!ethers.utils.parseEther) {
    ethers.utils.parseEther = function(v) {
      return ethers.parseEther ? ethers.parseEther(v) : BigInt(Math.round(parseFloat(v) * 1e18));
    };
  }
  // constants.Zero
  if (!ethers.constants) {
    ethers.constants = { Zero: BigInt(0), MaxUint256: BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff') };
  }
})();

// ── State ──────────────────────────────────────────────────
var _w3mCurrentReq  = null;  // { reqId, method, params, onApprove, onReject }
var _w3mQueue       = [];    // pending requests (queue for concurrent)
var _w3mOpen        = false;

// ── Icons per DEX site ──
var SITE_ICONS = {
  'uniswap.org':   '🦄', 'app.uniswap.org': '🦄',
  'curve.fi':      '🔵', 'aave.com':        '👻',
  'compound.finance': '🏦', 'sushi.com':    '🍣',
  'dydx.exchange': '📊', 'gmx.io':         '📈',
  '1inch.io':      '🦩', 'pancakeswap.finance': '🥞',
  'raydium.io':    '⚡', 'orca.so':        '🐳',
  'balancer.fi':   '⚖️', 'lido.fi':        '🧪',
  'yearn.finance': '🌀', 'convexfinance.com': '🔷',
};

function _getSiteIcon(host) {
  for (var k in SITE_ICONS) {
    if (host && host.indexOf(k) !== -1) return SITE_ICONS[k];
  }
  return '🌐';
}

// ── Helper: get private key for address ───────────────────
// _oneBrowserSelectedAddress: set when user picks a wallet in the in-app browser drawer
// This ensures signing/tx always uses the wallet the user explicitly connected to the dApp
window._oneBrowserSelectedAddress = window._oneBrowserSelectedAddress || null;

// ── W3M inline styles — prepended to all bodyHtml injected into dApp WebView ──
// dApp WebView has no access to main WebView CSS, so we inline everything
var _W3M_BODY_STYLES = '<style>' +
  '.w3m-section-title{font-size:10px;font-weight:700;color:#4b5563;letter-spacing:1.5px;margin-bottom:8px;font-family:monospace;}' +
  '.w3m-address-box,.w3m-data-box{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:10px 14px;margin-bottom:10px;font-family:monospace;font-size:11px;color:#9ca3af;word-break:break-all;line-height:1.6;}' +
  '.w3m-data-box{max-height:120px;overflow-y:auto;font-size:10px;color:#6b7280;}' +
  '.w3m-tx-row{display:flex;justify-content:space-between;align-items:flex-start;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:12px;}' +
  '.w3m-tx-row:last-child{border-bottom:none;}' +
  '.w3m-tx-label{color:#6b7280;font-size:11px;}' +
  '.w3m-tx-value{color:#c4b5fd;font-family:monospace;font-size:11px;text-align:right;max-width:60%;word-break:break-all;}' +
  '.w3m-warn-box{display:flex;gap:8px;align-items:flex-start;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:10px;padding:10px 12px;margin-top:6px;}' +
  '.w3m-warn-icon{font-size:16px;flex-shrink:0;margin-top:1px;}' +
  '.w3m-warn-text{font-size:11px;color:#d97706;line-height:1.5;}' +
  '.w3m-network-badge{display:inline-flex;align-items:center;gap:5px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.2);border-radius:20px;padding:3px 10px;font-size:10px;color:#10b981;font-family:monospace;font-weight:700;letter-spacing:0.5px;margin-bottom:8px;}' +
  '</style>';

