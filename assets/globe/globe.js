const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = innerWidth < 700, SP = reduce ? 0.4 : 1;
// Fit Florida (~8.5 deg wide, ~7 deg tall) into the hero, right of centre, at any width.
const GR = document.getElementById('globe').getBoundingClientRect();
const PPD = Math.min(0.62 * GR.height / 8.2, 0.42 * GR.width / 8.5); // px per degree of longitude
const Z = mobile ? 4.6 : Math.log2(PPD * 360 / 512);
const FL = mobile ? [-83.4, 23.6] : [-83.4 - (0.68 - 0.5) * GR.width / PPD, 27.6];
const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/';
const DAY = GIBS + 'BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg';
const NIGHT = GIBS + 'VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png';
const RAD = Math.PI / 180;
// Today's clouds: VIIRS SNPP corrected-reflectance true color (NASA GIBS, public domain), yesterday UTC
// (today's swaths are still filling in). Only bright cloud pixels are blended in, day side only.
const CLOUD_DATE = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
const CLOUD = GIBS + `VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${CLOUD_DATE}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;
// Crispness: MapLibre picks tile zoom from CSS pixels, so on HiDPI screens we declare 128px tiles
// (one zoom level deeper) so each 256px source tile maps ~1:1 onto device pixels. Capped by each
// layer's native maxzoom (Blue/Black Marble z8, USGS z16) so nothing is blurrily overzoomed beyond that.
const DPR = Math.min(devicePixelRatio || 1, 2);
const TS = DPR >= 1.5 ? 128 : 256;

// ---- Sun position (low-precision NOAA-style; ~0.1° accuracy, plenty for a terminator) ----
function subsolar(date) {
  const d = date.getTime() / 864e5 + 2440587.5 - 2451545.0; // days since J2000
  const g = (357.529 + 0.98560028 * d) * RAD;
  const q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * RAD;
  const e = (23.439 - 0.00000036 * d) * RAD;
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const gmst = ((18.697374558 + 24.06570982441908 * d) % 24) * 15 * RAD;
  let lon = (ra - gmst) / RAD; lon = ((lon + 540) % 360) - 180;
  return { lat: dec / RAD, lon };
}
// Cinematic "dusk over Florida": sun ~4-5° below the horizon at Orlando, terminator crossing the state.
function duskSun() { const s = subsolar(new Date()); return { lat: s.lat, lon: -81.4 - 88 }; }

let mode = 'live', sun = subsolar(new Date()), version = 0;

// ---- Composite day/night tiles on the fly via a custom protocol ----
const imgCache = new Map();
function loadImg(url) {
  if (!imgCache.has(url)) imgCache.set(url, new Promise((res, rej) => {
    const im = new Image(); im.crossOrigin = 'anonymous';
    im.onload = () => res(im); im.onerror = () => res(null); im.src = url;
  }));
  return imgCache.get(url);
}
const fill = (t, z, x, y) => t.replace('{z}', z).replace('{x}', x).replace('{y}', y);
const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
const ctx = cv.getContext('2d', { willReadFrequently: true });

maplibregl.addProtocol('daynight', async (params) => {
  const [z, x, y] = params.url.replace('daynight://', '').split('?')[0].split('/').map(Number);
  const [di, ni, ci] = await Promise.all([loadImg(fill(DAY, z, x, y)), loadImg(fill(NIGHT, z, x, y)), loadImg(fill(CLOUD, z, x, y))]);
  ctx.clearRect(0, 0, S, S);
  if (!di) throw new Error('tile');
  ctx.drawImage(di, 0, 0, S, S); const D = ctx.getImageData(0, 0, S, S);
  let C = null; if (ci) { ctx.clearRect(0, 0, S, S); ctx.drawImage(ci, 0, 0, S, S); C = ctx.getImageData(0, 0, S, S).data; }
  let N = null; if (ni) { ctx.clearRect(0, 0, S, S); ctx.drawImage(ni, 0, 0, S, S); N = ctx.getImageData(0, 0, S, S).data; }
  const d = D.data, n = 2 ** z;
  const ck = z >= 8 ? 0 : z >= 7 ? 0.5 : 1; // fade clouds out before they'd be overzoomed past USGS handoff
  const sd = Math.sin(sun.lat * RAD), cd = Math.cos(sun.lat * RAD);
  const cosH = new Float32Array(S);
  for (let i = 0; i < S; i++) cosH[i] = Math.cos(((x + (i + .5) / S) / n * 360 - 180 - sun.lon) * RAD);
  for (let j = 0; j < S; j++) {
    const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + (j + .5) / S) / n)));
    const a = Math.sin(lat) * sd, b = Math.cos(lat) * cd;
    for (let i = 0; i < S; i++) {
      const el = Math.asin(a + b * cosH[i]) / RAD;       // solar elevation, degrees
      const day = smooth(-9, 3, el);                      // soft civil/nautical twilight band
      const glow = Math.exp(-((el + 1.5) ** 2) / 14) * 0.55; // warm band along the terminator
      const k = (j * S + i) * 4;
      const lit = 0.06 + 0.94 * day;
      let r = d[k], g = d[k + 1], bl = d[k + 2];
      if (C && ck > 0 && day > 0.02) {
        // keep only bright, neutral (cloud) pixels; faint so the Blue Marble stays clean
        const mn = Math.min(C[k], C[k + 1], C[k + 2]);
        const c = smooth(150, 225, mn) * 0.42 * ck * day;
        r += (C[k] - r) * c; g += (C[k + 1] - g) * c; bl += (C[k + 2] - bl) * c;
      }
      r *= lit; g *= lit; bl *= lit;
      if (N) {
        const nf = (1 - day) * 1.15;
        // warm the lights a touch toward sodium gold
        r += N[k] * nf * 1.05; g += N[k + 1] * nf * 0.92; bl += N[k + 2] * nf * 0.7;
      }
      r += 255 * glow * 0.32; g += 140 * glow * 0.32; bl += 60 * glow * 0.32;
      d[k] = r > 255 ? 255 : r; d[k + 1] = g > 255 ? 255 : g; d[k + 2] = bl > 255 ? 255 : bl; d[k + 3] = 255;
    }
  }
  ctx.putImageData(D, 0, 0);
  const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.9));
  return { data: await blob.arrayBuffer() };
});

const map = window.__map = new maplibregl.Map({
  container: 'globe', attributionControl: false, pixelRatio: DPR,
  scrollZoom: false, dragRotate: false, pitchWithRotate: false, maxZoom: 11,
  center: reduce ? FL : [-62, 18], zoom: reduce ? Z : 2,
  style: {
    version: 8, projection: { type: 'globe' },
    sky: { 'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 6, 0.9, 8, 0] },
    sources: {
      dn: { type: 'raster', tileSize: TS, maxzoom: 8, tiles: ['daynight://{z}/{x}/{y}?v=0'] },
      usgs: { type: 'raster', tileSize: TS, maxzoom: 16, bounds: [-88, 24.3, -79.8, 31.1], // Florida only (USGS has no open-ocean tiles)
        tiles: ['https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}'] },
      fl: { type: 'geojson', data: window.__GBASE + 'florida.geojson' },
      term: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      lanes: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      ships: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      quakes: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      gauges: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }
    },
    layers: [
      { id: 'dn', type: 'raster', source: 'dn', paint: { 'raster-fade-duration': 300, 'raster-resampling': 'linear' } },
      { id: 'usgs', type: 'raster', source: 'usgs', minzoom: 7.5,
        paint: { 'raster-brightness-max': 0.8, 'raster-opacity': ['interpolate', ['linear'], ['zoom'], 7.5, 0, 8, 1] } },
      { id: 'term-glow', type: 'line', source: 'term', paint: { 'line-color': '#e8b65a', 'line-width': 18, 'line-blur': 16, 'line-opacity': 0.25 } },
      { id: 'lanes', type: 'line', source: 'lanes', paint: { 'line-color': '#e8b65a', 'line-width': 0.6, 'line-opacity': 0.18, 'line-dasharray': [2, 4] } },
      { id: 'fl-glow', type: 'line', source: 'fl', paint: { 'line-color': '#e8b65a', 'line-width': 6, 'line-blur': 5, 'line-opacity': 0.35 } },
      { id: 'fl-line', type: 'line', source: 'fl', paint: { 'line-color': '#f0c87a', 'line-width': 1.3, 'line-opacity': 0.95 } },
      { id: 'gauge-ring', type: 'circle', source: 'gauges', paint: { 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#9fd3e6', 'circle-stroke-width': 1, 'circle-radius': 4, 'circle-stroke-opacity': 0.5 } },
      { id: 'gauge-dot', type: 'circle', source: 'gauges', paint: { 'circle-color': '#9fd3e6', 'circle-radius': 1.2, 'circle-opacity': 0.55 } },
      { id: 'quake-ring', type: 'circle', source: 'quakes', paint: { 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': '#f0c87a', 'circle-stroke-width': 1.2, 'circle-radius': 6, 'circle-stroke-opacity': 0.6 } },
      { id: 'quake-dot', type: 'circle', source: 'quakes', paint: { 'circle-color': '#f0c87a', 'circle-radius': ['interpolate', ['linear'], ['get', 'mag'], 0, 1.5, 6, 5], 'circle-opacity': 0.9 } },
      { id: 'ship-glow', type: 'circle', source: 'ships', paint: { 'circle-color': '#e8b65a', 'circle-radius': 5, 'circle-blur': 1, 'circle-opacity': 0.45 } },
      { id: 'ship', type: 'circle', source: 'ships', paint: { 'circle-color': '#f6d58e', 'circle-radius': 1.8 } }
    ]
  }
});

// ---- Terminator glow line: small circle ~92° from the subsolar point (just on the night side) ----
function terminatorLine(s, offDeg = 92) {
  const la1 = s.lat * RAD, lo1 = s.lon * RAD, dd = offDeg * RAD, pts = [];
  let prev = null;
  for (let b = 0; b <= 360; b += 2) {
    const br = b * RAD;
    const la2 = Math.asin(Math.sin(la1) * Math.cos(dd) + Math.cos(la1) * Math.sin(dd) * Math.cos(br));
    let lo2 = (lo1 + Math.atan2(Math.sin(br) * Math.sin(dd) * Math.cos(la1), Math.cos(dd) - Math.sin(la1) * Math.sin(la2))) / RAD;
    if (prev !== null) while (lo2 - prev > 180) lo2 -= 360; else lo2 = ((lo2 + 540) % 360) - 180;
    if (prev !== null) while (lo2 - prev < -180) lo2 += 360;
    prev = lo2; pts.push([lo2, la2 / RAD]);
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: pts } };
}

function setSun(s) {
  sun = s; version++;
  const src = map.getSource('dn'); if (src) src.setTiles([`daynight://{z}/{x}/{y}?v=${version}`]);
  const t = map.getSource('term'); if (t) t.setData(terminatorLine(s));
}
function setMode(m) {
  mode = m;
  document.querySelectorAll('.sun-toggle button').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === m));
  setSun(m === 'live' ? subsolar(new Date()) : duskSun());
}
document.querySelectorAll('.sun-toggle button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
// Real-time terminator: recomputed from current UTC every 60 s (moves ~0.25°/min, tiles cross-fade).
setInterval(() => { if (mode === 'live' && !document.hidden) setSun(subsolar(new Date())); }, 60e3);

// ---- Shipping lanes: ILLUSTRATIVE, hand-drawn approximations of common routes off Florida.
// Not AIS data; ship dots are decorative animation only. ----
const LANES = [
  [[-80.0, 24.3], [-79.7, 25.5], [-79.8, 26.8], [-80.1, 28.3], [-80.3, 29.8], [-80.6, 31.5], [-79.8, 33.0]], // Florida Strait → Gulf Stream north
  [[-81.3, 30.4], [-80.6, 30.5], [-79.5, 30.6], [-77.5, 30.8]],                                              // Jacksonville / St. Johns offshore
  [[-80.1, 26.1], [-79.4, 25.9], [-78.6, 25.6], [-77.6, 25.3]],                                              // Port Everglades → Bahamas
  [[-80.4, 24.2], [-82.0, 24.3], [-83.5, 24.5], [-85.5, 25.4], [-88.0, 27.2], [-89.4, 28.6]],                  // Florida Strait → Gulf toward Mississippi
  [[-82.7, 27.6], [-83.6, 27.3], [-85.0, 26.6], [-86.8, 25.9]],                                              // Tampa Bay → Gulf
  [[-87.3, 30.2], [-87.0, 29.2], [-86.2, 27.6], [-84.6, 25.4], [-83.0, 24.2]],                                // Pensacola/Mobile → Keys
  [[-80.2, 25.7], [-79.6, 24.9], [-78.5, 24.0], [-76.5, 23.4]]                                               // Miami → Old Bahama Channel
];
const laneLen = LANES.map(l => { const c = [0]; for (let i = 1; i < l.length; i++) c.push(c[i - 1] + Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1])); return c; });
const SHIPS = []; LANES.forEach((l, i) => { const n = mobile ? 2 : 4; for (let k = 0; k < n; k++) SHIPS.push({ lane: i, t: (k + Math.random() * 0.5) / n, v: (0.006 + Math.random() * 0.006) * (k % 2 ? 1 : -1) }); });
function shipsFC(dt) {
  return { type: 'FeatureCollection', features: SHIPS.map(s => {
    const l = LANES[s.lane], c = laneLen[s.lane], L = c[c.length - 1];
    s.t = (((s.t + s.v * dt / L) % 1) + 1) % 1;
    const d = s.t * L; let i = 1; while (i < c.length - 1 && c[i] < d) i++;
    const f = (d - c[i - 1]) / (c[i] - c[i - 1] || 1);
    return { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [l[i - 1][0] + (l[i][0] - l[i - 1][0]) * f, l[i - 1][1] + (l[i][1] - l[i - 1][1]) * f] } };
  }) };
}

// ---- Live feeds (fail silently; layers simply stay empty) ----
async function getJSON(u) { const r = await fetch(u); if (!r.ok) throw new Error(r.status); return r.json(); }
async function loadQuakes() {
  try {
    const g = await getJSON('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson');
    g.features = g.features.filter(f => f.geometry).map((f, i) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: f.geometry.coordinates.slice(0, 2) }, properties: { mag: Math.max(0, f.properties.mag || 0), o: (i * 0.37) % 1 } }));
    map.getSource('quakes').setData(g); window.__feeds.quakes = g.features.length;
  } catch (e) { window.__feeds.quakes = 'error'; }
}
async function loadGauges() {
  try {
    // USGS Water Data OGC API: latest streamflow (00060) at gauges in a Florida bbox
    const g = await getJSON('https://api.waterdata.usgs.gov/ogcapi/v0/collections/latest-continuous/items?f=json&bbox=-87.7,24.4,-79.9,31.1&parameter_code=00060&limit=500&properties=time');
    const cutoff = Date.now() - 2 * 864e5;
    const feats = g.features.filter(f => f.geometry && Date.parse(f.properties.time) > cutoff)
      .map((f, i) => ({ type: 'Feature', geometry: f.geometry, properties: { o: (i * 0.61) % 1 } }));
    map.getSource('gauges').setData({ type: 'FeatureCollection', features: feats }); window.__feeds.gauges = feats.length;
  } catch (e) { window.__feeds.gauges = 'error'; }
}
window.__feeds = {};

// ---- Animation loop: ripples, glow pulse, ships, idle sway. One rAF, throttled; off for reduced motion. ----
const ring = (base, k, ph) => ['+', base, ['*', k, ['%', ['+', ph, ['get', 'o']], 1]]];
const fadeOut = (a, ph) => ['*', a, ['-', 1, ['%', ['+', ph, ['get', 'o']], 1]]];
let paused = false, idleTimer = 0, swayT = 0, anchor = null, last = 0, lastPaint = 0;
const FRAME = mobile ? 1000 / 24 : 1000 / 40;
function pause() { paused = true; clearTimeout(idleTimer); }
function resumeLater() { clearTimeout(idleTimer); idleTimer = setTimeout(() => { anchor = map.getCenter().toArray(); swayT = 0; paused = false; }, 8000); }
['mousedown', 'touchstart', 'wheel', 'dragstart'].forEach(e => map.on(e, pause));
['mouseup', 'touchend', 'dragend'].forEach(e => map.on(e, resumeLater));

function tick(now) {
  requestAnimationFrame(tick);
  if (document.hidden || !window.__heroInView || now - lastPaint < FRAME) return;
  const dt = (last ? Math.min(0.1, (now - last) / 1000) : 0) * SP; window.__ovl && window.__ovl(now, dt); last = now; lastPaint = now;
  const ph = (now * SP / 2600) % 1;
  map.setPaintProperty('quake-ring', 'circle-radius', ring(['interpolate', ['linear'], ['get', 'mag'], 0, 3, 6, 8], 18, ph));
  map.setPaintProperty('quake-ring', 'circle-stroke-opacity', fadeOut(0.7, ph));
  map.setPaintProperty('gauge-ring', 'circle-radius', ring(1.5, 7, ph));
  map.setPaintProperty('gauge-ring', 'circle-stroke-opacity', fadeOut(0.3, ph));
  map.setPaintProperty('term-glow', 'line-opacity', 0.18 + 0.14 * (0.5 + 0.5 * Math.sin(now * SP / 1400)));
  map.getSource('ships').setData(shipsFC(dt));
  // slow "rotation": gentle eastward/westward drift of the globe around the anchor, pauses on interaction
  if (!paused && anchor && !map.isMoving()) {
    // incremental offset, so any programmatic/user move simply becomes the new anchor
    const f = t => 1.5 * Math.sin(t * 2 * Math.PI / 120);
    const dl = (f(swayT + dt) - f(swayT)) * Math.min(1, 2 ** (Z - map.getZoom())); swayT += dt; // scale drift with zoom
    const c = map.getCenter(); map.jumpTo({ center: [c.lng + dl, c.lat] });
  }
}

map.on('load', () => {
  map.getSource('term').setData(terminatorLine(sun));
  map.getSource('lanes').setData({ type: 'FeatureCollection', features: LANES.map(c => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: c } })) });
  map.getSource('ships').setData(shipsFC(0));
  loadQuakes(); loadGauges();
  setInterval(() => { if (!document.hidden) loadQuakes(); }, 5 * 60e3);
  let settled = false;
  const settle = () => {
    if (settled) return; settled = true;
    window.__mapLoaded = true;
    anchor = map.getCenter().toArray();
    requestAnimationFrame(tick);
  };
  if (reduce) map.once('idle', settle);
  else { map.flyTo({ center: FL, zoom: Z, duration: 4500, essential: false }); map.once('moveend', () => { map.once('idle', settle); setTimeout(settle, 3000); }); }
});
