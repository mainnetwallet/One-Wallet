
// ══════════════════════════════════════════
// ── HARDWARE BACK BUTTON SYSTEM (v2) ──
// Simple approach: always keep exactly 1 dummy state.
// On back press → close modal or go back a page
// Then immediately push a dummy state again.
// This prevents stack buildup.
// ══════════════════════════════════════════
(function () {

  const MODAL_MAP = [
    { id: 'receive-overlay',         close: () => typeof closeReceiveModal      === 'function' && closeReceiveModal()      },
    { id: 'addr-list-overlay',        close: () => typeof closeAddrListModal     === 'function' && closeAddrListModal()     },
    { id: 'wg-import-overlay',        close: () => typeof closeWgImportModal     === 'function' && closeWgImportModal()     },
    { id: 'wg-create-overlay',        close: () => typeof closeWgCreateUI        === 'function' && closeWgCreateUI()        },
    { id: 'wg-keyinput-overlay',      close: () => typeof closeWgKeyInputUI      === 'function' && closeWgKeyInputUI()      },
    { id: 'wg-edit-overlay',          close: () => typeof closeWgEditModal       === 'function' && closeWgEditModal()       },
    { id: 'wgd-overlay',              close: () => typeof closeWgDetailUI        === 'function' && closeWgDetailUI()        },
    { id: 'wgak-overlay',             close: () => typeof closeWgakModal         === 'function' && closeWgakModal()         },
    { id: 'wgek-overlay',             close: () => typeof closeWgekModal         === 'function' && closeWgekModal()         },
    { id: 'wgm-overlay',              close: () => typeof closeWgManager         === 'function' && closeWgManager()         },
    { id: 'wg-picker-overlay',        close: () => typeof closeWgPicker          === 'function' && closeWgPicker()          },
    { id: 'pm-overlay',               close: () => typeof closePairManager       === 'function' && closePairManager()       },
    { id: 'tm-overlay',               close: () => typeof closeTokenManager      === 'function' && closeTokenManager()      },
    { id: 'txh-overlay',              close: () => typeof closeTxHistory         === 'function' && closeTxHistory()         },
    { id: 'send-confirm-overlay',     isOpen: el => el.style.pointerEvents === 'auto' && el.style.display !== 'none', close: () => typeof closeSendConfirmSheet === 'function' && closeSendConfirmSheet() },
    { id: 'send-qr-modal-overlay',    close: () => typeof closeSendQrScanner     === 'function' && closeSendQrScanner()     },
    { id: 'send-token-sheet',         close: () => typeof closeSendTokenSheet    === 'function' && closeSendTokenSheet()    },
    { id: 'send-overlay',             close: () => typeof closeSendModal         === 'function' && closeSendModal()         },
    { id: 'br-chain-overlay',         close: () => typeof brCloseChainPicker     === 'function' && brCloseChainPicker()     },
    { id: 'br-token-overlay',         close: () => typeof brCloseTokenPicker     === 'function' && brCloseTokenPicker()     },
    { id: 'br-wallet-panel-overlay',  close: () => typeof brCloseWalletPanel     === 'function' && brCloseWalletPanel()     },
    { id: 'send-from-wg-overlay',     close: () => typeof closeSendFromWgPicker  === 'function' && closeSendFromWgPicker()   },
    { id: 'send-to-wg-overlay',       close: () => typeof closeSendToWgPicker    === 'function' && closeSendToWgPicker()     },
    { id: 'hcp-overlay',              close: () => typeof closeHomeChainPicker   === 'function' && closeHomeChainPicker()    },
    { id: 'del-chain-overlay',        close: () => typeof closeDelChainPicker    === 'function' && closeDelChainPicker()     },
    { id: 'hw-group-overlay',         close: () => typeof hwCloseGroupPicker     === 'function' && hwCloseGroupPicker()      },
    { id: 'hw-wallet-overlay',        close: () => typeof hwCloseWalletPicker    === 'function' && hwCloseWalletPicker()     },
    { id: 'token-chart-full-overlay',  close: () => typeof closeTokenChartFull   === 'function' && closeTokenChartFull()   },
    { id: 'swap-wallet-drawer-overlay', close: () => typeof closeSwapWalletDrawer === 'function' && closeSwapWalletDrawer() },
    { id: 'nx-console-modal',            isOpen: el => el.style.display === 'flex', close: () => typeof closeConsoleLogPanel === 'function' && closeConsoleLogPanel() },
    { id: 'rpc-manager-overlay',          close: () => typeof closeRpcManager         === 'function' && closeRpcManager()         },
    { id: 'wgm-delete-sheet',               close: () => { const s = document.getElementById('wgm-delete-sheet'); if (s) { s.classList.remove('open'); if (s.parentNode) s.parentNode.removeChild(s); } } },
    { id: 'sw-settings-modal',            close: () => typeof window.swCloseSettings  === 'function' && window.swCloseSettings()  },
    { id: 'sw-history-modal',             close: () => typeof window.swCloseHistory   === 'function' && window.swCloseHistory()   },
    { id: 'br-settings-modal',            close: () => typeof window.brCloseSettings  === 'function' && window.brCloseSettings()  },
    { id: 'br-history-modal',             close: () => typeof window.brCloseHistory   === 'function' && window.brCloseHistory()   },
    { id: 'sw-chain-overlay',             close: () => typeof closeSwapChainPicker    === 'function' && closeSwapChainPicker()    },
    { id: 'sw-confirm-modal',             close: () => typeof window.swCloseConfirm   === 'function' && window.swCloseConfirm()  },
    { id: 'currency-picker-overlay',      close: () => typeof closeCurrencyPicker     === 'function' && closeCurrencyPicker()     },
    { id: 'pcp-overlay',                  close: () => { const e = document.getElementById('pcp-overlay'); if (e) e.classList.remove('open'); } },
    { id: 'sup-wallet-picker-overlay',    close: () => typeof window.supCloseWalletPicker === 'function' && window.supCloseWalletPicker() },
    { id: 'th-chain-overlay',             close: () => typeof window.thCloseChainPicker  === 'function' && window.thCloseChainPicker()   },
    { id: 'one-lock-setup',             close: () => typeof oneLock !== 'undefined' && typeof oneLock.closeSetup === 'function' && oneLock.closeSetup(false) },
  ];

  // Find the topmost open modal by z-index
  function getTopOpenModal() {
    let top = null, topZ = -1;
    MODAL_MAP.forEach(m => {
      const el = document.getElementById(m.id);
      const isOpen = el && (
        (typeof m.isOpen === 'function' && m.isOpen(el)) ||
        el.classList.contains('open') ||
        el.classList.contains('sw-open') ||
        el.classList.contains('brh-open') ||
        el.style.pointerEvents === 'all'
      );
      if (isOpen) {
        const z = parseInt(el.style.zIndex || getComputedStyle(el).zIndex) || 0;
        if (z > topZ) { topZ = z; top = m; }
      }
    });
    return top;
  }

  let _suppressing = false;
  window._onePageHistory = ['home'];
  window._oneBackNavInProgress = false;
  window._oneBackPressTime = 0;

  // ── Track page changes via window.currentPage setter ──
  // This fires regardless of which switchPage wrapper is active
  // Delete existing plain property first so defineProperty can install getter/setter
  try { delete window.currentPage; } catch(_) {}
  var _cpVal = window.currentPage || 'home';
  // Page history is now tracked directly inside switchPage() — no defineProperty needed

  // Always keep exactly 1 dummy pushState
  history.replaceState({ one: true }, '');
  history.pushState({ one: true }, '');

  function _doExitApp() {
    if (window.OneAndroid && typeof window.OneAndroid.exitApp === 'function') {
      window.OneAndroid.exitApp();
    } else if (window.android && typeof window.android.exitApp === 'function') {
      window.android.exitApp();
    } else if (navigator.app && navigator.app.exitApp) {
      navigator.app.exitApp();
    } else {
      history.go(-(history.length));
    }
  }

  window.addEventListener('popstate', function () {
    if (_suppressing) return;
    _suppressing = true;

    // ── Token Chart fullscreen back handling ──
    var _tcOverlay = document.getElementById('token-chart-full-overlay');
    if (_tcOverlay && _tcOverlay.getAttribute('data-fs') === '1') {
      var _fsOrient = _tcOverlay.getAttribute('data-fs-orient') || 'portrait';
      if (_fsOrient === 'landscape') {
        // Landscape FS → back → Portrait FS
        if (typeof tcfToggleFullscreen === 'function') tcfToggleFullscreen();
      } else {
        // Portrait FS → back → exit fullscreen completely
        if (typeof tcfExitFullscreen === 'function') tcfExitFullscreen();
      }
      history.pushState({ one: true }, '');
      _suppressing = false;
      return;
    }

    // ── Token Chart overlay open (not fullscreen): back = close chart ──
    if (_tcOverlay) {
      if (typeof closeTokenChart === 'function') closeTokenChart();
      history.pushState({ one: true }, '');
      _suppressing = false;
      return;
    }

    // ── Transfer Hub internal back navigation ──
    if (typeof currentPage !== 'undefined' && currentPage === 'transfer-hub') {
      var _thSubUIs = ['batchTransferUI', 'multiKeyNativeUI', 'nftTransferUI', 'withdrawManagerUI', 'phraseToKeyUI', 'selfTransferUI', 'balanceCheckUI', 'tokenApprovalManagerUI', 'walletToWalletUI', 'swapKeyUI', 'keyToolsUI'];
      var _thSubOpen = _thSubUIs.some(function(id) {
        var el = document.getElementById(id);
        return el && el.style.display !== 'none' && el.style.display !== '';
      });
      if (_thSubOpen && typeof openDashboard === 'function') {
        openDashboard();
        history.pushState({ one: true }, '');
        _suppressing = false;
        return;
      }
    }

    const modal = getTopOpenModal();
    if (modal) {
      // Modal open — close it
      modal.close();
    } else {
      // No modal — check page history stack
      if (!window._onePageHistory) window._onePageHistory = ['home'];
      var _ph = window._onePageHistory;

      if (_ph.length > 1) {
        // Pop current page, go to previous
        _ph.pop();
        var prevPage = _ph[_ph.length - 1];
        // Reset exit timer whenever navigating back through pages
        window._oneBackPressTime = 0;
        // Set flag so switchPage tracking skips this navigation
        window._oneBackNavInProgress = true;
        if (typeof switchPage === 'function') switchPage(prevPage);
        window._oneBackNavInProgress = false;
      } else {
        // Stack is at home — double-back to exit
        var now = Date.now();
        if (window._oneBackPressTime && (now - window._oneBackPressTime) < 500) {
          history.pushState({ one: true }, '');
          _suppressing = false;
          _doExitApp();
          return;
        } else {
          window._oneBackPressTime = now;
          if (typeof showToast === 'function') {
            showToast('Press back again to exit', 'exit_to_app');
          }
        }
      }
    }

    history.pushState({ one: true }, '');
    _suppressing = false;
  });

})();
