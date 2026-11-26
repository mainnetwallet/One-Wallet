# One Wallet

Android app for One Wallet — a DeFi crypto wallet.

---

## Download

Go to [Releases](../../releases) and download the latest APK.

## Install

1. Download the APK from Releases
2. Enable **Unknown Sources** on your Android device
3. Open the APK and install

---

## Repository layout

```
one-wallet/
├── app/                      # Android native shell (Java)
│   └── src/main/
│       ├── java/com/one/wallet/
│       │   ├── MainActivity.java            # main WebView, lock screen, notifications
│       │   ├── bridge/                      # OneAndroidBridge (JS <-> Java: OneAndroid / OneBridge)
│       │   ├── browser/                     # InAppBrowserActivity (tabs, toolbar, Web3 bridge)
│       │   └── service/                     # OneForegroundService
│       ├── res/
│       └── AndroidManifest.xml
├── frontend/                 # WebView UI (packaged into the APK as assets)
│   ├── (index.html)          # GENERATED from html-src/ at build time - not committed
│   ├── styles/               # base/ · shared/ · features/{home,send,swap,bridge,exchange,transfer,wallet,web3}
│   ├── scripts/              # core/{capacitor-background,console,pwa} · shared/{rpc-manager,custom-rpc,currency,ui}
│   │                         # features/{wallet/tokens,swap,send,transfer,exchange,bridge/{pickers,history,routes,providers,execute},web3}
│   └── vendor/               # ethers, qrcode, jsQR, lightweight-charts
├── html-src/                 # SOURCE of the page: index.src.html (shell + load order) + partials/
├── tools/                    # build_html.py (html-src -> frontend/index.html) · check_assets.py
├── docs/                     # architecture.md · build.md · release.md
└── .github/workflows/        # build.yml (CI build + signed release APK)
```

> **Order matters.** Scripts share one global scope and run in the order listed in `html-src/index.src.html`.
> Do not reorder the `<script>` / `<link>` tags. Three tiny blocks (splash hide, `#_ph_init_style`,
> home chain pill) are intentionally kept inline because they are position / first-paint sensitive.

See [docs/architecture.md](docs/architecture.md) for details on the split files and numbered parts.

`frontend/index.html` is not stored in git. Gradle generates it before every build (`:app:generateHtml`, needs
`python3`). To open the UI locally run `python3 tools/build_html.py`.

Check that every referenced file exists and every JS file parses:

```bash
python3 tools/check_assets.py
```

## Docs

- [Architecture](docs/architecture.md)
- [Build](docs/build.md)
- [Release](docs/release.md)
- [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md) · [Changelog](CHANGELOG.md)

## License

See [LICENSE](LICENSE).
