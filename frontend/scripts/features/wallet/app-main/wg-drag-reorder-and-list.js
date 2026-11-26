
// ── Wallet Group Drag-to-Reorder ──
(function() {
  let _drag = null; // { el, groupId, startY, startIdx, cloneEl, listEl, placeholder }

  function _getDragOrder(listEl) {
    return Array.from(listEl.querySelectorAll('.wg-card[data-gid]')).map(el => el.dataset.gid);
  }

  function _cleanDrag() {
    if (!_drag) return;
    try { _drag.cloneEl && _drag.cloneEl.remove(); } catch(_) {}
    try { _drag.placeholder && _drag.placeholder.remove(); } catch(_) {}
    if (_drag.el) {
      _drag.el.style.opacity = '';
      _drag.el.style.pointerEvents = '';
    }
    _drag = null;
  }

  function _startDrag(e, card, listEl) {
    if (_drag) _cleanDrag();
    const touch = e.touches ? e.touches[0] : e;
    const rect  = card.getBoundingClientRect();
    const listRect = listEl.getBoundingClientRect();

    // Clone for floating ghost
    const clone = card.cloneNode(true);
    clone.style.cssText += `;
      position:fixed;left:${rect.left}px;top:${rect.top}px;
      width:${rect.width}px;z-index:9999;pointer-events:none;
      box-shadow:0 8px 32px rgba(99,102,241,0.45),0 2px 8px rgba(0,0,0,0.5);
      border-color:rgba(99,102,241,0.7)!important;
      transform:scale(1.025);opacity:0.97;
      transition:box-shadow 0.15s,transform 0.15s;
    `;
    document.body.appendChild(clone);

    // Placeholder (same height, invisible)
    const ph = document.createElement('div');
    ph.style.cssText = `height:${rect.height}px;border-radius:16px;
      background:rgba(99,102,241,0.08);border:2px dashed rgba(99,102,241,0.35);
      margin-bottom:10px;transition:none;box-sizing:border-box;`;
    card.parentNode.insertBefore(ph, card);

    card.style.opacity = '0';
    card.style.pointerEvents = 'none';

    const cards = Array.from(listEl.querySelectorAll('.wg-card[data-gid]'));
    _drag = {
      el: card,
      groupId: card.dataset.gid,
      startY: touch.clientY,
      offsetY: touch.clientY - rect.top,
      cloneEl: clone,
      placeholder: ph,
      listEl,
      listRect,
      cards,
      currentIdx: cards.indexOf(card),
    };

    haptic && haptic();
  }

  function _onMove(e) {
    if (!_drag) return;
    e.preventDefault();
    const touch = e.touches ? e.touches[0] : e;
    const y = touch.clientY;

    // Move ghost
    _drag.cloneEl.style.top = (y - _drag.offsetY) + 'px';

    // Find insertion position by comparing midpoints of sibling cards
    const listEl = _drag.listEl;
    const ph = _drag.placeholder;
    const siblings = Array.from(listEl.querySelectorAll('.wg-card[data-gid]')).filter(c => c !== _drag.el);

    let insertBefore = null;
    for (const sib of siblings) {
      const sr = sib.getBoundingClientRect();
      if (y < sr.top + sr.height / 2) { insertBefore = sib; break; }
    }

    if (insertBefore) {
      listEl.insertBefore(ph, insertBefore);
    } else {
      listEl.appendChild(ph);
    }
  }

  function _onEnd(e) {
    if (!_drag) return;
    const listEl = _drag.listEl;
    const ph = _drag.placeholder;
    const card = _drag.el;

    // Insert card at placeholder position, then remove placeholder
    listEl.insertBefore(card, ph);
    ph.remove();
    card.style.opacity = '';
    card.style.pointerEvents = '';
    _drag.cloneEl.remove();

    // Read new order from DOM
    const newOrder = Array.from(listEl.querySelectorAll('.wg-card[data-gid]')).map(el => el.dataset.gid);
    const groups = loadWalletGroups();
    const oldOrder = groups.map(g => g.id);
    const orderChanged = newOrder.some((id, i) => id !== oldOrder[i]);

    if (orderChanged) {
      const reordered = newOrder.map(id => groups.find(g => g.id === id)).filter(Boolean);
      groups.forEach(g => { if (!reordered.find(r => r.id === g.id)) reordered.push(g); });
      saveWalletGroups(reordered);
      haptic && haptic();
      showToast && showToast('Order saved', 'swap_vert');
    }

    _drag = null;
    setTimeout(() => renderWalletGroupsList(), 200);
  }

  window._wgDragStart = _startDrag;
  window._wgDragMove  = _onMove;
  window._wgDragEnd   = _onEnd;
  window._wgCleanDrag = _cleanDrag;

  // Global move/end listeners (attached once)
  document.addEventListener('touchmove',  e => _drag && _onMove(e), { passive: false });
  document.addEventListener('touchend',   e => _drag && _onEnd(e),  { passive: true  });
  document.addEventListener('touchcancel',e => { if (_drag) { _cleanDrag(); } }, { passive: true });
  document.addEventListener('mousemove',  e => _drag && _onMove(e));
  document.addEventListener('mouseup',    e => _drag && _onEnd(e));
})();

function renderWalletGroupsList() {
  const list = document.getElementById('wg-list');
  const totalBadge = document.getElementById('wg-total-badge');
  const groups = loadWalletGroups();
  const n = groups.length;

  if (totalBadge) totalBadge.textContent = n + ' GROUP' + (n !== 1 ? 'S' : '');

  // Update Manage button — enabled only when at least one group is selected
  _updateWgManageBtn();



  if (!list) return;
  list.innerHTML = '';

  if (n === 0) {
    list.innerHTML = `<div style="text-align:center;padding:30px 0 10px;font-family:var(--font-mono);font-size:11px;color:var(--text-muted);letter-spacing:1px;line-height:2;">
      <div style="font-size:28px;margin-bottom:8px;">📁</div>
      NO WALLET GROUPS YET<br>
      <span style="font-size:10px;opacity:0.6;">Tap "Import Wallet Group" above to add one</span>
    </div>`;
    return;
  }

  groups.forEach((g, idx) => {
    const clr = WG_COLORS[idx % WG_COLORS.length];
    const date = new Date(g.createdAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'2-digit'});
    const emoji = g.emoji || '';
    const card = document.createElement('div');
    card.className = 'wg-card';
    card.id = 'wg-card-' + g.id;
    card.dataset.gid = g.id;

    // Build address rows HTML
    const addrRowsHtml = g.keys.map((pk, i) => {
      let addr = '';
      try { addr = new ethers.Wallet(pk).address; } catch {}
      const short = addr ? addr.slice(0,8) + '…' + addr.slice(-6) : '—';
      return `<div class="wg-addr-row" data-addr="${addr}"
          onmousedown="this.style.background='rgba(34,211,238,0.07)'" onmouseup="this.style.background=''"
          ontouchstart="this.style.background='rgba(34,211,238,0.07)'" ontouchend="this.style.background=''">
          <div class="wg-addr-num">${i+1}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:10px;font-weight:600;color:var(--text-secondary);">Wallet #${i+1}</div>
            <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${short}</div>
          </div>
          <span class="material-icons-round" style="font-size:14px;color:var(--text-muted);flex-shrink:0;">content_copy</span>
        </div>`;
    }).join('');

    card.innerHTML = `
      <!-- ── Card header ── -->
      <div class="wg-header" id="wg-header-${g.id}" style="cursor:pointer;user-select:none;">
        <div class="wg-num-badge" style="background:${clr.num};">
          ${emoji || String(idx+1).padStart(2,'0')}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:6px;">
            <div class="wg-name">${g.name}</div>
          </div>
          <div class="wg-meta" style="display:flex;align-items:center;gap:6px;margin-top:3px;">
            <span style="color:${clr.accent};font-weight:700;">${g.keys.length}</span> keys
            <span style="opacity:0.4;">·</span>
            <span>${date}</span>
            <span style="opacity:0.4;">·</span>
            <span style="font-size:9px;font-weight:700;padding:1px 6px;border-radius:5px;letter-spacing:0.5px;${g.source === 'created'
              ? 'background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.35);color:#10b981;'
              : 'background:rgba(99,102,241,0.13);border:1px solid rgba(99,102,241,0.3);color:var(--accent-primary);'
            }">${g.source === 'created' ? 'CREATED' : 'IMPORTED'}</span>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
          <div class="wg-badge" style="color:${clr.accent};border-color:${clr.border};background:${clr.bg};">${g.keys.length} KEYS</div>
          <span class="material-icons-round" style="font-size:18px;color:var(--accent-primary);flex-shrink:0;">chevron_right</span>
        </div>
      </div>
    `;

    // ── Full card long-press → drag reorder ──
    let _lpTimer = null, _lpFired = false;

    card.addEventListener('touchstart', (e) => {
      _lpFired = false;
      _lpTimer = setTimeout(() => {
        _lpFired = true;
        _lpTimer = null;
        window._wgDragStart && window._wgDragStart(e, card, list);
      }, 400);
    }, { passive: true });

    card.addEventListener('touchend',    () => { if (_lpTimer) { clearTimeout(_lpTimer); _lpTimer = null; } }, { passive: true });
    card.addEventListener('touchmove',   () => { if (_lpTimer) { clearTimeout(_lpTimer); _lpTimer = null; } }, { passive: true });
    card.addEventListener('touchcancel', () => { if (_lpTimer) { clearTimeout(_lpTimer); _lpTimer = null; } }, { passive: true });

    // Header tap → open detail (only if drag didn't fire)
    card.querySelector('#wg-header-' + g.id).addEventListener('click', () => {
      if (_lpFired) { _lpFired = false; return; }
      openWgDetailUI(g.id);
      haptic && haptic();
    });

    list.appendChild(card);
  });
}

