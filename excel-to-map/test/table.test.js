const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const XLSX = require("../vendor/xlsx.full.min.js");
const csv = require("../lib/csv.js");
const table = require("../lib/table.js");
const files = require("../lib/files.js");

const samplePath = path.join(__dirname, "../sample/sample-facilities.csv");

function tableFromCsv(text) {
  return table.matrixToTable(csv.parseCsv(text));
}

function coordsMap(detected) {
  return {
    id: detected.roles.id,
    name: detected.roles.name,
    lat: detected.roles.lat,
    lon: detected.roles.lon,
    street: detected.roles.street,
    city: detected.roles.city,
    state: detected.roles.state,
    zip: detected.roles.zip
  };
}

test("sample CSV parses, auto-detects, and keeps every row", function () {
  const parsed = tableFromCsv(fs.readFileSync(samplePath, "utf8"));
  assert.equal(parsed.records.length, 10);
  const detected = table.detectColumns(parsed.headers, parsed.records);
  assert.equal(detected.ask, false);
  assert.equal(detected.coordinatesConfident, true);
  assert.equal(detected.addressConfident, true);
  assert.equal(detected.roles.street, "street");
  assert.equal(detected.roles.city, "city");
  assert.equal(detected.roles.state, "state");
  assert.equal(detected.roles.zip, "zip");
  const built = table.buildRows(parsed, coordsMap(detected), "coordinates");
  assert.equal(built.total, 10);
  assert.equal(built.mapped, 8);
  assert.equal(built.review, 2);
  assert.ok(built.rows.every(function (row) { return row.onMap || row.review; }));
  const missing = built.rows.find(function (row) { return row.id === "s5"; });
  const invalid = built.rows.find(function (row) { return row.id === "s6"; });
  assert.equal(missing.status, "missing");
  assert.equal(invalid.status, "invalid");
  assert.equal(missing.onMap, false);
  assert.equal(invalid.onMap, false);
});

test("quoted commas and escaped quotes survive CSV parsing", function () {
  const matrix = csv.parseCsv('id,name\n1,"Pine Sample, Court"\n2,"say ""hi"""\n');
  assert.deepEqual(matrix[1], ["1", "Pine Sample, Court"]);
  assert.deepEqual(matrix[2], ["2", 'say "hi"']);
});

test("two street-like columns are not auto-picked", function () {
  const parsed = table.matrixToTable([
    ["Address", "Street Address", "City", "State", "ZIP"],
    ["1 Main", "1 Main", "Sampletown", "FL", "00000"]
  ]);
  const detected = table.detectColumns(parsed.headers, parsed.records);
  assert.equal(detected.ask, true);
  assert.equal(detected.roles.street, null);
  assert.ok(detected.uncertain.some(function (item) { return item.role === "street"; }));
});

test("non-geographic latitude values ask for a mapping", function () {
  const parsed = table.matrixToTable([
    ["Latitude", "Longitude"],
    ["200", "400"],
    ["300", "500"]
  ]);
  const detected = table.detectColumns(parsed.headers, parsed.records);
  assert.equal(detected.coordinatesConfident, false);
  assert.equal(detected.ask, true);
});

test("too many rows fails instead of dropping the tail", function () {
  const matrix = [["id", "latitude", "longitude"]];
  for (let i = 0; i < table.LIMITS.maxRows + 1; i += 1) matrix.push([String(i), "30", "-81"]);
  assert.throws(function () { table.matrixToTable(matrix); }, function (err) { return err.code === "too-many-rows"; });
});

test("category colors stay put and bad sizes do not drop points", function () {
  const parsed = table.matrixToTable([
    ["name", "category", "acres", "latitude", "longitude"],
    ["A", "Shelter", "4", "30.1", "-81.1"],
    ["B", "Office", "nope", "30.2", "-81.2"],
    ["C", "Shelter", "-2", "30.3", "-81.3"]
  ]);
  const detected = table.detectColumns(parsed.headers, parsed.records);
  const built = table.buildRows(parsed, coordsMap(detected), "coordinates");
  assert.equal(built.mapped, 3);
  const cats = table.categoriesOf(built.rows, "category");
  assert.equal(table.colorFor("Shelter", cats), table.colorFor("Shelter", cats));
  assert.notEqual(table.colorFor("Shelter", cats), table.colorFor("Office", cats));
  const scale = table.sizeScale(built.rows, "acres");
  assert.equal(scale("nope").px, 10);
  assert.match(scale("-2").issue, /negative/i);
  assert.ok(scale("4").px >= 8);
});

test("replacement keeps settings only for columns that remain", function () {
  const headers = ["name", "category", "acres", "latitude", "longitude"];
  const previous = {
    shape: "square",
    colorMode: "category",
    colorField: "category",
    sizeMode: "number",
    sizeField: "acres",
    labelMode: "field",
    labelField: "name",
    filterField: "category",
    popupFields: ["name", "acres"]
  };
  const kept = table.mergeSettings(previous, headers);
  assert.equal(kept.shape, "square");
  assert.equal(kept.colorMode, "category");
  assert.equal(kept.sizeMode, "number");
  const dropped = table.mergeSettings(previous, ["name", "category", "latitude", "longitude"]);
  assert.equal(dropped.sizeMode, "fixed");
  assert.equal(dropped.colorMode, "category");
  assert.deepEqual(dropped.popupFields, ["name"]);
});

test("duplicate ids are both kept", function () {
  const parsed = table.matrixToTable([
    ["id", "latitude", "longitude"],
    ["s1", "30.1", "-81.1"],
    ["s1", "30.2", "-81.2"]
  ]);
  const built = table.buildRows(parsed, { id: "id", lat: "latitude", lon: "longitude" }, "coordinates");
  assert.equal(built.total, 2);
  assert.equal(built.mapped, 2);
  assert.deepEqual(built.rows.map(function (row) { return row.id; }), ["s1", "s1#2"]);
  assert.equal(built.rows[1].review, true);
});

test("malicious cell text is escaped and formulas are not executed", function () {
  const nasty = '<img src=x onerror="alert(1)">';
  const sheet = XLSX.utils.aoa_to_sheet([
    ["name", "latitude", "longitude"],
    [nasty, 30.32, -81.66],
    ['=1+1', 30.33, -81.65]
  ]);
  const cell = sheet.A3;
  if (cell && cell.f == null && String(cell.v).charAt(0) === "=") {
    cell.f = String(cell.v).slice(1);
    delete cell.v;
    cell.t = "n";
  }
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Sites");
  const bytes = XLSX.write(book, { type: "array", bookType: "xlsx" });
  const read = files.readMatrix(XLSX, bytes);
  const parsed = table.matrixToTable(read.matrix);
  const name = parsed.records[0].values.name;
  assert.equal(name, nasty);
  assert.match(table.escapeText(name), /&lt;img/);
  assert.doesNotMatch(table.escapeText(name), /<img/);
  const formula = parsed.records[1].values.name;
  assert.notEqual(formula, "2");
  assert.match(formula, /1\+1/);
  assert.match(formula, /^'/);
});

test("search and filter do not remove review rows from the full set", function () {
  const text = fs.readFileSync(samplePath, "utf8");
  const parsed = tableFromCsv(text);
  const built = table.buildRows(parsed, coordsMap(table.detectColumns(parsed.headers, parsed.records)), "coordinates");
  const shown = table.filterRows(built.rows, "shelter", "category", "Shelter");
  assert.ok(shown.every(function (row) { return row.onMap && row.values.category === "Shelter"; }));
  assert.ok(shown.length < built.mapped);
  assert.equal(built.rows.length, 10);
});
