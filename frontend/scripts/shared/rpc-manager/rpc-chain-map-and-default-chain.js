// RPC manager: error classification, chain map/emoji and per-section default chain
// Part of the RPC manager module (split by topic; no logic change).
(function (__NX) {
  __NX._thErrReason = _thErrReason;
  __NX._thIsTxLevelError = _thIsTxLevelError;
  __NX.chainEmoji = chainEmoji;
  __NX.getTHSectionChain = getTHSectionChain;
  __NX.thApplyDefaultToAll = thApplyDefaultToAll;


    // ─────────────────────────────────────────────────────────────
    // thResilientSendAndConfirm — Shared RPC-Resilient TX helper
    //
    // Handles both scenarios gracefully:
    //   Case 1: TX not yet broadcast → RPC fail → retry send on next RPC (same nonce, same tx)
    //   Case 2: TX broadcast OK → confirmation RPC fail → waitForTransaction on next RPC
    //
    // Usage:
    //   const receipt = await window.thResilientSendAndConfirm({
    //     rpcInputId: 'rpcUrlMultiKeyNative',  // used to get RPC list
    //     sendFn: async (provider) => { ... return tx; },  // must return obj with .hash
    //     logFn: logMessageMultiKeyNative,
    //     label: 'Multi Key Native',  // for log messages
    //     waitConfirm: true,          // false = fire-and-forget (no wait)
    //   });
    // ─────────────────────────────────────────────────────────────
    // ── Extract the REAL reason from an ethers v6 error (nested RPC error / info.error) ──
    function _thErrReason(e) {
      try {
        var m = (e && (e.shortMessage || e.reason)) || '';
        var inner = (e && e.error && e.error.message) || (e && e.info && e.info.error && e.info.error.message) || '';
        if (!inner && e && e.message) {
          var mm = /"message"\s*:\s*"([^"]+)"/.exec(e.message);
          if (mm) inner = mm[1];
        }
        var out = (m && inner && m !== inner) ? (m + ': ' + inner) : (inner || m || (e && e.message) || String(e));
        return String(out).replace(/\s+/g, ' ').slice(0, 160);
      } catch (_) { return String(e); }
    }
    // Errors the chain/wallet itself returns — retrying on another RPC cannot fix these.
    function _thIsTxLevelError(e) {
      var t = (_thErrReason(e) + ' ' + ((e && e.code) || '')).toLowerCase();
      return /insufficient funds|insufficient balance|underpriced|nonce too low|nonce has already|intrinsic gas|gas tip cap|max fee per gas less than|execution reverted|call_exception|insufficient_funds|replacement transaction/.test(t);
    }
    // ─── END thResilientSendAndConfirm ───────────────────────────

    var TH_CHAIN_MAP = {
      batchNative: { rpcId: 'rpcUrl',                label: 'BATCH',          onSelect: function(c){ var _cfg={ name:c.name,chainId:c.chainId,symbol:c.symbol,rpcs:c.rpcs||[c.rpc],explorer:c.explorer||'' }; currentChainConfig=_cfg; currentTokenChainConfig=_cfg; if(typeof initializeProvider==='function') initializeProvider(); var _rEl=document.getElementById('rpcUrl'); if(_rEl){var _rp=c.rpcs||[c.rpc]; _rEl.value=_rp[0]||c.rpc||''; _rEl.setAttribute('data-rpcs',JSON.stringify(_rp)); _rEl.setAttribute('data-chainid',c.chainId||'');} __NX._thDispatchRpcInput('rpcUrl'); var _tEl=document.getElementById('rpcUrlToken'); if(_tEl){var _rp=c.rpcs||[c.rpc]; _tEl.value=_rp[0]||c.rpc||''; _tEl.setAttribute('data-rpcs',JSON.stringify(_rp)); _tEl.setAttribute('data-chainid',c.chainId||'');} __NX._thDispatchRpcInput('rpcUrlToken'); if(typeof thOnChainSelect==='function'){thOnChainSelect('rpcUrl');thOnChainSelect('rpcUrlToken');} /* ── Reset contract state on chain change ── */ if(typeof savedContracts!=='undefined') savedContracts.forEach(function(x){x.isActive=false;}); activeContractAddress=null; var _ciEl=document.getElementById('currentContractInfo'); if(_ciEl) _ciEl.classList.remove('active'); var _dBtn=document.getElementById('deployBtn'); if(_dBtn) _dBtn.disabled=true; if(typeof renderSavedContracts==='function') renderSavedContracts(); if(typeof renderSavedContractsToken==='function') renderSavedContractsToken(); /* Auto-load contract for new chain if exists */ var _mc=typeof savedContracts!=='undefined'&&savedContracts.find(function(x){return parseInt(x.chainId||0,10)===parseInt(c.chainId||0,10);}); if(_mc){setTimeout(function(){if(typeof loadContract==='function')loadContract(_mc.address,_mc.chainId);},100);}else{if(typeof checkDeployReady==='function') checkDeployReady(); if(typeof checkBatchNativeWallet==='function') checkBatchNativeWallet();} } },
      batchToken:  { rpcId: 'rpcUrlToken',            label: 'BATCH TOKEN',    onSelect: function(c){ var _rpcs=c.rpcs||[c.rpc]; currentTokenChainConfig = { name: c.name, chainId: c.chainId, symbol: c.symbol, rpcs: _rpcs, explorer: c.explorer || '' }; var _tEl=document.getElementById('rpcUrlToken'); if(_tEl){_tEl.value=_rpcs[0]||c.rpc||''; _tEl.setAttribute('data-rpcs',JSON.stringify(_rpcs)); _tEl.setAttribute('data-chainid',c.chainId||'');} __NX._thDispatchRpcInput('rpcUrlToken'); if(typeof thOnChainSelect==='function') thOnChainSelect('rpcUrlToken'); /* ── Reset token contract state on chain change ── */ if(typeof savedContractsToken!=='undefined') savedContractsToken.forEach(function(x){x.isActive=false;}); deployedContractAddressToken=null; activeContractAddressToken=null; var _ciTEl=document.getElementById('currentContractInfoToken'); if(_ciTEl) _ciTEl.classList.remove('active'); var _dBtnT=document.getElementById('deployBtnToken'); if(_dBtnT) _dBtnT.disabled=true; if(typeof renderSavedContractsToken==='function') renderSavedContractsToken(); /* Auto-load token contract for new chain if exists */ var _mcT=typeof savedContractsToken!=='undefined'&&savedContractsToken.find(function(x){return parseInt(x.chainId||0,10)===parseInt(c.chainId||0,10);}); if(_mcT){setTimeout(function(){if(typeof loadContractToken==='function')loadContractToken(_mcT.address,_mcT.chainId);},100);}else{if(typeof validateTokenInputs==='function') validateTokenInputs();} } },
      mkNative:    { rpcId: 'rpcUrlMultiKeyNative',   label: 'MULTI KEY', onSelect: function(c){ var _rpcs=c.rpcs||[c.rpc]; var _cfg={ name:c.name,chainId:c.chainId,symbol:c.symbol,rpcs:_rpcs,explorer:c.explorer||'' }; currentMultiKeyNativeChainConfig=_cfg; currentMultiKeyTokenChainConfig=_cfg; var _nEl=document.getElementById('rpcUrlMultiKeyNative'); if(_nEl){_nEl.value=_rpcs[0]||c.rpc||''; _nEl.setAttribute('data-rpcs',JSON.stringify(_rpcs)); _nEl.setAttribute('data-chainid',c.chainId||'');} __NX._thDispatchRpcInput('rpcUrlMultiKeyNative'); var _tkEl=document.getElementById('rpcUrlMultiKeyToken'); if(_tkEl){_tkEl.value=_rpcs[0]||c.rpc||''; _tkEl.setAttribute('data-rpcs',JSON.stringify(_rpcs)); _tkEl.setAttribute('data-chainid',c.chainId||'');} __NX._thDispatchRpcInput('rpcUrlMultiKeyToken'); if(typeof thOnChainSelect==='function'){thOnChainSelect('rpcUrlMultiKeyNative');thOnChainSelect('rpcUrlMultiKeyToken');} if(typeof renderSavedContractsMultiKeyNative==='function') renderSavedContractsMultiKeyNative(); var _contractSec=document.getElementById('contractTransferSection'); var _isCtMode=_contractSec&&_contractSec.style.display!=='none'; if(_isCtMode&&typeof savedContractsMultiKeyNative!=='undefined'){savedContractsMultiKeyNative.forEach(function(x){x.isActive=false;}); activeContractAddressMultiKeyNative=null; deployedContractAddressMultiKeyNative=null; var _mc=savedContractsMultiKeyNative.find(function(x){return parseInt(x.chainId||0,10)===parseInt(c.chainId||0,10);}); if(_mc){setTimeout(function(){if(typeof loadContractMultiKeyNative==='function')loadContractMultiKeyNative(_mc.address);},100);}else{if(typeof updateButtonStates==='function')updateButtonStates();}} } },
      mkToken:     { rpcId: 'rpcUrlMultiKeyToken',    label: 'MULTI KEY TOKEN', onSelect: function(c){ var _rpcs=c.rpcs||[c.rpc]; var _cfg={ name:c.name,chainId:c.chainId,symbol:c.symbol,rpcs:_rpcs,explorer:c.explorer||'' }; currentMultiKeyNativeChainConfig=_cfg; currentMultiKeyTokenChainConfig=_cfg; var _tkEl=document.getElementById('rpcUrlMultiKeyToken'); if(_tkEl){_tkEl.value=_rpcs[0]||c.rpc||''; _tkEl.setAttribute('data-rpcs',JSON.stringify(_rpcs)); _tkEl.setAttribute('data-chainid',c.chainId||'');} __NX._thDispatchRpcInput('rpcUrlMultiKeyToken'); var _nEl=document.getElementById('rpcUrlMultiKeyNative'); if(_nEl){_nEl.value=_rpcs[0]||c.rpc||''; _nEl.setAttribute('data-rpcs',JSON.stringify(_rpcs)); _nEl.setAttribute('data-chainid',c.chainId||'');} __NX._thDispatchRpcInput('rpcUrlMultiKeyNative'); if(typeof thOnChainSelect==='function'){thOnChainSelect('rpcUrlMultiKeyToken');thOnChainSelect('rpcUrlMultiKeyNative');} if(typeof renderSavedContractsMultiKeyNative==='function') renderSavedContractsMultiKeyNative(); var _contractSec=document.getElementById('contractTransferSection'); var _isCtMode=_contractSec&&_contractSec.style.display!=='none'; if(_isCtMode&&typeof savedContractsMultiKeyNative!=='undefined'){savedContractsMultiKeyNative.forEach(function(x){x.isActive=false;}); activeContractAddressMultiKeyNative=null; deployedContractAddressMultiKeyNative=null; var _mc=savedContractsMultiKeyNative.find(function(x){return parseInt(x.chainId||0,10)===parseInt(c.chainId||0,10);}); if(_mc){setTimeout(function(){if(typeof loadContractMultiKeyNative==='function')loadContractMultiKeyNative(_mc.address);},100);}else{if(typeof updateButtonStates==='function')updateButtonStates();}} } },
      nftDist:     { rpcId: 'rpcUrlNft',              label: 'NFT DISTRIBUTE', onSelect: function(c){ var _rpcs=c.rpcs||[c.rpc]; var _nEl=document.getElementById('rpcUrlNft'); if(_nEl){_nEl.value=_rpcs[0]||c.rpc||''; _nEl.setAttribute('data-rpcs',JSON.stringify(_rpcs)); _nEl.setAttribute('data-chainid',c.chainId||'');} __NX._thDispatchRpcInput('rpcUrlNft'); var _cEl=document.getElementById('rpcUrlNftCollect'); if(_cEl){_cEl.value=_rpcs[0]||c.rpc||''; _cEl.setAttribute('data-rpcs',JSON.stringify(_rpcs)); _cEl.setAttribute('data-chainid',c.chainId||'');} __NX._thDispatchRpcInput('rpcUrlNftCollect'); if(typeof thOnChainSelect==='function'){thOnChainSelect('rpcUrlNft');thOnChainSelect('rpcUrlNftCollect');} } },
      nftCollect:  { rpcId: 'rpcUrlNftCollect',       label: 'NFT COLLECT',    onSelect: function(c){ var _rpcs=c.rpcs||[c.rpc]; var _cEl=document.getElementById('rpcUrlNftCollect'); if(_cEl){_cEl.value=_rpcs[0]||c.rpc||''; _cEl.setAttribute('data-rpcs',JSON.stringify(_rpcs)); _cEl.setAttribute('data-chainid',c.chainId||'');} __NX._thDispatchRpcInput('rpcUrlNftCollect'); var _dEl=document.getElementById('rpcUrlNft'); if(_dEl){_dEl.value=_rpcs[0]||c.rpc||''; _dEl.setAttribute('data-rpcs',JSON.stringify(_rpcs)); _dEl.setAttribute('data-chainid',c.chainId||'');} __NX._thDispatchRpcInput('rpcUrlNft'); } },
      w2wNative:   { rpcId: 'rpcUrlW2W',              label: 'W2W NATIVE',     onSelect: function(c){ var _rpcs=c.rpcs||[c.rpc]; var _nEl=document.getElementById('rpcUrlW2W'); if(_nEl){_nEl.value=_rpcs[0]||c.rpc||''; _nEl.setAttribute('data-rpcs',JSON.stringify(_rpcs)); _nEl.setAttribute('data-chainid',c.chainId||'');} __NX._thDispatchRpcInput('rpcUrlW2W'); var _tEl=document.getElementById('rpcUrlW2WToken'); if(_tEl){_tEl.value=_rpcs[0]||c.rpc||''; _tEl.setAttribute('data-rpcs',JSON.stringify(_rpcs)); _tEl.setAttribute('data-chainid',c.chainId||'');} __NX._thDispatchRpcInput('rpcUrlW2WToken'); if(typeof thOnChainSelect==='function'){thOnChainSelect('rpcUrlW2W');thOnChainSelect('rpcUrlW2WToken');} } },
      w2wToken:    { rpcId: 'rpcUrlW2WToken',         label: 'W2W TOKEN',      onSelect: function(c){ var _rpcs=c.rpcs||[c.rpc]; var _tEl=document.getElementById('rpcUrlW2WToken'); if(_tEl){_tEl.value=_rpcs[0]||c.rpc||''; _tEl.setAttribute('data-rpcs',JSON.stringify(_rpcs)); _tEl.setAttribute('data-chainid',c.chainId||'');} __NX._thDispatchRpcInput('rpcUrlW2WToken'); var _nEl=document.getElementById('rpcUrlW2W'); if(_nEl){_nEl.value=_rpcs[0]||c.rpc||''; _nEl.setAttribute('data-rpcs',JSON.stringify(_rpcs)); _nEl.setAttribute('data-chainid',c.chainId||'');} __NX._thDispatchRpcInput('rpcUrlW2W'); } },
      withdraw:    { rpcId: 'withdrawRpcUrl',          label: 'WITHDRAW',       onSelect: function(c){ var _rpcs=(typeof _getRpcListForChain==='function'&&c.chainId)?_getRpcListForChain(c.chainId):(c.rpcs||[c.rpc]); var _wEl=document.getElementById('withdrawRpcUrl'); if(_wEl){_wEl.value=_rpcs[0]||c.rpc||''; _wEl.setAttribute('data-rpcs',JSON.stringify(_rpcs)); _wEl.setAttribute('data-chainid',c.chainId||'');} if(typeof currentChainConfigWithdraw!=='undefined'){currentChainConfigWithdraw={name:c.name,chainId:c.chainId,symbol:c.symbol,rpcs:_rpcs,explorer:c.explorer||''};} try{localStorage.setItem('transferHub_chain_withdraw',String(c.chainId));}catch(_){} __NX._thDispatchRpcInput('withdrawRpcUrl'); if(typeof thOnChainSelect==='function') thOnChainSelect('withdrawRpcUrl'); if(typeof showSelectedChainOnlyWithdraw==='function') try{showSelectedChainOnlyWithdraw(c);}catch(_){} window.selectedWithdrawContract=null; if(typeof currentSelectedContract!=='undefined') currentSelectedContract=null; window.isOwnerVerified=false; if(typeof isOwnerVerified!=='undefined') isOwnerVerified=false; (function(){var _wi=document.getElementById('withdrawInputs');if(_wi)_wi.style.display='none'; var _wb=document.getElementById('selectedContractInfoBox');if(_wb)_wb.style.display='none'; var _wn=document.getElementById('noContractSelected');if(_wn)_wn.style.display='block'; var _wdk=document.getElementById('withdrawDeveloperKey');if(_wdk)_wdk.value=''; var _wos=document.getElementById('ownershipStatus');if(_wos)_wos.style.display='none'; document.querySelectorAll('[data-contract-addr]').forEach(function(cd){cd.style.borderColor='#1e2530';cd.style.boxShadow='none';cd.style.background='linear-gradient(135deg,#111518 0%,#141820 100%)';});})(); if(typeof autoLoadContracts==='function') autoLoadContracts(); } },
      selfTransfer:{ rpcId: 'rpcUrlSelfTransfer',     label: 'SELF TRANSFER',  onSelect: function(c){ var _rpcs=c.rpcs||[c.rpc]; var _sEl=document.getElementById('rpcUrlSelfTransfer'); if(_sEl){_sEl.value=_rpcs[0]||c.rpc||''; _sEl.setAttribute('data-rpcs',JSON.stringify(_rpcs)); _sEl.setAttribute('data-chainid',c.chainId||'');} __NX._thDispatchRpcInput('rpcUrlSelfTransfer'); if(typeof thOnChainSelect==='function') thOnChainSelect('rpcUrlSelfTransfer'); } },
      balanceCheck:{ rpcId: 'rpcUrlBalanceCheck',     label: 'BALANCE CHECK',  onSelect: function(c){ var _rpcs=c.rpcs||[c.rpc]; var _bEl=document.getElementById('rpcUrlBalanceCheck'); if(_bEl){_bEl.value=_rpcs[0]||c.rpc||''; _bEl.setAttribute('data-rpcs',JSON.stringify(_rpcs)); _bEl.setAttribute('data-chainid',c.chainId||'');} __NX._thDispatchRpcInput('rpcUrlBalanceCheck'); if(typeof thOnChainSelect==='function') thOnChainSelect('rpcUrlBalanceCheck'); } },
      approval:    { rpcId: 'rpcUrlApproval',         label: 'TOKEN APPROVAL', onSelect: function(c){ var _rpcs=c.rpcs||[c.rpc]; var _aEl=document.getElementById('rpcUrlApproval'); if(_aEl){_aEl.value=_rpcs[0]||c.rpc||''; _aEl.setAttribute('data-rpcs',JSON.stringify(_rpcs)); _aEl.setAttribute('data-chainid',c.chainId||'');} __NX._thDispatchRpcInput('rpcUrlApproval'); if(typeof thOnChainSelect==='function') thOnChainSelect('rpcUrlApproval'); } },
      multiApproval: { rpcId: 'rpcUrlMultiApproval',  label: 'MULTI APPROVAL', onSelect: function(c){ var _rpcs=c.rpcs||[c.rpc]; var _mEl=document.getElementById('rpcUrlMultiApproval'); if(_mEl){_mEl.value=_rpcs[0]||c.rpc||''; _mEl.setAttribute('data-rpcs',JSON.stringify(_rpcs)); _mEl.setAttribute('data-chainid',c.chainId||'');} __NX._thDispatchRpcInput('rpcUrlMultiApproval'); } },
    }; __NX.TH_CHAIN_MAP = TH_CHAIN_MAP;

    // Chain emoji map by symbol
    var SYM_EMOJI = {
      ETH:'🔷', BNB:'🟡', MATIC:'🟣', POL:'🟣', AVAX:'🔴', FTM:'👻', SOL:'🟣',
      OP:'🔴', ARB:'🔵', BASE:'🔵', CRO:'🔵', KLAY:'🟤', MNT:'⚫', BLAST:'🟡',
      LINEA:'⚫', MODE:'⚫', SCROLL:'🟡', ZKSYNC:'🟦', ONE:'🔵', GLMR:'⚪',
      MOVR:'🟠', HT:'⚪', OKT:'⚪', CELO:'🟢', xDAI:'🟢', KCS:'🟢', ROSE:'🟣',
      CFX:'🔵', TLOS:'🔵', EVMOS:'🟣', ASTR:'🔵', FUSE:'🟢', KAVA:'🟠',
      SYS:'🔵', FLR:'🔴', ELA:'🔵', CUSTOM:'⚙️',
    };
    function chainEmoji(chain) {
      if (chain.isCustom) return '⚙️';
      return SYM_EMOJI[chain.symbol] || '⛓️';
    }

    __NX._thCPSection = null;
    var _thCPChains = null;

    // ── Helper: resolve a specific section's saved chain from TH chain list ──
    function getTHSectionChain(sectionId) {
      // Priority 1: Per-section saved chain
      var savedChainId = null;
      try {
        if (sectionId) {
          var _ps = localStorage.getItem('transferHub_chain_' + sectionId);
          if (_ps) savedChainId = parseInt(_ps, 10) || null;
        }
      } catch(_) {}

      // Priority 2: Home section active chain (global fallback)
      var homeChainId = (typeof activeHomeChainId !== 'undefined') ? activeHomeChainId : null;

      var allChains = getAllTHChains();
      var matched   = null;

      // Try per-section saved chain first
      if (savedChainId !== null) {
        matched = allChains.find(function(c){ return c.chainId === savedChainId; });
      }
      // Fallback to home chain
      if (!matched && homeChainId !== null) {
        matched = allChains.find(function(c){ return c.chainId === homeChainId; });
      }
      if (!matched) matched = allChains.find(function(c){ return c.chainId === 8453; });
      if (!matched) matched = allChains.find(function(c){ return c.name === 'Base'; });
      if (!matched && allChains.length) matched = allChains[0];
      if (!matched) matched = { name:'Base', symbol:'ETH', chainId:8453, rpc:'https://mainnet.base.org' };
      return matched;
    }

    // ── Backward-compat shim: getTHDefaultChain() → uses first section or Base ──
    function getTHDefaultChain() {
      var secs = Object.keys(TH_CHAIN_MAP);
      return getTHSectionChain(secs.length ? secs[0] : null);
    }

    // ── Apply each section's own saved chain to its button + RPC field ──
    function thApplyDefaultToAll(chain) {
      // `chain` param kept for backward-compat but each section now uses its own saved chain
      Object.keys(TH_CHAIN_MAP).forEach(function(sec) {
        var sectionChain = getTHSectionChain(sec);
        var em = chainEmoji(sectionChain);
        // Build full RPC list for this section's chain
        var fullRpcs = [];
        try {
          if (sectionChain.chainId && typeof _getRpcListForChain === 'function') fullRpcs = _getRpcListForChain(sectionChain.chainId);
        } catch(_) {}
        if (!fullRpcs.length) fullRpcs = sectionChain.rpcs || (sectionChain.rpc ? [sectionChain.rpc] : []);
        var primaryRpc = fullRpcs[0] || sectionChain.rpc || '';

        var cfg    = TH_CHAIN_MAP[sec];
        var rpcEl  = document.getElementById(cfg.rpcId);
        var nameEl = document.getElementById('th-net-name-' + sec);
        var symEl  = document.getElementById('th-net-sym-'  + sec);
        var emEl   = document.getElementById('th-net-emoji-'+ sec);
        if (rpcEl) {
          rpcEl.value = primaryRpc;
          rpcEl.setAttribute('data-rpcs', JSON.stringify(fullRpcs));
          rpcEl.setAttribute('data-chainid', sectionChain.chainId || '');
        }
        if (emEl)   emEl.textContent   = em;
        if (nameEl) nameEl.textContent = sectionChain.name;
        if (symEl)  symEl.textContent  = sectionChain.symbol + (sectionChain.chainId ? ' · Chain ' + sectionChain.chainId : '');
        // ── Sync header chain button with logo ──
        var hdrEmEl = document.getElementById('th-net-emoji-' + sec + '-hdr');
        var hdrNmEl = document.getElementById('th-net-name-'  + sec + '-hdr');
        if (hdrEmEl) {
          if (sectionChain.logoURI && typeof _chainLogoHtml === 'function') {
            hdrEmEl.innerHTML = _chainLogoHtml(sectionChain.logoURI, em, 18);
            if (typeof _fixChainLogos === 'function') _fixChainLogos(hdrEmEl);
          } else {
            hdrEmEl.textContent = em;
          }
        }
        if (hdrNmEl) hdrNmEl.textContent = sectionChain.name;
        // ── Fire onSelect so section configs (currentChainConfig etc.) stay in sync ──
        if (cfg.onSelect) try { cfg.onSelect(sectionChain); } catch(_) {}
      });
    }
})((window.__nxp = window.__nxp || {}).mod_rpc_manager = window.__nxp.mod_rpc_manager || {});
