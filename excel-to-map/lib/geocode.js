/* Census geocoder client. Disabled unless a caller passes enabled:true and a fetch function.
   The static page does not enable it: the service does not allow browser CORS. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ExcelMapGeocode = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const PROVIDER = {
    name: "U.S. Census Bureau Geocoder",
    endpoint: "https://geocoding.geo.census.gov/geocoder/locations/address",
    benchmark: "Public_AR_Current",
    fields: ["street", "city", "state", "zip"],
    keyRequired: false,
    cost: "$0. The Census Bureau does not charge for the Geocoder.",
    rateLimit: "The Census Bureau does not publish a numeric Geocoder rate limit. Batch requests allow up to 10,000 addresses, and the terms allow the Bureau to block clients that try to circumvent access limits.",
    terms: "https://www.census.gov/data/developers/about/terms-of-service.html",
    docs: "https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html",
    cors: false,
    available: false,
    checked: "2026-11-08",
    reason: "The Geocoding Services API (documentation updated February 2026) says it does not support CORS. A request from this site on 8 Nov 2026 returned HTTP 200 and no Access-Control-Allow-Origin header. This static page cannot call it. JSONP and a proxy are not used.",
    setup: "Address lookup needs a same-origin endpoint that you operate. After the visitor agrees, that endpoint may receive only street, city, state, and ZIP, forward them to the Census Geocoder, and return coordinates. Cache results, let the visitor cancel, and slow down if Census throttles you. Census does not require an API key. Do not put a key in this page."
  };

  function buildCensusUrl(parts) {
    const query = new URLSearchParams();
    query.set("street", parts.street || "");
    query.set("city", parts.city || "");
    query.set("state", parts.state || "");
    query.set("zip", parts.zip || "");
    query.set("benchmark", PROVIDER.benchmark);
    query.set("format", "json");
    return PROVIDER.endpoint + "?" + query.toString();
  }

  function parseCensusBody(body) {
    const matches = body && body.result && Array.isArray(body.result.addressMatches) ? body.result.addressMatches : null;
    if (!matches || !matches.length) return { status: "unmatched", reason: "The Census Geocoder returned no match." };
    if (matches.length > 1) return { status: "uncertain", reason: "The Census Geocoder returned " + matches.length + " matches. None was chosen." };
    const coordinates = matches[0].coordinates || {};
    const lon = Number(coordinates.x);
    const lat = Number(coordinates.y);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return { status: "uncertain", reason: "The match did not include coordinates." };
    return { status: "matched", lon: lon, lat: lat, matchedAddress: String(matches[0].matchedAddress || "") };
  }

  function cacheKey(parts) {
    return ["street", "city", "state", "zip"].map(function (field) {
      return String(parts[field] || "").trim().toLowerCase().replace(/\s+/g, " ");
    }).join("|");
  }

  function consentOk(consent) {
    if (!consent || consent.provider !== PROVIDER.name || !Array.isArray(consent.fields)) return false;
    const fields = consent.fields.map(function (field) { return String(field); }).sort().join(",");
    return fields === PROVIDER.fields.slice().sort().join(",");
  }

  function createGeocoder(options) {
    const opts = options || {};
    const enabled = opts.enabled === true && typeof opts.fetchImpl === "function";
    const cap = opts.cap || 25;
    const cache = new Map();
    let consent = null;
    return {
      provider: PROVIDER,
      available: enabled,
      consent: function (record) {
        if (!consentOk(record)) {
          const err = new Error("Consent must name the Census Geocoder and the four address fields.");
          err.code = "consent";
          throw err;
        }
        consent = { provider: record.provider, fields: record.fields.slice() };
      },
      revoke: function () { consent = null; },
      async lookup(items, call) {
        const list = Array.isArray(items) ? items : [];
        const extra = call || {};
        if (!enabled) {
          return list.map(function (item) {
            return { id: item.id, status: "unavailable", reason: PROVIDER.reason };
          });
        }
        if (!consent) {
          return list.map(function (item) {
            return { id: item.id, status: "needs-consent", reason: "No address leaves this browser until you agree." };
          });
        }
        const out = [];
        let sent = 0;
        for (let i = 0; i < list.length; i += 1) {
          const item = list[i];
          if (extra.signal && extra.signal.aborted) {
            out.push({ id: item.id, status: "cancelled", reason: "Lookup cancelled." });
            continue;
          }
          const key = cacheKey(item);
          if (!extra.retry && cache.has(key)) {
            out.push(Object.assign({ id: item.id }, cache.get(key)));
            continue;
          }
          if (sent >= cap) {
            out.push({ id: item.id, status: "not-sent", reason: "Demo limit of " + cap + " address lookups. This row was not sent." });
            continue;
          }
          sent += 1;
          try {
            const response = await opts.fetchImpl(buildCensusUrl(item), { method: "GET", signal: extra.signal });
            if (!response || !response.ok) {
              out.push({ id: item.id, status: "error", reason: "The Census Geocoder did not answer. You can retry." });
              continue;
            }
            const parsed = parseCensusBody(await response.json());
            if (parsed.status === "matched" || parsed.status === "unmatched" || parsed.status === "uncertain") cache.set(key, parsed);
            out.push(Object.assign({ id: item.id }, parsed));
          } catch (err) {
            const aborted = err && (err.name === "AbortError" || (extra.signal && extra.signal.aborted));
            out.push({ id: item.id, status: aborted ? "cancelled" : "error", reason: aborted ? "Lookup cancelled." : "The Census Geocoder did not answer. You can retry." });
          }
        }
        return out;
      }
    };
  }

  return {
    PROVIDER: PROVIDER,
    buildCensusUrl: buildCensusUrl,
    parseCensusBody: parseCensusBody,
    createGeocoder: createGeocoder
  };
});
