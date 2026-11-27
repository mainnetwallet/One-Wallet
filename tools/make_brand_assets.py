#!/usr/bin/env python3
"""Regenerates every logo asset from one vector definition.

Writes: docs/branding/* (icon, 1024 icon, dark/light lockups), the Android launcher icons
(app/src/main/res/mipmap-*/ic_launcher*.png) and the favicon / apple-touch-icon data URIs in
html-src/index.src.html.

Needs: pip install cairosvg fonttools uharfbuzz  (and the Inter font, OFL, for the wordmark outlines).
The wordmark is converted to outlines so the SVG files look the same everywhere.
"""
import base64, io, os, re, sys
import cairosvg
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
FONT_DIR = os.environ.get("INTER_DIR", "/usr/share/fonts/opentype/inter")
MEDIUM = os.path.join(FONT_DIR, "Inter-Medium.otf")
REGULAR = os.path.join(FONT_DIR, "Inter-Regular.otf")

GRADIENT = ('<linearGradient id="ow-g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="200" y2="200">'
            '<stop offset="0" stop-color="#8b5cf6"/><stop offset="0.55" stop-color="#4f46e5"/>'
            '<stop offset="1" stop-color="#06b6d4"/></linearGradient>')


def mark(round_icon=False):
    """The icon in a 200x200 box. Needs GRADIENT in <defs>."""
    shape = '<circle cx="100" cy="100" r="100"/>' if round_icon else '<rect width="200" height="200" rx="46"/>'
    return (
        f'<clipPath id="ow-tile">{shape}</clipPath>'
        '<g clip-path="url(#ow-tile)"><rect width="200" height="200" fill="url(#ow-g)"/>'
        '<path d="M0 0H200V74Q100 104 0 74Z" fill="#ffffff" fill-opacity="0.1"/></g>'
        '<g transform="translate(16 0)">'
        '<rect x="40" y="88" width="104" height="66" rx="16" fill="#ffffff" fill-opacity="0.24" transform="rotate(-14 92 121)"/>'
        '<path d="M64 84L100 58" fill="none" stroke="#ffffff" stroke-width="24" stroke-linecap="round"/>'
        '<rect x="90" y="46" width="26" height="108" rx="13" fill="#ffffff"/></g>'
        '<circle cx="146" cy="60" r="10" fill="#fcd34d"/>')


def icon_svg(size, round_icon=False):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{size}" height="{size}" viewBox="0 0 200 200">'
            f'<title>One Wallet</title><defs>{GRADIENT}</defs>{mark(round_icon)}</svg>')


def text_outline(font_file, text, size, x, baseline, tracking=0.0):
    """Shapes `text` (with kerning) and returns (svg path data, x after the last glyph)."""
    face = hb.Face(hb.Blob.from_file_path(font_file))
    font = hb.Font(face)
    buf = hb.Buffer(); buf.add_str(text); buf.guess_segment_properties()
    hb.shape(font, buf, {"kern": True, "liga": False})
    tt = TTFont(font_file); order = tt.getGlyphOrder(); gs = tt.getGlyphSet()
    s = size / tt["head"].unitsPerEm
    cx, parts = x, []
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        pen = SVGPathPen(gs)
        gs[order[info.codepoint]].draw(TransformPen(pen, (s, 0, 0, -s, cx + pos.x_offset * s, baseline)))
        parts.append(pen.getCommands())
        cx += pos.x_advance * s + tracking
    return " ".join(p for p in parts if p), cx


def lockup_svg(dark):
    icon, pad, gap, size = 280, 70, 56, 150
    bg, c_one, c_wallet = ("#0b0b18", "#ffffff", "#c4b5fd") if dark else ("#f6f7fb", "#1e1b4b", "#6d28d9")
    cap = TTFont(MEDIUM)["OS/2"].sCapHeight / TTFont(MEDIUM)["head"].unitsPerEm * size
    h = icon + 2 * pad
    base = h / 2 + cap / 2
    x0 = pad + icon + gap
    d1, x1 = text_outline(MEDIUM, "One ", size, x0, base, -2.2)
    d2, x2 = text_outline(REGULAR, "Wallet", size, x1, base, -2.2)
    w = round(x2 + pad)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">'
            f'<title>One Wallet</title><defs>{GRADIENT}</defs><rect width="{w}" height="{h}" fill="{bg}"/>'
            f'<g transform="translate({pad} {pad}) scale({icon / 200})">{mark()}</g>'
            f'<path d="{d1}" fill="{c_one}"/><path d="{d2}" fill="{c_wallet}"/></svg>')


def png(svg, px=None):
    return cairosvg.svg2png(bytestring=svg.encode(), output_width=px, output_height=px) if px else cairosvg.svg2png(bytestring=svg.encode())


def write(path, data):
    mode = "wb" if isinstance(data, bytes) else "w"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, mode, **({} if mode == "wb" else {"encoding": "utf-8"})) as f:
        f.write(data)
    print("wrote", os.path.relpath(path, ROOT))


def main():
    b = os.path.join(ROOT, "docs", "branding")
    write(os.path.join(b, "one-wallet-icon.svg"), icon_svg(512))
    write(os.path.join(b, "one-wallet-icon-1024.png"), png(icon_svg(1024)))
    for name, dark in (("dark", True), ("light", False)):
        svg = lockup_svg(dark)
        write(os.path.join(b, f"one-wallet-logo-{name}.svg"), svg)
        write(os.path.join(b, f"one-wallet-logo-{name}.png"), png(svg))

    for folder, px in (("mdpi", 48), ("hdpi", 72), ("xhdpi", 96), ("xxhdpi", 144), ("xxxhdpi", 192)):
        r = os.path.join(ROOT, "app", "src", "main", "res", f"mipmap-{folder}")
        write(os.path.join(r, "ic_launcher.png"), png(icon_svg(px), px))
        write(os.path.join(r, "ic_launcher_round.png"), png(icon_svg(px, True), px))

    html_path = os.path.join(ROOT, "html-src", "index.src.html")
    html = open(html_path, encoding="utf-8").read()
    def uri(px): return "data:image/png;base64," + base64.b64encode(png(icon_svg(px), px)).decode()
    html, n1 = re.subn(r'(<link rel="apple-touch-icon" href=")data:image/png;base64,[A-Za-z0-9+/=\s]+(")', lambda m: m.group(1) + uri(180) + m.group(2), html)
    html, n2 = re.subn(r'(<link rel="icon" type="image/png" href=")data:image/png;base64,[A-Za-z0-9+/=\s]+(")', lambda m: m.group(1) + uri(64) + m.group(2), html)
    if (n1, n2) != (1, 1):
        sys.exit(f"expected 1+1 favicon tags, replaced {n1}+{n2}")
    write(html_path, html)


if __name__ == "__main__":
    main()
