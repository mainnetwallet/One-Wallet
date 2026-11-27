
  // ── State ──
  var _thPickerSelected     = new Set();   // selected group indices
  var _thPickerIndivSelected = new Set();  // 'gi-ki' individual key selections
  var _thPickerExpanded     = new Set();   // expanded group indices
  var _thPickerTargetId     = '';
  var _thPickerMode         = '';   // 'single' | 'multi' | 'address'

  // ── Helpers ──
  function thGid(id) { return document.getElementById(id); }
  function thGetGroups() {
    var g = [];
    g = (typeof loadWalletGroups === 'function') ? loadWalletGroups() : [];
    return g.filter(function(g) { return g && g.keys && g.keys.length > 0; });
  }
  function _thKeyDisplay(pk, mode) {
    try {
      var t = (pk || '').trim();
      if (mode === 'address' || mode === 'addresses') {
        try { if (ethers.isAddress(t)) { var ca = ethers.getAddress(t); return ca.slice(0,6)+'…'+ca.slice(-4); } } catch(_e) {}
        var addr = new ethers.Wallet(t).address;
        return addr.slice(0,6)+'…'+addr.slice(-4);
      }
      var addr2 = new ethers.Wallet(pk).address;
      return addr2.slice(0, 6) + '…' + addr2.slice(-4);
    } catch(_) { return (pk || '').slice(0, 8) + '…'; }
  }

  // ── Render the full list (shared wallet drawer UI) ──
  function _thRenderList() {
    var list = thGid('th-wallet-picker-list');
    if (!list) return;
    // single/address: group rows only expand, one wallet is picked.
    // multi/addresses: group checkbox (tri-state) + any wallet inside an expanded group.
    var isSingleAddr = (_thPickerMode === 'single' || _thPickerMode === 'address');

    WDU.renderList(list, {
      mode: isSingleAddr ? 'single' : 'multi',
      groups: thGetGroups(),
      emptyHtml: '<div class="wdu-empty">No wallet groups<br><span style="font-size:11px;opacity:.6;">Add them in Settings \u2192 Wallet Groups</span></div>',
      isOpen: function(gi) { return _thPickerExpanded.has(gi); },
      isKeySel: function(gi, ki) { return _thPickerIndivSelected.has(gi + '-' + ki); },
      onExpand: function(gi) { window.thPickerToggleExpand(gi); },
      onGroup: function(gi) { window.thPickerToggle(gi); },
      onKey: function(gi, ki) {
        if (isSingleAddr) window.thPickerSelectSingle(gi, ki);
        else window.thPickerToggleKey(gi, ki);
      },
      keyInfo: function(gi, ki, pk) {
        return { title: 'Wallet ' + (ki + 1), sub: _thKeyDisplay(pk, _thPickerMode) };
      }
    });
  }
