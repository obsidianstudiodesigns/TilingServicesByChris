"""Logo crops, icons, link-preview image and web-sized job photos.

Sources: logo.jpg (the client's logo card) and the Facebook photos in tools/src/fb/.
Needs Pillow and numpy:  python tools/make-brand.py
"""
import pathlib

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

ROOT = pathlib.Path(__file__).resolve().parent.parent
FB = ROOT / 'tools' / 'src' / 'fb'
BRAND = ROOT / 'assets' / 'brand'
WORK = ROOT / 'assets' / 'work'
BRAND.mkdir(parents=True, exist_ok=True)
WORK.mkdir(parents=True, exist_ok=True)

logo = Image.open(ROOT / 'logo.jpg').convert('RGB')

# ----- the round emblem (ring, trowel and roller, "By Chris", phone tag), cut out on a white disc
CX, CY, R = 800, 478, 352
box = (CX - R, CY - R, CX + R, CY + R)
emblem = logo.crop(box)
mask = Image.new('L', emblem.size, 0)
ImageDraw.Draw(mask).ellipse((0, 0, 2 * R - 1, 2 * R - 1), fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(1.2))
mark = Image.new('RGBA', emblem.size, (0, 0, 0, 0))
mark.paste(emblem, (0, 0), mask)
mark.resize((512, 512), Image.LANCZOS).save(BRAND / 'logo-mark.png', optimize=True)
mark.resize((256, 256), Image.LANCZOS).save(BRAND / 'logo-mark-256.png', optimize=True)

# ----- icons: emblem on a white square
for size, name in [(32, 'favicon-32.png'), (180, 'apple-touch-icon.png'), (192, 'icon-192.png'), (512, 'icon-512.png')]:
    bg = Image.new('RGB', (size, size), (255, 255, 255))
    pad = 0 if size <= 32 else int(size * 0.04)
    m = mark.resize((size - 2 * pad, size - 2 * pad), Image.LANCZOS)
    bg.paste(m, (pad, pad), m)
    bg.save(BRAND / name, optimize=True)


# ----- job photos: full size (1600 on the long side) plus a 720 version for grids
PHOTOS = {
    'aug-1213581724120418': 'lounge-floor-finished',
    'aug-1213581794120411': 'lounge-floor-laying',
    'aug-1213581857453738': 'passage-adhesive-bed',
    'aug-1213581904120400': 'passage-first-tiles',
    'aug-1213581944120396': 'passage-kitchen-tiled',
    'sep-1569267225218531': 'montana-step-in-progress',
    'sep-1569267371885183': 'montana-stone-clad-step',
    'sep-1569267481885172': 'montana-patio-finished',
    'sep-1569267558551831': 'montana-patio-edge',
    'sep-1569267638551823': 'montana-patio-lawn',
    'sep2-1563829905762263': 'patio-bare-ground',
    'sep2-1563830049095582': 'patio-tiles-going-down',
    'sep2-1563830225762231': 'patio-final-clean',
    'cover-1389566246521964': 'on-site',
}
for src, name in PHOTOS.items():
    img = ImageOps.exif_transpose(Image.open(FB / f'{src}.jpg')).convert('RGB')
    for long_edge, suffix, q in [(1600, '', 82), (720, '-720', 78)]:
        im = img.copy()
        im.thumbnail((long_edge, long_edge), Image.LANCZOS)
        im.save(WORK / f'{name}{suffix}.jpg', quality=q, optimize=True, progressive=True)
    print(name, img.size)

# ----- link preview: emblem beside the finished lounge floor
og = Image.new('RGB', (1200, 630), (30, 42, 87))
photo = ImageOps.fit(Image.open(FB / 'aug-1213581724120418.jpg').convert('RGB'), (720, 630), Image.LANCZOS, centering=(0.5, 0.62))
og.paste(photo, (480, 0))
disc = Image.new('RGBA', (400, 400), (0, 0, 0, 0))
ImageDraw.Draw(disc).ellipse((0, 0, 399, 399), fill=(255, 255, 255, 255))
m = mark.resize((380, 380), Image.LANCZOS)
disc.paste(m, (10, 10), m)
og.paste(disc, (40, 115), disc)
og.save(BRAND / 'og-image.jpg', quality=85, optimize=True)
print('done')
