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

`media` accepts a video path, or an array of two stills which cut back and forth
like a channel flipping.

## How the layout works

There is ONE composition. Desktop shows it whole; mobile scales the same scene
so the room fills the screen, which leaves it wider than the phone, and pans
across it. Objects have a single `box` — there are no per-breakpoint positions.

Positions are percentages of the scene, and each object's height is derived from
its artwork's own aspect ratio, so nothing distorts at any window size. The
`screen` values are percentages of that television's own frame, not of the
scene; they come from the importer and should never be hand-edited.

## Notes

- `#sky` is a working cloud video behind the ceiling cut-out, currently hidden by
  a single line in `style.css`. Delete that line to bring it back.
- Source artwork lives in `~/Desktop/PETERVILLE USA/`, not in this repo.
