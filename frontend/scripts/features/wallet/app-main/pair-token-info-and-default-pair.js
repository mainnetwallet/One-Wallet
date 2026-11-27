
// ── Auto-fetch token symbol/name from contract address ──
const TOKEN_FETCH_CACHE = {}; // addr → { sym, name, decimals }

async function fetchTokenInfo(addr) {
  const key = addr.toLowerCase();
  if (TOKEN_FETCH_CACHE[key]) return TOKEN_FETCH_CACHE[key];

  // Check known tokens list first
  const known = PAIR_DEFAULT_TOKENS.find(t => t.addr.toLowerCase() === key);
  if (known) {
    TOKEN_FETCH_CACHE[key] = { sym: known.sym, name: known.name || known.sym, decimals: known.decimals != null ? known.decimals : 18 };
    return TOKEN_FETCH_CACHE[key];
  }

  // Try ERC20 contract call via RPC
  const ERC20_META_ABI = [
    'function symbol() view returns (string)',
    'function name() view returns (string)',
    'function decimals() view returns (uint8)',
  ];
  try {
    // Use working provider
    const rpcs = buildRpcList();
    for (const rpc of rpcs) {
      try {
        const p = _makeProvider(rpc);
        const contract = new ethers.Contract(addr, ERC20_META_ABI, p);
        const [sym, name, decimals] = await Promise.all([
          contract.symbol(),
          contract.name().catch(() => ''),
          contract.decimals().catch(() => 18),
        ]);
        const result = { sym: sym.toUpperCase(), name, decimals: Number(decimals) };
        TOKEN_FETCH_CACHE[key] = result;
        return result;
      } catch { continue; }
    }
  } catch {}

  // Fallback: try Basescan token API (no key needed for basic info)
  try {
    const res = await window.nxFetch(`https://api.basescan.org/api?module=token&action=tokeninfo&contractaddress=${addr}&apikey=YourApiKeyToken`, { ms: 8000 });
    const data = await res.json();
    if (data.status === '1' && data.result?.[0]?.symbol) {
      const r = data.result[0];
      const result = { sym: r.symbol.toUpperCase(), name: r.tokenName, decimals: Number(r.divisor) || 18 };
      TOKEN_FETCH_CACHE[key] = result;
      return result;
    }
  } catch {}

  return null;
}

// Debounce timers per side
const _addrFetchTimers = {};

function onPairAddrInput(side) {
  if (side === 'from') pairFromSelected = null;
  else pairToSelected = null;
  renderDefaultTokenChips();
  updatePairPreview();

  const addrEl  = document.getElementById(`pair-${side}-addr`);
  const symEl   = document.getElementById(`pair-${side}-sym`);
  const addr    = addrEl.value.trim();

  // Only fetch if looks like a full address
  if (!addr.startsWith('0x') || addr.length !== 42) return;

  // Show loading state
  if (symEl) symEl.placeholder = '…';
  if (symEl) symEl.style.color = 'var(--text-muted)';

  clearTimeout(_addrFetchTimers[side]);
  _addrFetchTimers[side] = setTimeout(async () => {
    const info = await fetchTokenInfo(addr);
    if (info) {
      symEl.value = info.sym;
      symEl.style.color = '';
      symEl.placeholder = 'SYM';
      // Auto-fill label if both sides done
      autoFillPairLabel();
      updatePairPreview();
      showToast(`${info.sym}${info.name ? ' · ' + info.name : ''} detected`, 'token');
    } else {
      symEl.placeholder = 'SYM';
      symEl.style.color = '';
    }
  }, 600); // 600ms debounce
}

function autoFillPairLabel() {
  const fromSym = document.getElementById('pair-from-sym')?.value.trim();
  const toSym   = document.getElementById('pair-to-sym')?.value.trim();
  const labelEl = document.getElementById('pair-label');
  if (fromSym && toSym && !labelEl.value.trim()) {
    labelEl.value = `${fromSym} ↔ ${toSym}`;
  }
}

function updatePairPreview() {
  const fromAddr = document.getElementById('pair-from-addr')?.value.trim();
  const fromSym  = document.getElementById('pair-from-sym')?.value.trim();
  const toAddr   = document.getElementById('pair-to-addr')?.value.trim();
  const toSym    = document.getElementById('pair-to-sym')?.value.trim();
  const box      = document.getElementById('pair-preview-box');
  const content  = document.getElementById('pair-preview-content');

  if (!fromAddr || !toAddr) { if (box) box.style.display = 'none'; return; }

  if (box) box.style.display = 'block';
  // Symbols can come from an on-chain symbol() call or user input: escape before innerHTML.
  const fSym = oneSanitize(fromSym || fromAddr.slice(0,6) + '…');
  const tSym = oneSanitize(toSym || toAddr.slice(0,6) + '…');
  const fColor = pairFromSelected ? pairFromSelected.color : '#6366f1';
  const tColor = pairToSelected ? pairToSelected.color : '#22d3ee';

  if (content) content.innerHTML = `
    <div style="background:${fColor}22;border:1px solid ${fColor}44;border-radius:8px;padding:5px 12px;font-size:12px;font-weight:800;color:${fColor};">${fSym}</div>
    <span class="material-icons-round" style="font-size:16px;color:var(--text-muted)">swap_horiz</span>
    <div style="background:${tColor}22;border:1px solid ${tColor}44;border-radius:8px;padding:5px 12px;font-size:12px;font-weight:800;color:${tColor};">${tSym}</div>
    <div style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);margin-left:4px;">${oneSanitize(fromAddr.slice(0,8))}…↔${oneSanitize(toAddr.slice(0,8))}…</div>
  `;
}

function swapPairDirection() {
  const fromAddr = document.getElementById('pair-from-addr')?.value;
  const fromSym  = document.getElementById('pair-from-sym')?.value;
  const toAddr   = document.getElementById('pair-to-addr')?.value;
  const toSym    = document.getElementById('pair-to-sym')?.value;
  (document.getElementById('pair-from-addr') || {}).value = toAddr;
  (document.getElementById('pair-from-sym') || {}).value = toSym;
  (document.getElementById('pair-to-addr') || {}).value = fromAddr;
  (document.getElementById('pair-to-sym') || {}).value = fromSym;
  const tmp = pairFromSelected; pairFromSelected = pairToSelected; pairToSelected = tmp;
  renderDefaultTokenChips();
  updatePairPreview();
  haptic();
}

function savePairAndSelect() {
  const fromAddr = document.getElementById('pair-from-addr')?.value.trim();
  const fromSym  = document.getElementById('pair-from-sym')?.value.trim().toUpperCase();
  const toAddr   = document.getElementById('pair-to-addr')?.value.trim();
  const toSym    = document.getElementById('pair-to-sym')?.value.trim().toUpperCase();
  const label    = document.getElementById('pair-label')?.value.trim();

  // Native ETH address is valid (0x0000...0000 or EEEE...EEEE)
  const _isNativeAddr = (a) => /^0x0{40}$/i.test(a) || /^0xeeee/i.test(a);
  if (!fromAddr) { showToast('Enter FROM address', 'warning'); return; }
  if (!_isNativeAddr(fromAddr) && !ethers.isAddress(fromAddr)) { showToast('❌ Invalid FROM address checksum', 'warning'); return; }
  if (!toAddr)   { showToast('Enter TO address', 'warning'); return; }
  if (!_isNativeAddr(toAddr) && !ethers.isAddress(toAddr))   { showToast('❌ Invalid TO address checksum', 'warning'); return; }
  if (fromAddr.toLowerCase() === toAddr.toLowerCase()) { showToast('❌ FROM and TO cannot be the same token', 'warning'); return; }
  if (!fromSym) { showToast('Enter FROM symbol', 'warning'); return; }
  if (!toSym)   { showToast('Enter TO symbol', 'warning'); return; }

  const pairs = loadSavedPairs();
  // Prevent exact duplicate
  const exists = pairs.find(p => p.fromAddr === fromAddr && p.toAddr === toAddr);
  if (exists) {
    // Just select the existing one
    activePair = { ...exists };
    updateStep2NextBtn();
    renderPairStep();
    showToast('Pair already saved — selected!', 'check_circle');
    haptic();
    return;
  }

  const newPair = {
    fromAddr, fromSym,
    toAddr, toSym,
    label: label || (fromSym + ' ↔ ' + toSym),
  };
  pairs.push(newPair);
  savePairsToStorage(pairs);
  activePair = { ...newPair, _savedIdx: pairs.length - 1 };

  // Clear form
  (document.getElementById('pair-from-addr') || {}).value = '';
  (document.getElementById('pair-from-sym') || {}).value = '';
  (document.getElementById('pair-to-addr') || {}).value = '';
  (document.getElementById('pair-to-sym') || {}).value = '';
  (document.getElementById('pair-label') || {}).value = '';
  pairFromSelected = null; pairToSelected = null;
  const _ppb = document.getElementById('pair-preview-box'); if (_ppb) _ppb.style.display = 'none';
  closeCreatePair(); // collapse the form

  renderPairStep();
  updateStep2NextBtn();
  showToast('Pair saved & selected!', 'bookmark_added');
  haptic();
}

// Default pair: ETH → WETH
const DEFAULT_PAIR = {
  fromAddr: '0x0000000000000000000000000000000000000000',
  fromSym:  'ETH',
  toAddr:   '0x4200000000000000000000000000000000000006',
  toSym:    'WETH',
  label:    'ETH → WETH'
};

function initDefaultPairIfNone() {
  try {
    const pairs = loadSavedPairs();
    // Seed ETH→WETH as a saved pair option if none exist, but do NOT auto-select
    if (pairs.length === 0) {
      savePairsToStorage([DEFAULT_PAIR]);
    }
  } catch(e) {}
  activePair = null; // user must tap to select
}

initDefaultPairIfNone();
updateStep2NextBtn(); // init gate after pair state is known

