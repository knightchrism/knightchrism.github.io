const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const geo = require("../lib/geocode.js");

const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/census-silver-hill.json"), "utf8"));

function consent() {
  return { provider: geo.PROVIDER.name, fields: ["street", "city", "state", "zip"] };
}

test("Census example response uses x as longitude and y as latitude", function () {
  const parsed = geo.parseCensusBody(fixture);
  assert.equal(parsed.status, "matched");
  assert.ok(Math.abs(parsed.lon - -76.92836638093) < 1e-9);
  assert.ok(Math.abs(parsed.lat - 38.84505589808) < 1e-9);
  assert.match(parsed.matchedAddress, /SILVER HILL RD/);
});

test("address URL names only the four Census fields", function () {
  const url = new URL(geo.buildCensusUrl({
    street: "4600 Silver Hill Rd",
    city: "Washington",
    state: "DC",
    zip: "20233",
    name: "do not send",
    phone: "do not send"
  }));
  assert.equal(url.origin + url.pathname, geo.PROVIDER.endpoint);
  assert.deepEqual(Array.from(url.searchParams.keys()).sort(), ["benchmark", "city", "format", "state", "street", "zip"]);
  assert.equal(url.searchParams.get("street"), "4600 Silver Hill Rd");
});

test("disabled geocoder never calls fetch, even after consent", async function () {
  let calls = 0;
  const client = geo.createGeocoder({
    enabled: false,
    fetchImpl: async function () { calls += 1; return { ok: true, json: async function () { return fixture; } }; }
  });
  client.consent(consent());
  const rows = await client.lookup([{ id: "a", street: "4600 Silver Hill Rd", city: "Washington", state: "DC", zip: "20233" }]);
  assert.equal(calls, 0);
  assert.equal(rows[0].status, "unavailable");
  assert.match(rows[0].reason, /CORS/);
});

test("enabled geocoder waits for consent, caches, and can be cancelled", async function () {
  const calls = [];
  const client = geo.createGeocoder({
    enabled: true,
    cap: 2,
    fetchImpl: function (url, options) {
      calls.push(url);
      if (options && options.signal && options.signal.aborted) {
        const err = new Error("aborted");
        err.name = "AbortError";
        return Promise.reject(err);
      }
      return Promise.resolve({ ok: true, json: async function () { return fixture; } });
    }
  });
  const item = { id: "hq", street: "4600 Silver Hill Rd", city: "Washington", state: "DC", zip: "20233" };
  const blocked = await client.lookup([item]);
  assert.equal(calls.length, 0);
  assert.equal(blocked[0].status, "needs-consent");
  client.consent(consent());
  const first = await client.lookup([item]);
  assert.equal(first[0].status, "matched");
  assert.equal(first[0].lat, 38.84505589808);
  await client.lookup([item]);
  assert.equal(calls.length, 1);
  const extra = await client.lookup([
    item,
    { id: "b", street: "1", city: "Washington", state: "DC", zip: "20233" },
    { id: "c", street: "2", city: "Washington", state: "DC", zip: "20233" }
  ], { retry: true });
  assert.equal(extra[2].status, "not-sent");
  const controller = new AbortController();
  controller.abort();
  const cancelled = await client.lookup([{ id: "d", street: "3", city: "Washington", state: "DC", zip: "20233" }], { signal: controller.signal, retry: true });
  assert.equal(cancelled[0].status, "cancelled");
});

test("provider record stays unavailable for the static page", function () {
  assert.equal(geo.PROVIDER.available, false);
  assert.equal(geo.PROVIDER.cors, false);
  assert.equal(geo.PROVIDER.keyRequired, false);
  assert.match(geo.PROVIDER.cost, /\$0/);
  assert.match(geo.PROVIDER.setup, /same-origin/);
});
