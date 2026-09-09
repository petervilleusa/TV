#!/usr/bin/env python3
"""Write a real page for every channel, plus sitemap.xml and robots.txt.

Each project lives at /<slug>/, which is a directory holding its own
index.html. That means a deep link is served by any static host with no
rewrite rule to configure, and it arrives with its own <title>, description
and canonical already in the markup rather than waiting on JavaScript.

The pages are index.html with the head rewritten and a <base href="/"> added,
so every relative path in the document still resolves from the root.

Slugs and titles are read out of app.js, so the objects array stays the one
place a channel is defined. Re-run after adding, renaming or removing one:

    python3 tools/build-pages.py
"""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://petervilleusa.onrender.com'

# A sentence per project, for search results and link previews.
BLURB = {
    'pleeay':         'Records, cassettes, set lists and logos from the band Pleeay.',
    'logos':          'Logos, stickers and marks made for bands and their merch.',
    'fine-art':       'Paintings and wall sculptures made from concrete, canvas, '
                      'foam, enamel and wood.',
    'physical':       'Zines, merch designs, stickers and other physical pieces.',
    'pyramid-scheme': 'A track made for a group show at Bass & Reiner in San Francisco.',
    'music':          "Records I've made with different bands, plus a one-off track "
                      'made for a gallery show.',
    'development':    "Websites I've built through my work at Sparkart and as a "
                      'freelance developer.',
}
HOME_BLURB = ('Peter Warren. Painting, sculpture, print, logos, records, '
              "websites, and other things I've made.")


def channels(src):
    """(slug, project) for every object in app.js that has both.

    Anchored on `slug`, not on the opening brace: an object may carry a
    comment between the two, and the amplifier does.
    """
    out = []
    for m in re.finditer(r"slug:\s*'([^']+)',\s*channel:\s*\d+,"
                         r"\s*project:\s*'([^']*)'", src):
        out.append(m.groups())
    return out


def head(html, title, desc, canonical):
    """Swap the title, description and canonical, and root every relative path.

    index.html carries its own of each for the home page, so these replace
    rather than insert; <base> is the one thing only a sub-page needs, since
    every path in the document is written relative to the root.
    """
    html = re.sub(r'<title>.*?</title>', f'<title>{title}</title>', html,
                  count=1, flags=re.S)
    html = re.sub(r'<meta name="description" content="[^"]*">',
                  f'<meta name="description" content="{desc}">', html, count=1)
    html = re.sub(r'<link rel="canonical" href="[^"]*">',
                  f'<link rel="canonical" href="{canonical}">', html, count=1)

    # The share card has to say what THIS page is, not what the home page is.
    # Copied unchanged, every project would paste as "PETERVILLE USA" with the
    # same sentence under it, which is worse than no card: it looks like the
    # link is broken rather than specific. The image is deliberately left
    # alone — one picture of the wall stands for the whole site.
    html = re.sub(r'(<meta property="og:title" content=")[^"]*(">)',
                  lambda m: m.group(1) + title + m.group(2), html, count=1)
    html = re.sub(r'(<meta property="og:description" content=")[^"]*(">)',
                  lambda m: m.group(1) + desc + m.group(2), html, count=1)
    html = re.sub(r'(<meta property="og:url" content=")[^"]*(">)',
                  lambda m: m.group(1) + canonical + m.group(2), html, count=1)

    return html.replace('<title>', '<base href="/">\n  <title>', 1)


def main():
    src = open(os.path.join(ROOT, 'app.js')).read()
    index = open(os.path.join(ROOT, 'index.html')).read()
    found = channels(src)
    if not found:
        raise SystemExit('no channels with slugs found in app.js')

    written = []
    for slug, project in found:
        desc = BLURB.get(slug, f'{project} — PETERVILLE USA.')
        url = f'{SITE}/{slug}/'
        page = head(index, f'{project} — PETERVILLE USA', desc, url)
        d = os.path.join(ROOT, slug)
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, 'index.html'), 'w') as f:
            f.write(page)
        written.append((slug, project))

    urls = [f'{SITE}/'] + [f'{SITE}/{s}/' for s, _ in written]
    with open(os.path.join(ROOT, 'sitemap.xml'), 'w') as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n')
        f.write('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
        for u in urls:
            f.write(f'  <url><loc>{u}</loc></url>\n')
        f.write('</urlset>\n')

    with open(os.path.join(ROOT, 'robots.txt'), 'w') as f:
        f.write('User-agent: *\n'
                'Allow: /\n'
                f'Sitemap: {SITE}/sitemap.xml\n')

    # A renamed slug leaves its old directory behind, still serving a page
    # nothing links to. This says so rather than deleting anything — removing
    # a directory is a decision for whoever is looking at the output.
    keep = {s for s, _ in written}
    for name in sorted(os.listdir(ROOT)):
        d = os.path.join(ROOT, name)
        if (os.path.isdir(d) and name not in keep
                and not name.startswith(('.', '_'))
                and name not in ('media', 'tools')
                and os.path.exists(os.path.join(d, 'index.html'))):
            print(f'  STALE: /{name}/ is no longer a channel. Delete it by hand.')

    for slug, project in written:
        print(f'  /{slug}/  {project}')
    print(f'{len(written)} pages, sitemap.xml, robots.txt')


if __name__ == '__main__':
    main()
