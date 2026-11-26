
// Fetch live prices for USD estimate in send
(async () => {
  try {
    const res = await window.nxFetch('https://api.binance.com/api/v3/ticker/price?symbols=["ETHUSDT","EURUSDT","USDCUSDT"]', { ms: 8000 });
    const arr = await res.json();
    arr.forEach(t => {
      if (t.symbol === 'ETHUSDT') { sendPrices.ETH = parseFloat(t.price); sendPrices.WETH = sendPrices.ETH; }
      if (t.symbol === 'USDCUSDT') sendPrices.USDC = parseFloat(t.price);
    });
  } catch { }
})();

// ── TOGGLE ──
// ══════════════════════════════════════════
// ── RPC SYSTEM — Alchemy primary + fallback ──
// ══════════════════════════════════════════
const ALCHEMY_KEY_STORAGE = 'one_alchemy_key';
const ALCHEMY_BASE_URL    = 'https://base-mainnet.g.alchemy.com/v2/';

const RPC_FALLBACKS = [
  'https://mainnet.base.org',
  'https://base-rpc.publicnode.com',
  'https://base.drpc.org',
];

function getAlchemyKey() {
  return (document.getElementById('alchemy-key-input')?.value.trim()) ||
         localStorage.getItem(ALCHEMY_KEY_STORAGE) || '';
}

function saveAlchemyKey(key) {
  localStorage.setItem(ALCHEMY_KEY_STORAGE, key);
}

function buildRpcList() {
  const key = getAlchemyKey();
  const list = [];
  if (key) list.push(ALCHEMY_BASE_URL + key);
  list.push(...RPC_FALLBACKS);
  return list;
}

// Try each RPC in order — return first working provider + which index succeeded
async function getWorkingProvider(logFn) {
  try {
    const p = await _withRpcFallback(8453, async (provider) => {
      await Promise.race([
        provider.getBlockNumber(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))
      ]);
      return provider;
    }, 4000);
    // FIX: determine which RPC actually succeeded by checking provider URL against list
    const rpcs = buildRpcList();
    let successIndex = 0;
    try {
      // _withRpcFallback stores the working RPC URL on the provider object (ethers v6)
      const activeUrl = p && (p._getConnection ? p._getConnection().url : (p.connection && p.connection.url));
      if (activeUrl) {
        const idx = rpcs.findIndex(r => activeUrl.startsWith(r) || r.startsWith(activeUrl));
        if (idx >= 0) successIndex = idx;
      }
    } catch(_) {}
    updateRpcFallbackUI(successIndex);
    return p;
  } catch(e) {
    if (logFn) { logFn('❌ All RPCs failed — check internet connection', 'error'); }
    return null;
  }
}

function updateRpcFallbackUI(successIndex) {
  const dot = document.getElementById('rpc-live-dot');
  const sub = document.getElementById('rpc-status-sub');
  if (dot) dot.style.background = successIndex === 0 ? 'var(--accent-green)' : 'var(--accent-amber)';
  if (sub) sub.textContent = successIndex === 0 ? '⚡ Alchemy connected' : `⚠️ Fallback #${successIndex} active`;
  for (let i = 1; i <= 4; i++) {
    const el = document.getElementById('rpc-'+i+'-status');
    if (!el) continue;
    const adjustedIndex = getAlchemyKey() ? i - 1 : i; // 0-based
    if (adjustedIndex === successIndex) {
      if (el) el.textContent = '● ACTIVE';
      el.style.color = 'var(--accent-green)';
    } else if (adjustedIndex < successIndex) {
      if (el) el.textContent = '✗ FAILED';
      el.style.color = 'var(--accent-red)';
    } else {
      if (el) el.textContent = adjustedIndex === 0 ? 'PRIMARY' : 'FALLBACK';
      el.style.color = 'var(--text-muted)';
    }
  }
}

function onAlchemyKeyInput() {
  const key = document.getElementById('alchemy-key-input')?.value.trim();
  if (key) saveAlchemyKey(key);
  const statusEl = document.getElementById('alchemy-key-status');
  if (statusEl) statusEl.textContent = key ? '💾 Key saved — will be used on next run' : '';
  statusEl.style.color = 'var(--text-muted)';
}

async function testAlchemyKey() {
  const key = getAlchemyKey();
  const btn = document.getElementById('alchemy-test-btn');
  const statusEl = document.getElementById('alchemy-key-status');
  if (!key) { if(statusEl) { statusEl.textContent = '❌ No API key entered'; statusEl.style.color='var(--accent-red)'; } return; }
  if (btn) { btn.textContent = '…'; btn.style.opacity='0.5'; }
  if (statusEl) { statusEl.textContent = 'Testing…'; statusEl.style.color='var(--text-muted)'; }
  try {
    const url = ALCHEMY_BASE_URL + key;
    const p = _makeProvider(url);
    const block = await p.getBlockNumber();
    if (statusEl) { statusEl.textContent = `✅ Connected! Block #${block}`; statusEl.style.color='var(--accent-green)'; }
    updateRpcFallbackUI(0);
    showToast('Alchemy connected!', 'check_circle');
    haptic();
  } catch(e) {
    if (statusEl) { statusEl.textContent = `❌ Failed: ${e.message?.slice(0,60)}`; statusEl.style.color='var(--accent-red)'; }
    showToast('Alchemy key invalid', 'error');
  }
  if (btn) { btn.textContent = 'TEST'; btn.style.opacity='1'; }
}

// Load saved key on boot
document.addEventListener('DOMContentLoaded', function initRpcUI() {
  const saved = localStorage.getItem(ALCHEMY_KEY_STORAGE);
  if (saved) {
    const inp = document.getElementById('alchemy-key-input');
    if (inp) inp.value = saved;
    const statusEl = document.getElementById('alchemy-key-status');
    if (statusEl) { statusEl.textContent = '💾 Saved key loaded'; statusEl.style.color='var(--text-muted)'; }
  }
});

