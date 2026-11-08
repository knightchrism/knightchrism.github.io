/* Pure table logic for the Excel-to-map demo. No network and no DOM. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ExcelMapTable = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const LIMITS = { maxBytes: 2 * 1024 * 1024, maxRows: 1000, maxCols: 40, geocodeCap: 25 };

  const ALIASES = {
    street: ["street", "street address", "address", "address 1", "addr", "site address"],
    city: ["city", "town"],
    state: ["state", "state code"],
    zip: ["zip", "zip code", "zipcode", "postal code", "postal"],
    lat: ["latitude", "lat"],
    lon: ["longitude", "lon", "lng", "long"],
    id: ["id", "row id", "site id", "facility id"],
    name: ["name", "site name", "facility name", "label"]
  };

  const PALETTE = ["#0b1f3a", "#d4a72c", "#1d4e89", "#3d6b4f", "#7a3e3e", "#3e4a7a", "#6b5a3e", "#245c6b"];

  function fail(code, message) {
    const err = new Error(message);
    err.code = code;
    throw err;
  }

  function normalizeHeader(value) {
    return String(value == null ? "" : value)
      .trim()
      .toLowerCase()
      .replace(/[_./]+/g, " ")
      .replace(/[^a-z0-9 ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cellToString(value) {
    if (value == null) return "";
    if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
    if (typeof value === "boolean") return value ? "true" : "false";
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString();
    if (typeof value === "object") return "";
    return String(value);
  }

  function escapeText(value) {
    return cellToString(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function uniqueHeaders(headerRow) {
    const headers = [];
    const seen = new Map();
    headerRow.forEach(function (cell) {
      const base = cellToString(cell).trim() || "Column";
      const n = (seen.get(base) || 0) + 1;
      seen.set(base, n);
      headers.push(n === 1 ? base : base + " (" + n + ")");
    });
    return headers;
  }

  function matrixToTable(matrix) {
    const rowsIn = Array.isArray(matrix) ? matrix : [];
    let headerIndex = -1;
    for (let i = 0; i < rowsIn.length; i += 1) {
      const row = rowsIn[i] || [];
      if (row.some(function (cell) { return cellToString(cell).trim() !== ""; })) {
        headerIndex = i;
        break;
      }
    }
    if (headerIndex < 0) fail("empty", "This file has no header row.");
    const headers = uniqueHeaders(rowsIn[headerIndex]);
    if (headers.length > LIMITS.maxCols) {
      fail("too-many-columns", "This demo reads at most " + LIMITS.maxCols + " columns. This file has " + headers.length + ".");
    }
    const records = [];
    for (let r = headerIndex + 1; r < rowsIn.length; r += 1) {
      const raw = rowsIn[r] || [];
      if (!raw.some(function (cell) { return cellToString(cell).trim() !== ""; })) continue;
      if (records.length >= LIMITS.maxRows) {
        fail("too-many-rows", "This demo reads at most " + LIMITS.maxRows + " data rows. Nothing was plotted.");
      }
      const values = {};
      headers.forEach(function (header, c) { values[header] = cellToString(raw[c]); });
      records.push({ sourceRow: r + 1, values: values });
    }
    if (!records.length) fail("empty", "This file has headers but no data rows.");
    return { headers: headers, records: records };
  }

  function looksGeographic(role, values) {
    const nums = values.map(Number).filter(function (n) { return Number.isFinite(n); });
    if (!nums.length) return false;
    const ok = nums.filter(function (n) {
      return role === "lat" ? n >= -90 && n <= 90 : n >= -180 && n <= 180;
    });
    return ok.length / nums.length >= 0.8;
  }

  function detectColumns(headers, records) {
    const byNorm = new Map();
    headers.forEach(function (header) {
      const key = normalizeHeader(header);
      if (!byNorm.has(key)) byNorm.set(key, []);
      byNorm.get(key).push(header);
    });
    const roles = {};
    const uncertain = [];
    Object.keys(ALIASES).forEach(function (role) {
      const found = [];
      ALIASES[role].forEach(function (alias) {
        (byNorm.get(alias) || []).forEach(function (header) {
          if (found.indexOf(header) < 0) found.push(header);
        });
      });
      if (found.length === 1) roles[role] = found[0];
      else if (found.length > 1) {
        roles[role] = null;
        uncertain.push({ role: role, reason: "More than one column could be " + role + ".", candidates: found });
      } else roles[role] = null;
    });

    ["lat", "lon"].forEach(function (role) {
      if (!roles[role]) return;
      const values = (records || []).map(function (row) { return row.values[roles[role]]; }).filter(function (v) { return String(v).trim() !== ""; });
      if (values.length && !looksGeographic(role, values)) {
        uncertain.push({ role: role, reason: "The " + roles[role] + " values do not look like " + (role === "lat" ? "latitudes" : "longitudes") + ".", candidates: [roles[role]] });
      }
    });

    const coordsOk = !!(roles.lat && roles.lon) && !uncertain.some(function (item) { return item.role === "lat" || item.role === "lon"; });
    const addressOk = !!roles.street && (!!roles.zip || (!!roles.city && !!roles.state)) && !uncertain.some(function (item) { return item.role === "street" || item.role === "city" || item.role === "state" || item.role === "zip"; });
    return {
      roles: roles,
      uncertain: uncertain,
      coordinatesConfident: coordsOk,
      addressConfident: addressOk,
      ask: uncertain.length > 0 || (!coordsOk && !addressOk)
    };
  }

  function numberOrNull(value) {
    if (String(value == null ? "" : value).trim() === "") return null;
    const n = Number(String(value).trim());
    return Number.isFinite(n) ? n : NaN;
  }

  function assignIds(records, idHeader) {
    const seen = new Map();
    return records.map(function (record) {
      const rawId = idHeader ? cellToString(record.values[idHeader]).trim() : "";
      const base = rawId || ("row-" + record.sourceRow);
      const n = (seen.get(base) || 0) + 1;
      seen.set(base, n);
      return Object.assign({}, record, { id: n === 1 ? base : base + "#" + n, duplicateId: n > 1 });
    });
  }

  function classify(record, mode) {
    const lat = numberOrNull(record.latRaw);
    const lon = numberOrNull(record.lonRaw);
    if (mode === "coordinates") {
      if (lat == null && lon == null) {
        return { onMap: false, review: true, status: "missing", reason: "No latitude and longitude. Address lookup is off, so this row stays in the review list." };
      }
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return { onMap: false, review: true, status: "invalid", reason: "Latitude or longitude is missing or outside the valid range." };
      }
      return { onMap: true, review: false, status: "mapped", reason: "", lat: lat, lon: lon };
    }
    return { onMap: false, review: true, status: "address-unavailable", reason: "Address lookup is not available from this page. This row was not sent anywhere and was not dropped." };
  }

  function buildRows(table, columnMap, mode) {
    const idHeader = columnMap.id || null;
    const identified = assignIds(table.records, idHeader);
    const rows = identified.map(function (record) {
      const located = classify({
        latRaw: columnMap.lat ? record.values[columnMap.lat] : "",
        lonRaw: columnMap.lon ? record.values[columnMap.lon] : ""
      }, mode);
      const review = located.review || record.duplicateId;
      let reason = located.reason;
      if (record.duplicateId) {
        reason = (reason ? reason + " " : "") + "Duplicate id; both rows are kept.";
      }
      return {
        id: record.id,
        sourceRow: record.sourceRow,
        duplicateId: record.duplicateId,
        values: record.values,
        lat: located.lat == null ? null : located.lat,
        lon: located.lon == null ? null : located.lon,
        onMap: located.onMap,
        review: review,
        status: located.status,
        reason: reason
      };
    });
    const mapped = rows.filter(function (row) { return row.onMap; }).length;
    const review = rows.filter(function (row) { return row.review; }).length;
    if (mapped + rows.filter(function (row) { return !row.onMap; }).length !== rows.length) {
      fail("accounting", "Row accounting failed.");
    }
    return { rows: rows, total: rows.length, mapped: mapped, review: review };
  }

  function defaultSettings(headers) {
    const named = function (options) {
      const found = headers.find(function (header) { return options.indexOf(normalizeHeader(header)) >= 0; });
      return found || null;
    };
    const name = named(["name", "site name", "facility name", "label"]);
    const category = named(["category", "type", "kind", "park type"]);
    const size = named(["acres", "area", "size", "count"]);
    const popup = [];
    [name, category, size].forEach(function (field) { if (field && popup.length < 4) popup.push(field); });
    if (!popup.length && headers.length) popup.push(headers[0]);
    return {
      shape: "circle",
      colorMode: "single",
      colorField: category,
      sizeMode: "fixed",
      sizeField: size,
      labelMode: "off",
      labelField: name,
      filterField: category,
      popupFields: popup
    };
  }

  function mergeSettings(previous, headers) {
    const base = defaultSettings(headers);
    if (!previous) return base;
    const has = function (field) { return field && headers.indexOf(field) >= 0; };
    const next = Object.assign({}, base, previous);
    next.popupFields = (previous.popupFields || []).filter(has);
    if (!next.popupFields.length) next.popupFields = base.popupFields;
    if (next.colorMode === "category" && !has(next.colorField)) {
      next.colorMode = "single";
      next.colorField = null;
    }
    if (!has(next.colorField)) next.colorField = base.colorField;
    if (next.sizeMode === "number" && !has(next.sizeField)) {
      next.sizeMode = "fixed";
      next.sizeField = null;
    }
    if (!has(next.sizeField)) next.sizeField = base.sizeField;
    if (next.labelMode === "field" && !has(next.labelField)) {
      next.labelMode = "off";
      next.labelField = null;
    }
    if (!has(next.labelField)) next.labelField = base.labelField;
    if (!has(next.filterField)) next.filterField = base.filterField;
    if (["circle", "square", "pin"].indexOf(next.shape) < 0) next.shape = "circle";
    return next;
  }

  function categoriesOf(rows, field) {
    const set = new Set();
    rows.forEach(function (row) {
      if (!row.onMap) return;
      set.add(field ? cellToString(row.values[field]).trim() : "");
    });
    return Array.from(set).sort(function (a, b) { return a.localeCompare(b); });
  }

  function colorFor(category, categories) {
    const index = Math.max(0, categories.indexOf(category));
    return PALETTE[index % PALETTE.length];
  }

  function sizeFor(value) {
    const text = cellToString(value).trim();
    if (!text) return { px: 10, issue: "" };
    const n = Number(text);
    if (!Number.isFinite(n)) return { px: 10, issue: "Size is not a number. The point uses the default size." };
    if (n < 0) return { px: 10, issue: "Size is negative. The point uses the default size." };
    return { px: null, value: n, issue: "" };
  }

  function sizeScale(rows, field) {
    const nums = [];
    rows.forEach(function (row) {
      if (!row.onMap) return;
      const sized = sizeFor(row.values[field]);
      if (sized.value != null) nums.push(sized.value);
    });
    const min = nums.length ? Math.min.apply(null, nums) : 0;
    const max = nums.length ? Math.max.apply(null, nums) : 0;
    return function (value) {
      const sized = sizeFor(value);
      if (sized.px != null) return sized;
      const t = max === min ? 0.5 : (sized.value - min) / (max - min);
      return { px: Math.round(8 + t * 16), issue: "" };
    };
  }

  function rowHaystack(row) {
    return Object.keys(row.values).map(function (key) { return row.values[key]; }).join(" ").toLowerCase();
  }

  function filterRows(rows, query, field, value) {
    const q = String(query || "").trim().toLowerCase();
    return rows.filter(function (row) {
      if (!row.onMap) return false;
      if (field && value && value !== "(all)" && cellToString(row.values[field]).trim() !== value) return false;
      if (q && rowHaystack(row).indexOf(q) < 0) return false;
      return true;
    });
  }

  return {
    LIMITS: LIMITS,
    ALIASES: ALIASES,
    PALETTE: PALETTE,
    normalizeHeader: normalizeHeader,
    cellToString: cellToString,
    escapeText: escapeText,
    matrixToTable: matrixToTable,
    detectColumns: detectColumns,
    buildRows: buildRows,
    defaultSettings: defaultSettings,
    mergeSettings: mergeSettings,
    categoriesOf: categoriesOf,
    colorFor: colorFor,
    sizeFor: sizeFor,
    sizeScale: sizeScale,
    filterRows: filterRows
  };
});
