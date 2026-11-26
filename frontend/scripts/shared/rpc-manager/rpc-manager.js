
  (function() {
  var __NX = window.__nxp.mod_rpc_manager; delete window.__nxp.mod_rpc_manager;


    // ── Get full RPC list for a page's rpcInput field ──
    window.thGetRpcList = function(rpcInputId) {
      var el = document.getElementById(rpcInputId);
      if (!el) return [];
      // 1. data-rpcs attribute set by chain picker (JSON array)
      try {
        var stored = el.getAttribute('data-rpcs');
        if (stored) {
          var arr = JSON.parse(stored);
          if (Array.isArray(arr) && arr.length) return __NX._thDepri(__NX._thDedupeRpcs(arr.filter(Boolean)));
        }
      } catch(_) {}
      // 2. data-chainid → look up from _getRpcListForChain
      var chainId = parseInt(el.getAttribute('data-chainid') || '', 10) || null;
      if (chainId && typeof _getRpcListForChain === 'function') {
        var fromChain = _getRpcListForChain(chainId);
        if (fromChain && fromChain.length) return __NX._thDepri(__NX._thDedupeRpcs(fromChain));
      }
      // 3. Fallback: value attr (single RPC)
      var v = el.value.trim();
      if (v) return [__NX._thNormalizeRpc(v)];
      return [];
    };

    // ── Current active RPC for a page ──
    window.thGetActiveRpc = function(rpcInputId) {
      var list = window.thGetRpcList(rpcInputId);
      if (!list.length) return '';
      var idx = __NX._thRpcIdx[rpcInputId] || 0;
      return list[Math.min(idx, list.length - 1)] || list[0];
    };

    // ── Reset cursor when chain changes ──
    window.thResetRpcIdx = function(rpcInputId) {
      __NX._thRpcIdx[rpcInputId] = 0;
      // Clear manual pin — chain changed, old pin no longer applies
      __NX._thManualPin[rpcInputId] = null;
      // BUG FIX: _thRpc429 is keyed by actual RPC URL, not by rpcInputId.
      // On chain switch, clear bans for all RPCs in this page's list.
      var _resetList = window.thGetRpcList(rpcInputId);
      _resetList.forEach(function(rpc) { delete __NX._thRpc429[__NX._thNormalizeRpc(rpc)]; });
      window.thSetRpcStatus(rpcInputId, 'idle');
    };

    // ══ STATUS BADGE SYSTEM ══════════════════════════════════════
    // Each TH page gets a tiny badge: 🟢 / 🟡 / 🔴 + truncated RPC URL
    // The badge element id = 'th-rpc-badge-' + rpcInputId

    var _TH_BADGE_STYLE = [
      'display:inline-flex;align-items:center;gap:5px;',
      'padding:3px 9px;border-radius:20px;',
      'font-family:var(--font-mono);font-size:9.5px;font-weight:600;',
      'letter-spacing:0.4px;cursor:pointer;transition:all .25s;',
      'border:1px solid rgba(255,255,255,0.08);',
      'backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);',
      'max-width:180px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;',
      'margin-left:6px;vertical-align:middle;flex-shrink:0;',
    ].join(''); __NX._TH_BADGE_STYLE = _TH_BADGE_STYLE;

    window.thSetRpcStatus = function(rpcInputId, state, rpcUrl) {
      try {
        var s = __NX._TH_BADGE_STATES[state] || __NX._TH_BADGE_STATES.idle;
        var badge = __NX._thGetOrCreateBadge(rpcInputId);
        if (!badge) return;
        var shortUrl = s.label;
        badge.setAttribute('style',
          _TH_BADGE_STYLE +
          'background:' + s.bg + ';' +
          'border-color:' + s.border + ';' +
          'color:' + s.color + ';'
        );
        badge.innerHTML = s.dot + ' <span style="overflow:hidden;text-overflow:ellipsis;display:inline-block;vertical-align:middle;">' + __NX._escHtml(shortUrl) + '</span>';
        // Pulse animation on switch
        if (state === 'switching') {
          badge.style.animation = 'th-rpc-pulse .7s ease infinite alternate';
        } else {
          badge.style.animation = '';
        }
      } catch(_) {}
    };

    // ══ CORE FALLBACK EXECUTOR ═══════════════════════════════════
    // thWithFallback(rpcInputId, fn, timeoutMs?)
    //   fn(provider) → Promise<any>
    //   Tries each RPC in turn; retries the operation (not just the provider).
    //   Never loops more than rpcList.length times total.
    //   Respects manually selected RPC (_thRpcIdx) — always starts there.

    window.thWithFallback = async function(rpcInputId, fn, timeoutMs) {
      var ms = timeoutMs || 10000;
      var list = window.thGetRpcList(rpcInputId);
      if (!list || !list.length) {
        throw new Error('[TH RPC] No RPCs configured for ' + rpcInputId);
      }
      // FIX: read chainId from the hidden input's data-chainid so _thMakeProvider
      // creates a static-network provider for the correct chain, even when
      // currentChainConfig belongs to a different TH section.
      var _thwEl = document.getElementById(rpcInputId);
      var _thwChainId = _thwEl ? (parseInt(_thwEl.getAttribute('data-chainid') || '', 10) || null) : null;

      var now = Date.now();
      // Always honor the manually-pinned index (set via _thSelectRpcManually or thResetRpcIdx)
      var startIdx = Math.min(__NX._thRpcIdx[rpcInputId] || 0, list.length - 1);

      // Build ordered list starting from last-known-good / manually selected
      var ordered = list.slice(startIdx).concat(list.slice(0, startIdx));

      // Non-banned first (preserving manual-first order), banned as last resort
      var available = ordered.filter(function(r) { var k = __NX._thNormalizeRpc(r); return !__NX._thRpc429[k] || now > __NX._thRpc429[k]; });
      var banned    = ordered.filter(function(r) { var k = __NX._thNormalizeRpc(r); return  __NX._thRpc429[k] && now <= __NX._thRpc429[k]; });
      var tryList   = available.concat(banned);

      // Show initial "connected" with the first-to-try RPC
      var initRpc = tryList[0] || list[0];
      window.thSetRpcStatus(rpcInputId, 'connected', initRpc);

      // ── Helper: write RPC events into the section's own log panel ──
      var _sLogFn = (typeof _thGetSectionLogFn === 'function') ? _thGetSectionLogFn(rpcInputId) : null;
      function _sLog(type, msg) {
        try { if (typeof _sLogFn === 'function') _sLogFn(type, msg); } catch(_) {}
      }

      var lastErr;
      for (var attempt = 0; attempt < tryList.length; attempt++) {
        var rpc = __NX._thNormalizeRpc(tryList[attempt]);
        var origIdx = list.indexOf(tryList[attempt]);
        if (origIdx < 0) origIdx = list.findIndex(function(r) { return __NX._thNormalizeRpc(r) === rpc; });
        var shortRpc = rpc.replace(/^https?:\/\//, '').slice(0, 40);
        try {
          var p = window._thMakeProvider(rpc, _thwChainId);
          // Use a closure to capture the current rpc value for the timeout
          var result = await (function(rpcUrl, provider) {
            return Promise.race([
              fn(provider),
              new Promise(function(_, rej) {
                setTimeout(function() { rej(new Error('TH RPC timeout: ' + rpcUrl)); }, ms);
              })
            ]);
          })(rpc, p);
          // ✅ Success — pin cursor to this RPC
          if (origIdx >= 0) __NX._thRpcIdx[rpcInputId] = origIdx;
          delete __NX._thRpc429[rpc];
          window.thSetRpcStatus(rpcInputId, 'connected', rpc);
          __NX._thLogRpc(rpcInputId, '✅ OK → ' + shortRpc);
          // Only log to section panel when we had to switch (attempt > 0)
          if (attempt > 0) {
            _sLog('success', '✅ RPC switched → ' + shortRpc);
          }
          return result;
        } catch(e) {
          lastErr = e;
          var errMsg = String((e && e.message) || '') + String((e && e.info && e.info.error && e.info.error.message) || '');
          var errCode = (e && (e.status || e.code || (e.error && e.error.code))) || 0;

          // Auth failure (401/403/"API key required"): this RPC will keep failing — ban for 10 min
          if (/unauthorized|api key|api-key|must authenticate|forbidden/i.test(errMsg) || errCode === 401 || errCode === 403) {
            __NX._thRpc429[rpc] = Date.now() + 10 * 60 * 1000;
            if (origIdx >= 0) __NX._thRpcIdx[rpcInputId] = (origIdx + 1) % list.length;
            __NX._thLogRpc(rpcInputId, '🔴 Auth required (banned 10m) → ' + shortRpc);
            _sLog('warning', '🔴 RPC needs API key — skipped → ' + shortRpc);
          } else
          // Rate-limit detection: ban for 20s (increased from 15s for more safety)
          if (errCode === 429 || errMsg.includes('429') || /rate.?limit|too.?many.?req/i.test(errMsg)) {
            __NX._thRpc429[rpc] = Date.now() + 20000;
            __NX._thLogRpc(rpcInputId, '⚠️ Rate-limited 20s → ' + shortRpc);
            _sLog('warning', '⚠️ RPC rate-limited (20s ban) → ' + shortRpc);
          } else {
            // Only advance cursor for non-rate-limit failures (preserve manual selection on rate limit)
            if (origIdx >= 0) __NX._thRpcIdx[rpcInputId] = (origIdx + 1) % list.length;
            __NX._thLogRpc(rpcInputId, '🔴 Failed [' + (attempt+1) + '/' + tryList.length + '] → ' + shortRpc + '  ' + errMsg.slice(0,50));
            _sLog('warning', '🔴 RPC failed [' + (attempt+1) + '/' + tryList.length + '] → ' + shortRpc);
          }

          // Show "switching" status and log if there's a next RPC
          if (attempt < tryList.length - 1) {
            var nextRpc = __NX._thNormalizeRpc(tryList[attempt + 1]);
            var shortNext = nextRpc.replace(/^https?:\/\//, '').slice(0, 40);
            __NX._thLogRpc(rpcInputId, '🟡 Switching → ' + shortNext);
            _sLog('info', '🟡 Switching RPC → ' + shortNext);
            window.thSetRpcStatus(rpcInputId, 'switching', nextRpc);
          }
          continue;
        }
      }

      // ── All RPCs failed — reset cursor to manually selected (or 0) ──
      // Don't reset to 0 blindly; if user manually picked one, keep it so next
      // attempt respects the user's preference.
      window.thSetRpcStatus(rpcInputId, 'failed', '');
      __NX._thLogRpc(rpcInputId, '🔴 ALL RPCS FAILED (' + list.length + ' tried)');
      _sLog('error', '🔴 All RPCs failed (' + list.length + ' tried) — tap RPC Status to switch, or change chain');
      throw lastErr || new Error('[TH RPC] All RPCs failed for ' + rpcInputId);
    };

    // ── Read helper: run a read call on the given provider first, then fail over across the RPC list ──
    window.thRead = async function(rpcInputId, provider, fn, timeoutMs) {
      try {
        return await Promise.race([
          fn(provider),
          new Promise(function(_, rej) { setTimeout(function(){ rej(new Error('TH RPC read timeout')); }, timeoutMs || 6000); })
        ]);
      } catch (_e) {
        return window.thWithFallback(rpcInputId, fn, timeoutMs || 8000);
      }
    };

    // ── Convenience: thGetProvider(rpcInputId) with fallback ──
    window.thGetProvider = async function(rpcInputId) {
      return window.thWithFallback(rpcInputId, async function(p) {
        await Promise.race([
          p.getBlockNumber(),
          new Promise(function(_, rej) { setTimeout(function(){ rej(new Error('probe timeout')); }, 4000); })
        ]);
        return p;
      }, 4000);
    };

    // ── Sync badge when chain changes (called by onSelect in each section) ──
    window.thOnChainSelect = function(rpcInputId) {
      // Remove stale badge so _thGetOrCreateBadge re-anchors it after chain change
      var _oldBadge = document.getElementById('th-rpc-badge-' + rpcInputId);
      if (_oldBadge && _oldBadge.parentNode) _oldBadge.parentNode.removeChild(_oldBadge);

      window.thResetRpcIdx(rpcInputId);
      var rpc = window.thGetActiveRpc(rpcInputId);
      if (rpc) {
        window.thSetRpcStatus(rpcInputId, 'connected', rpc);
        var shortRpc = rpc.replace(/^https?:\/\//, '').slice(0, 40);
        __NX._thLogRpc(rpcInputId, '⛓ Chain changed → ' + shortRpc);
        // Push chain-change info to the section's own log panel (no _thLogInitialRpc — avoids duplicate Connected message)
        // Chain changed log suppressed — "🟢 Connected" from _thLogInitialRpc is sufficient
      }
    };

    // ── Inject pulse keyframe (once) ──
    (function() {
      if (document.getElementById('th-rpc-pulse-style')) return;
      var s = document.createElement('style');
      s.id = 'th-rpc-pulse-style';
      s.textContent = '@keyframes th-rpc-pulse{from{opacity:1}to{opacity:.45}}';
      document.head.appendChild(s);
    })();

    // ─────────────────────────────────────────────────────────────
    // END SMART MULTI-RPC FALLBACK ENGINE
    // ─────────────────────────────────────────────────────────────

    // ── _thMakeProvider: ethers v6-safe provider factory ──────────
    // Uses staticNetwork so JsonRpcProvider NEVER auto-polls eth_chainId
    // in the background, eliminating the repeated
    // "failed to detect network; retry in 1s" console spam.
    // chainId is taken from the argument, or from currentChainConfig,
    // so every Transfer Hub section gets a silent, static provider.
    window._thMakeProvider = function(rpcUrl, chainId) {
      var cid = chainId
        || (typeof currentChainConfig !== 'undefined' && currentChainConfig && currentChainConfig.chainId)
        || null;
      if (cid) {
        return new ethers.JsonRpcProvider(rpcUrl, Number(cid), { staticNetwork: true });
      }
      // chainId unknown yet — plain provider (performs one detect, then goes static)
      return new ethers.JsonRpcProvider(rpcUrl);
    };
    window._thErrReason = __NX._thErrReason;

    window.thResilientSendAndConfirm = async function(opts) {
      var rpcInputId  = opts.rpcInputId;
      var sendFn      = opts.sendFn;       // async fn(provider) → tx object with .hash
      var logFn       = typeof opts.logFn === 'function' ? opts.logFn : function(){};
      var label       = opts.label || 'TX';
      var waitConfirm = opts.waitConfirm !== false; // default true

      var rpcList     = (typeof window.thGetRpcList === 'function') ? window.thGetRpcList(rpcInputId) : [];
      var maxTries    = Math.max(rpcList.length, 1);
      var chainId     = parseInt((document.getElementById(rpcInputId)||{}).getAttribute?.('data-chainid')||'', 10) || null;

      var sentTxHash  = null;
      var lastErr;

      for (var _try = 0; _try < maxTries; _try++) {
        try {
          // ── Case 2: TX already broadcast, confirmation failed last round ──
          if (sentTxHash) {
            logFn('info', '🔄 Confirmation RPC fail — waiting for already-broadcast TX on next RPC...');
            var _fallbackP = await (async function() {
              for (var _fi = 0; _fi < rpcList.length; _fi++) {
                try {
                  var _fp = window._thMakeProvider(rpcList[(_try + _fi) % rpcList.length], chainId);
                  await Promise.race([_fp.getBlockNumber(), new Promise(function(_,r){ setTimeout(function(){ r(new Error('probe')); }, 4000); })]);
                  return _fp;
                } catch(_) {}
              }
              return opts.currentProvider || null;
            })();
            if (!_fallbackP) throw new Error('No fallback provider available');
            if (!waitConfirm) return { hash: sentTxHash };
            var _receipt = await _fallbackP.waitForTransaction(sentTxHash, 1, 60000);
            logFn('success', '✅ ' + label + ' confirmed via fallback RPC! Block: ' + _receipt.blockNumber);
            return _receipt;
          }

          // ── Case 1: Normal send path ──
          if (_try > 0) {
            logFn('info', '🔄 RPC fail — retrying send on next RPC [' + (_try + 1) + '/' + maxTries + ']...');
            // Get a fresh working provider
            try {
              var _freshP = await window.thWithFallback(rpcInputId, async function(_p) {
                await Promise.race([_p.getBlockNumber(), new Promise(function(_,r){ setTimeout(function(){ r(new Error('probe')); }, 4000); })]);
                return _p;
              }, 5000);
              opts.currentProvider = _freshP;
              if (typeof opts.onProviderRefresh === 'function') opts.onProviderRefresh(_freshP);
            } catch(_) { /* keep existing provider */ }
          }

          var tx = await sendFn(opts.currentProvider);
          sentTxHash = tx.hash;

          if (!waitConfirm) return { hash: sentTxHash, opHash: tx.opHash || null };

          // Wait for confirmation — may throw on RPC drop
          var receipt = await tx.wait();
          return receipt;

        } catch(_err) {
          lastErr = _err;
          var _isLast = (_try === maxTries - 1);
          if (sentTxHash) {
            logFn('warning', '⚠️ Confirmation RPC failed for TX ' + sentTxHash.slice(0,10) + '... — switching RPC');
            if (_isLast) throw _err;
            // next iteration hits the sentTxHash branch
          } else {
            if (__NX._thIsTxLevelError(_err)) {
              // Not an RPC problem (e.g. insufficient funds / underpriced) — retrying other RPCs is pointless
              logFn('error', '❌ Send rejected: ' + __NX._thErrReason(_err));
              throw _err;
            }
            logFn('warning', '⚠️ Send failed (RPC error: ' + __NX._thErrReason(_err) + ') — ' + (_isLast ? 'no more RPCs, aborting.' : 'will retry on next RPC...'));
            if (_isLast) throw _err;
            // FIX: the send failed OUTSIDE thWithFallback, so the cursor never moved and the probe
            // below would hand back the SAME failing RPC every time. Move on explicitly.
            __NX._thAdvanceRpc(rpcInputId);
          }
        }
      }
      throw lastErr || new Error('[TH] All RPCs failed for ' + rpcInputId);
    }; // flat all chains

    window.getAllTHChains = function getAllTHChains() {
      // Use Home section chains (getAllChains = BUILTIN_CHAINS + custom chains)
      var all = [];
      try {
        if (typeof getAllChains === 'function') {
          all = getAllChains().filter(function(c) { return c.chainId !== null && c.chainId !== undefined; }).map(function(c) {
            // Build full RPC list: _getRpcListForChain merges builtin + custom + user-added RPCs
            var fullRpcs = [];
            try {
              if (typeof _getRpcListForChain === 'function') fullRpcs = _getRpcListForChain(c.chainId);
            } catch(_) {}
            if (!fullRpcs.length) fullRpcs = (c.rpcs && c.rpcs.length) ? c.rpcs : (c.rpc ? [c.rpc] : []);
            var primaryRpc = fullRpcs[0] || (c.rpcs && c.rpcs[0]) || c.rpc || '';
            return { name: c.name, symbol: c.nativeSym || c.symbol || 'ETH', chainId: c.chainId, rpc: primaryRpc, rpcs: fullRpcs, explorer: c.explorer || '', isCustom: c.isCustom || false, logoURI: c.logoURI || null, emoji: c.emoji || null };
          });
        }
      } catch(_) {}
      if (!all.length) {
        // fallback: hardcoded Base
        all = [{ name: 'Base', symbol: 'ETH', chainId: 8453, rpc: 'https://mainnet.base.org', rpcs: ['https://mainnet.base.org','https://base.publicnode.com','https://base-rpc.publicnode.com'], explorer: 'https://basescan.org' }];
      }
      return all;
    }


    // ── TH Explorer URL resolver — always uses the selected chain's explorer ──
    // Returns base explorer URL (no trailing slash), never falls back to etherscan.
    window.getTHExplorer = function getTHExplorer(chainId) {
      try {
        if (chainId) {
          var chains = (typeof getAllTHChains === 'function') ? getAllTHChains() : [];
          var ch = chains.find(function(c){ return c.chainId === chainId; });
          if (ch && ch.explorer) return ch.explorer.replace(/\/$/, '');
        }
      } catch(_) {}
      // Fallback: try getAllChains (Home section)
      try {
        if (chainId && typeof getAllChains === 'function') {
          var hc = getAllChains().find(function(c){ return c.chainId === chainId; });
          if (hc && (hc.explorer || hc.blockExplorer)) return (hc.explorer || hc.blockExplorer).replace(/\/$/, '');
        }
      } catch(_) {}
      // Final hardcoded fallback — covers all major chains
      var _EXPLORER_FALLBACK = {
        1:'https://etherscan.io', 56:'https://bscscan.com', 137:'https://polygonscan.com',
        42161:'https://arbiscan.io', 10:'https://optimistic.etherscan.io', 8453:'https://basescan.org',
        43114:'https://snowtrace.io', 250:'https://ftmscan.com', 42220:'https://celoscan.io',
        100:'https://gnosisscan.io', 59144:'https://lineascan.build', 534352:'https://scrollscan.com',
        324:'https://explorer.zksync.io', 5000:'https://explorer.mantle.xyz', 81457:'https://blastscan.io',
        34443:'https://explorer.mode.network', 7777777:'https://explorer.zora.energy',
        1088:'https://andromeda-explorer.metis.io', 1101:'https://zkevm.polygonscan.com',
        57073:'https://explorer.inkonchain.com', 1284:'https://moonscan.io',
        1285:'https://moonriver.moonscan.io', 25:'https://cronoscan.com',
        1313161554:'https://explorer.aurora.dev', 122:'https://explorer.fuse.io',
        2222:'https://explorer.kava.io', 30:'https://explorer.rsk.co',
        690:'https://explorer.redstonechain.com', 13371:'https://explorer.immutable.com',
        185:'https://explorer.mintchain.io', 1625:'https://explorer.gravity.xyz',
        60808:'https://explorer.gobob.xyz', 14:'https://flare-explorer.flare.network',
        1329:'https://seitrace.com', 97:'https://testnet.bscscan.com',
        11155111:'https://sepolia.etherscan.io', 17000:'https://holesky.etherscan.io',
        80002:'https://amoy.polygonscan.com', 84532:'https://sepolia.basescan.org',
        421614:'https://sepolia.arbiscan.io', 11155420:'https://sepolia-optimistic.etherscan.io',
        43113:'https://testnet.snowtrace.io', 534351:'https://sepolia.scrollscan.com',
        4002:'https://testnet.ftmscan.com'
      };
      if (chainId && _EXPLORER_FALLBACK[chainId]) return _EXPLORER_FALLBACK[chainId];
      return 'https://etherscan.io';
    };

    // ── Smart helper: get tx URL for current TH chain ──
    window.getTHExplorerTx = function getTHExplorerTx(chainId) {
      return window.getTHExplorer(chainId) + '/tx/';
    };

    // ── Smart helper: get explorer from a chain config object ──
    window.getTHExplorerFromConfig = function getTHExplorerFromConfig(cfg) {
      if (cfg && cfg.explorer) return cfg.explorer.replace(/\/$/, '');
      return window.getTHExplorer(cfg && cfg.chainId);
    };

    // ── Smart header chain picker: detects active mode for dual-mode sections ──
    window.thOpenHeaderChainPicker = function(sectionKey) {
      var resolvedKey = sectionKey;
      if (sectionKey === 'batch') {
        // Always use batchNative — single shared chain for both modes
        resolvedKey = 'batchNative';
      } else if (sectionKey === 'mkNative') {
        // Always use mkNative — single chain for both Native and Token modes
        resolvedKey = 'mkNative';
      } else if (sectionKey === 'nftDist') {
        // nftDist or nftCollect?
        resolvedKey = (typeof currentNftMode !== 'undefined' && currentNftMode === 'collect') ? 'nftCollect' : 'nftDist';
      } else if (sectionKey === 'w2wNative') {
        // w2wNative or w2wToken?
        var w2wTokenBtn = document.getElementById('w2wTokenModeBtn');
        resolvedKey = (w2wTokenBtn && w2wTokenBtn.classList.contains('active')) ? 'w2wToken' : 'w2wNative';
      }
      thOpenChainPicker(resolvedKey);
    };

    window.thOpenChainPicker = function(sectionId) {
      __NX._thCPSection = sectionId;
      var cfg = __NX.TH_CHAIN_MAP[sectionId];
      var sub = document.getElementById('th-chain-modal-sub');
      if (sub) sub.textContent = cfg ? cfg.label : 'NETWORK';
      var inp = document.getElementById('th-chain-search');
      if (inp) inp.value = '';
      thRenderChainList();
      var ov = document.getElementById('th-chain-overlay');
      if (ov) ov.classList.add('open');
      if (typeof haptic === 'function') haptic();
    };

    window.thCloseChainPicker = function() {
      var ov = document.getElementById('th-chain-overlay');
      if (ov) ov.classList.remove('open');
    };

    window.thRenderChainList = function() {
      var list = document.getElementById('th-chain-list');
      if (!list) return;
      list.innerHTML = '';
      var inp = document.getElementById('th-chain-search');
      var clr = document.getElementById('th-chain-search-clear');
      var q = inp ? inp.value.trim().toLowerCase() : '';
      if (clr) clr.style.display = q ? 'block' : 'none';

      var all = getAllTHChains();
      var filtered = q ? all.filter(function(c) {
        return c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q) || String(c.chainId||'').includes(q);
      }) : all;

      if (!filtered.length) {
        list.innerHTML = '<div style="text-align:center;padding:32px 0;font-family:var(--font-mono);font-size:11px;color:var(--text-muted);">No networks found</div>';
        return;
      }

      // Detect currently selected for this section
      var curRpcId = __NX._thCPSection && __NX.TH_CHAIN_MAP[__NX._thCPSection] ? __NX.TH_CHAIN_MAP[__NX._thCPSection].rpcId : null;
      var curRpc   = curRpcId ? (document.getElementById(curRpcId)||{}).value||'' : '';

      filtered.forEach(function(chain) {
        var isSel = curRpc && chain.rpc && curRpc.trim() === chain.rpc.trim();
        var item = document.createElement('div');
        item.className = 'hcp-chain-item' + (isSel ? ' selected' : '');
        var em = __NX.chainEmoji(chain);
        var logoHtml = (typeof _chainLogoHtml === 'function')
          ? _chainLogoHtml(chain.logoURI || null, em, 26)
          : '<span style="font-size:20px;line-height:1;">' + em + '</span>';
        item.innerHTML = '<div class="hcp-chain-emoji" style="' + (chain.chainId===1?'border:1.5px solid #627EEA44;':'') + '">'
          + logoHtml + '</div>'
          + '<div class="hcp-chain-info"><div class="hcp-chain-name">' + chain.name + '</div>'
          + '<div class="hcp-chain-sub">Chain ID: ' + (chain.chainId||'—') + ' · ' + chain.symbol + '</div></div>'
          + (isSel ? '<span class="material-icons-round" style="font-size:18px;color:var(--accent-primary);flex-shrink:0;">check_circle</span>'
                   : '<span style="width:18px;flex-shrink:0;"></span>');
        if (chain.logoURI && typeof _fixChainLogos === 'function') _fixChainLogos(item);

        var _sy = 0, _sx = 0;
        item.addEventListener('touchstart', function(e){ _sy=e.touches[0].clientY; _sx=e.touches[0].clientX; }, {passive:true});
        item.addEventListener('touchend', function(e){
          if (Math.abs(e.changedTouches[0].clientY-_sy)>8||Math.abs(e.changedTouches[0].clientX-_sx)>8) return;
          e.preventDefault(); thSetChain(chain); }, {passive:false});
        item.addEventListener('click', function(){ thSetChain(chain); });
        list.appendChild(item);
      });
    };

    window.thSetChain = function(chain) {
      var sec = __NX._thCPSection;
      var cfg = __NX.TH_CHAIN_MAP[sec];
      if (!cfg) { thCloseChainPicker(); return; }

      // Build full RPC list for this chain
      var fullRpcs = [];
      try {
        if (chain.chainId && typeof _getRpcListForChain === 'function') {
          fullRpcs = _getRpcListForChain(chain.chainId);
        }
      } catch(_) {}
      if (!fullRpcs.length) fullRpcs = chain.rpcs || (chain.rpc ? [chain.rpc] : []);

      // Update RPC field — primary RPC as visible value, full list + chainId in data attrs
      var rpcEl = document.getElementById(cfg.rpcId);
      if (rpcEl) {
        // isCustom placeholder (no chainId, no rpc) → leave blank for manual entry
        // User-added chains (builtIn:false) always have rpcs → use them normally
        var _hasRpc = !!(fullRpcs.length || chain.rpc);
        if (chain.isCustom && !_hasRpc) {
          rpcEl.value = '';
          rpcEl.placeholder = 'Enter custom RPC URL…';
          rpcEl.removeAttribute('data-rpcs');
          rpcEl.removeAttribute('data-chainid');
        } else {
          rpcEl.value = fullRpcs[0] || chain.rpc || '';
          rpcEl.placeholder = 'https://...';
          // Store the full list so provider builders can use fallback
          rpcEl.setAttribute('data-rpcs', JSON.stringify(fullRpcs.length ? fullRpcs : [chain.rpc]));
          rpcEl.setAttribute('data-chainid', chain.chainId || '');
        }
      }

      // Update button display
      var em   = __NX.chainEmoji(chain);
      var nameEl = document.getElementById('th-net-name-' + sec);
      var symEl  = document.getElementById('th-net-sym-' + sec);
      var emEl   = document.getElementById('th-net-emoji-' + sec);
      var btnEl  = document.getElementById('th-net-btn-' + sec);
      if (emEl)  emEl.textContent = em;
      if (nameEl) nameEl.textContent = chain.name;
      if (symEl)  symEl.textContent = chain.symbol + (chain.chainId ? ' · Chain ' + chain.chainId : '');
      if (btnEl) { btnEl.style.borderColor = 'rgba(99,102,241,0.5)'; btnEl.style.background = 'rgba(99,102,241,0.06)';
        setTimeout(function(){ if(btnEl){btnEl.style.borderColor='';btnEl.style.background='';} }, 800); }

      // ── Helper: set logo or emoji in a header span ──
      function _thSetHdrLogo(spanEl, chain) {
        if (!spanEl) return;
        var em = __NX.chainEmoji(chain);
        if (chain.logoURI && typeof _chainLogoHtml === 'function') {
          spanEl.innerHTML = _chainLogoHtml(chain.logoURI, em, 18);
          if (typeof _fixChainLogos === 'function') _fixChainLogos(spanEl);
        } else {
          spanEl.textContent = em;
        }
      }

      // ── Sync header chain button ──
      var hdrEmEl  = document.getElementById('th-net-emoji-' + sec + '-hdr');
      var hdrNmEl  = document.getElementById('th-net-name-'  + sec + '-hdr');
      _thSetHdrLogo(hdrEmEl, chain);
      if (hdrNmEl) hdrNmEl.textContent = chain.name;
      // ── Also sync paired primary header (for dual-mode sections) ──
      var _dualPrim = { batchToken:'batchNative', mkToken:'mkNative', nftCollect:'nftDist', w2wToken:'w2wNative', w2wNative:'w2wNative' };
      var _prim = _dualPrim[sec];
      if (_prim) {
        var pHdrEm = document.getElementById('th-net-emoji-' + _prim + '-hdr');
        var pHdrNm = document.getElementById('th-net-name-'  + _prim + '-hdr');
        _thSetHdrLogo(pHdrEm, chain);
        if (pHdrNm) pHdrNm.textContent = chain.name;
      }

      // ── Persist selected chain per-section so it survives page reopen ──
      try {
        if (chain.chainId && sec) {
          localStorage.setItem('transferHub_chain_' + sec, String(chain.chainId));
        }
      } catch(_) {}

      // Run section callback
      if (cfg.onSelect) try { cfg.onSelect(chain); } catch(_) {}

      thCloseChainPicker();
      if (typeof haptic === 'function') haptic();
    };

    // ── Public: re-sync all TH sections to their own saved chains (called on page open) ──
    window.thSyncHomeChain = function() {
      __NX.thApplyDefaultToAll(null); // each section resolves its own chain internally
    };

    // ── Per-section header chain sync — called every time a section is opened ──
    // Ensures the chain header button always shows the saved/selected chain, even on re-open
    window.thSyncSectionHeader = function(sectionId) {
      var sectionChain = (typeof __NX.getTHSectionChain === 'function') ? __NX.getTHSectionChain(sectionId) : null;
      if (!sectionChain) return;
      var em = (typeof __NX.chainEmoji === 'function') ? __NX.chainEmoji(sectionChain) : '⛓️';
      var hdrEmEl = document.getElementById('th-net-emoji-' + sectionId + '-hdr');
      var hdrNmEl = document.getElementById('th-net-name-'  + sectionId + '-hdr');
      if (hdrNmEl) hdrNmEl.textContent = sectionChain.name;
      if (hdrEmEl) {
        if (sectionChain.logoURI && typeof _chainLogoHtml === 'function') {
          hdrEmEl.innerHTML = _chainLogoHtml(sectionChain.logoURI, em, 18);
          if (typeof _fixChainLogos === 'function') _fixChainLogos(hdrEmEl);
        } else {
          hdrEmEl.textContent = em;
        }
      }
      // Also update RPC input and section chain config if available
      var cfg = (typeof __NX.TH_CHAIN_MAP !== 'undefined') ? __NX.TH_CHAIN_MAP[sectionId] : null;
      if (cfg) {
        var rpcEl = document.getElementById(cfg.rpcId);
        if (rpcEl) {
          var rpcs = (typeof _getRpcListForChain === 'function' && sectionChain.chainId) ? _getRpcListForChain(sectionChain.chainId) : (sectionChain.rpcs || (sectionChain.rpc ? [sectionChain.rpc] : []));
          rpcEl.value = rpcs[0] || sectionChain.rpc || '';
          rpcEl.setAttribute('data-rpcs', JSON.stringify(rpcs));
          if (sectionChain.chainId) rpcEl.setAttribute('data-chainid', String(sectionChain.chainId));
        }
        // Fire onSelect to keep section config in sync
        if (cfg.onSelect) try { cfg.onSelect(sectionChain); } catch(_) {}
      }
    };



        // Init buttons with each section's own saved chain on first load
    document.addEventListener('DOMContentLoaded', function() {
      __NX.thApplyDefaultToAll(null); // each section resolves its own saved chain
      // ── Seed RPC badges for all pages after a short defer so section headers are in DOM ──
      setTimeout(function() {
        try {
          var _allRpcIds = [
            'rpcUrl','rpcUrlToken','rpcUrlMultiKeyNative','rpcUrlMultiKeyToken',
            'rpcUrlNft','rpcUrlNftCollect','rpcUrlSelfTransfer','rpcUrlBalanceCheck',
            'withdrawRpcUrl','rpcUrlApproval','rpcUrlMultiApproval','rpcUrlW2W','rpcUrlW2WToken'
          ];
          _allRpcIds.forEach(function(id) {
            var el = document.getElementById(id);
            if (!el) return;
            var rpcs = window.thGetRpcList ? window.thGetRpcList(id) : [];
            if (rpcs.length) {
              window.thSetRpcStatus && window.thSetRpcStatus(id, 'connected', rpcs[0]);
            } else {
              window.thSetRpcStatus && window.thSetRpcStatus(id, 'idle');
            }
          });
        } catch(_) {}
      }, 600);
    });
  })();
  