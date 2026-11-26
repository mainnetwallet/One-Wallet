
    /* ── Bridge Confirm Modal ── */
    window.brOpenConfirm = function() {
      // Validation — same as brExecute guards
      if (!br || br.selectedRoute === null || !br.routes[br.selectedRoute]) {
        if (typeof brShowError === 'function') brShowError('Please select a route');
        return;
      }
      if (!br.senderKey) {
        if (typeof brShowError === 'function') brShowError('Select a wallet (no private key)');
        return;
      }

      const route    = br.routes[br.selectedRoute];
      const isSame   = br.fromChain && br.toChain && br.fromChain.id === br.toChain.id;
      const est      = route.estimate || {};

      // ── Title ──
      var titleEl  = document.getElementById('brc-title');
      var subEl    = document.getElementById('brc-subtitle');
      var iconEl   = document.getElementById('brc-header-icon');
      var execLbl  = document.getElementById('brc-execute-label');
      if (titleEl)  titleEl.textContent  = isSame ? 'Confirm Swap' : 'Confirm Bridge';
      if (subEl)    subEl.textContent    = isSame ? 'REVIEW YOUR TRADE' : 'REVIEW YOUR ROUTE';
      if (iconEl)   iconEl.textContent   = isSame ? 'swap_horiz' : 'swap_horiz';
      if (execLbl)  execLbl.textContent  = isSame ? 'Confirm & Swap' : 'Confirm & Bridge';

      // ── Token amounts ──
      var fromSym = (br.fromToken && (br.fromToken.symbol || br.fromToken.sym)) || '?';
      var toSym   = (br.toToken   && (br.toToken.symbol   || br.toToken.sym))   || '?';
      var fromAmtStr = (document.getElementById('br-from-amount') ? document.getElementById('br-from-amount').value.trim() : '') || '0';
      var fromAmt = parseFloat(fromAmtStr) || 0;

      var toDecim = br.toToken ? (br.toToken.decimals || 18) : 18;
      var toAmt   = est.toAmount
        ? parseFloat(ethers.formatUnits(est.toAmount.toString(), toDecim))
        : 0;

      var _setEl = function(id, val) { var e = document.getElementById(id); if (e) e.textContent = val; };
      _setEl('brc-from-sym', fromSym);
      _setEl('brc-to-sym',   toSym);
      _setEl('brc-from-amt', fromAmt.toFixed(6));
      _setEl('brc-to-amt',   toAmt > 0 ? toAmt.toFixed(6) : '—');

      // rate
      var rateStr = (fromAmt > 0 && toAmt > 0)
        ? '1 ' + fromSym + ' = ' + (toAmt / fromAmt).toFixed(4) + ' ' + toSym
        : '—';
      _setEl('brc-rate', rateStr);

      // min received (use slippage from estimate or 0.5%)
      var slip = parseFloat(est.slippage || 0.5);
      var minRec = toAmt > 0 ? (toAmt * (1 - slip / 100)).toFixed(6) + ' ' + toSym : '—';
      _setEl('brc-min', minRec);

      // estimated time
      var timeRow = document.getElementById('brc-time-row');
      var estTime = est.executionDuration || route.executionDuration || null;
      if (estTime && !isSame) {
        var mins = Math.ceil(estTime / 60);
        _setEl('brc-time', '~' + mins + ' min');
        if (timeRow) timeRow.style.display = '';
      } else {
        if (timeRow) timeRow.style.display = isSame ? 'none' : '';
        _setEl('brc-time', isSame ? '' : '—');
      }

      // gas
      var gasStr = '—';
      if (route._gasFeeUsd) {
        gasStr = '~$' + parseFloat(route._gasFeeUsd).toFixed(4);
      } else if (route._feeUsd) {
        gasStr = '~$' + parseFloat(route._feeUsd).toFixed(4);
      } else if (est.gasCosts && est.gasCosts[0]) {
        var gc = est.gasCosts[0];
        gasStr = gc.amountUSD ? '~$' + parseFloat(gc.amountUSD).toFixed(4) : '—';
      }
      _setEl('brc-gas', gasStr);

      // provider
      var providerMap = { lifi: 'LiFi', rubic: 'Rubic', socket: 'Socket', rango: 'Rango', okx: 'OKX', kyber: 'KyberSwap' };
      var prov = route._provider || 'lifi';
      _setEl('brc-provider', providerMap[prov] || prov.toUpperCase());

      // ── Chain flow (only cross-chain) ──
      var chainFlowEl = document.getElementById('brc-chain-flow');
      if (!isSame && chainFlowEl) {
        chainFlowEl.style.display = 'flex';
        _setEl('brc-from-chain-name', br.fromChain.name || ('Chain ' + br.fromChain.id));
        _setEl('brc-to-chain-name',   br.toChain.name   || ('Chain ' + br.toChain.id));
        // chain icons
        var _setChainIcon = function(elId, chain) {
          var el = document.getElementById(elId);
          if (!el) return;
          var logo = chain.logoURI || chain.logo || null;
          if (logo) {
            el.innerHTML = '<img src="' + logo + '" style="width:28px;height:28px;border-radius:50%;object-fit:cover;" onerror="this.style.display=\'none\'">';
          } else {
            el.innerHTML = '<span style="font-size:11px;font-weight:800;">' + (chain.name || '?').slice(0,2).toUpperCase() + '</span>';
          }
        };
        _setChainIcon('brc-from-chain-icon', br.fromChain);
        _setChainIcon('brc-to-chain-icon',   br.toChain);
      } else if (chainFlowEl) {
        chainFlowEl.style.display = 'none';
      }

      // ── Token icons ──
      var _setTokenIcon = function(elId, token, sym) {
        var el = document.getElementById(elId);
        if (!el || !token) return;
        var logo = token.logoURI || (typeof TOKEN_LOGOS !== 'undefined' && TOKEN_LOGOS[sym]) || null;
        var col  = (token.color || '#6366f1,#8b5cf6').split(',');
        var fb   = token.icon || sym.slice(0,2).toUpperCase();
        el.innerHTML = '';
        if (logo) {
          el.style.background = 'transparent';
          var img = document.createElement('img');
          img.src = logo;
          img.style.cssText = 'width:36px;height:36px;border-radius:10px;object-fit:cover;display:block;';
          img.onerror = function() {
            el.style.background = 'linear-gradient(135deg,' + col[0] + ',' + (col[1]||col[0]) + ')';
            el.innerHTML = '<span style="font-size:13px;font-weight:800;color:#fff;">' + fb + '</span>';
          };
          el.appendChild(img);
        } else {
          el.style.background = 'linear-gradient(135deg,' + col[0] + ',' + (col[1]||col[0]) + ')';
          el.innerHTML = '<span style="font-size:13px;font-weight:800;color:#fff;">' + fb + '</span>';
        }
      };
      _setTokenIcon('brc-from-icon', br.fromToken, fromSym);
      _setTokenIcon('brc-to-icon',   br.toToken,   toSym);

      // ── Reset execute button ──
      var execBtn = document.getElementById('brc-execute-btn');
      if (execBtn) {
        execBtn.disabled = false;
        execBtn.style.opacity = '1';
        execBtn.innerHTML =
          '<span class="material-icons-round" style="font-size:16px;">rocket_launch</span>' +
          '<span id="brc-execute-label">' + (isSame ? 'Confirm &amp; Swap' : 'Confirm &amp; Bridge') + '</span>';
        execBtn.onclick = function() {
          this.disabled = true;
          this.style.opacity = '0.7';
          this.innerHTML = '<span class="material-icons-round" style="font-size:15px;animation:swSpin 0.8s linear infinite;">sync</span> Confirming\u2026';
          brCloseConfirm();
          brExecute();
        };
      }

      // ── Show modal ──
      var modal = document.getElementById('br-confirm-modal');
      if (!modal) { brExecute(); return; }
      modal.style.display = 'flex';
      modal.style.alignItems = 'flex-end';
      requestAnimationFrame(function(){
        requestAnimationFrame(function(){
          modal.classList.add('brc-visible');
        });
      });
      if (typeof haptic === 'function') haptic();
    };

    window.brCloseConfirm = function() {
      var modal = document.getElementById('br-confirm-modal');
      if (!modal) return;
      modal.classList.remove('brc-visible');
      setTimeout(function(){ modal.style.display = 'none'; }, 380);
    };

    // Swipe-down to dismiss bridge confirm sheet
    (function() {
      var sheet, startY, startTY;
      function _bind() {
        sheet = document.getElementById('br-confirm-sheet');
        if (!sheet || sheet._brSwipeBound) return;
        sheet._brSwipeBound = true;
        sheet.addEventListener('touchstart', function(e) {
          startY  = e.touches[0].clientY;
          startTY = sheet.style.transform === 'translateY(0px)' ? 0 : 0;
        }, { passive: true });
        sheet.addEventListener('touchmove', function(e) {
          var dy = e.touches[0].clientY - startY;
          if (dy > 0) sheet.style.transform = 'translateY(' + dy + 'px)';
        }, { passive: true });
        sheet.addEventListener('touchend', function(e) {
          var moved = parseFloat((sheet.style.transform || '').replace(/[^0-9.]/g,'')) || 0;
          var threshold = sheet.offsetHeight * 0.35;
          if (moved > threshold) {
            window.brCloseConfirm();
          } else {
            sheet.style.transform = '';
          }
        }, { passive: true });
      }
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _bind);
      } else { _bind(); }
      setTimeout(_bind, 500);
    })();
    