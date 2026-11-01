# Online quotes + status tracker

Private-by-link quote pages: `https://knightchrism.github.io/quotes/view.html?q=<id>`.
The page is `noindex`, `/quotes/` is disallowed in robots.txt, and nothing in the nav, sitemap or llms.txt links here.

**Privacy note:** GitHub Pages and this repo are public. The only protection is the long random id. There is no login, and anyone browsing the repo on GitHub can see every file in `quotes/`. Keep real client files minimal (no personal phone numbers, addresses or sensitive details), or move client quotes to the planned cloud portal with logins.

## Add a client quote
1. On the box, run `python3 /workspace/quotes/src/new_quote.py "Client Name" GK-2026-X001`. It prints a new id and writes `quotes/data/<id>.json`.
2. Fill in the JSON: line items, total, deposit, balance, terms, optional `hosting`, and set `"sample": false`.
3. Copy the client PDF to `quotes/files/<id>.pdf`.
4. Commit and push, then send the client `https://knightchrism.github.io/quotes/view.html?q=<id>` with the PDF attached.

## Update the status
Edit `quotes/data/<id>.json`:
- `status`: 1 Request · 2 Discovery call · 3 Fixed quote · 4 50% deposit · 5 Build & review · 6 Delivery (the current step pulses gold; earlier steps are filled gold)
- `updated`: the date shown as "Last updated"
- `note`: an optional short status message (`""` hides it)
- `policy`: the "Satisfaction & revisions" list of [heading, text] pairs (copy it from the sample; omit to hide)

Commit and push. Pages updates within a minute or two.
