/* File readers. SheetJS is injected so tests and the page share one path. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ExcelMapFiles = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function readMatrix(XLSX, bytes) {
    const workbook = XLSX.read(bytes, {
      type: "array",
      cellHTML: false,
      cellDates: false,
      cellNF: false,
      cellStyles: false,
      cellFormula: true,
      WTF: false
    });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      const err = new Error("This workbook has no sheets.");
      err.code = "empty";
      throw err;
    }
    const sheet = workbook.Sheets[sheetName];
    Object.keys(sheet).forEach(function (key) {
      if (key.charAt(0) === "!") return;
      const cell = sheet[key];
      if (cell && cell.f && (cell.v == null || cell.v === "" || cell.t === "e")) {
        const formula = String(cell.f);
        cell.v = formula.charAt(0) === "=" ? "'" + formula : "'=" + formula;
        cell.t = "s";
      } else if (cell && typeof cell.v === "string" && cell.v.charAt(0) === "=") {
        cell.v = "'" + cell.v;
        cell.t = "s";
      }
    });
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null, blankrows: true });
    return { sheetName: sheetName, matrix: matrix };
  }

  return { readMatrix: readMatrix };
});
