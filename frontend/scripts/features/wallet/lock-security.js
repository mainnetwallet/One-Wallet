
/* ══════════════════════════════════════════════════
   ONE APP LOCK ENGINE
   Supports: Fingerprint · Face ID · PIN · Pattern
   ══════════════════════════════════════════════════ */
window.oneLock = (function() {
  'use strict';

  var SK = {
    enabled      : 'one_bio_lock',
    pinHash      : 'one_lock_pin',
    pinSalt      : 'one_lock_pin_salt',  // per-user random salt
    patHash      : 'one_lock_pat',
    credId       : 'one_bio_cred_id',
    default      : 'one_lock_default',
    masterSecret : 'one_lock_master_secret', // single AES key shared across all lock methods
    failCount    : 'one_lock_fails',         // consecutive wrong PIN/pattern attempts
    lockUntil    : 'one_lock_until',         // epoch ms until which PIN/pattern entry is blocked
  };

  var PIN_LEN = 6; // 6-digit PIN

  var _setupMethod='', _setupPin='', _setupPinFirst='', _confirmPin='';
  var _setupPatFirst='', _lockPin='', _patSetupState='first';
  var _setupCanvas=null, _confirmCanvas=null, _lockPatState=null;
  var _isUnlocked=false;

  async function _sha256(str) {
    var buf=new TextEncoder().encode(str);
    var hash=await crypto.subtle.digest('SHA-256',buf);
    return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  // Salted hash: SHA-256(salt + ':' + pin) — resistant to rainbow table attacks
  async function _saltedHash(pin, salt) {
    return _sha256(salt + ':' + pin);
  }
  // Generate a cryptographically random hex salt
  function _genSalt() {
    var arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  // ── Master secret: one shared AES key for all lock methods ──
  // PIN, Pattern, and Biometric all use the same master secret to en/decrypt wallets.
  // This means switching unlock methods never loses wallet data.
  //
  // The secret is stored wrapped by a non-exportable Android Keystore key ("ks1:<iv>.<ct>"), not in
  // plaintext next to the data it protects (BUG-002). Where the Keystore bridge is unavailable
  // (e.g. opened in a desktop browser) it falls back to the old plaintext value.
  var _msCache = null;
  function _ksReady() {
    return !!(window.OneAndroid && typeof window.OneAndroid.keystoreWrap === 'function' &&
              typeof window.OneAndroid.keystoreUnwrap === 'function');
  }
  // Wrap with the Keystore and verify the round trip; returns the wrapped string or '' on failure.
  function _ksWrap(secret) {
    if (!_ksReady()) return '';
    try {
      var w = window.OneAndroid.keystoreWrap(secret) || '';
      if (w && window.OneAndroid.keystoreUnwrap(w) === secret) return w;
    } catch (e) {}
    return '';
  }
  function _getMasterSecret() {
    if (_msCache) return _msCache;
    var v = _get(SK.masterSecret);
    if (!v) return null;
    if (v.indexOf('ks1:') === 0) {
      var plain = '';
      if (_ksReady()) { try { plain = window.OneAndroid.keystoreUnwrap(v) || ''; } catch (e) {} }
      // Wrapped but unreadable: return null and never regenerate it — a new secret would orphan the wallets.
      if (!plain) return null;
      _msCache = plain;
      return plain;
    }
    // Plaintext secret from an older version: migrate it into the Keystore
    var wrapped = _ksWrap(v);
    if (wrapped) _set(SK.masterSecret, wrapped);
    _msCache = v;
    return v;
  }
  function _ensureMasterSecret() {
    var existing = _getMasterSecret();
    if (existing) return existing;
    if (_get(SK.masterSecret)) return null; // stored but unreadable (see above) — do not overwrite
    // Generate fresh master secret on first lock setup
    var secret = 'one:master:' + _genSalt() + ':' + _genSalt();
    _set(SK.masterSecret, _ksWrap(secret) || secret);
    _msCache = secret;
    return secret;
  }
  // Apply master secret to OneCrypto so wallet decrypt works
  function _applyMasterSecret() {
    var secret = _getMasterSecret();
    if (secret && typeof OneCrypto !== 'undefined') {
      OneCrypto.setSecret(secret);
    }
  }
  // No lock enabled: make sure a master secret exists and is applied, so wallet keys are always
  // encrypted at rest and never stored as plaintext (BUG-004). A secret left by an earlier lock is
  // reused — removing the lock does not re-encrypt the wallets, and clearing it made them
  // undecryptable after a restart (BUG-011). With a lock enabled this does nothing: the secret is
  // applied after the user unlocks.
  function _applySecretIfNoLock() {
    if (_isEnabled()) return;
    _ensureMasterSecret();
    _applyMasterSecret();
  }
  function _get(k){try{return localStorage.getItem(k);}catch(e){return null;}}
  function _set(k,v){try{localStorage.setItem(k,v);}catch(e){}}
  function _del(k){try{localStorage.removeItem(k);}catch(e){}}

  // ── Wrong-attempt limit (PIN / pattern) ──
  // After FAIL_FREE wrong attempts entry is blocked for 30 s, doubling per further miss (max 1 h).
  // The counter is stored, so restarting the app does not reset it; a correct entry clears it.
  var FAIL_FREE = 5;
  function _lockoutLeft(){
    var until = parseInt(_get(SK.lockUntil) || '0', 10) || 0;
    var left = until - Date.now();
    return left > 0 ? left : 0;
  }
  function _lockoutMsg(ms){
    var sec = Math.ceil(ms / 1000);
    return 'Too many attempts. Try again in ' + (sec >= 60 ? Math.ceil(sec / 60) + ' min' : sec + ' s');
  }
  function _registerFail(){
    var n = (parseInt(_get(SK.failCount) || '0', 10) || 0) + 1;
    _set(SK.failCount, String(n));
    if (n >= FAIL_FREE) {
      var secs = Math.min(30 * Math.pow(2, n - FAIL_FREE), 3600);
      _set(SK.lockUntil, String(Date.now() + secs * 1000));
    }
  }
  function _clearFails(){ _del(SK.failCount); _del(SK.lockUntil); }

  // ── Re-encrypt all wallet groups with the current _unlockSecret ──
  // Must be called AFTER OneCrypto.setSecret() whenever the lock secret changes.
  function _reEncryptWallets(){
    try {
      if(typeof loadWalletGroups!=='function'||typeof saveWalletGroups!=='function') return;
      var cached = (typeof OneCrypto!=='undefined') ? OneCrypto.getPlaintextCache() : null;
      if(cached && cached.length>0){ saveWalletGroups(cached); return; }
      // Fallback: try plain backup
      try {
        var _bk = localStorage.getItem(WG_STORAGE_KEY + '_plain_backup');
        if(_bk){
          var _bg = JSON.parse(_bk);
          if(Array.isArray(_bg)&&_bg.length>0){ saveWalletGroups(_bg); return; }
        }
      } catch(_){}
    } catch(_){}
  }

  function _hasPin()    {return !!_get(SK.pinHash);}
  function _hasPat()    {return !!_get(SK.patHash);}
  function _hasBioKey() {return !!_get(SK.credId);}
  function _hasAny()    {return _hasPin()||_hasPat()||_hasBioKey();}
  function _isEnabled() {return _get(SK.enabled)==='on'&&_hasAny();}
  function _hasBioSupport(){return !!(window.PublicKeyCredential&&navigator.credentials&&navigator.credentials.get);}

  // ── Overlay ──
  var _overlay=null;
  function _getOverlay(){if(!_overlay)_overlay=document.getElementById('one-lock-overlay');return _overlay;}

  function _showLockScreen(panel){
    var ov=_getOverlay();if(!ov)return;
    ov.style.display='flex';
    ['bio','pin','pattern'].forEach(function(p){var el=document.getElementById('nlk-'+p+'-panel');if(el)el.style.display='none';});
    var t=document.getElementById('nlk-'+panel+'-panel');if(t)t.style.display='flex';
    var sub=document.getElementById('nlk-sub');
    if(sub)sub.textContent=panel==='pin'?'Enter your PIN to unlock':panel==='pattern'?'Draw your pattern to unlock':'Use biometrics to unlock';
    _renderAltBtns(panel);
  }

  function _hideLockScreen(){
    _isUnlocked=true;
    var ov=_getOverlay();

    // ── FIX: Do ALL async work while overlay is still visible ──
    // Order: decrypt cache → migrate secret → restore wallet → THEN hide overlay → refresh UI
    // This ensures user never sees a blank/flicker state between unlock and wallet display.

    function _doHideOverlay(){
      if(ov){
        ov.style.opacity='0';
        ov.style.transition='opacity 0.3s ease';
        setTimeout(function(){ov.style.display='none';ov.style.opacity='';ov.style.transition='';},300);
      }
    }

    function _afterRestore(){
      // Now safe to reveal UI — wallet is already in place
      _doHideOverlay();
      // Silent refresh after wallet is restored
      if(typeof window._globalPriceCacheTime!=='undefined') window._globalPriceCacheTime=0;
      if(typeof window.loadTokens==='function') window.loadTokens();
      if(typeof window.silentPriceRefresh==='function') setTimeout(window.silentPriceRefresh, 800);
    }

    if(typeof loadWalletGroupsAsync==='function'){
      loadWalletGroupsAsync().then(function(groups){
        // Migration: re-encrypt with master secret if needed
        if(groups && groups.length > 0){
          var ms = _getMasterSecret();
          if(ms && typeof OneCrypto!=='undefined'){
            OneCrypto.setSecret(ms);
            if(typeof saveWalletGroups==='function') saveWalletGroups(groups);
          }
        }
        // Restore wallet selection — overlay still visible during this async step
        if(typeof _hwRestoreSelection==='function'){
          var rp = _hwRestoreSelection();
          var afterRp = (rp && typeof rp.then==='function') ? rp : Promise.resolve();
          afterRp.then(_afterRestore).catch(_afterRestore);
        } else {
          _afterRestore();
        }
      }).catch(function(){
        // Decrypt failed — still hide overlay so user isn't stuck
        _doHideOverlay();
      });
    } else {
      // No async path — hide immediately
      _doHideOverlay();
    }
  }

  function _renderAltBtns(cur){
    // Show ONLY methods that are SET (excluding current panel)
    var all=[
      {id:'bio',     label:'biometric'},
      {id:'pin',     label:'PIN'},
      {id:'pattern', label:'pattern'},
    ];
    var others=all.filter(function(m){
      if(m.id===cur)return false;
      if(m.id==='bio')return _hasBioKey();
      if(m.id==='pin')return _hasPin();
      if(m.id==='pattern')return _hasPat();
      return false;
    });
    var hasBioAlt=others.some(function(m){return m.id==='bio';});
    // On the PIN keypad biometric is the fingerprint key, so no text link for it there
    var links=others.filter(function(m){return !(cur==='pin'&&m.id==='bio');});
    var s='padding:10px 14px;background:none;border:none;color:#8b8df5;font-size:14px;cursor:pointer;font-family:var(--font-ui);margin:2px;';
    var html=links.map(function(m){
      var action='oneLock._showPanel(\''+m.id+'\')';
      return '<button onclick="'+action+'" style="'+s+'">Use '+m.label+' instead</button>';
    }).join('');
    [['bio','bio'],['pin','pin'],['pattern','pat']].forEach(function(pair){
      var el=document.getElementById('nlk-'+pair[1]+'-alt-btns');
      if(el){ el.innerHTML=html; el.style.display='flex'; }
    });
    // PIN keypad bottom-left slot = fingerprint key (only when biometric is set up)
    var slot=document.getElementById('nlk-pin-alt1-btn');
    if(slot){
      if(hasBioAlt&&cur==='pin'){
        slot.style.display='';
        slot.style.visibility='visible';
        slot.innerHTML='<span class="material-icons-round" style="font-size:28px;color:var(--accent-tertiary);">fingerprint</span>';
        slot.setAttribute('aria-label','Use biometric');
        slot.onclick=function(){oneLock._showPanel('bio');};
      } else {
        slot.style.visibility='hidden';
        slot.onclick=null;
      }
    }
  }

  function _checkOnOpen(){
    if(_isUnlocked)return;
    if(!_isEnabled()){
      // No lock — keep/create the master secret (see _applySecretIfNoLock)
      _applySecretIfNoLock();
      return;
    }
    _lockPin='';_resetLockPinDots();
    // Show default method first, fallback to available
    var def=_get(SK.default);
    if(def==='pin'&&_hasPin()){_showLockScreen('pin');}
    else if(def==='pattern'&&_hasPat()){_showLockScreen('pattern');setTimeout(function(){_initLockPatternCanvas();},100);}
    else if(def==='bio'&&_hasBioKey()){_showLockScreen('bio');setTimeout(function(){_triggerBio();},400);}
    else if(_hasPat()){_showLockScreen('pattern');setTimeout(function(){_initLockPatternCanvas();},100);}
    else if(_hasPin()){_showLockScreen('pin');}
    else if(_hasBioKey()){_showLockScreen('bio');setTimeout(function(){_triggerBio();},400);}
  }

  // ── Biometric ──
  // ── Capacitor Native Biometric helper ──
  // ── Android Native Biometric Bridge ──
  function _isOneAndroid(){
    return !!(window.isOneAndroid && window.OneAndroid && window.OneAndroid.showBiometricPrompt);
  }
  function _isCapacitorNative(){
    return !!(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform());
  }

  async function _triggerBio(){
    var bi=document.getElementById('nlk-bio-icon'),bg=document.getElementById('nlk-bio-glyph');
    _setBioMsg('Authenticating\u2026');if(bi)bi.classList.add('nlk-bio-pulse');
    // ── Android WebView: use native BiometricPrompt ──
    if(_isOneAndroid()){
      window._oneBioUnlockCb=function(result){
        if(bi)bi.classList.remove('nlk-bio-pulse');
        if(result==='success'){
          if(bg){bg.textContent='check_circle';bg.style.color='var(--accent-green)';}
          _setBioMsg('Authenticated \u2713');
          // Apply master secret — same AES key regardless of lock method
          _clearFails();
          _applyMasterSecret();
          setTimeout(function(){_hideLockScreen();},500);
        } else {
          if(bg){bg.textContent='lock';bg.style.color='var(--accent-red)';}
          var msg=result==='cancelled'?'Cancelled. Use another method.':'Biometric failed. Try another method.';
          _setBioMsg(msg);
          setTimeout(function(){if(bg){bg.textContent='fingerprint';bg.style.color='var(--accent-primary)';}  _setBioMsg('Touch sensor or scan face to unlock');},2500);
        }
        delete window._oneBioUnlockCb;
      };
      window.OneAndroid.showBiometricPrompt('Unlock One Wallet','window._oneBioUnlockCb');
      return;
    }
    // ── Capacitor native ──
    if(_isCapacitorNative()){
      try{
        var plugins=window.Capacitor&&window.Capacitor.Plugins;
        var BiometricAuth=plugins&&(plugins.BiometricAuth||plugins.NativeBiometric);
        if(!BiometricAuth) throw new Error('NoBioPlugin');
        await (BiometricAuth.authenticate?BiometricAuth.authenticate({reason:'Unlock One Wallet',cancelTitle:'Cancel',allowDeviceCredential:false}):BiometricAuth.verifyIdentity({reason:'Unlock One Wallet',title:'ONE',subtitle:'',description:''}));
        if(bi)bi.classList.remove('nlk-bio-pulse');
        if(bg){bg.textContent='check_circle';bg.style.color='var(--accent-green)';}
        _setBioMsg('Authenticated \u2713');
        // Apply master secret — same AES key regardless of lock method
        _applyMasterSecret();
        setTimeout(function(){_hideLockScreen();},500);
      }catch(err){
        if(bi)bi.classList.remove('nlk-bio-pulse');
        if(bg){bg.textContent='lock';bg.style.color='var(--accent-red)';}
        _setBioMsg(err.name==='UserCancel'||err.message==='UserCancel'?'Cancelled. Use another method.':'Failed. Use PIN/Pattern.');
        setTimeout(function(){if(bg){bg.textContent='fingerprint';bg.style.color='var(--accent-primary)';}  _setBioMsg('Touch sensor or scan face to unlock');},2500);
      }
      return;
    }
    // ── Fallback: not supported ──
    if(bi)bi.classList.remove('nlk-bio-pulse');
    if(bg){bg.textContent='lock';bg.style.color='var(--accent-red)';}
    _setBioMsg('Biometrics not available. Use PIN/Pattern.');
    setTimeout(function(){if(bg){bg.textContent='fingerprint';bg.style.color='var(--accent-primary)';}  _setBioMsg('Touch sensor or scan face to unlock');},2500);
  }

  // ── Biometric Setup ──
  async function _setupBioRegister(){
    var errEl=document.getElementById('nlks-bio-err');
    var msgEl=document.getElementById('nlks-bio-setup-msg');
    if(errEl)errEl.textContent='';
    // ── Android WebView native biometric setup ──
    if(_isOneAndroid()){
      if(!window.OneAndroid.isBiometricAvailable()){
        if(errEl)errEl.textContent='No biometric enrolled. Set up fingerprint/face in Android Settings.';
        return;
      }
      if(msgEl)msgEl.textContent='Verify biometric to confirm setup\u2026';
      window._oneBioSetupCb=function(result){
        if(result==='success'){
          _set(SK.credId,'native_bio_android');_set(SK.enabled,'on');
          // Use master secret — same AES key regardless of lock method
          var _ms5 = _ensureMasterSecret();
          if(typeof OneCrypto!=='undefined') OneCrypto.setSecret(_ms5);
          _reEncryptWallets();
          closeSetup(true);_updateSetupUI();
          if(typeof showToast==='function')showToast('Biometric Lock set \u2713','fingerprint');
        } else {
          var msg2=result==='cancelled'?'Cancelled.':'Setup failed. Try again.';
          if(errEl)errEl.textContent=msg2;
          if(msgEl)msgEl.textContent='Tap to try again';
        }
        delete window._oneBioSetupCb;
      };
      window.OneAndroid.showBiometricPrompt('Register biometric for One Wallet','window._oneBioSetupCb');
      return;
    }
    // ── Capacitor native ──
    if(_isCapacitorNative()){
      var plugins=window.Capacitor&&window.Capacitor.Plugins;
      var BiometricAuth=plugins&&(plugins.BiometricAuth||plugins.NativeBiometric);
      if(!BiometricAuth){if(errEl)errEl.textContent='Biometric plugin not found.';return;}
      try{
        var avail=await (BiometricAuth.checkBiometry?BiometricAuth.checkBiometry():BiometricAuth.isAvailable());
        if(avail&&(avail.isAvailable===false||avail.has===false)){if(errEl)errEl.textContent='No biometric enrolled on device.';return;}
        if(msgEl)msgEl.textContent='Verify biometric to confirm setup\u2026';
        await (BiometricAuth.authenticate?BiometricAuth.authenticate({reason:'Register biometric for One Wallet',cancelTitle:'Cancel',allowDeviceCredential:false}):BiometricAuth.verifyIdentity({reason:'Register biometric',title:'ONE',subtitle:'',description:''}));
        _set(SK.credId,'native_bio_cap');_set(SK.enabled,'on');
        // Use master secret — same AES key regardless of lock method
        var _ms6 = _ensureMasterSecret();
        if(typeof OneCrypto!=='undefined') OneCrypto.setSecret(_ms6);
        _reEncryptWallets();
        closeSetup(true);_updateSetupUI();if(typeof showToast==='function')showToast('Biometric Lock set \u2713','fingerprint');
      }catch(err){
        var msg3=err.name==='UserCancel'||err.message==='UserCancel'?'Cancelled.':err.message||'Registration failed.';
        if(errEl)errEl.textContent=msg3;if(msgEl)msgEl.textContent='Tap to try again';
      }
      return;
    }
    // ── Not supported ──
    if(errEl)errEl.textContent='Biometrics not supported on this device. Use PIN or Pattern.';
  }

  // ── Setup Modal Open/Close ──
  function openSetup(){
    var el=document.getElementById('one-lock-setup');
    if(!el)return;
    el.style.display='flex'; el.classList.add('open');
    _updateSetupUI();
    _goStep(0);
    _setupMethod='';_setupPin='';_setupPinFirst='';_confirmPin='';
    _setupPatFirst='';_patSetupState='first';
  }
  function closeSetup(didSetLock){
    var el=document.getElementById('one-lock-setup');
    if(el){ el.style.display='none'; el.classList.remove('open'); }
    // Only fire pending action if lock was actually set (not cancelled/skipped)
    var _cb = oneLock._pendingAfterSetup;
    oneLock._pendingAfterSetup = null;
    if (didSetLock && typeof _cb === 'function') setTimeout(_cb, 300);
  }
  function _backdropClick(e){
    if(e.target===document.getElementById('one-lock-setup'))closeSetup(false);
  }

  // ── Step navigation ──
  function _goStep(n){
    [0,1,2].forEach(function(i){
      var s=document.getElementById('nlks-step-'+i);
      if(s)s.style.display=(i===n?'block':'none');
    });
    var sp=document.getElementById('nlks-step-2-pat');
    if(sp)sp.style.display='none';
  }

  // ── Setup UI state update ──
  function _updateSetupUI(){
    var hasPin=_hasPin(),hasPat=_hasPat(),hasBio=_hasBioKey();
    var def=_get(SK.default);
    var count=[hasPin,hasPat,hasBio].filter(Boolean).length;
    // Badges
    var bp=document.getElementById('nlks-status-pin');
    var bpat=document.getElementById('nlks-status-pattern');
    var bbio=document.getElementById('nlks-status-bio');
    if(bp)bp.style.opacity=hasPin?'1':'0.25';
    if(bpat)bpat.style.opacity=hasPat?'1':'0.25';
    if(bbio)bbio.style.opacity=hasBio?'1':'0.25';
    // Security bar
    var fill=document.getElementById('nlks-sec-fill');
    var label=document.getElementById('nlks-sec-label');
    var pct=count===0?0:count===1?40:count===2?75:100;
    var lvlText=count===0?'NO LOCK':count===1?'BASIC':count===2?'STRONG':'MAX';
    var lvlColor=count===0?'var(--accent-red)':count===1?'var(--accent-yellow)':count===2?'var(--accent-primary)':'var(--accent-green)';
    if(fill){fill.style.width=pct+'%';fill.style.background=lvlColor;}
    if(label){label.textContent=lvlText;label.style.color=lvlColor;}
    // PIN card
    var pinCard=document.getElementById('nlks-card-pin');
    var pinSub=document.getElementById('nlks-pin-card-sub');
    var pinBtn=document.getElementById('nlks-pin-card-btn');
    var pinDefBtn=document.getElementById('nlks-pin-default-btn');
    var pinRemBtn=document.getElementById('nlks-pin-remove-btn');
    var pinDefLbl=document.getElementById('nlks-pin-default-label');
    if(pinCard)pinCard.classList.toggle('active-pin',hasPin);
    if(pinSub)pinSub.textContent=hasPin?'Configured':'Not configured';
    if(pinBtn)pinBtn.textContent=hasPin?'Change':'Set';
    if(pinDefBtn)pinDefBtn.style.display=hasPin?'':'none';
    if(pinRemBtn)pinRemBtn.style.display=hasPin?'':'none';
    if(pinDefLbl)pinDefLbl.textContent=def==='pin'?'Default ★':'Default';
    if(pinCard)pinCard.classList.toggle('default-pin',def==='pin');
    // PIN radio
    var pinRadio=document.getElementById('nlks-pin-radio');
    if(pinRadio){pinRadio.classList.toggle('visible',hasPin);pinRadio.classList.toggle('selected',def==='pin');}
    // Pattern card
    var patCard=document.getElementById('nlks-card-pattern');
    var patSub=document.getElementById('nlks-pat-card-sub');
    var patBtn=document.getElementById('nlks-pat-card-btn');
    var patDefBtn=document.getElementById('nlks-pat-default-btn');
    var patRemBtn=document.getElementById('nlks-pat-remove-btn');
    var patDefLbl=document.getElementById('nlks-pat-default-label');
    if(patCard)patCard.classList.toggle('active-pattern',hasPat);
    if(patSub)patSub.textContent=hasPat?'Configured':'Not configured';
    if(patBtn)patBtn.textContent=hasPat?'Change':'Set';
    if(patDefBtn)patDefBtn.style.display=hasPat?'':'none';
    if(patRemBtn)patRemBtn.style.display=hasPat?'':'none';
    if(patDefLbl)patDefLbl.textContent=def==='pattern'?'Default ★':'Default';
    if(patCard)patCard.classList.toggle('default-pat',def==='pattern');
    // Pattern radio
    var patRadio=document.getElementById('nlks-pat-radio');
    if(patRadio){patRadio.classList.toggle('visible',hasPat);patRadio.classList.toggle('selected',def==='pattern');}
    // Bio card
    var bioCard=document.getElementById('nlks-card-bio');
    var bioSub=document.getElementById('nlks-bio-card-sub');
    var bioBtn=document.getElementById('nlks-bio-card-btn');
    var bioDefBtn=document.getElementById('nlks-bio-default-btn');
    var bioRemBtn=document.getElementById('nlks-bio-remove-btn');
    var bioDefLbl=document.getElementById('nlks-bio-default-label');
    if(bioCard)bioCard.classList.toggle('active-bio',hasBio);
    if(bioSub)bioSub.textContent=hasBio?'Configured':'Not configured';
    if(bioBtn)bioBtn.textContent=hasBio?'Change':'Set';
    if(bioDefBtn)bioDefBtn.style.display=hasBio?'':'none';
    if(bioRemBtn)bioRemBtn.style.display=hasBio?'':'none';
    if(bioDefLbl)bioDefLbl.textContent=def==='bio'?'Default ★':'Default';
    if(bioCard)bioCard.classList.toggle('default-bio',def==='bio');
    // Bio radio
    var bioRadio=document.getElementById('nlks-bio-radio');
    if(bioRadio){bioRadio.classList.toggle('visible',hasBio);bioRadio.classList.toggle('selected',def==='bio');}
    // Enable/disable lock globally
    if(_hasAny()){_set(SK.enabled,'on');}else{_del(SK.enabled);}
    _syncToggleUI(_isEnabled());
    // Update lock-setup-sub text in settings menu
    var sub=document.getElementById('lock-setup-sub');
    if(sub){
      var methods=[];
      if(hasPin)methods.push('PIN');
      if(hasPat)methods.push('Pattern');
      if(hasBio)methods.push('Biometric');
      sub.textContent=methods.length?methods.join(' · '):'Set PIN, Pattern or Biometric';
    }
  }
  function _syncToggleUI(on){
    var tog=document.getElementById('toggle-app-lock');
    if(tog){
      if(on)tog.classList.add('active');else tog.classList.remove('active');
    }
  }

  // ── Method selection ──
  function _setupChoose(method){
    _setupMethod=method;
    _setupPin='';_setupPinFirst='';_confirmPin='';
    _setupPatFirst='';_patSetupState='first';
    // Reset error labels
    ['nlks-pin-err','nlks-pat-err','nlks-bio-err','nlks-confirm-err','nlks-confirm-pat-err'].forEach(function(id){
      var el=document.getElementById(id);if(el)el.textContent='';
    });
    // Reset setup pin dots
    for(var i=0;i<PIN_LEN;i++){var d=document.getElementById('nlks-dot-'+i);if(d)d.classList.remove('filled');}
    // Show step 1 panels
    var pinSetup=document.getElementById('nlks-pin-setup');
    var patSetup=document.getElementById('nlks-pattern-setup');
    var bioSetup=document.getElementById('nlks-bio-setup');
    if(pinSetup)pinSetup.style.display=method==='pin'?'flex':'none';
    if(patSetup)patSetup.style.display=method==='pattern'?'flex':'none';
    if(bioSetup)bioSetup.style.display=method==='bio'?'flex':'none';
    _goStep(1);
    if(method==='pattern'){
      setTimeout(function(){_initSetupPatternCanvas();},100);
    }
    if(method==='bio'){
      var bsm=document.getElementById('nlks-bio-setup-msg');
      if(bsm)bsm.textContent='Tap to register biometric';
    }
  }

  // ── PIN Setup keypad ──
  function _setupPinKey(k){
    if(_setupPin.length>=PIN_LEN)return;
    _setupPin+=k;
    _renderSetupDots(_setupPin.length,'nlks-dot-');
    if(_setupPin.length===PIN_LEN){
      _setupPinFirst=_setupPin;_setupPin='';
      // Move to confirm step
      for(var i=0;i<PIN_LEN;i++){var d=document.getElementById('nlks-cdot-'+i);if(d)d.classList.remove('filled');}
      var ce=document.getElementById('nlks-confirm-err');if(ce)ce.textContent='';
      _goStep(2);
    }
  }
  function _setupPinBackspace(){
    if(_setupPin.length>0){_setupPin=_setupPin.slice(0,-1);_renderSetupDots(_setupPin.length,'nlks-dot-');}
  }
  function _renderSetupDots(n,prefix){
    for(var i=0;i<PIN_LEN;i++){
      var d=document.getElementById(prefix+i);
      if(d){if(i<n)d.classList.add('filled');else d.classList.remove('filled');}
    }
  }

  // ── PIN Confirm keypad ──
  function _confirmPinKey(k){
    if(_confirmPin.length>=PIN_LEN)return;
    _confirmPin+=k;
    _renderSetupDots(_confirmPin.length,'nlks-cdot-');
    if(_confirmPin.length===PIN_LEN){
      if(_setupPinFirst===_confirmPin){
        // Generate fresh random salt and store salted hash
        var salt = _genSalt();
        _saltedHash(_confirmPin, salt).then(function(h){
          _set(SK.pinSalt, salt);
          _set(SK.pinHash, h);
          _set('one_lock_pin_v6', '1'); // mark as 6-digit
          if(!_get(SK.default)) _set(SK.default,'pin'); // auto-set default if none
          if(!_get(SK.default))_set(SK.default,'pin');
          // Use master secret — same AES key regardless of lock method
          var _ms1 = _ensureMasterSecret();
          if(typeof OneCrypto!=='undefined') OneCrypto.setSecret(_ms1);
          closeSetup(true);_updateSetupUI();
          if(typeof showToast==='function')showToast('PIN Lock set ✓','dialpad');
          _confirmPin='';
        });
      } else {
        var ce=document.getElementById('nlks-confirm-err');
        if(ce)ce.textContent='PINs do not match. Try again.';
        _confirmPin='';
        for(var i=0;i<PIN_LEN;i++){var d=document.getElementById('nlks-cdot-'+i);if(d)d.classList.remove('filled');}
        setTimeout(function(){if(ce)ce.textContent='';},2000);
      }
    }
  }
  function _confirmPinBackspace(){
    if(_confirmPin.length>0){_confirmPin=_confirmPin.slice(0,-1);_renderSetupDots(_confirmPin.length,'nlks-cdot-');}
  }

  // ── Lock screen PIN keypad ──
  function _pinKey(k){
    if(_lockPin.length>=PIN_LEN)return;
    var _wait=_lockoutLeft();
    if(_wait>0){
      var errW=document.getElementById('nlk-pin-err');
      if(errW){errW.textContent=_lockoutMsg(_wait);setTimeout(function(){errW.textContent='';},2000);}
      return;
    }
    _lockPin+=k;
    _renderLockPinDots(_lockPin.length);
    if(_lockPin.length===PIN_LEN){
      var storedSalt = _get(SK.pinSalt);
      var storedHash = _get(SK.pinHash);
      var hashPromise = storedSalt
        ? _saltedHash(_lockPin, storedSalt)   // new salted format
        : _sha256(_lockPin);                   // legacy fallback (no salt stored)
      hashPromise.then(function(h){
        if(h===storedHash){
          _lockPin='';
          _clearFails();
          // Apply master secret — works regardless of which method was used to set lock
          _applyMasterSecret();
          _hideLockScreen();
        } else {
          _registerFail();
          var err=document.getElementById('nlk-pin-err');
          var _w2=_lockoutLeft();
          if(err)err.textContent=_w2>0?_lockoutMsg(_w2):'Incorrect PIN';
          _lockPin='';_resetLockPinDots();
          setTimeout(function(){if(err)err.textContent='';},2000);
        }
      });
    }
  }
  function _pinBackspace(){
    if(_lockPin.length>0){_lockPin=_lockPin.slice(0,-1);_renderLockPinDots(_lockPin.length);}
  }
  function _renderLockPinDots(n){
    for(var i=0;i<PIN_LEN;i++){
      var d=document.getElementById('nlk-dot-'+i);
      if(d){if(i<n)d.classList.add('filled');else d.classList.remove('filled');}
    }
  }
  function _resetLockPinDots(){for(var i=0;i<PIN_LEN;i++){var d=document.getElementById('nlk-dot-'+i);if(d)d.classList.remove('filled');}}

  // ── Pattern Setup Canvas ──
  function _initSetupPatternCanvas(){
    var canvas=document.getElementById('nlks-pattern-canvas');
    if(!canvas)return;
    _setupCanvas=_buildPatCanvas(canvas,function(path){
      if(path.length<3){
        var e=document.getElementById('nlks-pat-err');if(e)e.textContent='Connect at least 3 dots.';
        setTimeout(function(){if(e)e.textContent='';},1500);return;
      }
      _setupPatFirst=path.join('-');
      // Move to confirm canvas
      var cp=document.getElementById('nlks-step-2-pat');
      if(cp){cp.style.display='flex';}
      var s2=document.getElementById('nlks-step-2');if(s2)s2.style.display='none';
      var s1=document.getElementById('nlks-step-1');if(s1)s1.style.display='none';
      var s0=document.getElementById('nlks-step-0');if(s0)s0.style.display='none';
      var ce=document.getElementById('nlks-confirm-pat-err');if(ce)ce.textContent='';
      setTimeout(function(){_initConfirmPatternCanvas();},100);
    });
  }
  function _patSetupReset(){if(_setupCanvas&&_setupCanvas.reset)_setupCanvas.reset();}

  // ── Pattern Confirm Canvas ──
  function _initConfirmPatternCanvas(){
    var canvas=document.getElementById('nlks-confirm-canvas');
    if(!canvas)return;
    _confirmCanvas=_buildPatCanvas(canvas,function(path){
      var confirm=path.join('-');
      if(confirm===_setupPatFirst){
        _sha256(_setupPatFirst).then(function(h){
          _set(SK.patHash,h);
          // Use master secret — same AES key regardless of lock method
          var _ms3 = _ensureMasterSecret();
          if(typeof OneCrypto!=='undefined') OneCrypto.setSecret(_ms3);
          _reEncryptWallets();
          if(!_get(SK.default))_set(SK.default,'pattern');
          closeSetup(true);_updateSetupUI();
          if(typeof showToast==='function')showToast('Pattern Lock set ✓','pattern');
        });
      } else {
        var e=document.getElementById('nlks-confirm-pat-err');
        if(e)e.textContent='Pattern does not match. Try again.';
        if(_confirmCanvas&&_confirmCanvas.reset)_confirmCanvas.reset();
        setTimeout(function(){if(e)e.textContent='';},2000);
      }
    });
  }
  function _patConfirmReset(){if(_confirmCanvas&&_confirmCanvas.reset)_confirmCanvas.reset();}

  // ── Lock screen pattern canvas ──
  function _initLockPatternCanvas(){
    var canvas=document.getElementById('nlk-pattern-canvas');
    if(!canvas)return;
    _lockPatState=_buildPatCanvas(canvas,function(path){
      var _wait=_lockoutLeft();
      if(_wait>0){
        var eW=document.getElementById('nlk-pat-err');
        if(eW){eW.textContent=_lockoutMsg(_wait);setTimeout(function(){eW.textContent='';},2000);}
        if(_lockPatState&&_lockPatState.reset)_lockPatState.reset();
        return;
      }
      _sha256(path.join('-')).then(function(h){
        if(h===_get(SK.patHash)){
          _clearFails();
          // Apply master secret — same AES key regardless of lock method
          _applyMasterSecret();
          _hideLockScreen();
        } else {
          _registerFail();
          var e=document.getElementById('nlk-pat-err');
          var _w2=_lockoutLeft();
          if(e)e.textContent=_w2>0?_lockoutMsg(_w2):'Wrong pattern. Try again.';
          if(_lockPatState&&_lockPatState.reset)_lockPatState.reset();
          setTimeout(function(){if(e)e.textContent='';},2000);
        }
      });
    });
  }

  // ── Pattern canvas builder ──
  function _buildPatCanvas(canvas,onComplete){
    var ctx=canvas.getContext('2d');
    var SIZE=270,COLS=3,ROWS=3,R=22,TOUCH_R=34;
    var dots=[];
    for(var r=0;r<ROWS;r++)for(var c=0;c<COLS;c++)
      dots.push({x:45+c*90,y:45+r*90,idx:r*COLS+c});
    var path=[],drawing=false,mx=0,my=0;

    function draw(){
      ctx.clearRect(0,0,SIZE,SIZE);
      // Lines between touched dots
      ctx.strokeStyle='rgba(99,102,241,0.85)';ctx.lineWidth=3;ctx.lineCap='round';ctx.lineJoin='round';
      for(var i=1;i<path.length;i++){
        ctx.beginPath();ctx.moveTo(dots[path[i-1]].x,dots[path[i-1]].y);
        ctx.lineTo(dots[path[i]].x,dots[path[i]].y);ctx.stroke();
      }
      if(drawing&&path.length>0){
        ctx.beginPath();ctx.moveTo(dots[path[path.length-1]].x,dots[path[path.length-1]].y);
        ctx.lineTo(mx,my);ctx.stroke();
      }
      // Dots: small and quiet when idle, solid accent + thin ring when touched
      dots.forEach(function(d){
        var active=path.indexOf(d.idx)>=0;
        if(active){
          ctx.beginPath();ctx.arc(d.x,d.y,R-5,0,Math.PI*2);
          ctx.strokeStyle='rgba(99,102,241,0.35)';ctx.lineWidth=1;ctx.stroke();
          ctx.beginPath();ctx.arc(d.x,d.y,8,0,Math.PI*2);
          ctx.fillStyle='#6366f1';ctx.fill();
        } else {
          ctx.beginPath();ctx.arc(d.x,d.y,6,0,Math.PI*2);
          ctx.fillStyle='rgba(255,255,255,0.2)';ctx.fill();
        }
      });
    }
    function getPos(e){
      var rect=canvas.getBoundingClientRect();
      var scaleX=canvas.width/rect.width,scaleY=canvas.height/rect.height;
      var src=e.touches?e.touches[0]:e;
      return {x:(src.clientX-rect.left)*scaleX,y:(src.clientY-rect.top)*scaleY};
    }
    function nearest(x,y){
      var best=null,bd=1e9;
      dots.forEach(function(d){var dx=d.x-x,dy=d.y-y,dist=Math.sqrt(dx*dx+dy*dy);if(dist<bd){bd=dist;best=d;}});
      return bd<TOUCH_R?best:null;
    }
    function onStart(e){
      e.preventDefault();drawing=true;path=[];
      var p=getPos(e);mx=p.x;my=p.y;
      var d=nearest(mx,my);if(d&&path.indexOf(d.idx)<0)path.push(d.idx);
      draw();
    }
    function onMove(e){
      if(!drawing)return;e.preventDefault();
      var p=getPos(e);mx=p.x;my=p.y;
      var d=nearest(mx,my);if(d&&path.indexOf(d.idx)<0)path.push(d.idx);
      draw();
    }
    function onEnd(e){
      if(!drawing)return;drawing=false;
      draw();
      if(path.length>0)onComplete(path.slice());
    }
    canvas.addEventListener('mousedown',onStart);canvas.addEventListener('mousemove',onMove);canvas.addEventListener('mouseup',onEnd);
    canvas.addEventListener('touchstart',onStart,{passive:false});canvas.addEventListener('touchmove',onMove,{passive:false});canvas.addEventListener('touchend',onEnd);
    draw();
    return {reset:function(){path=[];drawing=false;draw();}};
  }

  // ── Set Default method ──
  function _setDefault(method){
    _set(SK.default,method);
    _updateSetupUI();
    if(typeof showToast==='function')showToast(method.charAt(0).toUpperCase()+method.slice(1)+' set as default','star');
  }

  // ── Remove lock / method ──
  function _removeLock(){
    _del(SK.enabled);_del(SK.pinHash);_del(SK.patHash);_del(SK.credId);_del(SK.default);
    _updateSetupUI();
    if(typeof showToast==='function')showToast('App Lock removed','lock_open');
  }
  function _removeMethod(method){
    if(method==='pin')_del(SK.pinHash);
    else if(method==='pattern')_del(SK.patHash);
    else if(method==='bio'){_del(SK.credId);}
    var def=_get(SK.default);
    if(def===method){
      // Pick next available
      if(method!=='pin'&&_hasPin())_set(SK.default,'pin');
      else if(method!=='pattern'&&_hasPat())_set(SK.default,'pattern');
      else if(method!=='bio'&&_hasBioKey())_set(SK.default,'bio');
      else _del(SK.default);
    }
    if(!_hasAny())_del(SK.enabled);
    _updateSetupUI();
    if(typeof showToast==='function')showToast(method.charAt(0).toUpperCase()+method.slice(1)+' removed','delete_outline');
  }

  // ── Lock screen panel switch ──
  function _showPanel(panel){_showLockScreen(panel);if(panel==='pattern')setTimeout(function(){_initLockPatternCanvas();},100);if(panel==='bio')setTimeout(function(){_triggerBio();},300);}

  // ── Bio message helper ──
  function _setBioMsg(msg){var el=document.getElementById('nlk-bio-msg');if(el)el.textContent=msg;}

  // ── Migration: 4-digit → 6-digit PIN ──
  // পুরনো 4-digit PIN hash stored থাকলে clear করো
  // SHA-256 of a 4-digit number = 64 hex chars — same as 6-digit,
  // তাই length দিয়ে detect করা যায় না।
  // Instead: one_lock_pin_v4 marker দিয়ে track করো।
  // নতুন PIN set হলে marker সেট হবে। না থাকলে = legacy 4-digit।
  function _migratePinIfNeeded(){
    var pinHash = _get(SK.pinHash);
    if(!pinHash) return; // no PIN set — nothing to migrate
    var isV6 = _get('one_lock_pin_v6');
    if(isV6) return; // already migrated
    // Legacy PIN found — clear it
    _del(SK.pinHash);
    _del(SK.pinSalt);
    _del('one_lock_pin_v6');
    // If PIN was the only method, disable lock
    if(!_hasPat() && !_hasBioKey()){
      _del(SK.enabled);
      _del(SK.default);
    }
    // Notify user
    setTimeout(function(){
      if(typeof showToast==='function'){
        showToast('PIN upgraded to 6-digit — please set a new PIN','lock');
      }
    }, 1500);
  }

  // ── Re-lock after the app has been in the background ──
  // _isUnlocked used to be set once and never reset, so the lock only appeared at a cold start.
  // When the page comes back after RELOCK_AFTER_MS hidden, show the lock screen again.
  var RELOCK_AFTER_MS = 30000;
  var _hiddenAt = 0;
  function _onVisibility(){
    if(document.hidden){ _hiddenAt = Date.now(); return; }
    var away = _hiddenAt ? Date.now() - _hiddenAt : 0;
    _hiddenAt = 0;
    if(away >= RELOCK_AFTER_MS && _isUnlocked && _isEnabled()){
      _isUnlocked = false;
      _checkOnOpen();
    }
  }
  document.addEventListener('visibilitychange', _onVisibility);

  function _init(){
    _migratePinIfNeeded();
    _syncToggleUI(_isEnabled());
    _updateSetupUI();
    // If no lock is set, populate plaintext cache immediately on boot
    _applySecretIfNoLock();
    if(!_isEnabled() && typeof loadWalletGroupsAsync==='function'){
      loadWalletGroupsAsync().then(function(){
        if(typeof _hwRestoreSelection==='function') _hwRestoreSelection();
      });
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',_init);else _init();


  return{
    _checkOnOpen:_checkOnOpen,_applySecretIfNoLock:_applySecretIfNoLock,_triggerBio:_triggerBio,_pinKey:_pinKey,_pinBackspace:_pinBackspace,
    _showPanel:_showPanel,_initLockPatternCanvas:_initLockPatternCanvas,
    openSetup:openSetup,closeSetup:closeSetup,_setupChoose:_setupChoose,
    _setupPinKey:_setupPinKey,_setupPinBackspace:_setupPinBackspace,
    _confirmPinKey:_confirmPinKey,_confirmPinBackspace:_confirmPinBackspace,
    _patSetupReset:_patSetupReset,_patConfirmReset:_patConfirmReset,
    _setupBioRegister:_setupBioRegister,_goStep:_goStep,
    _setDefault:_setDefault,
    _removeLock:_removeLock,_removeMethod:_removeMethod,_updateSettingsUI:_updateSetupUI,
    _backdropClick:_backdropClick,
  };
})();
