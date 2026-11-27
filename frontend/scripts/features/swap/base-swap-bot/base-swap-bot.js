
    // ═══════════════════════════════════════════════════
    //  BASE SWAP BOT — Embedded Logic (namespaced bsb_*)
    // ═══════════════════════════════════════════════════
    (function(){
  var __NX = window.__nxp.mod_base_swap_bot; delete window.__nxp.mod_base_swap_bot;

      window.bsbSelectSlip = function(val){
        __NX._bsbSlipIds.forEach(function(id){
          var el=document.getElementById(id);
          if(!el)return;
          el.style.background='var(--bg-surface)';
          el.style.color='var(--text-secondary)';
          el.style.borderColor='var(--border-subtle)';
        });
        var map={0.1:'bsb-slip-01',0.5:'bsb-slip-05',1.0:'bsb-slip-10',1:'bsb-slip-10',3.0:'bsb-slip-30',3:'bsb-slip-30',15:'bsb-slip-15'};
        var el=document.getElementById(map[val]);
        if(el){el.style.background='var(--accent-primary)';el.style.color='#fff';el.style.borderColor='var(--accent-primary)';}
        var hid=document.getElementById('bsb-slip-val');
        if(hid)hid.value=val;
        var custom=document.getElementById('bsb-slip-custom');
        if(custom)custom.value='';
      }
      window.bsbSelectSlipCustom = function(val){
        __NX._bsbSlipIds.forEach(function(id){
          var el=document.getElementById(id);
          if(!el)return;
          el.style.background='var(--bg-surface)';
          el.style.color='var(--text-secondary)';
          el.style.borderColor='var(--border-subtle)';
        });
        var hid=document.getElementById('bsb-slip-val');
        if(hid&&val)hid.value=val;
      }

      // ── Key Load ──
      window.bsbLoadKeys=function(){
        __NX.bsbWallets=[];
        var list=__NX.bsbGid('bsb-keyList');list.innerHTML='';
        __NX.bsbGid('bsb-keys').value.trim().split('\n').forEach(function(k,i){
          k=k.trim();if(!k)return;
          try{
            var w=new ethers.Wallet(k);
            __NX.bsbWallets.push({key:k,addr:w.address,idx:i});
            var d=document.createElement('div');
            d.style.cssText='background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:8px;padding:9px 10px;margin-bottom:6px;display:flex;align-items:center;gap:8px;';
            d.id='bsb-ki'+i;
            d.innerHTML='<div id="bsb-dot'+i+'" style="width:8px;height:8px;border-radius:50%;background:var(--text-muted);flex-shrink:0;"></div><div style="flex:1;font-size:10px;color:#3b82f6;word-break:break-all;font-family:var(--font-mono);">#'+__NX.bsbWallets.length+' '+w.address.slice(0,8)+'…'+w.address.slice(-6)+'</div><div id="bsb-lbl'+i+'" style="font-size:10px;color:var(--text-muted);flex-shrink:0;font-family:var(--font-mono);">Ready</div>';
            list.appendChild(d);
          }catch(e){__NX.bsbLog('❌ Key line '+(i+1)+' invalid','le');}
        });
        var sk=__NX.bsbGid('bsb-sKeys');if(sk)sk.textContent=__NX.bsbWallets.length;
        if(__NX.bsbWallets.length){
          var sb=__NX.bsbGid('bsb-startBtn');
          if(sb){sb.disabled=false;sb.style.opacity='1';}
          __NX.bsbLog('✅ '+__NX.bsbWallets.length+' keys loaded','lok');
        }
      };

      // ── Bot control ──
      window.bsbStartBot=async function(){
        if(!__NX.bsbWallets.length){__NX.bsbLog('❌ No keys loaded','le');return;}
        __NX.bsbRunning=true;window.bsbRunning=true;__NX.bsbCTxns=0;__NX.bsbCSwaps=0;__NX.bsbCErr=0;__NX.bsbUpd();
        if(typeof window.OneBGGuard!=='undefined')window.OneBGGuard.txStart(); // BG: wake lock
        var sb=__NX.bsbGid('bsb-startBtn'),sp=__NX.bsbGid('bsb-stopBtn');
        if(sb){sb.disabled=true;sb.style.opacity='0.4';}
        if(sp){sp.style.display='flex';}
        __NX.bsbLog('🚀 Bot started — '+__NX.bsbWallets.length+' key(s)','lok');
        __NX.bsbLog('');
        for(var i=0;i<__NX.bsbWallets.length;i++){
          if(!__NX.bsbRunning)break;
          await __NX.bsbProcessKey(__NX.bsbWallets[i]);
          if(i<__NX.bsbWallets.length-1){__NX.bsbLog('');__NX.bsbLog('⏳ Next key in 5s…','ld');await __NX.bsbSleep(5000);}
        }
        __NX.bsbRunning=false;window.bsbRunning=false;
        if(typeof window.OneBGGuard!=='undefined')window.OneBGGuard.txEnd(); // BG: release wake lock
        if(sb){sb.disabled=false;sb.style.opacity='1';}
        if(sp){sp.style.display='none';}
        __NX.bsbLog('');
        __NX.bsbLog('🏁 All done | UserOps: '+__NX.bsbCTxns+' | Errors: '+__NX.bsbCErr,'lok');
        __NX._bsbUpdateProfileBadge();
      };

      window.bsbStopBot=function(){
        __NX.bsbRunning=false;window.bsbRunning=false;
        if(typeof window.OneBGGuard!=='undefined')window.OneBGGuard.txEnd(); // BG: release wake lock
        __NX.bsbLog('⛔ Stopped','lw');
        var sb=__NX.bsbGid('bsb-startBtn'),sp=__NX.bsbGid('bsb-stopBtn');
        if(sb){sb.disabled=false;sb.style.opacity='1';}
        if(sp){sp.style.display='none';}
        __NX._bsbUpdateProfileBadge();
      };

      // ── Step navigation ──
      window.bsbGoStep=function(n){
        if(n<1||n>3)return;
        [1,2,3].forEach(function(i){
          var panel=__NX.bsbGid('bsb-step'+i);
          if(panel)panel.style.display=(i===n)?'block':'none';
          var sc=__NX.bsbGid('bsb-sc'+i);
          var si=__NX.bsbGid('bsb-si'+i);
          var conn=__NX.bsbGid('bsb-conn'+(i<3?i:''));
          if(sc)sc.textContent=i<n?'✓':String(i);
          if(si){
            si.style.opacity='1';
            if(i<n){sc.style.cssText='width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;border:2px solid #10b981;background:#10b981;color:#fff;font-family:var(--font-mono);';}
            else if(i===n){sc.style.cssText='width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;border:2px solid #3b82f6;background:#3b82f6;color:#fff;box-shadow:0 0 12px rgba(59,130,246,.4);font-family:var(--font-mono);';}
            else{sc.style.cssText='width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;border:2px solid var(--border-subtle);background:var(--bg-raised);color:var(--text-muted);font-family:var(--font-mono);';}
          }
          if(i<=2){var cn=__NX.bsbGid('bsb-conn'+i);if(cn)cn.style.background=i<n?'#10b981':'var(--border-subtle)';}
        });
        __NX.bsbCurrentStep=n;
        var cont=__NX.bsbGid('bsb-container');if(cont)cont.scrollTop=0;
      };

      window.bsbOpenWalletPicker = function() {
        var overlay = __NX.bsbGid('bsb-wallet-picker-overlay');
        if (!overlay) return;
        __NX._bsbPickerSelected    = new Set();
        __NX._bsbPickerExpanded    = new Set();
        __NX._bsbPickerIndivSelected = new Set();

        // Pre-select groups whose keys are already in the textarea
        var groups = (typeof loadWalletGroups === 'function') ? loadWalletGroups() : [];
        groups = groups.filter(function(g) { return g && g.keys && g.keys.length > 0; });
        var existingKeys = new Set();
        var area = __NX.bsbGid('bsb-keys');
        if (area && area.value.trim()) {
          area.value.trim().split('\n').forEach(function(k) {
            var t = k.trim(); if (t) existingKeys.add(t.toLowerCase());
          });
        }
        groups.forEach(function(g, i) {
          if (!g.keys || !g.keys.length) return;
          var allMatch = g.keys.every(function(pk) { return existingKeys.has((pk||'').trim().toLowerCase()); });
          if (allMatch && g.keys.length > 0) {
            __NX._bsbPickerSelected.add(i);
            g.keys.forEach(function(_, ki) { __NX._bsbPickerIndivSelected.add(i + '-' + ki); });
          }
        });

        __NX._bsbRenderList();

        overlay.style.display = 'block';
        overlay.style.background = 'rgba(5,5,8,0)';
        overlay.style.backdropFilter = 'blur(0px)';
        var drawer = __NX.bsbGid('bsb-wallet-picker-drawer');
        if (drawer) drawer.style.transform = 'translateX(100%)';
        requestAnimationFrame(function() {
          requestAnimationFrame(function() {
            overlay.style.background = 'rgba(5,5,8,0.75)';
            overlay.style.backdropFilter = 'blur(4px)';
            if (drawer) drawer.style.transform = 'translateX(0)';
          });
        });
      };

      window.bsbPickerToggle = function(idx) {
        var groups = (typeof loadWalletGroups === 'function') ? loadWalletGroups() : [];
        groups = groups.filter(function(g) { return g && g.keys && g.keys.length > 0; });
        if (__NX._bsbPickerSelected.has(idx)) {
          __NX._bsbPickerSelected.delete(idx);
          // Also deselect all individual keys of this group
          if (groups[idx]) {
            groups[idx].keys.forEach(function(_, ki) { __NX._bsbPickerIndivSelected.delete(idx+'-'+ki); });
          }
        } else {
          __NX._bsbPickerSelected.add(idx);
          // Also select all individual keys of this group
          if (groups[idx]) {
            groups[idx].keys.forEach(function(_, ki) { __NX._bsbPickerIndivSelected.add(idx+'-'+ki); });
          }
        }
        __NX._bsbRenderList();
        __NX._bsbSyncTextarea();
      };

      window.bsbPickerToggleExpand = function(idx) {
        if (__NX._bsbPickerExpanded.has(idx)) {
          __NX._bsbPickerExpanded.delete(idx);
        } else {
          __NX._bsbPickerExpanded.add(idx);
        }
        __NX._bsbRenderList();
      };

      window.bsbPickerToggleKey = function(gi, ki) {
        var groups = (typeof loadWalletGroups === 'function') ? loadWalletGroups() : [];
        groups = groups.filter(function(g) { return g && g.keys && g.keys.length > 0; });
        var indivKey = gi + '-' + ki;
        if (__NX._bsbPickerIndivSelected.has(indivKey)) {
          __NX._bsbPickerIndivSelected.delete(indivKey);
        } else {
          __NX._bsbPickerIndivSelected.add(indivKey);
        }
        // Sync group-level checkbox: selected if ALL keys individually selected
        if (groups[gi]) {
          var allSel = groups[gi].keys.every(function(_, k) { return __NX._bsbPickerIndivSelected.has(gi+'-'+k); });
          if (allSel) { __NX._bsbPickerSelected.add(gi); } else { __NX._bsbPickerSelected.delete(gi); }
        }
        __NX._bsbRenderList();
        __NX._bsbSyncTextarea();
      };

      window.bsbWalletPickerSelectAll = function() {
        var groups = (typeof loadWalletGroups === 'function') ? loadWalletGroups() : [];
        groups = groups.filter(function(g) { return g && g.keys && g.keys.length > 0; });
        var allSelected = __NX._bsbPickerSelected.size === groups.length;
        if (allSelected) {
          __NX._bsbPickerSelected = new Set();
          __NX._bsbPickerIndivSelected = new Set();
        } else {
          groups.forEach(function(g, i) {
            __NX._bsbPickerSelected.add(i);
            g.keys.forEach(function(_, ki) { __NX._bsbPickerIndivSelected.add(i+'-'+ki); });
          });
        }
        __NX._bsbRenderList();
        __NX._bsbSyncTextarea();
      };

      window.bsbApplyWalletPicker = function() {
        var groups = (typeof loadWalletGroups === 'function') ? loadWalletGroups() : [];
        groups = groups.filter(function(g) { return g && g.keys && g.keys.length > 0; });
        var allKeys = [];
        // Always use individual selection
        var ordered = [];
        __NX._bsbPickerIndivSelected.forEach(function(key) {
          var parts = key.split('-');
          ordered.push({ gi: parseInt(parts[0]), ki: parseInt(parts[1]) });
        });
        ordered.sort(function(a,b) { return a.gi !== b.gi ? a.gi - b.gi : a.ki - b.ki; });
        ordered.forEach(function(o) {
          if (groups[o.gi] && groups[o.gi].keys[o.ki]) {
            var raw = (groups[o.gi].keys[o.ki] || '').trim();
            if (raw) allKeys.push(raw);
          }
        });
        if (!allKeys.length) { bsbCloseWalletPicker(); return; }
        var area = __NX.bsbGid('bsb-keys');
        if (area) area.value = allKeys.join('\n');
        bsbCloseWalletPicker();
        bsbLoadKeys();
      };

      window.bsbCloseWalletPicker = function() {
        var overlay = __NX.bsbGid('bsb-wallet-picker-overlay');
        if (!overlay) return;
        var drawer = __NX.bsbGid('bsb-wallet-picker-drawer');
        overlay.style.background = 'rgba(5,5,8,0)';
        overlay.style.backdropFilter = 'blur(0px)';
        if (drawer) drawer.style.transform = 'translateX(100%)';
        setTimeout(function() { overlay.style.display = 'none'; }, 320);
      };

      // ── Right-swipe to close (attached once) ──
      (function() {
        var attached = false;
        var _origBsbOpen = window.bsbOpenWalletPicker;
        window.bsbOpenWalletPicker = function() {
          _origBsbOpen.apply(this, arguments);
          if (attached) return;
          attached = true;
          var drawer = document.getElementById('bsb-wallet-picker-drawer');
          if (!drawer) return;
          var startX = 0, startY = 0, tracking = false, swiping = false;
          drawer.addEventListener('touchstart', function(e) {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            tracking = true; swiping = false;
          }, { passive: true });
          drawer.addEventListener('touchmove', function(e) {
            if (!tracking) return;
            var dx = e.touches[0].clientX - startX;
            var dy = Math.abs(e.touches[0].clientY - startY);
            if (!swiping && Math.abs(dx) > 8) {
              if (Math.abs(dx) > dy) { swiping = true; }
              else { tracking = false; return; }
            }
            if (swiping && dx > 0) {
              drawer.style.transition = 'none';
              drawer.style.transform = 'translateX(' + dx + 'px)';
            }
          }, { passive: true });
          drawer.addEventListener('touchend', function(e) {
            if (!swiping) { tracking = false; return; }
            var dx = e.changedTouches[0].clientX - startX;
            drawer.style.transition = '';
            if (dx > 72) {
              window.bsbCloseWalletPicker && window.bsbCloseWalletPicker();
            } else {
              drawer.style.transform = 'translateX(0)';
            }
            tracking = false; swiping = false;
          }, { passive: true });
        };
      })();

      // Init log
      __NX.bsbLog('🦄 Base Swap Bot ready','lok');
      __NX.bsbLog('👉 Load keys then tap Start','la2');

      // ── Auto-restore saved PM URL ──
      (function(){
        try{
          // Read from unified key first, fall back to legacy one_bsb_pm
          var saved=localStorage.getItem('one_paymaster_url')||localStorage.getItem('one_bsb_pm');
          if(saved&&saved.trim()){
            var el=__NX.bsbGid('bsb-pm');
            if(el)el.value=saved.trim();
          }
        }catch(_){}
      })();

    })();
    