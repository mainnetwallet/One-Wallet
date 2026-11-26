
function _renderSwapWalletGroupList() {
  const list       = document.getElementById('swap-wallet-drawer-list');
  // Reset key-view inline styles so del-drawer-body CSS class takes over again
  if (list) list.style.cssText = '';
  const badge      = document.getElementById('swap-wallet-drawer-badge');
  const title      = document.getElementById('swap-wallet-drawer-title');
  const backBtn    = document.getElementById('swap-wallet-drawer-back-btn');
  const closeBtn   = document.getElementById('swap-wallet-drawer-close-btn');
  const confirmBtn = document.getElementById('swap-wallet-drawer-confirm-btn');
  const confirmLbl = document.getElementById('swap-wallet-drawer-confirm-label');
  const actionsRow = document.getElementById('swap-wallet-drawer-actions');
  if (!list) return;

  const groups   = loadWalletGroups().filter(g => g && g.keys && g.keys.length > 0);
  const selCount = (typeof swapSelectedGroupIds !== 'undefined') ? swapSelectedGroupIds.length : 0;
  const totalKeys= (typeof validatedKeys !== 'undefined') ? validatedKeys.length : 0;

  if (badge)      badge.textContent  = groups.length + ' GROUP' + (groups.length !== 1 ? 'S' : '');
  if (title)      title.textContent  = 'Select Wallet';
  if (backBtn)    backBtn.style.display  = 'none';
  if (closeBtn)   closeBtn.style.display = 'flex';
  if (actionsRow) actionsRow.style.display = groups.length > 1 ? 'flex' : 'none';

  // Confirm button
  if (confirmBtn) confirmBtn.style.display = selCount > 0 ? 'flex' : 'none';
  if (confirmLbl) {
    if (_swapDrawerMode === 'profile') {
      confirmLbl.textContent = selCount > 0
        ? 'Open Swap (' + selCount + ' group' + (selCount !== 1 ? 's' : '') + ')'
        : 'Open Swap';
    } else {
      confirmLbl.textContent = selCount > 0
        ? 'Confirm (' + selCount + ' group' + (selCount !== 1 ? 's' : '') + ' · ' + totalKeys + ' keys)'
        : 'Confirm Selection';
    }
  }

  list.innerHTML = '';

  if (groups.length === 0) {
    list.innerHTML = '<div style="text-align:center;padding:50px 20px;font-family:var(--font-mono);font-size:11px;color:var(--text-muted);line-height:2.2;"><div style="font-size:32px;margin-bottom:10px;">📁</div>NO GROUPS FOUND<br><span style="font-size:10px;opacity:0.5;">Import in Settings first</span></div>';
    return;
  }

  // Hint
  const hintEl = document.createElement('div');
  hintEl.style.cssText = 'font-family:var(--font-mono);font-size:9px;color:var(--text-muted);letter-spacing:1px;padding:0 4px 10px;text-align:center;';
  hintEl.textContent = 'TAP = SELECT GROUP   •   → = VIEW KEYS';
  list.appendChild(hintEl);

  groups.forEach(function(g, idx) {
    var clr      = WG_COLORS[idx % WG_COLORS.length];
    var isActive = (typeof swapSelectedGroupIds !== 'undefined') && swapSelectedGroupIds.includes(g.id);

    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:8px;';

    var card = document.createElement('div');
    card.className = 'del-drawer-item' + (isActive ? ' selected' : '');
    card.style.cssText = 'flex:1;cursor:pointer;position:relative;transition:all 0.2s ease;display:flex;align-items:center;gap:12px;padding:12px 48px 12px 14px;border-radius:14px;margin-bottom:0;';

    var checkIcon = isActive
      ? '<div style="position:absolute;top:50%;right:12px;transform:translateY(-50%);width:22px;height:22px;border-radius:7px;background:var(--accent-primary);display:flex;align-items:center;justify-content:center;box-shadow:0 0 8px rgba(99,102,241,0.5);flex-shrink:0;"><span class="material-icons-round" style="font-size:14px;color:#fff;">check</span></div>'
      : '<div style="position:absolute;top:50%;right:12px;transform:translateY(-50%);width:22px;height:22px;border-radius:7px;background:var(--bg-raised);border:1.5px solid var(--border-subtle);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><span class="material-icons-round" style="font-size:13px;color:var(--text-muted);">radio_button_unchecked</span></div>';

    var activeBadge = isActive
      ? '<div style="font-size:8px;font-weight:800;font-family:var(--font-mono);letter-spacing:1.5px;padding:2px 7px;border-radius:6px;background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.4);color:var(--accent-primary);white-space:nowrap;">● ACTIVE</div>'
      : '';

    card.innerHTML =
      '<div style="width:42px;height:42px;border-radius:13px;background:' + clr.num + ';display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:18px;font-weight:900;color:#fff;box-shadow:0 2px 12px ' + clr.glow + ';">' + (g.emoji || (idx + 1)) + '</div>' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">' +
          '<div style="font-size:13px;font-weight:800;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + g.name + '</div>' +
          activeBadge +
        '</div>' +
        '<div style="font-size:10px;font-family:var(--font-mono);margin-top:3px;color:' + clr.accent + ';font-weight:700;">' + g.keys.length + ' wallet' + (g.keys.length !== 1 ? 's' : '') + '</div>' +
      '</div>' +
      checkIcon;

    card.addEventListener('click', function() {
      if (typeof swapSelectedGroupIds === 'undefined') return;
      var i2 = swapSelectedGroupIds.indexOf(g.id);
      if (i2 !== -1) {
        swapSelectedGroupIds.splice(i2, 1);
        showToast(g.name + ' deselected', 'folder');
      } else {
        swapSelectedGroupIds.push(g.id);
        showToast(g.name + ' selected', 'folder_special');
      }
      if (typeof saveSwapSelectedGroupIds === 'function') saveSwapSelectedGroupIds();
      if (typeof applyMultiGroupSelection === 'function') applyMultiGroupSelection();
      if (typeof renderSwapGroupList === 'function') renderSwapGroupList();
      _renderSwapWalletGroupList();
      haptic && haptic();
    });
    card.addEventListener('touchstart', function() { card.style.opacity='0.8'; }, {passive:true});
    card.addEventListener('touchend',   function() { card.style.opacity='1'; });

    // Arrow → view keys
    var arrowBtn = document.createElement('button');
    arrowBtn.style.cssText = 'flex-shrink:0;width:40px;height:40px;border-radius:12px;border:1.5px solid ' + clr.border + ';background:' + clr.bg + ';display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.2s ease;';
    arrowBtn.innerHTML = '<span class="material-icons-round" style="font-size:18px;color:' + clr.accent + ';">chevron_right</span>';
    arrowBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      _swapWalletDrawerExpandedGroupId = g.id;
      _renderSwapWalletDrawer();
      haptic && haptic();
    });
    arrowBtn.addEventListener('touchstart', function() { arrowBtn.style.opacity='0.7'; }, {passive:true});
    arrowBtn.addEventListener('touchend',   function() { arrowBtn.style.opacity='1'; });

    wrap.appendChild(card);
    wrap.appendChild(arrowBtn);
    list.appendChild(wrap);
  });

  // Update step-1 button sub-label if in step1 mode
  var subEl = document.getElementById('swap-group-btn-sub');
  if (subEl) {
    subEl.textContent = selCount > 0
      ? selCount + ' GROUP' + (selCount !== 1 ? 'S' : '') + ' SELECTED · ' + totalKeys + ' KEYS'
      : 'TAP TO CHOOSE GROUPS';
    subEl.style.color = selCount > 0 ? 'var(--accent-green)' : '';
  }
}

