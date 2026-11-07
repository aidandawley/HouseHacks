"""HomeForge FastAPI app.

Projects: a file-based directory of seed projects (read-only, checked in; the
Santa Ana Washington Ave. case is the default demo) plus user-created projects.

POST /api/compare returns backend-computed affordability, funding stack,
every candidate scenario and the deterministic recommendation.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Literal, Optional

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:  # load ANTHROPIC_API_KEY etc. from the repo-root .env (gitignored); real env vars win
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=False)
except ImportError:  # optional dependency
    pass

from . import incentives
from . import projects as store
from .advisor import run_advisor
from .models import CompareRequest, InputProvenance, Project
from .optimize import compare as run_comparison
from .provenance import UI_LABELS, load_reference_sources

app = FastAPI(title="HomeForge API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)


def load_case_study() -> dict:
    """The illustrative 6/8/10 concept that backs the plan's numeric test oracle."""
    return store.get_project(store.BLANK_TEMPLATE_ID).model_dump(mode="json")


def _full(project: Project) -> dict:
    return {**project.model_dump(mode="json"), "reference_sources": load_reference_sources(), "ui_labels": UI_LABELS}


def _get_or_404(project_id: str) -> Project:
    try:
        return store.get_project(project_id)
    except store.ProjectNotFound:
        raise HTTPException(404, f"Project {project_id!r} not found")


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/case-study")
def get_case_study() -> dict:
    """Default demo project (kept for the plan's API contract)."""
    return _full(store.default_project())


# ---------------------------------------------------------------- projects


class ProjectSummary(BaseModel):
    id: str
    name: str
    kind: str
    is_default: bool
    case_type: str
    location: Optional[str]
    summary: Optional[str]
    candidate_home_counts: list[int]
    updated_at: Optional[str]


class CreateProjectRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    from_id: Optional[str] = None  # duplicate this project; omit for a blank (all-ASSUMPTION) project
    inputs: Optional[CompareRequest] = None  # e.g. "save as new" with current edits
    location: Optional[str] = Field(default=None, max_length=200)
    candidate_home_counts: Optional[list[int]] = None  # blank projects only


class UpdateProjectRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    inputs: Optional[CompareRequest] = None
    input_provenance: Optional[dict[str, InputProvenance]] = None


@app.get("/api/projects")
def list_projects() -> list[ProjectSummary]:
    return [ProjectSummary(**p.model_dump(include=set(ProjectSummary.model_fields))) for p in store.list_projects()]


@app.get("/api/projects/{project_id}")
def get_project(project_id: str) -> dict:
    return _full(_get_or_404(project_id))


@app.post("/api/projects", status_code=201)
def create_project(req: CreateProjectRequest) -> dict:
    if req.from_id:
        _get_or_404(req.from_id)
    try:
        return _full(store.create_project(req.name, req.from_id, req.inputs, req.location, req.candidate_home_counts))
    except ValueError as e:
        raise HTTPException(422, str(e))


@app.put("/api/projects/{project_id}")
def update_project(project_id: str, req: UpdateProjectRequest) -> dict:
    _get_or_404(project_id)
    prov = {k: v.model_dump() for k, v in req.input_provenance.items()} if req.input_provenance is not None else None
    try:
        return _full(store.update_project(project_id, req.name, req.inputs, prov))
    except store.ProjectReadOnly:
        raise HTTPException(403, "Seed projects are read-only. Save your edits as a new project instead.")


@app.delete("/api/projects/{project_id}", status_code=204)
def delete_project(project_id: str) -> Response:
    _get_or_404(project_id)
    try:
        store.delete_project(project_id)
    except store.ProjectReadOnly:
        raise HTTPException(403, "Seed projects cannot be deleted.")
    return Response(status_code=204)


# ---------------------------------------------------------------- analysis


@app.post("/api/compare")
def compare(request: CompareRequest) -> dict:
    result = run_comparison(request)
    body = result.model_dump(mode="json", exclude={"affordability": {"warning"}})
    body["candidate_home_counts"] = request.candidate_home_counts
    return body


# ---------------------------------------------------------------- funding & incentive advisor (P1)
# All of these run without Claude except /api/agent/chat, which falls back gracefully.


class ScenarioContext(BaseModel):
    project_id: str
    inputs: CompareRequest


class CheckRequest(ScenarioContext):
    program_id: str


class SimulateRequest(ScenarioContext):
    program_id: str
    amount: Optional[float] = Field(default=None, ge=0, le=100_000_000)


class ApplyRequest(BaseModel):
    proposal_id: str
    inputs: CompareRequest
    user_confirmed: bool


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=8000)


class ChatRequest(ScenarioContext):
    message: str = Field(min_length=1, max_length=2000)
    selected_homes: Optional[int] = None
    history: list[ChatTurn] = Field(default_factory=list, max_length=12)


def _program_or_404(program_id: str) -> incentives.Program:
    try:
        return incentives.get_program(program_id)
    except KeyError:
        raise HTTPException(404, f"Unknown program {program_id!r}")


@app.get("/api/incentives/catalog")
def incentive_catalog() -> dict:
    return {"programs": [p.model_dump() for p in incentives.load_catalog()], "disclaimer": incentives.DISCLAIMER}


@app.post("/api/incentives/screen")
def incentive_screen(req: ScenarioContext) -> dict:
    project = _get_or_404(req.project_id)
    return {"candidates": [c.model_dump() for c in incentives.screen_all(project, req.inputs)], "disclaimer": incentives.DISCLAIMER}


@app.post("/api/incentives/check")
def incentive_check(req: CheckRequest) -> dict:
    project = _get_or_404(req.project_id)
    return incentives.screen(_program_or_404(req.program_id), project, req.inputs).model_dump()


@app.post("/api/incentives/simulate")
def incentive_simulate(req: SimulateRequest) -> dict:
    """Non-mutating: runs the engine on a copy and returns a single-use proposal id."""
    project = _get_or_404(req.project_id)
    _program_or_404(req.program_id)
    return incentives.simulate(project, req.inputs, req.program_id, req.amount).model_dump(mode="json")


class EstimateRequest(ScenarioContext):
    program_id: str
    homes: Optional[int] = None
    effective_tax_rate: Optional[float] = None
    built_share_at_lien_date: Optional[float] = None
    eligible_lien_dates: Optional[int] = None


@app.post("/api/incentives/estimate-tax-relief")
def incentive_estimate(req: EstimateRequest) -> dict:
    """Quick, deterministic, hypothetical property-tax relief estimate (no Claude needed)."""
    _get_or_404(req.project_id)
    program = _program_or_404(req.program_id)
    try:
        est = incentives.estimate_tax_relief(program, req.inputs, req.homes, req.effective_tax_rate,
                                             req.built_share_at_lien_date, req.eligible_lien_dates)
    except incentives.SimulationRefused as e:
        raise HTTPException(422, str(e))
    return est.model_dump()


@app.post("/api/scenarios/apply-proposal")
def apply_proposal(req: ApplyRequest) -> dict:
    """The ONLY mutation path for advisor what-ifs; called by the UI's explicit confirm button."""
    try:
        patched = incentives.apply_proposal(req.proposal_id, req.inputs, req.user_confirmed)
    except incentives.ProposalError as e:
        raise HTTPException(e.status, str(e))
    return {"inputs": patched.model_dump(mode="json"), "scenario_version": incentives.scenario_version(patched)}


@app.post("/api/agent/chat")
def agent_chat(req: ChatRequest) -> dict:
    project = _get_or_404(req.project_id)
    result = run_advisor(project, req.inputs, req.selected_homes, req.message, [t.model_dump() for t in req.history])
    return result.model_dump(mode="json")


@app.get("/api/agent/status")
def agent_status() -> dict:
    return {"claude_configured": bool(os.environ.get("ANTHROPIC_API_KEY")), "model": os.environ.get("ANTHROPIC_MODEL", "claude-opus-5-5")}
