"""Quota and HTTP tests. They use mocks. They do not call Google."""

from __future__ import annotations

import json
import os
import sys
import tempfile
import threading
import unittest
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parent))

from google_geo import build_request, parse_body
from quota import HARD_CEILING, PACIFIC, Quota, QuotaError, billing_period, resolve_ceiling
from serve import Service, make_server

PT = ZoneInfo("America/Los_Angeles")


def at(year, month, day, hour=12):
    return datetime(year, month, day, hour, 0, tzinfo=PT)


class Response:
    def __init__(self, payload, status=200):
        self.payload = json.dumps(payload).encode()
        self.status = status

    def read(self):
        return self.payload

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


class Scripted:
    def __init__(self, items):
        self.items = list(items)
        self.urls = []

    def __call__(self, request, timeout=20):
        self.urls.append(request.full_url)
        item = self.items.pop(0)
        if isinstance(item, Exception):
            raise item
        return Response(item)


class QuotaTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = os.path.join(self.tmp.name, "quota.sqlite")
        self.quota = Quota(self.db, {"geocoding": 3, "dynamic_maps": 2})

    def tearDown(self):
        self.tmp.cleanup()

    def test_ceiling_cannot_exceed_hard_cap(self):
        self.assertEqual(resolve_ceiling("geocoding", {}), HARD_CEILING)
        self.assertEqual(resolve_ceiling("dynamic_maps", {"QUOTA_CEILING_DYNAMIC_MAPS": "100"}), 100)
        with self.assertRaises(QuotaError):
            resolve_ceiling("geocoding", {"QUOTA_CEILING_GEOCODING": "9001"})

    def test_month_resets_at_pacific_midnight(self):
        before = datetime(2026, 3, 1, 0, 0, tzinfo=PT)
        after = datetime(2026, 3, 1, 0, 0, tzinfo=PT)
        self.assertEqual(billing_period(datetime(2026, 2, 28, 23, 30, tzinfo=PT)), "2026-02")
        self.assertEqual(billing_period(after), "2026-03")
        self.assertNotEqual(billing_period(before - __import__("datetime").timedelta(seconds=1)), billing_period(after))
        self.quota.reserve("geocoding", 3, now=datetime(2026, 2, 28, 23, tzinfo=PT))
        blocked = self.quota.reserve("geocoding", 1, now=datetime(2026, 2, 28, 23, tzinfo=PT))
        self.assertFalse(blocked["ok"])
        fresh = self.quota.reserve("geocoding", 1, now=datetime(2026, 3, 1, 0, 5, tzinfo=PT))
        self.assertTrue(fresh["ok"])
        self.assertEqual(fresh["period"], "2026-03")
        self.assertEqual(fresh["used"], 1)

    def test_concurrent_reservations_stop_at_ceiling(self):
        quota = Quota(self.db, {"geocoding": 9000, "dynamic_maps": 5})
        quota.reserve("dynamic_maps", 4, now=at(2026, 11, 2))
        results = []
        lock = threading.Lock()

        def once():
            local = Quota(self.db, {"geocoding": 9000, "dynamic_maps": 5})
            result = local.reserve("dynamic_maps", 1, now=at(2026, 11, 2))
            with lock:
                results.append(result["ok"])

        threads = [threading.Thread(target=once) for _ in range(8)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()
        self.assertEqual(sum(1 for ok in results if ok), 1)
        self.assertEqual(quota.used("dynamic_maps", at(2026, 11, 2)), 5)

    def test_database_error_is_not_a_grant(self):
        broken = Quota(self.db)
        os.remove(self.db)
        with self.assertRaises(Exception):
            broken.reserve("geocoding", 1, now=at(2026, 11, 2))


class HttpTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = os.path.join(self.tmp.name, "quota.sqlite")
        self.root = Path(__file__).resolve().parents[2]
        self.script = Scripted([])
        self.service = Service(
            self.root,
            Quota(self.db, {"geocoding": 2, "dynamic_maps": 1}),
            "test-browser-key",
            "test-server-key",
            opener=self.script,
            clock=lambda: at(2026, 11, 9),
        )
        self.server = make_server("127.0.0.1", 0, self.root, self.service)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.port = self.server.server_address[1]

    def tearDown(self):
        self.server.shutdown()
        self.tmp.cleanup()

    def request(self, method, path, payload=None):
        import urllib.request
        data = None if payload is None else json.dumps(payload).encode()
        req = urllib.request.Request("http://127.0.0.1:%d%s" % (self.port, path), data=data, method=method)
        if data is not None:
            req.add_header("Content-Type", "application/json")
        with urllib.request.urlopen(req) as response:
            return response.status, json.loads(response.read().decode())

    def request_error(self, method, path, payload=None):
        import urllib.error
        import urllib.request
        data = None if payload is None else json.dumps(payload).encode()
        req = urllib.request.Request("http://127.0.0.1:%d%s" % (self.port, path), data=data, method=method)
        if data is not None:
            req.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(req) as response:
                return response.status, json.loads(response.read().decode())
        except urllib.error.HTTPError as err:
            return err.code, json.loads(err.read().decode())

    def test_status_does_not_reserve(self):
        status, body = self.request("GET", "/api/google/status")
        self.assertEqual(status, 200)
        self.assertEqual(body["used"]["dynamic_maps"], 0)
        self.assertEqual(body["used"]["geocoding"], 0)
        self.assertNotIn("test-browser-key", json.dumps(body))
        self.assertNotIn("test-server-key", json.dumps(body))

    def test_map_load_stops_at_ceiling_and_hides_key_when_blocked(self):
        status, first = self.request("POST", "/api/google/reserve-map", {})
        self.assertEqual(status, 200)
        self.assertEqual(first["browserKey"], "test-browser-key")
        code, blocked = self.request_error("POST", "/api/google/reserve-map", {})
        self.assertEqual(code, 429)
        self.assertNotIn("browserKey", blocked)
        self.assertFalse(blocked["ok"])

    def test_failed_geocode_is_counted_and_retry_counts_again(self):
        self.script.items.append(OSError("down"))
        self.script.items.append({"status": "OK", "results": [{"geometry": {"location": {"lat": 38.8, "lng": -77.0}}}]})
        consent = {"provider": "Google Geocoding API", "fields": ["street", "city", "state", "zip"]}
        row = {"id": "a", "street": "4600 Silver Hill Rd", "city": "Washington", "state": "DC", "zip": "20233"}
        status, failed = self.request("POST", "/api/google/geocode", {"consent": consent, "rows": [row]})
        self.assertEqual(status, 200)
        self.assertEqual(failed["results"][0]["status"], "error")
        self.assertEqual(failed["used"], 1)
        self.assertIn("key=test-server-key", self.script.urls[0])
        self.assertNotIn("test-server-key", json.dumps(failed))
        status, retried = self.request("POST", "/api/google/geocode", {"consent": consent, "rows": [row]})
        self.assertEqual(retried["results"][0]["status"], "matched")
        self.assertEqual(retried["used"], 2)
        self.assertEqual(len(self.script.urls), 2)

    def test_unconfigured_service_does_not_reserve_or_call(self):
        bare = Service(self.root, Quota(self.db), "", "", opener=self.script, clock=lambda: at(2026, 11, 9))
        code, body = bare.reserve_map()
        self.assertEqual(code, 503)
        self.assertFalse(body["ok"])
        self.assertEqual(self.script.urls, [])
        code, body = bare.geocode({"consent": {"provider": "Google Geocoding API", "fields": ["street", "city", "state", "zip"]}, "rows": [{"id": "a", "street": "1 Main", "city": "Sampletown", "state": "FL", "zip": "00000"}]})
        self.assertEqual(code, 503)
        self.assertEqual(self.script.urls, [])
        self.assertEqual(bare.quota.used("geocoding", at(2026, 11, 9)), 0)
        self.assertEqual(bare.quota.used("dynamic_maps", at(2026, 11, 9)), 0)

    def test_missing_database_blocks_google(self):
        service = Service(self.root, None, "browser", "server", opener=self.script)
        code, body = service.status()
        self.assertEqual(code, 503)
        self.assertFalse(body["maps"])
        code, body = service.reserve_map()
        self.assertEqual(code, 503)
        self.assertNotIn("browserKey", body)

    def test_parser_does_not_guess_among_multiple_matches(self):
        parsed = parse_body({"status": "OK", "results": [{}, {}]})
        self.assertEqual(parsed["status"], "uncertain")
        zero = parse_body({"status": "ZERO_RESULTS", "results": []})
        self.assertEqual(zero["status"], "unmatched")
        request = build_request({"street": "1 Main", "city": "Sampletown", "state": "FL", "zip": "00000", "name": "secret"}, "server-key")
        self.assertNotIn("secret", request.full_url)
        self.assertIn("address=", request.full_url)


if __name__ == "__main__":
    unittest.main()
