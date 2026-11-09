/* RFC 4180 CSV reader. Returns a matrix of strings, including the header row. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ExcelMapCsv = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function parseCsv(text) {
    const src = String(text == null ? "" : text).replace(/^\uFEFF/, "");
    const rows = [];
    let row = [];
    let cell = "";
    let i = 0;
    let quoted = false;
    while (i < src.length) {
      const c = src[i];
      if (quoted) {
        if (c === '"') {
          if (src[i + 1] === '"') {
            cell += '"';
            i += 2;
            continue;
          }
          quoted = false;
          i += 1;
          continue;
        }
        cell += c;
        i += 1;
        continue;
      }
      if (c === '"') {
        quoted = true;
        i += 1;
        continue;
      }
      if (c === ",") {
        row.push(cell);
        cell = "";
        i += 1;
        continue;
      }
      if (c === "\n" || c === "\r") {
        if (c === "\r" && src[i + 1] === "\n") i += 1;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
        i += 1;
        continue;
      }
      cell += c;
      i += 1;
    }
    if (quoted) {
      const err = new Error("This CSV has an unfinished quoted value.");
      err.code = "csv";
      throw err;
    }
    if (cell.length || row.length) {
      row.push(cell);
      rows.push(row);
    }
    return rows.filter(function (r) { return r.some(function (v) { return String(v).trim() !== ""; }); });
  }

  return { parseCsv: parseCsv };
});
