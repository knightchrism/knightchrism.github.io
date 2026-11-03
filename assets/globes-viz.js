/* Globes hero visual: animated KPI counters (synthetic sample data only). */
(function(){
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  function fmt(n){return n.toLocaleString('en-US');}
  function run(){
    var els=document.querySelectorAll('.gviz [data-count]');
    for(var i=0;i<els.length;i++)(function(el){
      var to=+el.getAttribute('data-count');
      if(reduce){el.textContent=fmt(to);return;}
      var t0=null,dur=1600;
      function step(t){if(!t0)t0=t;var p=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-p,3);el.textContent=fmt(Math.round(to*e));if(p<1)requestAnimationFrame(step);}
      requestAnimationFrame(step);
    })(els[i]);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
})();
