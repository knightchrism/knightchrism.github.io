# `data/coverage.json` schema

**Path:** `data/coverage.json` (repo root relative). This one file drives `coverage.html`: map colors, tooltips, legend counts, counters and the "Last updated" date. Totals are computed in the browser from this file; never hard-code them in HTML.

## Shape
```json
{
  "last_updated": "2026-10-30",
  "counties": {
    "Duval": {
      "status": "have_data",
      "parcels": 409160,
      "roof_permits": 150509,
      "years": "2016–2026",
      "permit_start": "2016-01-01",
      "permit_end": "2026-10-30",
      "match_rate": 0.998
    },
    "Miami-Dade": { "status": "source_found" },
    "Alachua": { "status": "not_checked" }
  }
}
```

| Field | Type | Required | Meaning |
|---|---|---|---|
| `last_updated` | string `YYYY-MM-DD` | yes | Shown as "Last updated" on the page. Set it on every update. |
| `counties` | object | yes | Keys are county names exactly as Census `NAME` (e.g. `Miami-Dade`, `St. Johns`, `St. Lucie`, `DeSoto`, `Indian River`, `Palm Beach`). No "County" suffix. |
| `status` | string | yes | One of the allowed statuses below. |
| `parcels` | integer | have_data | Parcel count for the county. |
| `roof_permits` | integer | have_data | Roof permits matched to parcels. |
| `years` | string | optional | Human label for the tooltip, e.g. `"2016–2026"`. |
| `permit_start` / `permit_end` | string `YYYY-MM-DD` | have_data | Earliest/latest permit date; used for the "Years covered" counter (min start year – max end year). |
| `match_rate` | number 0–1 | optional | Share of permits matched to a parcel; shown as a percentage. |

## Allowed statuses
- `have_data`: processed; counted in "Counties covered", parcels and roof-permit totals. Gold on the map.
- `source_found`: a public permit source has been found but not processed. Outlined amber.
- `not_checked`: not looked at yet. Dim navy-grey.

Counties missing from `counties`, or with an unknown status, are shown as `not_checked`. Only `have_data` entries count toward totals. Florida has 67 counties; the file currently lists all 67.

## Example update (after a Hillsborough run)
```diff
-  "last_updated": "2026-10-30",
+  "last_updated": "2026-11-14",
...
-  "Hillsborough": { "status": "source_found" },
+  "Hillsborough": {
+    "status": "have_data",
+    "parcels": <count from run>,
+    "roof_permits": <count from run>,
+    "years": "<start year>–<end year>",
+    "permit_start": "<YYYY-MM-DD>",
+    "permit_end": "<YYYY-MM-DD>",
+    "match_rate": <0–1>
+  },
```
Use real numbers from the run only. Validate before committing:
```sh
python3 -c "import json;d=json.load(open('data/coverage.json'));assert all(v['status'] in ('have_data','source_found','not_checked') for v in d['counties'].values());print(len(d['counties']),'counties OK')"
```
Then commit and push `data/coverage.json`; GitHub Pages serves the update within a few minutes (the page fetches with `cache: no-cache`).
