
  // ── State ──
  const br = window.br = {
    fromChain:    { id: 8453,  name: 'Base',     emoji: '🔵' },
    toChain:      { id: 1,     name: 'Ethereum', emoji: '🔷' },
    fromToken:    { symbol: 'ETH', address: '0x0000000000000000000000000000000000000000', decimals: 18, priceUSD: 0, logoURI: '' },
    toToken:      { symbol: 'ETH', address: '0x0000000000000000000000000000000000000000', decimals: 18, priceUSD: 0, logoURI: '' },
    slippage:     0.5,
    slippageAuto: true,
    routes:       [],           // array of route objects from LiFi
    selectedRoute: null,        // currently selected route index
    senderAddr:   '',
    senderKey:    '',           // private key from wallet group selection
    recipientAddr:'',
    recipientDebounce: null,
    pickerTarget: 'from',
    walletPanelTarget: 'sender', // 'sender' | 'recipient'
    allTokens:    { from: [], to: [] },
    quoteDebounce: null,
    txHash:       null,
    _routeSession: 0,
  };

  // ── Tier 1 fallback — shown instantly before LiFi API responds ──
  const PRESET_CHAINS = window.PRESET_CHAINS = [
    { id: 8453,   name: 'Base',         emoji: '🔵', nativeSym: 'ETH',  color: '#0052ff' },
    { id: 1,      name: 'Ethereum',     emoji: '⬡',  nativeSym: 'ETH',  color: '#627eea' },
    { id: 42161,  name: 'Arbitrum One', emoji: '🔵', nativeSym: 'ETH',  color: '#28a0f0' },
    { id: 10,     name: 'Optimism',     emoji: '🔴', nativeSym: 'ETH',  color: '#ff0420' },
    { id: 137,    name: 'Polygon',      emoji: '⬡',  nativeSym: 'POL',  color: '#8247e5' },
    { id: 56,     name: 'BNB Chain',    emoji: '💛', nativeSym: 'BNB',  color: '#f3ba2f' },
    { id: 43114,  name: 'Avalanche C',  emoji: '🔺', nativeSym: 'AVAX', color: '#e84142' },
    { id: 59144,  name: 'Linea',        emoji: '◻️', nativeSym: 'ETH',  color: '#61dfff' },
    { id: 534352, name: 'Scroll',       emoji: '📜', nativeSym: 'ETH',  color: '#efc042' },
    { id: 324,    name: 'zkSync Era',   emoji: '⚡', nativeSym: 'ETH',  color: '#8c8dfc' },
  ];

  function $e(id) {
    const el = document.getElementById(id);
    if (el) return el;
    // Return a no-op proxy so $e('x').foo = bar never throws
    return new Proxy({}, {
      get: () => new Proxy(() => {}, { get: () => () => {}, set: () => true, apply: () => {} }),
      set: () => true
    });
  }

  // ── Wallet group helpers ──
  function loadGroups() {
    // Use plaintext cache — returns decrypted keys
    return (typeof loadWalletGroups === 'function') ? loadWalletGroups() : [];
  }

  function shortAddr(addr) {
    if (!addr) return '';
    return addr.slice(0, 6) + '…' + addr.slice(-4);
  }

  function deriveAddress(pk) {
    try {
      const n = pk.startsWith('0x') ? pk : '0x' + pk;
      return new ethers.Wallet(n).address;
    } catch { return null; }
  }

  // ── Token icon helper ──
  function tokenIconHTML(tok, size = 22) {
    const sym = tok.symbol || '?';
    const letter = sym[0];
    const r = Math.round(size * 0.3);
    if (tok.logoURI) {
      return `<img src="${tok.logoURI}" style="width:${size}px;height:${size}px;border-radius:${r}px;object-fit:cover;flex-shrink:0;" onerror="if(this.parentNode)this.outerHTML='<div style=\\'width:${size}px;height:${size}px;border-radius:${r}px;background:rgba(99,102,241,0.2);display:flex;align-items:center;justify-content:center;font-size:${Math.round(size*0.5)}px;font-weight:800;color:var(--accent-primary);flex-shrink:0;\\'>${letter}</div>'" />`;
    }
    return `<div style="width:${size}px;height:${size}px;border-radius:${r}px;background:rgba(99,102,241,0.2);display:flex;align-items:center;justify-content:center;font-size:${Math.round(size*0.5)}px;font-weight:800;color:var(--accent-primary);flex-shrink:0;">${letter}</div>`;
  }

  // ── Update token buttons ──
  // ── Multi-chain public RPC map — arrays for fallback support ──
  window.BR_CHAIN_RPC = window.BR_CHAIN_RPC || {};
