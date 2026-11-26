// Convert tab: amounts, token picker, preview and confirm
// Part of the exchange spot engine (window.EXC) module (split by topic; no logic change).
(function (__NX) {
  __NX.convSetToAmt = convSetToAmt;
  __NX.convSetRate = convSetRate;
  __NX.convSetMax = convSetMax;
  __NX.convSwap = convSwap;
  __NX.convOpenPicker = convOpenPicker;
  __NX.convClosePicker = convClosePicker;
  __NX.convFilterPicker = convFilterPicker;
  __NX.convSelectToken = convSelectToken;
  __NX.convPreview = convPreview;
  __NX.convClosePreview = convClosePreview;
  __NX.convConfirm = convConfirm;


  function convSetToAmt(txt) {
    var el = document.getElementById('exc-conv-to-amt');
    if (el) el.textContent = txt;
  }

  function convSetRate(txt) {
    var el = document.getElementById('exc-conv-rate');
    if (el) el.textContent = txt;
  }

  // ── Set Max balance ──
  async function convSetMax() {
    var balEl  = document.getElementById('exc-conv-from-bal');
    var amtEl  = document.getElementById('exc-conv-from-amt');
    if (!balEl || !amtEl) return;
    var txt = balEl.textContent || '';
    var match = txt.match(/Balance:\s*([\d.]+)/);
    if (match) {
      amtEl.value = match[1];
      __NX.convOnInput();
    } else {
      var keys = __NX.getExchangeKey(__NX.state.activeExchange);
      if (!keys) return;
      var bal = await __NX.convFetchBalance(__NX._convState.fromSym, keys);
      if (bal) {
        amtEl.value = parseFloat(bal);
        __NX.convOnInput();
      }
    }
  }

  // ── Swap from/to tokens ──
  function convSwap() {
    var tmp = __NX._convState.fromSym;
    __NX._convState.fromSym = __NX._convState.toSym;
    __NX._convState.toSym   = tmp;
    __NX.convRenderTokenBtn('from', __NX._convState.fromSym);
    __NX.convRenderTokenBtn('to',   __NX._convState.toSym);
    var amtEl = document.getElementById('exc-conv-from-amt');
    if (amtEl) { amtEl.value = ''; }
    convSetToAmt('—');
    convSetRate('Enter amount to get a quote');
    var btn = document.getElementById('exc-conv-preview-btn');
    if (btn) btn.disabled = true;
    __NX.convLoadBalance(__NX._convState.fromSym);
  }

  // ── Open token picker ──
  async function convOpenPicker(side) {
    __NX._convState.pickerSide = side;
    var sheet  = document.getElementById('exc-conv-picker-sheet');
    var title  = document.getElementById('exc-conv-picker-title');
    var listEl = document.getElementById('exc-conv-picker-list');
    var search = document.getElementById('exc-conv-picker-search');
    if (title)  title.textContent = (side === 'from') ? 'FROM TOKEN' : 'TO TOKEN';
    if (search) search.value = '';
    if (sheet)  sheet.style.display = 'flex';
    // Show loading while fetching official convert token list from exchange API
    if (listEl) listEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);font-family:var(--font-mono);font-size:13px;">Loading tokens…</div>';
    var syms = await __NX.convFetchTokenList();
    __NX._convState.allTokens = syms;
    convBuildPickerList('');
  }

  function convClosePicker() {
    var sheet = document.getElementById('exc-conv-picker-sheet');
    if (sheet) sheet.style.display = 'none';
  }

  function convFilterPicker() {
    var search = document.getElementById('exc-conv-picker-search');
    convBuildPickerList(search ? search.value.toUpperCase() : '');
  }

  function convBuildPickerList(query) {
    var listEl = document.getElementById('exc-conv-picker-list');
    if (!listEl) return;

    var allSyms = __NX._convState.allTokens.slice();
    if (!allSyms.length) {
      listEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);font-family:var(--font-mono);font-size:13px;">No tokens found</div>';
      return;
    }
    if (query) allSyms = allSyms.filter(function(s) { return s.includes(query); });

    var side = __NX._convState.pickerSide;
    var activeSym = side === 'from' ? __NX._convState.fromSym : __NX._convState.toSym;
    var html = '';
    allSyms.forEach(function(sym) {
      var color = __NX.convTokenColor(sym);
      html += '<div class="exc-conv-tok-item" onclick="excConvSelectToken(\'' + sym + '\')">' +
        '<div style="width:36px;height:36px;border-radius:50%;background:' + color + ';display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#fff;flex-shrink:0;font-family:var(--font-mono);">' + sym[0] + '</div>' +
        '<div style="flex:1;">' +
          '<div style="font-size:14px;font-weight:700;color:var(--text-primary);font-family:var(--font-mono);">' + sym + '</div>' +
        '</div>' +
        (sym === activeSym ? '<span class="material-icons-round" style="font-size:18px;color:var(--accent-primary);">check_circle</span>' : '') +
      '</div>';
    });
    listEl.innerHTML = html || '<div style="text-align:center;padding:40px;color:var(--text-muted);font-family:var(--font-mono);font-size:13px;">No tokens found</div>';
  }

  function convSelectToken(sym) {
    var side = __NX._convState.pickerSide;
    if (side === 'from') {
      if (__NX._convState.toSym === sym) __NX._convState.toSym = __NX._convState.fromSym; // auto-swap the other
      __NX._convState.fromSym = sym;
      __NX.convRenderTokenBtn('from', sym);
      __NX.convLoadBalance(sym);
    } else {
      if (__NX._convState.fromSym === sym) __NX._convState.fromSym = __NX._convState.toSym;
      __NX._convState.toSym = sym;
      __NX.convRenderTokenBtn('to', sym);
    }
    convClosePicker();
    var amtEl = document.getElementById('exc-conv-from-amt');
    if (amtEl && amtEl.value) __NX.convOnInput();
  }

  // ── Preview sheet ──
  function convPreview() {
    var amtEl = document.getElementById('exc-conv-from-amt');
    var amt   = parseFloat(amtEl ? amtEl.value : '');
    if (!amt || !__NX._convState.toAmt) return;

    // Stop btn countdown — preview sheet takes over
    __NX._convStopBtnCountdown();

    var sheet = document.getElementById('exc-conv-preview-sheet');
    var color  = __NX.convTokenColor(__NX._convState.fromSym);
    var color2 = __NX.convTokenColor(__NX._convState.toSym);

    // Fill in preview fields
    var setTxt = function(id, txt) { var el=document.getElementById(id); if(el)el.textContent=txt; };
    var setBg   = function(id, c)  { var el=document.getElementById(id); if(el)el.style.background=c; };

    setTxt('exc-conv-prev-from-amt', __NX.convFmtAmt(amt));
    setTxt('exc-conv-prev-from-sym', __NX._convState.fromSym);
    setTxt('exc-conv-prev-from-logo', __NX._convState.fromSym[0]);
    setBg ('exc-conv-prev-from-logo', color);

    setTxt('exc-conv-prev-to-amt', __NX.convFmtAmt(__NX._convState.toAmt));
    setTxt('exc-conv-prev-to-sym', __NX._convState.toSym);
    setTxt('exc-conv-prev-to-logo', __NX._convState.toSym[0]);
    setBg ('exc-conv-prev-to-logo', color2);

    var rate = __NX._convState.toAmt / amt;
    setTxt('exc-conv-prev-rate', '1 ' + __NX._convState.fromSym + ' ≈ ' + __NX.convFmtAmt(rate) + ' ' + __NX._convState.toSym);

    if (sheet) sheet.style.display = 'flex';

    // Countdown timer — use official per-exchange TTL
    clearInterval(__NX._convState.quoteTimer);
    var secs = __NX._convState.quoteTtl || 30;
    var timerEl = document.getElementById('exc-conv-prev-timer');
    var confirmBtn = document.getElementById('exc-conv-confirm-btn');
    function _convUpdateTimer() {
      if (timerEl) {
        timerEl.textContent = secs + 's';
        timerEl.style.color = secs <= 5 ? '#ef4444' : 'var(--accent-primary)';
      }
    }
    _convUpdateTimer();
    __NX._convState.quoteTimer = setInterval(function() {
      secs--;
      _convUpdateTimer();
      if (secs <= 0) {
        clearInterval(__NX._convState.quoteTimer);
        if (confirmBtn) { confirmBtn.disabled = true; }
        convClosePreview();
        __NX.convOnInput(); // re-fetch quote automatically
      }
    }, 1000);
  }

  function convClosePreview() {
    var sheet = document.getElementById('exc-conv-preview-sheet');
    if (sheet) sheet.style.display = 'none';
    clearInterval(__NX._convState.quoteTimer);
  }

  // ── Confirm & Execute ──
  async function convConfirm() {
    var btn = document.getElementById('exc-conv-confirm-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Converting…'; }

    var keys = __NX.getExchangeKey(__NX.state.activeExchange);
    if (!keys) {
      convClosePreview();
      if (typeof showToast === 'function') showToast('API key required');
      return;
    }

    try {
      var result = await __NX.convExecute(keys);
      convClosePreview();
      var amtEl = document.getElementById('exc-conv-from-amt');
      if (amtEl) amtEl.value = '';
      convSetToAmt('—');
      convSetRate('Enter amount to get a quote');
      if (typeof showToast === 'function') {
        showToast('✅ Converted ' + __NX.convFmtAmt(__NX._convState.fromAmt) + ' ' + __NX._convState.fromSym +
                  ' → ' + __NX.convFmtAmt(__NX._convState.toAmt) + ' ' + __NX._convState.toSym);
      }
      __NX.convLoadBalance(__NX._convState.fromSym);
    } catch(e) {
      if (typeof showToast === 'function') showToast('❌ ' + (e.message || 'Convert failed'));
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Confirm Convert'; }
    }
  }
})((window.__nxp = window.__nxp || {}).mod_exc_spot_engine = window.__nxp.mod_exc_spot_engine || {});
