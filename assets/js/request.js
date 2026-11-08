// Preselect a service from ?plan= without treating an unknown value as the first service.
(function () {
  var SERVICES = {
    "custom maps & dashboards": "Custom maps & dashboards",
    "data preparation & automation": "Data preparation & automation",
    "managed hosting & maintenance": "Managed hosting & maintenance"
  };
  var LEGACY = {
    "starter map": "Custom maps & dashboards",
    "custom dashboard": "Custom maps & dashboards",
    "custom dashboard or tool": "Custom maps & dashboards",
    "data pipelines": "Data preparation & automation",
    "integrations": "Data preparation & automation",
    "hosting only": "Managed hosting & maintenance"
  };
  var LEGACY_LABEL = {
    "starter map": "Starter map",
    "custom dashboard": "Custom dashboard",
    "custom dashboard or tool": "Custom dashboard",
    "data pipelines": "Data pipelines",
    "integrations": "Integrations",
    "hosting only": "Hosting only"
  };
  var GLOBES = [
    "Roof Globe",
    "Flood & Risk Globe",
    "Permits Globe",
    "Neighborhood Score Globe",
    "Single Globe",
    "Advanced Globes"
  ];
  var select = document.getElementById("plan");
  var note = document.getElementById("plan-note");
  var requested = document.getElementById("requested-item");
  if (!select) return;

  function show(text) {
    if (requested) requested.value = text || "";
    if (!note) return;
    if (!text) {
      note.textContent = "";
      note.hidden = true;
      return;
    }
    note.textContent = text;
    note.hidden = false;
  }

  function choose(name) {
    var want = name.toLowerCase();
    for (var i = 0; i < select.options.length; i++) {
      if (select.options[i].value !== "" && select.options[i].text.toLowerCase() === want) {
        select.selectedIndex = i;
        return true;
      }
    }
    select.selectedIndex = 0;
    return false;
  }

  function plain(value) {
    return String(value).replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  }

  var raw = new URLSearchParams(location.search).get("plan");
  if (raw == null) return;
  var key = plain(raw).toLowerCase();
  if (!key) return;

  if (SERVICES[key]) {
    choose(SERVICES[key]);
    return;
  }
  if (LEGACY[key]) {
    choose(LEGACY[key]);
    show("Earlier link: " + LEGACY_LABEL[key]);
    return;
  }
  if (key === "custom quote") {
    select.selectedIndex = 0;
    show("General inquiry. Choose a service if one fits, or leave Select a service.");
    if (requested) requested.value = "General inquiry";
    return;
  }
  for (var g = 0; g < GLOBES.length; g++) {
    if (GLOBES[g].toLowerCase() === key) {
      choose("Custom maps & dashboards");
      show("Requested: " + GLOBES[g]);
      return;
    }
  }
  select.selectedIndex = 0;
  var shown = plain(raw);
  if (shown.length > 180) shown = shown.slice(0, 180) + "…";
  show(shown ? "Requested: " + shown : "");
})();
