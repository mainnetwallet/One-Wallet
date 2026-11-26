// ── Restore persisted toggle states on load ──
(function _restoreToggles() {
  function _restore() {
    try {
      const hapticEl = document.getElementById('toggle-haptic');
      if (hapticEl) {
        const h = localStorage.getItem('one_haptic');
        if (h === 'off') hapticEl.classList.remove('on');
        else hapticEl.classList.add('on'); // default ON
      }
      const bioEl = document.getElementById('toggle-bio');
      if (bioEl) {
        const b = localStorage.getItem('one_bio_lock');
        if (b === 'on') bioEl.classList.add('on');
        else bioEl.classList.remove('on');
      }
      // Notifications: restore based on permission + saved pref
      const notifEl  = document.getElementById('toggle-notif');
      const notifSub = document.getElementById('notif-toggle-sub');
      if (notifEl) {
        var saved = '';
        try { saved = localStorage.getItem('one_notif') || ''; } catch(e) {}
        // ── Android Native: check permission ──
        if (window.isOneAndroid && window.OneAndroid && window.OneAndroid.isNotificationPermissionGranted) {
          var androidGranted = window.OneAndroid.isNotificationPermissionGranted();
          if (androidGranted && saved !== 'off') {
            notifEl.classList.add('on');
            if (notifSub) notifSub.textContent = 'Enabled — you\'ll get important alerts';
          } else {
            notifEl.classList.remove('on');
            if (notifSub) notifSub.textContent = 'Allow push notifications';
          }
        } else if (!('Notification' in window)) {
          notifEl.style.opacity = '0.4';
          notifEl.style.pointerEvents = 'none';
          if (notifSub) notifSub.textContent = 'Not supported on this device';
        } else if (Notification.permission === 'granted' && saved !== 'off') {
          notifEl.classList.add('on');
          if (notifSub) notifSub.textContent = 'Enabled — you\'ll get important alerts';
        } else if (Notification.permission === 'denied') {
          notifEl.classList.remove('on');
          if (notifSub) notifSub.textContent = 'Blocked — check settings';
        } else {
          notifEl.classList.remove('on');
          if (notifSub) notifSub.textContent = 'Allow push notifications';
        }
      }
      // Console Log capture toggle
      const consoleToggleEl = document.getElementById('console-log-menu-toggle');
      const consoleSubEl = document.getElementById('console-log-menu-sub');
      if (consoleToggleEl) {
        if (window._nxConsoleEnabled) {
          consoleToggleEl.classList.add('on');
          if (consoleSubEl) consoleSubEl.textContent = 'Capturing — tap to view';
        } else {
          consoleToggleEl.classList.remove('on');
          if (consoleSubEl) consoleSubEl.textContent = 'Off — tap to view & enable';
        }
      }
    } catch(e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _restore);
  else _restore();
})();


// ── CHIP SELECT ──
function selectChip(el, group) {
  el.closest('.chip-selector').querySelectorAll('.chip-opt').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  haptic();
}

// ── COPY PROFILE ADDRESS ──
function copyProfileAddress() {
  if (validatedKeys.length === 0) { showToast('No keys loaded', 'warning'); return; }
  try {
    const wallet = new ethers.Wallet(validatedKeys[0]);
    navigator.clipboard?.writeText(wallet.address).catch(()=>{});
    showToast('Address copied!', 'content_copy');
  } catch(e) { showToast('Copy failed', 'error'); }
  haptic();
}

// ── HOME WALLET SWITCHER STATE ──
let homeActiveKey = null; // currently selected private key for home screen

const HW_KEY_PERSIST = 'one_hw_selected_key_v1';
const HW_GROUP_PERSIST = 'one_hw_selected_group_v1';
