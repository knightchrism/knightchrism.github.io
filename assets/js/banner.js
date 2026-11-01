(()=>{const b=document.getElementById('featbar');if(!b)return;const k='gk-featbar-map-sheets';
try{if(localStorage.getItem(k)==='x'){b.remove();return}}catch(e){}
b.hidden=false;const x=b.querySelector('.featbar-x');
x&&x.addEventListener('click',()=>{b.remove();try{localStorage.setItem(k,'x')}catch(e){}});})();
