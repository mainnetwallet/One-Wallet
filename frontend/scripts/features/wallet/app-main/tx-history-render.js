
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

  const controls = document.getElementById('txh-controls');
  if (controls) controls.style.display = txs.length === 0 ? 'none' : '';

  if (txs.length === 0) {
    body.innerHTML = `
      <div class="txh-empty">
        <div class="txh-empty-icon">
          <span class="material-icons-round">receipt_long</span>
        </div>
        <div class="txh-empty-title">No transactions yet</div>
        <div class="txh-empty-sub">Swaps, sends and bridges appear here.</div>
      </div>`;
    return;
  }

  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const short = h => h ? h.slice(0,2) + '…' + h.slice(-4) : null;

  // ── Classify every tx once ──
  const items = txs.map((tx, idx) => {
    const isBridge = tx.type === 'bridge';
    const isSend   = tx.type === 'send' || (!isBridge && tx.type !== 'swap' && !!tx.wallet);
    const kind     = isBridge ? 'bridge' : (isSend ? 'send' : 'swap');
    const status   = tx.isDry ? 'dry-run' : (tx.pendingRecv === true ? 'pending' : (tx.failed === true ? 'failed' : 'confirmed'));
    return { tx, idx, kind, status, key: String(tx.id || ('i' + idx)) };
  });

  const counts = { all: items.length, swap: 0, send: 0, bridge: 0, pending: 0, failed: 0 };
  items.forEach(it => {
    counts[it.kind]++;
    if (it.status === 'pending') counts.pending++;
    if (it.status === 'failed')  counts.failed++;
  });

  const filter = window._txhFilter || 'all';
  const query  = (window._txhQuery || '').trim().toLowerCase();

  // ── Chips ──
  const chipsEl = document.getElementById('txh-chips');
  if (chipsEl) {
    const defs = [['all','All'],['swap','Swap'],['send','Send'],['bridge','Bridge'],['pending','Pending'],['failed','Failed']];
    chipsEl.innerHTML = defs.map(d =>
      `<div class="txh-chip ${filter === d[0] ? 'on' : ''}" onclick="txhSetFilter('${d[0]}')">${d[1]} <b>${counts[d[0]]}</b></div>`
    ).join('');
  }

  // ── Filter + search ──
  const visible = items.filter(it => {
    if (filter === 'pending' && it.status !== 'pending') return false;
    if (filter === 'failed'  && it.status !== 'failed')  return false;
    if ((filter === 'swap' || filter === 'send' || filter === 'bridge') && it.kind !== filter) return false;
    if (query) {
      const t = it.tx;
      const hay = [t.pair, t.hash, t.recvHash, t.fromToken, t.toToken, t.fromChain, t.toChain, t.wallet, t.dex].join(' ').toLowerCase();
      if (hay.indexOf(query) === -1) return false;
    }
    return true;
  });

  // ── Summary ──
  const weekAgo = Date.now() - 7 * 86400000;
  const weekCount = items.filter(it => it.tx.timestamp >= weekAgo).length;
  let html = `
    <div class="txh-sum">
      <div class="txh-sum-i"><span>This week</span><div>${weekCount} tx${weekCount !== 1 ? 's' : ''}</div></div>
      <div class="txh-sum-i"><span>Pending</span><div>${counts.pending}</div></div>
    </div>`;

  if (visible.length === 0) {
    html += `
      <div class="txh-empty">
        <div class="txh-empty-icon"><span class="material-icons-round">search_off</span></div>
        <div class="txh-empty-title">No matching transactions</div>
        <div class="txh-empty-sub">Try another filter or search.</div>
      </div>`;
    body.innerHTML = html;
    return;
  }

  // ── Group by day ──
  const groups = {};
  visible.forEach(it => {
    const label = formatTxDate(it.tx.timestamp);
    (groups[label] = groups[label] || []).push(it);
  });

  const openMap = window._txhOpen || (window._txhOpen = {});
  const STATUS_LABEL = { 'confirmed': 'CONFIRMED', 'pending': 'PENDING', 'failed': 'FAILED', 'dry-run': 'DRY RUN' };
  const KIND_LABEL   = { swap: 'Swap', send: 'Sent', bridge: 'Bridge' };
  const KIND_ICON    = { swap: 'swap_horiz', send: 'north_east', bridge: 'alt_route' };

  function detailRow(label, hash, url) {
    if (!hash) return '';
    const acts = `<span class="txh-acts">
        <span class="txh-act" data-hash="${esc(hash)}" onclick="event.stopPropagation();txhCopyHash(this)"><span class="material-icons-round">content_copy</span></span>
        ${url ? `<span class="txh-act" data-url="${esc(url)}" onclick="event.stopPropagation();txhOpenUrl(this)"><span class="material-icons-round">open_in_new</span></span>` : ''}
      </span>`;
    return `<div class="txh-dr"><span>${label}</span><span style="display:flex;align-items:center;gap:6px;"><code>${esc(short(hash))}</code>${acts}</span></div>`;
  }

  for (const [dateLabel, group] of Object.entries(groups)) {
    html += `<div class="txh-day"><span>${dateLabel}</span><span>${group.length} TX${group.length !== 1 ? 'S' : ''}</span></div>`;

    group.forEach(it => {
      const tx = it.tx, kind = it.kind, status = it.status;
      const isBridge = kind === 'bridge', isSend = kind === 'send';
      const isPending = status === 'pending', isFailed = status === 'failed';

      const fromChainId = tx.fromChainId || tx.chainId || (!isBridge ? 8453 : null);
      const toChainId   = tx.toChainId || null;
      const fromName = getChainName(isBridge ? tx.fromChainId : fromChainId, isBridge ? tx.fromChain : 'Base');
      const toName   = getChainName(tx.toChainId, tx.toChain);
      const srcUrl  = tx.isDry ? null : getExplorerUrl(fromChainId, tx.hash);
      const recvUrl = getExplorerUrl(toChainId, tx.recvHash);

      const fromAmt = tx.fromAmt ? txhFmtAmt(tx.fromAmt) : null;
      const toAmt   = tx.toAmt   ? txhFmtAmt(tx.toAmt)   : null;
      const fromSym = tx.fromToken || '';
      const toSym   = tx.toToken   || '';
      const pairParts = (tx.pair || '').split(' → ');

      // Sub line
      let sub;
      if (isBridge)      sub = `${esc(fromName)} → ${esc(toName)}`;
      else if (isSend)   sub = `To ${esc(pairParts[1] || '—')} · ${esc(fromName)}`;
      else               sub = `${esc(fromSym || pairParts[0] || '—')} → ${esc(toSym || pairParts[1] || '—')} · ${esc(fromName)}`;
      sub += ` · ${formatTxTime(tx.timestamp)}`;

      // Right-hand amounts
      let a1 = '', a2 = '', a1cls = '';
      if (isSend) {
        a1 = fromAmt ? `-${fromAmt} ${esc(fromSym)}` : esc(pairParts[0] || tx.pair || '—');
      } else if (isFailed) {
        a1 = fromAmt ? `-${fromAmt} ${esc(fromSym)}` : esc(tx.pair || '—');
      } else if (isPending && isBridge) {
        a1 = fromAmt ? `-${fromAmt} ${esc(fromSym)}` : esc(tx.pair || '—');
        a2 = toAmt ? `≈ ${toAmt} ${esc(toSym)}` : '';
      } else if (toAmt) {
        a1 = `+${toAmt} ${esc(toSym)}`; a1cls = 'pos';
        a2 = fromAmt ? `-${fromAmt} ${esc(fromSym)}` : '';
      } else {
        a1 = esc(tx.pair || '—');
      }

      // Pending / failed notes
      let note = '';
      if (isPending) {
        note = `<div class="txh-prog"><i></i></div><div class="txh-prog-t">Waiting for funds on ${esc(toName)}</div>`;
      } else if (isFailed) {
        note = `<div class="txh-err">${esc(tx.failReason || tx.error || 'Transaction failed')}</div>`;
      }

      // Wallet label
      let walletLabel = '';
      if (tx.walletIndex) {
        let grp = '';
        try {
          const groups_ = (typeof loadWalletGroups === 'function') ? loadWalletGroups() : [];
          const activeId = localStorage.getItem('one_hw_group_id_v2') || localStorage.getItem('one_active_group') || '';
          const g = groups_.find(g => g.id === (tx.groupId || activeId)) || (groups_.length === 1 ? groups_[0] : null);
          if (g && g.name) grp = g.name + ' · ';
        } catch(_e) {}
        walletLabel = `${esc(grp)}W${esc(tx.walletIndex)}`;
      }

      // Details
      let details = '';
      details += detailRow(isBridge ? 'Sent' : 'Hash', tx.hash, srcUrl);
      if (isBridge) {
        details += short(tx.recvHash)
          ? detailRow('Received', tx.recvHash, recvUrl)
          : `<div class="txh-dr"><span>Received</span><code style="color:var(--text-muted)">${isPending ? 'waiting…' : '—'}</code></div>`;
      }
      if (!tx.hash && !isBridge) details += `<div class="txh-dr"><span>Hash</span><code style="color:var(--text-muted)">${tx.isDry ? 'dry run' : '—'}</code></div>`;
      if (!isBridge && !isSend && tx.dex) details += `<div class="txh-dr"><span>Route</span><code>${esc(tx.dex)}</code></div>`;
      if (walletLabel) details += `<div class="txh-dr"><span>Wallet</span><code>${walletLabel}</code></div>`;
      details += `<div class="txh-dr"><span>Time</span><code>${esc(new Date(tx.timestamp).toLocaleString())}</code></div>`;

      html += `
        <div class="txh-card s-${status} ${openMap[it.key] ? 'open' : ''}" data-key="${esc(it.key)}" onclick="txhToggleCard(this)">
          <div class="txh-row">
            <div class="txh-ico k-${kind}"><span class="material-icons-round">${isFailed ? 'error_outline' : KIND_ICON[kind]}</span></div>
            <div class="txh-mid">
              <div class="txh-t1">${KIND_LABEL[kind]} <span class="txh-st ${status}">${STATUS_LABEL[status]}</span></div>
              <div class="txh-t2">${sub}</div>
            </div>
            <div class="txh-rt">
              <div class="txh-a1 ${a1cls}">${a1}</div>
              ${a2 ? `<div class="txh-a2">${a2}</div>` : ''}
            </div>
          </div>
          ${note}
          <div class="txh-dt">${details}</div>
        </div>`;
    });
  }

  html += `<div class="txh-foot">Showing ${visible.length} of ${items.length} transaction${items.length !== 1 ? 's' : ''}</div>`;
  if (body) body.innerHTML = html;
}

// ── Interactions ──
window.txhSetFilter = function(f) { window._txhFilter = f; renderTxHistory(); };
window.txhSetQuery  = function(q) { window._txhQuery = q || ''; renderTxHistory(); };
window.txhToggleCard = function(el) {
  const k = el.getAttribute('data-key');
  const map = window._txhOpen || (window._txhOpen = {});
  const open = el.classList.toggle('open');
  if (open) map[k] = true; else delete map[k];
};
window.txhCopyHash = function(el) {
  const h = el.getAttribute('data-hash') || '';
  try { navigator.clipboard.writeText(h); } catch(_) {}
  if (typeof showToast === 'function') showToast('Hash copied', 'content_copy');
};
window.txhOpenUrl = function(el) {
  const u = el.getAttribute('data-url');
  if (u) window.open(u, '_blank', 'noopener');
};

// Init badge on load
updateTxMenuBadge();