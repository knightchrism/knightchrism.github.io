# knightchrism-site

Static personal + KnightGeo site. Plain HTML/CSS/JS, no build step.

## Files
- `index.html`: content (all sections). Edit text directly.
- `styles.css`: colors live in `:root` variables at the top.
- `main.js`: MapLibre map (OpenFreeMap `dark` style, no API key). Edit the `samples` array to change markers (keep them labeled as samples unless they're real).

## Editing TODOs
- Contact: replace the `TODO: email` / `TODO: LinkedIn` spans in `#contact`.
- Projects: add a new `<article class="card">` in `#projects`.
- SEO: update `og:url` in `<head>` once the final domain is known.

## Preview locally
`python3 -m http.server 8000` then open http://localhost:8000

## Deploy (GitHub Pages)
Push to a repo, then Settings → Pages → Deploy from branch → `main` / root. For a user site, name the repo `knightchrism.github.io`.
