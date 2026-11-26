# Build

## Requirements

- JDK 17
- Android SDK (platform 34, build-tools 34.0.0)
- Node.js (optional, for the JS syntax check)

## Check frontend assets

```bash
python3 tools/check_assets.py
```

## Debug build

```bash
./gradlew assembleDebug
# app/build/outputs/apk/debug/app-debug.apk (applicationId com.one.wallet.debug)
```

## Release build (local)

Release signing reads these environment variables:

| Variable | Meaning |
|----------|---------|
| `KEYSTORE_PATH` | path to the `.jks` keystore |
| `STORE_PASSWORD` | keystore password |
| `KEY_ALIAS` | key alias |
| `KEY_PASSWORD` | key password |

```bash
./gradlew assembleRelease
```

Never commit keystores or passwords. `*.jks` and `*.keystore` are git-ignored.

## Versioning

`gradle.properties` holds `VERSION_CODE` / `VERSION_NAME` for local builds. CI overrides them from the run number
(see [release.md](release.md)).
