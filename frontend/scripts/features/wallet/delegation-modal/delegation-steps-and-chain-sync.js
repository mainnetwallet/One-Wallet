
// ══════ DELEGATION MODAL ══════
// ══════════════════════════════════════
//  STEP-BAR NAVIGATION — EIP-7702
// ══════════════════════════════════════
var _delCurrentStep = 1;
var _delStepLabels = ['', 'Step 1 of 3 · Network', 'Step 2 of 3 · Wallets', 'Step 3 of 3 · Execute'];

function delGoToStep(n) {
  if (n < 1 || n > 3) return;
  var prev = _delCurrentStep;
  _delCurrentStep = n;

  // Update panels
  for (var i = 1; i <= 3; i++) {
    var panel = document.getElementById('del-panel-' + i);
    if (panel) { panel.classList.toggle('active', i === n); }
  }

  // Update step dots
  for (var j = 1; j <= 3; j++) {
    var item = document.getElementById('del-step-item-' + j);
    if (!item) continue;
    item.classList.remove('active', 'done');
    if (j < n) item.classList.add('done');
    else if (j === n) item.classList.add('active');
    // update icon inside dot for done steps
    var dot = item.querySelector('.del-step-dot');
    if (dot) {
      if (j < n) dot.innerHTML = '<span class="material-icons-round" style="font-size:16px;">check</span>';
      else dot.innerHTML = j;
    }
  }

  // Update connectors
  var c1 = document.getElementById('del-conn-1-2');
  var c2 = document.getElementById('del-conn-2-3');
  if (c1) c1.classList.toggle('filled', n > 1);
  if (c2) c2.classList.toggle('filled', n > 2);

  // Update header sub-label
  var lbl = document.getElementById('del-header-step-label');
  if (lbl) lbl.textContent = _delStepLabels[n] || '';

  // Progress bar under the step tabs
  var prog = document.getElementById('dl-prog-fill');
  if (prog) prog.style.width = (n / 3 * 100) + '%';

  // Scroll body to top
  var body = document.getElementById('del-modal-body-scroll');
  if (body) body.scrollTop = 0;
}

function openDelegationModal() {
  switchPage('delegation');
  delGoToStep(1);
  haptic && haptic();
  // Sync active chain from home screen (initial sync — sets delCurrentChainId only, won't affect home later)
  if (typeof activeHomeChainId !== 'undefined' && activeHomeChainId !== null) {
    delCurrentChainId = activeHomeChainId;
  }
  delSyncActiveChain();
  // Populate group dropdown
  delPopulateGroupSelect();
  // Show owner function status hint
  const ownerFnEl = document.getElementById('del-ownerFunction');
  const ownerFnStatus = document.getElementById('del-owner-fn-status');
  if (ownerFnStatus) {
    const val = ownerFnEl?.value.trim() || '';
    ownerFnStatus.style.display = 'block';
    if (val) {
      ownerFnStatus.textContent = '⚡ Custom fn active: ' + val.split('(')[0].trim() + '()';
      ownerFnStatus.style.color = 'var(--neon-purple)';
    } else {
      ownerFnStatus.textContent = '✅ Using default: nextOwnerIndex() (Base / Coinbase standard)';
      ownerFnStatus.style.color = 'var(--accent-green)';
    }
  }
  // init ethers when modal first opens
  if (typeof delEthersReady === 'undefined') {
    delWaitForEthers(function() { delEthersReady = true; delLog('⚡ Ready. Configure RPC & click Start Delegation.', 'info'); });
  }
}

// ── Sync active chain from home screen into delegation modal ──
function delSyncActiveChain() {
  // Safe hexToRgb fallback — in case called before HCP block defines it globally
  function _safeHexToRgb(hex) {
    try {
      if (typeof hexToRgb === 'function') return hexToRgb(hex);
      const h = hex.replace('#','');
      return parseInt(h.slice(0,2),16)+','+parseInt(h.slice(2,4),16)+','+parseInt(h.slice(4,6),16);
    } catch { return '99,102,241'; }
  }
  try {
    // Use delegation-specific chainId (independent from home screen)
    const chainId = (typeof delCurrentChainId !== 'undefined' && delCurrentChainId) ? delCurrentChainId : 8453;
    if (chainId === null || chainId === undefined) return;
    const chain = (typeof getAllChains === 'function') ? getAllChains().find(c => c.chainId === chainId) : null;
    if (!chain) return;

    const isBase = (chainId === 8453);

    // Update badge in header
    const badgeEmojiEl = document.getElementById('del-badge-emoji');
    const badgeNameEl  = document.getElementById('del-badge-name');
    if (badgeEmojiEl) {
      if (chain.logoURI) {
        badgeEmojiEl.innerHTML = `<img src="${chain.logoURI}" width="14" height="14" style="border-radius:3px;object-fit:cover;vertical-align:middle;" onerror="if(this.parentNode)this.outerHTML='<span style=\\'font-size:13px;line-height:1;\\'>${chain.emoji}</span>'" />`;
      } else {
        badgeEmojiEl.innerHTML = `<span style="font-size:13px;line-height:1;">${chain.emoji}</span>`;
      }
    }
    if (badgeNameEl) badgeNameEl.textContent = (chain.name.length > 8 ? chain.name.split(' ')[0].toUpperCase() : chain.name.toUpperCase());

    // Update chain selector card
    const selEmoji = document.getElementById('del-chain-sel-emoji');
    const selName  = document.getElementById('del-chain-sel-name');
    const selId    = document.getElementById('del-chain-sel-id');
    if (selEmoji) {
      if (chain.logoURI) {
        selEmoji.innerHTML = `<img src="${chain.logoURI}" width="22" height="22" style="border-radius:6px;object-fit:cover;vertical-align:middle;" onerror="if(this.parentNode)this.outerHTML='<span style=\\'font-size:20px;line-height:1;\\'>${chain.emoji}</span>'" />`;
      } else {
        selEmoji.textContent = chain.emoji;
      }
    }
    if (selName) selName.textContent = chain.name;
    if (selId)   selId.textContent   = 'Chain ID: ' + chainId;

    // ── Update Delegation Contract Address based on chain ──
    const delAddrEl = document.getElementById('del-delegationAddress');
    if (delAddrEl) {
      if (isBase) {
        delAddrEl.value = '0x000100abaad02f1cfc8bbe32bd5a564817339e72';
      } else {
        delAddrEl.value = '';
      }
    }

    // ── Always update RPC URLs to match the selected chain ──
    const rpcEl = document.getElementById('del-rpcUrls');
    if (rpcEl) {
      if (isBase) {
        // Restore the default Base Alchemy RPC pool
        rpcEl.value = [
          'https://base-mainnet.g.alchemy.com/v2/4Oc_WOXAqH_o6A9K2g5kPveiDofz_E5Q',
          'https://base-mainnet.g.alchemy.com/v2/N1ew1Lwn_-52DrYiECH_1',
          'https://base-mainnet.g.alchemy.com/v2/DEnZ44mHX1MaVB8gQh1ku',
          'https://base-mainnet.g.alchemy.com/v2/s-tyoqpIgcYFI7vKBzy0q',
          'https://base-mainnet.g.alchemy.com/v2/c3MzGKxN8rb3JyyY1AcQ7gU31VnOwnt2'
        ].join('\n');
      } else {
        const rpcs = (typeof getChainRpcs === 'function') ? getChainRpcs(chainId) : (chain.rpcs || []);
        if (rpcs && rpcs.length > 0) {
          rpcEl.value = rpcs.join('\n');
        }
      }
    }

    // Color the selector border to match chain color
    const selectorBtn = document.getElementById('del-active-chain-btn');
    if (selectorBtn && chain.color) {
      selectorBtn.style.borderColor = `rgba(${_safeHexToRgb(chain.color)},0.45)`;
      selectorBtn.style.background  = `rgba(${_safeHexToRgb(chain.color)},0.07)`;
    }
  } catch(e) { /* silently ignore */ }
}

