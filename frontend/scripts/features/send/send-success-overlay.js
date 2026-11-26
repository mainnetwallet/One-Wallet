
    /* ── Send Success Overlay ── */
    (function(){
      function _sndSpawnParticles() {
        var card = document.getElementById('snd-success-card');
        if (!card) return;
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

      window._sndSsoOpen = function(opts) {
        // opts: { amt, sym, logoURI, iconBg, iconText, toAddr, chainName, gasMode, block, hash, explorerBase, failed, failMsg }
        opts = opts || {};
        var ov = document.getElementById('snd-success-overlay');
        if (!ov) return;

        // ── Move overlay to <body> so parent page's visibility:hidden doesn't block it ──
        if (ov.parentElement !== document.body) {
          document.body.appendChild(ov);
        }

        var isFail = !!opts.failed;

        // ── Check ring mode ──
        var ring = document.getElementById('snd-check-ring');
        var icon = ring && ring.querySelector('.material-icons-round');
        if (ring) {
          if (isFail) {
            ring.style.borderColor = 'rgba(239,68,68,0.35)';
            ring.style.background  = 'radial-gradient(circle,rgba(239,68,68,0.18) 0%,rgba(239,68,68,0.04) 70%)';
            ring.style.boxShadow   = '0 0 0 3px rgba(239,68,68,0.12),0 0 40px rgba(239,68,68,0.2)';
            if (icon) { icon.textContent = 'error_outline'; icon.style.color = '#ef4444'; }
          } else {
            ring.style.borderColor = ''; ring.style.background = ''; ring.style.boxShadow = '';
            if (icon) { icon.textContent = 'check'; icon.style.color = ''; }
          }
        }

        // ── Title / subtitle ──
        var titleEl = document.getElementById('snd-title');
        var subEl   = document.getElementById('snd-subtitle');
        if (titleEl) { titleEl.textContent = isFail ? 'Send Failed' : 'Sent!'; titleEl.style.color = isFail ? '#ef4444' : 'var(--accent-green)'; }
        if (subEl)   { subEl.textContent   = isFail ? 'TRANSACTION REJECTED' : 'TRANSACTION CONFIRMED'; }

        // ── Fail reason ──
        var failRow = document.getElementById('snd-fail-row');
        if (!failRow) {
          failRow = document.createElement('div');
          failRow.id = 'snd-fail-row';
          failRow.style.cssText = 'margin:0 0 12px;padding:8px 12px;border-radius:10px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.18);font-family:var(--font-mono);font-size:10px;color:#f87171;text-align:center;word-break:break-word;line-height:1.5;display:none;';
          var tokBox = document.getElementById('snd-tok-icon');
          if (tokBox && tokBox.parentNode) tokBox.parentNode.parentNode.insertBefore(failRow, tokBox.parentNode);
        }
        if (isFail && opts.failMsg) { failRow.textContent = opts.failMsg; failRow.style.display = 'block'; }
        else { failRow.style.display = 'none'; }

        // ── Token icon (official logo) ──
        var tokIconEl = document.getElementById('snd-tok-icon');
        if (tokIconEl) {
          tokIconEl.innerHTML = '';
          tokIconEl.style.background = 'transparent';
          if (opts.logoURI) {
            var img = document.createElement('img');
            img.src = opts.logoURI;
            img.style.cssText = 'width:42px;height:42px;border-radius:12px;object-fit:cover;display:block;';
            img.onerror = function() {
              tokIconEl.style.background = opts.iconBg || 'linear-gradient(135deg,#627EEA,#364FC7)';
              tokIconEl.innerHTML = '<span style="font-size:13px;font-weight:800;color:#fff;">' + (opts.iconText || '?') + '</span>';
            };
            tokIconEl.appendChild(img);
          } else {
            tokIconEl.style.background = opts.iconBg || 'linear-gradient(135deg,#627EEA,#364FC7)';
            tokIconEl.innerHTML = '<span style="font-size:13px;font-weight:800;color:#fff;">' + (opts.iconText || '?') + '</span>';
          }
        }

        // ── Fields ──
        var _set = function(id, v) { var el = document.getElementById(id); if (el) el.textContent = v || '—'; };
        var _fmt = function(addr) { return addr ? (addr.slice(0,10) + '…' + addr.slice(-8)) : '—'; };
        _set('snd-tok-amt',    opts.amt ? (parseFloat(opts.amt).toFixed(6).replace(/\.?0+$/, '')) : '—');
        _set('snd-tok-sym',    opts.sym || '—');
        _set('snd-from-addr',  _fmt(opts.fromAddr));
        _set('snd-to-addr',    _fmt(opts.toAddr));
        _set('snd-chain',      opts.chainName || '—');
        _set('snd-gas',        opts.gasMode   || '—');
        _set('snd-block',      opts.block ? ('#' + opts.block) : '—');
        _set('snd-time',       new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'}));

        // ── TX hash row ──
        var hashRow = document.getElementById('snd-hash-row');
        var hashTxt = document.getElementById('snd-hash-txt');
        if (opts.hash && hashRow) {
          hashRow.href = (opts.explorerBase || (window.getTHExplorerTx ? window.getTHExplorerTx(opts.chainId) : 'https://etherscan.io/tx/')) + opts.hash;
          hashRow.style.display = 'flex';
          if (hashTxt) hashTxt.textContent = opts.hash.slice(0,10) + '…' + opts.hash.slice(-8);
        } else if (hashRow) {
          hashRow.style.display = 'none';
        }

        ov.style.display = 'flex';
        ov.style.alignItems = 'center';
        ov.style.justifyContent = 'center';
        if (!isFail) _sndSpawnParticles();
        requestAnimationFrame(function(){
          requestAnimationFrame(function(){
            ov.classList.add('snd-visible');
          });
        });
      };

      window._sndSsoClose = function() {
        var ov = document.getElementById('snd-success-overlay');
        if (!ov) return;
        ov.classList.remove('snd-visible');
        setTimeout(function(){ ov.style.display = 'none'; }, 420);
        // Reset send UI
        var sendBtn = document.getElementById('send-btn');
        if (sendBtn) {
          sendBtn.classList.remove('sending','confirming');
          sendBtn.style.cssText = '';
          sendBtn.disabled  = true;
          sendBtn.innerHTML = '<span class="material-icons-round">send</span><span id="send-btn-label">Enter an amount</span>';
          if (typeof openSendConfirmSheet === 'function') sendBtn.onclick = () => openSendConfirmSheet();
        }
        // Clear amount (value + fullVal dataset)
        var amtInp = document.getElementById('send-amount');
        if (amtInp) { amtInp.value = ''; amtInp.dataset.fullVal = ''; }
        // Clear recipient field
        var toInp = document.getElementById('send-to');
        if (toInp) { toInp.value = ''; toInp.className = 'send-input'; }
        // Clear status
        var mainStatus = document.getElementById('send-status');
        if (mainStatus) { mainStatus.className = 'send-status'; mainStatus.innerHTML = ''; }
        // Reset USD estimate and slider
        var usdEl = document.getElementById('send-amount-usd');
        if (usdEl) usdEl.textContent = '≈ $0.00';
        if (typeof _updateSendSliderUI === 'function') _updateSendSliderUI(0);
        // Reset confirm sheet button for next use
        var cBtn = document.getElementById('confirm-send-btn');
        if (cBtn) {
          cBtn.innerHTML = '<span class="material-icons-round">send</span> CONFIRM & SEND';
          cBtn.disabled = false;
          if (typeof confirmAndSend === 'function') cBtn.onclick = confirmAndSend;
        }
        // Re-evaluate send button readiness
        if (typeof checkSendReady === 'function') checkSendReady();
      };

      // Click backdrop to close
      document.addEventListener('DOMContentLoaded', function(){
        var ov = document.getElementById('snd-success-overlay');
        if (ov) ov.addEventListener('click', function(e){
          if (e.target === ov) window._sndSsoClose();
        });
      });
    })();
    