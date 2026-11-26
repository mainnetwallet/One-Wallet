
  // ── Rubic: fetch routes (both same-chain swap & cross-chain bridge) ──
  async function _brFetchRubic(fromAmt) {
    const fromBC = RUBIC_CHAINS[br.fromChain.id];
    const toBC   = RUBIC_CHAINS[br.toChain.id];
    if (!fromBC || !toBC) throw new Error('Chain not supported by Rubic');
    // Same-chain swap is fully supported by Rubic — no skip needed

    const isSameChain = br.fromChain.id === br.toChain.id;

    // Rubic expects human-readable amount (not wei).
    const _rawAmt = parseFloat(fromAmt) / Math.pow(10, br.fromToken.decimals || 18);
    const humanAmt = _rawAmt.toFixed(18).replace(/\.?0+$/, '');

    // Official Rubic API uses the same /routes/quoteAll endpoint for BOTH
    // same-chain DEX swaps and cross-chain bridges — just set srcBlockchain === dstBlockchain

    const body = {
      srcTokenAddress:    br.fromToken.address || '0x0000000000000000000000000000000000000000',
      srcTokenBlockchain: fromBC,
      srcTokenAmount:     humanAmt,
      dstTokenAddress:    br.toToken.address || '0x0000000000000000000000000000000000000000',
      dstTokenBlockchain: toBC,
      referrer:           'OneWallet',
      // Disable balance/allowance validation — wallet has funds, Rubic should not block on checks
      validations:  { balance: false, allowance: false },
      enableChecks: false,
    };
    if (br.senderAddr)    body.fromAddress = br.senderAddr;
    if (br.recipientAddr) body.receiver    = br.recipientAddr;

    const _quoteEndpoint = RUBIC_API + '/routes/quoteAll';

    const r = await fetch(_quoteEndpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  AbortSignal.timeout(20000),
    });
    if (!r.ok) {
      const eb = await r.json().catch(() => ({}));
      throw new Error(eb.message || 'Rubic: HTTP ' + r.status);
    }
    const data = await r.json();
    const list = data.trades || data.routes || data.data || [];
    if (!list.length) throw new Error('No Rubic routes found');

    // Known Rubic providerType → display name map (official keys from docs.rubic.finance)
    const RUBIC_TYPE_MAP = {
      // ── Same-chain DEX providerType values ──
      'uniswap_v3':          'Uniswap V3',
      'uniswap_v2':          'Uniswap V2',
      'uniswap':             'Uniswap',
      'pancake_swap':        'PancakeSwap',
      'pancake_swap_v3':     'PancakeSwap V3',
      'sushi_swap':          'SushiSwap',
      'sushiswap':           'SushiSwap',
      'curve':               'Curve',
      'curve_finance':       'Curve',
      'balancer':            'Balancer',
      'balancer_v2':         'Balancer V2',
      'one_inch':            '1inch',
      '1inch':               '1inch',
      'odos':                'Odos',
      'paraswap':            'ParaSwap',
      'openocean':           'OpenOcean',
      'dodo':                'DODO',
      'kyber_swap':          'KyberSwap',
      'kyberswap':           'KyberSwap',
      'aerodrome':           'Aerodrome',
      'aerodrome_v3':        'Aerodrome V3',
      'velodrome':           'Velodrome',
      'velodrome_v2':        'Velodrome V2',
      'camelot':             'Camelot',
      'camelot_v3':          'Camelot V3',
      'baseswap':            'BaseSwap',
      'alienbase':           'AlienBase',
      'trader_joe':          'Trader Joe',
      'trader_joe_v2':       'Trader Joe V2',
      'pangolin':            'Pangolin',
      'quickswap':           'QuickSwap',
      'quickswap_v3':        'QuickSwap V3',
      'biswap':              'BiSwap',
      'wault_swap':          'WaultSwap',
      'spookyswap':          'SpookySwap',
      'spiritswap':          'SpiritSwap',
      'trisolaris':          'Trisolaris',
      'ref_finance':         'Ref Finance',
      'onchain_swap':        'On-Chain Swap',
      'on_chain':            'On-Chain Swap',
      // ── Official cross-chain providerType values ──
      'lifi':            'LiFi',
      'lifi_bridge':     'LiFi',
      'symbiosis':       'Symbiosis',
      'squidrouter':     'Squid Router',
      'squid':           'Squid',
      'celer_bridge':    'Celer Bridge',
      'celer':           'Celer',
      'rango':           'Rango',
      'dln':             'DLN (deBridge)',
      'debridge':        'deBridge',
      'de_bridge':       'deBridge',
      'bridgers':        'Bridgers',
      'changenow':       'ChangeNow',
      'orbiter_bridge':  'Orbiter',
      'orbiter':         'Orbiter',
      'meson':           'Meson',
      'owl_to_bridge':   'Owlto',
      'owlto':           'Owlto',
      'arbitrum':        'Arbitrum Bridge',
      'arbitrum_bridge': 'Arbitrum Bridge',
      'stargate_v2':     'Stargate',
      'stargate':        'Stargate',
      'archon_bridge':   'Archon Bridge',
      'pulsechain_bridge':'PulseChain Bridge',
      'router':          'Router Protocol',
      'nitro':           'Router Nitro',
      'across':          'Across',
      'across_bridge':   'Across',
      'relay':           'Relay',
      'allbridge':       'Allbridge',
      'hop':             'Hop',
      'hop_bridge':      'Hop',
      'connext':         'Connext',
      'synapse':         'Synapse',
      'multichain':      'Multichain',
      'wormhole':        'Wormhole',
      'layerzero':       'LayerZero',
      'socket':          'Socket',
      'mayan':           'Mayan',
      'hyphen':          'Hyphen',
      'rhino':           'Rhino.fi',
      'xdefi':           'XDeFi',
      'jumper':          'Jumper',
      'retro_bridge':    'Retro Bridge',
      'retrobridge':     'Retro Bridge',
      'simpleswap':      'SimpleSwap',
      'simple_swap':     'SimpleSwap',
      'changelly':       'Changelly',
      'quickex':         'Quickex',
      'near_intents':    'NEAR Intents',
      'wanchain_bridge': 'Wanchain',
      'wanchain':        'Wanchain',
      'teleswap':        'TeleSwap',
      'tele_swap':       'TeleSwap',
      'coral':           'Coral (Squid)',
      'optimism_bridge': 'Optimism Bridge',
      'polygon_bridge':  'Polygon Bridge',
      'ronin_bridge':    'Ronin Bridge',
      'rubic':           'Rubic',
    };

    // Bridge provider logo map — official Rubic providerType keys
    const _BL = (slug) => 'https://icons.llamao.fi/icons/protocols/' + slug + '?w=48&h=48';
    const _GF = (domain) => 'https://www.google.com/s2/favicons?domain=' + domain + '&sz=64';
    const RUBIC_LOGO_MAP = {
      // ── Core bridge providers (llamao.fi) ──
      'lifi':            _GF('li.fi'),
      'lifi_bridge':     _GF('li.fi'),
      'symbiosis':       _BL('symbiosis'),
      'squidrouter':     _BL('squid'),
      'squid':           _BL('squid'),
      'celer_bridge':    _BL('celer-network'),
      'celer':           _BL('celer-network'),
      'rango':           _BL('rango'),
      'dln':             _BL('debridge'),
      'debridge':        _BL('debridge'),
      'de_bridge':       _BL('debridge'),
      'across':          _BL('across'),
      'across_bridge':   _BL('across'),
      'relay':           _GF('relay.link'),
      'stargate_v2':     _GF('stargate.finance'),
      'stargate':        _GF('stargate.finance'),
      'hop':             _BL('hop-protocol'),
      'hop_bridge':      _BL('hop-protocol'),
      'connext':         _BL('connext'),
      'synapse':         _BL('synapse'),
      'multichain':      _BL('multichain'),
      'wormhole':        _BL('wormhole'),
      'layerzero':       _BL('layerzero'),
      'meson':           _BL('meson'),
      'allbridge':       _BL('allbridge'),
      'socket':          _BL('socket'),
      'mayan':           _BL('mayan-finance'),
      'router':          _BL('router-protocol'),
      'nitro':           _BL('router-protocol'),
      'orbiter_bridge':  _BL('orbiter-finance'),
      'orbiter':         _BL('orbiter-finance'),
      'owl_to_bridge':   _BL('owlto'),
      'owlto':           _BL('owlto'),
      'rubic':           _BL('rubic'),
      'rhino':           _BL('rhino-fi'),
      'jumper':          _BL('jumper-exchange'),
      // ── Arbitrum / chain native bridges ──
      'arbitrum':        _GF('bridge.arbitrum.io'),
      'arbitrum_bridge': _GF('bridge.arbitrum.io'),
      'optimism_bridge': _GF('app.optimism.io'),
      'polygon_bridge':  _GF('wallet.polygon.technology'),
      'pulsechain_bridge':_GF('bridge.pulsechain.com'),
      'archon_bridge':   _GF('archon.network'),
      'ronin_bridge':    _GF('bridge.roninchain.com'),
      // ── CEX / aggregator bridges ──
      'changenow':       _GF('changenow.io'),
      'changelly':       _GF('changelly.com'),
      'quickex':         _GF('quickex.io'),
      'simpleswap':      _GF('simpleswap.io'),
      'simple_swap':     _GF('simpleswap.io'),
      'bridgers':        _GF('bridgers.xyz'),
      'retro_bridge':    _GF('retrobridge.io'),
      'retrobridge':     _GF('retrobridge.io'),
      'teleswap':        _GF('teleswap.xyz'),
      'tele_swap':       _GF('teleswap.xyz'),
      // ── Intent protocols ──
      'near_intents':    _GF('near.org'),
      'coral':           _BL('squid'),
      // ── Wanchain ──
      'wanchain_bridge': _GF('wanchain.org'),
      'wanchain':        _GF('wanchain.org'),
    };

    // Helper: extract cleanest provider name from a Rubic route object
    // Cross-chain: rt.providerType = "relay" | "lifi" | "across" | ...
    function _rubicProviderName(rt) {
      // Priority 1: providerType (confirmed real field from cross-chain API)
      const pt = rt.providerType;
      if (pt && typeof pt === 'string') {
        const lower = pt.toLowerCase().trim();
        if (lower && lower !== 'rubic') {
          if (RUBIC_TYPE_MAP[pt] || RUBIC_TYPE_MAP[lower]) return RUBIC_TYPE_MAP[pt] || RUBIC_TYPE_MAP[lower];
          // Title-case fallback
          return pt.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        }
      }
      // Priority 2: routing[0].provider
      const rp = rt.routing && rt.routing[0] && rt.routing[0].provider;
      if (rp && typeof rp === 'string') {
        const lower = rp.toLowerCase().trim();
        if (lower && lower !== 'rubic') {
          if (RUBIC_TYPE_MAP[rp] || RUBIC_TYPE_MAP[lower]) return RUBIC_TYPE_MAP[rp] || RUBIC_TYPE_MAP[lower];
          return rp.charAt(0).toUpperCase() + rp.slice(1).toLowerCase();
        }
      }
      // Priority 3: try other possible fields (legacy/future-proof)
      const candidates = [
        rt.bridgeType, rt.tradeType, rt.bridge, rt.protocol, rt.provider,
        rt.steps && rt.steps[0] && rt.steps[0].bridgeType,
        rt.steps && rt.steps[0] && rt.steps[0].provider,
      ].filter(Boolean);
      for (const raw of candidates) {
        if (!raw || typeof raw !== 'string') continue;
        const stripped = raw.includes('.') ? raw.split('.').pop() : raw;
        const lower = stripped.toLowerCase().trim();
        if (!lower || lower === 'rubic' || lower === 'cross_chain' || lower === 'on_chain') continue;
        if (RUBIC_TYPE_MAP[stripped] || RUBIC_TYPE_MAP[lower]) return RUBIC_TYPE_MAP[stripped] || RUBIC_TYPE_MAP[lower];
        const titled = stripped.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        if (titled.toLowerCase() !== 'rubic') return titled;
      }
      return 'Rubic';
    }

    // Normalize to LiFi-like shape for unified rendering
    // Official Rubic quoteAll response fields (from docs.rubic.finance):
    //   rt.id                          — route ID (required for swap call)
    //   rt.estimate.destinationWeiAmount   — output in wei
    //   rt.estimate.destinationTokenAmount — output human-readable
    //   rt.estimate.destinationUsdAmount   — output USD value
    //   rt.estimate.durationInMinutes      — estimated time
    //   rt.fees.gasTokenFees.gas.totalUsdAmount — gas fee in USD
    //   rt.providerType                    — bridge/DEX name key
    return list
      .filter(rt => {
        const est = rt.estimate || rt;
        return est.destinationWeiAmount || est.destinationTokenAmount;
      })
      .map(function(rt) {
        const est = rt.estimate || rt;

        // ── Output amount: prefer destinationWeiAmount (exact wei) ──
        let toAmtRaw;
        if (est.destinationWeiAmount) {
          toAmtRaw = String(est.destinationWeiAmount);
        } else if (est.destinationTokenAmount) {
          toAmtRaw = (parseFloat(est.destinationTokenAmount) * Math.pow(10, br.toToken.decimals || 18)).toFixed(0);
        } else {
          toAmtRaw = '0';
        }

        // ── USD value ──
        const toAmtUSD = est.destinationUsdAmount
          ? parseFloat(est.destinationUsdAmount).toFixed(2)
          : null;

        // ── Gas fee — official Rubic API fields (docs.rubic.finance) ──
        // Primary:   fees.gasTokenFees.gas.totalUsdAmount
        // Fallback:  fees.nativeFeeUsed (some routes), fees.cryptoFeeToken (legacy),
        //            fees.networkFee, fees.gasFee (older SDK shape)
        const _fees = rt.fees || {};
        const _gtf  = _fees.gasTokenFees || {};

        // ── Gas cost ──
        // Official Rubic docs: fees.gasTokenFees.gas.totalUsdAmount
        // Cross-chain routes: gas is included in the bridge fee, so totalUsdAmount = 0 → show null (—)
        // Same-chain swaps: gas.totalUsdAmount has real value
        const _gasRawUsd = parseFloat(_gtf.gas?.totalUsdAmount ?? -1);
        const gasUsd = _gasRawUsd > 0 ? String(_gasRawUsd.toFixed(4)) : null;
        const gasCosts = gasUsd ? [{ amountUSD: gasUsd }] : [];

        // ── Protocol fee ──
        // Official: fees.gasTokenFees.protocol.fixedUsdAmount  → Rubic platform fee
        //           fees.gasTokenFees.provider.fixedUsdAmount  → integrator fee
        //           fees.percentFees.percent                   → % of output (platform cut)
        const _protoRubic   = parseFloat(_gtf.protocol?.fixedUsdAmount  ?? 0);
        const _protoProvider= parseFloat(_gtf.provider?.fixedUsdAmount  ?? 0);
        const _pctFeeUsd    = (_fees.percentFees?.percent && est.destinationUsdAmount)
          ? (parseFloat(_fees.percentFees.percent) / 100 * parseFloat(est.destinationUsdAmount))
          : 0;
        const _protoUsd = _protoRubic + _protoProvider + _pctFeeUsd;

        // ── Duration: durationInMinutes → seconds ──
        const execSecs = est.durationInMinutes
          ? Math.round(est.durationInMinutes * 60)
          : (rt.estimatedTime || 60);

        // ── Provider name + logo ──
        const provName = _rubicProviderName(rt);
        const _ptKey   = (rt.providerType || '').toLowerCase();
        const provLogo = RUBIC_LOGO_MAP[_ptKey]
          || RUBIC_LOGO_MAP[(rt.routing && rt.routing[0] && rt.routing[0].provider || '').toLowerCase()]
          || '';

        return {
          _provider: 'rubic',
          _raw: rt,
          // Store EXACTLY the humanAmt we sent in quoteAll — Rubic error 1003 occurs when
          // swap srcTokenAmount differs even slightly from the quote srcTokenAmount.
          // Do NOT use rt.tokens.from.amount (Rubic may normalize/round it differently).
          _quoteHumanAmt: humanAmt,
          // Timestamp when this route was fetched — used by stale route guard in brExecute.
          // Rubic route IDs expire ~3 minutes after quoteAll; executing after expiry → error 1003.
          _fetchedAt: Date.now(),
          _minAmount: rt.minAmount
            || ((rt.warnings || []).find(w => w.code === 2005)?.data?.minAmount)
            || null,
          // id MUST come from Rubic response — random fallback will cause swap to fail (error 1003)
          id: rt.id || rt.requestId || rt.quoteId || null,
          tool: provName,
          toolDetails: { name: provName, logoURI: provLogo },
          steps: [{
            tool: provName,
            toolDetails: { name: provName, logoURI: provLogo },
            estimate: {
              toAmount:          toAmtRaw,
              toAmountUSD:       toAmtUSD,
              executionDuration: execSecs,
              gasCosts,
            }
          }],
          estimate: {
            toAmount:          toAmtRaw,
            toAmountUSD:       toAmtUSD,
            executionDuration: execSecs,
            gasCosts,
          },
          _protocolFeeUsd: _protoUsd,  // Rubic platform fee in USD (shown on route card)
        };
      })
      // Sort best amount first (same as LiFi routes)
      .sort((a, b) => Number(b.estimate.toAmount) - Number(a.estimate.toAmount));
  }