"""Durable monthly reservations for Google Maps Platform SKUs.

The free caps below are the global price list published by Google
(developers.google.com/maps/billing-and-pricing/pricing), not a hard
stop Google enforces. Usage above the cap is billed. Ceilings here are
lower on purpose and cannot be raised by configuration.
"""

from __future__ import annotations

import os
import sqlite3
from datetime import datetime
from zoneinfo import ZoneInfo

PACIFIC = ZoneInfo("America/Los_Angeles")

# Verified 2026-11-09 against the global core price list.
# Free usage resets on the first of each month at midnight Pacific time
# (pay-as-you-go docs). India list and negotiated contracts can differ.
SKUS = {
    "geocoding": {
        "id": "BAC8-4E68-E261",
        "name": "Geocoding",
        "free_cap": 10000,
        "usd_per_1000_after_cap": 5.0,
    },
    "dynamic_maps": {
        "id": "FAF4-3B2D-51B2",
        "name": "Dynamic Maps",
        "free_cap": 10000,
        "usd_per_1000_after_cap": 7.0,
    },
}

HARD_CEILING = 9000


class QuotaError(Exception):
    pass


def billing_period(now: datetime) -> str:
    if now.tzinfo is None:
        raise QuotaError("billing time must include a timezone")
    local = now.astimezone(PACIFIC)
    return f"{local.year:04d}-{local.month:02d}"


def resolve_ceiling(sku: str, environ: dict | None = None) -> int:
    if sku not in SKUS:
        raise QuotaError("unknown sku")
    env = os.environ if environ is None else environ
    raw = env.get("QUOTA_CEILING_" + sku.upper(), "")
    if raw is None or str(raw).strip() == "":
        return HARD_CEILING
    try:
        value = int(str(raw).strip())
    except ValueError as err:
        raise QuotaError("ceiling is not an integer") from err
    if value < 1 or value > HARD_CEILING:
        raise QuotaError("ceiling must be from 1 through 9000")
    return value


class Quota:
    def __init__(self, path: str, ceilings: dict | None = None):
        self.path = path
        self.ceilings = {
            sku: HARD_CEILING if ceilings is None else int(ceilings[sku])
            for sku in SKUS
        }
        for sku, ceiling in self.ceilings.items():
            if ceiling < 1 or ceiling > HARD_CEILING:
                raise QuotaError("ceiling must be from 1 through 9000")
        parent = os.path.dirname(path)
        if parent:
            os.makedirs(parent, exist_ok=True)
        self._init()

    def _connect(self) -> sqlite3.Connection:
        con = sqlite3.connect(self.path, timeout=5, isolation_level=None)
        con.execute("PRAGMA journal_mode=WAL")
        con.execute("PRAGMA busy_timeout=5000")
        return con

    def _init(self) -> None:
        con = self._connect()
        try:
            con.execute(
                """CREATE TABLE IF NOT EXISTS usage (
                    sku TEXT NOT NULL,
                    period TEXT NOT NULL,
                    used INTEGER NOT NULL,
                    PRIMARY KEY (sku, period)
                )"""
            )
        finally:
            con.close()

    def used(self, sku: str, now: datetime) -> int:
        period = billing_period(now)
        con = self._connect()
        try:
            row = con.execute(
                "SELECT used FROM usage WHERE sku=? AND period=?",
                (sku, period),
            ).fetchone()
            return int(row[0]) if row else 0
        finally:
            con.close()

    def reserve(self, sku: str, count: int, now: datetime) -> dict:
        if sku not in SKUS:
            raise QuotaError("unknown sku")
        if count < 1:
            raise QuotaError("count must be at least 1")
        ceiling = self.ceilings[sku]
        period = billing_period(now)
        con = self._connect()
        try:
            con.execute("BEGIN IMMEDIATE")
            row = con.execute(
                "SELECT used FROM usage WHERE sku=? AND period=?",
                (sku, period),
            ).fetchone()
            used = int(row[0]) if row else 0
            if used + count > ceiling:
                con.execute("ROLLBACK")
                return {
                    "ok": False,
                    "sku": sku,
                    "period": period,
                    "used": used,
                    "ceiling": ceiling,
                    "remaining": max(0, ceiling - used),
                    "reserved": 0,
                }
            if row:
                con.execute(
                    "UPDATE usage SET used=used+? WHERE sku=? AND period=?",
                    (count, sku, period),
                )
            else:
                con.execute(
                    "INSERT INTO usage (sku, period, used) VALUES (?, ?, ?)",
                    (sku, period, count),
                )
            con.execute("COMMIT")
            return {
                "ok": True,
                "sku": sku,
                "period": period,
                "used": used + count,
                "ceiling": ceiling,
                "remaining": ceiling - (used + count),
                "reserved": count,
            }
        except Exception:
            try:
                con.execute("ROLLBACK")
            except sqlite3.Error:
                pass
            raise
        finally:
            con.close()
