"""Makes the small prints and textures the sage room uses (quote cards, leaf prints, pegboard holes).

  python blender/make_art.py   ->  blender/art/*.png
"""
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'art')
os.makedirs(OUT, exist_ok=True)
FONTS = 'C:/Windows/Fonts'


def font(name, size):
    for f in (name, 'georgia.ttf', 'times.ttf', 'arial.ttf'):
        try:
            return ImageFont.truetype(os.path.join(FONTS, f), size)
        except OSError:
            pass
    return ImageFont.load_default()


def quote_card(path, lines, size=(900, 1200), bg=(244, 239, 228), ink=(52, 58, 46), sprig=True, fsize=96, italic=False):
    im = Image.new('RGB', size, bg)
    d = ImageDraw.Draw(im)
    f = font('georgiai.ttf' if italic else 'georgia.ttf', fsize)
    lh = int(fsize * 1.25)
    y = size[1] // 2 - lh * len(lines) // 2 - (60 if sprig else 0)
    for line in lines:
        w = d.textlength(line, font=f)
        d.text(((size[0] - w) / 2, y), line, font=f, fill=ink)
        y += lh
    if sprig:  # a simple botanical sprig under the text
        cx, cy = size[0] // 2, y + 90
        d.line([(cx, cy + 90), (cx, cy - 70)], fill=(96, 122, 84), width=5)
        for i in range(5):
            yy = cy + 60 - i * 32
            for s in (-1, 1):
                d.ellipse([cx + s * 8 - (36 if s < 0 else 0), yy - 10, cx + s * 8 + (36 if s > 0 else 0), yy + 10],
                          fill=(120, 150, 104))
    im.filter(ImageFilter.GaussianBlur(0.6)).save(path)


quote_card(os.path.join(OUT, 'quote_soul.png'), ['Take', 'time to', 'make your', 'soul happy'], fsize=104)
quote_card(os.path.join(OUT, 'quote_focus.png'), ['Focus', 'on the', 'good'], size=(600, 800), fsize=92, sprig=False,
           bg=(226, 233, 216))
quote_card(os.path.join(OUT, 'quote_grow.png'), ["IT'S OKAY", 'TO GROW', 'SLOWLY'], size=(700, 700), fsize=72,
           sprig=False, bg=(150, 168, 120), ink=(245, 242, 232))

# leaf prints: crops of the rendered wallpaper, framed with a cream mat
wp = Image.open(os.path.join(os.path.dirname(OUT), '..', 'os', 'public', 'wallpaper.jpg')).convert('RGB')
for name, box in [('leaf_print_a.png', (1150, 80, 1750, 880)), ('leaf_print_b.png', (520, 200, 1120, 1000))]:
    crop = wp.crop(box).resize((600, 800))
    mat = Image.new('RGB', (680, 880), (240, 236, 226))
    mat.paste(crop, (40, 40))
    mat.save(os.path.join(OUT, name))

# pegboard: white board with 1-inch hole grid (texture covers 0.7 x 0.84 m)
W, H = 1400, 1680
peg = Image.new('RGB', (W, H), (238, 236, 230))
d = ImageDraw.Draw(peg)
step = W / 0.7 * 0.0254
y = step / 2
while y < H:
    x = step / 2
    while x < W:
        d.ellipse([x - 7, y - 7, x + 7, y + 7], fill=(96, 92, 86))
        x += step
    y += step
peg.save(os.path.join(OUT, 'pegboard.png'))
print('art ->', OUT)
