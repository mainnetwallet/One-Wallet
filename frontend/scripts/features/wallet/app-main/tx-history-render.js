
function txhFmtAmt(v) {
  const n = parseFloat(v);
  if (!n || !isFinite(n) || n <= 0) return String(v || 0);
  if (n >= 1e6)  return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3)  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1)    return parseFloat(n.toPrecision(6)).toString();
  if (n >= 1e-4) return parseFloat(n.toPrecision(4)).toString();
  return n.toExponential(2);
}

function formatTxTime(ts) {
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
  return new Date(ts).toLocaleDateString();
}

function formatTxDate(ts) {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'TODAY';
  if (d.toDateString() === yesterday.toDateString()) return 'YESTERDAY';
  return d.toLocaleDateString('en-US', {month:'short', day:'numeric'}).toUpperCase();
}

function renderTxHistory() {
  const txs = loadTxHistory();
  const body = document.getElementById('txh-body');
  const badge = document.getElementById('txh-count-badge');
  if (badge) badge.textContent = txs.length + ' TX' + (txs.length !== 1 ? 'S' : '');

  // ── Chain logo helper for txh pills ──
  function txhChainLogoHtml(chainId, size) {
    size = size || 14;
    var slug = (typeof TW_CHAIN_SLUG !== 'undefined' && TW_CHAIN_SLUG[chainId]) || null;
    if (!slug) {
      // extra slugs not in TW_CHAIN_SLUG
      var extra = {250:'fantom',42220:'celo',100:'xdai',1101:'polygonzkevm',5000:'mantle',8217:'kaia'};
      slug = extra[chainId] || null;
    }
    if (!slug) return '';
    var url = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/' + slug + '/info/logo.png';
    return '<img src="' + url + '" class="txh-chain-logo-img" style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;object-fit:cover;flex-shrink:0;vertical-align:middle;" onerror="this.style.display=&quot;none&quot;" loading="lazy">';
  }

  // ── Explorer URL resolver (uses BR_EXPLORERS + getAllChains fallback) ──
  function getExplorerUrl(chainId, hash) {
    if (!hash || hash.length < 10) return null;
    // 1. Try BR_EXPLORERS map (defined in bridge section)
    const brMap = (typeof BR_EXPLORERS !== 'undefined') ? BR_EXPLORERS : {};
    if (chainId && brMap[chainId]) return brMap[chainId] + hash;
    // 2. Try getAllChains explorer field
    if (chainId && typeof getAllChains === 'function') {
      const c = getAllChains().find(c => c.chainId === chainId);
      if (c && (c.explorer || c.blockExplorer)) return (c.explorer || c.blockExplorer) + '/tx/' + hash;
    }
    // 3. Known defaults
    const FALLBACK = {
      1: 'https://etherscan.io/tx/', 8453: 'https://basescan.org/tx/',
      42161: 'https://arbiscan.io/tx/', 10: 'https://optimistic.etherscan.io/tx/',
      137: 'https://polygonscan.com/tx/', 56: 'https://bscscan.com/tx/',
      43114: 'https://snowtrace.io/tx/', 59144: 'https://lineascan.build/tx/',
      534352: 'https://scrollscan.com/tx/', 324: 'https://explorer.zksync.io/tx/',
    };
    if (chainId && FALLBACK[chainId]) return FALLBACK[chainId] + hash;
    // 4. Swap fallback → Base
    if (!chainId) return 'https://basescan.org/tx/' + hash;
    return null;
  }

  function getChainName(chainId, fallback) {
    if (!chainId) return fallback || 'Base';
    if (typeof getAllChains === 'function') {
      const c = getAllChains().find(c => c.chainId === chainId);
      if (c) return c.name;
    }
    const NAMES = {1:'Ethereum',8453:'Base',42161:'Arbitrum',10:'Optimism',137:'Polygon',56:'BSC',43114:'Avalanche',59144:'Linea',534352:'Scroll',324:'zkSync'};
    return NAMES[chainId] || fallback || ('Chain ' + chainId);
  }

  if (txs.length === 0) {
    body.innerHTML = `
      <div class="txh-toolbar">
        <div class="txh-info-text">📋 TRANSACTION HISTORY</div>
      </div>
      <div class="txh-empty">
        <div class="txh-empty-icon">
          <span class="material-icons-round">receipt_long</span>
        </div>
        <div class="txh-empty-title">No Transactions Yet</div>
        <div class="txh-empty-sub">Swaps, sends &amp; bridges appear here.</div>
      </div>`;
    return;
  }

  // Group by date
  const groups = {};
  txs.forEach(tx => {
    const label = formatTxDate(tx.timestamp);
    if (!groups[label]) groups[label] = [];
    groups[label].push(tx);
  });

  let html = `
    <div class="txh-toolbar">
      <div class="txh-info-text">📋 ${txs.length} TX${txs.length !== 1 ? 'S' : ''}</div>
    </div>`;

  for (const [dateLabel, group] of Object.entries(groups)) {
    html += `<div class="txh-day-label">${dateLabel}</div>`;

    group.forEach(tx => {
      const isBridge  = tx.type === 'bridge';
      const isSend    = tx.type === 'send' || (!isBridge && tx.type !== 'swap' && !!tx.wallet);
      const isPending = tx.pendingRecv === true;
      const isFailed  = tx.failed === true;
      const iconClass = tx.isDry ? 'dry' : (isPending ? 'pending' : (isFailed ? 'failed' : 'success'));
      const iconName  = tx.isDry ? 'science'
                      : isPending ? 'hourglass_top'
                      : isFailed  ? 'error_outline'
                      : isBridge  ? 'alt_route'
                      : 'check_circle';

      // Status badge
      const statusKey   = tx.isDry ? 'dry-run' : (isPending ? 'pending' : (isFailed ? 'failed' : 'confirmed'));
      const statusLabel = tx.isDry ? 'DRY RUN' : (isPending ? 'PENDING'  : (isFailed ? 'FAILED'  : 'CONFIRMED'));
      const statusIcon  = tx.isDry ? 'science' : (isPending ? 'hourglass_top' : (isFailed ? 'error_outline' : 'check_circle'));

      // Item class
      const itemClass = tx.isDry ? 'txh-dry' : (isPending ? 'txh-pending' : (isFailed ? 'txh-failed' : 'txh-success'));

      // Short hash helper
      const short = h => h ? h.slice(0,2) + '…' + h.slice(-4) : null;

      // Explorer URLs
      const fromChainId = tx.fromChainId || tx.chainId || (!isBridge ? 8453 : null);
      const toChainId   = tx.toChainId || null;
      const srcUrl  = getExplorerUrl(fromChainId, tx.hash);
      const recvUrl = getExplorerUrl(toChainId,   tx.recvHash);

      // Chain pills
      let chainPillsHtml = '';
      if (isBridge) {
        const fromName = getChainName(tx.fromChainId, tx.fromChain);
        const toName   = getChainName(tx.toChainId,   tx.toChain);
        const fromClick = srcUrl  ? `onclick="event.stopPropagation();window.open('${srcUrl}','_blank','noopener');showToast('Opening sender TX','open_in_new');"` : '';
        const toClick   = recvUrl ? `onclick="event.stopPropagation();window.open('${recvUrl}','_blank','noopener');showToast('Opening receiver TX','open_in_new');"` : '';

        // Sender hash chip
        const senderChip = short(tx.hash)
          ? `<span class="txh-hash-chip" ${srcUrl && !tx.isDry ? `onclick="event.stopPropagation();window.open('${srcUrl}','_blank','noopener');showToast('Opening TX','open_in_new');"` : ''}>
               <span class="material-icons-round" style="font-size:9px;">${srcUrl && !tx.isDry ? 'open_in_new' : 'tag'}</span>${short(tx.hash)}
             </span>`
          : '';

        // Receiver chip or pending badge
        const receiverChip = isPending && !short(tx.recvHash)
          ? `<span class="txh-hash-chip txh-pending-badge" style="cursor:default;background:rgba(245,158,11,0.10);color:var(--accent-amber);border:1px solid rgba(245,158,11,0.22);pointer-events:none;">
               <span class="material-icons-round" style="font-size:9px;animation:spin 1.4s linear infinite;">sync</span>PENDING
             </span>`
          : short(tx.recvHash) && recvUrl
            ? `<span class="txh-hash-chip recv-chip" onclick="event.stopPropagation();window.open('${recvUrl}','_blank','noopener');showToast('Opening receiver TX','open_in_new');">
                 <span class="material-icons-round" style="font-size:9px;">open_in_new</span>${short(tx.recvHash)}
               </span>`
            : short(tx.recvHash)
              ? `<span class="txh-hash-chip recv-chip"><span class="material-icons-round" style="font-size:9px;">tag</span>${short(tx.recvHash)}</span>`
              : '';

        chainPillsHtml = `
          <div class="txh-bridge-cols">
            <div class="txh-bridge-col">
              <span class="txh-chain-pill from-pill" ${fromClick}>
                ${txhChainLogoHtml(tx.fromChainId, 12)}
                ${fromName}
              </span>
              ${senderChip}
            </div>
            <span class="txh-bridge-arrow" style="flex-shrink:0;">→</span>
            <div class="txh-bridge-col">
              <span class="txh-chain-pill to-pill" ${toClick}>
                ${txhChainLogoHtml(tx.toChainId, 12)}
                ${toName}
              </span>
              ${receiverChip}
            </div>
          </div>`;
      } else {
        const chainName = getChainName(fromChainId, 'Base');
        chainPillsHtml = `
          <div class="txh-chain-row">
            <span class="txh-chain-pill swap-pill">
              ${txhChainLogoHtml(fromChainId, 12)}
              ${chainName}
            </span>
          </div>`;
      }

      // Hash chips (non-bridge only; bridge hashes are embedded in chainPillsHtml cols)
      let hashChipsHtml = '';
      if (!isBridge) {
        if (short(tx.hash)) {
          const clickAttr = srcUrl && !tx.isDry
            ? `onclick="event.stopPropagation();window.open('${srcUrl}','_blank','noopener');showToast('Opening TX','open_in_new');"`
            : `onclick="event.stopPropagation();${tx.isDry ? "showToast('Dry run — no real TX','science');" : ''}"`;
          hashChipsHtml += `<span class="txh-hash-chip" ${clickAttr}>
            <span class="material-icons-round">${srcUrl && !tx.isDry ? 'open_in_new' : 'tag'}</span>${short(tx.hash)}
          </span>`;
        }
        if (isPending && !short(tx.recvHash)) {
          hashChipsHtml += `<span class="txh-hash-chip txh-pending-badge" style="cursor:default;background:rgba(245,158,11,0.10);color:var(--accent-amber);border:1px solid rgba(245,158,11,0.22);pointer-events:none;">
            <span class="material-icons-round" style="font-size:9px;animation:spin 1.4s linear infinite;">sync</span>PENDING
          </span>`;
        } else if (short(tx.recvHash) && recvUrl) {
          hashChipsHtml += `<span class="txh-hash-chip recv-chip" onclick="event.stopPropagation();window.open('${recvUrl}','_blank','noopener');showToast('Opening receiver TX','open_in_new');">
            <span class="material-icons-round">open_in_new</span>${short(tx.recvHash)}
          </span>`;
        } else if (short(tx.recvHash) && !recvUrl) {
          hashChipsHtml += `<span class="txh-hash-chip recv-chip">
            <span class="material-icons-round">tag</span>${short(tx.recvHash)}
          </span>`;
        }
      }

      // Wallet chip — group name + wallet index + swap/bridge count for this wallet
      let walletChip = '';
      if (tx.walletIndex) {
        // Resolve group name from localStorage
        let _grpName = '';
        try {
          const _groups = (typeof loadWalletGroups === 'function') ? loadWalletGroups() : [];
          const _activeGrpId = localStorage.getItem('one_hw_group_id_v2') || localStorage.getItem('one_active_group') || '';
          // Try to find group by groupId stored on tx, else fallback to active group
          const _txGrpId = tx.groupId || _activeGrpId;
          const _grp = _groups.find(g => g.id === _txGrpId) || (_groups.length === 1 ? _groups[0] : null);
          if (_grp && _grp.name) _grpName = _grp.name;
        } catch(_e) {}

        // Count swap+bridge txs from same walletIndex (and same groupId if available)
        const _wIdx = tx.walletIndex;
        const _wGrpId = tx.groupId || null;
        const _grpLabel = _grpName
          ? `<span class="twc-grp" title="${_grpName}">${_grpName}</span><span class="twc-sep">·</span>`
          : '';
        walletChip = `<span class="txh-wallet-chip"><span class="material-icons-round">account_balance_wallet</span>${_grpLabel}<span class="twc-widx">W${_wIdx}</span></span>`;
      }

      html += `
        <div class="txh-item ${itemClass}">
          <div class="txh-item-icon ${iconClass}">
            <span class="material-icons-round">${iconName}</span>
          </div>
          <div class="txh-item-info">
            ${isSend ? `
              <div class="txh-item-pair txh-sent-label">${tx.pair || 'Transfer'}</div>
              <div class="txh-hash-row txh-send-row">${chainPillsHtml}${hashChipsHtml}</div>
            ` : isBridge ? `
              <div class="txh-type-tag txh-bridge-tag" style="margin-bottom:6px;">Bridge</div>
              <div class="txh-bridge-amounts">
                ${(() => {
                  const p = (tx.pair||'').split(' → ');
                  const fromAmt = tx.fromAmt ? txhFmtAmt(tx.fromAmt) : (p[0] || '—');
                  const fromSym = tx.fromAmt ? (tx.fromToken || '') : '';
                  const toAmt   = tx.toAmt   ? txhFmtAmt(tx.toAmt)   : (p[1] || '—');
                  const toSym   = tx.toAmt   ? (tx.toToken   || '') : '';
                  return `<span><span class="bamt-num">${fromAmt}</span>${fromSym ? ` <span class="bamt-sym">${fromSym}</span>` : ''}</span><span class="txh-bridge-amt-arrow">→</span><span><span class="bamt-num">${toAmt}</span>${toSym ? ` <span class="bamt-sym">${toSym}</span>` : ''}</span>`;
                })()}
              </div>
              <div class="txh-hash-row txh-send-row">${chainPillsHtml}${hashChipsHtml}</div>
            ` : `
              <div class="txh-type-tag txh-swap-tag">Swap</div>
              <div class="txh-item-pair">${tx.pair || '—'}</div>
              <div class="txh-hash-row txh-send-row">
                ${chainPillsHtml}
                ${statusKey !== 'confirmed' ? `<span class="txh-status-badge ${statusKey}"><span class="material-icons-round" style="font-size:9px;">${statusIcon}</span>${statusLabel}</span>` : ''}
                ${hashChipsHtml}
              </div>
            `}
          </div>
          <div class="txh-item-right">
            <div class="txh-item-time">${formatTxTime(tx.timestamp)}</div>
            ${walletChip ? walletChip : ''}
          </div>
        </div>`;
    });
  }

  html += ``;
  if (body) body.innerHTML = html;
}

// Init badge on load
updateTxMenuBadge();