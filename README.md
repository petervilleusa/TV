# PETERVILLE USA

A gallery of televisions. Each screen is a channel; clicking one takes the
project over the screen.

## Running it locally

    python3 tools/serve.py

Then open http://127.0.0.1:4173/. Use the project's own server rather than
`python3 -m http.server` — that one ignores HTTP Range requests and the videos
stall at `readyState 0`.

Append `?still` to the URL to skip all video. Ten decoders make the page hard to
screenshot or profile, and layout work rarely needs them running.

## Adding a television

Cut the set out so both the screen and the background are transparent, save it
into the source folder as the next number, then:

    tools/import-tv ~/Desktop/TV-trans/

It crops to the set, finds the screen aperture from the alpha channel, writes an
optimised WebP into `media/`, and prints the entry to paste into `objects[]` in
`app.js`. Outputs are named from the source file's number, so `3.png` becomes
`tv-03`. A fill ratio below ~90% means something is wrong with the cutout.

## Adding a project

Every object in `objects[]` carries a `channel` and a `project`. An object with
`channel: null` is scenery: part of the sculpture, but absent from the drawer's
list and not clickable. Coupling a project to a screen is those two values and
nothing else — the list sorts itself by channel number.

`media` accepts:

- a video path;
- an array of two stills, which cut back and forth like a channel flipping;
- `{ slides: [...], hold: ms, pan: true }`, a slideshow that crossfades. One
  shared timer moves a `data-on` attribute along the images, and the CSS does
  the fade. `pan` adds a Ken Burns drift: each slide scales away from a
  different corner, alternating in and out, over `hold + 1400ms` so the move
  never finishes early and sits frozen.

A slideshow is a `.flicker` for layout only. The two-still cut animation must
never reach it, which is why that rule is written `.flicker:not(.slides)` —
the two selectors otherwise match at equal specificity and source order
silently decides which wins.

### Blocks

`content.blocks` renders in order. Types: `text`, `grid`, `releases`,
`feature` (a carousel beside the writing), `links`, and `audio`.

Grid items take `title` and `desc`; `desc` prints under the title as the
materials line and is dropped when it only repeats the title, which is what
the old site's markup does for works with no materials of their own.

## How the layout works

There is ONE composition. Desktop shows it whole; mobile scales the same scene
so the room fills the screen, which leaves it wider than the phone, and pans
across it. Objects have a single `box` — there are no per-breakpoint positions.

Positions are percentages of the scene, and each object's height is derived from
its artwork's own aspect ratio, so nothing distorts at any window size. The
`screen` values are percentages of that television's own frame, not of the
scene; they come from the importer and should never be hand-edited.

## Controls

Every control on the site is the same two strokes at the same weight, drawn
from the Figma frames at 85/6 desktop and 49/4 mobile. The plus turns into a
minus, or a quarter turn into an X. Arrows are that stroke mitred rather than
a typeface's angle bracket.

The audio player is built from it too: a plus starts the track and folds into a
minus while it runs — the drawer toggle's exact move — and the progress line is
that minus stretched across the column, faint ahead of the playhead. It sizes
down to 40px but holds the same 85:6 ratio so it reads as one mark. There is no
browser chrome anywhere on the site.

## Deploying

Push to `main` on `petervilleusa/TV`, then trigger the deploy in Render by
hand. Render has no webhook on this repo, so a push alone does not ship.

Verify a deploy by grepping the served file for something you changed. Do not
compare file sizes — a one-character edit is usually byte-identical.

## Notes

- No commerce. There are no buy links anywhere; the site is for looking at the
  work. The two that existed are commented out in place in `app.js`, next to
  the zines they belonged to.
- Nothing is served from the old site. Every image is hosted here, so the
  domain can be pointed at this project without anything breaking. Audit with
  a grep for `petervilleusa.com` and `squarespace` before shipping.
- `#sky` is a working cloud video behind the ceiling cut-out, hidden by a
  single line in `style.css`. Its file is named in `data-src`, so hidden it
  costs no download; `app.js` attaches it only if that line is gone. Deleting
  the line is still all it takes to bring it back.
- Source artwork lives in `~/Desktop/PETERVILLE USA/`, not in this repo.

## Screenshotting this site

Headless Chrome lies about two things, and both have wasted hours:

- It throttles transitions and animations, so a computed style read straight
  after a state change returns the pre-animation value. Inject
  `*{transition:none!important}` before measuring, or read the property a
  moment later and check it against where the curve should be.
- It composites inline transforms into a screenshot but not animated ones, so
  a Ken Burns drift will not show up in a still no matter how you time it.
  Confirm those by reading the live `transform` mid-animation instead.

It also ignores `--window-size` for the page itself; render an iframe at the
size you want inside a larger window and crop.
