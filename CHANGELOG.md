# Changelog

All notable changes to this project are documented here.
Per-build release notes are published on the [Releases](../../releases) page.

## [Unreleased]

### Changed
- **Swap token picker redesign:** compact **Select token** sheet (80% height, slimmer handle / header / 38px search with a
  **Paste** button), 38px token logos, selected token highlighted with a tick, "All tokens on <chain>" label and a
  "No tokens found" empty state. New `styles/features/swap/swap-token-picker.css`; the dim backdrop is lighter.
- **Swipe down to close (token picker and other bottom sheets):** more reliable. Closes from the handle, header, the token
  list (when pulled down from its top) and the dim area above the sheet. Diagonal thumb swipes no longer abort (direction is
  locked after ~8px instead of cancelling at 38px sideways drift), short quick flicks close (60px / 0.35px/ms, smoothed
  velocity), a leftover timer from the previous gesture can no longer interfere, and the keyboard is dismissed on close.
  `touch-action` set on the sheet so the WebView does not take over the gesture.
- **Swap screen polish:** same layout and features, cleaner look. Larger header chips, bigger FROM / TO labels,
  borderless large amount text (24px in, 22px out), taller percent slider (1 / 25 / 50 / 75 / 100%) and MAX button,
  softer Swap button glow. **Live router** rows are now flat and inset 6% from both sides (neutral border; purple border and tick on
  the selected route, `BEST` tag on the top route), and Gas / Impact text wraps instead of being cut off with "...".
  Light-mode overrides updated to match.
- **Swap router list height:** the Live router list now measures the space between its top and the bottom nav
  (`swFitDexScroll`, re-run on resize and whenever the swap card changes), so the last router card is no longer
  hidden under the nav bar. Replaced the old fixed `calc(100vh - 420px ...)` guess and the 72px bottom padding.
- **Swap popups:** **Swap Settings** and **Recent Swaps** now open as centered popups (fade + scale) above the bottom
  nav instead of bottom sheets; tap outside, the X, or hardware back closes them (hardware back now also closes Recent
  Swaps). Opening either one drops focus from the amount field, so the keyboard no longer pops up. Slippage chips
  share the row evenly, history rows get a green check, larger text and a proper empty state. Swipe-down-to-close
  was removed for these two popups.
- **Swap gas type:** the three-button Gas Type row is now one compact "Network fee" pill above the Swap button.
  Default is AUTO; tap the pill to cycle AUTO / 1559 / LEGACY (`window._ngCycle`, same `OneGasMode` as before).
- **Send screen navigation:** swipe-down-to-close is turned off on the Send screen (it opts out with
  `data-no-swipe`); leave with the header back arrow or the hardware back button. Hardware back now closes the
  top layer first: Confirm transaction sheet, then Select token sheet, then the Send screen, then returns to the
  previous page. The bottom nav stays visible while Send is open.
- **Token action sheet redesign:** tapping a token now opens a calm bottom sheet: token header with chain dot, round
  chart and close buttons, a **Balance** row (read from the home token card), and Send / Swap / Bridge as one grouped
  list with a short subtitle each (no gradients or glow). Handlers unchanged (Send pre-selects token and chain, Swap and
  Bridge pass the token, Chart opens the full chart); swipe-down still closes this sheet. Styles moved from inline to
  `.tas-*` classes in `home-header-portfolio-and-token-list.css`.
- **Receive screen polish:** Group and Wallet stay as two dropdowns (taller, rounder, same field style as Send),
  larger QR with soft glow, balanced address card, COPY / SHARE buttons with a green "COPIED" state (now a CSS
  class instead of inline colors), and a note that the same address works on all EVM networks. Logic unchanged.
- **Select token sheet:** swipe down on the handle, header or the list (when scrolled to the top) to close it;
  a short drag snaps back.
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
