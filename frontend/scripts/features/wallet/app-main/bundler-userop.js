

// ── RPC call helper ──
async function bundlerRpc(url, method, params) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));
  return json.result;
}

// ── Pad hex to 32 bytes ──
function pad32(hex) {
  return ('0x' + hex.replace('0x','').padStart(64, '0'));
}

// ── Build UserOp calldata for `execute(address,uint256,bytes)` ──
function buildExecuteCalldata(to, value, data) {
  const iface = new ethers.Interface(['function execute(address to, uint256 value, bytes calldata data)']);
  return iface.encodeFunctionData('execute', [to, value, data]);
}

// ── Dummy signature — ABI-encoded (uint256 sigType=0, bytes ecdsaSig) ──
// Matches Python: encode(['uint256','bytes'], [0, r||s||v])
// Coinbase Paymaster requires this exact format for EIP-7702 / delegation accounts
function buildAbiSig(ecdsaHex) {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  return abiCoder.encode(['uint256', 'bytes'], [0n, '0x' + ecdsaHex]);
}
const _dummyEcdsa = 'a'.repeat(64) + 'b'.repeat(64) + '1b';
const DUMMY_SIG = buildAbiSig(_dummyEcdsa);

// ── Get nonce via bundler eth_call (avoids public RPC EntryPoint issues) ──
async function getNonceViaBundler(bundlerUrl, sender) {
  const epIface = new ethers.Interface([
    'function getNonce(address sender, uint192 key) view returns (uint256)'
  ]);
  const callData = epIface.encodeFunctionData('getNonce', [sender, 0n]);
  const result = await bundlerRpc(bundlerUrl, 'eth_call', [
    { to: ENTRYPOINT_V06, data: callData },
    'latest'
  ]);
  return BigInt(result);
}

// ══════════════════════════════════════════════
// SEND SWAP VIA ERC-4337 USEROP + COINBASE PAYMASTER
// Ported from Python: raw ECDSA sign + ABI-encoded sig + TRANSFER_FROM_FAILED retry
// ══════════════════════════════════════════════
async function sendSwapViaUserOp(wallet, txReq, provider, logFn, hintGasLimit) {
  const bundlerUrl = getPaymasterUrl();
  const sender = wallet.address;
  // Use caller-supplied minimum, or derive from txReq.gasLimit (+30% buffer), or 300k floor.
  // LI.FI multi-hop routes typically need 600k-1.2M gas; other routers need less.
  // 300k floor is sufficient — paymaster will bump up if needed via response.
  const _txGasHint = txReq.gasLimit ? BigInt(Math.ceil(Number(txReq.gasLimit) * 1.3)) : 0n;
  const _callGasMin = hintGasLimit
    ? (hintGasLimit > _txGasHint ? hintGasLimit : _txGasHint)
    : (_txGasHint > 300000n ? _txGasHint : 300000n);

  // 1. Get nonce
  let nonce;
  try {
    nonce = await getNonceViaBundler(bundlerUrl, sender);
  } catch(e) {
    try {
      const epIface = new ethers.Interface(['function getNonce(address sender, uint192 key) view returns (uint256)']);
      const ep = new ethers.Contract(ENTRYPOINT_V06, epIface, provider);
      nonce = await ep.getNonce(sender, 0n);
    } catch(e2) {
      throw new Error('getNonce failed: ' + e2.message.slice(0, 80));
    }
  }

  // 2. Build callData — execute(to, value, data)  [selector b61d27f6 — same as Python]
  // LiFi returns value as hex string (e.g. "0x5af3107a4000") — must parse safely
  let _txReqValue = 0n;
  try {
    const _rv = txReq.value;
    if (_rv && _rv !== '0' && _rv !== '0x0' && _rv !== '0x00') {
      _txReqValue = typeof _rv === 'bigint' ? _rv
        : String(_rv).startsWith('0x') ? BigInt(String(_rv))
        : BigInt(String(_rv));
    }
  } catch(_) { _txReqValue = 0n; }

  // Security: reject zero-address or missing router before building UserOp
  if (!txReq.to || txReq.to === '0x0000000000000000000000000000000000000000') {
    throw new Error('SECURITY: txReq.to is zero/missing — refusing to sign UserOp');
  }

  const callData = buildExecuteCalldata(
    txReq.to,
    _txReqValue,
    txReq.data || '0x'
  );

  // MAX FEE = baseFee +5% | MAX PRIORITY = baseFee -95% (min 1000000 wei)
  const feeData = await _withRpcFallback(8453, _p => _p.getFeeData(), 5000).catch(() => provider.getFeeData());
  let _baseFee, _maxFeePerGas, _maxPriorityFeePerGas;
  if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
    _baseFee              = feeData.maxFeePerGas - feeData.maxPriorityFeePerGas;
    _maxFeePerGas         = (_baseFee * 105n) / 100n;
    _maxPriorityFeePerGas = (_baseFee * 5n)   / 100n;
  } else {
    _baseFee              = feeData.gasPrice || ethers.parseUnits('2', 'gwei');
    _maxFeePerGas         = (_baseFee * 105n) / 100n;
    _maxPriorityFeePerGas = (_baseFee * 5n)   / 100n;
  }
  if (_maxPriorityFeePerGas < 1000000n) _maxPriorityFeePerGas = 1000000n;
  if (_maxFeePerGas < _maxPriorityFeePerGas) _maxFeePerGas = _maxPriorityFeePerGas;

  // 4. Build UserOp with dummy signature (ABI-encoded format)
  const userOp = {
    sender,
    nonce:                '0x' + nonce.toString(16),
    initCode:             '0x',
    callData,
    callGasLimit:         '0x' + _callGasMin.toString(16),
    verificationGasLimit: '0x' + (200000n).toString(16),  // 200k — enough for EIP-7702 ECDSA verify; paymaster will correct
    preVerificationGas:   '0x' + (100000n).toString(16),  // 100k — standard calldata overhead; paymaster will correct
    maxFeePerGas:         '0x' + _maxFeePerGas.toString(16),
    maxPriorityFeePerGas: '0x' + _maxPriorityFeePerGas.toString(16),
    paymasterAndData:     '0x',
    signature:            DUMMY_SIG,
  };

  // 5. pm_sponsorUserOperation — throws immediately, outer loop handles TRANSFER_FROM_FAILED
  let sponsored;
  try {
    sponsored = await bundlerRpc(bundlerUrl, 'pm_sponsorUserOperation', [
      userOp, ENTRYPOINT_V06
    ]);
  } catch(e) {
    const msg = e.message || '';
    const isTransferFailed = msg.includes('TRANSFER_FROM_FAILED') || msg.includes('transfer_from_failed') || msg.includes('-32004');
    if (isTransferFailed) {
      throw new Error('TRANSFER_FROM_FAILED');
    }
    const isAA23 = msg.includes('AA23') || msg.includes('OOG') || msg.includes('gas estimation');
    if (isAA23) {
      throw new Error('Paymaster sponsorship failed: gas estimation error - wallet may not be delegated (AA23). Falling back to EOA.');
    }
    throw new Error('Paymaster sponsorship failed: ' + msg.slice(0, 120));
  }

  // ✅ Official: use sponsor gas values exactly as returned — no fallback, no override
  userOp.paymasterAndData     = sponsored.paymasterAndData || sponsored;
  if (!sponsored.callGasLimit || !sponsored.verificationGasLimit || !sponsored.preVerificationGas) {
    throw new Error('Sponsor response missing gas limits — cannot proceed');
  }
  userOp.callGasLimit         = sponsored.callGasLimit;
  userOp.verificationGasLimit = sponsored.verificationGasLimit;
  userOp.preVerificationGas   = sponsored.preVerificationGas;

  if (typeof userOp.paymasterAndData !== 'string' || !userOp.paymasterAndData.startsWith('0x')) {
    throw new Error('Invalid paymasterAndData from Paymaster');
  }

  // 6. Compute UserOpHash and sign — RAW ECDSA (no EIP-191 prefix) + ABI-encode
  //    Matches Python: account.unsafe_sign_hash(op_hash) → encode(['uint256','bytes'],[0,r||s||v])
  const userOpHash = getUserOpHash(userOp, ENTRYPOINT_V06, 8453);
  const rawSig = wallet.signingKey.sign(userOpHash);               // raw, no prefix
  const ecdsaBytes = rawSig.r.slice(2) + rawSig.s.slice(2) +
                     rawSig.v.toString(16).padStart(2, '0');
  userOp.signature = buildAbiSig(ecdsaBytes);                       // encode(uint256=0, bytes=sig)

  // 7. Submit — with AA25 nonce retry (ported from Python)
  let opHash;
  let aa25Count = 0;
  while (aa25Count < 3) {
    try {
      opHash = await bundlerRpc(bundlerUrl, 'eth_sendUserOperation', [
        userOp, ENTRYPOINT_V06
      ]);
      break;
    } catch(e) {
      const msg = e.message || '';
      if (msg.includes('AA25') || msg.includes('invalid account nonce')) {
        aa25Count++;
        if (aa25Count >= 3) throw new Error('AA25 nonce error — rebuild required');
        await delay(500);
        // Refresh nonce and rebuild
        nonce = await getNonceViaBundler(bundlerUrl, sender);
        userOp.nonce = '0x' + nonce.toString(16);
        const rawSig2 = wallet.signingKey.sign(getUserOpHash(userOp, ENTRYPOINT_V06, 8453));
        const ecdsaBytes2 = rawSig2.r.slice(2) + rawSig2.s.slice(2) + rawSig2.v.toString(16).padStart(2,'0');
        userOp.signature = buildAbiSig(ecdsaBytes2);
        continue;
      }
      throw new Error('eth_sendUserOperation failed: ' + msg.slice(0, 120));
    }
  }

  // 8. Poll for receipt (max 24s, 0.8s interval)
  let receipt = null;
  for (let attempt = 0; attempt < 30; attempt++) {
    await delay(800);
    try {
      receipt = await bundlerRpc(bundlerUrl, 'eth_getUserOperationReceipt', [opHash]);
      if (receipt && (receipt.success !== undefined || receipt.receipt)) break;
    } catch(_) {}
  }

  if (!receipt) throw new Error('UserOp receipt timeout (24s) — opHash: ' + opHash.slice(0,18));
  if (receipt.success === false) throw new Error('UserOp reverted on-chain: ' + (receipt.reason || JSON.stringify(receipt).slice(0,80)));

  const onchainTxHash = receipt.receipt?.transactionHash || opHash;
  var _pmChainId = (typeof _thGetChainIdFromRpc === 'function') ? (_thGetChainIdFromRpc('rpcUrlW2W') || _thGetChainIdFromRpc('rpcUrlW2WToken') || 8453) : 8453;
  var _pmLink = (typeof createExplorerLink === 'function') ? createExplorerLink(onchainTxHash, {chainId: _pmChainId}, false) : onchainTxHash;
  if (typeof logFn === 'function') logFn('success', '✅ Paymaster TX: ' + _pmLink, true);
  return { txHash: onchainTxHash, opHash, receipt };
}

// ── Compute UserOpHash (ERC-4337 v0.6 spec) ──
function getUserOpHash(userOp, entryPoint, chainId) {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  // Pack the UserOp fields
  const packed = abiCoder.encode(
    ['address','uint256','bytes32','bytes32','uint256','uint256','uint256','uint256','uint256','bytes32'],
    [
      userOp.sender,
      BigInt(userOp.nonce),
      ethers.keccak256(userOp.initCode || '0x'),
      ethers.keccak256(userOp.callData),
      BigInt(userOp.callGasLimit),
      BigInt(userOp.verificationGasLimit),
      BigInt(userOp.preVerificationGas),
      BigInt(userOp.maxFeePerGas),
      BigInt(userOp.maxPriorityFeePerGas),
      ethers.keccak256(userOp.paymasterAndData || '0x'),
    ]
  );
  const hashedOp = ethers.keccak256(packed);
  const finalEncoded = abiCoder.encode(
    ['bytes32', 'address', 'uint256'],
    [hashedOp, entryPoint, BigInt(chainId)]
  );
  return ethers.keccak256(finalEncoded);
}