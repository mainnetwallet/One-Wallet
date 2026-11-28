// ════════════════════════════════════════════════
//  IMPORT WALLET GROUP — Tabbed (Private Key + Mnemonic)
// ════════════════════════════════════════════════

let _wgActiveTab = 'pk';        // 'pk' | 'mn'
let _wgWordCount = 12;          // 12 | 15 | 18 | 24
let _wgDerivedKeys = [];        // keys derived from mnemonic

// ── Open / Close ──
function openWgImportModal() {
  const _hasLock = !!localStorage.getItem('one_lock_pin') || !!localStorage.getItem('one_lock_pat') || !!localStorage.getItem('one_lock_cred_id');
  if (!_hasLock) {
    setTimeout(function() {
      if (typeof oneLock !== 'undefined' && typeof oneLock.openSetup === 'function') {
        oneLock._pendingAfterSetup = function() { openWgImportModal(); };
        oneLock.openSetup();
      }
    }, 150);
    return;
  }
  // Dismiss keyboard before opening overlay
  if (document.activeElement && typeof document.activeElement.blur === 'function') {
    document.activeElement.blur();
  }
  document.getElementById('wg-import-overlay')?.classList.add('open');
  haptic();
}

function closeWgImportModal() {
  document.getElementById('wg-import-overlay')?.classList.remove('open');
  _wgDerivedKeys = [];
  haptic();
}

// ══════ CREATE WALLET UI (step 1: setup, step 2: review) ══════
let _wgCreatedWallets = []; // [{privateKey, address, mnemonic}]
let _wgCreateStepNo = 1;
let _wgCreateExpanded = false;
const _WGC_COLLAPSED_ROWS = 5;

function _wgCreateShowStep(n) {
  _wgCreateStepNo = n;
  const s1 = document.getElementById('wg-create-step1');
  const s2 = document.getElementById('wg-create-step2');
  if (s1) s1.style.display = n === 1 ? 'flex' : 'none';
  if (s2) s2.style.display = n === 2 ? 'flex' : 'none';
  const lbl = document.getElementById('wg-create-step-label');
  if (lbl) lbl.textContent = 'Step ' + n + ' of 2';
  const title = document.getElementById('wg-create-title');
  if (title) title.textContent = n === 1 ? 'Create wallets' : 'Review wallets';
  const body = document.querySelector('#wg-create-overlay .send-body');
  if (body) body.scrollTop = 0;
}

function openWgCreateUI() {
  const _hasLock = !!localStorage.getItem('one_lock_pin') || !!localStorage.getItem('one_lock_pat') || !!localStorage.getItem('one_lock_cred_id');
  if (!_hasLock) {
    setTimeout(function() {
      if (typeof oneLock !== 'undefined' && typeof oneLock.openSetup === 'function') {
        oneLock._pendingAfterSetup = function() { openWgCreateUI(); };
        oneLock.openSetup();
      }
    }, 150);
    return;
  }
  // Reset state
  _wgCreatedWallets = [];
  _wgCreateExpanded = false;
  const nameEl = document.getElementById('wg-create-name-input');
  const countEl = document.getElementById('wg-create-count-input');
  if (nameEl) nameEl.value = '';
  if (countEl) countEl.value = '10';
  const listEl = document.getElementById('wg-create-wallet-list');
  if (listEl) listEl.innerHTML = '';
  _wgCreateShowStep(1);
  // Dismiss keyboard before opening overlay
  if (document.activeElement && typeof document.activeElement.blur === 'function') {
    document.activeElement.blur();
  }
  _wgCreateSyncPresets();
  _wgCreateUpdateBtn();
  document.getElementById('wg-create-overlay')?.classList.add('open');
  haptic();
}

function closeWgCreateUI() {
  // Back from the review step goes to setup (generated wallets are discarded, nothing was saved yet)
  if (_wgCreateStepNo === 2) {
    _wgCreatedWallets = [];
    _wgCreateExpanded = false;
    const listEl = document.getElementById('wg-create-wallet-list');
    if (listEl) listEl.innerHTML = '';
    _wgCreateShowStep(1);
    _wgCreateUpdateBtn();
    haptic();
    return;
  }
  document.getElementById('wg-create-overlay')?.classList.remove('open');
  _wgCreatedWallets = [];
  haptic();
  // ── Return to Import Wallet Group ──
  document.getElementById('wg-import-overlay')?.classList.add('open');
}

function wgCreateSetName(v) {
  const el = document.getElementById('wg-create-name-input');
  if (el) el.value = v;
  _wgCreateUpdateBtn();
  haptic();
}

function wgCreateSetCount(n) {
  const el = document.getElementById('wg-create-count-input');
  if (el) { el.value = n; }
  _wgCreateSyncPresets();
  _wgCreateUpdateBtn();
  haptic();
}

function wgCreateStep(delta) {
  const el = document.getElementById('wg-create-count-input');
  const cur = parseInt(el?.value || '0') || 0;
  wgCreateSetCount(Math.max(1, cur + delta));
}

function _wgCreateSyncPresets() {
  const val = parseInt(document.getElementById('wg-create-count-input')?.value || '0');
  [1, 5, 10, 25, 50, 100].forEach(n => {
    document.getElementById('wgcp-' + n)?.classList.toggle('active', val === n);
  });
}

function _wgCreateUpdateBtn() {
  const name = (document.getElementById('wg-create-name-input')?.value || '').trim();
  const cnt = parseInt(document.getElementById('wg-create-count-input')?.value || '0');
  const genBtn = document.getElementById('wg-create-gen-btn');
  const genOk = name.length > 0 && cnt >= 1;
  const label = document.getElementById('wg-create-gen-label');
  if (label) label.textContent = cnt >= 1 ? 'Generate ' + cnt + ' wallet' + (cnt !== 1 ? 's' : '') : 'Generate wallets';
  const sub = document.getElementById('wg-create-count-sub');
  if (sub) sub.textContent = cnt === 1 ? 'wallet' : 'wallets';
  if (genBtn) {
    genBtn.style.opacity = genOk ? '1' : '0.5';
    genBtn.style.pointerEvents = genOk ? 'auto' : 'none';
  }
}

function _wgCreateShortAddr(a) {
  return a && a.length > 14 ? a.slice(0, 6) + '\u2026' + a.slice(-4) : (a || '');
}

function _wgCreateRenderList() {
  const listEl = document.getElementById('wg-create-wallet-list');
  const moreBtn = document.getElementById('wg-create-more-btn');
  if (!listEl) return;
  const total = _wgCreatedWallets.length;
  const cap = Math.min(total, 200); // max 200 rows to avoid DOM bloat
  const shown = _wgCreateExpanded ? cap : Math.min(cap, _WGC_COLLAPSED_ROWS);
  let html = '';
  for (let i = 0; i < shown; i++) {
    const w = _wgCreatedWallets[i];
    html += '<div class="wg-create-wallet-row">' +
      '<div class="wgc-idx">' + String(i + 1).padStart(2, '0') + '</div>' +
      '<div class="wgc-row-txt"><div class="wgc-row-name">Wallet ' + (i + 1) + '</div>' +
      '<div class="wgc-row-addr wgc-mono">' + _wgCreateShortAddr(w.address) + '</div></div>' +
      '<button type="button" class="wgc-copy" aria-label="Copy address" onclick="wgCreateCopyAddr(' + i + ')"><span class="material-icons-round">content_copy</span></button>' +
      '</div>';
  }
  if (_wgCreateExpanded && total > cap) {
    html += '<div class="wg-create-wallet-row" style="justify-content:center;color:var(--text-secondary);font-size:13px;">\u2026 and ' + (total - cap) + ' more (all are saved with the group)</div>';
  }
  listEl.innerHTML = html;
  if (moreBtn) {
    if (cap > _WGC_COLLAPSED_ROWS) {
      moreBtn.style.display = 'block';
      moreBtn.textContent = _wgCreateExpanded ? 'Show less' : 'Show ' + (cap - _WGC_COLLAPSED_ROWS) + ' more';
    } else {
      moreBtn.style.display = 'none';
    }
  }
}

function wgCreateToggleMore() {
  _wgCreateExpanded = !_wgCreateExpanded;
  _wgCreateRenderList();
  haptic();
}

function wgCreateCopyAddr(i) {
  const w = _wgCreatedWallets[i];
  if (!w) return;
  try {
    navigator.clipboard.writeText(w.address).then(() => {
      showToast('Address copied', 'check_circle');
      haptic();
    }, () => showToast('Copy failed', 'error'));
  } catch (e) {
    showToast('Copy failed', 'error');
  }
}

async function wgGenerateWallets() {
  const name = (document.getElementById('wg-create-name-input')?.value || '').trim();
  const cnt = parseInt(document.getElementById('wg-create-count-input')?.value || '0');
  if (!name) { showToast('Enter a group name', 'error'); return; }
  if (!cnt || cnt < 1) { showToast('Enter at least 1 wallet', 'error'); return; }

  const genBtn = document.getElementById('wg-create-gen-btn');
  const genIdle = '<span class="material-icons-round">auto_awesome</span><span id="wg-create-gen-label"></span>';
  if (genBtn) { genBtn.innerHTML = '<span class="material-icons-round" style="animation:spin 0.8s linear infinite;">autorenew</span><span>Generating\u2026</span>'; genBtn.style.pointerEvents = 'none'; }

  _wgCreatedWallets = [];
  _wgCreateExpanded = false;
  const CHUNK = 50;

  try {
    for (let i = 0; i < cnt; i += CHUNK) {
      const end = Math.min(i + CHUNK, cnt);
      for (let j = i; j < end; j++) {
        const w = ethers.Wallet.createRandom();
        _wgCreatedWallets.push({ privateKey: w.privateKey, address: w.address, mnemonic: w.mnemonic?.phrase || '' });
      }
      // Progress on button
      if (genBtn) genBtn.innerHTML = '<span class="material-icons-round" style="animation:spin 0.8s linear infinite;">autorenew</span><span>' + _wgCreatedWallets.length + '/' + cnt + '\u2026</span>';
      // Yield - keep UI responsive
      await new Promise(r => setTimeout(r, 0));
    }

    const title = document.getElementById('wg-create-done-title');
    if (title) title.textContent = cnt + ' wallet' + (cnt !== 1 ? 's' : '') + ' generated';
    const sub = document.getElementById('wg-create-done-sub');
    if (sub) sub.textContent = 'Group: ' + name;
    _wgCreateRenderList();
    _wgCreateShowStep(2);

    if (genBtn) { genBtn.innerHTML = genIdle; genBtn.style.pointerEvents = 'auto'; }
    _wgCreateUpdateBtn();

    haptic();
    showToast(cnt + ' wallet' + (cnt !== 1 ? 's' : '') + ' generated', 'check_circle');
  } catch(err) {
    if (genBtn) { genBtn.innerHTML = genIdle; genBtn.style.pointerEvents = 'auto'; }
    _wgCreateUpdateBtn();
    showToast('Generate failed: ' + err.message, 'error');
  }
}
