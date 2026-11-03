(()=>{
const hero=document.getElementById('hero'),base=(document.currentScript.src.split('assets/globe/')[0])+'assets/globe/';
window.__GBASE=base;window.__heroInView=true;
const force=/[?&]globe=1/.test(location.search);
// Phones get the live globe too (lighter particle count, 24 fps); static poster only for Save-Data or low-memory devices.
const lite=(navigator.connection&&navigator.connection.saveData)||(navigator.deviceMemory&&navigator.deviceMemory<3);
if(lite&&!force){hero.classList.add('poster');return}
if('IntersectionObserver' in window)new IntersectionObserver(es=>{window.__heroInView=es[0].isIntersecting},{threshold:0}).observe(hero);
const css=document.createElement('link');css.rel='stylesheet';css.href=base+'vendor/maplibre-gl.css?v=5.24.0';document.head.appendChild(css);
const V='?v=4';
const load=src=>new Promise((r,j)=>{const s=document.createElement('script');s.src=base+src;s.onload=r;s.onerror=j;document.body.appendChild(s)});
const go=()=>load('vendor/maplibre-gl.js?v=5.24.0').then(()=>load('overlay-data.js'+V)).then(()=>load('overlay.js'+V)).then(()=>load('buoys.js'+V)).then(()=>load('globe.js'+V)).then(()=>hero.classList.add('live'));
requestAnimationFrame(()=>setTimeout(go,0));
})();
