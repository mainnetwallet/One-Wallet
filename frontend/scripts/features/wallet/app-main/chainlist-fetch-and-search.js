
// ══════════════════════════════════════════════
// ── CHAINLIST SEARCH (chainid.network) ──
// ══════════════════════════════════════════════
let _clAllChains = null;
let _clFetchPromise = null;
let _clSearchTimer = null;
let _hcpActiveTab = 'my';

function hcpSwitchTab(tab) {
  // Chainlist tab requires a selected wallet
  if (tab === 'chainlist') {
    const _stGroups = (typeof loadWalletGroups === 'function') ? loadWalletGroups() : [];
    const _stHwKey  = (typeof hwSelectedKey !== 'undefined' && hwSelectedKey);
    const _stHasSel = _stHwKey
      || (typeof selectedGroupIds !== 'undefined' && selectedGroupIds.length > 0)
      || (typeof activeGroupId !== 'undefined' && activeGroupId);
    if (!_stGroups.length) {
      showToast('Please add a wallet first!', 'account_balance_wallet'); haptic(); return;
    }
    if (!_stHasSel) {
      showToast('Please select a wallet first!', 'account_balance_wallet'); haptic(); return;
    }
  }

  _hcpActiveTab = tab;
  const tabMy = document.getElementById('hcp-tab-my');
  const tabCl = document.getElementById('hcp-tab-cl');
  const panelMy = document.getElementById('hcp-panel-my');
  const panelCl = document.getElementById('hcp-panel-cl');
  const addFooter = document.getElementById('hcp-add-footer');

  if (tab === 'my') {
    tabMy.style.cssText = 'flex:1;padding:8px 0;border-radius:10px;border:1px solid rgba(99,102,241,0.5);background:rgba(99,102,241,0.18);color:var(--neon-purple);font-family:var(--font-mono);font-size:10px;font-weight:700;letter-spacing:1px;cursor:pointer;transition:all 0.2s;';
    tabCl.style.cssText = 'flex:1;padding:8px 0;border-radius:10px;border:1px solid var(--border-subtle);background:var(--bg-glass);color:var(--text-muted);font-family:var(--font-mono);font-size:10px;font-weight:700;letter-spacing:1px;cursor:pointer;transition:all 0.2s;';
    panelMy.style.display = 'flex';
    panelMy.style.flexDirection = 'column';
    panelCl.style.display = 'none';
    if (addFooter) addFooter.style.display = '';
    renderHcpList();
  } else {
    tabCl.style.cssText = 'flex:1;padding:8px 0;border-radius:10px;border:1px solid rgba(99,102,241,0.5);background:rgba(99,102,241,0.18);color:var(--neon-purple);font-family:var(--font-mono);font-size:10px;font-weight:700;letter-spacing:1px;cursor:pointer;transition:all 0.2s;';
    tabMy.style.cssText = 'flex:1;padding:8px 0;border-radius:10px;border:1px solid var(--border-subtle);background:var(--bg-glass);color:var(--text-muted);font-family:var(--font-mono);font-size:10px;font-weight:700;letter-spacing:1px;cursor:pointer;transition:all 0.2s;';
    panelMy.style.display = 'none';
    panelCl.style.display = 'flex';
    if (addFooter) addFooter.style.display = 'none';
    // Sync testnet toggle button visual state
    const tnBtn = document.getElementById('hcp-cl-testnet-btn');
    if (tnBtn) {
      tnBtn.style.background   = _clShowTestnets ? 'rgba(245,158,11,0.2)' : 'var(--bg-glass)';
      tnBtn.style.color        = _clShowTestnets ? 'var(--accent-amber)'  : 'var(--text-muted)';
      tnBtn.style.borderColor  = _clShowTestnets ? 'rgba(245,158,11,0.6)' : 'var(--border-subtle)';
    }
    // Pre-load chain data
    _clFetchChains().then(() => {
      const input = document.getElementById('hcp-cl-search');
      if (input) {
        if (input.value.trim()) hcpClSearch();
        else hcpClRenderResults([]);
        setTimeout(() => input.focus(), 200);
      }
    });
  }
  haptic();
}

// ══════════════════════════════════════════════════════════════
// ── EXTRA RPC FETCHER (DefiLlama/chainlist supplemental data) ──
// ══════════════════════════════════════════════════════════════
let _clExtraRpcs = null;
let _clShowTestnets = false;
// _clRawData holds ALL chains (mainnet + testnet) fetched once
let _clRawData = null;

function _clGetTestnetKeywords() {
  return ['testnet','test','devnet','sepolia','goerli','mumbai','fuji','holesky','amoy','chapel','baobab','alfajores','benchmark','stagenet','devnet'];
}

function _clIsTestnet(name) {
  const n = name.toLowerCase();
  return _clGetTestnetKeywords().some(w => n.includes(w));
}

function _clApplyFilter() {
  if (!_clRawData) return;
  if (_clShowTestnets) {
    // Only testnet chains
    _clAllChains = _clRawData.filter(c => _clIsTestnet(c.name));
  } else {
    // Only mainnet chains
    _clAllChains = _clRawData.filter(c => !_clIsTestnet(c.name));
  }
}

function hcpToggleKoreTestnet(btn) {
  _clShowTestnets = !_clShowTestnets;
  if (btn) {
    btn.style.background = _clShowTestnets ? 'rgba(245,158,11,0.2)' : 'var(--bg-glass)';
    btn.style.color      = _clShowTestnets ? 'var(--accent-amber)' : 'var(--text-muted)';
    btn.style.borderColor= _clShowTestnets ? 'rgba(245,158,11,0.6)' : 'var(--border-subtle)';
  }
  // Clear search input
  const inp = document.getElementById('hcp-cl-search');
  if (inp) inp.value = '';
  const clr = document.getElementById('hcp-cl-clear');
  if (clr) clr.style.display = 'none';
  const st = document.getElementById('hcp-cl-status-text');

  const doRender = () => {
    _clApplyFilter();
    const stEl = document.getElementById('hcp-cl-status-text');
    if (stEl) {
      const cnt = (_clAllChains || []).length;
      stEl.textContent = _clShowTestnets
        ? cnt + ' testnet chain' + (cnt !== 1 ? 's' : '') + ' available'
        : cnt + ' mainnet chain' + (cnt !== 1 ? 's' : '') + ' available';
      stEl.style.color = _clShowTestnets ? 'var(--accent-amber)' : 'var(--text-muted)';
    }
    hcpClRenderResults([]);
  };

  if (_clRawData) {
    // Already loaded — just refilter instantly
    doRender();
  } else {
    if (st) { st.textContent = '⏳ Loading chains…'; st.style.color = 'var(--text-muted)'; }
    _clFetchRaw().then(doRender);
  }
}


async function _clFetchExtraRpcs() {
  if (_clExtraRpcs) return _clExtraRpcs;
  _clExtraRpcs = {};
  try {
    // DefiLlama chainlist extraRpcs — supplemental RPCs beyond ethereum-lists
    const res = await fetch(
      'https://raw.githubusercontent.com/DefiLlama/chainlist/main/constants/extraRpcs.js',
      { cache: 'default' }
    );
    if (!res.ok) return _clExtraRpcs;
    const text = await res.text();

    // Parse JS file: structure is  CHAINID: { rpcs: [ "url" | { url:"url" } ] }
    // Step 1: find each top-level chainId block
    // Pattern: one line like "  12345: {" marks start; ends before next such line or closing brace
    const lines = text.split('\n');
    let curId = null;
    let collecting = false;
    let buf = '';
    let depth = 0;

    const flush = (id, block) => {
      const urls = [];
      // Plain string URLs: "https://..."
      for (const m of block.matchAll(/"(https?:\/\/[^"\s]+)"/g)) {
        const u = m[1];
        if (!u.includes('${') && !u.includes('API_KEY') && !u.includes('api-key') && !u.includes('YOUR_KEY'))
          urls.push(u);
      }
      if (urls.length > 0) {
        _clExtraRpcs[id] = (_clExtraRpcs[id] || []).concat(urls);
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Detect "  12345: {" — new chain block starts
      const startMatch = line.match(/^  (\d+):\s*\{/);
      if (startMatch) {
        if (collecting && curId !== null) flush(curId, buf);
        curId = parseInt(startMatch[1]);
        collecting = true;
        buf = '';
        depth = 1;
        continue;
      }
      if (!collecting) continue;

      // Track bracket depth to know when the block ends
      for (const ch of line) {
        if (ch === '{' || ch === '[') depth++;
        else if (ch === '}' || ch === ']') depth--;
      }
      buf += line + '\n';
      if (depth <= 0) {
        flush(curId, buf);
        collecting = false;
        buf = '';
        curId = null;
      }
    }
    if (collecting && curId !== null) flush(curId, buf);

  } catch(e) {
    // Extra RPCs are supplemental — silently fail, base RPCs still work
    console.warn('[ONE] extraRpcs fetch failed:', e.message);
  }
  return _clExtraRpcs;
}

// ════════════════════════════════════════════════════════
// ── CHAIN FETCHER — merges chainid.network + DefiLlama ──
// ════════════════════════════════════════════════════════
function _mergeAndCleanRpcs(base, extra) {
  // Combine, deduplicate, clean
  const all = [...(base || []), ...(extra || [])];
  const seen = new Set();
  const result = [];
  for (const url of all) {
    if (typeof url !== 'string') continue;
    // Normalise: strip trailing slash for dedup check
    const key = url.replace(/\/$/, '').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    // Filter: must be https, no template vars or placeholder keys
    if (
      url.startsWith('https://') &&
      !url.includes('${') &&
      !url.includes('API_KEY') &&
      !url.includes('api-key') &&
      !url.includes('YOUR_KEY') &&
      !url.includes('<') &&
      url.length < 300
    ) {
      result.push(url);
    }
  }
  return result;
}

// _clFetchRaw: fetches ALL chains (mainnet+testnet) once, stores in _clRawData
let _clRawPromise = null;
async function _clFetchRaw() {
  if (_clRawData) return _clRawData;
  if (_clRawPromise) return _clRawPromise;
  _clRawPromise = Promise.allSettled([
    fetch('https://chainid.network/chains.json').then(r => r.json()),
    _clFetchExtraRpcs()
  ]).then(([baseResult, extraResult]) => {
    const baseData  = baseResult.status  === 'fulfilled' ? baseResult.value  : [];
    const extraData = extraResult.status === 'fulfilled' ? extraResult.value : {};
    if (!Array.isArray(baseData) || baseData.length === 0) {
      _clRawPromise = null;
      return [];
    }
    // Store ALL chains (no testnet filtering here)
    _clRawData = baseData
      .filter(c => c.chainId && c.name)
      .map(c => {
        const baseRpcs  = c.rpc || [];
        const extraRpcs = extraData[c.chainId] || [];
        const merged    = _mergeAndCleanRpcs(baseRpcs, extraRpcs);
        return { ...c, rpc: merged };
      });
    _clRawPromise = null;
    return _clRawData;
  }).catch(() => {
    _clRawPromise = null;
    return [];
  });
  return _clRawPromise;
}

async function _clFetchChains() {
  if (_clAllChains) return _clAllChains;
  if (_clFetchPromise) return _clFetchPromise;
  const status = document.getElementById('hcp-cl-status-text');
  if (status) { status.textContent = '⏳ Loading chains from ChainList…'; status.style.color = 'var(--text-muted)'; }

  _clFetchPromise = _clFetchRaw().then(() => {
    if (!_clRawData || _clRawData.length === 0) {
      if (status) { status.textContent = '❌ Could not load chains. Check connection.'; status.style.color = 'var(--accent-red)'; }
      _clFetchPromise = null;
      return [];
    }
    // Apply mainnet/testnet filter
    _clApplyFilter();

    const totalRpcs = _clAllChains.reduce((s, c) => s + (c.rpc || []).length, 0);
    if (status) {
      status.textContent = _clAllChains.length + ' chains · ' + totalRpcs.toLocaleString() + ' RPC endpoints loaded';
      status.style.color = 'var(--accent-green)';
      setTimeout(() => {
        if (status) {
          const cnt = _clAllChains.length;
          status.textContent = _clShowTestnets
            ? cnt + ' testnet chains available'
            : cnt + ' mainnet chains available';
          status.style.color = 'var(--text-muted)';
        }
      }, 3000);
    }
    _clFetchPromise = null;
    return _clAllChains;
  }).catch(() => {
    _clFetchPromise = null;
    if (status) { status.textContent = '❌ Could not load chains. Check connection.'; status.style.color = 'var(--accent-red)'; }
    return [];
  });
  return _clFetchPromise;
}

function hcpClSearch() {
  const input = document.getElementById('hcp-cl-search');
  const clearBtn = document.getElementById('hcp-cl-clear');
  const q = (input?.value || '').trim();
  if (clearBtn) clearBtn.style.display = q ? 'block' : 'none';
  clearTimeout(_clSearchTimer);
  if (!q) { hcpClRenderResults([]); return; }
  _clSearchTimer = setTimeout(async () => {
    const status = document.getElementById('hcp-cl-status-text');
    if (!_clAllChains) {
      if (status) { status.textContent = '⏳ Loading…'; status.style.color = 'var(--text-muted)'; }
      await _clFetchChains();
    }
    if (!_clAllChains) return;
    const lower = q.toLowerCase();
    const isNum = /^\d+$/.test(q);
    const results = _clAllChains.filter(c =>
      (isNum && String(c.chainId).startsWith(q)) ||
      (!isNum && (c.name.toLowerCase().includes(lower) ||
        (c.nativeCurrency?.symbol || '').toLowerCase().includes(lower) ||
        (c.shortName || '').toLowerCase().includes(lower)))
    ).slice(0, 30);
    if (status) {
      status.textContent = results.length
        ? results.length + ' chain' + (results.length !== 1 ? 's' : '') + ' found'
        : 'No chains found for "' + q + '"';
      status.style.color = results.length ? 'var(--text-muted)' : 'var(--accent-amber)';
    }
    hcpClRenderResults(results);
  }, 280);
}