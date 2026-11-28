// ── WalletConnect v2 engine (wallet side) ─────────────────────
// Wraps @reown/walletkit (bundled as vendor/walletconnect.min.js -> window.OneWC).
// Flow:  QR scan -> wcPair(uri) -> 'session_proposal' -> connect-confirm sheet (wc-ui.js)
//        -> approve/reject -> later 'session_request' (sign / send) -> request sheet -> respond.
// Nothing here signs without the user pressing the button in a sheet.
var WC_PROJECT_KEY  = 'one_wc_project_id';
var WC_HAS_SESS_KEY = 'one_wc_has_sessions';
var WC_METHODS = ['personal_sign', 'eth_sign', 'eth_signTypedData', 'eth_signTypedData_v3', 'eth_signTypedData_v4',
                  'eth_sendTransaction', 'eth_signTransaction', 'wallet_switchEthereumChain', 'wallet_addEthereumChain'];
var WC_EVENTS  = ['chainChanged', 'accountsChanged'];

var _wcKit = null;
var _wcInitPromise = null;
var _wcPairTimer = null;

function wcGetProjectId() {
  try { return (localStorage.getItem(WC_PROJECT_KEY) || '').trim(); } catch (e) { return ''; }
}
function wcSetProjectId(id) {
  id = String(id || '').trim();
  if (!/^[0-9a-f]{32}$/i.test(id)) return false;
  try { localStorage.setItem(WC_PROJECT_KEY, id); } catch (e) { return false; }
  _wcKit = null; _wcInitPromise = null; // re-init with the new id on next use
  return true;
}

function _wcToast(msg, icon) { if (typeof showToast === 'function') showToast(msg, icon || 'check_circle'); }

// Wallet lookup that never touches the in-app browser's selected wallet
function _wcAllWallets() {
  var out = [];
  var groups = [];
  try { groups = loadWalletGroups() || []; } catch (e) {}
  groups.forEach(function (g, gi) {
    if (!g || !g.keys) return;
    g.keys.forEach(function (k, ki) {
      try {
        var pk = (k && k.slice(0, 2) === '0x') ? k : '0x' + k;
        var addr = new ethers.Wallet(pk).address;
        out.push({
          address: addr, key: pk, group: g.name || ('Group ' + (gi + 1)),
          label: (g.labels && g.labels[ki]) ? g.labels[ki] : ('Wallet ' + (ki + 1)), groupId: g.id, idx: ki + 1
        });
      } catch (e) {}
    });
  });
  return out;
}
function _wcKeyFor(address) {
  var low = String(address || '').toLowerCase();
  var w = _wcAllWallets().filter(function (x) { return x.address.toLowerCase() === low; })[0];
  return w ? w.key : null;
}
function _wcHomeAddress() {
  try {
    var sel = document.getElementById('home-wallet-select');
    if (sel && sel.value) { var pk = sel.value.slice(0, 2) === '0x' ? sel.value : '0x' + sel.value; return new ethers.Wallet(pk).address; }
  } catch (e) {}
  var all = _wcAllWallets();
  return all.length ? all[0].address : null;
}
function _wcSupportedChainIds() {
  try { return getAllChains().map(function (c) { return c.chainId; }); } catch (e) { return [1]; }
}
function _wcFindChain(chainId) {
  try { return getAllChains().filter(function (c) { return c.chainId === chainId; })[0] || null; } catch (e) { return null; }
}

// ── Pure helpers (unit-tested in tools/wc-selftest.js) ──
var WC_CHAIN_KEY = 'one_wc_session_chain';   // { <session topic>: chainId } the network picked for each connected app
var WC_FN_NAMES = { '0xa9059cbb': 'transfer', '0x095ea7b3': 'approve', '0x23b872dd': 'transferFrom', '0x42842e0e': 'safeTransferFrom', '0xa22cb465': 'setApprovalForAll' };

// A chain id as a dApp sends it ('0x89', 137 or '137') -> 137. NaN unless it is a positive safe integer.
function wcParseChainId(v) {
  var n = NaN;
  if (typeof v === 'number') n = v;
  else if (typeof v === 'string') {
    v = v.trim();
    if (/^0x[0-9a-f]+$/i.test(v)) n = parseInt(v, 16); else if (/^[0-9]+$/.test(v)) n = parseInt(v, 10);
  }
  return (isFinite(n) && n > 0 && Math.floor(n) === n && n <= Number.MAX_SAFE_INTEGER) ? n : NaN;
}

// Only https links without user:password are kept (the text is returned as the dApp sent it)
function _wcHttps(u) {
  try {
    var s = String(u).trim(), x = new URL(s);
    return (x.protocol === 'https:' && !x.username && !x.password && x.hostname && s.length <= 300) ? s : '';
  } catch (e) { return ''; }
}

// wallet_addEthereumChain (EIP-3085) params[0] -> { ok, chain } or { ok:false, error }.
// Needs a hex chainId, a name, an 18-decimal native currency and at least one https RPC.
function wcParseAddChain(p) {
  p = p || {};
  var chainId = (typeof p.chainId === 'string' && /^0x/i.test(p.chainId)) ? wcParseChainId(p.chainId) : NaN;
  if (isNaN(chainId)) return { ok: false, error: 'Invalid chainId (must be a 0x hex string)' };
  var name = String(p.chainName || '').replace(/[\u0000-\u001f]/g, '').trim();
  if (!name || name.length > 60) return { ok: false, error: 'Invalid chainName' };
  var nc = p.nativeCurrency || {};
  var symbol = String(nc.symbol || '').trim();
  if (!/^[A-Za-z0-9$._-]{1,16}$/.test(symbol)) return { ok: false, error: 'Invalid nativeCurrency symbol' };
  if (nc.decimals !== 18) return { ok: false, error: 'Only networks with an 18-decimal native currency are supported' };
  var rpcs = [];
  (Array.isArray(p.rpcUrls) ? p.rpcUrls : []).forEach(function (u) {
    var s = _wcHttps(u);
    if (s && rpcs.indexOf(s) < 0 && rpcs.length < 5) rpcs.push(s);
  });
  if (!rpcs.length) return { ok: false, error: 'rpcUrls needs at least one https URL' };
  var explorer = '';
  (Array.isArray(p.blockExplorerUrls) ? p.blockExplorerUrls : []).some(function (u) {
    var s = _wcHttps(u); if (s) { explorer = s.replace(/\/+$/, ''); return true; } return false;
  });
  return { ok: true, chain: { chainId: chainId, name: name, symbol: symbol, decimals: 18, rpcs: rpcs, explorer: explorer } };
}

// Chains of a connected session (numbers) that One Wallet still has; supportedIds = null skips that filter
function wcSessionChains(session, supportedIds) {
  var ns = (session && session.namespaces && session.namespaces.eip155) || {};
  var refs = ns.chains || (ns.accounts || []).map(function (a) { return String(a).split(':').slice(0, 2).join(':'); });
  var out = [];
  refs.forEach(function (c) {
    var id = parseInt(String(c).split(':')[1], 10);
    if (id && out.indexOf(id) < 0 && (!supportedIds || supportedIds.indexOf(id) >= 0)) out.push(id);
  });
  return out;
}
// The network a session is on: the one picked earlier when it is still in the session, else its first chain
function wcPickActiveChain(session, stored, supportedIds) {
  var chains = wcSessionChains(session, supportedIds);
  return chains.indexOf(stored) >= 0 ? stored : (chains[0] || null);
}
function _wcChainMap() { try { return JSON.parse(localStorage.getItem(WC_CHAIN_KEY) || '{}') || {}; } catch (e) { return {}; } }
function _wcSaveChain(topic, chainId) {
  var m = _wcChainMap(); m[topic] = chainId;
  try { localStorage.setItem(WC_CHAIN_KEY, JSON.stringify(m)); } catch (e) {}
}
function _wcDropChain(topic) {
  var m = _wcChainMap(); if (!(topic in m)) return;
  delete m[topic];
  try { localStorage.setItem(WC_CHAIN_KEY, JSON.stringify(m)); } catch (e) {}
}
function wcGetSessionChain(session) { return wcPickActiveChain(session, _wcChainMap()[session && session.topic], _wcSupportedChainIds()); }

// History row for an eth_sendTransaction a dApp asked for. Same shape as a Send entry, so History lists it under "Sent".
// o: { ctx, hash, to, data, value ('0.01' / '0'), symbol, wallet ({ idx, groupId }) }
function wcBuildTxHistoryEntry(o) {
  var ctx = o.ctx || {}, peer = ctx.peer || {}, w = o.wallet || {};
  var data = String(o.data || '0x'), sel = data.length >= 10 ? data.slice(0, 10).toLowerCase() : '';
  var hasVal = parseFloat(o.value) > 0;
  var left = hasVal ? (o.value + ' ' + o.symbol) : (data === '0x' ? '0 ' + o.symbol : (WC_FN_NAMES[sel] ? WC_FN_NAMES[sel] + '()' : 'Contract call'));
  var host = ''; try { host = new URL(peer.url).hostname.replace(/^www\./, ''); } catch (e) {}
  var e = {
    type: 'send', hash: o.hash, chainId: ctx.chainId, fromChainId: ctx.chainId,
    pair: left + ' → ' + (o.to ? String(o.to).slice(0, 8) + '…' : 'New contract'),
    wallet: ctx.from, isDry: false, dapp: peer.name || host || 'WalletConnect', source: 'walletconnect'
  };
  if (hasVal) { e.fromAmt = o.value; e.fromToken = o.symbol; }
  if (w.idx) e.walletIndex = w.idx;
  if (w.groupId) e.groupId = w.groupId;
  return e;
}

// ── Init (lazy; the 800 KB bundle is already in the page, init only opens the relay connection) ──
function wcInit() {
  if (_wcKit) return Promise.resolve(_wcKit);
  if (_wcInitPromise) return _wcInitPromise;
  var pid = wcGetProjectId();
  if (!pid) return Promise.reject(new Error('NO_PROJECT_ID'));
  if (!window.OneWC) return Promise.reject(new Error('WalletConnect library missing'));
  _wcInitPromise = (async function () {
    var core = new OneWC.Core({ projectId: pid });
    var kit = await OneWC.WalletKit.init({
      core: core,
      metadata: {
        name: 'One Wallet', description: 'One Wallet - DeFi crypto wallet',
        url: 'https://onewallet.app', icons: []
      }
    });
    kit.on('session_proposal', _wcOnProposal);
    kit.on('session_request', _wcOnRequest);
    kit.on('session_delete', function (ev) { _wcDropChain(ev && ev.topic); _wcSyncFlag(); if (typeof wcSessionsChanged === 'function') wcSessionsChanged(); });
    _wcKit = kit;
    _wcSyncFlag();
    return kit;
  })().catch(function (e) { _wcInitPromise = null; throw e; });
  return _wcInitPromise;
}

function _wcSyncFlag() {
  try {
    var n = _wcKit ? Object.keys(_wcKit.getActiveSessions() || {}).length : 0;
    localStorage.setItem(WC_HAS_SESS_KEY, n > 0 ? '1' : '0');
  } catch (e) {}
}

// Re-open the relay on app start when there are saved sessions, so dApp requests arrive
function wcBootIfSessions() {
  try { if (localStorage.getItem(WC_HAS_SESS_KEY) === '1' && wcGetProjectId()) wcInit().catch(function () {}); } catch (e) {}
}

// Is the relay socket open? Unknown (older SDK / no property) counts as up, so the old message is kept
function _wcRelayUp(kit) {
  try { var r = kit && kit.core && kit.core.relayer; return r && typeof r.connected === 'boolean' ? r.connected : true; } catch (e) { return true; }
}
var WC_RELAY_HELP = 'Check your internet, and that the Project ID is right and its allowed domains at cloud.reown.com are empty.';

// ── Pairing from a scanned/pasted wc: link ──
async function wcPair(uri) {
  if (!wcGetProjectId()) { if (typeof wcOpenProjectIdSheet === 'function') wcOpenProjectIdSheet(uri); return; }
  if (!_wcHomeAddress()) { _wcToast('Please add a wallet first!', 'account_balance_wallet'); return; }
  if (typeof wcShowConnecting === 'function') wcShowConnecting();
  try {
    var kit = await wcInit();
    clearTimeout(_wcPairTimer);
    // the dApp must answer with a proposal; if not, the QR is stale or the dApp is offline
    _wcPairTimer = setTimeout(function () {
      if (typeof wcHideConnecting === 'function' && wcHideConnecting(true)) {
        // relay down is a different problem from a stale QR: say which one it is
        if (_wcRelayUp(kit)) _wcToast('No answer from the app. Refresh its QR code and scan again.', 'warning');
        else _wcToast('Cannot reach the WalletConnect relay. ' + WC_RELAY_HELP, 'warning');
      }
    }, 25000);
    await kit.pair({ uri: uri });
  } catch (e) {
    clearTimeout(_wcPairTimer);
    if (typeof wcHideConnecting === 'function') wcHideConnecting();
    var m = String((e && e.message) || e);
    if (m === 'NO_PROJECT_ID') { wcOpenProjectIdSheet(uri); return; }
    if (/expired/i.test(m)) _wcToast('This QR code has expired. Refresh it and scan again.', 'warning');
    else if (/pairing already exists|already/i.test(m)) _wcToast('This QR code was already used. Refresh it and scan again.', 'warning');
    else if (/unauthorized|origin not allowed|invalid (key|project)|\b(401|403)\b/i.test(m)) _wcToast('WalletConnect refused the connection. ' + WC_RELAY_HELP, 'error');
    else _wcToast('Could not connect: ' + m.slice(0, 80), 'error');
  }
}

// ── Proposal analysis (pure, unit-tested in tools/wc-selftest.js) ──
function wcAnalyzeProposal(params, supportedChainIds) {
  var req = params.requiredNamespaces || {}, opt = params.optionalNamespaces || {};
  var res = { requiredChains: [], optionalChains: [], methods: [], events: [], unsupportedNamespaces: [], missingRequired: [] };
  function eipChains(map, into) {
    Object.keys(map).forEach(function (k) {
      var ns = map[k] || {};
      if (k.split(':')[0] !== 'eip155') { if (into === 'required') res.unsupportedNamespaces.push(k); return; }
      var chains = ns.chains && ns.chains.length ? ns.chains : (k.indexOf(':') > 0 ? [k] : []);
      chains.forEach(function (c) { (into === 'required' ? res.requiredChains : res.optionalChains).push(c); });
      (ns.methods || []).forEach(function (m) { if (res.methods.indexOf(m) < 0) res.methods.push(m); });
      (ns.events || []).forEach(function (e) { if (res.events.indexOf(e) < 0) res.events.push(e); });
    });
  }
  eipChains(req, 'required'); eipChains(opt, 'optional');
  var sup = (supportedChainIds || []).map(function (c) { return 'eip155:' + c; });
  res.requiredChains = res.requiredChains.filter(function (c, i, a) { return a.indexOf(c) === i; });
  res.optionalChains = res.optionalChains.filter(function (c, i, a) { return a.indexOf(c) === i && res.requiredChains.indexOf(c) < 0; });
  res.missingRequired = res.requiredChains.filter(function (c) { return sup.indexOf(c) < 0; });
  res.approvedChains = res.requiredChains.concat(res.optionalChains).filter(function (c) { return sup.indexOf(c) >= 0; });
  return res;
}

// ── session_proposal ──
function _wcOnProposal(proposal) {
  clearTimeout(_wcPairTimer);
  if (typeof wcHideConnecting === 'function') wcHideConnecting();
  var info = wcAnalyzeProposal(proposal.params, _wcSupportedChainIds());
  if (typeof wcShowConnectSheet === 'function') wcShowConnectSheet(proposal, info);
  else wcRejectProposal(proposal);
}

async function wcApproveProposal(proposal, info, address) {
  var kit = await wcInit();
  var chains = info.approvedChains.slice();
  if (!chains.length) chains = ['eip155:' + (_wcSupportedChainIds()[0] || 1)];
  var methods = WC_METHODS.slice();
  var events = WC_EVENTS.slice();
  var namespaces = OneWC.buildApprovedNamespaces({
    proposal: proposal.params,
    supportedNamespaces: {
      eip155: { chains: chains, methods: methods, events: events,
                accounts: chains.map(function (c) { return c + ':' + address; }) }
    }
  });
  var session = await kit.approveSession({ id: proposal.id, namespaces: namespaces });
  _wcSyncFlag();
  if (typeof wcSessionsChanged === 'function') wcSessionsChanged();
  return session;
}

async function wcRejectProposal(proposal, unsupported) {
  try {
    var kit = await wcInit();
    await kit.rejectSession({ id: proposal.id, reason: OneWC.getSdkError(unsupported ? 'UNSUPPORTED_CHAINS' : 'USER_REJECTED') });
  } catch (e) {}
}

// ── Sessions ──
function wcListSessions() {
  if (!_wcKit) return [];
  var s = _wcKit.getActiveSessions() || {};
  return Object.keys(s).map(function (k) { return s[k]; }).sort(function (a, b) { return (b.expiry || 0) - (a.expiry || 0); });
}
async function wcDisconnect(topic) {
  try {
    var kit = await wcInit();
    await kit.disconnectSession({ topic: topic, reason: OneWC.getSdkError('USER_DISCONNECTED') });
  } catch (e) {}
  _wcDropChain(topic);
  _wcSyncFlag();
  if (typeof wcSessionsChanged === 'function') wcSessionsChanged();
}

// ── Per-session network ──
// Each connected app has its own network (Connected apps > pick one). The dApp is told with a chainChanged event.
function _wcEmitChainChanged(kit, topic, chainId) {
  // best effort: the app may not have asked for chainChanged, and that must never be an error for the user
  try {
    kit.emitSessionEvent({ topic: topic, event: { name: 'chainChanged', data: chainId }, chainId: 'eip155:' + chainId }).catch(function () {});
  } catch (e) {}
}
async function wcSwitchSessionChain(topic, chainId) {
  var kit = await wcInit();
  var s = kit.getActiveSessions()[topic];
  if (!s) throw new Error('This app is no longer connected');
  if (wcSessionChains(s, _wcSupportedChainIds()).indexOf(chainId) < 0) throw new Error('This app was not given that network');
  _wcSaveChain(topic, chainId);
  _wcEmitChainChanged(kit, topic, chainId);
  return chainId;
}

// Give a connected app a network it did not have (used after wallet_addEthereumChain). false = could not update.
async function wcExtendSession(topic, chainId) {
  try {
    var kit = await wcInit();
    var s = kit.getActiveSessions()[topic];
    if (!s) return false;
    var ns = s.namespaces.eip155, ref = 'eip155:' + chainId;
    if ((ns.chains || []).indexOf(ref) >= 0) return true;
    var addr = wcSessionAddress(s);
    await kit.updateSession({ topic: topic, namespaces: { eip155: {
      chains: (ns.chains || []).concat(ref), methods: ns.methods, events: ns.events, accounts: (ns.accounts || []).concat(ref + ':' + addr)
    } } });
    return true;
  } catch (e) { return false; }
}

// The user approved wallet_addEthereumChain: save the network like Add custom network does, then answer the app
async function wcApplyAddChain(ctx, c) {
  if (!_wcFindChain(c.chainId)) {
    var obj = { id: 'custom-' + c.chainId, chainId: c.chainId, emoji: '🔗', name: c.name, nativeSym: c.symbol,
                rpc: c.rpcs[0], rpcs: c.rpcs.slice(), explorer: c.explorer || '', builtIn: false, color: '#6366f1', logoURI: null };
    var list = loadCustomChains(); list.push(obj); saveCustomChains(list);
    if (typeof window.brSyncChainToPicker === 'function') { try { window.brSyncChainToPicker(obj); } catch (e) {} }
  }
  await wcExtendSession(ctx.topic, c.chainId);
  await _wcRespond(ctx.topic, ctx.id, null);
}
function wcSessionAddress(session) {
  try {
    var acc = session.namespaces.eip155.accounts[0] || '';
    return acc.split(':')[2] || null;
  } catch (e) { return null; }
}

// ── session_request ──
async function _wcRespond(topic, id, result) {
  try { var kit = await wcInit(); await kit.respondSessionRequest({ topic: topic, response: { id: id, jsonrpc: '2.0', result: result } }); } catch (e) {}
}
async function _wcRespondError(topic, id, code, message) {
  try { var kit = await wcInit(); await kit.respondSessionRequest({ topic: topic, response: { id: id, jsonrpc: '2.0', error: { code: code, message: message } } }); } catch (e) {}
}

function _wcOnRequest(ev) {
  var topic = ev.topic, id = ev.id;
  var method = ev.params.request.method, params = ev.params.request.params || [];
  var chainRef = ev.params.chainId || '';
  var chainId = parseInt(chainRef.split(':')[1], 10);
  var session = _wcKit && _wcKit.getActiveSessions()[topic];
  if (!session) { _wcRespondError(topic, id, 4100, 'Unknown session'); return; }
  var from = wcSessionAddress(session);
  var peer = (session.peer && session.peer.metadata) || {};
  var verified = ev.verifyContext && ev.verifyContext.verified;
  var ctx = { topic: topic, id: id, method: method, params: params, chainId: chainId, from: from, peer: peer, verified: verified };

  if (!_wcSupportedChainIds().some(function (c) { return c === chainId; })) {
    _wcRespondError(topic, id, 4902, 'Chain ' + chainId + ' is not added in One Wallet'); _wcToast('Network ' + chainId + ' is not added in One Wallet', 'error'); return;
  }
  switch (method) {
    case 'wallet_switchEthereumChain': {
      // EIP-3326: only networks this session was given; anything else is 4902 so the app can try wallet_addEthereumChain
      var raw = (params[0] || {}).chainId, want = wcParseChainId(raw);
      if (isNaN(want) || wcSessionChains(session, _wcSupportedChainIds()).indexOf(want) < 0) {
        _wcRespondError(topic, id, 4902, 'Chain ' + String(raw).slice(0, 20) + ' is not available in this session'); return;
      }
      _wcSaveChain(topic, want);
      _wcRespond(topic, id, null).then(function () { _wcEmitChainChanged(_wcKit, topic, want); });
      if (typeof wcSessionsChanged === 'function') wcSessionsChanged();
      return;
    }
    case 'wallet_addEthereumChain': {
      // EIP-3085: a new network needs the user's OK (its RPC sees the wallet's activity); one that is already added is just shared
      var parsed = wcParseAddChain(params[0]);
      if (!parsed.ok) { _wcRespondError(topic, id, -32602, parsed.error); return; }
      if (_wcFindChain(parsed.chain.chainId)) {
        wcExtendSession(topic, parsed.chain.chainId).then(function () { _wcRespond(topic, id, null); });
        return;
      }
      if (typeof wcShowAddChainSheet === 'function') { wcShowAddChainSheet(ctx, parsed.chain); return; }
      _wcRespondError(topic, id, 4001, 'User rejected'); return;
    }
    case 'eth_sign': case 'eth_signTransaction':
      _wcRespondError(topic, id, 4200, method + ' is not supported'); return;
    case 'personal_sign': case 'eth_signTypedData': case 'eth_signTypedData_v3': case 'eth_signTypedData_v4': case 'eth_sendTransaction':
      if (typeof wcShowRequestSheet === 'function') { wcShowRequestSheet(ctx); return; }
      _wcRespondError(topic, id, 4001, 'User rejected'); return;
    default:
      _wcRespondError(topic, id, 4200, 'Method not supported: ' + method);
  }
}

// ── Execute an approved request (called by the request sheet) ──
async function wcExecuteRequest(ctx) {
  var pk = _wcKeyFor(ctx.from);
  if (!pk) throw new Error('Wallet not found in One Wallet');
  var wallet = new ethers.Wallet(pk);
  var p = ctx.params;
  if (ctx.method === 'personal_sign') {
    var a0 = String(p[0] || ''), a1 = String(p[1] || '');
    var msg = /^0x[0-9a-fA-F]{40}$/.test(a1) ? a0 : (/^0x[0-9a-fA-F]{40}$/.test(a0) ? a1 : a0);
    var data = /^0x([0-9a-fA-F]{2})*$/.test(msg) ? ethers.getBytes(msg) : msg;
    return await wallet.signMessage(data);
  }
  if (ctx.method.indexOf('eth_signTypedData') === 0) {
    var typed = typeof p[1] === 'string' ? JSON.parse(p[1]) : p[1];
    var types = Object.assign({}, typed.types); delete types.EIP712Domain;
    return await wallet.signTypedData(typed.domain || {}, types, typed.message || {});
  }
  if (ctx.method === 'eth_sendTransaction') {
    var t = p[0] || {};
    var provider = new ethers.JsonRpcProvider(_getRpcForChain(ctx.chainId), ctx.chainId, { staticNetwork: true });
    var w = wallet.connect(provider);
    var tx = { to: t.to || null, data: t.data || t.input || '0x' };
    if (t.value) tx.value = BigInt(t.value);
    if (t.gas || t.gasLimit) tx.gasLimit = BigInt(t.gas || t.gasLimit);
    if (t.nonce != null) tx.nonce = Number(t.nonce);
    if (t.maxFeePerGas) tx.maxFeePerGas = BigInt(t.maxFeePerGas);
    if (t.maxPriorityFeePerGas) tx.maxPriorityFeePerGas = BigInt(t.maxPriorityFeePerGas);
    if (t.gasPrice && !t.maxFeePerGas) tx.gasPrice = BigInt(t.gasPrice);
    var sent = await w.sendTransaction(tx);
    _wcRecordTx(ctx, t, sent.hash, provider);
    return sent.hash;
  }
  throw new Error('Unsupported method');
}

// Put a sent transaction in History (Profile > Transaction History). Never lets a History problem stop the answer to the app.
function _wcRecordTx(ctx, t, hash, provider) {
  try {
    if (typeof saveTxToHistory !== 'function') return;
    var wl = _wcAllWallets().filter(function (x) { return x.address.toLowerCase() === String(ctx.from).toLowerCase(); })[0] || {};
    var sym = (typeof _getChainSymbol === 'function') ? _getChainSymbol(ctx.chainId) : 'ETH';
    var val = '0';
    try { val = (typeof _fmtValue === 'function') ? _fmtValue(t.value, ctx.chainId) : (t.value ? ethers.formatEther(BigInt(t.value)) : '0'); } catch (e) {}
    var saved = saveTxToHistory(wcBuildTxHistoryEntry({ ctx: ctx, hash: hash, to: t.to, data: t.data || t.input || '0x', value: val, symbol: sym, wallet: wl }));
    // an entry is saved as soon as the tx is broadcast; if it later reverts it must not stay "confirmed"
    if (saved && saved.id && provider && typeof provider.waitForTransaction === 'function') {
      provider.waitForTransaction(hash, 1, 180000).then(function (r) { if (r && r.status === 0) _wcMarkTxFailed(saved.id); }).catch(function () {});
    }
  } catch (e) {}
}
function _wcMarkTxFailed(id) {
  try {
    var all = loadTxHistory(), tx = all.filter(function (x) { return x.id === id; })[0];
    if (!tx) return;
    tx.failed = true; tx.failReason = 'Transaction reverted on-chain';
    saveTxHistory(all);
    if (typeof renderTxHistory === 'function') renderTxHistory();
    if (typeof updateTxMenuBadge === 'function') updateTxMenuBadge();
  } catch (e) {}
}

window.addEventListener('load', function () { setTimeout(wcBootIfSessions, 2500); });
