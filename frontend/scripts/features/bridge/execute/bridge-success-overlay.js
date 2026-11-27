
    /* ── Bridge Success Overlay ── */
    (function(){
      var _ov = null, _card = null;
      var _bsoPending = false; // true = still waiting for receiver tx
      var _bsoIsSameChain = false; // true = same-chain DEX swap (no receiver tx)
      var _bsoProvider = 'lifi'; // 'lifi' | 'rubic' | 'rango' | 'socket' — active bridge provider
      var _bsoCountdownInterval = null; // countdown timer interval
      var _bsoCountdownSecs = 0;       // remaining seconds

      function _bsoStartCountdown(totalSecs, spanId) {
        if (_bsoCountdownInterval) clearInterval(_bsoCountdownInterval);
        _bsoCountdownSecs = totalSecs;
        var el = document.getElementById(spanId);
        function _fmt(s) {
          if (s >= 0) {
            if (s < 60) return s + 's';
            var m = Math.floor(s / 60), r = s % 60;
            return r > 0 ? m + 'm ' + r + 's' : m + 'm';
          } else {
            // overtime — show negative
            if (s > -60) return s + 's';
            var m = Math.floor(s / 60), r = s % 60;
            return r !== 0 ? m + 'm ' + r + 's' : m + 'm';
          }
        }
        if (el) el.textContent = _fmt(_bsoCountdownSecs);
        _bsoCountdownInterval = setInterval(function() {
          _bsoCountdownSecs--;
          var elNow = document.getElementById(spanId);
          if (elNow) elNow.textContent = _fmt(_bsoCountdownSecs);
        }, 1000);
      }

      function _bsoStopCountdown(spanId, doneText) {
        if (_bsoCountdownInterval) { clearInterval(_bsoCountdownInterval); _bsoCountdownInterval = null; }
        var el = document.getElementById(spanId);
        if (el && doneText !== undefined) el.textContent = doneText;
      }

      function _init() {
        _ov   = document.getElementById('br-success-overlay');
        _card = document.getElementById('br-success-card');
      }

      window._bsoOpen = function(opts) {
        _init();
        if (!_ov) return;

        // ── Always reset stale state from any previous tx before opening for new one ──
        window._bsoReopenedFromHistory = false;
        window._bsoPendingHistId       = null;
        window._bsoSentHash            = null;
        window._bsoSentExplorer        = null;
        window._bsoRecvHash            = null;
        window._bsoRecvExplorer        = null;

        // Populate token flow
        var fromAmt = opts.fromAmt  || '—';
        var fromSym = opts.fromSym  || '—';
        var toSym   = opts.toSym    || '—';
        var fromChain = opts.fromChain || '';
        var toChain   = opts.toChain   || '';
        _bsoIsSameChain = opts.isSameChain || false;
        _bsoProvider    = opts.provider || (typeof window._brGetProvider === 'function' ? window._brGetProvider() : 'lifi');

        document.getElementById('bso-from-amt').textContent   = fromAmt;
        document.getElementById('bso-from-sym').textContent   = fromSym;
        document.getElementById('bso-to-sym').textContent     = toSym;
        document.getElementById('bso-to-amt').textContent     = '—';

        // Chain labels: hide for same-chain swap, show for bridge
        var fromChainEl = document.getElementById('bso-from-chain');
        var toChainEl   = document.getElementById('bso-to-chain');
        if (_bsoIsSameChain) {
          fromChainEl.textContent = fromChain;
          fromChainEl.style.display = 'none';
          toChainEl.textContent   = toChain;
          toChainEl.style.display = 'none';
        } else {
          fromChainEl.textContent = fromChain;
          fromChainEl.style.display = '';
          toChainEl.textContent   = toChain;
          toChainEl.style.display = '';
        }

        // Token icons from bridge state
        var _tiHtml = typeof window.tokenIconHTML === 'function' ? window.tokenIconHTML : (typeof tokenIconHTML === 'function' ? tokenIconHTML : null);
        if (_tiHtml && typeof br !== 'undefined') {
          document.getElementById('bso-from-icon').innerHTML = _tiHtml(br.fromToken, 36);
          document.getElementById('bso-to-icon').innerHTML   = _tiHtml(br.toToken, 36);
        }

        // Reset state — title/labels differ for same-chain vs bridge
        document.getElementById('bso-title').textContent        = _bsoIsSameChain ? 'Swapping…' : 'Bridging…';
        document.getElementById('bso-title').style.color        = 'var(--accent-primary)';
        document.getElementById('bso-subtitle').textContent     = 'TRANSACTION SENT';
        document.getElementById('bso-done-btn').style.display   = 'none';

        // ── Extra info grid (same-chain swap only) ──
        var extraEl = document.getElementById('bso-extra-info');
        var bridgeInfoEl = document.getElementById('bso-bridge-info');
        if (extraEl) {
          if (_bsoIsSameChain) {
            extraEl.style.display = 'block';
            if (bridgeInfoEl) bridgeInfoEl.style.display = 'none';
            // Network
            var chainSpan = document.querySelector('#bso-info-chain span:last-child');
            if (chainSpan) chainSpan.textContent = fromChain || '—';
            // Chain logo
            var chainLogoSpan = document.getElementById('bso-info-chain-logo');
            if (chainLogoSpan) {
              try {
                var _cid = (typeof br !== 'undefined' && br.fromChain && br.fromChain.id) ? br.fromChain.id : null;
                var _logoURI = null;
                var _emoji = '🔗';
                if (_cid && typeof NETWORKS !== 'undefined') {
                  var _netDef = NETWORKS.find(function(n){ return n.id === _cid; });
                  if (_netDef) { _logoURI = _netDef.logoURI || null; _emoji = _netDef.emoji || '🔗'; }
                }
                if (!_logoURI && _cid) {
                  var _slugMap = {1:'ethereum',56:'smartchain',137:'polygon',42161:'arbitrum',10:'optimism',8453:'base',43114:'avalanchec',250:'fantom',42220:'celo',100:'xdai',59144:'linea',534352:'scroll'};
                  var _sl = _slugMap[_cid];
                  if (_sl) _logoURI = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/' + _sl + '/info/logo.png';
                }
                chainLogoSpan.innerHTML = typeof _chainLogoHtml === 'function'
                  ? _chainLogoHtml(_logoURI, _emoji, 14)
                  : (_logoURI ? '<img src="'+_logoURI+'" style="width:14px;height:14px;border-radius:4px;object-fit:cover;">' : '<span style="font-size:11px;">'+_emoji+'</span>');
                if (_logoURI && typeof _fixChainLogos === 'function') _fixChainLogos(chainLogoSpan);
              } catch(_clErr) {}
            }
            // Protocol — pull DEX name + logo from route steps
            var protocolSpan = document.querySelector('#bso-info-protocol span:last-child');
            var protocolLogoSpan = document.getElementById('bso-info-protocol-logo');
            if (typeof br !== 'undefined' && br.routes && br.selectedRoute !== null) {
              var _rt = br.routes[br.selectedRoute];
              var _steps = (_rt && _rt.steps) || (_rt && _rt.includedSteps) || [];
              var _tools = _steps.length
                ? _steps.map(function(s){ return { name: (s.toolDetails && s.toolDetails.name) || s.tool || '', logo: (s.toolDetails && s.toolDetails.logoURI) || '' }; }).filter(function(t){ return t.name; })
                : [{ name: (_rt && _rt.toolDetails && _rt.toolDetails.name) || (_rt && _rt.tool) || 'LiFi', logo: (_rt && _rt.toolDetails && _rt.toolDetails.logoURI) || '' }];
              var _uniqueTools = [];
              var _seenNames = {};
              _tools.forEach(function(t){ if (!_seenNames[t.name]) { _seenNames[t.name] = true; _uniqueTools.push(t); } });
              var _primaryTool = _uniqueTools[0] || { name: 'LiFi', logo: '' };
              if (protocolSpan) protocolSpan.textContent = _uniqueTools.map(function(t){ return t.name; }).join(' + ');
              if (protocolLogoSpan) {
                if (_primaryTool.logo) {
                  protocolLogoSpan.innerHTML = '<img src="' + _primaryTool.logo + '" style="width:14px;height:14px;border-radius:3px;object-fit:cover;" onerror="this.style.display=\'none\'">';
                } else {
                  protocolLogoSpan.innerHTML = '<span class="material-icons-round" style="font-size:10px;color:var(--neon-purple);">alt_route</span>';
                }
              }
            } else {
              if (protocolSpan) protocolSpan.textContent = '—';
              if (protocolLogoSpan) protocolLogoSpan.innerHTML = '<span class="material-icons-round" style="font-size:10px;color:var(--neon-purple);">alt_route</span>';
            }
            // Gas Fee — from route gasCostUSD if available
            var feeSpan = document.querySelector('#bso-info-fee span:last-child');
            if (feeSpan && typeof br !== 'undefined' && br.routes && br.selectedRoute !== null) {
              var _rt2 = br.routes[br.selectedRoute];
              var _gasCosts = _rt2 && _rt2.estimate && _rt2.estimate.gasCosts;
              var _gasUSD = _gasCosts && _gasCosts[0] && _gasCosts[0].amountUSD;
              feeSpan.textContent = _gasUSD ? '≈ $' + parseFloat(_gasUSD).toFixed(3) : '—';
              // Protocol fee row — show only for Rubic routes
              var _protoRow = document.getElementById('bso-protocol-fee-row');
              var _protoVal = document.getElementById('bso-info-protocol-fee-val');
              if (_rt2 && _rt2._provider === 'rubic' && _rt2._protocolFeeUsd != null) {
                if (_protoRow) _protoRow.style.display = '';
                if (_protoVal) _protoVal.textContent = _rt2._protocolFeeUsd > 0.01 ? '≈ $' + _rt2._protocolFeeUsd.toFixed(3) : 'FREE';
              } else {
                if (_protoRow) _protoRow.style.display = 'none';
              }
            } else if (feeSpan) { feeSpan.textContent = '—'; }
            // Est. time — countdown timer on bso-info-time
            (function() {
              var _rt3 = (typeof br !== 'undefined' && br.routes && br.selectedRoute !== null) ? br.routes[br.selectedRoute] : null;
              var _dur = (_rt3 && _rt3.estimate && _rt3.estimate.executionDuration) || 15;
              _bsoStartCountdown(_dur, 'bso-info-time-val');
            })();
            // Reset TX HASH row — will be populated by _bsoSetSentHash immediately after _bsoOpen
            var _scHashWrap = document.getElementById('bso-sent-hash-samechain');
            if (_scHashWrap) {
              _scHashWrap.style.display = 'flex';
              var _scHashTxt = document.getElementById('bso-sent-hash-txt-samechain');
              if (_scHashTxt) _scHashTxt.textContent = '—';
              var _scHashInfoRow = _scHashWrap.closest('.bso-info-row');
              if (_scHashInfoRow) _scHashInfoRow.style.display = '';
            }
          } else {
            extraEl.style.display = 'none';
            // ── Bridge info grid (cross-chain) ──
            if (bridgeInfoEl) {
              bridgeInfoEl.style.display = 'block';
              // Helper: resolve chain logo + name
              function _brChainInfo(chainId, chainName, logoSpanId, nameSpanSelector) {
                var _logoURI = null, _emoji = '🔗';
                if (chainId && typeof NETWORKS !== 'undefined') {
                  var _nd = NETWORKS.find(function(n){ return n.id === chainId; });
                  if (_nd) { _logoURI = _nd.logoURI || null; _emoji = _nd.emoji || '🔗'; }
                }
                if (!_logoURI && chainId) {
                  var _sm = {1:'ethereum',56:'smartchain',137:'polygon',42161:'arbitrum',10:'optimism',8453:'base',43114:'avalanchec',250:'fantom',42220:'celo',100:'xdai',59144:'linea',534352:'scroll'};
                  var _s = _sm[chainId]; if (_s) _logoURI = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/' + _s + '/info/logo.png';
                }
                var _logoEl = document.getElementById(logoSpanId);
                if (_logoEl) {
                  _logoEl.innerHTML = typeof _chainLogoHtml === 'function'
                    ? _chainLogoHtml(_logoURI, _emoji, 14)
                    : (_logoURI ? '<img src="'+_logoURI+'" style="width:14px;height:14px;border-radius:4px;object-fit:cover;">' : '<span style="font-size:11px;">'+_emoji+'</span>');
                  if (_logoURI && typeof _fixChainLogos === 'function') _fixChainLogos(_logoEl);
                }
                var _nameEl = document.querySelector(nameSpanSelector);
                if (_nameEl) _nameEl.textContent = chainName || '—';
              }
              try {
                var _brFromId   = (typeof br !== 'undefined' && br.fromChain) ? br.fromChain.id : null;
                var _brToId     = (typeof br !== 'undefined' && br.toChain) ? br.toChain.id : null;
                var _brFromName = (typeof br !== 'undefined' && br.fromChain) ? (br.fromChain.name || fromChain || '—') : (fromChain || '—');
                var _brToName   = (typeof br !== 'undefined' && br.toChain) ? (br.toChain.name || toChain || '—') : (toChain || '—');
                _brChainInfo(_brFromId, _brFromName, 'bso-br-from-chain-logo', '#bso-br-from-chain span:last-child');
                _brChainInfo(_brToId,   _brToName,   'bso-br-to-chain-logo',   '#bso-br-to-chain span:last-child');
              } catch(_bce) {}
              // Bridge protocol
              var _brProtSpan = document.querySelector('#bso-br-protocol span:last-child');
              var _brProtLogo = document.getElementById('bso-br-protocol-logo');
              try {
                if (typeof br !== 'undefined' && br.routes && br.selectedRoute !== null) {
                  var _brt = br.routes[br.selectedRoute];
                  var _bsteps = (_brt && _brt.steps) || (_brt && _brt.includedSteps) || [];
                  var _btools = _bsteps.length
                    ? _bsteps.map(function(s){ return { name:(s.toolDetails&&s.toolDetails.name)||s.tool||'', logo:(s.toolDetails&&s.toolDetails.logoURI)||'' }; }).filter(function(t){ return t.name; })
                    : [{ name:(_brt&&_brt.toolDetails&&_brt.toolDetails.name)||(_brt&&_brt.tool)||'LiFi', logo:(_brt&&_brt.toolDetails&&_brt.toolDetails.logoURI)||'' }];
                  var _bUniq = [], _bSeen = {};
                  _btools.forEach(function(t){ if(!_bSeen[t.name]){ _bSeen[t.name]=true; _bUniq.push(t); } });
                  var _bPrim = _bUniq[0] || { name:'LiFi', logo:'' };
                  if (_brProtSpan) _brProtSpan.textContent = _bUniq.map(function(t){ return t.name; }).join(' + ');
                  if (_brProtLogo) {
                    if (_bPrim.logo) {
                      _brProtLogo.innerHTML = '<img src="'+_bPrim.logo+'" style="width:14px;height:14px;border-radius:3px;object-fit:cover;" onerror="this.style.display=\'none\'">';
                    } else {
                      _brProtLogo.innerHTML = '<span class="material-icons-round" style="font-size:10px;color:var(--neon-purple);">sync_alt</span>';
                    }
                  }
                } else {
                  if (_brProtSpan) _brProtSpan.textContent = '—';
                  if (_brProtLogo) _brProtLogo.innerHTML = '<span class="material-icons-round" style="font-size:10px;color:var(--neon-purple);">sync_alt</span>';
                }
              } catch(_bpe) {}
              // Bridge fee — show protocol fee if available, else gas fee
              var _brFeeSpan = document.querySelector('#bso-br-fee span:last-child');
              try {
                if (_brFeeSpan && typeof br !== 'undefined' && br.routes && br.selectedRoute !== null) {
                  var _brt2 = br.routes[br.selectedRoute];
                  // Try provider-specific protocol fee first
                  var _protoFeeUsd = null;
                  if (_brt2._provider === 'lifi' || !_brt2._provider) {
                    _protoFeeUsd = _brt2._lifiProtocolFeeUsd || null;
                  } else if (_brt2._provider === 'rango') {
                    _protoFeeUsd = _brt2._rangoProtocolFeeUsd || null;
                  } else if (_brt2._provider === 'rubic') {
                    _protoFeeUsd = _brt2._protocolFeeUsd != null ? _brt2._protocolFeeUsd : null;
                  } else if (_brt2._provider === 'socket') {
                    _protoFeeUsd = _brt2._socketBridgeFeeUsd != null ? _brt2._socketBridgeFeeUsd : null;
                  }
                  if (_protoFeeUsd != null) {
                    _brFeeSpan.textContent = _protoFeeUsd > 0.01 ? '≈ $' + parseFloat(_protoFeeUsd).toFixed(3) : 'FREE';
                  } else {
                    var _bgc = _brt2 && _brt2.estimate && _brt2.estimate.gasCosts;
                    var _bgUSD = _bgc && _bgc[0] && _bgc[0].amountUSD;
                    _brFeeSpan.textContent = _bgUSD ? '≈ $' + parseFloat(_bgUSD).toFixed(3) : '—';
                  }
                } else if (_brFeeSpan) { _brFeeSpan.textContent = '—'; }
              } catch(_bfe) {}
              // Bridge est. time — live countdown
              try {
                var _brt3 = (typeof br !== 'undefined' && br.routes && br.selectedRoute !== null) ? br.routes[br.selectedRoute] : null;
                var _bdur = (_brt3 && _brt3.estimate && _brt3.estimate.executionDuration) || 120;
                _bsoStartCountdown(_bdur, 'bso-br-time-val');
              } catch(_bte) {}
            }
          }
        }

        // RECEIVER TX — now embedded inside TO CHAIN row
        var recvHashEl = document.getElementById('bso-recv-hash');
        var recvSpinEl = document.getElementById('bso-recv-spin');
        var recvTxtEl  = document.getElementById('bso-recv-hash-txt');
        if (recvHashEl) {
          recvHashEl.style.display = _bsoIsSameChain ? 'none' : 'flex';
          recvHashEl.className     = 'bso-tx-hash waiting';
          var recvIcon = recvHashEl.querySelector('span.material-icons-round');
          if (recvIcon) recvIcon.textContent = 'hourglass_empty';
        }
        if (recvSpinEl) recvSpinEl.style.display = _bsoIsSameChain ? 'none' : 'inline-block';
        if (recvTxtEl) {
          if (!_bsoIsSameChain && _bsoProvider === 'rubic') {
            recvTxtEl.textContent = 'waiting · Rubic status ↗';
          } else if (!_bsoIsSameChain && _bsoProvider === 'rango') {
            recvTxtEl.textContent = 'waiting · Rango status ↗';
          } else if (!_bsoIsSameChain && _bsoProvider === 'socket') {
            recvTxtEl.textContent = 'waiting · Socket status ↗';
          } else {
            recvTxtEl.textContent = 'waiting for bridge…';
          }
        }

        // Sent TX hash — now embedded inside FROM CHAIN row
        var sentHashEl = document.getElementById('bso-sent-hash');
        if (sentHashEl) sentHashEl.style.display = 'flex';

        // "Close (bridge continues in background)" — only for cross-chain
        document.getElementById('bso-close-waiting-btn').style.display = _bsoIsSameChain ? 'none' : 'block';
        _bsoPending = true;
        document.getElementById('bso-icon').textContent         = 'swap_horiz';
        document.getElementById('bso-icon').style.color         = 'var(--accent-primary)';
        document.getElementById('bso-icon').style.filter        = 'drop-shadow(0 0 10px rgba(99,102,241,0.5))';
        var ring = document.getElementById('bso-icon-ring');
        ring.className = 'bso-icon-ring';
        ring.style.cssText = '';

        // Capture amounts BEFORE clearing input fields
        var _capturedFromAmt = document.getElementById('br-from-amount') ? document.getElementById('br-from-amount').value : '—';
        var _capturedToAmt   = (document.getElementById('br-to-amount')  ? (document.getElementById('br-to-amount').textContent || '').trim() : '—').split(' ')[0];

        // Reset bridge input fields immediately when success card opens
        var fromInput = document.getElementById('br-from-amount');
        if (fromInput) { fromInput.value = ''; }
        // Reset pct slider to 0
        if (typeof window.brUpdateSliderUI === 'function') window.brUpdateSliderUI(0);
        var toDisplay = document.getElementById('br-to-amount');
        if (toDisplay) { toDisplay.textContent = '—'; toDisplay.classList.remove('br-has-val'); }
        var foundLabel = document.getElementById('br-routes-found-label');
        if (foundLabel) { foundLabel.style.display = 'none'; }
        var foundText = document.getElementById('br-routes-found-text');
        if (foundText) { foundText.textContent = '0 routes'; }
        var routesList = document.getElementById('br-routes-list');
        if (routesList) { routesList.style.display = 'none'; routesList.innerHTML = ''; }

        // Open
        _ov.style.display = 'flex';
        requestAnimationFrame(function() {
          requestAnimationFrame(function() { _ov.classList.add('bso-visible'); });
        });

      }; // end _bsoOpen

      window._bsoSetSentHash = function(hash, explorerBase) {
        window._bsoSentHash    = hash;
        window._bsoSentExplorer = explorerBase;
        var shortHash = hash.slice(0,10) + '…' + hash.slice(-6);

        // Cross-chain path: bso-sent-hash-txt inside bso-bridge-info FROM CHAIN row
        var el1 = document.getElementById('bso-sent-hash-txt');
        if (el1) el1.textContent = shortHash;
        var sentHashWrap = document.getElementById('bso-sent-hash');
        if (sentHashWrap) sentHashWrap.style.display = 'flex';

        // Same-chain path: bso-sent-hash-txt-samechain inside bso-extra-info TX HASH row
        var el2 = document.getElementById('bso-sent-hash-txt-samechain');
        if (el2) el2.textContent = shortHash;
        var sentHashSameWrap = document.getElementById('bso-sent-hash-samechain');
        if (sentHashSameWrap) {
          sentHashSameWrap.style.display = 'flex';
          var txHashInfoRow = sentHashSameWrap.closest('.bso-info-row');
          if (txHashInfoRow) txHashInfoRow.style.display = '';
        }

      };

      window._bsoSetRecvHash = function(hash, explorerBase) {
        window._bsoRecvHash     = hash;
        window._bsoRecvExplorer = explorerBase;
        var hashEl = document.getElementById('bso-recv-hash');
        hashEl.className = 'bso-tx-hash confirmed';
        hashEl.querySelector('span.material-icons-round').textContent = 'open_in_new';
        document.getElementById('bso-recv-hash-txt').textContent =
          hash.slice(0,10) + '…' + hash.slice(-6);
        document.getElementById('bso-recv-spin').style.display = 'none';
      };

      window._bsoSetToAmt = function(amtStr) {
        var el = document.getElementById('bso-to-amt');
        if (el && amtStr) {
          el.textContent = amtStr;
          el.style.color = 'var(--accent-green)';
        }
      };

      window._bsoDone = function(success) {
        document.getElementById('bso-recv-spin').style.display = 'none';
        document.getElementById('bso-done-btn').style.display  = 'block';
        document.getElementById('bso-close-waiting-btn').style.display = 'none';
        _bsoPending = false;
        // ── Fix: clear brRunning so "Bridge processing…" badge goes away ──
        window.brRunning = false;
        if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txEnd(); // BG: release wake lock
        if (typeof window._updateAllToolBadges === 'function') window._updateAllToolBadges();
        if (typeof window._bgPillUpdate === 'function') window._bgPillUpdate();
        // Stop countdown when bridge/swap is done
        _bsoStopCountdown('bso-info-time-val');
        _bsoStopCountdown('bso-br-time-val');
        var ring = document.getElementById('bso-icon-ring');
        var icon = document.getElementById('bso-icon');
        var title = document.getElementById('bso-title');
        var sub   = document.getElementById('bso-subtitle');
        if (success) {
          ring.classList.add('done');
          icon.textContent    = 'check';
          icon.style.color    = 'var(--accent-green)';
          icon.style.filter   = 'drop-shadow(0 0 10px rgba(16,185,129,0.5))';
          title.textContent   = _bsoIsSameChain ? 'Swap Complete' : 'Bridge Complete';
          title.style.color   = 'var(--accent-green)';
          sub.textContent     = 'TRANSACTION CONFIRMED';
        } else {
          ring.classList.add('error');
          icon.textContent    = 'error_outline';
          icon.style.color    = 'var(--accent-red)';
          icon.style.filter   = 'drop-shadow(0 0 10px rgba(244,63,94,0.5))';
          title.textContent   = _bsoIsSameChain ? 'Swap Failed' : 'Bridge Failed';
          title.style.color   = 'var(--accent-red)';
          sub.textContent     = 'TRANSACTION FAILED';


        }
      };

      window._bsoClose = function() {
        _init();
        if (!_ov) return;
        _bsoPending = false;
        _bsoIsSameChain = false;             // ← reset so next tx starts clean
        _bsoStopCountdown('bso-info-time-val');
        _bsoStopCountdown('bso-br-time-val');
        window._bsoReopenedFromHistory = false;
        window._bsoPendingHistId       = null; // ← clear stale pending id
        window._bsoSentHash            = null;
        window._bsoRecvHash            = null;
        // ── Fix: clear brRunning on Done/Close so bg pill & badge disappear ──
        window.brRunning = false;
        if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txEnd(); // BG: release wake lock
        if (typeof window._updateAllToolBadges === 'function') window._updateAllToolBadges();
        if (typeof window._bgPillUpdate === 'function') window._bgPillUpdate();
        _ov.classList.remove('bso-visible');
        setTimeout(function() { _ov.style.display = 'none'; }, 420);
        try {
          var _brFromInput = document.getElementById('br-from-amount');
          if (_brFromInput) { _brFromInput.value = ''; }
          var _brToDisplay = document.getElementById('br-to-amount');
          if (_brToDisplay) { _brToDisplay.textContent = '—'; _brToDisplay.classList.remove('br-has-val'); }
          var _brFoundLabel = document.getElementById('br-routes-found-label');
          if (_brFoundLabel) { _brFoundLabel.style.display = 'none'; }
          var _brFoundText = document.getElementById('br-routes-found-text');
          if (_brFoundText) { _brFoundText.textContent = '0 routes'; }
          var _brRoutesList = document.getElementById('br-routes-list');
          if (_brRoutesList) { _brRoutesList.style.display = 'none'; _brRoutesList.innerHTML = ''; }
          if (typeof window.brUpdateSliderUI === 'function') window.brUpdateSliderUI(0);
          // Clear br state
          if (typeof br !== 'undefined') {
            br.routes        = [];
            br.selectedRoute = null;
          }
        } catch(_brResetErr) {}


        // ── Always reset exec button on Done/Close so spinner never gets stuck ──
        // This covers: swap fail card closed, bridge fail card closed, success card closed.
        try {
          var _execBtn  = document.getElementById('br-exec-btn');
          var _execIcon = document.getElementById('br-exec-icon');
          var _execSpin = document.getElementById('br-exec-spin');
          var _labelEl  = document.getElementById('br-exec-label');
          if (_execBtn) {
            _execBtn.disabled        = false;
            _execBtn.style.opacity   = '1';
            _execBtn.style.background = '';
            _execBtn.style.cursor    = '';
            _execBtn.style.filter    = '';
            _execBtn.style.pointerEvents = '';
          }
          if (_execIcon) _execIcon.style.display = 'block';
          if (_execSpin) _execSpin.style.display = 'none';
          // Label: reflect same/cross chain correctly
          if (_labelEl) {
            var _isSame = (typeof br !== 'undefined') && br.fromChain && br.toChain && br.fromChain.id === br.toChain.id;
            _labelEl.textContent = _isSame ? 'Review swap' : 'Review bridge';
          }
          // Re-evaluate button state (disabled/enabled) based on current form state
          if (typeof brUpdateExecBtn === 'function') {
            var _hasRoute = (typeof br !== 'undefined') && br.routes && br.routes.length > 0 && br.selectedRoute !== null;
            brUpdateExecBtn(_hasRoute);
          }
        } catch(_bsoCloseErr) {}
      };

      // Close while bridge is still pending (receiver tx not yet confirmed)
      // Saves a "pending" entry to history so user can track it later
      window._bsoCloseWhileWaiting = function() {
        _init();
        if (!_ov) return;

        // Entry already saved to history when _bsoOpen was called — no duplicate needed.
        // Only reset the reopened flag.
        window._bsoReopenedFromHistory = false;
        window._bsoPendingHistId       = null; // ← clear stale pending id
        _bsoIsSameChain                = false; // ← reset so next tx starts clean
        window._bsoSentHash            = null;
        window._bsoRecvHash            = null;

        _bsoPending = false;
        // ── Fix: clear brRunning so bg pill hides immediately ──
        window.brRunning = false;
        if (typeof window.OneBGGuard !== 'undefined') window.OneBGGuard.txEnd(); // BG: release wake lock
        if (typeof window._updateAllToolBadges === 'function') window._updateAllToolBadges();
        if (typeof window._bgPillUpdate === 'function') window._bgPillUpdate();
        _ov.classList.remove('bso-visible');
        setTimeout(function() { _ov.style.display = 'none'; }, 380);

        // ── Reset exec button so it's never stuck in loading state ──
        try {
          var _execBtn2  = document.getElementById('br-exec-btn');
          var _execIcon2 = document.getElementById('br-exec-icon');
          var _execSpin2 = document.getElementById('br-exec-spin');
          var _labelEl2  = document.getElementById('br-exec-label');
          if (_execBtn2) {
            _execBtn2.disabled         = false;
            _execBtn2.style.opacity    = '1';
            _execBtn2.style.background = '';
            _execBtn2.style.cursor     = '';
            _execBtn2.style.filter     = '';
            _execBtn2.style.pointerEvents = '';
          }
          if (_execIcon2) _execIcon2.style.display = 'block';
          if (_execSpin2) _execSpin2.style.display = 'none';
          if (_labelEl2) {
            var _isSame2 = (typeof br !== 'undefined') && br.fromChain && br.toChain && br.fromChain.id === br.toChain.id;
            _labelEl2.textContent = _isSame2 ? 'Review swap' : 'Review bridge';
          }
          if (typeof brUpdateExecBtn === 'function') {
            var _hasRoute2 = (typeof br !== 'undefined') && br.routes && br.routes.length > 0 && br.selectedRoute !== null;
            brUpdateExecBtn(_hasRoute2);
          }
        } catch(_cwCloseErr) {}
      };

      window._bsoIsOpen = function() {
        _init();
        return _ov && _ov.style.display !== 'none' && _ov.classList.contains('bso-visible');
      };

      window._bsoOpenSentExplorer = function() {
        if (window._bsoSentHash && window._bsoSentExplorer) {
          window.open(window._bsoSentExplorer + window._bsoSentHash, '_blank', 'noopener');
        }
      };
      window._bsoOpenRecvExplorer = function() {
        if (window._bsoRecvHash && window._bsoRecvExplorer) {
          // Hash confirmed — open chain explorer
          window.open(window._bsoRecvExplorer + window._bsoRecvHash, '_blank', 'noopener');
        } else if (_bsoProvider === 'rubic' && window._bsoSentHash) {
          // Rubic still pending — open Rubic status page
          window.open('https://app.rubic.exchange/', '_blank', 'noopener');
        } else if (_bsoProvider === 'rango') {
          // Rango official explorer — use requestId if available, else search by srcTxHash
          var _rangoReqId = (typeof br !== 'undefined' && br.routes && br.selectedRoute !== null &&
            br.routes[br.selectedRoute] && br.routes[br.selectedRoute]._rangoExecuteRequestId)
            ? br.routes[br.selectedRoute]._rangoExecuteRequestId : null;
          if (_rangoReqId) {
            window.open('https://explorer.rango.exchange/swap/' + _rangoReqId, '_blank', 'noopener');
          } else if (window._bsoSentHash) {
            window.open('https://explorer.rango.exchange/search?query=' + window._bsoSentHash, '_blank', 'noopener');
          } else {
            window.open('https://explorer.rango.exchange/', '_blank', 'noopener');
          }
        } else if (_bsoProvider === 'socket') {
          // Socket (Bungee) explorer
          if (window._bsoSentHash) {
            window.open('https://socketscan.io/tx/' + window._bsoSentHash, '_blank', 'noopener');
          } else {
            window.open('https://socketscan.io/', '_blank', 'noopener');
          }
        }
      };
    })();
    