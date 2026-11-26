// ══════════════════════════════════════════════
// SEND — TOKEN SHEET + FORM STATE UI
//   • "Select token" bottom sheet: All networks + one tab per network,
//     tokens sorted by USD value (highest first)
//   • token pill, state-aware SEND button label, tap-to-cycle gas mode
// Loaded after the send-* scripts; reads their globals (sendSelectedChainId,
// sendSelectedToken, sendBalances, sendWallet, sendPrices …).
// ══════════════════════════════════════════════

let _sendSheetView = 'all';    // 'all' or a chainId (number)
let _sendSheetSession = 0;     // bumped on open / tab change / close so stale RPC results are dropped
const _sendSheetMemBal = {};   // 'tokenId:chainId' -> balance fetched on demand while the sheet is open
let _sendPillKey = '';         // 'chainId:tokenId' the pill is currently drawn for

const _SEND_STABLES = ['USDC', 'USDT', 'DAI', 'USDBC', 'USDE', 'FDUSD'];
const _SEND_GAS_LABEL = { auto: 'Auto', eip1559: 'EIP-1559', legacy: 'Legacy' };

// ── wallet helpers ──
function _sendSheetPk() {
  const raw = (typeof _sendFromSelectedPk !== 'undefined' && _sendFromSelectedPk) ||
    (document.getElementById('send-pk')?.value || '').trim();
  if (!raw) return '';
  return raw.startsWith('0x') ? raw : '0x' + raw;
}

function _sendSheetAddr() {
  const pk = _sendSheetPk();
  if (pk.length !== 66) return '';
  try { return new ethers.Wallet(pk).address; } catch (e) { return ''; }
}

// Balances the home screen already cached for the selected wallet: 'tokenId:chainId' -> number
function _sendSheetBalMap() {
  const map = {};
  const pk = _sendSheetPk();
  if (pk.length !== 66) return map;
  const suffix = ':' + pk.slice(-8).toLowerCase();
  const cache = window._balanceCache || {};
  Object.keys(cache).forEach(k => {
    if (!k.toLowerCase().endsWith(suffix)) return;
    const parts = k.split(':');
    if (parts.length < 3) return;
    const v = parseFloat(cache[k]);
    if (!isNaN(v)) map[parts.slice(0, -2).join(':') + ':' + parts[parts.length - 2]] = v;
  });
  return map;
}

function _sendTokBal(t, balMap) {
  const cid = t.chainId || 8453;
  if (cid === sendSelectedChainId && sendBalances[t.id] !== undefined) {
    const v = parseFloat(sendBalances[t.id]);
    if (!isNaN(v)) return v;
  }
  const k = t.id + ':' + cid;
  if (_sendSheetMemBal[k] !== undefined) return _sendSheetMemBal[k];
  if (balMap[k] !== undefined) return balMap[k];
  return null; // unknown yet
}

function _sendTokPrice(t) {
  try {
    if (typeof _globalPriceCache !== 'undefined' && _globalPriceCache && t.cgId) {
      const pd = _globalPriceCache[t.cgId];
      if (pd && pd.usd) return pd.usd;
    }
  } catch (e) {}
  const sym = String(t.sub || '').toUpperCase();
  if (_SEND_STABLES.indexOf(sym) !== -1) return 1;
  if (sym === 'ETH' || sym === 'WETH') return sendPrices.ETH || 0;
  return sendPrices[sym] || 0;
}

function _sendFmtBal(v) {
  if (v === null) return '—';
  return (v < 0.0001 && v > 0) ? v.toExponential(2) : v.toFixed(4);
}

// ── rows: every token the wallet knows about, filtered by tab, sorted by value ──
function _sendSheetRows() {
  const chainName = {};
  getAllChains().forEach(c => { if (c.chainId !== null) chainName[c.chainId] = c.name; });
  const balMap = _sendSheetBalMap();
  const rows = [];
  loadSavedTokens().forEach(t => {
    const cid = t.chainId || 8453;
    if (!chainName[cid]) return;
    if (_sendSheetView !== 'all' && cid !== _sendSheetView) return;
    if (!t.isNative && !(t.contract && /^0x[0-9a-fA-F]{40}$/.test(t.contract))) return;
    const bal = _sendTokBal(t, balMap);
    rows.push({ t: t, cid: cid, chain: chainName[cid], bal: bal, usd: bal ? bal * _sendTokPrice(t) : 0 });
  });
  rows.sort((a, b) => (b.usd - a.usd) || ((b.bal || 0) - (a.bal || 0)));
  return rows;
}

function _renderSendSheet() {
  const chipsEl = document.getElementById('send-sheet-chains');
  const listEl = document.getElementById('send-sheet-list');
  if (!chipsEl || !listEl) return;

  // tabs
  chipsEl.innerHTML = '';
  const tabs = [{ id: 'all', label: 'All networks' }];
  getAllChains().forEach(c => { if (c.chainId !== null) tabs.push({ id: c.chainId, label: c.name }); });
  tabs.forEach(tab => {
    const chip = document.createElement('div');
    chip.className = 'send-sheet-chip' + (tab.id === _sendSheetView ? ' on' : '');
    chip.textContent = tab.label;
    chip.onclick = () => {
      _sendSheetView = tab.id;
      _renderSendSheet();
      _fetchSendSheetMissing();
      haptic();
    };
    chipsEl.appendChild(chip);
  });

  // list (keep scroll position when we re-render after balances arrive)
  const prevTop = listEl.scrollTop;
  listEl.innerHTML = '';
  const rows = _sendSheetRows();
  if (!rows.length) {
    const empty = document.createElement('div');
    empty.className = 'send-sheet-empty';
    empty.textContent = 'No tokens on this network yet.';
    listEl.appendChild(empty);
    return;
  }
  rows.forEach(r => {
    const t = r.t;
    const isSel = r.cid === sendSelectedChainId &&
      (t.id === sendSelectedToken || (t.isNative && sendSelectedToken === 'eth'));
    const row = document.createElement('div');
    row.className = 'send-sheet-row' + (isSel ? ' sel' : '');

    const icon = document.createElement('div');
    icon.className = 'send-sheet-icon';
    icon.style.background = (t.color || '#6366f1') + '22';
    icon.appendChild(getTokenLogoEl(t));

    const info = document.createElement('div');
    info.className = 'send-sheet-info';
    const sym = document.createElement('div');
    sym.className = 'send-sheet-sym';
    sym.textContent = t.sub;
    const sub = document.createElement('div');
    sub.className = 'send-sheet-sub';
    sub.textContent = (t.name || t.sub) + (_sendSheetView === 'all' ? ' · ' + r.chain : '');
    info.appendChild(sym);
    info.appendChild(sub);

    const val = document.createElement('div');
    val.className = 'send-sheet-val';
    const bal = document.createElement('div');
    bal.className = 'send-sheet-bal';
    bal.textContent = _sendFmtBal(r.bal);
    const usd = document.createElement('div');
    usd.className = 'send-sheet-usd';
    usd.textContent = r.bal === null ? '' : _formatCurrencyDisplay(r.usd);
    val.appendChild(bal);
    val.appendChild(usd);

    row.appendChild(icon);
    row.appendChild(info);
    row.appendChild(val);
    row.onclick = () => _sendPickToken(t, r.cid);
    listEl.appendChild(row);
  });
  listEl.scrollTop = prevTop;
}

// Balances that are not in the home cache are read from RPC (max 30 tokens, 3 at a time)
async function _fetchSendSheetMissing() {
  const addr = _sendSheetAddr();
  if (!addr) return;
  const session = ++_sendSheetSession;
  const missing = _sendSheetRows().filter(r => r.bal === null).slice(0, 30);
  if (!missing.length) return;
  let idx = 0, changed = false;
  async function worker() {
    while (idx < missing.length) {
      const r = missing[idx++];
      const t = r.t;
      try {
        let v;
        if (t.isNative) {
          v = parseFloat(ethers.formatEther(await _withRpcFallback(r.cid, p => p.getBalance(addr), 5000)));
        } else {
          const raw = await _withRpcFallback(r.cid, p => new ethers.Contract(t.contract, ERC20_SEND_ABI, p).balanceOf(addr), 5000);
          v = parseFloat(ethers.formatUnits(raw, t.decimals || 18));
        }
        if (session !== _sendSheetSession) return;
        if (!isNaN(v)) { _sendSheetMemBal[t.id + ':' + r.cid] = v; changed = true; }
      } catch (e) {}
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  const sheet = document.getElementById('send-token-sheet');
  if (session === _sendSheetSession && changed && sheet && sheet.classList.contains('open')) _renderSendSheet();
}

// Swipe down on the sheet (handle, header, or the list while it is scrolled to the top) closes it
function _attachSendSheetSwipe(sheet) {
  if (!sheet || sheet._swipeAttached) return;
  sheet._swipeAttached = true;
  const THRESHOLD = 80;
  let sy = 0, sx = 0, dragging = false, locked = false;
  const list = document.getElementById('send-sheet-list');
  const chains = document.getElementById('send-sheet-chains');
  const reset = () => { sheet.style.transition = ''; sheet.style.transform = ''; };

  sheet.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return;
    sy = e.touches[0].clientY; sx = e.touches[0].clientX;
    dragging = true;
    locked = !!(list && list.contains(e.target) && list.scrollTop > 2) || !!(chains && chains.contains(e.target));
  }, { passive: true });

  sheet.addEventListener('touchmove', function (e) {
    if (!dragging || locked || e.touches.length !== 1) return;
    const dx = Math.abs(e.touches[0].clientX - sx);
    const dy = e.touches[0].clientY - sy;
    if (dx > Math.abs(dy) + 6) { locked = true; reset(); return; }
    if (list && list.contains(e.target) && list.scrollTop > 2) { locked = true; reset(); return; }
    if (dy > 0) {
      sheet.style.transition = 'none';
      sheet.style.transform = 'translateY(' + dy + 'px)';
    }
  }, { passive: true });

  sheet.addEventListener('touchend', function (e) {
    if (!dragging) return;
    dragging = false;
    if (locked) { locked = false; reset(); return; }
    const dy = (e.changedTouches[0] ? e.changedTouches[0].clientY : sy) - sy;
    sheet.style.transition = '';
    if (dy >= THRESHOLD) {
      closeSendTokenSheet();
      setTimeout(reset, 320);
    } else {
      sheet.style.transform = '';
    }
  }, { passive: true });

  sheet.addEventListener('touchcancel', function () { dragging = false; locked = false; reset(); }, { passive: true });
}

function openSendTokenSheet() {
  _sendSheetView = 'all';
  const sheet = document.getElementById('send-token-sheet');
  const back = document.getElementById('send-sheet-backdrop');
  if (!sheet) return;
  _attachSendSheetSwipe(sheet);
  sheet.style.transform = '';
  sheet.classList.add('open');
  if (back) back.classList.add('open');
  _renderSendSheet();
  _fetchSendSheetMissing();
  haptic();
}

function closeSendTokenSheet() {
  _sendSheetSession++;
  const sheet = document.getElementById('send-token-sheet');
  const back = document.getElementById('send-sheet-backdrop');
  if (sheet) sheet.classList.remove('open');
  if (back) back.classList.remove('open');
}

function _sendPickToken(t, cid) {
  closeSendTokenSheet();
  const sameChain = cid === sendSelectedChainId;
  if (sameChain && (sendSelectedToken === t.id || (t.isNative && sendSelectedToken === 'eth'))) return;
  if (sameChain) {
    const chip = document.getElementById(t.isNative ? 'send-chip-native' : 'send-chip-' + t.id);
    if (!chip) return;
    selectSendTokenDynamic(t.id, chip);
    if (t.isNative && t.id !== 'eth') sendBalances['eth'] = sendBalances[t.id];
    return;
  }
  // Other network: pre-select the token, then switch network (rebuilds the lists and reloads the wallet)
  const amt = document.getElementById('send-amount');
  if (amt) { amt.value = ''; amt.dataset.fullVal = ''; }
  sendSelectedToken = t.id;
  selectSendChain(cid);
  onSendAmountInput();
}

// ── gas mode: tap to cycle Auto → EIP-1559 → Legacy ──
function sendCycleGasMode() {
  const order = ['auto', 'eip1559', 'legacy'];
  const cur = window.OneGasMode || 'auto';
  const next = order[(order.indexOf(cur) + 1) % order.length];
  if (typeof window._ngSet === 'function') window._ngSet(next); else window.OneGasMode = next;
  _sendUiRefresh();
  haptic();
}

// ── pill, amount size, gas label and SEND button label ──
function _sendCurTokenObj() {
  const toks = loadSavedTokens().filter(t => (t.chainId || 8453) === sendSelectedChainId);
  const native = toks.find(t => t.isNative);
  if (sendSelectedToken === 'eth' || (native && sendSelectedToken === native.id)) return native || null;
  return toks.find(t => t.id === sendSelectedToken) || null;
}

function _sendUiRefresh() {
  // token pill (only redrawn when the token changes)
  const key = sendSelectedChainId + ':' + sendSelectedToken;
  if (key !== _sendPillKey) {
    _sendPillKey = key;
    const tok = _sendCurTokenObj();
    const info = (typeof getSendTokenInfo === 'function') ? getSendTokenInfo(sendSelectedToken) : null;
    const symEl = document.getElementById('send-pill-sym');
    if (symEl) symEl.textContent = tok ? tok.sub : (info && info.symbol) || 'ETH';
    const iconEl = document.getElementById('send-pill-icon');
    if (iconEl && tok) {
      iconEl.innerHTML = '';
      iconEl.style.background = (tok.color || '#6366f1') + '22';
      iconEl.appendChild(getTokenLogoEl(tok));
    }
  }

  // shrink long amounts so they stay inside the card
  const amtEl = document.getElementById('send-amount');
  if (amtEl) {
    const n = (amtEl.value || '').length;
    amtEl.style.fontSize = n > 14 ? '24px' : n > 10 ? '30px' : '';
  }

  // gas pill
  const gasEl = document.getElementById('send-gas-mode');
  if (gasEl) gasEl.textContent = _SEND_GAS_LABEL[window.OneGasMode || 'auto'] || 'Auto';

  // SEND button label follows the form
  const btn = document.getElementById('send-btn');
  if (!btn) return;
  if (btn.classList.contains('sending') || btn.classList.contains('confirming') || btn.style.background) return; // busy / error state owns the button
  const to = (document.getElementById('send-to')?.value || '').trim();
  const fullVal = amtEl?.dataset?.fullVal;
  const rawVal = (amtEl?.value || '').replace(/[₀₁₂₃₄₅₆₇₈₉]/g, '').replace(/[^\d.eE\-+]/g, '');
  const amt = parseFloat(fullVal || rawVal || '0');
  let text;
  if (!(amt > 0)) text = 'Enter an amount';
  else if (!/^0x[0-9a-fA-F]{40}$/.test(to)) text = 'Enter recipient address';
  else if (!sendWallet) text = 'Preparing wallet…';
  else {
    const info = (typeof getSendTokenInfo === 'function') ? getSendTokenInfo(sendSelectedToken) : null;
    text = 'Send ' + ((info && info.symbol) || 'ETH');
    if (btn.disabled) text = 'Select a wallet';
  }
  let lab = document.getElementById('send-btn-label');
  if (!lab) {
    btn.innerHTML = '<span class="material-icons-round">send</span><span id="send-btn-label"></span>';
    lab = document.getElementById('send-btn-label');
  }
  if (lab && lab.textContent !== text) lab.textContent = text;
}

// Sponsored-gas note next to "Network fee" (the review-gas ghost element carries the status text)
(function () {
  const g = document.getElementById('review-gas');
  if (!g || !window.MutationObserver) return;
  new MutationObserver(function () {
    const note = document.getElementById('send-fee-note');
    if (note) note.textContent = /FREE/i.test(g.textContent || '') ? 'Sponsored · free' : '';
  }).observe(g, { childList: true, characterData: true, subtree: true });
})();
