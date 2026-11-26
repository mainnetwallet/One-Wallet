
  // ── Render inline Recent Bridge/Swap on bridge page ──
  function brRenderRecentInline() {
    var container  = document.getElementById('br-recent-list');
    var clearBtn   = document.getElementById('br-recent-inline-clear');
    if (!container) return;

    var _brhClearedTs = 0;
    try { var _c = localStorage.getItem('brh_cleared_ts'); if (_c) _brhClearedTs = Number(_c); } catch(e) {}
    var allTxs = (typeof loadTxHistory === 'function') ? loadTxHistory() : [];
    var pool = allTxs.filter(function(t) {
      if (t.type !== 'bridge' && t.type !== 'swap') return false;
      if (_brhClearedTs > 0 && Number(t.timestamp || t.ts || 0) <= _brhClearedTs) return false;
      return true;
    });
    var recent = pool.slice(-5).reverse();

    if (clearBtn) clearBtn.style.display = recent.length > 0 ? 'flex' : 'none';

    container.innerHTML = '';
    if (!recent.length) {
      container.innerHTML = '<div style="text-align:center;padding:16px;font-family:var(--font-mono);font-size:11px;color:var(--text-muted);">No recent transactions.</div>';
      return;
    }

    var _brExpMap = window.BR_EXPLORERS || {};
    var _resolveChainName = function(id, fallback) {
      if (!id) return fallback || '?';
      if (typeof getAllChains === 'function') {
        var _c = getAllChains().find(function(c){ return c.chainId === id; });
        if (_c) return _c.name;
      }
      var _NAMES = {1:'Ethereum',8453:'Base',42161:'Arbitrum',10:'Optimism',137:'Polygon',56:'BSC',43114:'Avalanche',59144:'Linea',534352:'Scroll',324:'zkSync',100:'Gnosis',250:'Fantom',25:'Cronos',42220:'Celo'};
      return _NAMES[id] || fallback || ('Chain '+id);
    };

    recent.forEach(function(tx) {
      var isBridge  = tx.type === 'bridge';
      var iconName  = isBridge ? 'alt_route' : 'swap_horiz';
      var iconColor = isBridge ? 'var(--neon-cyan)' : 'var(--accent-primary)';
      var iconBg    = isBridge ? 'rgba(34,211,238,0.12)' : 'rgba(99,102,241,0.12)';
      var accentBorder = isBridge ? 'rgba(34,211,238,0.2)' : 'rgba(99,102,241,0.2)';

      // Chain label
      var _sentCid  = tx.fromChainId || tx.chainId || 1;
      var _recvCid  = tx.toChainId   || tx.chainId || 1;
      var fromChainLabel = tx.fromChain || _resolveChainName(_sentCid);
      var toChainLabel   = tx.toChain   || _resolveChainName(_recvCid);
      var chainLabel = isBridge ? (fromChainLabel + ' → ' + toChainLabel)
                     : (_sentCid === _recvCid ? fromChainLabel : fromChainLabel + ' → ' + toChainLabel);

      // Explorer link (sent tx)
      var sentUrl = null;
      if (tx.hash && tx.hash.length > 10) {
        var base = _brExpMap[_sentCid] || (window.getTHExplorerTx ? window.getTHExplorerTx(_sentCid) : 'https://etherscan.io/tx/');
        sentUrl = base + tx.hash;
      }
      // Receive tx link (bridge)
      var recvUrl = null;
      if (tx.recvHash && tx.recvHash.length > 10) {
        var rbase = _brExpMap[_recvCid] || (window.getTHExplorerTx ? window.getTHExplorerTx(_recvCid) : 'https://etherscan.io/tx/');
        recvUrl = rbase + tx.recvHash;
      }

      // Amount display
      var _fmt = function(v) {
        var n = parseFloat(v);
        if (!n || !isFinite(n)) return v || '—';
        if (n >= 1000) return n.toLocaleString('en-US',{maximumFractionDigits:2});
        if (n >= 1) return parseFloat(n.toPrecision(6)).toString();
        if (n >= 1e-4) return parseFloat(n.toPrecision(4)).toString();
        return n.toExponential(2);
      };
      var fromAmtStr = (tx.fromAmt && tx.fromToken) ? (_fmt(tx.fromAmt) + ' ' + tx.fromToken) : (tx.fromAmt ? _fmt(tx.fromAmt) : '—');
      var toAmtStr   = (tx.toAmt   && tx.toToken)   ? ('+' + _fmt(tx.toAmt)   + ' ' + tx.toToken)  : null;
      var timeStr    = (typeof formatTxTime === 'function') ? formatTxTime(tx.timestamp) : '';

      // Status badge
      var statusBadge = '';
      if (tx.pendingRecv) {
        statusBadge = '<span style="font-family:var(--font-mono);font-size:8px;font-weight:700;color:var(--accent-amber);background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.25);border-radius:6px;padding:1px 5px;display:inline-flex;align-items:center;gap:3px;"><span class="material-icons-round" style="font-size:9px;animation:spin 1.2s linear infinite;">sync</span>PENDING</span>';
      } else if (tx.failed) {
        statusBadge = '<span style="font-family:var(--font-mono);font-size:8px;font-weight:700;color:var(--accent-red);background:rgba(244,63,94,0.08);border:1px solid rgba(244,63,94,0.2);border-radius:6px;padding:1px 5px;">FAILED</span>';
      }

      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:11px 13px;background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:14px;transition:border-color 0.15s,transform 0.12s,opacity 0.12s;' + (sentUrl ? 'cursor:pointer;' : '');
      if (sentUrl) {
        row.addEventListener('click', function() { window.open(sentUrl, '_blank', 'noopener'); });
        row.addEventListener('mouseenter', function(){ this.style.borderColor=accentBorder; this.style.transform='translateY(-1px)'; });
        row.addEventListener('mouseleave', function(){ this.style.borderColor=''; this.style.transform=''; });
        row.addEventListener('mousedown',  function(){ this.style.opacity='.75'; });
        row.addEventListener('mouseup',    function(){ this.style.opacity='1'; });
        row.addEventListener('touchstart', function(){ this.style.opacity='.75'; }, {passive:true});
        row.addEventListener('touchend',   function(e){ e.preventDefault(); this.style.opacity='1'; window.open(sentUrl,'_blank','noopener'); });
      } else {
        row.addEventListener('mouseenter', function(){ this.style.borderColor='rgba(255,255,255,0.08)'; });
        row.addEventListener('mouseleave', function(){ this.style.borderColor=''; });
      }

      row.innerHTML =
        '<div style="width:34px;height:34px;border-radius:10px;background:'+iconBg+';border:1px solid '+accentBorder+';display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
          '<span class="material-icons-round" style="font-size:17px;color:'+iconColor+';pointer-events:none;">'+iconName+'</span>' +
        '</div>' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (tx.pair || fromAmtStr) + '</div>' +
          '<div style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);margin-top:2px;display:flex;align-items:center;gap:4px;flex-wrap:wrap;">' +
            '<span style="color:'+iconColor+';font-size:8px;font-weight:700;background:'+(isBridge?'rgba(34,211,238,0.08)':'rgba(99,102,241,0.08)')+';border:1px solid '+(isBridge?'rgba(34,211,238,0.2)':'rgba(99,102,241,0.2)')+';border-radius:4px;padding:0 4px;">'+(isBridge?'BRIDGE':'SWAP')+'</span>' +
            '<span>' + chainLabel + '</span>' +
            (timeStr ? '<span>· ' + timeStr + '</span>' : '') +
          '</div>' +
          (statusBadge ? '<div style="margin-top:3px;">' + statusBadge + '</div>' : '') +
        '</div>' +
        '<div style="text-align:right;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:2px;">' +
          (toAmtStr ? '<div style="font-size:11px;font-weight:700;color:var(--accent-green);">' + toAmtStr + '</div>' : '') +
          '<div style="font-family:var(--font-mono);font-size:9px;color:var(--text-muted);">' + fromAmtStr + '</div>' +
          (sentUrl ? '<span class="material-icons-round" style="font-size:11px;color:'+iconColor+';opacity:0.55;margin-top:1px;pointer-events:none;">open_in_new</span>' : '') +
          (recvUrl && !sentUrl ? '<span class="material-icons-round" style="font-size:11px;color:var(--accent-green);opacity:0.55;margin-top:1px;pointer-events:none;">open_in_new</span>' : '') +
        '</div>';
      container.appendChild(row);
    });
  }
  window.brRenderRecentInline = brRenderRecentInline;

  // ── Clear inline recent (bridge page only) ──
  window.brClearRecentInline = function() {
    var now = Date.now();
    try { localStorage.setItem('brh_cleared_ts', String(now)); } catch(e) {}
    var listEl  = document.getElementById('br-recent-list');
    var clearEl = document.getElementById('br-recent-inline-clear');
    if (listEl) {
      listEl.style.transition = 'opacity 0.2s ease';
      listEl.style.opacity = '0';
      setTimeout(function() { brRenderRecentInline(); listEl.style.opacity = '1'; }, 200);
    }
    if (clearEl) clearEl.style.display = 'none';
    if (typeof haptic === 'function') haptic();
  };

  // ── Live chain list from LiFi API (with PRESET_CHAINS fallback) ──
  // Converts a LiFi chain object → our internal format
  function lifiChainToPreset(c) {
    // Pick a sensible emoji based on chain name keywords
    const n = (c.name || '').toLowerCase();
    let emoji = '🔗';
    if (n.includes('ethereum') || n.includes(' eth'))  emoji = '🔷';
    else if (n.includes('base'))                        emoji = '🔵';
    else if (n.includes('arbitrum'))                    emoji = '🔴';
    else if (n.includes('optimism'))                    emoji = '🟣';
    else if (n.includes('polygon') && n.includes('zk')) emoji = '🔮';
    else if (n.includes('polygon'))                     emoji = '🟪';
    else if (n.includes('bnb') || n.includes('bsc'))    emoji = '🟡';
    else if (n.includes('avax') || n.includes('avalanche')) emoji = '❄️';
    else if (n.includes('linea'))                       emoji = '🌀';
    else if (n.includes('scroll'))                      emoji = '📜';
    else if (n.includes('zksync') || n.includes('era')) emoji = '⚡';
    else if (n.includes('gnosis') || n.includes('xdai')) emoji = '🦉';
    else if (n.includes('fantom'))                      emoji = '👻';
    else if (n.includes('mantle'))                      emoji = '🌊';
    else if (n.includes('zora'))                        emoji = '🎨';
    else if (n.includes('blast'))                       emoji = '💥';
    else if (n.includes('taiko'))                       emoji = '🥁';
    else if (n.includes('sei'))                         emoji = '🌊';
    else if (n.includes('berachain') || n.includes('bera')) emoji = '🐻';
    else if (n.includes('ape'))                         emoji = '🦍';
    else if (n.includes('sonic'))                       emoji = '🔊';
    else if (n.includes('celo'))                        emoji = '🌱';
    else if (n.includes('moonbeam'))                    emoji = '🌕';
    else if (n.includes('moonriver'))                   emoji = '🌙';
    else if (n.includes('cronos'))                      emoji = '⚗️';
    else if (n.includes('aurora'))                      emoji = '🌅';
    else if (n.includes('fuse'))                        emoji = '💡';
    else if (n.includes('rootstock') || n.includes('rsk')) emoji = '₿';
    else if (n.includes('chiliz'))                      emoji = '⚽';
    else if (n.includes('flare'))                       emoji = '🔴';
    else if (n.includes('core'))                        emoji = '⚙️';
    else if (n.includes('lisk'))                        emoji = '💎';
    else if (n.includes('boba'))                        emoji = '🫧';
    else if (n.includes('kava'))                        emoji = '🔥';
    else if (n.includes('immutable'))                   emoji = '🎮';
    else if (n.includes('abstract'))                    emoji = '🎭';
    else if (n.includes('unichain'))                    emoji = '🦄';
    else if (n.includes('world'))                       emoji = '🌍';
    else if (n.includes('ink'))                         emoji = '🖊️';
    else if (n.includes('mode'))                        emoji = '🎯';
    else if (n.includes('story'))                       emoji = '📖';
    else if (n.includes('frax'))                        emoji = '🌀';
    else if (n.includes('manta'))                       emoji = '🐋';
    else if (n.includes('ronin'))                       emoji = '⚔️';
    else if (n.includes('gravity'))                     emoji = '🌌';
    else if (n.includes('opbnb'))                       emoji = '🟡';
    else if (n.includes('metis'))                       emoji = '🏔️';
    else if (n.includes('kroma'))                       emoji = '🎨';
    else if (n.includes('klaytn') || n.includes('kaia')) emoji = '🌺';
    else if (n.includes('xai'))                         emoji = '⚔️';
    else if (n.includes('cyber'))                       emoji = '🌐';
    else if (n.includes('bob'))                         emoji = '🟠';
    else if (n.includes('degen'))                       emoji = '🎩';
    else if (n.includes('soneium'))                     emoji = '🎵';
    else if (n.includes('sophon'))                      emoji = '💡';
    else if (n.includes('beam'))                        emoji = '🔦';
    else if (n.includes('skale'))                       emoji = '🔗';
    else if (n.includes('shape'))                       emoji = '🔶';
    else if (n.includes('solana'))                      emoji = '◎';
    else if (n.includes('ancient8'))                     emoji = '🏛️';
    else if (n.includes('treasure'))                     emoji = '💎';
    else if (n.includes('etherlink'))                    emoji = '🔗';
    else if (n.includes('morph'))                        emoji = '🦋';
    else if (n.includes('corn'))                         emoji = '🌽';
    else if (n.includes('lightlink'))                    emoji = '🦅';
    else if (n.includes('orderly'))                      emoji = '📊';
    else if (n.includes('oasis') && n.includes('sapphire')) emoji = '💎';
    else if (n.includes('oasis'))                        emoji = '💚';
    else if (n.includes('hemi'))                         emoji = '🌐';
    else if (n.includes('swell'))                        emoji = '🐳';
    else if (n.includes('bouncebit') || n.includes('bounce')) emoji = '🏀';
    else if (n.includes('wemix'))                        emoji = '🎮';
    else if (n.includes('iotex'))                        emoji = '🌐';
    else if (n.includes('plume'))                        emoji = '🪶';
    else if (n.includes('zetachain') || n.includes('zeta')) emoji = '⚛️';
    else if (n.includes('astar'))                        emoji = '⭐';
    else if (n.includes('rollux'))                       emoji = '🔄';
    else if (n.includes('syscoin'))                      emoji = '🔷';
    else if (n.includes('xdc') || n.includes('xinfin')) emoji = '🔷';
    else if (n.includes('coinex'))                       emoji = '💰';
    else if (n.includes('funki'))                        emoji = '🎉';
    else if (n.includes('botanix'))                      emoji = '🌿';
    else if (n.includes('xterio'))                       emoji = '🎮';
    else if (n.includes('rari'))                         emoji = '🖼️';
    else if (n.includes('zero network') || n.includes('zero'))  emoji = '0️⃣';
    else if (n.includes('monad'))                        emoji = '🔮';
    else if (n.includes('hyperliquid'))                  emoji = '💧';
    else if (n.includes('ailayer'))                      emoji = '🤖';
    else if (n.includes('kcc'))                          emoji = '🟢';
    else if (n.includes('evmos'))                        emoji = '🌀';
    else if (n.includes('bitkub'))                       emoji = '🇹🇭';
    else if (n.includes('kaia'))                         emoji = '🌺';
    else if (n.includes('aleph'))                        emoji = '♾️';
    else if (n.includes('exosama'))                      emoji = '🦖';
    else if (n.includes('dos chain'))                    emoji = '⚡';
    else if (n.includes('cyberconnect'))                 emoji = '🌐';
    else if (n.includes('neon'))                         emoji = '💡';
    else if (n.includes('xrpl'))                         emoji = '🔵';
    else if (n.includes('palette'))                      emoji = '🎨';
    else if (n.includes('shardeum'))                     emoji = '🔱';
    else if (n.includes('pikasso'))                      emoji = '🖼️';
    else if (n.includes('dexalot'))                      emoji = '📈';
    else if (n.includes('snax'))                         emoji = '🌀';
    else if (n.includes('automata'))                     emoji = '🤖';
    else if (n.includes('kronos') || n.includes('cronos zk')) emoji = '⚗️';
    else if (n.includes('proof of play') || n.includes('apex')) emoji = '🎲';
    else if (n.includes('saakuru'))                      emoji = '🌸';
    else if (n.includes('sanko'))                        emoji = '🎮';
    else if (n.includes('real'))                         emoji = '🏠';
    else if (n.includes('reya'))                         emoji = '🔴';
    return {
      id:         c.id,
      name:       c.name,
      emoji:      emoji,
      nativeSym:  c.coin || 'ETH',
      logoURI:    c.logoURI || null,
    };
  }

  // Fetch live chains and update PRESET_CHAINS (mutate in place so all refs update)
  async function brFetchLiveChains() {
    try {
      const res = await _brProxyFetch('https://li.quest/v1/chains?chainTypes=EVM', { headers: { 'x-lifi-api-key': 'b3e55edd-de70-4578-b761-cd2aac0fbae0.685a5adf-2580-486e-a8ff-1df4992b3f2e' } }, 8000);
      if (!res.ok) return;
      const data = await res.json();
      const lifiChains = (data.chains || [])
        .filter(c => c.mainnet && c.id)
        .map(lifiChainToPreset);

      // ── Deduplicate by chain id ──
      const seenIds = new Set();
      const deduped = [];
      lifiChains.forEach(c => {
        if (!seenIds.has(c.id)) { seenIds.add(c.id); deduped.push(c); }
      });

      // ── Inject Home active mainnet chain if missing from LiFi list ──
      const _homeChainId = (typeof activeHomeChainId !== 'undefined') ? activeHomeChainId : null;
      if (_homeChainId !== null && !seenIds.has(_homeChainId)) {
        const _homeChainInfo = (typeof getAllChains === 'function')
          ? getAllChains().find(function(c) { return c.chainId === _homeChainId; })
          : null;
        if (_homeChainInfo) {
          deduped.push({
            id:        _homeChainInfo.chainId,
            name:      _homeChainInfo.name,
            emoji:     _homeChainInfo.emoji || '🔗',
            nativeSym: _homeChainInfo.nativeSym || _homeChainInfo.symbol || 'ETH',
            logoURI:   _homeChainInfo.logoURI || null,
            color:     _homeChainInfo.color || '#6366f1',
          });
        }
      }

      const chains = deduped.sort((a, b) => {
          // Popular chains first (same order as original PRESET_CHAINS Tier 1)
          const PRIORITY = [8453,1,42161,10,137,56,43114,59144,534352,324];
          const ai = PRIORITY.indexOf(a.id), bi = PRIORITY.indexOf(b.id);
          if (ai !== -1 && bi !== -1) return ai - bi;
          if (ai !== -1) return -1;
          if (bi !== -1) return 1;
          return a.name.localeCompare(b.name);
        });
      if (chains.length > 0) {
        // Mutate the array in-place so brFilterChains / brRenderChainItems always use latest
        PRESET_CHAINS.length = 0;
        chains.forEach(c => PRESET_CHAINS.push(c));

        // ── Update default chain button logos after live data arrives ──
        const liveFrom = PRESET_CHAINS.find(c => c.id === br.fromChain.id);
        const liveTo   = PRESET_CHAINS.find(c => c.id === br.toChain.id);
        if (liveFrom) {
          br.fromChain = { ...br.fromChain, emoji: liveFrom.emoji, logoURI: liveFrom.logoURI || null };
          brSetChainBtnIcon('br-from-chain-emoji', liveFrom);
        }
        if (liveTo) {
          br.toChain = { ...br.toChain, emoji: liveTo.emoji, logoURI: liveTo.logoURI || null };
          brSetChainBtnIcon('br-to-chain-emoji', liveTo);
        }

        // Also extend BR_EXPLORERS with LiFi explorer URLs where we don't have one yet
        (data.chains || []).forEach(c => {
          if (c.id && c.metamask?.blockExplorerUrls?.[0] && !BR_EXPLORERS[c.id]) {
            const base = c.metamask.blockExplorerUrls[0].replace(/\/$/, '');
            BR_EXPLORERS[c.id] = base + '/tx/';
          }
          if (c.id && c.metamask?.rpcUrls?.[0] && !BR_CHAIN_RPC[c.id]) {
            BR_CHAIN_RPC[c.id] = [c.metamask.rpcUrls[0]];
          }
        });
      }
    } catch (e) {
      // Silently fall back to PRESET_CHAINS
    }
  }

  // ── Sync a single newly-added home chain into the bridge chain picker ──
  // Called from hcpSaveCustomChain & hcpAddFromChainList after a chain is saved.
  window.brSyncChainToPicker = function(chainObj) {
    if (!chainObj || !chainObj.chainId) return;
    // Duplicate guard — skip if already in PRESET_CHAINS
    if (PRESET_CHAINS.find(function(c) { return c.id === chainObj.chainId; })) return;
    var preset = {
      id:        chainObj.chainId,
      name:      chainObj.name       || ('Chain ' + chainObj.chainId),
      emoji:     chainObj.emoji      || '🔗',
      nativeSym: chainObj.nativeSym  || chainObj.symbol || 'ETH',
      logoURI:   chainObj.logoURI    || null,
      color:     chainObj.color      || '#6366f1',
    };
    PRESET_CHAINS.push(preset);
    // Re-sort: priority chains first, then alphabetical
    var PRIORITY = [8453,1,42161,10,137,56,43114,59144,534352,324];
    PRESET_CHAINS.sort(function(a, b) {
      var ai = PRIORITY.indexOf(a.id), bi = PRIORITY.indexOf(b.id);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.name.localeCompare(b.name);
    });
  };

  // ── Init ──
  function brInit() {
    brLoadTokens('from', br.fromChain.id);
    brLoadTokens('to',   br.toChain.id);
    brRefreshRecentTx();
    // Fetch live chain list in background — updates picker automatically
    brFetchLiveChains();
    // Ensure button starts disabled with correct hint
    brUpdateExecBtn(false);
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', brInit) : brInit();

  window.openJumper = function () {};
  window.loadBridgeIframe = function () {};

