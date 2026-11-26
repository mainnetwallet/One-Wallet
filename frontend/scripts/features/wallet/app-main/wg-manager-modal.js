// ── Wallet Group Manager Modal ──
function openWgManager() {
  renderWgManagerList();
  document.getElementById('wgm-overlay')?.classList.add('open');
  haptic();
}

function closeWgManager() {
  document.getElementById('wgm-overlay')?.classList.remove('open');
  haptic();
}

function renderWgManagerList() {
  const list = document.getElementById('wgm-list');
  const empty = document.getElementById('wgm-empty');
  const badge = document.getElementById('wgm-count-badge');
  const groups = loadWalletGroups();

  if (badge) badge.textContent = groups.length + ' GROUP' + (groups.length !== 1 ? 'S' : '');

  if (groups.length === 0) {
    if (list) list.style.display = 'none';
    if (empty) empty.style.display = 'block';
    return;
  }

  if (empty) empty.style.display = 'none';
  if (list) list.style.display = 'flex';
  if (list) list.innerHTML = '';

  groups.forEach((g, i) => {
    const date = new Date(g.createdAt).toLocaleDateString();
    const item = document.createElement('div');
    item.style.cssText = 'background:var(--bg-glass);border:1px solid var(--border-subtle);border-radius:var(--radius-md);overflow:hidden;animation:slideIn 0.25s ease both;';
    item.style.animationDelay = (i * 0.05) + 's';
    item.innerHTML = `
      <!-- Group info row -->
      <div style="display:flex;align-items:center;gap:12px;padding:14px 16px;">
        <div style="width:40px;height:40px;border-radius:12px;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <span class="material-icons-round" style="font-size:20px;color:var(--accent-primary);">folder</span>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${g.name}</div>
          <div style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);margin-top:2px;">${g.keys.length} keys · ${date}</div>
        </div>
        <div style="padding:3px 9px;border-radius:7px;background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.25);font-size:9px;font-weight:800;color:var(--neon-purple);font-family:var(--font-mono);flex-shrink:0;">${g.keys.length} KEYS</div>
      </div>
      <!-- Action buttons -->
      <div style="display:flex;border-top:1px solid var(--border-subtle);">
        <div onclick="wgmRename('${g.id}')" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:11px 8px;cursor:pointer;background:transparent;transition:background 0.2s;border-right:1px solid var(--border-subtle);" onmousedown="this.style.background='rgba(99,102,241,0.1)'" onmouseup="this.style.background=''" ontouchstart="this.style.background='rgba(99,102,241,0.1)'" ontouchend="this.style.background=''">
          <span class="material-icons-round" style="font-size:15px;color:var(--accent-primary);">edit</span>
          <span style="font-size:11px;font-weight:700;color:var(--accent-primary);font-family:var(--font-mono);letter-spacing:0.5px;">RENAME</span>
        </div>
        <div onclick="wgmEditKeys('${g.id}')" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:11px 8px;cursor:pointer;background:transparent;transition:background 0.2s;border-right:1px solid var(--border-subtle);" onmousedown="this.style.background='rgba(245,158,11,0.1)'" onmouseup="this.style.background=''" ontouchstart="this.style.background='rgba(245,158,11,0.1)'" ontouchend="this.style.background=''">
          <span class="material-icons-round" style="font-size:15px;color:var(--accent-amber);">edit</span>
          <span style="font-size:11px;font-weight:700;color:var(--accent-amber);font-family:var(--font-mono);letter-spacing:0.5px;">EDIT</span>
        </div>
        <div onclick="wgmDelete('${g.id}')" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:11px 8px;cursor:pointer;background:transparent;transition:background 0.2s;" onmousedown="this.style.background='rgba(244,63,94,0.1)'" onmouseup="this.style.background=''" ontouchstart="this.style.background='rgba(244,63,94,0.1)'" ontouchend="this.style.background=''">
          <span class="material-icons-round" style="font-size:15px;color:var(--accent-red);">delete</span>
          <span style="font-size:11px;font-weight:700;color:var(--accent-red);font-family:var(--font-mono);letter-spacing:0.5px;">DELETE</span>
        </div>
      </div>
    `;
    list.appendChild(item);
  });
}

function wgmRename(id) {
  // Close manager, open rename modal
  document.getElementById('wgm-overlay')?.classList.remove('open');
  setTimeout(() => {
    openWgEditModal(id);
  }, 200);
  haptic();
}

function wgmDelete(id) {
  const groups = loadWalletGroups();
  const g = groups.find(g => g.id === id);
  if (!g) return;

  // ── Confirmation sheet ──
  const sheet = document.createElement('div');
  sheet.id = 'wgm-delete-sheet';
  sheet.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;background:rgba(0,0,0,0.7);display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(4px);';
  sheet.innerHTML = `
    <div style="width:100%;max-width:480px;background:var(--bg-surface,#0f0f1a);border-radius:24px 24px 0 0;padding:24px 20px 40px;border-top:1px solid rgba(244,63,94,0.3);">
      <div style="width:36px;height:4px;border-radius:2px;background:rgba(255,255,255,0.15);margin:0 auto 20px;"></div>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
        <div style="width:44px;height:44px;border-radius:14px;background:rgba(244,63,94,0.15);border:1px solid rgba(244,63,94,0.3);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <span class="material-icons-round" style="font-size:22px;color:#f43f5e;">delete_forever</span>
        </div>
        <div>
          <div style="font-size:16px;font-weight:800;color:var(--text-primary,#fff);font-family:var(--font-display,sans-serif);">Delete Group?</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.45);font-family:var(--font-mono,monospace);margin-top:2px;">${g.name}</div>
        </div>
      </div>
      <div style="font-size:12px;color:rgba(255,255,255,0.45);font-family:var(--font-mono,monospace);padding:12px 14px;background:rgba(244,63,94,0.06);border:1px solid rgba(244,63,94,0.15);border-radius:12px;margin:16px 0 20px;line-height:1.7;">
        ⚠️ ${g.keys.length} wallet${g.keys.length !== 1 ? 's' : ''} will be removed from this group.<br>If private keys are not backed up, they cannot be recovered.
      </div>
      <div style="display:flex;gap:10px;">
        <button id="_wgm_del_cancel" style="flex:1;padding:14px;border-radius:14px;border:1.5px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:var(--text-secondary,#aaa);font-family:var(--font-display,sans-serif);font-size:13px;font-weight:700;cursor:pointer;">Cancel</button>
        <button id="_wgm_del_confirm" style="flex:1;padding:14px;border-radius:14px;border:none;background:linear-gradient(135deg,#f43f5e,#e11d48);color:#fff;font-family:var(--font-display,sans-serif);font-size:13px;font-weight:800;cursor:pointer;letter-spacing:0.5px;">DELETE</button>
      </div>
    </div>`;

  document.body.appendChild(sheet);
  sheet.classList.add('open');
  const _closeDeleteSheet = () => { sheet.classList.remove('open'); if (sheet.parentNode) document.body.removeChild(sheet); haptic && haptic(); };
  sheet.querySelector('#_wgm_del_cancel').addEventListener('click', _closeDeleteSheet);
  sheet.addEventListener('click', e => { if (e.target === sheet) _closeDeleteSheet(); });
  sheet.querySelector('#_wgm_del_confirm').addEventListener('click', () => {
    _closeDeleteSheet();
    const updated = groups.filter(g => g.id !== id);
    saveWalletGroups(updated);
    const idx = selectedGroupIds.indexOf(id);
    if (idx !== -1) { selectedGroupIds.splice(idx, 1); saveSelectedGroupIds(); }
    const sidx = swapSelectedGroupIds.indexOf(id);
    if (sidx !== -1) { swapSelectedGroupIds.splice(sidx, 1); saveSwapSelectedGroupIds(); }
    if (activeGroupId === id) { activeGroupId = null; try { localStorage.removeItem(WG_ACTIVE_KEY); } catch {} }
    applySettingsGroupSelection();
    if (typeof applyMultiGroupSelection === 'function') applyMultiGroupSelection();
    renderWalletGroupsList();
    renderSwapGroupList();
    renderWgManagerList();
    showToast(g.name + ' deleted', 'delete');
    haptic && haptic();
  });
}

