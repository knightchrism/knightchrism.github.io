(function(){
'use strict';
var LABEL={have_data:'Have data',source_found:'Source found',not_checked:'Not yet checked'};
function $(id){return document.getElementById(id);}
function fmt(n){return Number(n).toLocaleString('en-US');}
function yr(s){var m=/^(\d{4})/.exec(s||'');return m?+m[1]:null;}
function fmtDate(s){var d=new Date(s+'T12:00:00');return isNaN(d)?s:d.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});}
function status(c){return c&&LABEL[c.status]?c.status:'not_checked';}
Promise.all([
 fetch('data/coverage.json',{cache:'no-cache'}).then(function(r){if(!r.ok)throw new Error('coverage.json '+r.status);return r.json();}),
 fetch('assets/coverage/florida-counties.svg').then(function(r){if(!r.ok)throw new Error('svg '+r.status);return r.text();})
]).then(function(res){
 var data=res[0]||{},counties=data.counties||{};
 var holder=$('cov-svg');
 var doc=new DOMParser().parseFromString(res[1],'image/svg+xml');
 var svg=document.importNode(doc.documentElement,true);
 holder.appendChild(svg);
 $('cov-updated').textContent=data.last_updated?fmtDate(data.last_updated):'unknown';
 var tot={counties:0,parcels:0,permits:0,y0:null,y1:null},cnt={have_data:0,source_found:0,not_checked:0};
 var paths=svg.querySelectorAll('path[data-name]');
 Array.prototype.forEach.call(paths,function(p){
  var c=counties[p.getAttribute('data-name')],s=status(c);
  p.setAttribute('class',s);p.setAttribute('data-status',s);p.setAttribute('tabindex','0');
  p.setAttribute('aria-label',p.getAttribute('data-name')+' County: '+LABEL[s]);
  cnt[s]++;
  if(s==='have_data'){
   tot.counties++;tot.parcels+=+c.parcels||0;tot.permits+=+c.roof_permits||0;
   var a=yr(c.permit_start),b=yr(c.permit_end);
   if(a&&(tot.y0===null||a<tot.y0))tot.y0=a;if(b&&(tot.y1===null||b>tot.y1))tot.y1=b;
  }
 });
 $('cov-counties').textContent=fmt(tot.counties);
 $('cov-parcels').textContent=fmt(tot.parcels);
 $('cov-permits').textContent=fmt(tot.permits);
 $('cov-years').textContent=tot.y0?(tot.y0===tot.y1?String(tot.y0):tot.y0+'–'+tot.y1):'–';
 Object.keys(cnt).forEach(function(k){$('cov-n-'+k).textContent='('+cnt[k]+')';});
 var tip=$('cov-tip'),fig=$('cov-map'),cur=null;
 function show(p,x,y){
  var n=p.getAttribute('data-name'),c=counties[n],s=status(c);
  tip.textContent='';
  var h=document.createElement('b');h.textContent=n+' County';tip.appendChild(h);
  var lines=[LABEL[s]];
  if(c&&s==='have_data'){
   if(c.parcels!=null)lines.push(fmt(c.parcels)+' parcels');
   if(c.roof_permits!=null)lines.push(fmt(c.roof_permits)+' roof permits');
   if(c.years)lines.push('Years: '+c.years);
   if(c.match_rate!=null)lines.push((c.match_rate*100).toFixed(1)+'% matched to parcels');
  }
  lines.forEach(function(t){var d=document.createElement('div');d.textContent=t;tip.appendChild(d);});
  tip.hidden=false;
  var fr=fig.getBoundingClientRect(),tw=tip.offsetWidth,th=tip.offsetHeight;
  var lx=Math.min(Math.max(x-fr.left+12,4),fr.width-tw-4),ly=y-fr.top+12;
  if(ly+th>fr.height-4)ly=Math.max(4,y-fr.top-th-12);
  tip.style.left=lx+'px';tip.style.top=ly+'px';
  if(cur&&cur!==p)cur.classList.remove('on');cur=p;p.classList.add('on');
 }
 function hide(){tip.hidden=true;if(cur){cur.classList.remove('on');cur=null;}}
 svg.addEventListener('pointermove',function(e){if(e.target.getAttribute&&e.target.getAttribute('data-name'))show(e.target,e.clientX,e.clientY);});
 svg.addEventListener('pointerleave',function(e){if(e.pointerType==='mouse')hide();});
 svg.addEventListener('click',function(e){var t=e.target;if(t.getAttribute&&t.getAttribute('data-name'))show(t,e.clientX,e.clientY);else hide();});
 svg.addEventListener('focusin',function(e){var r=e.target.getBoundingClientRect();show(e.target,r.left+r.width/2,r.top+r.height/2);});
 svg.addEventListener('focusout',hide);
 document.addEventListener('click',function(e){if(!fig.contains(e.target))hide();});
}).catch(function(err){
 var u=$('cov-updated');if(u)u.textContent='unavailable';
 var h=$('cov-svg');if(h)h.textContent='Coverage data could not be loaded. Please try again later.';
});
})();
