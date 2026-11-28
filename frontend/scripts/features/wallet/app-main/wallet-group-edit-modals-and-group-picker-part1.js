

function closeWgekModal() {
  const overlay = document.getElementById('wgek-overlay');
  if (overlay) { overlay.style.display = 'none'; overlay.classList.remove('open'); }
  _wgEditKeysGroupId = null;
  _wgEditKeysSelected = new Set();
  // ── Return to Wallet Groups Manager ──
  document.getElementById('wgm-overlay')?.classList.add('open');
}

function wgekRemoveSelected() {
  if (!_wgEditKeysGroupId || _wgEditKeysSelected.size === 0) return;
  const groups = loadWalletGroups();
  const g = groups.find(g => g.id === _wgEditKeysGroupId);
  if (!g) return;
  const toRemove = _wgEditKeysSelected;
  g.keys = g.keys.filter((_, i) => !toRemove.has(i));
  // Wallet names follow their keys: drop the names of the removed wallets too
  if (Array.isArray(g.labels)) {
    g.labels = g.labels.filter((_, i) => !toRemove.has(i));
    if (!g.labels.some(l => !!l)) delete g.labels;
  }
  saveWalletGroups(groups);
  renderWalletGroupsList();
  renderSwapGroupList && renderSwapGroupList();
  renderWgManagerList && renderWgManagerList();
  const n = toRemove.size;
  showToast(n + ' key' + (n > 1 ? 's' : '') + ' removed', 'delete');
  closeWgekModal();
  haptic && haptic();
}

// ── Edit name modal ──
function openWgEditModal(id) {
  const groups = loadWalletGroups();
  const g = groups.find(g => g.id === id);
  if (!g) return;
  wgEditingId = id;
  (document.getElementById('wg-edit-name-input') || {}).value = g.name;
  document.getElementById('wg-edit-overlay')?.classList.add('open');
  haptic();
}

function closeWgEditModal() {
  document.getElementById('wg-edit-overlay')?.classList.remove('open');
  wgEditingId = null;
  // ── Return to Wallet Groups Manager ──
  document.getElementById('wgm-overlay')?.classList.add('open');
}

function saveWgEditName() {
  const name = document.getElementById('wg-edit-name-input')?.value.trim();
  if (!name || !wgEditingId) return;
  const groups = loadWalletGroups();
  // Duplicate check — exclude the group being renamed
  const duplicate = groups.some(g => g.id !== wgEditingId && g.name.trim().toLowerCase() === name.toLowerCase());
  if (duplicate) {
    showToast('Name already exists — please choose a different name', 'error');
    return;
  }
  const g = groups.find(g => g.id === wgEditingId);
  if (g) {
    g.name = name;
    saveWalletGroups(groups);
    renderWalletGroupsList();
    renderSwapGroupList();
    renderWgManagerList && renderWgManagerList();
    showToast('Renamed to: ' + name, 'edit');
  }
  closeWgEditModal();
  haptic();
}

// ── Swap group list (multi-select) — Connected Wallets style ──
function renderSwapGroupList() {
  const container = document.getElementById('swap-group-list');
  if (!container) return;
  const groups = loadWalletGroups().filter(g => g && g.keys && g.keys.length > 0);

  container.innerHTML = '';

  if (groups.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:30px 20px;font-family:var(--font-mono);font-size:11px;color:var(--text-muted);line-height:2.2;"><div style="font-size:28px;margin-bottom:8px;">📁</div>NO GROUPS FOUND<br><span style="font-size:10px;opacity:0.6;">Import in Settings first</span></div>';
    return;
  }

  groups.forEach(function(g, idx) {
    var clr      = WG_COLORS[idx % WG_COLORS.length];
    var isActive = swapSelectedGroupIds.includes(g.id);

    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:8px;';

    // Main card
    var card = document.createElement('div');
    card.className = 'del-drawer-item' + (isActive ? ' selected' : '');
    card.dataset.groupId = g.id;
    card.style.cssText = 'flex:1;cursor:pointer;position:relative;transition:all 0.2s ease;display:flex;align-items:center;gap:12px;padding:12px 48px 12px 14px;border-radius:14px;margin-bottom:0;';

    var checkIcon = isActive
      ? '<div style="position:absolute;top:50%;right:12px;transform:translateY(-50%);width:22px;height:22px;border-radius:7px;background:var(--accent-primary);display:flex;align-items:center;justify-content:center;box-shadow:0 0 8px rgba(99,102,241,0.5);flex-shrink:0;"><span class="material-icons-round" style="font-size:14px;color:#fff;">check</span></div>'
      : '<div style="position:absolute;top:50%;right:12px;transform:translateY(-50%);width:22px;height:22px;border-radius:7px;background:var(--bg-raised);border:1.5px solid var(--border-subtle);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span class="material-icons-round" style="font-size:13px;color:var(--text-muted);">radio_button_unchecked</span></div>';

    var activeBadge = isActive
      ? '<div style="font-size:8px;font-weight:800;font-family:var(--font-mono);letter-spacing:1.5px;padding:2px 7px;border-radius:6px;background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.4);color:var(--accent-primary);white-space:nowrap;">● ACTIVE</div>'
      : '';

    card.innerHTML =
      '<div style="width:42px;height:42px;border-radius:13px;background:' + clr.num + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:18px;font-weight:900;color:#fff;box-shadow:0 2px 12px ' + clr.glow + ';">' + (g.emoji || (idx + 1)) + '</div>' +
      '<div style="flex:1;min-width:0;overflow:hidden;">' +
        '<div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">' +
          '<div style="font-size:13px;font-weight:800;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + g.name + '</div>' +
          activeBadge +
        '</div>' +
        '<div style="font-size:10px;font-family:var(--font-mono);margin-top:3px;color:' + clr.accent + ';font-weight:700;">' + g.keys.length + ' wallet' + (g.keys.length !== 1 ? 's' : '') + '</div>' +
      '</div>' +
      checkIcon;

    card.addEventListener('click', function() { toggleSwapGroupMulti(g.id); });
    card.addEventListener('touchstart', function() { card.style.opacity='0.8'; }, {passive:true});
    card.addEventListener('touchend', function() { card.style.opacity='1'; });

    wrap.appendChild(card);
    container.appendChild(wrap);
  });

  // Re-apply summary state
  applyMultiGroupSelection();
}

function toggleSwapGroupMulti(id) {
  const idx = swapSelectedGroupIds.indexOf(id);
  if (idx === -1) {
    swapSelectedGroupIds.push(id);
  } else {
    swapSelectedGroupIds.splice(idx, 1);
  }
  saveSwapSelectedGroupIds();
  // Update this item's visual
  const item = document.querySelector(`.swap-group-item[data-group-id="${id}"]`);
  if (item) item.classList.toggle('selected', swapSelectedGroupIds.includes(id));
  applyMultiGroupSelection();
  haptic();
}

function swapSelectAllGroups() {
  const groups = loadWalletGroups();
  swapSelectedGroupIds = groups.map(g => g.id);
  saveSwapSelectedGroupIds();
  renderSwapGroupList();
  haptic();
}

function swapDeselectAllGroups() {
  swapSelectedGroupIds = [];
  saveSwapSelectedGroupIds();
  renderSwapGroupList();
  applyMultiGroupSelection();
  haptic();
}

// Legacy single-select (kept for wg-picker overlay compatibility)
function selectSwapGroup(id) {
  if (!swapSelectedGroupIds.includes(id)) swapSelectedGroupIds.push(id);
  saveSwapSelectedGroupIds();
  renderSwapGroupList();
  closeWgPicker();
  haptic();
}

function closeSwapGroupPicker() {
  if (swapSelectedGroupIds.length === 0) return; // nothing selected, keep open
  const pill = document.getElementById('swap-active-group-pill');
  const picker = document.getElementById('swap-group-picker');
  if (pill) pill.style.display = 'flex';
  if (picker) picker.style.display = 'none';
  haptic();
}

function openWgPickerForSwap() {
  // Show picker, hide pill — let user re-select groups
  const pill = document.getElementById('swap-active-group-pill');
  const picker = document.getElementById('swap-group-picker');
  if (pill) pill.style.display = 'none';
  if (picker) picker.style.display = 'block';
  renderSwapGroupList();
  if (picker) picker.scrollIntoView({ behavior: 'smooth', block: 'start' });
  haptic();
}

function closeWgPicker() {
  try { document.getElementById('wg-picker-overlay')?.classList.remove('open'); } catch {}
}

function renderWgPickerList() {
  const list = document.getElementById('wg-picker-list');
  const badge = document.getElementById('wg-picker-badge');
  const groups = loadWalletGroups();
  if (badge) badge.textContent = groups.length + ' GROUP' + (groups.length !== 1 ? 'S' : '');

  if (groups.length === 0) {
    if (list) list.innerHTML = '<div style="text-align:center;padding:30px;font-family:var(--font-mono);font-size:11px;color:var(--text-muted);">No groups found. Import in Settings.</div>';
    return;
  }

  if (list) list.innerHTML = '';
  groups.forEach(g => {
    const item = document.createElement('div');
    item.style.cssText = 'display:flex;align-items:center;gap:12px;padding:16px;background:var(--bg-glass);border:2px solid var(--border-subtle);border-radius:var(--radius-md);cursor:pointer;transition:all 0.2s;';
    item.innerHTML = `
      <div style="width:42px;height:42px;border-radius:12px;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.25);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <span class="material-icons-round" style="font-size:22px;color:var(--accent-primary);">folder</span>
      </div>
      <div style="flex:1;">
        <div style="font-size:14px;font-weight:700;">${g.name}</div>
        <div style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);margin-top:3px;">${g.keys.length} keys · Added ${new Date(g.createdAt).toLocaleDateString()}</div>
      </div>
      <span class="material-icons-round" style="color:var(--accent-primary);font-size:20px;">arrow_forward_ios</span>
    `;
    item.onclick = () => selectSwapGroup(g.id);
    item.addEventListener('mousedown', () => { item.style.transform='scale(0.98)'; item.style.borderColor='rgba(99,102,241,0.5)'; });
    item.addEventListener('mouseup', () => { item.style.transform=''; item.style.borderColor=''; });
    list.appendChild(item);
  });
}

// Init on page load
window.addEventListener('load', () => {
  setTimeout(() => {
    renderWalletGroupsList();
    renderSwapGroupList();
    // hook name input
    const ni = document.getElementById('wg-name-input');
    if (ni) ni.addEventListener('input', onWgKeyInput);

    // ── Restore Settings selection → Home & Profile ──
    applySettingsGroupSelection();
    // ── Restore Swap selection (separate) ──
    if (swapSelectedGroupIds.length > 0) {
      applyMultiGroupSelection();
    } else if (activeGroupId) {
      // Fallback: legacy single-select restore
      const groups = loadWalletGroups();
      const saved = groups.find(g => g.id === activeGroupId);
      if (saved) {
        swapSelectedGroupIds = [activeGroupId];
        saveSwapSelectedGroupIds();
        applyMultiGroupSelection();
      } else {
        activeGroupId = null;
        try { localStorage.removeItem(WG_ACTIVE_KEY); } catch {}
      }
    }
  }, 2200);
});
let swapBotRunning = false;
let currentRunWalletIndex = 0; // tracks which wallet is running for resume on stop
let _runStart = 0;
let _totalSuccess = 0, _totalFail = 0, _totalSkip = 0;
let currentStep = 1;

// ══════════════════════════════════════════════
// PAIR SYSTEM
// ══════════════════════════════════════════════

const PAIR_STORAGE_KEY = 'one_saved_pairs';

// Default pair tokens for the picker (subset of DEFAULT_TOKENS used in pair step)
const PAIR_DEFAULT_TOKENS = [
  { sym: 'ETH',      name: 'Ether (Native)',        addr: '0x0000000000000000000000000000000000000000', decimals: 18, icon: 'Ξ',  color: '#627eea' },
  { sym: 'WETH',     name: 'Wrapped Ether',         addr: '0x4200000000000000000000000000000000000006', decimals: 18, icon: 'Ξ',  color: '#6366f1' },
  { sym: 'USDC',     name: 'USD Coin',              addr: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6,  icon: '$',  color: '#10b981' },
  { sym: 'EURC',     name: 'EURC',                  addr: '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42', decimals: 6,  icon: '€',  color: '#22d3ee' },
  { sym: 'cbETH',    name: 'Coinbase ETH',          addr: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22', decimals: 18, icon: 'cb', color: '#0052ff' },
  { sym: 'cbBTC',    name: 'Coinbase BTC',          addr: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', decimals: 8,  icon: '₿',  color: '#f7931a' },
  { sym: 'aBasWETH', name: 'Aave Base WETH',        addr: '0xD4a0e0b9149BCee3C920d2E00b5dE09138fd8bb7', decimals: 18, icon: 'aΞ', color: '#8b5cf6' },
  { sym: 'aBasUSDC', name: 'Aave Base USDC',        addr: '0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB', decimals: 6,  icon: 'a$', color: '#10b981' },
  { sym: 'aBasEURC', name: 'Aave Base EURC',        addr: '0x8437d7C167dFB82ED4Cb79CD44B7a32A1dd95c77', decimals: 6,  icon: 'a€', color: '#22d3ee' },
];

let activePair = null; // { fromAddr, fromSym, toAddr, toSym, label }
let pairFromSelected = null; // { sym, addr, icon, color }
let pairToSelected = null;

function loadSavedPairs() {
  try { return JSON.parse(localStorage.getItem(PAIR_STORAGE_KEY) || '[]'); } catch { return []; }
}

function savePairsToStorage(pairs) {
  try { localStorage.setItem(PAIR_STORAGE_KEY, JSON.stringify(pairs)); } catch {}
}

function selectSavedPair(idx) {
  const pairs = loadSavedPairs();
  const p = pairs[idx];
  if (!p) return;
  // Toggle: click again to deselect
  const alreadyActive = activePair && activePair.fromAddr === p.fromAddr && activePair.toAddr === p.toAddr;
  if (alreadyActive) {
    activePair = null;
    renderPairStep();
    updateStep2NextBtn();
    showToast('Pair deselected', 'remove_circle');
    haptic();
  } else {
    activePair = { ...p, _savedIdx: idx };
    renderPairStep();
    updateStep2NextBtn();
    showToast('Pair selected: ' + (p.label || p.fromSym + ' ↔ ' + p.toSym), 'check_circle');
    haptic();
  }
}

function updateStep2NextBtn() {
  const hasPair = !!(activePair && activePair.fromAddr && activePair.toAddr);

  // ── Step 1 next button — dim when no keys ──
  const step1Btn = document.getElementById('step1-next-btn');
  const hasKeys = !!(typeof validatedKeys !== 'undefined' && validatedKeys && validatedKeys.length > 0);
  if (step1Btn) {
    step1Btn.style.opacity = hasKeys ? '' : '0.5';
    step1Btn.style.filter  = hasKeys ? '' : 'grayscale(0.4)';
  }
  // ── Step 1 nav tab ──
  const step1Tab = document.getElementById('step-1');
  // step-1 tab is always clickable (it's the starting point)

  // ── Review & Start button (step 3) ──
  const reviewBtn = document.getElementById('review-start-btn');
  if (reviewBtn) {
    reviewBtn.disabled = !hasPair;
    reviewBtn.style.opacity = hasPair ? '' : '0.35';
    reviewBtn.style.filter  = hasPair ? '' : 'grayscale(0.6)';
    reviewBtn.style.cursor  = hasPair ? '' : 'not-allowed';
    reviewBtn.style.pointerEvents = hasPair ? '' : 'none';
  }

  // ── Step 4 nav tab ──
  const step4Tab = document.getElementById('step-4');
  if (step4Tab) {
    step4Tab.style.opacity       = hasPair ? '' : '0.35';
    step4Tab.style.filter        = hasPair ? '' : 'grayscale(0.6)';
    step4Tab.style.cursor        = hasPair ? 'pointer' : 'not-allowed';
    step4Tab.style.pointerEvents = hasPair ? '' : 'none';
  }
}

function renderPairStep() {
  renderSavedPairs();
  renderDefaultTokenChips();
}

function toggleCreatePair() {
  const body = document.getElementById('create-pair-body');
  const chevron = document.getElementById('create-pair-chevron');
  const isOpen = body ? body.style.display !== 'none' : false;
  if (isOpen) {
    if (body) body.style.display = 'none';
    if (chevron) { chevron.style.transform = ''; chevron.textContent = 'expand_more'; }
  } else {
    if (body) body.style.display = 'block';
    if (chevron) { chevron.style.transform = 'rotate(180deg)'; chevron.textContent = 'expand_less'; }
    // Render token chips when opened
    renderDefaultTokenChips();
    haptic();
  }
}

function closeCreatePair() {
  const body = document.getElementById('create-pair-body');
  const chevron = document.getElementById('create-pair-chevron');
  if (body) body.style.display = 'none';
  if (chevron) { chevron.style.transform = ''; chevron.textContent = 'expand_more'; }
}

function renderSavedPairs() {
  const list = document.getElementById('saved-pairs-list');
  const noMsg = document.getElementById('no-pairs-msg');
  const badge = document.getElementById('pair-saved-count');
  const pairs = loadSavedPairs();

  if (pairs.length === 0) {
    if (noMsg) noMsg.style.display = 'block';
    if (badge) badge.style.display = 'none';
    return;
  }
  if (noMsg) noMsg.style.display = 'none';
  if (badge) { badge.textContent = pairs.length + ' PAIR' + (pairs.length !== 1 ? 'S' : ''); badge.style.display = 'block'; badge.classList.add('has-keys'); }

  // Re-render only pair items (keep noMsg element)
  const existingItems = list.querySelectorAll('.saved-pair-item');
  existingItems.forEach(el => el.remove());

  pairs.forEach((p, i) => {
    const isActive = activePair && activePair.fromAddr === p.fromAddr && activePair.toAddr === p.toAddr;
    const el = document.createElement('div');
    el.className = 'saved-pair-item';
    el.style.cssText = `
      display:flex;align-items:center;gap:10px;padding:11px 14px;
      background:${isActive ? 'rgba(99,102,241,0.12)' : 'var(--bg-glass)'};
      border:1px solid ${isActive ? 'rgba(99,102,241,0.4)' : 'var(--border-subtle)'};
      border-radius:var(--radius-md);cursor:pointer;transition:all 0.2s ease;
      animation:slideIn 0.25s ease both;animation-delay:${i*0.05}s;
    `;
    el.innerHTML = `
      <div style="width:34px;height:34px;border-radius:10px;background:${isActive ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)'};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <span class="material-icons-round" style="font-size:16px;color:${isActive ? 'var(--accent-primary)' : 'var(--text-muted)'}">swap_horiz</span>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:700;color:${isActive ? 'var(--text-primary)' : 'var(--text-secondary)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${oneSanitize(p.label || (p.fromSym + ' ↔ ' + p.toSym))}</div>
        <div style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);margin-top:2px;">${oneSanitize(p.fromSym)} ↔ ${oneSanitize(p.toSym)}</div>
      </div>
      ${isActive ? '<div style="font-size:9px;font-weight:700;color:var(--accent-primary);font-family:var(--font-mono);letter-spacing:1px;background:rgba(99,102,241,0.15);padding:3px 8px;border-radius:6px;border:1px solid rgba(99,102,241,0.3);flex-shrink:0;">ACTIVE</div>' : '<div style="width:34px;height:34px;border-radius:10px;background:transparent;flex-shrink:0;"></div>'}
    `;
    el.addEventListener('click', () => selectSavedPair(i));
    list.appendChild(el);
  });
}

// ── PAIR MANAGER MODAL ──
function openPairManager() {
  document.getElementById('pm-overlay')?.classList.add('open');
  renderPmList();
  haptic();
}

function closePairManager() {
  document.getElementById('pm-overlay')?.classList.remove('open');
  haptic();
}

function renderPmList() {
  const list = document.getElementById('pm-list');
  const empty = document.getElementById('pm-empty');
  const badge = document.getElementById('pm-count-badge');
  const pairs = loadSavedPairs();

  if (badge) badge.textContent = pairs.length + ' PAIR' + (pairs.length !== 1 ? 'S' : '');

  if (pairs.length === 0) {
    if (list) list.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';
  if (list) list.innerHTML = '';

  pairs.forEach((p, i) => {
    const isActive = activePair && activePair.fromAddr === p.fromAddr && activePair.toAddr === p.toAddr;
    const item = document.createElement('div');
    item.className = 'tm-token-item';
    item.style.cursor = 'pointer';
    item.innerHTML = `
      <div class="tm-token-icon" style="background:${isActive ? 'rgba(99,102,241,0.2)' : 'rgba(34,211,238,0.1)'};color:${isActive ? 'var(--accent-primary)' : 'var(--neon-cyan)'};">
        <span class="material-icons-round" style="font-size:18px;">swap_horiz</span>
      </div>
      <div class="tm-token-info">
        <div class="tm-token-name">${oneSanitize(p.label || (p.fromSym + ' ↔ ' + p.toSym))}</div>
        <div class="tm-token-sub">${oneSanitize(p.fromSym)} ↔ ${oneSanitize(p.toSym)}${isActive ? ' · ACTIVE' : ''}</div>
      </div>
      ${isActive
        ? `<div class="tm-already-badge" style="color:var(--accent-primary);background:rgba(99,102,241,0.12);border-color:rgba(99,102,241,0.3);">ACTIVE</div>`
        : `<div class="tm-remove-btn" onclick="event.stopPropagation();removeSavedPair(${i})"><span class="material-icons-round">delete</span></div>`
      }
    `;
    item.addEventListener('click', () => {
      const wasActive = activePair && activePair.fromAddr === p.fromAddr && activePair.toAddr === p.toAddr;
      selectSavedPair(i);
      if (!wasActive) closePairManager(); // only close on select, not deselect
    });
    list.appendChild(item);
  });
}

function removeSavedPair(idx) {
  const pairs = loadSavedPairs();
  const removed = pairs[idx];
  pairs.splice(idx, 1);
  savePairsToStorage(pairs);
  // If removed pair was active, clear or switch to first
  if (activePair && activePair.fromAddr === removed.fromAddr && activePair.toAddr === removed.toAddr) {
    activePair = pairs.length > 0 ? { ...pairs[0], _savedIdx: 0 } : null;
  }
  renderPmList();
  renderSavedPairs();
  updateStep2NextBtn();
  showToast('Pair removed', 'delete');
  haptic();
}

function renderDefaultTokenChips() {
  ['from', 'to'].forEach(side => {
    const container = document.getElementById(side + '-token-defaults');
    if (!container) return;
    if (container) container.innerHTML = '';
    PAIR_DEFAULT_TOKENS.forEach(t => {
      const sel = side === 'from' ? pairFromSelected : pairToSelected;
      const isSelected = sel && sel.addr === t.addr;
      const chip = document.createElement('div');
      chip.style.cssText = `
        flex-shrink:0;padding:5px 12px;border-radius:9px;cursor:pointer;
        background:${isSelected ? 'rgba(99,102,241,0.2)' : 'var(--bg-raised)'};
        border:1px solid ${isSelected ? 'rgba(99,102,241,0.5)' : 'var(--border-subtle)'};
        font-size:11px;font-weight:700;font-family:var(--font-mono);
        color:${isSelected ? 'var(--neon-purple)' : 'var(--text-secondary)'};
        transition:all 0.2s ease;white-space:nowrap;
      `;
      if (chip) chip.textContent = t.sym;
      chip.addEventListener('click', () => {
        if (side === 'from') {
          pairFromSelected = t;
          (document.getElementById('pair-from-addr') || {}).value = t.addr;
          (document.getElementById('pair-from-sym') || {}).value = t.sym;
        } else {
          pairToSelected = t;
          (document.getElementById('pair-to-addr') || {}).value = t.addr;
          (document.getElementById('pair-to-sym') || {}).value = t.sym;
        }
        renderDefaultTokenChips();
        updatePairPreview();
        haptic();
      });
      container.appendChild(chip);
    });
  });
}
