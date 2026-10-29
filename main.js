document.getElementById('yr').textContent = new Date().getFullYear();
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = innerWidth < 700;
const FL = mobile ? [-83.4, 23.6] : [-87.9, 27.6];
const Z = mobile ? 4.6 : 5.3;
const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/';
const DAY = GIBS + 'BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg';
const NIGHT = GIBS + 'VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png';
const RAD = Math.PI / 180;

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

let mode = 'dusk', sun = duskSun(), version = 0;

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
  const [di, ni] = await Promise.all([loadImg(fill(DAY, z, x, y)), loadImg(fill(NIGHT, z, x, y))]);
  ctx.clearRect(0, 0, S, S);
  if (!di) throw new Error('tile');
  ctx.drawImage(di, 0, 0, S, S); const D = ctx.getImageData(0, 0, S, S);
  let N = null; if (ni) { ctx.clearRect(0, 0, S, S); ctx.drawImage(ni, 0, 0, S, S); N = ctx.getImageData(0, 0, S, S).data; }
  const d = D.data, n = 2 ** z;
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
      let r = d[k] * lit, g = d[k + 1] * lit, bl = d[k + 2] * lit;
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

const map = new maplibregl.Map({
  container: 'globe', attributionControl: false,
  scrollZoom: false, dragRotate: false, pitchWithRotate: false, maxZoom: 9,
  center: reduce ? FL : [-62, 18], zoom: reduce ? Z : 2,
  style: {
    version: 8, projection: { type: 'globe' },
    sky: { 'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 6, 0.9, 8, 0] },
    sources: {
      dn: { type: 'raster', tileSize: 256, maxzoom: 8, tiles: ['daynight://{z}/{x}/{y}?v=0'] },
      usgs: { type: 'raster', tileSize: 256, maxzoom: 16,
        tiles: ['https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}'] },
      fl: { type: 'geojson', data: 'florida.geojson' }
    },
    layers: [
      { id: 'dn', type: 'raster', source: 'dn', paint: { 'raster-fade-duration': 0 } },
      { id: 'usgs', type: 'raster', source: 'usgs', minzoom: 8, paint: { 'raster-brightness-max': 0.8 } },
      { id: 'fl-glow', type: 'line', source: 'fl', paint: { 'line-color': '#e8b65a', 'line-width': 6, 'line-blur': 5, 'line-opacity': 0.35 } },
      { id: 'fl-line', type: 'line', source: 'fl', paint: { 'line-color': '#f0c87a', 'line-width': 1.3, 'line-opacity': 0.95 } }
    ]
  }
});

function setSun(s) {
  sun = s; version++;
  const src = map.getSource('dn'); if (src) src.setTiles([`daynight://{z}/{x}/{y}?v=${version}`]);
}
function setMode(m) {
  mode = m;
  document.querySelectorAll('.sun-toggle button').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === m));
  setSun(m === 'live' ? subsolar(new Date()) : duskSun());
}
document.querySelectorAll('.sun-toggle button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
setInterval(() => { if (mode === 'live') setSun(subsolar(new Date())); }, 5 * 60e3);

map.on('load', () => {
  const settle = () => {
    window.__mapLoaded = true;
    if (reduce || mobile) return;
    // gentle drift: slow eastward sway, very small
    let dir = 1; const drift = () => { map.easeTo({ center: [FL[0] + dir * 0.8, FL[1]], duration: 30000, easing: t => t }); dir *= -1; };
    map.on('moveend', function onEnd(e) { if (!e.originalEvent) drift(); }); drift();
  };
  if (reduce) map.once('idle', settle);
  else { map.flyTo({ center: FL, zoom: Z, duration: 4500, essential: false }); map.once('moveend', () => map.once('idle', settle)); }
});
// stop drifting once the user grabs the globe
map.on('mousedown', () => map.off('moveend')); map.on('touchstart', () => map.off('moveend'));
