# Changelog

All notable changes to this project are documented here.
Per-build release notes are published on the [Releases](../../releases) page.

## [Unreleased]

### Changed
- **Send screen redesign:** amount-first layout (token pill, 25/50/75/Max chips, balance), one From card with a
  short address, recipient field with paste + QR + "Choose from my wallets", and a state-aware SEND button
  ("Enter an amount" / "Enter recipient address" / "Send ETH"). New **Select token** sheet with an
  **All networks** tab and per-network tabs, sorted by USD value. Network fee row: tap the pill to cycle
  Auto / EIP-1559 / Legacy. New file `scripts/features/wallet/app-main/send-token-sheet.js`.
- **New logo (v3):** blue wallet with card, cash and "1" mark on a rounded-square with the "One Wallet" wordmark;
  launcher icons (square + round), splash, PWA icons, favicon/apple-touch icon, dApp provider icon and
  `docs/branding/` updated.
- **New logo (v2):** gradient coin with a "1" and a clasp notch on a dark rounded-square; launcher icons, splash,
  PWA icons, dApp provider icon and `docs/branding/` updated.
- **Rebrand to One Wallet.** New logo (`docs/branding/`), app name, launcher icons, splash/lock screen, PWA
  manifest/icons, notifications, biometric prompts, EIP-6963 provider name/icon, CI artifact names
  (`OneWallet-v*.apk`) and docs. All former brand identifiers were renamed: Java package/`namespace`/`applicationId`
  `com.one.wallet`, `One*` classes and files, `OneAndroid`/`OneBridge` JS bridges, `one_*` storage keys, the PBKDF2 salt,
  proxy/integrator ids. **This is a new app id: installs of earlier builds do not update in place and their on-device
  data is not carried over — export/back up wallets in the old app first, then import them into the new one.**
- Frontend files grouped into topic folders (65 files moved with `git mv`, content unchanged; the generated
  `index.html` is identical apart from paths, tag order unchanged): bridge scripts → `bridge/{pickers,history,routes,providers,execute}/`,
  `core/{capacitor-background,console,pwa}/`, `shared/{custom-rpc,currency}/`, `shared/rpc-manager.js` and the exchange
  deposit/withdraw modals and `base-swap-bot` now sit next to their parts, transfer wallet-picker → `transfer/wallet-picker/`,
  wallet token cache → `wallet/tokens/`, contract modals `web3/` → `transfer/contracts/`. Transfer Hub styles
  (`th-*` from `styles/base/` and `features/send/`) → `styles/features/transfer/`; lock-method picker and token manager
  styles → `features/wallet/`; swap page styles → `features/swap/`.
- HTML partial `exchange-deposit-modals` renamed to `exchange-deposit-withdraw-modals` (it holds the withdraw modals too);
  generated `index.html` byte-identical.
- `frontend/index.html` is no longer committed. It is generated from `html-src/` by Gradle (`:app:generateHtml`) before
  every build; the remaining inline markup in `index.src.html` was moved into partials (output byte-identical).
- Repository restructured: web UI moved from `app/src/main/assets/` to `frontend/`
  (`css/` → `styles/{base,shared,features}`, `js/` → `scripts/{core,shared,features}`, `js/vendor/` → `vendor/`).
- Java classes grouped by role: `browser/InAppBrowserActivity`, `service/OneForegroundService`,
  `bridge/OneAndroidBridge` (extracted from `MainActivity`; members it needs are now `public`; ProGuard rule updated).
- Frontend scripts regrouped by feature: bridge scripts → `scripts/features/bridge/`, swap UI → `features/swap/`,
  send overlay → `features/send/` (previously split between `wallet/delegation-modal/` and `shared/ui/`). Script order unchanged.
- CI now runs `tools/check_assets.py` before building.

### Added
- `docs/`, `.gitignore`, `.editorconfig`, `CHANGELOG.md`, `SECURITY.md`, `CONTRIBUTING.md`.

### Removed
- `PUSH_TO_GITHUB.sh` (obsolete bootstrap script that force-pushed to a different repository).
