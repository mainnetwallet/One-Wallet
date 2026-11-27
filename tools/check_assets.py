#!/usr/bin/env python3
"""Sanity check for the split web assets of the Android app.

The page is built in memory from html-src/ (frontend/index.html is generated and
not committed), so no build step is needed first.

Verifies that
  * every css/js file referenced by the generated index.html exists,
  * every css/js file under frontend/ is referenced (no dead files),
  * no file is referenced twice,
  * every JS file passes `node --check` (when node is installed).

Usage:  python3 tools/check_assets.py
"""
import os
import re
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_html  # noqa: E402

ASSETS = os.path.join(os.path.dirname(__file__), "..", "frontend")
ASSETS = os.path.normpath(ASSETS)


def main() -> int:
    html = build_html.build()
    refs = [a or b for a, b in re.findall(
        r'(?:src|href)\s*=\s*(?:"((?:scripts|styles|vendor)/[^"]+)"|\'((?:scripts|styles|vendor)/[^\']+)\')', html)]
    problems = []

    for r in refs:
        if not os.path.isfile(os.path.join(ASSETS, r)):
            problems.append(f"missing file: {r}")
    dupes = {r for r in refs if refs.count(r) > 1}
    problems += [f"referenced twice: {d}" for d in sorted(dupes)]

    on_disk = set()
    for folder in ("scripts", "styles", "vendor"):
        for d, _, files in os.walk(os.path.join(ASSETS, folder)):
            for f in files:
                on_disk.add(os.path.relpath(os.path.join(d, f), ASSETS).replace(os.sep, "/"))
    problems += [f"not referenced by index.html: {f}" for f in sorted(on_disk - set(refs))]

    node = shutil.which("node")
    if node:
        for r in refs:
            if r.endswith(".js") and not r.startswith("vendor/"):
                res = subprocess.run([node, "--check", os.path.join(ASSETS, r)],
                                     capture_output=True, text=True)
                if res.returncode != 0:
                    problems.append(f"syntax error in {r}: {res.stderr.strip().splitlines()[0]}")
    else:
        print("node not found - skipping JS syntax check")

    if problems:
        print("\n".join(problems))
        return 1
    print(f"OK - {len(refs)} files referenced, all present, no dead files.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
