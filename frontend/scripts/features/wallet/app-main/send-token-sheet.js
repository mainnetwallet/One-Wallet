// ══════════════════════════════════════════════
// SEND — TOKEN SHEET + FORM STATE UI
//   • "Select token" bottom sheet: All networks + one tab per network,
//     tokens sorted by USD value (highest first)
//   • token pill, state-aware SEND button label, tap-to-cycle gas mode
// Loaded after the send-* scripts; reads their globals (sendSelectedChainId,
// sendSelectedToken, sendBalances, sendWallet, sendPrices …).
// ══════════════════════════════════════════════

let _sendSheetView = 'all';    // 'all' or a chainId (number)
let _sendSheetQuery = '';      // lower-cased search text
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
  // Unverified contract token: no ticker-based price (stable => $1 / ETH price); only its contract-based price
  if (!oneSymbolPriceAllowed(t)) {
    const _tc = (typeof TOKEN_CONFIG !== 'undefined' ? TOKEN_CONFIG : []).find(x => x.id === t.id);
    const _p = (_tc && _tc.price) || t.price || 0;
    return _p > 0 ? _p : 0;
  }
  const sym = String(t.sub || '').toUpperCase();
  if (_SEND_STABLES.indexOf(sym) !== -1) return 1;
  if (sym === 'ETH' || sym === 'WETH') return sendPrices.ETH || 0;
  return sendPrices[sym] || 0;
}

function _sendFmtBal(v) {
  if (v === null) return '—';
  if (v === 0) return '0';
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
    if (_sendSheetQuery) {
      const hay = ((t.sub || '') + ' ' + (t.name || '') + ' ' + (t.contract || '') + ' ' + chainName[cid]).toLowerCase();
      if (hay.indexOf(_sendSheetQuery) === -1) return;
    }
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
    empty.className = 'sw-tp-empty';
    empty.textContent = _sendSheetQuery ? 'No tokens found' : 'No tokens on this network yet.';
    listEl.appendChild(empty);
    return;
  }
  rows.forEach(r => {
    const t = r.t;
    const isSel = r.cid === sendSelectedChainId &&
      (t.id === sendSelectedToken || (t.isNative && sendSelectedToken === 'eth'));
    const row = document.createElement('div');
    row.className = 'sw-tp-row' + (isSel ? ' sel' : '');

    const icon = document.createElement('div');
    icon.className = 'sw-tp-ico';
    icon.style.background = (t.color || '#6366f1') + '22';
    icon.appendChild(getTokenLogoEl(t));

    const info = document.createElement('div');
    info.className = 'sw-tp-row-main';
    const sym = document.createElement('div');
    sym.className = 'sw-tp-sym';
    sym.textContent = t.sub;
    const sub = document.createElement('div');
    sub.className = 'sw-tp-name';
    sub.textContent = (t.name || t.sub) + (_sendSheetView === 'all' ? ' · ' + r.chain : '');
    info.appendChild(sym);
    info.appendChild(sub);

    const hasBal = r.bal !== null && r.bal > 0;
    const val = document.createElement('div');
    val.className = 'sw-tp-right';
    const bal = document.createElement('div');
    bal.className = 'sw-tp-bal' + (hasBal ? ' has' : '');
    bal.textContent = _sendFmtBal(r.bal);
    const usd = document.createElement('div');
    usd.className = 'sw-tp-usd' + (hasBal ? ' has' : '');
    usd.textContent = r.bal === null ? '' : _formatCurrencyDisplay(r.usd);
    val.appendChild(bal);
    val.appendChild(usd);

    row.appendChild(icon);
    row.appendChild(info);
    row.appendChild(val);
    if (isSel) {
      const chk = document.createElement('span');
      chk.className = 'material-icons-round sw-tp-check';
      chk.textContent = 'check';
      row.appendChild(chk);
    }
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

// Swipe down on the sheet (handle, header, tabs, or the list while it is at its top) or on the dim area closes it.
// Gesture logic is shared: scripts/shared/ui/sheet-swipe-close.js
function _attachSendSheetSwipe(sheet) {
  if (!sheet || sheet._swipeAttached) return;
  sheet._swipeAttached = true;
  attachSheetSwipeClose(sheet, { closeFn: closeSendTokenSheet, scroller: 'send-sheet-list' });
  attachBackdropSwipeClose(document.getElementById('send-sheet-backdrop'), closeSendTokenSheet);
}

function sendSheetFilter(v) {
  _sendSheetQuery = String(v || '').trim().toLowerCase();
  _renderSendSheet();
  _fetchSendSheetMissing();
}

async function sendSheetPaste() {
  const inp = document.getElementById('send-sheet-search');
  if (!inp) return;
  try {
    const txt = await navigator.clipboard.readText();
    if (txt) { inp.value = txt.trim(); sendSheetFilter(inp.value); return; }
  } catch (_e) {}
  inp.focus();
}

function openSendTokenSheet() {
  _sendSheetView = 'all';
  _sendSheetQuery = '';
  const _inp = document.getElementById('send-sheet-search');
  if (_inp) _inp.value = '';
  const sheet = document.getElementById('send-token-sheet');
  const back = document.getElementById('send-sheet-backdrop');
  if (!sheet) return;
  _attachSendSheetSwipe(sheet);
  if (sheet._sheetSwipe) sheet._sheetSwipe.reset(); else { sheet.style.transform = ''; sheet.style.transition = ''; }
  sheet.classList.add('open');
  if (back) back.classList.add('open');
  _renderSendSheet();
  _fetchSendSheetMissing();
  haptic();
}

function closeSendTokenSheet() {
  _sendSheetSession++;
  try { const ae = document.activeElement; if (ae && ae.id === 'send-sheet-search') ae.blur(); } catch (_e) {}
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
