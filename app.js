const shell  = document.querySelector('main');
const panel  = document.getElementById('panel');
const toggle = document.getElementById('toggle');
const close  = document.getElementById('close');
const stage  = document.getElementById('stage');
const wall   = document.getElementById('wall');
const scene  = document.getElementById('scene');

/* The scene's aspect ratio. Every television is placed in this coordinate
   space, so the wall crops rather than stretches on odd viewports. */
const SCENE_AR = 1614 / 1385;   // matches media/room-sky.webp

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
    setPages(1);
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
const BARS = 'media/crt-bars.webp';     // test pattern, on a couple of sets

/* Nine televisions and an amplifier, piled the way Paik piled them: the big
   sets on the ground, smaller portables riding on top. `z` is the stacking
   order, so upper sets overlap the ones they rest on. Sizes follow the actual
   models, so the Coby and RCA portables read small next to the Apex console. */
const objects = [
  /* Arrangement follows Peter's composition mockup (Reference/desktop-composition.png):
     a wide, low pile rather than a tight pyramid — the big console and the Apex
     carrying the floor, the silver set and the Sansui stacked above, the small
     portables clustered right, the yellow set with its aerial crowning it, and
     the RCA pushed forward onto the floor in front. Scaled to about 87% of the
     mockup so the whole pile sits inside the scene rather than running off the
     top on a short window. */
  { id: 'tv1',  channel: 1, project: 'Pleeay',  z: 3,
    box:    { x: 29.6, y: 43.75, w: 17.6, rotate: -0.8 },
    ar: 2975 / 2137,
    screen: { x: 7.5,  y: 8.3,  w: 68.2, h: 76.6 },
    frame: 'media/tv-01.webp', media: 'media/tv-01-screen.mp4' },

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

  { id: 'tv4',  channel: 4, project: null,  z: 5,
    box:    { x: 28.2, y: 58.32, w: 18.4, rotate: -0.4 },
    ar: 3317 / 3183,
    screen: { x: 9.6,  y: 12.0, w: 81.9, h: 65.3 },
    frame: 'media/tv-04.webp', media: STATIC },

  { id: 'tv5',  channel: 5, project: null,  z: 3,
    box:    { x: 46.6, y: 52.97, w: 10.4, rotate: 0.9 },
    ar: 5688 / 5044,
    screen: { x: 8.6,  y: 10.6, w: 82.9, h: 70.6 },
    frame: 'media/tv-05.webp', media: STATIC },

  { id: 'tv6',  channel: 6, project: null,  z: 2,
    box:    { x: 63.4, y: 52.48, w: 10.0, rotate: -1.2 },
    ar: 1924 / 1646,
    screen: { x: 10.2, y: 20.4, w: 62.2, h: 58.3 },
    frame: 'media/tv-06.webp', media: STATIC },

  /* the same little YORX as channel 10; Peter uses three of them */
  { id: 'yorxB',  channel: null, project: null,  z: 4,
    box:    { x: 62.2, y: 61.77, w: 5.2, rotate: 1.1 },
    ar: 2141 / 2321,
    screen: { x: 14.3, y: 15.0, w: 71.3, h: 49.5 },
    frame: 'media/tv-10.webp', media: STATIC },

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

  { id: 'tv10', channel: 2, project: 'Logos',  z: 2,
    box:    { x: 47.6, y: 44.25, w: 7.2, rotate: 1.8 },
    ar: 2141 / 2321,
    screen: { x: 14.3, y: 15.0, w: 71.3, h: 49.5 },
    frame: 'media/tv-10.webp', media: ['media/bird-dark.webp', 'media/bird-light.webp'] },

  { id: 'tv11', channel: null, project: null,  z: 1,
    box:    { x: 40.3, y: 31.36, w: 10.7, rotate: -0.6 },
    ar: 2914 / 2966,
    screen: { x: 6.9,  y: 45.8, w: 61.7, h: 43.7 },
    frame: 'media/tv-11.webp', media: BARS },

  { /* no aperture: its media hides behind the cabinet until the takeover */
    id: 'amp',  channel: null, project: null, z: 10,
    box:    { x: 71.5, y: 53.96, w: 17.4, rotate: 0 },
    ar: 838 / 1400,
    screen: { x: 20,   y: 28,   w: 60,   h: 34 },
    frame: 'media/amp-01.webp', media: null }
];

/* A set is a channel. Give it a `project` and the name appears beside the
   number; leave it null and the channel stands alone. */
function labelOf(o) {
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
  a.href = '#';
  a.dataset.screen = o.id;
  a.textContent = labelOf(o);
  li.appendChild(a);
  navList.appendChild(li);
});

/* ?still skips video entirely. Ten decoders make the page hard to screenshot
   or profile, and layout work rarely needs them running. */
const STILL = new URLSearchParams(location.search).has('still');

function buildMedia(tv) {
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

  const crt = document.createElement('div');
  crt.className = 'tv-crt';
  media.appendChild(crt);

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
  close.hidden = false;
  if (!isPhone()) setNav(true);
  else lockToViewport(id);
  wall.querySelectorAll('.tv').forEach(el => {
    el.dataset.state = el.dataset.screen === id ? 'expanded' : '';
  });
  document.querySelectorAll('#nav-list a').forEach(a => {
    a.dataset.active = String(a.dataset.screen === id);
  });
}

/* On a phone the wall is three viewports tall, so "fill the screen" cannot mean
   "fill the wall". Measure the visible window in wall coordinates instead, which
   keeps the growth animating rather than snapping to a fixed overlay. */
function lockToViewport(id) {
  const el = wall.querySelector(`.tv[data-screen="${id}"]`);
  if (!el) return;
  const w = wall.getBoundingClientRect();
  el.style.setProperty('--el', '0%');
  el.style.setProperty('--et', (100 * -w.top / w.height) + '%');
  el.style.setProperty('--ew', '100%');
  el.style.setProperty('--eh', (100 * window.innerHeight / w.height) + '%');
  document.body.dataset.locked = 'true';
}

function collapse() {
  delete document.body.dataset.locked;
  stage.dataset.expanded = '';
  close.hidden = true;
  wall.querySelectorAll('.tv').forEach(el => { el.dataset.state = ''; });
  document.querySelectorAll('#nav-list a').forEach(a => { a.dataset.active = 'false'; });
}

setNav(false);

toggle.addEventListener('click', () => setNav(panel.dataset.open !== 'true'));
close.addEventListener('click', collapse);

wall.addEventListener('click', e => {
  const el = e.target.closest('.tv');
  if (!el || el.dataset.state) return;
  const o = objects.find(x => x.id === el.dataset.screen);
  if (o && o.channel != null) expand(el.dataset.screen);
});

document.querySelectorAll('#nav-list a').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    expand(a.dataset.screen);
    if (isPhone()) setNav(false);
  });
});

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  stage.dataset.expanded ? collapse() : setNav(false);
});
