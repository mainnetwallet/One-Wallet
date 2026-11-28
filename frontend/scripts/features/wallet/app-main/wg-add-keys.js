// ── Add Keys (add 1 or many private keys to an existing group, at any position) ──
let _wgAddKeysGroupId = null;

function _wgakGroup() {
  return loadWalletGroups().find(g => g.id === _wgAddKeysGroupId) || null;
}

// Splits the textarea into new keys / duplicates / invalid lines.
function _wgakAnalyze() {
  const ta = document.getElementById('wgak-textarea');
  const g = _wgakGroup();
  const existing = new Set((g ? g.keys : []).map(k => normalizeKey(k)));
  const seen = new Set();
  const out = { fresh: [], dupExisting: 0, dupInput: 0, invalid: 0 };
  ((ta && ta.value) || '').split('\n').map(l => l.trim()).filter(Boolean).forEach(line => {
    if (!isValidPrivateKey(line)) { out.invalid++; return; }
    const k = normalizeKey(line);
    try { new ethers.Wallet(k); } catch { out.invalid++; return; }
    if (existing.has(k)) { out.dupExisting++; return; }
    if (seen.has(k)) { out.dupInput++; return; }
    seen.add(k);
    out.fresh.push(k);
  });
  return out;
}

// 0-based insert index from the position field; blank / out of range = end of the group.
function _wgakInsertIndex(len) {
  const raw = parseInt((document.getElementById('wgak-pos') || {}).value, 10);
  if (isNaN(raw) || raw > len + 1) return len;
  return Math.max(0, raw - 1);
}

function wgmAddKeys(groupId) {
  const g = loadWalletGroups().find(x => x.id === groupId);
  if (!g) return;
  _wgAddKeysGroupId = groupId;
  const ta = document.getElementById('wgak-textarea');
  if (ta) ta.value = '';
  const pos = document.getElementById('wgak-pos');
  if (pos) { pos.value = ''; pos.max = g.keys.length + 1; pos.placeholder = String(g.keys.length + 1); }
  const title = document.getElementById('wgak-title');
  if (title) title.textContent = g.name;
  const pill = document.getElementById('wgak-count-pill');
  if (pill) pill.textContent = g.keys.length + ' KEY' + (g.keys.length !== 1 ? 'S' : '');
  wgakUpdate();
  const overlay = document.getElementById('wgak-overlay');
  if (overlay) { overlay.style.display = 'flex'; overlay.classList.add('open'); }
  haptic && haptic();
}

function wgakUpdate() {
  const g = _wgakGroup();
  if (!g) return;
  const r = _wgakAnalyze();
  const n = r.fresh.length;
  const at = _wgakInsertIndex(g.keys.length);
  const hint = document.getElementById('wgak-pos-hint');
  if (hint) {
    hint.textContent = n > 0
      ? 'New keys → #' + (at + 1) + (n > 1 ? '–#' + (at + n) : '') + '  (blank = end)'
      : 'Blank = add at the end (#' + (g.keys.length + 1) + ')';
  }
  const parts = [];
  if (n) parts.push('<span style="color:#34d399;">' + n + ' new</span>');
  const dup = r.dupExisting + r.dupInput;
  if (dup) parts.push('<span style="color:var(--accent-amber);">' + dup + ' duplicate' + (dup !== 1 ? 's' : '') + ' skipped</span>');
  if (r.invalid) parts.push('<span style="color:var(--accent-red);">' + r.invalid + ' invalid</span>');
  const sum = document.getElementById('wgak-summary');
  if (sum) sum.innerHTML = parts.join(' · ');
  const btn = document.getElementById('wgak-add-btn');
  if (btn) {
    btn.textContent = n > 0 ? 'ADD ' + n + ' KEY' + (n > 1 ? 'S' : '') : 'ADD KEYS';
    btn.style.opacity = n > 0 ? '1' : '0.3';
    btn.style.pointerEvents = n > 0 ? 'auto' : 'none';
  }
}

async function wgakPaste() {
  const ta = document.getElementById('wgak-textarea');
  if (!ta) return;
  let text = '';
  try { if (navigator.clipboard && navigator.clipboard.readText) text = await navigator.clipboard.readText(); } catch (_) {}
  if (!text) {
    try { if (window.OneAndroid && typeof OneAndroid.getClipboardText === 'function') text = OneAndroid.getClipboardText() || ''; } catch (_) {}
  }
  if (!text) { showToast("Couldn't read the clipboard. Paste into the box instead.", 'error'); ta.focus(); return; }
  ta.value = ta.value && !ta.value.endsWith('\n') ? ta.value + '\n' + text : ta.value + text;
  wgakUpdate();
  haptic && haptic();
}

function wgakClear() {
  const ta = document.getElementById('wgak-textarea');
  if (ta) ta.value = '';
  wgakUpdate();
  haptic && haptic();
}

function wgakAdd() {
  if (!_wgAddKeysGroupId) return;
  const groups = loadWalletGroups();
  const g = groups.find(x => x.id === _wgAddKeysGroupId);
  if (!g) return;
  const fresh = _wgakAnalyze().fresh;
  if (!fresh.length) return;
  const oldLen = g.keys.length;
  const at = _wgakInsertIndex(oldLen);
  // Wallet names and seed phrases are index-aligned with keys: keep them aligned (new keys get none)
  [g.labels, g.mnemonics].forEach(arr => {
    if (!Array.isArray(arr) || arr.length === 0) return;
    while (arr.length < oldLen) arr.push('');
    arr.splice(at, 0, ...fresh.map(() => ''));
  });
  g.keys.splice(at, 0, ...fresh);
  saveWalletGroups(groups);
  if (typeof applySettingsGroupSelection === 'function') applySettingsGroupSelection();
  if (typeof applyMultiGroupSelection === 'function') applyMultiGroupSelection();
  if (typeof renderWalletGroupsList === 'function') renderWalletGroupsList();
  if (typeof renderSwapGroupList === 'function') renderSwapGroupList();
  if (typeof renderWgManagerList === 'function') renderWgManagerList();
  showToast(fresh.length + ' key' + (fresh.length > 1 ? 's' : '') + ' added to ' + g.name, 'check_circle');
  closeWgakModal();
  haptic && haptic();
}

function closeWgakModal() {
  const overlay = document.getElementById('wgak-overlay');
  if (overlay) { overlay.style.display = 'none'; overlay.classList.remove('open'); }
  const ta = document.getElementById('wgak-textarea');
  if (ta) ta.value = ''; // never leave pasted private keys sitting in the DOM
  _wgAddKeysGroupId = null;
  document.getElementById('wgm-overlay')?.classList.add('open');
}
