// ── Copy All ──────────────────────────────────────────────────
function cwCopyAll() {
  let addrs = [];
  if (_cwExpandedGroupId) {
    // Key list view: copy selected keys only, or all if none selected
    const groups = loadWalletGroups();
    const g = groups.find(g => g.id === _cwExpandedGroupId);
    if (g) {
      const selSet = _cwGetSelectedKeys(_cwExpandedGroupId);
      const keys = selSet.size > 0 ? g.keys.filter((_, i) => selSet.has(i)) : g.keys;
      addrs = keys.map(pk => { try { return new ethers.Wallet(pk).address; } catch { return null; } }).filter(Boolean);
    }
  } else {
    // Group list view: copy from selected groups only, or all if none selected
    const groups = loadWalletGroups();
    const seen = new Set();
    const activeGroups = selectedGroupIds.length > 0
      ? groups.filter(g => selectedGroupIds.includes(g.id))
      : groups;
    activeGroups.forEach(g => {
      const selSet = _cwGetSelectedKeys(g.id);
      const keys = selSet.size > 0 ? g.keys.filter((_, i) => selSet.has(i)) : g.keys;
      keys.forEach(pk => {
        try {
          const addr = new ethers.Wallet(pk).address;
          if (!seen.has(addr)) { seen.add(addr); addrs.push(addr); }
        } catch {}
      });
    });
  }
  if (!addrs.length) return;
  const text = addrs.join('\n');
  navigator.clipboard?.writeText(text).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta);
    ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
  });
  showToast(addrs.length + ' addresses copied!', 'copy_all');
  haptic();
}

function copyAllAddresses() {
  // Use settingsKeys (Settings selected groups) — completely separate from swap's validatedKeys
  var keysToUse = (typeof settingsKeys !== 'undefined' && settingsKeys.length > 0)
    ? settingsKeys
    : (typeof validatedKeys !== 'undefined' ? validatedKeys : []);
  if (keysToUse.length === 0) { showToast('No groups selected in Settings', 'warning'); return; }
  const addrs = [];
  keysToUse.forEach(pk => {
    try { addrs.push(new ethers.Wallet(pk).address); } catch {}
  });
  if (addrs.length === 0) return;
  const text = addrs.join('\n');
  navigator.clipboard?.writeText(text).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta);
    ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
  });
  const btn = document.getElementById('addr-copy-all-btn');
  if (btn) {
    btn.style.background = 'rgba(16,185,129,0.3)';
    btn.style.borderColor = 'rgba(16,185,129,0.6)';
    btn.innerHTML = '<span class="material-icons-round" style="font-size:13px;">check</span>COPIED!';
    setTimeout(() => {
      btn.style.background = 'rgba(16,185,129,0.12)';
      btn.style.borderColor = 'rgba(16,185,129,0.3)';
      btn.innerHTML = '<span class="material-icons-round" style="font-size:13px;">copy_all</span>COPY ALL';
    }, 2000);
  }
  showToast('All ' + addrs.length + ' addresses copied!', 'copy_all');
  haptic();
}


