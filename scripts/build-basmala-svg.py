"""
Builds the stretched Basmala (U+FDFD) as two SVG path groups.

U+FDFD in Amiri Quran is a composite glyph: a base skeleton plus 33 mark
components. Each component is classified by the font's own GDEF glyph class
(3 = mark), so the stroke/harakat split is the typeface's own classification.
Outlines are the font's real contours — nothing is traced or redrawn.
"""
import sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen
from fontTools.misc.transform import Transform

FONT = 'src/assets/fonts/AmiriQuran-Regular.ttf'
tt = TTFont(FONT)
upem = tt['head'].unitsPerEm
gs = tt.getGlyphSet()
classes = tt['GDEF'].table.GlyphClassDef.classDefs

glyf = tt['glyf']['uniFDFD']
assert glyf.isComposite()

stroke, harakat = [], []
minx = miny = 1e9
maxx = maxy = -1e9
counts = {'stroke': 0, 'mark': 0}

for comp in glyf.components:
    name = comp.glyphName
    dx, dy = getattr(comp, 'x', 0), getattr(comp, 'y', 0)
    t = Transform(1, 0, 0, 1, dx, dy)

    pen = SVGPathPen(gs)
    gs[name].draw(TransformPen(pen, t))
    d = pen.getCommands()
    if not d:
        continue

    bp = BoundsPen(gs)
    gs[name].draw(TransformPen(bp, t))
    if bp.bounds:
        x0, y0, x1, y1 = bp.bounds
        minx = min(minx, x0); maxx = max(maxx, x1)
        miny = min(miny, y0); maxy = max(maxy, y1)

    is_mark = classes.get(name) == 3
    counts['mark' if is_mark else 'stroke'] += 1
    (harakat if is_mark else stroke).append(f'<path d="{d}"/>')

pad = upem * 0.05
vb_x, vb_y = minx - pad, -(maxy + pad)
vb_w, vb_h = (maxx - minx) + 2 * pad, (maxy - miny) + 2 * pad

nl = chr(10)
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb_x:.0f} {vb_y:.0f} {vb_w:.0f} {vb_h:.0f}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
<g transform="scale(1,-1)">
<g class="basmala-stroke">
{nl.join(stroke)}
</g>
<g class="basmala-harakat">
{nl.join(harakat)}
</g>
</g>
</svg>
'''
open(sys.argv[1], 'w').write(svg)
print('components:', counts, '| viewBox aspect %.2f' % (vb_w / vb_h), '| bytes', len(svg))
