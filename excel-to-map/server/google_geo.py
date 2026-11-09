"""Google Geocoding API request builder and response parser.

The HTTP call is injected. Tests must not open a live connection.
"""

from __future__ import annotations

import json
from urllib.parse import urlencode
from urllib.request import Request

ENDPOINT = "https://maps.googleapis.com/maps/api/geocode/json"
FIELDS = ("street", "city", "state", "zip")


def address_line(parts: dict) -> str:
    ordered = [str(parts.get(field) or "").strip() for field in FIELDS]
    return ", ".join(bit for bit in ordered if bit)


def build_request(parts: dict, server_key: str) -> Request:
    query = urlencode({"address": address_line(parts), "key": server_key})
    return Request(ENDPOINT + "?" + query, method="GET")


def parse_body(body: dict) -> dict:
    status = str((body or {}).get("status") or "")
    results = (body or {}).get("results")
    if status == "ZERO_RESULTS" or results == []:
        return {"status": "unmatched", "reason": "Google Geocoding returned no match. The request was counted."}
    if status != "OK" or not isinstance(results, list):
        return {"status": "error", "reason": "Google Geocoding did not return a match (" + (status or "no status") + "). The request was counted."}
    if len(results) != 1:
        return {"status": "uncertain", "reason": "Google Geocoding returned " + str(len(results)) + " matches. None was chosen. The request was counted."}
    loc = ((results[0].get("geometry") or {}).get("location") or {})
    try:
        lat = float(loc["lat"])
        lon = float(loc["lng"])
    except (KeyError, TypeError, ValueError):
        return {"status": "uncertain", "reason": "The match had no coordinates. The request was counted."}
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        return {"status": "invalid", "reason": "The match coordinates were out of range. The request was counted."}
    return {"status": "matched", "lat": lat, "lon": lon}


def geocode_parts(parts: dict, server_key: str, opener) -> dict:
    request = build_request(parts, server_key)
    try:
        with opener(request, timeout=20) as response:
            payload = response.read()
    except Exception:
        return {"status": "error", "reason": "Google Geocoding did not answer. The reservation was kept. Retrying counts again."}
    try:
        body = json.loads(payload.decode("utf-8"))
    except (UnicodeError, json.JSONDecodeError):
        return {"status": "error", "reason": "Google Geocoding returned an unreadable response. The reservation was kept."}
    return parse_body(body)
