
// ══════════════════════════════════════════════════════════
//  ONE — CUSTOM RPC MANAGER
// ══════════════════════════════════════════════════════════

const _RPC_STORE_KEY = 'one_custom_rpcs_v1';
let _rpcDrawerChainId = null; // which chain is open in detail view

// ── Storage ──
function _rpcLoad() {
  try { return JSON.parse(localStorage.getItem(_RPC_STORE_KEY)) || {}; } catch { return {}; }
}
function _rpcSave(data) {
  try { localStorage.setItem(_RPC_STORE_KEY, JSON.stringify(data)); } catch {}
}

// ── Get custom RPCs for a chain ──
function _rpcGetCustom(chainId) {
  const data = _rpcLoad();
  return data[chainId] || { rpcs: [], defaultRpc: null };
}

// ── Get default RPC for a chain (custom default → first custom → first builtin) ──
function getDefaultRpcForChain(chainId) {
  const store = _rpcGetCustom(chainId);
  if (store.defaultRpc) return store.defaultRpc;
  if (store.rpcs && store.rpcs.length > 0) return store.rpcs[0];
  // Fall back to builtin
  const chain = (typeof getAllChains === 'function' ? getAllChains() : []).find(c => c.chainId === chainId);
  return (chain && chain.rpcs && chain.rpcs[0]) || null;
}

// ── Patch getChainRpcs to put custom default first ──
(function _patchGetChainRpcs() {
  function _apply() {
    try {
      // getChainRpcs is a function declaration — access via window or direct ref
      var fn = window.getChainRpcs || (typeof getChainRpcs === 'function' ? getChainRpcs : null);
      if (!fn || fn.__rpcPatched) return;
      function patched(chainId) {
        var custom = _rpcGetCustom(chainId);
        var origRpcs = fn(chainId) || [];
        if (!custom.rpcs || custom.rpcs.length === 0) {
          if (custom.defaultRpc && origRpcs.indexOf(custom.defaultRpc) !== -1) {
            return [custom.defaultRpc].concat(origRpcs.filter(function(r){ return r !== custom.defaultRpc; }));
          }
          return origRpcs;
        }
        var allCustom = custom.defaultRpc
          ? [custom.defaultRpc].concat(custom.rpcs.filter(function(r){ return r !== custom.defaultRpc; }))
          : custom.rpcs;
        var builtinOnly = origRpcs.filter(function(r){ return allCustom.indexOf(r) === -1; });
        return allCustom.concat(builtinOnly);
      }
      patched.__rpcPatched = true;
      window.getChainRpcs = patched;
    } catch(_) {}
  }
  _apply();
  setTimeout(_apply, 0);
  setTimeout(_apply, 300);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _apply);
  }
})();