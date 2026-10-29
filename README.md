# knightchrism-site

Static personal + KnightGeo site. Plain HTML/CSS/JS, no build step.

## Files
- `index.html`: content (all sections). Edit text directly.
- `styles.css`: colors live in `:root` variables at the top.
- `main.js`: MapLibre GL JS v5 day/night globe. A custom `daynight://` protocol blends NASA GIBS `BlueMarble_NextGeneration` (day) and `VIIRS_Black_Marble` 2016 (night lights) per pixel using a solar terminator computed from the date and time, with a soft twilight band. Defaults to a cinematic Dusk-over-Florida sun; the Live sun toggle uses the real sun position and refreshes every 5 min. USGS National Map imagery shows at zoom ≥8. Fly-in plus a gentle drift on desktop, both disabled for prefers-reduced-motion. All public domain, no API key; keep the acknowledgments.
- `florida.geojson`: Florida outline (simplified, derived from US Census boundaries) drawn in gold.
- Fonts: EB Garamond (headings) + Inter (body) from Google Fonts.

## Editing TODOs
- Contact: replace the `TODO: email` / `TODO: LinkedIn` spans in `#contact`.
- Projects: add a new `<article class="card">` in `#projects`.
- SEO: update `og:url` in `<head>` once the final domain is known.

## Preview locally
`python3 -m http.server 8000` then open http://localhost:8000

## Deploy (GitHub Pages)
Push to a repo, then Settings → Pages → Deploy from branch → `main` / root. For a user site, name the repo `knightchrism.github.io`.
