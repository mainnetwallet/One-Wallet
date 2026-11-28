// ══════════════════════════════════════
//  EIP-7702 DELEGATION — redesign UI helpers
//  Mode toggle (Delegate / Revoke), contract chip, Advanced section, RPC summary.
//  Loaded after delegation-step-bar-and-eip7702-part2.js.
// ══════════════════════════════════════
var DEL_ZERO_ADDR = '0x0000000000000000000000000000000000000000';
var DEL_DEFAULT_BASE_ADDR = '0x000100abaad02f1cfc8bbe32bd5a564817339e72';
var _delLastDelegateAddr = DEL_DEFAULT_BASE_ADDR;

function _dlEl(id) { return document.getElementById(id); }

function _dlSetModeUi(m) {
  var page = _dlEl('page-delegation');
  if (page) page.setAttribute('data-del-mode', m);
  var d = _dlEl('dl-mode-d'), r = _dlEl('dl-mode-r');
  if (d) d.classList.toggle('on', m === 'd');
  if (r) r.classList.toggle('on', m === 'r');
}

// Chip + helper text under the contract input; keeps the mode toggle in sync with the address.
function dlRefreshContract() {
  var inp = _dlEl('del-delegationAddress');
  var chip = _dlEl('dl-contract-chip');
  var help = _dlEl('dl-contract-help');
  if (!inp || !chip) return;
  var raw = (inp.value || '').trim();
  var v = raw.toLowerCase();
  var isZero = v === DEL_ZERO_ADDR;
  var cls = 'dl-chip ', txt = '', h = '';
  if (isZero) {
    cls += 'dl-chip-bad'; txt = 'Revoke address';
    h = 'Wallets will stop pointing to any delegation contract.';
  } else if (!v) {
    cls += 'dl-chip-warn'; txt = 'Enter an address';
    h = 'Paste the delegation contract address for this network.';
  } else if (v === DEL_DEFAULT_BASE_ADDR) {
    cls += 'dl-chip-ok'; txt = 'Default contract';
    h = 'Wallets will point to this contract after delegation.';
  } else {
    cls += 'dl-chip-warn'; txt = 'Custom contract';
    h = 'Double-check this address before you start.';
  }
  if (raw && !isZero) _delLastDelegateAddr = raw;
  chip.className = cls;
  chip.textContent = txt;
  if (help) help.textContent = h;
  _dlSetModeUi(isZero ? 'r' : 'd');
}

function delSetMode(m) {
  var inp = _dlEl('del-delegationAddress');
  if (!inp) return;
  if (m === 'r') {
    var cur = inp.value.trim();
    if (cur && cur.toLowerCase() !== DEL_ZERO_ADDR) _delLastDelegateAddr = cur;
    inp.value = DEL_ZERO_ADDR;
  } else if (inp.value.trim().toLowerCase() === DEL_ZERO_ADDR) {
    inp.value = _delLastDelegateAddr || '';
  }
  dlRefreshContract();
  if (typeof haptic === 'function') haptic();
}

function dlToggleAdv() {
  var body = _dlEl('dl-adv-body');
  var chev = _dlEl('dl-adv-chev');
  if (!body) return;
  var open = body.hidden;
  body.hidden = !open;
  if (chev) chev.classList.toggle('open', open);
}

// RPC textarea is masked by default (URLs can carry API keys).
function dlToggleRpcReveal() {
  var ta = _dlEl('del-rpcUrls');
  var btn = _dlEl('dl-rpc-reveal');
  if (!ta) return;
  var masked = ta.classList.toggle('dl-masked');
  if (btn) btn.textContent = masked ? 'Reveal' : 'Hide';
}

function dlRefreshAdvSummary() {
  var rpc = _dlEl('del-rpcUrls');
  var own = _dlEl('del-ownerFunction');
  var n = rpc ? rpc.value.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).length : 0;
  var rpcTxt = n + ' RPC' + (n === 1 ? '' : 's');
  var ownTxt = (own && own.value.trim()) ? 'Custom owner check' : 'Default owner check';
  var sum = _dlEl('dl-adv-summary');
  if (sum) sum.textContent = ownTxt + ' · ' + rpcTxt;
  var line = _dlEl('dl-rpc-summary');
  if (line) line.textContent = rpcTxt + ' · more RPCs mean faster parallel processing';
}

// "Paste keys" tile: open the editable textarea (delPkToggle focuses it).
function dlPasteKeys() {
  var masked = _dlEl('del-pk-masked');
  if (masked && masked.style.display !== 'none' && typeof window.delPkToggle === 'function') {
    window.delPkToggle();
  } else {
    var ta = _dlEl('del-privateKeys');
    if (ta) ta.focus();
  }
}

// Programmatic value changes (chain switch) fire no input event, so refresh after delSyncActiveChain.
if (typeof delSyncActiveChain === 'function') {
  var _dlOrigSync = delSyncActiveChain;
  delSyncActiveChain = function () {
    var r = _dlOrigSync.apply(this, arguments);
    dlRefreshContract();
    dlRefreshAdvSummary();
    return r;
  };
}

(function dlInit() {
  var addr = _dlEl('del-delegationAddress');
  if (addr) addr.addEventListener('input', dlRefreshContract);
  var rpc = _dlEl('del-rpcUrls');
  if (rpc) rpc.addEventListener('input', dlRefreshAdvSummary);
  var own = _dlEl('del-ownerFunction');
  if (own) own.addEventListener('input', dlRefreshAdvSummary);
  dlRefreshContract();
  dlRefreshAdvSummary();
})();
