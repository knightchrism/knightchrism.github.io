(function () {
  const T = window.ExcelMapTable;
  const geocoder = window.ExcelMapGeocode.createGeocoder({ enabled: false });
  const provider = window.ExcelMapGeocode.PROVIDER;
  const state = { headers: [], rows: [], settings: null, columnMap: null, mode: "coordinates", fileName: "" };
  const markers = new Map();
  let drawGen = 0;
  let layer = null;
  let map = null;

  const el = function (id) { return document.getElementById(id); };
  const status = el("status");
  const fname = el("fname");

  function setPressed(selector, attr, value) {
    document.querySelectorAll(selector).forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.getAttribute(attr) === value));
    });
  }

  function fillSelect(select, headers, current) {
    select.replaceChildren();
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "(none)";
    select.append(blank);
    headers.forEach(function (header) {
      const option = document.createElement("option");
      option.value = header;
      option.textContent = header;
      select.append(option);
    });
    select.value = current && headers.indexOf(current) >= 0 ? current : "";
  }

  function syncControls() {
    const settings = state.settings || T.defaultSettings(state.headers);
    setPressed("[data-shape]", "data-shape", settings.shape);
    setPressed("[data-color]", "data-color", settings.colorMode);
    setPressed("[data-size]", "data-size", settings.sizeMode);
    setPressed("[data-label]", "data-label", settings.labelMode);
    el("coord-mode").setAttribute("aria-pressed", String(state.mode === "coordinates"));
    fillSelect(el("color-field"), state.headers, settings.colorField);
    fillSelect(el("size-field"), state.headers, settings.sizeField);
    fillSelect(el("label-field"), state.headers, settings.labelField);
    const filter = el("filter-field");
    fillSelect(filter, state.headers, settings.filterField);
    const popups = el("popups");
    popups.replaceChildren();
    state.headers.forEach(function (header) {
      const label = document.createElement("label");
      const box = document.createElement("input");
      box.type = "checkbox";
      box.value = header;
      box.checked = settings.popupFields.indexOf(header) >= 0;
      box.addEventListener("change", function () {
        state.settings.popupFields = Array.from(popups.querySelectorAll("input:checked")).map(function (input) { return input.value; });
        draw(false);
      });
      label.append(box, document.createTextNode(" " + header));
      popups.append(label);
    });
    refreshFilterValues();
  }

  function refreshFilterValues() {
    const field = state.settings && state.settings.filterField;
    const select = el("filter-value");
    const current = select.value || "(all)";
    select.replaceChildren();
    const all = document.createElement("option");
    all.value = "(all)";
    all.textContent = "All";
    select.append(all);
    if (field) {
      T.categoriesOf(state.rows, field).forEach(function (value) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value || "(blank)";
        select.append(option);
      });
    }
    select.value = Array.from(select.options).some(function (option) { return option.value === current; }) ? current : "(all)";
  }

  function popupNode(row, issue) {
    const wrap = document.createElement("div");
    const fields = state.settings.popupFields.length ? state.settings.popupFields : state.headers.slice(0, 1);
    fields.forEach(function (field) {
      const p = document.createElement("p");
      const name = document.createElement("b");
      name.textContent = field;
      p.append(name, document.createTextNode(": " + T.cellToString(row.values[field])));
      wrap.append(p);
    });
    if (issue) {
      const extra = document.createElement("p");
      extra.textContent = issue;
      wrap.append(extra);
    }
    if (row.reason) {
      const note = document.createElement("p");
      note.textContent = row.reason;
      wrap.append(note);
    }
    return wrap;
  }

  function addMarker(row, scale, categories) {
    const settings = state.settings;
    const category = settings.colorMode === "category" && settings.colorField ? T.cellToString(row.values[settings.colorField]).trim() : "";
    const color = settings.colorMode === "category" ? T.colorFor(category, categories) : "#0b1f3a";
    const sized = settings.sizeMode === "number" && settings.sizeField ? scale(row.values[settings.sizeField]) : { px: 10, issue: "" };
    const px = sized.px || 10;
    let marker;
    if (settings.shape === "circle") {
      marker = L.circleMarker([row.lat, row.lon], { radius: px, color: color, weight: 1, fillColor: color, fillOpacity: 0.9 });
    } else if (settings.shape === "square") {
      const side = px * 2;
      const icon = L.divIcon({
        className: "pin",
        iconSize: [side, side],
        iconAnchor: [side / 2, side / 2],
        html: '<svg xmlns="http://www.w3.org/2000/svg" width="' + side + '" height="' + side + '" viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" fill="' + color + '"/></svg>'
      });
      marker = L.marker([row.lat, row.lon], { icon: icon });
    } else {
      const w = px * 2;
      const h = px * 2 + 8;
      const icon = L.divIcon({
        className: "pin",
        iconSize: [w, h],
        iconAnchor: [w / 2, h],
        html: '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 24 36" aria-hidden="true"><path fill="' + color + '" d="M12 36 L0 14 A12 12 0 1 1 24 14 Z"/></svg>'
      });
      marker = L.marker([row.lat, row.lon], { icon: icon });
    }
    marker.bindPopup(popupNode(row, sized.issue));
    if (settings.labelMode === "field" && settings.labelField) {
      const tip = document.createElement("span");
      tip.textContent = T.cellToString(row.values[settings.labelField]);
      marker.bindTooltip(tip, { permanent: true, direction: "top", className: "e2m-label", opacity: 1 });
    }
    marker.addTo(layer);
    markers.set(row.id, marker);
  }

  function draw(fit) {
    const gen = ++drawGen;
    markers.clear();
    if (layer) layer.clearLayers();
    const shown = state.rows.length ? T.filterRows(state.rows, el("search").value, state.settings.filterField, el("filter-value").value) : [];
    el("empty").hidden = state.rows.length > 0;
    const categories = T.categoriesOf(state.rows, state.settings && state.settings.colorField);
    const scale = state.settings && state.settings.sizeField ? T.sizeScale(state.rows, state.settings.sizeField) : function () { return { px: 10, issue: "" }; };
    const legend = el("legend");
    legend.replaceChildren();
    if (state.settings && state.settings.colorMode === "category" && state.settings.colorField) {
      legend.hidden = false;
      categories.forEach(function (category) {
        const line = document.createElement("div");
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", "12");
        svg.setAttribute("height", "12");
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("width", "12");
        rect.setAttribute("height", "12");
        rect.setAttribute("fill", T.colorFor(category, categories));
        svg.append(rect);
        line.append(svg, document.createTextNode(" " + (category || "(blank)")));
        legend.append(line);
      });
    } else legend.hidden = true;
    if (fit && shown.length && map) {
      const bounds = L.latLngBounds(shown.map(function (row) { return [row.lat, row.lon]; }));
      map.fitBounds(bounds.pad(0.2), { maxZoom: 14 });
    }
    let index = 0;
    function step() {
      if (gen !== drawGen) return;
      const end = Math.min(index + 80, shown.length);
      for (; index < end; index += 1) addMarker(shown[index], scale, categories);
      if (index < shown.length) requestAnimationFrame(step);
    }
    step();
    renderReview();
    const mapped = state.rows.filter(function (row) { return row.onMap; }).length;
    const review = state.rows.filter(function (row) { return row.review; }).length;
    if (state.rows.length) {
      status.textContent = state.fileName + ": " + state.rows.length + " rows, " + mapped + " on the map, " + review + " in review. " + (state.mode === "coordinates" ? "Plotted from latitude and longitude in the file." : "Address lookup is off, so these rows are not on the map.");
    }
  }

  function renderReview() {
    const list = el("review-list");
    const items = state.rows.filter(function (row) { return row.review; });
    el("review-count").textContent = items.length ? items.length + " rows need review. None were dropped." : "No rows need review.";
    list.replaceChildren();
    items.forEach(function (row) {
      const li = document.createElement("li");
      const text = document.createElement("span");
      const label = row.values[state.settings.labelField] || row.values[state.headers[0]] || row.id;
      text.textContent = T.cellToString(label) + " — " + row.reason;
      li.append(text);
      if (row.onMap) {
        const show = document.createElement("button");
        show.type = "button";
        show.textContent = "Show";
        show.addEventListener("click", function () {
          const marker = markers.get(row.id);
          if (!marker) return;
          map.panTo(marker.getLatLng());
          marker.openPopup();
        });
        li.append(show);
      }
      list.append(li);
    });
  }

  function applyTable(table, detection, fileName, replaced) {
    state.headers = table.headers;
    state.fileName = fileName;
    fname.textContent = fileName + " — kept in this browser only";
    const previous = replaced ? state.settings : null;
    state.columnMap = {
      id: detection.roles.id || null,
      lat: detection.roles.lat || null,
      lon: detection.roles.lon || null,
      street: detection.roles.street || null,
      city: detection.roles.city || null,
      state: detection.roles.state || null,
      zip: detection.roles.zip || null
    };
    state.mode = detection.coordinatesConfident ? "coordinates" : "address";
    state.settings = T.mergeSettings(previous, table.headers);
    const built = T.buildRows(table, state.columnMap, state.mode);
    state.rows = built.rows;
    syncControls();
    draw(true);
    if (replaced) status.textContent += " Style settings were kept where the column names still match.";
  }

  function askColumns(table, detection) {
    const box = el("column-fields");
    box.replaceChildren();
    const roles = ["lat", "lon", "street", "city", "state", "zip", "id"];
    const selects = {};
    roles.forEach(function (role) {
      const label = document.createElement("label");
      label.textContent = role + " ";
      const select = document.createElement("select");
      fillSelect(select, table.headers, detection.roles[role] || (state.columnMap && state.columnMap[role]) || "");
      label.append(select);
      box.append(label);
      selects[role] = select;
    });
    el("column-error").textContent = detection.uncertain.map(function (item) { return item.reason; }).join(" ");
    const dialog = el("columns");
    dialog.showModal();
    return new Promise(function (resolve) {
      function finish(ok) {
        dialog.close();
        el("column-ok").removeEventListener("click", onOk);
        el("column-cancel").removeEventListener("click", onCancel);
        if (!ok) return resolve(null);
        const map = {};
        roles.forEach(function (role) { map[role] = selects[role].value || null; });
        if (!(map.lat && map.lon) && !map.street) {
          el("column-error").textContent = "Choose latitude and longitude, or a street column.";
          return askColumns(table, detection).then(resolve);
        }
        detection.roles = Object.assign({}, detection.roles, map);
        detection.coordinatesConfident = !!(map.lat && map.lon);
        detection.addressConfident = !!map.street;
        resolve(detection);
      }
      function onOk() {
        const map = {};
        roles.forEach(function (role) { map[role] = selects[role].value || null; });
        if (!(map.lat && map.lon) && !map.street) {
          el("column-error").textContent = "Choose latitude and longitude, or a street column.";
          return;
        }
        finish(true);
      }
      function onCancel() { finish(false); }
      el("column-ok").addEventListener("click", onOk);
      el("column-cancel").addEventListener("click", onCancel);
    });
  }

  async function useTable(table, fileName) {
    let detection = T.detectColumns(table.headers, table.records);
    const replaced = state.headers.length > 0;
    if (detection.ask) {
      detection = await askColumns(table, detection);
      if (!detection) {
        status.textContent = "No columns chosen. The previous file, if any, is still loaded.";
        return;
      }
    }
    applyTable(table, detection, fileName, replaced);
  }

  function tableFromMatrix(matrix) {
    return T.matrixToTable(matrix);
  }

  async function loadBytes(name, bytes) {
    if (bytes.byteLength > T.LIMITS.maxBytes) {
      status.textContent = "This file is over 2 MB. Nothing was loaded.";
      return;
    }
    const lower = name.toLowerCase();
    try {
      if (lower.endsWith(".csv")) {
        const text = new TextDecoder("utf-8").decode(bytes);
        await useTable(tableFromMatrix(window.ExcelMapCsv.parseCsv(text)), name);
      } else if (lower.endsWith(".xlsx")) {
        const read = window.ExcelMapFiles.readMatrix(window.XLSX, bytes);
        await useTable(tableFromMatrix(read.matrix), name + " (" + read.sheetName + ")");
      } else {
        status.textContent = "This demo reads .xlsx and .csv files.";
      }
    } catch (err) {
      status.textContent = err && err.message ? err.message : "The file could not be read.";
    }
  }

  function showAddressDialog() {
    el("address-reason").textContent = provider.reason;
    el("address-setup").textContent = provider.setup + " Cost: " + provider.cost;
    el("address").showModal();
  }

  el("file").addEventListener("change", function (event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () { loadBytes(file.name, reader.result); };
    reader.readAsArrayBuffer(file);
    event.target.value = "";
  });

  el("sample").addEventListener("click", function () {
    fetch("sample/sample-facilities.csv").then(function (response) { return response.arrayBuffer(); }).then(function (bytes) {
      return loadBytes("sample-facilities.csv", bytes);
    }).catch(function () { status.textContent = "The sample file did not load."; });
  });

  el("coord-mode").addEventListener("click", function () {
    if (!state.columnMap || !state.columnMap.lat || !state.columnMap.lon) {
      status.textContent = "This file has no latitude and longitude columns selected.";
      return;
    }
    state.mode = "coordinates";
    const built = T.buildRows({ headers: state.headers, records: state.rows.map(function (row) { return { sourceRow: row.sourceRow, values: row.values }; }) }, state.columnMap, "coordinates");
    state.rows = built.rows;
    draw(true);
  });

  el("address-mode").addEventListener("click", showAddressDialog);
  el("address-close").addEventListener("click", function () { el("address").close(); });

  document.querySelectorAll("[data-shape]").forEach(function (button) {
    button.addEventListener("click", function () {
      state.settings.shape = button.getAttribute("data-shape");
      setPressed("[data-shape]", "data-shape", state.settings.shape);
      draw(false);
    });
  });
  document.querySelectorAll("[data-color]").forEach(function (button) {
    button.addEventListener("click", function () {
      state.settings.colorMode = button.getAttribute("data-color");
      if (state.settings.colorMode === "category" && !state.settings.colorField) state.settings.colorField = el("color-field").value || state.headers[0];
      syncControls();
      draw(false);
    });
  });
  document.querySelectorAll("[data-size]").forEach(function (button) {
    button.addEventListener("click", function () {
      state.settings.sizeMode = button.getAttribute("data-size");
      if (state.settings.sizeMode === "number" && !state.settings.sizeField) state.settings.sizeField = el("size-field").value || null;
      syncControls();
      draw(false);
    });
  });
  document.querySelectorAll("[data-label]").forEach(function (button) {
    button.addEventListener("click", function () {
      state.settings.labelMode = button.getAttribute("data-label");
      if (state.settings.labelMode === "field" && !state.settings.labelField) state.settings.labelField = el("label-field").value || state.headers[0];
      syncControls();
      draw(false);
    });
  });
  ["color-field", "size-field", "label-field", "filter-field"].forEach(function (id) {
    el(id).addEventListener("change", function () {
      const key = id === "color-field" ? "colorField" : id === "size-field" ? "sizeField" : id === "label-field" ? "labelField" : "filterField";
      state.settings[key] = el(id).value || null;
      if (id === "filter-field") refreshFilterValues();
      draw(false);
    });
  });
  el("filter-value").addEventListener("change", function () { draw(false); });
  el("search").addEventListener("input", function () { draw(false); });

  map = L.map("map", { scrollWheelZoom: true }).setView([39.8, -98.6], 4);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);
  layer = L.layerGroup().addTo(map);
  window.addEventListener("resize", function () { map.invalidateSize(); });
})();
