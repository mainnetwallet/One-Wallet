// Offline self-test for the WalletConnect glue: node tools/wc-selftest.js
// Loads vendor/walletconnect.min.js + wc-engine.js in a stubbed context (no network, no DOM).
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
const root = path.join(__dirname, '..', 'frontend');
const store = {};
// run in THIS realm (not a vm context): the SDK does Array/instanceof checks that fail across realms
global.window = global; global.self = global;
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
global.document = { getElementById: () => null };
global.addEventListener = () => {};
for (const f of ['vendor/ethers.umd.min.js', 'vendor/walletconnect.min.js', 'scripts/features/walletconnect/wc-engine.js'])
  vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
const ctx = global;
const eq = (a, b) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b));
const A = '0x52908400098527886E0F7030069857D2E4169EE7';
const proposal = { requiredNamespaces: { eip155: { chains: ['eip155:1'], methods: ['eth_sendTransaction', 'personal_sign'], events: ['chainChanged'] } },
  optionalNamespaces: { eip155: { chains: ['eip155:137', 'eip155:42161', 'eip155:999999'], methods: ['eth_signTypedData_v4'], events: ['accountsChanged'] } } };

let info = ctx.wcAnalyzeProposal(proposal, [1, 137, 56]);
eq(info.approvedChains, ['eip155:1', 'eip155:137']);
eq(info.missingRequired, []);
info = ctx.wcAnalyzeProposal(proposal, [137]);
eq(info.missingRequired, ['eip155:1']);
info = ctx.wcAnalyzeProposal({ requiredNamespaces: { solana: { chains: ['solana:x'], methods: [], events: [] } }, optionalNamespaces: {} }, [1]);
eq(info.unsupportedNamespaces, ['solana']);
// per-chain keys: requiredNamespaces { 'eip155:56': {...} }
info = ctx.wcAnalyzeProposal({ requiredNamespaces: { 'eip155:56': { methods: ['personal_sign'], events: [] } }, optionalNamespaces: {} }, [56]);
eq(info.requiredChains, ['eip155:56']);

// buildApprovedNamespaces accepts what wcApproveProposal builds
const chains = ['eip155:1', 'eip155:137'];
const ns = ctx.OneWC.buildApprovedNamespaces({ proposal: { ...proposal, requiredNamespaces: proposal.requiredNamespaces },
  supportedNamespaces: { eip155: { chains, methods: WC_METHODS, events: WC_EVENTS, accounts: chains.map(c => c + ':' + A) } } });
eq(ns.eip155.chains, chains);
assert.ok(ns.eip155.methods.includes('personal_sign') && ns.eip155.accounts.length === 2);

// project id: built-in default, a saved valid ID wins, a corrupt saved value falls back to the default
assert.strictEqual(ctx.WC_DEFAULT_PROJECT_ID, '2c779015e958dfad1f4bf86d2423cc6e');
assert.ok(/^[0-9a-f]{32}$/.test(ctx.WC_DEFAULT_PROJECT_ID));
assert.strictEqual(ctx.wcGetProjectId(), ctx.WC_DEFAULT_PROJECT_ID);
store.one_wc_project_id = 'garbage'; assert.strictEqual(ctx.wcGetProjectId(), ctx.WC_DEFAULT_PROJECT_ID); delete store.one_wc_project_id;
// project id validation
assert.strictEqual(ctx.wcSetProjectId('nope'), false);
assert.strictEqual(ctx.wcGetProjectId(), ctx.WC_DEFAULT_PROJECT_ID);          // a refused ID changes nothing
assert.strictEqual(ctx.wcSetProjectId('0123456789abcdef0123456789abcdef'), true);
assert.strictEqual(ctx.wcGetProjectId(), '0123456789abcdef0123456789abcdef');

// ── chain ids ──
assert.strictEqual(ctx.wcParseChainId('0x89'), 137);
assert.strictEqual(ctx.wcParseChainId('137'), 137);
assert.strictEqual(ctx.wcParseChainId(56), 56);
for (const bad of ['0x', 'abc', '', '0', 0, -1, 1.5, null, undefined, '0xzz', '0xffffffffffffffffffff']) assert.ok(isNaN(ctx.wcParseChainId(bad)), 'bad chain id: ' + bad);

// ── wallet_addEthereumChain parsing (EIP-3085) ──
const goodAdd = { chainId: '0xa4b1', chainName: ' Arbitrum One ', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://arb1.arbitrum.io/rpc', 'https://arb1.arbitrum.io/rpc', 'http://insecure.example/rpc', 'https://u:p@evil.example/rpc', 'wss://x.example', 'not a url'],
  blockExplorerUrls: ['http://nope.example', 'https://arbiscan.io/'] };
let add = ctx.wcParseAddChain(goodAdd);
assert.ok(add.ok);
eq(add.chain, { chainId: 42161, name: 'Arbitrum One', symbol: 'ETH', decimals: 18, rpcs: ['https://arb1.arbitrum.io/rpc'], explorer: 'https://arbiscan.io' });
const badAdds = [
  [{ ...goodAdd, chainId: '42161' }, /chainId/],                              // must be 0x hex
  [{ ...goodAdd, chainId: 42161 }, /chainId/],
  [{ ...goodAdd, chainName: '' }, /chainName/],
  [{ ...goodAdd, chainName: 'x'.repeat(61) }, /chainName/],
  [{ ...goodAdd, nativeCurrency: { name: 'X', symbol: '', decimals: 18 } }, /symbol/],
  [{ ...goodAdd, nativeCurrency: { name: 'X', symbol: 'X<script>', decimals: 18 } }, /symbol/],
  [{ ...goodAdd, nativeCurrency: { name: 'X', symbol: 'X', decimals: 6 } }, /18-decimal/],
  [{ ...goodAdd, nativeCurrency: undefined }, /symbol/],
  [{ ...goodAdd, rpcUrls: ['http://insecure.example'] }, /https/],
  [{ ...goodAdd, rpcUrls: [] }, /https/],
  [{ ...goodAdd, rpcUrls: 'https://a.example' }, /https/],
  [undefined, /chainId/],
];
for (const [p, re] of badAdds) { const r = ctx.wcParseAddChain(p); assert.ok(!r.ok && re.test(r.error), JSON.stringify(p) + ' -> ' + JSON.stringify(r)); }
assert.strictEqual(ctx.wcParseAddChain({ ...goodAdd, rpcUrls: Array.from({ length: 9 }, (_, i) => 'https://r' + i + '.example') }).chain.rpcs.length, 5);
assert.strictEqual(ctx.wcParseAddChain({ ...goodAdd, blockExplorerUrls: undefined }).chain.explorer, '');

// ── per-session chain ──
const sess = { topic: 't1', peer: { metadata: { name: 'Swapper', url: 'https://www.swapper.io' } },
  namespaces: { eip155: { chains: ['eip155:1', 'eip155:137', 'eip155:56'], accounts: ['eip155:1:' + A, 'eip155:137:' + A, 'eip155:56:' + A], methods: ['personal_sign'], events: ['chainChanged'] } } };
eq(ctx.wcSessionChains(sess, null), [1, 137, 56]);
eq(ctx.wcSessionChains(sess, [137, 1]), [1, 137]);                           // chains One Wallet removed are dropped
eq(ctx.wcSessionChains({ namespaces: { eip155: { accounts: ['eip155:10:' + A] } } }, null), [10]); // falls back to accounts
eq(ctx.wcSessionChains({}, null), []);
assert.strictEqual(ctx.wcPickActiveChain(sess, 137, [1, 137, 56]), 137);
assert.strictEqual(ctx.wcPickActiveChain(sess, 999, [1, 137, 56]), 1);       // stored chain not in the session -> first
assert.strictEqual(ctx.wcPickActiveChain(sess, 137, [1, 56]), 1);            // stored chain no longer added in One Wallet
assert.strictEqual(ctx.wcPickActiveChain(sess, undefined, []), null);
ctx._wcSaveChain('t1', 56); ctx._wcSaveChain('t2', 1);
assert.strictEqual(JSON.parse(store.one_wc_session_chain).t1, 56);
ctx._wcDropChain('t1');
eq(JSON.parse(store.one_wc_session_chain), { t2: 1 });

// ── History row for a dApp transaction ──
const hctx = { chainId: 137, from: A, peer: sess.peer.metadata };
let h = ctx.wcBuildTxHistoryEntry({ ctx: hctx, hash: '0xabc', to: '0x1111111111111111111111111111111111111111', data: '0x', value: '0.010000', symbol: 'POL', wallet: { idx: 3, groupId: 'g1' } });
eq(h, { type: 'send', hash: '0xabc', chainId: 137, fromChainId: 137, pair: '0.010000 POL → 0x111111…', wallet: A, isDry: false, dapp: 'Swapper', source: 'walletconnect', fromAmt: '0.010000', fromToken: 'POL', walletIndex: 3, groupId: 'g1' });
h = ctx.wcBuildTxHistoryEntry({ ctx: hctx, hash: '0xabc', to: '0x1111111111111111111111111111111111111111', data: '0x095ea7b3' + '0'.repeat(128), value: '0', symbol: 'POL', wallet: {} });
assert.strictEqual(h.pair, 'approve() → 0x111111…'); assert.ok(!('fromAmt' in h) && !('walletIndex' in h));
assert.strictEqual(ctx.wcBuildTxHistoryEntry({ ctx: hctx, hash: '0x', to: '0x1', data: '0xdeadbeef00', value: '0', symbol: 'POL' }).pair, 'Contract call → 0x1…');
assert.strictEqual(ctx.wcBuildTxHistoryEntry({ ctx: { ...hctx, peer: {} }, hash: '0x', to: null, data: '0x', value: '0', symbol: 'POL' }).pair, '0 POL → New contract');
assert.strictEqual(ctx.wcBuildTxHistoryEntry({ ctx: { ...hctx, peer: { url: 'https://www.dapp.xyz/x' } }, hash: '0x', data: '0x', value: '0', symbol: 'POL' }).dapp, 'dapp.xyz');

// ── request flow with a stub WalletKit ──
const tick = () => new Promise(r => setTimeout(r, 15));
(async () => {
  const sent = [], emitted = [], updated = [];
  let customs = [];
  ctx.getAllChains = () => [{ chainId: 1 }, { chainId: 137 }, { chainId: 56 }].concat(customs);
  ctx.loadCustomChains = () => customs.slice(); ctx.saveCustomChains = l => { customs = l; };
  ctx._wcKit = {
    getActiveSessions: () => ({ t1: sess }),
    respondSessionRequest: async r => { sent.push(r.response); },
    emitSessionEvent: async e => { emitted.push(e); },
    updateSession: async u => { updated.push(u); },
  };
  const ev = (method, p, chain) => ({ topic: 't1', id: sent.length + 100, params: { chainId: chain || 'eip155:1', request: { method, params: p } } });
  const last = () => sent[sent.length - 1];

  // wallet_switchEthereumChain: inside the session -> saved, answered null, chainChanged sent after the answer
  ctx._wcOnRequest(ev('wallet_switchEthereumChain', [{ chainId: '0x89' }])); await tick();
  assert.strictEqual(last().result, null); assert.ok('result' in last());
  assert.strictEqual(JSON.parse(store.one_wc_session_chain).t1, 137);
  eq(emitted[0], { topic: 't1', event: { name: 'chainChanged', data: 137 }, chainId: 'eip155:137' });
  assert.strictEqual(ctx.wcGetSessionChain(sess), 137);
  // not in the session / bad params -> 4902, nothing saved or emitted
  const before = emitted.length;
  ctx._wcOnRequest(ev('wallet_switchEthereumChain', [{ chainId: '0xa' }])); await tick();
  assert.strictEqual(last().error.code, 4902);
  ctx._wcOnRequest(ev('wallet_switchEthereumChain', [{}])); await tick();
  assert.strictEqual(last().error.code, 4902);
  assert.strictEqual(emitted.length, before);
  assert.strictEqual(JSON.parse(store.one_wc_session_chain).t1, 137);
  // switching from the Connected apps list
  assert.strictEqual(await ctx.wcSwitchSessionChain('t1', 56), 56);
  assert.strictEqual(emitted[emitted.length - 1].chainId, 'eip155:56');
  await assert.rejects(ctx.wcSwitchSessionChain('t1', 10), /not given/);
  await assert.rejects(ctx.wcSwitchSessionChain('nope', 1), /no longer connected/);

  // wallet_addEthereumChain: invalid -> -32602; already added -> null; new -> asks the user (sheet) and answers only after approval
  ctx._wcOnRequest(ev('wallet_addEthereumChain', [{ ...goodAdd, rpcUrls: ['http://x.example'] }])); await tick();
  assert.strictEqual(last().error.code, -32602);
  ctx._wcOnRequest(ev('wallet_addEthereumChain', [{ ...goodAdd, chainId: '0x89', chainName: 'Polygon' }])); await tick();
  assert.strictEqual(last().result, null); assert.strictEqual(customs.length, 0);
  ctx._wcOnRequest(ev('wallet_addEthereumChain', [goodAdd])); await tick();
  assert.strictEqual(last().error.code, 4001);                      // no sheet in this test: refused, never added silently
  assert.strictEqual(customs.length, 0);
  let shown = null; ctx.wcShowAddChainSheet = (c, chain) => { shown = { c, chain }; };
  const n = sent.length;
  ctx._wcOnRequest(ev('wallet_addEthereumChain', [goodAdd])); await tick();
  assert.strictEqual(sent.length, n);                               // waiting for the user
  assert.strictEqual(shown.chain.chainId, 42161); assert.strictEqual(shown.c.topic, 't1');
  assert.strictEqual(customs.length, 0);                            // nothing saved before approval
  await ctx.wcApplyAddChain(shown.c, shown.chain);                  // user pressed "Add network"
  eq(customs[0], { id: 'custom-42161', chainId: 42161, emoji: '🔗', name: 'Arbitrum One', nativeSym: 'ETH', rpc: 'https://arb1.arbitrum.io/rpc',
    rpcs: ['https://arb1.arbitrum.io/rpc'], explorer: 'https://arbiscan.io', builtIn: false, color: '#6366f1', logoURI: null });
  assert.strictEqual(last().result, null);
  assert.ok(updated[0].namespaces.eip155.chains.includes('eip155:42161') && updated[0].namespaces.eip155.accounts.includes('eip155:42161:' + A));
  await ctx.wcApplyAddChain(shown.c, shown.chain); assert.strictEqual(customs.length, 1); // never added twice

  // eth_sendTransaction -> History row, flipped to failed when the receipt says reverted
  const pk = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
  const from = new ethers.Wallet(pk).address;
  let hist = []; ctx.loadWalletGroups = () => [{ id: 'g1', name: 'Bots', keys: ['0x' + '1'.repeat(64), pk] }];
  ctx.loadTxHistory = () => hist; ctx.saveTxHistory = a => { hist = a; };
  ctx.saveTxToHistory = e => { const x = { ...e, id: 'id1', timestamp: 1 }; hist.unshift(x); return x; };
  let receipt = { status: 0 };
  const provider = { waitForTransaction: async () => receipt };
  ctx._wcRecordTx({ chainId: 137, from, peer: sess.peer.metadata }, { to: '0x2222222222222222222222222222222222222222', value: '0x2386f26fc10000', data: '0x' }, '0xfeed', provider);
  assert.strictEqual(hist.length, 1);
  assert.strictEqual(hist[0].hash, '0xfeed'); assert.strictEqual(hist[0].fromAmt, '0.01'); assert.strictEqual(hist[0].walletIndex, 2); assert.strictEqual(hist[0].groupId, 'g1');
  assert.ok(!hist[0].failed);
  await tick();
  assert.strictEqual(hist[0].failed, true); assert.match(hist[0].failReason, /reverted/);
  // a succeeded receipt leaves it confirmed; a History/provider failure never throws into the request flow
  hist = []; receipt = { status: 1 };
  ctx._wcRecordTx({ chainId: 137, from, peer: sess.peer.metadata }, { to: '0x2222222222222222222222222222222222222222', data: '0x' }, '0xbeef', provider); await tick();
  assert.ok(!hist[0].failed);
  ctx.saveTxToHistory = () => { throw new Error('storage full'); };
  ctx._wcRecordTx({ chainId: 137, from, peer: sess.peer.metadata }, { to: '0x2', data: '0x' }, '0xdead', provider);

  console.log('wc-selftest: all checks passed');
})().catch(e => { console.error(e); process.exit(1); });
