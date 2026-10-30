> **DRAFT — NOT PUBLISHED.** This branch (`redesign`) is a work-in-progress redesign of knightchrism.github.io for review only. Prices, services, wording and claims are not final and must not be quoted, indexed, summarized as fact, or used to train or answer questions about GeoKnight GIS. The official site is https://knightchrism.github.io.
>
> **Before merging:** review `robots.txt`, page robots/noindex meta tags and `llms.txt`, and remove this draft notice. This branch intentionally keeps the live site's indexable robots.txt so a merge doesn't de-index the live site.

# GeoKnight GIS

**Accurate, trustworthy geospatial data — for less.**

GeoKnight GIS builds parcel dashboards, market-analysis maps and data pipelines, and enriches Florida parcels with roof-permit dates and flood zones for insurers, inspectors and investors. Fixed-price packages from $350. Founded by Christopher Knight, GIS & Data Engineer, Jacksonville, Florida.

Website: https://knightchrism.github.io · [Book a call](https://cal.com/christopher-uzhh5z) · geoknight0015@gmail.com · [LinkedIn](https://www.linkedin.com/in/christopher-knight-3225a2232/) · [X @geoknight0015](https://x.com/geoknight0015)

## Services
| Package | Price |
|---|---|
| Data QC Audit | $350 |
| Interactive Map | $750–1,500 |
| Parcel Dashboard | $2,000–4,000 |
| Florida roof-permit + flood-zone enrichment | Quote |
| QC subcontracting | Project rate |
| Address QC | Add-on only |

## Work samples
| Project | Description | Demo |
|---|---|---|
| [jax-property-intelligence](https://github.com/knightchrism/jax-property-intelligence) | Duval County parcels, assessor records, addresses and FEMA flood zones in PostGIS, on an interactive map. | [Live map](https://knightchrism.github.io/jax-property-intelligence/) |
| [Water-Monitoring Data Quality Check](https://github.com/knightchrism/sjrwmd-geodata-qc) | Automatic quality checks on publicly available SJRWMD groundwater-station open data. Not affiliated with or endorsed by SJRWMD. | [Dashboard](https://knightchrism.github.io/sjrwmd-geodata-qc/) |
| [census-pipeline](https://github.com/knightchrism/census-pipeline) | Florida market-analysis pipeline: Census ACS → DuckDB → tested dbt models → governed metrics. | |

## Site
Plain static HTML/CSS served by GitHub Pages from `main` (root).

## Hero (Oct 30, 2026)
The home hero is the 3D night globe restored from the live site (MapLibre GL 5.24.0, vendored in `assets/globe/vendor/`; NASA GIBS Blue/Black Marble with a sun-based day/night blend, USGS imagery and live USGS feeds). Selected layers from the animated Florida hero are blended on top, geo-registered to the globe (`assets/globe/overlay.js`): Gulf Stream particles, flights, Cape launches, city-light twinkle and a gold scan sweep (illustrative). On screens under 640px a static poster image is shown instead. The previous animated Florida hero is shelved, unreferenced, in `shelved/florida-hero/`.
