
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
      border:1px solid rgba(99,102,241,0.7)!important;background:var(--bg-raised);border-radius:16px;
      transform:scale(1.025);opacity:0.97;
      transition:box-shadow 0.15s,transform 0.15s;
    `;
    document.body.appendChild(clone);

    // Placeholder (same height, invisible)
    const ph = document.createElement('div');
    ph.style.cssText = `height:${rect.height}px;border-radius:16px;
      background:rgba(99,102,241,0.08);border:2px dashed rgba(99,102,241,0.35);
      margin-bottom:0;transition:none;box-sizing:border-box;`;
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

function _wgEsc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// Two letters for the group avatar: "Group 1–50" -> G1, "Trading batch A" -> TB
function _wgInitials(name) {
  const clean = String(name || '').trim();
  if (!clean) return '?';
  const words = clean.split(/\s+/).filter(Boolean);
  const first = Array.from(words[0]);
  const text = words.length > 1 ? first[0] + Array.from(words[1])[0] : first.slice(0, 2).join('');
  return text.toUpperCase();
}

function renderWalletGroupsList() {
  const list = document.getElementById('wg-list');
  const totalBadge = document.getElementById('wg-total-badge');
  const groups = loadWalletGroups();
  const n = groups.length;
  const totalWallets = groups.reduce((sum, g) => sum + ((g && g.keys && g.keys.length) || 0), 0);

  if (totalBadge) totalBadge.textContent = n + ' GROUP' + (n !== 1 ? 'S' : '');
  if (typeof refreshSettingsStatus === 'function') refreshSettingsStatus();

  const statGroups = document.getElementById('wg-stat-groups');
  const statWallets = document.getElementById('wg-stat-wallets');
  if (statGroups) statGroups.textContent = String(n);
  if (statWallets) statWallets.textContent = String(totalWallets);

  // Update Manage button — enabled only when at least one group is selected
  _updateWgManageBtn();

  if (!list) return;
  list.innerHTML = '';
  list.classList.toggle('wg-joined', n > 0);

  if (n === 0) {
    list.innerHTML = `<div class="wg-empty-state">
      <span class="material-icons-round">folder_open</span>
      <b>No wallet groups yet</b>
      Import a key or create new wallets to add one.
    </div>`;
    return;
  }

  groups.forEach((g, idx) => {
    const clr = WG_COLORS[idx % WG_COLORS.length];
    const emoji = g.emoji || '';
    const count = g.keys.length;

    // Only the first wallet's address is shown in the list (the full list lives in the group detail)
    let addr = '';
    try { if (count > 0) addr = new ethers.Wallet(g.keys[0]).address; } catch (_) {}
    const shortAddr = addr ? addr.slice(0, 6) + '…' + addr.slice(-4) : '';

    const card = document.createElement('div');
    card.className = 'wg-card';
    card.id = 'wg-card-' + g.id;
    card.dataset.gid = g.id;

    card.innerHTML = `
      <div class="wg-header" id="wg-header-${g.id}" style="cursor:pointer;user-select:none;">
        <div class="wg-ava${emoji ? ' wg-ava-emoji' : ''}" style="background:${clr.bg};color:${clr.accent};">${emoji ? _wgEsc(emoji) : _wgEsc(_wgInitials(g.name))}</div>
        <div class="wg-gtxt">
          <div class="wg-gname">${_wgEsc(g.name)}</div>
          <div class="wg-gsub">${count} wallet${count !== 1 ? 's' : ''}${shortAddr ? ' · <span class="wg-mono">' + shortAddr + '</span>' : ''}</div>
        </div>
        <span class="material-icons-round wg-row-chev">chevron_right</span>
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
