#!/usr/bin/env python3
"""Generate the illuminated jadwal that frames the mushaf page.

A printed mushaf does not sit inside a plain rectangle. Its jadwal is a ruled
frame carrying an ornamental band, terminated at each corner by a khatam — the
eight-pointed star built from two overlapping squares. This draws all three
pieces as real geometry so they stay crisp at any zoom and on any DPI.

The output is consumed as a CSS `mask-image`, never as a picture: the shapes
are opaque black, the colour comes from the theme's gold underneath. That is
what lets one set of tiles serve all five themes without a per-theme asset, and
what keeps the ornament purely geometric — there is no depiction of any animate
being anywhere in these forms, only interlace and stars.

    python3 scripts/build-jadwal-svg.py
"""

from __future__ import annotations

import math
from pathlib import Path

OUT_DIR = Path(__file__).resolve().parent.parent / 'src' / 'assets' / 'marks'

# Band tile. The width is one full period of the guilloche; two counter-phase
# waves cross at 0, W/2 and W, which is what opens the row of eyes between them.
BAND_W = 40.0
BAND_D = 10.0
BAND_AMP = 2.6
STROKE = 1.05
DOT_R = 1.0

# Corner khatam.
CORNER = 20.0
CORNER_R = 6.7

SVG_OPEN = (
    '<svg xmlns="http://www.w3.org/2000/svg" width="{w:g}" height="{h:g}" '
    'viewBox="0 0 {w:g} {h:g}">'
)


def wave(phase: int, vertical: bool) -> str:
    """One period of a sine, sampled fine enough that no faceting survives
    rasterisation at high DPI. Sampling beats a Bezier fit here: the fit needs
    magic constants that are wrong at the inflection, and the path is small
    either way."""
    span = BAND_W
    centre = BAND_D / 2
    points = []
    steps = int(span * 2)  # 0.5px sampling
    for i in range(steps + 1):
        t = span * i / steps
        offset = centre + phase * BAND_AMP * math.sin(2 * math.pi * t / span)
        x, y = (offset, t) if vertical else (t, offset)
        points.append(f'{x:.2f},{y:.2f}')
    return 'M' + 'L'.join(points)


def band(vertical: bool) -> str:
    w, h = (BAND_D, BAND_W) if vertical else (BAND_W, BAND_D)
    parts = [SVG_OPEN.format(w=w, h=h)]
    parts.append(
        f'<g fill="none" stroke="#000" stroke-width="{STROKE}" '
        'stroke-linecap="round">'
    )
    for phase in (1, -1):
        parts.append(f'<path d="{wave(phase, vertical)}"/>')
    parts.append('</g>')

    # An eye sits at each quarter period, where the two waves are furthest apart.
    for quarter in (0.25, 0.75):
        along = BAND_W * quarter
        cx, cy = (BAND_D / 2, along) if vertical else (along, BAND_D / 2)
        parts.append(f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="{DOT_R:g}" fill="#000"/>')

    parts.append('</svg>')
    return ''.join(parts)


def square(rotation_deg: float) -> str:
    """A square as a closed path, given by its circumradius and rotation. Two of
    these at 45 degrees to each other are the khatam."""
    c = CORNER / 2
    pts = []
    for k in range(4):
        angle = math.radians(rotation_deg + 90 * k)
        pts.append(f'{c + CORNER_R * math.cos(angle):.2f},{c + CORNER_R * math.sin(angle):.2f}')
    return 'M' + 'L'.join(pts) + 'Z'


def corner() -> str:
    parts = [SVG_OPEN.format(w=CORNER, h=CORNER)]
    parts.append(
        f'<g fill="none" stroke="#000" stroke-width="{STROKE}" '
        'stroke-linejoin="round">'
    )
    for rotation in (0.0, 45.0):
        parts.append(f'<path d="{square(rotation)}"/>')
    parts.append(f'<circle cx="{CORNER / 2:g}" cy="{CORNER / 2:g}" r="1.5"/>')
    parts.append('</g></svg>')
    return ''.join(parts)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    written = {
        'jadwal-band-h.svg': band(vertical=False),
        'jadwal-band-v.svg': band(vertical=True),
        'jadwal-corner.svg': corner(),
    }
    for name, svg in written.items():
        path = OUT_DIR / name
        path.write_text(svg, encoding='utf-8')
        print(f'{name}: {len(svg)} bytes')


if __name__ == '__main__':
    main()
