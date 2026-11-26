
(function OneBackgroundGuard() {
  'use strict';

  // ══════════════════════════════════════════════
  // 1. WAKE LOCK — সবসময় active (শুধু tx নয়)
  // ══════════════════════════════════════════════
  let _wakeLock = null;
  let _wakeLockActive = false;

  async function _acquireWakeLock() {
    try {
      if ('wakeLock' in navigator && !_wakeLockActive) {
        _wakeLock = await navigator.wakeLock.request('screen');
        _wakeLockActive = true;
        _wakeLock.addEventListener('release', function() {
          _wakeLockActive = false;
          // Auto re-acquire — screen lock হলেও আবার নেবে
          setTimeout(_acquireWakeLock, 1000);
        });
      }
    } catch(e) { /* silent */ }
  }

  async function _releaseWakeLock() {
    try {
      if (_wakeLock && _wakeLockActive) {
        await _wakeLock.release();
        _wakeLock = null;
        _wakeLockActive = false;
      }
    } catch(e) { /* silent */ }
  }

  // Foreground ফিরলে সাথে সাথে wake lock re-acquire
  document.addEventListener('visibilitychange', async function() {
    if (document.visibilityState === 'visible') {
      await _acquireWakeLock();
    }
  });

  // Transaction শুরু/শেষ — wake lock সবসময় থাকবেই, তবু explicit call support
  window._oneTxInProgress = false;
  const _origTxStart = window._oneTxStart;
  window._oneTxStart = function() {
    window._oneTxInProgress = true;
    _acquireWakeLock();
    if (typeof _origTxStart === 'function') _origTxStart.apply(this, arguments);
  };
  const _origTxEnd = window._oneTxEnd;
  window._oneTxEnd = function() {
    window._oneTxInProgress = false;
    // Wake lock release করব না — app চালু থাকবে
    if (typeof _origTxEnd === 'function') _origTxEnd.apply(this, arguments);
  };

  // ══════════════════════════════════════════════
  // 2. SILENT AUDIO — browser throttling bypass
  //    Minimize হলেও setInterval full speed চলবে
  // ══════════════════════════════════════════════
  let _audioCtx = null;
  let _gainNode = null;
  let _audioStarted = false;

  function _startSilentAudio() {
    try {
      if (_audioCtx && _audioCtx.state !== 'closed') {
        // Already running — resume if suspended
        if (_audioCtx.state === 'suspended') _audioCtx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      _audioCtx = new AC();
      const osc = _audioCtx.createOscillator();
      _gainNode = _audioCtx.createGain();
      _gainNode.gain.value = 0.000001; // virtually inaudible
      osc.frequency.value = 1;         // 1Hz — below human hearing
      osc.connect(_gainNode);
      _gainNode.connect(_audioCtx.destination);
      osc.start();
      _audioStarted = true;
    } catch(e) { /* silent */ }
  }

  function _stopSilentAudio() {
    try {
      if (_audioCtx) { _audioCtx.close(); _audioCtx = null; _gainNode = null; }
    } catch(e) {}
  }

  function _ensureAudio() {
    _startSilentAudio();
    _audioStarted = true;
  }

  // First user touch/click এ audio শুরু (autoplay policy)
  document.addEventListener('touchstart', _ensureAudio, { once: true, passive: true });
  document.addEventListener('click',      _ensureAudio, { once: true, passive: true });

  // Foreground ফিরলে audio resume করো
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible' && _audioStarted) {
      _startSilentAudio();
    }
  });

  // ══════════════════════════════════════════════
  // 3. VISIBILITY-AWARE INTERVAL
  //    Background-এও interval চলবে (throttle bypass)
  //    _oneTxInProgress বা always-on mode তে সব tick fire
  // ══════════════════════════════════════════════
  const _managedIntervals = new Map();
  let _mivSeq = 0;

  window.oneSetInterval = function(fn, ms, alwaysRun) {
    // alwaysRun=true হলে background এও চলবে (price/balance refresh)
    const id = ++_mivSeq;
    let lastTick = Date.now();

    const nativeId = setInterval(function() {
      const now = Date.now();
      const elapsed = now - lastTick;
      const isHidden = document.hidden;

      // Background এ চলার শর্ত:
      // a) alwaysRun=true (price/balance section)
      // b) Transaction চলছে
      // c) Silent audio চালু আছে + elapsed >= ms (missed tick catch-up)
      const shouldRun = !isHidden
        || alwaysRun
        || window._oneTxInProgress
        || (_audioStarted && elapsed >= ms);

      if (!shouldRun) {
        // Reset baseline if hidden too long (avoid burst on return)
        if (elapsed >= ms * 5) lastTick = now;
        return;
      }

      lastTick = now;
      try { fn(); } catch(e) {}
    }, Math.min(ms, 1000));

    _managedIntervals.set(id, { nativeId, fn, ms, alwaysRun: !!alwaysRun });
    return id;
  };

  window.oneClearInterval = function(id) {
    const entry = _managedIntervals.get(id);
    if (entry) { clearInterval(entry.nativeId); _managedIntervals.delete(id); }
  };

  // ══════════════════════════════════════════════
  // 4. ON-RETURN SYNC — foreground ফিরলে সব refresh
  // ══════════════════════════════════════════════
  let _lastHiddenAt = 0;

  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      _lastHiddenAt = Date.now();
      return;
    }

    const hiddenMs = Date.now() - _lastHiddenAt;
    if (_lastHiddenAt <= 0) return;

    // যেকোনো সময় background এ গেলেও ফিরলে সব section refresh
    const delay = hiddenMs > 30000 ? 800 : 400; // লম্বা সময় গেলে একটু wait

    setTimeout(function() {
      // Price refresh
      try {
        if (typeof silentPriceRefresh === 'function') silentPriceRefresh().catch(function(){});
      } catch(e) {}

      // Balance cache clear + reload
      try {
        if (typeof _balanceCache !== 'undefined') {
          const chain = (typeof hwChainId !== 'undefined') ? String(hwChainId) : null;
          if (chain && _balanceCache[chain]) delete _balanceCache[chain];
        }
      } catch(e) {}
      try {
        if (typeof loadTokens === 'function' && typeof homeActiveKey !== 'undefined' && homeActiveKey) {
          loadTokens();
        }
      } catch(e) {}

      // Swap DEX scan resume
      try {
        if (typeof SW !== 'undefined' && SW.scanDexInterval === null &&
            typeof SW._swapActive !== 'undefined' && SW._swapActive) {
          if (typeof swStartDexScan === 'function') swStartDexScan();
        }
      } catch(e) {}

      // Chart poll resume
      try {
        if (typeof _lwChartVisible !== 'undefined' && _lwChartVisible) {
          if (typeof _lwStartPoll === 'function') _lwStartPoll();
          else if (typeof lwStartPoll === 'function') lwStartPoll();
        }
      } catch(e) {}

      // Activity feed refresh
      try {
        if (typeof loadActivity === 'function') loadActivity();
      } catch(e) {}

      // Portfolio stats refresh
      try {
        if (typeof refreshPortfolioStats === 'function') refreshPortfolioStats();
      } catch(e) {}

      // Gas price refresh
      try {
        if (typeof refreshGasPrice === 'function') refreshGasPrice();
      } catch(e) {}

    }, delay);
  });

  // ══════════════════════════════════════════════
  // 5. PAGE VISIBILITY API FALLBACK
  //    Safari/iOS এ visibilitychange মিস হলে
  //    pagehide/pageshow দিয়ে catch করো
  // ══════════════════════════════════════════════
  window.addEventListener('pagehide', function() {
    _lastHiddenAt = Date.now();
  });

  window.addEventListener('pageshow', function() {
    if (_lastHiddenAt > 0) {
      // Trigger same refresh logic
      document.dispatchEvent(new Event('visibilitychange'));
    }
  });

  // iOS Safari focus/blur fallback
  window.addEventListener('blur', function() {
    if (_lastHiddenAt <= 0) _lastHiddenAt = Date.now();
  });

  window.addEventListener('focus', function() {
    if (_lastHiddenAt > 0) {
      setTimeout(function() {
        try { if (typeof silentPriceRefresh === 'function') silentPriceRefresh().catch(function(){}); } catch(e) {}
        try { if (typeof loadTokens === 'function' && typeof homeActiveKey !== 'undefined' && homeActiveKey) loadTokens(); } catch(e) {}
      }, 500);
    }
  });

  // ══════════════════════════════════════════════
  // 6. EXPOSE CONTROL API
  // ══════════════════════════════════════════════
  window.OneBGGuard = {
    acquireWakeLock:  _acquireWakeLock,
    releaseWakeLock:  _releaseWakeLock,
    startAudio:       _startSilentAudio,
    stopAudio:        _stopSilentAudio,
    isWakeLocked:     function() { return _wakeLockActive; },
    isAudioRunning:   function() { return _audioStarted && !!_audioCtx; },
    txStart: function() {
      window._oneTxInProgress = true;
      _ensureAudio();
      _acquireWakeLock();
    },
    txEnd: function() {
      window._oneTxInProgress = false;
      // Wake lock রাখো — app সক্রিয় থাকবে
    }
  };

  // ══════════════════════════════════════════════
  // 7. AUTO-HOOK: swap/send functions wrap করো
  // ══════════════════════════════════════════════
  window.addEventListener('load', function() {
    setTimeout(function() {
      ['_swRunSwap', 'swExecute', '_execSwap', 'sendTransaction', '_sendTx'].forEach(function(fnName) {
        if (typeof window[fnName] === 'function') {
          const orig = window[fnName];
          window[fnName] = async function() {
            window.OneBGGuard.txStart();
            try {
              const result = await orig.apply(this, arguments);
              return result;
            } finally {
              setTimeout(function() { window.OneBGGuard.txEnd(); }, 8000);
            }
          };
        }
      });

      // Wake lock নেও — app চালু হয়েছে
      _acquireWakeLock();

    }, 2500);
  });

  // ══════════════════════════════════════════════
  // 8. HEARTBEAT — 30s এ একবার alive check
  //    Audio + wake lock জীবিত আছে কিনা নিশ্চিত করো
  // ══════════════════════════════════════════════
  setInterval(function() {
    if (_audioStarted && _audioCtx && _audioCtx.state === 'suspended') {
      _audioCtx.resume().catch(function(){});
    }
    if (!_wakeLockActive) {
      _acquireWakeLock();
    }
  }, 30000);

})();
