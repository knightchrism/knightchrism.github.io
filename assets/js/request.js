// Preselect the plan from ?plan=... (e.g. request.html?plan=Custom%20dashboard)
(function(){var p=new URLSearchParams(location.search).get("plan");var s=document.getElementById("plan");
if(!p||!s)return;for(var i=0;i<s.options.length;i++){if(s.options[i].text.toLowerCase()===p.toLowerCase()){s.selectedIndex=i;break}}})();
