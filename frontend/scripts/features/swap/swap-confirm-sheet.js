
    /* ── Confirm Swap sheet animation helpers ── */
    (function(){
      var _orig_open  = window.swOpenConfirm;
      var _orig_close = window.swCloseConfirm;

      function _open() {
        var el = document.getElementById('sw-confirm-modal');
        if (!el) return;
        el.style.display = 'flex';
        // Desktop: centered dialog; Mobile: bottom sheet
        if (window.innerWidth >= 700) {
          el.style.alignItems = 'center';
          el.style.justifyContent = 'center';
        } else {
          el.style.alignItems = 'flex-end';
          el.style.justifyContent = '';
        }
        requestAnimationFrame(function(){
          requestAnimationFrame(function(){
            el.classList.add('cs-visible');
          });
        });
      }
      function _close() {
        var el = document.getElementById('sw-confirm-modal');
        if (!el) return;
        var sheet = document.getElementById('sw-confirm-sheet');
        // Clear any inline transform left by swipe gesture, restore CSS transition for smooth slide-down
        if (sheet) {
          sheet.style.transition = 'transform 0.38s cubic-bezier(0.34,1.1,0.64,1)';
          sheet.style.transform = '';
        }
        // Let paint settle before triggering CSS close animation
        requestAnimationFrame(function() {
          requestAnimationFrame(function() {
            el.classList.remove('cs-visible');
            setTimeout(function(){
              el.style.display = 'none';
              if (sheet) { sheet.style.transition = ''; sheet.style.transform = ''; }
              var btn = document.getElementById('sw-conf-execute-btn');
              if (btn) {
                btn.disabled = false;
                btn.style.opacity = '';
                btn.innerHTML = '<span class="material-icons-round" style="font-size:19px;">rocket_launch</span> Confirm &amp; Swap';
              }
            }, 420);
          });
        });
      }

      /* Patch after DOM ready so original functions are already defined */
      document.addEventListener('DOMContentLoaded', function(){
        if (typeof window.swOpenConfirm === 'function') {
          var origOpen = window.swOpenConfirm;
          window.swOpenConfirm = function(){
            origOpen.apply(this, arguments);
            _open();
          };
        } else {
          window.swOpenConfirm = _open;
        }
        if (typeof window.swCloseConfirm === 'function') {
          var origClose = window.swCloseConfirm;
          window.swCloseConfirm = function(){
            origClose.apply(this, arguments);
            _close();
          };
        } else {
          window.swCloseConfirm = _close;
        }
      });
    })();
    