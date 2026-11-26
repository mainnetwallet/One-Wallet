// Base swap bot: UserOp building, DEX list, ABIs and per-key processing
// Part of the Base swap bot module (split by topic; no logic change).
(function (__NX) {
  __NX.bsbProcessKey = bsbProcessKey;


      // ── bsbBuildUserOp: nonce + gasMul দিয়ে একটা signed UserOp build করে ──
      //   gasMul = 100 মানে normal, 110 মানে +10%, 120 মানে +20% gas price
      async function bsbBuildUserOp(scAddr, callData, nonce, signer, chainId, pmUrl, gasMul) {
        gasMul = gasMul || 100;
        var BASE_FEE    = ethers.parseUnits('0.01', 'gwei');
        var BASE_PRIO   = 1000000n;
        // gasMul দিয়ে scale করো — 110 হলে BASE * 110 / 100
        var maxFee      = (BASE_FEE    * BigInt(gasMul)) / 100n;
        var maxPriority = (BASE_PRIO   * BigInt(gasMul)) / 100n;
        if (maxPriority < 1000000n) maxPriority = 1000000n;
        if (maxFee < maxPriority)   maxFee = maxPriority;

        var realCallData = callData || '0x';
        var baseOp = {sender:scAddr, nonce:__NX.bsbToHex(nonce), initCode:'0x', callData:realCallData, callGasLimit:'0x0', verificationGasLimit:'0x0', preVerificationGas:'0x0', maxFeePerGas:__NX.bsbToHex(maxFee), maxPriorityFeePerGas:__NX.bsbToHex(maxPriority), paymasterAndData:'0x', signature:__NX.BSB_DUMMY_SIG};
        var stubRes = await __NX.bsbPmFetch(pmUrl, 'pm_getPaymasterStubData', [baseOp, __NX.BSB_EP, __NX.BSB_CHAIN_HEX, {}]);
        var stubPmd = stubRes.paymasterAndData || '0x';
        var opForEst = {...baseOp, paymasterAndData:stubPmd};
        var gasRes = await __NX.bsbPmFetch(pmUrl, 'eth_estimateUserOperationGas', [opForEst, __NX.BSB_EP]);
        var callGasLimit        = BigInt(gasRes.callGasLimit        || '0x0');
        var verificationGasLimit = BigInt(gasRes.verificationGasLimit || '0x0');
        var preVerificationGas  = BigInt(gasRes.preVerificationGas  || '0x0');
        var opForPm = {sender:scAddr, nonce:__NX.bsbToHex(nonce), initCode:'0x', callData:realCallData, callGasLimit:__NX.bsbToHex(callGasLimit), verificationGasLimit:__NX.bsbToHex(verificationGasLimit), preVerificationGas:__NX.bsbToHex(preVerificationGas), maxFeePerGas:__NX.bsbToHex(maxFee), maxPriorityFeePerGas:__NX.bsbToHex(maxPriority), paymasterAndData:stubPmd, signature:__NX.BSB_DUMMY_SIG};
        var pmRes = await __NX.bsbPmFetch(pmUrl, 'pm_getPaymasterData', [opForPm, __NX.BSB_EP, __NX.BSB_CHAIN_HEX, {}]);
        var paymasterAndData = pmRes.paymasterAndData || '0x';
        var finalOp = {...opForPm, paymasterAndData:paymasterAndData, signature:__NX.BSB_DUMMY_SIG};
        var userOpHash = __NX.bsbGetUserOpHash(finalOp, chainId);
        finalOp.signature = await __NX.bsbSignUserOp(userOpHash, signer);
        return finalOp;
      }

      // ── bsbBuildAndSendUserOp ──
      //   • নতুন nonce cache করে — সফল swap-এর পর nonce+1 (onchain call ছাড়া)
      //   • AA25  → onchain থেকে fresh nonce নিয়ে rebuild, সর্বোচ্চ 3 বার
      //   • Replacement underpriced → same nonce, gas price +10% করে rebuild, সর্বোচ্চ 3 বার
      async function bsbBuildAndSendUserOp(params){
        var scAddr=params.scAddr, callData=params.callData, signer=params.signer;
        var provider=params.provider, chainId=params.chainId, pmUrl=params.pmUrl;
        var nonceRef = params._nonceRef; // { value: BigInt } — shared mutable nonce holder

        // ── Nonce নির্ধারণ: cache-এ থাকলে সেটা, না হলে onchain থেকে fetch ──
        var nonce;
        if (nonceRef && nonceRef.value != null) {
          nonce = nonceRef.value;
          __NX.bsbLog('  🔢 Nonce (cached): '+nonce.toString(), 'ld');
        } else {
          nonce = await __NX.bsbGetNonce(scAddr, provider);
          __NX.bsbLog('  🔢 Nonce (onchain): '+nonce.toString(), 'ld');
          if (nonceRef) nonceRef.value = nonce;
        }

        var MAX_RETRY = 3;
        var retryCount = 0;
        var gasMul = 100; // শুরুতে normal gas (100%)

        while (retryCount < MAX_RETRY) {
          try {
            // UserOp build + sign (gasMul দিয়ে gas price scale হয়)
            var finalOp = await bsbBuildUserOp(scAddr, callData, nonce, signer, chainId, pmUrl, gasMul);
            var opHash = await __NX.bsbSendOp(finalOp, pmUrl);
            __NX.bsbLog('  📤 UserOp sent: '+opHash+(gasMul>100?' [gas +'+( gasMul-100)+'%]':''), 'la');
            __NX.bsbCTxns++; __NX.bsbUpd();

            // ✅ confirm wait নেই — সাথে সাথে nonce +1 করে পরের tnx পাঠাও
            if (nonceRef) {
              nonceRef.value = nonce + 1n;
              __NX.bsbLog('  ✅ Nonce advanced → '+nonceRef.value.toString()+' (no-wait)', 'ld');
            }
            return opHash;

          } catch(e) {
            var msg = (e.message || '');
            var isAA25        = msg.includes('AA25') || msg.toLowerCase().includes('invalid account nonce');
            var isUnderpriced = msg.toLowerCase().includes('replacement underpriced');

            // ── AA25: onchain থেকে fresh nonce নিয়ে rebuild ──
            if (isAA25 && retryCount < MAX_RETRY - 1) {
              retryCount++;
              __NX.bsbLog('  ⚠️ AA25 — onchain থেকে fresh nonce নিচ্ছি… (retry '+retryCount+'/'+MAX_RETRY+')', 'lw');
              await __NX.bsbSleep(600);
              try {
                nonce = await __NX.bsbGetNonce(scAddr, provider);
                __NX.bsbLog('  🔢 Fresh nonce (onchain): '+nonce.toString(), 'ld');
                if (nonceRef) nonceRef.value = nonce;
              } catch(ne) {
                __NX.bsbLog('  ⚠️ getNonce failed: '+ne.message.slice(0,60), 'lw');
              }
              // gasMul রিসেট না — আগে যা ছিল সেটাই রাখো
              continue;
            }

            // ── Replacement underpriced: onchain থেকে latest nonce + gas +10% করে rebuild ──
            if (isUnderpriced && retryCount < MAX_RETRY - 1) {
              retryCount++;
              gasMul = gasMul + 10; // প্রতি retry তে +10% (100→110→120)
              __NX.bsbLog('  ⚠️ Replacement underpriced — onchain latest nonce নিচ্ছি + gas +'+(gasMul-100)+'% (retry '+retryCount+'/'+MAX_RETRY+')', 'lw');
              await __NX.bsbSleep(800);
              try {
                nonce = await __NX.bsbGetNonce(scAddr, provider);
                __NX.bsbLog('  🔢 Latest nonce (onchain): '+nonce.toString(), 'ld');
                if (nonceRef) nonceRef.value = nonce;
              } catch(ne) {
                __NX.bsbLog('  ⚠️ getNonce failed: '+ne.message.slice(0,60), 'lw');
              }
              continue;
            }

            // অন্য error বা max retry শেষ → throw
            throw e;
          }
        }
      }

      // ── DEX configs — read from Step 1 inputs ──
      function bsbGetDexes(){
        function ga(id){try{return ethers.getAddress(__NX.bsbGid(id).value.trim());}catch(e){return __NX.bsbGid(id).value.trim();}}
        function gf(id){var el=__NX.bsbGid(id);return el?parseInt(el.value)||3000:3000;}
        return [
          {name:'Aerodrome',  type:'aerodrome', emoji:'🚀', router:ga('bsb-aero-router'),    factory:ga('bsb-aero-factory'), fee:gf('bsb-aero-fee')},
          {name:'BaseSwap',   type:'v2',        emoji:'🔵', router:ga('bsb-baseswap-router'),  fee:gf('bsb-baseswap-fee')},
          {name:'SwapBased',  type:'v2',        emoji:'⚡', router:ga('bsb-swapbased-router'), fee:gf('bsb-swapbased-fee')},
          {name:'RocketSwap', type:'v2',        emoji:'🚀', router:ga('bsb-rocketswap-router'),fee:gf('bsb-rocketswap-fee')},
          {name:'Alien Base V2',type:'v2',      emoji:'👽', router:ga('bsb-alienbase-router'), fee:gf('bsb-alienbase-fee')},
          {name:'SushiSwap V3',type:'v3',       emoji:'🍣', nfpm:ga('bsb-sushi-nfpm'), fee:parseInt(__NX.bsbGid('bsb-sushi-fee').value)},
          {name:'PancakeSwap V3',type:'v3',     emoji:'🥞', nfpm:ga('bsb-cake-nfpm'),  fee:parseInt(__NX.bsbGid('bsb-cake-fee').value)},
        ];
      }
      var BSB_V2_ABI = ["function addLiquidity(address tokenA,address tokenB,uint amountADesired,uint amountBDesired,uint amountAMin,uint amountBMin,address to,uint deadline) returns(uint,uint,uint)"];
      var BSB_AERO_ROUTER_ABI = ["function addLiquidity(address tokenA,address tokenB,bool stable,uint amountADesired,uint amountBDesired,uint amountAMin,uint amountBMin,address to,uint deadline) returns(uint,uint,uint)"];
      var BSB_AERO_FACTORY_ABI = ["function createPool(address tokenA,address tokenB,bool stable) returns(address pool)"];
      var BSB_V3_NFPM_ABI = ["function createAndInitializePoolIfNecessary(address token0,address token1,uint24 fee,uint160 sqrtPriceX96) returns(address pool)","function mint((address token0,address token1,uint24 fee,int24 tickLower,int24 tickUpper,uint256 amount0Desired,uint256 amount1Desired,uint256 amount0Min,uint256 amount1Min,address recipient,uint256 deadline) params) returns(uint256,uint128,uint256,uint256)"];
      var BSB_PERMIT2_ABI = ["function approve(address token,address spender,uint160 amount,uint48 expiration)","function allowance(address owner,address token,address spender) view returns(uint160 amount,uint48 expiration,uint48 nonce)"];
      var BSB_POS_MGR_ABI = ["function modifyLiquidities(bytes calldata unlockData,uint256 deadline) payable","function initializePool((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) key,uint160 sqrtPriceX96) returns(int24 tick)"];

      function bsbSortKey(a,b,fee,tick){
        var c0,c1;if(a.toLowerCase()<b.toLowerCase()){c0=a;c1=b;}else{c0=b;c1=a;}
        return{currency0:c0,currency1:c1,fee:fee,tickSpacing:tick,hooks:__NX.BSB_ADDR0};
      }

      // ── Process one key ──
      async function bsbProcessKey(wi){
        var key=wi.key,addr=wi.addr,idx=wi.idx;
        var rpcUrls=[__NX.bsbGid('bsb-rpc').value.trim(),__NX.bsbGid('bsb-rpc2').value.trim(),__NX.bsbGid('bsb-rpc3').value.trim()].filter(Boolean);
        var pmUrl=__NX.bsbGid('bsb-pm').value;
        var chainId=parseInt(__NX.bsbGid('bsb-chainId').value);
        var fee=parseInt(__NX.bsbGid('bsb-fee').value);
        var tick=parseInt(__NX.bsbGid('bsb-tick').value);
        var posMgrAddr=ethers.getAddress(__NX.bsbGid('bsb-posMgr').value.trim());
        var routerAddr=ethers.getAddress(__NX.bsbGid('bsb-router').value.trim());
        var p2Addr=ethers.getAddress(__NX.bsbGid('bsb-p2').value.trim());
        var lqMin=parseInt(__NX.bsbGid('bsb-lqMin').value);
        var lqMax=parseInt(__NX.bsbGid('bsb-lqMax').value);

        var provider;
        for(var i=0;i<rpcUrls.length;i++){
          try{var p=window._thMakeProvider(rpcUrls[i]);await p.getBlockNumber();provider=p;__NX.bsbLog('  ✅ RPC: '+rpcUrls[i].slice(0,30)+'…','lok');break;}
          catch(e){__NX.bsbLog('  ⚠️ RPC failed: '+rpcUrls[i].slice(0,30)+'…','lw');}
        }
        if(!provider)throw new Error('All RPCs failed');

        var signer=new ethers.Wallet(key,provider);
        var scAddr=addr;
        var short=addr.slice(0,8)+'…'+addr.slice(-6);
        var seed=idx*37+__NX.bsbRnd(0,999);
        var infoA=__NX.bsbGenName(seed);
        var infoB=__NX.bsbGenName(seed+73);
        var supplyA=__NX.bsbGenSupply();
        var supplyB=__NX.bsbGenSupply();

        __NX.bsbLog('');
        __NX.bsbLog('🔑 KEY #'+(idx+1)+' | '+short,'la');
        __NX.bsbLog('');
        __NX.bsbSetDot(idx,'run','Running…');

        try{
          // ── Nonce Tracker: এই wallet-এর সব swap একই nonce track করবে ──
          //   প্রতিটা সফল swap-এর পর nonce+1, AA25 হলে onchain থেকে refresh করে।
          var _walletNonceRef = { value: null }; // null = প্রথমে onchain থেকে fetch করবে
          var aaCtx={signer,provider,chainId,pmUrl,scAddr,_nonceRef:_walletNonceRef};

          // Deploy tokens
          __NX.bsbLog('📦 Deploying tokens: '+infoA.symbol+' + '+infoB.symbol,'la2');
          var tokenA,tokenB;
          try{
            var dA=__NX.bsbGetDeployCalldata(infoA.name,infoA.symbol,supplyA,scAddr);
            var dB=__NX.bsbGetDeployCalldata(infoB.name,infoB.symbol,supplyB,scAddr);
            tokenA=__NX.bsbComputeCreate2Addr(dA.salt,dA.initcode,dA.CREATE2);
            tokenB=__NX.bsbComputeCreate2Addr(dB.salt,dB.initcode,dA.CREATE2);
            var deployCD=__NX.bsbExecBatchCalldata([dA.CREATE2,dA.CREATE2],[0n,0n],[dA.deployerCalldata,dB.deployerCalldata]);
            await bsbBuildAndSendUserOp({...aaCtx,callData:deployCD});
            __NX.bsbLog('  ✅ '+infoA.symbol+': '+tokenA,'lok');
            __NX.bsbLog('  ✅ '+infoB.symbol+': '+tokenB,'lok');
            __NX.bsbLog('');
          }catch(e){__NX.bsbLog('  ❌ Deploy: '+e.message.slice(0,100),'le');__NX.bsbCErr++;__NX.bsbUpd();__NX.bsbSetDot(idx,'err','Failed');return;}

          await __NX.bsbRdly();if(!__NX.bsbRunning)return;

          var poolKey=bsbSortKey(tokenA,tokenB,fee,tick);
          var erc20If=new ethers.Interface(__NX.BSB_ERC20_ABI);
          var p2If=new ethers.Interface(BSB_PERMIT2_ABI);
          var posIf=new ethers.Interface(BSB_POS_MGR_ABI);
          var aeroFIf=new ethers.Interface(BSB_AERO_FACTORY_ABI);
          var aeroRIf=new ethers.Interface(BSB_AERO_ROUTER_ABI);
          var v2If=new ethers.Interface(BSB_V2_ABI);
          var v3If=new ethers.Interface(BSB_V3_NFPM_ABI);
          var abi=ethers.AbiCoder.defaultAbiCoder();
          var deadline=Math.floor(Date.now()/1000)+600;
          var pct=__NX.bsbRnd(lqMin,lqMax);
          var liqA=(supplyA*BigInt(pct))/100n;
          var liqB=(supplyB*BigInt(pct))/100n;
          var dexAmt=(liqA<liqB?liqA:liqB)/7n;

          __NX.bsbLog('💧 Adding liquidity to DEX pools…','la2');

          var BSB_DEXES=bsbGetDexes();

          // V4 init + approve + modifyLiquidities
          var p2Exp=Math.floor(Date.now()/1000)+86400*30;
          var amt0Max=liqA+liqA/10n,amt1Max=liqB+liqB/10n;
          var v4Actions=ethers.hexlify(new Uint8Array([0x02,0x0d]));
          var liquidity=liqA<liqB?liqA:liqB;
          var mintParams=abi.encode(['(address,address,uint24,int24,address)','int24','int24','uint256','uint128','uint128','address','bytes'],[[poolKey.currency0,poolKey.currency1,poolKey.fee,poolKey.tickSpacing,poolKey.hooks],-887220,887220,liquidity,amt0Max,amt1Max,scAddr,'0x']);
          var settleParams=abi.encode(['address','address'],[poolKey.currency0,poolKey.currency1]);
          var unlockData=abi.encode(['bytes','bytes[]'],[v4Actions,[mintParams,settleParams]]);
          var modifyData=posIf.encodeFunctionData('modifyLiquidities',[unlockData,deadline]);
          var v4InitData=posIf.encodeFunctionData('initializePool',[poolKey,__NX.BSB_SQRT_1_1]);

          var aeroDex=BSB_DEXES[0],v2Dex=BSB_DEXES[1],sbDex=BSB_DEXES[2];
          var rktDex=BSB_DEXES[3],alienDex=BSB_DEXES[4],sushiDex=BSB_DEXES[5],cakeDex=BSB_DEXES[6];
          var sTok0=tokenA.toLowerCase()<tokenB.toLowerCase()?tokenA:tokenB;
          var sTok1=tokenA.toLowerCase()<tokenB.toLowerCase()?tokenB:tokenA;

          try{
            __NX.bsbLog('  🚀 Batch 1: V4 + Aerodrome + BaseSwap + SwapBased','lw');
            var t1=[posMgrAddr,tokenA,tokenB,p2Addr,p2Addr,posMgrAddr,aeroDex.factory,tokenA,tokenB,aeroDex.router,tokenA,tokenB,v2Dex.router,tokenA,tokenB,sbDex.router];
            var c1=[v4InitData,erc20If.encodeFunctionData('approve',[p2Addr,ethers.MaxUint256]),erc20If.encodeFunctionData('approve',[p2Addr,ethers.MaxUint256]),p2If.encodeFunctionData('approve',[poolKey.currency0,posMgrAddr,amt0Max,p2Exp]),p2If.encodeFunctionData('approve',[poolKey.currency1,posMgrAddr,amt1Max,p2Exp]),modifyData,aeroFIf.encodeFunctionData('createPool',[tokenA,tokenB,false]),erc20If.encodeFunctionData('approve',[aeroDex.router,dexAmt]),erc20If.encodeFunctionData('approve',[aeroDex.router,dexAmt]),aeroRIf.encodeFunctionData('addLiquidity',[tokenA,tokenB,false,dexAmt,dexAmt,0n,0n,scAddr,deadline]),erc20If.encodeFunctionData('approve',[v2Dex.router,dexAmt]),erc20If.encodeFunctionData('approve',[v2Dex.router,dexAmt]),v2If.encodeFunctionData('addLiquidity',[tokenA,tokenB,dexAmt,dexAmt,0n,0n,scAddr,deadline]),erc20If.encodeFunctionData('approve',[sbDex.router,dexAmt]),erc20If.encodeFunctionData('approve',[sbDex.router,dexAmt]),v2If.encodeFunctionData('addLiquidity',[tokenA,tokenB,dexAmt,dexAmt,0n,0n,scAddr,deadline])];
            await bsbBuildAndSendUserOp({...aaCtx,callData:__NX.bsbExecBatchCalldata(t1,t1.map(function(){return 0n;}),c1)});
            __NX.bsbLog('');

            await __NX.bsbRdly();if(!__NX.bsbRunning)return;

            __NX.bsbLog('  🚀 Batch 2: RocketSwap + AlienBase','lw');
            var t2=[tokenA,tokenB,rktDex.router,tokenA,tokenB,alienDex.router];
            var c2=[erc20If.encodeFunctionData('approve',[rktDex.router,dexAmt]),erc20If.encodeFunctionData('approve',[rktDex.router,dexAmt]),v2If.encodeFunctionData('addLiquidity',[tokenA,tokenB,dexAmt,dexAmt,0n,0n,scAddr,deadline]),erc20If.encodeFunctionData('approve',[alienDex.router,dexAmt]),erc20If.encodeFunctionData('approve',[alienDex.router,dexAmt]),v2If.encodeFunctionData('addLiquidity',[tokenA,tokenB,dexAmt,dexAmt,0n,0n,scAddr,deadline])];
            await bsbBuildAndSendUserOp({...aaCtx,callData:__NX.bsbExecBatchCalldata(t2,t2.map(function(){return 0n;}),c2)});
            __NX.bsbLog('');

            await __NX.bsbRdly();if(!__NX.bsbRunning)return;

            __NX.bsbLog('  🚀 Batch 3: SushiSwap + PancakeSwap','lw');
            var t3=[sushiDex.nfpm,sTok0,sTok1,sushiDex.nfpm,cakeDex.nfpm,sTok0,sTok1,cakeDex.nfpm];
            var c3=[v3If.encodeFunctionData('createAndInitializePoolIfNecessary',[sTok0,sTok1,sushiDex.fee,__NX.BSB_SQRT_1_1]),erc20If.encodeFunctionData('approve',[sushiDex.nfpm,dexAmt]),erc20If.encodeFunctionData('approve',[sushiDex.nfpm,dexAmt]),v3If.encodeFunctionData('mint',[{token0:sTok0,token1:sTok1,fee:sushiDex.fee,tickLower:-887220,tickUpper:887220,amount0Desired:dexAmt,amount1Desired:dexAmt,amount0Min:0n,amount1Min:0n,recipient:scAddr,deadline:deadline}]),v3If.encodeFunctionData('createAndInitializePoolIfNecessary',[sTok0,sTok1,cakeDex.fee,__NX.BSB_SQRT_1_1]),erc20If.encodeFunctionData('approve',[cakeDex.nfpm,dexAmt]),erc20If.encodeFunctionData('approve',[cakeDex.nfpm,dexAmt]),v3If.encodeFunctionData('mint',[{token0:sTok0,token1:sTok1,fee:cakeDex.fee,tickLower:-887220,tickUpper:887220,amount0Desired:dexAmt,amount1Desired:dexAmt,amount0Min:0n,amount1Min:0n,recipient:scAddr,deadline:deadline}])];
            await bsbBuildAndSendUserOp({...aaCtx,callData:__NX.bsbExecBatchCalldata(t3,t3.map(function(){return 0n;}),c3)});
            __NX.bsbLog('');
            __NX.bsbLog('  ✅ ALL pools done 🎉','lok');
          }catch(e){__NX.bsbLog('  ❌ Liquidity: '+e.message.slice(0,120),'le');__NX.bsbCErr++;__NX.bsbUpd();}

          // ── SWAP LOOP — swTarget = মোট swap সংখ্যা (Swaps per Key range থেকে)
          //   প্রতিটা batch-এ সব API একসাথে fetch → সব route একটা একটা execute
          //   সব route শেষ হলে আবার নতুন করে সব API fetch → swTarget পূরণ পর্যন্ত ──
          await __NX.bsbRdly(); if(!__NX.bsbRunning) return;

          var swTarget = __NX.bsbRnd(
            parseInt(__NX.bsbGid('bsb-swMin').value) || 20,
            parseInt(__NX.bsbGid('bsb-swMax').value) || 30
          );
          var amMin = parseInt(__NX.bsbGid('bsb-amMin').value) || 1000;
          var amMax = parseInt(__NX.bsbGid('bsb-amMax').value) || 5000;
          var chainId_sw = parseInt(__NX.bsbGid('bsb-chainId').value) || 8453;
          var slip_sw = parseFloat(document.getElementById('bsb-slip-val') && document.getElementById('bsb-slip-val').value || 15) || 15;

          var ERC20_APPROVE_ABI = ['function approve(address spender, uint256 amount) returns (bool)'];
          var approveIf = new ethers.Interface(ERC20_APPROVE_ABI);
          var tokA_addr = tokenA;
          var tokB_addr = tokenB;
          var tokA_dec = 18; var tokB_dec = 18;

          var swapDone = 0;   // সফল swap counter
          var swapIter = 0;   // direction alternator

          __NX.bsbLog('🔄 Target: '+swTarget+' swaps per wallet — route fetch → execute → আবার fetch…','la2');

          // swTarget পূরণ না হওয়া পর্যন্ত loop চলবে
          while(swapDone < swTarget && __NX.bsbRunning) {

            var isAtoB = (swapIter % 2 === 0);
            var fromA     = isAtoB ? tokA_addr : tokB_addr;
            var toA       = isAtoB ? tokB_addr : tokA_addr;
            var fromDec_sw = isAtoB ? tokA_dec : tokB_dec;
            var swAmtTokens = BigInt(__NX.bsbRnd(amMin, amMax));
            var swAmtWei    = swAmtTokens * (10n ** BigInt(fromDec_sw));
            var dirLabel    = (isAtoB ? infoA.symbol : infoB.symbol)+' → '+(isAtoB ? infoB.symbol : infoA.symbol);

            __NX.bsbLog('','');
            __NX.bsbLog('📡 ['+swapDone+'/'+swTarget+'] '+dirLabel+' — সব API আলাদা random amount দিয়ে route fetch করছি…','lw');

            try {
              // সব 11টা API parallel call — প্রতিটা API নিজে আলাদা random amount নেয়
              var allRoutes = await __NX.bsbFetchAllSwaps(fromA, toA, String(swAmtWei), fromDec_sw, scAddr, chainId_sw, slip_sw, amMin, amMax);

              if(!allRoutes || !allRoutes.length) {
                __NX.bsbLog('  ⚠️ কোনো route পাওয়া যায়নি — 3s পরে আবার try…','lw');
                swapIter++;
                await __NX.bsbSleep(3000);
                continue;
              }

              __NX.bsbLog('  🗺️ '+allRoutes.length+' route: ['+allRoutes.map(function(r){return r.src+'('+( r.amtWei ? (r.amtWei/(10n**BigInt(fromDec_sw))).toString() : '?')+')';}).join(' | ')+']','ld');

              // প্রতিটা route = আলাদা swap — swTarget হলে বন্ধ
              for(var ri=0; ri<allRoutes.length && swapDone<swTarget && __NX.bsbRunning; ri++) {
                var route = allRoutes[ri];
                // route.amtWei = ওই API-এর নিজের random amount (approve এও এটাই লাগবে)
                var routeAmt = route.amtWei || swAmtWei;
                var routeTokens = routeAmt / (10n ** BigInt(fromDec_sw));
                __NX.bsbLog('  🔄 Swap #'+(swapDone+1)+'/'+swTarget+' via ['+route.src+'] ('+routeTokens+' tokens)…','la2');
                try {
                  var approveCd  = approveIf.encodeFunctionData('approve', [route.to, routeAmt]);
                  var swTargets2 = [fromA, route.to];
                  var swValues2  = [0n, route.value && route.value !== '0x0' ? BigInt(route.value) : 0n];
                  var swCdatas2  = [approveCd, route.data];
                  var swBatch    = __NX.bsbExecBatchCalldata(swTargets2, swValues2, swCdatas2);
                  await bsbBuildAndSendUserOp({...aaCtx, callData: swBatch});
                  swapDone++;
                  __NX.bsbCSwaps++;
                  __NX.bsbUpd();
                  __NX.bsbLog('    ✅ ['+route.src+'] সফল! ('+swapDone+'/'+swTarget+')','lok');
                } catch(e) {
                  __NX.bsbLog('    ❌ ['+route.src+']: '+(e.message||'').slice(0,100),'le');
                  __NX.bsbCErr++; __NX.bsbUpd();
                }
                if(swapDone < swTarget && __NX.bsbRunning) await __NX.bsbSleep(200);
              }

            } catch(e) {
              __NX.bsbLog('  ❌ Fetch error: '+(e.message||'').slice(0,100),'le');
              await __NX.bsbSleep(2000);
            }

            swapIter++;
            // এই batch-এর সব route শেষ, swTarget বাকি → আবার নতুন API fetch
            if(swapDone < swTarget && __NX.bsbRunning) {
              __NX.bsbLog('  ♻️ সব route execute শেষ — API থেকে নতুন route আনছি… ('+swapDone+'/'+swTarget+')','ld');
              await __NX.bsbSleep(1200);
            }
          }

          __NX.bsbLog('','');
          __NX.bsbLog('  ✅ Swaps complete: '+swapDone+'/'+swTarget+' done','lok');

          __NX.bsbLog('');
          __NX.bsbLog('✅ KEY #'+(idx+1)+' COMPLETE','lok');
          __NX.bsbSetDot(idx,'ok','Done ✅');

        }catch(e){
          __NX.bsbLog('❌ Fatal key #'+(idx+1)+': '+e.message.slice(0,120),'le');
          __NX.bsbSetDot(idx,'err','Fatal ❌');
          __NX.bsbCErr++;__NX.bsbUpd();
        }
      }
})((window.__nxp = window.__nxp || {}).mod_base_swap_bot = window.__nxp.mod_base_swap_bot || {});
