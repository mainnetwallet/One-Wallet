// Shared wallet drawer list: one UI for every wallet picker drawer.
//
//   mode 'single' - radio rows; a group only expands, one wallet can be picked.
//   mode 'multi'  - checkboxes; tick a group for all its wallets (tri-state), or
//                   expand it and tick any wallets individually.
//
// This is a view layer only. Callers keep their own selection state and storage and
// pass callbacks, so key handling stays exactly where it was.
//
//   WDU.renderList(container, {
//     mode:      'single' | 'multi',
//     groups:    [{ id, name, emoji, keys: [privateKey, ...], labels?: [..] }],
//     isOpen:    function (gi) -> bool            group is expanded
//     isKeySel:  function (gi, ki) -> bool        wallet is selected
//     onExpand:  function (gi)                    tap on a group row
//     onGroup:   function (gi)                    tap on a group checkbox (multi only)
//     onKey:     function (gi, ki)                tap on a wallet row
//     keyInfo:   function (gi, ki, pk) -> { title, sub }      optional
//     groupSub:  function (gi, selCount, total) -> string     optional
//     keyAction: { icon, label, onTap(gi, ki, el) }           optional extra button per wallet
//     hint:      string | false                   optional, false hides the hint row
//     topHtml:   string                           optional html shown above the hint row
//     emptyHtml: string                           optional
//   });
(function (global) {
  'use strict';

  var HINTS = {
    single: 'Open a group, then tap one wallet.',
    multi: 'Tick a group for every wallet in it, or open it to pick some.'
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function colorFor(i) {
    var pal = (typeof WG_COLORS !== 'undefined' && WG_COLORS && WG_COLORS.length) ? WG_COLORS : null;
    return pal ? pal[i % pal.length]
      : { num: 'linear-gradient(135deg,#6366f1,#8b5cf6)', glow: 'rgba(99,102,241,0.12)', accent: '#818cf8' };
  }

  function addressOf(pk) {
    try {
      var t = String(pk || '').trim();
      if (global.ethers && ethers.isAddress && ethers.isAddress(t)) return ethers.getAddress(t);
      return new ethers.Wallet(t.indexOf('0x') === 0 ? t : '0x' + t).address;
    } catch (_) { return ''; }
  }

  function short(addr, head, tail) {
    if (!addr) return '—';
    return addr.slice(0, head || 6) + '…' + addr.slice(-(tail || 4));
  }

  // ── Wallet names ──
  // A wallet can have a custom name. It is stored on the group as `labels` (an array aligned with `keys`,
  // '' = no custom name, so the default "Wallet N" is shown). Every wallet row shows the custom name when set.
  function liveGroup(id) {
    try {
      if (id == null || typeof loadWalletGroups !== 'function') return null;
      var list = loadWalletGroups() || [];
      for (var i = 0; i < list.length; i++) { if (list[i] && list[i].id === id) return list[i]; }
    } catch (_) {}
    return null;
  }

  function labelFor(g, ki) {
    if (g && g.labels && g.labels[ki]) return String(g.labels[ki]);
    var lg = g ? liveGroup(g.id) : null;
    return (lg && lg.labels && lg.labels[ki]) ? String(lg.labels[ki]) : '';
  }

  var _rn = null;
  var QUICK_NAMES = ['Main', 'Trading', 'Savings', 'Gas', 'Bot'];

  function el(id) { return document.getElementById(id); }

  function closeRename() {
    var ov = el('wdu-rename-overlay');
    if (ov) ov.classList.remove('open');
    var inp = el('wdu-rename-input');
    if (inp) inp.blur();
    _rn = null;
  }

  function updateCounter() {
    var inp = el('wdu-rename-input');
    var cnt = el('wdu-rename-count');
    var clr = el('wdu-rename-clear');
    if (cnt && inp) cnt.textContent = inp.value.length + '/24';
    if (clr && inp) clr.style.visibility = inp.value ? 'visible' : 'hidden';
  }

  function commitRename(forceName) {
    if (!_rn) return;
    var inp = el('wdu-rename-input');
    var raw = (typeof forceName === 'string') ? forceName : ((inp && inp.value) || '');
    var name = raw.replace(/\s+/g, ' ').trim().slice(0, 24);
    var st = _rn;
    var groups = (typeof loadWalletGroups === 'function') ? loadWalletGroups() : [];
    var g = null;
    for (var i = 0; i < groups.length; i++) { if (groups[i] && groups[i].id === st.gid) { g = groups[i]; break; } }
    if (!g) { closeRename(); return; }
    var n = (g.keys || []).length;
    var labels = Array.isArray(g.labels) ? g.labels.slice(0, n) : [];
    while (labels.length < n) labels.push('');
    labels[st.ki] = name;
    var any = labels.some(function (l) { return !!l; });
    if (any) g.labels = labels; else delete g.labels;
    if (typeof saveWalletGroups === 'function') saveWalletGroups(groups);
    ['renderWalletGroupsList', 'renderSwapGroupList', 'renderWgManagerList'].forEach(function (fn) {
      try { if (typeof window[fn] === 'function') window[fn](); } catch (_) {}
    });
    if (typeof showToast === 'function') showToast(name ? 'Renamed to: ' + name : 'Name reset', 'edit');
    if (typeof haptic === 'function') { try { haptic(); } catch (_) {} }
    closeRename();
    if (typeof st.done === 'function') st.done(name);
  }

  // Built once and appended to <body>: #app is a stacking context, so a dialog inside it would sit under the
  // body-level overlays (wallet group detail, drawers) instead of on top of them.
  function ensureRenameModal() {
    var ov = el('wdu-rename-overlay');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = 'wdu-rename-overlay';
    ov.className = 'wdu-rn-ov';
    var chips = QUICK_NAMES.map(function (q) {
      return '<button type="button" class="wdu-rn-chip" data-q="' + q + '">' + q + '</button>';
    }).join('');
    ov.innerHTML = '<div class="wdu-rn-card" role="dialog" aria-modal="true" aria-label="Rename wallet">'
      + '<div class="wdu-rn-head">'
      + '<span class="wdu-rn-ico"><i class="material-icons-round">vpn_key</i></span>'
      + '<span class="wdu-rn-ht"><span class="wdu-rn-title">Rename wallet</span>'
      + '<span class="wdu-rn-sub" id="wdu-rename-sub"></span></span>'
      + '<span class="wdu-rn-x" id="wdu-rename-x" role="button" aria-label="Close"><i class="material-icons-round">close</i></span>'
      + '</div>'
      + '<div class="wdu-rn-body">'
      + '<div class="wdu-rn-lbl"><span>WALLET NAME</span><span id="wdu-rename-count">0/24</span></div>'
      + '<div class="wdu-rn-field">'
      + '<input type="text" id="wdu-rename-input" maxlength="24" placeholder="Wallet name" autocomplete="off" spellcheck="false" />'
      + '<span class="wdu-rn-clear" id="wdu-rename-clear" role="button" aria-label="Clear"><i class="material-icons-round">cancel</i></span>'
      + '</div>'
      + '<div class="wdu-rn-chips">' + chips + '</div>'
      + '<button type="button" class="wdu-rn-reset" id="wdu-rename-reset"><i class="material-icons-round">restart_alt</i><span id="wdu-rename-reset-t"></span></button>'
      + '<div class="wdu-rn-btns">'
      + '<button type="button" class="wdu-rn-cancel" id="wdu-rename-cancel">Cancel</button>'
      + '<button type="button" class="wdu-rn-save" id="wdu-rename-save">Save name</button>'
      + '</div></div></div>';
    document.body.appendChild(ov);
    var inp = el('wdu-rename-input');
    ov.addEventListener('click', function (e) { if (e.target === ov) closeRename(); });
    el('wdu-rename-x').addEventListener('click', closeRename);
    el('wdu-rename-cancel').addEventListener('click', closeRename);
    el('wdu-rename-save').addEventListener('click', function () { commitRename(); });
    el('wdu-rename-reset').addEventListener('click', function () { commitRename(''); });
    el('wdu-rename-clear').addEventListener('click', function () { inp.value = ''; updateCounter(); inp.focus(); });
    ov.querySelectorAll('.wdu-rn-chip').forEach(function (b) {
      b.addEventListener('click', function () { inp.value = b.getAttribute('data-q'); updateCounter(); inp.focus(); });
    });
    inp.addEventListener('input', updateCounter);
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
      else if (e.key === 'Escape') { closeRename(); }
    });
    return ov;
  }

  // Opens the rename dialog for wallet `ki` of group `gid`. An empty name goes back to "Wallet N".
  function renameWallet(gid, ki, done) {
    var g = liveGroup(gid);
    if (!g || !g.keys || ki < 0 || ki >= g.keys.length) return;
    var ov = ensureRenameModal();
    _rn = { gid: gid, ki: ki, done: done };
    var cur = (g.labels && g.labels[ki]) ? String(g.labels[ki]) : '';
    var gi = 0;
    try { gi = Math.max(0, loadWalletGroups().indexOf(g)); } catch (_) {}
    var clr = colorFor(gi);
    var card = ov.querySelector('.wdu-rn-card');
    card.style.setProperty('--wdu-bg', clr.bg);
    card.style.setProperty('--wdu-bd', clr.border);
    card.style.setProperty('--wdu-ac', clr.accent);
    var inp = el('wdu-rename-input');
    inp.value = cur;
    inp.placeholder = 'Wallet ' + (ki + 1);
    el('wdu-rename-sub').textContent = (g.name || 'Group') + ' \u00b7 ' + short(addressOf(g.keys[ki]), 6, 4);
    el('wdu-rename-reset').style.display = cur ? 'flex' : 'none';
    el('wdu-rename-reset-t').textContent = 'Reset to Wallet ' + (ki + 1);
    updateCounter();
    ov.classList.add('open');
    setTimeout(function () { try { inp.focus(); inp.select(); } catch (_) {} }, 120);
  }

  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

  function defaultEmpty() {
    return '<div class="wdu-empty"><span class="material-icons-round" style="font-size:34px;display:block;margin-bottom:8px;">folder_off</span>'
      + 'No wallet groups<br><span style="font-size:11px;opacity:.6;">Import in Settings first</span></div>';
  }

  function checkbox(state, small) {
    var cls = (state === 1 ? ' on' : (state === 2 ? ' part' : '')) + (small ? ' wdu-sm' : '');
    var icon = state === 2 ? 'remove' : 'check';
    return '<span class="wdu-chk' + cls + '"><i class="material-icons-round">' + icon + '</i></span>';
  }

  function radio(on) {
    return '<span class="wdu-radio' + (on ? ' on' : '') + '"></span>';
  }

  function renderList(container, o) {
    if (!container || !o) return;
    var groups = o.groups || [];
    var multi = o.mode === 'multi';
    var prevScroll = container.scrollTop;

    container._wduOpts = o;
    if (!container._wduBound) {
      container._wduBound = true;
      container.addEventListener('click', onClick);
    }

    if (!groups.length) {
      container.innerHTML = o.emptyHtml || defaultEmpty();
      return;
    }

    var html = o.topHtml || '';
    var hintText = o.hint === false ? '' : (typeof o.hint === 'string' ? o.hint : HINTS[multi ? 'multi' : 'single']);
    if (hintText) {
      html += '<div class="wdu-hint"><span class="wdu-chip">' + (multi ? 'Multi select' : 'Single select') + '</span>'
        + '<span>' + esc(hintText) + '</span></div>';
    }

    groups.forEach(function (g, gi) {
      var keys = g.keys || [];
      var total = keys.length;
      var clr = colorFor(gi);
      var open = !!(o.isOpen && o.isOpen(gi));

      var selCount = 0;
      for (var k = 0; k < total; k++) { if (o.isKeySel && o.isKeySel(gi, k)) selCount++; }
      var state = selCount === 0 ? 0 : (selCount === total ? 1 : 2);

      var sub;
      if (o.groupSub) sub = o.groupSub(gi, selCount, total);
      else if (multi && selCount > 0) sub = selCount + ' of ' + total + ' selected';
      else sub = plural(total, 'wallet') + (!multi && selCount > 0 ? ' · active' : '');

      html += '<div class="wdu-group' + (selCount > 0 ? ' wdu-has-sel' : '') + (open ? ' wdu-open' : '') + '"'
        + ' style="--wdu-bg:' + clr.bg + ';--wdu-bd:' + clr.border + ';--wdu-ac:' + clr.accent + ';">'
        + '<div class="wdu-ghead" data-act="expand" data-gi="' + gi + '">'
        + '<span class="wdu-num">' + (g.emoji ? esc(g.emoji) : '<i class="material-icons-round">account_balance_wallet</i>') + '</span>'
        + '<span class="wdu-gtxt"><span class="wdu-gname">' + esc(g.name || ('Group ' + (gi + 1))) + '</span>'
        + '<span class="wdu-gsub">' + esc(sub) + '</span></span>'
        + (multi ? '<span class="wdu-hit" data-act="group" data-gi="' + gi + '" role="checkbox" aria-label="Select all wallets in group">' + checkbox(state) + '</span>' : '')
        + '<span class="wdu-cv"><i class="material-icons-round wdu-chev">expand_more</i></span>'
        + '</div>';

      if (open) {
        html += '<div class="wdu-keys">';
        for (var ki = 0; ki < total; ki++) {
          var pk = keys[ki];
          var sel = !!(o.isKeySel && o.isKeySel(gi, ki));
          var info = o.keyInfo ? o.keyInfo(gi, ki, pk) : null;
          if (!info) {
            info = {
              title: 'Wallet ' + (ki + 1),
              sub: short(addressOf(pk), 6, 4)
            };
          }
          var custom = labelFor(g, ki);
          if (custom) info.title = custom;
          html += '<div class="wdu-key' + (sel ? ' wdu-sel' : '') + '" data-act="key" data-gi="' + gi + '" data-ki="' + ki + '">'
            + '<i class="material-icons-round wdu-kn">vpn_key</i>'
            + '<span class="wdu-ktxt"><span class="wdu-ktitle">' + esc(info.title) + '</span>'
            + '<span class="wdu-ksub">' + esc(info.sub) + '</span></span>'
            + (o.keyAction ? '<span class="wdu-kx" data-act="keyx" data-gi="' + gi + '" data-ki="' + ki + '" aria-label="' + esc(o.keyAction.label || 'Action') + '"><i class="material-icons-round">' + esc(o.keyAction.icon) + '</i></span>' : '')
            + (multi ? checkbox(sel ? 1 : 0, true) : radio(sel))
            + '</div>';
        }
        html += '</div>';
      }
      html += '</div>';
    });

    container.innerHTML = html;
    container.scrollTop = prevScroll;
  }

  function onClick(e) {
    var container = e.currentTarget;
    var o = container._wduOpts;
    var t = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!o || !t || !container.contains(t)) return;
    var gi = parseInt(t.getAttribute('data-gi'), 10);
    var ki = parseInt(t.getAttribute('data-ki'), 10);
    var act = t.getAttribute('data-act');
    if (typeof haptic === 'function') { try { haptic(); } catch (_) {} }
    if (act === 'expand' && o.onExpand) o.onExpand(gi);
    else if (act === 'group' && o.onGroup) o.onGroup(gi);
    else if (act === 'key' && o.onKey) o.onKey(gi, ki);
    else if (act === 'keyx' && o.keyAction && o.keyAction.onTap) {
      e.stopPropagation();
      o.keyAction.onTap(gi, ki, t);
    }
  }

  // Set helper for callers that keep expanded groups in a Set.
  function toggleInSet(set, v) {
    if (set.has(v)) set.delete(v); else set.add(v);
  }

  global.WDU = {
    renderList: renderList,
    addressOf: addressOf,
    short: short,
    esc: esc,
    colorFor: colorFor,
    labelFor: labelFor,
    renameWallet: renameWallet,
    toggleInSet: toggleInSet
  };
})(window);
