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
          label: (g.labels && g.labels[ki]) ? g.labels[ki] : ('Wallet ' + (ki + 1)), groupId: g.id
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
    kit.on('session_delete', function () { _wcSyncFlag(); if (typeof wcSessionsChanged === 'function') wcSessionsChanged(); });
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
        _wcToast('No answer from the app. Refresh its QR code and scan again.', 'warning');
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
  _wcSyncFlag();
  if (typeof wcSessionsChanged === 'function') wcSessionsChanged();
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
    case 'wallet_switchEthereumChain':
      // the session already lists every chain we allowed; switching inside it is just an acknowledgement
      _wcRespond(topic, id, null); return;
    case 'wallet_addEthereumChain':
      _wcRespondError(topic, id, 4200, 'Add the network in One Wallet first'); return;
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
    return sent.hash;
  }
  throw new Error('Unsupported method');
}

window.addEventListener('load', function () { setTimeout(wcBootIfSessions, 2500); });
