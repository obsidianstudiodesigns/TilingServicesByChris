"""Build the textures in assets/3d/ for the 3D room.

Tile finishes (porcelain, marble, charcoal stone, old ceramic) are generated here as "slabs":
each tile in the scene samples its own window of the slab, so no two tiles look the same.
Wall, screed, mosaic and oak maps are re-graded from the CC0 Poly Haven sources that
tools/fetch-assets.py downloads into tools/src/ph/.

Needs Pillow, numpy and opencv-python:  python tools/make-textures.py
"""
import pathlib

import cv2
import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'tools' / 'src' / 'ph'
OUT = ROOT / 'assets' / '3d'
OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(7)


def fbm(n, octaves=6, base=4, persistence=0.5, seed=None):
    """Smooth value noise, sum of upsampled random grids, roughly 0..1."""
    r = np.random.default_rng(seed) if seed is not None else rng
    out = np.zeros((n, n), np.float32)
    amp, total = 1.0, 0.0
    for o in range(octaves):
        g = base * 2 ** o
        grid = r.random((g + 1, g + 1)).astype(np.float32)
        out += cv2.resize(grid, (n, n), interpolation=cv2.INTER_CUBIC) * amp
        total += amp
        amp *= persistence
    out /= total
    return (out - out.min()) / (out.max() - out.min() + 1e-6)


def save(name, arr, quality=88):
    arr = np.clip(arr, 0, 1)
    img = Image.fromarray((arr * 255).astype(np.uint8))
    img.save(OUT / name, quality=quality, optimize=True, progressive=True)
    print('wrote', name, (OUT / name).stat().st_size // 1024, 'KB')


def rgb(hexstr):
    h = hexstr.lstrip('#')
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)], np.float32)


def tint(field, dark, light):
    return dark[None, None, :] * (1 - field[..., None]) + light[None, None, :] * field[..., None]


def veins(n, freq, warp_amt, width, seed, angle=0.6):
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32) / n
    w1 = fbm(n, 3, 2, 0.5, seed)
    w2 = fbm(n, 6, 8, 0.6, seed + 1) * 0.35
    t = (xx * np.cos(angle) + yy * np.sin(angle)) * freq + (w1 - 0.5) * warp_amt + (w2 - 0.5) * warp_amt * 0.5
    v = np.abs(np.sin(t * np.pi))
    width = width * (0.4 + 1.4 * fbm(n, 4, 3, 0.5, seed + 3))
    core = np.exp(-(v / width) ** 2)
    halo = np.exp(-(v / (width * 5)) ** 2) * 0.25
    # veins fade in and out along their length
    fade = np.clip(fbm(n, 4, 2, 0.5, seed + 2) * 1.8 - 0.5, 0, 1)
    return np.clip((core + halo) * fade, 0, 1)


N = 2048

# ----- polished white porcelain: soft clouds and a faint grey drift, like the client's floors
clouds = fbm(N, 7, 3, 0.55, 11)
fine = fbm(N, 3, 128, 0.6, 12)
base = tint(clouds * 0.7 + fine * 0.3, rgb('#d9d8d4'), rgb('#efeeeb'))
drift = veins(N, 1.6, 1.1, 0.06, 13) * 0.35
base = base * (1 - drift[..., None] * 0.18)
save('tile-porcelain.jpg', base)

# ----- Carrara-style marble
m_clouds = fbm(N, 7, 3, 0.55, 21)
m = tint(m_clouds, rgb('#dcdcdb'), rgb('#f1f0ee'))
v1 = veins(N, 1.7, 1.5, 0.03, 22, 0.75)
v2 = veins(N, 4.5, 1.2, 0.018, 25, 0.35) * 0.45
vein_col = rgb('#7c818a')
for v in (v1, v2):
    m = m * (1 - v[..., None]) + vein_col[None, None, :] * v[..., None] * 0.9 + m * v[..., None] * 0.1
save('tile-marble.jpg', m)

# ----- charcoal honed stone with quartz flecks
s = tint(fbm(N, 7, 4, 0.6, 31), rgb('#2c2d30'), rgb('#4a4b4f'))
fleck = (fbm(N, 2, 400, 0.5, 32) > 0.83).astype(np.float32)
fleck = cv2.GaussianBlur(fleck, (3, 3), 0.7)
s = s + fleck[..., None] * 0.18
dark = (fbm(N, 2, 300, 0.5, 33) > 0.86).astype(np.float32)
s = s * (1 - cv2.GaussianBlur(dark, (3, 3), 0.7)[..., None] * 0.35)
save('tile-stone.jpg', s)

# ----- the old floor: worn beige ceramic, speckled, stained and scuffed
n = 1024
o = tint(fbm(n, 6, 4, 0.55, 41), rgb('#b5a588'), rgb('#d8cbb0'))
speck = (fbm(n, 2, 200, 0.5, 42) > 0.78).astype(np.float32)
o = o * (1 - cv2.GaussianBlur(speck, (3, 3), 0.8)[..., None] * 0.35)
stain = np.clip(fbm(n, 5, 3, 0.6, 43) * 2.2 - 1.2, 0, 1)
o = o * (1 - stain[..., None] * 0.3) + rgb('#6e5a3e')[None, None, :] * stain[..., None] * 0.12
save('tile-old.jpg', o)

# ----- notched-trowel adhesive: colour and a ridge normal map
n = 512
yy, xx = np.mgrid[0:n, 0:n].astype(np.float32) / n
wob = (fbm(n, 4, 4, 0.5, 51) - 0.5) * 0.05
ridge = 0.5 + 0.5 * np.sin((yy + wob) * np.pi * 2 * 14)
ridge = np.clip(ridge * 1.25 - 0.1, 0, 1) ** 0.8
height = ridge + (fbm(n, 4, 32, 0.5, 52) - 0.5) * 0.35
gy, gx = np.gradient(height)
nx, ny = -gx * 18, -gy * 18
l = np.sqrt(nx ** 2 + ny ** 2 + 1)
normal = np.stack([nx / l * 0.5 + 0.5, -ny / l * 0.5 + 0.5, 1 / l * 0.5 + 0.5], -1)
save('adhesive-normal.jpg', normal, 92)
a = tint(fbm(n, 6, 4, 0.5, 53) * 0.6 + ridge * 0.4, rgb('#8e8f8d'), rgb('#b4b5b1'))
save('adhesive-color.jpg', a)


def load(name, size=None):
    img = Image.open(SRC / name).convert('RGB')
    if size:
        img = img.resize((size, size), Image.LANCZOS)
    return np.asarray(img).astype(np.float32) / 255


def grade(arr, sat=1.0, gain=1.0, lift=0.0, contrast=1.0):
    lum = arr @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    arr = lum[..., None] + (arr - lum[..., None]) * sat
    mean = arr.mean()
    arr = (arr - mean) * contrast + mean
    return arr * gain + lift


# ----- screed: the stripped floor (dark, patchy) and the prepared floor (clean, even)
conc = load('concrete_floor_02_diff_1k.jpg')
save('screed-old.jpg', grade(conc, sat=0.35, gain=0.95, contrast=1.1))
save('screed-new.jpg', grade(conc, sat=0.12, gain=0.95, lift=0.2, contrast=0.45))
Image.open(SRC / 'concrete_floor_02_nor_gl_1k.jpg').save(OUT / 'screed-normal.jpg', quality=88)

# ----- walls: old tired paint, and the plaster detail used under fresh paint
save('wall-old.jpg', grade(load('worn_plaster_wall_diff_1k.jpg'), sat=0.7, gain=1.02))
plaster = load('painted_plaster_wall_diff_2k.jpg', 1024)
lum = plaster @ np.array([0.2126, 0.7152, 0.0722], np.float32)
save('wall-plaster.jpg', np.repeat(((lum - lum.mean()) * 2.2 + 0.75)[..., None], 3, -1))
Image.open(SRC / 'painted_plaster_wall_nor_gl_2k.jpg').resize((1024, 1024), Image.LANCZOS).save(OUT / 'wall-normal.jpg', quality=88)

# ----- shower walls: glazed finger mosaic
save('mosaic-color.jpg', grade(load('long_white_tiles_diff_2k.jpg', 1024), sat=0.55, gain=1.03))
Image.open(SRC / 'long_white_tiles_nor_gl_2k.jpg').resize((1024, 1024), Image.LANCZOS).save(OUT / 'mosaic-normal.jpg', quality=90)
Image.open(SRC / 'long_white_tiles_rough_2k.jpg').resize((512, 512), Image.LANCZOS).save(OUT / 'mosaic-rough.jpg', quality=85)

# ----- oak-look porcelain planks
save('tile-oak.jpg', grade(load('white_oak_veneer_diff_2k.jpg', 1024), sat=0.85, gain=1.08))

# ----- rubble heap
save('rubble-color.jpg', grade(load('rubble_diff_1k.jpg', 512), sat=0.6))
Image.open(SRC / 'rubble_nor_gl_1k.jpg').resize((512, 512), Image.LANCZOS).save(OUT / 'rubble-normal.jpg', quality=88)

# ----- environment light
(OUT / 'room-light-1k.hdr').write_bytes((SRC / 'empty_play_room_1k.hdr').read_bytes())
print('done')

# ----- the view out of the window: a garden from one of the client's own jobs, thrown out of focus
FB = ROOT / 'tools' / 'src' / 'fb'
view = Image.open(FB / 'sep-1569267638551823.jpg').convert('RGB').crop((0, 300, 1536, 1452)).resize((512, 384), Image.LANCZOS)
v = np.asarray(view).astype(np.float32) / 255
v = cv2.GaussianBlur(v, (0, 0), 9)
save('window-view.jpg', grade(v, sat=0.9, gain=1.15, lift=0.08, contrast=0.8))

# ----- small swatches for the finish picker
for name in ('porcelain', 'marble', 'stone', 'oak'):
    im = Image.open(OUT / f'tile-{name}.jpg').convert('RGB')
    w, h = im.size
    im.crop((w // 4, h // 4, w // 4 + w // 3, h // 4 + h // 3)).resize((96, 96), Image.LANCZOS).save(OUT / f'swatch-{name}.jpg', quality=85)
