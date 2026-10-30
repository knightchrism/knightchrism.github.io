// Florida-hero layers blended onto the globe: Gulf Stream particles, flight contrails, Cape launches,
// city-light twinkle and a gold data-scan sweep. All illustrative (not live data), drawn on a canvas
// above the map and geo-registered every frame with map.project(), so they follow the globe.
(()=>{
const F=window.__FLX,hero=document.getElementById('hero'),host=document.getElementById('globe');
const cv=document.createElement('canvas');cv.className='ovl';cv.setAttribute('aria-hidden','true');host.after(cv);
const x=cv.getContext('2d'),R=Math.random,G='212,175,55',RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
let W=0,H=0,dpr=1,T=0;
function size(){const r=host.getBoundingClientRect();W=r.width;H=r.height;dpr=Math.min(devicePixelRatio||1,2);cv.width=W*dpr;cv.height=H*dpr}
addEventListener('resize',size);size();
function poly(p){const L=[0];for(let i=1;i<p.length;i++)L.push(L[i-1]+Math.hypot(p[i][0]-p[i-1][0],p[i][1]-p[i-1][1]));
 return{p,len:L[L.length-1],at(d){d=Math.max(0,Math.min(this.len,d));let i=1;while(i<L.length-1&&L[i]<d)i++;const s=(d-L[i-1])/((L[i]-L[i-1])||1),a=p[i-1],b=p[i];return[a[0]+(b[0]-a[0])*s,a[1]+(b[1]-a[1])*s]}}}
const cur=poly(F.current),routes=F.routes.map(poly),m=RM?.5:1;
const P=Array.from({length:Math.round(140*m)},()=>({d:R()*cur.len,n:(R()+R()-1)*.35,v:.04+R()*.05}));
const A=Array.from({length:Math.round(7*m)},()=>{const r=routes[(R()*routes.length)|0];return{r,d:R()*r.len,v:.15+R()*.12}});
const C=F.cities.map(c=>({c,ph:R()*6.28}));
let L=null,nextL=5;
window.__ovl=(now,dt)=>{const map=window.__map;if(!map)return;T+=dt;
 const pr=ll=>{const q=map.project(ll);return[q.x,q.y]};
 x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,W,H);x.globalCompositeOperation='lighter';x.lineCap='round';
 // Gulf Stream particles (short gold dashes along the current)
 x.lineWidth=1;for(const q of P){q.d=(q.d+q.v*dt*10)%cur.len;const a=cur.at(q.d),b=cur.at(q.d+.12);
  const o=q.n,p1=pr([a[0]+o,a[1]]),p2=pr([b[0]+o,b[1]]),f=Math.min(1,q.d/.6,(cur.len-q.d)/.8);
  x.strokeStyle=`rgba(${G},${.42*f})`;x.beginPath();x.moveTo(p1[0],p1[1]);x.lineTo(p2[0],p2[1]);x.stroke()}
 // planes with contrails
 for(const p of A){p.d+=p.v*dt;if(p.d>p.r.len){p.r=routes[(R()*routes.length)|0];p.d=0}
  let prev=pr(p.r.at(p.d));const h=prev;for(let i=1;i<=8&&p.d-i*.12>0;i++){const q=pr(p.r.at(p.d-i*.12));
   x.strokeStyle=`rgba(240,232,210,${.3*(1-i/8)})`;x.lineWidth=.8;x.beginPath();x.moveTo(prev[0],prev[1]);x.lineTo(q[0],q[1]);x.stroke();prev=q}
  x.fillStyle='rgba(255,248,230,.9)';x.beginPath();x.arc(h[0],h[1],1.2,0,6.283);x.fill()}
 // city lights twinkle (soft gold halos over the night-lights texture)
 for(const o of C){const [cx,cy]=pr(o.c),s=o.c[2],tw=.55+.45*Math.sin(T*1.3+o.ph)*Math.sin(T*.7+o.ph*2),r=3+5*s;
  const g=x.createRadialGradient(cx,cy,0,cx,cy,r);g.addColorStop(0,`rgba(255,236,190,${.5*tw})`);g.addColorStop(1,`rgba(${G},0)`);x.fillStyle=g;x.beginPath();x.arc(cx,cy,r,0,6.283);x.fill()}
 // launches from the Cape every ~25 s (vertical rise, pitch over ENE)
 if(!L&&T>nextL){const pd=F.pads[(R()*2)|0];L={t0:T,p:pd,e:[pd[0]+3.2+R(),pd[1]+1.4+R()*.5]}}
 if(L){const t=(T-L.t0)/9;if(t>1.2){L=null;nextL=T+20+R()*10}else{const e=Math.min(1,t),u=1-e,c=[L.p[0]+.1,L.p[1]+1.2];
  x.strokeStyle=`rgba(255,236,180,${.5*(t<1?1:Math.max(0,1-(t-1)*5))})`;x.lineWidth=1.4;x.beginPath();
  for(let i=0;i<=24;i++){const s=e*i/24,v=1-s,q=pr([v*v*L.p[0]+2*v*s*c[0]+s*s*L.e[0],v*v*L.p[1]+2*v*s*c[1]+s*s*L.e[1]]);i?x.lineTo(q[0],q[1]):x.moveTo(q[0],q[1])}x.stroke();
  if(t<1){const q=pr([u*u*L.p[0]+2*u*e*c[0]+e*e*L.e[0],u*u*L.p[1]+2*u*e*c[1]+e*e*L.e[1]]);const g=x.createRadialGradient(q[0],q[1],0,q[0],q[1],7);
   g.addColorStop(0,'rgba(255,250,230,1)');g.addColorStop(1,'rgba(212,175,55,0)');x.fillStyle=g;x.beginPath();x.arc(q[0],q[1],7,0,6.283);x.fill()}}}
 // gold data-scan sweep across the peninsula every ~15 s (illustrative)
 const per=RM?22:15,ph=(T%per)/per;if(ph<.45){const s=ph/.45,lo=-87.7+(-79.9+87.7)*s;
  for(let k=0;k<6;k++){const l=lo-k*.18,a=pr([l,24.4]),b=pr([l,31.1]);x.strokeStyle=`rgba(240,215,140,${(k?.07:.4)*(1-k/6)*Math.sin(Math.PI*s)})`;x.lineWidth=k?6:1;
   x.beginPath();x.moveTo(a[0],a[1]);x.lineTo(b[0],b[1]);x.stroke()}}
 x.globalCompositeOperation='source-over';
 window.__ovlFrames=(window.__ovlFrames||0)+1;
};
})();
