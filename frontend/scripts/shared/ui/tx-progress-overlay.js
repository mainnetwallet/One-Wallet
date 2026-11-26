
    /* ── TX Progress Overlay ── */
    (function(){
      /* Smart amount formatter — no trailing zeros, meaningful precision */
      function _fmtAmt(v, sym) {
        if (!v || !isFinite(v) || v <= 0) return '0 ' + (sym||'');
        var s;
        if      (v >= 1e6)   s = (v/1e6).toFixed(2) + 'M';
        else if (v >= 1e3)   s = v.toLocaleString('en-US',{maximumFractionDigits:2});
        else if (v >= 1)     s = parseFloat(v.toPrecision(6)).toString();
        else if (v >= 1e-4)  s = parseFloat(v.toPrecision(4)).toString();
        else                 s = v.toExponential(3);
        return s + ' ' + (sym||'');
      }
      window._txpFmtAmt = _fmtAmt;

      window._txpOpen = function(opts) {
        return; // TXP overlay disabled — button spinner used instead
        opts = opts || {};
        var ov = document.getElementById('sw-tx-progress');
        if (!ov) return;
        // Populate tokens
        var setTxt = function(id, v){ var e=document.getElementById(id); if(e) e.textContent=v||''; };
        var setStyle = function(id, p, v){ var e=document.getElementById(id); if(e) e.style[p]=v; };

        setTxt('txp-from-name', opts.fromSym || '—');
        setTxt('txp-from-amt',  _fmtAmt(opts.fromAmt, opts.fromSym));
        setTxt('txp-to-name',   opts.toSym   || '—');
        setTxt('txp-to-amt-val', opts.toAmt && opts.toAmt > 0 ? _fmtAmt(opts.toAmt, opts.toSym) : opts.toSym || '—');

        var fi = document.getElementById('txp-from-icon');
        if (fi) { fi.style.background = opts.fromIconBg||'linear-gradient(135deg,#627EEA,#364FC7)'; fi.textContent = opts.fromIconText||'?'; }
        var ti = document.getElementById('txp-to-icon');
        if (ti) { ti.style.background = opts.toIconBg||'linear-gradient(135deg,#2775CA,#1557A0)';   ti.textContent = opts.toIconText||'?'; }

        // Reset steps
        ['txp-step-approve','txp-step-send','txp-step-confirm'].forEach(function(id){
          var el = document.getElementById(id);
          if (el) { el.className = 'txp-step'; }
        });
        window._txpSetStep('send');

        setTxt('txp-title', 'Broadcasting…');
        setTxt('txp-sub',   'WAITING FOR NETWORK');

        ov.style.display = 'flex';
        ov.style.alignItems = 'center';
        ov.style.justifyContent = 'center';
        requestAnimationFrame(function(){
          requestAnimationFrame(function(){ ov.classList.add('txp-visible'); });
        });
      };

      window._txpSetStep = function(step, label) {
        return; // TXP overlay disabled
        var steps = { approve:'txp-step-approve', send:'txp-step-send', confirm:'txp-step-confirm' };
        var order = ['approve','send','confirm'];
        var idx = order.indexOf(step);
        order.forEach(function(s, i) {
          var el = document.getElementById(steps[s]);
          if (!el) return;
          if (i < idx)  el.className = 'txp-step done';
          else if (i === idx) el.className = 'txp-step active';
          else el.className = 'txp-step';
        });
        if (label) {
          var t = document.getElementById('txp-title');
          if (t) t.textContent = label;
        }
      };

      window._txpClose = function() {
        var ov = document.getElementById('sw-tx-progress');
        if (!ov) return;
        ov.classList.remove('txp-visible');
        setTimeout(function(){ ov.style.display = 'none'; }, 360);
      };
    })();
    