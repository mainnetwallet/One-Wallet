function toggleSwitch(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('on');
  haptic();
  const isOn = el.classList.contains('on');
  const labels = {
    'toggle-rpc': ['RPC Failover ON', 'RPC Failover OFF'],
    'toggle-fast': ['Ultra Fast Mode ON', 'Ultra Fast OFF'],
    'toggle-paymaster': ['Paymaster ON', 'Paymaster OFF'],
    'cfg-paymaster': ['Paymaster ON', 'Paymaster OFF'],
    'toggle-dry': ['Dry Run ON', 'Dry Run OFF'],
    'toggle-haptic': ['Haptics ON', 'Haptics OFF'],
    'toggle-bio': ['Biometric Lock ON', 'Biometric Lock OFF'],
  };
  const msgs = labels[id] || ['ON', 'OFF'];
  showToast(isOn ? msgs[0] : msgs[1], isOn ? 'check_circle' : 'cancel');

  // ── Persist toggle states ──
  if (id === 'toggle-haptic') {
    try { localStorage.setItem('one_haptic', isOn ? 'on' : 'off'); } catch(e) {}
  }
  if (id === 'cfg-paymaster' || id === 'toggle-paymaster') {
    try { localStorage.setItem('one_paymaster_enabled', isOn ? 'on' : 'off'); } catch(e) {}
    // Keep Settings toggle in visual sync
    var _sEl = document.getElementById('settings-cfg-paymaster');
    if (_sEl) { if (isOn) _sEl.classList.add('on'); else _sEl.classList.remove('on'); }
  }
  // settings-cfg-paymaster is a visual proxy — it triggers cfg-paymaster toggle
  if (id === 'settings-cfg-paymaster') {
    // Already handled above via onclick calling toggleSwitch('cfg-paymaster')
    return;
  }
  if (id === 'toggle-bio') {
    try { localStorage.setItem('one_bio_lock', isOn ? 'on' : 'off'); } catch(e) {}
    if (isOn) {
      var _bioAvail = (window.isOneAndroid && window.OneAndroid && window.OneAndroid.isBiometricAvailable && window.OneAndroid.isBiometricAvailable()) || ('credentials' in navigator);
      if (!_bioAvail) {
        showToast('Biometrics not supported on this device', 'warning');
        el.classList.remove('on');
        try { localStorage.setItem('one_bio_lock', 'off'); } catch(e) {}
        return;
      }
    }
    if (isOn) {
      // If no lock method configured yet, open setup
      var method = '';
      try { method = localStorage.getItem('one_lock_method') || ''; } catch(e){}
      if (!method) {
        setTimeout(function(){ oneLock.openSetup(); }, 300);
      }
    }
    oneLock._updateSettingsUI();
  }
}

// ── One Native Notification Helper ──
function _oneSendNotif(title, body) {
  try {
    var notifEnabled = localStorage.getItem('one_notif') === 'on';
    if (!notifEnabled) return;
    if (!window.isOneAndroid || !window.OneAndroid) return;
    // Bot/system completions always silent — only tx confirms (showNotificationWithUrl) get sound
    if (typeof window.OneAndroid.showSilentNotification === 'function') {
      window.OneAndroid.showSilentNotification(title, body);
    } else if (typeof window.OneAndroid.showNotification === 'function') {
      window.OneAndroid.showNotification(title, body);
    }
  } catch(e) {}
}

// ── NOTIFICATIONS TOGGLE ──
function toggleNotifications() {
  haptic();
  var el  = document.getElementById('toggle-notif');
  var sub = document.getElementById('notif-toggle-sub');

  // ── If currently ON → turn OFF ──
  if (el && el.classList.contains('on')) {
    el.classList.remove('on');
    try { localStorage.setItem('one_notif', 'off'); } catch(e) {}
    if (sub) sub.textContent = 'Allow push notifications';
    showToast('Notifications disabled', 'notifications_off');
    return;
  }

  // ── Android Native Bridge ──
  if (window.isOneAndroid && window.OneAndroid && window.OneAndroid.isNotificationPermissionGranted) {
    var granted = window.OneAndroid.isNotificationPermissionGranted();
    if (granted) {
      _enableNotif(el, sub);

    } else {
      // Register callback for permission result
      window._oneNotifPermCallback = function(isGranted) {
        if (isGranted) {
          _enableNotif(el, sub);
    
        } else {
          showToast('Permission denied', 'notifications_off');
          if (sub) sub.textContent = 'Permission denied';
        }
        window._oneNotifPermCallback = null;
      };
      window.OneAndroid.requestNotificationPermission();
    }
    return;
  }

  // ── Web Notification API fallback (non-Android) ──
  if (!('Notification' in window)) {
    showToast('Notifications not supported on this device', 'warning');
    return;
  }
  if (Notification.permission === 'granted') {
    _enableNotif(el, sub);
  } else if (Notification.permission === 'denied') {
    showToast('Notifications blocked — enable in settings', 'block');
    if (sub) sub.textContent = 'Blocked — check settings';
  } else {
    Notification.requestPermission().then(function(perm) {
      if (perm === 'granted') {
        _enableNotif(el, sub);
      } else {
        showToast('Permission denied', 'notifications_off');
        if (sub) sub.textContent = 'Permission denied';
      }
    });
  }
}
function _enableNotif(el, sub) {
  if (el) el.classList.add('on');
  try { localStorage.setItem('one_notif', 'on'); } catch(e) {}
  if (sub) sub.textContent = 'Enabled — you\'ll get important alerts';
  showToast('Notifications enabled ✓', 'notifications_active');
}

