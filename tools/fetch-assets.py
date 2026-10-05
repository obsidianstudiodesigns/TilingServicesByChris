"""Download the CC0 Poly Haven source textures and HDRI into tools/src/ph/.

Run once before tools/make-textures.py:  python tools/fetch-assets.py
"""
import json
import pathlib
import urllib.request

OUT = pathlib.Path(__file__).parent / 'src' / 'ph'
OUT.mkdir(parents=True, exist_ok=True)

TEXTURES = {
    # id: (resolution, maps)
    'concrete_floor_02': ('1k', ['Diffuse', 'nor_gl', 'Rough']),
    'painted_plaster_wall': ('2k', ['Diffuse', 'nor_gl', 'Rough']),
    'worn_plaster_wall': ('1k', ['Diffuse']),
    'long_white_tiles': ('2k', ['Diffuse', 'nor_gl', 'Rough']),
    'white_oak_veneer': ('2k', ['Diffuse', 'Rough']),
    'rubble': ('1k', ['Diffuse', 'nor_gl']),
}
HDRI = ('empty_play_room', '1k')


def get(url, dest):
    if dest.exists():
        return
    print('fetch', url)
    req = urllib.request.Request(url, headers={'User-Agent': 'tiling-site-build'})
    with urllib.request.urlopen(req) as r:
        dest.write_bytes(r.read())


def files(asset):
    req = urllib.request.Request(f'https://api.polyhaven.com/files/{asset}', headers={'User-Agent': 'tiling-site-build'})
    with urllib.request.urlopen(req) as r:
        return json.load(r)


for asset, (res, maps) in TEXTURES.items():
    info = files(asset)
    for m in maps:
        url = info[m][res]['jpg']['url']
        get(url, OUT / url.rsplit('/', 1)[1])

name, res = HDRI
url = files(name)['hdri'][res]['hdr']['url']
get(url, OUT / url.rsplit('/', 1)[1])
