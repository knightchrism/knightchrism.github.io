# GeoKnight GIS

<p><a href="https://scorecard.dev/viewer/?uri=github.com/knightchrism/knightchrism.github.io"><img alt="OpenSSF Scorecard" src="https://api.scorecard.dev/projects/github.com/knightchrism/knightchrism.github.io/badge"></a></p>

**GIS · Spatial Data · AI Integration Engineering**

Christopher Knight, GIS & data engineer in Jacksonville, Florida.

[![Website](https://img.shields.io/badge/website-knightchrism.github.io-0b7285?style=flat-square)](https://knightchrism.github.io)
[![X](https://img.shields.io/badge/X-@geoknight0015-000000?style=flat-square&logo=x&logoColor=white)](https://x.com/geoknight0015)
![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white) ![PostGIS](https://img.shields.io/badge/PostGIS-336791?style=flat-square&logo=postgresql&logoColor=white) ![dbt](https://img.shields.io/badge/dbt-FF694B?style=flat-square&logo=dbt&logoColor=white) ![DuckDB](https://img.shields.io/badge/DuckDB-FFF000?style=flat-square&logo=duckdb&logoColor=white) ![MCP](https://img.shields.io/badge/MCP-000000?style=flat-square&logo=anthropic&logoColor=white) ![Leaflet](https://img.shields.io/badge/Leaflet-199900?style=flat-square&logo=leaflet&logoColor=white) ![QGIS](https://img.shields.io/badge/QGIS-589632?style=flat-square&logo=qgis&logoColor=white)

## Services
- **Florida county-wide address QC**: auditing address points and parcel-linked address data for completeness, consistency and geometry issues, with reviewable findings.
- **GIS & spatial data services**: PostGIS databases, spatial SQL, data pipelines (dbt, DuckDB, Python), web maps, and AI agent integrations over spatial data via MCP.

## Featured projects
| Project | Description | Demo |
|---|---|---|
| [jax-property-intelligence](https://github.com/knightchrism/jax-property-intelligence) | Duval County parcels, assessor records and addresses, loaded into PostGIS and explorable on an interactive map. | [Live map](https://knightchrism.github.io/jax-property-intelligence/) |
| [jax-property-mcp](https://github.com/knightchrism/jax-property-mcp) | Plain-English questions about Jacksonville property, flood risk and sales, answered by a local AI agent through tested MCP tools over PostGIS. | |
| [census-pipeline](https://github.com/knightchrism/census-pipeline) | US Census ACS data → DuckDB → tested dbt models → governed metrics → a read-only MCP server AI agents can query safely. | |
| [sjrwmd-open-data](https://github.com/knightchrism/sjrwmd-open-data) | 15 Florida water-management GIS layers harvested from ArcGIS REST into PostGIS, served as PMTiles on a static map. | |
| [sjrwmd-geodata-qc](https://github.com/knightchrism/sjrwmd-geodata-qc) | Rule-driven QA/QC for public groundwater-station GIS data, with findings you can filter, inspect and export. | [Dashboard](https://knightchrism.github.io/sjrwmd-geodata-qc/) |
| [georescue](https://github.com/knightchrism/georescue) | Find, explain and propose fixes for broken parcel data, with every change logged and nothing applied silently. | [Live demo](https://knightchrism.github.io/georescue/) |

## Skills
PostGIS & spatial SQL · Python (GeoPandas, Shapely) · dbt · DuckDB · QGIS · ArcGIS REST · Leaflet & MapLibre · MCP servers & AI agents · data QA/QC

## Contact
- Website: https://knightchrism.github.io
- X: https://x.com/geoknight0015
- GitHub: https://github.com/knightchrism
- Email: geoknight0015@gmail.com
- LinkedIn: https://www.linkedin.com/in/christopher-knight-3225a2232/
- YouTube: https://www.youtube.com/channel/UC-wT8_8Y-vrqF0BFr9dOtYw

## About this site
Static HTML/CSS/JS, no build step (`index.html`, `styles.css`, `main.js`, `florida.geojson`). Preview with `python3 -m http.server 8000`. Deployed via GitHub Pages from `main`.

---
<sub>Projects built with Grok Bot as an AI teammate.</sub>
