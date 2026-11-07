"""Cached official reference sources and provenance labels.

The app never fetches sources at request time; it reads the checked-in cache
in data/reference_sources.json, which records URL, checked date, effective
date and verification status for every record.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

DATA_PATH = Path(__file__).parent / "data" / "reference_sources.json"

VERIFICATION_STATUSES = {"team_verified", "organizer_verified_page", "unverified"}
REQUIRED_FIELDS = {"id", "name", "source_url", "checked_at", "source_kind", "verification_status", "limitations"}

# On-screen labels (plan: "Official published rate", "Published income-limit
# reference", "User-entered", "ASSUMPTION", "Candidate program — unconfirmed").
UI_LABELS = {
    "published_rate": "Official published rate",
    "published_income_limit": "Published income-limit reference",
    "user_entered": "User-entered",
    "assumption": "ASSUMPTION",
    "candidate_program": "Candidate program — unconfirmed",
}


@lru_cache(maxsize=1)
def _raw() -> str:
    return DATA_PATH.read_text(encoding="utf-8")


def load_reference_sources() -> dict:
    data = json.loads(_raw())
    validate_reference_sources(data)
    return data


def validate_reference_sources(data: dict) -> None:
    ids = set()
    for rec in data["records"]:
        missing = REQUIRED_FIELDS - rec.keys()
        if missing:
            raise ValueError(f"reference source {rec.get('id')!r} missing {sorted(missing)}")
        if rec["verification_status"] not in VERIFICATION_STATUSES:
            raise ValueError(f"reference source {rec['id']!r} has bad verification_status")
        if not rec["source_url"].startswith("https://"):
            raise ValueError(f"reference source {rec['id']!r} needs an https source_url")
        # A value shown as sourced must have been read by the team, with a date.
        if "value" in rec or "limits" in rec:
            if rec["verification_status"] != "team_verified" or not rec.get("effective_date"):
                raise ValueError(f"reference source {rec['id']!r} carries a value but is not team_verified with a date")
        if rec["id"] in ids:
            raise ValueError(f"duplicate reference source id {rec['id']!r}")
        ids.add(rec["id"])
