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
- **Project ID**: WalletConnect needs a free Project ID from <https://cloud.reown.com>. The first pairing asks for it once and stores it in
  `localStorage` (`one_wc_project_id`). To ship a default, set it in `wcGetProjectId()`.
- Supported requests: `personal_sign`, `eth_signTypedData(_v3/_v4)`, `eth_sendTransaction`. `wallet_switchEthereumChain` is acknowledged (the session already
  lists every allowed chain). `eth_sign`, `eth_signTransaction` and `wallet_addEthereumChain` are refused. Every sign/send shows a sheet; unlimited ERC-20
  approvals and `setApprovalForAll` get a red warning. Requests for a chain that is not added in One Wallet are refused.
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

`node tools/wc-selftest.js` (no network): proposal analysis, `buildApprovedNamespaces`, project-id validation.
`python3 tools/check_assets.py` and `python3 tools/build_html.py --check` as usual.

### Troubleshooting pairing

- "No answer from the app": the QR code is stale or the app is offline. Refresh the QR code and scan again.
- "Cannot reach the WalletConnect relay" / "WalletConnect refused the connection": the phone cannot open the relay socket, or the Project ID is wrong.
  One Wallet runs from `file:///android_asset/`, so the relay sees no real web origin: if the project at cloud.reown.com has an **allowed domains** list,
  empty it (an empty list allows every origin).
- The scanner reads with `BarcodeDetector` when the WebView has a working one, otherwise with `vendor/jsqr.min.js` (it falls back by itself after 3 failed reads).

### Not verified on a device

The relay connection (wss to relay.walletconnect.org), a real pairing and a real signature have not been run on a phone yet.
