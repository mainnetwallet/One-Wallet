# Architecture

One Wallet is a native Android shell around a WebView-based DeFi wallet UI.

## Layers

| Layer | Location | Role |
|-------|----------|------|
| Native shell | `app/src/main/java/com/one/wallet/` | Activities, WebView setup, biometric/lock, notifications |
| JS bridge | `bridge/OneAndroidBridge.java` (main WebView: `OneAndroid`, `OneBridge`); `InAppBrowserActivity$OneWeb3Bridge` (dApp WebViews: `OneWeb3Bridge`) | `@JavascriptInterface` objects. `OneWeb3Bridge` is still an inner class because it works directly on the browser's tab state |
| In-app browser | `browser/InAppBrowserActivity.java` | Tabs, toolbar, dApp WebViews, EIP-1193 provider injection |
| Background | `service/OneForegroundService.java` | Foreground service that keeps long-running transfers/bridges alive |
| Web UI | `frontend/` | Wallet UI, loaded from `file:///android_asset/index.html` |

`app/build.gradle` maps `frontend/` as the APK assets directory (`assets.srcDirs = ['../frontend']`),
so the asset root inside the APK is the same as `frontend/`.

## Frontend layout

```
frontend/
├── index.html
├── styles/
│   ├── base/        # theme, scrollbars, final mobile overrides
│   ├── shared/      # cross-feature widgets (tx pill, tx progress)
│   └── features/    # home, send, swap, bridge, exchange, transfer, wallet, web3
├── scripts/
│   ├── core/        # capacitor-background/ · console/ · pwa/ · plus loose guards (timers, sanitizer, back button, ...)
│   ├── shared/      # gas-engine · rpc-manager/ · custom-rpc/ · currency/ · ui/ (cross-feature overlays only)
│   └── features/    # wallet/ swap/ transfer/ exchange/ bridge/ send/ web3/
└── vendor/          # third-party libs (ethers, qrcode, jsQR, lightweight-charts)
```

### Where things live (topic folders)

Related files sit together in a topic folder; a folder never changes when a script loads (see *Load order*).

| Area | Folder | Holds |
|------|--------|-------|
| Bridge | `scripts/features/bridge/pickers/` | chain / token pickers |
| | `.../bridge/history/` | history sheet, dropdown, pending status / badge |
| | `.../bridge/routes/` | route fetch, render, select, balance + explorers |
| | `.../bridge/providers/` | Rango / Socket / Rubic, proxy + provider config, quote fetch |
| | `.../bridge/execute/` | wallet panel, confirm modal, exec button, success overlay |
| Transfer | `scripts/features/transfer/wallet-picker/` | wallet picker drawer |
| | `.../transfer/contracts/` | manual contract chain, contract delete modal |
| | `styles/features/transfer/` | every Transfer Hub (`th-*`) stylesheet |
| Wallet | `scripts/features/wallet/tokens/` | token cache, token list restore, early token render |
| | `styles/features/wallet/` | lock setup / lock method picker, token manager, tx history, import |
| Swap | `scripts/features/swap/base-swap-bot/` | Base swap bot + its key toggle |
| | `styles/features/swap/` | swap page, confirm sheet, spinner, success |
| Exchange | `scripts/features/exchange/{deposit,withdraw}-modal/` | each modal's main file + its parts |
| Shared | `scripts/shared/{rpc-manager,custom-rpc,currency}/` | RPC manager, custom RPC store + drawer, currency display + USD toggle |
| Core | `scripts/core/{capacitor-background,console,pwa}/` | background bridge, console capture / no-op, PWA + service-worker bootstrap |

When you add a file, put it in the folder for its topic; create a new topic folder when three or more files belong
together. Then add its `<script>` / `<link>` tag to `html-src/` in the position it must load, and run
`python3 tools/check_assets.py`.

### Load order

All scripts share one global scope and execute in the order of the `<script>` tags in `index.html`.
Folder grouping does not imply load order. Do not reorder tags.

### Numbered parts

`app-main`, `transfer-hub`, `exchange-engine`, `key-privacy` and `styles/base/` main theme are split into numbered
parts that are contiguous slices of the original file, cut at top-level statement boundaries. Keep the numeric order.

`delegation-modal/`, `swap-wallet-drawer/` and `web3-bridge/` were each one IIFE; their parts are its body cut at
statement boundaries, so their top-level bindings are plain globals shared across parts. Ten swap bindings and one
bridge binding that other scripts probe with `typeof X` carry a `_nxsw_` / `_nxdm_` prefix to keep those guards working.

### Topic-named scripts

Several numbered parts were split a second time into scripts named after what they contain (for example
`swap-wallet-drawer/swap-drawer-group-list.js` or `key-privacy/w2w-execute-token.js`) instead of `partN`.
These are still contiguous slices of the file they replace, cut at top-level statement boundaries, and they
are listed in `index.html` in the same position the original file had, so load order did not change. When
splitting another file, keep that rule: cut only between top-level statements, do not move code across
files, and make sure nothing that runs at load time reads a name declared in a later piece.

`core/capacitor-background` and `transfer/wallet-picker` were single IIFEs. They were unwrapped before being cut, so
their inner bindings are now script-level globals; this was only done after checking that none of those names is used
by any other script or by `index.html`. An IIFE whose inner names are also read elsewhere (for example via `window.x`)
must not be unwrapped this way; give it a private namespace instead, as `shared/rpc-manager/` does.

### HTML partials

`frontend/index.html` is generated from `html-src/index.src.html` and `html-src/partials/**/*.html` by
`python3 tools/build_html.py`. A line `<!--@include partials/<name>.html-->` is replaced by the exact lines of that
file, in the same position, so script order and first-paint timing are unchanged and nothing runs at load time to
fetch markup. `frontend/index.html` is **not committed** (it is in `.gitignore`). Gradle's `:app:generateHtml` task runs
`tools/build_html.py` before `preBuild` and before every `merge*Assets` / lint task, so the generated file is always
present in the APK assets (`assets.srcDirs = ['../frontend']`, loaded as `file:///android_asset/index.html`).
`tools/check_assets.py` builds the page in memory, so it needs no generated file. `html-src/` is outside `frontend/`
so it is not packaged in the APK. Building needs `python3` on PATH (`python` on Windows).

Edit `html-src/`; nothing else to regenerate or commit. Run `python3 tools/build_html.py` only for local browser
preview. CI runs `python3 tools/build_html.py --check`, which fails on a missing include, an include cycle or a partial
that is never included. Each partial is a whole element (or a few whole sibling elements); some contain
`<script>` or `<link>` tags that sit inside them. `<script src>` tags that sit between top-level elements stay in
`index.src.html` so their position relative to the markup is easy to see. Includes can be nested:
`partials/page-transfer-hub.html` keeps the page wrapper and pulls its twelve sections from
`partials/page-transfer-hub/`; `page-exchange`, `page-nansen`, `page-base-swap-bot`, `swap-bridge-modals`, `send-flow` and
`wallet-group-import-create` are split the same way, into a folder named after the parent partial. The original file had three stray
`</div>` lines (after `page-exchange`, `rpc-manager-overlay` and `hcp-overlay`, two of them with `/pages` and `/app`
comments). Browsers ignore them; they were removed after checking with parse5 that the parsed element/attribute/text
tree is identical before and after (only two comment nodes and one whitespace text node differ).

The split was verified by rebuilding after each step: the generated file was byte-identical to the previous
`index.html` before the generated-file notice was added. See `docs/html-split-plan.md` for the plan.

## Checks

`python3 tools/check_assets.py` verifies that every file referenced from the generated `index.html` exists, nothing is referenced
twice, there are no unreferenced files, and every non-vendor JS file passes `node --check`. CI runs it before building.
