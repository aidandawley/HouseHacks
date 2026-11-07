"""HomeForge FastAPI app.

Milestone 1 (skeleton): serves the case-study fixture and accepts/validates
analysis requests. The affordability and development/gap engines are wired
into POST /api/compare in milestones 2-3; until then the endpoint returns no
financial figures at all rather than placeholder numbers.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .models import CompareRequest

DATA_PATH = Path(__file__).parent / "data" / "case_study.json"

app = FastAPI(title="HomeForge API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@lru_cache(maxsize=1)
def _load_case_study_text() -> str:
    return DATA_PATH.read_text(encoding="utf-8")


def load_case_study() -> dict:
    # Fresh dict each call so callers can't mutate the cached fixture.
    return json.loads(_load_case_study_text())


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/case-study")
def get_case_study() -> dict:
    return load_case_study()


@app.post("/api/compare")
def compare(request: CompareRequest) -> dict:
    # TODO(milestone 2-3): replace with affordability + finance + optimize engines.
    return {
        "engine_status": "not_implemented",
        "message": "Request validated. Financial engines arrive in milestones 2-3; no figures are computed yet.",
        "candidate_home_counts": request.candidate_home_counts,
        "funding_source_count": len(request.funding_sources),
        "case_type": "illustrative",
    }
