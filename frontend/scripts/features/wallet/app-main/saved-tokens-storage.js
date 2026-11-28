
// IDs removed in previous versions — purge from localStorage on load
const REMOVED_TOKEN_IDS = new Set([
  'eth1-eth', 'arb-eth', 'op-eth', 'matic-matic',
  'bsc-bnb', 'avax-avax', 'linea-eth', 'scroll-eth', 'zk-eth',
]);

function loadSavedTokens() {
  try {
    const storageKey = _getTmStorageKey();
    // Per-wallet key: do NOT migrate from legacy global key (each wallet has its own token list)
    let raw = localStorage.getItem(storageKey);
    if (!raw) {
      // First-ever load for this wallet — persist defaults so addToken() doesn't overwrite them
      try { localStorage.setItem(storageKey, JSON.stringify(DEFAULT_TOKENS)); } catch {}
      return [...DEFAULT_TOKENS];
    }
    // Purge old duplicate IDs and fix stale names from DEFAULT_TOKENS
    let saved = JSON.parse(raw).filter(t => t && !REMOVED_TOKEN_IDS.has(t.id)).map(oneCleanToken);
    // Update name/isNative fields from DEFAULT_TOKENS (fixes old cached "(Native)" names)
    saved = saved.map(t => {
      const def = DEFAULT_TOKENS.find(d => d.id === t.id);
      if (def) return Object.assign({}, t, { name: def.name, isNative: def.isNative });
      return t;
    });
    // Merge any new DEFAULT_TOKENS not yet in saved list
    const savedIds = new Set(saved.map(t => t.id));
    // Load user-removed default IDs so they don't get re-injected
    let _removedDefaults = new Set();
    try {
      const _rdRaw = localStorage.getItem(_getTmStorageKey() + '_removed_defaults');
      if (_rdRaw) _removedDefaults = new Set(JSON.parse(_rdRaw));
    } catch {}
    const missing = DEFAULT_TOKENS.filter(t => !savedIds.has(t.id) && !_removedDefaults.has(t.id));
    if (missing.length > 0) {
      const merged = [...saved];
      missing.forEach(t => {
        const idx = merged.findIndex(s => (s.chainId || 8453) === (t.chainId || 8453));
        if (idx !== -1) merged.splice(idx, 0, t);
        else merged.push(t);
      });
      try { localStorage.setItem(storageKey, JSON.stringify(merged)); } catch {}
      return merged;
    }
    // Persist purge
    try { localStorage.setItem(storageKey, JSON.stringify(saved)); } catch {}
    return saved;
  } catch { return [...DEFAULT_TOKENS]; }
}

function saveTokenList(tokens) {
  try {
    const storageKey = _getTmStorageKey();
    localStorage.setItem(storageKey, JSON.stringify((Array.isArray(tokens) ? tokens : []).map(oneCleanToken)));
  } catch {}
}

function syncTokenConfig() {
  const tokens = loadSavedTokens();
  TOKEN_CONFIG.length = 0;
  tokens.forEach(t => TOKEN_CONFIG.push(t));
}