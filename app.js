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

/* Twelve televisions and an amplifier, piled the way Paik piled them: the big
   sets on the ground, smaller portables riding on top. `z` is the stacking
   order, so upper sets overlap the ones they rest on. Sizes follow the actual
   models, so the Coby and RCA portables read small next to the Apex console. */
/* The Every Body zine is a Pleeay record AND a piece of print, so it appears on
   both channels. Declared once and referenced twice, because two copies of the
   same block drift the moment either is edited. */
/* The zine itself, turned a spread at a time. This replaced a carousel of
   photographs of the object, which showed that a zine existed without ever
   letting you read a page of it. Those photographs follow it, because the
   copy talks about the thing being made by hand and that is what they show. */
const EVERY_BODY_ZINE = {
  type: 'book',
  heading: '"Every Body" zine',
  kicker: '2022',
  body: [
    "A zine with the lyrics to every song on Pleeay's debut album, Every Body, along with photographs of the band.",
    "Each one was made by hand, so they're all a little different.",
  ],
  spreads: [
    { src: 'media/zine-spreads/every-body/01.webp', title: 'Consequence' },
    { src: 'media/zine-spreads/every-body/02.webp', title: 'Culture' },
    { src: 'media/zine-spreads/every-body/03.webp', title: 'Crawl' },
    { src: 'media/zine-spreads/every-body/04.webp', title: 'Curious' },
    { src: 'media/zine-spreads/every-body/05.webp', title: 'Clear' },
    { src: 'media/zine-spreads/every-body/06.webp', title: 'Compassion' },
    { src: 'media/zine-spreads/every-body/07.webp', title: 'Cure' },
    { src: 'media/zine-spreads/every-body/08.webp', title: 'Quiet' },
  ],
  /* links: [{ label: 'Get one', href: 'https://pleeay.bandcamp.com/merch/every-body-zine' }], */
};

/* The object, after the reading of it. */
const EVERY_BODY_ZINE_OBJECT = {
  type: 'grid', columns: 6, ratio: '1', even: true, lightbox: true, items: [
    { src: 'media/zine/04.webp', alt: 'Every Body zine, open spread' },
    { src: 'media/zine/01.webp', alt: 'Every Body zine, cover' },
    { src: 'media/zine/02.webp', alt: 'Every Body zine, inside pages' },
    { src: 'media/zine/03.webp', alt: 'Every Body zine, stack' },
    { src: 'media/zine/05.webp', alt: 'Every Body zine, spread and stack' },
    { src: 'media/zine/06.webp', alt: 'Every Body zine, inside pages' },
  ],
};

/* The two cassettes, declared once and shown twice for the same reason the
   zine is: a tape is a Pleeay record AND a physical object somebody had to
   design, so it belongs on both channels. The artwork comes first and the
   photographs after it, because the drawing is the work and the object is
   what happened to it. */
const WH_TAPE_SHOTS = [
    { src: 'media/cassettes/wh-01-artwork-front.webp',
      alt: 'Wealth + Hellness J-card, outside: the band against flames, track titles down the left' },
    { src: 'media/cassettes/wh-02-artwork-inside.webp',
      alt: 'Wealth + Hellness J-card, inside: track list and credits over flames' },
    { src: 'media/cassettes/wh-03-front.webp', alt: 'The cassette, front' },
    { src: 'media/cassettes/wh-04-spine.webp', alt: 'The cassette, showing the orange track list panel' },
    { src: 'media/cassettes/wh-05-angle.webp', alt: 'The cassette, angled' },
];

const EB_TAPE_SHOTS = [
    { src: 'media/cassettes/eb-01-artwork-front.webp',
      alt: 'Every Body J-card, outside: the album photograph, title and track list' },
    { src: 'media/cassettes/eb-02-artwork-inside.webp',
      alt: 'Every Body J-card, inside: sides A and B, credits, and a line of text down the fold' },
    { src: 'media/cassettes/eb-03-front-back.webp', alt: 'The cassette and its blue shell' },
    { src: 'media/cassettes/eb-04-three-up.webp', alt: 'Spine, case and shell together' },
];

/* The same two tapes for the Physical media page, side by side and unexplained.
   On Pleeay they are releases and get a paragraph each; here they are a pair of
   objects and the pictures do the talking. */
const CASSETTE_PAIR = {
  type: 'pair', heading: 'Cassette design', items: [
    { title: 'Wealth + Hellness', items: WH_TAPE_SHOTS },
    { title: '"Every Body"', items: EB_TAPE_SHOTS },
  ],
};

/* Same again for the records. They are the reason the amplifier is a channel
   at all, so Music gathers every one of them and the band channels show their
   own. Declared once here: the art and the spelling cannot then drift between
   the two places that print them.

   Only records that exist are listed. A cover that has not been made yet and a
   record that has not come out yet are both promises, and a page full of
   promises reads as a page with nothing on it. */
const RECORDS = {
  wealthHellness1: {
    art: 'media/releases/pleeay-wealth-hellness-vol-1.webp',
    alt: 'Wealth + Hellness Vol. 1 cover: the band in black against flames',
    artist: 'Pleeay', record: 'Wealth + Hellness Vol. 1', year: 2025,
    /* The rest of the Pleeay work is on the Pleeay channel. Music says what
       was played, not everything that was done. */
    role: 'I play bass',
    tracks: [
      { n: 1, title: 'No', dur: 187, src: 'media/audio/wealth-hellness-1/01.mp3' },
      { n: 2, title: 'Babies in the Lost & Found', dur: 281, src: 'media/audio/wealth-hellness-1/02.mp3' },
      { n: 3, title: 'Grief', dur: 200, src: 'media/audio/wealth-hellness-1/03.mp3' },
      { n: 4, title: 'Dazzling Confusion', dur: 239, src: 'media/audio/wealth-hellness-1/04.mp3' },
      { n: 5, title: 'Quiet', dur: 248, src: 'media/audio/wealth-hellness-1/05.mp3' },
    ],
  },
  pleeayLive: {
    art: 'media/releases/pleeay-live-at-the-eagle.webp',
    alt: 'Live at the Eagle cover: the band mid-set, the name in pink and blue over it',
    artist: 'Pleeay', record: 'Live at the Eagle', year: 2023,
    role: 'I play bass',
    tracks: [
      { n: 1, title: 'Crave', dur: 153, src: 'media/audio/pleeay-live-at-the-eagle/01.m4a' },
      { n: 2, title: 'Culture', dur: 199, src: 'media/audio/pleeay-live-at-the-eagle/02.m4a' },
      { n: 3, title: 'Crawl', dur: 235, src: 'media/audio/pleeay-live-at-the-eagle/03.m4a' },
      { n: 4, title: 'Curious', dur: 253, src: 'media/audio/pleeay-live-at-the-eagle/04.m4a' },
      { n: 5, title: 'Call', dur: 265, src: 'media/audio/pleeay-live-at-the-eagle/05.m4a' },
      { n: 6, title: 'Boots', dur: 192, src: 'media/audio/pleeay-live-at-the-eagle/06.m4a' },
      { n: 7, title: 'Consequence', dur: 179, src: 'media/audio/pleeay-live-at-the-eagle/07.m4a' },
      { n: 8, title: 'Cure', dur: 156, src: 'media/audio/pleeay-live-at-the-eagle/08.m4a' },
      { n: 9, title: 'Quiet', dur: 280, src: 'media/audio/pleeay-live-at-the-eagle/09.m4a' },
    ],
  },
  lostEyesEp: {
    art: 'media/releases/the-lost-eyes-ep.webp',
    alt: 'The Lost Eyes EP cover: warped black lettering on lilac',
    artist: 'The Lost Eyes', record: 'EP', year: 2018,
    role: 'I play drums and sing backing vocals',
    tracks: [
      { n: 1, title: 'Taco Beach / I Like It Weird', dur: 199, src: 'media/audio/the-lost-eyes-ep/01.m4a' },
      { n: 2, title: 'Just Another', dur: 132, src: 'media/audio/the-lost-eyes-ep/02.mp3' },
      { n: 3, title: 'Never Seen', dur: 187, src: 'media/audio/the-lost-eyes-ep/03.mp3' },
      { n: 4, title: 'You Take Me', dur: 184, src: 'media/audio/the-lost-eyes-ep/04.m4a' },
      { n: 5, title: 'Invisable Man', dur: 264, src: 'media/audio/the-lost-eyes-ep/05.mp3' },
      { n: 6, title: 'Tigers', dur: 177, src: 'media/audio/the-lost-eyes-ep/06.m4a' },
      { n: 7, title: 'Hot Rod Joe', dur: 164, src: 'media/audio/the-lost-eyes-ep/07.mp3' },
      { n: 8, title: 'She Belongs to Me', dur: 173, src: 'media/audio/the-lost-eyes-ep/08.mp3' },
    ],
  },
  goldenTriangleTapes: {
    art: 'media/releases/nightswim-golden-triangle-tapes.webp',
    alt: 'The Golden Triangle Tapes cover: cut black lettering on kraft brown',
    artist: 'Nightswim', record: 'The Golden Triangle Tapes', year: 2021,
    role: 'I wrote, performed and recorded every instrument',
    tracks: [
      { n: 1, title: 'We Are Connected', dur: 344, src: 'media/audio/golden-triangle-tapes/01.m4a' },
      { n: 2, title: 'Awake Snake', dur: 102, src: 'media/audio/golden-triangle-tapes/02.m4a' },
      { n: 3, title: 'Prints in Paris', dur: 149, src: 'media/audio/golden-triangle-tapes/03.m4a' },
      { n: 4, title: 'World Sonic', dur: 146, src: 'media/audio/golden-triangle-tapes/04.m4a' },
      { n: 5, title: 'Anymore', dur: 149, src: 'media/audio/golden-triangle-tapes/05.m4a' },
      { n: 6, title: 'Sat Song', dur: 193, src: 'media/audio/golden-triangle-tapes/06.m4a' },
      { n: 7, title: 'Fishdicks', dur: 126, src: 'media/audio/golden-triangle-tapes/07.m4a' },
      { n: 8, title: 'LoFi Jam 1', dur: 245, src: 'media/audio/golden-triangle-tapes/08.m4a' },
      { n: 9, title: 'Post Its', dur: 153, src: 'media/audio/golden-triangle-tapes/09.mp3' },
      { n: 10, title: 'Morning Time', dur: 94, src: 'media/audio/golden-triangle-tapes/10.m4a' },
      { n: 11, title: 'Fly', dur: 292, src: 'media/audio/golden-triangle-tapes/11.m4a' },
    ],
  },
  sunbreak2: {
    art: 'media/releases/sunbreak-2.webp',
    alt: 'Sunbreak 2 cover: a sea stack in surf, black and white',
    artist: 'Sunbreak', record: 'Sunbreak 2', year: 2024,
    role: 'I play drums and bass, and sing backing vocals',
    tracks: [
      { n: 1, title: 'DOITGOOD', dur: 172, src: 'media/audio/sunbreak-2/01.m4a' },
      { n: 2, title: 'OLDDAZE', dur: 257, src: 'media/audio/sunbreak-2/02.m4a' },
      { n: 3, title: 'WORKIN2HARD', dur: 252, src: 'media/audio/sunbreak-2/03.m4a' },
      { n: 4, title: 'HARD', dur: 175, src: 'media/audio/sunbreak-2/04.m4a' },
    ],
  },
};

const album = r => ({
  type: 'album', art: r.art, alt: r.alt, year: r.year,
  artist: r.artist, record: r.record, role: r.role, tracks: r.tracks,
});

/* On the band's own channel the band name is already the page. Leading every
   record with it puts two headings saying Pleeay one above the other, which is
   not a hierarchy — so the record takes the heading, and the part that was
   only ever there to tell four bands apart goes. */
const ownAlbum = r => ({ ...album(r), artist: r.record, record: '', role: '' });

/* Music holds every record, each as its own block: the cover, what it is, and
   the record itself to play. Newest first, and the order is WRITTEN OUT rather
   than sorted or left to declaration order: five records is a list you can
   read, and the next one added should have to say where it goes. */
const ALL_ALBUMS = [
  RECORDS.wealthHellness1,      // 2025
  RECORDS.sunbreak2,            // 2024
  RECORDS.pleeayLive,           // 2023
  RECORDS.goldenTriangleTapes,  // 2021
  RECORDS.lostEyesEp,           // 2018
].map(album);

/* Pleeay's own two, on Pleeay's own channel. */
const PLEEAY_ALBUMS = [RECORDS.wealthHellness1, RECORDS.pleeayLive].map(ownAlbum);

const PYRAMID_TRACK = {
  type: 'audio', tracks: [
    { title: 'Pyramid scheme', src: 'media/audio/pyramid-scheme.mp3' },
  ],
};

/* Every mark, declared once. Two grids show these: the Logos channel, which
   holds more than one band's work and so names the band in front of the
   design, and Pleeay's own page, which names only the design because the band
   is already the page. They were written out twice before this, which is how
   the ballet buttons came to be on one grid and missing from the other. */
const MARKS = {
  people:  { src: 'media/logos/people.webp', alt: 'Pleeay people logo',
             title: 'People',  credit: 'Pleeay people' },
  neon:    { src: 'media/logos/neon.webp',   alt: 'Pleeay neon logo',
             title: 'Neon',    credit: 'Pleeay neon' },
  slayer:  { src: 'media/logos/slayer.webp', alt: 'Pleeay slayer logo',
             title: 'Slayer',  credit: 'Pleeay slayer' },
  /* Each pair is one design and its inverse, so the second is what the first
     looks like turned over. White face first, black on hover. */
  boop:    { flip: ['media/stickers/light.webp', 'media/stickers/dark.webp'],
             alt: 'Pleeay sticker', title: 'Boop',    credit: 'Pleeay boop' },
  buttons: { flip: ['media/buttons/line.webp', 'media/buttons/disc.webp'],
             alt: 'Pleeay button',  title: 'Buttons', credit: 'Pleeay buttons' },
  bird:    { flip: ['media/bird-light.webp', 'media/bird-dark.webp'],
             alt: 'JT Bird logo',   title: 'Bird',    credit: 'JT Bird logo' },
};

const mark = (m, credited) => ({
  ...(m.src ? { src: m.src } : { flip: m.flip }),
  alt: m.alt,
  title: credited ? m.credit : m.title,
});

/* `people` is not in this one. It is drawn along a line rather than inside a
   square, and it gets the foot of the page to itself instead. */
const PLEEAY_MARKS = ['neon', 'slayer', 'boop', 'buttons']
  .map(k => mark(MARKS[k]));
const ALL_MARKS = ['people', 'neon', 'slayer', 'boop', 'buttons', 'bird']
  .map(k => mark(MARKS[k], true));

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
          'Pleeay is a San Francisco new wave band. Castle sings and dances, Huli plays drums and synth, and I play bass.',
          "We play all original music and produce our own records, with help from our friends at Women's Audio Mission. We have played the Pride main stage in San Francisco, and opened for Pussy Riot and ESG.",
          'I help write the songs and handle the design for the band. The website, the zines, the cassette art, the merch, all of it.',
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

        ...PLEEAY_ALBUMS,

        /* The tapes and the zine sit with the records rather than with the
           merch table: each is one of the records made into an object, and the
           merch table is a table. */
        CASSETTE_PAIR,
        EVERY_BODY_ZINE,
        EVERY_BODY_ZINE_OBJECT,

        { type: 'grid', heading: 'Set lists and merch table', columns: 5,
          ratio: '1082 / 1400', lightbox: true, items: [
          { src: 'media/setlists/00.webp', title: 'Bandshell',   alt: 'Set list, Bandshell' },
          { src: 'media/setlists/01.webp', title: 'KO',          alt: 'Set list, KO' },
          { src: 'media/setlists/02.webp', title: 'KO, second',  alt: 'Set list, KO' },
          { src: 'media/setlists/03.webp', title: 'Price list',  alt: 'Merch table price list' },
          { src: 'media/setlists/04.webp', title: 'Email list',  alt: 'Merch table email sign up' },
        ]},

        /* Marks only, so the colour in them is the point of looking. Grey
           until you do. */
        { type: 'grid', heading: 'Marks', columns: 4, ratio: '1', fit: 'contain',
          body: ['Designs and concepts for merch, stickers, and buttons.'],
          mono: true, lightbox: true, items: PLEEAY_MARKS },

        { type: 'links', heading: 'Elsewhere', items: [
          { label: 'pleeay.com', href: 'https://www.pleeay.com/' },
          { label: 'instagram', href: 'https://www.instagram.com/pleeaymusic/' },
        ]},

        /* Full width, and last. A mark drawn along a line has nothing to fill a
           square with, and at the foot of the page it reads as a sign off. */
        { type: 'grid', columns: 1, lightbox: true,
          items: [{ src: MARKS.people.src, alt: MARKS.people.alt }] },
      ],
    },
    frame: 'media/tv-01.webp', backdrop: 'media/backdrop/pleeay.webp',
    media: 'media/tv-01-screen.mp4' },

  { id: 'tv2',  slug: 'channel-11', channel: 11, project: null,  z: 8,
    box:    { x: 42.0, y: 73.32, w: 8.5, rotate: 1.4 },
    ar: 3725 / 3429,
    screen: { x: 15.1, y: 24.3, w: 69.8, h: 53.9 },
    frame: 'media/tv-02.webp', media: STATIC },

  /* No project yet, and that is the point: a channel with nothing on it is
     still a channel. It has an address and a page like the rest, so a middle
     click or an open-in-new-tab behaves, and clicking it gives you a set
     playing static and nothing to read. */
  { id: 'tv3',  slug: 'channel-3', channel: 3, project: null,  z: 7,
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
          'Paintings and wall sculptures made from concrete, canvas, foam, enamel, and wood.',
          'A lot of these are built rather than painted, and the edges are part of the work.',
        ]},

        { type: 'grid', heading: 'Current work', columns: 3, lightbox: true,
          body: ['Installation views and recent paintings and sculptures.'], items: [
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

        { type: 'grid', heading: 'Tablets, 2018', columns: 3, lightbox: true,
          body: ['A group of paintings and sculptures made in 2018.'], items: [
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

        { type: 'grid', heading: 'Interiors, 2017', columns: 4, lightbox: true,
          body: ['A group of paintings and sculptures made in 2017.'], items: [
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

        { type: 'grid', heading: 'Jumper, 2015', columns: 3, lightbox: true,
          body: ['A work from 2015.'], items: [
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

  { id: 'tv5',  slug: 'physical', channel: 5, project: 'Physical media',  z: 3,
    box:    { x: 46.6, y: 52.97, w: 10.4, rotate: 0.9 },
    ar: 5688 / 5044,
    screen: { x: 8.6,  y: 10.6, w: 82.9, h: 70.6 },
    frame: 'media/tv-05.webp',
    backdrop: 'media/backdrop/print.webp',
    content: {
      title: 'Physical media',
      blocks: [
        { type: 'text', heading: 'Things you can hold, play, or wear',
          body: [
            "A collection of zines, merch designs, stickers, and other physical pieces. It's always nice to see the work out in the world.",
          ]},

        { type: 'book',
          heading: '"Becoming" zine',
          kicker: 'Single fold, edition of 20',
          body: [
            'A single fold zine combining vector shapes, text, and photographs of paintings in progress.',
            'Edition of 20.',
          ],
          spreads: [
            { src: 'media/zine-spreads/becoming/01.webp' },
            { src: 'media/zine-spreads/becoming/02.webp' },
            { src: 'media/zine-spreads/becoming/03.webp' },
            { src: 'media/zine-spreads/becoming/04.webp' },
          ],
          /* No buying anywhere on the site for now — it is a place to look at
             the work, not a shop. The mailto is kept here, commented, because
             it is the one that will come back first.
             links: [{ label: 'Ask about one',
               href: 'mailto:peterwarren13@gmail.com?subject=Becoming%20zine%20purchase%20inquiry' }], */
        },

        { type: 'grid', columns: 6, ratio: '1', even: true, lightbox: true, items: [
          { src: 'media/print/becoming/00.webp', alt: 'Becoming zine, stack of covers' },
          { src: 'media/print/becoming/01.webp', alt: 'Becoming zine, back cover text' },
          { src: 'media/print/becoming/02.webp', alt: 'Becoming zine, open spread' },
        ]},

        EVERY_BODY_ZINE,
        EVERY_BODY_ZINE_OBJECT,
        CASSETTE_PAIR,
      ],
    },
    media: { slides: ['media/print/screen.webp'], hold: 11000, pan: true } },

  { id: 'tv6',  slug: 'channel-6', channel: 6, project: null,  z: 2,
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
        /* No heading: the page is called Pyramid scheme and the first line
           names the show again a word later. */
        { type: 'text', body: [
          'A track made for Pyramid Scheme, a group show at Bass & Reiner, an art gallery in San Francisco.',
          'The art show was built around the idea of artists inviting other artists to participate until the room was full.',
          'I made this track for it, tongue in cheekily, including the lyrics "use the art to wash the money."',
        ]},
        PYRAMID_TRACK,
        /* `dance` sets it moving while the track runs. The pyramids are the
           only picture on the page, so the page itself is what reacts. */
        { type: 'grid', columns: 1, ratio: '1200 / 476', fit: 'contain',
          dance: true, lightbox: true, items: [
          { src: 'media/pyramids.webp', alt: 'Pyramids' },
        ]},
      ],
    },
    backdrop: 'media/backdrop/pyramid-scheme.webp',
    media: 'media/spiral.mp4' },

  { id: 'tv8',  slug: 'channel-7', channel: 7, project: null,  z: 6,
    box:    { x: 62.8, y: 68.25, w: 10.7, rotate: 0.6 },
    ar: 2368 / 2019,
    screen: { x: 6.8,  y: 7.5,  w: 87.0, h: 75.5 },
    frame: 'media/tv-08.webp', media: STATIC },

  { id: 'yorxC',  slug: 'channel-12', channel: 12, project: null,  z: 4,
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
          'Logos, stickers, and marks made for bands and their merch.',
          'Most start as something drawn by hand and eventually end up on something.',
        ]},

        /* no heading: the text block above it is already called Marks */
        { type: 'grid', columns: 3, ratio: '1', fit: 'contain',
          mono: true, lightbox: true, items: ALL_MARKS },
      ],
    },
    frame: 'media/tv-10.webp', backdrop: 'media/backdrop/logos.webp',
    media: ['media/bird-dark.webp', 'media/bird-light.webp'] },

  { id: 'tv11', slug: 'channel-13', channel: 13, project: null,  z: 1,
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
        /* No heading: the page is called Music, and a second title under it
           was saying the same thing twice. */
        { type: 'text', body: [
          "A collection of solo records and collaborations I've made with different bands.",
        ]},

        ...ALL_ALBUMS,
      ],
    },
    frame: 'media/amp-01.webp', backdrop: 'media/backdrop/music.webp',
    media: 'media/amp-screen.mp4' },

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
          "Websites I've designed and developed as a front end developer, in agency work and freelance.",
        ]},

        { type: 'links', heading: 'Live', items: [
          { label: 'thegreenroompr.com', href: 'https://www.thegreenroompr.com/' },
          { label: 'sparkart.com', href: 'https://www.sparkart.com/' },
          { label: 'thelordsofprint.com', href: 'https://thelordsofprint.com/' },
          { label: 'store.backstreetboys.com', href: 'https://store.backstreetboys.com/' },
          { label: 'store.ozzy.com', href: 'https://store.ozzy.com/' },
          { label: 'behemothofficial.store', href: 'https://behemothofficial.store/' },
          { label: 'pleeay.com', href: 'https://www.pleeay.com/' },
        ]},
      ],
    },
    frame: 'media/laptop.webp',
    backdrop: 'media/backdrop/development.webp',
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

/* "Coming soon" and "Listen" have nothing to point at yet, and were written
   as href="#". That is not a link: underlined, it invites a click, and with a
   target it opened a second tab of this same page. A label with no destination
   is rendered as a label. */
function linkNode(l) {
  if (!l.href || l.href === '#') return el('span', 'link-pending', l.label);
  const a = el('a', null, l.label);
  a.href = l.href;
  setLinkTarget(a, l.href);
  return a;
}

/* Marks a picture as arrived, which is what releases the placeholder square
   the stylesheet holds open for it. */
function markWhenLoaded(img) {
  if (img.complete && img.naturalWidth) { img.dataset.loaded = 'true'; return; }
  img.addEventListener('load', () => { img.dataset.loaded = 'true'; }, { once: true });
}

/* How many pictures a project may fetch straight away. Everything used to be
   `loading="lazy"`, INCLUDING the first thing on the page, and lazy is a
   deliberate delay: the browser lays the page out, works out what is near the
   view, and only then goes and asks. On the first screenful that is a wait for
   nothing, and on a project like Fine art it happens while sixty other
   pictures are queued behind it. The ones you are about to look at are asked
   for immediately; the rest keep waiting until you scroll to them. */
const EAGER = 6;
let eager = 0;

function hintLoading(img) {
  /* Decoding off the main thread either way, so a large photograph arriving
     cannot stall the writing that is fading in beside it. */
  img.decoding = 'async';
  if (eager < EAGER) {
    eager += 1;
    img.loading = 'eager';
    img.fetchPriority = eager <= 2 ? 'high' : 'auto';
  } else {
    img.loading = 'lazy';
  }
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

/* One flag on the open project saying whether anything is making noise, so a
   block can answer to it without knowing which player started. */
function reflectPlaying() {
  if (players.some(p => !p.paused)) project.dataset.playing = 'true';
  else delete project.dataset.playing;
}

/* A record, rather than a track. One `audio` element for the whole album and
   one index into the list, so each album keeps its OWN place: start Sunbreak,
   go and start the Lost Eyes, come back, and Sunbreak is still where it was.
   A player per track would mean forty elements on this page, forty requests
   for metadata, and no idea which record you were listening to. */
function buildAlbum(b) {
  const tracks = b.tracks || [];
  const wrap = el('section', 'block-album');

  /* A record whose sleeve has not been filed yet says so. An empty src
     resolves to the page itself, which is a wasted request and a broken icon. */
  let cover;
  if (b.art) {
    cover = el('img', 'album-cover');
    cover.alt = b.alt || '';
    hintLoading(cover);
    markWhenLoaded(cover);
    cover.src = b.art;
  } else {
    cover = el('div', 'album-cover slot', 'cover to come');
  }

  const side = el('div', 'album-side');
  if (b.artist) side.appendChild(el('h2', null, b.artist));
  if (b.record) side.appendChild(el('p', 'album-record',
      b.record + (b.year ? ', ' + b.year : '')));
  if (b.role) side.appendChild(el('p', 'album-role', b.role));

  const audio = el('audio');
  audio.preload = 'none';    // a record is 20 minutes; nothing loads unasked
  let at = -1;               // which track is loaded, -1 before anything is

  const play = el('button', 'mark track-play');
  play.dataset.kind = 'play';
  play.append(el('span', 'bar bar-h'), el('span', 'bar bar-v'));

  const line = el('div', 'track-line');
  const fill = el('i', 'track-fill');
  line.appendChild(fill);
  line.setAttribute('role', 'slider');
  line.tabIndex = 0;

  const time = el('span', 'track-time', '0:00');
  const transport = el('div', 'track album-transport');
  transport.append(play, line, time, audio);

  const list = el('ol', 'album-list');
  const rows = tracks.map((t, i) => {
    const li = el('li', 'album-track');
    const btn = el('button', 'album-pick');
    /* The number is what the row is; the icon is what the row will do. They
       share one cell and cross over on hover, so the list reads as a list
       until you go near it. Play and pause are drawn, not typed: a glyph would
       be the only character on the site not set in the page's own face. */
    const cue = el('span', 'album-cue');
    cue.appendChild(el('span', 'album-n', String(t.n ?? i + 1)));
    cue.appendChild(el('i', 'album-icon'));
    btn.appendChild(cue);
    btn.appendChild(el('span', 'album-t', t.title));
    btn.appendChild(el('span', 'album-d', t.dur ? clock(t.dur) : ''));
    btn.addEventListener('click', () => {
      if (i === at) { audio.paused ? audio.play() : audio.pause(); return; }
      load(i, true);
    });
    li.appendChild(btn);
    list.appendChild(li);
    return li;
  });

  const mark = () => {
    rows.forEach((li, i) => {
      const here = i === at && !audio.paused;
      li.dataset.on = String(i === at);
      li.dataset.playing = String(here);
      /* The row says what pressing it would DO, not what it is doing, so the
         one that is running reads "pause" and every other one reads "play". */
      li.querySelector('.album-pick').dataset.cursor = here ? 'pause' : 'play';
    });
    const on = !audio.paused;
    play.dataset.playing = String(on);
    play.dataset.cursor = on ? 'pause' : 'play';
    reflectPlaying();
    const t = tracks[Math.max(0, at)];
    play.setAttribute('aria-label', (on ? 'Pause ' : 'Play ') + (t ? t.title : ''));
    if (t) line.setAttribute('aria-label', t.title + ' position');
  };

  const paint = () => {
    const d = audio.duration;
    fill.style.width = ((d ? audio.currentTime / d : 0) * 100) + '%';
    time.textContent = clock(audio.currentTime) + (isFinite(d) ? ' / ' + clock(d) : '');
    line.setAttribute('aria-valuetext', time.textContent);
  };

  function load(i, andPlay) {
    if (!tracks[i]) return;
    at = i;
    audio.src = tracks[i].src;
    fill.style.width = '0%';
    mark();
    if (andPlay) {
      players.forEach(p => { if (p !== audio) p.pause(); });
      audio.play();
    }
  }

  play.addEventListener('click', () => {
    if (at < 0) return load(0, true);           // nothing chosen yet: side one
    if (audio.paused) {
      players.forEach(p => { if (p !== audio) p.pause(); });
      audio.play();
    } else {
      audio.pause();
    }
  });

  audio.addEventListener('play', mark);
  audio.addEventListener('pause', mark);
  audio.addEventListener('timeupdate', paint);
  audio.addEventListener('loadedmetadata', paint);
  audio.addEventListener('durationchange', paint);
  /* A record plays on to the next side. The last track stops rather than
     looping back, because a record ending is a thing that should be audible. */
  audio.addEventListener('ended', () => {
    if (at + 1 < tracks.length) load(at + 1, true);
    else { audio.currentTime = 0; mark(); paint(); }
  });

  const seekTo = e => {
    const box = line.getBoundingClientRect();
    if (!box.width || !isFinite(audio.duration)) return;
    const p = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width));
    audio.currentTime = p * audio.duration;
    paint();
  };
  line.addEventListener('pointerdown', e => {
    if (at < 0) return;
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
  mark();
  side.append(transport, list);
  wrap.append(cover, side);
  return wrap;
}

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
    play.dataset.cursor = on ? 'pause' : 'play';
    reflectPlaying();
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

/* One carousel: a picture that fills the column and a strip of thumbs under
   it. Lifted out of the feature block so a pair of them can stand side by
   side, since a cassette is small and two of them fit where one photograph of
   a zine needs the whole width. */
function buildCarousel(items, heading, body, links) {
  const media = el('div', 'carousel');
  const stageImg = el('img', 'carousel-main');
  stageImg.src = items[0].src;
  stageImg.alt = items[0].alt || heading || '';

  let current = 0;
  const base = gallery.length;
  const g = ++group;
  items.forEach(item => gallery.push({
    group: g,
    src: item.src,
    alt: item.alt || '',
    heading: heading || '',
    body: body || [],
    links: links || [],
  }));
  stageImg.dataset.cursor = 'look';
  stageImg.addEventListener('click', () => openLightbox(base + current));

  const thumbs = el('div', 'carousel-thumbs');
  items.forEach((item, i) => {
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

  /* The strip wraps the thumbs so the arrows have something to sit against.
     They appear only when there is more than fits, and a ResizeObserver is
     what answers that: the row is four of whatever the column happens to be
     wide, so the answer changes when the window does. */
  const strip = el('div', 'carousel-strip');
  const back = makeMark('prev');
  const fwd = makeMark('next');
  [back, fwd].forEach(m => m.classList.add('strip-step'));
  back.setAttribute('aria-label', 'Earlier pictures');
  fwd.setAttribute('aria-label', 'Later pictures');
  strip.append(thumbs, back, fwd);

  const sync = () => {
    const room = thumbs.scrollWidth - thumbs.clientWidth;
    strip.dataset.more = String(room > 1);
    back.disabled = thumbs.scrollLeft <= 1;
    fwd.disabled = thumbs.scrollLeft >= room - 1;
  };
  const step = () => (thumbs.clientWidth + 8) / 4;
  back.addEventListener('click', () => thumbs.scrollBy({ left: -step(), behavior: 'smooth' }));
  fwd.addEventListener('click', () => thumbs.scrollBy({ left: step(), behavior: 'smooth' }));
  thumbs.addEventListener('scroll', sync, { passive: true });
  if (window.ResizeObserver) new ResizeObserver(sync).observe(thumbs);
  requestAnimationFrame(sync);

  media.append(stageImg, strip);
  return media;
}

/* A zine, read as a book rather than shown as a slideshow.

   Each file is a whole SPREAD, two pages with the fold down its middle, so a
   page is half an image: the background is scaled to twice the width of its
   box and slid to one end or the other.

   That is what makes the turn work. A leaf of a real book carries a different
   page on each side, the right half of the spread you are leaving on its front
   and the left half of the one you are arriving at on its back. Cross-fading
   two whole spreads would be the carousel again with a fold painted on. */
function buildBook(b) {
  const spreads = b.spreads || [];
  const wrap = el('section', 'block-book');
  if (b.heading) wrap.appendChild(el('h2', null, b.heading));
  if (b.kicker) wrap.appendChild(el('p', 'kicker', b.kicker));
  (b.body || []).forEach(t => wrap.appendChild(el('p', 'block-intro', t)));
  if (!spreads.length) return wrap;

  const book = el('div', 'book');
  const left = el('div', 'book-page book-left');
  const right = el('div', 'book-page book-right');
  book.append(left, right, el('div', 'book-gutter'));

  const bar = el('div', 'book-bar');
  const prev = makeMark('prev');
  const next = makeMark('next');
  [prev, next].forEach(m => m.classList.add('book-step'));
  prev.setAttribute('aria-label', 'Previous spread');
  next.setAttribute('aria-label', 'Next spread');
  const count = el('span', 'book-count');
  bar.append(prev, count, next);
  wrap.append(book, bar);

  let at = 0;
  let turning = false;
  const url = i => `url("${spreads[i].src}")`;

  /* Only the spread you are on and the ones either side are ever fetched.
     Eight of these arriving at once is tens of megabytes of decoded bitmap,
     which is exactly what makes a long page stutter. */
  const warm = i => [i - 1, i, i + 1].forEach(n => {
    if (n < 0 || n >= spreads.length) return;
    const img = new Image();
    img.src = spreads[n].src;
  });

  const settle = () => {
    left.style.backgroundImage = url(at);
    right.style.backgroundImage = url(at);
    const name = spreads[at].title ? `  ${spreads[at].title}` : '';
    count.textContent = `${at + 1} / ${spreads.length}${name}`;
    prev.disabled = at === 0;
    next.disabled = at === spreads.length - 1;
    /* Read by the pointer, so the arrow can dim where the page will not turn. */
    book.dataset.first = String(at === 0);
    book.dataset.last = String(at === spreads.length - 1);
    book.setAttribute('aria-label',
      `${b.heading || 'Zine'}, spread ${at + 1} of ${spreads.length}`);
    warm(at);
  };

  function turn(dir) {
    const to = at + (dir === 'next' ? 1 : -1);
    if (turning || to < 0 || to >= spreads.length) return;
    turning = true;

    const leaf = el('div', 'book-leaf');
    leaf.dataset.dir = dir;
    const front = el('div', 'book-face book-front');
    const back = el('div', 'book-face book-back');

    if (dir === 'next') {
      front.style.cssText = `background-image:${url(at)};background-position:100% 0`;
      back.style.cssText = `background-image:${url(to)};background-position:0 0`;
      right.style.backgroundImage = url(to);
    } else {
      front.style.cssText = `background-image:${url(at)};background-position:0 0`;
      back.style.cssText = `background-image:${url(to)};background-position:100% 0`;
      left.style.backgroundImage = url(to);
    }

    leaf.append(front, back);
    book.appendChild(leaf);
    /* One frame with the leaf still flat, so the transition has a start. */
    requestAnimationFrame(() => requestAnimationFrame(() => { leaf.dataset.go = 'true'; }));

    let landed = false;
    const done = () => {
      if (landed) return;
      landed = true;
      leaf.remove();
      at = to;
      turning = false;
      settle();
    };
    leaf.addEventListener('transitionend', e => {
      if (e.propertyName === 'transform') done();
    }, { once: true });
    /* A tab in the background never fires transitionend, and the book would
       be stuck mid-turn when you came back to it. */
    setTimeout(done, 1100);
  }

  next.addEventListener('click', () => turn('next'));
  prev.addEventListener('click', () => turn('prev'));
  book.addEventListener('click', e => {
    const box = book.getBoundingClientRect();
    turn(e.clientX - box.left > box.width / 2 ? 'next' : 'prev');
  });
  book.tabIndex = 0;
  book.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { e.preventDefault(); turn('next'); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); turn('prev'); }
  });

  settle();
  return wrap;
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
    const block = el('section', 'block-grid');
    if (b.heading) block.appendChild(el('h2', null, b.heading));
    /* A set of pictures can want a sentence before it. Every other block type
       already printed one; this one and `links` did not, so copy written for
       them disappeared without any error to notice. */
    (b.body || []).forEach(t => block.appendChild(el('p', 'block-intro', t)));
    /* The pictures live in their own box inside the block. They flow down
       columns of their own height, which a heading must not join — so the
       heading is a sibling of that box, not the first thing in it. */
    const wrap = el('div', 'grid-items');
    block.appendChild(wrap);
    if (b.columns) wrap.style.setProperty('--cols', b.columns);
    /* A phone collapses every grid to two columns, but a block that asked for
       one wants the whole width — it is a single picture, not a row. */
    if (b.columns === 1) wrap.dataset.single = 'true';
    if (b.ratio) { wrap.style.setProperty('--ratio', b.ratio); wrap.dataset.ratio = 'true'; }
    if (b.fit === 'contain') wrap.dataset.fit = 'contain';
    /* Grey until you look at it. Only for sets where the colour is the thing
       being shown, so that arriving at one is a change rather than the state
       everything is already in. */
    if (b.mono) block.dataset.mono = 'true';
    /* opts this set into moving while a track is playing */
    if (b.dance) block.dataset.dance = 'true';
    /* A column flow balances by height, so a set of EQUAL height items lands
       in fewer columns than asked for — four record covers in three columns
       became two columns of two with the third left empty, and the reading
       order went down instead of across. Anything uniform keeps a real grid:
       drawings, which want an even field, and covers, which are all squares. */
    /* `even` asks for a real grid rather than a column flow: every cell the
       same size, read across rather than down. Drawings and record covers
       get it for free, being uniform already. */
    if (b.even || b.fit === 'contain' || b.type === 'releases') wrap.dataset.even = 'true';
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
          fi.alt = item.alt || item.title || ''; hintLoading(fi);
          markWhenLoaded(fi);
          fi.src = src;
          flick.appendChild(fi);
        });
        if (item.tile) flick.style.background = item.tile;
        if (b.lightbox) {
          const at = gallery.length;
          gallery.push({ group: g, flip: item.flip, src: item.flip[0], alt: item.alt || '',
                         heading: item.title || b.heading || '' });
          flick.style.cursor = 'pointer';
          flick.dataset.cursor = 'look';
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
            const li = el('li');
            li.appendChild(linkNode(l)); ul.appendChild(li);
          });
          slot.appendChild(ul);
        }
        wrap.appendChild(slot);
        return;
      }

      const img = el('img');
      img.alt = item.alt || item.title || '';
      hintLoading(img);
      /* The CSS holds a square open until the picture lands, then hands the
         box back to its own proportions. The listener goes on BEFORE the src,
         or a cached image can finish loading in the gap between the two and
         never be marked — leaving it stretched into the placeholder square. */
      markWhenLoaded(img);
      img.src = src;
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
        img.style.cursor = 'pointer';
        img.dataset.cursor = 'look';
        img.addEventListener('click', () => openLightbox(at));
      }
      fig.appendChild(img);
      /* A record carries a third line: what was played on it. It sits apart
         from the title and the note because it answers a different question,
         and on a page of four bands it is the whole reason the page exists. */
      if (item.title || note || item.role) {
        const cap = el('figcaption');
        if (item.title) cap.appendChild(el('span', 'fig-title', item.title));
        if (note) cap.appendChild(el('span', 'fig-note', note));
        if (item.role) cap.appendChild(el('span', 'fig-role', item.role));
        fig.appendChild(cap);
      }
      if (item.links) {
        const ul = el('ul');
        item.links.forEach(l => {
          const li = el('li');
          li.appendChild(linkNode(l)); ul.appendChild(li);
        });
        fig.appendChild(ul);
      }
      wrap.appendChild(fig);
    });
    return block;
  }

  /* A carousel on one half, the writing on the other. The same set of images
     opens in the lightbox, which carries the description with it. */
  /* Two carousels in a row, each named underneath. Two cassettes are the same
     object twice over, so setting them beside each other lets you read them
     against one another, and neither needs a paragraph to explain what a
     cassette is. */
  if (b.type === 'book') return buildBook(b);

  if (b.type === 'pair') {
    const wrap = el('section', 'block-pair');
    if (b.heading) wrap.appendChild(el('h2', null, b.heading));
    const row = el('div', 'pair-row');
    (b.items || []).forEach(one => {
      const cell = el('figure', 'pair-one');
      cell.appendChild(buildCarousel(one.items, one.title));
      if (one.title) cell.appendChild(el('figcaption', null, one.title));
      row.appendChild(cell);
    });
    wrap.appendChild(row);
    return wrap;
  }

  if (b.type === 'feature') {
    const wrap = el('section', 'block-feature');
    const media = buildCarousel(b.items, b.heading, b.body, b.links);
    const copy = el('div', 'block-text');
    if (b.heading) copy.appendChild(el('h2', null, b.heading));
    if (b.kicker) copy.appendChild(el('p', 'kicker', b.kicker));
    (b.body || []).forEach(t => copy.appendChild(el('p', null, t)));
    if (b.links) {
      const ul = el('ul', 'inline-links');
      b.links.forEach(l => {
        const li = el('li');
        li.appendChild(linkNode(l)); ul.appendChild(li);
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

  if (b.type === 'album') {
    return buildAlbum(b);
  }

  if (b.type === 'links') {
    const wrap = el('section', 'block-links');
    if (b.heading) wrap.appendChild(el('h2', null, b.heading));
    (b.body || []).forEach(t => wrap.appendChild(el('p', 'block-intro', t)));
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

/* Every player belonging to the project being replaced. An <audio> carries on
   playing after it leaves the document, and `players` was never emptied, so
   the array kept growing and kept references to elements nobody could reach a
   control for. Closing a project left its record playing with no way to stop
   it, and `reflectPlaying` would have believed a detached element. */
function stopPlayers() {
  players.forEach(p => p.pause());
  players.length = 0;
  delete project.dataset.playing;
}

function renderProject(o) {
  stopPlayers();
  project.replaceChildren();
  gallery = [];
  group = 0;
  eager = 0;   // each project gets its own head start
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
   stay within that one set of images.
   There used to be a strip of thumbnails under the picture. It lived inside
   the same element `show()` rebuilds, so the first arrow press wiped it and it
   never came back. Peter's call was to drop it rather than repair it: the
   arrows and the count already say where you are, and a row of thumbnails
   under a photograph is a second, smaller version of the thing you opened the
   lightbox to look at. */
function openLightbox(at = 0) {
  if (!gallery.length) return;
  const set = gallery.filter(x => x.group === gallery[at].group);
  let i = Math.max(0, set.indexOf(gallery[at]));

  const box = el('div'); box.id = 'lightbox';
  const frame = el('figure', 'lightbox-frame');
  const media = el('div', 'lightbox-media');
  const cap = el('figcaption', 'lightbox-copy');
  const count = el('p', 'lightbox-count');

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
      const wrap = el('p'); wrap.appendChild(linkNode(l)); cap.appendChild(wrap);
    });
    if (set.length > 1) {
      count.textContent = `${i + 1} / ${set.length}`;
      cap.appendChild(count);
    }
  };
  show(i);

  const prev = makeMark('prev'); prev.classList.add('lightbox-step', 'prev');
  const next = makeMark('next'); next.classList.add('lightbox-step', 'next');
  prev.addEventListener('click', e => { e.stopPropagation(); show(i - 1); });
  next.addEventListener('click', e => { e.stopPropagation(); show(i + 1); });

  const shut = makeMark('x');
  shut.addEventListener('click', e => { e.stopPropagation(); box.remove(); });

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
  if (isVideo) {
    /* The file is named in data-src, not src, so nothing is fetched until the
       wall is actually being looked at. Seven sets loop a video, 5.2MB of the
       9MB a project page used to weigh, and arriving straight at /fine-art/
       you are looking at paintings with the whole wall behind the writing.
       `wallPlayback` hands over the real src at the moment it is wanted. */
    el.dataset.src = tv.media;
    el.preload = 'none';
    el.autoplay = el.muted = el.loop = el.playsInline = true;
  } else {
    el.src = tv.media;
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

function expand(id, arriving = false) {
  stage.dataset.expanded = id;
  shell.dataset.open = 'true';

  // each project can hide its own texture behind the drawer
  const o = objects.find(x => x.id === id);
  backdrop.style.backgroundImage = o && o.backdrop ? `url("${o.backdrop}")` : '';
  renderProject(o);

  /* Let the screen play first, then hand over to the writing. That pause is
     the point when you have just clicked a television and are watching it grow.
     Arriving straight at /fine-art/ there is nothing to watch: the set is
     already open, so the same wait is a blank page for two and a half seconds,
     which reads as the site being slow rather than as a beat being held. */
  clearTimeout(previewTimer);
  delete shell.dataset.reading;
  if (o && o.content) {
    const wait = arriving ? 0 : PREVIEW_MS;
    if (wait) previewTimer = setTimeout(() => { shell.dataset.reading = 'true'; }, wait);
    else shell.dataset.reading = 'true';
  }
  if (!isPhone()) setNav(true);
  lockToStage(id);
  wall.querySelectorAll('.tv').forEach(el => {
    el.dataset.state = el.dataset.screen === id ? 'expanded' : '';
  });
  wallPlayback(id);
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

/* Seven sets on this wall play a looping video, and they never stopped. With a
   project open the wall is almost entirely covered by the writing, so six of
   those seven are decoding frames nobody can see, forever, while the project's
   pictures are trying to arrive. Fine art asks for fifty-nine of them.

   So the wall goes quiet while you are reading, except for the set you opened,
   and starts again when you come back to it. `play()` returns a promise that
   rejects if the browser has decided not to autoplay; that is not an error
   worth acting on. */
function wallPlayback(exceptId) {
  wall.querySelectorAll('.tv').forEach(tv => {
    const v = tv.querySelector('video');
    if (!v) return;
    if (exceptId && tv.dataset.screen !== exceptId) { v.pause(); return; }
    if (!v.getAttribute('src') && v.dataset.src) v.src = v.dataset.src;
    v.play().catch(() => {});
  });
}

function collapse() {
  wallPlayback(null);
  clearTimeout(previewTimer);
  delete shell.dataset.reading;
  delete document.body.dataset.locked;
  delete stage.dataset.frozen;
  project.hidden = true;
  stopPlayers();
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
function go(id, push = true, arriving = false) {
  const o = objects.find(x => x.id === id);
  if (!o) return;
  if (push && location.pathname !== pathOf(o)) {
    history.pushState({ id }, '', pathOf(o));
  }
  setHead(o);
  expand(id, arriving);
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
  /* Landing on the wall: everything plays. Landing inside a project: only the
     set you came for, and the rest stay unfetched until you close it. */
  if (o) go(o.id, false, true); else { setHead(null); wallPlayback(null); }
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

/* ---------------------------------------------------------------------------
   THE POINTER
   The cursor is the site's mark. It grows over anything that opens, turns the
   quarter circle over the close, and says the verb outright over a control
   whose job is not obvious from a shape.

   Everything here is opt-in and reversible. The system cursor is only hidden
   after `(hover: hover) and (pointer: fine)` says there is a mouse, so a touch
   screen and a machine with JavaScript off both keep the ordinary one.
   --------------------------------------------------------------------------- */
(() => {
  const dot = document.getElementById('pointer');
  const word = document.getElementById('pointer-word');
  if (!dot || !window.matchMedia) return;

  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (!fine.matches) return;

  document.documentElement.dataset.pointer = 'on';

  /* One read of the DOM per frame at most. `pointermove` fires far faster than
     the screen refreshes, and moving the mark more often than that is work
     nobody can see. */
  let x = 0, y = 0, queued = false, over = null;

  const draw = () => {
    queued = false;
    dot.style.translate = `${x}px ${y}px`;
    const kind = over && over.dataset.cursor;
    if (kind === 'play' || kind === 'pause' || kind === 'look') {
      dot.dataset.word = 'true';
      word.textContent = kind;
    } else {
      delete dot.dataset.word;
    }
    if (kind === 'close') dot.dataset.kind = 'close';
    else if (over) dot.dataset.kind = 'open';
    else delete dot.dataset.kind;
  };

  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(draw); } };

  /* Moves the mark without letting `draw` overwrite a state already decided. */
  let posQueued = false;
  const queuePos = () => {
    if (posQueued) return;
    posQueued = true;
    requestAnimationFrame(() => {
      posQueued = false;
      dot.style.translate = `${x}px ${y}px`;
    });
  };

  addEventListener('pointermove', e => {
    x = e.clientX; y = e.clientY;
    const at = e.target.closest ? e.target : null;

    /* The drawer is the one place the mark stands down. A plus over a list of
       channels reads as "add one" rather than "open this one", and a list of
       links is exactly where people expect the ordinary hand. */
    if (at && at.closest('nav')) {
      if (dot.dataset.on) delete dot.dataset.on;
      return;
    }

    if (!dot.dataset.on) dot.dataset.on = 'true';

    /* A book is the one thing whose answer depends on WHERE in it you are,
       rather than on what you are over. The half you are in is the page that
       would turn, so the mark becomes that direction, and dims at the end it
       cannot go. */
    const book = at && at.closest('.book');
    if (book) {
      const box = book.getBoundingClientRect();
      const dir = e.clientX - box.left > box.width / 2 ? 'next' : 'prev';
      const stuck = dir === 'next' ? book.dataset.last : book.dataset.first;
      if (stuck === 'true') dot.dataset.dim = 'true'; else delete dot.dataset.dim;
      over = null;
      dot.dataset.kind = dir;
      delete dot.dataset.word;
      queuePos();
      return;
    }
    delete dot.dataset.dim;

    /* `closest` walks up from whatever is under the pointer, so a marker can
       sit on the control itself and still answer for the text inside it. */
    over = at ? at.closest('[data-cursor], a, button, .tv') : null;
    queue();
  }, { passive: true });

  /* Leaving the window, or dragging out of it, takes the mark with you. */
  addEventListener('pointerdown', () => { dot.dataset.down = 'true'; queue(); }, { passive: true });
  addEventListener('pointerup', () => { delete dot.dataset.down; queue(); }, { passive: true });
  document.addEventListener('pointerleave', () => { delete dot.dataset.on; });
  addEventListener('blur', () => { delete dot.dataset.on; });
})();
