
// ── Open / Close ──
function openRpcManager() {
  const overlay = document.getElementById('rpc-manager-overlay');
  var dr = document.getElementById('rpc-manager-drawer');
  if (!overlay) return;
  // Reset inline styles, force translateX(100%) so CSS transition fires on open
  if (dr) { dr.style.transition = 'none'; dr.style.transform = 'translateX(100%)'; }
  overlay.style.opacity = '0'; overlay.style.pointerEvents = 'none';
  overlay.classList.add('open');
  // Next frame: let CSS take over for the slide-in animation
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      if (dr) { dr.style.transition = ''; dr.style.transform = ''; }
      overlay.style.opacity = ''; overlay.style.pointerEvents = '';
    });
  });
  _rpcUpdateSettingsBadge();
  rpcDrawerShowChainList();
}
function closeRpcManager() {
  var ov = document.getElementById('rpc-manager-overlay');
  var dr = document.getElementById('rpc-manager-drawer');
  if (dr && dr._swipeClosing) {
    // Swipe already animated close — just cleanup state
    setTimeout(function() {
      if (ov) ov.classList.remove('open');
      _rpcDrawerChainId = null;
    }, 0);
    return;
  }
  if (ov) { ov.style.opacity = '0'; ov.style.pointerEvents = 'none'; }
  if (dr) { dr.style.transition = 'transform 0.28s cubic-bezier(0.4,0,0.6,1)'; dr.style.transform = 'translateX(100%)'; }
  setTimeout(function() {
    if (ov) ov.classList.remove('open');
    if (dr) { dr.style.transition = ''; }
    _rpcDrawerChainId = null;
  }, 300);
}
function rpcDrawerGoBack() {
  rpcDrawerShowChainList();
}

// ── View: Chain List ──
function rpcDrawerShowChainList() {
  _rpcDrawerChainId = null;
  document.getElementById('rpc-drawer-title').textContent = 'Custom RPC';
  document.getElementById('rpc-drawer-badge').textContent = 'SELECT CHAIN';
  document.getElementById('rpc-back-btn').style.display = 'none';
  document.getElementById('rpc-close-btn').style.display = '';
  document.getElementById('rpc-view-chains').style.display = 'flex';
  document.getElementById('rpc-view-detail').style.display = 'none';
  _rpcRenderChainList();
}

function _rpcRenderChainList() {
  const container = document.getElementById('rpc-view-chains');
  if (!container) return;
  container.innerHTML = '';

  const chains = (typeof getAllChains === 'function' ? getAllChains() : [])
    .filter(c => c.chainId !== null); // exclude "All Networks"

  if (chains.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:32px;font-family:var(--font-mono);font-size:11px;color:var(--text-muted);">No chains available</div>';
    return;
  }

  // Section label
  const lbl = document.createElement('div');
  lbl.style.cssText = 'font-size:10px;font-weight:700;letter-spacing:1.5px;color:var(--text-muted);font-family:var(--font-mono);margin-bottom:4px;';
  lbl.textContent = 'TAP A CHAIN TO MANAGE ITS RPC ENDPOINTS';
  container.appendChild(lbl);

  const store = _rpcLoad();

  chains.forEach(chain => {
    const hasCustom = store[chain.chainId] && (
      (store[chain.chainId].rpcs && store[chain.chainId].rpcs.length > 0) ||
      store[chain.chainId].defaultRpc
    );
    const customCount = (store[chain.chainId] && store[chain.chainId].rpcs) ? store[chain.chainId].rpcs.length : 0;
    const builtinCount = (chain.rpcs || []).length;
    const totalRpcs = builtinCount + customCount;
    const defRpc = getDefaultRpcForChain(chain.chainId);

    const isActive = chain.chainId === (typeof activeHomeChainId !== 'undefined' ? activeHomeChainId : null);

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:14px;border:1px solid ' +
      (isActive ? 'rgba(99,102,241,0.45)' : 'var(--border-subtle)') +
      ';background:' + (isActive ? 'rgba(99,102,241,0.07)' : 'var(--bg-glass)') +
      ';cursor:pointer;transition:all 0.18s ease;';
    row.onmousedown = function() { this.style.opacity = '0.7'; };
    row.onmouseup = function() { this.style.opacity = ''; };
    row.ontouchstart = function() { this.style.opacity = '0.7'; };
    row.ontouchend = function() { this.style.opacity = ''; };

    const logoHtml = chain.logoURI
      ? `<img src="${chain.logoURI}" style="width:26px;height:26px;border-radius:8px;object-fit:cover;" onerror="this.style.display='none';this.nextSibling.style.display='flex';" /><span style="display:none;font-size:18px;">${chain.emoji || '🔗'}</span>`
      : `<span style="font-size:20px;">${chain.emoji || '🔗'}</span>`;

    const shortRpc = defRpc ? defRpc.replace('https://','').replace('http://','').split('/')[0] : '—';

    row.innerHTML = `
      <div style="width:40px;height:40px;border-radius:11px;background:var(--bg-raised);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;">${logoHtml}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:700;color:var(--text-primary);display:flex;align-items:center;gap:6px;">
          ${chain.name}
          ${isActive ? '<span style="font-size:8px;font-family:var(--font-mono);background:rgba(99,102,241,0.2);color:var(--neon-purple);padding:1px 6px;border-radius:4px;letter-spacing:1px;">ACTIVE</span>' : ''}

        </div>
        <div style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${totalRpcs} endpoint${totalRpcs !== 1 ? 's' : ''} · Default: ${shortRpc}
        </div>
      </div>
      <span class="material-icons-round" style="color:var(--text-muted);font-size:18px;flex-shrink:0;">chevron_right</span>
    `;
    row.onclick = function() { rpcDrawerShowDetail(chain.chainId); };
    container.appendChild(row);
  });
}

// ── View: RPC Detail for a chain ──
function rpcDrawerShowDetail(chainId) {
  _rpcDrawerChainId = chainId;
  const chain = (typeof getAllChains === 'function' ? getAllChains() : []).find(c => c.chainId === chainId);
  if (!chain) return;

  document.getElementById('rpc-drawer-title').textContent = chain.name;
  document.getElementById('rpc-drawer-badge').textContent = 'CHAIN ID: ' + chainId;
  document.getElementById('rpc-back-btn').style.display = '';
  document.getElementById('rpc-close-btn').style.display = 'none';
  document.getElementById('rpc-view-chains').style.display = 'none';
  document.getElementById('rpc-view-detail').style.display = 'flex';

  // Banner
  const logoHtml = chain.logoURI
    ? `<img src="${chain.logoURI}" style="width:30px;height:30px;border-radius:9px;object-fit:cover;" onerror="this.outerHTML='<span style=\'font-size:24px;\'>${chain.emoji||'🔗'}</span>'" />`
    : `<span style="font-size:24px;">${chain.emoji || '🔗'}</span>`;
  document.getElementById('rpc-detail-emoji').innerHTML = logoHtml;
  document.getElementById('rpc-detail-name').textContent = chain.name;
  document.getElementById('rpc-detail-chainid').textContent = 'Chain ID: ' + chainId + ' · ' + chain.nativeSym;

  // Clear input
  const inp = document.getElementById('rpc-new-url-input');
  if (inp) inp.value = '';
  document.getElementById('rpc-add-err').textContent = '';

  _rpcRenderList(chainId);
}

function _rpcRenderList(chainId) {
  const container = document.getElementById('rpc-list-container');
  if (!container) return;
  container.innerHTML = '';

  const chain = (typeof getAllChains === 'function' ? getAllChains() : []).find(c => c.chainId === chainId);
  if (!chain) return;

  const store = _rpcGetCustom(chainId);
  const customRpcs = store.rpcs || [];
  const defaultRpc = store.defaultRpc || (customRpcs[0] || (chain.rpcs && chain.rpcs[0]) || null);
  const builtinRpcs = chain.rpcs || [];

  const _makeRpcRow = (rpc, isBuiltin, index) => {
    const isDefault = rpc === defaultRpc;
    const row = document.createElement('div');
    row.style.cssText = `
      display:flex;align-items:center;gap:10px;padding:10px 12px;
      border-radius:12px;
      border:1px solid ${isDefault ? 'rgba(16,185,129,0.45)' : 'var(--border-subtle)'};
      background:${isDefault ? 'rgba(16,185,129,0.07)' : 'var(--bg-raised)'};
      transition:all 0.18s ease;position:relative;
    `;

    const shortUrl = rpc.replace('https://','').replace('http://','');

    row.innerHTML = `
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          ${isDefault
            ? '<span class="material-icons-round" style="font-size:14px;color:var(--accent-green);">check_circle</span>'
            : '<span class="material-icons-round" style="font-size:14px;color:var(--text-muted);">radio_button_unchecked</span>'
          }
          <span style="font-size:11px;font-weight:700;font-family:var(--font-mono);color:${isDefault ? 'var(--accent-green)' : 'var(--text-primary)'};
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px;" title="${rpc}">${shortUrl}</span>
          ${isDefault ? '<span style="font-size:8px;font-family:var(--font-mono);background:rgba(16,185,129,0.18);color:var(--accent-green);padding:1px 6px;border-radius:4px;letter-spacing:1px;">DEFAULT</span>' : ''}
          ${isBuiltin ? '<span style="font-size:8px;font-family:var(--font-mono);background:var(--bg-glass);color:var(--text-muted);padding:1px 6px;border-radius:4px;letter-spacing:1px;">BUILT-IN</span>' : ''}
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;">
        ${!isDefault
          ? `<button onclick="rpcSetDefault(${chainId},'${rpc.replace(/'/g,"\'")}')"
              style="padding:5px 10px;border:1px solid rgba(16,185,129,0.35);border-radius:8px;background:rgba(16,185,129,0.08);color:var(--accent-green);font-family:var(--font-mono);font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap;">
              Set Default
            </button>`
          : ''
        }
        ${!isBuiltin
          ? `<button onclick="rpcRemoveCustom(${chainId},${index})"
              style="width:28px;height:28px;border:1px solid rgba(244,63,94,0.25);border-radius:8px;background:rgba(244,63,94,0.08);color:var(--accent-red);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;padding:0;">
              <span class="material-icons-round" style="font-size:14px;">delete</span>
            </button>`
          : ''
        }
      </div>
    `;
    return row;
  };

  // Section: Custom RPCs
  if (customRpcs.length > 0) {
    const sec = document.createElement('div');
    sec.style.cssText = 'font-size:10px;font-weight:700;letter-spacing:1.5px;color:var(--accent-tertiary);font-family:var(--font-mono);margin-bottom:4px;';
    sec.textContent = 'CUSTOM ENDPOINTS';
    container.appendChild(sec);
    customRpcs.forEach((rpc, i) => container.appendChild(_makeRpcRow(rpc, false, i)));
    const divider = document.createElement('div');
    divider.style.cssText = 'height:1px;background:var(--border-subtle);margin:10px 0;';
    container.appendChild(divider);
  }

  // Section: Built-in RPCs
  const sec2 = document.createElement('div');
  sec2.style.cssText = 'font-size:10px;font-weight:700;letter-spacing:1.5px;color:var(--text-muted);font-family:var(--font-mono);margin-bottom:4px;';
  sec2.textContent = 'BUILT-IN ENDPOINTS';
  container.appendChild(sec2);

  if (builtinRpcs.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'text-align:center;padding:16px;font-family:var(--font-mono);font-size:10px;color:var(--text-muted);';
    empty.textContent = 'No built-in RPCs for this chain';
    container.appendChild(empty);
  } else {
    builtinRpcs.forEach(rpc => container.appendChild(_makeRpcRow(rpc, true, -1)));
  }
}

// ── Add new custom RPC ──
function rpcAddNew() {
  const input = document.getElementById('rpc-new-url-input');
  const errEl = document.getElementById('rpc-add-err');
  const url = input ? input.value.trim() : '';
  if (!url) { errEl.textContent = '⚠️ Enter an RPC URL'; return; }
  if (!url.startsWith('http')) { errEl.textContent = '⚠️ URL must start with https://'; return; }

  const chainId = _rpcDrawerChainId;
  if (!chainId) return;

  const data = _rpcLoad();
  if (!data[chainId]) data[chainId] = { rpcs: [], defaultRpc: null };

  if (data[chainId].rpcs.includes(url)) {
    errEl.textContent = '⚠️ This RPC is already in the list';
    return;
  }

  data[chainId].rpcs.push(url);
  // If no default set yet, make this the default
  if (!data[chainId].defaultRpc) data[chainId].defaultRpc = url;
  _rpcSave(data);

  input.value = '';
  input.blur();
  errEl.textContent = '';
  _rpcRenderList(chainId);
  _rpcRenderChainList(); // refresh badge in chain list too
  if (typeof showToast === 'function') showToast('RPC added & set as default', 'dns');
}

// ── Set a RPC as default ──
function rpcSetDefault(chainId, rpc) {
  const data = _rpcLoad();
  if (!data[chainId]) data[chainId] = { rpcs: [], defaultRpc: null };
  data[chainId].defaultRpc = rpc;
  _rpcSave(data);
  _rpcRenderList(chainId);
  if (typeof showToast === 'function') showToast('Default RPC updated', 'check_circle');

  // ── Clear ALL provider/RPC caches so every section immediately uses the new default ──

  // 1. Global provider cache (legacy)
  if (typeof _globalProviderCache !== 'undefined') {
    try { delete _globalProviderCache[chainId]; } catch {}
  }

  // 2. Main _providerCache (used by _withRpcFallback + _swWithFallback + _makeProvider)
  if (typeof _providerCache !== 'undefined') {
    try {
      Object.keys(_providerCache).forEach(k => {
        if (k.endsWith(':' + chainId)) delete _providerCache[k];
      });
    } catch {}
  }

  // 3. Health index reset — next call starts fresh from new default
  if (typeof _rpcHealthIdx !== 'undefined') {
    try { delete _rpcHealthIdx[chainId]; } catch {}
  }
  if (typeof _swRpcHealthIdx !== 'undefined') {
    try { delete _swRpcHealthIdx[chainId]; } catch {}
  }

  // 4. 429 blacklist clear — new default gets a clean shot
  if (typeof _swRpc429Until !== 'undefined') {
    try {
      const rpcs = (typeof _getRpcListForChain === 'function') ? _getRpcListForChain(chainId) : [];
      rpcs.forEach(r => { delete _swRpc429Until[r]; });
    } catch {}
  }

  // 5. Any module-level provider ref used by swap/bridge/send
  try { if (typeof _currentProvider !== 'undefined') _currentProvider = null; } catch {}

  // 6. ── Sync ALL Transfer Hub section rpcUrl inputs that are currently set to this chain ──
  // Uses _thManualPin to distinguish "user manually chose an RPC" from "following default".
  // _thManualPin[id] is set by _thSelectRpcManually; cleared by thResetRpcIdx (chain change).
  //   • No pin (or stale pin)        → update data-rpcs + value + badge to new default.
  //   • Active pin exists in new list → update data-rpcs + idx only; leave value & badge alone.
  //   • Active pin gone from new list → clear pin, fall through to default.
  try {
    var _TH_RPC_INPUT_IDS = [
      'rpcUrl', 'rpcUrlToken',
      'rpcUrlMultiKeyNative', 'rpcUrlMultiKeyToken',
      'rpcUrlNft', 'rpcUrlNftCollect',
      'rpcUrlW2W', 'rpcUrlW2WToken',
      'rpcUrlSelfTransfer', 'rpcUrlBalanceCheck',
      'rpcUrlApproval', 'rpcUrlMultiApproval',
      'withdrawRpcUrl'
    ];
    var _newRpcList = (typeof _getRpcListForChain === 'function') ? _getRpcListForChain(chainId) : [];
    if (_newRpcList.length > 0) {
      var _newDefaultRpc = _newRpcList[0];
      var _newRpcJson    = JSON.stringify(_newRpcList);
      var _norm6 = (typeof window._thNormalizeRpc === 'function')
        ? window._thNormalizeRpc
        : function(r) { return (r || '').trim().replace(/\/+$/, ''); };
      var _normList = _newRpcList.map(_norm6);

      _TH_RPC_INPUT_IDS.forEach(function(id) {
        try {
          var el = document.getElementById(id);
          if (!el) return;
          var elChainId = parseInt(el.getAttribute('data-chainid') || '', 10) || null;
          if (elChainId !== parseInt(chainId, 10)) return;

          // Always refresh data-rpcs so thGetRpcList returns current ordered list
          el.setAttribute('data-rpcs', _newRpcJson);

          var pinnedRpc = _thManualPin[id] ? _norm6(_thManualPin[id]) : null;
          if (pinnedRpc) {
            var pinnedIdx = _normList.indexOf(pinnedRpc);
            if (pinnedIdx !== -1) {
              // Pin still valid — update index to new position, leave value & badge unchanged
              _thRpcIdx[id] = pinnedIdx;
              return;
            }
            // Pin gone from list (RPC removed) — fall through to default
            _thManualPin[id] = null;
          }

          // No active pin → follow new default
          el.value = _newDefaultRpc;
          _thRpcIdx[id] = 0;
          if (_thRpc429) delete _thRpc429[_norm6(_newDefaultRpc)];
          try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch(_) {}
          if (typeof window.thSetRpcStatus === 'function')
            window.thSetRpcStatus(id, 'connected', _newDefaultRpc);
        } catch(_) {}
      });
    }
  } catch(_) {}
}
// ── Remove a custom RPC ──
function rpcRemoveCustom(chainId, index) {
  const data = _rpcLoad();
  if (!data[chainId] || !data[chainId].rpcs) return;
  const removed = data[chainId].rpcs[index];
  data[chainId].rpcs.splice(index, 1);
  // If removed was default, reset to first remaining or first builtin
  if (data[chainId].defaultRpc === removed) {
    data[chainId].defaultRpc = data[chainId].rpcs[0] || null;
  }
  if (data[chainId].rpcs.length === 0 && !data[chainId].defaultRpc) {
    delete data[chainId];
  }
  _rpcSave(data);
  _rpcRenderList(chainId);
  _rpcRenderChainList();
  if (typeof showToast === 'function') showToast('RPC removed', 'delete');
}

// ── Quick access: long-press or hold on active chain pill → open RPC for that chain ──
(function _patchHomeChainBtn() {
  document.addEventListener('DOMContentLoaded', function() {
    const btn = document.getElementById('home-chain-btn');
    if (!btn) return;
    let _rpcTimer = null;
    let _rpcTriggered = false;

    btn.addEventListener('touchstart', function(e) {
      _rpcTriggered = false;
      _rpcTimer = setTimeout(function() {
        _rpcTriggered = true;
        const cid = typeof activeHomeChainId !== 'undefined' ? activeHomeChainId : null;
        if (cid !== null) {
          if (typeof showToast === 'function') showToast('RPC Manager', 'dns');
          openRpcManager();
          setTimeout(() => rpcDrawerShowDetail(cid), 120);
        } else {
          openRpcManager();
        }
      }, 700);
    }, { passive: true });

    btn.addEventListener('touchend', function() {
      clearTimeout(_rpcTimer);
    });

    btn.addEventListener('touchmove', function() {
      clearTimeout(_rpcTimer);
    });
  });
})();

// ── Update settings subtitle with custom RPC count ──
function _rpcUpdateSettingsBadge() {
  const data = _rpcLoad();
  const count = Object.values(data).reduce((s, v) => s + ((v.rpcs || []).length), 0);
  const sub = document.getElementById('rpc-manager-sub');
  if (sub) sub.textContent = count > 0
    ? count + ' custom endpoint' + (count !== 1 ? 's' : '') + ' configured'
    : 'Manage RPC endpoints per chain';
}
document.addEventListener('DOMContentLoaded', _rpcUpdateSettingsBadge);