
  // ══════════════════════════════════════════
  // CONTRACT DELETE MODAL — Shared positioning
  // ══════════════════════════════════════════

  function _cdmAlignModal(id) {
    var app = document.getElementById('app');
    var el  = document.getElementById(id);
    if (!app || !el) return;
    var r = app.getBoundingClientRect();
    el.style.left  = r.left + 'px';
    el.style.width = r.width + 'px';
    // Height: up to 75vh, but never exceed viewport
    var maxH = Math.min(window.innerHeight * 0.75, window.innerHeight - 40);
    el.style.maxHeight = maxH + 'px';
  }

  window.addEventListener('resize', function() {
    if (document.getElementById('contractDeleteModal').style.display !== 'none') _cdmAlignModal('contractDeleteModal');
    if (document.getElementById('contractDeleteModalToken').style.display !== 'none') _cdmAlignModal('contractDeleteModalToken');
    if (document.getElementById('contractDeleteModalMKN').style.display !== 'none') _cdmAlignModal('contractDeleteModalMKN');
  });

  // ── NATIVE modal ──
  var _cdmSelected = new Set();

  function openContractDeleteModal() {
    _cdmSelected = new Set();
    // Try to fill missing ownerAddress from current private key field
    _cdmFillOwnerFromKey('privateKey', savedContracts, 'batchTransferContracts');
    _cdmRenderList();
    document.getElementById('cdmOverlay').style.display = 'block';
    var m = document.getElementById('contractDeleteModal');
    m.style.display = 'flex';
    _cdmAlignModal('contractDeleteModal');
  }

  function closeContractDeleteModal() { cdmClose(); }
  function cdmClose() {
    document.getElementById('cdmOverlay').style.display = 'none';
    document.getElementById('contractDeleteModal').style.display = 'none';
    document.getElementById('contractDeleteModalToken').style.display = 'none';
    document.getElementById('contractDeleteModalMKN').style.display = 'none';
  }

  // Try to derive owner from private key field and backfill missing ownerAddress in contracts
  function _cdmFillOwnerFromKey(fieldId, contractsArr, storageKey) {
    try {
      if (!contractsArr || !contractsArr.length) return;
      var hasMissing = contractsArr.some(function(c){ return !c.ownerAddress; });
      if (!hasMissing) return;
      var el = document.getElementById(fieldId);
      if (!el) return;
      var raw = el.value.trim();
      if (!raw) return;
      var keyHex = raw.replace(/\s+/g,'');
      var m = keyHex.match(/0x[a-f0-9]+|[a-f0-9]{64}/i);
      if (m) keyHex = m[0];
      if (!keyHex.startsWith('0x')) keyHex = '0x' + keyHex;
      var w = new ethers.Wallet(keyHex);
      var derivedAddr = w.address;
      var changed = false;
      contractsArr.forEach(function(c){
        if (!c.ownerAddress) { c.ownerAddress = derivedAddr; changed = true; }
      });
      if (changed && storageKey) {
        try { localStorage.setItem(storageKey, JSON.stringify(contractsArr)); } catch(e){}
      }
    } catch(e) { /* ignore — key may be empty or invalid */ }
  }

  function _cdmShortAddr(addr) {
    if (!addr || addr.length < 12) return addr || '—';
    return addr.slice(0,6) + '…' + addr.slice(-4);
  }

  function _cdmMakeItem(c, isSelected, accentColor, onToggle) {
    var key = c.address + '|' + c.chainId;
    var item = document.createElement('div');
    item.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 10px;border-radius:10px;margin-bottom:6px;cursor:pointer;'
      + 'border:1.5px solid ' + (isSelected ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.08)') + ';'
      + 'background:' + (isSelected ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)') + ';'
      + 'transition:border-color 0.15s,background 0.15s;';

    // Checkbox
    var chk = document.createElement('div');
    chk.style.cssText = 'width:18px;height:18px;min-width:18px;border-radius:5px;'
      + 'border:2px solid ' + (isSelected ? '#ef4444' : 'rgba(255,255,255,0.2)') + ';'
      + 'background:' + (isSelected ? '#ef4444' : 'transparent') + ';'
      + 'display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.15s;';
    if (isSelected) chk.innerHTML = '<svg width="10" height="8" viewBox="0 0 10 8"><polyline points="1,4 4,7 9,1" style="fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"/></svg>';

    // Info
    var info = document.createElement('div');
    info.style.cssText = 'flex:1;min-width:0;';

    // Contract address (truncated)
    var addr = c.address || '';
    var shortContract = addr.length > 18 ? addr.slice(0,8) + '…' + addr.slice(-6) : addr;
    var addrEl = document.createElement('div');
    addrEl.style.cssText = 'font-family:var(--font-mono,"JetBrains Mono",monospace);font-size:0.76rem;color:' + accentColor + ';margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
    addrEl.textContent = shortContract;
    addrEl.title = addr;

    // Owner — only show if we have a value
    var ownerEl = document.createElement('div');
    ownerEl.style.cssText = 'font-size:0.67rem;margin-bottom:3px;';
    if (c.ownerAddress) {
      ownerEl.innerHTML = '<span style="color:#4a4a65;">Owner: </span><span style="color:#94a3b8;font-family:var(--font-mono,monospace);">' + _cdmShortAddr(c.ownerAddress) + '</span>';
    } else {
      ownerEl.innerHTML = '<span style="color:#3a3a55;font-style:italic;font-size:0.65rem;">owner unknown</span>';
    }

    // Chain + date row
    var metaEl = document.createElement('div');
    metaEl.style.cssText = 'display:flex;gap:8px;align-items:center;';
    var chainEl = document.createElement('span');
    chainEl.style.cssText = 'font-size:0.65rem;color:#38bdf8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px;';
    chainEl.textContent = '⛓ ' + (c.chainName || (c.chainId ? 'Chain '+c.chainId : '—'));
    var dateEl = document.createElement('span');
    dateEl.style.cssText = 'font-size:0.65rem;color:#4a4a65;white-space:nowrap;';
    dateEl.textContent = c.deployedAt ? new Date(c.deployedAt).toLocaleDateString() : '';
    metaEl.appendChild(chainEl);
    metaEl.appendChild(dateEl);

    info.appendChild(addrEl);
    info.appendChild(ownerEl);
    info.appendChild(metaEl);
    item.appendChild(chk);
    item.appendChild(info);
    item.onclick = onToggle;
    return item;
  }

  function _cdmRenderList() {
    var list = document.getElementById('cdmContractList');
    var all = (typeof savedContracts !== 'undefined') ? savedContracts : [];
    list.innerHTML = '';
    if (all.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:28px 16px;color:#4a4a65;font-size:0.82rem;">No saved contracts</div>';
    } else {
      all.forEach(function(c) {
        var key = c.address + '|' + c.chainId;
        list.appendChild(_cdmMakeItem(c, _cdmSelected.has(key), '#c4b5fd', function() {
          if (_cdmSelected.has(key)) _cdmSelected.delete(key); else _cdmSelected.add(key);
          _cdmRenderList();
        }));
      });
    }
    _cdmUpdateUI();
  }

  function _cdmUpdateUI() {
    var count = _cdmSelected.size;
    var all = (typeof savedContracts !== 'undefined') ? savedContracts : [];
    var el = document.getElementById('cdmSelectedCount');
    var btn = document.getElementById('cdmDeleteBtn');
    var box = document.getElementById('cdmSelectAllBox');
    if (el) el.textContent = count + ' selected';
    if (btn) { btn.disabled = count===0; btn.style.opacity = count>0?'1':'0.4'; btn.textContent = count>0?('🗑 Delete '+count+(count>1?' Contracts':' Contract')):'🗑 Delete Selected'; }
    if (box) {
      var allSel = all.length>0 && count===all.length;
      box.style.background = allSel ? 'rgba(99,102,241,0.85)' : 'transparent';
      box.style.borderColor = allSel ? '#6366f1' : 'rgba(99,102,241,0.5)';
      box.innerHTML = allSel ? '<svg width="10" height="8" viewBox="0 0 10 8"><polyline points="1,4 4,7 9,1" style="fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"/></svg>' : '';
    }
  }

  function cdmToggleSelectAll() {
    var all = (typeof savedContracts !== 'undefined') ? savedContracts : [];
    if (_cdmSelected.size===all.length && all.length>0) { _cdmSelected = new Set(); }
    else { all.forEach(function(c){ _cdmSelected.add(c.address+'|'+c.chainId); }); }
    _cdmRenderList();
  }

  function cdmDeleteSelected() {
    if (_cdmSelected.size===0) return;
    var count = _cdmSelected.size;
    if (typeof savedContracts !== 'undefined') {
      savedContracts = savedContracts.filter(function(c){ return !_cdmSelected.has(c.address+'|'+c.chainId); });
      localStorage.setItem('batchTransferContracts', JSON.stringify(savedContracts));
      if (typeof activeContractAddress !== 'undefined' && activeContractAddress) {
        var still = savedContracts.some(function(c){ return c.address.toLowerCase()===activeContractAddress.toLowerCase(); });
        if (!still) { activeContractAddress=null; var ci=document.getElementById('currentContractInfo'); if(ci)ci.classList.remove('active'); var eb=document.getElementById('executeBtn'); if(eb)eb.disabled=true; }
      }
      if (typeof renderSavedContracts==='function') renderSavedContracts();
      if (typeof logMessage==='function') logMessage('success', '✅ Deleted '+count+' contract'+(count>1?'s':''));
    }
    cdmClose();
  }

  // ── TOKEN modal ──
  var _cdmTSelected = new Set();

  function openContractDeleteModalToken() {
    _cdmTSelected = new Set();
    // Try to fill missing ownerAddress from current private key field
    _cdmFillOwnerFromKey('privateKeyToken', savedContractsToken, 'batchTransferContractsToken');
    _cdmTRenderList();
    document.getElementById('cdmOverlay').style.display = 'block';
    var m = document.getElementById('contractDeleteModalToken');
    m.style.display = 'flex';
    _cdmAlignModal('contractDeleteModalToken');
  }

  function closeContractDeleteModalToken() { cdmTClose(); }
  function cdmTClose() {
    document.getElementById('cdmOverlay').style.display = 'none';
    document.getElementById('contractDeleteModalToken').style.display = 'none';
  }

  function _cdmTRenderList() {
    var list = document.getElementById('cdmTContractList');
    var all = (typeof savedContractsToken !== 'undefined') ? savedContractsToken : [];
    list.innerHTML = '';
    if (all.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:28px 16px;color:#4a4a65;font-size:0.82rem;">No saved contracts</div>';
    } else {
      all.forEach(function(c) {
        var key = c.address + '|' + c.chainId;
        list.appendChild(_cdmMakeItem(c, _cdmTSelected.has(key), '#67e8f9', function() {
          if (_cdmTSelected.has(key)) _cdmTSelected.delete(key); else _cdmTSelected.add(key);
          _cdmTRenderList();
        }));
      });
    }
    _cdmTUpdateUI();
  }

  function _cdmTUpdateUI() {
    var count = _cdmTSelected.size;
    var all = (typeof savedContractsToken !== 'undefined') ? savedContractsToken : [];
    var el = document.getElementById('cdmTSelectedCount');
    var btn = document.getElementById('cdmTDeleteBtn');
    var box = document.getElementById('cdmTSelectAllBox');
    if (el) el.textContent = count + ' selected';
    if (btn) { btn.disabled = count===0; btn.style.opacity = count>0?'1':'0.4'; btn.textContent = count>0?('🗑 Delete '+count+(count>1?' Contracts':' Contract')):'🗑 Delete Selected'; }
    if (box) {
      var allSel = all.length>0 && count===all.length;
      box.style.background = allSel ? 'rgba(6,182,212,0.85)' : 'transparent';
      box.style.borderColor = allSel ? '#06b6d4' : 'rgba(6,182,212,0.5)';
      box.innerHTML = allSel ? '<svg width="10" height="8" viewBox="0 0 10 8"><polyline points="1,4 4,7 9,1" style="fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"/></svg>' : '';
    }
  }

  function cdmTToggleSelectAll() {
    var all = (typeof savedContractsToken !== 'undefined') ? savedContractsToken : [];
    if (_cdmTSelected.size===all.length && all.length>0) { _cdmTSelected = new Set(); }
    else { all.forEach(function(c){ _cdmTSelected.add(c.address+'|'+c.chainId); }); }
    _cdmTRenderList();
  }

  function cdmTDeleteSelected() {
    if (_cdmTSelected.size===0) return;
    var count = _cdmTSelected.size;
    if (typeof savedContractsToken !== 'undefined') {
      savedContractsToken = savedContractsToken.filter(function(c){ return !_cdmTSelected.has(c.address+'|'+c.chainId); });
      localStorage.setItem('batchTransferContractsToken', JSON.stringify(savedContractsToken));
      if (typeof deployedContractAddressToken !== 'undefined' && deployedContractAddressToken) {
        var still = savedContractsToken.some(function(c){ return c.address.toLowerCase()===deployedContractAddressToken.toLowerCase(); });
        if (!still) { deployedContractAddressToken=null; var eb=document.getElementById('executeBtnToken'); if(eb)eb.disabled=true; }
      }
      if (typeof renderSavedContractsToken==='function') renderSavedContractsToken();
      if (typeof logMessageToken==='function') logMessageToken('success', '✅ Deleted '+count+' contract'+(count>1?'s':''));
    }
    cdmTClose();
  }

  // ── MKN (Multi Key Native) modal ──
  var _cdmMKNSelected = new Set();

  function openContractDeleteModalMKN() {
    _cdmMKNSelected = new Set();
    _cdmFillOwnerFromKey('privateKeyMultiKeyNative', savedContractsMultiKeyNative, 'multiKeyNativeContracts');
    _cdmMKNRenderList();
    document.getElementById('cdmOverlay').style.display = 'block';
    var m = document.getElementById('contractDeleteModalMKN');
    m.style.display = 'flex';
    _cdmAlignModal('contractDeleteModalMKN');
  }

  function cdmMKNClose() {
    document.getElementById('cdmOverlay').style.display = 'none';
    document.getElementById('contractDeleteModalMKN').style.display = 'none';
  }

  function _cdmMKNRenderList() {
    var list = document.getElementById('cdmMKNContractList');
    var all = (typeof savedContractsMultiKeyNative !== 'undefined') ? savedContractsMultiKeyNative : [];
    list.innerHTML = '';
    if (all.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:28px 16px;color:#4a4a65;font-size:0.82rem;">No saved contracts</div>';
    } else {
      all.forEach(function(c) {
        var key = c.address + '|' + c.chainId;
        list.appendChild(_cdmMakeItem(c, _cdmMKNSelected.has(key), '#c4b5fd', function() {
          if (_cdmMKNSelected.has(key)) _cdmMKNSelected.delete(key); else _cdmMKNSelected.add(key);
          _cdmMKNRenderList();
        }));
      });
    }
    _cdmMKNUpdateUI();
  }

  function _cdmMKNUpdateUI() {
    var count = _cdmMKNSelected.size;
    var all = (typeof savedContractsMultiKeyNative !== 'undefined') ? savedContractsMultiKeyNative : [];
    var el  = document.getElementById('cdmMKNSelectedCount');
    var btn = document.getElementById('cdmMKNDeleteBtn');
    var box = document.getElementById('cdmMKNSelectAllBox');
    if (el)  el.textContent = count + ' selected';
    if (btn) { btn.disabled = count===0; btn.style.opacity = count>0?'1':'0.4'; btn.textContent = count>0?('🗑 Delete '+count+(count>1?' Contracts':' Contract')):'🗑 Delete Selected'; }
    if (box) {
      var allSel = all.length>0 && count===all.length;
      box.style.background   = allSel ? 'rgba(99,102,241,0.85)' : 'transparent';
      box.style.borderColor  = allSel ? '#6366f1' : 'rgba(99,102,241,0.5)';
      box.innerHTML = allSel ? '<svg width="10" height="8" viewBox="0 0 10 8"><polyline points="1,4 4,7 9,1" style="fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"/></svg>' : '';
    }
  }

  function cdmMKNToggleSelectAll() {
    var all = (typeof savedContractsMultiKeyNative !== 'undefined') ? savedContractsMultiKeyNative : [];
    if (_cdmMKNSelected.size===all.length && all.length>0) { _cdmMKNSelected = new Set(); }
    else { all.forEach(function(c){ _cdmMKNSelected.add(c.address+'|'+c.chainId); }); }
    _cdmMKNRenderList();
  }

  function cdmMKNDeleteSelected() {
    if (_cdmMKNSelected.size===0) return;
    var count = _cdmMKNSelected.size;
    if (typeof savedContractsMultiKeyNative !== 'undefined') {
      savedContractsMultiKeyNative = savedContractsMultiKeyNative.filter(function(c){
        return !_cdmMKNSelected.has(c.address+'|'+c.chainId);
      });
      localStorage.setItem('multiKeyNativeContracts', JSON.stringify(savedContractsMultiKeyNative));
      // Clear active if deleted
      if (typeof activeContractAddressMultiKeyNative !== 'undefined' && activeContractAddressMultiKeyNative) {
        var still = savedContractsMultiKeyNative.some(function(c){ return c.address.toLowerCase()===activeContractAddressMultiKeyNative.toLowerCase(); });
        if (!still) { activeContractAddressMultiKeyNative=null; deployedContractAddressMultiKeyNative=null; }
      }
      if (typeof renderSavedContractsMultiKeyNative==='function') renderSavedContractsMultiKeyNative();
      if (typeof updateButtonStates==='function') updateButtonStates();
      if (typeof logMessageMultiKeyNative==='function') logMessageMultiKeyNative('success', '✅ Deleted '+count+' contract'+(count>1?'s':''));
    }
    cdmMKNClose();
  }
  