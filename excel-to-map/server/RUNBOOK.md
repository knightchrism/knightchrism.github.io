# Excel-to-map quota service

This process is the only place the Excel-to-map page will load Google Maps or send an address to Google. GitHub Pages cannot run it. Nothing in this repository enables a Google account, billing, or an API.

The page at `/excel-to-map/` keeps working for latitude/longitude on the OpenStreetMap map when this service is absent. That path does not call Google. It is not a substitute for the quota gate.

## What the ceilings are

Checked against Google's global core price list on 9 Nov 2026:

| App name | SKU | SKU ID | Free billable events / month | Price after the cap |
| --- | --- | --- | --- | --- |
| Geocoding | Geocoding | BAC8-4E68-E261 | 10,000 | $5.00 per 1,000 |
| Dynamic Maps | Dynamic Maps | FAF4-3B2D-51B2 | 10,000 | $7.00 per 1,000 |

Source: [Google Maps Platform core services pricing list](https://developers.google.com/maps/billing-and-pricing/pricing) and [Pay-as-you-go](https://developers.google.com/maps/billing-and-pricing/pay-as-you-go).

- The free amount is per SKU, not a shared pool across SKUs.
- Google adds up that SKU for every project on the same billing account. A separate Cloud project does not get its own 10,000.
- The free amount resets on the first day of each month at midnight Pacific time. This service uses `America/Los_Angeles`, which follows Pacific daylight time. It does not use a fixed UTC-8 offset.
- India pricing and any negotiated contract can use different caps and prices. The hardcoded 9,000 ceiling is safe only for an account on the global list whose other projects will not use these two SKUs in the same month. If that is not true, set a lower ceiling before enabling the keys.
- A daily Cloud quota and a budget alert are not a monthly hard stop. Daily quotas reset at midnight Pacific. Budget alerts send mail unless you add a separate billing cutoff. This app does not treat either one as the monthly cap.

The app ceilings are 9,000 Geocoding reservations and 9,000 Dynamic Maps reservations. Configuration may lower them. It cannot raise them. The 1,000-event gap is slack for other use on the same billing account and for calls this process does not see. It is not a promise that the bill will be zero.

## What this counter does not stop

A reservation is taken before this process calls Geocoding and before it gives the browser key to the page. Failed calls, retries, and abandoned map loads stay counted.

That still does not cover every way Google can bill the account:

- Anyone who has seen the browser key can load Maps JavaScript from an allowed referrer without asking this counter again. Referrer restrictions limit where a stolen key works. They do not limit how many map loads an allowed page can make if the page is changed or the key is reused.
- The server key can be used by any client that passes its IP restriction, including a shell command on this machine.
- Other projects and other keys on the same billing account share the 10,000 free events.
- Google bills a Dynamic Maps event for a successful map load, and a Geocoding event per Geocoding API request. This counter also counts calls that fail or never finish, so it can reach 9,000 before Google's own 10,000 successful events. That is intentional.

Do not describe this as a guarantee of a zero bill.

## Provider settings to make before the keys are used

Do this in Google Cloud yourself. This repository does not log in or enable APIs.

1. Confirm the billing account's month-to-date usage for SKUs `BAC8-4E68-E261` and `FAF4-3B2D-51B2` across every linked project. If that usage is not zero, lower the app ceilings by at least that amount, and keep them at or below 9,000.
2. Confirm the account is on the global price list, not India pricing and not a negotiated contract.
3. Enable only Geocoding API and Maps JavaScript API on the project you will use.
4. Create a browser key restricted to Maps JavaScript API and to the HTTP referrers you will actually use, including `http://127.0.0.1:8080/*` while testing at home. Do not leave it unrestricted.
5. Create a server key restricted to Geocoding API and to this machine's IP address. Do not put it in the page, the repo, or chat.
6. Do not enable Places, Routes, Address Validation, map IDs, or advanced markers. This app does not call them. A basic `google.maps.Map` without a map ID is still one Dynamic Maps load.
7. Optional extra limit: a Cloud daily quota. It is a rate backstop, not the monthly cap. A daily quota of 9,000 would still allow more than 10,000 successful events in a month.

## Run on the Ubuntu machine

From `~/dev`, with the website checkout as the current directory:

```bash
mkdir -p "$HOME/dev/excel-map-quota"
export QUOTA_DB="$HOME/dev/excel-map-quota/quota.sqlite"
export GOOGLE_MAPS_BROWSER_KEY="paste-the-browser-key-here"
export GOOGLE_GEOCODING_SERVER_KEY="paste-the-server-key-here"
python3 excel-to-map/server/serve.py --root . --host 127.0.0.1 --port 8080
```

Open `http://127.0.0.1:8080/excel-to-map/`. The quota API and the page are the same origin. Python 3 and its built-in `sqlite3` module are enough. Do not commit `quota.sqlite`.

If either key or `QUOTA_DB` is missing or the database cannot be opened, `/api/google/status` reports Google as off and the page does not load the Maps script or send addresses.

Stop the process with Ctrl-C. The SQLite file keeps the month's counts.
