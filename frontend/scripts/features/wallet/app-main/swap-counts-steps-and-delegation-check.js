// ── ASSIGNED SWAP COUNTS (set once via randomize, used everywhere) ──
let assignedSwapCounts = [];

function getSwapCount(index) {
  if (assignedSwapCounts[index] !== undefined) return assignedSwapCounts[index];
  // fallback: even numbers only from range
  const min = parseInt(document.getElementById('swap-min')?.value || 2);
  const max = parseInt(document.getElementById('swap-max')?.value || 6);
  const vals = [];
  for (let v = (min % 2 === 0 ? min : min + 1); v <= max; v += 2) vals.push(v);
  if (!vals.length) return (min % 2 === 0 ? min : min + 1);
  return vals[index % vals.length];
}

function updateSwapRange() {
  const min = parseInt(document.getElementById('swap-min')?.value) || 2;
  const max = parseInt(document.getElementById('swap-max')?.value) || 6;
  // Build even-only list
  const vals = [];
  for (let v = (min % 2 === 0 ? min : min + 1); v <= max; v += 2) vals.push(v);
  const previewEl = document.getElementById('range-preview');
  if (previewEl) { previewEl.textContent = vals.length ? vals.join(', ') + ' swaps' : min + '–' + max + ' swaps'; previewEl.style.display = 'none'; }
}

function randomizeSwapCounts() {
  // Re-apply group selection first — home page wallet switch can override validatedKeys to 1 key
  if (typeof applyMultiGroupSelection === 'function') applyMultiGroupSelection();
  if (validatedKeys.length === 0) { showToast('Add keys first', 'warning'); return; }
  const min = parseInt(document.getElementById('swap-min')?.value) || 2;
  const max = parseInt(document.getElementById('swap-max')?.value) || 6;
  // Even numbers only: 2, 4, 6 ...
  const vals = [];
  for (let v = (min % 2 === 0 ? min : min + 1); v <= max; v += 2) vals.push(v);
  if (!vals.length) vals.push(min % 2 === 0 ? min : min + 1);

  assignedSwapCounts = validatedKeys.map(() => vals[Math.floor(Math.random() * vals.length)]);

  // Show preview chips
  const preview = document.getElementById('randomize-preview');
  if (preview) { preview.style.display = 'flex'; preview.style.flexWrap = 'wrap'; preview.style.gap = '6px';
    preview.innerHTML = assignedSwapCounts.map((c, i) =>
      `<div style="font-family:var(--font-mono);font-size:10px;background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.25);border-radius:7px;padding:4px 10px;color:var(--text-secondary);">W${i+1} <span style="color:var(--accent-primary);font-weight:700;">${c}</span></div>`
    ).join('');
  }

  // Re-render wallet preview in step 1 with new counts
  renderWalletPreview(validatedKeys, []);

  const total = assignedSwapCounts.reduce((a, b) => a + b, 0);
  (document.getElementById('sum-total-swaps') || {}).textContent = total + ' swaps';
  showToast(`${total} total swaps assigned`, 'casino');
  haptic();

  // Animate button
  const btn = document.getElementById('randomize-btn');
  if (btn) { btn.style.background = 'linear-gradient(135deg,rgba(99,102,241,0.3),rgba(139,92,246,0.3))'; setTimeout(() => { btn.style.background = ''; }, 400); }
}

function pasteKeys() {
  navigator.clipboard?.readText().then(text => {
    const ta = document.getElementById('key-textarea');
    ta.value = (ta.value ? ta.value + '\n' : '') + text;
    onKeysInput(ta);
    showToast('Pasted from clipboard', 'content_paste');
  }).catch(() => {
    showToast('Tap & hold textarea to paste', 'info');
  });
}

function clearKeys() {
  (document.getElementById('key-textarea') || {}).value = '';
  assignedSwapCounts = [];
  const _rp1 = document.getElementById('randomize-preview'); if (_rp1) _rp1.style.display = 'none';
  onKeysInput(document.getElementById('key-textarea'));
  showToast('Cleared', 'clear_all');
  haptic();
}



// ── STEP NAVIGATION ──
function setStep(n) {
  currentStep = n;
  [1,2,3,4].forEach(i => {
    const s = document.getElementById('step-' + i);
    const d = document.getElementById('swap-step-' + i);
    s.classList.remove('active','done');
    if (i < n) s.classList.add('done');
    else if (i === n) s.classList.add('active');
    if (d) d.style.display = i === n ? 'block' : 'none';
  });
  // lines
  document.getElementById('line-1-2')?.classList.toggle('done', n > 1);
  document.getElementById('line-2-3')?.classList.toggle('done', n > 2);
  document.getElementById('line-3-4')?.classList.toggle('done', n > 3);
  (document.getElementById('page-swap') || {}).scrollTop = 0;
}

function goToStep1() { setStep(1); }

function goToStep2() {
  setStep(2);
  renderPairStep();
  haptic();
}

// ── EIP-7702 DELEGATION CHECK ──
// Checks if an address has a delegation set (code starts with 0xef0100)
const BASE_RPC = 'https://mainnet.base.org'; // kept for legacy references
async function isDelegated(address) {
  const _rpcList = typeof buildRpcList === 'function' ? buildRpcList() : ['https://mainnet.base.org'];
  for (const _rpc of _rpcList) {
    try {
      const res = await fetch(_rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc:'2.0', id:1, method:'eth_getCode', params:[address, 'latest'] })
      });
      const data = await res.json();
      const code = data.result || '0x';
      // EIP-7702 delegation indicator: bytecode starts with 0xef0100 (strict check)
      return code.startsWith('0xef0100') && code.length >= 10;
    } catch(e) { continue; }
  }
  return false;
}
