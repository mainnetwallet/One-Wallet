// Toggle "more chains" section in the add modal
function _tmCcpToggleMoreChains() {
  const hidden = document.getElementById('tm-ccp-hidden-chains');
  const btn    = document.getElementById('tm-ccp-more-btn');
  const icon   = document.getElementById('tm-ccp-more-icon');
  const label  = document.getElementById('tm-ccp-more-label');
  if (!hidden) return;
  const isOpen = hidden.style.display !== 'none';
  hidden.style.display = isOpen ? 'none' : 'block';
  if (icon)  icon.style.transform  = isOpen ? '' : 'rotate(180deg)';
  if (label) label.textContent      = isOpen ? label.textContent.replace('Show less', 'Show') + '' : label.textContent.replace(/Show \d+ more chains/, 'Show less');
  // Smooth scroll to reveal
  if (!isOpen) setTimeout(() => { btn && btn.scrollIntoView({ behavior:'smooth', block:'nearest' }); }, 80);
}

function _buildChainContractRow(chainDef, contractAddr, decimals, coin, color, alreadyAdded) {
  const chainId = chainDef.chainId;
  const hasContract = contractAddr && contractAddr.length === 42 && contractAddr.startsWith('0x');
  const shortContract = hasContract
    ? contractAddr.slice(0,8) + '…' + contractAddr.slice(-6)
    : 'No contract — tap to enter';
  const rowId = 'tmccp-' + chainDef.id + '-' + (coin.id || '');
  const inputRowId = 'tmccp-input-' + chainDef.id + '-' + (coin.id || '');

  // If no contract, clicking expands an input row instead of adding directly
  const clickHandler = alreadyAdded
    ? ''
    : hasContract
      ? `_addTokenOnChain('${chainId}','${contractAddr}',${decimals},'${(coin.id||'').replace(/'/g,"\\'")}','${(coin.name||'').replace(/'/g,"\\'")}','${(coin.symbol||'').replace(/'/g,"\\'")}','${(coin.thumb||'').replace(/'/g,"\\'")}','${color}')`
      : `_toggleContractInput('${inputRowId}')`;

  const inputRow = (!alreadyAdded && !hasContract) ? `
    <div id="${inputRowId}" style="display:none;overflow:hidden;max-height:0;opacity:0;padding:0 14px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.3);border-top:none;border-radius:0 0 14px 14px;margin-top:-10px;margin-bottom:8px;box-shadow:0 4px 16px rgba(245,158,11,0.08);transition:max-height 0.32s cubic-bezier(0.4,0,0.2,1),opacity 0.25s ease,padding 0.25s ease;">
      <div style="padding-top:12px;padding-bottom:14px;">
        <div style="font-size:9px;color:var(--accent-amber);font-family:var(--font-mono);font-weight:700;letter-spacing:1.5px;margin-bottom:8px;display:flex;align-items:center;gap:5px;">
          <span class="material-icons-round" style="font-size:12px;">link</span>
          CONTRACT ADDRESS — ${chainDef.name.toUpperCase()}
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <input id="${inputRowId}-addr" type="text" placeholder="0x… paste address"
            style="flex:1;background:rgba(245,158,11,0.07);border:1px solid rgba(245,158,11,0.35);border-radius:9px;padding:9px 10px;font-family:var(--font-mono);font-size:11px;color:var(--text-primary);outline:none;-webkit-appearance:none;transition:border-color 0.2s,box-shadow 0.2s;"
            onfocus="this.style.borderColor='rgba(245,158,11,0.65)';this.style.boxShadow='0 0 0 2px rgba(245,158,11,0.13)'"
            onblur="this.style.borderColor='rgba(245,158,11,0.35)';this.style.boxShadow=''"
            oninput="_onManualContractInput('${inputRowId}')"
            autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />
          <div id="${inputRowId}-btn" onclick="_addTokenOnChainManual('${chainId}','${inputRowId}',${decimals},'${(coin.id||'').replace(/'/g,"\\'")}','${(coin.name||'').replace(/'/g,"\\'")}','${(coin.symbol||'').replace(/'/g,"\\'")}','${(coin.thumb||'').replace(/'/g,"\\'")}','${color}')"
            style="padding:9px 16px;border-radius:9px;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.4);font-size:10px;font-weight:800;color:var(--accent-amber);font-family:var(--font-mono);cursor:pointer;opacity:0.4;pointer-events:none;white-space:nowrap;transition:all 0.2s;letter-spacing:1px;">
            ADD
          </div>
        </div>
        <div id="${inputRowId}-status" style="font-size:9px;font-family:var(--font-mono);color:var(--text-muted);margin-top:6px;min-height:13px;"></div>
      </div>
    </div>
  ` : '';

  return `<div id="${rowId}" onclick="${clickHandler}"
    style="display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:${!alreadyAdded && !hasContract ? '14px 14px 0 0' : '14px'};background:var(--bg-glass);border:1px solid ${alreadyAdded ? 'rgba(16,185,129,0.4)' : 'var(--border-subtle)'};cursor:${alreadyAdded ? 'default' : 'pointer'};transition:all 0.2s;margin-bottom:${!alreadyAdded && !hasContract ? '0' : '8px'};${alreadyAdded ? 'opacity:0.7;' : ''}"
    onmousedown="if(!${!!alreadyAdded})this.style.opacity='.7'" onmouseup="this.style.opacity='1'"
    ontouchstart="if(!${!!alreadyAdded})this.style.opacity='.7'" ontouchend="this.style.opacity='1'">
    <div style="font-size:22px;width:36px;text-align:center;">${chainDef.emoji}</div>
    <div style="flex:1;min-width:0;">
      <div style="font-size:13px;font-weight:700;">${chainDef.name}</div>
      <div style="font-size:10px;color:${hasContract ? 'var(--text-muted)' : 'var(--accent-amber)'};font-family:var(--font-mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${shortContract}</div>
    </div>
    ${alreadyAdded
      ? `<div style="font-size:9px;font-weight:700;color:var(--accent-green);font-family:var(--font-mono);background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);padding:3px 8px;border-radius:6px;">ADDED</div>`
      : hasContract
        ? `<div style="padding:5px 12px;border-radius:10px;background:rgba(99,102,241,0.18);border:1px solid rgba(99,102,241,0.35);font-size:10px;font-weight:700;color:var(--neon-purple);font-family:var(--font-mono);">ADD</div>`
        : `<div id="${inputRowId}-enterbadge" style="padding:5px 10px;border-radius:10px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.3);font-size:10px;font-weight:700;color:var(--accent-amber);font-family:var(--font-mono);display:flex;align-items:center;gap:4px;"><span class="material-icons-round" style="font-size:11px;">edit</span>ENTER</div>`
    }
  </div>${inputRow}`;
}

function _toggleContractInput(inputRowId) {
  const row = document.getElementById(inputRowId);
  if (!row) return;
  const isOpen = row.dataset.open === '1';
  if (!isOpen) {
    // Open: expand
    row.style.display = 'block';
    row.dataset.open = '1';
    // Force reflow for transition
    row.offsetHeight;
    row.style.maxHeight = '120px';
    row.style.opacity = '1';
    row.style.padding = '0 14px';
    setTimeout(() => {
      const inp = document.getElementById(inputRowId + '-addr');
      if (inp) inp.focus();
    }, 150);
  } else {
    // Close: collapse
    row.dataset.open = '0';
    row.style.maxHeight = '0';
    row.style.opacity = '0';
    row.style.padding = '0 14px';
    setTimeout(() => { row.style.display = 'none'; }, 320);
  }
}

function _onManualContractInput(inputRowId) {
  const inp = document.getElementById(inputRowId + '-addr');
  const btn = document.getElementById(inputRowId + '-btn');
  const status = document.getElementById(inputRowId + '-status');
  if (!inp) return;
  const val = inp.value.trim();
  const isValid = /^0x[0-9a-fA-F]{40}$/.test(val);
  if (btn) {
    btn.style.opacity = isValid ? '1' : '0.4';
    btn.style.pointerEvents = isValid ? 'auto' : 'none';
  }
  if (status) {
    if (val.length > 2 && !isValid) { status.textContent = '⚠️ Incomplete address…'; status.style.color = 'var(--accent-amber)'; }
    else if (isValid) { status.textContent = '✓ Valid format — tap ADD'; status.style.color = 'var(--accent-green)'; }
    else { status.textContent = ''; }
  }
}

async function _addTokenOnChainManual(chainId, inputRowId, decimals, cgId, name, symbol, logoUrl, color) {
  chainId = Number(chainId);
  decimals = Number(decimals) || 18;
  const inp = document.getElementById(inputRowId + '-addr');
  const status = document.getElementById(inputRowId + '-status');
  const btn = document.getElementById(inputRowId + '-btn');
  if (!inp) return;
  const contractAddr = inp.value.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(contractAddr)) return;

  // Disable button while processing
  if (btn) { btn.style.opacity = '0.5'; btn.style.pointerEvents = 'none'; }
  if (status) { status.innerHTML = '<span class="del-spinner" style="width:9px;height:9px;border-width:2px;margin-right:5px;display:inline-block;vertical-align:middle;"></span>Verifying contract via RPC…'; status.style.color = 'var(--accent-amber)'; }

  // ── RPC contract verification (REQUIRED) ──
  let meta = null;
  try {
    const rpcList = _getRpcListForChain(chainId);
    meta = await _readTokenMeta(contractAddr, rpcList);
  } catch(e) {
    meta = null;
  }

  // If contract not found on this chain — BLOCK add
  if (!meta || !meta.symbol) {
    if (status) {
      status.innerHTML = '❌ Contract not found on this chain. Try a different address.';
      status.style.color = 'var(--accent-red)';
    }
    if (btn) { btn.style.opacity = '1'; btn.style.pointerEvents = 'auto'; }
    // Shake the input to give visual feedback
    if (inp) {
      inp.style.transition = 'border-color 0.2s ease';
      inp.style.borderColor = 'rgba(244,63,94,0.7)';
      setTimeout(() => { inp.style.borderColor = ''; }, 1800);
    }
    return;
  }

  // Use RPC-fetched symbol/name
  if (!name || name === symbol) name = meta.name || name;
  symbol = meta.symbol.toUpperCase() || symbol;
  decimals = meta.decimals || decimals;

  // Check already added
  const existing = (typeof loadSavedTokens === 'function')
    ? loadSavedTokens().find(t => t.cgId === cgId && t.chainId === chainId) : null;
  if (existing) {
    if (status) { status.textContent = '⚠️ Already added on this chain!'; status.style.color = 'var(--accent-amber)'; }
    if (btn) { btn.style.opacity = '1'; btn.style.pointerEvents = 'auto'; }
    return;
  }

  if (!logoUrl || logoUrl === 'undefined') logoUrl = null;
  const uniqueId = (cgId || ('custom-' + contractAddr.slice(2,10))) + '-chain' + chainId;

  addToken({
    id: uniqueId,
    name: name || symbol,
    sub: symbol,
    icon: symbol.slice(0,2).toUpperCase(),
    color, badge: color,
    contract: contractAddr,
    decimals,
    cgId: cgId || null,
    chainId,
    cbPair: symbol + '-USD',
    logoUrl,
    isDefault: false,
    isCustomContract: true,
  });

  if (status) { status.textContent = '✅ ' + symbol + ' added!'; status.style.color = 'var(--accent-green)'; }

  // Hide the input expansion row
  const inputExpandRow = document.getElementById(inputRowId);
  if (inputExpandRow) inputExpandRow.style.display = 'none';

  // Replace ENTER badge → ADDED badge directly by ID
  const enterBadge = document.getElementById(inputRowId + '-enterbadge');
  if (enterBadge) {
    enterBadge.outerHTML = `<div style="font-size:9px;font-weight:700;color:var(--accent-green);font-family:var(--font-mono);background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);padding:3px 8px;border-radius:6px;">ADDED</div>`;
  }

  // Update chain row styling
  const chainRowId = inputRowId.replace('tmccp-input-', 'tmccp-');
  const chainRow = document.getElementById(chainRowId);
  if (chainRow) {
    chainRow.onclick = null;
    chainRow.onmousedown = null;
    chainRow.ontouchstart = null;
    chainRow.style.borderColor = 'rgba(16,185,129,0.4)';
    chainRow.style.opacity = '0.7';
    chainRow.style.cursor = 'default';
    chainRow.style.borderRadius = '14px';
  }
}

function _addTokenOnChain(chainId, contractAddr, decimals, cgId, name, symbol, logoUrl, color) {
  chainId = Number(chainId);
  decimals = Number(decimals) || 18;
  if (!contractAddr || contractAddr === 'undefined') contractAddr = null;
  if (!logoUrl || logoUrl === 'undefined') logoUrl = null;

  // Wallet guard
  const _atGroups = (typeof loadWalletGroups === 'function') ? loadWalletGroups() : [];
  if (!_atGroups || _atGroups.length === 0) {
    showToast('Please add a wallet first!', 'account_balance_wallet');
    return;
  }

  // Check already added
  const existing = (typeof loadSavedTokens === 'function')
    ? loadSavedTokens().find(t => t.cgId === cgId && t.chainId === chainId) : null;
  if (existing) {
    showToast('Already added on this chain!', 'check_circle');
    return;
  }

  const uniqueId = cgId + '-chain' + chainId;
  addToken({
    id: uniqueId,
    name,
    sub: symbol,
    icon: symbol.slice(0,2).toUpperCase(),
    color,
    badge: color,
    contract: contractAddr || null,
    decimals,
    cgId,
    chainId,
    cbPair: symbol + '-USD',
    logoUrl,
    isDefault: false,
  });

  // Update the row to ADDED state
  const row = document.getElementById('tmccp-' + (getAllChains().find(c => c.chainId === chainId)?.id || '') + '-' + cgId);
  if (row) {
    row.style.borderColor = 'rgba(16,185,129,0.4)';
    row.style.opacity = '0.7';
    row.style.cursor = 'default';
    row.onclick = null;
    const addBtn = row.querySelector('div:last-child');
    if (addBtn) if(addBtn.parentNode)addBtn.outerHTML = `<div style="font-size:9px;font-weight:700;color:var(--accent-green);font-family:var(--font-mono);background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);padding:3px 8px;border-radius:6px;">ADDED</div>`;
  }
}

function _closeTmChainContractModal() {
  const overlay = document.getElementById('tm-chain-contract-overlay');
  if (!overlay) return;
  const modal = document.getElementById('tm-ccp-modal');
  if (modal) modal.style.transform = 'translateY(100%)';
  setTimeout(() => { overlay.remove(); }, 320);
}

