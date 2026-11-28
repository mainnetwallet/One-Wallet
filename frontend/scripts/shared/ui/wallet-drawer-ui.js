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
              title: (g.labels && g.labels[ki]) || ('Wallet ' + (ki + 1)),
              sub: short(addressOf(pk), 6, 4)
            };
          }
          html += '<div class="wdu-key' + (sel ? ' wdu-sel' : '') + '" data-act="key" data-gi="' + gi + '" data-ki="' + ki + '">'
            + '<i class="material-icons-round wdu-kn">vpn_key</i>'
            + '<span class="wdu-ktitle">' + esc(info.title) + '</span>'
            + '<span class="wdu-ksub">' + esc(info.sub) + '</span>'
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
    toggleInSet: toggleInSet
  };
})(window);
