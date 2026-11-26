// ════════════════════════════════════════════════════
//  STEP 1 — KEY DISPLAY BOX + MANUAL INPUT
// ════════════════════════════════════════════════════

// ── Show / Hide toggle state ──
var _step1KeyVisible = false;

function step1ToggleKeyVisibility() {
  _step1KeyVisible = !_step1KeyVisible;
  var masked  = document.getElementById('step1-key-masked');
  var taWrap  = document.getElementById('step1-key-textarea-wrap');
  var icon    = document.getElementById('step1-key-show-icon');
  var label   = document.getElementById('step1-key-show-label');
  var showBtn = document.getElementById('step1-key-show-btn');

  if (_step1KeyVisible) {
    if (masked)  masked.style.display  = 'none';
    if (taWrap)  taWrap.style.display  = 'block';
    if (icon)    icon.textContent       = 'visibility_off';
    if (label)   label.textContent      = 'HIDE';
    if (showBtn) { showBtn.style.background = 'rgba(244,63,94,0.10)'; showBtn.style.borderColor = 'rgba(244,63,94,0.25)'; if(icon) icon.style.color='var(--accent-red)'; if(label) label.style.color='var(--accent-red)'; }
    setTimeout(function() { var ta = document.getElementById('step1-key-textarea'); if (ta) ta.focus(); }, 50);
  } else {
    if (masked)  masked.style.display  = 'flex';
    if (taWrap)  taWrap.style.display  = 'none';
    if (icon)    icon.textContent       = 'visibility';
    if (label)   label.textContent      = 'SHOW';
    if (showBtn) { showBtn.style.background = 'rgba(99,102,241,0.10)'; showBtn.style.borderColor = 'rgba(99,102,241,0.25)'; if(icon) icon.style.color='var(--accent-primary)'; if(label) label.style.color='var(--accent-primary)'; }
    _step1RenderMasked();
  }
  if (typeof haptic !== 'undefined') haptic();
}

// Render masked rows (lock icon style) — one row per key
function _step1RenderMasked() {
  var ta = document.getElementById('step1-key-textarea');
  var rowsEl = document.getElementById('step1-key-masked-rows');
  var emptyEl = document.getElementById('step1-key-masked-empty');
  if (!rowsEl) return;
  var lines = ta ? ta.value.split('\n').map(function(l){return l.trim();}).filter(Boolean) : [];
  var validLines = lines.filter(function(l) {
    var k = l.startsWith('0x') ? l : '0x'+l;
    return /^0x[0-9a-fA-F]{64}$/.test(k);
  });
  rowsEl.innerHTML = '';
  if (validLines.length === 0) {
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';
  validLines.forEach(function(k, i) {
    var addr = '';
    try {
      var norm = k.startsWith('0x') ? k : '0x'+k;
      var w = new ethers.Wallet(norm);
      addr = w.address;
    } catch(e) { addr = '\u2014'; }
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--bg-glass);border:1px solid var(--border-subtle);border-radius:8px;';
    row.innerHTML =
      '<div style="width:20px;height:20px;border-radius:6px;background:linear-gradient(135deg,var(--accent-primary),var(--accent-secondary));display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:9px;font-weight:900;color:#fff;">'+(i+1)+'</div>'+
      '<div style="flex:1;min-width:0;">'+
        '<div style="font-family:var(--font-mono);font-size:10px;color:var(--text-muted);letter-spacing:2px;">&bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull;</div>'+
        '<div style="font-family:var(--font-mono);font-size:9px;color:var(--neon-cyan);margin-top:2px;overflow-x:auto;white-space:nowrap;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding-bottom:1px;">'+addr+'</div>'+
      '</div>'+
      '<span class="material-icons-round" style="font-size:12px;color:var(--accent-green);flex-shrink:0;">lock</span>';
    rowsEl.appendChild(row);
  });
}

// Sync textarea with the current validatedKeys (from group selection)
function _step1SyncKeyBox(keys) {
  var ta = document.getElementById('step1-key-textarea');
  if (!ta) return;
  // Only overwrite if the textarea is NOT actively being edited manually
  if (ta.dataset.manualMode === '1') return;
  ta.value = (keys || []).join('\n');
  if (!_step1KeyVisible) _step1RenderMasked();
  _step1UpdateStatus();
}

// Called on every oninput event — parse manual keys and merge into validatedKeys
function step1OnKeyInput() {
  var ta = document.getElementById('step1-key-textarea');
  if (!ta) return;
  ta.dataset.manualMode = '1'; // flag: user is typing manually
  _step1UpdateStatus();
}

// Parse textarea → update validatedKeys, badge, status
function _step1UpdateStatus() {
  var ta = document.getElementById('step1-key-textarea');
  if (!ta) return;

  var lines = ta.value.split('\n').map(function(l) { return l.trim(); }).filter(Boolean);
  var valid = [];
  var invalid = 0;
  lines.forEach(function(line) {
    try {
      var k = line.startsWith('0x') ? line : '0x' + line;
      if (/^0x[0-9a-fA-F]{64}$/.test(k)) {
        valid.push(k);
      } else {
        invalid++;
      }
    } catch(e) { invalid++; }
  });

  // Deduplicate
  var seen = new Set();
  valid = valid.filter(function(k) { return seen.has(k) ? false : (seen.add(k), true); });

  // Update validatedKeys from textarea if in manual mode
  var ta2 = document.getElementById('step1-key-textarea');
  if (ta2 && ta2.dataset.manualMode === '1') {
    validatedKeys = valid;
  }

  // Badge
  var validBadge = document.getElementById('step1-key-valid-badge');
  if (validBadge) {
    if (valid.length > 0) {
      validBadge.style.display = 'inline-block';
      validBadge.textContent = valid.length + ' VALID';
      validBadge.style.color = 'var(--accent-green)';
      validBadge.style.background = 'rgba(16,185,129,0.12)';
      validBadge.style.borderColor = 'rgba(16,185,129,0.3)';
    } else if (lines.length > 0) {
      validBadge.style.display = 'inline-block';
      validBadge.textContent = 'NO VALID';
      validBadge.style.color = 'var(--accent-red)';
      validBadge.style.background = 'rgba(244,63,94,0.10)';
      validBadge.style.borderColor = 'rgba(244,63,94,0.25)';
    } else {
      validBadge.style.display = 'none';
    }
  }

  // Count overlay
  var overlay = document.getElementById('step1-key-count-overlay');
  if (overlay) {
    if (lines.length > 0) {
      overlay.style.display = 'block';
      overlay.textContent = valid.length + ' / ' + lines.length + ' valid';
    } else {
      overlay.style.display = 'none';
    }
  }

  // Status bar
  var statusDiv  = document.getElementById('step1-key-status');
  var statusIcon = document.getElementById('step1-key-status-icon');
  var statusText = document.getElementById('step1-key-status-text');
  if (statusDiv) {
    if (lines.length === 0) {
      statusDiv.style.display = 'none';
    } else if (valid.length > 0 && invalid === 0) {
      statusDiv.style.display = 'flex';
      statusDiv.style.background = 'rgba(16,185,129,0.07)';
      statusDiv.style.borderColor = 'rgba(16,185,129,0.2)';
      if (statusIcon) { statusIcon.textContent = 'check_circle'; statusIcon.style.color = 'var(--accent-green)'; }
      if (statusText) statusText.textContent = valid.length + ' key' + (valid.length !== 1 ? 's' : '') + ' ready · All valid';
    } else if (valid.length > 0) {
      statusDiv.style.display = 'flex';
      statusDiv.style.background = 'rgba(245,158,11,0.07)';
      statusDiv.style.borderColor = 'rgba(245,158,11,0.2)';
      if (statusIcon) { statusIcon.textContent = 'warning'; statusIcon.style.color = 'var(--accent-amber)'; }
      if (statusText) statusText.textContent = valid.length + ' valid · ' + invalid + ' invalid (skipped)';
    } else {
      statusDiv.style.display = 'flex';
      statusDiv.style.background = 'rgba(244,63,94,0.07)';
      statusDiv.style.borderColor = 'rgba(244,63,94,0.2)';
      if (statusIcon) { statusIcon.textContent = 'error_outline'; statusIcon.style.color = 'var(--accent-red)'; }
      if (statusText) statusText.textContent = 'No valid keys found — check format';
    }
  }

  // Sync key-count-badge (top Select Wallet button)
  var kcb = document.getElementById('key-count-badge');
  if (kcb) {
    if (valid.length > 0) {
      kcb.style.display = 'block';
      kcb.textContent = valid.length + ' KEY' + (valid.length !== 1 ? 'S' : '');
    } else {
      kcb.style.display = 'none';
    }
  }
}

// Clear button — clears textarea + resets manual mode + clears validatedKeys
function step1ClearKeys() {
  var ta = document.getElementById('step1-key-textarea');
  if (ta) { ta.value = ''; ta.dataset.manualMode = '0'; }
  validatedKeys = [];
  swapSelectedGroupIds = [];
  if (typeof saveSwapSelectedGroupIds === 'function') saveSwapSelectedGroupIds();
  // Reset pill / picker
  var pill   = document.getElementById('swap-active-group-pill');
  var picker = document.getElementById('swap-group-picker');
  if (pill)   pill.style.display   = 'none';
  if (picker) picker.style.display = 'block';
  var subEl = document.getElementById('swap-group-btn-sub');
  if (subEl) { subEl.textContent = 'TAP TO CHOOSE GROUPS'; subEl.style.color = ''; }
  // No wallet selected → hide Private Keys box
  var _keyBox2 = document.getElementById('step1-key-box');
  if (_keyBox2) _keyBox2.style.display = 'none';
  _step1UpdateStatus();
  showToast('Keys cleared', 'delete');
  haptic && haptic();
}

// When drawer is confirmed in step1 mode, reset manual flag so group keys can sync
(function() {
  var _origConfirm = window.confirmSwapWalletDrawer;
  window.confirmSwapWalletDrawer = function() {
    var ta = document.getElementById('step1-key-textarea');
    if (ta) ta.dataset.manualMode = '0';
    if (typeof _origConfirm === 'function') _origConfirm();
  };
})();
// ── END STEP 1 KEY BOX ──

function openSwapModal() {
  switchPage('nansen');
  haptic && haptic();
}
function closeSwapModal() {
  switchPage('profile');
  haptic && haptic();
}

/* ════════════════════════════════════════════════════
   ADVANCED MULTI-DEX SWAP ENGINE
   ════════════════════════════════════════════════════ */
