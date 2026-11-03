// Florida-hero layers blended onto the globe: ocean-current particles advected through a real NOAA
// surface-current grid (currents.png, baked offline), flight contrails and Cape launches (illustrative),
// and major cities as pulsing red dots. Drawn on a canvas
// above the map and geo-registered every frame with map.project(), so they follow the globe.
(()=>{
const F=window.__FLX,hero=document.getElementById('hero'),host=document.getElementById('globe');
const cv=document.createElement('canvas');cv.className='ovl';cv.setAttribute('aria-hidden','true');host.after(cv);
const x=cv.getContext('2d'),R=Math.random,G='212,175,55',RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
let W=0,H=0,dpr=1,T=0;
function size(){const r=host.getBoundingClientRect();W=r.width;H=r.height;dpr=Math.min(devicePixelRatio||1,2);cv.width=W*dpr;cv.height=H*dpr;if(typeof tcv!=='undefined'&&tcv){tcv.width=cv.width;tcv.height=cv.height}}
addEventListener('resize',size);
function poly(p){const L=[0];for(let i=1;i<p.length;i++)L.push(L[i-1]+Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]));
 return{p,len:L[L.length-1],at(d){d=Math.max(0,Math.min(this.len,d));let i=1;while(i<L.length-1&&L[i]<d)i++;const s=(d-L[i-1])/((L[i]-L[i-1])||1),a=p[i-1],b=p[i];return[a[0]+(b[0]-a[0])*s,a[1]+(b[1]-a[1])*s]}}}
const routes=F.routes.map(poly),m=RM?.5:1;
// ---- Ocean currents: NOAA CoastWatch blended NRT geostrophic currents, 0.25 deg, baked to an 8-bit PNG.
// R=u, G=v mapped from -2..2 m/s; B=255 on ocean cells, 0 on land/no-data. Grid: 281x221, NW cell centre
// (-109.875, 50.125), 0.25 deg step. Particles are advected on the CPU (tiny grid) and drawn as fading trails.
const CW=281,CH=221,LON0=-109.875,LAT0=50.125,ST=.25;let U=null,V=null,M=null;
(()=>{const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=CW;c.height=CH;const g=c.getContext('2d');g.drawImage(im,0,0);
 const d=g.getImageData(0,0,CW,CH).data;U=new Float32Array(CW*CH);V=new Float32Array(CW*CH);M=new Uint8Array(CW*CH);
 for(let i=0;i<CW*CH;i++){M[i]=d[i*4+2]>127;U[i]=d[i*4]/255*4-2;V[i]=d[i*4+1]/255*4-2}};im.src=window.__GBASE+'currents.png?v=20261101'})();
function vel(lon,lat){if(!U)return null;const fx=(lon-LON0)/ST,fy=(LAT0-lat)/ST,x0=Math.floor(fx),y0=Math.floor(fy);
 if(x0<0||y0<0||x0>=CW-1||y0>=CH-1)return null;const tx=fx-x0,ty=fy-y0;let u=0,v=0,w=0;
 for(let j=0;j<2;j++)for(let i=0;i<2;i++){const k=(y0+j)*CW+x0+i;if(!M[k])continue;const q=(i?tx:1-tx)*(j?ty:1-ty);u+=U[k]*q;v+=V[k]*q;w+=q}
 return w>.3?[u/w,v/w]:null}
// water palette: pale sky blue through mid/ocean blue (no gold on the water)
const BL=['207,232,255','164,210,245','120,182,235','78,150,220','52,118,196'];
const NP=Math.round((innerWidth<700?450:1300)*m),P=[];
let tcv=document.createElement('canvas'),tx=tcv.getContext('2d'),lastC=null;
function spawn(q){const map=window.__map,b=map.getBounds();const w=Math.max(LON0,b.getWest()),e=Math.min(LON0+(CW-1)*ST,b.getEast()),s=Math.max(LAT0-(CH-1)*ST,b.getSouth()),n=Math.min(LAT0,b.getNorth());
 for(let t=0;t<8;t++){const lo=w+R()*(e-w),la=s+R()*(n-s);if(vel(lo,la)){q.lo=lo;q.la=la;q.age=0;q.life=4+R()*6;q.px=null;q.c=(R()*BL.length)|0;return}}q.lo=null}
for(let i=0;i<NP;i++)P.push({lo:null,age:0,life:0,px:null});size();
const A=Array.from({length:Math.round(7*m)},()=>{const r=routes[(R()*routes.length)|0];return{r,d:R()*r.len,v:.15+R()*.12}});
// ---- Interstates (Census TIGER primary roads, roads.js): red pulsing lines with traffic dots both ways. Illustrative. ----
const RD=(window.__ROADS||[]).map(r=>poly(r[1])),TR=[];
RD.forEach(r=>{const n=Math.max(1,Math.min(8,Math.round(r.len/(innerWidth<700?1.1:.7))*(RM?.5:1)));for(let i=0;i<n;i++)TR.push({r,d:R()*r.len,dir:i%2?1:-1,v:(RM?.04:.09)*(.7+R()*.6)})});
const C=F.cities.map((c,i)=>({c,ph:(i*.618)%1}));
let L=null,nextL=5;
// ---- Sonar ping: every ~20-45 s one random on-screen NDBC buoy emits 1-2 thin rings that fade over ~2.6 s.
// Clipped to water with the CoastWatch ocean mask (M), so rings vanish over land. Off for reduced motion. ----
const wet=(lo,la)=>{if(!M)return false;const i=Math.round((lo-LON0)/ST),j=Math.round((LAT0-la)/ST);return i>=0&&j>=0&&i<CW&&j<CH&&M[j*CW+i]===1};
let PG=null,nextP=12+R()*15;const PD=2.6,PR=innerWidth<700?.9:1.1,NS=72;
window.__ping=b=>{PG={b:b||null,t0:T,n:1+(R()<.5)}};
window.__ovl=(now,dt)=>{const map=window.__map;if(!map)return;T+=dt;
 const pr=ll=>{const q=map.project(ll);return[q.x,q.y]};
 x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,W,H);x.globalCompositeOperation='lighter';x.lineCap='round';
 // ocean currents: fade the trail layer, advect each particle one step, draw prev->now segment
 const cc=map.getCenter(),cz=map.getZoom(),moved=!lastC||Math.abs(cz-lastC[2])>.002||Math.hypot(cc.lng-lastC[0],cc.lat-lastC[1])>.02;lastC=[cc.lng,cc.lat,cz];
 tx.setTransform(dpr,0,0,dpr,0,0);
 if(moved){tx.clearRect(0,0,W,H);for(const q of P)q.px=null}
 else{tx.globalCompositeOperation='destination-out';tx.fillStyle='rgba(0,0,0,.055)';tx.fillRect(0,0,W,H)}
 tx.globalCompositeOperation='lighter';tx.lineWidth=innerWidth<700?1:1.1;tx.lineCap='round';
 if(U&&dt>0){const K=.0375*dt*10; // slowed again (half of v3)
  for(const q of P){if(q.lo===null||q.age>q.life){spawn(q);if(q.lo===null)continue}
   const vv=vel(q.lo,q.la);if(!vv){q.lo=null;continue}q.age+=dt;
   q.lo+=vv[0]*K/Math.cos(q.la*.01745);q.la+=vv[1]*K;
   const p=map.project([q.lo,q.la]);if(p.x<-20||p.y<-20||p.x>W+20||p.y>H+20){q.lo=null;continue}
   if(q.px){const sp=Math.hypot(vv[0],vv[1]),f=Math.min(1,q.age/.6,(q.life-q.age)/.8);
    // colour: faster water leans paler, each trail keeps a random offset so the blues mix
    const ci=Math.max(0,Math.min(4,Math.round(4-Math.min(1,sp/1.1)*3-q.c*.5+1)));
    tx.strokeStyle=`rgba(${BL[ci]},${(.2+.5*Math.min(1,sp/1.1))*f})`;
    tx.beginPath();tx.moveTo(q.px[0],q.px[1]);tx.lineTo(p.x,p.y);tx.stroke()}
   q.px=[p.x,p.y]}}
 x.setTransform(1,0,0,1,0,0);x.drawImage(tcv,0,0);x.setTransform(dpr,0,0,dpr,0,0);
 // planes with contrails
 for(const p of A){p.d+=p.v*dt;if(p.d>p.r.len){p.r=routes[(R()*routes.length)|0];p.d=0}
  let prev=pr(p.r.at(p.d));const h=prev;for(let i=1;i<=8&&p.d-i*.12>0;i++){const q=pr(p.r.at(p.d-i*.12));
   x.strokeStyle=`rgba(240,232,210,${.3*(1-i/8)})`;x.lineWidth=.8;x.beginPath();x.moveTo(prev[0],prev[1]);x.lineTo(q[0],q[1]);x.stroke();prev=q}
  x.fillStyle='rgba(255,248,230,.9)';x.beginPath();x.arc(h[0],h[1],1.2,0,6.283);x.fill()}
 // Interstates: pulsing red line + glow, then traffic dots moving both directions
 x.globalCompositeOperation='source-over';const rp=RM?.5:.5+.5*Math.sin(T*1.4);
 for(const r of RD){x.beginPath();r.p.forEach((c,i)=>{const q=pr(c);i?x.lineTo(q[0],q[1]):x.moveTo(q[0],q[1])});
  x.strokeStyle=`rgba(255,59,48,${.05+.05*rp})`;x.lineWidth=2.2;x.stroke();x.strokeStyle=`rgba(255,80,64,${.5+.2*rp})`;x.lineWidth=.6;x.stroke()}
 for(const t of TR){t.d+=t.dir*t.v*dt;if(t.d<0)t.d+=t.r.len;if(t.d>t.r.len)t.d-=t.r.len;const a=pr(t.r.at(t.d)),b=pr(t.r.at(t.d-t.dir*.07)),ef=Math.min(1,t.d/.2,(t.r.len-t.d)/.2); // fade at segment ends / state line
  x.strokeStyle=`rgba(255,190,170,${.55*ef})`;x.lineWidth=1;x.beginPath();x.moveTo(b[0],b[1]);x.lineTo(a[0],a[1]);x.stroke()}
 // major cities: warm white-gold pulsing dots, no labels
 x.globalCompositeOperation='source-over';
 for(const o of C){const [cx,cy]=pr(o.c),s=o.c[2],ph=RM?.35:((T/3.6+o.ph)%1),r0=1.6+1.4*s;
  x.strokeStyle=`rgba(255,236,190,${.75*(1-ph)})`;x.lineWidth=1.2;x.beginPath();x.arc(cx,cy,r0+(5+6*s)*ph,0,6.283);x.stroke();
  x.fillStyle='rgba(255,246,222,.98)';x.beginPath();x.arc(cx,cy,r0,0,6.283);x.fill()}
 x.globalCompositeOperation='lighter';
 if(!RM&&M){if(!PG&&T>nextP){PG={b:null,t0:T,n:1+(R()<.5)}}
  if(PG&&!PG.b){const bs=(window.__BUOYS||[]).filter(b=>{const ll=[b.lon??b[1],b.lat??b[2]];if(!wet(ll[0],ll[1]))return false;const q=map.project(ll);return q.x>0&&q.y>0&&q.x<W&&q.y<H});
   if(bs.length){const b=bs[(R()*bs.length)|0];PG.b=[b.lon??b[1],b.lat??b[2]]}else{PG=null;nextP=T+20+R()*25}}
  if(PG&&PG.b){let alive=false;for(let r=0;r<PG.n;r++){const t=(T-PG.t0-r*.7)/PD;if(t<0){alive=true;continue}if(t>1)continue;alive=true;
    const rad=PR*Math.sqrt(t),a=.55*(1-t)*(1-t),cl=Math.cos(PG.b[1]*.01745);x.lineWidth=1;x.strokeStyle=r?`rgba(190,220,255,${a})`:`rgba(230,195,92,${a})`;x.beginPath();let pen=false;
    for(let i=0;i<=NS;i++){const g=i/NS*6.283,lo=PG.b[0]+rad*Math.cos(g)/cl,la=PG.b[1]+rad*Math.sin(g);if(!wet(lo,la)){pen=false;continue}const q=pr([lo,la]);pen?x.lineTo(q[0],q[1]):x.moveTo(q[0],q[1]);pen=true}x.stroke()}
   if(!alive){PG=null;nextP=T+20+R()*25}}}
 // launches from the Cape every ~25 s (vertical rise, pitch over ENE)
 if(!L&&T>nextL){const pd=F.pads[(R()*2)|0];L={t0:T,p:pd,e:[pd[0]+3.2+R(),pd[1]+1.4+R()*.5]}}
 if(L){const t=(T-L.t0)/9;if(t>1.2){L=null;nextL=T+20+R()*10}else{const e=Math.min(1,t),u=1-e,c=[L.p[0]+.1,L.p[1]+1.2];
  x.strokeStyle=`rgba(255,236,180,${.5*(t<1?1:Math.max(0,1-(t-1)*5))})`;x.lineWidth=1.4;x.beginPath();
  for(let i=0;i<=24;i++){const s=e*i/24,v=1-s,q=pr([v*v*L.p[0]+2*v*s*c[0]+s*s*L.e[0],v*v*L.p[1]+2*v*s*c[1]+s*s*L.e[1]]);i?x.lineTo(q[0],q[1]):x.moveTo(q[0],q[1])}x.stroke();
  if(t<1){const q=pr([u*u*L.p[0]+2*u*e*c[0]+e*e*L.e[0],u*u*L.p[1]+2*u*e*c[1]+e*e*L.e[1]]);const g=x.createRadialGradient(q[0],q[1],0,q[0],q[1],7);
   g.addColorStop(0,'rgba(255,250,230,1)');g.addColorStop(1,'rgba(212,175,55,0)');x.fillStyle=g;x.beginPath();x.arc(q[0],q[1],7,0,6.283);x.fill()}}}
 x.globalCompositeOperation='source-over';
 window.__ovlFrames=(window.__ovlFrames||0)+1;
};
})();
