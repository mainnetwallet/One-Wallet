
  // ── Clipboard Permission & Paste System ──
  var _clipboardGranted = false; // cached permission state

  function mobilePasteTo(targetId) {
    var target = document.getElementById(targetId);
    if (!target) return;

    // Already granted — paste directly
    if (_clipboardGranted) {
      _doPaste(target);
      return;
    }

    // Check permission status first
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'clipboard-read' }).then(function(result) {
        if (result.state === 'granted') {
          _clipboardGranted = true;
          _doPaste(target);
        } else if (result.state === 'prompt') {
          _showPastePermissionModal(target);
        } else {
          // denied
          _showPasteDeniedModal(target);
        }
      }).catch(function() {
        // permissions API not supported — try directly
        _showPastePermissionModal(target);
      });
    } else {
      _showPastePermissionModal(target);
    }
  }

  function _doPaste(target) {
    if (navigator.clipboard && navigator.clipboard.readText) {
      navigator.clipboard.readText().then(function(text) {
        if (text) {
          var start = target.selectionStart !== undefined ? target.selectionStart : target.value.length;
          var end   = target.selectionEnd   !== undefined ? target.selectionEnd   : target.value.length;
          target.value = target.value.slice(0, start) + text + target.value.slice(end);
          target.dispatchEvent(new Event('input', { bubbles: true }));
          _clipboardGranted = true;
          _showPasteToast('✅ Pasted!');
        } else {
          _showPasteToast('⚠️ Clipboard is empty');
        }
      }).catch(function() {
        _clipboardGranted = false;
        _showPasteDeniedModal(target);
      });
    } else {
      // Fallback — no focus to avoid keyboard
      try { document.execCommand('paste'); } catch(e) {}
      setTimeout(function() {
        target.dispatchEvent(new Event('input', { bubbles: true }));
      }, 100);
    }
  }

  function _showPastePermissionModal(target) {
    // Remove existing modal if any
    var old = document.getElementById('_pastePermModal');
    if (old) old.remove();

    var modal = document.createElement('div');
    modal.id = '_pastePermModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);';
    modal.innerHTML = `
      <div style="width:100%;max-width: 100%;background:#0f0f1a;border:1px solid rgba(99,102,241,0.35);border-radius:20px 20px 0 0;padding:24px 20px 32px;box-shadow:0 -8px 40px rgba(0,0,0,0.6);">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
          <div style="width:40px;height:40px;border-radius:12px;background:rgba(99,102,241,0.18);border:1px solid rgba(99,102,241,0.35);display:flex;align-items:center;justify-content:center;">
            <span class="material-icons-round" style="font-size:20px;color:#a78bfa;">content_paste</span>
          </div>
          <div>
            <div style="font-size:0.95rem;font-weight:700;color:#f1f1f8;">Clipboard Access</div>
            <div style="font-size:0.75rem;color:#8b8ba7;margin-top:2px;">One Wallet wants to read your clipboard</div>
          </div>
        </div>
        <div style="font-size:0.8rem;color:#8b8ba7;margin:12px 0 20px;line-height:1.6;padding:10px 12px;background:rgba(255,255,255,0.04);border-radius:10px;border:1px solid rgba(255,255,255,0.06);">
          📋 This allows the Paste button to read copied text (phrases / keys) directly from your clipboard.
        </div>
        <div style="display:flex;gap:10px;">
          <button id="_pasteDenyBtn" style="flex:1;padding:12px;border-radius:11px;border:1px solid rgba(244,63,94,0.3);background:rgba(244,63,94,0.08);color:#f43f5e;font-weight:700;font-size:0.85rem;cursor:pointer;">
            ✕ Deny
          </button>
          <button id="_pasteAllowBtn" style="flex:2;padding:12px;border-radius:11px;border:none;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-weight:700;font-size:0.85rem;cursor:pointer;box-shadow:0 4px 16px rgba(99,102,241,0.35);">
            ✓ Allow Paste
          </button>
        </div>
      </div>`;

    document.body.appendChild(modal);

    document.getElementById('_pasteAllowBtn').onclick = function() {
      modal.remove();
      _doPaste(target);
    };
    document.getElementById('_pasteDenyBtn').onclick = function() {
      modal.remove();
      _showPasteDeniedModal(target);
    };
    // tap outside to dismiss
    modal.addEventListener('click', function(e) {
      if (e.target === modal) modal.remove();
    });
  }

  function _showPasteDeniedModal(target) {
    var old = document.getElementById('_pasteDeniedModal');
    if (old) old.remove();

    var modal = document.createElement('div');
    modal.id = '_pasteDeniedModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);';
    modal.innerHTML = `
      <div style="width:100%;max-width: 100%;background:#0f0f1a;border:1px solid rgba(244,63,94,0.3);border-radius:20px 20px 0 0;padding:24px 20px 32px;box-shadow:0 -8px 40px rgba(0,0,0,0.6);">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
          <div style="width:40px;height:40px;border-radius:12px;background:rgba(244,63,94,0.12);border:1px solid rgba(244,63,94,0.3);display:flex;align-items:center;justify-content:center;">
            <span class="material-icons-round" style="font-size:20px;color:#f43f5e;">block</span>
          </div>
          <div>
            <div style="font-size:0.95rem;font-weight:700;color:#f1f1f8;">Clipboard Denied</div>
            <div style="font-size:0.75rem;color:#8b8ba7;margin-top:2px;">Manual paste required</div>
          </div>
        </div>
        <div style="font-size:0.8rem;color:#8b8ba7;margin:12px 0 20px;line-height:1.6;padding:10px 12px;background:rgba(255,255,255,0.04);border-radius:10px;border:1px solid rgba(255,255,255,0.06);">
          👆 Tap inside the text box, then long-press and select <b style="color:#f1f1f8;">Paste</b> from your phone's menu.
        </div>
        <div style="display:flex;gap:10px;">
          <button id="_pasteRetryBtn" style="flex:1;padding:12px;border-radius:11px;border:1px solid rgba(99,102,241,0.35);background:rgba(99,102,241,0.08);color:#a78bfa;font-weight:700;font-size:0.85rem;cursor:pointer;">
            🔄 Try Again
          </button>
          <button id="_pasteDismissBtn" style="flex:1;padding:12px;border-radius:11px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:#8b8ba7;font-weight:700;font-size:0.85rem;cursor:pointer;">
            OK
          </button>
        </div>
      </div>`;

    document.body.appendChild(modal);

    document.getElementById('_pasteRetryBtn').onclick = function() {
      modal.remove();
      _showPastePermissionModal(target);
    };
    document.getElementById('_pasteDismissBtn').onclick = function() {
      modal.remove();
    };
    modal.addEventListener('click', function(e) {
      if (e.target === modal) { modal.remove(); }
    });
  }

  function _showPasteToast(msg) {
    var old = document.getElementById('_pasteToast');
    if (old) old.remove();
    var toast = document.createElement('div');
    toast.id = '_pasteToast';
    toast.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);z-index:99999;background:#141423;border:1px solid rgba(99,102,241,0.4);color:#f1f1f8;padding:10px 20px;border-radius:12px;font-size:0.82rem;font-weight:600;box-shadow:0 4px 20px rgba(0,0,0,0.5);pointer-events:none;white-space:nowrap;';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(function() { if (toast.parentNode) toast.remove(); }, 2000);
  }
  