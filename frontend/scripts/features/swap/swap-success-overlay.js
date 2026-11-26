
    /* ── Swap Success Overlay ── */
    (function(){
      var EXPLORERS = {
        1:'https://etherscan.io/tx/', 56:'https://bscscan.com/tx/',
        137:'https://polygonscan.com/tx/', 42161:'https://arbiscan.io/tx/',
        10:'https://optimistic.etherscan.io/tx/', 8453:'https://basescan.org/tx/',
        43114:'https://snowtrace.io/tx/'
      };

      /* Spawn floating particles inside the card */
      function _spawnParticles() {
        var card = document.getElementById('sw-success-card');
        if (!card) return;
        // Remove old
        card.querySelectorAll('.sso-particle').forEach(function(p){ p.remove(); });
        var colors = ['#10b981','#6366f1','#22d3ee','#a78bfa','#f472b6'];
        for (var i = 0; i < 18; i++) {
          var p = document.createElement('div');
          p.className = 'sso-particle';
          var size = (Math.random() * 5 + 3) + 'px';
          p.style.cssText = [
            'width:' + size,
            'height:' + size,
            'background:' + colors[Math.floor(Math.random()*colors.length)],
            'left:' + (Math.random()*90 + 5) + '%',
            'bottom:' + (Math.random()*40) + '%',
            'animation-duration:' + (Math.random()*2 + 1.5) + 's',
            'animation-delay:' + (Math.random()*1.2) + 's',
            'filter:blur(' + (Math.random()*1.5) + 'px)'
          ].join(';');
          card.appendChild(p);
        }
      }

      window._ssoOpen = function(opts) {
        // opts: { fromAmt, fromSym, fromIconBg, fromIconText, toAmt, toSym, toIconBg, toIconText, dex, hash, chainId, chainName, failed, failMsg }
        opts = opts || {};
        var ov = document.getElementById('sw-success-overlay');
        if (!ov) return;

        var isFail = !!opts.failed;

        // ── Mode: swap result indicator (check ring icon + title) ──
        var checkRing = ov.querySelector('.sso-check-ring');
        var checkIcon = checkRing && checkRing.querySelector('.material-icons-round');
        var titleEl   = ov.querySelector('.sso-title');
        var subEl     = ov.querySelector('.sso-subtitle');
        var failRow   = document.getElementById('sso-fail-row');

        if (checkRing) {
          if (isFail) {
            checkRing.style.borderColor  = 'rgba(239,68,68,0.35)';
            checkRing.style.background   = 'radial-gradient(circle,rgba(239,68,68,0.18) 0%,rgba(239,68,68,0.04) 70%)';
            checkRing.style.boxShadow    = '0 0 0 3px rgba(239,68,68,0.12),0 0 40px rgba(239,68,68,0.2)';
            if (checkIcon) { checkIcon.textContent = 'error_outline'; checkIcon.style.color = '#ef4444'; }
          } else {
            checkRing.style.borderColor  = '';
            checkRing.style.background   = '';
            checkRing.style.boxShadow    = '';
            if (checkIcon) { checkIcon.textContent = 'check'; checkIcon.style.color = ''; }
          }
        }
        if (titleEl) {
          titleEl.textContent = isFail ? 'Swap Failed'    : 'Swap Complete';
          titleEl.style.color = isFail ? '#ef4444'        : 'var(--accent-green)';
        }
        if (subEl)   subEl.textContent   = isFail ? 'TRANSACTION REJECTED' : 'TRANSACTION CONFIRMED';

        // Fail reason row
        if (!failRow) {
          // Create once, insert after subtitle
          failRow = document.createElement('div');
          failRow.id = 'sso-fail-row';
          failRow.style.cssText = 'margin:0 0 12px;padding:8px 12px;border-radius:10px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.18);font-family:var(--font-mono);font-size:10px;color:#f87171;text-align:center;word-break:break-word;line-height:1.5;display:none;';
          var tokenFlow = ov.querySelector('.sso-token-flow');
          if (tokenFlow) tokenFlow.parentNode.insertBefore(failRow, tokenFlow);
          else ov.querySelector('.sso-info-row') && ov.querySelector('.sso-info-row').parentNode.prepend(failRow);
        }
        if (isFail && opts.failMsg) {
          failRow.textContent = opts.failMsg;
          failRow.style.display = 'block';
        } else {
          failRow.style.display = 'none';
        }

        // Populate
        var set = function(id, v) { var el=document.getElementById(id); if(el) el.textContent=v||'—'; };
        var setStyle = function(id, prop, v) { var el=document.getElementById(id); if(el) el.style[prop]=v; };
        var setHref = function(id, h) { var el=document.getElementById(id); if(el) el.href=h; };

        set('sso-from-amt', opts.fromAmt ? parseFloat(opts.fromAmt).toFixed(6).replace(/\.?0+$/,'') : '—');
        set('sso-from-sym', opts.fromSym || '—');
        set('sso-to-amt',   opts.toAmt   ? parseFloat(opts.toAmt).toFixed(6).replace(/\.?0+$/,'')   : '—');
        set('sso-to-sym',   opts.toSym   || '—');
        // ── Route via: "[API logo] API via [DEX logo] DEX" ──
        (function() {
          var el = document.getElementById('sso-dex');
          if (!el) return;

          // Helper: create small 20×20 logo chip as DOM element
          function _makeChip(logoURI, fallbackLabel) {
            var wrap = document.createElement('span');
            wrap.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:5px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);overflow:hidden;flex-shrink:0;';
            if (logoURI) {
              var img = document.createElement('img');
              img.src = logoURI;
              img.style.cssText = 'width:16px;height:16px;border-radius:3px;object-fit:contain;display:block;';
              img.onerror = function() {
                this.parentNode.innerHTML = '';
                var fb = document.createElement('span');
                fb.style.cssText = 'font-size:7px;font-weight:800;color:#fff;font-family:sans-serif;';
                fb.textContent = (fallbackLabel || '?').slice(0, 2).toUpperCase();
                this.parentNode.appendChild(fb);
              };
              wrap.appendChild(img);
            } else {
              var fb = document.createElement('span');
              fb.style.cssText = 'font-size:7px;font-weight:800;color:#fff;font-family:sans-serif;';
              fb.textContent = (fallbackLabel || '?').slice(0, 2).toUpperCase();
              wrap.appendChild(fb);
            }
            return wrap;
          }

          function _makeText(txt, color, size) {
            var s = document.createElement('span');
            s.style.cssText = 'font-weight:700;font-size:' + (size||'11px') + ';color:' + color + ';white-space:nowrap;';
            s.textContent = txt;
            return s;
          }

          el.innerHTML = '';
          el.style.cssText = 'display:flex;align-items:center;justify-content:space-between;width:100%;';

          var hasBoth = opts.hasBothParts;
          if (hasBoth) {
            // Left: [API logo] API name
            var _left = document.createElement('span');
            _left.style.cssText = 'display:flex;align-items:center;gap:4px;';
            _left.appendChild(_makeChip(opts.apiLogoURI, opts.apiLabel));
            _left.appendChild(_makeText(opts.apiLabel || '', 'var(--neon-purple)', '11px'));
            // Center: via
            var _via = _makeText('via', 'var(--text-secondary)', '9px');
            // Right: [DEX logo] DEX name
            var _right = document.createElement('span');
            _right.style.cssText = 'display:flex;align-items:center;gap:4px;';
            _right.appendChild(_makeChip(opts.dexLogoURI, opts.dexName));
            _right.appendChild(_makeText(opts.dexName || '', 'var(--accent-green)', '11px'));
            el.appendChild(_left);
            el.appendChild(_via);
            el.appendChild(_right);
          } else {
            var _label = opts.dex || '—';
            var _logo  = opts.apiLogoURI || opts.dexLogoURI || null;
            // Left: "Route via"
            var _left = document.createElement('span');
            _left.style.cssText = 'display:flex;align-items:center;gap:4px;';
            _left.appendChild(_makeText('Route', 'var(--text-secondary)', '11px'));
            _left.appendChild(_makeText('via', 'var(--text-secondary)', '9px'));
            el.appendChild(_left);
            // Right: [logo] DEX name
            var _right = document.createElement('span');
            _right.style.cssText = 'display:flex;align-items:center;gap:4px;';
            if (_logo) _right.appendChild(_makeChip(_logo, _label));
            _right.appendChild(_makeText(_label, 'var(--accent-green)', '11px'));
            el.appendChild(_right);
          }
        })();
        // ── Network: chain logo + name ──
        (function() {
          var el = document.getElementById('sso-chain');
          if (!el) return;
          var _cid  = opts.chainId || 0;
          var _name = opts.chainName || ('Chain ' + _cid);
          var _slug = (typeof TW_CHAIN_SLUG !== 'undefined' && TW_CHAIN_SLUG[_cid]) || null;
          var _logoURI = _slug ? 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/' + _slug + '/info/logo.png' : null;
          el.innerHTML = '';
          el.style.cssText = 'display:flex;align-items:center;justify-content:flex-end;gap:5px;';
          if (_logoURI) {
            var _logoHtml = typeof _chainLogoHtml === 'function' ? _chainLogoHtml(_logoURI, '🔗', 16) : '';
            var wrap = document.createElement('span');
            wrap.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;flex-shrink:0;';
            wrap.innerHTML = _logoHtml;
            el.appendChild(wrap);
            if (typeof _fixChainLogos === 'function') _fixChainLogos(wrap);
          }
          var nameSpan = document.createElement('span');
          nameSpan.style.cssText = 'font-family:var(--font-mono);font-size:11px;font-weight:600;color:var(--text-secondary);';
          nameSpan.textContent = _name;
          el.appendChild(nameSpan);
        })();
        set('sso-time',     new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'}));

        // Icons — render img if logoURI available, else gradient+text fallback
        function _renderSsoIcon(el, logoURI, bg, txt) {
          if (!el) return;
          el.innerHTML = '';
          if (logoURI) {
            el.style.background = 'transparent';
            var img = document.createElement('img');
            img.src = logoURI;
            img.style.cssText = 'width:40px;height:40px;border-radius:10px;object-fit:cover;display:block;';
            img.onerror = function() {
              el.style.background = bg || 'linear-gradient(135deg,#627EEA,#364FC7)';
              el.innerHTML = '<span style="font-size:14px;font-weight:800;color:#fff;">' + (txt||'?') + '</span>';
            };
            el.appendChild(img);
          } else {
            el.style.background = bg || 'linear-gradient(135deg,#627EEA,#364FC7)';
            el.innerHTML = '<span style="font-size:14px;font-weight:800;color:#fff;">' + (txt||'?') + '</span>';
          }
        }
        _renderSsoIcon(document.getElementById('sso-from-icon'), opts.fromLogoURI, opts.fromIconBg, opts.fromIconText);
        _renderSsoIcon(document.getElementById('sso-to-icon'),   opts.toLogoURI,   opts.toIconBg,   opts.toIconText);

        // TX hash — hide on fail only when no hash available
        var hashRow = document.getElementById('sso-hash-row');
        var hashTxt = document.getElementById('sso-hash-txt');
        if (opts.hash && hashRow) {
          var explorerBase = EXPLORERS[opts.chainId] || (window.getTHExplorerTx ? window.getTHExplorerTx(opts.chainId) : 'https://etherscan.io/tx/');
          var explorerUrl = explorerBase + opts.hash;
          hashRow.href = explorerUrl;
          hashRow.onclick = function(e) {
            e.preventDefault();
            if (window.OneAndroid && typeof window.OneAndroid.openSystemBrowser === 'function') {
              window.OneAndroid.openSystemBrowser(explorerUrl);
            } else {
              window.open(explorerUrl, '_blank');
            }
          };
          hashRow.style.display = 'flex';
          if (hashTxt) hashTxt.textContent = opts.hash.slice(0,10) + '…' + opts.hash.slice(-8);
        } else if (hashRow) {
          hashRow.style.display = 'none';
        }

        ov.style.display = 'flex';
        ov.style.alignItems = 'center';
        ov.style.justifyContent = 'center';
        if (!isFail) _spawnParticles();
        requestAnimationFrame(function(){
          requestAnimationFrame(function(){
            ov.classList.add('sso-visible');
          });
        });
      };

      window._ssoClose = function() {
        var ov = document.getElementById('sw-success-overlay');
        if (!ov) return;
        ov.classList.remove('sso-visible');
        // Block pointer events on overlay during fade-out to prevent ghost touch bleed
        ov.style.pointerEvents = 'none';
        setTimeout(function(){ ov.style.display = 'none'; ov.style.pointerEvents = ''; }, 420);
        // Set a close timestamp so swHandleAction ignores ghost clicks for 700ms
        window._ssoClosedAt = Date.now();

        // ── Reset swap UI after Done ──
        // Hide dex compare panel
        var dexCmp = document.getElementById('sw-dex-compare');
        if (dexCmp) dexCmp.style.display = 'none';
        // Clear to-amount display
        var toAmtEl = document.getElementById('sw-to-amount');
        if (toAmtEl) toAmtEl.textContent = '—';
        // Clear from-amount input DOM + SW.fromAmount
        var fromInp = document.getElementById('sw-from-amount');
        if (fromInp) fromInp.value = '';
        // Clear quotes & cached state
        if (typeof SW !== 'undefined') {
          SW.fromAmount    = '';
          SW.toAmount      = 0;
          SW.quotes        = [];
          SW._cachedSwapTx = null;
          SW._lastTxHash   = null;
        }
        // Hide other quote-related panels
        ['sw-quote-loading','sw-error-box','sw-info-panel','sw-slip-quick',
         'sw-selected-dex-badge','sw-split-badge'].forEach(function(id){
          var el = document.getElementById(id);
          if (el) el.style.display = 'none';
        });
        // Restore swap button — call swOnAmountChange so it reads empty DOM input
        // and correctly sets SW.fromAmount = '' before swUpdateButton runs
        if (typeof swOnAmountChange === 'function') swOnAmountChange();
        else if (typeof _swBtnRestore === 'function') _swBtnRestore();

        // ── Reset % slider ──
        var _ssoPctRange = document.getElementById('sw-pct-range');
        if (_ssoPctRange) _ssoPctRange.value = '0';
        var _ssoPctFill = document.getElementById('sw-pct-fill');
        if (_ssoPctFill) _ssoPctFill.style.width = '0%';
        var _ssoPctThumb = document.getElementById('sw-pct-thumb');
        if (_ssoPctThumb) _ssoPctThumb.style.display = 'none';
        var _ssoPctDisp = document.getElementById('sw-pct-display');
        if (_ssoPctDisp) _ssoPctDisp.textContent = '0%';

        // ── Also reset bridge form inputs (same-chain swap via bridge section) ──
        try {
          var _brFromInput = document.getElementById('br-from-amount');
          if (_brFromInput) { _brFromInput.value = ''; }
          var _brToDisplay = document.getElementById('br-to-amount');
          if (_brToDisplay) { _brToDisplay.textContent = '—'; }
          var _brFoundLabel = document.getElementById('br-routes-found-label');
          if (_brFoundLabel) { _brFoundLabel.style.display = 'none'; }
          var _brFoundText = document.getElementById('br-routes-found-text');
          if (_brFoundText) { _brFoundText.textContent = '0 ROUTES FOUND'; }
          var _brRoutesList = document.getElementById('br-routes-list');
          if (_brRoutesList) { _brRoutesList.style.display = 'none'; _brRoutesList.innerHTML = ''; }
          if (typeof window.brUpdateSliderUI === 'function') window.brUpdateSliderUI(0);
          if (typeof br !== 'undefined') {
            br.routes        = [];
            br.selectedRoute = null;
          }
          // Also reset exec button in bridge section
          var _execBtn  = document.getElementById('br-exec-btn');
          var _execIcon = document.getElementById('br-exec-icon');
          var _execSpin = document.getElementById('br-exec-spin');
          var _labelEl  = document.getElementById('br-exec-label');
          if (_execBtn) {
            _execBtn.disabled      = false;
            _execBtn.style.opacity = '1';
            _execBtn.style.background = 'linear-gradient(135deg,#6366f1,#8b5cf6,#a78bfa)';
            _execBtn.style.cursor  = '';
            _execBtn.style.filter  = '';
            _execBtn.style.pointerEvents = '';
          }
          if (_execIcon) _execIcon.style.display = 'block';
          if (_execSpin) _execSpin.style.display = 'none';
          if (_labelEl) { _labelEl.textContent = 'SWAP NOW'; }
        } catch(_ssoCloseErr) {}
      };

      /* Click backdrop to close */
      document.addEventListener('DOMContentLoaded', function(){
        var ov = document.getElementById('sw-success-overlay');
        if (ov) ov.addEventListener('click', function(e){
          if (e.target === ov) window._ssoClose();
        });
      });
    })();
    