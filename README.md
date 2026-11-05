<p align="center"><a href="https://geoknightgis.com"><img src="favicon.svg" width="72" alt="GeoKnight GIS logo"></a></p>

<h1 align="center">GeoKnight GIS</h1>
<p align="center"><b>Checked, documented geospatial data at small-business rates.</b><br>
<a href="https://geoknightgis.com">geoknightgis.com</a> · Jacksonville, Florida</p>


GeoKnight GIS builds custom GIS web applications: interactive web maps, dashboards and map-based tools for businesses and government, anywhere. $95–$125/hr or fixed-price projects from $350. Founded by Christopher Knight, GIS & Data Engineer. Based in Jacksonville, FL, serving clients anywhere.

Website: https://knightchrism.github.io · [Book a call](https://cal.com/christopher-uzhh5z) · info@geoknightgis.com · [LinkedIn](https://www.linkedin.com/in/christopher-knight-3225a2232/) · [X @GeoKnightGIS](https://x.com/GeoKnightGIS)

## Services
| Offer | Price |
|---|---|
| Base rate | $95–$125/hr |
| Starter map | $350 |
| Custom dashboard or tool | $1,500–$5,000 |
| Data pipelines / integrations | from $5,000 |
| Anything else | Custom quote ([book a call](https://cal.com/christopher-uzhh5z)) |

## Work samples
| Project | Description | Demo |
|---|---|---|
| [Nearest Hospital by Real Roads](https://github.com/knightchrism/nearest-hospital-demo) | Straight-line vs. drive-time nearest hospital across the St. Johns River; drop a pin and an agent ranks 11 hospitals by real road travel time (OSM, OSRM, Leaflet). | [Live demo](https://knightchrism.github.io/nearest-hospital-demo/) |
| [jax-property-intelligence](https://github.com/knightchrism/jax-property-intelligence) | Duval County parcels, assessor records, addresses and FEMA flood zones in PostGIS, on an interactive map. | [Live map](https://knightchrism.github.io/jax-property-intelligence/) |
| [Water-Monitoring Data Quality Check](https://github.com/knightchrism/sjrwmd-geodata-qc) | Automatic quality checks on publicly available SJRWMD groundwater-station open data. Not affiliated with or endorsed by SJRWMD. | [Dashboard](https://knightchrism.github.io/sjrwmd-geodata-qc/) |
| [census-pipeline](https://github.com/knightchrism/census-pipeline) | Florida market-analysis pipeline: Census ACS → DuckDB → tested dbt models → governed metrics. | |

## Site
Plain static HTML/CSS served by GitHub Pages from `main` (root).

## Hero (Oct 30, 2026)
The home hero is the 3D night globe restored from the live site (MapLibre GL 5.24.0, vendored in `assets/globe/vendor/`; NASA GIBS Blue/Black Marble with a sun-based day/night blend, USGS imagery and live USGS feeds). Selected layers from the animated Florida hero are blended on top, geo-registered to the globe (`assets/globe/overlay.js`): Gulf Stream particles, flights, Cape launches, city-light twinkle and a gold scan sweep (illustrative). On screens under 640px a static poster image is shown instead. The previous animated Florida hero is shelved, unreferenced, in `shelved/florida-hero/`.

## Request form (request.html)
`request.html` posts to [Web3Forms](https://web3forms.com) (plain HTML POST, no inline JS; the CSP on that page allows `https://api.web3forms.com` for form-action/connect-src only). The Web3Forms public access key (tied to info@geoknightgis.com, where submissions are emailed) is set in `request.html`; it is designed to be public in HTML. To change it, create a new key at web3forms.com and replace the `access_key` value. Successful submissions redirect to `request-thanks.html`. Pricing buttons link to `request.html?plan=...`; `assets/js/request.js` preselects the plan.

## Change log

- 2026-11-01: Added roof-permit globe card to homepage and work page, plus README row. AI-assisted; no secrets.
- 2026-11-02: Removed public links to the roof-permit globe (now behind login); More work grid set to 2 columns. AI-assisted; no secrets.
