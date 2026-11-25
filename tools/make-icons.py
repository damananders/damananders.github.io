"""tools/make-icons.py: draws every site icon (favicons, app icons, logo.svg) as Anders' face inside a ring split in
thirds: Wiki-Chip Dex green (top), AnyPS blue (right), AndersCraft orange (left).
Run from the repo root:  python3 tools/make-icons.py   (needs Pillow). The face comes from assets/icons/face.png."""
import base64, io, math, os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
FACE = Image.open(P("assets/icons/face.png")).convert("RGBA")
ROP, ANYPS, CRAFT = "#36d39a", "#3d8bff", "#ff7a1f"
# arcs in degrees, Pillow style (0 = 3 o'clock, clockwise); each third centred: green on top, blue lower-right, orange lower-left
ARCS = [(ROP, -150, -30), (ANYPS, -30, 90), (CRAFT, 90, 210)]

def icon(size, bg=None, pad=0.0, ring=0.085, gap=6):
    S = size * 8
    im = Image.new("RGBA", (S, S), bg or (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    m = S * pad
    box = [m, m, S - m, S - m]
    w = max(int(S * ring), 8)
    inner = int(m + w * 0.85)
    face = FACE.resize((S - 2 * inner, S - 2 * inner), Image.LANCZOS)
    d.ellipse([inner, inner, S - inner - 1, S - inner - 1], fill="#141a1f")      # dark disc behind the photo
    mask = Image.new("L", face.size, 0); ImageDraw.Draw(mask).ellipse([0, 0, face.size[0] - 1, face.size[1] - 1], fill=255)
    from PIL import ImageChops
    mask = ImageChops.multiply(mask, face.getchannel("A"))
    im.paste(face, (inner, inner), mask)
    g = gap if size >= 48 else 0     # no gaps at tiny sizes, they just blur
    for col, a, b in ARCS:
        d.arc(box, a + g / 2, b - g / 2, fill=col, width=w)
    return im.resize((size, size), Image.LANCZOS)

def save(img, *rel):
    img.save(P(*rel), optimize=True); print("wrote", "/".join(rel))

for name in ["fav-hub", "fav-anyps", "fav-anderscraft", "fav-vault", "fav-locker", "fav-404"]:
    save(icon(64), "assets", "icons", name + ".png")
save(icon(32), "assets", "icons", "favicon-32.png")
save(icon(192), "assets", "icons", "icon-192.png")
save(icon(512), "assets", "icons", "icon-512.png")
save(icon(512, bg="#07090b", pad=0.12), "assets", "icons", "icon-maskable-512.png")
save(icon(180, bg="#07090b", pad=0.06), "assets", "icons", "apple-touch-icon.png")
big = icon(256)
big.save(P("favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48), (64, 64)], bitmap_format="png"); print("wrote favicon.ico")
# logo.svg: the face as an embedded image plus three SVG arcs, so it stays crisp at any size
buf = io.BytesIO(); FACE.save(buf, "PNG", optimize=True)
def arc(a, b, r=29.5, c=32):
    a, b = math.radians(a + 3), math.radians(b - 3)
    return f"M{c + r * math.cos(a):.2f} {c + r * math.sin(a):.2f}A{r} {r} 0 0 1 {c + r * math.cos(b):.2f} {c + r * math.sin(b):.2f}"
svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Anders">'
       '<clipPath id="f"><circle cx="32" cy="32" r="26.5"/></clipPath><circle cx="32" cy="32" r="26.5" fill="#141a1f"/>'
       f'<image href="data:image/png;base64,{base64.b64encode(buf.getvalue()).decode()}" x="5" y="5" width="54" height="54" clip-path="url(#f)"/>'
       + "".join(f'<path d="{arc(a, b)}" fill="none" stroke="{col}" stroke-width="4.5" stroke-linecap="round"/>' for col, a, b in ARCS)
       + "</svg>")
open(P("assets/icons/logo.svg"), "w").write(svg); print("wrote assets/icons/logo.svg")
