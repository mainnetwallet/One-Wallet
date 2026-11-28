// Base swap bot: state, constants, helpers, log, ERC20 deploy and UserOp send/wait helpers
// Part of the Base swap bot module (split by topic; no logic change).
(function (__NX) {
  __NX.bsbGenName = bsbGenName;
  __NX.bsbGenSupply = bsbGenSupply;
  __NX.bsbRnd = bsbRnd;
  __NX.bsbSleep = bsbSleep;
  __NX.bsbRdly = bsbRdly;
  __NX.bsbGid = bsbGid;
  __NX.bsbToHex = bsbToHex;
  __NX.bsbLog = bsbLog;
  __NX._bsbUpdateProfileBadge = _bsbUpdateProfileBadge;
  __NX.bsbUpd = bsbUpd;
  __NX.bsbSetDot = bsbSetDot;
  __NX.bsbGetDeployCalldata = bsbGetDeployCalldata;
  __NX.bsbComputeCreate2Addr = bsbComputeCreate2Addr;
  __NX.bsbExecBatchCalldata = bsbExecBatchCalldata;
  __NX.bsbGetNonce = bsbGetNonce;
  __NX.bsbSignUserOp = bsbSignUserOp;
  __NX.bsbGetUserOpHash = bsbGetUserOpHash;
  __NX.bsbPmFetch = bsbPmFetch;
  __NX.bsbSendOp = bsbSendOp;

      __NX.bsbWallets = [];
  __NX.bsbRunning = false;
  __NX.bsbCTxns = 0;
  __NX.bsbCSwaps = 0;
  __NX.bsbCErr = 0;
      __NX.bsbCurrentStep = 2;
      var BSB_EP = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"; __NX.BSB_EP = BSB_EP;
      var BSB_ADDR0 = "0x0000000000000000000000000000000000000000"; __NX.BSB_ADDR0 = BSB_ADDR0;
      var BSB_SQRT_1_1 = 79228162514264337593543950336n; __NX.BSB_SQRT_1_1 = BSB_SQRT_1_1;
      var BSB_CHAIN_HEX = "0x2105"; __NX.BSB_CHAIN_HEX = BSB_CHAIN_HEX;
      var BSB_DUMMY_SIG = "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000041fffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c00000000000000000000000000000000000000000000000000000000000000"; __NX.BSB_DUMMY_SIG = BSB_DUMMY_SIG;

      var BSB_PRE = ["Apex","Nova","Flux","Vega","Zeta","Orion","One","Lumen","Helix","Axia","Qubit","Prism","Drift","Polaris","Cipher","Blaze","Echo","Titan","Pulse","Astra"];
      var BSB_SUF = ["Protocol","Finance","Network","Exchange","Capital","Yield","Bridge","Vault","DAO","Labs","Index","Swap","AI","Fund","Chain","X","Edge","Base","Hub","Core"];
      var BSB_SFX = ["X","Z","FI","AI","IO","DAO","PRO","NET","EX","HUB"];

      function bsbGenName(s){return{name:BSB_PRE[s%BSB_PRE.length]+' '+BSB_SUF[(s*7+3)%BSB_SUF.length],symbol:BSB_PRE[s%BSB_PRE.length].slice(0,3).toUpperCase()+BSB_SFX[(s*13+5)%BSB_SFX.length]};}
      function bsbGenSupply(){var s=[1000000000n,800000000n,10000000000n,2000000000n];return s[Math.floor(Math.random()*4)]*10n**18n;}
      function bsbRnd(a,b){return Math.floor(Math.random()*(b-a+1))+a;}
      function bsbSleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
      function bsbRdly(){return bsbSleep(bsbRnd(parseInt(document.getElementById('bsb-dlMin').value)||2000,parseInt(document.getElementById('bsb-dlMax').value)||5000));}
      function bsbGid(id){return document.getElementById(id);}
      var _bsbSlipIds = ['bsb-slip-01','bsb-slip-05','bsb-slip-10','bsb-slip-30','bsb-slip-15']; __NX._bsbSlipIds = _bsbSlipIds;
      function bsbToHex(val){var h=BigInt(val).toString(16);return'0x'+(h==='0'?'0':h);}

      // ── Log ──
      function bsbLog(msg,cls){
        cls=cls||'li';
        var b=bsbGid('bsb-logBox');
        if(!b)return;
        if(!msg){var d=document.createElement('div');d.style.height='7px';b.appendChild(d);b.scrollTop=b.scrollHeight;return;}
        var d=document.createElement('div');
        var linked=msg.replace(/(0x[0-9a-fA-F]{64})/g,function(hash){return'<a href="https://basescan.org/tx/'+hash+'" target="_blank" style="color:#60a5fa;text-decoration:underline">'+hash.slice(0,14)+'…<span style="font-size:10px">↗</span></a>';});
        linked=linked.replace(/(0x[0-9a-fA-F]{40})(?![0-9a-fA-F])/g,function(addr){return'<a href="https://basescan.org/address/'+addr+'" target="_blank" style="color:#a78bfa;text-decoration:underline">'+addr.slice(0,10)+'…<span style="font-size:10px">↗</span></a>';});
        var colorMap={li:'#94a3b8',lok:'#10b981',lw:'#f59e0b',le:'#ef4444',la:'#3b82f6',la2:'#8b5cf6',lb:'',ld:'#334155'};
        d.style.color=colorMap[cls]||'#94a3b8';
        if(cls==='lb')d.style.fontWeight='bold';
        d.innerHTML=linked;
        b.appendChild(d);b.scrollTop=b.scrollHeight;
      }
      function _bsbUpdateProfileBadge(){
        var pill=document.getElementById('bsb-status-pill');
        if(pill){
          pill.classList.toggle('bsb-running',!!__NX.bsbRunning);
          var pl=pill.querySelector('span');if(pl)pl.textContent=__NX.bsbRunning?'Running':'Idle';
        }
        var badge=document.getElementById('bsb-menu-indicator');
        if(!badge)return;
        if(__NX.bsbRunning){
          badge.innerHTML='<div style="font-size:9px;color:#10b981;font-family:var(--font-mono);font-weight:700;background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.35);border-radius:6px;padding:2px 9px;letter-spacing:1px;animation:_bsb_pulse 1.5s ease-in-out infinite;">LIVE</div>';
        }else{
          badge.innerHTML='<span class="material-icons-round" style="font-size:18px;color:var(--text-muted)">chevron_right</span>';
        }
      }
      function bsbUpd(){
        var e=bsbGid('bsb-sTxns');if(e)e.textContent=__NX.bsbCTxns;
        e=bsbGid('bsb-sSwaps');if(e)e.textContent=__NX.bsbCSwaps;
        e=bsbGid('bsb-sErr');if(e)e.textContent=__NX.bsbCErr;
        _bsbUpdateProfileBadge();
      }

      function bsbSetDot(i,c,t){
        var d=bsbGid('bsb-dot'+i),l=bsbGid('bsb-lbl'+i);
        var cMap={run:'#f59e0b',ok:'#10b981',err:'#ef4444'};
        if(d)d.style.background=cMap[c]||'var(--text-muted)';
        if(l)l.textContent=t;
      }

      // ── ERC20 Bytecode & ABI ──
      var BSB_ERC20_BYTECODE = "0x608060405234801562000010575f80fd5b50604051620013d8380380620013d8833981810160405281019062000036919062000331565b835f90816200004691906200060c565b5082600190816200005891906200060c565b50816002819055508160035f8373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f20819055508073ffffffffffffffffffffffffffffffffffffffff165f73ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef8460405162000101919062000701565b60405180910390a3505050506200071c565b5f604051905090565b5f80fd5b5f80fd5b5f80fd5b5f80fd5b5f601f19601f8301169050919050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52604160045260245ffd5b62000174826200012c565b810181811067ffffffffffffffff821117156200019657620001956200013c565b5b80604052505050565b5f620001aa62000113565b9050620001b8828262000169565b919050565b5f67ffffffffffffffff821115620001da57620001d96200013c565b5b620001e5826200012c565b9050602081019050919050565b5f5b8381101562000211578082015181840152602081019050620001f4565b5f8484015250505050565b5f620002326200022c84620001bd565b6200019f565b90508281526020810184848401111562000251576200025062000128565b5b6200025e848285620001f2565b509392505050565b5f82601f8301126200027d576200027c62000124565b5b81516200028f8482602086016200021c565b91505092915050565b5f819050919050565b620002ac8162000298565b8114620002b7575f80fd5b50565b5f81519050620002ca81620002a1565b92915050565b5f73ffffffffffffffffffffffffffffffffffffffff82169050919050565b5f620002fb82620002d0565b9050919050565b6200030d81620002ef565b811462000318575f80fd5b50565b5f815190506200032b8162000302565b92915050565b5f805f80608085870312156200034c576200034b6200011c565b5b5f85015167ffffffffffffffff8111156200036c576200036b62000120565b5b6200037a8782880162000266565b945050602085015167ffffffffffffffff8111156200039e576200039d62000120565b5b620003ac8782880162000266565b9350506040620003bf87828801620002ba565b9250506060620003d2878288016200031b565b91505092959194509250565b5f81519050919050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52602260045260245ffd5b5f60028204905060018216806200042d57607f821691505b602082108103620004435762000442620003e8565b5b50919050565b5f819050815f5260205f209050919050565b5f6020601f8301049050919050565b5f82821b905092915050565b5f60088302620004a77fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff826200046a565b620004b386836200046a565b95508019841693508086168417925050509392505050565b5f819050919050565b5f620004f4620004ee620004e88462000298565b620004cb565b62000298565b9050919050565b5f819050919050565b6200050f83620004d4565b620005276200051e82620004fb565b84845462000476565b825550505050565b5f90565b6200053d6200052f565b6200054a81848462000504565b505050565b5b818110156200057157620005655f8262000533565b60018101905062000550565b5050565b601f821115620005c0576200058a8162000449565b62000595846200045b565b81016020851015620005a5578190505b620005bd620005b4856200045b565b8301826200054f565b50505b505050565b5f82821c905092915050565b5f620005e25f1984600802620005c5565b1980831691505092915050565b5f620005fc8383620005d1565b9150826002028217905092915050565b6200061782620003de565b67ffffffffffffffff8111156200063357620006326200013c565b5b6200063f825462000415565b6200064c82828562000575565b5f60209050601f83116001811462000682575f84156200066d578287015190505b620006798582620005ef565b865550620006e8565b601f198416620006928662000449565b5f5b82811015620006bb5784890151825560018201915060208501945060208101905062000694565b86831015620006db5784890151620006d7601f891682620005d1565b8355505b6001600288020188555050505b505050505050565b620006fb8162000298565b82525050565b5f602082019050620007165f830184620006f0565b92915050565b610cae806200072a5f395ff3fe608060405234801561000f575f80fd5b5060043610610091575f3560e01c8063313ce56711610064578063313ce5671461013157806370a082311461014f57806395d89b411461017f578063a9059cbb1461019d578063dd62ed3e146101cd57610091565b806306fdde0314610095578063095ea7b3146100b357806318160ddd146100e357806323b872dd14610101575b5f80fd5b61009d6101fd565b6040516100aa9190610914565b60405180910390f35b6100cd60048036038101906100c891906109c5565b610288565b6040516100da9190610a1d565b60405180910390f35b6100eb610375565b6040516100f89190610a45565b60405180910390f35b61011b60048036038101906101169190610a5e565b61037b565b6040516101289190610a1d565b60405180910390f35b610139610640565b6040516101469190610ac9565b60405180910390f35b61016960048036038101906101649190610ae2565b610645565b6040516101769190610a45565b60405180910390f35b61018761065a565b6040516101949190610914565b60405180910390f35b6101b760048036038101906101b291906109c5565b6106e6565b6040516101c49190610a1d565b60405180910390f35b6101e760048036038101906101e29190610b0d565b61086a565b6040516101f49190610a45565b60405180910390f35b5f805461020990610b78565b80601f016020809104026020016040519081016040528092919081815260200182805461023590610b78565b80156102805780601f1061025757610100808354040283529160200191610280565b820191905f5260205f20905b81548152906001019060200180831161026357829003601f168201915b505050505081565b5f8160045f3373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f8573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f20819055508273ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff167f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925846040516103639190610a45565b60405180910390a36001905092915050565b60025481565b5f8160035f8673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205410156103fc576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016103f390610bf2565b60405180910390fd5b8160045f8673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f3373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205410156104b7576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004016104ae90610c5a565b60405180910390fd5b8160045f8673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f3373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f82825403925050819055508160035f8673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f82825403925050819055508160035f8573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f82825401925050819055508273ffffffffffffffffffffffffffffffffffffffff168473ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef8460405161062d9190610a45565b60405180910390a3600190509392505050565b601281565b6003602052805f5260405f205f915090505481565b6001805461066790610b78565b80601f016020809104026020016040519081016040528092919081815260200182805461069390610b78565b80156106de5780601f106106b5576101008083540402835291602001916106de565b820191905f5260205f20905b8154815290600101906020018083116106c157829003601f168201915b505050505081565b5f8160035f3373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f20541015610767576040517f08c379a000000000000000000000000000000000000000000000000000000000815260040161075e90610bf2565b60405180910390fd5b8160035f3373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f82825403925050819055508160035f8573ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019081526020015f205f82825401925050819055508273ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff167fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef846040516108589190610a45565b60405180910390a36001905092915050565b6004602052815f5260405f20602052805f5260405f205f91509150505481565b5f81519050919050565b5f82825260208201905092915050565b5f5b838110156108c15780820151818401526020810190506108a6565b5f8484015250505050565b5f601f19601f8301169050919050565b5f6108e68261088a565b6108f08185610894565b93506109008185602086016108a4565b610909816108cc565b840191505092915050565b5f6020820190508181035f83015261092c81846108dc565b905092915050565b5f80fd5b5f73ffffffffffffffffffffffffffffffffffffffff82169050919050565b5f61096182610938565b9050919050565b61097181610957565b811461097b575f80fd5b50565b5f8135905061098c81610968565b92915050565b5f819050919050565b6109a481610992565b81146109ae575f80fd5b50565b5f813590506109bf8161099b565b92915050565b5f80604083850312156109db576109da610934565b5b5f6109e88582860161097e565b92505060206109f9858286016109b1565b9150509250929050565b5f8115159050919050565b610a1781610a03565b82525050565b5f602082019050610a305f830184610a0e565b92915050565b610a3f81610992565b82525050565b5f602082019050610a585f830184610a36565b92915050565b5f805f60608486031215610a7557610a74610934565b5b5f610a828682870161097e565b9350506020610a938682870161097e565b9250506040610aa4868287016109b1565b9150509250925092565b5f60ff82169050919050565b610ac381610aae565b82525050565b5f602082019050610adc5f830184610aba565b92915050565b5f60208284031215610af757610af6610934565b5b5f610b048482850161097e565b91505092915050565b5f8060408385031215610b2357610b22610934565b5b5f610b308582860161097e565b9250506020610b418582860161097e565b9150509250929050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52602260045260245ffd5b5f6002820490506001821680610b8f57607f821691505b602082108103610ba257610ba1610b4b565b5b50919050565b7f696e73756666696369656e7400000000000000000000000000000000000000005f82015250565b5f610bdc600c83610894565b9150610be782610ba8565b602082019050919050565b5f6020820190508181035f830152610c0981610bd0565b9050919050565b7f6e6f7420617070726f76656400000000000000000000000000000000000000005f82015250565b5f610c44600c83610894565b9150610c4f82610c10565b602082019050919050565b5f6020820190508181035f830152610c7181610c38565b905091905056fea2646970667358221220cf8c2c55762172daa1e26d022b5ae127454790ac142f8cc95e6dc9766ad035db64736f6c63430008140033";

      var BSB_ERC20_ABI = ["constructor(string memory n,string memory s,uint256 supply,address owner)","function name() view returns(string)","function symbol() view returns(string)","function decimals() view returns(uint8)","function totalSupply() view returns(uint256)","function balanceOf(address) view returns(uint256)","function transfer(address to,uint256 amount) returns(bool)","function approve(address spender,uint256 amount) returns(bool)","function transferFrom(address from,address to,uint256 amount) returns(bool)","function allowance(address owner,address spender) view returns(uint256)"]; __NX.BSB_ERC20_ABI = BSB_ERC20_ABI;

      function bsbGetDeployCalldata(name,symbol,supply,ownerAddr){
        var iface=new ethers.Interface(BSB_ERC20_ABI);
        var constructorArgs=iface.encodeDeploy([name,symbol,supply,ownerAddr]);
        var CREATE2=ethers.getAddress("0x4e59b44847b379578588920cA78FbF26c0B4956C");
        var salt=ethers.keccak256(ethers.toUtf8Bytes(name+symbol+Date.now()));
        var initcode=ethers.concat([BSB_ERC20_BYTECODE,constructorArgs]);
        var deployerCalldata=ethers.concat([salt,initcode]);
        return{CREATE2,deployerCalldata,salt,initcode};
      }
      function bsbComputeCreate2Addr(salt,initcode,deployer){
        return ethers.getCreate2Address(deployer,salt,ethers.keccak256(initcode));
      }

      // ── AA Core helpers ──
      function bsbExecCalldata(to,value,data){
        return new ethers.Interface(["function execute(address target,uint256 value,bytes data)"]).encodeFunctionData("execute",[to,value,data]);
      }
      function bsbExecBatchCalldata(dests,values,datas){
        var calls=dests.map(function(target,i){return{target:target,value:values[i],data:datas[i]};});
        return new ethers.Interface(["function executeBatch((address target,uint256 value,bytes data)[] calls) payable"]).encodeFunctionData("executeBatch",[calls]);
      }

      async function bsbGetNonce(scAddr,provider){
        var ep=new ethers.Contract(BSB_EP,["function getNonce(address sender,uint192 key) view returns(uint256)"],provider);
        try{return await ep.getNonce(scAddr,0n);}catch(e){return 0n;}
      }

      async function bsbSignUserOp(userOpHash,signer){
        var sig=signer.signingKey.sign(ethers.getBytes(userOpHash));
        var sigBytes=ethers.concat([sig.r,sig.s,ethers.toBeHex(sig.v,1)]);
        return ethers.AbiCoder.defaultAbiCoder().encode(['uint256','bytes'],[0n,sigBytes]);
      }

      function bsbGetUserOpHash(op,chainId){
        var abi=ethers.AbiCoder.defaultAbiCoder();
        var packed=abi.encode(
          ['address','uint256','bytes32','bytes32','uint256','uint256','uint256','uint256','uint256','bytes32'],
          [op.sender,BigInt(op.nonce),ethers.keccak256(ethers.getBytes(op.initCode||'0x')),ethers.keccak256(ethers.getBytes(op.callData||'0x')),BigInt(op.callGasLimit),BigInt(op.verificationGasLimit),BigInt(op.preVerificationGas),BigInt(op.maxFeePerGas),BigInt(op.maxPriorityFeePerGas),ethers.keccak256(ethers.getBytes(op.paymasterAndData||'0x'))]
        );
        return ethers.keccak256(abi.encode(['bytes32','address','uint256'],[ethers.keccak256(packed),BSB_EP,BigInt(chainId)]));
      }

      async function bsbPmFetch(url,method,params,retries){
        retries=retries||3;
        var lastErr;
        for(var attempt=1;attempt<=retries;attempt++){
          try{
            // BUG FIX 7: timeout ছাড়া dead RPC এ forever hang করত
            var res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:Date.now(),method:method,params:params}),signal:AbortSignal.timeout(10000)});
            var text=await res.text();
            var data;try{data=JSON.parse(text);}catch(e){throw new Error('PM parse: '+text.slice(0,100));}
            if(data.error)throw new Error(method+': '+JSON.stringify(data.error).slice(0,120));
            return data.result;
          }catch(e){lastErr=e;if(attempt<retries)await bsbSleep(2000);}
        }
        throw lastErr;
      }

      async function bsbSendOp(userOp,bundlerUrl){
        var body={jsonrpc:'2.0',id:Date.now(),method:'eth_sendUserOperation',params:[{sender:userOp.sender,nonce:bsbToHex(userOp.nonce),initCode:userOp.initCode||'0x',callData:userOp.callData||'0x',callGasLimit:bsbToHex(userOp.callGasLimit),verificationGasLimit:bsbToHex(userOp.verificationGasLimit),preVerificationGas:bsbToHex(userOp.preVerificationGas),maxFeePerGas:bsbToHex(userOp.maxFeePerGas),maxPriorityFeePerGas:bsbToHex(userOp.maxPriorityFeePerGas),paymasterAndData:userOp.paymasterAndData||'0x',signature:userOp.signature},BSB_EP]};
        var res=await (window.oneFetch||fetch)(bundlerUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)},15000);
        var text=await res.text();
        var data;try{data=JSON.parse(text);}catch(e){throw new Error('Bundler JSON: '+text.slice(0,100));}
        if(data.error){var msg=data.error.message||JSON.stringify(data.error);if(msg.toLowerCase().includes('already known')||msg.toLowerCase().includes('already exists'))return data.error.userOpHash||null;throw new Error('Bundler: '+msg);}
        return data.result;
      }

      async function bsbWaitOp(hash,bundlerUrl,maxMs){
        maxMs=maxMs||180000;
        if(!hash){await bsbSleep(15000);return{success:true,note:'already_known'};}
        var t0=Date.now();
        while(Date.now()-t0<maxMs){
          await bsbSleep(4000);
          try{
            var res=await (window.oneFetch||fetch)(bundlerUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:Date.now(),method:'eth_getUserOperationReceipt',params:[hash]})},10000);
            var data=await res.json();
            if(data.result){bsbLog('  ✅ Confirmed! txHash: '+(data.result.receipt&&data.result.receipt.transactionHash||hash),'lok');bsbLog('');return data.result;}
          }catch(e){}
        }
        throw new Error('UserOp timeout (180s)');
      }
})((window.__nxp = window.__nxp || {}).mod_base_swap_bot = window.__nxp.mod_base_swap_bot || {});
