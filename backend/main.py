"""HomeForge FastAPI app.

POST /api/compare currently returns backend-computed household affordability.
Development cost / funding gap / scenarios are added in milestone 3; until
then no placeholder figures are returned for them.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .affordability import calculate_affordability
from .models import CompareRequest
from .provenance import UI_LABELS, load_reference_sources

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
    return {**load_case_study(), "reference_sources": load_reference_sources(), "ui_labels": UI_LABELS}


@app.post("/api/compare")
def compare(request: CompareRequest) -> dict:
    affordability = calculate_affordability(request.household)
    warnings = [
        "Costs, buyer income, funding commitments, site capacity and mortgage inputs are "
        "scenario assumptions; not verified Habitat project data."
    ]
    if affordability.warning:
        warnings.append(affordability.warning)
    # TODO(milestone 3): development cost, funding stack, gap and scenarios.
    return {
        "engine_status": "affordability_only",
        "affordability": affordability.model_dump(mode="json", exclude={"warning"}),
        "candidate_home_counts": request.candidate_home_counts,
        "case_type": "illustrative",
        "warnings": warnings,
    }
