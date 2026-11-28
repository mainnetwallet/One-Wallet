# QR scanner and WalletConnect

## What a scan does

`frontend/scripts/features/scan/qr-classify.js` (pure, no DOM) sorts the scanned text; `qr-scanner.js` acts on it.

| QR content | Result |
|------------|--------|
| `0x...` address, `ethereum:0x...`, EIP-681 (`@chainId`, `/transfer?address=`) | Send opens with the recipient filled in (checksum is verified with ethers) |
| `wc:<topic>@2?...`, or a deep link carrying `uri=wc:...` | WalletConnect pairing -> connect-confirm sheet |
| `http(s)://...` or a bare domain | Opens in the in-app browser (`OneAndroid.openInAppBrowser`) |
| anything else | "This QR code is not supported", camera keeps scanning |

Refused on purpose: `javascript:`, `file:`, `intent:`, `data:` and URLs with a `user:pass@` part. WalletConnect **v1** is not supported (the protocol is shut down).

## WalletConnect v2 (wallet side)

- `frontend/vendor/walletconnect.min.js` is an esbuild IIFE exposing `window.OneWC = { Core, WalletKit, buildApprovedNamespaces, getSdkError }`
  (`@reown/walletkit` 1.7.0, `@walletconnect/core` 2.26.1, `@walletconnect/utils` 2.26.1).
- `scripts/features/walletconnect/wc-engine.js`: init, `wcPair(uri)`, proposal analysis, approve/reject, sessions, request execution.
- `scripts/features/walletconnect/wc-ui.js`: every sheet (`#wc-overlay` from `html-src/partials/walletconnect.html`): connecting, connect-confirm,
  sign / transaction request, Connected apps (Settings > Network), Project ID setup.
- **Project ID**: WalletConnect needs a Project ID from <https://cloud.reown.com>. One Wallet ships its own (`WC_DEFAULT_PROJECT_ID` in `wc-engine.js`), so
  users set up nothing. It is a public identifier, not a secret. Keep **Allowed domains** empty in that project (the app runs from `file://`).
  A valid ID saved in `localStorage` (`one_wc_project_id`) wins over the built-in one. Because an ID is always available, the old "Set up WalletConnect"
  sheet (`wcOpenProjectIdSheet`) is no longer shown; the code is kept as a fallback.
- Supported requests: `personal_sign`, `eth_signTypedData(_v3/_v4)`, `eth_sendTransaction`, `wallet_switchEthereumChain`, `wallet_addEthereumChain`.
  `eth_sign` and `eth_signTransaction` are refused. Every sign/send shows a sheet; unlimited ERC-20
  approvals and `setApprovalForAll` get a red warning. Requests for a chain that is not added in One Wallet are refused.
- **Transaction history**: every `eth_sendTransaction` the user confirms is saved in `one_tx_history` (Profile > Transaction History, filter "Send") as soon
  as it is broadcast, with the app name in the row details and in the search. A background wait for the receipt flips it to FAILED if it reverts
  (`wc-engine.js`: `wcBuildTxHistoryEntry`, `_wcRecordTx`).
- **`wallet_addEthereumChain`** (EIP-3085): the params are checked first (`wcParseAddChain`: hex `chainId`, name, 18-decimal native currency, at least one
  `https` RPC; `http`/`wss` URLs and URLs with user:password are dropped, max 5 RPCs). A network that is already in One Wallet is just shared with the
  session (its RPC is never replaced). A new one opens an **Add network** sheet showing name, chain ID, currency, RPC and explorer; only after "Add network" it is
  saved with the other custom networks (same record as Add custom network) and added to the session (`updateSession`). Reject answers 4001, bad params -32602.
- **Network per app** (`one_wc_session_chain` = `{ topic: chainId }`): Settings > Connected apps shows each app's network; tapping it lists the networks that
  session was given and a pick sends the app a `chainChanged` event. `wallet_switchEthereumChain` from the app does the same when the chain is in the
  session, otherwise it is answered 4902 (so the app can call `wallet_addEthereumChain`). The pick is dropped when the session ends.
- Sessions are stored by WalletKit (localStorage). `one_wc_has_sessions` makes the app reopen the relay after start so requests arrive; requests only
  arrive while the app is open (no push yet).

### Rebuild the bundle

```bash
mkdir wcb && cd wcb && npm init -y && npm i @reown/walletkit @walletconnect/core @walletconnect/utils esbuild
cat > entry.js <<'JS'
import { Core } from '@walletconnect/core';
import { WalletKit } from '@reown/walletkit';
import { buildApprovedNamespaces, getSdkError } from '@walletconnect/utils';
window.OneWC = { Core, WalletKit, buildApprovedNamespaces, getSdkError };
JS
npx esbuild entry.js --bundle --minify --format=iife --platform=browser --target=chrome80 \
  --define:global=window --define:process.env.NODE_ENV='"production"' --outfile=walletconnect.min.js
cp walletconnect.min.js ../frontend/vendor/
```

### Tests

`node tools/wc-selftest.js` (no network): proposal analysis, `buildApprovedNamespaces`, project-id validation, chain id / add-chain parsing,
per-session network, and the request flow (switch, add, send -> History, revert -> failed) against a stub WalletKit.
`python3 tools/check_assets.py` and `python3 tools/build_html.py --check` as usual.

### Troubleshooting pairing

- "No answer from the app": the QR code is stale or the app is offline. Refresh the QR code and scan again.
- "Cannot reach the WalletConnect relay" / "WalletConnect refused the connection": the phone cannot open the relay socket, or the Project ID is wrong.
  One Wallet runs from `file:///android_asset/`, so the relay sees no real web origin: if the project at cloud.reown.com has an **allowed domains** list,
  empty it (an empty list allows every origin).
- The scanner reads with `BarcodeDetector` when the WebView has a working one, otherwise with `vendor/jsqr.min.js` (it falls back by itself after 3 failed reads).

### Not verified on a device

The relay connection (wss to relay.walletconnect.org), a real pairing and a real signature have not been run on a phone yet.
