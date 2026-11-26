(function (__NX) {
'use strict';
__NX._saveTokenList = _saveTokenList;
__NX._loadTokenList = _loadTokenList;
__NX._snapshotTokenList = _snapshotTokenList;
  /* ─── CONSTANTS ─── */
  var LS_KEY  = 'one_token_cache';
   // single key: stores everything
  __NX._sessionFetched = false;
  /* ─── SAVE: token list + balance + price → per-wallet localStorage entry ─── */
  function _saveTokenList(list) {
    try {
      var chainId = (typeof activeHomeChainId !== 'undefined') ? activeHomeChainId : '__all__';
      // Get currently selected wallet key for per-wallet cache
      var _walletKey = (function() {
        try { return _oneGetSelectedKey(); } catch { return null; }
      })();
      // Don't save if no wallet selected
      if (!_walletKey) return;
      // Only store last 8 chars as wallet identifier — never persist full private key in cache
      var _walletKeyId = _walletKey.slice(-8);
      var payload = {
        chain:     chainId === null ? '__all__' : String(chainId),
        time:      new Date().toISOString(),
        walletKey: _walletKeyId,  // identifier only, NOT full private key
        tokens:    list
      };
      // Save to wallet-specific key (last 8 chars of key as suffix)
      var _walletCacheKey = LS_KEY + '_' + _walletKeyId;
      localStorage.setItem(_walletCacheKey, JSON.stringify(payload));
      // Also update legacy key for backward compat
      localStorage.setItem(LS_KEY, JSON.stringify(payload));
    } catch(e) {}
  }
  /* ─── LOAD: returns { chain, time, walletKey, tokens } or null ─── */
  function _loadTokenList() {
    try {
      var _walletKey = (function() {
        try { return _oneGetSelectedKey(); } catch { return null; }
      })();
      // No wallet selected — never load any cache
      if (!_walletKey) return null;
      var _walletKeyId = _walletKey.slice(-8);
      var raw = null;
      // Try wallet-specific key first (most reliable)
      raw = localStorage.getItem(LS_KEY + '_' + _walletKeyId);
      // Fallback to legacy key ONLY if it belongs to the same wallet
      if (!raw) {
        var _legacyRaw = localStorage.getItem(LS_KEY);
        if (_legacyRaw) {
          try {
            var _legacyData = JSON.parse(_legacyRaw);
            // Only use if walletKey (suffix) matches or not set (old format)
            if (!_legacyData.walletKey || _legacyData.walletKey === _walletKeyId || _legacyData.walletKey === _walletKey) {
              raw = _legacyRaw;
            }
          } catch(e) {}
        }
      }
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (Array.isArray(data)) return { chain: '__all__', time: null, walletKey: _walletKey.slice(-8), tokens: data };
      // Final wallet key check — reject if cache belongs to a different wallet
      var _wkId = _walletKey.slice(-8);
      if (data.walletKey && data.walletKey !== _wkId && data.walletKey !== _walletKey) return null;
      return data;
    } catch(e) { return null; }
  }
  // Returns true if cached data matches the currently active chain
  function _isCacheChainMatch() {
    try {
      var data = _loadTokenList();
      if (!data) return false;
      var savedChain = data.chain || '__all__';
      var currentChain = (typeof activeHomeChainId !== 'undefined')
        ? (activeHomeChainId === null ? '__all__' : String(activeHomeChainId))
        : '__all__';
      return savedChain === currentChain;
    } catch(e) { return true; }
  }
  /* Snapshot current token cards from DOM */
  function _snapshotTokenList() {
    var cards = document.querySelectorAll('#token-list .token-card');
    if (!cards.length) return null;
    var list = [];
    cards.forEach(function(card) {
      try {
        var nameEl   = card.querySelector('.token-name');
        var subEl    = card.querySelector('.token-sub');
        var amtEl    = card.querySelector('.token-amount');
        var usdEl    = card.querySelector('.token-usd');
        var priceEl  = card.querySelector('.tlp-price');
        var iconEl   = card.querySelector('.token-icon');
        var changeEl = card.querySelector('.tlp-change');
        var cardTokenId = card.id ? card.id.replace('token-card-', '') : '';
        // Save numeric usdValue from dataset for portfolio total restore
        var usdValueNum = parseFloat(card.dataset.usdValue || '0') || 0;
        var changeColor = changeEl ? changeEl.style.color : '';
        list.push({
          name:        nameEl  ? nameEl.textContent  : '',
          sub:         subEl   ? subEl.textContent   : '',
          amount:      amtEl   ? amtEl.textContent   : '',
          usd:         usdEl   ? usdEl.textContent   : '',
          price:       priceEl ? priceEl.textContent : '',
          change:      changeEl ? changeEl.textContent : '',
          changeColor: changeColor,
          iconBg:      iconEl  ? iconEl.style.background : '',
          tokenId:     cardTokenId,
          usdValue:    usdValueNum,
          badgeBg:     (card.querySelector('.token-badge') || {}).style ? (card.querySelector('.token-badge').style.background || '') : '',
          savedOrder:  list.length  // ← DOM serial order (0-based index)
        });
      } catch(e) {}
    });
    return list.length ? list : null;
  }
})((window.__nxp = window.__nxp || {}).mod_token_cache_pull_refresh = window.__nxp.mod_token_cache_pull_refresh || {});
