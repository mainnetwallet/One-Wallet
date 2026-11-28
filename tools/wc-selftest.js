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

// project id validation
assert.strictEqual(ctx.wcSetProjectId('nope'), false);
assert.strictEqual(ctx.wcSetProjectId('0123456789abcdef0123456789abcdef'), true);
assert.strictEqual(ctx.wcGetProjectId(), '0123456789abcdef0123456789abcdef');
console.log('wc-selftest: all checks passed');
