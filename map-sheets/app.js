/* GeoKnight GIS map-sheet live demo. Talks to the rustgis-label sheet service (see config.js). */
(function () {
  "use strict";
  var C = window.GK_SHEETS || {}, API = (C.API_BASE || "").replace(/\/$/, "");
  var $ = function (id) { return document.getElementById(id); };
  var map, quad, pick = null, busy = false;

  function status(t, err) { var s = $("ms-status"); s.textContent = t; s.className = "ms-status small" + (err ? " err" : ""); }
  function fetchT(url, opt, ms) {
    var ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, ms || 15000);
    opt = opt || {}; opt.signal = ctl.signal;
    return fetch(url, opt).finally(function () { clearTimeout(t); });
  }
  function apiErr(r) {
    return r.json().catch(function () { return {}; }).then(function (b) {
      var d = b && b.detail; throw new Error(typeof d === "string" ? d : "service error " + r.status);
    });
  }
  function offline() {
    $("ms-offline").hidden = false;
    document.querySelector(".ms-live").classList.add("off");
    $("ms-go").disabled = true;
    document.querySelectorAll("#ms-search input, #ms-search button").forEach(function (e) { e.disabled = true; });
  }

  // map
  map = L.map("ms-map", { minZoom: 3, maxBounds: [[10, -140], [60, -50]] }).setView([38.5, -96], 4);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 15, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  map.on("click", function (e) {
    if (busy) return;
    var lat = +e.latlng.lat.toFixed(5), lon = +e.latlng.lng.toFixed(5);
    fetchT(API + "/api/locate?lat=" + lat + "&lon=" + lon).then(function (r) { return r.ok ? r.json() : apiErr(r); })
      .then(function (q) {
        pick = { lat: lat, lon: lon };
        if (quad) map.removeLayer(quad);
        quad = L.rectangle([[q.south, q.west], [q.north, q.east]], { color: "#c9a227", weight: 2, fillOpacity: .12 }).addTo(map);
        $("ms-pick").textContent = "Sheet " + q.id + " · " + lat + ", " + lon + " · UTM zone " + q.utm_zone;
        $("ms-go").disabled = false; status("");
      }).catch(function (err) { pick = null; $("ms-go").disabled = true; status(err.message === "Failed to fetch" ? "Service unreachable." : err.message, true); });
  });

  function start(body) {
    busy = true; $("ms-go").disabled = true; $("ms-result").hidden = true; $("ms-log").hidden = true;
    status("Sending request…");
    fetchT(API + "/api/sheets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.ok ? r.json() : apiErr(r); })
      .then(poll).catch(fail);
  }
  function poll(j) {
    if (j.status === "done") return done(j);
    if (j.status === "failed") return fail(new Error(j.error || "sheet build failed"));
    var t0 = j.started ? Math.round(Date.now() / 1000 - j.started) : 0;
    status(j.status === "queued" ? "Queued" + (j.position ? " (position " + j.position + ")" : "") + "…"
                                 : "Building " + (j.sheet_id || "sheet") + "… " + t0 + " s");
    if (j.log_tail && j.log_tail.length) { var l = $("ms-log"); l.hidden = false; l.textContent = j.log_tail.slice(-6).join("\n"); }
    setTimeout(function () {
      fetchT(API + "/api/jobs/" + encodeURIComponent(j.id)).then(function (r) { return r.ok ? r.json() : apiErr(r); }).then(poll).catch(fail);
    }, C.POLL_MS || 3000);
  }
  function done(j) {
    busy = false; $("ms-go").disabled = !pick; $("ms-log").hidden = true;
    var base = API + "/api/sheets/" + encodeURIComponent(j.sheet_id);
    status("Ready: " + j.sheet_id + (j.title ? " · " + j.title : "") + (j.cached ? " (already built)" : ""));
    $("ms-img").src = base + ".png"; $("ms-png").href = base + ".png"; $("ms-pnglink").href = base + ".png";
    $("ms-pdf").href = base + ".pdf"; $("ms-result").hidden = false;
  }
  function fail(err) { busy = false; $("ms-go").disabled = !pick; status(err.message === "Failed to fetch" ? "Service unreachable." : err.message, true); }

  $("ms-go").addEventListener("click", function () { if (pick && !busy) start(pick); });
  $("ms-search").addEventListener("submit", function (e) {
    e.preventDefault(); var p = $("ms-place").value.trim(); if (p && !busy) start({ place: p });
  });

  fetchT(API + "/api/health", {}, C.HEALTH_TIMEOUT_MS || 3000)
    .then(function (r) { if (!r.ok) throw new Error(); status("Service online. Pick a point or search."); })
    .catch(offline);
})();
