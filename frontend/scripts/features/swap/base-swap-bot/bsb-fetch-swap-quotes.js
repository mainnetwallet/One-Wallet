// Base swap bot: fetch all swap quotes and pick the best
// Part of the Base swap bot module (split by topic; no logic change).
(function (__NX) {
  __NX.bsbFetchAllSwaps = bsbFetchAllSwaps;


      // ── bsbFetchAllSwaps: সব API থেকে সব valid route collect করে array হিসেবে return করে ──
      //   amMin/amMax দিলে প্রতিটা API নিজে আলাদা random amount নিয়ে fetch করে।
      //   route object-এ amtWei সেভ থাকে — execute করার সময় সঠিক approve amount ব্যবহার হয়।
      async function bsbFetchAllSwaps(fromAddr, toAddr, amtWei, fromDec, walletAddr, chainId_sw, slip_sw, amMin, amMax) {
        chainId_sw = chainId_sw || 8453;
        slip_sw    = (slip_sw != null && slip_sw > 0) ? slip_sw : 15;
        // Use the single canonical key from _API_KEYS — duplicate local definition removed.
        var INCH_KEY = (typeof _API_KEYS !== 'undefined' && _API_KEYS.INCH_API) ? _API_KEYS.INCH_API : '';

        // ── প্রতিটা API-এর জন্য আলাদা random amount তৈরি করে ──
        //   amMin/amMax দেওয়া থাকলে random, না হলে caller-দেওয়া amtWei ব্যবহার করো
        function _rndAmt() {
          if (amMin != null && amMax != null && amMax > amMin) {
            var tokens = BigInt(Math.floor(Math.random() * (amMax - amMin + 1)) + amMin);
            return tokens * (10n ** BigInt(fromDec || 18));
          }
          return BigInt(amtWei);
        }

        var apiFns = [
          // 1) Odos
          async function() {
            try {
              var _amt = _rndAmt();
              var qr = await fetch('https://api.odos.xyz/sor/quote/v2', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ chainId:chainId_sw, inputTokens:[{tokenAddress:fromAddr,amount:String(_amt)}], outputTokens:[{tokenAddress:toAddr,proportion:1}], userAddr:walletAddr, slippageLimitPercent:slip_sw, compact:true }), signal:AbortSignal.timeout(20000) });
              if(!qr.ok) return null; var qj = await qr.json(); if(!qj.pathId) return null;
              var ar = await fetch('https://api.odos.xyz/sor/assemble', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ pathId:qj.pathId, userAddr:walletAddr, simulate:false }), signal:AbortSignal.timeout(20000) });
              if(!ar.ok) return null; var aj = await ar.json(); if(!aj.transaction||!aj.transaction.to) return null;
              return { to:aj.transaction.to, data:aj.transaction.data, value:aj.transaction.value||'0x0', gas:Number(aj.transaction.gas)||300000, src:'Odos', amtWei:_amt };
            } catch(e){ return null; }
          },
          // 2) 1inch v6
          async function() {
            try {
              var _amt = _rndAmt();
              var params = new URLSearchParams({ src:fromAddr, dst:toAddr, amount:String(_amt), from:walletAddr, slippage:slip_sw.toFixed(2), disableEstimate:'true', allowPartialFill:'false' });
              var r = await fetch('https://api.1inch.dev/swap/v6.0/'+chainId_sw+'/swap?'+params, { headers:{'Authorization':'Bearer '+INCH_KEY,'Accept':'application/json'}, signal:AbortSignal.timeout(20000) });
              if(!r.ok) return null; var j = await r.json(); if(!j.tx||!j.tx.to) return null;
              return { to:j.tx.to, data:j.tx.data, value:j.tx.value&&j.tx.value!=='0'?j.tx.value:'0x0', gas:Number(j.tx.gas)||300000, src:'1inch', amtWei:_amt };
            } catch(e){ return null; }
          },
          // 3) KyberSwap
          async function() {
            try {
              var _amt = _rndAmt();
              var KYBER_CHAIN = {1:'ethereum',56:'bsc',137:'polygon',42161:'arbitrum',10:'optimism',8453:'base',43114:'avalanche',250:'fantom',324:'zksync',59144:'linea',534352:'scroll',81457:'blast'};
              var slug = KYBER_CHAIN[chainId_sw] || String(chainId_sw);
              var rr = await fetch('https://aggregator-api.kyberswap.com/'+slug+'/api/v1/routes?tokenIn='+fromAddr+'&tokenOut='+toAddr+'&amountIn='+String(_amt)+'&origin='+walletAddr, { headers:{'X-Client-Id':'OneWallet'}, signal:AbortSignal.timeout(20000) });
              if(!rr.ok) return null; var rj = await rr.json(); if(!rj.data||!rj.data.routeSummary) return null;
              var er = await fetch('https://aggregator-api.kyberswap.com/'+slug+'/api/v1/route/build', { method:'POST', headers:{'Content-Type':'application/json','X-Client-Id':'OneWallet'}, body:JSON.stringify({ routeSummary:rj.data.routeSummary, sender:walletAddr, recipient:walletAddr, slippageTolerance:Math.round(slip_sw*100), deadline:Math.floor(Date.now()/1000)+1200 }), signal:AbortSignal.timeout(20000) });
              if(!er.ok) return null; var ej = await er.json(); if(!ej.data||!ej.data.data) return null;
              return { to:rj.data.routerAddress, data:ej.data.data, value:'0x0', gas:Number(rj.data.routeSummary.gas)||300000, src:'KyberSwap', amtWei:_amt };
            } catch(e){ return null; }
          },
          // 4) OpenOcean v4
          async function() {
            try {
              var _amt = _rndAmt();
              var OO_CHAINS = {1:'eth',56:'bsc',137:'polygon',42161:'arbitrum',10:'optimism',8453:'base',43114:'avax',250:'fantom',324:'zksync',59144:'linea',534352:'scroll',81457:'blast'};
              var ooSlug = OO_CHAINS[chainId_sw]; if(!ooSlug) return null;
              var humanAmt = (Number(_amt) / Math.pow(10, fromDec||18)).toFixed(8);
              var r = await fetch('https://open-api.openocean.finance/v4/'+ooSlug+'/swap?inTokenAddress='+fromAddr+'&outTokenAddress='+toAddr+'&amount='+humanAmt+'&slippage='+slip_sw+'&account='+walletAddr+'&gasPrice=5', { signal:AbortSignal.timeout(20000) });
              if(!r.ok) return null; var j = await r.json(); if(!j.data||!j.data.to) return null;
              return { to:j.data.to, data:j.data.data, value:j.data.value||'0x0', gas:Number(j.data.estimatedGas)||300000, src:'OpenOcean', amtWei:_amt };
            } catch(e){ return null; }
          },
          // 5) SwapApi.dev
          async function() {
            try {
              var _amt = _rndAmt();
              var maxSlip = (slip_sw/100).toFixed(4);
              var r = await fetch('https://api.swapapi.dev/v1/swap/'+chainId_sw+'?tokenIn='+fromAddr+'&tokenOut='+toAddr+'&amount='+String(_amt)+'&sender='+walletAddr+'&maxSlippage='+maxSlip, { signal:AbortSignal.timeout(20000) });
              if(!r.ok) return null; var j = await r.json(); if(!j.success||!j.data||!j.data.tx||!j.data.tx.to) return null;
              return { to:j.data.tx.to, data:j.data.tx.data, value:j.data.tx.value||'0x0', gas:Number(j.data.tx.gas)||300000, src:'SwapApi', amtWei:_amt };
            } catch(e){ return null; }
          },
          // 6) LiFi — multi-route (প্রতিটা tool আলাদা route)
          async function() {
            try {
              var _amt = _rndAmt();
              var body = { fromChainId:chainId_sw, toChainId:chainId_sw, fromTokenAddress:fromAddr, toTokenAddress:toAddr, fromAmount:String(_amt), fromAddress:walletAddr, options:{ slippage:slip_sw/100, integrator:'OneWallet', order:'RECOMMENDED' } };
              var rr = await fetch('https://li.quest/v1/advanced/routes', { method:'POST', headers:{'Content-Type':'application/json','x-lifi-api-key':'b3e55edd-de70-4578-b761-cd2aac0fbae0.685a5adf-2580-486e-a8ff-1df4992b3f2e'}, body:JSON.stringify(body), signal:AbortSignal.timeout(20000) });
              if(!rr.ok) return [];
              var rj = await rr.json(); var allRoutes = rj.routes||[]; if(!allRoutes.length) return [];
              var results = []; var seenTools = {};
              for(var ri=0; ri<allRoutes.length; ri++) {
                var rt2 = allRoutes[ri]; var step = rt2.steps&&rt2.steps[0]; if(!step) continue;
                var toolName = (step.toolDetails&&step.toolDetails.name)||step.tool||'LiFi';
                if(seenTools[toolName]) continue; seenTools[toolName]=1;
                try {
                  var tr = await fetch('https://li.quest/v1/advanced/stepTransaction', { method:'POST', headers:{'Content-Type':'application/json','x-lifi-api-key':'b3e55edd-de70-4578-b761-cd2aac0fbae0.685a5adf-2580-486e-a8ff-1df4992b3f2e'}, body:JSON.stringify(Object.assign({}, step, {fromAddress:walletAddr, toAddress:walletAddr})), signal:AbortSignal.timeout(20000) });
                  if(!tr.ok) continue; var tj = await tr.json(); if(!tj.transactionRequest||!tj.transactionRequest.to) continue;
                  results.push({ to:tj.transactionRequest.to, data:tj.transactionRequest.data, value:tj.transactionRequest.value||'0x0', gas:Number(tj.transactionRequest.gasLimit)||400000, src:'LiFi('+toolName+')', amtWei:_amt });
                } catch(e2){ continue; }
              }
              return results;
            } catch(e){ return []; }
          },
          // 7) Enso Finance
          async function() {
            try {
              var _amt = _rndAmt();
              var url = 'https://api.enso.finance/api/v1/shortcuts/route?chainId='+chainId_sw+'&fromAddress='+walletAddr+'&spender='+walletAddr+'&receiver='+walletAddr+'&amountIn='+String(_amt)+'&tokenIn='+fromAddr+'&tokenOut='+toAddr+'&slippage='+Math.round(slip_sw*100);
              var r = await fetch(url, { headers:{'Content-Type':'application/json'}, signal:AbortSignal.timeout(20000) });
              if(!r.ok) return null; var j = await r.json(); if(!j.tx||!j.tx.to) return null;
              return { to:j.tx.to, data:j.tx.data, value:j.tx.value?('0x'+BigInt(j.tx.value).toString(16)):'0x0', gas:Number(j.gas)||300000, src:'Enso', amtWei:_amt };
            } catch(e){ return null; }
          },
          // 8) Symbiosis
          async function() {
            try {
              var _amt = _rndAmt();
              var BSB_SYM_CHAINS = {1:1,56:56,137:137,42161:42161,10:10,8453:8453,43114:43114,250:250,1101:1101,59144:59144,534352:534352,81457:81457};
              if(!BSB_SYM_CHAINS[chainId_sw]) return null;
              var body = { tokenAmountIn:{chainId:chainId_sw,address:fromAddr,amount:String(_amt),decimals:fromDec||18,symbol:''}, tokenOut:{chainId:chainId_sw,address:toAddr,decimals:18,symbol:''}, from:walletAddr, to:walletAddr, revertableAddress:walletAddr, slippage:Math.round(slip_sw*100) };
              var r = await fetch('https://api.symbiosis.finance/crosschain/v1/swap', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body), signal:AbortSignal.timeout(20000) });
              if(!r.ok) return null; var j = await r.json(); if(!j.tx||!j.tx.to) return null;
              return { to:j.tx.to, data:j.tx.data, value:j.tx.value?('0x'+BigInt(String(j.tx.value)).toString(16)):'0x0', gas:Number(j.tx.gas)||400000, src:'Symbiosis', amtWei:_amt };
            } catch(e){ return null; }
          },
          // 9) Socket (Bungee)
          async function() {
            try {
              var _amt = _rndAmt();
              var url = 'https://public-backend.bungee.exchange/api/v1/bungee/quote?userAddress='+walletAddr+'&receiverAddress='+walletAddr+'&originChainId='+chainId_sw+'&destinationChainId='+chainId_sw+'&inputToken='+fromAddr+'&outputToken='+toAddr+'&inputAmount='+String(_amt)+'&slippage='+slip_sw.toFixed(1)+'&enableManual=true&disableAuto=true';
              var r = await fetch(url, { signal:AbortSignal.timeout(20000) });
              if(!r.ok) return null; var j = await r.json(); var routes = (j.result&&j.result.manualRoutes)||[]; if(!routes.length||!routes[0].quoteId) return null;
              var br = await fetch('https://public-backend.bungee.exchange/api/v1/bungee/build-tx?quoteId='+encodeURIComponent(routes[0].quoteId), { signal:AbortSignal.timeout(20000) });
              if(!br.ok) return null; var bj = await br.json(); if(!bj.result||!bj.result.txData||!bj.result.txData.to) return null;
              var bv = bj.result.txData.value; var hexVal = (!bv||bv==='0'||bv==='0x0')?'0x0':(String(bv).startsWith('0x')?bv:'0x'+BigInt(String(bv)).toString(16));
              return { to:bj.result.txData.to, data:bj.result.txData.data, value:hexVal, gas:Number(routes[0].gasFee&&routes[0].gasFee.gasLimit)||350000, src:'Socket', amtWei:_amt };
            } catch(e){ return null; }
          },
          // 10) Rango — multi-route via /routing/bests
          async function() {
            try {
              var _amt = _rndAmt();
              var RANGO_CHAIN = {1:'ETH',56:'BSC',137:'POLYGON',42161:'ARBITRUM',10:'OPTIMISM',8453:'BASE',43114:'AVAX_CCHAIN'};
              var RANGO_NATIVE = {1:'ETH',56:'BNB',137:'MATIC',42161:'ETH',10:'ETH',8453:'ETH',43114:'AVAX'};
              var bc = RANGO_CHAIN[chainId_sw]; if(!bc) return [];
              var nativeSym = RANGO_NATIVE[chainId_sw]||'ETH';
              var isFromNat = (fromAddr==='0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'||fromAddr==='0x0000000000000000000000000000000000000000');
              var isToNat   = (toAddr==='0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'||toAddr==='0x0000000000000000000000000000000000000000');
              var fromSym2 = isFromNat ? nativeSym : '';
              var toSym2   = isToNat   ? nativeSym : '';
              var amtHuman = String(Number(_amt)/Math.pow(10,fromDec||18));
              var rbody = { from:{ blockchain:bc, symbol:fromSym2, address:isFromNat?null:fromAddr }, to:{ blockchain:bc, symbol:toSym2, address:isToNat?null:toAddr }, amount:amtHuman, slippage:String(slip_sw), checkPrerequisites:false, selectedWallets:{ [bc]:walletAddr } };
              var rr = await fetch('https://api.rango.exchange/routing/bests?limit=20&apiKey='+window._ONE_RANGO_KEY, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(rbody), signal:AbortSignal.timeout(20000) });
              if(!rr.ok) return [];
              var rj = await rr.json(); var rangoRoutes = rj.results||[]; if(!rangoRoutes.length) return [];
              var results = [];
              for(var ri=0; ri<rangoRoutes.length; ri++) {
                var rt2 = rangoRoutes[ri]; var swaps2 = rt2.swaps||[];
                var swapper = (swaps2[0]&&swaps2[0].swapperId)||'Rango';
                var outHuman = rt2.outputAmount||'0';
                var outWei = (parseFloat(outHuman)*Math.pow(10,18)).toFixed(0);
                if(outWei==='0'||outWei==='NaN') continue;
                try {
                  var swapUrl = 'https://api.rango.exchange/basic/swap?from='+encodeURIComponent(bc+'--'+(isFromNat?fromSym2:fromAddr))+'&to='+encodeURIComponent(bc+'--'+(isToNat?toSym2:toAddr))+'&amount='+amtHuman+'&slippage='+slip_sw+'&fromAddress='+walletAddr+'&toAddress='+walletAddr+'&disableEstimate=true&apiKey='+window._ONE_RANGO_KEY+'&swappers='+encodeURIComponent(swapper);
                  var sr = await fetch(swapUrl, { signal:AbortSignal.timeout(20000) });
                  if(!sr.ok) continue; var sj = await sr.json(); if(sj.resultType!=='OK'||!sj.tx||!sj.tx.txData) continue;
                  var rv = sj.tx.value; var hexVal = (!rv||rv==='0'||rv==='0x0')?'0x0':(String(rv).startsWith('0x')?rv:'0x'+BigInt(String(rv)).toString(16));
                  results.push({ to:sj.tx.txTo, data:sj.tx.txData, value:hexVal, gas:Number(sj.tx.gasLimit)||300000, src:'Rango('+swapper+')', amtWei:_amt });
                } catch(e2){ continue; }
              }
              return results;
            } catch(e){ return []; }
          },
          // 11) Velora
          async function() {
            try {
              var _amt = _rndAmt();
              var pr = await fetch('https://api.velora.xyz/prices/?srcToken='+fromAddr+'&destToken='+toAddr+'&amount='+String(_amt)+'&srcDecimals='+(fromDec||18)+'&destDecimals=18&side=SELL&network='+chainId_sw+'&userAddress='+walletAddr+'&version=6.2&partner=one-wallet&ignoreBadUsdPrice=true', { signal:AbortSignal.timeout(20000) });
              if(!pr.ok) return null; var pj = await pr.json(); if(!pj.priceRoute) return null;
              var body = { srcToken:pj.priceRoute.srcToken, srcDecimals:pj.priceRoute.srcDecimals||(fromDec||18), destToken:pj.priceRoute.destToken, destDecimals:pj.priceRoute.destDecimals||18, srcAmount:String(_amt), slippage:Math.round(slip_sw*100), priceRoute:pj.priceRoute, userAddress:walletAddr, partner:'OneWallet', deadline:Math.floor(Date.now()/1000)+1800 };
              var tr = await fetch('https://api.velora.xyz/transactions/'+chainId_sw+'?ignoreGasEstimate=true', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body), signal:AbortSignal.timeout(20000) });
              if(!tr.ok) return null; var tj = await tr.json(); if(!tj.to||!tj.data) return null;
              return { to:tj.to, data:tj.data, value:tj.value!=null?String(tj.value):'0x0', gas:Number(pj.priceRoute.gasCost)||300000, src:'Velora', amtWei:_amt };
            } catch(e){ return null; }
          },
          // 12) DODO SmartTrade
          async function() {
            try {
              var _amt = _rndAmt();
              var DODO_CHAINS = {1:1,10:10,56:56,137:137,8453:8453,42161:42161,43114:43114,534352:534352,59144:59144,5000:5000,169:169};
              if(!DODO_CHAINS[chainId_sw]) return null;
              var humanAmt = String(Number(_amt));
              var params = new URLSearchParams({ chainId:String(chainId_sw), fromAmount:humanAmt, fromTokenAddress:fromAddr, toTokenAddress:toAddr, apikey:'317de7e2d83f1f6b96', slippage:String(slip_sw/100), userAddr:walletAddr });
              var r = await fetch('https://api.dodoex.io/route-service/developer/swap?'+params, { signal:AbortSignal.timeout(20000) });
              if(!r.ok) return null; var j = await r.json(); if(j.status!==200||!j.data||!j.data.to||!j.data.data) return null;
              var dv = j.data.value; var dhex = (!dv||dv==='0'||dv==='0x0')?'0x0':(String(dv).startsWith('0x')?dv:'0x'+BigInt(String(dv)).toString(16));
              return { to:j.data.to, data:j.data.data, value:dhex, gas:350000, src:'DODO', amtWei:_amt };
            } catch(e){ return null; }
          },
          // 14) Portals.fi
          async function() {
            try {
              var _amt = _rndAmt();
              var PORTALS_NET = {1:'ethereum',56:'bsc',137:'polygon',8453:'base',42161:'arbitrum',10:'optimism',43114:'avalanche',250:'fantom',324:'zksync',100:'gnosis',1101:'polygon-zkevm',59144:'linea',534352:'scroll',81457:'blast'};
              var net = PORTALS_NET[chainId_sw]; if(!net) return null;
              var inputTok = net+':'+fromAddr;
              var outputTok = net+':'+toAddr;
              var url = 'https://api.portals.fi/v2/portal?inputToken='+encodeURIComponent(inputTok)+'&inputAmount='+String(_amt)+'&outputToken='+encodeURIComponent(outputTok)+'&sender='+walletAddr+'&slippageTolerancePercentage='+slip_sw.toFixed(1)+'&validate=false';
              var r = await fetch(url, { signal:AbortSignal.timeout(20000) });
              if(!r.ok) return null; var j = await r.json(); if(!j.tx||!j.tx.to||!j.tx.data) return null;
              var pv = j.tx.value||j.context&&j.context.value; var phex = (!pv||pv==='0'||pv==='0x0')?'0x0':(String(pv).startsWith('0x')?pv:'0x'+BigInt(String(pv)).toString(16));
              return { to:j.tx.to, data:j.tx.data, value:phex, gas:Number(j.context&&j.context.gasLimit)||350000, src:'Portals', amtWei:_amt };
            } catch(e){ return null; }
          },
          // 16) Fly (prev. Magpie Protocol)
          async function() {
            try {
              var _amt = _rndAmt();
              var FLY_NETS = {1:'ethereum',56:'bsc',137:'polygon',8453:'base',42161:'arbitrum',10:'optimism',43114:'avalanche',250:'fantom',324:'zksync',59144:'linea',534352:'scroll',81457:'blast',1101:'polygonzk'};
              var net = FLY_NETS[chainId_sw]; if(!net) return null;
              var FLY_NATIVE = '0x0000000000000000000000000000000000000000';
              var mFrom = fromAddr.toLowerCase()==='0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'?FLY_NATIVE:fromAddr;
              var mTo = toAddr.toLowerCase()==='0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'?FLY_NATIVE:toAddr;
              var qurl = 'https://api.fly.trade/aggregator/quote?network='+net+'&fromTokenAddress='+mFrom+'&toTokenAddress='+mTo+'&sellAmount='+String(_amt)+'&slippage='+(slip_sw/100).toFixed(4)+'&fromAddress='+walletAddr+'&toAddress='+walletAddr+'&gasless=false';
              var qr = await fetch(qurl, { signal:AbortSignal.timeout(20000) });
              if(!qr.ok) return null; var qj = await qr.json(); if(!qj.id) return null;
              var txurl = 'https://api.fly.trade/aggregator/transaction?quoteId='+qj.id+'&estimateGas=false';
              var tr = await fetch(txurl, { signal:AbortSignal.timeout(20000) });
              if(!tr.ok) return null; var tj = await tr.json(); if(!tj.to||!tj.data) return null;
              var mgv = tj.value; var mghex = (!mgv||mgv==='0'||mgv==='0x0')?'0x0':(String(mgv).startsWith('0x')?mgv:'0x'+BigInt(String(mgv)).toString(16));
              return { to:tj.to, data:tj.data, value:mghex, gas:Number(tj.gasLimit)||350000, src:'Fly', amtWei:_amt };
            } catch(e){ return null; }
          },
          // 15) OKX DEX — per-DEX multi-route
          async function() {
            try {
              var OKX_CHAINS = {1:'1',56:'56',137:'137',8453:'8453',42161:'42161',10:'10',43114:'43114',324:'324',59144:'59144',534352:'534352',81457:'81457'};
              var ci = OKX_CHAINS[chainId_sw]; if(!ci) return [];
              var OKX_NATIVE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
              var isFromNat2 = (fromAddr==='0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'||fromAddr==='0x0000000000000000000000000000000000000000');
              var isToNat2   = (toAddr==='0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'||toAddr==='0x0000000000000000000000000000000000000000');
              var fAddr = isFromNat2 ? OKX_NATIVE : fromAddr;
              var tAddr = isToNat2   ? OKX_NATIVE : toAddr;
              var _amt = _rndAmt();
              var OKX_KEY='4ea63ec2-cc07-4855-98e9-37cece4bd3ff',OKX_SECRET='CB2465C6DBB02286A8427B1CE9EFAEAC',OKX_PASS='ak01ALim@';
              async function _bsbOkxGet(path) {
                var ts = new Date().toISOString().replace(/\.([0-9]{3})Z$/,'.000Z');
                var ph = ts+'GET'+path;
                var kb = new TextEncoder().encode(OKX_SECRET), mb = new TextEncoder().encode(ph);
                var ck = await crypto.subtle.importKey('raw',kb,{name:'HMAC',hash:'SHA-256'},false,['sign']);
                var sg = await crypto.subtle.sign('HMAC',ck,mb);
                var sign = btoa(String.fromCharCode(...new Uint8Array(sg)));
                return window.oneSignedFetch('https://www.okx.com'+path,{ms:20000,headers:{'OK-ACCESS-KEY':OKX_KEY,'OK-ACCESS-SIGN':sign,'OK-ACCESS-TIMESTAMP':ts,'OK-ACCESS-PASSPHRASE':OKX_PASS,'Content-Type':'application/json'}});
              }
              var liqR = await _bsbOkxGet('/api/v6/dex/aggregator/get-liquidity?chainIndex='+ci);
              if(!liqR.ok) return [];
              var liqJ = await liqR.json(); if(liqJ.code!=='0'||!Array.isArray(liqJ.data)||!liqJ.data.length) return [];
              var allDexes = liqJ.data;
              var baseQ = 'chainIndex='+ci+'&amount='+String(_amt)+'&fromTokenAddress='+fAddr+'&toTokenAddress='+tAddr+'&swapMode=exactIn';
              async function _bsbOkxOneDex(dex) {
                try {
                  var r = await _bsbOkxGet('/api/v6/dex/aggregator/quote?'+baseQ+'&dexIds='+dex.id);
                  if(!r.ok) return null; var j = await r.json(); if(j.code!=='0'||!j.data||!j.data[0]) return null;
                  var outWei = String(j.data[0].toTokenAmount||'0'); if(!outWei||outWei==='0') return null;
                  var txR = await _bsbOkxGet('/api/v6/dex/aggregator/swap?'+baseQ+'&dexIds='+dex.id+'&userWalletAddress='+walletAddr+'&slippage='+(slip_sw/100).toFixed(4));
                  if(!txR.ok) return null; var txJ = await txR.json(); if(txJ.code!=='0'||!txJ.data||!txJ.data[0]||!txJ.data[0].tx) return null;
                  var tx = txJ.data[0].tx; if(!tx.to||!tx.data) return null;
                  var oxv = tx.value; var oxhex = (!oxv||oxv==='0'||oxv==='0x0')?'0x0':(String(oxv).startsWith('0x')?oxv:'0x'+BigInt(String(oxv)).toString(16));
                  return { to:tx.to, data:tx.data, value:oxhex, gas:Number(tx.gas)||350000, src:'OKX('+dex.name+')', amtWei:_amt };
                } catch(e){ return null; }
              }
              var perDexP = allDexes.map(function(dex,idx){ return new Promise(function(res){ setTimeout(function(){ _bsbOkxOneDex(dex).then(res); },idx*150); }); });
              var perDexR = await Promise.all(perDexP);
              return perDexR.filter(Boolean);
            } catch(e){ return []; }
          },
          // 16) Squid Router
          async function() {
            try {
              var _amt = _rndAmt();
              var sqFrom = (fromAddr==='0x0000000000000000000000000000000000000000')?'0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE':fromAddr;
              var sqTo   = (toAddr==='0x0000000000000000000000000000000000000000')?'0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE':toAddr;
              var r = await fetch('https://v2.api.squidrouter.com/v2/route',{ method:'POST', headers:{'Content-Type':'application/json','x-integrator-id':'one-wallet-8a0ab990-3b1a-4445-83aa-52d3b7471357'}, body:JSON.stringify({ fromChain:String(chainId_sw), toChain:String(chainId_sw), fromToken:sqFrom, toToken:sqTo, fromAmount:String(_amt), fromAddress:walletAddr, toAddress:walletAddr, slippage:Number(slip_sw) }), signal:AbortSignal.timeout(20000) });
              if(!r.ok) return null; var j = await r.json(); var route = j.route; if(!route||!route.estimate) return null;
              var tx = route.transactionRequest; if(!tx||!tx.target||!tx.data) return null;
              var sqv = tx.value; var sqhex = (!sqv||sqv==='0'||sqv==='0x0')?'0x0':(String(sqv).startsWith('0x')?sqv:'0x'+BigInt(String(sqv)).toString(16));
              return { to:tx.target, data:tx.data, value:sqhex, gas:Number(tx.gasLimit)||400000, src:'Squid', amtWei:_amt };
            } catch(e){ return null; }
          },
        ];
        // সব API parallel — array ও single result উভয়ই flatten করো
        var results = await Promise.allSettled(apiFns.map(function(fn){ return fn(); }));
        var validRoutes = [];
        results.forEach(function(r){
          if(r.status!=='fulfilled'||!r.value) return;
          var val = r.value;
          if(Array.isArray(val)) {
            val.forEach(function(v){ if(v&&v.to&&v.data) validRoutes.push(v); });
          } else if(val.to&&val.data) {
            validRoutes.push(val);
          }
        });
        return validRoutes;
      }

      // backward-compat shim (পুরনো কোড যদি bsbFetchBestSwap call করে)
      async function bsbFetchBestSwap(fromAddr, toAddr, amtWei, fromDec, walletAddr, chainId_sw, slip_sw) {
        var all = await bsbFetchAllSwaps(fromAddr, toAddr, amtWei, fromDec, walletAddr, chainId_sw, slip_sw);
        return all.length ? all[0] : null;
      }
})((window.__nxp = window.__nxp || {}).mod_base_swap_bot = window.__nxp.mod_base_swap_bot || {});
