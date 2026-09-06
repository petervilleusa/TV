const shell  = document.querySelector('main');
const panel  = document.getElementById('panel');
const toggle = document.getElementById('toggle');
const close  = document.getElementById('close');
const stage  = document.getElementById('stage');
const wall   = document.getElementById('wall');
const scene  = document.getElementById('scene');
const backdrop = document.getElementById('backdrop');

/* The sky is hidden by one CSS line. Rather than ship half a megabyte to
   every visitor for something nobody sees, the file is only attached if that
   line is gone — so bringing it back really is a one line change. */
const sky = document.getElementById('sky');
if (sky && getComputedStyle(sky).display !== 'none') {
  sky.src = sky.dataset.src;
  sky.autoplay = true;
  sky.play().catch(() => {});
}
const project  = document.getElementById('project');

/* Where the pan stood when a project opened. Hiding the stage's overflow stops
   a finger, but momentum already in flight when the tap landed is not a finger,
   so anything that still moves it is put straight back. Declared up here with
   the rest of the state: lockToStage() can run during page load on a deep
   link, and a `let` further down the file would not exist yet. */
let frozenAt = 0;
stage.addEventListener('scroll', () => {
  if (stage.dataset.frozen && stage.scrollLeft !== frozenAt) {
    stage.scrollLeft = frozenAt;
  }
});

// the year keeps itself current
document.getElementById('copyright').textContent =
  `\u00A9 Peter Warren ${new Date().getFullYear()}`;

/* The scene's aspect ratio. Every television is placed in this coordinate
   space, so the wall crops rather than stretches on odd viewports. */
const SCENE_AR = 1614 / 1385;   // matches media/room.webp

/* The background gained a ceiling on top of the room. Everything placed in the
   scene is positioned against the whole image, but the phone layout and the
   floor line both care about the ROOM's share of it. */
const ROOM_FRACTION = 975 / 1385;

/* The wall/floor junction, as a percentage down the scene. The sets stand on
   this line, so it is what the phone framing anchors their base to. */
const SCENE_FLOOR = 78.9;

/* Mobile shows the SAME sculpture as desktop, not a second arrangement of it.
   The scene is scaled so its full HEIGHT fits the screen — the composition is
   never cropped top or bottom — which leaves it wider than the phone, and the
   pager pans across that width. CONTENT_LEFT and CONTENT_RIGHT bound the part
   worth panning to, and the slide count falls out of them. */
const CONTENT_LEFT = 27;
const CONTENT_RIGHT = 93;   // past the amplifier's right edge

/* Mobile scale is set by HEIGHT: the whole scene, ceiling included, is fitted
   to the screen. That is what keeps wall above the sculpture and floor below
   it, so it reads as an object in a room rather than a crop pressed against the
   top edge. The width then falls out of the aspect, and however many screens
   that spans is how many slides there are.

   MOBILE_FILL shrinks the scene below full height. Since it is anchored to the
   floor, a smaller scene sits the sculpture lower and opens more wall above it
   — the same effect as a taller ceiling, without a second background whose
   different aspect would force every object's y to be remapped. */
/* Two anchors frame the phone view: the top of the sculpture sits this far
   below the mark, and the floor it stands on sits this far down the screen.
   Together they fix both the scale AND the vertical position, which one anchor
   alone cannot — the old single anchor left whatever floor happened to remain. */
const MOBILE_TOP_GAP = 20;
const MOBILE_FLOOR_AT = 84;   // % down the screen

/* Where the slack goes when the composition does not exactly fill its slides.
   0 puts it all at the far end, 0.5 splits it evenly. Kept low so the first
   screen opens on the sculpture rather than on empty room. */
const MOBILE_LEAD = 0.18;



/* Cover the stage with the scene: the gallery always bleeds to the edges,
   and the artwork inside keeps its proportions. */
/* The scene always spans the full width and is anchored to the floor. Nothing
   is ever cropped horizontally, which is what makes the layout predictable: a
   percentage across the scene is the same percentage across the screen, so the
   sculpture starting at 29% always clears a drawer that ends at 25%, and the
   amplifier ending at 89% is always on screen.
   Vertically it just runs off the top on a short window, or leaves white above
   on a tall one — and since the top of the photograph is bare wall, more white
   simply reads as more wall. */
function fitScene() {
  const { width } = stage.getBoundingClientRect();
  if (!width) return;

  if (!isPhone()) {
    scene.style.width = width + 'px';
    scene.style.height = (width / SCENE_AR) + 'px';
    scene.style.left = '0px';
    scene.style.bottom = '0px';
    setScrollExtent(0);
    return;
  }

  /* Fit the scene's height to the screen. The televisions then pan across the
     first slides while the room photograph stays put behind them, and the
     amplifier gets the last slide to itself. */
  /* Size the scene so the tallest set reaches up to just under the mark. The
     scene is anchored to the floor, so its height is what controls where the
     top of the sculpture lands; solving for it directly beats guessing a
     zoom factor, and it re-solves itself if the mark or the pile changes. */
  const viewportH = stage.getBoundingClientRect().height;
  const cs = getComputedStyle(document.documentElement);
  const px = n => parseFloat(cs.getPropertyValue(n)) || 0;

  const topPct = Math.min(...objects.map(o => o.box.y));   // the tallest set
  const topY = px('--pad') + px('--mark-size') + MOBILE_TOP_GAP;
  const floorY = (MOBILE_FLOOR_AT / 100) * viewportH;

  // two knowns, two unknowns: the scene's height and where its top sits
  const height = (100 * (floorY - topY)) / (SCENE_FLOOR - topPct);
  const sceneTop = topY - (topPct / 100) * height;
  const sceneW = height * SCENE_AR;
  scene.style.width = sceneW + 'px';
  scene.style.height = height + 'px';
  scene.style.bottom = -(sceneTop + height - viewportH) + 'px';

  const contentW = ((CONTENT_RIGHT - CONTENT_LEFT) / 100) * sceneW;
  const slides = Math.max(1, Math.ceil(contentW / width));
  const left =
    (slides * width - contentW) * MOBILE_LEAD - (CONTENT_LEFT / 100) * sceneW;
  scene.style.left = left + 'px';

  /* Stop the pan exactly where the composition ends. Sizing the scroll range by
     whole screens overshoots — the last one runs past the artwork into blank
     page. One spacer reaching the content's right edge lets it end on the work. */
  setScrollExtent(left + (CONTENT_RIGHT / 100) * sceneW);
}


/* A single width spacer. It carries no pixels; it exists so the scroll
   container knows exactly how far the sculpture extends, and no further. */
function setScrollExtent(px) {
  const host = scene.parentElement;
  host.querySelectorAll('.page').forEach(el => el.remove());
  if (px <= host.clientWidth) return;
  const el = document.createElement('i');
  el.className = 'page';
  el.style.left = '0px';
  el.style.width = px + 'px';
  host.appendChild(el);
}



/* One entry per object in the gallery. Not everything is a television: a piece
   with no aperture simply hides its media behind opaque artwork until it is
   opened, at which point the artwork fades and the media takes the screen.
   box    — where the set sits on the wall. x/y/w are % of the scene; the
            height is derived from `ar` so the artwork never distorts.
   ar     — the frame artwork's own aspect ratio (width / height)
   screen — the aperture within that set, % of the set's own box.
            Measure it once per TV artwork; it is where the media shows through.
   frame  — transparent WebP of the set with the screen removed
   media  — image or video for the project */
/* The conduit panel sits at 36.3%-62.9% across, centred on 49.6%. The stack is
   centred on it so every cable in the photograph runs out from behind the sets. */
const CONDUIT_X = 49.6;

const STATIC = 'media/tv-static.mp4';   // placeholder until real media lands

/* How long the screen you clicked plays before the writing takes over. Long
   enough to register what you picked, short enough not to be a wait. */
const PREVIEW_MS = 2400;

/* On a phone the screen fills the height and the writing sits over its lower
   part; --media-band in the CSS decides where the writing starts. */
let previewTimer = null;
const BARS = 'media/crt-bars.webp';     // test pattern, on a couple of sets

/* Nine televisions and an amplifier, piled the way Paik piled them: the big
   sets on the ground, smaller portables riding on top. `z` is the stacking
   order, so upper sets overlap the ones they rest on. Sizes follow the actual
   models, so the Coby and RCA portables read small next to the Apex console. */
/* The Every Body zine is a Pleeay record AND a piece of print, so it appears on
   both channels. Declared once and referenced twice, because two copies of the
   same block drift the moment either is edited. */
const EVERY_BODY_ZINE = {
  type: 'feature',
  heading: '"Every Body" zine',
  kicker: 'Book / magazine, with the digital album',
  items: [
    { src: 'media/zine/04.webp', alt: 'Every Body zine, open spread' },
    { src: 'media/zine/01.webp', alt: 'Every Body zine, cover' },
    { src: 'media/zine/02.webp', alt: 'Every Body zine, inside pages' },
    { src: 'media/zine/03.webp', alt: 'Every Body zine, stack' },
    { src: 'media/zine/05.webp', alt: 'Every Body zine, spread and stack' },
    { src: 'media/zine/06.webp', alt: 'Every Body zine, inside pages' },
  ],
  body: [
    'A limited edition zine with the lyrics to every song on the Pleeay debut album Every Body, and photographs of the band along the way.',
    'Each one is made by hand, so no two are the same.',
  ],
  /* links: [{ label: 'Get one', href: 'https://pleeay.bandcamp.com/merch/every-body-zine' }], */
};

/* Same again for the records. They belong to Pleeay, and they are also the
   reason the amplifier is a channel at all, so Music gathers them rather than
   taking them away. */
const SPOTIFY = 'https://open.spotify.com/artist/1fHEtLF9XmgaWFGTjG6b5n';
const YOUTUBE = 'https://www.youtube.com/channel/UCnmZlJOeYuwToNTesosgQeg';

const PLEEAY_RELEASES = {
  type: 'releases', heading: 'Releases', columns: 3, ratio: '1', items: [
    { art: '', slot: 'cover', title: 'Wealth + Hellness Vol. 1', links: [
      { label: 'Spotify', href: SPOTIFY },
    ]},
    { art: '', slot: 'cover', title: 'Wealth + Hellness Vol. 2', tone: '#8C8C90', links: [
      { label: 'Coming soon', href: '#' },
    ]},
    { art: '', slot: 'cover', title: 'NO', links: [
      { label: 'Spotify', href: SPOTIFY },
      { label: 'YouTube', href: YOUTUBE },
    ]},
    { art: '', slot: 'cover', title: 'Live recordings', links: [
      { label: 'Listen', href: '#' },
    ]},
  ],
};

const PYRAMID_TRACK = {
  type: 'audio', tracks: [
    { title: 'Pyramid scheme', src: 'media/audio/pyramid-scheme.mp3' },
  ],
};

const objects = [
  /* Arrangement follows Peter's composition mockup (Reference/desktop-composition.png):
     a wide, low pile rather than a tight pyramid — the big console and the Apex
     carrying the floor, the silver set and the Sansui stacked above, the small
     portables clustered right, the yellow set with its aerial crowning it, and
     the RCA pushed forward onto the floor in front. Scaled to about 87% of the
     mockup so the whole pile sits inside the scene rather than running off the
     top on a short window. */
  { id: 'tv1',  slug: 'pleeay', channel: 1, project: 'Pleeay',  z: 3,
    /* Up from 17.6, where a band of wall showed under it, but short of the
       19.6 that closed the gap completely — Peter's call, halfway between.
       Grown from the centre so it spreads either side rather than only right. */
    box:    { x: 28.3, y: 43.75, w: 18.6, rotate: -0.8 },
    ar: 2975 / 2137,
    screen: { x: 7.5,  y: 8.3,  w: 68.2, h: 76.6 },
    content: {
      title: 'Pleeay',
      blocks: [
        { type: 'text', heading: 'The band', body: [
          'Pleeay is a San Francisco new wave band fronted by a nonbinary ballet-fairy vocalist. Drums, bass, synths, dance and poetry, used to resist conformity, choose consciousness over convenience, and live loudly with compassion.',
        ], list: [
          { name: 'Castle', role: 'vox and dance' },
          { name: 'Huli',   role: 'drums and synth' },
          { name: 'Peter',  role: 'bass and design' },
        ]},

        /* The group portrait is landscape and the two live shots are 4:5, so
           they cannot share a grid — one ratio would crop the other badly.
           The wide one opens the page and the pair follows it. */
        { type: 'grid', columns: 1, ratio: '3 / 2', lightbox: true, items: [
          { src: 'media/pleeay/band.webp', alt: 'Pleeay' },
        ]},

        { type: 'grid', columns: 2, ratio: '4 / 5', lightbox: true, items: [
          { src: 'media/pleeay/live-01.webp', title: 'Tenderloin Festival',
            alt: 'Peter playing bass' },
          { src: 'media/pleeay/live-02.webp', title: 'Tenderloin Festival',
            alt: 'Castle singing' },
        ]},

        PLEEAY_RELEASES,

        { type: 'grid', heading: 'Set lists and merch table', columns: 5,
          ratio: '1082 / 1400', lightbox: true, items: [
          { src: 'media/setlists/00.webp', title: 'Bandshell',   alt: 'Set list, Bandshell' },
          { src: 'media/setlists/01.webp', title: 'KO',          alt: 'Set list, KO' },
          { src: 'media/setlists/02.webp', title: 'KO, second',  alt: 'Set list, KO' },
          { src: 'media/setlists/03.webp', title: 'Price list',  alt: 'Merch table price list' },
          { src: 'media/setlists/04.webp', title: 'Email list',  alt: 'Merch table email sign up' },
        ]},

        { type: 'grid', heading: 'Logos', columns: 3, ratio: '1', fit: 'contain',
          lightbox: true, items: [
          { src: 'media/logos/neon.webp',   title: 'Neon',   alt: 'Pleeay neon logo' },
          { src: 'media/logos/slayer.webp', title: 'Slayer', alt: 'Pleeay slayer logo' },
          { src: 'media/logos/people.webp', title: 'People', alt: 'Pleeay people logo',
            tile: '#E2E2E2' },
          { flip: ['media/stickers/dark.webp', 'media/stickers/light.webp'],
            title: 'Boop', alt: 'Pleeay sticker' },
          /* the two are exact inverses of one another, so the cut reads as the
             button flipping rather than as two designs. No tile: each carries
             its own disc, and a square behind them would kill that. */
          { flip: ['media/buttons/line.webp', 'media/buttons/disc.webp'],
            title: 'Buttons', alt: 'Pleeay button' },
        ]},

        EVERY_BODY_ZINE,

        { type: 'links', heading: 'Elsewhere', items: [
          { label: 'pleeay.com', href: 'https://www.pleeay.com/' },
          { label: 'Instagram', href: 'https://www.instagram.com/pleeaymusic/' },
          { label: 'Spotify', href: 'https://open.spotify.com/artist/1fHEtLF9XmgaWFGTjG6b5n' },
          { label: 'YouTube', href: 'https://www.youtube.com/channel/UCnmZlJOeYuwToNTesosgQeg' },
        ]},
      ],
    },
    frame: 'media/tv-01.webp', backdrop: 'media/backdrop/pleeay.webp',
    media: 'media/tv-01-screen.mp4' },

  { id: 'tv2',  channel: null, project: null,  z: 8,
    box:    { x: 42.0, y: 73.32, w: 8.5, rotate: 1.4 },
    ar: 3725 / 3429,
    screen: { x: 15.1, y: 24.3, w: 69.8, h: 53.9 },
    frame: 'media/tv-02.webp', media: STATIC },

  { id: 'tv3',  channel: 3, project: null,  z: 7,
    box:    { x: 47.7, y: 63.39, w: 14.5, rotate: 0.5 },
    ar: 2154 / 1979,
    screen: { x: 11.5, y: 10.9, w: 77.9, h: 62.7 },
    frame: 'media/tv-03.webp', media: BARS },

  { id: 'tv4',  slug: 'fine-art', channel: 4, project: 'Fine art',  z: 5,
    box:    { x: 28.2, y: 58.32, w: 18.4, rotate: -0.4 },
    ar: 3317 / 3183,
    screen: { x: 9.6,  y: 12.0, w: 81.9, h: 65.3 },
    content: {
      title: 'Fine art',
      blocks: [
        { type: 'text', heading: 'Painting and sculpture', body: [
          'Paintings and wall sculpture. Concrete, canvas, foam, enamel and wood, mostly built rather than painted, and often shaped so the edge of the work is part of the drawing.',
        ]},

        { type: 'grid', heading: 'Current work', columns: 3, ratio: '1', fit: 'contain', lightbox: true, items: [
          { src: 'media/art/current/00.webp', title: "Installation View", alt: "Installation View" },
          { src: 'media/art/current/01.webp', title: "Installation with Pony Vice and Canvas wrapped Wood", alt: "Installation with Pony Vice and Canvas wrapped Wood" },
          { src: 'media/art/current/02.webp', title: "Tetrad (concrete)", desc: "Enamel and Concrete, 24\u201dx24\u201d", alt: "Tetrad (concrete)" },
          { src: 'media/art/current/03.webp', title: "Modular Twins", desc: "Casein and House Paint on Inset Wood and Canvas, 28\u201dx40\u201d ea", alt: "Modular Twins" },
          { src: 'media/art/current/04.webp', title: "Tetrad (wrapped)", desc: "Acrylic on Canvas, 36\u201dx36\u201d", alt: "Tetrad (wrapped)" },
          { src: 'media/art/current/05.webp', title: "Tetrad (Sun)", desc: "Acrylic Spray Paint on Canvas and Wall, 10\u201dx10\u201d", alt: "Tetrad (Sun)" },
          { src: 'media/art/current/06.webp', title: "Broken Flag", desc: "Acrylic and Wax on Concrete, 16\u201d x 12\u201d", alt: "Broken Flag" },
          { src: 'media/art/current/07.webp', title: "Tetrad (Russian Dolls)", desc: "Acrylic on Wood, 12\u201dx16\u201d, 9\u201dx12\u201d, 6\u201dx10\u201d, 4\u201dx3.5\u201d", alt: "Tetrad (Russian Dolls)" },
          { src: 'media/art/current/08.webp', title: "Tetrad (Russian Doll) part 3", desc: "Acrylic on Wood, 12\u201d x 9\u201d", alt: "Tetrad (Russian Doll) part 3" },
          { src: 'media/art/current/09.webp', title: "Tablet (for David Ireland)", desc: "Acrylic on Copper, 14\u201d x 19\u201d", alt: "Tablet (for David Ireland)" },
          { src: 'media/art/current/10.webp', title: "Foam (Tied)", desc: "Acrylic on Foam, 4\u201dx4\u201d", alt: "Foam (Tied)" },
        ]},

        { type: 'grid', heading: 'Tablets, 2018', columns: 3, ratio: '1', fit: 'contain', lightbox: true, items: [
          { src: 'media/art/tablets/00.webp', title: "Tablet (Swimming Pink)", desc: "Acrylic and Ink on Canvas and Vinyl, 12\u201d x 16\u201d", alt: "Tablet (Swimming Pink)" },
          { src: 'media/art/tablets/01.webp', title: "Tablet (Any Alter-like Structure Made for Keeping Sacred Fire)", desc: "Acrylic on Canvas and Vinyl, 18\u201d x 24\u201d", alt: "Tablet (Any Alter-like Structure Made for Keeping Sacred Fire)" },
          { src: 'media/art/tablets/02.webp', title: "Tablet (ITTI)", desc: "Oil and Acrylic on Canvas and Wood, 16\"x12\"", alt: "Tablet (ITTI)" },
          { src: 'media/art/tablets/03.webp', title: "Tablet (Passing Through)", desc: "Mixed media on canvas and wood, 32\" x 46\"", alt: "Tablet (Passing Through)" },
          { src: 'media/art/tablets/04.webp', title: "Modular Painting 3", desc: "Acrylic on Wood, 2.5\u201d x 6\u201d ea.", alt: "Modular Painting 3" },
          { src: 'media/art/tablets/05.webp', title: "Tablet (What Draws a Plant Root Toward Water)", desc: "Mixed media on canvas and vinyl, 18\" x 24\"", alt: "Tablet (What Draws a Plant Root Toward Water)" },
          { src: 'media/art/tablets/06.webp', title: "Tablet (Let's Go Swimming)", desc: "Mixed Media on Canvas and Wood, 18\u201dx24\u201d", alt: "Tablet (Let's Go Swimming)" },
          { src: 'media/art/tablets/07.webp', title: "Tablet (Slings and Arrows of Outrageous Portion)", desc: "Acrylic on Canvas and Vinyl, 18\u201d x 24\u201d", alt: "Tablet (Slings and Arrows of Outrageous Portion)" },
          { src: 'media/art/tablets/08.webp', title: "Tablet (Greenhouse)", desc: "24\" x 30\" Acrylic and gesso on Canvas", alt: "Tablet (Greenhouse)" },
          { src: 'media/art/tablets/09.webp', title: "Tablet (Room for Two)", desc: "Gesso and Ink on Canvas, 18\"x24\"", alt: "Tablet (Room for Two)" },
          { src: 'media/art/tablets/10.webp', title: "Tablet (You and Me Both)", desc: "Acrylic and gesso on Canvas, 24\u201d x 30\u201d", alt: "Tablet (You and Me Both)" },
        ]},

        { type: 'grid', heading: 'Interiors, 2017', columns: 5, ratio: '1', fit: 'contain', lightbox: true, items: [
          { src: 'media/art/interiors/00.webp', alt: "Interiors, 2017" },
          { src: 'media/art/interiors/01.webp', alt: "Interiors, 2017" },
          { src: 'media/art/interiors/02.webp', alt: "Interiors, 2017" },
          { src: 'media/art/interiors/03.webp', alt: "Interiors, 2017" },
          { src: 'media/art/interiors/04.webp', alt: "Interiors, 2017" },
          { src: 'media/art/interiors/05.webp', alt: "Interiors, 2017" },
          { src: 'media/art/interiors/06.webp', alt: "Interiors, 2017" },
          { src: 'media/art/interiors/07.webp', alt: "Interiors, 2017" },
          { src: 'media/art/interiors/08.webp', alt: "Interiors, 2017" },
          { src: 'media/art/interiors/09.webp', alt: "Interiors, 2017" },
          { src: 'media/art/interiors/10.webp', alt: "Interiors, 2017" },
          { src: 'media/art/interiors/11.webp', alt: "Interiors, 2017" },
          { src: 'media/art/interiors/12.webp', alt: "Interiors, 2017" },
          { src: 'media/art/interiors/13.webp', alt: "Interiors, 2017" },
          { src: 'media/art/interiors/14.webp', alt: "Interiors, 2017" },
          { src: 'media/art/interiors/15.webp', alt: "Interiors, 2017" },
          { src: 'media/art/interiors/16.webp', alt: "Interiors, 2017" },
          { src: 'media/art/interiors/17.webp', alt: "Interiors, 2017" },
          { src: 'media/art/interiors/18.webp', alt: "Interiors, 2017" },
          { src: 'media/art/interiors/19.webp', alt: "Interiors, 2017" },
          { src: 'media/art/interiors/20.webp', alt: "Interiors, 2017" },
          { src: 'media/art/interiors/21.webp', alt: "Interiors, 2017" },
          { src: 'media/art/interiors/22.webp', alt: "Interiors, 2017" },
          { src: 'media/art/interiors/23.webp', alt: "Interiors, 2017" },
          { src: 'media/art/interiors/24.webp', alt: "Interiors, 2017" },
          { src: 'media/art/interiors/25.webp', alt: "Interiors, 2017" },
          { src: 'media/art/interiors/26.webp', alt: "Interiors, 2017" },
          { src: 'media/art/interiors/27.webp', alt: "Interiors, 2017" },
        ]},

        { type: 'grid', heading: 'Jumper, 2015', columns: 3, ratio: '1', fit: 'contain', lightbox: true, items: [
          { src: 'media/art/jumper/00.webp', alt: "Jumper, 2015" },
          { src: 'media/art/jumper/01.webp', alt: "Jumper, 2015" },
          { src: 'media/art/jumper/02.webp', alt: "Jumper, 2015" },
          { src: 'media/art/jumper/03.webp', alt: "Jumper, 2015" },
          { src: 'media/art/jumper/04.webp', alt: "Jumper, 2015" },
          { src: 'media/art/jumper/05.webp', alt: "Jumper, 2015" },
          { src: 'media/art/jumper/06.webp', alt: "Jumper, 2015" },
          { src: 'media/art/jumper/07.webp', alt: "Jumper, 2015" },
          { src: 'media/art/jumper/08.webp', alt: "Jumper, 2015" },
        ]},
      ],
    },
    frame: 'media/tv-04.webp',
    backdrop: 'media/backdrop/fine-art.webp',
    media: { slides: ['media/art/screen.webp'], hold: 11000, pan: true } },

  { id: 'tv5',  slug: 'print', channel: 5, project: 'Print',  z: 3,
    box:    { x: 46.6, y: 52.97, w: 10.4, rotate: 0.9 },
    ar: 5688 / 5044,
    screen: { x: 8.6,  y: 10.6, w: 82.9, h: 70.6 },
    frame: 'media/tv-05.webp',
    backdrop: 'media/backdrop/print.webp',
    content: {
      title: 'Print',
      blocks: [
        { type: 'text', heading: 'Paper',
          body: [
            'Zines, folded and stapled in small numbered runs. Printing is the one place the work stops being an edition of one.',
          ]},

        { type: 'feature',
          heading: '"Becoming" zine',
          kicker: 'Single fold, edition of 20',
          items: [
            { src: 'media/print/becoming/00.webp', alt: 'Becoming zine, stack of covers' },
            { src: 'media/print/becoming/01.webp', alt: 'Becoming zine, back cover text' },
            { src: 'media/print/becoming/02.webp', alt: 'Becoming zine, open spread' },
          ],
          body: [
            'A single fold zine combining vector shapes, text, and process photographs of paintings mid production.',
            'Edition of 20.',
          ],
          /* No buying anywhere on the site for now — it is a place to look at
             the work, not a shop. The mailto is kept here, commented, because
             it is the one that will come back first.
             links: [{ label: 'Ask about one',
               href: 'mailto:peterwarren13@gmail.com?subject=Becoming%20zine%20purchase%20inquiry' }], */
        },

        EVERY_BODY_ZINE,
      ],
    },
    media: { slides: ['media/print/screen.webp'], hold: 11000, pan: true } },

  { id: 'tv6',  channel: 6, project: null,  z: 2,
    box:    { x: 63.4, y: 52.48, w: 10.0, rotate: -1.2 },
    ar: 1924 / 1646,
    screen: { x: 10.2, y: 20.4, w: 62.2, h: 58.3 },
    frame: 'media/tv-06.webp', media: STATIC },

  /* the same little YORX as channel 10; Peter uses three of them */
  { id: 'yorxB',  slug: 'pyramid-scheme', channel: 8,  project: 'Pyramid Scheme',  z: 4,
    box:    { x: 62.2, y: 61.77, w: 5.2, rotate: 1.1 },
    ar: 2141 / 2321,
    screen: { x: 14.3, y: 15.0, w: 71.3, h: 49.5 },
    frame: 'media/tv-10.webp', content: {
      title: 'Pyramid scheme',
      blocks: [
        { type: 'text', heading: 'A one off', body: [
          'A single track, and the spiral that went with it.',
        ]},
        PYRAMID_TRACK,
        { type: 'grid', columns: 1, ratio: '1200 / 476', fit: 'contain', lightbox: true, items: [
          { src: 'media/pyramids.webp', alt: 'Pyramids' },
        ]},
      ],
    },
    backdrop: 'media/backdrop/pyramid-scheme.webp',
    media: 'media/spiral.mp4' },

  { id: 'tv8',  channel: 7, project: null,  z: 6,
    box:    { x: 62.8, y: 68.25, w: 10.7, rotate: 0.6 },
    ar: 2368 / 2019,
    screen: { x: 6.8,  y: 7.5,  w: 87.0, h: 75.5 },
    frame: 'media/tv-08.webp', media: STATIC },

  { id: 'yorxC',  channel: null, project: null,  z: 4,
    box:    { x: 67.9, y: 61.49, w: 5.4, rotate: -1.6 },
    ar: 2141 / 2321,
    screen: { x: 14.3, y: 15.0, w: 71.3, h: 49.5 },
    frame: 'media/tv-10.webp', media: STATIC },

  { id: 'tv10', slug: 'logos', channel: 2, project: 'Logos',  z: 2,
    box:    { x: 47.6, y: 44.25, w: 7.2, rotate: 1.8 },
    ar: 2141 / 2321,
    screen: { x: 14.3, y: 15.0, w: 71.3, h: 49.5 },
    content: {
      title: 'Logos',
      blocks: [
        { type: 'text', heading: 'Marks', body: [
          'Logos, stickers and marks made for bands and their merch. Most begin as something drawn by hand and end up somewhere it can be printed, stitched, worn or lit.',
        ]},

        { type: 'grid', heading: 'Marks', columns: 3, ratio: '1', fit: 'contain',
          lightbox: true, items: [
          { src: 'media/logos/neon.webp',   title: 'Pleeay neon',   alt: 'Pleeay neon logo' },
          { src: 'media/logos/slayer.webp', title: 'Pleeay slayer', alt: 'Pleeay slayer logo' },
          { src: 'media/logos/people.webp', title: 'Pleeay people', alt: 'Pleeay people logo',
            tile: '#E2E2E2' },
          { flip: ['media/stickers/dark.webp', 'media/stickers/light.webp'],
            title: 'Pleeay boop', alt: 'Pleeay sticker' },
          { flip: ['media/bird-dark.webp', 'media/bird-light.webp'],
            title: 'JT Bird logo', alt: 'JT Bird logo' },
        ]},
      ],
    },
    frame: 'media/tv-10.webp', backdrop: 'media/backdrop/logos.webp',
    media: ['media/bird-dark.webp', 'media/bird-light.webp'] },

  { id: 'tv11', channel: null, project: null,  z: 1,
    box:    { x: 40.3, y: 31.36, w: 10.7, rotate: -0.6 },
    ar: 2914 / 2966,
    screen: { x: 6.9,  y: 45.8, w: 61.7, h: 43.7 },
    frame: 'media/tv-11.webp', media: BARS },

  /* The amplifier is the one object here that was built to make sound, so it
     is where the sound lives. Everything playable on the wall is gathered
     behind it — the records stay on Pleeay and the track stays on Pyramid
     Scheme, and this is the third place they can be reached from. */
  { /* no aperture: its media hides behind the cabinet until the takeover */
    id: 'amp',  slug: 'music', channel: 9, project: 'Music', z: 10,
    box:    { x: 73.0, y: 52.2, w: 19.14, rotate: 0 },
    ar: 838 / 1400,
    screen: { x: 20,   y: 28,   w: 60,   h: 34 },
    content: {
      title: 'Music',
      blocks: [
        { type: 'text', heading: 'Everything that plays', body: [
          'Records, a one off, and whatever else has been recorded. Bass and design in Pleeay, and the odd track made alone.',
        ]},

        PLEEAY_RELEASES,
        PYRAMID_TRACK,
        EVERY_BODY_ZINE,

        { type: 'links', heading: 'Listen', items: [
          { label: 'Spotify', href: SPOTIFY },
          { label: 'YouTube', href: YOUTUBE },
          { label: 'pleeay.com', href: 'https://www.pleeay.com/' },
        ]},
      ],
    },
    frame: 'media/amp-01.webp', backdrop: 'media/backdrop/music.webp',
    media: null },

  /* Sits on the amplifier, and shows this site on its screen. Everything else
     on the wall plays something made somewhere else; this one plays the room
     it is standing in. */
  { id: 'laptop', slug: 'development', channel: 10, project: 'Development', z: 11,
    /* Seated by measuring both artworks. The amplifier's cabinet only reaches
       full width 8.9% down its own frame — that line is its top plate, and the
       laptop's front-left corner has to land on it. */
    box:    { x: 73.85, y: 44.6, w: 15.0, rotate: -1 },
    ar: 2836 / 1885,
    screen: { x: 35.0, y: 7.3, w: 60.7, h: 61.9 },
    crt: false,   // an LCD has no scan lines and no tube to darken at the corners
    cursor: true,
    content: {
      title: 'Development',
      blocks: [
        { type: 'text', heading: 'Sites', body: [
          'Websites built and shipped. The screen on this one is showing the page you are reading.',
        ]},
      ],
    },
    frame: 'media/laptop.webp',
    media: { slides: ['media/laptop-screen.webp'], hold: 11000, pan: true } }
];

/* A set is a channel. Give it a `project` and the name appears beside the
   number; leave it null and the channel stands alone. */
/* ---------------------------------------------------------------------------
   PROJECT CONTENT
   A project is a list of blocks, not markup. Four types cover everything so
   far; add a case here to add a kind of block.
     text     heading + paragraphs
     grid     images in N columns, optionally opening a lightbox
     releases a record: art, title, and where to hear it
     links    a plain list of places to go
   --------------------------------------------------------------------------- */
/* Every enlargeable image in the open project, in document order. Opening any
   one of them steps through all of them, so the lightbox belongs to the project
   rather than to the block it was opened from. */
let gallery = [];
let group = 0;          // one per block, so arrows stay within a single piece

/* The site's mark, built rather than typed. `x` is two strokes that turn a
   quarter circle into a cross; `prev`/`next` are the same stroke mitred. */
function makeMark(kind) {
  if (kind === 'prev' || kind === 'next') {
    const b = el('button', 'mark-chev');
    b.dataset.dir = kind;
    b.setAttribute('aria-label', kind === 'prev' ? 'Previous' : 'Next');
    return b;
  }
  const b = el('button', 'mark');
  b.dataset.kind = 'x';
  b.setAttribute('aria-label', 'Close');
  b.append(el('span', 'bar bar-h'), el('span', 'bar bar-v'));
  requestAnimationFrame(() => { b.dataset.on = 'true'; });   // spins in
  return b;
}

/* mailto and tel hand off to another app, so a new tab would be left blank
   behind them. Only real pages open away from the site. */
function setLinkTarget(a, href) {
  if (/^(mailto:|tel:)/i.test(href)) return;
  a.target = '_blank';
  a.rel = 'noopener';
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

/* ---- the player --------------------------------------------------------
   Built from the same two strokes as every other control. The plus starts
   the track and folds into a minus while it runs, exactly as the drawer's
   mark does; the progress line is that minus stretched across the column.
   No browser chrome, so the page keeps one vocabulary. */

const clock = s => {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  return m + ':' + String(Math.floor(s % 60)).padStart(2, '0');
};

/* Only one track at a time — starting a second stops the first rather than
   layering them. */
const players = [];

function buildTrack(t) {
  const row = el('div', 'track');
  row.appendChild(el('p', 'track-title', t.title));

  const audio = el('audio');
  audio.src = t.src;
  audio.preload = 'metadata';       // enough for the duration, not the file

  const play = el('button', 'mark track-play');
  play.dataset.kind = 'play';
  play.append(el('span', 'bar bar-h'), el('span', 'bar bar-v'));

  const line = el('div', 'track-line');
  const fill = el('i', 'track-fill');
  line.appendChild(fill);
  line.setAttribute('role', 'slider');
  line.setAttribute('aria-label', t.title + ' position');
  line.tabIndex = 0;

  const time = el('span', 'track-time', '0:00');

  const paint = () => {
    const d = audio.duration;
    const at = d ? audio.currentTime / d : 0;
    fill.style.width = (at * 100) + '%';
    // the length only appears once the file has told us what it is
    time.textContent = clock(audio.currentTime) + (isFinite(d) ? ' / ' + clock(d) : '');
    line.setAttribute('aria-valuetext', time.textContent);
  };

  const label = () => {
    const on = !audio.paused;
    play.dataset.playing = String(on);
    play.setAttribute('aria-label', (on ? 'Pause ' : 'Play ') + t.title);
  };
  label();

  play.addEventListener('click', () => {
    if (audio.paused) {
      players.forEach(p => { if (p !== audio) p.pause(); });
      audio.play();
    } else {
      audio.pause();
    }
  });

  audio.addEventListener('play', label);
  audio.addEventListener('pause', label);
  audio.addEventListener('ended', () => { audio.currentTime = 0; label(); paint(); });
  audio.addEventListener('timeupdate', paint);
  audio.addEventListener('loadedmetadata', paint);
  audio.addEventListener('durationchange', paint);

  /* Scrub by pressing anywhere on the line and dragging along it. */
  const seekTo = e => {
    const b = line.getBoundingClientRect();
    if (!b.width || !isFinite(audio.duration)) return;
    const at = Math.min(1, Math.max(0, (e.clientX - b.left) / b.width));
    audio.currentTime = at * audio.duration;
    paint();
  };
  line.addEventListener('pointerdown', e => {
    line.setPointerCapture(e.pointerId);
    line.dataset.scrub = 'true';
    seekTo(e);
  });
  line.addEventListener('pointermove', e => { if (line.dataset.scrub) seekTo(e); });
  const drop = e => {
    if (!line.dataset.scrub) return;
    delete line.dataset.scrub;
    line.releasePointerCapture(e.pointerId);
  };
  line.addEventListener('pointerup', drop);
  line.addEventListener('pointercancel', drop);

  line.addEventListener('keydown', e => {
    const step = { ArrowLeft: -5, ArrowRight: 5, ArrowDown: -5, ArrowUp: 5 }[e.key];
    if (step == null || !isFinite(audio.duration)) return;
    e.preventDefault();
    audio.currentTime = Math.min(audio.duration, Math.max(0, audio.currentTime + step));
    paint();
  });

  players.push(audio);
  row.append(play, line, time, audio);
  return row;
}

function renderBlock(b) {
  if (b.type === 'text') {
    const wrap = el('section', 'block-text');
    if (b.heading) wrap.appendChild(el('h2', null, b.heading));
    (b.body || []).forEach(t => wrap.appendChild(el('p', null, t)));
    if (b.list) {
      const dl = el('dl', 'pairs');
      b.list.forEach(row => {
        dl.appendChild(el('dt', null, row.name));
        dl.appendChild(el('dd', null, row.role));
      });
      wrap.appendChild(dl);
    }
    return wrap;
  }

  if (b.type === 'grid' || b.type === 'releases') {
    const wrap = el('section', 'block-grid');
    if (b.heading) wrap.appendChild(el('h2', null, b.heading));
    if (b.columns) wrap.style.setProperty('--cols', b.columns);
    /* A phone collapses every grid to two columns, but a block that asked for
       one wants the whole width — it is a single picture, not a row. */
    if (b.columns === 1) wrap.dataset.single = 'true';
    if (b.ratio) wrap.style.setProperty('--ratio', b.ratio);
    if (b.fit === 'contain') wrap.dataset.fit = 'contain';
    const g = ++group;
    (b.items || []).forEach(item => {
      const fig = el('figure', b.type === 'releases' ? 'release' : null);
      /* materials sit under the title. The archive repeats the title in the
         description where a work has no materials of its own, so a line that
         only says the title again is dropped rather than printed twice. */
      const note = item.desc && item.desc !== item.title ? item.desc : '';

      // two images cut between each other, the same trick the channels use
      if (Array.isArray(item.flip)) {
        const flick = el('div', 'flicker flicker-still');
        item.flip.forEach(src => {
          const fi = el('img');
          fi.src = src; fi.alt = item.alt || item.title || ''; fi.loading = 'lazy';
          flick.appendChild(fi);
        });
        if (item.tile) flick.style.background = item.tile;
        if (b.lightbox) {
          const at = gallery.length;
          gallery.push({ group: g, flip: item.flip, src: item.flip[0], alt: item.alt || '',
                         heading: item.title || b.heading || '' });
          flick.style.cursor = 'zoom-in';
          flick.addEventListener('click', () => openLightbox(at));
        }
        fig.appendChild(flick);
        if (item.title) fig.appendChild(el('figcaption', null, item.title));
        wrap.appendChild(fig);
        return;
      }

      /* A slot whose artwork has not been supplied yet is NOT an image. An
         empty src resolves to the page itself — a wasted request and a broken
         icon — and a silent empty box just reads as a picture that failed to
         load. It says what it is waiting for instead. */
      const src = item.src || item.art || '';
      if (!src) {
        const slot = el('figure', b.type === 'releases' ? 'release' : null);
        const box = el('div', 'slot', item.slot || 'image to come');
        if (item.tone) box.style.background = item.tone;
        slot.appendChild(box);
        if (item.title) {
          const cap = el('figcaption');
          cap.appendChild(el('span', 'fig-title', item.title));
          slot.appendChild(cap);
        }
        if (item.links) {
          const ul = el('ul');
          item.links.forEach(l => {
            const li = el('li'), a = el('a', null, l.label);
            a.href = l.href; setLinkTarget(a, l.href);
            li.appendChild(a); ul.appendChild(li);
          });
          slot.appendChild(ul);
        }
        wrap.appendChild(slot);
        return;
      }

      const img = el('img');
      img.src = src;
      img.alt = item.alt || item.title || '';
      img.loading = 'lazy';
      if (item.tone) img.style.background = item.tone;   // art not made yet
      if (item.tile) img.style.background = item.tile;   // the ground it needs
      if (b.lightbox) {
        const at = gallery.length;
        gallery.push({
          group: g,
          src: item.src || item.art,
          alt: item.alt || item.title || '',
          heading: item.title || b.heading || '',
          body: note ? [note] : null,
        });
        img.style.cursor = 'zoom-in';
        img.addEventListener('click', () => openLightbox(at));
      }
      fig.appendChild(img);
      if (item.title || note) {
        const cap = el('figcaption');
        if (item.title) cap.appendChild(el('span', 'fig-title', item.title));
        if (note) cap.appendChild(el('span', 'fig-note', note));
        fig.appendChild(cap);
      }
      if (item.links) {
        const ul = el('ul');
        item.links.forEach(l => {
          const li = el('li'), a = el('a', null, l.label);
          a.href = l.href; setLinkTarget(a, l.href);
          li.appendChild(a); ul.appendChild(li);
        });
        fig.appendChild(ul);
      }
      wrap.appendChild(fig);
    });
    return wrap;
  }

  /* A carousel on one half, the writing on the other. The same set of images
     opens in the lightbox, which carries the description with it. */
  if (b.type === 'feature') {
    const wrap = el('section', 'block-feature');
    const media = el('div', 'carousel');
    const stageImg = el('img', 'carousel-main');
    stageImg.src = b.items[0].src;
    stageImg.alt = b.items[0].alt || b.heading || '';
    stageImg.addEventListener('click', () => openLightbox(base + current));

    let current = 0;
    const base = gallery.length;
    const g = ++group;
    b.items.forEach(item => gallery.push({
      group: g,
      src: item.src,
      alt: item.alt || '',
      heading: b.heading || '',
      body: b.body || [],
      links: b.links || [],
    }));

    const thumbs = el('div', 'carousel-thumbs');
    b.items.forEach((item, i) => {
      const t = el('button', 'thumb');
      const ti = el('img');
      ti.src = item.src; ti.alt = item.alt || ''; ti.loading = 'lazy';
      t.appendChild(ti);
      t.addEventListener('click', () => {
        current = i;
        stageImg.src = item.src;
        [...thumbs.children].forEach((c, j) => c.dataset.on = String(j === i));
      });
      t.dataset.on = String(i === 0);
      thumbs.appendChild(t);
    });

    media.append(stageImg, thumbs);

    const copy = el('div', 'block-text');
    if (b.heading) copy.appendChild(el('h2', null, b.heading));
    if (b.kicker) copy.appendChild(el('p', 'kicker', b.kicker));
    (b.body || []).forEach(t => copy.appendChild(el('p', null, t)));
    if (b.links) {
      const ul = el('ul', 'inline-links');
      b.links.forEach(l => {
        const li = el('li'), a = el('a', null, l.label);
        a.href = l.href; setLinkTarget(a, l.href);
        li.appendChild(a); ul.appendChild(li);
      });
      copy.appendChild(ul);
    }

    wrap.append(media, copy);
    return wrap;
  }

  if (b.type === 'audio') {
    const wrap = el('section', 'block-audio');
    if (b.heading) wrap.appendChild(el('h2', null, b.heading));
    (b.body || []).forEach(t => wrap.appendChild(el('p', null, t)));
    (b.tracks || []).forEach(t => wrap.appendChild(buildTrack(t)));
    return wrap;
  }

  if (b.type === 'links') {
    const wrap = el('section', 'block-links');
    if (b.heading) wrap.appendChild(el('h2', null, b.heading));
    const ul = el('ul');
    (b.items || []).forEach(l => {
      const li = el('li'), a = el('a', null, l.label);
      a.href = l.href; setLinkTarget(a, l.href);
      li.appendChild(a); ul.appendChild(li);
    });
    wrap.appendChild(ul);
    return wrap;
  }

  return null;
}

function renderProject(o) {
  project.replaceChildren();
  gallery = [];
  group = 0;
  if (!o || !o.content) { project.hidden = true; return; }
  project.hidden = false;
  project.scrollTop = 0;
  project.appendChild(el('h1', null, o.content.title || labelOf(o)));
  (o.content.blocks || []).forEach(b => {
    const node = renderBlock(b);
    if (node) project.appendChild(node);
  });
  // each block rises a beat after the one above it
  [...project.children].forEach((n, i) => n.style.setProperty('--i', i));
}

/* The lightbox belongs to the piece you opened, not the whole page: the arrows
   and the strip beneath stay within that one set of images. */
function openLightbox(at = 0) {
  if (!gallery.length) return;
  const set = gallery.filter(x => x.group === gallery[at].group);
  let i = Math.max(0, set.indexOf(gallery[at]));

  const box = el('div'); box.id = 'lightbox';
  const frame = el('figure', 'lightbox-frame');
  const media = el('div', 'lightbox-media');
  const cap = el('figcaption', 'lightbox-copy');
  const count = el('p', 'lightbox-count');
  const strip = el('div', 'carousel-thumbs lightbox-thumbs');

  set.forEach((item, n) => {
    const t = el('button', 'thumb');
    const ti = el('img');
    ti.src = item.flip ? item.flip[0] : item.src;
    ti.alt = item.alt || '';
    t.appendChild(ti);
    t.addEventListener('click', e => { e.stopPropagation(); show(n); });
    strip.appendChild(t);
  });

  const show = n => {
    i = (n + set.length) % set.length;
    const item = set[i];

    media.replaceChildren();
    if (item.flip) {
      const flick = el('div', 'flicker flicker-still');
      item.flip.forEach(src => {
        const fi = el('img'); fi.src = src; fi.alt = item.alt || '';
        flick.appendChild(fi);
      });
      media.appendChild(flick);
    } else {
      const im = el('img'); im.src = item.src; im.alt = item.alt || '';
      media.appendChild(im);
    }

    cap.replaceChildren();
    if (item.heading) cap.appendChild(el('h2', null, item.heading));
    (item.body || []).forEach(t => cap.appendChild(el('p', null, t)));
    (item.links || []).forEach(l => {
      const a = el('a', null, l.label);
      a.href = l.href; setLinkTarget(a, l.href);
      const wrap = el('p'); wrap.appendChild(a); cap.appendChild(wrap);
    });
    if (set.length > 1) {
      count.textContent = `${i + 1} / ${set.length}`;
      cap.appendChild(count);
    }
    [...strip.children].forEach((c, j) => c.dataset.on = String(j === i));
  };
  show(i);

  const prev = makeMark('prev'); prev.classList.add('lightbox-step', 'prev');
  const next = makeMark('next'); next.classList.add('lightbox-step', 'next');
  prev.addEventListener('click', e => { e.stopPropagation(); show(i - 1); });
  next.addEventListener('click', e => { e.stopPropagation(); show(i + 1); });

  const shut = makeMark('x');
  shut.addEventListener('click', e => { e.stopPropagation(); box.remove(); });

  if (set.length > 1) media.appendChild(strip);
  frame.append(media, cap);
  box.append(frame, shut);
  if (set.length > 1) box.append(prev, next);

  box.addEventListener('click', e => { if (e.target === box) box.remove(); });
  box.dataset.step = set.length > 1 ? 'true' : 'false';
  box._step = n => { show(n); box._i = i; };
  box._i = i;
  document.body.appendChild(box);
}

function labelOf(o) {
  if (o.channel == null) return '';           // scenery has no channel to name
  return o.project ? `Channel ${o.channel} : ${o.project}` : `Channel ${o.channel}`;
}

/* The drawer's list is built from the same array, so a new set never has to be
   added in two places. */
const navList = document.getElementById('nav-list');
/* Only objects with a channel are listed. The rest are part of the sculpture
   but not yet a project — give one a channel and a project and it joins the
   list, in number order rather than stacking order. */
[...objects]
  .filter(o => o.channel != null)
  .sort((a, b) => a.channel - b.channel)
  .forEach(o => {
  const li = document.createElement('li');
  const a = document.createElement('a');
  a.href = o.slug ? `/${o.slug}/` : '#';
  a.dataset.screen = o.id;
  a.textContent = labelOf(o);
  li.appendChild(a);
  navList.appendChild(li);
});

/* ?still skips video entirely. Ten decoders make the page hard to screenshot
   or profile, and layout work rarely needs them running. */
const STILL = new URLSearchParams(location.search).has('still');

/* Slides advance on one shared timer rather than one each. */
const slideshows = [];
setInterval(() => {
  const now = Date.now();
  slideshows.forEach(s => {
    if (now - s.at < s.hold) return;
    s.at = now;
    const imgs = s.wrap.children;
    imgs[s.i].removeAttribute('data-on');
    s.i = (s.i + 1) % imgs.length;
    imgs[s.i].dataset.on = 'true';
  });
}, 400);

function buildMedia(tv) {
  /* A handful of works, held and crossfaded, rather than a video. */
  if (tv.media && tv.media.slides && !STILL) {
    const wrap = document.createElement('div');
    wrap.className = 'flicker slides';
    /* the move has to outlast the hold, or it finishes and sits still while
       the slide is still up */
    if (tv.media.pan) {
      wrap.dataset.pan = 'true';
      wrap.style.setProperty('--pan-time', ((tv.media.hold || 3800) + 1400) + 'ms');
    }
    tv.media.slides.forEach((src, i) => {
      const im = document.createElement('img');
      im.src = src; im.alt = '';
      if (i === 0) im.dataset.on = 'true';
      wrap.appendChild(im);
    });
    /* A single slide has nothing to cross into, so it stays off the timer —
       otherwise the tick would strip and restore data-on and restart its
       drift from the top every few seconds. */
    if (tv.media.slides.length > 1) {
      slideshows.push({ wrap, i: 0, at: Date.now(), hold: tv.media.hold || 3800 });
    }
    return wrap;
  }

  /* A pair of stills cuts back and forth instead of playing. Two stacked
     images with a stepped opacity animation, so the change is a hard cut like
     a channel flipping rather than a crossfade — and no timer to keep. */
  if (Array.isArray(tv.media) && !STILL) {
    const wrap = document.createElement('div');
    wrap.className = 'flicker';
    tv.media.forEach(src => {
      const img = document.createElement('img');
      img.src = src;
      img.alt = '';
      wrap.appendChild(img);
    });
    return wrap;
  }

  if (!tv.media || STILL) {
    const placeholder = document.createElement('div');
    placeholder.className = 'placeholder';
    // channel names belong in the drawer's list, not on the screens. The label
    // shows here only under ?still, purely so sets can be told apart when
    // checking layout with video off.
    if (STILL) placeholder.textContent = labelOf(tv);
    return placeholder;
  }
  const isVideo = /\.(mp4|webm|mov)$/i.test(tv.media);
  const el = document.createElement(isVideo ? 'video' : 'img');
  el.src = tv.media;
  if (isVideo) {
    el.autoplay = el.muted = el.loop = el.playsInline = true;
  } else {
    el.alt = '';
  }
  return el;
}

objects.forEach(tv => {
  const el = document.createElement('button');
  el.className = 'tv';
  el.dataset.screen = tv.id;
  el.dataset.frame = tv.frame ? 'image' : 'none';
  if (tv.channel != null) {
    el.setAttribute('aria-label', labelOf(tv));
  } else {
    el.dataset.scenery = 'true';
    el.tabIndex = -1;
    el.setAttribute('aria-hidden', 'true');
  }

  el.style.zIndex = tv.z;
  place(el, tv);
  el.style.setProperty('--sx', tv.screen.x + '%');
  el.style.setProperty('--sy', tv.screen.y + '%');
  el.style.setProperty('--sw', tv.screen.w + '%');
  el.style.setProperty('--sh', tv.screen.h + '%');
  if (tv.frame) el.style.setProperty('--frame', `url("${tv.frame}")`);

  const body = document.createElement('div');
  body.className = 'tv-body';

  const media = document.createElement('div');
  media.className = 'tv-media';
  media.appendChild(buildMedia(tv));

  /* Scan lines and a corner vignette are what a cathode ray tube does. An LCD
     does neither, so the laptop opts out with `crt: false`. */
  if (tv.crt !== false) {
    const crt = document.createElement('div');
    crt.className = 'tv-crt';
    media.appendChild(crt);
  }

  /* A pointer wandering the screen. Only the laptop has one — a television
     has nothing to point at. Sized against the screen it sits on, so it stays
     the size a pointer would really be on a 13 inch machine. */
  if (tv.cursor && !STILL) {
    const cur = document.createElement('i');
    cur.className = 'cursor';
    media.appendChild(cur);
  }

  const frame = document.createElement('div');
  frame.className = 'tv-frame';

  el.append(body, media, frame);
  wall.appendChild(el);
});

function isPhone() {
  return window.matchMedia('(max-width: 749px)').matches;
}

/* Each object carries a desktop box and a mobile one. Height is always derived
   from the artwork's own aspect, so nothing distorts in either layout. */
function place(el, tv) {
  const box = tv.box;
  el.style.setProperty('--x', box.x + '%');
  el.style.setProperty('--y', box.y + '%');
  el.style.setProperty('--w', box.w + '%');
  el.style.setProperty('--h', (box.w * SCENE_AR / tv.ar) + '%');
  el.style.setProperty('--r', box.rotate + 'deg');
}

function placeAll() {
  wall.querySelectorAll('.tv').forEach(el => {
    const tv = objects.find(o => o.id === el.dataset.screen);
    if (tv) place(el, tv);
  });
}

window.matchMedia('(max-width: 749px)').addEventListener('change', () => {
  placeAll();
  fitScene();
});

/* mobile widths are derived from the measured wall, so a rotate or a resized
   browser has to re-derive them */
new ResizeObserver(() => { if (isPhone()) placeAll(); }).observe(document.body);

/* Started only after objects[] is built and the elements exist — fitScene()
   reaches into both to place the amplifier, and a const cannot be read before
   its declaration. */
new ResizeObserver(fitScene).observe(stage);
fitScene();

function setNav(open) {
  shell.dataset.nav = String(open);
  panel.dataset.open = String(open);
  toggle.setAttribute('aria-expanded', String(open));
}

function expand(id) {
  stage.dataset.expanded = id;
  shell.dataset.open = 'true';

  // each project can hide its own texture behind the drawer
  const o = objects.find(x => x.id === id);
  backdrop.style.backgroundImage = o && o.backdrop ? `url("${o.backdrop}")` : '';
  renderProject(o);

  /* Let the screen play first, then hand over to the writing. */
  clearTimeout(previewTimer);
  delete shell.dataset.reading;
  if (o && o.content) {
    previewTimer = setTimeout(() => { shell.dataset.reading = 'true'; }, PREVIEW_MS);
  }
  if (!isPhone()) setNav(true);
  lockToStage(id);
  wall.querySelectorAll('.tv').forEach(el => {
    el.dataset.state = el.dataset.screen === id ? 'expanded' : '';
  });
  document.querySelectorAll('#nav-list a').forEach(a => {
    a.dataset.active = String(a.dataset.screen === id);
  });
}

/* An opened project fills the stage exactly — which is the whole window on a
   phone, and the space beside the drawer on desktop. The wall it lives in is a
   different size and shape, so the target is measured and expressed in wall
   units; that keeps the growth animating instead of snapping to an overlay.
   Measured against the intended rect rather than the current one, because the
   stage is mid-transition when this runs. */
function lockToStage(id) {
  const el = wall.querySelector(`.tv[data-screen="${id}"]`);
  if (!el) return;
  const w = wall.getBoundingClientRect();
  if (!w.width || !w.height) return;
  const m = shell.getBoundingClientRect();
  const drawer = isPhone() ? 0 : panel.getBoundingClientRect().width;

  el.style.setProperty('--el', (100 * (m.left + drawer - w.left) / w.width) + '%');
  el.style.setProperty('--et', (100 * (m.top - w.top) / w.height) + '%');
  el.style.setProperty('--ew', (100 * (m.width - drawer) / w.width) + '%');
  el.style.setProperty('--eh', (100 * m.height / w.height) + '%');
  /* The stage is a horizontal scroller, and it stays one while a project is
     open — so a sideways flick used to drag the opened screen off the edge of
     the phone and leave the room showing beside it. Freeze it where it stands
     and hold that position, because momentum from the flick that opened the
     project can still be running. */
  if (isPhone()) {
    document.body.dataset.locked = 'true';
    frozenAt = stage.scrollLeft;
    stage.dataset.frozen = 'true';
    stage.scrollLeft = frozenAt;
  }
}

function collapse() {
  clearTimeout(previewTimer);
  delete shell.dataset.reading;
  delete document.body.dataset.locked;
  delete stage.dataset.frozen;
  project.hidden = true;
  project.replaceChildren();
  stage.dataset.expanded = '';
  delete shell.dataset.open;
  wall.querySelectorAll('.tv').forEach(el => { el.dataset.state = ''; });
  document.querySelectorAll('#nav-list a').forEach(a => { a.dataset.active = 'false'; });
}

/* ---- addresses ---------------------------------------------------------
   Every project has a real URL. A channel with a `slug` lives at /<slug>/,
   which is a directory holding its own small index.html — written by
   tools/build-pages.py — so a deep link is served by the host without any
   rewrite rule, and arrives with its own title and canonical already in the
   markup. Opening and closing a channel then only has to keep the address bar
   honest; the page never reloads. */

const pathOf = o => (o && o.slug) ? `/${o.slug}/` : '/';

function slugFromPath() {
  const seg = location.pathname.replace(/^\/+|\/+$/g, '');
  return seg || null;
}

/* Title and canonical are part of the address, so they move with it rather
   than being left describing whichever page was loaded first. */
function setHead(o) {
  document.title = o && o.project
    ? `${o.project} — PETERVILLE USA`
    : 'PETERVILLE USA';
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = location.origin + pathOf(o);
}

/* `push` is false when the URL already says what we are about to do — on
   first load, and when the back button is what asked for the change. */
function go(id, push = true) {
  const o = objects.find(x => x.id === id);
  if (!o) return;
  if (push && location.pathname !== pathOf(o)) {
    history.pushState({ id }, '', pathOf(o));
  }
  setHead(o);
  expand(id);
}

function goHome(push = true) {
  if (push && location.pathname !== '/') history.pushState({ id: null }, '', '/');
  setHead(null);
  collapse();
}

window.addEventListener('popstate', () => {
  const slug = slugFromPath();
  const o = slug && objects.find(x => x.slug === slug);
  if (o) { setHead(o); expand(o.id); } else { setHead(null); collapse(); }
});

setNav(false);

toggle.addEventListener('click', () => setNav(panel.dataset.open !== 'true'));
close.addEventListener('click', () => goHome());

wall.addEventListener('click', e => {
  const el = e.target.closest('.tv');
  if (!el || el.dataset.state) return;
  const o = objects.find(x => x.id === el.dataset.screen);
  if (o && o.channel != null) go(o.id);
});

document.querySelectorAll('#nav-list a').forEach(a => {
  a.addEventListener('click', e => {
    /* Only take over a plain left click. Cmd-click, middle click and "open in
       new tab" have to keep working, which is the point of a real href. */
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    go(a.dataset.screen);
    if (isPhone()) setNav(false);
  });
});

/* Open whatever the address asks for, without pushing a second entry for it. */
(() => {
  const slug = slugFromPath();
  const o = slug && objects.find(x => x.slug === slug);
  if (o) go(o.id, false); else setHead(null);
})();

document.addEventListener('keydown', e => {
  const lb = document.getElementById('lightbox');
  if (lb && lb.dataset.step === 'true' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    lb._step(lb._i + (e.key === 'ArrowLeft' ? -1 : 1));
    return;
  }
  if (e.key !== 'Escape') return;
  const box = document.getElementById('lightbox');
  if (box) { box.remove(); return; }
  stage.dataset.expanded ? goHome() : setNav(false);
});
