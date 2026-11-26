# Contributing

1. Branch from `main`; keep changes focused.
2. Run `python3 tools/check_assets.py` before committing frontend changes. Markup lives in `html-src/`: edit it
   there. `frontend/index.html` is generated (gitignored) - Gradle builds it automatically; run
   `python3 tools/build_html.py` only if you want it for local browser preview.
3. Respect script/style load order in `html-src/index.src.html`; a file's folder does not change when it loads.
4. Put new code where it belongs: `frontend/scripts/features/<feature>/`, `frontend/styles/features/<feature>/`,
   shared code in `frontend/scripts/shared/`, native code in `app/src/main/java/com/one/wallet/<role>/`.
   Keep related files together in a topic folder (see "Where things live" in `docs/architecture.md`).
5. Never commit keys, keystores, tokens or `.env` files.
6. Describe wallet-logic, signing or key-handling changes explicitly in the PR; they get extra review.
7. Update `CHANGELOG.md` for user-visible changes.
