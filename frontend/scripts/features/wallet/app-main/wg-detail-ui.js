// ── Wallet Group Detail UI ──
async function openWgDetailUI(groupId) {
  const groups = loadWalletGroups();
  const g = groups.find(g => g.id === groupId);
  if (!g) return;

  const overlay  = document.getElementById('wgd-overlay');
  const title    = document.getElementById('wgd-title');
  const subtitle = document.getElementById('wgd-subtitle');
  const list     = document.getElementById('wgd-wallet-list');
  if (!overlay || !list) return;

  if (title)    title.textContent    = g.name;
  if (subtitle) subtitle.textContent = 'WALLET GROUP';
  const countPill = document.getElementById('wgd-count-pill');
  if (countPill) countPill.textContent = g.keys.length + ' WALLET' + (g.keys.length !== 1 ? 'S' : '');

  // Show overlay immediately with loading state
  list.innerHTML = `<div style="text-align:center;padding:30px;font-family:var(--font-mono);font-size:11px;color:var(--text-muted);">Loading wallets…</div>`;
  overlay.style.display = 'flex';
  overlay.classList.add('open');
  overlay.dataset.groupId = groupId;
  haptic && haptic();

  // Derive addresses in chunks to avoid UI freeze
  const CHUNK = 10;
  const wallets = [];
  for (let i = 0; i < g.keys.length; i += CHUNK) {
    const batch = g.keys.slice(i, i + CHUNK);
    for (let j = 0; j < batch.length; j++) {
      const pk = batch[j];
      let addr = '';
      try { addr = new ethers.Wallet(pk).address; } catch {}
      wallets.push({ pk, addr, i: i + j });
    }
    await new Promise(r => setTimeout(r, 0));
  }

  overlay._wallets = wallets;
  overlay._mnemonics = g.mnemonics || [];
  list.innerHTML = '';

  // Show/hide phrase button based on whether mnemonics are stored
  const phraseBtn = document.getElementById('wgd-copy-phrase-btn');
  if (phraseBtn) {
    const hasPhrases = overlay._mnemonics.some(m => m && m.trim().length > 0);
    phraseBtn.style.display = hasPhrases ? 'flex' : 'none';
  }

  wallets.forEach(({ pk, addr, i }) => {
    const shortAddr = addr ? addr.slice(0,8) + '…' + addr.slice(-6) : '—';
    const shortPk   = pk.slice(0,8) + '…' + pk.slice(-6);
    const palettes = [
      {bg:'rgba(99,102,241,0.18)',border:'rgba(99,102,241,0.4)',txt:'#a78bfa'},
      {bg:'rgba(6,182,212,0.15)',border:'rgba(6,182,212,0.35)',txt:'#22d3ee'},
      {bg:'rgba(16,185,129,0.15)',border:'rgba(16,185,129,0.35)',txt:'#34d399'},
      {bg:'rgba(245,158,11,0.15)',border:'rgba(245,158,11,0.35)',txt:'#fbbf24'},
      {bg:'rgba(244,63,94,0.15)',border:'rgba(244,63,94,0.32)',txt:'#fb7185'},
      {bg:'rgba(168,85,247,0.15)',border:'rgba(168,85,247,0.35)',txt:'#c084fc'},
    ];
    const p = palettes[i % palettes.length];
    const row = document.createElement('div');
    row.style.cssText = 'background:linear-gradient(145deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02));border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:7px 10px;display:flex;flex-direction:column;gap:5px;transition:border-color 0.2s,box-shadow 0.2s;';
    row.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;">
        <div style="width:18px;height:18px;border-radius:5px;background:${p.bg};border:1px solid ${p.border};display:flex;align-items:center;justify-content:center;font-family:var(--font-mono);font-size:9px;font-weight:900;color:${p.txt};flex-shrink:0;">${i+1}</div>
        <div class="wgd-name" style="font-size:9px;font-weight:700;color:var(--text-secondary);font-family:var(--font-mono);letter-spacing:0.8px;min-width:0;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">WALLET #${i+1}</div>
        <div style="flex:1;"></div>
        <div class="wgd-rename" role="button" aria-label="Rename wallet" style="display:flex;align-items:center;justify-content:center;width:22px;height:20px;border-radius:6px;background:rgba(99,102,241,0.09);border:1px solid rgba(99,102,241,0.2);cursor:pointer;flex-shrink:0;"><span class="material-icons-round" style="font-size:11px;color:rgba(99,102,241,0.85);">edit</span></div>
        ${addr ? `<div onclick="event.stopPropagation();(function(){var _cid=(typeof sendSelectedChainId!=='undefined'?sendSelectedChainId:8453);var _exp=window.getTHExplorer?window.getTHExplorer(_cid):'https://etherscan.io';window.open(_exp+'/address/${addr}','_blank');})()" style="display:flex;align-items:center;gap:3px;padding:2px 6px;border-radius:6px;background:rgba(99,102,241,0.09);border:1px solid rgba(99,102,241,0.2);cursor:pointer;"><span class="material-icons-round" style="font-size:9px;color:rgba(99,102,241,0.7);">open_in_new</span><span style="font-size:8px;font-family:var(--font-mono);color:rgba(99,102,241,0.6);font-weight:700;letter-spacing:0.5px;">SCAN</span></div>` : ''}
      </div>
      <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent);"></div>
      <div style="display:flex;align-items:center;gap:6px;padding:3px 8px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:7px;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:10px;font-weight:600;font-family:var(--font-mono);color:var(--text-primary);letter-spacing:0.2px;">${shortAddr}</div>
        </div>
        <div class="wgd-copy-addr" style="width:20px;height:20px;border-radius:5px;background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.24);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:all 0.18s;" onmousedown="this.style.transform='scale(0.88)';this.style.background='rgba(99,102,241,0.26)'" onmouseup="this.style.transform='';this.style.background='rgba(99,102,241,0.12)'" ontouchstart="this.style.transform='scale(0.88)';this.style.background='rgba(99,102,241,0.26)'" ontouchend="this.style.transform='';this.style.background='rgba(99,102,241,0.12)'">
          <span class="material-icons-round" style="font-size:11px;color:var(--neon-purple);">content_copy</span>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;padding:3px 8px;background:rgba(245,158,11,0.05);border:1px solid rgba(245,158,11,0.14);border-radius:7px;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:10px;font-weight:600;font-family:var(--font-mono);color:var(--accent-amber);letter-spacing:0.2px;">${shortPk}</div>
        </div>
        <div class="wgd-copy-pk" style="width:20px;height:20px;border-radius:5px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.28);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:all 0.18s;" onmousedown="this.style.transform='scale(0.88)';this.style.background='rgba(245,158,11,0.26)'" onmouseup="this.style.transform='';this.style.background='rgba(245,158,11,0.12)'" ontouchstart="this.style.transform='scale(0.88)';this.style.background='rgba(245,158,11,0.26)'" ontouchend="this.style.transform='';this.style.background='rgba(245,158,11,0.12)'">
          <span class="material-icons-round" style="font-size:11px;color:var(--accent-amber);">vpn_key</span>
        </div>
      </div>
    `;
    const nameEl = row.querySelector('.wgd-name');
    const setName = () => {
      const lg = (loadWalletGroups().find(x => x.id === groupId) || {});
      const custom = lg.labels && lg.labels[i];
      nameEl.textContent = custom ? custom : 'WALLET #' + (i + 1);
      nameEl.style.color = custom ? 'var(--text-primary)' : 'var(--text-secondary)';
    };
    setName();
    row.querySelector('.wgd-rename').addEventListener('click', e => {
      e.stopPropagation();
      haptic && haptic();
      if (window.WDU && WDU.renameWallet) WDU.renameWallet(groupId, i, setName);
    });
    row.querySelector('.wgd-copy-addr').addEventListener('click', e => {
      e.stopPropagation();
      if (!addr) return;
      navigator.clipboard?.writeText(addr).catch(() => {});
      showToast && showToast('Address copied', 'content_copy');
      haptic && haptic();
    });
    row.querySelector('.wgd-copy-pk').addEventListener('click', e => {
      e.stopPropagation();
      navigator.clipboard?.writeText(pk).catch(() => {});
      showToast && showToast('Private key copied', 'vpn_key');
      haptic && haptic();
    });
    list.appendChild(row);
  });
}

function closeWgDetailUI() {
  const overlay = document.getElementById('wgd-overlay');
  if (overlay) { overlay.style.display = 'none'; overlay.classList.remove('open'); overlay._wallets = null; overlay._mnemonics = null; }
  const phraseBtn = document.getElementById('wgd-copy-phrase-btn');
  if (phraseBtn) phraseBtn.style.display = 'none';
  // ── Return to Wallet Groups Manager ──
  document.getElementById('wgm-overlay')?.classList.add('open');
}

function wgdCopyAllAddresses() {
  const overlay = document.getElementById('wgd-overlay');
  if (!overlay || !overlay._wallets) return;
  const text = overlay._wallets.map(w => w.addr).filter(Boolean).join('\n');
  navigator.clipboard?.writeText(text).catch(() => {});
  showToast && showToast('All addresses copied (' + overlay._wallets.length + ')', 'content_copy');
  haptic && haptic();
}

function wgdCopyAllKeys() {
  const overlay = document.getElementById('wgd-overlay');
  if (!overlay || !overlay._wallets) return;
  const text = overlay._wallets.map(w => w.pk).join('\n');
  navigator.clipboard?.writeText(text).catch(() => {});
  showToast && showToast('All private keys copied (' + overlay._wallets.length + ')', 'vpn_key');
  haptic && haptic();
}

function wgdCopyAllPhrases() {
  const overlay = document.getElementById('wgd-overlay');
  if (!overlay || !overlay._mnemonics) return;
  const phrases = overlay._mnemonics.filter(m => m && m.trim().length > 0);
  if (!phrases.length) { showToast && showToast('No phrases stored in this group', 'error'); return; }
  navigator.clipboard?.writeText(phrases.join('\n')).catch(() => {});
  showToast && showToast('All phrases copied (' + phrases.length + ')', 'menu_book');
  haptic && haptic();
}




function toggleWalletGroup(id) {
  const idx = selectedGroupIds.indexOf(id);
  if (idx !== -1) {
    // Deselect
    selectedGroupIds.splice(idx, 1);
    saveSelectedGroupIds();
    applySettingsGroupSelection();
    renderWalletGroupsList();
    showToast('Group deselected', 'folder');
  } else {
    // Select (add to multi-select)
    selectedGroupIds.push(id);
    saveSelectedGroupIds();
    applySettingsGroupSelection();
    renderWalletGroupsList();
    showToast('Group selected', 'folder_special');
  }
  haptic();
}



