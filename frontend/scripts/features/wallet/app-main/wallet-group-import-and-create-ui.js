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

// ══════ CREATE WALLET UI ══════
let _wgCreatedWallets = []; // [{privateKey, address}]

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
  const nameEl = document.getElementById('wg-create-name-input');
  const countEl = document.getElementById('wg-create-count-input');
  if (nameEl) nameEl.value = '';
  if (countEl) countEl.value = '';
  const previewEl = document.getElementById('wg-create-preview');
  if (previewEl) previewEl.style.display = 'none';
  const saveBtn = document.getElementById('wg-create-save-btn');
  if (saveBtn) { saveBtn.style.display = 'none'; saveBtn.style.opacity = '0.5'; saveBtn.style.pointerEvents = 'none'; }
  const badge = document.getElementById('wg-create-count-badge');
  if (badge) badge.style.display = 'none';
  const listEl = document.getElementById('wg-create-wallet-list');
  if (listEl) listEl.innerHTML = '';
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
  document.getElementById('wg-create-overlay')?.classList.remove('open');
  _wgCreatedWallets = [];
  haptic();
  // ── Return to Import Wallet Group ──
  document.getElementById('wg-import-overlay')?.classList.add('open');
}

function wgCreateSetCount(n) {
  const el = document.getElementById('wg-create-count-input');
  if (el) { el.value = n; }
  _wgCreateSyncPresets();
  _wgCreateUpdateBtn();
  haptic();
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
  const saveBtn = document.getElementById('wg-create-save-btn');
  const genOk = name.length > 0 && cnt >= 1;
  if (genBtn) {
    genBtn.style.opacity = genOk ? '1' : '0.5';
    genBtn.style.pointerEvents = genOk ? 'auto' : 'none';
  }
  // Save button: only enable if name filled AND wallets already generated
  const saveOk = name.length > 0 && _wgCreatedWallets.length > 0;
  if (saveBtn && saveBtn.style.display !== 'none') {
    saveBtn.style.opacity = saveOk ? '1' : '0.5';
    saveBtn.style.pointerEvents = saveOk ? 'auto' : 'none';
  }
}

async function wgGenerateWallets() {
  const name = (document.getElementById('wg-create-name-input')?.value || '').trim();
  const cnt = parseInt(document.getElementById('wg-create-count-input')?.value || '0');
  if (!name) { showToast('Group name দাও', 'error'); return; }
  if (!cnt || cnt < 1) { showToast('কমপক্ষে 1 দাও', 'error'); return; }

  const genBtn = document.getElementById('wg-create-gen-btn');
  if (genBtn) { genBtn.textContent = ''; genBtn.innerHTML = '<span class="material-icons-round" style="font-size:18px;animation:spin 0.8s linear infinite;">autorenew</span> GENERATING\u2026'; genBtn.style.pointerEvents = 'none'; }

  const listEl = document.getElementById('wg-create-wallet-list');
  const previewEl = document.getElementById('wg-create-preview');
  if (previewEl) previewEl.style.display = 'flex';
  if (listEl) listEl.innerHTML = '';

  _wgCreatedWallets = [];
  const CHUNK = 50;

  try {
    for (let i = 0; i < cnt; i += CHUNK) {
      const end = Math.min(i + CHUNK, cnt);
      for (let j = i; j < end; j++) {
        const w = ethers.Wallet.createRandom();
        _wgCreatedWallets.push({ privateKey: w.privateKey, address: w.address, mnemonic: w.mnemonic?.phrase || '' });
      }
      // Progress on button
      if (genBtn) genBtn.innerHTML = '<span class="material-icons-round" style="font-size:18px;animation:spin 0.8s linear infinite;">autorenew</span> ' + _wgCreatedWallets.length + '/' + cnt + '\u2026';
      // Yield — keep UI responsive
      await new Promise(r => setTimeout(r, 0));
    }

    // Render preview (max 200 rows to avoid DOM bloat)
    if (listEl) {
      const display = _wgCreatedWallets.slice(0, 200);
      listEl.innerHTML = display.map((w, i) =>
        `<div class="wg-create-wallet-row">
          <div class="wg-create-idx">#${i + 1}</div>
          <div class="wg-create-addr">${w.address}</div>
        </div>`
      ).join('') + (cnt > 200 ? `<div class="wg-create-wallet-row" style="justify-content:center;color:var(--text-muted);font-size:11px;">\u2026 and ${cnt - 200} more</div>` : '');
    }

    const badge = document.getElementById('wg-create-count-badge');
    if (badge) { badge.style.display = 'inline-block'; badge.textContent = cnt + ' WALLET' + (cnt !== 1 ? 'S' : ''); }

    const saveBtn = document.getElementById('wg-create-save-btn');
    if (saveBtn) { saveBtn.style.display = 'flex'; saveBtn.style.opacity = '1'; saveBtn.style.pointerEvents = 'auto'; }

    if (genBtn) { genBtn.innerHTML = '<span class="material-icons-round" style="font-size:18px;">auto_awesome</span>GENERATE'; genBtn.style.pointerEvents = 'auto'; }

    haptic();
    showToast(cnt + ' wallet generated \u2713', 'check_circle');
  } catch(err) {
    if (genBtn) { genBtn.innerHTML = '<span class="material-icons-round" style="font-size:18px;">auto_awesome</span>GENERATE'; genBtn.style.pointerEvents = 'auto'; }
    showToast('Generate failed: ' + err.message, 'error');
  }
}
