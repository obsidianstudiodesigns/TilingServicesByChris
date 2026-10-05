# Tiling Services by Chris website

A single-page site for Tiling Services by Chris (Bredell, Benoni), with privacy and terms pages.

- `index.html` is the website; `privacy.html` and `terms.html` are the legal pages.
- `js/scene.js` is the 3D room. As you scroll through "How a room gets retiled" it plays the job in five
  stages: old tiles lifted to a rubble pile, surface prepared, shower waterproofed, adhesive and tiles laid
  (with mosaic up the shower walls), then grouted, painted and fitted out. In the hero, visitors can swap the
  floor (polished porcelain, marble, charcoal stone on the diagonal, oak-look herringbone) and the wall colour.
- `js/main.js` connects the scroll position, the finish picker, the photo viewer and the quote form.

## Preview locally
The 3D scene uses JavaScript modules, so the site has to be served rather than opened as a file:

    python -m http.server 5563

Then open http://localhost:5563. Add `#debug` to the URL to expose `window.__room` in the console.

## Content sources
- Logo: `logo.jpg` (the client's logo card). `python tools/make-brand.py` cuts the round emblem out of it and
  builds the favicon, app icons, `assets/brand/og-image.jpg` and the web-sized job photos.
- Business details come from the Facebook page (facebook.com/profile.php?id=100064058051651):
  the intro (list of services), phone 074 973 3869, email yobechris@gmail.com and address.
- Job photos in `assets/work/` are the page's public photos, downloaded at full size into `tools/src/fb/`:
  - lounge and passage floor: post of 11 August 2025
  - Montana, Pretoria patio: 11 September 2026 (tagged Montana, Pretoria)
  - Kempton Park patio: 6 September 2026 (tagged Kempton Park)
  - `on-site.jpg`: the page's cover photo (1 March 2026)
- No reviews or testimonials are on the site. The Facebook page shows "Not yet rated (1 review)", and the
  review itself is not publicly visible.

## Confirm with the client
- Address: Facebook lists "3, Nineth road bredell , Benoni". The site uses "3 Ninth Road, Bredell, Benoni".
- The cover photo (hard hat, hi-vis) is used beside the contact details without a name. Check it is Chris and
  that he is happy for it to be used.
- Painting appears as a service because the logo reads "Tiling Services & Painting". The Facebook intro only
  lists tiling work, so check what painting work Chris takes on.
- Facebook only showed 5 of the 10 photos in the August 2025 post to logged-out visitors. Ask for the rest,
  or any newer photos, to fill out the gallery.

## 3D assets
`assets/3d/` holds CC0 assets from Poly Haven (polyhaven.com): the "Empty Play Room" HDRI for lighting, and the
concrete floor, painted plaster, worn plaster, long white tiles (mosaic), white oak veneer and rubble textures.
`python tools/fetch-assets.py` downloads the sources into `tools/src/ph/`, then `python tools/make-textures.py`
re-grades them and generates the porcelain, marble, charcoal stone and old-tile slabs, the trowel-combed
adhesive, the picker swatches and the out-of-focus garden outside the window (from one of the client's photos).
Both need Pillow, numpy and opencv-python.

The renderer compiles every shader in the background before it starts drawing (so nothing stalls mid-scroll),
then drops ambient occlusion and resolution on slower GPUs to stay smooth. Phones skip ambient occlusion.

## Hosting and domain
Canonical links, the link preview, `sitemap.xml` and `robots.txt` assume GitHub Pages at
https://obsidianstudiodesigns.github.io/TilingServicesByChris/. If the site goes elsewhere or the client gets
their own domain, replace that address in `index.html`, `privacy.html`, `terms.html`, `sitemap.xml` and
`robots.txt` (and add a `CNAME` file for a custom domain on Pages).
