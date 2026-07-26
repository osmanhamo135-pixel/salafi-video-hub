"""
Builds the نور mark as two SVG groups: letterforms and the i'jam (the dot).

Shaped with HarfBuzz from Aref Ruqaa, the app's Arabic display face. The dot of
ن is a separate contour from the letter body, so it is split geometrically: the
smallest contour lying clear above the letter mass. Outlines are the font's own.
"""
import sys
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen
from fontTools.misc.transform import Transform

FONT = sys.argv[1]
OUT = sys.argv[2]
TEXT = 'نور'

blob = hb.Blob.from_file_path(FONT)
face = hb.Face(blob)
hbfont = hb.Font(face)
buf = hb.Buffer()
buf.add_str(TEXT)
buf.direction = 'rtl'; buf.script = 'Arab'; buf.language = 'ar'
hb.shape(hbfont, buf)

tt = TTFont(FONT)
order = tt.getGlyphOrder()
gs = tt.getGlyphSet()
upem = tt['head'].unitsPerEm

def contours_of(name, t):
    # Decomposing: these are composite glyphs, and a plain recording pen
    # would record addComponent calls instead of the actual contours.
    rp = DecomposingRecordingPen(gs)
    gs[name].draw(TransformPen(rp, t))
    out, cur = [], []
    for op, args in rp.value:
        cur.append((op, args))
        if op in ('closePath', 'endPath'):
            out.append(cur); cur = []
    if cur: out.append(cur)
    return out

def cbounds(c):
    pts = [a for op, args in c for a in args if isinstance(a, tuple)]
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)

all_contours = []
x = 0
for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
    t = Transform(1, 0, 0, 1, x + pos.x_offset, pos.y_offset)
    all_contours += contours_of(order[info.codepoint], t)
    x += pos.x_advance

bs = [cbounds(c) for c in all_contours]
minx = min(b[0] for b in bs); maxx = max(b[2] for b in bs)
miny = min(b[1] for b in bs); maxy = max(b[3] for b in bs)

# The letter bodies are the tall contours; i'jam are small and sit clear of them.
heights = [b[3] - b[1] for b in bs]
tall = max(heights)
body_top = max(b[3] for b, h in zip(bs, heights) if h > tall * 0.45)

def to_path(c):
    from fontTools.pens.svgPathPen import SVGPathPen
    pen = SVGPathPen(None)
    for op, args in c:
        getattr(pen, op)(*args)
    return pen.getCommands()

letters, dots = [], []
for c, b, h in zip(all_contours, bs, heights):
    is_dot = h < tall * 0.30 and b[1] > body_top * 0.55
    (dots if is_dot else letters).append(f'<path d="{to_path(c)}"/>')

pad = upem * 0.08
nl = chr(10)
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="{minx-pad:.0f} {-(maxy+pad):.0f} {(maxx-minx)+2*pad:.0f} {(maxy-miny)+2*pad:.0f}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
<g transform="scale(1,-1)">
<g class="mark-stroke">
{nl.join(letters)}
</g>
<g class="mark-ijam">
{nl.join(dots)}
</g>
</g>
</svg>
'''
open(OUT, 'w').write(svg)
print(f'contours {len(all_contours)} -> letters {len(letters)}, ijam {len(dots)} | aspect %.2f' % (((maxx-minx)+2*pad)/((maxy-miny)+2*pad)))
