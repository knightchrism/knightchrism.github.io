document.getElementById('yr').textContent = new Date().getFullYear();
const map = new maplibregl.Map({
  container: 'mapel',
  style: 'https://tiles.openfreemap.org/styles/dark',
  center: [-81.55, 30.15], zoom: 7.9, cooperativeGestures: true
});
map.addControl(new maplibregl.NavigationControl(), 'top-right');
// SAMPLE markers only: illustrative locations, not real project data.
const samples = [
  ['Sample: Downtown Jacksonville', [-81.6557, 30.3322]],
  ['Sample: St. Augustine', [-81.3124, 29.8947]],
  ['Sample: Fernandina Beach', [-81.4626, 30.6697]],
  ['Sample: Orange Park', [-81.7065, 30.1661]],
  ['Sample: Palatka', [-81.6373, 29.6486]]
];
samples.forEach(([label, ll]) => {
  const el = document.createElement('div'); el.className = 'sample-marker';
  el.setAttribute('aria-label', label); el.title = label;
  new maplibregl.Marker({ element: el }).setLngLat(ll)
    .setPopup(new maplibregl.Popup({ offset: 12 }).setText(label)).addTo(map);
});
map.on('load', () => { window.__mapLoaded = true; });
