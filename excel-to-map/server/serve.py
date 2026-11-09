"""Same-origin static site plus Google quota gate.

Run from the website root on the Ubuntu machine. GitHub Pages cannot
host this counter. No Google call is made unless a reservation commits
and the matching key is set. Keys are read from the environment only.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

from google_geo import FIELDS, geocode_parts
from quota import HARD_CEILING, SKUS, Quota, QuotaError, billing_period, resolve_ceiling

MAX_BODY = 64 * 1024
MAX_BATCH = 25


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


class Service:
    def __init__(self, root: Path, quota: Quota | None, browser_key: str, server_key: str, opener=None, clock=None):
        self.root = root.resolve()
        self.quota = quota
        self.browser_key = browser_key.strip()
        self.server_key = server_key.strip()
        self.opener = opener or urlopen
        self.clock = clock or now_utc
        self.reason = self._reason()

    def _reason(self) -> str:
        if self.quota is None:
            return "Quota database is not configured or could not be opened."
        missing = []
        if not self.browser_key:
            missing.append("GOOGLE_MAPS_BROWSER_KEY")
        if not self.server_key:
            missing.append("GOOGLE_GEOCODING_SERVER_KEY")
        if missing:
            return "Missing " + " and ".join(missing) + "."
        return ""

    @property
    def maps_ready(self) -> bool:
        return self.quota is not None and bool(self.browser_key)

    @property
    def geocode_ready(self) -> bool:
        return self.quota is not None and bool(self.server_key)

    def status(self) -> tuple[int, dict]:
        if self.quota is None:
            return 503, {
                "configured": False,
                "maps": False,
                "geocode": False,
                "reason": self.reason,
                "ceilings": {sku: HARD_CEILING for sku in SKUS},
            }
        try:
            moment = self.clock()
            used = {sku: self.quota.used(sku, moment) for sku in SKUS}
        except (QuotaError, OSError, Exception) as err:
            return 503, {"configured": False, "maps": False, "geocode": False, "reason": "Quota database is unavailable. " + type(err).__name__}
        return 200, {
            "configured": self.maps_ready or self.geocode_ready,
            "maps": self.maps_ready,
            "geocode": self.geocode_ready,
            "reason": self.reason,
            "period": billing_period(moment),
            "ceilings": self.quota.ceilings,
            "used": used,
            "skus": {sku: {"id": SKUS[sku]["id"], "freeCap": SKUS[sku]["free_cap"]} for sku in SKUS},
        }

    def reserve_map(self) -> tuple[int, dict]:
        if not self.maps_ready:
            return 503, {"ok": False, "reason": self.reason or "Google Maps is not configured."}
        try:
            result = self.quota.reserve("dynamic_maps", 1, self.clock())
        except (QuotaError, OSError, Exception):
            return 503, {"ok": False, "reason": "Quota database is unavailable. The map was not loaded."}
        if not result["ok"]:
            return 429, {"ok": False, "reason": "Monthly Dynamic Maps ceiling is reached. The Google map was not loaded.", "used": result["used"], "ceiling": result["ceiling"], "period": result["period"]}
        return 200, {"ok": True, "browserKey": self.browser_key, "used": result["used"], "ceiling": result["ceiling"], "period": result["period"]}

    def geocode(self, payload: dict) -> tuple[int, dict]:
        if not self.geocode_ready:
            return 503, {"ok": False, "reason": self.reason or "Google Geocoding is not configured.", "results": []}
        consent = payload.get("consent") if isinstance(payload, dict) else None
        rows = payload.get("rows") if isinstance(payload, dict) else None
        if not _consent_ok(consent):
            return 400, {"ok": False, "reason": "Consent must name Google Geocoding API and only street, city, state, and ZIP.", "results": []}
        if not isinstance(rows, list) or not rows or len(rows) > MAX_BATCH:
            return 400, {"ok": False, "reason": "Send 1 to " + str(MAX_BATCH) + " address rows.", "results": []}
        clean = []
        for row in rows:
            if not isinstance(row, dict) or set(row) - {"id", *FIELDS}:
                return 400, {"ok": False, "reason": "A row included a field other than id, street, city, state, and ZIP.", "results": []}
            clean.append({
                "id": str(row.get("id") or ""),
                "street": str(row.get("street") or ""),
                "city": str(row.get("city") or ""),
                "state": str(row.get("state") or ""),
                "zip": str(row.get("zip") or ""),
            })
        send = [row for row in clean if row["street"].strip()]
        held = [row for row in clean if not row["street"].strip()]
        results = [{
            "id": row["id"],
            "status": "missing",
            "reason": "No street. This row was not sent to Google.",
        } for row in held]
        if not send:
            return 200, {"ok": True, "results": results}
        try:
            reserved = self._reserve_some("geocoding", len(send))
        except (QuotaError, OSError, Exception):
            return 503, {"ok": False, "reason": "Quota database is unavailable. No address was sent.", "results": []}
        allowed = reserved["reserved"]
        for row in send[allowed:]:
            results.append({"id": row["id"], "status": "not-sent", "reason": "Monthly Geocoding ceiling is reached. This row was not sent."})
        for row in send[:allowed]:
            parsed = geocode_parts(row, self.server_key, self.opener)
            parsed["id"] = row["id"]
            results.append(parsed)
        return 200, {"ok": True, "results": results, "used": reserved.get("used"), "ceiling": reserved.get("ceiling"), "period": reserved.get("period")}

    def _reserve_some(self, sku: str, count: int) -> dict:
        reserved = self.quota.reserve(sku, count, self.clock())
        if reserved["ok"] or reserved["remaining"] <= 0:
            return reserved
        smaller = self.quota.reserve(sku, reserved["remaining"], self.clock())
        return smaller if smaller["ok"] else reserved


def _consent_ok(consent) -> bool:
    if not isinstance(consent, dict):
        return False
    if consent.get("provider") != "Google Geocoding API":
        return False
    fields = consent.get("fields")
    if not isinstance(fields, list):
        return False
    return sorted(str(field) for field in fields) == sorted(FIELDS)


def _safe_file(root: Path, url_path: str) -> Path | None:
    rel = url_path.split("?", 1)[0]
    if rel.endswith("/"):
        rel += "index.html"
    rel = rel.lstrip("/")
    candidate = (root / rel).resolve()
    if root not in candidate.parents and candidate != root:
        return None
    if candidate.is_file():
        return candidate
    return None


class Handler(BaseHTTPRequestHandler):
    service: Service
    root: Path

    def log_message(self, fmt: str, *args) -> None:
        return

    def _send(self, status: int, payload: dict) -> None:
        raw = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _read_json(self) -> dict | None:
        length = int(self.headers.get("Content-Length") or "0")
        if length < 0 or length > MAX_BODY:
            return None
        try:
            data = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeError, json.JSONDecodeError):
            return None
        return data if isinstance(data, dict) else None

    def do_GET(self) -> None:
        path = self.path.split("?", 1)[0]
        if path == "/api/google/status":
            status, body = self.service.status()
            self._send(status, body)
            return
        target = _safe_file(self.root, path)
        if target is None:
            self.send_error(404)
            return
        data = target.read_bytes()
        kind = "text/html; charset=utf-8" if target.suffix == ".html" else "application/octet-stream"
        if target.suffix == ".css":
            kind = "text/css; charset=utf-8"
        elif target.suffix == ".js":
            kind = "text/javascript; charset=utf-8"
        elif target.suffix == ".csv":
            kind = "text/csv; charset=utf-8"
        elif target.suffix == ".svg":
            kind = "image/svg+xml"
        elif target.suffix == ".json":
            kind = "application/json"
        self.send_response(200)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self) -> None:
        path = self.path.split("?", 1)[0]
        if path == "/api/google/reserve-map":
            status, body = self.service.reserve_map()
            self._send(status, body)
            return
        if path == "/api/google/geocode":
            payload = self._read_json()
            if payload is None:
                self._send(400, {"ok": False, "reason": "Request body was not valid JSON.", "results": []})
                return
            status, body = self.service.geocode(payload)
            self._send(status, body)
            return
        self.send_error(404)


def load_service(root: Path, environ: dict | None = None, opener=None, clock=None) -> Service:
    env = os.environ if environ is None else environ
    quota = None
    db = str(env.get("QUOTA_DB") or "").strip()
    if db:
        try:
            ceilings = {sku: resolve_ceiling(sku, env) for sku in SKUS}
            quota = Quota(db, ceilings)
        except (QuotaError, OSError):
            quota = None
    return Service(
        root,
        quota,
        str(env.get("GOOGLE_MAPS_BROWSER_KEY") or ""),
        str(env.get("GOOGLE_GEOCODING_SERVER_KEY") or ""),
        opener=opener,
        clock=clock,
    )


def make_server(host: str, port: int, root: Path, service: Service) -> ThreadingHTTPServer:
    Handler.service = service
    Handler.root = root.resolve()
    return ThreadingHTTPServer((host, port), Handler)


def main() -> None:
    import argparse
    parser = argparse.ArgumentParser(description="Serve the site and the Google quota gate")
    parser.add_argument("--root", default=".")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8080)
    args = parser.parse_args()
    root = Path(args.root).resolve()
    service = load_service(root)
    server = make_server(args.host, args.port, root, service)
    print(f"listening on http://{args.host}:{args.port}/excel-to-map/", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
