/* GeoKnight GIS page theme module (globes.html).
 * One source of truth: GKTheme.getTheme() / GKTheme.setTheme(name).
 * Today the choice is stored in localStorage ('gk-theme').
 * ACCOUNT HOOK: once login/account settings exist, call
 *   GKTheme.syncFromAccount(prefs)   // after loading the user's settings, e.g. {theme:'navy'}
 * and set GKTheme.onChange = function(theme){ ... save to the account settings API ... }
 * so the user's choice follows them across devices. */
(function(){
  var KEY='gk-theme', THEMES=['black','navy','gradient','light'], DEF='black';
  function valid(t){return THEMES.indexOf(t)>=0;}
  function stored(){try{return localStorage.getItem(KEY);}catch(e){return null;}}
  function getTheme(){var t=document.documentElement.getAttribute('data-theme');return valid(t)?t:(valid(stored())?stored():DEF);}
  function apply(t){document.documentElement.setAttribute('data-theme',t);
    var b=document.querySelectorAll('[data-set-theme]');for(var i=0;i<b.length;i++)b[i].setAttribute('aria-pressed',String(b[i].getAttribute('data-set-theme')===t));}
  function setTheme(t,opts){if(!valid(t))t=DEF;apply(t);try{localStorage.setItem(KEY,t);}catch(e){}
    if(!(opts&&opts.silent)&&typeof api.onChange==='function')api.onChange(t);return t;}
  /* Account hook: apply the theme from account prefs without echoing it back to the API. */
  function syncFromAccount(prefs){if(prefs&&valid(prefs.theme))setTheme(prefs.theme,{silent:true});return getTheme();}
  var api={THEMES:THEMES,getTheme:getTheme,setTheme:setTheme,syncFromAccount:syncFromAccount,onChange:null};
  window.GKTheme=api;
  var q=(location.search.match(/[?&]theme=([a-z]+)/)||[])[1];
  apply(valid(q)?q:getTheme());
  document.addEventListener('DOMContentLoaded',function(){apply(getTheme());
    document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-set-theme]');if(b)setTheme(b.getAttribute('data-set-theme'));});});
})();
