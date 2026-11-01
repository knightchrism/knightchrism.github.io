(function(){
  var STEPS=["Request","Discovery call","Fixed quote","50% deposit","Build & review","Delivery"];
  var $=function(i){return document.getElementById(i)};
  var money=function(v){return typeof v==="number"?"$"+v.toLocaleString("en-US"):String(v)};
  var txt=function(i,v){$(i).textContent=v==null?"":v};
  var fail=function(){$("q-error").hidden=false};
  var id=new URLSearchParams(location.search).get("q")||"";
  if(!/^[a-f0-9]{24,64}$/.test(id)){fail();return}
  fetch("data/"+id+".json",{cache:"no-store"}).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(q){
    document.title=(q.sample?"Sample quote":"Quote "+q.number)+" | GeoKnight GIS";
    $("q-sample").hidden=!q.sample;
    txt("q-tier",q.tier);txt("q-title",q.title);txt("q-intro",q.intro);txt("q-no",q.number);txt("q-client",q.client);
    txt("q-issued",q.issued);txt("q-valid",q.valid_until);txt("q-time",q.timeline);
    if(q.pdf){$("q-pdf").href=q.pdf}else{$("q-pdf").hidden=true}
    var t=$("q-items");
    (q.items||[]).forEach(function(it,n){
      var row=document.createElement("div");row.className="qrow";row.setAttribute("role","row");
      var a=document.createElement("span");a.className="qn";a.textContent=String(n+1).padStart(2,"0");
      var b=document.createElement("div");b.className="qd";
      var h=document.createElement("b");h.textContent=it.title;var p=document.createElement("span");p.textContent=it.desc||"";b.append(h,p);
      var c=document.createElement("span");c.className="qw";c.textContent=it.when||"";
      var d=document.createElement("span");d.className="qa";d.textContent=money(it.amount);
      row.append(a,b,c,d);t.append(row);
    });
    txt("q-total",money(q.total));txt("q-dep",money(q.deposit));txt("q-bal",money(q.balance));
    var list=function(el,arr){(arr||[]).forEach(function(s){var li=document.createElement("li");li.textContent=s;el.append(li)})};
    if(q.hosting){$("q-host").hidden=false;txt("q-host-l",q.hosting.label);txt("q-host-p",q.hosting.price);list($("q-host-n"),q.hosting.notes)}
    list($("q-terms"),q.terms);
    var cur=Math.max(1,Math.min(6,parseInt(q.status,10)||1)),ol=$("q-steps");
    STEPS.forEach(function(s,i){
      var n=i+1,li=document.createElement("li");
      li.className=n<cur?"done":n===cur?"current":"todo";
      if(n===cur)li.setAttribute("aria-current","step");
      var dot=document.createElement("span");dot.className="dot";dot.textContent=n<cur?"✓":n;
      var lb=document.createElement("span");lb.className="lbl";lb.textContent=s;
      var st=document.createElement("span");st.className="sr";st.textContent=n<cur?" (done)":n===cur?" (current)":"";
      lb.append(st);li.append(dot,lb);ol.append(li);
    });
    txt("q-upd",q.updated);
    if(q.note){$("q-note").hidden=false;txt("q-note",q.note)}
    $("q").hidden=false;
  }).catch(fail);
})();
