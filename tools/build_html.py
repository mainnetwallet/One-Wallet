#!/usr/bin/env python3
"""Builds frontend/index.html from html-src/index.src.html and its partials.

A line of the form

    <!--@include partials/page-home.html-->

in html-src/index.src.html (or in a partial) is replaced by the exact bytes of
that file, resolved relative to html-src/. Includes may be nested. The include
line itself is dropped, so a partial holds the lines exactly as they appear in
the generated file.

frontend/index.html is NOT committed (it is in .gitignore). It is generated:
  * by Gradle (task :app:generateHtml, wired before every build), and
  * by hand when you want to open the UI in a browser:

    python3 tools/build_html.py            # write frontend/index.html
    python3 tools/build_html.py --check    # validate partials only, write nothing
"""
import os
import re
import sys

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
SRC_DIR = os.path.join(ROOT, "html-src")
SRC = os.path.join(SRC_DIR, "index.src.html")
OUT = os.path.join(ROOT, "frontend", "index.html")

INCLUDE = re.compile(r"^[ \t]*<!--@include ([A-Za-z0-9_./-]+)-->[ \t]*\r?\n?$")


def expand(path, stack):
    real = os.path.realpath(path)
    if real in stack:
        raise SystemExit("include cycle: " + " -> ".join(stack + [real]))
    with open(path, encoding="utf-8", newline="") as f:
        lines = f.readlines()
    out = []
    for n, line in enumerate(lines, 1):
        m = INCLUDE.match(line)
        if not m:
            out.append(line)
            continue
        target = os.path.normpath(os.path.join(SRC_DIR, m.group(1)))
        if not target.startswith(SRC_DIR + os.sep):
            raise SystemExit(f"{path}:{n}: include escapes html-src/: {m.group(1)}")
        if not os.path.isfile(target):
            raise SystemExit(f"{path}:{n}: missing include: {m.group(1)}")
        out.append(expand(target, stack + [real]))
    return "".join(out)


def build():
    """Return the full generated HTML as a string (no file is written)."""
    return expand(SRC, [])


def unused_partials():
    used = set()

    def walk(path):
        with open(path, encoding="utf-8", newline="") as f:
            for line in f:
                m = INCLUDE.match(line)
                if m:
                    target = os.path.normpath(os.path.join(SRC_DIR, m.group(1)))
                    if target not in used:
                        used.add(target)
                        walk(target)

    walk(SRC)
    present = set()
    for d, _, files in os.walk(os.path.join(SRC_DIR, "partials")):
        for f in files:
            present.add(os.path.normpath(os.path.join(d, f)))
    return sorted(present - used)


def main(argv):
    check = "--check" in argv
    built = build()
    problems = [f"partial never included: {os.path.relpath(p, ROOT)}" for p in unused_partials()]
    if problems:
        print("\n".join(problems))
        return 1

    if check:
        print(f"OK - html-src/ expands cleanly ({built.count(chr(10)) + 1} lines), no unused partials.")
        return 0

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8", newline="") as f:
        f.write(built)
    print(f"wrote {os.path.relpath(OUT, ROOT)} ({built.count(chr(10)) + 1} lines)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
