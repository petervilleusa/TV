#!/usr/bin/env python3
"""Import a cut-out television PNG into the wall.

Crops to the set, finds the screen aperture from the alpha channel, writes an
optimised WebP into media/, and prints the entry to paste into app.js.

    tools/import-tv.py ~/Desktop/TV-trans/2.png tv-02   one file
    tools/import-tv.py ~/Desktop/TV-trans/                a whole folder
"""
import os, subprocess, sys, tempfile
from collections import deque
from PIL import Image

MAX_EDGE = 1600
QUALITY = 86
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def aperture(im):
    """Bounding box of the interior hole, as fractions of the image."""
    W, H = im.size
    a = im.getchannel('A').load()
    outside = bytearray(W * H)
    stack = deque()

    def seed(x, y):
        if a[x, y] <= 8 and not outside[y * W + x]:
            outside[y * W + x] = 1
            stack.append((x, y))

    for x in range(W):
        seed(x, 0); seed(x, H - 1)
    for y in range(H):
        seed(0, y); seed(W - 1, y)
    while stack:
        x, y = stack.pop()
        for nx, ny in ((x+1, y), (x-1, y), (x, y+1), (x, y-1)):
            if 0 <= nx < W and 0 <= ny < H:
                i = ny * W + nx
                if not outside[i] and a[nx, ny] <= 8:
                    outside[i] = 1
                    stack.append((nx, ny))

    # The screen is the LARGEST enclosed region, not the union of all of them:
    # one stray transparent speck near an edge would otherwise stretch the
    # bounding box across the whole set.
    seen = bytearray(W * H)
    best = None
    for sy in range(H):
        for sx in range(W):
            i0 = sy * W + sx
            if seen[i0] or outside[i0] or a[sx, sy] > 8:
                continue
            q = deque([(sx, sy)])
            seen[i0] = 1
            x0 = x1 = sx
            y0 = y1 = sy
            n = 0
            while q:
                x, y = q.pop()
                n += 1
                if x < x0: x0 = x
                if x > x1: x1 = x
                if y < y0: y0 = y
                if y > y1: y1 = y
                for nx, ny in ((x+1, y), (x-1, y), (x, y+1), (x, y-1)):
                    if 0 <= nx < W and 0 <= ny < H:
                        j = ny * W + nx
                        if not seen[j] and not outside[j] and a[nx, ny] <= 8:
                            seen[j] = 1
                            q.append((nx, ny))
            if best is None or n > best[4]:
                best = (x0, y0, x1, y1, n)

    if best is None:
        sys.exit('No enclosed transparent region found. Is the screen actually cut out?')
    x0, y0, x1, y1, n = best
    return x0, y0, x1 - x0 + 1, y1 - y0 + 1, n


def process(src, name):
    im = Image.open(src).convert('RGBA')
    box = im.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    im = im.crop(box)
    W, H = im.size

    ax, ay, aw, ah, n = aperture(im)

    im.thumbnail((MAX_EDGE, MAX_EDGE), Image.LANCZOS)
    out = os.path.join(ROOT, 'media', name + '.webp')
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
        im.save(tmp.name)
        subprocess.run(['cwebp', '-quiet', '-q', str(QUALITY), '-alpha_q', '100',
                        '-m', '6', tmp.name, '-o', out], check=True)
    os.unlink(tmp.name)

    print(f'{os.path.basename(src)} -> media/{name}.webp'
          f'  ({os.path.getsize(src)/1e6:.1f}MB -> {os.path.getsize(out)/1024:.0f}KB)')
    print(f'  aperture fills {100*n/(aw*ah):.1f}% of its bounding box\n')
    print('  {')
    print(f"    id: '', label: '',")
    print( "    box:    { x: 0, y: 0, w: 30, rotate: 0 },")
    print(f'    ar: {W} / {H},')
    print(f'    screen: {{ x: {100*ax/W:.1f}, y: {100*ay/H:.1f}, '
          f'w: {100*aw/W:.1f}, h: {100*ah/H:.1f} }},')
    print(f"    frame: 'media/{name}.webp',")
    print( "    media: null")
    print('  },')


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    target = sys.argv[1]

    if os.path.isdir(target):
        # Name each output from the source file's own number, so 3.png becomes
        # tv-03 and stray files can never shift the numbering.
        files = []
        for f in os.listdir(target):
            stem, ext = os.path.splitext(f)
            if ext.lower() in ('.png', '.webp', '.tif', '.tiff') and stem.isdigit():
                files.append((int(stem), f))
        files.sort()
        if not files:
            sys.exit(f'No numbered images in {target}')
        skipped = [f for f in os.listdir(target)
                   if os.path.splitext(f)[1].lower() in ('.png', '.webp')
                   and not os.path.splitext(f)[0].isdigit()]
        for n, f in files:
            process(os.path.join(target, f), f'tv-{n:02d}')
        if skipped:
            print('\nskipped (not numbered): ' + ', '.join(sorted(skipped)))
        print(f'\n{len(files)} imported. Paste the entries above into objects[] in app.js,')
        print('then set each box (x, y, w, rotate) to place it in the scene.')
    else:
        if len(sys.argv) != 3:
            sys.exit(__doc__)
        process(target, sys.argv[2])


if __name__ == '__main__':
    main()
