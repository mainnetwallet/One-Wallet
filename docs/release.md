# Release

Releases are produced by `.github/workflows/build.yml` on every push to `main` (or manually via *Run workflow*).

## Pipeline

1. Checkout and `python3 tools/check_assets.py`
2. JDK 17 + Android SDK setup
3. Version computed from `github.run_number` → `VERSION_NAME = <major>.<run_number>`, `VERSION_CODE = <run_number>`
   (written into `gradle.properties` for the build only, not committed back)
4. Keystore restored from secrets, `./gradlew assembleRelease`
5. `zipalign` + `apksigner` sign and verify
6. Tag `v<VERSION_NAME>`, upload artifact (30 days), create GitHub Release with the signed APK

## Required repository secrets

`KEYSTORE_BASE64`, `KEY_ALIAS`, `KEY_PASSWORD`, `STORE_PASSWORD`

## Bumping the major version

Change the major part of `VERSION_NAME` in `gradle.properties` (e.g. `1.x` → `2.x`).
