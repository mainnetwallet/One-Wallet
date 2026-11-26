// ══════════════════════════════════════
// ── RECEIVE MODAL ──
// ══════════════════════════════════════

let _receiveQRInstance = null;

function openReceiveModal() {
  const groups = loadWalletGroups();
  const noWallet = document.getElementById('receive-no-wallet');
  const section  = document.getElementById('receive-wallet-section');

  if (groups.length === 0) {
    if (noWallet) noWallet.style.display = 'block';
    if (section) section.style.display = 'none';
  } else {
    if (noWallet) noWallet.style.display = 'none';
    if (section) section.style.display = 'block';

    // ── FIX: hw-group-pill এর active wallet (hwSelectedKey) use করো ──
    // hwSelectedKey = home pill এ যেই wallet connect/selected আছে সেটার private key
    const pillKey = (typeof hwSelectedKey !== 'undefined' && hwSelectedKey) ? hwSelectedKey : null;

    // pillKey থেকে group খোঁজো
    let targetGroupId = groups[0].id;
    if (pillKey) {
      const pillGroup = groups.find(g => g.keys && g.keys.includes(pillKey));
      if (pillGroup) targetGroupId = pillGroup.id;
    }

    // pillKey সহ pass করো — _receivePopulateWallets options populate করার পরেই select করবে
    _receivePopulateGroups(groups, targetGroupId, pillKey);
  }

  document.getElementById('receive-overlay')?.classList.add('open');
  // Reset any stale inline transform left by swipe-to-close gesture
  const _rcvModalEl = document.querySelector('#receive-overlay .send-modal');
  if (_rcvModalEl) _rcvModalEl.style.transform = '';
  haptic();
}

function openReceiveForGroup(groupId) {
  const groups = loadWalletGroups();
  const noWallet = document.getElementById('receive-no-wallet');
  const section  = document.getElementById('receive-wallet-section');

  if (groups.length === 0) {
    if (noWallet) noWallet.style.display = 'block';
    if (section) section.style.display = 'none';
  } else {
    if (noWallet) noWallet.style.display = 'none';
    if (section) section.style.display = 'block';
    _receivePopulateGroups(groups, groupId);
  }

  // Close wgm-overlay first, then open receive
  document.getElementById('wgm-overlay')?.classList.remove('open');
  setTimeout(() => {
    document.getElementById('receive-overlay')?.classList.add('open');
    // Reset any stale inline transform left by swipe-to-close gesture
    const _rcvModalEl2 = document.querySelector('#receive-overlay .send-modal');
    if (_rcvModalEl2) _rcvModalEl2.style.transform = '';
  }, 220);
  haptic();
}

function closeReceiveModal() {
  document.getElementById('receive-overlay')?.classList.remove('open');
  haptic();
}

function _receivePopulateGroups(groups, selectedGroupId, targetKey) {
  const groupSel = document.getElementById('receive-group-select');
  if (groupSel) groupSel.innerHTML = '';
  groups.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g.id;
    if (opt) opt.textContent = g.name + ' (' + g.keys.length + ')';
    if (g.id === selectedGroupId) opt.selected = true;
    groupSel.appendChild(opt);
  });
  _receivePopulateWallets(selectedGroupId, targetKey);
}

function _receivePopulateWallets(groupId, targetKey) {
  const groups = loadWalletGroups();
  const g = groups.find(x => x.id === groupId);
  const walletSel = document.getElementById('receive-wallet-select');
  if (walletSel) walletSel.innerHTML = '';
  if (!g) return;
  g.keys.forEach((k, i) => {
    try {
      const addr = new ethers.Wallet(k).address;
      const opt = document.createElement('option');
      opt.value = k;
      if (opt) opt.textContent = 'W' + (i+1) + '  ' + addr.slice(0,6) + '...' + addr.slice(-4);
      walletSel.appendChild(opt);
    } catch {}
  });
  // targetKey দেওয়া থাকলে options populate হওয়ার পরেই সেটা select করো
  if (targetKey && walletSel && Array.from(walletSel.options).some(o => o.value === targetKey)) {
    walletSel.value = targetKey;
  }
  _receiveUpdateQR();
}

function receiveOnGroupChange() {
  const groupId = document.getElementById('receive-group-select')?.value;
  // User manually changed group — targetKey নেই, first wallet দেখাবে
  _receivePopulateWallets(groupId);
}

function receiveOnWalletChange() {
  _receiveUpdateQR();
}

function _receiveUpdateQR() {
  const walletSel = document.getElementById('receive-wallet-select');
  const pk = walletSel.value;
  if (!pk) return;
  let addr = '';
  try { addr = new ethers.Wallet(pk).address; } catch { return; }

  (document.getElementById('receive-addr-text') || {}).textContent = addr;

  // Generate QR
  const canvas = document.getElementById('receive-qr-canvas');
  if (canvas) canvas.innerHTML = '';
  _receiveQRInstance = null;
  try {
    _receiveQRInstance = new QRCode(canvas, {
      text: addr,
      width: 200,
      height: 200,
      colorDark: '#000000',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M,
    });
  } catch(e) {
    if (canvas) canvas.innerHTML = '<div style="font-size:11px;color:#999;text-align:center;">QR unavailable</div>';
  }
}

function receiveCopyAddress() {
  const addr = document.getElementById('receive-addr-text')?.textContent;
  if (!addr) return;
  navigator.clipboard?.writeText(addr).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = addr; document.body.appendChild(ta);
    ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
  });
  const btn = document.getElementById('receive-copy-btn');
  if (!btn) return;
  const orig = btn.innerHTML;
  btn.style.background = 'rgba(16,185,129,0.2)';
  btn.style.borderColor = 'rgba(16,185,129,0.5)';
  btn.innerHTML = '<span class="material-icons-round" style="font-size:18px;color:var(--accent-green);">check</span><span style="font-size:12px;font-weight:700;color:var(--accent-green);font-family:var(--font-mono);">COPIED!</span>';
  setTimeout(() => {
    btn.style.background = 'rgba(99,102,241,0.15)';
    btn.style.borderColor = 'rgba(99,102,241,0.35)';
    if (btn) btn.innerHTML = orig;
  }, 2000);
  showToast('Address copied!', 'content_copy');
  haptic();
}

function receiveShareAddress() {
  const addr = document.getElementById('receive-addr-text')?.textContent;
  if (!addr) return;
  if (navigator.share) {
    navigator.share({ title: 'My EVM Address', text: addr }).catch(() => {});
  } else {
    receiveCopyAddress();
  }
  haptic();
}

