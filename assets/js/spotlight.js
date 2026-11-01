(()=>{const v=(window.GK_VIDEOS||{}).spotlight,s=document.querySelector('.vslot-spot');if(!s||!v||!v.src)return;
const rm=matchMedia('(prefers-reduced-motion: reduce)').matches,m=document.createElement('video');
m.muted=true;m.loop=true;m.playsInline=true;m.setAttribute('muted','');m.preload='metadata';m.poster=v.poster?'map-sheets/'+v.poster:s.dataset.poster;
m.setAttribute('aria-label',v.title||'Map sheet service preview');if(rm)m.controls=true;else m.autoplay=true;
if(v.webm){const w=document.createElement('source');w.src='map-sheets/'+v.webm;w.type='video/webm';m.appendChild(w)}
const a=document.createElement('source');a.src='map-sheets/'+v.src;a.type='video/mp4';m.appendChild(a);
if(v.captions){const t=document.createElement('track');t.kind='captions';t.src='map-sheets/'+v.captions;t.srclang='en';t.label='English';m.appendChild(t)}
s.appendChild(m);s.hidden=false;document.querySelector('.spot-pan').hidden=true;})();
