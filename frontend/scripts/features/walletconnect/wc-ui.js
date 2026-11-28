// ── WalletConnect sheets ──────────────────────────────────────
// One bottom-sheet container (#wc-overlay > #wc-sheet) renders every WalletConnect screen:
// connecting spinner, connect-confirm, sign / transaction request, connected apps, project-id setup.
// Engine calls (wc-engine.js): wcApproveProposal, wcRejectProposal, wcExecuteRequest, wcDisconnect ...
var WCUI = { screen: null, state: null, queue: [], busy: false };

function _wcEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function _wcShort(a) { a = String(a || ''); return a.length > 14 ? a.slice(0, 6) + '...' + a.slice(-4) : a; }
function _wcHost(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return String(u || ''); } }

function _wcDappIcon(peer, size) {
  var icon = peer && peer.icons && peer.icons.filter(function (i) { return /^https:\/\//i.test(i); })[0];
  var letter = _wcEsc(((peer && peer.name) || '?').trim().charAt(0).toUpperCase() || '?');
  var cls = 'wc-dapp-ico' + (size === 'sm' ? ' sm' : '');
  if (!icon) return '<div class="' + cls + '"><span>' + letter + '</span></div>';
  return '<div class="' + cls + '"><span>' + letter + '</span><img src="' + _wcEsc(icon) + '" alt="" referrerpolicy="no-referrer" ' +
         'onerror="this.remove()" onload="this.previousSibling.style.display=\'none\'"></div>';
}

function _wcVerifyBadge(v, peer) {
  var host = _wcHost(peer && peer.url);
  if (v && (v.isScam || v.validation === 'INVALID')) {
    return { level: 'bad', html: '<div class="wc-badge bad"><span class="material-icons-round">gpp_bad</span>' + (v.isScam ? 'Flagged as malicious' : 'Domain does not match') + '</div>',
             warn: v.isScam ? 'This site is flagged as malicious. Do not connect.' : 'The site that showed this QR code does not match the app it claims to be. It may be a phishing site.' };
  }
  if (v && v.validation === 'VALID') return { level: 'ok', html: '<div class="wc-badge ok"><span class="material-icons-round">verified_user</span>Verified</div>', warn: '' };
  return { level: 'warn', html: '<div class="wc-badge warn"><span class="material-icons-round">help_outline</span>Unverified</div>', warn: '' };
}

function _wcChainChip(cid) {
  var id = parseInt(String(cid).split(':')[1], 10);
  var name = (typeof _getChainName === 'function') ? _getChainName(id) : ('Chain ' + id);
  var logo = (typeof _resolveChainLogoUri === 'function') ? _resolveChainLogoUri(id) : '';
  var emo = (typeof _resolveChainEmoji === 'function') ? _resolveChainEmoji(id) : '🔗';
  return '<span class="wc-chip"><span class="wc-chip-ico"><span>' + _wcEsc(emo) + '</span>' +
    (logo ? '<img src="' + _wcEsc(logo) + '" alt="" onerror="this.remove()" onload="this.previousSibling.style.display=\'none\'">' : '') +
    '</span>' + _wcEsc(name) + '</span>';
}

// ── sheet plumbing ──
function _wcOpen(screen, html, state) {
  var ov = document.getElementById('wc-overlay'), sh = document.getElementById('wc-sheet');
  if (!ov || !sh) return;
  WCUI.screen = screen; WCUI.state = state || null;
  sh.innerHTML = '<div class="wc-grab"></div>' + html;
  ov.classList.add('open');
  if (typeof haptic === 'function') haptic();
}
function _wcRender(html) {
  var sh = document.getElementById('wc-sheet');
  if (sh) sh.innerHTML = '<div class="wc-grab"></div>' + html;
}
function wcCloseSheet() {
  var ov = document.getElementById('wc-overlay');
  if (ov) ov.classList.remove('open');
  WCUI.screen = null; WCUI.state = null; WCUI.busy = false;
  var next = WCUI.queue.shift();
  if (next) setTimeout(next, 280);
}
function _wcEnqueueOrRun(fn) {
  if (WCUI.screen && WCUI.screen !== 'connecting') { WCUI.queue.push(fn); return; }
  fn();
}
// Back button / tap outside: treated as "reject" on the screens that wait for an answer
function wcUiBack() {
  if (WCUI.busy) return;
  if (WCUI.screen === 'connect') return WCUI.reject();
  if (WCUI.screen === 'request') return WCUI.rejectRequest();
  wcCloseSheet();
}

// ── 1. Connecting ──
function wcShowConnecting() {
  if (WCUI.screen) return;
  _wcOpen('connecting',
    '<div class="wc-center"><div class="wc-spin"></div><div class="wc-h">Connecting...</div>' +
    '<div class="wc-sub">Waiting for the app to respond</div>' +
    '<button class="wc-btn ghost" onclick="wcCloseSheet()">Cancel</button></div>');
}
function wcHideConnecting(onlyIfShowing) {
  if (WCUI.screen !== 'connecting') return false;
  wcCloseSheet(); return true;
}

// ── 2. Connect confirm ──
function wcShowConnectSheet(proposal, info) {
  _wcEnqueueOrRun(function () {
    if (WCUI.screen === 'connecting') { var ov = document.getElementById('wc-overlay'); if (ov) ov.classList.remove('open'); WCUI.screen = null; }
    var all = _wcAllWallets();
    var home = (typeof _wcHomeAddress === 'function') ? _wcHomeAddress() : null;
    var st = { proposal: proposal, info: info, wallets: all, address: home || (all[0] && all[0].address) || null, picker: false };
    _wcOpen('connect', '', st);
    _wcRenderConnect();
  });
}
function _wcRenderConnect() {
  var st = WCUI.state; if (!st) return;
  var peer = st.proposal.params.proposer.metadata || {};
  var vb = _wcVerifyBadge(st.proposal.verifyContext && st.proposal.verifyContext.verified, peer);
  var info = st.info;
  var blocked = info.missingRequired.length > 0 || info.unsupportedNamespaces.length > 0 || !st.address;
  var w = st.wallets.filter(function (x) { return x.address === st.address; })[0];

  var chains = info.approvedChains.length ? info.approvedChains : [];
  var chipHtml = chains.map(_wcChainChip).join('');
  var missingHtml = info.missingRequired.map(function (c) {
    var id = parseInt(c.split(':')[1], 10); return '<span class="wc-chip miss"><span class="material-icons-round">error_outline</span>' + _wcEsc((typeof _getChainName === 'function') ? _getChainName(id) : c) + '</span>';
  }).join('');

  var walletRow = w
    ? '<div class="wc-card wc-tap" onclick="WCUI.togglePicker()"><div class="wc-wicon"><span class="material-icons-round">account_balance_wallet</span></div>' +
      '<div class="wc-grow"><div class="wc-k">Wallet</div><div class="wc-v">' + _wcEsc(w.group + ' · ' + w.label) + '</div><div class="wc-mono">' + _wcEsc(_wcShort(w.address)) + '</div></div>' +
      '<span class="material-icons-round wc-chev">' + (st.picker ? 'expand_less' : 'expand_more') + '</span></div>'
    : '<div class="wc-card"><div class="wc-v">No wallet available</div></div>';
  var picker = '';
  if (st.picker) {
    picker = '<div class="wc-picker">' + st.wallets.map(function (x, i) {
      return '<div class="wc-pick' + (x.address === st.address ? ' sel' : '') + '" onclick="WCUI.pick(' + i + ')">' +
        '<div class="wc-grow"><div class="wc-v">' + _wcEsc(x.group + ' · ' + x.label) + '</div><div class="wc-mono">' + _wcEsc(_wcShort(x.address)) + '</div></div>' +
        (x.address === st.address ? '<span class="material-icons-round">check</span>' : '') + '</div>';
    }).join('') + '</div>';
  }

  var warn = '';
  if (vb.warn) warn = '<div class="wc-warn bad"><span class="material-icons-round">warning_amber</span><div>' + _wcEsc(vb.warn) + '</div></div>';
  if (blocked && info.missingRequired.length) {
    warn += '<div class="wc-warn"><span class="material-icons-round">info</span><div>This app needs a network that is not added in One Wallet. Add it from Home > network picker, then scan again.</div></div>';
  } else if (info.unsupportedNamespaces.length) {
    warn += '<div class="wc-warn"><span class="material-icons-round">info</span><div>This app needs a blockchain that One Wallet does not support (' + _wcEsc(info.unsupportedNamespaces.join(', ')) + ').</div></div>';
  }

  _wcRender(
    '<div class="wc-head">' + _wcDappIcon(peer) +
      '<div class="wc-h">' + _wcEsc(peer.name || 'Unknown app') + '</div>' +
      '<div class="wc-sub">wants to connect to your wallet</div>' +
      '<div class="wc-host">' + _wcEsc(_wcHost(peer.url)) + '</div>' + vb.html +
    '</div>' + warn +
    walletRow + picker +
    '<div class="wc-card col"><div class="wc-k">Networks</div><div class="wc-chips">' + (chipHtml || '<span class="wc-sub">Default network</span>') + missingHtml + '</div></div>' +
    '<div class="wc-card col"><div class="wc-k">This app will be able to</div>' +
      '<div class="wc-perm"><span class="material-icons-round ok">check_circle</span>See your wallet address</div>' +
      '<div class="wc-perm"><span class="material-icons-round ok">check_circle</span>Ask you to approve transactions and signatures</div>' +
      '<div class="wc-perm no"><span class="material-icons-round">cancel</span>Cannot move funds without your approval</div></div>' +
    '<div class="wc-actions"><button class="wc-btn ghost" onclick="WCUI.reject()">Reject</button>' +
    '<button id="wc-go" class="wc-btn ' + (vb.level === 'bad' ? 'danger' : 'primary') + '"' + (blocked ? ' disabled' : '') + ' onclick="WCUI.approve()">' +
    (vb.level === 'bad' ? 'Connect anyway' : 'Connect') + '</button></div>');
}
WCUI.togglePicker = function () { if (WCUI.state) { WCUI.state.picker = !WCUI.state.picker; _wcRenderConnect(); } };
WCUI.pick = function (i) { var st = WCUI.state; if (!st) return; st.address = st.wallets[i].address; st.picker = false; _wcRenderConnect(); };
WCUI.reject = async function () {
  var st = WCUI.state; if (!st || WCUI.busy) return;
  var unsupported = st.info.missingRequired.length > 0;
  wcCloseSheet();
  wcRejectProposal(st.proposal, unsupported);
};
WCUI.approve = async function () {
  var st = WCUI.state; if (!st || WCUI.busy) return;
  WCUI.busy = true;
  var b = document.getElementById('wc-go'); if (b) { b.disabled = true; b.innerHTML = '<span class="wc-spin sm"></span>'; }
  try {
    await wcApproveProposal(st.proposal, st.info, st.address);
    var name = (st.proposal.params.proposer.metadata || {}).name || 'app';
    WCUI.busy = false; wcCloseSheet();
    _wcToast('Connected to ' + name, 'link');
  } catch (e) {
    WCUI.busy = false;
    var msg = String((e && e.message) || e).slice(0, 120);
    _wcToast('Could not connect: ' + msg, 'error');
    if (b) { b.disabled = false; b.textContent = 'Connect'; }
  }
};

// ── 3. Sign / transaction request ──
var _WC_SEL = { '0xa9059cbb': 'transfer', '0x095ea7b3': 'approve', '0x23b872dd': 'transferFrom', '0x42842e0e': 'safeTransferFrom', '0xa22cb465': 'setApprovalForAll' };
function _wcDecodeMsg(m) {
  try {
    if (typeof m === 'string' && /^0x([0-9a-fA-F]{2})*$/.test(m)) return new TextDecoder('utf-8', { fatal: false }).decode(ethers.getBytes(m));
  } catch (e) {}
  return String(m);
}
function wcShowRequestSheet(ctx) {
  _wcEnqueueOrRun(function () {
    if (WCUI.screen === 'connecting') { WCUI.screen = null; }
    _wcOpen('request', '', { ctx: ctx });
    _wcRenderRequest();
  });
}
function _wcRenderRequest() {
  var ctx = WCUI.state.ctx, peer = ctx.peer || {};
  var vb = _wcVerifyBadge(ctx.verified, peer);
  var title, body = '', warn = '', actLabel = 'Approve';
  var chainName = (typeof _getChainName === 'function') ? _getChainName(ctx.chainId) : ('Chain ' + ctx.chainId);
  var wLabel = (typeof _getWalletLabelForAddress === 'function' && _getWalletLabelForAddress(ctx.from)) || 'Wallet';

  var rows = '<div class="wc-row"><span>Wallet</span><b>' + _wcEsc(wLabel) + '</b></div>' +
             '<div class="wc-row"><span>Network</span><b>' + _wcEsc(chainName) + '</b></div>';

  if (ctx.method === 'personal_sign') {
    title = 'Signature request'; actLabel = 'Sign';
    var a0 = String(ctx.params[0] || ''), a1 = String(ctx.params[1] || '');
    var m = /^0x[0-9a-fA-F]{40}$/.test(a1) ? a0 : (/^0x[0-9a-fA-F]{40}$/.test(a0) ? a1 : a0);
    body = '<div class="wc-k">Message</div><div class="wc-data">' + _wcEsc(_wcDecodeMsg(m).slice(0, 1500)) + '</div>';
    warn = 'Signing does not send a transaction or cost gas. Only sign messages you understand.';
  } else if (ctx.method.indexOf('eth_signTypedData') === 0) {
    title = 'Signature request'; actLabel = 'Sign';
    var typed = {}; try { typed = typeof ctx.params[1] === 'string' ? JSON.parse(ctx.params[1]) : ctx.params[1]; } catch (e) {}
    var dom = (typed && typed.domain) || {};
    if (dom.name) rows += '<div class="wc-row"><span>Contract</span><b>' + _wcEsc(dom.name) + '</b></div>';
    if (typed && typed.primaryType) rows += '<div class="wc-row"><span>Type</span><b>' + _wcEsc(typed.primaryType) + '</b></div>';
    var pretty = ''; try { pretty = JSON.stringify((typed && typed.message) || typed, null, 2); } catch (e) { pretty = ''; }
    body = '<div class="wc-k">Data</div><div class="wc-data">' + _wcEsc(pretty.slice(0, 1500)) + (pretty.length > 1500 ? '\n...' : '') + '</div>';
    if (/permit|approval|order|seaport/i.test((typed && typed.primaryType) || '')) warn = 'This signature can give another address permission over your tokens. Make sure you trust this app.';
    else warn = 'Signing does not send a transaction or cost gas. Only sign data you understand.';
  } else {
    title = 'Transaction request'; actLabel = 'Confirm';
    var t = ctx.params[0] || {};
    var sym = (typeof _getChainSymbol === 'function') ? _getChainSymbol(ctx.chainId) : 'ETH';
    var val = (typeof _fmtValue === 'function') ? _fmtValue(t.value, ctx.chainId) : (t.value || '0');
    var data = String(t.data || t.input || '0x');
    var sel = data.length >= 10 ? data.slice(0, 10).toLowerCase() : '';
    var fn = _WC_SEL[sel];
    rows += '<div class="wc-row"><span>To</span><b class="mono">' + _wcEsc(_wcShort(t.to || 'New contract')) + '</b></div>';
    if (val !== '0' || data === '0x') rows += '<div class="wc-row"><span>Value</span><b class="hi">' + _wcEsc(val + ' ' + sym) + '</b></div>';
    if (data !== '0x') rows += '<div class="wc-row"><span>Action</span><b>' + _wcEsc(fn ? fn + '()' : 'Contract call (' + (sel || 'data') + ')') + '</b></div>';
    if (sel === '0x095ea7b3' && data.length >= 138) {
      var amt = BigInt('0x' + data.slice(74, 138));
      rows += '<div class="wc-row"><span>Spender</span><b class="mono">' + _wcEsc(_wcShort('0x' + data.slice(34, 74))) + '</b></div>';
      if (amt >= (1n << 200n)) warn = 'Unlimited token approval: this lets the spender use ALL of that token in your wallet.';
    } else if (sel === '0xa22cb465') {
      warn = 'This gives the operator access to ALL your NFTs in this collection.';
    }
    if (!warn) warn = 'Network fees are paid from your wallet balance.';
  }

  var danger = vb.level === 'bad' || /ALL|Unlimited|permission/.test(warn);
  _wcRender(
    '<div class="wc-head sm">' + _wcDappIcon(peer, 'sm') + '<div class="wc-grow"><div class="wc-h left">' + _wcEsc(title) + '</div>' +
    '<div class="wc-sub left">' + _wcEsc(peer.name || 'App') + ' · ' + _wcEsc(_wcHost(peer.url)) + '</div></div>' + vb.html + '</div>' +
    (vb.warn ? '<div class="wc-warn bad"><span class="material-icons-round">warning_amber</span><div>' + _wcEsc(vb.warn) + '</div></div>' : '') +
    '<div class="wc-card col">' + rows + '</div>' +
    (body ? '<div class="wc-card col">' + body + '</div>' : '') +
    '<div class="wc-warn' + (danger ? ' bad' : '') + '"><span class="material-icons-round">' + (danger ? 'warning_amber' : 'info') + '</span><div>' + _wcEsc(warn) + '</div></div>' +
    '<div id="wc-err" class="wc-err" style="display:none"></div>' +
    '<div class="wc-actions"><button class="wc-btn ghost" onclick="WCUI.rejectRequest()">Reject</button>' +
    '<button id="wc-go" class="wc-btn ' + (danger ? 'danger' : 'primary') + '" onclick="WCUI.approveRequest()">' + actLabel + '</button></div>');
}
WCUI.rejectRequest = function () {
  var st = WCUI.state; if (!st || WCUI.busy) return;
  var ctx = st.ctx; wcCloseSheet();
  _wcRespondError(ctx.topic, ctx.id, 4001, 'User rejected');
};
WCUI.approveRequest = async function () {
  var st = WCUI.state; if (!st || WCUI.busy) return;
  var ctx = st.ctx; WCUI.busy = true;
  var b = document.getElementById('wc-go'), orig = b ? b.textContent : '';
  if (b) { b.disabled = true; b.innerHTML = '<span class="wc-spin sm"></span>'; }
  try {
    var result = await wcExecuteRequest(ctx);
    await _wcRespond(ctx.topic, ctx.id, result);
    WCUI.busy = false; wcCloseSheet();
    if (ctx.method === 'eth_sendTransaction') _wcToast('Transaction sent: ' + _wcShort(result), 'send');
    else _wcToast('Signed', 'draw');
  } catch (e) {
    WCUI.busy = false;
    var msg = String((e && (e.shortMessage || e.message)) || e).slice(0, 200);
    var er = document.getElementById('wc-err'); if (er) { er.style.display = 'flex'; er.textContent = msg; }
    if (b) { b.disabled = false; b.textContent = orig || 'Retry'; }
    // transactions can fail for fixable reasons (gas, balance): keep the sheet so the user can retry or reject
  }
};

// ── 4. Connected apps ──
function wcOpenSessions() {
  var render = function () {
    var list = wcListSessions();
    var items = list.map(function (s) {
      var p = (s.peer && s.peer.metadata) || {}, addr = wcSessionAddress(s);
      var n = (s.namespaces && s.namespaces.eip155 && s.namespaces.eip155.chains || []).length;
      return '<div class="wc-card">' + _wcDappIcon(p, 'sm') + '<div class="wc-grow"><div class="wc-v">' + _wcEsc(p.name || 'App') + '</div>' +
        '<div class="wc-mono">' + _wcEsc(_wcHost(p.url)) + ' · ' + _wcEsc(_wcShort(addr)) + '</div></div>' +
        '<button class="wc-mini" onclick="WCUI.disconnect(\'' + _wcEsc(s.topic) + '\')">Disconnect</button></div>';
    }).join('');
    _wcRender('<div class="wc-h left" style="margin:2px 0 12px">Connected apps</div>' +
      (items || '<div class="wc-empty"><span class="material-icons-round">link_off</span><div>No connected apps</div><div class="wc-sub">Scan a WalletConnect QR code from any app or website to connect.</div></div>') +
      '<div class="wc-actions"><button class="wc-btn ghost" onclick="wcCloseSheet()">Close</button>' +
      '<button class="wc-btn primary" onclick="wcCloseSheet();setTimeout(homeScanBtnClick,250)">Scan QR</button></div>');
  };
  _wcEnqueueOrRun(function () {
    _wcOpen('sessions', '', null);
    if (!wcGetProjectId()) { render(); return; }
    render();
    wcInit().then(render).catch(function () {});
  });
}
WCUI.disconnect = async function (topic) { await wcDisconnect(topic); if (WCUI.screen === 'sessions') wcOpenSessionsRefresh(); };
function wcOpenSessionsRefresh() { if (WCUI.screen === 'sessions') { wcCloseSheet(); setTimeout(wcOpenSessions, 300); } }
function wcSessionsChanged() { wcOpenSessionsRefresh(); }

// ── 5. Project ID setup ──
function wcOpenProjectIdSheet(pendingUri) {
  _wcEnqueueOrRun(function () {
    _wcOpen('pid', '', { uri: pendingUri || null });
    _wcRender(
      '<div class="wc-head"><div class="wc-wicon big"><span class="material-icons-round">hub</span></div>' +
      '<div class="wc-h">Set up WalletConnect</div>' +
      '<div class="wc-sub">One-time setup. Paste a free Project ID from cloud.reown.com (create a project, copy its ID).</div></div>' +
      '<input id="wc-pid-input" class="wc-input" placeholder="32-character Project ID" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="32">' +
      '<div id="wc-err" class="wc-err" style="display:none">Project ID must be 32 letters and numbers</div>' +
      '<div class="wc-actions"><button class="wc-btn ghost" onclick="wcCloseSheet()">Cancel</button>' +
      '<button class="wc-btn primary" onclick="WCUI.savePid()">Save</button></div>');
  });
}
WCUI.savePid = function () {
  var inp = document.getElementById('wc-pid-input'), er = document.getElementById('wc-err');
  var ok = inp && wcSetProjectId(inp.value);
  if (!ok) { if (er) er.style.display = 'flex'; return; }
  var uri = WCUI.state && WCUI.state.uri;
  wcCloseSheet();
  _wcToast('WalletConnect ready', 'link');
  if (uri) setTimeout(function () { wcPair(uri); }, 300);
};
