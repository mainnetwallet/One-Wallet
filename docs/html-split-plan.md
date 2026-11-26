# Plan: splitting `frontend/index.html`

Status: implemented (steps 1-5); `frontend/index.html` was later removed from git and is now generated at build time
(Gradle `:app:generateHtml`). The partial table below is the original proposal; the final partials are in
`html-src/partials/` and are described in `docs/architecture.md`.

## Findings

- `frontend/index.html` is 8,942 lines (~730 KB). About 7,900 lines are markup (pages, modals, sheets, drawers);
  the rest is ~306 `<script>` tags, one `<style>` and two inline scripts (lines 347 and 485).
- `<script src>` tags are interleaved with markup (for example lines 4530-4534 and 7896-8006), so a partial must
  be expanded in the exact position it has today. Load order must not change.
- `app/build.gradle` packages `../frontend` directly as APK assets (`assets.srcDirs = ['../frontend']`).
  There is no `package.json`, no Node toolchain and no bundler. CI only runs `tools/check_assets.py` and Gradle.
- Because of that, Vite (or any Node build) would add a toolchain, a CI step and a Gradle task, and it would need
  `assets.srcDirs` to point at a build output. That is more change than the problem needs.

## Recommended approach: a small Python include step

Keep the existing "no toolchain" setup and follow the pattern of `tools/check_assets.py`.

- Sources live outside `frontend/` so the APK does not ship them:
  `html-src/index.src.html` and `html-src/partials/*.html`.
- In `index.src.html`, a partial is pulled in with a line such as
  `<!--@include partials/page-home.html-->`.
- `tools/build_html.py` expands the includes in place and writes `frontend/index.html`.
  (Originally committed; now gitignored and produced by Gradle before each build.)
- `python3 tools/build_html.py --check` validates the partials (cycles, missing includes, unused partials). CI runs it
  before `check_assets.py`.

## Proposed partials (approximate current line ranges, cut at element boundaries)

| Partial | Lines |
| --- | --- |
| lock overlay + lock setup | 88-347 |
| splash, toast, app shell | 350-417 |
| page-home | 418-639 |
| page-swap + swap/bridge modals and overlays | 640-1508 |
| page-bridge + bridge overlays | 1509-1960 |
| page-profile | 1961-2239 |
| page-transfer-hub (split further: withdraw manager, approvals, wallet-to-wallet) | 2240-3992 |
| page-sup-transfer | 3993-4213 |
| page-base-swap-bot | 4214-4536 |
| page-settings + console modal | 4537-4750 |
| nansen / swap-modal-inner | 4751-5267 |
| page-delegation | 5268-5480 |
| page-exchange + exchange sheets | 5481-6458 |
| bottom navs | 6459-6508 |
| drawers, chain pickers, rpc manager | 6509-6931 |
| wallet-group, receive, address-list overlays | 6932-7582 |
| send flow (qr, send, confirm) | 7583-7900 |

## Steps

1. Add `tools/build_html.py` (include expansion and `--check`).
2. Move `index.html` to `html-src/index.src.html` unchanged and confirm the generated output is byte-identical
   to the current `frontend/index.html`.
3. Extract one partial at a time. After each extraction, rebuild and diff. The generated file must stay
   byte-identical to the original, so there is no behavior change by construction.
4. Add the `--check` step to `.github/workflows/build.yml` before `check_assets.py`.
5. Update `docs/architecture.md` (replace the "HTML partials" paragraph) and `CONTRIBUTING.md`
   ("edit `html-src/`, then run `python3 tools/build_html.py`").

## Risks

- Anyone who edits `frontend/index.html` directly will have the change overwritten. Mitigation: the CI
  `--check` step, plus a "generated file" notice added only after step 3, once byte-identity is proven.
- Inline scripts (lines 347 and 485) and the `_ph_init_style` block (line 348) must stay where they are.
- Partial boundaries must not cut through an element. The builder should verify that each partial is balanced.
