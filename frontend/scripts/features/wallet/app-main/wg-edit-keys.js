// ── Edit Keys (remove selected keys from group) ──
let _wgEditKeysGroupId = null;
let _wgEditKeysSelected = new Set();

function wgmEditKeys(groupId) {
  _wgEditKeysGroupId = groupId;
  _wgEditKeysSelected = new Set();
  const groups = loadWalletGroups();
  const g = groups.find(g => g.id === groupId);
  if (!g) return;

  const overlay = document.getElementById('wgek-overlay');
  const title   = document.getElementById('wgek-title');
  const list    = document.getElementById('wgek-key-list');
  const removeBtn = document.getElementById('wgek-remove-btn');

  if (title) title.textContent = g.name;
  if (removeBtn) { removeBtn.textContent = 'REMOVE SELECTED'; removeBtn.style.opacity = '0.4'; removeBtn.style.pointerEvents = 'none'; }

  if (list) {
    list.innerHTML = '';
    if (g.keys.length === 0) {
      list.innerHTML = '<div style="text-align:center;color:var(--text-muted);font-size:12px;padding:24px 0;">No keys in this group</div>';
    } else {
      g.keys.forEach((pk, idx) => {
        let addr = '—';
        try { addr = new ethers.Wallet(pk).address; } catch {}
        const short = addr !== '—' ? addr.slice(0,6) + '…' + addr.slice(-4) : '—';
        const pkShort = pk.slice(0,6) + '…' + pk.slice(-4);

        const row = document.createElement('div');
        row.dataset.idx = idx;
        row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:11px 14px;border-radius:10px;border:1px solid var(--border-subtle);background:var(--bg-glass);cursor:pointer;transition:all 0.18s;margin-bottom:8px;';
        row.innerHTML = `
          <div id="wgek-chk-${idx}" style="width:20px;height:20px;border-radius:6px;border:2px solid var(--border-subtle);background:transparent;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.18s;">
            <span class="material-icons-round" style="font-size:13px;color:#fff;display:none;">check</span>
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:12px;font-weight:700;font-family:var(--font-mono);color:var(--text-primary);">${short}</div>
            <div style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);margin-top:2px;">pk: ${pkShort}</div>
          </div>
        `;
        row.addEventListener('click', () => {
          const chk = document.getElementById('wgek-chk-' + idx);
          if (_wgEditKeysSelected.has(idx)) {
            _wgEditKeysSelected.delete(idx);
            row.style.border = '1px solid var(--border-subtle)';
            row.style.background = 'var(--bg-glass)';
            if (chk) { chk.style.background = 'transparent'; chk.style.borderColor = 'var(--border-subtle)'; chk.querySelector('span').style.display = 'none'; }
          } else {
            _wgEditKeysSelected.add(idx);
            row.style.border = '1px solid var(--accent-red)';
            row.style.background = 'rgba(244,63,94,0.08)';
            if (chk) { chk.style.background = 'var(--accent-red)'; chk.style.borderColor = 'var(--accent-red)'; chk.querySelector('span').style.display = 'block'; }
          }
          const n = _wgEditKeysSelected.size;
          if (removeBtn) {
            removeBtn.textContent = n > 0 ? 'REMOVE ' + n + ' KEY' + (n > 1 ? 'S' : '') : 'REMOVE SELECTED';
            removeBtn.style.opacity = n > 0 ? '1' : '0.4';
            removeBtn.style.pointerEvents = n > 0 ? 'auto' : 'none';
          }
          haptic && haptic();
        });
        list.appendChild(row);
      });
    }
  }

  if (overlay) { overlay.style.display = 'flex'; overlay.classList.add('open'); }
  haptic && haptic();
}